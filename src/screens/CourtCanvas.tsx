import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { getBallSprite, loadBallSprite } from "../lib/ballSprite";
import { courtMeters, netYNorm } from "../lib/defaultPlay";
import { isLightColor } from "../lib/colors";
import type { Trail } from "../lib/interpolate";
import { resolveStrokeKind } from "../lib/stroke";
import type {
  CourtObject,
  CourtType,
  EditorTool,
  Stroke,
  StrokeKind,
  ZoneMode,
} from "../types/play";

type CourtRect = { x: number; y: number; w: number; h: number };

const COURT_FIT = 0.86;
const LASER_MS = 1300;

type LaserMark = {
  points: { x: number; y: number }[];
  color: string;
  kind: StrokeKind;
  born: number;
};

function startLaserLoop(
  rafRef: { current: number },
  lasersRef: { current: LaserMark[] },
  paint: () => void,
) {
  if (rafRef.current) return;
  const tick = () => {
    const now = performance.now();
    lasersRef.current = lasersRef.current.filter((item) => now - item.born < LASER_MS);
    paint();
    if (lasersRef.current.length > 0) {
      rafRef.current = window.requestAnimationFrame(tick);
    } else {
      rafRef.current = 0;
    }
  };
  rafRef.current = window.requestAnimationFrame(tick);
}

export type CourtCanvasHandle = {
  toPngBlob: () => Promise<Blob>;
};

type Props = {
  court: CourtType;
  objects: CourtObject[];
  trails?: Trail[];
  strokes?: Stroke[];
  zoneMode?: ZoneMode;
  tool?: EditorTool;
  drawColor?: string;
  drawKind?: StrokeKind;
  interactive?: boolean;
  onMove: (id: string, x: number, y: number) => void;
  onMoveBegin?: () => void;
  onSelectPlayer: (id: string) => void;
  onPointerStart?: () => void;
  onStrokeEnd?: (
    points: { x: number; y: number }[],
    style: { color: string; kind: StrokeKind },
  ) => void;
  onEraseBegin?: () => void;
  onEraseAt?: (x: number, y: number) => void;
};

