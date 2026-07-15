import { inviteUrl, parseInviteCode } from "../invites";

describe("parseInviteCode", () => {
  it("round-trips our own invite deep link", () => {
    expect(parseInviteCode(inviteUrl("AB23CD"))).toBe("AB23CD");
  });

  it("accepts a bare 6-character code, uppercasing it", () => {
    expect(parseInviteCode("ab23cd")).toBe("AB23CD");
    expect(parseInviteCode("  AB23CD  ")).toBe("AB23CD");
  });

  it("accepts any URL with a ?code= param", () => {
    expect(parseInviteCode("https://example.com/join?x=1&code=QRST23")).toBe(
      "QRST23",
    );
  });

  it("rejects content that isn't an invite", () => {
    expect(parseInviteCode("https://example.com")).toBeNull();
    expect(parseInviteCode("hello world")).toBeNull();
    expect(parseInviteCode("ABCDE")).toBeNull(); // 5 chars
    expect(parseInviteCode("ABCDEFG")).toBeNull(); // 7 chars
    expect(parseInviteCode("")).toBeNull();
  });
});
