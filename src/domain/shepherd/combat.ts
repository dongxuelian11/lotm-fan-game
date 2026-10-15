import { computeCheckChance } from '../../resolution/normal-check.js';
import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { SHEPHERD_SPIRITS } from './content.js';
import type { ShepherdSpiritState } from './types.js';
import { hasShepherdDisputeOpponent } from './encounter.js';

/** All six-slot weights, finite budgets, costs and check thresholds are explicit G. */
export const SHEPHERD_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 12 }), Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }), Object.freeze({ id: '4', label: '4次', weight: 23 }),
  Object.freeze({ id: '5', label: '5次', weight: 14 }), Object.freeze({ id: '6', label: '6次', weight: 6 }),
]);
export type ShepherdMoveId = 'hanged-man.s5.borrowed-arts' | 'BODY_FOLLOWUP' | 'BORROWED_WARD'
  | 'BORROWED_CONTROL' | 'CHECK_GRAZING' | 'ACCIDENT';
const ABILITIES: readonly { id: ShepherdMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'hanged-man.s5.borrowed-arts', label: '当前原灵已选冲力2灵性／本人原棍或继承血肉近击（H；G）', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承本人强化身体次击（J；G27.3×旧掌握×身体，0消耗）', weight: 15, stance: 'ATTACK' },
  { id: 'BORROWED_WARD', label: '当前原灵已选防护2灵性／继承自身有限修复或普通格挡（B；G）', weight: 20, stance: 'DEFEND' },
  { id: 'BORROWED_CONTROL', label: '当前原灵已选模糊或勇气歌声（K；G2灵性、知识14；只用一灵）', weight: 20, stance: 'CONTROL' },
  { id: 'CHECK_GRAZING', label: '复核当前原灵、已选方法与原储备（R；0贡献、0消耗，不切灵或补充）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '借用或动作偏差（A；G固定−22.5，不另掷正负）', weight: 5, stance: null },
];
export function isShepherd(s: SliceState): boolean { return s.progression?.pathwayId === 'hanged-man' && s.progression.sequence === 5; }
function tickets(stance: SliceStance | null): number[] { return ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4)); }
export function shepherdAbilityWheel(stance: SliceStance | null, _state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, n) => sum + n, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: total === 400 ? weights[i]! / 4 : weights[i]! / total * 100 }));
}
export function drawShepherdAbility(random: ActionRandomStream, stance: SliceStance | null): ShepherdMoveId {
  const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((sum, n) => sum + n, 0));
  for (let i = 0; i < ABILITIES.length; i += 1) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('牧羊人能力盘权重无效');
}
export function shepherdActionCount(roll: number): number { return roll <= 12 ? 1 : roll <= 32 ? 2 : roll <= 57 ? 3 : roll <= 80 ? 4 : roll <= 94 ? 5 : 6; }

