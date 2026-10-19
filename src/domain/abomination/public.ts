import { publicPryerFields as fields, publicPryerInjury } from '../sage/life.js';
import { ABOMINATION_ABILITY_IDS } from './types.js';
import { ANCIENT_EVIL_PUBLIC_MASTERY_IDS, publicAncientEvilBlock, publicAncientEvilOperation, publicChainedOriginalSite, publicChainedReflection } from '../ancient-evil/public.js';
import type { AbominationOriginals } from './types.js';
import type { AbominationCombatBody, AbominationCombatPiece, AbominationEncounterBudget, AbominationFinanceSnapshot, AbominationForceReceipt, AbominationPlate, AbominationWindow } from './encounter.js';
import type { AbominationAttempt, AbominationCue, AbominationLifeWindow, AbominationPiece, AbominationPulse } from './life.js';
export { publicAncientEvilOperation, publicChainedOriginalSite };
const masteryIds = [...ANCIENT_EVIL_PUBLIC_MASTERY_IDS, ...ABOMINATION_ABILITY_IDS];
export const publicAbominationMastery = (m: Record<string, number>): Record<string, number> => Object.fromEntries(masteryIds.filter(id => Object.hasOwn(m, id)).map(id => [id, m[id]!]));
export function publicAbominationBudget(b: AbominationEncounterBudget): AbominationEncounterBudget { return {
  ...fields(b, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'gender', 'sequence', 'acting', 'injuryRisk']), coreStats: fields(b.coreStats, ['physique', 'perception', 'will', 'knowledge']),
  mastery: publicAbominationMastery(b.mastery), completedSources: [...b.completedSources], injuries: b.injuries.map(publicPryerInjury),
}; }
export function publicAbominationFinance(f: AbominationFinanceSnapshot): AbominationFinanceSnapshot { return {
  ...fields(f, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'missedWeeks', 'credit']), debts: f.debts.map(d => fields(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek'])),
}; }
export function publicAbominationOriginals(o: AbominationOriginals): AbominationOriginals { return { site: publicChainedOriginalSite(o.site), operation: publicAncientEvilOperation(o.operation), blocks: o.blocks.map(publicAncientEvilBlock) }; }
export const publicAbominationPiece = (p: AbominationCombatPiece): AbominationCombatPiece => fields(p, ['id', 'ownerId', 'location', 'quantity', 'initialCharges', 'charges', 'wear', 'paidPennies']);
export const publicAbominationPlate = (p: AbominationPlate): AbominationPlate => fields(p, ['id', 'ownerId', 'status', 'usedRound', 'usedOrder']);
export const publicAbominationForceReceipt = (r: AbominationForceReceipt): AbominationForceReceipt => fields(r, ['id', 'targetId', 'power', 'kind', 'plateId', 'paidCost', 'round', 'order', 'atSeconds', 'position', 'visible', 'conditionVersion']);
export const publicAbominationWindow = (w: AbominationWindow): AbominationWindow => fields(w, ['kind', 'round', 'order', 'castAt', 'expiresAt', 'conditionVersion']);
export function publicAbominationBody(b: AbominationCombatBody): AbominationCombatBody { return {
  ...fields(b, ['enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'enemyRisk', 'weaponLocation', 'enemyForm', 'enemyFormUntilSeconds', 'emotion', 'form', 'formUntilSeconds', 'link', 'linkRound', 'lastFormRound', 'contactAttempts', 'contactDistanceMetres', 'formAttempts', 'transfigurationAttempts', 'transfigurationSuccesses', 'pickUpUses', 'conditionVersion', 'repositionUses', 'hesitationSeconds', 'barrierApplications', 'cryApplications']),
  enemyInjuries: b.enemyInjuries.map(publicPryerInjury), reflectionHistory: b.reflectionHistory.map(publicChainedReflection), blocks: b.blocks.map(publicAncientEvilBlock), powerUses: fields(b.powerUses, ['MIND_SPIKE', 'WARD', 'CALM']),
  plates: b.plates.map(publicAbominationPlate), piece: b.piece ? publicAbominationPiece(b.piece) : null, lastForceReceipt: b.lastForceReceipt ? publicAbominationForceReceipt(b.lastForceReceipt) : null,
  barrier: b.barrier ? publicAbominationWindow(b.barrier) : null, cry: b.cry ? publicAbominationWindow(b.cry) : null,
}; }
export const publicAbominationLifePiece = (p: AbominationPiece): AbominationPiece => fields(p, ['id', 'caseId', 'kind', 'ownerId', 'quantity', 'status', 'location', 'charges', 'wear', 'paidPennies', 'boughtWeek', 'travelMetres', 'testSourceId', 'testCharges', 'testUses']);
export const publicAbominationPulse = (p: AbominationPulse): AbominationPulse => fields(p, ['id', 'pieceId', 'sourceId', 'targetId', 'kind', 'pressure', 'createdAt', 'consumedAt', 'resolved']);
export const publicAbominationCue = (c: AbominationCue): AbominationCue => fields(c, ['id', 'pieceId', 'sourceId', 'actorId', 'bodyId', 'kind', 'location', 'createdAt', 'delayImposedSeconds', 'delayRemainingSeconds', 'executed', 'executedAt']);
export const publicAbominationLifeWindow = (w: AbominationLifeWindow): AbominationLifeWindow => fields(w, ['abilityId', 'caseId', 'pieceId', 'trayId', 'sourceId', 'targetId', 'location', 'permissionVersion', 'conditionVersion', 'createdAt', 'expiresAt', 'pulseId']);
export function publicAbominationAttempt(a: AbominationAttempt): AbominationAttempt { return {
  ...fields(a, ['week', 'method', 'closed', 'stopped', 'returned', 'withdrawn', 'elapsedSeconds', 'playerTravelMetres', 'volunteerTravelMetres', 'spiritualitySpent', 'mindSpent', 'volunteerEffortSpent', 'penniesSpent', 'pieceId', 'readTray', 'readOriginal', 'piecePlaced', 'pulsePrepared', 'cuePrepared', 'castTier', 'resistanceRoll', 'resisted', 'checkTier', 'checkBase', 'baselinePressure', 'feltPressure', 'applicationDone', 'verified', 'manual', 'waits', 'windowEnd', 'result']),
  appliedAbilityIds: [...a.appliedAbilityIds], siteAtStart: publicChainedOriginalSite(a.siteAtStart), siteAtClose: a.siteAtClose ? publicChainedOriginalSite(a.siteAtClose) : null,
}; }
