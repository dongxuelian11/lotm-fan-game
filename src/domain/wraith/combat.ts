import { computeCheckChance } from '../../resolution/normal-check.js';
import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveReasonSacrifice, type MadmanRoundPolicy } from '../madman/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasWraithDisputeOpponent } from './encounter.js';

/** All exact budgets, costs, checks and residual hesitation here are finite G.
 * Every spirit transition ends in this same selected action, before another slot. */
export const WRAITH_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 12 }),
  Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 23 }),
  Object.freeze({ id: '5', label: '5次', weight: 14 }),
  Object.freeze({ id: '6', label: '6次', weight: 6 }),
]);
export type WraithMoveId = 'SPIRIT_STRIKE' | 'BODY_FOLLOWUP' | 'GHOST_DODGE'
  | 'chained.s5.spirit-possession' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly { id: WraithMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'SPIRIT_STRIKE', label: '有限灵体打击（H；3灵性；持原短棍则普通16替换）', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承本人强化身体次击（J；29.575×钢铁身体掌握×身体；0消耗）', weight: 15, stance: 'ATTACK' },
  { id: 'GHOST_DODGE', label: '本槽短暂灵化避让并显形（B；2灵性；有限减势17.55）', weight: 20, stance: 'DEFEND' },
  { id: 'chained.s5.spirit-possession', label: '有限附身并当次退出（K；3灵性、知识14；每轮一次尝试）', weight: 20, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '核实当前反光条件与原出口（R；0灵性、0贡献）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '灵化或动作偏差（A；固定−22.5；0灵性，不另掷正负）', weight: 5, stance: null },
];
export function isWraith(s: SliceState): boolean {
  return s.progression?.pathwayId === 'chained' && s.progression.sequence === 5;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
}
export function wraithAbilityWheel(stance: SliceStance | null, s?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((a, index) => ({ id: a.id,
    label: a.id === 'SPIRIT_STRIKE' && s?.town.clubLocation === 'HAND'
      ? '持握原短棍打击（H；普通16×当前身体替换灵体打击；0灵性、不叠加）' : a.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawWraithAbility(random: ActionRandomStream, stance: SliceStance | null): WraithMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let i = 0; i < ABILITIES.length; i += 1) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('怨魂能力盘权重无效');
}
export function wraithActionCount(roll: number): number {
  return roll <= 12 ? 1 : roll <= 32 ? 2 : roll <= 57 ? 3 : roll <= 80 ? 4 : roll <= 94 ? 5 : 6;
}
/** The actual Bevan encounter only: the indoor practice mirrors are not arena endpoints. */
export interface WraithCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'WRAITH_DISPUTE'; attemptWeek: number; startHistoryIndex: number;
  target: 'BEVAN_SINGLE_ADULT_ORDINARY_HUMAN'; nature: 'ORDINARY_HUMAN';
  body: 'CURRENT_REACHABLE_BODY'; weapon: 'BEVANS_OWN_ORDINARY_SHORT_CLUB'; weaponLocation: 'HAND';
  space: 'ORIGINAL_WORKSHOP_INDEPENDENT_OUTER_YARD'; visibility: 'MUTUALLY_VISIBLE';
  distanceMetres: 2; ground: 'CLEAR_ORDINARY_GROUND'; daylight: true; bystanders: 'NONE';
  exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false; secondReflectiveEndpoint: 'NONE_REGISTERED';
}
export function currentWraithCombatSource(s: SliceState): WraithCombatSource | null {
  if (!hasWraithDisputeOpponent(s)) return null;
  return { runId: s.runId, revision: s.revision, week: s.week, round: s.combat!.round,
    encounterId: 'WRAITH_DISPUTE', attemptWeek: s.week, startHistoryIndex: s.wraith.encounter.startHistoryIndex!,
    target: 'BEVAN_SINGLE_ADULT_ORDINARY_HUMAN', nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY',
    weapon: 'BEVANS_OWN_ORDINARY_SHORT_CLUB', weaponLocation: 'HAND', space: 'ORIGINAL_WORKSHOP_INDEPENDENT_OUTER_YARD',
    visibility: 'MUTUALLY_VISIBLE', distanceMetres: 2, ground: 'CLEAR_ORDINARY_GROUND', daylight: true,
    bystanders: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false, secondReflectiveEndpoint: 'NONE_REGISTERED' };
}
function validSource(s: SliceState, source: WraithCombatSource | null): boolean {
  const current = currentWraithCombatSource(s);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
function masteryFactor(s: SliceState, id: 'chained.s5.spirit-possession' | 'chained.s6.steel-body'): number {
  const mastery = s.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}
function spend(s: SliceState, amount: number): boolean {
  if (!Number.isFinite(s.spirituality) || s.spirituality < amount) return false;
  s.spirituality -= amount; return true;
}
export interface WraithCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
function noEffect(label: string): WraithCombatEffect { return { label, selfGain: 0, enemyReduction: 0, threatens: false }; }
export function consumeWraithStagger(
  s: SliceState, id: string, contribution: number, suppressed = false,
  source: WraithCombatSource | null = currentWraithCombatSource(s),
): { physicalMultiplier: number; label: string } | null {
  if (id !== 'STRIKE' || suppressed || !Number.isFinite(contribution) || contribution <= 0 ||
      !s.wraith.encounter.staggerReady || !validSource(s, source)) return null;
  s.wraith.encounter.staggerReady = false;
  return { physicalMultiplier: 0.5, label: '先前附身已实际退出，贝文残留的一次动作迟疑使这次原普通打击正贡献×0.5（G）后结束；没有持续占据身体、取消行动或改写意志' };
}
export function finishWraithCombatRound(s: SliceState): string | null {
  const hadStagger = s.wraith.encounter.staggerReady;
  s.wraith.encounter.staggerReady = false;
  return hadStagger ? '本轮结束，附身早已在当次动作中退出；尚未作用于正打击的残留迟疑到期，不能带到下一轮或带离现场。实付灵性不退回。' : null;
}
export function resolveWraithCombatAbility(
  s: SliceState, id: WraithMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: WraithCombatSource | null = currentWraithCombatSource(s),
  roundPolicy: MadmanRoundPolicy = { policy: 'HOLD', triggered: false, mentalCost: 0, spiritualCost: 0 },
): WraithCombatEffect {
  if (!validSource(s, source)) return noEffect('怨魂行动缺少本场实际到场、仍可抵抗的贝文原身体与原外院，或满月虚弱、练习未收束；0贡献、0消耗、不重抽，不借旧对手替代');
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  const e = s.wraith.encounter;
  switch (id) {
    case 'SPIRIT_STRIKE': {
      if (s.town.clubLocation === 'HAND') {
        const burst = resolveReasonSacrifice(s, 16 * physical, roundPolicy);
        return { label: '持握原短棍打击：16×当前身体系数替换本次主攻（G），本槽基础0灵性，不同时叠加灵体打击，不取得贝文的原棍' + burst.label,
          selfGain: burst.selfGain, enemyReduction: 0, threatens: burst.selfGain > 0 };
      }
      if (spend(s, 3)) {
        const selfGain = 54.925 * masteryFactor(s, 'chained.s5.spirit-possession');
        return { label: '有限灵体打击：本槽实际耗3灵性，54.925×灵化附身掌握（G），不乘身体系数；灵魂受创可能造成真实健康伤势，仍由共同胜负、伤势与死亡盘结算，目标可以抵抗，不直接扣健康或必然秒杀；当次施术已收束，本人完整显形',
          selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      const burst = resolveReasonSacrifice(s, 12 * physical, roundPolicy);
      return { label: '灵性不足3：回退普通身体打击12×当前身体系数（G），本槽基础0消耗、不透支，不形成灵体攻击' + burst.label,
        selfGain: burst.selfGain, enemyReduction: 0, threatens: burst.selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const burst = resolveReasonSacrifice(s, 29.575 * masteryFactor(s, 'chained.s6.steel-body') * physical, roundPolicy);
      return { label: '继承本人强化身体次击：29.575×钢铁身体掌握×当前身体系数（G），本槽基础0灵性，独立占本次行动，不附赠攻击或常驻免伤' + burst.label,
        selfGain: burst.selfGain, enemyReduction: 0, threatens: burst.selfGain > 0 };
    }
    case 'GHOST_DODGE':
      if (spend(s, 2)) return { ...noEffect('本槽短暂灵化避让：实际耗2灵性，有限减势17.55（G）；本人实际转为灵体避让后在同一动作内完整显形，原地没有留下另一具身体，不跨槽无敌、不穿越任意障碍或调用练习镜面，不治疗旧伤'), enemyReduction: 17.55 };
      return { ...noEffect('灵性不足2：普通格挡8×当前身体系数（G），0消耗；没有灵化或持续免伤'), enemyReduction: 8 * physical };
    case 'chained.s5.spirit-possession': {
      if (e.lastPossessionRound === s.combat!.round) return noEffect('本轮已经尝试附身并退出，不能同轮反复附身；普通观察0贡献、0灵性，不重抽');
      if (!spend(s, 3)) return noEffect('本次有限附身需要3灵性，当前不足；普通观察0贡献、0消耗，不伪造尝试或占据');
      e.lastPossessionRound = s.combat!.round;
      const chance = computeCheckChance({ ability: 'knowledge', baseAbility: s.character.coreStats.knowledge, difficulty: 14, modifiers: [] });
      const roll = random.nextInt(1, 100), success = roll <= chance;
      e.staggerReady = success;
      return noEffect(success
        ? `有限附身成功：实际耗3灵性、知识14判定${roll}≤${chance}；本人灵化进入2米外同一贝文，短暂使原持棍动作迟疑，随后在这一次K内明确退出并在原外院完整显形，没有另留原身体。只有残留动作迟疑使本轮下一正贡献普通打击×0.5（G），不是持续附身，不读记忆、不夺棍、不强制投降`
        : `有限附身失败：实际耗3灵性、知识14判定${roll}>${chance}；贝文实际抗拒并排斥本次进入，本人已在同一K内被排出并完整显形，没有留下占据或迟疑。0贡献、不退费、不重抽，不将高位格排斥或失败说成必然控制`);
    }
    case 'OBSERVE': return noEffect('核实原外院当前反光条件与身后原出口：本场没有登记可用的第二反光端点，室内练习原镜不在这处外院；0灵性、0贡献，只普通观察，不凭空镜跳、离场瞬移或搬运人物物件');
    case 'ACCIDENT': return { ...noEffect('灵化或动作偏差：本次自身优势固定−22.5（怨魂G），0灵性，不另掷正负、不构成致伤攻击，不留下未退出附身'), selfGain: -22.5 };
  }
}
