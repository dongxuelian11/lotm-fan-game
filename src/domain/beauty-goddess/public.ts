import type { PublicCheckResult } from '../../shared/contracts.js';
import type { SliceInjury, SliceState, SliceWheelEntry } from '../slice/types.js';
import type { SummoningMasterPartner } from '../summoning-master/life.js';
import type { WitchKingPaper } from '../witch-king/life.js';
import {
  BEAUTY_GODDESS_INHERITED_SKILL_IDS, BEAUTY_GODDESS_NEW_ABILITY_IDS, projectBeautyGoddessCombat,
  type BeautyGoddessActionEvidence, type BeautyGoddessPendingAction, type BeautyGoddessRoundOutcome,
  type BeautyGoddessWindow, type BeautyGoddessWindows,
} from './combat.js';
import type { BeautyGoddessCombatBody, BeautyGoddessMaterials, BeautyGoddessScene } from './encounter.js';

/** Positive nested allowlists keep resolved facts public and replay inputs private. */
const publicInjury = (i: SliceInjury) => ({
  id: i.id, severity: i.severity, acquiredRevision: i.acquiredRevision, treatedRevision: i.treatedRevision,
});
const publicCheck = (c: PublicCheckResult | null): PublicCheckResult | null => c ? ({
  ability: c.ability, baseAbility: c.baseAbility, modifiers: c.modifiers.map(m => ({ source: m.source, value: m.value })),
  effectiveAbility: c.effectiveAbility, difficulty: c.difficulty, chance: c.chance, roll: c.roll, tier: c.tier,
}) : null;
const publicMaterials = (m: BeautyGoddessMaterials) => ({
  weapon: {
    id: m.weapon.id, sourceId: m.weapon.sourceId, owner: m.weapon.owner, massKg: m.weapon.massKg,
    location: m.weapon.location, condition: m.weapon.condition, charge: m.weapon.charge,
    capacity: m.weapon.capacity, visible: m.weapon.visible,
  },
  lamp: m.lamp ? {
    id: m.lamp.id, sourceId: m.lamp.sourceId, owner: m.lamp.owner, paidPennies: m.lamp.paidPennies,
    purchasedWeek: m.lamp.purchasedWeek, location: m.lamp.location, fuelSeconds: m.lamp.fuelSeconds,
    capacitySeconds: m.lamp.capacitySeconds, lit: m.lamp.lit, blocked: m.lamp.blocked,
  } : null,
  pieces: m.pieces.map(p => ({
    id: p.id, sourceId: p.sourceId, owner: p.owner, paidPennies: p.paidPennies, purchasedWeek: p.purchasedWeek,
    status: p.status, location: p.location, spentWeek: p.spentWeek, combatRound: p.combatRound,
  })),
});
const publicScene = (p: BeautyGoddessScene) => ({
  siteId: p.siteId, playerLocation: p.playerLocation, playerCoordinate: p.playerCoordinate, enemyCoordinate: p.enemyCoordinate,
  ordinaryExit: p.ordinaryExit, thirdPartiesInArea: p.thirdPartiesInArea, presentMemberIds: [...p.presentMemberIds],
  observedSourceId: p.observedSourceId, observationWeek: p.observationWeek, clockSeconds: p.clockSeconds,
  externalSeconds: p.externalSeconds, playerTravelMetres: p.playerTravelMetres,
  knownPlayerName: p.knownPlayerName, knownEnemyName: p.knownEnemyName,
});
const publicPaper = (p: WitchKingPaper) => ({
  id: p.id, batch: p.batch, source: p.source, purchasedWeek: p.purchasedWeek, status: p.status,
  preparedWeek: p.preparedWeek, consumedWeek: p.consumedWeek, consumedBy: p.consumedBy, combatRound: p.combatRound,
});
const publicPartner = (p: SummoningMasterPartner) => ({
  id: p.id, name: p.name, source: p.source, adult: p.adult, independentMind: p.independentMind,
  bodyId: p.bodyId, homeId: p.homeId, location: p.location, health: p.health, mind: p.mind,
  stamina: p.stamina, status: p.status, willing: p.willing, metWeek: p.metWeek,
  ordinaryDistanceM: p.ordinaryDistanceM, gateCrossings: p.gateCrossings,
  chime: { id: p.chime.id, owner: p.chime.owner },
  restHistory: p.restHistory.map(r => ({
    week: r.week, paidPennies: r.paidPennies, staminaBefore: r.staminaBefore, staminaAfter: r.staminaAfter,
    mindBefore: r.mindBefore, mindAfter: r.mindAfter, healthUnchanged: r.healthUnchanged,
  })),
});
const publicPowerUses = (p: BeautyGoddessCombatBody['powerUses']) => ({
  MOON_BOLT: p.MOON_BOLT, MIND_PRESSURE: p.MIND_PRESSURE, WARD: p.WARD, ATTENTION: p.ATTENTION, SHADE: p.SHADE,
});
const publicWindow = (w: BeautyGoddessWindow) => ({
  id: w.id, kind: w.kind, createdAt: w.createdAt, expiresAt: w.expiresAt,
  targetActionId: w.targetActionId, magnitude: w.magnitude, pieceId: w.pieceId,
});
const publicWindows = (w: BeautyGoddessWindows) => ({
  moonform: w.moonform ? publicWindow(w.moonform) : null,
  selfPoise: w.selfPoise ? publicWindow(w.selfPoise) : null,
  attention: w.attention ? publicWindow(w.attention) : null,
});
const publicPendingAction = (p: BeautyGoddessPendingAction | null) => p ? ({
  id: p.id, planned: p.planned, actual: p.actual, declaredAt: p.declaredAt, observedAt: p.observedAt,
  observationSeconds: p.observationSeconds, visibleIntent: p.visibleIntent, bodyImpact: p.bodyImpact,
}) : null;
const publicWheel = (w: SliceWheelEntry) => ({ id: w.id, label: w.label, weight: w.weight });

