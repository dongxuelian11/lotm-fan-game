import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { PrisonerCombatSource } from '../prisoner/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/**
 * Sheriff S8 inherits combat training and limited authority. Near-range trace
 * sensing is not an omniscient radar: this slice only uses the already-visible,
 * unshielded ordinary carrier in the actual reachable FIRST_CASE passage.
 * All wheels and budgets are G. Image reconstruction is a life skill, never a
 * combat attack. No identity, guilt, hidden inventory, future action, official
 * status, S7 mental puncture or S6 prohibition is supplied by these effects.
 */
export const SHERIFF_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 10 }),
  Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 25 }),
  Object.freeze({ id: '5', label: '5次', weight: 20 }),
]);

type SheriffCombatMasteryId = 'justiciar.s9.combat-training' | 'justiciar.s9.authority' | 'justiciar.s8.trace-sensing';
export type SheriffMoveId = 'justiciar.s9.combat-training' | 'BODY_FOLLOWUP' | 'justiciar.s8.trace-sensing'
  | 'POSITION' | 'justiciar.s9.authority' | 'ACCIDENT';
const ABILITIES: readonly {
  id: SheriffMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'justiciar.s9.combat-training', label: '治安官格斗打击', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承格斗侧击', weight: 20, stance: 'ATTACK' },
  { id: 'justiciar.s8.trace-sensing', label: '近处痕迹辨认与护身', weight: 20, stance: 'DEFEND' },
  { id: 'POSITION', label: '普通走位牵制', weight: 10, stance: 'CONTROL' },
  { id: 'justiciar.s9.authority', label: '威严呼告', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '时机或失衡', weight: 5, stance: null },
];

export function isSheriff(state: SliceState): boolean {
  return state.progression?.pathwayId === 'justiciar' && state.progression.sequence === 8;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function sheriffAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'justiciar.s9.combat-training' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawSheriffAbility(random: ActionRandomStream, stance: SliceStance | null): SheriffMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('治安官能力盘权重无效');
}
export function sheriffActionCount(roll: number): number {
  return roll <= 10 ? 1 : roll <= 30 ? 2 : roll <= 55 ? 3 : roll <= 80 ? 4 : 5;
}

export interface SheriffCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): SheriffCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/**
 * The authored FIRST_CASE scene already exposes a nearby ordinary carrier,
 * reachable body and open passage, with no shielding. This source establishes
 * no new person or trace and is never persisted as a detection snapshot.
 */
export type SheriffCombatSource = PrisonerCombatSource;
export function currentSheriffCombatSource(state: SliceState): SheriffCombatSource | null {
  if (!isSheriff(state) || state.status !== 'ACTIVE' || !Number.isFinite(state.health) || state.health <= 0 ||
      !state.combat || !Number.isFinite(state.combat.enemyHealth) || state.combat.enemyHealth <= 0 ||
      state.combat.enemyStatus !== 'RESISTING' || state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      !Number.isSafeInteger(state.combat.round) || state.combat.round < 1 ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' };
}
function validCombatSource(state: SliceState, source: SheriffCombatSource | null): boolean {
  const current = currentSheriffCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week &&
    source.encounterId === current.encounterId && source.round === current.round &&
    source.target === current.target && source.body === current.body &&
    source.space === current.space && source.exit === current.exit;
}
function masteryValue(state: SliceState, id: SheriffCombatMasteryId): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0));
}
function masteryFactor(state: SliceState, id: SheriffCombatMasteryId): number {
  return 0.65 + 0.35 * masteryValue(state, id) / 500;
}

/** One existing slot. Only real physical attacks allow the shared injury/death wheel. */
export function resolveSheriffCombatAbility(
  state: SliceState, id: SheriffMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: SheriffCombatSource | null = currentSheriffCombatSource(state),
): SheriffCombatEffect {
  if (!validCombatSource(state, source)) {
    return noEffect('治安官行动：缺少本场仍可触及的可见普通人、身体与真实现场，本次贡献0、消耗0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'justiciar.s9.combat-training': {
      // Only this actual held club replaces H. Practice objects are not new equipment.
      const heldClub = state.town.clubLocation === 'HAND';
      const selfGain = (heldClub ? 16 : 30 * masteryFactor(state, id)) * physical;
      return { label: heldClub
        ? '持握原短棍打击：只采用已经在手的普通短棍贡献，不叠加格斗预算或掌握加成，消耗0灵性'
        : '治安官格斗打击：以出色格斗能力进行真实近身打击（G），消耗0灵性，不保证命中；伤害仍由共同伤势盘结算',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 21 * masteryFactor(state, 'justiciar.s9.combat-training') * physical;
      return { label: '格斗侧击：采用同一格斗掌握度（G），消耗0灵性，独立占用本次行动，不追加攻击',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'justiciar.s8.trace-sensing':
      return { ...noEffect('近处痕迹辨认与护身：只辨认已知、可见、近处且未受遮蔽的普通携铃者与当前动作（G），不查看远程背包、未知身份或罪责，不预读未来行动，不取消敌方行动或保证存活'),
        enemyReduction: 24.3 * masteryFactor(state, 'justiciar.s8.trace-sensing') * physical };
    case 'POSITION':
      return { ...noEffect('普通走位牵制：只沿眼前通道调整距离（G），不使用威严强制同意，不取消敌方行动'),
        enemyReduction: 6 * physical };
    case 'justiciar.s9.authority': {
      if (!Number.isFinite(state.spirituality) || state.spirituality < 1) {
        return noEffect('威严呼告：灵性不足，改为普通现场分析，本次贡献0、消耗0，不抽抵抗盘、不额外行动');
      }
      const threshold = 35 + Math.floor(15 * masteryValue(state, id) / 500);
      state.spirituality -= 1;
      const roll = random.nextInt(1, 100);
      const success = roll <= threshold;
      return { ...noEffect(`威严呼告：消耗1灵性，抵抗盘${roll}/100、阈值${threshold}（G）；${success ? '眼前普通人短暂迟疑，只削减本轮战势' : '对方抵抗，本次贡献0'}。不取消行动、不跨轮保留，不强制服从、供述、同意或判罪，不授予官方身份，不造成伤势或死亡`),
        enemyReduction: success ? 10 * masteryFactor(state, id) : 0 };
    }
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -7.5 : 7.5;
      return { ...noEffect(`时机或失衡：本次意外贡献${selfGain > 0 ? '+' : '−'}7.5（G），不构成致伤攻击，不是禁令或精神刺穿`), selfGain };
    }
  }
  return noEffect('治安官行动：本槽没有已实现的合法战斗能力；影像重构只用于生活调查，不追加攻击或抽签');
}
