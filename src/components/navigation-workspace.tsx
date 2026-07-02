"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  ClipboardCheck,
  FileText,
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
  clearUserMemory,
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

type ActionId = "symptom" | "department" | "insurance" | "policy";
type CarePreference = "public" | "private";
type InterfaceLanguage = "zh" | "en";

const actionCards: Array<{
  id: ActionId;
  mode: IntakeMode;
  titleZh: string;
  titleEn: string;
  bodyZh: string;
  bodyEn: string;
  accent: "teal" | "blue" | "violet" | "amber";
  icon: LucideIcon;
}> = [
  {
    id: "symptom",
    mode: "medical",
    titleZh: "症狀評估",
    titleEn: "Symptom Check",
    bodyZh: "評估症狀嚴重程度\n並提供初步建議",
    bodyEn: "Assess symptom urgency\nand suggest first steps",
    accent: "teal",
    icon: Stethoscope,
  },
  {
    id: "department",
    mode: "medical",
    titleZh: "搵科別",
    titleEn: "Find Department",
    bodyZh: "根據你的情況\n推薦合適科別",
    bodyEn: "Match your situation\nto a likely care route",
    accent: "blue",
    icon: Hospital,
  },
  {
    id: "insurance",
    mode: "insurance",
    titleZh: "保險建議",
    titleEn: "Insurance Guidance",
    bodyZh: "了解保障範圍及\n索償流程建議",
    bodyEn: "Understand coverage types\nand claims considerations",
    accent: "violet",
    icon: ShieldCheck,
  },
  {
    id: "policy",
    mode: "policy",
    titleZh: "保單解讀",
    titleEn: "Policy & Claims",
    bodyZh: "整理條款、索償及\n不保事項問題",
    bodyEn: "Review exclusions, waiting periods\nand claim steps",
    accent: "amber",
    icon: FileText,
  },
];

