import { useState } from "react";
import type { Album, FormationPreset, Play } from "../types/play";
import { CourtThumb } from "./CourtThumb";

type Props = {
  albums: Album[];
  presets: FormationPreset[];
  plays: Play[];
  onNewAlbum: () => void;
  onOpenAlbum: (id: string) => void;
  onDeleteAlbum: (album: Album) => void;
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
  onNewAlbum,
  onOpenAlbum,
  onDeleteAlbum,
  onNewPreset,
  onOpenPreset,
  onDeletePreset,
  onBackup,
  onRestore,
}: Props) {
  const [presetsOpen, setPresetsOpen] = useState(false);

  function playCount(albumId: string) {
    return plays.filter((p) => p.albumId === albumId).length;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 px-5 pb-3 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <p className="text-xs tracking-wide text-accent">VOLLEYBALL PLAYBOOK</p>
        <div className="mt-1 flex items-end justify-between gap-2">
          <h1 className="text-2xl font-bold">전술 보드</h1>
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              className="rounded-lg px-2.5 py-1.5 text-xs text-white/80 ring-1 ring-line"
              onClick={onBackup}
            >
              백업 저장
            </button>
            <button
              type="button"
              className="rounded-lg px-2.5 py-1.5 text-xs text-white/80 ring-1 ring-line"
              onClick={onRestore}
            >
              백업 불러오기
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-white/45">
          전술 앨범을 먼저 만들고 그 안에 전술을 넣으세요. 대형 프리셋은 아래에서
          만들어 전술 보드에서 불러올 수 있습니다.
        </p>
        <a
          href="./privacy.html"
          className="mt-2 inline-block text-[11px] text-white/35 underline-offset-2 hover:text-white/60"
        >
          개인정보 처리방침
        </a>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <section className="mb-7">
          <h2 className="mb-3 text-sm font-semibold text-white/80">전술 앨범</h2>
          {albums.length === 0 ? (
            <p className="mb-3 text-xs leading-relaxed text-white/45">
              전술 앨범이 없습니다. 먼저 앨범을 만든 뒤 전술 보드를 추가하세요.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onNewAlbum}
              className="flex aspect-[3/4] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line text-white/70"
            >
              <span className="text-4xl font-light leading-none">+</span>
              <span className="mt-2 text-sm">새 전술 앨범</span>
            </button>
            {albums.map((album) => (
              <article
                key={album.id}
                className="relative flex aspect-[3/4] flex-col overflow-hidden rounded-2xl bg-panel ring-1 ring-line"
              >
                <button
                  type="button"
                  className="flex min-h-0 flex-1 flex-col p-3 text-left"
                  onClick={() => onOpenAlbum(album.id)}
                >
                  <div className="min-h-0 flex-1 rounded-xl bg-court/80" />
                  <h3 className="mt-2 truncate text-sm font-semibold">{album.title}</h3>
                  <p className="text-xs text-white/50">전술 {playCount(album.id)}개</p>
                </button>
                <button
                  type="button"
                  className="absolute right-2 top-2 rounded-full bg-ink/80 px-2 py-1 text-[11px] text-white/80"
                  onClick={() => onDeleteAlbum(album)}
                >
                  삭제
                </button>
              </article>
            ))}
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
                  className="flex aspect-[3/4] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line text-white/70"
                >
                  <span className="text-4xl font-light leading-none">+</span>
                  <span className="mt-2 text-sm">새 대형</span>
                </button>
                {presets.map((preset) => (
                  <article
                    key={preset.id}
                    className="relative flex aspect-[3/4] flex-col overflow-hidden rounded-2xl bg-panel ring-1 ring-line"
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
                    <button
                      type="button"
                      className="absolute right-2 top-2 rounded-full bg-ink/80 px-2 py-1 text-[11px] text-white/80"
                      onClick={() => onDeletePreset(preset)}
                    >
                      삭제
                    </button>
                  </article>
                ))}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
