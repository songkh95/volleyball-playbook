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
import {
  defaultFan,
  FAN_DEPTH_MAX,
  FAN_DEPTH_MIN,
  FAN_SPREAD_MAX,
  FAN_SPREAD_MIN,
  fanHeadingFromTravel,
} from "../lib/inspect";
import type { BallFlight, CourtObject, CourtType, LandingFan } from "../types/play";
import { Modal } from "./Modal";

type Props = {
  object: CourtObject | null;
  court: CourtType;
  travelTo?: { x: number; y: number };
  onClose: () => void;
  onSave: (patch: {
    height: number | undefined;
    flight: BallFlight | undefined;
    fan: LandingFan | null;
  }) => void;
};

const HEIGHT_PRESETS: Exclude<BallHeightBand, "auto">[] = ["lower", "upper", "air"];
const FLIGHT_PRESETS: (BallFlight | undefined)[] = [undefined, "fast", "slow", "spike"];

function deg(rad: number) {
  return Math.round((((rad * 180) / Math.PI) % 360) + 360) % 360;
}

function headingHint(degrees: number) {
  if (degrees <= 20 || degrees >= 340) return "상대 쪽";
  if (degrees >= 70 && degrees <= 110) return "오른쪽";
  if (degrees >= 160 && degrees <= 200) return "우리 쪽";
  if (degrees >= 250 && degrees <= 290) return "왼쪽";
  return "";
}

