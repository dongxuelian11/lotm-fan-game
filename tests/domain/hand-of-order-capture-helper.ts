import { expect } from 'vitest';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { basename } from 'node:path';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateHandOfOrderSource } from '../../src/domain/hand-of-order/index.js';
import { HAND_OF_ORDER_SOURCE_KEYS, HAND_OF_ORDER_ABILITY_IDS } from '../../src/domain/hand-of-order/types.js';
import { HAND_OF_ORDER_CASE_IDS, getHandOfOrderCurrentSite, getHandOfOrderLifeMasteryGains, validateHandOfOrderLifeState } from '../../src/domain/hand-of-order/life.js';
import { HAND_OF_ORDER_COUNT_WHEEL, HAND_OF_ORDER_ENEMY_COUNT_WHEEL, HAND_OF_ORDER_ENEMY_ABILITY_WHEEL, handOfOrderAbilityWheel, currentHandOfOrderCombatSource } from '../../src/domain/hand-of-order/combat.js';
import { balancerAbilityWheel } from '../../src/domain/balancer/combat.js';
import { validateHandOfOrderEncounterState } from '../../src/domain/hand-of-order/encounter.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { HAND_OF_ORDER_CAPTURE_EVIDENCE } from './hand-of-order-capture-evidence.js';

