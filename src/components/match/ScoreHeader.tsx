import type { ReactNode } from "react";
import type { LiveMatch, MatchTeamId } from "../../types/match";

type Props = {
  match: LiveMatch;
  now: number;
  onScore: (team: MatchTeamId) => void;
  onUndo: () => void;
  onRedo: () => void;
  onRename: (team: MatchTeamId) => void;
};

export function ScoreHeader({ match, now, onScore, onUndo, onRedo, onRename }: Props) {
  const remain = match.timeout ? Math.max(0, Math.ceil((match.timeout.endsAt - now) / 1000)) : 0;
  const timeoutOn = Boolean(match.timeout && remain > 0);

  return (
    <header className="grid grid-cols-[calc(var(--match-sq)*2+0.375rem)_1.5rem_calc(var(--match-sq)*2+0.375rem)] items-center gap-y-1 pb-5 pt-[max(0.6rem,env(safe-area-inset-top))] landscape:pb-4 landscape:pt-[max(0.35rem,env(safe-area-inset-top))]">
      <TeamName
        name={match.ours.name}
        color="text-ours"
        serving={match.serving === "ours"}
        onRename={() => onRename("ours")}
      />
      <span />
      <TeamName
        name={match.opp.name}
        color="text-opp"
        serving={match.serving === "opp"}
        onRename={() => onRename("opp")}
      />

      <TeamScore
        points={match.rally.ours}
        serving={match.serving === "ours"}
        timeoutOn={timeoutOn}
        colorClass="text-ours"
      />
      <div className="relative z-10 flex items-center justify-center gap-1 self-end justify-self-center pb-1">
        <HistoryBtn label="이전" disabled={match.scoreUndo.length === 0} onClick={onUndo}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"
            />
          </svg>
        </HistoryBtn>
        <HistoryBtn
          label="앞으로 가기"
          disabled={(match.scoreRedo ?? []).length === 0}
          onClick={onRedo}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3"
            />
          </svg>
        </HistoryBtn>
      </div>
      <TeamScore
        points={match.rally.opp}
        serving={match.serving === "opp"}
        timeoutOn={timeoutOn}
        colorClass="text-opp"
      />

      <button
        type="button"
        className="justify-self-center px-2 py-1 text-sm text-white/80"
        onClick={() => onScore("ours")}
      >
        득점
      </button>
      <p className="relative z-10 w-max max-w-[9.5rem] justify-self-center text-center text-[11px] leading-snug tabular-nums text-white/70 sm:max-w-[13rem] sm:text-sm">
        {timeoutOn
          ? `세트 ${match.setNo} · ${match.sets.ours}–${match.sets.opp} · 타임아웃 ${remain}초`
          : `세트 ${match.setNo} · ${match.sets.ours}–${match.sets.opp} · ${statusLabel(match)}`}
      </p>
      <button
        type="button"
        className="justify-self-center px-2 py-1 text-sm text-white/80"
        onClick={() => onScore("opp")}
      >
        득점
      </button>
    </header>
  );
}

function TeamScore({
  points,
  serving,
  timeoutOn,
  colorClass,
}: {
  points: number;
  serving: boolean;
  timeoutOn: boolean;
  colorClass: string;
}) {
  const color = timeoutOn ? "text-muted" : serving ? colorClass : "text-white";
  return (
    <p
      className={`w-full text-center text-[clamp(2.5rem,11vw,4.5rem)] font-bold tabular-nums leading-none ${color}`}
    >
      {points}
    </p>
  );
}

function TeamName({
  name,
  color,
  serving,
  onRename,
}: {
  name: string;
  color: string;
  serving: boolean;
  onRename: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRename}
      className="flex min-h-8 min-w-0 items-center justify-center gap-1"
    >
      {serving ? <span className="h-2 w-2 shrink-0 rounded-full bg-accent" /> : null}
      <span className={`truncate text-sm font-semibold ${color}`}>{name}</span>
    </button>
  );
}

function HistoryBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border disabled:opacity-30 ${
        disabled ? "border-white/15 text-white/35" : "border-white/20 text-white/85"
      }`}
    >
      {children}
    </button>
  );
}

function statusLabel(match: LiveMatch) {
  if (match.status === "warmup") return "시작 전";
  if (match.status === "set-break") return "세트 종료";
  if (match.status === "finished") return "경기 종료";
  return "진행 중";
}
