import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/**
 * Listener S8: U30, A0.7/E1; all budgets, weights and costs are G.
 * The ordinary FIRST_CASE has no authored corresponding hidden existence or
 * present supernatural voice. World contact does not create a combat source.
 * Its source-constrained ordinary actions intentionally remain weak attacks.
 */
export const LISTENER_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 20 }),
  Object.freeze({ id: '2', label: '2次', weight: 25 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 20 }),
  Object.freeze({ id: '5', label: '5次', weight: 10 }),
]);

export type ListenerMoveId = 'BODY_STRIKE' | 'BODY_FOLLOWUP' | 'hanged-man.s9.secret-sense'
  | 'SITE_PRESSURE' | 'hanged-man.s8.whisper-listening' | 'ACCIDENT';
const ABILITIES: readonly {
  id: ListenerMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'BODY_STRIKE', label: '普通身体/持握工具打击', weight: 25, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '普通身体次击', weight: 15, stance: 'ATTACK' },
  { id: 'hanged-man.s9.secret-sense', label: '核实感知条件与普通护身', weight: 20, stance: 'DEFEND' },
  { id: 'SITE_PRESSURE', label: '普通走位牵制', weight: 10, stance: 'CONTROL' },
  { id: 'hanged-man.s8.whisper-listening', label: '核实在场耳语与仪式来源', weight: 25, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作或判断偏差', weight: 5, stance: null },
];

export function isListener(state: SliceState): boolean {
  return state.progression?.pathwayId === 'hanged-man' && state.progression.sequence === 8;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function listenerAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'BODY_STRIKE' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawListenerAbility(random: ActionRandomStream, stance: SliceStance | null): ListenerMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('倾听者能力盘权重无效');
}
export function listenerActionCount(roll: number): number {
  return roll <= 20 ? 1 : roll <= 45 ? 2 : roll <= 70 ? 3 : roll <= 90 ? 4 : 5;
}

export interface ListenerCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): ListenerCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
function hasPresentFirstCaseOpponent(state: SliceState): boolean {
  return isListener(state) && state.status === 'ACTIVE' && state.health > 0 &&
    state.combat !== null && state.combat.enemyHealth > 0 && state.combat.enemyStatus === 'RESISTING' &&
    state.arc.stage === 'COMBAT' && state.world.city === 'BACKLUND' &&
    state.combat.encounterId === 'FIRST_CASE' && state.world.carrierAlive && state.world.carrierCanResist;
}

/**
 * Hearing the corresponding hidden existence can yield source-specific gifts,
 * not a universal spell list. None is authored here. S6 flesh, S5 grazing and
 * out-of-control bodily changes are not automatic S8 attacks or rescues.
 */
export function resolveListenerCombatAbility(
  state: SliceState, id: ListenerMoveId, physicalStateFactor: number, random: ActionRandomStream,
): ListenerCombatEffect {
  if (!hasPresentFirstCaseOpponent(state)) {
    return noEffect('倾听者行动：当前没有本场仍在抵抗的活体对手，本次贡献0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'BODY_STRIKE': {
      const heldClub = state.town.clubLocation === 'HAND';
      const selfGain = (heldClub ? 16 : 12) * physical;
      return { label: heldClub
        ? '持握原短棍打击：使用实际持握的普通短棍，16贡献替换普通徒手打击，受身体状态影响；不叠加神秘力量、不耗灵性'
        : '普通身体打击：以本人身体实施普通近击，12贡献受身体状态影响；耳语、祭祀与仪式掌握不增加身体力量、不耗灵性',
      selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 8.4 * physical;
      return { label: '普通身体次击：本次普通动作贡献8.4，受身体状态影响，不额外附赠武器攻击或神秘能力、不耗灵性',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'hanged-man.s9.secret-sense':
      return { ...noEffect('核实感知条件：本场没有已登记的神秘恐怖存在可供感知；本次改用普通格挡护身，贡献10受身体状态影响、消耗0，不凭空读取对手念头或听取耳语'),
        enemyReduction: 10 * physical };
    case 'SITE_PRESSURE':
      return { ...noEffect('普通走位牵制：利用眼前通道调整位置，贡献6受身体状态影响，不构成神秘控制、不读取对手意图、不耗灵性'),
        enemyReduction: 6 * physical };
    case 'hanged-man.s8.whisper-listening':
      return noEffect('核实在场耳语与仪式来源：本场未登记对应隐秘存在的在场耳语来源，也没有已准备并获准使用的仪式器具与对象；旧物间接触与知识不能移入首案，本次贡献0、消耗0，不额外抽盘、不生成启示、赐予、法术或污染');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -7.5 : 7.5;
      return { ...noEffect(`动作或判断偏差：本次意外贡献${selfGain > 0 ? '+' : '−'}7.5（G），不构成致伤攻击、神秘启示或呓语反噬`), selfGain };
    }
  }
}
