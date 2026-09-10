import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Maximize2, Minimize2, Settings2 } from "lucide-react";
import {
  DIFFICULTIES,
  MODES,
  PRESETS,
  dailyKey,
  dailyPlaySettings,
  defaultSettings,
  generateSequence,
  mulberry32,
  roundScore,
  sequenceText,
  speedFlashMs,
  todaySeed,
  type Difficulty,
  type Mode,
  type Sequence,
  type Settings,
} from "@/lib/flash/engine";
import { loadSettings, loadStats, saveGame, saveSettings, type Stats } from "@/lib/flash/storage";
import { buzz, play, unlockAudio } from "@/lib/flash/sound";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatNumber, type EnKey } from "@/lib/i18n";
import { Btn, Chip } from "./ui";
import { SettingsPanel, StatsPanel } from "./panels";
import { ThemeToggle } from "./ThemeToggle";
import { LocaleToggle } from "./LocaleToggle";
import { IconTooltip } from "./IconTooltip";

async function tryOpenStats(open: () => void) {
  const { requireSignedInForAction } = await import("@/lib/authGate");
  if (await requireSignedInForAction()) open();
}

const iconBtnClass =
  "inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-[0.96]";

const toolbarClass =
  "flex items-center gap-0.5 rounded-xl border border-border/70 bg-secondary/50 p-0.5";

function modeKey(id: Mode): EnKey {
  return `mode.${id}` as EnKey;
}

