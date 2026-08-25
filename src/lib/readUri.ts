import { Capacitor } from "@capacitor/core";
import { Filesystem, Encoding } from "@capacitor/filesystem";

export async function readTextFromUri(uri: string): Promise<string> {
  try {
    const result = await Filesystem.readFile({
      path: uri,
      encoding: Encoding.UTF8,
    });
    if (typeof result.data === "string") return result.data;
  } catch {
    // content:// 등 일부 URI는 fetch로 읽습니다.
  }
  const converted = Capacitor.convertFileSrc(uri);
  const res = await fetch(converted);
  if (!res.ok) throw new Error("파일을 열 수 없습니다.");
  return res.text();
}
