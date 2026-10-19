import { publicPryerDate, publicPryerFields as fields } from '../sage/life.js';
import type { BlathererAttempt, BlathererLifeState } from '../blatherer/life.js';
import type { BloodDukeOperationState } from './life.js';

/** Original people and objects remain visible; never copy an authority snapshot wholesale. */
function publicOriginalAttempt(a: BlathererAttempt): BlathererAttempt {
  return {
    ...fields(a, ['week', 'method', 'closed', 'result', 'initialSpirituality', 'initialMind', 'elapsedSeconds', 'playerTravelMetres', 'spiritualitySpent', 'mindSpent', 'resolutionPaid', 'resolutionActions', 'consent', 'withdrawn', 'cardRead', 'cardTaken', 'cardReturned', 'bellRead', 'guideLeft', 'whisperTier', 'whisperSourceId', 'whisperAtSecond', 'voiceActive', 'stopped', 'residualSeconds', 'waitedSeconds', 'waitCompleted', 'currentAnswer', 'ordinaryChecked', 'outcomeRecorded', 'outcome']),
    date: publicPryerDate(a.date),
    playerMoves: a.playerMoves.map(m => ({ ...fields(m, ['from', 'to', 'mode', 'metres', 'seconds']), itemIds: [...m.itemIds] })),
    steps: a.steps.map(s => fields(s, ['type', 'tier', 'atSecond', 'volunteerWilling'])),
    evidence: a.evidence.map(e => fields(e, ['sourceId', 'text', 'atSecond'])),
  };
}
export function publicAbyssOriginalSite<T extends Omit<BlathererLifeState, 'playerLocation'> & { playerLocation: string }>(s: T): Omit<BlathererLifeState, 'playerLocation'> & { playerLocation: T['playerLocation'] } {
  const projectCase = (c: BlathererLifeState['cases'][keyof BlathererLifeState['cases']]) => ({
    ...fields(c, ['status', 'observedWeek', 'method', 'result', 'contactOpen', 'returned', 'closes', 'withdrawals']), attempts: c.attempts.map(publicOriginalAttempt),
  });
  return {
    ...fields(s, ['siteId', 'introducedWeek', 'activeCase', 'playerLocation', 'playerTravelMetres', 'clockSeconds', 'reflected']),
    introducedDate: s.introducedDate ? publicPryerDate(s.introducedDate) : null,
    volunteer: fields(s.volunteer, ['id', 'name', 'age', 'alive', 'willing', 'location']),
    guide: { ...fields(s.guide, ['id', 'name', 'location', 'travelMetres']), moves: s.guide.moves.map(m => fields(m, ['caseId', 'from', 'to', 'metres', 'seconds', 'atSecond'])) },
    card: fields(s.card, ['id', 'owner', 'quantity', 'location', 'travelMetres']), bell: fields(s.bell, ['id', 'quantity', 'location']),
    note: { ...fields(s.note, ['id', 'quantity', 'location']), records: s.note.records.map(r => fields(r, ['caseId', 'text'])) },
    cases: { 'conflicting-bell': projectCase(s.cases['conflicting-bell']), 'withdrawn-invitation': projectCase(s.cases['withdrawn-invitation']), 'open-corridor': projectCase(s.cases['open-corridor']) },
  };
}
export function publicAbyssOperation(o: BloodDukeOperationState): BloodDukeOperationState {
  return {
    ...fields(o, ['door', 'inputActive', 'restraintUntil', 'hesitationUntil', 'bellRehearsals']),
    impulse: o.impulse ? fields(o.impulse, ['actor', 'kind', 'observedAt', 'expiresAt']) : null,
    emotion: o.emotion ? fields(o.emotion, ['subjectId', 'triggerId', 'kind', 'triggeredAt', 'confirmedAt', 'expiresAt']) : null,
  };
}
