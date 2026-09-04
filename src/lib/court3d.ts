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

export function worldToCourt(x: number, z: number, court: CourtType) {
  const { width, length } = courtMeters(court);
  return {
    x: x / width + 0.5,
    y: 0.5 - z / length,
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

export const GYM_SIZE = { width: 38, length: 52, wallH: 11 } as const;

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

function clampNum(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Ray vs AABB: enter/exit t along a unit direction. Null if the ray misses. */
function rayAabbHit(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): { tmin: number; tmax: number } | null {
  let tmin = -Infinity;
  let tmax = Infinity;
  const axes: [number, number, number, number][] = [
    [ox, dx, minX, maxX],
    [oy, dy, minY, maxY],
    [oz, dz, minZ, maxZ],
  ];
  for (const [o, d, mn, mx] of axes) {
    if (Math.abs(d) < 1e-8) {
      if (o < mn || o > mx) return null;
      continue;
    }
    let t1 = (mn - o) / d;
    let t2 = (mx - o) / d;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return { tmin, tmax };
}

/**
 * Keep the orbit target over the court and the camera inside the gym
 * so pan/orbit cannot clip through walls or leave the scene.
 */
export function clampCameraInGym(
  position: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  court: CourtType,
) {
  const { width, length } = courtMeters(court);
  const tPad = 8;
  const nx = clampNum(target.x, -(width / 2 + tPad), width / 2 + tPad);
  const ny = clampNum(target.y, 0.15, 2.6);
  const nz = clampNum(target.z, -(length / 2 + tPad), length / 2 + tPad);
  position.x -= target.x - nx;
  position.y -= target.y - ny;
  position.z -= target.z - nz;
  target.x = nx;
  target.y = ny;
  target.z = nz;

  const inset = 2.4;
  const minX = -(GYM_SIZE.width / 2 - inset);
  const maxX = GYM_SIZE.width / 2 - inset;
  const minY = 1.2;
  const maxY = GYM_SIZE.wallH - 1.2;
  const minZ = -(GYM_SIZE.length / 2 - inset);
  const maxZ = GYM_SIZE.length / 2 - inset;

  const inside =
    position.x >= minX &&
    position.x <= maxX &&
    position.y >= minY &&
    position.y <= maxY &&
    position.z >= minZ &&
    position.z <= maxZ;
  if (inside) return;

  const ox = target.x;
  const oy = target.y;
  const oz = target.z;
  let dx = position.x - ox;
  let dy = position.y - oy;
  let dz = position.z - oz;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 1e-4) {
    position.x = clampNum(position.x, minX, maxX);
    position.y = clampNum(position.y, minY, maxY);
    position.z = clampNum(position.z, minZ, maxZ);
    return;
  }
  dx /= dist;
  dy /= dist;
  dz /= dist;
  const hit = rayAabbHit(ox, oy, oz, dx, dy, dz, minX, minY, minZ, maxX, maxY, maxZ);
  const t = hit
    ? clampNum(dist, hit.tmin + 0.08, hit.tmax - 0.08)
    : clampNum(dist, 2, 18);
  position.x = ox + dx * t;
  position.y = oy + dy * t;
  position.z = oz + dz * t;
  position.x = clampNum(position.x, minX, maxX);
  position.y = clampNum(position.y, minY, maxY);
  position.z = clampNum(position.z, minZ, maxZ);
}
