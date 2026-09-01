import { useEffect, useRef, useState, useCallback } from "react";
import { PIG_ANIM_FRAMES, PIG_ANIM_FPS, type PigAnimKey } from "../assets/pigAnim";

/**
 * 小猪动画状态机 —— 真实逐帧序列播放
 *
 * 8 组动作（每组 12 帧）：
 *   idle  待机呼吸（常驻循环）
 *   blink 眨眼（低频随机）
 *   ear   耳朵轻颤（低频随机）
 *   yawn  打哈欠（挂机/下班后低频）
 *   look  抬头看时间（临近下班/停留后触发）
 *   tap   点击回弹（用户触发）
 *   coin  金币入槽（收入累计触发）
 *   off   下班庆祝（倒计时归零触发）
 *
 * 每次动作都有 anticipation → action → recovery 过渡。
 * 频率刻意压低，保持安静。
 */

export type PigAction = PigAnimKey | "sleep";

interface Options {
  resting?: boolean;   // 休息/下班状态（进入 sleep）
  paused?: boolean;    // 完全静止（挂机）
  onIncome?: () => void; // 由收入驱动时回调（可加音效等）
}

/**
 * 播放动作。返回一个可中断的令牌，避免切页后旧播放器污染。
 */
export function usePigAnimator(opts: Options = {}) {
  const [frameIdx, setFrameIdx] = useState(0);
  const [action, setAction] = useState<PigAction>(opts.resting ? "sleep" : "idle");
  const [tick, setTick] = useState(0); // 帧推进触发器
  const busyRef = useRef(false);
  const seqRef = useRef<number>(0);
  const { resting, paused } = opts;

  // ---- 基础帧循环（idle 常驻） ----
  useEffect(() => {
    if (paused) return;
    if (resting) {
      // sleep：用 blink 帧做慢速呼吸 + 偶尔动
      setAction("sleep");
      const iv = setInterval(() => setFrameIdx(i => (i + 1) % PIG_ANIM_FRAMES.blink.length), 700);
      return () => clearInterval(iv);
    }
    // idle 呼吸循环（12 帧）
    setAction("idle");
    const iv = setInterval(() => setFrameIdx(i => (i + 1) % PIG_ANIM_FRAMES.idle.length), 1000 / PIG_ANIM_FPS.idle);
    return () => clearInterval(iv);
  }, [paused, resting]);

  // ---- 单次动作播放器（非循环：blink/ear/yawn/look/tap/coin/off） ----
  const play = useCallback(async (act: PigAnimKey): Promise<void> => {
    const mySeq = ++seqRef.current;
    if (busyRef.current && act !== "tap") return;
    busyRef.current = true;
    const frames = PIG_ANIM_FRAMES[act];
    const fps = PIG_ANIM_FPS[act];
    setAction(act);
    for (let i = 0; i < frames.length; i++) {
      if (mySeq !== seqRef.current) break; // 被新动作打断
      setFrameIdx(i);
      setTick(t => t + 1);
      await new Promise<void>(res => setTimeout(res, 1000 / fps));
    }
    if (mySeq === seqRef.current) {
      // 回到 idle
      setAction("idle");
      setFrameIdx(0);
    }
    busyRef.current = false;
  }, []);

  // ---- 低频随机调度（blink / ear / look / yawn） ----
  useEffect(() => {
    if (paused || resting) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      if (cancelled) return;
      const r = Math.random();
      let act: PigAnimKey;
      let delay: number;
      if (r < 0.6) {
        act = "blink";
        delay = 8000 + Math.random() * 16000;   // 8-24s
      } else if (r < 0.85) {
        act = "ear";
        delay = 20000 + Math.random() * 30000;  // 20-50s
      } else if (r < 0.95) {
        act = "look";
        delay = 50000 + Math.random() * 60000;  // 50-110s
      } else {
        act = "yawn";
        delay = 240000 + Math.random() * 240000; // 4-8min
      }
      timer = setTimeout(async () => {
        if (cancelled) return;
        if (!busyRef.current) await play(act);
        schedule();
      }, delay);
    };
    schedule();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [paused, resting, play]);

  return {
    frameUrl: PIG_ANIM_FRAMES[action === "sleep" ? "blink" : action][frameIdx % PIG_ANIM_FRAMES[action === "sleep" ? "blink" : action].length],
    action,
    frameIdx,
    tick,
    trigger: play,
    width: 150,
    height: 150,
  };
}
