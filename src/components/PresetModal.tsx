import { useEffect, useState } from "react";
import type { FormationPreset } from "../types/play";
import { Modal } from "./Modal";

type Props = {
  open: boolean;
  presets: FormationPreset[];
  onClose: () => void;
  onSelect: (preset: FormationPreset) => void;
  onCreateNew?: () => void;
};

export function PresetModal({ open, presets, onClose, onSelect, onCreateNew }: Props) {
  const [confirmCreate, setConfirmCreate] = useState(false);

  useEffect(() => {
    if (!open) setConfirmCreate(false);
  }, [open]);

  if (confirmCreate) {
    return (
      <Modal open={open} title="새 대형" onClose={() => setConfirmCreate(false)}>
        <p className="mb-2 text-sm leading-relaxed text-white/75">
          현재 전술을 저장하고 새 대형을 만들까요?
        </p>
        <p className="mb-4 text-xs leading-relaxed text-white/45">
          지금 보드는 저장해 두고, 대형 편집 화면으로 이동합니다.
        </p>
        <button
          type="button"
          className="mb-2 w-full rounded-xl bg-accent py-3 font-semibold text-ink"
          onClick={() => {
            setConfirmCreate(false);
            onCreateNew?.();
          }}
        >
          저장하고 새 대형 만들기
        </button>
        <button
          type="button"
          className="w-full rounded-xl py-3 text-sm text-white/70 ring-1 ring-line"
          onClick={() => setConfirmCreate(false)}
        >
          취소
        </button>
      </Modal>
    );
  }

  return (
    <Modal open={open} title="대형 프리셋" onClose={onClose}>
      {presets.length === 0 ? (
        <>
          <p className="mb-4 rounded-xl bg-ink px-4 py-3 text-sm leading-relaxed text-white/55 ring-1 ring-line">
            저장된 대형이 없습니다. 현재 전술을 저장한 뒤 새 대형을 만들 수 있습니다.
          </p>
          {onCreateNew ? (
            <button
              type="button"
              className="mb-2 w-full rounded-xl bg-accent py-3 font-semibold text-ink"
              onClick={() => setConfirmCreate(true)}
            >
              현재 전술을 저장하고 새 대형을 만들까요?
            </button>
          ) : null}
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-white/60">현재 컷의 선수·공 위치를 바꿉니다.</p>
          <div className="mb-3 grid max-h-72 gap-2 overflow-y-auto">
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
          {onCreateNew ? (
            <button
              type="button"
              className="mb-2 w-full rounded-xl bg-ink py-3 text-sm text-white/85 ring-1 ring-line"
              onClick={() => setConfirmCreate(true)}
            >
              현재 전술을 저장하고 새 대형을 만들까요?
            </button>
          ) : null}
        </>
      )}
      <button
        type="button"
        className="w-full rounded-xl py-3 text-sm text-white/70 ring-1 ring-line"
        onClick={onClose}
      >
        닫기
      </button>
    </Modal>
  );
}
