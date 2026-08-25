import { Modal } from "./Modal";

type Props = {
  open: boolean;
  count: number;
  onClose: () => void;
  onAdd: () => void;
  onReplace: () => void;
};

export function ImportBackupModal({ open, count, onClose, onAdd, onReplace }: Props) {
  if (!open) return null;
  return (
    <Modal open title="백업 불러오기" onClose={onClose}>
      <p className="mb-5 text-sm leading-relaxed text-white/75">
        파일에서 전술 {count}개를 찾았습니다. 지금 목록에 더할지, 기존 전술을
        모두 지우고 이 파일로 바꿀지 고르세요.
      </p>
      <div className="grid gap-2">
        <button
          type="button"
          className="rounded-xl bg-accent py-3 font-semibold text-ink"
          onClick={onAdd}
        >
          목록에 추가
        </button>
        <button
          type="button"
          className="rounded-xl bg-ink py-3 text-white/85 ring-1 ring-line"
          onClick={onReplace}
        >
          전부 교체
        </button>
        <button
          type="button"
          className="rounded-xl py-3 text-sm text-white/60"
          onClick={onClose}
        >
          취소
        </button>
      </div>
    </Modal>
  );
}
