import { describe, expect, it } from "vitest";
import {
  createSignInLinkToken,
  hashSignInLinkToken,
  isSignInLinkTokenShape,
  signInLinkUrl,
} from "./sign-in-link";

describe("sign-in link", () => {
  it("uses long random tokens, stored only as a SHA-256 hash", () => {
    const token = createSignInLinkToken();
    expect(isSignInLinkTokenShape(token)).toBe(true);
    expect(createSignInLinkToken()).not.toBe(token);
    expect(hashSignInLinkToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses anything that isn't a token", () => {
    expect(isSignInLinkTokenShape("short")).toBe(false);
    expect(isSignInLinkTokenShape(undefined)).toBe(false);
    expect(isSignInLinkTokenShape(`${"a".repeat(42)}!`)).toBe(false);
  });

  it("builds the link on the given base URL", () => {
    expect(signInLinkUrl("https://collate.ng", "abc_-1")).toBe("https://collate.ng/login/link?token=abc_-1");
  });
});
