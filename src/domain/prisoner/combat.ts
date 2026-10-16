import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/**
 * Prisoner S9: U20, A0.8/E0.8. All numeric budgets, wheels and mastery scaling are G.
 * Book 2, chapter 118 supplies strong body, keen perception and fighting with
 * ordinary objects. S8 sacrifice of reason, S7 wolf form and S6 armor are absent.
 */
export const PRISONER_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 15 }),
  Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 25 }),
  Object.freeze({ id: '5', label: '5次', weight: 15 }),
]);

type PrisonerMasteryId = 'chained.s9.prisoner-body' | 'chained.s9.keen-perception' | 'chained.s9.improvised-combat';
export type PrisonerMoveId = PrisonerMasteryId | 'BODY_FOLLOWUP' | 'POSITION' | 'ACCIDENT';
const ABILITIES: readonly {
  id: PrisonerMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'chained.s9.prisoner-body', label: '囚犯体魄打击', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '身体侧击', weight: 20, stance: 'ATTACK' },
  { id: 'chained.s9.keen-perception', label: '敏锐感知与眼前避让', weight: 20, stance: 'DEFEND' },
  { id: 'POSITION', label: '普通走位牵制', weight: 10, stance: 'CONTROL' },
  { id: 'chained.s9.improvised-combat', label: '核实手边普通工具', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '时机或失衡', weight: 5, stance: null },
];

export function isPrisoner(state: SliceState): boolean {
  return state.progression?.pathwayId === 'chained' && state.progression.sequence === 9;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function prisonerAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'chained.s9.prisoner-body' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击' : ability.id === 'chained.s9.improvised-combat' && state?.town.clubLocation === 'HAND'
      ? '核实原短棍握持' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawPrisonerAbility(random: ActionRandomStream, stance: SliceStance | null): PrisonerMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('囚犯能力盘权重无效');
}
export function prisonerActionCount(roll: number): number {
  return roll <= 15 ? 1 : roll <= 35 ? 2 : roll <= 60 ? 3 : roll <= 85 ? 4 : 5;
}

export interface PrisonerCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): PrisonerCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/** Only the present ordinary opponent and original passage, never future danger or secrets. */
export interface PrisonerCombatSource {
  runId: string; revision: number; week: number; encounterId: 'FIRST_CASE'; round: number;
  target: 'CURRENT_VISIBLE_ORDINARY_CARRIER'; body: 'CURRENT_REACHABLE_BODY';
  space: 'DRY_GROUND_PASSAGE'; exit: 'ORDINARY_OPEN_EXIT';
}
export function currentPrisonerCombatSource(state: SliceState): PrisonerCombatSource | null {
  if (!isPrisoner(state) || state.status !== 'ACTIVE' || state.health <= 0 || !state.combat ||
      state.combat.enemyHealth <= 0 || state.combat.enemyStatus !== 'RESISTING' ||
      state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' };
}
function validCombatSource(state: SliceState, source: PrisonerCombatSource | null): boolean {
  const current = currentPrisonerCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week &&
    source.encounterId === current.encounterId && source.round === current.round &&
    source.target === current.target && source.body === current.body &&
    source.space === current.space && source.exit === current.exit;
}
function masteryFactor(state: SliceState, id: PrisonerMasteryId): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** One physical slot at 0S, with no mental resistance, extra attack or future random draw. */
export function resolvePrisonerCombatAbility(
  state: SliceState, id: PrisonerMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: PrisonerCombatSource | null = currentPrisonerCombatSource(state),
): PrisonerCombatEffect {
  if (!validCombatSource(state, source)) {
    return noEffect('囚犯行动：缺少本场仍可触及的普通对手与真实现场，本次贡献0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'chained.s9.prisoner-body': {
      // Practice props, including a borrowed wooden spacer, are never combat loadout.
      const heldClub = state.town.clubLocation === 'HAND';
      const selfGain = (heldClub ? 16 : 16 * masteryFactor(state, id)) * physical;
      return { label: heldClub
        ? '持握原短棍打击：只采用这根普通短棍的贡献，不叠加囚犯体魄预算或掌握加成'
        : '囚犯体魄打击：以实际强化身体近身应对，不生成武器，不消耗灵性',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 11.2 * masteryFactor(state, 'chained.s9.prisoner-body') * physical;
      return { label: '身体侧击：沿用囚犯体魄掌握度，独立占用本次行动，不追加攻击',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'chained.s9.keen-perception':
      return { ...noEffect('敏锐感知与眼前避让：只针对当前可见普通对手的压力，以身体避让，不预知下一步动作'),
        enemyReduction: 16 * masteryFactor(state, id) * physical };
    case 'POSITION':
      return { ...noEffect('普通走位牵制：利用眼前通道调整距离，不强制控制或取消对手行动'),
        enemyReduction: 6 * physical };
    case 'chained.s9.improvised-combat':
      return noEffect(state.town.clubLocation === 'HAND'
        ? '核实原短棍握持：只检查已经在手的普通短棍，本次贡献0、消耗0，不追加攻击或改变物品归属'
        : '核实手边普通工具：本场没有已持握的可用工具来源，本次贡献0、消耗0，不从闭合背包取物或凭空制造工具');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -5 : 5;
      return { ...noEffect(`时机或失衡：本次意外贡献${selfGain > 0 ? '+' : '−'}5（G），不构成致伤攻击`), selfGain };
    }
  }
}
