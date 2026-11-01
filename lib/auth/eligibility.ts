import "server-only";
import { getDataSource } from "@/lib/db";
import { normalizeEmailAddress } from "./config";

export type EligiblePerson = {
  id: string;
  fullName: string;
  emailAddress: string | null;
};

export async function findEligiblePersonByEmail(email: string): Promise<EligiblePerson | null> {
  const normalizedEmail = normalizeEmailAddress(email);
  const dataSource = await getDataSource();

  const rows = (await dataSource.query(
    `
      SELECT p.id, p.full_name, p.email_address
      FROM person p
      WHERE LOWER(p.email_address) = $1
        AND (
          EXISTS (SELECT 1 FROM membership m WHERE m.person_id = p.id)
          OR EXISTS (SELECT 1 FROM candidate c WHERE c.person_id = p.id)
        )
      LIMIT 1;
    `,
    [normalizedEmail],
  )) as unknown as Array<{ id: string; full_name: string; email_address: string | null }>;

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    fullName: row.full_name,
    emailAddress: row.email_address,
  };
}
