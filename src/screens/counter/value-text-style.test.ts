import { valueTextStyle } from "./value-text-style";
import { Typography } from "@/theme";

describe("valueTextStyle", () => {
  it("draws a short count at full display size", () => {
    expect(valueTextStyle(0).fontSize).toBe(Typography.display.fontSize);
    expect(valueTextStyle(9).fontSize).toBe(Typography.display.fontSize);
    expect(valueTextStyle(12345).fontSize).toBe(Typography.display.fontSize);
  });

  it("shrinks once the count grows past the comfortable width", () => {
    // The behaviour the spec asks for, and the one adjustsFontSizeToFit does NOT give on web
    // or Android.
    expect(valueTextStyle(123456).fontSize).toBeLessThan(Typography.display.fontSize);
    expect(valueTextStyle(1000000).fontSize).toBeLessThan(valueTextStyle(123456).fontSize);
  });

  it("keeps a seven-digit count narrow enough for a small phone column", () => {
    // A 300px-wide viewport leaves roughly 252px of column after Screen's padding. At ~0.6em
    // per digit this is the check that the value fits rather than ellipsising.
    const { fontSize } = valueTextStyle(1000000);
    expect(fontSize * 0.6 * 7).toBeLessThan(252);
  });

  it("never shrinks away to nothing", () => {
    const absurd = valueTextStyle(Number("1".repeat(20)));
    expect(absurd.fontSize).toBeGreaterThan(Typography.display.fontSize * 0.4);
  });

  it("never grows as the count gets longer", () => {
    const sizes = [0, 1000, 100000, 10000000, 1000000000].map(
      (count) => valueTextStyle(count).fontSize,
    );
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
  });

  it("keeps line height in proportion to size", () => {
    for (const count of [0, 123456, 1000000]) {
      const { fontSize, lineHeight } = valueTextStyle(count);
      expect(lineHeight).toBeGreaterThanOrEqual(fontSize);
    }
  });
});
