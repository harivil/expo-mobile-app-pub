import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTheme } from "@/hooks/use-theme";

/**
 * Wraps every route. Providers and theme belong here rather than in a screen, because this
 * component persists across navigation while screens do not.
 *
 * `SafeAreaProvider` is not optional: `Screen` reads insets from it, so without it every screen
 * throws. The header is hidden because the counter draws its own heading — one title, not two.
 */
export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = useTheme();

  return (
    <SafeAreaProvider>
      {/* Inverted against the background, so the clock stays legible in both modes. */}
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        {/* `title` still sets the browser tab text on web even with the header hidden. */}
        <Stack.Screen name="index" options={{ title: "Counter" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
