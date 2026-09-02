import { uid } from "./id";
import { CURRENT_MATCH_ID, SHARED_ROSTER_ID, normalizeMatch } from "./matchRules";
import type { LiveMatch, SharedRoster } from "../types/match";
import type { Album, BackupFile, FormationPreset, Play } from "../types/play";

export const BACKUP_MIME = "application/vnd.volleyball.playbook";

export type BackupBundle = {
  plays: Play[];
  albums: Album[];
  presets: FormationPreset[];
  match?: LiveMatch | null;
  roster?: SharedRoster | null;
};

function forBackupMatch(match: LiveMatch): LiveMatch {
  return {
    ...normalizeMatch(match),
    id: CURRENT_MATCH_ID,
    timeout: null,
    scoreUndo: [],
    scoreRedo: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function parseMatch(value: unknown): LiveMatch | null {
  if (!isRecord(value)) return null;
  if (!isRecord(value.ours) || !isRecord(value.opp) || !isRecord(value.rally)) return null;
  try {
    return forBackupMatch(value as unknown as LiveMatch);
  } catch {
    return null;
  }
}

function parseRoster(value: unknown): SharedRoster | null {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.ours) || !Array.isArray(value.opp)) return null;
  return {
    id: SHARED_ROSTER_ID,
    ours: value.ours as SharedRoster["ours"],
    opp: value.opp as SharedRoster["opp"],
    rosterSize: value.rosterSize === 9 ? 9 : 6,
    updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : Date.now(),
  };
}

export function buildBackup(bundle: BackupBundle): BackupFile {
  return {
    schema: 3,
    app: "volleyball-playbook",
    exportedAt: new Date().toISOString(),
    plays: bundle.plays,
    albums: bundle.albums,
    presets: bundle.presets,
    match: bundle.match ? forBackupMatch(bundle.match) : null,
    roster: bundle.roster ?? null,
  };
}

export function downloadBackup(bundle: BackupBundle) {
  const blob = new Blob([JSON.stringify(buildBackup(bundle), null, 2)], {
    type: BACKUP_MIME,
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
  if (!isRecord(data)) {
    throw new Error("형식이 다른 파일입니다.");
  }
  const rec = data as BackupFile;
  if (rec.app !== "volleyball-playbook" || !Array.isArray(rec.plays)) {
    throw new Error("배구 전술 보드 백업 파일이 아닙니다.");
  }
  const plays = rec.plays.map((p) => ({
    ...p,
    cuts: (p.cuts ?? []).map((c, i) => ({
      ...c,
      name: c.name || `장면 ${i + 1}`,
    })),
  }));
  const albums = rec.albums ?? [];
  const presets = rec.presets ?? [];
  const match = parseMatch(rec.match);
  const roster = parseRoster(rec.roster);
  if (
    plays.length === 0 &&
    albums.length === 0 &&
    presets.length === 0 &&
    !match &&
    !roster
  ) {
    throw new Error("파일에 전술이나 기록이 없습니다.");
  }
  return { plays, albums, presets, match, roster };
}

export function backupHasContent(bundle: BackupBundle) {
  return (
    bundle.plays.length > 0 ||
    bundle.albums.length > 0 ||
    bundle.presets.length > 0 ||
    Boolean(bundle.match) ||
    Boolean(bundle.roster)
  );
}

export function withFreshIds(bundle: BackupBundle): BackupBundle {
  const albumMap = new Map<string, string>();
  const albums = bundle.albums.map((a) => {
    const id = uid();
    albumMap.set(a.id, id);
    return { ...a, id };
  });
  let fallback = albums[0]?.id;
  if (!fallback && bundle.plays.length > 0) {
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
  return {
    plays,
    albums,
    presets,
    match: bundle.match ?? undefined,
    roster: bundle.roster ?? undefined,
  };
}
