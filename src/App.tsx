import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmModal } from "./components/ConfirmModal";
import { CreatePlayModal } from "./components/CreatePlayModal";
import { ImportBackupModal } from "./components/ImportBackupModal";
import { Modal } from "./components/Modal";
import { RenameModal } from "./components/RenameModal";
import {
  backupHasContent,
  downloadBackup,
  parseBackup,
  withFreshIds,
  type BackupBundle,
} from "./lib/backup";
import { handleBack, registerBackHandler } from "./lib/backHandlers";
import { createAlbum, createPlay, createPreset } from "./lib/defaultPlay";
import { isBuiltinPreset } from "./lib/formations";
import { readTextFromUri } from "./lib/readUri";
import {
  addImported,
  deleteAlbum,
  deleteCapture,
  deleteCover,
  deletePlay,
  deletePreset,
  ensureMigrated,
  getAlbum,
  getLiveMatch,
  getPlay,
  getPreset,
  getSharedRoster,
  listAlbums,
  listCaptures,
  listCovers,
  listPlays,
  listPresets,
  replaceAll,
  saveAlbum,
  saveCover,
  savePlay,
  savePreset,
} from "./lib/db";
import homeBg from "./assets/home-bg.jpg";
import { AlbumScreen } from "./screens/AlbumScreen";
import { EditorScreen } from "./screens/EditorScreen";
import { GalleryScreen } from "./screens/GalleryScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { MatchScreen } from "./screens/MatchScreen";
import { PresetEditorScreen } from "./screens/PresetEditorScreen";
import type {
  Album,
  CourtType,
  FormationPreset,
  GalleryCapture,
  Play,
  RosterSize,
} from "./types/play";

type Tab = "home" | "gallery" | "match";
type Route =
  | { name: "main"; tab: Tab; folderPlayId?: string }
  | { name: "album"; albumId: string; tab: Tab }
  | { name: "editor"; playId: string; back: Exclude<Route, { name: "editor" }> }
  | { name: "preset-editor"; presetId: string; back?: Exclude<Route, { name: "preset-editor" }> };

type PendingDelete =
  | { kind: "play"; play: Play }
  | { kind: "album"; album: Album }
  | { kind: "preset"; preset: FormationPreset };

type PendingRename = { kind: "album"; album: Album } | { kind: "play"; play: Play };

function isRouteState(value: unknown): value is Route {
  if (!value || typeof value !== "object" || !("name" in value)) return false;
  const name = (value as { name: string }).name;
  return name === "main" || name === "album" || name === "editor" || name === "preset-editor";
}

