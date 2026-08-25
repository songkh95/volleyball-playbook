import volleyballUrl from "../assets/volleyball.png";

let sprite: HTMLCanvasElement | null = null;
let loading = false;
const waiters: Array<() => void> = [];

function punchBlackAndCrop(img: HTMLImageElement) {
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
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      if (r + g + b < 36) {
        px[i + 3] = 0;
        continue;
      }
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
  const side = Math.max(sw, sh);
  const out = document.createElement("canvas");
  out.width = side;
  out.height = side;
  const octx = out.getContext("2d");
  if (!octx) return src;
  octx.drawImage(src, sx, sy, sw, sh, (side - sw) / 2, (side - sh) / 2, sw, sh);
  return out;
}

export function getBallSprite() {
  return sprite;
}

export function loadBallSprite(onReady: () => void) {
  if (sprite) {
    onReady();
    return;
  }
  waiters.push(onReady);
  if (loading) return;
  loading = true;
  const img = new Image();
  img.onload = () => {
    sprite = punchBlackAndCrop(img);
    const ready = waiters.splice(0);
    for (const fn of ready) fn();
  };
  img.onerror = () => {
    loading = false;
    waiters.splice(0);
  };
  img.src = volleyballUrl;
}
