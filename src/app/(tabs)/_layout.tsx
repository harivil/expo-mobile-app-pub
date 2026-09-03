import { Tabs } from "expo-router/js-tabs";
import { StyleSheet } from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { Typography } from "@/theme";

/**
 * The app's primary navigation. A `(tabs)` group is omitted from the URL, so the counter stays at
 * `/` and the profile is at `/profile`.
 *
 * `Tabs` comes from `expo-router/js-tabs`: the re-export from `expo-router` itself is
 * `@deprecated` as of SDK 57, and this entry point is what makes `tabBarButtonTestID` available —
 * a tab bar renders no `testID` of its own, so without it a flow has to select tabs by visible
 * copy and breaks on the next wording change.
 *
 * Every colour here is explicit. react-navigation ships its own default palette for the bar, so a
 * bar left unthemed stays light under a dark screen — and that is invisible to whoever built it in
 * light mode.
 */
export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.tint,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarLabelStyle: Typography.caption,
        // Labels only, no icon set in this app. Without this, react-navigation draws its
        // "missing icon" placeholder — a 25px triangle above every label. Returning null is what
        // makes a label-only bar look deliberate rather than broken.
        tabBarIcon: () => null,
        // With the icon suppressed, its slot is still laid out — leaving the label pinned to the
        // bottom 10px of a 49px bar with dead space above it. Observed on screen; measured at
        // 829-839px in an 844px viewport. `beside-icon` centres the label in the button instead.
        tabBarLabelPosition: "beside-icon",
      }}
    >
      {/* `title` sets both the tab label and, on web, the browser tab text. */}
      <Tabs.Screen
        name="index"
        options={{ title: "Counter", tabBarButtonTestID: "tab-counter" }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarButtonTestID: "tab-profile" }}
      />
    </Tabs>
  );
}