export function projectBeautyGoddessAction(a: BeautyGoddessActionEvidence) { return {
  order: a.order, actor: a.actor, id: a.id, planned: a.planned, selectedAbility: a.selectedAbility,
  fallbackReason: a.fallbackReason, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction,
  threatens: a.threatens, mentalPressure: a.mentalPressure, attackKind: a.attackKind,
  rawContribution: a.rawContribution, rawReduction: a.rawReduction, paidCost: a.paidCost, mindCost: a.mindCost,
  physicalFactor: a.physicalFactor, check: publicCheck(a.check), resistanceRoll: a.resistanceRoll,
  resistanceChance: a.resistanceChance, succeeded: a.succeeded, finiteResult: a.finiteResult,
  windowsBefore: publicWindows(a.windowsBefore), windowsAfter: publicWindows(a.windowsAfter),
  pendingBefore: publicPendingAction(a.pendingBefore), pendingAfter: publicPendingAction(a.pendingAfter),
  masteryApplied: [...a.masteryApplied], countered: [...a.countered], paperId: a.paperId, pieceId: a.pieceId,
  rodChargeSpent: a.rodChargeSpent, materialsBefore: publicMaterials(a.materialsBefore), materialsAfter: publicMaterials(a.materialsAfter),
  atSeconds: a.atSeconds, elapsedSeconds: a.elapsedSeconds, travelMetres: a.travelMetres,
  playerMindAfter: a.playerMindAfter, playerSpiritualityAfter: a.playerSpiritualityAfter,
  enemyMindAfter: a.enemyMindAfter, enemySpiritualityAfter: a.enemySpiritualityAfter,
}; }
export type BeautyGoddessPublicActionEvidence = ReturnType<typeof projectBeautyGoddessAction>;

