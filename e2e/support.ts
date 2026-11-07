import "dotenv/config";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { test as base, type BrowserContext, type Page } from "@playwright/test";
import { Client } from "pg";

/**
 * Helpers for the browser tests. They talk to the test database directly so a test can start
 * signed in (a real session row + cookie) without going through email.
 */

export type Persona = "p01" | "p03" | "p04" | "p05" | "p08" | "p09" | "p12" | "p16";

export function personaEmail(persona: Persona): string {
  return `${persona}@fixture.collate.test`;
}

async function withDb<T>(run: (db: Client) => Promise<T>): Promise<T> {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    return await run(db);
  } finally {
    await db.end();
  }
}

async function personId(db: Client, persona: Persona): Promise<string> {
  const result = await db.query<{ id: string }>(`SELECT id FROM person WHERE email_address = $1;`, [
    personaEmail(persona),
  ]);
  const id = result.rows[0]?.id;
  if (!id) throw new Error(`Persona ${persona} is not in the test database. Run npm run db:seed:test.`);
  return id;
}

/** Signs the browser context in as a persona (session row + cookie). */
export async function signIn(context: BrowserContext, baseURL: string, persona: Persona): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await withDb(async (db) => {
    await db.query(
      `INSERT INTO auth_session (person_id, session_token_hash, expires_at, last_active_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 day', NOW());`,
      [await personId(db, persona), createHash("sha256").update(token).digest("hex")],
    );
  });
  // A production server (`next start`) names the cookie with the __Host- prefix, which must be
  // Secure, host-only and on "/". Browsers treat http://localhost as secure, so this works locally.
  const production = process.env.E2E_PRODUCTION === "true";
  const url = new URL(baseURL);
  await context.addCookies([
    production
      ? { name: "__Host-collate_session", value: token, domain: url.hostname, path: "/", secure: true, sameSite: "Lax" }
      : { name: "collate_session", value: token, url: baseURL },
  ]);
}

/**
 * Makes `code` the persona's newest one-time code, so the login form accepts it. Uses the same
 * HMAC as lib/auth/otp.ts with the test AUTH_SECRET; nothing is read from email.
 */
export async function plantOtp(persona: Persona, code: string): Promise<void> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET must be set for the browser tests.");
  await withDb(async (db) => {
    const id = await personId(db, persona);
    await db.query(
      `INSERT INTO login_otp (person_id, code_hash, expires_at, failed_attempt_count)
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes', 0);`,
      [id, createHmac("sha256", secret).update(`${id}:${code}`).digest("hex")],
    );
  });
}

/** Turns on "View as" for a candidate's seat (by candidate email) through the real API. */
export async function viewAsCandidate(page: Page, baseURL: string, candidate: Persona): Promise<void> {
  const seatId = await withDb(async (db) => {
    const result = await db.query<{ seat_id: number }>(
      `SELECT c.seat_id FROM candidate c JOIN person p ON p.id = c.person_id WHERE p.email_address = $1;`,
      [personaEmail(candidate)],
    );
    return result.rows[0]?.seat_id;
  });
  const response = await page.request.put(`${baseURL}/api/auth/view-as`, {
    data: { value: `seat:${seatId}` },
    headers: { origin: baseURL },
  });
  if (!response.ok()) throw new Error(`View as failed: ${response.status()} ${await response.text()}`);
}

export const test = base.extend<{ as: (persona: Persona) => Promise<void> }>({
  // Named `provide` (Playwright calls it `use`) so the React hooks lint rule leaves it alone.
  as: async ({ context, baseURL }, provide) => {
    await provide((persona) => signIn(context, baseURL as string, persona));
  },
});

export { expect } from "@playwright/test";
