import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { LuckyPassiveLuck } from '../lucky/combat.js';
import type { MonsterCombatSource } from '../monster/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasCalamityPriestDisputeOpponent } from './encounter.js';

/** Calamity Priest S6 candidate: U65/P15, A1/E1. All budgets and costs are G.
 * The ordinary courtyard has no loose object or qualified disaster trigger.
 * Inherited physical skill and passive luck never manufacture a disaster. */
export const CALAMITY_PRIEST_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 10 }),
  Object.freeze({ id: '2', label: '2次', weight: 15 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 30 }),
  Object.freeze({ id: '5', label: '5次', weight: 20 }),
]);
export type CalamityPriestMoveId = 'BODY_STRIKE' | 'BODY_FOLLOWUP' | 'wheel.s6.disaster-awareness'
  | 'wheel.s6.mental-storm' | 'wheel.s6.disaster-attraction' | 'ACCIDENT';
const ABILITIES: readonly {
  id: CalamityPriestMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'BODY_STRIKE', label: '继承普通身体打击（G；18×身体，0消耗）', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承计算与精确身体次击（G；22.75×计算掌握×身体，0消耗）', weight: 15, stance: 'ATTACK' },
  { id: 'wheel.s6.disaster-awareness', label: '当前攻击有限预警与避让（G；3灵性，否则普通格挡）', weight: 25, stance: 'DEFEND' },
  { id: 'wheel.s6.mental-storm', label: '有限精神风暴（G；3灵性，否则普通走位）', weight: 10, stance: 'CONTROL' },
  { id: 'wheel.s6.disaster-attraction', label: '核实当前真实灾源（本场无合格灾源，0贡献、0消耗）', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '警兆或动作偏差（G；固定−16.25，不另掷正负）', weight: 5, stance: null },
];

export function isCalamityPriest(state: SliceState): boolean {
  return state.progression?.pathwayId === 'wheel' && state.progression.sequence === 6;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function calamityPriestAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'BODY_STRIKE' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击（G；16×身体替换主攻，0灵性，不叠加身体或灾祸预算）' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawCalamityPriestAbility(random: ActionRandomStream, stance: SliceStance | null): CalamityPriestMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('灾祸教士能力盘权重无效');
}
export function calamityPriestActionCount(roll: number): number {
  return roll <= 10 ? 1 : roll <= 25 ? 2 : roll <= 50 ? 3 : roll <= 80 ? 4 : 5;
}

type NoDisasterSource = { looseObjectSource: false; disasterTrigger: false; practiceBoardPresent: false };
export type CalamityPriestCombatSource = (MonsterCombatSource & NoDisasterSource) | ({
  runId: string; revision: number; week: number; round: number;
  encounterId: 'CALAMITY_PRIEST_DISPUTE'; attemptWeek: number; startHistoryIndex: number;
  target: 'DURAN_SINGLE_ADULT_ORDINARY_HUMAN'; nature: 'ORDINARY_HUMAN';
  body: 'CURRENT_REACHABLE_BODY'; weapon: 'DURANS_OWN_ORDINARY_SHORT_CLUB'; weaponLocation: 'HAND';
  space: 'ORIGINAL_CLEAR_COURTYARD'; visibility: 'MUTUALLY_VISIBLE'; distanceMetres: 2;
  ground: 'CLEAR_ORDINARY_GROUND'; bystanders: 'NONE'; exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
} & NoDisasterSource);

/** Bind the real resisting opponent and this exact arrival, never a practice
 * board, an old report, an alleged hidden hazard or a future random outcome. */
