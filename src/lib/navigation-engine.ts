import {
  EMERGENCY_ESCALATION_COPY,
  INSURANCE_SAFETY_DISCLAIMER,
  MEDICAL_SAFETY_DISCLAIMER,
} from "./safety-copy";

export type IntakeMode = "medical" | "insurance" | "policy";

export type UrgencyLevel = 1 | 2 | 3 | 4;

export type Recommendation = {
  mode: IntakeMode;
  classification: string;
  urgency: {
    level: UrgencyLevel;
    label: string;
    tone: "danger" | "warning" | "steady" | "planning";
    summary: string;
  };
  nextAction: string;
  careRoute: string;
  possibleDepartments: string[];
  insuranceCategories: string[];
  questions: string[];
  decisionChecklist: string[];
  memoryCandidates: string[];
  escalation: string;
  disclaimer: string;
  audit: string[];
  matchedSignals: string[];
};

type Rule = {
  terms: string[];
  departments: string[];
  route: string;
};

const emergencyTerms = [
  "胸口痛",
  "胸痛",
  "chest pain",
  "氣促",
  "breathless",
  "shortness of breath",
  "呼吸困難",
  "呼吸唔到",
  "抖唔到氣",
  "喘唔到氣",
  "透唔到氣",
  "can't breathe",
  "cannot breathe",
  "difficulty breathing",
  "trouble breathing",
  "中風",
  "stroke",
  "面歪",
  "半身無力",
  "口齒不清",
  "講嘢含糊",
  "face drooping",
  "slurred speech",
  "severe allergic",
  "anaphylaxis",
  "allergic reaction",
  "嚴重過敏",
  "大量出血",
  "severe bleeding",
  "昏迷",
  "失去知覺",
  "unconscious",
  "passed out",
  "major trauma",
  "嚴重創傷",
  "抽搐",
  "seizure",
  "自殺",
  "自殘",
  "suicidal",
  "self harm",
  "想死",
  "唔想活",
  "不想活",
  "傷害自己",
  "傷害我自己",
  "hurt myself",
  "kill myself",
  "割脈",
  "cut myself",
  "cut my wrist",
  "overdose",
  "medication overdose",
  "服藥過量",
  "食藥過量",
  "中毒",
  "誤服",
  "误服",
  "食錯藥",
  "食错药",
  "食錯咗藥",
  "poisoning",
  "poisoned",
  "accidental ingestion",
  "ingested",
  "took too much medicine",
  "took too much medication",
  "took too many pills",
  "sudden severe headache",
  "突然劇烈頭痛",
];

const emergencyOverrideTerms = [
  "自殺",
  "自殘",
  "suicidal",
  "self harm",
  "想死",
  "唔想活",
  "不想活",
  "傷害自己",
  "傷害我自己",
  "hurt myself",
  "kill myself",
  "割脈",
  "cut myself",
  "cut my wrist",
  "overdose",
  "medication overdose",
  "服藥過量",
  "食藥過量",
  "誤服",
  "误服",
  "食錯藥",
  "食错药",
  "食錯咗藥",
  "accidental ingestion",
  "took too much medicine",
  "took too much medication",
  "took too many pills",
];

const activeEmergencyContextTerms = [
  "而家",
  "依家",
  "現在",
  "目前",
  "此刻",
  "啱啱",
  "剛剛",
  "點算",
  "應該點做",
  "應該去邊",
  "去急症",
  "睇急症",
  "call 999",
  "what should i do",
  "should i go",
  "right now",
  "currently",
  "at the moment",
  "just happened",
];

const liveEmergencyContextTerms = [
  "i have chest pain",
  "i'm having chest pain",
  "im having chest pain",
  "i am having chest pain",
  "my chest hurts",
  "i have shortness of breath",
  "i'm having shortness of breath",
  "im having shortness of breath",
  "i am having shortness of breath",
  "i have difficulty breathing",
  "i'm having difficulty breathing",
  "im having difficulty breathing",
  "i am having difficulty breathing",
  "i have trouble breathing",
  "i'm having trouble breathing",
  "im having trouble breathing",
  "i am having trouble breathing",
  "我胸痛",
  "我胸口痛",
  "我氣促",
  "我呼吸困難",
  "我呼吸唔到",
  "我抖唔到氣",
  "我喘唔到氣",
  "我透唔到氣",
];

