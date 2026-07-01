"use client";

import { Mail, ShieldCheck, UserRoundPlus } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  GOOGLE_OAUTH_ENABLED,
  anonymousModeCopy,
  getAnonymousStartState,
  getSafeAuthCallbackErrorMessage,
} from "@/lib/auth-flow";
import { bootstrapAnonymousSession } from "@/lib/auth-session-bootstrap";
import { getAuthRedirectTo } from "@/lib/supabase/client";
import { getSafeUserVisibleErrorMessage } from "@/lib/user-visible-error";
import type { Profile } from "@/lib/user-memory";
import styles from "@/components/navigation-workspace.module.css";

type AuthPanelProps = {
  supabase: SupabaseClient | null;
  user: User | null;
  variant?: "start" | "upgrade";
  onUserReady: (user: User) => void;
  onProfileReady: (profile: Profile) => void;
};

export function AuthPanel({
  supabase,
  user,
  variant = "start",
  onUserReady,
  onProfileReady,
}: AuthPanelProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isUpgrade = variant === "upgrade" || Boolean(user?.is_anonymous);
  const anonymousStart = getAnonymousStartState(email);
  const isDisabled = !supabase || isPending;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    const nextError = getSafeAuthCallbackErrorMessage(
      url.searchParams.get("auth_error"),
    );

    if (!nextError) {
      return;
    }

    setStatus(null);
    setError(nextError);
    url.searchParams.delete("auth_error");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  function startAnonymous() {
    if (!supabase) {
      setError("Supabase 尚未設定。Supabase is not configured yet.");
      return;
    }

    startTransition(async () => {
      setError(null);
      setStatus("正在建立匿名帳戶... Creating anonymous account...");

      const { data, error: signInError } =
        await supabase.auth.signInAnonymously();

      if (signInError || !data.user) {
        setError(
          getSafeUserVisibleErrorMessage(
            signInError,
            "未能建立匿名帳戶。Could not create anonymous account.",
          ),
        );
        setStatus(null);
        return;
      }

      try {
        const profile = await bootstrapAnonymousSession(data.user, supabase);
        onUserReady(data.user);
        onProfileReady(profile);
        setStatus("已匿名開始，可選擇保存今次紀錄。Anonymous mode is ready.");
      } catch (error) {
        setError(
          getSafeUserVisibleErrorMessage(
            error,
            "未能完成匿名開始。Could not finish anonymous start.",
          ),
        );
        setStatus(null);
      }
    });
  }

  function continueWithEmail() {
    if (!supabase) {
      setError("Supabase 尚未設定。Supabase is not configured yet.");
      return;
    }

    if (!email.trim()) {
      setError("請輸入電郵地址。Enter an email address.");
      return;
    }

    startTransition(async () => {
      setError(null);
      setStatus(
        isUpgrade
          ? "正在發送帳戶升級確認電郵... Sending account upgrade email..."
          : "正在發送登入連結... Sending magic link...",
      );

      const redirectTo = getAuthRedirectTo();
      const result =
        isUpgrade && user?.is_anonymous
          ? await supabase.auth.updateUser(
              { email: email.trim() },
              { emailRedirectTo: redirectTo },
            )
          : await supabase.auth.signInWithOtp({
              email: email.trim(),
              options: { emailRedirectTo: redirectTo },
            });

      if (result.error) {
        setError(
          getSafeUserVisibleErrorMessage(
            result.error,
            isUpgrade
              ? "未能發送帳戶升級確認。Could not send the account upgrade confirmation."
              : "未能發送登入連結。Could not send the sign-in link.",
          ),
        );
        setStatus(null);
        return;
      }

      setStatus(
        isUpgrade
          ? "請查看電郵完成升級；如專案未啟用身份連結，系統不會破壞現有匿名紀錄。Check your email to finish upgrading. Existing anonymous history is kept intact."
          : "請查看電郵登入連結。Check your email for the magic link.",
      );
    });
  }

  function continueWithGoogle() {
    if (!supabase || !GOOGLE_OAUTH_ENABLED) {
      return;
    }

    startTransition(async () => {
      const redirectTo = getAuthRedirectTo();
      const result =
        isUpgrade && user?.is_anonymous
          ? await supabase.auth.linkIdentity({
              provider: "google",
              options: { redirectTo },
            })
          : await supabase.auth.signInWithOAuth({
              provider: "google",
              options: { redirectTo },
            });

      if (result.error) {
        setError(
          getSafeUserVisibleErrorMessage(
            result.error,
            isUpgrade
              ? "未能開始 Google 帳戶升級。Could not start the Google account upgrade."
              : "未能開始 Google 登入。Could not start Google sign-in.",
          ),
        );
      }
    });
  }

  return (
    <section className={styles.authPanel} aria-label="Authentication">
      <div className={styles.authHeader}>
        <span className={styles.authIcon}>
          <UserRoundPlus size={18} aria-hidden="true" />
        </span>
        <div>
          <p className={styles.panelKicker}>
            {isUpgrade ? "Account upgrade" : "Optional login"}
          </p>
          <h2>
            {isUpgrade
              ? "保存紀錄並建立帳戶 / Save history and create account"
              : "先用，再決定是否登入 / Use first, log in when ready"}
          </h2>
        </div>
      </div>

      {!supabase ? (
        <p className={styles.authNotice}>
          尚未設定 Supabase public URL / publishable key。你仍可使用導航，但不會保存雲端紀錄。
          Supabase is not configured, so navigation works without cloud memory.
        </p>
      ) : null}

      {!isUpgrade ? (
        <button
          className={styles.primaryAction}
          type="button"
          disabled={isDisabled || !anonymousStart.canStart}
          onClick={startAnonymous}
        >
          匿名開始 / Start anonymously
        </button>
      ) : null}

      <div className={styles.authCopy}>
        <p>{anonymousModeCopy.zh}</p>
        <p>{anonymousModeCopy.en}</p>
      </div>

      <div className={styles.authCopy}>
        <p>
          只會在你同意後保存語言、公私營偏好、保險狀況、家庭背景和已保存建議。不會自動保存未確認診斷、詳細病歷、HKID、完整保單號碼或付款資料。
        </p>
        <p>
          Memory is saved only with consent: language, care preference, insurance context,
          household context, and saved recommendations. Unconfirmed diagnoses,
          detailed medical history, HKID, full policy numbers, and payment details are not
          saved automatically.
        </p>
      </div>

      <label className={styles.authLabel} htmlFor={isUpgrade ? "upgrade-email" : "auth-email"}>
        電郵 / Email
      </label>
      <div className={styles.emailRow}>
        <input
          id={isUpgrade ? "upgrade-email" : "auth-email"}
          className={styles.emailInput}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.com"
        />
        <button
          className={styles.secondaryAction}
          type="button"
          disabled={isDisabled}
          onClick={continueWithEmail}
        >
          <Mail size={16} aria-hidden="true" />
          {isUpgrade ? "升級 / Upgrade" : "使用電郵登入 / Continue with email"}
        </button>
      </div>

      <button
        className={styles.googleAction}
        type="button"
        disabled={isDisabled || !GOOGLE_OAUTH_ENABLED}
        onClick={continueWithGoogle}
      >
        <ShieldCheck size={16} aria-hidden="true" />
        使用 Google 登入 / Continue with Google
        {!GOOGLE_OAUTH_ENABLED ? "（待 Supabase provider 啟用 / disabled）" : ""}
      </button>

      {status ? (
        <p className={styles.successText} role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
