/**
 * Collate API Type Definitions
 * Derived from OpenAPI 3.1.0 specification at /api/openapi
 */

// ==========================================
// Response Envelopes
// ==========================================

export interface CandidateOfficeOption {
  id: number;
  name: string;
  hierarchyLevel: number;
  count: number;
}

export interface SuccessEnvelope<T> {
  status: "success";
  data: T;
  meta?: {
    nextCursor?: string | null;
    limit?: number;
    total?: number;
    offices?: CandidateOfficeOption[];
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
    /** The person's own access, whatever view is on. */
    ownAccess: string;
    /** The access being previewed with "View as", or null. */
    viewAs: string | null;
    /** True while a view is on: nothing can be changed. */
    readOnly: boolean;
    /** INEC codes of the state / LGA / ward the current access lies in; null = national. */
    homeArea: { stateCode: string | null; lgaCode: string | null; wardCode: string | null } | null;
  };
}

export interface ViewAsOption {
  /** "party", "admin", "self" or "seat:<id>". */
  value: string;
  label: string;
}

export interface ViewAsOptionsData {
  /** The value of the view that is on (or of the person's own access). */
  current: string;
  /** The person's own access. */
  self: ViewAsOption;
  /** Single entries first (heading null), then one group per seat level. */
  groups: Array<{ heading: string | null; options: ViewAsOption[] }>;
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
  stateId: number;
  inecStateCode: string;
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

export interface PollingUnitAgent {
  assignmentId: string;
  agentKind: "official" | "extra";
  slotNumber: number;
  fullName: string;
  maskedPhone: string | null;
  owner: AgentOwner;
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
  agents: PollingUnitAgent[];
  locationDescription?: string;
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

export interface CoverageMapPoint {
  latitude: number;
  longitude: number;
  totalPUs: number;
  coveredPUs: number;
}

export interface CoverageMapPointsResponse {
  points: CoverageMapPoint[];
}

export interface CandidateCoverage {
  id: number;
  office: string;
  hierarchyLevel: number;
  seat: string;
  seatId: number;
  stateId: number | null;
  inecStateCode: string | null;
  name: string;
  deputyName: string | null;
  maskedPhone: string | null;
  channelStatus: "connected" | "sms_only" | "not_matched";
  isOffCycle: boolean;
  totalPUs: number;
  coveredPUs: number;
  coveragePct: number;
  extraAgentsCount: number;
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

interface CreateAssignmentBase {
  personId: string;
  pollingUnitId: number;
  agentKind: "official" | "extra";
  slotNumber: number;
  role?: "official" | "extra";
}

export type CreateAssignmentPayload = CreateAssignmentBase & (
  | { ownerGroupId: number; ownerCandidateId?: null }
  | { ownerGroupId?: null; ownerCandidateId: number }
);

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
  telegramConnected: boolean;
  pollingUnit: AgentPollingUnit;
  owner: AgentOwner;
}

export interface AgentSummary {
  total: number;
  official: number;
  extra: number;
  telegramConnected: number;
  /** smsOnly + notMatched. */
  notConnected: number;
  /** Not on Telegram, but has a confirmed number: reached by SMS. */
  smsOnly: number;
  /** No confirmed number: gets no messages. */
  notMatched: number;
}

export interface AgentsSummaryFilters {
  stateId?: number;
  lgaId?: number;
  wardId?: number;
  politicalUnitId?: number;
  ownerGroupId?: number;
  ownerCandidateId?: number;
  q?: string;
}

export interface AgentsQueryFilters {
  stateId?: number;
  lgaId?: number;
  wardId?: number;
  politicalUnitId?: number;
  ownerGroupId?: number;
  ownerCandidateId?: number;
  agentKind?: "official" | "extra";
  channel?: "telegram" | "not_connected" | "sms_only" | "not_matched";
  q?: string;
  cursor?: string;
  limit?: number;
}

// ==========================================
// Broadcasts
// ==========================================

export interface AudienceFilter {
  stateId?: number;
  lgaId?: number;
  wardId?: number;
  pollingUnitId?: number;
  politicalUnitId?: number;
  officeId?: number;
  ownerGroupId?: number;
  agentKind?: "official" | "extra" | "all";
}

export interface AudiencePreview {
  officialCount: number;
  extraCount: number;
}

export type BroadcastStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "completed"
  | "failed"
  | "cancelled";

export interface BroadcastDeliveryCounts {
  pending: number;
  sent: number;
  delivered: number;
  deliveredBySms: number;
  failed: number;
  tappedOk: number;
}

export interface BroadcastSender {
  id: string;
  displayName: string;
}

export interface BroadcastListItem {
  id: string;
  status: BroadcastStatus;
  title: string;
  messageText: string;
  sender: BroadcastSender;
  audienceSummary: string[];
  deliveryCounts: BroadcastDeliveryCounts;
  scheduledSendAt: string | null;
  createdAt: string;
}

export interface BroadcastDetail extends BroadcastListItem {
  messageText: string;
}

/** Who a delivery's recipient is, worked out from their current candidate seat or agent assignment. */
export interface BroadcastDeliveryRecipient {
  kind: "candidate" | "official_agent" | "extra_agent" | null;
  officeName: string | null;
  ownerName: string | null;
  isRunningMate: boolean;
  seatName: string | null;
  stateCode: string | null;
  pollingUnitCode: string | null;
  pollingUnitName: string | null;
  source: string | null;
}

export interface BroadcastDelivery {
  id: string;
  personId: string;
  fullName: string;
  maskedPhone: string | null;
  channel: "telegram" | "sms";
  status: "pending" | "sent" | "delivered" | "delivered_by_sms" | "failed" | "tapped_ok";
  sentAt: string | null;
  deliveredAt: string | null;
  tappedOkAt: string | null;
  failedAt: string | null;
  createdAt: string;
  recipient: BroadcastDeliveryRecipient;
}

export interface CreateBroadcastInput {
  audienceFilter: AudienceFilter;
  messageText: string;
  scheduledSendAt?: string;
}

export interface CreatedBroadcast {
  id: string;
  status: BroadcastStatus;
}

export interface BroadcastsQueryParams {
  limit?: number;
  cursor?: string;
}

export interface BroadcastsPageResponse {
  items: BroadcastListItem[];
  nextCursor: string | null;
}

export type DeliveryListItem = BroadcastDelivery;

export interface DeliveriesQueryParams {
  limit?: number;
  cursor?: string;
}

export interface DeliveriesPageResponse {
  items: DeliveryListItem[];
  nextCursor: string | null;
}
