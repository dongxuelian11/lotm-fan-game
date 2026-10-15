import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { DRUID_COUNT_WHEEL, druidActionCount } from '../druid/combat.js';
import type { SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { ANCIENT_ALCHEMIST_TARGET_ID, ANCIENT_ALCHEMIST_POWERS, ANCIENT_ALCHEMIST_POWER_IDS, hasAncientAlchemistDisputeOpponent,
  type AncientAlchemistEnemyIntent, type AncientAlchemistPowerId } from './encounter.js';
import { consumeAncientAlchemistGuardSegment, getAncientAlchemistGuardSegment } from './life.js';

/** The new life-alchemy wrist prototype, costs and duration are expressly finite G.
 * Old Mother budgets remain their original formulas, never Justiciar budgets. */
export const ANCIENT_ALCHEMIST_COUNT_WHEEL = DRUID_COUNT_WHEEL;
export const ancientAlchemistActionCount = druidActionCount;
export const ANCIENT_ALCHEMIST_ENEMY_COUNT_WHEEL: readonly SliceWheelEntry[] = [
  { id: '2', label: '2次', weight: 20 }, { id: '3', label: '3次', weight: 50 }, { id: '4', label: '4次', weight: 30 },
];
export const ancientAlchemistEnemyActionCount = (roll: number): number => roll <= 20 ? 2 : roll <= 70 ? 3 : 4;
export const ANCIENT_ALCHEMIST_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '原有限弧光：5灵性，贡献55（G）', weight: 35 },
  { id: 'WARD', label: '原有限护术：3灵性，对方−30（G）', weight: 25 },
  { id: 'BODY_STRIKE', label: '自有原棍打击：18×身体（G）', weight: 25 },
  { id: 'COMPOSE', label: '普通整理持棍姿势：0灵性、0贡献（G）', weight: 10 },
  { id: 'ACCIDENT', label: '动作偏差：固定−22.5（G）', weight: 5 },
];
export type AncientAlchemistMoveId = 'STRIKE' | 'BODY_FOLLOWUP' | 'mother.s4.living-matrix'
  | 'mother.s5.ground-passage' | 'mother.s7.life-support' | 'ACCIDENT';
const H = 'STRIKE', J = 'BODY_FOLLOWUP', B = 'mother.s4.living-matrix', K = 'mother.s5.ground-passage', R = 'mother.s7.life-support';
const ABILITIES: readonly { id: AncientAlchemistMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: H, label: '继承普通近身打击（H；12×身体，G）', weight: 30, stance: 'ATTACK' },
  { id: J, label: '继承审慎练习普通侧击（J；8.4×原掌握×身体，G）', weight: 15, stance: 'ATTACK' },
  { id: B, label: '有限生命基质护腕（B；原段×1、4灵性、知识18；后续一次正BODY/ARC×0.6，G）', weight: 25, stance: 'DEFEND' },
  { id: K, label: '继承已知浅壤土短潜行（K；3灵性、知识14，G）', weight: 10, stance: 'CONTROL' },
  { id: R, label: '继承有限生命支持（R；仅实际恢复才付4灵性，G）', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差（A；固定−22.5，G）', weight: 5, stance: null },
];
export const isAncientAlchemist = (s: SliceState): boolean => s.progression.pathwayId === 'mother' && s.progression.sequence === 4;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function ancientAlchemistAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, weight: weights[i]! / total * 100,
    label: a.id === H && s.town.clubLocation === 'HAND' ? '本人持握原短棍打击（H；16×身体，G）' : a.label }));
}
export function drawAncientAlchemistAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): AncientAlchemistMoveId {
  const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (let i = 0; i < ABILITIES.length; i++) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('古代炼金师能力盘权重无效。');
}
export function drawAncientAlchemistEnemyAbility(random: ActionRandomStream): AncientAlchemistEnemyIntent {
  let roll = random.nextInt(1, 100);
  for (const a of ANCIENT_ALCHEMIST_ENEMY_ABILITY_WHEEL) { roll -= a.weight; if (roll <= 0) return a.id as AncientAlchemistEnemyIntent; }
  throw new Error('原奥斯里克动作盘权重无效。');
}
const bounded = (n: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));
const factor = (n: number) => .65 + .35 * bounded(n, 500) / 500;
const mastery = (s: SliceState, id: string) => bounded(s.progression.mastery[id] ?? 0, 500);
export interface AncientAlchemistGuardReference { guardId: string; segmentId: string }
/** These are history references to actual life.guards entities, never a second inventory. */
const availableReferences = (s: SliceState): AncientAlchemistGuardReference[] => s.ancientAlchemist.life.guards
  .filter(g => g.holder === 'PLAYER').flatMap(g => g.segments.filter(x => x.spentWeek === null).map(x => ({ guardId: g.id, segmentId: x.id })));
