import { expect, type Page } from "@playwright/test";

/**
 * Shared helpers for the web flows. Extracted when the profile flow needed the same hydration
 * gate the counter flow already had — one definition rather than two copies that drift.
 */

/**
 * `react-native-web` renders a component's `testID` as `data-testid`, so these are the same ids
 * the Maestro flows use. Addressing by id rather than by copy is what stops a wording change
 * failing the suite.
 */
export const id = {
  tabCounter: "tab-counter",
  tabProfile: "tab-profile",

  counterScreen: "counter-screen",
  counterValue: "counter-value",
  counterActions: "counter-actions",
  increase: "counter-increase",
  decrease: "counter-decrease",
  reset: "counter-reset",

  profileScreen: "profile-screen",
  profileDetails: "profile-details",
  profileAvatar: "profile-avatar",
  profileName: "profile-name",
  profileHandle: "profile-handle",
  profileSignOut: "profile-signout",
} as const;

/**
 * Deliberately short. The caller has already waited for paint, which is where the cold-Metro
 * bundle cost is paid; what remains is hydration alone, reproduced at about a second. A long
 * budget here would let that inert window grow to any length while the suite still reported
 * green.
 */
export const HYDRATION_BUDGET_MS = 15_000;

/**
 * Wait until the app is actually interactive, then leave the counter at a known zero.
 *
 * `app.json` sets `web.output: "static"`, so Expo Router pre-renders the markup and hydrates it
 * afterwards. Until hydration attaches handlers, a click is silently DROPPED — the element is
 * visible, correct and completely inert. Waiting for a paint therefore proves nothing about
 * interactivity, and that gap is wide enough on a cold bundle to fail a suite.
 *
 * This matters more with tabs than it did with one screen: a tab tap is exactly the kind of first
 * interaction that gets swallowed.
 */
export async function waitUntilInteractive(page: Page) {
  await expect(async () => {
    await page.getByTestId(id.increase).click({ timeout: 5_000 });
    await expect(page.getByTestId(id.counterValue)).not.toHaveText("0", { timeout: 1_000 });
  }).toPass({ timeout: HYDRATION_BUDGET_MS });

  await page.getByTestId(id.reset).click();
  await expect(page.getByTestId(id.counterValue)).toHaveText("0");
}

/** Open the app at the counter tab, hydrated and at zero. */
export async function openApp(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId(id.counterScreen)).toBeVisible({ timeout: 120_000 });
  await waitUntilInteractive(page);
}
