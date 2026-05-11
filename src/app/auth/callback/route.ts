import { NextResponse } from "next/server";
import { getSafePostAuthRedirectPath } from "@/lib/auth-flow";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const safeNext = getSafePostAuthRedirectPath(
    requestUrl.searchParams.get("next"),
  );
  const redirectTo = new URL(safeNext, requestUrl.origin);

  if (code) {
    const supabase = await createClient();
    const { error } = supabase
      ? await supabase.auth.exchangeCodeForSession(code)
      : { error: new Error("Supabase is not configured.") };

    if (error) {
      redirectTo.searchParams.set("auth_error", error.message);
    }
  }

  return NextResponse.redirect(redirectTo);
}
