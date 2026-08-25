import { useEffect, useMemo, useRef, useState } from "react";
import { LeaveSaveModal } from "../components/LeaveSaveModal";
import { ConfirmModal } from "../components/ConfirmModal";
import { EditPlayerModal } from "../components/EditPlayerModal";
import { PresetModal } from "../components/PresetModal";
import { RenameModal } from "../components/RenameModal";
import { SavePlayModal } from "../components/SavePlayModal";
import { ZoneModal } from "../components/ZoneModal";
import { Modal } from "../components/Modal";
import { downloadPng, fileSafeName } from "../lib/capture";
import { alignToDefault, duplicatePlay, nextCutName } from "../lib/defaultPlay";
import { saveCapture, savePlay } from "../lib/db";
import { isPlayDirty } from "../lib/dirty";
import { uid } from "../lib/id";
import { cloneCutAfter, viewAtPlayhead } from "../lib/interpolate";
import { applyUserPreset, newPlayer } from "../lib/presets";
import { PEN_COLORS, strokeNearPoint } from "../lib/stroke";
import type {
  Album,
  EditorTool,
  FormationPreset,
  Play,
  Stroke,
  StrokeKind,
  ZoneMode,
} from "../types/play";
import { CourtCanvas, type CourtCanvasHandle } from "./CourtCanvas";
import { CourtThumb } from "./CourtThumb";

type Props = {
  play: Play;
  albumPlays: Play[];
  albums: Album[];
  presets: FormationPreset[];
  onChange: (play: Play) => void;
  onBack: () => void;
  onOpenPlay: (id: string) => void;
  onSavedToGallery: (albumId: string) => void;
  onSaveAndNew: (saved: Play, next: Play) => void;
  onCreateAlbum: (title: string) => Promise<string>;
};

