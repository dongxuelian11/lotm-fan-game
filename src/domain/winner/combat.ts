import { computeCheckChance } from '../../resolution/normal-check.js';
import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { LuckyPassiveLuck } from '../lucky/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasWinnerDisputeOpponent } from './encounter.js';
import type { WinnerLuckPolicy } from './types.js';
export type { WinnerLuckPolicy } from './types.js';

/** Winner S5 finite reserve, costs, counts and effects are explicit G. */
export const WINNER_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 12 }),
  Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 23 }),
  Object.freeze({ id: '5', label: '5次', weight: 14 }),
  Object.freeze({ id: '6', label: '6次', weight: 6 }),
]);
export type WinnerMoveId = 'BODY_STRIKE' | 'BODY_FOLLOWUP' | 'wheel.s5.luck-reserve'
  | 'wheel.s5.ill-fortune' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly { id: WinnerMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'BODY_STRIKE', label: '继承普通身体打击（H；18×身体；0消耗）', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承计算与精确身体次击（J；22.75×计算掌握×身体；0消耗）', weight: 15, stance: 'ATTACK' },
  { id: 'wheel.s5.luck-reserve', label: '有限好运自保（B；选用时首个合格B/K耗1积运与2灵性；否则继承3灵性预警）', weight: 20, stance: 'DEFEND' },
  { id: 'wheel.s5.ill-fortune', label: '有限敌方厄运（K；选用时首个合格B/K耗1积运与2灵性、知识14；否则继承3灵性精神风暴）', weight: 20, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '观察眼前原现场与本人实际积运（R；0贡献、0消耗）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '施术或动作偏差（A；固定−22.5；0消耗，不另掷正负）', weight: 5, stance: null },
];
export function isWinner(s: SliceState): boolean {
  return s.progression?.pathwayId === 'wheel' && s.progression.sequence === 5;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
}
export function winnerAbilityWheel(stance: SliceStance | null, s?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((a, i) => ({ id: a.id,
    label: a.id === 'BODY_STRIKE' && s?.town.clubLocation === 'HAND'
      ? '持握原短棍打击（H；16×身体替换本次主攻；0消耗）' : a.label,
    weight: total === 400 ? weights[i]! / 4 : weights[i]! / total * 100 }));
}
export function drawWinnerAbility(random: ActionRandomStream, stance: SliceStance | null): WinnerMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let i = 0; i < ABILITIES.length; i += 1) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('赢家能力盘权重无效');
}
export function winnerActionCount(roll: number): number {
  return roll <= 12 ? 1 : roll <= 32 ? 2 : roll <= 57 ? 3 : roll <= 80 ? 4 : roll <= 94 ? 5 : 6;
}
export interface WinnerCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'WINNER_DISPUTE'; attemptWeek: number; startHistoryIndex: number;
  target: 'ALDRY_SINGLE_ADULT_ORDINARY_HUMAN'; nature: 'ORDINARY_HUMAN';
  body: 'CURRENT_REACHABLE_BODY'; weapon: 'ALDRYS_OWN_ORDINARY_SHORT_CLUB'; weaponLocation: 'HAND';
  space: 'ORIGINAL_GUIDANCE_ROOM_INDEPENDENT_OUTER_YARD'; visibility: 'MUTUALLY_VISIBLE';
  distanceMetres: 2; ground: 'CLEAR_ORDINARY_GROUND'; daylight: true; bystanders: 'NONE';
  exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false; looseObjectSource: false; disasterTrigger: false;
}
export function currentWinnerCombatSource(s: SliceState): WinnerCombatSource | null {
  if (!hasWinnerDisputeOpponent(s)) return null;
  return { runId: s.runId, revision: s.revision, week: s.week, round: s.combat!.round,
    encounterId: 'WINNER_DISPUTE', attemptWeek: s.week, startHistoryIndex: s.winner.encounter.startHistoryIndex!,
    target: 'ALDRY_SINGLE_ADULT_ORDINARY_HUMAN', nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY',
    weapon: 'ALDRYS_OWN_ORDINARY_SHORT_CLUB', weaponLocation: 'HAND', space: 'ORIGINAL_GUIDANCE_ROOM_INDEPENDENT_OUTER_YARD',
    visibility: 'MUTUALLY_VISIBLE', distanceMetres: 2, ground: 'CLEAR_ORDINARY_GROUND', daylight: true,
    bystanders: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false, looseObjectSource: false, disasterTrigger: false };
}
function validSource(s: SliceState, source: WinnerCombatSource | null): boolean {
  const current = currentWinnerCombatSource(s);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
function masteryFactor(s: SliceState,
  id: 'wheel.s8.calculation-control' | 'wheel.s6.disaster-awareness' | 'wheel.s6.mental-storm' | 'wheel.s7.passive-luck',
): number {
  const m = s.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(m) ? m : 0)) / 500;
}
function physicalFactor(value: number): number { return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0; }
function spendSpirituality(s: SliceState, amount: number): boolean {
  if (!Number.isFinite(s.spirituality) || s.spirituality < amount) return false;
  s.spirituality -= amount; return true;
}
function spendLuck(s: SliceState, policy: WinnerLuckPolicy): boolean {
  const luck = s.winner.luck, e = s.winner.encounter;
  if (policy !== 'SPEND_FIRST' || e.lastLuckRound === s.combat!.round ||
      !Number.isSafeInteger(luck.stored) || luck.stored < 1 || luck.stored > 3 ||
      !Number.isSafeInteger(luck.accumulated) || !Number.isSafeInteger(luck.spent) || luck.spent < 0 ||
      luck.stored !== luck.accumulated - luck.spent || luck.lastAccumulateWeek === null ||
      !Number.isSafeInteger(luck.lastAccumulateWeek) || luck.lastAccumulateWeek > s.week ||
      !spendSpirituality(s, 2)) return false;
  luck.stored -= 1; luck.spent += 1; e.lastLuckRound = s.combat!.round; return true;
}
/** Inherited S7 behavior has a new exact scene gate. It never consumes or forces stored luck. */
export function drawWinnerPassiveLuck(
  s: SliceState, stance: SliceStance, physicalStateFactor: number, random: ActionRandomStream,
  source: WinnerCombatSource | null = currentWinnerCombatSource(s),
): LuckyPassiveLuck | null {
  if (stance === 'RETREAT' || !validSource(s, source)) return null;
  const roll = random.nextInt(1, 100), triggered = roll <= 25;
  return { roll, triggered, bonus: triggered ? 45 * masteryFactor(s, 'wheel.s7.passive-luck') * physicalFactor(physicalStateFactor) : 0 };
}
export interface WinnerCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
function noEffect(label: string): WinnerCombatEffect { return { label, selfGain: 0, enemyReduction: 0, threatens: false }; }
export function consumeWinnerStagger(
  s: SliceState, id: string, contribution: number, suppressed = false,
  source: WinnerCombatSource | null = currentWinnerCombatSource(s),
): { physicalMultiplier: number; label: string } | null {
  if (id !== 'STRIKE' || suppressed || !Number.isFinite(contribution) || contribution <= 0 ||
      !s.winner.encounter.staggerReady || !validSource(s, source)) return null;
  s.winner.encounter.staggerReady = false;
  return { physicalMultiplier: 0.5, label: '已成功的有限厄运仅使奥德里这一次实际普通打击落点偏移，正贡献×0.5（G）后结束；没有重抽敌方行动、不取消打击、不自动伤害健康或强制投降' };
}
export function finishWinnerCombatRound(s: SliceState): string | null {
  const pending = s.winner.encounter.staggerReady; s.winner.encounter.staggerReady = false;
  return pending ? '本轮结束，尚未作用于实际正贡献普通打击的有限厄运已到期，不能追补减势或带到下一轮；实付积运与灵性不退回，未用积运仍保留。' : null;
}
/** B/K share one voluntary paid reserve attempt per actual round; all other slots cannot spend it. */
export function resolveWinnerCombatAbility(
  s: SliceState, id: WinnerMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: WinnerCombatSource | null = currentWinnerCombatSource(s), policy: WinnerLuckPolicy = 'HOLD',
): WinnerCombatEffect {
  if (policy !== 'HOLD' && policy !== 'SPEND_FIRST') throw new TypeError('积运策略无效');
  if (!validSource(s, source)) return noEffect('赢家行动缺少本场实际存活的奥德里原身体、日光外院与收束来源；0贡献、0消耗、不重抽，不能借旧对手、假目标或制造灾源');
  const physical = physicalFactor(physicalStateFactor);
  switch (id) {
    case 'BODY_STRIKE': {
      const club = s.town.clubLocation === 'HAND', selfGain = (club ? 16 : 18) * physical;
      return { label: club ? '持握原短棍打击：实际手持自己的原短棍，以16×当前身体替换本次主攻（G），0消耗，不同时叠加身体或灾祸预算'
        : '继承普通身体打击：18×当前身体（G），0消耗，不假造进攻灾祸或必中，真实伤势仍由共同后果盘结算',
      selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 22.75 * masteryFactor(s, 'wheel.s8.calculation-control') * physical;
      return { label: '继承计算与精确身体次击：22.75×原计算与控制掌握×当前身体（G），0消耗；独立占本次行动，不附赠攻击或物件', selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'wheel.s5.luck-reserve':
      if (spendLuck(s, policy)) return { ...noEffect(`有限好运自保：实际耗1积运与2灵性，剩余${s.winner.luck.stored}/3；本槽减轻眼前真实攻击压力24（G），本轮B/K不再用积运，不治疗、不取消敌方行动或保证无伤`), enemyReduction: 24 };
      if (spendSpirituality(s, 3)) return { ...noEffect('继承当前攻击有限预警与避让：未使用积运，本槽实际耗3灵性，42.25×原灾祸觉察掌握×当前身体（G）；不读取下一随机结果，不取消敌方行动或保证无伤'), enemyReduction: 42.25 * masteryFactor(s, 'wheel.s6.disaster-awareness') * physical };
      return { ...noEffect('资源不足：普通格挡8×当前身体（赢家G），0消耗，不透支或凭空补充积运'), enemyReduction: 8 * physical };
    case 'wheel.s5.ill-fortune': {
      if (!spendLuck(s, policy)) {
        if (spendSpirituality(s, 3)) return { ...noEffect('继承有限精神风暴：未使用积运，本槽实际耗3灵性，42.25×原精神风暴掌握（G），不乘身体；只减少眼前真实普通对手战势，不附赠身体伤害、不控制意愿或重抽'), enemyReduction: 42.25 * masteryFactor(s, 'wheel.s6.mental-storm') };
        return noEffect('资源不足：普通观察与走位0贡献、0消耗，不假造精神风暴或厄运，不透支积运');
      }
      const chance = computeCheckChance({ ability: 'knowledge', baseAbility: s.character.coreStats.knowledge, difficulty: 14, modifiers: [] });
      const roll = random.nextInt(1, 100), success = roll <= chance;
      if (success) s.winner.encounter.staggerReady = true;
      return noEffect(success
        ? `有限敌方厄运成功：实际耗1积运与2灵性，知识14判定${roll}≤${chance}；仅本轮下一次实际正贡献普通打击×0.5（G），0即时贡献，不重抽、不追改先前动作、不保证后续有打击或获胜`
        : `有限敌方厄运失败：实际耗1积运与2灵性，知识14判定${roll}>${chance}；0贡献、没有迟疑效果，本轮尝试已用，不退费或重抽`);
    }
    case 'OBSERVE': return noEffect(`观察眼前原现场与本人积运：奥德里持自己的原普通短棍，日光外院净空、原出口可退出；当前积运${s.winner.luck.stored}/3，累计实际用去${s.winner.luck.spent}。0贡献、0消耗，不积运、不预测未来票或制造灾源`);
    case 'ACCIDENT': return { ...noEffect('施术或动作偏差：本次自身优势固定−22.5（赢家G），0消耗；现有积运不自动抵消，不另掷正负或事后重抽，不构成致伤攻击'), selfGain: -22.5 };
  }
}
