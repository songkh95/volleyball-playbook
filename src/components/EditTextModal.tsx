import { useEffect, useState } from "react";
import { TEXT_COLORS } from "../lib/colors";
import type { CourtObject } from "../types/play";
import { Modal } from "./Modal";

type Patch = {
  label: string;
  color: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
};

type Props = {
  object: CourtObject | null;
  onClose: () => void;
  onSave: (patch: Patch) => void;
  onDelete: () => void;
};

const SIZE_MIN = 12;
const SIZE_MAX = 36;

export function EditTextModal({ object, onClose, onSave, onDelete }: Props) {
  const [label, setLabel] = useState("텍스트");
  const [color, setColor] = useState("#ffffff");
  const [fontSize, setFontSize] = useState(18);
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);

  useEffect(() => {
    if (!object) return;
    setLabel(object.label);
    setColor(object.color);
    setFontSize(object.fontSize ?? 18);
    setBold(Boolean(object.bold));
    setItalic(Boolean(object.italic));
  }, [object]);

  if (!object || object.kind !== "text") return null;

  return (
    <Modal open title="텍스트" onClose={onClose}>
      <label className="mb-1 block text-sm text-white/70">내용</label>
      <input
        className="mb-4 w-full rounded-xl bg-ink px-3 py-3 outline-none ring-1 ring-line focus:ring-accent"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={24}
        placeholder="텍스트"
      />

      <p className="mb-2 text-sm text-white/70">폰트 크기 {fontSize}</p>
      <input
        type="range"
        min={SIZE_MIN}
        max={SIZE_MAX}
        value={fontSize}
        onChange={(e) => setFontSize(Number(e.target.value))}
        className="mb-4 w-full accent-accent"
      />

      <p className="mb-2 text-sm text-white/70">색상</p>
      <div className="mb-4 grid grid-cols-7 gap-1.5">
        {TEXT_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            title={c.label}
            aria-label={c.label}
            onClick={() => setColor(c.value)}
            className={`aspect-square rounded-xl ring-2 ${
              color === c.value ? "ring-white" : "ring-white/20"
            }`}
            style={{ background: c.value }}
          />
        ))}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setBold((v) => !v)}
          className={`rounded-xl py-2.5 text-sm font-bold ring-1 ${
            bold ? "bg-accent text-ink ring-accent" : "bg-ink text-white/80 ring-line"
          }`}
        >
          볼드
        </button>
        <button
          type="button"
          onClick={() => setItalic((v) => !v)}
          className={`rounded-xl py-2.5 text-sm italic ring-1 ${
            italic ? "bg-accent text-ink ring-accent" : "bg-ink text-white/80 ring-line"
          }`}
        >
          기울기
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-xl bg-red-800 px-3 py-3 text-sm font-semibold"
          onClick={onDelete}
        >
          삭제
        </button>
        <button
          type="button"
          className="flex-1 rounded-xl bg-ink py-3 text-white/80 ring-1 ring-line"
          onClick={onClose}
        >
          취소
        </button>
        <button
          type="button"
          className="flex-1 rounded-xl bg-accent py-3 font-semibold text-ink"
          onClick={() =>
            onSave({
              label: label.trim() || "텍스트",
              color,
              fontSize,
              bold,
              italic,
            })
          }
        >
          적용
        </button>
      </div>
    </Modal>
  );
}
