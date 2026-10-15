import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasRoseBishopDisputeOpponent } from './encounter.js';

/**
 * Rose Bishop S6: U65/P15, A1.2/E1.1; all weights, costs and contributions are G.
 * Canon permits own-body adjustment and flesh resources, including nonhuman
 * sources; it does not promise these healing amounts, possession or S5 grazing.
 */
export const ROSE_BISHOP_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 10 }),
  Object.freeze({ id: '2', label: '2次', weight: 15 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 30 }),
  Object.freeze({ id: '5', label: '5次', weight: 20 }),
]);
export type RoseBishopMoveId = 'hanged-man.s6.flesh-shaping' | 'BODY_FOLLOWUP'
  | 'hanged-man.s6.self-renewal' | 'hanged-man.s7.shadow-concealment' | 'CHECK_RESERVE' | 'ACCIDENT';
const ABILITIES: readonly {
  id: RoseBishopMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'hanged-man.s6.flesh-shaping', label: '本人有限血肉近击（G；2灵性与1实际储备）', weight: 25, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '本人强化身体次击（G；27.3×血肉掌握×身体，0消耗）', weight: 15, stance: 'ATTACK' },
  { id: 'hanged-man.s6.self-renewal', label: '存活受伤时有限自修复（G；3灵性与1实际储备，否则普通格挡）', weight: 25, stance: 'DEFEND' },
  { id: 'hanged-man.s7.shadow-concealment', label: '日光净空外院普通走位（G；无可用藏影）', weight: 15, stance: 'CONTROL' },
  { id: 'CHECK_RESERVE', label: '复核剩余实际血肉储备（0贡献、0消耗，不补充）', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '血肉或动作偏差（G；固定−16.25，不另掷正负）', weight: 5, stance: null },
];

export function isRoseBishop(state: SliceState): boolean {
  return state.progression?.pathwayId === 'hanged-man' && state.progression.sequence === 6;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function roseBishopAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'hanged-man.s6.flesh-shaping' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击（G；16×身体替换主攻，0灵性、保留血肉储备）' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawRoseBishopAbility(random: ActionRandomStream, stance: SliceStance | null): RoseBishopMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('蔷薇主教能力盘权重无效');
}
export function roseBishopActionCount(roll: number): number {
  return roll <= 10 ? 1 : roll <= 25 ? 2 : roll <= 50 ? 3 : roll <= 80 ? 4 : 5;
}

