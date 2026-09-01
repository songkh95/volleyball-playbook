import { BALL_YELLOW, type CourtObject, type CourtType, type FormationPreset } from "../types/play";
import { netYNorm } from "./defaultPlay";
import { uid } from "./id";
import { newPlayer } from "./presets";

export const BUILTIN_PRESET_ORDER = [
  "builtin-5-1",
  "builtin-5-1-r2",
  "builtin-5-1-r3",
  "builtin-5-1-r4",
  "builtin-5-1-r5",
  "builtin-5-1-r6",
  "builtin-6-2",
  "builtin-receive-w",
  "builtin-serve-1",
  "builtin-serve-c",
  "builtin-serve-5",
  "builtin-overlap",
  "builtin-pipe",
  "builtin-quick",
  "builtin-tandem",
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

function ballAt(x: number, y: number): CourtObject {
  return {
    id: uid(),
    kind: "ball",
    x,
    y,
    label: "볼",
    color: BALL_YELLOW,
  };
}

function preset(id: string, title: string, objects: CourtObject[]): FormationPreset {
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

type Role = { label: string; libero?: boolean };

/** R1: P1 S, P2 OP, P3 MB, P4 OH, P5 OH, P6 L */
const FIVE_ONE: Role[] = [
  { label: "S" },
  { label: "OP" },
  { label: "MB" },
  { label: "OH" },
  { label: "OH" },
  { label: "L", libero: true },
];

const SIX_TWO: Role[] = [
  { label: "S" },
  { label: "OP" },
  { label: "MB" },
  { label: "OH" },
  { label: "OH" },
  { label: "S" },
];

function rotateRoles(roles: Role[], steps: number): Role[] {
  const n = roles.length;
  const k = ((steps % n) + n) % n;
  return roles.map((_, i) => roles[(i + k) % n]);
}

function placeByPos(court: CourtType, roles: Role[]): CourtObject[] {
  const s = slots(court);
  const at: Record<number, { x: number; y: number }> = {
    1: { x: s.right, y: s.back },
    2: { x: s.right, y: s.front },
    3: { x: s.cx, y: s.front },
    4: { x: s.left, y: s.front },
    5: { x: s.left, y: s.back },
    6: { x: s.cx, y: s.back },
  };
  const front = new Set([2, 3, 4]);
  const placed = roles.map((role, i) => ({ pos: i + 1, role }));
  const libero = placed.find((p) => p.role.libero);
  if (libero && front.has(libero.pos)) {
    const backMb = placed.find((p) => !front.has(p.pos) && p.role.label === "MB")
      ?? placed.find((p) => !front.has(p.pos) && p.role.label !== "L");
    if (backMb) {
      const swap = libero.role;
      libero.role = backMb.role;
      backMb.role = swap;
    }
  }
  return placed.map((p) => ours(court, at[p.pos].x, at[p.pos].y, p.role.label));
}

function formation51(court: CourtType, rotation = 1): CourtObject[] {
  return placeByPos(court, rotateRoles(FIVE_ONE, rotation - 1));
}

function formation62(court: CourtType): CourtObject[] {
  return placeByPos(court, SIX_TWO);
}

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

function formationOverlap(court: CourtType): CourtObject[] {
  const s = slots(court);
  return [
    ours(court, s.left + 0.08, s.front, "OH"),
    ours(court, s.cx - 0.08, s.front, "MB"),
    ours(court, s.right, s.front * 0.92, "S"),
    ours(court, s.left + 0.16, s.mid, "OH"),
    ours(court, s.cx, s.back, "L"),
    ours(court, s.right - 0.1, s.mid, "OP"),
    ballAt(s.right - 0.02, s.front * 0.78),
  ];
}

function formationPipe(court: CourtType): CourtObject[] {
  const s = slots(court);
  return [
    ours(court, s.left, s.front, "OH"),
    ours(court, s.cx, s.front, "MB"),
    ours(court, s.right, s.front, "OP"),
    ours(court, s.left, s.back, "OH"),
    ours(court, s.cx, s.mid, "파이프"),
    ours(court, s.right, s.back, "S"),
    ballAt(s.cx + 0.04, s.front * 0.7),
  ];
}

function formationQuick(court: CourtType): CourtObject[] {
  const s = slots(court);
  return [
    ours(court, s.left, s.front, "OH"),
    ours(court, s.cx, s.front, "MB"),
    ours(court, s.right, s.front, "OP"),
    ours(court, s.left, s.back, "OH"),
    ours(court, s.cx, s.back, "L"),
    ours(court, s.cx + 0.1, s.front * 0.72, "S"),
    ballAt(s.cx + 0.04, s.front * 0.88),
  ];
}

function formationTandem(court: CourtType): CourtObject[] {
  const s = slots(court);
  return [
    ours(court, s.left, s.front, "OH"),
    ours(court, s.cx - 0.06, s.front, "MB"),
    ours(court, s.cx + 0.08, s.front * 0.7, "OP"),
    ours(court, s.left, s.back, "OH"),
    ours(court, s.cx, s.back, "L"),
    ours(court, s.right, s.mid, "S"),
    ballAt(s.cx, s.front * 0.82),
  ];
}

export function builtinFormations(): FormationPreset[] {
  const court: CourtType = "half";
  const s = slots(court);
  return [
    preset("builtin-5-1", "5-1 R1", formation51(court, 1)),
    preset("builtin-5-1-r2", "5-1 R2", formation51(court, 2)),
    preset("builtin-5-1-r3", "5-1 R3", formation51(court, 3)),
    preset("builtin-5-1-r4", "5-1 R4", formation51(court, 4)),
    preset("builtin-5-1-r5", "5-1 R5", formation51(court, 5)),
    preset("builtin-5-1-r6", "5-1 R6", formation51(court, 6)),
    preset("builtin-6-2", "6-2 기본", formation62(court)),
    preset("builtin-receive-w", "리시브 W", formationReceiveW(court)),
    preset("builtin-serve-1", "서브 1번", formationServe(court, s.right)),
    preset("builtin-serve-c", "서브 중앙", formationServe(court, s.cx)),
    preset("builtin-serve-5", "서브 5번", formationServe(court, s.left)),
    preset("builtin-overlap", "오버랩", formationOverlap(court)),
    preset("builtin-pipe", "파이프", formationPipe(court)),
    preset("builtin-quick", "퀵", formationQuick(court)),
    preset("builtin-tandem", "텐덤", formationTandem(court)),
  ];
}
