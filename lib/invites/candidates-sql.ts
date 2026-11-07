/**
 * Candidates with their seat and latest invite, as listed on Settings · Candidates. A running mate
 * takes their principal's seat. Used by the list and by the invite routes.
 */
export const CANDIDATE_ROWS_SQL = `
  SELECT
    c.id,
    p.full_name,
    p.email_address AS person_email,
    c.principal_candidate_id,
    principal_person.full_name AS principal_name,
    o.office_name,
    o.hierarchy_level AS level,
    pun.political_unit_name AS unit_name,
    LOWER(pun.political_unit_name) AS unit_sort,
    COALESCE(c.principal_candidate_id, c.id) AS family,
    (c.principal_candidate_id IS NOT NULL)::int AS mate,
    latest.email_address AS invite_email,
    latest.is_revoked AS invite_revoked,
    latest.accepted_at AS invite_accepted_at,
    latest.expires_at AS invite_expires_at,
    latest.created_at AS invite_created_at,
    CASE
      WHEN p.email_address IS NOT NULL THEN 'registered'
      WHEN latest.id IS NULL OR latest.is_revoked OR latest.accepted_at IS NOT NULL THEN 'not_invited'
      WHEN latest.expires_at <= NOW() THEN 'expired'
      ELSE 'invited'
    END AS status
  FROM candidate c
  JOIN person p ON p.id = c.person_id
  LEFT JOIN candidate principal ON principal.id = c.principal_candidate_id
  LEFT JOIN person principal_person ON principal_person.id = principal.person_id
  JOIN seat st ON st.id = COALESCE(c.seat_id, principal.seat_id)
  JOIN office o ON o.id = st.office_id
  JOIN political_unit pun ON pun.id = st.political_unit_id
  LEFT JOIN LATERAL (
    SELECT link.id, link.email_address, link.is_revoked, link.accepted_at, link.expires_at, link.created_at
    FROM invite_access_link link
    WHERE link.candidate_id = c.id
    ORDER BY link.created_at DESC
    LIMIT 1
  ) latest ON TRUE
`;

export type CandidateRow = {
  id: number;
  full_name: string;
  person_email: string | null;
  principal_candidate_id: number | null;
  principal_name: string | null;
  office_name: string;
  level: number;
  unit_name: string;
  unit_sort: string;
  family: number;
  mate: number;
  invite_email: string | null;
  invite_revoked: boolean | null;
  invite_accepted_at: Date | null;
  invite_expires_at: Date | null;
  invite_created_at: Date | null;
  status: "not_invited" | "invited" | "expired" | "registered";
};
