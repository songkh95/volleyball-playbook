import { useEffect, useState } from "react";
import { isLightColor, OUR_TEAM_COLORS } from "../lib/colors";
import { LIBERO_WHITE, TEAM_BLUE, TEAM_RED, type CourtObject } from "../types/play";
import { Modal } from "./Modal";

type Props = {
  object: CourtObject | null;
  onClose: () => void;
  onSave: (patch: { label: string; color: string }) => void;
  onDelete: () => void;
};

export function EditPlayerModal({ object, onClose, onSave, onDelete }: Props) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(TEAM_RED);

  useEffect(() => {
    if (!object) return;
    setLabel(object.label);
    setColor(object.color);
  }, [object]);

  if (!object || object.kind !== "player") return null;

  return (
    <Modal open title="선수 정보" onClose={onClose}>
      <label className="mb-1 block text-sm text-white/70">이름 / 포지션</label>
      <input
        className="mb-4 w-full rounded-xl bg-ink px-3 py-3 outline-none ring-1 ring-line focus:ring-accent"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={12}
        placeholder="S, OH, 이름…"
      />

      <p className="mb-2 text-sm text-white/70">우리팀 색상</p>
      <div className="mb-4 grid grid-cols-5 gap-1.5">
        {OUR_TEAM_COLORS.map((c) => (
          <button
            key={c.n}
            type="button"
            title={`${c.n}. ${c.label}`}
            onClick={() => setColor(c.value)}
            className={`flex aspect-square items-center justify-center rounded-xl text-sm font-bold ring-2 ${
              color === c.value ? "ring-white" : "ring-transparent"
            }`}
            style={{
              background: c.value,
              color: isLightColor(c.value) ? "#1a1a2e" : "#fff",
            }}
          >
            {c.n}
          </button>
        ))}
      </div>

      <p className="mb-2 text-sm text-white/70">기타</p>
      <div className="mb-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setColor(TEAM_BLUE)}
          className={`rounded-xl py-2.5 text-xs font-medium text-white ring-1 ${
            color === TEAM_BLUE ? "ring-accent" : "ring-line"
          }`}
          style={{ background: TEAM_BLUE }}
        >
          상대 (블루)
        </button>
        <button
          type="button"
          onClick={() => setColor(LIBERO_WHITE)}
          className={`rounded-xl py-2.5 text-xs font-medium ring-1 ${
            color === LIBERO_WHITE ? "ring-accent" : "ring-line"
          }`}
          style={{ background: LIBERO_WHITE, color: "#1a1a2e" }}
        >
          리베로 (화이트)
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
          className="flex-1 rounded-xl bg-court py-3 font-semibold text-ink"
          onClick={() => onSave({ label: label.trim() || object.label, color })}
        >
          적용
        </button>
      </div>
    </Modal>
  );
}
