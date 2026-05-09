import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getAnonymousStartState } from "./auth-flow";
import {
  sanitizePreferencesForSummary,
  saveRecommendation,
  shouldIncludeInMemorySummary,
  type MemoryClient,
} from "./user-memory";

describe("auth and memory safety", () => {
  it("allows anonymous navigation start without an email", () => {
    const state = getAnonymousStartState("");

    expect(state.canStart).toBe(true);
    expect(state.requiresEmail).toBe(false);
  });

  it("requires a user id before saving a recommendation", async () => {
    await expect(
      saveRecommendation(
        "",
        null,
        {
          recommendation_type: "department",
          summary_zh: "可先看普通科。",
        },
        {} as MemoryClient,
      ),
    ).rejects.toThrow("userId is required");
  });

  it("redacts diagnosis-like inferred memory from summaries", () => {
    const inferredText = "用戶診斷為哮喘";

    expect(shouldIncludeInMemorySummary(inferredText, "inferred_with_confirmation")).toBe(false);
    expect(shouldIncludeInMemorySummary(inferredText, "explicit_user_choice")).toBe(true);

    const [summary] = sanitizePreferencesForSummary([
      {
        preference_key: "care_context",
        preference_value: { note: inferredText },
        source: "inferred_with_confirmation",
      },
    ]);

    expect(summary.redacted).toBe(true);
    expect(summary.value).toBe("[sensitive medical detail hidden]");
  });

  it("uses RLS policies that restrict saved recommendations to the current user", () => {
    const migration = readFileSync(
      new URL("../../supabase/migrations/001_auth_memory.sql", import.meta.url),
      "utf8",
    );

    expect(migration).toContain("alter table public.saved_recommendations enable row level security");
    expect(migration).toContain("create policy saved_recommendations_select_own");
    expect(migration).toMatch(/using\s*\(\s*user_id\s*=\s*\(select auth\.uid\(\)\)\s*\)/i);
    expect(migration).toContain("create policy saved_recommendations_insert_own");
    expect(migration).toMatch(/with check\s*\([\s\S]*user_id\s*=\s*\(select auth\.uid\(\)\)/i);
    expect(migration).not.toMatch(/grant\s+select[\s\S]*\s+to\s+anon/i);
  });
});
