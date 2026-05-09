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
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type { User } from "@supabase/supabase-js";
import { AuthPanel } from "@/components/auth/auth-panel";
import { UserMenu } from "@/components/auth/user-menu";
import { MemoryConsentCard } from "@/components/memory/memory-consent-card";
import { analyzeIntake, type IntakeMode, type Recommendation } from "@/lib/navigation-engine";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  clearSession,
  getOrCreateProfile,
  getSafetyLevel,
  mapRecommendationMode,
  saveConversationMessage,
  saveConversationSession,
  saveRecommendation,
  saveUserPreference,
  type Profile,
} from "@/lib/user-memory";
import styles from "./navigation-workspace.module.css";

type AvatarState = "idle" | "listening" | "thinking" | "speaking" | "emergency" | "reassurance";

const examples: Array<{ label: string; prompt: string; mode: IntakeMode }> = [
  {
    label: "胸口痛 + 氣促",
    prompt: "我胸口痛，又覺得氣促，應該去邊度？",
    mode: "medical",
  },
  {
    label: "小朋友發燒出疹",
    prompt: "小朋友發燒又出疹兩日，應該睇咩科？",
    mode: "medical",
  },
  {
    label: "自僱保險",
    prompt: "我 35 歲，自僱，住香港，沒有僱主醫療，應該買咩保險？",
    mode: "insurance",
  },
  {
    label: "保單條款",
    prompt: "我想理解住院保單的不保事項、等候期和索償流程。",
    mode: "policy",
  },
];

const modeCopy: Record<IntakeMode, { label: string; description: string; icon: LucideIcon }> = {
  medical: {
    label: "醫療導航",
    description: "症狀、緊急程度、第一步就醫點",
    icon: Stethoscope,
  },
  insurance: {
    label: "保險規劃",
    description: "保障類型、比較準則、顧問交接",
    icon: ShieldCheck,
  },
  policy: {
    label: "保單解釋",
    description: "索償、條款、不保事項、等候期",
    icon: FileText,
  },
};

const avatarCopy: Record<AvatarState, { label: string; message: string }> = {
  idle: {
    label: "Idle",
    message: "我會先幫你分辨風險，再整理下一步。",
  },
  listening: {
    label: "Listening",
    message: "請描述症狀、時間、嚴重程度或保險需要。",
  },
  thinking: {
    label: "Analyzing",
    message: "正在分析症狀、緊急程度和合適路徑。",
  },
  speaking: {
    label: "Explaining",
    message: "以下是導航建議，不是診斷或保單銷售建議。",
  },
  emergency: {
    label: "Emergency",
    message: "先處理安全：請立即求急症服務。",
  },
  reassurance: {
    label: "Step-by-step",
    message: "我會一步一步幫你整理比較準則。",
  },
};

const routeRows = [
  ["急症室", "胸痛、嚴重氣促、中風徵兆、大量出血、自傷即時風險"],
  ["即日求醫", "高燒伴嚴重症狀、急性眼痛、脫水、感染惡化"],
  ["普通科 / 家庭醫生", "輕微但持續症狀、慢性病覆診、初步評估"],
  ["持牌保險顧問", "購買保單、高額保障、複雜核保或索償爭議"],
];

const coverageRows = [
  "VHIS / 個人住院醫療",
  "高端醫療",
  "門診",
  "危疾",
  "人壽",
  "意外",
  "牙科",
  "產科",
  "旅遊",
];

const pipelineSteps = [
  "意圖分類",
  "危險徵兆偵測",
  "必要追問",
  "部門或保障配對",
  "安全檢查",
  "人工升級",
];

