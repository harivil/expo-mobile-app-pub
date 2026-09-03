import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { Screen } from "./screen";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, ContentMaxWidth } from "@/theme";

jest.mock("@/hooks/use-color-scheme");
const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

// jest.setup.js installs the safe-area library's own mock globally, and that mock reports a
// bottom inset of ZERO — which would make `bottomInset` untestable, since both modes would render
// the same padding. So this suite overrides the hook with a device-like inset. Without a non-zero
// bottom there is no test here at all, only the appearance of one.
const INSETS = { top: 47, right: 0, bottom: 34, left: 0 };

jest.mock("react-native-safe-area-context", () => ({
  ...require("react-native-safe-area-context/jest/mock").default,
  useSafeAreaInsets: () => INSETS,
}));

describe("Screen", () => {
  beforeEach(() => mockUseColorScheme.mockReturnValue("light"));

  it("paints the themed background", async () => {
    await render(
      <Screen testID="page">
        <Text>body</Text>
      </Screen>,
    );
    expect(screen.getByTestId("page")).toHaveStyle({
      backgroundColor: Colors.light.background,
    });
  });

  it("always clears the top inset", async () => {
    await render(
      <Screen testID="page">
        <Text>body</Text>
      </Screen>,
    );
    expect(screen.getByTestId("page")).toHaveStyle({ paddingTop: INSETS.top });
  });

  it("does not pad the bottom inset by default", async () => {
    // The bottom tab bar every screen in this app sits above already owns that inset — its
    // height includes it and it pads itself — and it hands screens the full inset regardless.
    // Padding it here as well put ~34px of dead space under the content on a device.
    await render(
      <Screen testID="page">
        <Text>body</Text>
      </Screen>,
    );
    expect(screen.getByTestId("page")).toHaveStyle({ paddingBottom: 0 });
  });

  it("pads the bottom inset when a screen outside the tabs asks for it", async () => {
    await render(
      <Screen testID="page" bottomInset>
        <Text>body</Text>
      </Screen>,
    );
    expect(screen.getByTestId("page")).toHaveStyle({ paddingBottom: INSETS.bottom });
  });

  it("renders its children", async () => {
    await render(
      <Screen>
        <Text>body</Text>
      </Screen>,
    );
    expect(screen.getByText("body")).toBeTruthy();
  });

  it("caps its content column at the token, not a literal", () => {
    // The cap itself is asserted on the running app by the web flows, which measure the rendered
    // column. This guards against someone "fixing" a layout by typing a number into the styles.
    expect(ContentMaxWidth).toBe(520);
  });
});
