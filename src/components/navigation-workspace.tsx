"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  ClipboardCheck,
  HeartPulse,
  Hospital,
  Languages,
  MessageSquareText,
  Mic,
  ShieldCheck,
  Stethoscope,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { User } from "@supabase/supabase-js";
import { AuthPanel } from "@/components/auth/auth-panel";
import { UserMenu } from "@/components/auth/user-menu";
import { MemoryConsentCard } from "@/components/memory/memory-consent-card";
import {
  DoctorAvatar,
  getDoctorAvatarState,
} from "@/components/virtual-doctor-avatar";
import { analyzeIntake, type IntakeMode, type Recommendation } from "@/lib/navigation-engine";
import {
  EMERGENCY_ESCALATION_COPY,
  INSURANCE_SAFETY_DISCLAIMER,
  MEDICAL_SAFETY_DISCLAIMER,
} from "@/lib/safety-copy";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  clearSession,
  getMemorySavePreference,
  getOrCreateProfile,
  getSafetyLevel,
  mapRecommendationMode,
  recordConsentEvent,
  saveConversationMessage,
  saveConversationSession,
  saveRecommendation,
  saveUserPreference,
  setMemorySavePreference,
  type ConversationMode,
  type Profile,
} from "@/lib/user-memory";
import styles from "./navigation-workspace.module.css";

type ActionId = "symptom" | "department" | "insurance";
type CarePreference = "public" | "private";

const actionCards: Array<{
  id: ActionId;
  mode: IntakeMode;
  titleZh: string;
  titleEn: string;
  bodyZh: string;
  accent: "teal" | "blue" | "violet";
  icon: LucideIcon;
}> = [
  {
    id: "symptom",
    mode: "medical",
    titleZh: "症狀評估",
    titleEn: "Symptom Check",
    bodyZh: "評估症狀嚴重程度\n並提供初步建議",
    accent: "teal",
    icon: Stethoscope,
  },
  {
    id: "department",
    mode: "medical",
    titleZh: "搵科別",
    titleEn: "Find Department",
    bodyZh: "根據你的情況\n推薦合適科別",
    accent: "blue",
    icon: Hospital,
  },
  {
    id: "insurance",
    mode: "insurance",
    titleZh: "保險建議",
    titleEn: "Insurance Guidance",
    bodyZh: "了解保障範圍及\n索償流程建議",
    accent: "violet",
    icon: ShieldCheck,
  },
];

const examples: Record<ActionId, string> = {
  symptom: "例如：頭痛兩日、發燒、保險索償問題...",
  department: "例如：小朋友發燒出疹，應該睇咩科？",
  insurance: "例如：自僱，沒有僱主醫療，想了解保障類型...",
};

const navItems = [
  { label: "首頁", icon: HeartPulse, href: "#home" },
  { label: "對話記錄", icon: MessageSquareText, href: "#memory" },
  { label: "健康資訊", icon: Activity, href: "#health-info" },
  { label: "保險知識", icon: ShieldCheck, href: "#insurance-info" },
  { label: "我的", icon: UserRoundCheck, href: "#account" },
];

const featureChips = [
  { zh: "保障私隱", en: "Privacy Protected", icon: ShieldCheck },
  { zh: "AI 專業分析", en: "AI Powered", icon: Bot },
  { zh: "24/7 全天候支援", en: "24/7 Support", icon: Activity },
];

const routeRows = [
  ["急症室 / A&E", "胸痛、呼吸困難、中風徵兆、大量出血、自傷即時風險"],
  ["普通科 / GP", "非緊急但持續症狀、初步檢查、轉介建議"],
  ["相關專科 / Specialist", "按醫生評估及症狀範圍，再考慮眼科、皮膚科、兒科等"],
];

const coverageRows = [
  "住院醫療 / Hospital",
  "門診 / Outpatient",
  "危疾 / Critical illness",
  "意外 / Accident",
  "牙科 / Dental",
  "旅遊 / Travel",
];

