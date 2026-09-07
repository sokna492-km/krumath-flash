import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DIFFICULTIES,
  MODES,
  PRESETS,
  dailyKey,
  defaultSettings,
  generateSequence,
  mulberry32,
  roundScore,
  sequenceText,
  speedFlashMs,
  todaySeed,
  type Difficulty,
  type Sequence,
  type Settings,
} from "@/lib/flash/engine";
import { emptyStats, loadSettings, loadStats, saveGame, saveSettings, type Stats } from "@/lib/flash/storage";
import { buzz, play } from "@/lib/flash/sound";
import { Btn, Chip } from "./ui";
import { SettingsPanel, StatsPanel } from "./panels";

type Phase =
  | "idle"
  | "countdown"
  | "flashing"
  | "answering"
  | "correct"
  | "incorrect"
  | "paused"
  | "complete";

interface RoundOutcome {
  correct: boolean;
  given: number;
  expected: number;
  gained: number;
  responseMs: number;
}

const OP_LABEL: Record<string, string> = { "+": "+", "-": "−", "×": "×", "÷": "÷" };

export function FlashGame() {
  const [settings, setSettings] = useState<Settings>(() => defaultSettings());
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [phase, setPhase] = useState<Phase>("idle");
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // session
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [outcome, setOutcome] = useState<RoundOutcome | null>(null);

  // round
  const [seq, setSeq] = useState<Sequence | null>(null);
  const [stepIndex, setStepIndex] = useState(-1);
  const [visible, setVisible] = useState(false);
  const [countdownAt, setCountdownAt] = useState(3);
  const [answer, setAnswer] = useState("");

  const runId = useRef(0);
  const timers = useRef<number[]>([]);
  const answerRef = useRef<HTMLInputElement>(null);
  const startedAt = useRef(0);
  const answerShownAt = useRef(0);
  const submitting = useRef(false);
  const sessionStart = useRef(0);

  const endless = settings.mode === "survival" || settings.mode === "speed";
  const isDaily = settings.mode === "daily";
  const totalRounds = endless ? Infinity : isDaily ? 10 : settings.rounds;
  const flashMsForRound = settings.mode === "speed" ? speedFlashMs(round) : settings.flashMs;

  useEffect(() => {
    setStats(loadStats());
    setSettings((s) => loadSettings(s));
  }, []);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    runId.current += 1;
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  /* ---------------- round runner ---------------- */

  const runRound = useCallback(
    (roundIndex: number, withCountdown: boolean) => {
      clearTimers();
      const myRun = runId.current;
      const alive = () => runId.current === myRun;

      let sequence: Sequence;
      try {
        const rnd = isDaily
          ? mulberry32(todaySeed() + roundIndex * 7919)
          : Math.random;
        sequence = generateSequence(
          settings.mode,
          settings.difficulty,
          settings.flashes,
          rnd,
        );
      } catch {
        setError("Something went wrong. Try again.");
        setPhase("idle");
        return;
      }

      setSeq(sequence);
      setAnswer("");
      setOutcome(null);
      setStepIndex(-1);
      setVisible(false);
      submitting.current = false;

      const flashMs = settings.mode === "speed" ? speedFlashMs(roundIndex) : settings.flashMs;
      const gap = settings.gapMs;

      const schedule = (fn: () => void, ms: number) => {
        timers.current.push(window.setTimeout(() => alive() && fn(), ms));
      };

      const startFlashing = () => {
        if (!alive()) return;
        setPhase("flashing");
        startedAt.current = performance.now();
        sequence.steps.forEach((_, i) => {
          const at = i * (flashMs + gap);
          schedule(() => {
            setStepIndex(i);
            setVisible(true);
            play("flash", settings.sound);
          }, at);
          schedule(() => setVisible(false), at + flashMs);
        });
        schedule(
          () => {
            setPhase("answering");
            answerShownAt.current = performance.now();
            window.setTimeout(() => answerRef.current?.focus(), 30);
          },
          sequence.steps.length * (flashMs + gap),
        );
      };

      if (withCountdown && settings.countdown) {
        setPhase("countdown");
        setCountdownAt(3);
        [3, 2, 1].forEach((n, i) => {
          schedule(() => {
            setCountdownAt(n);
            play(n === 1 ? "go" : "tick", settings.sound);
          }, i * 650);
        });
        schedule(startFlashing, 3 * 650);
      } else {
        startFlashing();
      }
    },
    [clearTimers, isDaily, settings],
  );

  /* ---------------- session control ---------------- */

  const startSession = useCallback(() => {
    setError(null);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setCorrectCount(0);
    setRound(0);
    sessionStart.current = performance.now();
    runRound(0, true);
  }, [runRound]);

  const finishSession = useCallback(
    (finalScore: number, correct: number, played: number, best: number) => {
      clearTimers();
      setPhase("complete");
      const next = saveGame(
        {
          at: Date.now(),
          mode: settings.mode,
          difficulty: settings.difficulty,
          score: finalScore,
          correct,
          total: played,
          bestStreak: best,
          durationMs: performance.now() - sessionStart.current,
        },
        flashMsForRound,
        isDaily ? dailyKey() : undefined,
      );
      setStats(next);
    },
    [clearTimers, flashMsForRound, isDaily, settings.difficulty, settings.mode],
  );

  const submit = useCallback(() => {
    if (phase !== "answering" || submitting.current || !seq) return;
    if (answer.trim() === "" || Number.isNaN(Number(answer))) return;
    submitting.current = true;
    clearTimers();

    const given = Number(answer);
    const isRight = given === seq.answer;
    const responseMs = performance.now() - answerShownAt.current;
    const gained = isRight
      ? roundScore({
          difficulty: settings.difficulty,
          flashes: seq.steps.length,
          flashMs: flashMsForRound,
          answer: seq.answer,
          streak,
          responseMs,
        })
      : 0;

    const nextScore = score + gained;
    const nextStreak = isRight ? streak + 1 : 0;
    const nextBest = Math.max(bestStreak, nextStreak);
    const nextCorrect = correctCount + (isRight ? 1 : 0);

    setScore(nextScore);
    setStreak(nextStreak);
    setBestStreak(nextBest);
    setCorrectCount(nextCorrect);
    setOutcome({ correct: isRight, given, expected: seq.answer, gained, responseMs });
    setPhase(isRight ? "correct" : "incorrect");
    play(isRight ? (nextStreak >= 3 ? "streak" : "correct") : "wrong", settings.sound);
    buzz(isRight ? 20 : [40, 60, 40].reduce((a, b) => a + b, 0), settings.haptics);

    const played = round + 1;
    const runOver = (endless && !isRight) || played >= totalRounds;
    if (runOver) {
      window.setTimeout(() => finishSession(nextScore, nextCorrect, played, nextBest), 1100);
    }
  }, [
    answer,
    bestStreak,
    clearTimers,
    correctCount,
    endless,
    finishSession,
    flashMsForRound,
    phase,
    round,
    score,
    seq,
    settings.difficulty,
    settings.haptics,
    settings.sound,
    streak,
    totalRounds,
  ]);

  const next = useCallback(() => {
    const played = round + 1;
    if (played >= totalRounds || (endless && outcome && !outcome.correct)) {
      finishSession(score, correctCount, played, bestStreak);
      return;
    }
    setRound(played);
    runRound(played, false);
  }, [bestStreak, correctCount, endless, finishSession, outcome, round, runRound, score, totalRounds]);

  const pause = useCallback(() => {
    if (phase !== "flashing" && phase !== "countdown" && phase !== "answering") return;
    clearTimers();
    setVisible(false);
    setPhase("paused");
  }, [clearTimers, phase]);

  const exit = useCallback(() => {
    clearTimers();
    setPhase("idle");
  }, [clearTimers]);

  // pause when the tab goes away mid-flash
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [pause]);

  /* ---------------- keyboard ---------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showSettings || showStats) return;
      if (e.key === "Escape") {
        if (phase === "flashing" || phase === "countdown" || phase === "answering") pause();
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        if (phase === "idle" || phase === "complete") {
          e.preventDefault();
          startSession();
        } else if (phase === "correct" || phase === "incorrect") {
          e.preventDefault();
          next();
        } else if (phase === "paused") {
          e.preventDefault();
          runRound(round, true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, pause, phase, round, runRound, showSettings, showStats, startSession]);

  const toggleFullscreen = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) void el.requestFullscreen?.().catch(() => {});
    else void document.exitFullscreen?.().catch(() => {});
  };

  const accuracy = round + (phase === "complete" ? 0 : 0) === 0 ? 0 : 0;
  void accuracy;

  const playing = phase !== "idle" && phase !== "complete";
  const currentStep = seq && stepIndex >= 0 ? seq.steps[stepIndex] : null;

  const dailyDone = useMemo(() => stats.daily[dailyKey()], [stats.daily]);

  /* ---------------- render ---------------- */

  return (
    <main className="relative flex min-h-[100svh] flex-col px-5 pb-[env(safe-area-inset-bottom)] pt-[calc(env(safe-area-inset-top)+1rem)]">
      {/* top bar */}
      <header className="flex items-center justify-between text-sm text-muted-foreground">
        {playing ? (
          <>
            <span className="tabular">
              Score <span className="font-display text-foreground">{score.toLocaleString()}</span>
              {streak > 1 && <span className="ml-3 text-accent">🔥 {streak}</span>}
            </span>
            <span className="tabular">
              {endless ? `Round ${round + 1}` : `${round + 1} / ${totalRounds}`}
            </span>
          </>
        ) : (
          <>
            <span className="font-display font-semibold tracking-tight text-foreground">
              KruMath <span className="text-primary">Flash</span>
            </span>
            <span className="flex items-center gap-1">
              <button
                onClick={() => setShowStats(true)}
                className="rounded-lg px-3 py-2 hover:bg-secondary hover:text-foreground"
              >
                Stats
              </button>
              <button
                onClick={toggleFullscreen}
                aria-label="Fullscreen"
                className="hidden rounded-lg px-3 py-2 hover:bg-secondary hover:text-foreground sm:block"
              >
                ⛶
              </button>
              <button
                onClick={() => setShowSettings(true)}
                aria-label="Settings"
                className="rounded-lg px-3 py-2 hover:bg-secondary hover:text-foreground"
              >
                ⚙
              </button>
            </span>
          </>
        )}
      </header>

      {/* stage */}
      <section className="flex flex-1 flex-col items-center justify-center text-center">
        {phase === "idle" && (
          <div className="w-full max-w-md">
            <h1 className="font-display text-5xl font-extrabold tracking-tight sm:text-6xl">
              KruMath <span className="text-primary">Flash</span>
            </h1>
            <p className="mt-3 text-muted-foreground">Watch. Calculate. Answer.</p>

            <div className="mt-8">
              <Btn variant="primary" className="w-full py-5 text-xl" onClick={startSession}>
                Start
              </Btn>
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {DIFFICULTIES.map((d) => (
                <Chip
                  key={d.id}
                  active={settings.difficulty === d.id}
                  onClick={() => {
                    const p = PRESETS[d.id as Difficulty];
                    setSettings((s) => ({
                      ...s,
                      difficulty: d.id,
                      flashes: p.flashes,
                      flashMs: p.flashMs,
                      gapMs: p.gapMs,
                    }));
                  }}
                >
                  {d.label}
                </Chip>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {MODES.map((m) => (
                <Chip
                  key={m.id}
                  active={settings.mode === m.id}
                  onClick={() => setSettings((s) => ({ ...s, mode: m.id }))}
                >
                  {m.label}
                </Chip>
              ))}
            </div>

            <p className="mt-6 text-sm text-muted-foreground">
              Best {stats.bestScore.toLocaleString()} · Streak {stats.bestStreak}
              {isDaily && dailyDone && ` · Today ${dailyDone.correct}/${dailyDone.total}`}
            </p>
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          </div>
        )}

        {phase === "countdown" && (
          <div key={countdownAt} className="anim-pop flash-number text-muted-foreground">
            {countdownAt}
          </div>
        )}

        {phase === "flashing" && (
          <div className="flex min-h-[40vh] items-center justify-center" aria-hidden="true">
            {visible && currentStep && (
              <div key={stepIndex} className="anim-flash flash-number">
                {stepIndex > 0 && currentStep.op && (
                  <span className="mr-2 text-muted-foreground">{OP_LABEL[currentStep.op]}</span>
                )}
                {currentStep.value}
              </div>
            )}
          </div>
        )}

        {phase === "answering" && (
          <div className="w-full max-w-sm">
            <div className="flash-number text-muted-foreground/40">?</div>
            <input
              ref={answerRef}
              value={answer}
              onChange={(e) => setAnswer(e.target.value.replace(/[^0-9-]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              inputMode="numeric"
              pattern="-?[0-9]*"
              autoComplete="off"
              aria-label="Your answer"
              placeholder="Answer"
              className="tabular mt-4 w-full rounded-2xl border border-border bg-surface px-6 py-5 text-center font-display text-4xl font-semibold outline-none focus:border-primary"
            />
            <Btn variant="primary" className="mt-3 w-full py-4 text-lg" onClick={submit}>
              Submit
            </Btn>
          </div>
        )}

        {(phase === "correct" || phase === "incorrect") && outcome && (
          <div className="anim-pop w-full max-w-sm">
            <div
              className={`font-display text-2xl font-semibold ${
                outcome.correct ? "text-success" : "text-destructive"
              }`}
            >
              {outcome.correct ? "✓ Correct" : "✕ Incorrect"}
            </div>
            <div className="tabular mt-4 font-display text-6xl font-extrabold">
              {outcome.expected}
            </div>
            {outcome.correct ? (
              <div className="mt-2 text-accent">+{outcome.gained}</div>
            ) : (
              <div className="mt-2 text-muted-foreground">Your answer: {outcome.given}</div>
            )}
            <details className="mt-4 text-sm text-muted-foreground">
              <summary className="cursor-pointer select-none">Review</summary>
              <p className="tabular mt-2">{seq ? `${sequenceText(seq)} = ${seq.answer}` : ""}</p>
            </details>
            <Btn variant="primary" className="mt-6 w-full py-4 text-lg" onClick={next}>
              Next
            </Btn>
          </div>
        )}

        {phase === "paused" && (
          <div className="w-full max-w-sm">
            <div className="font-display text-3xl font-semibold">Paused</div>
            <p className="mt-2 text-sm text-muted-foreground">The round will replay from the start.</p>
            <Btn
              variant="primary"
              className="mt-6 w-full py-4 text-lg"
              onClick={() => runRound(round, true)}
            >
              Resume
            </Btn>
            <Btn variant="quiet" className="mt-2 w-full" onClick={exit}>
              Exit
            </Btn>
          </div>
        )}

        {phase === "complete" && (
          <div className="anim-pop w-full max-w-sm">
            <div className="tabular font-display text-6xl font-extrabold">
              {score.toLocaleString()}
            </div>
            <p className="mt-2 text-muted-foreground">
              {correctCount === round + 1 ? "Perfect run" : correctCount > 0 ? "Great run" : "Keep training"}
            </p>
            <p className="tabular mt-4 text-sm text-muted-foreground">
              {correctCount} / {round + 1} correct ·{" "}
              {Math.round((correctCount / Math.max(1, round + 1)) * 100)}% accuracy · {bestStreak}{" "}
              streak
            </p>
            <Btn variant="primary" className="mt-6 w-full py-4 text-lg" onClick={startSession}>
              Play again
            </Btn>
            <div className="mt-3 flex justify-center gap-2 text-sm">
              <Btn variant="quiet" onClick={() => setShowStats(true)}>
                Stats
              </Btn>
              <Btn variant="quiet" onClick={exit}>
                Exit
              </Btn>
            </div>
          </div>
        )}
      </section>

      {/* progress dots */}
      <footer className="flex h-12 items-center justify-center gap-2">
        {phase === "flashing" && seq
          ? seq.steps.map((_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full ${i <= stepIndex ? "bg-primary" : "bg-muted"}`}
              />
            ))
          : playing && (
              <button onClick={pause} className="text-xs text-muted-foreground hover:text-foreground">
                Esc to pause
              </button>
            )}
      </footer>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showStats && <StatsPanel stats={stats} onClose={() => setShowStats(false)} />}
    </main>
  );
}
