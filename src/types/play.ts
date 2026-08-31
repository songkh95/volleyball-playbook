export type CourtType = "half" | "full";
export type RosterSize = 6 | 9;
export type ObjKind = "player" | "ball" | "cone" | "text";
export type PlayerTeam = "ours" | "opp";
export type BallFlight = "fast" | "slow";

/** 공에서 퍼지는 낙하 부채꼴. heading 0은 상대 엔드(+y). */
export type LandingFan = {
  heading: number;
  spread: number;
  depth: number;
};

export type CourtObject = {
  id: string;
  kind: ObjKind;
  x: number;
  y: number;
  label: string;
  color: string;
  /** 선수만 사용. 없으면 색상으로 추정(블루=상대). */
  team?: PlayerTeam;
  /** 공만 사용. 미터 단위 높이. 없으면 3D에서 자동. */
  height?: number;
  /** 공만 사용. 다음 장면으로 가는 이동. 없으면 보통. */
  flight?: BallFlight;
  /** 선수만 사용. 이 장면의 책임 범위. */
  coverageOn?: boolean;
  /** 선수만 사용. 책임 범위 반경(m). 없으면 2.5. */
  coverageM?: number;
  /** 공만 사용. 다음 접촉의 낙하 부채. */
  fan?: LandingFan | null;
  /** 텍스트만 사용. 기본 18. */
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
};

export type ZoneMode = "none" | "6" | "9" | "split-tb" | "split-lr";
export type EditorTool = "select" | "pen" | "eraser" | "laser";
export type StrokeKind = "arrow" | "solid" | "dashed";

export type Stroke = {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  arrowhead: boolean;
  kind?: StrokeKind;
  width?: number;
};

export type Cut = {
  id: string;
  name: string;
  durationMs: number;
  objects: CourtObject[];
  strokes: Stroke[];
};

export type GalleryCapture = {
  id: string;
  playId: string;
  playTitle: string;
  cutName: string;
  createdAt: number;
  blob: Blob;
};

export type Album = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

export type FormationPreset = {
  id: string;
  title: string;
  court: CourtType;
  rosterSize: RosterSize;
  objects: CourtObject[];
  createdAt: number;
  updatedAt: number;
  /** 앱이 넣는 기본 대형. 삭제 버튼 숨김. */
  builtin?: boolean;
};

export type Play = {
  id: string;
  albumId: string;
  title: string;
  court: CourtType;
  rosterSize: RosterSize;
  cuts: Cut[];
  updatedAt: number;
  createdAt: number;
};

export type BackupFile = {
  schema: 1 | 2;
  app: "volleyball-playbook";
  exportedAt: string;
  plays: Play[];
  albums?: Album[];
  presets?: FormationPreset[];
};

export const TEAM_RED = "#ff3b3b";
export const TEAM_BLUE = "#3b8bff";
export const LIBERO_WHITE = "#f5f5f5";
export const BALL_YELLOW = "#ffd54f";
