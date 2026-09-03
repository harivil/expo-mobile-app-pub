/**
 * FICTIONAL data. Every value here is invented.
 *
 * The module is named, and commented, so that nobody can mistake it for a real record or wire a
 * real one into it by accident. If this app ever shows a real person's details, this file is
 * deleted rather than edited — a real profile is a personal-data feature with a privacy review, a
 * storage decision, and the `.semgrep.yml` rules about personal data reaching logs and URLs. None
 * of that applies to a constant, and none of it should be inherited by pretending this is a
 * "default value".
 *
 * No real name, email address, date of birth, account number, payment detail or health
 * information belongs in this repo.
 */
export type PlaceholderProfile = {
  /** Shown verbatim so it is obvious at a glance that the page is not real data. */
  marker: string;
  name: string;
  handle: string;
  rows: { label: string; value: string; id: string }[];
  signOutCaption: string;
};

export const placeholderProfile: PlaceholderProfile = {
  marker: "Sample profile",
  name: "Alex Jordan",
  handle: "@alexjordan",
  rows: [
    { id: "member-since", label: "Member since", value: "March 2026" },
    { id: "plan", label: "Plan", value: "Standard" },
  ],
  signOutCaption: "Sign-in isn't part of this app yet.",
};

/**
 * First letters of the first two words of a name. Extracted so the avatar's contents are testable
 * without rendering, and so a one-word or empty name cannot produce a broken circle.
 */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
