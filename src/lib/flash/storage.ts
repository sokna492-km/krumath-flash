import type { Difficulty, Mode, Settings } from "./engine";

const STATS_KEY = "krumath-flash-stats-v1";
const SETTINGS_KEY = "krumath-flash-settings-v1";

export interface GameRecord {
  at: number;
  mode: Mode;
  difficulty: Difficulty;
  score: number;
  correct: number;
  total: number;
  bestStreak: number;
  durationMs: number;
}

export interface Stats {
  gamesPlayed: number;
  questions: number;
  correct: number;
  bestScore: number;
  bestStreak: number;
  fastestFlashMs: number | null;
  highestDifficulty: Difficulty | null;
  recent: GameRecord[];
  daily: Record<string, { score: number; correct: number; total: number }>;
}

export const emptyStats: Stats = {
  gamesPlayed: 0,
  questions: 0,
  correct: 0,
  bestScore: 0,
  bestStreak: 0,
  fastestFlashMs: null,
  highestDifficulty: null,
  recent: [],
  daily: {},
};

const RANK: Difficulty[] = ["easy", "medium", "hard", "expert"];

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(raw) as object) } as T;
  } catch {
    return fallback;
  }
}

export function loadStats(): Stats {
  if (typeof window === "undefined") return emptyStats;
  return safeParse(window.localStorage.getItem(STATS_KEY), emptyStats);
}

export function saveGame(
  record: GameRecord,
  flashMs: number,
  dailyId?: string,
): Stats {
  const s = loadStats();
  const next: Stats = {
    ...s,
    gamesPlayed: s.gamesPlayed + 1,
    questions: s.questions + record.total,
    correct: s.correct + record.correct,
    bestScore: Math.max(s.bestScore, record.score),
    bestStreak: Math.max(s.bestStreak, record.bestStreak),
    fastestFlashMs: s.fastestFlashMs === null ? flashMs : Math.min(s.fastestFlashMs, flashMs),
    highestDifficulty:
      !s.highestDifficulty ||
      RANK.indexOf(record.difficulty) > RANK.indexOf(s.highestDifficulty)
        ? record.difficulty
        : s.highestDifficulty,
    recent: [record, ...s.recent].slice(0, 15),
    daily: dailyId
      ? { ...s.daily, [dailyId]: { score: record.score, correct: record.correct, total: record.total } }
      : s.daily,
  };
  try {
    window.localStorage.setItem(STATS_KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked — game continues */
  }
  return next;
}

export function loadSettings(fallback: Settings): Settings {
  if (typeof window === "undefined") return fallback;
  return safeParse(window.localStorage.getItem(SETTINGS_KEY), fallback);
}

export function saveSettings(s: Settings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