export function EditorScreen({
  play,
  albumPlays,
  albums,
  presets,
  onChange,
  onBack,
  onOpenPlay,
  onSavedToGallery,
  onSaveAndNew,
  onCreateAlbum,
}: Props) {
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteCut, setConfirmDeleteCut] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [renameTitleOpen, setRenameTitleOpen] = useState(false);
  const [renameCut, setRenameCut] = useState<number | null>(null);
  const [zoneMode, setZoneMode] = useState<ZoneMode>("none");
  const [tool, setTool] = useState<EditorTool>("select");
  const [drawOpen, setDrawOpen] = useState(false);
  const [drawKind, setDrawKind] = useState<StrokeKind>("arrow");
  const [drawColor, setDrawColor] = useState("#ffffff");
  const [toolsOpen, setToolsOpen] = useState(true);
  const [albumStripOpen, setAlbumStripOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [confirmDeletePlayer, setConfirmDeletePlayer] = useState(false);
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const canvasRef = useRef<CourtCanvasHandle>(null);
  const albumStripRef = useRef<HTMLDivElement>(null);
  const albumDragRef = useRef<{ x: number; sl: number; moved: boolean } | null>(null);
  const albumDraggedRef = useRef(false);
  const playheadRef = useRef(0);
  const playingRef = useRef(false);
  const playRef = useRef(play);
  const undoRef = useRef<Play[]>([]);
  const eraseDidRef = useRef(false);
  const savedRef = useRef(structuredClone(play));
  const persistPausedRef = useRef(false);
  const pendingLeaveRef = useRef<(() => void) | null>(null);
  const [undoCount, setUndoCount] = useState(0);
  playheadRef.current = playhead;
  playingRef.current = playing;
  playRef.current = play;

  const lastCut = Math.max(0, play.cuts.length - 1);
  const view = useMemo(
    () => viewAtPlayhead(play.cuts, playhead),
    [play.cuts, playhead],
  );
  const editIndex = Math.min(lastCut, Math.max(0, Math.round(playhead)));
  const editCut = play.cuts[editIndex];
  const siblings = useMemo(() => {
    const map = new Map(albumPlays.map((p) => [p.id, p]));
    map.set(play.id, play);
    return [...map.values()].sort((a, b) => a.createdAt - b.createdAt);
  }, [albumPlays, play]);

  useEffect(() => {
    if (playhead > lastCut) setPlayhead(lastCut);
  }, [lastCut, playhead]);

  useEffect(() => {
    if (persistPausedRef.current) return;
    const t = window.setTimeout(() => {
      void savePlay(play);
    }, 250);
    return () => window.clearTimeout(t);
  }, [play]);

  useEffect(() => {
    if (!playing) return;
    if (lastCut === 0) {
      setPlaying(false);
      return;
    }
    let raf = 0;
    let lastTs = 0;
    const speed = 1;
    const step = (ts: number) => {
      if (!playingRef.current) return;
      if (lastTs === 0) lastTs = ts;
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;
      const next = playheadRef.current + dt * speed;
      if (next >= lastCut) {
        setPlayhead(lastCut);
        setPlaying(false);
        return;
      }
      setPlayhead(next);
      raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [playing, lastCut]);

  const editing = useMemo(
    () => editCut?.objects.find((o) => o.id === editingId) ?? null,
    [editCut, editingId],
  );

  function pushUndo() {
    undoRef.current.push(structuredClone(playRef.current));
    if (undoRef.current.length > 40) undoRef.current.shift();
    setUndoCount(undoRef.current.length);
  }

  function updatePlay(cuts: Play["cuts"]) {
    const next = { ...playRef.current, cuts, updatedAt: Date.now() };
    playRef.current = next;
    onChange(next);
  }

  function restorePlay(next: Play) {
    playRef.current = next;
    onChange(next);
  }

  function undo() {
    const prev = undoRef.current.pop();
    if (!prev) return;
    setUndoCount(undoRef.current.length);
    restorePlay(prev);
  }

  function editCutIndex() {
    const current = playRef.current;
    return Math.min(
      Math.max(0, current.cuts.length - 1),
      Math.max(0, Math.round(playheadRef.current)),
    );
  }

  function moveObject(id: string, x: number, y: number) {
    const current = playRef.current;
    const i = editCutIndex();
    const cut = current.cuts[i];
    if (!cut) return;
    updatePlay(
      current.cuts.map((c, idx) =>
        idx === i
          ? { ...c, objects: cut.objects.map((o) => (o.id === id ? { ...o, x, y } : o)) }
          : c,
      ),
    );
  }

  function addCut() {
    setPlaying(false);
    pushUndo();
    const i = editIndex;
    const copy = cloneCutAfter(play.cuts[i], uid(), nextCutName(play.cuts));
    const cuts = [...play.cuts.slice(0, i + 1), copy, ...play.cuts.slice(i + 1)];
    updatePlay(cuts);
    setPlayhead(i + 1);
  }

  function deleteCut() {
    if (play.cuts.length <= 1) return;
    pushUndo();
    const i = editIndex;
    const cuts = play.cuts.filter((_, idx) => idx !== i);
    updatePlay(cuts);
    setPlayhead(Math.min(i, cuts.length - 1));
    setConfirmDeleteCut(false);
  }

  function addStroke(
    points: { x: number; y: number }[],
    style: { color: string; kind: StrokeKind },
  ) {
    pushUndo();
    const i = editCutIndex();
    const current = playRef.current;
    const stroke: Stroke = {
      id: uid(),
      points,
      color: style.color,
      arrowhead: style.kind === "arrow",
      kind: style.kind,
    };
    updatePlay(
      current.cuts.map((c, idx) =>
        idx === i ? { ...c, strokes: [...c.strokes, stroke] } : c,
      ),
    );
  }

  function eraseBegin() {
    eraseDidRef.current = false;
  }

  function eraseAt(x: number, y: number) {
    const i = editCutIndex();
    const current = playRef.current;
    const cut = current.cuts[i];
    if (!cut) return;
    const next = cut.strokes.filter((s) => !strokeNearPoint(s, { x, y }));
    if (next.length === cut.strokes.length) return;
    if (!eraseDidRef.current) {
      pushUndo();
      eraseDidRef.current = true;
    }
    updatePlay(
      current.cuts.map((c, idx) => (idx === i ? { ...c, strokes: next } : c)),
    );
  }

  function resetToFirstCut() {
    pushUndo();
    const i = editIndex;
    const source =
      i === 0
        ? alignToDefault(play.cuts[0].objects, play.rosterSize, play.court)
        : play.cuts[0].objects.map((o) => ({ ...o }));
    updatePlay(
      play.cuts.map((c, idx) =>
        idx === i ? { ...c, objects: source, strokes: i === 0 ? [] : c.strokes } : c,
      ),
    );
    setConfirmReset(false);
  }

  function deletePlayer() {
    if (!editingId) return;
    pushUndo();
    const id = editingId;
    updatePlay(
      playRef.current.cuts.map((c) => ({
        ...c,
        objects: c.objects.filter((o) => o.id !== id),
      })),
    );
    setEditingId(null);
    setConfirmDeletePlayer(false);
  }

  function addPlayer() {
    pushUndo();
    const player = newPlayer(play.court);
    updatePlay(
      play.cuts.map((c) => ({ ...c, objects: [...c.objects, { ...player }] })),
    );
  }

  function applyFormation(preset: FormationPreset) {
    pushUndo();
    const i = editIndex;
    const { objects, extras } = applyUserPreset(play.cuts[i].objects, preset.objects);
    updatePlay(
      play.cuts.map((c, idx) => {
        if (idx === i) return { ...c, objects };
        if (extras.length === 0) return c;
        return { ...c, objects: [...c.objects, ...extras.map((e) => ({ ...e }))] };
      }),
    );
  }

  function togglePlay() {
    if (lastCut === 0) return;
    if (playing) {
      setPlaying(false);
      return;
    }
    if (playhead >= lastCut - 0.001) setPlayhead(0);
    setPlaying(true);
  }

  function markSaved(next: Play = playRef.current) {
    savedRef.current = structuredClone(next);
  }

  function requestLeave(action: () => void) {
    if (!isPlayDirty(playRef.current, savedRef.current)) {
      action();
      return;
    }
    pendingLeaveRef.current = action;
    setLeaveOpen(true);
  }

  function finishLeave() {
    const action = pendingLeaveRef.current;
    pendingLeaveRef.current = null;
    setLeaveOpen(false);
    action?.();
  }

  function leaveWithSave() {
    persistPausedRef.current = true;
    const current = playRef.current;
    markSaved(current);
    void savePlay(current).then(finishLeave);
  }

  function leaveWithoutSave() {
    persistPausedRef.current = true;
    const snap = structuredClone(savedRef.current);
    playRef.current = snap;
    onChange(snap);
    void savePlay(snap).then(finishLeave);
  }

  function commitSave(input: { title: string; albumId: string }) {
    return { ...playRef.current, title: input.title, albumId: input.albumId, updatedAt: Date.now() };
  }

  async function captureFrame() {
    try {
      const blob = await canvasRef.current?.toPngBlob();
      if (!blob) {
        setCaptureNotice("코트를 캡처할 수 없습니다.");
        return;
      }
      const cut = playRef.current.cuts[editCutIndex()] ?? playRef.current.cuts[0];
      const stamp = new Date();
      const time = `${stamp.getHours().toString().padStart(2, "0")}${stamp.getMinutes().toString().padStart(2, "0")}`;
      await saveCapture({
        id: uid(),
        playId: playRef.current.id,
        playTitle: playRef.current.title,
        cutName: cut?.name || "Cut",
        createdAt: Date.now(),
        blob,
      });
      downloadPng(
        blob,
        `${fileSafeName(playRef.current.title)}-${fileSafeName(cut?.name || "Cut")}-${time}`,
      );
      setCaptureNotice("갤러리에 저장했고, 기기로도 내려받았습니다.");
    } catch (err) {
      setCaptureNotice(err instanceof Error ? err.message : "캡처에 실패했습니다.");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-ink">
      <header className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          className="rounded-xl px-3 py-2 text-sm text-white/80 ring-1 ring-line"
          onClick={() => requestLeave(onBack)}
        >
          뒤로
        </button>
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-center text-sm font-semibold"
          onClick={() => setRenameTitleOpen(true)}
        >
          {play.title}
        </button>
        <button
          type="button"
          className="rounded-xl px-3 py-2 text-sm text-white/80 ring-1 ring-line"
          onClick={() => void captureFrame()}
        >
          캡처
        </button>
        <button
          type="button"
          className="rounded-xl bg-court px-3 py-2 text-sm font-semibold text-ink"
          onClick={() => setSaveOpen(true)}
        >
          저장
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <CourtCanvas
          ref={canvasRef}
          court={play.court}
          objects={view.objects}
          trails={showTrails ? view.trails : []}
          strokes={view.strokes}
          zoneMode={zoneMode}
          tool={tool}
          drawColor={drawColor}
          drawKind={drawKind}
          interactive={!playing}
          onPointerStart={() => {
            setPlaying(false);
            const i = Math.min(lastCut, Math.max(0, Math.round(playheadRef.current)));
            playheadRef.current = i;
            setPlayhead(i);
          }}
          onMoveBegin={pushUndo}
          onMove={moveObject}
          onSelectPlayer={setEditingId}
          onStrokeEnd={addStroke}
          onEraseBegin={eraseBegin}
          onEraseAt={eraseAt}
        />
        <div className="pointer-events-none absolute right-3 top-2 flex items-start gap-1">
          {drawOpen ? (
            <div className="pointer-events-auto flex w-[4.75rem] flex-col gap-1 rounded-lg bg-panel/95 p-1 ring-1 ring-line">
              <ToolBtn
                active={tool === "pen"}
                onClick={() => setTool("pen")}
              >
                펜
              </ToolBtn>
              <ToolBtn
                active={tool === "eraser"}
                onClick={() => setTool("eraser")}
              >
                지우개
              </ToolBtn>
              <ToolBtn
                active={tool === "laser"}
                onClick={() => {
                  setTool("laser");
                  if (drawColor === "#ffffff") setDrawColor("#ef5350");
                }}
              >
                레이저
              </ToolBtn>
              {tool === "pen" || tool === "laser" ? (
                <>
                  <div className="grid grid-cols-3 gap-0.5">
                    {(
                      [
                        ["arrow", "화살"],
                        ["solid", "실선"],
                        ["dashed", "점선"],
                      ] as const
                    ).map(([kind, label]) => (
                      <button
                        key={kind}
                        type="button"
                        className={`rounded px-0.5 py-0.5 text-[8px] font-medium ${
                          drawKind === kind
                            ? "bg-court text-ink"
                            : "text-white/70 ring-1 ring-line"
                        }`}
                        onClick={() => setDrawKind(kind)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 justify-items-center gap-1 px-0.5 py-0.5">
                    {PEN_COLORS.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        aria-label={item.label}
                        className={`h-4 w-4 rounded-full ${
                          drawColor === item.value
                            ? "ring-2 ring-white ring-offset-1 ring-offset-panel"
                            : "ring-1 ring-white/35"
                        }`}
                        style={{ backgroundColor: item.value }}
                        onClick={() => setDrawColor(item.value)}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
          <div className="pointer-events-auto flex w-[3.85rem] flex-col overflow-hidden rounded-lg bg-panel/95 ring-1 ring-line">
            <button
              type="button"
              className={`px-1 py-1 text-[9px] text-white/80 ${toolsOpen ? "border-b border-line" : ""}`}
              onClick={() => setToolsOpen((v) => !v)}
              aria-label={toolsOpen ? "도구 접기" : "도구 펼치기"}
            >
              {toolsOpen ? "∧" : "∨"}
            </button>
            {toolsOpen ? (
              <div className="flex flex-col gap-1 p-1">
                <ToolBtn
                  active={tool === "select"}
                  onClick={() => {
                    setTool("select");
                    setDrawOpen(false);
                  }}
                >
                  이동
                </ToolBtn>
                <ToolBtn
                  active={drawOpen || tool === "pen" || tool === "eraser" || tool === "laser"}
                  onClick={() => {
                    if (drawOpen) {
                      setDrawOpen(false);
                      return;
                    }
                    setDrawOpen(true);
                    if (tool === "select") setTool("pen");
                  }}
                >
                  그리기
                </ToolBtn>
                <ToolBtn active={showTrails} onClick={() => setShowTrails((v) => !v)}>
                  {showTrails ? "동선 숨김" : "동선 표시"}
                </ToolBtn>
                <ToolBtn onClick={undo} disabled={undoCount === 0}>
                  실행 취소
                </ToolBtn>
                <ToolBtn onClick={() => setZoneOpen(true)}>구역</ToolBtn>
                <ToolBtn onClick={() => setPresetOpen(true)}>대형</ToolBtn>
                <ToolBtn onClick={addPlayer}>선수</ToolBtn>
                <ToolBtn onClick={() => void captureFrame()}>캡처</ToolBtn>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="shrink-0 bg-ink-2 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {siblings.length > 1 ? (
          <section className="border-t border-line pt-1.5">
            <button
              type="button"
              className="px-0.5 py-0.5 text-left text-[10px] text-white/50"
              onClick={() => setAlbumStripOpen((v) => !v)}
            >
              같은 전술 앨범 {albumStripOpen ? "∧" : "∨"}
            </button>
            {albumStripOpen ? (
              <div
                ref={albumStripRef}
                className="mt-1 flex cursor-grab touch-none select-none gap-2 overflow-x-auto active:cursor-grabbing [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                onPointerDown={(e) => {
                  const el = albumStripRef.current;
                  if (!el) return;
                  albumDraggedRef.current = false;
                  albumDragRef.current = { x: e.clientX, sl: el.scrollLeft, moved: false };
                  el.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const el = albumStripRef.current;
                  const drag = albumDragRef.current;
                  if (!el || !drag) return;
                  const dx = e.clientX - drag.x;
                  if (Math.abs(dx) > 6) {
                    drag.moved = true;
                    albumDraggedRef.current = true;
                  }
                  if (drag.moved) el.scrollLeft = drag.sl - dx;
                }}
                onPointerUp={() => {
                  albumDragRef.current = null;
                }}
                onPointerCancel={() => {
                  albumDragRef.current = null;
                }}
              >
                {siblings.map((item) => {
                  const active = item.id === play.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`w-[4.75rem] shrink-0 overflow-hidden rounded-lg text-left ${
                        active ? "bg-white/10" : ""
                      }`}
                      onClick={() => {
                        if (albumDraggedRef.current) {
                          albumDraggedRef.current = false;
                          return;
                        }
                        if (item.id === play.id) return;
                        requestLeave(() => onOpenPlay(item.id));
                      }}
                    >
                      <div className="h-14 overflow-hidden bg-ink">
                        <CourtThumb
                          court={item.court}
                          objects={item.cuts[0]?.objects ?? []}
                        />
                      </div>
                      <p className="mt-2 truncate px-0.5 pb-0.5 text-[9px] text-white/75">
                        {item.title}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </section>
        ) : null}
        <section className="border-t border-line pt-1.5">
          <button
            type="button"
            className="px-0.5 py-0.5 text-left text-[10px] text-white/50"
            onClick={() => setTimelineOpen((v) => !v)}
          >
            컷 타임라인 {timelineOpen ? "∧" : "∨"}
          </button>
          {timelineOpen ? (
            <>
              <div className="mb-3 mt-1 flex items-center gap-1.5">
                <button
                  type="button"
                  className="shrink-0 rounded-lg bg-court px-2.5 py-1 text-[11px] font-semibold text-ink"
                  onClick={togglePlay}
                >
                  {playing ? "정지" : "재생"}
                </button>
                <input
                  type="range"
                  className="h-1.5 min-w-0 flex-1 accent-court"
                  min={0}
                  max={lastCut}
                  step={0.01}
                  value={playhead}
                  disabled={lastCut === 0}
                  onChange={(e) => {
                    setPlaying(false);
                    setPlayhead(Number(e.target.value));
                  }}
                />
                <button
                  type="button"
                  className="shrink-0 rounded-lg px-2 py-1 text-[10px] text-white/70 ring-1 ring-line"
                  onClick={() => setConfirmReset(true)}
                >
                  컷1 리셋
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded-lg px-2 py-1 text-[10px] text-white/70 ring-1 ring-line disabled:opacity-30"
                  disabled={play.cuts.length <= 1}
                  onClick={() => setConfirmDeleteCut(true)}
                >
                  삭제
                </button>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto">
                {play.cuts.map((cut, i) => {
                  const active = view.activeIndex === i;
                  return (
                    <button
                      key={cut.id}
                      type="button"
                      className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                        active ? "bg-court text-ink" : "text-white/70 ring-1 ring-line"
                      }`}
                      onClick={() => {
                        setPlaying(false);
                        if (active) {
                          setRenameCut(i);
                          return;
                        }
                        setPlayhead(i);
                      }}
                    >
                      {cut.name || `Cut ${i + 1}`}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="shrink-0 rounded-lg px-2 py-1 text-[11px] text-white/80 ring-1 ring-line"
                  onClick={addCut}
                >
                  +
                </button>
              </div>
            </>
          ) : null}
        </section>
      </div>

      <EditPlayerModal
        object={editing}
        onClose={() => setEditingId(null)}
        onSave={(patch) => {
          pushUndo();
          updatePlay(
            play.cuts.map((c) => ({
              ...c,
              objects: c.objects.map((o) =>
                o.id === editingId ? { ...o, ...patch } : o,
              ),
            })),
          );
          setEditingId(null);
        }}
        onDelete={() => setConfirmDeletePlayer(true)}
      />
      <ConfirmModal
        open={confirmDeletePlayer}
        title="선수 삭제"
        message={`‘${editing?.label ?? "선수"}’ 선수를 모든 컷에서 삭제할까요?`}
        confirmLabel="삭제"
        onClose={() => setConfirmDeletePlayer(false)}
        onConfirm={deletePlayer}
      />
      <ConfirmModal
        open={confirmDeleteCut}
        title="컷 삭제"
        message={`현재 컷을 삭제하시겠습니까?\n현재 컷: ${editCut?.name || `Cut ${editIndex + 1}`} (전체 ${play.cuts.length}개 중 ${editIndex + 1}번째)`}
        confirmLabel="삭제"
        onClose={() => setConfirmDeleteCut(false)}
        onConfirm={deleteCut}
      />
      <ConfirmModal
        open={confirmReset}
        title="첫 컷으로 리셋"
        message={
          editIndex === 0
            ? "1번 컷을 처음 만든 포메이션으로 되돌릴까요? 그린 선도 지워집니다."
            : `${editCut?.name || `Cut ${editIndex + 1}`}의 선수·공 위치를 1번 컷과 같게 맞출까요?`
        }
        confirmLabel="리셋"
        onClose={() => setConfirmReset(false)}
        onConfirm={resetToFirstCut}
      />
      <ZoneModal
        open={zoneOpen}
        value={zoneMode}
        onClose={() => setZoneOpen(false)}
        onSelect={setZoneMode}
      />
      <PresetModal
        open={presetOpen}
        presets={presets}
        onClose={() => setPresetOpen(false)}
        onSelect={applyFormation}
      />
      <SavePlayModal
        open={saveOpen}
        title={play.title}
        albumId={play.albumId}
        albums={albums}
        onClose={() => setSaveOpen(false)}
        onCreateAlbum={onCreateAlbum}
        onSave={(input) => {
          const saved = commitSave(input);
          markSaved(saved);
          onChange(saved);
          setSaveOpen(false);
          persistPausedRef.current = true;
          void savePlay(saved).then(() => onSavedToGallery(saved.albumId));
        }}
        onSaveAndNew={(input) => {
          const saved = commitSave(input);
          markSaved(saved);
          const next = duplicatePlay(saved, `${saved.title} 사본`);
          setSaveOpen(false);
          persistPausedRef.current = true;
          void savePlay(saved).then(() => savePlay(next)).then(() => onSaveAndNew(saved, next));
        }}
      />
      <RenameModal
        open={renameTitleOpen}
        title="전술 이름"
        label="이름"
        initial={play.title}
        confirmLabel="저장"
        onClose={() => setRenameTitleOpen(false)}
        onSubmit={(title) => {
          onChange({ ...playRef.current, title, updatedAt: Date.now() });
          setRenameTitleOpen(false);
        }}
      />
      <RenameModal
        open={renameCut !== null}
        title="컷 이름"
        label="이름"
        initial={renameCut !== null ? play.cuts[renameCut]?.name || `Cut ${renameCut + 1}` : ""}
        confirmLabel="저장"
        onClose={() => setRenameCut(null)}
        onSubmit={(name) => {
          if (renameCut === null) return;
          pushUndo();
          updatePlay(
            play.cuts.map((c, idx) => (idx === renameCut ? { ...c, name } : c)),
          );
          setRenameCut(null);
        }}
      />
      <Modal open={Boolean(captureNotice)} title="캡처" onClose={() => setCaptureNotice(null)}>
        <p className="mb-5 text-sm text-white/75">{captureNotice}</p>
        <button
          type="button"
          className="w-full rounded-xl bg-court py-3 font-semibold text-ink"
          onClick={() => setCaptureNotice(null)}
        >
          확인
        </button>
      </Modal>
      <LeaveSaveModal
        open={leaveOpen}
        onCancel={() => {
          pendingLeaveRef.current = null;
          setLeaveOpen(false);
        }}
        onDiscard={leaveWithoutSave}
        onSave={leaveWithSave}
      />
    </div>
  );
}

function ToolBtn({
  children,
  onClick,
  active,
  disabled,
}: {
  children: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-md px-1 py-1 text-center text-[9px] font-medium leading-tight disabled:opacity-30 ${
        active ? "bg-court text-ink" : "text-white/75 ring-1 ring-line"
      }`}
    >
      {children}
    </button>
  );
}
