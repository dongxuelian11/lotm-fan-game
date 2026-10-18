import { expect } from 'vitest';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createInterface } from 'node:readline';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validatePrinceOfAbolitionSource } from '../../src/domain/prince-of-abolition/index.js';
import { PRINCE_OF_ABOLITION_SOURCE_KEYS, PRINCE_OF_ABOLITION_ABILITY_IDS } from '../../src/domain/prince-of-abolition/types.js';
import { PRINCE_OF_ABOLITION_CASE_IDS, getPrinceOfAbolitionCurrentSite, princeOfAbolitionLifeMasteryGains, validatePrinceOfAbolitionCurrentSite, validatePrinceOfAbolitionLifeState } from '../../src/domain/prince-of-abolition/life.js';
import { validatePrinceOfAbolitionEncounterState } from '../../src/domain/prince-of-abolition/encounter.js';
import { PRINCE_OF_ABOLITION_COUNT_WHEEL, PRINCE_OF_ABOLITION_ENEMY_COUNT_WHEEL, PRINCE_OF_ABOLITION_ENEMY_ABILITY_WHEEL, princeOfAbolitionAbilityWheel, currentPrinceOfAbolitionCombatSource } from '../../src/domain/prince-of-abolition/combat.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { PRINCE_OF_ABOLITION_CAPTURE_EVIDENCE, type PrinceOfAbolitionObservedCapture } from './prince-of-abolition-capture-evidence.js';