export function NavigationWorkspace() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [activeAction, setActiveAction] = useState<ActionId>("symptom");
  const [carePreference, setCarePreference] = useState<CarePreference>("public");
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [result, setResult] = useState<Recommendation | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authReady, setAuthReady] = useState(() => !supabase);
  const [saveHistory, setSaveHistory] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const [memoryStatus, setMemoryStatus] = useState<string | null>(null);
  const [isSavingMemory, startSavingMemory] = useTransition();

  const activeCard = actionCards.find((card) => card.id === activeAction) ?? actionCards[0];
  const avatarState = getDoctorAvatarState({
    result,
    isSubmitting,
    input: result ? "" : input,
  });

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;

    async function syncUser(nextUser: User | null) {
      setUser(nextUser);

      if (!nextUser || !supabase) {
        setSaveHistory(false);
        setProfile(null);
        return;
      }

      try {
        const [nextProfile, rememberedSaveHistory] = await Promise.all([
          getOrCreateProfile(nextUser, supabase),
          getMemorySavePreference(nextUser.id, supabase),
        ]);

        if (isMounted) {
          setProfile(nextProfile);
          setSaveHistory(rememberedSaveHistory ?? false);
        }
      } catch (error) {
        if (isMounted) {
          setMemoryStatus(
            error instanceof Error
              ? `未能載入用戶資料 / Could not load profile: ${error.message}`
              : "未能載入用戶資料 / Could not load profile.",
          );
        }
      }
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) {
        return;
      }

      await syncUser(data.session?.user ?? null);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  function handleActionSelect(actionId: ActionId) {
    setActiveAction(actionId);
    setResult(null);
    setSavedSessionId(null);
    setMemoryStatus(null);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleInputChange(nextInput: string) {
    setInput(nextInput);
    setResult(null);
    setSavedSessionId(null);
    setMemoryStatus(null);
  }

  function handleSubmit() {
    const trimmedInput = input.trim();

    if (!trimmedInput) {
      setMemoryStatus("請先描述症狀或保險問題。Please describe your symptom or insurance question first.");
      inputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    setResult(null);
    setSavedSessionId(null);
    setMemoryStatus(null);

    window.setTimeout(() => {
      setResult(analyzeIntake(activeCard.mode, trimmedInput));
      setIsSubmitting(false);
    }, 520);
  }

  function handleSaveHistoryChange(enabled: boolean) {
    if (!supabase || !user) {
      setSaveHistory(false);
      setMemoryStatus(
        "請先匿名開始或登入，之後再選擇是否保存。Start anonymously or sign in before changing memory settings.",
      );
      return;
    }

    startSavingMemory(async () => {
      try {
        await setMemorySavePreference(user.id, enabled, supabase);
        setSaveHistory(enabled);
        setMemoryStatus(
          enabled
            ? "已開啟保存紀錄。之後仍需按保存，今次建議才會記住。Save history is on. This recommendation is still saved only when you tap Save."
            : "已關閉保存紀錄。之後不會保存新的建議，除非你再次開啟。Save history is off until you turn it on again.",
        );
      } catch (error) {
        setMemoryStatus(
          error instanceof Error
            ? `未能更新保存設定 / Could not update memory setting: ${error.message}`
            : "未能更新保存設定 / Could not update memory setting.",
        );
      }
    });
  }

  function handleSignOut() {
    if (!supabase) {
      return;
    }

    void supabase.auth.signOut().then(() => {
      setUser(null);
      setProfile(null);
      setSaveHistory(false);
      setShowUpgrade(false);
      setSavedSessionId(null);
      setMemoryStatus("已登出。Signed out.");
    });
  }

  function handleClearSession() {
    if (!supabase || !user || !savedSessionId) {
      setSavedSessionId(null);
      setMemoryStatus("已清除本機狀態。Local session state cleared.");
      return;
    }

    startSavingMemory(async () => {
      try {
        await clearSession(savedSessionId, user.id, supabase);
        setSavedSessionId(null);
        setMemoryStatus("已清除今次已保存建議及對話紀錄。Saved recommendation and session cleared.");
      } catch (error) {
        setMemoryStatus(
          error instanceof Error
            ? `清除失敗 / Could not clear: ${error.message}`
            : "清除失敗 / Could not clear saved session.",
        );
      }
    });
  }

  function handleSaveRecommendation() {
    if (!result) {
      setMemoryStatus("未有建議可保存。There is no recommendation to save yet.");
      return;
    }

    if (!supabase || !user) {
      setMemoryStatus("請先匿名開始或登入，才可保存。Start anonymously or log in before saving.");
      return;
    }

    if (!saveHistory) {
      setMemoryStatus("你已關閉保存紀錄。Save history is currently off.");
      return;
    }

    startSavingMemory(async () => {
      try {
        const sessionMode: ConversationMode =
          activeAction === "department" ? "department" : mapRecommendationMode(result.mode);
        const session = await saveConversationSession(
          user.id,
          sessionMode,
          input.slice(0, 72),
          "zh-Hant",
          supabase,
        );
        const safetyLevel = getSafetyLevel(result);

        await Promise.all([
          saveConversationMessage(session.id, user.id, "user", input, safetyLevel, supabase),
          saveConversationMessage(
            session.id,
            user.id,
            "assistant",
            `${result.classification}\n${result.nextAction}`,
            safetyLevel,
            supabase,
          ),
          saveUserPreference(user.id, "preferred_language", "zh-Hant", "explicit_user_choice", supabase),
          saveUserPreference(
            user.id,
            "care_preference",
            carePreference,
            "explicit_user_choice",
            supabase,
          ),
          recordConsentEvent(user.id, "save_memory", true, supabase),
        ]);

        await saveRecommendation(user.id, session.id, result, supabase);
        setSavedSessionId(session.id);
        setMemoryStatus("已保存今次建議。This recommendation has been saved.");
      } catch (error) {
        setMemoryStatus(
          error instanceof Error
            ? `保存失敗 / Could not save: ${error.message}`
            : "保存失敗 / Could not save recommendation.",
        );
      }
    });
  }

  function handleDeclineMemory() {
    setMemoryStatus("今次不要保存。This recommendation will not be saved.");
  }

  return (
    <main className={styles.shell} id="home">
      <section
        className={`${styles.phone} ${result || isSubmitting ? styles.phoneWithResult : ""}`}
        aria-label="智健導航 mobile app preview"
      >
        <div className={styles.statusBar} aria-hidden="true">
          <span>9:41</span>
          <span className={styles.statusIcons}>●●●  Wi-Fi  ▰</span>
        </div>

        <header className={styles.topbar}>
          <a className={styles.brand} href="#home" aria-label="智健導航 AI Healthcare Guide">
            <span className={styles.brandMark}>
              <HeartPulse size={27} aria-hidden="true" />
            </span>
            <span>
              <strong>智健導航</strong>
              <small>AI Healthcare Guide</small>
            </span>
          </a>

          <div className={styles.topControls} aria-label="Preferences">
            <button
              className={styles.controlPill}
              type="button"
              aria-pressed={carePreference === "public"}
              onClick={() => setCarePreference(carePreference === "public" ? "private" : "public")}
            >
              <Hospital size={20} aria-hidden="true" />
              <span>
                公立 / 私家
                <small>Public / Private</small>
              </span>
            </button>
            <button className={styles.controlPill} type="button">
              <Languages size={20} aria-hidden="true" />
              <span>
                繁中
                <small>English</small>
              </span>
            </button>
          </div>
        </header>

        <section className={styles.hero} aria-label="Virtual AI doctor">
          <div className={styles.heroCopy}>
            <h1>
              你好，
              <span>我係你的</span>
              <span>AI 醫療顧問</span>
            </h1>
            <p>Your AI healthcare guide</p>
            <div className={styles.trustBadge}>
              <ShieldCheck size={18} aria-hidden="true" />
              <span>
                值得信賴・專業・私隱保障
                <small>Trusted・Professional・Private</small>
              </span>
            </div>
          </div>
          <DoctorAvatar state={avatarState} className={styles.heroAvatar} showSafetyLabel />
        </section>

        <section className={styles.chatCard} aria-label="Question input">
          <div className={styles.inputHeading}>
            <div>
              <h2>請描述你的症狀或保險問題</h2>
              <p>Describe your symptom or insurance question</p>
            </div>
          </div>

          <div className={styles.inputShell}>
            <textarea
              ref={inputRef}
              className={styles.textarea}
              value={input}
              rows={2}
              placeholder={examples[activeAction]}
              onChange={(event) => handleInputChange(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  handleSubmit();
                }
              }}
            />
            <button
              className={isRecording ? styles.micActive : styles.micButton}
              type="button"
              aria-pressed={isRecording}
              aria-label={isRecording ? "停止語音輸入" : "開始語音輸入"}
              onClick={() => setIsRecording((current) => !current)}
            >
              <Mic size={22} aria-hidden="true" />
            </button>
            <button
              className={styles.sendButton}
              type="button"
              aria-label="提交問題"
              disabled={isSubmitting}
              onClick={handleSubmit}
            >
              <ArrowRight size={25} aria-hidden="true" />
            </button>
          </div>

          <div className={styles.featureChips}>
            {featureChips.map((chip) => {
              const Icon = chip.icon;
              return (
                <span key={chip.zh}>
                  <Icon size={18} aria-hidden="true" />
                  <strong>{chip.zh}</strong>
                  <small>{chip.en}</small>
                </span>
              );
            })}
          </div>
        </section>

        <section className={styles.actionGrid} aria-label="Main actions">
          {actionCards.map((card) => {
            const Icon = card.icon;
            const isActive = activeAction === card.id;

            return (
              <button
                className={`${styles.actionCard} ${styles[card.accent]} ${
                  isActive ? styles.actionCardActive : ""
                }`}
                key={card.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => handleActionSelect(card.id)}
              >
                <span className={styles.actionIcon}>
                  <Icon size={34} aria-hidden="true" />
                </span>
                <strong>{card.titleZh}</strong>
                <small>{card.titleEn}</small>
                <span>{card.bodyZh}</span>
                <i aria-hidden="true">
                  <ArrowRight size={20} />
                </i>
              </button>
            );
          })}
        </section>

        {(isSubmitting || result) && (
          <ResultCard
            result={result}
            isSubmitting={isSubmitting}
            canSave={Boolean(user && saveHistory)}
            isSaved={Boolean(savedSessionId)}
            isSaving={isSavingMemory}
            memoryStatus={memoryStatus}
            onSave={handleSaveRecommendation}
            onDecline={handleDeclineMemory}
          />
        )}

        <a className={styles.emergencyBar} href="tel:999" aria-label="Call 999 for emergency">
          <AlertTriangle size={26} aria-hidden="true" />
          <span>
            {EMERGENCY_ESCALATION_COPY}
            <small>
              For chest pain, severe breathing trouble, stroke signs, unconsciousness,
              severe bleeding, severe allergic reactions, or other emergencies, call 999
              or go to A&amp;E.
            </small>
          </span>
          <ArrowRight size={21} aria-hidden="true" />
        </a>

        <nav className={styles.bottomNav} aria-label="Bottom navigation">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <a className={index === 0 ? styles.navActive : ""} href={item.href} key={item.label}>
                <Icon size={23} aria-hidden="true" />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>
      </section>

      <section className={styles.accountSection} id="account" aria-label="Login and memory settings">
        <div className={styles.accountHeader}>
          <p>登入及記憶 / Login and Memory</p>
          <h2>匿名開始，之後再選擇保存</h2>
          <span>
            Start anonymously, upgrade later, and save health navigation history only with consent.
          </span>
        </div>

        <div className={styles.authGrid} id="memory">
          {!user || showUpgrade ? (
            <AuthPanel
              supabase={supabase}
              user={user}
              variant={showUpgrade ? "upgrade" : "start"}
              onUserReady={setUser}
              onProfileReady={(nextProfile) => {
                setProfile(nextProfile);
                setSaveHistory(false);
                setShowUpgrade(false);
              }}
            />
          ) : (
            <UserMenu
              user={user}
              profile={profile}
              saveHistory={saveHistory}
              hasSavedSession={Boolean(savedSessionId)}
              onToggleSaveHistory={handleSaveHistoryChange}
              onSignOut={handleSignOut}
              onClearSession={handleClearSession}
              onUpgradeAccount={() => setShowUpgrade(true)}
            />
          )}

          <div className={styles.authStateCard}>
            <p className={styles.panelKicker}>登入狀態 / Auth state</p>
            <h2>
              {user
                ? profile?.is_anonymous || user.is_anonymous
                  ? "匿名模式已開啟 / Anonymous mode is on"
                  : "已登入並可保存 / Logged in and ready to save"
                : "未登入也可先使用 / You can use it before login"}
            </h2>
            <span>
              記憶狀態：{user && saveHistory ? "同意後可保存" : "不會保存"} / Memory:{" "}
              {user && saveHistory ? "save after consent" : "off"}
            </span>
            {profile?.is_anonymous || user?.is_anonymous ? (
              <button type="button" onClick={() => setShowUpgrade(true)}>
                保存紀錄並建立帳戶 / Save history and create account
              </button>
            ) : null}
            <small>
              {authReady
                ? "每次保存前都會詢問，不會自動保存敏感病歷。You will be asked before saving sensitive context."
                : "正在確認登入狀態... Checking auth state..."}
            </small>
          </div>
        </div>
      </section>

      <section className={styles.referenceGrid} aria-label="Safety references">
        <ReferencePanel
          id="health-info"
          icon={Hospital}
          title="香港醫療路徑"
          subtitle="Hong Kong care routing"
          rows={routeRows}
        />
        <ReferencePanel
          id="insurance-info"
          icon={ShieldCheck}
          title="保障分類"
          subtitle="Coverage categories"
          tags={coverageRows}
        />
        <div className={styles.referencePanel}>
          <div className={styles.sectionTitle}>
            <ClipboardCheck size={20} aria-hidden="true" />
            <div>
              <h2>安全邊界</h2>
              <p>Safety boundaries</p>
            </div>
          </div>
          <p className={styles.referenceCopy}>{MEDICAL_SAFETY_DISCLAIMER}</p>
          <p className={styles.referenceCopy}>{EMERGENCY_ESCALATION_COPY}</p>
          <p className={styles.referenceCopy}>{INSURANCE_SAFETY_DISCLAIMER}</p>
        </div>
      </section>
    </main>
  );
}

