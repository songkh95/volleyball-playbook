import { useEffect, useState } from "react";
import { DURATION_PRESETS_MS } from "../lib/interpolate";
import { Modal } from "./Modal";

type Props = {
  open: boolean;
  name: string;
  fromLabel: string;
  toLabel: string | null;
  durationMs: number;
  suggestions?: readonly string[];
  onClose: () => void;
  onSave: (name: string) => void;
  onDuration: (ms: number) => void;
};

function durationText(ms: number) {
  const s = ms / 1000;
  return `${s}초`;
}

export function SceneCutModal({
  open,
  name,
  fromLabel,
  toLabel,
  durationMs,
  suggestions,
  onClose,
  onSave,
  onDuration,
}: Props) {
  const [value, setValue] = useState(name);

  useEffect(() => {
    if (open) setValue(name);
  }, [open, name]);

  if (!open) return null;

  function submit() {
    onSave(value.trim() || name.trim() || "장면");
  }

  const speed = durationText(durationMs);

  return (
    <Modal open title="장면" onClose={onClose}>
      <label className="mb-1 block text-sm text-white/70">이름</label>
      {suggestions && suggestions.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {suggestions.map((item) => (
            <button
              key={item}
              type="button"
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                value === item ? "bg-accent text-ink" : "bg-ink text-white/80 ring-1 ring-line"
              }`}
              onClick={() => setValue(item)}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
      <input
        className="mb-5 w-full rounded-xl bg-ink px-3 py-3 outline-none ring-1 ring-line focus:ring-accent"
        value={value}
        maxLength={40}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
      />

      {toLabel ? (
        <>
          <p className="mb-2 text-sm text-white/70">다음 장면까지</p>
          <p className="mb-3 text-[13px] leading-relaxed text-white/55">
            {value.trim() || fromLabel}에서 {toLabel} 갈 때 진행 속도를 {speed}로 설정합니다.
          </p>
          <div className="mb-5 flex flex-wrap gap-1.5">
            {DURATION_PRESETS_MS.map((ms) => {
              const active = durationMs === ms;
              return (
                <button
                  key={ms}
                  type="button"
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                    active ? "bg-accent text-ink" : "bg-ink text-white/80 ring-1 ring-line"
                  }`}
                  onClick={() => onDuration(ms)}
                >
                  {durationText(ms)}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <p className="mb-5 text-[13px] leading-relaxed text-white/45">
          마지막 장면입니다. 다음 장면이 생기면 여기서 진행 속도를 정할 수 있습니다.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          className="flex-1 rounded-xl bg-ink py-3 text-white/80 ring-1 ring-line"
          onClick={onClose}
        >
          취소
        </button>
        <button
          type="button"
          className="flex-1 rounded-xl bg-accent py-3 font-semibold text-ink"
          onClick={submit}
        >
          저장
        </button>
      </div>
    </Modal>
  );
}
