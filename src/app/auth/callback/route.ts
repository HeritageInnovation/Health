import { NextResponse } from "next/server";
import {
  getAuthCallbackFailureReason,
  getSafeAuthCallbackErrorMessage,
  getSafePostAuthRedirectPath,
} from "@/lib/auth-flow";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const safeNext = getSafePostAuthRedirectPath(
    requestUrl.searchParams.get("next"),
  );
  const redirectTo = new URL(safeNext, requestUrl.origin);
  const callbackError = getSafeAuthCallbackErrorMessage(
    getAuthCallbackFailureReason(requestUrl.searchParams),
  );

  if (callbackError) {
    redirectTo.searchParams.set("auth_error", callbackError);
    return NextResponse.redirect(redirectTo);
  }

  const supabase = await createClient();
  const { error } = supabase
    ? await supabase.auth.exchangeCodeForSession(code!)
    : { error: new Error("Supabase is not configured.") };

  if (error) {
    redirectTo.searchParams.set(
      "auth_error",
      getSafeAuthCallbackErrorMessage(error.message) ?? error.message,
    );
  }

  return NextResponse.redirect(redirectTo);
}
