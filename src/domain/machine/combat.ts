import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { MonsterCombatSource } from '../monster/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/**
 * Machine S8: U30, A0.9/E0.9. Wheels, budgets and core weights are G.
 * Computation, precise bodily control and weapon talent require an actual body
 * and actual tools. They grant neither perfect aim nor automatic manufacturing.
 * Inherited perception is not a future RNG oracle; S7 luck is not available.
 */
export const MACHINE_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 10 }),
  Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 25 }),
  Object.freeze({ id: '5', label: '5次', weight: 20 }),
]);

export type MachineMoveId = 'wheel.s8.calculation-control' | 'BODY_FOLLOWUP'
  | 'wheel.s9.danger-intuition' | 'POSITION' | 'wheel.s8.divination-guard' | 'ACCIDENT';
const ABILITIES: readonly {
  id: MachineMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'wheel.s8.calculation-control', label: '计算与精确身体打击', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '精确身体侧击', weight: 20, stance: 'ATTACK' },
  { id: 'wheel.s9.danger-intuition', label: '危险直觉与眼前避让', weight: 20, stance: 'DEFEND' },
  { id: 'POSITION', label: '普通走位牵制', weight: 10, stance: 'CONTROL' },
  { id: 'wheel.s8.divination-guard', label: '核实占卜与反占卜来源', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '时机或失衡', weight: 5, stance: null },
];

export function isMachine(state: SliceState): boolean {
  return state.progression?.pathwayId === 'wheel' && state.progression.sequence === 8;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function machineAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'wheel.s8.calculation-control' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawMachineAbility(random: ActionRandomStream, stance: SliceStance | null): MachineMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('机器能力盘权重无效');
}
export function machineActionCount(roll: number): number {
  return roll <= 10 ? 1 : roll <= 30 ? 2 : roll <= 55 ? 3 : roll <= 80 ? 4 : 5;
}

export interface MachineCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): MachineCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/** Only this present ordinary opponent, reachable body and existing passage. */
export type MachineCombatSource = MonsterCombatSource;
export function currentMachineCombatSource(state: SliceState): MachineCombatSource | null {
  if (!isMachine(state) || state.status !== 'ACTIVE' || !Number.isFinite(state.health) || state.health <= 0 ||
      !state.combat || !Number.isFinite(state.combat.enemyHealth) || state.combat.enemyHealth <= 0 ||
      state.combat.enemyStatus !== 'RESISTING' || state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' };
}
function validCombatSource(state: SliceState, source: MachineCombatSource | null): boolean {
  const current = currentMachineCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week &&
    source.encounterId === current.encounterId && source.round === current.round &&
    source.target === current.target && source.body === current.body &&
    source.space === current.space && source.exit === current.exit;
}
function masteryFactor(state: SliceState,
  id: 'wheel.s8.calculation-control' | 'wheel.s9.danger-intuition',
): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** One existing slot; only an actual physical attack can enter the shared injury draw. */
export function resolveMachineCombatAbility(
  state: SliceState, id: MachineMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: MachineCombatSource | null = currentMachineCombatSource(state),
): MachineCombatEffect {
  if (!validCombatSource(state, source)) {
    return noEffect('机器行动：缺少本场仍可触及的可见普通对手与真实现场，本次贡献0、消耗0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'wheel.s8.calculation-control': {
      // Only the original club actually in HAND replaces H; talent never equips or duplicates it.
      const heldClub = state.town.clubLocation === 'HAND';
      const selfGain = (heldClub ? 16 : 27 * masteryFactor(state, id)) * physical;
      return { label: heldClub
        ? '持握原短棍打击：只采用已经在手的普通短棍贡献，不叠加计算、身体或武器天赋预算，不保证命中'
        : '计算与精确身体打击：以眼前距离和真实身体控制完成本次攻击（G），不是金属身体，不保证命中；伤害仍由共同伤势盘结算',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 18.9 * masteryFactor(state, 'wheel.s8.calculation-control') * physical;
      return { label: '精确身体侧击：采用同一计算与控制掌握度（G），独立占用本次行动，不追加攻击、不凭空制造或取得武器',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'wheel.s9.danger-intuition':
      return { ...noEffect('危险直觉与眼前避让：继承原危险直觉，只减少当前真实可见普通对手的压力，不预知下一次随机结果、不取消敌方行动'),
        enemyReduction: 24.3 * masteryFactor(state, id) * physical };
    case 'POSITION':
      return { ...noEffect('普通走位牵制：只沿眼前通道调整距离（G），不叠加计算掌握，不强制取消对手行动'),
        enemyReduction: 6 * physical };
    case 'wheel.s8.divination-guard':
      return noEffect('占卜与反占卜：本场普通对手没有正在使用的有来源占卜效果，本次贡献0、消耗0；不生成预知、不宣称占卜免疫，不读取未来随机结果、不重掷或回退');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -7.5 : 7.5;
      return { ...noEffect(`时机或失衡：本次意外贡献${selfGain > 0 ? '+' : '−'}7.5（G），不构成致伤攻击，不是幸运操纵或重掷`), selfGain };
    }
  }
}
