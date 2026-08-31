import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { getBallSprite, loadBallSprite } from "../lib/ballSprite";
import { getConeSprite, loadConeSprite } from "../lib/coneSprite";
import { courtMeters, netYNorm } from "../lib/defaultPlay";
import { coverageRadius, defaultCoverageOn, fanSectorPoints } from "../lib/inspect";
import { zoneCells } from "../lib/zones";
import { isLightColor } from "../lib/colors";
import { COURT_FILL, COURT_LINE, LABEL_ON_LIGHT, STAGE_BG } from "../design/tokens";
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

const COURT_FIT = 0.82;
const LASER_MS = 1300;
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 4;

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

export type CourtViewSnap = {
  objects: CourtObject[];
  trails: Trail[];
  strokes: Stroke[];
};

export type CourtCanvasHandle = {
  toPngBlob: () => Promise<Blob>;
  captureViews: (views: CourtViewSnap[]) => Promise<ImageData[]>;
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
  showCoverage?: boolean;
  holeAlpha?: number;
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
    showCoverage = false,
    holeAlpha = 0,
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
  const showCoverageRef = useRef(showCoverage);
  const holeAlphaRef = useRef(holeAlpha);
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
  const zoomRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{
    dist: number;
    scale: number;
    tx: number;
    ty: number;
  } | null>(null);
  const panRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const pinchUsedRef = useRef(false);
  const lastTapRef = useRef({ t: 0, x: 0, y: 0 });

  objectsRef.current = objects;
  trailsRef.current = trails;
  strokesRef.current = strokes;
  zoneRef.current = zoneMode;
  courtRef.current = court;
  toolRef.current = tool;
  drawColorRef.current = drawColor;
  drawKindRef.current = drawKind;
  interactiveRef.current = interactive;
  showCoverageRef.current = showCoverage;
  holeAlphaRef.current = holeAlpha;

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
    rectRef.current = paintScene(
      ctx,
      cssW,
      cssH,
      zoomRef.current,
      {
        court: courtRef.current,
        objects: objectsRef.current,
        trails: trailsRef.current,
        strokes: strokesRef.current,
        zoneMode: zoneRef.current,
        livePen: livePenRef.current,
        liveStyle: liveStyleRef.current,
        lasers: lasersRef.current,
        now: performance.now(),
        showCoverage: showCoverageRef.current,
        holeAlpha: holeAlphaRef.current,
      },
      ballSpinRef.current,
      lastBallPosRef.current,
    );
  };

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => paint.current());
    ro.observe(wrap);
    loadBallSprite(() => paint.current());
    loadConeSprite(() => paint.current());
    paint.current();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    paint.current();
  }, [objects, court, trails, strokes, zoneMode, drawColor, drawKind, showCoverage, holeAlpha]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const box = canvas.getBoundingClientRect();
      const cx = e.clientX - box.left;
      const cy = e.clientY - box.top;
      const prev = zoomRef.current;
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      const nextScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.scale * factor));
      const wx = (cx - prev.tx) / prev.scale;
      const wy = (cy - prev.ty) / prev.scale;
      zoomRef.current = clampZoom(
        {
          scale: nextScale,
          tx: cx - wx * nextScale,
          ty: cy - wy * nextScale,
        },
        wrap.clientWidth,
        wrap.clientHeight,
      );
      paint.current();
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, []);

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
    async captureViews(views) {
      const wrap = wrapRef.current;
      if (!wrap || wrap.clientWidth < 8 || wrap.clientHeight < 8) {
        throw new Error("코트를 캡처할 수 없습니다.");
      }
      await waitForBallSprite();
      await waitForConeSprite();
      const srcW = wrap.clientWidth;
      const srcH = wrap.clientHeight;
      const scale = Math.min(1, 360 / srcW);
      const w = Math.max(1, Math.round(srcW * scale));
      const h = Math.max(1, Math.round(srcH * scale));
      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const ctx = off.getContext("2d", { alpha: false });
      if (!ctx) throw new Error("코트를 캡처할 수 없습니다.");
      const ballSpin = new Map<string, number>();
      const lastBallPos = new Map<string, { x: number; y: number }>();
      const frames: ImageData[] = [];
      const zoom = { scale: 1, tx: 0, ty: 0 };
      for (let i = 0; i < views.length; i++) {
        const view = views[i];
        paintScene(
          ctx,
          w,
          h,
          zoom,
          {
            court: courtRef.current,
            objects: view.objects,
            trails: view.trails,
            strokes: view.strokes,
            zoneMode: zoneRef.current,
            livePen: [],
            liveStyle: liveStyleRef.current,
            lasers: [],
            now: 0,
            showCoverage: showCoverageRef.current,
            holeAlpha: holeAlphaRef.current,
          },
          ballSpin,
          lastBallPos,
        );
        frames.push(ctx.getImageData(0, 0, w, h));
        if (i % 2 === 1) await yieldFrame();
      }
      return frames;
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
          const canvas = canvasRef.current;
          const wrap = wrapRef.current;
          if (!canvas || !wrap) return;
          pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          canvas.setPointerCapture(e.pointerId);
          if (pointersRef.current.size >= 2) {
            pinchUsedRef.current = true;
            dragRef.current = null;
            eraseRef.current = false;
            penRef.current = null;
            livePenRef.current = [];
            panRef.current = null;
            const pts = [...pointersRef.current.values()];
            pinchRef.current = {
              dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
              scale: zoomRef.current.scale,
              tx: zoomRef.current.tx,
              ty: zoomRef.current.ty,
            };
            paint.current();
            e.preventDefault();
            return;
          }
          if (!interactiveRef.current) return;
          const toolNow = toolRef.current;
          const hit = hitTest(e, canvas, rectRef.current, objectsRef.current, zoomRef.current);
          if (zoomRef.current.scale > 1.001 && toolNow === "select" && !hit) {
            panRef.current = {
              x: e.clientX,
              y: e.clientY,
              tx: zoomRef.current.tx,
              ty: zoomRef.current.ty,
            };
            e.preventDefault();
            return;
          }
          if (toolNow === "eraser") {
            eraseRef.current = true;
            onEraseBegin?.();
            const p = clampToCanvas(
              clientToNorm(e, canvas, rectRef.current, zoomRef.current),
              rectRef.current,
              canvas,
            );
            onEraseAt?.(p.x, p.y);
            e.preventDefault();
            return;
          }
          if (toolNow === "pen" || toolNow === "laser") {
            const p = clientToNorm(e, canvas, rectRef.current, zoomRef.current);
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
          if (!hit) return;
          dragRef.current = { id: hit.id, moved: false, x: e.clientX, y: e.clientY };
          e.preventDefault();
        }}
        onPointerMove={(e) => {
          const canvas = canvasRef.current;
          const wrap = wrapRef.current;
          if (!canvas || !wrap) return;
          if (pointersRef.current.has(e.pointerId)) {
            pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          }
          if (pinchRef.current && pointersRef.current.size >= 2) {
            const pts = [...pointersRef.current.values()];
            const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
            const start = pinchRef.current;
            const nextScale = Math.min(
              MAX_ZOOM,
              Math.max(MIN_ZOOM, start.scale * (dist / start.dist)),
            );
            const box = canvas.getBoundingClientRect();
            const cx = (pts[0].x + pts[1].x) / 2 - box.left;
            const cy = (pts[0].y + pts[1].y) / 2 - box.top;
            const wx = (cx - start.tx) / start.scale;
            const wy = (cy - start.ty) / start.scale;
            zoomRef.current = clampZoom(
              {
                scale: nextScale,
                tx: cx - wx * nextScale,
                ty: cy - wy * nextScale,
              },
              wrap.clientWidth,
              wrap.clientHeight,
            );
            paint.current();
            e.preventDefault();
            return;
          }
          if (panRef.current) {
            zoomRef.current = clampZoom(
              {
                scale: zoomRef.current.scale,
                tx: panRef.current.tx + e.clientX - panRef.current.x,
                ty: panRef.current.ty + e.clientY - panRef.current.y,
              },
              wrap.clientWidth,
              wrap.clientHeight,
            );
            paint.current();
            e.preventDefault();
            return;
          }
          if (!interactiveRef.current) return;
          if (eraseRef.current) {
            const p = clampToCanvas(
              clientToNorm(e, canvas, rectRef.current, zoomRef.current),
              rectRef.current,
              canvas,
            );
            onEraseAt?.(p.x, p.y);
            e.preventDefault();
            return;
          }
          if (penRef.current) {
            const p = clampToCanvas(
              clientToNorm(e, canvas, rectRef.current, zoomRef.current),
              rectRef.current,
              canvas,
            );
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
          const p = clampToCanvas(
            clientToNorm(e, canvas, rectRef.current, zoomRef.current),
            rectRef.current,
            canvas,
          );
          onMove(drag.id, p.x, p.y);
          e.preventDefault();
        }}
        onPointerUp={(e) => {
          pointersRef.current.delete(e.pointerId);
          if (pointersRef.current.size < 2) pinchRef.current = null;
          if (pointersRef.current.size === 0) {
            const pinched = pinchUsedRef.current;
            pinchUsedRef.current = false;
            panRef.current = null;
            if (pinched) {
              e.preventDefault();
              return;
            }
          }
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
          if (drag) {
            if (!drag.moved) {
              const obj = objectsRef.current.find((o) => o.id === drag.id);
              if (obj) onSelectPlayer(obj.id);
            }
            e.preventDefault();
            return;
          }
          if (pointersRef.current.size === 0) {
            if (
              performance.now() - lastTapRef.current.t < 280 &&
              Math.hypot(e.clientX - lastTapRef.current.x, e.clientY - lastTapRef.current.y) < 28
            ) {
              zoomRef.current = { scale: 1, tx: 0, ty: 0 };
              lastTapRef.current.t = 0;
              paint.current();
            } else {
              lastTapRef.current = { t: performance.now(), x: e.clientX, y: e.clientY };
            }
          }
          e.preventDefault();
        }}
        onPointerCancel={(e) => {
          pointersRef.current.delete(e.pointerId);
          pinchRef.current = null;
          panRef.current = null;
          pinchUsedRef.current = false;
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

type Zoom = { scale: number; tx: number; ty: number };

type Scene = {
  court: CourtType;
  objects: CourtObject[];
  trails: Trail[];
  strokes: Stroke[];
  zoneMode: ZoneMode;
  livePen: { x: number; y: number }[];
  liveStyle: { color: string; kind: StrokeKind; laser: boolean };
  lasers: LaserMark[];
  now: number;
  showCoverage: boolean;
  holeAlpha: number;
};

function paintScene(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  zoom: Zoom,
  scene: Scene,
  ballSpin: Map<string, number>,
  lastBallPos: Map<string, { x: number; y: number }>,
): CourtRect {
  ctx.fillStyle = STAGE_BG;
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.save();
  ctx.translate(zoom.tx, zoom.ty);
  ctx.scale(zoom.scale, zoom.scale);

  const meters = courtMeters(scene.court);
  const scale = Math.min(cssW / meters.width, cssH / meters.length) * COURT_FIT;
  const w = meters.width * scale;
  const h = meters.length * scale;
  const rect: CourtRect = {
    x: (cssW - w) / 2,
    y: (cssH - h) / 2,
    w,
    h,
  };

  drawCourt(ctx, rect, scene.court);
  drawZones(ctx, rect, scene.court, scene.zoneMode);
  for (const stroke of scene.strokes) {
    const kind = resolveStrokeKind(stroke);
    drawStroke(ctx, rect, stroke.points, {
      color: stroke.color || "#ffffff",
      kind,
      width: stroke.width,
    });
  }
  if (scene.livePen.length > 1) {
    drawStroke(ctx, rect, scene.livePen, {
      color: scene.liveStyle.color,
      kind: scene.liveStyle.kind,
      glow: scene.liveStyle.laser,
    });
  }
  for (const laser of scene.lasers) {
    const t = (scene.now - laser.born) / LASER_MS;
    if (t >= 1) continue;
    drawStroke(ctx, rect, laser.points, {
      color: laser.color,
      kind: laser.kind,
      alpha: 1 - t,
      glow: true,
    });
  }
  for (const trail of scene.trails) {
    drawTrail(ctx, rect, trail);
  }
  if (scene.showCoverage) {
    for (const obj of scene.objects) {
      drawCoverage(ctx, rect, obj, scene.court);
    }
  }
  for (const obj of scene.objects) {
    if (obj.kind === "ball" && obj.fan) {
      drawFan(ctx, rect, obj, obj.fan, scene.court);
    }
  }
  drawCoverageHoles(ctx, rect, scene.objects, scene.court, scene.holeAlpha);
  for (const obj of scene.objects) {
    drawObject(ctx, rect, obj, ballSpin, lastBallPos);
  }
  ctx.restore();
  return rect;
}

function waitForConeSprite() {
  return new Promise<void>((resolve) => {
    if (getConeSprite("#ef6c00")) {
      resolve();
      return;
    }
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    loadConeSprite(done);
    window.setTimeout(done, 400);
  });
}

function waitForBallSprite() {
  return new Promise<void>((resolve) => {
    if (getBallSprite()) {
      resolve();
      return;
    }
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    loadBallSprite(done);
    window.setTimeout(done, 400);
  });
}

function yieldFrame() {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    window.setTimeout(resolve, 0);
  });
}

function clampZoom(z: Zoom, cssW: number, cssH: number): Zoom {
  const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z.scale));
  if (Math.abs(scale - 1) < 0.001) return { scale: 1, tx: 0, ty: 0 };
  if (scale < 1) {
    return {
      scale,
      tx: (cssW * (1 - scale)) / 2,
      ty: (cssH * (1 - scale)) / 2,
    };
  }
  return {
    scale,
    tx: Math.min(0, Math.max(cssW - cssW * scale, z.tx)),
    ty: Math.min(0, Math.max(cssH - cssH * scale, z.ty)),
  };
}

