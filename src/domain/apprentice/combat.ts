import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Door V1 S9 profile: U20, A0.5/E0.6; balance budgets, not new abilities. */
export const APPRENTICE_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 15 }),
  Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 25 }),
  Object.freeze({ id: '5', label: '5次', weight: 15 }),
]);

/** Current FIRST_CASE fallbacks are ordinary actions, not unlocked spells. */
export type ApprenticeMoveId = 'BODY_STRIKE' | 'BODY_FOLLOWUP' | 'COVER'
  | 'SITE_PRESSURE' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly {
  id: ApprenticeMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'BODY_STRIKE', label: '实际身体/持握武器攻击', weight: 24, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '普通次击（无穿门路径）', weight: 14, stance: 'ATTACK' },
  { id: 'COVER', label: '普通闪避（本场不能开门）', weight: 12, stance: 'DEFEND' },
  { id: 'SITE_PRESSURE', label: '现场普通牵制（无穿门路径）', weight: 8, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '观察原普通退路', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差', weight: 32, stance: null },
];

export function isApprentice(state: SliceState): boolean {
  return state.progression?.pathwayId === 'door' && state.progression.sequence === 9;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function apprenticeAbilityWheel(stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id, label: ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawApprenticeAbility(random: ActionRandomStream, stance: SliceStance | null): ApprenticeMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('学徒能力盘权重无效');
}
export function apprenticeActionCount(roll: number): number {
  return roll <= 15 ? 1 : roll <= 35 ? 2 : roll <= 60 ? 3 : roll <= 85 ? 4 : 5;
}

export interface ApprenticeCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): ApprenticeCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/**
 * The existing FIRST_CASE supplies an ordinary opponent and ground passage.
 * It supplies no traversable partition or door path. Prior daily passages do
 * not become combat walls; no door protection can be established here.
 * S9 passes alone through a real obstacle, never by long-distance teleport.
 */
export interface ApprenticeCombatSource {
  runId: string; revision: number; week: number; encounterId: 'FIRST_CASE'; round: number;
  target: 'CURRENT_VISIBLE_ORDINARY_CARRIER'; nature: 'ORDINARY_HUMAN';
  body: 'CURRENT_REACHABLE_BODY'; space: 'DRY_GROUND_PASSAGE';
  doorPath: 'NONE'; exit: 'EXISTING_ORDINARY_GROUND_EXIT'; companion: 'NONE';
}
export function currentApprenticeCombatSource(state: SliceState): ApprenticeCombatSource | null {
  if (!isApprentice(state) || state.status !== 'ACTIVE' || state.health <= 0 || !state.combat ||
      state.combat.enemyHealth <= 0 || state.combat.enemyStatus !== 'RESISTING' ||
      state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE',
    doorPath: 'NONE', exit: 'EXISTING_ORDINARY_GROUND_EXIT', companion: 'NONE' };
}
function validCombatSource(state: SliceState, source: ApprenticeCombatSource | null): boolean {
  const current = currentApprenticeCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week &&
    source.encounterId === current.encounterId && source.round === current.round &&
    source.target === current.target && source.nature === current.nature &&
    source.body === current.body && source.space === current.space &&
    source.doorPath === current.doorPath && source.exit === current.exit && source.companion === current.companion;
}
function masteryFactor(state: SliceState): number {
  // V1's profile curve reads the one actual S9 mastery record. It creates no
  // ordinary proficiency or new spell and cannot make an absent path real.
  const mastery = state.progression.mastery['door.s9.door-opening'] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** One real action slot; no cancellation, extra action, actor or persistent state. */
export function resolveApprenticeCombatAbility(
  state: SliceState, id: ApprenticeMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: ApprenticeCombatSource | null = currentApprenticeCombatSource(state),
): ApprenticeCombatEffect {
  if (!validCombatSource(state, source)) {
    return noEffect('学徒行动：缺少本场仍可触及的普通对手与真实现场，本次贡献0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  const factor = masteryFactor(state);
  switch (id) {
    case 'BODY_STRIKE': {
      const armed = state.town.clubLocation === 'HAND';
      const selfGain = (armed ? 16 : 6.5 * factor) * physical;
      return { label: armed
        ? '持握原短棍打击：采用普通短棍16贡献（G），替换而不叠加主攻预算；由真实身体实施'
        : '实际身体攻击：以本人近身动作应对普通携铃者；没有空间攻击或额外武器',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 3.5 * factor * physical;
      return { label: '普通次击：本场没有真实穿门路径，只结算实际身体的次攻预算，不另赠穿门或武器攻击',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'COVER':
      return { ...noEffect('普通闪避：本场没有可穿过的原门或薄隔断，开门不可用；只结算普通自保减势，后续短棍攻击不被无效化'),
        enemyReduction: 7.8 * factor };
    case 'SITE_PRESSURE':
      return { ...noEffect('现场普通牵制：只以实际动作限制眼前携铃者，结算普通控制槽减势；没有穿门、戏法或记录魔法'),
        enemyReduction: 4.2 * factor };
    case 'OBSERVE':
      return noEffect('观察原普通退路：本次贡献0；不生成门、远程传送出口、同行者或额外行动，撤退仍走原普通出口');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -5 : 5;
      return { ...noEffect(`动作偏差：本次意外贡献${selfGain > 0 ? '+' : '−'}5（G），不构成致伤攻击或空间效果`), selfGain };
    }
  }
}
