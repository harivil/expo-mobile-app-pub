import { expect, test } from "@playwright/test";

// Imported rather than retyped, so the assertion below cannot drift from the token the screen
// actually uses.
import { ContentMaxWidth } from "../../src/theme";
// `id` and `waitUntilInteractive` moved to ./app when the profile flow needed the same hydration
// gate — one definition rather than two copies that drift. The gate's reasoning lives there.
import { id, waitUntilInteractive } from "./app";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId(id.counterScreen)).toBeVisible({ timeout: 120_000 });
});

test("shows zero on first load, with decrease and reset unavailable", async ({ page }) => {
  // Deliberately does NOT gate on interactivity: this is the launch state, and reading it is
  // exactly what a user sees before touching anything.
  await expect(page.getByTestId(id.counterValue)).toHaveText("0");

  // RNW sets BOTH aria-disabled and the native disabled attribute for
  // accessibilityState.disabled. aria-disabled is the one asserted here because it is what a
  // screen reader announces.
  await expect(page.getByTestId(id.decrease)).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId(id.reset)).toHaveAttribute("aria-disabled", "true");
});

test("counts up, counts back down, and resets", async ({ page }) => {
  await waitUntilInteractive(page);
  const value = page.getByTestId(id.counterValue);

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
  const value = page.getByTestId(id.counterValue);

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
  await expect(page.getByTestId(id.counterValue)).toHaveText("1");

  await page.reload();

  await expect(page.getByTestId(id.counterValue)).toHaveText("0");
});

test("keeps the value visible on a short viewport", async ({ page }) => {
  // Regression: with no scroll container the value's box was squeezed to zero height and the
  // digit disappeared entirely at 390x300 — still live and still counting, just invisible. The
  // tab bar took another 49px off the budget, so the onset arrived earlier than before.
  await page.setViewportSize({ width: 390, height: 320 });
  await waitUntilInteractive(page);

  const value = page.getByTestId(id.counterValue);
  await value.scrollIntoViewIfNeeded();
  await expect(value).toBeVisible();

  const box = await value.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.height ?? 0).toBeGreaterThan(0);
});

test("keeps content in a centred column on a desktop viewport", async ({ page }) => {
  // The failure this catches: a phone layout stretched across a monitor. Only web can break
  // this, which is why it lives here rather than in a Maestro flow.
  const width = 1440;
  await page.setViewportSize({ width, height: 900 });

  const actions = page.getByTestId(id.counterActions);
  await expect(actions).toBeVisible({ timeout: 120_000 });

  // EVERY measurement goes inside the retrying assertion. Mid-layout, `boundingBox()` returns
  // null and a `getBoundingClientRect()` reads 0 — on a cold bundle the resize and the hydration
  // land close enough together that a single measurement catches exactly that. A measurement
  // taken once outside this block is the one thing that has failed here twice.
  await expect(async () => {
    // The CAP is asserted on the element that carries it — Screen's content view. Measuring
    // only `counter-actions` reads ~472px inside Screen's padding, which could not tell a 520
    // cap from a 560 one, so it would pass against the wrong token.
    const columnWidth = await actions.evaluate(
      (node) => (node.parentElement as HTMLElement).getBoundingClientRect().width,
    );
    expect(columnWidth).toBe(ContentMaxWidth);

    const box = await actions.boundingBox();
    expect(box).not.toBeNull();
    if (box === null) return;

    expect(box.width).toBeLessThanOrEqual(ContentMaxWidth);
    // Comfortably narrower than the viewport, i.e. actually capped rather than merely inset.
    expect(box.width).toBeLessThan(720);
    expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThan(2);
  }).toPass({ timeout: 60_000 });
});
