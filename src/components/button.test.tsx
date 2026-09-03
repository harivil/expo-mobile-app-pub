import { render, screen, userEvent } from "@testing-library/react-native";

import { Button } from "./button";
import { MinTapTarget } from "@/theme";

describe("Button", () => {
  it("shows the label it is given", async () => {
    await render(<Button label="Increase" onPress={jest.fn()} />);
    expect(screen.getByText("Increase")).toBeTruthy();
  });

  it("calls onPress when tapped", async () => {
    const onPress = jest.fn();
    await render(<Button label="Increase" onPress={onPress} />);

    await userEvent.press(screen.getByRole("button", { name: "Increase" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress while disabled", async () => {
    const onPress = jest.fn();
    await render(<Button label="Reset" disabled onPress={onPress} />);

    await userEvent.press(screen.getByRole("button", { name: "Reset" }));

    expect(onPress).not.toHaveBeenCalled();
  });

  it("announces its disabled state to a screen reader", async () => {
    // Opacity alone is invisible to anyone not looking at the screen, so the state matters as
    // much as the styling.
    await render(<Button label="Reset" disabled onPress={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
  });

  it("is enabled and announced as such by default", async () => {
    await render(<Button label="Increase" onPress={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Increase" })).not.toBeDisabled();
  });

  it("is never smaller than the minimum tap target", async () => {
    // Asserted here rather than at every call site — this is the guarantee that lets a screen
    // add a button without measuring it.
    await render(<Button label="Reset" onPress={jest.fn()} />);

    expect(screen.getByRole("button", { name: "Reset" })).toHaveStyle({
      minHeight: MinTapTarget,
      minWidth: MinTapTarget,
    });
  });
});
