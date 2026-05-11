import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getOrCreateProfile, type Profile } from "./user-memory";

export type AnonymousBootstrapClient = Pick<SupabaseClient, "auth" | "from">;

const ANONYMOUS_BOOTSTRAP_ERROR_COPY =
  "未能完成匿名開始，雲端記憶仍然關閉。Anonymous start could not be completed, so cloud memory is still off.";

const ANONYMOUS_BOOTSTRAP_ROLLBACK_COPY =
  "系統已嘗試清理這次臨時登入，但未能確認是否完成。請重新整理頁面後再試。The app tried to roll back the temporary sign-in but could not confirm cleanup. Please refresh and try again.";

export async function bootstrapAnonymousSession(
  user: User,
  supabase: AnonymousBootstrapClient,
): Promise<Profile> {
  try {
    return await getOrCreateProfile(user, supabase);
  } catch (error) {
    const rollbackError = await rollbackAnonymousStart(supabase);
    throw new Error(
      buildAnonymousBootstrapErrorMessage(
        getErrorMessage(error),
        rollbackError,
      ),
    );
  }
}

async function rollbackAnonymousStart(
  supabase: AnonymousBootstrapClient,
): Promise<string | null> {
  try {
    const { error } = await supabase.auth.signOut();
    return error ? error.message : null;
  } catch (error) {
    return getErrorMessage(error);
  }
}

function buildAnonymousBootstrapErrorMessage(
  profileError: string,
  rollbackError: string | null,
) {
  const details = `${ANONYMOUS_BOOTSTRAP_ERROR_COPY} ${profileError}`;

  if (!rollbackError) {
    return details;
  }

  return `${details} ${ANONYMOUS_BOOTSTRAP_ROLLBACK_COPY} ${rollbackError}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error.";
}