const sameDayTerms = [
  "高燒",
  "high fever",
  "dehydration",
  "脫水",
  "persistent vomiting",
  "持續嘔吐",
  "發燒出疹",
  "發燒又出疹",
  "發燒同出疹",
  "fever with rash",
  "fever and rash",
  "rash with fever",
  "眼痛",
  "acute eye pain",
  "vision change",
  "視力變化",
  "感染惡化",
  "worsening infection",
  "哮喘",
  "asthma",
  "劇痛",
  "severe pain",
];

const departmentRules: Rule[] = [
  {
    terms: ["小朋友", "兒童", "child", "kid", "paediatric", "pediatric"],
    departments: ["兒科 / Paediatrics", "家庭醫學 / Family Medicine"],
    route: "小朋友症狀可先看普通科或兒科；如有危險徵兆，應立即求急症。",
  },
  {
    terms: ["發燒", "咳", "感冒", "flu", "fever", "cough"],
    departments: ["家庭醫學 / Family Medicine", "呼吸系統科 / Respiratory Medicine if persistent or severe"],
    route: "可先由普通科或家庭醫生評估；如症狀嚴重或惡化，應即日求醫。",
  },
  {
    terms: ["胃痛", "胃酸", "肚痛", "reflux", "stomach", "bowel", "diarrhea"],
    departments: ["家庭醫學 / Family Medicine", "腸胃肝臟科 / Gastroenterology if referred"],
    route: "通常先看普通科；醫生可按情況轉介腸胃肝臟科。",
  },
  {
    terms: ["皮膚", "痕", "疹", "濕疹", "暗瘡", "rash", "eczema", "acne", "itch"],
    departments: ["家庭醫學 / Family Medicine", "皮膚科 / Dermatology if persistent or referred"],
    route: "可先看普通科或家庭醫生，並準備相片、誘因、藥物及過敏史。",
  },
  {
    terms: ["眼", "視力", "eye", "vision"],
    departments: ["眼科 / Ophthalmology", "急症室 / A&E if acute or severe"],
    route: "急性眼痛或視力變化應即日求醫；輕微或慢性問題可先由普通科或眼科評估。",
  },
  {
    terms: ["耳", "鼻", "喉", "sinus", "ear", "throat"],
    departments: ["家庭醫學 / Family Medicine", "耳鼻喉科 / ENT if referred"],
    route: "多數可先看普通科；反覆、嚴重或持續情況可考慮耳鼻喉科。",
  },
  {
    terms: ["懷孕", "月經", "婦科", "生育", "pregnan", "period", "fertility", "gyna"],
    departments: ["婦女健康診所 / Women's Health Clinic", "婦產科 / Obstetrics & Gynaecology"],
    route: "可先看普通科或婦女健康診所；懷孕、月經或生育問題可考慮婦產科。",
  },
  {
    terms: ["關節", "骨", "運動", "扭傷", "跌倒", "joint", "bone", "sports", "sprain"],
    departments: ["骨科 / Orthopaedics", "物理治療 / Physiotherapy", "急症室 / A&E if severe trauma"],
    route: "視乎創傷和痛楚程度，可先看普通科、物理治療或即日急症服務。",
  },
  {
    terms: [
      "焦慮",
      "抑鬱",
      "失眠",
      "壓力",
      "恐慌",
      "驚恐",
      "情緒低落",
      "anxiety",
      "depression",
      "sleep",
      "stress",
      "burnout",
      "panic",
      "panic attack",
      "low mood",
    ],
    departments: ["家庭醫學 / Family Medicine", "精神科 / Psychiatry", "心理學家或輔導 / Psychology or Counselling"],
    route: "可先由普通科評估；如有自傷風險或即時危機，請立即求助。",
  },
  {
    terms: ["糖尿", "甲狀腺", "荷爾蒙", "diabetes", "thyroid", "hormone"],
    departments: ["家庭醫學 / Family Medicine", "內分泌及糖尿科 / Endocrinology if referred"],
    route: "可先看普通科安排初步檢查；需要時轉介內分泌及糖尿科。",
  },
  {
    terms: ["小便", "尿", "腎石", "kidney", "urinary", "stone"],
    departments: ["泌尿科 / Urology", "腎科 / Nephrology if referred"],
    route: "先看普通科；如劇痛、發燒或不能小便，應即日求醫。",
  },
  {
    terms: ["牙", "tooth", "dental"],
    departments: ["牙科 / Dentistry", "口腔頜面外科 / Oral & Maxillofacial Surgery if complex"],
    route: "牙痛或牙科問題通常先看牙醫；面部腫脹、發燒或吞嚥困難應即日求醫。",
  },
];

