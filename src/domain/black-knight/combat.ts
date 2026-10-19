import { publicPryerFields } from '../sage/life.js';
import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { SHEPHERD_COUNT_WHEEL, shepherdActionCount } from '../shepherd/combat.js';
import { SHEPHERD_SPIRITS } from '../shepherd/content.js';
import type { ShepherdSpiritState } from '../shepherd/types.js';
import { BLACK_KNIGHT_TARGET_ID, BLACK_KNIGHT_POWERS, BLACK_KNIGHT_POWER_IDS, hasBlackKnightDisputeOpponent,
  type BlackKnightEnemyIntent, type BlackKnightPowerId } from './encounter.js';

/** Costs, finite effects and wheels are authored G. No soul or reserve is created by promotion. */
export const BLACK_KNIGHT_COUNT_WHEEL = SHEPHERD_COUNT_WHEEL;
export const blackKnightActionCount = shepherdActionCount;
export const BLACK_KNIGHT_ENEMY_COUNT_WHEEL: readonly SliceWheelEntry[] = [
  { id: '2', label: '2次', weight: 20 }, { id: '3', label: '3次', weight: 50 }, { id: '4', label: '4次', weight: 30 },
];
export const blackKnightEnemyActionCount = (roll: number): number => roll <= 20 ? 2 : roll <= 70 ? 3 : 4;
export const BLACK_KNIGHT_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '原弧光术：5灵性，贡献55（G）', weight: 40 },
  { id: 'WARD', label: '原小型护术：3灵性，对方−30（G）', weight: 30 },
  { id: 'BODY_STRIKE', label: '自有原棍普通打击：18×身体（G）', weight: 25 },
  { id: 'ACCIDENT', label: '实际失衡：0贡献，不恢复灵性', weight: 5 },
];
export type BlackKnightMoveId = 'hanged-man.s4.flesh-soul-blade' | 'BODY_FOLLOWUP' | 'BORROWED_WARD'
  | 'hanged-man.s4.shadow-command' | 'hanged-man.s5.borrowed-arts' | 'ACCIDENT';
