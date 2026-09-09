// Core flash-math engine: pure logic, no React, no DOM.

export type Op = "+" | "-" | "×" | "÷";

export type Mode =
  | "add"
  | "sub"
  | "mixed"
  | "mul"
  | "div"
  | "mental"
  | "survival"
  | "speed"
  | "daily";

export type Difficulty = "easy" | "medium" | "hard" | "expert";

export interface Step {
  value: number;
  op: Op | null; // null for the first (seed) number
}

export interface Sequence {
  steps: Step[];
  answer: number;
}

export interface Settings {
  mode: Mode;
  difficulty: Difficulty;
  flashes: number;
  flashMs: number;
  gapMs: number;
  rounds: number;
  countdown: boolean;
  sound: boolean;
  haptics: boolean;
}

export const MODES: { id: Mode }[] = [
  { id: "add" },
  { id: "sub" },
  { id: "mixed" },
  { id: "mul" },
  { id: "div" },
  { id: "mental" },
  { id: "survival" },
  { id: "speed" },
  { id: "daily" },
];

export const DIFFICULTIES: { id: Difficulty }[] = [
  { id: "easy" },
  { id: "medium" },
  { id: "hard" },
  { id: "expert" },
];

interface Preset {
  min: number;
  max: number;
  flashes: number;
  flashMs: number;
  gapMs: number;
  multiplier: number;
}

export const PRESETS: Record<Difficulty, Preset> = {
  easy: { min: 1, max: 20, flashes: 4, flashMs: 1200, gapMs: 260, multiplier: 1 },
  medium: { min: 2, max: 60, flashes: 6, flashMs: 900, gapMs: 220, multiplier: 1.5 },
  hard: { min: 5, max: 250, flashes: 9, flashMs: 650, gapMs: 180, multiplier: 2.2 },
  expert: { min: 10, max: 600, flashes: 12, flashMs: 450, gapMs: 140, multiplier: 3 },
};

export function defaultSettings(difficulty: Difficulty = "easy", mode: Mode = "add"): Settings {
  const p = PRESETS[difficulty];
  return {
    mode,
    difficulty,
    flashes: p.flashes,
    flashMs: p.flashMs,
    gapMs: p.gapMs,
    rounds: 10,
    countdown: true,
    sound: false,
    haptics: true,
  };
}

