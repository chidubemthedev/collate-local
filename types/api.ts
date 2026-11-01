/**
 * Collate API Type Definitions
 * Derived from OpenAPI 3.1.0 specification at /api/openapi
 */

// ==========================================
// Response Envelopes
// ==========================================

export interface SuccessEnvelope<T> {
  status: "success";
  data: T;
  meta?: {
    nextCursor?: string | null;
    limit?: number;
  };
}

export interface ErrorDetail {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export interface ErrorEnvelope {
  status: "error";
  error: ErrorDetail;
}

export type ApiResponse<T> = SuccessEnvelope<T> | ErrorEnvelope;

// ==========================================
// Auth
// ==========================================

export interface SessionPerson {
  id: string;
  fullName: string;
  emailAddress: string | null;
  isAdmin: boolean;
  candidateId: number | null;
}

export interface SessionData {
  authenticated: boolean;
  person?: SessionPerson;
}

export interface PermissionsData {
  authenticated: boolean;
  permissions: {
    isAdmin: boolean;
    canManageCoverage: boolean;
    canBroadcast: boolean;
    roles: string[];
  };
}

export interface OtpRequestPayload {
  email: string;
}

export interface OtpVerifyPayload {
  email: string;
  code: string;
}

export interface OtpVerifyResponse {
  ok: boolean;
  person: {
    id: string;
    fullName: string;
    emailAddress: string | null;
  };
}

// ==========================================
// Geography
// ==========================================

export interface StateCoverage {
  id: number;
  code: string;
  name: string;
  totalPUs: number;
  gpsPUs: number;
  coveredPUs: number;
  noCoveragePUs: number;
  officialAgentPct: number;
  extraAgentsCount: number;
  lgasCount?: number;
  wardsCount?: number;
}

export interface LgaCoverage {
  id: number;
  stateCode: string;
  code: string;
  name: string;
  totalPUs: number;
  gpsPUs: number;
  coveredPUs: number;
  noCoveragePUs: number;
  officialAgentPct: number;
  extraAgentsCount: number;
  wardsCount: number;
}

export interface WardCoverage {
  id: number;
  code: string;
  name: string;
  totalPUs: number;
  gpsPUs: number;
  coveredPUs: number;
  noCoveragePUs: number;
  officialAgentPct: number;
  extraAgentsCount: number;
}

export interface ExtraAgent {
  id: string;
  assignmentId?: string;
  name: string;
  owner: string;
  role: string;
  phone?: string | null;
  telegramStatus?: string;
}

export interface PollingUnit {
  id: number;
  code: string;
  name: string;
  wardCode: string;
  lgaCode: string;
  stateCode: string;
  latitude: number | null;
  longitude: number | null;
  hasGPS: boolean;
  hasOfficialAgent: boolean;
  officialAssignmentId?: string;
  officialAgentName?: string;
  officialAgentPhone?: string;
  officialAgentTelegramStatus?: string;
  locationDescription?: string;
  extraAgents: ExtraAgent[];
}

// ==========================================
// Coverage
// ==========================================

export interface CoverageSummary {
  totalPUs: number;
  coveredPUs: number;
  noCoveragePUs: number;
  gpsPUs: number;
  extraAgentsCount: number;
  officialAgentPct: number;
}

export interface AreaRef {
  code: string;
  name: string;
}

export interface CoverageGap {
  id: number;
  code: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  hasGPS: boolean;
  ward: AreaRef;
  lga: AreaRef;
  state: AreaRef;
}

export interface CoverageGapsResponse {
  totalCount: number;
  limit: number;
  offset: number;
  items: CoverageGap[];
}

export interface CreateAssignmentPayload {
  personId: string;
  pollingUnitId: number;
  ownerGroupId?: number | null;
  ownerCandidateId?: number | null;
  agentKind: "official" | "extra";
  slotNumber: number;
  role?: "official" | "extra";
}

export interface CreateAssignmentResponse {
  ok: boolean;
  id: string;
}

// ==========================================
// Agents
// ==========================================

export interface AgentPollingUnit {
  id: number;
  inecPollingUnitCode: string;
  name: string | null;
  wardName: string;
  lgaName: string;
  stateName: string;
}

export interface AgentOwner {
  type: "group" | "candidate";
  id: number;
  displayName: string;
}

export interface AgentListItem {
  assignmentId: string;
  agentKind: "official" | "extra";
  slotNumber: number;
  personId: string;
  fullName: string;
  maskedPhone: string | null;
  pollingUnit: AgentPollingUnit;
  owner: AgentOwner;
}

export interface AgentsQueryFilters {
  stateId?: number;
  lgaId?: number;
  wardId?: number;
  politicalUnitId?: number;
  ownerGroupId?: number;
  ownerCandidateId?: number;
  agentKind?: "official" | "extra";
  cursor?: string;
  limit?: number;
}
