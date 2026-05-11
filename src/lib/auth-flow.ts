export const GOOGLE_OAUTH_ENABLED = false;

const DEFAULT_POST_AUTH_REDIRECT = "/";
const SAFE_REDIRECT_ORIGIN = "https://health-os.local";
const DEFAULT_AUTH_CALLBACK_ERROR =
  "登入未完成，請再試一次或要求新的登入連結。Authentication could not be completed. Please try again or request a new sign-in link.";
const DEFAULT_AUTH_CALLBACK_MISSING_CODE_ERROR =
  "登入連結無效、已過期或缺少驗證資料。Authentication callback link is invalid, expired, or missing verification data.";
const MAX_AUTH_CALLBACK_ERROR_LENGTH = 240;

export const anonymousModeCopy = {
  requiresEmail: false,
  zh:
    "你可以匿名使用本服務。匿名模式適合初步查詢；如你之後登出匿名帳戶，已保存的匿名雲端紀錄會一併清除。若你清除瀏覽器資料或更換裝置而未先升級帳戶，亦可能無法再次取回紀錄。建立帳戶可保存偏好、家庭成員資料及保險分析。",
  en:
    "You can use this service anonymously. Anonymous mode is suitable for initial guidance; if you later sign out of an anonymous account, its saved cloud memory is cleared as well. If you clear browser data or change device before upgrading, you may not be able to recover your history. Creating an account lets you save preferences, household profiles, and insurance assessments.",
};

export function getAnonymousStartState(email: string) {
  return {
    canStart: true,
    requiresEmail: anonymousModeCopy.requiresEmail,
    email: email.trim(),
  };
}

export function getSafePostAuthRedirectPath(next: string | null | undefined) {
  if (typeof next !== "string") {
    return DEFAULT_POST_AUTH_REDIRECT;
  }

  const trimmed = next.trim();

  if (
    trimmed.length === 0 ||
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\")
  ) {
    return DEFAULT_POST_AUTH_REDIRECT;
  }

  try {
    const redirectUrl = new URL(trimmed, SAFE_REDIRECT_ORIGIN);

    if (redirectUrl.origin !== SAFE_REDIRECT_ORIGIN) {
      return DEFAULT_POST_AUTH_REDIRECT;
    }

    return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
  } catch {
    return DEFAULT_POST_AUTH_REDIRECT;
  }
}

export function getAuthCallbackFailureReason(searchParams: URLSearchParams) {
  const providerError =
    searchParams.get("error_description") ?? searchParams.get("error");

  if (typeof providerError === "string" && providerError.trim().length > 0) {
    return providerError;
  }

  return searchParams.get("code")
    ? null
    : DEFAULT_AUTH_CALLBACK_MISSING_CODE_ERROR;
}

export function getSafeAuthCallbackErrorMessage(
  error: string | null | undefined,
) {
  if (typeof error !== "string") {
    return null;
  }

  const normalized = error.replace(/\s+/g, " ").trim();

  if (normalized.length === 0) {
    return null;
  }

  const truncated = normalized.slice(0, MAX_AUTH_CALLBACK_ERROR_LENGTH);
  const detail =
    normalized.length > MAX_AUTH_CALLBACK_ERROR_LENGTH
      ? `${truncated}...`
      : truncated;

  return `${DEFAULT_AUTH_CALLBACK_ERROR} ${detail}`;
}
