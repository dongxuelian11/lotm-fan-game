import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { LawyerCombatSource } from '../lawyer/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/**
 * Barbarian S8: enhanced strength and high mental resistance are the source
 * boundary. All wheels, budgets and core weights are G. The ordinary carrier
 * has no mental attack, so resistance neither creates an active immunity nor
 * negotiates consent. No S7 bribery, S6 distortion, healing or extra action.
 */
export const BARBARIAN_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 10 }),
  Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 25 }),
  Object.freeze({ id: '5', label: '5次', weight: 20 }),
]);

export type BarbarianMoveId = 'black-emperor.s8.enhanced-body' | 'BODY_FOLLOWUP'
  | 'black-emperor.s9.weak-point-insight' | 'POSITION' | 'black-emperor.s8.mental-resistance' | 'ACCIDENT';
const ABILITIES: readonly {
  id: BarbarianMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'black-emperor.s8.enhanced-body', label: '野蛮人强化身体打击', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '强化身体侧击', weight: 20, stance: 'ATTACK' },
  { id: 'black-emperor.s9.weak-point-insight', label: '可见破绽判断与护身', weight: 20, stance: 'DEFEND' },
  { id: 'POSITION', label: '普通走位牵制', weight: 10, stance: 'CONTROL' },
  { id: 'black-emperor.s8.mental-resistance', label: '核实精神抗性的适用来源', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '时机或失衡', weight: 5, stance: null },
];

export function isBarbarian(state: SliceState): boolean {
  return state.progression?.pathwayId === 'black-emperor' && state.progression.sequence === 8;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function barbarianAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'black-emperor.s8.enhanced-body' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawBarbarianAbility(random: ActionRandomStream, stance: SliceStance | null): BarbarianMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('野蛮人能力盘权重无效');
}
export function barbarianActionCount(roll: number): number {
  return roll <= 10 ? 1 : roll <= 30 ? 2 : roll <= 55 ? 3 : roll <= 80 ? 4 : 5;
}

export interface BarbarianCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): BarbarianCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/** Only this present ordinary opponent, reachable body and existing passage. */
export type BarbarianCombatSource = LawyerCombatSource;
export function currentBarbarianCombatSource(state: SliceState): BarbarianCombatSource | null {
  if (!isBarbarian(state) || state.status !== 'ACTIVE' || !Number.isFinite(state.health) || state.health <= 0 ||
      !state.combat || !Number.isFinite(state.combat.enemyHealth) || state.combat.enemyHealth <= 0 ||
      state.combat.enemyStatus !== 'RESISTING' || state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' };
}
function validCombatSource(state: SliceState, source: BarbarianCombatSource | null): boolean {
  const current = currentBarbarianCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week &&
    source.encounterId === current.encounterId && source.round === current.round &&
    source.target === current.target && source.body === current.body &&
    source.space === current.space && source.exit === current.exit;
}
function masteryFactor(state: SliceState,
  id: 'black-emperor.s8.enhanced-body' | 'black-emperor.s9.weak-point-insight',
): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** One existing slot; physical use costs 0 spirituality and shares normal injury resolution. */
export function resolveBarbarianCombatAbility(
  state: SliceState, id: BarbarianMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: BarbarianCombatSource | null = currentBarbarianCombatSource(state),
): BarbarianCombatEffect {
  if (!validCombatSource(state, source)) {
    return noEffect('野蛮人行动：缺少本场仍可触及的可见普通对手与真实现场，本次贡献0、消耗0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'black-emperor.s8.enhanced-body': {
      // Only the original club actually in HAND replaces H; no equipment is created or moved.
      const heldClub = state.town.clubLocation === 'HAND';
      const selfGain = (heldClub ? 16 : 36 * masteryFactor(state, id)) * physical;
      return { label: heldClub
        ? '持握原短棍打击：只采用已经在手的普通短棍贡献，不叠加强化身体或破绽判断预算，消耗0灵性，不保证命中'
        : '野蛮人强化身体打击：使用真实身体的增强力量（G），消耗0灵性；不保证命中，伤害仍由共同伤势盘结算',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 25.2 * masteryFactor(state, 'black-emperor.s8.enhanced-body') * physical;
      return { label: '强化身体侧击：采用同一强化身体掌握度（G），消耗0灵性，独立占用本次行动；不追加攻击、不恢复伤势或精神',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'black-emperor.s9.weak-point-insight':
      return { ...noEffect('可见破绽判断与护身：继承律师对眼前已显露动作的判断（G），不读取思想或预知下一步，不取消敌方行动、不保证存活'),
        enemyReduction: 24.3 * masteryFactor(state, id) * physical };
    case 'POSITION':
      return { ...noEffect('普通走位牵制：只沿眼前通道调整距离（G），不叠加强化身体掌握，不以力量或口才强制同意，不强制取消对手行动'),
        enemyReduction: 6 * physical };
    case 'black-emperor.s8.mental-resistance':
      return noEffect('精神抗性：本场普通对手没有正在使用的有来源精神攻击，本次贡献0、消耗0；高精神抗性不是主动精神免疫、精神控制或恢复，不生成协商条款、不强制同意，不是贿赂或扭曲');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -7.5 : 7.5;
      return { ...noEffect(`时机或失衡：本次意外贡献${selfGain > 0 ? '+' : '−'}7.5（G），不构成致伤攻击，不是贿赂、扭曲或重掷`), selfGain };
    }
  }
}
