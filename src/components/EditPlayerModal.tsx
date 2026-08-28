import { useEffect, useState } from "react";
import { isLightColor, OUR_TEAM_COLORS } from "../lib/colors";
import { COVERAGE_DEFAULT, COVERAGE_MAX, COVERAGE_MIN, defaultCoverageOn } from "../lib/inspect";
import { TEAM_BLUE, TEAM_RED, type CourtObject } from "../types/play";
import { Modal } from "./Modal";

type Team = "ours" | "opp";

type Props = {
  object: CourtObject | null;
  onClose: () => void;
  onSave: (patch: {
    label: string;
    color: string;
    coverageOn: boolean;
    coverageM: number;
  }) => void;
  onDelete: () => void;
};

export function EditPlayerModal({ object, onClose, onSave, onDelete }: Props) {
  const [team, setTeam] = useState<Team>("ours");
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(TEAM_RED);
  const [coverageOn, setCoverageOn] = useState(false);
  const [coverageM, setCoverageM] = useState(COVERAGE_DEFAULT);

  useEffect(() => {
    if (!object) return;
    const opp = object.color.toLowerCase() === TEAM_BLUE.toLowerCase();
    setTeam(opp ? "opp" : "ours");
    setLabel(object.label);
    setColor(object.color);
    setCoverageOn(defaultCoverageOn(object));
    setCoverageM(object.coverageM ?? COVERAGE_DEFAULT);
  }, [object]);

  if (!object || object.kind !== "player") return null;

  function pickOurs(next: string) {
    setTeam("ours");
    setColor(next);
    setCoverageOn(true);
  }

  function pickOpponent() {
    setTeam("opp");
    setColor(TEAM_BLUE);
    setCoverageOn(false);
  }

  return (
    <Modal open title="선수 정보" onClose={onClose}>
      <p className="mb-2 text-sm text-white/70">소속</p>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          className={`rounded-xl py-2.5 text-sm font-semibold ${
            team === "ours" ? "bg-white text-ink" : "bg-ink text-white/75 ring-1 ring-line"
          }`}
          onClick={() => pickOurs(color === TEAM_BLUE ? TEAM_RED : color)}
        >
          우리팀
        </button>
        <button
          type="button"
          className={`rounded-xl py-2.5 text-sm font-semibold ${
            team === "opp" ? "bg-white text-ink" : "bg-ink text-white/75 ring-1 ring-line"
          }`}
          onClick={pickOpponent}
        >
          상대팀
        </button>
      </div>

      <label className="mb-1 block text-sm text-white/70">이름 / 포지션</label>
      <input
        className="mb-4 w-full rounded-xl bg-ink px-3 py-3 outline-none ring-1 ring-line focus:ring-accent"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={12}
        placeholder="S, OH, 이름…"
      />

      {team === "ours" ? (
        <>
          <p className="mb-2 text-sm text-white/70">우리팀 색상</p>
          <div className="mb-5 grid grid-cols-5 gap-1.5">
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
        </>
      ) : (
        <>
          <p className="mb-2 text-sm text-white/70">상대팀 색상</p>
          <div className="mb-5">
            <button
              type="button"
              className="flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-white ring-2 ring-white"
              style={{ background: TEAM_BLUE }}
            >
              블루
            </button>
          </div>
        </>
      )}

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
          className="rounded-xl bg-red-800 px-3 py-3 text-sm font-semibold"
          onClick={onDelete}
        >
          삭제
        </button>
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
            onSave({
              label: label.trim() || object.label,
              color: team === "opp" ? TEAM_BLUE : color,
              coverageOn,
              coverageM,
            })
          }
        >
          적용
        </button>
      </div>
    </Modal>
  );
}
