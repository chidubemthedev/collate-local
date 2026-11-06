import { describe, expect, it } from "vitest";
import { canonName, matchByName, normName, similarity, simplifyRing } from "./build-boundaries.mjs";

type Unit = { code: string; name: string };

describe("boundary name matching", () => {
  it("ignores case, spaces and punctuation", () => {
    expect(normName("AJEROMI/IFELODUN")).toBe(normName("Ajeromi-Ifelodun"));
    expect(normName("Maiduguri M. C.")).toBe("maidugurimc");
  });

  it("scores containment and near spellings highly", () => {
    expect(similarity("maidugurimc", "maiduguri")).toBeGreaterThanOrEqual(0.85);
    expect(similarity("somolu", "shomolu")).toBeGreaterThan(0.8);
    expect(similarity("kano", "lagos")).toBeLessThan(0.6);
  });

  it("matches exact names, then close spellings, each unit once", () => {
    const units: Unit[] = [
      { code: "01", name: "ABA NORTH" },
      { code: "02", name: "SOMOLU" },
      { code: "03", name: "MAIDUGURI M. C." },
    ];
    const shapes = [{ name: "Maiduguri" }, { name: "Aba North" }, { name: "Shomolu" }];
    const match: Map<number, Unit> = matchByName(shapes, units);
    expect(match.get(0)?.code).toBe("03");
    expect(match.get(1)?.code).toBe("01");
    expect(match.get(2)?.code).toBe("02");
  });

  it("pairs the last shape with the last name when one of each is left (renamed LGAs)", () => {
    const units: Unit[] = [
      { code: "01", name: "ADO EKITI" },
      { code: "02", name: "AIYEKIRE" },
    ];
    const match: Map<number, Unit> = matchByName([{ name: "Ado Ekiti" }, { name: "Gbonyin" }], units);
    expect(match.get(1)?.code).toBe("02");
  });

  it("leaves unrelated names unmatched when several are left", () => {
    const units: Unit[] = [
      { code: "01", name: "KANO" },
      { code: "02", name: "ZARIA" },
    ];
    const match: Map<number, Unit> = matchByName([{ name: "Lokoja" }, { name: "Calabar" }], units);
    expect(match.size).toBe(0);
  });
});

describe("simplifyRing", () => {
  it("drops points on a straight edge and keeps the ring closed", () => {
    const ring = [
      [0, 0],
      [0.5, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ];
    const out: number[][] = simplifyRing(ring, 0.01);
    expect(out).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ]);
  });

  it("keeps a small ring rather than collapsing it", () => {
    const ring = [
      [0, 0],
      [0.001, 0],
      [0.001, 0.001],
      [0, 0.001],
      [0, 0],
    ];
    expect(simplifyRing(ring, 1)).toHaveLength(5);
  });
});

describe("ward matching", () => {
  it("reads numbering written as I, A, 1 or One the same way", () => {
    expect(canonName("Item III")).toBe(canonName("ITEM C"));
    expect(canonName("Brass 2")).toBe(canonName("BRASS WARD II"));
    expect(canonName("Ward One (1)")).toBe("1");
    expect(canonName("B-Dere")).toBe("bdere");
  });

  it("matches on a GRID3 alternative name", () => {
    const units: Unit[] = [{ code: "03", name: "UMUHU / EZECHI" }];
    const match: Map<number, Unit> = matchByName([{ name: "Ozu Abam", names: ["Umuhu/Ezechi"] }], units, { shared: true });
    expect(match.get(0)?.code).toBe("03");
  });

  it("gives numbered wards the INEC ward with that number", () => {
    const units: Unit[] = [
      { code: "01", name: "BODO I" },
      { code: "02", name: "BODO II" },
    ];
    const match: Map<number, Unit> = matchByName([{ name: "GoWard 2" }, { name: "GoWard 1" }], units, { shared: true });
    expect(match.get(0)?.code).toBe("02");
    expect(match.get(1)?.code).toBe("01");
  });

  it("lets several GRID3 wards share the INEC ward that names them", () => {
    const units: Unit[] = [
      { code: "05", name: "IGANDO/EGAN" },
      { code: "04", name: "IKOTUN/IJEGUN" },
    ];
    const match: Map<number, Unit> = matchByName(
      [{ name: "Ikotun/Ijegun" }, { name: "Igando" }, { name: "Egan" }],
      units,
      { shared: true },
    );
    expect(match.get(0)?.code).toBe("04");
    expect(match.get(1)?.code).toBe("05");
    expect(match.get(2)?.code).toBe("05");
  });

  it("does not share when the name fits more than one ward", () => {
    const units: Unit[] = [
      { code: "01", name: "AKOWONJO/SHASHA" },
      { code: "02", name: "AKOWONJO/EGBEDA" },
    ];
    const match: Map<number, Unit> = matchByName(
      [{ name: "Akowonjo/Shasha" }, { name: "Akowonjo/Egbeda" }, { name: "Akowonjo" }],
      units,
      { shared: true },
    );
    expect(match.has(2)).toBe(false);
  });
});
