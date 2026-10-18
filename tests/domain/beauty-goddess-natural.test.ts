import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { BEAUTY_GODDESS_ABILITY_IDS, BEAUTY_GODDESS_SOURCE_KEYS } from '../../src/domain/beauty-goddess/types.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';

const ROOT = 'tests/fixtures/beauty-goddess-v01900';
const SOURCE = 'tests/fixtures/life-giver-v01680/natural.json';
const SOURCE_SHA256 = '6ae7bbe18c20979643cf881cec54e3794656701b3b962ce775f14c44d46356b1';
const entry = <T>(key: string): T => readObjectEntry<T>(`${ROOT}/natural.json`, key);
const captured = (key: string): SliceState => migrateSliceState(entry<unknown>(key));
const same = (actual: unknown, expected: unknown) => {
  const actualCanonical = stableStringify(actual), expectedCanonical = stableStringify(expected);
  const equal = actualCanonical === expectedCanonical;
  // Compare the complete canonical strings; hashes only keep failure diagnostics bounded.
  expect(equal, equal ? undefined : `Canonical JSON differs: actual SHA-256 ${createHash('sha256').update(actualCanonical).digest('hex')}; expected SHA-256 ${createHash('sha256').update(expectedCanonical).digest('hex')}`).toBe(true);
};
const index = (): Record<string, string> => JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8'));
const boundary = (name: string) => {
  const file = `${ROOT}/${index()[name]}`;
  return { before: migrateSliceState(readObjectEntry<unknown>(file, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(file, 'lastIntent'), final: migrateSliceState(readObjectEntry<unknown>(file, 'final')) };
};
const blocked = (name: 'first' | 'second', key: string) => readObjectEntry<unknown>(`${ROOT}/script-blocker-${name}.json`, key);

// The actual branch contains seven failed bottles, an eighth-bottle great
// success, failed self-poise/precision, one applied moonform and two BODY wins.
// Script-order blockers are evidence, not alternate seeds or discarded saves.
describe('Beauty Goddess exact original572-command public continuation', () => {
  it('pins untouched historical bytes separately from current migrated playable states', () => {
    expect(createHash('sha256').update(readFileSync(SOURCE)).digest('hex')).toBe(SOURCE_SHA256);
    expect(readObjectEntry(SOURCE, 'final')).toMatchObject({ schemaVersion: 165, contentVersion: 'life-giver-v165', revision: 573, week: 131 });
    expect(createHash('sha256').update(readFileSync(`${ROOT}/natural.json`)).digest('hex')).toBe('6c797e81ca08b1140089a3bf22179f19b58f687e95df31a5b20a0508cf88e1a1');
    expect(entry('final')).toMatchObject({ schemaVersion: 187, contentVersion: 'beauty-goddess-v187' });
    expect(createHash('sha256').update(readFileSync(`${ROOT}/script-blocker-first.json`)).digest('hex')).toBe('195064d584c3fa6bb7c87584970ab5e2a43d5493613cb66afa3252902fc453eb');
    expect(createHash('sha256').update(readFileSync(`${ROOT}/script-blocker-second.json`)).digest('hex')).toBe('84b57b129d618ea8e5dc5bfadc4e3fed50dc63126153eb39aae4173bf32c1d75');
  });

  it('replays the exact670 source prefix and validates the unchanged912 archived branch without minting its later bottles', () => {
    const commands = entry<SliceIntent[]>('commands'), originalCommands = readObjectEntry<SliceIntent[]>(SOURCE, 'commands');
    expect(commands).toHaveLength(912); expect(originalCommands).toHaveLength(572);
    expect(entry<number>('prefixCount')).toBe(572); expect(entry<boolean>('prefixVerified')).toBe(true);
    expect(entry<string>('seed')).toBe('apothecary-rebuild-first');
    expect(entry('provenance')).toEqual({ kind: 'SAME_SEED_ORIGINAL_LIVING_BRANCH_PUBLIC_CONTINUATION', source: SOURCE, sourceSha256: SOURCE_SHA256, newRandomChanges: false });
    expect(entry('continuationSource')).toEqual({ sha256: '84b57b129d618ea8e5dc5bfadc4e3fed50dc63126153eb39aae4173bf32c1d75', commands: 840, status: 'ACTIVE', revision: 841, randomCursor: 323 });
    same(commands.slice(0, 572), originalCommands); same(entry('creation'), readObjectEntry(SOURCE, 'creation'));
    same(commands.slice(0, 670), blocked('first', 'commands')); same(commands.slice(0, 840), blocked('second', 'commands'));
    const final = captured('final'), prefix = captured('prefixFinal');
    same(prefix, migrateSliceState(readObjectEntry<unknown>(SOURCE, 'final')));
    const expected670 = migrateSliceState(blocked('first', 'final'));
    const guidance = expected670.chronicle[902]!;
    const oldRecoveryGuidance = '全部原瓶失败后须付1行动与100便士申请下一批，至少跨一真实周才有新瓶到货。';
    const currentRecoveryGuidance = '最初三份原特性固定，全部失败后可付1行动、120便士调查指定失败原瓶，隔一真实周另付1行动在原处回收同一份特性。每次新普通药物与调配服务另付900便士，或五项新劳动后90便士；当次场地检查仍需150便士。新载体不产生第四份特性，旧原瓶、费用与失败记录全部保留。';
    // Only newly replayed guidance changes. Pin the archived record and its complete
    // text before replacing exactly its final sentence in this expected state alone.
    expect({ id: guidance.id, week: guidance.week, title: guidance.title }).toEqual({
      id: 'record-580-902', week: 133, title: '听取美神独立成品与专业准备指导',
    });
    expect(expected670.chronicle.filter(record => record.id === guidance.id)).toHaveLength(1);
    expect(createHash('sha256').update(guidance.text).digest('hex')).toBe('6235cf2b8a0e837eaca5df53eeb97b5a185a494be52f75cdc373f87215b1428d');
    expect(expected670.chronicle.reduce((count, record) => count + record.text.split(oldRecoveryGuidance).length - 1, 0)).toBe(1);
    expect(guidance.text.endsWith(oldRecoveryGuidance)).toBe(true);
    guidance.text = guidance.text.slice(0, -oldRecoveryGuidance.length) + currentRecoveryGuidance;
    let state = createSliceRun(final.runId, entry<Parameters<typeof createSliceRun>[1]>('creation'), entry<string>('seed'));
    same(state, captured('initial'));
    for (const [i, intent] of commands.slice(0, 670).entries()) {
      if (i >= 572 && intent.type === 'BEAUTY_GODDESS') {
        const action = projectSliceState(state).beautyGoddess.actions.find(action => stableStringify(action.command) === stableStringify(intent.command));
        expect(action, `Captured command ${i + 1} must have a current public control`).toBeDefined();
        expect(action!.enabled, action!.reason ?? JSON.stringify(intent)).toBe(true);
      }
      state = applySliceIntent(state, intent);
      if (i === 571) same(state, prefix);
      if (i === 669) same(state, expected670);
    }
    expect(state.chronicle[902]!.text.slice(-currentRecoveryGuidance.length)).toBe(currentRecoveryGuidance);
    same(state, expected670); assertValidSliceState(state); same(migrateSliceState(state), state);
    // Old 912-command history remains readable; current commands cannot issue the old fourth-plus originals.
    assertValidSliceState(final); same(migrateSliceState(final), final);
    expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(state.revision).toBe(captured('initial').revision + 670);
    expect(final.revision).toBe(captured('initial').revision + commands.length);
    expect(entry('pendingIntent')).toBeNull(); expect(entry('error')).toBeNull();
    expect(entry('stage')).toBe('NATURAL_BEAUTY_GODDESS_PUBLIC_CONTINUATION');
    expect(Object.keys(index())).toHaveLength(102); expect(new Set(Object.values(index())).size).toBe(102);
  }, 120_000);

  it('retains all eight frozen histories,21 original masteries, seven zeros and the one original Lumen body', () => {
    const original = captured('prefixFinal'), final = captured('final');
    expect(Object.keys(original.progression.mastery)).toHaveLength(21);
    expect(Object.values(original.progression.mastery).filter(value => value === 0)).toHaveLength(7);
    for (const root of BEAUTY_GODDESS_SOURCE_KEYS) {
      same(final.beautyGoddess.sourceHistory![root], original[root]);
      if (root !== 'summoningMaster') same(final[root], original[root]);
    }
    const currentSummoning = structuredClone(final.summoningMaster);
    currentSummoning.life.partner = original.summoningMaster.life.partner;
    same(currentSummoning, original.summoningMaster);
    for (const [id, value] of Object.entries(original.progression.mastery)) expect(final.progression.mastery[id], id).toBe(value);
    expect(Object.keys(final.progression.mastery)).toHaveLength(23);
    same(final.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
    same(final.beautyGoddess.encounter.originalHistory, original.combatHistory);
    expect(final.lifeGiver.encounter).toMatchObject({ status: 'RETREATED', enemyStatus: 'RESISTING', enemyHealth: 80, enemySpirituality: 1 });
    expect(final.witchKing.life.papers.map(paper => paper.status)).toEqual(['CONSUMED', 'CONSUMED', 'CONSUMED']);
    expect(final.lifeGiver.life.beads.filter(bead => bead.purpose === 'COMBAT').map(bead => [bead.status, bead.location])).toEqual([['SPENT', 'RETURN_TRAY'], ['SPENT', 'RETURN_TRAY'], ['SPENT', 'RETURN_TRAY']]);
    expect(final.character).toMatchObject({ name: original.character.name, gender: 'FEMALE', age: original.character.age });
    expect(final.progression.promotionWeek).toBe(original.progression.promotionWeek);
    expect(final.summoningMaster.life.partner).toMatchObject({ id: 'SM3-LUMEN', bodyId: 'SM3-LUMEN-BODY', homeId: 'SM3-GLASS-ROOM', location: 'HOME', health: 100, mind: 92, stamina: 79, ordinaryDistanceM: 338 });
    same(final.summoningMaster.life.partner, { ...original.summoningMaster.life.partner, stamina: 79, ordinaryDistanceM: 338 });
    same(final.beautyGoddess.life.sourcePartner, original.summoningMaster.life.partner);
  });

  it('keeps both script blockers and uses ordinary recovery plus actual walking before new consent', () => {
    const first = migrateSliceState(blocked('first', 'final')), second = migrateSliceState(blocked('second', 'final'));
    expect(blocked('first', 'stage')).toBe('ACTUAL_BLOCKER'); expect(blocked('second', 'stage')).toBe('ACTUAL_BLOCKER');
    expect(first).toMatchObject({ revision: 671, week: 160, cash: 14, random: { cursor: 318 }, progression: { sequence: 2 } });
    const request = blocked('first', 'pendingIntent') as SliceIntent;
    expect(request).toEqual({ type: 'BEAUTY_GODDESS', command: { type: 'REQUEST_SUPPLY' } });
    expect(projectSliceState(first).beautyGoddess.actions.some(action => action.command.type === 'REQUEST_SUPPLY')).toBe(false);
    expect(projectSliceState(first).beautyGoddess.actions.find(action => action.command.type === 'REQUEST_RECOVERY_V1')).toMatchObject({ enabled: false, reason: '调查原特性需要1行动、120便士；旧费用不退。' });
    expect(() => applySliceIntent(first, request)).toThrow();
    const commands = entry<SliceIntent[]>('commands');
    expect(commands[670]).toEqual({ type: 'ACTION', action: 'REST' });
    expect(commands.slice(670, 674)).toContainEqual({ type: 'ACTION', action: 'WORK' });
    const paid = boundary('request-after-3-failures'), delivery = boundary('receive-real-later-week-3');
    expect(paid.final.cash).toBe(paid.before.cash - 100); expect(paid.final.beautyGoddess.bottles).toHaveLength(3);
    expect(delivery.final.week).toBeGreaterThan(paid.final.week); expect(delivery.final.beautyGoddess.bottles).toHaveLength(6);
    same(delivery.final.beautyGoddess.bottles.slice(0, 3), paid.final.beautyGoddess.bottles);
    expect(blocked('second', 'pendingIntent')).toEqual({ type: 'BEAUTY_GODDESS', command: { type: 'CONSENT', permission: 'GUEST' } });
    expect(projectSliceState(second).beautyGoddess.actions.some(action => action.command.type === 'CONSENT')).toBe(false);
    const walk = boundary('steady-hands-actual60metre-walk'); same(second, walk.before); same(commands[840], walk.intent);
    same(applySliceIntent(second, walk.intent), walk.final);
    expect(walk.final.beautyGoddess.life.practice).toMatchObject({ playerLocation: 'HOME', playerTravelMetres: 60, elapsedSeconds: 70 });
    expect(projectSliceState(walk.final).beautyGoddess.actions.some(action => action.enabled && action.command.type === 'CONSENT')).toBe(true);
  }, 10_000);

  it('separately confirms the unchanged female body, retains seven failures and promotes only on the eighth original bottle', () => {
    const acknowledgment = boundary('explicit-successful-female-body-confirmation');
    expect(acknowledgment.intent).toEqual({ type: 'BEAUTY_GODDESS', command: { type: 'CONFIRM_TRANSFORMATION', confirmed: true } });
    same(applySliceIntent(acknowledgment.before, acknowledgment.intent), acknowledgment.final);
    expect(acknowledgment.final.beautyGoddess.transformation).toEqual({ originalGender: 'FEMALE', decision: 'ACCEPTED', acknowledgedWeek: 133, outcome: null });
    same(acknowledgment.final.character, acknowledgment.before.character); same(acknowledgment.final.random, acknowledgment.before.random);
    expect([acknowledgment.final.health, acknowledgment.final.mind, acknowledgment.final.spirituality, acknowledgment.final.cash, acknowledgment.final.actionsRemaining])
      .toEqual([acknowledgment.before.health, acknowledgment.before.mind, acknowledgment.before.spirituality, acknowledgment.before.cash, acknowledgment.before.actionsRemaining]);
    const final = captured('final'), receipts = final.beautyGoddess.acquisitionJournal.filter(receipt => receipt.command.type === 'CONSUME');
    expect(receipts.map(receipt => [receipt.week, receipt.check!.roll, receipt.check!.chance, receipt.check!.tier, receipt.randomBefore, receipt.randomAfter])).toEqual([
      [141, 48, 44, 'FAILURE', 315, 316], [151, 67, 44, 'FAILURE', 316, 317], [160, 86, 44, 'FAILURE', 317, 318],
      [171, 57, 44, 'FAILURE', 318, 319], [180, 76, 44, 'FAILURE', 319, 320], [190, 64, 44, 'FAILURE', 320, 321],
      [200, 45, 44, 'FAILURE', 321, 322], [209, 2, 44, 'GREAT_SUCCESS', 322, 323],
    ]);
    for (const receipt of receipts.slice(0, 7)) {
      expect([receipt.after.health - receipt.before.health, receipt.after.mind - receipt.before.mind]).toEqual([-15, -25]);
      expect(receipt.after).toMatchObject({ gender: 'FEMALE', sequence: 2 }); same(receipt.after.mastery, receipt.before.mastery);
    }
    const failed = boundary('consume-beauty-goddess-potion-1'), promotion = boundary('consume-beauty-goddess-potion-8');
    same(applySliceIntent(failed.before, failed.intent), failed.final); same(applySliceIntent(promotion.before, promotion.intent), promotion.final);
    expect(promotion.final.beautyGoddess.promotionWeek).toBe(209); expect(promotion.final.beautyGoddess.transformation.outcome).toBe('FEMALE');
    expect(BEAUTY_GODDESS_ABILITY_IDS.map(id => promotion.final.progression.mastery[id])).toEqual([0, 0]);
    for (const [id, value] of Object.entries(promotion.before.progression.mastery)) expect(promotion.final.progression.mastery[id], id).toBe(value);
    for (const root of BEAUTY_GODDESS_SOURCE_KEYS) same(promotion.final[root], promotion.before[root]);
    expect(promotion.final.health).toBe(promotion.before.health); expect(promotion.final.spirituality).toBe(promotion.before.spirituality);
    expect(promotion.final.mind).toBe(promotion.before.mind - 8); same(promotion.final.injuries, promotion.before.injuries);
    expect(final.beautyGoddess.bottles.map(bottle => bottle.outcome)).toEqual(['FAILURE', 'FAILURE', 'FAILURE', 'FAILURE', 'FAILURE', 'FAILURE', 'FAILURE', 'GREAT_SUCCESS', null]);
    expect(final.beautyGoddess.bottles[8]).toMatchObject({ status: 'SUPPLIER', labourSteps: 0, acquiredWeek: null });
  });

  it('keeps failed ordinary precision, paid finite moonform application and obscured/withdrawn cleanup honest', () => {
    const final = captured('final'), life = final.beautyGoddess.life;
    expect(life.journal.filter(receipt => receipt.check).map(receipt => [receipt.command.type, receipt.checkBase, receipt.check!.roll, receipt.check!.chance, receipt.check!.tier, receipt.randomBefore, receipt.randomAfter])).toEqual([
      ['SELF_POISE', 28, 83, 70, 'FAILURE', 323, 324], ['PRECISION_PLACE', 29, 88, 72, 'FAILURE', 324, 325],
      ['BOUNDED_MOONFORM', 29, 69, 72, 'SUCCESS', 325, 326], ['GUEST_CARRY', 12, 26, 58, 'SUCCESS', 326, 327],
      ['BOUNDED_MOONFORM', 29, 7, 72, 'SUCCESS', 327, 328],
    ]);
    expect(Object.values(life.cases).map(report => [report.status, report.result, report.abilityApplied, report.returned])).toEqual([
      ['RESOLVED', 'ORDINARY', false, true], ['RESOLVED', 'ABILITY', true, true], ['RESOLVED', 'ORDINARY', false, true],
    ]);
    expect(life.cases['steady-hands']).toMatchObject({ poiseOutcome: 'FAILURE', operationOutcome: 'FAILURE', poiseEnd: 'FAILED' });
    expect(life.cases['lit-crossing']).toMatchObject({ moonformOutcome: 'SUCCESS', operationOutcome: 'SUCCESS', moonformEnd: 'APPLIED' });
    expect(life.cases['withdrawn-moonlight']).toMatchObject({ moonformOutcome: 'SUCCESS', operationOutcome: null, moonformEnd: 'OBSCURED', permission: { guest: 'WITHDRAWN' } });
    const window = boundary('lit-crossing-paid-bounded-window'), carry = boundary('same-guest-independent-carry'), report = boundary('lit-crossing-honest-report');
    same(applySliceIntent(window.before, window.intent), window.final);
    expect([window.before.spirituality - window.final.spirituality, window.before.mind - window.final.mind]).toEqual([8, 3]);
    expect(window.final.beautyGoddess.life.practice.pendingMoonform).toMatchObject({ createdAt: 233, expiresAt: 263, pieceId: 'BG1-MOON-PIECE-1' });
    expect(window.final.progression.mastery['moon.s1.bounded-moonform']).toBe(0);
    same(applySliceIntent(carry.before, carry.intent), carry.final); expect(carry.final.beautyGoddess.life.practice.pendingMoonform).toBeNull();
    expect(carry.final.summoningMaster.life.partner.stamina).toBe(carry.before.summoningMaster.life.partner.stamina - 6);
    expect(carry.final.progression.mastery['moon.s1.bounded-moonform']).toBe(0);
    expect(report.final.progression.mastery['moon.s1.bounded-moonform']).toBe(8);
    const shutter = boundary('real-shutter-blocks-window'); same(applySliceIntent(shutter.before, shutter.intent), shutter.final);
    expect(shutter.before.beautyGoddess.life.practice.pendingMoonform).not.toBeNull(); expect(shutter.final.beautyGoddess.life.practice.pendingMoonform).toBeNull();
    expect([shutter.final.spirituality, shutter.final.mind, shutter.final.cash]).toEqual([shutter.before.spirituality, shutter.before.mind, shutter.before.cash]);
    expect(life.practice).toMatchObject({ activeCase: null, playerLocation: 'YARD', ownerOffsetMetres: 0, guestOffsetMetres: 0, elapsedSeconds: 478, playerTravelMetres: 372,
      weight: { holder: 'BG1-DARIA42', location: 'OWNER' }, lamp: { holder: 'BG1-DARIA42', lit: false, fuelSeconds: 162, fuelBurnedSeconds: 18 }, pendingPoise: null, pendingMoonform: null });
    expect(life.practice.pieces.map(piece => [piece.status, piece.holder])).toEqual([['SPENT', 'RETURN_TRAY'], ['SPENT', 'RETURN_TRAY'], ['SUPPLIER', 'SHOP']]);
    expect(BEAUTY_GODDESS_ABILITY_IDS.map(id => final.progression.mastery[id])).toEqual([0, 8]);
    expect(life.reflected).toBe(true); expect(final.progression.acting).toBe(100);
  }, 10_000);

  it('replays the two actual BODY wins, keeps the mental-pressure slot distinct, and awards no unapplied combat mastery', () => {
    const final = captured('final'), rounds = final.combatHistory.filter(round => round.beautyGoddessOutcome);
    expect(rounds.map(round => [round.round, round.stance, round.winner, round.consequenceDomain, round.retreat])).toEqual([
      [1, 'DEFEND', 'PLAYER', 'BODY', 'NONE'], [2, 'CONTROL', 'PLAYER', 'BODY', 'NONE'],
    ]);
    expect(rounds.map(round => round.beautyGoddessOutcome!.enemyHealth)).toEqual([90, 60]);
    const actions = rounds.flatMap(round => [...round.beautyGoddessOutcome!.playerActions, ...round.beautyGoddessOutcome!.enemyActions]);
    expect(actions.filter(action => action.selectedAbility === 'MIND_PRESSURE')).toHaveLength(1);
    expect(actions.find(action => action.selectedAbility === 'MIND_PRESSURE')).toMatchObject({ attackKind: 'MENTAL', paidCost: 7 });
    expect(actions.find(action => action.planned === 'moon.s1.bounded-moonform')).toMatchObject({ selectedAbility: 'BLOCK', finiteResult: 'UNAVAILABLE', paidCost: 0, mindCost: 0, pieceId: null });
    expect(actions.find(action => action.selectedAbility === 'moon.s1.self-poise')).toMatchObject({ finiteResult: 'FAILED', paidCost: 6, mindCost: 2, check: { roll: 79, chance: 70, tier: 'FAILURE' } });
    expect(actions.flatMap(action => action.masteryApplied)).toEqual([]); expect(actions.every(action => action.paperId === null && action.pieceId === null)).toBe(true);
    for (let number = 1; number <= 2; number++) {
      const capture = boundary(`combat-round-${number}`);
      expect(capture.intent.type).toBe('COMBAT_ROUND');
      expect(projectSliceState(capture.before).combat?.beautyGoddess?.targetId).toBe('BG1-OSWALD-REED');
      same(applySliceIntent(capture.before, capture.intent), capture.final);
      same(capture.final.summoningMaster, capture.before.summoningMaster); same(capture.final.witchKing, capture.before.witchKing);
      same(capture.final.progression.mastery, capture.before.progression.mastery);
      expect(capture.final.health).toBe(capture.before.health); same(capture.final.injuries, capture.before.injuries);
    }
    expect(final.beautyGoddess.encounter).toMatchObject({ status: 'RESOLVED', targetId: 'BG1-OSWALD-REED', policy: 'ALL', enemyStatus: 'SURRENDERED', enemyHealth: 60, enemyMind: 100, enemySpirituality: 80,
      selfPoiseAttempts: 1, selfPoiseSuccesses: 0, moonformAttempts: 0, moonformSuccesses: 0, totalOwnerMindSpent: 2,
      terminal: { outcome: 'ENEMY_SURRENDERED', round: 2, historyIndex: 23, exitMetres: 4, exitSeconds: 4 },
      scene: { playerLocation: 'OUTSIDE', playerTravelMetres: 16, clockSeconds: 128, presentMemberIds: [], thirdPartiesInArea: 0 },
      materials: { weapon: { location: 'YARD', charge: 1 }, lamp: { location: 'RETURN_TRAY', fuelSeconds: 56, lit: false } } });
    expect(final.beautyGoddess.encounter.materials.pieces.map(piece => [piece.status, piece.location, piece.paidPennies])).toEqual([
      ['READY', 'RETURN_TRAY', 70], ['READY', 'RETURN_TRAY', 70], ['READY', 'RETURN_TRAY', 70],
    ]);
  }, 30_000);

  it('preserves the real surrendered opponent and ordinary work without healing, replenishing or rerolling', () => {
    const final = captured('final'), work = boundary('ordinary-life-after-exit');
    expect(final).toMatchObject({ status: 'ACTIVE', revision: 913, week: 219, date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 9, day: 1 },
      health: 100, mind: 98, spirituality: 110, cash: 314, actionsRemaining: 3, injuryRisk: 0, injuries: [], combat: null,
      random: { seed: 'apothecary-rebuild-first', cursor: 352 } });
    expect(work.intent).toEqual({ type: 'ACTION', action: 'WORK' }); expect(entry<SliceIntent[]>('commands').at(-1)).toEqual(work.intent);
    same(work.final, final); same(applySliceIntent(work.before, work.intent), final);
    expect(final.cash - work.before.cash).toBe(150); same(final.random, work.before.random); same(final.lastCombatRound, work.before.lastCombatRound);
    same(final.beautyGoddess, work.before.beautyGoddess); same(final.summoningMaster, work.before.summoningMaster);
    expect(projectSliceState(final).canAct).toBe(true); expect(projectSliceState(final).lifeGiver.actions).toEqual([]);
  }, 15_000);
});
