import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import type { LuckyPassiveLuck } from '../lucky/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { WINNER_COUNT_WHEEL, winnerActionCount } from '../winner/combat.js';
import type { WinnerLuckPolicy } from '../winner/types.js';
import { MISFORTUNE_MAGE_TARGET_ID, MISFORTUNE_MAGE_POWERS, MISFORTUNE_MAGE_POWER_IDS, hasMisfortuneMageDisputeOpponent,
  type MisfortuneMageEnemyIntent, type MisfortuneMagePowerId } from './encounter.js';

/** Candidate S4 numbering and both new practice abilities are G, not novel-verified abilities. */
export const MISFORTUNE_MAGE_COUNT_WHEEL = WINNER_COUNT_WHEEL;
export const misfortuneMageActionCount = winnerActionCount;
export const MISFORTUNE_MAGE_ENEMY_COUNT_WHEEL: readonly SliceWheelEntry[] = [
  { id: '2', label: '2次', weight: 20 }, { id: '3', label: '3次', weight: 50 }, { id: '4', label: '4次', weight: 30 },
];
export const misfortuneMageEnemyActionCount = (roll: number): number => roll <= 20 ? 2 : roll <= 70 ? 3 : 4;
export const MISFORTUNE_MAGE_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '原有限弧光：5灵性，贡献55（G）', weight: 35 },
  { id: 'WARD', label: '原有限护术：3灵性，对方−30（G）', weight: 25 },
  { id: 'BODY_STRIKE', label: '自有原棍打击：18×身体（G）', weight: 25 },
  { id: 'COMPOSE', label: '本轮凝神抵抗：3灵性，0贡献，解除未用厄运并仅本轮抵抗新K（G）', weight: 10 },
  { id: 'ACCIDENT', label: '动作偏差：固定−22.5，0灵性（G）', weight: 5 },
];
export type MisfortuneMageMoveId = 'BODY_STRIKE' | 'BODY_FOLLOWUP' | 'wheel.s4.precaution-practice'
  | 'wheel.s4.bounded-misfortune' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly { id: MisfortuneMageMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'BODY_STRIKE', label: '继承普通身体打击（H；18×身体；0灵性）', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承计算身体次击（J；22.75×原计算掌握×身体；0灵性）', weight: 15, stance: 'ATTACK' },
  { id: 'wheel.s4.precaution-practice', label: 'G有限预警训练（B；选用首个合格B/K耗1原积运与4灵性；否则继承3灵性预警）', weight: 20, stance: 'DEFEND' },
  { id: 'wheel.s4.bounded-misfortune', label: 'G有限厄运训练（K；选用首个合格B/K耗1原积运与4灵性、知识18；否则继承3灵性精神风暴）', weight: 20, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '普通观察原现场、原积运与当前凝神（R；0灵性、0贡献）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差（A；固定−22.5；0灵性，G）', weight: 5, stance: null },
];
export const isMisfortuneMage = (s: SliceState): boolean => s.progression.pathwayId === 'wheel' && s.progression.sequence === 4;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function misfortuneMageAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, weight: weights[i]! / total * 100,
    label: a.id === 'BODY_STRIKE' && s.town.clubLocation === 'HAND' ? '持握本人原短棍（H；16×身体替换本槽普通主攻；0消耗）' : a.label }));
}
export function drawMisfortuneMageAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): MisfortuneMageMoveId {
  const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (let i = 0; i < ABILITIES.length; i++) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('厄运法师训练盘权重无效。');
}
export function drawMisfortuneMageEnemyAbility(random: ActionRandomStream): MisfortuneMageEnemyIntent {
  let roll = random.nextInt(1, 100);
  for (const a of MISFORTUNE_MAGE_ENEMY_ABILITY_WHEEL) { roll -= a.weight; if (roll <= 0) return a.id as MisfortuneMageEnemyIntent; }
  throw new Error('原费里斯动作盘权重无效。');
}
const bounded = (n: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));
// Exact common Winner physical-state penalty, applied before either count draw.
const bodyFactor = (health: number) => health > 75 ? 1 : health > 50 ? .95 : health > 25 ? .9 : .8;
const factor = (n: number) => .65 + .35 * bounded(n, 500) / 500;
const mastery = (s: SliceState, id: string) => bounded(s.progression.mastery[id] ?? 0, 500);
export interface MisfortuneMageCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'MISFORTUNE_MAGE_DISPUTE'; targetId: typeof MISFORTUNE_MAGE_TARGET_ID; attemptWeek: number; startHistoryIndex: number;
  playerHealth: number; playerMind: number; enemyHealth: number; enemyMind: number; knowledge: number;
  clubLocation: SliceState['town']['clubLocation']; actualOriginalBody: true; mutuallyVisible: true;
  distanceMetres: 2; noBystanders: true; ordinaryExit: true; pursuit: false; looseObjectSource: false; disasterTrigger: false;
  targetSequence: 5; targetPhysique: 20; enemyWeapon: 'MM4-FERRIS-CLUB'; space: 'ORIGINAL_SHOP_CLEAR_REAR_YARD';
  calculationMastery: number; awarenessMastery: number; stormMastery: number; passiveMastery: number; precautionMastery: number;
  luckStored: number; luckAccumulated: number; luckSpent: number; lastAccumulateWeek: number | null;
  lastLuckRound: number | null; luckAttempts: number; misfortuneAttempts: number; powerUses: Record<MisfortuneMagePowerId, number>;
}
function validLuck(s: SliceState): boolean {
  const l = s.winner.luck;
  return Number.isSafeInteger(l.stored) && l.stored >= 0 && l.stored <= 3 && Number.isSafeInteger(l.accumulated) && l.accumulated >= 0 &&
    Number.isSafeInteger(l.spent) && l.spent >= 0 && l.stored === l.accumulated - l.spent &&
    (l.lastAccumulateWeek === null ? l.accumulated === 0 : Number.isSafeInteger(l.lastAccumulateWeek) && l.lastAccumulateWeek >= 1 && l.lastAccumulateWeek <= s.week);
}
export function currentMisfortuneMageCombatSource(s: SliceState): MisfortuneMageCombatSource | null {
  if (!hasMisfortuneMageDisputeOpponent(s) || !validLuck(s)) return null;
  const e = s.misfortuneMage.encounter, c = s.combat!, l = s.winner.luck;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'MISFORTUNE_MAGE_DISPUTE', targetId: MISFORTUNE_MAGE_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, playerHealth: s.health, playerMind: s.mind,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, knowledge: s.character.coreStats.knowledge, clubLocation: s.town.clubLocation,
    actualOriginalBody: true, mutuallyVisible: true, distanceMetres: 2, noBystanders: true, ordinaryExit: true, pursuit: false,
    looseObjectSource: false, disasterTrigger: false, targetSequence: 5, targetPhysique: 20, enemyWeapon: 'MM4-FERRIS-CLUB', space: 'ORIGINAL_SHOP_CLEAR_REAR_YARD',
    calculationMastery: mastery(s, 'wheel.s8.calculation-control'), awarenessMastery: mastery(s, 'wheel.s6.disaster-awareness'),
    stormMastery: mastery(s, 'wheel.s6.mental-storm'), passiveMastery: mastery(s, 'wheel.s7.passive-luck'), precautionMastery: mastery(s, 'wheel.s4.precaution-practice'),
    luckStored: l.stored, luckAccumulated: l.accumulated, luckSpent: l.spent, lastAccumulateWeek: l.lastAccumulateWeek,
    lastLuckRound: e.lastLuckRound, luckAttempts: e.luckAttempts, misfortuneAttempts: e.misfortuneAttempts, powerUses: { ...e.powerUses } };
}
export interface MisfortuneMageCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
export interface MisfortuneMagePlayerAction extends MisfortuneMageCombatEffect {
  order: number; id: MisfortuneMageMoveId; paidCost: number; luckCost: number; physicalFactor: number;
  checkChance: number | null; checkRoll: number | null; resistedByComposure: boolean; succeeded: boolean;
}
export interface MisfortuneMageEnemyAction extends MisfortuneMageCombatEffect {
  order: number; planned: MisfortuneMageEnemyIntent; actual: MisfortuneMageEnemyIntent; paidCost: number;
  physicalFactor: number; staggerApplied: boolean;
}
export interface MisfortuneMageRoundContext {
  source: MisfortuneMageCombatSource; stance: SliceStance; winnerPolicy: WinnerLuckPolicy; finished: boolean; liveState: string;
  playerSpiritualityBefore: number; enemySpiritualityBefore: number; passiveLuck: LuckyPassiveLuck | null;
  playerActions: MisfortuneMagePlayerAction[]; enemyActions: MisfortuneMageEnemyAction[]; label: string;
}
const none = (label: string): MisfortuneMageCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
const dynamicSource = new Set(['luckStored', 'luckSpent', 'lastLuckRound', 'luckAttempts', 'misfortuneAttempts', 'powerUses']);
function liveState(s: SliceState): string {
  const e = s.misfortuneMage.encounter;
  return stableStringify({ spirituality: s.spirituality, luck: s.winner.luck, enemySpirituality: e.enemySpirituality,
    lastLuckRound: e.lastLuckRound, staggerReady: e.staggerReady, composureReady: e.composureReady,
    luckAttempts: e.luckAttempts, misfortuneAttempts: e.misfortuneAttempts, powerUses: e.powerUses });
}
function validRound(s: SliceState, r: MisfortuneMageRoundContext, source: MisfortuneMageCombatSource | null): boolean {
  const current = currentMisfortuneMageCombatSource(s);
  return !r.finished && current !== null && source !== null && stableStringify(source) === stableStringify(r.source) &&
    Object.entries(r.source).every(([k, v]) => dynamicSource.has(k) || stableStringify(current[k as keyof MisfortuneMageCombatSource]) === stableStringify(v)) &&
    r.liveState === liveState(s);
}
/** RNG order: passive (non-retreat only), player count, enemy count, alternating action tickets,
 * one knowledge roll per actually paid K, winner, then only a threatened loser's consequence. No redraws. */
