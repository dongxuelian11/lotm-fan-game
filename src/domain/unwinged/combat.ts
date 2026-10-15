import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/**
 * Unwinged Angel S8: U30, A0.8/E0.9. This physical profile is an explicit G adaptation.
 * The source confirms further inhuman bodily change, but no verified individual
 * devil-spell list. Conscience loss belongs to the life module and grants no armor,
 * immunity, coercion, future sight, extra actions or relief from shared injuries.
 */
export const UNWINGED_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 10 }),
  Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 25 }),
  Object.freeze({ id: '5', label: '5次', weight: 20 }),
]);

type UnwingedMasteryId = 'abyss.s8.inhuman-body' | 'abyss.s9.alertness' | 'abyss.s9.illicit-insight';
export type UnwingedMoveId = UnwingedMasteryId | 'BODY_FOLLOWUP' | 'POSITION' | 'ACCIDENT';
const ABILITIES: readonly {
  id: UnwingedMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'abyss.s8.inhuman-body', label: '非人体魄打击', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '身体侧击', weight: 20, stance: 'ATTACK' },
  { id: 'abyss.s9.alertness', label: '敏锐直觉与眼前避让', weight: 20, stance: 'DEFEND' },
  { id: 'POSITION', label: '普通走位牵制', weight: 10, stance: 'CONTROL' },
  { id: 'abyss.s9.illicit-insight', label: '核实越界线索', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '时机或失衡', weight: 5, stance: null },
];

export function isUnwinged(state: SliceState): boolean {
  return state.progression?.pathwayId === 'abyss' && state.progression.sequence === 8;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function unwingedAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'abyss.s8.inhuman-body' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawUnwingedAbility(random: ActionRandomStream, stance: SliceStance | null): UnwingedMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('折翼天使能力盘权重无效');
}
export function unwingedActionCount(roll: number): number {
  return roll <= 10 ? 1 : roll <= 30 ? 2 : roll <= 55 ? 3 : roll <= 80 ? 4 : 5;
}

export interface UnwingedCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): UnwingedCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/** Only the present ordinary opponent and original passage, never future danger or secrets. */
export interface UnwingedCombatSource {
  runId: string; revision: number; week: number; encounterId: 'FIRST_CASE'; round: number;
  target: 'CURRENT_VISIBLE_ORDINARY_CARRIER'; body: 'CURRENT_REACHABLE_BODY';
  space: 'DRY_GROUND_PASSAGE'; exit: 'ORDINARY_OPEN_EXIT';
}
export function currentUnwingedCombatSource(state: SliceState): UnwingedCombatSource | null {
  if (!isUnwinged(state) || state.status !== 'ACTIVE' || state.health <= 0 || !state.combat ||
      state.combat.enemyHealth <= 0 || state.combat.enemyStatus !== 'RESISTING' ||
      state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' };
}
function validCombatSource(state: SliceState, source: UnwingedCombatSource | null): boolean {
  const current = currentUnwingedCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week &&
    source.encounterId === current.encounterId && source.round === current.round &&
    source.target === current.target && source.body === current.body &&
    source.space === current.space && source.exit === current.exit;
}
function masteryFactor(state: SliceState, id: UnwingedMasteryId): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** One physical slot at 0S, with no immunity, extra attack or future random draw. */
export function resolveUnwingedCombatAbility(
  state: SliceState, id: UnwingedMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: UnwingedCombatSource | null = currentUnwingedCombatSource(state),
): UnwingedCombatEffect {
  if (!validCombatSource(state, source)) {
    return noEffect('折翼天使行动：缺少本场仍可触及的普通对手与真实现场，本次贡献0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'abyss.s8.inhuman-body': {
      const heldClub = state.town.clubLocation === 'HAND';
      const selfGain = (heldClub ? 16 : 24 * masteryFactor(state, id)) * physical;
      return { label: heldClub
        ? '持握原短棍打击：只采用这根普通短棍的贡献，不叠加非人体魄预算或掌握加成'
        : '非人体魄打击：以实际强化身体近身应对，不生成武器，不消耗灵性',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 16.8 * masteryFactor(state, 'abyss.s8.inhuman-body') * physical;
      return { label: '身体侧击：沿用非人体魄掌握度，独立占用本次行动，不追加攻击',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'abyss.s9.alertness':
      return { ...noEffect('敏锐直觉与眼前避让：只针对当前可见普通对手的压力，以身体避让，不预知下一步动作'),
        enemyReduction: 17.1 * masteryFactor(state, id) * physical };
    case 'POSITION':
      return { ...noEffect('普通走位牵制：利用眼前通道调整距离，不强制控制或取消对手行动'),
        enemyReduction: 6 * physical };
    case 'abyss.s9.illicit-insight':
      // FIRST_CASE has no authored, currently related record for this ability.
      // Practice history, copied knowledge and caller flags cannot grant one.
      return noEffect('核实越界线索：本场缺少相关记录与明确来源，本次贡献0、消耗0，不推知隐藏物品或犯罪计划');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -7.5 : 7.5;
      return { ...noEffect(`时机或失衡：本次意外贡献${selfGain > 0 ? '+' : '−'}7.5（G），不构成致伤攻击`), selfGain };
    }
  }
}
