import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { BriberGift } from '../briber/types.js';
import { stableStringify } from '../canonical.js';
import { MENTOR_DISORDER_COUNT_WHEEL, mentorDisorderActionCount } from '../mentor-disorder/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { FALLEN_EARL_TARGET_ID, FALLEN_EARL_POWERS, FALLEN_EARL_POWER_IDS, hasFallenEarlDisputeOpponent,
  type FallenEarlEnemyIntent, type FallenEarlPowerId } from './encounter.js';

/** Source-backed ability categories; these finite combat costs, multipliers and durations are G. */
export const FALLEN_EARL_COUNT_WHEEL = MENTOR_DISORDER_COUNT_WHEEL;
export const fallenEarlActionCount = mentorDisorderActionCount;
export const FALLEN_EARL_ENEMY_COUNT_WHEEL: readonly SliceWheelEntry[] = [
  { id: '2', label: '2次', weight: 20 }, { id: '3', label: '3次', weight: 50 }, { id: '4', label: '4次', weight: 30 },
];
export const fallenEarlEnemyActionCount = (roll: number): number => roll <= 20 ? 2 : roll <= 70 ? 3 : 4;
export const FALLEN_EARL_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '原有限弧光：5灵性，贡献55（G）', weight: 35 },
  { id: 'WARD', label: '原有限护术：3灵性，对方−30（G）', weight: 25 },
  { id: 'BODY_STRIKE', label: '自有原棍打击：18×身体（G）', weight: 25 },
  { id: 'COMPOSE', label: '本轮凝神：3灵性，0贡献，清除并抵抗本轮赠予（G）', weight: 10 },
  { id: 'ACCIDENT', label: '动作偏差：固定−22.5，0灵性（G）', weight: 5 },
];
export type FallenEarlMoveId = 'black-emperor.s4.magnify' | 'BODY_FOLLOWUP' | 'black-emperor.s7.bribery-weakening'
  | 'black-emperor.s4.bestow' | 'black-emperor.s4.exploit' | 'ACCIDENT';
