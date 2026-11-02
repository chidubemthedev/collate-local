// DRAFT: legal must approve (NDPA s.30)

export const CONSENT_TEXT_VERSION = "v0-draft";

export function getConsentText(): string {
  const privacyPolicyUrl = process.env.PRIVACY_POLICY_URL?.trim();
  const lines = [
    "Collate sends campaign messages about polling unit coverage.",
    "It uses your phone number to match you to a registered list.",
    "Your details are shared with the party that registered you.",
  ];

  if (privacyPolicyUrl) {
    lines.push(`Privacy policy: ${privacyPolicyUrl}`);
  }

  lines.push("Tap Accept to agree to receive messages.");
  return lines.join("\n");
}
