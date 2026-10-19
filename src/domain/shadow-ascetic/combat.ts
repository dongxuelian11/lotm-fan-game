import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/**
 * Shadow Ascetic S7: U45, A1/E1.2; all budgets, weights and costs are G.
 * Canon supports finite shadow concealment that can be detected, not immunity,
 * teleportation or clones. FIRST_CASE authors neither usable shadow cover nor
 * a corresponding supernatural voice. Practice cannot create a combat source.
 * Bodily/spiritual progression lives in the shared S7 base, not invented spells.
 */
export const SHADOW_ASCETIC_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 10 }),
  Object.freeze({ id: '2', label: '2次', weight: 15 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 30 }),
  Object.freeze({ id: '5', label: '5次', weight: 20 }),
]);

export type ShadowAsceticMoveId = 'BODY_STRIKE' | 'BODY_FOLLOWUP' | 'hanged-man.s9.secret-sense'
  | 'hanged-man.s7.shadow-concealment' | 'hanged-man.s8.whisper-listening' | 'ACCIDENT';
const ABILITIES: readonly {
  id: ShadowAsceticMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'BODY_STRIKE', label: '普通身体/持握工具打击', weight: 25, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '普通身体次击', weight: 15, stance: 'ATTACK' },
  { id: 'hanged-man.s9.secret-sense', label: '核实感知条件与普通护身', weight: 20, stance: 'DEFEND' },
  { id: 'hanged-man.s7.shadow-concealment', label: '藏影条件核实与普通走位', weight: 15, stance: 'CONTROL' },
  { id: 'hanged-man.s8.whisper-listening', label: '核实在场耳语与仪式来源', weight: 20, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作或判断偏差', weight: 5, stance: null },
];

export function isShadowAscetic(state: SliceState): boolean {
  return state.progression?.pathwayId === 'hanged-man' && state.progression.sequence === 7;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function shadowAsceticAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'BODY_STRIKE' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawShadowAsceticAbility(random: ActionRandomStream, stance: SliceStance | null): ShadowAsceticMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('隐修士能力盘权重无效');
}
export function shadowAsceticActionCount(roll: number): number {
  return roll <= 10 ? 1 : roll <= 25 ? 2 : roll <= 50 ? 3 : roll <= 80 ? 4 : 5;
}

export interface ShadowAsceticCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): ShadowAsceticCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
function hasPresentFirstCaseOpponent(state: SliceState): boolean {
  return isShadowAscetic(state) && state.status === 'ACTIVE' && state.health > 0 &&
    state.combat !== null && state.combat.enemyHealth > 0 && state.combat.enemyStatus === 'RESISTING' &&
    state.arc.stage === 'COMBAT' && state.world.city === 'BACKLUND' &&
    state.combat.encounterId === 'FIRST_CASE' && state.world.carrierAlive && state.world.carrierCanResist;
}

/**
 * Hearing the corresponding hidden existence can yield source-specific gifts,
 * not a universal spell list. None is authored here. S6 flesh, S5 grazing and
 * out-of-control bodily changes are not automatic S7 attacks or rescues.
 */
export function resolveShadowAsceticCombatAbility(
  state: SliceState, id: ShadowAsceticMoveId, physicalStateFactor: number, random: ActionRandomStream,
): ShadowAsceticCombatEffect {
  if (!hasPresentFirstCaseOpponent(state)) {
    return noEffect('隐修士行动：当前没有本场仍在抵抗的活体对手，本次贡献0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'BODY_STRIKE': {
      const heldClub = state.town.clubLocation === 'HAND';
      const selfGain = (heldClub ? 16 : 12) * physical;
      return { label: heldClub
        ? '持握原短棍打击：使用实际持握的普通短棍，16贡献替换普通徒手打击，受身体状态影响；不叠加神秘力量、不耗灵性'
        : '普通身体打击：以本人身体实施普通近击，12贡献受身体状态影响；藏影、耳语、祭祀与仪式掌握不额外增加身体力量、不耗灵性',
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
    case 'hanged-man.s7.shadow-concealment':
      // A different practice scene, mastery or a stored hidden flag cannot
      // author usable shadow here or suppress the ordinary opponent's slots.
      return { ...noEffect('藏影条件核实：首案现场没有已登记的可用阴影；本次改用普通走位牵制，贡献6受身体状态影响、消耗0。练习中的藏匿不能带入本场，不自动隐形、不免疫、不取消对手行动，也不瞬移或生成分身'),
        enemyReduction: 6 * physical };
    case 'hanged-man.s8.whisper-listening':
      return noEffect('核实在场耳语与仪式来源：本场未登记对应隐秘存在的在场耳语来源，也没有已准备并获准使用的仪式器具与对象；旧物间接触、阴影练习与知识不能移入首案，本次贡献0、消耗0，不额外抽盘、不生成启示、赐予、法术或污染');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -11.25 : 11.25;
      return { ...noEffect(`动作或判断偏差：本次意外贡献${selfGain > 0 ? '+' : '−'}11.25（G），不构成致伤攻击、神秘启示或呓语反噬`), selfGain };
    }
  }
}
