export type MatchTeamId = "ours" | "opp";
export type CourtPos = 1 | 2 | 3 | 4 | 5 | 6;
export type MatchStatus = "warmup" | "live" | "set-break" | "finished";
export type MatchEventType =
  | "SCORE"
  | "SIDE_OUT"
  | "ROTATION"
  | "SUB"
  | "LIBERO"
  | "TIMEOUT"
  | "SET"
  | "SERVE";

export type MatchPlayer = {
  id: string;
  number: string;
  label: string;
  isLibero: boolean;
};

export type MatchEvent = {
  id: string;
  at: number;
  type: MatchEventType;
  team?: MatchTeamId;
  message: string;
  rally: { ours: number; opp: number };
};

export type TeamState = {
  name: string;
  timeoutLeft: number;
  subsUsed: number;
  players: MatchPlayer[];
  court: Record<CourtPos, string>;
  liberoId: string | null;
  liberoPos: CourtPos | null;
  replacedId: string | null;
  /** 일반 교체 짝. starterId <-> subId */
  subLinks: { a: string; b: string }[];
};

export type MatchSettings = {
  timeoutSeconds: number;
  timeoutsPerSet: number;
  subsPerSet: number;
};

export type LiveMatch = {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: MatchStatus;
  serving: MatchTeamId | null;
  firstServe: MatchTeamId | null;
  setNo: number;
  sets: { ours: number; opp: number };
  rally: { ours: number; opp: number };
  ours: TeamState;
  opp: TeamState;
  log: MatchEvent[];
  scoreUndo: LiveMatch[];
  scoreRedo: LiveMatch[];
  settings: MatchSettings;
  timeout: { team: MatchTeamId; endsAt: number } | null;
};
