import coneUrl from "../assets/safety-cone.png";

let mask: HTMLCanvasElement | null = null;
let loading = false;
const waiters: Array<() => void> = [];
const tinted = new Map<string, HTMLCanvasElement>();

function punchBlackToMask(img: HTMLImageElement) {
  const src = document.createElement("canvas");
  src.width = img.naturalWidth;
  src.height = img.naturalHeight;
  const sctx = src.getContext("2d");
  if (!sctx) return src;
  sctx.drawImage(img, 0, 0);
  const data = sctx.getImageData(0, 0, src.width, src.height);
  const px = data.data;
  let minX = src.width;
  let minY = src.height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const i = (y * src.width + x) * 4;
      const lum = (px[i] + px[i + 1] + px[i + 2]) / 3;
      if (lum < 22) {
        px[i + 3] = 0;
        continue;
      }
      px[i] = 255;
      px[i + 1] = 255;
      px[i + 2] = 255;
      px[i + 3] = lum < 40 ? Math.round((lum / 40) * 255) : 255;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  sctx.putImageData(data, 0, 0);
  if (maxX <= minX || maxY <= minY) return src;
  const pad = 2;
  const sx = Math.max(0, minX - pad);
  const sy = Math.max(0, minY - pad);
  const sw = Math.min(src.width - sx, maxX - minX + 1 + pad * 2);
  const sh = Math.min(src.height - sy, maxY - minY + 1 + pad * 2);
  const out = document.createElement("canvas");
  out.width = sw;
  out.height = sh;
  const octx = out.getContext("2d");
  if (!octx) return src;
  octx.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}

function tintMask(color: string) {
  if (!mask) return null;
  const hit = tinted.get(color);
  if (hit) return hit;
  const out = document.createElement("canvas");
  out.width = mask.width;
  out.height = mask.height;
  const ctx = out.getContext("2d");
  if (!ctx) return mask;
  ctx.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, out.width, out.height);
  tinted.set(color, out);
  return out;
}

export function getConeSprite(color: string) {
  return tintMask(color);
}

export function loadConeSprite(onReady: () => void) {
  if (mask) {
    onReady();
    return;
  }
  waiters.push(onReady);
  if (loading) return;
  loading = true;
  const img = new Image();
  img.onload = () => {
    mask = punchBlackToMask(img);
    tinted.clear();
    const ready = waiters.splice(0);
    for (const fn of ready) fn();
  };
  img.onerror = () => {
    loading = false;
    waiters.splice(0);
  };
  img.src = coneUrl;
}
