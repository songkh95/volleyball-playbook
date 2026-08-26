import { TEAM_BLUE, TEAM_RED, type CourtObject, type CourtType } from "../types/play";
import { netYNorm } from "./defaultPlay";
import { uid } from "./id";

export function newPlayer(court: CourtType): CourtObject {
  const net = netYNorm(court);
  return {
    id: uid(),
    kind: "player",
    x: 0.5,
    y: net * 0.2,
    label: "P",
    color: TEAM_RED,
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
): { objects: CourtObject[]; extras: CourtObject[] } {
  const pPlayers = presetObjs.filter((o) => o.kind === "player");
  const pBall = presetObjs.find((o) => o.kind === "ball");
  const cPlayers = current.filter((o) => o.kind === "player");
  const markers = current.filter((o) => o.kind === "cone" || o.kind === "text");
  const extras: CourtObject[] = [];
  const mapped = cPlayers.map((p, i) => {
    const s = pPlayers[i];
    return s ? { ...p, x: s.x, y: s.y, label: s.label, color: s.color } : p;
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
