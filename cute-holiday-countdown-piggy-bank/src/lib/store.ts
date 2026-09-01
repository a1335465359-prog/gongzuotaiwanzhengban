import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  calcWage,
  type WageMode,
  workMsBetween,
  atTime,
  startOfDay,
  todayStatus,
  nextWeekendStart,
  nextWorkStart,
  nextPaydayMs,
  parseHM,
} from "./time";
import { dayKey, dayKind } from "./holidays";

export interface Settings {
  onboardingDone: boolean;
  theme: "light" | "dark" | "auto";
  // 工资
  mode: WageMode;
  wage: number;
  // 工作时间
  workweek: number[]; // 0=周日,1=周一...
  start: string;
  end: string;
  lunchEnabled: boolean;
  lunchStart: string;
  lunchEnd: string;
  monthlyWorkdays: number;
  // 周末 / 发薪
  weekendStartDay: number; // 默认周五=5
  weekendStartTime: string;
  paydayDay: number; // 每月几号
  paydayTime: string;
  // 偏好
  sound: boolean;
  haptic: boolean;
  // 自定义盼头
  events: CustomEvent[];
  // 想买的东西（"今天买得起什么"）
  wishGoods: WishGood[];
  // 目标
  goalName: string;
  goalAmount: number;
}

export interface CustomEvent {
  id: string;
  name: string;
  emoji: string;
  date: string; // YYYY-MM-DD
}

export interface WishGood {
  id: string;
  name: string;
  emoji: string;
  price: number;
}

export interface FishSession {
  id: string;
  start: number;
  end: number;
  earned: number;
}

export interface DayRecord {
  day: string; // YYYY-MM-DD
  earned: number;
  workMs: number;
  collected: boolean; // 是否已全部敲入罐
}

export interface WalletState {
  /** 罐内余额（已敲入、已收集） */
  pot: number;
  /** 小银行（周末/结算时转入） */
  bank: number;
  /** 累计总收入（统计用） */
  lifetimeEarned: number;
  /** 待领取的漂浮金币（需要用户敲罐收集） */
  pending: number;
  /** 上次心跳时间 */
  lastTick: number;
  /** 今日已入账（含已收集 + 待领取） */
  todayEarned: number;
  /** 今日已收集入罐 */
  todayCollected: number;
  /** 今日开始的累积毫秒（仅用来估算今日已工作） */
  todayWorkedMs: number;
  /** 今日日期键 */
  todayKey: string;
  /** 摸鱼会话 */
  fishing: FishSession | null;
  /** 累计摸鱼条数 */
  fishSessions: FishSession[];
  /** 历史 */
  history: Record<string, DayRecord>;
  /** 本周已结算周末标记 */
  weekSettledKey: string | null;
  /** 累计敲罐次数 */
  totalTaps: number;
}

export interface Events {
  onCollect?: (amount: number) => void;
  onWeekendSettle?: (amount: number) => void;
  onToast?: (text: string, emoji: string) => void;
  onPayday?: (amount: number) => void;
}

export const DEFAULT_WEEK_GOODS: WishGood[] = [
  { id: "g1", name: "蜜雪冰城甜筒", emoji: "🍦", price: 3 },
  { id: "g2", name: "一杯瑞幸", emoji: "☕", price: 18 },
  { id: "g3", name: "麦当劳套餐", emoji: "🍔", price: 38 },
  { id: "g4", name: "奶茶", emoji: "🧋", price: 22 },
  { id: "g5", name: "电影票", emoji: "🎬", price: 50 },
  { id: "g6", name: "一份小龙虾", emoji: "🦞", price: 128 },
  { id: "g7", name: "AirPods", emoji: "🎧", price: 1299 },
  { id: "g8", name: "Switch 卡带", emoji: "🎮", price: 299 },
];

