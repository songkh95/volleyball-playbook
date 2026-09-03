import { useEffect, useState } from "react";
import { LABEL_ON_LIGHT } from "../design/tokens";
import { isLightColor, PLAYER_COLORS } from "../lib/colors";
import { COVERAGE_DEFAULT, COVERAGE_MAX, COVERAGE_MIN, defaultCoverageOn, playerTeam } from "../lib/inspect";
import { PLAYER_POSES, poseLabel } from "../lib/playerPose";
import { TEAM_BLUE, TEAM_RED, type CourtObject, type PlayerPose, type PlayerTeam } from "../types/play";
import { Modal } from "./Modal";

type Props = {
  object: CourtObject | null;
  activePose?: PlayerPose;
  onClose: () => void;
  onSave: (patch: {
    label: string;
    color: string;
    team: PlayerTeam;
    coverageOn: boolean;
    coverageM: number;
  }) => void;
  onSetPose?: (pose: PlayerPose, fromPrevious: boolean) => void;
  hasPreviousCut?: boolean;
  onDelete: () => void;
};

export function EditPlayerModal({
  object,
  activePose = "idle",
  onClose,
  onSave,
  onSetPose,
  hasPreviousCut = false,
  onDelete,
}: Props) {
  const [team, setTeam] = useState<PlayerTeam>("ours");
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(TEAM_RED);
  const [coverageOn, setCoverageOn] = useState(false);
  const [coverageM, setCoverageM] = useState(COVERAGE_DEFAULT);
  const [fromPrevious, setFromPrevious] = useState(true);

  useEffect(() => {
    if (!object) return;
    setTeam(playerTeam(object));
    setLabel(object.label);
    setColor(object.color);
    setCoverageOn(defaultCoverageOn(object));
    setCoverageM(object.coverageM ?? COVERAGE_DEFAULT);
    setFromPrevious(true);
  }, [object]);

  if (!object || object.kind !== "player") return null;

  function pickTeam(next: PlayerTeam) {
    setTeam(next);
    setCoverageOn(next === "ours");
    if (next === "ours" && color === TEAM_BLUE) setColor(TEAM_RED);
    if (next === "opp" && color === TEAM_RED) setColor(TEAM_BLUE);
  }

  return (
    <Modal open title="선수 정보" onClose={onClose}>
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
      <input
        className="mb-4 w-full rounded-xl bg-ink px-3 py-3 outline-none ring-1 ring-line focus:ring-accent"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={12}
        placeholder="S, OH, 이름…"
      />

      <p className="mb-2 text-sm text-white/70">색상</p>
      <div className="mb-5 grid grid-cols-5 gap-1.5">
        {PLAYER_COLORS.map((c) => (
          <button
            key={c.n}
            type="button"
            title={`${c.n}. ${c.label}`}
            onClick={() => setColor(c.value)}
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

      {onSetPose ? (
        <>
          <p className="mb-1.5 text-xs font-semibold text-white/50">자세</p>
          <p className="mb-2 text-[11px] leading-relaxed text-white/40">
            리시브·토스·스파이크·블로킹 모두 같습니다. 이전부터는 바로 앞 장면 시작부터 이
            장면이 끝날 때까지, 이 장면만은 이 장면 시작부터 끝날 때까지 자세를
            유지합니다.
          </p>
          <div className="mb-3 grid grid-cols-3 gap-1.5">
            {PLAYER_POSES.map((item) => (
              <button
                key={item}
                type="button"
                className={`rounded-xl py-2.5 text-xs font-semibold ${
                  activePose === item ? "bg-accent text-ink" : "bg-ink text-white/75 ring-1 ring-line"
                }`}
                onClick={() => onSetPose(item, fromPrevious && hasPreviousCut)}
              >
                {poseLabel(item)}
              </button>
            ))}
          </div>
          <p className="mb-1.5 text-xs font-semibold text-white/50">이전 장면부터 진행</p>
          <div className="mb-5 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              className={`rounded-xl py-2.5 text-xs font-semibold ${
                !fromPrevious || !hasPreviousCut
                  ? "bg-accent text-ink"
                  : "bg-ink text-white/75 ring-1 ring-line"
              }`}
              onClick={() => setFromPrevious(false)}
            >
              이 장면만
            </button>
            <button
              type="button"
              disabled={!hasPreviousCut}
              className={`rounded-xl py-2.5 text-xs font-semibold ${
                fromPrevious && hasPreviousCut
                  ? "bg-accent text-ink"
                  : "bg-ink text-white/75 ring-1 ring-line"
              } disabled:opacity-40`}
              onClick={() => {
                const wasOff = !fromPrevious;
                setFromPrevious(true);
                if (hasPreviousCut && wasOff) onSetPose(activePose, true);
              }}
            >
              이전부터
            </button>
          </div>
        </>
      ) : null}

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
              color,
              team,
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