export function projectBeautyGoddessRoundOutcome(o: BeautyGoddessRoundOutcome) { return {
  enemyHealth: o.enemyHealth, enemyMind: o.enemyMind, enemySpirituality: o.enemySpirituality, enemyStatus: o.enemyStatus,
  enemyInjuries: o.enemyInjuries.map(publicInjury), enemyRisk: o.enemyRisk, weaponLocation: o.weaponLocation,
  powerUses: publicPowerUses(o.powerUses), totalOwnerMindSpent: o.totalOwnerMindSpent,
  selfPoiseAttempts: o.selfPoiseAttempts, selfPoiseSuccesses: o.selfPoiseSuccesses,
  moonformAttempts: o.moonformAttempts, moonformSuccesses: o.moonformSuccesses,
  targetId: o.targetId, round: o.round, stance: o.stance, continuing: o.continuing,
  playerHealthAfter: o.playerHealthAfter, playerMindAfter: o.playerMindAfter, playerSpiritualityAfter: o.playerSpiritualityAfter,
  playerInjuriesAfter: o.playerInjuriesAfter.map(publicInjury), playerRiskAfter: o.playerRiskAfter,
  materialsAfter: publicMaterials(o.materialsAfter), papers: o.papers.map(publicPaper),
  masteryAfter: Object.fromEntries([...BEAUTY_GODDESS_INHERITED_SKILL_IDS, ...BEAUTY_GODDESS_NEW_ABILITY_IDS]
    .filter(id => Object.hasOwn(o.masteryAfter, id)).map(id => [id, o.masteryAfter[id]!])),
  rootAfter: publicScene(o.rootAfter), elapsedSeconds: o.elapsedSeconds,
  playerActions: o.playerActions.map(projectBeautyGoddessAction), enemyActions: o.enemyActions.map(projectBeautyGoddessAction),
  expiredWindows: o.expiredWindows.map(publicWindow), windowsAfter: publicWindows(o.windowsAfter),
  pendingEnemyActionAfter: o.pendingEnemyActionAfter,
}; }
export type BeautyGoddessPublicRoundOutcome = ReturnType<typeof projectBeautyGoddessRoundOutcome>;

export function projectBeautyGoddessPublicCombat(s: SliceState) {
  const p = projectBeautyGoddessCombat(s), c = p.constants;
  return {
    enemyName: p.enemyName, targetId: p.targetId, enemyHealth: p.enemyHealth, enemyMind: p.enemyMind,
    enemySpirituality: p.enemySpirituality, weaponLocation: p.weaponLocation, powerUses: publicPowerUses(p.powerUses),
    policy: p.policy, materials: publicMaterials(p.materials), partner: publicPartner(p.partner), papers: p.papers.map(publicPaper),
    lastActionSequence: p.lastActionSequence.map(projectBeautyGoddessAction),
    constants: {
      weights: { physique: c.weights.physique, perception: c.weights.perception, will: c.weights.will, knowledge: c.weights.knowledge },
      tier: c.tier, floor: c.floor, maxSpirituality: c.maxSpirituality, continuingRecovery: c.continuingRecovery,
      enemyPhysique: c.enemyPhysique, selfPoiseCost: c.selfPoiseCost, selfPoiseMindCost: c.selfPoiseMindCost,
      selfPoiseBonus: c.selfPoiseBonus, moonformCost: c.moonformCost, moonformMindCost: c.moonformMindCost,
      moonformReduction: c.moonformReduction, windowSeconds: c.windowSeconds,
    },
    countWheel: p.countWheel.map(publicWheel), enemyCountWheel: p.enemyCountWheel.map(publicWheel),
    abilityWheel: p.abilityWheel.map(publicWheel), enemyAbilityWheel: p.enemyAbilityWheel.map(publicWheel), facts: [...p.facts],
  };
}
export type BeautyGoddessPublicCombatProjection = ReturnType<typeof projectBeautyGoddessPublicCombat>;
