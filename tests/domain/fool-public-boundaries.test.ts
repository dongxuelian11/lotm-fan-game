import { describe, expect, it, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, assertValidSliceState, createSliceRun, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyFoolCommand, createFoolState, foolCommandBlock, hasFoolHistory, hasFoolLock, projectFool, validateFoolCommand, validateFoolState } from '../../src/domain/fool/index.js';
import { foolBudget, foolSourceView } from '../../src/domain/fool/source.js';
import { FOOL_ABILITY_IDS } from '../../src/domain/fool/content.js';
import { FOOL_SOURCE_MATERIAL_IDS } from '../../src/domain/fool/materials.js';
import { FATE_COMMISSIONS } from '../../src/domain/fool/fate-content.js';
import { createVisionaryState, validateVisionaryState } from '../../src/domain/visionary/index.js';
import type { FoolCommand, FoolProjection } from '../../src/domain/fool/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';

/** Boundary candidates only. The historical input fixture stays schema 183.
 * These tests continue its exact captured original, never boost resources,
 * supply a check, reset RNG or claim a generated full campaign capture. */
const fixture = 'tests/fixtures/attendant-mysteries-v01860/natural-battle.json';
let sourceCache: SliceState | undefined;
let guidanceCache: SliceState | undefined;
const source = (): SliceState => structuredClone(sourceCache ??= migrateSliceState(readObjectEntry<unknown>(fixture, 'final')));
const guided = (): SliceState => structuredClone(guidanceCache ??= applySliceIntent(source(), { type: 'FOOL', command: { type: 'LEARN_GUIDANCE' } }));
const perform = (s: SliceState, command: FoolCommand): SliceState => applySliceIntent(s, { type: 'FOOL', command });
const same = (a: unknown, b: unknown): void => expect(stableStringify(a)).toBe(stableStringify(b));
function assertPublicOnly(view: FoolProjection): void {
  expect(Object.keys(view).sort()).toEqual(['title', 'guidanceKnown', 'promoted', 'story', 'nextStep', 'risk', 'resources', 'abilities', 'actions', 'sections', 'insideCase'].sort());
  expect(Object.keys(view.resources).sort()).toEqual(['health', 'mind', 'spirituality', 'cash', 'actionsRemaining'].sort());
  const privateKeys = new Set(['source', 'frame', 'budget', 'root', 'seed', 'cursor', 'random', 'journal', 'receipts', 'randomReceipts', 'checkReceipts', 'roll', 'rolls', 'check', 'checks', 'host', 'authority', 'worldFacts', 'worldDigest', 'originDigest', 'beforeDigest', 'afterDigest', 'guardIntentReceiptId', 'proofId', 'hiddenBranch', 'implementation']);
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) { expect(privateKeys.has(key), key).toBe(false); visit(child); }
  };
  visit(view);
  for (const ability of view.abilities) expect(Object.keys(ability).sort()).toEqual(['id', 'label', 'mastery', 'description'].sort());
  for (const action of view.actions) {
    expect(Object.keys(action).filter(key => !['id', 'label', 'cost', 'enabled', 'reason', 'command', 'preferredAction'].includes(key))).toEqual([]);
    expect(validateFoolCommand(action.command)).toBe(true);
  }
  const prose = [view.title, view.story, view.nextStep, view.risk, ...view.actions.flatMap(a => [a.label, a.cost, a.reason ?? '']), ...view.sections.flatMap(s => [s.title, ...s.lines])].join('\n');
  expect(prose).not.toMatch(/seed|cursor|receipt|digest|UNALTERED_BINDING|VERIFIED_DEVIATION|SHIELD_MAIN|SIDE_CHANNEL|TRAPPED|DORMANT/i);
}

