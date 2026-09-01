import { useEffect, useState, useCallback } from "react";
import type { Settings, CustomEvent } from "./store";
import { DEFAULT_SETTINGS } from "./store";

/**
 * 精简全局状态 —— 只保存"用户设置 + 今晚便签 + 累计敲罐次数"
 * 工资/时间/收入永远从 useClock 现算，不持久化中间态
 */

export interface AppState {
  /** 今晚便签内容 */
  tonight: string;
  /** 今晚便签所属日期 */
  tonightDate: string;
  /** 累计敲罐次数（陪伴感） */
  taps: number;
  /** 累计收进罐子的金额（真实基于工资，只在 tap 时递增） */
  potTotal: number;
}

const S_KEY = "xjk.settings.v3";
const A_KEY = "xjk.state.v3";
const THEME_ATTR = "data-theme";

function loadJSON<T>(key: string, def: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return def;
    return { ...(def as object), ...(JSON.parse(raw) as object) } as T;
  } catch {
    return def;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch { /* ignore */ }
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DEFAULT_STATE: AppState = {
  tonight: "",
  tonightDate: "",
  taps: 0,
  potTotal: 0,
};

export function useApp() {
  const [settings, setSettingsRaw] = useState<Settings>(() =>
    loadJSON(S_KEY, DEFAULT_SETTINGS)
  );
  const [state, setStateRaw] = useState<AppState>(() =>
    loadJSON(A_KEY, DEFAULT_STATE)
  );

  /* 每日归档今晚便签 */
  useEffect(() => {
    const key = todayKey();
    if (state.tonightDate !== key && state.tonight) {
      setStateRaw(s => ({ ...s, tonight: "", tonightDate: key }));
    } else if (!state.tonightDate) {
      setStateRaw(s => ({ ...s, tonightDate: key }));
    }
  }, [state.tonight, state.tonightDate]);

  /* 主题：应用到 :root[data-theme] */
  useEffect(() => {
    const applyTheme = () => {
      const isDark =
        settings.theme === "dark" ||
        (settings.theme === "auto" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.setAttribute(THEME_ATTR, isDark ? "dark" : "light");
    };
    applyTheme();
    if (settings.theme === "auto") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", applyTheme);
      return () => mq.removeEventListener("change", applyTheme);
    }
  }, [settings.theme]);

  /* 持久化 */
  useEffect(() => save(S_KEY, settings), [settings]);
  useEffect(() => save(A_KEY, state), [state]);

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsRaw(s => ({ ...s, ...patch }));
  }, []);

  const setTonight = useCallback((v: string) => {
    setStateRaw(s => ({ ...s, tonight: v, tonightDate: todayKey() }));
  }, []);

  const bumpTap = useCallback((amount: number) => {
    setStateRaw(s => ({ ...s, taps: s.taps + 1, potTotal: s.potTotal + amount }));
  }, []);

  const addEvent = useCallback((e: CustomEvent) => {
    setSettingsRaw(s => ({ ...s, events: [...s.events, e] }));
  }, []);

  const removeEvent = useCallback((id: string) => {
    setSettingsRaw(s => ({ ...s, events: s.events.filter(e => e.id !== id) }));
  }, []);

  const resetAll = useCallback(() => {
    localStorage.removeItem(S_KEY);
    localStorage.removeItem(A_KEY);
    setSettingsRaw({ ...DEFAULT_SETTINGS, onboardingDone: false });
    setStateRaw(DEFAULT_STATE);
  }, []);

  return {
    settings,
    setSettings,
    state,
    setTonight,
    bumpTap,
    addEvent,
    removeEvent,
    resetAll,
  };
}
