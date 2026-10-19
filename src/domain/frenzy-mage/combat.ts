import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { BriberGift } from '../briber/types.js';
import { stableStringify } from '../canonical.js';
import type { PublicResolutionTier } from '../../shared/contracts.js';
import { advanceFrenzyMageLifeClock } from './life.js';
import type { SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { FRENZY_MAGE_TARGET_ID, FRENZY_MAGE_POWERS, FRENZY_MAGE_POWER_IDS, hasFrenzyMageDisputeOpponent,
  type FrenzyMageEnemyIntent, type FrenzyMagePowerId, type FrenzyMageEncounterScene, type FrenzyMagePendingKind } from './encounter.js';

/** Inherited S4 categories remain; the new limited S3 deviation and all finite numbers are G. */
export const FRENZY_MAGE_COUNT_WHEEL: readonly SliceWheelEntry[] = [
  { id: '1', label: '1次', weight: 12 }, { id: '2', label: '2次', weight: 20 }, { id: '3', label: '3次', weight: 25 },
  { id: '4', label: '4次', weight: 23 }, { id: '5', label: '5次', weight: 14 }, { id: '6', label: '6次', weight: 6 },
];
export const FRENZY_MAGE_ENEMY_COUNT_WHEEL = FRENZY_MAGE_COUNT_WHEEL;
export const frenzyMageActionCount = (roll: number): number => roll <= 12 ? 1 : roll <= 32 ? 2 : roll <= 57 ? 3 : roll <= 80 ? 4 : roll <= 94 ? 5 : 6;
export const frenzyMageEnemyActionCount = frenzyMageActionCount;
export const FRENZY_MAGE_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '原有限弧光：5灵性，贡献70（G）', weight: 35 },
  { id: 'WARD', label: '原有限护术：4灵性，对方−30（G）', weight: 25 },
  { id: 'BODY_STRIKE', label: '自有原棍打击：20×身体（G）', weight: 25 },
  { id: 'COMPOSE', label: '本轮凝神：4灵性，贡献8，清除未用偏转并抵抗本轮新偏转（G）', weight: 10 },
  { id: 'ACCIDENT', label: '动作偏差：固定−22.5，0灵性（G）', weight: 5 },
];
export type FrenzyMageMoveId = 'black-emperor.s4.magnify' | 'BODY_FOLLOWUP' | 'black-emperor.s7.bribery-weakening'
  | 'black-emperor.s3.ordered-deviation' | 'black-emperor.s4.exploit' | 'ACCIDENT';
