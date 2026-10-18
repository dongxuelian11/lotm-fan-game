import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { WRITER_ABILITY_IDS } from '../../src/domain/writer/types.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';

const ROOT = 'tests/fixtures/writer-v01880';
const SOURCE = 'tests/fixtures/discerner-v01660/natural.json';
const SOURCE_SHA256 = 'c586d61403e2077e480111365a1fc88837f2d9d8f8b1db25571e2587e35de575';
const LEGACY = ['audience', 'mindreader', 'psychologist', 'hypnotist', 'dreamwalker', 'manipulator', 'dreamWeaver', 'discerner'] as const;
const entry = <T>(key: string): T => readObjectEntry<T>(`${ROOT}/natural.json`, key);
const captured = (key: string): SliceState => migrateSliceState(entry<unknown>(key));
const same = (actual: unknown, expected: unknown) => expect(stableStringify(actual)).toBe(stableStringify(expected));
const index = (): Record<string, string> => JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8'));

// Pin raw historical input versions and source bytes. Always migrate loaded
// states before comparing replay output, so future additive schemas still work.
// Actual capture: 667 commands, first potion success, one failed life power,
// and fifth-round player death. Nothing is replaced by a successful branch.
describe('Writer exact original580-command public continuation', () => {
  it('replays the original seed, exact complete prefix and every captured public continuation command', () => {
    const originalCommands = readObjectEntry<SliceIntent[]>(SOURCE, 'commands');
    const commands = entry<SliceIntent[]>('commands');
    expect(createHash('sha256').update(readFileSync(SOURCE)).digest('hex')).toBe(SOURCE_SHA256);
    expect(originalCommands).toHaveLength(580);
    expect(entry<number>('prefixCount')).toBe(580);
    expect(entry<boolean>('prefixVerified')).toBe(true);
    expect(entry<string>('seed')).toBe('audience-rebuild-first');
    expect(entry('provenance')).toMatchObject({ source: SOURCE, sourceSha256: SOURCE_SHA256, newRandomChanges: false });
    same(commands.slice(0, 580), originalCommands);
    same(entry('creation'), readObjectEntry(SOURCE, 'creation'));
    expect(commands).toHaveLength(667);
    expect(createHash('sha256').update(readFileSync(`${ROOT}/natural.json`)).digest('hex')).toBe('7b4a0998bd36ba06108ddb5c8dd7884f474d99145e9f9edbe1b56ba811f35399');
    const raw = entry<SliceState>('final');
    expect([raw.schemaVersion, raw.contentVersion]).toEqual([185, 'writer-v185']);
    const final = captured('final'), prefix = captured('prefixFinal');
    same(prefix, migrateSliceState(readObjectEntry<unknown>(SOURCE, 'final')));
    let state = createSliceRun(final.runId, entry<Parameters<typeof createSliceRun>[1]>('creation'), entry<string>('seed'));
    same(state, captured('initial'));
    for (const [i, intent] of commands.entries()) {
      if (i >= 580 && intent.type === 'WRITER') {
        const action = projectSliceState(state).writer.actions.find(action => stableStringify(action.command) === stableStringify(intent.command));
        expect(action, `Recorded Writer command ${i + 1} must have a current public control`).toBeDefined();
        expect(action!.enabled, action!.reason ?? JSON.stringify(intent)).toBe(true);
      }
      state = applySliceIntent(state, intent);
      if (i === 579) same(state, prefix);
    }
    same(state, final); assertValidSliceState(state);
    expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(state.revision).toBe(captured('initial').revision + commands.length);
    expect(entry('pendingIntent')).toBeNull(); expect(entry('error')).toBeNull();
    expect(entry<string>('stage')).toBe('NATURAL_ACTUAL_TERMINAL');
    expect(Object.keys(index())).toHaveLength(47);
  }, 120_000);

  it('retains all eight original roots, the same 23 old masteries and all eight original zeros', () => {
    const original = captured('prefixFinal'), final = captured('final');
    expect(Object.keys(original.progression.mastery)).toHaveLength(23);
    expect(Object.values(original.progression.mastery).filter(value => value === 0)).toHaveLength(8);
    for (const root of LEGACY) same(final[root], original[root]);
    for (const [id, value] of Object.entries(original.progression.mastery)) expect(final.progression.mastery[id], id).toBe(value);
    expect(Object.keys(original.progression.mastery).filter(id => final.progression.mastery[id] === 0)).toHaveLength(8);
    same(final.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
    expect(final.discerner.encounter.enemyStatus).toBe('SURRENDERED');
    expect(final.character.name).toBe(original.character.name); expect(final.character.gender).toBe(original.character.gender);
    expect(final.progression.promotionWeek).toBe(original.progression.promotionWeek);
    expect(final.random.seed).toBe(original.random.seed);
    same(migrateSliceState(final), final); assertValidSliceState(final);
  });

  it('matches consumed original bottles to their actual saved checks and awards only recorded successful applications', () => {
    const final = captured('final'), writer = final.writer;
    const consumed = writer.bottles.filter(bottle => bottle.status === 'CONSUMED');
    const receipts = writer.acquisitionJournal.filter(receipt => receipt.command.type === 'CONSUME');
    expect(consumed).toHaveLength(receipts.length);
    for (const receipt of receipts) {
      if (receipt.command.type !== 'CONSUME') throw new Error('Expected actual original-bottle consumption.');
      const bottleId = receipt.command.bottleId;
      const bottle = consumed.find(bottle => bottle.id === bottleId);
      expect(bottle).toBeDefined(); expect(receipt.check).not.toBeNull();
      expect(bottle!.outcome).toBe(receipt.check!.tier);
      expect(bottle!.consumedWeek).toBe(receipt.week);
      expect(receipt.randomAfter).toBe(receipt.randomBefore! + 1);
    }
    const promotion = receipts.find(receipt => receipt.after.sequence === 1);
    expect(writer.bottles.map(bottle => bottle.outcome)).toEqual(['SUCCESS', null, null]);
    expect(writer.promotionWeek).toBe(137);
    if (!promotion) throw new Error('The actual first original potion succeeded.');
    expect(final.progression.sequence).toBe(1); expect(Object.keys(final.progression.mastery)).toHaveLength(25);
    for (const id of WRITER_ABILITY_IDS) expect(promotion.after.mastery[id]).toBe(0);
    const cases = ['mutual-clue', 'scheduled-return'] as const;
    WRITER_ABILITY_IDS.forEach((id, i) => {
      const report = writer.life.cases[cases[i]!];
      let expected = report.status === 'RESOLVED' && report.result === 'ABILITY' && report.abilityApplied ? 8 : 0;
      for (const round of final.combatHistory) if (round.writerOutcome) {
        for (const action of [...round.writerOutcome.playerActions, ...round.writerOutcome.enemyActions]) {
          for (const award of action.masteryApplied) if (award === id) expected = Math.min(500, expected + 8);
        }
      }
      expect(final.progression.mastery[id], id).toBe(expected);
    });
    expect(writer.encounter.targetId).toBe('WR1-LUCIAN-VALE');
    expect(writer.encounter.scene.presentMemberIds).toEqual([]);
  });

  it('replays every actual captured combat boundary with its saved command and original random cursor', () => {
    const names = Object.keys(index()).filter(name => /^combat-round-\d+$/.test(name));
    const final = captured('final');
    expect(names).toHaveLength(5);
    expect(final.combatHistory.filter(round => round.writerOutcome).map(round => round.consequenceDomain)).toEqual([undefined, 'BODY', 'BODY', undefined, 'BODY']);
    for (const name of names) {
      const file = `${ROOT}/${index()[name]}`;
      const before = migrateSliceState(readObjectEntry<unknown>(file, 'beforeLast'));
      const intent = readObjectEntry<SliceIntent>(file, 'lastIntent');
      const expected = migrateSliceState(readObjectEntry<unknown>(file, 'final'));
      expect(intent.type).toBe('COMBAT_ROUND'); expect(projectSliceState(before).combat?.writer?.targetId).toBe('WR1-LUCIAN-VALE');
      same(applySliceIntent(before, intent), expected);
      same(expected.discerner, before.discerner);
    }
  }, 60_000);

  it('keeps the failed arrangement, ordinary return and withdrawn permission as they actually happened', () => {
    const final = captured('final'), life = final.writer.life;
    expect(final.progression.acting).toBe(100); expect(life.reflected).toBe(true);
    expect(Object.values(life.cases).map(entry => [entry.status, entry.result, entry.abilityApplied])).toEqual([
      ['RESOLVED', 'ABILITY', true], ['RESOLVED', 'ORDINARY', false], ['RESOLVED', 'ORDINARY', false],
    ]);
    expect(life.cases['mutual-clue'].outcome).toBe('GREAT_SUCCESS');
    expect(life.cases['scheduled-return']).toMatchObject({ outcome: 'FAILURE', arrangementEnd: 'FAILED', returned: true });
    expect(life.cases['withdrawn-request']).toMatchObject({ permission: { ability: 'WITHDRAWN', material: 'GRANTED' }, abilityAttempted: false, returned: true });
    expect(WRITER_ABILITY_IDS.map(id => final.progression.mastery[id])).toEqual([8, 0]);
    expect(life.practice).toMatchObject({ activeCase: null, ownerNode: 'NEAR', elapsedSeconds: 180, ownerWalkedMetres: 48, pendingArrangement: null,
      book: { id: 'WR1-RETURN-BOOK', ownerId: 'WR1-EVELYN', holder: 'SHELF', node: 'FAR' } });
    expect(life.practice.participants.map(person => [person.id, person.present])).toEqual([['WR1-EVELYN', false], ['WR1-THOMAS', false]]);
  });

  it('preserves the actual fifth-round death without an invented retreat, victory, healing or later work', () => {
    const final = captured('final'), encounter = final.writer.encounter;
    expect(final).toMatchObject({ status: 'DEAD', revision: 668, week: 144,
      date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 3, day: 25 }, health: 0, mind: 93, spirituality: 110,
      cash: 400, actionsRemaining: 1, injuryRisk: 2, combat: null, ending: { kind: 'DEATH' },
      random: { seed: 'audience-rebuild-first', cursor: 537 } });
    expect(final.injuries.map(injury => [injury.severity, injury.treatedRevision])).toEqual([['LIGHT', null], ['LIGHT', null]]);
    expect(encounter).toMatchObject({ status: 'LOST', enemyStatus: 'RESISTING', enemyHealth: 100, enemyMind: 56, enemySpirituality: 74,
      reciprocalAttempts: 2, reciprocalSuccesses: 0, arrangementAttempts: 0, arrangementSuccesses: 0,
      terminal: { outcome: 'PLAYER_DEAD', round: 5, exitMetres: 0, exitSeconds: 0 },
      scene: { playerLocation: 'COURT', playerCoordinate: 6, playerTravelMetres: 6 } });
    expect(final.lastCombatRound).toMatchObject({ round: 5, winner: 'ENEMY', consequenceDomain: 'BODY' });
    expect(entry<SliceIntent[]>('commands').at(-1)).toEqual(readObjectEntry(`${ROOT}/${index()['combat-round-5']}`, 'lastIntent'));
    same(final, migrateSliceState(readObjectEntry(`${ROOT}/${index()['combat-round-5']}`, 'final')));
    expect(projectSliceState(final).canAct).toBe(false);
    expect(projectSliceState(final).writer.actions.some(action => action.enabled)).toBe(false);
  });
});
