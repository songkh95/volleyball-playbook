export { LIBERO_WHITE, TEAM_BLUE, TEAM_RED } from "../types/play";
import { TEAM_BLUE, TEAM_RED } from "../types/play";

/** 선수 유니폼. 우리팀·상대팀 공통. 기본값은 우리팀 레드, 상대팀 블루. */
export const PLAYER_COLORS = [
  { n: 1, value: TEAM_RED, label: "레드" },
  { n: 2, value: TEAM_BLUE, label: "블루" },
  { n: 3, value: "#ef6c00", label: "오렌지" },
  { n: 4, value: "#f9a825", label: "골드" },
  { n: 5, value: "#2e7d32", label: "그린" },
  { n: 6, value: "#00695c", label: "틸" },
  { n: 7, value: "#0277bd", label: "스카이" },
  { n: 8, value: "#1a237e", label: "네이비" },
  { n: 9, value: "#6a1b9a", label: "퍼플" },
  { n: 10, value: "#212121", label: "블랙" },
] as const;

export const CONE_COLORS = [
  { value: "#1565c0", label: "블루" },
  { value: "#ef6c00", label: "오렌지" },
  { value: "#f9a825", label: "노랑" },
  { value: "#c62828", label: "레드" },
  { value: "#2e7d32", label: "그린" },
  { value: "#f5f5f5", label: "화이트" },
  { value: "#212121", label: "블랙" },
] as const;

export const TEXT_COLORS = [
  { value: "#ffffff", label: "화이트" },
  { value: "#ffd54f", label: "노랑" },
  { value: "#212121", label: "블랙" },
  { value: "#c62828", label: "레드" },
  { value: "#1565c0", label: "블루" },
  { value: "#1b5e20", label: "그린" },
  { value: "#f5f5f5", label: "라이트" },
] as const;

export function isLightColor(hex: string) {
  const h = hex.replace("#", "");
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}
