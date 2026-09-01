import { useState } from "react";
import Drawer from "./Drawer";
import type { Settings, WalletState } from "../lib/store";
import type { Clock } from "../lib/useClock";

interface Props {
  open: boolean;
  onClose: () => void;
  clock: Clock;
  settings: Settings;
  wallet: WalletState;
  onEditGoal: (name: string, amount: number) => void;
}

/**
 * 小金库抽屉 —— 打开小猪的肚子
 *
 * 首页不显示金融数据，都在这里。
 * 工资金额永远不明文，用"隐私眼"点击查看。
 */
export default function TreasuryDrawer({ open, onClose, clock, settings, wallet, onEditGoal }: Props) {
  const [revealMap, setRevealMap] = useState<Record<string, boolean>>({});
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalName, setGoalName] = useState(settings.goalName);
  const [goalAmt, setGoalAmt] = useState(settings.goalAmount);

  const toggle = (k: string) => {
    setRevealMap(m => ({ ...m, [k]: !m[k] }));
    setTimeout(() => setRevealMap(m => ({ ...m, [k]: false })), 8000);
  };

  const goalProgress = settings.goalAmount > 0
    ? Math.min(1, (wallet.pot + wallet.bank) / settings.goalAmount)
    : 0;
  const remaining = Math.max(0, settings.goalAmount - wallet.pot - wallet.bank);
  const daysLeft = clock.rate.daily > 0 ? Math.ceil(remaining / clock.rate.daily) : 0;

  return (
    <Drawer open={open} onClose={onClose} heightPct={82} title="小金库">
      <div className="px-6 pb-24 space-y-8">

        {/* 今日 */}
        <section>
          <div className="text-[11px] tracking-widest" style={{ color: "var(--ink-3)" }}>
            TODAY
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <PrivacyValue
              value={clock.todayEarned}
              revealed={revealMap["today"]}
              onToggle={() => toggle("today")}
              size="lg"
            />
          </div>
          <div className="mt-1 text-[12px]" style={{ color: "var(--ink-3)" }}>
            今日已工作 {formatDur(clock.workedMs)}
          </div>
        </section>

        {/* 累计 */}
        <section className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-[11px] tracking-widest" style={{ color: "var(--ink-3)" }}>
              THIS WEEK
            </div>
            <div className="mt-2">
              <PrivacyValue
                value={clock.rate.daily * 5} // 简化：一周 5 天
                revealed={revealMap["week"]}
                onToggle={() => toggle("week")}
                size="md"
              />
            </div>
          </div>
          <div>
            <div className="text-[11px] tracking-widest" style={{ color: "var(--ink-3)" }}>
              THIS MONTH
            </div>
            <div className="mt-2">
              <PrivacyValue
                value={clock.rate.monthly}
                revealed={revealMap["month"]}
                onToggle={() => toggle("month")}
                size="md"
              />
            </div>
          </div>
        </section>

        {/* 罐子 */}
        <section>
          <div className="text-[11px] tracking-widest" style={{ color: "var(--ink-3)" }}>
            IN THE JAR
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <div className="text-[12px]" style={{ color: "var(--ink-2)" }}>罐里</div>
              <PrivacyValue
                value={wallet.pot}
                revealed={revealMap["pot"]}
                onToggle={() => toggle("pot")}
                size="md"
                accent
              />
            </div>
            <div className="text-right">
              <div className="text-[12px]" style={{ color: "var(--ink-2)" }}>已转入银行</div>
              <PrivacyValue
                value={wallet.bank}
                revealed={revealMap["bank"]}
                onToggle={() => toggle("bank")}
                size="md"
              />
            </div>
          </div>
        </section>

        {/* 目标 */}
        <section>
          <div className="text-[11px] tracking-widest" style={{ color: "var(--ink-3)" }}>
            SAVING FOR
          </div>
          {editingGoal ? (
            <div className="mt-3 space-y-3">
              <input
                type="text"
                value={goalName}
                onChange={e => setGoalName(e.target.value)}
                placeholder="给自己一个目标…"
              />
              <input
                type="number"
                value={goalAmt || ""}
                onChange={e => setGoalAmt(parseFloat(e.target.value) || 0)}
                placeholder="金额"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingGoal(false)}
                  className="flex-1 py-2 text-[13px]"
                  style={{ background: "transparent", border: "1px solid var(--line)", color: "var(--ink-2)", borderRadius: 999 }}
                >
                  取消
                </button>
                <button
                  onClick={() => { onEditGoal(goalName, goalAmt); setEditingGoal(false); }}
                  className="flex-1 py-2 text-[13px]"
                  style={{ background: "var(--ink)", color: "var(--bg)", border: "none", borderRadius: 999 }}
                >
                  保存
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setGoalName(settings.goalName); setGoalAmt(settings.goalAmount); setEditingGoal(true); }}
              className="mt-3 block w-full text-left"
              style={{ background: "transparent", border: "none", padding: 0 }}
            >
              <div className="text-[16px]" style={{ color: "var(--ink)" }}>
                {settings.goalName || "点击设定一个目标"}
              </div>
              {settings.goalAmount > 0 && (
                <>
                  <div className="mt-2 h-px" style={{ background: "var(--line)" }}>
                    <div
                      className="h-px transition-all duration-1000"
                      style={{ width: `${goalProgress * 100}%`, background: "var(--gold)" }}
                    />
                  </div>
                  <div className="mt-2 flex items-baseline justify-between text-[12px]" style={{ color: "var(--ink-3)" }}>
                    <span>
                      <PrivacyValue value={wallet.pot + wallet.bank} revealed={revealMap["saved"]} onToggle={() => toggle("saved")} size="sm" inline />
                      {" / "}
                      <PrivacyValue value={settings.goalAmount} revealed={revealMap["goal"]} onToggle={() => toggle("goal")} size="sm" inline />
                    </span>
                    <span>还需约 {daysLeft} 个工作日</span>
                  </div>
                </>
              )}
            </button>
          )}
        </section>

      </div>
    </Drawer>
  );
}

/** 隐私金额显示：默认蒙版 "···"，点击展开 */
function PrivacyValue({
  value, revealed, onToggle, size = "md", accent, inline,
}: {
  value: number;
  revealed?: boolean;
  onToggle: () => void;
  size?: "sm" | "md" | "lg";
  accent?: boolean;
  inline?: boolean;
}) {
  const fs = size === "lg" ? 40 : size === "md" ? 22 : 14;
  const color = accent ? "var(--gold)" : "var(--ink)";
  const Cmp = inline ? "span" : "div";
  return (
    <Cmp
      onClick={onToggle}
      className="num-heavy inline-flex items-baseline gap-1 cursor-pointer"
      style={{ fontSize: fs, color, lineHeight: 1 }}
      role="button"
    >
      {revealed ? (
        <>¥{value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
      ) : (
        <span style={{ letterSpacing: "0.15em", fontSize: fs * 0.85 }}>¥····</span>
      )}
    </Cmp>
  );
}

function formatDur(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}小时${m}分`;
  return `${m}分钟`;
}
