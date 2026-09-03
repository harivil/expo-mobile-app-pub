import { expect, test } from "@playwright/test";

import { ContentMaxWidth } from "../../src/theme";
import { id, openApp } from "./app";

// Owns every tab criterion in docs/specs/profile-tab.md. It has to: `expo-router` is stubbed to
// `Tabs: () => null` under Jest, so tab switching, URLs and back behaviour are not testable at
// the unit layer at all.

test("shows both tabs, with Counter selected on launch", async ({ page }) => {
  await openApp(page);

  const counterTab = page.getByTestId(id.tabCounter);
  const profileTab = page.getByTestId(id.tabProfile);

  await expect(counterTab).toHaveText("Counter");
  await expect(profileTab).toHaveText("Profile");

  // Selected state as a screen reader would read it, not merely as a colour.
  await expect(counterTab).toHaveAttribute("aria-selected", "true");
  await expect(profileTab).toHaveAttribute("aria-selected", "false");

  await expect(page.getByTestId(id.counterScreen)).toBeVisible();
});

test("switches to Profile and back, keeping the counter at /", async ({ page }) => {
  await openApp(page);

  await page.getByTestId(id.tabProfile).click();
  await expect(page.getByTestId(id.profileScreen)).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/profile");
  await expect(page.getByTestId(id.tabProfile)).toHaveAttribute("aria-selected", "true");

  await page.getByTestId(id.tabCounter).click();
  await expect(page.getByTestId(id.counterScreen)).toBeVisible();
  // The counter's address must not have changed: a `(tabs)` group is omitted from the URL.
  expect(new URL(page.url()).pathname).toBe("/");
});

test("keeps the count when switching tabs and back", async ({ page }) => {
  await openApp(page);

  for (let tap = 0; tap < 3; tap += 1) {
    await page.getByTestId(id.increase).click();
  }
  await expect(page.getByTestId(id.counterValue)).toHaveText("3");

  await page.getByTestId(id.tabProfile).click();
  await expect(page.getByTestId(id.profileScreen)).toBeVisible();

  await page.getByTestId(id.tabCounter).click();
  // A tab switch is not a relaunch. A reload still resets — that is counter.spec.ts's job.
  await expect(page.getByTestId(id.counterValue)).toHaveText("3");
});

test("loads /profile directly, with the tab bar and the counter still reachable", async ({
  page,
}) => {
  // `web.output: "static"` pre-renders each route separately, so a cold entry to a route inside a
  // group is a genuinely different thing from navigating to it.
  await page.goto("/profile");
  await expect(page.getByTestId(id.profileScreen)).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId(id.tabCounter)).toBeVisible();
  await expect(page).toHaveTitle("Profile");

  await page.getByTestId(id.tabCounter).click();
  await expect(page.getByTestId(id.counterScreen)).toBeVisible({ timeout: 30_000 });
});

test("browser back from /profile returns to the counter", async ({ page }) => {
  await openApp(page);

  await page.getByTestId(id.tabProfile).click();
  await expect(page.getByTestId(id.profileScreen)).toBeVisible();

  await page.goBack();

  await expect(page.getByTestId(id.counterScreen)).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
});

test("titles the browser tab per route", async ({ page }) => {
  await openApp(page);
  await expect(page).toHaveTitle("Counter");

  await page.getByTestId(id.tabProfile).click();
  await expect(page).toHaveTitle("Profile");
});

test("shows the sample profile, and says it is a sample", async ({ page }) => {
  await openApp(page);
  await page.getByTestId(id.tabProfile).click();
  await expect(page.getByTestId(id.profileScreen)).toBeVisible();

  // The compliance-carrying assertion: nothing here should read as a real person.
  await expect(page.getByText("Sample profile")).toBeVisible();

  await expect(page.getByTestId(id.profileAvatar)).toHaveText("AJ");
  await expect(page.getByTestId(id.profileName)).toHaveText("Alex Jordan");
  await expect(page.getByTestId(id.profileHandle)).toHaveText("@alexjordan");
  await expect(page.getByTestId("profile-row-value-member-since")).toHaveText("March 2026");
  await expect(page.getByTestId("profile-row-value-plan")).toHaveText("Standard");
});

test("sign out is disabled and says why", async ({ page }) => {
  await openApp(page);
  await page.getByTestId(id.tabProfile).click();
  await expect(page.getByTestId(id.profileScreen)).toBeVisible();

  await expect(page.getByTestId(id.profileSignOut)).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(page.getByText("Sign-in isn't part of this app yet.")).toBeVisible();
});

test("keeps the profile in a centred column on a desktop viewport", async ({ page }) => {
  const width = 1440;
  await page.setViewportSize({ width, height: 900 });

  await openApp(page);
  await page.getByTestId(id.tabProfile).click();

  const details = page.getByTestId(id.profileDetails);
  await expect(details).toBeVisible();

  // Every measurement inside the retrying assertion: mid-layout, boundingBox() returns null and
  // getBoundingClientRect() reads 0. Measuring once outside this block is what failed twice in
  // the counter's flow.
  await expect(async () => {
    const columnWidth = await details.evaluate(
      (node) => (node.parentElement as HTMLElement).getBoundingClientRect().width,
    );
    expect(columnWidth).toBe(ContentMaxWidth);

    const box = await details.boundingBox();
    expect(box).not.toBeNull();
    if (box === null) return;

    expect(box.width).toBeLessThanOrEqual(ContentMaxWidth);
    expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThan(2);
  }).toPass({ timeout: 60_000 });
});
