import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { PrisonerCombatSource } from '../prisoner/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/**
 * Interrogator S7 keeps the three Arbiter and two Sheriff abilities. Only the
 * mental-puncture and mental-pressure slots are new here; image reconstruction
 * stays a life skill. The canon distinguishes pressure that Klein resists
 * (B2 ch17), Xio's new mental puncture (B5 ch4), and Tracy evading an attack
 * (B3 ch100). None promises a hit, a confession, truth or a cancelled turn.
 * All numeric budgets, costs, thresholds and wheels below are G.
 */
export const INTERROGATOR_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 10 }),
  Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 25 }),
  Object.freeze({ id: '5', label: '5次', weight: 20 }),
]);

type InterrogatorCombatMasteryId = 'justiciar.s9.combat-training' | 'justiciar.s8.trace-sensing'
  | 'justiciar.s7.mental-puncture' | 'justiciar.s7.mental-pressure';
export type InterrogatorMoveId = 'justiciar.s9.combat-training' | 'BODY_FOLLOWUP'
  | 'justiciar.s7.mental-puncture' | 'POSITION' | 'justiciar.s7.mental-pressure' | 'ACCIDENT';
const ABILITIES: readonly {
  id: InterrogatorMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'justiciar.s9.combat-training', label: '审讯者格斗打击', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承格斗侧击', weight: 20, stance: 'ATTACK' },
  { id: 'justiciar.s7.mental-puncture', label: '精神刺穿', weight: 20, stance: 'ATTACK' },
  { id: 'POSITION', label: '普通走位牵制', weight: 10, stance: 'CONTROL' },
  { id: 'justiciar.s7.mental-pressure', label: '精神压迫', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '时机或失衡', weight: 5, stance: null },
];

export function isInterrogator(state: SliceState): boolean {
  return state.progression?.pathwayId === 'justiciar' && state.progression.sequence === 7;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function interrogatorAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'justiciar.s9.combat-training' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawInterrogatorAbility(random: ActionRandomStream, stance: SliceStance | null): InterrogatorMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('审讯者能力盘权重无效');
}
export function interrogatorActionCount(roll: number): number {
  return roll <= 10 ? 1 : roll <= 30 ? 2 : roll <= 55 ? 3 : roll <= 80 ? 4 : 5;
}

export interface InterrogatorCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): InterrogatorCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/**
 * Same authored source as Sheriff: the current known, visible ordinary carrier
 * and reachable body in FIRST_CASE. No remote or hidden mind is discovered,
 * and nothing here creates a persisted detection or interrogation snapshot.
 */
export type InterrogatorCombatSource = PrisonerCombatSource;
export function currentInterrogatorCombatSource(state: SliceState): InterrogatorCombatSource | null {
  if (!isInterrogator(state) || state.status !== 'ACTIVE' || !Number.isFinite(state.health) || state.health <= 0 ||
      !state.combat || !Number.isFinite(state.combat.enemyHealth) || state.combat.enemyHealth <= 0 ||
      state.combat.enemyStatus !== 'RESISTING' || state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      !Number.isSafeInteger(state.combat.round) || state.combat.round < 1 ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' };
}
function validCombatSource(state: SliceState, source: InterrogatorCombatSource | null): boolean {
  const current = currentInterrogatorCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week &&
    source.encounterId === current.encounterId && source.round === current.round &&
    source.target === current.target && source.body === current.body &&
    source.space === current.space && source.exit === current.exit;
}
function masteryValue(state: SliceState, id: InterrogatorCombatMasteryId): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0));
}
function masteryFactor(state: SliceState, id: InterrogatorCombatMasteryId): number {
  return 0.65 + 0.35 * masteryValue(state, id) / 500;
}