export const CourtCanvas = forwardRef<CourtCanvasHandle, Props>(function CourtCanvas(
  {
    court,
    objects,
    trails = [],
    strokes = [],
    zoneMode = "none",
    tool = "select",
    drawColor = "#ffffff",
    drawKind = "arrow",
    interactive = true,
    onMove,
    onMoveBegin,
    onSelectPlayer,
    onPointerStart,
    onStrokeEnd,
    onEraseBegin,
    onEraseAt,
  },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const objectsRef = useRef(objects);
  const trailsRef = useRef(trails);
  const strokesRef = useRef(strokes);
  const zoneRef = useRef(zoneMode);
  const courtRef = useRef(court);
  const toolRef = useRef(tool);
  const drawColorRef = useRef(drawColor);
  const drawKindRef = useRef(drawKind);
  const interactiveRef = useRef(interactive);
  const rectRef = useRef<CourtRect>({ x: 0, y: 0, w: 1, h: 1 });
  const dragRef = useRef<{
    id: string;
    moved: boolean;
    x: number;
    y: number;
  } | null>(null);
  const penRef = useRef<{
    points: { x: number; y: number }[];
    laser: boolean;
    color: string;
    kind: StrokeKind;
  } | null>(null);
  const livePenRef = useRef<{ x: number; y: number }[]>([]);
  const liveStyleRef = useRef<{ color: string; kind: StrokeKind; laser: boolean }>({
    color: drawColor,
    kind: drawKind,
    laser: false,
  });
  const eraseRef = useRef(false);
  const lasersRef = useRef<LaserMark[]>([]);
  const laserRafRef = useRef(0);
  const ballSpinRef = useRef(new Map<string, number>());
  const lastBallPosRef = useRef(new Map<string, { x: number; y: number }>());

  objectsRef.current = objects;
  trailsRef.current = trails;
  strokesRef.current = strokes;
  zoneRef.current = zoneMode;
  courtRef.current = court;
  toolRef.current = tool;
  drawColorRef.current = drawColor;
  drawKindRef.current = drawKind;
  interactiveRef.current = interactive;

  const paint = useRef(() => {});

  paint.current = () => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = wrap.clientWidth;
    const cssH = wrap.clientHeight;
    const pixelW = Math.max(1, Math.floor(cssW * dpr));
    const pixelH = Math.max(1, Math.floor(cssH * dpr));
    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW;
      canvas.height = pixelH;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const meters = courtMeters(courtRef.current);
    const scale = Math.min(cssW / meters.width, cssH / meters.length) * COURT_FIT;
    const w = meters.width * scale;
    const h = meters.length * scale;
    const x = (cssW - w) / 2;
    const y = (cssH - h) / 2;
    rectRef.current = { x, y, w, h };

    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, cssW, cssH);
    drawCourt(ctx, rectRef.current, courtRef.current);
    drawZones(ctx, rectRef.current, courtRef.current, zoneRef.current);
    for (const stroke of strokesRef.current) {
      const kind = resolveStrokeKind(stroke);
      drawStroke(ctx, rectRef.current, stroke.points, {
        color: stroke.color || "#ffffff",
        kind,
        width: stroke.width,
      });
    }
    if (livePenRef.current.length > 1) {
      drawStroke(ctx, rectRef.current, livePenRef.current, {
        color: liveStyleRef.current.color,
        kind: liveStyleRef.current.kind,
        glow: liveStyleRef.current.laser,
      });
    }
    const now = performance.now();
    for (const laser of lasersRef.current) {
      const t = (now - laser.born) / LASER_MS;
      if (t >= 1) continue;
      drawStroke(ctx, rectRef.current, laser.points, {
        color: laser.color,
        kind: laser.kind,
        alpha: 1 - t,
        glow: true,
      });
    }
    for (const trail of trailsRef.current) {
      drawTrail(ctx, rectRef.current, trail);
    }
    for (const obj of objectsRef.current) {
      drawObject(ctx, rectRef.current, obj, ballSpinRef.current, lastBallPosRef.current);
    }
  };

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => paint.current());
    ro.observe(wrap);
    loadBallSprite(() => paint.current());
    paint.current();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    paint.current();
  }, [objects, court, trails, strokes, zoneMode, drawColor, drawKind]);

  useEffect(() => {
    return () => {
      if (laserRafRef.current) window.cancelAnimationFrame(laserRafRef.current);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    toPngBlob() {
      paint.current();
      const canvas = canvasRef.current;
      if (!canvas) {
        return Promise.reject(new Error("코트를 캡처할 수 없습니다."));
      }
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("캡처에 실패했습니다."));
        }, "image/png");
      });
    },
  }));

  return (
    <div
      ref={wrapRef}
      className="relative h-full min-h-0 w-full touch-none overscroll-none"
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none"
        onPointerDown={(e) => {
          onPointerStart?.();
          if (!interactiveRef.current) return;
          const canvas = canvasRef.current;
          if (!canvas) return;
          canvas.setPointerCapture(e.pointerId);
          const toolNow = toolRef.current;
          if (toolNow === "eraser") {
            eraseRef.current = true;
            onEraseBegin?.();
            const p = clampToCanvas(clientToNorm(e, canvas, rectRef.current), rectRef.current, canvas);
            onEraseAt?.(p.x, p.y);
            e.preventDefault();
            return;
          }
          if (toolNow === "pen" || toolNow === "laser") {
            const p = clientToNorm(e, canvas, rectRef.current);
            const color = drawColorRef.current;
            const kind = drawKindRef.current;
            const laser = toolNow === "laser";
            penRef.current = { points: [p], laser, color, kind };
            livePenRef.current = [p];
            liveStyleRef.current = { color, kind, laser };
            paint.current();
            e.preventDefault();
            return;
          }
          const hit = hitTest(e, canvas, rectRef.current, objectsRef.current);
          if (!hit) return;
          dragRef.current = { id: hit.id, moved: false, x: e.clientX, y: e.clientY };
          e.preventDefault();
        }}
        onPointerMove={(e) => {
          if (!interactiveRef.current) return;
          const canvas = canvasRef.current;
          if (!canvas) return;
          if (eraseRef.current) {
            const p = clampToCanvas(clientToNorm(e, canvas, rectRef.current), rectRef.current, canvas);
            onEraseAt?.(p.x, p.y);
            e.preventDefault();
            return;
          }
          if (penRef.current) {
            const p = clampToCanvas(clientToNorm(e, canvas, rectRef.current), rectRef.current, canvas);
            const last = penRef.current.points[penRef.current.points.length - 1];
            if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.004) {
              penRef.current.points.push(p);
              livePenRef.current = penRef.current.points;
              paint.current();
            }
            e.preventDefault();
            return;
          }
          const drag = dragRef.current;
          if (!drag) return;
          if (!drag.moved) {
            const dist = Math.hypot(e.clientX - drag.x, e.clientY - drag.y);
            if (dist < 8) {
              e.preventDefault();
              return;
            }
            drag.moved = true;
            onMoveBegin?.();
          }
          const p = clampToCanvas(clientToNorm(e, canvas, rectRef.current), rectRef.current, canvas);
          onMove(drag.id, p.x, p.y);
          e.preventDefault();
        }}
        onPointerUp={(e) => {
          if (eraseRef.current) {
            eraseRef.current = false;
            e.preventDefault();
            return;
          }
          if (penRef.current) {
            const stroke = penRef.current;
            penRef.current = null;
            livePenRef.current = [];
            if (stroke.laser) {
              if (stroke.points.length >= 2) {
                lasersRef.current = [
                  ...lasersRef.current,
                  {
                    points: stroke.points,
                    color: stroke.color,
                    kind: stroke.kind,
                    born: performance.now(),
                  },
                ];
                startLaserLoop(laserRafRef, lasersRef, () => paint.current());
              }
              paint.current();
            } else {
              paint.current();
              if (stroke.points.length >= 2) onStrokeEnd?.(stroke.points, { color: stroke.color, kind: stroke.kind });
            }
            e.preventDefault();
            return;
          }
          const drag = dragRef.current;
          dragRef.current = null;
          if (!drag) return;
          if (!drag.moved) {
            const obj = objectsRef.current.find((o) => o.id === drag.id);
            if (obj?.kind === "player") onSelectPlayer(obj.id);
          }
          e.preventDefault();
        }}
        onPointerCancel={() => {
          dragRef.current = null;
          eraseRef.current = false;
          penRef.current = null;
          livePenRef.current = [];
          paint.current();
        }}
      />
    </div>
  );
});

