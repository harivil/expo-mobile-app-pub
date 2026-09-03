import { Text, type TextProps } from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { Typography } from "@/theme";

export type ThemedTextProps = TextProps & {
  /** A step on the type scale. Carries size, line height and weight together. */
  variant?: keyof typeof Typography;
  /** `muted` is for supporting copy — still contrast-checked against the background. */
  tone?: "default" | "muted";
};

export function ThemedText({
  variant = "body",
  tone = "default",
  style,
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        Typography[variant],
        { color: tone === "muted" ? theme.textMuted : theme.text },
        style,
      ]}
      {...rest}
    />
  );
}
