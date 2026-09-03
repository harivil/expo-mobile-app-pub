import { render, screen, userEvent } from "@testing-library/react-native";

import { Profile } from "./index";
import { placeholderProfile } from "./placeholder-profile";

describe("Profile", () => {
  it("marks the page as a sample rather than real data", async () => {
    // The compliance-carrying assertion: nothing on this page should read as a real person.
    await render(<Profile />);
    expect(screen.getByTestId("profile-marker")).toHaveTextContent(
      placeholderProfile.marker,
    );
  });

  it("shows the placeholder name and handle", async () => {
    await render(<Profile />);
    expect(screen.getByTestId("profile-name")).toHaveTextContent("Alex Jordan");
    expect(screen.getByTestId("profile-handle")).toHaveTextContent("@alexjordan");
  });

  it("shows the initials of the name in the avatar", async () => {
    await render(<Profile />);
    // `includeHiddenElements` because the avatar is deliberately `aria-hidden`: it is the name
    // rendered as glyphs, so announcing "A J" right before "Alex Jordan" is noise. It is still
    // addressable by testID for the flows, which is what this asserts.
    expect(
      screen.getByTestId("profile-avatar", { includeHiddenElements: true }),
    ).toHaveTextContent("AJ");
  });

  it("shows both account rows, label and value", async () => {
    await render(<Profile />);

    expect(screen.getByText("Member since")).toBeTruthy();
    expect(screen.getByTestId("profile-row-value-member-since")).toHaveTextContent(
      "March 2026",
    );

    expect(screen.getByText("Plan")).toBeTruthy();
    expect(screen.getByTestId("profile-row-value-plan")).toHaveTextContent("Standard");
  });

  it("titles the page as a heading, not merely large text", async () => {
    await render(<Profile />);
    expect(screen.getByRole("header", { name: "Profile" })).toBeTruthy();
  });

  it("shows a disabled sign out control that explains itself", async () => {
    await render(<Profile />);

    expect(screen.getByRole("button", { name: "Sign out" })).toBeDisabled();
    expect(screen.getByText("Sign-in isn't part of this app yet.")).toBeTruthy();
  });

  it("leaves the page unchanged when the disabled sign out is pressed", async () => {
    await render(<Profile />);

    await userEvent.press(screen.getByRole("button", { name: "Sign out" }));

    // Asserting on observable page state rather than re-asserting `toBeDisabled()`. The control
    // is rendered with no `onPress` at all, so "fires nothing" is structural — what is worth
    // checking is that pressing it neither throws nor navigates away from the profile.
    expect(screen.getByTestId("profile-name")).toHaveTextContent("Alex Jordan");
    expect(screen.getByText("Sign-in isn't part of this app yet.")).toBeTruthy();
  });
});
