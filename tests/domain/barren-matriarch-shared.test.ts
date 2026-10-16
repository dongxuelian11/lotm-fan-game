import { createHash } from 'node:crypto';
import { createReadStream, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { createBarrenMatriarchState, validateBarrenMatriarchAcquisitionJournal, validateBarrenMatriarchJournalContinuity } from '../../src/domain/barren-matriarch/index.js';
import { BARREN_MATRIARCH_ABILITY_IDS } from '../../src/domain/barren-matriarch/types.js';
import { BARREN_MATRIARCH_CASE_IDS, replayBarrenMatriarchLifeRoot, replayBarrenMatriarchLifeRootPad, validateBarrenMatriarchLifeState, type BarrenMatriarchCaseId } from '../../src/domain/barren-matriarch/life.js';
import { validateBarrenMatriarchEncounter } from '../../src/domain/barren-matriarch/encounter.js';
import { barrenMatriarchAbilityWheel, BARREN_MATRIARCH_COUNT_WHEEL, BARREN_MATRIARCH_ENEMY_COUNT_WHEEL, BARREN_MATRIARCH_ENEMY_ABILITY_WHEEL, validateBarrenMatriarchCombatRound } from '../../src/domain/barren-matriarch/combat.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

const ROOT = 'tests/fixtures/barren-matriarch-v01850';
const NATURAL = `${ROOT}/natural.json`;
const ORIGINAL = 'tests/fixtures/coffin-bearer-v01610/natural.json';
const ORIGINAL_HASH = '731c25059489305fc3699c1bdc6fb39489590f30a0f149417210ae4f6aef0fdc';
const PRIOR181 = 'tests/fixtures/balancer-v01840/natural.json';
const PRIOR181_HASH = 'e9437ca076c8f9779f8586970308b03032d4b67a13b0588809966818bda264e1';
const NATURAL_HASH = 'cd557e330303c6ce9efaf9960544f28eb8a4f9058182a1860a38f4edb7298caf';
const SEED = 'cultivator-natural-v069';
const [DORMANCY, BUFFER] = BARREN_MATRIARCH_ABILITY_IDS;
const SNAPSHOTS = ['departure', 'treated', 'promoted', 'practiced', 'combatStart', 'combatTerminal'] as const;
const FINANCE_NAMES = ['zero-ap-paid-bill-and-advance', 'zero-ap-unpaid-bill-interruption', 'zero-ap-second-missed-payment-notice', 'zero-ap-fourth-missed-payment-suspension', 'zero-ap-suspended-shortfall-new-debt'] as const;
const entry = <T>(key: string): T => readObjectEntry<T>(NATURAL, key);
const final = () => migrateSliceState(entry<unknown>('final'));
const prefix = () => migrateSliceState(entry<unknown>('prefixFinal'));
const snapshot = (name: typeof SNAPSHOTS[number]) => migrateSliceState(JSON.parse(readFileSync(`${ROOT}/snapshot-${name}.json`, 'utf8')));
const boundaryIndex = () => JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
const bytes = (value: unknown) => Buffer.from(stableStringify(value));
function same(actual: unknown, expected: unknown, label?: string): void { expect(bytes(actual).equals(bytes(expected)), label).toBe(true); }
function boundaryFile(path: string) {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as { beforeLast: unknown; lastIntent: SliceIntent; final: unknown };
  return { beforeLast: migrateSliceState(raw.beforeLast), lastIntent: raw.lastIntent, final: migrateSliceState(raw.final) };
}
function boundary(name: string) {
  const filename = boundaryIndex()[name]; expect(filename).toBe(`boundary-${name}.json`); return boundaryFile(`${ROOT}/${filename}`);
}
async function sha256(path: string): Promise<string> {
  const hash = createHash('sha256'); for await (const chunk of createReadStream(path)) hash.update(chunk); return hash.digest('hex');
}
const attempt = (s: SliceState, id: BarrenMatriarchCaseId) => s.barrenMatriarch.life.cases[id].attempts.at(-1)!;
function originalFacts(s: SliceState, old: SliceState): void {
  for (const key of ['cultivator', 'physician', 'harvestpriest', 'biologist', 'druid', 'ancientAlchemist'] as const) same(s[key], old[key], key);
  const { life: oldLife, ...oldHistory } = old.coffinBearer, { life: currentLife, ...currentHistory } = s.coffinBearer;
  same(currentHistory, oldHistory, 'all original Coffin Bearer history');
  if (s.barrenMatriarch.life.source) {
    same(s.barrenMatriarch.life.source.snapshot, oldLife, 'immutable original physical source');
    same(currentLife.cases, oldLife.cases); expect(currentLife.reflected).toBe(oldLife.reflected);
    expect(currentLife.paper.text).toBe(oldLife.paper.text); same(currentLife.paper.records.slice(0, oldLife.paper.records.length), oldLife.paper.records);
  } else same(currentLife, oldLife);
  same(s.combatHistory.slice(0, old.combatHistory.length), old.combatHistory);
  expect([s.runId, s.random.seed, s.character.age, s.character.gender, s.character.appearanceDescription, s.progression.promotionWeek])
    .toEqual([old.runId, old.random.seed, old.character.age, old.character.gender, old.character.appearanceDescription, old.progression.promotionWeek]);
  for (const [id, mastery] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id], id).toBe(mastery);
  expect(s.coffinBearer.encounter).toMatchObject({ targetId: 'CB3-NOLAN', status: 'RESOLVED', enemyStatus: 'SURRENDERED', enemyHealth: 50, enemyMind: 100, enemySpirituality: 67 });
}
function rejectsUnchanged(s: SliceState, intent: SliceIntent): void {
  const stateBytes = bytes(s), intentBytes = bytes(intent); expect(() => applySliceIntent(s, intent)).toThrow();
  expect(bytes(s).equals(stateBytes)).toBe(true); expect(bytes(intent).equals(intentBytes)).toBe(true);
}

