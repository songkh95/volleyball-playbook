import type { RosterSize } from "../types/play";
import type {
  CourtPos,
  LiveMatch,
  MatchEvent,
  MatchEventType,
  MatchPlayer,
  MatchSettings,
  MatchTeamId,
  SharedRoster,
  SharedRosterRow,
  TeamState,
} from "../types/match";
import { uid } from "./id";

export const COURT_POS: CourtPos[] = [1, 2, 3, 4, 5, 6];
export const COURT_POS_9: CourtPos[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const FRONT_POS: CourtPos[] = [2, 3, 4];
export const BACK_POS: CourtPos[] = [1, 5, 6];
export const SUBS_PER_SET = 6;
export const TIMEOUTS_PER_SET = 2;
export const TIMEOUT_SECONDS = 30;
export const CURRENT_MATCH_ID = "live-current";
export const SHARED_ROSTER_ID = "shared-roster";

export const DEFAULT_MATCH_SETTINGS: MatchSettings = {
  timeoutSeconds: TIMEOUT_SECONDS,
  timeoutsPerSet: TIMEOUTS_PER_SET,
  subsPerSet: SUBS_PER_SET,
  rosterSize: 6,
};

export function matchRosterSize(match: LiveMatch): RosterSize {
  return matchSettingsOf(match).rosterSize === 9 ? 9 : 6;
}

export function positionsOf(match: LiveMatch): CourtPos[] {
  return matchRosterSize(match) === 9 ? COURT_POS_9 : COURT_POS;
}

export function matchSettingsOf(match: LiveMatch): MatchSettings {
  return { ...DEFAULT_MATCH_SETTINGS, ...match.settings };
}

export type MatchResult = { ok: true; match: LiveMatch } | { ok: false; error: string };

export function otherTeam(team: MatchTeamId): MatchTeamId {
  return team === "ours" ? "opp" : "ours";
}

export function teamOf(match: LiveMatch, team: MatchTeamId): TeamState {
  return match[team];
}

export function playerById(team: TeamState, id: string): MatchPlayer | undefined {
  return team.players.find((p) => p.id === id);
}

export function benchPlayers(team: TeamState): MatchPlayer[] {
  const on = new Set(Object.values(team.court));
  return team.players.filter((p) => !on.has(p.id));
}

export function posOf(team: TeamState, playerId: string): CourtPos | null {
  for (const pos of COURT_POS_9) {
    if (team.court[pos] === playerId) return pos;
  }
  return null;
}

/** 칸에 있던 선수가 사이드아웃 후 가는 자리. 1→6→5→4→3→2→1 / 9인은 1→9→… */
export function moveFrom(pos: CourtPos, size: RosterSize = 6): CourtPos {
  if (size === 9) {
    const next: Record<CourtPos, CourtPos> = {
      1: 9,
      2: 1,
      3: 2,
      4: 3,
      5: 4,
      6: 5,
      7: 6,
      8: 7,
      9: 8,
    };
    return next[pos];
  }
  const six: Record<1 | 2 | 3 | 4 | 5 | 6, CourtPos> = {
    1: 6,
    6: 5,
    5: 4,
    4: 3,
    3: 2,
    2: 1,
  };
  if (pos === 7 || pos === 8 || pos === 9) return pos;
  return six[pos];
}

export function rotateLineup(court: Record<CourtPos, string>): Record<CourtPos, string> {
  if (court[7] && court[8] && court[9]) {
    return {
      1: court[2],
      2: court[3],
      3: court[4],
      4: court[5],
      5: court[6],
      6: court[7],
      7: court[8],
      8: court[9],
      9: court[1],
    };
  }
  return {
    1: court[2],
    2: court[3],
    3: court[4],
    4: court[5],
    5: court[6],
    6: court[1],
  } as Record<CourtPos, string>;
}

export function setPointTarget(setNo: number): number {
  return setNo >= 5 ? 15 : 25;
}

export function setWon(ours: number, opp: number, setNo: number): MatchTeamId | null {
  const need = setPointTarget(setNo);
  if (ours >= need && ours - opp >= 2) return "ours";
  if (opp >= need && opp - ours >= 2) return "opp";
  return null;
}

export function serveForSet(firstServe: MatchTeamId, setNo: number): MatchTeamId {
  return setNo % 2 === 1 ? firstServe : otherTeam(firstServe);
}

function stamp(match: LiveMatch): LiveMatch {
  return { ...match, updatedAt: Date.now() };
}

function log(
  match: LiveMatch,
  type: MatchEventType,
  message: string,
  team?: MatchTeamId,
): LiveMatch {
  const event: MatchEvent = {
    id: uid(),
    at: Date.now(),
    type,
    team,
    message,
    rally: { ...match.rally },
  };
  return { ...match, log: [event, ...match.log] };
}

function freeze(match: LiveMatch): LiveMatch {
  return structuredClone({ ...match, scoreUndo: [], scoreRedo: [] });
}

export function createLiveMatch(settings?: MatchSettings): LiveMatch {
  const now = Date.now();
  const resolved = { ...DEFAULT_MATCH_SETTINGS, ...settings };
  return {
    id: CURRENT_MATCH_ID,
    createdAt: now,
    updatedAt: now,
    status: "warmup",
    serving: null,
    firstServe: null,
    setNo: 1,
    sets: { ours: 0, opp: 0 },
    rally: { ours: 0, opp: 0 },
    ours: defaultTeam("우리", "ours", resolved.timeoutsPerSet, resolved.rosterSize),
    opp: defaultTeam("상대", "opp", resolved.timeoutsPerSet, resolved.rosterSize),
    log: [],
    scoreUndo: [],
    scoreRedo: [],
    settings: resolved,
    timeout: null,
  };
}

function defaultTeam(
  name: string,
  side: MatchTeamId,
  timeoutsPerSet: number,
  rosterSize: RosterSize = 6,
): TeamState {
  const prefix = side;
  const six: { pos: CourtPos; number: string; label: string; libero?: boolean }[] = [
    { pos: 1, number: side === "ours" ? "1" : "11", label: "S" },
    { pos: 2, number: side === "ours" ? "2" : "12", label: "OP" },
    { pos: 3, number: side === "ours" ? "3" : "13", label: "MB" },
    { pos: 4, number: side === "ours" ? "4" : "14", label: "OH" },
    { pos: 5, number: side === "ours" ? "5" : "15", label: "OH" },
    { pos: 6, number: side === "ours" ? "6" : "16", label: "L", libero: true },
  ];
  const nine: { pos: CourtPos; number: string; label: string; libero?: boolean }[] = [
    { pos: 1, number: side === "ours" ? "1" : "11", label: "OH" },
    { pos: 2, number: side === "ours" ? "2" : "12", label: "OH" },
    { pos: 3, number: side === "ours" ? "3" : "13", label: "MB" },
    { pos: 4, number: side === "ours" ? "4" : "14", label: "OH" },
    { pos: 5, number: side === "ours" ? "5" : "15", label: "WS" },
    { pos: 6, number: side === "ours" ? "6" : "16", label: "S" },
    { pos: 7, number: side === "ours" ? "7" : "17", label: "WS" },
    { pos: 8, number: side === "ours" ? "8" : "18", label: "MB" },
    { pos: 9, number: side === "ours" ? "9" : "19", label: "OP" },
  ];
  const rows = rosterSize === 9 ? nine : six;
  const players: MatchPlayer[] = rows.map((row) => ({
    id: `${prefix}-${row.pos}`,
    number: row.number,
    label: row.label,
    isLibero: Boolean(row.libero),
  }));
  const libero = players.find((p) => p.isLibero) ?? null;
  const court = {} as Record<CourtPos, string>;
  for (const row of rows) {
    court[row.pos] = `${prefix}-${row.pos}`;
  }
  return {
    name,
    timeoutLeft: timeoutsPerSet,
    subsUsed: 0,
    players,
    court,
    liberoId: libero?.id ?? null,
    liberoPos: libero ? 6 : null,
    replacedId: null,
    subLinks: [],
  };
}

export function startServe(match: LiveMatch, team: MatchTeamId): MatchResult {
  if (match.status !== "warmup") return { ok: false, error: "이미 경기가 시작됐습니다." };
  let next: LiveMatch = {
    ...match,
    status: "live",
    serving: team,
    firstServe: team,
  };
  next = log(next, "SERVE", `${teamName(next, team)} 서브로 시작합니다.`, team);
  return { ok: true, match: stamp(next) };
}

export function applyScore(match: LiveMatch, team: MatchTeamId): MatchResult {
  if (match.timeout && match.timeout.endsAt > Date.now()) {
    return { ok: false, error: "타임아웃이 끝날 때까지 기다리세요." };
  }
  if (match.status === "warmup") {
    const started = startServe(match, team);
    if (!started.ok) return started;
    match = started.match;
  }
  if (match.status !== "live" || !match.serving) {
    return { ok: false, error: "먼저 득점으로 경기를 시작하세요." };
  }
  const undo = [freeze(match), ...match.scoreUndo].slice(0, 40);
  const sideOut = match.serving !== team;
  let next: LiveMatch = {
    ...match,
    scoreUndo: undo,
    scoreRedo: [],
    rally: {
      ours: match.rally.ours + (team === "ours" ? 1 : 0),
      opp: match.rally.opp + (team === "opp" ? 1 : 0),
    },
  };
  next = log(
    next,
    "SCORE",
    `${teamName(next, team)} 득점 ${next.rally.ours}-${next.rally.opp}${sideOut ? " · 사이드아웃" : ""}`,
    team,
  );

  if (sideOut) {
    next = { ...next, serving: team };
    next = log(next, "SIDE_OUT", `${teamName(next, team)} 서브권`, team);
    const rotated = rotateTeam(next[team]);
    next = { ...next, [team]: rotated.team };
    next = log(next, "ROTATION", `${teamName(next, team)} 로테이션`, team);
    if (rotated.liberoNote) {
      next = log(next, "LIBERO", rotated.liberoNote, team);
    }
  }

  const winner = setWon(next.rally.ours, next.rally.opp, next.setNo);
  if (winner) {
    const sets = {
      ours: next.sets.ours + (winner === "ours" ? 1 : 0),
      opp: next.sets.opp + (winner === "opp" ? 1 : 0),
    };
    const finished = sets.ours >= 3 || sets.opp >= 3;
    next = {
      ...next,
      sets,
      status: finished ? "finished" : "set-break",
      serving: null,
    };
    next = log(
      next,
      "SET",
      finished
        ? `${teamName(next, winner)} ${sets.ours}-${sets.opp} 경기 종료`
        : `${teamName(next, winner)} ${next.setNo}세트 종료 ${sets.ours}-${sets.opp}`,
      winner,
    );
  }

  return { ok: true, match: stamp(next) };
}

export function undoScore(match: LiveMatch): MatchResult {
  const prev = match.scoreUndo[0];
  if (!prev) return { ok: false, error: "되돌릴 득점이 없습니다." };
  return {
    ok: true,
    match: stamp({
      ...prev,
      scoreUndo: match.scoreUndo.slice(1),
      scoreRedo: [freeze(match), ...(match.scoreRedo ?? [])].slice(0, 40),
    }),
  };
}

export function redoScore(match: LiveMatch): MatchResult {
  const next = (match.scoreRedo ?? [])[0];
  if (!next) return { ok: false, error: "다시 할 득점이 없습니다." };
  return {
    ok: true,
    match: stamp({
      ...next,
      scoreUndo: [freeze(match), ...match.scoreUndo].slice(0, 40),
      scoreRedo: match.scoreRedo.slice(1),
    }),
  };
}

function rotateTeam(team: TeamState): { team: TeamState; liberoNote: string | null } {
  const size: RosterSize = team.court[7] && team.court[8] && team.court[9] ? 9 : 6;
  const court = rotateLineup(team.court);
  let liberoPos = team.liberoPos;
  let replacedId = team.replacedId;
  let liberoNote: string | null = null;
  if (liberoPos !== null) {
    liberoPos = moveFrom(liberoPos, size);
    if (FRONT_POS.includes(liberoPos) && replacedId && team.liberoId) {
      const liberoId = team.liberoId;
      court[liberoPos] = replacedId;
      liberoNote = `리베로 OUT · ${labelOf(team, liberoId)} → ${labelOf(team, replacedId)}`;
      liberoPos = null;
      replacedId = null;
    }
  }
  return { team: { ...team, court, liberoPos, replacedId }, liberoNote };
}

export function applyTimeout(match: LiveMatch, team: MatchTeamId): MatchResult {
  if (match.timeout && match.timeout.endsAt > Date.now()) {
    return { ok: false, error: "이미 타임아웃 중입니다." };
  }
  if (match.status !== "live") return { ok: false, error: "경기 중에만 타임아웃을 쓸 수 있습니다." };
  const settings = matchSettingsOf(match);
  const side = match[team];
  if (side.timeoutLeft <= 0) return { ok: false, error: "이 세트 타임아웃을 모두 썼습니다." };
  const used = settings.timeoutsPerSet - side.timeoutLeft + 1;
  let next: LiveMatch = {
    ...match,
    [team]: { ...side, timeoutLeft: side.timeoutLeft - 1 },
    timeout: { team, endsAt: Date.now() + settings.timeoutSeconds * 1000 },
  };
  next = log(
    next,
    "TIMEOUT",
    `${teamName(next, team)} 타임아웃 ${used}/${settings.timeoutsPerSet} (${settings.timeoutSeconds}초)`,
    team,
  );
  return { ok: true, match: stamp(next) };
}

export function applySub(
  match: LiveMatch,
  team: MatchTeamId,
  outId: string,
  inId: string,
): MatchResult {
  if (match.timeout && match.timeout.endsAt > Date.now()) {
    return { ok: false, error: "타임아웃이 끝날 때까지 기다리세요." };
  }
  if (match.status !== "live") return { ok: false, error: "경기 중에만 교체할 수 있습니다." };
  const side = match[team];
  const outP = playerById(side, outId);
  const inP = playerById(side, inId);
  if (!outP || !inP) return { ok: false, error: "선수를 찾을 수 없습니다." };
  if (outP.isLibero || inP.isLibero) {
    return { ok: false, error: "리베로는 리베로 교체를 쓰세요." };
  }
  const outPos = posOf(side, outId);
  if (outPos === null) return { ok: false, error: "나간 선수는 코트에 있어야 합니다." };
  if (posOf(side, inId) !== null) return { ok: false, error: "들어온 선수는 벤치에 있어야 합니다." };
  const subLimit = matchSettingsOf(match).subsPerSet;
  if (side.subsUsed >= subLimit) {
    return { ok: false, error: `이 세트 일반 교체 ${subLimit}회를 모두 썼습니다.` };
  }

  const link = side.subLinks.find((l) => l.a === outId || l.b === outId || l.a === inId || l.b === inId);
  if (link) {
    const pair = new Set([link.a, link.b]);
    if (!pair.has(outId) || !pair.has(inId)) {
      return { ok: false, error: "이 선수는 자기 교체 짝하고만 다시 들어갈 수 있습니다." };
    }
  }

  const court = { ...side.court, [outPos]: inId };
  const subLinks = link ? side.subLinks : [...side.subLinks, { a: outId, b: inId }];
  let next: LiveMatch = {
    ...match,
    [team]: { ...side, court, subLinks, subsUsed: side.subsUsed + 1 },
  };
  next = log(
    next,
    "SUB",
    `${teamName(next, team)} 교체 ${inP.number}번 IN / ${outP.number}번 OUT (${next[team].subsUsed}/${subLimit})`,
    team,
  );
  return { ok: true, match: stamp(next) };
}

export function applyLibero(
  match: LiveMatch,
  team: MatchTeamId,
  courtId: string,
  benchId: string,
): MatchResult {
  if (matchRosterSize(match) === 9) return { ok: false, error: "9인제에는 리베로가 없습니다." };
  if (match.status !== "live") return { ok: false, error: "경기 중에만 교체할 수 있습니다." };
  const side = match[team];
  const courtP = playerById(side, courtId);
  const benchP = playerById(side, benchId);
  if (!courtP || !benchP) return { ok: false, error: "선수를 찾을 수 없습니다." };
  const courtPos = posOf(side, courtId);
  if (courtPos === null) return { ok: false, error: "코트 선수를 먼저 고르세요." };
  if (posOf(side, benchId) !== null) return { ok: false, error: "벤치 선수를 고르세요." };

  const liberoIn = benchP.isLibero && !courtP.isLibero;
  const liberoOut = courtP.isLibero && !benchP.isLibero;

  if (liberoIn) {
    if (!BACK_POS.includes(courtPos)) {
      return { ok: false, error: "리베로는 후위(1·5·6번)에만 들어갈 수 있습니다." };
    }
    if (side.liberoPos !== null) {
      return { ok: false, error: "리베로가 이미 코트에 있습니다." };
    }
    const court = { ...side.court, [courtPos]: benchId };
    let next: LiveMatch = {
      ...match,
      [team]: {
        ...side,
        court,
        liberoPos: courtPos,
        replacedId: courtId,
      },
    };
    next = log(
      next,
      "LIBERO",
      `${teamName(next, team)} 리베로 IN · ${benchP.number}번 / ${courtP.number}번 OUT`,
      team,
    );
    return { ok: true, match: stamp(next) };
  }

  if (liberoOut) {
    if (side.replacedId && benchId !== side.replacedId) {
      return { ok: false, error: "리베로와 바꾼 원래 선수만 다시 들어갈 수 있습니다." };
    }
    const court = { ...side.court, [courtPos]: benchId };
    let next: LiveMatch = {
      ...match,
      [team]: { ...side, court, liberoPos: null, replacedId: null },
    };
    next = log(
      next,
      "LIBERO",
      `${teamName(next, team)} 리베로 OUT · ${benchP.number}번 IN / ${courtP.number}번`,
      team,
    );
    return { ok: true, match: stamp(next) };
  }

  return { ok: false, error: "리베로 교체는 리베로와 후위 선수만 해당합니다." };
}

export function nextSet(match: LiveMatch): MatchResult {
  if (match.status !== "set-break") return { ok: false, error: "세트가 끝난 뒤에만 진행합니다." };
  if (!match.firstServe) return { ok: false, error: "첫 서브 팀이 없습니다." };
  const setNo = match.setNo + 1;
  const serving = serveForSet(match.firstServe, setNo);
  let next: LiveMatch = {
    ...match,
    status: "live",
    setNo,
    serving,
    rally: { ours: 0, opp: 0 },
    ours: resetSetExtras(match.ours, matchSettingsOf(match).timeoutsPerSet),
    opp: resetSetExtras(match.opp, matchSettingsOf(match).timeoutsPerSet),
    scoreUndo: [],
    scoreRedo: [],
    timeout: null,
  };
  next = log(next, "SET", `${setNo}세트 시작 · ${teamName(next, serving)} 서브`, serving);
  return { ok: true, match: stamp(next) };
}

function resetSetExtras(team: TeamState, timeoutsPerSet: number): TeamState {
  return {
    ...team,
    timeoutLeft: timeoutsPerSet,
    subsUsed: 0,
    subLinks: [],
  };
}

export function applyMatchSettings(match: LiveMatch, nextSettings: MatchSettings): LiveMatch {
  const prev = matchSettingsOf(match);
  const wantedSize: RosterSize = nextSettings.rosterSize === 9 ? 9 : 6;
  const rosterSize = match.status === "warmup" ? wantedSize : prev.rosterSize;
  const settings: MatchSettings = {
    timeoutSeconds: Math.min(180, Math.max(5, Math.round(nextSettings.timeoutSeconds) || TIMEOUT_SECONDS)),
    timeoutsPerSet: Math.min(5, Math.max(1, Math.round(nextSettings.timeoutsPerSet) || TIMEOUTS_PER_SET)),
    subsPerSet: Math.min(12, Math.max(1, Math.round(nextSettings.subsPerSet) || SUBS_PER_SET)),
    rosterSize,
  };
  if (match.status === "warmup" && rosterSize !== prev.rosterSize) {
    const rebuilt = createLiveMatch(settings);
    return stamp(
      applySharedRoster(
        {
          ...rebuilt,
          createdAt: match.createdAt,
          ours: { ...rebuilt.ours, name: match.ours.name },
          opp: { ...rebuilt.opp, name: match.opp.name },
        },
        sharedRosterFromMatch(match),
      ),
    );
  }
  function adjust(team: TeamState): TeamState {
    const used = Math.max(0, prev.timeoutsPerSet - team.timeoutLeft);
    return { ...team, timeoutLeft: Math.max(0, settings.timeoutsPerSet - used) };
  }
  return stamp({
    ...match,
    settings,
    ours: adjust(match.ours),
    opp: adjust(match.opp),
  });
}

export function clearTimeoutClock(match: LiveMatch): LiveMatch {
  return stamp({ ...match, timeout: null });
}

export function stopTimeout(match: LiveMatch): LiveMatch {
  if (!match.timeout) return match;
  const team = match.timeout.team;
  return stamp(
    log({ ...match, timeout: null }, "TIMEOUT", `${teamName(match, team)} 타임아웃을 중간에 멈췄습니다.`, team),
  );
}

export function renameTeam(match: LiveMatch, team: MatchTeamId, name: string): LiveMatch {
  const trimmed = name.trim() || (team === "ours" ? "우리" : "상대");
  return stamp({ ...match, [team]: { ...match[team], name: trimmed } });
}

export function addBenchPlayer(
  match: LiveMatch,
  team: MatchTeamId,
  input: { number: string; label: string; isLibero?: boolean },
): MatchResult {
  const side = match[team];
  const number = input.number.trim();
  if (!number) return { ok: false, error: "등번호를 입력하세요." };
  if (side.players.some((p) => p.number === number)) {
    return { ok: false, error: "같은 등번호가 있습니다." };
  }
  const player: MatchPlayer = {
    id: uid(),
    number,
    label: input.label.trim() || "P",
    isLibero: matchRosterSize(match) === 9 ? false : Boolean(input.isLibero),
  };
  let liberoId = side.liberoId;
  if (player.isLibero) {
    if (liberoId) return { ok: false, error: "리베로는 팀당 한 명만 둘 수 있습니다." };
    liberoId = player.id;
  }
  return {
    ok: true,
    match: stamp({
      ...match,
      [team]: { ...side, players: [...side.players, player], liberoId },
    }),
  };
}

export function updatePlayer(
  match: LiveMatch,
  team: MatchTeamId,
  playerId: string,
  input: { number: string; label: string; isLibero?: boolean },
): MatchResult {
  const side = match[team];
  const player = playerById(side, playerId);
  if (!player) return { ok: false, error: "선수를 찾을 수 없습니다." };
  const number = input.number.trim();
  if (!number) return { ok: false, error: "등번호를 입력하세요." };
  if (side.players.some((p) => p.id !== playerId && p.number === number)) {
    return { ok: false, error: "같은 등번호가 있습니다." };
  }
  const isLibero = matchRosterSize(match) === 9 ? false : Boolean(input.isLibero);
  if (isLibero && side.liberoId && side.liberoId !== playerId) {
    return { ok: false, error: "리베로는 팀당 한 명만 둘 수 있습니다." };
  }
  const players = side.players.map((p) =>
    p.id === playerId ? { ...p, number, label: input.label.trim() || "P", isLibero } : p,
  );
  let liberoId = side.liberoId;
  if (isLibero) liberoId = playerId;
  else if (liberoId === playerId) liberoId = null;
  return {
    ok: true,
    match: stamp({
      ...match,
      [team]: {
        ...side,
        players,
        liberoId,
        liberoPos: liberoId ? side.liberoPos : null,
        replacedId: liberoId ? side.replacedId : null,
      },
    }),
  };
}

export function normalizeMatch(match: LiveMatch): LiveMatch {
  const settings = matchSettingsOf(match);
  return {
    ...match,
    scoreUndo: match.scoreUndo ?? [],
    scoreRedo: match.scoreRedo ?? [],
    settings,
    timeout: match.timeout ?? null,
    ours: { ...match.ours, timeoutLeft: match.ours.timeoutLeft ?? settings.timeoutsPerSet },
    opp: { ...match.opp, timeoutLeft: match.opp.timeoutLeft ?? settings.timeoutsPerSet },
  };
}

export function rosterRowsFromTeam(team: TeamState): SharedRosterRow[] {
  const courtIds: string[] = [];
  for (const pos of COURT_POS_9) {
    const id = team.court[pos];
    if (id) courtIds.push(id);
  }
  const seen = new Set(courtIds);
  const ordered = [
    ...courtIds.map((id) => playerById(team, id)).filter((p): p is MatchPlayer => Boolean(p)),
    ...team.players.filter((p) => !seen.has(p.id)),
  ];
  return ordered.map((p) => ({
    number: p.number,
    label: p.label,
    isLibero: p.isLibero,
  }));
}

export function sharedRosterFromMatch(match: LiveMatch): SharedRoster {
  return {
    id: SHARED_ROSTER_ID,
    ours: rosterRowsFromTeam(match.ours),
    opp: rosterRowsFromTeam(match.opp),
    rosterSize: matchRosterSize(match),
    updatedAt: Date.now(),
  };
}

export function applyRosterRows(team: TeamState, rows: SharedRosterRow[] | undefined): TeamState {
  if (!rows?.length) return team;
  let i = 0;
  const courtIds = new Set(Object.values(team.court).filter(Boolean));
  const players = team.players.map((p) => {
    if (!courtIds.has(p.id)) return p;
    const row = rows[i++];
    if (!row) return p;
    return {
      ...p,
      number: row.number.trim() || p.number,
      label: row.label.trim() || p.label,
    };
  });
  const extras: MatchPlayer[] = [];
  const usedNumbers = new Set(players.map((p) => p.number));
  for (; i < rows.length; i++) {
    const row = rows[i];
    const number = row.number.trim();
    if (!number || usedNumbers.has(number)) continue;
    usedNumbers.add(number);
    extras.push({
      id: uid(),
      number,
      label: row.label.trim() || "P",
      isLibero: false,
    });
  }
  return { ...team, players: [...players, ...extras] };
}

export function applySharedRoster(match: LiveMatch, roster: SharedRoster | undefined): LiveMatch {
  if (!roster) return match;
  return {
    ...match,
    ours: applyRosterRows(match.ours, roster.ours),
    opp: applyRosterRows(match.opp, roster.opp),
  };
}

export function teamName(match: LiveMatch, team: MatchTeamId): string {
  return match[team].name;
}

function labelOf(team: TeamState, id: string): string {
  const p = playerById(team, id);
  return p ? `${p.number}번` : "선수";
}
