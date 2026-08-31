import { useEffect, useState } from "react";
import { ConfirmModal } from "../components/ConfirmModal";
import { Modal } from "../components/Modal";
import { BenchPanel } from "../components/match/BenchPanel";
import { MatchSettingsModal } from "../components/match/MatchSettingsModal";
import { PlayerEditModal, type PlayerModalKind } from "../components/match/PlayerEditModal";
import { RotationCourt } from "../components/match/RotationCourt";
import { ScoreHeader } from "../components/match/ScoreHeader";
import { RenameModal } from "../components/RenameModal";
import { getLiveMatch, saveLiveMatch } from "../lib/db";
import {
  addBenchPlayer,
  applyLibero,
  applyMatchSettings,
  applyScore,
  applySub,
  applyTimeout,
  clearTimeoutClock,
  stopTimeout,
  createLiveMatch,
  matchSettingsOf,
  nextSet,
  normalizeMatch,
  redoScore,
  renameTeam,
  undoScore,
  updatePlayer,
  type MatchResult,
} from "../lib/matchRules";
import type { LiveMatch, MatchTeamId } from "../types/match";

type PlayerModal = {
  kind: PlayerModalKind;
  team: MatchTeamId;
  playerId: string | null;
};

export function MatchScreen() {
  const [match, setMatch] = useState<LiveMatch | null>(null);
  const [playerModal, setPlayerModal] = useState<PlayerModal | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [renameTeamId, setRenameTeamId] = useState<MatchTeamId | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timeoutOver, setTimeoutOver] = useState(false);
  const [stopTimeoutOpen, setStopTimeoutOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void getLiveMatch().then((saved) => {
      setMatch(saved ? normalizeMatch(saved) : createLiveMatch());
    });
  }, []);

  useEffect(() => {
    if (!match) return;
    const t = window.setTimeout(() => {
      void saveLiveMatch(match);
    }, 250);
    return () => window.clearTimeout(t);
  }, [match]);

  useEffect(() => {
    const endsAt = match?.timeout?.endsAt;
    if (!endsAt) return;
    const expire = () => {
      setMatch((current) => {
        if (!current?.timeout || current.timeout.endsAt !== endsAt) return current;
        window.setTimeout(() => setTimeoutOver(true), 0);
        return clearTimeoutClock(current);
      });
    };
    if (Date.now() >= endsAt) {
      expire();
      return;
    }
    setNow(Date.now());
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt) {
        window.clearInterval(id);
        expire();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [match?.timeout?.endsAt]);

  function apply(result: MatchResult, closePlayer = true) {
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setMatch(result.match);
    setNow(Date.now());
    if (closePlayer) setPlayerModal(null);
  }

  if (!match) {
    return <div className="h-full bg-ink" />;
  }

  return (
    <div className="h-full min-h-0 overflow-x-hidden overflow-y-auto bg-ink">
      <div className="match-board w-full min-w-0 px-2">
        <div className="mx-auto flex w-fit max-w-full flex-col">
          <ScoreHeader
            match={match}
            now={now}
            onScore={(team) => apply(applyScore(match, team), false)}
            onUndo={() => apply(undoScore(match), false)}
            onRedo={() => apply(redoScore(match), false)}
            onRename={setRenameTeamId}
          />

          {match.status === "set-break" ? (
            <button
              type="button"
              className="mb-1 min-h-10 rounded-xl bg-accent text-sm font-semibold text-ink"
              onClick={() => apply(nextSet(match), false)}
            >
              다음 세트
            </button>
          ) : null}

          {match.status === "finished" ? (
            <p className="mb-1 rounded-xl glass px-3 py-2 text-center text-sm font-semibold">
              {match.sets.ours > match.sets.opp ? match.ours.name : match.opp.name} 승 {match.sets.ours}–
              {match.sets.opp}
            </p>
          ) : null}

          <div className="pt-6">
            <RotationCourt
              match={match}
              now={now}
              selectedId={playerModal?.playerId ?? null}
              onPickCourt={(team, playerId) => setPlayerModal({ kind: "court", team, playerId })}
              onTimeout={(team) => {
                if (match.timeout && match.timeout.endsAt > Date.now()) {
                  setStopTimeoutOpen(true);
                  return;
                }
                apply(applyTimeout(match, team), false);
              }}
            />
            <div className="mt-5 h-px bg-white/15" />
          </div>
          <div className="pt-5">
            <BenchPanel
              match={match}
              selectedId={playerModal?.kind === "bench" ? playerModal.playerId : null}
              onPickBench={(team, playerId) => setPlayerModal({ kind: "bench", team, playerId })}
              onAddBench={(team) => setPlayerModal({ kind: "add", team, playerId: null })}
            />
            <div className="mt-5 h-px bg-white/15" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 px-3 pt-4 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white/70 ring-1 ring-line"
          aria-label="설정"
          onClick={() => setSettingsOpen(true)}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            <path
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
              d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
            />
            <path
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
              d="M19.4 13.5a7.6 7.6 0 0 0 .1-3l1.7-1.3-1.6-2.8-2 .5a7.7 7.7 0 0 0-2.6-1.5l-.4-2h-3.2l-.4 2a7.7 7.7 0 0 0-2.6 1.5l-2-.5-1.6 2.8 1.7 1.3a7.6 7.6 0 0 0 .1 3l-1.7 1.3 1.6 2.8 2-.5a7.7 7.7 0 0 0 2.6 1.5l.4 2h3.2l.4-2a7.7 7.7 0 0 0 2.6-1.5l2 .5 1.6-2.8-1.7-1.3Z"
            />
          </svg>
        </button>
        <button
          type="button"
          className="min-h-10 rounded-xl px-3 text-sm text-white/55 ring-1 ring-line"
          onClick={() => setResetOpen(true)}
        >
          새 경기
        </button>
        <button
          type="button"
          className="min-h-10 rounded-xl px-5 text-sm font-semibold text-white/85 ring-1 ring-line"
          onClick={() => setLogOpen(true)}
        >
          경기 로그
        </button>
      </div>

      <PlayerEditModal
        key={`${playerModal?.kind ?? "closed"}-${playerModal?.playerId ?? "new"}-${playerModal?.team ?? ""}`}
        open={playerModal !== null}
        kind={playerModal?.kind ?? "court"}
        match={match}
        team={playerModal?.team ?? null}
        playerId={playerModal?.playerId ?? null}
        onClose={() => setPlayerModal(null)}
        onSave={(input) => {
          if (!playerModal) return;
          if (playerModal.kind === "add") {
            apply(addBenchPlayer(match, playerModal.team, input));
            return;
          }
          if (!playerModal.playerId) return;
          apply(updatePlayer(match, playerModal.team, playerModal.playerId, input));
        }}
        onSub={(courtId) => {
          if (!playerModal?.playerId) return;
          apply(applySub(match, playerModal.team, courtId, playerModal.playerId));
        }}
        onLibero={(courtId, draft) => {
          if (!playerModal?.playerId) return;
          const updated = updatePlayer(match, playerModal.team, playerModal.playerId, draft);
          if (!updated.ok) {
            setNotice(updated.error);
            return;
          }
          apply(applyLibero(updated.match, playerModal.team, courtId, playerModal.playerId));
        }}
      />

      <MatchSettingsModal
        key={settingsOpen ? "settings-open" : "settings-closed"}
        open={settingsOpen}
        value={matchSettingsOf(match)}
        onClose={() => setSettingsOpen(false)}
        onSave={(next) => {
          setMatch(applyMatchSettings(match, next));
          setSettingsOpen(false);
        }}
      />

      <Modal open={logOpen} title="경기 로그" onClose={() => setLogOpen(false)}>
        <div className="mb-4 max-h-[55vh] overflow-y-auto">
          {match.log.length === 0 ? (
            <p className="py-4 text-center text-sm text-white/40">아직 기록이 없습니다.</p>
          ) : (
            match.log.map((e) => (
              <p key={e.id} className="border-t border-white/10 py-2 text-[12px] leading-relaxed text-white/70">
                {e.message}
              </p>
            ))
          )}
        </div>
        <button
          type="button"
          className="w-full rounded-xl bg-accent py-3 font-semibold text-ink"
          onClick={() => setLogOpen(false)}
        >
          닫기
        </button>
      </Modal>

      <RenameModal
        open={renameTeamId !== null}
        title="팀 이름"
        label="이름"
        initial={renameTeamId ? match[renameTeamId].name : ""}
        confirmLabel="저장"
        onClose={() => setRenameTeamId(null)}
        onSubmit={(name) => {
          if (!renameTeamId) return;
          setMatch(renameTeam(match, renameTeamId, name));
          setRenameTeamId(null);
        }}
      />

      <Modal open={timeoutOver} title="타임아웃" onClose={() => setTimeoutOver(false)}>
        <p className="mb-5 text-sm text-white/75">타임아웃이 끝났습니다.</p>
        <button
          type="button"
          className="w-full rounded-xl bg-accent py-3 font-semibold text-ink"
          onClick={() => setTimeoutOver(false)}
        >
          확인
        </button>
      </Modal>

      <Modal open={Boolean(notice)} title="알림" onClose={() => setNotice(null)}>
        <p className="mb-5 text-sm text-white/75">{notice}</p>
        <button
          type="button"
          className="w-full rounded-xl bg-accent py-3 font-semibold text-ink"
          onClick={() => setNotice(null)}
        >
          확인
        </button>
      </Modal>

      <ConfirmModal
        open={stopTimeoutOpen}
        title="타임아웃"
        message="타임아웃을 멈추겠습니까?"
        confirmLabel="네"
        onClose={() => setStopTimeoutOpen(false)}
        onConfirm={() => {
          setMatch(stopTimeout(match));
          setNow(Date.now());
          setStopTimeoutOpen(false);
          setTimeoutOver(false);
        }}
      />

      <ConfirmModal
        open={resetOpen}
        title="새 경기"
        message="지금 경기를 지우고 0-0부터 다시 시작할까요?"
        confirmLabel="새 경기"
        onClose={() => setResetOpen(false)}
        onConfirm={() => {
          const next = createLiveMatch(matchSettingsOf(match));
          setMatch(next);
          void saveLiveMatch(next);
          setResetOpen(false);
          setPlayerModal(null);
          setTimeoutOver(false);
        }}
      />
    </div>
  );
}
