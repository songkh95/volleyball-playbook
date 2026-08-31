import { useState } from "react";
import { CoverCardGear, CoverSlot } from "../components/CoverSlot";
import { Modal } from "../components/Modal";
import { isBuiltinPreset } from "../lib/formations";
import type { Album, FormationPreset, Play } from "../types/play";
import { CourtThumb } from "./CourtThumb";

type Props = {
  albums: Album[];
  presets: FormationPreset[];
  plays: Play[];
  covers: Record<string, Blob>;
  onNewAlbum: () => void;
  onOpenAlbum: (id: string) => void;
  onRenameAlbum: (album: Album) => void;
  onDeleteAlbum: (album: Album) => void;
  onCoverChange: (id: string, kind: "album" | "play", blob: Blob | null) => void;
  onNewPreset: () => void;
  onOpenPreset: (id: string) => void;
  onDeletePreset: (preset: FormationPreset) => void;
  onBackup: () => void;
  onRestore: () => void;
};

export function HomeScreen({
  albums,
  presets,
  plays,
  covers,
  onNewAlbum,
  onOpenAlbum,
  onRenameAlbum,
  onDeleteAlbum,
  onCoverChange,
  onNewPreset,
  onOpenPreset,
  onDeletePreset,
  onBackup,
  onRestore,
}: Props) {
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  function playCount(albumId: string) {
    return plays.filter((p) => p.albumId === albumId).length;
  }

  function firstPlay(albumId: string) {
    return plays.find((p) => p.albumId === albumId);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 px-5 pb-3 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <p className="text-xs tracking-wide text-accent">VOLLEYBALL PLAYBOOK</p>
        <div className="mt-1 flex items-end justify-between gap-2">
          <h1 className="text-2xl font-bold">전술 보드</h1>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 glass"
            aria-label="설정"
            onClick={() => setSettingsOpen(true)}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <path
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
                d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
              />
              <path
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
                d="M19.4 13a1.8 1.8 0 0 0 0-2l1.6-1.3-1.6-2.8-2 .7a7 7 0 0 0-1.7-1L15.1 4h-3.2L11.3 6.6a7 7 0 0 0-1.7 1l-2-.7-1.6 2.8L7.6 11a1.8 1.8 0 0 0 0 2l-1.6 1.3 1.6 2.8 2-.7a7 7 0 0 0 1.7 1L11.9 20h3.2l.6-2.6a7 7 0 0 0 1.7-1l2 .7 1.6-2.8L19.4 13Z"
              />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-white/45">
          전술 프로젝트를 먼저 만들고 그 안에 전술을 넣으세요. 대형 프리셋은 아래에서
          만들어 전술 보드에서 불러올 수 있습니다.
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <section className="mb-7">
          <h2 className="mb-3 text-sm font-semibold text-white/80">전술 프로젝트</h2>
          {albums.length === 0 ? (
            <p className="mb-3 text-xs leading-relaxed text-white/45">
              전술 프로젝트가 없습니다. 먼저 프로젝트를 만든 뒤 전술 보드를 추가하세요.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onNewAlbum}
              className="flex aspect-[3/4] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 bg-black/30 text-white/80"
            >
              <span className="text-4xl font-light leading-none">+</span>
              <span className="mt-2 text-sm">새 전술 프로젝트</span>
            </button>
            {albums.map((album) => {
              const sample = firstPlay(album.id);
              return (
                <article
                  key={album.id}
                  className="relative flex aspect-[3/4] flex-col rounded-2xl glass"
                >
                  <div className="flex min-h-0 flex-1 flex-col p-3">
                    <CoverSlot
                      cover={covers[album.id]}
                      onOpen={() => onOpenAlbum(album.id)}
                      fallback={
                        sample ? (
                          <CourtThumb
                            court={sample.court}
                            objects={sample.cuts[0]?.objects ?? []}
                          />
                        ) : (
                          <div className="h-full w-full bg-court/80" />
                        )
                      }
                    />
                    <button
                      type="button"
                      className="mt-2 text-left"
                      onClick={() => onOpenAlbum(album.id)}
                    >
                      <h3 className="truncate text-sm font-semibold">{album.title}</h3>
                      <p className="text-xs text-white/50">전술 {playCount(album.id)}개</p>
                    </button>
                  </div>
                  <CoverCardGear
                    hasCover={Boolean(covers[album.id])}
                    onCoverChange={(blob) => onCoverChange(album.id, "album", blob)}
                    onRename={() => onRenameAlbum(album)}
                    onDelete={() => onDeleteAlbum(album)}
                  />
                </article>
              );
            })}
          </div>
        </section>

        <section>
          <button
            type="button"
            className="mb-3 flex w-full items-center justify-between gap-2"
            onClick={() => setPresetsOpen((v) => !v)}
            aria-expanded={presetsOpen}
          >
            <h2 className="text-sm font-semibold text-white/80">대형 프리셋</h2>
            <span className="text-xs text-white/50">
              {presetsOpen ? "접기 ∧" : `펴기 ∨${presets.length ? ` · ${presets.length}` : ""}`}
            </span>
          </button>
          {presetsOpen ? (
            <>
              {presets.length === 0 ? (
                <p className="mb-3 text-xs leading-relaxed text-white/45">
                  아직 대형이 없습니다. 자주 쓰는 선수 배치를 만들어 두면 전술 보드에서
                  바로 고를 수 있습니다.
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={onNewPreset}
                  className="flex aspect-[3/4] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 bg-black/30 text-white/80"
                >
                  <span className="text-4xl font-light leading-none">+</span>
                  <span className="mt-2 text-sm">새 대형</span>
                </button>
                {presets.map((preset) => (
                  <article
                    key={preset.id}
                    className="relative flex aspect-[3/4] flex-col overflow-hidden rounded-2xl glass"
                  >
                    <button
                      type="button"
                      className="flex min-h-0 flex-1 flex-col p-3 text-left"
                      onClick={() => onOpenPreset(preset.id)}
                    >
                      <div className="min-h-0 flex-1 overflow-hidden rounded-xl">
                        <CourtThumb court={preset.court} objects={preset.objects} />
                      </div>
                      <h3 className="mt-2 truncate text-sm font-semibold">{preset.title}</h3>
                      <p className="text-xs text-white/50">
                        {preset.court === "half" ? "하프" : "풀"} · {preset.rosterSize}인
                      </p>
                    </button>
                    {isBuiltinPreset(preset) ? null : (
                      <button
                        type="button"
                        className="absolute right-2 top-2 rounded-full bg-ink/80 px-2 py-1 text-[11px] text-white/80"
                        onClick={() => onDeletePreset(preset)}
                      >
                        삭제
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </>
          ) : null}
        </section>
      </div>

      <Modal open={settingsOpen} title="설정" onClose={() => setSettingsOpen(false)}>
        <p className="mb-2 text-xs font-semibold text-white/50">백업</p>
        <div className="mb-5 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            className="rounded-xl bg-ink py-3 text-sm text-white/85 ring-1 ring-line"
            onClick={onBackup}
          >
            백업 저장
          </button>
          <button
            type="button"
            className="rounded-xl bg-ink py-3 text-sm text-white/85 ring-1 ring-line"
            onClick={onRestore}
          >
            백업 불러오기
          </button>
        </div>
        <p className="mb-2 text-xs font-semibold text-white/50">크레딧</p>
        <p className="mb-4 text-sm leading-relaxed text-white/70">
          “Volleyball” 3D model by PatelDev, licensed under CC Attribution.
          <br />
          “volleyball net” 3D model by otyken, licensed under CC Attribution.
          <br />
          Safety cone icon by yoyonpujiono.
        </p>
        <a
          href="./privacy.html"
          className="inline-block text-[12px] text-white/45 underline-offset-2 hover:text-white/70"
        >
          개인정보 처리방침
        </a>
      </Modal>
    </div>
  );
}
