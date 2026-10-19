import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { LawyerCombatSource } from '../lawyer/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasCorruptionBaronDisputeOpponent } from './encounter.js';

/** S6 finite G profile: U65/P15, A1.4/E1.1. Only distortion is newly acquired.
 * Inherited gifts remain the same originals in state.briber.gifts. */
export const CORRUPTION_BARON_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 10 }),
  Object.freeze({ id: '2', label: '2次', weight: 15 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 30 }),
  Object.freeze({ id: '5', label: '5次', weight: 20 }),
]);
export type CorruptionBaronMoveId = 'black-emperor.s8.enhanced-body' | 'BODY_FOLLOWUP'
  | 'black-emperor.s7.bribery-weakening' | 'black-emperor.s6.distortion'
  | 'black-emperor.s8.mental-resistance' | 'ACCIDENT';
const ABILITIES: readonly {
  id: CorruptionBaronMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'black-emperor.s8.enhanced-body', label: '继承强化身体打击（G；59.15×原身体掌握×身体）', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承强化身体侧击（G；41.405×原身体掌握×身体）', weight: 15, stance: 'ATTACK' },
  { id: 'black-emperor.s7.bribery-weakening', label: '赠出原物削弱／继承破绽护身（原礼物1件、3灵性）', weight: 25, stance: 'DEFEND' },
  { id: 'black-emperor.s6.distortion', label: '有限扭曲本次抗拒或攻击意图（G；3灵性，否则普通走位）', weight: 10, stance: 'CONTROL' },
  { id: 'black-emperor.s8.mental-resistance', label: '核实继承精神抗性的适用来源（无源则0贡献、0消耗）', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '时机或失衡（G；固定−16.25，不另掷正负）', weight: 5, stance: null },
];
export function isCorruptionBaron(state: SliceState): boolean {
  return state.progression?.pathwayId === 'black-emperor' && state.progression.sequence === 6;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function corruptionBaronAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'black-emperor.s8.enhanced-body' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawCorruptionBaronAbility(random: ActionRandomStream, stance: SliceStance | null): CorruptionBaronMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('腐化男爵能力盘权重无效');
}
export function corruptionBaronActionCount(roll: number): number {
  return roll <= 10 ? 1 : roll <= 25 ? 2 : roll <= 50 ? 3 : roll <= 80 ? 4 : 5;
}

