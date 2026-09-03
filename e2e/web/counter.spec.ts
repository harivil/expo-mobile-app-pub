import { expect, test, type Page } from "@playwright/test";

// Imported rather than retyped, so the assertion below cannot drift from the token the screen
// actually uses.
import { ContentMaxWidth } from "../../src/theme";

// `react-native-web` renders a component's `testID` as `data-testid`, so these are the same ids
// the Maestro flows use. Addressing by id rather than by copy is what stops a wording change
// failing the suite.
const id = {
  screen: "counter-screen",
  value: "counter-value",
  actions: "counter-actions",
  increase: "counter-increase",
  decrease: "counter-decrease",
  reset: "counter-reset",
} as const;

/**
 * Wait until the page is actually interactive, then return it to a known zero.
 *
 * `app.json` sets `web.output: "static"`, so Expo Router pre-renders the markup and hydrates it
 * afterwards. Until hydration attaches handlers, a click is silently DROPPED — the element is
 * visible, correct and completely inert. Waiting for a paint (`toBeVisible`) therefore proves
 * nothing about interactivity, and on a cold Metro bundle the gap between the two ran past a
 * default timeout and failed this suite.
 *
 * So the gate is a real interaction rather than a paint: click until the value moves. Retries
 * can push the count past one, which is why Reset follows — every test then starts from a
 * hydrated page showing zero.
 */
async function waitUntilInteractive(page: Page) {
  await expect(async () => {
    await page.getByTestId(id.increase).click({ timeout: 5_000 });
    await expect(page.getByTestId(id.value)).not.toHaveText("0", { timeout: 1_000 });
  }).toPass({ timeout: 120_000 });

  await page.getByTestId(id.reset).click();
  await expect(page.getByTestId(id.value)).toHaveText("0");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId(id.screen)).toBeVisible({ timeout: 120_000 });
});

test("shows zero on first load, with decrease and reset unavailable", async ({ page }) => {
  // Deliberately does NOT gate on interactivity: this is the launch state, and reading it is
  // exactly what a user sees before touching anything.
  await expect(page.getByTestId(id.value)).toHaveText("0");

  // RNW sets BOTH aria-disabled and the native disabled attribute for
  // accessibilityState.disabled. aria-disabled is the one asserted here because it is what a
  // screen reader announces.
  await expect(page.getByTestId(id.decrease)).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId(id.reset)).toHaveAttribute("aria-disabled", "true");
});

test("counts up, counts back down, and resets", async ({ page }) => {
  await waitUntilInteractive(page);
  const value = page.getByTestId(id.value);

  for (let tap = 0; tap < 3; tap += 1) {
    await page.getByTestId(id.increase).click();
  }
  await expect(value).toHaveText("3");

  await expect(page.getByTestId(id.decrease)).not.toHaveAttribute("aria-disabled", "true");
  await page.getByTestId(id.decrease).click();
  await expect(value).toHaveText("2");

  await page.getByTestId(id.reset).click();
  await expect(value).toHaveText("0");
});

test("holds the floor at zero", async ({ page }) => {
  await waitUntilInteractive(page);
  const value = page.getByTestId(id.value);

  // Step up first, so this test cannot pass merely because nothing ever happened — that is how
  // an un-hydrated page made an earlier version of this test green while the app was inert.
  await page.getByTestId(id.increase).click();
  await expect(value).toHaveText("1");

  await page.getByTestId(id.decrease).click();
  await expect(value).toHaveText("0");

  // Forcing a click past the disabled state must not take the count negative.
  await page.getByTestId(id.decrease).click({ force: true });
  await expect(value).toHaveText("0");
});

test("starts over on reload — the count is not persisted", async ({ page }) => {
  await waitUntilInteractive(page);

  await page.getByTestId(id.increase).click();
  await expect(page.getByTestId(id.value)).toHaveText("1");

  await page.reload();

  await expect(page.getByTestId(id.value)).toHaveText("0");
});

test("keeps content in a centred column on a desktop viewport", async ({ page }) => {
  // The failure this catches: a phone layout stretched across a monitor. Only web can break
  // this, which is why it lives here rather than in a Maestro flow.
  const width = 1440;
  await page.setViewportSize({ width, height: 900 });

  const actions = page.getByTestId(id.actions);
  await expect(actions).toBeVisible({ timeout: 120_000 });

  // Measured inside a retrying assertion, not once. `boundingBox()` returns null for an element
  // mid-layout, and on a cold bundle the resize and the hydration land close enough together
  // that a single measurement caught the element between the two and read null.
  await expect(async () => {
    const box = await actions.boundingBox();
    expect(box).not.toBeNull();
    if (box === null) return;

    expect(box.width).toBeLessThanOrEqual(ContentMaxWidth);
    // Comfortably narrower than the viewport, i.e. actually capped rather than merely inset.
    expect(box.width).toBeLessThan(720);
    expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThan(2);
  }).toPass({ timeout: 60_000 });
});
