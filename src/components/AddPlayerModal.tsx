import { useEffect, useState } from "react";
import { isLightColor, OUR_TEAM_COLORS } from "../lib/colors";
import { COVERAGE_DEFAULT, COVERAGE_MAX, COVERAGE_MIN } from "../lib/inspect";
import { LIBERO_WHITE, TEAM_BLUE, TEAM_RED } from "../types/play";
import { Modal } from "./Modal";

const POSITION_CHIPS = ["S", "OH", "MB", "OP", "L", "WS", "P"] as const;

export type NewPlayerDraft = {
  label: string;
  color: string;
  coverageOn: boolean;
  coverageM: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (draft: NewPlayerDraft) => void;
};

export function AddPlayerModal({ open, onClose, onCreate }: Props) {
  const [label, setLabel] = useState("P");
  const [color, setColor] = useState(TEAM_RED);
  const [coverageOn, setCoverageOn] = useState(true);
  const [coverageM, setCoverageM] = useState(COVERAGE_DEFAULT);

  useEffect(() => {
    if (!open) return;
    setLabel("P");
    setColor(TEAM_RED);
    setCoverageOn(true);
    setCoverageM(COVERAGE_DEFAULT);
  }, [open]);

  function pickOurs(next = TEAM_RED) {
    setColor(next);
    setCoverageOn(true);
  }

  function pickOpponent() {
    setColor(TEAM_BLUE);
    setCoverageOn(false);
  }

  const ours = color.toLowerCase() !== TEAM_BLUE.toLowerCase();

  return (
    <Modal open={open} title="선수 추가" onClose={onClose}>
      <p className="mb-2 text-sm text-white/70">소속</p>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          className={`rounded-xl py-2.5 text-sm font-semibold ${
            ours ? "bg-white text-ink" : "bg-ink text-white/75 ring-1 ring-line"
          }`}
          onClick={() => pickOurs(ours ? color : TEAM_RED)}
        >
          우리팀
        </button>
        <button
          type="button"
          className={`rounded-xl py-2.5 text-sm font-semibold ${
            !ours ? "bg-white text-ink" : "bg-ink text-white/75 ring-1 ring-line"
          }`}
          onClick={pickOpponent}
        >
          상대팀
        </button>
      </div>

      <label className="mb-1 block text-sm text-white/70">이름 / 포지션</label>
      <div className="mb-2 flex flex-wrap gap-1">
        {POSITION_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
              label === chip ? "bg-white text-ink" : "bg-ink text-white/75 ring-1 ring-line"
            }`}
            onClick={() => setLabel(chip)}
          >
            {chip}
          </button>
        ))}
      </div>
      <input
        className="mb-4 w-full rounded-xl bg-ink px-3 py-3 outline-none ring-1 ring-line focus:ring-accent"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={12}
        placeholder="S, OH, 이름…"
      />

      <p className="mb-2 text-sm text-white/70">우리팀 색상</p>
      <div className="mb-4 grid grid-cols-5 gap-1.5">
        {OUR_TEAM_COLORS.map((c) => (
          <button
            key={c.n}
            type="button"
            title={`${c.n}. ${c.label}`}
            onClick={() => pickOurs(c.value)}
            className={`flex aspect-square items-center justify-center rounded-xl text-sm font-bold ring-2 ${
              color === c.value ? "ring-white" : "ring-transparent"
            }`}
            style={{
              background: c.value,
              color: isLightColor(c.value) ? "#1a1a2e" : "#fff",
            }}
          >
            {c.n}
          </button>
        ))}
      </div>

      <p className="mb-2 text-sm text-white/70">기타</p>
      <div className="mb-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={pickOpponent}
          className={`rounded-xl py-2.5 text-xs font-medium text-white ring-1 ${
            color === TEAM_BLUE ? "ring-accent" : "ring-line"
          }`}
          style={{ background: TEAM_BLUE }}
        >
          상대 (블루)
        </button>
        <button
          type="button"
          onClick={() => pickOurs(LIBERO_WHITE)}
          className={`rounded-xl py-2.5 text-xs font-medium ring-1 ${
            color === LIBERO_WHITE ? "ring-accent" : "ring-line"
          }`}
          style={{ background: LIBERO_WHITE, color: "#1a1a2e" }}
        >
          리베로 (화이트)
        </button>
      </div>

      <p className="mb-1.5 text-xs font-semibold text-white/50">책임 범위</p>
      <p className="mb-2 text-[11px] leading-relaxed text-white/40">
        이 선수가 공을 받을 자리입니다. 움직이는 거리가 아닙니다.
      </p>
      <div className="mb-3 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          className={`rounded-xl py-2.5 text-xs font-semibold ${
            !coverageOn ? "bg-white text-ink" : "bg-ink text-white/75 ring-1 ring-line"
          }`}
          onClick={() => setCoverageOn(false)}
        >
          없음
        </button>
        <button
          type="button"
          className={`rounded-xl py-2.5 text-xs font-semibold ${
            coverageOn ? "bg-white text-ink" : "bg-ink text-white/75 ring-1 ring-line"
          }`}
          onClick={() => setCoverageOn(true)}
        >
          표시
        </button>
      </div>
      <div className={coverageOn ? "mb-5" : "pointer-events-none mb-5 opacity-40"}>
        <div className="mb-2 flex items-end justify-between">
          <label className="text-sm text-white/70">반경</label>
          <p className="text-sm font-semibold tabular-nums">{coverageM.toFixed(1)}m</p>
        </div>
        <input
          type="range"
          className="h-2 w-full accent-white"
          min={COVERAGE_MIN}
          max={COVERAGE_MAX}
          step={0.1}
          value={coverageM}
          disabled={!coverageOn}
          onChange={(e) => setCoverageM(Number(e.target.value))}
        />
        <div className="mt-1 flex justify-between text-[10px] text-white/40">
          <span>{COVERAGE_MIN}m</span>
          <span>{COVERAGE_MAX}m</span>
        </div>
      </div>

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
          onClick={() =>
            onCreate({
              label: label.trim() || "P",
              color,
              coverageOn,
              coverageM,
            })
          }
        >
          추가
        </button>
      </div>
    </Modal>
  );
}