export function EditBallModal({ object, court, travelTo, onClose, onSave }: Props) {
  const [mode, setMode] = useState<BallHeightBand>("auto");
  const [height, setHeight] = useState(heightForBand("upper"));
  const [flight, setFlight] = useState<BallFlight | undefined>(undefined);
  const [fanOn, setFanOn] = useState(false);
  const [fan, setFan] = useState<LandingFan>(() => defaultFan(court));

  useEffect(() => {
    if (!object || object.kind !== "ball") return;
    setFlight(object.flight);
    setFanOn(!!object.fan);
    setFan(object.fan ?? defaultFan(court, object, travelTo));
    if (object.height == null) {
      setMode("auto");
      setHeight(heightForBand("upper"));
      return;
    }
    setMode(bandFromHeight(object.height));
    setHeight(object.height);
  }, [object?.id, object?.kind, object?.height, object?.flight, object?.fan, court, travelTo]);

  const contact = useMemo(() => contactZoneFromHeight(height), [height]);
  const band = mode === "auto" ? "auto" : bandFromHeight(height);
  const travelHeading =
    object?.kind === "ball" && travelTo
      ? fanHeadingFromTravel(object, travelTo)
      : null;
  const headingDeg = deg(travelHeading ?? fan.heading);
  const spreadDeg = Math.round((fan.spread * 180) / Math.PI);

  if (!object || object.kind !== "ball") return null;
  const ball = object;

  function currentFan(nextOn = fanOn, nextFan = fan): LandingFan | null {
    return nextOn ? nextFan : null;
  }

  function commit(
    nextHeight: number | undefined,
    nextFlight: BallFlight | undefined,
    nextFan: LandingFan | null,
  ) {
    onSave({ height: nextHeight, flight: nextFlight, fan: nextFan });
  }

  function heightValue() {
    return mode === "auto" ? undefined : height;
  }

  function applyBand(next: BallHeightBand) {
    setMode(next);
    let nextFlight = flight;
    if (next === "lower" && flight === "spike") {
      nextFlight = undefined;
      setFlight(undefined);
    }
    if (next === "auto") {
      commit(undefined, nextFlight, currentFan());
      return;
    }
    const nextHeight = heightForBand(next);
    setHeight(nextHeight);
    commit(nextHeight, nextFlight, currentFan());
  }

  function applyFlight(next: BallFlight | undefined) {
    if (next === "spike") {
      const zone = mode === "auto" ? "upper" : bandFromHeight(height);
      if (zone === "lower") {
        const nextHeight = heightForBand("upper");
        setMode("upper");
        setHeight(nextHeight);
        setFlight(next);
        commit(nextHeight, next, currentFan());
        return;
      }
    }
    setFlight(next);
    commit(heightValue(), next, currentFan());
  }

  function applyFanOn(on: boolean) {
    if (!on) {
      setFanOn(false);
      commit(heightValue(), flight, null);
      return;
    }
    const base = defaultFan(court, ball, travelTo);
    const next = {
      heading: base.heading,
      spread: fanOn ? fan.spread : base.spread,
      depth: fanOn ? fan.depth : base.depth,
    };
    setFanOn(true);
    setFan(next);
    commit(heightValue(), flight, next);
  }

  function patchFan(partial: Partial<LandingFan>) {
    const next = { ...fan, ...partial };
    setFan(next);
    setFanOn(true);
    commit(heightValue(), flight, next);
  }

  return (
    <Modal open title="공" onClose={onClose}>
      <p className="mb-3 text-sm leading-relaxed text-white/65">
        이 장면에서 공의 높이와 다음 장면으로 가는 움직임을 정합니다. 누르면 바로
        적용됩니다.
      </p>

      <p className="mb-1.5 text-xs font-semibold text-white/50">높이</p>
      <div className="mb-4 grid grid-cols-4 gap-1.5">
        <button
          type="button"
          className={`rounded-xl py-2.5 text-xs font-semibold ${
            mode === "auto" ? "bg-accent text-ink" : "bg-ink text-white/75 ring-1 ring-line"
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
              mode === item ? "bg-accent text-ink" : "bg-ink text-white/75 ring-1 ring-line"
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
            commit(next, flight, currentFan());
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
      <div className="mb-3 grid grid-cols-4 gap-1.5">
        {FLIGHT_PRESETS.map((item) => (
          <button
            key={item ?? "normal"}
            type="button"
            className={`rounded-xl py-2.5 text-xs font-semibold ${
              flight === item ? "bg-accent text-ink" : "bg-ink text-white/75 ring-1 ring-line"
            }`}
            onClick={() => applyFlight(item)}
          >
            {flightLabel(item)}
          </button>
        ))}
      </div>
      <p className="mb-5 text-[11px] leading-relaxed text-white/40">
        {flight === "spike"
          ? "상단에서만 씁니다. 빠른 공보다 더 빠르고 궤적이 평평합니다."
          : flight === "fast"
          ? "선수에서 선수로 빠르게 갑니다. 도착한 뒤에는 선수에 붙어 접촉을 유지합니다."
          : flight === "slow"
            ? "선수에게 갈 때 큰 포물선을 그리며 천천히 떨어집니다."
            : "지금처럼 장면 사이에 보통 속도로 이동합니다."}
      </p>

      <p className="mb-1.5 text-xs font-semibold text-white/50">낙하 부채</p>
      <p className="mb-2 text-[11px] leading-relaxed text-white/40">
        다음 장면으로 공이 가는 방향을 부채꼴이 따라갑니다. 선수 원과 겹치면 색이
        합쳐집니다.
      </p>
      <div className="mb-3 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          className={`rounded-xl py-2.5 text-xs font-semibold ${
            !fanOn ? "bg-accent text-ink" : "bg-ink text-white/75 ring-1 ring-line"
          }`}
          onClick={() => applyFanOn(false)}
        >
          없음
        </button>
        <button
          type="button"
          className={`rounded-xl py-2.5 text-xs font-semibold ${
            fanOn ? "bg-accent text-ink" : "bg-ink text-white/75 ring-1 ring-line"
          }`}
          onClick={() => applyFanOn(true)}
        >
          그리기
        </button>
      </div>
      <div className={fanOn ? "mb-4" : "pointer-events-none mb-4 opacity-40"}>
        <div className="mb-2 flex items-end justify-between">
          <label className="text-sm text-white/70">방향</label>
          <p className="text-sm font-semibold tabular-nums">
            {headingDeg}°{headingHint(headingDeg) ? ` · ${headingHint(headingDeg)}` : ""}
          </p>
        </div>
        <input
          type="range"
          className="mb-3 h-2 w-full accent-white"
          min={0}
          max={360}
          step={1}
          value={headingDeg}
          disabled={!fanOn || travelHeading != null}
          onChange={(e) => patchFan({ heading: (Number(e.target.value) * Math.PI) / 180 })}
        />
        <div className="mb-2 flex items-end justify-between">
          <label className="text-sm text-white/70">퍼짐</label>
          <p className="text-sm font-semibold tabular-nums">{spreadDeg}°</p>
        </div>
        <input
          type="range"
          className="mb-3 h-2 w-full accent-white"
          min={Math.round((FAN_SPREAD_MIN * 180) / Math.PI)}
          max={Math.round((FAN_SPREAD_MAX * 180) / Math.PI)}
          step={1}
          value={spreadDeg}
          disabled={!fanOn}
          onChange={(e) => patchFan({ spread: (Number(e.target.value) * Math.PI) / 180 })}
        />
        <div className="mb-2 flex items-end justify-between">
          <label className="text-sm text-white/70">거리</label>
          <p className="text-sm font-semibold tabular-nums">{fan.depth.toFixed(1)}m</p>
        </div>
        <input
          type="range"
          className="h-2 w-full accent-white"
          min={FAN_DEPTH_MIN}
          max={FAN_DEPTH_MAX}
          step={0.5}
          value={fan.depth}
          disabled={!fanOn}
          onChange={(e) => patchFan({ depth: Number(e.target.value) })}
        />
      </div>

      <button
        type="button"
        className="w-full rounded-xl bg-accent py-3 font-semibold text-ink"
        onClick={() => {
          commit(heightValue(), flight, currentFan());
          onClose();
        }}
      >
        확인
      </button>
    </Modal>
  );
}
