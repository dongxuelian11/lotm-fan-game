import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** S8 C profile and ordinary training budgets are G, not an audited novel move list. */
export const COMBAT_SCHOLAR_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 12 }),
  Object.freeze({ id: '2', label: '2次', weight: 18 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 28 }),
  Object.freeze({ id: '5', label: '5次', weight: 17 }),
]);

export type CombatScholarMoveId = 'hermit.s8.combat-study' | 'BODY_FOLLOWUP' | 'hermit.s9.spirit-vision'
  | 'SITE_PRESSURE' | 'hermit.s9.ritual-lore' | 'ACCIDENT';
const ABILITIES: readonly {
  id: CombatScholarMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'hermit.s8.combat-study', label: '实练近身打击（G）', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '实练次击（G）', weight: 20, stance: 'ATTACK' },
  { id: 'hermit.s9.spirit-vision', label: '继承的有限灵视与避让', weight: 25, stance: 'DEFEND' },
  { id: 'SITE_PRESSURE', label: '实练走位牵制（G）', weight: 15, stance: 'CONTROL' },
  { id: 'hermit.s9.ritual-lore', label: '核实仪式准备条件', weight: 5, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作或判断偏差', weight: 5, stance: null },
];

export function isCombatScholar(state: SliceState): boolean {
  return state.progression?.pathwayId === 'hermit' && state.progression.sequence === 8;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function combatScholarAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'hermit.s8.combat-study' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawCombatScholarAbility(random: ActionRandomStream, stance: SliceStance | null): CombatScholarMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('格斗学者能力盘权重无效');
}
export function combatScholarActionCount(roll: number): number {
  return roll <= 12 ? 1 : roll <= 30 ? 2 : roll <= 55 ? 3 : roll <= 83 ? 4 : 5;
}

export interface CombatScholarCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): CombatScholarCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
function hasPresentFirstCaseOpponent(state: SliceState): boolean {
  return isCombatScholar(state) && state.status === 'ACTIVE' && state.health > 0 &&
    state.combat !== null && state.combat.enemyHealth > 0 && state.combat.enemyStatus === 'RESISTING' &&
    state.arc.stage === 'COMBAT' && state.world.city === 'BACKLUND' &&
    state.combat.encounterId === 'FIRST_CASE' && state.world.carrierAlive && state.world.carrierCanResist;
}
function masteryFactor(state: SliceState, id: 'hermit.s8.combat-study' | 'hermit.s9.spirit-vision'): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/**
 * H/J/K use one shared ordinary training mastery (G), not borrowed Clown powers.
 * B retains the acquired Pryer vision mastery. No ritual source exists in FIRST_CASE.
 */
export function resolveCombatScholarCombatAbility(
  state: SliceState, id: CombatScholarMoveId, physicalStateFactor: number, random: ActionRandomStream,
): CombatScholarCombatEffect {
  if (!hasPresentFirstCaseOpponent(state)) {
    return noEffect('格斗学者行动：当前没有本场仍在抵抗的活体对手，本次贡献0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  const training = masteryFactor(state, 'hermit.s8.combat-study');
  switch (id) {
    case 'hermit.s8.combat-study': {
      const heldClub = state.town.clubLocation === 'HAND';
      const selfGain = (heldClub ? 16 : 24 * training) * physical;
      return { label: heldClub
        ? '持握原短棍打击：实际持握的普通短棍以16贡献替换实练近击预算，不叠加、不耗灵性'
        : '实练近身打击（G）：本人按实际练习完成一次普通打击，24贡献受训练掌握与身体状态影响，不耗灵性',
      selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 16.8 * training * physical;
      return { label: '实练次击（G）：本次普通动作贡献16.8，受训练掌握与身体状态影响；独立占一次行动，不附赠攻击、不耗灵性',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'hermit.s9.spirit-vision':
      if (!Number.isFinite(state.spirituality) || state.spirituality < 1) {
        return { ...noEffect('有限灵视所需灵性不足：本次改用普通格挡护身，贡献10受身体状态影响，不透支灵性'),
          enemyReduction: 10 * physical };
      }
      state.spirituality -= 1;
      return { ...noEffect('继承的有限灵视与避让：消耗1灵性，仅观察眼前活体的有限灵性表征辅助自保；不预知、不读心、不取消对手行动'),
        enemyReduction: 27 * masteryFactor(state, 'hermit.s9.spirit-vision') };
    case 'SITE_PRESSURE':
      return { ...noEffect('实练走位牵制（G）：用实际训练调整距离，贡献18.9受训练掌握与身体状态影响，不保证控制、不取消对手行动、不耗灵性'),
        enemyReduction: 18.9 * training * physical };
    case 'hermit.s9.ritual-lore':
      return noEffect('核实仪式准备条件：本场没有已准备并获准使用的仪式来源，本次贡献0、消耗0；知识和练习记录不能生成仪式、法术或材料');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -7.5 : 7.5;
      return { ...noEffect(`动作或判断偏差：本次意外贡献${selfGain > 0 ? '+' : '−'}7.5（G），不构成致伤攻击`), selfGain };
    }
  }
}
