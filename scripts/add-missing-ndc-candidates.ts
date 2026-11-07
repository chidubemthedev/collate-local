/**
 * Adds NDC candidates that are on INEC's lists but were missed when the candidate data was
 * extracted from INEC's PDFs (data/inec/candidates).
 *
 *   npx tsx scripts/add-missing-ndc-candidates.ts           # dry run: shows what would change
 *   npx tsx scripts/add-missing-ndc-candidates.ts --apply   # writes, in one transaction
 *
 * Safe to run more than once: a seat that already has a candidate is left alone.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import dataSource from "../lib/db/data-source";

type Office = "Governor" | "House of Reps" | "State Assembly";

interface Missing {
  state: string;
  office: Office;
  /** Seat name exactly as in political_unit (the state's name for Governor). */
  seat: string;
  name: string;
  deputy?: string;
  /** Where the name was read. */
  source: string;
}

const SHA = "INEC final list, State Houses of Assembly (31 Oct 2026)";
const REPS = "INEC updated list, House of Representatives (31 Oct 2026)";

const MISSING: Missing[] = [
  { state: "ADAMAWA", office: "State Assembly", seat: "GOMBI", name: "SANI AHMED", source: SHA },
  { state: "ADAMAWA", office: "State Assembly", seat: "NASSARAWO/BINYERI (MAYO BELWA I)", name: "ABUBAKAR IBRAHIM", source: SHA },
  { state: "ANAMBRA", office: "House of Reps", seat: "Awka North/Awka South", name: "OROGBU OBIAGELI LILIAN", source: REPS },
  { state: "BAYELSA", office: "House of Reps", seat: "Ogbia", name: "SOKARI MERCY DAN", source: REPS },
  { state: "BAYELSA", office: "State Assembly", seat: "NEMBE II", name: "BEN-WAKAMA EBIGONI", source: SHA },
  { state: "BENUE", office: "State Assembly", seat: "GBOKO I (EAST)", name: "UKE ISAIAH TERSOO", source: SHA },
  { state: "BENUE", office: "State Assembly", seat: "GWER WEST", name: "TARBO AONDOAVER EMMANUEL", source: SHA },
  { state: "BENUE", office: "State Assembly", seat: "NYAMATSOR (BURUKU)", name: "VEMBE VALENTINE VERSHIMA", source: SHA },
  { state: "BENUE", office: "State Assembly", seat: "OBI", name: "IJI GABRIEL OGBADA", source: SHA },
  {
    state: "DELTA",
    office: "House of Reps",
    seat: "Warri North/Warri South/Warri South West",
    name: "BEKENAWEI PEDRO TUWA YERIN",
    source: REPS,
  },
  { state: "DELTA", office: "State Assembly", seat: "SAPELE II", name: "OMORAKA DICKSON DADAKPOYE", source: SHA },
  { state: "DELTA", office: "State Assembly", seat: "UDU", name: "FENFE OGHENEOCHUKO GIBSON", source: SHA },
  { state: "DELTA", office: "State Assembly", seat: "WARRI NORTH", name: "OSABOHEN EKHATOR ONETORITSEBAWO", source: SHA },
  // On INEC's first final list (10 Oct 2026) but NOT on the updated list of 30 Oct 2026.
  // Delete this entry if the party has not confirmed he is still on the ballot.
  {
    state: "ABIA",
    office: "Governor",
    seat: "ABIA",
    name: "OGAH IROETUGO NDUBUISI",
    deputy: "ALARIBE BRIGHT MEDOZIE",
    source: "INEC final list, Abia governorship (10 Oct 2026); removed in the 30 Oct update",
  },
];

const UNIT_TYPE: Record<Office, string> = {
  Governor: "state",
  "House of Reps": "federal_constituency",
  "State Assembly": "state_constituency",
};

async function main() {
  const apply = process.argv.includes("--apply");
  await dataSource.initialize();
  let added = 0;
  try {
    await dataSource.transaction(async (manager) => {
      for (const row of MISSING) {
        const label = `${row.office}, ${row.seat} (${row.state})`;
        // Governor seats sit on the state's own unit; the others on a unit whose parent is the state.
        const [seat] = (await manager.query(
          `
            SELECT st.id, c.id AS candidate_id, p.full_name AS candidate_name
            FROM seat st
            JOIN office o ON o.id = st.office_id
            JOIN political_unit pun ON pun.id = st.political_unit_id
            LEFT JOIN political_unit parent ON parent.id = pun.parent_political_unit_id
            LEFT JOIN candidate c ON c.seat_id = st.id
            LEFT JOIN person p ON p.id = c.person_id
            WHERE o.office_name = $1
              AND pun.political_unit_type::text = $2
              AND UPPER(pun.political_unit_name) = UPPER($3)
              AND ($2 = 'state' OR UPPER(parent.political_unit_name) = UPPER($4))
            LIMIT 1;
          `,
          [row.office, UNIT_TYPE[row.office], row.seat, row.state],
        )) as Array<{ id: number; candidate_id: number | null; candidate_name: string | null }>;

        if (!seat) {
          console.log(`  ! no seat found: ${label}`);
          continue;
        }
        if (seat.candidate_id !== null) {
          console.log(`  - already has a candidate: ${label} -> ${seat.candidate_name}`);
          continue;
        }

        console.log(`  + ${label}: ${row.name}${row.deputy ? ` (deputy ${row.deputy})` : ""}  [${row.source}]`);
        added += 1;
        if (!apply) continue;

        const personId = randomUUID();
        await manager.query(`INSERT INTO person (id, full_name) VALUES ($1, $2);`, [personId, row.name]);
        const [candidate] = (await manager.query(
          `INSERT INTO candidate (person_id, seat_id) VALUES ($1, $2) RETURNING id;`,
          [personId, seat.id],
        )) as Array<{ id: number }>;

        if (row.deputy) {
          const deputyId = randomUUID();
          await manager.query(`INSERT INTO person (id, full_name) VALUES ($1, $2);`, [deputyId, row.deputy]);
          await manager.query(`INSERT INTO candidate (person_id, principal_candidate_id) VALUES ($1, $2);`, [
            deputyId,
            candidate.id,
          ]);
        }
      }
    });
  } finally {
    await dataSource.destroy();
  }

  console.log(
    apply
      ? `\nAdded ${added} candidate(s).`
      : `\nDry run: ${added} candidate(s) would be added. Run again with --apply to write them.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
