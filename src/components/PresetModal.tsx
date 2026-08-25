import type { FormationPreset } from "../types/play";
import { Modal } from "./Modal";

type Props = {
  open: boolean;
  presets: FormationPreset[];
  onClose: () => void;
  onSelect: (preset: FormationPreset) => void;
};

export function PresetModal({ open, presets, onClose, onSelect }: Props) {
  return (
    <Modal open={open} title="대형 프리셋" onClose={onClose}>
      <p className="mb-3 text-sm text-white/60">현재 컷의 선수·공 위치를 바꿉니다.</p>
      {presets.length === 0 ? (
        <p className="mb-4 rounded-xl bg-ink px-4 py-3 text-sm leading-relaxed text-white/55 ring-1 ring-line">
          저장된 대형이 없습니다. 홈 화면에서 대형 프리셋을 먼저 만들어 주세요.
        </p>
      ) : (
        <div className="grid max-h-72 gap-2 overflow-y-auto">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              className="rounded-xl bg-ink px-4 py-3 text-left ring-1 ring-line"
              onClick={() => {
                onSelect(p);
                onClose();
              }}
            >
              <span className="block text-sm font-semibold">{p.title}</span>
              <span className="text-xs text-white/50">
                {p.court === "half" ? "하프" : "풀"} · {p.rosterSize}인
              </span>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className="mt-4 w-full rounded-xl py-3 text-sm text-white/70 ring-1 ring-line"
        onClick={onClose}
      >
        닫기
      </button>
    </Modal>
  );
}
