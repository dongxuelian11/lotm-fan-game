import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/**
 * Secret Supplicant S9: U20, A0.5/E0.8; all budgets, weights and costs are G.
 * FIRST_CASE contains an ordinary opponent, no registered terrifying presence
 * or prepared ritual source. Neither knowledge nor mastery creates one.
 */
export const SECRET_SUPPLICANT_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 25 }),
  Object.freeze({ id: '2', label: '2次', weight: 30 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 15 }),
  Object.freeze({ id: '5', label: '5次', weight: 5 }),
]);

export type SecretSupplicantMoveId = 'BODY_STRIKE' | 'BODY_FOLLOWUP' | 'hanged-man.s9.secret-sense'
  | 'SITE_PRESSURE' | 'hanged-man.s9.ritual-practice' | 'ACCIDENT';
const ABILITIES: readonly {
  id: SecretSupplicantMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'BODY_STRIKE', label: '普通身体/持握工具打击', weight: 25, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '普通身体次击', weight: 15, stance: 'ATTACK' },
  { id: 'hanged-man.s9.secret-sense', label: '核实感知条件与普通护身', weight: 20, stance: 'DEFEND' },
  { id: 'SITE_PRESSURE', label: '普通走位牵制', weight: 10, stance: 'CONTROL' },
  { id: 'hanged-man.s9.ritual-practice', label: '核实祭祀与仪式条件', weight: 25, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作或判断偏差', weight: 5, stance: null },
];

export function isSecretSupplicant(state: SliceState): boolean {
  return state.progression?.pathwayId === 'hanged-man' && state.progression.sequence === 9;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function secretSupplicantAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'BODY_STRIKE' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawSecretSupplicantAbility(
  random: ActionRandomStream, stance: SliceStance | null,
): SecretSupplicantMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('秘祈人能力盘权重无效');
}
export function secretSupplicantActionCount(roll: number): number {
  return roll <= 25 ? 1 : roll <= 55 ? 2 : roll <= 80 ? 3 : roll <= 95 ? 4 : 5;
}

export interface SecretSupplicantCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): SecretSupplicantCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
function hasPresentFirstCaseOpponent(state: SliceState): boolean {
  return isSecretSupplicant(state) && state.status === 'ACTIVE' && state.health > 0 &&
    state.combat !== null && state.combat.enemyHealth > 0 && state.combat.enemyStatus === 'RESISTING' &&
    state.arc.stage === 'COMBAT' && state.world.city === 'BACKLUND' &&
    state.combat.encounterId === 'FIRST_CASE' && state.world.carrierAlive && state.world.carrierCanResist;
}

/** No S8 whispers, out-of-control growths, S6 flesh or S5 grazing are S9 attacks. */
export function resolveSecretSupplicantCombatAbility(
  state: SliceState, id: SecretSupplicantMoveId, physicalStateFactor: number, random: ActionRandomStream,
): SecretSupplicantCombatEffect {
  if (!hasPresentFirstCaseOpponent(state)) {
    return noEffect('秘祈人行动：当前没有本场仍在抵抗的活体对手，本次贡献0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'BODY_STRIKE': {
      const heldClub = state.town.clubLocation === 'HAND';
      const selfGain = (heldClub ? 16 : 12) * physical;
      return { label: heldClub
        ? '持握原短棍打击：使用实际持握的普通短棍，16贡献替换普通徒手打击，受身体状态影响；不叠加神秘力量、不耗灵性'
        : '普通身体打击：以本人身体实施普通近击，12贡献受身体状态影响；祭祀与仪式掌握不增加身体力量、不耗灵性',
      selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 8.4 * physical;
      return { label: '普通身体次击：本次普通动作贡献8.4，受身体状态影响，不额外附赠武器攻击、不耗灵性',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'hanged-man.s9.secret-sense':
      return { ...noEffect('核实感知条件：本场没有已登记的神秘恐怖存在可供感知；本次改用普通格挡护身，贡献10受身体状态影响、消耗0，不凭空判断对手意图或听取耳语'),
        enemyReduction: 10 * physical };
    case 'SITE_PRESSURE':
      return { ...noEffect('普通走位牵制：利用眼前通道调整位置，贡献6受身体状态影响，不构成神秘控制、不耗灵性'),
        enemyReduction: 6 * physical };
    case 'hanged-man.s9.ritual-practice':
      return noEffect('核实祭祀与仪式条件：本场没有已准备并获准使用的仪式器具与对象；少量祭祀知识不替代实际准备，本次贡献0、消耗0，不生成祭坛、神谕、诅咒或新能力');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -5 : 5;
      return { ...noEffect(`动作或判断偏差：本次意外贡献${selfGain > 0 ? '+' : '−'}5（G），不构成致伤攻击或神秘启示`), selfGain };
    }
  }
}