/** The actual adult opponent and original courtyard, bound to this paid arrival and current round. */
export interface ShepherdCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'SHEPHERD_DISPUTE'; attemptWeek: number; startHistoryIndex: number;
  target: 'ELTON_SINGLE_ADULT_ORDINARY_HUMAN'; nature: 'ORDINARY_HUMAN'; body: 'CURRENT_REACHABLE_BODY';
  weapon: 'ELTONS_OWN_ORDINARY_SHORT_CLUB'; space: 'ORIGINAL_SHEPHERD_EMPTY_COURTYARD';
  visibility: 'MUTUALLY_VISIBLE'; daylight: true; usableConcealmentShade: false;
  distanceMetres: 2; ground: 'CLEAR_ORDINARY_GROUND'; bystanders: 'NONE'; ally: 'NONE';
  exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
}
export function currentShepherdCombatSource(s: SliceState): ShepherdCombatSource | null {
  if (!hasShepherdDisputeOpponent(s)) return null;
  return { runId: s.runId, revision: s.revision, week: s.week, round: s.combat!.round,
    encounterId: 'SHEPHERD_DISPUTE', attemptWeek: s.shepherd.encounter.attemptWeek!, startHistoryIndex: s.shepherd.encounter.startHistoryIndex!,
    target: 'ELTON_SINGLE_ADULT_ORDINARY_HUMAN', nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY',
    weapon: 'ELTONS_OWN_ORDINARY_SHORT_CLUB', space: 'ORIGINAL_SHEPHERD_EMPTY_COURTYARD',
    visibility: 'MUTUALLY_VISIBLE', daylight: true, usableConcealmentShade: false,
    distanceMetres: 2, ground: 'CLEAR_ORDINARY_GROUND', bystanders: 'NONE', ally: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false };
}
function validSource(s: SliceState, source: ShepherdCombatSource | null): boolean {
  const current = currentShepherdCombatSource(s);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
/** Read afresh for every slot. Stored mastery, empty capacity, or another soul never grants a method. */
function activeSpirit(s: SliceState): ShepherdSpiritState | null {
  const g = s.shepherd.grazing;
  if (!isShepherd(s) || !g.met || g.activeSpiritId === null || !Array.isArray(g.spirits) ||
      g.spirits.length !== SHEPHERD_SPIRITS.length || new Set(g.spirits.map(x => x.id)).size !== g.spirits.length ||
      !g.spirits.every(x => SHEPHERD_SPIRITS.some(origin => origin.id === x.id))) return null;
  const spirit = g.spirits.find(x => x.id === g.activeSpiritId), origin = SHEPHERD_SPIRITS.find(x => x.id === spirit?.id);
  if (!spirit || !origin || spirit.status !== 'GRAZED' || spirit.releasedWeek !== null ||
      !Number.isSafeInteger(spirit.acquiredWeek) || spirit.acquiredWeek === null || spirit.acquiredWeek < 1 || spirit.acquiredWeek > s.week ||
      !Number.isSafeInteger(spirit.attemptWeek) || spirit.attemptWeek !== spirit.acquiredWeek ||
      s.shepherd.promotionWeek === null || spirit.acquiredWeek < s.shepherd.promotionWeek ||
      !Array.isArray(spirit.selectedAbilities) || spirit.selectedAbilities.length < 1 || spirit.selectedAbilities.length > 3 ||
      new Set(spirit.selectedAbilities).size !== spirit.selectedAbilities.length ||
      !spirit.selectedAbilities.every(id => origin.knownAbilities.some(a => a.id === id))) return null;
  return spirit;
}
function masteryFactor(value: number): number { return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(value) ? value : 0)) / 500; }
function learnedFactor(s: SliceState, id: string): number { return masteryFactor(s.progression.mastery[id] ?? 0); }
function canPay(s: SliceState, amount: number): boolean { return Number.isFinite(s.spirituality) && s.spirituality >= amount; }
/** Unchanged inherited reserve: only already consumed real packets may back points. */
function availableReserve(s: SliceState): number {
  const r = s.roseBishop.reserve;
  if (r.max !== 3 || !Number.isSafeInteger(r.points) || r.points < 0 || r.points > r.max ||
      !Number.isSafeInteger(r.packetsBought) || r.packetsBought !== r.packets.length ||
      new Set(r.packets.map(p => p.id)).size !== r.packets.length ||
      !r.packets.every(p => /^rose-bishop-ration-[1-9]\d*$/.test(p.id) &&
        Number.isSafeInteger(p.acquiredWeek) && p.acquiredWeek >= 1 && p.acquiredWeek <= s.week &&
        (p.status === 'HELD' ? p.consumedWeek === null : p.status === 'CONSUMED' &&
          Number.isSafeInteger(p.consumedWeek) && p.consumedWeek! >= p.acquiredWeek && p.consumedWeek! <= s.week)) ||
      r.packets.filter(p => p.status === 'CONSUMED').length < r.points) return 0;
  return r.points;
}
function spendReserve(s: SliceState, amount: number): boolean {
  if (availableReserve(s) < 1 || !canPay(s, amount)) return false;
  s.spirituality -= amount; s.roseBishop.reserve.points -= 1; return true;
}
export interface ShepherdCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
function noEffect(label: string): ShepherdCombatEffect { return { label, selfGain: 0, enemyReduction: 0, threatens: false }; }

