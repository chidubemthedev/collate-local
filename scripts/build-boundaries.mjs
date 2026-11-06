#!/usr/bin/env node
/**
 * Builds the map outlines from the GRID3 boundary files.
 *
 *   npm run boundaries:build
 *
 * Reads   data/grid3/states.geojson, lgas.geojson, wards.geojson  (GRID3 NGA operational boundaries)
 *         data/inec/geography.json.gz                              (INEC states, LGAs and wards)
 * Writes  public/boundaries/states.json                            every state
 *         public/boundaries/lgas.json                              every LGA
 *         public/boundaries/wards/<state code>.json               the wards of one state (loaded on demand)
 *         public/boundaries/report.json                           what matched and what did not
 *
 * Shapes are simplified (Douglas–Peucker) and rounded to 4 decimals (about 11 m), and each one is
 * tagged with its INEC codes, so the app matches outlines by code. GRID3 and INEC spell some names
 * differently ("SOMOLU" / "Shomolu"), so names are matched exactly first, then by similarity within
 * the same state (LGAs) or LGA (wards). Unmatched shapes are kept with no code and drawn grey.
 *
 * No dependencies: the files are read as a stream, so the 500 MB wards file never sits in memory whole.
 */
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

const ROOT = process.cwd();
const SRC = join(ROOT, "data", "grid3");
const OUT = join(ROOT, "public", "boundaries");

// Simplification tolerance in degrees (1e-4 ≈ 11 m). Larger areas are seen from further out.
const TOLERANCE = { state: 0.004, lga: 0.0015, ward: 0.0004 };
const PRECISION = 1e4;
// Below this similarity, a name is left unmatched rather than guessed.
const MIN_SIMILARITY = 0.6;

// ---------------------------------------------------------------- names

export function normName(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };
const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };

/**
 * normName, but numbering written any way reads the same: "Item III", "ITEM C", "Item 3" and
 * "Item Three" all become "item3". A single letter only counts as a number after the first word
 * ("B-Dere" stays "bdere"). The word "ward" is dropped, and "ONE (1)" counts once.
 */
export function canonName(value) {
  const words = String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9]+/g) ?? [];
  const out = [];
  words.forEach((word, i) => {
    if (word === "ward") return;
    let token = word;
    if (ROMAN[word]) token = String(ROMAN[word]);
    else if (WORDS[word]) token = String(WORDS[word]);
    else if (i > 0 && /^[a-l]$/.test(word)) token = String(word.charCodeAt(0) - 96);
    if (/^\d+$/.test(token)) token = String(Number(token));
    if (/^\d+$/.test(token) && out[out.length - 1] === token) return;
    out.push(token);
  });
  return out.join("");
}

/** The places in a combined name: "IGANDO/EGAN" → ["igando", "egan"]. */
function nameParts(value) {
  return String(value ?? "")
    .split(/\/|,|\band\b/i)
    .map(canonName)
    .filter((part) => part.length > 0);
}

/** 0–1: 1 for the same name; containment ("maiduguri" in "maidugurimc") scores high. */
export function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ratio = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  const contained = shorter.length >= 4 && longer.includes(shorter) ? 0.85 : 0;
  return Math.max(ratio, contained);
}

/**
 * Pairs GRID3 shapes with INEC units by name. Exact matches first, then the most similar
 * remaining pairs, each unit and each shape used once. A shape may carry other names in `names`
 * (GRID3 alternative names); any of them can match.
 *
 * With `shared: true` (wards), shapes still unmatched may then share a unit, because GRID3 often
 * splits one INEC ward into several. Names are compared with canonName (I / A / 1 alike), and
 * still-unmatched shapes may share a unit:
 *   - "Ward 5" / "GoWard 5" goes to the unit numbered 05;
 *   - "Igando" goes to "IGANDO/EGAN" when exactly one unit lists that place.
 * @returns Map<shapeIndex, inecUnit>
 */
