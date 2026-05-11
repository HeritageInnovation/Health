import { describe, expect, it } from "vitest";
import {
  getAuthCallbackFailureReason,
  getSafeAuthCallbackErrorMessage,
} from "./auth-flow";

describe("auth callback errors", () => {
  it("preserves missing-code guidance", () => {
    const searchParams = new URLSearchParams();

    expect(
      getSafeAuthCallbackErrorMessage(getAuthCallbackFailureReason(searchParams)),
    ).toContain("Authentication callback link is invalid");
  });

  it("preserves short user-safe callback details", () => {
    expect(
      getSafeAuthCallbackErrorMessage(
        "Magic link expired, please request a new one.",
      ),
    ).toContain("Magic link expired, please request a new one.");
  });

  it("suppresses backend callback details", () => {
    const message = getSafeAuthCallbackErrorMessage(
      "new row violates row-level security policy for table profiles",
    );

    expect(message).not.toContain("row-level security");
    expect(message).toContain("Authentication could not be completed");
  });

  it("is idempotent for already safe callback messages", () => {
    const safeMessage = getSafeAuthCallbackErrorMessage(
      "Magic link expired, please request a new one.",
    );

    expect(getSafeAuthCallbackErrorMessage(safeMessage)).toBe(safeMessage);
  });
});
