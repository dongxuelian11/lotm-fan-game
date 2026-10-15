import { createHash } from 'node:crypto';
import { createReadStream, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { createEntropyDukeState, validateEntropyDukeAcquisitionJournal, validateEntropyDukeJournalContinuity } from '../../src/domain/entropy-duke/index.js';
import { ENTROPY_DUKE_ABILITY_IDS } from '../../src/domain/entropy-duke/types.js';
import { validateEntropyDukeCombatRound, ENTROPY_DUKE_ENEMY_ABILITY_WHEEL, ENTROPY_DUKE_ENEMY_COUNT_WHEEL } from '../../src/domain/entropy-duke/combat.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

const ROOT = 'tests/fixtures/entropy-duke-v01830';
const NATURAL = `${ROOT}/natural.json`;
const OLD = 'tests/fixtures/frenzy-mage-v01590/natural.json';
const HASH = '4c986d2f7583cb3bc1595451ce600ec673febb8426970d32f20d3de24afad695';
const entry = <T>(key: string): T => readObjectEntry<T>(NATURAL, key);
const final = () => migrateSliceState(entry<unknown>('final'));
const prefix = () => migrateSliceState(entry<unknown>('prefixFinal'));
const snapshot = (name: string) => migrateSliceState(JSON.parse(readFileSync(`${ROOT}/snapshot-${name}.json`, 'utf8')));
function boundary(name: string) {
  const index = JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
  expect(index[name]).toBe(`boundary-${name}.json`);
  const path = `${ROOT}/${index[name]}`;
  return { beforeLast: migrateSliceState(readObjectEntry(path, 'beforeLast')), lastIntent: readObjectEntry<SliceIntent>(path, 'lastIntent'), final: migrateSliceState(readObjectEntry(path, 'final')) };
}
function oldFacts(s: SliceState, old: SliceState): void {
  for (const key of ['lawyer', 'barbarian', 'corruptionBaron', 'mentorDisorder', 'fallenEarl'] as const) expect(s[key], key).toEqual(old[key]);
  const { gifts: originalGifts, ...originalBriber } = old.briber;
  const { gifts: currentGifts, ...currentBriber } = s.briber;
  expect(currentBriber).toEqual(originalBriber); expect(currentGifts).toHaveLength(originalGifts.length);
  expect(currentGifts.map(g => g.id)).toEqual(originalGifts.map(g => g.id)); expect(currentGifts.slice(0, 10)).toEqual(originalGifts.slice(0, 10));
  const { life: originalLife, ...originalFrenzyMage } = old.frenzyMage;
  const { life: currentLife, ...currentFrenzyMage } = s.frenzyMage;
  expect(currentFrenzyMage).toEqual(originalFrenzyMage);
  if (s.entropyDuke.life.source) {
    expect(s.entropyDuke.life.source.snapshot).toEqual(originalLife);
    expect(currentLife.cases).toEqual(originalLife.cases); expect(currentLife.reflected).toBe(originalLife.reflected);
    expect(currentLife.paper.text).toBe(originalLife.paper.text); expect(currentLife.pads).toEqual(originalLife.pads);
  } else expect(currentLife).toEqual(originalLife);
  expect(s.combatHistory.slice(0, old.combatHistory.length)).toEqual(old.combatHistory);
  expect(s.random.seed).toBe(old.random.seed); expect(s.runId).toBe(old.runId);
  expect(s.character.gender).toBe(old.character.gender); expect(s.character.age).toBe(old.character.age);
  for (const [id, mastery] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id], id).toBe(mastery);
  expect(s.fallenEarl.encounter).toMatchObject({ enemyStatus: 'DEAD', enemyHealth: 0 });
  expect(s.frenzyMage.encounter.status).toBe('AVAILABLE'); expect(Object.hasOwn(s.entropyDuke, 'luck')).toBe(false);
}

