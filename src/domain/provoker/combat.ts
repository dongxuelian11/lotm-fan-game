import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Playable S8 balance values, not quantitative claims about canon. */
export const PROVOKER_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 15 }),
  Object.freeze({ id: '2', label: '2次', weight: 25 }),
  Object.freeze({ id: '3', label: '3次', weight: 30 }),
  Object.freeze({ id: '4', label: '4次', weight: 20 }),
  Object.freeze({ id: '5', label: '5次', weight: 10 }),
]);

export type ProvokerMoveId = 'hunter.s9.physical-enhancement' | 'EVADE'
  | 'hunter.s8.provocation' | 'hunter.s8.hostility-aura' | 'OBSERVE' | 'MISS';

const PROVOKER_ABILITIES: readonly {
  id: ProvokerMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'hunter.s9.physical-enhancement', label: '强化打击', weight: 30, stance: 'ATTACK' },
  { id: 'EVADE', label: '闪避', weight: 20, stance: 'DEFEND' },
  { id: 'hunter.s8.provocation', label: '针对性挑衅', weight: 25, stance: 'CONTROL' },
  { id: 'hunter.s8.hostility-aura', label: '憎恶气息', weight: 5, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '观察/调整位置', weight: 15, stance: 'PREPARE' },
  { id: 'MISS', label: '失误', weight: 5, stance: null },
];

export function isProvoker(state: SliceState): boolean {
  return state.progression?.pathwayId === 'hunter' && state.progression.sequence === 8;
}

function tickets(stance: SliceStance | null): number[] {
  return PROVOKER_ABILITIES.map((ability) => ability.weight * (
    stance !== null && ability.stance === stance ? 5 : 4
  ));
}

export function provokerAbilityWheel(stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return PROVOKER_ABILITIES.map((ability, index) => ({
    id: ability.id, label: ability.label, weight: weights[index]! / total * 100,
  }));
}

export function drawProvokerAbility(random: ActionRandomStream, stance: SliceStance | null): ProvokerMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < PROVOKER_ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return PROVOKER_ABILITIES[index]!.id;
  }
  throw new Error('挑衅者能力盘权重无效');
}

export function provokerActionCount(roll: number): number {
  return roll <= 15 ? 1 : roll <= 40 ? 2 : roll <= 70 ? 3 : roll <= 90 ? 4 : 5;
}

export interface ProvokerCombatEffect {
  label: string;
  selfGain: number;
  enemyReduction: number;
  threatens: boolean;
  /** Caller keeps this within the current round, never on the saved character. */
  angersEnemy: boolean;
}

function noEffect(label: string): ProvokerCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false, angersEnemy: false };
}

/** A known public boast concerns this opponent only, not every person with a club. */
function canAddressKnownOpponent(state: SliceState): boolean {
  const combat = state.combat;
  const status = state.provoker.cases['queue-boast']?.status;
  return isProvoker(state) && state.status === 'ACTIVE' && state.health > 0 &&
    state.provoker.encounter.status === 'FIGHTING' &&
    combat?.encounterId === 'PROVOKER_DISPUTE' && combat.enemyStatus === 'RESISTING' &&
    combat.enemyHealth > 0 && (status === 'OBSERVED' || status === 'COMPLETED');
}

/** All check draws use the ongoing round stream; no hidden seeds or free redraws. */
export function resolveProvokerCombatAbility(
  state: SliceState, id: ProvokerMoveId, physicalStateFactor: number, random: ActionRandomStream,
): ProvokerCombatEffect {
  switch (id) {
    case 'hunter.s9.physical-enhancement':
      return { label: '强化打击', selfGain: 28 * physicalStateFactor, enemyReduction: 0, threatens: true, angersEnemy: false };
    case 'EVADE':
      return { label: '闪避：借强化的身体避让短棍，不保证免伤', selfGain: 0, enemyReduction: 22, threatens: false, angersEnemy: false };
    case 'hunter.s8.provocation': {
      if (!canAddressKnownOpponent(state)) {
        return noEffect('针对性挑衅：缺少当前抵抗目标的已知言行，未找到可针对之处，不凭空猜测弱点');
      }
      if (state.spirituality < 1) return noEffect('针对性挑衅：灵性不足1，本次没有效果，不重抽');
      state.spirituality -= 1;
      const result = resolveNormalCheck({
        ability: 'will', baseAbility: state.character.coreStats.will,
        difficulty: 12, modifiers: [], roll: random.nextInt(1, 100),
      });
      state.lastCheck = result;
      const success = result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS';
      const tier = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '大失败' }[result.tier];
      const prefix = `针对性挑衅：以威斯自称“我只认先来后到”反问他；耗灵性1，意志${result.roll}/${result.chance}，${tier}`;
      return {
        label: success ? `${prefix}，优势+10；本轮后续攻击权重×1.25，仍自主抽取`
          : `${prefix}，未激起有效怒意，优势不变`,
        selfGain: success ? 10 : 0, enemyReduction: 0, threatens: false, angersEnemy: success,
      };
    }
    case 'hunter.s8.hostility-aura':
      return noEffect('憎恶气息：适用于无法沟通的动物或怪物，当前对手是可沟通的人类，本次无效');
    case 'OBSERVE':
      return { label: '观察/调整位置：确认眼前站位与空当', selfGain: 8, enemyReduction: 0, threatens: false, angersEnemy: false };
    case 'MISS':
      return noEffect('失误：这次行动未形成有效优势');
  }
}
