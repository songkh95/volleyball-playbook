import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { fileToCoverBlob, isImageFile } from "../lib/coverImage";
import { Modal } from "./Modal";

type Props = {
  cover?: Blob | null;
  fallback: ReactNode;
  onOpen?: () => void;
  onChange: (blob: Blob | null) => void;
};

export function CoverSlot({ cover, fallback, onOpen, onChange }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localCover, setLocalCover] = useState<Blob | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const shown = localCover ?? cover ?? null;

  useEffect(() => {
    if (cover) setLocalCover(null);
  }, [cover]);

  async function applyFile(file: File | undefined) {
    if (!file) return;
    if (!isImageFile(file)) {
      setError("이미지 파일만 선택할 수 있습니다.");
      return;
    }
    try {
      setError(null);
      const blob = await fileToCoverBlob(file);
      setLocalCover(blob);
      onChange(blob);
      setMenuOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "사진을 넣지 못했습니다.");
    }
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl">
      <button
        type="button"
        className="block h-full w-full overflow-hidden"
        onClick={onOpen}
      >
        {shown ? <CoverImg blob={shown} /> : fallback}
      </button>
      <button
        type="button"
        className="absolute bottom-2 left-2 rounded-full bg-ink/80 px-2 py-1 text-[11px] text-white/85"
        onClick={(e) => {
          e.stopPropagation();
          setError(null);
          setMenuOpen(true);
        }}
      >
        사진
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
      <Modal open={menuOpen} title="커버 사진" onClose={() => setMenuOpen(false)}>
        <div className="flex flex-col gap-2">
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <button
            type="button"
            className="rounded-xl bg-court py-3 font-semibold text-ink"
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
          {shown ? (
            <button
              type="button"
              className="rounded-xl py-3 text-sm text-white/60"
              onClick={() => {
                setLocalCover(null);
                onChange(null);
                setMenuOpen(false);
              }}
            >
              사진 빼기
            </button>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}

export function CoverImg({ blob }: { blob: Blob }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img src={url} alt="" draggable={false} className="h-full w-full object-cover" />;
}
