import { uid } from "./id";
import type { Album, BackupFile, FormationPreset, Play } from "../types/play";

export type BackupBundle = {
  plays: Play[];
  albums: Album[];
  presets: FormationPreset[];
};

export function buildBackup(bundle: BackupBundle): BackupFile {
  return {
    schema: 2,
    app: "volleyball-playbook",
    exportedAt: new Date().toISOString(),
    plays: bundle.plays,
    albums: bundle.albums,
    presets: bundle.presets,
  };
}

export function downloadBackup(bundle: BackupBundle) {
  const blob = new Blob([JSON.stringify(buildBackup(bundle), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const day = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `playbook-${day}.vpb`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseBackup(text: string): BackupBundle {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("파일을 읽을 수 없습니다.");
  }
  if (!data || typeof data !== "object") {
    throw new Error("형식이 다른 파일입니다.");
  }
  const rec = data as BackupFile;
  if (rec.app !== "volleyball-playbook" || !Array.isArray(rec.plays)) {
    throw new Error("배구 전술 보드 백업 파일이 아닙니다.");
  }
  return {
    plays: rec.plays.map((p) => ({
      ...p,
      cuts: (p.cuts ?? []).map((c, i) => ({
        ...c,
        name: c.name || `장면 ${i + 1}`,
      })),
    })),
    albums: rec.albums ?? [],
    presets: rec.presets ?? [],
  };
}

export function withFreshIds(bundle: BackupBundle): BackupBundle {
  const albumMap = new Map<string, string>();
  const albums = bundle.albums.map((a) => {
    const id = uid();
    albumMap.set(a.id, id);
    return { ...a, id };
  });
  let fallback = albums[0]?.id;
  if (!fallback) {
    fallback = uid();
    albums.push({
      id: fallback,
      title: "가져온 전술 프로젝트",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
  const plays = bundle.plays.map((p) => ({
    ...p,
    id: uid(),
    albumId: albumMap.get(p.albumId) ?? fallback,
  }));
  const presets = bundle.presets.map((pr) => ({ ...pr, id: uid() }));
  return { plays, albums, presets };
}
