import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import type { SpiritWarlockCompanion } from '../spirit-warlock/types.js';
import { hasNightwatcherOriginalSpirit } from '../nightwatcher/combat.js';
import { CONCEALMENT_SERVANT_TARGET_ID, CONCEALMENT_SERVANT_POWERS, CONCEALMENT_SERVANT_POWER_IDS, hasConcealmentServantDisputeOpponent,
  type ConcealmentServantEnemyIntent, type ConcealmentServantPowerId, type ConcealmentServantAbilityUses, type ConcealmentServantEncounterRoom } from './encounter.js';

/** Original G2 bounded slice. Same Darkness35/25/25/15 core and shared consequences.
 * A hidden interior is not a removed body: both ordinary bodies can reach the known open threshold. */
export const CONCEALMENT_SERVANT_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const CONCEALMENT_SERVANT_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const concealmentServantActionCount = pyromaniacActionCount;
export const concealmentServantEnemyActionCount = pyromaniacActionCount;
export type ConcealmentServantMoveId = 'STRIKE' | 'darkness.s2.bounded-concealment' | 'darkness.s2.trace-veil' | 'darkness.s3.dark-dissolution'
  | 'darkness.s3.sleep-fear' | 'darkness.s4.limited-misfortune' | 'darkness.s5.spirit-assistance' | 'ACCIDENT' | 'EVADE' | 'OBSERVE';
const CONCEAL = 'darkness.s2.bounded-concealment', VEIL = 'darkness.s2.trace-veil';
const DISSOLUTION = 'darkness.s3.dark-dissolution', SLEEP_FEAR = 'darkness.s3.sleep-fear';
const MISFORTUNE = 'darkness.s4.limited-misfortune', ASSISTANCE = 'darkness.s5.spirit-assistance';
const ABILITIES: readonly { id: ConcealmentServantMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: CONCEAL, label: '有限房间隐秘（6S/知识18；≤60秒，后续暗矢才减35G）', weight: 20, stance: 'DEFEND' },
  { id: VEIL, label: '有限遮踪（5S/意志18；原弱标记≤20秒，后续暗矢才减20G）', weight: 20, stance: 'CONTROL' },
  { id: DISSOLUTION, label: '继承黑暗毁灭（6S/知识18，65×原掌握G）', weight: 20, stance: 'ATTACK' },
  { id: SLEEP_FEAR, label: '继承睡恐短时压力（5S/意志18，减32G）', weight: 15, stance: 'CONTROL' },
  { id: MISFORTUNE, label: '继承有限厄运（4S/意志16，减22G）', weight: 10, stance: 'CONTROL' },
  { id: ASSISTANCE, label: '同一原卷叶（先2S派出0贡献；后槽2S协助减22G）', weight: 15, stance: 'DEFEND' },
];
export const CONCEALMENT_SERVANT_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'DARK_BOLT', label: '有限暗矢：7S/105G；仍需检索原目标', weight: 35 },
  { id: 'WARD', label: '有限护术：6S/减60G', weight: 25 },
  { id: 'BODY_STRIKE', label: '原门口可达原身体：原棍20×身体G', weight: 20 },
  { id: 'ANCHOR_LIGHT', label: '原场照明锚：4S/每轮一次，打断当前或下一新窗口', weight: 15 },
  { id: 'ACCIDENT', label: '判断偏差：−22.5G', weight: 5 },
];
export const isConcealmentServant = (s: SliceState): boolean => s.progression.pathwayId === 'darkness' && s.progression.sequence === 2;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function concealmentServantAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 }));
}
function drawPlayer(random: ActionRandomStream, stance: SliceStance | null): ConcealmentServantMoveId {
  const weights = tickets(stance); let n = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return a.id; } throw new Error('隐秘之仆能力盘无效。');
}
export function drawConcealmentServantAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): ConcealmentServantMoveId { return drawPlayer(random, stance); }
export function drawConcealmentServantEnemyAbility(random: ActionRandomStream): ConcealmentServantEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of CONCEALMENT_SERVANT_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as ConcealmentServantEnemyIntent; }
  throw new Error('原奥斯温能力盘无效。');
}
export interface ConcealmentServantCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'CONCEALMENT_SERVANT_DISPUTE'; targetId: typeof CONCEALMENT_SERVANT_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetAge: 47; targetSequence: 2; targetCore: 24; actualOriginalBody: true; independentMind: true;
  enemyWeapon: 'CS2-OSWIN-CLUB'; weaponLocation: 'HAND'; distanceMetres: 2; space: 'CS2-OSWIN-ROOM'; roomMetres: 6;
  door: 'CS2-OSWIN-DOOR'; doorStatus: 'OPEN'; playerLocation: 'DOORSTEP'; ordinaryExit: true; pursuit: false; trace: 'CS2-OSWIN-TRACE';
  playerTravelMetres: number; clockSeconds: number; playerHealth: number; playerMind: number; playerSpirituality: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; playerInjuries: SliceInjury[]; enemyInjuries: SliceInjury[]; playerRisk: number; enemyRisk: number;
  clubHeld: boolean; physique: number; perception: number; knowledge: number; will: number; dissolutionMastery: number;
  powerUses: Record<ConcealmentServantPowerId, number>; abilityUses: ConcealmentServantAbilityUses;
  companion: SpiritWarlockCompanion; spiritPromotionWeek: number | null; spiritCaseStatus: string; randomSeed: string; randomCursor: number;
}
export interface ConcealmentServantWindow { openedOrder: number; expiresAt: number }
export interface ConcealmentServantWindows { concealment: ConcealmentServantWindow | null; veil: ConcealmentServantWindow | null; anchorReady: boolean; anchorUsed: boolean }
export interface ConcealmentServantCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: false }
interface ActionEvidence extends ConcealmentServantCombatEffect {
  order: number; atSeconds: number; paidCost: number; physicalFactor: number; rolls: number[]; randomCursorBefore: number; randomCursorAfter: number;
  playerSpiritualityAfter: number; enemySpiritualityAfter: number; windowsBefore: ConcealmentServantWindows; windowsAfter: ConcealmentServantWindows;
}
export interface ConcealmentServantPlayerAction extends ActionEvidence {
  id: ConcealmentServantMoveId; spiritOperation: 'NONE' | 'DEPLOY' | 'ASSIST'; resisted: boolean; attempted: boolean; succeeded: boolean;
}
export interface ConcealmentServantEnemyAction extends ActionEvidence {
  planned: ConcealmentServantEnemyIntent; actual: ConcealmentServantEnemyIntent; anchorGranted: boolean;
  interrupted: ('BOUNDED_CONCEALMENT' | 'TRACE_VEIL')[]; applied: ('BOUNDED_CONCEALMENT' | 'TRACE_VEIL')[];
}
interface Runtime { playerS: number; enemyS: number; powers: Record<ConcealmentServantPowerId, number>; uses: ConcealmentServantAbilityUses; companion: SpiritWarlockCompanion; windows: ConcealmentServantWindows }
export interface ConcealmentServantRoundContext {
  source: ConcealmentServantCombatSource; stance: SliceStance; finished: boolean; liveState: string; runtime: Runtime;
  playerActions: ConcealmentServantPlayerAction[]; enemyActions: ConcealmentServantEnemyAction[]; label: string; outcome: ConcealmentServantRoundOutcome | null;
}
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]): boolean => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
const none = (label: string): ConcealmentServantCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
const emptyWindows = (): ConcealmentServantWindows => ({ concealment: null, veil: null, anchorReady: false, anchorUsed: false });
function validCompanion(p: SpiritWarlockCompanion, week: number): boolean {
  return shape(p, ['source', 'status', 'acquiredWeek', 'invitedWeek', 'releases', 'deployments', 'recalls']) && p.source === 'SW5-LEAF-1' &&
    ['UNMET', 'AVAILABLE', 'SEALED', 'DEPLOYED', 'RELEASED'].includes(p.status) && [p.acquiredWeek, p.invitedWeek].every(w => w === null || integer(w, 1, week)) &&
    integer(p.releases) && integer(p.deployments) && integer(p.recalls) && p.deployments - p.recalls === (p.status === 'DEPLOYED' ? 1 : 0);
}
function ownsOriginalSpirit(x: ConcealmentServantCombatSource, p: SpiritWarlockCompanion): boolean {
  return validCompanion(p, x.week) && integer(x.spiritPromotionWeek, 1, x.week) && integer(p.acquiredWeek, x.spiritPromotionWeek, x.week) &&
    integer(p.invitedWeek, p.acquiredWeek, x.week) && x.spiritCaseStatus !== 'AVAILABLE' && (p.status === 'SEALED' || p.status === 'DEPLOYED');
}
export function currentConcealmentServantCombatSource(s: SliceState): ConcealmentServantCombatSource | null {
  if (!hasConcealmentServantDisputeOpponent(s) || !validCompanion(s.spiritWarlock.companion, s.week)) return null;
  const e = s.concealmentServant.encounter, c = s.combat!, stats = s.character.coreStats;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'CONCEALMENT_SERVANT_DISPUTE', targetId: CONCEALMENT_SERVANT_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetAge: 47, targetSequence: 2, targetCore: 24, actualOriginalBody: true, independentMind: true,
    enemyWeapon: 'CS2-OSWIN-CLUB', weaponLocation: 'HAND', distanceMetres: 2, space: 'CS2-OSWIN-ROOM', roomMetres: 6,
    door: 'CS2-OSWIN-DOOR', doorStatus: 'OPEN', playerLocation: 'DOORSTEP', ordinaryExit: true, pursuit: false, trace: 'CS2-OSWIN-TRACE',
    playerTravelMetres: e.playerTravelMetres, clockSeconds: e.clockSeconds, playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality,
    playerInjuries: structuredClone(s.injuries), enemyInjuries: structuredClone(c.enemyInjuries), playerRisk: s.injuryRisk, enemyRisk: c.enemyRisk,
    clubHeld: s.town.clubLocation === 'HAND', physique: stats.physique, perception: stats.perception, knowledge: stats.knowledge, will: stats.will,
    dissolutionMastery: s.progression.mastery[DISSOLUTION] ?? 0, powerUses: { ...e.powerUses }, abilityUses: structuredClone(e.abilityUses),
    companion: structuredClone(s.spiritWarlock.companion), spiritPromotionWeek: s.spiritWarlock.promotionWeek,
    spiritCaseStatus: s.spiritWarlock.cases['listening-leaves']!.status, randomSeed: s.random.seed, randomCursor: s.random.cursor };
}
function makeRuntime(x: ConcealmentServantCombatSource): Runtime { return { playerS: x.playerSpirituality, enemyS: x.enemySpirituality,
  powers: { ...x.powerUses }, uses: structuredClone(x.abilityUses), companion: structuredClone(x.companion), windows: emptyWindows() }; }
