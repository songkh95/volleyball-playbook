import { Modal } from "./Modal";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "확인",
  onClose,
  onConfirm,
}: Props) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="mb-6 whitespace-pre-line text-sm leading-relaxed text-white/75">{message}</p>
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
          className="flex-1 rounded-xl bg-red-700 py-3 font-semibold"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
