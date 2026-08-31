import { useEffect, useState } from "react";
import { Modal } from "./Modal";

type Props = {
  open: boolean;
  title?: string;
  label?: string;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
  suggestions?: readonly string[];
  onClose: () => void;
  onSubmit: (value: string) => void;
};

export function RenameModal({
  open,
  title = "이름",
  label = "이름",
  initial = "",
  placeholder,
  confirmLabel = "확인",
  suggestions,
  onClose,
  onSubmit,
}: Props) {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);

  if (!open) return null;

  function submit() {
    onSubmit(value.trim() || initial.trim() || "이름 없음");
  }

  return (
    <Modal open title={title} onClose={onClose}>
      <label className="mb-1 block text-sm text-white/70">{label}</label>
      {suggestions && suggestions.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {suggestions.map((name) => (
            <button
              key={name}
              type="button"
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                value === name
                  ? "bg-accent text-ink"
                  : "bg-ink text-white/80 ring-1 ring-line"
              }`}
              onClick={() => onSubmit(name)}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}
      <input
        className="mb-5 w-full rounded-xl bg-ink px-3 py-3 outline-none ring-1 ring-line focus:ring-accent"
        value={value}
        placeholder={placeholder}
        maxLength={40}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
      />
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
          className="flex-1 rounded-xl bg-accent py-3 font-semibold text-ink"
          onClick={submit}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
