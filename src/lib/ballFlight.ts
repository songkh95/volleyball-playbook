import type { BallFlight, CourtObject, CourtType, Cut } from "../types/play";
import { BALL_RADIUS, NET_HEIGHT, PLAYER_HEIGHT, PLAYER_SPLIT } from "./court3d";
import { courtMeters, netYNorm } from "./defaultPlay";

export type ContactZone = "upper" | "lower" | "air";

export type BallPose = {
  x: number;
  y: number;
  height: number;
  zone: ContactZone;
  playerId: string | null;
  flight?: BallFlight;
};

export const HEIGHT_AIR = 2.15;
export const HEIGHT_LOWER_CONTACT = 0.5;
export const HEIGHT_UPPER_CONTACT =
  PLAYER_SPLIT + (PLAYER_HEIGHT - PLAYER_SPLIT) * 0.55;
export const HEIGHT_MIN = 0.3;
export const HEIGHT_MAX = 2.7;
export const HEIGHT_FLIGHT_MAX = 5.4;

export const FAST_ARRIVE = 0.52;

export type BallHeightBand = "auto" | "lower" | "upper" | "air";

export function bandFromHeight(height: number): Exclude<BallHeightBand, "auto"> {
  if (height < PLAYER_SPLIT) return "lower";
  if (height <= PLAYER_HEIGHT + 0.08) return "upper";
  return "air";
}

export function heightForBand(band: Exclude<BallHeightBand, "auto">) {
  if (band === "lower") return HEIGHT_LOWER_CONTACT;
  if (band === "upper") return HEIGHT_UPPER_CONTACT;
  return HEIGHT_AIR;
}

export function bandLabel(band: BallHeightBand) {
  if (band === "auto") return "자동";
  if (band === "lower") return "하단";
  if (band === "upper") return "상단";
  return "공중";
}

export function flightLabel(flight?: BallFlight | null) {
  if (flight === "fast") return "빠른 공";
  if (flight === "slow") return "느린 공";
  return "보통";
}

export function flightShort(flight?: BallFlight | null) {
  if (flight === "fast") return "빠";
  if (flight === "slow") return "느";
  return null;
}

export function contactZoneFromHeight(height: number): "upper" | "lower" {
  return height < PLAYER_SPLIT ? "lower" : "upper";
}

export function segmentFlight(
  fromBall: CourtObject | null | undefined,
  toBall: CourtObject | null | undefined,
): BallFlight | undefined {
  return fromBall?.flight ?? toBall?.flight;
}

export function ballTravelT(t: number, flight?: BallFlight | null) {
  const u = Math.min(1, Math.max(0, t));
  if (flight === "fast") return Math.min(1, u / FAST_ARRIVE);
  return u;
}

const CONTACT_NORM = 0.12;
const BALL_CLEAR = BALL_RADIUS + 0.12;
const STILL_NORM = 0.012;
const STILL_M = 0.15;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function xyStill(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(b.x - a.x, b.y - a.y) < STILL_NORM;
}

function ballOf(objects: CourtObject[]) {
  return objects.find((o) => o.kind === "ball") ?? null;
}

function nearestPlayer(ball: CourtObject, objects: CourtObject[]) {
  let player: CourtObject | null = null;
  let dist = Infinity;
  for (const o of objects) {
    if (o.kind !== "player") continue;
    const d = Math.hypot(o.x - ball.x, o.y - ball.y);
    if (d < dist) {
      dist = d;
      player = o;
    }
  }
  return { player, dist };
}

function zoneHeight(zone: ContactZone) {
  if (zone === "lower") return HEIGHT_LOWER_CONTACT;
  if (zone === "upper") return HEIGHT_UPPER_CONTACT;
  return HEIGHT_AIR;
}

function geometryZone(ball: CourtObject, court: CourtType, dist: number): ContactZone {
  if (dist > CONTACT_NORM) return "air";
  const my = ball.y * courtMeters(court).length;
  if (Math.abs(my - 9) < 3.2) return "upper";
  return "lower";
}

type CutBall = {
  x: number;
  y: number;
  height: number;
  zone: ContactZone;
  playerId: string | null;
  playerX?: number;
  playerY?: number;
  manual: boolean;
  flight?: BallFlight;
};

function clampHeight(height: number) {
  return Math.max(BALL_RADIUS, Math.min(HEIGHT_FLIGHT_MAX, height));
}

