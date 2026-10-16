import { computeCheckChance } from '../../resolution/normal-check.js';
import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { LawyerCombatSource } from '../lawyer/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasMentorDisorderDisputeOpponent, hasMentorDisorderOpenPractice } from './encounter.js';

/** S5 finite G profile: tier900/floor90/max100. Only disorder is newly acquired.
 * Inherited gifts remain the same originals in state.briber.gifts. */
export const MENTOR_DISORDER_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 12 }),
  Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 23 }),
  Object.freeze({ id: '5', label: '5次', weight: 14 }),
  Object.freeze({ id: '6', label: '6次', weight: 6 }),
]);
export type MentorDisorderMoveId = 'black-emperor.s8.enhanced-body' | 'BODY_FOLLOWUP'
  | 'black-emperor.s7.bribery-weakening' | 'black-emperor.s5.disorder'
  | 'black-emperor.s8.mental-resistance' | 'ACCIDENT';
const ABILITIES: readonly {
  id: MentorDisorderMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'black-emperor.s8.enhanced-body', label: '继承强化身体打击（G；59.15×原身体掌握×身体）', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承强化身体侧击（G；41.405×原身体掌握×身体）', weight: 15, stance: 'ATTACK' },
  { id: 'black-emperor.s7.bribery-weakening', label: '赠出原物削弱／继承破绽护身（原礼物1件、3灵性）', weight: 25, stance: 'DEFEND' },
  { id: 'black-emperor.s5.disorder', label: '有限混乱下一次实际普通打击（G；3灵性、知识14；成功后×0.6一次）', weight: 10, stance: 'CONTROL' },
  { id: 'black-emperor.s8.mental-resistance', label: '核实继承精神抗性的适用来源（无源则0贡献、0消耗）', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '时机或失衡（G；固定−22.5，不另掷正负）', weight: 5, stance: null },
];
export function isMentorDisorder(state: SliceState): boolean {
  return state.progression?.pathwayId === 'black-emperor' && state.progression.sequence === 5;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function mentorDisorderAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'black-emperor.s8.enhanced-body' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawMentorDisorderAbility(random: ActionRandomStream, stance: SliceStance | null): MentorDisorderMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('混乱导师能力盘权重无效');
}
export function mentorDisorderActionCount(roll: number): number {
  return roll <= 12 ? 1 : roll <= 32 ? 2 : roll <= 57 ? 3 : roll <= 80 ? 4 : roll <= 94 ? 5 : 6;
}

