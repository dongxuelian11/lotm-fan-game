import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { validateAllKnowingEyeSource } from '../../src/domain/all-knowing-eye/index.js';
import { ALL_KNOWING_EYE_ABILITY_IDS, ALL_KNOWING_EYE_SOURCE_KEYS } from '../../src/domain/all-knowing-eye/types.js';
import { allKnowingEyeActionCount, allKnowingEyeEnemyActionCount, currentAllKnowingEyeCombatSource, replayAllKnowingEyeCombatRound } from '../../src/domain/all-knowing-eye/combat.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

const ROOT = 'tests/fixtures/all-knowing-eye-v01920';
const SOURCE = 'tests/fixtures/wisdom-angel-v01700/natural.json';
const PEACEFUL = 'tests/fixtures/wisdom-angel-v01700/original-enemy-approach.json';
const DEFENSIVE = 'tests/fixtures/wisdom-angel-v01700/defensive-round-2.json';
const SOURCE_SHA = '2e24ce11c787ba9b51d10d58b2abe9917c17a34a000d10394605944d52043e96';
const PEACEFUL_SHA = 'c208e391bb21812061361737bf5b22d6d3b21352945231eb81d0bd11c7be1fdd';
const DEFENSIVE_SHA = '6d34a93817e084cc3937eb15cde42300137d9d3b71c8ff84d814c42c8a46f870';
const [INSIGHT, FORECAST] = ALL_KNOWING_EYE_ABILITY_IDS;
const entry = <T>(key: string): T => readObjectEntry<T>(`${ROOT}/natural.json`, key);
const captured = (key: string): SliceState => migrateSliceState(entry<unknown>(key));
const same = (actual: unknown, expected: unknown) => {
  const a = stableStringify(actual), b = stableStringify(expected);
  const digest = (value: string) => createHash('sha256').update(value).digest('hex');
  expect(a === b, `Exact canonical bytes differ: ${a.length}/${digest(a)} versus ${b.length}/${digest(b)}`).toBe(true);
};
// A fresh LEARN_GUIDANCE writes the same-original recovery wording. Historical
// captures stay untouched; only this exact record changes in replay expectations.
const currentGuidanceExpected = (historical: SliceState): SliceState => {
  const currentExpected = structuredClone(historical);
  const guidance = currentExpected.chronicle[838]!;
  expect({ id: guidance.id, week: guidance.week, title: guidance.title }).toEqual({
    id: 'record-540-838', week: 125, title: '听取全知之眼独立成品与专业准备指导',
  });
  expect(currentExpected.chronicle.filter(record => record.id === guidance.id)).toHaveLength(1);
  expect(currentExpected.chronicle.filter(record => record.title === guidance.title)).toEqual([guidance]);
  const guidanceIsLatest = currentExpected.lastResult?.id === guidance.id;
  if (guidanceIsLatest) expect(currentExpected.lastResult).toEqual(guidance);
  expect(guidance.text).toBe('花1行动、500便士。旧私人借阅馆导师塞缪尔·维克说明原渠道记录。塞缪尔介绍独立封存的全知之眼成品魔药。当前渠道只交付成品，服用前须完成专业准备：核对阅读者至智慧天使八阶原瓶、三份实际报告与反思，写明亲眼观察到的条件和检验方式，再亲自走查停止、还物与返回路线。三项准备完成后，另付费检查当周场地，再独立确认饮用所选原瓶。智慧天使消化100、实际晋2后12整周、三份旧报告与反思完成、健康>20且精神>40。分别完成三项1行动专业准备，再付1行动与150便士检查当周场地；0行动独立确认饮用所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与本次准备均耗尽，专业支持只把本次排异后的健康与精神保底到1。成功四属性各+1，原19项掌握和智慧天使消化100留存，两项新掌握从0开始；灵性上限120且当前不补满。性别、姓名、年龄、性格与取向不变，旧伤须普通休养。原纸不复制，原示范器不充能，旧样本、微光片与材料不补充。全部原瓶失败后须付1行动与100便士申请下一批，至少跨一真实周才有新三瓶到货。');
  expect(createHash('sha256').update(guidance.text).digest('hex')).toBe('2b51b62010c5800f8f99a140c423860f4bd1a7248bd2a811aadda4d2132eaa54');
  guidance.text = '花1行动、500便士。旧私人借阅馆导师塞缪尔·维克说明原渠道记录。塞缪尔介绍独立封存的全知之眼成品魔药。当前渠道只交付成品，服用前须完成专业准备：核对阅读者至智慧天使八阶原瓶、三份实际报告与反思，写明亲眼观察到的条件和检验方式，再亲自走查停止、还物与返回路线。三项准备完成后，另付费检查当周场地，再独立确认饮用所选原瓶。智慧天使消化100、实际晋2后12整周、三份旧报告与反思完成、健康>20且精神>40。分别完成三项1行动专业准备，再付1行动与150便士检查当周场地；0行动独立确认饮用所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与本次准备均耗尽，专业支持只把本次排异后的健康与精神保底到1。成功四属性各+1，原19项掌握和智慧天使消化100留存，两项新掌握从0开始；灵性上限120且当前不补满。性别、姓名、年龄、性格与取向不变，旧伤须普通休养。原纸不复制，原示范器不充能，旧样本、微光片与材料不补充。最初三瓶均真实失败后，可付1行动与120便士，在原资料室出口当面取得玛拉本次许可，调查指定最新失败载体遗留的同一份原特性；隔一真实周再以1行动原处核验交接。新普通药液与调配另付900便士或五项新劳动后90便士，本次场地准备仍须150便士、1行动；旧费用、失败与原瓶全部保留，不增加第四份特性。';
  if (guidanceIsLatest) currentExpected.lastResult!.text = guidance.text;
  else expect(currentExpected.lastResult).toEqual(historical.lastResult);
  return currentExpected;
};
const index = (): Record<string, string> => JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8'));
const boundary = (name: string) => {
  const filename = index()[name];
  if (!filename) throw new Error(`Missing actual All-Knowing Eye boundary: ${name}`);
  const path = `${ROOT}/${filename}`;
  return { before: migrateSliceState(readObjectEntry<unknown>(path, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(path, 'lastIntent'), final: migrateSliceState(readObjectEntry<unknown>(path, 'final')) };
};
const snapshot = (name: string): SliceState => {
  const filename = entry<Record<string, string>>('snapshots')[name];
  if (!filename) throw new Error(`Missing actual All-Knowing Eye snapshot: ${name}`);
  return migrateSliceState(JSON.parse(readFileSync(`${ROOT}/${filename}`, 'utf8')));
};
const replayBoundary = (name: string) => {
  const save = boundary(name); same(applySliceIntent(save.before, save.intent), save.final); return save;
};
async function hash(path: string) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}

// Actual producer capture: original 537-command living branch, first-bottle
// success, a failed insight, one applied/one invalidated forecast, four CONTROL
// rounds, living surrender and one paid work action. No reroll or injected state.
describe('All-Knowing Eye exact original537-command public continuation', () => {
  it('pins the raw historical deaths and capture independently of current save migration', async () => {
    expect(await hash(SOURCE)).toBe(SOURCE_SHA); expect(await hash(PEACEFUL)).toBe(PEACEFUL_SHA);
    expect(await hash(DEFENSIVE)).toBe(DEFENSIVE_SHA);
    expect(await hash(`${ROOT}/natural.json`)).toBe('b838bff34dbf49f3df9968bcfef684a24c184e8320f9b8e6d7a1431bfc75a58f');
    expect(readObjectEntry(SOURCE, 'final')).toMatchObject({ schemaVersion: 167, contentVersion: 'wisdom-angel-v167',
      revision: 544, status: 'DEAD', health: 0, random: { seed: 'reader-natural-v023', cursor: 239 }, ending: { kind: 'DEATH' } });
    expect(readObjectEntry(DEFENSIVE, 'final')).toMatchObject({ schemaVersion: 167, contentVersion: 'wisdom-angel-v167',
      revision: 542, status: 'DEAD', health: 0, random: { seed: 'reader-natural-v023', cursor: 209 }, ending: { kind: 'DEATH' } });
    expect(readObjectEntry(PEACEFUL, 'beforeLast')).toMatchObject({ schemaVersion: 167, contentVersion: 'wisdom-angel-v167',
      revision: 538, status: 'ACTIVE', week: 125, health: 100, mind: 100, spirituality: 120, cash: 410, actionsRemaining: 3,
      injuries: [], injuryRisk: 0, random: { seed: 'reader-natural-v023', cursor: 180 } });
    expect(entry('final')).toMatchObject({ schemaVersion: 189, contentVersion: 'all-knowing-eye-v189' });
    const rawPrefix = entry('prefixFinal');
    expect(createHash('sha256').update(stableStringify(rawPrefix)).digest('hex')).toBe('877691d278ef433c034f030c9d72655d6d2a1d7073732f3666e8d9deaa9081c5');
  }, 180_000);

  it('replays all 666 commands from the same seed, with every continuation action available publicly', () => {
    const commands = entry<SliceIntent[]>('commands'), oldCommands = readObjectEntry<SliceIntent[]>(SOURCE, 'commands');
    expect(commands).toHaveLength(666); expect(oldCommands).toHaveLength(543);
    expect(entry('prefixCount')).toBe(537); expect(entry('prefixVerified')).toBe(true);
    same(commands.slice(0, 537), oldCommands.slice(0, 537)); same(oldCommands[537], readObjectEntry(PEACEFUL, 'lastIntent'));
    same(entry('creation'), readObjectEntry(SOURCE, 'creation')); expect(entry('seed')).toBe('reader-natural-v023');
    expect(entry('provenance')).toEqual({ kind: 'SAME_SEED_ORIGINAL537_LIVING_BOUNDARY_BRANCH', source: SOURCE, sourceSha256: SOURCE_SHA,
      peacefulSource: PEACEFUL, peacefulSha256: PEACEFUL_SHA, sourceRoot: 'beforeLast', defensiveSource: DEFENSIVE,
      defensiveSha256: DEFENSIVE_SHA, original543CommandDeathPreserved: true, separateDefensiveDeathPreserved: true, newRandomChanges: false });
    expect(entry('strategy')).toMatchObject({ caseMethod: 'ABILITY', encounterPolicy: 'ALL', combatStance: 'CONTROL', combatRoundCap: 90, potionAttemptCap: 12 });
    const original = captured('prefixFinal'), final = captured('final');
    same(original, migrateSliceState(readObjectEntry<unknown>(PEACEFUL, 'beforeLast')));
    let state = createSliceRun(final.runId, entry<Parameters<typeof createSliceRun>[1]>('creation'), entry<string>('seed'));
    same(state, captured('initial'));
    for (const [i, intent] of commands.entries()) {
      if (i >= 537) {
        const view = projectSliceState(state);
        if (intent.type === 'ALL_KNOWING_EYE') {
          const action = view.allKnowingEye.actions.find(row => stableStringify(row.command) === stableStringify(intent.command));
          expect(action, `Actual command ${i + 1} needs a public control`).toBeDefined();
          expect(action!.enabled, action!.reason ?? JSON.stringify(intent)).toBe(true);
        } else if (intent.type === 'COMBAT_ROUND') {
          expect(view.status).toBe('ACTIVE'); expect(view.activeEvent).toBeNull();
          expect(view.combat?.stances.some(stance => stance.id === intent.stance)).toBe(true);
        } else if (intent.type === 'ACTION') expect(view.canAct, view.actionBlockedReason ?? JSON.stringify(intent)).toBe(true);
      }
      state = applySliceIntent(state, intent);
      if (i === 536) same(state, original);
    }
    const currentExpected = currentGuidanceExpected(final);
    same(state, currentExpected); assertValidSliceState(state); same(migrateSliceState(state), state);
    expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(state.revision).toBe(captured('initial').revision + commands.length);
    expect(entry('pendingIntent')).toBeNull(); expect(entry('error')).toBeNull(); expect(entry('continuationSource')).toBeNull();
    expect(entry('treatments')).toEqual([]); expect(entry('stage')).toBe('NATURAL_ALL_KNOWING_EYE_PUBLIC_CONTINUATION');
    expect(Object.keys(index())).toHaveLength(131);
    expect(Object.keys(entry<Record<string, string>>('snapshots'))).toEqual(['departure', 'promoted', 'practiced', 'recoveredBeforeEncounter', 'combatStart', 'combatTerminal']);
  }, 180_000);

  it('keeps eight frozen roots, nineteen old masteries including five zeros, and the untouched old Victor', () => {
    const original = captured('prefixFinal'), promoted = snapshot('promoted'), final = captured('final');
    expect(Object.keys(original.progression.mastery)).toHaveLength(19);
    expect(Object.values(original.progression.mastery).filter(value => value === 0)).toHaveLength(5);
    for (const root of ALL_KNOWING_EYE_SOURCE_KEYS) {
      same(final.allKnowingEye.sourceHistory![root], original[root]); same(promoted[root], original[root]);
      if (root !== 'wisdomAngel') same(final[root], original[root]);
    }
    for (const [id, value] of Object.entries(original.progression.mastery)) expect(final.progression.mastery[id], id).toBe(value);
    expect(Object.keys(final.progression.mastery)).toHaveLength(21);
    expect(ALL_KNOWING_EYE_ABILITY_IDS.map(id => promoted.progression.mastery[id])).toEqual([0, 0]);
    same(final.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
    same(final.wisdomAngel.encounter, original.wisdomAngel.encounter);
    expect(final.wisdomAngel.encounter).toMatchObject({ targetId: 'WA2-VICTOR', status: 'AVAILABLE', approachWeek: null,
      attemptWeek: null, enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, terminal: null, playerTravelMetres: 0 });
    same({ ...final.character, coreStats: original.character.coreStats }, original.character);
    expect(final.progression.promotionWeek).toBe(original.progression.promotionWeek);
    expect(validateAllKnowingEyeSource(final)).toBe(true);
  }, 180_000);

  it('replays paid guidance, five labour steps, purchase, preparation and the first actual successful bottle', () => {
    const guidance = boundary('actual500p-guidance-and-frozen-eight-root-source');
    expect(guidance.intent).toEqual({ type: 'ALL_KNOWING_EYE', command: { type: 'LEARN_GUIDANCE' } });
    expect(guidance.before.chronicle).toHaveLength(838); expect(guidance.final.chronicle).toHaveLength(839);
    same(applySliceIntent(guidance.before, guidance.intent), currentGuidanceExpected(guidance.final));
    expect(guidance.before.cash - guidance.final.cash).toBe(500);
    const buy = replayBoundary('actual1100p-buy-all-knowing-eye-potion-1');
    const prepared = replayBoundary('actual150p-current-week-preparation-all-knowing-eye-potion-1');
    const dose = replayBoundary('actual-consumption-all-knowing-eye-potion-1'), events = dose.final.allKnowingEye.acquisitionJournal;
    expect(buy.before.cash - buy.final.cash).toBe(1100); expect(prepared.before.cash - prepared.final.cash).toBe(150);
    expect(events.filter(row => row.command.type === 'POTION_WORK')).toHaveLength(5);
    expect(events.filter(row => row.command.type === 'PREPARE_TASK')).toHaveLength(3);
    expect(events.filter(row => row.command.type === 'CONSUME').map(row => [row.week, row.check!.roll, row.check!.chance, row.check!.tier, row.randomBefore, row.randomAfter]))
      .toEqual([[136, 12, 44, 'SUCCESS', 180, 181]]);
    expect(events.reduce((sum, row) => sum + row.before.cash - row.after.cash, 0)).toBe(1750);
    expect(events.reduce((sum, row) => sum + row.before.actions - row.after.actions, 0)).toBe(10);
    expect(dose.final).toMatchObject({ health: 100, mind: 85, spirituality: 120, cash: 130, week: 136, revision: 575,
      character: { coreStats: { physique: 29, perception: 30, will: 28, knowledge: 31 } } });
    same({ ...dose.final.character, coreStats: dose.before.character.coreStats }, dose.before.character);
    same(dose.final.injuries, dose.before.injuries); expect(dose.final.allKnowingEye.preparedWeek).toBeNull();
    expect(dose.final.allKnowingEye.bottles.map(bottle => [bottle.status, bottle.outcome])).toEqual([['CONSUMED', 'SUCCESS'], ['SUPPLIER', null], ['SUPPLIER', null]]);
    expect(dose.final.allKnowingEye.promotionWeek! - captured('prefixFinal').wisdomAngel.promotionWeek!).toBeGreaterThanOrEqual(12);
  }, 180_000);

  it('preserves the failed paid insight and the independent ordinary verification without invented mastery', () => {
    const cast = replayBoundary('original-paper-check-one-paid-insight-attempt');
    const verify = replayBoundary('original-paper-check-independent-current-verification');
    expect([cast.before.spirituality - cast.final.spirituality, cast.before.mind - cast.final.mind]).toEqual([6, 2]);
    expect(cast.final.allKnowingEye.life.pending).toBeNull(); expect(cast.final.progression.mastery[INSIGHT]).toBe(0);
    expect(cast.final.allKnowingEye.life.cases['original-paper-check'].attempts[0]!.insight)
      .toMatchObject({ attempts: 1, successes: 0, effects: 0, tier: 'FAILURE', state: 'FAILED' });
    expect(verify.final.lastCheck).toMatchObject({ roll: 50, chance: 72, tier: 'SUCCESS', modifiers: [] });
    const result = snapshot('practiced').allKnowingEye.life.cases['original-paper-check'];
    expect(result).toMatchObject({ status: 'RESOLVED', result: 'ORDINARY', returned: true });
    expect(result.attempts[0]).toMatchObject({ handoverVerified: true, manualCompared: false, insight: { effects: 0, state: 'FAILED' } });
  }, 180_000);

  it('requires the actual subsequent release and independent catch before the successful forecast can be applied', () => {
    const cast = replayBoundary('pending-slider-one-paid-forecast-attempt');
    const caught = replayBoundary('pending-slider-actual-release-and-independent-catch');
    expect([cast.before.spirituality - cast.final.spirituality, cast.before.mind - cast.final.mind]).toEqual([8, 3]);
    expect(cast.final.allKnowingEye.life.pending).toMatchObject({ kind: 'FORECAST', caseId: 'pending-slider', bonus: 10 });
    expect(cast.final.allKnowingEye.life.rig).toMatchObject({ motion: 'COCKED', movements: 0, catches: 0 });
    expect(cast.final.progression.mastery[FORECAST]).toBe(0);
    expect(caught.final.allKnowingEye.life.pending).toBeNull(); expect(caught.final.progression.mastery[FORECAST]).toBe(0);
    expect(caught.final.lastCheck).toMatchObject({ roll: 88, chance: 90, tier: 'SUCCESS', modifiers: [{ source: '本次可见滑块的有限预判', value: 10 }] });
    expect(caught.final.allKnowingEye.life.cases['pending-slider'].attempts[0]).toMatchObject({ catchAttempted: true, catchSucceeded: true,
      forecast: { attempts: 1, successes: 1, effects: 1, state: 'APPLIED' } });
    expect(replayBoundary('pending-slider-honest-actual-result-report').final.progression.mastery[FORECAST]).toBe(8);
  }, 180_000);

  it('invalidates the second successful forecast on changed direction and sightline, preserving ordinary withdrawal cleanup', () => {
    const cast = replayBoundary('changed-conditions-one-paid-forecast-attempt');
    expect(cast.final.allKnowingEye.life.pending).toMatchObject({ kind: 'FORECAST', conditionVersion: 1 });
    const changed = replayBoundary('changed-conditions-actual-direction-and-sightline-change');
    expect(changed.final.allKnowingEye.life.pending).toBeNull();
    expect(changed.final.allKnowingEye.life.rig).toMatchObject({ motion: 'COCKED', direction: 'RIGHT', sightline: 'SHUTTERED' });
    expect(changed.final.allKnowingEye.life.cases['changed-conditions'].attempts[0]!.forecast).toMatchObject({ successes: 1, effects: 0, state: 'INVALIDATED' });
    for (const name of ['current-owner-withdrawal', 'ordinary-stop-after-withdrawal', 'ordinary-open-same-shutter', 'ordinary-retrieve-same-original',
      'same-original-papers-returned', 'same-owned-rig-returned-to-player', 'three-actual4metre-exits', 'actual-walk-out-and-adults-leave']) {
      const save = replayBoundary(`changed-conditions-${name}`);
      expect([save.final.spirituality, save.final.mind]).toEqual([save.before.spirituality, save.before.mind]);
      expect(save.final.progression.mastery[FORECAST]).toBe(8);
    }
    expect(snapshot('practiced').allKnowingEye.life.cases['changed-conditions']).toMatchObject({ status: 'RESOLVED', result: 'ORDINARY', returned: true });
  }, 180_000);

  it('accounts for all three honest life results, original objects, adult departures, costs and actual travel', () => {
    const practiced = snapshot('practiced'), life = practiced.allKnowingEye.life, original = captured('prefixFinal');
    expect(life.journal.filter(row => row.check).map(row => [row.command.type, row.checkBase, row.check!.roll, row.check!.chance, row.check!.tier, row.randomBefore, row.randomAfter]))
      .toEqual([['BOUNDED_INSIGHT', 31, 93, 76, 'FAILURE', 181, 182], ['VERIFY_HANDOVER', 31, 50, 72, 'SUCCESS', 182, 183],
        ['PENDING_FORECAST', 30, 31, 74, 'SUCCESS', 183, 184], ['CATCH_SLIDER', 30, 88, 90, 'SUCCESS', 184, 185], ['PENDING_FORECAST', 30, 69, 74, 'SUCCESS', 185, 186]]);
    expect(['actions', 'cash', 'spirituality', 'mind', 'health'].map(key => life.journal.reduce((sum, row) => sum + row.before[key as keyof typeof row.before] - row.after[key as keyof typeof row.after], 0))).toEqual([11, 60, 22, 8, 0]);
    expect(life).toMatchObject({ reflected: true, activeCase: null, pending: null, clockSeconds: 321, elapsedSeconds: 203,
      playerLocation: 'OUTSIDE', playerTravelMetres: 48, maraPresent: false,
      irena: { alive: true, health: 100, mind: 100, present: false, location: 'AWAY', travelMetres: 48 },
      rig: { owner: 'PLAYER', location: 'PLAYER', powered: false, sliderLocation: 'RIG', stopBlockLocation: 'RIG', motion: 'STOPPED',
        direction: 'RIGHT', sightline: 'CLEAR', conditionVersion: 3, movements: 1, catches: 1, manualStops: 1 } });
    expect(life.journal.reduce((sum, row) => sum + row.elapsedSeconds, 0)).toBe(life.elapsedSeconds);
    expect(life.journal.reduce((sum, row) => sum + row.playerWalkedMetres, 0)).toBe(life.playerTravelMetres);
    expect(practiced.wisdomAngel.life).toMatchObject({ playerLocation: 'EXIT', playerTravelMetres: 48,
      mara: { alive: true, health: 100, mind: 100, location: 'EXIT', travelMetres: 48 } });
    same(practiced.wisdomAngel.life.papers, original.wisdomAngel.life.papers);
    same(practiced.wisdomAngel.life.device, original.wisdomAngel.life.device);
    expect(practiced.wisdomAngel.life.device).toMatchObject({ charges: 0, filter: 'AMBER', conditionVersion: 2 });
    same(practiced.mysticismMagister.crafts, original.mysticismMagister.crafts);
    expect(practiced.mysticismMagister.crafts.map(craft => [craft.id, craft.status])).toEqual([['MM5-FLASH-1', 'CONSUMED'], ['MM5-FLASH-3', 'PLAYER'], ['MM5-FLASH-4', 'PLAYER']]);
    expect([practiced.progression.acting, practiced.progression.mastery[INSIGHT], practiced.progression.mastery[FORECAST]]).toEqual([100, 0, 8]);
  }, 180_000);

  it('replays all four real round sources, RNG/count wheels, finite costs and independent BODY versus MENTAL consequences', () => {
    const final = captured('final'), rounds = final.combatHistory.filter(round => round.allKnowingEyeOutcome);
    expect(rounds.map(round => [round.round, round.winner, round.consequenceDomain ?? null, round.playerCount, round.enemyCount, round.playerCountRoll, round.enemyCountRoll]))
      .toEqual([[1, 'ENEMY', 'MENTAL', 3, 1, 26, 7], [2, 'ENEMY', 'BODY', 3, 5, 46, 89], [3, 'PLAYER', null, 1, 5, 10, 88], [4, 'PLAYER', 'BODY', 3, 2, 36, 17]]);
    expect(rounds.map(round => [round.allKnowingEyeOutcome!.source.randomCursor, round.allKnowingEyeOutcome!.randomCursorAfter]))
      .toEqual([[186, 195], [195, 209], [209, 218], [218, 227]]);
    for (const round of rounds) {
      const save = replayBoundary(`combat-round-${round.round}`), outcome = round.allKnowingEyeOutcome!;
      expect(save.intent).toEqual({ type: 'COMBAT_ROUND', stance: 'CONTROL' });
      same(outcome.source, currentAllKnowingEyeCombatSource(save.before)); same(replayAllKnowingEyeCombatRound(outcome.source, 'CONTROL').round, round);
      same(save.final.lastCombatRound, round); same(save.final.progression.mastery, save.before.progression.mastery);
      expect(round.playerCount).toBe(allKnowingEyeActionCount(round.playerCountRoll)); expect(round.enemyCount).toBe(allKnowingEyeEnemyActionCount(round.enemyCountRoll));
      expect(outcome.playerActions).toHaveLength(round.playerCount); expect(outcome.enemyActions).toHaveLength(round.enemyCount);
      expect(outcome.source).toMatchObject({ targetId: 'AE1-EDWIN-ROSS', targetAge: 47, actualBody: true, independentMind: true,
        policy: 'ALL', ordinaryExit: 'OPEN', thirdPartiesInArea: 0, randomSeed: 'reader-natural-v023' });
      for (const action of [...outcome.playerActions, ...outcome.enemyActions]) {
        expect(action.materialsBefore.weapon.charge - action.materialsAfter.weapon.charge).toBe(action.rodChargeSpent);
        expect(action.consumedCraftId).toBeNull(); same(action.craftsBefore, action.craftsAfter);
        expect(action.masteryApplied).toEqual([]);
        if (action.selectedAbility === 'MIND_PRESSURE') expect(action.attackKind).toBe('MENTAL');
      }
      if (round.consequenceDomain === 'MENTAL') {
        expect(round.consequenceWeights).toBeNull(); same(outcome.playerInjuriesAfter, outcome.source.playerInjuries);
        expect(outcome.playerRiskAfter).toBe(outcome.source.playerRisk); expect(outcome.playerHealthAfter).toBe(outcome.source.playerHealth);
      }
    }
    const actions = rounds.flatMap(round => [...round.allKnowingEyeOutcome!.playerActions, ...round.allKnowingEyeOutcome!.enemyActions]);
    const insight = actions.filter(action => action.selectedAbility === INSIGHT);
    expect(insight).toHaveLength(2);
    for (const action of insight) expect(action).toMatchObject({ succeeded: true, finiteResult: 'PENDING', paidCost: 6, mindCost: 2, masteryApplied: [] });
    expect(actions.filter(action => action.selectedAbility === FORECAST)).toHaveLength(0);
    expect(rounds.flatMap(round => round.allKnowingEyeOutcome!.expiredWindows).map(window => window.kind)).toEqual(['BOUNDED_INSIGHT', 'BOUNDED_INSIGHT']);
    expect(final.allKnowingEye.encounter).toMatchObject({ boundedInsightAttempts: 2, boundedInsightChecks: 2, boundedInsightSuccesses: 0,
      pendingForecastAttempts: 0, pendingForecastChecks: 0, pendingForecastSuccesses: 0, totalOwnerMindSpent: 4,
      powerUses: { FLASH: 4, WARD: 1, MIND_PRESSURE: 4, FEINT: 1 } });
    expect(rounds[1]!.consequenceRoll).toBe(91); expect(rounds[3]!.consequenceRoll).toBe(87);
  }, 180_000);

  it('reopens living surrender and the actual paid work without treating the remaining heavy wound or rewriting either old death', () => {
    const terminal = snapshot('combatTerminal'), work = replayBoundary('actual-paid-work-after-living-exit'), final = captured('final');
    same(terminal, boundary('combat-round-4').final); same(terminal, boundary('actual-ordinary-encounter-exit').final);
    same(work.before, terminal); same(work.final, final); expect(work.intent).toEqual({ type: 'ACTION', action: 'WORK' });
    expect(final).toMatchObject({ status: 'ACTIVE', revision: 667, week: 146, health: 70, mind: 86, spirituality: 120, cash: 1390,
      actionsRemaining: 3, injuryRisk: 0, combat: null, ending: null, date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 4, day: 8 },
      random: { seed: 'reader-natural-v023', cursor: 227 } });
    expect(final.injuries.map(row => [row.severity, row.acquiredRevision, row.treatedRevision])).toEqual([['HEAVY', 664, null]]);
    expect(final.allKnowingEye.encounter).toMatchObject({ status: 'RESOLVED', enemyStatus: 'SURRENDERED', enemyHealth: 70, enemyMind: 100,
      enemySpirituality: 55, terminal: { outcome: 'ENEMY_SURRENDERED', round: 4, historyIndex: 13, exitMetres: 4, exitSeconds: 4 },
      scene: { playerLocation: 'OUTSIDE', playerCoordinate: 0, playerTravelMetres: 22, clockSeconds: 248 },
      materials: { weapon: { location: 'YARD', charge: 0, condition: 100 } } });
    same(final.mysticismMagister.crafts, captured('prefixFinal').mysticismMagister.crafts);
    const reopened = migrateSliceState(JSON.parse(JSON.stringify(final))); assertValidSliceState(reopened);
    same(reopened, final); same(projectSliceState(reopened), projectSliceState(final)); expect(projectSliceState(final).canAct).toBe(true);
    expect(readObjectEntry<SliceState>(SOURCE, 'final').status).toBe('DEAD'); expect(readObjectEntry<SliceState>(DEFENSIVE, 'final').status).toBe('DEAD');
  }, 180_000);
});
