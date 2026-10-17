import { computeCheckChance } from '../../resolution/normal-check.js';
import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { HarvestpriestCombatSource } from '../harvestpriest/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasDruidDisputeOpponent, hasDruidOpenPractice } from './encounter.js';

/** S5 finite G profile. Body/observation/care budgets remain the real S6 budgets.
 * Only the authored known shallow loam supports one completed ground maneuver.
 * Every maneuver finishes above ground; no stored underground immunity, enemy
 * burial, animal transformation, plant soul or creation ability is introduced. */
export const DRUID_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 12 }),
  Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 23 }),
  Object.freeze({ id: '5', label: '5次', weight: 14 }),
  Object.freeze({ id: '6', label: '6次', weight: 6 }),
]);
export type DruidMoveId = 'STRIKE' | 'BODY_FOLLOWUP' | 'mother.s6.specimen-study'
  | 'mother.s5.ground-passage' | 'mother.s7.life-support' | 'ACCIDENT';
type DruidMasteryId = 'mother.s9.careful-practice' | 'mother.s6.specimen-study' | 'mother.s7.life-support' | 'mother.s5.ground-passage';
const ABILITIES: readonly {
  id: DruidMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'STRIKE', label: '普通近身打击（G；12×身体）', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承审慎练习后的普通侧击（G；8.4×原掌握×身体）', weight: 15, stance: 'ATTACK' },
  { id: 'mother.s6.specimen-study', label: '当前可见身体表现观察与护身（G；42.25×样本研究掌握×身体）', weight: 25, stance: 'DEFEND' },
  { id: 'mother.s5.ground-passage', label: '已知浅普通壤土短潜行／未知土质普通走位（G；3灵性、知识14）', weight: 10, stance: 'CONTROL' },
  { id: 'mother.s7.life-support', label: '继承有限生命支持（G；实际恢复才消耗4灵性）', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '时机或失衡（G；固定−22.5，不另掷正负）', weight: 5, stance: null },
];
export function isDruid(state: SliceState): boolean {
  return state.progression?.pathwayId === 'mother' && state.progression.sequence === 5;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function druidAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'STRIKE' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击（G；16×身体）' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawDruidAbility(random: ActionRandomStream, stance: SliceStance | null): DruidMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('德鲁伊能力盘权重无效');
}
export function druidActionCount(roll: number): number {
  return roll <= 12 ? 1 : roll <= 32 ? 2 : roll <= 57 ? 3 : roll <= 80 ? 4 : roll <= 94 ? 5 : 6;
}
export type DruidCombatSource = HarvestpriestCombatSource | {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'DRUID_DISPUTE'; attemptWeek: number; startHistoryIndex: number;
  target: 'MAREN_SINGLE_ADULT_ORDINARY_HUMAN'; nature: 'ORDINARY_HUMAN';
  body: 'CURRENT_REACHABLE_BODY'; weapon: 'MARENS_OWN_ORDINARY_SHORT_CLUB'; weaponLocation: 'HAND';
  space: 'ORIGINAL_KNOWN_GARDEN_EDGE'; visibility: 'MUTUALLY_VISIBLE'; distanceMetres: 2;
  ground: 'KNOWN_SHALLOW_ORDINARY_LOAM'; bystanders: 'NONE'; exit: 'ORIGINAL_CLEAR_DRY_SIDEPATH_EXIT'; pursuit: false;
};
/** Independent mother5 gate: all inherited S9–6 gates and RNG are unchanged. */
export function currentDruidCombatSource(state: SliceState): DruidCombatSource | null {
  const combat = state.combat;
  if (!isDruid(state) || state.status !== 'ACTIVE' || !Number.isFinite(state.health) || state.health <= 0 ||
      !Number.isFinite(state.mind) || state.mind <= 0 || state.activeEvent !== null ||
      !combat || combat.enemyStatus !== 'RESISTING' || !Number.isFinite(combat.enemyHealth) || combat.enemyHealth <= 0 ||
      !Number.isFinite(combat.enemyMind) || combat.enemyMind <= 0 || state.world.city !== 'BACKLUND' ||
      hasDruidOpenPractice(state) ||
      Object.values(state.druid.cases).some(record => record.contactOpen || record.status === 'PREPARED') ||
      !Number.isSafeInteger(combat.round) || combat.round < 1 ||
      !Number.isSafeInteger(state.revision) || state.revision < 0 ||
      !Number.isSafeInteger(state.week) || state.week < 1) return null;
  if (combat.encounterId === 'FIRST_CASE') {
    if (state.arc.stage !== 'COMBAT' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
    return { runId: state.runId, revision: state.revision, week: state.week, encounterId: 'FIRST_CASE',
      round: combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER', body: 'CURRENT_REACHABLE_BODY',
      space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' };
  }
  const encounter = state.druid.encounter;
  if (!hasDruidDisputeOpponent(state) || encounter.startHistoryIndex === null ||
      state.combatHistory.length - encounter.startHistoryIndex !== combat.round - 1 ||
      !state.combatHistory.slice(encounter.startHistoryIndex).every((round, index) =>
        round.round === index + 1 && round.winner !== null && round.retreat !== 'SUCCESS')) return null;
  return { runId: state.runId, revision: state.revision, week: state.week, round: combat.round,
    encounterId: 'DRUID_DISPUTE', attemptWeek: state.week, startHistoryIndex: encounter.startHistoryIndex,
    target: 'MAREN_SINGLE_ADULT_ORDINARY_HUMAN', nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY',
    weapon: 'MARENS_OWN_ORDINARY_SHORT_CLUB', weaponLocation: 'HAND', space: 'ORIGINAL_KNOWN_GARDEN_EDGE',
    visibility: 'MUTUALLY_VISIBLE', distanceMetres: 2, ground: 'KNOWN_SHALLOW_ORDINARY_LOAM', bystanders: 'NONE',
    exit: 'ORIGINAL_CLEAR_DRY_SIDEPATH_EXIT', pursuit: false };
}
function validSource(state: SliceState, source: DruidCombatSource | null): boolean {
  const current = currentDruidCombatSource(state);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
function masteryFactor(state: SliceState, id: DruidMasteryId): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}
export interface DruidCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): DruidCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
/** Only ordinary H/J threaten. K draws once only after paying for known loam. */
export function resolveDruidCombatAbility(
  state: SliceState, id: DruidMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: DruidCombatSource | null = currentDruidCombatSource(state),
): DruidCombatEffect {
  if (!validSource(state, source)) {
    return noEffect('德鲁伊行动：缺少本场真实存活普通对手与原现场，或原土道、原苗与新旧实践尚未实际收束；本次贡献0、消耗0，不重抽、不虚构土质或身体来源');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'STRIKE': {
      const heldClub = state.town.clubLocation === 'HAND';
      const selfGain = (heldClub ? 16 : 12) * physical;
      return { label: heldClub
        ? '持握原短棍打击：只采用实际在手的镇上原普通短棍16×身体（G），0灵性，不叠加练习或超凡体魄，不取得对方的原棍'
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
    case 'mother.s5.ground-passage': {
      // FIRST_CASE establishes a dry passage, never an actual loam source.
      if (source?.encounterId !== 'DRUID_DISPUTE') {
        return { ...noEffect('普通走位：首案原干燥通道的土质未知，不能假定为可潜行壤土；只沿原净空地面实际调整身体，6×身体（G），0灵性、不抽潜行判定，不借温室原苗或制造新土道'), enemyReduction: 6 * physical };
      }
      if (!Number.isFinite(state.spirituality) || state.spirituality < 3) {
        return { ...noEffect('灵性不足3，普通走位：沿本场原净空干燥侧路实际调整身体，6×身体（G），0灵性、不抽潜行判定，不留在地下或透支资源'), enemyReduction: 6 * physical };
      }
      state.spirituality -= 3;
      const chance = computeCheckChance({ ability: 'knowledge', baseAbility: state.character.coreStats.knowledge, difficulty: 14, modifiers: [] });
      const roll = random.nextInt(1, 100);
      if (roll > chance) return noEffect(`短地下潜行失败：实际付3灵性，知识14判定${roll}>${chance}；原身体留在原已知地面落脚处，壤土保持稳定，本次贡献0，不返费、不重抽或保存在地下的状态`);
      return { ...noEffect(`短地下潜行成功：实际付3灵性，知识14判定${roll}≤${chance}；脚下已核实的浅普通壤土短暂软化，你的原身体实际沉入并沿总长不超过1米的局部浅弧再出到同一已知净空落脚处，壤土随后恢复稳定。3灵性覆盖这一连续且已完成的完整动作（范围与成本均G），58.5×地下潜行掌握×身体有限减势；没有第二次免费返回、留在地下、取消敌方动作、埋敌、全场沼泽或保证免伤`), enemyReduction: 58.5 * masteryFactor(state, id) * physical };
    }
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
      return { ...noEffect('时机或失衡：本次固定贡献−22.5（G），不另抽正负，不构成致伤攻击，不生成植物或杂交产物'), selfGain: -22.5 };
  }
  return noEffect('德鲁伊行动：本槽没有已实现的合法战斗能力，本次贡献0、消耗0，不追加行动或随机盘');
}
