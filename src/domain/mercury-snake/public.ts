import { publicPryerFields as fields, publicPryerDate, publicPryerCheck, publicPryerInjury } from '../sage/life.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { MERCURY_SNAKE_ABILITIES, MERCURY_SNAKE_INHERITED_ABILITIES } from './content.js';
import type { SliceCombatRound, SliceState } from '../slice/types.js';
import type { WinnerLuck } from '../winner/types.js';
import type { ChaosWalkerAttempt, ChaosWalkerLifeState, ChaosWalkerMovement } from '../chaos-walker/life.js';
import type { FateProphetOperationState } from '../fate-prophet/life.js';
import type { MisfortuneMageRoundOutcome } from '../misfortune-mage/combat.js';
import type { ChaosWalkerRoundOutcome } from '../chaos-walker/combat.js';
import type { FateProphetActionEvidence, FateProphetRoundOutcome } from '../fate-prophet/combat.js';
import type { MercurySnakeOriginals, MercurySnakeSite } from './types.js';
import type { MercurySnakeCombatBody, MercurySnakeCombatPiece, MercurySnakePlate, MercurySnakeForceReceipt, MercurySnakeWindow, MercurySnakeEncounterBudget, MercurySnakeFinanceSnapshot } from './encounter.js';
import type { MercurySnakeAttempt, MercurySnakePiece, MercurySnakeCapturedRelation, MercurySnakeLifeWindow } from './life.js';
import { projectMercurySnakeRoundOutcome } from './combat.js';

