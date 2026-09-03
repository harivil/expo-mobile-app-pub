// The design system's single source of truth. Colours are named by ROLE, not by appearance,
// so a role reads correctly in both palettes and survives a rebrand.
//
// ESLint fails the build on a hex literal anywhere outside this file, which is what keeps a
// colour from being pinned into a screen where dark mode cannot reach it.
//
// `Palette` is what forces the two palettes to carry identical keys: a role present in one and
// missing from the other resolves to `undefined` at runtime, which renders as an unstyled
// element rather than an error. The type catches it at compile time and theme.test.ts catches
// it again at runtime.

import type { TextStyle } from "react-native";

export type Palette = {
  /** The page behind everything. */
  background: string;
  /** A raised or inset block on top of `background` — cards, secondary buttons. */
  surface: string;
  /** Body and heading text. */
  text: string;
  /** Supporting text: hints, captions. Still clears 4.5:1 on `background`. */
  textMuted: string;
  /** Hairlines and control outlines. Clears 3:1 on `background`. */
  border: string;
  /** The accent that marks the primary action. Differs per palette on purpose. */
  tint: string;
  /** Text drawn on top of `tint`. */
  tintText: string;
};

// Contrast is ASSERTED, not annotated: src/theme.test.ts computes every ratio in both
// palettes and fails the build when one drops below its threshold. Hand-written ratios were
// here first and two of them were simply wrong, which is the argument for the test.
const light: Palette = {
  background: "#ffffff",
  surface: "#f2f3f5",
  text: "#11181c",
  textMuted: "#545f66",
  border: "#8b949c",
  tint: "#0b6bcb",
  tintText: "#ffffff",
};

const dark: Palette = {
  background: "#151718",
  surface: "#1f2325",
  text: "#ecedee",
  textMuted: "#9ba1a6",
  border: "#5c656b",
  tint: "#4c9aff",
  tintText: "#0b1220",
};

export const Colors = { light, dark };

/** Four-point scale. Padding, gaps and margins come from here — never a raw number. */
export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 40 } as const;

export const Radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

/**
 * Size, line height and weight travel together. A bare `fontSize` is how line height gets
 * forgotten, and line height is what makes text readable.
 */
type TypeStyle = {
  fontSize: number;
  lineHeight: number;
  fontWeight: TextStyle["fontWeight"];
};

export const Typography = {
  display: { fontSize: 64, lineHeight: 72, fontWeight: "700" },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "700" },
  label: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
} satisfies Record<string, TypeStyle>;

/** The widest a content column grows. In effect on web; harmless on a phone. */
export const ContentMaxWidth = 520;

/**
 * Smallest tappable square, from the platform guidelines rather than from the spacing scale —
 * it is a floor on the control, not a design choice about rhythm. `Button` applies it so no
 * call site has to remember it.
 */
export const MinTapTarget = 44;
