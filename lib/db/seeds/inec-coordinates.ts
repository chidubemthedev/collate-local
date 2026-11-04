export interface SourcePollingUnitCoordinate {
  name: string;
  wardName: string;
  lgaName: string;
  stateName: string;
  latitude: string;
  longitude: string;
}

export type ParsedCoordinate =
  | { valid: true; latitude: number; longitude: number }
  | { valid: false; reason: "missing" | "invalid" | "outside_bounds" };

const REQUIRED_COLUMNS = [
  "name",
  "ward_name",
  "local_government_name",
  "state_name",
  "location.latitude",
  "location.longitude",
] as const;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const finishRow = () => {
    row.push(field);
    if (row.some((value) => value.length > 0)) rows.push(row);
    row = [];
    field = "";
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character !== '"') {
        field += character;
      } else if (text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = false;
      }
      continue;
    }

    if (character === '"') {
      if (field.length > 0) throw new Error(`Unexpected quote at CSV character ${index}.`);
      inQuotes = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      finishRow();
    } else {
      field += character;
    }
  }

  if (inQuotes) throw new Error("CSV ended inside a quoted field.");
  if (field.length > 0 || row.length > 0) finishRow();
  return rows;
}

export function parseCoordinateCsv(text: string): SourcePollingUnitCoordinate[] {
  const [headerRow, ...dataRows] = parseCsv(text);
  if (!headerRow) throw new Error("Coordinate CSV is empty.");

  const headers = headerRow.map((header) => header.replace(/^\uFEFF/, "").trim());
  const columnIndexes = REQUIRED_COLUMNS.map((column) => {
    const index = headers.indexOf(column);
    if (index === -1) throw new Error(`Coordinate CSV is missing the "${column}" column.`);
    return index;
  });

  return dataRows.map((row, rowIndex) => {
    if (row.length !== headers.length) {
      throw new Error(`Coordinate CSV row ${rowIndex + 2} has ${row.length} fields; expected ${headers.length}.`);
    }
    const [name, wardName, lgaName, stateName, latitude, longitude] = columnIndexes.map(
      (columnIndex) => row[columnIndex],
    );
    return { name, wardName, lgaName, stateName, latitude, longitude };
  });
}

export function normalizeLocationName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function makePollingUnitKey(parts: readonly string[]): string {
  return parts.map(normalizeLocationName).join("\u001f");
}

export function parseCoordinatePair(latitudeText: string, longitudeText: string): ParsedCoordinate {
  const latitudeValue = latitudeText.trim();
  const longitudeValue = longitudeText.trim();
  if (!latitudeValue && !longitudeValue) return { valid: false, reason: "missing" };
  if (!latitudeValue || !longitudeValue) return { valid: false, reason: "invalid" };

  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { valid: false, reason: "invalid" };
  }

  // This coarse envelope rejects obvious geocoding errors; it is not a country-boundary check.
  if (latitude < 2 || latitude > 15 || longitude < 2 || longitude > 16) {
    return { valid: false, reason: "outside_bounds" };
  }

  return { valid: true, latitude, longitude };
}