const ABILITIES: readonly { id: FrenzyMageMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'black-emperor.s4.magnify', label: '放大本人当次实际击打（H；4灵性；只乘原主攻一次，G）', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承强化身体侧击（J；41.405×原身体掌握×身体；0灵性，G）', weight: 15, stance: 'ATTACK' },
  { id: 'black-emperor.s7.bribery-weakening', label: '实赠原木筹削弱（B；原库存1件、3灵性；否则继承破绽护身，G）', weight: 25, stance: 'DEFEND' },
  { id: 'black-emperor.s3.ordered-deviation', label: '有限既有动作偏转（K；5灵性、知识20四档；下一次正身体/弧光/屏护减半，G）', weight: 10, stance: 'CONTROL' },
  { id: 'black-emperor.s4.exploit', label: '利用当前原赠物削弱（R；3灵性；同一已存在状态一次延至两次，G）', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差（A；固定−22.5；0灵性，G）', weight: 5, stance: null },
];
export const isFrenzyMage = (s: SliceState): boolean => s.progression.pathwayId === 'black-emperor' && s.progression.sequence === 3;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function frenzyMageAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, weight: weights[i]! / total * 100,
    label: a.id === 'black-emperor.s4.magnify' && s.town.clubLocation === 'HAND' ? '放大本人持握原短棍的当次打击（H；4灵性；只以16×身体为原主攻，G）' : a.label }));
}
export function drawFrenzyMageAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): FrenzyMageMoveId {
  const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (let i = 0; i < ABILITIES.length; i++) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('狂乱法师能力盘权重无效。');
}
export function drawFrenzyMageEnemyAbility(random: ActionRandomStream): FrenzyMageEnemyIntent {
  let roll = random.nextInt(1, 100);
  for (const a of FRENZY_MAGE_ENEMY_ABILITY_WHEEL) { roll -= a.weight; if (roll <= 0) return a.id as FrenzyMageEnemyIntent; }
  throw new Error('原阿尔登动作盘权重无效。');
}
const bounded = (n: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));
const factor = (n: number) => .65 + .35 * bounded(n, 500) / 500;
const mastery = (s: SliceState, id: string) => bounded(s.progression.mastery[id] ?? 0, 500);
const ground = 'BATTLE:FRENZY_MAGE_DISPUTE:GROUND';
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
const resource = (n: unknown, max = 120): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
export function validFrenzyMageCombatScene(v: unknown): v is FrenzyMageEncounterScene {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const s = v as FrenzyMageEncounterScene;
  return Object.keys(s).length === 8 && s.courtId === 'FM3-COURT' && s.ordinaryExit === 'OPEN' && s.thirdPartiesInArea === 0 && typeof s.clearanceConfirmed === 'boolean' &&
    ['COURT', 'EXIT'].includes(s.playerPosition) && s.distanceMetres === 2 && s.exitMetres === 4 && s.ordinaryWalkedMetres === (s.playerPosition === 'EXIT' ? 4 : 0);
}
export interface FrenzyMageCombatSource {
  runId: string; revision: number; week: number; round: number; lifeClockSeconds: number;
  encounterId: 'FRENZY_MAGE_DISPUTE'; targetId: typeof FRENZY_MAGE_TARGET_ID; attemptWeek: number; startHistoryIndex: number;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; knowledge: number;
  coreStats: SliceState['character']['coreStats']; playerInjuries: SliceInjury[]; playerRisk: number;
  clubLocation: SliceState['town']['clubLocation']; actualOriginalBody: true; mutuallyVisible: true;
  distanceMetres: 2; noBystanders: true; ordinaryExit: true; pursuit: false; targetAlive: true; independentMind: true;
  targetSequence: 4; targetAge: 45; targetPhysique: 22; enemyWeapon: 'FM3-ALDEN-ROD'; weaponOwner: typeof FRENZY_MAGE_TARGET_ID; weaponLocation: 'HAND'; scene: FrenzyMageEncounterScene;
  bodyMastery: number; weakPointMastery: number; briberyMastery: number; magnifyMastery: number;
  gifts: BriberGift[]; powerUses: Record<FrenzyMagePowerId, number>; deviationAttempts: number; magnifyUses: number; exploitUses: number;
}
export function currentFrenzyMageCombatSource(s: SliceState): FrenzyMageCombatSource | null {
  if (!hasFrenzyMageDisputeOpponent(s)) return null;
  const e = s.frenzyMage.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, lifeClockSeconds: s.frenzyMage.life.clockSeconds,
    encounterId: 'FRENZY_MAGE_DISPUTE', targetId: FRENZY_MAGE_TARGET_ID, attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind,
    knowledge: s.character.coreStats.knowledge, coreStats: { ...s.character.coreStats }, playerInjuries: structuredClone(s.injuries), playerRisk: s.injuryRisk, clubLocation: s.town.clubLocation,
    actualOriginalBody: true, mutuallyVisible: true, distanceMetres: 2, noBystanders: true, ordinaryExit: true, pursuit: false, targetAlive: true, independentMind: true,
    targetSequence: 4, targetAge: 45, targetPhysique: 22, enemyWeapon: 'FM3-ALDEN-ROD', weaponOwner: FRENZY_MAGE_TARGET_ID, weaponLocation: 'HAND', scene: structuredClone(e.scene),
    bodyMastery: mastery(s, 'black-emperor.s8.enhanced-body'), weakPointMastery: mastery(s, 'black-emperor.s9.weak-point-insight'),
    briberyMastery: mastery(s, 'black-emperor.s7.bribery-weakening'), magnifyMastery: mastery(s, 'black-emperor.s4.magnify'),
    gifts: structuredClone(s.briber.gifts), powerUses: { ...e.powerUses }, deviationAttempts: e.deviationAttempts, magnifyUses: e.magnifyUses, exploitUses: e.exploitUses };
}
export interface FrenzyMageCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
export interface FrenzyMagePlayerAction extends FrenzyMageCombatEffect {
  order: number; id: FrenzyMageMoveId; paidCost: number; physicalFactor: number; giftId: string | null; magnified: boolean;
  spiritualityBefore: number; spiritualityAfter: number;
  checkChance: number | null; checkRoll: number | null; checkTier: PublicResolutionTier | null; resistedByComposure: boolean; succeeded: boolean;
}
export interface FrenzyMageEnemyAction extends FrenzyMageCombatEffect {
  order: number; planned: FrenzyMageEnemyIntent; actual: FrenzyMageEnemyIntent; paidCost: number; physicalFactor: number;
  spiritualityBefore: number; spiritualityAfter: number; rawContribution: number; rawReduction: number;
  target: 'PLAYER' | 'SELF'; pendingApplied: FrenzyMagePendingKind | null; weakeningGiftId: string | null; weakeningFactor: number;
}
interface PendingGift { giftId: string; factor: number; remaining: number; extended: boolean }
export interface FrenzyMageRoundContext {
  source: FrenzyMageCombatSource; stance: SliceStance; finished: boolean; liveState: string;
  playerSpiritualityBefore: number; enemySpiritualityBefore: number; pendingWeakening: PendingGift | null;
  playerActions: FrenzyMagePlayerAction[]; enemyActions: FrenzyMageEnemyAction[]; label: string;
}
const none = (label: string): FrenzyMageCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
const dynamicSource = new Set(['playerSpirituality', 'gifts', 'powerUses', 'deviationAttempts', 'magnifyUses', 'exploitUses']);
function liveState(s: SliceState): string {
  const e = s.frenzyMage.encounter;
  return stableStringify({ runId: s.runId, revision: s.revision, week: s.week, lifeClockSeconds: s.frenzyMage.life.clockSeconds,
    clubLocation: s.town.clubLocation, coreStats: s.character.coreStats, mastery: s.progression.mastery, targetId: e.targetId, weaponLocation: e.weaponLocation, scene: e.scene,
    spirituality: s.spirituality, gifts: s.briber.gifts, enemySpirituality: e.enemySpirituality,
    pendingKind: e.pendingKind, composureReady: e.composureReady, powerUses: e.powerUses,
    deviationAttempts: e.deviationAttempts, magnifyUses: e.magnifyUses, exploitUses: e.exploitUses });
}
function validRound(s: SliceState, r: FrenzyMageRoundContext, source: FrenzyMageCombatSource | null): boolean {
  const current = currentFrenzyMageCombatSource(s);
  return !r.finished && current !== null && source !== null && stableStringify(source) === stableStringify(r.source) &&
    Object.entries(r.source).every(([k, v]) => dynamicSource.has(k) || stableStringify(current[k as keyof FrenzyMageCombatSource]) === stableStringify(v)) && r.liveState === liveState(s);
}
/** Count draws, alternating actual action tickets, one knowledge draw per paid K, winner, then only a threatened loser's consequence. */
export function beginFrenzyMageCombatRound(s: SliceState, stance: SliceStance, _random: ActionRandomStream): FrenzyMageRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('战术姿态无效。');
  const source = currentFrenzyMageCombatSource(s), e = s.frenzyMage.encounter;
  if (!source || e.pendingKind !== null || e.composureReady) throw new Error('缺少同一原阿尔登完整新回合来源，或上一回合短效尚未结束。');
  return { source, stance, finished: false, liveState: liveState(s), playerSpiritualityBefore: s.spirituality,
    enemySpiritualityBefore: e.enemySpirituality, pendingWeakening: null, playerActions: [], enemyActions: [],
    label: `原阿尔登本人在日光净空外院2米外，灵性${e.enemySpirituality}/120，有独立心智；本人实际原木筹尚持${s.briber.gifts.filter(g => g.location === 'PLAYER').length}件，原出口开放。` };
}
export function resolveFrenzyMageCombatAbility(s: SliceState, id: FrenzyMageMoveId, physicalStateFactor: number, random: ActionRandomStream,
  r: FrenzyMageRoundContext, source: FrenzyMageCombatSource | null = r.source): FrenzyMageCombatEffect {
  if (!validRound(s, r, source) || r.stance === 'RETREAT' || r.playerActions.length >= 6 || !ABILITIES.some(a => a.id === id)) return none('缺少本回合同一原活人、自主心智或实际原资源来源，0贡献、0消耗，不重抽。');
  const a: FrenzyMagePlayerAction = { ...none(''), order: r.playerActions.length + r.enemyActions.length, id, paidCost: 0, physicalFactor: bounded(physicalStateFactor, 1),
    giftId: null, magnified: false, spiritualityBefore: s.spirituality, spiritualityAfter: s.spirituality, checkChance: null, checkRoll: null, checkTier: null, resistedByComposure: false, succeeded: false };
  Object.assign(a, resolvePlayer(s, id, a.physicalFactor, random, r, a)); a.spiritualityAfter = s.spirituality; r.playerActions.push(a); r.liveState = liveState(s);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
function resolvePlayer(s: SliceState, id: FrenzyMageMoveId, physical: number, random: ActionRandomStream,
  r: FrenzyMageRoundContext, a: FrenzyMagePlayerAction): FrenzyMageCombatEffect {
  const e = s.frenzyMage.encounter;
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
  if (id === 'black-emperor.s3.ordered-deviation') {
    if (e.pendingKind !== null) return none('已有一个未用偏转，本槽0贡献、0消耗，不叠加或追改已发动作。');
    if (!pay(5)) return none('不足5灵性，普通观察原人，0贡献、0消耗，不透支或虚构偏转。');
    e.deviationAttempts++;
    const check = resolveNormalCheck({ ability: 'knowledge', baseAbility: r.source.knowledge, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) });
    a.checkChance = check.chance; a.checkRoll = check.roll; a.checkTier = check.tier;
    a.resistedByComposure = e.composureReady; a.succeeded = ['GREAT_SUCCESS', 'SUCCESS'].includes(check.tier) && !e.composureReady;
    if (a.succeeded) e.pendingKind = 'ORDERED_DEVIATION';
    return none(`有限既有动作偏转实付5灵性，知识20四档${check.roll}/100、阈值${check.chance}、${check.tier}；${a.resistedByComposure ? '原阿尔登本轮凝神抵抗，成本不退' : a.succeeded ? '仅建立一个待用偏转，减半后来下一次实际正BODY/ARC贡献或正WARD护势' : '本次失败，成本不退'}。0即时贡献；只改变尚未实际发生的一个有限动作，不追改过去、不取消完整动作和敌术成本、不强迫投降。新增机制与全部定量均为本作G。`);
  }
  const pending = r.pendingWeakening;
  if (!pending || pending.extended || pending.remaining !== 1) return none('没有尚可延长的同一原赠物削弱：本槽0贡献、0消耗；已消耗、已延长或不存在的状态不能凭空重建。');
  if (!pay(3)) return none('不足3灵性：保留当前原赠物的一次待用削弱，0贡献、0消耗，不透支或延长。');
  pending.remaining = 2; pending.extended = true; a.giftId = pending.giftId; e.exploitUses++;
  return none(`利用实付3灵性，只将已经成立的原木筹${pending.giftId}削弱窗口从一次延至两次实际针对本人行动（G）。该原状态只延长一次、上限两次；原物仍在原地，不生成新礼物或额外行动，未用部分回合末到期。`);
}
export function resolveFrenzyMageEnemyAbility(s: SliceState, planned: FrenzyMageEnemyIntent, physicalStateFactor: number, _random: ActionRandomStream,
  r: FrenzyMageRoundContext, source: FrenzyMageCombatSource | null = r.source): FrenzyMageCombatEffect {
  if (!validRound(s, r, source) || r.enemyActions.length >= 6 || ![...FRENZY_MAGE_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned)) return none('缺少同一原阿尔登实际来源，0贡献、0消耗，不补灵性或重抽。');
  const e = s.frenzyMage.encounter, power = FRENZY_MAGE_POWERS.find(p => p.id === planned), payable = !!power && e.enemySpirituality >= power.cost;
  const actual: FrenzyMageEnemyIntent = planned === 'ACCIDENT' ? planned : payable ? planned : 'BODY_STRIKE';
  const physical = bounded(physicalStateFactor, 1), raw = actual === 'ACCIDENT' ? -22.5 : payable ? power!.selfGain : 20 * physical;
  const rawReduction = payable ? power!.enemyReduction : 0, before = e.enemySpirituality;
  // The actual action pays its complete original cost BEFORE either independent modifier.
  if (payable) { e.enemySpirituality -= power!.cost; e.powerUses[power!.id]++; }
  if (actual === 'COMPOSE') { e.pendingKind = null; e.composureReady = true; }
  const attack = actual === 'BODY_STRIKE' || actual === 'ARC_BOLT', target = attack ? 'PLAYER' : 'SELF';
  const pendingApplied = (attack && raw > 0 || actual === 'WARD' && rawReduction > 0) ? e.pendingKind : null;
  if (pendingApplied) e.pendingKind = null;
  const pending = target === 'PLAYER' ? r.pendingWeakening : null;
  const weakeningGiftId = pending?.giftId ?? null, weakeningFactor = pending?.factor ?? 0;
  if (pending) { pending.remaining--; if (pending.remaining === 0) r.pendingWeakening = null; }
  const selfGain = raw * (pendingApplied ? .5 : 1) * (1 - weakeningFactor), enemyReduction = rawReduction * (pendingApplied ? .5 : 1);
  const a: FrenzyMageEnemyAction = { order: r.playerActions.length + r.enemyActions.length, planned, actual, paidCost: payable ? power!.cost : 0,
    spiritualityBefore: before, spiritualityAfter: e.enemySpirituality, rawContribution: raw, rawReduction,
    physicalFactor: physical, target, pendingApplied, weakeningGiftId, weakeningFactor, selfGain, enemyReduction, threatens: attack && selfGain > 0,
    label: `${actual === 'ACCIDENT' ? '原阿尔登动作偏差固定−22.5、0灵性（G）' : actual === 'COMPOSE' ? `原阿尔登实际凝神，实付4灵性、贡献8、余${e.enemySpirituality}/120；清除未用偏转并仅本轮抵抗新K` : payable ? `原阿尔登完成${power!.label}，实付${power!.cost}灵性、余${e.enemySpirituality}/120` : `${power ? '原法术灵性不足，实际回退' : ''}自有FM3-ALDEN-ROD普通打击20×身体（G），0消耗`}${pendingApplied ? '；待用偏转仅使本次实际正贡献减半后结束，原行动及全额法术成本保留' : ''}${pending ? `；原木筹${pending.giftId}对本人的攻击独立再乘${1 - weakeningFactor}，实际消耗一次，待用余${pending.remaining}` : ''}。不直接扣健康、不重抽。` };
  r.enemyActions.push(a); r.liveState = liveState(s);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
export const resolveFrenzyMageEnemyCombatAbility = resolveFrenzyMageEnemyAbility;
export interface FrenzyMageRoundOutcome {
  targetId: typeof FRENZY_MAGE_TARGET_ID; round: number; source: FrenzyMageCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuriesAfter: SliceInjury[]; enemyRiskAfter: number;
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; playerInjuriesAfter: SliceInjury[]; playerRiskAfter: number;
  enemySpiritualityBefore: number; powerUses: Record<FrenzyMagePowerId, number>; giftsAfter: BriberGift[];
  deviationAttempts: number; magnifyUses: number; exploitUses: number; pendingKind: null; composureReady: false; pendingWeakening: null;
  playerActions: FrenzyMagePlayerAction[]; enemyActions: FrenzyMageEnemyAction[];
  elapsedSeconds: 60; lifeClockSecondsBefore: number; lifeClockSecondsAfter: number; exitSeconds: 0 | 4; sceneAfter: FrenzyMageEncounterScene; weaponLocation: 'HAND' | 'COURT';
}
export function finishFrenzyMageCombatRound(s: SliceState, r: FrenzyMageRoundContext, continuing = true): FrenzyMageRoundOutcome {
  if (r.finished || s.combat?.encounterId !== 'FRENZY_MAGE_DISPUTE' || s.combat.round !== r.source.round || r.liveState !== liveState(s) ||
      s.frenzyMage.life.clockSeconds !== r.source.lifeClockSeconds) throw new Error('同一原回合已经结束、不存在或实际资源被改写。');
  const e = s.frenzyMage.encounter, c = s.combat;
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  e.pendingKind = null; e.composureReady = false; r.pendingWeakening = null; if (e.enemyStatus === 'DEAD') e.weaponLocation = 'COURT';
  advanceFrenzyMageLifeClock(s, 60);
  const exitSeconds = !continuing && s.health > 0 ? 4 : 0;
  if (exitSeconds) { e.scene.playerPosition = 'EXIT'; e.scene.ordinaryWalkedMetres = 4; e.exitTravelMetres = 4; e.exitSeconds = 4; advanceFrenzyMageLifeClock(s, 4); }
  r.finished = true;
  return { targetId: FRENZY_MAGE_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, enemyInjuriesAfter: structuredClone(e.enemyInjuries), enemyRiskAfter: e.enemyRisk,
    playerSpiritualityBefore: r.playerSpiritualityBefore, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind,
    playerInjuriesAfter: structuredClone(s.injuries), playerRiskAfter: s.injuryRisk,
    enemySpiritualityBefore: r.enemySpiritualityBefore, powerUses: { ...e.powerUses }, giftsAfter: structuredClone(s.briber.gifts),
    deviationAttempts: e.deviationAttempts, magnifyUses: e.magnifyUses, exploitUses: e.exploitUses, pendingKind: null, composureReady: false, pendingWeakening: null,
    playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions), elapsedSeconds: 60, lifeClockSecondsBefore: r.source.lifeClockSeconds,
    lifeClockSecondsAfter: s.frenzyMage.life.clockSeconds, exitSeconds, sceneAfter: structuredClone(e.scene), weaponLocation: e.weaponLocation };
}
export function projectFrenzyMageCombat(s: SliceState) {
  const e = s.frenzyMage.encounter, gifts = s.briber.gifts;
  return { enemyName: '阿尔登·鲁克（FM3-ALDEN，45岁原创序列4对手，G）', targetId: e.targetId, enemySpirituality: e.enemySpirituality,
    powerUses: { ...e.powerUses }, composureReady: e.composureReady, pendingKind: e.pendingKind, deviationAttempts: e.deviationAttempts, magnifyUses: e.magnifyUses, exploitUses: e.exploitUses,
    gifts: { held: gifts.filter(g => g.location === 'PLAYER').length, given: gifts.filter(g => g.location === 'GIVEN').length, battleGround: gifts.filter(g => g.destination === ground).length,
      summary: '同一旧贿赂者原库存；只给出当前真正持有原物，原已赠去向不变，不复制、补货或自动返还。' },
    originalExit: true, pursuit: false, distanceMetres: 2, source: currentFrenzyMageCombatSource(s),
    summary: `原阿尔登灵性${e.enemySpirituality}/120。H继承4灵性本人当次放大，J继承身体侧击；B用同一旧库存原物和3灵性，R另付3灵性只把该已存在原赠物削弱延至至多两次。新K实付5灵性、知识20四档可失败，成功只减半后来一次实际正BODY/ARC或WARD；敌先付全费，凝神4灵性贡献8、清未用偏转并抵抗本轮新K。旧礼物只削弱针对本人的动作，不影响敌SELF；K和旧礼物独立，无幸运池、重抽或瞬间伤害。每轮实际60秒，活着结局普通4米4秒离开，死者留原院。3名称编号有原核，新增机制与定量为G，完整配方与晋升仪式未知；原马洛永久死亡与旧历史不变。`,
    enemyCountWheel: FRENZY_MAGE_ENEMY_COUNT_WHEEL, enemyAbilityWheel: FRENZY_MAGE_ENEMY_ABILITY_WHEEL };
}
/** Replay ordered original costs, original gifts and the next positive action only. */
export function validateFrenzyMageRoundOutcome(v: unknown): v is FrenzyMageRoundOutcome {
  try { return validateOutcome(v); } catch { return false; }
}
function validInjuries(v: unknown): v is SliceInjury[] {
  return Array.isArray(v) && v.every(i => i && typeof i.id === 'string' && ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision)));
}
function validateOutcome(v: unknown): v is FrenzyMageRoundOutcome {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const p = v as FrenzyMageRoundOutcome, a = p.source;
  const usesValid = (u: Record<FrenzyMagePowerId, number>) => !!u && typeof u === 'object' && Object.keys(u).length === 3 && FRENZY_MAGE_POWER_IDS.every(id => integer(u[id], 0, 30));
  if (!a || a.targetId !== FRENZY_MAGE_TARGET_ID || a.encounterId !== 'FRENZY_MAGE_DISPUTE' || a.round !== p.round || typeof a.runId !== 'string' || !a.runId ||
      !integer(a.revision) || !integer(a.week, 1) || a.attemptWeek !== a.week || !integer(a.startHistoryIndex) || !integer(a.lifeClockSeconds) ||
      !integer(a.playerHealth, 1, 100) || !integer(a.playerMind, 1, 100) || !integer(a.enemyHealth, 1, 100) || !integer(a.enemyMind, 1, 100) || !integer(a.knowledge, 0, 500) ||
      !a.coreStats || Object.keys(a.coreStats).length !== 4 || !['physique', 'perception', 'will', 'knowledge'].every(k => integer(a.coreStats[k as keyof typeof a.coreStats], 0, 500)) || a.knowledge !== a.coreStats.knowledge ||
      !validInjuries(a.playerInjuries) || !integer(a.playerRisk) || !resource(a.playerSpirituality) ||
      !['SHOP', 'BAG', 'HAND'].includes(a.clubLocation) || a.actualOriginalBody !== true || a.mutuallyVisible !== true || a.distanceMetres !== 2 || a.noBystanders !== true ||
      a.ordinaryExit !== true || a.pursuit !== false || a.targetAlive !== true || a.independentMind !== true || a.targetSequence !== 4 || a.targetAge !== 45 || a.targetPhysique !== 22 ||
      a.enemyWeapon !== 'FM3-ALDEN-ROD' || a.weaponOwner !== FRENZY_MAGE_TARGET_ID || a.weaponLocation !== 'HAND' ||
      !validFrenzyMageCombatScene(a.scene) || a.scene.playerPosition !== 'COURT' || !a.scene.clearanceConfirmed ||
      ![a.bodyMastery, a.weakPointMastery, a.briberyMastery, a.magnifyMastery].every(n => resource(n, 500)) || !usesValid(a.powerUses) ||
      ![a.deviationAttempts, a.magnifyUses, a.exploitUses].every(n => integer(n)) || !Array.isArray(a.gifts) ||
      a.gifts.some((g, i) => !g || Object.keys(g).length !== 4 || g.id !== `BR7-GIFT-${i + 1}` || (g.location === 'PLAYER' ? g.destination !== null || g.givenWeek !== null
        : g.location !== 'GIVEN' || typeof g.destination !== 'string' || g.destination.length === 0 || !integer(g.givenWeek, 1, a.week)))) return false;
  if (p.targetId !== FRENZY_MAGE_TARGET_ID || !integer(p.round, 1) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(p.stance) ||
      !integer(p.enemyHealth, 0, a.enemyHealth) || p.enemyMind !== a.enemyMind || !integer(p.enemySpirituality, 0, 120) || !integer(p.enemySpiritualityBefore, p.enemySpirituality, 120) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(p.enemyStatus) || (p.enemyStatus === 'DEAD') !== (p.enemyHealth === 0) ||
      !resource(p.playerSpiritualityBefore) || p.playerSpiritualityBefore !== a.playerSpirituality || !resource(p.playerSpiritualityAfter) || p.playerSpiritualityAfter > p.playerSpiritualityBefore ||
      !integer(p.playerHealthAfter, 0, a.playerHealth) || p.playerMindAfter !== a.playerMind || !usesValid(p.powerUses) ||
      p.enemySpiritualityBefore !== 120 - FRENZY_MAGE_POWERS.reduce((n, x) => n + a.powerUses[x.id] * x.cost, 0) ||
      p.enemySpirituality !== 120 - FRENZY_MAGE_POWERS.reduce((n, x) => n + p.powerUses[x.id] * x.cost, 0) ||
      p.pendingKind !== null || p.composureReady !== false || p.pendingWeakening !== null || typeof p.continuing !== 'boolean' ||
      (p.continuing && (p.enemyStatus !== 'RESISTING' || p.playerHealthAfter <= 0)) ||
      !validInjuries(p.enemyInjuriesAfter) || p.enemyInjuriesAfter.some(i => i.treatedRevision !== null) || !integer(p.enemyRiskAfter) || !validInjuries(p.playerInjuriesAfter) || !integer(p.playerRiskAfter) ||
      !Array.isArray(p.playerActions) || p.playerActions.length > 6 || !Array.isArray(p.enemyActions) || p.enemyActions.length > 6 || (p.stance === 'RETREAT' && p.playerActions.length !== 0) ||
      p.elapsedSeconds !== 60 || p.lifeClockSecondsBefore !== a.lifeClockSeconds || p.exitSeconds !== (!p.continuing && p.playerHealthAfter > 0 ? 4 : 0) ||
      p.lifeClockSecondsAfter !== a.lifeClockSeconds + 60 + p.exitSeconds || !validFrenzyMageCombatScene(p.sceneAfter) ||
      !same(p.sceneAfter, { ...a.scene, playerPosition: p.exitSeconds ? 'EXIT' : 'COURT', ordinaryWalkedMetres: p.exitSeconds }) || p.weaponLocation !== (p.enemyStatus === 'DEAD' ? 'COURT' : 'HAND')) return false;
  const ordered = [...p.playerActions.map(action => ({ kind: 'PLAYER' as const, action })), ...p.enemyActions.map(action => ({ kind: 'ENEMY' as const, action }))];
  if (ordered.some(x => !x.action || !integer(x.action.order, 0, 11))) return false;
  ordered.sort((x, y) => x.action.order - y.action.order);
  let enemySpent = 0, playerSpent = 0, deviation: FrenzyMagePendingKind | null = null, composure = false;
  let deviationAttempts = a.deviationAttempts, magnifyUses = a.magnifyUses, exploitUses = a.exploitUses;
  let pending: PendingGift | null = null;
  const uses = { ...a.powerUses }, gifts = structuredClone(a.gifts);
  for (const [index, entry] of ordered.entries()) {
    const action = entry.action;
    if (action.order !== index || typeof action.label !== 'string' || !Number.isFinite(action.selfGain) || !resource(action.enemyReduction, 36.45) || typeof action.threatens !== 'boolean' || !resource(action.physicalFactor, 1)) return false;
    if (entry.kind === 'PLAYER') {
      const x = entry.action, funds = p.playerSpiritualityBefore - playerSpent;
      if (!ABILITIES.some(m => m.id === x.id) || !integer(x.paidCost, 0, 5) || typeof x.resistedByComposure !== 'boolean' || typeof x.succeeded !== 'boolean' || typeof x.magnified !== 'boolean' || x.spiritualityBefore !== funds) return false;
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
      if (x.id === 'black-emperor.s3.ordered-deviation' && deviation === null && funds >= 5) {
        cost = 5; checked = true; deviationAttempts++;
        if (!integer(x.checkRoll, 1, 100)) return false;
        const check = resolveNormalCheck({ ability: 'knowledge', baseAbility: a.knowledge, difficulty: 20, modifiers: [], roll: x.checkRoll });
        if (x.checkChance !== check.chance || x.checkTier !== check.tier) return false;
        resisted = composure; succeeded = ['GREAT_SUCCESS', 'SUCCESS'].includes(check.tier) && !composure;
        if (succeeded) deviation = 'ORDERED_DEVIATION';
      }
      if (x.id === 'black-emperor.s4.exploit' && pending && !pending.extended && pending.remaining === 1 && funds >= 3) {
        cost = 3; giftId = pending.giftId; pending.remaining = 2; pending.extended = true; exploitUses++;
      }
      if (!checked && (x.checkChance !== null || x.checkRoll !== null || x.checkTier !== null)) return false;
      if (x.paidCost !== cost || x.giftId !== giftId || x.magnified !== magnified || x.selfGain !== gain || x.enemyReduction !== reduction || x.threatens !== threat || x.succeeded !== succeeded || x.resistedByComposure !== resisted) return false;
      playerSpent += cost; if (x.spiritualityAfter !== p.playerSpiritualityBefore - playerSpent) return false;
    } else {
      const x = entry.action, funds = p.enemySpiritualityBefore - enemySpent, power = FRENZY_MAGE_POWERS.find(q => q.id === x.planned), payable = !!power && funds >= power.cost;
      const actual = x.planned === 'ACCIDENT' ? x.planned : payable ? x.planned : 'BODY_STRIKE';
      if (![...FRENZY_MAGE_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(x.planned) || x.actual !== actual || x.paidCost !== (payable ? power!.cost : 0) || x.spiritualityBefore !== funds || x.spiritualityAfter !== funds - x.paidCost) return false;
      const raw = actual === 'ACCIDENT' ? -22.5 : payable ? power!.selfGain : 20 * x.physicalFactor, rawReduction = payable ? power!.enemyReduction : 0;
      const attack = actual === 'BODY_STRIKE' || actual === 'ARC_BOLT';
      if (actual === 'COMPOSE') { composure = true; deviation = null; }
      const applied = (attack && raw > 0 || actual === 'WARD' && rawReduction > 0) ? deviation : null, weak = attack ? pending : null;
      if (x.target !== (attack ? 'PLAYER' : 'SELF') || x.pendingApplied !== applied || x.rawContribution !== raw || x.rawReduction !== rawReduction || x.weakeningGiftId !== (weak?.giftId ?? null) || x.weakeningFactor !== (weak?.factor ?? 0) ||
          x.selfGain !== raw * (applied ? .5 : 1) * (1 - (weak?.factor ?? 0)) || x.enemyReduction !== rawReduction * (applied ? .5 : 1) || x.threatens !== (attack && x.selfGain > 0)) return false;
      if (applied) deviation = null;
      if (weak) { weak.remaining--; if (weak.remaining === 0) pending = null; }
      if (payable) uses[power!.id]++; enemySpent += x.paidCost;
    }
  }
  return p.enemySpiritualityBefore - enemySpent === p.enemySpirituality && p.playerSpiritualityBefore - playerSpent === p.playerSpiritualityAfter &&
    p.deviationAttempts === deviationAttempts && p.magnifyUses === magnifyUses && p.exploitUses === exploitUses && same(gifts, p.giftsAfter) && same(uses, p.powerUses);
}
