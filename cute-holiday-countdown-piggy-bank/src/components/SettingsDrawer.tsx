import Drawer from "./Drawer";
import type { Settings } from "../lib/store";
import type { WageMode } from "../lib/time";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: (s: Partial<Settings>) => void;
  onReset: () => void;
}

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * 设置抽屉 —— 一切非日常配置的入口
 */
export default function SettingsDrawer({ open, onClose, settings, onChange, onReset }: Props) {
  const toggleDay = (d: number) => {
    const nw = settings.workweek.includes(d)
      ? settings.workweek.filter(x => x !== d)
      : [...settings.workweek, d].sort();
    onChange({ workweek: nw });
  };

  return (
    <Drawer open={open} onClose={onClose} heightPct={88} title="设置">
      <div className="px-6 pb-24 space-y-8">

        {/* 主题 */}
        <Group label="外观">
          <SegmentControl<Settings["theme"]>
            options={[
              { v: "auto", label: "跟随系统" },
              { v: "light", label: "浅色" },
              { v: "dark", label: "深色" },
            ]}
            value={settings.theme}
            onChange={v => onChange({ theme: v })}
          />
        </Group>

        {/* 工资 */}
        <Group label="工资">
          <SegmentControl<WageMode>
            options={[
              { v: "monthly", label: "月薪" },
              { v: "daily", label: "日薪" },
              { v: "hourly", label: "时薪" },
            ]}
            value={settings.mode}
            onChange={v => onChange({ mode: v })}
          />
          <Field label="金额">
            <input
              type="number"
              value={settings.wage || ""}
              onChange={e => onChange({ wage: parseFloat(e.target.value) || 0 })}
              inputMode="decimal"
            />
          </Field>
          <Field label="每月计薪天数">
            <input
              type="number"
              value={settings.monthlyWorkdays || ""}
              onChange={e => onChange({ monthlyWorkdays: parseFloat(e.target.value) || 21.75 })}
            />
          </Field>
        </Group>

        {/* 时间 */}
        <Group label="工作时间">
          <Field label="上班">
            <input type="time" value={settings.start} onChange={e => onChange({ start: e.target.value })} />
          </Field>
          <Field label="下班">
            <input type="time" value={settings.end} onChange={e => onChange({ end: e.target.value })} />
          </Field>
          <Field label="午休">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.lunchEnabled}
                onChange={e => onChange({ lunchEnabled: e.target.checked })}
              />
              <span className="text-[13px]" style={{ color: "var(--ink-2)" }}>启用</span>
            </label>
          </Field>
          {settings.lunchEnabled && (
            <>
              <Field label="午休开始">
                <input type="time" value={settings.lunchStart} onChange={e => onChange({ lunchStart: e.target.value })} />
              </Field>
              <Field label="午休结束">
                <input type="time" value={settings.lunchEnd} onChange={e => onChange({ lunchEnd: e.target.value })} />
              </Field>
            </>
          )}
        </Group>

        {/* 工作日 */}
        <Group label="每周上班日">
          <div className="flex gap-1.5">
            {WEEKDAY_LABELS.map((label, d) => {
              const active = settings.workweek.includes(d);
              return (
                <button
                  key={d}
                  onClick={() => toggleDay(d)}
                  className="flex-1 py-2.5 text-[13px] transition-colors"
                  style={{
                    background: active ? "var(--ink)" : "transparent",
                    color: active ? "var(--bg)" : "var(--ink-2)",
                    border: active ? "1px solid var(--ink)" : "1px solid var(--line)",
                    borderRadius: 10,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Group>

        {/* 周末 / 发薪 */}
        <Group label="节奏">
          <Field label="周末起点日">
            <select value={settings.weekendStartDay} onChange={e => onChange({ weekendStartDay: parseInt(e.target.value) })}>
              {WEEKDAY_LABELS.map((l, i) => <option key={i} value={i}>周{l}</option>)}
            </select>
          </Field>
          <Field label="周末起点时刻">
            <input type="time" value={settings.weekendStartTime} onChange={e => onChange({ weekendStartTime: e.target.value })} />
          </Field>
          <Field label="发薪日">
            <input
              type="number"
              min={1}
              max={28}
              value={settings.paydayDay}
              onChange={e => onChange({ paydayDay: Math.min(28, Math.max(1, parseInt(e.target.value) || 1)) })}
            />
          </Field>
        </Group>

        {/* 危险区 */}
        <div className="pt-4">
          <button
            onClick={() => {
              if (confirm("确定清空所有数据？")) onReset();
            }}
            className="text-[12px]"
            style={{ background: "transparent", border: "none", color: "var(--ink-3)", padding: 0 }}
          >
            清空所有数据
          </button>
        </div>
      </div>
    </Drawer>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="text-[11px] tracking-widest mb-3" style={{ color: "var(--ink-3)" }}>
        {label.toUpperCase()}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-[13px] w-24 shrink-0" style={{ color: "var(--ink-2)" }}>{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function SegmentControl<T extends string>({
  options, value, onChange,
}: {
  options: { v: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="flex gap-0.5 p-0.5 rounded-lg"
      style={{ background: "var(--surface-2)" }}
    >
      {options.map(o => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className="flex-1 py-2 text-[13px] transition-all"
          style={{
            background: value === o.v ? "var(--bg)" : "transparent",
            color: value === o.v ? "var(--ink)" : "var(--ink-2)",
            border: "none",
            borderRadius: 8,
            fontWeight: value === o.v ? 500 : 400,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
