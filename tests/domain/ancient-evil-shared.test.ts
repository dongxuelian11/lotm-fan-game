import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createAncientEvilState } from '../../src/domain/ancient-evil/index.js';
import { ANCIENT_EVIL_ABILITY_IDS, ANCIENT_EVIL_PREPARATION_IDS } from '../../src/domain/ancient-evil/types.js';
import { ANCIENT_EVIL_CASE_IDS, ancientEvilLifeClosed } from '../../src/domain/ancient-evil/life.js';
import { ANCIENT_EVIL_BLOCK_IDS } from '../../src/domain/ancient-evil/encounter.js';
import { ANCIENT_EVIL_ENEMY_ABILITY_WHEEL, ANCIENT_EVIL_ENEMY_COUNT_WHEEL, currentAncientEvilCombatSource,
  drawAncientEvilEnemyAbility, replayAncientEvilCombatRound, validateAncientEvilCombatRound } from '../../src/domain/ancient-evil/combat.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const directory = 'tests/fixtures/ancient-evil-v01810';
const naturalPath = `${directory}/natural.json`;
const originalPath = 'tests/fixtures/silent-disciple-v01570/natural.json';
const originalSha256 = '04448ba6461db51279b9bdd6ed3736e76d1d9016067e04578ee7885ad8fdf1b9';
const roots = ['prisoner', 'madman', 'werewolf', 'zombie', 'wraith', 'puppet'] as const;
const entry = <T>(key: string): T => readObjectEntry<T>(naturalPath, key);
const prefix = (): SliceState => migrateSliceState(entry<unknown>('prefixFinal'));
const final = (): SliceState => migrateSliceState(entry<unknown>('final'));
const snapshot = (name: 'departure' | 'treated' | 'promoted' | 'practiced' | 'combatStart' | 'combatTerminal'): SliceState =>
  migrateSliceState(JSON.parse(readFileSync(`${directory}/snapshot-${name}.json`, 'utf8')));
const boundaryIndex = (): Record<string, string> => JSON.parse(readFileSync(`${directory}/boundaries.index.json`, 'utf8'));

// Only one indexed boundary is materialized at a time. Never parse the complete
// natural capture or the legacy multi-boundary document into simultaneous trees.
function boundary(name: string) {
  const file = boundaryIndex()[name];
  expect(file, name).toBe(`boundary-${name}.json`);
  const path = `${directory}/${file}`;
  return { beforeLast: migrateSliceState(readObjectEntry<unknown>(path, 'beforeLast')), lastIntent: readObjectEntry<SliceIntent>(path, 'lastIntent'), final: migrateSliceState(readObjectEntry<unknown>(path, 'final')) };
}

function expectOriginalHistory(s: SliceState, old: SliceState) {
  for (const key of roots) expect(s[key], key).toEqual(old[key]);
  const { life: oldLife, ...oldHistory } = old.silentDisciple;
  const { life: currentLife, ...currentHistory } = s.silentDisciple;
  expect(currentHistory).toEqual(oldHistory);
  if (s.ancientEvil.life.source) {
    expect(s.ancientEvil.life.source.snapshot).toEqual(oldLife);
    for (const key of ['cases', 'note', 'moon', 'tray'] as const) expect(currentLife[key], key).toEqual(oldLife[key]);
  } else expect(currentLife).toEqual(oldLife);
  expect(s.combatHistory.slice(0, old.combatHistory.length)).toEqual(old.combatHistory);
  for (const [id, mastery] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id], id).toBe(mastery);
  expect(s.runId).toBe(old.runId); expect(s.random.seed).toBe(old.random.seed);
  expect(s.character.age).toBe(old.character.age); expect(s.character.gender).toBe(old.character.gender);
  expect(s.progression.promotionWeek).toBe(old.progression.promotionWeek);
}

