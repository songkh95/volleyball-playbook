import { useEffect, useState } from "react";
import { Modal } from "../Modal";
import { DEFAULT_MATCH_SETTINGS } from "../../lib/matchRules";
import type { MatchSettings } from "../../types/match";

type Props = {
  open: boolean;
  value: MatchSettings;
  canChangeRoster?: boolean;
  onClose: () => void;
  onSave: (next: MatchSettings) => void;
};

export function MatchSettingsModal({ open, value, canChangeRoster = true, onClose, onSave }: Props) {
  const [rosterSize, setRosterSize] = useState<6 | 9>(value.rosterSize === 9 ? 9 : 6);

  useEffect(() => {
    if (!open) return;
    setRosterSize(value.rosterSize === 9 ? 9 : 6);
  }, [open, value.rosterSize]);

  return (
    <Modal open={open} title="경기 설정" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          onSave({
            timeoutSeconds: Number(data.get("timeoutSeconds")) || DEFAULT_MATCH_SETTINGS.timeoutSeconds,
            timeoutsPerSet: Number(data.get("timeoutsPerSet")) || DEFAULT_MATCH_SETTINGS.timeoutsPerSet,
            subsPerSet: Number(data.get("subsPerSet")) || DEFAULT_MATCH_SETTINGS.subsPerSet,
            rosterSize,
          });
        }}
      >
        <p className="mb-2 text-sm text-white/70">인원</p>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!canChangeRoster}
            onClick={() => setRosterSize(6)}
            className={`rounded-xl py-3 text-sm font-medium ring-1 disabled:opacity-40 ${
              rosterSize !== 9 ? "bg-accent text-ink ring-accent" : "bg-ink text-white/80 ring-line"
            }`}
          >
            6인제
          </button>
          <button
            type="button"
            disabled={!canChangeRoster}
            onClick={() => setRosterSize(9)}
            className={`rounded-xl py-3 text-sm font-medium ring-1 disabled:opacity-40 ${
              rosterSize === 9 ? "bg-accent text-ink ring-accent" : "bg-ink text-white/80 ring-line"
            }`}
          >
            9인제
          </button>
        </div>
        {canChangeRoster ? null : (
          <p className="mb-4 text-xs text-white/45">인원은 새 경기(워밍업)에서만 바꿀 수 있습니다.</p>
        )}
        <label className="mb-1 block text-sm text-white/70">타임아웃 시간 (초)</label>
        <input
          name="timeoutSeconds"
          className="mb-3 w-full rounded-xl bg-ink px-3 py-3 outline-none ring-1 ring-line focus:ring-accent"
          inputMode="numeric"
          defaultValue={value.timeoutSeconds}
        />
        <label className="mb-1 block text-sm text-white/70">세트당 타임아웃 횟수</label>
        <input
          name="timeoutsPerSet"
          className="mb-3 w-full rounded-xl bg-ink px-3 py-3 outline-none ring-1 ring-line focus:ring-accent"
          inputMode="numeric"
          defaultValue={value.timeoutsPerSet}
        />
        <label className="mb-1 block text-sm text-white/70">세트당 교체 횟수</label>
        <input
          name="subsPerSet"
          className="mb-5 w-full rounded-xl bg-ink px-3 py-3 outline-none ring-1 ring-line focus:ring-accent"
          inputMode="numeric"
          defaultValue={value.subsPerSet}
        />
        <div className="flex gap-2">
          <button type="button" className="flex-1 rounded-xl py-3 text-white/80 ring-1 ring-line" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="flex-1 rounded-xl bg-accent py-3 font-semibold text-ink">
            저장
          </button>
        </div>
      </form>
    </Modal>
  );
}
