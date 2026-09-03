import { initialsOf, placeholderProfile } from "./placeholder-profile";

describe("initialsOf", () => {
  it("takes the first letter of the first two words", () => {
    expect(initialsOf("Alex Jordan")).toBe("AJ");
  });

  it("handles a single word", () => {
    expect(initialsOf("Alex")).toBe("A");
  });

  it("ignores extra words beyond the first two", () => {
    expect(initialsOf("Alex Jordan Smith")).toBe("AJ");
  });

  it("survives surrounding and repeated whitespace", () => {
    expect(initialsOf("  Alex   Jordan  ")).toBe("AJ");
  });

  it("returns nothing for an empty name rather than throwing", () => {
    // A broken circle is better than a crash, and neither should happen silently.
    expect(initialsOf("")).toBe("");
    expect(initialsOf("   ")).toBe("");
  });
});

describe("placeholderProfile", () => {
  it("is the data the spec pinned", () => {
    // Pinned in the spec precisely so the visible copy cannot drift from what a verifier checks.
    expect(placeholderProfile).toEqual({
      marker: "Sample profile",
      name: "Alex Jordan",
      handle: "@alexjordan",
      rows: [
        { id: "member-since", label: "Member since", value: "March 2026" },
        { id: "plan", label: "Plan", value: "Standard" },
      ],
      signOutCaption: "Sign-in isn't part of this app yet.",
    });
  });
});