// Eighteen focused cases: frozen first natural run, separately labelled directed
// finance, and genuine old saves. No cursor search, resource edit or recapture.
describe('Barren Matriarch frozen public continuation and exact persistence', () => {
  it('preserves original file hashes and all674 commands of the wounded living Mother source', async () => {
    expect(await sha256(ORIGINAL)).toBe(ORIGINAL_HASH); expect(await sha256(PRIOR181)).toBe(PRIOR181_HASH); expect(await sha256(NATURAL)).toBe(NATURAL_HASH);
    expect(entry('provenance')).toEqual({ kind: 'SAME_SEED_ORIGINAL_LIVING_BRANCH_PUBLIC_CONTINUATION', source: ORIGINAL, sourceSha256: ORIGINAL_HASH, newRandomChanges: false });
    const originalCommands = readObjectEntry<SliceIntent[]>(ORIGINAL, 'commands'), commands = entry<SliceIntent[]>('commands');
    expect(originalCommands).toHaveLength(674); expect(commands).toHaveLength(851); same(commands.slice(0, 674), originalCommands);
    expect(entry('seed')).toBe(SEED); expect(entry('prefixCount')).toBe(674); expect(entry('prefixVerified')).toBe(true);
    expect(entry('stage')).toBe('NATURAL_BARREN_MATRIARCH_PUBLIC_CONTINUATION'); expect(entry('pendingIntent')).toBeNull(); expect(entry('error')).toBeNull();
    const s = prefix(); same(s, migrateSliceState(readObjectEntry(ORIGINAL, 'final'))); same(s, snapshot('departure'));
    expect(s).toMatchObject({ revision: 675, week: 174, status: 'ACTIVE', health: 50, mind: 100, spirituality: 116, cash: 335, actionsRemaining: 3, injuryRisk: 5,
      character: { gender: 'FEMALE' }, progression: { pathwayId: 'mother', sequence: 3, acting: 100, promotionWeek: 6 }, random: { seed: SEED, cursor: 208 } });
    expect(s.injuries.map(i => [i.acquiredRevision, i.severity, i.treatedRevision])).toEqual([[131, 'HEAVY', null], [671, 'LIGHT', null], [672, 'HEAVY', null], [673, 'LIGHT', null]]);
    expect(Object.keys(s.progression.mastery)).toHaveLength(13); expect(Object.values(s.progression.mastery).filter(value => value === 0)).toHaveLength(3);
    expect(s.barrenMatriarch).toEqual(createBarrenMatriarchState()); originalFacts(s, s); assertValidSliceState(s);
  });

  it('replays all851 commands from original creation and seed through all six exact milestones', () => {
    const commands = entry<SliceIntent[]>('commands'), before = bytes(commands), expected = final();
    const milestones = new Map(SNAPSHOTS.map(name => { const s = snapshot(name); return [s.revision, bytes(s)] as const; }));
    let s = createSliceRun(expected.runId, entry<Parameters<typeof createSliceRun>[1]>('creation'), entry<string>('seed'));
    same(s, migrateSliceState(entry('initial'))); expect(commands).toHaveLength(851);
    for (const command of commands) {
      expect(validateSlicePayload(command)).toBe(true); s = applySliceIntent(s, command);
      const saved = milestones.get(s.revision); if (saved) expect(bytes(s).equals(saved), `revision ${s.revision}`).toBe(true);
    }
    same(s, expected); expect(bytes(commands).equals(before)).toBe(true); expect(s.random).toEqual({ seed: SEED, cursor: 238 }); assertValidSliceState(s);
  }, 30_000);

  it.each([0, 15, 30, 45, 60, 75])('replays15 of all90 public boundaries from offset%s and preserves all six snapshots', (start) => {
    const index = boundaryIndex(); expect(Object.keys(index)).toHaveLength(90); expect(new Set(Object.values(index)).size).toBe(90);
    expect(readdirSync(ROOT).filter(name => name.endsWith('.json'))).toHaveLength(99);
    expect(entry('snapshots')).toEqual(Object.fromEntries(SNAPSHOTS.map(name => [name, `snapshot-${name}.json`])));
    for (const name of Object.keys(index).slice(start, start + 15)) {
      const b = boundary(name), before = bytes(b.beforeLast), intent = bytes(b.lastIntent);
      expect(validateSlicePayload(b.lastIntent), name).toBe(true);
      if (b.lastIntent.type === 'BARREN_MATRIARCH') {
        const command = b.lastIntent.command, action = projectSliceState(b.beforeLast).barrenMatriarch.actions.find(a => bytes(a.command).equals(bytes(command)));
        expect(action, name).toBeDefined(); expect(action!.enabled, name).toBe(true);
      }
      same(applySliceIntent(b.beforeLast, b.lastIntent), b.final, name);
      expect(bytes(b.beforeLast).equals(before), name).toBe(true); expect(bytes(b.lastIntent).equals(intent), name).toBe(true);
      expect(b.final.revision, name).toBe(b.beforeLast.revision + 1); expect(b.final.random.seed, name).toBe(SEED); assertValidSliceState(b.final);
    }
    for (const name of (start === 0 ? SNAPSHOTS : [])) { const s = snapshot(name); same(migrateSliceState(JSON.parse(JSON.stringify(s))), s, name); assertValidSliceState(s); }
  }, 30_000);

  it('discovers the real clinic, pays60 for both same HEAVY wounds, then actually rests four times', () => {
    const old = prefix(), discovery = boundary('clinic-real-discovery'), paid = boundary('clinic-actual-pay60'), treated = snapshot('treated');
    expect(old.careKnown).toBe(false); same(discovery.beforeLast, old); expect(discovery.lastIntent).toEqual({ type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01' });
    expect(discovery.final.careKnown).toBe(true); expect(discovery.final.health).toBe(50); expect(discovery.final.actionsRemaining).toBe(2);
    expect(paid.beforeLast).toMatchObject({ revision: 677, health: 58, cash: 335, injuryRisk: 5 });
    expect(paid.final).toMatchObject({ revision: 678, health: 58, cash: 275, injuryRisk: 5 });
    expect(paid.lastIntent).toMatchObject({ type: 'EVENT_CHOICE', choiceId: 'PAY' });
    expect(paid.final.injuries).toEqual(old.injuries.map(i => i.severity === 'HEAVY' ? { ...i, treatedRevision: 678 } : i));
    expect(entry<unknown[]>('treatments')).toEqual([{ paidPennies: 60, before: { cash: 335, health: 58, risk: 5, week: 174, revision: 677, injuries: old.injuries }, cashAfter: 275, healthAfter: 58, injuriesAfter: paid.final.injuries }]);
    const rests = [1, 2, 3, 4].map(n => boundary(`clinic-real-rest-${n}`));
    expect(rests.map(b => b.final.health)).toEqual([58, 66, 74, 82]); expect(rests.map(b => b.final.injuries.length)).toEqual([4, 4, 4, 0]);
    expect(rests[1]!.beforeLast.cash - rests[1]!.final.cash).toBe(30); expect(rests[1]!.final.date).toEqual(addGameDays(rests[1]!.beforeLast.date, 7));
    same(rests[3]!.final, treated); expect(treated).toMatchObject({ revision: 681, week: 175, health: 82, cash: 245, actionsRemaining: 1, injuryRisk: 0, injuries: [], random: { seed: SEED, cursor: 208 } }); originalFacts(treated, old);
  });

  it('pays500 guidance, three preparations, fifteen actual jobs and three900+140 bottle costs', () => {
    const s = snapshot('promoted'), journal = s.barrenMatriarch.acquisitionJournal; expect(journal).toHaveLength(28);
    const guidance = journal.filter(e => e.command.type === 'LEARN_GUIDANCE'); expect(guidance).toHaveLength(1);
    expect([guidance[0]!.before.cash - guidance[0]!.after.cash, guidance[0]!.before.actions - guidance[0]!.after.actions]).toEqual([500, 1]);
    expect(journal.filter(e => e.command.type === 'PREPARE_TASK').map(e => e.command)).toEqual(['REVIEW_RECORDS', 'CHECK_LIMITS', 'MARK_EXIT'].map(taskId => ({ type: 'PREPARE_TASK', taskId })));
    const jobs = journal.filter(e => e.command.type === 'POTION_WORK'); expect(jobs).toHaveLength(15);
    for (let n = 1; n <= 3; n++) expect(jobs.filter(e => e.command.type === 'POTION_WORK' && e.command.bottleId === `barren-matriarch-potion-${n}`)).toHaveLength(5);
    expect(jobs.every(e => e.before.actions - e.after.actions === 1 && e.before.cash === e.after.cash)).toBe(true);
    expect(journal.filter(e => e.command.type === 'BUY_POTION').map(e => [e.before.cash - e.after.cash, e.before.actions - e.after.actions])).toEqual([[900, 0], [900, 0], [900, 0]]);
    expect(journal.filter(e => e.command.type === 'PREPARE_PROMOTION').map(e => [e.before.cash - e.after.cash, e.before.actions - e.after.actions])).toEqual([[140, 1], [140, 1], [140, 1]]);
    expect(journal.reduce((total, e) => total + e.before.cash - e.after.cash, 0)).toBe(3620);
    expect(s.barrenMatriarch.resupply).toEqual({ requestedWeek: null, deliveries: 0 }); expect(validateBarrenMatriarchAcquisitionJournal(s)).toBe(true); expect(validateBarrenMatriarchJournalContinuity(s)).toBe(true);
  });

  it('retains FAILURE77 and GREAT_FAILURE96 before SUCCESS34, female transformation and no healing', () => {
    const s = snapshot('promoted'), old = prefix(), doses = [1, 2, 3].map(n => boundary(`consume-barren-matriarch-potion-${n}`));
    expect(s.barrenMatriarch.bottles.map(b => [b.status, b.labourSteps, b.consumedWeek, b.outcome])).toEqual([['CONSUMED', 5, 185, 'FAILURE'], ['CONSUMED', 5, 193, 'GREAT_FAILURE'], ['CONSUMED', 5, 202, 'SUCCESS']]);
    expect(doses.map(b => { const e = b.final.barrenMatriarch.acquisitionJournal.at(-1)!; return [e.check!.chance, e.check!.roll, e.check!.tier, e.randomBefore, e.randomAfter]; })).toEqual([[34, 77, 'FAILURE', 208, 209], [34, 96, 'GREAT_FAILURE', 209, 210], [34, 34, 'SUCCESS', 210, 211]]);
    expect(doses.map(b => [b.final.health - b.beforeLast.health, b.final.mind - b.beforeLast.mind, b.final.seer.pollution - b.beforeLast.seer.pollution])).toEqual([[-15, -25, 30], [-25, -45, 60], [0, -15, 0]]);
    for (const b of doses) { expect(b.lastIntent).toMatchObject({ type: 'BARREN_MATRIARCH', command: { type: 'CONSUME', confirmed: true, acceptFeminization: true } }); expect(b.final.spirituality).toBe(b.beforeLast.spirituality); expect(b.final.cash).toBe(b.beforeLast.cash); same(b.final.injuries, b.beforeLast.injuries); }
    same(doses[2]!.final, s); expect(s).toMatchObject({ revision: 770, week: 202, health: 100, mind: 85, spirituality: 120, cash: 135, actionsRemaining: 1, character: { gender: 'FEMALE' }, progression: { sequence: 2, acting: 0 } });
    expect(s.barrenMatriarch).toMatchObject({ promotionWeek: 202, coffinBearerActingAtPromotion: 100, preparedWeek: null }); expect(s.barrenMatriarch.promotionWeek! - old.coffinBearer.promotionWeek!).toBe(37);
    expect(Object.keys(s.progression.mastery)).toHaveLength(15); expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(old.progression.mastery, id))).toEqual([...BARREN_MATRIARCH_ABILITY_IDS]); expect(BARREN_MATRIARCH_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]); originalFacts(s, old);
  });

  it('buys exactly one real plant-fibre pad for30+1AP and binds the immutable same physical nursery source', () => {
    const b = boundary('buy-single-real-root-pad'), s = b.final, old = prefix(), event = s.barrenMatriarch.life.journal.at(-1)!;
    expect(event.paid).toEqual({ actions: 1, spirituality: 0, mind: 0, pennies: 30, health: 0, cashGained: 0 });
    expect([event.budget.cashBefore - event.budget.cashAfter, event.budget.actionsBefore - event.budget.actionsAfter]).toEqual([30, 1]);
    expect(s.barrenMatriarch.life.rootPad).toEqual({ id: 'BM2-ROOT-PAD', sourceId: 'BM2-ROOT-FIBRE-STOCK', material: 'PLANT_FIBRE', quantity: 1, owner: 'PLAYER', holder: 'PLAYER', location: 'START', integrity: 65, acquiredWeek: 202 });
    expect(s.barrenMatriarch.life.source).toMatchObject({ root: 'coffinBearer.life', promotionWeek: 202, introducedWeek: 202 });
    same(s.coffinBearer.life, { ...old.coffinBearer.life, clockSeconds: 506 }); same(s.barrenMatriarch.life.source!.snapshot, old.coffinBearer.life);
    same(s.coffinBearer.life.pads, old.coffinBearer.life.pads); same(s.coffinBearer.life.guard, old.coffinBearer.life.guard); expect(s.random).toEqual(b.beforeLast.random);
    rejectsUnchanged(s, { type: 'BARREN_MATRIARCH', command: { type: 'BUY_ROOT_PAD' } }); originalFacts(s, old);
  });

  it('applies SUCCESS15 dormancy for actual four-metre protected travel, then stops without restoring vitality', () => {
    const b = boundary('bounded-dormancy-bounded_dormancy-8-actual'), s = b.final, event = s.barrenMatriarch.life.journal.at(-1)!;
    expect(event.check).toMatchObject({ ability: 'knowledge', chance: 58, roll: 15, tier: 'SUCCESS' });
    expect(event.source).toMatchObject({ abilityId: DORMANCY, actorLocation: 'B', currentConsent: 'GRANTED', target: 'LIVING_PLANT', maximumSeconds: 60, sample: { id: 'CB3-LIVE-1', alive: true, vitality: 47, massGrams: 500, holder: 'CASE', location: 'B' } });
    expect([b.beforeLast.actionsRemaining - s.actionsRemaining, b.beforeLast.spirituality - s.spirituality, b.beforeLast.mind - s.mind]).toEqual([1, 5, 2]);
    expect(s.barrenMatriarch.life.operation.dormancy).toMatchObject({ createdAt: 529, expiresAt: 589 }); expect(s.progression.mastery[DORMANCY]).toBe(0); expect(s.random.cursor).toBe(212);
    const stopped = boundary('bounded-dormancy-stop-11-actual'); expect(stopped.final.barrenMatriarch.life.operation).toEqual({ dormancy: null, buffer: null });
    expect([stopped.final.health, stopped.final.mind, stopped.final.spirituality, stopped.final.cash]).toEqual([stopped.beforeLast.health, stopped.beforeLast.mind, stopped.beforeLast.spirituality, stopped.beforeLast.cash]);
    const report = boundary('bounded-dormancy-honest-report').final;
    expect(attempt(report, 'bounded-dormancy')).toMatchObject({ result: 'ABILITY', closed: true, stopped: true, sampleReturned: true, kitReturned: true, protectedTravelSeconds: 4, protectedExposureSeconds: 16, ordinaryExposureSeconds: 7, vitalityLost: 0, playerTravelMetres: 24, elapsedSeconds: 55, appliedAbilityIds: [DORMANCY] });
    expect(report.coffinBearer.life.samples[0]).toMatchObject({ vitality: 47, alive: true, holder: 'RECIPIENT', location: 'B' }); expect(BARREN_MATRIARCH_ABILITY_IDS.map(id => report.progression.mastery[id])).toEqual([8, 0]);
  });

  it('keeps GREAT_FAILURE96 costs, current withdrawal and ordinary second-plant vitality49→47', () => {
    const failed = boundary('withdrawn-transfer-bounded_dormancy-7-actual'), withdrawn = boundary('withdrawn-transfer-withdraw_permission-9-actual');
    expect(failed.final.barrenMatriarch.life.journal.at(-1)!.check).toMatchObject({ chance: 58, roll: 96, tier: 'GREAT_FAILURE' });
    expect([failed.beforeLast.actionsRemaining - failed.final.actionsRemaining, failed.beforeLast.spirituality - failed.final.spirituality, failed.beforeLast.mind - failed.final.mind]).toEqual([1, 5, 4]);
    expect(failed.final.barrenMatriarch.life.operation.dormancy).toBeNull(); expect(failed.final.random.cursor).toBe(213);
    expect(attempt(withdrawn.final, 'withdrawn-transfer')).toMatchObject({ consent: 'WITHDRAWN', permissionWithdrawn: true });
    expect([withdrawn.final.mind, withdrawn.final.spirituality, withdrawn.final.cash]).toEqual([withdrawn.beforeLast.mind, withdrawn.beforeLast.spirituality, withdrawn.beforeLast.cash]);
    rejectsUnchanged(withdrawn.final, { type: 'BARREN_MATRIARCH', command: { type: 'BOUNDED_DORMANCY', caseId: 'withdrawn-transfer' } });
    const report = boundary('withdrawn-transfer-honest-report').final;
    expect(attempt(report, 'withdrawn-transfer')).toMatchObject({ result: 'ORDINARY', checkedVitality: 49, vitalityLost: 2, protectedTravelSeconds: 0, ordinaryExposureSeconds: 23, playerTravelMetres: 16, elapsedSeconds: 47, appliedAbilityIds: [], sampleReturned: true, kitReturned: true, closed: true });
    expect(report.coffinBearer.life.samples[1]).toMatchObject({ id: 'CB3-LIVE-2', vitality: 47, alive: true, holder: 'OWNER', location: 'A' }); expect(report.progression.mastery[DORMANCY]).toBe(8);
  });

  it('keeps FAILURE77 buffer costs and safe ordinary support without impact, wear, healing or mastery', () => {
    const failed = boundary('finite-root-buffer-root_buffer-10-actual'), support = boundary('finite-root-buffer-ordinary_support-11-actual'), s = snapshot('practiced');
    expect(failed.final.barrenMatriarch.life.journal.at(-1)!.check).toMatchObject({ ability: 'knowledge', chance: 58, roll: 77, tier: 'FAILURE' });
    expect(failed.final.barrenMatriarch.life.journal.at(-1)!.source).toMatchObject({ abilityId: BUFFER, target: 'PLAYER', maximumSeconds: 30, sample: { id: 'CB3-DRY-1', vitality: 0, alive: false }, rootPad: { id: 'BM2-ROOT-PAD', integrity: 65 } });
    expect([failed.beforeLast.actionsRemaining - failed.final.actionsRemaining, failed.beforeLast.spirituality - failed.final.spirituality, failed.beforeLast.mind - failed.final.mind]).toEqual([1, 6, 4]); expect(failed.final.random.cursor).toBe(214);
    expect(failed.final.barrenMatriarch.life.operation.buffer).toBeNull(); expect(support.final.health).toBe(support.beforeLast.health); same(support.final.barrenMatriarch.life.rootPad, support.beforeLast.barrenMatriarch.life.rootPad);
    expect(attempt(s, 'finite-root-buffer')).toMatchObject({ result: 'ORDINARY', bufferTier: 'FAILURE', checkedAlive: false, checkedVitality: 0, healthLost: 0, spiritualitySpent: 6, mindSpent: 4, playerTravelMetres: 16, elapsedSeconds: 48, appliedAbilityIds: [], impact: { actor: 'PLAYER', target: 'PLAYER', objectId: 'CB3-DRY-1', massGrams: 100, mode: 'ORDINARY_SUPPORT', healthLoss: 0, padWear: 0, bufferApplied: false } });
    expect(s.barrenMatriarch.life.rootPad.integrity).toBe(65); expect(s.progression.mastery[BUFFER]).toBe(0); expect(s.coffinBearer.life.samples[2]).toMatchObject({ alive: false, vitality: 0 });
  });

  it('closes all three original-object cases and preserves genuine travel, records and all13 old weights', () => {
    const s = snapshot('practiced'), old = prefix(), p = s.coffinBearer.life;
    expect(s).toMatchObject({ revision: 844, week: 210, health: 100, mind: 96, spirituality: 114, cash: 585, actionsRemaining: 2, injuries: [], injuryRisk: 0, progression: { acting: 100 } });
    for (const id of BARREN_MATRIARCH_CASE_IDS) expect(s.barrenMatriarch.life.cases[id]).toMatchObject({ status: 'RESOLVED', contactOpen: false, returned: true, closes: 1 });
    expect(s.barrenMatriarch.life).toMatchObject({ reflected: true, activeCase: null, operation: { dormancy: null, buffer: null } });
    expect([p.clockSeconds, p.externalSeconds, p.playerTravelMetres]).toEqual([686, 364, 104]);
    expect(p.owner).toMatchObject({ id: 'CB3-ADA', age: 46, location: 'A', health: 100, mind: 100, alive: true, independentMind: true });
    expect(p.recipient).toMatchObject({ id: 'CB3-LENA', age: 39, location: 'B', health: 100, mind: 100, alive: true, independentMind: true });
    expect(p.samples.map(x => [x.id, x.massGrams, x.vitality, x.alive])).toEqual([['CB3-LIVE-1', 500, 47, true], ['CB3-LIVE-2', 500, 47, true], ['CB3-DRY-1', 100, 0, false]]);
    expect(p.box).toMatchObject({ id: 'CB3-CASE', quantity: 1, capacity: 1, maximumMassGrams: 1000, owner: 'PLAYER', holder: 'OWNER', location: 'A', sampleId: null });
    expect(p.paper.records).toHaveLength(6); same(p.pads, old.coffinBearer.life.pads); same(p.guard, old.coffinBearer.life.guard);
    same(replayBarrenMatriarchLifeRoot(s), p); same(replayBarrenMatriarchLifeRootPad(s), s.barrenMatriarch.life.rootPad); expect(validateBarrenMatriarchLifeState(s)).toBe(true); originalFacts(s, old);
  });

  it('pays2 mind and physically clears the same Ada, Lena, plants and kit before separate Martin combat', () => {
    const preparation = boundary('real-combat-preparation'), cleared = boundary('same-ada-and-lena-ordinary-clearance'), s = snapshot('combatStart'), old = prefix();
    expect(preparation.beforeLast.mind - preparation.final.mind).toBe(2); expect(s).toMatchObject({ revision: 849, week: 211, health: 100, mind: 98, spirituality: 120, cash: 735, actionsRemaining: 1 });
    expect(s.barrenMatriarch.encounter.clearance).toMatchObject({ ownerId: 'CB3-ADA', ownerConsent: 'GRANTED', ownerMetres: 8, ownerRoute: ['A', 'START', 'OUTSIDE'], recipientId: 'CB3-LENA', recipientConsent: 'GRANTED', recipientMetres: 12, recipientRoute: ['B', 'A', 'START', 'OUTSIDE'], playerMetres: 4, elapsedSeconds: 24 });
    expect(cleared.final.coffinBearer.life.clockSeconds - cleared.beforeLast.coffinBearer.life.clockSeconds).toBe(24);
    expect(s.coffinBearer.life.owner.location).toBe('OUTSIDE'); expect(s.coffinBearer.life.recipient.location).toBe('OUTSIDE');
    for (const item of [...s.coffinBearer.life.samples, s.coffinBearer.life.box, s.coffinBearer.life.tag, ...s.coffinBearer.life.pads, s.coffinBearer.life.paper]) expect(item.location).toBe('OUTSIDE');
    expect(s.barrenMatriarch.encounter).toMatchObject({ targetId: 'BM2-MARTIN', status: 'FIGHTING', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND' });
    expect(s.barrenMatriarch.encounter.startSource).toMatchObject({ targetAge: 45, actualBody: true, independentMind: true, thirdPartiesInArea: 0, automaticAllyImmunity: false, freeSkillLibrary: false, randomSeed: SEED, randomCursor: 214 });
    same(s.barrenMatriarch.encounter.originalEncounter, old.coffinBearer.encounter); same(s.barrenMatriarch.encounter.originalHistory, old.combatHistory); originalFacts(s, old); expect(validateBarrenMatriarchEncounter(s)).toBe(true);
  });

  it('projects current wheels and resources while all predecessor commands and terminal opponent stay closed', () => {
    const s = snapshot('combatStart'), before = bytes(s), view = projectSliceState(s), combat = view.combat!;
    expect(combat.playerCountWheel).toEqual(BARREN_MATRIARCH_COUNT_WHEEL); expect(combat.enemyCountWheel).toEqual(BARREN_MATRIARCH_ENEMY_COUNT_WHEEL);
    expect(combat.playerAbilityWheel).toEqual(barrenMatriarchAbilityWheel(s, null)); expect(combat.enemyAbilityWheel).toEqual(BARREN_MATRIARCH_ENEMY_ABILITY_WHEEL);
    expect(combat.playerCountWheel.map(x => x.weight)).toEqual([12, 20, 25, 23, 14, 6]); expect(combat.playerAbilityWheel.map(x => x.weight)).toEqual([30, 15, 25, 10, 15, 5]);
    expect(combat.playerAbilityWheel.some(x => x.id === DORMANCY)).toBe(false); expect(combat.enemyAbilityWheel.map(x => [x.id, x.weight])).toEqual([['ARC_BOLT', 35], ['WARD', 20], ['BODY_STRIKE', 20], ['COMPOSE', 10], ['MENTAL_PRESSURE', 10], ['ACCIDENT', 5]]);
    expect(view.barrenMatriarch.abilities).toHaveLength(15); expect(view.barrenMatriarch.resources).toMatchObject({ health: 100, mind: 98, spirituality: 120 });
    expect(view.coffinBearer.actions).toEqual([]); expect(view.coffinBearer.life.actions).toEqual([]); expect(view.coffinBearer.encounter.actions).toEqual([]);
    expect(JSON.stringify(view.barrenMatriarch)).not.toMatch(/"snapshot"|"journal"|"randomBefore"|"inheritedScene"/); expect(bytes(s).equals(before)).toBe(true);
    const done = final();
    for (const type of ['CULTIVATOR', 'PHYSICIAN', 'HARVESTPRIEST', 'BIOLOGIST', 'DRUID', 'ANCIENT_ALCHEMIST', 'COFFIN_BEARER'] as const) rejectsUnchanged(done, { type, command: { type: 'REFLECT' } } as SliceIntent);
    rejectsUnchanged(done, { type: 'COFFIN_BEARER', command: { type: 'ENCOUNTER_FIGHT' } }); rejectsUnchanged(done, { type: 'BARREN_MATRIARCH', command: { type: 'ENCOUNTER_FIGHT' } });
  });

  it('retains two actual rounds, applied buffer wear/mastery, paid failure and living Martin surrender', () => {
    const s = snapshot('combatTerminal'), old = prefix(), rounds = s.combatHistory.slice(old.combatHistory.length);
    expect(rounds).toHaveLength(2); expect(rounds.map(r => r.stance)).toEqual(['DEFEND', 'CONTROL']); expect(rounds.map(r => r.barrenMatriarchOutcome!.randomCursorAfter)).toEqual([224, 238]);
    for (const round of rounds) expect(validateBarrenMatriarchCombatRound(round)).toBe(true);
    const first = rounds[0]!.barrenMatriarchOutcome!, second = rounds[1]!.barrenMatriarchOutcome!, cast = first.playerActions.find(a => a.id === BUFFER)!;
    expect(cast.check).toMatchObject({ ability: 'will', chance: 56, roll: 53, tier: 'SUCCESS' }); expect([cast.paidCost, cast.mindCost, cast.padWear]).toEqual([6, 1, 0]); expect(cast.masteryApplied).toEqual([]);
    const impact = first.enemyActions.find(a => a.padWear === 15)!; expect(impact).toMatchObject({ id: 'BODY_STRIKE', rawContribution: 20, selfGain: 0, padWear: 15, masteryApplied: [BUFFER], rootPadBefore: { integrity: 65 }, rootPadAfter: { integrity: 50 } }); expect(impact.pendingApplied).toHaveLength(1);
    expect(first.enemyActions.filter(a => a.id === 'MENTAL_PRESSURE' || a.id === 'ARC_BOLT').map(a => [a.id, a.selfGain, a.padWear])).toEqual([['MENTAL_PRESSURE', 45, 0], ['ARC_BOLT', 70, 0]]);
    expect(second.playerActions.find(a => a.id === BUFFER)).toMatchObject({ paidCost: 6, mindCost: 1, check: { roll: 84, tier: 'FAILURE' }, padWear: 0, masteryApplied: [] });
    expect(rounds.flatMap(r => [...r.barrenMatriarchOutcome!.playerActions, ...r.barrenMatriarchOutcome!.enemyActions]).flatMap(a => a.masteryApplied)).toEqual([BUFFER]);
    expect(rounds[1]).toMatchObject({ winner: 'PLAYER', consequenceDomain: 'BODY', consequenceRoll: 79 });
    expect(s.barrenMatriarch.encounter.terminal).toEqual({ outcome: 'ENEMY_SURRENDERED', round: 2, historyIndex: 16, enemyHealth: 70, enemyMind: 100, enemySpirituality: 87, enemyStatus: 'SURRENDERED', exitMetres: 4, exitSeconds: 4 });
    expect(s).toMatchObject({ revision: 851, week: 211, status: 'ACTIVE', health: 100, mind: 96, spirituality: 114, injuries: [], injuryRisk: 0 });
    expect(s.coffinBearer.life.playerLocation).toBe('START'); expect(s.barrenMatriarch.life.rootPad).toMatchObject({ integrity: 50, location: 'START' }); expect(s.coffinBearer.life.guard.segments.map(x => x.status)).toEqual(['SPENT', 'UNUSED', 'UNUSED']);
    expect(BARREN_MATRIARCH_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([8, 8]); originalFacts(s, old);
  });

  it('persists actual post-exit WORK and weekly30 bill without refilling combat resources or resetting originals', () => {
    const b = boundary('ordinary-life-after-actual-exit'), s = final(); same(b.beforeLast, snapshot('combatTerminal')); same(b.final, s);
    expect(b.lastIntent).toEqual({ type: 'ACTION', action: 'WORK' }); expect(s.cash - b.beforeLast.cash).toBe(180 - 30); expect(s.date).toEqual(addGameDays(b.beforeLast.date, 7));
    expect(s).toMatchObject({ revision: 852, week: 212, status: 'ACTIVE', health: 100, mind: 96, spirituality: 114, cash: 885, actionsRemaining: 3, injuries: [], injuryRisk: 0, random: { seed: SEED, cursor: 238 } });
    same(s.barrenMatriarch.encounter, b.beforeLast.barrenMatriarch.encounter); same(s.coffinBearer.life, b.beforeLast.coffinBearer.life); same(s.progression.mastery, b.beforeLast.progression.mastery); same(s.random, b.beforeLast.random);
    expect(s.coffinBearer.life.samples.map(x => x.vitality)).toEqual([47, 47, 0]); expect(s.barrenMatriarch.life.rootPad.integrity).toBe(50);
    expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]); same(migrateSliceState(JSON.parse(JSON.stringify(s))), s); originalFacts(s, prefix()); assertValidSliceState(s);
  });

  it('replays all five explicitly directed finance boundaries and rejects every forged terminal resource', () => {
    const directory = `${ROOT}/directed`, index = JSON.parse(readFileSync(`${directory}/directed.index.json`, 'utf8')) as Record<string, string>;
    expect(Object.keys(index)).toEqual([...FINANCE_NAMES]); expect(new Set(Object.values(index)).size).toBe(5); expect(readdirSync(directory).filter(name => name.endsWith('.json'))).toHaveLength(6);
    const expected = [[178, 970, 18, 'NORMAL', 0, null], [177, 0, 0, 'NORMAL', 0, 'LIFE-BILL-01'], [177, 0, 0, 'NOTICE', 2, 'DEBT-NOTICE-01'], [177, 0, 0, 'SUSPENDED', 4, 'DEBT-SETTLE-01'], [178, 0, 18, 'SUSPENDED', 4, null]];
    for (const [n, name] of FINANCE_NAMES.entries()) {
      expect(index[name]).toBe(`${name}.json`); const path = `${directory}/${index[name]}`;
      expect(readObjectEntry(path, 'provenance')).toBe('DECLARED_UNIT_FINANCIAL_BRANCH_NOT_NATURAL'); expect(readObjectEntry<string>(path, 'sourceDeclaration')).toContain('not a natural result');
      const b = boundaryFile(path), before = bytes(b.beforeLast), s = b.final;
      expect(b.lastIntent).toEqual({ type: 'COMBAT_ROUND', stance: 'RETREAT' }); expect(b.beforeLast.actionsRemaining).toBe(0); same(applySliceIntent(b.beforeLast, b.lastIntent), s, name); expect(bytes(b.beforeLast).equals(before)).toBe(true);
      expect([s.week, s.cash, s.actionsRemaining, s.credit, s.missedWeeks, s.activeEvent?.id ?? null]).toEqual(expected[n]);
      expect([s.health, s.mind, s.spirituality, s.injuryRisk, s.injuries.length, s.random.cursor]).toEqual([50, 83, 116, 5, 4, 215]);
      expect(s.barrenMatriarch.encounter.terminal).toMatchObject({ outcome: 'RETREATED', round: 1, enemyHealth: 100, enemyStatus: 'RESISTING' });
      same(s.injuries, b.beforeLast.injuries); same(s.coffinBearer.life.guard, b.beforeLast.coffinBearer.life.guard); originalFacts(s, prefix()); assertValidSliceState(s);
      for (const mutate of [(v: SliceState) => { v.cash++; }, (v: SliceState) => { v.spirituality++; }, (v: SliceState) => { v.mind++; }, (v: SliceState) => { v.actionsRemaining++; }, (v: SliceState) => { v.random.cursor++; }]) {
        const bad = structuredClone(s); mutate(bad); expect(validateBarrenMatriarchEncounter(bad), name).toBe(false); expect(() => assertValidSliceState(bad), name).toThrow();
      }
      if (n === 4) expect(s.debts.at(-1)).toMatchObject({ remaining: 30, weeklyPayment: 30, createdWeek: 177 });
    }
  }, 20_000);

  it('migrates actual schema181 and159 saves with every existing field intact and every added root at current defaults', () => {
    for (const [path, version, content] of [[PRIOR181, 181, 'balancer-v181'], [ORIGINAL, 159, 'coffin-bearer-v159']] as const) {
      const old = readObjectEntry<Record<string, unknown>>(path, 'final'), before = bytes(old);
      expect([old.schemaVersion, old.contentVersion]).toEqual([version, content]);
      const s = migrateSliceState(old), current = s as unknown as Record<string, unknown>;
      const defaults = createSliceRun(s.runId, readObjectEntry<Parameters<typeof createSliceRun>[1]>(path, 'creation'), readObjectEntry<string>(path, 'seed')) as unknown as Record<string, unknown>;
      const added = Object.keys(defaults).filter(key => !Object.hasOwn(old, key)); expect(added).toContain('barrenMatriarch');
      expect(Object.keys(current).filter(key => !Object.hasOwn(old, key)).sort()).toEqual([...added].sort());
      for (const key of Object.keys(old)) if (key !== 'schemaVersion' && key !== 'contentVersion') same(current[key], old[key], `${path}: preserved ${key}`);
      for (const key of added) same(current[key], defaults[key], `${path}: default ${key}`);
      expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]); same(migrateSliceState(s), s); expect(bytes(old).equals(before)).toBe(true); assertValidSliceState(s);
    }
  }, 20_000);

  it('rejects future or forged-new-root old saves and current source, finance, physical or public-payload forgery', () => {
    for (const path of [PRIOR181, ORIGINAL]) {
      const old = readObjectEntry<Record<string, unknown>>(path, 'final'), oldBytes = bytes(old);
      expect(() => migrateSliceState({ ...old, schemaVersion: 999 })).toThrow(); expect(() => assertValidSliceState({ ...old, schemaVersion: 999 })).toThrow();
      expect(() => migrateSliceState({ ...old, barrenMatriarch: createBarrenMatriarchState() })).toThrow();
      expect(bytes(old).equals(oldBytes)).toBe(true);
    }
    const s = snapshot('combatStart'), before = bytes(s);
    for (const mutate of [
      (v: SliceState) => { v.barrenMatriarch.life.rootPad.integrity++; },
      (v: SliceState) => { v.barrenMatriarch.life.source!.snapshot.samples[0]!.vitality++; },
      (v: SliceState) => { v.barrenMatriarch.encounter.preparation!.finance.weeklyBudget++; },
      (v: SliceState) => { v.barrenMatriarch.encounter.startSource!.targetId = 'CB3-NOLAN' as never; },
      (v: SliceState) => { v.coffinBearer.life.samples[2]!.alive = true; },
      (v: SliceState) => { v.coffinBearer.life.guard.segments[0]!.status = 'UNUSED'; },
      (v: SliceState) => { v.coffinBearer.encounter.enemyStatus = 'RESISTING'; },
      (v: SliceState) => { v.progression.mastery['mother.s8.condition-observation'] = 1; },
    ]) { const bad = structuredClone(s); mutate(bad); expect(() => assertValidSliceState(bad)).toThrow(); }
    for (const command of [{ type: 'BUY_ROOT_PAD', free: true }, { type: 'BOUNDED_DORMANCY', caseId: 'unknown' }, { type: 'BOUNDED_DORMANCY', caseId: 'bounded-dormancy', target: 'CB3-LENA' }, { type: 'ROOT_BUFFER', caseId: 'finite-root-buffer', health: 100 }, { type: 'CONSUME', bottleId: 'barren-matriarch-potion-1', confirmed: true, acceptFeminization: false }, { type: 'BUY_POTION', bottleId: 'coffin-bearer-potion-1' }]) expect(validateSlicePayload({ type: 'BARREN_MATRIARCH', command })).toBe(false);
    expect(() => migrateSliceState({ ...s, schemaVersion: 999 })).toThrow(); expect(() => assertValidSliceState({ ...s, schemaVersion: 999 })).toThrow();
    expect(bytes(s).equals(before)).toBe(true); assertValidSliceState(s);
  });
});
