const MAX_USER_SAFE_ERROR_DETAIL_LENGTH = 120;
const UNSAFE_USER_ERROR_DETAIL_PATTERN =
  /supabase|row[- ]level security|\brls\b|postgres|\bsql\b|schema|relation|column|constraint|auth\.users|jwt|permission|failed to fetch|network error|stack|trace|internal server error|\b500\b/iu;

export function getSafeUserVisibleErrorMessage(
  error: unknown,
  fallbackMessage: string,
) {
  const detail = normalizeUserVisibleErrorDetail(error);

  if (!detail) {
    return fallbackMessage;
  }

  if (
    detail.length > MAX_USER_SAFE_ERROR_DETAIL_LENGTH ||
    UNSAFE_USER_ERROR_DETAIL_PATTERN.test(detail)
  ) {
    return fallbackMessage;
  }

  return `${fallbackMessage} ${detail}`;
}

function normalizeUserVisibleErrorDetail(error: unknown) {
  const detail =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : null;

  if (!detail) {
    return null;
  }

  const normalized = detail.replace(/\s+/g, " ").trim();

  return normalized.length > 0 ? normalized : null;
}