/** Finite blur is consumed by one later positive ordinary STRIKE, never by a blocked or missed slot. */
export function consumeShepherdBlur(
  s: SliceState, id: string, contribution: number, suppressed = false,
  source: ShepherdCombatSource | null = currentShepherdCombatSource(s),
): { physicalMultiplier: number; label: string } | null {
  if (id !== 'STRIKE' || suppressed || !Number.isFinite(contribution) || contribution <= 0 ||
      !s.shepherd.encounter.blurReady || !validSource(s, source)) return null;
  const spirit = activeSpirit(s);
  if (spirit?.id !== 'SH5-IRIS-1' || !spirit.selectedAbilities.includes('blur-mark')) return null;
  s.shepherd.encounter.blurReady = false;
  return { physicalMultiplier: 0.8, label: '已付费的伊芮斯原灵模糊标记作用于埃尔顿这一次原短棍打击，正贡献×0.8（G）并当次结束；不取消该槽、不控制思想、不额外伤人或召出身体' };
}
export function finishShepherdCombatRound(s: SliceState): string | null {
  const hadBlur = s.shepherd.encounter.blurReady; s.shepherd.encounter.blurReady = false;
  return hadBlur ? '本轮结束，未用的有限模糊标记实际结束；已付灵性不退回，已放牧原灵与当前选择保留，不带增益到下轮。' : null;
}
export function resolveShepherdCombatAbility(
  s: SliceState, id: ShepherdMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: ShepherdCombatSource | null = currentShepherdCombatSource(s),
): ShepherdCombatEffect {
  if (!validSource(s, source)) return noEffect('牧羊人行动缺少本场实际到场、仍可行动的埃尔顿原身体与原日光空院来源；0贡献、0消耗、不重抽、不借首案或旧维恩');
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  const spirit = activeSpirit(s), borrowed = learnedFactor(s, 'hanged-man.s5.borrowed-arts');
  const iris = (method: string) => spirit?.id === 'SH5-IRIS-1' && spirit.selectedAbilities.includes(method);
  const flesh = learnedFactor(s, 'hanged-man.s6.flesh-shaping');
  switch (id) {
    case 'hanged-man.s5.borrowed-arts': {
      if (iris('light-touch') && canPay(s, 2)) {
        s.spirituality -= 2;
        return { label: '借当前已放牧伊芮斯原灵SH5-IRIS-1实际已选微力触动：本人耗2灵性，G38.025×借用掌握，仅此一灵的一次有限冲击；不附加本人近击、不永久学会法术、不召出身体', selfGain: 38.025 * borrowed, enemyReduction: 0, threatens: true };
      }
      if (s.town.clubLocation === 'HAND') {
        const selfGain = 16 * physical;
        return { label: '当前原灵未选可支付冲力，使用本人实际持握原短棍16×身体（G）；0灵性、0储备，不取埃尔顿原棍、不额外借另一灵', selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      if (spendReserve(s, 2)) {
        const selfGain = 50.7 * flesh * physical;
        return { label: '当前原灵无可支付冲力，继承本人血肉近击：实际耗2灵性与1点已有原储备，G50.7×旧血肉掌握×身体；已食原包记录保留，不重新吞食或放牧原敌', selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      const selfGain = 12 * physical;
      return { label: '当前原灵无可支付冲力且本人血肉资源不足，普通身体打击G12×身体，0消耗；不透支、不借未知方法或另一原灵', selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 27.3 * flesh * physical;
      return { label: '继承本人强化身体次击：G27.3×旧血肉掌握×身体，0灵性、0储备，独立占本槽；不附加借灵攻击或生成身体部件', selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BORROWED_WARD':
      if (iris('brief-ward') && canPay(s, 2)) {
        s.spirituality -= 2;
        return { ...noEffect('借当前已放牧伊芮斯原灵SH5-IRIS-1实际已选短促防护：本人耗2灵性，G30×借用掌握进入共同减势；不附加自愈、不保证免伤、不借另一灵'), enemyReduction: 30 * borrowed };
      }
      if (s.health > 0 && s.health < 100 && spendReserve(s, 3)) {
        const before = s.health; s.health = Math.min(100, s.health + 10);
        return { ...noEffect(`当前原灵无可支付防护，继承本人有限自修复：耗3灵性与1点已有原储备，恢复${s.health - before}健康且不超过100，自身优势+8（G）；原伤势、累计风险与精神不变，不复活`), selfGain: 8 };
      }
      return { ...noEffect('当前原灵无可支付防护且无需或无资源自修复，普通格挡G10×身体，0消耗；不治疗或清除原伤势'), enemyReduction: 10 * physical };
    case 'BORROWED_CONTROL': {
      const blur = iris('blur-mark'), courage = spirit?.id === 'SH5-CEDRIC-1' && spirit.selectedAbilities.includes('courage-song');
      if (!blur && !courage) return noEffect('当前没有实际已放牧且选定模糊或勇气歌声的原灵：本人普通走位，0贡献、0灵性，不借另一灵、不使用未知方法');
      if (blur && s.shepherd.encounter.blurReady) return noEffect('当前伊芮斯原灵的已付模糊标记仍待下一正打击，不叠加、不刷新、不重复支付或判定');
      if (!canPay(s, 2)) return noEffect('不足2灵性，当前已选原灵方法不能尝试：本人普通走位，0贡献、0消耗，不透支或借用另一灵');
      s.spirituality -= 2;
      const chance = computeCheckChance({ ability: 'knowledge', baseAbility: s.character.coreStats.knowledge, difficulty: 14, modifiers: [] });
      const roll = random.nextInt(1, 100), success = roll <= chance;
      if (blur) {
        s.shepherd.encounter.blurReady = success;
        return noEffect(`借当前伊芮斯原灵SH5-IRIS-1已选模糊标记：本人耗2灵性，知识14判定${roll}/100、阈值${chance}（G）；${success ? '等待本轮下一次正贡献普通打击×0.8，0即时贡献，一用或本轮结束即止' : '模糊未成立，实付灵性不退回'}，不直接扣健康、控制思想或使人投降`);
      }
      return { ...noEffect(`借当前塞德里克原灵SH5-CEDRIC-1已选勇气歌声，由本人实际短促发声并当次停止：本人耗2灵性，知识14判定${roll}/100、阈值${chance}（G）；${success ? '仅自身优势+24×借用掌握' : '鼓舞未成立，实付灵性不退回'}，不构成攻击、不加健康、不强迫信仰或思想，不召出另一具身体`), selfGain: success ? 24 * borrowed : 0 };
    }
    case 'CHECK_GRAZING':
      return noEffect(`复核当前原灵${spirit ? `${spirit.id}、实际已选${spirit.selectedAbilities.join('、')}` : '无有效启用原灵'}与本人实际血肉储备${availableReserve(s)}点：0贡献、0消耗；不切灵、不放牧、不补满7容量、不增加掌握或额外抽盘`);
    case 'ACCIDENT': return { ...noEffect('本次借用或动作偏差固定−22.5战势（G），0灵性、0储备，不另掷正负，不追加攻击、生成污染或吞灵'), selfGain: -22.5 };
  }
}
