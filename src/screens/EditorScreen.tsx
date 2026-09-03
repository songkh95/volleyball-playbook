import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CoverImg } from "../components/CoverSlot";
import { ConfirmModal } from "../components/ConfirmModal";
import { EditBallModal } from "../components/EditBallModal";
import { EditConeModal } from "../components/EditConeModal";
import { AddPlayerModal, type NewPlayerDraft } from "../components/AddPlayerModal";
import { EditPlayerModal } from "../components/EditPlayerModal";
import { EditTextModal } from "../components/EditTextModal";
import { PresetModal } from "../components/PresetModal";
import { RenameModal } from "../components/RenameModal";
import { SceneCutModal } from "../components/SceneCutModal";
import { SavePlayModal } from "../components/SavePlayModal";
import { ZoneModal } from "../components/ZoneModal";
import { CourtModal } from "../components/CourtModal";
import { Modal } from "../components/Modal";
import { downloadBlob, downloadPng, fileSafeName } from "../lib/capture";
import { duplicatePlay, nextCutName, remapPlayToCourt, sceneLabel, SCENE_NAME_CHIPS } from "../lib/defaultPlay";
import { saveCapture, savePlay } from "../lib/db";
import { registerBackHandler } from "../lib/backHandlers";
import {
  detectVideoFormat,
  encodeGif,
  exportFps,
  exportMaxWidth,
  moviePlayheads,
  movieViews,
  recordVideo,
  waitMs,
} from "../lib/exportMovie";
import { uid } from "../lib/id";
import { cloneCutAfter, cutDurationMs, playheadFromTime, timeFromPlayhead, timelineDurationSec, viewAtPlayhead } from "../lib/interpolate";
import {
  ballTravelToward,
  defaultCoverageOn,
  defaultFan,
  HOLE_FLASH_MS,
  HOLE_FLASHES,
  isOpponent,
  nudgeCoverageM,
  nudgeFanDepth,
  nudgeFanSpread,
  withCoverageDefaults,
} from "../lib/inspect";
import { applyUserPreset, newCone, newPlayer, newText, spawnPointForTeam } from "../lib/presets";
import { applyManualPoseToCuts, playerPoseLeadIn, playerPoseOnCut, poseMapAtPlayhead } from "../lib/playerPose";
import { PEN_COLORS, strokeNearPoint } from "../lib/stroke";
import {
  type Album,
  type CourtObject,
  type CourtType,
  type EditorTool,
  type FormationPreset,
  type Play,
  type PlayerPose,
  type Stroke,
  type StrokeKind,
  type ZoneMode,
} from "../types/play";
import { cameraPresets, type CameraCorner } from "../lib/court3d";
import { CourtCanvas, type CourtCanvasHandle } from "./CourtCanvas";
import { Court3DView, type Court3DHandle } from "./Court3DView";
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
  onSavedToGallery: (albumId: string, playId: string) => void;
  onSaveAndNew: (saved: Play, next: Play) => void;
  onCreateAlbum: (title: string) => Promise<string>;
  onCreateFormation: (play: Play) => void;
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
  onCreateFormation,
}: Props) {
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [looping, setLooping] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectMenu, setSelectMenu] = useState<{ x: number; y: number } | null>(null);
  const [confirmDeleteCut, setConfirmDeleteCut] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [courtOpen, setCourtOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [renameTitleOpen, setRenameTitleOpen] = useState(false);
  const [renameCut, setRenameCut] = useState<number | null>(null);
  const [zoneMode, setZoneMode] = useState<ZoneMode>("none");
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const [tool, setTool] = useState<EditorTool>("select");
  const [drawOpen, setDrawOpen] = useState(false);
  const [drawKind, setDrawKind] = useState<StrokeKind>("arrow");
  const [drawColor, setDrawColor] = useState("#ccff00");
  const [toolsOpen, setToolsOpen] = useState(true);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [albumStripOpen, setAlbumStripOpen] = useState(albumStripOpenMemory);
  const [timelineOpen, setTimelineOpen] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [inspecting, setInspecting] = useState(false);
  const [inspectShowCoverage, setInspectShowCoverage] = useState(true);
  const [holeAlpha, setHoleAlpha] = useState(0);
  const [confirmDeletePlayer, setConfirmDeletePlayer] = useState(false);
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportSource, setExportSource] = useState<"2d" | "3d">("2d");
  const [exportKind, setExportKind] = useState<"gif" | "video">("gif");
  const [exportNeed3d, setExportNeed3d] = useState(false);
  const [view3d, setView3d] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<CameraCorner>("bl");
  const [cameraNonce, setCameraNonce] = useState(0);
  const [placing, setPlacing] = useState<{
    ids: string[];
    index: number;
    fresh: boolean;
  } | null>(null);
  const canvasRef = useRef<CourtCanvasHandle>(null);
  const court3dRef = useRef<Court3DHandle>(null);
  const view3dRef = useRef(false);
  const albumStripRef = useRef<HTMLDivElement>(null);
  const albumDragRef = useRef<{ x: number; sl: number; moved: boolean } | null>(null);
  const albumDraggedRef = useRef(false);
  const cutDragRef = useRef<{ from: number; x: number; y: number; moved: boolean } | null>(null);
  const playheadRef = useRef(0);
  const playingRef = useRef(false);
  const playSpeedRef = useRef(1);
  const loopPlayRef = useRef(false);
  const playRef = useRef(play);
  const undoRef = useRef<Play[]>([]);
  const redoRef = useRef<Play[]>([]);
  const eraseDidRef = useRef(false);
  const persistPausedRef = useRef(false);
  const fanUndoAtRef = useRef(0);
  const holeTimerRef = useRef(0);
  const clipboardRef = useRef<CourtObject[] | null>(null);
  const editingIdRef = useRef<string | null>(null);
  const selectedIdsRef = useRef<string[]>([]);
  const placingRef = useRef<typeof placing>(null);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  playheadRef.current = playhead;
  playingRef.current = playing;
  playSpeedRef.current = playSpeed;
  playRef.current = play;
  view3dRef.current = view3d;
  editingIdRef.current = editingId;
  selectedIdsRef.current = selectedIds;
  placingRef.current = placing;

  const lastCut = Math.max(0, play.cuts.length - 1);
  const placingId = placing ? placing.ids[placing.index] ?? null : null;
  const view = useMemo(
    () => viewAtPlayhead(play.cuts, playhead),
    [play.cuts, playhead],
  );
  const editIndex = Math.min(lastCut, Math.max(0, Math.round(playhead)));
  const editCut = play.cuts[editIndex];
  const balls = play.cuts.flatMap((cut) => cut.objects).filter((o) => o.kind === "ball");
  const ballFanOn = balls.length > 0 && balls.every((o) => Boolean(o.fan));
  const siblings = useMemo(() => {
    const map = new Map(albumPlays.map((p) => [p.id, p]));
    map.set(play.id, play);
    return [...map.values()].sort((a, b) => a.createdAt - b.createdAt);
  }, [albumPlays, play]);

  useEffect(() => {
    if (playhead > lastCut) setPlayhead(lastCut);
  }, [lastCut, playhead]);

  useEffect(() => {
    if (play.court === "half" && (cameraPreset === "tl" || cameraPreset === "tr")) {
      setCameraPreset("bl");
    }
  }, [play.court, cameraPreset]);

  useEffect(() => {
    const next = withCoverageDefaults(play);
    if (next === play) return;
    onChange(next);
  }, [play.id]);

  useEffect(() => {
    if (!playing) return;
    window.clearInterval(holeTimerRef.current);
    holeTimerRef.current = 0;
    setHoleAlpha(0);
  }, [playing]);

  useEffect(() => {
    if (inspecting) return;
    window.clearInterval(holeTimerRef.current);
    holeTimerRef.current = 0;
    setHoleAlpha(0);
  }, [inspecting]);

  useEffect(
    () => () => {
      window.clearInterval(holeTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (persistPausedRef.current) return;
    const t = window.setTimeout(() => {
      if (persistPausedRef.current) return;
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
      const cuts = playRef.current.cuts;
      const total = timelineDurationSec(cuts);
      let time = timeFromPlayhead(cuts, playheadRef.current) + dt * playSpeedRef.current;
      if (time >= total - 1e-4) {
        if (loopPlayRef.current && total > 0) {
          time = time % total;
          const wrapped = playheadFromTime(cuts, time);
          playheadRef.current = wrapped;
          setPlayhead(wrapped);
          raf = window.requestAnimationFrame(step);
          return;
        }
        playheadRef.current = lastCut;
        setPlayhead(lastCut);
        setPlaying(false);
        setLooping(false);
        return;
      }
      const next = playheadFromTime(cuts, time);
      playheadRef.current = next;
      setPlayhead(next);
      raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [playing, lastCut]);

  useEffect(() => {
    if (playing) return;
    setLooping(false);
    loopPlayRef.current = false;
  }, [playing]);

  const editing = useMemo(
    () => editCut?.objects.find((o) => o.id === editingId) ?? null,
    [editCut, editingId],
  );
  const poseByPlayerId = useMemo(
    () => poseMapAtPlayhead(play.cuts, playhead),
    [play.cuts, playhead],
  );
  const editingPlayerPose: PlayerPose = useMemo(() => {
    if (editing?.kind !== "player") return "idle";
    return playerPoseOnCut(editCut?.objects, editing.id);
  }, [editing, editCut]);

  function pushUndo() {
    undoRef.current.push(structuredClone(playRef.current));
    if (undoRef.current.length > 40) undoRef.current.shift();
    redoRef.current = [];
    setUndoCount(undoRef.current.length);
    setRedoCount(0);
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
    redoRef.current.push(structuredClone(playRef.current));
    if (redoRef.current.length > 40) redoRef.current.shift();
    setUndoCount(undoRef.current.length);
    setRedoCount(redoRef.current.length);
    restorePlay(prev);
  }

  function redo() {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(structuredClone(playRef.current));
    if (undoRef.current.length > 40) undoRef.current.shift();
    setUndoCount(undoRef.current.length);
    setRedoCount(redoRef.current.length);
    restorePlay(next);
  }

  function editCutIndex() {
    const current = playRef.current;
    return Math.min(
      Math.max(0, current.cuts.length - 1),
      Math.max(0, Math.round(playheadRef.current)),
    );
  }

  function moveObject(id: string, x: number, y: number) {
    moveObjects([{ id, x, y }]);
  }

  function moveObjects(moves: { id: string; x: number; y: number }[]) {
    const current = playRef.current;
    if (moves.length === 0) return;
    const session = placingRef.current;
    const placingNow = session?.ids[session.index];
    const placeMove = placingNow ? moves.find((m) => m.id === placingNow) : undefined;
    if (placeMove) {
      updatePlay(
        current.cuts.map((c) => ({
          ...c,
          objects: c.objects.map((o) =>
            o.id === placeMove.id ? { ...o, x: placeMove.x, y: placeMove.y } : o,
          ),
        })),
      );
      return;
    }
    const i = editCutIndex();
    const cut = current.cuts[i];
    if (!cut) return;
    const map = new Map(moves.map((m) => [m.id, m]));
    updatePlay(
      current.cuts.map((c, idx) =>
        idx === i
          ? {
              ...c,
              objects: cut.objects.map((o) => {
                const m = map.get(o.id);
                return m ? { ...o, x: m.x, y: m.y } : o;
              }),
            }
          : c,
      ),
    );
  }

  function selectObject(id: string | null, additive = false) {
    if (placingRef.current) return;
    if (!id) {
      setEditingId(null);
      setSelectedIds([]);
      setSelectMenu(null);
      return;
    }
    if (additive) {
      setSelectedIds((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        setEditingId(next[next.length - 1] ?? null);
        if (next.length < 2) setSelectMenu(null);
        return next;
      });
      return;
    }
    setEditingId(id);
    setSelectedIds([id]);
  }

  function selectIds(ids: string[]) {
    if (placingRef.current) return;
    setSelectedIds(ids);
    setEditingId(ids[ids.length - 1] ?? null);
    if (ids.length < 2) setSelectMenu(null);
  }

  function setCourt(court: CourtType) {
    const current = playRef.current;
    if (current.court === court) return;
    pushUndo();
    restorePlay(remapPlayToCourt(current, court));
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

  function moveCut(from: number, to: number) {
    if (from === to || to < 0) return;
    const cuts = [...playRef.current.cuts];
    if (to >= cuts.length) return;
    pushUndo();
    const [item] = cuts.splice(from, 1);
    cuts.splice(to, 0, item);
    updatePlay(cuts);
    setPlayhead(to);
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

  function setCutDuration(index: number, ms: number) {
    const current = playRef.current;
    const cut = current.cuts[index];
    if (!cut || cutDurationMs(cut) === ms) return;
    pushUndo();
    updatePlay(
      current.cuts.map((c, idx) => (idx === index ? { ...c, durationMs: ms } : c)),
    );
  }

  function copySelected() {
    const current = playRef.current;
    const cut = current.cuts[editCutIndex()];
    const ids = selectedIdsRef.current;
    const picked = cut?.objects.filter((o) => ids.includes(o.id)) ?? [];
    if (picked.length) {
      clipboardRef.current = picked.map((o) => ({ ...o }));
      return;
    }
    const id = editingIdRef.current;
    const obj = cut?.objects.find((o) => o.id === id);
    if (!obj) return;
    clipboardRef.current = [{ ...obj }];
  }

  function pasteClipboard() {
    const clip = clipboardRef.current;
    if (!clip?.length) return;
    pushUndo();
    const copies = clip.map((o) => ({
      ...o,
      id: uid(),
      x: Math.min(0.92, o.x + 0.06),
      y: Math.min(0.92, o.y + 0.06),
    }));
    updatePlay(
      playRef.current.cuts.map((c) => ({
        ...c,
        objects: [...c.objects, ...copies.map((o) => ({ ...o }))],
      })),
    );
    setEditingId(copies[copies.length - 1]?.id ?? null);
    setSelectedIds(copies.map((o) => o.id));
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

  function idsWithoutBall(ids: string[]) {
    const kind = new Map(
      playRef.current.cuts.flatMap((c) => c.objects).map((o) => [o.id, o.kind]),
    );
    return ids.filter((id) => kind.get(id) !== "ball");
  }

  function deletePlayer() {
    const ids = idsWithoutBall(
      selectedIdsRef.current.length
        ? selectedIdsRef.current
        : editingId
          ? [editingId]
          : [],
    );
    if (ids.length === 0) {
      setConfirmDeletePlayer(false);
      return;
    }
    pushUndo();
    const drop = new Set(ids);
    updatePlay(
      playRef.current.cuts.map((c) => ({
        ...c,
        objects: c.objects.filter((o) => !drop.has(o.id)),
      })),
    );
    setEditingId(null);
    setSelectedIds([]);
    setSelectMenu(null);
    setConfirmDeletePlayer(false);
  }

  function addPlayers(drafts: NewPlayerDraft[]) {
    if (drafts.length === 0 || placingRef.current) return;
    pushUndo();
    const current = playRef.current;
    const existing: CourtObject[] = [...(current.cuts[editCutIndex()]?.objects ?? [])];
    const created = drafts.map((draft) => {
      const spawn = spawnPointForTeam(current.court, draft.team, existing);
      const player = newPlayer(current.court, { ...draft, x: spawn.x, y: spawn.y });
      existing.push(player);
      return player;
    });
    updatePlay(
      current.cuts.map((c) => ({
        ...c,
        objects: [...c.objects, ...created.map((p) => ({ ...p }))],
      })),
    );
    setAddPlayerOpen(false);
    setPlaying(false);
    const i = editCutIndex();
    playheadRef.current = i;
    setPlayhead(i);
    setEditingId(null);
    setSelectedIds([created[0].id]);
    setPlacing({ ids: created.map((p) => p.id), index: 0, fresh: true });
  }

  function startReplacing(id: string) {
    if (placingRef.current) return;
    const obj = playRef.current.cuts[editCutIndex()]?.objects.find((o) => o.id === id);
    if (!obj || obj.kind !== "player") return;
    pushUndo();
    setPlaying(false);
    const i = editCutIndex();
    playheadRef.current = i;
    setPlayhead(i);
    setEditingId(null);
    setSelectedIds([id]);
    setPlacing({ ids: [id], index: 0, fresh: false });
  }

  function confirmPlacing() {
    const session = placingRef.current;
    if (!session) return;
    if (session.index + 1 < session.ids.length) {
      const next = session.index + 1;
      setPlacing({ ...session, index: next });
      setSelectedIds([session.ids[next]]);
      return;
    }
    setPlacing(null);
  }

  function cancelPlacing() {
    const session = placingRef.current;
    if (!session) return;
    const current = playRef.current;
    if (session.fresh && session.index === 0) {
      const prev = undoRef.current.pop();
      if (prev) {
        setUndoCount(undoRef.current.length);
        restorePlay(prev);
      }
    } else if (session.fresh) {
      const drop = new Set(session.ids.slice(session.index));
      updatePlay(
        current.cuts.map((c) => ({
          ...c,
          objects: c.objects.filter((o) => !drop.has(o.id)),
        })),
      );
    } else {
      const prev = undoRef.current.pop();
      if (prev) {
        setUndoCount(undoRef.current.length);
        restorePlay(prev);
      }
    }
    setPlacing(null);
    setSelectedIds([]);
  }

  function addCone() {
    pushUndo();
    const cone = newCone(play.court);
    updatePlay(
      play.cuts.map((c) => ({ ...c, objects: [...c.objects, { ...cone }] })),
    );
    setEditingId(cone.id);
    setSelectedIds([cone.id]);
  }

  function addText() {
    pushUndo();
    const text = newText(play.court);
    updatePlay(
      play.cuts.map((c) => ({ ...c, objects: [...c.objects, { ...text }] })),
    );
    setEditingId(text.id);
    setSelectedIds([text.id]);
  }

  function enterInspect() {
    setInspecting(true);
    setDrawOpen(false);
    setTool("select");
    setPlaying(false);
    setToolsOpen(true);
    const i = editCutIndex();
    playheadRef.current = i;
    setPlayhead(i);
    setInspectShowCoverage(true);
  }

  function stopHoleFlash() {
    window.clearInterval(holeTimerRef.current);
    holeTimerRef.current = 0;
    setHoleAlpha(0);
  }

  function flashHoles() {
    if (playingRef.current) return;
    window.clearInterval(holeTimerRef.current);
    let n = 0;
    setHoleAlpha(0.62);
    holeTimerRef.current = window.setInterval(() => {
      n += 1;
      if (n >= HOLE_FLASHES * 2 || playingRef.current) {
        stopHoleFlash();
        return;
      }
      setHoleAlpha(n % 2 === 0 ? 0.62 : 0);
    }, HOLE_FLASH_MS);
  }

  function nudgeOurCoverage(delta: number) {
    pushUndo();
    const current = playRef.current;
    updatePlay(
      current.cuts.map((cut) => ({
        ...cut,
        objects: cut.objects.map((o) => {
          if (o.kind !== "player" || isOpponent(o) || !defaultCoverageOn(o)) return o;
          return { ...o, coverageOn: true, coverageM: nudgeCoverageM(o, delta) };
        }),
      })),
    );
  }

  function setAllBallFans(on: boolean) {
    pushUndo();
    const current = playRef.current;
    const sample = current.cuts
      .flatMap((c) => c.objects)
      .find((o) => o.kind === "ball" && o.fan)?.fan;
    updatePlay(
      current.cuts.map((cut, idx) => ({
        ...cut,
        objects: cut.objects.map((o) => {
          if (o.kind !== "ball") return o;
          if (!on) return { ...o, fan: null };
          const toward = ballTravelToward(current.cuts, idx, o);
          const base = defaultFan(current.court, o, toward);
          const src = o.fan ?? sample ?? base;
          return { ...o, fan: { ...src, heading: base.heading } };
        }),
      })),
    );
  }

  function nudgeAllBallFans(kind: "spread" | "depth", dir: -1 | 1) {
    pushUndo();
    const current = playRef.current;
    updatePlay(
      current.cuts.map((cut, idx) => ({
        ...cut,
        objects: cut.objects.map((o) => {
          if (o.kind !== "ball") return o;
          const toward = ballTravelToward(current.cuts, idx, o);
          const base = o.fan ?? defaultFan(current.court, o, toward);
          const fan =
            kind === "spread"
              ? nudgeFanSpread(base, dir * 6)
              : nudgeFanDepth(base, dir);
          return { ...o, fan };
        }),
      })),
    );
  }

  function patchObject(id: string, patch: Partial<CourtObject>) {
    pushUndo();
    updatePlay(
      play.cuts.map((c) => ({
        ...c,
        objects: c.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
      })),
    );
    setEditingId(null);
    setSelectedIds([]);
  }

  function applyFormation(preset: FormationPreset) {
    pushUndo();
    const i = editIndex;
    const { objects, extras } = applyUserPreset(
      play.cuts[i].objects,
      preset.objects,
      preset.court,
      play.court,
    );
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
      setLooping(false);
      loopPlayRef.current = false;
      setSpeedOpen(false);
      return;
    }
    setSpeedOpen(false);
    startPlay(false);
  }

  function startPlay(loop: boolean) {
    if (lastCut === 0) return;
    loopPlayRef.current = loop;
    setLooping(loop);
    setSpeedOpen(false);
    if (!playing && playhead >= lastCut - 0.001) setPlayhead(0);
    setPlaying(true);
  }

  function leaveNow(action: () => void) {
    persistPausedRef.current = true;
    void savePlay(playRef.current)
      .then(action)
      .catch((err) => {
        persistPausedRef.current = false;
        setCaptureNotice(err instanceof Error ? err.message : "저장하지 못했습니다.");
      });
  }

  useEffect(() => {
    return registerBackHandler(() => {
      leaveNow(onBack);
      return true;
    });
  }, [onBack]);

  useEffect(() => {
    if (!placing) return;
    return registerBackHandler(() => {
      cancelPlacing();
      return true;
    });
  }, [placing]);

  useEffect(() => {
    function typing(target: EventTarget | null) {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
    }
    function onKey(e: KeyboardEvent) {
      if (typing(e.target)) return;
      if (placingRef.current) {
        if (e.key === "Escape") {
          e.preventDefault();
          cancelPlacing();
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          confirmPlacing();
          return;
        }
        e.preventDefault();
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copySelected();
        return;
      }
      if (mod && e.key.toLowerCase() === "v") {
        e.preventDefault();
        pasteClipboard();
        return;
      }
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const cut = playRef.current.cuts[editCutIndex()];
        selectIds(
          (cut?.objects.filter((o) => o.kind !== "ball").map((o) => o.id) ?? []),
        );
        return;
      }
      if (e.key === " " && !e.repeat) {
        e.preventDefault();
        if (playingRef.current) setPlaying(false);
        else startPlay(false);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const raw = selectedIdsRef.current.length
          ? selectedIdsRef.current
          : editingIdRef.current
            ? [editingIdRef.current]
            : [];
        if (idsWithoutBall(raw).length === 0) return;
        e.preventDefault();
        setConfirmDeletePlayer(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function commitSave(input: { title: string; albumId: string }) {
    return { ...playRef.current, title: input.title, albumId: input.albumId, updatedAt: Date.now() };
  }

  async function captureFrame() {
    try {
      const blob = view3dRef.current
        ? await court3dRef.current?.toPngBlob()
        : await canvasRef.current?.toPngBlob();
      if (!blob) {
        setCaptureNotice("코트를 캡처할 수 없습니다.");
        return;
      }
      const cutIndex = editCutIndex();
      const cut = playRef.current.cuts[cutIndex] ?? playRef.current.cuts[0];
      const stamp = new Date();
      const time = `${stamp.getHours().toString().padStart(2, "0")}${stamp.getMinutes().toString().padStart(2, "0")}`;
      await saveCapture({
        id: uid(),
        playId: playRef.current.id,
        playTitle: playRef.current.title,
        cutName: sceneLabel(cut?.name, cutIndex),
        createdAt: Date.now(),
        blob,
      });
      downloadPng(
        blob,
        `${fileSafeName(playRef.current.title)}-${fileSafeName(sceneLabel(cut?.name, cutIndex))}-${time}`,
      );
      setCaptureNotice("갤러리에 저장했고, 기기로도 내려받았습니다.");
    } catch (err) {
      setCaptureNotice(err instanceof Error ? err.message : "캡처에 실패했습니다.");
    }
  }

  async function exportTimeline() {
    if (exportBusy) return;
    const source = exportSource;
    const kind = exportKind;
    if (kind === "video" && !detectVideoFormat()) return;
    setPlaying(false);
    setExportBusy(true);
    const mount3d = source === "3d" && !view3dRef.current;
    if (mount3d) setExportNeed3d(true);
    try {
      if (source === "3d") {
        const readyAt = Date.now() + 5000;
        while (!court3dRef.current && Date.now() < readyAt) {
          await waitMs(50);
        }
        if (!court3dRef.current) {
          throw new Error("3D 코트를 캡처할 수 없습니다.");
        }
        await waitMs(mount3d ? 900 : 120);
      }
      const current = playRef.current;
      const fps = exportFps(kind);
      const maxWidth = exportMaxWidth(kind);
      const frames =
        source === "3d"
          ? await court3dRef.current?.captureViews(moviePlayheads(current.cuts, fps), maxWidth)
          : await canvasRef.current?.captureViews(
              movieViews(current.cuts, showTrails, fps),
              maxWidth,
            );
      if (!frames?.length) {
        throw new Error("코트를 캡처할 수 없습니다.");
      }
      const stamp = new Date();
      const time = `${stamp.getHours().toString().padStart(2, "0")}${stamp.getMinutes().toString().padStart(2, "0")}`;
      let blob: Blob;
      let ext: string;
      if (kind === "gif") {
        blob = await encodeGif(frames, fps);
        ext = "gif";
      } else {
        const recorded = await recordVideo(frames, fps);
        blob = recorded.blob;
        ext = recorded.ext;
      }
      const viewLabel = source === "3d" ? "3D" : "2D";
      const kindLabel = kind === "gif" ? "GIF" : ext.toUpperCase();
      await saveCapture({
        id: uid(),
        playId: playRef.current.id,
        playTitle: playRef.current.title,
        cutName: `${viewLabel} ${kindLabel}`,
        createdAt: Date.now(),
        blob,
      });
      downloadBlob(
        blob,
        `${fileSafeName(playRef.current.title)}-${source}-${time}`,
        ext,
      );
      setExportOpen(false);
      setCaptureNotice("갤러리에 저장했고, 기기로도 내려받았습니다.");
    } catch (err) {
      setCaptureNotice(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setExportBusy(false);
      setExportNeed3d(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-ink">
    <div className="relative z-40 grid shrink-0 grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto] items-start gap-x-2 gap-y-1.5 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2">
        <button
          type="button"
          className="rounded-xl px-3 py-2 text-sm text-white/85"
          onClick={() => leaveNow(onBack)}
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
          onClick={() => {
            setExportSource(view3d ? "3d" : "2d");
            setExportKind(detectVideoFormat() ? "video" : "gif");
            setExportOpen(true);
          }}
        >
          영상
        </button>
      </div>
        <div className="relative col-start-2 row-start-1 row-span-2 flex flex-col items-stretch gap-1 self-start">
          <button
            type="button"
            className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-ink"
            onClick={() => setSaveOpen(true)}
          >
            저장
          </button>
          <button
            type="button"
            className={`flex items-center justify-center rounded-xl py-1.5 ${
              toolsMenuOpen
                ? "bg-accent text-ink"
                : "text-white/85 glass"
            }`}
            aria-label={toolsMenuOpen ? "도구 메뉴 닫기" : "도구 메뉴"}
            aria-expanded={toolsMenuOpen}
            onClick={() => setToolsMenuOpen((v) => !v)}
          >
            {toolsMenuOpen ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                <path
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  d="M6 6l12 12M18 6L6 18"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                <path
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  d="M5 7h14M5 12h14M5 17h14"
                />
              </svg>
            )}
          </button>
          {toolsMenuOpen ? (
            <div className="absolute right-0 top-full z-40 mt-1.5 flex min-w-[5.5rem] flex-col gap-1 rounded-xl glass p-1.5 shadow-xl">
              <ToolBtn
                className="w-full px-2.5 py-2 text-[11px]"
                onClick={() => {
                  setToolsMenuOpen(false);
                  setCourtOpen(true);
                }}
              >
                코트
              </ToolBtn>
              <ToolBtn
                className="w-full px-2.5 py-2 text-[11px]"
                active={showTrails}
                onClick={() => setShowTrails((v) => !v)}
              >
                {showTrails ? "동선 숨김" : "동선 표시"}
              </ToolBtn>
              <ToolBtn
                className="w-full px-2.5 py-2 text-[11px]"
                onClick={() => {
                  setToolsMenuOpen(false);
                  setZoneOpen(true);
                }}
              >
                구역
              </ToolBtn>
              <ToolBtn
                className="w-full px-2.5 py-2 text-[11px]"
                onClick={() => {
                  setToolsMenuOpen(false);
                  setPresetOpen(true);
                }}
              >
                대형
              </ToolBtn>
              <ToolBtn
                className="w-full px-2.5 py-2 text-[11px]"
                onClick={() => {
                  setToolsMenuOpen(false);
                  setAddPlayerOpen(true);
                }}
              >
                선수
              </ToolBtn>
              <ToolBtn
                className="w-full px-2.5 py-2 text-[11px]"
                onClick={() => {
                  setToolsMenuOpen(false);
                  addCone();
                }}
              >
                콘
              </ToolBtn>
              <ToolBtn
                className="w-full px-2.5 py-2 text-[11px]"
                onClick={() => {
                  setToolsMenuOpen(false);
                  addText();
                }}
              >
                텍스트
              </ToolBtn>
            </div>
          ) : null}
        </div>
        <div className="col-start-1 row-start-2 flex max-w-full flex-col gap-1.5">
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
                  active={tool === "select" && !drawOpen && !view3d && !inspecting}
                  disabled={exportBusy}
                  onClick={() => {
                    setView3d(false);
                    setInspecting(false);
                    setTool("select");
                    setDrawOpen(false);
                  }}
                >
                  전술모드
                </ToolBtn>
                <ToolBtn
                  active={inspecting}
                  disabled={exportBusy}
                  onClick={() => {
                    if (inspecting) {
                      setInspecting(false);
                      return;
                    }
                    enterInspect();
                  }}
                >
                  영역
                </ToolBtn>
                <ToolBtn
                  active={view3d}
                  disabled={exportBusy}
                  onClick={() => {
                    setView3d((v) => {
                      if (!v) setCameraNonce((n) => n + 1);
                      return !v;
                    });
                    setDrawOpen(false);
                    setTool("select");
                    setEditingId(null);
                    setSelectedIds([]);
                  }}
                >
                  3D 보기
                </ToolBtn>
                <ToolBtn
                  active={drawOpen || tool === "pen" || tool === "eraser" || tool === "laser"}
                  onClick={() => {
                    setInspecting(false);
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
                <span className="mx-1.5 h-3.5 w-px shrink-0 bg-white/40" aria-hidden />
                <HistoryBtn
                  label="이전"
                  disabled={undoCount === 0}
                  onClick={undo}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                    <path
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"
                    />
                  </svg>
                </HistoryBtn>
                <HistoryBtn
                  label="앞으로 가기"
                  disabled={redoCount === 0}
                  onClick={redo}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                    <path
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3"
                    />
                  </svg>
                </HistoryBtn>
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
              <div className="flex min-w-0 flex-nowrap items-center gap-0.5 overflow-x-auto rounded-lg glass px-2 py-1.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
          {inspecting && toolsOpen ? (
            <>
              <div className="flex items-start gap-1">
                <div className="pointer-events-none invisible flex shrink-0 gap-1" aria-hidden>
                  <span className="px-1 py-1 text-sm font-bold">{"<"}</span>
                  <span className="rounded-md border px-1.5 py-1 text-[9px] font-medium leading-tight whitespace-nowrap opacity-0">
                    전술모드
                  </span>
                </div>
                <div className="flex min-w-0 flex-nowrap items-center gap-0.5 overflow-x-auto rounded-lg glass px-2 py-1.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <span className="mr-1 shrink-0 text-[10px] font-semibold text-white/70">
                    선수 영역
                  </span>
                  <MarkBtn
                    active={inspectShowCoverage}
                    onClick={() => setInspectShowCoverage(true)}
                  >
                    ON
                  </MarkBtn>
                  <MarkBtn
                    active={!inspectShowCoverage}
                    onClick={() => setInspectShowCoverage(false)}
                  >
                    OFF
                  </MarkBtn>
                  <span className="mx-1 h-3.5 w-px shrink-0 bg-white/25" aria-hidden />
                  <MarkBtn onClick={() => nudgeOurCoverage(-1)}>-1m</MarkBtn>
                  <MarkBtn onClick={() => nudgeOurCoverage(1)}>+1m</MarkBtn>
                  <span className="mx-1 h-3.5 w-px shrink-0 bg-white/25" aria-hidden />
                  <MarkBtn
                    active={holeAlpha > 0}
                    onClick={() => {
                      if (playing) return;
                      flashHoles();
                    }}
                  >
                    빈틈
                  </MarkBtn>
                </div>
              </div>
              <div className="flex items-start gap-1">
                <div className="pointer-events-none invisible flex shrink-0 gap-1" aria-hidden>
                  <span className="px-1 py-1 text-sm font-bold">{"<"}</span>
                  <span className="rounded-md border px-1.5 py-1 text-[9px] font-medium leading-tight whitespace-nowrap opacity-0">
                    전술모드
                  </span>
                </div>
                <div className="flex min-w-0 flex-nowrap items-center gap-0.5 overflow-x-auto rounded-lg glass px-2 py-1.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <span className="mr-1 shrink-0 text-[10px] font-semibold text-white/70">
                    공 영역
                  </span>
                  <MarkBtn active={ballFanOn} onClick={() => setAllBallFans(true)}>
                    ON
                  </MarkBtn>
                  <MarkBtn active={!ballFanOn} onClick={() => setAllBallFans(false)}>
                    OFF
                  </MarkBtn>
                  <span className="mx-1 h-3.5 w-px shrink-0 bg-white/25" aria-hidden />
                  <span className="mr-0.5 shrink-0 text-[10px] font-semibold text-white/70">
                    퍼짐
                  </span>
                  <MarkBtn onClick={() => nudgeAllBallFans("spread", -1)}>-</MarkBtn>
                  <MarkBtn onClick={() => nudgeAllBallFans("spread", 1)}>+</MarkBtn>
                  <span className="mx-1 h-3.5 w-px shrink-0 bg-white/25" aria-hidden />
                  <span className="mr-0.5 shrink-0 text-[10px] font-semibold text-white/70">
                    길이
                  </span>
                  <MarkBtn onClick={() => nudgeAllBallFans("depth", -1)}>-</MarkBtn>
                  <MarkBtn onClick={() => nudgeAllBallFans("depth", 1)}>+</MarkBtn>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 isolate">
        {toolsMenuOpen ? (
          <button
            type="button"
            className="absolute inset-0 z-20 cursor-default"
            aria-label="메뉴 닫기"
            onClick={() => setToolsMenuOpen(false)}
          />
        ) : null}
        <div className={view3d || exportNeed3d ? "invisible pointer-events-none absolute inset-0" : "h-full"}>
          <CourtCanvas
            ref={canvasRef}
            court={play.court}
            objects={view.objects}
            poseByPlayerId={poseByPlayerId}
            trails={placingId || !showTrails ? [] : view.trails}
            strokes={view.strokes}
            zoneMode={zoneMode}
            tool={tool}
            drawColor={drawColor}
            drawKind={drawKind}
            interactive={!playing && !view3d}
            selectedIds={selectedIds}
            placingId={placingId}
            showCoverage={inspecting && inspectShowCoverage}
            holeAlpha={playing ? 0 : holeAlpha}
            onPointerStart={() => {
              setPlaying(false);
              const i = Math.min(lastCut, Math.max(0, Math.round(playheadRef.current)));
              playheadRef.current = i;
              setPlayhead(i);
            }}
            onMoveBegin={() => {
              if (!placingRef.current) pushUndo();
            }}
            onMove={moveObject}
            onMoveMany={moveObjects}
            onSelectPlayer={selectObject}
            onPlacePlayer={startReplacing}
            onSelectIds={selectIds}
            onSelectNone={() => selectObject(null)}
            onSelectionMenu={(pos) => {
              const w = 188;
              const h = 52;
              setSelectMenu({
                x: Math.min(Math.max(8, pos.x), window.innerWidth - w - 8),
                y: Math.min(Math.max(8, pos.y), window.innerHeight - h - 8),
              });
            }}
            onStrokeEnd={addStroke}
            onEraseBegin={eraseBegin}
            onEraseAt={eraseAt}
          />
        </div>
        {view3d || exportNeed3d ? (
          <div className={`absolute inset-0 h-full w-full ${view3d ? "z-10" : "z-[5]"}`}>
            <Court3DView
              ref={court3dRef}
              court={play.court}
              objects={view.objects}
              cuts={play.cuts}
              playhead={playhead}
              trails={placingId || !showTrails ? [] : view.trails}
              strokes={view.strokes}
              showTrails={showTrails && !placingId}
              showCoverage={inspecting && inspectShowCoverage}
              zoneMode={zoneMode}
              holeAlpha={playing ? 0 : holeAlpha}
              interactive={!playing && view3d}
              placingId={placingId}
              onPointerStart={() => {
                setPlaying(false);
                const i = Math.min(lastCut, Math.max(0, Math.round(playheadRef.current)));
                playheadRef.current = i;
                setPlayhead(i);
              }}
              onMoveBegin={() => {
                if (!placingRef.current) pushUndo();
              }}
              onMove={moveObject}
              onPlacePlayer={startReplacing}
              cameraPreset={cameraPreset}
              cameraNonce={cameraNonce}
            />
            {view3d ? (
              <>
            <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center px-2">
              <div className="pointer-events-auto flex flex-wrap justify-center gap-1 rounded-xl glass p-1">
                {cameraPresets(play.court).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-medium ${
                      cameraPreset === item.id
                        ? "bg-accent text-ink"
                        : "text-white/80"
                    }`}
                    onClick={() => {
                      setCameraPreset(item.id);
                      setCameraNonce((n) => n + 1);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            {!placingId ? (
            <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[10px] text-white/70">
              드래그로 선수·공을 옮깁니다. 빈 곳을 드래그하면 카메라가 돕니다.
            </p>
            ) : null}
              </>
            ) : null}
          </div>
        ) : null}
        {placingId ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center px-3">
            <div className="pointer-events-auto flex items-center gap-2 rounded-2xl glass-bar px-2 py-2">
              <p className="px-2 text-xs text-white/80">
                {placing && placing.ids.length > 1
                  ? `처음 위치 ${placing.index + 1}/${placing.ids.length}`
                  : "처음 위치 지정"}
              </p>
              <button
                type="button"
                className="rounded-xl px-3 py-2 text-sm text-white/80 ring-1 ring-line"
                onClick={cancelPlacing}
              >
                취소
              </button>
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-ink"
                aria-label="위치 확정"
                onClick={confirmPlacing}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
                  <path
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 12.5l5 5L19 7"
                  />
                </svg>
              </button>
            </div>
          </div>
        ) : null}
        {exportBusy ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
            <p className="rounded-xl glass px-4 py-3 text-sm text-white/90">
              영상을 만드는 중…
            </p>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 glass-bar px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
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
                        leaveNow(() => onOpenPlay(item.id));
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
            타임라인 {timelineOpen ? "∧" : "∨"}
          </button>
          {timelineOpen ? (
            <>
              <div className="mb-3 mt-1 flex items-center gap-1.5">
                <button
                  type="button"
                  className="shrink-0 rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-ink"
                  onClick={togglePlay}
                >
                  {playing ? "정지" : "재생"}
                </button>
                <button
                  type="button"
                  aria-label="반복 재생"
                  title="반복 재생"
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                    looping
                      ? "border-accent bg-accent text-ink"
                      : "border-white/20 text-white/80"
                  }`}
                  onClick={() => {
                    if (playing && looping) {
                      setPlaying(false);
                      setLooping(false);
                      loopPlayRef.current = false;
                      return;
                    }
                    startPlay(true);
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polyline points="17 1 21 5 17 9" />
                    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <polyline points="7 23 3 19 7 15" />
                    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </svg>
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
                    setLooping(false);
                    loopPlayRef.current = false;
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
                    <div className="absolute bottom-full right-0 z-20 mb-1 flex flex-col gap-0.5 rounded-lg glass p-1">
                      {([2, 1.5, 1.25, 1] as const).map((speed) => (
                        <button
                          key={speed}
                          type="button"
                          className={`rounded-md px-2.5 py-1 text-[10px] font-medium whitespace-nowrap ${
                            playSpeed === speed
                              ? "bg-accent text-ink"
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
                    onClick={() => {
                      setSpeedOpen((v) => !v);
                    }}
                  >
                    {playSpeed === 1 ? "1배" : `${playSpeed}배`}
                  </button>
                </div>
              </div>

              <p className="mb-1 text-[10px] text-white/40">장면을 끌어서 순서를 바꿉니다.</p>
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {play.cuts.map((cut, i) => {
                  const active = view.activeIndex === i;
                  return (
                    <button
                      key={cut.id}
                      type="button"
                      data-cut-index={i}
                      className={`shrink-0 touch-none select-none rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                        active
                          ? "border-accent bg-accent text-ink"
                          : "border-white/20 text-white/75"
                      }`}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        cutDragRef.current = {
                          from: i,
                          x: e.clientX,
                          y: e.clientY,
                          moved: false,
                        };
                        try {
                          e.currentTarget.setPointerCapture(e.pointerId);
                        } catch {
                          /* synthetic events may not support capture */
                        }
                      }}
                      onPointerMove={(e) => {
                        const d = cutDragRef.current;
                        if (!d || d.from !== i) return;
                        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) d.moved = true;
                      }}
                      onPointerUp={(e) => {
                        const d = cutDragRef.current;
                        cutDragRef.current = null;
                        if (!d || d.from !== i) return;
                        if (d.moved) {
                          const el = document.elementFromPoint(e.clientX, e.clientY);
                          const btn = el?.closest("[data-cut-index]") as HTMLElement | null;
                          if (btn) {
                            const to = Number(btn.dataset.cutIndex);
                            if (Number.isFinite(to)) moveCut(d.from, to);
                          }
                          return;
                        }
                        setPlaying(false);
                        if (active) {
                          setRenameCut(i);
                          return;
                        }
                        setPlayhead(i);
                      }}
                    >
                      {sceneLabel(cut.name, i)}
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

      <EditBallModal
        object={!view3d && selectedIds.length <= 1 && editing?.kind === "ball" ? editing : null}
        court={play.court}
        cutIndex={editIndex}
        travelTo={
          editing?.kind === "ball"
            ? ballTravelToward(play.cuts, editCutIndex(), editing)
            : undefined
        }
        onClose={() => setEditingId(null)}
        onSave={(patch) => {
          const id = editingId;
          if (!id) return;
          const i = editCutIndex();
          const current = playRef.current;
          const cut = current.cuts[i];
          const ball = cut?.objects.find((o) => o.id === id);
          const prevH = ball?.height;
          const sameHeight =
            patch.height == null
              ? prevH == null
              : prevH != null && Math.abs(prevH - patch.height) < 1e-6;
          const sameFlight = (ball?.flight ?? undefined) === patch.flight;
          const sameFan =
            JSON.stringify(ball?.fan ?? null) === JSON.stringify(patch.fan ?? null);
          if (sameHeight && sameFlight && sameFan) return;
          const fanOnly = sameHeight && sameFlight;
          const now = Date.now();
          if (!fanOnly || now - fanUndoAtRef.current > 700) {
            pushUndo();
            if (fanOnly) fanUndoAtRef.current = now;
          } else {
            fanUndoAtRef.current = now;
          }
          updatePlay(
            current.cuts.map((c, idx) => {
              if (idx !== i) return c;
              return {
                ...c,
                objects: c.objects.map((o) => {
                  if (o.id !== id) return o;
                  const next = { ...o };
                  if (patch.height == null) delete next.height;
                  else next.height = patch.height;
                  if (patch.flight == null) delete next.flight;
                  else next.flight = patch.flight;
                  if (patch.fan == null) delete next.fan;
                  else next.fan = patch.fan;
                  return next;
                }),
              };
            }),
          );
        }}
      />
      <EditConeModal
        object={!view3d && selectedIds.length <= 1 && editing?.kind === "cone" ? editing : null}
        onClose={() => setEditingId(null)}
        onSave={(patch) => {
          if (!editingId) return;
          patchObject(editingId, patch);
        }}
        onDelete={deletePlayer}
      />
      <EditTextModal
        object={!view3d && selectedIds.length <= 1 && editing?.kind === "text" ? editing : null}
        onClose={() => setEditingId(null)}
        onSave={(patch) => {
          if (!editingId) return;
          patchObject(editingId, patch);
        }}
        onDelete={deletePlayer}
      />
      <AddPlayerModal
        open={addPlayerOpen}
        onClose={() => setAddPlayerOpen(false)}
        onCreate={addPlayers}
      />
      <EditPlayerModal
        object={
          !placingId && !view3d && selectedIds.length <= 1 && editing?.kind === "player"
            ? editing
            : null
        }
        activePose={editingPlayerPose}
        onClose={() => setEditingId(null)}
        onSave={(patch) => {
          pushUndo();
          updatePlay(
            playRef.current.cuts.map((c) => ({
              ...c,
              objects: c.objects.map((o) =>
                o.id === editingId && o.kind === "player" ? { ...o, ...patch } : o,
              ),
            })),
          );
          setEditingId(null);
        }}
        hasPreviousCut={editCutIndex() > 0}
        onSetPose={(pose, fromPrevious) => {
          const id = editingId;
          if (!id) return;
          const cut = editCutIndex();
          const cuts = playRef.current.cuts;
          const sameHere = playerPoseOnCut(cuts[cut]?.objects, id) === pose;
          const sameLead = playerPoseLeadIn(cuts[cut]?.objects, id) === fromPrevious;
          if (sameHere && sameLead) return;
          pushUndo();
          updatePlay(applyManualPoseToCuts(cuts, cut, id, pose, fromPrevious));
        }}
        onDelete={() => setConfirmDeletePlayer(true)}
      />
      {selectMenu && idsWithoutBall(selectedIds).length > 1 ? (
        <div
          className="fixed inset-0 z-50"
          onPointerDown={() => setSelectMenu(null)}
        >
          <div
            className="absolute min-w-[11rem] rounded-xl glass p-1"
            style={{ left: selectMenu.x, top: selectMenu.y }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="w-full rounded-lg bg-red-700 px-3 py-2.5 text-sm font-semibold"
              onClick={() => {
                setSelectMenu(null);
                setConfirmDeletePlayer(true);
              }}
            >
              선택한 {idsWithoutBall(selectedIds).length}개 삭제
            </button>
          </div>
        </div>
      ) : null}
      <ConfirmModal
        open={confirmDeletePlayer}
        title={idsWithoutBall(selectedIds).length > 1 ? "객체 삭제" : "선수 삭제"}
        message={
          idsWithoutBall(selectedIds).length > 1
            ? `선택한 ${idsWithoutBall(selectedIds).length}개를 모든 장면에서 삭제할까요?`
            : `‘${editing?.label ?? "선수"}’ 선수를 모든 장면에서 삭제할까요?`
        }
        confirmLabel="삭제"
        onClose={() => setConfirmDeletePlayer(false)}
        onConfirm={deletePlayer}
      />
      <ConfirmModal
        open={confirmDeleteCut}
        title="장면 삭제"
        message={`현재 장면을 삭제하시겠습니까?\n현재 장면: ${sceneLabel(editCut?.name, editIndex)} (전체 ${play.cuts.length}개 중 ${editIndex + 1}번째)`}
        confirmLabel="삭제"
        onClose={() => setConfirmDeleteCut(false)}
        onConfirm={deleteCut}
      />
      <CourtModal
        open={courtOpen}
        value={play.court}
        onClose={() => setCourtOpen(false)}
        onSelect={setCourt}
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
        onCreateNew={() => {
          setPresetOpen(false);
          const current = playRef.current;
          persistPausedRef.current = true;
          void savePlay(current).then(() => onCreateFormation(current));
        }}
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
          onChange(saved);
          setSaveOpen(false);
          persistPausedRef.current = true;
          void savePlay(saved).then(() => onSavedToGallery(saved.albumId, saved.id));
        }}
        onSaveAndNew={(input) => {
          const saved = commitSave(input);
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
      <SceneCutModal
        open={renameCut !== null}
        name={renameCut !== null ? sceneLabel(play.cuts[renameCut]?.name, renameCut) : ""}
        fromLabel={renameCut !== null ? sceneLabel(play.cuts[renameCut]?.name, renameCut) : ""}
        toLabel={
          renameCut !== null && renameCut < play.cuts.length - 1
            ? sceneLabel(play.cuts[renameCut + 1]?.name, renameCut + 1)
            : null
        }
        durationMs={renameCut !== null ? cutDurationMs(play.cuts[renameCut]) : 1000}
        suggestions={SCENE_NAME_CHIPS}
        onClose={() => setRenameCut(null)}
        onDuration={(ms) => {
          if (renameCut === null) return;
          setCutDuration(renameCut, ms);
        }}
        onSave={(name) => {
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
          className="w-full rounded-xl bg-accent py-3 font-semibold text-ink"
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
          타임라인을 재생한 화면을 저장합니다. 갤러리에서도 볼 수 있습니다.
          {play.cuts.length <= 1
            ? " 장면이 하나면 1초 동안 같은 모습이 저장됩니다."
            : ""}
        </p>
        <p className="mb-2 text-sm text-white/70">화면</p>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <ExportPick
            active={exportSource === "2d"}
            disabled={exportBusy}
            onClick={() => setExportSource("2d")}
          >
            2D
          </ExportPick>
          <ExportPick
            active={exportSource === "3d"}
            disabled={exportBusy}
            onClick={() => setExportSource("3d")}
          >
            3D
          </ExportPick>
        </div>
        <p className="mb-2 text-sm text-white/70">형식</p>
        <div className="mb-5 grid grid-cols-2 gap-2">
          <ExportPick
            active={exportKind === "gif"}
            disabled={exportBusy}
            onClick={() => setExportKind("gif")}
          >
            GIF
          </ExportPick>
          <ExportPick
            active={exportKind === "video"}
            disabled={exportBusy || !detectVideoFormat()}
            onClick={() => setExportKind("video")}
          >
            {detectVideoFormat()?.ext === "mp4" ? "MP4" : "영상"}
          </ExportPick>
        </div>
        {!detectVideoFormat() ? (
          <p className="mb-4 px-1 text-xs leading-relaxed text-white/45">
            이 브라우저에서는 MP4 저장을 지원하지 않습니다. GIF로 저장해 주세요.
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-xl py-3 text-sm text-white/80 ring-1 ring-line disabled:opacity-40"
            disabled={exportBusy}
            onClick={() => setExportOpen(false)}
          >
            닫기
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl bg-accent py-3 font-semibold text-ink disabled:opacity-40"
            disabled={exportBusy || (exportKind === "video" && !detectVideoFormat())}
            onClick={() => void exportTimeline()}
          >
            {exportBusy ? "만드는 중…" : "저장"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function ExportPick({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl py-3 text-sm font-medium ring-1 disabled:opacity-40 ${
        active ? "bg-accent text-ink ring-accent" : "bg-ink text-white/80 ring-line"
      }`}
    >
      {children}
    </button>
  );
}

function HistoryBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border disabled:opacity-30 ${
        disabled ? "border-white/15 text-white/35" : "border-white/20 text-white/85"
      }`}
    >
      {children}
    </button>
  );
}

function ToolBtn({
  children,
  onClick,
  active,
  disabled,
  className = "",
}: {
  children: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center justify-center rounded-md border px-1.5 py-1 text-center text-[9px] font-medium leading-tight whitespace-nowrap disabled:opacity-30 ${
        active
          ? "border-accent/70 bg-accent/15 text-accent"
          : "border-white/15 text-white/75"
      } ${className}`}
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
        active ? "bg-accent/20 text-accent" : "text-white/70"
      }`}
    >
      {children}
    </button>
  );
}