const insuranceSignals = [
  {
    terms: ["自僱", "freelance", "self-employed", "沒有僱主", "no employer"],
    categories: ["自願醫保 / 個人住院醫療", "危疾保險", "人壽保險 if dependants"],
    reason: "自僱或僱主福利不足時，住院醫療保障通常是第一層需要。",
  },
  {
    terms: ["小朋友", "家庭", "children", "family", "dependants"],
    categories: ["家庭住院醫療", "門診保險", "意外保險", "牙科保險"],
    reason: "家庭和小朋友較常涉及門診、兒科及意外風險。",
  },
  {
    terms: ["外籍", "expat", "international", "overseas", "海外"],
    categories: ["高端醫療保險", "國際醫療保障", "旅遊保險"],
    reason: "外籍或跨境生活者通常需要留意醫院網絡及香港以外保障。",
  },
  {
    terms: ["懷孕", "生育", "maternity", "pregnan"],
    categories: ["產科保險", "住院醫療", "門診產檢保障 if available"],
    reason: "產科保障通常有等候期和不保事項，需在計劃懷孕前比較。",
  },
  {
    terms: ["牙", "dental"],
    categories: ["牙科保險", "門診保險"],
    reason: "牙科保障通常需要單獨比較項目限額、網絡和等候期。",
  },
  {
    terms: ["旅遊", "travel"],
    categories: ["旅遊保險", "國際醫療保障 if frequent travel"],
    reason: "短期旅遊風險可用旅遊保險處理，長期跨境醫療則需比較國際醫療。",
  },
  {
    terms: ["按揭", "mortgage", "受養人", "income", "收入"],
    categories: ["危疾保險", "人壽保險", "收入保障類保障 if available"],
    reason: "有家庭責任或按揭時，患病或身故後的財務連續性需要額外考慮。",
  },
];

const insuranceContextTerms = [
  "保險",
  "保障",
  "保單",
  "索償",
  "理賠",
  "claim",
  "claims",
  "coverage",
  "covered",
  "cover",
  "policy",
  "premium",
  "waiting period",
  "exclusion",
  "benefit",
];

const policyContextTerms = [
  "保單",
  "索償",
  "理賠",
  "claim",
  "claims",
  "policy",
  "waiting period",
  "exclusion",
  "benefit",
  "條款",
  "保障表",
  "不保事項",
  "等候期",
  "拒賠",
  "自付額",
  "共同保險",
  "預先批核",
  "醫療收據",
];

const insuranceSafetyNudge =
  "如果你同時正出現胸痛、嚴重呼吸困難、中風徵象、昏迷、嚴重出血、嚴重過敏反應或其他危急情況，請先立即求醫，再處理保障或索償問題。";

const defaultMedicalDepartments = ["家庭醫學 / Family Medicine", "普通科醫生 / GP"];

