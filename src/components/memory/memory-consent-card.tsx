"use client";

import { DatabaseZap, Eye, Save } from "lucide-react";
import { useState } from "react";
import styles from "@/components/navigation-workspace.module.css";

type MemoryConsentCardProps = {
  canSave: boolean;
  isSaved: boolean;
  isSaving: boolean;
  status: string | null;
  onSave: () => void;
  onDecline: () => void;
};

export function MemoryConsentCard({
  canSave,
  isSaved,
  isSaving,
  status,
  onSave,
  onDecline,
}: MemoryConsentCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <section className={styles.memoryCard} aria-label="Memory consent">
      <div className={styles.memoryHeader}>
        <DatabaseZap size={18} aria-hidden="true" />
        <div>
          <h3>保存今次建議 / Save this recommendation</h3>
          <p>
            我可以記住你的語言偏好、公私營醫療偏好、保險狀況及今次建議，方便下次提供更貼近你的建議。是否保存？
          </p>
          <p>
            I can remember your language preference, public/private healthcare preference,
            insurance status, and this recommendation so I can give more relevant suggestions
            next time. Save this?
          </p>
        </div>
      </div>

      <div className={styles.memoryActions}>
        <button
          className={styles.primaryAction}
          type="button"
          disabled={!canSave || isSaved || isSaving}
          onClick={onSave}
        >
          <Save size={15} aria-hidden="true" />
          {isSaved ? "已保存 / Saved" : "保存 / Save"}
        </button>
        <button type="button" disabled={isSaving} onClick={onDecline}>
          今次不要 / Not now
        </button>
        <button
          type="button"
          aria-expanded={showDetails}
          onClick={() => setShowDetails((current) => !current)}
        >
          <Eye size={15} aria-hidden="true" />
          查看會保存甚麼 / See what will be saved
        </button>
      </div>

      {showDetails ? (
        <div className={styles.memoryDetails}>
          <div>
            <strong>會保存 / Saved with consent</strong>
            <span>
              語言偏好、公私營醫療偏好、保險狀況、家庭/同行者背景、今次導航建議和交接意願。
              Language, care preference, insurance context, household context, this
              recommendation, and adviser handoff preference.
            </span>
          </div>
          <div>
            <strong>不會自動保存 / Not saved automatically</strong>
            <span>
              未確認診斷、詳細敏感病歷、精神健康危機細節、HKID、完整保單號碼、信用卡或付款資料。
              Unconfirmed diagnoses, sensitive medical history, mental health crisis details,
              HKID, full policy numbers, credit card, or payment details.
            </span>
          </div>
        </div>
      ) : null}

      {status ? (
        <p className={styles.memoryStatus} role="status" aria-live="polite" aria-atomic="true">
          {status}
        </p>
      ) : null}
    </section>
  );
}
