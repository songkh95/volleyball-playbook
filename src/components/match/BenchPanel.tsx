import { benchPlayers, posOf } from "../../lib/matchRules";
import type { LiveMatch, MatchTeamId } from "../../types/match";
import { PlayerSquare } from "./PlayerSquare";

type Props = {
  match: LiveMatch;
  selectedId: string | null;
  onPickBench: (team: MatchTeamId, playerId: string) => void;
  onAddBench: (team: MatchTeamId) => void;
};

export function BenchPanel({ match, selectedId, onPickBench, onAddBench }: Props) {
  return (
    <section className="flex w-fit max-w-full items-stretch">
      <TeamBench
        team="ours"
        match={match}
        selectedId={selectedId}
        onPickBench={onPickBench}
        onAddBench={onAddBench}
      />
      <div className="flex w-6 shrink-0 flex-col items-center self-stretch">
        <span className="w-px flex-1 bg-white/15" />
        <span className="bg-ink px-0.5 py-1.5 text-[10px] text-white/40 [writing-mode:vertical-rl]">교체</span>
        <span className="w-px flex-1 bg-white/15" />
      </div>
      <TeamBench
        team="opp"
        match={match}
        selectedId={selectedId}
        onPickBench={onPickBench}
        onAddBench={onAddBench}
      />
    </section>
  );
}

function TeamBench({
  team,
  match,
  selectedId,
  onPickBench,
  onAddBench,
}: {
  team: MatchTeamId;
  match: LiveMatch;
  selectedId: string | null;
  onPickBench: (team: MatchTeamId, playerId: string) => void;
  onAddBench: (team: MatchTeamId) => void;
}) {
  const bench = benchPlayers(match[team]);
  const align = team === "ours" ? "text-left" : "text-right";
  return (
    <div className="flex w-[calc(var(--match-sq)*2+0.375rem)] flex-col">
      <p className={`mb-1 px-0.5 text-[11px] tabular-nums text-white/50 ${align}`}>
        교체 {match[team].subsUsed}
      </p>
      <div className="flex flex-wrap content-start justify-center gap-1.5">
        {bench.map((p) => (
          <PlayerSquare
            key={p.id}
            number={p.number}
            order={posOf(match[team], p.id) ?? "대기"}
            position={p.isLibero && p.label !== "L" ? `${p.label} L` : p.label}
            selected={selectedId === p.id}
            dimNumber
            onClick={() => onPickBench(team, p.id)}
          />
        ))}
        <PlayerSquare dashed onClick={() => onAddBench(team)} />
      </div>
    </div>
  );
}
