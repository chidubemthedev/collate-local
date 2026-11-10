/**
 * Whether one membership gives national access (every polling unit, like an admin but without
 * admin rights). Shared by the API's access (lib/auth/view-as.ts) and the policy layer
 * (lib/policy/core/policy-user.ts, also used by the worker), so the two can never disagree.
 *
 * The group type must see national coverage AND the membership must have no area. An area on the
 * membership wins: a coordinator in a national-type group (e.g. NDC Lagos, a party group) with
 * Lagos set as their area sees Lagos only. Pure, with no imports, so the worker can load it.
 */
export function givesNationalAccess(
  seesCoverage: string | null | undefined,
  area: {
    stateId: number | null;
    lgaId: number | null;
    wardId: number | null;
    politicalUnitId: number | null;
  },
): boolean {
  return (
    seesCoverage === "national" &&
    area.stateId === null &&
    area.lgaId === null &&
    area.wardId === null &&
    area.politicalUnitId === null
  );
}
