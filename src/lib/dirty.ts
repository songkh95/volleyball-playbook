import type { Play, FormationPreset } from "../types/play";

function withoutUpdated<T extends { updatedAt: number }>(value: T) {
  const { updatedAt: _updatedAt, ...rest } = value;
  return rest;
}

export function isPlayDirty(current: Play, saved: Play) {
  return JSON.stringify(withoutUpdated(current)) !== JSON.stringify(withoutUpdated(saved));
}

export function isPresetDirty(current: FormationPreset, saved: FormationPreset) {
  return JSON.stringify(withoutUpdated(current)) !== JSON.stringify(withoutUpdated(saved));
}
