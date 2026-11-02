import { describe, expect, it, vi } from "vitest";
import type { EntityManager } from "typeorm";
import { Consent } from "../../../db/entities/consent.entity";
import { hasDeclinedConsent } from "./link";

function makeManager(consent: Pick<Consent, "isAccepted"> | null) {
  const ordering: Array<[string, string]> = [];
  type ConsentQueryBuilder = {
    where: (condition: string, parameters?: Record<string, unknown>) => ConsentQueryBuilder;
    orderBy: (column: string, direction: string) => ConsentQueryBuilder;
    addOrderBy: (column: string, direction: string) => ConsentQueryBuilder;
    getOne: () => Promise<Pick<Consent, "isAccepted"> | null>;
  };
  const queryBuilder: ConsentQueryBuilder = {
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn((column: string, direction: string) => {
      ordering.push([column, direction]);
      return queryBuilder;
    }),
    addOrderBy: vi.fn((column: string, direction: string) => {
      ordering.push([column, direction]);
      return queryBuilder;
    }),
    getOne: vi.fn(async () => consent),
  };
  const manager = {
    getRepository: (entity: typeof Consent) => {
      if (entity !== Consent) {
        throw new Error("unexpected repository");
      }
      return { createQueryBuilder: () => queryBuilder };
    },
  };

  return {
    manager: manager as unknown as EntityManager,
    ordering,
  };
}

describe("hasDeclinedConsent", () => {
  it("uses the newest consent and detects a decline", async () => {
    const { manager, ordering } = makeManager({ isAccepted: false });

    await expect(hasDeclinedConsent("person-id", manager)).resolves.toBe(true);
    expect(ordering).toEqual([
      ["consent.createdAt", "DESC"],
      ["consent.id", "DESC"],
    ]);
  });

  it("returns false when consent is accepted or no row exists", async () => {
    const accepted = makeManager({ isAccepted: true });
    const missing = makeManager(null);

    await expect(hasDeclinedConsent("person-id", accepted.manager)).resolves.toBe(false);
    await expect(hasDeclinedConsent("person-id", missing.manager)).resolves.toBe(false);
  });
});
