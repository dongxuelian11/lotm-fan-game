import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createElderState } from '../../src/domain/elder/index.js';
import { validateElderCombatRound, validateElderRoundOutcome } from '../../src/domain/elder/combat.js';
import { validateElderEncounter } from '../../src/domain/elder/encounter.js';

const ROOT = 'tests/fixtures/elder-v01790', NATURAL = `${ROOT}/natural.json`;
const OLD = 'tests/fixtures/three-headed-templar-v01550/natural.json';
const WHISPER = 'hanged-man.s2.low-whisper', CHORUS = 'hanged-man.s2.focused-chorus';
const LEGACY = ['secretSupplicant', 'listener', 'shadowAscetic', 'roseBishop', 'shepherd', 'blackKnight'] as const;
const commands = () => readObjectEntry<SliceIntent[]>(NATURAL, 'commands');
const final = () => migrateSliceState(readObjectEntry<unknown>(NATURAL, 'final'));
const original = () => migrateSliceState(readObjectEntry<unknown>(OLD, 'final'));
function snapshot<K extends keyof SliceState>(name: string, key: K): SliceState[K] { return readObjectEntry<SliceState[K]>(`${ROOT}/snapshot-${name}.json`, key); }
function boundary(name: string) {
  const path = `${ROOT}/boundary-${name}.json`;
  return { beforeLast: readObjectEntry<SliceState>(path, 'beforeLast'), lastIntent: readObjectEntry<SliceIntent>(path, 'lastIntent'), final: readObjectEntry<SliceState>(path, 'final') };
}
async function sha256(path: string): Promise<string> { const hash = createHash('sha256'); for await (const chunk of createReadStream(path)) hash.update(chunk); return hash.digest('hex'); }

/** Actual saved campaign only. No unit budget, stat, seed, cursor or result is
 * substituted. Stream individual fixture roots rather than the full boundary collection. */
