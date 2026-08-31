import { useEffect, useState } from "react";
import { BACK_POS, playerById, posOf } from "../../lib/matchRules";
import type { LiveMatch, MatchPlayer, MatchTeamId } from "../../types/match";
import { Modal } from "../Modal";

export type PlayerModalKind = "court" | "bench" | "add";

type Props = {
  open: boolean;
  kind: PlayerModalKind;
  match: LiveMatch;
  team: MatchTeamId | null;
  playerId: string | null;
  onClose: () => void;
  onSave: (input: { number: string; label: string; isLibero: boolean }) => void;
  onSub: (courtId: string) => void;
  onLibero: (courtId: string, draft: { number: string; label: string; isLibero: boolean }) => void;
};

export function PlayerEditModal({
  open,
  kind,
  match,
  team,
  playerId,
  onClose,
  onSave,
  onSub,
  onLibero,
}: Props) {
  const side = team ? match[team] : null;
  const player = side && playerId ? playerById(side, playerId) : null;
  const [number, setNumber] = useState("");
  const [label, setLabel] = useState("");
  const [isLibero, setIsLibero] = useState(false);
  const [courtId, setCourtId] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (kind === "add") {
      setNumber("");
      setLabel("");
      setIsLibero(false);
    } else {
      setNumber(player?.number ?? "");
      setLabel(player?.label ?? "");
      setIsLibero(player?.isLibero ?? false);
    }
    setCourtId(null);
    setHint(null);
  }, [open, kind, player?.id, player?.number, player?.label, player?.isLibero]);

  if (!team || !side) return null;

  const courtPlayers: MatchPlayer[] = Object.values(side.court)
    .map((id) => playerById(side, id))
    .filter((p): p is MatchPlayer => Boolean(p));
  const backRow = courtPlayers.filter((p) => {
    const pos = posOf(side, p.id);
    return pos !== null && BACK_POS.includes(pos);
  });
  const title =
    kind === "add" ? "교체 선수 등록" : kind === "bench" ? "교체 선수" : "선수 수정";

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <label className="mb-1 block text-sm text-white/70">선수 번호</label>
      <input
        className="mb-3 w-full rounded-xl bg-ink px-3 py-3 outline-none ring-1 ring-line focus:ring-accent"
        value={number}
        maxLength={3}
        inputMode="numeric"
        onChange={(e) => setNumber(e.target.value)}
      />
      <label className="mb-1 block text-sm text-white/70">포지션</label>
      <input
        className="mb-3 w-full rounded-xl bg-ink px-3 py-3 outline-none ring-1 ring-line focus:ring-accent"
        value={label}
        maxLength={12}
        placeholder="OH, MB, S…"
        onChange={(e) => setLabel(e.target.value)}
      />

      {kind !== "court" ? (
        <div className="mb-4 flex min-h-11 items-center gap-2">
          <label className="flex flex-1 items-center gap-2 text-sm text-white/75">
            <input
              type="checkbox"
              checked={isLibero}
              onChange={(e) => setIsLibero(e.target.checked)}
            />
            리베로
          </label>
          {kind === "bench" ? (
            <button
              type="button"
              className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-ink disabled:opacity-35"
              disabled={match.status !== "live"}
              onClick={() => {
                const target = courtId ?? pickLiberoTarget(side, player, isLibero);
                if (!target) {
                  setHint("후위 코트 선수를 고른 뒤 리베로 교체를 누르세요.");
                  return;
                }
                onLibero(target, { number, label, isLibero });
              }}
            >
              리베로 교체
            </button>
          ) : null}
        </div>
      ) : null}

      {kind === "bench" ? (
        <div className="mb-4">
          <p className="mb-1.5 text-xs text-white/45">코트 선수와 교체</p>
          <div className="flex flex-wrap gap-1.5">
            {(isLibero || player?.isLibero ? backRow : courtPlayers).map((p) => {
              const pos = posOf(side, p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setCourtId(p.id)}
                  className={`rounded-lg px-2.5 py-2 text-xs ${
                    courtId === p.id ? "bg-accent text-ink" : "text-white/75 ring-1 ring-line"
                  }`}
                >
                  {p.number} {p.label}
                  {pos ? ` · ${pos}` : ""}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="mt-2 min-h-11 w-full rounded-xl text-sm text-white/80 ring-1 ring-line disabled:opacity-35"
            disabled={!courtId || match.status !== "live"}
            onClick={() => {
              if (!courtId) return;
              onSub(courtId);
            }}
          >
            일반 교체
          </button>
          {hint ? <p className="mt-2 text-xs text-white/45">{hint}</p> : null}
        </div>
      ) : null}

      <div className="flex gap-2">
        <button type="button" className="flex-1 rounded-xl py-3 text-white/80 ring-1 ring-line" onClick={onClose}>
          취소
        </button>
        <button
          type="button"
          className="flex-1 rounded-xl bg-accent py-3 font-semibold text-ink"
          onClick={() => onSave({ number, label, isLibero })}
        >
          {kind === "add" ? "등록" : "저장"}
        </button>
      </div>
    </Modal>
  );
}

function pickLiberoTarget(
  side: LiveMatch["ours"],
  player: MatchPlayer | null | undefined,
  markedLibero: boolean,
): string | null {
  if (!player) return null;
  if (player.isLibero || markedLibero) {
    const back = Object.entries(side.court).find(([pos, id]) => {
      const p = playerById(side, id);
      return BACK_POS.includes(Number(pos) as 1 | 5 | 6) && p && !p.isLibero;
    });
    return back?.[1] ?? null;
  }
  if (side.liberoPos !== null && side.liberoId) return side.liberoId;
  return null;
}