describe('Fool public intent boundary', () => {
  it('accepts only intent fields, including exact nested commands', () => {
    const commands: FoolCommand[] = [
      { type: 'LEARN_GUIDANCE' }, { type: 'RECEPTION_WORK' }, { type: 'RECEPTION_REST' }, { type: 'RECEPTION_NEXT_WEEK' },
      { type: 'ENTER_FATE' }, { type: 'LEAVE_FATE' }, { type: 'START_ESCAPE' },
      { type: 'MATERIAL', command: { type: 'TRACE_REJECTION', itemId: FOOL_SOURCE_MATERIAL_IDS[0]! } },
      { type: 'MATERIAL', command: { type: 'INSPECT_UNIQUENESS' } }, { type: 'MATERIAL', command: { type: 'PREPARE_COMPOUND' } },
      { type: 'FOG', command: { type: 'TRAVEL', to: 'quarry' } },
      { type: 'FATE', command: { type: 'BUY_KIT', itemId: 'original-kit' } },
      { type: 'FATE', command: { type: 'INVESTIGATE_RECOVERY', commissionId: FATE_COMMISSIONS[1]!.id } },
      { type: 'FATE', command: { type: 'CASE', action: { type: 'INSPECT_CONSTRAINT', branch: 'SHIELD_MAIN', kitId: 'original-probe' } } },
      { type: 'FATE', command: { type: 'CASE', action: { type: 'WAIT', seconds: 1 } } },
      { type: 'FATE', command: { type: 'CASE', action: { type: 'WAIT', seconds: 3600 } } },
      { type: 'CONSUME', compoundId: 'original-compound', confirmed: true },
      { type: 'ESCAPE', command: { type: 'MOMENTARY_BLINDNESS' } },
    ];
    for (const command of commands) {
      expect(validateFoolCommand(command), stableStringify(command)).toBe(true);
      expect(validateSlicePayload({ type: 'FOOL', command })).toBe(true);
      expect(validateFoolCommand({ ...command, success: true })).toBe(false);
      expect(validateSlicePayload({ type: 'FOOL', command, host: {} })).toBe(false);
    }
  });
  it.each([
    null, [], { type: 'LEARN_GUIDANCE', source: {} }, { type: 'RECEPTION_WORK', random: { seed: 'forged', cursor: 0 } },
    { type: 'MATERIAL', command: { type: 'TRACE_REJECTION', itemId: FOOL_SOURCE_MATERIAL_IDS[0], proofId: 'forged' } },
    { type: 'MATERIAL', command: { type: 'PREPARE_COMPOUND', host: {} } },
    { type: 'FOG', command: { type: 'SYNC_HOST' } }, { type: 'FOG', command: { type: 'ADVANCE_FOR_CONSUMPTION' } },
    { type: 'FOG', command: { type: 'APPLY_EVENT', eventId: 'rain-worm-lost' } },
    { type: 'FOG', command: { type: 'TRAVEL', to: 'base', rolls: [1] } },
    { type: 'FATE', command: { type: 'ENTER_FIRST_CASE' } }, { type: 'FATE', command: { type: 'SYNC_WORLD' } },
    { type: 'FATE', command: { type: 'BUY_KIT', itemId: 'kit', id: 'forged-host-id' } },
    { type: 'FATE', command: { type: 'VERIFY_RECOVERY', commissionId: 'invented-replacement-ship' } },
    { type: 'FATE', command: { type: 'CASE', action: { type: 'ADVANCE_WORLD', seconds: 60 } } },
    { type: 'FATE', command: { type: 'CASE', action: { type: 'WAIT', seconds: 0 } } },
    { type: 'FATE', command: { type: 'CASE', action: { type: 'WAIT', seconds: 3601 } } },
    { type: 'FATE', command: { type: 'CASE', action: { type: 'WAIT', seconds: 1.5 } } },
    { type: 'FATE', command: { type: 'CASE', action: { type: 'GRAFT', check: { roll: 1 } } } },
    { type: 'CONSUME', compoundId: 'original-compound', confirmed: false },
    { type: 'CONSUME', compoundId: 'original-compound', confirmed: true, result: 'SUCCESS' },
    { type: 'ESCAPE', command: { type: 'MOMENTARY_BLINDNESS', targetAlive: true } },
  ])('rejects supplied facts, checks and non-exact shapes: %j', command => {
    expect(validateFoolCommand(command)).toBe(false);
    expect(validateSlicePayload({ type: 'FOOL', command })).toBe(false);
  });
});

