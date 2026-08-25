import type { Stroke, StrokeKind } from "../types/play";

export function resolveStrokeKind(stroke: Stroke): StrokeKind {
  if (stroke.kind) return stroke.kind;
  return stroke.arrowhead ? "arrow" : "solid";
}

function distToSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.min(1, Math.max(0, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function strokeNearPoint(
  stroke: Stroke,
  p: { x: number; y: number },
  minDist = 0.028,
) {
  const pts = stroke.points;
  if (pts.length === 0) return false;
  if (pts.length === 1) return Math.hypot(p.x - pts[0].x, p.y - pts[0].y) <= minDist;
  for (let i = 0; i < pts.length - 1; i++) {
    if (distToSegment(p, pts[i], pts[i + 1]) <= minDist) return true;
  }
  return false;
}

export const PEN_COLORS = [
  { value: "#ffffff", label: "흰" },
  { value: "#ffd54f", label: "노랑" },
  { value: "#ef5350", label: "빨강" },
  { value: "#42a5f5", label: "파랑" },
  { value: "#66bb6a", label: "초록" },
  { value: "#e87830", label: "주황" },
] as const;
