export const GOOGLE_OAUTH_ENABLED = false;

export const anonymousModeCopy = {
  requiresEmail: false,
  zh:
    "你可以匿名使用本服務。匿名模式適合初步查詢，但如果你登出、清除瀏覽器資料或更換裝置，可能無法再次取回紀錄。建立帳戶可保存偏好、家庭成員資料及保險分析。",
  en:
    "You can use this service anonymously. Anonymous mode is suitable for initial guidance, but if you sign out, clear browser data, or change device, you may not be able to recover your history. Creating an account lets you save preferences, household profiles, and insurance assessments.",
};

export function getAnonymousStartState(email: string) {
  return {
    canStart: true,
    requiresEmail: anonymousModeCopy.requiresEmail,
    email: email.trim(),
  };
}
