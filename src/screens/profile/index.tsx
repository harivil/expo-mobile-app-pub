import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { Radius, Spacing, Typography } from "@/theme";
import { initialsOf, placeholderProfile } from "./placeholder-profile";

/** Derived from the spacing scale rather than added as a token — one use site. */
const AVATAR_SIZE = Spacing.xxl * 2;

/**
 * A read-only profile page built entirely from fictional placeholder data. There is no editing, no
 * storage and no network call, which is what keeps this a layout rather than a personal-data
 * feature. See `placeholder-profile.ts`.
 *
 * The two rows are the same thing twice, so they are data rendered in a map rather than a
 * component: that de-duplicates them without building a configuration surface for a second caller
 * who does not exist.
 */
export function Profile() {
  const theme = useTheme();

  return (
    <Screen testID="profile-screen">
      <View style={styles.header}>
        {/* Carries the "nothing here is real data" claim, so it gets an id of its own rather
            than being selected by copy, and `label` rather than `caption` so it is not the
            faintest thing on a page full of plausible-looking details. */}
        <ThemedText testID="profile-marker" variant="label" tone="muted">
          {placeholderProfile.marker}
        </ThemedText>

        <ThemedText variant="title" accessibilityRole="header">
          Profile
        </ThemedText>

        <View
          testID="profile-avatar"
          // Decorative: it is the name rendered as glyphs, and the name follows immediately.
          // Without this a screen reader announces "A J" and then "Alex Jordan".
          aria-hidden
          style={[styles.avatar, { backgroundColor: theme.tint }]}
        >
          <ThemedText variant="title" style={{ color: theme.tintText }}>
            {initialsOf(placeholderProfile.name)}
          </ThemedText>
        </View>

        <ThemedText testID="profile-name" variant="title">
          {placeholderProfile.name}
        </ThemedText>

        <ThemedText testID="profile-handle" variant="body" tone="muted">
          {placeholderProfile.handle}
        </ThemedText>
      </View>

      <ThemedView
        testID="profile-details"
        tone="surface"
        style={[styles.details, { borderColor: theme.border }]}
      >
        {placeholderProfile.rows.map((row, index) => (
          <View
            key={row.id}
            style={[
              styles.row,
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth },
              { borderTopColor: theme.border },
            ]}
          >
            <ThemedText variant="body" tone="muted">
              {row.label}
            </ThemedText>
            <ThemedText testID={`profile-row-value-${row.id}`} variant="body">
              {row.value}
            </ThemedText>
          </View>
        ))}
      </ThemedView>

      <View style={styles.footer}>
        {/* Disabled on purpose: there is no authentication in this app. A control that silently
            did nothing would be worse than no control, so the caption says what it is. */}
        <Button testID="profile-signout" label="Sign out" variant="secondary" disabled />
        <ThemedText variant="caption" tone="muted" style={styles.caption}>
          {placeholderProfile.signOutCaption}
        </ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingTop: Spacing.xl,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: Spacing.sm,
  },
  details: {
    marginTop: Spacing.xl,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    // Wrap rather than clip when a label and value are both long, or the font is scaled up.
    flexWrap: "wrap",
    minHeight: Typography.body.lineHeight + Spacing.lg,
  },
  footer: {
    marginTop: "auto",
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  caption: {
    textAlign: "center",
  },
});
