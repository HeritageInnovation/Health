# Hong Kong AI Healthcare & Insurance Navigation

A Hong Kong-focused virtual AI doctor and insurance navigation prototype.

The product posture is intentionally narrow: it helps users understand next steps,
possible care routes, insurance coverage categories, and escalation points. It is
not a doctor, insurer, broker, or licensed insurance intermediary.

## MVP Surface

- Bilingual Traditional Chinese-first intake for medical routing, insurance planning, and policy explanation.
- Safety-first triage with deterministic emergency red-flag handling before any future AI orchestration.
- Department and first-step routing with safe wording such as "possible department" and "if referred".
- Insurance guidance at coverage-category level only, with licensed-adviser escalation.
- Lightweight virtual AI adviser state UI for idle, listening, analyzing, explaining, reassurance, and emergency states.
- Anonymous-first entry points with account-upgrade and memory-consent copy.
- Audit trail preview for classification, safety decision, disclaimer, and handoff logic.

## Safety Rules

- Level 1 emergency signals stop intake and escalate to 999 or Accident & Emergency.
- Immediate self-harm, overdose, or suicide-risk wording is treated as Level 1 and escalates to 999 or Accident & Emergency.
- Level 2 same-day signals recommend same-day medical assessment.
- Level 3 non-urgent symptoms route to GP or family doctor first, with possible specialist follow-up.
- Level 4 planning questions cover prevention, insurance, claims, and document explanation.

The rule engine lives in `src/lib/navigation-engine.ts` and is covered by
`src/lib/navigation-engine.test.ts`.

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Verification

```bash
npm run lint
npm run test
npm run build
```

## Source Notes

The prototype copy uses the product brief plus official Hong Kong reference points:

- Hong Kong emergency assistance: 999.
- Hospital Authority public healthcare context: A&E and general out-patient clinics.
- VHIS as a Health Bureau policy initiative regulating individual indemnity hospital insurance plans.
- GovHK notes qualifying VHIS premiums may be tax deductible subject to rules and limits.
