import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Recommendation } from "./navigation-engine";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MemoryClient = Pick<SupabaseClient, "from">;

export type Profile = {
  id: string;
  display_name: string | null;
  preferred_language: string;
  care_preference: "public" | "private" | "either" | null;
  location_area: string | null;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
};

export type PreferenceSource =
  | "explicit_user_choice"
  | "inferred_with_confirmation";

export type ConversationMode = "symptom" | "department" | "insurance" | "general";
export type MessageRole = "user" | "assistant" | "system";
export type SafetyLevel = "normal" | "caution" | "emergency";
export type RecommendationType = "department" | "insurance" | "emergency" | "followup";
export type ConsentType =
  | "save_memory"
  | "health_data"
  | "marketing"
  | "adviser_handoff";

export type ConversationSession = {
  id: string;
  user_id: string;
  mode: ConversationMode;
  title: string | null;
  language: string;
  created_at: string;
  updated_at: string;
};

export type SavedRecommendationInput = {
  recommendation_type: RecommendationType;
  summary_zh: string;
  summary_en?: string | null;
  urgency?: string | null;
  department?: string | null;
  insurance_categories?: string[] | null;
  requires_human_review?: boolean;
};

export type MemorySummary = {
  profile: Profile | null;
  preferences: Array<{
    key: string;
    value: Json | "[sensitive medical detail hidden]";
    source: PreferenceSource;
    redacted: boolean;
  }>;
  recentSessions: ConversationSession[];
  savedRecommendations: Array<{
    id: string;
    recommendation_type: RecommendationType;
    summary_zh: string;
    summary_en: string | null;
    urgency: string | null;
    requires_human_review: boolean;
    created_at: string;
  }>;
};

const FORBIDDEN_MEMORY_KEY_TERMS = [
  "diagnosis",
  "diagnose",
  "medical_history",
  "mental_health_crisis",
  "hkid",
  "identity_card",
  "policy_number",
  "full_policy",
  "credit_card",
  "payment_card",
  "card_number",
];

const DIAGNOSIS_LIKE_PATTERNS = [
  /確診/u,
  /診斷/u,
  /患有/u,
  /diagnos(?:is|ed|e)/iu,
  /\bhas\s+(?:cancer|diabetes|depression|asthma|stroke)\b/iu,
];

const SAFE_SESSION_TITLES = {
  symptom: "症狀導航紀錄 / Symptom navigation session",
  department: "科別導航紀錄 / Department routing session",
  insurance: "保險導航紀錄 / Insurance guidance session",
  general: "一般導航紀錄 / General guidance session",
} satisfies Record<ConversationMode, string>;

const SAFE_USER_MESSAGE_BY_LEVEL = {
  normal:
    "已隱藏詳細自由文字內容，只保留本次已同意保存的導航紀錄。Sensitive free-text details were not stored in memory.",
  caution:
    "已隱藏需注意的詳細自由文字內容，只保留本次已同意保存的導航紀錄。Sensitive free-text details were not stored in memory.",
  emergency:
    "緊急自由文字內容不會保存，只保留急症升級結果與已同意保存的紀錄。Emergency free-text details were not stored in memory.",
} satisfies Record<SafetyLevel, string>;

const MEMORY_SAVE_PREFERENCE_KEY = "memory_save_enabled";

export function canRememberPreferenceKey(key: string) {
  const normalizedKey = key.trim().toLowerCase();

  return (
    normalizedKey.length > 0 &&
    !FORBIDDEN_MEMORY_KEY_TERMS.some((term) => normalizedKey.includes(term))
  );
}

export function shouldIncludeInMemorySummary(
  text: string,
  source: PreferenceSource,
) {
  if (source === "explicit_user_choice") {
    return true;
  }

  return !DIAGNOSIS_LIKE_PATTERNS.some((pattern) => pattern.test(text));
}

export function getSafeConversationSessionTitle(mode: ConversationMode) {
  return SAFE_SESSION_TITLES[mode];
}

export function sanitizeConversationMessageContent(
  role: MessageRole,
  content: string,
  safetyLevel: SafetyLevel,
) {
  const trimmedContent = content.trim();

  if (role !== "user") {
    return trimmedContent;
  }

  return SAFE_USER_MESSAGE_BY_LEVEL[safetyLevel];
}

