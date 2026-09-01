import { useEffect, useRef, useState } from "react";

/**
 * 金币入槽驱动 —— 把「真实收入增长」与「小猪收币动画」挂钩
 *
 * 收入每秒真实增长，但金币动画要克制。
 * 触发策略：累计约 ¥1（或按时薪自适应为 30~90 秒一次）触发一次 coin 动画。
 * 纯前端，只是触发时机，不改变收入数据本身。
 */
export function useCoinDriver(
  earnedToday: number,
  perHour: number,
  enabled: boolean
) {
  // 上一次触发时的收入快照
  const lastEarnedRef = useRef(earnedToday);
  const [coinCount, setCoinCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // 触发间隔：按时薪换算，目标 ≈ ¥1 一记，夹在 30~90s
    const hourly = Math.max(1, perHour);
    const intervalSec = Math.min(90, Math.max(30, 3600 / hourly));

    timerRef.current = setInterval(() => {
      // 只要期间收入又增加了一个阈值，就触发
      setCoinCount(c => c + 1);
    }, intervalSec * 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [perHour, enabled]);

  useEffect(() => {
    lastEarnedRef.current = earnedToday;
  }, [earnedToday]);

  return coinCount;
}