export function beginMisfortuneMageCombatRound(s: SliceState, stance: SliceStance, random: ActionRandomStream,
  winnerPolicy: WinnerLuckPolicy = 'HOLD'): MisfortuneMageRoundContext {
  if (!['HOLD', 'SPEND_FIRST'].includes(winnerPolicy)) throw new TypeError('积运策略无效。');
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('战术姿态无效。');
  const source = currentMisfortuneMageCombatSource(s), e = s.misfortuneMage.encounter;
  if (!source || e.staggerReady || e.composureReady || e.lastLuckRound === s.combat!.round) throw new Error('缺少同一原费里斯的完整新回合来源，或原回合效果尚未结束。');
  const roll = stance === 'RETREAT' ? null : random.nextInt(1, 100);
  const physical = bodyFactor(s.health);
  const passiveLuck = roll === null ? null : { roll, triggered: roll <= 25, bonus: roll <= 25 ? 45 * factor(source.passiveMastery) * physical : 0 };
  return { source, stance, winnerPolicy, finished: false, liveState: liveState(s), playerSpiritualityBefore: s.spirituality,
    enemySpiritualityBefore: e.enemySpirituality, passiveLuck, playerActions: [], enemyActions: [],
    label: `原费里斯在净空后院2米外，灵性${e.enemySpirituality}/40；本人原积运${s.winner.luck.stored}/3，本轮${winnerPolicy === 'HOLD' ? '保留积运' : '仅首个资源合格B/K选用积运'}。` };
}
export function resolveMisfortuneMageCombatAbility(s: SliceState, id: MisfortuneMageMoveId, physicalStateFactor: number, random: ActionRandomStream,
  r: MisfortuneMageRoundContext, source: MisfortuneMageCombatSource | null = r.source): MisfortuneMageCombatEffect {
  if (!validRound(s, r, source) || !ABILITIES.some(a => a.id === id)) return none('缺少本回合同一原费里斯与实际原资源来源，0贡献、0消耗，不重抽。');
  const a: MisfortuneMagePlayerAction = { ...none(''), order: r.playerActions.length + r.enemyActions.length, id, paidCost: 0, luckCost: 0,
    physicalFactor: bounded(physicalStateFactor, 1), checkChance: null, checkRoll: null, resistedByComposure: false, succeeded: false };
  Object.assign(a, resolvePlayer(s, id, a.physicalFactor, random, r, a)); r.playerActions.push(a); r.liveState = liveState(s);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
function resolvePlayer(s: SliceState, id: MisfortuneMageMoveId, physical: number, random: ActionRandomStream,
  r: MisfortuneMageRoundContext, a: MisfortuneMagePlayerAction): MisfortuneMageCombatEffect {
  const e = s.misfortuneMage.encounter, l = s.winner.luck;
  const pay = (n: number) => { if (!Number.isFinite(s.spirituality) || s.spirituality < n) return false; s.spirituality -= n; a.paidCost = n; return true; };
  if (id === 'ACCIDENT') return { ...none('动作偏差固定−22.5（G），0消耗，不另掷正负，不自动扣积运或附加等额厄运债。'), selfGain: -22.5 };
  if (id === 'BODY_STRIKE' || id === 'BODY_FOLLOWUP') {
    const selfGain = id === 'BODY_STRIKE' ? (s.town.clubLocation === 'HAND' ? 16 : 18) * physical : 22.75 * factor(mastery(s, 'wheel.s8.calculation-control')) * physical;
    return { label: id === 'BODY_FOLLOWUP' ? '继承计算与精确身体次击22.75×原计算掌握×身体（G），独立本槽，0消耗。'
      : s.town.clubLocation === 'HAND' ? '实际持握本人原短棍，16×身体替换本槽主攻（G），0消耗，不取费里斯原棍。'
      : '继承普通身体打击18×当前身体（G），0消耗；净空后院不凭空制造灾祸。', selfGain, enemyReduction: 0, threatens: selfGain > 0 };
  }
  if (id === 'OBSERVE') return none(`普通观察眼前净空后院与开放出口：原费里斯灵性${e.enemySpirituality}/40，${e.composureReady ? '本轮已有实际凝神抵抗' : '当前无凝神保护'}，未用厄运${e.staggerReady ? '待本轮下一正攻击' : '无'}；本人原积运${l.stored}/3。0贡献、0消耗，不积运、不窥视未来随机票或制造灾源。`);
  const selected = r.winnerPolicy === 'SPEND_FIRST' && e.lastLuckRound !== s.combat!.round && l.stored >= 1 && pay(4);
  if (selected) {
    // The only spendable reserve remains the original Winner ledger. Encounter counters are evidence, never funds.
    l.stored--; l.spent++; a.luckCost = 1; e.lastLuckRound = s.combat!.round; e.luckAttempts++;
    if (id === 'wheel.s4.precaution-practice') return { ...none(`G有限预警训练：实付1原积运与4灵性，本槽40×新预警训练掌握减压；原积运余${l.stored}/3，不治疗、不取消敌方动作、不保证无伤。`), enemyReduction: 40 * factor(mastery(s, id)) };
    e.misfortuneAttempts++; a.checkChance = computeCheckChance({ ability: 'knowledge', baseAbility: s.character.coreStats.knowledge, difficulty: 18, modifiers: [] });
    a.checkRoll = random.nextInt(1, 100); a.resistedByComposure = e.composureReady; a.succeeded = a.checkRoll <= a.checkChance && !a.resistedByComposure;
    if (a.succeeded) e.staggerReady = true;
    return none(`G有限厄运训练实付1原积运与4灵性，知识18判定${a.checkRoll}/100、阈值${a.checkChance}；${a.resistedByComposure ? '原费里斯本轮实际凝神抵抗成功，无效果，已付成本不退' : a.succeeded ? '仅本轮下一次实际正贡献BODY_STRIKE或ARC_BOLT×0.5一次，原法术仍实际执行并付费' : '本次判定失败，无效果，已付成本不退'}。0即时贡献，不改先前动作、不影响护术、不重抽或强迫投降。`);
  }
  if (id === 'wheel.s4.precaution-practice') {
    if (pay(3)) return { ...none('继承有限灾祸预警：实付3灵性，42.25×原灾祸觉察掌握×身体（G）；本槽不使用积运，不取消原攻击。'), enemyReduction: 42.25 * factor(mastery(s, 'wheel.s6.disaster-awareness')) * physical };
    return { ...none('不足3灵性，普通格挡8×当前身体，0消耗，不透支或补充原积运。'), enemyReduction: 8 * physical };
  }
  if (pay(3)) return { ...none('继承有限精神风暴：实付3灵性，42.25×原精神风暴掌握（G），不乘身体；只减本槽战势，不控制意愿或重抽。'), enemyReduction: 42.25 * factor(mastery(s, 'wheel.s6.mental-storm')) };
  return none('不足3灵性，普通观察走位0贡献、0消耗，不假造厄运或精神风暴。');
}
export function resolveMisfortuneMageEnemyAbility(s: SliceState, planned: MisfortuneMageEnemyIntent, physicalStateFactor: number, _random: ActionRandomStream,
  r: MisfortuneMageRoundContext, source: MisfortuneMageCombatSource | null = r.source): MisfortuneMageCombatEffect {
  if (!validRound(s, r, source) || ![...MISFORTUNE_MAGE_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned)) return none('缺少同一原费里斯的实际来源，不凭空施术、补灵性或重抽。');
  const e = s.misfortuneMage.encounter, power = MISFORTUNE_MAGE_POWERS.find(p => p.id === planned), payable = !!power && e.enemySpirituality >= power.cost;
  const actual: MisfortuneMageEnemyIntent = planned === 'ACCIDENT' ? planned : payable ? planned : 'BODY_STRIKE';
  const physical = bounded(physicalStateFactor, 1), raw = actual === 'ACCIDENT' ? -22.5 : payable ? power!.selfGain : 18 * physical;
  if (payable) { e.enemySpirituality -= power!.cost; e.powerUses[power!.id]++; }
  if (actual === 'COMPOSE') { e.staggerReady = false; e.composureReady = true; }
  const attack = actual === 'BODY_STRIKE' || actual === 'ARC_BOLT', staggerApplied = attack && raw > 0 && e.staggerReady;
  if (staggerApplied) e.staggerReady = false;
  const selfGain = raw * (staggerApplied ? .5 : 1), enemyReduction = payable ? power!.enemyReduction : 0;
  const a: MisfortuneMageEnemyAction = { order: r.playerActions.length + r.enemyActions.length, planned, actual, paidCost: payable ? power!.cost : 0,
    physicalFactor: physical, staggerApplied, selfGain, enemyReduction, threatens: attack && selfGain > 0,
    label: `${actual === 'ACCIDENT' ? '原费里斯动作偏差固定−22.5，0灵性（G）' : actual === 'COMPOSE' ? `原费里斯实际凝神，实付3灵性，余${e.enemySpirituality}/40；0贡献，清除未用厄运并仅至本轮末抵抗新K（G）` : payable ? `原费里斯完成${power!.label}，实付${power!.cost}灵性，余${e.enemySpirituality}/40` : `${power ? '原法术灵性不足，实际回退' : ''}自有MM4-FERRIS-CLUB普通打击18×身体（G），0消耗`}${staggerApplied ? '；已付厄运仅把这次实际正攻击贡献减半后结束，原行动与法术费用保留' : ''}。不直接扣健康，不凭空回灵性。` };
  r.enemyActions.push(a); r.liveState = liveState(s);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
export interface MisfortuneMageRoundOutcome {
  targetId: typeof MISFORTUNE_MAGE_TARGET_ID; round: number; source: MisfortuneMageCombatSource; stance: SliceStance; winnerPolicy: WinnerLuckPolicy; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number;
  enemySpiritualityBefore: number; powerUses: Record<MisfortuneMagePowerId, number>; passiveLuck: LuckyPassiveLuck | null;
  luckStoredAfter: number; luckSpentAfter: number; lastLuckRound: number | null; luckAttempts: number; misfortuneAttempts: number;
  staggerReady: false; composureReady: false; playerActions: MisfortuneMagePlayerAction[]; enemyActions: MisfortuneMageEnemyAction[];
}
export function finishMisfortuneMageCombatRound(s: SliceState, r: MisfortuneMageRoundContext, continuing = true): MisfortuneMageRoundOutcome {
  if (r.finished || s.combat?.encounterId !== 'MISFORTUNE_MAGE_DISPUTE' || s.combat.round !== r.source.round || r.liveState !== liveState(s)) throw new Error('同一原回合已经结束、不存在或实际资源被改写。');
  const e = s.misfortuneMage.encounter, c = s.combat;
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus;
  e.enemyInjuries = c.enemyInjuries.map(i => ({ ...i })); e.enemyRisk = c.enemyRisk;
  e.staggerReady = false; e.composureReady = false; r.finished = true;
  return { targetId: MISFORTUNE_MAGE_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, winnerPolicy: r.winnerPolicy, continuing,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus,
    playerSpiritualityBefore: r.playerSpiritualityBefore, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind,
    enemySpiritualityBefore: r.enemySpiritualityBefore, powerUses: { ...e.powerUses }, passiveLuck: r.passiveLuck && { ...r.passiveLuck },
    luckStoredAfter: s.winner.luck.stored, luckSpentAfter: s.winner.luck.spent, lastLuckRound: e.lastLuckRound,
    luckAttempts: e.luckAttempts, misfortuneAttempts: e.misfortuneAttempts, staggerReady: false, composureReady: false,
    playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
}
export function projectMisfortuneMageCombat(s: SliceState) {
  const e = s.misfortuneMage.encounter;
  return { enemyName: '费里斯·洛恩（MM4-FERRIS-LORNE，原创成年序列5对手，G）', targetId: e.targetId,
    enemySpirituality: e.enemySpirituality, powerUses: { ...e.powerUses }, composureReady: e.composureReady, staggerReady: e.staggerReady,
    lastLuckRound: e.lastLuckRound, luckAttempts: e.luckAttempts, misfortuneAttempts: e.misfortuneAttempts,
    luck: { ...s.winner.luck, capacity: 3 as const }, originalExit: true, pursuit: false, distanceMetres: 2, source: currentMisfortuneMageCombatSource(s),
    summary: `原费里斯灵性${e.enemySpirituality}/40；本人原赢家积运${s.winner.luck.stored}/3，累计实付${s.winner.luck.spent}，不另建积运池。默认保留，本轮首个合格B/K可选耗1原积运与4灵性；K知识18可失败，敌方3灵性凝神只在本轮抵抗并清除未用效果。成功厄运仅减半下一次实际正身体或弧光战势，回合末到期；不重抽、不强制命中、不生成等额厄运债。继承S7被动每个非撤退回合独立一次25%抽取，不耗积运。新4编号与训练未直接核验，均为G；完整原著4级技能仍未知。`,
    enemyCountWheel: MISFORTUNE_MAGE_ENEMY_COUNT_WHEEL, enemyAbilityWheel: MISFORTUNE_MAGE_ENEMY_ABILITY_WHEEL };
}
/** Replay actual action order and costs. These are historical snapshots of Winner funds, never a spendable second pool. */
export function validateMisfortuneMageRoundOutcome(v: unknown): v is MisfortuneMageRoundOutcome {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const p = v as MisfortuneMageRoundOutcome;
  const integer = (n: unknown, min: number, max = Number.MAX_SAFE_INTEGER): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
  const resource = (n: unknown, max = 120): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
  const usesValid = (u: Record<MisfortuneMagePowerId, number>) => u && typeof u === 'object' && Object.keys(u).length === 3 && MISFORTUNE_MAGE_POWER_IDS.every(id => integer(u[id], 0, 13));
  const a = p.source;
  if (!a || typeof a !== 'object' || a.targetId !== MISFORTUNE_MAGE_TARGET_ID || a.encounterId !== 'MISFORTUNE_MAGE_DISPUTE' || a.round !== p.round ||
      typeof a.runId !== 'string' || a.runId.length === 0 || !integer(a.revision, 0) || !integer(a.week, 1) || a.attemptWeek !== a.week || !integer(a.startHistoryIndex, 0) ||
      !integer(a.playerHealth, 1, 100) || !integer(a.playerMind, 1, 100) || !integer(a.enemyHealth, 1, 100) || !integer(a.enemyMind, 1, 100) || !integer(a.knowledge, 0, 500) ||
      !['SHOP', 'BAG', 'HAND'].includes(a.clubLocation) || a.actualOriginalBody !== true || a.mutuallyVisible !== true || a.distanceMetres !== 2 || a.noBystanders !== true ||
      a.ordinaryExit !== true || a.pursuit !== false || a.looseObjectSource !== false || a.disasterTrigger !== false || a.targetSequence !== 5 || a.targetPhysique !== 20 ||
      a.enemyWeapon !== 'MM4-FERRIS-CLUB' || a.space !== 'ORIGINAL_SHOP_CLEAR_REAR_YARD' ||
      ![a.calculationMastery, a.awarenessMastery, a.stormMastery, a.passiveMastery, a.precautionMastery].every(n => resource(n, 500)) || !usesValid(a.powerUses) ||
      !integer(a.luckStored, 0, 3) || !integer(a.luckAccumulated, 0) || !integer(a.luckSpent, 0, a.luckAccumulated) || a.luckStored !== a.luckAccumulated - a.luckSpent ||
      (a.lastAccumulateWeek === null ? a.luckAccumulated !== 0 : !integer(a.lastAccumulateWeek, 1, a.week)) ||
      !integer(a.luckAttempts, 0) || !integer(a.misfortuneAttempts, 0, a.luckAttempts) ||
      (a.lastLuckRound === null ? a.luckAttempts !== 0 : !integer(a.lastLuckRound, 1, a.round - 1) || a.luckAttempts === 0)) return false;
  if (p.targetId !== MISFORTUNE_MAGE_TARGET_ID || !integer(p.round, 1) || !['HOLD', 'SPEND_FIRST'].includes(p.winnerPolicy) ||
      !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(p.stance) || !integer(p.enemyHealth, 0, a.enemyHealth) || p.enemyMind !== a.enemyMind ||
      !integer(p.enemySpirituality, 0, 40) || !integer(p.enemySpiritualityBefore, p.enemySpirituality, 40) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(p.enemyStatus) || (p.enemyStatus === 'DEAD') !== (p.enemyHealth === 0) ||
      !resource(p.playerSpiritualityBefore) || !resource(p.playerSpiritualityAfter) || p.playerSpiritualityAfter > p.playerSpiritualityBefore ||
      !integer(p.playerHealthAfter, 0, a.playerHealth) || p.playerMindAfter !== a.playerMind || !usesValid(p.powerUses) ||
      p.enemySpiritualityBefore !== 40 - MISFORTUNE_MAGE_POWERS.reduce((n, x) => n + a.powerUses[x.id] * x.cost, 0) ||
      p.enemySpirituality !== 40 - MISFORTUNE_MAGE_POWERS.reduce((n, x) => n + p.powerUses[x.id] * x.cost, 0) ||
      p.staggerReady !== false || p.composureReady !== false || typeof p.continuing !== 'boolean' || (p.continuing && (p.enemyStatus !== 'RESISTING' || p.playerHealthAfter <= 0)) ||
      !Array.isArray(p.playerActions) || p.playerActions.length > 6 || !Array.isArray(p.enemyActions) || p.enemyActions.length > 4) return false;
  if (p.stance === 'RETREAT') { if (p.passiveLuck !== null || p.playerActions.length !== 0) return false; }
  else if (!p.passiveLuck || !integer(p.passiveLuck.roll, 1, 100) || p.passiveLuck.triggered !== (p.passiveLuck.roll <= 25) ||
      p.passiveLuck.bonus !== (p.passiveLuck.triggered ? 45 * factor(a.passiveMastery) * bodyFactor(a.playerHealth) : 0)) return false;
  const ordered = [...p.playerActions.map(x => ({ kind: 'PLAYER' as const, action: x })), ...p.enemyActions.map(x => ({ kind: 'ENEMY' as const, action: x }))];
  if (ordered.some(x => !x.action || !integer(x.action.order, 0, 9))) return false;
  ordered.sort((x, y) => x.action.order - y.action.order);
  let enemySpent = 0, playerSpent = 0, luckStored = a.luckStored, luckSpent = a.luckSpent, lastLuckRound = a.lastLuckRound;
  let luckAttempts = a.luckAttempts, misfortuneAttempts = a.misfortuneAttempts, stagger = false, composure = false;
  const uses = { ...a.powerUses };
  for (let index = 0; index < ordered.length; index++) {
    const entry = ordered[index]!, action = entry.action;
    if (action.order !== index || typeof action.label !== 'string' || !Number.isFinite(action.selfGain) || !resource(action.enemyReduction, 42.25) ||
        typeof action.threatens !== 'boolean' || !resource(action.physicalFactor, 1)) return false;
    if (entry.kind === 'PLAYER') {
      const x = entry.action;
      if (!ABILITIES.some(m => m.id === x.id) || !integer(x.paidCost, 0, 4) || !integer(x.luckCost, 0, 1) ||
          typeof x.resistedByComposure !== 'boolean' || typeof x.succeeded !== 'boolean') return false;
      const funds = p.playerSpiritualityBefore - playerSpent, eligible = p.winnerPolicy === 'SPEND_FIRST' && lastLuckRound !== p.round && luckStored >= 1 && funds >= 4;
      let cost = 0, luckCost = 0, gain = 0, reduction = 0, threat = false, succeeded = false, resistedByComposure = false, checked = false;
      if (x.id === 'ACCIDENT') gain = -22.5;
      if (x.id === 'BODY_STRIKE') { gain = (a.clubLocation === 'HAND' ? 16 : 18) * x.physicalFactor; threat = gain > 0; }
      if (x.id === 'BODY_FOLLOWUP') { gain = 22.75 * factor(a.calculationMastery) * x.physicalFactor; threat = gain > 0; }
      if (x.id === 'wheel.s4.precaution-practice' || x.id === 'wheel.s4.bounded-misfortune') {
        if (eligible) {
          cost = 4; luckCost = 1; lastLuckRound = p.round; luckAttempts++;
          if (x.id === 'wheel.s4.precaution-practice') reduction = 40 * factor(a.precautionMastery);
          else {
            checked = true; misfortuneAttempts++;
            if (!integer(x.checkRoll, 1, 100) || x.checkChance !== computeCheckChance({ ability: 'knowledge', baseAbility: a.knowledge, difficulty: 18, modifiers: [] })) return false;
            resistedByComposure = composure; succeeded = x.checkRoll <= x.checkChance && !composure;
            if (succeeded) stagger = true;
          }
        } else if (funds >= 3) {
          cost = 3; reduction = x.id === 'wheel.s4.precaution-practice' ? 42.25 * factor(a.awarenessMastery) * x.physicalFactor : 42.25 * factor(a.stormMastery);
        } else if (x.id === 'wheel.s4.precaution-practice') reduction = 8 * x.physicalFactor;
      }
      if (!checked && (x.checkChance !== null || x.checkRoll !== null)) return false;
      if (x.paidCost !== cost || x.luckCost !== luckCost || x.selfGain !== gain || x.enemyReduction !== reduction || x.threatens !== threat ||
          x.succeeded !== succeeded || x.resistedByComposure !== resistedByComposure) return false;
      playerSpent += cost; luckStored -= luckCost; luckSpent += luckCost;
    } else {
      const x = entry.action, power = MISFORTUNE_MAGE_POWERS.find(q => q.id === x.planned), payable = !!power && p.enemySpiritualityBefore - enemySpent >= power.cost;
      const actual = x.planned === 'ACCIDENT' ? x.planned : payable ? x.planned : 'BODY_STRIKE';
      if (![...MISFORTUNE_MAGE_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(x.planned) || typeof x.staggerApplied !== 'boolean' ||
          x.actual !== actual || x.paidCost !== (payable ? power!.cost : 0)) return false;
      const raw = actual === 'ACCIDENT' ? -22.5 : payable ? power!.selfGain : 18 * x.physicalFactor;
      const attack = actual === 'BODY_STRIKE' || actual === 'ARC_BOLT';
      if (actual === 'COMPOSE') { composure = true; stagger = false; }
      if (x.staggerApplied !== (attack && raw > 0 && stagger) || x.selfGain !== raw * (x.staggerApplied ? .5 : 1) ||
          x.enemyReduction !== (payable ? power!.enemyReduction : 0) || x.threatens !== (attack && x.selfGain > 0)) return false;
      if (x.staggerApplied) stagger = false;
      if (payable) uses[power!.id]++;
      enemySpent += x.paidCost;
    }
  }
  return p.enemySpiritualityBefore - enemySpent === p.enemySpirituality && p.playerSpiritualityBefore - playerSpent === p.playerSpiritualityAfter &&
    p.luckStoredAfter === luckStored && p.luckSpentAfter === luckSpent && p.lastLuckRound === lastLuckRound &&
    p.luckAttempts === luckAttempts && p.misfortuneAttempts === misfortuneAttempts && stableStringify(uses) === stableStringify(p.powerUses);
}
