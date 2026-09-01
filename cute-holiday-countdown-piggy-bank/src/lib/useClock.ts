import { useEffect, useState, useMemo } from "react";
import type { Settings } from "./store";
import {
  nextWorkStart,
  nextWeekendStart,
  nextPaydayMs,
  atTime,
  parseHM,
  calcWage,
  hmToMin,
  DAY,
} from "./time";
import { CN_2026, dayKey } from "./holidays";

/**
 * 唯一时间状态源
 * 所有 UI 组件必须从此 hook 取数，禁止各自计算
 */
export interface Clock {
  now: number;

  /** 今日下班倒计时 ms（还没下班时；否则 null） */
  toOffWork: number | null;

  /** 明日/下一个上班时刻倒计时 ms（今天上班且未下班时为 null） */
  toNextWork: number | null;

  /** 距今天上班时刻（还没上班时） ms | null */
  toStartWork: number | null;

  /** 今日阶段 */
  phase: "before" | "morning" | "lunch" | "afternoon" | "after" | "dayoff" | "holiday" | "weekend";

  /** 时间轨道：start/end 是今天上下班时刻绝对 ms；ratio 0-1 */
  track: { start: number; end: number; ratio: number } | null;

  /** 今日已工作 ms */
  workedMs: number;

  /** 今日已赚 ¥ */
  todayEarned: number;

  /** 各粒度工资 */
  rate: { hourly: number; perMin: number; perSec: number; daily: number; monthly: number };

  /** 未来事件（按距离排序） */
  events: FutureEvent[];

  /** 今日日期 label */
  dateLabel: string;

  /** 是否深色时段（用于问候语等） */
  isEvening: boolean;
}

export interface FutureEvent {
  id: string;
  kind: "offwork" | "weekend" | "payday" | "holiday" | "custom";
  name: string;
  ms: number;
  targetMs: number;
  days: number;
  emoji?: string;
}

export function useClock(settings: Settings, tickInterval = 1000): Clock {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), tickInterval);
    return () => clearInterval(timer);
  }, [tickInterval]);

  return useMemo(() => buildClock(now, settings), [now, settings]);
}

