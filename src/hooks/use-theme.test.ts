import { renderHook } from "@testing-library/react-native";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTheme } from "@/hooks/use-theme";
import { Colors } from "@/theme";

// Mock this app's own seam, not react-native's hook — that is what keeps the test coupled to
// the app rather than to a React Native version.
jest.mock("@/hooks/use-color-scheme");
const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

describe("useTheme", () => {
  it("returns the light palette when the system is light", async () => {
    mockUseColorScheme.mockReturnValue("light");
    const { result } = await renderHook(() => useTheme());
    expect(result.current).toBe(Colors.light);
  });

  it("returns the dark palette when the system is dark", async () => {
    mockUseColorScheme.mockReturnValue("dark");
    const { result } = await renderHook(() => useTheme());
    expect(result.current).toBe(Colors.dark);
  });
});