export function analyzeIntake(mode: IntakeMode, input: string): Recommendation {
  const text = normalize(input);
  const emergencyMatches = matchTerms(text, emergencyTerms);
  const emergencyOverrideMatches = matchTerms(text, emergencyOverrideTerms);
  const activeEmergencyMatches = matchTerms(text, activeEmergencyContextTerms);
  const liveEmergencyContextMatches = matchTerms(text, liveEmergencyContextTerms);
  const sameDayMatches = matchTerms(text, sameDayTerms);
  const departmentMatch = departmentRules.find((rule) => matchTerms(text, rule.terms).length > 0);
  const insuranceMatches = insuranceSignals.filter((signal) => matchTerms(text, signal.terms).length > 0);
  const hasExplicitInsuranceContext = matchTerms(text, insuranceContextTerms).length > 0;
  const hasExplicitPolicyContext = matchTerms(text, policyContextTerms).length > 0;
  const hasActiveEmergencyContext = activeEmergencyMatches.length > 0;
  const hasLiveEmergencyContext = liveEmergencyContextMatches.length > 0;

  if (
    emergencyMatches.length > 0 &&
    (
      mode === "medical" ||
      !hasExplicitInsuranceContext ||
      hasActiveEmergencyContext ||
      hasLiveEmergencyContext ||
      emergencyOverrideMatches.length > 0
    )
  ) {
    return {
      mode: "medical",
      classification: "緊急醫療問題 / Urgent medical concern",
      urgency: {
        level: 1,
        label: "Level 1 緊急",
        tone: "danger",
        summary: "這可能是緊急情況。請立即致電 999 或前往最近的急症室。",
      },
      nextAction: "先處理安全問題：立即求急症服務，不要等待 AI 追問或保險確認。",
      careRoute: "香港急症室 / Accident & Emergency Department first",
      possibleDepartments: ["急症室 / A&E", "之後按評估可能轉介相關專科"],
      insuranceCategories: ["先求醫，保險和索償問題稍後再處理"],
      questions: [],
      decisionChecklist: [
        "立即致電 999 或前往最近急症室。",
        "如情況危急，不要等待保險確認或 AI 追問。",
        "安全後才整理保單、收據及索償資料。",
      ],
      memoryCandidates: [],
      escalation: EMERGENCY_ESCALATION_COPY,
      disclaimer: medicalDisclaimer(),
      audit: [
        emergencyOverrideMatches.length > 0
          ? "Detected emergency self-harm, overdose, or accidental ingestion wording."
          : "Detected emergency red-flag wording.",
        hasActiveEmergencyContext || hasLiveEmergencyContext
          ? "Detected live-symptom wording inside insurance context and prioritized emergency care."
          : "Stopped lengthy intake.",
        "Escalated to emergency care route.",
      ],
      matchedSignals: unique([
        ...emergencyMatches,
        ...emergencyOverrideMatches,
        ...activeEmergencyMatches,
        ...liveEmergencyContextMatches,
      ]),
    };
  }

  if (mode === "insurance") {
    if (hasExplicitPolicyContext) {
      return buildPolicyRecommendation(text, emergencyMatches);
    }

    return buildInsuranceRecommendation(text, insuranceMatches, emergencyMatches);
  }

  if (mode === "policy") {
    return buildPolicyRecommendation(text, emergencyMatches);
  }

  const urgency =
    sameDayMatches.length > 0
      ? {
          level: 2 as const,
          label: "Level 2 即日求醫",
          tone: "warning" as const,
          summary: "建議即日求醫，視乎嚴重程度可選普通科、私家診所或合適公營醫療服務。",
        }
      : {
          level: departmentMatch ? (3 as const) : (4 as const),
          label: departmentMatch ? "Level 3 非緊急醫生諮詢" : "Level 4 預防及規劃",
          tone: departmentMatch ? ("steady" as const) : ("planning" as const),
          summary: departmentMatch
            ? "暫未見明顯緊急危險徵兆，可先安排普通科或家庭醫生評估。"
            : "這較像計劃性查詢。可以整理資料，再安排非緊急諮詢或專業意見。",
        };

  return {
    mode,
    classification:
      sameDayMatches.length > 0
        ? "非緊急但需即日處理 / Same-day care"
        : "非緊急症狀導航 / Non-urgent symptom navigation",
    urgency,
    nextAction:
      sameDayMatches.length > 0
        ? "今日內安排醫療評估；如果症狀加重或出現胸痛、氣促、昏迷、中風徵兆等，立即改為急症處理。"
        : "先預約普通科或家庭醫生；如已有指定專科或長期病紀錄，可帶同相關資料求診。",
    careRoute:
      departmentMatch?.route ?? "可先由普通科或家庭醫生評估，再按需要轉介合適專科。",
    possibleDepartments: departmentMatch?.departments ?? defaultMedicalDepartments,
    insuranceCategories: inferInsuranceForCareRoute(departmentMatch),
    questions: [
      "年齡範圍是甚麼？",
      "症狀持續了多久，是否突然惡化？",
      "有沒有發燒、呼吸困難、劇痛、失去知覺或其他危險徵兆？",
      "你偏好公營、私營，還是先按可及性決定？",
    ],
    decisionChecklist: [
      "記錄症狀開始時間、變化和嚴重程度。",
      "列出已服用藥物、過敏史和既有病歷。",
      "帶同過往檢查報告、相片或體溫紀錄。",
      "如果出現新的危險徵兆，立即改為急症處理。",
    ],
    memoryCandidates: [
      "語言偏好：繁體中文 / English",
      "公營、私營或混合醫療偏好",
      "常用地區：港島、九龍或新界",
    ],
    escalation:
      "如出現危險徵兆、症狀快速惡化、嬰幼兒嚴重異常或精神健康危機，請立即求急症服務。",
    disclaimer: medicalDisclaimer(),
    audit: [
      sameDayMatches.length > 0
        ? "Detected same-day care signal."
        : "No emergency red flag detected from the provided text.",
      departmentMatch
        ? `Mapped to ${departmentMatch.departments[0]}.`
        : "Defaulted to GP/family doctor first route.",
      "Applied safe wording: possible department, not diagnosis.",
    ],
    matchedSignals: [
      ...sameDayMatches,
      ...(departmentMatch ? matchTerms(text, departmentMatch.terms) : []),
    ],
  };
}