export function NavigationWorkspace() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [mode, setMode] = useState<IntakeMode>("medical");
  const [question, setQuestion] = useState(examples[0].prompt);
  const [isFocused, setIsFocused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authReady, setAuthReady] = useState(() => !supabase);
  const [saveHistory, setSaveHistory] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const [memoryStatus, setMemoryStatus] = useState<string | null>(null);
  const [isSavingMemory, startSavingMemory] = useTransition();

  const recommendation = useMemo(() => analyzeIntake(mode, question), [mode, question]);

  const syncUser = useCallback(
    async (nextUser: User | null) => {
      setUser(nextUser);
      setSaveHistory(Boolean(nextUser));

      if (!nextUser || !supabase) {
        setProfile(null);
        return;
      }

      try {
        const nextProfile = await getOrCreateProfile(nextUser, supabase);
        setProfile(nextProfile);
      } catch (error) {
        setMemoryStatus(
          error instanceof Error
            ? `未能載入用戶資料 / Could not load profile: ${error.message}`
            : "未能載入用戶資料 / Could not load profile.",
        );
      }
    },
    [supabase],
  );

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;

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
  }, [supabase, syncUser]);

  useEffect(() => {
    if (!isAnalyzing) return;

    const timeoutId = window.setTimeout(() => setIsAnalyzing(false), 460);

    return () => window.clearTimeout(timeoutId);
  }, [isAnalyzing, mode, question]);

  const handleModeSelect = (nextMode: IntakeMode) => {
    setMode(nextMode);
    setIsAnalyzing(true);
    setSavedSessionId(null);
    setMemoryStatus(null);
  };

  const handleQuestionChange = (nextQuestion: string) => {
    setQuestion(nextQuestion);
    setIsAnalyzing(nextQuestion.trim().length > 0);
    setSavedSessionId(null);
    setMemoryStatus(null);
  };

  const handleExampleSelect = (example: (typeof examples)[number]) => {
    setMode(example.mode);
    setQuestion(example.prompt);
    setIsRecording(false);
    setIsAnalyzing(true);
    setSavedSessionId(null);
    setMemoryStatus(null);
  };

  const handleSignOut = () => {
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
  };

  const handleClearSession = () => {
    if (!supabase || !user || !savedSessionId) {
      setSavedSessionId(null);
      setMemoryStatus("已清除本機狀態。Local session state cleared.");
      return;
    }

    startSavingMemory(async () => {
      try {
        await clearSession(savedSessionId, user.id, supabase);
        setSavedSessionId(null);
        setMemoryStatus("已清除今次雲端紀錄。Saved session cleared.");
      } catch (error) {
        setMemoryStatus(
          error instanceof Error
            ? `清除失敗 / Could not clear: ${error.message}`
            : "清除失敗 / Could not clear saved session.",
        );
      }
    });
  };

  const handleSaveRecommendation = () => {
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
        const session = await saveConversationSession(
          user.id,
          mapRecommendationMode(recommendation.mode),
          question.slice(0, 72),
          "zh-Hant",
          supabase,
        );
        const safetyLevel = getSafetyLevel(recommendation);

        await Promise.all([
          saveConversationMessage(session.id, user.id, "user", question, safetyLevel, supabase),
          saveConversationMessage(
            session.id,
            user.id,
            "assistant",
            `${recommendation.classification}\n${recommendation.nextAction}`,
            safetyLevel,
            supabase,
          ),
          saveUserPreference(
            user.id,
            "preferred_language",
            "zh-Hant",
            "explicit_user_choice",
            supabase,
          ),
          supabase
            .from("consent_events")
            .insert({
              user_id: user.id,
              consent_type: "save_memory",
              granted: true,
            })
            .then(({ error }) => {
              if (error) {
                throw new Error(`Could not save consent event: ${error.message}`);
              }
            }),
        ]);

        await saveRecommendation(user.id, session.id, recommendation, supabase);
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
  };

  const handleDeclineMemory = () => {
    setMemoryStatus("今次不會保存。This recommendation will not be saved.");
  };

  const avatarState = getAvatarState({
    isAnalyzing,
    isFocused,
    isRecording,
    recommendation,
  });

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <a className={styles.brand} href="#assistant" aria-label="香港 AI 醫療及保險導航">
          <span className={styles.brandMark}>
            <HeartPulse size={21} aria-hidden="true" />
          </span>
          <span>
            香港 AI 醫療及保險導航
            <small>AI Healthcare Navigation</small>
          </span>
        </a>
        <nav className={styles.nav} aria-label="Primary">
          <a href="#care-routes">醫療路徑</a>
          <a href="#coverage">保險分類</a>
          <a href="#memory">匿名記憶</a>
          <a href="#safety">安全規則</a>
        </nav>
        <div className={styles.topbarActions}>
          <button className={styles.langButton} type="button" aria-label="Language toggle">
            <Languages size={17} aria-hidden="true" />
            繁 / EN
          </button>
          <UserMenu
            user={user}
            profile={profile}
            saveHistory={saveHistory}
            hasSavedSession={Boolean(savedSessionId)}
            onToggleSaveHistory={setSaveHistory}
            onSignOut={handleSignOut}
            onClearSession={handleClearSession}
            onUpgradeAccount={() => setShowUpgrade(true)}
          />
        </div>
      </header>

      <section className={styles.hero} id="assistant">
        <div className={styles.heroCopy}>
          <h1>香港 Virtual AI Doctor</h1>
          <p>
            以安全分流為先的醫療及保險導航。先判斷緊急程度，再整理第一步就醫點、可能相關部門和可考慮保障。
          </p>
          <div className={styles.heroActions} aria-label="Primary actions">
            <a href="#workspace" className={styles.primaryAction}>
              開始導航
              <ArrowRight size={17} aria-hidden="true" />
            </a>
            <a href="#safety" className={styles.secondaryAction}>
              查看安全規則
            </a>
          </div>
          <div className={styles.safetyStrip} id="safety">
            <AlertTriangle size={18} aria-hidden="true" />
            <span>如有胸痛、嚴重氣促、中風徵兆、昏迷、大量出血或自傷即時風險，請立即致電 999 或前往最近急症室。</span>
          </div>
        </div>

        <AdviserStage
          avatarState={avatarState}
          mode={mode}
          recommendation={recommendation}
          isRecording={isRecording}
          onToggleRecording={() => setIsRecording((current) => !current)}
        />
      </section>

      <section className={styles.authGrid} id="memory" aria-label="Login and anonymous use">
        {!user || showUpgrade ? (
          <AuthPanel
            supabase={supabase}
            user={user}
            variant={showUpgrade ? "upgrade" : "start"}
            onUserReady={setUser}
            onProfileReady={(nextProfile) => {
              setProfile(nextProfile);
              setSaveHistory(true);
              setShowUpgrade(false);
            }}
          />
        ) : null}

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
      </section>

      <section className={styles.workspace} id="workspace" aria-label="AI navigation workspace">
        <div className={styles.intakePanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>輸入 / Question Intake</p>
              <h2>描述你的情況</h2>
            </div>
            <MessageSquareText size={22} aria-hidden="true" />
          </div>

          <div className={styles.modeGrid} role="tablist" aria-label="Choose workflow">
            {(Object.keys(modeCopy) as IntakeMode[]).map((key) => {
              const Icon = modeCopy[key].icon;
              return (
                <button
                  className={key === mode ? styles.modeActive : styles.modeButton}
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={key === mode}
                  onClick={() => handleModeSelect(key)}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{modeCopy[key].label}</span>
                </button>
              );
            })}
          </div>

          <label className={styles.inputLabel} htmlFor="question">
            自然語言輸入
          </label>
          <div className={styles.inputShell}>
            <textarea
              id="question"
              className={styles.textarea}
              value={question}
              onBlur={() => setIsFocused(false)}
              onChange={(event) => handleQuestionChange(event.target.value)}
              onFocus={() => setIsFocused(true)}
              rows={7}
            />
            <button
              type="button"
              className={isRecording ? styles.micActive : styles.micButton}
              onClick={() => setIsRecording((current) => !current)}
              aria-pressed={isRecording}
            >
              <Mic size={18} aria-hidden="true" />
              {isRecording ? "聆聽中" : "語音"}
            </button>
          </div>

          <div className={styles.exampleGrid} aria-label="Example prompts">
            {examples.map((example) => (
              <button
                type="button"
                key={example.label}
                className={styles.exampleButton}
                onClick={() => handleExampleSelect(example)}
              >
                {example.label}
              </button>
            ))}
          </div>

          <div className={styles.workflowNote}>
            <Activity size={18} aria-hidden="true" />
            <span>{modeCopy[mode].description}</span>
          </div>

          <div className={styles.pipeline} aria-label="AI workflow preview">
            {pipelineSteps.map((step, index) => (
              <span className={index < activePipelineIndex(recommendation) ? styles.pipelineDone : styles.pipelineStep} key={step}>
                {step}
              </span>
            ))}
          </div>
        </div>

        <RecommendationPanel
          recommendation={recommendation}
          canSave={Boolean(user && saveHistory)}
          isSaved={Boolean(savedSessionId)}
          isSaving={isSavingMemory}
          memoryStatus={memoryStatus}
          onSave={handleSaveRecommendation}
          onDecline={handleDeclineMemory}
        />
      </section>

      <section className={styles.referenceGrid}>
        <div className={styles.referencePanel} id="care-routes">
          <div className={styles.sectionTitle}>
            <Hospital size={20} aria-hidden="true" />
            <h2>香港常見醫療路徑</h2>
          </div>
          <div className={styles.routeList}>
            {routeRows.map(([title, body]) => (
              <div className={styles.routeRow} key={title}>
                <strong>{title}</strong>
                <span>{body}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.referencePanel} id="coverage">
          <div className={styles.sectionTitle}>
            <ShieldCheck size={20} aria-hidden="true" />
            <h2>可導航的保障類型</h2>
          </div>
          <div className={styles.coverageGrid}>
            {coverageRows.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>

        <div className={styles.referencePanel}>
          <div className={styles.sectionTitle}>
            <ClipboardCheck size={20} aria-hidden="true" />
            <h2>審計紀錄及交接</h2>
          </div>
          <p className={styles.referenceCopy}>
            MVP 只會在用戶同意後保存問題、分類、建議、免責提示及升級決定，方便安全覆核、人工跟進及日後合規審計。
          </p>
          <div className={styles.handoff}>
            <UserRoundCheck size={18} aria-hidden="true" />
            <span>醫療危險徵兆、精神健康危機、複雜核保、高價值購買和索償爭議都應交由真人處理。</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function AdviserStage({
  avatarState,
  mode,
  recommendation,
  isRecording,
  onToggleRecording,
}: {
  avatarState: AvatarState;
  mode: IntakeMode;
  recommendation: Recommendation;
  isRecording: boolean;
  onToggleRecording: () => void;
}) {
  const copy = avatarCopy[avatarState];

  return (
    <aside className={`${styles.adviserStage} ${styles[`${avatarState}Stage`]}`} aria-label="Virtual AI adviser">
      <div className={styles.adviserTopline}>
        <span>
          <Bot size={16} aria-hidden="true" />
          AI 醫療導航，不取代醫生診斷
        </span>
        <strong>{copy.label}</strong>
      </div>

      <div className={styles.avatarFrame}>
        <div className={styles.avatarHalo} />
        <Image
          className={styles.avatarImage}
          src="/ai-doctor-avatar.svg"
          alt="Friendly virtual AI healthcare navigator"
          width={520}
          height={640}
          priority
        />
        <span className={styles.blinkLine} aria-hidden="true" />
        <span className={styles.speakingLine} aria-hidden="true" />
      </div>

      <div className={styles.adviserMessage}>
        <strong>{copy.message}</strong>
        <span>{modeCopy[mode].description}</span>
      </div>

      <div className={styles.adviserSteps} aria-label="Current analysis state">
        <span className={styles.stepLive}>
          <ShieldAlert size={15} aria-hidden="true" />
          {recommendation.urgency.label}
        </span>
        <span>{recommendation.classification}</span>
      </div>

      <button
        className={isRecording ? styles.voiceActive : styles.voiceButton}
        type="button"
        onClick={onToggleRecording}
        aria-pressed={isRecording}
      >
        <Mic size={18} aria-hidden="true" />
        {isRecording ? "停止聆聽" : "模擬語音輸入"}
      </button>
    </aside>
  );
}

function RecommendationPanel({
  recommendation,
  canSave,
  isSaved,
  isSaving,
  memoryStatus,
  onSave,
  onDecline,
}: {
  recommendation: Recommendation;
  canSave: boolean;
  isSaved: boolean;
  isSaving: boolean;
  memoryStatus: string | null;
  onSave: () => void;
  onDecline: () => void;
}) {
  return (
    <aside className={styles.resultPanel} aria-live="polite">
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.panelKicker}>結構化建議 / Structured Recommendation</p>
          <h2>導航結果</h2>
        </div>
        <StatusDot tone={recommendation.urgency.tone} />
      </div>

      <div className={`${styles.urgencyCard} ${styles[recommendation.urgency.tone]}`}>
        <span>{recommendation.urgency.label}</span>
        <strong>{recommendation.urgency.summary}</strong>
      </div>

      <ResultBlock title="問題類型" content={recommendation.classification} />
      <ResultBlock title="下一步行動" content={recommendation.nextAction} />
      <ResultBlock title="建議醫療路徑" content={recommendation.careRoute} />

      <ListBlock title="可能相關部門" items={recommendation.possibleDepartments} />
      <ListBlock title="可考慮保障" items={recommendation.insuranceCategories} />
      <ListBlock title="購買或求診前核對" items={recommendation.decisionChecklist} />

      {recommendation.questions.length > 0 ? (
        <div className={styles.questionBox}>
          <h3>只追問必要資料</h3>
          {recommendation.questions.map((question) => (
            <p key={question}>{question}</p>
          ))}
        </div>
      ) : null}

      <div className={styles.escalationBox}>
        <AlertTriangle size={18} aria-hidden="true" />
        <span>{recommendation.escalation}</span>
      </div>

      <MemoryConsentCard
        canSave={canSave}
        isSaved={isSaved}
        isSaving={isSaving}
        status={memoryStatus}
        onSave={onSave}
        onDecline={onDecline}
      />

      <div className={styles.auditBox}>
        <h3>審計紀錄 / Audit trail</h3>
        {recommendation.audit.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>

      <p className={styles.disclaimer}>{recommendation.disclaimer}</p>
    </aside>
  );
}

function ResultBlock({ title, content }: { title: string; content: string }) {
  return (
    <div className={styles.resultBlock}>
      <h3>{title}</h3>
      <p>{content}</p>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className={styles.listBlock}>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>
            <ArrowRight size={14} aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusDot({ tone }: { tone: Recommendation["urgency"]["tone"] }) {
  return <span className={`${styles.statusDot} ${styles[`${tone}Dot`]}`} aria-hidden="true" />;
}

function getAvatarState({
  isAnalyzing,
  isFocused,
  isRecording,
  recommendation,
}: {
  isAnalyzing: boolean;
  isFocused: boolean;
  isRecording: boolean;
  recommendation: Recommendation;
}): AvatarState {
  if (recommendation.urgency.level === 1) {
    return "emergency";
  }

  if (isRecording || isFocused) {
    return "listening";
  }

  if (isAnalyzing) {
    return "thinking";
  }

  if (recommendation.mode === "insurance" || recommendation.mode === "policy") {
    return "reassurance";
  }

  return "speaking";
}

function activePipelineIndex(recommendation: Recommendation) {
  if (recommendation.urgency.level === 1) {
    return 6;
  }

  if (recommendation.mode === "insurance" || recommendation.mode === "policy") {
    return 5;
  }

  return 4;
}
