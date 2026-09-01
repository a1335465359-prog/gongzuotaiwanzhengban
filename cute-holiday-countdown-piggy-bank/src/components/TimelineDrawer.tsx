import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import Drawer from "./Drawer";
import type { FutureEvent } from "../lib/useClock";
import type { Settings, CustomEvent } from "../lib/store";
import {
  CN_2026,
  dayKey,
  dayKind,
  fmtDay,
  parseDay,
  upcomingHolidays,
  type Holiday,
} from "../lib/holidays";
import { DAY } from "../lib/time";

interface Props {
  open: boolean;
  onClose: () => void;
  events: FutureEvent[];
  now: number;
  settings: Settings;
  onAddEvent: (event: CustomEvent) => void;
  onRemoveEvent: (id: string) => void;
}

interface VacationFocus {
  name: string;
  emoji: string;
  startMs: number;
  endMs: number;
  holiday?: Holiday;
  state: "upcoming" | "active";
}

type PathKind = FutureEvent["kind"] | "makeup" | "last-workday" | "active-holiday";

interface PathNode {
  id: string;
  kind: PathKind;
  name: string;
  emoji?: string;
  targetMs: number;
  days: number;
  isFocus: boolean;
  customId?: string;
}

const reveal = (delay: number) => ({
  initial: { opacity: 0, y: 7 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32, delay, ease: [0.2, 0.75, 0.25, 1] as const },
});

