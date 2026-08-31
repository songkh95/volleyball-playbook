import type { CourtObject, CourtType, FormationPreset } from "../types/play";
import { netYNorm } from "./defaultPlay";
import { newPlayer } from "./presets";

export const BUILTIN_PRESET_ORDER = [
  "builtin-5-1",
  "builtin-6-2",
  "builtin-receive-w",
  "builtin-serve-1",
  "builtin-serve-c",
  "builtin-serve-5",
] as const;

export function isBuiltinPreset(preset: { id: string; builtin?: boolean }) {
  return preset.builtin === true || preset.id.startsWith("builtin-");
}

type Slots = {
  net: number;
  back: number;
  mid: number;
  front: number;
  left: number;
  cx: number;
  right: number;
  serve: number;
  oppServe: number;
};

function slots(court: CourtType): Slots {
  const net = netYNorm(court);
  return {
    net,
    back: net * 0.28,
    mid: net * 0.52,
    front: net * 0.84,
    left: 0.18,
    cx: 0.5,
    right: 0.82,
    serve: 0.06,
    oppServe: 0.92,
  };
}

function ours(court: CourtType, x: number, y: number, label: string): CourtObject {
  return newPlayer(court, { x, y, label, team: "ours" });
}

function opp(court: CourtType, x: number, y: number, label: string): CourtObject {
  return newPlayer(court, { x, y, label, team: "opp" });
}

function preset(
  id: (typeof BUILTIN_PRESET_ORDER)[number],
  title: string,
  objects: CourtObject[],
): FormationPreset {
  return {
    id,
    title,
    court: "half",
    rosterSize: 6,
    objects,
    builtin: true,
    createdAt: 1,
    updatedAt: 1,
  };
}

/** 5-1 로테이션 1. 세터 1번, 전위 OH-MB-OP. */
function formation51(court: CourtType): CourtObject[] {
  const s = slots(court);
  return [
    ours(court, s.left, s.front, "OH"),
    ours(court, s.cx, s.front, "MB"),
    ours(court, s.right, s.front, "OP"),
    ours(court, s.left, s.back, "OH"),
    ours(court, s.cx, s.back, "L"),
    ours(court, s.right, s.back, "S"),
  ];
}

/** 6-2 로테이션 1. 세터 두 명(후위 세터 + 전위 세터). */
function formation62(court: CourtType): CourtObject[] {
  const s = slots(court);
  return [
    ours(court, s.left, s.front, "OH"),
    ours(court, s.cx, s.front, "MB"),
    ours(court, s.right, s.front, "S"),
    ours(court, s.left, s.back, "OH"),
    ours(court, s.cx, s.back, "L"),
    ours(court, s.right, s.back, "S"),
  ];
}

/** 5인 리시브 W + 네트 세터. 상대 서버는 엔드라인. */
function formationReceiveW(court: CourtType): CourtObject[] {
  const s = slots(court);
  return [
    ours(court, s.right, s.front, "S"),
    ours(court, s.left, s.mid, "OH"),
    ours(court, s.right, s.mid, "OP"),
    ours(court, s.left, s.back, "OH"),
    ours(court, s.cx, s.back * 0.85, "L"),
    ours(court, s.right, s.back, "MB"),
    opp(court, s.cx, s.oppServe, "서브"),
  ];
}

function formationServe(court: CourtType, x: number): CourtObject[] {
  const s = slots(court);
  return [
    ours(court, s.left, s.front, "OH"),
    ours(court, s.cx, s.front, "MB"),
    ours(court, s.right, s.front, "OP"),
    ours(court, s.left, s.back, "OH"),
    ours(court, s.cx, s.back, "L"),
    ours(court, x, s.serve, "서브"),
  ];
}

export function builtinFormations(): FormationPreset[] {
  const court: CourtType = "half";
  const s = slots(court);
  return [
    preset("builtin-5-1", "5-1 기본", formation51(court)),
    preset("builtin-6-2", "6-2 기본", formation62(court)),
    preset("builtin-receive-w", "리시브 W", formationReceiveW(court)),
    preset("builtin-serve-1", "서브 1번", formationServe(court, s.right)),
    preset("builtin-serve-c", "서브 중앙", formationServe(court, s.cx)),
    preset("builtin-serve-5", "서브 5번", formationServe(court, s.left)),
  ];
}
