import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasDemonDisputeOpponent } from './encounter.js';

/** Demon S6 candidate: U65/P15, A1.3/E1.2. All budgets, costs and strain are G.
 * The finite flame slot is not guaranteed death, contagion or environmental fire.
 * The dispute supplies no qualifying near-term deadly plan for premonition. */
export const DEMON_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 10 }),
  Object.freeze({ id: '2', label: '2次', weight: 15 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 30 }),
  Object.freeze({ id: '5', label: '5次', weight: 20 }),
]);
export type DemonMoveId = 'abyss.s6.flame-hex' | 'BODY_FOLLOWUP' | 'abyss.s6.demonic-body'
  | 'POSITION' | 'abyss.s6.danger-premonition' | 'ACCIDENT';
const ABILITIES: readonly {
  id: DemonMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'abyss.s6.flame-hex', label: '有限火焰术（G；3灵性与1负荷，否则普通身体打击）', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '本人强化身体次击（G；29.575×恶魔身体掌握×身体，0消耗）', weight: 15, stance: 'ATTACK' },
  { id: 'abyss.s6.demonic-body', label: '本槽有限硬皮抵挡（G；2灵性与1负荷，否则普通格挡）', weight: 25, stance: 'DEFEND' },
  { id: 'POSITION', label: '原净空外院普通走位（G；6×身体，0消耗）', weight: 10, stance: 'CONTROL' },
  { id: 'abyss.s6.danger-premonition', label: '核对实际危险预感条件（本场无合格致命计划，0贡献）', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '施术或动作偏差（G；固定−16.25，不另掷正负）', weight: 5, stance: null },
];

export function isDemon(state: SliceState): boolean {
  return state.progression?.pathwayId === 'abyss' && state.progression.sequence === 6;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function demonAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'abyss.s6.flame-hex' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击（G；16×身体替换主攻，0灵性、不增加负荷）' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawDemonAbility(random: ActionRandomStream, stance: SliceStance | null): DemonMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('恶魔能力盘权重无效');
}
export function demonActionCount(roll: number): number {
  return roll <= 10 ? 1 : roll <= 25 ? 2 : roll <= 50 ? 3 : roll <= 80 ? 4 : 5;
}