export function currentCalamityPriestCombatSource(state: SliceState): CalamityPriestCombatSource | null {
  const combat = state.combat, practice = state.calamityPriest.practice;
  if (!isCalamityPriest(state) || state.status !== 'ACTIVE' || !Number.isFinite(state.health) || state.health <= 0 ||
      !Number.isFinite(state.mind) || state.mind <= 0 || state.activeEvent !== null ||
      !combat || combat.enemyStatus !== 'RESISTING' || !Number.isFinite(combat.enemyHealth) || combat.enemyHealth <= 0 ||
      !Number.isFinite(combat.enemyMind) || combat.enemyMind <= 0 || state.world.city !== 'BACKLUND' ||
      !['UNASSESSED', 'SECURED'].includes(practice.hazard) || !['RESTING', 'SECURED'].includes(practice.board) ||
      !['NONE', 'RELEASED'].includes(practice.contact) ||
      Object.values(state.calamityPriest.cases).some(record => record.contactOpen || record.status === 'PREPARED') ||
      !Number.isSafeInteger(combat.round) || combat.round < 1 ||
      !Number.isSafeInteger(state.revision) || state.revision < 0 ||
      !Number.isSafeInteger(state.week) || state.week < 1) return null;
  const absent: NoDisasterSource = { looseObjectSource: false, disasterTrigger: false, practiceBoardPresent: false };
  if (combat.encounterId === 'FIRST_CASE') {
    if (state.arc.stage !== 'COMBAT' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
    return { runId: state.runId, revision: state.revision, week: state.week, encounterId: 'FIRST_CASE',
      round: combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER', body: 'CURRENT_REACHABLE_BODY',
      space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT', ...absent };
  }
  const e = state.calamityPriest.encounter;
  if (!hasCalamityPriestDisputeOpponent(state) || e.startHistoryIndex === null ||
      state.combatHistory.length - e.startHistoryIndex !== combat.round - 1 ||
      !state.combatHistory.slice(e.startHistoryIndex).every((round, index) =>
        round.round === index + 1 && round.winner !== null && round.retreat !== 'SUCCESS')) return null;
  return { runId: state.runId, revision: state.revision, week: state.week, round: combat.round,
    encounterId: 'CALAMITY_PRIEST_DISPUTE', attemptWeek: state.week, startHistoryIndex: e.startHistoryIndex,
    target: 'DURAN_SINGLE_ADULT_ORDINARY_HUMAN', nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY',
    weapon: 'DURANS_OWN_ORDINARY_SHORT_CLUB', weaponLocation: 'HAND', space: 'ORIGINAL_CLEAR_COURTYARD',
    visibility: 'MUTUALLY_VISIBLE', distanceMetres: 2, ground: 'CLEAR_ORDINARY_GROUND', bystanders: 'NONE',
    exit: 'ORIGINAL_OPEN_EXIT', pursuit: false, ...absent };
}
function validSource(state: SliceState, source: CalamityPriestCombatSource | null): boolean {
  const current = currentCalamityPriestCombatSource(state);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
function masteryFactor(state: SliceState,
  id: 'wheel.s8.calculation-control' | 'wheel.s6.disaster-awareness' | 'wheel.s6.mental-storm' | 'wheel.s7.passive-luck',
): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}
function physicalFactor(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}
function spend(state: SliceState): boolean {
  if (!Number.isFinite(state.spirituality) || state.spirituality < 3) return false;
  state.spirituality -= 3;
  return true;
}

/** Exactly the inherited S7 d100, once before both count draws on a non-retreat
 * round. This separate S6 source gate never broadens Lucky's old S7 gate. */
export function drawCalamityPriestPassiveLuck(
  state: SliceState, stance: SliceStance, physicalStateFactor: number, random: ActionRandomStream,
  source: CalamityPriestCombatSource | null = currentCalamityPriestCombatSource(state),
): LuckyPassiveLuck | null {
  if (stance === 'RETREAT' || !validSource(state, source)) return null;
  const roll = random.nextInt(1, 100), triggered = roll <= 25;
  return { roll, triggered, bonus: triggered
    ? 45 * masteryFactor(state, 'wheel.s7.passive-luck') * physicalFactor(physicalStateFactor) : 0 };
}

export interface CalamityPriestCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): CalamityPriestCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/** Pay only the selected B or K. Mental interference contributes pressure
 * reduction, never an added physical wound, compelled confession or extra draw. */
export function resolveCalamityPriestCombatAbility(
  state: SliceState, id: CalamityPriestMoveId, physicalStateFactor: number, _random: ActionRandomStream,
  source: CalamityPriestCombatSource | null = currentCalamityPriestCombatSource(state),
): CalamityPriestCombatEffect {
  if (!validSource(state, source)) {
    return noEffect('灾祸教士行动：缺少本场真实存活对手与原现场，或练习尚未收束；0贡献、0消耗、不重抽、不制造灾源');
  }
  const physical = physicalFactor(physicalStateFactor);
  switch (id) {
    case 'BODY_STRIKE': {
      const heldClub = state.town.clubLocation === 'HAND', selfGain = (heldClub ? 16 : 18) * physical;
      return { label: heldClub
        ? '持握原短棍打击：实际手持镇上原短棍，以16×当前身体系数替换本次主攻（G），0灵性；不叠加身体或灾祸预算，不取得对手的原棍'
        : '继承普通身体打击：18×当前身体系数（G），0灵性；使用本人真实身体，不是假造的进攻灾祸，不保证命中，伤势仍由共同后果盘结算',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 22.75 * masteryFactor(state, 'wheel.s8.calculation-control') * physical;
      return { label: '继承计算与精确身体次击：22.75×原计算与控制掌握×当前身体系数（G），0灵性；独立占本次行动，不附赠攻击，不凭空造出或取得工具',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'wheel.s6.disaster-awareness':
      if (spend(state)) {
        return { ...noEffect('当前攻击有限预警与避让：本槽实际耗3灵性，42.25×灾祸觉察掌握×当前身体系数（G）；只减轻眼前仍抵抗的真实对手攻击压力，不读取下一次随机结果、不取消敌方行动、不保证无伤'),
          enemyReduction: 42.25 * masteryFactor(state, id) * physical };
      }
      return { ...noEffect('灵性不足3：回退普通格挡10×当前身体系数（G），0消耗；不透支，不生成预知或灾祸免疫'),
        enemyReduction: 10 * physical };
    case 'wheel.s6.mental-storm':
      if (spend(state)) {
        return { ...noEffect('有限精神风暴：本槽实际耗3灵性，42.25×精神风暴掌握（G），不乘身体系数；仅减少当前真实普通对手的战势，不额外造成身体伤害、不取消行动、不强迫供述或服从，不控制意愿'),
          enemyReduction: 42.25 * masteryFactor(state, id) };
      }
      return { ...noEffect('灵性不足3：回退普通走位6×当前身体系数（G），0消耗；没有精神风暴，不强迫对手服从'),
        enemyReduction: 6 * physical };
    case 'wheel.s6.disaster-attraction':
      return noEffect('灾祸来源核实：本场没有合格松动物或可引动灾祸，0贡献、0消耗；练习木板没有带进战斗，不凭空生成灾害、不制造隐藏灾源、不把手持原棍冒充松动物，不重抽');
    case 'ACCIDENT':
      return { ...noEffect('警兆或动作偏差：本次固定−16.25战势（G），0灵性，不另掷正负；不是免费灾害、幸运操纵或额外致伤攻击'), selfGain: -16.25 };
  }
}
