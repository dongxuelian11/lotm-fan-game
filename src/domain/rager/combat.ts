import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { currentSailorScalesSource, sameSailorCombatSource, type SailorCombatSource } from '../sailor/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Confirmed Tyrant V2 S8 M-profile; ordinary contributions remain unrounded. */
export const RAGER_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 30 }),
  Object.freeze({ id: '2', label: '2次', weight: 30 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 15 }),
]);
export type RagerMoveId = 'tyrant.s8.fury' | 'TYRANT_COMBO' | 'tyrant.s8.impact-resilience'
  | 'INTIMIDATE' | 'OBSERVE' | 'ACCIDENT';
export type RagerRagePolicy = 'HOLD' | 'RELEASE_FIRST';
/** Local to one actual round, never persisted or carried to another command. */
export interface RagerRoundPolicy { policy: RagerRagePolicy; released: boolean }
const ABILITIES: readonly {
  id: RagerMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'tyrant.s8.fury', label: '蓄势怒击', weight: 38, stance: 'ATTACK' },
  { id: 'TYRANT_COMBO', label: '暴怒连击', weight: 20, stance: 'ATTACK' },
  { id: 'tyrant.s8.impact-resilience', label: '抗冲击与幻鳞自保', weight: 8, stance: 'DEFEND' },
  { id: 'INTIMIDATE', label: '近身威吓', weight: 5, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '稳住怒势', weight: 4, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '暴怒偏差', weight: 25, stance: null },
];
export function isRager(state: SliceState): boolean {
  return state.progression?.pathwayId === 'tyrant' && state.progression.sequence === 8;
}
/** Inherited mechanism only; S7/S6 never enter the S8 ability resolver. */
export function hasRagerWrath(state: SliceState): boolean {
  return state.progression?.pathwayId === 'tyrant' && [8, 7, 6].includes(state.progression.sequence ?? -1);
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function ragerAbilityWheel(stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id, label: ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawRagerAbility(random: ActionRandomStream, stance: SliceStance | null): RagerMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('暴怒之民能力盘权重无效');
}
export function ragerActionCount(roll: number): number {
  return roll <= 30 ? 1 : roll <= 60 ? 2 : roll <= 85 ? 3 : 4;
}
export interface RagerCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): RagerCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
function hasLiveCombat(state: SliceState): boolean {
  return hasRagerWrath(state) && state.status === 'ACTIVE' && state.health > 0 &&
    state.combat !== null && state.combat.enemyHealth > 0 && state.combat.enemyStatus === 'RESISTING';
}
export type RagerCombatSource = SailorCombatSource;
/** Only a current authored hostile source can generate or consume wrath. */
export function currentRagerCombatSource(state: SliceState): RagerCombatSource | null {
  return hasRagerWrath(state) ? currentSailorScalesSource(state) : null;
}
function validCombatSource(state: SliceState, source: RagerCombatSource | null): boolean {
  return sameSailorCombatSource(currentRagerCombatSource(state), source);
}
export function ragerWrathCharge(state: SliceState): number {
  const charge = state.combat?.wrathCharge ?? 0;
  return hasRagerWrath(state) && Number.isSafeInteger(charge) ? Math.max(0, Math.min(3, charge)) : 0;
}
function masteryFactor(state: SliceState, id: 'tyrant.s8.fury' | 'tyrant.s8.impact-resilience'): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

function isPlayerPhysicalAttack(state: SliceState, move: string): boolean {
  return isRager(state) && (move === 'tyrant.s8.fury' || move === 'TYRANT_COMBO') ||
    state.progression.pathwayId === 'tyrant' && [7, 6].includes(state.progression.sequence ?? -1) &&
    state.town.clubLocation === 'HAND' && move === 'NAVIGATOR_CLUB_STRIKE';
}

/** One call per actual move, after its positive physical contribution is known. */
export function resolveRagerPhysicalExchange(
  state: SliceState, actor: 'PLAYER' | 'ENEMY', move: string, contribution: number,
  source: RagerCombatSource | null = currentRagerCombatSource(state),
): string | null {
  if (!hasLiveCombat(state) || !validCombatSource(state, source) ||
      !Number.isFinite(contribution) || contribution <= 0 ||
      !(actor === 'ENEMY' && move === 'STRIKE' || actor === 'PLAYER' &&
        isPlayerPhysicalAttack(state, move))) return null;
  const before = ragerWrathCharge(state), after = Math.min(3, before + 1);
  state.combat!.wrathCharge = after;
  return `${actor === 'PLAYER' ? '自身有效物理攻击' : '受到敌方有效短棍直击'}：怒势${before}→${after}/3${before === 3 ? '（已满）' : '（+1）'}`;
}

