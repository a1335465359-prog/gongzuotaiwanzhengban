import { useState, useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

/**
 * 今晚便签 —— 桌上的一张小纸片
 *
 * 不是卡片、不是任务、不是 todo。
 * 一天一条，第二天自动归档。
 */
export default function TonightNote({ value, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    onChange(draft.trim());
    setEditing(false);
  };

  const hasValue = value.trim().length > 0;

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[13px]" style={{ color: "var(--ink-2)" }}>
          今晚
        </span>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setDraft(value); setEditing(false); }
          }}
          placeholder="想干嘛…"
          className="flex-1 !border-b !border-dashed"
          style={{ borderColor: "var(--ink-3)", fontSize: 14 }}
          maxLength={40}
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group inline-flex items-baseline gap-2 text-left"
      style={{ background: "transparent", border: "none", padding: 0, cursor: "text" }}
    >
      <span className="text-[13px]" style={{ color: "var(--ink-2)" }}>
        {hasValue ? "今晚" : ""}
      </span>
      <span
        className="border-b border-dashed"
        style={{
          color: hasValue ? "var(--ink)" : "var(--ink-3)",
          fontSize: 14,
          borderColor: "var(--ink-4)",
          paddingBottom: 1,
        }}
      >
        {hasValue ? value : "下班后，想干嘛？"}
      </span>
    </button>
  );
}
