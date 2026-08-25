import type { Album, FormationPreset, GalleryCapture, Play } from "../types/play";
import { uid } from "./id";

export type CoverRecord = {
  id: string;
  kind: "album" | "play";
  blob: Blob;
};

const DB_NAME = "volleyball-playbook";
const DB_VERSION = 4;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("plays")) {
        db.createObjectStore("plays", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("albums")) {
        db.createObjectStore("albums", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("presets")) {
        db.createObjectStore("presets", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("captures")) {
        db.createObjectStore("captures", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("covers")) {
        db.createObjectStore("covers", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAll<T>(store: string): Promise<T[]> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readonly");
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
      }),
  );
}

function getOne<T>(store: string, id: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readonly");
        const req = tx.objectStore(store).get(id);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
      }),
  );
}

function putOne(store: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(value);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

function deleteOne(store: string, id: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

function clearStore(store: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

let migrated = false;
let migratePromise: Promise<void> | null = null;

export async function ensureMigrated(): Promise<void> {
  if (migrated) return;
  if (migratePromise) return migratePromise;
  migratePromise = runMigration();
  try {
    await migratePromise;
  } finally {
    migratePromise = null;
  }
}

async function runMigration(): Promise<void> {
  const plays = await listPlays();
  let albums = await listAlbums();
  const needsAlbum = plays.some((p) => !p.albumId);
  if (albums.length === 0 && needsAlbum) {
    const album: Album = {
      id: uid(),
      title: "기본 프로젝트",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveAlbum(album);
    albums = [album];
  }
  const fallback = albums[0]?.id ?? "";
  for (const play of plays) {
    const cuts = play.cuts.map((c, i) => ({
      ...c,
      name: c.name || `Cut ${i + 1}`,
    }));
    const albumId = play.albumId || fallback;
    if (albumId && (!play.albumId || cuts.some((c, i) => c.name !== play.cuts[i].name))) {
      await savePlay({ ...play, albumId, cuts });
    }
  }

  const defaults = albums.filter(
    (a) => a.title === "기본 프로젝트" || a.title === "기본 앨범",
  );
  if (defaults.length > 1) {
    const latestPlays = await listPlays();
    const keep =
      defaults.find((a) => latestPlays.some((p) => p.albumId === a.id)) ?? defaults[0];
    for (const extra of defaults) {
      if (extra.id === keep.id) continue;
      const extraPlays = latestPlays.filter((p) => p.albumId === extra.id);
      if (extraPlays.length === 0) await deleteOne("albums", extra.id);
    }
  }

  migrated = true;
}

export async function listPlays(): Promise<Play[]> {
  const plays = await getAll<Play>("plays");
  return plays.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function listPlaysInAlbum(albumId: string): Promise<Play[]> {
  const plays = await listPlays();
  return plays.filter((p) => p.albumId === albumId);
}

export function getPlay(id: string) {
  return getOne<Play>("plays", id);
}

export function savePlay(play: Play) {
  return putOne("plays", play);
}

export async function deletePlay(id: string) {
  const caps = await listCapturesByPlay(id);
  for (const c of caps) await deleteCapture(c.id);
  await deleteCover(id);
  await deleteOne("plays", id);
}

export async function listCaptures(): Promise<GalleryCapture[]> {
  const items = await getAll<GalleryCapture>("captures");
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function listCapturesByPlay(playId: string): Promise<GalleryCapture[]> {
  const items = await listCaptures();
  return items.filter((c) => c.playId === playId);
}

export function saveCapture(capture: GalleryCapture) {
  return putOne("captures", capture);
}

export function deleteCapture(id: string) {
  return deleteOne("captures", id);
}

export async function listAlbums(): Promise<Album[]> {
  const albums = await getAll<Album>("albums");
  return albums.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getAlbum(id: string) {
  return getOne<Album>("albums", id);
}

export function saveAlbum(album: Album) {
  return putOne("albums", album);
}

export async function deleteAlbum(id: string): Promise<void> {
  const plays = await listPlaysInAlbum(id);
  for (const p of plays) await deletePlay(p.id);
  await deleteCover(id);
  await deleteOne("albums", id);
}

export async function listCovers() {
  try {
    return await getAll<CoverRecord>("covers");
  } catch {
    return [];
  }
}

export function saveCover(cover: CoverRecord) {
  return putOne("covers", cover);
}

export function deleteCover(id: string) {
  return deleteOne("covers", id);
}

export async function listPresets(): Promise<FormationPreset[]> {
  const presets = await getAll<FormationPreset>("presets");
  return presets.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getPreset(id: string) {
  return getOne<FormationPreset>("presets", id);
}

export function savePreset(preset: FormationPreset) {
  return putOne("presets", preset);
}

export function deletePreset(id: string) {
  return deleteOne("presets", id);
}

export async function replaceAll(data: {
  plays: Play[];
  albums: Album[];
  presets: FormationPreset[];
}): Promise<void> {
  await clearStore("plays");
  await clearStore("albums");
  await clearStore("presets");
  for (const a of data.albums) await saveAlbum(a);
  for (const p of data.presets) await savePreset(p);
  for (const p of data.plays) await savePlay(p);
  const keep = new Set([...data.albums.map((a) => a.id), ...data.plays.map((p) => p.id)]);
  const covers = await listCovers();
  for (const cover of covers) {
    if (!keep.has(cover.id)) await deleteCover(cover.id);
  }
  migrated = false;
}

export async function addImported(data: {
  plays: Play[];
  albums: Album[];
  presets: FormationPreset[];
}): Promise<void> {
  for (const a of data.albums) await saveAlbum(a);
  for (const p of data.presets) await savePreset(p);
  for (const p of data.plays) await savePlay(p);
}