function clientToNorm(
  e: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
  rect: CourtRect,
) {
  const box = canvas.getBoundingClientRect();
  const px = e.clientX - box.left;
  const py = e.clientY - box.top;
  return {
    x: (px - rect.x) / rect.w,
    y: 1 - (py - rect.y) / rect.h,
  };
}

function clampToCanvas(
  p: { x: number; y: number },
  rect: CourtRect,
  canvas: HTMLCanvasElement,
) {
  const pad = 8;
  const minX = (pad - rect.x) / rect.w;
  const maxX = (canvas.clientWidth - pad - rect.x) / rect.w;
  const yTop = 1 - (pad - rect.y) / rect.h;
  const yBot = 1 - (canvas.clientHeight - pad - rect.y) / rect.h;
  const minY = Math.min(yTop, yBot);
  const maxY = Math.max(yTop, yBot);
  return {
    x: Math.min(maxX, Math.max(minX, p.x)),
    y: Math.min(maxY, Math.max(minY, p.y)),
  };
}

function hitTest(
  e: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
  rect: CourtRect,
  objects: CourtObject[],
): CourtObject | null {
  const box = canvas.getBoundingClientRect();
  const px = e.clientX - box.left;
  const py = e.clientY - box.top;
  let best: CourtObject | null = null;
  let bestD = Infinity;
  for (const obj of objects) {
    const p = objectScreen(rect, obj);
    const r = obj.kind === "ball" ? Math.min(rect.w, rect.h) * 0.035 : Math.min(rect.w, rect.h) * 0.055;
    const d = Math.hypot(px - p.x, py - p.y);
    if (d <= r * 1.35 && d < bestD) {
      best = obj;
      bestD = d;
    }
  }
  return best;
}

