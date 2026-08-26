import { courtMeters } from "./defaultPlay";
import type { CourtType } from "../types/play";

export const PLAYER_HEIGHT = 1.85;
export const PLAYER_RADIUS = 0.22;
export const PLAYER_SPLIT = 0.92;
export const BALL_RADIUS = 0.28;
export const NET_HEIGHT = 2.43;
export const NET_BOTTOM = 1.43;

export type CameraCorner = "bl" | "br" | "tl" | "tr";

export type CameraPreset = {
  id: CameraCorner;
  label: string;
};

export function cameraPresets(court: CourtType): CameraPreset[] {
  const bottom: CameraPreset[] = [
    { id: "bl", label: "좌 하단" },
    { id: "br", label: "우 하단" },
  ];
  if (court === "half") return bottom;
  return [
    ...bottom,
    { id: "tl", label: "좌 상단" },
    { id: "tr", label: "우 상단" },
  ];
}

/** 2D 정규화 좌표 → 코트 중심 원점, Y-up 월드. 우리 엔드(y=0)가 +Z. */
export function courtToWorld(nx: number, ny: number, court: CourtType) {
  const { width, length } = courtMeters(court);
  return {
    x: (nx - 0.5) * width,
    z: (0.5 - ny) * length,
  };
}

export function netWorldZ(court: CourtType) {
  const { length } = courtMeters(court);
  return length / 2 - 9;
}

export function shadeHex(hex: string, amount: number) {
  const h = hex.replace("#", "");
  if (h.length < 6) return hex;
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const r = clamp(parseInt(h.slice(0, 2), 16) * (1 + amount));
  const g = clamp(parseInt(h.slice(2, 4), 16) * (1 + amount));
  const b = clamp(parseInt(h.slice(4, 6), 16) * (1 + amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function getCameraPose(preset: CameraCorner, court: CourtType) {
  const { width, length } = courtMeters(court);
  const lift = court === "full" ? 8.2 : 7.2;
  const back = 7.2;
  const side = 5.4;
  const x = preset === "bl" || preset === "tl" ? -(width / 2 + side) : width / 2 + side;
  const z = preset === "bl" || preset === "br" ? length / 2 + back : -(length / 2 + back);
  return {
    position: { x, y: lift, z },
    target: { x: 0, y: 0.4, z: netWorldZ(court) * 0.35 },
  };
}
