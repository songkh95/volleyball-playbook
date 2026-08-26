import { useEffect, useState } from "react";
import { CONE_COLORS } from "../lib/colors";
import { TEAM_BLUE, type CourtObject } from "../types/play";
import { Modal } from "./Modal";

type Props = {
  object: CourtObject | null;
  onClose: () => void;
  onSave: (patch: { color: string }) => void;
  onDelete: () => void;
};

export function EditConeModal({ object, onClose, onSave, onDelete }: Props) {
  const [color, setColor] = useState(TEAM_BLUE);

  useEffect(() => {
    if (!object) return;
    setColor(object.color);
  }, [object]);

  if (!object || object.kind !== "cone") return null;

  return (
    <Modal open title="콘" onClose={onClose}>
      <p className="mb-2 text-sm text-white/70">색상</p>
      <div className="mb-5 grid grid-cols-7 gap-1.5">
        {CONE_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            title={c.label}
            aria-label={c.label}
            onClick={() => setColor(c.value)}
            className={`aspect-square rounded-xl ring-2 ${
              color === c.value ? "ring-white" : "ring-transparent"
            }`}
            style={{ background: c.value }}
          />
        ))}
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
          onClick={() => onSave({ color })}
        >
          적용
        </button>
      </div>
    </Modal>
  );
}
