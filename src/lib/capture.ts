export function fileSafeName(name: string) {
  const trimmed = name.trim() || "전술";
  return trimmed.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 40);
}

export function extFromMime(type: string) {
  if (type.includes("gif")) return "gif";
  if (type.includes("png")) return "png";
  if (type.includes("mp4")) return "mp4";
  if (type.includes("webm")) return "webm";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  return "";
}

export function downloadBlob(blob: Blob, filename: string, ext?: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const known = (ext || extFromMime(blob.type) || "bin").replace(/^\./, "");
  const base = filename.replace(/\.(png|gif|webm|mp4|jpg|jpeg)$/i, "");
  a.download = `${base}.${known}`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadPng(blob: Blob, filename: string) {
  downloadBlob(blob, filename, "png");
}
