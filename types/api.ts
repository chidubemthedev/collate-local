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

/** A row of Settings · Groups and access (GET /api/settings/groups). */
/** A group type and what its members can do (Settings · Groups and access). */
export interface GroupAccessRule {
  id: number;
  /** Set on the built-in types (admin, party, campaign, support_group); null on types an admin made. */
  key: string | null;
  name: string;
  canMessage: "none" | "agents_they_cover" | "all_agents";
  seesCoverage: "national" | "own_area";
  canOwnAgents: boolean;
  isSystem: boolean;
}

/** An admin on Settings · Admins. Email and phone are masked. */
export interface AdminListItem {
  personId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  /** The admin groups they belong to. */
  groups: string[];
  /** The signed-in person. */
  isYou: boolean;
}

export interface CreateAdminPayload {
  fullName: string;
  email: string;
  phone?: string;
}

/** A candidate or running mate on Settings · Candidates. Emails are masked. */
export interface CandidateInviteItem {
  candidateId: number;
  fullName: string;
  /** The office, or the running mate's title ("Deputy Governor", "Vice President"). */
  title: string;
  /** The seat's area, e.g. "Bauchi" or "Awka North/Awka South". */
  seat: string;
  /** For a running mate, their principal's candidate id and name. */
  principalCandidateId: number | null;
  principalName: string | null;
  isRunningMate: boolean;
  status: "not_invited" | "invited" | "expired" | "registered";
  /** Their sign-in email once registered, or where the invite went. */
  email: string | null;
  invitedAt: string | null;
  expiresAt: string | null;
}

/** What an invite link shows before the candidate completes registration. */
export interface InviteDetails {
  fullName: string;
  title: string;
  seat: string;
  /** Masked. */
  email: string;
  expiresAt: string;
}

/** What deleting a group type would affect (Settings · Groups and access). */
export interface GroupTypeImpact {
  id: number;
  name: string;
  isSystem: boolean;
  /** False for built-in types and for any type a group still uses. */
  canDelete: boolean;
  /** The groups that use this type. */
  groups: Array<{ id: number; name: string; members: number; agents: number }>;
}

/** One entry on Settings · Audit log. */
export interface AuditLogItem {
  id: string;
  /** ISO time, to the microsecond. */
  at: string;
  /** As stored, e.g. "settings.admin.created". */
  action: string;
  /** In plain words, e.g. "Added an admin". */
  actionLabel: string;
  /** A list or page was viewed (logged on every load), not changed. */
  isView: boolean;
  /** Null when no one was signed in, e.g. a Telegram event. name is null if the person was deleted. */
  actor: { personId: string; name: string | null } | null;
  /** What it was done to. name is filled for people, candidates, groups and wards that still exist. */
  target: { type: string; id: string | null; name: string | null } | null;
  ipAddress: string | null;
}

export interface CreateGroupTypePayload {
  name: string;
  canMessage: "none" | "agents_they_cover";
  seesCoverage: "national" | "own_area";
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
  groups: Array<{
    heading: string | null;
    options: ViewAsOption[];
    /** Senate, House of Reps and State Assembly: the same seats grouped by state (Governor has none). */
    states?: Array<{ name: string; options: ViewAsOption[] }>;
  }>;
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
  /** Every gap matching the filters; worked out on the first page only (null with a cursor). */
  totalCount: number | null;
  limit: number;
  items: CoverageGap[];
  /** Where the next page starts (from the response meta); null on the last page. */
  nextCursor: string | null;
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
