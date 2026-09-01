import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmModal } from "../components/ConfirmModal";
import { EditPlayerModal } from "../components/EditPlayerModal";
import { Modal } from "../components/Modal";
import { RenameModal } from "../components/RenameModal";
import { savePreset } from "../lib/db";
import { syncRosterPlayers } from "../lib/defaultPlay";
import { newPlayer } from "../lib/presets";
import type { CourtType, FormationPreset, RosterSize } from "../types/play";
import { CourtCanvas } from "./CourtCanvas";

type Props = {
  preset: FormationPreset;
  onChange: (preset: FormationPreset) => void;
  onBack: () => void;
};

export function PresetEditorScreen({ preset, onChange, onBack }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const presetRef = useRef(preset);
  const undoRef = useRef<FormationPreset[]>([]);
  const persistPausedRef = useRef(false);
  const didCleanRef = useRef(false);
  const [undoCount, setUndoCount] = useState(0);
  presetRef.current = preset;

  useEffect(() => {
    if (didCleanRef.current) return;
    didCleanRef.current = true;
    const current = presetRef.current;
    const nextObjs = syncRosterPlayers(current.objects, current.rosterSize, current.court);
    const hadBall = current.objects.some((o) => o.kind === "ball");
    if (!hadBall && nextObjs.length === current.objects.length) return;
    const cleaned = { ...current, objects: nextObjs, updatedAt: Date.now() };
    onChange(cleaned);
    void savePreset(cleaned);
  }, [onChange]);

  useEffect(() => {
    if (persistPausedRef.current) return;
    const t = window.setTimeout(() => {
      if (persistPausedRef.current) return;
      void savePreset(preset);
    }, 250);
    return () => window.clearTimeout(t);
  }, [preset]);

  const editing = useMemo(
    () => preset.objects.find((o) => o.id === editingId) ?? null,
    [preset.objects, editingId],
  );

  function pushUndo() {
    undoRef.current.push(structuredClone(presetRef.current));
    if (undoRef.current.length > 40) undoRef.current.shift();
    setUndoCount(undoRef.current.length);
  }

  function leaveNow(action: () => void) {
    persistPausedRef.current = true;
    void savePreset(presetRef.current)
      .then(action)
      .catch((err) => {
        persistPausedRef.current = false;
        setSavedNotice(err instanceof Error ? err.message : "저장하지 못했습니다.");
      });
  }

  function saveNow() {
    void savePreset(presetRef.current).then(() => setSavedNotice("대형을 저장했습니다."));
  }

  function patch(next: Partial<FormationPreset>) {
    onChange({ ...presetRef.current, ...next, updatedAt: Date.now() });
  }

  function undo() {
    const prev = undoRef.current.pop();
    if (!prev) return;
    setUndoCount(undoRef.current.length);
    onChange(prev);
  }

  function moveObject(id: string, x: number, y: number) {
    const current = presetRef.current;
    patch({
      objects: current.objects.map((o) => (o.id === id ? { ...o, x, y } : o)),
    });
  }

  function addPlayer() {
    pushUndo();
    const player = newPlayer(preset.court);
    patch({ objects: [...preset.objects, player] });
  }

  function deletePlayer() {
    if (!editingId) return;
    pushUndo();
    patch({ objects: presetRef.current.objects.filter((o) => o.id !== editingId) });
    setEditingId(null);
    setConfirmDelete(false);
  }

  function setCourt(court: CourtType) {
    if (court === preset.court) return;
    pushUndo();
    patch({ court });
  }

  function setRoster(rosterSize: RosterSize) {
    const next = syncRosterPlayers(preset.objects, rosterSize, preset.court);
    const players = preset.objects.filter((o) => o.kind === "player");
    const hasBall = preset.objects.some((o) => o.kind === "ball");
    if (
      rosterSize === preset.rosterSize &&
      next.length === players.length &&
      !hasBall
    ) {
      return;
    }
    pushUndo();
    patch({ rosterSize, objects: next });
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-ink">
      <header className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          className="rounded-xl px-3 py-2 text-sm text-white/80 ring-1 ring-line"
          onClick={() => leaveNow(onBack)}
        >
          뒤로
        </button>
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-center text-sm font-semibold"
          onClick={() => setRenameOpen(true)}
        >
          {preset.title}
        </button>
        <button
          type="button"
          className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-ink"
          onClick={saveNow}
        >
          저장
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <CourtCanvas
          court={preset.court}
          objects={preset.objects}
          interactive
          onMoveBegin={pushUndo}
          onMove={moveObject}
          onSelectPlayer={setEditingId}
        />
      </div>

      <div className="shrink-0 glass-bar px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <div className="mb-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            className={`rounded-xl py-2 text-sm ${
              preset.court === "half" ? "bg-accent font-semibold text-ink" : "text-white/70 ring-1 ring-line"
            }`}
            onClick={() => setCourt("half")}
          >
            하프코트
          </button>
          <button
            type="button"
            className={`rounded-xl py-2 text-sm ${
              preset.court === "full" ? "bg-accent font-semibold text-ink" : "text-white/70 ring-1 ring-line"
            }`}
            onClick={() => setCourt("full")}
          >
            풀코트
          </button>
        </div>
        <div className="mb-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            className={`rounded-xl py-2 text-sm ${
              preset.rosterSize === 6 ? "bg-accent font-semibold text-ink" : "text-white/70 ring-1 ring-line"
            }`}
            onClick={() => setRoster(6)}
          >
            6인제
          </button>
          <button
            type="button"
            className={`rounded-xl py-2 text-sm ${
              preset.rosterSize === 9 ? "bg-accent font-semibold text-ink" : "text-white/70 ring-1 ring-line"
            }`}
            onClick={() => setRoster(9)}
          >
            9인제
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-xl py-2 text-sm text-white/80 ring-1 ring-line disabled:opacity-30"
            disabled={undoCount === 0}
            onClick={undo}
          >
            실행 취소
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl bg-accent py-2 text-sm font-semibold text-ink"
            onClick={addPlayer}
          >
            선수
          </button>
        </div>
      </div>

      <EditPlayerModal
        object={editing}
        onClose={() => setEditingId(null)}
        onSave={(next) => {
          pushUndo();
          patch({
            objects: preset.objects.map((o) =>
              o.id === editingId ? { ...o, ...next } : o,
            ),
          });
          setEditingId(null);
        }}
        onDelete={() => setConfirmDelete(true)}
      />
      <ConfirmModal
        open={confirmDelete}
        title="선수 삭제"
        message={`‘${editing?.label ?? "선수"}’ 선수를 대형에서 삭제할까요?`}
        confirmLabel="삭제"
        onClose={() => setConfirmDelete(false)}
        onConfirm={deletePlayer}
      />
      <RenameModal
        open={renameOpen}
        title="대형 이름"
        label="이름"
        initial={preset.title}
        confirmLabel="저장"
        onClose={() => setRenameOpen(false)}
        onSubmit={(title) => {
          patch({ title });
          setRenameOpen(false);
        }}
      />
      <Modal open={Boolean(savedNotice)} title="저장" onClose={() => setSavedNotice(null)}>
        <p className="mb-5 text-sm text-white/75">{savedNotice}</p>
        <button
          type="button"
          className="w-full rounded-xl bg-accent py-3 font-semibold text-ink"
          onClick={() => setSavedNotice(null)}
        >
          확인
        </button>
      </Modal>
    </div>
  );
}
