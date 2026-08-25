import { Modal } from "./Modal";
import type { ZoneMode } from "../types/play";

type Props = {
  open: boolean;
  value: ZoneMode;
  onClose: () => void;
  onSelect: (mode: ZoneMode) => void;
};

const OPTIONS: { id: ZoneMode; label: string }[] = [
  { id: "none", label: "표시 안함" },
  { id: "split-tb", label: "2분할 · 상하" },
  { id: "split-lr", label: "2분할 · 좌우" },
  { id: "6", label: "6구역 (1~6)" },
  { id: "9", label: "9구역 (1~9)" },
];

export function ZoneModal({ open, value, onClose, onSelect }: Props) {
  return (
    <Modal open={open} title="구역 가이드" onClose={onClose}>
      <div className="mb-4 grid gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`rounded-xl py-3 text-sm font-medium ring-1 ${
              value === o.id ? "bg-accent text-ink ring-accent" : "bg-ink text-white/80 ring-line"
            }`}
            onClick={() => {
              onSelect(o.id);
              onClose();
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </Modal>
  );
}