function analyzeObjects(objects: CourtObject[], court: CourtType): CutBall {
  const ball = ballOf(objects);
  if (!ball) {
    return {
      x: 0.5,
      y: 0.2,
      height: HEIGHT_AIR,
      zone: "air",
      playerId: null,
      manual: false,
    };
  }
  const near = nearestPlayer(ball, objects);
  if (ball.height != null) {
    const height = Math.max(BALL_RADIUS, Math.min(HEIGHT_MAX, ball.height));
    const band = bandFromHeight(height);
    const zone: ContactZone = band === "air" ? "air" : contactZoneFromHeight(height);
    const nearEnough = near.dist <= CONTACT_NORM;
    return {
      x: ball.x,
      y: ball.y,
      height,
      zone,
      playerId: nearEnough && zone !== "air" ? near.player?.id ?? null : null,
      playerX: near.player?.x,
      playerY: near.player?.y,
      manual: true,
      flight: ball.flight,
    };
  }
  const zone = geometryZone(ball, court, near.dist);
  return {
    x: ball.x,
    y: ball.y,
    height: zoneHeight(zone),
    zone,
    playerId: zone === "air" ? null : near.player?.id ?? null,
    playerX: near.player?.x,
    playerY: near.player?.y,
    manual: false,
    flight: ball.flight,
  };
}

function analyzeCuts(cuts: Cut[], court: CourtType): CutBall[] {
  return cuts.map((cut) => analyzeObjects(cut.objects, court));
}

function liveContactXY(
  fromObjs: CourtObject[],
  toObjs: CourtObject[],
  toState: CutBall,
  t: number,
) {
  if (!toState.playerId) return { x: toState.x, y: toState.y };
  const pTo = toObjs.find((o) => o.id === toState.playerId && o.kind === "player");
  if (!pTo) return { x: toState.x, y: toState.y };
  const pFrom = fromObjs.find((o) => o.id === toState.playerId && o.kind === "player");
  const liveX = pFrom ? lerp(pFrom.x, pTo.x, t) : pTo.x;
  const liveY = pFrom ? lerp(pFrom.y, pTo.y, t) : pTo.y;
  return {
    x: liveX + (toState.x - pTo.x),
    y: liveY + (toState.y - pTo.y),
  };
}

function passMeters(
  from: CutBall,
  to: CutBall,
  width: number,
  length: number,
) {
  const ax = from.playerX ?? from.x;
  const ay = from.playerY ?? from.y;
  const bx = to.playerX ?? to.x;
  const by = to.playerY ?? to.y;
  return Math.hypot((bx - ax) * width, (by - ay) * length);
}

function distPeakScale(distM: number) {
  return Math.min(1, Math.max(0, (distM - 1.6) / 7.4));
}

function peakAdd(
  from: CutBall,
  to: CutBall,
  distM: number,
  passM: number,
  crossesNet: boolean,
  flight?: BallFlight,
) {
  if (distM < STILL_M) return 0;
  const scale = distPeakScale(passM);
  if (flight === "slow") {
    const peak = 2.4 + scale * 2.0;
    let extra = Math.max(0.2, peak - Math.max(from.height, to.height));
    if (crossesNet) {
      extra = Math.max(extra, NET_HEIGHT + 0.28 - Math.max(from.height, to.height));
    }
    return extra;
  }
  if (flight === "fast") {
    let extra = Math.min(0.18, distM * 0.018);
    if (crossesNet) {
      extra = Math.max(
        extra,
        Math.max(0, NET_HEIGHT + BALL_CLEAR - Math.max(from.height, to.height)),
      );
    }
    return extra;
  }
  if (from.manual || to.manual) {
    let extra = from.manual && to.manual ? Math.min(0.18, distM * 0.012) : Math.min(0.28, distM * 0.02);
    extra *= 0.45 + 0.55 * scale;
    if (crossesNet) {
      extra = Math.max(
        extra,
        Math.max(0, NET_HEIGHT + BALL_CLEAR - Math.max(from.height, to.height)),
      );
    }
    return extra;
  }
  let peak = Math.max(from.height, to.height);
  if (crossesNet) peak = Math.max(peak, NET_HEIGHT + 0.5);
  if (from.zone === "lower" && to.zone === "upper") peak = Math.max(peak, 1.55 + scale * 0.5);
  if (from.zone === "upper" && to.zone === "upper") peak = Math.max(peak, 1.7 + scale * 0.5);
  if (from.zone === "upper" && to.zone === "lower") peak = Math.max(peak, 1.45 + scale * 0.25);
  if (from.zone === "lower" && to.zone === "lower") {
    return Math.min(0.08, distM * 0.012);
  }
  if (from.zone === "air" || to.zone === "air") peak = Math.max(peak, HEIGHT_AIR);
  const extra = Math.max(0, peak - Math.max(from.height, to.height));
  return extra + Math.min(0.45, distM * 0.035) * (0.4 + 0.6 * scale);
}