/** Shared S8 mechanism; the caller must identify an actual eligible physical attack. */
export function resolveRagerPhysicalAttack(
  state: SliceState, move: string, contribution: number, roundPolicy: RagerRoundPolicy,
  source: RagerCombatSource | null = currentRagerCombatSource(state),
): { selfGain: number; label: string } {
  let selfGain = contribution, label = '';
  if (!hasLiveCombat(state) || !isPlayerPhysicalAttack(state, move)) return { selfGain, label };
  const before = ragerWrathCharge(state), currentSource = validCombatSource(state, source);
  // Spend existing layers BEFORE this hit contributes its own one layer.
  if (currentSource && Number.isFinite(selfGain) && selfGain > 0 && before >= 2 &&
      roundPolicy.policy === 'RELEASE_FIRST' && !roundPolicy.released) {
    const multiplier = before === 3 ? 1.4 : 1.25;
    state.combat!.wrathCharge = 0;
    roundPolicy.released = true;
    selfGain *= multiplier;
    label += `；按本轮选择释放${before}层怒击，贡献×${multiplier.toFixed(2)}，原怒势清空`;
  } else if (currentSource) {
    label += `；${roundPolicy.policy === 'HOLD' ? '按本轮选择保留怒势'
      : roundPolicy.released ? '本轮怒击已释放一次，继续保留' : before < 2 ? '当前不足2层，不消费' : '本次没有有效物理贡献，不消费'}`;
  } else label += '；缺少当前敌对来源，不建立或消费怒势';
  const exchange = resolveRagerPhysicalExchange(state, 'PLAYER', move, selfGain, source);
  if (exchange) label += `；${exchange}`;
  else label += `；剩余怒势${ragerWrathCharge(state)}/3`;
  return { selfGain, label };
}

/** G-mapping of the accident subwheel: 50 GOOD / (50 + current wrath risk) BAD. */
export function ragerAccidentWheel(state: SliceState): SliceWheelEntry[] {
  const extra = [0, 3, 6, 10][ragerWrathCharge(state)]!;
  return [
    { id: 'GOOD', label: '偶然有利', weight: 50 / (100 + extra) * 100 },
    { id: 'BAD', label: '暴怒偏差', weight: (50 + extra) / (100 + extra) * 100 },
  ];
}

/** No spirituality, extra action, automatic madness, self-harm, or free mastery. */
export function resolveRagerCombatAbility(
  state: SliceState, id: RagerMoveId, physicalStateFactor: number, random: ActionRandomStream,
  roundPolicy: RagerRoundPolicy = { policy: 'HOLD', released: false },
  source: RagerCombatSource | null = currentRagerCombatSource(state),
): RagerCombatEffect {
  if (!isRager(state) || !hasLiveCombat(state)) return noEffect('暴怒之民能力：当前没有可结算的对应战斗行动');
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'tyrant.s8.fury':
    case 'TYRANT_COMBO': {
      const primary = id === 'tyrant.s8.fury', armed = primary && state.town.clubLocation === 'HAND';
      let selfGain = (armed ? 16 : (primary ? 23.4 : 12.6) * masteryFactor(state, 'tyrant.s8.fury')) * physical;
      let label = armed ? '持握原短棍打击：采用普通短棍贡献，不叠加体术预算'
        : primary ? '蓄势怒击：强化体魄的普通物理主攻' : '暴怒连击：一次普通物理次攻，不增加行动';
      const wrath = resolveRagerPhysicalAttack(state, id, selfGain, roundPolicy, source);
      selfGain = wrath.selfGain;
      label += wrath.label;
      return { label, selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'tyrant.s8.impact-resilience': {
      const ordinaryOpponent = validCombatSource(state, source);
      if (ordinaryOpponent) state.combat!.sailorScalesReady = true;
      return { ...noEffect(ordinaryOpponent
        ? '抗冲击与幻鳞自保：保留身体防护；继承一次幻鳞，下一原普通短棍冲击贡献×0.75，不能防弹；不加怒势'
        : '抗冲击自保：保留身体防护；缺少当前普通敌对来源，未建立幻鳞；不加怒势'),
        enemyReduction: 5.85 * masteryFactor(state, id) };
    }
    case 'INTIMIDATE':
      return validCombatSource(state, source)
        ? { ...noEffect('近身威吓：只牵制眼前携铃者的普通动作，不增加怒势'),
          enemyReduction: 3.15 * masteryFactor(state, 'tyrant.s8.fury') }
        : { ...noEffect('近身威吓：缺少当前可见对手来源，改用普通格挡护身；不增加怒势'), enemyReduction: 10 };
    case 'OBSERVE':
      return noEffect('稳住怒势：本次贡献0，保持原有怒势，不凭空积累层数');
    case 'ACCIDENT': {
      const charge = ragerWrathCharge(state), extra = [0, 3, 6, 10][charge]!;
      const bad = random.nextInt(1, 100 + extra) > 50;
      const selfGain = bad ? -7.5 : 7.5;
      return { ...noEffect(`暴怒偏差：怒势${charge}/3，意外候选有利50/不利${50 + extra}归一化；本次贡献${bad ? '−' : '+'}7.5（G），不构成致伤攻击，不加怒势`), selfGain };
    }
  }
}
