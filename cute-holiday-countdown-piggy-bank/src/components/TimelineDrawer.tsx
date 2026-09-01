import { useState } from "react";
import { motion } from "framer-motion";
import Drawer from "./Drawer";
import type { FutureEvent } from "../lib/useClock";
import type { Settings, CustomEvent } from "./../lib/store";

interface Props {
  open: boolean;
  onClose: () => void;
  events: FutureEvent[];
  now: number;
  settings: Settings;
  onAddEvent: (e: CustomEvent) => void;
  onRemoveEvent: (id: string) => void;
}

/**
 * 时间轴抽屉 —— 一条连续的时间线
 *
 * 不是列表卡片。是一根线，事件挂在上面。
 * 越远的事件在下面 & 更淡。
 */
export default function TimelineDrawer({ open, onClose, events, onAddEvent, onRemoveEvent }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [emoji, setEmoji] = useState("✨");

  const handleAdd = () => {
    if (!name.trim() || !date) return;
    onAddEvent({
      id: `e-${Date.now()}`,
      name: name.trim(),
      date,
      emoji: emoji || "✨",
    });
    setName(""); setDate(""); setEmoji("✨");
    setAdding(false);
  };

  // 计算每个事件在时间轴上的相对位置（按天数对数缩放，让近的疏、远的密）
  const maxDays = Math.max(1, events[events.length - 1]?.days || 30);

  return (
    <Drawer open={open} onClose={onClose} heightPct={88} title="所有时间">
      <div className="px-6 pb-24">
        <div className="relative pt-4">
          {/* 时间轴主线 */}
          <div
            className="absolute left-6 top-6"
            style={{
              bottom: 60,
              width: 1,
              background: "linear-gradient(180deg, var(--ink-3) 0%, var(--ink-4) 60%, transparent 100%)",
            }}
          />

          {/* "现在" 起点 */}
          <div className="relative mb-8 flex items-center pl-1">
            <div
              className="h-3 w-3 rounded-full"
              style={{ background: "var(--accent)", boxShadow: "0 0 0 4px var(--bg)" }}
            />
            <span className="ml-6 text-[13px]" style={{ color: "var(--ink-2)" }}>
              此刻
            </span>
          </div>

          {/* 事件 */}
          {events.map((e, i) => {
            const proximity = Math.max(0.15, 1 - (e.days / maxDays) * 0.85);
            const isNear = e.days <= 1;
            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="relative mb-6 flex items-start pl-1"
                style={{ opacity: proximity }}
              >
                <div
                  className="mt-1 h-2 w-2 rounded-full"
                  style={{
                    background: isNear ? "var(--accent)" : "var(--ink-3)",
                    boxShadow: "0 0 0 4px var(--surface-1)",
                  }}
                />
                <div className="ml-6 flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    {e.emoji && <span className="text-[15px]">{e.emoji}</span>}
                    <span
                      className="text-[15px]"
                      style={{ color: "var(--ink)", fontWeight: isNear ? 500 : 400 }}
                    >
                      {e.name}
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-3">
                    <span className="num text-[22px]" style={{ color: "var(--ink)" }}>
                      {e.days === 0 ? formatHms(e.ms) : e.days}
                    </span>
                    {e.days > 0 && (
                      <span className="text-[12px]" style={{ color: "var(--ink-3)" }}>天</span>
                    )}
                  </div>
                  {e.days > 0 && (
                    <div className="mt-0.5 text-[11px]" style={{ color: "var(--ink-3)" }}>
                      {formatDate(e.targetMs)}
                    </div>
                  )}
                </div>

                {e.kind === "custom" && (
                  <button
                    onClick={() => onRemoveEvent(e.id.replace("c-", ""))}
                    className="text-[11px]"
                    style={{ color: "var(--ink-3)", background: "transparent", border: "none", padding: 4 }}
                    aria-label="删除"
                  >
                    ×
                  </button>
                )}
              </motion.div>
            );
          })}

          {/* 添加自己的期待 */}
          <div className="relative mt-8 pl-1">
            <div
              className="h-2 w-2 rounded-full opacity-40"
              style={{
                background: "var(--ink-4)",
                boxShadow: "0 0 0 4px var(--surface-1)",
              }}
            />
            <div className="ml-6 -mt-2.5">
              {adding ? (
                <div className="space-y-3 pb-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={emoji}
                      onChange={e => setEmoji(e.target.value.slice(0, 2))}
                      className="!w-12 text-center"
                      placeholder="✨"
                    />
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="flex-1"
                      placeholder="想期待的事…"
                      autoFocus
                    />
                  </div>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                  />
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => { setAdding(false); setName(""); setDate(""); }}
                      className="flex-1 py-2.5 text-[13px]"
                      style={{ color: "var(--ink-2)", background: "transparent", border: "1px solid var(--line)", borderRadius: 999 }}
                    >
                      取消
                    </button>
                    <button
                      onClick={handleAdd}
                      className="flex-1 py-2.5 text-[13px]"
                      style={{ color: "var(--bg)", background: "var(--ink)", border: "none", borderRadius: 999 }}
                    >
                      添加
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="text-[13px]"
                  style={{ color: "var(--ink-3)", background: "transparent", border: "none", padding: 0 }}
                >
                  + 添加期待
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  );
}

function formatDate(ms: number) {
  const d = new Date(ms);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatHms(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
