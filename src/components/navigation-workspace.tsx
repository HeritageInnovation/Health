"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  FileText,
  HeartPulse,
  Languages,
  MessageSquareText,
  ShieldCheck,
  Stethoscope,
  UserRoundCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { analyzeIntake, type IntakeMode, type Recommendation } from "@/lib/navigation-engine";
import styles from "./navigation-workspace.module.css";

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

const modeCopy: Record<IntakeMode, { label: string; description: string; icon: typeof Stethoscope }> = {
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

export function NavigationWorkspace() {
  const [mode, setMode] = useState<IntakeMode>("medical");
  const [question, setQuestion] = useState(examples[0].prompt);
  const recommendation = useMemo(() => analyzeIntake(mode, question), [mode, question]);

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <a className={styles.brand} href="#assistant" aria-label="香港 AI 醫療及保險導航">
          <span className={styles.brandMark}>
            <HeartPulse size={21} aria-hidden="true" />
          </span>
          <span>
            香港 AI 醫療及保險導航
            <small>Virtual AI Doctor</small>
          </span>
        </a>
        <nav className={styles.nav} aria-label="Primary">
          <a href="#care-routes">醫療路徑</a>
          <a href="#coverage">保險分類</a>
          <a href="#safety">安全規則</a>
        </nav>
        <button className={styles.langButton} type="button" aria-label="Language toggle">
          <Languages size={17} aria-hidden="true" />
          繁 / EN
        </button>
      </header>

      <section className={styles.hero} id="assistant">
        <div className={styles.heroCopy}>
          <h1>香港 Virtual AI Doctor</h1>
          <p>
            醫療分流、就醫路徑、保障類型和真人交接，先處理風險，再整理選項。
          </p>
        </div>
        <div className={styles.safetyStrip} id="safety">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>如有胸痛、嚴重氣促、中風徵兆、昏迷、大量出血或自傷即時風險，請立即致電 999 或前往最近急症室。</span>
        </div>
      </section>

      <section className={styles.workspace} aria-label="AI navigation workspace">
        <div className={styles.intakePanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Question Intake</p>
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
                  onClick={() => setMode(key)}
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
          <textarea
            id="question"
            className={styles.textarea}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={7}
          />

          <div className={styles.exampleGrid} aria-label="Example prompts">
            {examples.map((example) => (
              <button
                type="button"
                key={example.label}
                className={styles.exampleButton}
                onClick={() => {
                  setMode(example.mode);
                  setQuestion(example.prompt);
                }}
              >
                {example.label}
              </button>
            ))}
          </div>

          <div className={styles.workflowNote}>
            <Activity size={18} aria-hidden="true" />
            <span>{modeCopy[mode].description}</span>
          </div>
        </div>

        <RecommendationPanel recommendation={recommendation} />
      </section>

      <section className={styles.referenceGrid}>
        <div className={styles.referencePanel} id="care-routes">
          <div className={styles.sectionTitle}>
            <Stethoscope size={20} aria-hidden="true" />
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
            MVP 會保留問題、分類、建議、免責提示及升級決定，方便安全覆核、人工跟進及日後合規審計。
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

function RecommendationPanel({ recommendation }: { recommendation: Recommendation }) {
  return (
    <aside className={styles.resultPanel} aria-live="polite">
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.panelKicker}>Structured Recommendation</p>
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

      <div className={styles.listBlock}>
        <h3>可能相關部門</h3>
        <ul>
          {recommendation.possibleDepartments.map((item) => (
            <li key={item}>
              <ArrowRight size={14} aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.listBlock}>
        <h3>可考慮保障</h3>
        <ul>
          {recommendation.insuranceCategories.map((item) => (
            <li key={item}>
              <ArrowRight size={14} aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>

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

      <div className={styles.auditBox}>
        <h3>Audit trail</h3>
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

function StatusDot({ tone }: { tone: Recommendation["urgency"]["tone"] }) {
  return <span className={`${styles.statusDot} ${styles[`${tone}Dot`]}`} aria-hidden="true" />;
}
