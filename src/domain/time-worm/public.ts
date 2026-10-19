import type { PublicCheckResult } from '../../shared/contracts.js';
import { projectFateTrojanDate, projectFateTrojanInjury, projectFateTrojanSite } from '../fate-trojan/public.js';
import { TIME_WORM_INHERITED_SKILL_IDS, TIME_WORM_NEW_ABILITY_IDS } from './combat.js';
import type { TimeWormActionEvidence, TimeWormDelayEvidence, TimeWormPendingAction, TimeWormRoundOutcome, TimeWormWaitEvidence, TimeWormWindow, TimeWormWindows } from './combat.js';
import type { TimeWormCombatBody, TimeWormMaterials, TimeWormScene } from './encounter.js';
import type { TimeWormActivityCommand, TimeWormLifeBudget, TimeWormLifeReceipt } from './life.js';

/** Positive nested allowlists retain actual checks, costs, movement and finite effects. */
const publicCheck = (c: PublicCheckResult | null): PublicCheckResult | null => c ? ({
  ability: c.ability, baseAbility: c.baseAbility, modifiers: c.modifiers.map(m => ({ source: m.source, value: m.value })),
  effectiveAbility: c.effectiveAbility, difficulty: c.difficulty, chance: c.chance, roll: c.roll, tier: c.tier,
}) : null;
export const projectTimeWormMaterials = (m: TimeWormMaterials) => ({
  weapon: { id: m.weapon.id, sourceId: m.weapon.sourceId, owner: m.weapon.owner, massKg: m.weapon.massKg, location: m.weapon.location, condition: m.weapon.condition, visible: m.weapon.visible },
  marks: m.marks.map(p => ({ id: p.id, owner: p.owner, status: p.status, usedRound: p.usedRound })),
});
export const projectTimeWormScene = (p: TimeWormScene) => ({
  siteId: p.siteId, playerLocation: p.playerLocation, playerCoordinate: p.playerCoordinate, enemyCoordinate: p.enemyCoordinate,
  ordinaryExit: p.ordinaryExit, visibleBodyLine: p.visibleBodyLine, conditionVersion: p.conditionVersion,
  observedConditionVersion: p.observedConditionVersion, thirdPartiesInArea: p.thirdPartiesInArea,
  presentMemberIds: [...p.presentMemberIds], observedSourceId: p.observedSourceId, observationWeek: p.observationWeek,
  clockSeconds: p.clockSeconds, externalSeconds: p.externalSeconds, playerTravelMetres: p.playerTravelMetres,
  enemyTravelMetres: p.enemyTravelMetres, knownPlayerName: p.knownPlayerName, knownEnemyName: p.knownEnemyName,
});
export const projectTimeWormPowerUses = (p: TimeWormCombatBody['powerUses']) => ({ BODY_MARK: p.BODY_MARK, MENTAL_MARK: p.MENTAL_MARK, FEINT: p.FEINT });
const publicWindow = (w: TimeWormWindow) => ({
  id: w.id, kind: w.kind, createdAt: w.createdAt, expiresAt: w.expiresAt, openedOrder: w.openedOrder,
  conditionVersion: w.conditionVersion, targetActionId: w.targetActionId, targetId: w.targetId,
  enemyCoordinate: w.enemyCoordinate, playerCoordinate: w.playerCoordinate, magnitude: w.magnitude, sourceTheftId: w.sourceTheftId,
});
const publicWindows = (w: TimeWormWindows) => ({ shortTimeTheft: w.shortTimeTheft ? publicWindow(w.shortTimeTheft) : null, timeRelease: w.timeRelease ? publicWindow(w.timeRelease) : null });
const publicPending = (p: TimeWormPendingAction | null) => p ? ({
  id: p.id, planned: p.planned, actual: p.actual, declaredAt: p.declaredAt, scheduledAt: p.scheduledAt, dueAt: p.dueAt,
  observedAt: p.observedAt, observationSeconds: p.observationSeconds, conditionVersion: p.conditionVersion, visible: p.visible,
  targetId: p.targetId, enemyCoordinate: p.enemyCoordinate, playerCoordinate: p.playerCoordinate, attackKind: p.attackKind,
  status: p.status, theftOrder: p.theftOrder, heldFrom: p.heldFrom, delayedBySeconds: p.delayedBySeconds,
}) : null;
const publicDelay = (d: TimeWormDelayEvidence) => ({ targetActionId: d.targetActionId, theftOrder: d.theftOrder, scheduledAt: d.scheduledAt,
  heldFrom: d.heldFrom, dueAt: d.dueAt, executedAt: d.executedAt, delayedBySeconds: d.delayedBySeconds, reduction: d.reduction, conditionMatched: d.conditionMatched });
