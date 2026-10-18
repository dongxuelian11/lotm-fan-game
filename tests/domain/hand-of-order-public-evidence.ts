import { expect } from 'vitest';
import type { HandOfOrderRoundOutcome } from '../../src/domain/hand-of-order/combat.js';
import { HAND_OF_ORDER_ABILITY_IDS, HAND_OF_ORDER_INHERITED_ABILITY_IDS } from '../../src/domain/hand-of-order/types.js';

const pick = (raw: unknown, names: string): Record<string, unknown> => {
  const source = raw as Record<string, unknown>; return Object.fromEntries(names.split(' ').map(k => [k, source[k]]));
};
const rows = (raw: unknown, project: (v: unknown) => unknown) => (raw as unknown[]).map(project);
const nullable = (raw: unknown, project: (v: unknown) => unknown) => raw === null ? null : project(raw);
const injury = (v: unknown) => pick(v, 'id severity acquiredRevision treatedRevision');
const plate = (v: unknown) => pick(v, 'id owner holder location integrity acquiredWeek');
const window = (v: unknown) => pick(v, 'kind round order castAt expiresAt remaining supportId');
const pending = (v: unknown) => pick(v, 'id owner kind createdAt expiresAt remaining openingId');
const opening = (v: unknown) => pick(v, 'id targetId sourceOrder createdAt expiresAt kind visible');
const check = (v: unknown) => {
  const raw = v as Record<string, unknown>;
  return { ...pick(v, 'ability baseAbility effectiveAbility difficulty chance roll tier'), modifiers: rows(raw.modifiers, m => pick(m, 'source value')) };
};
const action = (v: unknown) => {
  const raw = v as Record<string, unknown>;
  return { ...pick(v, 'order actor id planned selectedAbility fallbackReason mode label selfGain enemyReduction threatens mentalPressure attackKind rawContribution rawReduction paidCost mindCost physicalFactor succeeded resisted pendingApplied masteryApplied plateWear atSeconds elapsedSeconds travelMetres playerMindAfter playerSpiritualityAfter enemySpiritualityAfter supportId supportWearPaid enemyChargeId resistanceChance resistanceRoll'),
    check: nullable(raw.check, check), pendingBefore: rows(raw.pendingBefore, pending), pendingAfter: rows(raw.pendingAfter, pending),
    openingBefore: nullable(raw.openingBefore, opening), openingAfter: nullable(raw.openingAfter, opening),
    guardPlateBefore: plate(raw.guardPlateBefore), guardPlateAfter: plate(raw.guardPlateAfter), windowGranted: nullable(raw.windowGranted, window),
    windowsApplied: rows(raw.windowsApplied, w => pick(w, 'kind amount supportId')), windowsExpired: rows(raw.windowsExpired, window), windowsCancelled: rows(raw.windowsCancelled, window) };
};
/** Independent positive projection specification. No production projector or regex denylist is reused. */
export function expectedPublicHandOfOrderOutcome(o: HandOfOrderRoundOutcome): unknown {
  return { ...pick(o, 'enemyHealth enemyMind enemySpirituality enemyStatus enemyRisk weaponLocation pendingKind composureReady imbalanceAttempts resistanceAttempts intimidationAttempts deprivationAttempts divisionAttempts aftermathAttempts divisionApplications aftermathApplications enemyTravelMetres targetId round stance continuing playerHealthAfter playerMindAfter playerSpiritualityAfter playerRiskAfter elapsedSeconds'),
    enemyInjuries: o.enemyInjuries.map(injury), powerUses: pick(o.powerUses, 'ARC_BOLT WARD COMPOSE MENTAL_PRESSURE'),
    supportPieces: o.supportPieces.map(p => pick(p, 'id ownerId location quantity status wear usedRound usedOrder')),
    enemyCharges: o.enemyCharges.map(c => pick(c, 'id ownerId status usedRound usedOrder')),
    division: nullable(o.division, window), aftermath: nullable(o.aftermath, window), playerInjuriesAfter: o.playerInjuriesAfter.map(injury),
    guardPlateAfter: plate(o.guardPlateAfter), masteryAfter: Object.fromEntries([...HAND_OF_ORDER_INHERITED_ABILITY_IDS, ...HAND_OF_ORDER_ABILITY_IDS].map(id => [id, o.masteryAfter[id] ?? 0])),
    siteAfter: { ...pick(o.siteAfter, 'siteId playerLocation playerTravelMetres guideTravelMetres clockSeconds'),
      guide: pick(o.siteAfter.guide, 'id name location'), volunteer: { ...pick(o.siteAfter.volunteer, 'id name age alive independentMind willing location health mind'), injuries: o.siteAfter.volunteer.injuries.map(injury) },
      parcel: pick(o.siteAfter.parcel, 'id owner quantity massGrams sealed confidential holder location handovers returns'),
      line: pick(o.siteAfter.line, 'id owner quantity holder location isWall returns'), paper: pick(o.siteAfter.paper, 'id owner quantity holder location text'), table: pick(o.siteAfter.table, 'id location thirdParties') },
    operationAfter: pick(o.operationAfter, 'door'), playerActions: o.playerActions.map(action), enemyActions: o.enemyActions.map(action),
    expiredPending: o.expiredPending.map(pending), expiredWindows: o.expiredWindows.map(window), cancelledWindows: o.cancelledWindows.map(window) };
}
/** source is permitted only as a public check modifier label; sourceOrder is a distinct public causal field. */
export function assertNoPrivateHandOfOrderFields(value: unknown, path: string[] = []): void {
  if (Array.isArray(value)) { value.forEach((v, i) => assertNoPrivateHandOfOrderFields(v, [...path, String(i)])); return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    expect(['seed', 'cursor', 'randomSeed', 'randomCursor', 'randomCursorBefore', 'randomCursorAfter', 'randomBefore', 'randomAfter', 'cursorBefore', 'cursorAfter', 'preparationRoll', 'sourceHistory', 'sourceScene', 'journal', 'acquisitionJournal', '__privateCaptureProbe'], [...path, key].join('.')).not.toContain(key);
    if (key === 'source') { expect(path.at(-2)).toBe('modifiers'); expect(typeof child).toBe('string'); }
    assertNoPrivateHandOfOrderFields(child, [...path, key]);
  }
}
/** Only a detached projection-fault-injection copy is decorated. Captured source and RNG are never changed. */
export function decoratePrivateProbe(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(decoratePrivateProbe); return; }
  Object.values(value).forEach(decoratePrivateProbe);
  Object.assign(value, { __privateCaptureProbe: 'must-not-project', seed: 'private-probe', cursor: 90909, preparationRoll: 88 });
}
