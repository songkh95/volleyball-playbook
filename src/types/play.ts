export type CourtType = "half" | "full";
export type RosterSize = 6 | 9;
export type ObjKind = "player" | "ball";

export type CourtObject = {
  id: string;
  kind: ObjKind;
  x: number;
  y: number;
  label: string;
  color: string;
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

export const TEAM_RED = "#c62828";
export const TEAM_BLUE = "#1565c0";
export const LIBERO_WHITE = "#f5f5f5";
export const BALL_YELLOW = "#ffd54f";
