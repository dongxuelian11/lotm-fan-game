import { expect } from 'vitest';
import type { NatureWalkerRoundOutcome } from '../../src/domain/nature-walker/combat.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import { NATURE_WALKER_ABILITY_IDS, NATURE_WALKER_INHERITED_ABILITY_IDS } from '../../src/domain/nature-walker/types.js';

const pick = (raw: unknown, names: string): Record<string, unknown> => {
  const source = raw as Record<string, unknown>; return Object.fromEntries(names.split(' ').map(k => [k, source[k]]));
};
const rows = (raw: unknown, project: (v: unknown) => unknown) => (raw as unknown[]).map(project);
const nullable = (raw: unknown, project: (v: unknown) => unknown) => raw === null ? null : project(raw);
const injury = (v: unknown) => pick(v, 'id severity acquiredRevision treatedRevision');
const pad = (v: unknown) => pick(v, 'id sourceId material quantity owner holder location integrity acquiredWeek');
const window = (v: unknown) => pick(v, 'kind round order castAt expiresAt remaining supportId');
const pending = (v: unknown) => pick(v, 'id owner kind createdAt expiresAt remaining guardSegmentId');
const check = (v: unknown) => {
  const raw = v as Record<string, unknown>;
  return { ...pick(v, 'ability baseAbility effectiveAbility difficulty chance roll tier'), modifiers: rows(raw.modifiers, m => pick(m, 'source value')) };
};
const guard = (v: unknown) => {
  const raw = v as Record<string, unknown>;
  return { ...pick(v, 'id sourceId prepared owner location preparedWeek actionsSpent costPence spiritualitySpent'), segments: rows(raw.segments, p => pick(p, 'id status')) };
};
const adult = (v: unknown) => ({ ...pick(v, 'id name age alive independentMind location health mind consent'), injuries: rows((v as Record<string, unknown>).injuries, injury) });
const site = (v: unknown) => {
  const raw = v as Record<string, unknown>, paper = raw.paper as Record<string, unknown>;
  return { ...pick(v, 'siteId playerLocation playerTravelMetres clockSeconds externalSeconds'), owner: adult(raw.owner), recipient: adult(raw.recipient),
    samples: rows(raw.samples, s => pick(s, 'id caseId owner origin quantity massGrams originalAlive originalVitality alive vitality maximumVitality holder location care handovers returns')),
    paper: { ...pick(paper, 'id owner holder location text readings'), sampleIds: [...paper.sampleIds as unknown[]], records: [...paper.records as unknown[]] },
    kit: pick(raw.kit, 'sourceId purchased purchasedWeek actionsSpent costPence'), box: pick(raw.box, 'id owner holder location quantity maximumMassGrams capacity sampleId returns'),
    tag: pick(raw.tag, 'id owner holder location quantity returns'), pads: rows(raw.pads, p => pick(p, 'id sourceId owner holder location quantity status caseId spentWeek')), guard: guard(raw.guard) };
};
const action = (v: unknown) => {
  const raw = v as Record<string, unknown>;
  return { ...pick(v, 'order actor id planned selectedAbility fallbackReason mode label selfGain enemyReduction threatens mentalPressure attackKind rawContribution rawReduction paidCost mindCost physicalFactor succeeded resisted pendingApplied masteryApplied padWear guardSegmentId playerHealthBefore playerHealthAfter recoveredHealth distanceBeforeMetres contactDistanceMetres distanceAfterMetres atSeconds elapsedSeconds travelMetres playerMindAfter playerSpiritualityAfter enemySpiritualityAfter supportId supportWearPaid enemyChargeId resistanceChance resistanceRoll'),
    check: nullable(raw.check, check), pendingBefore: rows(raw.pendingBefore, pending), pendingAfter: rows(raw.pendingAfter, pending),
    rootPadBefore: pad(raw.rootPadBefore), rootPadAfter: pad(raw.rootPadAfter), windowGranted: nullable(raw.windowGranted, window),
    windowsApplied: rows(raw.windowsApplied, w => pick(w, 'kind amount supportId')), windowsExpired: rows(raw.windowsExpired, window), windowsCancelled: rows(raw.windowsCancelled, window) };
};
/** Independent positive specification. No producer, production projector or regex allowlist is reused. */
export function expectedPublicNatureWalkerOutcome(o: NatureWalkerRoundOutcome) {
  return { ...pick(o, 'enemyHealth enemyMind enemySpirituality enemyStatus enemyRisk weaponLocation pendingKind composureReady preservationAttempts rootBufferAttempts rootBufferApplications guardAttempts livingResponseAttempts rootBearingAttempts livingResponseApplications rootBearingApplications enemyTravelMetres targetId round stance continuing playerHealthAfter playerMindAfter playerSpiritualityAfter playerRiskAfter elapsedSeconds'),
    enemyInjuries: o.enemyInjuries.map(injury), powerUses: pick(o.powerUses, 'ARC_BOLT WARD COMPOSE MENTAL_PRESSURE'),
    supportPieces: o.supportPieces.map(p => pick(p, 'id ownerId location quantity status wear usedRound usedOrder')),
    enemyCharges: o.enemyCharges.map(p => pick(p, 'id ownerId status usedRound usedOrder')),
    livingResponse: nullable(o.livingResponse, window), rootBearing: nullable(o.rootBearing, window), playerInjuriesAfter: o.playerInjuriesAfter.map(injury),
    rootPadAfter: pad(o.rootPadAfter), masteryAfter: Object.fromEntries([...NATURE_WALKER_INHERITED_ABILITY_IDS, ...NATURE_WALKER_ABILITY_IDS].map(id => [id, o.masteryAfter[id] ?? 0])),
    siteAfter: site(o.siteAfter), playerActions: o.playerActions.map(action), enemyActions: o.enemyActions.map(action),
    expiredPending: o.expiredPending.map(pending), expiredWindows: o.expiredWindows.map(window), cancelledWindows: o.cancelledWindows.map(window) };
}
export function expectedPublicNatureWalkerRound(r: SliceCombatRound) {
  return { ...pick(r, 'round stance first playerCount enemyCount playerCountRoll enemyCountRoll playerAdvantage enemyAdvantage winChance winner consequence retreat'),
    moves: r.moves.map(m => pick(m, 'actor label selfGain enemyReduction')), consequenceWeights: r.consequenceWeights ? pick(r.consequenceWeights, 'light heavy death') : null,
    ...(r.consequenceDomain === undefined ? {} : { consequenceDomain: r.consequenceDomain }),
    ...(r.consequenceRoll === undefined ? {} : { consequenceRoll: r.consequenceRoll }), natureWalkerOutcome: expectedPublicNatureWalkerOutcome(r.natureWalkerOutcome!) };
}
/** Check modifier source labels are public. Raw source objects and RNG never are. */
export function assertNoPrivateNatureWalkerFields(value: unknown, path: string[] = [], combatOnly = true): void {
  if (Array.isArray(value)) { value.forEach((v, i) => assertNoPrivateNatureWalkerFields(v, [...path, String(i)], combatOnly)); return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    expect(['truth', 'seed', 'cursor', 'random', 'randomSeed', 'randomCursor', 'randomCursorBefore', 'randomCursorAfter', 'randomBefore', 'randomAfter', 'cursorBefore', 'cursorAfter', 'preparationRoll', 'sourceHistory', 'sourceScene', 'journal', 'acquisitionJournal', 'mechanicalPreparation', 'originals', '__privateCaptureProbe'], [...path, key].join('.')).not.toContain(key);
    if (combatOnly && key === 'source') { expect(path.at(-2)).toBe('modifiers'); expect(typeof child).toBe('string'); }
    if (key === 'preparation') {
      expect(combatOnly).toBe(false);
      if (path.length === 1 && path[0] === 'prices') { expect(Number.isSafeInteger(child)).toBe(true); expect(child as number).toBeGreaterThanOrEqual(0); }
      else { expect(path).toEqual(['encounter']); if (child !== null) expect(Object.keys(child as object).sort()).toEqual(['week', 'pricePaid', 'mindPaid', 'actionsPaid'].sort()); }
    }
    assertNoPrivateNatureWalkerFields(child, [...path, key], combatOnly);
  }
}
export function assertNatureWalkerPublicEvidence(s: SliceState, p = projectSliceState(s)): void {
  assertNoPrivateNatureWalkerFields(p.natureWalker, [], false);
  if (s.combat?.encounterId === 'NATURE_WALKER_DISPUTE') assertNoPrivateNatureWalkerFields(p.combat);
  for (const [i, r] of s.combatHistory.entries()) if (r.natureWalkerOutcome) { expect(p.combatHistory[i]).toEqual(projectPlayerText(expectedPublicNatureWalkerRound(r), s.character.name)); assertNoPrivateNatureWalkerFields(p.combatHistory[i]); }
  if (s.lastCombatRound?.natureWalkerOutcome) { expect(p.lastCombatRound).toEqual(projectPlayerText(expectedPublicNatureWalkerRound(s.lastCombatRound), s.character.name)); assertNoPrivateNatureWalkerFields(p.lastCombatRound); }
  if (s.combat?.lastRound?.natureWalkerOutcome) { expect(p.combat!.lastRound).toEqual(projectPlayerText(expectedPublicNatureWalkerRound(s.combat.lastRound), s.character.name)); assertNoPrivateNatureWalkerFields(p.combat!.lastRound); }
}
/** Decorate a detached projection-only invalid-input probe, never reducers or persistence. */
export function decoratePrivateProbe(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(decoratePrivateProbe); return; }
  Object.values(value).forEach(decoratePrivateProbe); Object.assign(value, { __privateCaptureProbe: 'must-not-project', seed: 'private-probe', cursor: 90909, preparationRoll: 88 });
}
