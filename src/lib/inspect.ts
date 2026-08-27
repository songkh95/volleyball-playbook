import { TEAM_BLUE, type CourtObject, type CourtType, type LandingFan } from "../types/play";
import { courtMeters, netYNorm } from "./defaultPlay";

export const COVERAGE_MIN = 1.5;
export const COVERAGE_MAX = 4;
export const COVERAGE_DEFAULT = 2.5;

export const FAN_SPREAD_MIN = (24 * Math.PI) / 180;
export const FAN_SPREAD_MAX = (90 * Math.PI) / 180;
export const FAN_DEPTH_MIN = 3;
export const FAN_DEPTH_MAX = 12;

export const HOLE_FLASHES = 5;
export const HOLE_FLASH_MS = 180;

export function coverageRadius(player: CourtObject) {
  const n = player.coverageM ?? COVERAGE_DEFAULT;
  return Math.min(COVERAGE_MAX, Math.max(COVERAGE_MIN, n));
}

export function isOpponent(player: CourtObject) {
  return player.color.toLowerCase() === TEAM_BLUE.toLowerCase();
}

export function defaultCoverageOn(player: CourtObject) {
  if (player.kind !== "player") return false;
  if (player.coverageOn !== undefined) return !!player.coverageOn;
  return !isOpponent(player);
}

export function courtDistM(
  a: { x: number; y: number },
  b: { x: number; y: number },
  court: CourtType,
) {
  const { width, length } = courtMeters(court);
  return Math.hypot((a.x - b.x) * width, (a.y - b.y) * length);
}

/** heading 0은 상대 엔드(+y). 공이 from→to로 가는 각도. */
export function fanHeadingFromTravel(
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.hypot(dx, dy) < 1e-4) return null;
  return Math.atan2(dx, dy);
}

export function fanAlongTravel(
  fan: LandingFan,
  from: { x: number; y: number },
  to: { x: number; y: number },
): LandingFan {
  const heading = fanHeadingFromTravel(from, to);
  if (heading == null) return fan;
  return { ...fan, heading };
}

export function ballsWithTravelFan(
  objects: CourtObject[],
  towardObjects?: CourtObject[],
  fromObjects?: CourtObject[],
): CourtObject[] {
  return objects.map((o) => {
    if (o.kind !== "ball" || !o.fan) return o;
    const next = towardObjects?.find((x) => x.id === o.id && x.kind === "ball");
    if (next) return { ...o, fan: fanAlongTravel(o.fan, o, next) };
    const prev = fromObjects?.find((x) => x.id === o.id && x.kind === "ball");
    if (prev) return { ...o, fan: fanAlongTravel(o.fan, prev, o) };
    return o;
  });
}

export function ballTravelToward(
  cuts: { objects: CourtObject[] }[],
  cutIndex: number,
  ball: { id: string; x: number; y: number },
): { x: number; y: number } | undefined {
  const next = cuts[cutIndex + 1]?.objects.find((o) => o.id === ball.id && o.kind === "ball");
  if (next && Math.hypot(next.x - ball.x, next.y - ball.y) > 1e-4) {
    return { x: next.x, y: next.y };
  }
  const prev = cuts[cutIndex - 1]?.objects.find((o) => o.id === ball.id && o.kind === "ball");
  if (prev && Math.hypot(ball.x - prev.x, ball.y - prev.y) > 1e-4) {
    return {
      x: ball.x + (ball.x - prev.x),
      y: ball.y + (ball.y - prev.y),
    };
  }
  return undefined;
}

export function defaultFan(
  court: CourtType,
  ball?: { x: number; y: number },
  toward?: { x: number; y: number },
): LandingFan {
  const heading = ball && toward ? fanHeadingFromTravel(ball, toward) : null;
  const towardUs = ball != null && ball.y > netYNorm(court);
  return {
    heading: heading ?? (towardUs ? Math.PI : 0),
    spread: (48 * Math.PI) / 180,
    depth: court === "half" ? 4.5 : 7,
  };
}

/** 미터 공간에서 부채꼴 가장자리. heading 0은 상대 엔드(+y). */
export function fanSectorPoints(
  ball: { x: number; y: number },
  fan: LandingFan,
  court: CourtType,
  steps = 28,
) {
  const { width, length } = courtMeters(court);
  const pts: { x: number; y: number }[] = [{ x: ball.x, y: ball.y }];
  const a0 = fan.heading - fan.spread / 2;
  const a1 = fan.heading + fan.spread / 2;
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push({
      x: ball.x + (Math.sin(a) * fan.depth) / width,
      y: ball.y + (Math.cos(a) * fan.depth) / length,
    });
  }
  return pts;
}

export function nudgeFanSpread(fan: LandingFan, deltaDeg: number): LandingFan {
  const next = fan.spread + (deltaDeg * Math.PI) / 180;
  return {
    ...fan,
    spread: Math.min(FAN_SPREAD_MAX, Math.max(FAN_SPREAD_MIN, next)),
  };
}

export function nudgeFanDepth(fan: LandingFan, deltaM: number): LandingFan {
  const next = fan.depth + deltaM;
  return {
    ...fan,
    depth: Math.min(FAN_DEPTH_MAX, Math.max(FAN_DEPTH_MIN, next)),
  };
}

export function nudgeCoverageM(player: CourtObject, delta: number) {
  const next = coverageRadius(player) + delta;
  return Math.min(COVERAGE_MAX, Math.max(COVERAGE_MIN, next));
}

export function withCoverageDefaults<T extends { cuts: { objects: CourtObject[] }[] }>(play: T): T {
  let changed = false;
  const cuts = play.cuts.map((cut) => ({
    ...cut,
    objects: cut.objects.map((o) => {
      if (o.kind !== "player") return o;
      if (o.coverageOn !== undefined) return o;
      changed = true;
      if (isOpponent(o)) return { ...o, coverageOn: false };
      return { ...o, coverageOn: true, coverageM: o.coverageM ?? COVERAGE_DEFAULT };
    }),
  }));
  return changed ? { ...play, cuts } : play;
}