export async function getOrCreateProfile(user: User, supabase: MemoryClient) {
  assertUserId(user.id);

  const profilePayload: Record<string, string | boolean> = {
    id: user.id,
    is_anonymous: Boolean(user.is_anonymous),
  };
  const displayName = getUserDisplayName(user);

  if (displayName) {
    profilePayload.display_name = displayName;
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert(profilePayload, { onConflict: "id" })
    .select("*")
    .single();

  throwIfSupabaseError(error, "create or fetch profile");

  return data as Profile;
}

export async function saveUserPreference(
  userId: string,
  key: string,
  value: Json,
  source: PreferenceSource,
  supabase: MemoryClient,
) {
  assertUserId(userId);

  if (!canRememberPreferenceKey(key)) {
    throw new Error("This preference key is not safe for memory storage.");
  }

  const { data, error } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: userId,
        preference_key: key,
        preference_value: value,
        source,
      },
      { onConflict: "user_id,preference_key" },
    )
    .select("*")
    .single();

  throwIfSupabaseError(error, "save user preference");

  return data;
}

export async function getMemorySavePreference(
  userId: string,
  supabase: MemoryClient,
) {
  assertUserId(userId);

  const { data, error } = await supabase
    .from("user_preferences")
    .select("preference_value")
    .eq("user_id", userId)
    .eq("preference_key", MEMORY_SAVE_PREFERENCE_KEY)
    .maybeSingle();

  throwIfSupabaseError(error, "load memory save preference");

  const value = (data as { preference_value?: Json } | null)?.preference_value;

  return typeof value === "boolean" ? value : null;
}

export async function setMemorySavePreference(
  userId: string,
  enabled: boolean,
  supabase: MemoryClient,
) {
  assertUserId(userId);

  await Promise.all([
    saveUserPreference(
      userId,
      MEMORY_SAVE_PREFERENCE_KEY,
      enabled,
      "explicit_user_choice",
      supabase,
    ),
    recordConsentEvent(userId, "save_memory", enabled, supabase),
  ]);

  return enabled;
}

export async function recordConsentEvent(
  userId: string,
  consentType: ConsentType,
  granted: boolean,
  supabase: MemoryClient,
) {
  assertUserId(userId);

  const { data, error } = await supabase
    .from("consent_events")
    .insert({
      user_id: userId,
      consent_type: consentType,
      granted,
    })
    .select("*")
    .single();

  throwIfSupabaseError(error, "record consent event");

  return data;
}

export async function saveConversationSession(
  userId: string,
  mode: ConversationMode,
  title: string,
  language: string,
  supabase: MemoryClient,
) {
  assertUserId(userId);

  const { data, error } = await supabase
    .from("conversation_sessions")
    .insert({
      user_id: userId,
      mode,
      title: title.trim().length > 0 ? getSafeConversationSessionTitle(mode) : null,
      language,
    })
    .select("*")
    .single();

  throwIfSupabaseError(error, "save conversation session");

  return data as ConversationSession;
}

export async function saveConversationMessage(
  sessionId: string,
  userId: string,
  role: MessageRole,
  content: string,
  safetyLevel: SafetyLevel,
  supabase: MemoryClient,
) {
  assertUserId(userId);
  assertId(sessionId, "sessionId");

  const safeContent = sanitizeConversationMessageContent(
    role,
    content,
    safetyLevel,
  );

  const { data, error } = await supabase
    .from("conversation_messages")
    .insert({
      session_id: sessionId,
      user_id: userId,
      role,
      content: safeContent,
      safety_level: safetyLevel,
    })
    .select("*")
    .single();

  throwIfSupabaseError(error, "save conversation message");

  return data;
}

export async function saveRecommendation(
  userId: string,
  sessionId: string | null,
  recommendation: Recommendation | SavedRecommendationInput,
  supabase: MemoryClient,
) {
  assertUserId(userId);

  if (sessionId) {
    assertId(sessionId, "sessionId");
  }

  const payload = normalizeRecommendationForSave(recommendation);

  const { data, error } = await supabase
    .from("saved_recommendations")
    .insert({
      user_id: userId,
      session_id: sessionId,
      ...payload,
    })
    .select("*")
    .single();

  throwIfSupabaseError(error, "save recommendation");

  return data;
}