function objectScreen(rect: CourtRect, obj: { x: number; y: number }) {
  return {
    x: rect.x + obj.x * rect.w,
    y: rect.y + (1 - obj.y) * rect.h,
  };
}

function drawCourt(
  ctx: CanvasRenderingContext2D,
  rect: CourtRect,
  court: CourtType,
) {
  const { x, y, w, h } = rect;
  const meters = courtMeters(court);
  const sy = h / meters.length;

  ctx.fillStyle = "#e87830";
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(2, w * 0.008);
  ctx.strokeRect(x, y, w, h);

  const netFromBottom = 9;
  const netY = y + h - netFromBottom * sy;

  ctx.beginPath();
  ctx.moveTo(x, netY);
  ctx.lineTo(x + w, netY);
  ctx.stroke();

  const attackOurs = y + h - 6 * sy;
  ctx.setLineDash([w * 0.03, w * 0.02]);
  ctx.beginPath();
  ctx.moveTo(x, attackOurs);
  ctx.lineTo(x + w, attackOurs);
  ctx.stroke();

  if (court === "full") {
    const attackOpp = y + h - 12 * sy;
    ctx.beginPath();
    ctx.moveTo(x, attackOpp);
    ctx.lineTo(x + w, attackOpp);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawZones(
  ctx: CanvasRenderingContext2D,
  rect: CourtRect,
  court: CourtType,
  mode: ZoneMode,
) {
  if (mode === "none") return;
  const net = netYNorm(court);
  let cols = 3;
  let rows = 3;
  let grid: (string | number)[][] = [];

  if (mode === "split-tb") {
    cols = 1;
    rows = 2;
    grid = [[2], [1]];
  } else if (mode === "split-lr") {
    cols = 2;
    rows = 1;
    grid = [[1, 2]];
  } else if (mode === "6") {
    cols = 3;
    rows = 2;
    grid = [
      [5, 6, 1],
      [4, 3, 2],
    ];
  } else {
    cols = 3;
    rows = 3;
    grid = [
      [5, 6, 1],
      [7, 8, 9],
      [4, 3, 2],
    ];
  }

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = c / cols;
      const x1 = (c + 1) / cols;
      const y0 = (r / rows) * net;
      const y1 = ((r + 1) / rows) * net;
      const a = objectScreen(rect, { x: x0, y: y0 });
      const b = objectScreen(rect, { x: x1, y: y1 });
      const left = Math.min(a.x, b.x);
      const top = Math.min(a.y, b.y);
      const w = Math.abs(b.x - a.x);
      const h = Math.abs(b.y - a.y);
      ctx.strokeRect(left, top, w, h);
      const n = grid[r][c];
      ctx.font = `700 ${Math.max(18, Math.min(w, h) * 0.42)}px system-ui, sans-serif`;
      ctx.fillText(String(n), left + w / 2, top + h / 2);
    }
  }
  ctx.restore();
}

