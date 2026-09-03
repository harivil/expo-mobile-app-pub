import { render, screen } from "@testing-library/react-native";

import { ThemedView } from "./themed-view";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/theme";

jest.mock("@/hooks/use-color-scheme");
const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

describe("ThemedView", () => {
  beforeEach(() => mockUseColorScheme.mockReturnValue("light"));

  it("paints the page background by default", async () => {
    await render(<ThemedView testID="block" />);
    expect(screen.getByTestId("block")).toHaveStyle({
      backgroundColor: Colors.light.background,
    });
  });

  it("paints the surface role when asked", async () => {
    await render(<ThemedView testID="block" tone="surface" />);
    expect(screen.getByTestId("block")).toHaveStyle({
      backgroundColor: Colors.light.surface,
    });
  });

  it("follows the active colour scheme", async () => {
    mockUseColorScheme.mockReturnValue("dark");
    await render(<ThemedView testID="block" />);
    expect(screen.getByTestId("block")).toHaveStyle({
      backgroundColor: Colors.dark.background,
    });
  });

  it("lets a caller override the background", async () => {
    // `style` is applied last, so a call site always wins.
    await render(<ThemedView testID="block" style={{ backgroundColor: "#ff0000" }} />);
    expect(screen.getByTestId("block")).toHaveStyle({ backgroundColor: "#ff0000" });
  });
});