function heightOnSegment(
  from: CutBall,
  to: CutBall,
  t: number,
  travelT: number,
  court: CourtType,
  flight?: BallFlight,
) {
  const { width, length } = courtMeters(court);
  const distM = Math.hypot((to.x - from.x) * width, (to.y - from.y) * length);
  if (distM < STILL_M) {
    return clampHeight(lerp(from.height, to.height, t));
  }
  const passM = passMeters(from, to, width, length);
  const net = netYNorm(court);
  const crossesNet = (from.y - net) * (to.y - net) < 0;
  let lift = peakAdd(from, to, distM, passM, crossesNet, flight);
  const linearAt = (u: number) => lerp(from.height, to.height, u);
  if (crossesNet) {
    const tNet = (net - from.y) / (to.y - from.y);
    if (tNet > 0.02 && tNet < 0.98) {
      const bump = 4 * tNet * (1 - tNet);
      if (bump > 0.05) {
        const need = NET_HEIGHT + BALL_CLEAR;
        lift = Math.max(lift, (need - linearAt(tNet)) / bump);
      }
    }
  }
  const arcT = flight === "slow" ? t : travelT;
  return clampHeight(linearAt(travelT) + lift * 4 * arcT * (1 - arcT));
}

export function interpolateBallPosition(
  fromObjs: CourtObject[],
  toObjs: CourtObject[],
  t: number,
) {
  const from = ballOf(fromObjs);
  const to = ballOf(toObjs);
  if (!from && !to) return null;
  if (!from || !to) {
    const only = to ?? from;
    return { x: only.x, y: only.y, flight: only.flight };
  }
  if (xyStill(from, to)) {
    return { x: from.x, y: from.y, flight: segmentFlight(from, to) };
  }
  const flight = segmentFlight(from, to);
  const travelT = ballTravelT(t, flight);
  let destX = to.x;
  let destY = to.y;
  if (flight === "fast") {
    const near = nearestPlayer(to, toObjs);
    if (near.player && near.dist <= CONTACT_NORM) {
      const contact = liveContactXY(
        fromObjs,
        toObjs,
        {
          x: to.x,
          y: to.y,
          height: 0,
          zone: "air",
          playerId: near.player.id,
          manual: false,
        },
        t,
      );
      destX = contact.x;
      destY = contact.y;
    }
  }
  return {
    x: lerp(from.x, destX, travelT),
    y: lerp(from.y, destY, travelT),
    flight,
  };
}

export function ballPoseAtPlayhead(
  cuts: Cut[],
  playhead: number,
  court: CourtType,
): BallPose | null {
  if (cuts.length === 0) return null;
  const states = analyzeCuts(cuts, court);
  const last = states.length - 1;
  const p = Math.min(last, Math.max(0, playhead));

  if (states.length === 1 || p >= last - 1e-6) {
    const s = states[Math.min(last, Math.round(p))];
    return { ...s };
  }

  const i = Math.min(last - 1, Math.floor(p));
  const t = p - i;
  const from = states[i];
  const to = states[i + 1];
  if (t <= 0.0005) return { ...from };
  if (t >= 0.9995) return { ...to };

  const flight = from.flight ?? to.flight;
  if (xyStill(from, to)) {
    return {
      x: from.x,
      y: from.y,
      height: lerp(from.height, to.height, t),
      zone: t < 0.5 ? from.zone : to.zone,
      playerId: t < 0.5 ? from.playerId : to.playerId,
      flight,
    };
  }

  const travelT = ballTravelT(t, flight);
  let destX = to.x;
  let destY = to.y;
  if (flight === "fast") {
    const contact = liveContactXY(cuts[i].objects, cuts[i + 1].objects, to, t);
    destX = contact.x;
    destY = contact.y;
  }

  const atDest = travelT >= 0.97;
  const atStart = travelT <= 0.03;
  return {
    x: lerp(from.x, destX, travelT),
    y: lerp(from.y, destY, travelT),
    height: heightOnSegment(from, to, t, travelT, court, flight),
    zone: atDest ? to.zone : atStart ? from.zone : "air",
    playerId: atDest ? to.playerId : atStart ? from.playerId : null,
    flight,
  };
}
