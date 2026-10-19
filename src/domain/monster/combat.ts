import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { PrisonerCombatSource } from '../prisoner/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/**
 * Monster S9: U20, A0.8/E0.8. All numeric budgets and wheels are G.
 * High spiritual perception, occasional future fragments and danger intuition
 * do not grant S8 physical/computational talent, S7 luck or certain foreknowledge.
 * This ordinary encounter supplies no authored future fragment to reveal.
 */
export const MONSTER_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 15 }),
  Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 25 }),
  Object.freeze({ id: '5', label: '5次', weight: 15 }),
]);

export type MonsterMoveId = 'STRIKE' | 'BODY_FOLLOWUP' | 'wheel.s9.danger-intuition'
  | 'POSITION' | 'wheel.s9.fragmentary-omen' | 'ACCIDENT';
const ABILITIES: readonly {
  id: MonsterMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'STRIKE', label: '普通近身打击', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '普通身体侧击', weight: 20, stance: 'ATTACK' },
  { id: 'wheel.s9.danger-intuition', label: '危险直觉与眼前避让', weight: 20, stance: 'DEFEND' },
  { id: 'POSITION', label: '普通走位牵制', weight: 10, stance: 'CONTROL' },
  { id: 'wheel.s9.fragmentary-omen', label: '保留未来碎片的不确定性', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '时机或失衡', weight: 5, stance: null },
];

export function isMonster(state: SliceState): boolean {
  return state.progression?.pathwayId === 'wheel' && state.progression.sequence === 9;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function monsterAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'STRIKE' && state?.town.clubLocation === 'HAND' ? '持握原短棍打击' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawMonsterAbility(random: ActionRandomStream, stance: SliceStance | null): MonsterMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('怪物能力盘权重无效');
}
export function monsterActionCount(roll: number): number {
  return roll <= 15 ? 1 : roll <= 35 ? 2 : roll <= 60 ? 3 : roll <= 85 ? 4 : 5;
}

export interface MonsterCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): MonsterCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/** The same present ordinary body and passage; never an oracle or a future RNG result. */
export type MonsterCombatSource = PrisonerCombatSource;
export function currentMonsterCombatSource(state: SliceState): MonsterCombatSource | null {
  if (!isMonster(state) || state.status !== 'ACTIVE' || !Number.isFinite(state.health) || state.health <= 0 ||
      !state.combat || !Number.isFinite(state.combat.enemyHealth) || state.combat.enemyHealth <= 0 ||
      state.combat.enemyStatus !== 'RESISTING' || state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' };
}
function validCombatSource(state: SliceState, source: MonsterCombatSource | null): boolean {
  const current = currentMonsterCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week &&
    source.encounterId === current.encounterId && source.round === current.round &&
    source.target === current.target && source.body === current.body &&
    source.space === current.space && source.exit === current.exit;
}
function dangerFactor(state: SliceState): number {
  const mastery = state.progression.mastery['wheel.s9.danger-intuition'] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** One existing slot; only actual ordinary physical attacks can threaten injury. */
export function resolveMonsterCombatAbility(
  state: SliceState, id: MonsterMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: MonsterCombatSource | null = currentMonsterCombatSource(state),
): MonsterCombatEffect {
  if (!validCombatSource(state, source)) {
    return noEffect('怪物行动：缺少本场仍可触及的可见普通对手与真实现场，本次贡献0、消耗0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'STRIKE': {
      // Only this original club actually in HAND replaces H; nothing is equipped here.
      const heldClub = state.town.clubLocation === 'HAND';
      const selfGain = (heldClub ? 16 : 12) * physical;
      return { label: heldClub
        ? '持握原短棍打击：只采用已经在手的普通短棍贡献，不叠加身体或灵性感知加成'
        : '普通近身打击：普通身体贡献（G），不是机器人身体强化；伤害仍由共同伤势盘结算',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 8.4 * physical;
      return { label: '普通身体侧击：普通身体贡献（G），独立占用本次行动，不追加攻击或机器人身体强化',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'wheel.s9.danger-intuition':
      return { ...noEffect('危险直觉与眼前避让：只减少当前真实可见普通对手的压力，不保证预知下一步，不取消敌方行动或保证存活'),
        enemyReduction: 18 * dangerFactor(state) * physical };
    case 'POSITION':
      return { ...noEffect('普通走位牵制：只用眼前通道调整距离（G），不是超常身体控制，不强制取消对手行动'),
        enemyReduction: 6 * physical };
    case 'wheel.s9.fragmentary-omen':
      return noEffect('未来碎片：本场没有可验证的新未来来源，保留不确定性；眼前普通行动不能当作预言。本次贡献0、消耗0，不造成伤害、不保证胜利、不重掷或回退，不读取敌方未来随机结果');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -5 : 5;
      return { ...noEffect(`时机或失衡：本次意外贡献${selfGain > 0 ? '+' : '−'}5（G），不构成致伤攻击，不是幸运操纵或重掷`), selfGain };
    }
  }
}