function clientToNorm(
  e: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
  rect: CourtRect,
  zoom: Zoom,
) {
  const box = canvas.getBoundingClientRect();
  const px = (e.clientX - box.left - zoom.tx) / zoom.scale;
  const py = (e.clientY - box.top - zoom.ty) / zoom.scale;
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
  zoom: Zoom,
): CourtObject | null {
  const box = canvas.getBoundingClientRect();
  const px = (e.clientX - box.left - zoom.tx) / zoom.scale;
  const py = (e.clientY - box.top - zoom.ty) / zoom.scale;
  let best: CourtObject | null = null;
  let bestD = Infinity;
  for (const obj of objects) {
    const p = objectScreen(rect, obj);
    if (obj.kind === "text") {
      const fontPx = textFontPx(rect, obj);
      const w = Math.max(fontPx, (obj.label || "텍스트").length * fontPx * 0.58);
      const h = fontPx * 1.3;
      const dx = px - p.x;
      const dy = py - p.y;
      if (Math.abs(dx) <= w * 0.58 && Math.abs(dy) <= h * 0.58) {
        const d = Math.hypot(dx, dy);
        if (d < bestD) {
          best = obj;
          bestD = d;
        }
      }
      continue;
    }
    const r =
      obj.kind === "ball"
        ? Math.min(rect.w, rect.h) * 0.07
        : obj.kind === "cone"
          ? Math.min(rect.w, rect.h) * 0.065
          : Math.min(rect.w, rect.h) * 0.055;
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

function hexAlpha(hex: string, a: number) {
  const h = hex.replace("#", "");
  if (h.length < 6) return `rgba(255,255,255,${a})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function drawCoverage(
  ctx: CanvasRenderingContext2D,
  rect: CourtRect,
  obj: CourtObject,
  court: CourtType,
) {
  if (obj.kind !== "player" || !defaultCoverageOn(obj)) return;
  const { width, length } = courtMeters(court);
  const r = coverageRadius(obj);
  const p = objectScreen(rect, obj);
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, (r / width) * rect.w, (r / length) * rect.h, 0, 0, Math.PI * 2);
  ctx.fillStyle = hexAlpha(obj.color, 0.28);
  ctx.fill();
  ctx.strokeStyle = hexAlpha(obj.color, 0.8);
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function drawFan(
  ctx: CanvasRenderingContext2D,
  rect: CourtRect,
  ball: CourtObject,
  fan: NonNullable<CourtObject["fan"]>,
  court: CourtType,
) {
  const pts = fanSectorPoints(ball, fan, court);
  ctx.beginPath();
  const first = objectScreen(rect, pts[0]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < pts.length; i++) {
    const p = objectScreen(rect, pts[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 213, 79, 0.28)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 213, 79, 0.92)";
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

function ourCourtScreen(rect: CourtRect, court: CourtType): CourtRect {
  const net = netYNorm(court);
  return {
    x: rect.x,
    y: rect.y + (1 - net) * rect.h,
    w: rect.w,
    h: net * rect.h,
  };
}

function drawCoverageHoles(
  ctx: CanvasRenderingContext2D,
  rect: CourtRect,
  objects: CourtObject[],
  court: CourtType,
  alpha: number,
) {
  if (alpha <= 0) return;
  const ours = ourCourtScreen(rect, court);
  const { width, length } = courtMeters(court);
  ctx.save();
  ctx.beginPath();
  ctx.rect(ours.x, ours.y, ours.w, ours.h);
  ctx.clip();
  ctx.beginPath();
  ctx.rect(ours.x, ours.y, ours.w, ours.h);
  for (const obj of objects) {
    if (obj.kind !== "player" || !defaultCoverageOn(obj)) continue;
    const r = coverageRadius(obj);
    const p = objectScreen(rect, obj);
    const rx = (r / width) * rect.w;
    const ry = (r / length) * rect.h;
    ctx.moveTo(p.x + rx, p.y);
    ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
  }
  ctx.fillStyle = `rgba(214, 218, 228, ${alpha})`;
  ctx.fill("evenodd");
  ctx.restore();
}

function drawCourt(
  ctx: CanvasRenderingContext2D,
  rect: CourtRect,
  court: CourtType,
) {
  const { x, y, w, h } = rect;
  const meters = courtMeters(court);
  const sy = h / meters.length;

  ctx.fillStyle = COURT_FILL;
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = COURT_LINE;
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
  const cells = zoneCells(mode, court);
  if (cells.length === 0) return;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;

  for (const cell of cells) {
    const a = objectScreen(rect, { x: cell.x0, y: cell.y0 });
    const b = objectScreen(rect, { x: cell.x1, y: cell.y1 });
    const left = Math.min(a.x, b.x);
    const top = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x);
    const h = Math.abs(b.y - a.y);
    ctx.strokeRect(left, top, w, h);
    ctx.font = `700 ${Math.max(18, Math.min(w, h) * 0.42)}px system-ui, sans-serif`;
    ctx.fillText(cell.label, left + w / 2, top + h / 2);
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
  ctx.shadowColor = color;
  ctx.shadowBlur = Math.max(6, size * 0.018);
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
  highlighted = false,
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

  if (obj.kind === "cone") {
    drawCone(ctx, p.x, p.y, size, obj.color);
    return;
  }

  if (obj.kind === "text") {
    drawBoardText(ctx, rect, p.x, p.y, obj);
    return;
  }

  const r = size * 0.048;
  if (highlighted) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 5, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffd54f";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = obj.color;
  ctx.shadowColor = obj.color;
  ctx.shadowBlur = r * 0.85;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = isLightColor(obj.color) ? LABEL_ON_LIGHT : "#ffffff";
  ctx.font = `700 ${Math.max(9, r * 0.72)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(obj.label.slice(0, 4), p.x, p.y);
}

function textFontPx(rect: CourtRect, obj: CourtObject) {
  const size = Math.min(rect.w, rect.h);
  const n = obj.fontSize ?? 18;
  return Math.max(10, (n / 18) * size * 0.055);
}

function drawCone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  const sprite = getConeSprite(color);
  const h = size * 0.065;
  const w = h * (sprite ? sprite.width / Math.max(1, sprite.height) : 0.72);
  if (sprite) {
    ctx.drawImage(sprite, x - w / 2, y - h / 2, w, h);
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y - h * 0.62);
  ctx.lineTo(x + w * 0.52, y + h * 0.38);
  ctx.lineTo(x - w * 0.52, y + h * 0.38);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawBoardText(
  ctx: CanvasRenderingContext2D,
  rect: CourtRect,
  x: number,
  y: number,
  obj: CourtObject,
) {
  const fontPx = textFontPx(rect, obj);
  const italic = obj.italic ? "italic " : "";
  const weight = obj.bold ? "700" : "500";
  ctx.save();
  ctx.font = `${italic}${weight} ${fontPx}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = obj.color;
  ctx.fillText(obj.label || "텍스트", x, y);
  ctx.restore();
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