const ABILITIES: readonly { id: BlackKnightMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'hanged-man.s4.flesh-soul-blade', label: '本人灵肉之刃5灵性／实际原棍或身体（H；55×新掌握，G）', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承身体次击（J；27.3×旧血肉掌握×身体，G）', weight: 15, stance: 'ATTACK' },
  { id: 'BORROWED_WARD', label: '当前原伊芮斯已选防护2灵性／原有限自修复3灵性1储备／普通格挡（B；G）', weight: 20, stance: 'DEFEND' },
  { id: 'hanged-man.s4.shadow-command', label: '本人操纵当前原影（K；4灵性、知识18；下一正身体打击×0.5，仅本轮，G）', weight: 20, stance: 'CONTROL' },
  { id: 'hanged-man.s5.borrowed-arts', label: '当前唯一原伊芮斯已选微力触动2灵性／普通复核（R；不切灵，G）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差（A；固定−22.5，G）', weight: 5, stance: null },
];
export const isBlackKnight = (s: SliceState): boolean => s.progression.pathwayId === 'hanged-man' && s.progression.sequence === 4;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function blackKnightAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0), spirit = activeSpirit(s);
  return ABILITIES.map((a, i) => ({ id: a.id, weight: weights[i]! / total * 100,
    label: a.id === 'hanged-man.s5.borrowed-arts' && !(spirit?.id === 'SH5-IRIS-1' && spirit.selectedAbilities.includes('light-touch'))
      ? '当前唯一原灵未提供已选微力触动：普通复核（R；0贡献、0消耗，不改选、不借第二灵）' : a.label }));
}
export function drawBlackKnightAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): BlackKnightMoveId {
  const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (let i = 0; i < ABILITIES.length; i++) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('黑骑士动作盘权重无效。');
}
export function drawBlackKnightEnemyAbility(random: ActionRandomStream): BlackKnightEnemyIntent {
  let roll = random.nextInt(1, 100);
  for (const a of BLACK_KNIGHT_ENEMY_ABILITY_WHEEL) { roll -= a.weight; if (roll <= 0) return a.id as BlackKnightEnemyIntent; }
  throw new Error('原加里克动作盘权重无效。');
}
/** Same actual S5 sources, acquisition dates and selected methods; released originals remain unusable. */
function activeSpirit(s: SliceState): ShepherdSpiritState | null {
  const g = s.shepherd.grazing;
  if (!isBlackKnight(s) || !g.met || g.activeSpiritId === null || !Array.isArray(g.spirits) ||
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
/** Inherited S6 validation and spending policy; consumed original packets back the same finite points. */
function availableReserve(s: SliceState): number {
  const r = s.roseBishop.reserve;
  if (r.max !== 3 || !Number.isSafeInteger(r.points) || r.points < 0 || r.points > r.max ||
      !Array.isArray(r.packets) || !Number.isSafeInteger(r.packetsBought) || r.packetsBought !== r.packets.length ||
      new Set(r.packets.map(p => p.id)).size !== r.packets.length ||
      !r.packets.every(p => /^rose-bishop-ration-[1-9]\d*$/.test(p.id) &&
        Number.isSafeInteger(p.acquiredWeek) && p.acquiredWeek >= 1 && p.acquiredWeek <= s.week &&
        (p.status === 'HELD' ? p.consumedWeek === null : p.status === 'CONSUMED' &&
          Number.isSafeInteger(p.consumedWeek) && p.consumedWeek! >= p.acquiredWeek && p.consumedWeek! <= s.week)) ||
      r.packets.filter(p => p.status === 'CONSUMED').length < r.points) return 0;
  return r.points;
}
const bounded = (n: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));
const masteryFactor = (n: number) => .65 + .35 * bounded(n, 500) / 500;
const mastery = (s: SliceState, id: string) => bounded(s.progression.mastery[id] ?? 0, 500);
export interface BlackKnightCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'BLACK_KNIGHT_DISPUTE'; targetId: typeof BLACK_KNIGHT_TARGET_ID; attemptWeek: number; startHistoryIndex: number;
  playerHealth: number; playerMind: number; enemyHealth: number; enemyMind: number; knowledge: number;
  clubLocation: SliceState['town']['clubLocation']; actualOriginalBody: true; mutuallyVisible: true;
  distanceMetres: 4; noBystanders: true; friendImmunity: false; ordinaryExit: true; pursuit: false;
  targetSequence: 5; targetPhysique: 20; enemyWeapon: 'BK4-GARRICK-CLUB'; space: 'ORIGINAL_BLACK_KNIGHT_EMPTY_ANNEX';
  originalShadow: 'BK4-GARRICK-SHADOW'; shadowLit: true; offensiveIntent: true; corruptIntent: true;
  activeSpiritId: string | null; selectedAbilities: string[]; spiritAcquiredWeek: number | null;
  reservePoints: number; bladeMastery: number; fleshMastery: number; borrowedMastery: number;
}
export function currentBlackKnightCombatSource(s: SliceState): BlackKnightCombatSource | null {
  if (!hasBlackKnightDisputeOpponent(s)) return null;
  const e = s.blackKnight.encounter, c = s.combat!, spirit = activeSpirit(s);
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'BLACK_KNIGHT_DISPUTE', targetId: BLACK_KNIGHT_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, playerHealth: s.health, playerMind: s.mind,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, knowledge: s.character.coreStats.knowledge, clubLocation: s.town.clubLocation,
    actualOriginalBody: true, mutuallyVisible: true, distanceMetres: 4, noBystanders: true, friendImmunity: false, ordinaryExit: true, pursuit: false,
    targetSequence: 5, targetPhysique: 20, enemyWeapon: 'BK4-GARRICK-CLUB', space: 'ORIGINAL_BLACK_KNIGHT_EMPTY_ANNEX',
    originalShadow: 'BK4-GARRICK-SHADOW', shadowLit: true, offensiveIntent: true, corruptIntent: true,
    activeSpiritId: spirit?.id ?? null, selectedAbilities: [...(spirit?.selectedAbilities ?? [])], spiritAcquiredWeek: spirit?.acquiredWeek ?? null,
    reservePoints: availableReserve(s), bladeMastery: mastery(s, 'hanged-man.s4.flesh-soul-blade'),
    fleshMastery: mastery(s, 'hanged-man.s6.flesh-shaping'), borrowedMastery: mastery(s, 'hanged-man.s5.borrowed-arts') };
}
export interface BlackKnightCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
export interface BlackKnightPlayerAction extends BlackKnightCombatEffect {
  order: number; id: BlackKnightMoveId; paidCost: number; reserveCost: number; healthRestored: number; physicalFactor: number;
  checkChance: number | null; checkRoll: number | null; shadowPrepared: boolean; bladePaid: boolean;
  borrowedSpiritId: 'SH5-IRIS-1' | null; borrowedMethod: 'light-touch' | 'brief-ward' | null;
}
export interface BlackKnightEnemyAction extends BlackKnightCombatEffect {
  order: number; planned: BlackKnightEnemyIntent; actual: BlackKnightEnemyIntent; paidCost: number;
  physicalFactor: number; shadowApplied: boolean; wardIgnoredBy: number | null;
}
export interface BlackKnightRoundContext {
  source: BlackKnightCombatSource; stance: SliceStance; finished: boolean;
  playerSpiritualityBefore: number; enemySpiritualityBefore: number;
  playerActions: BlackKnightPlayerAction[]; enemyActions: BlackKnightEnemyAction[]; label: string;
}
const none = (label: string): BlackKnightCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
function validRound(s: SliceState, r: BlackKnightRoundContext, source: BlackKnightCombatSource | null): boolean {
  const current = currentBlackKnightCombatSource(s);
  return !r.finished && !!current && !!source && stableStringify(r.source) === stableStringify(source) &&
    Object.entries(r.source).every(([k, v]) => ['playerHealth', 'reservePoints'].includes(k) ||
      stableStringify((current as unknown as Record<string, unknown>)[k]) === stableStringify(v)) &&
    s.health === r.source.playerHealth + r.playerActions.reduce((n, a) => n + a.healthRestored, 0) &&
    availableReserve(s) === r.source.reservePoints - r.playerActions.reduce((n, a) => n + a.reserveCost, 0) &&
    s.spirituality === r.playerSpiritualityBefore - r.playerActions.reduce((n, a) => n + a.paidCost, 0) &&
    s.blackKnight.encounter.enemySpirituality === r.enemySpiritualityBefore - r.enemyActions.reduce((n, a) => n + a.paidCost, 0);
}
export function beginBlackKnightCombatRound(s: SliceState, stance: SliceStance): BlackKnightRoundContext {
  const source = currentBlackKnightCombatSource(s); if (!source) throw new Error('缺少黑骑士当前原加里克、原影、净空原附院或连续回合来源。');
  return { source, stance, finished: false, playerSpiritualityBefore: s.spirituality, enemySpiritualityBefore: s.blackKnight.encounter.enemySpirituality,
    playerActions: [], enemyActions: [], label: '同一原加里克在净空附院4米外，原影实际受日光照亮，原有限灵性40；本场已知具体伤人与勒索意图，不是普遍善恶扫描。' };
}
function firstPaidBlade(r: BlackKnightRoundContext): BlackKnightPlayerAction | undefined {
  return r.playerActions.find(a => a.bladePaid && a.paidCost === 5 && a.selfGain > 0);
}
/** Updates the same paid ward entry for either initiative order, never grants a second attack or refunds a spell. */
function ignoreOneWard(s: SliceState, r: BlackKnightRoundContext): void {
  const e = s.blackKnight.encounter;
  if (e.wardIgnored || !r.source.corruptIntent || !r.source.offensiveIntent) return;
  const blade = firstPaidBlade(r), ward = r.enemyActions.find(a => a.actual === 'WARD' && a.paidCost === 3 && a.enemyReduction === 30);
  if (!blade) return;
  e.bladeReady = true;
  if (!ward) return;
  ward.enemyReduction = 0; ward.wardIgnoredBy = blade.order;
  ward.label += '；同一原人的本轮实际付费正贡献灵肉之刃忽略这一项30护势（G），原3灵性已付、不退、不取消法术或保证致伤';
  e.wardIgnored = true; e.bladeReady = false;
}
export function resolveBlackKnightCombatAbility(s: SliceState, id: BlackKnightMoveId, physicalStateFactor: number, random: ActionRandomStream,
  r: BlackKnightRoundContext, source: BlackKnightCombatSource | null = r.source): BlackKnightCombatEffect {
  if (!validRound(s, r, source) || !ABILITIES.some(a => a.id === id)) return none('缺少本回合同一原加里克来源，0贡献、0消耗，不取原灵或重抽。');
  const a: BlackKnightPlayerAction = { ...none(''), order: r.playerActions.length + r.enemyActions.length, id, paidCost: 0, reserveCost: 0,
    healthRestored: 0, physicalFactor: bounded(physicalStateFactor, 1), checkChance: null, checkRoll: null,
    shadowPrepared: false, bladePaid: false, borrowedSpiritId: null, borrowedMethod: null };
  Object.assign(a, resolvePlayer(s, id, a.physicalFactor, random, a)); r.playerActions.push(a); ignoreOneWard(s, r);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
function resolvePlayer(s: SliceState, id: BlackKnightMoveId, physical: number, random: ActionRandomStream, a: BlackKnightPlayerAction): BlackKnightCombatEffect {
  const e = s.blackKnight.encounter, canPay = (n: number) => Number.isFinite(s.spirituality) && s.spirituality >= n;
  const pay = (n: number) => { s.spirituality -= n; a.paidCost = n; };
  const spirit = activeSpirit(s), iris = (method: string) => spirit?.id === 'SH5-IRIS-1' && spirit.selectedAbilities.includes(method);
  if (id === 'ACCIDENT') return { ...none('本次动作偏差固定−22.5（G），0灵性、0储备，不生成污染或额外攻击。'), selfGain: -22.5 };
  if (id === 'BODY_FOLLOWUP') {
    const selfGain = 27.3 * masteryFactor(mastery(s, 'hanged-man.s6.flesh-shaping')) * physical;
    return { label: '继承本人身体次击27.3×旧血肉掌握×身体（G），独立占本槽，0灵性、0储备。', selfGain, enemyReduction: 0, threatens: selfGain > 0 };
  }
  if (id === 'hanged-man.s4.flesh-soul-blade') {
    if (canPay(5)) {
      pay(5); a.bladePaid = true;
      const selfGain = 55 * masteryFactor(mastery(s, id));
      return { label: '本人灵肉之刃实付5灵性，沿原4米净空地面近身挥击同一原加里克后回位，55×新掌握进入本槽攻击战势（G）。仅实际正攻击贡献可忽略本轮一次真实小护术；不是远距凭空命中、保底致伤或必杀，最终仍依共同胜负与伤势盘。', selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    const selfGain = (s.town.clubLocation === 'HAND' ? 16 : 12) * physical;
    return { label: `不足5灵性，实际${s.town.clubLocation === 'HAND' ? '本人原短棍16' : '普通身体12'}×身体打击（G）；0消耗、没有灵肉之刃或破防，不透支或取敌人的原棍。`, selfGain, enemyReduction: 0, threatens: selfGain > 0 };
  }
  if (id === 'BORROWED_WARD') {
    if (iris('brief-ward') && canPay(2)) {
      pay(2); a.borrowedSpiritId = 'SH5-IRIS-1'; a.borrowedMethod = 'brief-ward';
      return { ...none('借当前唯一已放牧伊芮斯原灵SH5-IRIS-1实际已选短促防护，实付2灵性，30×旧借用掌握（G）；原灵留在本人之内，不附赠修复或另一灵。'), enemyReduction: 30 * masteryFactor(mastery(s, 'hanged-man.s5.borrowed-arts')) };
    }
    if (s.health > 0 && s.health < 100 && availableReserve(s) > 0 && canPay(3)) {
      pay(3); s.roseBishop.reserve.points--; a.reserveCost = 1; const before = s.health;
      s.health = Math.min(100, s.health + 10); a.healthRestored = s.health - before;
      return { ...none(`继承有限自修复实付3灵性和1点已有原储备，恢复${a.healthRestored}健康、上限100，自身优势+8（G）；原伤势、风险和精神不变，不复活、不补储备。`), selfGain: 8 };
    }
    return { ...none('没有可支付的当前原灵防护或所需原储备修复，普通格挡10×身体（G），0消耗，不治疗或清除伤势。'), enemyReduction: 10 * physical };
  }
  if (id === 'hanged-man.s4.shadow-command') {
    if (e.shadowReady) return none('已付原影限制尚待本轮下一正贡献身体打击，不叠加、不重复付费或判定。');
    if (!canPay(4)) return none('不足4灵性，无法尝试操纵同一原影；普通走位，0贡献、0消耗。');
    pay(4); a.checkChance = computeCheckChance({ ability: 'knowledge', baseAbility: s.character.coreStats.knowledge, difficulty: 18, modifiers: [] });
    a.checkRoll = random.nextInt(1, 100); a.shadowPrepared = a.checkRoll <= a.checkChance; e.shadowReady = a.shadowPrepared;
    return none(`本人操纵同一原加里克脚下实际受光阴影，实付4灵性；知识18对抗${a.checkRoll}/100、阈值${a.checkChance}（G）。${a.shadowPrepared ? '只限制下一正贡献BODY_STRIKE×0.5，本轮一用即止' : '被原人抵抗，限制未成立，费用不退'}；不影响弧光、小护术、思想、所有动作或隔墙无影目标，本轮结束即散。`);
  }
  if (iris('light-touch') && canPay(2)) {
    pay(2); a.borrowedSpiritId = 'SH5-IRIS-1'; a.borrowedMethod = 'light-touch';
    const selfGain = 38.025 * masteryFactor(mastery(s, 'hanged-man.s5.borrowed-arts'));
    return { label: '只借当前已放牧伊芮斯原灵SH5-IRIS-1实际已选微力触动，实付2灵性，38.025×旧借用掌握（G）；只占本槽，不附赠本人攻击、不启用第二灵或生成外部身体。', selfGain, enemyReduction: 0, threatens: selfGain > 0 };
  }
  return none('当前唯一原灵未实际放牧、未选微力触动或不足2灵性：普通复核，0贡献、0消耗；不自行切灵，不复活已释放塞德里克，不借未知方法或外化普通灵。');
}
export function resolveBlackKnightEnemyAbility(s: SliceState, planned: BlackKnightEnemyIntent, physicalStateFactor: number, _random: ActionRandomStream,
  r: BlackKnightRoundContext, source: BlackKnightCombatSource | null = r.source): BlackKnightCombatEffect {
  if (!validRound(s, r, source) || ![...BLACK_KNIGHT_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned)) return none('缺少本回合同一原加里克来源，原敌不凭空施术或补灵性。');
  const e = s.blackKnight.encounter, power = BLACK_KNIGHT_POWERS.find(p => p.id === planned), payable = !!power && e.enemySpirituality >= power.cost;
  const actual: BlackKnightEnemyIntent = planned === 'ACCIDENT' ? 'ACCIDENT' : payable ? planned : 'BODY_STRIKE';
  const physical = bounded(physicalStateFactor, 1), rawGain = actual === 'ACCIDENT' ? 0 : payable ? power!.selfGain : 18 * physical;
  if (payable) { e.enemySpirituality -= power!.cost; e.powerUses[power!.id]++; }
  const shadowApplied = actual === 'BODY_STRIKE' && rawGain > 0 && e.shadowReady;
  if (shadowApplied) e.shadowReady = false;
  const selfGain = rawGain * (shadowApplied ? .5 : 1), enemyReduction = payable ? power!.enemyReduction : 0;
  const a: BlackKnightEnemyAction = { order: r.playerActions.length + r.enemyActions.length, planned, actual, paidCost: payable ? power!.cost : 0,
    physicalFactor: physical, shadowApplied, wardIgnoredBy: null, selfGain, enemyReduction, threatens: selfGain > 0,
    label: `${actual === 'ACCIDENT' ? '原加里克动作失衡，0贡献、0费用' : payable ? `同一原加里克完成${power!.label}，实付${power!.cost}灵性，余${e.enemySpirituality}/40` : `${power ? '原法术灵性不足，回退' : ''}自有原棍普通打击18×身体（G），0费用`}${shadowApplied ? '；已付原影限制只消费于本次正贡献身体打击×0.5并当次结束' : ''}。不凭空扣健康或取消原行动。` };
  r.enemyActions.push(a); ignoreOneWard(s, r);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
export interface BlackKnightRoundOutcome {
  targetId: typeof BLACK_KNIGHT_TARGET_ID; round: number; source: BlackKnightCombatSource;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number;
  playerReserveAfter: number; enemySpiritualityBefore: number; powerUses: Record<BlackKnightPowerId, number>;
  shadowReady: false; bladeReady: false; wardIgnored: false;
  playerActions: BlackKnightPlayerAction[]; enemyActions: BlackKnightEnemyAction[];
}
export function finishBlackKnightCombatRound(s: SliceState, r: BlackKnightRoundContext): BlackKnightRoundOutcome {
  if (r.finished || s.combat?.encounterId !== 'BLACK_KNIGHT_DISPUTE' || s.combat.round !== r.source.round) throw new Error('同一原回合已结束或不存在。');
  const e = s.blackKnight.encounter, c = s.combat;
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus;
  e.enemyInjuries = c.enemyInjuries.map(i => ({ ...i })); e.enemyRisk = c.enemyRisk;
  e.shadowReady = false; e.bladeReady = false; e.wardIgnored = false; r.finished = true;
  return { targetId: BLACK_KNIGHT_TARGET_ID, round: c.round, source: structuredClone(r.source), enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, playerSpiritualityBefore: r.playerSpiritualityBefore,
    playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind, playerReserveAfter: availableReserve(s),
    enemySpiritualityBefore: r.enemySpiritualityBefore, powerUses: { ...e.powerUses }, shadowReady: false, bladeReady: false, wardIgnored: false,
    playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
}
export function projectBlackKnightCombat(s: SliceState) {
  const e = s.blackKnight.encounter, spirit = activeSpirit(s);
  return { enemyName: '加里克·诺尔（BK4-GARRICK-NOLL，原创成年序列5对手，G）', targetId: e.targetId,
    enemySpirituality: e.enemySpirituality, powerUses: { ...e.powerUses }, shadowReady: e.shadowReady, bladeReady: e.bladeReady,
    wardIgnored: e.wardIgnored, activeSpiritId: spirit?.id ?? null, selectedAbilities: [...(spirit?.selectedAbilities ?? [])], reservePoints: availableReserve(s),
    originalExit: true, pursuit: false, distanceMetres: 4, source: currentBlackKnightCombatSource(s),
    summary: `原敌灵性${e.enemySpirituality}/40；自身原储备${availableReserve(s)}/3，当前唯一原灵${spirit?.id ?? '无'}。实付正贡献灵肉之刃至多忽略本轮一项原小护术，仍有真实伤势与死亡风险。原影限制只作用下一正贡献身体打击，回合结束；不会外化普通灵、放出第二灵或召来独立影子参战。`,
    enemyCountWheel: BLACK_KNIGHT_ENEMY_COUNT_WHEEL, enemyAbilityWheel: BLACK_KNIGHT_ENEMY_ABILITY_WHEEL };
}
export function validateBlackKnightRoundOutcome(v: unknown): v is BlackKnightRoundOutcome {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const p = v as BlackKnightRoundOutcome;
  const integer = (n: unknown, min: number, max = Number.MAX_SAFE_INTEGER): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
  const resource = (n: unknown, max = 120): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
  const a = p.source;
  if (!a || typeof a !== 'object' || a.targetId !== BLACK_KNIGHT_TARGET_ID || a.encounterId !== 'BLACK_KNIGHT_DISPUTE' || a.round !== p.round ||
      typeof a.runId !== 'string' || a.runId.length === 0 || !integer(a.revision, 0) || !integer(a.week, 1) || a.attemptWeek !== a.week || !integer(a.startHistoryIndex, 0) ||
      !integer(a.playerHealth, 1, 100) || !integer(a.playerMind, 1, 100) || !integer(a.enemyHealth, 1, 100) || !integer(a.enemyMind, 1, 100) || !integer(a.knowledge, 0, 500) ||
      !['SHOP', 'BAG', 'HAND'].includes(a.clubLocation) || a.actualOriginalBody !== true || a.mutuallyVisible !== true || a.distanceMetres !== 4 || a.noBystanders !== true || a.friendImmunity !== false ||
      a.ordinaryExit !== true || a.pursuit !== false || a.targetSequence !== 5 || a.targetPhysique !== 20 || a.enemyWeapon !== 'BK4-GARRICK-CLUB' || a.space !== 'ORIGINAL_BLACK_KNIGHT_EMPTY_ANNEX' ||
      a.originalShadow !== 'BK4-GARRICK-SHADOW' || a.shadowLit !== true || a.offensiveIntent !== true || a.corruptIntent !== true ||
      !resource(a.bladeMastery, 500) || !resource(a.fleshMastery, 500) || !resource(a.borrowedMastery, 500) || !integer(a.reservePoints, 0, 3) ||
      !Array.isArray(a.selectedAbilities) || a.selectedAbilities.length > 3 || new Set(a.selectedAbilities).size !== a.selectedAbilities.length) return false;
  if (a.activeSpiritId === null) {
    if (a.selectedAbilities.length !== 0 || a.spiritAcquiredWeek !== null) return false;
  } else {
    const origin = SHEPHERD_SPIRITS.find(s => s.id === a.activeSpiritId);
    if (!origin || a.selectedAbilities.length < 1 || !integer(a.spiritAcquiredWeek, 1, a.week) ||
        !a.selectedAbilities.every(id => origin.knownAbilities.some(m => m.id === id))) return false;
  }
  if (p.targetId !== BLACK_KNIGHT_TARGET_ID || !integer(p.round, 1) || !integer(p.enemyHealth, 0, a.enemyHealth) || p.enemyMind !== a.enemyMind ||
      !integer(p.enemySpirituality, 0, 40) || !integer(p.enemySpiritualityBefore, p.enemySpirituality, 40) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(p.enemyStatus) || (p.enemyStatus === 'DEAD') !== (p.enemyHealth === 0) ||
      !resource(p.playerSpiritualityBefore) || !resource(p.playerSpiritualityAfter) || p.playerSpiritualityAfter > p.playerSpiritualityBefore ||
      !integer(p.playerHealthAfter, 0, 100) || p.playerMindAfter !== a.playerMind || !integer(p.playerReserveAfter, 0, a.reservePoints) ||
      !p.powerUses || Object.keys(p.powerUses).length !== 2 || BLACK_KNIGHT_POWER_IDS.some(id => !integer(p.powerUses[id], 0, 13)) ||
      p.enemySpirituality !== 40 - BLACK_KNIGHT_POWERS.reduce((n, x) => n + p.powerUses[x.id] * x.cost, 0) ||
      p.shadowReady !== false || p.bladeReady !== false || p.wardIgnored !== false ||
      !Array.isArray(p.playerActions) || p.playerActions.length > 6 || !Array.isArray(p.enemyActions) || p.enemyActions.length > 4) return false;
  const ordered = [...p.playerActions.map(x => ({ kind: 'PLAYER' as const, action: x })), ...p.enemyActions.map(x => ({ kind: 'ENEMY' as const, action: x }))];
  if (ordered.some(x => !x.action || !integer(x.action.order, 0, 9))) return false;
  ordered.sort((x, y) => x.action.order - y.action.order);
  const blade = p.playerActions.find(x => x.bladePaid && x.paidCost === 5 && x.selfGain > 0);
  const ignoredWard = blade ? p.enemyActions.find(x => x.actual === 'WARD' && x.paidCost === 3) : undefined;
  const iris = (method: string) => a.activeSpiritId === 'SH5-IRIS-1' && a.selectedAbilities.includes(method);
  let enemySpent = 0, playerSpent = 0, reserveSpent = 0, healedHealth = a.playerHealth, shadow = false;
  for (let index = 0; index < ordered.length; index++) {
    const entry = ordered[index]!, x = entry.action;
    if (x.order !== index || typeof x.label !== 'string' || !Number.isFinite(x.selfGain) || !resource(x.enemyReduction, 30) ||
        typeof x.threatens !== 'boolean' || !resource(x.physicalFactor, 1)) return false;
    if (entry.kind === 'PLAYER') {
      const x = entry.action;
      if (!ABILITIES.some(m => m.id === x.id) || !integer(x.paidCost, 0, 5) || !integer(x.reserveCost, 0, 1) ||
          !integer(x.healthRestored, 0, 10) || typeof x.shadowPrepared !== 'boolean' || typeof x.bladePaid !== 'boolean' ||
          ![null, 'SH5-IRIS-1'].includes(x.borrowedSpiritId) || ![null, 'light-touch', 'brief-ward'].includes(x.borrowedMethod)) return false;
      const funds = p.playerSpiritualityBefore - playerSpent;
      let cost = 0, reserve = 0, heal = 0, gain = 0, reduction = 0, threat = false, paidBlade = false;
      let method: BlackKnightPlayerAction['borrowedMethod'] = null;
      if (x.id === 'ACCIDENT') gain = -22.5;
      if (x.id === 'BODY_FOLLOWUP') { gain = 27.3 * masteryFactor(a.fleshMastery) * x.physicalFactor; threat = gain > 0; }
      if (x.id === 'hanged-man.s4.flesh-soul-blade') {
        if (funds >= 5) { cost = 5; paidBlade = true; gain = 55 * masteryFactor(a.bladeMastery); }
        else gain = (a.clubLocation === 'HAND' ? 16 : 12) * x.physicalFactor;
        threat = gain > 0;
      }
      if (x.id === 'BORROWED_WARD') {
        if (iris('brief-ward') && funds >= 2) { cost = 2; method = 'brief-ward'; reduction = 30 * masteryFactor(a.borrowedMastery); }
        else if (healedHealth > 0 && healedHealth < 100 && a.reservePoints - reserveSpent > 0 && funds >= 3) {
          cost = 3; reserve = 1; heal = Math.min(10, 100 - healedHealth); gain = 8;
        } else reduction = 10 * x.physicalFactor;
      }
      if (x.id === 'hanged-man.s5.borrowed-arts' && iris('light-touch') && funds >= 2) {
        cost = 2; method = 'light-touch'; gain = 38.025 * masteryFactor(a.borrowedMastery); threat = gain > 0;
      }
      if (x.id === 'hanged-man.s4.shadow-command' && !shadow && funds >= 4) {
        cost = 4;
        if (!integer(x.checkRoll, 1, 100) || x.checkChance !== computeCheckChance({ ability: 'knowledge', baseAbility: a.knowledge, difficulty: 18, modifiers: [] }) ||
            x.shadowPrepared !== (x.checkRoll <= x.checkChance)) return false;
        shadow = x.shadowPrepared;
      } else if (x.checkChance !== null || x.checkRoll !== null || x.shadowPrepared) return false;
      if (x.paidCost !== cost || x.reserveCost !== reserve || x.healthRestored !== heal || x.selfGain !== gain || x.enemyReduction !== reduction || x.threatens !== threat ||
          x.bladePaid !== paidBlade || x.borrowedMethod !== method || x.borrowedSpiritId !== (method ? 'SH5-IRIS-1' : null)) return false;
      playerSpent += cost; reserveSpent += reserve; healedHealth += heal;
    } else {
      const x = entry.action, power = BLACK_KNIGHT_POWERS.find(q => q.id === x.planned), payable = !!power && p.enemySpiritualityBefore - enemySpent >= power.cost;
      if (![...BLACK_KNIGHT_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(x.planned) || typeof x.shadowApplied !== 'boolean' ||
          x.actual !== (x.planned === 'ACCIDENT' ? 'ACCIDENT' : payable ? x.planned : 'BODY_STRIKE') || x.paidCost !== (payable ? power!.cost : 0)) return false;
      const raw = x.actual === 'ACCIDENT' ? 0 : payable ? power!.selfGain : 18 * x.physicalFactor;
      if (x.shadowApplied !== (x.actual === 'BODY_STRIKE' && raw > 0 && shadow) || x.selfGain !== raw * (x.shadowApplied ? .5 : 1) ||
          x.enemyReduction !== (x === ignoredWard ? 0 : payable ? power!.enemyReduction : 0) || x.wardIgnoredBy !== (x === ignoredWard ? blade!.order : null) ||
          x.threatens !== (x.selfGain > 0)) return false;
      if (x.shadowApplied) shadow = false;
      enemySpent += x.paidCost;
    }
  }
  return p.enemySpiritualityBefore - enemySpent === p.enemySpirituality && p.playerSpiritualityBefore - playerSpent === p.playerSpiritualityAfter &&
    a.reservePoints - reserveSpent === p.playerReserveAfter && p.playerHealthAfter <= healedHealth;
}


/** Only already resolved public facts; replay provenance is never a renderer payload. */
export function projectBlackKnightRoundOutcome(o: BlackKnightRoundOutcome) { return {
  ...publicPryerFields(o, ['targetId', 'round', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'playerSpiritualityBefore', 'playerSpiritualityAfter', 'playerHealthAfter', 'playerMindAfter', 'playerReserveAfter', 'enemySpiritualityBefore', 'shadowReady', 'bladeReady', 'wardIgnored']),
  powerUses: publicPryerFields(o.powerUses, ['ARC_BOLT', 'WARD']),
  playerActions: o.playerActions.map(a => publicPryerFields(a, ['label', 'selfGain', 'enemyReduction', 'threatens', 'order', 'id', 'paidCost', 'reserveCost', 'healthRestored', 'physicalFactor', 'checkChance', 'checkRoll', 'shadowPrepared', 'bladePaid', 'borrowedSpiritId', 'borrowedMethod'])),
  enemyActions: o.enemyActions.map(a => publicPryerFields(a, ['label', 'selfGain', 'enemyReduction', 'threatens', 'order', 'planned', 'actual', 'paidCost', 'physicalFactor', 'shadowApplied', 'wardIgnoredBy'])),
}; }
export type BlackKnightPublicRoundOutcome = ReturnType<typeof projectBlackKnightRoundOutcome>;
