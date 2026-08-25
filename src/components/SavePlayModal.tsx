import { useEffect, useState } from "react";
import type { Album } from "../types/play";
import { Modal } from "./Modal";

type Props = {
  open: boolean;
  title: string;
  albumId: string;
  albums: Album[];
  onClose: () => void;
  onCreateAlbum: (title: string) => Promise<string>;
  onSave: (input: { title: string; albumId: string }) => void;
  onSaveAndNew: (input: { title: string; albumId: string }) => void;
};

export function SavePlayModal({
  open,
  title,
  albumId,
  albums,
  onClose,
  onCreateAlbum,
  onSave,
  onSaveAndNew,
}: Props) {
  const [name, setName] = useState(title);
  const [selected, setSelected] = useState(albumId);
  const [newAlbum, setNewAlbum] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(title);
    setSelected(albumId);
    setNewAlbum("");
  }, [open, title, albumId]);

  if (!open) return null;

  const album = selected || albums[0]?.id || "";

  function payload() {
    return { title: name.trim() || "새 전술", albumId: album };
  }

  async function addAlbum() {
    const id = await onCreateAlbum(newAlbum.trim() || "새 전술 앨범");
    setSelected(id);
    setNewAlbum("");
  }

  return (
    <Modal open title="전술 저장" onClose={onClose}>
      <label className="mb-1 block text-sm text-white/70">이름</label>
      <input
        className="mb-4 w-full rounded-xl bg-ink px-3 py-3 outline-none ring-1 ring-line focus:ring-accent"
        value={name}
        maxLength={40}
        placeholder="전술 이름"
        onChange={(e) => setName(e.target.value)}
      />

      <p className="mb-2 text-sm text-white/70">전술 앨범</p>
      {albums.length === 0 ? (
        <p className="mb-3 text-xs text-white/50">전술 앨범이 없습니다. 아래에서 먼저 만들어 주세요.</p>
      ) : (
        <div className="mb-3 grid max-h-40 gap-2 overflow-y-auto">
          {albums.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelected(a.id)}
              className={`rounded-xl px-4 py-3 text-left text-sm ring-1 ${
                selected === a.id
                  ? "bg-court font-semibold text-ink ring-court"
                  : "bg-ink text-white/80 ring-line"
              }`}
            >
              {a.title}
            </button>
          ))}
        </div>
      )}

      <div className="mb-5 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl bg-ink px-3 py-2.5 text-sm outline-none ring-1 ring-line focus:ring-accent"
          value={newAlbum}
          maxLength={40}
          placeholder="새 전술 앨범 이름"
          onChange={(e) => setNewAlbum(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void addAlbum();
          }}
        />
        <button
          type="button"
          className="shrink-0 rounded-xl px-3 py-2.5 text-sm text-white/80 ring-1 ring-line"
          onClick={() => void addAlbum()}
        >
          앨범 만들기
        </button>
      </div>

      <div className="grid gap-2">
        <button
          type="button"
          className="rounded-xl bg-court py-3 font-semibold text-ink disabled:opacity-40"
          disabled={!album}
          onClick={() => onSave(payload())}
        >
          저장하고 갤러리로
        </button>
        <button
          type="button"
          className="rounded-xl bg-ink py-3 text-sm text-white/85 ring-1 ring-line disabled:opacity-40"
          disabled={!album}
          onClick={() => onSaveAndNew(payload())}
        >
          저장 후 새 작업
        </button>
        <p className="text-center text-[11px] leading-relaxed text-white/40">
          저장 후 새 작업은 지금 내용을 전술 앨범에 두고, 같은 상태로 새 전술을 이어갑니다.
        </p>
        <button type="button" className="rounded-xl py-3 text-sm text-white/60" onClick={onClose}>
          취소
        </button>
      </div>
    </Modal>
  );
}
