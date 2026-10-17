import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance, resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import type { PublicResolutionTier } from '../../shared/contracts.js';
import { advanceChaosHunterLifeClock } from './life.js';
import type { SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { CHAOS_HUNTER_TARGET_ID, CHAOS_HUNTER_POWERS, CHAOS_HUNTER_POWER_IDS, hasChaosHunterDisputeOpponent,
  type ChaosHunterEnemyIntent, type ChaosHunterPowerId, type ChaosHunterEncounterScene } from './encounter.js';

/** Ability categories have source support; every cost, duration and combat budget here is finite G. */
export const CHAOS_HUNTER_COUNT_WHEEL: readonly SliceWheelEntry[] = [
  { id: '1', label: '1次', weight: 12 }, { id: '2', label: '2次', weight: 20 }, { id: '3', label: '3次', weight: 25 },
  { id: '4', label: '4次', weight: 23 }, { id: '5', label: '5次', weight: 14 }, { id: '6', label: '6次', weight: 6 },
];
export const CHAOS_HUNTER_ENEMY_COUNT_WHEEL = CHAOS_HUNTER_COUNT_WHEEL;
export const chaosHunterActionCount = (roll: number): number => roll <= 12 ? 1 : roll <= 32 ? 2 : roll <= 57 ? 3 : roll <= 80 ? 4 : roll <= 94 ? 5 : 6;
export const chaosHunterEnemyActionCount = chaosHunterActionCount;
export const CHAOS_HUNTER_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '原有限弧光：5灵性，贡献70（G）', weight: 35 },
  { id: 'WARD', label: '原有限护术：4灵性，对方−30（G）', weight: 25 },
  { id: 'BODY_STRIKE', label: '自有原棍打击：20×身体（G）', weight: 25 },
  { id: 'COMPOSE', label: '本轮凝神：4灵性，贡献8，清除并抵抗本轮新震慑与剥夺（G）', weight: 10 },
  { id: 'ACCIDENT', label: '动作偏差：固定−22.5（G）', weight: 5 },
];
export type ChaosHunterMoveId = 'justiciar.s9.combat-training' | 'justiciar.s5.wound-verdict' | 'justiciar.s4.intimidation'
  | 'justiciar.s3.bounded-order' | 'justiciar.s4.deprivation' | 'ACCIDENT';
