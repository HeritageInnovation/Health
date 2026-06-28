# Product polish opportunities

_Last reviewed: 2026-06-28_

## Current repo read

The product is a Hong Kong-focused healthcare and insurance navigation prototype. The current implementation already has a strong safety-first foundation:

- `src/lib/navigation-engine.ts` classifies medical, insurance, and policy/claims prompts.
- Emergency red flags are handled deterministically before normal intake continues.
- The engine returns useful trust-building metadata through `audit` and `matchedSignals`.
- `src/lib/navigation-engine.test.ts` covers emergency routing, same-day care, pediatric routing, mental wellness routing, insurance planning, policy explanation, and mixed emergency/insurance questions.
- `src/components/navigation-workspace.tsx` presents a polished mobile-style intake and result flow with memory consent and emergency escalation.

There are no open GitHub issues or pull requests guiding the next change, so the best next step should be a small, high-confidence product polish improvement that uses existing data rather than adding new routing complexity.

## Highest-value small improvements

1. **Show safety reasoning in the result card**
   - Why: the engine already returns `audit` and `matchedSignals`, and the README describes an audit trail preview. Surfacing this in the UI would make recommendations feel more transparent and trustworthy, especially for Level 1 emergency and insurance-policy boundary cases.
   - Scope: UI-only; no rule changes required.
   - Suggested placement: below the preparation/follow-up lists in `ResultCard`, before the escalation box.
   - Suggested copy: `判斷依據 / Safety reasoning` for audit entries and `識別到的訊號 / Detected signals` for matched signals.

2. **Make the public/private preference visibly affect the result**
   - Why: the top control toggles public/private preference and memory can save it, but the visible recommendation does not yet reflect the choice.
   - Scope: add a small preference note in the result card such as public-first, private-first, or mixed-route wording. Keep the clinical routing unchanged.

3. **Replace the inactive language button with explicit bilingual state**
   - Why: the language control currently looks interactive but does not change the UI language.
   - Scope: either make it a disabled/status pill for the MVP, or wire it to a real language preference later.

4. **Clarify voice input state**
   - Why: the microphone button toggles recording UI state but does not capture speech.
   - Scope: add temporary status copy such as `語音輸入即將推出 / Voice input coming soon`, or hide the control until speech capture is implemented.

## Recommended next incremental change

Implement improvement 1 first: render `result.audit` and `result.matchedSignals` in the result card.

This is the most useful small change because it turns existing backend data into user-facing trust, aligns with the README's audit-trail promise, and avoids changing safety behavior. A focused implementation would only touch `src/components/navigation-workspace.tsx`, with optional small CSS refinements in `src/components/navigation-workspace.module.css` if the existing list styling is not enough.

Expected acceptance checks:

- Emergency examples still show the 999/A&E escalation first and clearly.
- Non-emergency examples show a concise reasoning trail without overwhelming the main next step.
- Empty `matchedSignals` does not render an empty section.
- `npm run test` continues to pass because routing behavior is unchanged.
- `npm run lint` passes after the JSX update.
