import {
  BALL_YELLOW,
  TEAM_RED,
  type Album,
  type CourtObject,
  type CourtType,
  type FormationPreset,
  type LandingFan,
  type Play,
  type PlayerTeam,
  type RosterSize,
} from "../types/play";
import { uid } from "./id";

/** 하프: 우리 9m + 상대 3m = 12m. 풀: 18m. 폭은 항상 9m. */
export function courtMeters(court: CourtType): { width: number; length: number } {
  return { width: 9, length: court === "full" ? 18 : 12 };
}

export function netYNorm(court: CourtType): number {
  return 9 / courtMeters(court).length;
}

/** 상대 코트(네트 너머)의 중앙. y=0이 우리 엔드. */
export function opponentCourtCenter(court: CourtType): { x: number; y: number } {
  return { x: 0.5, y: (netYNorm(court) + 1) / 2 };
}

function defaultBallFan(court: CourtType, ball: { y: number }): LandingFan {
  const towardUs = ball.y > netYNorm(court);
  return {
    heading: towardUs ? Math.PI : 0,
    spread: (48 * Math.PI) / 180,
    depth: court === "half" ? 4.5 : 7,
  };
}

function player(
  x: number,
  y: number,
  label: string,
  color: string = TEAM_RED,
  team: PlayerTeam = "ours",
): CourtObject {
  const ours = team !== "opp";
  return {
    id: uid(),
    kind: "player",
    x,
    y,
    label,
    color,
    team,
    coverageOn: ours,
    coverageM: ours ? 2.5 : undefined,
  };
}

export function defaultObjects(rosterSize: RosterSize, court: CourtType): CourtObject[] {
  const netY = court === "full" ? 9 / 18 : 9 / 12;
  const back = netY * 0.22;
  const mid = netY * 0.55;
  const front = netY * 0.82;

  const six: CourtObject[] = [
    player(0.5, back + 0.02, "L"),
    player(0.2, back + 0.08, "OH"),
    player(0.8, back + 0.08, "OH"),
    player(0.32, mid, "MB"),
    player(0.68, mid, "OP"),
    player(0.78, front, "S"),
  ];

  if (rosterSize === 9) {
    six.push(
      player(0.5, mid * 0.85, "MB"),
      player(0.12, mid, "WS"),
      player(0.88, mid, "WS"),
    );
  }

  const ballAt = opponentCourtCenter(court);
  six.push({
    id: uid(),
    kind: "ball",
    x: ballAt.x,
    y: ballAt.y,
    label: "볼",
    color: BALL_YELLOW,
    fan: defaultBallFan(court, ballAt),
  });

  return six;
}

export function defaultPlayers(rosterSize: RosterSize, court: CourtType): CourtObject[] {
  return defaultObjects(rosterSize, court).filter((o) => o.kind === "player");
}

export function syncRosterPlayers(
  objects: CourtObject[],
  rosterSize: RosterSize,
  court: CourtType,
): CourtObject[] {
  const players = objects.filter((o) => o.kind === "player");
  const slots = defaultPlayers(rosterSize, court);
  if (players.length >= rosterSize) return players.slice(0, rosterSize);
  return [...players, ...slots.slice(players.length).map((p) => ({ ...p, id: uid() }))];
}

export function alignToDefault(
  objects: CourtObject[],
  rosterSize: RosterSize,
  court: CourtType,
): CourtObject[] {
  const fresh = defaultObjects(rosterSize, court);
  const slots = fresh.filter((o) => o.kind === "player");
  const ball = fresh.find((o) => o.kind === "ball");
  let i = 0;
  return objects.map((o) => {
    if (o.kind === "ball" && ball) return { ...o, x: ball.x, y: ball.y };
    if (o.kind === "player") {
      const slot = slots[i++];
      if (!slot) return o;
      return { ...o, x: slot.x, y: slot.y, label: slot.label };
    }
    return o;
  });
}

export function createPlay(input: {
  title: string;
  court: CourtType;
  rosterSize: RosterSize;
  albumId: string;
}): Play {
  const now = Date.now();
  return {
    id: uid(),
    albumId: input.albumId,
    title: input.title.trim() || "새 전술",
    court: input.court,
    rosterSize: input.rosterSize,
    createdAt: now,
    updatedAt: now,
    cuts: [
      {
        id: uid(),
        name: "장면 1",
        durationMs: 1000,
        objects: defaultObjects(input.rosterSize, input.court),
        strokes: [],
      },
    ],
  };
}

export function createAlbum(title: string): Album {
  const now = Date.now();
  return {
    id: uid(),
    title: title.trim() || "새 전술 프로젝트",
    createdAt: now,
    updatedAt: now,
  };
}

export function createPreset(input?: {
  title?: string;
  court?: CourtType;
  rosterSize?: RosterSize;
}): FormationPreset {
  const court = input?.court ?? "half";
  const rosterSize = input?.rosterSize ?? 6;
  const now = Date.now();
  return {
    id: uid(),
    title: input?.title?.trim() || "새 대형",
    court,
    rosterSize,
    objects: defaultPlayers(rosterSize, court),
    createdAt: now,
    updatedAt: now,
  };
}

export function duplicatePlay(play: Play, title?: string): Play {
  const now = Date.now();
  return {
    ...play,
    id: uid(),
    title: title?.trim() || `${play.title} 사본`,
    createdAt: now,
    updatedAt: now,
    cuts: play.cuts.map((c) => ({
      ...c,
      id: uid(),
      objects: c.objects.map((o) => ({ ...o })),
      strokes: c.strokes.map((s) => ({
        ...s,
        id: uid(),
        points: s.points.map((p) => ({ ...p })),
      })),
    })),
  };
}

export const SCENE_NAME_CHIPS = [
  "서브",
  "A속공",
  "B속공",
  "백어택",
  "리시브",
  "블로킹",
  "찬스볼",
] as const;

const SCENE_NAME_RE = /^(?:Cut|장면)\s+(\d+)$/i;

/** 예전 Cut N 이름을 장면 N으로 보여 준다. 직접 지은 이름은 그대로. */
export function sceneLabel(name: string | undefined, index = 0): string {
  const raw = name?.trim();
  if (!raw) return `장면 ${index + 1}`;
  const match = SCENE_NAME_RE.exec(raw);
  if (match) return `장면 ${match[1]}`;
  return raw;
}

export function nextCutName(cuts: { name: string }[]): string {
  let max = cuts.length;
  for (const cut of cuts) {
    const match = SCENE_NAME_RE.exec(cut.name.trim());
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `장면 ${max + 1}`;
}

function remapY(y: number, from: CourtType, to: CourtType): number {
  if (from === to) return y;
  const fromL = courtMeters(from).length;
  const toL = courtMeters(to).length;
  return Math.min(1, Math.max(0, (y * fromL) / toL));
}

/** 코트 길이가 바뀌어도 실제 미터 위치를 유지한다. */
export function remapPlayToCourt(play: Play, court: CourtType): Play {
  if (play.court === court) return play;
  const from = play.court;
  const mapY = (y: number) => remapY(y, from, court);
  return {
    ...play,
    court,
    updatedAt: Date.now(),
    cuts: play.cuts.map((cut) => ({
      ...cut,
      objects: cut.objects.map((o) => ({ ...o, y: mapY(o.y) })),
      strokes: cut.strokes.map((s) => ({
        ...s,
        points: s.points.map((p) => ({ ...p, y: mapY(p.y) })),
      })),
    })),
  };
}