const H = 'justiciar.s9.combat-training', J = 'justiciar.s5.wound-verdict', B = 'justiciar.s4.intimidation', K = 'justiciar.s3.bounded-order', R = 'justiciar.s4.deprivation';
const ABILITIES: readonly { id: ChaosHunterMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: H, label: '继承格斗／实际违令后的有限惩戒（H；可另付3灵性，G）', weight: 30, stance: 'ATTACK' },
  { id: J, label: '真实旧伤裁断／普通侧击（J；有原伤才付3灵性、知识14，G）', weight: 15, stance: 'ATTACK' },
  { id: B, label: '有限震慑（B；4灵性、知识18；后续一次正攻击×0.6，G）', weight: 25, stance: 'DEFEND' },
  { id: K, label: '有限双方规则（K；5灵性、知识20四档；双方各一次实际BODY独立抵抗，G）', weight: 10, stance: 'CONTROL' },
  { id: R, label: '暂剥同一原弧光（R；4灵性、知识18；后续原槽改普通棍击，G）', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差（A；固定−22.5，G）', weight: 5, stance: null },
];
export const isChaosHunter = (s: SliceState): boolean => s.progression.pathwayId === 'justiciar' && s.progression.sequence === 3;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function chaosHunterAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, weight: weights[i]! / total * 100,
    label: a.id === H && s.town.clubLocation === 'HAND' ? '本人持握原短棍／实际违令后的有限惩戒（H；16×身体，可另付3灵性，G）' : a.label }));
}
export function drawChaosHunterAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): ChaosHunterMoveId {
  const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (let i = 0; i < ABILITIES.length; i++) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('混乱猎手能力盘权重无效。');
}
export function drawChaosHunterEnemyAbility(random: ActionRandomStream): ChaosHunterEnemyIntent {
  let roll = random.nextInt(1, 100);
  for (const a of CHAOS_HUNTER_ENEMY_ABILITY_WHEEL) { roll -= a.weight; if (roll <= 0) return a.id as ChaosHunterEnemyIntent; }
  throw new Error('原埃德里克动作盘权重无效。');
}
const bounded = (n: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));
const factor = (n: number) => .65 + .35 * bounded(n, 500) / 500;
const mastery = (s: SliceState, id: string) => bounded(s.progression.mastery[id] ?? 0, 500);
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
const resource = (n: unknown, max = 120): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
export function validChaosHunterCombatScene(v: unknown): v is ChaosHunterEncounterScene {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const s = v as ChaosHunterEncounterScene;
  return Object.keys(s).length === 8 && s.courtId === 'CH3-COURT' && s.ordinaryExit === 'OPEN' && s.thirdPartiesInArea === 0 && typeof s.clearanceConfirmed === 'boolean' &&
    ['COURT', 'EXIT'].includes(s.playerPosition) && s.distanceMetres === 2 && s.exitMetres === 4 && s.ordinaryWalkedMetres === (s.playerPosition === 'EXIT' ? 4 : 0);
}
export interface ChaosHunterCombatSource {
  runId: string; revision: number; week: number; round: number; lifeClockSeconds: number;
  encounterId: 'CHAOS_HUNTER_DISPUTE'; targetId: typeof CHAOS_HUNTER_TARGET_ID; attemptWeek: number; startHistoryIndex: number;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; knowledge: number;
  coreStats: SliceState['character']['coreStats']; playerInjuries: SliceInjury[]; playerRisk: number;
  clubLocation: SliceState['town']['clubLocation']; actualOriginalBody: true; mutuallyVisible: true;
  distanceMetres: 2; noBystanders: true; ordinaryExit: true; pursuit: false; targetAlive: true; independentMind: true;
  targetSequence: 4; targetAge: 44; targetPhysique: 22; enemyWeapon: 'CH3-EDRIC-ROD'; weaponOwner: typeof CHAOS_HUNTER_TARGET_ID; weaponLocation: 'HAND'; scene: ChaosHunterEncounterScene;
  enemyInjuries: SliceInjury[]; enemyRisk: number;
  bodyMastery: number; woundMastery: number; punishmentMastery: number; traceMastery: number; prohibitionMastery: number;
  powerUses: Record<ChaosHunterPowerId, number>; intimidationAttempts: number; deprivationAttempts: number; punishmentUses: number; boundedOrderAttempts: number;
}
export function currentChaosHunterCombatSource(s: SliceState): ChaosHunterCombatSource | null {
  if (!hasChaosHunterDisputeOpponent(s)) return null;
  const e = s.chaosHunter.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, lifeClockSeconds: s.chaosHunter.life.clockSeconds,
    encounterId: 'CHAOS_HUNTER_DISPUTE', targetId: CHAOS_HUNTER_TARGET_ID, attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind,
    knowledge: s.character.coreStats.knowledge, coreStats: { ...s.character.coreStats }, playerInjuries: structuredClone(s.injuries), playerRisk: s.injuryRisk, clubLocation: s.town.clubLocation,
    actualOriginalBody: true, mutuallyVisible: true, distanceMetres: 2, noBystanders: true, ordinaryExit: true, pursuit: false, targetAlive: true, independentMind: true,
    targetSequence: 4, targetAge: 44, targetPhysique: 22, enemyWeapon: 'CH3-EDRIC-ROD', weaponOwner: CHAOS_HUNTER_TARGET_ID, weaponLocation: 'HAND', scene: structuredClone(e.scene),
    enemyInjuries: structuredClone(c.enemyInjuries), enemyRisk: c.enemyRisk,
    bodyMastery: mastery(s, H), woundMastery: mastery(s, J), punishmentMastery: mastery(s, 'justiciar.s5.punishment'),
    traceMastery: mastery(s, 'justiciar.s8.trace-sensing'), prohibitionMastery: mastery(s, 'justiciar.s6.prohibition'), powerUses: { ...e.powerUses },
    intimidationAttempts: e.intimidationAttempts, deprivationAttempts: e.deprivationAttempts, punishmentUses: e.punishmentUses, boundedOrderAttempts: e.boundedOrderAttempts };
}
export interface ChaosHunterCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
interface ActionEvidence extends ChaosHunterCombatEffect {
  order: number; paidCost: number; physicalFactor: number; rolls: number[];
  spiritualityBefore: number; spiritualityAfter: number; bodyPendingBefore: BodyPending; bodyPendingAfter: BodyPending; breachReadyBefore: boolean; breachReadyAfter: boolean;
  checkTier: PublicResolutionTier | null; checkChance: number | null; checkRoll: number | null; succeeded: boolean; resistedByComposure: boolean;
  prohibitionRoll: number | null; prohibitionThreshold: number | null; prohibitionBlocked: boolean; prohibitionResisted: boolean;
}
export interface ChaosHunterPlayerAction extends ActionEvidence { id: ChaosHunterMoveId; punishmentApplied: boolean }
export interface ChaosHunterEnemyAction extends ActionEvidence {
  planned: ChaosHunterEnemyIntent; actual: ChaosHunterEnemyIntent; deprivationApplied: boolean; intimidationApplied: boolean;
}
interface RoundModel {
  playerSpirituality: number; enemySpirituality: number; powerUses: Record<ChaosHunterPowerId, number>;
  intimidationReady: boolean; deprivationReady: boolean; composureReady: boolean; playerBodyPending: boolean; enemyBodyPending: boolean; breachReady: boolean;
  intimidationAttempts: number; deprivationAttempts: number; punishmentUses: number; boundedOrderAttempts: number;
}
export interface ChaosHunterRoundContext {
  source: ChaosHunterCombatSource; stance: SliceStance; finished: boolean; liveState: string;
  playerSpiritualityBefore: number; enemySpiritualityBefore: number; model: RoundModel;
  playerActions: ChaosHunterPlayerAction[]; enemyActions: ChaosHunterEnemyAction[]; label: string;
}
const none = (label: string): ChaosHunterCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
interface BodyPending { PLAYER: boolean; ENEMY: boolean }
const pending = (m: RoundModel): BodyPending => ({ PLAYER: m.playerBodyPending, ENEMY: m.enemyBodyPending });
const dynamicSource = new Set(['playerSpirituality', 'powerUses', 'intimidationAttempts', 'deprivationAttempts', 'punishmentUses', 'boundedOrderAttempts']);
function liveState(s: SliceState): string {
  const e = s.chaosHunter.encounter;
  return stableStringify({ runId: s.runId, revision: s.revision, week: s.week, clock: s.chaosHunter.life.clockSeconds,
    coreStats: s.character.coreStats, mastery: s.progression.mastery, clubLocation: s.town.clubLocation, targetId: e.targetId,
    weaponLocation: e.weaponLocation, scene: e.scene, spirituality: s.spirituality, enemySpirituality: e.enemySpirituality,
    powerUses: e.powerUses, intimidationReady: e.intimidationReady, deprivationReady: e.deprivationReady, composureReady: e.composureReady,
    playerBodyPending: e.playerBodyPending, enemyBodyPending: e.enemyBodyPending, breachReady: e.breachReady,
    intimidationAttempts: e.intimidationAttempts, deprivationAttempts: e.deprivationAttempts, punishmentUses: e.punishmentUses, boundedOrderAttempts: e.boundedOrderAttempts });
}
function validRound(s: SliceState, r: ChaosHunterRoundContext, source: ChaosHunterCombatSource | null): boolean {
  const current = currentChaosHunterCombatSource(s);
  return !r.finished && current !== null && source !== null && stableStringify(source) === stableStringify(r.source) &&
    Object.entries(r.source).every(([k, v]) => dynamicSource.has(k) || stableStringify(current[k as keyof ChaosHunterCombatSource]) === stableStringify(v)) && r.liveState === liveState(s);
}
const initialModel = (source: ChaosHunterCombatSource, player: number, enemy: number): RoundModel => ({
  playerSpirituality: player, enemySpirituality: enemy, powerUses: { ...source.powerUses }, intimidationReady: false, deprivationReady: false,
  composureReady: false, playerBodyPending: false, enemyBodyPending: false, breachReady: false, intimidationAttempts: source.intimidationAttempts,
  deprivationAttempts: source.deprivationAttempts, punishmentUses: source.punishmentUses, boundedOrderAttempts: source.boundedOrderAttempts,
});
function commitModel(s: SliceState, r: ChaosHunterRoundContext): void {
  const { playerSpirituality, ...enemy } = r.model;
  s.spirituality = playerSpirituality; Object.assign(s.chaosHunter.encounter, enemy); r.liveState = liveState(s);
}
export function beginChaosHunterCombatRound(s: SliceState, stance: SliceStance, _random: ActionRandomStream): ChaosHunterRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('战术姿态无效。');
  const source = currentChaosHunterCombatSource(s), e = s.chaosHunter.encounter;
  if (!source || e.intimidationReady || e.deprivationReady || e.composureReady || e.playerBodyPending || e.enemyBodyPending || e.breachReady) throw new Error('缺少同一原埃德里克的新回合来源，或上轮短效尚未结束。');
  return { source, stance, finished: false, liveState: liveState(s), playerSpiritualityBefore: s.spirituality, enemySpiritualityBefore: e.enemySpirituality,
    model: initialModel(source, s.spirituality, e.enemySpirituality), playerActions: [], enemyActions: [],
    label: `原埃德里克本人在日光净空外院2米外，灵性${e.enemySpirituality}/120，有独立心智；原弧光能力属于本人，原普通出口开放。` };
}
function evidence(order: number, physical: number, m: RoundModel, actor: 'PLAYER' | 'ENEMY'): ActionEvidence {
  const spirituality = actor === 'PLAYER' ? m.playerSpirituality : m.enemySpirituality;
  return { ...none(''), order, paidCost: 0, physicalFactor: physical, rolls: [], checkChance: null, checkRoll: null, checkTier: null, succeeded: false,
    resistedByComposure: false, prohibitionRoll: null, prohibitionThreshold: null, prohibitionBlocked: false, prohibitionResisted: false,
    spiritualityBefore: spirituality, spiritualityAfter: spirituality, bodyPendingBefore: pending(m), bodyPendingAfter: pending(m), breachReadyBefore: m.breachReady, breachReadyAfter: m.breachReady };
}
function completeAction<T extends ActionEvidence>(a: T, m: RoundModel, actor: 'PLAYER' | 'ENEMY'): T {
  a.spiritualityAfter = actor === 'PLAYER' ? m.playerSpirituality : m.enemySpirituality;
  a.bodyPendingAfter = pending(m); a.breachReadyAfter = m.breachReady; return a;
}
function draw(random: ActionRandomStream, a: ActionEvidence): number { const roll = random.nextInt(1, 100); a.rolls.push(roll); return roll; }
function prohibition(source: ChaosHunterCombatSource, m: RoundModel, a: ActionEvidence, random: ActionRandomStream, actor: 'PLAYER' | 'ENEMY'): boolean {
  const key = actor === 'PLAYER' ? 'playerBodyPending' : 'enemyBodyPending';
  if (!m[key]) return false;
  m[key] = false; a.prohibitionThreshold = 55 + 20 * source.prohibitionMastery / 500;
  a.prohibitionRoll = draw(random, a); a.prohibitionBlocked = a.prohibitionRoll <= a.prohibitionThreshold; a.prohibitionResisted = !a.prohibitionBlocked;
  a.label = `${actor === 'PLAYER' ? '本人' : '原敌'}这一份身体规则只在本次实际BODY判定${a.prohibitionRoll}/${a.prohibitionThreshold}（G）；${a.prohibitionBlocked ? '被挡，本次原槽贡献0，不形成实际违令' : '实际抵抗，原身体动作继续'}。只消耗当前行动者的一份，不替另一人抵抗，不重抽。`;
  return a.prohibitionBlocked;
}
function playerAction(source: ChaosHunterCombatSource, m: RoundModel, id: ChaosHunterMoveId, physical: number,
  order: number, random: ActionRandomStream): ChaosHunterPlayerAction {
  const a: ChaosHunterPlayerAction = { ...evidence(order, physical, m, 'PLAYER'), id, punishmentApplied: false };
  const pay = (cost: number) => { if (m.playerSpirituality < cost) return false; m.playerSpirituality -= cost; a.paidCost += cost; return true; };
  const wound = id === J && source.enemyInjuries.length > 0 && m.playerSpirituality >= 3;
  if ((id === H || (id === J && !wound)) && prohibition(source, m, a, random, 'PLAYER')) return completeAction(a, m, 'PLAYER');
  const prefix = a.label;
  if (id === H) {
    a.selfGain = (source.clubLocation === 'HAND' ? 16 : 59.15 * factor(source.bodyMastery)) * physical;
    if (m.breachReady && pay(3)) { m.breachReady = false; m.punishmentUses++; a.punishmentApplied = true; a.selfGain += 20 * factor(source.punishmentMastery) * physical; }
    a.threatens = a.selfGain > 0;
    a.label = `${prefix}${source.clubLocation === 'HAND' ? '本人实际持握原普通短棍16×身体' : '继承格斗59.15×原格斗掌握×身体'}（G）；${a.punishmentApplied ? '依据本轮此前敌方实际抵抗禁令并完成正贡献BODY，实付3灵性、消耗来源，在同一次H加入20×原惩戒掌握×身体' : '没有可实付的实际违令惩戒来源，0额外消耗、0惩戒预算'}。不追加行动，伤势只走共同后果盘。`;
  } else if (id === J) {
    if (!wound) { a.selfGain = 41.405 * factor(source.bodyMastery) * physical; a.threatens = a.selfGain > 0;
      a.label = `${prefix}${source.enemyInjuries.length === 0 ? '没有实际敌方既有伤口' : '不足3灵性'}，普通侧击41.405×原格斗掌握×身体（G），0消耗、不抽裁断盘，不虚构伤口。`;
    } else {
      pay(3); a.checkChance = computeCheckChance({ ability: 'knowledge', baseAbility: source.knowledge, difficulty: 14, modifiers: [] });
      a.checkRoll = draw(random, a); a.succeeded = a.checkRoll <= a.checkChance; a.selfGain = a.succeeded ? 45 * factor(source.woundMastery) : 0; a.threatens = a.selfGain > 0;
      a.label = `原伤裁断实付3灵性、知识14判定${a.checkRoll}/${a.checkChance}（G）；${a.succeeded ? '依当前原敌真实旧伤形成45×原裁断掌握的有限致伤战势' : '失败，贡献0且成本不退'}。不乘身体，不消耗待用身体禁令，不直接扣健康、低血处决或保证一句话死亡。`;
    }
  } else if (id === K) {
    if (m.playerBodyPending || m.enemyBodyPending) a.label = '本轮仍有人持有待用身体规则：重复K占原槽，0消耗、0判定，不叠加或替换任何一份。';
    else if (!pay(5)) { a.enemyReduction = 6 * physical; a.label = '不足5灵性：普通走位6×身体（G），0消耗，不制造双方规则。'; }
    else {
      m.boundedOrderAttempts++; a.checkRoll = draw(random, a);
      const check = resolveNormalCheck({ ability: 'knowledge', baseAbility: source.knowledge, difficulty: 20, modifiers: [], roll: a.checkRoll });
      a.checkChance = check.chance; a.checkTier = check.tier; a.succeeded = ['GREAT_SUCCESS', 'SUCCESS'].includes(check.tier);
      if (a.succeeded) { m.playerBodyPending = true; m.enemyBodyPending = true; }
      a.label = `有限双方规则实付5灵性、知识20四档${a.checkRoll}/${a.checkChance}：${a.checkTier}（G）；${a.succeeded ? '本人和原敌各得一个独立待用BODY约束，各自在后来一次真实身体动作时独立抵抗' : '本次未成立，成本保留，不补发任何约束'}。当前贡献0，不束弧光、护术、凝神或有伤裁断，不因凝神改变类别，不改过去，不自动豁免自己。`;
    }
  } else if (id === B || id === R) {
    const intimidation = id === B, pending = intimidation ? m.intimidationReady : m.deprivationReady;
    if (pending) a.label = `本轮已有待用${intimidation ? '震慑' : '原弧光剥夺'}：重复槽0贡献、0消耗、0判定，不叠加或续期。`;
    else if (!pay(4)) { a.enemyReduction = intimidation ? 49.29 * factor(source.traceMastery) * physical : 0;
      a.label = intimidation ? '不足4灵性：继承痕迹护身49.29×原痕迹掌握×身体（G），0消耗、不虚构震慑。' : '不足4灵性：普通观察，0贡献、0消耗，不制造剥夺。';
    } else {
      if (intimidation) m.intimidationAttempts++; else m.deprivationAttempts++;
      a.checkChance = computeCheckChance({ ability: 'knowledge', baseAbility: source.knowledge, difficulty: 18, modifiers: [] }); a.checkRoll = draw(random, a);
      a.resistedByComposure = m.composureReady; a.succeeded = a.checkRoll <= a.checkChance && !m.composureReady;
      if (a.succeeded) { if (intimidation) m.intimidationReady = true; else m.deprivationReady = true; }
      a.label = `${intimidation ? '有限震慑' : '暂剥同一原弧光'}实付4灵性、知识18判定${a.checkRoll}/${a.checkChance}（G）；${a.resistedByComposure ? '原埃德里克本轮已凝神，实际抵抗，成本不退' : !a.succeeded ? '失败，贡献0且成本不退' : intimidation ? '只削弱本轮下一次实际正贡献BODY或ARC至60%，不取消原行动' : '仅使同一原弧光本轮剩余时间不可用，后续ARC原槽实际回退普通棍击且0法术消耗，回合末恢复'}。不追改过去，不强制真话或投降，不永久删能力、不复制学习；不是统一两条上限。`;
    }
  } else { a.selfGain = -22.5; a.label = '动作偏差固定−22.5战势（G），0灵性，不另掷正负。'; }
  return completeAction(a, m, 'PLAYER');
}
function enemyAction(source: ChaosHunterCombatSource, m: RoundModel, planned: ChaosHunterEnemyIntent, physical: number,
  order: number, random: ActionRandomStream): ChaosHunterEnemyAction {
  const power = CHAOS_HUNTER_POWERS.find(p => p.id === planned), deprived = planned === 'ARC_BOLT' && m.deprivationReady;
  const payable = !!power && !deprived && m.enemySpirituality >= power.cost;
  const actual: ChaosHunterEnemyIntent = planned === 'ACCIDENT' ? planned : payable ? planned : 'BODY_STRIKE';
  const a: ChaosHunterEnemyAction = { ...evidence(order, physical, m, 'ENEMY'), planned, actual, deprivationApplied: deprived, intimidationApplied: false };
  if (actual === 'BODY_STRIKE' && prohibition(source, m, a, random, 'ENEMY')) return completeAction(a, m, 'ENEMY');
  const prefix = a.label;
  if (payable) { a.paidCost = power!.cost; m.enemySpirituality -= a.paidCost; m.powerUses[power!.id]++; }
  if (actual === 'COMPOSE') { m.intimidationReady = false; m.deprivationReady = false; m.composureReady = true; }
  const attack = actual === 'BODY_STRIKE' || actual === 'ARC_BOLT';
  const raw = actual === 'ACCIDENT' ? -22.5 : payable ? power!.selfGain : 20 * physical;
  a.intimidationApplied = attack && raw > 0 && m.intimidationReady;
  if (a.intimidationApplied) m.intimidationReady = false;
  a.selfGain = raw * (a.intimidationApplied ? .6 : 1); a.enemyReduction = payable ? power!.enemyReduction : 0; a.threatens = attack && a.selfGain > 0;
  if (actual === 'BODY_STRIKE' && a.prohibitionResisted && a.selfGain > 0) m.breachReady = true;
  a.label = `${prefix}${actual === 'ACCIDENT' ? '原埃德里克动作偏差固定−22.5、0灵性（G）' : actual === 'COMPOSE' ? `原埃德里克实际凝神实付4灵性、贡献8、余${m.enemySpirituality}/120；清除待用震慑、恢复同一弧光并本轮抵抗新震慑和剥夺` : payable ? `原埃德里克完成${power!.label}，实付${power!.cost}灵性、余${m.enemySpirituality}/120` : `${deprived ? '原弧光当前被暂剥' : power ? '原法术灵性不足' : '原身体打击'}，同一原槽实际使用自有CH3-EDRIC-ROD普通棍击20×身体，0灵性（G）`}${a.intimidationApplied ? '；待用震慑只使本次正攻击×0.6后结束，原槽及法术实付不退' : ''}${actual === 'BODY_STRIKE' && a.prohibitionResisted && a.selfGain > 0 ? '；本次实际抵抗禁令并完成正贡献BODY，记录一份待用H惩戒来源' : ''}。不重抽、跳槽或直接扣健康。`;
  return completeAction(a, m, 'ENEMY');
}
export function resolveChaosHunterCombatAbility(s: SliceState, id: ChaosHunterMoveId, physicalStateFactor: number, random: ActionRandomStream,
  r: ChaosHunterRoundContext, source: ChaosHunterCombatSource | null = r.source): ChaosHunterCombatEffect {
  if (!validRound(s, r, source) || r.playerActions.length >= 6 || r.stance === 'RETREAT' || !ABILITIES.some(a => a.id === id)) return none('缺少本回合同一原活人或原资源来源，0贡献、0消耗，不重抽。');
  const a = playerAction(r.source, r.model, id, bounded(physicalStateFactor, 1), r.playerActions.length + r.enemyActions.length, random);
  r.playerActions.push(a); commitModel(s, r); return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
export function resolveChaosHunterEnemyAbility(s: SliceState, planned: ChaosHunterEnemyIntent, physicalStateFactor: number, random: ActionRandomStream,
  r: ChaosHunterRoundContext, source: ChaosHunterCombatSource | null = r.source): ChaosHunterCombatEffect {
  if (!validRound(s, r, source) || r.enemyActions.length >= 6 || ![...CHAOS_HUNTER_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned)) return none('缺少同一原埃德里克的实际来源，0贡献、0消耗，不重抽。');
  const a = enemyAction(r.source, r.model, planned, bounded(physicalStateFactor, 1), r.playerActions.length + r.enemyActions.length, random);
  r.enemyActions.push(a); commitModel(s, r); return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
export const resolveChaosHunterEnemyCombatAbility = resolveChaosHunterEnemyAbility;
export interface ChaosHunterRoundOutcome {
  targetId: typeof CHAOS_HUNTER_TARGET_ID; round: number; source: ChaosHunterCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuriesAfter: SliceInjury[]; enemyRiskAfter: number;
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; playerInjuriesAfter: SliceInjury[]; playerRiskAfter: number;
  enemySpiritualityBefore: number; powerUses: Record<ChaosHunterPowerId, number>;
  intimidationAttempts: number; deprivationAttempts: number; punishmentUses: number; boundedOrderAttempts: number;
  intimidationReady: false; deprivationReady: false; composureReady: false; playerBodyPending: false; enemyBodyPending: false; breachReady: false;
  playerActions: ChaosHunterPlayerAction[]; enemyActions: ChaosHunterEnemyAction[];
  elapsedSeconds: 60; lifeClockSecondsBefore: number; lifeClockSecondsAfter: number; exitSeconds: 0 | 4; sceneAfter: ChaosHunterEncounterScene; weaponLocation: 'HAND' | 'COURT';
}
export function finishChaosHunterCombatRound(s: SliceState, r: ChaosHunterRoundContext, continuing = true): ChaosHunterRoundOutcome {
  if (r.finished || s.combat?.encounterId !== 'CHAOS_HUNTER_DISPUTE' || s.combat.round !== r.source.round || r.liveState !== liveState(s) ||
      s.chaosHunter.life.clockSeconds !== r.source.lifeClockSeconds) throw new Error('同一原回合已经结束、不存在或实际资源被改写。');
  const e = s.chaosHunter.encounter, c = s.combat;
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  e.intimidationReady = false; e.deprivationReady = false; e.composureReady = false; e.playerBodyPending = false; e.enemyBodyPending = false; e.breachReady = false;
  r.model.intimidationReady = false; r.model.deprivationReady = false; r.model.composureReady = false; r.model.playerBodyPending = false; r.model.enemyBodyPending = false; r.model.breachReady = false; if (e.enemyStatus === 'DEAD') e.weaponLocation = 'COURT';
  advanceChaosHunterLifeClock(s, 60);
  const exitSeconds = !continuing && s.health > 0 ? 4 : 0;
  if (exitSeconds) { e.scene.playerPosition = 'EXIT'; e.scene.ordinaryWalkedMetres = 4; e.exitTravelMetres = 4; e.exitSeconds = 4; advanceChaosHunterLifeClock(s, 4); }
  r.finished = true;
  return { targetId: CHAOS_HUNTER_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, enemyInjuriesAfter: structuredClone(e.enemyInjuries), enemyRiskAfter: e.enemyRisk,
    playerSpiritualityBefore: r.playerSpiritualityBefore, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind,
    playerInjuriesAfter: structuredClone(s.injuries), playerRiskAfter: s.injuryRisk,
    enemySpiritualityBefore: r.enemySpiritualityBefore, powerUses: { ...e.powerUses },
    intimidationAttempts: e.intimidationAttempts, deprivationAttempts: e.deprivationAttempts, punishmentUses: e.punishmentUses, boundedOrderAttempts: e.boundedOrderAttempts,
    intimidationReady: false, deprivationReady: false, composureReady: false, playerBodyPending: false, enemyBodyPending: false, breachReady: false,
    playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions), elapsedSeconds: 60, lifeClockSecondsBefore: r.source.lifeClockSeconds,
    lifeClockSecondsAfter: s.chaosHunter.life.clockSeconds, exitSeconds, sceneAfter: structuredClone(e.scene), weaponLocation: e.weaponLocation };
}
export function projectChaosHunterCombat(s: SliceState) {
  const e = s.chaosHunter.encounter;
  return { enemyName: '埃德里克·梅森（CH3-EDRIC，44岁原创序列4对手，G）', targetId: e.targetId, enemySpirituality: e.enemySpirituality,
    powerUses: { ...e.powerUses }, intimidationReady: e.intimidationReady, deprivationReady: e.deprivationReady, composureReady: e.composureReady,
    playerBodyPending: e.playerBodyPending, enemyBodyPending: e.enemyBodyPending, breachReady: e.breachReady,
    intimidationAttempts: e.intimidationAttempts, deprivationAttempts: e.deprivationAttempts, punishmentUses: e.punishmentUses, boundedOrderAttempts: e.boundedOrderAttempts,
    originalExit: true, pursuit: false, distanceMetres: 2, source: currentChaosHunterCombatSource(s),
    summary: `原埃德里克灵性${e.enemySpirituality}/120。新K实付5灵性、知识20四档，成功使本人及敌方各有一次独立待用BODY约束；每人实际身体尝试时才独立抵抗，不消耗另一人的一份。本人不自动豁免；弧光、护术、凝神及真实有伤裁断不受身体规则。B/R沿旧4灵性、知识18；凝神4灵性贡献8，只清旧B/R并本轮抵抗新B/R，不取消新身体规则。敌方计划原术必须真实可付；暂剥弧光或灵性不足时实际回退普通BODY且不收原术费。H仅据本轮敌方实际抵抗并完成正BODY才可另付3灵性惩戒一次。每轮60秒，活着结局实际走4米4秒离场，死者留院，旧罗温及六阶原历史不变。混乱猎手3名称有原核，新增有限规则与数值均为G；不把0—36光枪或封空间下放，完整配方仪式未知，无幸运池或保证处决。`,
    enemyCountWheel: CHAOS_HUNTER_ENEMY_COUNT_WHEEL, enemyAbilityWheel: CHAOS_HUNTER_ENEMY_ABILITY_WHEEL };
}
/** Replays both independent BODY attempts in actual action order, against the original finite resources. */
export function validateChaosHunterRoundOutcome(v: unknown): v is ChaosHunterRoundOutcome {
  try { return validateOutcome(v); } catch { return false; }
}
function validInjuries(v: unknown, revision = Number.MAX_SAFE_INTEGER): v is SliceInjury[] {
  return Array.isArray(v) && new Set(v.map(i => i?.id)).size === v.length && v.every(i => i && Object.keys(i).length === 4 && typeof i.id === 'string' && i.id.length > 0 &&
    ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision, 0, revision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision, revision)));
}
const sourceKeys = 'runId revision week round lifeClockSeconds encounterId targetId attemptWeek startHistoryIndex playerHealth playerMind playerSpirituality enemyHealth enemyMind knowledge coreStats playerInjuries playerRisk clubLocation actualOriginalBody mutuallyVisible distanceMetres noBystanders ordinaryExit pursuit targetAlive independentMind targetSequence targetAge targetPhysique enemyWeapon weaponOwner weaponLocation scene enemyInjuries enemyRisk bodyMastery woundMastery punishmentMastery traceMastery prohibitionMastery powerUses intimidationAttempts deprivationAttempts punishmentUses boundedOrderAttempts'.split(' ').sort();
const outcomeKeys = 'targetId round source stance continuing enemyHealth enemyMind enemySpirituality enemyStatus enemyInjuriesAfter enemyRiskAfter playerSpiritualityBefore playerSpiritualityAfter playerHealthAfter playerMindAfter playerInjuriesAfter playerRiskAfter enemySpiritualityBefore powerUses intimidationAttempts deprivationAttempts punishmentUses boundedOrderAttempts intimidationReady deprivationReady composureReady playerBodyPending enemyBodyPending breachReady playerActions enemyActions elapsedSeconds lifeClockSecondsBefore lifeClockSecondsAfter exitSeconds sceneAfter weaponLocation'.split(' ').sort();
function validateOutcome(v: unknown): v is ChaosHunterRoundOutcome {
  if (!v || typeof v !== 'object' || Array.isArray(v) || !same(Object.keys(v).sort(), outcomeKeys)) return false;
  const p = v as ChaosHunterRoundOutcome, a = p.source;
  const usesValid = (u: Record<ChaosHunterPowerId, number>) => !!u && typeof u === 'object' && Object.keys(u).length === 3 && CHAOS_HUNTER_POWER_IDS.every(id => integer(u[id], 0, 30));
  if (!a || !same(Object.keys(a).sort(), sourceKeys) || a.targetId !== CHAOS_HUNTER_TARGET_ID || a.encounterId !== 'CHAOS_HUNTER_DISPUTE' || a.round !== p.round || typeof a.runId !== 'string' || !a.runId ||
      !integer(a.revision) || !integer(a.week, 1) || a.attemptWeek !== a.week || !integer(a.startHistoryIndex) || !integer(a.lifeClockSeconds) ||
      !integer(a.playerHealth, 1, 100) || !integer(a.playerMind, 1, 100) || !integer(a.enemyHealth, 1, 100) || !integer(a.enemyMind, 1, 100) || !integer(a.knowledge, 0, 500) ||
      !a.coreStats || Object.keys(a.coreStats).length !== 4 || !['physique', 'perception', 'will', 'knowledge'].every(k => integer(a.coreStats[k as keyof typeof a.coreStats], 0, 500)) || a.knowledge !== a.coreStats.knowledge ||
      !validInjuries(a.playerInjuries, a.revision) || !integer(a.playerRisk) || !resource(a.playerSpirituality) || !validInjuries(a.enemyInjuries, a.revision) || a.enemyInjuries.some(i => i.treatedRevision !== null) || !integer(a.enemyRisk) ||
      !['SHOP', 'BAG', 'HAND'].includes(a.clubLocation) || a.actualOriginalBody !== true || a.mutuallyVisible !== true || a.distanceMetres !== 2 || a.noBystanders !== true ||
      a.ordinaryExit !== true || a.pursuit !== false || a.targetAlive !== true || a.independentMind !== true || a.targetSequence !== 4 || a.targetAge !== 44 || a.targetPhysique !== 22 ||
      a.enemyWeapon !== 'CH3-EDRIC-ROD' || a.weaponOwner !== CHAOS_HUNTER_TARGET_ID || a.weaponLocation !== 'HAND' ||
      !validChaosHunterCombatScene(a.scene) || a.scene.playerPosition !== 'COURT' || !a.scene.clearanceConfirmed ||
      ![a.bodyMastery, a.woundMastery, a.punishmentMastery, a.traceMastery, a.prohibitionMastery].every(n => resource(n, 500)) || !usesValid(a.powerUses) ||
      ![a.intimidationAttempts, a.deprivationAttempts, a.punishmentUses, a.boundedOrderAttempts].every(n => integer(n))) return false;
  if (p.targetId !== CHAOS_HUNTER_TARGET_ID || !integer(p.round, 1) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(p.stance) ||
      !integer(p.enemyHealth, 0, a.enemyHealth) || p.enemyMind !== a.enemyMind || !integer(p.enemySpirituality, 0, 120) || !integer(p.enemySpiritualityBefore, p.enemySpirituality, 120) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(p.enemyStatus) || (p.enemyStatus === 'DEAD') !== (p.enemyHealth === 0) ||
      !resource(p.playerSpiritualityBefore) || p.playerSpiritualityBefore !== a.playerSpirituality || !resource(p.playerSpiritualityAfter) || p.playerSpiritualityAfter > p.playerSpiritualityBefore ||
      !integer(p.playerHealthAfter, 0, a.playerHealth) || p.playerMindAfter !== a.playerMind || !usesValid(p.powerUses) ||
      p.enemySpiritualityBefore !== 120 - CHAOS_HUNTER_POWERS.reduce((n, x) => n + a.powerUses[x.id] * x.cost, 0) ||
      p.enemySpirituality !== 120 - CHAOS_HUNTER_POWERS.reduce((n, x) => n + p.powerUses[x.id] * x.cost, 0) ||
      p.intimidationReady !== false || p.deprivationReady !== false || p.composureReady !== false || p.playerBodyPending !== false || p.enemyBodyPending !== false || p.breachReady !== false || typeof p.continuing !== 'boolean' ||
      (p.continuing && (p.enemyStatus !== 'RESISTING' || p.playerHealthAfter <= 0)) ||
      !validInjuries(p.enemyInjuriesAfter, a.revision + 1) || p.enemyInjuriesAfter.some(i => i.treatedRevision !== null) || !integer(p.enemyRiskAfter, a.enemyRisk, a.enemyRisk + 1) ||
      !validInjuries(p.playerInjuriesAfter, a.revision + 1) || !integer(p.playerRiskAfter, a.playerRisk, a.playerRisk + 1) ||
      !same(p.enemyInjuriesAfter.slice(0, a.enemyInjuries.length), a.enemyInjuries) || p.enemyInjuriesAfter.length > a.enemyInjuries.length + 1 ||
      !same(p.playerInjuriesAfter.slice(0, a.playerInjuries.length), a.playerInjuries) || p.playerInjuriesAfter.length > a.playerInjuries.length + 1 ||
      !Array.isArray(p.playerActions) || p.playerActions.length > 6 || !Array.isArray(p.enemyActions) || p.enemyActions.length > 6 || (p.stance === 'RETREAT' && p.playerActions.length !== 0) ||
      p.elapsedSeconds !== 60 || p.lifeClockSecondsBefore !== a.lifeClockSeconds || p.exitSeconds !== (!p.continuing && p.playerHealthAfter > 0 ? 4 : 0) ||
      p.lifeClockSecondsAfter !== a.lifeClockSeconds + 60 + p.exitSeconds || !validChaosHunterCombatScene(p.sceneAfter) ||
      !same(p.sceneAfter, { ...a.scene, playerPosition: p.exitSeconds ? 'EXIT' : 'COURT', ordinaryWalkedMetres: p.exitSeconds }) || p.weaponLocation !== (p.enemyStatus === 'DEAD' ? 'COURT' : 'HAND')) return false;
  const ordered = [...p.playerActions.map(action => ({ actor: 'PLAYER' as const, action })), ...p.enemyActions.map(action => ({ actor: 'ENEMY' as const, action }))];
  if (ordered.some(x => !x.action || !integer(x.action.order, 0, 11))) return false;
  ordered.sort((x, y) => x.action.order - y.action.order);
  const m = initialModel(a, p.playerSpiritualityBefore, p.enemySpiritualityBefore);
  for (const [index, entry] of ordered.entries()) {
    const x = entry.action;
    if (x.order !== index || !resource(x.physicalFactor, 1) || !Array.isArray(x.rolls) || x.rolls.some(n => !integer(n, 1, 100))) return false;
    let cursor = 0;
    const random: ActionRandomStream = { seed: 'recorded-chaos-hunter-action', get cursor() { return cursor; }, nextInt(min, max) {
      const n = x.rolls[cursor++]; if (n === undefined || n < min || n > max) throw new Error('缺少原实际动作判定'); return n;
    } };
    if (entry.actor === 'PLAYER' ? !ABILITIES.some(move => move.id === entry.action.id) : ![...CHAOS_HUNTER_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(entry.action.planned)) return false;
    const expected = entry.actor === 'PLAYER' ? playerAction(a, m, entry.action.id, x.physicalFactor, index, random)
      : enemyAction(a, m, entry.action.planned, x.physicalFactor, index, random);
    if (cursor !== x.rolls.length || !same(expected, x)) return false;
  }
  return m.playerSpirituality === p.playerSpiritualityAfter && m.enemySpirituality === p.enemySpirituality && same(m.powerUses, p.powerUses) &&
    m.intimidationAttempts === p.intimidationAttempts && m.deprivationAttempts === p.deprivationAttempts && m.punishmentUses === p.punishmentUses && m.boundedOrderAttempts === p.boundedOrderAttempts;
}