const publicWait = (w: TimeWormWaitEvidence) => ({ fromSeconds: w.fromSeconds, toSeconds: w.toSeconds, seconds: w.seconds, reason: w.reason, targetActionId: w.targetActionId });
export function projectTimeWormAction(a: TimeWormActionEvidence) { return {
  order: a.order, actor: a.actor, id: a.id, planned: a.planned, selectedAbility: a.selectedAbility, fallbackReason: a.fallbackReason,
  label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: a.mentalPressure,
  attackKind: a.attackKind, rawContribution: a.rawContribution, rawReduction: a.rawReduction, paidCost: a.paidCost, mindCost: a.mindCost,
  physicalFactor: a.physicalFactor, check: publicCheck(a.check), resistanceRoll: a.resistanceRoll, resistanceChance: a.resistanceChance,
  succeeded: a.succeeded, finiteResult: a.finiteResult, windowsBefore: publicWindows(a.windowsBefore), windowsAfter: publicWindows(a.windowsAfter),
  pendingBefore: publicPending(a.pendingBefore), pendingAfter: publicPending(a.pendingAfter), masteryApplied: [...a.masteryApplied], countered: [...a.countered],
  consumedMarkId: a.consumedMarkId, materialsBefore: projectTimeWormMaterials(a.materialsBefore), materialsAfter: projectTimeWormMaterials(a.materialsAfter),
  targetDelay: a.targetDelay ? publicDelay(a.targetDelay) : null, consumedReserveId: a.consumedReserveId,
  conditionVersionBefore: a.conditionVersionBefore, conditionVersionAfter: a.conditionVersionAfter, atSeconds: a.atSeconds,
  completedAtSeconds: a.completedAtSeconds, elapsedSeconds: a.elapsedSeconds, travelMetres: a.travelMetres,
  travelPath: [...a.travelPath], lateralTravelPath: [...a.lateralTravelPath], playerMindAfter: a.playerMindAfter,
  playerSpiritualityAfter: a.playerSpiritualityAfter, enemyMindAfter: a.enemyMindAfter, enemySpiritualityAfter: a.enemySpiritualityAfter,
}; }
export type TimeWormPublicActionEvidence = ReturnType<typeof projectTimeWormAction>;
export function projectTimeWormRoundOutcome(o: TimeWormRoundOutcome) { return {
  enemyHealth: o.enemyHealth, enemyMind: o.enemyMind, enemySpirituality: o.enemySpirituality, enemyStatus: o.enemyStatus,
  enemyInjuries: o.enemyInjuries.map(projectFateTrojanInjury), enemyRisk: o.enemyRisk, weaponLocation: o.weaponLocation,
  powerUses: projectTimeWormPowerUses(o.powerUses),
  observations: o.observations.map(p => ({ power: p.power, conditionVersion: p.conditionVersion, round: p.round, order: p.order, atSeconds: p.atSeconds, paidCost: p.paidCost })),
  totalOwnerMindSpent: o.totalOwnerMindSpent, shortTimeTheftAttempts: o.shortTimeTheftAttempts,
  shortTimeTheftChecks: o.shortTimeTheftChecks, shortTimeTheftSuccesses: o.shortTimeTheftSuccesses,
  timeReleaseAttempts: o.timeReleaseAttempts, timeReleaseChecks: o.timeReleaseChecks, timeReleaseSuccesses: o.timeReleaseSuccesses,
  inheritedSuccesses: { deepDeception: o.inheritedSuccesses.deepDeception },
  targetId: o.targetId, round: o.round, stance: o.stance, continuing: o.continuing,
  playerHealthAfter: o.playerHealthAfter, playerMindAfter: o.playerMindAfter, playerSpiritualityAfter: o.playerSpiritualityAfter,
  playerInjuriesAfter: o.playerInjuriesAfter.map(projectFateTrojanInjury), playerRiskAfter: o.playerRiskAfter,
  materialsAfter: projectTimeWormMaterials(o.materialsAfter),
  masteryAfter: Object.fromEntries([...TIME_WORM_INHERITED_SKILL_IDS, ...TIME_WORM_NEW_ABILITY_IDS].filter(id => Object.hasOwn(o.masteryAfter, id)).map(id => [id, o.masteryAfter[id]!])),
  rootAfter: projectTimeWormScene(o.rootAfter), elapsedSeconds: o.elapsedSeconds,
  playerActions: o.playerActions.map(projectTimeWormAction), enemyActions: o.enemyActions.map(projectTimeWormAction),
  expiredWindows: o.expiredWindows.map(publicWindow), windowsAfter: publicWindows(o.windowsAfter), pendingEnemyActionAfter: o.pendingEnemyActionAfter,
  waits: o.waits.map(publicWait), targetDelays: o.targetDelays.map(publicDelay),
}; }
export type TimeWormPublicRoundOutcome = ReturnType<typeof projectTimeWormRoundOutcome>;