/** Only the actual paid arrival. Practice and the old FIRST_CASE are not sources. */
export interface RoseBishopCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'ROSE_BISHOP_DISPUTE'; attemptWeek: number; startHistoryIndex: number;
  target: 'WAYNE_SINGLE_ADULT_ORDINARY_HUMAN'; nature: 'ORDINARY_HUMAN';
  body: 'CURRENT_REACHABLE_BODY'; weapon: 'WAYNES_OWN_ORDINARY_SHORT_CLUB';
  space: 'ORIGINAL_OLD_OBJECT_ROOM_INDEPENDENT_OUTER_YARD'; visibility: 'MUTUALLY_VISIBLE';
  daylight: true; usableConcealmentShade: false; distanceMetres: 2;
  ground: 'CLEAR_ORDINARY_GROUND'; bystanders: 'NONE'; exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
}
export function currentRoseBishopCombatSource(state: SliceState): RoseBishopCombatSource | null {
  const combat = state.combat, e = state.roseBishop.encounter;
  if (!hasRoseBishopDisputeOpponent(state) || !combat ||
      state.roseBishop.practice.shape !== 'NORMAL' ||
      !Number.isSafeInteger(combat.round) || combat.round < 1 ||
      !Number.isSafeInteger(state.revision) || state.revision < 0 ||
      !Number.isSafeInteger(state.week) || state.week < 1 || e.startHistoryIndex === null ||
      state.combatHistory.length - e.startHistoryIndex !== combat.round - 1 ||
      !state.combatHistory.slice(e.startHistoryIndex).every((round, index) =>
        round.round === index + 1 && round.winner !== null && round.retreat !== 'SUCCESS')) return null;
  return { runId: state.runId, revision: state.revision, week: state.week, round: combat.round,
    encounterId: 'ROSE_BISHOP_DISPUTE', attemptWeek: state.week, startHistoryIndex: e.startHistoryIndex,
    target: 'WAYNE_SINGLE_ADULT_ORDINARY_HUMAN', nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY',
    weapon: 'WAYNES_OWN_ORDINARY_SHORT_CLUB', space: 'ORIGINAL_OLD_OBJECT_ROOM_INDEPENDENT_OUTER_YARD',
    visibility: 'MUTUALLY_VISIBLE', daylight: true, usableConcealmentShade: false, distanceMetres: 2,
    ground: 'CLEAR_ORDINARY_GROUND', bystanders: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false };
}
function validSource(state: SliceState, source: RoseBishopCombatSource | null): boolean {
  const current = currentRoseBishopCombatSource(state);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
function fleshFactor(state: SliceState): number {
  const mastery = state.progression.mastery['hanged-man.s6.flesh-shaping'] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}
function canPay(state: SliceState, amount: number): boolean {
  return Number.isFinite(state.spirituality) && state.spirituality >= amount;
}
/** Only already consumed ordinary rations can back reserve; held food is not power. */
function availableReserve(state: SliceState): number {
  const reserve = state.roseBishop.reserve;
  if (reserve.max !== 3 || !Number.isSafeInteger(reserve.points) || reserve.points < 0 ||
      reserve.points > reserve.max ||
      !Number.isSafeInteger(reserve.packetsBought) || reserve.packetsBought !== reserve.packets.length ||
      new Set(reserve.packets.map(packet => packet.id)).size !== reserve.packets.length ||
      !reserve.packets.every(packet => /^rose-bishop-ration-[1-9]\d*$/.test(packet.id) &&
        Number.isSafeInteger(packet.acquiredWeek) && packet.acquiredWeek >= 1 && packet.acquiredWeek <= state.week &&
        (packet.status === 'HELD' ? packet.consumedWeek === null : packet.status === 'CONSUMED' &&
          Number.isSafeInteger(packet.consumedWeek) && packet.consumedWeek! >= packet.acquiredWeek &&
          packet.consumedWeek! <= state.week)) ||
      reserve.packets.filter(packet => packet.status === 'CONSUMED').length < reserve.points) return 0;
  return reserve.points;
}
function spend(state: SliceState, spirituality: number): boolean {
  if (availableReserve(state) < 1 || !canPay(state, spirituality)) return false;
  state.spirituality -= spirituality;
  state.roseBishop.reserve.points -= 1;
  return true;
}
export interface RoseBishopCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): RoseBishopCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/** Each selected slot resolves and pays immediately; no extra draws or free stock. */
export function resolveRoseBishopCombatAbility(
  state: SliceState, id: RoseBishopMoveId, physicalStateFactor: number, _random: ActionRandomStream,
  source: RoseBishopCombatSource | null = currentRoseBishopCombatSource(state),
): RoseBishopCombatEffect {
  if (!validSource(state, source)) {
    return noEffect('蔷薇主教行动：缺少本场实际到场、正常本人身体与仍可行动的维恩来源；0贡献、0灵性、不耗储备、不重抽');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'hanged-man.s6.flesh-shaping': {
      if (state.town.clubLocation === 'HAND') {
        const selfGain = 16 * physical;
        return { label: '持握原短棍打击：实际手持镇上原短棍，以16×当前身体系数替换本次主攻（G）；0灵性、保留血肉储备，不同时附加血肉攻击',
          selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      if (spend(state, 2)) {
        const selfGain = 50.7 * fleshFactor(state) * physical;
        return { label: '本人有限血肉近击：本槽实际耗2灵性与1点已有血肉储备，已食用原包记录保留、不重复吞食；50.7×本人血肉塑形掌握×当前身体系数（G），只替换本次近击，抵抗也不退款，不附身、不放牧或吞食对方',
          selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      const selfGain = 12 * physical;
      return { label: '灵性或实际血肉储备不足：回退普通身体打击12×当前身体系数（G），0消耗、不透支、不凭空生成储备',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 27.3 * fleshFactor(state) * physical;
      return { label: '本人强化身体次击：27.3×本人血肉塑形掌握×当前身体系数（序列6身体成长G），0灵性、0储备；独立占本次行动，不附送近击或身体部件',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'hanged-man.s6.self-renewal':
      if (state.health > 0 && state.health < 100 && spend(state, 3)) {
        const before = state.health;
        state.health = Math.min(100, state.health + 10);
        return { ...noEffect(`本人有限自修复：实际耗3灵性与1点已有血肉储备（G），健康恢复${state.health - before}、不超过100；本槽自身优势+8，无敌方减势、不构成攻击。原伤势记录、累计风险和精神不变，不使死亡者复活`), selfGain: 8 };
      }
      return { ...noEffect('当前无需修复或灵性、实际储备不足：普通格挡10×当前身体系数（G），0消耗；不提前治疗、不清除伤势或风险'),
        enemyReduction: 10 * physical };
    case 'hanged-man.s7.shadow-concealment':
      return { ...noEffect('日光净空外院没有实际可用藏影：普通走位牵制6×当前身体系数（G），0灵性、0储备；不借练习阴影隐形、不取消维恩的行动、不瞬移'),
        enemyReduction: 6 * physical };
    case 'CHECK_RESERVE':
      return noEffect(`复核现有血肉储备：实际可用${availableReserve(state)}点；本次0贡献、0消耗，不现场制造、吞食或补充，不积累增益、不额外抽盘或攻击`);
    case 'ACCIDENT':
      return { ...noEffect('血肉或动作偏差：本次自身优势固定−16.25（蔷薇主教候选G），0灵性、0储备；不另掷正负、不构成致伤攻击、不编造污染或额外损耗'), selfGain: -16.25 };
  }
}