describe('Fool genuine predecessor and publication boundary', () => {
  it('migrates the original183 snapshot with exact original fields and only CURRENT missing defaults', () => {
    const old = readObjectEntry<Record<string, unknown>>(fixture, 'final'), immutable = stableStringify(old);
    expect([old.schemaVersion, old.contentVersion]).toEqual([183, 'attendant-mysteries-v183']);
    expect(Object.hasOwn(old, 'fool')).toBe(false);
    const migrated = migrateSliceState(old), current = migrated as unknown as Record<string, unknown>;
    const defaults = createSliceRun(migrated.runId, readObjectEntry<Parameters<typeof createSliceRun>[1]>(fixture, 'creation'), readObjectEntry<string>(fixture, 'seed')) as unknown as Record<string, unknown>;
    const added = Object.keys(defaults).filter(key => !Object.hasOwn(old, key));
    expect([migrated.schemaVersion, migrated.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(Object.keys(current).filter(key => !Object.hasOwn(old, key)).sort()).toEqual(added.sort());
    for (const [key, value] of Object.entries(old)) if (key !== 'schemaVersion' && key !== 'contentVersion') same(current[key], value);
    for (const key of added) same(current[key], defaults[key]);
    same(migrated.fool, createFoolState()); expect(stableStringify(old)).toBe(immutable);
    expect(() => migrateSliceState({ ...old, fool: createFoolState() })).toThrow();
    expect(() => migrateSliceState({ ...old, visionary: createVisionaryState() })).toThrow();
    expect(() => migrateSliceState({ ...migrated, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
  }, 30_000);
  it('does not allow an ordinary or fabricated sequence-zero actor to acquire the chapter', () => {
    const ordinary = createSliceRun('fool-public-ordinary', sliceDefaultCreationSelection, 'public-boundary');
    expect(validateFoolState(ordinary)).toBe(true); expect(hasFoolHistory(ordinary)).toBe(false);
    expect(foolCommandBlock(ordinary, { type: 'LEARN_GUIDANCE' })).not.toBeNull();
    const fabricated = structuredClone(ordinary); fabricated.progression.pathwayId = 'diviner'; fabricated.progression.sequence = 0;
    expect(validateFoolState(fabricated)).toBe(false); expect(hasFoolLock(fabricated)).toBe(false);
    expect(() => assertValidSliceState(fabricated)).toThrow();
    const otherPath = structuredClone(fabricated); otherPath.progression.pathwayId = 'audience';
    expect(validateFoolState(otherPath)).toBe(true); expect(validateVisionaryState(otherPath)).toBe(false);
    expect(() => assertValidSliceState(otherPath)).toThrow();
  });
  it('learns guidance from the actual final S1 state without adding mastery, resources or revivals', () => {
    const before = source(), immutable = stableStringify(before), after = perform(before, { type: 'LEARN_GUIDANCE' });
    expect(before).toMatchObject({ revision: 1869, week: 15971, status: 'ACTIVE', health: 90, mind: 95, spirituality: 106, cash: 25, actionsRemaining: 3, injuryRisk: 1, progression: { sequence: 1 }, random: { seed: 'seer-rebuild-first', cursor: 932 } });
    expect(after.revision).toBe(before.revision + 1); expect(after.fool.source!.revision).toBe(before.revision);
    same(foolBudget(after), foolBudget(before)); same(after.random, before.random); same(after.miracleWorker.revival, before.miracleWorker.revival);
    same(after.attendantMysteries, before.attendantMysteries); same(after.combatHistory, before.combatHistory); same(after.progression, before.progression);
    expect(after.fool.journal).toEqual([]); expect(after.fool.promotionWeek).toBeNull();
    expect(validateFoolState(after)).toBe(true); expect(hasFoolHistory(after)).toBe(true); expect(hasFoolLock(after)).toBe(true);
    assertValidSliceState(after); expect(stableStringify(before)).toBe(immutable);
    const replayView = foolSourceView(after, after.fool.source!);
    same(foolBudget(replayView), foolBudget(before)); same(replayView.random, before.random);
    for (const s of [before, after]) {
      const abilities = projectFool(s).abilities;
      expect(abilities).toHaveLength(34); expect(abilities.filter(a => a.mastery === 0)).toHaveLength(14);
      for (const ability of abilities) expect(ability.mastery).toBe(before.progression.mastery[ability.id]);
      for (const id of FOOL_ABILITY_IDS) expect(abilities.some(a => a.id === id)).toBe(false);
    }
  }, 30_000);
  it('keeps repeated projection and all displayed command previews pure and public-only', () => {
    const s = guided(), immutable = stableStringify(s), a = projectFool(s), b = projectFool(s);
    assertPublicOnly(a); same(a, b);
    const labour = a.actions.find(action => action.command.type === 'MATERIAL' && action.command.command.type === 'SUPPLIER_WORK');
    expect(labour?.label).toBe('交接劳动1/5：核对原遗产封签与取得账');
    expect(labour?.cost).toBe('1行动，0便士；60秒');
    for (const action of a.actions) {
      const first = foolCommandBlock(s, action.command), second = foolCommandBlock(s, action.command);
      expect(first).toBe(second); expect(action.enabled).toBe(first === null);
    }
    expect(stableStringify(s)).toBe(immutable); same(s.random, s.fool.source!.random);
  }, 60_000);
  it('publishes exact contemporary work/rest budgets while leaving the old S1 reception frozen', () => {
    const initial = guided(), originalReception = structuredClone(initial.attendantMysteries.reception), originalSource = structuredClone(initial.fool.source);
    const work = perform(initial, { type: 'RECEPTION_WORK' });
    expect(work).toMatchObject({ cash: 49, actionsRemaining: 2, health: 90, mind: 95, spirituality: 106 });
    const rest = perform(work, { type: 'RECEPTION_REST' });
    expect(rest).toMatchObject({ cash: 41, actionsRemaining: 1, health: 95, mind: 100, spirituality: 116, injuryRisk: 0 });
    for (const next of [work, rest]) {
      same(foolBudget(next), next.fool.frame!.budget); same(next.random, initial.random);
      same(next.attendantMysteries.reception, originalReception); same(next.fool.source, originalSource);
      same(next.miracleWorker.revival, initial.miracleWorker.revival); same(next.progression.mastery, initial.progression.mastery);
      expect(next.fool.journal.at(-1)!.revision).toBe(next.revision); expect(next.fool.journal.at(-1)!.randomReceipts).toEqual([]);
      expect(validateFoolState(next)).toBe(true); assertValidSliceState(next);
    }
    expect(rest.injuries.filter(i => i.treatedRevision === null)).toHaveLength(0);
    same(foolBudget(initial), originalSource!.budget);
  }, 30_000);
  it('closes old work, rest, life, S1 reception and revival entries after guidance', () => {
    const s = guided(), immutable = stableStringify(s);
    const legacy: SliceIntent[] = [{ type: 'ACTION', action: 'WORK' }, { type: 'ACTION', action: 'REST' }, { type: 'CONTINUE_LIFE' },
      { type: 'ATTENDANT_MYSTERIES', command: { type: 'RECEPTION_WORK' } },
      { type: 'ATTENDANT_MYSTERIES', command: { type: 'RECEPTION_REST' } }];
    for (const intent of legacy) expect(() => applySliceIntent(s, intent)).toThrow();
    // The old revival route is rejected before it can use any old ledger.
    expect(() => applySliceIntent(s, { type: 'MIRACLE_WORKER', command: { type: 'REVIVE_NEARBY', deathId: 'unearned-new-death', confirmed: true } })).toThrow();
    expect(() => perform(s, { type: 'LEARN_GUIDANCE' })).toThrow();
    expect(stableStringify(s)).toBe(immutable);
  }, 30_000);
  it('rejects public/private budget, RNG, journal and frozen-history tampering', () => {
    const authentic = perform(guided(), { type: 'RECEPTION_WORK' });
    const mutations: Array<(s: SliceState) => void> = [
      s => { s.cash++; }, s => { s.revision++; }, s => { s.random.cursor++; }, s => { s.fool.frame!.budget.cash++; },
      s => { s.fool.frame!.random.cursor++; }, s => { s.fool.journal[0]!.after.budget.cash++; },
      s => { s.fool.journal[0]!.command = { type: 'RECEPTION_REST' }; },
      s => { s.fool.journal[0]!.randomReceipts.push({ kind: 'ROLL', min: 1, max: 100, value: 1, cursorBefore: s.random.cursor, cursorAfter: s.random.cursor + 1 }); },
      s => { s.fool.source!.random.seed += ':forged'; }, s => { s.fool.source!.budget.cash++; },
      s => { s.seer.practice.reflected = !s.seer.practice.reflected; }, s => { s.attendantMysteries.reception.work.income++; },
      s => { s.progression.mastery[FOOL_ABILITY_IDS[0]] = 100; },
    ];
    for (const mutate of mutations) { const altered = structuredClone(authentic); mutate(altered); expect(validateFoolState(altered)).toBe(false); expect(foolCommandBlock(altered, { type: 'RECEPTION_WORK' })).not.toBeNull(); }
    expect(validateFoolState(authentic)).toBe(true);
  }, 30_000);
  it('commits a real material check from the unchanged original RNG and exposes no future draw', () => {
    let s = guided();
    for (let count = 0; count < 3; count++) s = perform(s, { type: 'RECEPTION_WORK' });
    s = perform(s, { type: 'RECEPTION_NEXT_WEEK' });
    const original = s.fool.materials!.items.find(item => item.disposition === 'UNLOCATED_REJECTION');
    expect(original).toBeDefined();
    expect(original!.lastKnownLocationId).toBe('new-alder-clearing');
    s = perform(s, { type: 'FOG', command: { type: 'TRAVEL', to: 'new-alder-clearing' } });
    const command: FoolCommand = { type: 'MATERIAL', command: { type: 'TRACE_REJECTION', itemId: original!.id } };
    const before = structuredClone(s), immutable = stableStringify(s), preview = projectFool(s);
    assertPublicOnly(preview); expect(foolCommandBlock(s, command)).toBeNull();
    expect(stableStringify(s)).toBe(immutable);
    // Reproduce the former successful dispatch path: the preflight above, then
    // one apply with the real chronicle side effect and no legacy-context draws.
    const ctx: SeerContext = {
      note: vi.fn((title: string, text: string) => {
        const entry = { id: `record-${s.revision + 1}-${s.chronicle.length}`, week: s.week, title, text };
        s.chronicle.push(entry); s.lastResult = entry;
      }),
      roll: vi.fn(() => { throw Error('duplicate roll'); }), check: vi.fn(() => { throw Error('duplicate check'); }),
    };
    s.lastCheck = null;
    applyFoolCommand(s, command, ctx); s.revision++;
    expect(s.status).toBe('ACTIVE'); // This original material transaction has no death finalization.
    const withoutPreflight = perform(before, command);
    same(withoutPreflight, s); // Includes chronicle, private source/journal, resources and RNG.
    same(withoutPreflight.random, s.random);
    expect(stableStringify(before)).toBe(immutable);
    expect(ctx.roll).not.toHaveBeenCalled(); expect(ctx.check).not.toHaveBeenCalled();
    expect(s.random.seed).toBe(before.random.seed); expect(s.random.cursor).toBeGreaterThan(before.random.cursor);
    expect(s.cash).toBe(before.cash - 60); expect(s.actionsRemaining).toBe(before.actionsRemaining - 1);
    same(foolBudget(s), s.fool.frame!.budget); same(s.random, s.fool.frame!.random);
    same(s.progression.mastery, before.progression.mastery); same(s.miracleWorker.revival, before.miracleWorker.revival);
    const receipt = s.fool.journal.at(-1)!.randomReceipts.find(r => r.kind === 'CHECK');
    expect(receipt).toBeDefined(); expect(receipt!.cursorBefore).toBe(before.random.cursor); expect(receipt!.cursorAfter).toBe(s.random.cursor);
    if (receipt?.kind === 'CHECK') same(s.lastCheck, receipt.check);
    expect(validateFoolState(s)).toBe(true); assertValidSliceState(s);
    const omitted = structuredClone(s); omitted.fool.journal.at(-1)!.randomReceipts = [];
    expect(validateFoolState(omitted)).toBe(false);
    const changed = structuredClone(s); changed.fool.journal.at(-1)!.randomReceipts[0]!.cursorBefore++;
    expect(validateFoolState(changed)).toBe(false);
  }, 30_000);
  it('keeps former public rejection reasons after a failed direct dispatch without leaking private codes', () => {
    const cases: Array<{ state: SliceState; command: FoolCommand }> = [
      { state: guided(), command: { type: 'RECEPTION_WORK', seed: 'must-never-publish-this-seed' } as unknown as FoolCommand },
      { state: guided(), command: { type: 'MATERIAL', command: { type: 'SUPPLIER_WORK', itemId: 'missing-original' } } },
      { state: guided(), command: { type: 'RECEPTION_WORK' } },
    ];
    cases[2]!.state.fool.source!.random.seed += ':must-never-publish-this-seed';
    for (const { state, command } of cases) {
      const stateBytes = stableStringify(state), commandBytes = stableStringify(command);
      const expected = foolCommandBlock(state, command);
      expect(expected).not.toBeNull();
      let rejected: unknown;
      try { perform(state, command); } catch (error) { rejected = error; }
      expect(rejected).toBeInstanceOf(Error);
      expect((rejected as Error).message).toBe(expected);
      expect((rejected as Error).message).not.toMatch(/seed|cursor|receipt|digest|MATERIAL_[A-Z_]+|[A-Z_]{6,}|must-never-publish/i);
      expect(stableStringify(state)).toBe(stateBytes); expect(stableStringify(command)).toBe(commandBytes);
    }
  }, 30_000);
  it('never draws through the old context again and rejects a malformed mutation atomically', () => {
    const s = guided(), immutable = stableStringify(s), ctx: SeerContext = { note: vi.fn(), roll: vi.fn(() => { throw Error('duplicate roll'); }), check: vi.fn(() => { throw Error('duplicate check'); }) };
    expect(() => applyFoolCommand(s, { type: 'RECEPTION_WORK', roll: 1 } as unknown as FoolCommand, ctx)).toThrow();
    expect(stableStringify(s)).toBe(immutable);
    applyFoolCommand(s, { type: 'RECEPTION_WORK' }, ctx); s.revision++;
    expect(ctx.note).toHaveBeenCalledOnce(); expect(ctx.roll).not.toHaveBeenCalled(); expect(ctx.check).not.toHaveBeenCalled();
    same(s.random, s.fool.source!.random); expect(validateFoolState(s)).toBe(true);
    const dead = structuredClone(s); dead.status = 'DEAD'; dead.health = 0;
    expect(foolCommandBlock(dead, { type: 'RECEPTION_WORK' })).not.toBeNull();
    const deadBytes = stableStringify(dead); expect(() => applyFoolCommand(dead, { type: 'RECEPTION_WORK' }, ctx)).toThrow(); expect(stableStringify(dead)).toBe(deadBytes);
  }, 30_000);
});