function buildInsuranceRecommendation(
  text: string,
  matches: typeof insuranceSignals,
  emergencyMatches: string[],
): Recommendation {
  const categories = unique([
    ...matches.flatMap((match) => match.categories),
    ...(matches.length === 0
      ? [
          "自願醫保 / 個人住院醫療",
          "門診保險 if frequent clinic visits",
          "危疾及人壽 if dependants or mortgage",
        ]
      : []),
  ]);
  const includesEmergencyTerms = emergencyMatches.length > 0;

  return {
    mode: "insurance",
    classification: "保險規劃 / Insurance planning",
    urgency: {
      level: 4,
      label: "Level 4 規劃",
      tone: "planning",
      summary: "這是保障規劃問題，適合比較保障類型和準備與持牌顧問討論。",
    },
    nextAction: includesEmergencyTerms
      ? `${insuranceSafetyNudge} 如你是在比較保障或索償安排，先確認僱主保障、住院/門診需要、家庭責任、預算、既有病歷和公私營醫療偏好。`
      : "先確認僱主保障、住院/門診需要、家庭責任、預算、既有病歷和公私營醫療偏好。",
    careRoute: includesEmergencyTerms
      ? "這是保險規劃問題；若你提到的是正在發生的危急症狀，應先去急症室 / A&E，再處理保障。"
      : "不是醫療求診路徑；如同時有症狀或危險徵兆，先處理醫療安全。",
    possibleDepartments: [
      "持牌保險顧問 / Licensed insurance adviser",
      "如有健康症狀，先諮詢醫生",
    ],
    insuranceCategories: categories,
    questions: [
      "你是否香港居民或在港長住？",
      "有沒有僱主醫療、門診、牙科或家屬保障？",
      "你較偏好私家醫院、公營服務，還是兩者混合？",
      "有沒有受養人、按揭、既有病歷或計劃懷孕？",
      "每月或每年預算大約是多少？",
    ],
    decisionChecklist: [
      "每年保障額、病房級別和醫院網絡限制。",
      "自付額、共同保險、等候期和續保條款。",
      "既有病症、不保事項和核保要求。",
      "香港以外保障、預先批核和索償文件要求。",
    ],
    memoryCandidates: [
      "是否已有僱主醫療福利",
      "保險預算範圍",
      "住院、門診、牙科、產科、危疾或旅遊保障需要",
      "本地香港或國際保障偏好",
    ],
    escalation: `${INSURANCE_SAFETY_DISCLAIMER} 購買前應諮詢持牌保險顧問，並細閱保單條款、不保事項、等候期、核保要求及索償流程。`,
    disclaimer: insuranceDisclaimer(),
    audit: [
      "Classified as insurance planning.",
      matches.length > 0
        ? `Matched ${matches.length} insurance profile signal(s).`
        : "No specific profile signal; returned general priority framework.",
      includesEmergencyTerms
        ? "Detected emergency vocabulary inside insurance context and kept insurance classification with emergency-first safety wording."
        : "Avoided specific product recommendation.",
    ],
    matchedSignals: unique([
      ...matches.flatMap((match) =>
        match.terms.filter((term) => text.includes(term.toLowerCase())),
      ),
      ...emergencyMatches,
    ]),
  };
}

