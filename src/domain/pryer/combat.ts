import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Prying One S9 support profile; contribution budgets and costs are G balance. */
export const PRYER_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 20 }),
  Object.freeze({ id: '2', label: '2次', weight: 25 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 20 }),
  Object.freeze({ id: '5', label: '5次', weight: 10 }),
]);

export type PryerMoveId = 'BODY_STRIKE' | 'BODY_FOLLOWUP' | 'hermit.s9.spirit-vision'
  | 'SITE_PRESSURE' | 'hermit.s9.ritual-lore' | 'ACCIDENT';
const ABILITIES: readonly {
  id: PryerMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'BODY_STRIKE', label: '普通身体/持握工具打击', weight: 25, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '普通身体次击', weight: 15, stance: 'ATTACK' },
  { id: 'hermit.s9.spirit-vision', label: '有限灵视与避让', weight: 25, stance: 'DEFEND' },
  { id: 'SITE_PRESSURE', label: '普通走位牵制', weight: 10, stance: 'CONTROL' },
  { id: 'hermit.s9.ritual-lore', label: '核实仪式准备条件', weight: 20, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作或判断偏差', weight: 5, stance: null },
];

export function isPryer(state: SliceState): boolean {
  return state.progression?.pathwayId === 'hermit' && state.progression.sequence === 9;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function pryerAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'BODY_STRIKE' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawPryerAbility(random: ActionRandomStream, stance: SliceStance | null): PryerMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('窥秘人能力盘权重无效');
}
export function pryerActionCount(roll: number): number {
  return roll <= 20 ? 1 : roll <= 45 ? 2 : roll <= 70 ? 3 : roll <= 90 ? 4 : 5;
}

export interface PryerCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): PryerCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
function hasPresentFirstCaseOpponent(state: SliceState): boolean {
  return isPryer(state) && state.status === 'ACTIVE' && state.health > 0 &&
    state.combat !== null && state.combat.enemyHealth > 0 && state.combat.enemyStatus === 'RESISTING' &&
    state.arc.stage === 'COMBAT' && state.world.city === 'BACKLUND' &&
    state.combat.encounterId === 'FIRST_CASE' && state.world.carrierAlive && state.world.carrierCanResist;
}
function visionMasteryFactor(state: SliceState): number {
  const mastery = state.progression.mastery['hermit.s9.spirit-vision'] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/**
 * Only an actual living hostile carrier in FIRST_CASE is available here.
 * Occult knowledge does not create a prepared or authorized combat ritual.
 * H/J/K are ordinary actions; only B uses acquired spirit-vision mastery.
 */
export function resolvePryerCombatAbility(
  state: SliceState, id: PryerMoveId, physicalStateFactor: number, random: ActionRandomStream,
): PryerCombatEffect {
  if (!hasPresentFirstCaseOpponent(state)) {
    return noEffect('窥秘人行动：当前没有本场仍在抵抗的活体对手，本次贡献0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'BODY_STRIKE': {
      const heldClub = state.town.clubLocation === 'HAND';
      const selfGain = (heldClub ? 16 : 12) * physical;
      return { label: heldClub
        ? '持握原短棍打击：使用实际持握的普通短棍，16贡献替换普通徒手打击，不叠加神秘学力量、不耗灵性'
        : '普通身体打击：以本人身体实施普通近击，12贡献受身体状态影响；神秘学知识不增加伤害、不耗灵性',
      selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 8.4 * physical;
      return { label: '普通身体次击：本次普通动作贡献8.4，受身体状态影响，不额外附赠武器攻击、不耗灵性',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'hermit.s9.spirit-vision':
      if (!Number.isFinite(state.spirituality) || state.spirituality < 1) {
        return { ...noEffect('有限灵视所需灵性不足：本次改用普通格挡护身，贡献10受身体状态影响，不透支灵性'),
          enemyReduction: 10 * physical };
      }
      state.spirituality -= 1;
      return { ...noEffect('有限灵视与避让：消耗1灵性，观察眼前活体的有限灵性表征以辅助自保；不读心、不预知、不诊断病症，也不取消对手行动'),
        enemyReduction: 18 * visionMasteryFactor(state) };
    case 'SITE_PRESSURE':
      return { ...noEffect('普通走位牵制：利用眼前通道调整位置，贡献6受身体状态影响，不构成仪式控制、不耗灵性'),
        enemyReduction: 6 * physical };
    case 'hermit.s9.ritual-lore':
      // FIRST_CASE has no authored prepared-and-authorized ritual source. A
      // practice record, high mastery or general knowledge cannot supply one.
      return noEffect('核实仪式准备条件：本场没有已准备并获准使用的仪式来源；仪式知识需要实际准备，本次贡献0、消耗0，不凭空施法或生成材料');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -5 : 5;
      return { ...noEffect(`动作或判断偏差：本次意外贡献${selfGain > 0 ? '+' : '−'}5（G），不构成致伤攻击或知识灌输`), selfGain };
    }
  }
}
