# DESIGN.md — ET617 End-Sem, Roll 25M1022

**Card:** P4 (Adaptive tutor with automatic question generation) · T3 (Linear equations in one variable, Cl. 8) · L1 (rural govt-school learner) · C6 (Voice-first)

> Note: an earlier version of this file was committed for card P1/T3 before the card was corrected to P4. T3 is defined per-problem in the exam's option bank, so correcting P to P4 also changes T3's actual topic (from "simple machines" under P1 to "linear equations in one variable" under P4). This file supersedes that earlier commit.

## D1 — Educational problem
Class 8 students are often taught the mechanical steps for solving `ax + b = c` style equations but apply them as memorised moves rather than balance operations — so when a step changes (a variable on both sides, or brackets to expand) the memorised move breaks down and produces a specific, recognisable wrong answer rather than a random one. A fixed worksheet can't tell *why* an answer is wrong or respond to it; this app watches both the learner's numeric answer and their spoken explanation of their own reasoning, diagnoses which specific misunderstanding (if any) produced the error, and adapts the next step accordingly — a harder question, a targeted re-explanation, or a prerequisite refresher.

Learning outcomes:
1. **Solve** one-step, two-step and variable-on-both-sides linear equations in one variable.
2. **Explain**, in their own words (spoken), the balance operation they used at each step.
3. **Recognise** two specific common errors in their own or a worked solution: a sign-flip error when moving a term across the equals sign, and an unbalanced/incomplete distribution error.

Context of use: at home, evening, ~10–15 min, on a shared Android phone, variable/weak network.

## D2 — Learner persona
**Sanjay Pawar**, 13, Class 8, government school (Marathi-medium) in rural Maharashtra. Uses his mother's Android phone for ~30 minutes most evenings after she returns from work. Prior knowledge: confident with one-step equations (`x + 3 = 7`) from Class 7, shaky on two-step and variable-on-both-sides equations introduced this year. Comfortable with voice notes on WhatsApp; slower and more reluctant at typing, especially explanations in English.

**Misconceptions:**
- **M1 – Sign-flip error.** When moving a term across the equals sign, he forgets to change its sign — e.g. for `x + 3 = 7` he computes `x = 7 + 3` instead of `x = 7 - 3`.
- **M2 – Distribution/balance error.** When a term must be distributed or an operation applied to both sides, he applies it to only one side or only part of an expression — e.g. for `2(x + 3) = 10` he writes `2x + 3 = 10` instead of `2x + 6 = 10`.

## D3 — Educational content (one activity)
Concept: solving linear equations by maintaining balance on both sides, tiered by difficulty (one-step → two-step → variable-on-both-sides), with the learner's spoken reasoning diagnosed after every question.

Tasks (4 formats across the session):
1. **Multiple-choice** — Tier 1, one-step equations (`x + a = b`).
2. **Numeric entry** (typed or spoken) — Tier 2, two-step equations (`ax + b = c`).
3. **Multiple-choice with targeted distractors** — Tier 3, variable-on-both-sides (`ax + b = cx + d`), where the wrong options are exactly the answers M1 and M2 would produce.
4. **Open-response spoken explanation** — after every numeric/MCQ answer, "explain how you solved it" (always spoken-first, typed fallback), evaluated by AI for both correctness and misconception diagnosis.

Feedback (the three design-challenge outcomes — see D7):
- Correct answer + sound reasoning → **harder question** (tier increases).
- Wrong answer / explanation matches a named misconception → **alternative, targeted explanation**, same tier, try again.
- Wrong answer / explanation too unclear to diagnose (no real step-by-step reasoning offered) → **prerequisite instruction** (a short refresher on signed-number arithmetic, the foundation under both M1 and M2), then retry at the same tier.

## D4 — Working application
6 connected screens/states: **Start → Question (3 answer formats across tiers) → Explain (spoken reasoning capture) → Decision (shows which of the 3 outcomes fired, and why) → Prerequisite refresher (only on that branch) → Progress/About**. Identity token `25M1022` in the footer of every screen and on the About screen.

**C6 (Voice-first) implementation:** every question is read aloud via `speechSynthesis` on arrival; the numeric-entry format and the explanation step both accept spoken input via `SpeechRecognition`; every decision outcome is read aloud as well as shown on screen — a full spoken-input + spoken-output loop, not just a voice add-on to a text-first design.

## D6 — AI functionality specification
**Feature: diagnosing a learner's spoken explanation of their own reasoning.**
- Input to the model: the equation text, the correct answer, the learner's submitted numeric answer (and whether it was correct), and the learner's spoken explanation transcript.
- Model: Gemini (text), called from a Vercel serverless function (`api/evaluate.js`) — key never exposed client-side.
- Output: the model is asked for exactly one of four labels — `correct`, `m1-sign-flip`, `m2-distribution-balance`, `unclear` — plus one short feedback sentence.
- Output check: the server validates the returned label is one of those four exact values; anything else (malformed JSON, an invented label, missing field) is treated as a failed call.
- Fallback: if the API call fails, times out, or the label fails validation, the server does **not** guess — it returns `unclear` with a generic "let's slow down and look at this together" feedback line, which routes the learner down the prerequisite-instruction branch rather than ever showing a confident but unverified diagnosis.

**Note on question generation:** the equations themselves (numbers, tier shape) are generated programmatically with randomised parameters appropriate to the current tier — this is the "automatic question generation" the problem asks for, driven by the learner's tier (itself driven by performance). The AI's role is specifically the harder, genuinely AI-shaped task: reading free-form spoken reasoning and diagnosing *which* misconception it reveals, which a template or regex cannot reliably do.

## D7 — Pedagogical rationale (design challenge answer)
**Decision rule:** after each question, the tutor looks at two signals together — numeric correctness and the explanation diagnosis — not numeric correctness alone (a correct number can hide a lucky guess, and the explanation is what actually reveals *why*).
- If the explanation is diagnosed `correct` (whatever the numeric answer) → **harder question**: the only sound indicator of readiness to progress is correct reasoning, not just a correct number.
- If the explanation is diagnosed `m1-sign-flip` or `m2-distribution-balance` → **alternative, targeted explanation** at the same tier: the learner has a specific, nameable misunderstanding, so the fix is to address that misunderstanding directly, not to re-teach the whole topic or escalate difficulty.
- If the explanation is diagnosed `unclear` → **prerequisite instruction**: the learner can't yet articulate their own reasoning at all, which usually means the gap is a level below the current tier (signed-number arithmetic), not in the equation-solving procedure itself.

This directly uses C6 (voice-first): Sanjay's real barrier for an "explain your reasoning" task is not whether he understands the maths, but whether he's willing/able to type an explanation in a non-native UI language — removing the typing step is what makes this diagnostic signal available at all for this learner.

## D8 — Evaluation plan
- Assessment items: the tier-1/2/3 question formats above, each auto-graded for numeric correctness; explanations graded by the AI diagnosis label.
- Log data: per round — tier, equation, numeric answer, correct/incorrect, explanation transcript, diagnosis label, which of the 3 outcomes fired, time on task.
- Success criterion: learner reaches Tier 3 within the session, and at least one `m1-sign-flip` or `m2-distribution-balance` instance is correctly resolved (i.e. the same misconception does not recur after its targeted explanation is shown).
