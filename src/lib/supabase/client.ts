import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig, hasSupabasePublicConfig } from "./config";

let browserClient: SupabaseClient | null = null;

export function hasSupabaseBrowserConfig() {
  return hasSupabasePublicConfig();
}

export function getSupabaseBrowserClient() {
  const config = getSupabasePublicConfig();

  if (!config) {
    return null;
  }

  if (!browserClient) {
    browserClient = createBrowserClient(
      config.url,
      config.publishableKey,
    );
  }

  return browserClient;
}

export function getAuthRedirectTo(path = "/auth/callback") {
  if (typeof window === "undefined") {
    return undefined;
  }

  return `${window.location.origin}${path}`;
}