const examples: Record<ActionId, Record<InterfaceLanguage, string>> = {
  symptom: {
    zh: "例如：頭痛兩日、發燒、皮膚痕...",
    en: "Example: Headache for two days, fever, itchy skin...",
  },
  department: {
    zh: "例如：小朋友發燒出疹，應該睇咩科？",
    en: "Example: My child has fever and a rash. Which department should we try?",
  },
  insurance: {
    zh: "例如：自僱，沒有僱主醫療，想了解保障類型...",
    en: "Example: I am self-employed and want to understand coverage options...",
  },
  policy: {
    zh: "例如：想理解住院保單的不保事項、等候期和索償流程...",
    en: "Example: Help me understand exclusions, waiting periods, and claims steps...",
  },
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

const carePreferenceCopy: Record<
  CarePreference,
  Record<IntakeMode, { nextAction: string; checklist: string; audit: string }>
> = {
  public: {
    medical: {
      nextAction:
        "公營優先：非緊急情況可先留意普通科門診或家庭醫生評估；如出現危險徵兆，仍應即時改去急症室 / A&E。",
      checklist: "公營路徑：準備身份證明、過往紀錄和轉介/覆診資料，並預留輪候時間。",
      audit: "Applied public-care preference guidance.",
    },
    insurance: {
      nextAction:
        "公營優先：保障規劃可先假設公營服務為主要路徑，再評估是否需要住院、門診或私家後備保障。",
      checklist: "公營使用情境：核對保單是否補足私家住院、門診、藥物或第二意見需要。",
      audit: "Applied public-care preference guidance.",
    },
    policy: {
      nextAction:
        "公營優先：解讀保單時可特別核對公營轉私家、私家檢查、藥物及收據要求。",
      checklist: "公營相關文件：保存轉介信、覆診紙、檢查報告和任何自費項目收據。",
      audit: "Applied public-care preference guidance.",
    },
  },
  private: {
    medical: {
      nextAction:
        "私家優先：非緊急情況可先約私家普通科或診所；如需要專科，先確認是否要轉介信、網絡診所或預先批核。",
      checklist: "私家路徑：先查診所/醫院網絡、預先批核、自付額、共同保險和收據要求。",
      audit: "Applied private-care preference guidance.",
    },
    insurance: {
      nextAction:
        "私家優先：保障規劃應重點比較私家醫院網絡、病房級別、預先批核、自付額和共同保險。",
      checklist: "私家使用情境：核對網絡醫院、專科門診、預先批核、墊底費和索償文件要求。",
      audit: "Applied private-care preference guidance.",
    },
    policy: {
      nextAction:
        "私家優先：解讀保單時可先核對網絡限制、專科轉介、預先批核、收據和診斷證明要求。",
      checklist: "私家索償文件：保存醫生轉介、診斷證明、分項收據、預先批核和出院摘要。",
      audit: "Applied private-care preference guidance.",
    },
  },
};

const inputHeadingCopy: Record<InterfaceLanguage, { title: string; subtitle: string }> = {
  zh: {
    title: "請描述你的症狀或保險問題",
    subtitle: "Describe your symptom or insurance question",
  },
  en: {
    title: "Describe your symptom or insurance question",
    subtitle: "請描述你的症狀或保險問題",
  },
};

const heroCopy: Record<
  InterfaceLanguage,
  {
    greeting: string;
    lineOne: string;
    lineTwo: string;
    subtitle: string;
    trust: string;
    trustSubtitle: string;
  }
> = {
  zh: {
    greeting: "你好，",
    lineOne: "我係你的",
    lineTwo: "AI 醫療顧問",
    subtitle: "Your AI healthcare guide",
    trust: "值得信賴・專業・私隱保障",
    trustSubtitle: "Trusted・Professional・Private",
  },
  en: {
    greeting: "Hello,",
    lineOne: "I am your",
    lineTwo: "AI healthcare guide",
    subtitle: "你的 AI 醫療顧問",
    trust: "Trusted・Professional・Private",
    trustSubtitle: "值得信賴・專業・私隱保障",
  },
};

const resultCardCopy: Record<
  InterfaceLanguage,
  {
    loading: string;
    nextStepBadge: string;
    nextStep: string;
    departmentDirection: string;
    possibleOptions: string;
    insuranceCategories: string;
    whatToPrepare: string;
    followUpPrompts: string;
    safetyReasoning: string;
    detectedSignals: string;
  }
> = {
  zh: {
    loading: "正在分析… / Analyzing...",
    nextStepBadge: "Next step",
    nextStep: "下一步 / Next step",
    departmentDirection: "科別方向 / Department direction",
    possibleOptions: "可能相關 / Possible options",
    insuranceCategories: "保險分類 / Insurance categories",
    whatToPrepare: "準備清單 / What to prepare",
    followUpPrompts: "下一步可回答 / Follow-up prompts",
    safetyReasoning: "判斷依據 / Safety reasoning",
    detectedSignals: "識別到的訊號 / Detected signals",
  },
  en: {
    loading: "Analyzing... / 正在分析…",
    nextStepBadge: "Next step",
    nextStep: "Next step / 下一步",
    departmentDirection: "Department direction / 科別方向",
    possibleOptions: "Possible options / 可能相關",
    insuranceCategories: "Insurance categories / 保險分類",
    whatToPrepare: "What to prepare / 準備清單",
    followUpPrompts: "Follow-up prompts / 下一步可回答",
    safetyReasoning: "Safety reasoning / 判斷依據",
    detectedSignals: "Detected signals / 識別到的訊號",
  },
};

const emergencyCallLabels: Record<InterfaceLanguage, string> = {
  zh: "緊急情況請致電 999 或前往急症室",
  en: "Call 999 or go to A&E for an emergency",
};

function applyCarePreference(result: Recommendation, carePreference: CarePreference): Recommendation {
  if (result.urgency.level === 1) {
    return result;
  }

  const preferenceCopy = carePreferenceCopy[carePreference][result.mode];

  return {
    ...result,
    nextAction: result.nextAction.includes(preferenceCopy.nextAction)
      ? result.nextAction
      : `${result.nextAction} ${preferenceCopy.nextAction}`,
    decisionChecklist: uniqueList([...result.decisionChecklist, preferenceCopy.checklist]),
    audit: uniqueList([...result.audit, preferenceCopy.audit]),
  };
}

function uniqueList<T>(items: T[]) {
  return Array.from(new Set(items));
}

export function NavigationWorkspace() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [activeAction, setActiveAction] = useState<ActionId>("symptom");
  const [carePreference, setCarePreference] = useState<CarePreference>("public");
  const [interfaceLanguage, setInterfaceLanguage] = useState<InterfaceLanguage>("zh");
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
  const activeInputHeading = inputHeadingCopy[interfaceLanguage];
  const activeHeroCopy = heroCopy[interfaceLanguage];
  const emergencyCallLabel = emergencyCallLabels[interfaceLanguage];
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

  function handleCarePreferenceToggle() {
    const nextPreference = carePreference === "public" ? "private" : "public";
    const trimmedInput = input.trim();

    setCarePreference(nextPreference);
    setSavedSessionId(null);
    setMemoryStatus(null);

    if (result && trimmedInput) {
      const recommendation = analyzeIntake(activeCard.mode, trimmedInput);
      setResult(applyCarePreference(recommendation, nextPreference));
    }
  }

  function handleLanguageToggle() {
    setInterfaceLanguage((current) => (current === "zh" ? "en" : "zh"));
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
      const recommendation = analyzeIntake(activeCard.mode, trimmedInput);

      setResult(applyCarePreference(recommendation, carePreference));
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
    if (!supabase || !user) {
      return;
    }

    const isAnonymousUser = Boolean(user.is_anonymous || profile?.is_anonymous);

    startSavingMemory(async () => {
      try {
        if (isAnonymousUser) {
          await clearUserMemory(user.id, supabase);
        }

        const { error } = await supabase.auth.signOut();

        if (error) {
          throw error;
        }

        setUser(null);
        setProfile(null);
        setSaveHistory(false);
        setShowUpgrade(false);
        setSavedSessionId(null);
        setMemoryStatus(
          isAnonymousUser
            ? "已登出，並清除匿名保存紀錄。Signed out and cleared anonymous saved memory."
            : "已登出。Signed out.",
        );
      } catch (error) {
        setMemoryStatus(
          error instanceof Error
            ? `未能安全登出 / Could not sign out safely: ${error.message}`
            : "未能安全登出 / Could not sign out safely.",
        );
      }
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
          interfaceLanguage === "zh" ? "zh-Hant" : "en",
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
          saveUserPreference(
            user.id,
            "preferred_language",
            interfaceLanguage === "zh" ? "zh-Hant" : "en",
            "explicit_user_choice",
            supabase,
          ),
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
              aria-label="切換公立或私家醫療偏好"
              aria-pressed={carePreference === "private"}
              onClick={handleCarePreferenceToggle}
            >
              <Hospital size={20} aria-hidden="true" />
              <span>
                {carePreference === "public" ? "公立優先" : "私家優先"}
                <small>{carePreference === "public" ? "Public first" : "Private first"}</small>
              </span>
            </button>
            <button
              className={styles.controlPill}
              type="button"
              aria-label={
                interfaceLanguage === "zh"
                  ? "目前為繁體中文優先，切換至英文優先"
                  : "English-first interface active. Switch to Traditional Chinese first."
              }
              aria-pressed={interfaceLanguage === "en"}
              onClick={handleLanguageToggle}
            >
              <Languages size={20} aria-hidden="true" />
              <span>
                {interfaceLanguage === "zh" ? "繁中" : "English"}
                <small>{interfaceLanguage === "zh" ? "English" : "繁中"}</small>
              </span>
            </button>
          </div>
        </header>

        <section className={styles.hero} aria-label="Virtual AI doctor">
          <div className={styles.heroCopy}>
            <h1>
              {activeHeroCopy.greeting}
              <span>{activeHeroCopy.lineOne}</span>
              <span>{activeHeroCopy.lineTwo}</span>
            </h1>
            <p>{activeHeroCopy.subtitle}</p>
            <div className={styles.trustBadge}>
              <ShieldCheck size={18} aria-hidden="true" />
              <span>
                {activeHeroCopy.trust}
                <small>{activeHeroCopy.trustSubtitle}</small>
              </span>
            </div>
          </div>
          <DoctorAvatar state={avatarState} className={styles.heroAvatar} showSafetyLabel />
        </section>

        <section className={styles.chatCard} aria-label="Question input">
          <div className={styles.inputHeading}>
            <div>
              <h2>{activeInputHeading.title}</h2>
              <p>{activeInputHeading.subtitle}</p>
            </div>
          </div>

          <div className={styles.inputShell}>
            <textarea
              ref={inputRef}
              className={styles.textarea}
              value={input}
              rows={2}
              placeholder={examples[activeAction][interfaceLanguage]}
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
                <strong>{interfaceLanguage === "zh" ? card.titleZh : card.titleEn}</strong>
                <small>{interfaceLanguage === "zh" ? card.titleEn : card.titleZh}</small>
                <span>{interfaceLanguage === "zh" ? card.bodyZh : card.bodyEn}</span>
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
            interfaceLanguage={interfaceLanguage}
            canSave={Boolean(user && saveHistory)}
            isSaved={Boolean(savedSessionId)}
            isSaving={isSavingMemory}
            memoryStatus={memoryStatus}
            onSave={handleSaveRecommendation}
            onDecline={handleDeclineMemory}
          />
        )}

        <a className={styles.emergencyBar} href="tel:999" aria-label={emergencyCallLabel}>
          <AlertTriangle size={26} aria-hidden="true" />
          <span>
            {EMERGENCY_ESCALATION_COPY}
            <small>
              For chest pain, severe breathing trouble, stroke signs, unconsciousness,
              severe bleeding, severe allergic reactions, immediate self-harm risk,
              overdose, accidental ingestion, or other emergencies, call 999 or go to
              A&amp;E.
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
  interfaceLanguage,
  canSave,
  isSaved,
  isSaving,
  memoryStatus,
  onSave,
  onDecline,
}: {
  result: Recommendation | null;
  isSubmitting: boolean;
  interfaceLanguage: InterfaceLanguage;
  canSave: boolean;
  isSaved: boolean;
  isSaving: boolean;
  memoryStatus: string | null;
  onSave: () => void;
  onDecline: () => void;
}) {
  const copy = resultCardCopy[interfaceLanguage];

  if (isSubmitting) {
    return (
      <section className={styles.resultCard} aria-live="polite">
        <div className={styles.thinkingRow}>
          <Activity size={18} aria-hidden="true" />
          <span>{copy.loading}</span>
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
        <span>{isEmergency ? "999 / A&E" : copy.nextStepBadge}</span>
      </div>

      <p className={styles.resultSummary}>{result.urgency.summary}</p>
      <ResultBlock icon={ArrowRight} title={copy.nextStep} content={result.nextAction} />
      <ResultBlock icon={Hospital} title={copy.departmentDirection} content={result.careRoute} />
      <ResultList title={copy.possibleOptions} items={result.possibleDepartments} />
      <ResultList title={copy.insuranceCategories} items={result.insuranceCategories} />
      <ResultList title={copy.whatToPrepare} items={result.decisionChecklist} />
      {!isEmergency ? <ResultList title={copy.followUpPrompts} items={result.questions} /> : null}
      <ResultList title={copy.safetyReasoning} items={result.audit} />
      <ResultList title={copy.detectedSignals} items={result.matchedSignals} />

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
  if (items.length === 0) {
    return null;
  }

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
