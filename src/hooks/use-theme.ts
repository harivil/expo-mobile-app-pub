import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, type Palette } from "@/theme";

/**
 * The palette for the active colour scheme. Components read colours from here rather than
 * pinning them, which is the whole mechanism behind light and dark both working without a
 * second set of screens.
 */
export function useTheme(): Palette {
  return Colors[useColorScheme()];
}