export const DEFAULT_SETTINGS: Settings = {
  onboardingDone: false,
  theme: "light",
  mode: "monthly",
  wage: 15000,
  workweek: [1, 2, 3, 4, 5],
  start: "09:00",
  end: "18:00",
  lunchEnabled: true,
  lunchStart: "12:00",
  lunchEnd: "13:00",
  monthlyWorkdays: 21.75,
  weekendStartDay: 5,
  weekendStartTime: "18:00",
  paydayDay: 10,
  paydayTime: "10:00",
  sound: true,
  haptic: true,
  events: [],
  wishGoods: DEFAULT_WEEK_GOODS,
  goalName: "一台 Switch 2",
  goalAmount: 2999,
};

const S_KEY = "treasury.settings.v2";
const W_KEY = "treasury.wallet.v2";

function loadJSON<T>(key: string, def: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return def;
    return { ...(def as object), ...(JSON.parse(raw) as object) } as T;
  } catch {
    return def;
  }
}
const save = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

function freshWallet(): WalletState {
  const n = Date.now();
  return {
    pot: 0,
    bank: 0,
    lifetimeEarned: 0,
    pending: 0,
    lastTick: n,
    todayEarned: 0,
    todayCollected: 0,
    todayWorkedMs: 0,
    todayKey: dayKey(n),
    fishing: null,
    fishSessions: [],
    history: {},
    weekSettledKey: null,
    totalTaps: 0,
  };
}

export interface Derived {
  breakdown: ReturnType<typeof calcWage>;
  today: ReturnType<typeof todayStatus>;
  weekendMs: number;
  weekendInProgress: boolean;
  nextWorkMs: number;
  paydayMs: number;
  // 今日应得（根据真实时间）
  earnedTodayTotal: number; // = 已入(收集+待领)
  dailyGoal: number;
  potPercent: number; // 罐填充比（0-1，基于今日目标的 60% 做视觉效果）
}

