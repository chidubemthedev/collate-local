export type OfficeType =
  | "President"
  | "Governor"
  | "Senate"
  | "House of Reps"
  | "State Assembly";

export type RoleType =
  | "Party · National"
  | "Admin"
  | "Candidate · President"
  | "Candidate · Governor"
  | "Candidate · Senate"
  | "Candidate · House of Reps"
  | "Candidate · State Assembly"
  | "PU Agent";

export interface Persona {
  id: string;
  name: string;
  role: RoleType;
  office?: OfficeType;
  seat?: string;
  stateCode?: string;
  lgaCode?: string;
  constituencyCode?: string;
  label: string;
  description: string;
  canFilterByLGA: boolean;
  allowedStateCodes?: string[];
  allowedLgaCodes?: string[];
  allowedWardCodes?: string[];
}

export interface StateData {
  code: string;
  name: string;
  totalPUs: number;
  gpsPUs: number;
  coveredPUs: number;
  noCoveragePUs: number;
  officialAgentPct: number;
  extraAgentsCount: number;
  lgasCount: number;
  wardsCount: number;
  status: "Open" | "Complete" | "Critical";
}

export interface LGAData {
  code: string;
  stateCode: string;
  name: string;
  totalPUs: number;
  gpsPUs: number;
  coveredPUs: number;
  noCoveragePUs: number;
  officialAgentPct: number;
  extraAgentsCount: number;
  wardsCount: number;
  federalConstituency?: string;
  senatorialDistrict?: string;
}

export interface WardData {
  code: string;
  lgaCode: string;
  stateCode: string;
  name: string;
  totalPUs: number;
  gpsPUs: number;
  coveredPUs: number;
  noCoveragePUs: number;
  officialAgentPct: number;
  extraAgentsCount: number;
  stateConstituency?: string;
  federalConstituency?: string;
  senatorialDistrict?: string;
}

export interface PollingUnitData {
  id?: number;
  code: string;
  wardCode: string;
  lgaCode: string;
  stateCode: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  hasGPS: boolean;
  hasOfficialAgent: boolean;
  officialAssignmentId?: string;
  officialAgentName?: string;
  officialAgentPhone?: string;
  officialAgentTelegramStatus?: "connected" | "sms_only" | "not_matched";
  extraAgents: Array<{
    id: string;
    assignmentId?: string;
    owner: string; // e.g. "Party", "Senate · Nwoye Tony Okechukwu", "House of Reps · Emeka Idu Godwin Obiajulu"
    name: string;
    phone?: string;
    telegramStatus?: "connected" | "sms_only" | "not_matched";
    role?: string;
  }>;
}

export interface CandidateData {
  id: number;
  office: string;
  seat: string;
  stateCode: string | null;
  name: string;
  deputyName: string | null;
  isOffCycle: boolean;
  totalPUs: number;
  coveredPUs: number;
  coveragePct: number;
  extraAgentsCount: number;
  phoneMasked: string | null;
  telegramStatus: "connected" | "sms_only" | "not_matched";
}

export interface BroadcastData {
  id: string;
  title: string;
  targetArea: string;
  stateCode?: string;
  lgaCode?: string;
  wardCode?: string;
  senderRole: string;
  sentAt: string;
  timestamp: string;
  candidatesCount: number;
  agentsCount: number;
  status: "Sent" | "Scheduled" | "Draft" | "Failed";
  channel: string;
  sent: number;
  delivered: number;
  deliveredPct: number;
  deliveredBySms?: number;
  tappedOk: number;
  tappedOkPct: number;
  pending: number;
  failed: number;
  messageContent?: string;
  recipientsList?: BroadcastRecipientLog[];
}

export interface BroadcastRecipientLog {
  id: string;
  name: string;
  group: string;
  area: string;
  time: string;
  status: "Tapped OK" | "Delivered" | "Delivered by SMS" | "Pending" | "Failed";
  source: string;
  phoneMasked?: string;
}

export interface AccessGroup {
  id: string;
  name: string;
  description?: string;
  membersDescription?: string;
  membersCount?: number;
  canMessage: string;
  canFilterBy: string;
  seesCoverageFor: string;
  logsIn: string;
  isSystem?: boolean;
  createdAt?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  ipAddress: string;
  status: "Success" | "Warning" | "Blocked";
}

export interface CandidateAccessLink {
  id: string;
  candidateName: string;
  office: string;
  seat: string;
  accessUrl: string;
  expiresAt: string;
  lastAccessed: string;
  status: "Active" | "Revoked" | "Expired";
}
