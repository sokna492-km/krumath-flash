// Tiny Web Audio blip generator — no audio files, no licensing concerns.

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type Tone = "tick" | "flash" | "correct" | "wrong" | "streak" | "go";

const TONES: Record<Tone, { f: number; to: number; d: number; type: OscillatorType; g: number }> = {
  tick: { f: 440, to: 440, d: 0.07, type: "sine", g: 0.05 },
  go: { f: 660, to: 880, d: 0.16, type: "sine", g: 0.07 },
  flash: { f: 320, to: 320, d: 0.03, type: "sine", g: 0.025 },
  correct: { f: 620, to: 940, d: 0.16, type: "triangle", g: 0.07 },
  wrong: { f: 260, to: 150, d: 0.22, type: "sawtooth", g: 0.05 },
  streak: { f: 780, to: 1180, d: 0.2, type: "triangle", g: 0.06 },
};

export function play(tone: Tone, enabled: boolean) {
  if (!enabled) return;
  const ac = audio();
  if (!ac) return;
  const t = TONES[tone];
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = t.type;
  osc.frequency.setValueAtTime(t.f, ac.currentTime);
  osc.frequency.linearRampToValueAtTime(t.to, ac.currentTime + t.d);
  gain.gain.setValueAtTime(t.g, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t.d);
  osc.connect(gain).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + t.d + 0.02);
}

export function buzz(ms: number, enabled: boolean) {
  if (!enabled || typeof navigator === "undefined" || !navigator.vibrate) return;
  try {
    navigator.vibrate(ms);
  } catch {
    /* ignore */
  }
}
