import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Original playable S9 balance values, not quantitative claims about canon. */
export const HUNTER_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 20 }),
  Object.freeze({ id: '2', label: '2次', weight: 40 }),
  Object.freeze({ id: '3', label: '3次', weight: 30 }),
  Object.freeze({ id: '4', label: '4次', weight: 10 }),
]);

export type HunterMoveId = 'hunter.s9.physical-enhancement' | 'EVADE'
  | 'hunter.s9.hunting-instinct' | 'OBSERVE' | 'MISS';
type HunterEncounterId = 'FIRST_CASE' | 'HUNTER_CARGO';
type HunterEnemyMove = 'STRIKE' | 'BLOCK' | 'OPENING' | 'DISTANCE' | 'MISS';
interface HunterCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}

// Tracking and trap preparation need real scene evidence/materials and remain
// event actions. The combat wheel neither conjures equipment nor grants S8
// provocation, S7 fire, a firearm, or an extra action for placing a trap.
const HUNTER_ABILITIES: readonly {
  id: HunterMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'hunter.s9.physical-enhancement', label: '强化打击', weight: 40, stance: 'ATTACK' },
  { id: 'EVADE', label: '闪避', weight: 20, stance: 'DEFEND' },
  { id: 'hunter.s9.hunting-instinct', label: '猎杀直觉', weight: 15, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '观察/调整位置', weight: 20, stance: 'PREPARE' },
  { id: 'MISS', label: '失误', weight: 5, stance: null },
];

export function isHunter(state: SliceState): boolean {
  return state.progression?.pathwayId === 'hunter' && (state.progression.sequence === 9||state.progression.sequence===8);
}

function tickets(stance: SliceStance | null): number[] {
  return HUNTER_ABILITIES.map((ability) => ability.weight * (
    stance !== null && ability.stance === stance ? 5 : 4
  ));
}

export function hunterAbilityWheel(stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return HUNTER_ABILITIES.map((ability, index) => ({
    id: ability.id, label: ability.label, weight: weights[index]! / total * 100,
  }));
}

export function drawHunterAbility(random: ActionRandomStream, stance: SliceStance | null): HunterMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < HUNTER_ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return HUNTER_ABILITIES[index]!.id;
  }
  throw new Error('猎人能力盘权重无效');
}

export function hunterActionCount(roll: number): number {
  return roll <= 20 ? 1 : roll <= 60 ? 2 : roll <= 90 ? 3 : 4;
}

function liveEncounter(state: SliceState): HunterEncounterId | null {
  const combat = state.combat;
  if (!isHunter(state) || state.status !== 'ACTIVE' || state.health <= 0 || !combat ||
      combat.enemyStatus !== 'RESISTING' || combat.enemyHealth <= 0) return null;
  if (combat.encounterId === 'HUNTER_CARGO') {
    return state.hunter.cargo.status === 'FIGHTING' ? 'HUNTER_CARGO' : null;
  }
  return (combat.encounterId ?? 'FIRST_CASE') === 'FIRST_CASE' &&
    state.world.carrierAlive && state.world.carrierCanResist ? 'FIRST_CASE' : null;
}

export interface HunterDangerSource {
  encounterId: HunterEncounterId;
  round: number;
  action: 'VISIBLE_CLUB_MOVEMENT';
}

/** Both authored scenes show a present resisting opponent and a raised club. */
export function currentHunterDangerSource(state: SliceState): HunterDangerSource | null {
  const encounterId = liveEncounter(state);
  return encounterId === null ? null : {
    encounterId, round: state.combat!.round, action: 'VISIBLE_CLUB_MOVEMENT',
  };
}

export function resolveHunterCombatAbility(
  state: SliceState, id: HunterMoveId, physicalStateFactor: number,
  danger: HunterDangerSource | null = null,
): HunterCombatEffect {
  switch (id) {
    case 'hunter.s9.physical-enhancement':
      return { label: '强化打击', selfGain: 24 * physicalStateFactor, enemyReduction: 0, threatens: true };
    case 'EVADE':
      return { label: '闪避：借强化的身体避让短棍，不保证免伤', selfGain: 0, enemyReduction: 18, threatens: false };
    case 'hunter.s9.hunting-instinct': {
      const current = currentHunterDangerSource(state);
      const valid = current && danger && danger.encounterId === current.encounterId &&
        danger.round === current.round && danger.action === current.action;
      const opponent = current?.encounterId === 'HUNTER_CARGO' ? '拦路者' : '携铃者';
      return valid
        ? { label: `猎杀直觉：从眼前${opponent}的短棍动作判断迫近威胁，不保证准确`, selfGain: 0, enemyReduction: 15, threatens: false }
        : { label: '猎杀直觉：当前没有仍然有效的威胁来源，未形成优势', selfGain: 0, enemyReduction: 0, threatens: false };
    }
    case 'OBSERVE':
      return { label: '观察/调整位置：确认眼前站位与空当', selfGain: 8, enemyReduction: 0, threatens: false };
    case 'MISS':
      return { label: '失误：这次行动未形成有效优势', selfGain: 0, enemyReduction: 0, threatens: false };
  }
}

export interface HunterApproachSource {
  encounterId: HunterEncounterId;
  round: number;
  action: 'STRIKE';
  route: 'EXISTING_NARROW_PASSAGE';
}

/** Only an actual approaching strike in either authored narrow passage qualifies. */
export function currentHunterApproachSource(
  state: SliceState, move: HunterEnemyMove,
): HunterApproachSource | null {
  const encounterId = liveEncounter(state);
  return move !== 'STRIKE' || encounterId === null ? null : {
    encounterId, round: state.combat!.round, action: 'STRIKE', route: 'EXISTING_NARROW_PASSAGE',
  };
}

/** Consumes the one previously deployed physical trap, never rolls or deals damage. */
export function resolveHunterTrap(
  state: SliceState, approach: HunterApproachSource | null,
): HunterCombatEffect | null {
  const current = currentHunterApproachSource(state, 'STRIKE');
  const trap = state.hunter;
  if (!current || !approach || approach.encounterId !== current.encounterId ||
      approach.round !== current.round || approach.action !== current.action ||
      approach.route !== current.route || trap.trapLocation !== current.encounterId ||
      trap.trapDeployed !== 1) return null;
  const counts = [trap.trapStock, trap.trapHeld, trap.trapDeployed, trap.trapSpent];
  if (!counts.every((count) => Number.isSafeInteger(count) && count >= 0) ||
      counts.reduce((sum, count) => sum + count, 0) !== 3) return null;
  trap.trapDeployed -= 1;
  trap.trapSpent += 1;
  trap.trapLocation = null;
  return {
    label: '沿既有狭口接近，预设绳索木桩陷阱触发：敌方优势减少20，耗用1套，不造成伤害',
    selfGain: 0, enemyReduction: 20, threatens: false,
  };
}
