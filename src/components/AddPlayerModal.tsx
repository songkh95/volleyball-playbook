import { useEffect, useState } from "react";
import { LABEL_ON_LIGHT } from "../design/tokens";
import { isLightColor, PLAYER_COLORS } from "../lib/colors";
import { COVERAGE_DEFAULT, COVERAGE_MAX, COVERAGE_MIN } from "../lib/inspect";
import { TEAM_BLUE, TEAM_RED, type PlayerTeam } from "../types/play";
import { Modal } from "./Modal";

const POSITION_CHIPS = ["S", "OH", "MB", "OP", "L", "WS", "P"] as const;

export type NewPlayerDraft = {
  label: string;
  color: string;
  team: PlayerTeam;
  coverageOn: boolean;
  coverageM: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (drafts: NewPlayerDraft[]) => void;
};

export function AddPlayerModal({ open, onClose, onCreate }: Props) {
  const [team, setTeam] = useState<PlayerTeam>("ours");
  const [label, setLabel] = useState("P");
  const [oursColor, setOursColor] = useState(TEAM_RED);
  const [oppColor, setOppColor] = useState(TEAM_BLUE);
  const [coverageOn, setCoverageOn] = useState(true);
  const [coverageM, setCoverageM] = useState(COVERAGE_DEFAULT);
  const [queue, setQueue] = useState<NewPlayerDraft[]>([]);
  const [draftTouched, setDraftTouched] = useState(false);

  const color = team === "opp" ? oppColor : oursColor;

  useEffect(() => {
    if (!open) return;
    setTeam("ours");
    setLabel("P");
    setOursColor(TEAM_RED);
    setOppColor(TEAM_BLUE);
    setCoverageOn(true);
    setCoverageM(COVERAGE_DEFAULT);
    setQueue([]);
    setDraftTouched(false);
  }, [open]);

  function pickTeam(next: PlayerTeam) {
    setTeam(next);
    setCoverageOn(next === "ours");
    setDraftTouched(true);
  }

  function pickColor(next: string) {
    if (team === "opp") setOppColor(next);
    else setOursColor(next);
    setDraftTouched(true);
  }

  function currentDraft(): NewPlayerDraft {
    return {
      label: label.trim() || "P",
      color,
      team,
      coverageOn,
      coverageM,
    };
  }

  function addToQueue() {
    setQueue((prev) => [...prev, currentDraft()]);
    setLabel("P");
    setDraftTouched(false);
  }

  function removeFromQueue(index: number) {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  }

  function pendingDrafts() {
    return queue.length === 0 || draftTouched ? [...queue, currentDraft()] : queue;
  }

  function confirm() {
    onCreate(pendingDrafts());
  }

  const pending = pendingDrafts();
  const confirmCount = pending.length;
  const showingCurrent = pending.length > queue.length;

  return (
    <Modal open={open} title="선수 추가" onClose={onClose}>
      <div className="flex max-h-[min(72dvh,36rem)] flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-1">
          <p className="mb-2 text-sm text-white/70">소속</p>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`rounded-xl py-2.5 text-sm font-semibold ${
                team === "ours" ? "bg-accent text-ink" : "bg-ink text-white/75 ring-1 ring-line"
              }`}
              onClick={() => pickTeam("ours")}
            >
              우리팀
            </button>
            <button
              type="button"
              className={`rounded-xl py-2.5 text-sm font-semibold ${
                team === "opp" ? "bg-accent text-ink" : "bg-ink text-white/75 ring-1 ring-line"
              }`}
              onClick={() => pickTeam("opp")}
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
                  label === chip ? "bg-accent text-ink" : "bg-ink text-white/75 ring-1 ring-line"
                }`}
                onClick={() => {
                  setLabel(chip);
                  setDraftTouched(true);
                }}
              >
                {chip}
              </button>
            ))}
          </div>
          <input
            className="mb-4 w-full rounded-xl bg-ink px-3 py-3 outline-none ring-1 ring-line focus:ring-accent"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              setDraftTouched(true);
            }}
            maxLength={12}
            placeholder="S, OH, 이름…"
          />

          <p className="mb-2 text-sm text-white/70">색상</p>
          <div className="mb-4 grid grid-cols-5 gap-1.5">
            {PLAYER_COLORS.map((c) => (
              <button
                key={c.n}
                type="button"
                title={`${c.n}. ${c.label}`}
                onClick={() => pickColor(c.value)}
                className={`flex aspect-square items-center justify-center rounded-xl text-sm font-bold ring-2 ${
                  color === c.value ? "ring-white" : "ring-transparent"
                }`}
                style={{
                  background: c.value,
                  color: isLightColor(c.value) ? LABEL_ON_LIGHT : "#fff",
                }}
              >
                {c.n}
              </button>
            ))}
          </div>

          <p className="mb-1.5 text-xs font-semibold text-white/50">책임 범위</p>
          <p className="mb-2 text-[11px] leading-relaxed text-white/40">
            이 선수가 공을 받을 자리입니다. 움직이는 거리가 아닙니다.
          </p>
          <div className="mb-3 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              className={`rounded-xl py-2.5 text-xs font-semibold ${
                !coverageOn ? "bg-accent text-ink" : "bg-ink text-white/75 ring-1 ring-line"
              }`}
              onClick={() => setCoverageOn(false)}
            >
              없음
            </button>
            <button
              type="button"
              className={`rounded-xl py-2.5 text-xs font-semibold ${
                coverageOn ? "bg-accent text-ink" : "bg-ink text-white/75 ring-1 ring-line"
              }`}
              onClick={() => setCoverageOn(true)}
            >
              표시
            </button>
          </div>
          <div className={coverageOn ? "mb-4" : "pointer-events-none mb-4 opacity-40"}>
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
        </div>

        <div className="mt-3 border-t border-line pt-3">
          <p className="mb-2 text-sm text-white/70">
            추가할 목록 {pending.length}명
          </p>
          {pending.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {pending.map((item, i) => {
                const isCurrent = showingCurrent && i === pending.length - 1;
                return (
                  <button
                    key={`${item.label}-${i}`}
                    type="button"
                    title={isCurrent ? "작성 중인 선수" : "목록에서 빼기"}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-2 py-1 text-[11px] font-semibold ring-1 ring-line"
                    onClick={() => {
                      if (!isCurrent) removeFromQueue(i);
                    }}
                  >
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: item.color }}
                    />
                    {item.label}
                    {isCurrent ? null : <span className="text-white/45">×</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-white/40">추가로 누르면 여기에 쌓입니다.</p>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="rounded-xl bg-ink px-3 py-3 text-sm text-white/80 ring-1 ring-line"
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="button"
            className="rounded-xl bg-ink px-3 py-3 text-sm font-semibold text-white/90 ring-1 ring-line"
            onClick={addToQueue}
          >
            추가로
          </button>
          <button
            type="button"
            className="min-w-0 flex-1 rounded-xl bg-accent py-3 font-semibold text-ink"
            onClick={confirm}
          >
            {confirmCount > 1 ? `${confirmCount}명 확정` : "확정"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
