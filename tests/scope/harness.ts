import { randomBytes } from "node:crypto";
import { hashSessionToken } from "@/lib/auth/session";
import { getDataSource } from "@/lib/db";
import type { PersonaKey, TestFixture } from "@/lib/db/seeds/test/fixture";

/** The session cookie the mocked `next/headers` hands to route handlers. */
export const session: { token: string | null } = { token: null };

export const ORIGIN = "http://localhost:3000";

let fixture: TestFixture | undefined;

export function setFixture(value: TestFixture): void {
  fixture = value;
}

export function fx(): TestFixture {
  if (!fixture) throw new Error("Fixture not loaded");
  return fixture;
}

/** Creates a real session row for a persona and makes it the current cookie. */
export async function loginAs(persona: PersonaKey): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const dataSource = await getDataSource();
  await dataSource.query(
    `INSERT INTO auth_session (person_id, session_token_hash, expires_at, last_active_at)
     VALUES ($1, $2, NOW() + INTERVAL '1 day', NOW());`,
    [fx().personIds[persona], hashSessionToken(token)],
  );
  session.token = token;
}

export function logout(): void {
  session.token = null;
}

type Handler = (request: never) => Promise<Response>;

function buildRequest(path: string, init?: RequestInit): Request {
  const url = new URL(path, ORIGIN);
  return Object.assign(new Request(url, init), { nextUrl: url });
}

export interface ApiResult<T> {
  status: number;
  body: { status: string; data: T; meta?: Record<string, unknown>; error?: { code: string } };
  raw: string;
}

async function read<T>(response: Response): Promise<ApiResult<T>> {
  const raw = await response.text();
  return { status: response.status, body: JSON.parse(raw), raw };
}

export async function get<T>(handler: Handler, path: string): Promise<ApiResult<T>> {
  return read<T>(await handler(buildRequest(path) as never));
}

export async function send<T>(
  handler: Handler,
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown,
): Promise<ApiResult<T>> {
  const request = buildRequest(path, {
    method,
    headers: { origin: ORIGIN, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return read<T>(await handler(request as never));
}