function difficultyKey(id: Difficulty): EnKey {
  return `difficulty.${id}` as EnKey;
}
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
  const { t, locale } = useLocale();
  const [settings, setSettings] = useState<Settings>(() => loadSettings(defaultSettings()));
  const [stats, setStats] = useState<Stats>(() => loadStats());
  const [phase, setPhase] = useState<Phase>("idle");
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState(false);

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
  const sessionFinished = useRef(false);
  const settingsHydrated = useRef(false);

  const playSettings = settings.mode === "daily" ? dailyPlaySettings(settings) : settings;
  const endless = playSettings.mode === "survival" || playSettings.mode === "speed";
  const isDaily = playSettings.mode === "daily";
  const totalRounds = endless ? Infinity : isDaily ? playSettings.rounds : settings.rounds;
  const flashMsForRound =
    playSettings.mode === "speed" ? speedFlashMs(round) : playSettings.flashMs;

  useEffect(() => {
    settingsHydrated.current = true;
  }, []);

  useEffect(() => {
    if (!settingsHydrated.current) return;
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
      const active = settings.mode === "daily" ? dailyPlaySettings(settings) : settings;

      let sequence: Sequence;
      try {
        const rnd = active.mode === "daily"
          ? mulberry32(todaySeed() + roundIndex * 7919)
          : Math.random;
        sequence = generateSequence(
          active.mode,
          active.difficulty,
          active.flashes,
          rnd,
        );
      } catch {
        setError(true);
        setPhase("idle");
        return;
      }

      setSeq(sequence);
      setAnswer("");
      setOutcome(null);
      setStepIndex(-1);
      setVisible(false);
      submitting.current = false;

      const flashMs = active.mode === "speed" ? speedFlashMs(roundIndex) : active.flashMs;
      const gap = active.gapMs;

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
            play("flash", active.sound);
          }, at);
          schedule(() => setVisible(false), at + flashMs);
        });
        schedule(
          () => {
            setPhase("answering");
            answerShownAt.current = performance.now();
            schedule(() => answerRef.current?.focus(), 30);
          },
          sequence.steps.length * (flashMs + gap),
        );
      };

      if (withCountdown && active.countdown) {
        setPhase("countdown");
        setCountdownAt(3);
        [3, 2, 1].forEach((n, i) => {
          schedule(() => {
            setCountdownAt(n);
            play(n === 1 ? "go" : "tick", active.sound);
          }, i * 650);
        });
        schedule(startFlashing, 3 * 650);
      } else {
        startFlashing();
      }
    },
    [clearTimers, settings],
  );

  /* ---------------- session control ---------------- */

  const startSession = useCallback(() => {
    unlockAudio();
    sessionFinished.current = false;
    setError(false);
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
      if (sessionFinished.current) return;
      sessionFinished.current = true;
      clearTimers();
      setPhase("complete");
      const active = settings.mode === "daily" ? dailyPlaySettings(settings) : settings;
      const next = saveGame(
        {
          at: Date.now(),
          mode: active.mode,
          difficulty: active.difficulty,
          score: finalScore,
          correct,
          total: played,
          bestStreak: best,
          durationMs: performance.now() - sessionStart.current,
        },
        active.mode === "speed" ? speedFlashMs(Math.max(0, played - 1)) : active.flashMs,
        active.mode === "daily" ? dailyKey() : undefined,
      );
      setStats(next);
    },
    [clearTimers, settings],
  );

  const submit = useCallback(() => {
    if (phase !== "answering" || submitting.current || !seq) return;
    if (answer.trim() === "" || Number.isNaN(Number(answer))) return;
    submitting.current = true;
    clearTimers();

    const active = settings.mode === "daily" ? dailyPlaySettings(settings) : settings;
    const given = Number(answer);
    const isRight = given === seq.answer;
    const responseMs = performance.now() - answerShownAt.current;
    const gained = isRight
      ? roundScore({
          difficulty: active.difficulty,
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
    play(isRight ? (nextStreak >= 3 ? "streak" : "correct") : "wrong", active.sound);
    buzz(isRight ? 20 : [40, 60, 40], active.haptics);

    const played = round + 1;
    const runOver = (endless && !isRight) || played >= totalRounds;
    if (runOver) {
      timers.current.push(
        window.setTimeout(() => finishSession(nextScore, nextCorrect, played, nextBest), 1100),
      );
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
    settings,
    streak,
    totalRounds,
  ]);

  const next = useCallback(() => {
    if (sessionFinished.current) return;
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
    sessionFinished.current = true;
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

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggleFullscreen = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) void el.requestFullscreen?.().catch(() => {});
    else void document.exitFullscreen?.().catch(() => {});
  };

  const playing = phase !== "idle" && phase !== "complete";

  const currentStep = seq && stepIndex >= 0 ? seq.steps[stepIndex] : null;

  const dailyDone = useMemo(() => stats.daily[dailyKey()], [stats.daily]);

  /* ---------------- render ---------------- */

  return (
    <main className="relative flex min-h-[100dvh] flex-col pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-[env(safe-area-inset-bottom)] pt-[calc(env(safe-area-inset-top)+1rem)]">
      {/* top bar */}
      <header className="flex min-w-0 items-center justify-between gap-3 text-sm text-muted-foreground">
        {playing ? (
          <>
            <span className="tabular min-w-0 truncate">
              {t("hud.score")}{" "}
              <span className="font-display text-foreground">{formatNumber(locale, score)}</span>
              {streak > 1 && <span className="ml-2 shrink-0 text-accent">🔥 {streak}</span>}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="tabular">
                {endless
                  ? t("hud.round", { n: round + 1 })
                  : t("hud.roundOf", { current: round + 1, total: totalRounds })}
              </span>
              <nav aria-label={t("nav.theme")} className={`${toolbarClass} hidden sm:flex`}>
                <LocaleToggle />
                <ThemeToggle />
              </nav>
            </span>
          </>
        ) : (
          <>
            <span className="font-display font-semibold tracking-tight text-foreground">
              {t("brand.name")} <span className="text-primary">{t("brand.flash")}</span>
            </span>
            <nav aria-label={t("nav.gameControls")} className={toolbarClass}>
              <LocaleToggle />
              <ThemeToggle />
              <IconTooltip label={t("nav.stats")} side="bottom">
                <button
                  type="button"
                  onClick={() => {
                    void tryOpenStats(() => setShowStats(true));
                  }}
                  aria-label={t("nav.stats")}
                  className={iconBtnClass}
                >
                  <BarChart3 className="size-4" strokeWidth={1.75} aria-hidden />
                </button>
              </IconTooltip>
              <IconTooltip
                label={isFullscreen ? t("nav.exitFullscreen") : t("nav.enterFullscreen")}
                side="bottom"
              >
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? t("nav.exitFullscreen") : t("nav.enterFullscreen")}
                  className={`${iconBtnClass} max-sm:!hidden`}
                >
                  {isFullscreen ? (
                    <Minimize2 className="size-4" strokeWidth={1.75} aria-hidden />
                  ) : (
                    <Maximize2 className="size-4" strokeWidth={1.75} aria-hidden />
                  )}
                </button>
              </IconTooltip>
              <IconTooltip label={t("nav.settings")} side="bottom">
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  aria-label={t("nav.settings")}
                  className={iconBtnClass}
                >
                  <Settings2 className="size-4" strokeWidth={1.75} aria-hidden />
                </button>
              </IconTooltip>
            </nav>
          </>
        )}
      </header>

      {/* stage */}
      <section
        className={`flex flex-1 flex-col items-center text-center ${
          phase === "answering" ? "justify-end pb-4 sm:justify-center sm:pb-0" : "justify-center"
        }`}
      >
        {phase === "idle" && (
          <div className="w-full max-w-md lg:max-w-lg">
            <h1 className="font-display text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
              {t("brand.name")} <span className="text-primary">{t("brand.flash")}</span>
            </h1>
            <p className="mt-3 text-muted-foreground">{t("tagline")}</p>

            <div className="mt-8">
              <Btn variant="primary" className="w-full py-5 text-4xl! font-bold! leading-none" onClick={startSession}>
                {t("action.start")}
              </Btn>
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {DIFFICULTIES.map((d) => (
                <Chip
                  key={d.id}
                  active={playSettings.difficulty === d.id}
                  disabled={isDaily}
                  onClick={() => {
                    if (isDaily) return;
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
                  {t(difficultyKey(d.id))}
                </Chip>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {MODES.map((m) => (
                <Chip
                  key={m.id}
                  active={settings.mode === m.id}
                  onClick={() =>
                    setSettings((s) =>
                      m.id === "daily" ? dailyPlaySettings({ ...s, mode: "daily" }) : { ...s, mode: m.id },
                    )
                  }
                >
                  {t(modeKey(m.id))}
                </Chip>
              ))}
            </div>

            <p className="mt-6 text-sm text-muted-foreground">
              {t("hud.best", { score: formatNumber(locale, stats.bestScore) })} ·{" "}
              {t("hud.streak", { n: stats.bestStreak })}
              {isDaily &&
                dailyDone &&
                ` · ${t("hud.today", { correct: dailyDone.correct, total: dailyDone.total })}`}
            </p>
            {error && <p className="mt-3 text-sm text-destructive">{t("error.generic")}</p>}
          </div>
        )}

        {phase === "countdown" && (
          <div key={countdownAt} className="anim-pop flash-number text-muted-foreground">
            {countdownAt}
          </div>
        )}

        {phase === "flashing" && (
          <div
            className="flex min-h-[40vh] max-w-full items-center justify-center overflow-x-hidden px-2 max-md:min-h-[28vh]"
            aria-hidden="true"
          >
            {visible && currentStep && (
              <div key={stepIndex} className="anim-flash flash-number max-w-full">
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
            <div className="font-display text-4xl font-bold text-muted-foreground/40 sm:text-5xl" aria-hidden="true">
              ?
            </div>
            <input
              ref={answerRef}
              value={answer}
              onChange={(e) => setAnswer(e.target.value.replace(/[^0-9-]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              inputMode="numeric"
              pattern="-?[0-9]*"
              autoComplete="off"
              aria-label={t("answer.aria")}
              placeholder={t("answer.placeholder")}
              className="tabular mt-4 w-full rounded-2xl border border-border bg-surface px-6 py-5 text-center font-display text-4xl font-semibold outline-none focus:border-primary"
            />
            <Btn variant="primary" className="mt-3 w-full py-4 text-lg" onClick={submit}>
              {t("action.submit")}
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
              {outcome.correct ? t("feedback.correct") : t("feedback.incorrect")}
            </div>
            <div className="tabular mt-4 font-display text-5xl font-extrabold sm:text-6xl">
              {outcome.expected}
            </div>
            {outcome.correct ? (
              <div className="mt-2 text-accent">+{outcome.gained}</div>
            ) : (
              <div className="mt-2 text-muted-foreground">
                {t("feedback.yourAnswer", { n: outcome.given })}
              </div>
            )}
            <details className="mt-4 text-sm text-muted-foreground">
              <summary className="cursor-pointer select-none">{t("feedback.review")}</summary>
              <p className="tabular mt-2">{seq ? `${sequenceText(seq)} = ${seq.answer}` : ""}</p>
            </details>
            <Btn variant="primary" className="mt-6 w-full py-4 text-lg" onClick={next}>
              {t("action.next")}
            </Btn>
          </div>
        )}

        {phase === "paused" && (
          <div className="w-full max-w-sm">
            <div className="font-display text-3xl font-semibold">{t("pause.title")}</div>
            <p className="mt-2 text-sm text-muted-foreground">{t("pause.hint")}</p>
            <Btn
              variant="primary"
              className="mt-6 w-full py-4 text-lg"
              onClick={() => runRound(round, true)}
            >
              {t("action.resume")}
            </Btn>
            <Btn variant="quiet" className="mt-2 w-full" onClick={exit}>
              {t("action.exit")}
            </Btn>
          </div>
        )}

        {phase === "complete" && (
          <div className="anim-pop w-full max-w-sm">
            <div className="tabular font-display text-5xl font-extrabold sm:text-6xl">
              {formatNumber(locale, score)}
            </div>
            <p className="mt-2 text-muted-foreground">
              {correctCount === round + 1
                ? t("complete.perfect")
                : correctCount > 0
                  ? t("complete.great")
                  : t("complete.keepTraining")}
            </p>
            <p className="tabular mt-4 text-sm text-muted-foreground">
              {t("complete.summary", {
                correct: correctCount,
                total: round + 1,
                accuracy: Math.round((correctCount / Math.max(1, round + 1)) * 100),
                streak: bestStreak,
              })}
            </p>
            <Btn variant="primary" className="mt-6 w-full py-4 text-lg" onClick={startSession}>
              {t("action.playAgain")}
            </Btn>
            <div className="mt-3 flex justify-center gap-2 text-sm">
              <Btn
                variant="quiet"
                onClick={() => {
                  void tryOpenStats(() => setShowStats(true));
                }}
              >
                {t("action.stats")}
              </Btn>
              <Btn variant="quiet" onClick={exit}>
                {t("action.exit")}
              </Btn>
            </div>
          </div>
        )}
      </section>

      {/* progress dots / pause */}
      <footer className="flex min-h-12 items-center justify-center gap-2">
        {phase === "flashing" && seq
          ? seq.steps.map((_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full ${i <= stepIndex ? "bg-primary" : "bg-muted"}`}
              />
            ))
          : playing && phase !== "paused" && (
              <Btn variant="quiet" className="min-h-10 px-4 py-2 text-sm" onClick={pause}>
                {t("action.pause")}
              </Btn>
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
