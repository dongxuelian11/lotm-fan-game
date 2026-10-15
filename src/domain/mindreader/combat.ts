import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { resolveAudienceCombatAbility, type AudienceMoveId } from '../audience/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Original playable S8 balance, not quantitative claims about the novel. */
export const MINDREADER_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 15 }),
  Object.freeze({ id: '2', label: '2次', weight: 25 }),
  Object.freeze({ id: '3', label: '3次', weight: 30 }),
  Object.freeze({ id: '4', label: '4次', weight: 20 }),
  Object.freeze({ id: '5', label: '5次', weight: 10 }),
]);

export type MindreaderMoveId = AudienceMoveId | 'audience.mind-reading';

// CONTROL biases information gathering; it never grants control of the target.
const MINDREADER_ABILITIES: readonly {
  id: MindreaderMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'STRIKE', label: '普通打击', weight: 15, stance: 'ATTACK' },
  { id: 'EVADE', label: '闪避', weight: 25, stance: 'DEFEND' },
  { id: 'audience.observation', label: '敏锐观察', weight: 20, stance: 'PREPARE' },
  { id: 'audience.behavior-analysis', label: '行为分析', weight: 15, stance: 'CONTROL' },
  { id: 'audience.memory-deduction', label: '记忆与推理', weight: 10, stance: 'PREPARE' },
  { id: 'audience.mind-reading', label: '浅层读心', weight: 10, stance: 'CONTROL' },
  { id: 'MISS', label: '失误', weight: 5, stance: null },
];

export function isMindreader(state: SliceState): boolean {
  return state.progression?.pathwayId === 'audience' && state.progression.sequence === 8;
}

function tickets(stance: SliceStance | null): number[] {
  return MINDREADER_ABILITIES.map((ability) => ability.weight * (
    stance !== null && ability.stance === stance ? 5 : 4
  ));
}

export function mindreaderAbilityWheel(stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return MINDREADER_ABILITIES.map((ability, index) => ({
    id: ability.id, label: ability.label, weight: weights[index]! / total * 100,
  }));
}

export function drawMindreaderAbility(random: ActionRandomStream, stance: SliceStance | null): MindreaderMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < MINDREADER_ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return MINDREADER_ABILITIES[index]!.id;
  }
  throw new Error('读心者能力盘权重无效');
}

export function mindreaderActionCount(roll: number): number {
  return roll <= 15 ? 1 : roll <= 40 ? 2 : roll <= 70 ? 3 : roll <= 90 ? 4 : 5;
}

export interface MindreaderCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}

function noEffect(label: string): MindreaderCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/** FIRST_CASE alone currently authors an ordinary human mind at this scene. */
function hasPresentOrdinaryMind(state: SliceState): boolean {
  const combat = state.combat;
  return isMindreader(state) && state.status === 'ACTIVE' && state.health > 0 &&
    state.arc.stage === 'COMBAT' && state.world.city === 'BACKLUND' &&
    combat?.encounterId === 'FIRST_CASE' && combat.enemyStatus === 'RESISTING' &&
    combat.enemyHealth > 0 && combat.enemyMind > 0 &&
    state.world.carrierAlive && state.world.carrierCanResist;
}

/** Immediate effects only; the shared round retains ownership of all consequences. */
export function resolveMindreaderCombatAbility(
  state: SliceState, id: MindreaderMoveId, physicalStateFactor: number, random: ActionRandomStream,
): MindreaderCombatEffect {
  if (!isMindreader(state)) return noEffect('读心者能力：当前没有对应的序列能力');
  if (id === 'EVADE') {
    return { label: '闪避：避让眼前打击，不保证免伤', selfGain: 0, enemyReduction: 18, threatens: false };
  }
  if (id !== 'audience.mind-reading') {
    // Inherited abilities retain the shared resolver's exact visible-source and
    // previous-round gates, operating on the actual S8 character and encounter.
    return resolveAudienceCombatAbility(state, id, physicalStateFactor);
  }
  if (!hasPresentOrdinaryMind(state)) {
    return noEffect('浅层读心：当前没有同场、存活且仍在抵抗的普通人类心智可读');
  }
  if (state.spirituality < 1) return noEffect('浅层读心：灵性不足1，本次没有效果，不重抽');

  // Starting the read spends its cost even if the normal check fails. The caller
  // supplies the ongoing round RNG, so no extra seed or free redraw is created.
  state.spirituality -= 1;
  const result = resolveNormalCheck({
    ability: 'perception', baseAbility: state.character.coreStats.perception,
    difficulty: 12, modifiers: [], roll: random.nextInt(1, 100),
  });
  state.lastCheck = result;
  const success = result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS';
  const tier = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '大失败' }[result.tier];
  const prefix = `浅层读心：耗灵性1，感知${result.roll}/${result.chance}，${tier}`;
  return {
    label: success
      ? `${prefix}；携铃者此刻想守住身前空间，不愿让你近身。只读到眼前浅层意图，不保证下一步动作，优势+10`
      : `${prefix}；紧张与抵触的念头混杂，未辨清浅层意图，优势不变`,
    selfGain: success ? 10 : 0, enemyReduction: 0, threatens: false,
  };
}
