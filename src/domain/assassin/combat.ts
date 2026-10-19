import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Assassin S9 D profile. Contributions and local costs are finite G balance. */
export const ASSASSIN_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 15 }),
  Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 25 }),
  Object.freeze({ id: '5', label: '5次', weight: 15 }),
]);

type AssassinMasteryId = 'assassin.s9.lightness' | 'assassin.s9.vision'
  | 'assassin.s9.shadow' | 'assassin.s9.burst';
export type AssassinMoveId = AssassinMasteryId | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly {
  id: AssassinMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'assassin.s9.burst', label: '蓄力爆发', weight: 32, stance: 'ATTACK' },
  { id: 'assassin.s9.lightness', label: '轻身近击', weight: 18, stance: 'ATTACK' },
  { id: 'assassin.s9.vision', label: '敏锐观察与避让', weight: 12, stance: 'DEFEND' },
  { id: 'assassin.s9.shadow', label: '藏影条件核实与走位', weight: 10, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '观察眼前动作', weight: 8, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '时机或失衡', weight: 20, stance: null },
];

export function isAssassin(state: SliceState): boolean {
  return state.progression?.pathwayId === 'demoness' && state.progression.sequence === 9;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function assassinAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'assassin.s9.burst' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawAssassinAbility(random: ActionRandomStream, stance: SliceStance | null): AssassinMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('刺客能力盘权重无效');
}
export function assassinActionCount(roll: number): number {
  return roll <= 15 ? 1 : roll <= 35 ? 2 : roll <= 60 ? 3 : roll <= 85 ? 4 : 5;
}

export interface AssassinCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): AssassinCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/** This source grants no shadow, hidden target, prepared weapon or future action. */
export interface AssassinCombatSource {
  runId: string; revision: number; week: number; encounterId: 'FIRST_CASE'; round: number;
  target: 'CURRENT_VISIBLE_ORDINARY_CARRIER'; body: 'CURRENT_REACHABLE_BODY';
  space: 'DRY_GROUND_PASSAGE'; exit: 'ORDINARY_OPEN_EXIT';
}
export function currentAssassinCombatSource(state: SliceState): AssassinCombatSource | null {
  if (!isAssassin(state) || state.status !== 'ACTIVE' || state.health <= 0 || !state.combat ||
      state.combat.enemyHealth <= 0 || state.combat.enemyStatus !== 'RESISTING' ||
      state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' };
}
function validCombatSource(state: SliceState, source: AssassinCombatSource | null): boolean {
  const current = currentAssassinCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week &&
    source.encounterId === current.encounterId && source.round === current.round &&
    source.target === current.target && source.body === current.body &&
    source.space === current.space && source.exit === current.exit;
}
function masteryFactor(state: SliceState, id: AssassinMasteryId): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** One drawn slot; burst changes contribution, never the shared injury/death rules. */
export function resolveAssassinCombatAbility(
  state: SliceState, id: AssassinMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: AssassinCombatSource | null = currentAssassinCombatSource(state),
): AssassinCombatEffect {
  if (!validCombatSource(state, source)) {
    return noEffect('刺客行动：缺少本场仍可触及的普通对手与真实现场，本次贡献0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'assassin.s9.burst': {
      const heldClub = state.town.clubLocation === 'HAND';
      if (heldClub) {
        const selfGain = 16 * physical;
        return { label: '持握原短棍打击：采用这根普通短棍的贡献，不叠加爆发、不消耗灵性',
          selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      if (!Number.isFinite(state.spirituality) || state.spirituality < 1) {
        const selfGain = 12 * physical;
        return { label: '爆发所需灵性不足：改为本次普通身体打击，不透支灵性',
          selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      state.spirituality -= 1;
      const selfGain = 16 * masteryFactor(state, id) * physical;
      return { label: '蓄力爆发：消耗1灵性集中身体力量，本次贡献仍按共同伤势盘结算，不是必杀',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'assassin.s9.lightness': {
      const selfGain = 11.2 * masteryFactor(state, id) * physical;
      return { label: '轻身近击：实际步法与身体完成本次近击，不生成刀具、不飞行',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'assassin.s9.vision':
      return { ...noEffect('敏锐观察与避让：只看眼前动作，以身体避开部分压力，不取消对手行动'),
        enemyReduction: 12 * masteryFactor(state, id) };
    case 'assassin.s9.shadow':
      // No existing combat scene authors usable dark cover. Knowledge, the hour,
      // another practice scene and caller-supplied flags cannot create it here.
      // A future authored shadow action needs its own real scene source before
      // receiving the 7.8f/1S budget; this passage always uses ordinary footwork.
      return { ...noEffect('藏影条件不足：本场没有已核实暗处，改为普通走位，不消耗灵性、不进入隐形'),
        enemyReduction: 6 * masteryFactor(state, id) };
    case 'OBSERVE':
      return noEffect('观察眼前动作与原退路：本次贡献0，不预读未来动作或隐藏事实');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -5 : 5;
      return { ...noEffect(`时机或失衡：本次意外贡献${selfGain > 0 ? '+' : '−'}5（G），不构成致伤攻击`), selfGain };
    }
  }
}