export default function App() {
  const [route, setRoute] = useState<Route>({ name: "main", tab: "home" });
  const [plays, setPlays] = useState<Play[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [presets, setPresets] = useState<FormationPreset[]>([]);
  const [captures, setCaptures] = useState<GalleryCapture[]>([]);
  const [covers, setCovers] = useState<Record<string, Blob>>({});
  const [editorPlay, setEditorPlay] = useState<Play | null>(null);
  const [editorPreset, setEditorPreset] = useState<FormationPreset | null>(null);
  const [album, setAlbum] = useState<Album | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForAlbumId, setCreateForAlbumId] = useState<string | null>(null);
  const [createAlbumOpen, setCreateAlbumOpen] = useState(false);
  const [pendingRename, setPendingRename] = useState<PendingRename | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [importPending, setImportPending] = useState<BackupBundle | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [matchEpoch, setMatchEpoch] = useState(0);
  const [booted, setBooted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const goTo = useCallback((next: Route, mode: "push" | "replace" = "push") => {
    setRoute(next);
    if (mode === "replace") window.history.replaceState({ route: next }, "");
    else window.history.pushState({ route: next }, "");
  }, []);

  const popScreen = useCallback(() => {
    if (isRouteState(window.history.state?.route) && window.history.length > 1) {
      window.history.back();
      return;
    }
    goTo({ name: "main", tab: "home" }, "replace");
  }, [goTo]);

  const refresh = useCallback(async () => {
    await ensureMigrated();
    const [nextPlays, nextAlbums, nextPresets, nextCaptures, nextCovers] = await Promise.all([
      listPlays(),
      listAlbums(),
      listPresets(),
      listCaptures(),
      listCovers(),
    ]);
    setPlays(nextPlays);
    setAlbums(nextAlbums);
    setPresets(nextPresets);
    setCaptures(nextCaptures);
    setCovers(Object.fromEntries(nextCovers.map((c) => [c.id, c.blob])));
    setBooted(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    window.history.replaceState({ route: { name: "main", tab: "home" } }, "");
    function onPop(event: PopStateEvent) {
      const next = event.state?.route;
      if (isRouteState(next)) setRoute(next);
      else setRoute({ name: "main", tab: "home" });
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    return registerBackHandler(() => {
      if (route.name === "main" && route.tab === "gallery") return false;
      if (route.name === "main" && route.tab !== "home") {
        goTo({ name: "main", tab: "home" }, "replace");
        return true;
      }
      return false;
    });
  }, [goTo, route]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: { remove: () => Promise<void> } | undefined;
    void CapApp.addListener("backButton", () => {
      if (handleBack()) return;
      void CapApp.exitApp();
    }).then((h) => {
      handle = h;
    });
    return () => {
      void handle?.remove();
    };
  }, []);

  async function handleCoverChange(id: string, kind: "album" | "play", blob: Blob | null) {
    if (blob) {
      await saveCover({ id, kind, blob });
      setCovers((prev) => ({ ...prev, [id]: blob }));
    } else {
      await deleteCover(id);
      setCovers((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    await refresh();
  }

  useEffect(() => {
    if (route.name !== "editor") {
      setEditorPlay(null);
      return;
    }
    void getPlay(route.playId).then((play) => {
      if (play) setEditorPlay(play);
      else popScreen();
    });
  }, [popScreen, route]);

  useEffect(() => {
    if (route.name !== "preset-editor") {
      setEditorPreset(null);
      return;
    }
    void getPreset(route.presetId).then((preset) => {
      if (preset) setEditorPreset(preset);
      else goTo({ name: "main", tab: "home" }, "replace");
    });
  }, [goTo, route]);

  useEffect(() => {
    if (route.name !== "album") {
      setAlbum(null);
      return;
    }
    void getAlbum(route.albumId).then((next) => {
      if (next) setAlbum(next);
      else goTo({ name: "main", tab: route.tab }, "replace");
    });
  }, [goTo, route]);

  const ingestBackupText = useCallback((text: string) => {
    try {
      setImportPending(parseBackup(text));
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "불러오기에 실패했습니다.");
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: { remove: () => Promise<void> } | undefined;
    let lastUrl = "";
    let lastAt = 0;
    const ingestUrl = async (url: string) => {
      const now = Date.now();
      if (!url || (url === lastUrl && now - lastAt < 2000)) return;
      lastUrl = url;
      lastAt = now;
      try {
        const text = await readTextFromUri(url);
        ingestBackupText(text);
      } catch (err) {
        setNotice(err instanceof Error ? err.message : "파일을 열 수 없습니다.");
      }
    };
    void CapApp.getLaunchUrl().then((info) => {
      if (info?.url) void ingestUrl(info.url);
    });
    void CapApp.addListener("appUrlOpen", (event) => {
      void ingestUrl(event.url);
    }).then((h) => {
      handle = h;
    });
    return () => {
      void handle?.remove();
    };
  }, [ingestBackupText]);

  const creatingAlbumId = createForAlbumId;

  async function handleCreate(input: {
    title: string;
    court: CourtType;
    rosterSize: RosterSize;
  }) {
    if (!creatingAlbumId) return;
    const roster = await getSharedRoster();
    const play = createPlay({
      ...input,
      albumId: creatingAlbumId,
      roster: roster?.ours,
    });
    await savePlay(play);
    await refresh();
    setCreateOpen(false);
    setCreateForAlbumId(null);
    const backTab = route.name === "album" ? route.tab : "home";
    goTo({
      name: "editor",
      playId: play.id,
      back: { name: "album", albumId: creatingAlbumId, tab: backTab },
    });
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    try {
      if (target.kind === "play") {
        await deletePlay(target.play.id);
        if (route.name === "editor" && route.playId === target.play.id) {
          popScreen();
        }
      } else if (target.kind === "album") {
        await deleteAlbum(target.album.id);
        if (route.name === "album" && route.albumId === target.album.id) {
          goTo({ name: "main", tab: route.tab }, "replace");
        }
      } else if (!isBuiltinPreset(target.preset)) {
        await deletePreset(target.preset.id);
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "삭제하지 못했습니다.");
    } finally {
      setPendingDelete(null);
      await refresh();
    }
  }

  async function handleCreateAlbum(title: string) {
    const next = createAlbum(title);
    await saveAlbum(next);
    setAlbum(next);
    await refresh();
    return next.id;
  }

  async function handleBackupSave() {
    const [match, roster] = await Promise.all([getLiveMatch(), getSharedRoster()]);
    const bundle = { plays, albums, presets, match, roster };
    if (!backupHasContent(bundle)) {
      setNotice("저장할 내용이 없습니다.");
      return;
    }
    downloadBackup(bundle);
    setNotice("백업 파일(.vpb)을 저장했습니다. 앱을 지우기 전에 이 파일을 보관하세요.");
  }

  const showNav = route.name === "main" || route.name === "album";
  const activeTab = route.name === "main" || route.name === "album" ? route.tab : "home";
  const isHomeMain = route.name === "main" && route.tab === "home";
  const showSceneBg = isHomeMain || route.name === "album";

  const backupOverlays = (
    <>
      <ImportBackupModal
        open={Boolean(importPending)}
        count={importPending?.plays.length ?? 0}
        onClose={() => setImportPending(null)}
        onAdd={() => {
          if (!importPending) return;
          const bundle = withFreshIds(importPending);
          const hasMatch = Boolean(bundle.match || bundle.roster);
          void addImported(bundle).then(async () => {
            setImportPending(null);
            if (hasMatch) setMatchEpoch((n) => n + 1);
            await refresh();
          });
        }}
        onReplace={() => {
          if (!importPending) return;
          void replaceAll(importPending).then(async () => {
            setImportPending(null);
            setMatchEpoch((n) => n + 1);
            await refresh();
          });
        }}
      />
      <Modal open={Boolean(notice)} title="알림" onClose={() => setNotice(null)}>
        <p className="mb-5 text-sm text-white/75">{notice}</p>
        <button
          type="button"
          className="w-full rounded-xl bg-accent py-3 font-semibold text-ink"
          onClick={() => setNotice(null)}
        >
          확인
        </button>
      </Modal>
    </>
  );

  if (route.name === "editor") {
    if (!editorPlay || editorPlay.id !== route.playId) {
      return <div className="h-full bg-ink" />;
    }
    return (
      <>
        <EditorScreen
          key={editorPlay.id}
          play={editorPlay}
          albumPlays={plays.filter((p) => p.albumId === editorPlay.albumId)}
          albums={albums}
          presets={presets}
          covers={covers}
          onChange={setEditorPlay}
          onBack={() => {
            void refresh();
            popScreen();
          }}
          onOpenPlay={(id) => {
            const next = plays.find((p) => p.id === id);
            if (next) setEditorPlay(next);
            void refresh();
            goTo({ ...route, playId: id }, "replace");
          }}
          onSavedToGallery={(_albumId, playId) => {
            void refresh().then(() => {
              goTo({ name: "main", tab: "gallery", folderPlayId: playId }, "replace");
            });
          }}
          onSaveAndNew={(_saved, next) => {
            void refresh();
            setEditorPlay(next);
            goTo({ ...route, playId: next.id }, "replace");
          }}
          onCreateAlbum={handleCreateAlbum}
          onCreateFormation={(fromPlay) => {
            const preset = createPreset({
              court: fromPlay.court,
              rosterSize: fromPlay.rosterSize,
            });
            void savePreset(preset).then(async () => {
              await refresh();
              goTo({
                name: "preset-editor",
                presetId: preset.id,
                back:
                  route.name === "editor"
                    ? { name: "editor", playId: fromPlay.id, back: route.back }
                    : { name: "main", tab: "home" },
              });
            });
          }}
        />
        {backupOverlays}
      </>
    );
  }

  if (route.name === "preset-editor") {
    if (!editorPreset || editorPreset.id !== route.presetId) {
      return <div className="h-full bg-ink" />;
    }
    return (
      <>
        <PresetEditorScreen
          key={editorPreset.id}
          preset={editorPreset}
          onChange={setEditorPreset}
          onBack={() => {
            void refresh();
            popScreen();
          }}
        />
        {backupOverlays}
      </>
    );
  }

  return (
    <div className="relative h-full bg-ink">
      {showSceneBg ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <img
            src={homeBg}
            alt=""
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/80 via-ink/55 to-ink/88" />
        </div>
      ) : null}
      <div
        className={`relative z-10 mx-auto flex h-full w-full flex-col ${
          route.name === "main" && route.tab === "match" ? "max-w-3xl" : "max-w-lg"
        } ${showSceneBg ? "bg-transparent" : "bg-ink"}`}
      >
      <div className="flex min-h-0 h-full flex-1 flex-col">
        {route.name === "album" ? (
          album && album.id === route.albumId ? (
            <AlbumScreen
              album={album}
              plays={plays.filter((p) => p.albumId === album.id)}
              covers={covers}
              onBack={popScreen}
              onRename={() => setPendingRename({ kind: "album", album })}
              onNewPlay={() => {
                setCreateForAlbumId(album.id);
                setCreateOpen(true);
              }}
              onOpenPlay={(id) =>
                goTo({
                  name: "editor",
                  playId: id,
                  back: { name: "album", albumId: album.id, tab: route.tab },
                })
              }
              onRenamePlay={(play) => setPendingRename({ kind: "play", play })}
              onDeletePlay={(play) => setPendingDelete({ kind: "play", play })}
              onCoverChange={(id, kind, blob) => void handleCoverChange(id, kind, blob)}
            />
          ) : (
            <div className="h-full bg-ink" />
          )
        ) : route.name === "main" && route.tab === "home" ? (
          <HomeScreen
            albums={albums}
            presets={presets}
            plays={plays}
            covers={covers}
            onNewAlbum={() => setCreateAlbumOpen(true)}
            onOpenAlbum={(id) => goTo({ name: "album", albumId: id, tab: "home" })}
            onRenameAlbum={(a) => setPendingRename({ kind: "album", album: a })}
            onDeleteAlbum={(a) => setPendingDelete({ kind: "album", album: a })}
            onCoverChange={(id, kind, blob) => void handleCoverChange(id, kind, blob)}
            onNewPreset={() => {
              const preset = createPreset();
              void savePreset(preset).then(async () => {
                await refresh();
                goTo({ name: "preset-editor", presetId: preset.id });
              });
            }}
            onOpenPreset={(id) => goTo({ name: "preset-editor", presetId: id })}
            onDeletePreset={(preset) => setPendingDelete({ kind: "preset", preset })}
            onBackup={() => void handleBackupSave()}
            onRestore={() => fileRef.current?.click()}
            ready={booted}
          />
        ) : route.name === "main" && route.tab === "match" ? (
          <MatchScreen key={matchEpoch} />
        ) : (
          <GalleryScreen
            albums={albums}
            plays={plays}
            captures={captures}
            covers={covers}
            openFolderPlayId={route.name === "main" ? route.folderPlayId : undefined}
            onLeaveGallery={() => goTo({ name: "main", tab: "home" }, "replace")}
            onOpenAlbum={(id) => goTo({ name: "album", albumId: id, tab: "gallery" })}
            onOpenPlay={(id) => {
              const play = plays.find((p) => p.id === id);
              goTo({
                name: "editor",
                playId: id,
                back: play
                  ? { name: "album", albumId: play.albumId, tab: "gallery" }
                  : { name: "main", tab: "gallery" },
              });
            }}
            onDeleteCapture={(id) => {
              void deleteCapture(id).then(() => refresh());
            }}
          />
        )}
      </div>

      {showNav ? (
        <nav className="grid grid-cols-3 gap-2 border-t border-line px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
          <TabButton
            active={activeTab === "home"}
            onClick={() => goTo({ name: "main", tab: "home" }, "replace")}
          >
            홈
          </TabButton>
          <TabButton
            active={activeTab === "gallery"}
            onClick={() => {
              void refresh();
              goTo({ name: "main", tab: "gallery" }, "replace");
            }}
          >
            갤러리
          </TabButton>
          <TabButton
            active={activeTab === "match"}
            onClick={() => goTo({ name: "main", tab: "match" }, "replace")}
          >
            기록
          </TabButton>
        </nav>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept=".vpb,application/vnd.volleyball.playbook,.json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          void file.text().then((text) => {
            ingestBackupText(text);
          });
        }}
      />
      <CreatePlayModal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateForAlbumId(null);
        }}
        onCreate={(input) => void handleCreate(input)}
      />
      <RenameModal
        open={createAlbumOpen}
        title="새 전술 프로젝트"
        label="전술 프로젝트 이름"
        initial=""
        placeholder="예: 리시브 훈련"
        confirmLabel="만들기"
        onClose={() => setCreateAlbumOpen(false)}
        onSubmit={(title) => {
          void handleCreateAlbum(title).then((id) => {
            setCreateAlbumOpen(false);
            goTo({ name: "album", albumId: id, tab: "home" });
          });
        }}
      />
      <RenameModal
        open={Boolean(pendingRename)}
        title={pendingRename?.kind === "play" ? "전술 이름" : "전술 프로젝트 이름"}
        label="이름"
        initial={
          pendingRename?.kind === "play"
            ? pendingRename.play.title
            : pendingRename?.album.title ?? ""
        }
        confirmLabel="저장"
        onClose={() => setPendingRename(null)}
        onSubmit={(title) => {
          if (!pendingRename) return;
          if (pendingRename.kind === "album") {
            const next = { ...pendingRename.album, title, updatedAt: Date.now() };
            if (album?.id === next.id) setAlbum(next);
            setPendingRename(null);
            void saveAlbum(next).then(() => refresh());
            return;
          }
          const next = { ...pendingRename.play, title, updatedAt: Date.now() };
          setPendingRename(null);
          void savePlay(next).then(() => refresh());
        }}
      />
      <ConfirmModal
        open={Boolean(pendingDelete)}
        title={
          pendingDelete?.kind === "album"
            ? "전술 프로젝트 삭제"
            : pendingDelete?.kind === "preset"
              ? "대형 삭제"
              : "전술 삭제"
        }
        message={
          pendingDelete?.kind === "album"
            ? `‘${pendingDelete.album.title}’ 전술 프로젝트와 안의 전술을 모두 삭제할까요?`
            : pendingDelete?.kind === "preset"
              ? `‘${pendingDelete.preset.title}’ 대형을 삭제할까요?`
              : `‘${pendingDelete?.play.title ?? ""}’ 전술을 삭제할까요? 이 기기에서만 지워집니다.`
        }
        confirmLabel="삭제"
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void handleDelete()}
      />
      {backupOverlays}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl py-3 text-sm font-semibold ${
        active ? "bg-white/10 text-white" : "text-white/45"
      }`}
    >
      {children}
    </button>
  );
}