describe('Ancient Evil actual saved public continuation', () => {
  it('preserves the immutable living source and all 507 original commands before the actual 135-command continuation', async () => {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(originalPath)) hash.update(chunk);
    expect(hash.digest('hex')).toBe(originalSha256);
    expect(entry('provenance')).toEqual({ kind: 'SAME_SEED_COMPLETE_PUBLIC_CONTINUATION', source: originalPath, sourceSha256: originalSha256, newRandomChanges: false });
    const commands = entry<SliceIntent[]>('commands'), originalCommands = readObjectEntry<SliceIntent[]>(originalPath, 'commands');
    expect(commands).toHaveLength(642); expect(originalCommands).toHaveLength(507);
    expect(entry('prefixCount')).toBe(507); expect(entry('prefixVerified')).toBe(true);
    expect(commands.slice(0, 507)).toEqual(originalCommands);
    expect(commands[507]).toEqual({ type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01' });
    expect(entry('creation')).toEqual(readObjectEntry(originalPath, 'creation'));
    expect(entry('seed')).toBe(readObjectEntry(originalPath, 'seed')); expect(entry('seed')).toBe('prisoner-natural-v057');
    expect(entry('stage')).toBe('NATURAL_ANCIENT_EVIL_PUBLIC_CONTINUATION'); expect(entry('error')).toBeNull(); expect(entry('pendingIntent')).toBeNull();
    const s = prefix(), raw = readObjectEntry<SliceState>(originalPath, 'final');
    expect(s).toEqual(migrateSliceState(raw)); expect(s).toEqual(snapshot('departure'));
    expect(s).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION, revision: 508, week: 119, status: 'ACTIVE', health: 100,
      mind: 99, spirituality: 116, cash: 360, actionsRemaining: 3, random: { seed: 'prisoner-natural-v057', cursor: 206 }, progression: { sequence: 3, acting: 100 } });
    expect(s.ancientEvil).toEqual(createAncientEvilState()); expect(s.combatHistory).toHaveLength(13); assertValidSliceState(s);
  });

  it('discovers the real clinic, pays 60 for the same untreated heavy wound, then rests before that wound is removed', () => {
    const old = prefix(), wound = { id: 'prisoner-rebuild-natural:combat:1:PLAYER:406:0', severity: 'HEAVY', acquiredRevision: 406, treatedRevision: null };
    expect(old.injuries).toEqual([wound]); expect(old.health).toBe(100); expect(old.injuryRisk).toBe(0);
    {
      const b = boundary('clinic-real-discovery');
      expect(b.final.careKnown).toBe(true); expect(b.final.injuries).toEqual(b.beforeLast.injuries);
      expect(b.final.cash).toBe(b.beforeLast.cash); expect(b.final.actionsRemaining).toBe(b.beforeLast.actionsRemaining - 1);
    }
    {
      const b = boundary('clinic-real-rest-1');
      expect(b.lastIntent).toEqual({ type: 'ACTION', action: 'REST' }); expect(b.final.injuries).toEqual([wound]);
      expect(b.final.activeEvent?.id).toBe('LIFE-CARE-01');
    }
    {
      const b = boundary('clinic-actual-pay60');
      expect(b.lastIntent).toMatchObject({ type: 'EVENT_CHOICE', choiceId: 'PAY' });
      expect(b.beforeLast.cash - b.final.cash).toBe(60); expect(b.final.health).toBe(b.beforeLast.health);
      expect(b.final.actionsRemaining).toBe(b.beforeLast.actionsRemaining); expect(b.final.injuryRisk).toBe(0);
      expect(b.final.injuries).toEqual([{ ...wound, treatedRevision: 511 }]);
    }
    {
      const b = boundary('clinic-real-rest-2');
      expect(b.lastIntent).toEqual({ type: 'ACTION', action: 'REST' }); expect(b.beforeLast.injuries[0]!.treatedRevision).toBe(511);
      expect(b.final.injuries).toEqual([]); expect(b.final).toEqual(snapshot('treated'));
      expect(b.final).toMatchObject({ revision: 512, week: 120, health: 100, cash: 270, actionsRemaining: 3, random: { cursor: 206 } });
      expect(b.beforeLast.cash - b.final.cash).toBe(30); // Actual weekly living expense, separate from treatment.
      expectOriginalHistory(b.final, old); assertValidSliceState(b.final);
    }
    expect(entry<unknown[]>('treatments')).toHaveLength(1);
  });

  it('keeps seven independent original potion histories and 17 old mastery values, adding exactly two zero skills without a promotion refill', () => {
    const old = prefix(), s = snapshot('promoted'), terminal = final();
    expect(Object.keys(old.progression.mastery)).toHaveLength(17); expectOriginalHistory(s, old); expectOriginalHistory(terminal, old);
    for (const key of [...roots, 'silentDisciple'] as const) expect(s[key].bottles.filter(b => ['SUCCESS', 'GREAT_SUCCESS'].includes(b.outcome ?? ''))).toHaveLength(1);
    expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(old.progression.mastery, id))).toEqual([...ANCIENT_EVIL_ABILITY_IDS]);
    for (const id of ANCIENT_EVIL_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    expect(s.progression).toMatchObject({ sequence: 2, acting: 0, promotionWeek: 6 });
    expect(s.ancientEvil).toMatchObject({ promotionWeek: 138, silentDiscipleActingAtPromotion: 100 });
    expect(s.ancientEvil.promotionWeek! - old.silentDisciple.promotionWeek!).toBe(28);
    const dose = s.ancientEvil.acquisitionJournal.at(-1)!;
    expect(s.health).toBe(dose.before.health); expect(s.spirituality).toBe(dose.before.spirituality); expect(s.mind).toBe(dose.before.mind - 15);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(Math.min(500, old.character.coreStats[stat] + 1));
    expect(s.silentDisciple.encounter).toMatchObject({ targetId: 'SD3-CALDER', status: 'RESOLVED', enemyStatus: 'SURRENDERED', enemyHealth: 70, enemyMind: 100, enemySpirituality: 116 });
    expect(s.silentDisciple.encounter.blocks.map(b => [b.id, b.status, b.location])).toEqual([
      ['SD3-BLOCK-1', 'READY', 'SOURCE'], ['SD3-BLOCK-2', 'READY', 'SOURCE'], ['SD3-BLOCK-3', 'READY', 'SOURCE'],
    ]);
    expect(s.silentDisciple.life.moon).toMatchObject({ status: 'RESOLVED', cashSpent: 60, mindSpent: 8, elapsedSeconds: 3600 });
    assertValidSliceState(s); assertValidSliceState(terminal);
  });

  it('retains the real 87 failure and 6 success with separately paid work, bottles and same-week preparations', () => {
    const s = snapshot('promoted'), journal = s.ancientEvil.acquisitionJournal;
    expect(s.ancientEvil.preparations.map(p => p.taskId)).toEqual([...ANCIENT_EVIL_PREPARATION_IDS]); expect(s.ancientEvil.preparedWeek).toBeNull();
    expect(journal[0]!.before.cash - journal[0]!.after.cash).toBe(500); expect(journal[0]!.before.actions - journal[0]!.after.actions).toBe(1);
    const preparations = journal.filter(e => e.command.type === 'PREPARE_PROMOTION'), doses = journal.filter(e => e.command.type === 'CONSUME');
    expect(preparations).toHaveLength(2);
    expect(doses.map(e => [e.week, e.check?.tier, e.check?.roll, e.randomBefore, e.randomAfter])).toEqual([
      [130, 'FAILURE', 87, 206, 207], [138, 'SUCCESS', 6, 207, 208],
    ]);
    expect(doses[0]!.after).toMatchObject({ sequence: 3, acting: 100, health: 85, mind: 75, spirituality: 120, pollution: 30 });
    expect(doses[1]!.before).toMatchObject({ health: 100, mind: 100, spirituality: 120, pollution: 0 });
    expect(doses[1]!.after).toMatchObject({ sequence: 2, acting: 0, health: 100, mind: 85, spirituality: 120 });
    for (const [index, e] of doses.entries()) {
      const bottleId = `ancient-evil-potion-${index + 1}`;
      const work = journal.filter(row => row.command.type === 'POTION_WORK' && row.command.bottleId === bottleId);
      expect(work).toHaveLength(5); for (const row of work) expect(row.before.actions - row.after.actions).toBe(1);
      const purchase = journal.find(row => row.command.type === 'BUY_POTION' && row.command.bottleId === bottleId)!;
      expect(purchase.before.cash - purchase.after.cash).toBe(900); expect(purchase.after.actions).toBe(purchase.before.actions);
      const prepared = preparations[index]!;
      expect(prepared.before.cash - prepared.after.cash).toBe(140); expect(prepared.before.actions - prepared.after.actions).toBe(1); expect(prepared.week).toBe(e.week);
      expect(e.after.cash).toBe(e.before.cash); expect(e.after.actions).toBe(e.before.actions);
      expect(s.ancientEvil.bottles[index]).toMatchObject({ id: bottleId, status: 'CONSUMED', labourSteps: 5, preparationWeek: e.week, consumedWeek: e.week, outcome: e.check!.tier });
      const rng = new DeterministicActionRandomStream(s.random.seed, e.randomBefore!);
      expect(rng.nextInt(1, 100)).toBe(e.check!.roll); expect(rng.cursor).toBe(e.randomAfter);
    }
    expect(s.ancientEvil.bottles[2]).toMatchObject({ status: 'SUPPLIER', labourSteps: 0, acquiredWeek: null, consumedWeek: null, outcome: null });
    expect(s.ancientEvil.resupply).toEqual({ requestedWeek: null, deliveries: 0 });
  });

  it('honestly reports two failed transformations with ordinary fallback, then only one successful application of each new skill', () => {
    const old = prefix(), s = snapshot('practiced'), life = s.ancientEvil.life, room = s.silentDisciple.life;
    expect(Object.keys(life.cases)).toEqual([...ANCIENT_EVIL_CASE_IDS]); expect(life.reflected).toBe(true); expect(ancientEvilLifeClosed(s)).toBe(true);
    expect(s.progression.acting).toBe(100); expect(life.operation).toEqual({ door: 'OPEN', inputActive: false, form: null });
    const attempts = ANCIENT_EVIL_CASE_IDS.map(id => {
      expect(life.cases[id]).toMatchObject({ status: 'RESOLVED', contactOpen: false, returned: true }); expect(life.cases[id].attempts).toHaveLength(1);
      return life.cases[id].attempts[0]!;
    });
    expect(attempts.map(a => [a.formTier, a.guidanceTier, a.result, a.spiritualitySpent, a.mindSpent])).toEqual([
      ['FAILURE', null, 'ORDINARY', 6, 4], ['GREAT_FAILURE', null, 'ORDINARY', 6, 4], ['SUCCESS', 'SUCCESS', 'ABILITY', 10, 4],
    ]);
    expect(attempts[0]).toMatchObject({ manual: true, performed: false, appliedAbilityIds: [] });
    expect(attempts[1]).toMatchObject({ manual: true, performed: false, consent: 'WITHDRAWN', permissionWithdrawn: true, appliedAbilityIds: [] });
    expect(attempts[2]).toMatchObject({ manual: false, performed: true, released: true, expired: false, waits: 0, waitedSeconds: 0, appliedAbilityIds: [...ANCIENT_EVIL_ABILITY_IDS] });
    for (const id of ANCIENT_EVIL_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(8);
    for (const a of attempts) {
      expect(a).toMatchObject({ closed: true, inspected: true, identityRead: true, identitySourceId: 'SD3-ELSA', originalBodyId: 'SD3-ELSA', originalForm: 'HUMAN',
        itemsStored: true, itemsReturned: true, noteRead: true, identityCompared: true, playerTravelMetres: 16 });
      expect(a.playerMoves.map(m => [m.from, m.to, m.metres, m.seconds, m.itemIds])).toEqual([
        ['START', 'A', 4, 4, []], ['A', 'B', 4, 4, []], ['B', 'A', 4, 4, []], ['A', 'START', 4, 4, []],
      ]);
    }
    expect(life.journal.filter(e => e.check).map(e => [e.check!.roll, e.randomBefore, e.randomAfter])).toEqual([[77, 208, 209], [96, 209, 210], [34, 210, 211], [15, 211, 212]]);
    expect(room.playerTravelMetres - old.silentDisciple.life.playerTravelMetres).toBe(48);
    for (const key of ['volunteer', 'guide', 'clothing', 'bag', 'tray', 'note', 'cases', 'moon'] as const) expect(room[key]).toEqual(old.silentDisciple.life[key]);
    expectOriginalHistory(s, old); assertValidSliceState(s);
  });

  it('keeps the same body and a residual 89 seconds after stopping input, then charges actual same-source release before returning originals', () => {
    {
      const b = boundary('original-link-enduring_transfiguration-actual'), before = b.beforeLast.silentDisciple.life, after = b.final.silentDisciple.life;
      expect(after.volunteer).toEqual({ ...before.volunteer, form: 'RABBIT' });
      expect(b.final.ancientEvil.life.operation.form).toMatchObject({ subjectId: 'SD3-ELSA', bodyId: 'SD3-ELSA', sourceCaseId: 'original-link', castAt: 3911, expiresAt: 4001 });
      expect(after.clothing).toMatchObject({ id: 'SD3-CLOTHES', owner: 'SD3-ELSA', quantity: 1, location: 'TRAY', worn: false });
      expect(after.bag).toMatchObject({ id: 'SD3-BAG', owner: 'SD3-ELSA', quantity: 1, location: 'TRAY' });
      expect(b.beforeLast.spirituality - b.final.spirituality).toBe(6); expect(b.beforeLast.mind - b.final.mind).toBe(2);
    }
    {
      const b = boundary('original-link-stop_input-actual');
      expect(b.final.ancientEvil.life.operation.inputActive).toBe(false);
      expect(b.final.ancientEvil.life.operation.form).toEqual(b.beforeLast.ancientEvil.life.operation.form);
      expect(b.final.ancientEvil.life.operation.form!.expiresAt - b.final.silentDisciple.life.clockSeconds).toBe(89);
      expect(b.final.silentDisciple.life.volunteer).toEqual(b.beforeLast.silentDisciple.life.volunteer);
      for (const key of ['health', 'mind', 'spirituality', 'cash', 'actionsRemaining', 'injuries'] as const) expect(b.final[key]).toEqual(b.beforeLast[key]);
    }
    {
      const b = boundary('original-link-curse_guidance-actual');
      expect(b.beforeLast.ancientEvil.life.operation.form!.expiresAt - b.beforeLast.silentDisciple.life.clockSeconds).toBe(77);
      expect(b.beforeLast.ancientEvil.life.cases['original-link'].attempts[0]!.identityCompared).toBe(true);
      expect(b.beforeLast.spirituality - b.final.spirituality).toBe(4); expect(b.beforeLast.mind - b.final.mind).toBe(2);
      expect(b.beforeLast.actionsRemaining - b.final.actionsRemaining).toBe(1);
      expect(b.final.ancientEvil.life.operation.form).toBeNull(); expect(b.final.silentDisciple.life.volunteer.form).toBe('HUMAN');
      expect(b.final.silentDisciple.life.clothing).toEqual(b.beforeLast.silentDisciple.life.clothing); expect(b.final.silentDisciple.life.bag).toEqual(b.beforeLast.silentDisciple.life.bag);
    }
    for (const id of ANCIENT_EVIL_CASE_IDS) {
      const b = boundary(`${id}-return_items-actual`);
      expect(b.beforeLast.silentDisciple.life.volunteer.form).toBe('HUMAN');
      expect(b.final.silentDisciple.life.clothing).toEqual({ id: 'SD3-CLOTHES', owner: 'SD3-ELSA', quantity: 1, location: 'ELSA', worn: true });
      expect(b.final.silentDisciple.life.bag).toEqual({ id: 'SD3-BAG', owner: 'SD3-ELSA', quantity: 1, location: 'ELSA' });
    }
    const withdrawn = boundary('revoked-form-withdraw_permission-actual').final;
    expect(withdrawn.ancientEvil.life.cases['revoked-form'].attempts[0]).toMatchObject({ consent: 'WITHDRAWN', permissionWithdrawn: true, ownForm: null });
    const saved = JSON.stringify(withdrawn);
    expect(() => applySliceIntent(withdrawn, { type: 'ANCIENT_EVIL', command: { type: 'ENDURING_TRANSFIGURATION', caseId: 'revoked-form' } })).toThrow();
    expect(JSON.stringify(withdrawn)).toBe(saved);
  });

  it('pays for three new blocks and attention, clears the same adults by their real ordinary routes, and keeps Calder untouched', () => {
    const s = snapshot('combatStart'), old = prefix(), e = s.ancientEvil.encounter;
    expectOriginalHistory(s, old); expect(e.originalEncounter).toEqual(old.silentDisciple.encounter);
    expect(e.blockPurchase).toMatchObject({ paid: 80, cashBefore: 660, cashAfter: 580, ids: [...ANCIENT_EVIL_BLOCK_IDS], randomBefore: 212, randomAfter: 212 });
    expect(e.blockPurchase!.before.actions).toBe(e.blockPurchase!.after.actions);
    expect(e.preparation).toMatchObject({ mindPaid: 2, before: { mind: 100 }, after: { mind: 98 } });
    expect(e.clearance).toMatchObject({ elsaId: 'SD3-ELSA', elsaConsent: 'GRANTED', elsaMetres: 8, elsaSeconds: 8, elsaRoute: ['A', 'START', 'OUTSIDE'],
      guideId: 'HARLAN', guideConsent: 'GRANTED', guideMetres: 4, guideSeconds: 4, guideRoute: ['START', 'OUTSIDE'],
      playerMetres: 4, playerSeconds: 4, elapsedSeconds: 16, clothesId: 'SD3-CLOTHES', bagId: 'SD3-BAG' });
    expect(s.silentDisciple.life.volunteer).toEqual({ ...old.silentDisciple.life.volunteer, location: 'OUTSIDE' });
    expect(s.silentDisciple.life.guide).toEqual({ ...old.silentDisciple.life.guide, location: 'OUTSIDE' });
    expect(s.silentDisciple.life.clothing).toEqual(old.silentDisciple.life.clothing); expect(s.silentDisciple.life.bag).toEqual(old.silentDisciple.life.bag);
    expect(e.startSource).toEqual(currentAncientEvilCombatSource(s));
    expect(e.startSource).toMatchObject({ targetId: 'AE2-LENA', targetAge: 45, targetPathway: 'audience', targetSequence: 3, actualBody: true, independentMind: true,
      enemyWeapon: 'AE2-LENA-STAFF', thirdPartiesInArea: 0, automaticAllyImmunity: false, ordinaryExit: 'OPEN', randomSeed: 'prisoner-natural-v057', randomCursor: 212 });
    assertValidSliceState(s);
  });

  it('projects the separate real enemy wheel and replays the only actual round from its exact source, seed and costs', () => {
    const start = snapshot('combatStart'), view = projectSliceState(start), s = snapshot('combatTerminal');
    expect(view.combat!.enemyAbilityWheel).toEqual(ANCIENT_EVIL_ENEMY_ABILITY_WHEEL);
    expect(view.combat!.enemyCountWheel).toEqual(ANCIENT_EVIL_ENEMY_COUNT_WHEEL);
    expect(view.combat!.enemyAbilityWheel!.map(a => [a.id, a.weight])).toEqual([
      ['DREAM_SPIKE', 35], ['DREAM_WARD', 25], ['BODY_STRIKE', 25], ['RESIST_FORM', 10], ['ACCIDENT', 5],
    ]);
    const rounds = s.combatHistory.filter(round => round.ancientEvilOutcome); expect(rounds).toHaveLength(1);
    const round = rounds[0]!, o = round.ancientEvilOutcome!;
    expect(o.source).toEqual(start.ancientEvil.encounter.startSource);
    expect(replayAncientEvilCombatRound(o.source, o.stance, o.cursePolicy, o.madmanBurst.policy)).toEqual({ round, outcome: 'ENEMY_DEAD' });
    expect(validateAncientEvilCombatRound(round)).toBe(true);
    expect(round).toMatchObject({ round: 1, stance: 'DEFEND', first: 'PLAYER', playerCountRoll: 96, enemyCountRoll: 77, playerCount: 6, enemyCount: 5,
      winner: 'PLAYER', consequenceDomain: 'BODY', consequenceWeights: { light: 65, heavy: 30, death: 5 }, consequenceRoll: 100 });
    for (const a of o.enemyActions) {
      const rng = new DeterministicActionRandomStream(o.source.randomSeed, a.randomCursorBefore - 1);
      expect(drawAncientEvilEnemyAbility(rng)).toBe(a.planned);
    }
    expect(o.enemyActions.map(a => [a.id, a.paidCost])).toEqual([['DREAM_WARD', 4], ['DREAM_SPIKE', 6], ['BODY_STRIKE', 0], ['DREAM_SPIKE', 6], ['DREAM_SPIKE', 6]]);
    expect(o.enemySpirituality).toBe(o.source.body.enemySpirituality - o.enemyActions.reduce((n, a) => n + a.paidCost, 0));
    expect(o.playerSpiritualityAfter).toBe(o.source.playerSpirituality - o.playerActions.reduce((n, a) => n + a.paidCost, 0));
    expect(o.rootAfter.clockSeconds - o.source.root.clockSeconds).toBe(60); expect(o.randomCursorAfter).toBe(228);
    const rng = new DeterministicActionRandomStream(s.random.seed, 227); expect(rng.nextInt(1, 100)).toBe(100); expect(rng.cursor).toBe(228);
  });

  it('records the actual failed contact and enemy death without claiming a successful combat form, resistance, pickup, retreat or player death', () => {
    const s = snapshot('combatTerminal'), e = s.ancientEvil.encounter, o = s.combatHistory.at(-1)!.ancientEvilOutcome!;
    const contact = o.playerActions.filter(a => a.id === ANCIENT_EVIL_ABILITY_IDS[0]);
    expect(contact).toHaveLength(1); expect(contact[0]).toMatchObject({ mode: 'CONTACT', paidCost: 4, mindCost: 1, rolls: [62], checkChance: 54, succeeded: false, resisted: false });
    expect(e).toMatchObject({ status: 'RESOLVED', enemyStatus: 'DEAD', enemyHealth: 0, enemyMind: 100, enemySpirituality: 98, enemyForm: 'HUMAN', enemyFormUntilSeconds: null,
      weaponLocation: 'COURT', contactAttempts: 1, transfigurationAttempts: 0, transfigurationSuccesses: 0, pickUpUses: 0, powerUses: { RESIST_FORM: 0 }, reflectionHistory: [] });
    expect(e.terminal).toEqual({ outcome: 'ENEMY_DEAD', round: 1, historyIndex: 13, enemyHealth: 0, enemyMind: 100, enemySpirituality: 98, enemyStatus: 'DEAD', formWaitSeconds: 0, exitMetres: 4, exitSeconds: 4 });
    expect(e.blocks.map(b => [b.id, b.status, b.location, b.usedRound])).toEqual(ANCIENT_EVIL_BLOCK_IDS.map(id => [id, 'SPENT', 'TARGET_GROUND', 1]));
    expect(o.cursePolicy).toBe(false); expect(o.madmanBurst).toEqual({ policy: 'HOLD', triggered: false, mentalCost: 0, spiritualCost: 0 });
    expect(o.playerActions.some(a => a.id === ANCIENT_EVIL_ABILITY_IDS[1])).toBe(false);
    expect(s).toMatchObject({ status: 'ACTIVE', health: 100, mind: 97, spirituality: 105, injuries: [], injuryRisk: 0, combat: null, ending: null });
    expect(s.silentDisciple.life).toMatchObject({ playerLocation: 'START', clockSeconds: 4026, playerTravelMetres: 112, volunteer: { alive: true, location: 'OUTSIDE', form: 'HUMAN' } });
    const index = boundaryIndex(); expect(Object.keys(index).some(key => key.includes('wait_form'))).toBe(false); expect(index['combat-round-2']).toBeUndefined();
  });

  it('replays selected real commit boundaries without input mutation, then resumes ordinary work while the dead enemy stays dead', () => {
    const index = boundaryIndex(); expect(Object.keys(index)).toHaveLength(65); expect(new Set(Object.values(index)).size).toBe(65);
    for (const name of ['clinic-actual-pay60', 'clinic-real-rest-2', 'consume-ancient-evil-potion-2', 'original-link-stop_input-actual', 'original-link-curse_guidance-actual', 'combat-round-1', 'ordinary-life-after-actual-exit']) {
      const b = boundary(name), input = JSON.stringify(b.beforeLast), intent = JSON.stringify(b.lastIntent);
      expect(validateSlicePayload(b.lastIntent)).toBe(true); expect(applySliceIntent(b.beforeLast, b.lastIntent)).toEqual(b.final);
      expect(JSON.stringify(b.beforeLast)).toBe(input); expect(JSON.stringify(b.lastIntent)).toBe(intent); assertValidSliceState(b.final);
    }
    const b = boundary('ordinary-life-after-actual-exit');
    expect(b.lastIntent).toEqual({ type: 'ACTION', action: 'WORK' }); expect(entry<SliceIntent[]>('commands').at(-1)).toEqual(b.lastIntent);
    expect(b.final).toEqual(final()); expect(b.final).toMatchObject({ revision: 643, week: 148, cash: 730, actionsRemaining: 3, health: 100, mind: 97, spirituality: 105, status: 'ACTIVE', random: { cursor: 228 } });
    expect(b.final.ancientEvil).toEqual(b.beforeLast.ancientEvil); expect(b.final.combatHistory).toEqual(b.beforeLast.combatHistory);
    expect(b.final.silentDisciple.life).toEqual(b.beforeLast.silentDisciple.life); expect(projectSliceState(b.final).canAct).toBe(true);
  }, 30_000);

  it('migrates the living original and current actual enemy-death history idempotently without restoring resources, history or an opponent', () => {
    for (const raw of [readObjectEntry<SliceState>(originalPath, 'final'), final()]) {
      const input = JSON.stringify(raw), s = migrateSliceState(raw);
      expect(s).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION, status: 'ACTIVE' });
      for (const key of [...roots, 'silentDisciple', 'random', 'progression', 'combatHistory', 'week', 'date', 'cash', 'mind', 'health', 'spirituality', 'injuries', 'injuryRisk'] as const) expect(s[key]).toEqual(raw[key]);
      expect(JSON.stringify(raw)).toBe(input); expect(migrateSliceState(s)).toEqual(s); assertValidSliceState(s);
    }
    const s = final(), saved = JSON.stringify(s);
    for (const command of [
      { type: 'ANCIENT_EVIL', command: { type: 'ENCOUNTER_FIGHT' } },
      { type: 'ANCIENT_EVIL', command: { type: 'ENCOUNTER_TALK' } },
      { type: 'ANCIENT_EVIL', command: { type: 'OBSERVE', caseId: 'lasting-form' } },
      { type: 'SILENT_DISCIPLE', command: { type: 'ENCOUNTER_FIGHT' } },
    ] as SliceIntent[]) expect(() => applySliceIntent(s, command)).toThrow();
    expect(JSON.stringify(s)).toBe(saved); expect(migrateSliceState(s).ancientEvil.encounter.enemyStatus).toBe('DEAD');
  });

  it('rejects forged costs, RNG, old mastery, copied originals, altered life history and revival in the actual saved state', () => {
    const promotion = snapshot('promoted');
    promotion.progression.mastery['chained.s7.toxic-claws'] = 1;
    expect(() => assertValidSliceState(promotion)).toThrow();
    const source = final(), stored = JSON.stringify(source);
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.ancientEvil.acquisitionJournal[0]!.after.cash++; },
      s => { const e = s.ancientEvil.acquisitionJournal.find(e => e.check)!; e.check = { ...e.check!, roll: e.check!.roll - 1 }; },
      s => { s.ancientEvil.life.source!.snapshot.volunteer.health--; },
      s => { s.silentDisciple.life.playerTravelMetres++; },
      s => { s.silentDisciple.life.clothing.quantity = 2 as 1; },
      s => { s.ancientEvil.life.journal.find(e => e.command.type === 'CONSENT_ELSA')!.command = { type: 'READ_IDENTITY', caseId: 'lasting-form' }; },
      s => { s.ancientEvil.encounter.blockPurchase!.after.cash++; },
      s => { s.ancientEvil.encounter.enemyHealth = 100; s.ancientEvil.encounter.enemyStatus = 'RESISTING'; },
      s => { s.combatHistory.at(-1)!.ancientEvilOutcome!.randomCursorAfter++; },
    ];
    for (const [index, mutate] of mutations.entries()) { const forged = structuredClone(source); mutate(forged); expect(() => assertValidSliceState(forged), `actual save tamper ${index + 1}`).toThrow(); }
    expect(JSON.stringify(source)).toBe(stored);
    for (const payload of [
      { type: 'ANCIENT_EVIL', command: { type: 'CONSUME', bottleId: 'ancient-evil-potion-3', confirmed: false } },
      { type: 'ANCIENT_EVIL', command: { type: 'ENDURING_TRANSFIGURATION', caseId: 'original-link', targetId: 'SD3-CALDER' } },
      { type: 'ANCIENT_EVIL', command: { type: 'CURSE_GUIDANCE', caseId: 'invented-case' } },
      { type: 'ANCIENT_EVIL', command: { type: 'ENCOUNTER_FIGHT', revive: true } },
    ]) expect(validateSlicePayload(payload)).toBe(false);
  }, 30_000);

  it('deep-clones current state and public projections without changing saved people, objects, costs or journals', () => {
    const s = snapshot('combatStart'), stored = JSON.stringify(s), copy = structuredClone(s), view = projectSliceState(s);
    expect(view.maxSpirituality).toBe(120); expect(view.ancientEvil.abilities).toHaveLength(19);
    expect(view.ancientEvil).toMatchObject({ promoted: true, formulaKnown: false, formula: [], acting: 100 });
    for (const key of [...roots, 'silentDisciple'] as const) expect(view[key].acting, key).toBe(100);
    copy.ancientEvil.life.source!.snapshot.volunteer.health--; copy.ancientEvil.acquisitionJournal[0]!.after.cash++;
    view.ancientEvil.abilities[0]!.mastery++; view.ancientEvil.life.site.volunteer.health--;
    view.ancientEvil.life.cases[0]!.attempts[0]!.evidence.push('changed view');
    view.ancientEvil.encounter.preparation!.after.mind++; view.ancientEvil.encounter.enemy!.powerUses.DREAM_SPIKE++;
    expect(JSON.stringify(s)).toBe(stored); expect(snapshot('combatStart')).toEqual(s); assertValidSliceState(s);
  });
});
