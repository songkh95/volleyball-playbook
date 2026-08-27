import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { fileToCoverBlob, isImageFile } from "../lib/coverImage";
import { Modal } from "./Modal";

type CoverSlotProps = {
  cover?: Blob | null;
  fallback: ReactNode;
  onOpen?: () => void;
};

export function CoverSlot({ cover, fallback, onOpen }: CoverSlotProps) {
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl">
      <button
        type="button"
        className="block h-full w-full overflow-hidden"
        onClick={onOpen}
      >
        {cover ? <CoverImg blob={cover} /> : fallback}
      </button>
    </div>
  );
}

type CoverCardGearProps = {
  hasCover: boolean;
  onCoverChange: (blob: Blob | null) => void;
  onRename: () => void;
  onDelete: () => void;
};

export function CoverCardGear({
  hasCover,
  onCoverChange,
  onRename,
  onDelete,
}: CoverCardGearProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  async function applyFile(file: File | undefined) {
    if (!file) return;
    if (!isImageFile(file)) {
      setError("이미지 파일만 선택할 수 있습니다.");
      return;
    }
    try {
      setError(null);
      const blob = await fileToCoverBlob(file);
      onCoverChange(blob);
      setMenuOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "사진을 넣지 못했습니다.");
    }
  }

  return (
    <>
      <button
        type="button"
        className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-ink/80 text-white/85"
        aria-label="관리"
        onClick={(e) => {
          e.stopPropagation();
          setError(null);
          setMenuOpen(true);
        }}
      >
        <GearIcon />
      </button>
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void applyFile(file);
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void applyFile(file);
        }}
      />
      <Modal open={menuOpen} title="관리" onClose={() => setMenuOpen(false)}>
        <div className="flex flex-col gap-2">
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <button
            type="button"
            className="rounded-xl bg-accent py-3 font-semibold text-ink"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(false);
              window.setTimeout(onRename, 0);
            }}
          >
            이름 수정
          </button>
          <button
            type="button"
            className="rounded-xl bg-ink py-3 text-white/85 ring-1 ring-line"
            onClick={() => galleryRef.current?.click()}
          >
            갤러리에서 선택
          </button>
          <button
            type="button"
            className="rounded-xl bg-ink py-3 text-white/85 ring-1 ring-line"
            onClick={() => cameraRef.current?.click()}
          >
            카메라로 촬영
          </button>
          {hasCover ? (
            <button
              type="button"
              className="rounded-xl bg-ink py-3 text-sm text-white/70 ring-1 ring-line"
              onClick={() => {
                onCoverChange(null);
                setMenuOpen(false);
              }}
            >
              사진 빼기
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-xl bg-red-800 py-3 text-sm font-semibold"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(false);
              window.setTimeout(onDelete, 0);
            }}
          >
            삭제
          </button>
        </div>
      </Modal>
    </>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
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
  );
}

export function CoverImg({ blob }: { blob: Blob }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img src={url} alt="" draggable={false} className="h-full w-full object-cover" />;
}
