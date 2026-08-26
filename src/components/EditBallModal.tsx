import { useEffect, useMemo, useState } from "react";
import {
  bandFromHeight,
  bandLabel,
  contactZoneFromHeight,
  flightLabel,
  HEIGHT_MAX,
  HEIGHT_MIN,
  heightForBand,
  type BallHeightBand,
} from "../lib/ballFlight";
import type { BallFlight, CourtObject } from "../types/play";
import { Modal } from "./Modal";

type Props = {
  object: CourtObject | null;
  onClose: () => void;
  onSave: (patch: { height: number | undefined; flight: BallFlight | undefined }) => void;
};

const HEIGHT_PRESETS: Exclude<BallHeightBand, "auto">[] = ["lower", "upper", "air"];
const FLIGHT_PRESETS: (BallFlight | undefined)[] = [undefined, "fast", "slow"];

export function EditBallModal({ object, onClose, onSave }: Props) {
  const [mode, setMode] = useState<BallHeightBand>("auto");
  const [height, setHeight] = useState(heightForBand("upper"));
  const [flight, setFlight] = useState<BallFlight | undefined>(undefined);

  useEffect(() => {
    if (!object || object.kind !== "ball") return;
    setFlight(object.flight);
    if (object.height == null) {
      setMode("auto");
      setHeight(heightForBand("upper"));
      return;
    }
    setMode(bandFromHeight(object.height));
    setHeight(object.height);
  }, [object?.id, object?.kind, object?.height, object?.flight]);

  const contact = useMemo(() => contactZoneFromHeight(height), [height]);
  const band = mode === "auto" ? "auto" : bandFromHeight(height);

  if (!object || object.kind !== "ball") return null;

  function commit(nextHeight: number | undefined, nextFlight: BallFlight | undefined) {
    onSave({ height: nextHeight, flight: nextFlight });
  }

  function applyBand(next: BallHeightBand) {
    setMode(next);
    if (next === "auto") {
      commit(undefined, flight);
      return;
    }
    const nextHeight = heightForBand(next);
    setHeight(nextHeight);
    commit(nextHeight, flight);
  }

  function applyFlight(next: BallFlight | undefined) {
    setFlight(next);
    commit(mode === "auto" ? undefined : height, next);
  }

  return (
    <Modal open title="공" onClose={onClose}>
      <p className="mb-3 text-sm leading-relaxed text-white/65">
        이 컷에서 공의 높이와 다음 컷으로 가는 움직임을 정합니다. 누르면 바로
        적용됩니다.
      </p>

      <p className="mb-1.5 text-xs font-semibold text-white/50">높이</p>
      <div className="mb-4 grid grid-cols-4 gap-1.5">
        <button
          type="button"
          className={`rounded-xl py-2.5 text-xs font-semibold ${
            mode === "auto" ? "bg-white text-ink" : "bg-ink text-white/75 ring-1 ring-line"
          }`}
          onClick={() => applyBand("auto")}
        >
          자동
        </button>
        {HEIGHT_PRESETS.map((item) => (
          <button
            key={item}
            type="button"
            className={`rounded-xl py-2.5 text-xs font-semibold ${
              mode === item ? "bg-white text-ink" : "bg-ink text-white/75 ring-1 ring-line"
            }`}
            onClick={() => applyBand(item)}
          >
            {bandLabel(item)}
          </button>
        ))}
      </div>

      <div className={mode === "auto" ? "pointer-events-none mb-5 opacity-40" : "mb-5"}>
        <div className="mb-2 flex items-end justify-between">
          <label className="text-sm text-white/70">높이</label>
          <p className="text-sm font-semibold tabular-nums">
            {height.toFixed(2)}m · {bandLabel(band)}
          </p>
        </div>
        <input
          type="range"
          className="h-2 w-full accent-white"
          min={HEIGHT_MIN}
          max={HEIGHT_MAX}
          step={0.05}
          value={height}
          disabled={mode === "auto"}
          onChange={(e) => {
            const next = Number(e.target.value);
            setHeight(next);
            setMode(bandFromHeight(next));
          }}
          onPointerUp={(e) => {
            const next = Number((e.target as HTMLInputElement).value);
            setHeight(next);
            setMode(bandFromHeight(next));
            commit(next, flight);
          }}
        />
        <div className="mt-1 flex justify-between text-[10px] text-white/40">
          <span>하단 {HEIGHT_MIN.toFixed(1)}m</span>
          <span>상단</span>
          <span>공중 {HEIGHT_MAX.toFixed(1)}m</span>
        </div>
        <p className="mt-1.5 text-[11px] text-white/40">
          선수 옆에 두면 3D 원기둥 {contact === "lower" ? "하단" : "상단"}에 닿습니다.
        </p>
      </div>

      <p className="mb-1.5 text-xs font-semibold text-white/50">이동</p>
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {FLIGHT_PRESETS.map((item) => (
          <button
            key={item ?? "normal"}
            type="button"
            className={`rounded-xl py-2.5 text-xs font-semibold ${
              flight === item ? "bg-white text-ink" : "bg-ink text-white/75 ring-1 ring-line"
            }`}
            onClick={() => applyFlight(item)}
          >
            {flightLabel(item)}
          </button>
        ))}
      </div>
      <p className="mb-5 text-[11px] leading-relaxed text-white/40">
        {flight === "fast"
          ? "선수에서 선수로 빠르게 갑니다. 도착한 뒤에는 선수에 붙어 접촉을 유지합니다."
          : flight === "slow"
            ? "선수에게 갈 때 큰 포물선을 그리며 천천히 떨어집니다."
            : "지금처럼 컷 사이에 보통 속도로 이동합니다."}
      </p>

      <button
        type="button"
        className="w-full rounded-xl bg-accent py-3 font-semibold text-ink"
        onClick={() => {
          commit(mode === "auto" ? undefined : height, flight);
          onClose();
        }}
      >
        확인
      </button>
    </Modal>
  );
}
