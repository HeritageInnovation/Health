import { describe, expect, it } from "vitest";
import { getSafeUserVisibleErrorMessage } from "./user-visible-error";

describe("user-visible error messages", () => {
  it("preserves short, user-safe auth details", () => {
    const fallback =
      "未能發送登入連結。Could not send the sign-in link.";

    expect(
      getSafeUserVisibleErrorMessage(
        new Error("Magic link expired, please request a new one."),
        fallback,
      ),
    ).toContain("Magic link expired, please request a new one.");
  });

  it("suppresses backend and policy details from user-facing auth errors", () => {
    const fallback =
      "未能完成匿名開始。Could not finish anonymous start.";

    expect(
      getSafeUserVisibleErrorMessage(
        new Error("new row violates row-level security policy for table profiles"),
        fallback,
      ),
    ).toBe(fallback);
  });

  it("suppresses overly long auth error details", () => {
    const fallback =
      "未能開始 Google 登入。Could not start Google sign-in.";

    expect(
      getSafeUserVisibleErrorMessage(new Error("x".repeat(200)), fallback),
    ).toBe(fallback);
  });
});