export const HAND_OF_ORDER_ROOT = 'tests/fixtures/hand-of-order-v02060';
export const HAND_OF_ORDER_SOURCE = 'tests/fixtures/balancer-v01840/natural.json';
export const HAND_OF_ORDER_RECOVERY = 'tests/fixtures/recovery-v01620/natural.json';
export const HAND_OF_ORDER_DEATH = 'tests/fixtures/chaos-hunter-v01600/natural.json';
export const HAND_OF_ORDER_PREFIX_COUNT = 594, HAND_OF_ORDER_INHERITED_COUNT = 483, HAND_OF_ORDER_DEATH_COUNT = 477, HAND_OF_ORDER_COMMON_COUNT = 474;
export const HAND_OF_ORDER_SEED = 'arbiter-natural-v066';
export const captureValueHash = (value: unknown): string => createHash('sha256').update(stableStringify(value)).digest('hex');
export const insertionOrderHash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Digest comparisons avoid retaining/rendering a second giant historical tree on failure. */
export const sameCaptureValue = (actual: unknown, expected: unknown): void => expect(captureValueHash(actual)).toBe(captureValueHash(expected));
export async function captureFileHash(path: string): Promise<string> {
  const digest = createHash('sha256'); for await (const chunk of createReadStream(path)) digest.update(chunk); return digest.digest('hex');
}
export const naturalEntry = <T>(key: string): T => readObjectEntry<T>(`${HAND_OF_ORDER_ROOT}/natural.json`, key);
export const sourceEntry = <T>(key: string): T => readObjectEntry<T>(HAND_OF_ORDER_SOURCE, key);
export const summaryEntry = <T>(key: string): T => readObjectEntry<T>(`${HAND_OF_ORDER_ROOT}/summary.json`, key);
export function observedCapture() {
  const observed = HAND_OF_ORDER_CAPTURE_EVIDENCE.observed;
  if (!observed) throw new Error('PENDING: no coordinator-confirmed final stage206 capture.');
  return observed;
}
export function currentCapture(raw: unknown): SliceState {
  const state = migrateSliceState(raw);
  expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  return state;
}
export function capturePath(filename: string): string {
  if (filename !== basename(filename) || !filename.endsWith('.json')) throw new Error(`Nonlocal capture reference: ${filename}`);
  return `${HAND_OF_ORDER_ROOT}/${filename}`;
}
export function captureMetadata() {
  return { boundaries: JSON.parse(readFileSync(`${HAND_OF_ORDER_ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>,
    steps: JSON.parse(readFileSync(`${HAND_OF_ORDER_ROOT}/boundaries.steps.json`, 'utf8')) as Record<string, number>,
    snapshots: naturalEntry<Record<string, string>>('snapshots'), commands: naturalEntry<SliceIntent[]>('commands') };
}
export const originalLivingPrefix = (): SliceState => currentCapture(sourceEntry('final'));
export const capturedState = (key: 'initial' | 'prefixFinal' | 'beforeLast' | 'final'): SliceState => currentCapture(naturalEntry(key));
export function capturedSnapshot(name: string): SliceState {
  const filename = captureMetadata().snapshots[name]; if (!filename) throw new Error(`No actual Hand of Order snapshot: ${name}`);
  return currentCapture(JSON.parse(readFileSync(capturePath(filename), 'utf8')));
}
export function namedBoundary(name: string) {
  const filename = captureMetadata().boundaries[name]; if (!filename) throw new Error(`No actual Hand of Order boundary: ${name}`);
  const path = capturePath(filename);
  return { path, count: readObjectEntry<number>(path, 'commandCount'), before: currentCapture(readObjectEntry(path, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(path, 'lastIntent'), final: currentCapture(readObjectEntry(path, 'final')) };
}
export function replayCaptureBoundary(name: string) {
  const b = namedBoundary(name); expect(validateSlicePayload(b.intent)).toBe(true);
  if (b.count > HAND_OF_ORDER_PREFIX_COUNT && b.intent.type === 'HAND_OF_ORDER') {
    const intent = b.intent, control = projectSliceState(b.before).handOfOrder.actions.find(a => stableStringify(a.command) === stableStringify(intent.command));
    expect(control).toBeDefined(); expect(control!.enabled, control!.reason ?? '').toBe(true);
  }
  sameCaptureValue(applySliceIntent(b.before, b.intent), b.final); return b;
}
export const captureBody = (s: SliceState) => ({ status: s.status, revision: s.revision, week: s.week, date: s.date,
  H: s.health, M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining, pollution: s.seer.pollution,
  injuries: s.injuries, injuryRisk: s.injuryRisk, random: s.random, sequence: s.progression.sequence, acting: s.progression.acting, mastery: s.progression.mastery,
  finance: { weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier,
    debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit, pulse: s.pulse, billAmount: s.billAmount } });
export const sourceOriginals = (s: SliceState) => ({ site: s.chaosHunter.life, operation: s.balancer.life.operation, guardPlate: s.balancer.life.guardPlate });
export const currentPlate = (s: SliceState) => s.handOfOrder.life.guardPlate ?? s.balancer.life.guardPlate;
export const currentOriginals = (s: SliceState) => {
  const operation = s.handOfOrder.life.source ? s.handOfOrder.life.operation : s.balancer.life.operation;
  return { site: getHandOfOrderCurrentSite(s), operation: { door: operation.door, truth: operation.truth, effect: operation.effect }, guardPlate: currentPlate(s) };
};
export function actualLifeAbilityUse(s: SliceState) {
  const life = s.handOfOrder.life;
  return Object.fromEntries(HAND_OF_ORDER_ABILITY_IDS.map((id, i) => {
    const cases = HAND_OF_ORDER_CASE_IDS.filter(k => i === 1 ? k === 'measured-aftermath' : k !== 'measured-aftermath');
    const attempts = cases.flatMap(k => life.cases[k].attempts), tier = (a: typeof attempts[number]) => i === 0 ? a.divisionTier : a.aftermathTier;
    return [id, { paidAttempts: attempts.filter(a => tier(a) !== null).length,
      castingSuccesses: attempts.filter(a => tier(a) === 'SUCCESS' || tier(a) === 'GREAT_SUCCESS').length,
      actualApplications: attempts.filter(a => a.appliedAbilityIds.includes(id)).length,
      reportedApplications: cases.filter(k => life.cases[k].status === 'RESOLVED').flatMap(k => life.cases[k].attempts).filter(a => a.appliedAbilityIds.includes(id)).length,
      spiritualitySpent: attempts.reduce((n, a) => n + a.spiritualitySpent, 0), mindSpent: attempts.reduce((n, a) => n + a.mindSpent, 0) }];
  }));
}
export function actualCombatAbilityUse(s: SliceState, original: SliceState) {
  const actions = s.combatHistory.slice(original.combatHistory.length).flatMap(r => {
    expect(r.handOfOrderOutcome).toBeDefined(); return [...r.handOfOrderOutcome!.playerActions, ...r.handOfOrderOutcome!.enemyActions];
  });
  return Object.fromEntries(HAND_OF_ORDER_ABILITY_IDS.map((id, i) => {
    const selected = actions.filter(a => a.actor === 'PLAYER' && a.id === id), kind = i === 0 ? 'DIVISION' : 'AFTERMATH';
    const applied = actions.flatMap(a => a.windowsApplied).filter(w => w.kind === kind);
    return [id, { selectedSlots: selected.length, paidAttempts: selected.filter(a => a.paidCost > 0).length,
      castingSuccesses: selected.filter(a => a.check?.tier === 'SUCCESS' || a.check?.tier === 'GREAT_SUCCESS').length,
      unresistedSuccesses: selected.filter(a => a.succeeded).length, resistedAttempts: selected.filter(a => a.resisted).length,
      preparedWindows: selected.filter(a => a.windowGranted?.kind === kind).length, actualApplications: applied.length,
      contributionChange: applied.reduce((n, a) => n + a.amount, 0), masteryApplications: actions.filter(a => a.masteryApplied.includes(id)).length,
      spiritualitySpent: selected.reduce((n, a) => n + a.paidCost, 0), mindSpent: selected.reduce((n, a) => n + a.mindCost, 0), supportWearPaid: selected.reduce((n, a) => n + a.supportWearPaid, 0) }];
  }));
}
/** Eight predecessor roots remain immutable; physical continuity uses actual clock767 site and one original plate. */
export function assertOriginalContinuity(s: SliceState, original: SliceState): void {
  for (const key of HAND_OF_ORDER_SOURCE_KEYS) sameCaptureValue(s[key], original[key]);
  sameCaptureValue(s.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  sameCaptureValue(s.seer.completedSources.slice(0, original.seer.completedSources.length), original.seer.completedSources);
  const old = sourceOriginals(original), now = currentOriginals(s), life = s.handOfOrder.life;
  if (s.handOfOrder.guidanceKnown) {
    sameCaptureValue(s.handOfOrder.sourceHistory, Object.fromEntries(HAND_OF_ORDER_SOURCE_KEYS.map(k => [k, original[k]])));
    sameCaptureValue(s.handOfOrder.sourceScene!.originals, old); expect(validateHandOfOrderSource(s)).toBe(true);
  }
  if (s.handOfOrder.promotionWeek !== null) {
    expect(life.source!.promotionWeek).toBe(s.handOfOrder.promotionWeek); sameCaptureValue(life.source!.originals, old);
  }
  expect(validateHandOfOrderLifeState(s)).toBe(true); expect(validateHandOfOrderEncounterState(s)).toBe(true);
  sameCaptureValue(now.operation, old.operation); sameCaptureValue(now.site.cases, old.site.cases); sameCaptureValue(now.site.table, old.site.table);
  expect(now.site.paper.text).toBe(old.site.paper.text); expect(Object.hasOwn(now.site, 'playerEnergy')).toBe(false); expect(Object.hasOwn(now.site.volunteer, 'energy')).toBe(false);
  expect(now.site.clockSeconds).toBeGreaterThanOrEqual(old.site.clockSeconds); expect(now.site.playerTravelMetres).toBeGreaterThanOrEqual(old.site.playerTravelMetres);
  for (const key of ['parcel', 'line', 'paper'] as const) for (const field of ['id', 'owner', 'quantity'] as const) expect(now.site[key][field]).toBe(old.site[key][field]);
  expect(now.site.parcel.massGrams).toBe(350);
  const attempts = HAND_OF_ORDER_CASE_IDS.flatMap(k => life.cases[k].attempts);
  expect(life.annex.effortSpent).toBe(attempts.reduce((n, a) => n + a.effortSpent, 0)); expect(life.annex.effortSpent).toBeLessThanOrEqual(9);
  expect(now.site.volunteer.mind).toBe(old.site.volunteer.mind - attempts.reduce((n, a) => n + a.volunteerMindSpent, 0));
  expect(now.site.volunteer.health).toBe(old.site.volunteer.health); expect(now.site.volunteer.alive).toBe(true);
  const mastery = { ...original.progression.mastery };
  if (s.progression.sequence === 1) {
    for (const id of HAND_OF_ORDER_ABILITY_IDS) mastery[id] = 0;
    for (const [id, gain] of Object.entries(getHandOfOrderLifeMasteryGains(life))) mastery[id] = Math.min(500, mastery[id]! + gain);
  }
  let integrity = old.guardPlate.integrity - attempts.reduce((n, a) => n + (a.impact?.plateWear ?? 0), 0);
  for (const round of s.combatHistory.slice(original.combatHistory.length)) {
    const o = round.handOfOrderOutcome!; expect(o).toBeDefined(); expect(o.source).toMatchObject({ policy: 'ALL', targetId: 'HO1-BRAM' });
    expect(o.source.guardPlate.integrity).toBe(integrity);
    for (const a of [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order)) {
      expect(a.guardPlateBefore.integrity).toBe(integrity); integrity -= a.plateWear; expect(a.guardPlateAfter.integrity).toBe(integrity);
      for (const id of a.masteryApplied) { expect(Object.hasOwn(mastery, id)).toBe(true); mastery[id] = Math.min(500, mastery[id]! + 8); }
    }
    expect(o.guardPlateAfter.integrity).toBe(integrity);
  }
  expect(now.guardPlate.integrity).toBe(integrity); for (const k of ['id', 'owner', 'holder', 'acquiredWeek'] as const) expect(now.guardPlate[k]).toBe(old.guardPlate[k]);
  expect(now.guardPlate.location).toBe(now.site.playerLocation); sameCaptureValue(s.progression.mastery, mastery);
  const { coreStats, ...identity } = s.character, { coreStats: oldStats, ...oldIdentity } = original.character;
  sameCaptureValue(identity, oldIdentity); for (const k of Object.keys(oldStats) as (keyof typeof oldStats)[]) expect(coreStats[k]).toBe(Math.min(500, oldStats[k] + (s.progression.sequence === 1 ? 1 : 0)));
  expect(s.runId).toBe(original.runId); expect(s.random.seed).toBe(HAND_OF_ORDER_SEED); expect(s.progression.promotionWeek).toBe(original.progression.promotionWeek);
  assertValidSliceState(s);
}
export const HAND_OF_ORDER_PREDECESSOR = HAND_OF_ORDER_RECOVERY;
export const HAND_OF_ORDER_ORIGINAL_DEATH = HAND_OF_ORDER_DEATH;
/** Read-only public authorization checks; full reducer replay compares the exact recorded control. */
export function assertPublicCaptureControl(state: SliceState, intent: SliceIntent, projected?: ReturnType<typeof projectSliceState>): void {
  expect(validateSlicePayload(intent)).toBe(true); const view = projected ?? projectSliceState(state);
  if (intent.type === 'CONTINUE_LIFE') {
    expect(state.status).toBe('SLICE_COMPLETE'); expect(state.ending).not.toBeNull(); expect(state.ending!.kind).not.toBe('DEATH'); return;
  }
  expect(state.status).toBe('ACTIVE');
  if (intent.type === 'HAND_OF_ORDER') {
    const action = view.handOfOrder.actions.find(a => stableStringify(a.command) === stableStringify(intent.command));
    expect(action).toBeDefined(); expect(action!.enabled, action!.reason ?? '').toBe(true);
  } else if (intent.type === 'EVENT_CHOICE') {
    expect(state.activeEvent?.instanceId).toBe(intent.eventInstanceId); expect(view.activeEvent?.choices.find(c => c.id === intent.choiceId)?.enabled).toBe(true);
  } else if (intent.type === 'ACTION') {
    expect(view.canAct, view.actionBlockedReason ?? '').toBe(true); expect(view.handOfOrder.insideCase).toBe(false); expect(state.combat).toBeNull();
    expect(['WORK', 'REST', 'INVESTIGATE']).toContain(intent.action); expect(state.handOfOrder.preparedWeek).toBeNull();
    if (intent.action === 'INVESTIGATE') { expect(intent.targetId).toBe('CARE-ACCESS-01'); expect(state.careKnown).toBe(false); }
  } else if (intent.type === 'COMBAT_ROUND') {
    expect(intent.stance).toBe('CONTROL'); expect(Object.hasOwn(intent, 'winnerPolicy')).toBe(false); expect(state.handOfOrder.encounter.policy).toBe('ALL');
    expect(state.combat?.encounterId).toBe('HAND_OF_ORDER_DISPUTE'); expect(view.combat?.stances.some(a => a.id === intent.stance)).toBe(true);
  } else throw new Error(`Unexpected Hand of Order continuation: ${JSON.stringify(intent)}`);
}

export async function* captureJsonLines<T>(name: 'commands.jsonl' | 'public.jsonl'): AsyncGenerator<T> {
  const input = createReadStream(`${HAND_OF_ORDER_ROOT}/${name}`, { encoding: 'utf8' }), lines = createInterface({ input, crlfDelay: Infinity });
  try { for await (const line of lines) { expect(line.length).toBeGreaterThan(0); yield JSON.parse(line) as T; } }
  finally { lines.close(); input.destroy(); }
}
/** Exact recorded compact evidence, with no schema tag or unrelated newly added CURRENT roots. */
export const capturePublicBody = (s: SliceState) => {
  const life = s.handOfOrder.life, e = s.handOfOrder.encounter;
  return { ...captureBody(s), activeEvent: s.activeEvent?.instanceId ?? null, current: currentOriginals(s),
    life: { activeCase: life.activeCase, operation: life.operation, annex: life.annex, currentAttempt: life.activeCase ? life.cases[life.activeCase].attempts[0] ?? null : null },
    encounter: { status: e.status, policy: e.policy, supportPieces: e.supportPieces, enemyCharges: e.enemyCharges, division: e.division, aftermath: e.aftermath,
      divisionApplications: e.divisionApplications, aftermathApplications: e.aftermathApplications, terminal: e.terminal } };
};
/** Exact current public control checks, independent of the raw capture format and compiled dist. */
export function publicCaptureControl(state: SliceState, intent: SliceIntent): unknown {
  const view = projectSliceState(state); assertPublicCaptureControl(state, intent, view);
  if (intent.type === 'CONTINUE_LIFE') return { kind: 'CONTINUE_LIFE', status: view.status, enabled: true };
  if (intent.type === 'HAND_OF_ORDER') {
    const action = view.handOfOrder.actions.find(a => stableStringify(a.command) === stableStringify(intent.command))!;
    const life = view.handOfOrder.life.actions.find(a => stableStringify(a.command) === stableStringify(intent.command));
    if (life) {
      if ('caseId' in intent.command) expect(intent.command.caseId).toBe(HAND_OF_ORDER_CASE_IDS.find(id => state.handOfOrder.life.cases[id].status !== 'RESOLVED'));
      if ('caseId' in intent.command && !['OBSERVE', 'REPORT'].includes(intent.command.type)) expect(life.preferredAction).toBe(true);
      if (intent.command.type === 'EXIT_ORIGINAL' || intent.command.type === 'RENT_ANNEX') expect(life.id).toBe(view.handOfOrder.life.preferredActionId);
      if (intent.command.type === 'PREPARE') expect(intent.command.method).toBe('ABILITY');
    }
    if (intent.command.type === 'SET_COMBAT_POLICY') expect(intent.command.policy).toBe('ALL');
    if (intent.command.type === 'ENCOUNTER_FIGHT') expect(state.handOfOrder.encounter.policy).toBe('ALL');
    return structuredClone(action);
  }
  if (intent.type === 'ACTION') return { kind: 'ACTION', action: intent.action, enabled: true };
  if (intent.type === 'EVENT_CHOICE') {
    const action = view.activeEvent!.choices.find(a => a.id === intent.choiceId)!;
    const choices: Record<string, string> = { ORIGIN: '.decline', 'LIFE-BILL-01': 'PAY_PART', 'DEBT-NOTICE-01': 'DECLINE', 'DEBT-SETTLE-01': 'DEFER', 'LIFE-CARE-01': 'PAY', 'CARE-WORK-OFFER': 'DECLINE' };
    expect(intent.choiceId).toBe(choices[view.activeEvent!.id.startsWith('ORIGIN') ? 'ORIGIN' : view.activeEvent!.id]); return structuredClone(action);
  }
  if (intent.type !== 'COMBAT_ROUND') throw new Error(`Unexpected continuation: ${JSON.stringify(intent)}`);
  const combat = view.combat!;
  sameCaptureValue(combat.playerCountWheel, HAND_OF_ORDER_COUNT_WHEEL); sameCaptureValue(combat.enemyCountWheel, HAND_OF_ORDER_ENEMY_COUNT_WHEEL);
  expect(combat.playerCountWheel.map(w => [w.id, w.weight])).toEqual([['1', 10], ['2', 15], ['3', 25], ['4', 25], ['5', 15], ['6', 10]]);
  sameCaptureValue(combat.playerAbilityWheel, handOfOrderAbilityWheel(state, null)); sameCaptureValue(combat.playerAbilityWheels![intent.stance], handOfOrderAbilityWheel(state, intent.stance));
  sameCaptureValue(combat.enemyAbilityWheel, HAND_OF_ORDER_ENEMY_ABILITY_WHEEL);
  expect(combat.playerAbilityWheel.map(w => w.id)).toEqual(['justiciar.s9.combat-training', 'justiciar.s5.wound-verdict', 'justiciar.s2.measured-resistance', 'justiciar.s2.imbalance-sensing', 'justiciar.s4.deprivation', 'ACCIDENT', ...HAND_OF_ORDER_ABILITY_IDS]);
  expect(combat.playerAbilityWheel.map(w => w.weight)).toEqual([30, 15, 25, 10, 15, 5, 20, 20].map(w => w * 4 / 560 * 100));
  const source = currentHandOfOrderCombatSource(state); expect(source).not.toBeNull(); expect(source).toMatchObject({ maxActionCount: 6, targetId: 'HO1-BRAM' }); sameCaptureValue(source!.guardPlate, currentPlate(state));
  const inherited = balancerAbilityWheel(state, null); sameCaptureValue(inherited.map(w => w.id), combat.playerAbilityWheel.slice(0, 6).map(w => w.id));
  for (let i = 0; i < 6; i++) expect(Math.abs(inherited[i]!.weight - combat.playerAbilityWheel[i]!.weight * 140 / 100)).toBeLessThan(1e-10);
  return { kind: 'COMBAT_ROUND', stance: intent.stance, round: state.combat!.round, playerCountWheel: combat.playerCountWheel, enemyCountWheel: combat.enemyCountWheel,
    baseAbilityWheel: combat.playerAbilityWheel, actualStanceAbilityWheel: combat.playerAbilityWheels![intent.stance], enemyAbilityWheel: combat.enemyAbilityWheel };
}
