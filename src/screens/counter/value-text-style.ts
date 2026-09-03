import { PixelRatio } from "react-native";

import { Typography } from "@/theme";

/**
 * How big to draw the count, given how many digits it has and how large the reader's system
 * font is.
 *
 * This exists because `adjustsFontSizeToFit` — the obvious way to do this — is **iOS-only**.
 * React Native Web ignores it and falls back to `text-overflow: ellipsis`, and Android ignores
 * it too, so a long value would clip rather than shrink on two of this app's three surfaces.
 * The spec asks for shrinking, so the scale is computed here instead and applied on every
 * platform alike.
 *
 * A pure function on purpose: a counter cannot realistically be tapped to seven digits, so this
 * is the only way the behaviour is testable at all.
 */

/** Up to this many digit-widths, the value draws at full display size. */
const COMFORTABLE_DIGITS = 5;

/** Never shrink past this, or the number stops reading as the focus of the screen. */
const MIN_SCALE = 0.45;

export function valueTextStyle(
  count: number,
  /** Injected so this stays testable; `PixelRatio` always reports 1 on web. */
  fontScale: number = PixelRatio.getFontScale(),
): { fontSize: number; lineHeight: number } {
  // Two independent things make the value too wide for the column: more digits, and a larger
  // system font. Both multiply the rendered width, so both have to come out of the same budget
  // — accounting for digits alone is what leaves a five-digit count ellipsised at 200%.
  const digitWidths = String(count).length * Math.max(1, fontScale);

  const scale =
    digitWidths <= COMFORTABLE_DIGITS
      ? 1
      : Math.max(MIN_SCALE, COMFORTABLE_DIGITS / digitWidths);

  return {
    fontSize: Math.round(Typography.display.fontSize * scale),
    lineHeight: Math.round(Typography.display.lineHeight * scale),
  };
}
