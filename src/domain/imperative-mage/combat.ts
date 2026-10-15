import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PUNISHMENT_KNIGHT_COUNT_WHEEL, punishmentKnightActionCount } from '../punishment-knight/combat.js';
import type { SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { IMPERATIVE_MAGE_TARGET_ID, IMPERATIVE_MAGE_POWERS, IMPERATIVE_MAGE_POWER_IDS, hasImperativeMageDisputeOpponent,
  type ImperativeMageEnemyIntent, type ImperativeMagePowerId } from './encounter.js';

/** Ability categories have source support; every cost, duration and combat budget here is finite G. */
export const IMPERATIVE_MAGE_COUNT_WHEEL = PUNISHMENT_KNIGHT_COUNT_WHEEL;
export const imperativeMageActionCount = punishmentKnightActionCount;
export const IMPERATIVE_MAGE_ENEMY_COUNT_WHEEL: readonly SliceWheelEntry[] = [
  { id: '2', label: '2次', weight: 20 }, { id: '3', label: '3次', weight: 50 }, { id: '4', label: '4次', weight: 30 },
];
export const imperativeMageEnemyActionCount = (roll: number): number => roll <= 20 ? 2 : roll <= 70 ? 3 : 4;
export const IMPERATIVE_MAGE_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '原有限弧光：5灵性，贡献55（G）', weight: 35 },
  { id: 'WARD', label: '原有限护术：3灵性，对方−30（G）', weight: 25 },
  { id: 'BODY_STRIKE', label: '自有原棍打击：18×身体（G）', weight: 25 },
  { id: 'COMPOSE', label: '本轮凝神：3灵性，清除并抵抗本轮新震慑与剥夺（G）', weight: 10 },
  { id: 'ACCIDENT', label: '动作偏差：固定−22.5（G）', weight: 5 },
];
export type ImperativeMageMoveId = 'justiciar.s9.combat-training' | 'justiciar.s5.wound-verdict' | 'justiciar.s4.intimidation'
  | 'justiciar.s6.prohibition' | 'justiciar.s4.deprivation' | 'ACCIDENT';
