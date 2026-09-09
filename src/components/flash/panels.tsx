import {
  DIFFICULTIES,
  MODES,
  PRESETS,
  dailyPlaySettings,
  type Difficulty,
  type Mode,
  type Settings,
} from "@/lib/flash/engine";
import type { Stats } from "@/lib/flash/storage";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatNumber, type EnKey } from "@/lib/i18n";
import { canVibrate, unlockAudio } from "@/lib/flash/sound";
import { Btn, Overlay, Row } from "./ui";

function modeKey(id: Mode): EnKey {
  return `mode.${id}` as EnKey;
}

function difficultyKey(id: Difficulty): EnKey {
  return `difficulty.${id}` as EnKey;
}

function Toggle({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onChange(!on);
      }}
      className={`h-8 w-12 rounded-full p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        on ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`block h-6 w-6 rounded-full bg-background transition-transform ${
          on ? "translate-x-4" : ""
        }`}
      />
    </button>
  );
}

function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix,
  label,
  disabled,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  suffix: string;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className={`flex w-full min-w-0 items-center gap-3 sm:w-auto ${disabled ? "opacity-40" : ""}`}>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 flex-1 accent-[var(--primary)] disabled:cursor-not-allowed sm:w-40 sm:flex-none"
      />
      <span className="tabular w-16 shrink-0 text-right text-sm">
        {value}
        {suffix}
      </span>
    </div>
  );
}

function Hint({ children }: { children: string }) {
  return <p className="mt-1 text-right text-xs text-muted-foreground">{children}</p>;
}

export function SettingsPanel({
  settings,
  onChange,
  onClose,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const display = settings.mode === "daily" ? dailyPlaySettings(settings) : settings;
  const canEditRounds = settings.mode !== "survival" && settings.mode !== "speed" && settings.mode !== "daily";
  const canEditFlashMs = settings.mode !== "speed" && settings.mode !== "daily";
  const canEditDifficulty = settings.mode !== "daily";
  const canEditFlashes = settings.mode !== "daily";
  const canEditGap = settings.mode !== "daily";
  const vibrateOk = canVibrate();

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    if (k === "sound" && v === true) unlockAudio();
    onChange({ ...settings, [k]: v });
  };

  return (
    <Overlay title={t("settings.title")} onClose={onClose}>
      <Row label={t("settings.mode")}>
        <select
          aria-label={t("settings.gameMode")}
          value={settings.mode}
          onChange={(e) => {
            const mode = e.target.value as Settings["mode"];
            onChange(
              mode === "daily"
                ? dailyPlaySettings({ ...settings, mode: "daily" })
                : { ...settings, mode },
            );
          }}
          className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
        >
          {MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {t(modeKey(m.id))}
            </option>
          ))}
        </select>
      </Row>

      <div>
        <Row label={t("settings.difficulty")}>
          <select
            aria-label={t("settings.difficulty")}
            value={display.difficulty}
            disabled={!canEditDifficulty}
            onChange={(e) => {
              const d = e.target.value as Settings["difficulty"];
              const p = PRESETS[d];
              onChange({
                ...settings,
                difficulty: d,
                flashes: p.flashes,
                flashMs: p.flashMs,
                gapMs: p.gapMs,
              });
            }}
            className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            {DIFFICULTIES.map((d) => (
              <option key={d.id} value={d.id}>
                {t(difficultyKey(d.id))}
              </option>
            ))}
          </select>
        </Row>
        {!canEditDifficulty && <Hint>{t("settings.hint.dailyPinned")}</Hint>}
      </div>

      <div>
        <Row label={t("settings.numbersPerRound")}>
          <Slider
            label={t("settings.numbersPerRound")}
            value={display.flashes}
            min={2}
            max={20}
            suffix=""
            disabled={!canEditFlashes}
            onChange={(v) => set("flashes", v)}
          />
        </Row>
        {!canEditFlashes && <Hint>{t("settings.hint.dailyPinned")}</Hint>}
      </div>

      <div>
        <Row label={t("settings.flashTime")}>
          <Slider
            label={t("settings.flashTime")}
            value={display.flashMs}
            min={200}
            max={2000}
            step={50}
            suffix="ms"
            disabled={!canEditFlashMs}
            onChange={(v) => set("flashMs", v)}
          />
        </Row>
        {settings.mode === "speed" && <Hint>{t("settings.hint.flashSpeed")}</Hint>}
        {settings.mode === "daily" && <Hint>{t("settings.hint.dailyPinned")}</Hint>}
      </div>

      <div>
        <Row label={t("settings.gap")}>
          <Slider
            label={t("settings.gapBetween")}
            value={display.gapMs}
            min={0}
            max={800}
            step={20}
            suffix="ms"
            disabled={!canEditGap}
            onChange={(v) => set("gapMs", v)}
          />
        </Row>
        {!canEditGap && <Hint>{t("settings.hint.dailyPinned")}</Hint>}
      </div>

      <div>
        <Row label={t("settings.rounds")}>
          <Slider
            label={t("settings.rounds")}
            value={display.rounds}
            min={1}
            max={30}
            suffix=""
            disabled={!canEditRounds}
            onChange={(v) => set("rounds", v)}
          />
        </Row>
        {(settings.mode === "survival" || settings.mode === "speed") && (
          <Hint>{t("settings.hint.roundsEndless")}</Hint>
        )}
        {settings.mode === "daily" && <Hint>{t("settings.hint.roundsDaily")}</Hint>}
      </div>

      <Row label={t("settings.countdown")}>
        <Toggle
          label={t("settings.countdown")}
          on={settings.countdown}
          onChange={(v) => set("countdown", v)}
        />
      </Row>
      <Row label={t("settings.sound")}>
        <Toggle label={t("settings.sound")} on={settings.sound} onChange={(v) => set("sound", v)} />
      </Row>
      <div>
        <Row label={t("settings.vibration")}>
          <Toggle
            label={t("settings.vibration")}
            on={settings.haptics && vibrateOk}
            disabled={!vibrateOk}
            onChange={(v) => set("haptics", v)}
          />
        </Row>
        {!vibrateOk && <Hint>{t("settings.hint.vibrationUnavailable")}</Hint>}
      </div>

      <div className="mt-5">
        <Btn variant="primary" className="w-full" onClick={onClose}>
          {t("action.done")}
        </Btn>
      </div>
    </Overlay>
  );
}

export function StatsPanel({ stats, onClose }: { stats: Stats; onClose: () => void }) {
  const { t, locale } = useLocale();
  const accuracy = stats.questions ? Math.round((stats.correct / stats.questions) * 100) : 0;
  const empty = t("stats.empty");
  const items: [string, string][] = [
    [t("stats.gamesPlayed"), String(stats.gamesPlayed)],
    [t("stats.questions"), String(stats.questions)],
    [t("stats.correct"), String(stats.correct)],
    [t("stats.accuracy"), `${accuracy}%`],
    [t("stats.bestScore"), formatNumber(locale, stats.bestScore)],
    [t("stats.bestStreak"), String(stats.bestStreak)],
    [t("stats.fastestFlash"), stats.fastestFlashMs ? `${stats.fastestFlashMs}ms` : empty],
    [
      t("stats.highestLevel"),
      stats.highestDifficulty ? t(difficultyKey(stats.highestDifficulty)) : empty,
    ],
  ];

  return (
    <Overlay title={t("stats.title")} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        {items.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-secondary px-4 py-3">
            <div className="text-xs text-muted-foreground">{k}</div>
            <div className="tabular font-display text-xl font-semibold">{v}</div>
          </div>
        ))}
      </div>

      {stats.recent.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            {t("stats.recent")}
          </h3>
          <ul className="space-y-1">
            {stats.recent.slice(0, 8).map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">
                  {t(modeKey(r.mode))} · {t(difficultyKey(r.difficulty))}
                </span>
                <span className="tabular shrink-0">
                  {r.correct}/{r.total} · {formatNumber(locale, r.score)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Overlay>
  );
}
