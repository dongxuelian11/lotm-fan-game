import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { PrisonerCombatSource } from '../prisoner/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/**
 * Madman S8: U30, A0.9/E0.9. Wheels, budgets and the single-action burst are G.
 * Book 2, chapter 118 supports voluntarily sacrificing present reason to
 * strengthen abilities and resist SOME mental interference, never immunity.
 * No werewolf transformation/recovery or zombie armor enters this S8 resolver.
 */
export const MADMAN_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 10 }),
  Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 25 }),
  Object.freeze({ id: '5', label: '5次', weight: 20 }),
]);

type MadmanMasteryId = 'chained.s9.prisoner-body' | 'chained.s9.keen-perception'
  | 'chained.s8.reason-sacrifice' | 'chained.s8.mental-resistance';
export type MadmanMoveId = 'chained.s9.prisoner-body' | 'BODY_FOLLOWUP'
  | 'chained.s9.keen-perception' | 'POSITION' | 'chained.s8.mental-resistance' | 'ACCIDENT';
export type MadmanBurstPolicy = 'HOLD' | 'BURST_FIRST';
/** Owned by one actual round; no ongoing release state or automatic next-round choice. */
export interface MadmanRoundPolicy {
  policy: MadmanBurstPolicy; triggered: boolean; mentalCost: number; spiritualCost: number;
}
const ABILITIES: readonly {
  id: MadmanMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'chained.s9.prisoner-body', label: '强化身体打击', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '身体侧击', weight: 20, stance: 'ATTACK' },
  { id: 'chained.s9.keen-perception', label: '敏锐感知与眼前避让', weight: 20, stance: 'DEFEND' },
  { id: 'POSITION', label: '普通走位牵制', weight: 10, stance: 'CONTROL' },
  { id: 'chained.s8.mental-resistance', label: '核实精神干扰来源', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '时机或失衡', weight: 5, stance: null },
];

export function isMadman(state: SliceState): boolean {
  return state.progression?.pathwayId === 'chained' && state.progression.sequence === 8;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function madmanAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'chained.s9.prisoner-body' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawMadmanAbility(random: ActionRandomStream, stance: SliceStance | null): MadmanMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('疯子能力盘权重无效');
}
export function madmanActionCount(roll: number): number {
  return roll <= 10 ? 1 : roll <= 30 ? 2 : roll <= 55 ? 3 : roll <= 80 ? 4 : 5;
}

export interface MadmanCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): MadmanCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
/** Same real first-case body, ordinary opponent and passage as the inherited S9 actions. */
export type MadmanCombatSource = PrisonerCombatSource;
export function currentMadmanCombatSource(state: SliceState): MadmanCombatSource | null {
  if (!isMadman(state) || state.status !== 'ACTIVE' || state.health <= 0 || !state.combat ||
      state.combat.enemyHealth <= 0 || state.combat.enemyStatus !== 'RESISTING' ||
      state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' };
}
function validCombatSource(state: SliceState, source: MadmanCombatSource | null): boolean {
  const current = currentMadmanCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week &&
    source.encounterId === current.encounterId && source.round === current.round &&
    source.target === current.target && source.body === current.body &&
    source.space === current.space && source.exit === current.exit;
}
function masteryFactor(state: SliceState, id: MadmanMasteryId): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** Consume exactly once, only after a source-checked H/J has positive physical contribution. */
export function resolveReasonSacrifice(
  state: SliceState, contribution: number, roundPolicy: MadmanRoundPolicy,
): { selfGain: number; label: string } {
  if (roundPolicy.policy !== 'BURST_FIRST') {
    return { selfGain: contribution, label: '；按本轮选择保留理智，不支付爆发成本' };
  }
  if (roundPolicy.triggered) {
    return { selfGain: contribution, label: '；本轮已短时爆发一次，本次按普通贡献结算' };
  }
  if (!Number.isFinite(contribution) || contribution <= 0) {
    return { selfGain: contribution, label: '；本次没有有效物理贡献，未支付爆发成本' };
  }
  if (!Number.isFinite(state.mind) || !Number.isFinite(state.spirituality) || state.mind < 10 || state.spirituality < 2) {
    return { selfGain: contribution, label: '；精神不足10或灵性不足2，保留当前资源，本次按普通贡献结算' };
  }
  state.mind -= 10;
  state.spirituality -= 2;
  roundPolicy.triggered = true;
  roundPolicy.mentalCost = 10;
  roundPolicy.spiritualCost = 2;
  const multiplier = 1 + 0.25 * masteryFactor(state, 'chained.s8.reason-sacrifice');
  return { selfGain: contribution * multiplier,
    label: `；主动牺牲当前理智：仅本次贡献×${multiplier}（G），精神−10、灵性−2；余精神${state.mind}、灵性${state.spirituality}，已用成本不自动返还` };
}

/** Physical H/J may consume the explicit one-round choice; every other slot remains unchanged. */
export function resolveMadmanCombatAbility(
  state: SliceState, id: MadmanMoveId, physicalStateFactor: number, random: ActionRandomStream,
  roundPolicy: MadmanRoundPolicy = { policy: 'HOLD', triggered: false, mentalCost: 0, spiritualCost: 0 },
  source: MadmanCombatSource | null = currentMadmanCombatSource(state),
): MadmanCombatEffect {
  if (!validCombatSource(state, source)) {
    return noEffect('疯子行动：缺少本场仍可触及的普通对手与真实现场，贡献0、不支付爆发成本');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'chained.s9.prisoner-body':
    case 'BODY_FOLLOWUP': {
      // Borrowed practice spacers and bagged tools never become held combat gear.
      const primary = id === 'chained.s9.prisoner-body', heldClub = primary && state.town.clubLocation === 'HAND';
      const ordinary = (heldClub ? 16 : (primary ? 27 : 18.9) * masteryFactor(state, 'chained.s9.prisoner-body')) * physical;
      const burst = resolveReasonSacrifice(state, ordinary, roundPolicy);
      const label = heldClub
        ? '持握原短棍打击：只用普通短棍贡献，不叠加身体预算或体魄掌握加成'
        : primary ? '强化身体打击：沿用囚犯体魄掌握度的普通物理主攻'
        : '身体侧击：沿用囚犯体魄掌握度，独立占用本次行动，不追加攻击';
      return { label: label + burst.label, selfGain: burst.selfGain, enemyReduction: 0, threatens: burst.selfGain > 0 };
    }
    case 'chained.s9.keen-perception':
      return { ...noEffect('敏锐感知与眼前避让：只对当前普通对手作身体避让，不预知动作或取消反击'),
        enemyReduction: 17.1 * masteryFactor(state, id) * physical };
    case 'POSITION':
      return { ...noEffect('普通走位牵制：沿眼前通道调整距离，不强制控制或取消对手行动'),
        enemyReduction: 6 * physical };
    case 'chained.s8.mental-resistance':
      return noEffect('精神抗扰核实：疯子可抵御部分精神干扰，不是免疫；眼前普通携铃者没有精神攻击，本次贡献0、消耗0');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -7.5 : 7.5;
      return { ...noEffect(`时机或失衡：本次意外贡献${selfGain > 0 ? '+' : '−'}7.5（G），不构成致伤攻击、不支付爆发成本`), selfGain };
    }
  }
}
