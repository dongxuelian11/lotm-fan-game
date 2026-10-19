import { publicPryerFields as publicFields } from '../sage/life.js';
import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { DESIRE_APOSTLE_COUNT_WHEEL, desireApostleActionCount } from '../desire-apostle/combat.js';
import { DEVIL_TARGET_ID, DEVIL_POWERS, DEVIL_POWER_IDS, hasDevilDisputeOpponent,
  type DevilEnemyIntent, type DevilPowerId } from './encounter.js';

/** Explicit G strengthening of inherited techniques, not a verified complete canonical S4 skill list. */
export const DEVIL_COUNT_WHEEL = DESIRE_APOSTLE_COUNT_WHEEL;
export const devilActionCount = desireApostleActionCount;
export const DEVIL_ENEMY_COUNT_WHEEL: readonly SliceWheelEntry[] = [
  { id: '2', label: '2次', weight: 20 }, { id: '3', label: '3次', weight: 50 }, { id: '4', label: '4次', weight: 30 },
];
export const devilEnemyActionCount = (roll: number): number => roll <= 20 ? 2 : roll <= 70 ? 3 : 4;
export const DEVIL_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '原弧光术：5灵性，贡献55（G）', weight: 35 },
  { id: 'WARD', label: '原小型护术：3灵性，对方−30（G）', weight: 25 },
  { id: 'BODY_STRIKE', label: '自有原棍普通打击：18×身体（G）', weight: 25 },
  { id: 'COMPOSE', label: '实际稳住情绪：8贡献、永久平复本场情绪（G）', weight: 10 },
  { id: 'ACCIDENT', label: '实际失衡：0贡献，不恢复灵性', weight: 5 },
];
export type DevilMoveId = 'abyss.s6.flame-hex' | 'BODY_FOLLOWUP' | 'abyss.s6.demonic-body'
  | 'abyss.s4.desire-focus' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly { id: DevilMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'abyss.s6.flame-hex', label: '继承有限火焰术（H；3灵性、1旧负荷；持原短棍则普通16替换）', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承身体次击（J；29.575×旧恶魔身体掌握×身体；0消耗，G）', weight: 15, stance: 'ATTACK' },
  { id: 'abyss.s6.demonic-body', label: '继承本槽硬皮抵挡（B；2灵性、1旧负荷；不足时普通格挡，G）', weight: 20, stance: 'DEFEND' },
  { id: 'abyss.s4.desire-focus', label: 'G强化欲望聚焦／催化压迫训练（K；强烈情绪下4灵性埋种，后续3灵性催化；知识18）', weight: 20, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '观察当前公开情绪、原种子与旧负荷（R；0灵性、0贡献）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差（A；固定−22.5，G）', weight: 5, stance: null },
];
export const isDevil = (s: SliceState): boolean => s.progression.pathwayId === 'abyss' && s.progression.sequence === 4;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function devilAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0), e = s.devil.encounter;
  return ABILITIES.map((a, i) => ({ id: a.id, weight: weights[i]! / total * 100,
    label: a.id === 'abyss.s6.flame-hex' && s.town.clubLocation === 'HAND' ? '持握本人原短棍（H；普通16×身体替换火焰术，0灵性、不增负荷）'
      : a.id === 'abyss.s4.desire-focus' && e.emotion === 'CALM' ? '原奥里克已经实际平复：K无情绪入口，普通观察0贡献、0灵性'
      : a.id === 'abyss.s4.desire-focus' && e.seedPlanted ? '催化同一已付原种子（K；当前强烈情绪、3灵性知识18；下一正身体或弧光贡献减半，仅本轮）' : a.label }));
}
export function drawDevilAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): DevilMoveId {
  const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (let i = 0; i < ABILITIES.length; i++) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('魔鬼动作盘权重无效。');
}
export function drawDevilEnemyAbility(random: ActionRandomStream): DevilEnemyIntent {
  let roll = random.nextInt(1, 100);
  for (const a of DEVIL_ENEMY_ABILITY_WHEEL) { roll -= a.weight; if (roll <= 0) return a.id as DevilEnemyIntent; }
  throw new Error('原奥里克动作盘权重无效。');
}
const bounded = (n: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));
const masteryFactor = (n: number) => .65 + .35 * bounded(n, 500) / 500;
const mastery = (s: SliceState, id: string) => bounded(s.progression.mastery[id] ?? 0, 500);
export interface DevilCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'DEVIL_DISPUTE'; targetId: typeof DEVIL_TARGET_ID; attemptWeek: number; startHistoryIndex: number;
  playerHealth: number; playerMind: number; enemyHealth: number; enemyMind: number; knowledge: number;
  clubLocation: SliceState['town']['clubLocation']; actualOriginalBody: true; mutuallyVisible: true;
  distanceMetres: 4; noBystanders: true; friendImmunity: false; ordinaryExit: true; pursuit: false;
  targetSequence: 5; targetPhysique: 20; enemyWeapon: 'DV4-ORRICK-CLUB'; space: 'ORIGINAL_DEVIL_EMPTY_ANNEX';
  emotion: 'STRONG' | 'CALM'; seedPlanted: boolean; lastSeedRound: number | null;
  seedAttempts: number; catalysisAttempts: number; composeUses: number;
  strain: number; flameMastery: number; bodyMastery: number;
  powerUses: Record<DevilPowerId, number>;
}
export function currentDevilCombatSource(s: SliceState): DevilCombatSource | null {
  if (!hasDevilDisputeOpponent(s) || !Number.isSafeInteger(s.demon.strain) || s.demon.strain < 0 || s.demon.strain > 3) return null;
  const e = s.devil.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'DEVIL_DISPUTE', targetId: DEVIL_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, playerHealth: s.health, playerMind: s.mind,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, knowledge: s.character.coreStats.knowledge, clubLocation: s.town.clubLocation,
    actualOriginalBody: true, mutuallyVisible: true, distanceMetres: 4, noBystanders: true, friendImmunity: false, ordinaryExit: true, pursuit: false,
    targetSequence: 5, targetPhysique: 20, enemyWeapon: 'DV4-ORRICK-CLUB', space: 'ORIGINAL_DEVIL_EMPTY_ANNEX',
    emotion: e.emotion, seedPlanted: e.seedPlanted, lastSeedRound: e.lastSeedRound, seedAttempts: e.seedAttempts,
    catalysisAttempts: e.catalysisAttempts, composeUses: e.composeUses, strain: s.demon.strain,
    flameMastery: mastery(s, 'abyss.s6.flame-hex'), bodyMastery: mastery(s, 'abyss.s6.demonic-body'), powerUses: { ...e.powerUses } };
}
export interface DevilCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
export interface DevilPlayerAction extends DevilCombatEffect {
  order: number; id: DevilMoveId; paidCost: number; strainCost: number; physicalFactor: number;
  checkChance: number | null; checkRoll: number | null; seedAttempted: boolean; catalysisAttempted: boolean; succeeded: boolean;
}
export interface DevilEnemyAction extends DevilCombatEffect {
  order: number; planned: DevilEnemyIntent; actual: DevilEnemyIntent; paidCost: number;
  physicalFactor: number; staggerApplied: boolean;
}
export interface DevilRoundContext {
  source: DevilCombatSource; stance: SliceStance; finished: boolean; liveState: string;
  playerSpiritualityBefore: number; enemySpiritualityBefore: number;
  playerActions: DevilPlayerAction[]; enemyActions: DevilEnemyAction[]; label: string;
}
const none = (label: string): DevilCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
const dynamicSource = new Set(['emotion', 'seedPlanted', 'lastSeedRound', 'seedAttempts', 'catalysisAttempts', 'composeUses', 'strain', 'powerUses']);
function liveState(s: SliceState): string {
  const e = s.devil.encounter;
  return stableStringify({ spirituality: s.spirituality, strain: s.demon.strain, enemySpirituality: e.enemySpirituality,
    emotion: e.emotion, seedPlanted: e.seedPlanted, lastSeedRound: e.lastSeedRound, staggerReady: e.staggerReady,
    seedAttempts: e.seedAttempts, catalysisAttempts: e.catalysisAttempts, composeUses: e.composeUses, powerUses: e.powerUses });
}
function validRound(s: SliceState, r: DevilRoundContext, source: DevilCombatSource | null): boolean {
  const current = currentDevilCombatSource(s);
  return !r.finished && current !== null && source !== null && stableStringify(source) === stableStringify(r.source) &&
    Object.entries(r.source).every(([k, v]) => dynamicSource.has(k) || stableStringify(current[k as keyof DevilCombatSource]) === stableStringify(v)) &&
    r.liveState === liveState(s);
}
export function beginDevilCombatRound(s: SliceState, stance: SliceStance): DevilRoundContext {
  const source = currentDevilCombatSource(s); if (!source || s.devil.encounter.staggerReady) throw new Error('缺少魔鬼当前原奥里克、实际情绪或连续回合来源。');
  return { source, stance, finished: false, liveState: liveState(s), playerSpiritualityBefore: s.spirituality,
    enemySpiritualityBefore: s.devil.encounter.enemySpirituality, playerActions: [], enemyActions: [],
    label: `同一原奥里克在净空附院4米外，灵性${s.devil.encounter.enemySpirituality}/40，当前${source.emotion === 'STRONG' ? '因原钥匙争议明显愤怒' : '已实际平复，本场不重新愤怒'}。` };
}
export function resolveDevilCombatAbility(s: SliceState, id: DevilMoveId, physicalStateFactor: number, random: ActionRandomStream,
  r: DevilRoundContext, source: DevilCombatSource | null = r.source): DevilCombatEffect {
  if (!validRound(s, r, source) || !ABILITIES.some(a => a.id === id)) return none('缺少本回合同一原奥里克与实际已付资源来源，0贡献、0消耗，不重抽。');
  const a: DevilPlayerAction = { ...none(''), order: r.playerActions.length + r.enemyActions.length, id, paidCost: 0, strainCost: 0,
    physicalFactor: bounded(physicalStateFactor, 1), checkChance: null, checkRoll: null, seedAttempted: false, catalysisAttempted: false, succeeded: false };
  Object.assign(a, resolvePlayer(s, id, a.physicalFactor, random, a)); r.playerActions.push(a); r.liveState = liveState(s);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
function resolvePlayer(s: SliceState, id: DevilMoveId, physical: number, random: ActionRandomStream, a: DevilPlayerAction): DevilCombatEffect {
  const e = s.devil.encounter, canPay = (n: number) => Number.isFinite(s.spirituality) && s.spirituality >= n;
  const pay = (n: number) => { s.spirituality -= n; a.paidCost = n; };
  const demonPay = (n: number) => {
    if (s.demon.strain >= 3 || !canPay(n)) return false;
    pay(n); s.demon.strain++; a.strainCost = 1; return true;
  };
  if (id === 'ACCIDENT') return { ...none('本次动作偏差固定−22.5（G），0灵性、不增旧负荷，不另掷正负。'), selfGain: -22.5 };
  if (id === 'BODY_FOLLOWUP') {
    const selfGain = 29.575 * masteryFactor(mastery(s, 'abyss.s6.demonic-body')) * physical;
    return { label: '继承本人身体次击29.575×旧恶魔身体掌握×身体（G），独立占本槽，0灵性、不增负荷。', selfGain, enemyReduction: 0, threatens: selfGain > 0 };
  }
  if (id === 'abyss.s6.flame-hex') {
    if (s.town.clubLocation === 'HAND') {
      const selfGain = 16 * physical;
      return { label: '持握本人原短棍，普通16×身体替换本槽火焰术（G）；0灵性、不增负荷，不取敌人的原棍或附赠火焰。', selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    if (demonPay(3)) {
      const selfGain = 54.925 * masteryFactor(mastery(s, id));
      return { label: `继承有限火焰术实付3灵性与1旧负荷，原负荷现${s.demon.strain}/3；54.925×旧火焰掌握（G）。只提供本槽战势与致伤威胁，不直接扣健康、制造持续火焰或保证死亡。`, selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    const selfGain = 12 * physical;
    return { label: '不足3灵性或旧负荷已达3，普通身体12×身体（G），0消耗；不透支、不清除原负荷。', selfGain, enemyReduction: 0, threatens: selfGain > 0 };
  }
  if (id === 'abyss.s6.demonic-body') {
    if (demonPay(2)) return { ...none(`继承本槽有限硬皮实付2灵性与1旧负荷，原负荷现${s.demon.strain}/3；50.7×旧恶魔身体掌握×身体（G），不治疗、抹旧伤或清风险。`), enemyReduction: 50.7 * masteryFactor(mastery(s, id)) * physical };
    return { ...none('不足2灵性或旧负荷已达3，普通格挡10×身体（G），0消耗，旧负荷和伤势不变。'), enemyReduction: 10 * physical };
  }
  if (id === 'abyss.s4.desire-focus') {
    if (e.emotion !== 'STRONG') return none('原奥里克当前已经实际平复，缺少强烈情绪入口；普通观察0贡献、0灵性，不强制重新激怒。');
    if (e.staggerReady) return none('同一已成功催化的有限迟疑尚待本轮下一正身体或弧光攻击，不叠加、不重付费用。');
    const catalyzing = e.seedPlanted;
    if (!catalyzing && e.lastSeedRound === s.combat!.round) return none('本轮已实际尝试原种子，不在同轮消费后重埋或重试；普通观察0贡献、0灵性。');
    const cost = catalyzing ? 3 : 4;
    if (!canPay(cost)) return none(`本次${catalyzing ? '催化' : '埋种'}不足${cost}灵性，普通观察0贡献、0消耗，不生成种子或效果。`);
    pay(cost); a.checkChance = computeCheckChance({ ability: 'knowledge', baseAbility: s.character.coreStats.knowledge, difficulty: 18, modifiers: [] });
    a.checkRoll = random.nextInt(1, 100); a.succeeded = a.checkRoll <= a.checkChance;
    if (catalyzing) {
      a.catalysisAttempted = true; e.catalysisAttempts++; e.seedPlanted = false; e.staggerReady = a.succeeded;
      return none(`G催化压迫训练实付3灵性，对同一仍激动原人进行知识18对抗${a.checkRoll}/100、阈值${a.checkChance}。原种子已经消费；${a.succeeded ? '有限迟疑只使本轮下一次正贡献BODY_STRIKE或ARC_BOLT×0.5一次，原法术仍须实际执行并付费' : '原人实际抵抗成功，无迟疑效果，费用不退'}。不影响WARD、不立即伤害、不取消所有动作或强迫服从。`);
    }
    a.seedAttempted = true; e.seedAttempts++; e.lastSeedRound = s.combat!.round; e.seedPlanted = a.succeeded;
    return none(`G欲望聚焦训练实付4灵性，利用同一原人的现场强烈情绪进行知识18对抗${a.checkRoll}/100、阈值${a.checkChance}。${a.succeeded ? '仅种下本场原种子，0即时贡献，窗口为埋种轮及后两轮；后续催化另付3灵性且当时仍须强烈情绪' : '被实际抵抗，未种下种子，0贡献，费用不退'}；不冒充完整原著4级技能。`);
  }
  return none(`普通观察当前公开状态：原奥里克${e.emotion === 'STRONG' ? '仍明确表达钥匙争议中的愤怒' : '已实际平复'}；原种子${e.seedPlanted ? `仍在第${e.lastSeedRound}轮起的三轮窗口` : '不存在'}；旧恶魔负荷${s.demon.strain}/3。0灵性、0贡献，不读隐秘思想、不制造情绪、资源或危险预感。`);
}
export function resolveDevilEnemyAbility(s: SliceState, planned: DevilEnemyIntent, physicalStateFactor: number, _random: ActionRandomStream,
  r: DevilRoundContext, source: DevilCombatSource | null = r.source): DevilCombatEffect {
  if (!validRound(s, r, source) || ![...DEVIL_POWER_IDS, 'BODY_STRIKE', 'COMPOSE', 'ACCIDENT'].includes(planned)) return none('缺少本回合同一原奥里克来源，原敌不凭空施术或补灵性。');
  const e = s.devil.encounter, power = DEVIL_POWERS.find(p => p.id === planned), payable = !!power && e.enemySpirituality >= power.cost;
  const actual: DevilEnemyIntent = planned === 'ACCIDENT' || planned === 'COMPOSE' ? planned : payable ? planned : 'BODY_STRIKE';
  const physical = bounded(physicalStateFactor, 1), rawGain = actual === 'ACCIDENT' ? 0 : actual === 'COMPOSE' ? 8 : payable ? power!.selfGain : 18 * physical;
  if (payable) { e.enemySpirituality -= power!.cost; e.powerUses[power!.id]++; }
  if (actual === 'COMPOSE') { e.emotion = 'CALM'; e.seedPlanted = false; e.composeUses++; }
  const staggerApplied = (actual === 'BODY_STRIKE' || actual === 'ARC_BOLT') && rawGain > 0 && e.staggerReady;
  if (staggerApplied) e.staggerReady = false;
  const selfGain = rawGain * (staggerApplied ? .5 : 1), enemyReduction = payable ? power!.enemyReduction : 0;
  const a: DevilEnemyAction = { order: r.playerActions.length + r.enemyActions.length, planned, actual, paidCost: payable ? power!.cost : 0,
    physicalFactor: physical, staggerApplied, selfGain, enemyReduction, threatens: (actual === 'BODY_STRIKE' || actual === 'ARC_BOLT') && selfGain > 0,
    label: `${actual === 'ACCIDENT' ? '原奥里克动作失衡，0贡献、0费用' : actual === 'COMPOSE' ? '原奥里克实际放缓呼吸并明确说自己先冷静；COMPOSE仍完成普通8战势，本場永久CALM、原种子失效，0灵性' : payable ? `同一原奥里克完成${power!.label}，实付${power!.cost}灵性，余${e.enemySpirituality}/40` : `${power ? '原法术灵性不足，回退' : ''}自有原棍普通打击18×身体（G），0费用`}${staggerApplied ? '；已付有限催化只使本次正攻击战势×0.5并结束，实付法术成本不退' : ''}。不凭空扣健康、不取消原行动，不重新激怒原人。` };
  r.enemyActions.push(a); r.liveState = liveState(s);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
export interface DevilRoundOutcome {
  targetId: typeof DEVIL_TARGET_ID; round: number; source: DevilCombatSource; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number;
  playerStrainAfter: number; enemySpiritualityBefore: number; powerUses: Record<DevilPowerId, number>;
  emotion: 'STRONG' | 'CALM'; seedPlanted: boolean; lastSeedRound: number | null; staggerReady: false;
  seedAttempts: number; catalysisAttempts: number; composeUses: number;
  playerActions: DevilPlayerAction[]; enemyActions: DevilEnemyAction[];
}
export function finishDevilCombatRound(s: SliceState, r: DevilRoundContext, continuing = true): DevilRoundOutcome {
  if (r.finished || s.combat?.encounterId !== 'DEVIL_DISPUTE' || s.combat.round !== r.source.round || r.liveState !== liveState(s)) throw new Error('同一原回合已结束、不存在或资源被改写。');
  const e = s.devil.encounter, c = s.combat;
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus;
  e.enemyInjuries = c.enemyInjuries.map(i => ({ ...i })); e.enemyRisk = c.enemyRisk;
  e.staggerReady = false;
  if (!continuing || (e.seedPlanted && (e.lastSeedRound === null || c.round >= e.lastSeedRound + 2))) e.seedPlanted = false;
  r.finished = true;
  return { targetId: DEVIL_TARGET_ID, round: c.round, source: structuredClone(r.source), continuing, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, playerSpiritualityBefore: r.playerSpiritualityBefore,
    playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind, playerStrainAfter: s.demon.strain,
    enemySpiritualityBefore: r.enemySpiritualityBefore, powerUses: { ...e.powerUses }, emotion: e.emotion, seedPlanted: e.seedPlanted,
    lastSeedRound: e.lastSeedRound, staggerReady: false, seedAttempts: e.seedAttempts, catalysisAttempts: e.catalysisAttempts, composeUses: e.composeUses,
    playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
}
/** Settled combat facts only; the original replay source remains private. */
export function projectDevilRoundOutcome(o: DevilRoundOutcome) { return {
  ...publicFields(o, ['targetId', 'round', 'continuing', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'playerSpiritualityBefore', 'playerSpiritualityAfter', 'playerHealthAfter', 'playerMindAfter', 'playerStrainAfter', 'enemySpiritualityBefore', 'emotion', 'seedPlanted', 'lastSeedRound', 'staggerReady', 'seedAttempts', 'catalysisAttempts', 'composeUses']),
  powerUses: publicFields(o.powerUses, ['ARC_BOLT', 'WARD']),
  playerActions: o.playerActions.map(a => publicFields(a, ['label', 'selfGain', 'enemyReduction', 'threatens', 'order', 'id', 'paidCost', 'strainCost', 'physicalFactor', 'checkChance', 'checkRoll', 'seedAttempted', 'catalysisAttempted', 'succeeded'])),
  enemyActions: o.enemyActions.map(a => publicFields(a, ['label', 'selfGain', 'enemyReduction', 'threatens', 'order', 'planned', 'actual', 'paidCost', 'physicalFactor', 'staggerApplied'])),
}; }
export type DevilPublicRoundOutcome = ReturnType<typeof projectDevilRoundOutcome>;
export function projectDevilCombat(s: SliceState) {
  const e = s.devil.encounter;
  return { enemyName: '奥里克·费恩（DV4-ORRICK-FANE，原创成年序列5对手，G）', targetId: e.targetId,
    enemySpirituality: e.enemySpirituality, powerUses: { ...e.powerUses }, emotion: e.emotion, seedPlanted: e.seedPlanted,
    lastSeedRound: e.lastSeedRound, staggerReady: e.staggerReady, seedAttempts: e.seedAttempts, catalysisAttempts: e.catalysisAttempts,
    composeUses: e.composeUses, strain: s.demon.strain, originalExit: true, pursuit: false, distanceMetres: 4,
    summary: `原奥里克灵性${e.enemySpirituality}/40，当前${e.emotion === 'STRONG' ? '强烈情绪' : '已平复，本场不自动重新愤怒'}；原种子${e.seedPlanted ? `第${e.lastSeedRound}轮埋入、至第${e.lastSeedRound! + 2}轮末` : '无'}。本人旧恶魔负荷${s.demon.strain}/3。4灵性埋种、后续3灵性催化均可被知识18对抗抵抗；有限迟疑只减半下一实际正身体或弧光战势，不影响WARD，不直接扣健康。新4命名与强化规则为G，完整原著4级技能仍未知。`,
    enemyCountWheel: DEVIL_ENEMY_COUNT_WHEEL, enemyAbilityWheel: DEVIL_ENEMY_ABILITY_WHEEL };
}
/** Replay the recorded, paid action order to reject fabricated seeds, re-anger, free spells or strain resets. */
export function validateDevilRoundOutcome(v: unknown): v is DevilRoundOutcome {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const p = v as DevilRoundOutcome;
  const integer = (n: unknown, min: number, max = Number.MAX_SAFE_INTEGER): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
  const resource = (n: unknown, max = 120): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
  const usesValid = (u: Record<DevilPowerId, number>) => u && typeof u === 'object' && Object.keys(u).length === 2 && DEVIL_POWER_IDS.every(id => integer(u[id], 0, 13));
  const a = p.source;
  if (!a || typeof a !== 'object' || a.targetId !== DEVIL_TARGET_ID || a.encounterId !== 'DEVIL_DISPUTE' || a.round !== p.round ||
      typeof a.runId !== 'string' || a.runId.length === 0 || !integer(a.revision, 0) || !integer(a.week, 1) || a.attemptWeek !== a.week || !integer(a.startHistoryIndex, 0) ||
      !integer(a.playerHealth, 1, 100) || !integer(a.playerMind, 1, 100) || !integer(a.enemyHealth, 1, 100) || !integer(a.enemyMind, 1, 100) || !integer(a.knowledge, 0, 500) ||
      !['SHOP', 'BAG', 'HAND'].includes(a.clubLocation) || a.actualOriginalBody !== true || a.mutuallyVisible !== true || a.distanceMetres !== 4 || a.noBystanders !== true || a.friendImmunity !== false ||
      a.ordinaryExit !== true || a.pursuit !== false || a.targetSequence !== 5 || a.targetPhysique !== 20 || a.enemyWeapon !== 'DV4-ORRICK-CLUB' || a.space !== 'ORIGINAL_DEVIL_EMPTY_ANNEX' ||
      !resource(a.flameMastery, 500) || !resource(a.bodyMastery, 500) || !integer(a.strain, 0, 3) || !usesValid(a.powerUses) ||
      !['STRONG', 'CALM'].includes(a.emotion) || typeof a.seedPlanted !== 'boolean' ||
      !integer(a.seedAttempts, 0) || !integer(a.catalysisAttempts, 0, a.seedAttempts) || !integer(a.composeUses, 0) ||
      (a.lastSeedRound === null ? a.seedPlanted || a.seedAttempts !== 0 : !integer(a.lastSeedRound, 1, a.round) || a.seedAttempts === 0) ||
      (a.emotion === 'CALM' ? a.seedPlanted || a.composeUses === 0 : a.composeUses !== 0) ||
      (a.seedPlanted && a.round > a.lastSeedRound! + 2)) return false;
  if (p.targetId !== DEVIL_TARGET_ID || !integer(p.round, 1) || !integer(p.enemyHealth, 0, a.enemyHealth) || p.enemyMind !== a.enemyMind ||
      !integer(p.enemySpirituality, 0, 40) || !integer(p.enemySpiritualityBefore, p.enemySpirituality, 40) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(p.enemyStatus) || (p.enemyStatus === 'DEAD') !== (p.enemyHealth === 0) ||
      !resource(p.playerSpiritualityBefore) || !resource(p.playerSpiritualityAfter) || p.playerSpiritualityAfter > p.playerSpiritualityBefore ||
      !integer(p.playerHealthAfter, 0, a.playerHealth) || p.playerMindAfter !== a.playerMind || !integer(p.playerStrainAfter, a.strain, 3) ||
      !usesValid(p.powerUses) || p.enemySpiritualityBefore !== 40 - DEVIL_POWERS.reduce((n, x) => n + a.powerUses[x.id] * x.cost, 0) ||
      p.enemySpirituality !== 40 - DEVIL_POWERS.reduce((n, x) => n + p.powerUses[x.id] * x.cost, 0) ||
      p.staggerReady !== false || typeof p.continuing !== 'boolean' || (p.continuing && (p.enemyStatus !== 'RESISTING' || p.playerHealthAfter <= 0)) ||
      !Array.isArray(p.playerActions) || p.playerActions.length > 6 || !Array.isArray(p.enemyActions) || p.enemyActions.length > 4) return false;
  const ordered = [...p.playerActions.map(x => ({ kind: 'PLAYER' as const, action: x })), ...p.enemyActions.map(x => ({ kind: 'ENEMY' as const, action: x }))];
  if (ordered.some(x => !x.action || !integer(x.action.order, 0, 9))) return false;
  ordered.sort((x, y) => x.action.order - y.action.order);
  let enemySpent = 0, playerSpent = 0, strain = a.strain, emotion = a.emotion, seed = a.seedPlanted, lastSeed = a.lastSeedRound;
  let seedAttempts = a.seedAttempts, catalysisAttempts = a.catalysisAttempts, composeUses = a.composeUses, stagger = false;
  const uses = { ...a.powerUses };
  for (let index = 0; index < ordered.length; index++) {
    const entry = ordered[index]!, x = entry.action;
    if (x.order !== index || typeof x.label !== 'string' || !Number.isFinite(x.selfGain) || !resource(x.enemyReduction, 50.7) ||
        typeof x.threatens !== 'boolean' || !resource(x.physicalFactor, 1)) return false;
    if (entry.kind === 'PLAYER') {
      const x = entry.action;
      if (!ABILITIES.some(m => m.id === x.id) || !integer(x.paidCost, 0, 4) || !integer(x.strainCost, 0, 1) ||
          typeof x.seedAttempted !== 'boolean' || typeof x.catalysisAttempted !== 'boolean' || typeof x.succeeded !== 'boolean') return false;
      const funds = p.playerSpiritualityBefore - playerSpent;
      let cost = 0, strainCost = 0, gain = 0, reduction = 0, threat = false, seedAttempted = false, catalysisAttempted = false, succeeded = false;
      if (x.id === 'ACCIDENT') gain = -22.5;
      if (x.id === 'BODY_FOLLOWUP') { gain = 29.575 * masteryFactor(a.bodyMastery) * x.physicalFactor; threat = gain > 0; }
      if (x.id === 'abyss.s6.flame-hex') {
        if (a.clubLocation === 'HAND') gain = 16 * x.physicalFactor;
        else if (strain < 3 && funds >= 3) { cost = 3; strainCost = 1; gain = 54.925 * masteryFactor(a.flameMastery); }
        else gain = 12 * x.physicalFactor;
        threat = gain > 0;
      }
      if (x.id === 'abyss.s6.demonic-body') {
        if (strain < 3 && funds >= 2) { cost = 2; strainCost = 1; reduction = 50.7 * masteryFactor(a.bodyMastery) * x.physicalFactor; }
        else reduction = 10 * x.physicalFactor;
      }
      if (x.id === 'abyss.s4.desire-focus' && emotion === 'STRONG' && !stagger && (seed || lastSeed !== p.round) && funds >= (seed ? 3 : 4)) {
        cost = seed ? 3 : 4;
        if (!integer(x.checkRoll, 1, 100) || x.checkChance !== computeCheckChance({ ability: 'knowledge', baseAbility: a.knowledge, difficulty: 18, modifiers: [] })) return false;
        succeeded = x.checkRoll <= x.checkChance;
        if (seed) { catalysisAttempted = true; catalysisAttempts++; seed = false; stagger = succeeded; }
        else { seedAttempted = true; seedAttempts++; lastSeed = p.round; seed = succeeded; }
      } else if (x.checkChance !== null || x.checkRoll !== null || x.succeeded) return false;
      if (x.paidCost !== cost || x.strainCost !== strainCost || x.selfGain !== gain || x.enemyReduction !== reduction || x.threatens !== threat ||
          x.seedAttempted !== seedAttempted || x.catalysisAttempted !== catalysisAttempted || x.succeeded !== succeeded) return false;
      playerSpent += cost; strain += strainCost;
    } else {
      const x = entry.action, power = DEVIL_POWERS.find(q => q.id === x.planned), payable = !!power && p.enemySpiritualityBefore - enemySpent >= power.cost;
      const actual = x.planned === 'ACCIDENT' || x.planned === 'COMPOSE' ? x.planned : payable ? x.planned : 'BODY_STRIKE';
      if (![...DEVIL_POWER_IDS, 'BODY_STRIKE', 'COMPOSE', 'ACCIDENT'].includes(x.planned) || typeof x.staggerApplied !== 'boolean' ||
          x.actual !== actual || x.paidCost !== (payable ? power!.cost : 0)) return false;
      const raw = actual === 'ACCIDENT' ? 0 : actual === 'COMPOSE' ? 8 : payable ? power!.selfGain : 18 * x.physicalFactor;
      const attack = actual === 'BODY_STRIKE' || actual === 'ARC_BOLT';
      if (x.staggerApplied !== (attack && raw > 0 && stagger) || x.selfGain !== raw * (x.staggerApplied ? .5 : 1) ||
          x.enemyReduction !== (payable ? power!.enemyReduction : 0) || x.threatens !== (attack && x.selfGain > 0)) return false;
      if (x.staggerApplied) stagger = false;
      if (actual === 'COMPOSE') { emotion = 'CALM'; seed = false; composeUses++; }
      if (payable) uses[power!.id]++;
      enemySpent += x.paidCost;
    }
  }
  if (!p.continuing || (seed && (lastSeed === null || p.round >= lastSeed + 2))) seed = false;
  return p.enemySpiritualityBefore - enemySpent === p.enemySpirituality && p.playerSpiritualityBefore - playerSpent === p.playerSpiritualityAfter &&
    p.playerStrainAfter === strain && p.emotion === emotion && p.seedPlanted === seed && p.lastSeedRound === lastSeed &&
    p.seedAttempts === seedAttempts && p.catalysisAttempts === catalysisAttempts && p.composeUses === composeUses && stableStringify(uses) === stableStringify(p.powerUses);
}
