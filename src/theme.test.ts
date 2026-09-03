import { Colors, Spacing, Typography } from "./theme";

describe("Colors", () => {
  it("defines the same colour roles in both palettes", () => {
    // A role in one palette and not the other renders `undefined` — an unstyled element
    // rather than a crash, which is why this is asserted rather than left to review.
    expect(Object.keys(Colors.dark).sort()).toEqual(Object.keys(Colors.light).sort());
  });

  it.each(["light", "dark"] as const)("gives every %s role a hex value", (scheme) => {
    for (const [role, value] of Object.entries(Colors[scheme])) {
      expect({ role, value }).toEqual({
        role,
        value: expect.stringMatching(/^#[0-9a-f]{6}$/),
      });
    }
  });

  it("does not reuse one colour for both text and its background", () => {
    for (const scheme of ["light", "dark"] as const) {
      expect(Colors[scheme].text).not.toBe(Colors[scheme].background);
      expect(Colors[scheme].tintText).not.toBe(Colors[scheme].tint);
    }
  });
});

describe("Typography", () => {
  it("pairs every size with a line height that leaves room to read", () => {
    for (const [name, style] of Object.entries(Typography)) {
      expect({ name, roomy: style.lineHeight >= style.fontSize }).toEqual({
        name,
        roomy: true,
      });
    }
  });
});

describe("Spacing", () => {
  it("increases from xs to xxl", () => {
    const steps = [Spacing.xs, Spacing.sm, Spacing.md, Spacing.lg, Spacing.xl, Spacing.xxl];
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
  });
});
