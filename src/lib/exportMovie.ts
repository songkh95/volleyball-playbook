import { applyPalette, GIFEncoder, quantize } from "gifenc";
import type { CourtObject, Cut, PlayerPose, Stroke } from "../types/play";
import { playheadFromTime, timelineDurationSec, viewAtPlayhead, type Trail } from "./interpolate";
import { poseMapAtPlayhead } from "./playerPose";

export const EXPORT_FPS = 30;
export const EXPORT_GIF_FPS = 20;
export const EXPORT_WIDTH = 720;
export const EXPORT_GIF_WIDTH = 540;

export function exportMaxWidth(kind: "gif" | "video"): number {
  return kind === "gif" ? EXPORT_GIF_WIDTH : EXPORT_WIDTH;
}

export function exportFps(kind: "gif" | "video"): number {
  return kind === "gif" ? EXPORT_GIF_FPS : EXPORT_FPS;
}

export type MovieView = {
  objects: CourtObject[];
  trails: Trail[];
  strokes: Stroke[];
  poseByPlayerId?: Record<string, PlayerPose>;
};

export type VideoFormat = { mime: string; ext: "webm" | "mp4" };

export function moviePlayheads(cuts: Cut[], fps = EXPORT_FPS): number[] {
  if (cuts.length <= 1) {
    return Array.from({ length: Math.max(1, fps) }, () => 0);
  }
  const durationSec = timelineDurationSec(cuts);
  const n = Math.max(2, Math.round(durationSec * fps) + 1);
  return Array.from({ length: n }, (_, i) =>
    playheadFromTime(cuts, (i / (n - 1)) * durationSec),
  );
}

export function movieViews(
  cuts: Cut[],
  showTrails: boolean,
  fps = EXPORT_FPS,
): MovieView[] {
  return moviePlayheads(cuts, fps).map((playhead) => {
    const view = viewAtPlayhead(cuts, playhead);
    return {
      objects: view.objects,
      trails: showTrails ? view.trails : [],
      strokes: view.strokes,
      poseByPlayerId: poseMapAtPlayhead(cuts, playhead),
    };
  });
}

export function detectVideoFormat(): VideoFormat | null {
  if (typeof MediaRecorder === "undefined") return null;
  const proto = HTMLCanvasElement.prototype as HTMLCanvasElement & {
    captureStream?: (fps?: number) => MediaStream;
  };
  if (typeof proto.captureStream !== "function") return null;

  const candidates: VideoFormat[] = [
    { mime: "video/mp4;codecs=avc1.42E01E", ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" },
    { mime: "video/webm;codecs=vp9", ext: "webm" },
    { mime: "video/webm;codecs=vp8", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];
  for (const item of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(item.mime)) return item;
    } catch {
      /* ignore */
    }
  }
  return { mime: "", ext: "webm" };
}

export async function encodeGif(frames: ImageData[], fps = EXPORT_FPS): Promise<Blob> {
  if (frames.length === 0) throw new Error("저장할 장면이 없습니다.");
  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const palette = quantize(frame.data, 256, { format: "rgb565" });
    const index = applyPalette(frame.data, palette, "rgb565");
    gif.writeFrame(index, frame.width, frame.height, {
      palette,
      delay,
      repeat: i === 0 ? 0 : undefined,
    });
    if (i % 4 === 3) await yieldToUi();
  }
  gif.finish();
  const bytes = gif.bytes();
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Blob([copy], { type: "image/gif" });
}

export async function recordVideo(
  frames: ImageData[],
  fps = EXPORT_FPS,
): Promise<{ blob: Blob; ext: "webm" | "mp4" }> {
  const format = detectVideoFormat();
  if (!format) {
    throw new Error("이 기기에서는 영상 파일 저장을 지원하지 않습니다. GIF로 저장해 주세요.");
  }
  if (frames.length === 0) throw new Error("저장할 장면이 없습니다.");

  const canvas = document.createElement("canvas");
  canvas.width = frames[0].width;
  canvas.height = frames[0].height;
  canvas.style.cssText =
    "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    canvas.remove();
    throw new Error("영상을 만들 수 없습니다.");
  }

  let stream: MediaStream;
  try {
    stream = canvas.captureStream(0);
  } catch {
    stream = canvas.captureStream(fps);
  }

  const rec = makeRecorder(stream, format, frames[0].width, frames[0].height, fps);
  const chunks: Blob[] = [];
  const done = new Promise<Blob>((resolve, reject) => {
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.onerror = () => reject(new Error("영상 저장에 실패했습니다."));
    rec.onstop = () => {
      const type = rec.mimeType || format.mime || "video/webm";
      resolve(new Blob(chunks, { type }));
    };
  });

  const delay = 1000 / fps;
  const track = stream.getVideoTracks()[0] as MediaStreamTrack & {
    requestFrame?: () => void;
  };

  try {
    ctx.putImageData(frames[0], 0, 0);
    rec.start(100);
    await wait(Math.max(delay, 80));
    for (const frame of frames) {
      ctx.putImageData(frame, 0, 0);
      track.requestFrame?.();
      await wait(delay);
    }
    await wait(delay);
    if (typeof rec.requestData === "function") rec.requestData();
    rec.stop();
    const blob = await done;
    if (!blob.size) {
      throw new Error("영상 파일이 비어 있습니다. GIF로 저장해 주세요.");
    }
    const ext = blob.type.includes("mp4") ? "mp4" : format.ext;
    return { blob, ext };
  } catch (err) {
    if (rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
    throw err;
  } finally {
    stream.getTracks().forEach((item) => item.stop());
    canvas.remove();
  }
}

function makeRecorder(
  stream: MediaStream,
  format: VideoFormat,
  width: number,
  height: number,
  fps: number,
) {
  const videoBitsPerSecond = Math.min(
    12_000_000,
    Math.max(6_000_000, Math.round(width * height * fps * 0.45)),
  );
  const opts: MediaRecorderOptions = { videoBitsPerSecond };
  try {
    return format.mime
      ? new MediaRecorder(stream, { ...opts, mimeType: format.mime })
      : new MediaRecorder(stream, opts);
  } catch {
    try {
      return new MediaRecorder(stream, opts);
    } catch {
      return new MediaRecorder(stream);
    }
  }
}

export function waitMs(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function wait(ms: number) {
  return waitMs(ms);
}

export function yieldToUi() {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    window.setTimeout(resolve, 0);
  });
}