function drawPolyline(
  ctx: CanvasRenderingContext2D,
  rect: CourtRect,
  points: { x: number; y: number }[],
) {
  if (points.length < 2) return;
  ctx.beginPath();
  const first = objectScreen(rect, points[0]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    const p = objectScreen(rect, points[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  rect: CourtRect,
  points: { x: number; y: number }[],
  color: string,
) {
  if (points.length < 2) return;
  const a = objectScreen(rect, points[points.length - 2]);
  const b = objectScreen(rect, points[points.length - 1]);
  const size = Math.min(rect.w, rect.h);
  const head = Math.max(8, size * 0.035);
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(
    b.x - head * Math.cos(angle - 0.45),
    b.y - head * Math.sin(angle - 0.45),
  );
  ctx.lineTo(
    b.x - head * Math.cos(angle + 0.45),
    b.y - head * Math.sin(angle + 0.45),
  );
  ctx.closePath();
  ctx.fill();
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  rect: CourtRect,
  points: { x: number; y: number }[],
  style: {
    color: string;
    kind: StrokeKind;
    width?: number;
    alpha?: number;
    glow?: boolean;
  },
) {
  if (points.length < 2) return;
  const size = Math.min(rect.w, rect.h);
  const color = style.color || "#ffffff";
  ctx.save();
  ctx.globalAlpha = style.alpha ?? 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(
    2,
    size * (style.width ?? (style.glow ? 0.014 : style.kind === "dashed" ? 0.009 : 0.011)),
  );
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (style.kind === "dashed") ctx.setLineDash([size * 0.034, size * 0.022]);
  if (style.glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 0.045;
  }
  drawPolyline(ctx, rect, points);
  ctx.setLineDash([]);
  if (style.kind === "arrow") drawArrowHead(ctx, rect, points, color);
  ctx.restore();
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  rect: CourtRect,
  trail: Trail,
) {
  const a = objectScreen(rect, { x: trail.x1, y: trail.y1 });
  const b = objectScreen(rect, { x: trail.x2, y: trail.y2 });
  const color = trail.color || (trail.kind === "ball" ? "#ffd54f" : "#ffffff");
  const size = Math.min(rect.w, rect.h);
  const head = Math.max(8, size * 0.035);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, size * 0.008);
  ctx.setLineDash([size * 0.028, size * 0.02]);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);

  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(
    b.x - head * Math.cos(angle - 0.45),
    b.y - head * Math.sin(angle - 0.45),
  );
  ctx.lineTo(
    b.x - head * Math.cos(angle + 0.45),
    b.y - head * Math.sin(angle + 0.45),
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawObject(
  ctx: CanvasRenderingContext2D,
  rect: CourtRect,
  obj: CourtObject,
  ballSpin: Map<string, number>,
  lastBallPos: Map<string, { x: number; y: number }>,
) {
  const p = objectScreen(rect, obj);
  const size = Math.min(rect.w, rect.h);

  if (obj.kind === "ball") {
    const r = size * 0.038;
    const last = lastBallPos.get(obj.id);
    let spin = ballSpin.get(obj.id) ?? 0;
    if (last) {
      const dist = Math.hypot(obj.x - last.x, obj.y - last.y);
      const distPx = dist * size;
      if (distPx > 0.4 && dist < 0.35) {
        spin += distPx / Math.max(6, r * 0.72);
        ballSpin.set(obj.id, spin);
      }
    }
    lastBallPos.set(obj.id, { x: obj.x, y: obj.y });
    drawBall(ctx, p.x, p.y, r, spin, obj.color);
    return;
  }

  const r = size * 0.048;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = obj.color;
  ctx.fill();

  ctx.fillStyle = isLightColor(obj.color) ? "#1a1a2e" : "#ffffff";
  ctx.font = `700 ${Math.max(9, r * 0.72)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(obj.label.slice(0, 4), p.x, p.y);
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  spin: number,
  fallbackColor: string,
) {
  const sprite = getBallSprite();
  if (!sprite) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fallbackColor;
    ctx.fill();
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(sprite, -r, -r, r * 2, r * 2);
  ctx.restore();
}