function buildClock(now: number, s: Settings): Clock {
  // 每日工作分钟数（含扣除午休）
  const workMinPerDay =
    hmToMin(s.end) - hmToMin(s.start) -
    (s.lunchEnabled ? hmToMin(s.lunchEnd) - hmToMin(s.lunchStart) : 0);

  const wage = calcWage(s.mode, s.wage, Math.max(0, workMinPerDay), s.monthlyWorkdays);

  const schedule = {
    start: s.start,
    end: s.end,
    lunchStart: s.lunchEnabled ? s.lunchStart : undefined,
    lunchEnd: s.lunchEnabled ? s.lunchEnd : undefined,
  };

  const todayKey = dayKey(now);
  const isHoliday = CN_2026.holidays.some(h => todayKey >= h.start && todayKey <= h.end);
  const isMakeup = CN_2026.workdays.includes(todayKey);
  const dow = new Date(now).getDay();
  const isTodayWork = isMakeup || (!isHoliday && s.workweek.includes(dow));

  const workStartMs = atTime(now, s.start);
  const workEndMs = atTime(now, s.end);

  let phase: Clock["phase"];
  let toOffWork: number | null = null;
  let toNextWork: number | null = null;
  let toStartWork: number | null = null;
  let track: Clock["track"] = null;

  if (isHoliday) {
    phase = "holiday";
    toNextWork = nextWorkStart(now, s.workweek, schedule) - now;
  } else if (!isTodayWork) {
    phase = dow === 0 || dow === 6 ? "weekend" : "dayoff";
    toNextWork = nextWorkStart(now, s.workweek, schedule) - now;
  } else if (now < workStartMs) {
    phase = "before";
    toStartWork = workStartMs - now;
    toOffWork = workEndMs - now;
    track = { start: workStartMs, end: workEndMs, ratio: 0 };
  } else if (now >= workEndMs) {
    phase = "after";
    toNextWork = nextWorkStart(now, s.workweek, schedule) - now;
    track = { start: workStartMs, end: workEndMs, ratio: 1 };
  } else {
    if (s.lunchEnabled) {
      const lunchS = atTime(now, s.lunchStart);
      const lunchE = atTime(now, s.lunchEnd);
      if (now >= lunchS && now < lunchE) phase = "lunch";
      else phase = now < lunchS ? "morning" : "afternoon";
    } else {
      phase = "morning";
    }
    toOffWork = workEndMs - now;
    const ratio = (now - workStartMs) / (workEndMs - workStartMs);
    track = { start: workStartMs, end: workEndMs, ratio: Math.max(0, Math.min(1, ratio)) };
  }

  // 未来事件
  const events: FutureEvent[] = [];

  if (toOffWork !== null && toOffWork > 0) {
    events.push({
      id: "offwork", kind: "offwork", name: "今日下班",
      ms: toOffWork, targetMs: workEndMs, days: 0,
    });
  }
  const weekendMs = nextWeekendStart(now, schedule, s.weekendStartDay, s.weekendStartTime);
  if (weekendMs > now) {
    events.push({
      id: "weekend", kind: "weekend", name: "周末",
      ms: weekendMs - now, targetMs: weekendMs,
      days: Math.ceil((weekendMs - now) / DAY),
    });
  }
  const paydayMs = nextPaydayMs(
    now, s.paydayDay,
    parseHM(s.paydayTime).h,
    parseHM(s.paydayTime).m
  );
  events.push({
    id: "payday", kind: "payday", name: "发薪",
    ms: paydayMs - now, targetMs: paydayMs,
    days: Math.ceil((paydayMs - now) / DAY),
  });

  for (const h of CN_2026.holidays) {
    const startMs = new Date(h.start + "T00:00:00").getTime();
    if (startMs > now) {
      events.push({
        id: `h-${h.name}-${h.start}`, kind: "holiday", name: h.name,
        ms: startMs - now, targetMs: startMs,
        days: Math.ceil((startMs - now) / DAY),
        emoji: h.emoji,
      });
    }
  }

  for (const e of s.events) {
    const t = new Date(e.date + "T00:00:00").getTime();
    if (t > now) {
      events.push({
        id: `c-${e.id}`, kind: "custom", name: e.name,
        ms: t - now, targetMs: t,
        days: Math.ceil((t - now) / DAY),
        emoji: e.emoji,
      });
    }
  }

  events.sort((a, b) => a.ms - b.ms);

  // 今日已工作
  let workedMs = 0;
  if (track && phase !== "before") {
    workedMs = now - track.start;
    if (s.lunchEnabled) {
      const lunchS = atTime(now, s.lunchStart);
      const lunchE = atTime(now, s.lunchEnd);
      if (now > lunchE) workedMs -= (lunchE - lunchS);
      else if (now > lunchS) workedMs -= (now - lunchS);
    }
    workedMs = Math.max(0, Math.min(workedMs, wage.dailyWorkMs));
  }
  const todayEarned = (workedMs / 3600000) * wage.hourly;

  // 日期 label
  const d = new Date(now);
  const wStr = ["日","一","二","三","四","五","六"][d.getDay()];
  const dateLabel = `${d.getMonth() + 1}月${d.getDate()}日 · 周${wStr}`;

  const hour = d.getHours();
  const isEvening = hour < 6 || hour >= 18;

  return {
    now,
    toOffWork, toNextWork, toStartWork,
    phase, track,
    workedMs, todayEarned,
    rate: {
      hourly: wage.hourly,
      perMin: wage.perMin,
      perSec: wage.perSec,
      daily: wage.daily,
      monthly: wage.monthly,
    },
    events,
    dateLabel,
    isEvening,
  };
}
