import { describe, expect, it } from "vitest";
import type { User } from "@supabase/supabase-js";
import {
  bootstrapAnonymousSession,
  type AnonymousBootstrapClient,
} from "./auth-session-bootstrap";

const anonymousUser = {
  id: "user-1",
  is_anonymous: true,
  user_metadata: {},
} as User;

describe("anonymous auth bootstrap", () => {
  it("returns the created profile when anonymous start bootstrap succeeds", async () => {
    const signOutCalls: string[] = [];
    const client = createAnonymousBootstrapClient({
      profile: {
        id: "user-1",
        display_name: null,
        preferred_language: "zh-Hant",
        care_preference: null,
        location_area: null,
        is_anonymous: true,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      signOutCalls,
    });

    await expect(bootstrapAnonymousSession(anonymousUser, client)).resolves.toEqual(
      expect.objectContaining({ id: "user-1", is_anonymous: true }),
    );
    expect(signOutCalls).toHaveLength(0);
  });

  it("rolls back the temporary anonymous sign-in when profile bootstrap fails", async () => {
    const signOutCalls: string[] = [];
    const client = createAnonymousBootstrapClient({
      profileError: "Could not create or fetch profile: write failed",
      signOutCalls,
    });

    await expect(
      bootstrapAnonymousSession(anonymousUser, client),
    ).rejects.toThrow(
      "Anonymous start could not be completed, so cloud memory is still off.",
    );
    expect(signOutCalls).toEqual(["signOut"]);
  });

  it("surfaces cleanup guidance when rollback also fails", async () => {
    const signOutCalls: string[] = [];
    const client = createAnonymousBootstrapClient({
      profileError: "Could not create or fetch profile: write failed",
      signOutCalls,
      signOutError: "network unavailable",
    });

    await expect(
      bootstrapAnonymousSession(anonymousUser, client),
    ).rejects.toThrow("Please refresh and try again.");
    expect(signOutCalls).toEqual(["signOut"]);
  });
});

function createAnonymousBootstrapClient({
  profile,
  profileError,
  signOutCalls,
  signOutError,
}: {
  profile?: Record<string, unknown>;
  profileError?: string;
  signOutCalls: string[];
  signOutError?: string;
}) {
  return {
    auth: {
      signOut: async () => {
        signOutCalls.push("signOut");
        return {
          error: signOutError ? { message: signOutError } : null,
        };
      },
    },
    from(table: string) {
      if (table !== "profiles") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        upsert() {
          return {
            select() {
              return {
                single: async () => ({
                  data: profile ?? null,
                  error: profileError ? { message: profileError } : null,
                }),
              };
            },
          };
        },
      };
    },
  } as unknown as AnonymousBootstrapClient;
}
