import { describe, expect, it } from "vitest";
import { inviteEmail, otpEmail, renderEmail } from "./template";

describe("email templates", () => {
  it("puts the sign-in code in the subject, the HTML and the plain text", () => {
    const email = otpEmail("482913");
    expect(email.subject).toBe("482913 is your Collate sign-in code");
    expect(email.html).toContain(">482913</span>");
    expect(email.html).toContain("10 minutes");
    expect(email.text).toContain("482913");
    expect(email.text).not.toContain("**");
  });

  it("gives the invite a button and the link as text", () => {
    const link = "https://collate.example/invite/abc";
    const email = inviteEmail({ name: "Tata Alhaji", seat: "Deputy Governor, Bauchi", link });
    expect(email.subject).toBe("You're invited to Collate");
    expect(email.html.match(new RegExp(`href="${link}"`, "g"))).toHaveLength(2);
    expect(email.html).toContain("<strong");
    expect(email.text).toContain(`Complete registration: ${link}`);
    expect(email.text).toContain("as Deputy Governor, Bauchi.");
  });

  it("escapes names and links, so they can't add HTML", () => {
    const { html } = renderEmail({
      preheader: "x",
      heading: "<b>Hi</b>",
      paragraphs: ["Tom & <script>alert(1)</script>"],
      button: { label: "Go", href: 'https://a.b/"onmouseover="x' },
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>Hi</b>");
    expect(html).toContain("Tom &#38; &#60;script&#62;");
    expect(html).not.toContain('"onmouseover="');
  });
});
