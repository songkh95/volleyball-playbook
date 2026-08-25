export { LIBERO_WHITE, TEAM_BLUE, TEAM_RED } from "../types/play";
import { TEAM_RED } from "../types/play";

/** 우리팀 유니폼 1~9 */
export const OUR_TEAM_COLORS = [
  { n: 1, value: TEAM_RED, label: "레드" },
  { n: 2, value: "#ef6c00", label: "오렌지" },
  { n: 3, value: "#f9a825", label: "골드" },
  { n: 4, value: "#2e7d32", label: "그린" },
  { n: 5, value: "#00695c", label: "틸" },
  { n: 6, value: "#0277bd", label: "스카이" },
  { n: 7, value: "#1a237e", label: "네이비" },
  { n: 8, value: "#6a1b9a", label: "퍼플" },
  { n: 9, value: "#212121", label: "블랙" },
] as const;

export function isLightColor(hex: string) {
  const h = hex.replace("#", "");
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}