describe('Entropy Duke real same-seed continuation and frozen public boundaries', () => {
  it('preserves the original558-command death bytes and continues only its authentic living555-command prefix', async () => {
    const hash = createHash('sha256'); for await (const chunk of createReadStream(OLD)) hash.update(chunk);
    expect(hash.digest('hex')).toBe(HASH);
    expect(entry('provenance')).toEqual({ kind: 'SAME_SEED_ORIGINAL_LIVING_PREFIX_PUBLIC_CONTINUATION', source: OLD, sourceSha256: HASH, newRandomChanges: false });
    const oldCommands = readObjectEntry<SliceIntent[]>(OLD, 'commands'), commands = entry<SliceIntent[]>('commands');
    expect(oldCommands).toHaveLength(558); expect(commands).toHaveLength(743); expect(commands.slice(0, 555)).toEqual(oldCommands.slice(0, 555));
    expect(entry('prefixCount')).toBe(555); expect(entry('prefixVerified')).toBe(true);
    expect(entry('stage')).toBe('NATURAL_ENTROPY_DUKE_PUBLIC_CONTINUATION'); expect(entry('error')).toBeNull(); expect(entry('pendingIntent')).toBeNull();
    const oldDead = migrateSliceState(readObjectEntry(OLD, 'final')), living = prefix();
    expect(oldDead).toMatchObject({ revision: 559, status: 'DEAD', health: 0, injuryRisk: 3, ending: { kind: 'DEATH' } });
    expect(living).toMatchObject({ revision: 556, week: 141, status: 'ACTIVE', health: 100, mind: 100, spirituality: 120, cash: 540, actionsRemaining: 3, injuryRisk: 2, random: { seed: 'lawyer-natural-v063', cursor: 189 } });
    expect(living.injuries).toEqual(oldDead.injuries); expect(living.entropyDuke).toEqual(createEntropyDukeState()); expect(living).toEqual(snapshot('departure'));
    let deadReplay = living; for (const command of oldCommands.slice(555)) deadReplay = applySliceIntent(deadReplay, command);
    expect(deadReplay).toEqual(oldDead); assertValidSliceState(oldDead); assertValidSliceState(living);
  });

  it('replays every one of the743 public commands from original creation and seed into the exact current final save', () => {
    const commands = entry<SliceIntent[]>('commands'), originalCommands = structuredClone(commands), expected = final();
    const creation = entry<Parameters<typeof createSliceRun>[1]>('creation'), seed = entry<string>('seed');
    let replay = createSliceRun(expected.runId, creation, seed);
    expect(replay).toEqual(migrateSliceState(entry<unknown>('initial')));
    for (const [index, command] of commands.entries()) {
      expect(validateSlicePayload(command)).toBe(true); replay = applySliceIntent(replay, command);
      if (index === 554) expect(replay).toEqual(prefix());
    }
    expect(replay).toEqual(expected); expect(commands).toEqual(originalCommands);
    expect(replay.random).toEqual({ seed: 'lawyer-natural-v063', cursor: 228 }); assertValidSliceState(replay);
  }, 30_000);

  it('indexes84 distinct persisted step boundaries within the93 frozen input files', () => {
    const index = JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
    expect(Object.keys(index)).toHaveLength(84); expect(new Set(Object.values(index)).size).toBe(84);
    expect(readdirSync(ROOT).filter(name => name.endsWith('.json'))).toHaveLength(93);
    for (const [name, file] of Object.entries(index)) expect(file).toBe(`boundary-${name}.json`);
    for (const name of ['departure', 'treated', 'promoted', 'practiced', 'combatStart', 'combatTerminal']) {
      const s = snapshot(name), bytes = JSON.stringify(s);
      expect(migrateSliceState(JSON.parse(bytes))).toEqual(s); expect(JSON.stringify(s)).toBe(bytes); assertValidSliceState(s);
    }
  });

  it('pays60 for the two actual untreated heavy wounds and rests without treating health100 as healed', () => {
    const old = prefix(), paid = boundary('clinic-actual-pay60'), treated = snapshot('treated');
    expect(old.injuries.map(i => [i.acquiredRevision, i.severity, i.treatedRevision])).toEqual([[184, 'HEAVY', null], [436, 'HEAVY', null]]);
    expect(paid.beforeLast.health).toBe(100); expect(paid.beforeLast.cash - paid.final.cash).toBe(60);
    expect(paid.final.health).toBe(100); expect(paid.final.injuryRisk).toBe(2);
    for (const injury of old.injuries) expect(paid.final.injuries.find(i => i.id === injury.id)).toEqual({ ...injury, treatedRevision: paid.beforeLast.revision + 1 });
    expect(entry<unknown[]>('treatments')).toHaveLength(1);
    expect(treated).toMatchObject({ week: 142, health: 100, cash: 450, injuries: [], injuryRisk: 0, random: { cursor: 189 } });
    expect(applySliceIntent(paid.beforeLast, paid.lastIntent)).toEqual(paid.final); oldFacts(treated, old); assertValidSliceState(treated);
  });

  it('records exact paid guidance, three different preparations and20 original bottle jobs without free resources', () => {
    const s = snapshot('promoted'), journal = s.entropyDuke.acquisitionJournal;
    const guidance = journal.filter(e => e.command.type === 'LEARN_GUIDANCE'); expect(guidance).toHaveLength(1);
    expect(guidance[0]!.before.cash - guidance[0]!.after.cash).toBe(500); expect(guidance[0]!.before.actions - guidance[0]!.after.actions).toBe(1);
    const tasks = journal.filter(e => e.command.type === 'PREPARE_TASK'); expect(tasks.map(e => e.command.type === 'PREPARE_TASK' && e.command.taskId)).toEqual(['REVIEW_RECORDS', 'CHECK_LIMITS', 'MARK_EXIT']);
    expect(tasks.every(e => e.before.actions - e.after.actions === 1 && e.before.cash === e.after.cash)).toBe(true);
    const work = journal.filter(e => e.command.type === 'POTION_WORK'); expect(work).toHaveLength(20);
    expect(work.every(e => e.before.actions - e.after.actions === 1 && e.before.cash === e.after.cash)).toBe(true);
    const purchases = journal.filter(e => e.command.type === 'BUY_POTION'); expect(purchases).toHaveLength(4);
    expect(purchases.every(e => e.before.cash - e.after.cash === 900 && e.before.actions === e.after.actions)).toBe(true);
    expect(journal.filter(e => e.command.type === 'PREPARE_PROMOTION').every(e => e.before.cash - e.after.cash === 140 && e.before.actions - e.after.actions === 1)).toBe(true);
    expect(journal.reduce((total, e) => total + e.before.cash - e.after.cash, 0)).toBe(4660);
    expect(validateEntropyDukeAcquisitionJournal(s)).toBe(true); expect(validateEntropyDukeJournalContinuity(s)).toBe(true);
  });

  it('retains all three actual failed doses with costs, no successful-bottle fabrication and uninterrupted original RNG', () => {
    for (const number of [1, 2, 3]) {
      const b = boundary(`consume-entropy-duke-potion-${number}`), old = b.beforeLast, s = b.final;
      expect(s.entropyDuke.bottles[number - 1]).toMatchObject({ status: 'CONSUMED', outcome: 'FAILURE', labourSteps: 5, consumedWeek: 143 + number * 8 });
      expect(s.progression).toMatchObject({ sequence: 3, acting: 100 }); expect(s.progression.mastery).toEqual(old.progression.mastery);
      expect([old.health - s.health, old.mind - s.mind, s.spirituality - old.spirituality]).toEqual([15, 25, 0]);
      expect(s.seer.pollution - old.seer.pollution).toBe(30); expect(s.cash).toBe(old.cash); expect(s.actionsRemaining).toBe(old.actionsRemaining);
      expect(s.random).toEqual({ seed: old.random.seed, cursor: old.random.cursor + 1 }); expect(s.entropyDuke.preparedWeek).toBeNull();
      expect(applySliceIntent(old, b.lastIntent)).toEqual(s); oldFacts(s, prefix()); assertValidSliceState(s);
    }
  });

  it('actually requests after exhaustion, receives independent bottles next week and earns fourth-bottle great success', () => {
    const request = boundary('request-supply-after-3-actual-failures'), receive = boundary('receive-next-week-supply-4'), dose = boundary('consume-entropy-duke-potion-4'), s = snapshot('promoted');
    expect(request.final.week).toBe(169); expect(request.final.entropyDuke.resupply.requestedWeek).toBe(169);
    expect(request.beforeLast.actionsRemaining - request.final.actionsRemaining).toBe(1); expect(request.final.entropyDuke.bottles).toEqual(request.beforeLast.entropyDuke.bottles);
    expect(receive.final.week).toBe(170); expect(receive.final.entropyDuke.bottles.slice(0, 3)).toEqual(request.final.entropyDuke.bottles);
    expect(receive.final.entropyDuke.bottles.slice(3).map(b => [b.id, b.stockedWeek, b.status, b.labourSteps])).toEqual([4, 5, 6].map(n => [`entropy-duke-potion-${n}`, 170, 'SUPPLIER', 0]));
    expect(receive.final.random).toEqual(receive.beforeLast.random); expect(receive.final.cash).toBe(receive.beforeLast.cash); expect(receive.final.actionsRemaining).toBe(receive.beforeLast.actionsRemaining);
    expect(s.entropyDuke.bottles.map(b => b.outcome)).toEqual(['FAILURE', 'FAILURE', 'FAILURE', 'GREAT_SUCCESS', null, null]);
    expect(s.entropyDuke).toMatchObject({ promotionWeek: 175, frenzyMageActingAtPromotion: 100, resupply: { requestedWeek: null, deliveries: 1 } });
    expect(s).toMatchObject({ health: 100, mind: 92, spirituality: 120, cash: 20, progression: { sequence: 2, acting: 0 } });
    expect(dose.final.health).toBe(dose.beforeLast.health); expect(dose.final.spirituality).toBe(dose.beforeLast.spirituality); expect(dose.beforeLast.mind - dose.final.mind).toBe(8);
    for (const id of ENTROPY_DUKE_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    expect(Object.keys(s.progression.mastery)).toHaveLength(14); oldFacts(s, prefix()); assertValidSliceState(s);
  });

  it('keeps three failed real amplifications and awards no amplification mastery for ordinary completed flights', () => {
    const s = snapshot('practiced'), cases = s.entropyDuke.life.cases;
    expect(Object.values(cases).map(c => c.result)).toEqual(['ORDINARY', 'ORDINARY', 'ABILITY']);
    for (const c of Object.values(cases)) {
      expect(c).toMatchObject({ status: 'RESOLVED', contactOpen: false, returned: true, closes: 1 });
      const a = c.attempts.at(-1)!; expect(a.amplificationTier).toBe('FAILURE'); expect(a.throwCompleted).toBe(true);
      expect(a.playerTravelMetres).toBe(16); expect(a.ownFlight).toMatchObject({ actor: 'PLAYER', objectId: 'FM3-PRACTICE-BALL', distanceMm: 4000, from: 'A', to: 'B', amplificationApplied: false });
    }
    expect(cases['measured-throw'].attempts.at(-1)).toMatchObject({ spiritualitySpent: 6, mindSpent: 4, waitedSeconds: 4, appliedAbilityIds: [] });
    expect(s.progression.mastery[ENTROPY_DUKE_ABILITY_IDS[0]]).toBe(0); expect(s.progression.mastery[ENTROPY_DUKE_ABILITY_IDS[1]]).toBe(8);
    expect(s.progression.acting).toBe(100); expect(s.entropyDuke.life.reflected).toBe(true); oldFacts(s, prefix()); assertValidSliceState(s);
  });

  it('extends only the existing third original flight to30 seconds and stopping does not rewind it', () => {
    const extended = boundary('lasting-flight-effect_prolongation-5-actual'), stopped = boundary('lasting-flight-stop_input-6-actual'), waited = boundary('lasting-flight-wait_flight-7-actual');
    const before = extended.beforeLast.entropyDuke.life.operation.flight!, after = extended.final.entropyDuke.life.operation.flight!;
    expect(before.landsAt - before.launchedAt).toBe(4); expect(after.landsAt - after.launchedAt).toBe(30);
    expect(after).toMatchObject({ objectId: before.objectId, actor: 'PLAYER', sourceCaseId: 'lasting-flight', prolongations: 1, prolongationApplied: true, amplificationApplied: false });
    expect(after.launchedAt).toBe(before.launchedAt); expect(after.originalLandAt).toBe(before.originalLandAt); expect(after.positionMm).toBeGreaterThan(before.positionMm);
    expect([extended.beforeLast.actionsRemaining - extended.final.actionsRemaining, extended.beforeLast.spirituality - extended.final.spirituality, extended.beforeLast.mind - extended.final.mind]).toEqual([1, 4, 2]);
    expect(stopped.final.entropyDuke.life.operation.flight!.landsAt).toBe(after.landsAt); expect(stopped.final.entropyDuke.life.operation.flight!.positionMm).toBeGreaterThan(after.positionMm);
    expect(waited.final.entropyDuke.life.operation.flight).toBeNull(); expect(waited.final.frenzyMage.life.ball).toMatchObject({ id: before.objectId, holder: 'PAD', location: 'B', quantity: 1 });
    const a = waited.final.entropyDuke.life.cases['lasting-flight'].attempts.at(-1)!;
    expect(a).toMatchObject({ amplificationTier: 'FAILURE', prolongationTier: 'SUCCESS', waitedSeconds: 28, spiritualitySpent: 10, mindSpent: 6, appliedAbilityIds: [ENTROPY_DUKE_ABILITY_IDS[1]] });
    expect(a.landingAt! - a.ownFlight!.launchedAt).toBe(30); expect(applySliceIntent(waited.beforeLast, waited.lastIntent)).toEqual(waited.final); assertValidSliceState(waited.final);
  });

  it('preserves current withdrawal, the same adults, original paper and one returned ball rather than resetting the old scene', () => {
    const s = snapshot('practiced'), old = prefix(), withdrawn = s.entropyDuke.life.cases['withdrawn-flight'].attempts.at(-1)!;
    expect(withdrawn).toMatchObject({ permissionWithdrawn: true, consent: 'WITHDRAWN', result: 'ORDINARY', appliedAbilityIds: [], waitedSeconds: 3 });
    expect(withdrawn.ownFlight!.landsAt - withdrawn.ownFlight!.launchedAt).toBe(4);
    const room = s.frenzyMage.life, original = old.frenzyMage.life;
    expect(room.playerLocation).toBe('START'); expect(room.guide).toEqual(original.guide); expect(room.volunteer.id).toBe(original.volunteer.id);
    expect(room.ball).toMatchObject({ id: original.ball.id, owner: 'GUIDE', holder: 'GUIDE', location: 'START', quantity: 1, massGrams: 80, throws: original.ball.throws + 3, returns: original.ball.returns + 3 });
    expect(room.parcel).toEqual(original.parcel); expect(room.paper).toEqual(original.paper); expect(room.pads).toEqual(original.pads);
    expect(room.playerTravelMetres - original.playerTravelMetres).toBe(48); expect(room.guideTravelMetres - original.guideTravelMetres).toBe(24);
    oldFacts(s, old); assertValidSliceState(s);
  });

  it('pays the actual encounter preparation and clears the same adults and originals by ordinary travel', () => {
    const paid = boundary('real-combat-preparation'), s = snapshot('combatStart'), view = projectSliceState(s);
    expect(paid.beforeLast.mind - paid.final.mind).toBe(2); expect(paid.final.cash).toBe(paid.beforeLast.cash); expect(paid.final.actionsRemaining).toBe(paid.beforeLast.actionsRemaining); expect(paid.final.random).toEqual(paid.beforeLast.random);
    expect(s.entropyDuke.encounter.clearance).toMatchObject({ darianId: 'FM3-DARIAN', darianConsent: 'GRANTED', darianMetres: 8, guideId: 'GUIDE', guideConsent: 'GRANTED', guideMetres: 4, playerMetres: 4, elapsedSeconds: 16, carriedItems: ['FM3-PARCEL', 'FM3-PRACTICE-BALL', 'FM3-ROUTE-PAPER'] });
    expect(s.frenzyMage.life.volunteer.location).toBe('OUTSIDE'); expect(s.frenzyMage.life.guide.location).toBe('OUTSIDE');
    for (const item of [s.frenzyMage.life.parcel, s.frenzyMage.life.ball, s.frenzyMage.life.paper]) expect(item).toMatchObject({ holder: 'GUIDE', location: 'OUTSIDE', quantity: 1 });
    expect(view.combat!.enemyAbilityWheel).toEqual(ENTROPY_DUKE_ENEMY_ABILITY_WHEEL); expect(view.combat!.enemyCountWheel).toEqual(ENTROPY_DUKE_ENEMY_COUNT_WHEEL);
    expect(s.entropyDuke.encounter).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND' }); oldFacts(s, prefix()); assertValidSliceState(s);
  });

  it('retains three actual rounds, paid third-round amplification and autonomous surrender without gifting old mastery', () => {
    const s = snapshot('combatTerminal'), old = prefix(), rounds = s.combatHistory.slice(old.combatHistory.length);
    expect(rounds).toHaveLength(3); for (const round of rounds) expect(validateEntropyDukeCombatRound(round)).toBe(true);
    expect(s.entropyDuke.encounter.terminal).toMatchObject({ outcome: 'ENEMY_SURRENDERED', round: 3, enemyHealth: 60, enemyMind: 100, enemySpirituality: 85, enemyStatus: 'SURRENDERED', exitMetres: 4, exitSeconds: 4 });
    const attacks = rounds[2]!.entropyDukeOutcome!.playerActions.filter(a => a.id === ENTROPY_DUKE_ABILITY_IDS[0]);
    expect(attacks.map(a => a.check!.tier)).toEqual(['GREAT_SUCCESS', 'FAILURE', 'FAILURE']);
    expect(attacks.map(a => [a.paidCost, a.mindCost])).toEqual([[6, 1], [6, 1], [6, 1]]);
    expect(attacks[0]!.selfGain).toBeCloseTo(attacks[0]!.rawContribution * 1.5); expect(attacks[0]!.masteryApplied).toEqual([ENTROPY_DUKE_ABILITY_IDS[0]]);
    for (const attack of attacks.slice(1)) { expect(attack.selfGain).toBe(attack.rawContribution); expect(attack.masteryApplied).toEqual([]); }
    expect(ENTROPY_DUKE_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([8, 8]);
    expect(s).toMatchObject({ status: 'ACTIVE', health: 100, mind: 95, spirituality: 94, injuries: [], injuryRisk: 0 });
    expect(s.entropyDuke.encounter.weaponLocation).toBe('HAND'); expect(s.frenzyMage.life.playerLocation).toBe('START'); oldFacts(s, old); assertValidSliceState(s);
  });

  it('persists ordinary post-exit work, the real weekly bill and exact15 original gifts without replenishment', () => {
    const b = boundary('ordinary-life-after-actual-exit'), s = final(), old = prefix();
    expect(b.lastIntent).toEqual({ type: 'ACTION', action: 'WORK' }); expect(applySliceIntent(b.beforeLast, b.lastIntent)).toEqual(b.final); expect(b.final).toEqual(s);
    expect(s).toMatchObject({ revision: 744, week: 185, health: 100, mind: 95, spirituality: 94, cash: 800, actionsRemaining: 3, injuries: [], injuryRisk: 0, random: { seed: 'lawyer-natural-v063', cursor: 228 } });
    expect(s.date).toEqual(addGameDays(b.beforeLast.date, 7)); expect(s.cash - b.beforeLast.cash).toBe(150); expect(s.entropyDuke.encounter.terminal).toEqual(b.beforeLast.entropyDuke.encounter.terminal);
    expect(s.briber.gifts.slice(10, 12)).toEqual([11, 12].map(n => ({ id: `BR7-GIFT-${n}`, location: 'GIVEN', destination: 'BATTLE:ENTROPY_DUKE_DISPUTE:GROUND', givenWeek: 184 })));
    expect(s.briber.gifts.slice(12)).toEqual(old.briber.gifts.slice(12)); expect(s.briber.gifts).toHaveLength(15);
    expect(s.entropyDuke.encounter.status).toBe('RESOLVED'); expect(s.seer.completedSources).toEqual(b.beforeLast.seer.completedSources); oldFacts(s, old); assertValidSliceState(s);
  });

  it('round-trips the exact current save and rejects unsupported future saves and forged public commands', () => {
    const s = final(), bytes = JSON.stringify(s);
    expect(s.schemaVersion).toBe(CURRENT_SCHEMA_VERSION); expect(s.contentVersion).toBe(CURRENT_CONTENT_VERSION);
    expect(migrateSliceState(JSON.parse(bytes))).toEqual(s); expect(JSON.stringify(s)).toBe(bytes);
    expect(() => migrateSliceState({ ...s, schemaVersion: 999 })).toThrow(); expect(() => assertValidSliceState({ ...s, schemaVersion: 999 })).toThrow();
    for (const command of [{ type: 'ACTION_AMPLIFICATION', caseId: 'unknown' }, { type: 'EFFECT_PROLONGATION', caseId: 'lasting-flight', free: true }, { type: 'CONSUME', bottleId: 'entropy-duke-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'frenzy-mage-potion-1' }]) expect(validateSlicePayload({ type: 'ENTROPY_DUKE', command })).toBe(false);
    for (const command of [{ type: 'CONSUME', bottleId: 'entropy-duke-potion-5', confirmed: true }, { type: 'REQUEST_SUPPLY' }, { type: 'ENCOUNTER_FIGHT' }] as const) expect(() => applySliceIntent(s, { type: 'ENTROPY_DUKE', command })).toThrow();
    expect(JSON.stringify(s)).toBe(bytes); assertValidSliceState(s);
  });
});
