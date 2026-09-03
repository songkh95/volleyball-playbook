import type { CourtObject, Cut, PlayerPose } from "../types/play";

export const PLAYER_POSES: PlayerPose[] = ["idle", "receive", "set", "spike", "block"];

export function poseLabel(pose: PlayerPose) {
  if (pose === "receive") return "리시브";
  if (pose === "set") return "토스";
  if (pose === "spike") return "스파이크";
  if (pose === "block") return "블로킹";
  return "대기";
}

export function poseShort(pose: PlayerPose | null | undefined) {
  if (pose === "receive") return "리";
  if (pose === "set") return "토";
  if (pose === "spike") return "스";
  if (pose === "block") return "블";
  return null;
}

export type PoseAssignment = {
  playerId: string;
  playerLabel: string;
  pose: PlayerPose;
};

export function posesOnCut(cuts: Cut[], cutIndex: number): PoseAssignment[] {
  const objects = cuts[cutIndex]?.objects ?? [];
  const out: PoseAssignment[] = [];
  for (const o of objects) {
    if (o.kind !== "player" || !o.pose || o.pose === "idle") continue;
    out.push({ playerId: o.id, playerLabel: o.label, pose: o.pose });
  }
  return out;
}

function poseLeadInOf(o: CourtObject) {
  return o.poseLeadIn !== false;
}

/**
 * 리시브·토스·스파이크·블로킹 공통.
 * 이 장면만: 그 장면 시작(playhead=cut)부터 다음 장면 도착 직전까지.
 * 이전부터: 바로 앞 장면 시작부터 이 장면이 끝날 때까지.
 * 구간이 겹치면 뒤 장면 자세가 이긴다.
 */
function poseHoldsAt(cutIndex: number, leadIn: boolean, playhead: number) {
  const start = Math.max(0, cutIndex - (leadIn ? 1 : 0));
  const end = cutIndex + 1;
  return playhead >= start && playhead < end;
}

export function poseMapAtPlayhead(cuts: Cut[], playhead: number): Record<string, PlayerPose> {
  if (cuts.length === 0) return {};
  const last = cuts.length - 1;
  const p = Math.min(last, Math.max(0, playhead));
  const map: Record<string, PlayerPose> = {};
  for (let i = 0; i <= last; i++) {
    for (const o of cuts[i]?.objects ?? []) {
      if (o.kind !== "player" || !o.pose || o.pose === "idle") continue;
      if (!poseHoldsAt(i, poseLeadInOf(o), p)) continue;
      map[o.id] = o.pose;
    }
  }
  return map;
}

export function playerActionPose(
  cuts: Cut[],
  playhead: number,
  playerId: string,
): PlayerPose | null {
  const pose = poseMapAtPlayhead(cuts, playhead)[playerId];
  if (!pose || pose === "idle") return null;
  return pose;
}

function clearPlayerPose(o: CourtObject): CourtObject {
  if (!o.pose && o.poseLeadIn == null) return o;
  const next = { ...o };
  delete next.pose;
  delete next.poseLeadIn;
  return next;
}

function patchPlayerPose(o: CourtObject, pose: PlayerPose, leadIn: boolean): CourtObject {
  if (pose === "idle") return clearPlayerPose(o);
  return { ...o, pose, poseLeadIn: leadIn };
}

export function applyManualPoseToCuts(
  cuts: Cut[],
  cutIndex: number,
  playerId: string,
  pose: PlayerPose,
  fromPrevious = false,
): Cut[] {
  return cuts.map((c, idx) => {
    if (idx === cutIndex) {
      return {
        ...c,
        objects: c.objects.map((o) =>
          o.kind === "player" && o.id === playerId ? patchPlayerPose(o, pose, fromPrevious) : o,
        ),
      };
    }
    if (
      !fromPrevious &&
      idx === cutIndex - 1 &&
      pose !== "idle" &&
      playerPoseOnCut(c.objects, playerId) === pose
    ) {
      return {
        ...c,
        objects: c.objects.map((o) =>
          o.kind === "player" && o.id === playerId ? clearPlayerPose(o) : o,
        ),
      };
    }
    return c;
  });
}

export function playerPoseOnCut(
  objects: CourtObject[] | undefined,
  playerId: string,
): PlayerPose {
  const o = objects?.find((item) => item.id === playerId && item.kind === "player");
  if (!o?.pose || o.pose === "idle") return "idle";
  return o.pose;
}

export function playerPoseLeadIn(
  objects: CourtObject[] | undefined,
  playerId: string,
) {
  const o = objects?.find((item) => item.id === playerId && item.kind === "player");
  if (!o?.pose || o.pose === "idle") return true;
  return o.poseLeadIn !== false;
}
