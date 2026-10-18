import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Documented S9 pace accepted for this playable stage, not a global cap. */
export const SEER_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 25 }),
  Object.freeze({ id: '2', label: '2次', weight: 30 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 20 }),
]);

type SeerMoveId = 'MARTIAL' | 'EVADE' | 'diviner.s9.spiritual-sight'
  | 'diviner.s9.spiritual-intuition' | 'OBSERVE' | 'MISS';

interface SeerAbility {
  id: SeerMoveId;
  label: string;
  weight: number;
  stance: SliceStance | null;
}

// Confirmed seven-sector baseline: 36/14/10/8/10/14/8. This slice has no
// player gun or ammunition asset, so the entire 36-weight gun sector is absent.
// Ordinary bodily actions have no invented mastery track. The S9-specific
// mastery weighting curve is not designed yet, so it is not manufactured here.
const SEER_ABILITIES: readonly SeerAbility[] = [
  { id: 'MARTIAL', label: '体术', weight: 14, stance: 'ATTACK' },
  { id: 'EVADE', label: '闪避/掩体', weight: 10, stance: 'DEFEND' },
  { id: 'diviner.s9.spiritual-sight', label: '灵视', weight: 8, stance: 'CONTROL' },
  { id: 'diviner.s9.spiritual-intuition', label: '灵性直觉', weight: 10, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '观察/调整位置', weight: 14, stance: 'PREPARE' },
  { id: 'MISS', label: '未知/失误', weight: 8, stance: null },
];

export function isSeer(state: SliceState): boolean {
  return state.progression?.pathwayId === 'diviner' && state.progression.sequence === 9;
}

function tickets(stance: SliceStance | null): number[] {
  return SEER_ABILITIES.map((ability) => ability.weight * (
    stance !== null && ability.stance === stance ? 5 : 4
  ));
}

export function seerAbilityWheel(stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return SEER_ABILITIES.map((ability, index) => ({
    id: ability.id, label: ability.label, weight: weights[index]! / total * 100,
  }));
}

export function drawSeerAbility(random: ActionRandomStream, stance: SliceStance | null): SeerMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < SEER_ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return SEER_ABILITIES[index]!.id;
  }
  throw new Error('占卜家能力盘权重无效');
}

export function seerActionCount(roll: number): number {
  return roll <= 25 ? 1 : roll <= 55 ? 2 : roll <= 80 ? 3 : 4;
}

export interface SeerDangerSource {
  /** Supplied by an actual encounter rule, never inferred from tier advantage. */
  difference: number;
  publicWarning: string;
}

/** A resolved action is immediate; the caller owns round victory and injuries. */
export function resolveSeerCombatAbility(
  state: SliceState, id: SeerMoveId, physicalStateFactor: number,
  danger: SeerDangerSource | null = null,
): { label: string; selfGain: number; enemyReduction: number; threatens: boolean } {
  switch (id) {
    case 'MARTIAL':
      return { label: '体术', selfGain: 22 * physicalStateFactor, enemyReduction: 0, threatens: true };
    case 'EVADE':
      return { label: '闪避/掩体', selfGain: 0, enemyReduction: 20, threatens: false };
    case 'diviner.s9.spiritual-sight': {
      const combat = state.combat;
      if (!combat || !state.world.carrierAlive || combat.enemyStatus !== 'RESISTING') {
        return { label: '灵视：当前没有可观察的目标', selfGain: 0, enemyReduction: 0, threatens: false };
      }
      // Health is an actual present target state. The bell observation only
      // repeats the already-established scene fact; neither reveals ownership,
      // pathways, thoughts, nor the identity of anyone behind the case.
      const health = combat.enemyHealth >= 100 ? '携铃者未显受伤' : '携铃者身上已有伤势';
      const bell = state.world.bellFactKnown && state.world.bellAtScene && state.world.bell === 'ACTIVE'
        ? '；箱中铜铃的异常仍在' : '';
      return { label: `灵视：${health}${bell}`, selfGain: 5, enemyReduction: 0, threatens: false };
    }
    case 'diviner.s9.spiritual-intuition':
      // The first carrier encounter has no active bell attack or declared
      // danger-difference source. Owning this ability is not a passive bonus.
      return danger && danger.difference >= 20
        ? { label: `灵性直觉：${danger.publicWarning}`, selfGain: 0, enemyReduction: 25, threatens: false }
        : { label: '灵性直觉：未辨明额外的危险征兆', selfGain: 0, enemyReduction: 0, threatens: false };
    case 'OBSERVE':
      return { label: '观察/调整位置：重新确认眼前动静，本次未形成额外优势', selfGain: 0, enemyReduction: 0, threatens: false };
    case 'MISS':
      return { label: '未知/失误：这次行动未形成有效优势', selfGain: 0, enemyReduction: 0, threatens: false };
  }
}