export type MentorDisorderCombatSource = LawyerCombatSource | {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'MENTOR_DISORDER_DISPUTE'; attemptWeek: number; startHistoryIndex: number;
  target: 'REES_SINGLE_ADULT_ORDINARY_HUMAN'; nature: 'ORDINARY_HUMAN';
  body: 'CURRENT_REACHABLE_BODY'; weapon: 'REESS_OWN_ORDINARY_SHORT_CLUB'; weaponLocation: 'HAND';
  space: 'ORIGINAL_CLEAR_COURTYARD'; visibility: 'MUTUALLY_VISIBLE'; distanceMetres: 2;
  ground: 'CLEAR_ORDINARY_GROUND'; daylight: true; bystanders: 'NONE'; exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
};
/** New S5 gate. The original S6/S7 gates remain exact and unchanged. */
export function currentMentorDisorderCombatSource(state: SliceState): MentorDisorderCombatSource | null {
  const combat = state.combat;
  if (!isMentorDisorder(state) || state.status !== 'ACTIVE' || !Number.isFinite(state.health) || state.health <= 0 ||
      !Number.isFinite(state.mind) || state.mind <= 0 || state.activeEvent !== null ||
      !combat || combat.enemyStatus !== 'RESISTING' || !Number.isFinite(combat.enemyHealth) || combat.enemyHealth <= 0 ||
      !Number.isFinite(combat.enemyMind) || combat.enemyMind <= 0 || state.world.city !== 'BACKLUND' ||
      hasMentorDisorderOpenPractice(state) ||
      Object.values(state.mentorDisorder.cases).some(record => record.contactOpen || record.status === 'PREPARED') ||
      !Number.isSafeInteger(combat.round) || combat.round < 1 ||
      !Number.isSafeInteger(state.revision) || state.revision < 0 ||
      !Number.isSafeInteger(state.week) || state.week < 1) return null;
  if (combat.encounterId === 'FIRST_CASE') {
    if (state.arc.stage !== 'COMBAT' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
    return { runId: state.runId, revision: state.revision, week: state.week, encounterId: 'FIRST_CASE',
      round: combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER', body: 'CURRENT_REACHABLE_BODY',
      space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' };
  }
  const e = state.mentorDisorder.encounter;
  if (!hasMentorDisorderDisputeOpponent(state) || e.startHistoryIndex === null ||
      state.combatHistory.length - e.startHistoryIndex !== combat.round - 1 ||
      !state.combatHistory.slice(e.startHistoryIndex).every((round, index) =>
        round.round === index + 1 && round.winner !== null && round.retreat !== 'SUCCESS')) return null;
  return { runId: state.runId, revision: state.revision, week: state.week, round: combat.round,
    encounterId: 'MENTOR_DISORDER_DISPUTE', attemptWeek: state.week, startHistoryIndex: e.startHistoryIndex,
    target: 'REES_SINGLE_ADULT_ORDINARY_HUMAN', nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY',
    weapon: 'REESS_OWN_ORDINARY_SHORT_CLUB', weaponLocation: 'HAND', space: 'ORIGINAL_CLEAR_COURTYARD',
    visibility: 'MUTUALLY_VISIBLE', distanceMetres: 2, ground: 'CLEAR_ORDINARY_GROUND', daylight: true, bystanders: 'NONE',
    exit: 'ORIGINAL_OPEN_EXIT', pursuit: false };
}
function validSource(state: SliceState, source: MentorDisorderCombatSource | null): boolean {
  const current = currentMentorDisorderCombatSource(state);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
function masteryFactor(state: SliceState,
  id: 'black-emperor.s8.enhanced-body' | 'black-emperor.s9.weak-point-insight'
    | 'black-emperor.s7.bribery-weakening',
): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}
export interface MentorDisorderCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): MentorDisorderCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
/** Synchronous round-local effect only, never another inventory or saved flag. */
export interface MentorDisorderRoundContext {
  source: MentorDisorderCombatSource | null;
  pendingWeakening: { giftId: string; factor: number } | null;
  pendingDisorder: boolean;
}
export function createMentorDisorderRoundContext(state: SliceState): MentorDisorderRoundContext {
  return { source: currentMentorDisorderCombatSource(state), pendingWeakening: null, pendingDisorder: false };
}
const groundDestination = (source: MentorDisorderCombatSource) => `BATTLE:${source.encounterId}:GROUND`;
const display = (value: number) => Number(value.toFixed(6));

/** Consume after resolving the next actual player-targeted enemy action, including a MISS. */
export function consumeMentorDisorderWeakening(
  state: SliceState, context: MentorDisorderRoundContext, target: 'PLAYER' | 'OTHER',
  selfGain: number, enemyReduction: number,
): { selfGain: number; enemyReduction: number; label: string } | null {
  const pending = context.pendingWeakening;
  if (target !== 'PLAYER' || !pending || !validSource(state, context.source)) return null;
  const source = context.source!;
  const original = state.briber.gifts.find(gift => gift.id === pending.giftId);
  if (!original || original.location !== 'GIVEN' || original.destination !== groundDestination(source) ||
      original.givenWeek !== source.week) return null;
  context.pendingWeakening = null;
  const gain = selfGain * (1 - pending.factor), reduction = enemyReduction * (1 - pending.factor);
  return { selfGain: gain, enemyReduction: reduction,
    label: `原赠物${pending.giftId}的继承贿赂削弱用于本轮下一次实际针对你的行动（G）：敌方自身增势${display(selfGain)}→${display(gain)}，对你减势${display(enemyReduction)}→${display(reduction)}；本次实际因子×${display(1 - pending.factor)}；本次后失效，即使动作落空也已消耗，不追加行动` };
}
/** Disorder consumes only a later positive ordinary STRIKE, never MISS/OPENING or a suppressed slot. */
export function consumeMentorDisorderStrike(
  state: SliceState, context: MentorDisorderRoundContext, id: string, contribution: number, suppressed = false,
): { physicalMultiplier: number; label: string } | null {
  if (id !== 'STRIKE' || suppressed || !Number.isFinite(contribution) || contribution <= 0 ||
      !context.pendingDisorder || !validSource(state, context.source)) return null;
  context.pendingDisorder = false;
  return { physicalMultiplier: 0.6,
    label: `已成功的有限混乱只偏移这一次实际普通打击轨迹：正贡献${display(contribution)}×0.6=${display(contribution * 0.6)}（G），本次后结束；若原赠物削弱也真实待用，继续乘其独立因子并各自消耗，不重抽、不追改此前动作、不取消行动或自动致伤` };
}
export function finishMentorDisorderCombatRound(context: MentorDisorderRoundContext): string | null {
  const labels: string[] = [];
  if (context.pendingWeakening) {
    labels.push(`本轮未再发生针对你的敌方实际行动，原赠物${context.pendingWeakening.giftId}的待用贿赂削弱已失效；不追溯此前动作，原物仍留在战场地面，不自动归还。`);
    context.pendingWeakening = null;
  }
  if (context.pendingDisorder) {
    labels.push('本轮结束，尚未作用于实际正贡献普通打击的有限混乱已到期，不追溯此前动作、不追补减势、不带到下一轮；实付3灵性不退回。');
    context.pendingDisorder = false;
  }
  return labels.length ? labels.join('') : null;
}

export function resolveMentorDisorderCombatAbility(
  state: SliceState, id: MentorDisorderMoveId, physicalStateFactor: number, random: ActionRandomStream,
  context: MentorDisorderRoundContext,
  source: MentorDisorderCombatSource | null = currentMentorDisorderCombatSource(state),
): MentorDisorderCombatEffect {
  if (!validSource(state, source) || !validSource(state, context.source)) {
    return noEffect('混乱导师行动：缺少本场真实存活对手与原现场，或练习尚未收束；本次贡献0、消耗0，不重抽、不虚构抗拒或攻击意图');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'black-emperor.s8.enhanced-body': {
      const heldClub = state.town.clubLocation === 'HAND';
      const selfGain = (heldClub ? 16 : 59.15 * masteryFactor(state, id)) * physical;
      return { label: heldClub
        ? '持握原短棍打击：只采用实际在手的镇上原普通短棍16×身体（G），不叠加强化身体、贿赂或扭曲预算，0灵性，不取得里斯的原棍'
        : '继承强化身体打击：59.15×原野蛮人身体掌握×当前身体系数（G），0灵性；不附加扭曲攻击，不保证命中，伤势仍由共同后果盘结算',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 41.405 * masteryFactor(state, 'black-emperor.s8.enhanced-body') * physical;
      return { label: '继承强化身体侧击：41.405×原身体掌握×当前身体系数（G），0灵性；独立占本次行动，不追加攻击，不恢复伤势或精神',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'black-emperor.s7.bribery-weakening': {
      const gift = state.briber.gifts.find(candidate => candidate.location === 'PLAYER');
      if (!context.pendingWeakening && gift && Number.isFinite(state.spirituality) && state.spirituality >= 3) {
        gift.location = 'GIVEN'; gift.destination = groundDestination(source!); gift.givenWeek = state.week;
        state.spirituality -= 3;
        const factor = 0.35 * masteryFactor(state, id);
        context.pendingWeakening = { giftId: gift.id, factor };
        return noEffect(`实际朝当前普通对手赠出原木筹${gift.id}，原物离开旧贿赂者持有库存并落在本场地面，未成为敌方库存；消耗3灵性，本次增势0、减势0。无需对方自愿接住或收下，仅待本轮下一次实际针对你的行动削弱${display(factor * 100)}%（G），不追溯、不控制意志、不复制礼物、不追加行动`);
      }
      const reason = context.pendingWeakening ? '本轮已有一份待用贿赂削弱，不重复赠礼或支付'
        : !gift ? '没有实际持有的可赠原物，不凭空生成礼物' : '灵性不足3，不支付或赠出原物';
      return { ...noEffect(`可见破绽判断与护身：${reason}；采用继承律师36.45×原破绽掌握×身体的眼前防守（G），0灵性，不读取思想、不取消行动、不强制同意`),
        enemyReduction: 36.45 * masteryFactor(state, 'black-emperor.s9.weak-point-insight') * physical };
    }
    case 'black-emperor.s5.disorder': {
      if (context.pendingDisorder) return noEffect('本轮已有成功且待用的有限混乱：本次只观察原打击来源，0贡献、0消耗，不叠加、不再次支付或重抽');
      if (!Number.isFinite(state.spirituality) || state.spirituality < 3) {
        return { ...noEffect('灵性不足3：回退普通走位6×身体（G），0消耗；不透支、不生成混乱、不重抽'), enemyReduction: 6 * physical };
      }
      state.spirituality -= 3;
      const chance = computeCheckChance({ ability: 'knowledge', baseAbility: state.character.coreStats.knowledge, difficulty: 14, modifiers: [] });
      const roll = random.nextInt(1, 100), success = roll <= chance;
      context.pendingDisorder = success;
      return noEffect(success
        ? `有限混乱成功：实际耗3灵性，知识14判定${roll}≤${chance}；只待本轮下一次实际正贡献普通打击轨迹偏移×0.6（G），当前增势0、减势0，不保证后续有打击、不追溯、不取消意志或攻击，不提前取得序列4赋予、放大、利用`
        : `有限混乱失败：实际耗3灵性，知识14判定${roll}>${chance}；0贡献、没有待用效果，成本不退回，不重抽、不改变此前动作`);
    }
    case 'black-emperor.s8.mental-resistance':
      return noEffect('继承精神抗性：本场普通对手没有正在使用的有来源精神攻击，本次贡献0、消耗0；不是主动精神免疫、意志控制或恢复，不假造能力来消耗灵性');
    case 'ACCIDENT':
      return { ...noEffect('时机或失衡：本次固定−22.5战势（G），0灵性，不另掷正负；不是扭曲、重掷或额外致伤攻击'), selfGain: -22.5 };
  }
}
