import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { PrisonerCombatSource } from '../prisoner/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/**
 * Lawyer S9: this playable profile and all numeric budgets and wheels are G.
 * Ordinary body and movement, observed weaknesses and rule analysis never grant
 * S8 strength, S7 bribery, S6 distortion or control over another person's consent.
 * This encounter has no negotiable terms or existing agreement to exploit.
 */
export const LAWYER_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 15 }),
  Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 25 }),
  Object.freeze({ id: '5', label: '5次', weight: 15 }),
]);

export type LawyerMoveId = 'STRIKE' | 'BODY_FOLLOWUP' | 'black-emperor.s9.weak-point-insight'
  | 'POSITION' | 'black-emperor.s9.rule-analysis' | 'ACCIDENT';
const ABILITIES: readonly {
  id: LawyerMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'STRIKE', label: '普通近身打击', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '普通身体侧击', weight: 20, stance: 'ATTACK' },
  { id: 'black-emperor.s9.weak-point-insight', label: '可见破绽判断与护身', weight: 20, stance: 'DEFEND' },
  { id: 'POSITION', label: '普通走位牵制', weight: 10, stance: 'CONTROL' },
  { id: 'black-emperor.s9.rule-analysis', label: '核对本场可用规则', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '时机或失衡', weight: 5, stance: null },
];

export function isLawyer(state: SliceState): boolean {
  return state.progression?.pathwayId === 'black-emperor' && state.progression.sequence === 9;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function lawyerAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'STRIKE' && state?.town.clubLocation === 'HAND' ? '持握原短棍打击' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawLawyerAbility(random: ActionRandomStream, stance: SliceStance | null): LawyerMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('律师能力盘权重无效');
}
export function lawyerActionCount(roll: number): number {
  return roll <= 15 ? 1 : roll <= 35 ? 2 : roll <= 60 ? 3 : roll <= 85 ? 4 : 5;
}

export interface LawyerCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): LawyerCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/** Only the present ordinary opponent and passage, never hidden terms or inferred consent. */
export type LawyerCombatSource = PrisonerCombatSource;
export function currentLawyerCombatSource(state: SliceState): LawyerCombatSource | null {
  if (!isLawyer(state) || state.status !== 'ACTIVE' || !Number.isFinite(state.health) || state.health <= 0 ||
      !state.combat || !Number.isFinite(state.combat.enemyHealth) || state.combat.enemyHealth <= 0 ||
      state.combat.enemyStatus !== 'RESISTING' || state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' };
}
function validCombatSource(state: SliceState, source: LawyerCombatSource | null): boolean {
  const current = currentLawyerCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week &&
    source.encounterId === current.encounterId && source.round === current.round &&
    source.target === current.target && source.body === current.body &&
    source.space === current.space && source.exit === current.exit;
}
function weakPointFactor(state: SliceState): number {
  const mastery = state.progression.mastery['black-emperor.s9.weak-point-insight'] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** One existing slot; only actual ordinary physical attacks can threaten injury. */
export function resolveLawyerCombatAbility(
  state: SliceState, id: LawyerMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: LawyerCombatSource | null = currentLawyerCombatSource(state),
): LawyerCombatEffect {
  if (!validCombatSource(state, source)) {
    return noEffect('律师行动：缺少本场仍可触及的可见普通对手与真实现场，本次贡献0、消耗0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'STRIKE': {
      // Only this original club actually in HAND replaces H; nothing is equipped here.
      const heldClub = state.town.clubLocation === 'HAND';
      const selfGain = (heldClub ? 16 : 12) * physical;
      return { label: heldClub
        ? '持握原短棍打击：只采用已经在手的普通短棍贡献，不叠加体能强化或破绽判断加成'
        : '普通近身打击：普通身体贡献（G），没有野蛮人体能强化；伤害仍由共同伤势盘结算',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 8.4 * physical;
      return { label: '普通身体侧击：普通身体贡献（G），独立占用本次行动，不追加攻击或野蛮人体能强化',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'black-emperor.s9.weak-point-insight':
      return { ...noEffect('可见破绽判断与护身：只依据眼前普通对手已显露的动作调整防守（G），不是读取思想或预知下一步，不取消敌方行动或保证存活'),
        enemyReduction: 18 * weakPointFactor(state) * physical };
    case 'POSITION':
      return { ...noEffect('普通走位牵制：只用眼前通道调整距离（G）；本场不以口才强制同意，不强制取消对手行动'),
        enemyReduction: 6 * physical };
    case 'black-emperor.s9.rule-analysis':
      return noEffect('规则理解：本场没有可协商条款或已达成协议，不能凭空制造规则漏洞。本次贡献0、消耗0，不造成伤害、不保证胜利、不强制同意，不改写规则或读取隐藏信息；说服不是精神控制');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -5 : 5;
      return { ...noEffect(`时机或失衡：本次意外贡献${selfGain > 0 ? '+' : '−'}5（G），不构成致伤攻击，不是贿赂、扭曲或重掷`), selfGain };
    }
  }
}
