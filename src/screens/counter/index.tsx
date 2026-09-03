import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/theme";
import { valueTextStyle } from "./value-text-style";

/**
 * The app's only screen. The count is held in memory and deliberately not persisted, so a
 * relaunch or a browser reload starts over.
 *
 * The floor at zero is enforced twice on purpose: `disabled` stops the tap, and `Math.max`
 * stops the arithmetic. The second is what holds if a future call site ever fires the handler
 * without the button — a guard is cheaper than the bug.
 */
export function Counter() {
  const [count, setCount] = useState(0);
  const atZero = count === 0;

  return (
    <Screen testID="counter-screen">
      <View style={styles.body}>
        {/* A real heading, not just large text — otherwise a screen-reader user has nothing to
            navigate to and the screen has no structure. */}
        <ThemedText variant="title" accessibilityRole="header">
          Counter
        </ThemedText>

        <ThemedText
          testID="counter-value"
          variant="display"
          // The number alone reads as a bare digit out of context; this gives it a name.
          accessibilityLabel={`Count: ${count}`}
          accessibilityLiveRegion="polite"
          numberOfLines={1}
          // No `adjustsFontSizeToFit`: it is iOS-only, so keeping it would make iOS shrink by a
          // second, untested mechanism and render a size no test pins — on the one surface that
          // cannot be observed from here. `valueTextStyle` handles all three the same way.
          style={[styles.centred, valueTextStyle(count)]}
        >
          {count}
        </ThemedText>

        <ThemedText variant="caption" tone="muted" style={styles.centred}>
          Counts up from zero. Starts over when the app restarts.
        </ThemedText>
      </View>

      {/* The buttons stretch to the content column, which makes this block the thing a web
          flow can measure to prove the column is capped and centred. */}
      <View testID="counter-actions" style={styles.actions}>
        <Button
          testID="counter-increase"
          label="Increase"
          // The functional updater is what makes ten fast taps land on ten rather than one.
          onPress={() => setCount((current) => current + 1)}
        />
        <Button
          testID="counter-decrease"
          label="Decrease"
          variant="secondary"
          disabled={atZero}
          onPress={() => setCount((current) => Math.max(0, current - 1))}
        />
        <Button
          testID="counter-reset"
          label="Reset"
          variant="secondary"
          disabled={atZero}
          onPress={() => setCount(0)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  centred: {
    textAlign: "center",
  },
  actions: {
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
});