function liveState(s: SliceState): string { const e = s.concealmentServant.encounter; return stableStringify({ spirituality: s.spirituality,
  enemySpirituality: e.enemySpirituality, powerUses: e.powerUses, abilityUses: e.abilityUses, companion: s.spiritWarlock.companion }); }
const dynamicSource = new Set(['playerSpirituality', 'enemySpirituality', 'powerUses', 'abilityUses', 'companion']);
function validRound(s: SliceState, r: ConcealmentServantRoundContext, supplied: ConcealmentServantCombatSource | null): boolean {
  const actual = currentConcealmentServantCombatSource(s);
  return !r.finished && actual !== null && supplied !== null && same(supplied, r.source) && r.liveState === liveState(s) &&
    Object.entries(r.source).every(([key, value]) => dynamicSource.has(key) || same(actual[key as keyof ConcealmentServantCombatSource], value));
}
export function beginConcealmentServantCombatRound(s: SliceState, stance: SliceStance, random: ActionRandomStream): ConcealmentServantRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('隐秘之仆姿态无效。');
  const source = currentConcealmentServantCombatSource(s);
  if (!source || source.companion.status === 'DEPLOYED' || random.seed !== source.randomSeed || random.cursor !== source.randomCursor)
    throw new Error('缺少同一原奥斯温、原门口、原随机或原卷叶已召回来源。');
  return { source, stance, finished: false, liveState: liveState(s), runtime: makeRuntime(source), playerActions: [], enemyActions: [], outcome: null,
    label: `原47岁奥斯温持唯一原棍在2米可达原门口，独立H${source.enemyHealth}/M${source.enemyMind}/S${source.enemySpirituality}；本人H${source.playerHealth}/M${source.playerMind}/S${source.playerSpirituality}。` };
}
export const createConcealmentServantCombatRound = beginConcealmentServantCombatRound;
function expire(runtime: Runtime, atSeconds: number): void {
  if (runtime.windows.concealment && runtime.windows.concealment.expiresAt <= atSeconds) runtime.windows.concealment = null;
  if (runtime.windows.veil && runtime.windows.veil.expiresAt <= atSeconds) runtime.windows.veil = null;
}
function actionBase(runtime: Runtime, order: number, physical: number, cursor: number): ActionEvidence {
  expire(runtime, order * 5);
  return { ...none(''), order, atSeconds: order * 5, paidCost: 0, physicalFactor: physical, rolls: [], randomCursorBefore: cursor,
    randomCursorAfter: cursor, playerSpiritualityAfter: runtime.playerS, enemySpiritualityAfter: runtime.enemyS,
    windowsBefore: structuredClone(runtime.windows), windowsAfter: structuredClone(runtime.windows) };
}
function closeAction<T extends ActionEvidence>(a: T, runtime: Runtime, random: ActionRandomStream): T {
  a.randomCursorAfter = random.cursor; a.playerSpiritualityAfter = runtime.playerS; a.enemySpiritualityAfter = runtime.enemyS;
  a.windowsAfter = structuredClone(runtime.windows); a.label += ` 本槽后本人S${runtime.playerS}/120，原敌S${runtime.enemyS}/120。`; return a;
}
function playerAction(x: ConcealmentServantCombatSource, runtime: Runtime, id: ConcealmentServantMoveId, physical: number, order: number, random: ActionRandomStream): ConcealmentServantPlayerAction {
  const a: ConcealmentServantPlayerAction = { ...actionBase(runtime, order, physical, random.cursor), id, spiritOperation: 'NONE', resisted: false, attempted: false, succeeded: false };
  const pay = (cost: number) => { runtime.playerS -= cost; a.paidCost = cost; };
  const strike = (why = '') => { a.selfGain = (x.clubHeld ? 16 : 12) * physical; a.threatens = a.selfGain > 0;
    a.label = `${why}本人以${x.clubHeld ? '实际在手的原棍16' : '自己的原身体12'}×身体普通打击G，只占原槽。`; };
  const evade = (why = '') => { a.enemyReduction = 10; a.label = `${why}本人在已知原门口普通避让减势10G，不重抽、不保证免伤。`; };
  const check = (ability: 'knowledge' | 'will', difficulty: number) => { const roll = random.nextInt(1, 100); a.rolls.push(roll);
    return roll <= computeCheckChance({ ability, baseAbility: x[ability], difficulty, modifiers: [] }); };
  if (id === 'STRIKE') strike();
  else if (id === 'EVADE') evade();
  else if (id === 'OBSERVE') a.label = '本人普通观察同一原身体和开放原门，0贡献0消耗。';
  else if (id === 'ACCIDENT') { a.selfGain = -22.5; a.label = '判断失衡固定−22.5G。'; }
  else if (id === ASSISTANCE) {
    if (runtime.playerS < 2 || !ownsOriginalSpirit(x, runtime.companion)) evade('没有实际已取得并封存/派出的同一原卷叶，或不足2S；');
    else if (runtime.companion.status === 'SEALED') { pay(2); runtime.companion.status = 'DEPLOYED'; runtime.companion.deployments++; a.spiritOperation = 'DEPLOY';
      a.label = '同一SW5-LEAF-1实际从原牙齿派出，2S、派出计数+1，本槽0贡献；没有新增行动者。'; }
    else { pay(2); a.spiritOperation = 'ASSIST'; a.enemyReduction = 22; a.label = '已实际派出的同一SW5-LEAF-1在后续原槽另付2S协助减势22G。'; }
  } else if (id === CONCEAL || id === VEIL) {
    const conceal = id === CONCEAL, cost = conceal ? 6 : 5, key = conceal ? 'BOUNDED_CONCEALMENT' : 'TRACE_VEIL';
    if (runtime.playerS < cost) evade(`不足${cost}S，未尝试新能力；`);
    else { pay(cost); a.attempted = true; runtime.uses[key].attempts++; a.succeeded = check(conceal ? 'knowledge' : 'will', 18);
      if (!a.succeeded) a.label = `${conceal ? '房间隐秘知识18' : '遮踪意志18'}实际失败，${cost}S不退，无新窗口、无补偿动作。`;
      else { runtime.uses[key].successes++;
        if (runtime.windows.anchorReady) { runtime.windows.anchorReady = false; a.resisted = true;
          a.label = `新能力检验成功但原奥斯温先前实际付4S的照明锚抵抗本次窗口，${cost}S不退，没有实际减势。`; }
        else { const window = { openedOrder: order, expiresAt: Math.min(60, order * 5 + (conceal ? 60 : 20)) };
          if (conceal) runtime.windows.concealment = window; else runtime.windows.veil = window;
          a.label = conceal ? '6S/知识18成功，6米原房间内部进入≤60秒有限隐秘；本人仍在已知可触及原门口，无位移。本槽0减势，下一真实暗矢检索才减35G一次。'
            : '5S/意志18成功，仅遮掩已登记原弱标记CS2-OSWIN-TRACE≤20秒。本槽0减势，下一真实暗矢检索才减20G一次；旧记录、物权和记忆不改。'; }
      }
    }
  } else if (id === DISSOLUTION) {
    if (runtime.playerS < 6) strike('不足6S，继承黑暗毁灭未施放；');
    else { pay(6); if (check('knowledge', 18)) { a.selfGain = 65 * (.65 + .35 * x.dissolutionMastery / 500); a.threatens = true;
        a.label = '继承黑暗毁灭实付6S/知识18成功，65×原掌握G优势；伤势由共同盘决定。'; }
      else a.label = '继承黑暗毁灭知识18失败，6S不退，0贡献。'; }
  } else {
    const sleep = id === SLEEP_FEAR, cost = sleep ? 5 : 4;
    if (runtime.playerS < cost) evade(`不足${cost}S，旧能力未施放；`);
    else { pay(cost); if (check('will', sleep ? 18 : 16)) { a.enemyReduction = sleep ? 32 : 22;
        a.label = sleep ? '继承短时睡恐压力实付5S/意志18成功，减势32G，本輪结束，无永久改心。' : '继承有限厄运实付4S/意志16成功，减势22G，仅本轮。'; }
      else a.label = `继承${sleep ? '睡恐' : '厄运'}检验失败，${cost}S不退，0减势。`; }
  }
  return closeAction(a, runtime, random);
}
function enemyAction(runtime: Runtime, planned: ConcealmentServantEnemyIntent, physical: number, order: number, random: ActionRandomStream): ConcealmentServantEnemyAction {
  const a: ConcealmentServantEnemyAction = { ...actionBase(runtime, order, physical, random.cursor), planned, actual: planned, anchorGranted: false, interrupted: [], applied: [] };
  const power = CONCEALMENT_SERVANT_POWERS.find(v => v.id === planned);
  if (power && (runtime.enemyS < power.cost || planned === 'ANCHOR_LIGHT' && runtime.windows.anchorUsed)) a.actual = 'BODY_STRIKE';
  if (power && a.actual === planned) { runtime.enemyS -= power.cost; runtime.powers[power.id]++; a.paidCost = power.cost; a.selfGain = power.selfGain; a.enemyReduction = power.enemyReduction; }
  if (a.actual === 'BODY_STRIKE') { a.selfGain = 20 * physical; a.threatens = a.selfGain > 0;
    a.label = `${power ? '法术资源不足或本轮锚已用，同槽普通回退；' : ''}奥斯温持自己的唯一原棍20×身体G，实际攻击仍可达的已知原门口身体；隐秘只遮原房间内部视线，不删除身体。`; }
  else if (a.actual === 'ACCIDENT') { a.selfGain = -22.5; a.label = '原奥斯温判断偏差，固定−22.5G。'; }
  else if (a.actual === 'ANCHOR_LIGHT') { a.anchorGranted = true; runtime.windows.anchorUsed = true;
    if (runtime.windows.concealment) { a.interrupted.push('BOUNDED_CONCEALMENT'); runtime.windows.concealment = null; }
    if (runtime.windows.veil) { a.interrupted.push('TRACE_VEIL'); runtime.windows.veil = null; }
    runtime.windows.anchorReady = a.interrupted.length === 0;
    a.label = `原奥斯温实付4S，在同一原门口建立本轮一次照明锚；${a.interrupted.length ? '现存窗口实际中断' : '抵抗下一次成功新窗口'}，不撤销已完成的检索阻延或旧技能效果。`; }
  else if (a.actual === 'DARK_BOLT') { a.threatens = true;
    if (runtime.windows.concealment) { a.selfGain -= 35; a.applied.push('BOUNDED_CONCEALMENT'); runtime.uses.BOUNDED_CONCEALMENT.effects++; runtime.windows.concealment = null; }
    if (runtime.windows.veil) { a.selfGain -= 20; a.applied.push('TRACE_VEIL'); runtime.uses.TRACE_VEIL.effects++; runtime.windows.veil = null; }
    a.label = `原暗矢实付7S，实际检索原门口目标；105G${a.applied.length ? `由当前窗口实际有限减为${a.selfGain}G，消费一次窗口` : '，没有可用窗口'}。仍是实际致伤攻击，不保证免伤。`; }
  else a.label = '原奥斯温有限护术实付6S，减势60G；不恢复H/M/S。';
  return closeAction(a, runtime, random);
}
function commitRuntime(s: SliceState, r: ConcealmentServantRoundContext): void {
  const e = s.concealmentServant.encounter; s.spirituality = r.runtime.playerS; e.enemySpirituality = r.runtime.enemyS;
  e.powerUses = { ...r.runtime.powers }; e.abilityUses = structuredClone(r.runtime.uses); s.spiritWarlock.companion = structuredClone(r.runtime.companion); r.liveState = liveState(s);
}
const physicalAt = (health: number): number => health > 75 ? 1 : health > 50 ? .95 : health > 25 ? .9 : .8;
export function resolveConcealmentServantCombatAbility(s: SliceState, id: ConcealmentServantMoveId, physical: number, random: ActionRandomStream,
  r: ConcealmentServantRoundContext, source: ConcealmentServantCombatSource | null = r.source): ConcealmentServantCombatEffect {
  if (!validRound(s, r, source) || r.playerActions.length >= 6 || physical !== physicalAt(r.source.playerHealth) || random.seed !== r.source.randomSeed ||
      ![...ABILITIES.map(v => v.id), 'STRIKE', 'EVADE', 'OBSERVE', 'ACCIDENT'].includes(id)) return none('缺少当前原身体/原资源/真实回合来源，0贡献0消耗，不重抽。');
  const a = playerAction(r.source, r.runtime, id, physical, r.playerActions.length + r.enemyActions.length, random);
  r.playerActions.push(a); commitRuntime(s, r); return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export function resolveConcealmentServantEnemyAbility(s: SliceState, planned: ConcealmentServantEnemyIntent, physical: number, random: ActionRandomStream,
  r: ConcealmentServantRoundContext, source: ConcealmentServantCombatSource | null = r.source): ConcealmentServantCombatEffect {
  if (!validRound(s, r, source) || r.enemyActions.length >= 6 || physical !== physicalAt(r.source.enemyHealth) || random.seed !== r.source.randomSeed ||
      ![...CONCEALMENT_SERVANT_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned)) return none('缺少当前原奥斯温/原棍/真实回合来源，0贡献0消耗，不重抽。');
  const a = enemyAction(r.runtime, planned, physical, r.playerActions.length + r.enemyActions.length, random);
  r.enemyActions.push(a); commitRuntime(s, r); return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export interface ConcealmentServantRoundOutcome {
  targetId: typeof CONCEALMENT_SERVANT_TARGET_ID; round: number; source: ConcealmentServantCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number;
  playerInjuriesAfter: SliceInjury[]; enemyInjuriesAfter: SliceInjury[]; playerRiskAfter: number; enemyRiskAfter: number;
  powerUses: Record<ConcealmentServantPowerId, number>; abilityUses: ConcealmentServantAbilityUses; companionAfter: SpiritWarlockCompanion; recalled: boolean;
  windowsBeforeClose: ConcealmentServantWindows; windowsAfter: ConcealmentServantWindows; elapsedSeconds: 60 | 62;
  playerLocationAfter: 'DOORSTEP' | 'OUTSIDE'; playerTravelMetresAfter: number; clockSecondsAfter: number; randomCursorAfter: number;
  playerActions: ConcealmentServantPlayerAction[]; enemyActions: ConcealmentServantEnemyAction[];
}
export function finishConcealmentServantCombatRound(s: SliceState, r: ConcealmentServantRoundContext, continuing = true, randomCursorAfter = s.random.cursor): ConcealmentServantRoundOutcome {
  const e = s.concealmentServant.encounter, c = s.combat, spirit = s.spiritWarlock.companion;
  if (r.finished || !c || c.encounterId !== 'CONCEALMENT_SERVANT_DISPUTE' || c.round !== r.source.round || r.liveState !== liveState(s)) throw new Error('原隐秘回合已结束或资源被改写。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  if (e.enemyStatus !== 'RESISTING') e.weaponLocation = 'YARD';
  const recalled = spirit.status === 'DEPLOYED' && ownsOriginalSpirit(r.source, spirit) && hasNightwatcherOriginalSpirit(s);
  if (recalled) { spirit.status = 'SEALED'; spirit.recalls++; }
  expire(r.runtime, 60); const windowsBeforeClose = structuredClone(r.runtime.windows); r.runtime.windows = emptyWindows();
  const leave = !continuing && s.health > 0;
  if (leave) { if (e.room.doorStatus !== 'OPEN' || e.playerLocation !== 'DOORSTEP') throw new Error('原门不通，不能凭隐秘离场。'); e.playerLocation = 'OUTSIDE'; e.playerTravelMetres += 2; }
  const elapsedSeconds = leave ? 62 : 60; e.clockSeconds += elapsedSeconds; r.finished = true;
  r.outcome = { targetId: CONCEALMENT_SERVANT_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus,
    playerSpiritualityBefore: r.source.playerSpirituality, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind,
    enemySpiritualityBefore: r.source.enemySpirituality, playerInjuriesAfter: structuredClone(s.injuries), enemyInjuriesAfter: structuredClone(c.enemyInjuries),
    playerRiskAfter: s.injuryRisk, enemyRiskAfter: c.enemyRisk, powerUses: { ...e.powerUses }, abilityUses: structuredClone(e.abilityUses), companionAfter: structuredClone(spirit), recalled,
    windowsBeforeClose, windowsAfter: emptyWindows(), elapsedSeconds, playerLocationAfter: e.playerLocation,
    playerTravelMetresAfter: e.playerTravelMetres, clockSecondsAfter: e.clockSeconds, randomCursorAfter,
    playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
  return structuredClone(r.outcome);
}
export function concealmentServantRoundOutcome(r: ConcealmentServantRoundContext): ConcealmentServantRoundOutcome { if (!r.outcome) throw new Error('先结束原隐秘回合。'); return structuredClone(r.outcome); }
/** Positive field lists preserve settled facts without replay sources or RNG positions. */
function projectConcealmentServantCompanion(companion: SpiritWarlockCompanion) {
  return {
    source: companion.source, status: companion.status, acquiredWeek: companion.acquiredWeek, invitedWeek: companion.invitedWeek,
    releases: companion.releases, deployments: companion.deployments, recalls: companion.recalls,
  };
}
function projectConcealmentServantPowerUses(powerUses: Record<ConcealmentServantPowerId, number>) {
  return { DARK_BOLT: powerUses.DARK_BOLT, WARD: powerUses.WARD, ANCHOR_LIGHT: powerUses.ANCHOR_LIGHT };
}
function projectConcealmentServantAbilityUses(abilityUses: ConcealmentServantAbilityUses) {
  return {
    BOUNDED_CONCEALMENT: {
      attempts: abilityUses.BOUNDED_CONCEALMENT.attempts, successes: abilityUses.BOUNDED_CONCEALMENT.successes,
      effects: abilityUses.BOUNDED_CONCEALMENT.effects,
    },
    TRACE_VEIL: { attempts: abilityUses.TRACE_VEIL.attempts, successes: abilityUses.TRACE_VEIL.successes, effects: abilityUses.TRACE_VEIL.effects },
  };
}
function projectConcealmentServantWindow(window: ConcealmentServantWindow | null) {
  return window === null ? null : { openedOrder: window.openedOrder, expiresAt: window.expiresAt };
}
function projectConcealmentServantWindows(windows: ConcealmentServantWindows) {
  return {
    concealment: projectConcealmentServantWindow(windows.concealment), veil: projectConcealmentServantWindow(windows.veil),
    anchorReady: windows.anchorReady, anchorUsed: windows.anchorUsed,
  };
}
function projectConcealmentServantInjury(injury: SliceInjury) {
  return { id: injury.id, severity: injury.severity, acquiredRevision: injury.acquiredRevision, treatedRevision: injury.treatedRevision };
}
function projectConcealmentServantRoom(room: ConcealmentServantEncounterRoom) {
  return {
    id: room.id, widthMetres: room.widthMetres, doorId: room.doorId, doorStatus: room.doorStatus,
    traceId: room.traceId, tracePresent: room.tracePresent,
  };
}
function projectConcealmentServantWheelEntry(entry: SliceWheelEntry) {
  return { id: entry.id, label: entry.label, weight: entry.weight };
}
interface PublicConcealmentServantActionEvidence {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: false;
  order: number; atSeconds: number; paidCost: number; physicalFactor: number; rolls: number[];
  playerSpiritualityAfter: number; enemySpiritualityAfter: number;
  windowsBefore: ReturnType<typeof projectConcealmentServantWindows>; windowsAfter: ReturnType<typeof projectConcealmentServantWindows>;
}
export interface PublicConcealmentServantPlayerAction extends PublicConcealmentServantActionEvidence {
  id: ConcealmentServantMoveId; spiritOperation: 'NONE' | 'DEPLOY' | 'ASSIST'; resisted: boolean; attempted: boolean; succeeded: boolean;
}
export interface PublicConcealmentServantEnemyAction extends PublicConcealmentServantActionEvidence {
  planned: ConcealmentServantEnemyIntent; actual: ConcealmentServantEnemyIntent; anchorGranted: boolean;
  interrupted: ('BOUNDED_CONCEALMENT' | 'TRACE_VEIL')[]; applied: ('BOUNDED_CONCEALMENT' | 'TRACE_VEIL')[];
}
export function projectConcealmentServantPlayerAction(action: ConcealmentServantPlayerAction): PublicConcealmentServantPlayerAction {
  return {
    label: action.label, selfGain: action.selfGain, enemyReduction: action.enemyReduction,
    threatens: action.threatens, mentalPressure: action.mentalPressure, order: action.order, atSeconds: action.atSeconds,
    paidCost: action.paidCost, physicalFactor: action.physicalFactor, rolls: action.rolls.map(roll => roll),
    playerSpiritualityAfter: action.playerSpiritualityAfter, enemySpiritualityAfter: action.enemySpiritualityAfter,
    windowsBefore: projectConcealmentServantWindows(action.windowsBefore), windowsAfter: projectConcealmentServantWindows(action.windowsAfter),
    id: action.id, spiritOperation: action.spiritOperation, resisted: action.resisted, attempted: action.attempted, succeeded: action.succeeded,
  };
}
export function projectConcealmentServantEnemyAction(action: ConcealmentServantEnemyAction): PublicConcealmentServantEnemyAction {
  return {
    label: action.label, selfGain: action.selfGain, enemyReduction: action.enemyReduction,
    threatens: action.threatens, mentalPressure: action.mentalPressure, order: action.order, atSeconds: action.atSeconds,
    paidCost: action.paidCost, physicalFactor: action.physicalFactor, rolls: action.rolls.map(roll => roll),
    playerSpiritualityAfter: action.playerSpiritualityAfter, enemySpiritualityAfter: action.enemySpiritualityAfter,
    windowsBefore: projectConcealmentServantWindows(action.windowsBefore), windowsAfter: projectConcealmentServantWindows(action.windowsAfter),
    planned: action.planned, actual: action.actual, anchorGranted: action.anchorGranted,
    interrupted: action.interrupted.map(id => id), applied: action.applied.map(id => id),
  };
}
function projectConcealmentServantWindowSequenceEntry(action: Pick<ActionEvidence, 'order' | 'atSeconds' | 'label' | 'windowsBefore' | 'windowsAfter'>) {
  return {
    order: action.order, atSeconds: action.atSeconds, label: action.label,
    windowsBefore: projectConcealmentServantWindows(action.windowsBefore), windowsAfter: projectConcealmentServantWindows(action.windowsAfter),
  };
}
export interface PublicConcealmentServantRoundOutcome {
  targetId: typeof CONCEALMENT_SERVANT_TARGET_ID; round: number; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number;
  playerInjuriesAfter: ReturnType<typeof projectConcealmentServantInjury>[]; enemyInjuriesAfter: ReturnType<typeof projectConcealmentServantInjury>[];
  playerRiskAfter: number; enemyRiskAfter: number;
  powerUses: ReturnType<typeof projectConcealmentServantPowerUses>; abilityUses: ReturnType<typeof projectConcealmentServantAbilityUses>;
  companionAfter: ReturnType<typeof projectConcealmentServantCompanion>; recalled: boolean;
  windowsBeforeClose: ReturnType<typeof projectConcealmentServantWindows>; windowsAfter: ReturnType<typeof projectConcealmentServantWindows>;
  elapsedSeconds: 60 | 62; playerLocationAfter: 'DOORSTEP' | 'OUTSIDE'; playerTravelMetresAfter: number; clockSecondsAfter: number;
  playerActions: PublicConcealmentServantPlayerAction[]; enemyActions: PublicConcealmentServantEnemyAction[];
}
export function projectConcealmentServantRoundOutcome(outcome: ConcealmentServantRoundOutcome): PublicConcealmentServantRoundOutcome {
  return {
    targetId: outcome.targetId, round: outcome.round, stance: outcome.stance, continuing: outcome.continuing,
    enemyHealth: outcome.enemyHealth, enemyMind: outcome.enemyMind, enemySpirituality: outcome.enemySpirituality, enemyStatus: outcome.enemyStatus,
    playerSpiritualityBefore: outcome.playerSpiritualityBefore, playerSpiritualityAfter: outcome.playerSpiritualityAfter,
    playerHealthAfter: outcome.playerHealthAfter, playerMindAfter: outcome.playerMindAfter, enemySpiritualityBefore: outcome.enemySpiritualityBefore,
    playerInjuriesAfter: outcome.playerInjuriesAfter.map(projectConcealmentServantInjury), enemyInjuriesAfter: outcome.enemyInjuriesAfter.map(projectConcealmentServantInjury),
    playerRiskAfter: outcome.playerRiskAfter, enemyRiskAfter: outcome.enemyRiskAfter,
    powerUses: projectConcealmentServantPowerUses(outcome.powerUses), abilityUses: projectConcealmentServantAbilityUses(outcome.abilityUses),
    companionAfter: projectConcealmentServantCompanion(outcome.companionAfter), recalled: outcome.recalled,
    windowsBeforeClose: projectConcealmentServantWindows(outcome.windowsBeforeClose), windowsAfter: projectConcealmentServantWindows(outcome.windowsAfter),
    elapsedSeconds: outcome.elapsedSeconds, playerLocationAfter: outcome.playerLocationAfter,
    playerTravelMetresAfter: outcome.playerTravelMetresAfter, clockSecondsAfter: outcome.clockSecondsAfter,
    playerActions: outcome.playerActions.map(projectConcealmentServantPlayerAction), enemyActions: outcome.enemyActions.map(projectConcealmentServantEnemyAction),
  };
}
export interface PublicConcealmentServantCombatProjection {
  enemyName: string; targetId: typeof CONCEALMENT_SERVANT_TARGET_ID | null;
  playerHealth: number; playerMind: number; playerSpirituality: number; maxSpirituality: number;
  enemyHealth: number | null; enemyMind: number | null; enemySpirituality: number | null;
  powerUses: ReturnType<typeof projectConcealmentServantPowerUses> | null; abilityUses: ReturnType<typeof projectConcealmentServantAbilityUses> | null;
  companion: ReturnType<typeof projectConcealmentServantCompanion> | null; room: ReturnType<typeof projectConcealmentServantRoom> | null;
  playerLocation: 'DOORSTEP' | 'OUTSIDE'; playerTravelMetres: number; clockSeconds: number;
  windows: ReturnType<typeof projectConcealmentServantWindows>; concealmentRemainingSeconds: number; veilRemainingSeconds: number; windowStatus: string;
  lastWindowSequence: ReturnType<typeof projectConcealmentServantWindowSequenceEntry>[];
  originalExit: boolean; pursuit: boolean; distanceMetres: number;
  countWheel: ReturnType<typeof projectConcealmentServantWheelEntry>[]; enemyCountWheel: ReturnType<typeof projectConcealmentServantWheelEntry>[];
  enemyAbilityWheel: ReturnType<typeof projectConcealmentServantWheelEntry>[]; summary: string;
}
export function projectConcealmentServantCombat(s: SliceState): PublicConcealmentServantCombatProjection {
  const e = s.concealmentServant.encounter, visible = isConcealmentServant(s);
  const last = s.combat?.encounterId === 'CONCEALMENT_SERVANT_DISPUTE' ? s.combat.lastRound?.concealmentServantOutcome : e.terminal ? s.combatHistory[e.terminal.historyIndex]?.concealmentServantOutcome : null;
  return { enemyName: visible ? '奥斯温（47岁，原创有限G2非凡者）' : '', targetId: visible ? e.targetId : null,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, maxSpirituality: 120,
    enemyHealth: visible ? e.enemyHealth : null, enemyMind: visible ? e.enemyMind : null, enemySpirituality: visible ? e.enemySpirituality : null,
    powerUses: visible ? projectConcealmentServantPowerUses(e.powerUses) : null, abilityUses: visible ? projectConcealmentServantAbilityUses(e.abilityUses) : null,
    companion: visible ? projectConcealmentServantCompanion(s.spiritWarlock.companion) : null, room: visible ? projectConcealmentServantRoom(e.room) : null,
    playerLocation: e.playerLocation, playerTravelMetres: e.playerTravelMetres, clockSeconds: e.clockSeconds,
    windows: projectConcealmentServantWindows(emptyWindows()), concealmentRemainingSeconds: 0, veilRemainingSeconds: 0,
    windowStatus: '回合结算边界：本轮有限窗口均已实际收束；下一轮须重新付费。',
    lastWindowSequence: visible && last ? last.playerActions.map(projectConcealmentServantWindowSequenceEntry)
      .concat(last.enemyActions.map(projectConcealmentServantWindowSequenceEntry)).sort((a,b) => a.order-b.order) : [],
    originalExit: e.room.doorStatus === 'OPEN', pursuit: false, distanceMetres: 2,
    countWheel: CONCEALMENT_SERVANT_COUNT_WHEEL.map(projectConcealmentServantWheelEntry), enemyCountWheel: CONCEALMENT_SERVANT_ENEMY_COUNT_WHEEL.map(projectConcealmentServantWheelEntry),
    enemyAbilityWheel: CONCEALMENT_SERVANT_ENEMY_ABILITY_WHEEL.map(projectConcealmentServantWheelEntry),
    summary: visible ? 'G：黑暗原核心35/25/25/15、1250/底125，S120，仅继续轮恢复12。每实际槽5秒，≤60秒收束；隐秘/遮踪成功开窗不等于应用，后续暗矢实际减35/20才计效果。敌4S锚每轮一次只中断当前或下一窗口；原身体仍在已知可达门口，普通棍击、实际伤勢和50%普通撤离不豁免。原卷叶须真实已取得，2S派出/后槽2S协助/轮末召回。所有限额、费用与场景为原创G。' : '' };
}

const SOURCE_KEYS = ['runId','revision','week','round','encounterId','targetId','attemptWeek','startHistoryIndex','targetAge','targetSequence','targetCore','actualOriginalBody','independentMind','enemyWeapon','weaponLocation','distanceMetres','space','roomMetres','door','doorStatus','playerLocation','ordinaryExit','pursuit','trace','playerTravelMetres','clockSeconds','playerHealth','playerMind','playerSpirituality','enemyHealth','enemyMind','enemySpirituality','playerInjuries','enemyInjuries','playerRisk','enemyRisk','clubHeld','physique','perception','knowledge','will','dissolutionMastery','powerUses','abilityUses','companion','spiritPromotionWeek','spiritCaseStatus','randomSeed','randomCursor'] as const;
export function validateConcealmentServantAbilityUses(v: ConcealmentServantAbilityUses): boolean {
  return shape(v, ['BOUNDED_CONCEALMENT', 'TRACE_VEIL']) && Object.values(v).every(u => shape(u, ['attempts','successes','effects']) &&
    integer(u.attempts) && integer(u.successes, 0, u.attempts) && integer(u.effects, 0, u.successes));
}
function validInjuries(v: SliceInjury[], revision: number): boolean {
  return Array.isArray(v) && new Set(v.map(i => i.id)).size === v.length && v.every(i => shape(i, ['id','severity','acquiredRevision','treatedRevision']) &&
    typeof i.id === 'string' && i.id.length > 0 && ['LIGHT','HEAVY'].includes(i.severity) && integer(i.acquiredRevision, 1, revision) &&
    (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision, revision)));
}
function validSource(x: ConcealmentServantCombatSource): boolean {
  return shape(x, SOURCE_KEYS) && typeof x.runId === 'string' && x.runId.length > 0 && integer(x.revision) && integer(x.week, 1) && integer(x.round, 1) &&
    integer(x.startHistoryIndex) && x.attemptWeek === x.week && x.encounterId === 'CONCEALMENT_SERVANT_DISPUTE' && x.targetId === CONCEALMENT_SERVANT_TARGET_ID &&
    x.targetAge === 47 && x.targetSequence === 2 && x.targetCore === 24 && x.actualOriginalBody === true && x.independentMind === true &&
    x.enemyWeapon === 'CS2-OSWIN-CLUB' && x.weaponLocation === 'HAND' && x.distanceMetres === 2 && x.space === 'CS2-OSWIN-ROOM' && x.roomMetres === 6 &&
    x.door === 'CS2-OSWIN-DOOR' && x.doorStatus === 'OPEN' && x.playerLocation === 'DOORSTEP' && x.ordinaryExit === true && x.pursuit === false && x.trace === 'CS2-OSWIN-TRACE' &&
    x.playerTravelMetres === 2 && x.clockSeconds === 2 + (x.round - 1) * 60 && [x.playerHealth,x.playerMind,x.enemyHealth,x.enemyMind].every(n => integer(n, 1, 100)) &&
    x.enemyMind === 100 && [x.playerSpirituality,x.enemySpirituality].every(n => integer(n, 0, 120)) && [x.physique,x.perception,x.knowledge,x.will,x.dissolutionMastery].every(n => integer(n, 0, 500)) &&
    typeof x.clubHeld === 'boolean' && integer(x.playerRisk) && integer(x.enemyRisk) && validInjuries(x.playerInjuries,x.revision) && validInjuries(x.enemyInjuries,x.revision) &&
    shape(x.powerUses, CONCEALMENT_SERVANT_POWER_IDS) && CONCEALMENT_SERVANT_POWER_IDS.every(id => integer(x.powerUses[id])) &&
    x.enemySpirituality === 120 - CONCEALMENT_SERVANT_POWERS.reduce((n,p) => n + p.cost * x.powerUses[p.id],0) && validateConcealmentServantAbilityUses(x.abilityUses) &&
    validCompanion(x.companion,x.week) && x.companion.status !== 'DEPLOYED' &&
    (x.spiritPromotionWeek === null || integer(x.spiritPromotionWeek,1,x.week)) && ['AVAILABLE','OBSERVED','PREPARED','EXAMINED','RESOLVED'].includes(x.spiritCaseStatus) &&
    typeof x.randomSeed === 'string' && x.randomSeed.length > 0 && x.randomSeed.length <= 256 && integer(x.randomCursor);
}
/** Same common formula, expressed using the source snapshot so historical validation never reads new stats. */
function sourcePenalty(current: number, maximum: number): number {
  const fraction = Math.max(0, Math.min(1, current / maximum));
  return fraction > .75 ? 0 : fraction > .5 ? .05 : fraction > .25 ? .1 : .2;
}
function sourceBase(core: number, health: number, mind: number, spirituality: number): number {
  const penalty = Math.min(.4, sourcePenalty(health,100) + sourcePenalty(mind,100) + sourcePenalty(spirituality,120));
  return (1250 + Math.min(core,1250 * .2)) * (1 - penalty);
}
function sourceWeights(risk: number): { light: number; heavy: number; death: number } {
  const death = Math.min(100,5 + Math.min(risk,10) * 10), shifted = death - 5;
  return { light: Math.max(0,65 - shifted), heavy: Math.max(0,30 - Math.max(0,shifted - 65)), death };
}
interface ReplayedRound {
  outcome: ConcealmentServantRoundOutcome; playerCount: number; enemyCount: number; playerCountRoll: number; enemyCountRoll: number;
  first: 'PLAYER' | 'ENEMY'; retreat: 'NONE' | 'SUCCESS' | 'FAILURE'; winner: 'PLAYER' | 'ENEMY';
  playerAdvantage: number; enemyAdvantage: number; winChance: number; consequenceWeights: { light: number; heavy: number; death: number } | null; consequenceRoll?: number;
}
function replayOutcome(o: ConcealmentServantRoundOutcome): ReplayedRound | null {
  const x = o?.source;
  if (!x || !validSource(x) || !['ATTACK','DEFEND','CONTROL','PREPARE','RETREAT'].includes(o.stance) || !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) || o.playerActions.length > 6 || o.enemyActions.length > 6) return null;
  const rng = new DeterministicActionRandomStream(x.randomSeed,x.randomCursor), runtime = makeRuntime(x);
  const playerCountRoll = rng.nextInt(1,100), enemyCountRoll = rng.nextInt(1,100), playerCount = concealmentServantActionCount(playerCountRoll), enemyCount = concealmentServantEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER','ENEMY'] as const : ['ENEMY','PLAYER'] as const;
  const remaining = { PLAYER: playerCount, ENEMY: enemyCount }, players: ConcealmentServantPlayerAction[] = [], enemies: ConcealmentServantEnemyAction[] = [];
  let retreat: ReplayedRound['retreat'] = 'NONE';
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) {
    for (const actor of order) {
      if (remaining[actor] === 0) continue;
      if (actor === 'PLAYER' && o.stance === 'RETREAT') {
        remaining.PLAYER = 0; retreat = rng.nextInt(1,100) <= 50 ? 'SUCCESS' : 'FAILURE';
        if (retreat === 'SUCCESS') { remaining.ENEMY = 0; break; } continue;
      }
      remaining[actor]--;
      if (actor === 'PLAYER') players.push(playerAction(x,runtime,drawPlayer(rng,o.stance),physicalAt(x.playerHealth),players.length + enemies.length,rng));
      else enemies.push(enemyAction(runtime,drawConcealmentServantEnemyAbility(rng),physicalAt(x.enemyHealth),players.length + enemies.length,rng));
    }
  }
  if (!same(players,o.playerActions) || !same(enemies,o.enemyActions)) return null;
  const sum = (actions: { selfGain: number; enemyReduction: number }[], key: 'selfGain' | 'enemyReduction') => actions.reduce((n,a) => n + a[key],0);
  const playerAdvantage = Math.max(125,sourceBase(x.physique*.35+x.perception*.25+x.will*.25+x.knowledge*.15,x.playerHealth,x.playerMind,x.playerSpirituality) + sum(players,'selfGain') - sum(enemies,'enemyReduction'));
  const enemyAdvantage = Math.max(125,sourceBase(24,x.enemyHealth,x.enemyMind,x.enemySpirituality) + sum(enemies,'selfGain') - sum(players,'enemyReduction'));
  const winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100;
  const winner = retreat === 'SUCCESS' ? 'ENEMY' : rng.nextInt(1,1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  let playerHealth = x.playerHealth, enemyHealth = x.enemyHealth, playerRisk = x.playerRisk, enemyRisk = x.enemyRisk;
  let enemyStatus: ConcealmentServantRoundOutcome['enemyStatus'] = 'RESISTING', continuing = retreat !== 'SUCCESS';
  const playerInjuries = structuredClone(x.playerInjuries), enemyInjuries = structuredClone(x.enemyInjuries);
  let consequenceWeights: ReplayedRound['consequenceWeights'] = null, consequenceRoll: number | undefined;
  if (retreat !== 'SUCCESS') {
    const loser = winner === 'PLAYER' ? 'ENEMY' : 'PLAYER', injuries = loser === 'PLAYER' ? playerInjuries : enemyInjuries;
    let risk = loser === 'PLAYER' ? playerRisk : enemyRisk;
    if (injuries.length) risk++;
    if (loser === 'PLAYER') playerRisk = risk; else enemyRisk = risk;
    const threatened = loser === 'PLAYER' ? enemies.some(a => a.threatens) : players.some(a => a.threatens);
    if (threatened) {
      consequenceWeights = sourceWeights(risk); consequenceRoll = rng.nextInt(1,100);
      const severity = consequenceRoll <= consequenceWeights.light ? 'LIGHT' : consequenceRoll <= consequenceWeights.light + consequenceWeights.heavy ? 'HEAVY' : 'DEATH';
      if (severity === 'DEATH') { if (loser === 'PLAYER') playerHealth = 0; else { enemyHealth = 0; enemyStatus = 'DEAD'; } continuing = false; }
      else {
        injuries.push({ id: `${x.runId}:combat:${x.round}:${loser}:${x.revision + 1}:${injuries.length}`, severity, acquiredRevision: x.revision + 1, treatedRevision: null });
        const damage = severity === 'LIGHT' ? 10 : 30;
        if (loser === 'PLAYER') playerHealth = Math.max(0,playerHealth - damage); else enemyHealth = Math.max(0,enemyHealth - damage);
        if (playerHealth === 0 || enemyHealth === 0) { if (enemyHealth === 0) enemyStatus = 'DEAD'; continuing = false; }
        else if (loser === 'ENEMY' && severity === 'HEAVY') { enemyStatus = 'SURRENDERED'; continuing = false; }
      }
    }
  }
  const recalled = runtime.companion.status === 'DEPLOYED' && ownsOriginalSpirit(x,runtime.companion);
  if (recalled) { runtime.companion.status = 'SEALED'; runtime.companion.recalls++; }
  expire(runtime,60);
  const leave = !continuing && playerHealth > 0, elapsedSeconds = leave ? 62 : 60;
  const expected: ConcealmentServantRoundOutcome = { targetId: CONCEALMENT_SERVANT_TARGET_ID, round: x.round, source: structuredClone(x), stance: o.stance, continuing,
    enemyHealth, enemyMind: x.enemyMind, enemySpirituality: runtime.enemyS, enemyStatus, playerSpiritualityBefore: x.playerSpirituality,
    playerSpiritualityAfter: runtime.playerS, playerHealthAfter: playerHealth, playerMindAfter: x.playerMind, enemySpiritualityBefore: x.enemySpirituality,
    playerInjuriesAfter: playerInjuries, enemyInjuriesAfter: enemyInjuries, playerRiskAfter: playerRisk, enemyRiskAfter: enemyRisk,
    powerUses: runtime.powers, abilityUses: runtime.uses, companionAfter: runtime.companion, recalled, windowsBeforeClose: runtime.windows,
    windowsAfter: emptyWindows(), elapsedSeconds, playerLocationAfter: leave ? 'OUTSIDE' : 'DOORSTEP', playerTravelMetresAfter: x.playerTravelMetres + (leave ? 2 : 0),
    clockSecondsAfter: x.clockSeconds + elapsedSeconds, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies };
  if (!same(o,expected)) return null;
  return { outcome: expected,playerCount,enemyCount,playerCountRoll,enemyCountRoll,first,retreat,winner,playerAdvantage,enemyAdvantage,winChance,consequenceWeights,
    ...(consequenceRoll === undefined ? {} : { consequenceRoll }) };
}
/** Exact deterministic replay validates action order, every RNG draw, expiry, costs, actual effects, injuries and the terminal result. */
export function validateConcealmentServantRoundOutcome(value: unknown): value is ConcealmentServantRoundOutcome {
  try { return replayOutcome(value as ConcealmentServantRoundOutcome) !== null; } catch { return false; }
}
export function validateConcealmentServantCombatRound(round: SliceCombatRound): boolean {
  try {
    const o = round.concealmentServantOutcome, replay = o ? replayOutcome(o) : null;
    if (!o || !replay || round.round !== o.round || round.stance !== o.stance || typeof round.consequence !== 'string') return false;
    for (const key of ['playerCount','enemyCount','playerCountRoll','enemyCountRoll','first','retreat','winner','playerAdvantage','enemyAdvantage','winChance','consequenceWeights','consequenceRoll'] as const)
      if (!same(round[key],replay[key])) return false;
    const moves = [...o.playerActions.map(a => ({ ...a,actor: 'PLAYER' as const })),...o.enemyActions.map(a => ({ ...a,actor: 'ENEMY' as const }))].sort((a,b) => a.order-b.order)
      .map(a => ({ actor: a.actor,label: a.label,selfGain: a.selfGain,enemyReduction: a.enemyReduction }));
    return same(round.moves,moves);
  } catch { return false; }
}
