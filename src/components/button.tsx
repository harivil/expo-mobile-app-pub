import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { MinTapTarget, Radius, Spacing, Typography } from "@/theme";

export type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  /** Semantic, not visual: exactly one primary action per screen. */
  variant?: "primary" | "secondary";
  style?: StyleProp<ViewStyle>;
};

/**
 * The app's only button. It takes its label as a prop rather than as children so that every
 * button is guaranteed a text label for a screen reader to announce, and it applies
 * `MinTapTarget` itself so no call site can ship a control too small to hit.
 */
export function Button({
  label,
  variant = "primary",
  disabled = false,
  style,
  // Pulled out of `rest` and merged below rather than left to be spread over the top: this
  // component promises the disabled state is always announced, and a caller passing its own
  // accessibilityState would otherwise silently erase that promise.
  accessibilityState,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const isPrimary = variant === "primary";

  return (
    <Pressable
      accessibilityRole="button"
      // Announced by the screen reader, not merely drawn faintly — a disabled control that only
      // looks disabled is invisible to anyone not looking at it.
      accessibilityState={{ ...accessibilityState, disabled: Boolean(disabled) }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: isPrimary ? theme.tint : theme.surface,
          borderColor: isPrimary ? theme.tint : theme.border,
        },
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
      {...rest}
    >
      <Text style={[styles.label, { color: isPrimary ? theme.tintText : theme.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MinTapTarget,
    minWidth: MinTapTarget,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    ...Typography.label,
    textAlign: "center",
  },
});
