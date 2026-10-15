import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** S9 M profile. All contribution budgets are original game balance (G). */
export const WARRIOR_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 35 }),
  Object.freeze({ id: '2', label: '2次', weight: 30 }),
  Object.freeze({ id: '3', label: '3次', weight: 20 }),
  Object.freeze({ id: '4', label: '4次', weight: 15 }),
]);

/** Ordinary bodily actions; these IDs do not unlock higher-sequence powers. */
export type WarriorMoveId = 'warrior.s9.physique' | 'warrior.s9.arms' | 'warrior.s9.restraint'
  | 'POSITION' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly {
  id: WarriorMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'warrior.s9.physique', label: '战士体魄打击', weight: 38, stance: 'ATTACK' },
  { id: 'warrior.s9.arms', label: '近身次击', weight: 20, stance: 'ATTACK' },
  { id: 'warrior.s9.restraint', label: '克制格挡与避让', weight: 8, stance: 'DEFEND' },
  { id: 'POSITION', label: '普通站位牵制', weight: 5, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '观察落点与退路', weight: 4, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '突破或失衡', weight: 25, stance: null },
];

export function isWarrior(state: SliceState): boolean {
  return state.progression?.pathwayId === 'warrior' && state.progression.sequence === 9;
}

/** Read original custody only. Combat never borrows, equips or copies this item. */
export function warriorPlayerHoldsPracticeClub(state: SliceState): boolean {
  const club = state.warrior?.practiceClub;
  return isWarrior(state) && club?.id === 'warrior-training-club' &&
    club.owner === '奥斯温·布莱克特' && club.custodian === 'PLAYER' && club.location === 'player:hand';
}

function heldClubLabel(state: SliceState | undefined): string | null {
  if (!state) return null;
  if (state.town.clubLocation === 'HAND') return '持握原短棍打击';
  return warriorPlayerHoldsPracticeClub(state) ? '持握奥斯温原练习短棍打击' : null;
}

function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function warriorAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  const clubLabel = heldClubLabel(state);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'warrior.s9.physique' && clubLabel ? clubLabel : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawWarriorAbility(random: ActionRandomStream, stance: SliceStance | null): WarriorMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('战士能力盘权重无效');
}
export function warriorActionCount(roll: number): number {
  return roll <= 35 ? 1 : roll <= 65 ? 2 : roll <= 85 ? 3 : 4;
}

export interface WarriorCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): WarriorCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/** Only the current first-case ordinary body and existing passage are authored. */
export interface WarriorCombatSource {
  runId: string; revision: number; week: number; encounterId: 'FIRST_CASE'; round: number;
  target: 'CURRENT_VISIBLE_ORDINARY_CARRIER'; body: 'CURRENT_REACHABLE_BODY';
  space: 'DRY_GROUND_PASSAGE'; exit: 'ORDINARY_OPEN_EXIT';
}
export function currentWarriorCombatSource(state: SliceState): WarriorCombatSource | null {
  if (!isWarrior(state) || state.status !== 'ACTIVE' || state.health <= 0 || !state.combat ||
      state.combat.enemyHealth <= 0 || state.combat.enemyStatus !== 'RESISTING' ||
      state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' };
}
function validCombatSource(state: SliceState, source: WarriorCombatSource | null): boolean {
  const current = currentWarriorCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week &&
    source.encounterId === current.encounterId && source.round === current.round &&
    source.target === current.target && source.body === current.body &&
    source.space === current.space && source.exit === current.exit;
}
function masteryFactor(state: SliceState, id: 'warrior.s9.physique' | 'warrior.s9.arms' | 'warrior.s9.restraint'): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** One physical action slot, with no spiritual cost, automatic immunity or extra hit. */
export function resolveWarriorCombatAbility(
  state: SliceState, id: WarriorMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: WarriorCombatSource | null = currentWarriorCombatSource(state),
): WarriorCombatEffect {
  if (!validCombatSource(state, source)) {
    return noEffect('战士行动：缺少本场仍可触及的普通对手与真实现场，本次贡献0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'warrior.s9.physique': {
      const clubLabel = heldClubLabel(state);
      const selfGain = (clubLabel ? 16 : 26 * masteryFactor(state, id)) * physical;
      return { label: clubLabel
        ? `${clubLabel}：采用这根普通短棍的贡献，不叠加体魄预算`
        : '战士体魄打击：以实际强化身体近身应对，不生成武器',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'warrior.s9.arms': {
      const selfGain = 18.2 * masteryFactor(state, id) * physical;
      return { label: '近身次击：以实际身体完成本次普通打击，独立占用一个行动',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'warrior.s9.restraint':
      return { ...noEffect('克制格挡与避让：普通身体防守，不能防弹，不产生晨曦光甲'),
        enemyReduction: 6 * masteryFactor(state, id) };
    case 'POSITION':
      return { ...noEffect('普通站位牵制：利用眼前通道调整距离，不强制擒拿或取消对手行动'),
        enemyReduction: 4.2 * masteryFactor(state, 'warrior.s9.arms') };
    case 'OBSERVE':
      return noEffect('观察落点与退路：复核眼前站位和原普通出口，本次贡献0，不追加攻击');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -5 : 5;
      return { ...noEffect(`突破或失衡：本次意外贡献${selfGain > 0 ? '+' : '−'}5（G），不构成致伤攻击`), selfGain };
    }
  }
}
