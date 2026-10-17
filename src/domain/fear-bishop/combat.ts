import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import type { SpiritWarlockCompanion } from '../spirit-warlock/types.js';
import { hasNightwatcherOriginalSpirit } from '../nightwatcher/combat.js';
import { FEAR_BISHOP_TARGET_ID, FEAR_BISHOP_POWERS, FEAR_BISHOP_POWER_IDS, hasFearBishopDisputeOpponent,
  type FearBishopEnemyIntent, type FearBishopPowerId } from './encounter.js';

/** G3 retains the actual Darkness4 core, 1250/floor125, S120 and CONTINUE-only12.
 * No new spirit actor or pool: only the original SW5-LEAF-1 can deploy, assist and return. */
export const FEAR_BISHOP_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const FEAR_BISHOP_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const fearBishopActionCount = pyromaniacActionCount;
export const fearBishopEnemyActionCount = pyromaniacActionCount;
export type FearBishopMoveId = 'STRIKE' | 'darkness.s3.dark-dissolution' | 'darkness.s3.sleep-fear'
  | 'darkness.s4.limited-misfortune' | 'darkness.s5.spirit-assistance' | 'ACCIDENT' | 'EVADE' | 'OBSERVE';
const DISSOLUTION = 'darkness.s3.dark-dissolution', SLEEP_FEAR = 'darkness.s3.sleep-fear';
const MISFORTUNE = 'darkness.s4.limited-misfortune', ASSISTANCE = 'darkness.s5.spirit-assistance';
const ABILITIES: readonly { id: FearBishopMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'STRIKE', label: '本人普通打击（H；原身体12/自持原棍16×身体G）', weight: 20, stance: 'ATTACK' },
  { id: DISSOLUTION, label: '有限黑暗毁灭（J；6S/知识18，65×新掌握G）', weight: 25, stance: 'ATTACK' },
  { id: SLEEP_FEAR, label: '安眠与恐惧短时压力（B；5S/意志18，减势32G，可被专注抵抗）', weight: 20, stance: 'CONTROL' },
  { id: MISFORTUNE, label: '继承有限厄运（K；4S/意志16，减势22G）', weight: 15, stance: 'CONTROL' },
  { id: ASSISTANCE, label: '同一原卷叶（R；SEALED先2S派出0贡献，后槽2S协助减22G）', weight: 15, stance: 'DEFEND' },
  { id: 'ACCIDENT', label: '判断失衡（A；固定−22.5G）', weight: 5, stance: null },
];
export const FEAR_BISHOP_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'DARK_BOLT', label: '有限暗矢：5S/75G', weight: 35 }, { id: 'WARD', label: '有限护术：4S/减45G', weight: 25 },
  { id: 'BODY_STRIKE', label: '同一原棍：20×身体G', weight: 20 }, { id: 'FOCUS', label: '有限专注：4S/抵抗本轮下一次睡恐压力', weight: 15 },
  { id: 'ACCIDENT', label: '判断偏差：−22.5G', weight: 5 },
];
export const isFearBishop = (s: SliceState): boolean => s.progression.pathwayId === 'darkness' && s.progression.sequence === 3;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function fearBishopAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 }));
}
export function drawFearBishopAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): FearBishopMoveId {
  const weights = tickets(stance); let n = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return a.id; } throw new Error('恐惧主教能力盘无效。');
}
export function drawFearBishopEnemyAbility(random: ActionRandomStream): FearBishopEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of FEAR_BISHOP_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as FearBishopEnemyIntent; }
  throw new Error('原哈兰能力盘无效。');
}
export interface FearBishopCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'FEAR_BISHOP_DISPUTE'; targetId: typeof FEAR_BISHOP_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetAge: 48; targetSequence: 3; actualOriginalBody: true; independentMind: true;
  enemyWeapon: 'FB3-HARLAN-CLUB'; weaponLocation: 'HAND'; distanceMetres: 2; space: 'FB3-OPEN-COURT'; ordinaryExit: true; pursuit: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  clubHeld: boolean; knowledge: number; will: number; dissolutionMastery: number; powerUses: Record<FearBishopPowerId, number>;
  companion: SpiritWarlockCompanion; spiritPromotionWeek: number | null; spiritCaseStatus: string;
}
const bounded = (n: number, max: number) => Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
function validCompanion(p: SpiritWarlockCompanion, week: number): boolean {
  return !!p && p.source === 'SW5-LEAF-1' && ['UNMET', 'AVAILABLE', 'SEALED', 'DEPLOYED', 'RELEASED'].includes(p.status) &&
    [p.acquiredWeek, p.invitedWeek].every(w => w === null || integer(w, 1, week)) && integer(p.releases) && integer(p.deployments) && integer(p.recalls) &&
    p.deployments - p.recalls === (p.status === 'DEPLOYED' ? 1 : 0);
}
function ownsOriginalSpirit(x: FearBishopCombatSource, p: SpiritWarlockCompanion): boolean {
  return validCompanion(p, x.week) && integer(x.spiritPromotionWeek, 1, x.week) && integer(p.acquiredWeek, x.spiritPromotionWeek, x.week) &&
    integer(p.invitedWeek, p.acquiredWeek, x.week) && x.spiritCaseStatus !== 'AVAILABLE' && (p.status === 'SEALED' || p.status === 'DEPLOYED');
}
export function currentFearBishopCombatSource(s: SliceState): FearBishopCombatSource | null {
  if (!hasFearBishopDisputeOpponent(s) || !validCompanion(s.spiritWarlock.companion, s.week)) return null;
  const e = s.fearBishop.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'FEAR_BISHOP_DISPUTE', targetId: FEAR_BISHOP_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetAge: 48, targetSequence: 3, actualOriginalBody: true, independentMind: true,
    enemyWeapon: 'FB3-HARLAN-CLUB', weaponLocation: 'HAND', distanceMetres: 2, space: 'FB3-OPEN-COURT', ordinaryExit: true, pursuit: false,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality,
    clubHeld: s.town.clubLocation === 'HAND', knowledge: s.character.coreStats.knowledge, will: s.character.coreStats.will,
    dissolutionMastery: bounded(s.progression.mastery[DISSOLUTION] ?? 0, 500), powerUses: { ...e.powerUses },
    companion: structuredClone(s.spiritWarlock.companion), spiritPromotionWeek: s.spiritWarlock.promotionWeek,
    spiritCaseStatus: s.spiritWarlock.cases['listening-leaves']!.status };
}
export interface FearBishopCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean }
interface ActionEvidence extends FearBishopCombatEffect { order: number; paidCost: number; physicalFactor: number; rolls: number[] }
export interface FearBishopPlayerAction extends ActionEvidence {
  id: FearBishopMoveId; spiritOperation: 'NONE' | 'DEPLOY' | 'ASSIST'; resisted: boolean;
}
export interface FearBishopEnemyAction extends ActionEvidence { planned: FearBishopEnemyIntent; actual: FearBishopEnemyIntent; focusGranted: boolean }
export interface FearBishopRoundContext {
  source: FearBishopCombatSource; stance: SliceStance; finished: boolean; liveState: string; focusReady: boolean;
  playerActions: FearBishopPlayerAction[]; enemyActions: FearBishopEnemyAction[]; label: string; outcome: FearBishopRoundOutcome | null;
}
const none = (label: string): FearBishopCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
function liveState(s: SliceState): string { const e = s.fearBishop.encounter; return stableStringify({ spirituality: s.spirituality,
  enemySpirituality: e.enemySpirituality, powerUses: e.powerUses, companion: s.spiritWarlock.companion }); }
