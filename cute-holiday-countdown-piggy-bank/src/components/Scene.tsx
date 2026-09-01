import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Pig, { PigHandle } from "./Pig";
import TonightNote from "./TonightNote";
import TimelineDrawer from "./TimelineDrawer";
import TreasuryDrawer from "./TreasuryDrawer";
import SettingsDrawer from "./SettingsDrawer";
import { useApp } from "../lib/useApp";
import { useClock, Clock } from "../lib/useClock";
import { useCoinDriver } from "../lib/useCoinDriver";
import { fmtMoney } from "../lib/time";

/**
 * 主场景 —— 一个安静、但有生命感的时间空间
 *
 * 首页必须同时表达三件事：
 *   1. 时间正在减少（倒计时）→ 前景
 *   2. 收入正在增加（今日已赚）→ 中景，与猪一体
 *   3. 储蓄目标正在推进（进度）→ 底部极弱
 *
 * 三态：
 *   working  工作中  收入增长 / 金币入槽 / 倒计时
 *   off    已下班  收入定格 / 猪休息 / 距明日上班
 *   rest    休息日  收入不增 / 猪更静 / 距下个工作日
 */
export default function Scene() {
  const {
    settings, setSettings, state,
    setTonight, bumpTap, addEvent, removeEvent, resetAll,
  } = useApp();
  const clock = useClock(settings, 1000);

  const [openTimeline, setOpenTimeline] = useState(false);
  const [openTreasury, setOpenTreasury] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [greetVisible, setGreetVisible] = useState(true);
  const [lastCoin, setLastCoin] = useState(0);

  const pigRef = useRef<PigHandle>(null);
  const prevPhase = useRef(clock.phase);

  const isWorking = clock.phase === "morning" || clock.phase === "afternoon" || clock.phase === "lunch";
  const isOff = clock.phase === "after";
  const isRest = clock.phase === "holiday" || clock.phase === "weekend" || clock.phase === "dayoff";

  /* 下班瞬间：off 庆祝动画 */
  useEffect(() => {
    const p = prevPhase.current;
    if ((p === "morning" || p === "afternoon" || p === "lunch") && clock.phase === "after") {
      pigRef.current?.play("off");
    }
    prevPhase.current = clock.phase;
  }, [clock.phase]);

  /* 收入 → 金币入槽（仅工作中） */
  const coinCount = useCoinDriver(clock.todayEarned, clock.rate.hourly, isWorking);
  useEffect(() => {
    if (coinCount > lastCoin) {
      setLastCoin(coinCount);
      pigRef.current?.play("coin");
    }
  }, [coinCount, lastCoin]);

  /* 临近下班触发"看时间"（最后 2 小时内的某刻） */
  const lookTriggered = useRef(false);
  useEffect(() => {
    if (isWorking && clock.toOffWork !== null && clock.toOffWork < 2 * 3600000 && !lookTriggered.current) {
      lookTriggered.current = true;
      pigRef.current?.play("look");
    }
  }, [isWorking, clock.toOffWork]);

  /* 问候语淡出 */
  useEffect(() => {
    const t = setTimeout(() => setGreetVisible(false), 4500);
    return () => clearTimeout(t);
  }, []);

  /* ---- 储蓄目标进度 ---- */
  const goalAmount = settings.goalAmount || 0;
  const saved = state.potTotal;
  const goalProgress = goalAmount > 0 ? Math.min(1, saved / goalAmount) : 0;

  const main = renderMainCountdown(clock);
  const farEvents = clock.events.filter(e => e.kind !== "offwork").slice(0, 3);
  const greeting = greetingText(clock.now);

  const restingPig = isOff || isRest;

  return (
    <div className="relative h-dvh w-full overflow-hidden" style={{ background: "var(--bg)" }}>

      {/* ============ 顶栏 ============ */}
      <div className="safe-top absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 pt-3">
        <div className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
          {clock.dateLabel}
        </div>
        <button
          onClick={() => setOpenSettings(true)}
          aria-label="设置"
          className="px-2 py-1 text-[15px]"
          style={{ color: "var(--ink-3)", background: "transparent", border: "none", cursor: "pointer", letterSpacing: "0.25em", lineHeight: 1 }}
        >
          ···
        </button>
      </div>

      {/* 问候语 */}
      <AnimatePresence>
        {greetVisible && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="safe-top absolute inset-x-0 top-0 z-10 pt-11 text-center"
          >
            <span className="text-[12px]" style={{ color: "var(--ink-3)" }}>{greeting}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 挂机模式 */}
      <AnimatePresence>
        {quiet && (
          <motion.button
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 z-40"
            style={{ background: "var(--bg)", border: "none", cursor: "pointer" }}
            onClick={() => setQuiet(false)}
            aria-label="退出挂机"
          >
            <div className="flex h-full flex-col items-center justify-center gap-14">
              <QuietCountdown clock={clock} />
              <Pig size={130} resting={restingPig} paused />
              <div className="text-[11px]" style={{ color: "var(--ink-4)" }}>点击唤醒</div>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ============ 主场景 ============ */}
      <div className="relative flex h-full flex-col justify-between px-6" style={{ paddingTop: 100, paddingBottom: 30 }}>

        {/* ---- 前景：倒计时（唯一重量级） ---- */}
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
          className="text-center"
        >
          <div className="text-[10.5px] tracking-[0.35em] mb-3.5" style={{ color: "var(--ink-3)" }}>
            {main.label}
          </div>
          <div className="num-heavy" style={{ fontSize: "clamp(52px, 15vw, 84px)", color: "var(--ink)", lineHeight: 0.95 }}>
            {main.value}
          </div>
          {/* 时间轨道（仅工作日） */}
          {clock.track && (
            <div className="mx-auto mt-10 max-w-[220px]">
              <TimeTrackInline
                startLabel={settings.start} endLabel={settings.end}
                ratio={clock.track.ratio} done={clock.phase === "after"}
              />
            </div>
          )}
        </motion.div>

        {/* ---- 中景：小猪 + 今日已赚 + 便签 ---- */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.3 }}
          className="flex flex-col items-center gap-4"
        >
          <Pig
            ref={pigRef}
            size={190}
            resting={restingPig}
            onTap={() => bumpTap(clock.rate.perSec * (3 + Math.random() * 5))}
            onLongPress={() => setOpenTreasury(true)}
          />

          {/* 今日已赚 —— 第二重要数字，随猪一体，点击展开小金库 */}
          <button
            onClick={() => setOpenTreasury(true)}
            className="group text-center"
            style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
          >
            <div className="text-[10.5px] tracking-[0.2em]" style={{ color: "var(--ink-3)" }}>
              今 日 已 赚
            </div>
            <div className="mt-1 flex items-baseline justify-center gap-1">
              <span className="text-[13px]" style={{ color: "var(--ink-2)" }}>¥</span>
              <span
                className="num-heavy leading-none"
                style={{
                  fontSize: "clamp(34px, 10vw, 52px)",
                  color: "var(--gold)",
                  transition: "transform .3s",
                }}
              >
                {formatIncome(clock.todayEarned)}
              </span>
            </div>
            {isWorking && (
              <div className="mt-1 text-[10.5px]" style={{ color: "var(--ink-4)" }}>
                每秒 +{clock.rate.perSec.toFixed(3)}
              </div>
            )}
          </button>

          <TodayGoalStrip
            name={settings.goalName}
            amount={goalAmount}
            saved={saved}
            progress={goalProgress}
            onClick={() => setOpenTreasury(true)}
          />

          <TonightNote value={state.tonight} onChange={setTonight} />
        </motion.div>

        {/* ---- 远景：未来事件 ---- */}
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.4, delay: 0.7 }}
          className="w-full space-y-2 text-center"
        >
          {farEvents.map((e, i) => {
            const op = Math.max(0.22, 0.85 - i * 0.28);
            const fs = Math.max(12, 15 - i);
            return (
              <button
                key={e.id}
                onClick={() => setOpenTimeline(true)}
                className="block w-full"
                style={{ background: "transparent", border: "none", padding: "1px 0", cursor: "pointer", opacity: op }}
              >
                <span style={{ color: "var(--ink-2)", fontSize: fs, letterSpacing: 0.5, marginRight: 12 }}>{e.name}</span>
                <span className="num" style={{ color: "var(--ink)", fontSize: fs, fontWeight: 300 }}>
                  {e.days === 0 ? "今天" : `${e.days} 天`}
                </span>
              </button>
            );
          })}

          <div className="flex items-center justify-center gap-4 pt-2.5">
            <button
              onClick={() => setOpenTreasury(true)}
              className="text-[11px]"
              style={{ background: "transparent", border: "none", padding: "4px 6px", color: "var(--ink-3)", cursor: "pointer" }}
            >
              小金库
            </button>
            <span style={{ color: "var(--ink-4)", fontSize: 10 }}>·</span>
            <button
              onClick={() => setQuiet(true)}
              className="text-[11px]"
              style={{ background: "transparent", border: "none", padding: "4px 6px", color: "var(--ink-3)", cursor: "pointer" }}
            >
              静一会
            </button>
            <span style={{ color: "var(--ink-4)", fontSize: 10 }}>·</span>
            <button
              onClick={() => setOpenTimeline(true)}
              className="text-[11px]"
              style={{ background: "transparent", border: "none", padding: "4px 6px", color: "var(--ink-3)", cursor: "pointer" }}
            >
              全部倒计时
            </button>
          </div>
        </motion.div>
      </div>

      {/* 抽屉 */}
      <TimelineDrawer
        open={openTimeline} onClose={() => setOpenTimeline(false)}
        events={clock.events} now={clock.now} settings={settings}
        onAddEvent={addEvent} onRemoveEvent={removeEvent}
      />
      <TreasuryDrawer
        open={openTreasury} onClose={() => setOpenTreasury(false)}
        clock={clock} settings={settings}
        wallet={{
          pot: state.potTotal, bank: 0, lifetimeEarned: state.potTotal, pending: 0,
          lastTick: 0, todayEarned: clock.todayEarned, todayCollected: 0,
          todayWorkedMs: 0, todayKey: "", fishing: null, fishSessions: [],
          history: {}, weekSettledKey: null, totalTaps: state.taps,
        } as any}
        onEditGoal={(name, amount) => setSettings({ goalName: name, goalAmount: amount })}
      />
      <SettingsDrawer
        open={openSettings} onClose={() => setOpenSettings(false)}
        settings={settings} onChange={setSettings} onReset={resetAll}
      />
    </div>
  );
}

