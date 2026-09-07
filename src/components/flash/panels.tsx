import { DIFFICULTIES, MODES, PRESETS, type Settings } from "@/lib/flash/engine";
import type { Stats } from "@/lib/flash/storage";
import { Btn, Chip, Overlay, Row } from "./ui";

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`h-7 w-12 rounded-full p-1 transition-colors ${on ? "bg-primary" : "bg-muted"}`}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-background transition-transform ${
          on ? "translate-x-5" : ""
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
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  suffix: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-32 accent-[var(--primary)]"
      />
      <span className="tabular w-16 text-right text-sm">
        {value}
        {suffix}
      </span>
    </div>
  );
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
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    onChange({ ...settings, [k]: v });

  return (
    <Overlay title="Settings" onClose={onClose}>
      <Row label="Mode">
        <select
          aria-label="Game mode"
          value={settings.mode}
          onChange={(e) => set("mode", e.target.value as Settings["mode"])}
          className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
        >
          {MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </Row>

      <Row label="Difficulty">
        <select
          aria-label="Difficulty"
          value={settings.difficulty}
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
          className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
        >
          {DIFFICULTIES.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </Row>

      <Row label="Numbers per round">
        <Slider
          label="Numbers per round"
          value={settings.flashes}
          min={2}
          max={20}
          suffix=""
          onChange={(v) => set("flashes", v)}
        />
      </Row>
      <Row label="Flash time">
        <Slider
          label="Flash time"
          value={settings.flashMs}
          min={200}
          max={2000}
          step={50}
          suffix="ms"
          onChange={(v) => set("flashMs", v)}
        />
      </Row>
      <Row label="Gap">
        <Slider
          label="Gap between numbers"
          value={settings.gapMs}
          min={0}
          max={800}
          step={20}
          suffix="ms"
          onChange={(v) => set("gapMs", v)}
        />
      </Row>
      <Row label="Rounds">
        <Slider
          label="Rounds"
          value={settings.rounds}
          min={1}
          max={30}
          suffix=""
          onChange={(v) => set("rounds", v)}
        />
      </Row>
      <Row label="Countdown">
        <Toggle label="Countdown" on={settings.countdown} onChange={(v) => set("countdown", v)} />
      </Row>
      <Row label="Sound">
        <Toggle label="Sound" on={settings.sound} onChange={(v) => set("sound", v)} />
      </Row>
      <Row label="Vibration">
        <Toggle label="Vibration" on={settings.haptics} onChange={(v) => set("haptics", v)} />
      </Row>

      <div className="mt-5">
        <Btn variant="primary" className="w-full" onClick={onClose}>
          Done
        </Btn>
      </div>
    </Overlay>
  );
}

export function StatsPanel({ stats, onClose }: { stats: Stats; onClose: () => void }) {
  const accuracy = stats.questions ? Math.round((stats.correct / stats.questions) * 100) : 0;
  const items: [string, string][] = [
    ["Games played", String(stats.gamesPlayed)],
    ["Questions", String(stats.questions)],
    ["Correct", String(stats.correct)],
    ["Accuracy", `${accuracy}%`],
    ["Best score", stats.bestScore.toLocaleString()],
    ["Best streak", String(stats.bestStreak)],
    ["Fastest flash", stats.fastestFlashMs ? `${stats.fastestFlashMs}ms` : "—"],
    ["Highest level", stats.highestDifficulty ?? "—"],
  ];

  return (
    <Overlay title="Your stats" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        {items.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-secondary px-4 py-3">
            <div className="text-xs text-muted-foreground">{k}</div>
            <div className="tabular font-display text-xl font-semibold capitalize">{v}</div>
          </div>
        ))}
      </div>

      {stats.recent.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Recent games</h3>
          <ul className="space-y-1">
            {stats.recent.slice(0, 8).map((r, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="capitalize text-muted-foreground">
                  {r.mode} · {r.difficulty}
                </span>
                <span className="tabular">
                  {r.correct}/{r.total} · {r.score.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Overlay>
  );
}
