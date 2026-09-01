import { useCallback, useEffect, useRef, useState } from "react";
import { PIG_ANIM_FRAMES, PIG_ANIM_FPS, type PigAnimKey } from "../assets/pigAnim";

export type PigAction = PigAnimKey;

interface Options {
  /** 深夜静息：继续轻呼吸，但不随机插入动作。 */
  resting?: boolean;
  paused?: boolean;
}

const COOLDOWN_MS: Record<Exclude<PigAnimKey, "idle" | "tap" | "coin" | "off">, number> = {
  blink: 18_000,
  ear: 42_000,
  look: 72_000,
  yawn: 180_000,
};

const RANDOM_POOL: readonly Exclude<PigAnimKey, "idle" | "tap" | "coin" | "off">[] = [
  "blink", "blink", "blink", "ear", "ear", "look", "yawn",
];

const wait = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));

/** Stable, non-overlapping frame animation state machine. */
export function usePigAnimator({ resting = false, paused = false }: Options = {}) {
  const [frameIdx, setFrameIdx] = useState(0);
  const [action, setAction] = useState<PigAction>("idle");
  const [tick, setTick] = useState(0);
  const busyRef = useRef(false);
  const sequenceRef = useRef(0);
  const mountedRef = useRef(true);
  const lastPlayedRef = useRef<Partial<Record<PigAnimKey, number>>>({});
  const lastRandomRef = useRef<PigAnimKey | null>(null);
  const pausedRef = useRef(paused);
  const restingRef = useRef(resting);
  pausedRef.current = paused;
  restingRef.current = resting;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sequenceRef.current += 1;
      busyRef.current = false;
    };
  }, []);

  // Preload local frames once; action changes must never flash an empty image.
  useEffect(() => {
    Object.values(PIG_ANIM_FRAMES).flat().forEach(src => {
      const image = new Image();
      image.decoding = "async";
      image.src = src;
    });
  }, []);

  // Idle owns its own interval. One-shot actions suspend it completely.
  useEffect(() => {
    if (paused || action !== "idle") return;
    const fps = resting ? 5 : PIG_ANIM_FPS.idle;
    const timer = window.setInterval(() => {
      if (!busyRef.current) {
        setFrameIdx(index => (index + 1) % PIG_ANIM_FRAMES.idle.length);
        setTick(value => value + 1);
      }
    }, 1000 / fps);
    return () => window.clearInterval(timer);
  }, [action, paused, resting]);

  useEffect(() => {
    if (!paused) return;
    sequenceRef.current += 1;
    busyRef.current = false;
    setAction("idle");
    setFrameIdx(0);
  }, [paused]);

  const play = useCallback(async (nextAction: PigAnimKey): Promise<boolean> => {
    if (pausedRef.current || busyRef.current) return false;
    if (restingRef.current && !["tap", "coin", "off"].includes(nextAction)) return false;

    busyRef.current = true;
    const sequence = ++sequenceRef.current;
    const frames = PIG_ANIM_FRAMES[nextAction];
    const frameMs = 1000 / PIG_ANIM_FPS[nextAction];
    lastPlayedRef.current[nextAction] = Date.now();
    setAction(nextAction);
    setFrameIdx(0);

    for (let index = 0; index < frames.length; index += 1) {
      if (!mountedRef.current || sequence !== sequenceRef.current) return false;
      setFrameIdx(index);
      setTick(value => value + 1);
      await wait(frameMs);
    }

    if (!mountedRef.current || sequence !== sequenceRef.current) return false;
    setAction("idle");
    setFrameIdx(0);
    busyRef.current = false;
    return true;
  }, []);

  // A fresh random choice is made after every quiet gap. Per-action cooldowns
  // prevent mechanical blink-ear-blink loops and keep yawn genuinely rare.
  useEffect(() => {
    if (paused || resting) return;
    let cancelled = false;
    let timer = 0;

    const schedule = () => {
      const delay = 9_000 + Math.random() * 14_000;
      timer = window.setTimeout(async () => {
        if (cancelled) return;
        const now = Date.now();
        const eligible = RANDOM_POOL.filter(candidate =>
          candidate !== lastRandomRef.current &&
          now - (lastPlayedRef.current[candidate] ?? 0) >= COOLDOWN_MS[candidate],
        );
        if (eligible.length > 0 && !busyRef.current) {
          const candidate = eligible[Math.floor(Math.random() * eligible.length)];
          lastRandomRef.current = candidate;
          await play(candidate);
        }
        if (!cancelled) schedule();
      }, delay);
    };

    schedule();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [paused, play, resting]);

  return {
    frameUrl: PIG_ANIM_FRAMES[action][frameIdx % PIG_ANIM_FRAMES[action].length],
    action,
    frameIdx,
    tick,
    trigger: play,
    isBusy: busyRef.current,
    width: 512,
    height: 512,
  };
}
