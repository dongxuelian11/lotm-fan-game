/** Genuine 853-command predecessor and actual owned Sun commands. New promotion
 * d100 controls below are explicit test-only branches, never natural evidence. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import * as predecessor from '../../src/domain/pure-white-angel/index.js';
import { createSunState, projectSun, validateSunState } from '../../src/domain/sun/index.js';
import { getSunPromotionStabilityPreview, snapshotSunOwnedEngine, type SunOwnedEngine } from '../../src/domain/sun/engine.js';
import { openSunRuntimeSession } from '../../src/domain/sun/owned-session.js';
import { SUN_FROZEN_SOURCE_KEYS, sunHistoryDigest } from '../../src/domain/sun/source.js';
import { SUN_HOME } from '../../src/domain/sun/content.js';
import { SUN_ABILITY_IDS, type SunCommand } from '../../src/domain/sun/types.js';
import { sunServiceVerifiedReceipts } from '../../src/domain/sun/services.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const file = 'tests/fixtures/pure-white-angel-v01940/natural.json';
const fileSha = '3f13d554046ecffe3512bda22fb4cd14747be2b06dd6dd47185c025d7d9855f1';
const fullHistoryBudget = 240_000;
const hash = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
let source: SliceState, guided: SliceState, beforeConsume: SliceState;
const commands: SunCommand[] = [{ type: 'LEARN_GUIDANCE' }];
function leaks(value: unknown): string[] {
  const found: string[] = [], privateKeys = new Set(['random','seed','cursor','randomSeed','randomCursor','cursorBefore','cursorAfter',
    'randomReceipts','sourceDigest','historyDigest','acquisitionDigest','originalsDigest','beforeDigest','afterDigest','actorId','source']);
  const visit = (v: unknown, path: string) => {
    if (!v || typeof v !== 'object') return;
    for (const [key, item] of Object.entries(v)) {
      const next = `${path}.${key}`;
      if (privateKeys.has(key)) found.push(next);
      visit(item, next);
    }
  };
  visit(value, '$'); return found;
}
function pinFile() { expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(fileSha); }

beforeAll(() => {
  pinFile(); expect(readObjectEntry<unknown[]>(file, 'commands')).toHaveLength(853);
  const raw = readObjectEntry<SliceState>(file, 'final'), rawHash = hash(raw);
  source = migrateSliceState(raw); expect(hash(raw)).toBe(rawHash);
  expect([source.schemaVersion, source.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  for (const [key, value] of Object.entries(raw)) if (key !== 'schemaVersion' && key !== 'contentVersion')
    expect(hash(source[key as keyof SliceState]), `Migration changed historical ${key}`).toBe(hash(value));
  assertValidSliceState(source);
  guided = applySliceIntent(source, { type: 'SUN', command: { type: 'LEARN_GUIDANCE' } });
  const session = openSunRuntimeSession(guided);
  let state = guided;
  for (;;) {
    const panel = session.projectSun(), next = panel.actions.find(a => a.preferredAction);
    if (commands.length > 300 || !next?.enabled) throw Error(`Sun ordinary route stalled: ${JSON.stringify({ last: commands.slice(-5), week: state.week, cash: state.cash, actions: state.actionsRemaining, location: state.sun.frame?.location, command: next?.command, reason: next?.reason ?? panel.nextStep })}`);
    if (next.command.type === 'CONSUME') { beforeConsume = state; break; }
    const draft = session.prepare({ type: 'SUN', command: next.command }, state.revision);
    expect(session.inspect().revision).toBe(state.revision);
    session.commit(draft); state = session.snapshot(); commands.push(structuredClone(next.command));
    expect(state.status).toBe('ACTIVE');
  }
  pinFile();
}, fullHistoryBudget);

describe('Sun actual-history owned chapter', () => {
  it('preserves the original body,22 skills,six zeros,withdrawn permission and injured surrendered Silas', () => {
    expect(source).toMatchObject({ revision: 854, week: 196, status: 'ACTIVE', health: 100, mind: 98, spirituality: 106, cash: 1250, actionsRemaining: 3,
      random: { seed: 'bard-natural-v029', cursor: 385 }, progression: { pathwayId: 'sun', sequence: 1, acting: 100 }, sun: createSunState() });
    expect(source.pureWhiteAngel.promotionWeek).toBe(186);
    expect(Object.keys(source.progression.mastery)).toHaveLength(22);
    expect(Object.values(source.progression.mastery).filter(n => n === 0)).toHaveLength(6);
    expect(source.lightSeeker.life.site).toMatchObject({ playerLocation: 'ENTRY', operatorLocation: 'SIDE', operatorConsent: 'WITHDRAWN', spiritConsent: 'DECLINED', ordinaryExit: 'OPEN', light: { mode: 'OFF' } });
    expect(source.pureWhiteAngel.encounter).toMatchObject({ enemyStatus: 'SURRENDERED', enemyHealth: 70, materials: { weapon: { charge: 3, capacity: 4 } } });
    expect(source.pureWhiteAngel.encounter.enemyInjuries).toEqual([{ id: 'bard-rebuild-natural:combat:1:ENEMY:853:0', severity: 'HEAVY', acquiredRevision: 853, treatedRevision: null }]);
    expect(guided.cash).toBe(1150); expect(guided.actionsRemaining).toBe(2);
    for (const state of [guided, beforeConsume]) {
      for (const key of SUN_FROZEN_SOURCE_KEYS) expect(hash(state[key])).toBe(hash(source[key]));
      expect(state.combatHistory).toEqual(source.combatHistory);
      expect(state.progression.mastery).toEqual(source.progression.mastery);
      expect(state.random).toEqual(source.random);
      expect(sunHistoryDigest(state)).toBe(sunHistoryDigest(source));
    }
    pinFile();
  });

  it('earns two services,real wages and bills before the same dose pays its bounded preparation', () => {
    const root = beforeConsume.sun, preview = getSunPromotionStabilityPreview(root, 'sun-compound-1');
    expect(sunServiceVerifiedReceipts(root.services!)).toHaveLength(2);
    expect(root.source).toEqual(guided.sun.source);
    expect(root.journal.map(e => e.command)).toEqual(commands.slice(1));
    expect(beforeConsume.week - source.pureWhiteAngel.promotionWeek!).toBeGreaterThanOrEqual(12);
    expect(preview.prepared).toBe(true); expect(preview.preparedChance).toBe(74);
    const tooEarly = structuredClone(root); tooEarly.frame!.budget.week = source.pureWhiteAngel.promotionWeek! + 11;
    expect(getSunPromotionStabilityPreview(tooEarly, 'sun-compound-1').reason).toContain('12个实际周');
    const freshChapter = structuredClone(root); freshChapter.source!.budget.week = beforeConsume.week;
    expect(getSunPromotionStabilityPreview(freshChapter, 'sun-compound-1').prepared).toBe(true);
    expect(getSunPromotionStabilityPreview(freshChapter, 'sun-compound-1').reason).not.toContain('12个实际周');
    const work = root.journal.filter(e => e.command.type === 'WORK');
    expect(work.length).toBeGreaterThan(0); expect(new Set(work.map(e => e.before.budget.week)).size).toBe(work.length);
    for (const event of work) expect(event.after.budget.cash - event.before.budget.cash).toBe(source.character.weeklyWage);
    expect(root.journal.some(e => e.financeReceipts.length > 0)).toBe(true);
    expect(root.materials!.characteristics.map(c => c.holder)).toEqual(['EMBODIED','COMPOUND','COMPOUND']);
    expect(root.materials!.characteristics.slice(1).map(c => c.labour.length)).toEqual([5,5]);
    const paid = root.materials!.receipts.filter(e => e.command.type === 'ACQUIRE_CHARACTERISTIC');
    expect(paid.map(e => e.effect.cashCost)).toEqual([1100,1100]);
    const preparation = root.journal.find(e => e.command.type === 'STABILIZE_PROMOTION')!;
    expect(preparation.after.budget.cash).toBe(preparation.before.budget.cash - 100);
    expect(preparation.after.budget.spirituality).toBe(preparation.before.budget.spirituality - 12);
    expect(preparation.after.budget.mind).toBe(preparation.before.budget.mind - 8);
    expect(preparation.after.nowSecond - preparation.before.nowSecond).toBe(3600);
    const p = root.promotionStability.preparations.at(-1)!;
    expect(p.receipts).toHaveLength(4); expect(p.expiresSecond - p.preparedSecond).toBe(604800);
    const alternateWill = structuredClone(root); alternateWill.frame!.budget.coreStats.will = 31;
    expect(getSunPromotionStabilityPreview(alternateWill, 'sun-compound-1').preparedChance).toBe(76);
  });

  it('keeps raw snapshots detached and hot drafts private without predecessor replay', () => {
    const session = openSunRuntimeSession(beforeConsume), original = hash(session.snapshot());
    const call = vi.spyOn(predecessor, 'validatePureWhiteAngelState');
    try {
      const escaped = session.snapshot(); escaped.sun.source!.budget.cash = 999999; escaped.sun.frame!.budget.cash = 999999;
      const draft = session.prepare({ type: 'SUN', command: { type: 'REST' } }, beforeConsume.revision);
      expect(call).not.toHaveBeenCalled(); expect(hash(session.snapshot())).toBe(original);
      expect(session.inspectDraft(draft).revision).toBe(beforeConsume.revision + 1);
      const escapedDraft = session.snapshotDraft(draft); escapedDraft.cash = 999999;
      expect(session.snapshotDraft(draft).cash).not.toBe(999999);
      session.discard(draft); expect(() => session.commit(draft)).toThrow(); expect(hash(session.snapshot())).toBe(original);
      const other = session.prepare({ type: 'SUN', command: { type: 'REST' } }, beforeConsume.revision);
      session.commit(other); expect(session.inspect().revision).toBe(beforeConsume.revision + 1);
      expect(() => session.commit(other)).toThrow(); expect(() => session.prepare({ type: 'SUN', command: { type: 'REST' } }, beforeConsume.revision)).toThrow();
      expect(() => snapshotSunOwnedEngine({} as SunOwnedEngine)).toThrow();
    } finally { call.mockRestore(); }
  }, fullHistoryBudget);

  it.each([{ roll: 1, tier: 'GREAT_SUCCESS', alive: true }, { roll: 90, tier: 'FAILURE', alive: true }, { roll: 100, tier: 'GREAT_FAILURE', alive: false }])('settles explicit new d100=$roll as $tier without changing any predecessor draw', ({ roll, tier, alive }) => {
    const original = DeterministicActionRandomStream.prototype.nextInt;
    const substitutions: number[] = [];
    const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min: number, max: number) {
      const cursor = this.cursor, actual = original.call(this, min, max);
      if (this.seed === beforeConsume.random.seed && cursor === beforeConsume.random.cursor && min === 1 && max === 100) { substitutions.push(cursor); return roll; }
      return actual;
    });
    try {
      const session = openSunRuntimeSession(beforeConsume), draft = session.prepare({ type: 'SUN', command: { type: 'CONSUME', compoundId: 'sun-compound-1', confirmed: true } }, beforeConsume.revision);
      const after = session.snapshotDraft(draft), result = after.sun.journal.at(-1)!;
      expect(after.random.cursor).toBe(beforeConsume.random.cursor + 1);
      expect(result.randomReceipts).toHaveLength(1); expect(result.randomReceipts[0]!.check).toMatchObject({ chance: 74, roll, tier });
      expect(after.sun.source).toEqual(beforeConsume.sun.source);
      expect(after.spirituality).toBe(beforeConsume.spirituality - 30);
      expect(after.status).toBe(alive ? 'ACTIVE' : 'DEAD');
      if (roll === 1) {
        expect(after.progression.sequence).toBe(0); expect(after.mind).toBe(beforeConsume.mind - 12);
        expect(SUN_ABILITY_IDS.map(id => after.progression.mastery[id])).toEqual([0,0]);
        expect(after.sun.materials!.characteristics.map(c => c.holder)).toEqual(['FUSED','FUSED','FUSED']);
      } else {
        expect(after.progression.sequence).toBe(1); expect(after.sun.promotionWeek).toBeNull();
        expect(SUN_ABILITY_IDS.every(id => !Object.hasOwn(after.progression.mastery, id))).toBe(true);
        expect(after.health).toBe(alive ? beforeConsume.health - 45 : 0);
        expect(after.mind).toBe(alive ? beforeConsume.mind - 40 : 0);
        expect(after.seer.pollution).toBe(Math.min(100, beforeConsume.seer.pollution + (alive ? 35 : 70)));
        expect(after.injuries.at(-1)).toMatchObject({ severity: 'HEAVY', treatedRevision: null });
        expect(after.sun.materials!.compounds[0]!.status).toBe(alive ? 'FAILED_EXPOSED' : 'FAILED_LOST');
      }
      expect(validateSunState(after)).toBe(true);
      const view = session.projectDraftSun(draft); expect(leaks(view)).toEqual([]); expect(JSON.stringify(view)).not.toContain(source.random.seed);
      session.commit(draft); if (!alive) expect(() => session.prepare({ type: 'SUN', command: { type: 'REST' } }, after.revision)).toThrow();
      expect(substitutions.length).toBeGreaterThan(0); expect(substitutions.every(c => c === source.random.cursor)).toBe(true); pinFile();
    } finally { spy.mockRestore(); }
  }, fullHistoryBudget);

  it('requires strict cold replay and rejects edited original people or paid action results', () => {
    const sourceChanged = structuredClone(beforeConsume); sourceChanged.lightSeeker.life.site.operatorEnergy++;
    expect(validateSunState(sourceChanged)).toBe(false);
    const actionChanged = structuredClone(beforeConsume); actionChanged.sun.journal[0]!.after.budget.cash++;
    expect(validateSunState(actionChanged)).toBe(false);
    const bodyChanged = structuredClone(beforeConsume); bodyChanged.cash++;
    expect(validateSunState(bodyChanged)).toBe(false);
    expect(leaks(projectSun(beforeConsume))).toEqual([]);
  }, fullHistoryBudget);

  it('keeps a free physical return available with genuinely exhausted cash and actions', () => {
    const session = openSunRuntimeSession(beforeConsume);
    const act = (command: SunCommand) => { const draft = session.prepare({ type: 'SUN', command }, session.inspect().revision); session.commit(draft); };
    for (let weeks = 0; session.snapshot().cash > 0; weeks++) {
      if (weeks > 200) throw Error('Finite existing cash did not settle to zero under real weekly bills');
      act({ type: 'NEXT_WEEK' });
    }
    while (session.snapshot().actionsRemaining > 0) act({ type: 'REST' });
    const before = session.snapshot(); expect(before.cash).toBe(0); expect(before.actionsRemaining).toBe(0);
    act({ type: 'RETURN_ON_FOOT' }); const after = session.snapshot();
    expect(after.sun.frame!.location).toBe(SUN_HOME); expect(after.cash).toBe(0); expect(after.actionsRemaining).toBe(0);
    expect(after.sun.frame!.nowSecond - before.sun.frame!.nowSecond).toBe(7200);
    expect(after.sun.source).toEqual(beforeConsume.sun.source);
    expect(after.sun.promotionStability.preparations.every(p => p.status !== 'READY')).toBe(true);
  }, fullHistoryBudget);
});