/* ---------------- deterministic RNG ---------------- */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function todaySeed(date = new Date()): number {
  const key = `${date.getUTCFullYear()}${date.getUTCMonth() + 1}${date.getUTCDate()}`;
  let h = 2166136261;
  for (const ch of key) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function dailyKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Shared daily challenge uses a fixed difficulty + timing profile. */
export const DAILY_DIFFICULTY: Difficulty = "medium";
export const DAILY_ROUNDS = 10;

export function dailyPlaySettings(base: Settings): Settings {
  const p = PRESETS[DAILY_DIFFICULTY];
  return {
    ...base,
    mode: "daily",
    difficulty: DAILY_DIFFICULTY,
    flashes: p.flashes,
    flashMs: p.flashMs,
    gapMs: p.gapMs,
    rounds: DAILY_ROUNDS,
  };
}

const int = (rnd: () => number, min: number, max: number) =>
  Math.floor(rnd() * (max - min + 1)) + min;

const pick = <T,>(rnd: () => number, arr: T[]): T => arr[Math.floor(rnd() * arr.length)]!;

function opsFor(mode: Mode, difficulty: Difficulty, rnd: () => number): Op[] {
  switch (mode) {
    case "add":
      return ["+"];
    case "sub":
      return ["-"];
    case "mixed":
      return ["+", "-"];
    case "mul":
      return ["×"];
    case "div":
      return ["÷"];
    case "mental":
    case "survival":
    case "speed":
    case "daily":
    default:
      if (difficulty === "easy") return ["+", "-"];
      if (difficulty === "medium") return pick(rnd, [["+", "-"], ["+", "-", "×"]]) as Op[];
      return ["+", "-", "×", "÷"];
  }
}

function divisors(n: number): number[] {
  const out: number[] = [];
  for (let d = 2; d <= 12; d++) if (n % d === 0 && n / d >= 1) out.push(d);
  return out;
}

/**
 * Generates a valid sequence. Never produces fractions, and keeps running
 * totals non-negative and inside a sane range.
 */
export function generateSequence(
  mode: Mode,
  difficulty: Difficulty,
  flashes: number,
  rnd: () => number = Math.random,
): Sequence {
  const p = PRESETS[difficulty];
  const ops = opsFor(mode, difficulty, rnd);
  const count = Math.max(2, Math.min(20, flashes));

  const mulHeavy = mode === "mul";
  const divHeavy = mode === "div";

  let total = mulHeavy || divHeavy ? int(rnd, 2, difficulty === "easy" ? 9 : 12) : int(rnd, p.min + 1, p.max);
  if (divHeavy) total = int(rnd, 2, 12) * int(rnd, 2, 12) * (difficulty === "easy" ? 1 : 2);

  const steps: Step[] = [{ value: total, op: null }];

  for (let i = 1; i < count; i++) {
    let op = pick(rnd, ops);
    let value = 0;

    // Guard rails per operation — keep running totals non-negative and integral.
    if (op === "×") {
      if (Math.abs(total) > 5000) op = "+";
      else value = int(rnd, 2, difficulty === "easy" ? 5 : 9);
    }
    if (op === "÷") {
      const ds = divisors(total).filter((d) => total / d >= 1);
      if (ds.length === 0) op = "+";
      else value = pick(rnd, ds);
    }
    if (op === "+") {
      value = int(rnd, p.min, p.max);
      if (value < 1) value = 1;
    }
    if (op === "-") {
      if (total <= 0) {
        op = "+";
        value = Math.max(1, int(rnd, p.min, p.max));
      } else {
        const cap = Math.min(p.max, total);
        const lo = Math.min(Math.max(1, p.min), cap);
        value = int(rnd, lo, cap);
        if (value > total) value = total;
        if (value < 1) {
          op = "+";
          value = Math.max(1, int(rnd, p.min, p.max));
        }
      }
    }
    // avoid trivial ×1 / ÷1
    if ((op === "×" || op === "÷") && value === 1) value = 2;

    switch (op) {
      case "+":
        total += value;
        break;
      case "-":
        total = Math.max(0, total - value);
        break;
      case "×":
        total *= value;
        break;
      case "÷":
        total = total / value;
        break;
    }
    if (!Number.isFinite(total) || total < 0) total = 0;
    steps.push({ value, op });
  }

  return { steps, answer: total };
}

/** Dev/runtime check helper: every generated sequence stays non-negative. */
export function assertSequenceNonNegative(seq: Sequence): boolean {
  let total = 0;
  for (let i = 0; i < seq.steps.length; i++) {
    const step = seq.steps[i]!;
    if (step.value < 0) return false;
    if (i === 0 || step.op === null) {
      total = step.value;
      continue;
    }
    switch (step.op) {
      case "+":
        total += step.value;
        break;
      case "-":
        total -= step.value;
        break;
      case "×":
        total *= step.value;
        break;
      case "÷":
        total = total / step.value;
        break;
    }
    if (!Number.isFinite(total) || total < 0) return false;
  }
  return total === seq.answer && seq.answer >= 0;
}

export function sequenceText(seq: Sequence): string {
  return seq.steps
    .map((s, i) => (i === 0 ? String(s.value) : `${s.op} ${s.value}`))
    .join(" ");
}

/* ---------------- scoring ---------------- */

export interface ScoreInput {
  difficulty: Difficulty;
  flashes: number;
  flashMs: number;
  answer: number;
  streak: number;
  responseMs: number;
}

export function roundScore(i: ScoreInput): number {
  const base = 50;
  const sizeBonus = Math.min(60, Math.floor(Math.log10(Math.max(10, Math.abs(i.answer))) * 25));
  const lengthBonus = i.flashes * 8;
  const speedBonus = Math.max(0, Math.round((1500 - i.flashMs) / 12));
  const answerBonus = Math.max(0, Math.round((8000 - Math.min(8000, i.responseMs)) / 200));
  const streakBonus = Math.min(150, i.streak * 15);
  const raw = (base + sizeBonus + lengthBonus + speedBonus + answerBonus + streakBonus) *
    PRESETS[i.difficulty].multiplier;
  return Math.round(raw);
}

/** Speed mode flash duration ladder. */
export function speedFlashMs(round: number): number {
  const ladder = [1500, 1200, 1000, 800, 600, 500, 400, 350, 300, 250];
  return ladder[Math.min(round, ladder.length - 1)]!;
}
