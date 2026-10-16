import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Death V2 S8 C-profile. Contribution budgets are game balance (G). */
export const GRAVEDIGGER_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 30 }),
  Object.freeze({ id: '2', label: '2次', weight: 30 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 15 }),
]);

/** FIRST_CASE has ordinary actions only; it supplies no death-eye target. */
export type GravediggerMoveId = 'BODY_STRIKE' | 'BODY_FOLLOWUP' | 'COVER'
  | 'SITE_PRESSURE' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly {
  id: GravediggerMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'BODY_STRIKE', label: '实际身体/持握武器攻击', weight: 20, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '实际身体次击', weight: 15, stance: 'ATTACK' },
  { id: 'COVER', label: '实际掩护与闪避', weight: 20, stance: 'DEFEND' },
  { id: 'SITE_PRESSURE', label: '普通牵制，死亡之眼无适用对象', weight: 30, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '现场判断与阵位调整', weight: 8, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差', weight: 7, stance: null },
];

export function isGravedigger(state: SliceState): boolean {
  return state.progression?.pathwayId === 'death' && state.progression.sequence === 8;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function gravediggerAbilityWheel(stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id, label: ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawGravediggerAbility(random: ActionRandomStream, stance: SliceStance | null): GravediggerMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('掘墓人能力盘权重无效');
}
export function gravediggerActionCount(roll: number): number {
  return roll <= 30 ? 1 : roll <= 60 ? 2 : roll <= 85 ? 3 : 4;
}

export interface GravediggerCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): GravediggerCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/**
 * This source is the current ordinary human on the existing dry passage.
 * No authored undead/spirit-world target means no death-eye K sub-entry or
 * weakness mark. No cold/decay threat means no resistance B sub-entry. The
 * eligible ordinary actions retain their category budgets, not extra effects.
 * Earlier life scenes and their spirits are never imported into this duel.
 */
export interface GravediggerCombatSource {
  runId: string; revision: number; week: number; encounterId: 'FIRST_CASE'; round: number;
  target: 'CURRENT_VISIBLE_ORDINARY_CARRIER'; nature: 'ORDINARY_HUMAN';
  body: 'CURRENT_REACHABLE_BODY'; space: 'DRY_GROUND_PASSAGE';
  coldThreat: 'NONE'; decayThreat: 'NONE'; undead: 'NONE'; spiritWorldTarget: 'NONE';
}
export function currentGravediggerCombatSource(state: SliceState): GravediggerCombatSource | null {
  if (!isGravedigger(state) || state.status !== 'ACTIVE' || state.health <= 0 || !state.combat ||
      state.combat.enemyHealth <= 0 || state.combat.enemyStatus !== 'RESISTING' ||
      state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE',
    coldThreat: 'NONE', decayThreat: 'NONE', undead: 'NONE', spiritWorldTarget: 'NONE' };
}
function validCombatSource(state: SliceState, source: GravediggerCombatSource | null): boolean {
  const current = currentGravediggerCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week &&
    source.encounterId === current.encounterId && source.round === current.round &&
    source.target === current.target && source.nature === current.nature &&
    source.body === current.body && source.space === current.space &&
    source.coldThreat === current.coldThreat && source.decayThreat === current.decayThreat &&
    source.undead === current.undead && source.spiritWorldTarget === current.spiritWorldTarget;
}
function bodyMasteryFactor(state: SliceState): number {
  // Inherited physique governs actual bodily actions. Death-eye and contact
  // mastery cannot strengthen an ordinary human attack or manufacture a target.
  const mastery = state.progression.mastery['death.s9.corpse-physique'] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** One original action slot, with no summons, marks, ghost damage or immunity. */
export function resolveGravediggerCombatAbility(
  state: SliceState, id: GravediggerMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: GravediggerCombatSource | null = currentGravediggerCombatSource(state),
): GravediggerCombatEffect {
  if (!validCombatSource(state, source)) {
    return noEffect('掘墓人行动：缺少本场仍可触及的普通对手与真实现场，本次贡献0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  const factor = bodyMasteryFactor(state);
  switch (id) {
    case 'BODY_STRIKE': {
      const armed = state.town.clubLocation === 'HAND';
      const selfGain = (armed ? 16 : 11.7 * factor) * physical;
      return { label: armed
        ? '持握原短棍打击：采用普通短棍16贡献（G），替换而不叠加主攻预算；由真实身体实施'
        : '实际身体攻击：以本人近身动作应对普通携铃者；没有死亡之眼弱点加成或死亡法术',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 6.3 * factor * physical;
      return { label: '实际身体次击：只结算本次身体动作的次攻预算；灵体接触不转化为幽灵伤害，也不另赠攻击',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'COVER':
      return { ...noEffect('实际掩护与闪避：只以现场普通自保减势；没有寒冷或腐烂来源可供尸体抗性匹配，普通短棍仍可伤人'),
        enemyReduction: 15.6 * factor };
    case 'SITE_PRESSURE':
      return { ...noEffect('普通牵制，死亡之眼无适用对象：只结算眼前普通携铃者的现场走位减势；不标记人体弱点、不即死、不召灵或控制亡灵'),
        enemyReduction: 8.4 * factor };
    case 'OBSERVE':
      return noEffect('现场判断与阵位调整：本次贡献0；没有在场灵体可供接触，不召来灵体、不读取死者证言或揭示案件真相');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -7.5 : 7.5;
      return { ...noEffect(`动作偏差：本次意外贡献${selfGain > 0 ? '+' : '−'}7.5（G），不构成致伤攻击`), selfGain };
    }
  }
}
