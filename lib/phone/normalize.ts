import { parsePhoneNumberFromString } from "libphonenumber-js";

export function toE164(input: string): string | null {
  const parsed = parsePhoneNumberFromString(input, "NG");

  if (!parsed || !parsed.isValid()) {
    return null;
  }

  return parsed.formatInternational();
}
