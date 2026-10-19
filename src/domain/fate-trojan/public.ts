import type { PublicGameDate } from '../../shared/contracts.js';
import type { SliceInjury, SliceWheelEntry } from '../slice/types.js';
import type { FateTrojanEnemyAction, FateTrojanPlayerAction, FateTrojanRoundOutcome } from './combat.js';
import type { FateTrojanSiteState } from './life.js';

/** Resolved facts only. Replay sources and random-stream positions stay private. */
export const projectFateTrojanInjury = (i: SliceInjury) => ({ id: i.id, severity: i.severity, acquiredRevision: i.acquiredRevision, treatedRevision: i.treatedRevision });
export const projectFateTrojanDate = (d: PublicGameDate): PublicGameDate => ({ epoch: d.epoch, year: d.year, month: d.month, day: d.day });
export const projectFateTrojanWheel = (w: SliceWheelEntry) => ({ id: w.id, label: w.label, weight: w.weight });
export const projectFateTrojanPowerUses = (p: FateTrojanRoundOutcome['powerUses']) => ({ FORCE_STRIKE: p.FORCE_STRIKE, GUARD: p.GUARD, DISCERN: p.DISCERN });
export function projectFateTrojanSite(p: FateTrojanSiteState): FateTrojanSiteState { return {
  siteId: p.siteId, introducedWeek: p.introducedWeek, introducedDate: p.introducedDate ? projectFateTrojanDate(p.introducedDate) : null,
  clockSeconds: p.clockSeconds, playerLocation: p.playerLocation, playerTravelMetres: p.playerTravelMetres, playerEnergy: p.playerEnergy,
  lina: { id: p.lina.id, name: p.lina.name, age: p.lina.age, alive: p.lina.alive, location: p.lina.location, energy: p.lina.energy, travelMetres: p.lina.travelMetres },
  victor: { id: p.victor.id, name: p.victor.name, age: p.victor.age, alive: p.victor.alive, location: p.victor.location, energy: p.victor.energy, travelMetres: p.victor.travelMetres },
  cabinet: { id: p.cabinet.id, ownerId: p.cabinet.ownerId, quantity: p.cabinet.quantity, location: p.cabinet.location,
    recognitionHolder: p.cabinet.recognitionHolder, open: p.cabinet.open, playerOpenings: p.cabinet.playerOpenings, ownerOpenings: p.cabinet.ownerOpenings },
  parcel: { id: p.parcel.id, ownerId: p.parcel.ownerId, quantity: p.parcel.quantity, location: p.parcel.location, ordinaryMetres: p.parcel.ordinaryMetres, carriedBy: p.parcel.carriedBy },
  link: { id: p.link.id, ownerId: p.link.ownerId, holder: p.link.holder, returnPending: p.link.returnPending, windowExpiresAt: p.link.windowExpiresAt },
  fate: { id: p.fate.id, parcelId: p.fate.parcelId, originalDebtor: p.fate.originalDebtor, debtor: p.fate.debtor, from: p.fate.from, to: p.fate.to,
    status: p.fate.status, offeredPennies: p.fate.offeredPennies, escrowPennies: p.fate.escrowPennies, benefitRecipient: p.fate.benefitRecipient,
    paidToPlayer: p.fate.paidToPlayer, ownerRelieved: p.fate.ownerRelieved, burdenHealth: p.fate.burdenHealth, burdenEnergy: p.fate.burdenEnergy,
    incurredHealth: p.fate.incurredHealth, incurredEnergy: p.fate.incurredEnergy },
  seals: p.seals.map(s => ({ id: s.id, caseId: s.caseId, ownerId: s.ownerId, quantity: s.quantity, charges: s.charges,
    location: s.location, paidPennies: s.paidPennies, preparedWeek: s.preparedWeek })),
}; }
function projectActionFacts(a: FateTrojanPlayerAction | FateTrojanEnemyAction) { return {
  label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: a.mentalPressure,
  order: a.order, atSeconds: a.atSeconds, elapsedSeconds: a.elapsedSeconds, paidCost: a.paidCost, healthPaid: a.healthPaid,
  physicalFactor: a.physicalFactor, rolls: [...a.rolls], playerHealthAfter: a.playerHealthAfter,
  playerSpiritualityAfter: a.playerSpiritualityAfter, enemySpiritualityAfter: a.enemySpiritualityAfter,
  chargeGranted: a.chargeGranted, chargeConsumedByOrder: a.chargeConsumedByOrder, chargeCancelledByOrder: a.chargeCancelledByOrder,
  appliedAmount: a.appliedAmount, consumedIdentityOrder: a.consumedIdentityOrder, consumedFateOrder: a.consumedFateOrder, consumedGuardOrder: a.consumedGuardOrder,
}; }
export function projectFateTrojanPlayerAction(a: FateTrojanPlayerAction) { return {
  ...projectActionFacts(a), id: a.id, attempted: a.attempted, succeeded: a.succeeded, applied: a.applied, fallback: a.fallback,
}; }
export function projectFateTrojanEnemyAction(a: FateTrojanEnemyAction) { return {
  ...projectActionFacts(a), planned: a.planned, actual: a.actual, attackKind: a.attackKind,
}; }
export function projectFateTrojanRoundOutcome(o: FateTrojanRoundOutcome) { return {
  targetId: o.targetId, round: o.round, stance: o.stance, continuing: o.continuing,
  enemyHealth: o.enemyHealth, enemyMind: o.enemyMind, enemySpirituality: o.enemySpirituality, enemyStatus: o.enemyStatus,
  playerSpiritualityBefore: o.playerSpiritualityBefore, playerSpiritualityAfter: o.playerSpiritualityAfter,
  playerHealthAfter: o.playerHealthAfter, playerMindAfter: o.playerMindAfter, enemySpiritualityBefore: o.enemySpiritualityBefore,
  playerInjuriesAfter: o.playerInjuriesAfter.map(projectFateTrojanInjury), enemyInjuriesAfter: o.enemyInjuriesAfter.map(projectFateTrojanInjury),
  playerRiskAfter: o.playerRiskAfter, enemyRiskAfter: o.enemyRiskAfter, powerUses: projectFateTrojanPowerUses(o.powerUses),
  identityAttempted: o.identityAttempted, fateAttempted: o.fateAttempted, guardAttempted: o.guardAttempted,
  expiredIdentityOrder: o.expiredIdentityOrder, expiredFateOrder: o.expiredFateOrder, expiredGuardOrder: o.expiredGuardOrder,
  pendingIdentityAfter: o.pendingIdentityAfter, pendingFateAfter: o.pendingFateAfter, pendingGuardAfter: o.pendingGuardAfter,
  healthPaid: o.healthPaid, clockSecondsAfter: o.clockSecondsAfter, elapsedSeconds: o.elapsedSeconds,
  playerActions: o.playerActions.map(projectFateTrojanPlayerAction), enemyActions: o.enemyActions.map(projectFateTrojanEnemyAction),
}; }
export type FateTrojanPublicRoundOutcome = ReturnType<typeof projectFateTrojanRoundOutcome>;