export function matchByName(shapes, units, { shared = false } = {}) {
  const key = shared ? canonName : normName;
  const result = new Map();
  const freeUnits = new Set(units.map((_, i) => i));
  const namesOf = (shape) => [shape.name, ...(shape.names ?? [])].map(key).filter(Boolean);
  const byKey = new Map();
  units.forEach((unit, i) => {
    const k = key(unit.name);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(i);
  });
  const leftShapes = [];
  shapes.forEach((shape, si) => {
    const hit = namesOf(shape)
      .flatMap((k) => byKey.get(k) ?? [])
      .find((i) => freeUnits.has(i));
    if (hit !== undefined) {
      result.set(si, units[hit]);
      freeUnits.delete(hit);
    } else {
      leftShapes.push(si);
    }
  });
  const pairs = [];
  for (const si of leftShapes) {
    const names = namesOf(shapes[si]);
    for (const ui of freeUnits) {
      const unitName = key(units[ui].name);
      const score = Math.max(0, ...names.map((name) => similarity(name, unitName)));
      if (score >= MIN_SIMILARITY) pairs.push([score, si, ui]);
    }
  }
  pairs.sort((x, y) => y[0] - x[0]);
  const usedShapes = new Set();
  for (const [, si, ui] of pairs) {
    if (usedShapes.has(si) || !freeUnits.has(ui)) continue;
    result.set(si, units[ui]);
    usedShapes.add(si);
    freeUnits.delete(ui);
  }
  // One shape and one name left over: the same place under two names (renamed LGAs such as
  // Gbonyin / Aiyekire, Kunchi / Ghari, Afikpo South / Edda).
  const shapesLeft = shapes.map((_, si) => si).filter((si) => !result.has(si));
  if (shapesLeft.length === 1 && freeUnits.size === 1) {
    result.set(shapesLeft[0], units[[...freeUnits][0]]);
  }
  if (!shared) return result;

  const unitParts = units.map((unit) => nameParts(unit.name));
  for (const si of shapes.map((_, i) => i).filter((i) => !result.has(i))) {
    const shape = shapes[si];
    const rawNames = [shape.name, ...(shape.names ?? [])];
    const numbered = rawNames.map((name) => /ward\s*(\d+)\s*$/i.exec(String(name ?? ""))).find(Boolean);
    if (numbered) {
      const unit = units.find((u) => Number(u.code) === Number(numbered[1]));
      if (unit) {
        result.set(si, unit);
        continue;
      }
    }
    const shapeParts = rawNames.flatMap(nameParts);
    const hits = new Set();
    units.forEach((_, ui) => {
      for (const a of unitParts[ui]) {
        for (const b of shapeParts) {
          if (a === b || (a.length >= 5 && b.length >= 5 && similarity(a, b) >= 0.85)) hits.add(ui);
        }
      }
    });
    if (hits.size === 1) result.set(si, units[[...hits][0]]);
  }
  return result;
}

// ---------------------------------------------------------------- geometry

function perpendicularDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  const x = a[0] + t * dx;
  const y = a[1] + t * dy;
  return Math.hypot(p[0] - x, p[1] - y);
}

