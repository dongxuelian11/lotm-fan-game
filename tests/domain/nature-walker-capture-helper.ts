import { expect } from 'vitest';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { basename } from 'node:path';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateNatureWalkerSource } from '../../src/domain/nature-walker/index.js';
import { NATURE_WALKER_SOURCE_KEYS, NATURE_WALKER_ABILITY_IDS } from '../../src/domain/nature-walker/types.js';
import { NATURE_WALKER_CASE_IDS, getNatureWalkerCurrentSite, createNatureWalkerLifeState, validateNatureWalkerLifeState } from '../../src/domain/nature-walker/life.js';
import { NATURE_WALKER_COUNT_WHEEL, NATURE_WALKER_ENEMY_COUNT_WHEEL, NATURE_WALKER_ENEMY_ABILITY_WHEEL, natureWalkerAbilityWheel, currentNatureWalkerCombatSource } from '../../src/domain/nature-walker/combat.js';
import { barrenMatriarchAbilityWheel } from '../../src/domain/barren-matriarch/combat.js';
import { validateNatureWalkerEncounterState } from '../../src/domain/nature-walker/encounter.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { NATURE_WALKER_CAPTURE_EVIDENCE } from './nature-walker-capture-evidence.js';
import { assertNatureWalkerPublicEvidence } from './nature-walker-public-evidence.js';

