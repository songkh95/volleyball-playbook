import { useEffect, useMemo, useState } from "react";
import { ConfirmModal } from "../components/ConfirmModal";
import { Modal } from "../components/Modal";
import { downloadBlob, fileSafeName } from "../lib/capture";
import { CoverImg } from "../components/CoverSlot";
import { sceneLabel } from "../lib/defaultPlay";
import type { Album, GalleryCapture, Play } from "../types/play";
import { CourtThumb } from "./CourtThumb";

type Folder = {
  playId: string;
  title: string;
  items: GalleryCapture[];
};

type Props = {
  albums: Album[];
  plays: Play[];
  captures: GalleryCapture[];
  covers: Record<string, Blob>;
  onOpenAlbum: (id: string) => void;
  onOpenPlay: (id: string) => void;
  onDeleteCapture: (id: string) => void;
};

export function GalleryScreen({
  albums,
  plays,
  captures,
  covers,
  onOpenAlbum,
  onOpenPlay,
  onDeleteCapture,
}: Props) {
  const [folderPlayId, setFolderPlayId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<GalleryCapture | null>(null);
  const [pendingDelete, setPendingDelete] = useState<GalleryCapture | null>(null);
  const [capturesOpen, setCapturesOpen] = useState(true);
  const [openAlbums, setOpenAlbums] = useState<Record<string, boolean>>({});

  const folders = useMemo(() => {
    const map = new Map<string, Folder>();
    for (const cap of captures) {
      const play = plays.find((p) => p.id === cap.playId);
      const title = play?.title || cap.playTitle;
      const cur = map.get(cap.playId);
      if (cur) cur.items.push(cap);
      else map.set(cap.playId, { playId: cap.playId, title, items: [cap] });
    }
    return [...map.values()].sort(
      (a, b) => (b.items[0]?.createdAt ?? 0) - (a.items[0]?.createdAt ?? 0),
    );
  }, [captures, plays]);

  const folder = folders.find((f) => f.playId === folderPlayId) ?? null;
  const groupedPlays = albums
    .map((album) => ({
      album,
      items: plays.filter((p) => p.albumId === album.id),
    }))
    .filter((g) => g.items.length > 0);

  if (folder) {
    const playExists = plays.some((p) => p.id === folder.playId);
    return (
      <div className="flex h-full min-h-0 flex-col">
        <header className="shrink-0 px-5 pb-3 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <button
            type="button"
            className="mb-2 text-sm text-white/60"
            onClick={() => setFolderPlayId(null)}
          >
            ← 갤러리
          </button>
          <p className="text-xs tracking-wide text-accent">CAPTURE</p>
          <h1 className="mt-1 text-2xl font-bold">{folder.title}</h1>
          <p className="mt-1 text-xs text-white/45">캡처 {folder.items.length}장</p>
          {playExists ? (
            <button
              type="button"
              className="mt-3 rounded-xl px-3 py-2 text-sm text-white/80 ring-1 ring-line"
              onClick={() => onOpenPlay(folder.playId)}
            >
              전술 열기
            </button>
          ) : null}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
          <div className="grid grid-cols-2 gap-3">
            {folder.items.map((cap) => (
              <button
                key={cap.id}
                type="button"
                className="overflow-hidden rounded-2xl glass"
                onClick={() => setViewing(cap)}
              >
                <div className="aspect-[3/4] overflow-hidden">
                  <CaptureImg blob={cap.blob} />
                </div>
                <p className="truncate px-2 py-2 text-xs text-white/60">
                  {sceneLabel(cap.cutName)} · {formatWhen(cap.createdAt)}
                </p>
              </button>
            ))}
          </div>
        </div>
        <CaptureViewer
          capture={viewing}
          onClose={() => setViewing(null)}
          onDownload={(cap) =>
            downloadBlob(
              cap.blob,
              `${fileSafeName(folder.title)}-${fileSafeName(cap.cutName)}`,
            )
          }
          onDelete={(cap) => {
            setViewing(null);
            setPendingDelete(cap);
          }}
        />
        <ConfirmModal
          open={Boolean(pendingDelete)}
          title="캡처 삭제"
          message="이 캡처를 갤러리에서 삭제할까요? 이미 기기에 받은 파일은 그대로 있습니다."
          confirmLabel="삭제"
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            if (!pendingDelete) return;
            onDeleteCapture(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 px-5 pb-3 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <p className="text-xs tracking-wide text-accent">ARCHIVE</p>
        <h1 className="mt-1 text-2xl font-bold">갤러리</h1>
        <p className="mt-2 text-xs leading-relaxed text-white/45">
          캡처한 이미지·GIF·영상은 전술 제목 폴더에 모입니다. 백업 파일에는 들어가지 않습니다.
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <section>
          <button
            type="button"
            className="mb-3 flex w-full items-center justify-between gap-2"
            onClick={() => setCapturesOpen((v) => !v)}
            aria-expanded={capturesOpen}
          >
            <h2 className="text-sm font-semibold text-white/80">캡처</h2>
            <span className="text-xs text-white/50">
              {capturesOpen ? "접기 ∧" : `펴기 ∨${folders.length ? ` · ${folders.length}` : ""}`}
            </span>
          </button>
          {capturesOpen ? (
            folders.length === 0 ? (
              <div className="rounded-2xl glass px-4 py-5 text-sm leading-relaxed text-white/55">
                아직 캡처가 없습니다. 전술 보드에서 [캡처]나 [영상]을 누르면 이 전술 폴더에
                저장됩니다.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {folders.map((item) => (
                  <button
                    key={item.playId}
                    type="button"
                    className="overflow-hidden rounded-2xl glass p-3 text-left"
                    onClick={() => setFolderPlayId(item.playId)}
                  >
                    <div className="aspect-[3/4] overflow-hidden rounded-xl">
                      <CaptureImg blob={item.items[0].blob} />
                    </div>
                    <h3 className="mt-2 truncate text-sm font-semibold">{item.title}</h3>
                    <p className="text-xs text-white/50">캡처 {item.items.length}장</p>
                  </button>
                ))}
              </div>
            )
          ) : null}
        </section>

        <section className="mt-6 border-t border-line pt-6">
          <h2 className="mb-3 text-sm font-semibold text-white/80">전술 프로젝트</h2>
          {groupedPlays.length === 0 ? (
            <p className="text-sm text-white/45">저장된 전술이 없습니다.</p>
          ) : (
            groupedPlays.map(({ album, items }) => {
              const open = Boolean(openAlbums[album.id]);
              return (
                <div key={album.id} className="mb-4">
                  <div className="mb-3 flex items-center gap-2">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                      onClick={() =>
                        setOpenAlbums((prev) => ({ ...prev, [album.id]: !open }))
                      }
                      aria-expanded={open}
                    >
                      <h3 className="truncate text-sm font-semibold">{album.title}</h3>
                      <span className="shrink-0 text-xs text-white/50">
                        {open ? "접기 ∧" : `펴기 ∨ · ${items.length}`}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="shrink-0 text-xs text-white/45"
                      onClick={() => onOpenAlbum(album.id)}
                    >
                      전체 보기
                    </button>
                  </div>
                  {open ? (
                    <div className="grid grid-cols-2 gap-3">
                      {items.map((play) => (
                        <button
                          key={play.id}
                          type="button"
                          className="flex aspect-[3/4] flex-col overflow-hidden rounded-2xl glass p-3 text-left"
                          onClick={() => onOpenPlay(play.id)}
                        >
                          <div className="min-h-0 flex-1 overflow-hidden rounded-xl">
                            {covers[play.id] ? (
                              <CoverImg blob={covers[play.id]} />
                            ) : (
                              <CourtThumb
                                court={play.court}
                                objects={play.cuts[0]?.objects ?? []}
                              />
                            )}
                          </div>
                          <h4 className="mt-2 truncate text-sm font-semibold">{play.title}</h4>
                          <p className="text-xs text-white/50">
                            {play.court === "half" ? "하프" : "풀"} · 장면 {play.cuts.length}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}

function CaptureImg({
  blob,
  fit = "cover",
  controls = false,
}: {
  blob: Blob;
  fit?: "cover" | "contain";
  controls?: boolean;
}) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const cls = `h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"}`;
  if (blob.type.startsWith("video/")) {
    return (
      <video
        src={url}
        className={cls}
        muted
        playsInline
        autoPlay
        loop
        controls={controls}
        preload="metadata"
      />
    );
  }
  return <img src={url} alt="" className={cls} />;
}

function CaptureViewer({
  capture,
  onClose,
  onDownload,
  onDelete,
}: {
  capture: GalleryCapture | null;
  onClose: () => void;
  onDownload: (capture: GalleryCapture) => void;
  onDelete: (capture: GalleryCapture) => void;
}) {
  if (!capture) return null;
  return (
    <Modal open title={sceneLabel(capture.cutName)} onClose={onClose}>
      <div className="mb-4 h-64 overflow-hidden rounded-xl bg-ink">
        <CaptureImg blob={capture.blob} fit="contain" controls />
      </div>
      <p className="mb-4 text-xs text-white/45">{formatWhen(capture.createdAt)}</p>
      <div className="grid gap-2">
        <button
          type="button"
          className="rounded-xl bg-accent py-3 font-semibold text-ink"
          onClick={() => onDownload(capture)}
        >
          기기에 다시 저장
        </button>
        <button
          type="button"
          className="rounded-xl bg-ink py-3 text-white/85 ring-1 ring-line"
          onClick={() => onDelete(capture)}
        >
          삭제
        </button>
        <button type="button" className="rounded-xl py-3 text-sm text-white/60" onClick={onClose}>
          닫기
        </button>
      </div>
    </Modal>
  );
}

function formatWhen(ts: number) {
  const d = new Date(ts);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  const h = `${d.getHours()}`.padStart(2, "0");
  const min = `${d.getMinutes()}`.padStart(2, "0");
  return `${m}/${day} ${h}:${min}`;
}
