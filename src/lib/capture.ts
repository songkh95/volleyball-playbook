export function fileSafeName(name: string) {
  const trimmed = name.trim() || "전술";
  return trimmed.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 40);
}

export function downloadPng(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  a.click();
  URL.revokeObjectURL(url);
}
