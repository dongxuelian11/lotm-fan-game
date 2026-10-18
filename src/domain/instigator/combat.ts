import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Instigator S8 C profile. All contribution budgets and local costs are G. */
export const INSTIGATOR_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 12 }),
  Object.freeze({ id: '2', label: '2次', weight: 18 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 28 }),
  Object.freeze({ id: '5', label: '5次', weight: 17 }),
]);

type InstigatorMasteryId = 'assassin.s9.burst' | 'assassin.s9.lightness'
  | 'assassin.s9.vision' | 'assassin.s8.instigation';
export type InstigatorMoveId = InstigatorMasteryId | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly {
  id: InstigatorMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'assassin.s9.burst', label: '教唆者蓄力爆发', weight: 20, stance: 'ATTACK' },
  { id: 'assassin.s9.lightness', label: '轻身近击', weight: 15, stance: 'ATTACK' },
  { id: 'assassin.s9.vision', label: '敏锐观察与避让', weight: 20, stance: 'DEFEND' },
  { id: 'assassin.s8.instigation', label: '有限煽动已有敌意', weight: 30, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '观察眼前动作', weight: 8, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '时机或失衡', weight: 7, stance: null },
];

export function isInstigator(state: SliceState): boolean {
  return state.progression?.pathwayId === 'demoness' && state.progression.sequence === 8;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function instigatorAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'assassin.s9.burst' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawInstigatorAbility(random: ActionRandomStream, stance: SliceStance | null): InstigatorMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('教唆者能力盘权重无效');
}
export function instigatorActionCount(roll: number): number {
  return roll <= 12 ? 1 : roll <= 30 ? 2 : roll <= 55 ? 3 : roll <= 83 ? 4 : 5;
}

export interface InstigatorCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): InstigatorCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/** The actual resisting first-case carrier is already hostile and present.
 * No knowledge note, practice subject or caller-supplied proof creates a target.
 */
function hasCurrentOpponent(state: SliceState): boolean {
  return isInstigator(state) && state.status === 'ACTIVE' && state.health > 0 &&
    state.arc.stage === 'COMBAT' && state.world.city === 'BACKLUND' &&
    state.combat?.encounterId === 'FIRST_CASE' && state.combat.enemyStatus === 'RESISTING' &&
    state.combat.enemyHealth > 0 && state.world.carrierAlive && state.world.carrierCanResist;
}
function masteryFactor(state: SliceState, id: InstigatorMasteryId): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** One drawn slot, still using the shared opposing advantage and consequence rules. */
export function resolveInstigatorCombatAbility(
  state: SliceState, id: InstigatorMoveId, physicalStateFactor: number, random: ActionRandomStream,
): InstigatorCombatEffect {
  if (!hasCurrentOpponent(state)) {
    return noEffect('教唆者行动：缺少本场仍在抵抗的真实对手，本次贡献0，不生成敌意或目标');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'assassin.s9.burst': {
      if (state.town.clubLocation === 'HAND') {
        const selfGain = 16 * physical;
        return { label: '持握原短棍打击：采用这根普通短棍的贡献，不叠加爆发、不消耗灵性',
          selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      if (!Number.isFinite(state.spirituality) || state.spirituality < 1) {
        const selfGain = 12 * physical;
        return { label: '爆发所需灵性不足：改为本次普通身体打击，不透支灵性',
          selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      state.spirituality -= 1;
      const selfGain = 27 * masteryFactor(state, id) * physical;
      return { label: '教唆者蓄力爆发：消耗1灵性集中继承的身体力量，仍按共同伤势盘结算，不是必杀',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'assassin.s9.lightness': {
      const selfGain = 18.9 * masteryFactor(state, id) * physical;
      return { label: '轻身近击：以继承的步法与实际身体完成本次近击，不生成刀具、不飞行',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'assassin.s9.vision':
      return { ...noEffect('敏锐观察与避让：只看眼前动作，以身体避开部分压力，不取消对手行动'),
        enemyReduction: 21 * masteryFactor(state, id) };
    case 'assassin.s8.instigation': {
      if (!Number.isFinite(state.spirituality) || state.spirituality < 1) {
        return { ...noEffect('教唆所需灵性不足：改为普通走位牵制，不施加精神影响、不透支灵性'),
          enemyReduction: 6 * masteryFactor(state, id) * physical };
      }
      state.spirituality -= 1;
      // This opponent has no authored mental-resistance mechanic. Only the
      // common reduction budget applies; do not add a new resistance system,
      // change its next draw/target, or borrow the psychologist consequence.
      return { ...noEffect('有限教唆：消耗1灵性，只煽动携铃者当前已表现的敌意、扰乱其节奏；仅计共同减势，不读取私密想法、不强制行动或目标、不取消行动，不是绝对控制'),
        enemyReduction: 14.7 * masteryFactor(state, id) };
    }
    case 'OBSERVE':
      return noEffect('观察眼前动作与原退路：本次贡献0，不预读未来动作或隐藏事实');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -7.5 : 7.5;
      return { ...noEffect(`时机或失衡：本次意外贡献${selfGain > 0 ? '+' : '−'}7.5（G），不构成致伤攻击`), selfGain };
    }
  }
}