/** Douglas–Peucker on one ring, then rounding; a ring that collapses keeps its original shape. */
export function simplifyRing(ring, tolerance) {
  if (ring.length <= 4) return roundRing(ring);
  const keep = new Uint8Array(ring.length);
  keep[0] = 1;
  keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let maxDist = 0;
    let index = -1;
    for (let i = start + 1; i < end; i += 1) {
      const d = perpendicularDistance(ring[i], ring[start], ring[end]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index !== -1 && maxDist > tolerance) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  const out = ring.filter((_, i) => keep[i]);
  const rounded = roundRing(out);
  return rounded.length >= 4 ? rounded : roundRing(ring);
}

function roundRing(ring) {
  const out = [];
  for (const [x, y] of ring) {
    const p = [Math.round(x * PRECISION) / PRECISION, Math.round(y * PRECISION) / PRECISION];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  if (out.length && (out[0][0] !== out[out.length - 1][0] || out[0][1] !== out[out.length - 1][1])) {
    out.push([...out[0]]);
  }
  return out;
}

export function simplifyGeometry(geometry, tolerance) {
  if (!geometry) return null;
  const polygon = (rings) =>
    rings.map((ring) => simplifyRing(ring, tolerance)).filter((ring) => ring.length >= 4);
  if (geometry.type === "Polygon") {
    const rings = polygon(geometry.coordinates);
    return rings.length ? { type: "Polygon", coordinates: rings } : null;
  }
  if (geometry.type === "MultiPolygon") {
    const parts = geometry.coordinates.map(polygon).filter((rings) => rings.length);
    if (!parts.length) return null;
    return parts.length === 1 ? { type: "Polygon", coordinates: parts[0] } : { type: "MultiPolygon", coordinates: parts };
  }
  return null;
}

// ---------------------------------------------------------------- streaming GeoJSON

/**
 * Calls onFeature for each object in the top-level "features" array, parsing one feature at a
 * time. Works on single-line files of any size.
 */
export function streamFeatures(path, onFeature) {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(path, { encoding: "utf8", highWaterMark: 1 << 20 });
    let phase = "seek"; // seek "features" → seek "[" → inside array
    let seekBuffer = "";
    let depth = 0;
    let inString = false;
    let escaped = false;
    let parts = [];
    let count = 0;

    stream.on("data", (chunk) => {
      let i = 0;
      if (phase === "seek") {
        seekBuffer += chunk;
        const at = seekBuffer.indexOf('"features"');
        if (at === -1) {
          seekBuffer = seekBuffer.slice(-16);
          return;
        }
        chunk = seekBuffer.slice(at + 10);
        seekBuffer = "";
        phase = "bracket";
      }
      if (phase === "bracket") {
        const at = chunk.indexOf("[");
        if (at === -1) return;
        i = at + 1;
        phase = "array";
      }
      let start = -1;
      for (; i < chunk.length; i += 1) {
        const c = chunk.charCodeAt(i);
        if (depth === 0) {
          if (c === 123 /* { */) {
            depth = 1;
            start = i;
            inString = false;
            escaped = false;
          } else if (c === 93 /* ] */) {
            phase = "done";
            stream.destroy();
            break;
          }
          continue;
        }
        if (inString) {
          if (escaped) escaped = false;
          else if (c === 92 /* \ */) escaped = true;
          else if (c === 34 /* " */) inString = false;
          continue;
        }
        if (c === 34) inString = true;
        else if (c === 123) depth += 1;
        else if (c === 125 /* } */) {
          depth -= 1;
          if (depth === 0) {
            parts.push(chunk.slice(start === -1 ? 0 : start, i + 1));
            const text = parts.join("");
            parts = [];
            start = -1;
            try {
              onFeature(JSON.parse(text), count);
            } catch (error) {
              stream.destroy();
              reject(error);
              return;
            }
            count += 1;
          }
        }
      }
      if (depth > 0) parts.push(chunk.slice(start === -1 ? 0 : start));
    });
    stream.on("close", () => resolve(count));
    stream.on("error", reject);
  });
}

// ---------------------------------------------------------------- build

const FIELD_CANDIDATES = {
  state: ["statename", "state_name", "StateName", "state", "STATE"],
  lga: ["lganame", "lga_name", "LGAName", "lga", "LGA"],
  ward: ["wardname", "ward_name", "WardName", "ward", "name", "WARD"],
  lgaCode: ["lgacode", "lga_code", "LGACode"],
  wardAlt: ["ward_alt_names", "ward_v1_grid3", "alt_names"],
};

/** GRID3 writes the capital as "Fct" in one file and "FCT, Abuja" in another. */
function stateKey(name) {
  const key = normName(name);
  return key.startsWith("fct") || key.includes("abuja") || key === "federalcapitalterritory" ? "fct" : key;
}

/** Alternative names, however GRID3 separated them. */
function altNames(properties, keys) {
  return keys
    .flatMap((key) => String(properties[key] ?? "").split(/[,;|]/))
    .map((name) => name.trim())
    .filter((name) => name && name.toLowerCase() !== "null" && name.toLowerCase() !== "none");
}

function pickField(properties, kind) {
  return FIELD_CANDIDATES[kind].find((key) => key in properties) ?? null;
}

function loadInec() {
  const file = join(ROOT, "data", "inec", "geography.json.gz");
  return JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"));
}

/** The LGA in this state whose GRID3 or INEC name is closest, if it is close enough. */
function closestLga(candidates, key) {
  let best = null;
  let bestScore = 0.75;
  for (const candidate of candidates ?? []) {
    const score = Math.max(similarity(candidate.key, key), similarity(candidate.inecKey, key));
    if (score > bestScore && candidate.tag.lga) {
      best = candidate.tag;
      bestScore = score;
    }
  }
  return best;
}