const H = 'justiciar.s9.combat-training', J = 'justiciar.s5.wound-verdict', B = 'justiciar.s4.intimidation', K = 'justiciar.s6.prohibition', R = 'justiciar.s4.deprivation';
const ABILITIES: readonly { id: ImperativeMageMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: H, label: '继承格斗／实际违令后的有限惩戒（H；可另付3灵性，G）', weight: 30, stance: 'ATTACK' },
  { id: J, label: '真实旧伤裁断／普通侧击（J；有原伤才付3灵性、知识14，G）', weight: 15, stance: 'ATTACK' },
  { id: B, label: '有限震慑（B；4灵性、知识18；后续一次正攻击×0.6，G）', weight: 25, stance: 'DEFEND' },
  { id: K, label: '继承双方单次身体近击禁令（K；3灵性、实际动作时抵抗，G）', weight: 10, stance: 'CONTROL' },
  { id: R, label: '暂剥同一原弧光（R；4灵性、知识18；后续原槽改普通棍击，G）', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差（A；固定−22.5，G）', weight: 5, stance: null },
];
export const isImperativeMage = (s: SliceState): boolean => s.progression.pathwayId === 'justiciar' && s.progression.sequence === 4;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function imperativeMageAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, weight: weights[i]! / total * 100,
    label: a.id === H && s.town.clubLocation === 'HAND' ? '本人持握原短棍／实际违令后的有限惩戒（H；16×身体，可另付3灵性，G）' : a.label }));
}
export function drawImperativeMageAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): ImperativeMageMoveId {
  const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (let i = 0; i < ABILITIES.length; i++) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('律令法师能力盘权重无效。');
}
export function drawImperativeMageEnemyAbility(random: ActionRandomStream): ImperativeMageEnemyIntent {
  let roll = random.nextInt(1, 100);
  for (const a of IMPERATIVE_MAGE_ENEMY_ABILITY_WHEEL) { roll -= a.weight; if (roll <= 0) return a.id as ImperativeMageEnemyIntent; }
  throw new Error('原罗温动作盘权重无效。');
}
const bounded = (n: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));
const factor = (n: number) => .65 + .35 * bounded(n, 500) / 500;
const mastery = (s: SliceState, id: string) => bounded(s.progression.mastery[id] ?? 0, 500);
export interface ImperativeMageCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'IMPERATIVE_MAGE_DISPUTE'; targetId: typeof IMPERATIVE_MAGE_TARGET_ID; attemptWeek: number; startHistoryIndex: number;
  playerHealth: number; playerMind: number; enemyHealth: number; enemyMind: number; enemyInjuries: SliceInjury[]; knowledge: number;
  clubLocation: SliceState['town']['clubLocation']; actualOriginalBody: true; mutuallyVisible: true;
  distanceMetres: 2; noBystanders: true; ordinaryExit: true; pursuit: false; targetAlive: true; independentMind: true;
  targetSequence: 5; targetPhysique: 20; enemyWeapon: 'IM4-ROWAN-CLUB'; space: 'ORIGINAL_MEDIATION_CLEAR_COURTYARD';
  bodyMastery: number; woundMastery: number; punishmentMastery: number; traceMastery: number; prohibitionMastery: number;
  powerUses: Record<ImperativeMagePowerId, number>; intimidationAttempts: number; deprivationAttempts: number; punishmentUses: number;
}
export function currentImperativeMageCombatSource(s: SliceState): ImperativeMageCombatSource | null {
  if (!hasImperativeMageDisputeOpponent(s)) return null;
  const e = s.imperativeMage.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'IMPERATIVE_MAGE_DISPUTE', targetId: IMPERATIVE_MAGE_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, playerHealth: s.health, playerMind: s.mind,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemyInjuries: structuredClone(c.enemyInjuries), knowledge: s.character.coreStats.knowledge,
    clubLocation: s.town.clubLocation, actualOriginalBody: true, mutuallyVisible: true, distanceMetres: 2, noBystanders: true, ordinaryExit: true, pursuit: false,
    targetAlive: true, independentMind: true, targetSequence: 5, targetPhysique: 20, enemyWeapon: 'IM4-ROWAN-CLUB', space: 'ORIGINAL_MEDIATION_CLEAR_COURTYARD',
    bodyMastery: mastery(s, H), woundMastery: mastery(s, J), punishmentMastery: mastery(s, 'justiciar.s5.punishment'),
    traceMastery: mastery(s, 'justiciar.s8.trace-sensing'), prohibitionMastery: mastery(s, K), powerUses: { ...e.powerUses },
    intimidationAttempts: e.intimidationAttempts, deprivationAttempts: e.deprivationAttempts, punishmentUses: e.punishmentUses };
}
export interface ImperativeMageCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
interface ActionEvidence extends ImperativeMageCombatEffect {
  order: number; paidCost: number; physicalFactor: number; rolls: number[];
  checkChance: number | null; checkRoll: number | null; succeeded: boolean; resistedByComposure: boolean;
  prohibitionRoll: number | null; prohibitionThreshold: number | null; prohibitionBlocked: boolean; prohibitionResisted: boolean;
}
export interface ImperativeMagePlayerAction extends ActionEvidence { id: ImperativeMageMoveId; punishmentApplied: boolean }
export interface ImperativeMageEnemyAction extends ActionEvidence {
  planned: ImperativeMageEnemyIntent; actual: ImperativeMageEnemyIntent; deprivationApplied: boolean; intimidationApplied: boolean;
}
interface RoundModel {
  playerSpirituality: number; enemySpirituality: number; powerUses: Record<ImperativeMagePowerId, number>;
  intimidationReady: boolean; deprivationReady: boolean; composureReady: boolean; prohibitionPending: boolean; breachReady: boolean;
  intimidationAttempts: number; deprivationAttempts: number; punishmentUses: number;
}
export interface ImperativeMageRoundContext {
  source: ImperativeMageCombatSource; stance: SliceStance; finished: boolean; liveState: string;
  playerSpiritualityBefore: number; enemySpiritualityBefore: number; model: RoundModel;
  playerActions: ImperativeMagePlayerAction[]; enemyActions: ImperativeMageEnemyAction[]; label: string;
}
const none = (label: string): ImperativeMageCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
const dynamicSource = new Set(['powerUses', 'intimidationAttempts', 'deprivationAttempts', 'punishmentUses']);
function liveState(s: SliceState): string {
  const e = s.imperativeMage.encounter;
  return stableStringify({ playerSpirituality: s.spirituality, enemySpirituality: e.enemySpirituality, powerUses: e.powerUses,
    intimidationReady: e.intimidationReady, deprivationReady: e.deprivationReady, composureReady: e.composureReady,
    intimidationAttempts: e.intimidationAttempts, deprivationAttempts: e.deprivationAttempts, punishmentUses: e.punishmentUses });
}
function validRound(s: SliceState, r: ImperativeMageRoundContext, source: ImperativeMageCombatSource | null): boolean {
  const current = currentImperativeMageCombatSource(s);
  return !r.finished && current !== null && source !== null && stableStringify(source) === stableStringify(r.source) &&
    Object.entries(r.source).every(([k, v]) => dynamicSource.has(k) || stableStringify(current[k as keyof ImperativeMageCombatSource]) === stableStringify(v)) && r.liveState === liveState(s);
}
const initialModel = (source: ImperativeMageCombatSource, player: number, enemy: number): RoundModel => ({
  playerSpirituality: player, enemySpirituality: enemy, powerUses: { ...source.powerUses }, intimidationReady: false, deprivationReady: false,
  composureReady: false, prohibitionPending: false, breachReady: false, intimidationAttempts: source.intimidationAttempts,
  deprivationAttempts: source.deprivationAttempts, punishmentUses: source.punishmentUses,
});
function commitModel(s: SliceState, r: ImperativeMageRoundContext): void {
  const { playerSpirituality, prohibitionPending: _p, breachReady: _b, ...enemy } = r.model;
  s.spirituality = playerSpirituality; Object.assign(s.imperativeMage.encounter, enemy); r.liveState = liveState(s);
}
export function beginImperativeMageCombatRound(s: SliceState, stance: SliceStance, _random: ActionRandomStream): ImperativeMageRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('战术姿态无效。');
  const source = currentImperativeMageCombatSource(s), e = s.imperativeMage.encounter;
  if (!source || e.intimidationReady || e.deprivationReady || e.composureReady) throw new Error('缺少同一原罗温的新回合来源，或上轮短效尚未结束。');
  return { source, stance, finished: false, liveState: liveState(s), playerSpiritualityBefore: s.spirituality, enemySpiritualityBefore: e.enemySpirituality,
    model: initialModel(source, s.spirituality, e.enemySpirituality), playerActions: [], enemyActions: [],
    label: `原罗温本人在日光净空外院2米外，灵性${e.enemySpirituality}/40，有独立心智；原弧光能力属于本人，原普通出口开放。` };
}
function evidence(order: number, physical: number): ActionEvidence {
  return { ...none(''), order, paidCost: 0, physicalFactor: physical, rolls: [], checkChance: null, checkRoll: null, succeeded: false,
    resistedByComposure: false, prohibitionRoll: null, prohibitionThreshold: null, prohibitionBlocked: false, prohibitionResisted: false };
}
function draw(random: ActionRandomStream, a: ActionEvidence): number { const roll = random.nextInt(1, 100); a.rolls.push(roll); return roll; }
function prohibition(source: ImperativeMageCombatSource, m: RoundModel, a: ActionEvidence, random: ActionRandomStream): boolean {
  if (!m.prohibitionPending) return false;
  m.prohibitionPending = false; a.prohibitionThreshold = 55 + 20 * source.prohibitionMastery / 500;
  a.prohibitionRoll = draw(random, a); a.prohibitionBlocked = a.prohibitionRoll <= a.prohibitionThreshold; a.prohibitionResisted = !a.prohibitionBlocked;
  a.label = `原身体近击禁令在本次实际身体动作才判定${a.prohibitionRoll}/${a.prohibitionThreshold}（G）；${a.prohibitionBlocked ? '生效，本次原槽贡献0，不形成实际违令' : '被抵抗，原动作继续；只有敌方实际正贡献BODY才记违令'}。单次禁令结束，不重抽。`;
  return a.prohibitionBlocked;
}
function playerAction(source: ImperativeMageCombatSource, m: RoundModel, id: ImperativeMageMoveId, physical: number,
  order: number, random: ActionRandomStream): ImperativeMagePlayerAction {
  const a: ImperativeMagePlayerAction = { ...evidence(order, physical), id, punishmentApplied: false };
  const pay = (cost: number) => { if (m.playerSpirituality < cost) return false; m.playerSpirituality -= cost; a.paidCost += cost; return true; };
  const wound = id === J && source.enemyInjuries.length > 0 && m.playerSpirituality >= 3;
  if ((id === H || (id === J && !wound)) && prohibition(source, m, a, random)) return a;
  const prefix = a.label;
  if (id === H) {
    a.selfGain = (source.clubLocation === 'HAND' ? 16 : 50.7 * factor(source.bodyMastery)) * physical;
    if (m.breachReady && pay(3)) { m.breachReady = false; m.punishmentUses++; a.punishmentApplied = true; a.selfGain += 20 * factor(source.punishmentMastery) * physical; }
    a.threatens = a.selfGain > 0;
    a.label = `${prefix}${source.clubLocation === 'HAND' ? '本人实际持握原普通短棍16×身体' : '继承格斗50.7×原格斗掌握×身体'}（G）；${a.punishmentApplied ? '依据本轮此前敌方实际抵抗禁令并完成正贡献BODY，实付3灵性、消耗来源，在同一次H加入20×原惩戒掌握×身体' : '没有可实付的实际违令惩戒来源，0额外消耗、0惩戒预算'}。不追加行动，伤势只走共同后果盘。`;
  } else if (id === J) {
    if (!wound) { a.selfGain = 35.49 * factor(source.bodyMastery) * physical; a.threatens = a.selfGain > 0;
      a.label = `${prefix}${source.enemyInjuries.length === 0 ? '没有实际敌方既有伤口' : '不足3灵性'}，普通侧击35.49×原格斗掌握×身体（G），0消耗、不抽裁断盘，不虚构伤口。`;
    } else {
      pay(3); a.checkChance = computeCheckChance({ ability: 'knowledge', baseAbility: source.knowledge, difficulty: 14, modifiers: [] });
      a.checkRoll = draw(random, a); a.succeeded = a.checkRoll <= a.checkChance; a.selfGain = a.succeeded ? 45 * factor(source.woundMastery) : 0; a.threatens = a.selfGain > 0;
      a.label = `原伤裁断实付3灵性、知识14判定${a.checkRoll}/${a.checkChance}（G）；${a.succeeded ? '依当前原敌真实旧伤形成45×原裁断掌握的有限致伤战势' : '失败，贡献0且成本不退'}。不乘身体，不消耗待用身体禁令，不直接扣健康、低血处决或保证一句话死亡。`;
    }
  } else if (id === K) {
    if (m.prohibitionPending) a.label = '本轮已有待用单次身体禁令：重复K占原槽，0消耗、0判定，不叠加。';
    else if (!pay(3)) { a.enemyReduction = 6 * physical; a.label = '不足3灵性：普通走位6×身体（G），0消耗，不制造禁令。'; }
    else { m.prohibitionPending = true; a.label = '实付3灵性宣布继承单次双方身体近击禁令（G）；只在后续一次本人身体H/普通J或原敌实际BODY才抵抗，当前贡献0。不限制弧光、护术或凝神，不改已完成行动，不是绝对法域。'; }
  } else if (id === B || id === R) {
    const intimidation = id === B, pending = intimidation ? m.intimidationReady : m.deprivationReady;
    if (pending) a.label = `本轮已有待用${intimidation ? '震慑' : '原弧光剥夺'}：重复槽0贡献、0消耗、0判定，不叠加或续期。`;
    else if (!pay(4)) { a.enemyReduction = intimidation ? 42.25 * factor(source.traceMastery) * physical : 0;
      a.label = intimidation ? '不足4灵性：继承痕迹护身42.25×原痕迹掌握×身体（G），0消耗、不虚构震慑。' : '不足4灵性：普通观察，0贡献、0消耗，不制造剥夺。';
    } else {
      if (intimidation) m.intimidationAttempts++; else m.deprivationAttempts++;
      a.checkChance = computeCheckChance({ ability: 'knowledge', baseAbility: source.knowledge, difficulty: 18, modifiers: [] }); a.checkRoll = draw(random, a);
      a.resistedByComposure = m.composureReady; a.succeeded = a.checkRoll <= a.checkChance && !m.composureReady;
      if (a.succeeded) { if (intimidation) m.intimidationReady = true; else m.deprivationReady = true; }
      a.label = `${intimidation ? '有限震慑' : '暂剥同一原弧光'}实付4灵性、知识18判定${a.checkRoll}/${a.checkChance}（G）；${a.resistedByComposure ? '原罗温本轮已凝神，实际抵抗，成本不退' : !a.succeeded ? '失败，贡献0且成本不退' : intimidation ? '只削弱本轮下一次实际正贡献BODY或ARC至60%，不取消原行动' : '仅使同一原弧光本轮剩余时间不可用，后续ARC原槽实际回退普通棍击且0法术消耗，回合末恢复'}。不追改过去，不强制真话或投降，不永久删能力、不复制学习；不是统一两条上限。`;
    }
  } else { a.selfGain = -22.5; a.label = '动作偏差固定−22.5战势（G），0灵性，不另掷正负。'; }
  return a;
}
function enemyAction(source: ImperativeMageCombatSource, m: RoundModel, planned: ImperativeMageEnemyIntent, physical: number,
  order: number, random: ActionRandomStream): ImperativeMageEnemyAction {
  const power = IMPERATIVE_MAGE_POWERS.find(p => p.id === planned), deprived = planned === 'ARC_BOLT' && m.deprivationReady;
  const payable = !!power && !deprived && m.enemySpirituality >= power.cost;
  const actual: ImperativeMageEnemyIntent = planned === 'ACCIDENT' ? planned : payable ? planned : 'BODY_STRIKE';
  const a: ImperativeMageEnemyAction = { ...evidence(order, physical), planned, actual, deprivationApplied: deprived, intimidationApplied: false };
  if (actual === 'BODY_STRIKE' && prohibition(source, m, a, random)) return a;
  const prefix = a.label;
  if (payable) { a.paidCost = power!.cost; m.enemySpirituality -= a.paidCost; m.powerUses[power!.id]++; }
  if (actual === 'COMPOSE') { m.intimidationReady = false; m.deprivationReady = false; m.composureReady = true; }
  const attack = actual === 'BODY_STRIKE' || actual === 'ARC_BOLT';
  const raw = actual === 'ACCIDENT' ? -22.5 : payable ? power!.selfGain : 18 * physical;
  a.intimidationApplied = attack && raw > 0 && m.intimidationReady;
  if (a.intimidationApplied) m.intimidationReady = false;
  a.selfGain = raw * (a.intimidationApplied ? .6 : 1); a.enemyReduction = payable ? power!.enemyReduction : 0; a.threatens = attack && a.selfGain > 0;
  if (actual === 'BODY_STRIKE' && a.prohibitionResisted && a.selfGain > 0) m.breachReady = true;
  a.label = `${prefix}${actual === 'ACCIDENT' ? '原罗温动作偏差固定−22.5、0灵性（G）' : actual === 'COMPOSE' ? `原罗温实际凝神实付3灵性、余${m.enemySpirituality}/40，0贡献；清除待用震慑、恢复同一弧光并本轮抵抗新震慑和剥夺` : payable ? `原罗温完成${power!.label}，实付${power!.cost}灵性、余${m.enemySpirituality}/40` : `${deprived ? '原弧光当前被暂剥' : power ? '原法术灵性不足' : '原身体打击'}，同一原槽实际使用自有IM4-ROWAN-CLUB普通棍击18×身体，0灵性（G）`}${a.intimidationApplied ? '；待用震慑只使本次正攻击×0.6后结束，原槽及法术实付不退' : ''}${actual === 'BODY_STRIKE' && a.prohibitionResisted && a.selfGain > 0 ? '；本次实际抵抗禁令并完成正贡献BODY，记录一份待用H惩戒来源' : ''}。不重抽、跳槽或直接扣健康。`;
  return a;
}
export function resolveImperativeMageCombatAbility(s: SliceState, id: ImperativeMageMoveId, physicalStateFactor: number, random: ActionRandomStream,
  r: ImperativeMageRoundContext, source: ImperativeMageCombatSource | null = r.source): ImperativeMageCombatEffect {
  if (!validRound(s, r, source) || !ABILITIES.some(a => a.id === id)) return none('缺少本回合同一原活人或原资源来源，0贡献、0消耗，不重抽。');
  const a = playerAction(r.source, r.model, id, bounded(physicalStateFactor, 1), r.playerActions.length + r.enemyActions.length, random);
  r.playerActions.push(a); commitModel(s, r); return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
export function resolveImperativeMageEnemyAbility(s: SliceState, planned: ImperativeMageEnemyIntent, physicalStateFactor: number, random: ActionRandomStream,
  r: ImperativeMageRoundContext, source: ImperativeMageCombatSource | null = r.source): ImperativeMageCombatEffect {
  if (!validRound(s, r, source) || ![...IMPERATIVE_MAGE_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned)) return none('缺少同一原罗温的实际来源，0贡献、0消耗，不重抽。');
  const a = enemyAction(r.source, r.model, planned, bounded(physicalStateFactor, 1), r.playerActions.length + r.enemyActions.length, random);
  r.enemyActions.push(a); commitModel(s, r); return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
export interface ImperativeMageRoundOutcome {
  targetId: typeof IMPERATIVE_MAGE_TARGET_ID; round: number; source: ImperativeMageCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number;
  enemySpiritualityBefore: number; powerUses: Record<ImperativeMagePowerId, number>;
  intimidationAttempts: number; deprivationAttempts: number; punishmentUses: number;
  intimidationReady: false; deprivationReady: false; composureReady: false; prohibitionPending: false; breachReady: false;
  playerActions: ImperativeMagePlayerAction[]; enemyActions: ImperativeMageEnemyAction[];
}
export function finishImperativeMageCombatRound(s: SliceState, r: ImperativeMageRoundContext, continuing = true): ImperativeMageRoundOutcome {
  if (r.finished || s.combat?.encounterId !== 'IMPERATIVE_MAGE_DISPUTE' || s.combat.round !== r.source.round || r.liveState !== liveState(s)) throw new Error('同一原回合已结束、不存在或原资源被改写。');
  const e = s.imperativeMage.encounter, c = s.combat;
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  e.intimidationReady = false; e.deprivationReady = false; e.composureReady = false;
  r.model.intimidationReady = false; r.model.deprivationReady = false; r.model.composureReady = false; r.model.prohibitionPending = false; r.model.breachReady = false; r.finished = true;
  return { targetId: IMPERATIVE_MAGE_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus,
    playerSpiritualityBefore: r.playerSpiritualityBefore, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind,
    enemySpiritualityBefore: r.enemySpiritualityBefore, powerUses: { ...e.powerUses }, intimidationAttempts: e.intimidationAttempts,
    deprivationAttempts: e.deprivationAttempts, punishmentUses: e.punishmentUses, intimidationReady: false, deprivationReady: false,
    composureReady: false, prohibitionPending: false, breachReady: false, playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
}
export function projectImperativeMageCombat(s: SliceState) {
  const e = s.imperativeMage.encounter;
  return { enemyName: '罗温·凯尔（IM4-ROWAN-KELL，原创成年序列5对手，G）', targetId: e.targetId, enemySpirituality: e.enemySpirituality,
    powerUses: { ...e.powerUses }, intimidationReady: e.intimidationReady, deprivationReady: e.deprivationReady, composureReady: e.composureReady,
    intimidationAttempts: e.intimidationAttempts, deprivationAttempts: e.deprivationAttempts, punishmentUses: e.punishmentUses,
    originalExit: true, pursuit: false, distanceMetres: 2, source: currentImperativeMageCombatSource(s),
    summary: `原罗温灵性${e.enemySpirituality}/40，原棍始终属本人。B实付4灵性、知识18，成功只把后续一次正BODY/ARC削至60%；R同成本检定只暂剥同一原弧光，后续ARC原槽改普通棍击且0法术消耗。凝神实付3灵性清除并本轮抵抗新B/R。K/H/J保留旧双方单次身体禁令、实际违令惩戒和真实旧伤裁断。所有短效回合末结束、同一弧光恢复，成本不退；不复制能力、保证真话、强制投降或凭一句话死亡。能力例出自0-08编排场，全部数值为有限G，不据此断言普遍成功或统一两条上限。完整配方与仪式未知，混乱猎手3未开放。`,
    enemyCountWheel: IMPERATIVE_MAGE_ENEMY_COUNT_WHEEL, enemyAbilityWheel: IMPERATIVE_MAGE_ENEMY_ABILITY_WHEEL };
}
/** Replays the actual ordered actions with their recorded check draws against one finite resource pool. */
export function validateImperativeMageRoundOutcome(v: unknown): v is ImperativeMageRoundOutcome {
  try { return validateOutcome(v); } catch { return false; }
}
function validateOutcome(v: unknown): v is ImperativeMageRoundOutcome {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const p = v as ImperativeMageRoundOutcome, a = p.source;
  const integer = (n: unknown, min: number, max = Number.MAX_SAFE_INTEGER): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
  const resource = (n: unknown, max = 120): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
  const usesValid = (u: Record<ImperativeMagePowerId, number>) => u && typeof u === 'object' && Object.keys(u).length === 3 && IMPERATIVE_MAGE_POWER_IDS.every(id => integer(u[id], 0, 13));
  if (!a || a.targetId !== IMPERATIVE_MAGE_TARGET_ID || a.encounterId !== 'IMPERATIVE_MAGE_DISPUTE' || a.round !== p.round ||
      typeof a.runId !== 'string' || !a.runId.length || !integer(a.revision, 0) || !integer(a.week, 1) || a.attemptWeek !== a.week || !integer(a.startHistoryIndex, 0) ||
      !integer(a.playerHealth, 1, 100) || !integer(a.playerMind, 1, 100) || !integer(a.enemyHealth, 1, 100) || !integer(a.enemyMind, 1, 100) || !integer(a.knowledge, 0, 500) ||
      !Array.isArray(a.enemyInjuries) || a.enemyInjuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision, 0) || i.acquiredRevision > a.revision || (i.treatedRevision !== null && !integer(i.treatedRevision, i.acquiredRevision, a.revision))) ||
      !['SHOP', 'BAG', 'HAND'].includes(a.clubLocation) || a.actualOriginalBody !== true || a.mutuallyVisible !== true || a.distanceMetres !== 2 || a.noBystanders !== true ||
      a.ordinaryExit !== true || a.pursuit !== false || a.targetAlive !== true || a.independentMind !== true || a.targetSequence !== 5 || a.targetPhysique !== 20 ||
      a.enemyWeapon !== 'IM4-ROWAN-CLUB' || a.space !== 'ORIGINAL_MEDIATION_CLEAR_COURTYARD' ||
      ![a.bodyMastery, a.woundMastery, a.punishmentMastery, a.traceMastery, a.prohibitionMastery].every(n => resource(n, 500)) || !usesValid(a.powerUses) ||
      ![a.intimidationAttempts, a.deprivationAttempts, a.punishmentUses].every(n => integer(n, 0))) return false;
  if (p.targetId !== IMPERATIVE_MAGE_TARGET_ID || !integer(p.round, 1) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(p.stance) ||
      !integer(p.enemyHealth, 0, a.enemyHealth) || p.enemyMind !== a.enemyMind || !integer(p.enemySpirituality, 0, 40) || !integer(p.enemySpiritualityBefore, p.enemySpirituality, 40) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(p.enemyStatus) || (p.enemyStatus === 'DEAD') !== (p.enemyHealth === 0) ||
      !resource(p.playerSpiritualityBefore) || !resource(p.playerSpiritualityAfter) || p.playerSpiritualityAfter > p.playerSpiritualityBefore ||
      !integer(p.playerHealthAfter, 0, a.playerHealth) || p.playerMindAfter !== a.playerMind || !usesValid(p.powerUses) ||
      p.enemySpiritualityBefore !== 40 - IMPERATIVE_MAGE_POWERS.reduce((n, x) => n + a.powerUses[x.id] * x.cost, 0) ||
      p.enemySpirituality !== 40 - IMPERATIVE_MAGE_POWERS.reduce((n, x) => n + p.powerUses[x.id] * x.cost, 0) ||
      p.intimidationReady !== false || p.deprivationReady !== false || p.composureReady !== false || p.prohibitionPending !== false || p.breachReady !== false ||
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
    const random: ActionRandomStream = { seed: 'recorded-imperative-mage-action', get cursor() { return cursor; }, nextInt(min, max) {
      const n = x.rolls[cursor++]; if (n === undefined || n < min || n > max) throw new Error('缺少原判定'); return n;
    } };
    if (entry.actor === 'PLAYER' ? !ABILITIES.some(m => m.id === entry.action.id) : ![...IMPERATIVE_MAGE_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(entry.action.planned)) return false;
    const expected = entry.actor === 'PLAYER' ? playerAction(a, m, entry.action.id, x.physicalFactor, index, random)
      : enemyAction(a, m, entry.action.planned, x.physicalFactor, index, random);
    if (cursor !== x.rolls.length || stableStringify(expected) !== stableStringify(x)) return false;
  }
  return m.playerSpirituality === p.playerSpiritualityAfter && m.enemySpirituality === p.enemySpirituality && stableStringify(m.powerUses) === stableStringify(p.powerUses) &&
    m.intimidationAttempts === p.intimidationAttempts && m.deprivationAttempts === p.deprivationAttempts && m.punishmentUses === p.punishmentUses;
}
