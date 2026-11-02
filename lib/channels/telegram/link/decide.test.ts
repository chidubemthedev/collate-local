import { describe, expect, it } from "vitest";
import { decideContact } from "./decide";

describe("decideContact", () => {
  it("accepts the sender's own contact in a private chat", () => {
    expect(
      decideContact({
        contactUserId: 123,
        contactPhone: "+2348030000000",
        senderId: 123,
        senderChatType: "private",
      }),
    ).toEqual({ action: "lookup", e164: "+2348030000000" });
  });

  it("accepts local, international and country-code-only number formats", () => {
    for (const phone of [
      "0803 000 0000",
      "+2348030000000",
      "2348030000000",
    ]) {
      expect(
        decideContact({
          contactUserId: 1,
          contactPhone: phone,
          senderId: 1,
          senderChatType: "private",
        }),
      ).toEqual({ action: "lookup", e164: "+2348030000000" });
    }
  });

  it("ignores someone else's contact", () => {
    expect(
      decideContact({
        contactUserId: 456,
        contactPhone: "+2348030000000",
        senderId: 123,
        senderChatType: "private",
      }),
    ).toEqual({ action: "ignore" });
  });

  it("ignores a contact without a user ID", () => {
    expect(
      decideContact({
        contactPhone: "+2348030000000",
        senderId: 123,
        senderChatType: "private",
      }),
    ).toEqual({ action: "ignore" });
  });

  it("ignores group chats", () => {
    expect(
      decideContact({
        contactUserId: 123,
        contactPhone: "+2348030000000",
        senderId: 123,
        senderChatType: "group",
      }),
    ).toEqual({ action: "ignore" });
  });

  it("ignores a missing or invalid number", () => {
    expect(
      decideContact({
        contactUserId: 123,
        senderId: 123,
        senderChatType: "private",
      }),
    ).toEqual({ action: "ignore" });
    expect(
      decideContact({
        contactUserId: 123,
        contactPhone: "12345",
        senderId: 123,
        senderChatType: "private",
      }),
    ).toEqual({ action: "ignore" });
  });
});
