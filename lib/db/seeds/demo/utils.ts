import { createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { en, en_NG, Faker } from "@faker-js/faker";

export type DemoStateMeta = {
  stateCode: string;
  stateName: string;
  lgaNames: string[];
  boundingBox: { latMin: number; latMax: number; lonMin: number; lonMax: number };
};

export const DEMO_DOMAIN = "@demo.collate.test";
export const DEMO_STATE_CODES = ["90", "91", "92"] as const;

export const demoFaker = new Faker({ locale: en_NG ?? en });
demoFaker.seed(20261101);

export function assertDemoSeedAllowed(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo seed cannot run in production.");
  }

  if (process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Demo seed requires ALLOW_DEMO_SEED=true.");
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set before running the demo seed.");
  }
}

export function demoEmail(localPart: string): string {
  return `${localPart.toLowerCase()}${DEMO_DOMAIN}`;
}

export function demoPhone(index: number): string {
  return `+234000000${String(index).padStart(4, "0")}`;
}

export function demoIp(index: number): string {
  return `203.0.113.${index % 256}`;
}

export function demoToken(): string {
  return randomBytes(24).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 35);
}

export function makeDemoName(prefix?: string): string {
  const base = prefix ? `${prefix} ${demoFaker.person.firstName()}` : demoFaker.person.fullName();
  return base.replace(/\s+/g, " ").trim();
}

export async function writeDemoTokenFile(entries: Array<{ candidatePersonId: string; token: string }>): Promise<void> {
  await fs.writeFile(".demo-seed-output.json", `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

export function getDemoStates(): DemoStateMeta[] {
  return [
    {
      stateCode: "90",
      stateName: "Lagos",
      lgaNames: ["Alimosho", "Ikeja", "Kosofe", "Eti-Osa", "Surulere", "Badagry"],
      boundingBox: { latMin: 6.35, latMax: 6.7, lonMin: 3.1, lonMax: 4.15 },
    },
    {
      stateCode: "91",
      stateName: "Anambra",
      lgaNames: ["Awka South", "Onitsha North", "Nnewi North", "Ogbaru", "Ekwusigo", "Njikoka"],
      boundingBox: { latMin: 5.7, latMax: 6.6, lonMin: 6.7, lonMax: 7.5 },
    },
    {
      stateCode: "92",
      stateName: "Kano",
      lgaNames: ["Kano Municipal", "Nasarawa", "Dala", "Gwale", "Kumbotso", "Tarauni"],
      boundingBox: { latMin: 11.8, latMax: 12.25, lonMin: 8.3, lonMax: 9.1 },
    },
  ];
}

export function getDefaultDemoStateCodeIndex(): number {
  return 0;
}
