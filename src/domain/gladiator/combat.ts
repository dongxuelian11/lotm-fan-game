import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Approved S8 M profile; contribution budgets are original game balance (G). */
export const GLADIATOR_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 30 }),
  Object.freeze({ id: '2', label: '2次', weight: 30 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 15 }),
]);

/** Inherited body/restraint and S8 bodily skill, with no higher-sequence powers. */
export type GladiatorMoveId = 'warrior.s9.physique' | 'warrior.s8.combat-skill' | 'warrior.s9.restraint'
  | 'POSITION' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly {
  id: GladiatorMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'warrior.s9.physique', label: '格斗家体魄打击', weight: 38, stance: 'ATTACK' },
  { id: 'warrior.s8.combat-skill', label: '近身格斗技击', weight: 20, stance: 'ATTACK' },
  { id: 'warrior.s9.restraint', label: '克制格挡与避让', weight: 8, stance: 'DEFEND' },
  { id: 'POSITION', label: '格斗步法牵制', weight: 5, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '观察落点与退路', weight: 4, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '突破或失衡', weight: 25, stance: null },
];

export function isGladiator(state: SliceState): boolean {
  return state.progression?.pathwayId === 'warrior' && state.progression.sequence === 8;
}

/** The inherited original must really be in the player's hand; never borrow it here. */
export function gladiatorPlayerHoldsPracticeClub(state: SliceState): boolean {
  const club = state.warrior?.practiceClub;
  return isGladiator(state) && club?.id === 'warrior-training-club' &&
    club.owner === '奥斯温·布莱克特' && club.custodian === 'PLAYER' && club.location === 'player:hand';
}
function heldClubLabel(state: SliceState | undefined): string | null {
  if (!state) return null;
  if (state.town.clubLocation === 'HAND') return '持握原短棍打击';
  return gladiatorPlayerHoldsPracticeClub(state) ? '持握奥斯温原练习短棍打击' : null;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function gladiatorAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  const clubLabel = heldClubLabel(state);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'warrior.s9.physique' && clubLabel ? clubLabel : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawGladiatorAbility(random: ActionRandomStream, stance: SliceStance | null): GladiatorMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('格斗家能力盘权重无效');
}
export function gladiatorActionCount(roll: number): number {
  return roll <= 30 ? 1 : roll <= 60 ? 2 : roll <= 85 ? 3 : 4;
}

export interface GladiatorCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): GladiatorCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/** Only the current first-case ordinary body, passage and existing exit are authored. */
export interface GladiatorCombatSource {
  runId: string; revision: number; week: number; encounterId: 'FIRST_CASE'; round: number;
  target: 'CURRENT_VISIBLE_ORDINARY_CARRIER'; body: 'CURRENT_REACHABLE_BODY';
  space: 'DRY_GROUND_PASSAGE'; exit: 'ORDINARY_OPEN_EXIT';
}
export function currentGladiatorCombatSource(state: SliceState): GladiatorCombatSource | null {
  if (!isGladiator(state) || state.status !== 'ACTIVE' || state.health <= 0 || !state.combat ||
      state.combat.enemyHealth <= 0 || state.combat.enemyStatus !== 'RESISTING' ||
      state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' };
}
function validCombatSource(state: SliceState, source: GladiatorCombatSource | null): boolean {
  const current = currentGladiatorCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week &&
    source.encounterId === current.encounterId && source.round === current.round &&
    source.target === current.target && source.body === current.body &&
    source.space === current.space && source.exit === current.exit;
}
function masteryFactor(state: SliceState,
  id: 'warrior.s9.physique' | 'warrior.s8.combat-skill' | 'warrior.s9.restraint',
): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** One physical action slot, with no spiritual cost, free strike or automatic control. */
export function resolveGladiatorCombatAbility(
  state: SliceState, id: GladiatorMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: GladiatorCombatSource | null = currentGladiatorCombatSource(state),
): GladiatorCombatEffect {
  if (!validCombatSource(state, source)) {
    return noEffect('格斗家行动：缺少本场仍可触及的普通对手与真实现场，本次贡献0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'warrior.s9.physique': {
      const clubLabel = heldClubLabel(state);
      const selfGain = (clubLabel ? 16 : 42 * masteryFactor(state, id)) * physical;
      return { label: clubLabel
        ? `${clubLabel}：采用这根普通短棍的贡献，不叠加体魄预算`
        : '格斗家体魄打击：以继承的强化身体近身应对，不生成武器',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'warrior.s8.combat-skill': {
      const selfGain = 29.4 * masteryFactor(state, id) * physical;
      return { label: '近身格斗技击：以真实身体和格斗技巧完成本次打击，独立占用一个行动',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'warrior.s9.restraint':
      return { ...noEffect('克制格挡与避让：普通身体防守，不能防弹，不产生晨曦光甲'),
        enemyReduction: 9 * masteryFactor(state, id) };
    case 'POSITION':
      return { ...noEffect('格斗步法牵制：以实际格斗技巧调整距离，不保证擒拿、不取消对手行动'),
        enemyReduction: 6.3 * masteryFactor(state, 'warrior.s8.combat-skill') };
    case 'OBSERVE':
      return noEffect('观察落点与退路：复核眼前站位和原普通出口，本次贡献0，不追加攻击');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -7.5 : 7.5;
      return { ...noEffect(`突破或失衡：本次意外贡献${selfGain > 0 ? '+' : '−'}7.5（G），不构成致伤攻击`), selfGain };
    }
  }
}