function buildPolicyRecommendation(
  text: string,
  emergencyMatches: string[],
): Recommendation {
  const categories = [
    "索償流程 / Claims process",
    "不保事項 / Exclusions",
    "等候期 / Waiting periods",
    "自付額或共同保險 / Deductible or co-insurance",
    "續保條款 / Renewal terms",
  ];
  const includesEmergencyTerms = emergencyMatches.length > 0;

  return {
    mode: "policy",
    classification: "索償或保單解釋 / Claims or policy explanation",
    urgency: {
      level: 4,
      label: "Level 4 文件理解",
      tone: "planning",
      summary: "這適合整理保單問題，但不能保證承保、核保或索償結果。",
    },
    nextAction: includesEmergencyTerms
      ? `${insuranceSafetyNudge} 準備保單條款、保障表、索償通知、醫療收據及保險公司回覆，逐項核對。`
      : "準備保單條款、保障表、索償通知、醫療收據及保險公司回覆，逐項核對。",
    careRoute: includesEmergencyTerms
      ? "如你提到的是正在發生的危急症狀，應先處理醫療安全；文件、索償和保單解釋可於情況穩定後再處理。"
      : "如文件問題背後涉及正在惡化的症狀，先處理醫療需要。",
    possibleDepartments: [
      "保險公司客戶服務",
      "持牌保險顧問",
      "醫療服務提供者的賬單或病歷部門",
    ],
    insuranceCategories: categories,
    questions: [
      "你想理解保障範圍、索償流程，還是拒賠原因？",
      "服務是在香港還是海外發生？",
      "是否涉及既有病症、等候期、網絡限制或預先批核？",
      "你希望輸出一份查問保險公司的問題清單嗎？",
    ],
    decisionChecklist: [
      "核對保障表、保單條款、不保事項和等候期。",
      "整理醫療收據、診斷證明、轉介信和保險公司回覆。",
      "確認索償時限、所需表格和補交文件方式。",
      "如涉及爭議或高額費用，交由持牌顧問或合規人員覆核。",
    ],
    memoryCandidates: [
      "保單類型和保障範圍摘要",
      "索償流程偏好和常用文件清單",
      "是否需要持牌顧問 handoff",
    ],
    escalation: `${INSURANCE_SAFETY_DISCLAIMER} 如涉及索償爭議、高額醫療費或產品購買決定，應交由持牌顧問或合規人員覆核。`,
    disclaimer: insuranceDisclaimer(),
    audit: [
      "Classified as policy or claims explanation.",
      text.length > 0
        ? "Prepared document-review checklist."
        : "No document text provided yet.",
      includesEmergencyTerms
        ? "Detected emergency vocabulary inside insurance context and kept claims/policy explanation with emergency-first safety wording."
        : "Avoided claims approval or denial decision.",
    ],
    matchedSignals: unique([
      ...matchTerms(text, policyContextTerms),
      ...emergencyMatches,
    ]),
  };
}

function inferInsuranceForCareRoute(rule?: Rule) {
  if (!rule) {
    return [
      "個人住院醫療 / VHIS-style inpatient coverage",
      "門診保險 if regular GP/specialist visits",
    ];
  }

  const joined = rule.departments.join(" ").toLowerCase();

  if (joined.includes("dentistry")) {
    return ["牙科保險", "門診保障 if dental add-on exists"];
  }

  if (joined.includes("obstetrics")) {
    return ["產科保險 if planning pregnancy", "住院醫療"];
  }

  if (joined.includes("physiotherapy") || joined.includes("orthopaedics")) {
    return [
      "意外保險",
      "門診或物理治療保障",
      "住院醫療 if surgery/hospitalization risk",
    ];
  }

  return [
    "門診保險",
    "住院醫療 / VHIS-style coverage if hospital care may be needed",
  ];
}

function normalize(input: string) {
  return input.trim().toLowerCase();
}

function matchTerms(text: string, terms: string[]) {
  if (!text) {
    return [];
  }

  return unique(terms.filter((term) => text.includes(term.toLowerCase())));
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function medicalDisclaimer() {
  return MEDICAL_SAFETY_DISCLAIMER;
}

function insuranceDisclaimer() {
  return INSURANCE_SAFETY_DISCLAIMER;
}
