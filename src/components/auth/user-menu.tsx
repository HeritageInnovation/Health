"use client";

import { LogOut, ShieldAlert, Trash2, UserRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/user-memory";
import styles from "@/components/navigation-workspace.module.css";

type UserMenuProps = {
  user: User | null;
  profile: Profile | null;
  saveHistory: boolean;
  hasSavedSession: boolean;
  onToggleSaveHistory: (enabled: boolean) => void;
  onSignOut: () => void;
  onClearSession: () => void;
  onUpgradeAccount: () => void;
};

export function UserMenu({
  user,
  profile,
  saveHistory,
  hasSavedSession,
  onToggleSaveHistory,
  onSignOut,
  onClearSession,
  onUpgradeAccount,
}: UserMenuProps) {
  const isAnonymous = Boolean(user?.is_anonymous || profile?.is_anonymous);

  return (
    <div className={styles.userMenu} aria-label="User profile">
      <div className={styles.userIdentity}>
        <span className={styles.avatar}>
          <UserRound size={17} aria-hidden="true" />
        </span>
        <div>
          <strong>
            {user
              ? isAnonymous
                ? "匿名用戶 / Anonymous user"
                : "已登入 / Logged-in user"
              : "未登入 / Not signed in"}
          </strong>
          <small>
            AI 醫療導航，不取代醫生診斷 / AI healthcare navigation, not a replacement
            for doctor diagnosis.
          </small>
        </div>
      </div>

      <label className={styles.saveToggle}>
        <input
          type="checkbox"
          checked={saveHistory}
          disabled={!user}
          onChange={(event) => onToggleSaveHistory(event.target.checked)}
        />
        <span>
          保存紀錄：{saveHistory && user ? "開啟" : "關閉"} / Save history:{" "}
          {saveHistory && user ? "on" : "off"}
        </span>
      </label>

      {isAnonymous ? (
        <div className={styles.anonymousWarning}>
          <ShieldAlert size={15} aria-hidden="true" />
          <span>
            匿名帳戶登出時會清除已保存的匿名雲端紀錄；如在升級前清除瀏覽器資料或更換裝置，亦可能無法取回。Anonymous saved cloud memory is cleared on sign out, and browser clearing or device changes before upgrade may still make it unrecoverable.
          </span>
        </div>
      ) : null}

      <div className={styles.userActions}>
        {isAnonymous ? (
          <button type="button" onClick={onUpgradeAccount}>
            保存紀錄並建立帳戶 / Upgrade
          </button>
        ) : null}
        <button type="button" disabled={!hasSavedSession} onClick={onClearSession}>
          <Trash2 size={14} aria-hidden="true" />
          清除今次紀錄 / Clear
        </button>
        <button type="button" disabled={!user} onClick={onSignOut}>
          <LogOut size={14} aria-hidden="true" />
          登出 / Sign out
        </button>
      </div>
    </div>
  );
}
