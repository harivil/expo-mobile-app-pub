import { render, screen, userEvent } from "@testing-library/react-native";

import { Counter } from "./index";

const value = () => screen.getByTestId("counter-value");
const increase = () => screen.getByRole("button", { name: "Increase" });
const decrease = () => screen.getByRole("button", { name: "Decrease" });
const reset = () => screen.getByRole("button", { name: "Reset" });

describe("Counter", () => {
  it("starts at zero", async () => {
    await render(<Counter />);
    expect(value()).toHaveTextContent("0");
  });

  it("counts up by one per tap", async () => {
    await render(<Counter />);

    await userEvent.press(increase());
    expect(value()).toHaveTextContent("1");

    await userEvent.press(increase());
    await userEvent.press(increase());
    expect(value()).toHaveTextContent("3");
  });

  it("counts back down by one per tap", async () => {
    await render(<Counter />);

    await userEvent.press(increase());
    await userEvent.press(increase());
    await userEvent.press(increase());
    await userEvent.press(decrease());

    expect(value()).toHaveTextContent("2");
  });

  it("never goes below zero", async () => {
    // The floor is the behaviour the CHANGELOG already promised; this is the test that holds it.
    await render(<Counter />);

    await userEvent.press(decrease());

    expect(value()).toHaveTextContent("0");
  });

  it("disables decrease and reset while the value is zero", async () => {
    await render(<Counter />);

    expect(decrease()).toBeDisabled();
    expect(reset()).toBeDisabled();
    expect(increase()).not.toBeDisabled();
  });

  it("enables decrease and reset as soon as the value leaves zero", async () => {
    await render(<Counter />);

    await userEvent.press(increase());

    expect(decrease()).not.toBeDisabled();
    expect(reset()).not.toBeDisabled();
  });

  it("returns to zero when reset", async () => {
    await render(<Counter />);

    await userEvent.press(increase());
    await userEvent.press(increase());
    await userEvent.press(reset());

    expect(value()).toHaveTextContent("0");
  });

  it("drops no taps across ten in a row", async () => {
    // A stale-state update would land on 1 here rather than 10.
    await render(<Counter />);

    for (let tap = 0; tap < 10; tap += 1) {
      await userEvent.press(increase());
    }

    expect(value()).toHaveTextContent("10");
  });

  it("marks its title as a heading, not merely large text", async () => {
    await render(<Counter />);
    expect(screen.getByRole("header", { name: "Counter" })).toBeTruthy();
  });

  it("announces the current count to a screen reader", async () => {
    await render(<Counter />);

    await userEvent.press(increase());

    expect(screen.getByLabelText("Count: 1")).toBeTruthy();
  });
});
