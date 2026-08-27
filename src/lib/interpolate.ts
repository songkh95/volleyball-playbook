import type { CourtObject, Cut, ObjKind } from "../types/play";
import { interpolateBallPosition } from "./ballFlight";
import { ballsWithTravelFan, fanAlongTravel } from "./inspect";

export type Trail = {
  kind: ObjKind;
  color: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function byId(objects: CourtObject[]) {
  return new Map(objects.map((o) => [o.id, o]));
}

export function interpolateObjects(
  from: CourtObject[],
  to: CourtObject[],
  t: number,
): CourtObject[] {
  const dest = byId(to);
  const seen = new Set<string>();
  const mixed: CourtObject[] = from.map((o) => {
    seen.add(o.id);
    const n = dest.get(o.id);
    if (!n) return o;
    if (o.kind === "ball") {
      const pos = interpolateBallPosition(from, to, t);
      const height =
        o.height != null && n.height != null
          ? lerp(o.height, n.height, t)
          : n.height ?? o.height;
      return {
        ...n,
        x: pos?.x ?? lerp(o.x, n.x, t),
        y: pos?.y ?? lerp(o.y, n.y, t),
        height,
        flight: n.flight ?? o.flight,
        fan: (() => {
          const fanBase = n.fan ?? o.fan;
          if (!fanBase) return undefined;
          return fanAlongTravel(fanBase, o, n);
        })(),
      };
    }
    const height =
      o.height != null && n.height != null
        ? lerp(o.height, n.height, t)
        : n.height ?? o.height;
    return { ...n, x: lerp(o.x, n.x, t), y: lerp(o.y, n.y, t), height };
  });
  for (const o of to) {
    if (!seen.has(o.id)) mixed.push(o);
  }
  return mixed;
}

export function trailsBetween(
  from: CourtObject[],
  to: CourtObject[],
  minDist = 0.012,
): Trail[] {
  const dest = byId(to);
  const trails: Trail[] = [];
  for (const o of from) {
    const n = dest.get(o.id);
    if (!n) continue;
    if (o.kind === "cone" || o.kind === "text") continue;
    if (Math.hypot(n.x - o.x, n.y - o.y) < minDist) continue;
    trails.push({
      kind: o.kind,
      color: n.color,
      x1: o.x,
      y1: o.y,
      x2: n.x,
      y2: n.y,
    });
  }
  return trails;
}

/** playhead: 0 … cuts.length-1 (실수). 컷 사이는 선형 보간. */
export function viewAtPlayhead(cuts: Cut[], playhead: number) {
  const last = Math.max(0, cuts.length - 1);
  const p = Math.min(last, Math.max(0, playhead));
  const activeIndex = Math.min(last, Math.ceil(p - 1e-9));

  if (cuts.length <= 1) {
    return {
      objects: cuts[0]?.objects ?? [],
      trails: [] as Trail[],
      strokes: cuts[0]?.strokes ?? [],
      activeIndex: 0,
    };
  }

  const i = Math.min(last - 1, Math.floor(p));
  const t = p - i;
  const from = cuts[i];
  const to = cuts[i + 1];

  if (t < 0.0005) {
    const prev = i > 0 ? cuts[i - 1] : null;
    return {
      objects: ballsWithTravelFan(from.objects, to.objects, prev?.objects),
      trails: prev ? trailsBetween(prev.objects, from.objects) : [],
      strokes: from.strokes,
      activeIndex,
    };
  }

  const objects = interpolateObjects(from.objects, to.objects, t);
  return {
    objects,
    trails: trailsBetween(from.objects, objects),
    strokes: t < 0.5 ? from.strokes : to.strokes,
    activeIndex,
  };
}

export function cloneCutAfter(cut: Cut, newId: string, name: string): Cut {
  return {
    id: newId,
    name,
    durationMs: 1000,
    objects: cut.objects.map((o) => ({ ...o })),
    strokes: [],
  };
}
