import { computeCheckChance } from '../../resolution/normal-check.js';
import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasDesireApostleDisputeOpponent } from './encounter.js';

/** S5 counts, costs, finite seed lifetime and half-strike effect are explicit G. */
export const DESIRE_APOSTLE_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 12 }),
  Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 23 }),
  Object.freeze({ id: '5', label: '5次', weight: 14 }),
  Object.freeze({ id: '6', label: '6次', weight: 6 }),
]);
export type DesireApostleMoveId = 'abyss.s6.flame-hex' | 'BODY_FOLLOWUP' | 'abyss.s6.demonic-body'
  | 'abyss.s5.emotion-seed' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly { id: DesireApostleMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'abyss.s6.flame-hex', label: '继承有限火焰术（H；3灵性、1负荷；持原短棍则普通16替换）', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承本人强化身体次击（J；29.575×恶魔身体掌握×身体；0消耗）', weight: 15, stance: 'ATTACK' },
  { id: 'abyss.s6.demonic-body', label: '继承本槽有限硬皮抵挡（B；2灵性、1负荷；不足时普通格挡）', weight: 20, stance: 'DEFEND' },
  { id: 'abyss.s5.emotion-seed', label: '当前强烈情绪入口埋种（K；3灵性、知识14；后续K另耗2灵性催化）', weight: 20, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '观察当前公开情绪与本场种子状态（R；0灵性、0贡献）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '施术或动作偏差（A；固定−22.5；0灵性，不另掷正负）', weight: 5, stance: null },
];
export function isDesireApostle(s: SliceState): boolean {
  return s.progression?.pathwayId === 'abyss' && s.progression.sequence === 5;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
}
export function desireApostleAbilityWheel(stance: SliceStance | null, s?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((a, index) => ({ id: a.id,
    label: a.id === 'abyss.s6.flame-hex' && s?.town.clubLocation === 'HAND'
      ? '持握原短棍打击（H；普通16×当前身体替换火焰术；0灵性、不增加负荷）'
      : a.id === 'abyss.s5.emotion-seed' && s?.desireApostle.encounter.emotion === 'CALM'
      ? '当前费兰情绪平稳：缺少入口，普通观察0贡献、0灵性，不强制激怒'
      : a.id === 'abyss.s5.emotion-seed' && s?.desireApostle.encounter.seedPlanted
      ? '催化本场已埋原种子（K；当前仍须强烈情绪；2灵性、知识14；成功仅下一正打击×0.5）'
      : a.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawDesireApostleAbility(random: ActionRandomStream, stance: SliceStance | null): DesireApostleMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let i = 0; i < ABILITIES.length; i += 1) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('欲望使徒能力盘权重无效');
}
export function desireApostleActionCount(roll: number): number {
  return roll <= 12 ? 1 : roll <= 32 ? 2 : roll <= 57 ? 3 : roll <= 80 ? 4 : roll <= 94 ? 5 : 6;
}
/** This source proves this arrival only. Public emotion is always read afresh from the actual encounter. */
export interface DesireApostleCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'DESIRE_APOSTLE_DISPUTE'; attemptWeek: number; startHistoryIndex: number;
  target: 'FERRAN_SINGLE_ADULT_ORDINARY_HUMAN'; nature: 'ORDINARY_HUMAN';
  body: 'CURRENT_REACHABLE_BODY'; weapon: 'FERRANS_OWN_ORDINARY_SHORT_CLUB';
  space: 'ORIGINAL_GUIDANCE_ROOM_INDEPENDENT_OUTER_YARD'; visibility: 'MUTUALLY_VISIBLE';
  distanceMetres: 2; ground: 'CLEAR_ORDINARY_GROUND'; daylight: true; bystanders: 'NONE';
  exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false; qualifyingNearTermDeadlyPlan: false;
}
export function currentDesireApostleCombatSource(s: SliceState): DesireApostleCombatSource | null {
  if (!hasDesireApostleDisputeOpponent(s)) return null;
  return { runId: s.runId, revision: s.revision, week: s.week, round: s.combat!.round,
    encounterId: 'DESIRE_APOSTLE_DISPUTE', attemptWeek: s.week, startHistoryIndex: s.desireApostle.encounter.startHistoryIndex!,
    target: 'FERRAN_SINGLE_ADULT_ORDINARY_HUMAN', nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY',
    weapon: 'FERRANS_OWN_ORDINARY_SHORT_CLUB', space: 'ORIGINAL_GUIDANCE_ROOM_INDEPENDENT_OUTER_YARD',
    visibility: 'MUTUALLY_VISIBLE', distanceMetres: 2, ground: 'CLEAR_ORDINARY_GROUND', daylight: true,
    bystanders: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false, qualifyingNearTermDeadlyPlan: false };
}
function validSource(s: SliceState, source: DesireApostleCombatSource | null): boolean {
  const current = currentDesireApostleCombatSource(s);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
function masteryFactor(s: SliceState, id: 'abyss.s6.flame-hex' | 'abyss.s6.demonic-body'): number {
  const mastery = s.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}
function canPay(s: SliceState, amount: number): boolean { return Number.isFinite(s.spirituality) && s.spirituality >= amount; }
function spendDemon(s: SliceState, amount: number): boolean {
  if (!Number.isSafeInteger(s.demon.strain) || s.demon.strain < 0 || s.demon.strain >= 3 || !canPay(s, amount)) return false;
  s.spirituality -= amount; s.demon.strain += 1; return true;
}
export interface DesireApostleCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
function noEffect(label: string): DesireApostleCombatEffect { return { label, selfGain: 0, enemyReduction: 0, threatens: false }; }

/** Only Ferran's already-drawn, actually executed ordinary OPENING has this scene consequence. */
export function observeDesireApostleEnemyOpening(
  s: SliceState, id: string, suppressed = false, source: DesireApostleCombatSource | null = currentDesireApostleCombatSource(s),
): string | null {
  if (id !== 'OPENING' || suppressed || !validSource(s, source)) return null;
  s.desireApostle.encounter.emotion = 'CALM';
  return '稳住情绪后寻找空当：费兰实际放缓呼吸、放松紧绷的肩膀，并明确说自己先冷静看清落点；这是本场可见可闻的平复，保留普通寻找空当的8贡献。当前情绪平稳，后续埋种与催化缺少入口，不自动再次愤怒';
}
export function consumeDesireApostleStagger(
  s: SliceState, id: string, contribution: number, suppressed = false,
  source: DesireApostleCombatSource | null = currentDesireApostleCombatSource(s),
): { physicalMultiplier: number; label: string } | null {
  if (id !== 'STRIKE' || suppressed || !Number.isFinite(contribution) || contribution <= 0 ||
      !s.desireApostle.encounter.staggerReady || !validSource(s, source)) return null;
  s.desireApostle.encounter.staggerReady = false;
  return { physicalMultiplier: 0.5, label: '已成功的有限情绪催化使费兰这一次原普通打击出现短暂迟疑，正贡献×0.5（G）后结束；不取消行动、不自动伤害健康、不强制投降或持续控制意志' };
}
export function finishDesireApostleCombatRound(s: SliceState, continuing: boolean): string | null {
  const e = s.desireApostle.encounter;
  const hadStagger = e.staggerReady; e.staggerReady = false;
  const expired = e.seedPlanted && (!continuing || e.lastSeedRound === null ||
    (s.combat?.round ?? e.lastSeedRound) - e.lastSeedRound >= 1);
  if (expired || !continuing) e.seedPlanted = false;
  const labels: string[] = [];
  if (hadStagger) labels.push('本轮结束，尚未作用于正打击的短暂迟疑已到期，不能带到下一轮。');
  if (expired) labels.push(continuing ? '本作G种子的两轮窗口（埋种轮及下一轮）已结束，原种子失效。' : '本场结束，尚存的原种子已经清除，不能带离或继续催化费兰。');
  if (labels.length) labels.push('实际灵性消耗不退回，原伤势与最后一次埋种轮次记录保留。');
  return labels.length ? labels.join('') : null;
}
export function resolveDesireApostleCombatAbility(
  s: SliceState, id: DesireApostleMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: DesireApostleCombatSource | null = currentDesireApostleCombatSource(s),
): DesireApostleCombatEffect {
  if (!validSource(s, source)) return noEffect('欲望使徒行动缺少本场实际到场、仍可行动的费兰原身体与日光外院来源；0贡献、0消耗、不重抽，不借首案或莫顿替代');
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  const e = s.desireApostle.encounter;
  switch (id) {
    case 'abyss.s6.flame-hex': {
      if (s.town.clubLocation === 'HAND') {
        const selfGain = 16 * physical;
        return { label: '持握原短棍打击：16×当前身体系数替换本次主攻（G），0灵性、不增加负荷，不同时附加火焰术', selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      if (spendDemon(s, 3)) {
        const selfGain = 54.925 * masteryFactor(s, id);
        return { label: `继承有限火焰术：本槽实际耗3灵性、负荷增加1至${s.demon.strain}/3；沿用54.925×火焰术掌握（G），只产生本次物理致伤威胁，仍由共同战盘判定伤势与死亡；不制造持续环境火`, selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      const selfGain = 12 * physical;
      return { label: '灵性不足或负荷已达3：回退普通身体打击12×当前身体系数（G），0消耗、不透支，原负荷不自动清除', selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 29.575 * masteryFactor(s, 'abyss.s6.demonic-body') * physical;
      return { label: '继承本人强化身体次击：29.575×恶魔身体掌握×当前身体系数（G），0灵性、不增加负荷，独立占本次行动，不附赠攻击或持续巨大化', selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'abyss.s6.demonic-body':
      if (spendDemon(s, 2)) return { ...noEffect(`继承本槽有限硬皮抵挡：实际耗2灵性、负荷增加1至${s.demon.strain}/3；50.7×恶魔身体掌握×当前身体系数（G），随本槽结束，不持续巨大化、不治疗、不抹去原风险`), enemyReduction: 50.7 * masteryFactor(s, id) * physical };
      return { ...noEffect('灵性不足或负荷已达3：普通格挡10×当前身体系数（G），0消耗，不清除原负荷、旧伤或风险'), enemyReduction: 10 * physical };
    case 'abyss.s5.emotion-seed': {
      if (e.emotion !== 'STRONG') return noEffect('费兰当前情绪平稳，埋种与催化都缺少实际入口；普通观察0贡献、0灵性，不改变本人情绪、不重抽');
      const catalyzing = e.seedPlanted;
      if (!catalyzing && e.lastSeedRound === s.combat!.round) return noEffect('本轮已经尝试埋种，不能消费原种子后同轮重埋；普通观察0贡献、0灵性，不重抽');
      const cost = catalyzing ? 2 : 3;
      if (!canPay(s, cost)) return noEffect(`本次${catalyzing ? '催化' : '埋种'}需要${cost}灵性，当前不足；普通观察0贡献、0消耗，不伪造尝试或效果`);
      s.spirituality -= cost;
      const chance = computeCheckChance({ ability: 'knowledge', baseAbility: s.character.coreStats.knowledge, difficulty: 14, modifiers: [] });
      const roll = random.nextInt(1, 100), success = roll <= chance;
      if (catalyzing) {
        e.seedPlanted = false;
        if (success) e.staggerReady = true;
        return noEffect(success
          ? `情绪催化成功：当前费兰仍实际激动，耗2灵性、知识14判定${roll}≤${chance}；原种子已消耗，仅本轮下一次正贡献普通打击×0.5（G），不叠加、不立即伤害健康、不强迫投降`
          : `情绪催化失败：实际耗2灵性、知识14判定${roll}>${chance}；原种子已消耗，0贡献，无迟疑效果，不退回资源或重抽`);
      }
      e.lastSeedRound = s.combat!.round; e.seedPlanted = success;
      return noEffect(success
        ? `情绪埋种成功：当前费兰的强烈情绪有真实现场入口，耗3灵性、知识14判定${roll}≤${chance}；只埋入本场原种子，0即时贡献，不预付催化；须后续K另耗2灵性且当时仍有入口，两轮窗口为本作G`
        : `情绪埋种失败：实际耗3灵性、知识14判定${roll}>${chance}；本轮尝试已记录，没有种子、0贡献，不退费或同轮重试`);
    }
    case 'OBSERVE': return noEffect(`观察当前公开情绪与种子状态：费兰${e.emotion === 'STRONG' ? '仍有本场明确言语和可见激动表现' : '已实际平复，当前缺少催化入口'}；${e.seedPlanted ? '本场原种子尚在有限窗口' : '当前没有未用种子'}。0灵性、0贡献，不埋种、不催化、不读取隐秘思想或未来，不制造新情绪`);
    case 'ACCIDENT': return { ...noEffect('施术或动作偏差：本次自身优势固定−22.5（欲望使徒G），0灵性、不增加负荷，不另掷正负、不构成致伤攻击'), selfGain: -22.5 };
  }
}
