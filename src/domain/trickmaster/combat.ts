import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Door V1 S8: U30, A/E .7/.7; exact balance budgets, not canon measurements. */
export const TRICKMASTER_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 12 }),
  Object.freeze({ id: '2', label: '2次', weight: 18 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 28 }),
  Object.freeze({ id: '5', label: '5次', weight: 17 }),
]);

export type TrickmasterMoveId = 'TRICK_ATTACK' | 'BODY_FOLLOWUP' | 'TRICK_COVER'
  | 'TRICK_INTERFERENCE' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly {
  id: TrickmasterMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'TRICK_ATTACK', label: '单次弱小电击（2灵性）', weight: 24, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '普通次击（本场无可转移气体）', weight: 14, stance: 'ATTACK' },
  { id: 'TRICK_COVER', label: '单次雾气掩护（2灵性）', weight: 12, stance: 'DEFEND' },
  { id: 'TRICK_INTERFERENCE', label: '单次闪光干扰（2灵性）', weight: 8, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '观察原现场与普通退路', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差', weight: 32, stance: null },
];

export function isTrickmaster(state: SliceState): boolean {
  return state.progression?.pathwayId === 'door' && state.progression.sequence === 8;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function trickmasterAbilityWheel(stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id, label: ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawTrickmasterAbility(random: ActionRandomStream, stance: SliceStance | null): TrickmasterMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('戏法大师能力盘权重无效');
}
export function trickmasterActionCount(roll: number): number {
  return roll <= 12 ? 1 : roll <= 30 ? 2 : roll <= 55 ? 3 : roll <= 83 ? 4 : 5;
}

/** Authored FIRST_CASE scope, not a general gas, weather or physics system. */
export interface TrickmasterCombatSource {
  runId: string; revision: number; week: number; encounterId: 'FIRST_CASE'; round: number;
  target: 'CURRENT_VISIBLE_ORDINARY_CARRIER'; nature: 'ORDINARY_HUMAN';
  body: 'CURRENT_REACHABLE_BODY'; space: 'DRY_GROUND_PASSAGE';
  scope: 'CURRENT_LOCAL_SINGLE_OPPONENT'; gasObject: 'NONE'; doorPath: 'NONE';
  exit: 'EXISTING_ORDINARY_GROUND_EXIT'; companion: 'NONE';
}
export function currentTrickmasterCombatSource(state: SliceState): TrickmasterCombatSource | null {
  if (!isTrickmaster(state) || state.status !== 'ACTIVE' || state.health <= 0 || !state.combat ||
      state.combat.enemyHealth <= 0 || state.combat.enemyStatus !== 'RESISTING' ||
      state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE',
    scope: 'CURRENT_LOCAL_SINGLE_OPPONENT', gasObject: 'NONE', doorPath: 'NONE',
    exit: 'EXISTING_ORDINARY_GROUND_EXIT', companion: 'NONE' };
}
function validCombatSource(state: SliceState, source: TrickmasterCombatSource | null): boolean {
  const current = currentTrickmasterCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week &&
    source.encounterId === current.encounterId && source.round === current.round &&
    source.target === current.target && source.nature === current.nature &&
    source.body === current.body && source.space === current.space && source.scope === current.scope &&
    source.gasObject === current.gasObject && source.doorPath === current.doorPath &&
    source.exit === current.exit && source.companion === current.companion;
}
function masteryFactor(state: SliceState, id: 'door.s8.tricks' | 'door.s9.door-opening'): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

export interface TrickmasterCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): TrickmasterCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/**
 * One paid trick consumes one existing action and one 2S payment. The current
 * encounter uses electric, fog and flash, all sharing the one tricks record.
 * No control, combo or fog state survives this contribution; injury still uses
 * the shared consequence. Other known tricks do not silently fire as bonuses.
 */
export function resolveTrickmasterCombatAbility(
  state: SliceState, id: TrickmasterMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: TrickmasterCombatSource | null = currentTrickmasterCombatSource(state),
): TrickmasterCombatEffect {
  if (!validCombatSource(state, source)) {
    return noEffect('戏法大师行动：缺少本场仍可触及的普通对手与真实局部现场，本次贡献0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  const factor = masteryFactor(state, 'door.s8.tricks');
  const ordinary = masteryFactor(state, 'door.s9.door-opening');
  const canPay = Number.isFinite(state.spirituality) && state.spirituality >= 2;
  switch (id) {
    case 'TRICK_ATTACK': {
      if (state.town.clubLocation === 'HAND') {
        const selfGain = 16 * physical;
        return { label: '持握原短棍打击：普通短棍16贡献（G）替换而不叠加主攻戏法；本次不用戏法、不耗灵性',
          selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      if (!canPay) {
        const selfGain = 6.5 * ordinary * physical;
        return { label: '灵性不足2：改用原普通身体攻击（G），不施放电击，不耗灵性、不重抽行动',
          selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      state.spirituality -= 2;
      return { label: '弱小电击：只作用眼前单一普通对手的可触及身体，耗灵性2；本次主攻13.65×掌握系数（G），不造成持续麻痹或追加冻结，伤势另走普通后果盘',
        selfGain: 13.65 * factor, enemyReduction: 0, threatens: true };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 7.35 * ordinary * physical;
      return { label: '普通次击：本场没有已声明可转移的气体对象，以实际身体结算次攻预算（G）；不制造毒气、不追加持棍或戏法攻击',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'TRICK_COVER': {
      if (!canPay) return { ...noEffect('灵性不足2：改用原普通闪避（G），不耗灵性；本场没有可穿过的原隔断，不能开门取消后续攻击'),
        enemyReduction: 7.8 * ordinary };
      state.spirituality -= 2;
      return { ...noEffect('短促雾气掩护：只扰动眼前交手位置的视野，耗灵性2；本次自保减势13.65×掌握系数（G），当次结算即止，不保证免伤、不取消行动或制造门径'),
        enemyReduction: 13.65 * factor };
    }
    case 'TRICK_INTERFERENCE': {
      if (!canPay) return { ...noEffect('灵性不足2：改用原现场普通牵制（G），不耗灵性，不附带闪光、绊倒或控制状态'),
        enemyReduction: 4.2 * ordinary };
      state.spirituality -= 2;
      return { ...noEffect('眼前闪光：仅短暂干扰当前可见普通对手，耗灵性2；本次控制减势7.35×掌握系数（G），不保证眩晕或失去行动，不催眠、不直接判伤或判死'),
        enemyReduction: 7.35 * factor };
    }
    case 'OBSERVE':
      return noEffect('观察原现场与普通退路：本次贡献0；没有施放戏法、完成组合或获得记录魔法，不留额外效果、出口或行动');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -7.5 : 7.5;
      return { ...noEffect(`动作偏差：本次意外贡献${selfGain > 0 ? '+' : '−'}7.5（G），不构成额外戏法或致伤攻击`), selfGain };
    }
  }
}
