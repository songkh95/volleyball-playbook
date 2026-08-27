import type { CourtType, ZoneMode } from "../types/play";
import { netYNorm } from "./defaultPlay";

export type ZoneCell = {
  label: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
};

/** 우리 코트(엔드라인~네트) 구역 칸. y=0이 우리 엔드. */
export function zoneCells(mode: ZoneMode, court: CourtType): ZoneCell[] {
  if (mode === "none") return [];
  const net = netYNorm(court);
  let cols = 3;
  let rows = 3;
  let grid: (string | number)[][] = [];

  if (mode === "split-tb") {
    cols = 1;
    rows = 2;
    grid = [[2], [1]];
  } else if (mode === "split-lr") {
    cols = 2;
    rows = 1;
    grid = [[1, 2]];
  } else if (mode === "6") {
    cols = 3;
    rows = 2;
    grid = [
      [5, 6, 1],
      [4, 3, 2],
    ];
  } else {
    cols = 3;
    rows = 3;
    grid = [
      [5, 6, 1],
      [7, 8, 9],
      [4, 3, 2],
    ];
  }

  const cells: ZoneCell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({
        label: String(grid[r][c]),
        x0: c / cols,
        x1: (c + 1) / cols,
        y0: (r / rows) * net,
        y1: ((r + 1) / rows) * net,
      });
    }
  }
  return cells;
}