const publicBudget = (b: TimeWormLifeBudget) => ({ health: b.health, mind: b.mind, spirituality: b.spirituality, cash: b.cash, actions: b.actions });
function publicLifeCommand(c: TimeWormActivityCommand): TimeWormActivityCommand {
  if ('method' in c) return { type: c.type, caseId: c.caseId, method: c.method };
  if ('permission' in c) return { type: c.type, permission: c.permission };
  if ('caseId' in c) return { type: c.type, caseId: c.caseId };
  return { type: c.type };
}
export function projectTimeWormLifeReceipt(r: TimeWormLifeReceipt) { return {
  week: r.week, date: projectFateTrojanDate(r.date), revision: r.revision, command: publicLifeCommand(r.command),
  checkBase: r.checkBase, check: publicCheck(r.check), outcome: r.outcome,
  before: publicBudget(r.before), after: publicBudget(r.after),
  finance: { weeklyBudget: r.finance.weeklyBudget, lifeTier: r.finance.lifeTier, nextLifeTier: r.finance.nextLifeTier,
    debts: r.finance.debts.map(d => ({ id: d.id, source: d.source, remaining: d.remaining, weeklyPayment: d.weeklyPayment, createdWeek: d.createdWeek })),
    missedWeeks: r.finance.missedWeeks, credit: r.finance.credit },
  elapsedSeconds: r.elapsedSeconds, playerWalkedMetres: r.playerWalkedMetres, linaWalkedMetres: r.linaWalkedMetres, victorWalkedMetres: r.victorWalkedMetres,
  playerEnergySpent: r.playerEnergySpent, linaEnergySpent: r.linaEnergySpent, victorEnergySpent: r.victorEnergySpent, playerEnergyRecovered: r.playerEnergyRecovered,
  moves: r.moves.map(m => ({ actor: m.actor, from: m.from, to: m.to, mode: m.mode, metres: m.metres, seconds: m.seconds, originalBody: m.originalBody })),
  originalsBefore: { site: projectFateTrojanSite(r.originalsBefore.site) }, originalsAfter: { site: projectFateTrojanSite(r.originalsAfter.site) },
}; }
export type TimeWormPublicLifeReceipt = ReturnType<typeof projectTimeWormLifeReceipt>;