export async function listUserConversationSessions(
  userId: string,
  supabase: MemoryClient,
) {
  assertUserId(userId);

  const { data, error } = await supabase
    .from("conversation_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  throwIfSupabaseError(error, "list conversation sessions");

  return (data ?? []) as ConversationSession[];
}

export async function getUserMemorySummary(
  userId: string,
  supabase: MemoryClient,
): Promise<MemorySummary> {
  assertUserId(userId);

  const [profileResult, preferencesResult, sessionsResult, recommendationsResult] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("user_preferences")
        .select("preference_key, preference_value, source")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("conversation_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(6),
      supabase
        .from("saved_recommendations")
        .select("id, recommendation_type, summary_zh, summary_en, urgency, requires_human_review, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

  throwIfSupabaseError(profileResult.error, "load profile");
  throwIfSupabaseError(preferencesResult.error, "load preferences");
  throwIfSupabaseError(sessionsResult.error, "load sessions");
  throwIfSupabaseError(recommendationsResult.error, "load recommendations");

  return {
    profile: profileResult.data as Profile | null,
    preferences: sanitizePreferencesForSummary(
      (preferencesResult.data ?? []) as Array<{
        preference_key: string;
        preference_value: Json;
        source: PreferenceSource;
      }>,
    ),
    recentSessions: (sessionsResult.data ?? []) as ConversationSession[],
    savedRecommendations: (recommendationsResult.data ?? []) as MemorySummary["savedRecommendations"],
  };
}

export async function clearSession(
  sessionId: string,
  userId: string,
  supabase: MemoryClient,
) {
  assertId(sessionId, "sessionId");
  assertUserId(userId);

  const { error: recommendationError } = await supabase
    .from("saved_recommendations")
    .delete()
    .eq("session_id", sessionId)
    .eq("user_id", userId);

  throwIfSupabaseError(
    recommendationError,
    "clear saved recommendations for session",
  );

  const { error } = await supabase
    .from("conversation_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", userId);

  throwIfSupabaseError(error, "clear session");
}

export function mapRecommendationMode(mode: Recommendation["mode"]): ConversationMode {
  if (mode === "medical") {
    return "symptom";
  }

  if (mode === "insurance" || mode === "policy") {
    return "insurance";
  }

  return "general";
}

export function getSafetyLevel(recommendation: Recommendation): SafetyLevel {
  if (recommendation.urgency.tone === "danger") {
    return "emergency";
  }

  if (recommendation.urgency.tone === "warning") {
    return "caution";
  }

  return "normal";
}

export function sanitizePreferencesForSummary(
  preferences: Array<{
    preference_key: string;
    preference_value: Json;
    source: PreferenceSource;
  }>,
): MemorySummary["preferences"] {
  return preferences.map((preference) => {
    const text = JSON.stringify(preference.preference_value);
    const include = shouldIncludeInMemorySummary(text, preference.source);

    return {
      key: preference.preference_key,
      value: include
        ? preference.preference_value
        : "[sensitive medical detail hidden]",
      source: preference.source,
      redacted: !include,
    };
  });
}

function normalizeRecommendationForSave(
  recommendation: Recommendation | SavedRecommendationInput,
): SavedRecommendationInput {
  if (!isNavigationRecommendation(recommendation)) {
    return recommendation;
  }

  const isEmergency = recommendation.urgency.tone === "danger";
  const isInsurance = recommendation.mode === "insurance" || recommendation.mode === "policy";

  return {
    recommendation_type: isEmergency
      ? "emergency"
      : isInsurance
        ? "insurance"
        : "department",
    summary_zh: `${recommendation.classification}：${recommendation.nextAction}`,
    summary_en: recommendation.disclaimer,
    urgency: recommendation.urgency.label,
    department: recommendation.possibleDepartments[0] ?? null,
    insurance_categories: recommendation.insuranceCategories,
    requires_human_review:
      isEmergency ||
      isInsurance ||
      recommendation.escalation.includes("真人") ||
      recommendation.escalation.includes("持牌"),
  };
}

function isNavigationRecommendation(
  recommendation: Recommendation | SavedRecommendationInput,
): recommendation is Recommendation {
  return "urgency" in recommendation && "nextAction" in recommendation;
}

function getUserDisplayName(user: User) {
  const metadata = user.user_metadata;
  const name =
    metadata.display_name ?? metadata.full_name ?? metadata.name ?? user.email;

  return typeof name === "string" && name.trim().length > 0
    ? name.trim()
    : null;
}

function assertUserId(userId: string | null | undefined) {
  assertId(userId, "userId");
}

function assertId(value: string | null | undefined, label: string) {
  if (!value || value.trim().length === 0) {
    throw new Error(`${label} is required for user memory operations.`);
  }
}

function throwIfSupabaseError(
  error: { message: string } | null,
  action: string,
) {
  if (error) {
    throw new Error(`Could not ${action}: ${error.message}`);
  }
}
