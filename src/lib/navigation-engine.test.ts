import { describe, expect, it } from "vitest";
import { analyzeIntake } from "./navigation-engine";
import {
  EMERGENCY_ESCALATION_COPY,
  INSURANCE_SAFETY_DISCLAIMER,
  MEDICAL_SAFETY_DISCLAIMER,
} from "./safety-copy";

describe("navigation engine", () => {
  it("escalates chest pain and breathlessness without follow-up questions", () => {
    const result = analyzeIntake("medical", "我胸口痛，又覺得氣促，應該去邊度？");

    expect(result.urgency.level).toBe(1);
    expect(result.nextAction).toContain("立即");
    expect(`${result.urgency.summary} ${result.escalation}`).toContain("999");
    expect(`${result.careRoute} ${result.possibleDepartments.join(" ")}`).toContain("A&E");
    expect(result.questions).toHaveLength(0);
    expect(result.possibleDepartments).toContain("急症室 / A&E");
  });

  it("escalates common Cantonese emergency breathing phrasing", () => {
    const result = analyzeIntake("medical", "我依家呼吸唔到，應該點做？");

    expect(result.mode).toBe("medical");
    expect(result.urgency.level).toBe(1);
    expect(result.questions).toHaveLength(0);
    expect(result.escalation).toBe(EMERGENCY_ESCALATION_COPY);
    expect(result.matchedSignals).toEqual(
      expect.arrayContaining(["依家", "呼吸唔到", "應該點做"]),
    );
  });

  it("escalates accidental ingestion wording without follow-up questions", () => {
    const result = analyzeIntake("medical", "小朋友啱啱誤服清潔劑，應該點做？");

    expect(result.mode).toBe("medical");
    expect(result.urgency.level).toBe(1);
    expect(result.questions).toHaveLength(0);
    expect(result.escalation).toBe(EMERGENCY_ESCALATION_COPY);
    expect(result.matchedSignals).toEqual(
      expect.arrayContaining(["啱啱", "誤服", "應該點做"]),
    );
  });

  it("escalates live medication overdose wording inside insurance questions", () => {
    const result = analyzeIntake(
      "insurance",
      "I just took too much medicine. Will my insurance cover A&E?",
    );

    expect(result.mode).toBe("medical");
    expect(result.urgency.level).toBe(1);
    expect(result.questions).toHaveLength(0);
    expect(result.nextAction).toContain("立即求急症服務");
    expect(result.escalation).toBe(EMERGENCY_ESCALATION_COPY);
    expect(result.matchedSignals).toEqual(
      expect.arrayContaining(["took too much medicine"]),
    );
  });

  it("routes persistent itchy skin to GP and possible dermatology", () => {
    const result = analyzeIntake("medical", "我皮膚痕咗兩個星期，應該睇咩醫生？");

    expect(result.urgency.level).toBe(3);
    expect(result.careRoute).toContain("普通科");
    expect(result.possibleDepartments.join(" ")).toContain("皮膚科");
    expect(result.disclaimer).toContain("不作診斷");
  });

  it("routes child fever with rash to same-day paediatric guidance", () => {
    const result = analyzeIntake("medical", "小朋友發燒又出疹兩日，應該睇咩科？");

    expect(result.urgency.level).toBe(2);
    expect(result.classification).toContain("Same-day care");
    expect(result.nextAction).toContain("今日內安排醫療評估");
    expect(result.possibleDepartments.join(" ")).toContain("兒科");
    expect(result.careRoute).toContain("小朋友");
    expect(result.matchedSignals).toEqual(
      expect.arrayContaining(["發燒又出疹", "小朋友"]),
    );
  });

  it("routes English child fever with rash wording to same-day care", () => {
    const result = analyzeIntake("medical", "My child has fever with rash for two days.");

    expect(result.urgency.level).toBe(2);
    expect(result.possibleDepartments.join(" ")).toContain("Paediatrics");
    expect(result.matchedSignals).toEqual(
      expect.arrayContaining(["fever with rash", "child"]),
    );
  });

  it("routes Cantonese infant fever and low responsiveness wording to same-day paediatric guidance", () => {
    const result = analyzeIntake("medical", "BB 發燒同好冇精神，應該點做？");

    expect(result.urgency.level).toBe(2);
    expect(result.classification).toContain("Same-day care");
    expect(result.nextAction).toContain("今日內安排醫療評估");
    expect(result.possibleDepartments.join(" ")).toContain("兒科");
    expect(result.careRoute).toContain("小朋友");
    expect(result.matchedSignals).toEqual(
      expect.arrayContaining(["bb", "發燒", "好冇精神"]),
    );
  });

  it("routes English infant fever and lethargy wording to same-day care", () => {
    const result = analyzeIntake("medical", "My infant has a fever and is lethargic.");

    expect(result.urgency.level).toBe(2);
    expect(result.possibleDepartments.join(" ")).toContain("Paediatrics");
    expect(result.matchedSignals).toEqual(
      expect.arrayContaining(["infant", "fever", "lethargic"]),
    );
  });

  it("routes stress and panic wording to mental wellness support", () => {
    const result = analyzeIntake("medical", "最近工作壓力好大，失眠同 panic attack，應該點樣求助？");

    expect(result.urgency.level).toBe(3);
    expect(result.possibleDepartments.join(" ")).toContain("Psychology or Counselling");
    expect(result.careRoute).toContain("普通科");
    expect(result.matchedSignals).toEqual(expect.arrayContaining(["失眠", "壓力", "panic"]));
  });

  it("does not treat generic infant insurance planning as an emergency", () => {
    const result = analyzeIntake("insurance", "想幫嬰兒比較住院醫療同門診保障。");

    expect(result.urgency.level).toBe(4);
    expect(result.classification).toContain("保險規劃");
    expect(result.escalation).toContain("持牌保險顧問");
    expect(result.escalation).not.toBe(EMERGENCY_ESCALATION_COPY);
  });

  it("keeps insurance planning at category level for self-employed users", () => {
    const result = analyzeIntake("insurance", "我 35 歲，自僱，住香港，沒有僱主醫療，應該買咩保險？");
    const output = [
      result.nextAction,
      result.careRoute,
      ...result.possibleDepartments,
      ...result.insuranceCategories,
      ...result.decisionChecklist,
    ].join(" ");

    expect(result.urgency.level).toBe(4);
    expect(result.insuranceCategories.join(" ")).toContain("自願醫保");
    expect(result.decisionChecklist.join(" ")).toContain("等候期");
    expect(result.memoryCandidates.join(" ")).toContain("僱主醫療福利");
    expect(result.escalation).toContain("持牌保險顧問");
    expect(result.disclaimer).toContain("不會保證承保");
    expect(output).not.toMatch(/AIA|友邦|Bupa|AXA|安盛|Cigna|Prudential|保誠|Manulife|宏利/i);
  });

  it("routes policy and claims wording through policy guidance even from the insurance entry point", () => {
    const result = analyzeIntake("insurance", "我想理解住院保單的不保事項、等候期和索償流程。");

    expect(result.mode).toBe("policy");
    expect(result.classification).toContain("索償");
    expect(result.insuranceCategories).toContain("不保事項 / Exclusions");
    expect(result.decisionChecklist.join(" ")).toContain("補交文件");
  });

  it("keeps stroke coverage questions in insurance mode and adds an emergency-first warning", () => {
    const result = analyzeIntake("insurance", "中風保險通常賠咩？如果真係出事，保障會點計？");

    expect(result.urgency.level).toBe(4);
    expect(result.classification).toContain("保險規劃");
    expect(result.nextAction).toContain("請先立即求醫");
    expect(result.careRoute).toContain("A&E");
    expect(result.matchedSignals).toContain("中風");
  });

  it("keeps claims wording questions in policy mode even when emergency terms appear", () => {
    const result = analyzeIntake("policy", "保單入面寫中風同胸痛相關治療點樣索償？");

    expect(result.urgency.level).toBe(4);
    expect(result.classification).toContain("索償");
    expect(result.nextAction).toContain("請先立即求醫");
    expect(result.careRoute).toContain("先處理醫療安全");
    expect(result.matchedSignals).toEqual(
      expect.arrayContaining(["保單", "索償", "中風", "胸痛"]),
    );
  });

  it("escalates a live emergency even when the question is framed as insurance coverage", () => {
    const result = analyzeIntake("insurance", "我而家胸痛同呼吸困難，保險包唔包？應該點做？");

    expect(result.mode).toBe("medical");
    expect(result.urgency.level).toBe(1);
    expect(result.questions).toHaveLength(0);
    expect(result.nextAction).toContain("立即求急症服務");
    expect(result.escalation).toBe(EMERGENCY_ESCALATION_COPY);
    expect(result.matchedSignals).toEqual(
      expect.arrayContaining(["而家", "呼吸困難", "胸痛", "應該點做"]),
    );
  });

  it("escalates English live-emergency breathing wording even inside insurance questions", () => {
    const result = analyzeIntake(
      "insurance",
      "I can't breathe right now. Will my insurance cover A&E?",
    );

    expect(result.mode).toBe("medical");
    expect(result.urgency.level).toBe(1);
    expect(result.questions).toHaveLength(0);
    expect(result.escalation).toBe(EMERGENCY_ESCALATION_COPY);
    expect(result.matchedSignals).toEqual(
      expect.arrayContaining(["can't breathe", "right now"]),
    );
  });

  it("escalates self-harm crisis wording inside insurance questions even without extra timing words", () => {
    const result = analyzeIntake("insurance", "我想死同想傷害自己，住院保險會唔會賠？");

    expect(result.mode).toBe("medical");
    expect(result.urgency.level).toBe(1);
    expect(result.questions).toHaveLength(0);
    expect(result.nextAction).toContain("立即求急症服務");
    expect(result.escalation).toBe(EMERGENCY_ESCALATION_COPY);
    expect(result.disclaimer).toBe(MEDICAL_SAFETY_DISCLAIMER);
    expect(result.matchedSignals).toEqual(
      expect.arrayContaining(["想死", "傷害自己"]),
    );
  });

  it("escalates a live emergency even when the user asks about claims at the same time", () => {
    const result = analyzeIntake("policy", "我現在胸痛，保單索償之前係咪要先去急症？");

    expect(result.mode).toBe("medical");
    expect(result.urgency.level).toBe(1);
    expect(result.careRoute).toContain("A&E");
    expect(result.disclaimer).toBe(MEDICAL_SAFETY_DISCLAIMER);
  });

  it("treats policy explanation as claims and wording review, not an approval decision", () => {
    const result = analyzeIntake("policy", "我想理解住院保單的不保事項、等候期和索償流程。");

    expect(result.classification).toContain("索償");
    expect(result.insuranceCategories).toContain("不保事項 / Exclusions");
    expect(result.decisionChecklist.join(" ")).toContain("補交文件");
    expect(result.escalation).toContain("索償爭議");
  });

  it("does not propose saving memory during emergency routing", () => {
    const result = analyzeIntake("medical", "突然劇烈頭痛，又失去知覺");

    expect(result.urgency.level).toBe(1);
    expect(result.memoryCandidates).toHaveLength(0);
    expect(result.decisionChecklist.join(" ")).toContain("立即致電 999");
  });

  it("uses the required medical and emergency safety wording", () => {
    const result = analyzeIntake("medical", "我胸口痛，又覺得氣促，應該去邊度？");

    expect(result.disclaimer).toBe(MEDICAL_SAFETY_DISCLAIMER);
    expect(result.escalation).toBe(EMERGENCY_ESCALATION_COPY);
  });

  it("uses the required insurance safety wording", () => {
    const result = analyzeIntake("insurance", "我想了解住院醫療保障和索償流程。");

    expect(result.disclaimer).toBe(INSURANCE_SAFETY_DISCLAIMER);
    expect(result.escalation).toContain(INSURANCE_SAFETY_DISCLAIMER);
  });
});