/* ============ 组件：今日目标（极轻） ============ */
function TodayGoalStrip({
  name, amount, saved, progress, onClick,
}: {
  name: string; amount: number; saved: number; progress: number; onClick: () => void;
}) {
  if (!amount || !name) return null;
  return (
    <button
      onClick={onClick}
      className="w-full max-w-[240px]"
      style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
    >
      <div className="flex items-center justify-between text-[11px]">
        <span style={{ color: "var(--ink-2)" }}>{name}</span>
        <span className="num" style={{ color: "var(--ink-3)" }}>
          {Math.round(progress * 100)}%
        </span>
      </div>
      <div className="mt-1.5 h-[3px] w-full rounded-full" style={{ background: "var(--line)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${progress * 100}%`, background: "var(--gold)" }}
        />
      </div>
      <div className="mt-1 text-[10px]" style={{ color: "var(--ink-4)" }}>
        已存 {fmtMoney(saved)} / {fmtMoney(amount)}
      </div>
    </button>
  );
}

/* ============ 组件：时间刻度（细线 + 节点） ============ */
function TimeTrackInline({
  startLabel, endLabel, ratio, done,
}: { startLabel: string; endLabel: string; ratio: number; done?: boolean }) {
  const r = Math.max(0, Math.min(1, ratio));
  return (
    <div className="w-full">
      <div className="flex items-center px-1" style={{ height: 10 }}>
        <div className="h-1.5 w-px" style={{ background: "var(--ink-3)" }} />
        <div className="relative flex-1 h-px mx-1" style={{ background: "var(--line)" }}>
          {!done && (
            <div className="absolute top-0 left-0 h-px transition-all duration-1000" style={{ width: `${r * 100}%`, background: "var(--ink-3)" }} />
          )}
        </div>
        <div className="h-1.5 w-px" style={{ background: "var(--ink-3)" }} />
      </div>
      <div className="flex justify-between" style={{ color: "var(--ink-3)", fontSize: 10 }}>
        <span className="num">{startLabel}</span>
        <span className="num">{endLabel}</span>
      </div>
    </div>
  );
}

/* ============ 前景主时间 ============ */
function renderMainCountdown(clock: Clock) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const toHms = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return `${pad(h)}:${pad(m)}:${pad(ss)}`;
  };

  if (clock.phase === "before" && clock.toStartWork !== null) {
    return { label: "距 上 班", value: toHms(clock.toStartWork) };
  }
  if (clock.phase === "morning" || clock.phase === "afternoon" || clock.phase === "lunch") {
    return { label: "今 日 下 班", value: toHms(clock.toOffWork ?? 0) };
  }
  if (clock.phase === "after") {
    return { label: "今 日 结 束", value: "下班了" };
  }
  if (clock.phase === "holiday") {
    return { label: "假 期 中", value: `${Math.ceil((clock.toNextWork ?? 0) / 86400000)} 天后上班` };
  }
  if (clock.phase === "weekend") {
    return { label: "周 末", value: `${Math.ceil((clock.toNextWork ?? 0) / 86400000)} 天后上班` };
  }
  return { label: "今 日 休 息", value: `${Math.ceil((clock.toNextWork ?? 0) / 86400000)} 天后上班` };
}

function QuietCountdown({ clock }: { clock: Clock }) {
  const m = renderMainCountdown(clock);
  return (
    <div className="text-center">
      <div className="text-[10.5px] tracking-[0.35em] mb-4" style={{ color: "var(--ink-3)" }}>{m.label}</div>
      <div className="num-heavy leading-none" style={{ fontSize: "clamp(56px, 18vw, 96px)", color: "var(--ink)" }}>{m.value}</div>
    </div>
  );
}

function greetingText(now: number): string {
  const h = new Date(now).getHours();
  if (h < 5) return "深夜";
  if (h < 11) return "早上好";
  if (h < 13) return "中午好";
  if (h < 18) return "下午好";
  if (h < 22) return "晚上好";
  return "夜深了";
}

/* 收入显示：始终两位小数 */
function formatIncome(v: number): string {
  return v.toFixed(2);
}
