\# DESIGN.md — ET617 End-Sem, Roll 25M1022



\*\*Card:\*\* P1 (Context-aware visual learning app) · T3 (Simple machines in household objects, Cl. 6–9) · L1 (rural govt-school learner) · C6 (Voice-first)



\## D1 — Educational problem

Many Class 6–9 students in rural government schools can recite the six simple-machine names (lever, pulley, wheel-and-axle, inclined plane, wedge, screw) but cannot recognise them in the objects around their own home — a doorknob, a bottle-opener, a water hand-pump. The gap is between textbook vocabulary and situated recognition. This app asks the learner to point their phone camera at a household object; an AI vision model identifies the object and names which simple machine it is (or is closest to), and the app then teaches \*why\*, using voice for learners who find reading English UI slower than listening in their own language.



Learning outcomes:

1\. \*\*Identify\*\* a simple machine in a photographed household object.

2\. \*\*Explain\*\*, in their own words (spoken), why that object makes a task easier.

3\. \*\*Distinguish\*\* two objects that look similar but use different simple-machine principles (e.g. a knife = wedge vs a screwdriver = wheel-and-axle).



Context of use: at home, evening, \~10–15 min, on a shared Android phone, variable/weak network.



\## D2 — Learner persona

\*\*Sanjay Pawar\*\*, 12, Class 7, government school (Marathi-medium) in rural Maharashtra. Uses his mother's Android phone for \~30 minutes most evenings after she returns from work. Prior knowledge: can name the six simple machines from his textbook chart but has never been asked to find one in a real object. Comfortable with voice notes on WhatsApp; slower and reluctant at typing, especially in English.



\*\*Misconceptions:\*\*

\- \*\*M1 – "Simple machines are mechanical devices, not everyday objects."\*\* He expects a simple machine to look like a diagram from the textbook, not a bottle-opener or a doorknob.

\- \*\*M2 – "A simple machine always reduces the effort needed, full stop."\*\* He doesn't yet distinguish force vs. distance trade-off.



\## D3 — Educational content (one activity)

Concept: a household object is examined, classified into one of the six simple machines, and the force/distance trade-off is explained in one spoken sentence + one visual before/after comparison.



Tasks (5, two formats):

1\. Photo-identify task — capture/upload a photo; AI names the object + machine type.

2\. Spoken-prediction task — "Why do you think this makes the job easier?" (voice answer, matched against expected keywords).

3\. Compare task — two objects (knife vs screwdriver) — pick which is a wedge.

4\. Misconception-check MCQ — "A ramp needs less force because the box is lighter on a ramp. True/False?" (targets M2).

5\. Second photo-identify task — different object, used as the post-check.



Feedback:

\- Correct → short voice confirmation + one extra "did you know" fact.

\- M1 triggered → voice: "It doesn't need gears or wires to be one. A simple machine is any tool that changes the force or direction you need to apply."

\- M2 triggered → voice: "You still do the same total work — simple machines let you trade force for distance, not remove the work."



\## D4 — Working application

5 connected screens/states: \*\*Capture → Identifying (loading) → Result (incl. misidentification/correction path) → Learning activity (voice prediction + feedback) → Practice/About\*\*. Identity token `25M1022` in the footer of every screen and on the About screen.



\*\*C6 (Voice-first) implementation:\*\* the Result screen's explanation is read aloud via the Web Speech API (`speechSynthesis`); the Learning-activity prediction question is answered by spoken input via `SpeechRecognition`, transcribed, matched, and responded to with synthesized speech — a full spoken-input + spoken-output loop.



\## D6 — AI functionality specification

\*\*Feature: object → simple-machine identification.\*\*

\- Input: a photo (base64 JPEG, client-compressed to <300KB) + a fixed prompt asking for `{object, machineType, confidence (0-1), explanation}` where `machineType` must be one of the 6 allowed values.

\- Model: Gemini vision (multimodal), called from a Vercel serverless function (`api/identify.js`) — key never exposed client-side.

\- Output check: server validates `machineType` is one of the 6 allowed enum values and `confidence` is a number; if either check fails, or confidence < 0.5, the response is relabelled `misidentified: true` \*\*before\*\* it reaches the learner.

\- Fallback: on `misidentified: true`, API timeout, or API error, the app shows "I'm not sure what this is — can you tell me?" and accepts a spoken correction, which becomes the object name for the rest of the activity (this directly answers the P1 design challenge).



\## D7 — Pedagogical rationale (design challenge answer)

The P1 design challenge asks how AI interpretations stay accurate and what happens on misidentification. We answer this structurally: every AI response is checked against a closed enum server-side, and anything uncertain is always routed to the same honest "I'm not sure" + voice-correction screen, never silently shown as fact. C6 (voice-first) was chosen because Sanjay's real barrier isn't reading ability but comfort/speed in a non-native UI language; speaking a prediction lowers the cost of attempting an answer versus typing.



\## D8 — Evaluation plan

\- Assessment items: tasks 1–5 above, scored right/wrong against expected machine type/keywords.

\- Log data: object photographed, AI-returned machine type + confidence, misidentification flag, spoken-answer transcript, M1/M2 trigger, time on task.

\- Success criterion: ≥4/5 correct on post-check, and learner verbally states the force/distance trade-off unprompted.