function ResultCard({
  result,
  isSubmitting,
  canSave,
  isSaved,
  isSaving,
  memoryStatus,
  onSave,
  onDecline,
}: {
  result: Recommendation | null;
  isSubmitting: boolean;
  canSave: boolean;
  isSaved: boolean;
  isSaving: boolean;
  memoryStatus: string | null;
  onSave: () => void;
  onDecline: () => void;
}) {
  if (isSubmitting) {
    return (
      <section className={styles.resultCard} aria-live="polite">
        <div className={styles.thinkingRow}>
          <Activity size={18} aria-hidden="true" />
          <span>正在分析… / Analyzing...</span>
        </div>
      </section>
    );
  }

  if (!result) {
    return null;
  }

  const isEmergency = result.urgency.level === 1;

  return (
    <section
      className={`${styles.resultCard} ${isEmergency ? styles.resultEmergency : ""}`}
      aria-live={isEmergency ? "assertive" : "polite"}
    >
      <div className={styles.resultHeader}>
        <div>
          <p>{result.classification}</p>
          <h2>{result.urgency.label}</h2>
        </div>
        <span>{isEmergency ? "999 / A&E" : "Next step"}</span>
      </div>

      <p className={styles.resultSummary}>{result.urgency.summary}</p>
      <ResultBlock icon={ArrowRight} title="下一步 / Next step" content={result.nextAction} />
      <ResultBlock icon={Hospital} title="科別方向 / Department direction" content={result.careRoute} />
      <ResultList title="可能相關 / Possible options" items={result.possibleDepartments} />
      <ResultList title="保險分類 / Insurance categories" items={result.insuranceCategories} />

      <div className={styles.escalationBox}>
        <AlertTriangle size={18} aria-hidden="true" />
        <span>{result.escalation}</span>
      </div>

      <MemoryConsentCard
        canSave={canSave}
        isSaved={isSaved}
        isSaving={isSaving}
        status={memoryStatus}
        onSave={onSave}
        onDecline={onDecline}
      />

      <p className={styles.disclaimer}>{result.disclaimer}</p>
    </section>
  );
}

function ResultBlock({
  icon: Icon,
  title,
  content,
}: {
  icon: LucideIcon;
  title: string;
  content: string;
}) {
  return (
    <div className={styles.resultBlock}>
      <Icon size={16} aria-hidden="true" />
      <div>
        <h3>{title}</h3>
        <p>{content}</p>
      </div>
    </div>
  );
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className={styles.resultList}>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ReferencePanel({
  id,
  icon: Icon,
  title,
  subtitle,
  rows,
  tags,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  rows?: string[][];
  tags?: string[];
}) {
  return (
    <div className={styles.referencePanel} id={id}>
      <div className={styles.sectionTitle}>
        <Icon size={20} aria-hidden="true" />
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      {rows ? (
        <div className={styles.routeList}>
          {rows.map(([label, body]) => (
            <div className={styles.routeRow} key={label}>
              <strong>{label}</strong>
              <span>{body}</span>
            </div>
          ))}
        </div>
      ) : null}
      {tags ? (
        <div className={styles.coverageGrid}>
          {tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
