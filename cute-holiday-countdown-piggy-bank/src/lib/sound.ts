let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function blip(freq: number, at: number, dur: number, type: OscillatorType, vol: number) {
  const c = ac();
  if (!c) return;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(at);
    o.stop(at + dur + 0.05);
  } catch {
    /* ignore */
  }
}

/** 敲罐硬币音，combo 越高音调越亮 */
export function playCoin(combo = 0) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const f = 988 * Math.pow(1.059, Math.min(combo, 12));
  blip(f, t, 0.1, "triangle", 0.18);
  blip(f * 1.335, t + 0.06, 0.16, "triangle", 0.15);
}

/** 周五打款小号角 */
export function playPayday() {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  [523, 659, 784, 1046, 1318].forEach((f, i) => blip(f, t + i * 0.11, 0.22, "triangle", 0.2));
}