/** One existing slot. Only H/J are physical threats for the shared wound/death wheel. */
export function resolveInterrogatorCombatAbility(
  state: SliceState, id: InterrogatorMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: InterrogatorCombatSource | null = currentInterrogatorCombatSource(state),
): InterrogatorCombatEffect {
  if (!validCombatSource(state, source)) {
    return noEffect('审讯者行动：缺少本场仍可触及的已知可见普通人、身体与真实现场，本次贡献0、消耗0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'justiciar.s9.combat-training': {
      // Only this actual held club replaces H. Practice objects are not equipment.
      const heldClub = state.town.clubLocation === 'HAND';
      const selfGain = (heldClub ? 16 : 45 * masteryFactor(state, id)) * physical;
      return { label: heldClub
        ? '持握原短棍打击：只采用已经在手的普通短棍贡献，不叠加格斗预算或掌握加成，消耗0灵性'
        : '审讯者格斗打击：以继承的格斗能力进行真实近身打击（G），消耗0灵性，不保证命中；伤害仍由共同伤势盘结算',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 31.5 * masteryFactor(state, 'justiciar.s9.combat-training') * physical;
      return { label: '格斗侧击：采用同一继承格斗掌握度（G），消耗0灵性，独立占用本次行动，不追加攻击',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'justiciar.s7.mental-puncture': {
      if (!Number.isFinite(state.spirituality) || state.spirituality < 3) {
        return { ...noEffect('精神刺穿：灵性不足，改用继承的近处痕迹辨认与护身（G）；只辨认已知、可见、近处且未受遮蔽的普通携铃者与当前动作，消耗0灵性，不抽精神刺穿盘、不额外行动，不读取远程或隐藏心智，不预读未来行动'),
          enemyReduction: 36.45 * masteryFactor(state, 'justiciar.s8.trace-sensing') * physical };
      }
      const threshold = 55 + Math.floor(20 * masteryValue(state, id) / 500);
      state.spirituality -= 3;
      const roll = random.nextInt(1, 100), success = roll <= threshold;
      return { ...noEffect(`精神刺穿：消耗3灵性，命中盘${roll}/100、阈值${threshold}（G）；${success ? '对眼前可触及普通人的灵体打击形成短暂战势贡献' : '对方避开或抵抗，本次贡献0'}。不是必中，不读取远程或隐藏心智，不保证供述或真相，不取消敌方行动；本槽不单独开启物理伤势或死亡`),
        selfGain: success ? 36 * masteryFactor(state, id) : 0 };
    }
    case 'POSITION':
      return { ...noEffect('普通走位牵制：只沿眼前通道调整距离（G），不以精神压迫强制同意，不取消敌方行动'),
        enemyReduction: 6 * physical };
    case 'justiciar.s7.mental-pressure': {
      if (!Number.isFinite(state.spirituality) || state.spirituality < 3) {
        return noEffect('精神压迫：灵性不足，改为普通现场分析，本次贡献0、消耗0，不抽抵抗盘、不额外行动');
      }
      const threshold = 35 + Math.floor(15 * masteryValue(state, id) / 500);
      state.spirituality -= 3;
      const roll = random.nextInt(1, 100), success = roll <= threshold;
      return { ...noEffect(`精神压迫：消耗3灵性，抵抗盘${roll}/100、阈值${threshold}（G）；${success ? '眼前普通人短暂受压，只削减本轮战势' : '对方抵抗，本次贡献0'}。不取消行动、不跨轮保留，不强制服从、供述、同意或判罪，不保证真相，不读取远程或隐藏心智，不造成物理伤势或死亡`),
        enemyReduction: success ? 15 * masteryFactor(state, id) : 0 };
    }
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -11.25 : 11.25;
      return { ...noEffect(`时机或失衡：本次意外贡献${selfGain > 0 ? '+' : '−'}11.25（G），不构成致伤攻击，不是禁令或保证命中的精神刺穿`), selfGain };
    }
  }
  return noEffect('审讯者行动：本槽没有已实现的合法战斗能力；影像重构只用于生活调查，不追加攻击或抽签');
}