export const NATURE_WALKER_ROOT = 'tests/fixtures/nature-walker-v02070';
export const NATURE_WALKER_SOURCE = 'tests/fixtures/barren-matriarch-v01850/natural.json';
export const NATURE_WALKER_PREDECESSOR = 'tests/fixtures/coffin-bearer-v01610/natural.json';
export const NATURE_WALKER_PREFIX_COUNT = 851, NATURE_WALKER_INHERITED_COUNT = 674;
export const NATURE_WALKER_SEED = 'cultivator-natural-v069';
export const captureValueHash = (value: unknown): string => createHash('sha256').update(stableStringify(value)).digest('hex');
export const insertionOrderHash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Digest comparisons avoid retaining/rendering a second giant historical tree on failure. */
export const sameCaptureValue = (actual: unknown, expected: unknown): void => expect(captureValueHash(actual)).toBe(captureValueHash(expected));
export async function captureFileHash(path: string): Promise<string> {
  const digest = createHash('sha256'); for await (const chunk of createReadStream(path)) digest.update(chunk); return digest.digest('hex');
}
export const naturalEntry = <T>(key: string): T => readObjectEntry<T>(`${NATURE_WALKER_ROOT}/natural.json`, key);
export const sourceEntry = <T>(key: string): T => readObjectEntry<T>(NATURE_WALKER_SOURCE, key);
export const summaryEntry = <T>(key: string): T => readObjectEntry<T>(`${NATURE_WALKER_ROOT}/summary.json`, key);
export function observedCapture() {
  const observed = NATURE_WALKER_CAPTURE_EVIDENCE.observed;
  if (!observed) throw new Error('PENDING: no coordinator-confirmed final stage207 capture.');
  return observed;
}
export function currentCapture(raw: unknown): SliceState {
  const state = migrateSliceState(raw);
  expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  return state;
}
export function capturePath(filename: string): string {
  if (filename !== basename(filename) || !filename.endsWith('.json')) throw new Error(`Nonlocal capture reference: ${filename}`);
  return `${NATURE_WALKER_ROOT}/${filename}`;
}
export function captureMetadata() {
  return { boundaries: JSON.parse(readFileSync(`${NATURE_WALKER_ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>,
    steps: JSON.parse(readFileSync(`${NATURE_WALKER_ROOT}/boundaries.steps.json`, 'utf8')) as Record<string, number>,
    snapshots: naturalEntry<Record<string, string>>('snapshots'), commands: naturalEntry<SliceIntent[]>('commands') };
}
export const originalLivingPrefix = (): SliceState => currentCapture(sourceEntry('final'));
export const capturedState = (key: 'initial' | 'prefixFinal' | 'beforeLast' | 'final'): SliceState => currentCapture(naturalEntry(key));
export function capturedSnapshot(name: string): SliceState {
  const filename = captureMetadata().snapshots[name]; if (!filename) throw new Error(`No actual Nature Walker snapshot: ${name}`);
  return currentCapture(JSON.parse(readFileSync(capturePath(filename), 'utf8')));
}
export function namedBoundary(name: string) {
  const filename = captureMetadata().boundaries[name]; if (!filename) throw new Error(`No actual Nature Walker boundary: ${name}`);
  const path = capturePath(filename);
  return { path, count: readObjectEntry<number>(path, 'commandCount'), before: currentCapture(readObjectEntry(path, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(path, 'lastIntent'), final: currentCapture(readObjectEntry(path, 'final')) };
}
export function replayCaptureBoundary(name: string) {
  const b = namedBoundary(name); expect(validateSlicePayload(b.intent)).toBe(true);
  if (b.count > NATURE_WALKER_PREFIX_COUNT && b.intent.type === 'NATURE_WALKER') {
    const intent = b.intent, control = projectSliceState(b.before).natureWalker.actions.find(a => stableStringify(a.command) === stableStringify(intent.command));
    expect(control).toBeDefined(); expect(control!.enabled, control!.reason ?? '').toBe(true);
  }
  sameCaptureValue(applySliceIntent(b.before, b.intent), b.final); return b;
}
export const captureBody = (s: SliceState) => ({ status: s.status, revision: s.revision, week: s.week, date: s.date,
  H: s.health, M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining, pollution: s.seer.pollution,
  injuries: s.injuries, injuryRisk: s.injuryRisk, random: s.random, sequence: s.progression.sequence, acting: s.progression.acting, mastery: s.progression.mastery,
  finance: { weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier,
    debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit, pulse: s.pulse, billAmount: s.billAmount } });
export const sourceOriginals = (s: SliceState) => ({ site: s.coffinBearer.life, operation: s.barrenMatriarch.life.operation, rootPad: s.barrenMatriarch.life.rootPad });
export const currentPad = (s: SliceState) => s.natureWalker.life.rootPad ?? s.barrenMatriarch.life.rootPad;
export const currentOriginals = (s: SliceState) => {
  const operation = s.natureWalker.life.source ? s.natureWalker.life.operation : s.barrenMatriarch.life.operation;
  return { site: getNatureWalkerCurrentSite(s), operation: { dormancy: operation.dormancy, buffer: operation.buffer }, rootPad: currentPad(s) };
};
export function actualLifeAbilityUse(s: SliceState) {
  const life = s.natureWalker.life;
  return Object.fromEntries(NATURE_WALKER_ABILITY_IDS.map((id, i) => {
    const cases = NATURE_WALKER_CASE_IDS.filter(k => i === 1 ? k === 'root-impact' : k !== 'root-impact');
    const attempts = cases.flatMap(k => life.cases[k].attempts), tier = (a: typeof attempts[number]) => i === 0 ? a.livingResponseTier : a.rootBearingTier;
    return [id, { paidAttempts: attempts.filter(a => tier(a) !== null).length,
      castingSuccesses: attempts.filter(a => tier(a) === 'SUCCESS' || tier(a) === 'GREAT_SUCCESS').length,
      actualApplications: attempts.filter(a => a.appliedAbilityIds.includes(id)).length,
      reportedApplications: cases.filter(k => life.cases[k].status === 'RESOLVED').flatMap(k => life.cases[k].attempts).filter(a => a.appliedAbilityIds.includes(id)).length,
      spiritualitySpent: attempts.reduce((n, a) => n + a.spiritualitySpent, 0), mindSpent: attempts.reduce((n, a) => n + a.mindSpent, 0) }];
  }));
}
export function actualCombatAbilityUse(s: SliceState, original: SliceState) {
  const actions = s.combatHistory.slice(original.combatHistory.length).flatMap(r => {
    expect(r.natureWalkerOutcome).toBeDefined(); return [...r.natureWalkerOutcome!.playerActions, ...r.natureWalkerOutcome!.enemyActions];
  });
  return Object.fromEntries(NATURE_WALKER_ABILITY_IDS.map((id, i) => {
    const selected = actions.filter(a => a.actor === 'PLAYER' && a.id === id), kind = i === 0 ? 'LIVING_RESPONSE' : 'ROOT_BEARING';
    const applied = actions.flatMap(a => a.windowsApplied).filter(w => w.kind === kind);
    return [id, { selectedSlots: selected.length, paidAttempts: selected.filter(a => a.paidCost > 0).length,
      castingSuccesses: selected.filter(a => a.check?.tier === 'SUCCESS' || a.check?.tier === 'GREAT_SUCCESS').length,
      unresistedSuccesses: selected.filter(a => a.succeeded).length, resistedAttempts: selected.filter(a => a.resisted).length,
      preparedWindows: selected.filter(a => a.windowGranted?.kind === kind).length, actualApplications: applied.length,
      contributionChange: applied.reduce((n, a) => n + a.amount, 0), masteryApplications: actions.filter(a => a.masteryApplied.includes(id)).length,
      spiritualitySpent: selected.reduce((n, a) => n + a.paidCost, 0), mindSpent: selected.reduce((n, a) => n + a.mindCost, 0), supportWearPaid: selected.reduce((n, a) => n + a.supportWearPaid, 0) }];
  }));
}
/** Eight old Mother roots stay immutable. Actual living samples remain47/47,
 * dead sample0, and the sole original pad50/guard segments are never refilled. */
export function assertOriginalContinuity(s: SliceState, original: SliceState): void {
  for (const key of NATURE_WALKER_SOURCE_KEYS) sameCaptureValue(s[key], original[key]);
  sameCaptureValue(s.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  sameCaptureValue(s.seer.completedSources.slice(0, original.seer.completedSources.length), original.seer.completedSources);
  const old = sourceOriginals(original), now = currentOriginals(s), life = s.natureWalker.life;
  if (s.natureWalker.guidanceKnown) {
    sameCaptureValue(s.natureWalker.sourceHistory, Object.fromEntries(NATURE_WALKER_SOURCE_KEYS.map(k => [k, original[k]])));
    sameCaptureValue(s.natureWalker.sourceScene!.originals, old); expect(validateNatureWalkerSource(s)).toBe(true);
  }
  if (s.natureWalker.promotionWeek === null) sameCaptureValue(life, createNatureWalkerLifeState());
  else { expect(life.source!.promotionWeek).toBe(s.natureWalker.promotionWeek); sameCaptureValue(life.source!.originals, old); }
  expect(validateNatureWalkerLifeState(s)).toBe(true); expect(validateNatureWalkerEncounterState(s)).toBe(true);
  sameCaptureValue(now.operation, old.operation); sameCaptureValue(now.site.cases, old.site.cases); sameCaptureValue(now.site.kit, old.site.kit);
  expect(now.site.paper.text).toBe(old.site.paper.text); sameCaptureValue(now.site.paper.sampleIds, old.site.paper.sampleIds);
  expect(Object.hasOwn(now.site, 'playerEnergy')).toBe(false);
  for (const role of ['owner', 'recipient'] as const) {
    expect(Object.hasOwn(now.site[role], 'energy')).toBe(false);
    for (const key of ['id', 'name', 'age', 'alive', 'independentMind', 'health', 'injuries'] as const) sameCaptureValue(now.site[role][key], old.site[role][key]);
  }
  const attempts = NATURE_WALKER_CASE_IDS.flatMap(k => life.cases[k].attempts);
  expect(life.annex.effortSpent).toBe(attempts.reduce((n, a) => n + a.effortSpent, 0)); expect(life.annex.effortSpent).toBeLessThanOrEqual(9);
  expect(now.site.owner.mind).toBe(old.site.owner.mind); expect(now.site.recipient.mind).toBe(old.site.recipient.mind - attempts.reduce((n, a) => n + a.recipientMindSpent, 0));
  expect(now.site.clockSeconds).toBeGreaterThanOrEqual(old.site.clockSeconds); expect(now.site.playerTravelMetres).toBeGreaterThanOrEqual(old.site.playerTravelMetres);
  for (const key of ['box', 'tag', 'paper'] as const) for (const field of ['id', 'owner'] as const) expect(now.site[key][field]).toBe(old.site[key][field]);
  for (const [i, sample] of now.site.samples.entries()) for (const key of ['id', 'owner', 'origin', 'quantity', 'massGrams', 'originalAlive', 'originalVitality', 'alive', 'vitality', 'maximumVitality'] as const) expect(sample[key], `${sample.id}.${key}`).toBe(old.site.samples[i]![key]);
  sameCaptureValue(now.site.pads, old.site.pads.map((p, i) => ({ ...p, holder: now.site.pads[i]!.holder, location: now.site.pads[i]!.location })));
  const mastery = { ...original.progression.mastery };
  if (s.progression.sequence === 1) {
    for (const id of NATURE_WALKER_ABILITY_IDS) mastery[id] = 0;
    for (const id of NATURE_WALKER_CASE_IDS) if (life.cases[id].status === 'RESOLVED') for (const a of life.cases[id].attempts) for (const ability of a.appliedAbilityIds) mastery[ability] = Math.min(500, mastery[ability]! + 8);
  }
  let integrity = old.rootPad.integrity - attempts.reduce((n, a) => n + (a.impact?.padWear ?? 0), 0);
  const guard = structuredClone(old.site.guard), consumed = new Set<string>();
  for (const round of s.combatHistory.slice(original.combatHistory.length)) {
    const o = round.natureWalkerOutcome!; expect(o).toBeDefined(); expect(o.source).toMatchObject({ policy: 'ALL', targetId: 'NW1-ELIAS' });
    expect(o.source.rootPad.integrity).toBe(integrity); sameCaptureValue(o.source.site.guard, guard);
    for (const a of [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order)) {
      expect(a.rootPadBefore.integrity).toBe(integrity); integrity -= a.padWear; expect(a.rootPadAfter.integrity).toBe(integrity); expect(integrity).toBeGreaterThanOrEqual(0);
      if (a.guardSegmentId) { expect(consumed.has(a.guardSegmentId)).toBe(false); const segment = guard.segments.find(x => x.id === a.guardSegmentId)!; expect(segment.status).toBe('UNUSED'); segment.status = 'SPENT'; consumed.add(segment.id); }
      if (a.actor === 'PLAYER' && a.id === NATURE_WALKER_ABILITY_IDS[0]) { expect(a.paidCost).toBe(0); expect(a.mindCost).toBe(0); expect(a.windowGranted).toBeNull(); expect(a.masteryApplied).not.toContain(NATURE_WALKER_ABILITY_IDS[0]); }
      for (const w of a.windowsApplied) { expect(w.kind).toBe('ROOT_BEARING'); expect(w.amount).toBeGreaterThan(0); expect(w.amount).toBeLessThanOrEqual(30); }
      for (const id of a.masteryApplied) { expect(Object.hasOwn(mastery, id)).toBe(true); mastery[id] = Math.min(500, mastery[id]! + 8); }
    }
    expect(o.rootPadAfter.integrity).toBe(integrity); sameCaptureValue(o.siteAfter.guard, guard); expect(o.livingResponseApplications).toBe(0);
  }
  expect(now.rootPad.integrity).toBe(integrity); sameCaptureValue({ ...now.rootPad, integrity: old.rootPad.integrity, location: old.rootPad.location }, old.rootPad);
  expect(now.rootPad.location).toBe(now.site.playerLocation); sameCaptureValue(now.site.guard, guard); sameCaptureValue(s.progression.mastery, mastery);
  const { coreStats, ...identity } = s.character, { coreStats: oldStats, ...oldIdentity } = original.character;
  sameCaptureValue(identity, oldIdentity); for (const k of Object.keys(oldStats) as (keyof typeof oldStats)[]) expect(coreStats[k]).toBe(Math.min(500, oldStats[k] + (s.progression.sequence === 1 ? 1 : 0)));
  expect(s.character.gender).toBe('FEMALE'); expect(s.runId).toBe(original.runId); expect(s.random.seed).toBe(NATURE_WALKER_SEED); expect(s.progression.promotionWeek).toBe(original.progression.promotionWeek);
  assertValidSliceState(s);
}

export async function* captureJsonLines<T>(name: 'commands.jsonl' | 'public.jsonl'): AsyncGenerator<T> {
  const input = createReadStream(`${NATURE_WALKER_ROOT}/${name}`, { encoding: 'utf8' }), lines = createInterface({ input, crlfDelay: Infinity });
  try { for await (const line of lines) { expect(line.length).toBeGreaterThan(0); yield JSON.parse(line) as T; } }
  finally { lines.close(); input.destroy(); }
}
/** Exact PUBLIC ledger body. RNG is checked separately through the private
 * commands ledger and full boundary states; it never belongs in public.jsonl. */
export const capturePublicBody = (s: SliceState) => {
  const p = projectSliceState(s); assertNatureWalkerPublicEvidence(s, p);
  return { status: p.status, week: s.week, date: structuredClone(s.date), health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash, actionsRemaining: s.actionsRemaining,
    natureWalker: p.natureWalker, combat: s.combat?.encounterId === 'NATURE_WALKER_DISPUTE' ? p.combat : null,
    lastCombatRound: s.lastCombatRound?.natureWalkerOutcome ? p.lastCombatRound : null,
    combatHistory: p.combatHistory.filter(r => Object.hasOwn(r, 'natureWalkerOutcome')) };
};
export function assertPublicCaptureControl(s: SliceState, intent: SliceIntent, projected?: ReturnType<typeof projectSliceState>): void {
  expect(validateSlicePayload(intent)).toBe(true); const p = projected ?? projectSliceState(s); assertNatureWalkerPublicEvidence(s, p);
  if (intent.type === 'CONTINUE_LIFE') { expect(s.status).toBe('SLICE_COMPLETE'); expect(s.ending).not.toBeNull(); expect(s.ending!.kind).not.toBe('DEATH'); expect(s.caseArchive).toHaveLength(0); return; }
  expect(s.status).toBe('ACTIVE');
  if (intent.type === 'NATURE_WALKER') {
    const a = p.natureWalker.actions.find(x => stableStringify(x.command) === stableStringify(intent.command)); expect(a).toBeDefined(); expect(a!.enabled, a!.reason ?? '').toBe(true);
  } else if (intent.type === 'ACTION') {
    expect(['WORK', 'REST']).toContain(intent.action); expect(intent.action).toBe(s.wagePaidWeek === s.week ? 'REST' : 'WORK');
    expect(p.canAct, p.actionBlockedReason ?? '').toBe(true); expect(p.natureWalker.insideCase).toBe(false); expect(s.combat).toBeNull(); expect(s.natureWalker.preparedWeek).toBeNull();
  } else if (intent.type === 'EVENT_CHOICE') { expect(s.activeEvent?.instanceId).toBe(intent.eventInstanceId); expect(p.activeEvent?.choices.find(x => x.id === intent.choiceId)?.enabled).toBe(true); }
  else if (intent.type === 'COMBAT_ROUND') {
    expect(intent.stance).toBe(s.combat!.round > 90 ? 'RETREAT' : 'CONTROL'); expect(Object.hasOwn(intent, 'winnerPolicy')).toBe(false);
    expect(s.natureWalker.encounter.policy).toBe('ALL'); expect(s.combat?.encounterId).toBe('NATURE_WALKER_DISPUTE'); expect(p.combat?.stances.some(x => x.id === intent.stance)).toBe(true);
  } else throw new Error(`Unexpected Nature Walker continuation: ${JSON.stringify(intent)}`);
}
export function publicCaptureControl(s: SliceState, intent: SliceIntent): unknown {
  const p = projectSliceState(s); assertPublicCaptureControl(s, intent, p);
  if (intent.type === 'CONTINUE_LIFE') return { kind: 'CONTINUE_LIFE', status: p.status, enabled: true };
  if (intent.type === 'NATURE_WALKER') {
    const a = p.natureWalker.actions.find(x => stableStringify(x.command) === stableStringify(intent.command))!;
    const l = p.natureWalker.life.actions.find(x => stableStringify(x.command) === stableStringify(intent.command));
    if (l) {
      if ('caseId' in intent.command) expect(intent.command.caseId).toBe(NATURE_WALKER_CASE_IDS.find(id => s.natureWalker.life.cases[id].status !== 'RESOLVED'));
      if ('caseId' in intent.command && !['OBSERVE', 'REPORT'].includes(intent.command.type)) expect(l.preferredAction).toBe(true);
      if (['EXIT_ORIGINAL', 'INITIALISE_WORKAREA', 'RENT_ANNEX'].includes(intent.command.type)) expect(l.id).toBe(p.natureWalker.life.preferredActionId);
      if (intent.command.type === 'PREPARE') expect(['ABILITY', 'ORDINARY']).toContain(intent.command.method);
    }
    if (intent.command.type === 'SET_COMBAT_POLICY') expect(intent.command.policy).toBe('ALL');
    if (intent.command.type === 'ENCOUNTER_FIGHT') expect(s.natureWalker.encounter.policy).toBe('ALL'); return structuredClone(a);
  }
  if (intent.type === 'ACTION') return { kind: 'ACTION', action: intent.action, enabled: true };
  if (intent.type === 'EVENT_CHOICE') {
    const choices: Record<string, string> = { ORIGIN: '.decline', 'LIFE-BILL-01': 'PAY_PART', 'DEBT-NOTICE-01': 'DECLINE', 'DEBT-SETTLE-01': 'DEFER', 'LIFE-CARE-01': 'PAY', 'CARE-WORK-OFFER': 'DECLINE' };
    expect(intent.choiceId).toBe(choices[p.activeEvent!.id.startsWith('ORIGIN') ? 'ORIGIN' : p.activeEvent!.id]); return structuredClone(p.activeEvent!.choices.find(x => x.id === intent.choiceId)!);
  }
  if (intent.type !== 'COMBAT_ROUND') throw new Error(`Unexpected continuation: ${JSON.stringify(intent)}`);
  const combat = p.combat!;
  sameCaptureValue(combat.playerCountWheel, NATURE_WALKER_COUNT_WHEEL); sameCaptureValue(combat.enemyCountWheel, NATURE_WALKER_ENEMY_COUNT_WHEEL);
  expect(combat.playerCountWheel.map(w => [w.id, w.weight])).toEqual([['1', 10], ['2', 15], ['3', 25], ['4', 25], ['5', 15], ['6', 10]]);
  sameCaptureValue(combat.playerAbilityWheel, natureWalkerAbilityWheel(s, null));
  if (intent.stance !== 'RETREAT') sameCaptureValue(combat.playerAbilityWheels![intent.stance], natureWalkerAbilityWheel(s, intent.stance));
  sameCaptureValue(combat.enemyAbilityWheel, NATURE_WALKER_ENEMY_ABILITY_WHEEL);
  expect(combat.playerAbilityWheel.map(w => w.id)).toEqual(['STRIKE', 'BODY_FOLLOWUP', 'mother.s2.root-buffer', 'mother.s3.finite-preservation', 'mother.s7.life-support', 'ACCIDENT', ...NATURE_WALKER_ABILITY_IDS]);
  expect(combat.playerAbilityWheel.map(w => w.weight)).toEqual([30, 15, 25, 10, 15, 5, 20, 20].map(w => w * 4 / 560 * 100));
  const source = currentNatureWalkerCombatSource(s)!; expect(source).not.toBeNull(); expect(source.maxActionCount).toBe(6); expect(source.targetId).toBe('NW1-ELIAS'); sameCaptureValue(source.rootPad, currentPad(s));
  expect(source.site.samples.every(x => x.location === 'OUTSIDE')).toBe(true); expect(source.site.owner.location).toBe('OUTSIDE'); expect(source.site.recipient.location).toBe('OUTSIDE');
  const inherited = barrenMatriarchAbilityWheel(s, null); sameCaptureValue(inherited.map(a => a.id), combat.playerAbilityWheel.slice(0, 6).map(a => a.id));
  for (let i = 0; i < 6; i++) expect(Math.abs(inherited[i]!.weight - combat.playerAbilityWheel[i]!.weight * 140 / 100)).toBeLessThan(1e-10);
  return { kind: 'COMBAT_ROUND', stance: intent.stance, round: s.combat!.round, playerCountWheel: combat.playerCountWheel, enemyCountWheel: combat.enemyCountWheel,
    baseAbilityWheel: combat.playerAbilityWheel, actualStanceAbilityWheel: combat.playerAbilityWheels![intent.stance], enemyAbilityWheel: combat.enemyAbilityWheel };
}
