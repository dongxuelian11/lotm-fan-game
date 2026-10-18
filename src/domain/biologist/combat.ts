import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { HarvestpriestCombatSource } from '../harvestpriest/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasBiologistDisputeOpponent, hasBiologistOpenPractice } from './encounter.js';

/** S6 finite G profile: U65/P15, A1/E1. The source does not establish a full
 * Biologist spell table. Ordinary body, visible observation and inherited care
 * remain bounded G play; Frank's research is not a grant of instant creations.
 * No greenhouse specimen enters combat, no transformation, swamp or cure-all. */
export const BIOLOGIST_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 10 }),
  Object.freeze({ id: '2', label: '2次', weight: 15 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 30 }),
  Object.freeze({ id: '5', label: '5次', weight: 20 }),
]);
export type BiologistMoveId = 'STRIKE' | 'BODY_FOLLOWUP' | 'mother.s6.specimen-study'
  | 'mother.s6.controlled-trial' | 'mother.s7.life-support' | 'ACCIDENT';
type BiologistMasteryId = 'mother.s9.careful-practice' | 'mother.s6.specimen-study' | 'mother.s7.life-support';
const ABILITIES: readonly {
  id: BiologistMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'STRIKE', label: '普通近身打击（G；12×身体）', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承审慎练习后的普通侧击（G；8.4×原掌握×身体）', weight: 15, stance: 'ATTACK' },
  { id: 'mother.s6.specimen-study', label: '当前可见身体表现观察与护身（G；42.25×样本研究掌握×身体）', weight: 25, stance: 'DEFEND' },
  { id: 'mother.s6.controlled-trial', label: '无现场苗木来源，普通走位（G；6×身体，0灵性）', weight: 10, stance: 'CONTROL' },
  { id: 'mother.s7.life-support', label: '继承有限生命支持（G；实际恢复才消耗4灵性）', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '时机或失衡（G；固定−16.25，不另掷正负）', weight: 5, stance: null },
];
export function isBiologist(state: SliceState): boolean {
  return state.progression?.pathwayId === 'mother' && state.progression.sequence === 6;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function biologistAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'STRIKE' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击（G；16×身体）' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawBiologistAbility(random: ActionRandomStream, stance: SliceStance | null): BiologistMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('生物学家能力盘权重无效');
}
export function biologistActionCount(roll: number): number {
  return roll <= 10 ? 1 : roll <= 25 ? 2 : roll <= 50 ? 3 : roll <= 80 ? 4 : 5;
}
export type BiologistCombatSource = HarvestpriestCombatSource | {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'BIOLOGIST_DISPUTE'; attemptWeek: number; startHistoryIndex: number;
  target: 'LORNE_SINGLE_ADULT_ORDINARY_HUMAN'; nature: 'ORDINARY_HUMAN';
  body: 'CURRENT_REACHABLE_BODY'; weapon: 'LORNES_OWN_ORDINARY_SHORT_CLUB'; weaponLocation: 'HAND';
  space: 'ORIGINAL_CLEAR_COURTYARD'; visibility: 'MUTUALLY_VISIBLE'; distanceMetres: 2;
  ground: 'CLEAR_ORDINARY_GROUND'; bystanders: 'NONE'; exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
};
/** Independent mother6 gate: the inherited S9–7 gates and RNG are unchanged. */
export function currentBiologistCombatSource(state: SliceState): BiologistCombatSource | null {
  const combat = state.combat;
  if (!isBiologist(state) || state.status !== 'ACTIVE' || !Number.isFinite(state.health) || state.health <= 0 ||
      !Number.isFinite(state.mind) || state.mind <= 0 || state.activeEvent !== null ||
      !combat || combat.enemyStatus !== 'RESISTING' || !Number.isFinite(combat.enemyHealth) || combat.enemyHealth <= 0 ||
      !Number.isFinite(combat.enemyMind) || combat.enemyMind <= 0 || state.world.city !== 'BACKLUND' ||
      hasBiologistOpenPractice(state) ||
      Object.values(state.biologist.cases).some(record => record.contactOpen || record.status === 'PREPARED') ||
      !Number.isSafeInteger(combat.round) || combat.round < 1 ||
      !Number.isSafeInteger(state.revision) || state.revision < 0 ||
      !Number.isSafeInteger(state.week) || state.week < 1) return null;
  if (combat.encounterId === 'FIRST_CASE') {
    if (state.arc.stage !== 'COMBAT' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
    return { runId: state.runId, revision: state.revision, week: state.week, encounterId: 'FIRST_CASE',
      round: combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER', body: 'CURRENT_REACHABLE_BODY',
      space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' };
  }
  const encounter = state.biologist.encounter;
  if (!hasBiologistDisputeOpponent(state) || encounter.startHistoryIndex === null ||
      state.combatHistory.length - encounter.startHistoryIndex !== combat.round - 1 ||
      !state.combatHistory.slice(encounter.startHistoryIndex).every((round, index) =>
        round.round === index + 1 && round.winner !== null && round.retreat !== 'SUCCESS')) return null;
  return { runId: state.runId, revision: state.revision, week: state.week, round: combat.round,
    encounterId: 'BIOLOGIST_DISPUTE', attemptWeek: state.week, startHistoryIndex: encounter.startHistoryIndex,
    target: 'LORNE_SINGLE_ADULT_ORDINARY_HUMAN', nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY',
    weapon: 'LORNES_OWN_ORDINARY_SHORT_CLUB', weaponLocation: 'HAND', space: 'ORIGINAL_CLEAR_COURTYARD',
    visibility: 'MUTUALLY_VISIBLE', distanceMetres: 2, ground: 'CLEAR_ORDINARY_GROUND', bystanders: 'NONE',
    exit: 'ORIGINAL_OPEN_EXIT', pursuit: false };
}
function validSource(state: SliceState, source: BiologistCombatSource | null): boolean {
  const current = currentBiologistCombatSource(state);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
function masteryFactor(state: SliceState, id: BiologistMasteryId): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}
export interface BiologistCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): BiologistCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
/** Only ordinary H/J threaten. No slot adds a draw or borrows a greenhouse source. */
export function resolveBiologistCombatAbility(
  state: SliceState, id: BiologistMoveId, physicalStateFactor: number, _random: ActionRandomStream,
  source: BiologistCombatSource | null = currentBiologistCombatSource(state),
): BiologistCombatEffect {
  if (!validSource(state, source)) {
    return noEffect('生物学家行动：缺少本场真实存活普通对手与原现场，或原苗木实践尚未实际收束；本次贡献0、消耗0，不重抽、不虚构试验来源');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'STRIKE': {
      const heldClub = state.town.clubLocation === 'HAND';
      const selfGain = (heldClub ? 16 : 12) * physical;
      return { label: heldClub
        ? '持握原短棍打击：只采用实际在手的镇上原普通短棍16×身体（G），0灵性，不叠加练习或超凡体魄，不取得洛恩的原棍'
        : '普通近身打击：普通身体12×身体（G），0灵性，不宣称已核实超凡体魄；伤势仍由共同后果盘结算',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 8.4 * masteryFactor(state, 'mother.s9.careful-practice') * physical;
      return { label: '继承审慎练习后的普通侧击：8.4×原耕种者审慎练习掌握×身体（G），0灵性，独立占用本槽，不追加攻击或超凡强化',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'mother.s6.specimen-study':
      return { ...noEffect('当前可见身体表现观察与护身：仅据眼前普通对手已经可见的身体表现调整护身，42.25×样本研究掌握×身体（G），0灵性；不读取隐藏弱点、病情、秘密或未来，不取消敌方行动或保证存活'),
        enemyReduction: 42.25 * masteryFactor(state, id) * physical };
    case 'mother.s6.controlled-trial':
      return { ...noEffect('普通走位：本场没有可供受控试验的原苗木来源，温室原苗留在原处；只沿眼前净空通道调整距离，6×身体（G），0灵性、无额外魔法，不临场催生或召唤植物，不变动物、不造沼泽、不追加行动'),
        enemyReduction: 6 * physical };
    case 'mother.s7.life-support': {
      if (state.health >= 100) {
        return noEffect('继承有限生命支持：当前健康已满，本次恢复0、消耗0，不抽随机盘；原有伤势记录与累计死亡风险保留');
      }
      if (!Number.isFinite(state.spirituality) || state.spirituality < 4) {
        return noEffect('继承有限生命支持：灵性不足4，本次恢复0、消耗0，不抽随机盘，不代扣健康或精神');
      }
      const recovered = Math.min(100 - state.health, Math.floor(15 * masteryFactor(state, id)));
      state.health += recovered;
      state.spirituality -= 4;
      return noEffect(`继承有限生命支持：消耗4灵性，实际恢复${recovered}健康（G），只用原丰收祭司生命支持掌握，本次战势贡献0，不抽随机盘；原有伤势记录与累计死亡风险保留，不清污染、不恢复精神、不能复活或保证存活`);
    }
    case 'ACCIDENT':
      return { ...noEffect('时机或失衡：本次固定贡献−16.25（G），不另抽正负，不构成致伤攻击，不生成植物或杂交产物'), selfGain: -16.25 };
  }
  return noEffect('生物学家行动：本槽没有已实现的合法战斗能力，本次贡献0、消耗0，不追加行动或随机盘');
}
