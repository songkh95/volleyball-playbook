import { CoverCardGear, CoverSlot } from "../components/CoverSlot";
import type { Album, Play } from "../types/play";
import { CourtThumb } from "./CourtThumb";

type Props = {
  album: Album;
  plays: Play[];
  covers: Record<string, Blob>;
  onBack: () => void;
  onRename: () => void;
  onNewPlay: () => void;
  onOpenPlay: (id: string) => void;
  onDeletePlay: (play: Play) => void;
  onCoverChange: (id: string, kind: "album" | "play", blob: Blob | null) => void;
};

export function AlbumScreen({
  album,
  plays,
  covers,
  onBack,
  onRename,
  onNewPlay,
  onOpenPlay,
  onDeletePlay,
  onCoverChange,
}: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 px-5 pb-3 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <button
          type="button"
          className="mb-2 text-sm text-white/60"
          onClick={onBack}
        >
          ← 뒤로
        </button>
        <button type="button" className="block w-full text-left" onClick={onRename}>
          <p className="text-xs tracking-wide text-accent">전술 프로젝트</p>
          <h1 className="mt-1 text-2xl font-bold">{album.title}</h1>
          <p className="mt-1 text-xs text-white/45">이름을 눌러 수정할 수 있습니다.</p>
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        {plays.length === 0 ? (
          <div className="mb-4 rounded-2xl bg-panel p-4 text-sm text-white/60 ring-1 ring-line">
            이 전술 프로젝트에 전술이 없습니다. 새 전술 보드를 만들어 주세요.
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onNewPlay}
            className="flex aspect-[3/4] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line text-white/70"
          >
            <span className="text-4xl font-light leading-none">+</span>
            <span className="mt-2 text-sm">새 전술</span>
          </button>
          {plays.map((play) => (
            <article
              key={play.id}
              className="relative flex aspect-[3/4] flex-col rounded-2xl bg-panel ring-1 ring-line"
            >
              <div className="flex min-h-0 flex-1 flex-col p-3">
                <CoverSlot
                  cover={covers[play.id]}
                  onOpen={() => onOpenPlay(play.id)}
                  fallback={
                    <CourtThumb
                      court={play.court}
                      objects={play.cuts[0]?.objects ?? []}
                    />
                  }
                />
                <button
                  type="button"
                  className="mt-2 text-left"
                  onClick={() => onOpenPlay(play.id)}
                >
                  <h2 className="truncate text-sm font-semibold">{play.title}</h2>
                  <p className="text-xs text-white/50">
                    {play.court === "half" ? "하프" : "풀"} · {play.rosterSize}인 · 컷{" "}
                    {play.cuts.length}
                  </p>
                </button>
              </div>
              <CoverCardGear
                hasCover={Boolean(covers[play.id])}
                onCoverChange={(blob) => onCoverChange(play.id, "play", blob)}
                onDelete={() => onDeletePlay(play)}
              />
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
