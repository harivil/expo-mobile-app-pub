import { valueTextStyle } from "./value-text-style";
import { Typography } from "@/theme";

/** Rough width of a digit as a fraction of font size, for the fit checks below. */
const DIGIT_WIDTH_EM = 0.6;

describe("valueTextStyle", () => {
  it("draws a short count at full display size", () => {
    expect(valueTextStyle(0, 1).fontSize).toBe(Typography.display.fontSize);
    expect(valueTextStyle(9, 1).fontSize).toBe(Typography.display.fontSize);
    expect(valueTextStyle(12345, 1).fontSize).toBe(Typography.display.fontSize);
  });

  it("shrinks once the count grows past the comfortable width", () => {
    // The behaviour the spec asks for, and the one adjustsFontSizeToFit does NOT give on web
    // or Android.
    expect(valueTextStyle(123456, 1).fontSize).toBeLessThan(Typography.display.fontSize);
    expect(valueTextStyle(1000000, 1).fontSize).toBeLessThan(
      valueTextStyle(123456, 1).fontSize,
    );
  });

  it("keeps a seven-digit count narrow enough for a small phone column", () => {
    // A 300px-wide viewport leaves roughly 252px of column after Screen's padding.
    const { fontSize } = valueTextStyle(1000000, 1);
    expect(fontSize * DIGIT_WIDTH_EM * 7).toBeLessThan(252);
  });

  it("shrinks further when the system font is scaled up", () => {
    // The 200% criterion. Without a font-scale term the rendered numeral doubles and clips.
    expect(valueTextStyle(12345, 2).fontSize).toBeLessThan(
      valueTextStyle(12345, 1).fontSize,
    );
  });

  it("still fits a five-digit count at 200% system font size", () => {
    // 360dp phone leaves roughly 312px of column. The RENDERED size is our size times the
    // system scale, which is what has to fit.
    const scale = 2;
    const rendered = valueTextStyle(12345, scale).fontSize * scale;
    expect(rendered * DIGIT_WIDTH_EM * 5).toBeLessThan(312);
  });

  it("lets a short count grow with the system font rather than shrinking needlessly", () => {
    // A single digit at 200% is still narrow, so accessibility should win over fitting.
    expect(valueTextStyle(7, 2).fontSize).toBe(Typography.display.fontSize);
  });

  it("treats a font scale below one as no scaling", () => {
    expect(valueTextStyle(12345, 0.5).fontSize).toBe(valueTextStyle(12345, 1).fontSize);
  });

  it("never shrinks away to nothing", () => {
    const absurd = valueTextStyle(Number("1".repeat(20)), 3);
    expect(absurd.fontSize).toBeGreaterThan(Typography.display.fontSize * 0.4);
  });

  it("never grows as the count gets longer", () => {
    const sizes = [0, 1000, 100000, 10000000, 1000000000].map(
      (count) => valueTextStyle(count, 1).fontSize,
    );
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
  });

  it("keeps line height in proportion to size", () => {
    for (const count of [0, 123456, 1000000]) {
      const { fontSize, lineHeight } = valueTextStyle(count, 1);
      expect(lineHeight).toBeGreaterThanOrEqual(fontSize);
    }
  });
});
