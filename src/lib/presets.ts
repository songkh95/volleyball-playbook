import { TEAM_RED, type CourtObject, type CourtType } from "../types/play";
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

export function applyUserPreset(
  current: CourtObject[],
  presetObjs: CourtObject[],
): { objects: CourtObject[]; extras: CourtObject[] } {
  const pPlayers = presetObjs.filter((o) => o.kind === "player");
  const pBall = presetObjs.find((o) => o.kind === "ball");
  const cPlayers = current.filter((o) => o.kind === "player");
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
    objects: [...mapped, ...extras, ...(nextBall ? [nextBall] : [])],
    extras,
  };
}
