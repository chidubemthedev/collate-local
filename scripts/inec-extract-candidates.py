"""Extracts candidates and constituencies from INEC's final candidate list PDFs.

Input : data/inec/candidates/<kind>__*.pdf (downloaded from https://www.inecnigeria.org/press)
        kind is one of pres, gov, sen, reps, sha
Output: data/inec/candidates.json.gz with
          - "ndc": every NDC candidate (deputies and VPs are attached to their principal)
          - "constituencies": every constituency named in any party's list, per state

Text is read from the words inside each table cell. PyMuPDF's table.extract()
text is not used because it injects stray characters from neighbouring cells.

Requires PyMuPDF (pip install pymupdf).
"""
import glob
import gzip
import json
import multiprocessing
import os
import re
import sys

import fitz

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "data", "inec", "candidates")
OUT = os.path.join(ROOT, "data", "inec", "candidates.json.gz")
PARTY = "NDC"
PAGES_PER_TASK = 40
KINDS = ("pres", "gov", "sen", "reps", "sha")


def clean(value):
    return re.sub(r"\s+", " ", (value or "").replace("\n", " ")).strip()


def cell_words(words, bbox):
    x0, y0, x1, y1 = bbox
    found = [
        w
        for w in words
        if x0 <= (w[0] + w[2]) / 2 <= x1 and y0 <= (w[1] + w[3]) / 2 <= y1
    ]
    return sorted(found, key=lambda w: (round(w[1], 0), w[0]))


def cell_text(words, bbox):
    return clean(" ".join(w[4] for w in cell_words(words, bbox)))


def split_pair(words, name_bbox, age_bbox):
    """Splits a two-person cell (principal and deputy) at the y position of the second age."""
    ages = [w for w in cell_words(words, age_bbox) if w[4].isdigit()]
    names = cell_words(words, name_bbox)
    if len(ages) < 2:
        return clean(" ".join(w[4] for w in names)), ""
    boundary = ages[1][1] - 2
    first = clean(" ".join(w[4] for w in names if w[1] < boundary))
    second = clean(" ".join(w[4] for w in names if w[1] >= boundary))
    return first, second


def parse_page(path, kind, page_number):
    page = fitz.open(path)[page_number]
    words = page.get_text("words")
    rows = []
    for table in page.find_tables():
        if not table.rows:
            continue
        header = [cell_text(words, c) if c else "" for c in table.rows[0].cells]
        if "NAME OF CANDIDATE" not in header:
            continue
        col = {name: i for i, name in enumerate(header)}
        for row in table.rows[1:]:
            cells = row.cells
            if any(c is None for c in cells):
                continue
            party = cell_text(words, cells[col["PARTY"]])
            if kind in ("pres", "gov"):
                principal, deputy = split_pair(words, cells[col["NAME OF CANDIDATE"]], cells[col["AGE"]])
                state = "NIGERIA" if kind == "pres" else cell_text(words, cells[col["STATE"]])
                if kind == "gov":
                    # The state cell repeats once for the deputy line.
                    half = len(state) // 2
                    if state[:half].strip() and state[:half].strip() == state[half:].strip():
                        state = state[:half].strip()
                record = {"kind": kind, "state": state, "constituency": "", "party": party, "name": principal, "deputy": deputy}
            else:
                record = {
                    "kind": kind,
                    "state": cell_text(words, cells[col["STATE"]]),
                    "constituency": cell_text(words, cells[col["CONSTITUENCY"]]),
                    "party": party,
                    "name": cell_text(words, cells[col["NAME OF CANDIDATE"]]),
                }
            rows.append(record)
    return rows


def parse_task(task):
    path, kind, first, last = task
    rows = []
    for number in range(first, last):
        rows.extend(parse_page(path, kind, number))
    return rows


def build_tasks():
    tasks = []
    for kind in KINDS:
        for path in sorted(glob.glob(os.path.join(SRC, f"{kind}__*.pdf"))):
            count = len(fitz.open(path))
            for first in range(0, count, PAGES_PER_TASK):
                tasks.append((path, kind, first, min(first + PAGES_PER_TASK, count)))
    return tasks


def suspicious(name):
    tokens = name.split()
    return len(tokens) < 2 or len(tokens[0]) == 1 or len(tokens[-1]) == 1


def main():
    tasks = build_tasks()
    print(f"{len(tasks)} tasks", file=sys.stderr)
    with multiprocessing.Pool() as pool:
        results = pool.map(parse_task, tasks, chunksize=1)
    rows = [row for chunk in results for row in chunk]

    constituencies = {}
    for row in rows:
        if row["kind"] in ("sen", "reps", "sha") and row["constituency"]:
            key = {"sen": "senatorial", "reps": "federal", "sha": "state"}[row["kind"]]
            constituencies.setdefault(row["state"], {}).setdefault(key, set()).add(row["constituency"])

    ndc = [row for row in rows if row["party"] == PARTY]
    for row in ndc:
        row["review"] = suspicious(row["name"]) or (row.get("deputy", "") != "" and suspicious(row["deputy"]))

    payload = {
        "ndc": ndc,
        "constituencies": {
            state: {key: sorted(values) for key, values in types.items()}
            for state, types in sorted(constituencies.items())
        },
        "rows_per_kind": {kind: sum(1 for r in rows if r["kind"] == kind) for kind in KINDS},
    }
    with gzip.open(OUT, "wt", encoding="utf-8", compresslevel=9) as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))

    by_kind = {}
    for row in ndc:
        by_kind[row["kind"]] = by_kind.get(row["kind"], 0) + 1
    print("rows per kind:", payload["rows_per_kind"], file=sys.stderr)
    print("NDC candidates by kind:", by_kind, file=sys.stderr)
    print("flagged for review:", sum(1 for r in ndc if r["review"]), file=sys.stderr)


if __name__ == "__main__":
    main()
