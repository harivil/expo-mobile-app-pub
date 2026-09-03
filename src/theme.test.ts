import { Colors, Spacing, Typography, type Palette } from "./theme";

/** WCAG relative luminance for a `#rrggbb` string. */
function luminance(hex: string): number {
  const toLinear = (byte: number) => {
    const channel = byte / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  const r = toLinear(parseInt(hex.slice(1, 3), 16));
  const g = toLinear(parseInt(hex.slice(3, 5), 16));
  const b = toLinear(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Every pair that carries meaning, with the ratio it owes. Asserted rather than written in a
 * comment beside the hex value, because a comment cannot fail the build — and two of the
 * hand-computed ones that used to live in theme.ts were wrong.
 */
const REQUIRED: { name: string; on: keyof Palette; of: keyof Palette; min: number }[] = [
  { name: "body text", of: "text", on: "background", min: 4.5 },
  { name: "muted text", of: "textMuted", on: "background", min: 4.5 },
  { name: "text on a surface", of: "text", on: "surface", min: 4.5 },
  { name: "primary button label", of: "tintText", on: "tint", min: 4.5 },
  { name: "control outline", of: "border", on: "background", min: 3 },
  { name: "accent", of: "tint", on: "background", min: 3 },
];

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

  it.each(["light", "dark"] as const)(
    "meets its contrast thresholds in the %s palette",
    (scheme) => {
      const palette = Colors[scheme];
      for (const { name, of, on, min } of REQUIRED) {
        const ratio = contrast(palette[of], palette[on]);
        // Reported as an object so a failure names the pair and the ratio, not just a number.
        expect({ name, meets: ratio >= min, ratio: Math.round(ratio * 100) / 100 }).toEqual(
          {
            name,
            meets: true,
            ratio: Math.round(ratio * 100) / 100,
          },
        );
      }
    },
  );

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
