import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import type { LuckyPassiveLuck } from '../lucky/combat.js';
import type { SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { WINNER_COUNT_WHEEL, winnerActionCount } from '../winner/combat.js';
import type { WinnerLuckPolicy } from '../winner/types.js';
import { advanceChaosWalkerLifeClock } from './life.js';
import { CHAOS_WALKER_TARGET_ID, CHAOS_WALKER_POWERS, CHAOS_WALKER_POWER_IDS, hasChaosWalkerDisputeOpponent,
  type ChaosWalkerEnemyIntent, type ChaosWalkerPowerId, type ChaosWalkerEncounterScene, type ChaosWalkerPendingKind } from './encounter.js';

/** All new S3 mapping, abilities and finite numbers are G candidates, not novel-verified formulae. */
export const CHAOS_WALKER_COUNT_WHEEL = WINNER_COUNT_WHEEL;
export const CHAOS_WALKER_ENEMY_COUNT_WHEEL = WINNER_COUNT_WHEEL;
export const chaosWalkerActionCount = winnerActionCount;
export const chaosWalkerEnemyActionCount = winnerActionCount;
export const CHAOS_WALKER_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '原有限弧光：5灵性，贡献70（G）', weight: 35 },
  { id: 'WARD', label: '原有限护术：4灵性，对方−30（G）', weight: 25 },
  { id: 'BODY_STRIKE', label: '自有原棍打击：20×身体（G）', weight: 25 },
  { id: 'COMPOSE', label: '本轮凝神抵抗：4灵性，贡献8，清除未用效果并抵抗本轮新B/K（G）', weight: 10 },
  { id: 'ACCIDENT', label: '动作偏差：固定−22.5，0灵性（G）', weight: 5 },
];
export type ChaosWalkerMoveId = 'BODY_STRIKE' | 'BODY_FOLLOWUP' | 'wheel.s3.deviation-buffer' | 'wheel.s3.future-impediment' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly { id: ChaosWalkerMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'BODY_STRIKE', label: '继承普通身体打击（H；18×身体；0灵性）', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承计算身体次击（J；22.75×原计算掌握×身体；0灵性）', weight: 15, stance: 'ATTACK' },
  { id: 'wheel.s3.deviation-buffer', label: 'G偏差缓冲（B；首个合格B/K可选耗1原积运5灵性，知识20；否则继承3灵性预警）', weight: 20, stance: 'DEFEND' },
  { id: 'wheel.s3.future-impediment', label: 'G未发阻滞（K；首个合格B/K可选耗1原积运5灵性，知识20；否则继承3灵性精神风暴）', weight: 20, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '普通观察原现场、原积运与当前凝神（R；0灵性、0贡献）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差（A；固定−22.5；0灵性，G）', weight: 5, stance: null },
];
export const isChaosWalker = (s: SliceState): boolean => s.progression.pathwayId === 'wheel' && s.progression.sequence === 3;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function chaosWalkerAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, weight: weights[i]! / total * 100, label: a.label }));
}
export function drawChaosWalkerAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): ChaosWalkerMoveId {
  const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (let i = 0; i < ABILITIES.length; i++) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('混乱行者训练盘权重无效。');
}
export function drawChaosWalkerEnemyAbility(random: ActionRandomStream): ChaosWalkerEnemyIntent {
  let roll = random.nextInt(1, 100);
  for (const a of CHAOS_WALKER_ENEMY_ABILITY_WHEEL) { roll -= a.weight; if (roll <= 0) return a.id as ChaosWalkerEnemyIntent; }
  throw new Error('原加雷斯动作盘权重无效。');
}
const bounded = (n: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));
const bodyFactor = (health: number) => health > 75 ? 1 : health > 50 ? .95 : health > 25 ? .9 : .8;
const factor = (n: number) => .65 + .35 * bounded(n, 500) / 500;
const mastery = (s: SliceState, id: string) => bounded(s.progression.mastery[id] ?? 0, 500);
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
const resource = (n: unknown, max = 120): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
export type ChaosWalkerLuckSnapshot = SliceState['winner']['luck'];
const validLuck = (l: ChaosWalkerLuckSnapshot, week: number) => !!l && Object.keys(l).length === 4 && integer(l.stored, 0, 3) && integer(l.accumulated) && integer(l.spent) &&
  l.stored === l.accumulated - l.spent && (l.lastAccumulateWeek === null ? l.accumulated === 0 : integer(l.lastAccumulateWeek, 1, week));
