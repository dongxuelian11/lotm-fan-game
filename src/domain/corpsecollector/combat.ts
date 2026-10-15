import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Death V2 S9 profile. Contribution budgets are game balance (G). */
export const CORPSECOLLECTOR_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 35 }),
  Object.freeze({ id: '2', label: '2次', weight: 30 }),
  Object.freeze({ id: '3', label: '3次', weight: 20 }),
  Object.freeze({ id: '4', label: '4次', weight: 15 }),
]);

/** Ordinary actions, not additional unlocked supernatural abilities. */
export type CorpsecollectorMoveId = 'BODY_STRIKE' | 'BODY_FOLLOWUP' | 'COVER'
  | 'SITE_PRESSURE' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly {
  id: CorpsecollectorMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'BODY_STRIKE', label: '实际身体/持握武器攻击', weight: 20, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '实际身体次击', weight: 15, stance: 'ATTACK' },
  { id: 'COVER', label: '实际掩护与闪避', weight: 20, stance: 'DEFEND' },
  { id: 'SITE_PRESSURE', label: '现场普通牵制', weight: 30, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '调整阵位', weight: 8, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差', weight: 7, stance: null },
];

export function isCorpsecollector(state: SliceState): boolean {
  return state.progression?.pathwayId === 'death' && state.progression.sequence === 9;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function corpsecollectorAbilityWheel(stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id, label: ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawCorpsecollectorAbility(random: ActionRandomStream, stance: SliceStance | null): CorpsecollectorMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('收尸人能力盘权重无效');
}
export function corpsecollectorActionCount(roll: number): number {
  return roll <= 35 ? 1 : roll <= 65 ? 2 : roll <= 85 ? 3 : 4;
}

export interface CorpsecollectorCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): CorpsecollectorCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/**
 * FIRST_CASE supplies only a visible ordinary human on the current dry passage.
 * Neither past mortuary work nor spiritual sight authors a new threat/actor.
 * With no cold or decay source, corpse resistance has no eligible B sub-entry;
 * all of the B category belongs to the actual ordinary cover/evasion action.
 */
export interface CorpsecollectorCombatSource {
  runId: string; revision: number; week: number; encounterId: 'FIRST_CASE'; round: number;
  target: 'CURRENT_VISIBLE_ORDINARY_CARRIER'; nature: 'ORDINARY_HUMAN';
  body: 'CURRENT_REACHABLE_BODY'; space: 'DRY_GROUND_PASSAGE';
  coldThreat: 'NONE'; decayThreat: 'NONE'; undead: 'NONE';
}
export function currentCorpsecollectorCombatSource(state: SliceState): CorpsecollectorCombatSource | null {
  if (!isCorpsecollector(state) || state.status !== 'ACTIVE' || state.health <= 0 || !state.combat ||
      state.combat.enemyHealth <= 0 || state.combat.enemyStatus !== 'RESISTING' ||
      state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE',
    coldThreat: 'NONE', decayThreat: 'NONE', undead: 'NONE' };
}
function validCombatSource(state: SliceState, source: CorpsecollectorCombatSource | null): boolean {
  const current = currentCorpsecollectorCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week &&
    source.encounterId === current.encounterId && source.round === current.round &&
    source.target === current.target && source.nature === current.nature &&
    source.body === current.body && source.space === current.space &&
    source.coldThreat === current.coldThreat && source.decayThreat === current.decayThreat &&
    source.undead === current.undead;
}
function masteryFactor(state: SliceState): number {
  // Read the acquired physique's existing mastery, never invent proficiency for
  // ordinary strikes or turn spiritual-sight / undead knowledge into damage.
  const mastery = state.progression.mastery['death.s9.corpse-physique'] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** One original action slot; no immunity, extra actor, resource or persistent effect. */
export function resolveCorpsecollectorCombatAbility(
  state: SliceState, id: CorpsecollectorMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: CorpsecollectorCombatSource | null = currentCorpsecollectorCombatSource(state),
): CorpsecollectorCombatEffect {
  if (!validCombatSource(state, source)) {
    return noEffect('收尸人行动：缺少本场仍可触及的普通对手与真实现场，本次贡献0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  const factor = masteryFactor(state);
  switch (id) {
    case 'BODY_STRIKE': {
      const armed = state.town.clubLocation === 'HAND';
      const selfGain = (armed ? 16 : 6.5 * factor) * physical;
      return { label: armed
        ? '持握原短棍打击：采用普通短棍16贡献（G），替换而不叠加主攻预算；由真实身体实施'
        : '实际身体攻击：以本人近身动作应对普通携铃者；尸体般的生理特征不使攻击变为死亡法术',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 3.5 * factor * physical;
      return { label: '实际身体次击：只结算本次身体动作的次攻预算，不另赠武器攻击；灵视不造成伤害',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'COVER':
      return { ...noEffect('实际掩护与闪避：只以现场普通自保减势；没有寒冷或腐烂来源可供尸体抗性匹配，普通短棍仍可伤人'),
        enemyReduction: 7.8 * factor };
    case 'SITE_PRESSURE':
      return { ...noEffect('现场普通牵制：只限制眼前携铃者的走位，结算普通控制槽减势；没有死亡之眼、召灵或亡灵控制'),
        enemyReduction: 4.2 * factor };
    case 'OBSERVE':
      return noEffect('调整阵位：利用现有通道准备下一次动作，本次贡献0；不召来灵体、不读取死者证言或揭示案件真相');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -5 : 5;
      return { ...noEffect(`动作偏差：本次意外贡献${selfGain > 0 ? '+' : '−'}5（G），不构成致伤攻击`), selfGain };
    }
  }
}
