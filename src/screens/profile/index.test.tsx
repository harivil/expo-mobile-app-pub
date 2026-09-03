import { render, screen, userEvent } from "@testing-library/react-native";

import { Profile } from "./index";
import { placeholderProfile } from "./placeholder-profile";

describe("Profile", () => {
  it("marks the page as a sample rather than real data", async () => {
    // The compliance-carrying assertion: nothing on this page should read as a real person.
    await render(<Profile />);
    expect(screen.getByText(placeholderProfile.marker)).toBeTruthy();
  });

  it("shows the placeholder name and handle", async () => {
    await render(<Profile />);
    expect(screen.getByTestId("profile-name")).toHaveTextContent("Alex Jordan");
    expect(screen.getByTestId("profile-handle")).toHaveTextContent("@alexjordan");
  });

  it("shows the initials of the name in the avatar", async () => {
    await render(<Profile />);
    expect(screen.getByTestId("profile-avatar")).toHaveTextContent("AJ");
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

  it("does nothing when the disabled sign out is pressed", async () => {
    await render(<Profile />);

    // A control that silently does nothing would be worse than no control; this proves it is
    // inert AND announced, rather than inert and looking live.
    await userEvent.press(screen.getByRole("button", { name: "Sign out" }));

    expect(screen.getByRole("button", { name: "Sign out" })).toBeDisabled();
  });
});
