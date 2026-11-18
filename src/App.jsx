import { useState, useCallback, useRef } from 'react'
import './App.css'

const ROLL_NO = '25M1022'
const MAX_TIER = 3

function speak(text) {
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.95
    window.speechSynthesis.speak(u)
  } catch {
    // speech synthesis unavailable; on-screen text still carries the content
  }
}

const VOICE_ERROR_MESSAGES = {
  'not-allowed': 'Microphone access is blocked for this site. Click the padlock icon in your address bar → Site settings → Microphone → Allow, then reload the page.',
  'service-not-allowed': 'Microphone access is blocked for this site. Click the padlock icon in your address bar → Site settings → Microphone → Allow, then reload the page.',
  'no-speech': "Didn't catch anything — try speaking again, a bit closer to the mic.",
  'audio-capture': 'No microphone was found on this device.',
  'network': 'Speech recognition needs a network connection and one dropped — try again, or type instead.',
  'aborted': 'Listening stopped early — try again.',
}

function useVoiceInput(onResult) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState(null)
  const [supported] = useState(() => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
  const recRef = useRef(null)
  const timeoutRef = useRef(null)

  const start = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return
    setError(null)
    const rec = new SpeechRecognition()
    rec.lang = 'en-IN'
    rec.interimResults = false
    rec.continuous = false
    rec.maxAlternatives = 1
    rec.onresult = (e) => onResult(e.results[0][0].transcript)
    rec.onend = () => {
      setListening(false)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
    rec.onerror = (e) => {
      setListening(false)
      setError(e.error || 'unknown')
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
    recRef.current = rec
    setListening(true)
    try {
      rec.start()
      // Chrome can hang mid-listen without ever firing onend/onresult — force a stop after 12s so the UI never gets stuck.
      timeoutRef.current = setTimeout(() => {
        try { rec.stop() } catch { /* already stopped */ }
      }, 12000)
    } catch {
      setListening(false)
      setError('unknown')
    }
  }, [onResult])

  const stop = useCallback(() => {
    try { recRef.current?.stop() } catch { /* already stopped */ }
  }, [])

  return { start, stop, listening, supported, error }
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// targetMisconception, when set, biases which sub-shape of question gets generated
// within the current tier, so a diagnosed weakness is specifically re-exercised
// rather than just retried with a random question of the same difficulty.
function generateQuestion(tier, targetMisconception = null) {
  if (tier === 1) {
    // 'add' (x + a = b, solved by subtracting) is where the sign-flip trap (M1) is most
    // pronounced, so target it directly when that's the diagnosed weakness.
    const variant = targetMisconception === 'm1-sign-flip' ? 'add' : (Math.random() < 0.5 ? 'add' : 'subtract')
    const a = randInt(2, 9)
    const x = randInt(1, 9)
    if (variant === 'subtract') {
      const b = x - a
      const signFlipMistake = b - a // mistake: subtracting again instead of adding to isolate x
      const options = shuffle([...new Set([x, signFlipMistake, x + 1, x - 1])]).slice(0, 4)
      return {
        tier, format: 'mcq',
        equationText: `x - ${a} = ${b}`,
        prompt: `Solve for x: x minus ${a} equals ${b}.`,
        correctAnswer: x,
        options: options.includes(x) ? options : [...options.slice(0, 3), x],
      }
    }
    const b = x + a
    const signFlipMistake = b + a // mistake: adding instead of subtracting to isolate x
    const options = shuffle([...new Set([x, signFlipMistake, x + 1, x - 1])]).slice(0, 4)
    return {
      tier, format: 'mcq',
      equationText: `x + ${a} = ${b}`,
      prompt: targetMisconception === 'm1-sign-flip'
        ? `Solve for x: x plus ${a} equals ${b}. Remember — when a term crosses the equals sign, its sign flips.`
        : `Solve for x: x plus ${a} equals ${b}.`,
      correctAnswer: x,
      options: options.includes(x) ? options : [...options.slice(0, 3), x],
    }
  }
  if (tier === 2) {
    const a = randInt(2, 5)
    const x = randInt(1, 9)
    const b = randInt(1, 9)
    const c = a * x + b
    return {
      tier, format: 'numeric',
      equationText: `${a}x + ${b} = ${c}`,
      prompt: `Solve for x: ${a} x plus ${b} equals ${c}.`,
      correctAnswer: x,
    }
  }
  // tier 3: either 'distribute' (targets M2) or 'both-sides' (targets M1)
  const useDistribute = targetMisconception === 'm2-distribution-balance'
    ? true
    : targetMisconception === 'm1-sign-flip'
    ? false
    : Math.random() < 0.5

  if (useDistribute) {
    const a = randInt(2, 4)
    const x = randInt(1, 6)
    const b = randInt(1, 5)
    const c = a * (x + b)
    const forgotToDistribute = Math.round((c - b) / a) // mistake: treats it as ax + b = c instead of ax + ab = c
    const options = shuffle([...new Set([x, forgotToDistribute, x + 1, x - 1])]).slice(0, 4)
    return {
      tier, format: 'mcq',
      equationText: `${a}(x + ${b}) = ${c}`,
      prompt: `Solve for x: ${a} times, open bracket, x plus ${b}, close bracket, equals ${c}.`,
      correctAnswer: x,
      options: options.includes(x) ? options : [...options.slice(0, 3), x],
    }
  }

  const a = randInt(3, 6)
  const c = randInt(1, a - 1)
  const x = randInt(1, 6)
  const b = randInt(1, 6)
  const d = (a - c) * x + b
  const signFlip = -x
  const options = shuffle([...new Set([x, signFlip, x + 1, x - 1])]).slice(0, 4)
  return {
    tier, format: 'mcq',
    equationText: `${a}x + ${b} = ${c}x + ${d}`,
    prompt: `Solve for x: ${a} x plus ${b} equals ${c} x plus ${d}.`,
    correctAnswer: x,
    options: options.includes(x) ? options : [...options.slice(0, 3), x],
  }
}

function Footer() {
  return (
    <footer className="footer">
      <span>ET617 End-Sem · Roll {ROLL_NO}</span>
    </footer>
  )
}

export default function App() {
  const [screen, setScreen] = useState('start')
  const [tier, setTier] = useState(1)
  const [question, setQuestion] = useState(null)
  const [numericAnswer, setNumericAnswer] = useState('')
  const [numericCorrect, setNumericCorrect] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [explanationText, setExplanationText] = useState('')
  const [decision, setDecision] = useState(null) // { outcome, feedback, diagnosis }
  const [history, setHistory] = useState([])
  const [evaluating, setEvaluating] = useState(false)
  const [questionStartTime, setQuestionStartTime] = useState(null)
  const [elapsedMs, setElapsedMs] = useState(null)
  const [lastDiagnosis, setLastDiagnosis] = useState(null)
  const [misconceptionStreak, setMisconceptionStreak] = useState(0)
  const [pendingTargetMisconception, setPendingTargetMisconception] = useState(null)

  const FAST_MS = 15000 // answering correctly within 15s counts as confident/fast

  const beginQuestion = (t, targetMisconception = null) => {
    const q = generateQuestion(t, targetMisconception)
    setQuestion(q)
    setNumericAnswer('')
    setNumericCorrect(null)
    setTranscript('')
    setExplanationText('')
    setDecision(null)
    setQuestionStartTime(Date.now())
    setScreen('question')
    speak(q.prompt)
  }

  const numericVoice = useVoiceInput((text) => {
    const num = text.match(/-?\d+/)
    if (num) setNumericAnswer(num[0])
  })

  const explainVoice = useVoiceInput((text) => {
    setTranscript(text)
    setExplanationText(text)
  })

  const submitAnswer = (answerOverride) => {
    const ans = answerOverride !== undefined ? answerOverride : numericAnswer
    const correct = Number(ans) === question.correctAnswer
    setElapsedMs(questionStartTime ? Date.now() - questionStartTime : null)
    setNumericAnswer(String(ans))
    setNumericCorrect(correct)
    setScreen('explain')
    speak(correct ? 'Now tell me how you solved it.' : "That's not quite right — tell me how you worked it out anyway.")
  }

  const submitExplanation = async () => {
    setEvaluating(true)
    let diagnosis = 'unclear'
    let feedback = "Let's slow down and look at this one together."
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equationText: question.equationText,
          correctAnswer: question.correctAnswer,
          learnerAnswer: numericAnswer,
          numericCorrect,
          explanationText,
        }),
      })
      const data = await res.json()
      const ALLOWED = ['correct', 'm1-sign-flip', 'm2-distribution-balance', 'unclear']
      if (data && ALLOWED.includes(data.diagnosis)) {
        diagnosis = data.diagnosis
        feedback = data.feedback || feedback
      }
    } catch {
      // network/API failure — keep the safe 'unclear' fallback, never guess
    }
    setEvaluating(false)

    // A second signal beyond the diagnosis label: has this exact misconception shown up
    // twice in a row? One occurrence gets a targeted re-explanation; a repeat means that
    // re-explanation didn't land, so escalate to the prerequisite refresher instead of
    // looping the same fix again.
    const isMisconception = diagnosis === 'm1-sign-flip' || diagnosis === 'm2-distribution-balance'
    const streak = isMisconception && diagnosis === lastDiagnosis ? misconceptionStreak + 1 : (isMisconception ? 1 : 0)

    let outcome
    let nextTarget = null
    if (diagnosis === 'correct') {
      // A third signal: correct but slow suggests the reasoning isn't solid yet, even
      // though the diagnosis says it's sound — consolidate at the same tier once more
      // rather than escalating immediately.
      outcome = elapsedMs !== null && elapsedMs > FAST_MS ? 'consolidate' : 'harder'
    } else if (isMisconception) {
      outcome = streak >= 2 ? 'prereq' : 'alt'
      nextTarget = diagnosis
    } else {
      outcome = 'prereq'
    }

    setLastDiagnosis(diagnosis)
    setMisconceptionStreak(streak)
    setPendingTargetMisconception(nextTarget)
    setHistory((h) => [...h, { tier: question.tier, equationText: question.equationText, numericCorrect, diagnosis, outcome, elapsedMs }])
    setDecision({ outcome, feedback, diagnosis })
    setScreen('decision')
    speak(feedback)
  }

  const afterDecision = () => {
    if (decision.outcome === 'harder') {
      const next = Math.min(tier + 1, MAX_TIER)
      setTier(next)
      beginQuestion(next)
    } else if (decision.outcome === 'consolidate') {
      beginQuestion(tier)
    } else if (decision.outcome === 'alt') {
      beginQuestion(tier, pendingTargetMisconception)
    } else {
      setScreen('prereq')
      speak('Remember: subtracting a negative number is the same as adding. Minus minus three equals plus three. Let\'s try again.')
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <strong>Equation Coach</strong>
        <button className="linklike" onClick={() => setScreen('about')}>About</button>
      </header>

      {screen === 'start' && (
        <section className="screen">
          <h1>Let's solve some equations</h1>
          <p>I'll read each question aloud. Answer by tapping or speaking, then tell me out loud how you solved it — I'll listen and adjust what comes next.</p>
          <button className="startBtn" onClick={() => beginQuestion(1)}>🔊 Start</button>
        </section>
      )}

      {screen === 'question' && question && (
        <section className="screen">
          <span className="tag">Tier {question.tier} of {MAX_TIER}</span>
          <div className="progressRow">
            {[1, 2, 3].map((t) => <div key={t} className={`progressDot ${t <= question.tier ? 'on' : ''}`} />)}
          </div>
          <div className="equation">{question.equationText}</div>
          <button className="voiceBtn" onClick={() => speak(question.prompt)}>🔊 Read question again</button>

          {question.format === 'mcq' && (
            <div className="choices">
              {question.options.map((opt) => (
                <button key={opt} className="choice" onClick={() => submitAnswer(opt)}>
                  x = {opt}
                </button>
              ))}
            </div>
          )}

          {question.format === 'numeric' && (
            <>
              <input
                className="numericInput"
                type="text"
                inputMode="numeric"
                placeholder="x = ?"
                value={numericAnswer}
                onChange={(e) => setNumericAnswer(e.target.value)}
              />
              <button className="voiceBtn" onClick={numericVoice.start} disabled={numericVoice.listening}>
                🎤 {numericVoice.listening ? 'Listening…' : 'Speak your answer'}
              </button>
              {numericVoice.listening && (
                <button className="primary" onClick={numericVoice.stop}>⏹ Done speaking</button>
              )}
              {numericVoice.error && <p className="heard">{VOICE_ERROR_MESSAGES[numericVoice.error] || `Voice error: ${numericVoice.error}. Try typing instead.`}</p>}
              <button className="primary" onClick={() => submitAnswer()} disabled={numericAnswer === ''}>Submit</button>
            </>
          )}
        </section>
      )}

      {screen === 'explain' && (
        <section className="screen">
          <p className="tag">{numericCorrect ? 'Correct answer' : 'Not quite right'}</p>
          <h2>How did you work it out?</h2>
          <p>Explain your steps out loud, in your own words.</p>
          {explainVoice.supported && (
            <button className="voiceBtn" onClick={explainVoice.start} disabled={explainVoice.listening}>
              🎤 {explainVoice.listening ? 'Listening…' : 'Speak your explanation'}
            </button>
          )}
          {explainVoice.listening && (
            <button className="primary" onClick={explainVoice.stop}>⏹ Done speaking</button>
          )}
          {explainVoice.error && <p className="heard">{VOICE_ERROR_MESSAGES[explainVoice.error] || `Voice error: ${explainVoice.error}. Try typing instead.`}</p>}
          <input
            className="numericInput"
            placeholder="Or type your explanation here"
            value={explanationText}
            onChange={(e) => setExplanationText(e.target.value)}
          />
          {transcript && <p className="heard">Heard: "{transcript}"</p>}
          <button className="primary" onClick={submitExplanation} disabled={!explanationText || evaluating}>
            {evaluating ? 'Checking…' : 'Submit explanation'}
          </button>
        </section>
      )}

      {screen === 'decision' && decision && (
        <section className="screen">
          <h2>Here's what I noticed</h2>
          <div className={`decisionCard ${decision.outcome}`}>
            {decision.outcome === 'harder' && <p className="tag">→ Moving to a harder question</p>}
            {decision.outcome === 'consolidate' && <p className="tag">→ Correct, but let's lock it in — one more at this level</p>}
            {decision.outcome === 'alt' && <p className="tag">→ Let's re-explain this one differently</p>}
            {decision.outcome === 'prereq' && <p className="tag">→ Quick refresher first</p>}
            <p>{decision.feedback}</p>
          </div>
          <button className="primary" onClick={afterDecision}>Continue</button>
        </section>
      )}

      {screen === 'prereq' && (
        <section className="screen">
          <h2>Quick refresher: negative numbers</h2>
          <p>Subtracting a negative number is the same as adding a positive one: <strong>7 − (−3) = 7 + 3 = 10</strong>.</p>
          <p>When a term moves across the equals sign, it changes sign: in <strong>x + 3 = 7</strong>, the +3 becomes −3 on the other side, so <strong>x = 7 − 3</strong>.</p>
          <button className="voiceBtn" onClick={() => speak('Subtracting a negative number is the same as adding. And when a term crosses the equals sign, it changes sign.')}>
            🔊 Read this aloud
          </button>
          <button className="primary" onClick={() => beginQuestion(tier, pendingTargetMisconception)}>Try again</button>
        </section>
      )}

      {screen === 'about' && (
        <section className="screen">
          <h2>About this app</h2>
          <p>Built for ET617 End-Semester Examination — Roll No. {ROLL_NO}.</p>
          <p>Card: P4 (Adaptive tutor) · T3 (Linear equations in one variable) · L1 (rural government-school learner) · C6 (Voice-first).</p>
          {history.length > 0 && (
            <div className="log">
              <strong>Session log</strong>
              {history.map((h, i) => (
                <div className="logRow" key={i}>
                  <span>T{h.tier}: {h.equationText}</span>
                  <span>{h.diagnosis}{h.elapsedMs != null ? ` · ${Math.round(h.elapsedMs / 1000)}s` : ''}</span>
                </div>
              ))}
            </div>
          )}
          <button className="primary" onClick={() => setScreen(question ? 'question' : 'start')}>Back</button>
        </section>
      )}

      <Footer />
    </div>
  )
}