/** 给 App 的 hook */
export function useTreasury(events: Events = {}) {
  const [settings, setSettings] = useState<Settings>(() => loadJSON(S_KEY, DEFAULT_SETTINGS));
  const [wallet, setWallet] = useState<WalletState>(() => loadJSON(W_KEY, freshWallet()));
  const [now, setNow] = useState(() => Date.now());

  const sRef = useRef(settings);
  const wRef = useRef(wallet);
  const evRef = useRef(events);
  sRef.current = settings;
  wRef.current = wallet;
  evRef.current = events;

  /* 持久化 */
  useEffect(() => save(S_KEY, settings), [settings]);
  useEffect(() => {
    const t = window.setTimeout(() => save(W_KEY, wallet), 250);
    return () => window.clearTimeout(t);
  }, [wallet]);

  /* 心跳：每 500ms 推进时间，UI 层每秒 setNow 即可 */
  useEffect(() => {
    const tick = (prev: WalletState, tNow: number): WalletState => {
      const s = sRef.current;
      const schedule = {
        start: s.start,
        end: s.end,
        lunchStart: s.lunchEnabled ? s.lunchStart : undefined,
        lunchEnd: s.lunchEnabled ? s.lunchEnd : undefined,
      };
      const breakdown = calcWage(
        s.mode,
        s.wage,
        Math.max(0, parseHM(s.end).h * 60 + parseHM(s.end).m - (parseHM(s.start).h * 60 + parseHM(s.start).m) - (s.lunchEnabled ? 60 : 0)),
        s.monthlyWorkdays
      );

      let next = { ...prev };
      const newDay = dayKey(tNow) !== prev.todayKey;
      if (newDay) {
        // 昨日落库
        const yKey = prev.todayKey;
        if (yKey && prev.todayEarned > 0) {
          const yRec = prev.history[yKey] ?? { day: yKey, earned: 0, workMs: 0, collected: false };
          next.history = {
            ...prev.history,
            [yKey]: { ...yRec, earned: prev.todayEarned, workMs: prev.todayWorkedMs, collected: prev.pending <= 0.005 },
          };
        }
        next.todayKey = dayKey(tNow);
        next.todayEarned = 0;
        next.todayCollected = 0;
        next.todayWorkedMs = 0;
      }

      // 工作毫秒累积（从 lastTick 到 now）
      const wm = workMsBetween(prev.lastTick, tNow, s.workweek, schedule, 14);
      const dk = dayKind(tNow, s.workweek);
      const isWorkDay = dk.kind === "work";
      if (wm > 0) {
        const earned = (breakdown.hourly / 3600000) * wm;
        next.pending += earned;
        next.lifetimeEarned += earned;
        next.todayEarned += earned;
        next.todayWorkedMs += wm;
      }
      // 摸鱼中：同时算"摸鱼也赚了"（展示用，不重复加到总收入）
      if (next.fishing) {
        const fwm = Math.min(wm, Math.max(0, tNow - next.fishing.start));
        // 只是更新一下 end，earned 结算时再算
        next.fishing = { ...next.fishing, end: tNow };
        void fwm;
      }

      next.lastTick = tNow;

      // 周末开始自动结算本周罐内 → 小银行
      if (!isWorkDay && prev.weekSettledKey !== next.todayKey && next.pot > 0.01) {
        const ts = atTime(tNow, s.weekendStartTime);
        const todayDow = new Date(tNow).getDay();
        const weekendStartToday = todayDow === s.weekendStartDay && tNow >= ts;
        const pastWeekend = todayDow !== s.weekendStartDay;
        if (weekendStartToday || pastWeekend) {
          const settled = next.pot;
          next.bank += settled;
          next.pot = 0;
          next.weekSettledKey = next.todayKey;
          window.setTimeout(() => evRef.current.onWeekendSettle?.(settled), 0);
        }
      }

      // 发薪日到点：弹 toast 庆祝
      const pdToday = new Date(tNow).getDate() === s.paydayDay;
      if (pdToday) {
        const hit = atTime(tNow, s.paydayTime);
        if (tNow >= hit && tNow - hit < 6000) {
          window.setTimeout(() => evRef.current.onPayday?.(next.bank), 0);
        }
      }

      void startOfDay;
      return next;
    };

    // 初次进来如果 pending 还没对齐 todayEarned，先 tick 一次
    setWallet((w) => {
      return tick(w, Date.now());
    });

    const id = window.setInterval(() => {
      const tnow = Date.now();
      setNow(tnow);
      setWallet((w) => tick(w, tnow));
    }, 500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- 派生 ---------- */
  const breakdown = useMemo(() => {
    const workMin =
      parseHM(settings.end).h * 60 +
      parseHM(settings.end).m -
      (parseHM(settings.start).h * 60 + parseHM(settings.start).m) -
      (settings.lunchEnabled ? 60 : 0);
    return calcWage(settings.mode, settings.wage, Math.max(0, workMin), settings.monthlyWorkdays);
  }, [settings]);

  const schedule = useMemo(
    () => ({
      start: settings.start,
      end: settings.end,
      lunchStart: settings.lunchEnabled ? settings.lunchStart : undefined,
      lunchEnd: settings.lunchEnabled ? settings.lunchEnd : undefined,
    }),
    [settings]
  );

  const today = useMemo(() => todayStatus(now, settings.workweek, schedule), [now, settings.workweek, schedule]);

  const weekendStart = useMemo(
    () => nextWeekendStart(now, schedule, settings.weekendStartDay, settings.weekendStartTime),
    [now, schedule, settings.weekendStartDay, settings.weekendStartTime]
  );
  const dk = dayKind(now, settings.workweek);
  const weekendInProgress = dk.kind !== "work" && new Date(now).getDay() >= settings.weekendStartDay;
  const nextWorkMs = useMemo(() => nextWorkStart(now, settings.workweek, schedule) - now, [now, settings.workweek, schedule]);
  const paydayMs = useMemo(() => nextPaydayMs(now, settings.paydayDay), [now, settings.paydayDay]);

  const derived: Derived = {
    breakdown,
    today,
    weekendMs: weekendInProgress ? 0 : weekendStart - now,
    weekendInProgress,
    nextWorkMs,
    paydayMs,
    earnedTodayTotal: wallet.todayEarned,
    dailyGoal: breakdown.daily,
    potPercent: Math.min(1, wallet.pot / Math.max(50, breakdown.daily * 0.8)),
  };

  /* ---------- 操作 ---------- */
  const collect = useCallback((raw?: number): number => {
    // 敲罐：收集 min(pending, raw) 的金额到 pot
    const w = wRef.current;
    if (w.pending <= 0.0001) {
      evRef.current.onToast?.("金币还在路上~再等等", "⏳");
      return 0;
    }
    const amount = raw ? Math.min(raw, w.pending) : Math.min(w.pending, Math.max(0.01, derived.breakdown.perMin * 0.8));
    setWallet((p) => {
      const take = Math.min(p.pending, amount);
      return {
        ...p,
        pending: p.pending - take,
        pot: p.pot + take,
        todayCollected: p.todayCollected + take,
        totalTaps: p.totalTaps + 1,
      };
    });
    evRef.current.onCollect?.(amount);
    return amount;
  }, [derived.breakdown.perMin]);

  const collectAll = useCallback((): number => {
    const w = wRef.current;
    if (w.pending < 0.005) {
      evRef.current.onToast?.("暂时没有待领金币啦", "✨");
      return 0;
    }
    const amount = w.pending;
    setWallet((p) => ({
      ...p,
      pending: 0,
      pot: p.pot + amount,
      todayCollected: p.todayCollected + amount,
      totalTaps: p.totalTaps + 1,
    }));
    evRef.current.onCollect?.(amount);
    return amount;
  }, []);

  const startFishing = useCallback(() => {
    const n = Date.now();
    setWallet((p) => {
      if (p.fishing) return p;
      return {
        ...p,
        fishing: { id: `f${n}`, start: n, end: n, earned: 0 },
      };
    });
  }, []);

  const stopFishing = useCallback(() => {
    setWallet((p) => {
      if (!p.fishing) return p;
      const bd = calcWage(
        sRef.current.mode,
        sRef.current.wage,
        Math.max(
          0,
          parseHM(sRef.current.end).h * 60 +
            parseHM(sRef.current.end).m -
            (parseHM(sRef.current.start).h * 60 + parseHM(sRef.current.start).m) -
            (sRef.current.lunchEnabled ? 60 : 0)
        ),
        sRef.current.monthlyWorkdays
      );
      // 只在工作时间内真实摸鱼才有"摸鱼也赚"的乐趣
      const real = workMsBetween(p.fishing.start, p.fishing.end, sRef.current.workweek, schedule, 2);
      const earned = (bd.hourly / 3600000) * Math.max(real, p.fishing.end - p.fishing.start);
      const fs = p.fishSessions ?? [];
      return {
        ...p,
        fishing: null,
        fishSessions: [{ ...p.fishing, earned, end: p.fishing.end }, ...fs].slice(0, 50),
      };
    });
  }, [schedule]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const finishOnboarding = useCallback(() => {
    setSettings((s) => ({ ...s, onboardingDone: true }));
  }, []);

  const resetAll = useCallback(() => {
    setWallet(freshWallet());
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.removeItem(W_KEY);
      localStorage.removeItem(S_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const addEvent = useCallback((e: Omit<CustomEvent, "id">) => {
    setSettings((s) => ({ ...s, events: [...s.events, { ...e, id: `e${Date.now()}` }] }));
  }, []);
  const removeEvent = useCallback((id: string) => {
    setSettings((s) => ({ ...s, events: s.events.filter((x) => x.id !== id) }));
  }, []);

  return {
    settings,
    updateSettings,
    wallet,
    now,
    derived,
    collect,
    collectAll,
    startFishing,
    stopFishing,
    finishOnboarding,
    resetAll,
    addEvent,
    removeEvent,
    // 便捷
    isWorkDay: today.isTodayWork,
    phase: today.phase,
  };
}

export { workMsBetween };
