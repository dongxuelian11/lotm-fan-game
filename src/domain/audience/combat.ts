import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Original playable S9 balance values, not quantitative claims about canon. */
export const AUDIENCE_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 25 }),
  Object.freeze({ id: '2', label: '2次', weight: 30 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 20 }),
]);

export type AudienceMoveId = 'STRIKE' | 'EVADE' | 'audience.observation'
  | 'audience.behavior-analysis' | 'audience.memory-deduction' | 'MISS';

// CONTROL is a wheel preference for reading visible behavior, not permission
// to control another mind. S9 has no telepathy, magical attack, or free action.
const AUDIENCE_ABILITIES: readonly {
  id: AudienceMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'STRIKE', label: '普通打击', weight: 20, stance: 'ATTACK' },
  { id: 'EVADE', label: '闪避', weight: 25, stance: 'DEFEND' },
  { id: 'audience.observation', label: '敏锐观察', weight: 25, stance: 'PREPARE' },
  { id: 'audience.behavior-analysis', label: '行为分析', weight: 15, stance: 'CONTROL' },
  { id: 'audience.memory-deduction', label: '记忆与推理', weight: 10, stance: 'PREPARE' },
  { id: 'MISS', label: '失误', weight: 5, stance: null },
];

export function isAudience(state: SliceState): boolean {
  return state.progression?.pathwayId === 'audience' && state.progression.sequence === 9;
}

function tickets(stance: SliceStance | null): number[] {
  return AUDIENCE_ABILITIES.map((ability) => ability.weight * (
    stance !== null && ability.stance === stance ? 5 : 4
  ));
}

export function audienceAbilityWheel(stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return AUDIENCE_ABILITIES.map((ability, index) => ({
    id: ability.id, label: ability.label, weight: weights[index]! / total * 100,
  }));
}

export function drawAudienceAbility(random: ActionRandomStream, stance: SliceStance | null): AudienceMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < AUDIENCE_ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return AUDIENCE_ABILITIES[index]!.id;
  }
  throw new Error('观众能力盘权重无效');
}

export function audienceActionCount(roll: number): number {
  return roll <= 25 ? 1 : roll <= 55 ? 2 : roll <= 80 ? 3 : 4;
}

interface AudienceCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}

function noEffect(label: string): AudienceCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/** Both implemented Audience stages retain the same source-bound S9 abilities. */
function actualAudiencePath(state: SliceState): boolean {
  return state.progression?.pathwayId === 'audience' &&
    (state.progression.sequence === 9 || state.progression.sequence === 8);
}

/** Only the authored first-case scene supplies visible S9 observation facts. */
function hasVisibleResistingOpponent(state: SliceState): boolean {
  const combat = state.combat;
  return actualAudiencePath(state) && state.status === 'ACTIVE' && state.health > 0 &&
    combat?.encounterId === 'FIRST_CASE' && combat.enemyStatus === 'RESISTING' &&
    combat.enemyHealth > 0 && state.world.carrierAlive && state.world.carrierCanResist;
}

/** Pure immediate effects: the caller owns injuries, victory, and round history. */
export function resolveAudienceCombatAbility(
  state: SliceState, id: AudienceMoveId, physicalStateFactor: number,
): AudienceCombatEffect {
  switch (id) {
    case 'STRIKE':
      return { label: state.town.clubLocation==='HAND'?'持握原短棍打击':'普通打击', selfGain: (state.town.clubLocation==='HAND'?16:12) * physicalStateFactor, enemyReduction: 0, threatens: true };
    case 'EVADE':
      return { label: '闪避：避让眼前打击，不保证免伤', selfGain: 0, enemyReduction: 12, threatens: false };
    case 'audience.observation': {
      if (!hasVisibleResistingOpponent(state)) {
        return noEffect('敏锐观察：当前没有可亲见的抵抗目标');
      }
      const health = state.combat!.enemyHealth >= 100 ? '未显受伤' : '身上已有伤势';
      return {
        label: `敏锐观察：携铃者${health}，仍持短棍抵抗；只确认眼前状态`,
        selfGain: 8, enemyReduction: 0, threatens: false,
      };
    }
    case 'audience.behavior-analysis':
      return hasVisibleResistingOpponent(state)
        ? { label: '行为分析：依据眼前持棍姿态推测空当，仍需防备动作变化', selfGain: 6, enemyReduction: 0, threatens: false }
        : noEffect('行为分析：缺少当前可亲见的言行动作，本次无法推断');
    case 'audience.memory-deduction': {
      const combat = state.combat;
      // This nested record is reset when an encounter starts. Global history
      // and unrelated case knowledge cannot supply memories of this opponent.
      const previous = combat?.lastRound;
      if (!hasVisibleResistingOpponent(state) || !combat || !previous ||
          combat.round <= 1 || previous.round !== combat.round - 1 ||
          previous.winner === null || previous.retreat === 'SUCCESS' ||
          !previous.moves.some((move) => move.actor === 'ENEMY')) {
        return noEffect('记忆与推理：本场尚无上一轮已亲历的对手动作可供比较');
      }
      return {
        label: '记忆与推理：回顾上一轮已见动作，与眼前站位比较；不预知下一步',
        selfGain: 6, enemyReduction: 0, threatens: false,
      };
    }
    case 'MISS':
      return noEffect('失误：这次行动未形成有效优势');
  }
}