/** The actual paid arrival, never a practice threat or the old FIRST_CASE. */
export interface DemonCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'DEMON_DISPUTE'; attemptWeek: number; startHistoryIndex: number;
  target: 'MORTON_SINGLE_ADULT_ORDINARY_HUMAN'; nature: 'ORDINARY_HUMAN';
  body: 'CURRENT_REACHABLE_BODY'; weapon: 'MORTONS_OWN_ORDINARY_SHORT_CLUB';
  space: 'ORIGINAL_OLD_GOODS_STORE_INDEPENDENT_OUTER_YARD'; visibility: 'MUTUALLY_VISIBLE';
  distanceMetres: 2; ground: 'CLEAR_ORDINARY_GROUND'; bystanders: 'NONE';
  exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false; qualifyingNearTermDeadlyPlan: false;
}
export function currentDemonCombatSource(state: SliceState): DemonCombatSource | null {
  const combat = state.combat, e = state.demon.encounter;
  if (!hasDemonDisputeOpponent(state) || !combat || state.demon.practice.body !== 'NORMAL' ||
      !['NONE', 'EXTINGUISHED'].includes(state.demon.practice.flame) ||
      !Number.isSafeInteger(combat.round) || combat.round < 1 ||
      !Number.isSafeInteger(state.revision) || state.revision < 0 ||
      !Number.isSafeInteger(state.week) || state.week < 1 || e.startHistoryIndex === null ||
      state.combatHistory.length - e.startHistoryIndex !== combat.round - 1 ||
      !state.combatHistory.slice(e.startHistoryIndex).every((round, index) =>
        round.round === index + 1 && round.winner !== null && round.retreat !== 'SUCCESS')) return null;
  return { runId: state.runId, revision: state.revision, week: state.week, round: combat.round,
    encounterId: 'DEMON_DISPUTE', attemptWeek: state.week, startHistoryIndex: e.startHistoryIndex,
    target: 'MORTON_SINGLE_ADULT_ORDINARY_HUMAN', nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY',
    weapon: 'MORTONS_OWN_ORDINARY_SHORT_CLUB', space: 'ORIGINAL_OLD_GOODS_STORE_INDEPENDENT_OUTER_YARD',
    visibility: 'MUTUALLY_VISIBLE', distanceMetres: 2, ground: 'CLEAR_ORDINARY_GROUND',
    bystanders: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false, qualifyingNearTermDeadlyPlan: false };
}
function validSource(state: SliceState, source: DemonCombatSource | null): boolean {
  const current = currentDemonCombatSource(state);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
function masteryFactor(state: SliceState, id: 'abyss.s6.flame-hex' | 'abyss.s6.demonic-body'): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}
function spend(state: SliceState, spirituality: number): boolean {
  if (!Number.isSafeInteger(state.demon.strain) || state.demon.strain < 0 || state.demon.strain >= 3 ||
      !Number.isFinite(state.spirituality) || state.spirituality < spirituality) return false;
  state.spirituality -= spirituality;
  state.demon.strain += 1;
  return true;
}
export interface DemonCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): DemonCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/** Slots pay immediately and never persist giant form, fire or immunity. */
export function resolveDemonCombatAbility(
  state: SliceState, id: DemonMoveId, physicalStateFactor: number, _random: ActionRandomStream,
  source: DemonCombatSource | null = currentDemonCombatSource(state),
): DemonCombatEffect {
  if (!validSource(state, source)) {
    return noEffect('恶魔行动：缺少本场实际到场、正常本人身体、已熄练习火与仍可行动的莫顿来源；0贡献、0灵性、不增加负荷、不重抽');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'abyss.s6.flame-hex': {
      if (state.town.clubLocation === 'HAND') {
        const selfGain = 16 * physical;
        return { label: '持握原短棍打击：实际手持镇上原短棍，以16×当前身体系数替换本次主攻（G）；0灵性、不增加负荷，不同时附加火焰术',
          selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      if (spend(state, 3)) {
        const selfGain = 54.925 * masteryFactor(state, id);
        return { label: `有限火焰术：本槽实际耗3灵性、负荷增加1至${state.demon.strain}/3；54.925×火焰术掌握（G），只产生本次物理致伤威胁，仍走共同胜负与伤势盘。失败也付成本，不保证死亡、不传染、不制造持续环境火`,
          selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      const selfGain = 12 * physical;
      return { label: '灵性不足或负荷已达3：回退普通身体打击12×当前身体系数（G），0消耗、不透支；负荷不自动清除，不强迫攻击旁人',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 29.575 * masteryFactor(state, 'abyss.s6.demonic-body') * physical;
      return { label: '本人强化身体次击：29.575×恶魔身体掌握×当前身体系数（序列6身体成长G），0灵性、不增加负荷；独立占本次行动，不附赠攻击或持续巨大化',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'abyss.s6.demonic-body':
      if (spend(state, 2)) {
        return { ...noEffect(`本槽有限硬皮抵挡：实际耗2灵性、负荷增加1至${state.demon.strain}/3；50.7×恶魔身体掌握×当前身体系数（G）。本人短时撑护随本槽结束，不形成持续巨大化或全类型免疫，不治疗，不抹去旧伤和风险`),
          enemyReduction: 50.7 * masteryFactor(state, id) * physical };
      }
      return { ...noEffect('灵性不足或负荷已达3：普通格挡10×当前身体系数（G），0消耗；不硬化、不治疗、不清除负荷、旧伤或风险'),
        enemyReduction: 10 * physical };
    case 'POSITION':
      return { ...noEffect('原净空外院普通走位牵制6×当前身体系数（G），0灵性、不增加负荷；莫顿仍自行行动，没有序列5情绪或欲望控制'),
        enemyReduction: 6 * physical };
    case 'abyss.s6.danger-premonition':
      return noEffect('核对实际危险预感条件：眼前普通冲突没有已设定的近期致命计划，不符合本场预感来源；0贡献、0灵性、不增加负荷、不额外抽取。练习威胁记录不能证明莫顿有杀意，也不预知尚未抽取的胜负或伤势');
    case 'ACCIDENT':
      return { ...noEffect('施术或动作偏差：本次自身优势固定−16.25（恶魔候选G），0灵性、不增加负荷；不另掷正负、不构成致伤攻击，不触发自动疯狂或攻击他人'), selfGain: -16.25 };
  }
}
