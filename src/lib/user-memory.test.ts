import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getAnonymousStartState,
  getSafePostAuthRedirectPath,
} from "./auth-flow";
import {
  clearSession,
  clearUserMemory,
  getMemorySavePreference,
  getSafeConversationSessionTitle,
  sanitizeConversationMessageContent,
  sanitizePreferencesForSummary,
  saveRecommendation,
  setMemorySavePreference,
  shouldIncludeInMemorySummary,
  type MemoryClient,
} from "./user-memory";

describe("auth and memory safety", () => {
  it("allows anonymous navigation start without an email", () => {
    const state = getAnonymousStartState("");

    expect(state.canStart).toBe(true);
    expect(state.requiresEmail).toBe(false);
  });

  it("keeps safe post-auth redirects inside the app", () => {
    expect(getSafePostAuthRedirectPath("/dashboard?tab=memory#consent")).toBe(
      "/dashboard?tab=memory#consent",
    );
    expect(getSafePostAuthRedirectPath(" https://evil.example/steal ")).toBe(
      "/",
    );
    expect(getSafePostAuthRedirectPath("//evil.example/steal")).toBe("/");
    expect(getSafePostAuthRedirectPath(String.raw`/\\evil.example/steal`)).toBe(
      "/",
    );
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

  it("defaults memory saving to off until the user explicitly opts in", async () => {
    const { client } = createMemoryPreferenceClient();

    await expect(getMemorySavePreference("user-1", client)).resolves.toBeNull();
  });

  it("persists memory save opt-in with a matching consent event", async () => {
    const { client, calls } = createMemoryPreferenceClient();

    await expect(setMemorySavePreference("user-1", true, client)).resolves.toBe(true);
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "user_preferences",
          payload: expect.objectContaining({
            user_id: "user-1",
            preference_key: "memory_save_enabled",
            preference_value: true,
            source: "explicit_user_choice",
          }),
        }),
        expect.objectContaining({
          table: "consent_events",
          payload: expect.objectContaining({
            user_id: "user-1",
            consent_type: "save_memory",
            granted: true,
          }),
        }),
      ]),
    );
  });

  it("removes saved recommendations before deleting the conversation session", async () => {
    const { client, calls } = createMemoryClearClient();

    await expect(clearSession("session-1", "user-1", client)).resolves.toBeUndefined();
    expect(calls).toEqual([
      {
        table: "saved_recommendations",
        filters: [
          ["session_id", "session-1"],
          ["user_id", "user-1"],
        ],
      },
      {
        table: "conversation_sessions",
        filters: [
          ["id", "session-1"],
          ["user_id", "user-1"],
        ],
      },
    ]);
  });

  it("clears anonymous user-owned memory before sign-out completes", async () => {
    const { client, calls } = createMemoryPurgeClient();

    await expect(clearUserMemory("user-1", client)).resolves.toBeUndefined();
    expect(calls).toEqual([
      {
        table: "saved_recommendations",
        filters: [["user_id", "user-1"]],
      },
      {
        table: "conversation_sessions",
        filters: [["user_id", "user-1"]],
      },
      {
        table: "user_preferences",
        filters: [["user_id", "user-1"]],
      },
      {
        table: "household_members",
        filters: [["user_id", "user-1"]],
      },
      {
        table: "consent_events",
        filters: [["user_id", "user-1"]],
      },
      {
        table: "profiles",
        filters: [["id", "user-1"]],
      },
    ]);
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

  it("does not store raw user free-text in saved conversation memory", () => {
    const rawInput = "我胸口痛、氣促，而且昨晚突然暈低。";
    const safeContent = sanitizeConversationMessageContent(
      "user",
      rawInput,
      "emergency",
    );

    expect(safeContent).not.toContain("胸口痛");
    expect(safeContent).not.toContain("氣促");
    expect(safeContent).toContain("不會保存");
  });

  it("keeps assistant summaries but replaces raw session titles", () => {
    const assistantSummary = "緊急醫療問題：請立即致電 999 或前往急症室。";

    expect(
      sanitizeConversationMessageContent(
        "assistant",
        assistantSummary,
        "emergency",
      ),
    ).toBe(assistantSummary);
    expect(getSafeConversationSessionTitle("symptom")).toBe(
      "症狀導航紀錄 / Symptom navigation session",
    );
  });

  it("uses RLS policies so users cannot access another user's saved recommendations", () => {
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

function createMemoryPreferenceClient(preferenceValue?: boolean | null) {
  const calls: Array<{ table: string; payload: Record<string, unknown> }> = [];

  const client = {
    from(table: string) {
      if (table === "user_preferences") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({
            data:
              preferenceValue === undefined
                ? null
                : { preference_value: preferenceValue },
            error: null,
          }),
          upsert(payload: Record<string, unknown>) {
            calls.push({ table, payload });

            return {
              select() {
                return {
                  single: async () => ({ data: payload, error: null }),
                };
              },
            };
          },
        };
      }

      if (table === "consent_events") {
        return {
          insert(payload: Record<string, unknown>) {
            calls.push({ table, payload });

            return {
              select() {
                return {
                  single: async () => ({ data: payload, error: null }),
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as MemoryClient;

  return { client, calls };
}

function createMemoryClearClient() {
  const calls: Array<{
    table: string;
    filters: Array<[string, string]>;
  }> = [];

  const client = {
    from(table: string) {
      if (table !== "saved_recommendations" && table !== "conversation_sessions") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        delete() {
          const call = {
            table,
            filters: [] as Array<[string, string]>,
          };
          calls.push(call);

          return {
            eq(column: string, value: string) {
              call.filters.push([column, value]);
              return this;
            },
            then(resolve: (value: { error: null }) => unknown) {
              return Promise.resolve(resolve({ error: null }));
            },
          };
        },
      };
    },
  } as unknown as MemoryClient;

  return { client, calls };
}

function createMemoryPurgeClient() {
  const calls: Array<{
    table: string;
    filters: Array<[string, string]>;
  }> = [];
  const allowedTables = new Set([
    "saved_recommendations",
    "conversation_sessions",
    "user_preferences",
    "household_members",
    "consent_events",
    "profiles",
  ]);

  const client = {
    from(table: string) {
      if (!allowedTables.has(table)) {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        delete() {
          const call = {
            table,
            filters: [] as Array<[string, string]>,
          };
          calls.push(call);

          return {
            eq(column: string, value: string) {
              call.filters.push([column, value]);
              return this;
            },
            then(resolve: (value: { error: null }) => unknown) {
              return Promise.resolve(resolve({ error: null }));
            },
          };
        },
      };
    },
  } as unknown as MemoryClient;

  return { client, calls };
}
