import { useState } from "react";
import type { CourtType, RosterSize } from "../types/play";
import { Modal } from "./Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { title: string; court: CourtType; rosterSize: RosterSize }) => void;
};

export function CreatePlayModal({ open, onClose, onCreate }: Props) {
  const [title, setTitle] = useState("");
  const [court, setCourt] = useState<CourtType>("half");
  const [rosterSize, setRosterSize] = useState<RosterSize>(6);

  function submit() {
    onCreate({ title: title.trim() || "새 전술", court, rosterSize });
    setTitle("");
    setCourt("half");
    setRosterSize(6);
  }

  return (
    <Modal open={open} title="새 전술" onClose={onClose}>
      <label className="mb-1 block text-sm text-white/70">제목</label>
      <input
        className="mb-4 w-full rounded-xl bg-ink px-3 py-3 outline-none ring-1 ring-line focus:ring-accent"
        placeholder="예: A퀵 페이크 공격"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={40}
      />

      <p className="mb-2 text-sm text-white/70">코트</p>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <Choice active={court === "half"} onClick={() => setCourt("half")}>
          하프코트
        </Choice>
        <Choice active={court === "full"} onClick={() => setCourt("full")}>
          풀코트
        </Choice>
      </div>

      <p className="mb-2 text-sm text-white/70">인원</p>
      <div className="mb-6 grid grid-cols-2 gap-2">
        <Choice active={rosterSize === 6} onClick={() => setRosterSize(6)}>
          6인제
        </Choice>
        <Choice active={rosterSize === 9} onClick={() => setRosterSize(9)}>
          9인제
        </Choice>
      </div>

      <div className="flex gap-2">
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
          onClick={submit}
        >
          만들기
        </button>
      </div>
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
        active ? "bg-court text-ink ring-court" : "bg-ink text-white/80 ring-line"
      }`}
    >
      {children}
    </button>
  );
}
