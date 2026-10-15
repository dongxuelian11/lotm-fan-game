import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveReasonSacrifice, type MadmanRoundPolicy } from '../madman/combat.js';
import type { PrisonerCombatSource } from '../prisoner/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/**
 * Werewolf S7: U45, A1.2/E1.2. Numeric budgets, wheels and recovery are G.
 * The body, regeneration and toxic claws have a source; no named dark spell,
 * S6 armor, immortality or undead control is supplied by this combat profile.
 * Round pressure cannot prove a penetrating claw hit, so it never applies poison.
 */
export const WEREWOLF_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 10 }),
  Object.freeze({ id: '2', label: '2次', weight: 15 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 30 }),
  Object.freeze({ id: '5', label: '5次', weight: 20 }),
]);

type WerewolfMasteryId = 'chained.s7.werewolf-body' | 'chained.s7.regeneration' | 'chained.s9.keen-perception';
export type WerewolfMoveId = 'chained.s7.werewolf-body' | 'BODY_FOLLOWUP'
  | 'chained.s9.keen-perception' | 'POSITION' | 'chained.s7.regeneration' | 'ACCIDENT';
/** One real round owns this flag; it is never stored on SliceState or combat. */
export interface WerewolfRoundContext { regenUsed: boolean }
const ABILITIES: readonly {
  id: WerewolfMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'chained.s7.werewolf-body', label: '狼人身体与毒爪威胁', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '狼人身体侧击', weight: 20, stance: 'ATTACK' },
  { id: 'chained.s9.keen-perception', label: '敏锐感知与眼前避让', weight: 20, stance: 'DEFEND' },
  { id: 'POSITION', label: '普通走位牵制', weight: 10, stance: 'CONTROL' },
  { id: 'chained.s7.regeneration', label: '有限自愈', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '时机或失衡', weight: 5, stance: null },
];

export function isWerewolf(state: SliceState): boolean {
  return state.progression?.pathwayId === 'chained' && state.progression.sequence === 7;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function werewolfAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'chained.s7.werewolf-body' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawWerewolfAbility(random: ActionRandomStream, stance: SliceStance | null): WerewolfMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('狼人能力盘权重无效');
}
export function werewolfActionCount(roll: number): number {
  return roll <= 10 ? 1 : roll <= 25 ? 2 : roll <= 50 ? 3 : roll <= 80 ? 4 : 5;
}

export interface WerewolfCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): WerewolfCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
/** A distinct S7 check prevents the inherited S8 resolver from selecting the wrong profile. */
export type WerewolfCombatSource = PrisonerCombatSource;
export function currentWerewolfCombatSource(state: SliceState): WerewolfCombatSource | null {
  if (!isWerewolf(state) || state.status !== 'ACTIVE' || !Number.isFinite(state.health) || state.health <= 0 || !state.combat ||
      state.combat.enemyHealth <= 0 || state.combat.enemyStatus !== 'RESISTING' ||
      state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' };
}
function validCombatSource(state: SliceState, source: WerewolfCombatSource | null): boolean {
  const current = currentWerewolfCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week &&
    source.encounterId === current.encounterId && source.round === current.round &&
    source.target === current.target && source.body === current.body &&
    source.space === current.space && source.exit === current.exit;
}
function masteryFactor(state: SliceState, id: WerewolfMasteryId): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

export function resolveWerewolfCombatAbility(
  state: SliceState, id: WerewolfMoveId, physicalStateFactor: number, random: ActionRandomStream,
  roundContext: WerewolfRoundContext = { regenUsed: false },
  roundPolicy: MadmanRoundPolicy = { policy: 'HOLD', triggered: false, mentalCost: 0, spiritualCost: 0 },
  source: WerewolfCombatSource | null = currentWerewolfCombatSource(state),
): WerewolfCombatEffect {
  if (!validCombatSource(state, source)) {
    return noEffect('狼人行动：缺少本场仍可触及的普通对手与真实现场，贡献0、不支付自愈或爆发成本');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'chained.s7.werewolf-body':
    case 'BODY_FOLLOWUP': {
      // Only the original club actually in HAND replaces H; borrowed spacers are not weapons.
      const primary = id === 'chained.s7.werewolf-body', heldClub = primary && state.town.clubLocation === 'HAND';
      const ordinary = (heldClub ? 16 : (primary ? 54 : 37.8) * masteryFactor(state, 'chained.s7.werewolf-body')) * physical;
      const burst = resolveReasonSacrifice(state, ordinary, roundPolicy);
      const label = heldClub
        ? '持握原短棍打击：只用普通短棍贡献，不叠加狼人身体或毒爪预算'
        : primary ? '狼人身体与毒爪威胁：本次仅计身体物理贡献；实际伤害由共同伤势盘结算，未证实穿透命中，不自动结算毒素、麻痹或转化'
        : '狼人身体侧击：沿用狼人身体掌握度，独立占用本次行动；实际伤害由共同伤势盘结算，不追加攻击';
      return { label: label + burst.label, selfGain: burst.selfGain, enemyReduction: 0, threatens: burst.selfGain > 0 };
    }
    case 'chained.s9.keen-perception':
      return { ...noEffect('敏锐感知与眼前避让：沿用囚犯知觉，只对当前普通对手作身体避让，不预知动作或取消反击'),
        enemyReduction: 36 * masteryFactor(state, id) * physical };
    case 'POSITION':
      return { ...noEffect('普通走位牵制：沿眼前通道调整距离，不强制控制或取消对手行动'),
        enemyReduction: 6 * physical };
    case 'chained.s7.regeneration': {
      if (roundContext.regenUsed) return noEffect('有限自愈：本轮已经实际恢复一次，本次不重复恢复、不再支付灵性');
      if (state.health >= 100) return noEffect('有限自愈：当前健康已满，本次恢复0、消耗0，原有伤势记录与死亡风险不变');
      if (!Number.isFinite(state.spirituality) || state.spirituality < 3) {
        return noEffect('有限自愈：灵性不足3，本次恢复0、消耗0，不代扣健康或精神');
      }
      const recovered = Math.min(100 - state.health, Math.floor(10 * masteryFactor(state, id)));
      state.health += recovered;
      state.spirituality -= 3;
      roundContext.regenUsed = true;
      return noEffect(`有限自愈：消耗3灵性，实际恢复${recovered}健康（G），本轮最多一次；原有伤势记录与累计死亡风险保留，不能复活或保证存活`);
    }
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -11.25 : 11.25;
      return { ...noEffect(`时机或失衡：本次意外贡献${selfGain > 0 ? '+' : '−'}11.25（G），不构成致伤攻击、不支付爆发成本`), selfGain };
    }
  }
}
