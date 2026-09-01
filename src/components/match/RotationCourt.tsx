import type { CourtPos, LiveMatch, MatchTeamId, TeamState } from "../../types/match";
import { matchRosterSize, matchSettingsOf, playerById } from "../../lib/matchRules";
import { PlayerSquare } from "./PlayerSquare";

const OURS_GRID_6: CourtPos[] = [5, 4, 6, 3, 1, 2];
const OPP_GRID_6: CourtPos[] = [4, 5, 3, 6, 2, 1];
const OURS_GRID_9: CourtPos[] = [5, 8, 4, 6, 9, 3, 1, 7, 2];
const OPP_GRID_9: CourtPos[] = [4, 8, 5, 3, 9, 6, 2, 7, 1];

type Props = {
  match: LiveMatch;
  now: number;
  selectedId: string | null;
  onPickCourt: (team: MatchTeamId, playerId: string) => void;
  onTimeout: (team: MatchTeamId) => void;
};

export function RotationCourt({ match, now, selectedId, onPickCourt, onTimeout }: Props) {
  const nine = matchRosterSize(match) === 9;
  return (
    <section className="flex w-fit max-w-full items-stretch">
      <TeamGrid
        match={match}
        now={now}
        team="ours"
        order={nine ? OURS_GRID_9 : OURS_GRID_6}
        cols={nine ? 3 : 2}
        selectedId={selectedId}
        onPick={onPickCourt}
        onTimeout={() => onTimeout("ours")}
      />
      <div className="flex w-6 shrink-0 flex-col items-center self-stretch">
        <span className="w-px flex-1 bg-white/20" />
        <span className="bg-ink px-0.5 py-1.5 text-[10px] tracking-[0.2em] text-white/40 [writing-mode:vertical-rl]">
          NET
        </span>
        <span className="w-px flex-1 bg-white/20" />
      </div>
      <TeamGrid
        match={match}
        now={now}
        team="opp"
        order={nine ? OPP_GRID_9 : OPP_GRID_6}
        cols={nine ? 3 : 2}
        selectedId={selectedId}
        onPick={onPickCourt}
        onTimeout={() => onTimeout("opp")}
      />
    </section>
  );
}

function TeamGrid({
  match,
  now,
  team,
  order,
  cols,
  selectedId,
  onPick,
  onTimeout,
}: {
  match: LiveMatch;
  now: number;
  team: MatchTeamId;
  order: CourtPos[];
  cols: 2 | 3;
  selectedId: string | null;
  onPick: (team: MatchTeamId, playerId: string) => void;
  onTimeout: () => void;
}) {
  const settings = matchSettingsOf(match);
  const used = settings.timeoutsPerSet - match[team].timeoutLeft;
  const remain = match.timeout ? Math.max(0, Math.ceil((match.timeout.endsAt - now) / 1000)) : 0;
  const active = Boolean(match.timeout && remain > 0 && match.timeout.team === team);

  return (
    <div className="flex flex-col">
      <div className={`grid gap-1.5 ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {order.map((pos) => (
          <Cell key={`${team}-${pos}`} match={match} team={team} pos={pos} selectedId={selectedId} onPick={onPick} />
        ))}
      </div>
      <div className={`mt-1.5 grid gap-1.5 ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {team === "ours" ? (
          <TimeoutBtn used={used} max={settings.timeoutsPerSet} active={active} onClick={onTimeout} />
        ) : (
          <span />
        )}
        {cols === 3 ? <span /> : null}
        {team === "opp" ? (
          <TimeoutBtn used={used} max={settings.timeoutsPerSet} active={active} onClick={onTimeout} />
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

function TimeoutBtn({
  used,
  max,
  active,
  onClick,
}: {
  used: number;
  max: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 w-full items-center justify-center whitespace-nowrap text-center text-[length:max(0.625rem,calc(var(--match-sq)*0.15))] tabular-nums ${
        active ? "text-accent" : "text-white/70"
      }`}
    >
      타임아웃 {used}/{max}
    </button>
  );
}

function Cell({
  match,
  team,
  pos,
  selectedId,
  onPick,
}: {
  match: LiveMatch;
  team: MatchTeamId;
  pos: CourtPos;
  selectedId: string | null;
  onPick: (team: MatchTeamId, playerId: string) => void;
}) {
  const side: TeamState = match[team];
  const id = side.court[pos];
  const player = playerById(side, id);
  return (
    <PlayerSquare
      number={player?.number}
      order={pos}
      position={player?.isLibero && player.label !== "L" ? `${player.label} L` : player?.label}
      serving={match.serving === team && pos === 1}
      selected={selectedId === id}
      onClick={() => onPick(team, id)}
    />
  );
}
