const REQUIRED_SUPABASE_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
] as const;

export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

export function hasSupabasePublicConfig(env: NodeJS.ProcessEnv = process.env) {
  return getMissingSupabasePublicEnvVars(env).length === 0;
}

export function getSupabasePublicConfig(
  env: NodeJS.ProcessEnv = process.env,
): SupabasePublicConfig | null {
  const missing = getMissingSupabasePublicEnvVars(env);

  if (missing.length === 0) {
    return {
      url: env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
      publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!.trim(),
    };
  }

  if (env.NODE_ENV === "production") {
    throw new Error(
      `Missing required Supabase environment variables in production: ${missing.join(", ")}. Configure Supabase before deploying AI Health Guide / 智健導航.`,
    );
  }

  return null;
}

function getMissingSupabasePublicEnvVars(
  env: NodeJS.ProcessEnv,
): string[] {
  return REQUIRED_SUPABASE_ENV_VARS.filter((name) => {
    const value = env[name];
    return typeof value !== "string" || value.trim().length === 0;
  });
}