export type CorruptionBaronCombatSource = LawyerCombatSource | {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'CORRUPTION_BARON_DISPUTE'; attemptWeek: number; startHistoryIndex: number;
  target: 'VAUGHN_SINGLE_ADULT_ORDINARY_HUMAN'; nature: 'ORDINARY_HUMAN';
  body: 'CURRENT_REACHABLE_BODY'; weapon: 'VAUGHNS_OWN_ORDINARY_SHORT_CLUB'; weaponLocation: 'HAND';
  space: 'ORIGINAL_CLEAR_COURTYARD'; visibility: 'MUTUALLY_VISIBLE'; distanceMetres: 2;
  ground: 'CLEAR_ORDINARY_GROUND'; bystanders: 'NONE'; exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
};
/** This S6 gate is separate from Briber's unchanged S7 FIRST_CASE-only gate. */
export function currentCorruptionBaronCombatSource(state: SliceState): CorruptionBaronCombatSource | null {
  const combat = state.combat, practice = state.corruptionBaron.practice;
  if (!isCorruptionBaron(state) || state.status !== 'ACTIVE' || !Number.isFinite(state.health) || state.health <= 0 ||
      !Number.isFinite(state.mind) || state.mind <= 0 || state.activeEvent !== null ||
      !combat || combat.enemyStatus !== 'RESISTING' || !Number.isFinite(combat.enemyHealth) || combat.enemyHealth <= 0 ||
      !Number.isFinite(combat.enemyMind) || combat.enemyMind <= 0 || state.world.city !== 'BACKLUND' ||
      !['ORIGINAL', 'RESTORED'].includes(practice.clauseOrder) || !['CRADLED', 'STOPPED'].includes(practice.marker) ||
      !['READY', 'FREE'].includes(practice.route) ||
      Object.values(state.corruptionBaron.cases).some(record => record.contactOpen || record.status === 'PREPARED') ||
      !Number.isSafeInteger(combat.round) || combat.round < 1 ||
      !Number.isSafeInteger(state.revision) || state.revision < 0 ||
      !Number.isSafeInteger(state.week) || state.week < 1) return null;
  if (combat.encounterId === 'FIRST_CASE') {
    if (state.arc.stage !== 'COMBAT' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
    return { runId: state.runId, revision: state.revision, week: state.week, encounterId: 'FIRST_CASE',
      round: combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER', body: 'CURRENT_REACHABLE_BODY',
      space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' };
  }
  const e = state.corruptionBaron.encounter;
  if (!hasCorruptionBaronDisputeOpponent(state) || e.startHistoryIndex === null ||
      state.combatHistory.length - e.startHistoryIndex !== combat.round - 1 ||
      !state.combatHistory.slice(e.startHistoryIndex).every((round, index) =>
        round.round === index + 1 && round.winner !== null && round.retreat !== 'SUCCESS')) return null;
  return { runId: state.runId, revision: state.revision, week: state.week, round: combat.round,
    encounterId: 'CORRUPTION_BARON_DISPUTE', attemptWeek: state.week, startHistoryIndex: e.startHistoryIndex,
    target: 'VAUGHN_SINGLE_ADULT_ORDINARY_HUMAN', nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY',
    weapon: 'VAUGHNS_OWN_ORDINARY_SHORT_CLUB', weaponLocation: 'HAND', space: 'ORIGINAL_CLEAR_COURTYARD',
    visibility: 'MUTUALLY_VISIBLE', distanceMetres: 2, ground: 'CLEAR_ORDINARY_GROUND', bystanders: 'NONE',
    exit: 'ORIGINAL_OPEN_EXIT', pursuit: false };
}
function validSource(state: SliceState, source: CorruptionBaronCombatSource | null): boolean {
  const current = currentCorruptionBaronCombatSource(state);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
function masteryFactor(state: SliceState,
  id: 'black-emperor.s8.enhanced-body' | 'black-emperor.s9.weak-point-insight'
    | 'black-emperor.s7.bribery-weakening' | 'black-emperor.s6.distortion',
): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}
export interface CorruptionBaronCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): CorruptionBaronCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
/** Synchronous round-local effect only, never another inventory or saved flag. */
export interface CorruptionBaronRoundContext {
  source: CorruptionBaronCombatSource | null;
  pendingWeakening: { giftId: string; factor: number } | null;
}
export function createCorruptionBaronRoundContext(state: SliceState): CorruptionBaronRoundContext {
  return { source: currentCorruptionBaronCombatSource(state), pendingWeakening: null };
}
const groundDestination = (source: CorruptionBaronCombatSource) => `BATTLE:${source.encounterId}:GROUND`;
const display = (value: number) => Number(value.toFixed(6));

/** Consume after resolving the next actual player-targeted enemy action, including a MISS. */
export function consumeCorruptionBaronWeakening(
  state: SliceState, context: CorruptionBaronRoundContext, target: 'PLAYER' | 'OTHER',
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
    label: `原赠物${pending.giftId}的继承贿赂削弱用于本轮下一次实际针对你的行动（G）：敌方自身增势${display(selfGain)}→${display(gain)}，对你减势${display(enemyReduction)}→${display(reduction)}；本次后失效，即使动作落空也已消耗，不追加行动` };
}
export function finishCorruptionBaronCombatRound(context: CorruptionBaronRoundContext): string | null {
  if (!context.pendingWeakening) return null;
  const id = context.pendingWeakening.giftId;
  context.pendingWeakening = null;
  return `本轮未再发生针对你的敌方实际行动，原赠物${id}的待用贿赂削弱已失效；不追溯此前动作，原物仍留在战场地面，不自动归还。`;
}

export function resolveCorruptionBaronCombatAbility(
  state: SliceState, id: CorruptionBaronMoveId, physicalStateFactor: number, _random: ActionRandomStream,
  context: CorruptionBaronRoundContext,
  source: CorruptionBaronCombatSource | null = currentCorruptionBaronCombatSource(state),
): CorruptionBaronCombatEffect {
  if (!validSource(state, source) || !validSource(state, context.source)) {
    return noEffect('腐化男爵行动：缺少本场真实存活对手与原现场，或练习尚未收束；本次贡献0、消耗0，不重抽、不虚构抗拒或攻击意图');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'black-emperor.s8.enhanced-body': {
      const heldClub = state.town.clubLocation === 'HAND';
      const selfGain = (heldClub ? 16 : 59.15 * masteryFactor(state, id)) * physical;
      return { label: heldClub
        ? '持握原短棍打击：只采用实际在手的镇上原普通短棍16×身体（G），不叠加强化身体、贿赂或扭曲预算，0灵性，不取得沃恩的原棍'
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
    case 'black-emperor.s6.distortion':
      if (Number.isFinite(state.spirituality) && state.spirituality >= 3) {
        state.spirituality -= 3;
        return { ...noEffect('有限扭曲本次真实抗拒或攻击意图：实际耗3灵性，46.475×扭曲掌握（G），不乘身体系数；仅减轻眼前抵抗的战势，不强制服从、不永久改写意愿、不搬移人物或物件、不取消敌方行动，不下放混乱、放大或利用'),
          enemyReduction: 46.475 * masteryFactor(state, id) };
      }
      return { ...noEffect('灵性不足3：回退普通走位6×身体（G），0消耗；不透支、不生成扭曲、不重抽'), enemyReduction: 6 * physical };
    case 'black-emperor.s8.mental-resistance':
      return noEffect('继承精神抗性：本场普通对手没有正在使用的有来源精神攻击，本次贡献0、消耗0；不是主动精神免疫、意志控制或恢复，不假造能力来消耗灵性');
    case 'ACCIDENT':
      return { ...noEffect('时机或失衡：本次固定−16.25战势（G），0灵性，不另掷正负；不是扭曲、重掷或额外致伤攻击'), selfGain: -16.25 };
  }
}
