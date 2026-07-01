"use client";

import Image from "next/image";
import styles from "./navigation-workspace.module.css";

export type DoctorAvatarState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "emergency"
  | "reassuring";

type AvatarResultLike = {
  urgency?:
    | "emergency"
    | {
        level?: number;
        tone?: string;
      };
} | null;

export function getDoctorAvatarState({
  result,
  isSubmitting,
  input,
}: {
  result?: AvatarResultLike;
  isSubmitting: boolean;
  input: string;
}): DoctorAvatarState {
  if (isEmergencyResult(result)) {
    return "emergency";
  }

  if (isSubmitting) {
    return "thinking";
  }

  if (input.trim().length > 0) {
    return "listening";
  }

  if (result) {
    return "speaking";
  }

  return "idle";
}

export function DoctorAvatar({
  state,
  className,
  showSafetyLabel = false,
}: {
  state: DoctorAvatarState;
  className?: string;
  showSafetyLabel?: boolean;
}) {
  const stateCopy = getStateCopy(state);
  const avatarLabel = `Virtual AI healthcare guide status: ${stateCopy.en} / ${stateCopy.zh}`;

  return (
    <div
      className={`${styles.doctorAvatar} ${styles[`doctorAvatar_${state}`]} ${
        className ?? ""
      }`}
      data-avatar-state={state}
      aria-label={avatarLabel}
    >
      <div className={styles.avatarGlow} aria-hidden="true" />
      <Image
        className={styles.avatarPhoto}
        src="/virtual-doctor-avatar.png"
        alt="Friendly virtual AI healthcare guide, not a real doctor"
        width={642}
        height={914}
        priority
      />
      <span className={styles.avatarMouth} aria-hidden="true" />
      <span className={styles.avatarBlink} aria-hidden="true" />
      <span className={styles.avatarMicPulse} aria-hidden="true" />
      <span className={styles.avatarStatePill}>
        {stateCopy.zh}
        <small>{stateCopy.en}</small>
      </span>
      {showSafetyLabel ? (
        <span className={styles.avatarSafetyPill}>
          AI 醫療導航，不取代醫生診斷
          <small>AI healthcare navigation, not a replacement for doctor diagnosis</small>
        </span>
      ) : null}
    </div>
  );
}

function isEmergencyResult(result: AvatarResultLike | undefined) {
  if (!result) {
    return false;
  }

  if (result.urgency === "emergency") {
    return true;
  }

  return (
    typeof result.urgency === "object" &&
    (result.urgency?.level === 1 || result.urgency?.tone === "danger")
  );
}

function getStateCopy(state: DoctorAvatarState) {
  switch (state) {
    case "listening":
      return { zh: "正在聆聽", en: "Listening" };
    case "thinking":
      return { zh: "正在分析…", en: "Analyzing..." };
    case "speaking":
      return { zh: "正在解釋", en: "Speaking" };
    case "emergency":
      return { zh: "緊急優先", en: "Emergency first" };
    case "reassuring":
      return { zh: "安心跟進", en: "Reassuring" };
    case "idle":
    default:
      return { zh: "準備就緒", en: "Ready" };
  }
}
