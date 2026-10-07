import { describe, expect, it } from "vitest";
import { avatarSrc, DEFAULT_AVATAR_BASE_URL, initials } from "../../src/identity/avatar.js";

describe("initials", () => {
  it("takes the first and last word", () => {
    expect(initials("Marek Uncik")).toBe("MU");
    expect(initials("  ana maria  lopez ")).toBe("AL");
  });

  it("handles one word, diacritics and empty names", () => {
    expect(initials("jana")).toBe("J");
    expect(initials("Šimon Ďurko")).toBe("ŠĎ");
    expect(initials(" ".repeat(3))).toBe("?");
  });
});

describe("avatarSrc", () => {
  it("appends the id to the base, and has no default base", () => {
    expect(DEFAULT_AVATAR_BASE_URL).toBe("");
    expect(avatarSrc({ id: "p1" })).toBeUndefined();
    expect(avatarSrc({ id: "a b" }, "/avatars/")).toBe("/avatars/a%20b");
  });

  it("prefers the user's own avatarUrl, and an empty base means none", () => {
    expect(avatarSrc({ id: "p1", avatarUrl: "/me.png" })).toBe("/me.png");
    expect(avatarSrc({ id: "p1" }, "")).toBeUndefined();
  });
});