export default function TimelineDrawer({
  open,
  onClose,
  events,
  now,
  settings,
  onAddEvent,
  onRemoveEvent,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [emoji, setEmoji] = useState("✨");

  const vacation = useMemo(() => getVacationFocus(now, events, settings), [events, now, settings]);
  const progress = useMemo(() => getWaitingProgress(now, vacation), [now, vacation]);
  const path = useMemo(
    () => buildWaitingPath(now, events, vacation, settings),
    [events, now, settings, vacation],
  );

  const handleAdd = () => {
    if (!name.trim() || !date) return;
    onAddEvent({ id: `e-${Date.now()}`, name: name.trim(), date, emoji: emoji || "✨" });
    setName("");
    setDate("");
    setEmoji("✨");
    setAdding(false);
  };

  return (
    <Drawer open={open} onClose={onClose} heightPct={91} title="放假倒计时">
      <div className="px-5 pb-24">
        <motion.section
          {...reveal(0.05)}
          className="ticket-edge relative overflow-hidden rounded-[22px] px-5 pb-5 pt-6"
          style={{ background: "var(--bg)", border: "1px solid var(--line)", boxShadow: "var(--shadow-soft)" }}
          aria-live="polite"
        >
          <OpeningPaperBits />
          <div
            className="absolute right-4 top-4 rotate-[7deg] rounded-full px-2.5 py-1 text-[9px] tracking-[0.2em]"
            style={{ color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 48%, transparent)" }}
          >
            准予休息
          </div>

          <motion.div {...reveal(0.1)} className="text-[10px] tracking-[0.28em]" style={{ color: "var(--ink-3)" }}>
            NEXT DEPARTURE
          </motion.div>
          <motion.div {...reveal(0.16)} className="mt-5 flex items-end gap-3 pr-20">
            <span className="text-[28px] leading-none" aria-hidden="true">{vacation.emoji}</span>
            <div>
              <div className="text-[20px] leading-tight" style={{ color: "var(--ink)", fontWeight: 520 }}>{vacation.name}</div>
              <div className="mt-1 text-[11px]" style={{ color: "var(--ink-2)" }}>
                {fmtFullDate(vacation.startMs)} 启程
              </div>
            </div>
          </motion.div>

          <div className="my-5 border-t border-dashed" style={{ borderColor: "var(--line)" }} />

          <motion.div {...reveal(0.22)} className="text-center">
            {vacation.state === "active" ? (
              <>
                <div className="text-[12px] tracking-[0.16em]" style={{ color: "var(--accent)" }}>假期开始了</div>
                <div className="num-heavy mt-2 text-[64px] leading-none" style={{ color: "var(--ink)" }}>
                  第 {activeDayNumber(now, vacation)} 天
                </div>
                <div className="num mt-3 text-[12px]" style={{ color: "var(--ink-2)" }}>
                  还有 {formatDuration(vacation.endMs - now)} 结束
                </div>
              </>
            ) : (
              <>
                <div className="text-[12px]" style={{ color: "var(--ink-2)" }}>
                  距离「{vacation.name}」还有
                </div>
                <div className="num-heavy mt-1 text-[76px] leading-none" style={{ color: "var(--ink)" }}>
                  D-{Math.max(1, Math.ceil((vacation.startMs - now) / DAY))}
                </div>
                <div className="num mt-3 text-[12px]" style={{ color: "var(--ink-2)" }}>
                  {formatDuration(vacation.startMs - now)}
                </div>
              </>
            )}
          </motion.div>

          <motion.div {...reveal(0.28)} className="mt-7">
            <div className="flex items-center justify-between text-[10px]" style={{ color: "var(--ink-3)" }}>
              <span>{progress.startLabel}</span>
              <span>{progress.endLabel}</span>
            </div>
            <div className="relative mt-2 h-[5px] overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress.ratio * 100}%` }}
                transition={{ duration: 0.7, delay: 0.3, ease: [0.2, 0.75, 0.25, 1] }}
                className="h-full rounded-full"
                style={{ background: "var(--accent)" }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]" style={{ color: "var(--ink-2)" }}>
              <span>已走 {progress.elapsedDays} 天</span>
              <span>还剩 {progress.remainingDays} 天</span>
            </div>
          </motion.div>
        </motion.section>

        <motion.section {...reveal(0.34)} className="px-1 pb-2 pt-8">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <div className="text-[15px]" style={{ color: "var(--ink)", fontWeight: 520 }}>等待路径</div>
              <div className="mt-1 text-[11px]" style={{ color: "var(--ink-3)" }}>从此刻，一站一站走到放假</div>
            </div>
            <div className="text-[10px]" style={{ color: "var(--ink-3)" }}>TODAY → HOLIDAY</div>
          </div>

          <div className="relative pl-2">
            <div className="absolute bottom-5 left-[15px] top-3 w-px" style={{ background: "var(--line)" }} />
            <div className="relative mb-4 flex items-center">
              <span className="relative z-10 h-[15px] w-[15px] rounded-full border-[4px]" style={{ background: "var(--accent)", borderColor: "var(--surface-1)" }} />
              <div className="ml-5 flex flex-1 items-baseline justify-between">
                <span className="text-[13px]" style={{ color: "var(--ink)" }}>此刻</span>
                <span className="num text-[10px]" style={{ color: "var(--ink-3)" }}>{fmtShortDate(now)}</span>
              </div>
            </div>

            {path.map((node, index) => {
              const distanceFade = Math.max(0.36, 1 - Math.min(node.days, 180) / 240);
              return (
                <motion.div
                  key={node.id}
                  initial={{ opacity: 0, x: -7 }}
                  animate={{ opacity: distanceFade, x: 0 }}
                  transition={{ duration: 0.28, delay: 0.38 + Math.min(index, 8) * 0.035 }}
                  className="relative flex min-h-[58px] items-start"
                >
                  <span
                    className="relative z-10 mt-1.5 flex h-[15px] w-[15px] items-center justify-center rounded-full"
                    style={{
                      background: node.isFocus ? "var(--accent)" : "var(--surface-1)",
                      border: `1px solid ${node.isFocus ? "var(--accent)" : "var(--ink-3)"}`,
                      boxShadow: "0 0 0 4px var(--surface-1)",
                    }}
                  >
                    {node.isFocus && <span className="h-[3px] w-[3px] rounded-full" style={{ background: "var(--surface-1)" }} />}
                  </span>
                  <div className="ml-5 min-w-0 flex-1 pb-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 truncate text-[13px]" style={{ color: node.isFocus ? "var(--ink)" : "var(--ink-2)", fontWeight: node.isFocus ? 560 : 400 }}>
                        <span className="mr-2" aria-hidden="true">{node.emoji ?? pathIcon(node.kind)}</span>
                        {node.name}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="num text-[12px]" style={{ color: node.isFocus ? "var(--accent)" : "var(--ink-2)" }}>
                          {node.days === 0 ? "今天" : `${node.days} 天`}
                        </div>
                        <div className="num mt-0.5 text-[9px]" style={{ color: "var(--ink-3)" }}>{fmtShortDate(node.targetMs)}</div>
                      </div>
                    </div>
                  </div>
                  {node.customId && (
                    <button
                      onClick={() => onRemoveEvent(node.customId!)}
                      className="ml-2 mt-0.5 h-7 w-7 shrink-0 text-[16px]"
                      style={{ color: "var(--ink-3)", background: "transparent", border: "none" }}
                      aria-label={`删除 ${node.name}`}
                    >
                      ×
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        <section className="mt-4 rounded-[20px] px-4 py-5" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
          <div className="text-[15px]" style={{ color: "var(--ink)", fontWeight: 520 }}>假期想做什么</div>
          <div className="mt-1 text-[11px]" style={{ color: "var(--ink-3)" }}>
            {settings.events.length > 0 ? "已经写下的期待，会出现在对应日期的路径上" : "给这次放假留一件想做的小事"}
          </div>

          {adding ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3">
                <input type="text" value={emoji} onChange={event => setEmoji(event.target.value.slice(0, 2))} className="!w-12 text-center" placeholder="✨" />
                <input type="text" value={name} onChange={event => setName(event.target.value)} className="flex-1" placeholder="比如：去海边看一次日落" autoFocus />
              </div>
              <input type="date" value={date} onChange={event => setDate(event.target.value)} min={dayKey(now)} />
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setAdding(false); setName(""); setDate(""); }}
                  className="flex-1 rounded-full py-3 text-[13px]"
                  style={{ color: "var(--ink-2)", background: "transparent", border: "1px solid var(--line)" }}
                >
                  取消
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!name.trim() || !date}
                  className="flex-1 rounded-full py-3 text-[13px] disabled:opacity-35"
                  style={{ color: "var(--bg)", background: "var(--ink)", border: "none" }}
                >
                  写进期待
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="mt-4 w-full rounded-full py-3 text-[13px]"
              style={{ color: "var(--accent)", background: "transparent", border: "1px dashed var(--accent)" }}
            >
              + 添加一件期待
            </button>
          )}
        </section>
      </div>
    </Drawer>
  );
}

function getVacationFocus(now: number, events: FutureEvent[], settings: Settings): VacationFocus {
  const official = upcomingHolidays(now, 1)[0];
  if (official) {
    return {
      name: official.h.name,
      emoji: official.h.emoji,
      startMs: parseDay(official.h.start),
      endMs: parseDay(official.h.end) + DAY,
      holiday: official.h,
      state: official.state,
    };
  }

  const weekend = events.find(event => event.kind === "weekend");
  const startMs = weekend?.targetMs ?? startOfToday(now) + DAY;
  let endMs = startMs + DAY;
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = startOfToday(startMs) + offset * DAY;
    if (dayKind(candidate, settings.workweek).kind === "work") {
      endMs = candidate;
      break;
    }
  }
  return { name: "周末", emoji: "☁️", startMs, endMs, state: now >= startMs ? "active" : "upcoming" };
}

function getWaitingProgress(now: number, vacation: VacationFocus) {
  if (vacation.state === "active") {
    const elapsedDays = activeDayNumber(now, vacation);
    const remainingDays = Math.max(0, Math.ceil((vacation.endMs - now) / DAY));
    return {
      ratio: clamp((now - vacation.startMs) / (vacation.endMs - vacation.startMs)),
      startLabel: fmtShortDate(vacation.startMs),
      endLabel: fmtShortDate(vacation.endMs - 1),
      elapsedDays,
      remainingDays,
    };
  }

  const previous = CN_2026.holidays
    .filter(holiday => parseDay(holiday.end) < vacation.startMs)
    .at(-1);
  const waitStart = previous
    ? parseDay(previous.end) + DAY
    : new Date(CN_2026.year, 0, 1).getTime();
  return {
    ratio: clamp((now - waitStart) / Math.max(DAY, vacation.startMs - waitStart)),
    startLabel: previous ? "上次收假" : fmtShortDate(waitStart),
    endLabel: `${fmtShortDate(vacation.startMs)} 放假`,
    elapsedDays: Math.max(0, Math.floor((startOfToday(now) - waitStart) / DAY)),
    remainingDays: Math.max(0, Math.ceil((vacation.startMs - now) / DAY)),
  };
}

function buildWaitingPath(now: number, events: FutureEvent[], vacation: VacationFocus, settings: Settings): PathNode[] {
  const nodes: PathNode[] = events
    .filter(event => event.targetMs >= now && event.kind !== "offwork")
    .map(event => ({
      id: event.id,
      kind: event.kind,
      name: event.kind === "weekend" ? "本周末" : event.name,
      emoji: event.emoji,
      targetMs: event.targetMs,
      days: Math.max(0, Math.ceil((event.targetMs - now) / DAY)),
      isFocus: event.kind === "holiday" && sameDay(event.targetMs, vacation.startMs),
      customId: event.kind === "custom" ? event.id.replace(/^c-/, "") : undefined,
    }));

  const pathEnd = vacation.state === "upcoming" ? vacation.startMs : vacation.endMs;
  for (const workday of CN_2026.workdays) {
    const targetMs = parseDay(workday);
    if (targetMs > now && targetMs < pathEnd) {
      nodes.push({
        id: `makeup-${workday}`,
        kind: "makeup",
        name: "调休上班",
        emoji: "↺",
        targetMs,
        days: Math.ceil((targetMs - now) / DAY),
        isFocus: false,
      });
    }
  }

  if (vacation.state === "upcoming") {
    let candidate = startOfToday(vacation.startMs) - DAY;
    for (let attempts = 0; attempts < 14; attempts += 1) {
      if (dayKind(candidate, settings.workweek).kind === "work") {
        nodes.push({
          id: `last-work-${dayKey(candidate)}`,
          kind: "last-workday",
          name: "节前最后一个工作日",
          emoji: "✓",
          targetMs: candidate,
          days: Math.max(0, Math.ceil((candidate - now) / DAY)),
          isFocus: false,
        });
        break;
      }
      candidate -= DAY;
    }
  } else {
    nodes.unshift({
      id: `active-${vacation.name}`,
      kind: "active-holiday",
      name: `${vacation.name}进行中`,
      emoji: vacation.emoji,
      targetMs: now,
      days: 0,
      isFocus: true,
    });
  }

  const deduped = new Map<string, PathNode>();
  nodes.forEach(node => deduped.set(node.id, node));
  return [...deduped.values()].sort((a, b) => a.targetMs - b.targetMs);
}

function OpeningPaperBits() {
  const bits = [
    { x: "18%", y: 18, delay: 0.06 },
    { x: "43%", y: 10, delay: 0.11 },
    { x: "71%", y: 22, delay: 0.16 },
    { x: "86%", y: 42, delay: 0.2 },
  ];
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-20 overflow-hidden" aria-hidden="true">
      {bits.map((bit, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0, y: -8, rotate: 0 }}
          animate={{ opacity: [0, 0.75, 0], y: bit.y, rotate: index % 2 ? 35 : -30 }}
          transition={{ duration: 0.75, delay: bit.delay, ease: "easeOut" }}
          className="absolute h-1 w-1 rounded-full"
          style={{ left: bit.x, background: index === 2 ? "var(--gold)" : "var(--accent)" }}
        />
      ))}
    </div>
  );
}

function pathIcon(kind: PathKind) {
  if (kind === "weekend") return "☁";
  if (kind === "holiday" || kind === "active-holiday") return "✦";
  if (kind === "payday") return "¥";
  if (kind === "custom") return "·";
  if (kind === "makeup") return "↺";
  if (kind === "last-workday") return "✓";
  return "↗";
}

function activeDayNumber(now: number, vacation: VacationFocus) {
  return Math.max(1, Math.floor((startOfToday(now) - startOfToday(vacation.startMs)) / DAY) + 1);
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days} 天 ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function fmtFullDate(ms: number) {
  const date = new Date(ms);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 · 周${weekdays[date.getDay()]}`;
}

function fmtShortDate(ms: number) {
  const date = new Date(ms);
  return fmtDay(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`);
}

function sameDay(a: number, b: number) {
  return dayKey(a) === dayKey(b);
}

function startOfToday(ms: number) {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