function featureCollection(features) {
  return JSON.stringify({ type: "FeatureCollection", features });
}

function kb(text) {
  return `${Math.round(Buffer.byteLength(text) / 1024).toLocaleString()} KB`;
}

export async function build() {
  for (const name of ["states.geojson", "lgas.geojson"]) {
    if (!existsSync(join(SRC, name))) throw new Error(`Missing ${join("data", "grid3", name)}`);
  }
  const inec = loadInec();
  const inecStateByKey = new Map(inec.map((state) => [stateKey(state.name), state]));
  const report = { generatedAt: new Date().toISOString(), states: {}, lgas: {}, wards: {} };

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, "wards"), { recursive: true });

  // States
  const stateShapes = [];
  await streamFeatures(join(SRC, "states.geojson"), (f) => {
    const name = f.properties[pickField(f.properties, "state")];
    stateShapes.push({ name, geometry: simplifyGeometry(f.geometry, TOLERANCE.state) });
  });
  const stateMatch = matchByName(stateShapes, inec);
  const stateFeatures = stateShapes.map((shape, i) => {
    const unit = stateMatch.get(i);
    return {
      type: "Feature",
      geometry: shape.geometry,
      properties: { state: unit?.code ?? null, name: unit?.name ?? shape.name },
    };
  });
  // GRID3 state name → INEC state, used by the LGA and ward files.
  const stateByGridName = new Map(stateShapes.map((shape, i) => [stateKey(shape.name), stateMatch.get(i)]));
  const statesText = featureCollection(stateFeatures.filter((f) => f.geometry));
  writeFileSync(join(OUT, "states.json"), statesText);
  report.states = {
    shapes: stateShapes.length,
    matched: stateMatch.size,
    unmatched: stateShapes.filter((_, i) => !stateMatch.has(i)).map((s) => s.name),
  };
  console.log(`states: ${stateMatch.size}/${stateShapes.length} matched, ${kb(statesText)}`);

  // LGAs, matched within their state
  const lgaShapes = [];
  await streamFeatures(join(SRC, "lgas.geojson"), (f) => {
    const p = f.properties;
    lgaShapes.push({
      name: p[pickField(p, "lga")],
      stateName: p[pickField(p, "state")],
      gridCode: pickField(p, "lgaCode") ? String(p[pickField(p, "lgaCode")]) : null,
      geometry: simplifyGeometry(f.geometry, TOLERANCE.lga),
    });
  });
  const lgaByGridCode = new Map();
  const lgaByGridName = new Map();
  const lgaFeatures = [];
  let lgaMatched = 0;
  const lgaUnmatched = [];
  const shapesByState = new Map();
  lgaShapes.forEach((shape) => {
    const key = stateKey(shape.stateName);
    if (!shapesByState.has(key)) shapesByState.set(key, []);
    shapesByState.get(key).push(shape);
  });
  // LGAs of each state, for ward files that spell an LGA differently ("Damban" / "Dambam").
  const lgaTagsByState = new Map();
  for (const [sKey, shapes] of shapesByState) {
    const state = stateByGridName.get(sKey) ?? inecStateByKey.get(sKey);
    const match = state ? matchByName(shapes, state.lgas) : new Map();
    shapes.forEach((shape, i) => {
      const lga = match.get(i);
      if (lga) lgaMatched += 1;
      else lgaUnmatched.push(`${shape.stateName} / ${shape.name}`);
      const tag = { state: state?.code ?? null, lga: lga?.code ?? null, inecLga: lga ?? null };
      if (shape.gridCode) lgaByGridCode.set(shape.gridCode, tag);
      lgaByGridName.set(`${sKey}|${normName(shape.name)}`, tag);
      if (!lgaTagsByState.has(sKey)) lgaTagsByState.set(sKey, []);
      lgaTagsByState.get(sKey).push({ key: normName(shape.name), inecKey: normName(lga?.name), tag });
      if (shape.geometry) {
        lgaFeatures.push({
          type: "Feature",
          geometry: shape.geometry,
          properties: { state: tag.state, lga: tag.lga, name: lga?.name ?? shape.name },
        });
      }
    });
  }
  const lgasText = featureCollection(lgaFeatures);
  writeFileSync(join(OUT, "lgas.json"), lgasText);
  report.lgas = { shapes: lgaShapes.length, matched: lgaMatched, unmatched: lgaUnmatched };
  console.log(`lgas: ${lgaMatched}/${lgaShapes.length} matched, ${kb(lgasText)}`);

  // Wards, matched within their LGA, written one file per state
  const wardsPath = join(SRC, "wards.geojson");
  if (!existsSync(wardsPath)) {
    console.warn("wards: data/grid3/wards.geojson not found, skipped");
  } else {
    let fields = null;
    const wardShapesByLga = new Map();
    const started = Date.now();
    const total = await streamFeatures(wardsPath, (f, index) => {
      const p = f.properties ?? {};
      if (!fields) {
        fields = {
          ward: pickField(p, "ward"),
          lga: pickField(p, "lga"),
          state: pickField(p, "state"),
          lgaCode: pickField(p, "lgaCode"),
          wardAlt: FIELD_CANDIDATES.wardAlt.filter((key) => key in p),
        };
        console.log(`wards: fields ${JSON.stringify(fields)} (all: ${Object.keys(p).join(", ")})`);
        if (!fields.ward || (!fields.lga && !fields.lgaCode)) {
          throw new Error("wards.geojson: could not find the ward and LGA name fields; see the list above.");
        }
      }
      const sKey = stateKey(p[fields.state]);
      const tag =
        (fields.lgaCode && lgaByGridCode.get(String(p[fields.lgaCode]))) ||
        lgaByGridName.get(`${sKey}|${normName(p[fields.lga])}`) ||
        closestLga(lgaTagsByState.get(sKey), normName(p[fields.lga])) ||
        null;
      const key = tag ? `${tag.state}|${tag.lga}` : `?|${sKey}|${normName(p[fields.lga])}`;
      if (!wardShapesByLga.has(key)) wardShapesByLga.set(key, { tag, shapes: [] });
      wardShapesByLga.get(key).shapes.push({
        name: p[fields.ward],
        names: altNames(p, fields.wardAlt),
        lgaName: p[fields.lga],
        stateName: p[fields.state],
        geometry: simplifyGeometry(f.geometry, TOLERANCE.ward),
      });
      if (index > 0 && index % 1000 === 0) {
        process.stdout.write(`\rwards: ${index.toLocaleString()} read (${Math.round((Date.now() - started) / 1000)}s)`);
      }
    });
    process.stdout.write("\n");

    const byState = new Map();
    let wardMatched = 0;
    const wardUnmatched = [];
    for (const { tag, shapes } of wardShapesByLga.values()) {
      const lga = tag?.inecLga;
      const match = lga ? matchByName(shapes, lga.wards, { shared: true }) : new Map();
      shapes.forEach((shape, i) => {
        const ward = match.get(i);
        if (ward) wardMatched += 1;
        else wardUnmatched.push(`${shape.stateName} / ${shape.lgaName} / ${shape.name}`);
        if (!shape.geometry) return;
        const stateCode = tag?.state ?? "unknown";
        if (!byState.has(stateCode)) byState.set(stateCode, []);
        byState.get(stateCode).push({
          type: "Feature",
          geometry: shape.geometry,
          properties: { state: tag?.state ?? null, lga: tag?.lga ?? null, ward: ward?.code ?? null, name: ward?.name ?? shape.name },
        });
      });
    }
    let bytes = 0;
    for (const [stateCode, features] of byState) {
      if (stateCode === "unknown") continue;
      const text = featureCollection(features);
      bytes += Buffer.byteLength(text);
      writeFileSync(join(OUT, "wards", `${stateCode}.json`), text);
    }
    report.wards = { shapes: total, matched: wardMatched, unmatched: wardUnmatched, fields };
    console.log(
      `wards: ${wardMatched.toLocaleString()}/${total.toLocaleString()} matched, ${byState.size} state files, ${Math.round(bytes / 1048576)} MB in all`,
    );
  }

  writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log("done: public/boundaries (see report.json for unmatched names)");
  return report;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop());
if (isMain) {
  build().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
