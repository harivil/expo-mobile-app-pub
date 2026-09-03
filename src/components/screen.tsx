import { StyleSheet, View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/use-theme";
import { ContentMaxWidth, Spacing } from "@/theme";

export type ScreenProps = ViewProps;

/**
 * The page container every screen sits in. It owns three things a screen should not have to
 * remember: the themed background, the safe-area insets, and the max-width column that stops a
 * phone layout stretching across a desktop monitor on web.
 *
 * Insets are applied as padding on the outer view and the background is painted behind them, so
 * colour reaches the edges of the display while content stays clear of the notch.
 */
export function Screen({ style, children, ...rest }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
      {...rest}
    >
      <View style={[styles.content, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    width: "100%",
    maxWidth: ContentMaxWidth,
    alignSelf: "center",
    paddingHorizontal: Spacing.lg,
  },
});
