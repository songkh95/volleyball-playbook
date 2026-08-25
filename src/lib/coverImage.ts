const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|avif)$/i;

export function isImageFile(file: File) {
  if (file.type.startsWith("image/")) return true;
  return IMAGE_EXT.test(file.name);
}

function loadFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이 이미지는 열 수 없습니다."));
    img.src = url;
  });
}

export async function fileToCoverBlob(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    let width = 0;
    let height = 0;
    let draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

    try {
      const bitmap = await createImageBitmap(file);
      width = bitmap.width;
      height = bitmap.height;
      draw = (ctx, w, h) => {
        ctx.drawImage(bitmap, 0, 0, w, h);
        bitmap.close();
      };
    } catch {
      const img = await loadFromUrl(url);
      width = img.naturalWidth;
      height = img.naturalHeight;
      draw = (ctx, w, h) => {
        ctx.drawImage(img, 0, 0, w, h);
      };
    }

    if (!width || !height) throw new Error("사진을 처리할 수 없습니다.");
    const max = 720;
    const scale = Math.min(1, max / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("사진을 처리할 수 없습니다.");
    draw(ctx, w, h);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.82);
    });
    if (!blob) throw new Error("사진을 저장할 수 없습니다.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