describe('Elder actual natural continuation and shared-source invariants', () => {
  it('preserves the exact 500-command source prefix, creation and seed in its real 615-command chain', async () => {
    const all = commands(), prefix = readObjectEntry<SliceIntent[]>(OLD, 'commands');
    expect(prefix).toHaveLength(500); expect(all).toHaveLength(615);
    expect(JSON.stringify(all.slice(0, 500))).toBe(JSON.stringify(prefix));
    expect(readObjectEntry(NATURAL, 'creation')).toEqual(readObjectEntry(OLD, 'creation'));
    expect(readObjectEntry(NATURAL, 'seed')).toBe(readObjectEntry(OLD, 'seed'));
    expect(readObjectEntry(NATURAL, 'prefixCount')).toBe(500); expect(readObjectEntry(NATURAL, 'prefixVerified')).toBe(true);
    expect(readObjectEntry<string[]>(`${ROOT}/summary.json`, 'boundaries')).toHaveLength(53); expect(Object.keys(readObjectEntry<Record<string, string>>(NATURAL, 'snapshots'))).toHaveLength(6);
    expect(readObjectEntry(NATURAL, 'provenance')).toEqual({ kind: 'SAME_SEED_PUBLIC_NATURAL_PREFIX', source: OLD, sourceSha256: await sha256(OLD), newRandomChanges: false });
    expect(readObjectEntry(NATURAL, 'stage')).toBe('NATURAL_ELDER_PUBLIC_CONTINUATION'); expect(readObjectEntry(NATURAL, 'pendingIntent')).toBeNull(); expect(readObjectEntry(NATURAL, 'error')).toBeNull();
    expect(readObjectEntry(NATURAL, 'initial')).toEqual(migrateSliceState(readObjectEntry(OLD, 'initial')));
    expect(all.at(-1)).toEqual({ type: 'ACTION', action: 'WORK' });
    expect(final().random).toEqual({ seed: 'secret-supplicant-natural-v051', cursor: 353 });
  });

  it('continues the same six immutable lower roots, original enemy and uniquely sourced spirits without refills', () => {
    const before = original(), after = final();
    for (const key of LEGACY) expect(after[key]).toEqual(before[key]);
    expect(after.threeHeadedTemplar.encounter).toEqual(before.threeHeadedTemplar.encounter);
    expect(after.threeHeadedTemplar.encounter).toMatchObject({ status: 'RETREATED', targetId: 'THT3-BRAM', enemyHealth: 80, enemyMind: 100, enemySpirituality: 30, enemyStatus: 'RESISTING', weaponLocation: 'HAND' });
    expect(after.elder.life.source!.snapshot).toEqual(before.threeHeadedTemplar.life);
    const oldCourt = before.threeHeadedTemplar.life, court = after.threeHeadedTemplar.life;
    expect(court.spirits['THT3-HELENA']).toEqual(oldCourt.spirits['THT3-HELENA']);
    expect(court.spirits['THT3-HELENA']).toMatchObject({ spirituality: 18, integrity: 60, interrupted: true });
    expect(court.spirits['THT3-ROLAND']).toEqual({ ...oldCourt.spirits['THT3-ROLAND'], spirituality: 21 });
    for (const key of ['leftBox', 'rightBox', 'farSeal', 'cases'] as const) expect(court[key]).toEqual(oldCourt[key]);
    expect(court.card).toEqual({ ...oldCourt.card, travelMetres: oldCourt.card.travelMetres + 24 });
    expect(court.owner).toEqual({ ...oldCourt.owner, location: 'OUTSIDE' }); expect(court.playerLocation).toBe('START');
    expect(after.shepherd.grazing.spirits.find(s => s.id === 'SH5-CEDRIC-1')).toMatchObject({ status: 'RELEASED', releasedWeek: 64 });
    expect(after.blackKnight.life.shade).toMatchObject({ status: 'ISOLATED', controlled: false, roomStatus: 'QUARANTINED', glassHood: 'BROKEN' });
  });

  it('pays the real clinic fee for the original heavy injury before later ordinary rest removes old wounds', () => {
    const before = original(), paid = boundary('clinic-actual-pay60'), recovered = boundary('treated-original-wounds-subsequent-rest');
    expect(before.health).toBe(40); expect(before.injuries.map(i => i.severity)).toEqual(['HEAVY', 'LIGHT', 'LIGHT', 'LIGHT']); expect(before.injuryRisk).toBe(3);
    expect(paid.lastIntent).toMatchObject({ type: 'EVENT_CHOICE', choiceId: 'PAY' });
    expect(paid.beforeLast.health).toBe(48); expect(paid.final.health).toBe(paid.beforeLast.health); expect(paid.final.cash).toBe(paid.beforeLast.cash - 60);
    expect(paid.final.injuries.map(i => i.id)).toEqual(before.injuries.map(i => i.id));
    expect(paid.final.injuries.find(i => i.severity === 'HEAVY')).toMatchObject({ treatedRevision: paid.final.revision });
    expect(paid.final.injuries.filter(i => i.severity === 'LIGHT').every(i => i.treatedRevision === null)).toBe(true);
    expect(readObjectEntry<unknown[]>(NATURAL, 'treatments')).toHaveLength(1);
    expect(recovered.lastIntent).toEqual({ type: 'ACTION', action: 'REST' }); expect(recovered.final.health).toBe(56); expect(recovered.final.injuries).toEqual(paid.final.injuries);
    let healed = migrateSliceState(recovered.final);
    for (const command of commands().slice(504, 507)) { expect(command).toEqual({ type: 'ACTION', action: 'REST' }); healed = applySliceIntent(healed, command); }
    expect(healed.health).toBe(80); expect(healed.injuries).toEqual([]); expect(healed.injuryRisk).toBe(0);
    expect(healed.revision).toBe(snapshot('originalInjuriesRecovered', 'revision')); expect(healed.random).toEqual(snapshot('originalInjuriesRecovered', 'random'));
    expect(snapshot('originalInjuriesRecovered', 'health')).toBe(80); expect(snapshot('originalInjuriesRecovered', 'injuries')).toEqual([]);
    expect(snapshot('combatStart', 'health')).toBe(100); expect(snapshot('combatStart', 'injuries')).toEqual([]);
    expect(final().injuries.map(i => i.id).some(id => before.injuries.some(old => old.id === id))).toBe(false);
  });

  it('adds only two zero-mastery abilities on the actual first-dose success and rewards only two real applications', () => {
    const old = original().progression, promoted = snapshot('promoted', 'progression'), practiced = snapshot('practiced', 'progression'), dose = boundary('consume-elder-potion-1');
    expect(Object.keys(old.mastery)).toHaveLength(13); expect(Object.keys(promoted.mastery)).toHaveLength(15);
    for (const id of Object.keys(old.mastery)) expect(promoted.mastery[id]).toBe(old.mastery[id]);
    expect(promoted.mastery[WHISPER]).toBe(0); expect(promoted.mastery[CHORUS]).toBe(0);
    expect(practiced.mastery[WHISPER]).toBe(8); expect(practiced.mastery[CHORUS]).toBe(8); expect(practiced.acting).toBe(100);
    expect(snapshot('promoted', 'elder').bottles.map(b => [b.status, b.outcome])).toEqual([['CONSUMED', 'SUCCESS'], ['SUPPLIER', null], ['SUPPLIER', null]]);
    expect(dose.final.health).toBe(dose.beforeLast.health); expect(dose.final.spirituality).toBe(dose.beforeLast.spirituality); expect(dose.final.mind).toBe(dose.beforeLast.mind - 15);
    expect(dose.final.character.gender).toBe(dose.beforeLast.character.gender); expect(dose.final.injuries).toEqual(dose.beforeLast.injuries);
  });

  it('records the actual failed paid chorus and manual fallback without claiming an interruption or extra mastery', () => {
    const s = final(), life = s.elder.life, checks = life.journal.filter(e => e.tier !== null);
    expect(checks.map(e => e.tier)).toEqual(['SUCCESS', 'SUCCESS', 'SUCCESS', 'FAILURE']);
    expect(checks.map(e => [e.command.type, e.paid.spirituality, e.paid.mind, e.paid.spiritSpirituality])).toEqual([
      ['LOW_WHISPER', 6, 2, 0], ['FOCUSED_CHORUS', 6, 2, 3], ['LOW_WHISPER', 6, 2, 0], ['FOCUSED_CHORUS', 6, 4, 3],
    ]);
    expect(life.cases['sealed-whisper'].attempts[0]).toMatchObject({ result: 'ABILITY', performed: true, manual: false, appliedAbilityIds: [WHISPER], spiritSpiritualitySpent: 0 });
    expect(life.cases['single-chorus'].attempts[0]).toMatchObject({ result: 'ABILITY', selectedSpiritId: 'THT3-ROLAND', selectedMethod: 'STEADY_HOLD', appliedAbilityIds: [CHORUS], spiritSpiritualitySpent: 3 });
    expect(life.cases['interrupted-chorus'].attempts[0]).toMatchObject({ result: 'ORDINARY', whisperTier: 'SUCCESS', chorusTier: 'FAILURE', selectedSpiritId: 'THT3-ROLAND', performed: false, manual: true, interrupted: false, spiritualitySpent: 12, mindSpent: 6, spiritSpiritualitySpent: 3, spiritIntegrityLost: 0, appliedAbilityIds: [] });
    expect(life.journal.some(e => e.command.type === 'INTERRUPT_CHORUS')).toBe(false);
    expect(life.operation.materials.map(m => [m.status, m.charges, m.spentCharges, m.paidPennies])).toEqual([['RETURNED', 1, 1, 24], ['RETURNED', 1, 1, 24], ['RETURNED', 0, 2, 24]]);
    expect(life.operation.focus).toBeNull(); expect(life.operation.suppressedUntil).toBeNull(); expect(life.operation.contained).toBe(true);
  });

  it('retains the actual two failed combat whispers, physical LIGHT and HEAVY injuries, and third-round ordinary retreat', () => {
    const s = final(), rounds = s.combatHistory.filter(r => r.elderOutcome);
    expect(rounds).toHaveLength(3); expect(rounds.map(r => r.stance)).toEqual(['DEFEND', 'CONTROL', 'RETREAT']);
    expect(rounds.map(r => r.consequenceRoll ?? null)).toEqual([22, 59, null]); expect(rounds.map(r => r.retreat)).toEqual(['NONE', 'NONE', 'SUCCESS']);
    expect(rounds.map(r => r.elderOutcome!.playerHealthAfter)).toEqual([90, 60, 60]); expect(rounds.map(r => r.elderOutcome!.enemySpirituality)).toEqual([108, 90, 90]);
    expect(rounds.flatMap(r => r.elderOutcome!.playerActions).filter(a => a.id === WHISPER)).toHaveLength(2);
    for (const round of rounds) {
      const o = round.elderOutcome!; expect(validateElderCombatRound(round)).toBe(true); expect(validateElderRoundOutcome(o)).toBe(true); expect(round.consequenceDomain).toBe('BODY');
      for (const a of o.playerActions.filter(a => a.id === WHISPER)) expect(a).toMatchObject({ attempted: true, succeeded: false, applied: false, appliedAmount: 0, paidCost: 6, mindCost: 2 });
      expect(o.playerActions.some(a => a.id === CHORUS)).toBe(false);
      expect(o.enemySpirituality).toBe(o.enemySpiritualityBefore - o.enemyActions.reduce((n, a) => n + a.paidCost, 0));
      expect(o.playerSpiritualityAfter).toBe(o.playerSpiritualityBefore - o.playerActions.reduce((n, a) => n + a.paidCost, 0));
      expect(o.rootAfter.spirits).toEqual(o.source.root.spirits);
    }
    expect(s).toMatchObject({ status: 'ACTIVE', health: 60, mind: 94, spirituality: 118, injuryRisk: 1 });
    expect(s.injuries.map(i => [i.severity, i.treatedRevision])).toEqual([['LIGHT', null], ['HEAVY', null]]);
    expect(s.elder.encounter).toMatchObject({ status: 'RETREATED', targetId: 'EL2-BASTIAN', enemyHealth: 100, enemyMind: 100, enemySpirituality: 90, enemyStatus: 'RESISTING', terminal: { exitMetres: 4, exitSeconds: 4 } });
    expect(s.threeHeadedTemplar.life.owner.location).toBe('OUTSIDE'); expect(validateElderEncounter(s)).toBe(true); assertValidSliceState(s);
  });

  it('reapplies representative actual saved boundaries exactly without replaying or altering the entire campaign', () => {
    const cases = ['clinic-actual-pay60', 'treated-original-wounds-subsequent-rest', 'consume-elder-potion-1', 'sealed-whisper-single-natural-whisper-attempt', 'sealed-whisper-actual-short-window-operation',
      'single-chorus-single-natural-chorus-attempt', 'interrupted-chorus-single-natural-chorus-attempt', 'interrupted-chorus-ordinary-fallback', 'three-cases-reflected', 'real-combat-preparation', 'same-mara-ordinary-clearance',
      'independent-optional-fight', 'combat-round-1', 'combat-round-2', 'combat-round-3', 'ordinary-life-after-actual-exit'];
    for (const name of cases) {
      const b = boundary(name), before = migrateSliceState(b.beforeLast), expected = migrateSliceState(b.final), untouched = JSON.stringify(before);
      expect(validateSlicePayload(b.lastIntent), name).toBe(true); const actual = applySliceIntent(before, b.lastIntent);
      expect(actual, name).toEqual(expected); expect(JSON.stringify(before), name).toBe(untouched);
      expect(actual.random.seed, name).toBe('secret-supplicant-natural-v051'); expect(actual.random.cursor, name).toBeGreaterThanOrEqual(before.random.cursor); assertValidSliceState(actual);
    }
  }, 30000);

  it('migrates the real schema175 Sage save without rewriting it and rejects injected Elder history or restored spirit deficits', () => {
    const legacy = readObjectEntry<Record<string, unknown>>('tests/fixtures/sage-v01780/natural.json', 'final'), bytes = JSON.stringify(legacy);
    expect(legacy.schemaVersion).toBe(175); expect('elder' in legacy).toBe(false);
    const migrated = migrateSliceState(legacy); expect(migrated.schemaVersion).toBe(176); expect(migrated.contentVersion).toBe('elder-v176'); expect(migrated.elder).toEqual(createElderState());
    expect({ ...migrated, schemaVersion: legacy.schemaVersion, contentVersion: legacy.contentVersion, elder: undefined }).toEqual({ ...legacy, elder: undefined }); expect(JSON.stringify(legacy)).toBe(bytes);
    expect(() => migrateSliceState({ ...legacy, elder: createElderState() })).toThrow(/Unexpected Elder/);
    const altered = final(); altered.threeHeadedTemplar.life.spirits['THT3-HELENA'].integrity = 100; expect(() => assertValidSliceState(altered)).toThrow();
    const freeSpirit = final(); freeSpirit.threeHeadedTemplar.life.spirits['THT3-ROLAND'].spirituality = 27; expect(() => assertValidSliceState(freeSpirit)).toThrow();
    const forgedApplication = final(); forgedApplication.elder.life.cases['interrupted-chorus'].attempts[0]!.appliedAbilityIds = [CHORUS]; expect(() => assertValidSliceState(forgedApplication)).toThrow();
  });
});
