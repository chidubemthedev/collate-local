import { Persona, RoleType } from "@/lib/types";

export const PERSONAS: Persona[] = [
  {
    id: "persona-party-national",
    name: "Party Leadership",
    role: "Party · National",
    label: "Party · National",
    description: "National presidential campaign & party leadership (sees nationwide coverage, can filter by LGA)",
    canFilterByLGA: true,
  },
  {
    id: "persona-admin",
    name: "TechCircle (Danladi / Jullian / Oo)",
    role: "Admin",
    label: "Admin · Root",
    description: "System administration, list imports, group permissions",
    canFilterByLGA: true,
  },
  {
    id: "persona-cand-pres",
    name: "Obi Peter Gregory",
    role: "Candidate · President",
    office: "President",
    seat: "Nigeria",
    label: "Candidate · President (Nigeria)",
    description: "Presidential ticket (sees all Nigeria, no LGA filter)",
    canFilterByLGA: false,
  },
  {
    id: "persona-cand-gov-lagos",
    name: "Doherty Olufunso Adeshina",
    role: "Candidate · Governor",
    office: "Governor",
    seat: "Lagos",
    stateCode: "24",
    label: "Candidate · Governor (Lagos)",
    description: "Governorship candidate for Lagos State",
    canFilterByLGA: false,
    allowedStateCodes: ["24"],
  },
  {
    id: "persona-cand-gov-adamawa",
    name: "Dahiru Aishatu Ahmed",
    role: "Candidate · Governor",
    office: "Governor",
    seat: "Adamawa",
    stateCode: "02",
    label: "Candidate · Governor (Adamawa)",
    description: "Governorship candidate for Adamawa State",
    canFilterByLGA: false,
    allowedStateCodes: ["02"],
  },
  {
    id: "persona-cand-sen-anambra-north",
    name: "Nwoye Tony Okechukwu",
    role: "Candidate · Senate",
    office: "Senate",
    seat: "Anambra North",
    stateCode: "04",
    label: "Candidate · Senate (Anambra North)",
    description: "Senatorial candidate for Anambra North",
    canFilterByLGA: false,
    allowedStateCodes: ["04"],
    allowedLgaCodes: ["04-17", "04-18", "04-02", "04-03", "04-16", "04-19", "04-20"],
  },
  {
    id: "persona-cand-rep-onitsha",
    name: "Emeka Idu Godwin Obiajulu",
    role: "Candidate · House of Reps",
    office: "House of Reps",
    seat: "Onitsha North/Onitsha South",
    stateCode: "04",
    lgaCode: "04-17",
    label: "Candidate · House of Reps (Onitsha North/South)",
    description: "Federal constituency candidate (locked to constituency, no LGA filter, seats below)",
    canFilterByLGA: false,
    allowedStateCodes: ["04"],
    allowedLgaCodes: ["04-17", "04-18"],
  },
  {
    id: "persona-cand-ass-onitsha-1",
    name: "Ezeazu Kenneth Nnaemeka",
    role: "Candidate · State Assembly",
    office: "State Assembly",
    seat: "Onitsha North I",
    stateCode: "04",
    lgaCode: "04-17",
    label: "Candidate · State Assembly (Onitsha North I)",
    description: "State Assembly candidate for Onitsha North I",
    canFilterByLGA: false,
    allowedStateCodes: ["04"],
    allowedLgaCodes: ["04-17"],
    allowedWardCodes: ["04-17-01", "04-17-02", "04-17-03", "04-17-04", "04-17-05", "04-17-06", "04-17-07"],
  },
];

export function getEffectivePersona(personaId?: string): Persona {
  return PERSONAS.find((p) => p.id === personaId) || PERSONAS[0];
}

export function isAllowedInSubtree(
  persona: Persona,
  item: { stateCode?: string; lgaCode?: string; wardCode?: string }
): boolean {
  if (persona.role === "Party · National" || persona.role === "Admin" || persona.office === "President") {
    return true;
  }
  if (persona.allowedStateCodes && item.stateCode && !persona.allowedStateCodes.includes(item.stateCode)) {
    return false;
  }
  if (persona.allowedLgaCodes && item.lgaCode && !persona.allowedLgaCodes.includes(item.lgaCode)) {
    return false;
  }
  if (persona.allowedWardCodes && item.wardCode && !persona.allowedWardCodes.includes(item.wardCode)) {
    return false;
  }
  return true;
}
