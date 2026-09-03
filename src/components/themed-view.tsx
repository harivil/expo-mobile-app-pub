import { View, type ViewProps } from "react-native";

import { useTheme } from "@/hooks/use-theme";

export type ThemedViewProps = ViewProps & {
  /** `surface` sits on top of `background` — cards, grouped rows, secondary controls. */
  tone?: "background" | "surface";
};

export function ThemedView({ tone = "background", style, ...rest }: ThemedViewProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        { backgroundColor: tone === "surface" ? theme.surface : theme.background },
        style,
      ]}
      {...rest}
    />
  );
}
