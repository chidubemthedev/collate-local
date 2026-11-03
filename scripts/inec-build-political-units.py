"""Builds political units (senatorial districts and federal / state constituencies)
and their LGA membership from INEC's candidate lists and Wikipedia's federal
constituency table.

Inputs (all under data/inec/):
  geography.json.gz     INEC states, LGAs, wards, polling units (scripts/inec-scrape.ts)
  candidates.json.gz    constituency names per state (scripts/inec-extract-candidates.py)
  sources/wiki-federal.txt
                        wikitext of https://en.wikipedia.org/wiki/List_of_Nigerian_federal_constituencies
                        (gives each federal constituency's senatorial district)
Output:
  political-units.json.gz  {units: [...], report: {...}}

Membership is stored as LGA codes. A unit is only mapped when its LGAs can be
determined exactly: a constituency that shares an LGA with another constituency
of the same type is split below LGA level and is left unmapped, because no
ward-level source has been found.
"""
import difflib
import gzip
import json
import os
import re
import sys
import unicodedata
from collections import defaultdict

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "inec")


def norm(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().upper()
    return re.sub(r"[^A-Z0-9]", "", text)


def display(text):
    text = re.sub(r"\s*/\s*", "/", text.strip())
    return re.sub(r"\s+", " ", text)


ROMAN = re.compile(r"\s+(?:I{1,3}|IV|V|VI{0,3}|\d+)$", re.IGNORECASE)
PAREN = re.compile(r"\s*\([^)]*\)")


DIRECTIONS = {"NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"}

# INEC's LGA list and its constituency names disagree on spelling or naming in a
# few places. Each entry maps a normalised constituency token (or run of tokens)
# to the INEC LGA names it covers.
ALIASES = {
    "BORNO": {"MAIDUGURIMETROPOLITAN": ["MAIDUGURI M. C."], "KWAYAKUSARSHANI": ["KWAYA / KUSAR", "SHANI"]},
    "EBONYI": {
        "AFIKPONORTH": ["AFIKPO"],
        "AFIKPOSOUTH": ["EDDA"],
        "IVOOHAOZARA": ["IVO", "OHAOZARA"],
    },
    "EKITI": {
        "IDO": ["IDO / OSI"],
        "OSIMOBA": ["IDO / OSI", "MOBA"],
        "ORUN": ["ISE / ORUN"],
        "ISE": ["ISE / ORUN"],
        "GBONYIN": ["AIYEKIRE"],
    },
    "FCT": {"KWALIGWAGWALADA": ["KWALI", "GWAGWALADA"], "ABUJAMUNICIPAL": ["MUNICIPAL"]},
    "JIGAWA": {"BIRNIWAGURI": ["BIRNIWA", "GURI"]},
    "KANO": {"KUNCHI": ["GHARI"]},
    "KOGI": {
        "KOGILOKOJA": ["LOKOJA"],
        "KOGIKK": ["KOGI . K. K."],
        "KOTONKARFE": ["KOGI . K. K."],
    },
    "RIVERS": {"ANDONIOPOBO": ["ANDONI", "OPOBO/NKORO"], "NKORO": ["OPOBO/NKORO"]},
}


def tokens(name):
    """Splits a constituency name into LGA-like tokens."""
    name = re.sub(r"\s+", " ", name.strip())
    # "Oshimili North & South" expands to two LGAs; only the last segment is affected.
    head, _, tail = name.rpartition("/")
    both = re.match(r"^(.*?)\s+(\w+)\s*&\s*(\w+)$", tail)
    if both:
        stem = both.group(1)
        tail = f"{stem} {both.group(2)}/{stem} {both.group(3)}"
        name = f"{head}/{tail}" if head else tail
    parts = [p.strip() for p in re.split(r"[/,&]", name) if p.strip()]
    # "Anambra East/West": a bare direction takes the stem of the previous token.
    for index in range(1, len(parts)):
        if parts[index].upper() in DIRECTIONS:
            stem = re.sub(r"\s+(NORTH|SOUTH|EAST|WEST|CENTRAL)$", "", parts[index - 1], flags=re.IGNORECASE)
            parts[index] = f"{stem} {parts[index]}"
    return parts


def base_variants(token):
    """Yields progressively simplified forms of a token for matching."""
    seen = []
    for candidate in (token, PAREN.sub("", token), ROMAN.sub("", PAREN.sub("", token))):
        key = norm(candidate)
        if key and key not in seen:
            seen.append(key)
            yield key


def load_geography():
    geo = json.load(gzip.open(os.path.join(ROOT, "geography.json.gz"), "rt", encoding="utf-8"))
    states = {}
    for state in geo:
        states[norm(state["name"])] = {
            "code": state["code"],
            "name": state["name"],
            "lgas": {norm(l["name"]): l for l in state["lgas"]},
        }
    return states


def parse_wiki():
    """Returns {state_key: [(senatorial_name, constituency_name)]} from the wikitext."""
    path = os.path.join(ROOT, "sources", "wiki-federal.txt")
    text = open(path, encoding="utf-8", errors="replace").read()

    def strip_links(cell):
        cell = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", cell)
        return re.sub(r"<[^>]+>|\{\{[^}]*\}\}|'''?", "", cell).strip()

    result = defaultdict(list)
    state = None
    for line in text.splitlines():
        heading = re.match(r"^==\s*\[\[([^\]|]+?)(?:\|[^\]]*)?\]\]", line)
        if heading:
            state = re.sub(r"\s+State$", "", heading.group(1).strip())
            state = "FCT" if "Federal Capital" in state else state
            continue
        if state and line.startswith("|") and "||" in line and not line.startswith(("|-", "|}", "|+")):
            cells = [strip_links(c) for c in line.lstrip("| ").split("||")]
            if len(cells) >= 2 and cells[0] and cells[1]:
                result[norm(state)].append((cells[0], cells[1]))
    return result


def resolve_lgas(state, name):
    """Returns (matched LGA keys, unmatched tokens). INEC LGA names can contain a
    slash themselves, so runs of consecutive tokens are tried before single ones."""
    parts = tokens(name)
    aliases = ALIASES.get(norm(state["name"]), {})
    matched, unmatched = [], []
    index = 0
    while index < len(parts):
        hit = None
        for length in range(min(3, len(parts) - index), 0, -1):
            run = "/".join(parts[index:index + length])
            alias = next((aliases[k] for k in base_variants(run) if k in aliases), None)
            if alias:
                hit = ([norm(a) for a in alias if norm(a) in state["lgas"]], length)
                break
            key = next((k for k in base_variants(run) if k in state["lgas"]), None)
            if key:
                hit = ([key], length)
                break
        if hit:
            matched.extend(hit[0])
            index += hit[1]
        else:
            unmatched.append(parts[index])
            index += 1
    return list(dict.fromkeys(matched)), unmatched


def fuzzy(unmatched, free_keys):
    """Matches leftover tokens to LGAs of the state that no constituency has claimed yet."""
    resolved = {}
    for token in unmatched:
        best = difflib.get_close_matches(norm(ROMAN.sub("", PAREN.sub("", token))), free_keys, n=1, cutoff=0.78)
        if best:
            resolved[token] = best[0]
    return resolved


def claim_free_lgas(entries, free, cutoff=0.7):
    """entries: list of [id, matched LGA keys, unmatched tokens]. Every LGA that no
    entry has claimed picks the best leftover token, or pair of adjacent tokens,
    across the state. Spelling differs between INEC's LGA list and constituency names."""
    for lga_key in list(free):
        best = None
        for entry in entries:
            parts = entry[2]
            groups = [(i, 1, parts[i]) for i in range(len(parts))]
            groups += [(i, 2, parts[i] + parts[i + 1]) for i in range(len(parts) - 1)]
            for index, size, text in groups:
                ratio = difflib.SequenceMatcher(None, lga_key, norm(ROMAN.sub("", PAREN.sub("", text)))).ratio()
                if ratio >= cutoff and (best is None or ratio > best[0]):
                    best = (ratio, entry, index, size)
        if best:
            _, entry, index, size = best
            entry[1].append(lga_key)
            del entry[2][index:index + size]
            free.remove(lga_key)
    return free


def best_wiki_district(name, district_names):
    """Wiki and INEC spell district names slightly differently (Nasarawa / Nassarawa).
    Returns the single closest wiki district, or None if nothing is close."""
    scored = [(difflib.SequenceMatcher(None, norm(name), norm(wiki)).ratio(), wiki) for wiki in district_names]
    best = max(scored, default=(0, None))
    return best[1] if best[0] >= 0.6 else None


def main():
    states = load_geography()
    cands = json.load(gzip.open(os.path.join(ROOT, "candidates.json.gz"), "rt", encoding="utf-8"))
    wiki = parse_wiki()
    report = defaultdict(list)
    units = []

    for state_key, state in states.items():
        names = cands["constituencies"].get(state["name"]) or next(
            (v for k, v in cands["constituencies"].items() if norm(k) == state_key), {}
        )
        wiki_rows = wiki.get(state_key, [])

        # Federal constituencies: LGAs come straight from the name.
        federal = {}
        for name in names.get("federal", []):
            federal.setdefault(norm(name), display(name))
        fed_entries = []
        for key, name in federal.items():
            matched, unmatched = resolve_lgas(state, name)
            fed_entries.append([key, list(matched), list(unmatched)])
        claimed = {k for entry in fed_entries for k in entry[1]}
        free = claim_free_lgas(fed_entries, [k for k in state["lgas"] if k not in claimed])
        fed_lgas = {entry[0]: entry[1] for entry in fed_entries}
        for entry in fed_entries:
            if entry[2]:
                report["federal_unresolved_token"].append(f"{state['name']}: {federal[entry[0]]} -> {', '.join(entry[2])}")
        if free and federal:
            report["federal_lga_unclaimed"].append(f"{state['name']}: {', '.join(state['lgas'][k]['name'] for k in free)}")

        # The wiki rows give the senatorial district of each federal constituency.
        district_lgas = defaultdict(set)
        wiki_entries = []
        for senatorial, constituency in wiki_rows:
            matched, unmatched = resolve_lgas(state, constituency)
            wiki_entries.append([senatorial, list(matched), list(unmatched)])
        wiki_claimed = {k for entry in wiki_entries for k in entry[1]}
        wiki_free = claim_free_lgas(wiki_entries, [k for k in state["lgas"] if k not in wiki_claimed])
        for entry in wiki_entries:
            district_lgas[entry[0]].update(entry[1])
        # INEC's federal names are complete where a wiki row omits an LGA: attach each
        # one to the wiki district it overlaps most.
        for key, lgas in fed_lgas.items():
            overlaps = [(len(set(lgas) & set(entry[1])), entry[0]) for entry in wiki_entries]
            best = max(overlaps, default=(0, None))
            if best[0] > 0:
                district_lgas[best[1]].update(lgas)
        assigned = set().union(*district_lgas.values()) if district_lgas else set()
        leftovers = [state["lgas"][k]["name"] for k in state["lgas"] if k not in assigned]
        if leftovers:
            report["lga_without_district"].append(f"{state['name']}: {', '.join(leftovers)}")
        counts = defaultdict(int)
        for lgas in district_lgas.values():
            for k in lgas:
                counts[k] += 1
        shared_lgas = [state["lgas"][k]["name"] for k, v in counts.items() if v > 1]
        if shared_lgas:
            report["lga_in_two_districts"].append(f"{state['name']}: {', '.join(shared_lgas)}")

        all_fed = [k for v in fed_lgas.values() for k in v]
        shared = {k for k in all_fed if all_fed.count(k) > 1}
        for key, name in federal.items():
            lgas = fed_lgas[key]
            exact = bool(lgas) and not any(k in shared for k in lgas)
            units.append({
                "type": "federal_constituency", "state": state["code"], "name": name,
                "lgas": [state["lgas"][k]["code"] for k in lgas] if exact else [],
                "mapped": exact,
            })
            if not exact:
                report["federal_unmapped"].append(f"{state['name']}: {name}")

        # Senatorial districts: union of the LGAs of their federal constituencies (wiki).
        districts = {}
        for name in names.get("senatorial", []):
            districts.setdefault(norm(name), display(name))
        district_names = list(district_lgas)
        chosen = {}
        for key, name in districts.items():
            if len(districts) == 1:
                lgas = set(state["lgas"])
            else:
                wiki_name = best_wiki_district(name, district_names)
                chosen[key] = wiki_name
                lgas = set(district_lgas[wiki_name]) if wiki_name else set()
            units.append({
                "type": "senatorial_district", "state": state["code"], "name": name,
                "lgas": sorted(state["lgas"][k]["code"] for k in lgas), "mapped": bool(lgas),
            })
            if not lgas:
                report["senatorial_unmapped"].append(f"{state['name']}: {name}")
        picked = [v for v in chosen.values() if v]
        if len(picked) != len(set(picked)):
            report["senatorial_name_clash"].append(state["name"])
        district_units = [u for u in units if u["type"] == "senatorial_district" and u["state"] == state["code"]]
        all_codes = [code for u in district_units for code in u["lgas"]]
        if len(all_codes) != len(set(all_codes)) or len(set(all_codes)) != len(state["lgas"]):
            report["senatorial_not_a_partition"].append(state["name"])

        # State constituencies: only those that map to LGAs no other state constituency touches.
        state_cons = {}
        for name in names.get("state", []):
            state_cons.setdefault(norm(name), display(name))
        resolved = {key: resolve_lgas(state, name) for key, name in state_cons.items()}
        usage = defaultdict(list)
        for key, (matched, _) in resolved.items():
            for lga_key in set(matched):
                usage[lga_key].append(key)
        for key, name in state_cons.items():
            matched, unmatched = resolved[key]
            exact = bool(matched) and not unmatched and all(len(usage[k]) == 1 for k in matched)
            # A suffix such as "I" or "II" means the LGA is split below LGA level.
            split_marker = bool(ROMAN.search(PAREN.sub("", name))) or bool(PAREN.search(name))
            exact = exact and not split_marker
            units.append({
                "type": "state_constituency", "state": state["code"], "name": name,
                "lgas": [state["lgas"][k]["code"] for k in matched] if exact else [], "mapped": exact,
            })
            if not exact:
                report["state_unmapped"].append(f"{state['name']}: {name}")

    summary = {}
    for kind in ("senatorial_district", "federal_constituency", "state_constituency"):
        group = [u for u in units if u["type"] == kind]
        summary[kind] = {"total": len(group), "mapped": sum(1 for u in group if u["mapped"])}
    out = {"units": units, "summary": summary, "report": {k: sorted(set(v)) for k, v in report.items()}}
    with gzip.open(os.path.join(ROOT, "political-units.json.gz"), "wt", encoding="utf-8", compresslevel=9) as handle:
        json.dump(out, handle, ensure_ascii=False, separators=(",", ":"))
    print(json.dumps(summary, indent=2), file=sys.stderr)
    for key, values in out["report"].items():
        print(f"{key}: {len(values)}", file=sys.stderr)


if __name__ == "__main__":
    main()