/** Explicit evidence projections for the actual inherited Wheel route. */
export const publicMercurySnakeLuck = (l: WinnerLuck): WinnerLuck => fields(l, ['stored', 'lastAccumulateWeek', 'accumulated', 'spent']);
const masteryIds = [...MERCURY_SNAKE_INHERITED_ABILITIES, ...MERCURY_SNAKE_ABILITIES].map(a => a.id);
export const publicMercurySnakeMastery = (m: Record<string, number>): Record<string, number> => Object.fromEntries(masteryIds.filter(id => Object.hasOwn(m, id)).map(id => [id, m[id]!]));
const publicMovement = (m: ChaosWalkerMovement): ChaosWalkerMovement => ({ ...fields(m, ['from', 'to', 'mode', 'metres', 'seconds']), itemIds: [...m.itemIds] });
function publicOriginalAttempt(a: ChaosWalkerAttempt): ChaosWalkerAttempt { return {
  ...fields(a, ['week', 'method', 'closed', 'result', 'initialSpirituality', 'initialMind', 'initialKnowledge', 'elapsedSeconds', 'playerTravelMetres', 'resolutionPaid', 'resolutionActions', 'spiritualitySpent', 'mindSpent', 'luckSpent', 'objectChecked', 'consent', 'consentWithdrawn', 'abilityTier', 'abilitySourceId', 'abilityAtSecond', 'inputActive', 'stopped', 'pendingRemainingSeconds', 'modifierApplied', 'modifierCancelled', 'modifierExpired', 'waitedSeconds', 'waitCompleted', 'branchRoll', 'branchChance', 'branchResult', 'eventDraws', 'eventAtSecond', 'eventSourceId', 'resultRead', 'recordRead', 'compared', 'limitedConfirmed', 'rejectedClaims', 'objectsReturned', 'ordinaryChecked', 'outcomeRecorded', 'outcome']),
  date: publicPryerDate(a.date), initialLuck: publicMercurySnakeLuck(a.initialLuck), luckBefore: a.luckBefore ? publicMercurySnakeLuck(a.luckBefore) : null, luckAfter: a.luckAfter ? publicMercurySnakeLuck(a.luckAfter) : null,
  abilityCheck: publicPryerCheck(a.abilityCheck), playerMoves: a.playerMoves.map(publicMovement), guideMoves: a.guideMoves.map(publicMovement), objectMoves: a.objectMoves.map(publicMovement),
  steps: a.steps.map(s => ({ ...fields(s, ['type', 'atSecond', 'eventRoll', 'willing', 'claim']), check: publicPryerCheck(s.check) })), evidence: a.evidence.map(e => fields(e, ['sourceId', 'text', 'atSecond'])),
}; }
export function publicWheelOriginalSite(s: ChaosWalkerLifeState): ChaosWalkerLifeState;
export function publicWheelOriginalSite(s: MercurySnakeSite): MercurySnakeSite;
export function publicWheelOriginalSite(s: MercurySnakeSite): MercurySnakeSite {
  const projectCase = (c: ChaosWalkerLifeState['cases'][keyof ChaosWalkerLifeState['cases']]) => ({ ...fields(c, ['status', 'observedWeek', 'method', 'result', 'contactOpen', 'returned', 'closes', 'withdrawals']), attempts: c.attempts.map(publicOriginalAttempt) });
  return {
    ...fields(s, ['siteId', 'introducedWeek', 'activeCase', 'playerLocation', 'playerTravelMetres', 'guideTravelMetres', 'clockSeconds', 'reflected']), introducedDate: s.introducedDate ? publicPryerDate(s.introducedDate) : null,
    guide: fields(s.guide, ['id', 'name', 'location']), volunteer: { ...fields(s.volunteer, ['id', 'name', 'age', 'alive', 'willing', 'location', 'health', 'mind', 'spirituality']), injuries: [] },
    cart: fields(s.cart, ['id', 'owner', 'quantity', 'location', 'control', 'releases', 'returns']), parcel: fields(s.parcel, ['id', 'owner', 'quantity', 'massGrams', 'sealed', 'location']),
    stops: s.stops.map(x => fields(x, ['id', 'location', 'padded'])), pouch: fields(s.pouch, ['id', 'owner', 'quantity', 'opaque', 'location', 'draws', 'returns']), tags: s.tags.map(x => fields(x, ['id', 'owner', 'quantity', 'location'])),
    disc: fields(s.disc, ['id', 'owner', 'quantity', 'location', 'control', 'pointer', 'spins', 'returns']), record: fields(s.record, ['id', 'owner', 'quantity', 'location', 'text']), forecast: fields(s.forecast, ['id', 'owner', 'quantity', 'location', 'text']),
    cases: { 'cart-fork': projectCase(s.cases['cart-fork']), 'revoked-draw': projectCase(s.cases['revoked-draw']), counterexample: projectCase(s.cases.counterexample) },
    accumulations: s.accumulations.map(a => fields(a, ['week', 'actionCost', 'storedBefore', 'storedAfter', 'accumulatedAfter', 'spentAtTime'])),
  };
}
/** The mechanical preparation draw remains private even after the event settles. */
export function publicMercurySnakeOperation(o: FateProphetOperationState) { return {
  door: o.door,
  mechanical: o.mechanical ? fields(o.mechanical, ['objectId', 'caseId', 'preparedAt', 'bias', 'version']) : null,
  forecast: o.forecast ? fields(o.forecast, ['objectId', 'version', 'bias', 'castAt', 'expiresAt', 'valid']) : null,
  correction: o.correction ? fields(o.correction, ['objectId', 'version', 'castAt', 'expiresAt', 'percentagePoints']) : null,
}; }
export const publicMercurySnakeOriginals = (o: MercurySnakeOriginals) => ({ site: publicWheelOriginalSite(o.site), operation: publicMercurySnakeOperation(o.operation), luck: publicMercurySnakeLuck(o.luck) });
export function publicMercurySnakeBudget(b: MercurySnakeEncounterBudget): MercurySnakeEncounterBudget { return {
  ...fields(b, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'gender', 'sequence', 'acting', 'injuryRisk']), coreStats: fields(b.coreStats, ['physique', 'perception', 'will', 'knowledge']),
  mastery: publicMercurySnakeMastery(b.mastery), completedSources: [...b.completedSources], injuries: b.injuries.map(publicPryerInjury), luck: publicMercurySnakeLuck(b.luck),
}; }
export function publicMercurySnakeFinance(f: MercurySnakeFinanceSnapshot): MercurySnakeFinanceSnapshot { return { ...fields(f, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'missedWeeks', 'credit']), debts: f.debts.map(d => fields(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek'])) }; }
export const publicMercurySnakePiece = (p: MercurySnakeCombatPiece): MercurySnakeCombatPiece => fields(p, ['id', 'ownerId', 'location', 'quantity', 'initialCharges', 'charges', 'wear', 'paidPennies']);
export const publicMercurySnakePlate = (p: MercurySnakePlate): MercurySnakePlate => fields(p, ['id', 'ownerId', 'status', 'usedRound', 'usedOrder']);
export const publicMercurySnakeForceReceipt = (r: MercurySnakeForceReceipt): MercurySnakeForceReceipt => fields(r, ['id', 'targetId', 'power', 'kind', 'plateId', 'paidCost', 'round', 'order', 'atSeconds', 'position', 'visible', 'conditionVersion', 'unsettled', 'contribution']);
export const publicMercurySnakeWindow = (w: MercurySnakeWindow): MercurySnakeWindow => ({ ...fields(w, ['kind', 'round', 'order', 'castAt', 'expiresAt', 'conditionVersion']), relation: fields(w.relation, ['playerId', 'position', 'localMetres', 'observedAt', 'conditionVersion', 'living']) });
export function publicMercurySnakeBody(b: MercurySnakeCombatBody): MercurySnakeCombatBody { return {
  ...fields(b, ['enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'enemyRisk', 'weaponLocation', 'emotion', 'conditionVersion', 'repositionUses', 'playerLocalMetres', 'playerMovementVersion', 'bodyImpulseCount', 'playerTravelMetres', 'playerAttackTravelMetres', 'enemyTravelMetres', 'enemyAttackTravelMetres', 'restartApplications', 'anchorApplications', 'pendingKind', 'composureReady', 'lastLuckRound', 'foresightAttempts', 'hazardAttempts', 'deviationAttempts', 'impedimentAttempts', 'luckAttempts']),
  enemyInjuries: b.enemyInjuries.map(publicPryerInjury), powerUses: fields(b.powerUses, ['MIND_SPIKE', 'WARD', 'CALM']), plates: b.plates.map(publicMercurySnakePlate), piece: b.piece ? publicMercurySnakePiece(b.piece) : null,
  restart: b.restart ? publicMercurySnakeWindow(b.restart) : null, anchor: b.anchor ? publicMercurySnakeWindow(b.anchor) : null, lastForceReceipt: b.lastForceReceipt ? publicMercurySnakeForceReceipt(b.lastForceReceipt) : null,
}; }
export const publicMercurySnakeLifePiece = (p: MercurySnakePiece): MercurySnakePiece => fields(p, ['id', 'caseId', 'kind', 'ownerId', 'quantity', 'status', 'location', 'initialCharges', 'charges', 'wear', 'paidPennies', 'boughtWeek', 'travelMetres', 'returnUses', 'anchorUses']);
export const publicMercurySnakeCapturedRelation = (r: MercurySnakeCapturedRelation): MercurySnakeCapturedRelation => ({ ...fields(r, ['id', 'caseId', 'pieceId', 'capturedAt', 'expiresAt', 'conditionVersion', 'permissionVersion', 'valid', 'capturedLocation', 'parcelLocation']), cart: fields(r.cart, ['id', 'owner', 'quantity', 'releases', 'returns']), parcel: fields(r.parcel, ['id', 'owner', 'quantity', 'massGrams', 'sealed']) });
export const publicMercurySnakeLifeWindow = (w: MercurySnakeLifeWindow): MercurySnakeLifeWindow => fields(w, ['abilityId', 'caseId', 'pieceId', 'relationId', 'createdAt', 'expiresAt', 'conditionVersion', 'permissionVersion', 'location']);
export function publicMercurySnakeAttempt(a: MercurySnakeAttempt): MercurySnakeAttempt { return {
  ...fields(a, ['week', 'method', 'closed', 'stopped', 'returned', 'withdrawn', 'elapsedSeconds', 'playerTravelMetres', 'guideTravelMetres', 'volunteerTravelMetres', 'spiritualitySpent', 'mindSpent', 'volunteerMindSpent', 'penniesSpent', 'pieceId', 'readCart', 'readOriginal', 'piecePlaced', 'captured', 'released', 'releaseAt', 'restartTier', 'anchorTier', 'restartApplied', 'anchorApplied', 'returnKind', 'verified', 'objectsReturned', 'waits', 'windowEnd', 'result']),
  appliedAbilityIds: [...a.appliedAbilityIds], siteAtStart: publicWheelOriginalSite(a.siteAtStart), siteAtClose: a.siteAtClose ? publicWheelOriginalSite(a.siteAtClose) : null,
}; }

const publicPassive = (p: { roll: number; triggered: boolean; bonus: number } | null) => p ? fields(p, ['roll', 'triggered', 'bonus']) : null;
export function projectMisfortuneMageRoundOutcome(o: MisfortuneMageRoundOutcome): Omit<MisfortuneMageRoundOutcome, 'source'> { return {
  ...fields(o, ['targetId', 'round', 'stance', 'winnerPolicy', 'continuing', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'playerSpiritualityBefore', 'playerSpiritualityAfter', 'playerHealthAfter', 'playerMindAfter', 'enemySpiritualityBefore', 'luckStoredAfter', 'luckSpentAfter', 'lastLuckRound', 'luckAttempts', 'misfortuneAttempts', 'staggerReady', 'composureReady']),
  powerUses: fields(o.powerUses, ['ARC_BOLT', 'WARD', 'COMPOSE']), passiveLuck: publicPassive(o.passiveLuck),
  playerActions: o.playerActions.map(a => fields(a, ['label', 'selfGain', 'enemyReduction', 'threatens', 'order', 'id', 'paidCost', 'luckCost', 'physicalFactor', 'checkChance', 'checkRoll', 'resistedByComposure', 'succeeded'])),
  enemyActions: o.enemyActions.map(a => fields(a, ['label', 'selfGain', 'enemyReduction', 'threatens', 'order', 'planned', 'actual', 'paidCost', 'physicalFactor', 'staggerApplied'])),
}; }
export type MisfortuneMagePublicRoundOutcome = ReturnType<typeof projectMisfortuneMageRoundOutcome>;
export function projectChaosWalkerRoundOutcome(o: ChaosWalkerRoundOutcome): Omit<ChaosWalkerRoundOutcome, 'source'> { return {
  ...fields(o, ['targetId', 'round', 'stance', 'winnerPolicy', 'continuing', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'enemyRiskAfter', 'playerSpiritualityBefore', 'playerSpiritualityAfter', 'playerHealthAfter', 'playerMindAfter', 'enemySpiritualityBefore', 'luckStoredAfter', 'luckSpentAfter', 'lastLuckRound', 'luckAttempts', 'deviationAttempts', 'impedimentAttempts', 'pendingKind', 'composureReady', 'elapsedSeconds', 'lifeClockSecondsBefore', 'lifeClockSecondsAfter', 'exitSeconds', 'weaponLocation']),
  enemyInjuriesAfter: o.enemyInjuriesAfter.map(publicPryerInjury), powerUses: fields(o.powerUses, ['ARC_BOLT', 'WARD', 'COMPOSE']), passiveLuck: publicPassive(o.passiveLuck), sceneAfter: fields(o.sceneAfter, ['courtId', 'ordinaryExit', 'thirdPartiesInArea', 'clearanceConfirmed', 'playerPosition', 'distanceMetres', 'exitMetres', 'ordinaryWalkedMetres']),
  playerActions: o.playerActions.map(a => ({ ...fields(a, ['label', 'selfGain', 'enemyReduction', 'threatens', 'order', 'id', 'paidCost', 'luckCost', 'physicalFactor', 'spiritualityBefore', 'spiritualityAfter', 'checkChance', 'checkRoll', 'checkTier', 'resistedByComposure', 'succeeded']), luckBefore: publicMercurySnakeLuck(a.luckBefore), luckAfter: publicMercurySnakeLuck(a.luckAfter) })),
  enemyActions: o.enemyActions.map(a => fields(a, ['label', 'selfGain', 'enemyReduction', 'threatens', 'order', 'planned', 'actual', 'paidCost', 'physicalFactor', 'spiritualityBefore', 'spiritualityAfter', 'rawContribution', 'pendingApplied'])),
}; }
export type ChaosWalkerPublicRoundOutcome = ReturnType<typeof projectChaosWalkerRoundOutcome>;
export function projectFateProphetAction(a: FateProphetActionEvidence): Omit<FateProphetActionEvidence, 'randomCursorBefore' | 'randomCursorAfter'> { return {
  ...fields(a, ['order', 'actor', 'id', 'planned', 'selectedAbility', 'fallbackReason', 'mode', 'label', 'selfGain', 'enemyReduction', 'threatens', 'mentalPressure', 'attackKind', 'rawContribution', 'paidCost', 'mindCost', 'luckCost', 'physicalFactor', 'succeeded', 'resisted', 'pendingBefore', 'pendingAfter', 'pendingApplied', 'atSeconds', 'elapsedSeconds', 'travelMetres', 'playerMindAfter', 'playerSpiritualityAfter', 'enemySpiritualityAfter']),
  check: publicPryerCheck(a.check), luckAfter: publicMercurySnakeLuck(a.luckAfter),
}; }
export function projectFateProphetRoundOutcome(o: FateProphetRoundOutcome) { return {
  ...fields(o, ['targetId', 'round', 'stance', 'winnerPolicy', 'continuing', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'enemyRisk', 'weaponLocation', 'pendingKind', 'composureReady', 'lastLuckRound', 'luckAttempts', 'foresightAttempts', 'hazardAttempts', 'deviationAttempts', 'impedimentAttempts', 'playerHealthAfter', 'playerMindAfter', 'playerSpiritualityAfter', 'playerRiskAfter', 'elapsedSeconds', 'expiredPending']),
  enemyInjuries: o.enemyInjuries.map(publicPryerInjury), playerInjuriesAfter: o.playerInjuriesAfter.map(publicPryerInjury), powerUses: fields(o.powerUses, ['ARC_BOLT', 'WARD', 'COMPOSE']), luckAfter: publicMercurySnakeLuck(o.luckAfter), rootAfter: publicWheelOriginalSite(o.rootAfter), passiveLuck: publicPassive(o.passiveLuck),
  playerActions: o.playerActions.map(projectFateProphetAction), enemyActions: o.enemyActions.map(projectFateProphetAction),
}; }
export type FateProphetPublicRoundOutcome = ReturnType<typeof projectFateProphetRoundOutcome>;

/** Only these four outcome shapes are reachable in the genuine 204 inherited history. */
export type MercurySnakeInheritedPublicCombatRound = Omit<SliceCombatRound, 'mercurySnakeOutcome' | 'fateProphetOutcome' | 'chaosWalkerOutcome' | 'misfortuneMageOutcome'> & {
  mercurySnakeOutcome?: ReturnType<typeof projectMercurySnakeRoundOutcome>; fateProphetOutcome?: FateProphetPublicRoundOutcome;
  chaosWalkerOutcome?: ChaosWalkerPublicRoundOutcome; misfortuneMageOutcome?: MisfortuneMagePublicRoundOutcome;
};
export function projectMercurySnakeCombatRound(round: SliceCombatRound): MercurySnakeInheritedPublicCombatRound;
export function projectMercurySnakeCombatRound(round: SliceCombatRound | null): MercurySnakeInheritedPublicCombatRound | null;
export function projectMercurySnakeCombatRound(round: SliceCombatRound | null): MercurySnakeInheritedPublicCombatRound | null {
  if (!round) return null;
  const { mercurySnakeOutcome, fateProphetOutcome, chaosWalkerOutcome, misfortuneMageOutcome, ...facts } = structuredClone(round);
  return { ...facts, ...(mercurySnakeOutcome ? { mercurySnakeOutcome: projectMercurySnakeRoundOutcome(mercurySnakeOutcome) } : {}), ...(fateProphetOutcome ? { fateProphetOutcome: projectFateProphetRoundOutcome(fateProphetOutcome) } : {}), ...(chaosWalkerOutcome ? { chaosWalkerOutcome: projectChaosWalkerRoundOutcome(chaosWalkerOutcome) } : {}), ...(misfortuneMageOutcome ? { misfortuneMageOutcome: projectMisfortuneMageRoundOutcome(misfortuneMageOutcome) } : {}) };
}
/** Display the resolved receipt only while it still owns the exact latest check. */
export function projectMercurySnakeLastCheck(s: SliceState) {
  const current = s.lastCheck, event = [...s.mercurySnake.acquisitionJournal].reverse().find(e => e.command.type === 'CONSUME');
  if (!current || !event?.check || event.revision >= s.revision || event.randomBefore === null || event.randomBefore !== event.cursorBefore || event.randomAfter !== event.randomBefore + 1 || event.randomAfter !== event.cursorAfter || event.randomAfter !== s.random.cursor) return publicPryerCheck(current);
  const raw = resolveNormalCheck({ ability: 'will', baseAbility: event.before.coreStats.will, difficulty: 30, modifiers: [], roll: event.check.roll });
  return publicPryerCheck(stableStringify(current) === stableStringify(raw) ? event.check : current);
}
