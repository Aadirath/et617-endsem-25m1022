export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ diagnosis: 'unclear', feedback: "Let's look at this together." })
    return
  }

  const { equationText, correctAnswer, learnerAnswer, numericCorrect, explanationText } = req.body || {}
  if (!equationText || !explanationText) {
    res.status(400).json({ diagnosis: 'unclear', feedback: "I didn't catch an explanation — let's try again." })
    return
  }

  const ALLOWED = ['correct', 'm1-sign-flip', 'm2-distribution-balance', 'unclear']
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    res.status(200).json({ diagnosis: 'unclear', feedback: "Let's slow down and look at this one together.", reason: 'no-key' })
    return
  }

  try {
    const prompt = `A Class 8 student just solved this linear equation: "${equationText}", whose correct answer is x = ${correctAnswer}. The student's answer was x = ${learnerAnswer} (${numericCorrect ? 'correct' : 'incorrect'}). The student explained their reasoning as: "${explanationText}".

Classify this into exactly one of these four labels:
- "correct": sound reasoning, even if phrased simply or informally.
- "m1-sign-flip": they forgot to flip the sign of a term when moving it across the equals sign (e.g. said "add" where they needed to "subtract", or vice versa).
- "m2-distribution-balance": they distributed a term incorrectly, or applied an operation to only one side/part of the equation instead of the whole thing.
- "unclear": the explanation doesn't give enough real reasoning to diagnose (e.g. "I just knew it", a restated answer with no steps, or no real explanation).

Reply with ONLY compact JSON: {"diagnosis":"...", "feedback":"one short encouraging sentence for a 13-year-old, in simple English, addressing their specific reasoning"}.`

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    )

    if (!r.ok) {
      res.status(200).json({ diagnosis: 'unclear', feedback: "Let's slow down and look at this one together." })
      return
    }

    const data = await r.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      res.status(200).json({ diagnosis: 'unclear', feedback: "Let's slow down and look at this one together." })
      return
    }

    const parsed = JSON.parse(jsonMatch[0])
    if (!ALLOWED.includes(parsed.diagnosis)) {
      res.status(200).json({ diagnosis: 'unclear', feedback: "Let's slow down and look at this one together." })
      return
    }

    res.status(200).json({ diagnosis: parsed.diagnosis, feedback: parsed.feedback || "Let's keep going." })
  } catch {
    res.status(200).json({ diagnosis: 'unclear', feedback: "Let's slow down and look at this one together." })
  }
}
