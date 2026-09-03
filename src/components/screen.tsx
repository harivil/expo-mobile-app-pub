import { ScrollView, StyleSheet, View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/use-theme";
import { ContentMaxWidth, Spacing } from "@/theme";

export type ScreenProps = ViewProps & {
  /**
   * Whether to pad for the bottom safe-area inset.
   *
   * **Defaults to `false`, and that is deliberate.** Every screen in this app lives inside the
   * bottom tab navigator, and that navigator's bar already owns the inset twice over: its height
   * is `49 + insets.bottom` and it applies `paddingBottom: insets.bottom` itself. It does not
   * hand a reduced inset down to the screens beneath it, so `useSafeAreaInsets().bottom` here
   * still reports the full device inset even though the screen area already stops above it.
   * Padding by it as well put ~34px of dead space under the content on an iPhone.
   *
   * Pass `true` for a screen that is genuinely outside the tab group — a modal, or a stack route
   * that covers the bar — where nothing else has consumed the inset.
   */
  bottomInset?: boolean;
};

/**
 * The page container every screen sits in. It owns four things a screen should not have to
 * remember: the themed background, the top safe-area inset, the max-width column that stops a
 * phone layout stretching across a desktop monitor, and scrolling.
 *
 * **Scrolling is not optional here.** A plain `flex: 1` view silently clips whatever does not
 * fit, and the tab view it sits in is `overflow: hidden`, so there is no way for a user to reach
 * the lost content — no wheel, no keyboard, no drag. Observed: on a landscape phone the profile's
 * sign-out control sat 120px below the fold and was unreachable, and the counter's numeral was
 * squeezed to zero height and vanished while still being live. Both are gone once the content can
 * scroll.
 */
export function Screen({ style, children, bottomInset = false, ...rest }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top,
          paddingBottom: bottomInset ? insets.bottom : 0,
        },
      ]}
      {...rest}
    >
      <ScrollView
        style={styles.scroll}
        // `flexGrow` rather than `flex` so short content still fills the height — which is what
        // keeps a footer pinned to the bottom — while tall content is free to overflow and scroll.
        contentContainerStyle={[styles.content, style]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: ContentMaxWidth,
    alignSelf: "center",
    paddingHorizontal: Spacing.lg,
  },
});
