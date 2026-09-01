import { useState } from "react";
import type { Settings } from "../lib/store";
import type { WageMode } from "../lib/time";

interface Props {
  onDone: (patch: Partial<Settings>) => void;
}

/**
 * 极简 onboarding —— 只问最必要的三件事
 *
 * 不做花哨的多步骤引导。让用户 30 秒内进入产品。
 */
export default function Onboarding({ onDone }: Props) {
  const [mode, setMode] = useState<WageMode>("monthly");
  const [wage, setWage] = useState<number>(8000);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");

  const submit = () => {
    onDone({
      onboardingDone: true,
      mode,
      wage,
      start,
      end,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
      style={{ background: "var(--bg)" }}
    >
      <div className="w-full max-w-sm">
        <div className="text-[11px] tracking-[0.3em] mb-4" style={{ color: "var(--ink-3)" }}>
          HELLO
        </div>
        <h1
          className="text-[24px] leading-tight mb-8"
          style={{ color: "var(--ink)", fontWeight: 400 }}
        >
          告诉我一点小事，<br />
          就可以开始了
        </h1>

        <div className="space-y-6">
          {/* 工资 */}
          <div>
            <div className="text-[12px] mb-3" style={{ color: "var(--ink-2)" }}>
              工资
            </div>
            <div className="flex gap-1 mb-3 p-0.5 rounded-lg" style={{ background: "var(--surface-1)" }}>
              {(["monthly", "daily", "hourly"] as WageMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="flex-1 py-2 text-[13px]"
                  style={{
                    background: mode === m ? "var(--bg)" : "transparent",
                    color: mode === m ? "var(--ink)" : "var(--ink-2)",
                    border: "none",
                    borderRadius: 8,
                    transition: "all .2s",
                  }}
                >
                  {m === "monthly" ? "月薪" : m === "daily" ? "日薪" : "时薪"}
                </button>
              ))}
            </div>
            <input
              type="number"
              inputMode="decimal"
              value={wage || ""}
              onChange={e => setWage(parseFloat(e.target.value) || 0)}
              placeholder={mode === "monthly" ? "如 8000" : mode === "daily" ? "如 400" : "如 50"}
            />
          </div>

          {/* 上下班 */}
          <div>
            <div className="text-[12px] mb-3" style={{ color: "var(--ink-2)" }}>
              每天几点上下班
            </div>
            <div className="flex items-center gap-3">
              <input type="time" value={start} onChange={e => setStart(e.target.value)} />
              <span style={{ color: "var(--ink-3)" }}>—</span>
              <input type="time" value={end} onChange={e => setEnd(e.target.value)} />
            </div>
          </div>
        </div>

        <button
          onClick={submit}
          disabled={!wage || !start || !end}
          className="mt-10 w-full py-3.5 text-[14px]"
          style={{
            background: wage && start && end ? "var(--ink)" : "var(--line)",
            color: "var(--bg)",
            border: "none",
            borderRadius: 999,
            cursor: wage && start && end ? "pointer" : "not-allowed",
            transition: "all .2s",
          }}
        >
          进入
        </button>

        <p className="mt-6 text-center text-[11px]" style={{ color: "var(--ink-3)" }}>
          其它设置随时可从右上角调整
        </p>
      </div>
    </div>
  );
}
