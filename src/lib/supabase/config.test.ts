import { describe, expect, it } from "vitest";
import {
  getSupabasePublicConfig,
  hasSupabasePublicConfig,
} from "./config";

describe("supabase public config", () => {
  it("allows local development to run without Supabase env", () => {
    const env = {
      NODE_ENV: "development",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
    } as NodeJS.ProcessEnv;

    expect(hasSupabasePublicConfig(env)).toBe(false);
    expect(getSupabasePublicConfig(env)).toBeNull();
  });

  it("fails clearly in production when Supabase env is missing", () => {
    const env = {
      NODE_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
    } as NodeJS.ProcessEnv;

    expect(() => getSupabasePublicConfig(env)).toThrow(
      "Missing required Supabase environment variables in production",
    );
  });

  it("returns the trimmed public config when both variables exist", () => {
    const env = {
      NODE_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: " https://example.supabase.co ",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: " publishable-key ",
    } as NodeJS.ProcessEnv;

    expect(getSupabasePublicConfig(env)).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "publishable-key",
    });
  });
});
