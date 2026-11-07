import { describe, expect, it } from "vitest";
import { decodeAdminCursor, encodeAdminCursor, maskEmail, parseNewAdmin } from "./admins";

describe("parseNewAdmin", () => {
  it("tidies the name, lower-cases the email and strips spaces from the phone", () => {
    expect(parseNewAdmin({ fullName: "  Ada   Obi ", email: " Ada.Obi@Example.COM ", phone: "+234 803-123-4567" })).toEqual({
      ok: true,
      value: { fullName: "Ada Obi", email: "ada.obi@example.com", phone: "+2348031234567" },
    });
  });

  it("treats a missing or empty phone as none", () => {
    expect(parseNewAdmin({ fullName: "Ada", email: "a@b.co" })).toMatchObject({ ok: true, value: { phone: null } });
    expect(parseNewAdmin({ fullName: "Ada", email: "a@b.co", phone: "" })).toMatchObject({ ok: true, value: { phone: null } });
  });

  it("reports every bad field", () => {
    const result = parseNewAdmin({ fullName: " ", email: "not-an-email", phone: "08031234567" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.fields).sort()).toEqual(["email", "fullName", "phone"]);
  });

  it("rejects a name over 120 characters and a body that is not an object", () => {
    expect(parseNewAdmin({ fullName: "x".repeat(121), email: "a@b.co" }).ok).toBe(false);
    expect(parseNewAdmin(null).ok).toBe(false);
    expect(parseNewAdmin("text").ok).toBe(false);
  });
});

describe("maskEmail", () => {
  it("keeps the first two letters and the domain", () => {
    expect(maskEmail("ada.obi@gmail.com")).toBe("ad***@gmail.com");
    expect(maskEmail("a@gmail.com")).toBe("a***@gmail.com");
    expect(maskEmail(null)).toBeNull();
  });
});

describe("admin cursor", () => {
  it("round-trips and refuses anything else", () => {
    const cursor = { name: "ada obi", id: "97aabe6f-d6d5-46c4-aba3-f995ef992714" };
    expect(decodeAdminCursor(encodeAdminCursor(cursor))).toEqual(cursor);
    expect(decodeAdminCursor("not a cursor")).toBeNull();
    expect(decodeAdminCursor(Buffer.from(JSON.stringify(["a", "not-a-uuid"])).toString("base64url"))).toBeNull();
  });
});
