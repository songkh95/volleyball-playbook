import { TEAM_BLUE_LEGACY } from "../design/tokens";
import { TEAM_BLUE, TEAM_RED, type CourtObject, type CourtType, type PlayerTeam } from "../types/play";
import { netYNorm, remapObjectsToCourt } from "./defaultPlay";
import { uid } from "./id";

export function spawnPointForTeam(
  court: CourtType,
  team: PlayerTeam,
  existing: CourtObject[],
): { x: number; y: number } {
  const net = netYNorm(court);
  const y = team === "opp" ? (net + 1) / 2 : net * 0.42;
  const occupied = existing.filter((o) => o.kind === "player");
  for (let n = 0; n < 11; n++) {
    const offset = Math.ceil(n / 2) * 0.1;
    const x = Math.min(0.86, Math.max(0.14, 0.5 + (n % 2 === 0 ? offset : -offset)));
    if (!occupied.some((o) => Math.hypot(o.x - x, o.y - y) < 0.07)) return { x, y };
  }
  return { x: 0.5, y };
}

export function newPlayer(
  court: CourtType,
  opts?: {
    label?: string;
    color?: string;
    team?: PlayerTeam;
    coverageOn?: boolean;
    coverageM?: number;
    x?: number;
    y?: number;
  },
): CourtObject {
  const colorHint = opts?.color?.toLowerCase() ?? "";
  const team: PlayerTeam =
    opts?.team ??
    (colorHint === TEAM_BLUE.toLowerCase() || colorHint === TEAM_BLUE_LEGACY.toLowerCase()
      ? "opp"
      : "ours");
  const ours = team !== "opp";
  const color = opts?.color ?? (ours ? TEAM_RED : TEAM_BLUE);
  const coverageOn = opts?.coverageOn ?? ours;
  const spawn = spawnPointForTeam(court, team, []);
  return {
    id: uid(),
    kind: "player",
    x: opts?.x ?? spawn.x,
    y: opts?.y ?? spawn.y,
    label: opts?.label ?? "P",
    color,
    team,
    coverageOn,
    coverageM: coverageOn ? (opts?.coverageM ?? 2.5) : undefined,
  };
}

export function newCone(court: CourtType): CourtObject {
  const net = netYNorm(court);
  return {
    id: uid(),
    kind: "cone",
    x: 0.22,
    y: net * 0.18,
    label: "",
    color: TEAM_BLUE,
  };
}

export function newText(court: CourtType): CourtObject {
  const net = netYNorm(court);
  return {
    id: uid(),
    kind: "text",
    x: 0.78,
    y: net * 0.18,
    label: "텍스트",
    color: "#ffffff",
    fontSize: 18,
    bold: false,
    italic: false,
  };
}

export function applyUserPreset(
  current: CourtObject[],
  presetObjs: CourtObject[],
  fromCourt: CourtType,
  toCourt: CourtType,
): { objects: CourtObject[]; extras: CourtObject[] } {
  const source = remapObjectsToCourt(presetObjs, fromCourt, toCourt);
  const pPlayers = source.filter((o) => o.kind === "player");
  const pBall = source.find((o) => o.kind === "ball");
  const cPlayers = current.filter((o) => o.kind === "player");
  const markers = current.filter((o) => o.kind === "cone" || o.kind === "text");
  const extras: CourtObject[] = [];
  const mapped = cPlayers.map((p, i) => {
    const s = pPlayers[i];
    return s ? { ...p, x: s.x, y: s.y, label: s.label, color: s.color, team: s.team } : p;
  });
  for (let i = cPlayers.length; i < pPlayers.length; i++) {
    extras.push({ ...pPlayers[i], id: uid() });
  }
  const ball = current.find((o) => o.kind === "ball");
  const nextBall = ball && pBall ? { ...ball, x: pBall.x, y: pBall.y } : ball;
  return {
    objects: [...mapped, ...extras, ...markers, ...(nextBall ? [nextBall] : [])],
    extras,
  };
}
