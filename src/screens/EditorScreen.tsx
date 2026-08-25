import { useEffect, useMemo, useRef, useState } from "react";
import { CoverImg } from "../components/CoverSlot";
import { LeaveSaveModal } from "../components/LeaveSaveModal";
import { ConfirmModal } from "../components/ConfirmModal";
import { EditPlayerModal } from "../components/EditPlayerModal";
import { PresetModal } from "../components/PresetModal";
import { RenameModal } from "../components/RenameModal";
import { SavePlayModal } from "../components/SavePlayModal";
import { ZoneModal } from "../components/ZoneModal";
import { Modal } from "../components/Modal";
import { downloadBlob, downloadPng, fileSafeName } from "../lib/capture";
import { duplicatePlay, nextCutName } from "../lib/defaultPlay";
import { saveCapture, savePlay } from "../lib/db";
import { isPlayDirty } from "../lib/dirty";
import {
  detectVideoFormat,
  encodeGif,
  movieViews,
  recordVideo,
} from "../lib/exportMovie";
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

let albumStripOpenMemory = false;

type Props = {
  play: Play;
  albumPlays: Play[];
  albums: Album[];
  presets: FormationPreset[];
  covers: Record<string, Blob>;
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
  covers,
  onChange,
  onBack,
  onOpenPlay,
  onSavedToGallery,
  onSaveAndNew,
  onCreateAlbum,
}: Props) {
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteCut, setConfirmDeleteCut] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [renameTitleOpen, setRenameTitleOpen] = useState(false);
  const [renameCut, setRenameCut] = useState<number | null>(null);
  const [zoneMode, setZoneMode] = useState<ZoneMode>("none");
  const [tool, setTool] = useState<EditorTool>("select");
  const [drawOpen, setDrawOpen] = useState(false);
  const [drawKind, setDrawKind] = useState<StrokeKind>("arrow");
  const [drawColor, setDrawColor] = useState("#ccff00");
  const [toolsOpen, setToolsOpen] = useState(true);
  const [albumStripOpen, setAlbumStripOpen] = useState(albumStripOpenMemory);
  const [timelineOpen, setTimelineOpen] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [confirmDeletePlayer, setConfirmDeletePlayer] = useState(false);
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const canvasRef = useRef<CourtCanvasHandle>(null);
  const albumStripRef = useRef<HTMLDivElement>(null);
  const albumDragRef = useRef<{ x: number; sl: number; moved: boolean } | null>(null);
  const albumDraggedRef = useRef(false);
  const playheadRef = useRef(0);
  const playingRef = useRef(false);
  const playSpeedRef = useRef(1);
  const playRef = useRef(play);
  const undoRef = useRef<Play[]>([]);
  const eraseDidRef = useRef(false);
  const savedRef = useRef(structuredClone(play));
  const persistPausedRef = useRef(false);
  const pendingLeaveRef = useRef<(() => void) | null>(null);
  const [undoCount, setUndoCount] = useState(0);
  playheadRef.current = playhead;
  playingRef.current = playing;
  playSpeedRef.current = playSpeed;
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
    const step = (ts: number) => {
      if (!playingRef.current) return;
      if (lastTs === 0) lastTs = ts;
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;
      const next = playheadRef.current + dt * playSpeedRef.current;
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

  async function exportTimeline(kind: "gif" | "video") {
    if (exportBusy) return;
    setPlaying(false);
    setExportBusy(true);
    try {
      const views = movieViews(playRef.current.cuts, showTrails);
      const frames = await canvasRef.current?.captureViews(views);
      if (!frames?.length) {
        throw new Error("코트를 캡처할 수 없습니다.");
      }
      const stamp = new Date();
      const time = `${stamp.getHours().toString().padStart(2, "0")}${stamp.getMinutes().toString().padStart(2, "0")}`;
      let blob: Blob;
      let ext: string;
      if (kind === "gif") {
        blob = await encodeGif(frames);
        ext = "gif";
      } else {
        const recorded = await recordVideo(frames);
        blob = recorded.blob;
        ext = recorded.ext;
      }
      await saveCapture({
        id: uid(),
        playId: playRef.current.id,
        playTitle: playRef.current.title,
        cutName: kind === "gif" ? "GIF" : "영상",
        createdAt: Date.now(),
        blob,
      });
      downloadBlob(
        blob,
        `${fileSafeName(playRef.current.title)}-timeline-${time}`,
        ext,
      );
      setExportOpen(false);
      setCaptureNotice("갤러리에 저장했고, 기기로도 내려받았습니다.");
    } catch (err) {
      setCaptureNotice(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-ink">
      <header className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          className="rounded-xl px-3 py-2 text-sm text-white/85"
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
          className="rounded-xl px-3 py-2 text-sm text-white/85"
          onClick={() => void captureFrame()}
        >
          캡처
        </button>
        <button
          type="button"
          className="rounded-xl px-3 py-2 text-sm text-white/85"
          onClick={() => setExportOpen(true)}
        >
          영상
        </button>
        <button
          type="button"
          className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-ink"
          onClick={() => setSaveOpen(true)}
        >
          저장
        </button>
      </header>

      <div className="pointer-events-none shrink-0 px-3 pb-4 pt-2">
        <div className="pointer-events-auto flex max-w-full flex-col gap-1.5">
          <div className="flex max-w-full items-center gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              className="shrink-0 px-1 py-1 text-sm font-bold text-white"
              onClick={() => setToolsOpen((v) => !v)}
              aria-label={toolsOpen ? "도구 접기" : "도구 펼치기"}
            >
              {toolsOpen ? "<" : ">"}
            </button>
            {toolsOpen ? (
              <>
                <ToolBtn
                  active={tool === "select" && !drawOpen}
                  onClick={() => {
                    setTool("select");
                    setDrawOpen(false);
                  }}
                >
                  전술모드
                </ToolBtn>
                <ToolBtn
                  active={drawOpen || tool === "pen" || tool === "eraser" || tool === "laser"}
                  onClick={() => {
                    if (drawOpen) {
                      setDrawOpen(false);
                      setTool("select");
                      return;
                    }
                    setDrawOpen(true);
                    if (tool === "select") setTool("pen");
                  }}
                >
                  마킹모드
                </ToolBtn>
                <span className="mx-2.5 h-3.5 w-px shrink-0 bg-white/40" aria-hidden />
                <ToolBtn active={showTrails} onClick={() => setShowTrails((v) => !v)}>
                  {showTrails ? "동선 숨김" : "동선 표시"}
                </ToolBtn>
                <ToolBtn onClick={undo} disabled={undoCount === 0}>
                  실행 취소
                </ToolBtn>
                <ToolBtn onClick={() => setZoneOpen(true)}>구역</ToolBtn>
                <ToolBtn onClick={() => setPresetOpen(true)}>대형</ToolBtn>
                <ToolBtn onClick={addPlayer}>선수</ToolBtn>
              </>
            ) : null}
          </div>
          {drawOpen && toolsOpen ? (
            <div className="flex items-start gap-1">
              <div className="pointer-events-none invisible flex shrink-0 gap-1" aria-hidden>
                <span className="px-1 py-1 text-sm font-bold">{"<"}</span>
                <span className="rounded-md border px-1.5 py-1 text-[9px] font-medium leading-tight whitespace-nowrap opacity-0">
                  전술모드
                </span>
              </div>
              <div className="flex min-w-0 flex-nowrap items-center gap-0.5 overflow-x-auto rounded-lg bg-white/10 px-2 py-1.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <MarkBtn active={tool === "pen"} onClick={() => setTool("pen")}>
                  펜
                </MarkBtn>
                <MarkBtn active={tool === "eraser"} onClick={() => setTool("eraser")}>
                  지우개
                </MarkBtn>
                <MarkBtn active={tool === "laser"} onClick={() => setTool("laser")}>
                  레이저
                </MarkBtn>
                {tool === "pen" || tool === "laser" ? (
                  <>
                    <span className="mx-1 h-3.5 w-px shrink-0 bg-white/25" aria-hidden />
                    {(
                      [
                        ["arrow", "화살"],
                        ["solid", "실선"],
                        ["dashed", "점선"],
                      ] as const
                    ).map(([kind, label]) => (
                      <MarkBtn
                        key={kind}
                        active={drawKind === kind}
                        onClick={() => setDrawKind(kind)}
                      >
                        {label}
                      </MarkBtn>
                    ))}
                    <span className="mx-1 h-3.5 w-px shrink-0 bg-white/25" aria-hidden />
                    <div className="flex shrink-0 flex-nowrap items-center gap-1">
                      {PEN_COLORS.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          aria-label={item.label}
                          className={`h-5 w-5 shrink-0 rounded-full ${
                            drawColor === item.value
                              ? "ring-2 ring-white ring-offset-1 ring-offset-[#2a2a40]"
                              : "ring-1 ring-white/30"
                          }`}
                          style={{ backgroundColor: item.value }}
                          onClick={() => setDrawColor(item.value)}
                        />
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

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
        {exportBusy ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
            <p className="rounded-xl bg-panel px-4 py-3 text-sm text-white/90 ring-1 ring-line">
              영상을 만드는 중…
            </p>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 bg-ink-2 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {siblings.length > 1 ? (
          <section className="border-t border-line pt-1.5">
            <button
              type="button"
              className="px-0.5 py-0.5 text-left text-[10px] text-white/50"
              onClick={() => {
                const next = !albumStripOpen;
                albumStripOpenMemory = next;
                setAlbumStripOpen(next);
              }}
            >
              같은 전술 프로젝트 {albumStripOpen ? "∧" : "∨"}
            </button>
            {albumStripOpen ? (
              <div
                ref={albumStripRef}
                className="mt-1 flex cursor-grab select-none gap-2 overflow-x-auto active:cursor-grabbing [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                onPointerDown={(e) => {
                  if (e.pointerType === "touch") return;
                  const el = albumStripRef.current;
                  if (!el) return;
                  albumDraggedRef.current = false;
                  albumDragRef.current = { x: e.clientX, sl: el.scrollLeft, moved: false };
                }}
                onPointerMove={(e) => {
                  const el = albumStripRef.current;
                  const drag = albumDragRef.current;
                  if (!el || !drag) return;
                  const dx = e.clientX - drag.x;
                  if (!drag.moved && Math.abs(dx) > 10) {
                    drag.moved = true;
                    albumDraggedRef.current = true;
                    el.setPointerCapture(e.pointerId);
                  }
                  if (drag.moved) el.scrollLeft = drag.sl - dx;
                }}
                onPointerUp={() => {
                  albumDragRef.current = null;
                }}
                onPointerCancel={() => {
                  albumDragRef.current = null;
                  albumDraggedRef.current = false;
                }}
              >
                {siblings.map((item) => {
                  const active = item.id === play.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-play-id={item.id}
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
                      <div className="pointer-events-none h-14 overflow-hidden bg-ink">
                        {covers[item.id] ? (
                          <CoverImg blob={covers[item.id]} />
                        ) : (
                          <CourtThumb
                            court={item.court}
                            objects={item.cuts[0]?.objects ?? []}
                          />
                        )}
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
                  className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-ink"
                  onClick={togglePlay}
                >
                  {playing ? "정지" : "재생"}
                </button>
                <input
                  type="range"
                  className="h-1.5 min-w-0 flex-1 accent-white"
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
                  className="shrink-0 rounded-lg border border-white/40 px-2 py-1 text-[10px] text-white/75 disabled:opacity-30"
                  disabled={play.cuts.length <= 1}
                  onClick={() => setConfirmDeleteCut(true)}
                >
                  삭제
                </button>
                <div className="relative shrink-0">
                  {speedOpen ? (
                    <div className="absolute bottom-full right-0 z-20 mb-1 flex flex-col gap-0.5 rounded-lg bg-panel p-1 ring-1 ring-line">
                      {([2, 1.5, 1.25, 1] as const).map((speed) => (
                        <button
                          key={speed}
                          type="button"
                          className={`rounded-md px-2.5 py-1 text-[10px] font-medium whitespace-nowrap ${
                            playSpeed === speed
                              ? "bg-white text-ink"
                              : "text-white/75"
                          }`}
                          onClick={() => {
                            setPlaySpeed(speed);
                            setSpeedOpen(false);
                          }}
                        >
                          {speed === 1 ? "1배" : `${speed}배`}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-lg border border-white/40 px-2 py-1 text-[10px] text-white/75"
                    onClick={() => setSpeedOpen((v) => !v)}
                  >
                    {playSpeed === 1 ? "1배" : `${playSpeed}배`}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto">
                {play.cuts.map((cut, i) => {
                  const active = view.activeIndex === i;
                  return (
                    <button
                      key={cut.id}
                      type="button"
                      className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                        active
                          ? "border-white bg-white text-ink"
                          : "border-white/40 text-white/75"
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
                  className="shrink-0 rounded-lg border border-white/40 px-2 py-1 text-[11px] text-white/85"
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
      <Modal open={Boolean(captureNotice)} title="저장" onClose={() => setCaptureNotice(null)}>
        <p className="mb-5 text-sm text-white/75">{captureNotice}</p>
        <button
          type="button"
          className="w-full rounded-xl bg-white py-3 font-semibold text-ink"
          onClick={() => setCaptureNotice(null)}
        >
          확인
        </button>
      </Modal>
      <Modal
        open={exportOpen}
        title="영상으로 저장"
        onClose={exportBusy ? undefined : () => setExportOpen(false)}
      >
        <p className="mb-4 text-sm leading-relaxed text-white/70">
          컷 타임라인을 재생한 결과를 GIF나 영상 파일로 저장합니다. 갤러리에서도 볼 수
          있습니다.
          {play.cuts.length <= 1
            ? " 컷이 하나면 1초 동안 같은 장면이 저장됩니다."
            : ""}
        </p>
        <div className="grid gap-2">
          <button
            type="button"
            className="rounded-xl bg-white py-3 font-semibold text-ink disabled:opacity-40"
            disabled={exportBusy}
            onClick={() => void exportTimeline("gif")}
          >
            {exportBusy ? "만드는 중…" : "GIF로 저장"}
          </button>
          {detectVideoFormat() ? (
            <button
              type="button"
              className="rounded-xl border border-white/40 bg-ink py-3 text-white/85 disabled:opacity-40"
              disabled={exportBusy}
              onClick={() => void exportTimeline("video")}
            >
              영상 파일로 저장
            </button>
          ) : (
            <p className="px-1 text-xs leading-relaxed text-white/45">
              이 브라우저에서는 영상 파일 저장을 지원하지 않습니다. GIF로 저장해 주세요.
            </p>
          )}
          <button
            type="button"
            className="rounded-xl py-3 text-sm text-white/60 disabled:opacity-40"
            disabled={exportBusy}
            onClick={() => setExportOpen(false)}
          >
            닫기
          </button>
        </div>
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
      className={`inline-flex shrink-0 items-center justify-center rounded-md border px-1.5 py-1 text-center text-[9px] font-medium leading-tight whitespace-nowrap disabled:opacity-30 ${
        active ? "border-white text-white" : "border-white/40 text-white/80"
      }`}
    >
      {children}
    </button>
  );
}

function MarkBtn({
  children,
  onClick,
  active,
}: {
  children: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded px-1.5 py-1 text-center text-[9px] font-medium leading-tight whitespace-nowrap ${
        active ? "bg-white/20 text-white" : "text-white/70"
      }`}
    >
      {children}
    </button>
  );
}
