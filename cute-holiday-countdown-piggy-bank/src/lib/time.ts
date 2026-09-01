export const DAY = 86400000;
export const HOUR = 3600000;
export const MIN = 60000;
export const SEC = 1000;

export function parseHM(v: string): { h: number; m: number } {
  const [h, m] = v.split(":").map(Number);
  return { h: h || 0, m: m || 0 };
}
export function hmToMin(v: string): number {
  const { h, m } = parseHM(v);
  return h * 60 + m;
}
export function hmToMs(v: string): number {
  return hmToMin(v) * 60 * 1000;
}

function shiftDay(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}
export function atTime(day: Date | number, hm: string): number {
  const d = typeof day === "number" ? new Date(day) : new Date(day);
  const { h, m } = parseHM(hm);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function countdownParts(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(t / 86400),
    h: Math.floor((t % 86400) / 3600),
    m: Math.floor((t % 3600) / 60),
    s: t % 60,
  };
}

export function fmtMoney(n: number, digits = 2): string {
  return "¥" + n.toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
export function fmtShort(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + "w";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toFixed(n < 10 ? 2 : 0);
}

export function fmtDur(ms: number, showSec = false): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}天`);
  if (h > 0) parts.push(`${h}小时`);
  if (m > 0) parts.push(`${pad2(m)}分`);
  if (showSec && d === 0) parts.push(`${pad2(ss)}秒`);
  return parts.join("") || "0 分";
}

/* ---------- 工资换算 ---------- */
export type WageMode = "hourly" | "daily" | "monthly";

export interface WageBreakdown {
  mode: WageMode;
  amount: number; // 原始数值
  monthly: number; // 月
  daily: number; // 日
  hourly: number; // 时
  perMin: number; // 每分钟
  perSec: number; // 每秒
  dailyWorkMs: number; // 每日有效工作毫秒
  monthlyWorkdays: number;
}

export function calcWage(
  mode: WageMode,
  amount: number,
  workMinPerDay: number,
  monthlyWorkdays: number
): WageBreakdown {
  const dailyWorkMs = workMinPerDay * 60 * 1000;
  const dailyHours = workMinPerDay / 60;
  let monthly = 0,
    daily = 0,
    hourly = 0;
  if (mode === "hourly") {
    hourly = amount;
    daily = hourly * dailyHours;
    monthly = daily * monthlyWorkdays;
  } else if (mode === "daily") {
    daily = amount;
    hourly = dailyHours > 0 ? daily / dailyHours : 0;
    monthly = daily * monthlyWorkdays;
  } else {
    monthly = amount;
    daily = monthlyWorkdays > 0 ? monthly / monthlyWorkdays : 0;
    hourly = dailyHours > 0 ? daily / dailyHours : 0;
  }
  return {
    mode,
    amount,
    monthly,
    daily,
    hourly,
    perMin: hourly / 60,
    perSec: hourly / 3600,
    dailyWorkMs,
    monthlyWorkdays,
  };
}

/* ---------- 每日工作切片（含午休） ---------- */
export interface DaySchedule {
  start: string;
  end: string;
  lunchStart?: string;
  lunchEnd?: string;
}

export interface DaySlices {
  work: [number, number][]; // 毫秒区间
  totalMs: number;
  lunchMs: number;
}

export function daySlices(base: number, s: DaySchedule): DaySlices {
  const s0 = atTime(base, s.start);
  const e0 = atTime(base, s.end);
  if (e0 <= s0) return { work: [], totalMs: 0, lunchMs: 0 };
  let total = e0 - s0;
  let lunchMs = 0;
  const work: [number, number][] = [];
  if (s.lunchStart && s.lunchEnd) {
    const ls = atTime(base, s.lunchStart);
    const le = atTime(base, s.lunchEnd);
    if (le > ls && ls >= s0 && le <= e0) {
      lunchMs = le - ls;
      total -= lunchMs;
      work.push([s0, ls]);
      work.push([le, e0]);
    } else {
      work.push([s0, e0]);
    }
  } else {
    work.push([s0, e0]);
  }
  return { work, totalMs: total, lunchMs };
}

/** 计算 [from, to] 区间内，在给定工作日/作息下的有效工作毫秒数（最多回看 maxDays） */
export function workMsBetween(
  from: number,
  to: number,
  workweek: number[],
  schedule: DaySchedule,
  maxDays = 14
): number {
  if (to <= from) return 0;
  let cur = from;
  if (to - from > maxDays * DAY) cur = to - maxDays * DAY;
  const day0 = new Date(cur);
  day0.setHours(0, 0, 0, 0);
  let total = 0;
  for (let i = 0; i <= maxDays + 1; i++) {
    const day = shiftDay(day0, i);
    const dk = dayKind(day.getTime(), workweek);
    if (dk.kind !== "work") {
      if (day.getTime() + DAY > to) break;
      continue;
    }
    const { work: slices } = daySlices(day.getTime(), schedule);
    for (const [ws, we] of slices) {
      const lo = Math.max(ws, cur);
      const hi = Math.min(we, to);
      if (hi > lo) total += hi - lo;
    }
    if (day.getTime() + DAY > to) break;
  }
  return total;
}

/* ---------- 今日状态 ---------- */
export type WorkPhase = "before" | "morning" | "lunch" | "afternoon" | "after" | "dayoff";

export interface TodayStatus {
  phase: WorkPhase;
  todayWorkMs: number; // 今日计划有效工作 ms
  workedMs: number; // 已工作 ms
  progress: number; // 0-1
  /** 下一个事件的剩余毫秒（下班 / 午休结束 / 开工） */
  nextEvent: { label: string; ms: number } | null;
  isTodayWork: boolean;
  kindLabel: string;
}

import { dayKind } from "./holidays";
void dayKind;

export function todayStatus(now: number, workweek: number[], schedule: DaySchedule): TodayStatus {
  const dk = dayKind(now, workweek);
  void workweek;
  if (dk.kind !== "work") {
    return {
      phase: "dayoff",
      todayWorkMs: 0,
      workedMs: 0,
      progress: 0,
      nextEvent: null,
      isTodayWork: false,
      kindLabel: dk.kind === "holiday" ? `今天是${dk.holiday?.name}！` : dk.isMakeup ? "调休上班" : "今天休息",
    };
  }
  const slices = daySlices(now, schedule);
  const todayStart = slices.work[0]?.[0] ?? atTime(now, schedule.start);
  const todayEnd = slices.work[slices.work.length - 1]?.[1] ?? atTime(now, schedule.end);
  let worked = 0;
  let phase: WorkPhase = "before";
  let nextEvent: { label: string; ms: number } | null = null;

  if (now < todayStart) {
    phase = "before";
    nextEvent = { label: "距离开工", ms: todayStart - now };
  } else if (now >= todayEnd) {
    phase = "after";
    worked = slices.totalMs;
    nextEvent = null;
  } else {
    if (slices.work.length === 2 && schedule.lunchStart && schedule.lunchEnd) {
      const ls = atTime(now, schedule.lunchStart);
      const le = atTime(now, schedule.lunchEnd);
      if (now < ls) {
        phase = "morning";
        worked = now - todayStart;
        nextEvent = { label: "午休倒计时", ms: ls - now };
      } else if (now < le) {
        phase = "lunch";
        worked = ls - todayStart;
        nextEvent = { label: "午休中，还剩", ms: le - now };
      } else {
        phase = "afternoon";
        worked = ls - todayStart + (now - le);
        nextEvent = { label: "距离下班", ms: todayEnd - now };
      }
    } else {
      phase = slices.work.length === 1 ? (now < slices.work[0][1] ? "morning" : "after") : "morning";
      worked = Math.min(now - todayStart, slices.totalMs);
      nextEvent = { label: "距离下班", ms: todayEnd - now };
    }
  }
  const total = slices.totalMs || 1;
  return {
    phase,
    todayWorkMs: slices.totalMs,
    workedMs: Math.max(0, Math.min(worked, slices.totalMs)),
    progress: Math.min(1, Math.max(0, worked / total)),
    nextEvent,
    isTodayWork: true,
    kindLabel: dk.isMakeup ? "调休上班日 · 加油" : "今天是个打工好日子",
  };
}

/* ---------- 周末 / 周五 / 发薪日 / 盼头 ---------- */
/** 下一个周末开始时刻（按 "weekendStart" 时间，默认周五下班时间） */
export function nextWeekendStart(now: number, _schedule: DaySchedule, weekendStartDay: number, weekendStartTime: string): number {
  void _schedule;
  const d = new Date(now);
  for (let i = 0; i < 8; i++) {
    const cand = shiftDay(d, i);
    const dow = cand.getDay();
    if (dow !== weekendStartDay) continue;
    const t = atTime(cand, weekendStartTime);
    if (t > now) return t;
    // 若当天该时间已过，则顺延到下周
    if (i === 0 && t <= now) continue;
  }
  return now + 7 * DAY;
}
/** 周末进行中：下一个工作开始时间 */
export function nextWorkStart(now: number, workweek: number[], schedule: DaySchedule): number {
  void schedule;
  const d = new Date(now);
  for (let i = 1; i <= 14; i++) {
    const cand = shiftDay(d, i);
    const dk = dayKind(cand.getTime(), workweek);
    if (dk.kind === "work") return atTime(cand, schedule.start);
  }
  return now + DAY;
}

/** 距下次发薪日 */
export function nextPaydayMs(now: number, day: number, hour = 0, minute = 0): number {
  const d = new Date(now);
  for (let i = 0; i < 40; i++) {
    const cand = shiftDay(d, i);
    const c = new Date(cand);
    c.setHours(hour, minute, 0, 0);
    if (c.getDate() === day && c.getTime() > now) return c.getTime();
  }
  return now + 30 * DAY;
}

const WEEK_CN = "日一二三四五六";
export function dayLabel(now: number): string {
  const d = new Date(now);
  return `${d.getMonth() + 1}月${d.getDate()}日 · 周${WEEK_CN[d.getDay()]}`;
}