export function validChaosWalkerCombatScene(v: unknown): v is ChaosWalkerEncounterScene {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const s = v as ChaosWalkerEncounterScene;
  return Object.keys(s).length === 8 && s.courtId === 'CW3-COURT' && s.ordinaryExit === 'OPEN' && s.thirdPartiesInArea === 0 && typeof s.clearanceConfirmed === 'boolean' &&
    ['COURT', 'EXIT'].includes(s.playerPosition) && s.distanceMetres === 2 && s.exitMetres === 4 && s.ordinaryWalkedMetres === (s.playerPosition === 'EXIT' ? 4 : 0);
}
export interface ChaosWalkerCombatSource {
  runId: string; revision: number; week: number; round: number; lifeClockSeconds: number;
  encounterId: 'CHAOS_WALKER_DISPUTE'; targetId: typeof CHAOS_WALKER_TARGET_ID; attemptWeek: number; startHistoryIndex: number;
  playerHealth: number; playerMind: number; enemyHealth: number; enemyMind: number; knowledge: number;
  actualOriginalBody: true; mutuallyVisible: true; distanceMetres: 2; noBystanders: true; ordinaryExit: true; pursuit: false; looseObjectSource: false; disasterTrigger: false;
  targetSequence: 4; targetAge: 46; targetPhysique: 22; enemyWeapon: 'CW3-GARETH-ROD'; weaponOwner: typeof CHAOS_WALKER_TARGET_ID; weaponLocation: 'HAND'; scene: ChaosWalkerEncounterScene;
  calculationMastery: number; awarenessMastery: number; stormMastery: number; passiveMastery: number;
  luckStored: number; luckAccumulated: number; luckSpent: number; lastAccumulateWeek: number | null;
  lastLuckRound: number | null; luckAttempts: number; deviationAttempts: number; impedimentAttempts: number; powerUses: Record<ChaosWalkerPowerId, number>;
}
export function currentChaosWalkerCombatSource(s: SliceState): ChaosWalkerCombatSource | null {
  if (!hasChaosWalkerDisputeOpponent(s) || !validLuck(s.winner.luck, s.week)) return null;
  const e = s.chaosWalker.encounter, c = s.combat!, l = s.winner.luck;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, lifeClockSeconds: s.chaosWalker.life.clockSeconds,
    encounterId: 'CHAOS_WALKER_DISPUTE', targetId: CHAOS_WALKER_TARGET_ID, attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!,
    playerHealth: s.health, playerMind: s.mind, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, knowledge: s.character.coreStats.knowledge,
    actualOriginalBody: true, mutuallyVisible: true, distanceMetres: 2, noBystanders: true, ordinaryExit: true, pursuit: false, looseObjectSource: false, disasterTrigger: false,
    targetSequence: 4, targetAge: 46, targetPhysique: 22, enemyWeapon: 'CW3-GARETH-ROD', weaponOwner: CHAOS_WALKER_TARGET_ID, weaponLocation: 'HAND', scene: structuredClone(e.scene),
    calculationMastery: mastery(s, 'wheel.s8.calculation-control'), awarenessMastery: mastery(s, 'wheel.s6.disaster-awareness'),
    stormMastery: mastery(s, 'wheel.s6.mental-storm'), passiveMastery: mastery(s, 'wheel.s7.passive-luck'),
    luckStored: l.stored, luckAccumulated: l.accumulated, luckSpent: l.spent, lastAccumulateWeek: l.lastAccumulateWeek,
    lastLuckRound: e.lastLuckRound, luckAttempts: e.luckAttempts, deviationAttempts: e.deviationAttempts, impedimentAttempts: e.impedimentAttempts, powerUses: { ...e.powerUses } };
}
export interface ChaosWalkerCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
export interface ChaosWalkerPlayerAction extends ChaosWalkerCombatEffect {
  order: number; id: ChaosWalkerMoveId; paidCost: number; luckCost: number; physicalFactor: number;
  spiritualityBefore: number; spiritualityAfter: number; luckBefore: ChaosWalkerLuckSnapshot; luckAfter: ChaosWalkerLuckSnapshot;
  checkChance: number | null; checkRoll: number | null; checkTier: PublicResolutionTier | null; resistedByComposure: boolean; succeeded: boolean;
}
export interface ChaosWalkerEnemyAction extends ChaosWalkerCombatEffect {
  order: number; planned: ChaosWalkerEnemyIntent; actual: ChaosWalkerEnemyIntent; paidCost: number; physicalFactor: number;
  spiritualityBefore: number; spiritualityAfter: number; rawContribution: number; pendingApplied: ChaosWalkerPendingKind | null;
}
export interface ChaosWalkerRoundContext {
  source: ChaosWalkerCombatSource; stance: SliceStance; winnerPolicy: WinnerLuckPolicy; finished: boolean; liveState: string;
  playerSpiritualityBefore: number; enemySpiritualityBefore: number; passiveLuck: LuckyPassiveLuck | null;
  playerActions: ChaosWalkerPlayerAction[]; enemyActions: ChaosWalkerEnemyAction[]; label: string;
}
const none = (label: string): ChaosWalkerCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
const dynamicSource = new Set(['luckStored', 'luckSpent', 'lastLuckRound', 'luckAttempts', 'deviationAttempts', 'impedimentAttempts', 'powerUses']);
function liveState(s: SliceState): string {
  const e = s.chaosWalker.encounter;
  return stableStringify({ spirituality: s.spirituality, luck: s.winner.luck, enemySpirituality: e.enemySpirituality,
    lastLuckRound: e.lastLuckRound, pendingKind: e.pendingKind, composureReady: e.composureReady,
    luckAttempts: e.luckAttempts, deviationAttempts: e.deviationAttempts, impedimentAttempts: e.impedimentAttempts, powerUses: e.powerUses });
}
function validRound(s: SliceState, r: ChaosWalkerRoundContext, source: ChaosWalkerCombatSource | null): boolean {
  const current = currentChaosWalkerCombatSource(s);
  return !r.finished && current !== null && source !== null && same(source, r.source) &&
    Object.entries(r.source).every(([k, v]) => dynamicSource.has(k) || same(current[k as keyof ChaosWalkerCombatSource], v)) && r.liveState === liveState(s);
}
/** One old passive roll (except retreat), then shared count/action draws. Each paid B/K adds exactly one real knowledge check. */
export function beginChaosWalkerCombatRound(s: SliceState, stance: SliceStance, random: ActionRandomStream, winnerPolicy: WinnerLuckPolicy = 'HOLD'): ChaosWalkerRoundContext {
  if (!['HOLD', 'SPEND_FIRST'].includes(winnerPolicy)) throw new TypeError('积运策略无效。');
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('战术姿态无效。');
  const source = currentChaosWalkerCombatSource(s), e = s.chaosWalker.encounter;
  if (!source || e.pendingKind !== null || e.composureReady || e.lastLuckRound === s.combat!.round) throw new Error('缺少同一原加雷斯的完整新回合来源，或原回合效果尚未结束。');
  const roll = stance === 'RETREAT' ? null : random.nextInt(1, 100), physical = bodyFactor(s.health);
  const passiveLuck = roll === null ? null : { roll, triggered: roll <= 25, bonus: roll <= 25 ? 45 * factor(source.passiveMastery) * physical : 0 };
  return { source, stance, winnerPolicy, finished: false, liveState: liveState(s), playerSpiritualityBefore: s.spirituality, enemySpiritualityBefore: e.enemySpirituality,
    passiveLuck, playerActions: [], enemyActions: [], label: `原加雷斯在独立净空原院2米外，灵性${e.enemySpirituality}/120；本人唯一原积运${s.winner.luck.stored}/3，本轮${winnerPolicy === 'HOLD' ? '保留积运' : '仅首个资源合格B/K选用积运'}。` };
}
export function resolveChaosWalkerCombatAbility(s: SliceState, id: ChaosWalkerMoveId, physicalStateFactor: number, random: ActionRandomStream,
  r: ChaosWalkerRoundContext, source: ChaosWalkerCombatSource | null = r.source): ChaosWalkerCombatEffect {
  if (!validRound(s, r, source) || r.stance === 'RETREAT' || r.playerActions.length >= 6 || !ABILITIES.some(a => a.id === id)) return none('缺少本回合同一原人及原资源来源，0贡献、0消耗，不重抽。');
  const a: ChaosWalkerPlayerAction = { ...none(''), order: r.playerActions.length + r.enemyActions.length, id, paidCost: 0, luckCost: 0, physicalFactor: bounded(physicalStateFactor, 1),
    spiritualityBefore: s.spirituality, spiritualityAfter: s.spirituality, luckBefore: { ...s.winner.luck }, luckAfter: { ...s.winner.luck },
    checkChance: null, checkRoll: null, checkTier: null, resistedByComposure: false, succeeded: false };
  Object.assign(a, resolvePlayer(s, id, a.physicalFactor, random, r, a)); a.spiritualityAfter = s.spirituality; a.luckAfter = { ...s.winner.luck };
  r.playerActions.push(a); r.liveState = liveState(s); return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
function resolvePlayer(s: SliceState, id: ChaosWalkerMoveId, physical: number, random: ActionRandomStream, r: ChaosWalkerRoundContext, a: ChaosWalkerPlayerAction): ChaosWalkerCombatEffect {
  const e = s.chaosWalker.encounter, l = s.winner.luck;
  const pay = (n: number) => { if (!Number.isFinite(s.spirituality) || s.spirituality < n) return false; s.spirituality -= n; a.paidCost = n; return true; };
  if (id === 'ACCIDENT') return { ...none('动作偏差固定−22.5（G），0消耗，不另掷正负、不自动扣积运或增加等额厄运债。'), selfGain: -22.5 };
  if (id === 'BODY_STRIKE' || id === 'BODY_FOLLOWUP') {
    const selfGain = id === 'BODY_STRIKE' ? 18 * physical : 22.75 * factor(mastery(s, 'wheel.s8.calculation-control')) * physical;
    return { label: id === 'BODY_STRIKE' ? '继承普通身体打击18×当前身体（G），独立本槽、0消耗，不取敌原棍或凭空制造灾祸。' : '继承计算与精确身体次击22.75×原计算掌握×身体（G），独立本槽、0消耗。', selfGain, enemyReduction: 0, threatens: selfGain > 0 };
  }
  if (id === 'OBSERVE') return none(`普通观察原院开放出口、原加雷斯灵性${e.enemySpirituality}/120、凝神${e.composureReady ? '有效' : '无'}、待用效果${e.pendingKind ?? '无'}与本人原积运${l.stored}/3。0贡献、0消耗，不窥视未来随机票或制造灾源。`);
  if (r.winnerPolicy === 'SPEND_FIRST' && e.lastLuckRound !== s.combat!.round && l.stored >= 1 && pay(5)) {
    l.stored--; l.spent++; a.luckCost = 1; e.lastLuckRound = s.combat!.round; e.luckAttempts++;
    if (id === 'wheel.s3.deviation-buffer') e.deviationAttempts++; else e.impedimentAttempts++;
    const check = resolveNormalCheck({ ability: 'knowledge', baseAbility: s.character.coreStats.knowledge, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) });
    a.checkChance = check.chance; a.checkRoll = check.roll; a.checkTier = check.tier; a.resistedByComposure = e.composureReady;
    a.succeeded = ['GREAT_SUCCESS', 'SUCCESS'].includes(check.tier) && !e.composureReady;
    if (a.succeeded) e.pendingKind = id === 'wheel.s3.deviation-buffer' ? 'DEVIATION_BUFFER' : 'FUTURE_IMPEDIMENT';
    return none(`G${id === 'wheel.s3.deviation-buffer' ? '偏差缓冲' : '未发阻滞'}：实付1原积运与5灵性，知识20判定${check.roll}/100、阈值${check.chance}、${check.tier}；${a.resistedByComposure ? '原加雷斯本轮已凝神，抵抗生效' : a.succeeded ? '仅建立一个待用效果，减半本轮下一次实际正BODY或ARC贡献一次' : '本次失败，无待用效果'}。0即时贡献，失败或抵抗成本不退；不追改过去、不重抽、不叠加、不强迫服从。`);
  }
  if (id === 'wheel.s3.deviation-buffer') {
    if (pay(3)) return { ...none('继承有限灾祸预警：实付3灵性，42.25×原灾祸觉察掌握×身体（G），本槽不使用积运、不取消原攻击。'), enemyReduction: 42.25 * factor(mastery(s, 'wheel.s6.disaster-awareness')) * physical };
    return { ...none('不足3灵性，普通格挡8×当前身体，0消耗，不透支或补原积运。'), enemyReduction: 8 * physical };
  }
  if (pay(3)) return { ...none('继承有限精神风暴：实付3灵性，42.25×原精神风暴掌握（G），不乘身体；只减本槽战势，不控制意愿或重抽。'), enemyReduction: 42.25 * factor(mastery(s, 'wheel.s6.mental-storm')) };
  return none('不足3灵性，普通观察走位0贡献、0消耗，不假造未发阻滞。');
}
export function resolveChaosWalkerEnemyAbility(s: SliceState, planned: ChaosWalkerEnemyIntent, physicalStateFactor: number, _random: ActionRandomStream,
  r: ChaosWalkerRoundContext, source: ChaosWalkerCombatSource | null = r.source): ChaosWalkerCombatEffect {
  if (!validRound(s, r, source) || r.enemyActions.length >= 6 || ![...CHAOS_WALKER_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned)) return none('缺少同一原加雷斯实际来源，不凭空施术、补灵性或重抽。');
  const e = s.chaosWalker.encounter, power = CHAOS_WALKER_POWERS.find(p => p.id === planned), payable = !!power && e.enemySpirituality >= power.cost;
  const actual: ChaosWalkerEnemyIntent = planned === 'ACCIDENT' ? planned : payable ? planned : 'BODY_STRIKE';
  const physical = bounded(physicalStateFactor, 1), raw = actual === 'ACCIDENT' ? -22.5 : payable ? power!.selfGain : 20 * physical, before = e.enemySpirituality;
  // Actual action and its full real cost are committed before any pending reduction is considered.
  if (payable) { e.enemySpirituality -= power!.cost; e.powerUses[power!.id]++; }
  if (actual === 'COMPOSE') { e.pendingKind = null; e.composureReady = true; }
  const attack = actual === 'BODY_STRIKE' || actual === 'ARC_BOLT', pendingApplied = attack && raw > 0 ? e.pendingKind : null;
  if (pendingApplied) e.pendingKind = null;
  const selfGain = raw * (pendingApplied ? .5 : 1), enemyReduction = payable ? power!.enemyReduction : 0;
  const a: ChaosWalkerEnemyAction = { order: r.playerActions.length + r.enemyActions.length, planned, actual, paidCost: payable ? power!.cost : 0,
    physicalFactor: physical, spiritualityBefore: before, spiritualityAfter: e.enemySpirituality, rawContribution: raw, pendingApplied, selfGain, enemyReduction, threatens: attack && selfGain > 0,
    label: `${actual === 'ACCIDENT' ? '原加雷斯动作偏差固定−22.5，0灵性（G）' : actual === 'COMPOSE' ? `原加雷斯实际凝神，实付4灵性，贡献8，余${e.enemySpirituality}/120；清除未用B/K并仅至本轮末抵抗新B/K（G）` : payable ? `原加雷斯完成${power!.label}，实付${power!.cost}灵性，余${e.enemySpirituality}/120` : `${power ? '原法术灵性不足，实际回退' : ''}自有CW3-GARETH-ROD普通打击20×身体（G），0消耗`}${pendingApplied ? '；一个待用效果仅把本次实际正攻击贡献减半后结束，完整动作与法术费用保留' : ''}。不直接扣健康，不补原灵性。` };
  r.enemyActions.push(a); r.liveState = liveState(s); return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
export const resolveChaosWalkerEnemyCombatAbility = resolveChaosWalkerEnemyAbility;
export interface ChaosWalkerRoundOutcome {
  targetId: typeof CHAOS_WALKER_TARGET_ID; round: number; source: ChaosWalkerCombatSource; stance: SliceStance; winnerPolicy: WinnerLuckPolicy; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuriesAfter: SliceInjury[]; enemyRiskAfter: number;
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number;
  enemySpiritualityBefore: number; powerUses: Record<ChaosWalkerPowerId, number>; passiveLuck: LuckyPassiveLuck | null;
  luckStoredAfter: number; luckSpentAfter: number; lastLuckRound: number | null; luckAttempts: number; deviationAttempts: number; impedimentAttempts: number;
  pendingKind: null; composureReady: false; playerActions: ChaosWalkerPlayerAction[]; enemyActions: ChaosWalkerEnemyAction[];
  elapsedSeconds: 60; lifeClockSecondsBefore: number; lifeClockSecondsAfter: number; exitSeconds: 0 | 4; sceneAfter: ChaosWalkerEncounterScene; weaponLocation: 'HAND' | 'COURT';
}
export function finishChaosWalkerCombatRound(s: SliceState, r: ChaosWalkerRoundContext, continuing = true): ChaosWalkerRoundOutcome {
  if (r.finished || s.combat?.encounterId !== 'CHAOS_WALKER_DISPUTE' || s.combat.round !== r.source.round || r.liveState !== liveState(s) ||
      s.chaosWalker.life.clockSeconds !== r.source.lifeClockSeconds) throw new Error('同一原回合已经结束、不存在或实际资源被改写。');
  const e = s.chaosWalker.encounter, c = s.combat;
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  e.pendingKind = null; e.composureReady = false; if (e.enemyStatus === 'DEAD') e.weaponLocation = 'COURT';
  advanceChaosWalkerLifeClock(s, 60);
  const exitSeconds = !continuing && s.health > 0 ? 4 : 0;
  if (exitSeconds) { e.scene.playerPosition = 'EXIT'; e.scene.ordinaryWalkedMetres = 4; e.exitTravelMetres = 4; e.exitSeconds = 4; advanceChaosWalkerLifeClock(s, 4); }
  r.finished = true;
  return { targetId: CHAOS_WALKER_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, winnerPolicy: r.winnerPolicy, continuing,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, enemyInjuriesAfter: structuredClone(e.enemyInjuries), enemyRiskAfter: e.enemyRisk,
    playerSpiritualityBefore: r.playerSpiritualityBefore, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind,
    enemySpiritualityBefore: r.enemySpiritualityBefore, powerUses: { ...e.powerUses }, passiveLuck: r.passiveLuck && { ...r.passiveLuck },
    luckStoredAfter: s.winner.luck.stored, luckSpentAfter: s.winner.luck.spent, lastLuckRound: e.lastLuckRound,
    luckAttempts: e.luckAttempts, deviationAttempts: e.deviationAttempts, impedimentAttempts: e.impedimentAttempts, pendingKind: null, composureReady: false,
    playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions), elapsedSeconds: 60, lifeClockSecondsBefore: r.source.lifeClockSeconds,
    lifeClockSecondsAfter: s.chaosWalker.life.clockSeconds, exitSeconds, sceneAfter: structuredClone(e.scene), weaponLocation: e.weaponLocation };
}
export function projectChaosWalkerCombat(s: SliceState) {
  const e = s.chaosWalker.encounter;
  return { enemyName: '加雷斯·默瑟（CW3-GARETH，46岁原创序列4对手，G）', targetId: e.targetId, enemySpirituality: e.enemySpirituality,
    powerUses: { ...e.powerUses }, composureReady: e.composureReady, pendingKind: e.pendingKind, lastLuckRound: e.lastLuckRound, luckAttempts: e.luckAttempts,
    luck: { ...s.winner.luck, capacity: 3 as const }, originalExit: true, pursuit: false, distanceMetres: 2, source: currentChaosWalkerCombatSource(s),
    summary: `原加雷斯灵性${e.enemySpirituality}/120；本人唯一原赢家积运${s.winner.luck.stored}/3，累计实付${s.winner.luck.spent}。默认保留；首个合格B/K可选耗1原积运5灵性，知识20可失败。成功仅建立一个待用效果，减半下一次实际正BODY/ARC战势；实际敌术先付全费，凝神4灵性抵抗、回合末到期，不改过去。旧S7被动每个非撤退实际回合独立一次25%抽取，不耗积运。新3编号与两能力均为G候选；完整原著3级技能、配方与仪式未知。`,
    enemyCountWheel: CHAOS_WALKER_ENEMY_COUNT_WHEEL, enemyAbilityWheel: CHAOS_WALKER_ENEMY_ABILITY_WHEEL };
}
/** Replay ordered costs, old reserve receipts and one pending future contribution. No historical reserve is spendable. */
export function validateChaosWalkerRoundOutcome(v: unknown): v is ChaosWalkerRoundOutcome {
  try { return validateOutcome(v); } catch { return false; }
}
function validateOutcome(v: unknown): v is ChaosWalkerRoundOutcome {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const p = v as ChaosWalkerRoundOutcome, a = p.source;
  const usesValid = (u: Record<ChaosWalkerPowerId, number>) => !!u && typeof u === 'object' && Object.keys(u).length === 3 && CHAOS_WALKER_POWER_IDS.every(id => integer(u[id], 0, 30));
  if (!a || a.targetId !== CHAOS_WALKER_TARGET_ID || a.encounterId !== 'CHAOS_WALKER_DISPUTE' || a.round !== p.round || typeof a.runId !== 'string' || !a.runId ||
      !integer(a.revision) || !integer(a.week, 1) || a.attemptWeek !== a.week || !integer(a.startHistoryIndex) || !integer(a.lifeClockSeconds) ||
      !integer(a.playerHealth, 1, 100) || !integer(a.playerMind, 1, 100) || !integer(a.enemyHealth, 1, 100) || !integer(a.enemyMind, 1, 100) || !integer(a.knowledge, 0, 500) ||
      a.actualOriginalBody !== true || a.mutuallyVisible !== true || a.distanceMetres !== 2 || a.noBystanders !== true || a.ordinaryExit !== true || a.pursuit !== false || a.looseObjectSource !== false || a.disasterTrigger !== false ||
      a.targetSequence !== 4 || a.targetAge !== 46 || a.targetPhysique !== 22 || a.enemyWeapon !== 'CW3-GARETH-ROD' || a.weaponOwner !== CHAOS_WALKER_TARGET_ID || a.weaponLocation !== 'HAND' ||
      !validChaosWalkerCombatScene(a.scene) || a.scene.playerPosition !== 'COURT' || !a.scene.clearanceConfirmed || ![a.calculationMastery, a.awarenessMastery, a.stormMastery, a.passiveMastery].every(n => resource(n, 500)) || !usesValid(a.powerUses) ||
      !validLuck({ stored: a.luckStored, accumulated: a.luckAccumulated, spent: a.luckSpent, lastAccumulateWeek: a.lastAccumulateWeek }, a.week) ||
      !integer(a.luckAttempts) || !integer(a.deviationAttempts) || !integer(a.impedimentAttempts) || a.deviationAttempts + a.impedimentAttempts !== a.luckAttempts ||
      (a.lastLuckRound === null ? a.luckAttempts !== 0 : !integer(a.lastLuckRound, 1, a.round - 1) || a.luckAttempts === 0)) return false;
  if (p.targetId !== CHAOS_WALKER_TARGET_ID || !integer(p.round, 1) || !['HOLD', 'SPEND_FIRST'].includes(p.winnerPolicy) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(p.stance) ||
      !integer(p.enemyHealth, 0, a.enemyHealth) || p.enemyMind !== a.enemyMind || !integer(p.enemySpirituality, 0, 120) || !integer(p.enemySpiritualityBefore, p.enemySpirituality, 120) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(p.enemyStatus) || (p.enemyStatus === 'DEAD') !== (p.enemyHealth === 0) || !resource(p.playerSpiritualityBefore) || !resource(p.playerSpiritualityAfter) ||
      !integer(p.playerHealthAfter, 0, a.playerHealth) || p.playerMindAfter !== a.playerMind || !usesValid(p.powerUses) ||
      p.enemySpiritualityBefore !== 120 - CHAOS_WALKER_POWERS.reduce((n, x) => n + a.powerUses[x.id] * x.cost, 0) ||
      p.enemySpirituality !== 120 - CHAOS_WALKER_POWERS.reduce((n, x) => n + p.powerUses[x.id] * x.cost, 0) || p.pendingKind !== null || p.composureReady !== false ||
      typeof p.continuing !== 'boolean' || (p.continuing && (p.enemyStatus !== 'RESISTING' || p.playerHealthAfter <= 0)) ||
      !Array.isArray(p.enemyInjuriesAfter) || p.enemyInjuriesAfter.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision) || i.treatedRevision !== null) || !integer(p.enemyRiskAfter) ||
      !Array.isArray(p.playerActions) || p.playerActions.length > 6 || !Array.isArray(p.enemyActions) || p.enemyActions.length > 6 ||
      p.elapsedSeconds !== 60 || p.lifeClockSecondsBefore !== a.lifeClockSeconds || p.exitSeconds !== (!p.continuing && p.playerHealthAfter > 0 ? 4 : 0) ||
      p.lifeClockSecondsAfter !== a.lifeClockSeconds + 60 + p.exitSeconds || !validChaosWalkerCombatScene(p.sceneAfter) ||
      !same(p.sceneAfter, { ...a.scene, playerPosition: p.exitSeconds ? 'EXIT' : 'COURT', ordinaryWalkedMetres: p.exitSeconds }) ||
      p.weaponLocation !== (p.enemyStatus === 'DEAD' ? 'COURT' : 'HAND')) return false;
  if (p.stance === 'RETREAT') { if (p.passiveLuck !== null || p.playerActions.length !== 0) return false; }
  else if (!p.passiveLuck || !integer(p.passiveLuck.roll, 1, 100) || p.passiveLuck.triggered !== (p.passiveLuck.roll <= 25) || p.passiveLuck.bonus !== (p.passiveLuck.triggered ? 45 * factor(a.passiveMastery) * bodyFactor(a.playerHealth) : 0)) return false;
  const ordered = [...p.playerActions.map(action => ({ kind: 'PLAYER' as const, action })), ...p.enemyActions.map(action => ({ kind: 'ENEMY' as const, action }))];
  if (ordered.some(x => !x.action || !integer(x.action.order, 0, 11))) return false;
  ordered.sort((x, y) => x.action.order - y.action.order);
  let enemySpent = 0, playerSpent = 0, luckStored = a.luckStored, luckSpent = a.luckSpent, lastLuckRound = a.lastLuckRound;
  let luckAttempts = a.luckAttempts, deviationAttempts = a.deviationAttempts, impedimentAttempts = a.impedimentAttempts, pending: ChaosWalkerPendingKind | null = null, composure = false;
  const uses = { ...a.powerUses };
  for (const [index, entry] of ordered.entries()) {
    const action = entry.action;
    if (action.order !== index || typeof action.label !== 'string' || !Number.isFinite(action.selfGain) || !resource(action.enemyReduction, 42.25) || typeof action.threatens !== 'boolean' || !resource(action.physicalFactor, 1)) return false;
    if (entry.kind === 'PLAYER') {
      const x = entry.action, funds = p.playerSpiritualityBefore - playerSpent;
      if (!ABILITIES.some(m => m.id === x.id) || !integer(x.paidCost, 0, 5) || !integer(x.luckCost, 0, 1) || typeof x.resistedByComposure !== 'boolean' || typeof x.succeeded !== 'boolean' ||
          x.spiritualityBefore !== funds || !same(x.luckBefore, { stored: luckStored, accumulated: a.luckAccumulated, spent: luckSpent, lastAccumulateWeek: a.lastAccumulateWeek })) return false;
      const eligible = p.winnerPolicy === 'SPEND_FIRST' && lastLuckRound !== p.round && luckStored >= 1 && funds >= 5;
      let cost = 0, luckCost = 0, gain = 0, reduction = 0, threat = false, succeeded = false, resisted = false, checked = false;
      if (x.id === 'ACCIDENT') gain = -22.5;
      if (x.id === 'BODY_STRIKE') { gain = 18 * x.physicalFactor; threat = gain > 0; }
      if (x.id === 'BODY_FOLLOWUP') { gain = 22.75 * factor(a.calculationMastery) * x.physicalFactor; threat = gain > 0; }
      if (x.id === 'wheel.s3.deviation-buffer' || x.id === 'wheel.s3.future-impediment') {
        if (eligible) {
          checked = true; cost = 5; luckCost = 1; lastLuckRound = p.round; luckAttempts++;
          if (x.id === 'wheel.s3.deviation-buffer') deviationAttempts++; else impedimentAttempts++;
          if (!integer(x.checkRoll, 1, 100)) return false;
          const check = resolveNormalCheck({ ability: 'knowledge', baseAbility: a.knowledge, difficulty: 20, modifiers: [], roll: x.checkRoll });
          if (x.checkChance !== check.chance || x.checkTier !== check.tier) return false;
          resisted = composure; succeeded = ['GREAT_SUCCESS', 'SUCCESS'].includes(check.tier) && !composure;
          if (succeeded) pending = x.id === 'wheel.s3.deviation-buffer' ? 'DEVIATION_BUFFER' : 'FUTURE_IMPEDIMENT';
        } else if (funds >= 3) { cost = 3; reduction = x.id === 'wheel.s3.deviation-buffer' ? 42.25 * factor(a.awarenessMastery) * x.physicalFactor : 42.25 * factor(a.stormMastery); }
        else if (x.id === 'wheel.s3.deviation-buffer') reduction = 8 * x.physicalFactor;
      }
      if (!checked && (x.checkChance !== null || x.checkRoll !== null || x.checkTier !== null)) return false;
      if (x.paidCost !== cost || x.luckCost !== luckCost || x.selfGain !== gain || x.enemyReduction !== reduction || x.threatens !== threat || x.succeeded !== succeeded || x.resistedByComposure !== resisted) return false;
      playerSpent += cost; luckStored -= luckCost; luckSpent += luckCost;
      if (x.spiritualityAfter !== p.playerSpiritualityBefore - playerSpent || !same(x.luckAfter, { stored: luckStored, accumulated: a.luckAccumulated, spent: luckSpent, lastAccumulateWeek: a.lastAccumulateWeek })) return false;
    } else {
      const x = entry.action, funds = p.enemySpiritualityBefore - enemySpent, power = CHAOS_WALKER_POWERS.find(q => q.id === x.planned), payable = !!power && funds >= power.cost;
      const actual = x.planned === 'ACCIDENT' ? x.planned : payable ? x.planned : 'BODY_STRIKE';
      if (![...CHAOS_WALKER_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(x.planned) || x.actual !== actual || x.paidCost !== (payable ? power!.cost : 0) || x.spiritualityBefore !== funds || x.spiritualityAfter !== funds - x.paidCost) return false;
      const raw = actual === 'ACCIDENT' ? -22.5 : payable ? power!.selfGain : 20 * x.physicalFactor, attack = actual === 'BODY_STRIKE' || actual === 'ARC_BOLT';
      if (actual === 'COMPOSE') { composure = true; pending = null; }
      const applied = attack && raw > 0 ? pending : null;
      if (x.pendingApplied !== applied || x.rawContribution !== raw || x.selfGain !== raw * (applied ? .5 : 1) || x.enemyReduction !== (payable ? power!.enemyReduction : 0) || x.threatens !== (attack && x.selfGain > 0)) return false;
      if (applied) pending = null;
      if (payable) uses[power!.id]++;
      enemySpent += x.paidCost;
    }
  }
  return p.enemySpiritualityBefore - enemySpent === p.enemySpirituality && p.playerSpiritualityBefore - playerSpent === p.playerSpiritualityAfter && p.luckStoredAfter === luckStored && p.luckSpentAfter === luckSpent &&
    p.lastLuckRound === lastLuckRound && p.luckAttempts === luckAttempts && p.deviationAttempts === deviationAttempts && p.impedimentAttempts === impedimentAttempts && same(uses, p.powerUses);
}