export interface AncientAlchemistCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'ANCIENT_ALCHEMIST_DISPUTE'; targetId: typeof ANCIENT_ALCHEMIST_TARGET_ID; attemptWeek: number; startHistoryIndex: number;
  playerHealth: number; playerMind: number; enemyHealth: number; enemyMind: number; enemyInjuries: SliceInjury[]; knowledge: number;
  clubLocation: SliceState['town']['clubLocation']; actualOriginalBody: true; mutuallyVisible: true;
  distanceMetres: 2; noBystanders: true; ordinaryExit: true; pursuit: false; targetAlive: true; independentMind: true;
  targetSequence: 5; targetPhysique: 20; enemyWeapon: 'AA4-OSRIC-CLUB'; space: 'ORIGINAL_NURSERY_LOAM_COURTYARD';
  ground: 'KNOWN_SHALLOW_ORDINARY_LOAM'; carefulMastery: number; specimenMastery: number; groundMastery: number; lifeSupportMastery: number;
  powerUses: Record<AncientAlchemistPowerId, number>; guardAttempts: number; guardSegments: AncientAlchemistGuardReference[];
}
export function currentAncientAlchemistCombatSource(s: SliceState): AncientAlchemistCombatSource | null {
  if (!hasAncientAlchemistDisputeOpponent(s)) return null;
  const e = s.ancientAlchemist.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'ANCIENT_ALCHEMIST_DISPUTE', targetId: ANCIENT_ALCHEMIST_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, playerHealth: s.health, playerMind: s.mind,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemyInjuries: structuredClone(c.enemyInjuries), knowledge: s.character.coreStats.knowledge,
    clubLocation: s.town.clubLocation, actualOriginalBody: true, mutuallyVisible: true, distanceMetres: 2, noBystanders: true, ordinaryExit: true, pursuit: false,
    targetAlive: true, independentMind: true, targetSequence: 5, targetPhysique: 20, enemyWeapon: 'AA4-OSRIC-CLUB', space: 'ORIGINAL_NURSERY_LOAM_COURTYARD',
    ground: 'KNOWN_SHALLOW_ORDINARY_LOAM', carefulMastery: mastery(s, 'mother.s9.careful-practice'), specimenMastery: mastery(s, 'mother.s6.specimen-study'),
    groundMastery: mastery(s, K), lifeSupportMastery: mastery(s, R), powerUses: { ...e.powerUses }, guardAttempts: e.guardAttempts, guardSegments: availableReferences(s) };
}
export interface AncientAlchemistCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
interface ActionEvidence extends AncientAlchemistCombatEffect {
  order: number; paidCost: number; physicalFactor: number; rolls: number[];
  checkChance: number | null; checkRoll: number | null; succeeded: boolean; guard: AncientAlchemistGuardReference | null;
}
export interface AncientAlchemistPlayerAction extends ActionEvidence { id: AncientAlchemistMoveId; recoveredHealth: number; activeSeconds: 0 | 60 }
export interface AncientAlchemistEnemyAction extends ActionEvidence { planned: AncientAlchemistEnemyIntent; actual: AncientAlchemistEnemyIntent; guardApplied: boolean }
interface RoundModel {
  playerSpirituality: number; playerHealth: number; enemySpirituality: number; powerUses: Record<AncientAlchemistPowerId, number>;
  guardReady: AncientAlchemistGuardReference | null; guardAttempts: number; availableSegments: AncientAlchemistGuardReference[];
}
export interface AncientAlchemistRoundContext {
  source: AncientAlchemistCombatSource; stance: SliceStance; finished: boolean; liveState: string;
  playerSpiritualityBefore: number; enemySpiritualityBefore: number; model: RoundModel;
  playerActions: AncientAlchemistPlayerAction[]; enemyActions: AncientAlchemistEnemyAction[]; label: string;
}
const none = (label: string): AncientAlchemistCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
const dynamicSource = new Set(['playerHealth', 'powerUses', 'guardAttempts', 'guardSegments']);
function liveState(s: SliceState): string {
  const e = s.ancientAlchemist.encounter;
  return stableStringify({ playerSpirituality: s.spirituality, enemySpirituality: e.enemySpirituality, powerUses: e.powerUses,
    guardReady: e.guardReady, guardAttempts: e.guardAttempts, actualGuards: s.ancientAlchemist.life.guards });
}
function validRound(s: SliceState, r: AncientAlchemistRoundContext, source: AncientAlchemistCombatSource | null): boolean {
  const current = currentAncientAlchemistCombatSource(s);
  return !r.finished && current !== null && source !== null && stableStringify(source) === stableStringify(r.source) &&
    Object.entries(r.source).every(([k, v]) => dynamicSource.has(k) || stableStringify(current[k as keyof AncientAlchemistCombatSource]) === stableStringify(v)) &&
    s.health === r.model.playerHealth && r.liveState === liveState(s);
}
const initialModel = (source: AncientAlchemistCombatSource, player: number, enemy: number): RoundModel => ({
  playerSpirituality: player, playerHealth: source.playerHealth, enemySpirituality: enemy, powerUses: { ...source.powerUses },
  guardReady: null, guardAttempts: source.guardAttempts, availableSegments: structuredClone(source.guardSegments),
});
function commitModel(s: SliceState, r: AncientAlchemistRoundContext): void {
  const m = r.model, e = s.ancientAlchemist.encounter;
  s.spirituality = m.playerSpirituality; s.health = m.playerHealth; e.enemySpirituality = m.enemySpirituality;
  e.powerUses = { ...m.powerUses }; e.guardReady = m.guardReady && { ...m.guardReady }; e.guardAttempts = m.guardAttempts; r.liveState = liveState(s);
}
export function beginAncientAlchemistCombatRound(s: SliceState, stance: SliceStance, _random: ActionRandomStream): AncientAlchemistRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('战术姿态无效。');
  const source = currentAncientAlchemistCombatSource(s), e = s.ancientAlchemist.encounter;
  if (!source || e.guardReady !== null) throw new Error('缺少同一原奥斯里克的新回合来源，或上轮护腕尚未结束。');
  return { source, stance, finished: false, liveState: liveState(s), playerSpiritualityBefore: s.spirituality, enemySpiritualityBefore: e.enemySpirituality,
    model: initialModel(source, s.spirituality, e.enemySpirituality), playerActions: [], enemyActions: [],
    label: `原奥斯里克·维尔在原苗圃浅普通壤土外院2米外，灵性${e.enemySpirituality}/40，原普通出口开放；每轮60秒G，护腕仅耗原实物段，无灵魂、复活或无限素材。` };
}
function evidence(order: number, physical: number): ActionEvidence {
  return { ...none(''), order, paidCost: 0, physicalFactor: physical, rolls: [], checkChance: null, checkRoll: null, succeeded: false, guard: null };
}
function check(source: AncientAlchemistCombatSource, a: ActionEvidence, difficulty: number, random: ActionRandomStream): void {
  a.checkChance = computeCheckChance({ ability: 'knowledge', baseAbility: source.knowledge, difficulty, modifiers: [] });
  a.checkRoll = random.nextInt(1, 100); a.rolls.push(a.checkRoll); a.succeeded = a.checkRoll <= a.checkChance;
}
function playerAction(source: AncientAlchemistCombatSource, m: RoundModel, id: AncientAlchemistMoveId, physical: number,
  order: number, random: ActionRandomStream): AncientAlchemistPlayerAction {
  const a: AncientAlchemistPlayerAction = { ...evidence(order, physical), id, recoveredHealth: 0, activeSeconds: 0 };
  const pay = (cost: number) => { if (m.playerSpirituality < cost) return false; m.playerSpirituality -= cost; a.paidCost += cost; return true; };
  if (id === H) {
    a.selfGain = (source.clubLocation === 'HAND' ? 16 : 12) * physical; a.threatens = a.selfGain > 0;
    a.label = source.clubLocation === 'HAND' ? '本人持握镇上原短棍打击：16×身体（G），0灵性，不取得原敌的原棍。' : '继承普通近身打击：12×身体（G），0灵性，不增加超凡体魄或直接扣健康。';
  } else if (id === J) {
    a.selfGain = 8.4 * factor(source.carefulMastery) * physical; a.threatens = a.selfGain > 0;
    a.label = '继承审慎练习后的普通侧击：8.4×原耕种者审慎练习掌握×身体（G），0灵性，仅占本槽，不追加攻击。';
  } else if (id === B) {
    if (m.guardReady) a.label = '已有待用原护腕段：重复B只占本槽，0灵性、0耗段、0判定，不叠加或续期。';
    else if (!m.availableSegments.length || m.playerSpirituality < 4) {
      a.enemyReduction = 42.25 * factor(source.specimenMastery) * physical;
      a.label = '没有实际可用护腕段或不足4灵性：继承可见身体表现观察护身42.25×原样本研究掌握×身体（G），0消耗，不虚构原料、隐藏弱点或新生命。';
    } else {
      pay(4); a.guard = m.availableSegments.shift()!; m.guardAttempts++; check(source, a, 18, random);
      if (a.succeeded) { m.guardReady = { ...a.guard }; a.activeSeconds = 60; }
      a.label = `原生命基质护腕${a.guard.guardId}的同一段${a.guard.segmentId}实际耗尽，另付4灵性、知识18判定${a.checkRoll}/${a.checkChance}（G）；${a.succeeded ? '形成本轮最多60秒的有限护身，只使后续一次正BODY或ARC贡献×0.6，之后失活' : '失败，原段成为惰性材料，贡献0且原段与灵性不退'}。腕架与同段原物保留，无心智或灵魂、独立攻击、自我繁殖、复活或自动补料。`;
    }
  } else if (id === K) {
    if (!pay(3)) { a.enemyReduction = 6 * physical; a.label = '不足3灵性：沿原净空普通侧路实际走位6×身体（G），0消耗、0判定，不留在地下。'; }
    else {
      check(source, a, 14, random); a.enemyReduction = a.succeeded ? 58.5 * factor(source.groundMastery) * physical : 0;
      a.label = `继承浅壤土短潜行实付3灵性、知识14判定${a.checkRoll}/${a.checkChance}（G）；${a.succeeded ? '原身体沿已核实无地基、管线或生物的浅普通壤土，在总长不超过1米的局部浅弧实际沉入再出，落回同一净空落脚处，壤土恢复稳定；58.5×原地下潜行掌握×身体减势' : '失败，原身体留在原地面落脚处，壤土稳定，贡献0，费用不退'}。3灵性覆盖完整已完成动作，不留地下状态、不埋敌、瞬移、改写整片地形或免伤。`;
    }
  } else if (id === R) {
    if (m.playerHealth >= 100) a.label = '继承有限生命支持：健康已满，恢复0、消耗0、0随机；原伤势与累计死亡风险保留。';
    else if (!pay(4)) a.label = '继承有限生命支持：不足4灵性，恢复0、消耗0、0随机，不代扣健康或精神。';
    else {
      a.recoveredHealth = Math.min(100 - m.playerHealth, Math.floor(15 * factor(source.lifeSupportMastery))); m.playerHealth += a.recoveredHealth;
      a.label = `继承有限生命支持：实付4灵性，按floor(15×原生命支持掌握系数)实际恢复${a.recoveredHealth}健康（G），战势贡献0、0随机；原有伤势与累计死亡风险保留，不清污染、不恢复精神、不能复活。`;
    }
  } else { a.selfGain = -22.5; a.label = '动作偏差固定−22.5战势（G），0灵性，不另掷正负，不构成致伤攻击。'; }
  return a;
}
function enemyAction(_source: AncientAlchemistCombatSource, m: RoundModel, planned: AncientAlchemistEnemyIntent, physical: number,
  order: number): AncientAlchemistEnemyAction {
  const power = ANCIENT_ALCHEMIST_POWERS.find(p => p.id === planned), payable = !!power && m.enemySpirituality >= power.cost;
  const actual: AncientAlchemistEnemyIntent = planned === 'ACCIDENT' ? planned : payable ? planned : 'BODY_STRIKE';
  const a: AncientAlchemistEnemyAction = { ...evidence(order, physical), planned, actual, guardApplied: false };
  if (payable) { a.paidCost = power!.cost; m.enemySpirituality -= a.paidCost; m.powerUses[power!.id]++; }
  const attack = actual === 'BODY_STRIKE' || actual === 'ARC_BOLT';
  const raw = actual === 'ACCIDENT' ? -22.5 : payable ? power!.selfGain : 18 * physical;
  a.guardApplied = attack && raw > 0 && m.guardReady !== null;
  if (a.guardApplied) { a.guard = { ...m.guardReady! }; m.guardReady = null; }
  a.selfGain = raw * (a.guardApplied ? .6 : 1); a.enemyReduction = payable ? power!.enemyReduction : 0; a.threatens = attack && a.selfGain > 0;
  a.label = `${actual === 'ACCIDENT' ? '原奥斯里克动作偏差固定−22.5、0灵性（G）' : actual === 'COMPOSE' ? '原奥斯里克普通整理自有原棍持握姿势：0灵性、0贡献，不是心理法术，也不清除实体护腕' : payable ? `原奥斯里克完成${power!.label}，实付${power!.cost}灵性、余${m.enemySpirituality}/40` : `${power ? '原法术灵性不足' : '原身体打击'}，同一原槽实际使用自有AA4-OSRIC-CLUB普通棍击18×身体，0灵性（G）`}${a.guardApplied ? `；实际护腕${a.guard!.guardId}/${a.guard!.segmentId}只将本次正攻击×0.6后失活，原槽与已付敌灵性不退` : ''}。不重抽或直接扣健康。`;
  return a;
}
export function resolveAncientAlchemistCombatAbility(s: SliceState, id: AncientAlchemistMoveId, physicalStateFactor: number, random: ActionRandomStream,
  r: AncientAlchemistRoundContext, source: AncientAlchemistCombatSource | null = r.source): AncientAlchemistCombatEffect {
  if (!validRound(s, r, source) || !ABILITIES.some(a => a.id === id)) return none('缺少本回合同一原活人与原资源来源，0贡献、0消耗，不重抽。');
  const next = structuredClone(r.model);
  const a = playerAction(r.source, next, id, bounded(physicalStateFactor, 1), r.playerActions.length + r.enemyActions.length, random);
  if (a.guard && (stableStringify(getAncientAlchemistGuardSegment(s)) !== stableStringify(a.guard) ||
      !consumeAncientAlchemistGuardSegment(s, a.guard.guardId, a.guard.segmentId))) throw new Error('同一真实护腕段已不存在，不能改用虚构库存。');
  r.model = next; r.playerActions.push(a); commitModel(s, r); return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
export function resolveAncientAlchemistEnemyAbility(s: SliceState, planned: AncientAlchemistEnemyIntent, physicalStateFactor: number, _random: ActionRandomStream,
  r: AncientAlchemistRoundContext, source: AncientAlchemistCombatSource | null = r.source): AncientAlchemistCombatEffect {
  if (!validRound(s, r, source) || ![...ANCIENT_ALCHEMIST_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned)) return none('缺少同一原奥斯里克的实际来源，0贡献、0消耗，不重抽。');
  const a = enemyAction(r.source, r.model, planned, bounded(physicalStateFactor, 1), r.playerActions.length + r.enemyActions.length);
  r.enemyActions.push(a); commitModel(s, r); return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
export interface AncientAlchemistRoundOutcome {
  targetId: typeof ANCIENT_ALCHEMIST_TARGET_ID; round: number; source: AncientAlchemistCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; playerHealthBeforeConsequence: number;
  enemySpiritualityBefore: number; powerUses: Record<AncientAlchemistPowerId, number>; guardAttempts: number;
  guardReady: null; guardExpired: true; elapsedSeconds: 60; remainingGuardSegments: AncientAlchemistGuardReference[];
  playerActions: AncientAlchemistPlayerAction[]; enemyActions: AncientAlchemistEnemyAction[];
}
export function finishAncientAlchemistCombatRound(s: SliceState, r: AncientAlchemistRoundContext, continuing = true): AncientAlchemistRoundOutcome {
  if (r.finished || s.combat?.encounterId !== 'ANCIENT_ALCHEMIST_DISPUTE' || s.combat.round !== r.source.round || r.liveState !== liveState(s)) throw new Error('同一原回合已结束、不存在或原资源被改写。');
  const e = s.ancientAlchemist.encounter, c = s.combat;
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  e.guardReady = null; r.model.guardReady = null; r.finished = true;
  return { targetId: ANCIENT_ALCHEMIST_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus,
    playerSpiritualityBefore: r.playerSpiritualityBefore, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind,
    playerHealthBeforeConsequence: r.model.playerHealth, enemySpiritualityBefore: r.enemySpiritualityBefore, powerUses: { ...e.powerUses }, guardAttempts: e.guardAttempts,
    guardReady: null, guardExpired: true, elapsedSeconds: 60, remainingGuardSegments: availableReferences(s),
    playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
}
export function projectAncientAlchemistCombat(s: SliceState) {
  const e = s.ancientAlchemist.encounter;
  return { enemyName: '奥斯里克·维尔（AA4-OSRIC-VALE，原创成年序列5对手，G）', targetId: e.targetId, enemySpirituality: e.enemySpirituality,
    powerUses: { ...e.powerUses }, guardReady: e.guardReady && { ...e.guardReady }, guardAttempts: e.guardAttempts, availableGuardSegments: availableReferences(s),
    originalExit: true, pursuit: false, distanceMetres: 2, source: currentAncientAlchemistCombatSource(s),
    summary: `原奥斯里克灵性${e.enemySpirituality}/40，原棍始终属本人。B只用真实付费制作护腕剩余段，原段×1与4灵性、知识18成功后护住后续一次正BODY/ARC至60%，最多60秒、轮末失活，无自动补充。失败仍耗原段与4灵性。K继承3灵性浅壤土完整潜入再出；R仅按原掌握实付4灵性恢复实际健康，不清原伤与风险。全部新生命炼成细则为有限G，无灵魂、复活或无限素材；旧马伦及原物不改。` };
}
/** Replays the ordered paid actions and original segment references, including actual healing. */
export function validateAncientAlchemistRoundOutcome(v: unknown): v is AncientAlchemistRoundOutcome {
  try { return validateOutcome(v); } catch { return false; }
}
function validateOutcome(v: unknown): v is AncientAlchemistRoundOutcome {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const p = v as AncientAlchemistRoundOutcome, a = p.source;
  const integer = (n: unknown, min: number, max = Number.MAX_SAFE_INTEGER): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
  const resource = (n: unknown, max = 120): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
  const usesValid = (u: Record<AncientAlchemistPowerId, number>) => u && typeof u === 'object' && Object.keys(u).length === 3 && ANCIENT_ALCHEMIST_POWER_IDS.every(id => integer(u[id], 0));
  const refsValid = (refs: AncientAlchemistGuardReference[]) => Array.isArray(refs) && refs.length <= 3 && refs.every(g => g && typeof g.guardId === 'string' && /^AA4-GUARD-\d+$/.test(g.guardId) && typeof g.segmentId === 'string' && g.segmentId.length > 0) && new Set(refs.map(g => `${g.guardId}/${g.segmentId}`)).size === refs.length && new Set(refs.map(g => g.guardId)).size <= 1;
  if (!a || a.targetId !== ANCIENT_ALCHEMIST_TARGET_ID || a.encounterId !== 'ANCIENT_ALCHEMIST_DISPUTE' || a.round !== p.round ||
      typeof a.runId !== 'string' || !a.runId.length || !integer(a.revision, 0) || !integer(a.week, 1) || a.attemptWeek !== a.week || !integer(a.startHistoryIndex, 0) ||
      !integer(a.playerHealth, 1, 100) || !integer(a.playerMind, 1, 100) || !integer(a.enemyHealth, 1, 100) || !integer(a.enemyMind, 1, 100) || !integer(a.knowledge, 0, 500) ||
      !Array.isArray(a.enemyInjuries) || a.enemyInjuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision, 0, a.revision) || (i.treatedRevision !== null && !integer(i.treatedRevision, i.acquiredRevision, a.revision))) ||
      !['SHOP', 'BAG', 'HAND'].includes(a.clubLocation) || a.actualOriginalBody !== true || a.mutuallyVisible !== true || a.distanceMetres !== 2 || a.noBystanders !== true ||
      a.ordinaryExit !== true || a.pursuit !== false || a.targetAlive !== true || a.independentMind !== true || a.targetSequence !== 5 || a.targetPhysique !== 20 ||
      a.enemyWeapon !== 'AA4-OSRIC-CLUB' || a.space !== 'ORIGINAL_NURSERY_LOAM_COURTYARD' || a.ground !== 'KNOWN_SHALLOW_ORDINARY_LOAM' ||
      ![a.carefulMastery, a.specimenMastery, a.groundMastery, a.lifeSupportMastery].every(n => resource(n, 500)) || !usesValid(a.powerUses) ||
      !integer(a.guardAttempts, 0) || !refsValid(a.guardSegments) || !refsValid(p.remainingGuardSegments)) return false;
  if (p.targetId !== ANCIENT_ALCHEMIST_TARGET_ID || !integer(p.round, 1) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(p.stance) ||
      !integer(p.enemyHealth, 0, a.enemyHealth) || p.enemyMind !== a.enemyMind || !integer(p.enemySpirituality, 0, 40) || !integer(p.enemySpiritualityBefore, p.enemySpirituality, 40) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(p.enemyStatus) || (p.enemyStatus === 'DEAD') !== (p.enemyHealth === 0) ||
      !resource(p.playerSpiritualityBefore) || !resource(p.playerSpiritualityAfter) || p.playerSpiritualityAfter > p.playerSpiritualityBefore ||
      !integer(p.playerHealthBeforeConsequence, a.playerHealth, 100) || !integer(p.playerHealthAfter, 0, p.playerHealthBeforeConsequence) || p.playerMindAfter !== a.playerMind || !usesValid(p.powerUses) ||
      p.enemySpiritualityBefore !== 40 - ANCIENT_ALCHEMIST_POWERS.reduce((n, x) => n + a.powerUses[x.id] * x.cost, 0) ||
      p.enemySpirituality !== 40 - ANCIENT_ALCHEMIST_POWERS.reduce((n, x) => n + p.powerUses[x.id] * x.cost, 0) ||
      p.guardReady !== null || p.guardExpired !== true || p.elapsedSeconds !== 60 ||
      typeof p.continuing !== 'boolean' || (p.continuing && (p.enemyStatus !== 'RESISTING' || p.playerHealthAfter <= 0)) ||
      !Array.isArray(p.playerActions) || p.playerActions.length > 6 || !Array.isArray(p.enemyActions) || p.enemyActions.length > 4 ||
      (p.stance === 'RETREAT' && p.playerActions.length !== 0)) return false;
  const ordered = [...p.playerActions.map(x => ({ actor: 'PLAYER' as const, action: x })), ...p.enemyActions.map(x => ({ actor: 'ENEMY' as const, action: x }))];
  if (ordered.some(x => !x.action || !integer(x.action.order, 0, 9))) return false;
  ordered.sort((x, y) => x.action.order - y.action.order);
  const m = initialModel(a, p.playerSpiritualityBefore, p.enemySpiritualityBefore);
  for (let index = 0; index < ordered.length; index++) {
    const entry = ordered[index]!, x = entry.action;
    if (x.order !== index || !resource(x.physicalFactor, 1) || !Array.isArray(x.rolls) || x.rolls.some(n => !integer(n, 1, 100))) return false;
    let cursor = 0;
    const random: ActionRandomStream = { seed: 'recorded-ancient-alchemist-action', get cursor() { return cursor; }, nextInt(min, max) {
      const n = x.rolls[cursor++]; if (n === undefined || n < min || n > max) throw new Error('缺少原判定'); return n;
    } };
    if (entry.actor === 'PLAYER' ? !ABILITIES.some(move => move.id === entry.action.id) : ![...ANCIENT_ALCHEMIST_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(entry.action.planned)) return false;
    const expected = entry.actor === 'PLAYER' ? playerAction(a, m, entry.action.id, x.physicalFactor, index, random)
      : enemyAction(a, m, entry.action.planned, x.physicalFactor, index);
    if (cursor !== x.rolls.length || stableStringify(expected) !== stableStringify(x)) return false;
  }
  return m.playerSpirituality === p.playerSpiritualityAfter && m.playerHealth === p.playerHealthBeforeConsequence && m.enemySpirituality === p.enemySpirituality &&
    stableStringify(m.powerUses) === stableStringify(p.powerUses) && m.guardAttempts === p.guardAttempts && stableStringify(m.availableSegments) === stableStringify(p.remainingGuardSegments);
}
