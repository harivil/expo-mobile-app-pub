import { useColorScheme as useSystemColorScheme } from "react-native";

/**
 * The only two schemes this app draws. React Native's own `useColorScheme()` has a wider return
 * type than that: it also yields `"unspecified"` — and `null` — on a platform that has not
 * reported a preference yet. `Colors["unspecified"]` is `undefined`, which paints one frame of
 * an unstyled screen rather than throwing. Everything reads the scheme through here so that
 * case is narrowed away once, in one place.
 */
export type ColorSchemeName = "light" | "dark";

/**
 * Exported separately from the hook so the narrowing can be tested as a pure function. Testing
 * it through the hook would mean mocking `react-native` internals, which couples the test to a
 * React Native version rather than to this app.
 */
export function narrowColorScheme(
  scheme: ColorSchemeName | "unspecified" | null | undefined,
): ColorSchemeName {
  return scheme === "dark" ? "dark" : "light";
}

/** The active colour scheme, never `null`. Light is the fallback. */
export function useColorScheme(): ColorSchemeName {
  return narrowColorScheme(useSystemColorScheme());
}
