import { narrowColorScheme } from "./use-color-scheme";

describe("narrowColorScheme", () => {
  it("returns dark when the system reports dark", () => {
    expect(narrowColorScheme("dark")).toBe("dark");
  });

  it("returns light when the system reports light", () => {
    expect(narrowColorScheme("light")).toBe("light");
  });

  it("falls back to light when the system has reported nothing yet", () => {
    // This is the case the hook exists for: unnarrowed, each of these indexes the palette to
    // undefined and paints an unstyled screen.
    expect(narrowColorScheme(null)).toBe("light");
    expect(narrowColorScheme(undefined)).toBe("light");
  });

  it('falls back to light on React Native\'s third value, "unspecified"', () => {
    // Not hypothetical — it is in the real return type of react-native's useColorScheme, and
    // tsc caught its absence here.
    expect(narrowColorScheme("unspecified")).toBe("light");
  });
});
