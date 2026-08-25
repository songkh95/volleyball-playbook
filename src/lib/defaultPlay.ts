import {
  BALL_YELLOW,
  TEAM_RED,
  type Album,
  type CourtObject,
  type CourtType,
  type FormationPreset,
  type Play,
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

function player(
  x: number,
  y: number,
  label: string,
  color: string = TEAM_RED,
): CourtObject {
  return { id: uid(), kind: "player", x, y, label, color };
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

  six.push({
    id: uid(),
    kind: "ball",
    x: 0.5,
    y: back + 0.16,
    label: "볼",
    color: BALL_YELLOW,
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
        name: "Cut 1",
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

export function nextCutName(cuts: { name: string }[]): string {
  return `Cut ${cuts.length + 1}`;
}