const dynamicSource = new Set(['playerSpirituality', 'enemySpirituality', 'powerUses', 'companion']);
function validRound(s: SliceState, r: FearBishopRoundContext, supplied: FearBishopCombatSource | null): boolean {
  const actual = currentFearBishopCombatSource(s);
  return !r.finished && actual !== null && supplied !== null && same(supplied, r.source) && r.liveState === liveState(s) &&
    Object.entries(r.source).every(([key, value]) => dynamicSource.has(key) || same(actual[key as keyof FearBishopCombatSource], value));
}
export function beginFearBishopCombatRound(s: SliceState, stance: SliceStance, _random: ActionRandomStream): FearBishopRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('恐惧主教姿态无效。');
  const source = currentFearBishopCombatSource(s);
  if (!source || source.companion.status === 'DEPLOYED') throw new Error('缺少原哈兰连续来源，或原卷叶上一轮尚未真实召回。');
  return { source, stance, finished: false, liveState: liveState(s), focusReady: false, playerActions: [], enemyActions: [], outcome: null,
    label: `同一48岁原哈兰在净空庭院2米外，独立S${source.enemySpirituality}/120；原卷叶仍${source.companion.status}，只使用双方共同次数和伤势盘。` };
}
export const createFearBishopCombatRound = beginFearBishopCombatRound;
function actionBase(order: number, physical: number): ActionEvidence { return { ...none(''), order, paidCost: 0, physicalFactor: bounded(physical, 1), rolls: [] }; }
function check(s: SliceState, a: ActionEvidence, ability: 'knowledge' | 'will', difficulty: number, random: ActionRandomStream): boolean {
  const chance = computeCheckChance({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [] }), roll = random.nextInt(1, 100);
  a.rolls.push(roll); return roll <= chance;
}
export function resolveFearBishopCombatAbility(s: SliceState, id: FearBishopMoveId, physical: number, random: ActionRandomStream,
  r: FearBishopRoundContext, source: FearBishopCombatSource | null = r.source): FearBishopCombatEffect {
  if (!validRound(s, r, source) || r.playerActions.length >= 6 || ![...ABILITIES.map(a => a.id), 'EVADE', 'OBSERVE'].includes(id))
    return none('缺少当前原人、原卷叶或原资源来源，或已用完本轮最多六槽；0贡献0消耗，不重抽。');
  const spirit = s.spiritWarlock.companion;
  const a: FearBishopPlayerAction = { ...actionBase(r.playerActions.length + r.enemyActions.length, physical), id, spiritOperation: 'NONE', resisted: false };
  const pay = (cost: number) => { s.spirituality -= cost; a.paidCost = cost; };
  const strike = (why = '') => { a.selfGain = (r.source.clubHeld ? 16 : 12) * a.physicalFactor; a.threatens = a.selfGain > 0;
    a.label = `${why}本人以${r.source.clubHeld ? '实际在手的原棍16' : '自己的原身体12'}×身体普通打击G，0灵性，只占原槽。`; };
  const evade = (why = '') => { a.enemyReduction = 10; a.label = `${why}本人普通避让减势10G，0灵性，不重抽、不保证免伤。`; };
  if (id === 'STRIKE') strike();
  else if (id === 'EVADE') evade();
  else if (id === 'OBSERVE') a.label = '本人普通观察原人、原身体和开放出口，0贡献0消耗，不附赠能力。';
  else if (id === 'ACCIDENT') { a.selfGain = -22.5; a.label = '判断失衡固定−22.5G，不重抽或增加原灵行动。'; }
  else if (id === ASSISTANCE) {
    if (s.spirituality < 2 || !hasNightwatcherOriginalSpirit(s) || !ownsOriginalSpirit(r.source, spirit))
      evade('没有实际已取得且当前SEALED/DEPLOYED的同一原卷叶，或不足2S；');
    else if (spirit.status === 'SEALED') { pay(2); spirit.status = 'DEPLOYED'; spirit.deployments++; a.spiritOperation = 'DEPLOY';
      a.label = '同一SW5-LEAF-1实际从原牙齿派出，实付2S、原派出计数+1，本槽0贡献。后续抽中同一玩家原灵槽，须再付2S才能协助；没有额外行动者。'; }
    else { pay(2); a.spiritOperation = 'ASSIST'; a.enemyReduction = 22;
      a.label = '已实际DEPLOYED的同一SW5-LEAF-1在后续原槽协助，另实付2S减势22G；无新灵、免费强控、飞行或保证免伤，原释放与再邀请史不改。'; }
  } else if (id === DISSOLUTION) {
    if (s.spirituality < 6) strike('不足6S，黑暗毁灭未施放；');
    else { pay(6); if (check(s, a, 'knowledge', 18, random)) { a.selfGain = 65 * (.65 + .35 * r.source.dissolutionMastery / 500); a.threatens = true;
        a.label = '有限黑暗毁灭实付6S/知识18成功，对2米可见原敌形成65×新掌握G优势；不直接扣H、抹除原人或单槽必杀，真实伤势仍由共同盘决定。'; }
      else a.label = '有限黑暗毁灭知识18失败，实际6S不退，0贡献，不附送普通打击或重抽。'; }
  } else {
    const sleep = id === SLEEP_FEAR, cost = sleep ? 5 : 4;
    if (s.spirituality < cost) evade(`不足${cost}S，${sleep ? '睡恐压力' : '继承有限厄运'}未施放；`);
    else { pay(cost); if (!check(s, a, 'will', sleep ? 18 : 16, random))
        a.label = `${sleep ? '睡恐压力意志18' : '继承有限厄运意志16'}失败，实际${cost}S不退，0贡献0减势，不附送普通避让或重抽。`;
      else if (sleep && r.focusReady) { r.focusReady = false; a.resisted = true;
        a.label = '安眠与恐惧短时压力意志18成功且实付5S，但同一原哈兰先前实际付费的本轮专注抵抗了这一次压力；本槽减势0，专注消耗，不永久削减其意志或删行动。'; }
      else { a.enemyReduction = sleep ? 32 : 22;
        a.label = sleep ? '安眠与恐惧结合的有限短时压力，实付5S/意志18成功，减势32G；本轮后结束，不直接扣H/M、永眠、强制真话或治疗。'
          : '继承有限厄运实付4S/意志16成功，减势22G；仅本槽原动作出现有限差错，不积运、不造新事故或保证死亡。'; }
    }
  }
  r.playerActions.push(a); r.liveState = liveState(s);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export function resolveFearBishopEnemyAbility(s: SliceState, planned: FearBishopEnemyIntent, physical: number, _random: ActionRandomStream,
  r: FearBishopRoundContext, source: FearBishopCombatSource | null = r.source): FearBishopCombatEffect {
  if (!validRound(s, r, source) || r.enemyActions.length >= 6 || ![...FEAR_BISHOP_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned))
    return none('缺少当前原哈兰及原棍来源，或已用完本轮最多六槽；0贡献0消耗，不重抽。');
  const e = s.fearBishop.encounter, power = FEAR_BISHOP_POWERS.find(x => x.id === planned);
  const a: FearBishopEnemyAction = { ...actionBase(r.playerActions.length + r.enemyActions.length, physical), planned,
    actual: power && e.enemySpirituality < power.cost ? 'BODY_STRIKE' : planned, focusGranted: false };
  if (power && a.actual === planned) { e.enemySpirituality -= power.cost; e.powerUses[power.id]++; a.paidCost = power.cost; a.selfGain = power.selfGain; a.enemyReduction = power.enemyReduction; }
  if (a.actual === 'ACCIDENT') { a.selfGain = -22.5; a.label = '原哈兰判断失衡，本槽固定−22.5G，不另抽。'; }
  else if (a.actual === 'BODY_STRIKE') { a.selfGain = 20 * a.physicalFactor; a.threatens = a.selfGain > 0;
    a.label = `${power ? '原法术灵性不足，同一槽回退；' : ''}原哈兰持自己的唯一FB3-HARLAN-CLUB普通打击20×身体G，0S，没有新武器或额外行动。`; }
  else if (a.actual === 'FOCUS') { r.focusReady = true; a.focusGranted = true;
    a.label = '原哈兰实付4S进行本轮有限专注，抵抗下一次实际形成的睡恐压力一次，0直接优势。不叠加储备、不跨轮；没有压力也不退灵性。'; }
  else { a.threatens = a.actual === 'DARK_BOLT'; a.label = `原哈兰${power!.label}实付${a.paidCost}S，${a.threatens ? '有限优势75' : '有限减势45'}G，余${e.enemySpirituality}/120；原人不补资源，伤势由共同盘决定。`; }
  r.enemyActions.push(a); r.liveState = liveState(s);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export interface FearBishopRoundOutcome {
  targetId: typeof FEAR_BISHOP_TARGET_ID; round: number; source: FearBishopCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number;
  powerUses: Record<FearBishopPowerId, number>; companionAfter: SpiritWarlockCompanion; recalled: boolean; focusReadyAfter: false;
  elapsedSeconds: 60; playerActions: FearBishopPlayerAction[]; enemyActions: FearBishopEnemyAction[];
}
export function finishFearBishopCombatRound(s: SliceState, r: FearBishopRoundContext, continuing = true): FearBishopRoundOutcome {
  const e = s.fearBishop.encounter, c = s.combat, spirit = s.spiritWarlock.companion;
  if (r.finished || !c || c.encounterId !== 'FEAR_BISHOP_DISPUTE' || c.round !== r.source.round || r.liveState !== liveState(s))
    throw new Error('原恐惧主教回合已结束，或同一原灵/原资源已被改写。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  if (e.enemyStatus !== 'RESISTING') e.weaponLocation = 'YARD';
  const recalled = spirit.status === 'DEPLOYED' && ownsOriginalSpirit(r.source, spirit) && hasNightwatcherOriginalSpirit(s);
  if (recalled) { spirit.status = 'SEALED'; spirit.recalls++; }
  s.fearBishop.life.clockSeconds += 60; r.focusReady = false; r.finished = true;
  r.outcome = { targetId: FEAR_BISHOP_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus,
    playerSpiritualityBefore: r.source.playerSpirituality, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind,
    enemySpiritualityBefore: r.source.enemySpirituality, powerUses: { ...e.powerUses }, companionAfter: structuredClone(spirit), recalled, focusReadyAfter: false,
    elapsedSeconds: 60, playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
  return structuredClone(r.outcome);
}
export function fearBishopRoundOutcome(r: FearBishopRoundContext): FearBishopRoundOutcome {
  if (!r.outcome) throw new Error('先实际结束当前原恐惧主教回合。'); return structuredClone(r.outcome);
}
/** Only already-resolved display facts cross the public combat boundary. */
function projectFearBishopCompanion(companion: SpiritWarlockCompanion) {
  return {
    source: companion.source, status: companion.status, acquiredWeek: companion.acquiredWeek, invitedWeek: companion.invitedWeek,
    releases: companion.releases, deployments: companion.deployments, recalls: companion.recalls,
  };
}
function projectFearBishopPowerUses(powerUses: Record<FearBishopPowerId, number>) {
  return { DARK_BOLT: powerUses.DARK_BOLT, WARD: powerUses.WARD, FOCUS: powerUses.FOCUS };
}
interface PublicFearBishopActionEvidence {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean;
  order: number; paidCost: number; physicalFactor: number; rolls: number[];
}
export interface PublicFearBishopPlayerAction extends PublicFearBishopActionEvidence {
  id: FearBishopMoveId; spiritOperation: 'NONE' | 'DEPLOY' | 'ASSIST'; resisted: boolean;
}
export interface PublicFearBishopEnemyAction extends PublicFearBishopActionEvidence {
  planned: FearBishopEnemyIntent; actual: FearBishopEnemyIntent; focusGranted: boolean;
}
export function projectFearBishopPlayerAction(action: FearBishopPlayerAction): PublicFearBishopPlayerAction {
  return {
    label: action.label, selfGain: action.selfGain, enemyReduction: action.enemyReduction,
    threatens: action.threatens, mentalPressure: action.mentalPressure, order: action.order,
    paidCost: action.paidCost, physicalFactor: action.physicalFactor, rolls: action.rolls.map(roll => roll),
    id: action.id, spiritOperation: action.spiritOperation, resisted: action.resisted,
  };
}
export function projectFearBishopEnemyAction(action: FearBishopEnemyAction): PublicFearBishopEnemyAction {
  return {
    label: action.label, selfGain: action.selfGain, enemyReduction: action.enemyReduction,
    threatens: action.threatens, mentalPressure: action.mentalPressure, order: action.order,
    paidCost: action.paidCost, physicalFactor: action.physicalFactor, rolls: action.rolls.map(roll => roll),
    planned: action.planned, actual: action.actual, focusGranted: action.focusGranted,
  };
}
export interface PublicFearBishopRoundOutcome {
  targetId: typeof FEAR_BISHOP_TARGET_ID; round: number; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number;
  powerUses: ReturnType<typeof projectFearBishopPowerUses>; companionAfter: ReturnType<typeof projectFearBishopCompanion>;
  recalled: boolean; focusReadyAfter: false; elapsedSeconds: 60;
  playerActions: PublicFearBishopPlayerAction[]; enemyActions: PublicFearBishopEnemyAction[];
}
export function projectFearBishopRoundOutcome(outcome: FearBishopRoundOutcome): PublicFearBishopRoundOutcome {
  return {
    targetId: outcome.targetId, round: outcome.round, stance: outcome.stance, continuing: outcome.continuing,
    enemyHealth: outcome.enemyHealth, enemyMind: outcome.enemyMind, enemySpirituality: outcome.enemySpirituality, enemyStatus: outcome.enemyStatus,
    playerSpiritualityBefore: outcome.playerSpiritualityBefore, playerSpiritualityAfter: outcome.playerSpiritualityAfter,
    playerHealthAfter: outcome.playerHealthAfter, playerMindAfter: outcome.playerMindAfter, enemySpiritualityBefore: outcome.enemySpiritualityBefore,
    powerUses: projectFearBishopPowerUses(outcome.powerUses), companionAfter: projectFearBishopCompanion(outcome.companionAfter),
    recalled: outcome.recalled, focusReadyAfter: outcome.focusReadyAfter, elapsedSeconds: outcome.elapsedSeconds,
    playerActions: outcome.playerActions.map(projectFearBishopPlayerAction), enemyActions: outcome.enemyActions.map(projectFearBishopEnemyAction),
  };
}
export interface PublicFearBishopCombatProjection {
  enemyName: string; targetId: typeof FEAR_BISHOP_TARGET_ID | null; enemyMind: number | null; enemySpirituality: number | null;
  powerUses: ReturnType<typeof projectFearBishopPowerUses> | null; companion: ReturnType<typeof projectFearBishopCompanion> | null;
  originalExit: boolean; pursuit: boolean; distanceMetres: number; summary: string;
}
export function projectFearBishopCombat(s: SliceState): PublicFearBishopCombatProjection {
  const e = s.fearBishop.encounter, visible = isFearBishop(s);
  return { enemyName: visible ? '哈兰（48岁，原创有限G3非凡者）' : '', targetId: visible ? e.targetId : null,
    enemyMind: visible ? e.enemyMind : null, enemySpirituality: visible ? e.enemySpirituality : null,
    powerUses: visible ? projectFearBishopPowerUses(e.powerUses) : null, companion: visible ? projectFearBishopCompanion(s.spiritWarlock.companion) : null,
    originalExit: true, pursuit: false, distanceMetres: 2,
    summary: visible ? '双方1–6次权重10/15/25/25/15/10；继承实际黑暗4核心35/25/25/15、1250/底125、S120，仅继续轮恢复12G。有限黑暗毁灭6S/知识18形成65×新掌握优势，睡恐5S/意志18减32可被敌专注抵抗。原厄运4S减22，同一旧卷叶先2S派出0贡献，后槽2S协助减22，轮末实际召回。共同伤势盘决定原身体后果，旧人旧物及释放史保留。' : '' };
}
/** Replay only finite ability costs, original-spirit operations and one-round resistance. */
export function validateFearBishopRoundOutcome(value: unknown): value is FearBishopRoundOutcome {
  try {
    const o = value as FearBishopRoundOutcome, x = o?.source;
    if (!o || !x || typeof x.runId !== 'string' || !integer(x.revision) || !integer(x.week, 1) || !integer(x.round, 1) || !integer(x.startHistoryIndex) || x.attemptWeek !== x.week ||
        x.encounterId !== 'FEAR_BISHOP_DISPUTE' || x.targetId !== FEAR_BISHOP_TARGET_ID || x.targetAge !== 48 || x.targetSequence !== 3 || x.actualOriginalBody !== true || x.independentMind !== true ||
        x.enemyWeapon !== 'FB3-HARLAN-CLUB' || x.weaponLocation !== 'HAND' || x.distanceMetres !== 2 || x.space !== 'FB3-OPEN-COURT' || x.ordinaryExit !== true || x.pursuit !== false ||
        ![x.playerHealth, x.playerMind, x.enemyHealth, x.enemyMind].every(n => integer(n, 1, 100)) || !integer(x.knowledge, 0, 500) || !integer(x.will, 0, 500) || !integer(x.dissolutionMastery, 0, 500) ||
        typeof x.clubHeld !== 'boolean' || !validCompanion(x.companion, x.week) || x.companion.status === 'DEPLOYED' || !validCompanion(o.companionAfter, x.week) ||
        (x.spiritPromotionWeek !== null && !integer(x.spiritPromotionWeek, 1, x.week)) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(x.spiritCaseStatus) ||
        o.targetId !== FEAR_BISHOP_TARGET_ID || o.round !== x.round || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) ||
        typeof o.continuing !== 'boolean' || typeof o.recalled !== 'boolean' || o.elapsedSeconds !== 60 || o.focusReadyAfter !== false ||
        ![o.enemyHealth, o.playerHealthAfter].every(n => integer(n, 0, 100)) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(o.enemyStatus) || (o.enemyStatus === 'DEAD') !== (o.enemyHealth === 0) ||
        o.enemyMind !== x.enemyMind || o.playerMindAfter !== x.playerMind || ![x.playerSpirituality, x.enemySpirituality, o.playerSpiritualityAfter, o.enemySpirituality].every(n => integer(n, 0, 120)) ||
        o.playerSpiritualityBefore !== x.playerSpirituality || o.enemySpiritualityBefore !== x.enemySpirituality || !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) ||
        o.playerActions.length > 6 || o.enemyActions.length > 6 || !x.powerUses || Object.keys(x.powerUses).length !== 3 ||
        !FEAR_BISHOP_POWER_IDS.every(id => integer(x.powerUses[id])) || x.enemySpirituality !== 120 - FEAR_BISHOP_POWERS.reduce((n, p) => n + x.powerUses[p.id] * p.cost, 0)) return false;
    const spirit = structuredClone(x.companion), powers = { ...x.powerUses }; let playerS = x.playerSpirituality, enemyS = x.enemySpirituality, focus = false;
    const actions = [...o.playerActions.map(a => ({ actor: 'PLAYER' as const, a })), ...o.enemyActions.map(a => ({ actor: 'ENEMY' as const, a }))].sort((a, b) => a.a.order - b.a.order);
    for (const [i, entry] of actions.entries()) {
      const a = entry.a;
      if (a.order !== i || !integer(a.paidCost) || !Number.isFinite(a.selfGain) || !Number.isFinite(a.enemyReduction) || a.enemyReduction < 0 ||
          !Number.isFinite(a.physicalFactor) || a.physicalFactor < 0 || a.physicalFactor > 1 || typeof a.label !== 'string' || typeof a.threatens !== 'boolean' || a.mentalPressure !== false ||
          !Array.isArray(a.rolls) || a.rolls.some(n => !integer(n, 1, 100))) return false;
      if (entry.actor === 'PLAYER') {
        const b = entry.a;
        if (![...ABILITIES.map(v => v.id), 'EVADE', 'OBSERVE'].includes(b.id) || !['NONE', 'DEPLOY', 'ASSIST'].includes(b.spiritOperation) || typeof b.resisted !== 'boolean') return false;
        const required = b.id === DISSOLUTION ? 6 : b.id === SLEEP_FEAR ? 5 : b.id === MISFORTUNE ? 4 : b.id === ASSISTANCE ? 2 : 0;
        const eligible = b.id !== ASSISTANCE || ownsOriginalSpirit(x, spirit), paid = required > 0 && eligible && playerS >= required ? required : 0;
        if (b.paidCost !== paid) return false;
        const needsCheck = paid > 0 && b.id !== ASSISTANCE;
        if (b.rolls.length !== (needsCheck ? 1 : 0)) return false;
        const success = needsCheck && b.rolls[0]! <= computeCheckChance({ ability: b.id === DISSOLUTION ? 'knowledge' : 'will',
          baseAbility: b.id === DISSOLUTION ? x.knowledge : x.will, difficulty: b.id === MISFORTUNE ? 16 : 18, modifiers: [] });
        playerS -= paid; let gain = 0, reduction = 0, operation: FearBishopPlayerAction['spiritOperation'] = 'NONE';
        const resisted = b.id === SLEEP_FEAR && success && focus;
        if (resisted) focus = false;
        if (b.id === 'ACCIDENT') gain = -22.5;
        else if (b.id === 'STRIKE' || b.id === DISSOLUTION && !paid) gain = (x.clubHeld ? 16 : 12) * b.physicalFactor;
        else if (b.id === 'EVADE' || [SLEEP_FEAR, MISFORTUNE, ASSISTANCE].includes(b.id) && !paid) reduction = 10;
        else if (b.id === DISSOLUTION && success) gain = 65 * (.65 + .35 * x.dissolutionMastery / 500);
        else if (b.id === SLEEP_FEAR && success && !resisted) reduction = 32;
        else if (b.id === MISFORTUNE && success) reduction = 22;
        else if (b.id === ASSISTANCE && paid) {
          if (spirit.status === 'SEALED') { operation = 'DEPLOY'; spirit.status = 'DEPLOYED'; spirit.deployments++; }
          else { operation = 'ASSIST'; reduction = 22; }
        }
        if (b.selfGain !== gain || b.enemyReduction !== reduction || b.threatens !== (gain > 0) || b.resisted !== resisted || b.spiritOperation !== operation) return false;
      } else {
        const b = entry.a, power = FEAR_BISHOP_POWERS.find(v => v.id === b.planned);
        if (![...FEAR_BISHOP_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(b.planned) || b.rolls.length !== 0) return false;
        const actual = power && enemyS < power.cost ? 'BODY_STRIKE' : b.planned, cost = power && actual === b.planned ? power.cost : 0;
        if (b.actual !== actual || b.paidCost !== cost || b.focusGranted !== (actual === 'FOCUS')) return false;
        enemyS -= cost; if (power && cost) powers[power.id]++;
        if (actual === 'FOCUS') focus = true;
        const gain = actual === 'ACCIDENT' ? -22.5 : actual === 'BODY_STRIKE' ? 20 * b.physicalFactor : actual === 'DARK_BOLT' ? 75 : 0;
        if (b.selfGain !== gain || b.enemyReduction !== (actual === 'WARD' ? 45 : 0) || b.threatens !== (gain > 0)) return false;
      }
    }
    const recalled = spirit.status === 'DEPLOYED' && ownsOriginalSpirit(x, spirit);
    if (recalled) { spirit.status = 'SEALED'; spirit.recalls++; }
    return o.recalled === recalled && same(spirit, o.companionAfter) && playerS === o.playerSpiritualityAfter && enemyS === o.enemySpirituality && same(powers, o.powerUses);
  } catch { return false; }
}