const ABILITIES: readonly { id: FallenEarlMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'black-emperor.s4.magnify', label: '放大本人当次实际击打（H；4灵性；只乘原主攻一次，G）', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承强化身体侧击（J；41.405×原身体掌握×身体；0灵性，G）', weight: 15, stance: 'ATTACK' },
  { id: 'black-emperor.s7.bribery-weakening', label: '实赠原木筹削弱（B；原库存1件、3灵性；否则继承破绽护身，G）', weight: 25, stance: 'DEFEND' },
  { id: 'black-emperor.s4.bestow', label: '赠予暂失斗志（K；4灵性、知识18；下一次正身体或弧光×0.55，G）', weight: 10, stance: 'CONTROL' },
  { id: 'black-emperor.s4.exploit', label: '利用当前原赠物削弱（R；3灵性；同一已存在状态一次延至两次，G）', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差（A；固定−22.5；0灵性，G）', weight: 5, stance: null },
];
export const isFallenEarl = (s: SliceState): boolean => s.progression.pathwayId === 'black-emperor' && s.progression.sequence === 4;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function fallenEarlAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, weight: weights[i]! / total * 100,
    label: a.id === 'black-emperor.s4.magnify' && s.town.clubLocation === 'HAND' ? '放大本人持握原短棍的当次打击（H；4灵性；只以16×身体为原主攻，G）' : a.label }));
}
export function drawFallenEarlAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): FallenEarlMoveId {
  const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (let i = 0; i < ABILITIES.length; i++) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('堕落伯爵能力盘权重无效。');
}
export function drawFallenEarlEnemyAbility(random: ActionRandomStream): FallenEarlEnemyIntent {
  let roll = random.nextInt(1, 100);
  for (const a of FALLEN_EARL_ENEMY_ABILITY_WHEEL) { roll -= a.weight; if (roll <= 0) return a.id as FallenEarlEnemyIntent; }
  throw new Error('原马洛动作盘权重无效。');
}
const bounded = (n: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));
const factor = (n: number) => .65 + .35 * bounded(n, 500) / 500;
const mastery = (s: SliceState, id: string) => bounded(s.progression.mastery[id] ?? 0, 500);
const ground = 'BATTLE:FALLEN_EARL_DISPUTE:GROUND';
export interface FallenEarlCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'FALLEN_EARL_DISPUTE'; targetId: typeof FALLEN_EARL_TARGET_ID; attemptWeek: number; startHistoryIndex: number;
  playerHealth: number; playerMind: number; enemyHealth: number; enemyMind: number; knowledge: number;
  clubLocation: SliceState['town']['clubLocation']; actualOriginalBody: true; mutuallyVisible: true;
  distanceMetres: 2; noBystanders: true; ordinaryExit: true; pursuit: false; targetAlive: true; independentMind: true;
  targetSequence: 5; targetPhysique: 20; enemyWeapon: 'FE4-MARLOW-CLUB'; space: 'ORIGINAL_CONTRACT_CLEAR_COURTYARD';
  bodyMastery: number; weakPointMastery: number; briberyMastery: number; magnifyMastery: number;
  gifts: BriberGift[]; powerUses: Record<FallenEarlPowerId, number>; bestowAttempts: number; magnifyUses: number; exploitUses: number;
}
export function currentFallenEarlCombatSource(s: SliceState): FallenEarlCombatSource | null {
  if (!hasFallenEarlDisputeOpponent(s)) return null;
  const e = s.fallenEarl.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'FALLEN_EARL_DISPUTE', targetId: FALLEN_EARL_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, playerHealth: s.health, playerMind: s.mind,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, knowledge: s.character.coreStats.knowledge, clubLocation: s.town.clubLocation,
    actualOriginalBody: true, mutuallyVisible: true, distanceMetres: 2, noBystanders: true, ordinaryExit: true, pursuit: false,
    targetAlive: true, independentMind: true, targetSequence: 5, targetPhysique: 20, enemyWeapon: 'FE4-MARLOW-CLUB', space: 'ORIGINAL_CONTRACT_CLEAR_COURTYARD',
    bodyMastery: mastery(s, 'black-emperor.s8.enhanced-body'), weakPointMastery: mastery(s, 'black-emperor.s9.weak-point-insight'),
    briberyMastery: mastery(s, 'black-emperor.s7.bribery-weakening'), magnifyMastery: mastery(s, 'black-emperor.s4.magnify'),
    gifts: structuredClone(s.briber.gifts), powerUses: { ...e.powerUses }, bestowAttempts: e.bestowAttempts, magnifyUses: e.magnifyUses, exploitUses: e.exploitUses };
}
export interface FallenEarlCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
export interface FallenEarlPlayerAction extends FallenEarlCombatEffect {
  order: number; id: FallenEarlMoveId; paidCost: number; physicalFactor: number; giftId: string | null; magnified: boolean;
  checkChance: number | null; checkRoll: number | null; resistedByComposure: boolean; succeeded: boolean;
}
export interface FallenEarlEnemyAction extends FallenEarlCombatEffect {
  order: number; planned: FallenEarlEnemyIntent; actual: FallenEarlEnemyIntent; paidCost: number; physicalFactor: number;
  target: 'PLAYER' | 'SELF'; bestowApplied: boolean; weakeningGiftId: string | null; weakeningFactor: number;
}
interface PendingGift { giftId: string; factor: number; remaining: number; extended: boolean }
export interface FallenEarlRoundContext {
  source: FallenEarlCombatSource; stance: SliceStance; finished: boolean; liveState: string;
  playerSpiritualityBefore: number; enemySpiritualityBefore: number; pendingWeakening: PendingGift | null;
  playerActions: FallenEarlPlayerAction[]; enemyActions: FallenEarlEnemyAction[]; label: string;
}
const none = (label: string): FallenEarlCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
const dynamicSource = new Set(['gifts', 'powerUses', 'bestowAttempts', 'magnifyUses', 'exploitUses']);
function liveState(s: SliceState): string {
  const e = s.fallenEarl.encounter;
  return stableStringify({ spirituality: s.spirituality, gifts: s.briber.gifts, enemySpirituality: e.enemySpirituality,
    bestowReady: e.bestowReady, composureReady: e.composureReady, powerUses: e.powerUses,
    bestowAttempts: e.bestowAttempts, magnifyUses: e.magnifyUses, exploitUses: e.exploitUses });
}
function validRound(s: SliceState, r: FallenEarlRoundContext, source: FallenEarlCombatSource | null): boolean {
  const current = currentFallenEarlCombatSource(s);
  return !r.finished && current !== null && source !== null && stableStringify(source) === stableStringify(r.source) &&
    Object.entries(r.source).every(([k, v]) => dynamicSource.has(k) || stableStringify(current[k as keyof FallenEarlCombatSource]) === stableStringify(v)) && r.liveState === liveState(s);
}
/** Count draws, alternating actual action tickets, one knowledge draw per paid K, winner, then only a threatened loser's consequence. */
export function beginFallenEarlCombatRound(s: SliceState, stance: SliceStance, _random: ActionRandomStream): FallenEarlRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('战术姿态无效。');
  const source = currentFallenEarlCombatSource(s), e = s.fallenEarl.encounter;
  if (!source || e.bestowReady || e.composureReady) throw new Error('缺少同一原马洛完整新回合来源，或上一回合短效尚未结束。');
  return { source, stance, finished: false, liveState: liveState(s), playerSpiritualityBefore: s.spirituality,
    enemySpiritualityBefore: e.enemySpirituality, pendingWeakening: null, playerActions: [], enemyActions: [],
    label: `原马洛本人在日光净空外院2米外，灵性${e.enemySpirituality}/40，有独立心智；本人实际原木筹尚持${s.briber.gifts.filter(g => g.location === 'PLAYER').length}件，原出口开放。` };
}
export function resolveFallenEarlCombatAbility(s: SliceState, id: FallenEarlMoveId, physicalStateFactor: number, random: ActionRandomStream,
  r: FallenEarlRoundContext, source: FallenEarlCombatSource | null = r.source): FallenEarlCombatEffect {
  if (!validRound(s, r, source) || !ABILITIES.some(a => a.id === id)) return none('缺少本回合同一原活人、自主心智或实际原资源来源，0贡献、0消耗，不重抽。');
  const a: FallenEarlPlayerAction = { ...none(''), order: r.playerActions.length + r.enemyActions.length, id, paidCost: 0, physicalFactor: bounded(physicalStateFactor, 1),
    giftId: null, magnified: false, checkChance: null, checkRoll: null, resistedByComposure: false, succeeded: false };
  Object.assign(a, resolvePlayer(s, id, a.physicalFactor, random, r, a)); r.playerActions.push(a); r.liveState = liveState(s);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
function resolvePlayer(s: SliceState, id: FallenEarlMoveId, physical: number, random: ActionRandomStream,
  r: FallenEarlRoundContext, a: FallenEarlPlayerAction): FallenEarlCombatEffect {
  const e = s.fallenEarl.encounter;
  const pay = (n: number) => { if (!Number.isFinite(s.spirituality) || s.spirituality < n) return false; s.spirituality -= n; a.paidCost = n; return true; };
  if (id === 'ACCIDENT') return { ...none('本人动作偏差固定−22.5（G），0灵性，不另掷正负、不生成异变或追加攻击。'), selfGain: -22.5 };
  if (id === 'black-emperor.s4.magnify') {
    const base = (s.town.clubLocation === 'HAND' ? 16 : 59.15 * factor(r.source.bodyMastery)) * physical;
    a.magnified = pay(4); if (a.magnified) e.magnifyUses++;
    const multiplier = a.magnified ? 1 + .25 * factor(r.source.magnifyMastery) : 1, selfGain = base * multiplier;
    return { label: `${s.town.clubLocation === 'HAND' ? '本人实际持握自己的原短棍，本次原打击16×身体替换强化身体主攻' : '本人继承强化身体主攻59.15×原身体掌握×身体'}；${a.magnified ? `实付4灵性，只放大本人这一次实际行为×${multiplier}（G）` : '不足4灵性，保留原主攻、不放大、0消耗'}。独立本槽不叠加、不增加行动，不放大别人或凭空造成伤势。`, selfGain, enemyReduction: 0, threatens: selfGain > 0 };
  }
  if (id === 'BODY_FOLLOWUP') {
    const selfGain = 41.405 * factor(r.source.bodyMastery) * physical;
    return { label: '继承强化身体侧击41.405×原身体掌握×身体（G），0灵性，独立本槽，不附加放大或另一轮攻击。', selfGain, enemyReduction: 0, threatens: selfGain > 0 };
  }
  if (id === 'black-emperor.s7.bribery-weakening') {
    const gift = s.briber.gifts.find(g => g.location === 'PLAYER');
    if (!r.pendingWeakening && gift && pay(3)) {
      gift.location = 'GIVEN'; gift.destination = ground; gift.givenWeek = s.week; a.giftId = gift.id;
      r.pendingWeakening = { giftId: gift.id, factor: .35 * factor(r.source.briberyMastery), remaining: 1, extended: false };
      return none(`继承贿赂实付3灵性并实际给出原木筹${gift.id}，原物离开唯一旧库存、落在本场地面；不要求自愿接住，不转为敌方持物。0即时贡献，只削弱本轮下一次实际针对本人的行动${r.pendingWeakening.factor * 100}%（G），不追改之前动作、不复制或自动归还。`);
    }
    return { ...none(`继承破绽护身：${r.pendingWeakening ? '当前已有待用原赠物削弱' : !gift ? '没有实际持有的原木筹' : '不足3灵性'}，本槽36.45×原破绽掌握×身体（G），0灵性、不再给物或虚构新状态。`), enemyReduction: 36.45 * factor(r.source.weakPointMastery) * physical };
  }
  if (id === 'black-emperor.s4.bestow') {
    if (e.bestowReady) return none('本轮已有未用赠予：仅观察当前原人，0贡献、0消耗，不叠加或再次支付。');
    if (!pay(4)) return none('不足4灵性：普通观察原人，0贡献、0消耗，不透支或虚构消斗志。');
    e.bestowAttempts++;
    a.checkChance = computeCheckChance({ ability: 'knowledge', baseAbility: r.source.knowledge, difficulty: 18, modifiers: [] });
    a.checkRoll = random.nextInt(1, 100); a.resistedByComposure = e.composureReady; a.succeeded = a.checkRoll <= a.checkChance && !a.resistedByComposure;
    if (a.succeeded) e.bestowReady = true;
    return none(`赠予暂失斗志实付4灵性，知识18判定${a.checkRoll}/100、阈值${a.checkChance}；${a.resistedByComposure ? '原马洛本轮实际凝神抵抗，失败成本不退' : a.succeeded ? '仅待本轮下一次实际正贡献身体打击或弧光×0.55一次（G）' : '本次失败，成本不退'}。0即时贡献，只作用有独立心智的原活人，不赋予物品、死亡或法规，不取消行动或强制投降。`);
  }
  const pending = r.pendingWeakening;
  if (!pending || pending.extended || pending.remaining !== 1) return none('没有尚可延长的同一原赠物削弱：本槽0贡献、0消耗；已消耗、已延长或不存在的状态不能凭空重建。');
  if (!pay(3)) return none('不足3灵性：保留当前原赠物的一次待用削弱，0贡献、0消耗，不透支或延长。');
  pending.remaining = 2; pending.extended = true; a.giftId = pending.giftId; e.exploitUses++;
  return none(`利用实付3灵性，只将已经成立的原木筹${pending.giftId}削弱窗口从一次延至两次实际针对本人行动（G）。该原状态只延长一次、上限两次；原物仍在原地，不生成新礼物或额外行动，未用部分回合末到期。`);
}
export function resolveFallenEarlEnemyAbility(s: SliceState, planned: FallenEarlEnemyIntent, physicalStateFactor: number, _random: ActionRandomStream,
  r: FallenEarlRoundContext, source: FallenEarlCombatSource | null = r.source): FallenEarlCombatEffect {
  if (!validRound(s, r, source) || ![...FALLEN_EARL_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned)) return none('缺少同一原马洛的实际来源，0贡献、0消耗，不凭空施术、补灵性或重抽。');
  const e = s.fallenEarl.encounter, power = FALLEN_EARL_POWERS.find(p => p.id === planned), payable = !!power && e.enemySpirituality >= power.cost;
  const actual: FallenEarlEnemyIntent = planned === 'ACCIDENT' ? planned : payable ? planned : 'BODY_STRIKE';
  const physical = bounded(physicalStateFactor, 1), raw = actual === 'ACCIDENT' ? -22.5 : payable ? power!.selfGain : 18 * physical;
  if (payable) { e.enemySpirituality -= power!.cost; e.powerUses[power!.id]++; }
  if (actual === 'COMPOSE') { e.bestowReady = false; e.composureReady = true; }
  const attack = actual === 'BODY_STRIKE' || actual === 'ARC_BOLT', target = attack ? 'PLAYER' : 'SELF';
  const bestowApplied = attack && raw > 0 && e.bestowReady;
  if (bestowApplied) e.bestowReady = false;
  const pending = target === 'PLAYER' ? r.pendingWeakening : null;
  const weakeningGiftId = pending?.giftId ?? null, weakeningFactor = pending?.factor ?? 0;
  if (pending) { pending.remaining--; if (pending.remaining === 0) r.pendingWeakening = null; }
  const selfGain = raw * (bestowApplied ? .55 : 1) * (1 - weakeningFactor), enemyReduction = (payable ? power!.enemyReduction : 0) * (1 - weakeningFactor);
  const a: FallenEarlEnemyAction = { order: r.playerActions.length + r.enemyActions.length, planned, actual, paidCost: payable ? power!.cost : 0,
    physicalFactor: physical, target, bestowApplied, weakeningGiftId, weakeningFactor, selfGain, enemyReduction, threatens: attack && selfGain > 0,
    label: `${actual === 'ACCIDENT' ? '原马洛动作偏差固定−22.5、0灵性（G）' : actual === 'COMPOSE' ? `原马洛实际凝神、实付3灵性、余${e.enemySpirituality}/40，0贡献；解除未用赠予并仅至本轮末抵抗新K（G）` : payable ? `原马洛完成${power!.label}，实付${power!.cost}灵性、余${e.enemySpirituality}/40` : `${power ? '原法术灵性不足，实际回退' : ''}本人自有FE4-MARLOW-CLUB普通打击18×身体（G），0消耗`}${bestowApplied ? '；暂失斗志仅使本次实际正攻击×0.55后结束，原行动及法术成本保留' : ''}${pending ? `；原木筹${pending.giftId}削弱独立再乘${1 - weakeningFactor}，实际消耗一次，待用余${pending.remaining}；即使本次贡献为0也已使用` : ''}。不直接扣健康、不重抽。` };
  r.enemyActions.push(a); r.liveState = liveState(s);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
export interface FallenEarlRoundOutcome {
  targetId: typeof FALLEN_EARL_TARGET_ID; round: number; source: FallenEarlCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number;
  enemySpiritualityBefore: number; powerUses: Record<FallenEarlPowerId, number>; giftsAfter: BriberGift[];
  bestowAttempts: number; magnifyUses: number; exploitUses: number;
  bestowReady: false; composureReady: false; pendingWeakening: null;
  playerActions: FallenEarlPlayerAction[]; enemyActions: FallenEarlEnemyAction[];
}
export function finishFallenEarlCombatRound(s: SliceState, r: FallenEarlRoundContext, continuing = true): FallenEarlRoundOutcome {
  if (r.finished || s.combat?.encounterId !== 'FALLEN_EARL_DISPUTE' || s.combat.round !== r.source.round || r.liveState !== liveState(s)) throw new Error('同一原回合已经结束、不存在或实际资源被改写。');
  const e = s.fallenEarl.encounter, c = s.combat;
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus;
  e.enemyInjuries = c.enemyInjuries.map(i => ({ ...i })); e.enemyRisk = c.enemyRisk;
  e.bestowReady = false; e.composureReady = false; r.pendingWeakening = null; r.finished = true;
  return { targetId: FALLEN_EARL_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus,
    playerSpiritualityBefore: r.playerSpiritualityBefore, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind,
    enemySpiritualityBefore: r.enemySpiritualityBefore, powerUses: { ...e.powerUses }, giftsAfter: structuredClone(s.briber.gifts),
    bestowAttempts: e.bestowAttempts, magnifyUses: e.magnifyUses, exploitUses: e.exploitUses,
    bestowReady: false, composureReady: false, pendingWeakening: null, playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
}
export function projectFallenEarlCombat(s: SliceState) {
  const e = s.fallenEarl.encounter, gifts = s.briber.gifts;
  return { enemyName: '马洛·文恩（FE4-MARLOW-VENN，原创成年序列5对手，G）', targetId: e.targetId,
    enemySpirituality: e.enemySpirituality, powerUses: { ...e.powerUses }, bestowReady: e.bestowReady, composureReady: e.composureReady,
    bestowAttempts: e.bestowAttempts, magnifyUses: e.magnifyUses, exploitUses: e.exploitUses,
    gifts: { held: gifts.filter(g => g.location === 'PLAYER').length, given: gifts.filter(g => g.location === 'GIVEN').length,
      battleGround: gifts.filter(g => g.destination === ground).length, summary: '同一旧贿赂者原库存；实际给物离手后留在对应原地，不复制或自动返还。' },
    originalExit: true, pursuit: false, distanceMetres: 2, source: currentFallenEarlCombatSource(s),
    summary: `原马洛灵性${e.enemySpirituality}/40，原棍FE4-MARLOW-CLUB始终属本人。H付4灵性只放大本人当次实际击打，J保留原身体侧击；B实赠原木筹并付3灵性，R另付3灵性只把同一已成立的原赠物削弱一次延至两次（G）。K付4灵性、知识18可失败，成功只把附近原活人的下一次正身体或弧光削至55%；敌方3灵性凝神只本轮清除并抵抗赠予。所有短效当轮到期，费用不退、原物不回；原赠物与赠予可独立相乘，不取消行动、控制意志或自动致伤。放大/赠予/利用能力类别有原文来源，全部数值为G；完整配方与仪式未知，狂乱法师3未开放。`,
    enemyCountWheel: FALLEN_EARL_ENEMY_COUNT_WHEEL, enemyAbilityWheel: FALLEN_EARL_ENEMY_ABILITY_WHEEL };
}
/** Reconcile actual action order, the one original inventory and real finite costs. No second spendable gift store. */
export function validateFallenEarlRoundOutcome(v: unknown): v is FallenEarlRoundOutcome {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const p = v as FallenEarlRoundOutcome;
  const integer = (n: unknown, min: number, max = Number.MAX_SAFE_INTEGER): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
  const resource = (n: unknown, max = 120): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
  const usesValid = (u: Record<FallenEarlPowerId, number>) => u && typeof u === 'object' && Object.keys(u).length === 3 && FALLEN_EARL_POWER_IDS.every(id => integer(u[id], 0, 13));
  const a = p.source;
  if (!a || typeof a !== 'object' || a.targetId !== FALLEN_EARL_TARGET_ID || a.encounterId !== 'FALLEN_EARL_DISPUTE' || a.round !== p.round ||
      typeof a.runId !== 'string' || a.runId.length === 0 || !integer(a.revision, 0) || !integer(a.week, 1) || a.attemptWeek !== a.week || !integer(a.startHistoryIndex, 0) ||
      !integer(a.playerHealth, 1, 100) || !integer(a.playerMind, 1, 100) || !integer(a.enemyHealth, 1, 100) || !integer(a.enemyMind, 1, 100) || !integer(a.knowledge, 0, 500) ||
      !['SHOP', 'BAG', 'HAND'].includes(a.clubLocation) || a.actualOriginalBody !== true || a.mutuallyVisible !== true || a.distanceMetres !== 2 || a.noBystanders !== true ||
      a.ordinaryExit !== true || a.pursuit !== false || a.targetAlive !== true || a.independentMind !== true || a.targetSequence !== 5 || a.targetPhysique !== 20 ||
      a.enemyWeapon !== 'FE4-MARLOW-CLUB' || a.space !== 'ORIGINAL_CONTRACT_CLEAR_COURTYARD' ||
      ![a.bodyMastery, a.weakPointMastery, a.briberyMastery, a.magnifyMastery].every(n => resource(n, 500)) || !usesValid(a.powerUses) ||
      ![a.bestowAttempts, a.magnifyUses, a.exploitUses].every(n => integer(n, 0)) || !Array.isArray(a.gifts) ||
      a.gifts.some((g, i) => !g || g.id !== `BR7-GIFT-${i + 1}` || (g.location === 'PLAYER' ? g.destination !== null || g.givenWeek !== null
        : g.location !== 'GIVEN' || typeof g.destination !== 'string' || g.destination.length === 0 || !integer(g.givenWeek, 1, a.week)))) return false;
  if (p.targetId !== FALLEN_EARL_TARGET_ID || !integer(p.round, 1) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(p.stance) ||
      !integer(p.enemyHealth, 0, a.enemyHealth) || p.enemyMind !== a.enemyMind || !integer(p.enemySpirituality, 0, 40) || !integer(p.enemySpiritualityBefore, p.enemySpirituality, 40) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(p.enemyStatus) || (p.enemyStatus === 'DEAD') !== (p.enemyHealth === 0) ||
      !resource(p.playerSpiritualityBefore) || !resource(p.playerSpiritualityAfter) || p.playerSpiritualityAfter > p.playerSpiritualityBefore ||
      !integer(p.playerHealthAfter, 0, a.playerHealth) || p.playerMindAfter !== a.playerMind || !usesValid(p.powerUses) ||
      p.enemySpiritualityBefore !== 40 - FALLEN_EARL_POWERS.reduce((n, x) => n + a.powerUses[x.id] * x.cost, 0) ||
      p.enemySpirituality !== 40 - FALLEN_EARL_POWERS.reduce((n, x) => n + p.powerUses[x.id] * x.cost, 0) ||
      p.bestowReady !== false || p.composureReady !== false || p.pendingWeakening !== null || typeof p.continuing !== 'boolean' ||
      (p.continuing && (p.enemyStatus !== 'RESISTING' || p.playerHealthAfter <= 0)) || !Array.isArray(p.playerActions) || p.playerActions.length > 6 ||
      !Array.isArray(p.enemyActions) || p.enemyActions.length > 4 || (p.stance === 'RETREAT' && p.playerActions.length !== 0)) return false;
  const ordered = [...p.playerActions.map(x => ({ kind: 'PLAYER' as const, action: x })), ...p.enemyActions.map(x => ({ kind: 'ENEMY' as const, action: x }))];
  if (ordered.some(x => !x.action || !integer(x.action.order, 0, 9))) return false;
  ordered.sort((x, y) => x.action.order - y.action.order);
  let enemySpent = 0, playerSpent = 0, bestow = false, composure = false, bestowAttempts = a.bestowAttempts, magnifyUses = a.magnifyUses, exploitUses = a.exploitUses;
  let pending: PendingGift | null = null;
  const uses = { ...a.powerUses }, gifts = structuredClone(a.gifts);
  for (let index = 0; index < ordered.length; index++) {
    const entry = ordered[index]!, action = entry.action;
    if (action.order !== index || typeof action.label !== 'string' || !Number.isFinite(action.selfGain) || !resource(action.enemyReduction, 36.45) ||
        typeof action.threatens !== 'boolean' || !resource(action.physicalFactor, 1)) return false;
    if (entry.kind === 'PLAYER') {
      const x = entry.action, funds = p.playerSpiritualityBefore - playerSpent;
      if (!ABILITIES.some(m => m.id === x.id) || !integer(x.paidCost, 0, 4) || typeof x.resistedByComposure !== 'boolean' || typeof x.succeeded !== 'boolean' || typeof x.magnified !== 'boolean') return false;
      let cost = 0, gain = 0, reduction = 0, threat = false, succeeded = false, resisted = false, magnified = false, checked = false, giftId: string | null = null;
      if (x.id === 'ACCIDENT') gain = -22.5;
      if (x.id === 'black-emperor.s4.magnify') {
        magnified = funds >= 4; if (magnified) { cost = 4; magnifyUses++; }
        gain = (a.clubLocation === 'HAND' ? 16 : 59.15 * factor(a.bodyMastery)) * x.physicalFactor * (magnified ? 1 + .25 * factor(a.magnifyMastery) : 1); threat = gain > 0;
      }
      if (x.id === 'BODY_FOLLOWUP') { gain = 41.405 * factor(a.bodyMastery) * x.physicalFactor; threat = gain > 0; }
      if (x.id === 'black-emperor.s7.bribery-weakening') {
        const gift = gifts.find(g => g.location === 'PLAYER');
        if (!pending && gift && funds >= 3) {
          cost = 3; giftId = gift.id; gift.location = 'GIVEN'; gift.destination = ground; gift.givenWeek = a.week;
          pending = { giftId: gift.id, factor: .35 * factor(a.briberyMastery), remaining: 1, extended: false };
        } else reduction = 36.45 * factor(a.weakPointMastery) * x.physicalFactor;
      }
      if (x.id === 'black-emperor.s4.bestow' && !bestow && funds >= 4) {
        cost = 4; checked = true; bestowAttempts++;
        if (!integer(x.checkRoll, 1, 100) || x.checkChance !== computeCheckChance({ ability: 'knowledge', baseAbility: a.knowledge, difficulty: 18, modifiers: [] })) return false;
        resisted = composure; succeeded = x.checkRoll <= x.checkChance && !composure; if (succeeded) bestow = true;
      }
      if (x.id === 'black-emperor.s4.exploit' && pending && !pending.extended && pending.remaining === 1 && funds >= 3) {
        cost = 3; giftId = pending.giftId; pending.remaining = 2; pending.extended = true; exploitUses++;
      }
      if (!checked && (x.checkChance !== null || x.checkRoll !== null)) return false;
      if (x.paidCost !== cost || x.giftId !== giftId || x.magnified !== magnified || x.selfGain !== gain || x.enemyReduction !== reduction || x.threatens !== threat || x.succeeded !== succeeded || x.resistedByComposure !== resisted) return false;
      playerSpent += cost;
    } else {
      const x = entry.action, power = FALLEN_EARL_POWERS.find(q => q.id === x.planned), payable = !!power && p.enemySpiritualityBefore - enemySpent >= power.cost;
      const actual = x.planned === 'ACCIDENT' ? x.planned : payable ? x.planned : 'BODY_STRIKE';
      if (![...FALLEN_EARL_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(x.planned) || typeof x.bestowApplied !== 'boolean' || x.actual !== actual || x.paidCost !== (payable ? power!.cost : 0)) return false;
      const raw = actual === 'ACCIDENT' ? -22.5 : payable ? power!.selfGain : 18 * x.physicalFactor, attack = actual === 'BODY_STRIKE' || actual === 'ARC_BOLT';
      if (actual === 'COMPOSE') { composure = true; bestow = false; }
      const applied = attack && raw > 0 && bestow, weak = attack ? pending : null;
      if (x.target !== (attack ? 'PLAYER' : 'SELF') || x.bestowApplied !== applied || x.weakeningGiftId !== (weak?.giftId ?? null) || x.weakeningFactor !== (weak?.factor ?? 0) ||
          x.selfGain !== raw * (applied ? .55 : 1) * (1 - (weak?.factor ?? 0)) || x.enemyReduction !== (payable ? power!.enemyReduction : 0) * (1 - (weak?.factor ?? 0)) || x.threatens !== (attack && x.selfGain > 0)) return false;
      if (applied) bestow = false;
      if (weak) { weak.remaining--; if (weak.remaining === 0) pending = null; }
      if (payable) uses[power!.id]++; enemySpent += x.paidCost;
    }
  }
  return p.enemySpiritualityBefore - enemySpent === p.enemySpirituality && p.playerSpiritualityBefore - playerSpent === p.playerSpiritualityAfter &&
    p.bestowAttempts === bestowAttempts && p.magnifyUses === magnifyUses && p.exploitUses === exploitUses &&
    stableStringify(gifts) === stableStringify(p.giftsAfter) && stableStringify(uses) === stableStringify(p.powerUses);
}
