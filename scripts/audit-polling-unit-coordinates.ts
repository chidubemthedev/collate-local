import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import dataSource from "../lib/db/data-source";
import {
  GEOBOUNDARIES_ADM1_URL,
  GEOBOUNDARIES_ADM2_URL,
  buildBoundaries,
  checkCoordinate,
} from "../lib/db/seeds/inec-coordinate-validation";

interface StoredCoordinate {
  id: number;
  stateName: string;
  lgaName: string;
  wardName: string;
  pollingUnitName: string | null;
  latitude: number;
  longitude: number;
}

interface Offender extends StoredCoordinate {
  reason: "outside_state" | "far_from_lga";
  distanceKm: number;
}

const BATCH_SIZE = 2000;

async function download(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}.`);
  return response.text();
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const backupArg = args.find((arg) => arg.startsWith("--backup="));
  if (args.some((arg) => arg !== "--apply" && !arg.startsWith("--backup="))) {
    throw new Error("Use no arguments for a dry run, or --apply [--backup=<file.csv>] to clear invalid coordinates.");
  }

  const boundaries = buildBoundaries(await download(GEOBOUNDARIES_ADM1_URL), await download(GEOBOUNDARIES_ADM2_URL));
  await dataSource.initialize();
  try {
    const rows: StoredCoordinate[] = await dataSource.query(`
      SELECT pu.id, s.state_name AS "stateName", l.lga_name AS "lgaName", w.ward_name AS "wardName",
             pu.polling_unit_name AS "pollingUnitName", pu.latitude, pu.longitude
      FROM polling_unit pu
      JOIN ward w ON w.id = pu.ward_id
      JOIN lga l ON l.id = w.lga_id
      JOIN state s ON s.id = l.state_id
      WHERE pu.latitude IS NOT NULL AND pu.longitude IS NOT NULL;
    `);

    const offenders: Offender[] = [];
    for (const row of rows) {
      const check = checkCoordinate(boundaries, row, row.longitude, row.latitude);
      if (!check.ok) offenders.push({ ...row, reason: check.reason, distanceKm: check.distanceKm });
    }

    const byState = new Map<string, { outsideState: number; farFromLga: number }>();
    for (const offender of offenders) {
      const entry = byState.get(offender.stateName) ?? { outsideState: 0, farFromLga: 0 };
      if (offender.reason === "outside_state") entry.outsideState += 1;
      else entry.farFromLga += 1;
      byState.set(offender.stateName, entry);
    }

    console.log(`Stored coordinates checked: ${rows.length}`);
    console.log(`Outside their own state: ${offenders.filter((o) => o.reason === "outside_state").length}`);
    console.log(`Inside their state but far from their own LGA: ${offenders.filter((o) => o.reason === "far_from_lga").length}`);
    console.table(Object.fromEntries([...byState].sort((a, b) => a[0].localeCompare(b[0]))));

    if (!apply) {
      console.log("Dry run only; no database rows were changed. Pass --apply to clear these coordinates.");
      return;
    }
    if (offenders.length === 0) return;

    const backupPath = backupArg
      ? backupArg.slice("--backup=".length)
      : path.join(tmpdir(), `polling-unit-coordinates-backup-${Date.now()}.csv`);
    const header = "id,state,lga,ward,polling_unit,latitude,longitude,reason,distance_km";
    const lines = offenders.map((o) =>
      [o.id, o.stateName, o.lgaName, o.wardName, o.pollingUnitName, o.latitude, o.longitude, o.reason, o.distanceKm.toFixed(1)]
        .map(csvCell)
        .join(","),
    );
    writeFileSync(backupPath, `${header}\n${lines.join("\n")}\n`);
    console.log(`Backup written to ${backupPath}`);

    let cleared = 0;
    await dataSource.transaction(async (manager) => {
      for (let index = 0; index < offenders.length; index += BATCH_SIZE) {
        const batch = offenders.slice(index, index + BATCH_SIZE);
        const [result] = (await manager.query(
          `
            UPDATE polling_unit AS pu
            SET latitude = NULL, longitude = NULL
            FROM unnest($1::int[], $2::double precision[], $3::double precision[])
              AS input(id, latitude, longitude)
            WHERE pu.id = input.id AND pu.latitude = input.latitude AND pu.longitude = input.longitude
            RETURNING pu.id;
          `,
          [batch.map((o) => o.id), batch.map((o) => o.latitude), batch.map((o) => o.longitude)],
        )) as [Array<{ id: number }>, number];
        cleared += result.length;
      }
    });
    console.log(`Coordinates cleared: ${cleared}`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
