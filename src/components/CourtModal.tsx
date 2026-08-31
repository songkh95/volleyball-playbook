import { Modal } from "./Modal";
import type { CourtType } from "../types/play";

type Props = {
  open: boolean;
  value: CourtType;
  onClose: () => void;
  onSelect: (court: CourtType) => void;
};

export function CourtModal({ open, value, onClose, onSelect }: Props) {
  return (
    <Modal open={open} title="코트" onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <Choice
          active={value === "half"}
          onClick={() => {
            onSelect("half");
            onClose();
          }}
        >
          하프코트
        </Choice>
        <Choice
          active={value === "full"}
          onClick={() => {
            onSelect("full");
            onClose();
          }}
        >
          풀코트
        </Choice>
      </div>
      <p className="text-[11px] leading-relaxed text-white/40">
        선수·공·마킹 위치는 실제 거리 기준으로 맞춰집니다.
      </p>
    </Modal>
  );
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl py-3 text-sm font-medium ring-1 ${
        active ? "bg-accent text-ink ring-accent" : "bg-ink text-white/80 ring-line"
      }`}
    >
      {children}
    </button>
  );
}
