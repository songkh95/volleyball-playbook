import { Modal } from "./Modal";

type Props = {
  open: boolean;
  title?: string;
  message?: string;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
};

export function LeaveSaveModal({
  open,
  title = "저장할까요?",
  message = "저장하지 않으면 지금 바꾼 내용이 되돌아갑니다.",
  onCancel,
  onDiscard,
  onSave,
}: Props) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p className="mb-6 text-sm leading-relaxed text-white/75">{message}</p>
      <div className="grid gap-2">
        <button
          type="button"
          className="rounded-xl bg-accent py-3 font-semibold text-ink"
          onClick={onSave}
        >
          저장
        </button>
        <button
          type="button"
          className="rounded-xl bg-ink py-3 text-sm text-white/85 ring-1 ring-line"
          onClick={onDiscard}
        >
          저장 안 함
        </button>
        <button type="button" className="rounded-xl py-3 text-sm text-white/60" onClick={onCancel}>
          취소
        </button>
      </div>
    </Modal>
  );
}