export const PRINCE_OF_ABOLITION_ROOT = 'tests/fixtures/prince-of-abolition-v02050';
export const PRINCE_OF_ABOLITION_SOURCE = 'tests/fixtures/entropy-duke-v01830/natural.json';
export const PRINCE_OF_ABOLITION_PRIOR = 'tests/fixtures/frenzy-mage-v01590/natural.json';
export const PRINCE_OF_ABOLITION_PREFIX_COUNT = 743;
export const PRINCE_OF_ABOLITION_INHERITED_COUNT = 555;
export const PRINCE_OF_ABOLITION_SEED = 'lawyer-natural-v063';
export const captureValueHash = (value: unknown): string => createHash('sha256').update(stableStringify(value)).digest('hex');
export const insertionOrderHash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Compare digests, never ask Vitest to retain/render two multi-megabyte trees. */
export const sameCaptureValue = (actual: unknown, expected: unknown): void => expect(captureValueHash(actual)).toBe(captureValueHash(expected));
export function observedCapture(): PrinceOfAbolitionObservedCapture {
  if (!PRINCE_OF_ABOLITION_CAPTURE_EVIDENCE.observed) throw new Error('PENDING: no coordinator-frozen stage205 capture.');
  return PRINCE_OF_ABOLITION_CAPTURE_EVIDENCE.observed;
}
export const naturalEntry = <T>(key: string): T => readObjectEntry<T>(`${PRINCE_OF_ABOLITION_ROOT}/natural.json`, key);
export const sourceEntry = <T>(key: string): T => readObjectEntry<T>(PRINCE_OF_ABOLITION_SOURCE, key);
export const summaryEntry = <T>(key: string): T => readObjectEntry<T>(`${PRINCE_OF_ABOLITION_ROOT}/summary.json`, key);
export function captureMetadata() {
  observedCapture();
  return {
    boundaries: JSON.parse(readFileSync(`${PRINCE_OF_ABOLITION_ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>,
    steps: JSON.parse(readFileSync(`${PRINCE_OF_ABOLITION_ROOT}/boundaries.steps.json`, 'utf8')) as Record<string, number>,
    snapshots: naturalEntry<Record<string, string>>('snapshots'), commands: naturalEntry<SliceIntent[]>('commands'),
  };
}
export function capturePath(filename: string): string {
  if (filename !== basename(filename) || !filename.endsWith('.json')) throw new Error(`Nonlocal capture reference: ${filename}`);
  return `${PRINCE_OF_ABOLITION_ROOT}/${filename}`;
}
export async function captureFileHash(path: string): Promise<string> {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}
export async function* captureJsonLines<T>(name: 'commands.jsonl' | 'public.jsonl'): AsyncGenerator<T> {
  const input = createReadStream(`${PRINCE_OF_ABOLITION_ROOT}/${name}`, { encoding: 'utf8' });
  const lines = createInterface({ input, crlfDelay: Infinity });
  try { for await (const line of lines) { expect(line.length).toBeGreaterThan(0); yield JSON.parse(line) as T; } }
  finally { lines.close(); input.destroy(); }
}
export function currentCapture(value: unknown): SliceState {
  const state = migrateSliceState(value);
  expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  return state;
}
export function originalLivingPrefix(): SliceState { return currentCapture(sourceEntry<unknown>('final')); }
export function capturedState(key: 'initial' | 'prefixFinal' | 'beforeLast' | 'final'): SliceState {
  observedCapture(); return currentCapture(naturalEntry<unknown>(key));
}
export function capturedSnapshot(name: string): SliceState {
  const filename = captureMetadata().snapshots[name];
  if (!filename) throw new Error(`No actual Prince of Abolition snapshot: ${name}`);
  return currentCapture(JSON.parse(readFileSync(capturePath(filename), 'utf8')));
}
export function namedBoundary(name: string) {
  const filename = captureMetadata().boundaries[name];
  if (!filename) throw new Error(`No actual Prince of Abolition boundary: ${name}`);
  const path = capturePath(filename);
  return { path, count: readObjectEntry<number>(path, 'commandCount'), before: currentCapture(readObjectEntry<unknown>(path, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(path, 'lastIntent'), final: currentCapture(readObjectEntry<unknown>(path, 'final')) };
}
/** Exact public controls recorded by the producer, independent of final outcomes. */
export function publicCaptureControl(state: SliceState, intent: SliceIntent): unknown {
  expect(validateSlicePayload(intent), JSON.stringify(intent)).toBe(true);
  const view = projectSliceState(state);
  if (intent.type === 'CONTINUE_LIFE') {
    expect(state.status).toBe('SLICE_COMPLETE'); expect(state.ending).not.toBeNull();
    expect(state.ending!.kind).not.toBe('DEATH'); expect(state.caseArchive).toHaveLength(0);
    return { kind: 'CONTINUE_LIFE', status: view.status, enabled: true };
  }
  expect(state.status).toBe('ACTIVE');
  if (intent.type === 'PRINCE_OF_ABOLITION') {
    const action = view.princeOfAbolition.actions.find(a => stableStringify(a.command) === stableStringify(intent.command));
    expect(action, `Missing real public control: ${JSON.stringify(intent)}`).toBeDefined(); expect(action!.enabled, action!.reason ?? '').toBe(true);
    const life = view.princeOfAbolition.life.actions.find(a => stableStringify(a.command) === stableStringify(intent.command));
    if (life) {
      if ('caseId' in intent.command) expect(intent.command.caseId).toBe(PRINCE_OF_ABOLITION_CASE_IDS.find(id => state.princeOfAbolition.life.cases[id].status !== 'RESOLVED'));
      if (!['OBSERVE', 'REPORT', 'REFLECT'].includes(intent.command.type)) expect(life.preferredAction).toBe(true);
      if (intent.command.type === 'PREPARE') expect(intent.command.method).toBe('ABILITY');
    }
    if (intent.command.type === 'SET_COMBAT_POLICY') expect(intent.command.policy).toBe('ALL');
    if (intent.command.type === 'ENCOUNTER_FIGHT') expect(state.princeOfAbolition.encounter.policy).toBe('ALL');
    return structuredClone(action!);
  }
  if (intent.type === 'ACTION') {
    expect(intent.action).toBe(state.wagePaidWeek === state.week ? 'REST' : 'WORK');
    expect(view.canAct, view.actionBlockedReason ?? '').toBe(true); expect(view.princeOfAbolition.insideCase).toBe(false);
    expect(state.combat).toBeNull(); expect(state.princeOfAbolition.preparedWeek).toBeNull();
    return { kind: 'ACTION', action: intent.action, enabled: true };
  }
  if (intent.type === 'EVENT_CHOICE') {
    expect(state.activeEvent?.instanceId).toBe(intent.eventInstanceId);
    const action = view.activeEvent?.choices.find(a => a.id === intent.choiceId); expect(action?.enabled).toBe(true);
    const choices: Record<string, string> = { ORIGIN: '.decline', 'LIFE-BILL-01': 'PAY_PART', 'DEBT-NOTICE-01': 'DECLINE', 'DEBT-SETTLE-01': 'DEFER', 'LIFE-CARE-01': 'PAY', 'CARE-WORK-OFFER': 'DECLINE' };
    expect(intent.choiceId).toBe(choices[view.activeEvent!.id.startsWith('ORIGIN') ? 'ORIGIN' : view.activeEvent!.id]);
    return structuredClone(action!);
  }
  if (intent.type !== 'COMBAT_ROUND') throw new Error(`Unexpected continuation intent: ${JSON.stringify(intent)}`);
  expect(intent.stance).toBe('CONTROL'); expect(Object.hasOwn(intent, 'winnerPolicy')).toBe(false);
  expect(state.princeOfAbolition.encounter.policy).toBe('ALL'); expect(state.combat?.encounterId).toBe('PRINCE_OF_ABOLITION_DISPUTE');
  expect(view.combat?.stances.some(a => a.id === intent.stance)).toBe(true);
  sameCaptureValue(view.combat!.playerCountWheel, PRINCE_OF_ABOLITION_COUNT_WHEEL);
  sameCaptureValue(view.combat!.enemyCountWheel, PRINCE_OF_ABOLITION_ENEMY_COUNT_WHEEL);
  expect(view.combat!.playerCountWheel.map(w => [w.id, w.weight])).toEqual([['1', 10], ['2', 15], ['3', 25], ['4', 25], ['5', 15], ['6', 10]]);
  sameCaptureValue(view.combat!.playerAbilityWheel, princeOfAbolitionAbilityWheel(state, null));
  expect(view.combat!.playerAbilityWheels).toBeDefined();
  sameCaptureValue(view.combat!.playerAbilityWheels![intent.stance], princeOfAbolitionAbilityWheel(state, intent.stance));
  sameCaptureValue(view.combat!.enemyAbilityWheel, PRINCE_OF_ABOLITION_ENEMY_ABILITY_WHEEL);
  expect(view.combat!.playerAbilityWheel.map(w => w.id)).toEqual(['black-emperor.s2.action-amplification', 'BODY_FOLLOWUP', 'black-emperor.s7.bribery-weakening', 'black-emperor.s3.ordered-deviation', 'black-emperor.s2.effect-prolongation', 'ACCIDENT', ...PRINCE_OF_ABOLITION_ABILITY_IDS]);
  expect(view.combat!.playerAbilityWheel.map(w => w.weight)).toEqual([30, 15, 25, 10, 15, 5, 20, 20].map(w => w * 4 / 560 * 100));
  const source = currentPrinceOfAbolitionCombatSource(state); expect(source).not.toBeNull();
  expect(source).toMatchObject({ maxActionCount: 6, targetId: 'PA1-EDMUND' }); sameCaptureValue(source!.gifts, currentGifts(state));
  return { kind: 'COMBAT_ROUND', stance: intent.stance, round: state.combat!.round,
    playerCountWheel: view.combat!.playerCountWheel, enemyCountWheel: view.combat!.enemyCountWheel,
    baseAbilityWheel: view.combat!.playerAbilityWheel, actualStanceAbilityWheel: view.combat!.playerAbilityWheels![intent.stance], enemyAbilityWheel: view.combat!.enemyAbilityWheel };
}
export function replayCaptureBoundary(name: string) {
  const save = namedBoundary(name); if (save.count > PRINCE_OF_ABOLITION_PREFIX_COUNT) publicCaptureControl(save.before, save.intent);
  sameCaptureValue(applySliceIntent(save.before, save.intent), save.final); return save;
}
export const captureBody = (s: SliceState) => ({ status: s.status, revision: s.revision, week: s.week, date: s.date,
  H: s.health, M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining, pollution: s.seer.pollution,
  injuries: s.injuries, injuryRisk: s.injuryRisk, random: s.random, sequence: s.progression.sequence, acting: s.progression.acting, mastery: s.progression.mastery,
  finance: { weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier,
    debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit, pulse: s.pulse, billAmount: s.billAmount } });
export const sourceOriginals = (s: SliceState) => ({ site: s.frenzyMage.life, operation: s.entropyDuke.life.operation, gifts: s.briber.gifts });
export const currentGifts = (s: SliceState) => s.princeOfAbolition.guidanceKnown ? s.princeOfAbolition.gifts : s.briber.gifts;
export const currentOriginals = (s: SliceState) => ({ site: getPrinceOfAbolitionCurrentSite(s),
  operation: s.princeOfAbolition.promotionWeek === null ? s.entropyDuke.life.operation : s.princeOfAbolition.life.operation, gifts: currentGifts(s) });
export const capturePublicBody = (s: SliceState) => {
  const life = s.princeOfAbolition.life, e = s.princeOfAbolition.encounter;
  return { ...captureBody(s), activeEvent: s.activeEvent?.instanceId ?? null, current: currentOriginals(s),
    life: { activeCase: life.activeCase, conditionVersion: life.conditionVersion, pending: life.pending, flight: life.flight, annex: life.annex, pieces: life.pieces,
      cooperationEffortSpent: life.cooperationEffortSpent, volunteerMindSpent: life.volunteerMindSpent, currentAttempt: life.activeCase ? life.cases[life.activeCase].attempts[0] ?? null : null },
    encounter: { status: e.status, policy: e.policy, currentSite: e.currentSite, supportPieces: e.supportPieces, enemyCharges: e.enemyCharges, directed: e.directed,
      maintenance: e.maintenance, pendingEffects: e.pendingEffects, directedApplications: e.directedApplications, maintenanceApplications: e.maintenanceApplications, terminal: e.terminal } };
};
export function actualLifeAbilityUse(s: SliceState) {
  const l = s.princeOfAbolition.life;
  return Object.fromEntries(PRINCE_OF_ABOLITION_ABILITY_IDS.map((id, i) => {
    const attempts = PRINCE_OF_ABOLITION_CASE_IDS.filter(k => i === 1 ? k === 'maintained-flight' : k !== 'maintained-flight').flatMap(k => l.cases[k].attempts);
    return [id, { paidAttempts: attempts.filter(a => a.castTier !== null).length, castingSuccesses: attempts.filter(a => a.castTier === 'SUCCESS' || a.castTier === 'GREAT_SUCCESS').length,
      actualApplications: attempts.filter(a => a.appliedAbilityIds.includes(id)).length,
      reportedApplications: PRINCE_OF_ABOLITION_CASE_IDS.filter(k => l.cases[k].status === 'RESOLVED').flatMap(k => l.cases[k].attempts).filter(a => a.appliedAbilityIds.includes(id)).length,
      spiritualitySpent: attempts.reduce((n, a) => n + a.spiritualitySpent, 0), mindSpent: attempts.reduce((n, a) => n + a.mindSpent, 0) }];
  }));
}
export function actualCombatAbilityUse(s: SliceState, original: SliceState) {
  const actions = s.combatHistory.slice(original.combatHistory.length).flatMap(r => {
    expect(r.princeOfAbolitionOutcome).toBeDefined(); return [...r.princeOfAbolitionOutcome!.playerActions, ...r.princeOfAbolitionOutcome!.enemyActions];
  });
  return Object.fromEntries(PRINCE_OF_ABOLITION_ABILITY_IDS.map((id, i) => {
    const selected = actions.filter(a => a.actor === 'PLAYER' && a.id === id), kind = i === 0 ? 'DIRECTED' : 'MAINTENANCE';
    const applied = actions.flatMap(a => a.windowsApplied).filter(w => w.kind === kind);
    return [id, { selectedSlots: selected.length, paidAttempts: selected.filter(a => a.paidCost > 0).length,
      castingSuccesses: selected.filter(a => a.check?.tier === 'SUCCESS' || a.check?.tier === 'GREAT_SUCCESS').length,
      unresistedSuccesses: selected.filter(a => a.succeeded).length, resistedAttempts: selected.filter(a => a.resisted).length,
      preparedWindows: selected.filter(a => a.windowGranted?.kind === kind).length, actualApplications: applied.length,
      contributionChange: applied.reduce((n, w) => n + w.amount, 0), masteryApplications: actions.filter(a => a.masteryApplied.includes(id)).length,
      spiritualitySpent: selected.reduce((n, a) => n + a.paidCost, 0), mindSpent: selected.reduce((n, a) => n + a.mindCost, 0), supportWearPaid: selected.reduce((n, a) => n + a.supportWearPaid, 0) }];
  }));
}
/** Historical copies stay immutable; only the new live site and original held gifts can change. */
export function assertOriginalContinuity(s: SliceState, original: SliceState): void {
  for (const key of PRINCE_OF_ABOLITION_SOURCE_KEYS) sameCaptureValue(s[key], original[key]);
  sameCaptureValue(s.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  sameCaptureValue(s.seer.completedSources.slice(0, original.seer.completedSources.length), original.seer.completedSources);
  const old = sourceOriginals(original), now = currentOriginals(s), life = s.princeOfAbolition.life;
  if (s.princeOfAbolition.guidanceKnown) {
    sameCaptureValue(s.princeOfAbolition.sourceHistory, Object.fromEntries(PRINCE_OF_ABOLITION_SOURCE_KEYS.map(k => [k, original[k]])));
    sameCaptureValue(s.princeOfAbolition.sourceScene!.originals, old); expect(validatePrinceOfAbolitionSource(s)).toBe(true);
  }
  if (s.princeOfAbolition.promotionWeek !== null) {
    expect(life.sourceWeek).toBe(s.princeOfAbolition.promotionWeek); expect(validatePrinceOfAbolitionCurrentSite(now.site, old)).toBe(true);
  }
  expect(validatePrinceOfAbolitionLifeState(s)).toBe(true); expect(validatePrinceOfAbolitionEncounterState(s)).toBe(true);
  sameCaptureValue(now.operation, old.operation); sameCaptureValue(now.site.parcel, old.site.parcel); sameCaptureValue(now.site.pads, old.site.pads);
  expect(now.site.paper.text).toBe(old.site.paper.text); expect(Object.hasOwn(now.site, 'playerEnergy')).toBe(false);
  expect(Object.hasOwn(now.site.volunteer, 'energy')).toBe(false); expect(Object.hasOwn(now.site.guide, 'mind')).toBe(false);
  expect(now.site.clockSeconds).toBeGreaterThanOrEqual(old.site.clockSeconds); expect(now.site.playerTravelMetres).toBeGreaterThanOrEqual(old.site.playerTravelMetres);
  const attempts = PRINCE_OF_ABOLITION_CASE_IDS.flatMap(k => life.cases[k].attempts);
  expect(life.volunteerMindSpent).toBe(attempts.reduce((n, a) => n + a.volunteerMindSpent, 0));
  expect(life.cooperationEffortSpent).toBe(attempts.reduce((n, a) => n + a.cooperationEffortSpent, 0));
  expect(now.site.volunteer.mind).toBe(old.site.volunteer.mind - life.volunteerMindSpent);
  const mastery = { ...original.progression.mastery }, gifts = structuredClone(old.gifts);
  if (s.progression.sequence === 1) {
    for (const id of PRINCE_OF_ABOLITION_ABILITY_IDS) mastery[id] = 0;
    for (const [id, gain] of Object.entries(princeOfAbolitionLifeMasteryGains(s))) mastery[id] = mastery[id]! + gain;
  }
  for (const round of s.combatHistory.slice(original.combatHistory.length)) {
    const o = round.princeOfAbolitionOutcome; expect(o).toBeDefined(); expect(o!.source.policy).toBe('ALL'); expect(o!.source.targetId).toBe('PA1-EDMUND');
    sameCaptureValue(o!.source.gifts, gifts);
    for (const a of [...o!.playerActions, ...o!.enemyActions]) {
      for (const id of a.masteryApplied) { expect(Object.hasOwn(mastery, id)).toBe(true); mastery[id] = Math.min(500, mastery[id]! + 8); }
      if (a.actor === 'PLAYER' && a.id === 'black-emperor.s7.bribery-weakening' && a.giftId !== null) {
        const gift = gifts.find(g => g.id === a.giftId); expect(gift).toBeDefined(); expect(gift!.location).toBe('PLAYER');
        gift!.location = 'GIVEN'; gift!.destination = 'BATTLE:PRINCE_OF_ABOLITION_DISPUTE:GROUND'; gift!.givenWeek = o!.source.week;
      }
    }
    sameCaptureValue(o!.giftsAfter, gifts);
  }
  sameCaptureValue(now.gifts, gifts); sameCaptureValue(now.gifts.slice(0, 12), old.gifts.slice(0, 12)); sameCaptureValue(s.progression.mastery, mastery);
  const { coreStats, ...identity } = s.character, { coreStats: oldStats, ...oldIdentity } = original.character;
  sameCaptureValue(identity, oldIdentity);
  for (const k of Object.keys(oldStats) as (keyof typeof oldStats)[]) expect(coreStats[k]).toBe(Math.min(500, oldStats[k] + (s.progression.sequence === 1 ? 1 : 0)));
  expect(s.runId).toBe(original.runId); expect(s.random.seed).toBe(PRINCE_OF_ABOLITION_SEED); expect(s.progression.promotionWeek).toBe(original.progression.promotionWeek);
}
export const assertPublicCaptureControl = (state: SliceState, intent: SliceIntent): void => { publicCaptureControl(state, intent); };
