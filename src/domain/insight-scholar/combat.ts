import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import type { PolymathSampleState } from '../polymath/types.js';
import type { MysticismMagisterCraft } from '../mysticism-magister/types.js';
import { INSIGHT_SCHOLAR_TARGET_ID, INSIGHT_SCHOLAR_POWERS, INSIGHT_SCHOLAR_POWER_IDS, hasInsightScholarDisputeOpponent,
  type InsightScholarEnemyIntent, type InsightScholarPowerId, type InsightScholarSeenPower } from './encounter.js';

/** Candidate Reader3 and all new effects are G, not verified original-text powers.
 * Retains actual Reader4 core35/25/25/15,1250/floor125,S120 and CONTINUE-only12 in the shared adapter. */
export const INSIGHT_SCHOLAR_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const INSIGHT_SCHOLAR_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const insightScholarActionCount = pyromaniacActionCount;
export const insightScholarEnemyActionCount = pyromaniacActionCount;
export type InsightScholarMoveId = 'STRIKE' | 'reader.s3.method-analysis' | 'reader.s4.fragmentary-foresight'
  | 'reader.s6.limited-imitation' | 'reader.s5.material-imitation' | 'ACCIDENT' | 'EVADE' | 'OBSERVE';
const ANALYSIS = 'reader.s3.method-analysis', FORESIGHT = 'reader.s4.fragmentary-foresight';
const FLASH = 'reader.s6.limited-imitation', MATERIAL = 'reader.s5.material-imitation';
const ABILITIES: readonly { id: InsightScholarMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'STRIKE', label: '本人普通打击（H；原身体12/自持原棍16×身体G）', weight: 25, stance: 'ATTACK' },
  { id: ANALYSIS, label: '有限方法辨析（J；仅本场已亲见FLASH/WARD，5S/知识18减35G；未见普通避让10/0S）', weight: 25, stance: 'CONTROL' },
  { id: FORESIGHT, label: '继承片段预警（B；4S/意志16减22G，不预读未来）', weight: 15, stance: 'DEFEND' },
  { id: FLASH, label: '继承原FLASH（K；实际已学，2S/知识14，减12×旧掌握G）', weight: 20, stance: 'CONTROL' },
  { id: MATERIAL, label: '实际耗用最早原微光片（R；0S，减18×制作固定效力G）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A；固定−22.5G）', weight: 5, stance: null },
];
/** Five enemy action categories, total100. These are not six independent categories. */
export const INSIGHT_SCHOLAR_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'FLASH', label: '有限闪光：5S/75G', weight: 35 }, { id: 'WARD', label: '有限护术：4S/减45G', weight: 25 },
  { id: 'BODY_STRIKE', label: '同一原棍：20×身体G', weight: 20 }, { id: 'FOCUS', label: '有限专注：4S/抵本轮下一次成功闪光或方法压力', weight: 15 },
  { id: 'ACCIDENT', label: '判断偏差：−22.5G', weight: 5 },
];
export const isInsightScholar = (s: SliceState): boolean => s.progression.pathwayId === 'white-tower' && s.progression.sequence === 3;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function insightScholarAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 }));
}
export function drawInsightScholarAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): InsightScholarMoveId {
  const weights = tickets(stance); let n = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return a.id; } throw new Error('洞悉者候选G能力盘无效。');
}
export function drawInsightScholarEnemyAbility(random: ActionRandomStream): InsightScholarEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of INSIGHT_SCHOLAR_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as InsightScholarEnemyIntent; }
  throw new Error('原阿尔顿五类行动盘无效。');
}
export interface InsightScholarCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'INSIGHT_SCHOLAR_DISPUTE'; targetId: typeof INSIGHT_SCHOLAR_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetAge: 47; targetSequence: 3; actualOriginalBody: true; independentMind: true;
  enemyWeapon: 'IS3-ALTON-CLUB'; weaponLocation: 'HAND'; distanceMetres: 2; space: 'IS3-OPEN-COURT'; ordinaryExit: true; pursuit: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  clubHeld: boolean; knowledge: number; will: number; imitationMastery: number; powerUses: Record<InsightScholarPowerId, number>;
  seenPowers: InsightScholarSeenPower[]; flashSample: PolymathSampleState;
  crafts: MysticismMagisterCraft[]; craftingPromotionWeek: number | null; craftingCaseStatus: string; kitsUsed: number;
}
const bounded = (n: number, max: number) => Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
function hasLearnedFlash(sample: PolymathSampleState, week: number): boolean {
  const { observedWeek, understoodWeek, learnedWeek, analysisAttemptWeek } = sample;
  return [observedWeek, understoodWeek, learnedWeek, analysisAttemptWeek].every(w => integer(w, 1, week)) &&
    observedWeek! <= understoodWeek! && understoodWeek! <= learnedWeek! && observedWeek! <= analysisAttemptWeek! && analysisAttemptWeek! <= learnedWeek!;
}
/** Same original-kit identity, availability and fixed manufacture power rules as Prophet4. */
function oldestPreparedFlash(x: Pick<InsightScholarCombatSource, 'crafts' | 'craftingPromotionWeek' | 'craftingCaseStatus' | 'kitsUsed' | 'week'>): MysticismMagisterCraft | null {
  if (x.craftingCaseStatus !== 'RESOLVED') return null;
  return x.crafts.filter(c => {
    const kit = /^MM5-KIT-([1-9]\d*)$/.exec(c.sourceKitId);
    return /^MM5-FLASH-[1-9]\d*$/.test(c.id) && kit !== null && Number.isSafeInteger(Number(kit[1])) && c.id === `MM5-FLASH-${kit[1]}` &&
      integer(x.kitsUsed) && Number(kit[1]) <= x.kitsUsed && c.status === 'PLAYER' && c.usedWeek === null && integer(c.createdWeek, 1, x.week) &&
      x.craftingPromotionWeek !== null && c.createdWeek >= x.craftingPromotionWeek && Number.isFinite(c.power) && c.power >= .65 && c.power <= 1 &&
      x.crafts.filter(other => other.id === c.id || other.sourceKitId === c.sourceKitId).length === 1;
  }).sort((a, b) => a.createdWeek - b.createdWeek || Number(a.id.slice('MM5-FLASH-'.length)) - Number(b.id.slice('MM5-FLASH-'.length)))[0] ?? null;
}
export function currentInsightScholarCombatSource(s: SliceState): InsightScholarCombatSource | null {
  if (!hasInsightScholarDisputeOpponent(s)) return null;
  const e = s.insightScholar.encounter, c = s.combat!, m = s.mysticismMagister;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'INSIGHT_SCHOLAR_DISPUTE', targetId: INSIGHT_SCHOLAR_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetAge: 47, targetSequence: 3, actualOriginalBody: true, independentMind: true,
    enemyWeapon: 'IS3-ALTON-CLUB', weaponLocation: 'HAND', distanceMetres: 2, space: 'IS3-OPEN-COURT', ordinaryExit: true, pursuit: false,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality,
    clubHeld: s.town.clubLocation === 'HAND', knowledge: s.character.coreStats.knowledge, will: s.character.coreStats.will,
    imitationMastery: bounded(s.progression.mastery[FLASH] ?? 0, 500), powerUses: { ...e.powerUses }, seenPowers: [...e.seenPowers],
    flashSample: structuredClone(s.polymath.samples.FLASH), crafts: structuredClone(m.crafts), craftingPromotionWeek: m.promotionWeek,
    craftingCaseStatus: m.cases['modest-craft']!.status, kitsUsed: m.practice.kitsUsed };
}
export interface InsightScholarCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean }
interface ActionEvidence extends InsightScholarCombatEffect { order: number; paidCost: number; physicalFactor: number; rolls: number[] }
export interface InsightScholarPlayerAction extends ActionEvidence {
  id: InsightScholarMoveId; observedPower: InsightScholarSeenPower | null; consumedCraftId: string | null; resisted: boolean;
}
export interface InsightScholarEnemyAction extends ActionEvidence { planned: InsightScholarEnemyIntent; actual: InsightScholarEnemyIntent; focusGranted: boolean }
export interface InsightScholarRoundContext {
  source: InsightScholarCombatSource; stance: SliceStance; finished: boolean; liveState: string; focusReady: boolean;
  playerActions: InsightScholarPlayerAction[]; enemyActions: InsightScholarEnemyAction[]; label: string; outcome: InsightScholarRoundOutcome | null;
}
const none = (label: string): InsightScholarCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
function liveState(s: SliceState): string { const e = s.insightScholar.encounter; return stableStringify({ spirituality: s.spirituality,
  enemySpirituality: e.enemySpirituality, powerUses: e.powerUses, seenPowers: e.seenPowers, crafts: s.mysticismMagister.crafts }); }
const dynamicSource = new Set(['playerSpirituality', 'enemySpirituality', 'powerUses', 'seenPowers', 'crafts']);
function validRound(s: SliceState, r: InsightScholarRoundContext, supplied: InsightScholarCombatSource | null): boolean {
  const actual = currentInsightScholarCombatSource(s);
  return !r.finished && actual !== null && supplied !== null && same(supplied, r.source) && r.liveState === liveState(s) &&
    Object.entries(r.source).every(([key, value]) => dynamicSource.has(key) || same(actual[key as keyof InsightScholarCombatSource], value));
}
export function beginInsightScholarCombatRound(s: SliceState, stance: SliceStance, _random: ActionRandomStream): InsightScholarRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('洞悉者候选G姿态无效。');
  const source = currentInsightScholarCombatSource(s); if (!source) throw new Error('缺少原阿尔顿或原资源的连续来源。');
  return { source, stance, finished: false, liveState: liveState(s), focusReady: false, playerActions: [], enemyActions: [], outcome: null,
    label: `同一47岁原阿尔顿在净空庭院2米外，独立S${source.enemySpirituality}/120；有限方法辨析只用本场实际亲见施法，双方共用次数和伤势盘。` };
}
export const createInsightScholarCombatRound = beginInsightScholarCombatRound;
function actionBase(order: number, physical: number): ActionEvidence { return { ...none(''), order, paidCost: 0, physicalFactor: bounded(physical, 1), rolls: [] }; }
function check(s: SliceState, a: ActionEvidence, ability: 'knowledge' | 'will', difficulty: number, random: ActionRandomStream): boolean {
  const chance = computeCheckChance({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [] }), roll = random.nextInt(1, 100);
  a.rolls.push(roll); return roll <= chance;
}
export function resolveInsightScholarCombatAbility(s: SliceState, id: InsightScholarMoveId, physical: number, random: ActionRandomStream,
  r: InsightScholarRoundContext, source: InsightScholarCombatSource | null = r.source): InsightScholarCombatEffect {
  if (!validRound(s, r, source) || r.playerActions.length >= 6 || ![...ABILITIES.map(a => a.id), 'EVADE', 'OBSERVE'].includes(id))
    return none('缺少当前原人、原样本或原资源来源，或已用完本轮最多六槽；0贡献0消耗，不重抽。');
  const a: InsightScholarPlayerAction = { ...actionBase(r.playerActions.length + r.enemyActions.length, physical), id, observedPower: null, consumedCraftId: null, resisted: false };
  const pay = (cost: number) => { s.spirituality -= cost; a.paidCost = cost; };
  const observe = (why = '') => { a.label = `${why}本人普通观察，0贡献0消耗；不补技能、原片或随机抽取。`; };
  const evade = (why = '') => { a.enemyReduction = 10; a.label = `${why}本人普通避让减势10G、0S，不预读下一动作或保证免伤。`; };
  if (id === 'STRIKE') { a.selfGain = (r.source.clubHeld ? 16 : 12) * a.physicalFactor; a.threatens = a.selfGain > 0;
    a.label = `本人以${r.source.clubHeld ? '实际在手的原棍16' : '自己的原身体12'}×身体普通打击G，0S，只占原槽。`; }
  else if (id === 'EVADE') evade();
  else if (id === 'OBSERVE') observe();
  else if (id === 'ACCIDENT') { a.selfGain = -22.5; a.label = '判断失衡固定−22.5G，不重抽或增加行动。'; }
  else if (id === ANALYSIS) {
    a.observedPower = s.insightScholar.encounter.seenPowers[0] ?? null;
    if (!a.observedPower) evade('尚未亲见本场原阿尔顿实际付费施展FLASH或WARD，方法辨析未施放、不扣5S；');
    else if (s.spirituality < 5) evade(`已亲见${a.observedPower}但不足5S，方法辨析未施放；`);
    else { pay(5); if (check(s, a, 'knowledge', 18, random)) { a.enemyReduction = 35;
        a.label = `只对本场亲见的实际${a.observedPower}作有限方法辨析，实付5S/知识18成功，减势35G；不读取未来、产生真相或自动复制能力。`; }
      else a.label = `对本场亲见${a.observedPower}辨析失败，5S照耗、0贡献，不补避让或重抽。`; }
  } else if (id === FORESIGHT) {
    if (s.spirituality < 4) observe('不足4S，继承片段预警未施放；');
    else { pay(4); const success = check(s, a, 'will', 16, random); a.enemyReduction = success ? 22 : 0;
      a.label = `继承有限片段预警实付4S/意志16${success ? '成功，减势22G' : '失败，0贡献、成本保留'}；不检查未来轮盘，不保证获胜。`; }
  } else if (id === FLASH) {
    if (!hasLearnedFlash(r.source.flashSample, s.week) || s.spirituality < 2) observe('缺少早先实际学会的原FLASH样本，或不足2S；');
    else { pay(2); const success = check(s, a, 'knowledge', 14, random); a.enemyReduction = success ? 12 * (.65 + .35 * r.source.imitationMastery / 500) : 0;
      a.label = `继承实际原FLASH实付2S/知识14${success ? '成功，减势12×旧博学者掌握G' : '失败，0贡献、成本保留'}；不改变样本、学习新术、删敌行动或造成直接伤害。`; }
  } else {
    const craft = oldestPreparedFlash({ ...r.source, crafts: s.mysticismMagister.crafts });
    if (!craft) observe('没有已安全测试并报告、仍由本人持有的合格原微光片；');
    else { craft.status = 'CONSUMED'; craft.usedWeek = s.week; a.consumedCraftId = craft.id; a.enemyReduction = 18 * craft.power;
      a.label = `实际一次耗尽最早原片${craft.id}（原材料${craft.sourceKitId}），0额外S、减势18×制作固定效力${craft.power}G；不补原片、不按当前掌握重算。`; }
  }
  if ([ANALYSIS, FLASH, MATERIAL].includes(id) && a.enemyReduction > 0 && (a.paidCost > 0 || a.consumedCraftId !== null) && r.focusReady) {
    r.focusReady = false; a.resisted = true; a.enemyReduction = 0; a.label += '原阿尔顿消耗本轮已付费专注的一次抵抗，刚形成的压力被抵消；玩家实际成本不退。';
  }
  r.playerActions.push(a); r.liveState = liveState(s);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export function resolveInsightScholarEnemyAbility(s: SliceState, planned: InsightScholarEnemyIntent, physical: number, _random: ActionRandomStream,
  r: InsightScholarRoundContext, source: InsightScholarCombatSource | null = r.source): InsightScholarCombatEffect {
  if (!validRound(s, r, source) || r.enemyActions.length >= 6 || ![...INSIGHT_SCHOLAR_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned))
    return none('缺少当前原阿尔顿及原棍来源，或已用完本轮最多六槽；0贡献0消耗，不重抽。');
  const e = s.insightScholar.encounter, power = INSIGHT_SCHOLAR_POWERS.find(x => x.id === planned);
  const a: InsightScholarEnemyAction = { ...actionBase(r.playerActions.length + r.enemyActions.length, physical), planned,
    actual: power && e.enemySpirituality < power.cost ? 'BODY_STRIKE' : planned, focusGranted: false };
  if (power && a.actual === planned) {
    e.enemySpirituality -= power.cost; e.powerUses[power.id]++; a.paidCost = power.cost; a.selfGain = power.selfGain; a.enemyReduction = power.enemyReduction;
    // Only an actually executed, paid, visible method enters this original opponent's encounter-local observations.
    if (a.paidCost > 0 && (a.actual === 'FLASH' || a.actual === 'WARD'))
      e.seenPowers = INSIGHT_SCHOLAR_POWER_IDS.filter((id): id is InsightScholarSeenPower => id !== 'FOCUS' && e.powerUses[id] > 0);
  }
  if (a.actual === 'ACCIDENT') { a.selfGain = -22.5; a.label = '原阿尔顿判断失衡，本槽固定−22.5G，不另抽。'; }
  else if (a.actual === 'BODY_STRIKE') { a.selfGain = 20 * a.physicalFactor; a.threatens = a.selfGain > 0;
    a.label = `${power ? '原法术灵性不足，未实际施展且不记为已见；' : ''}原阿尔顿持唯一IS3-ALTON-CLUB普通打击20×身体G，0S，无新武器或额外行动。`; }
  else if (a.actual === 'FOCUS') { r.focusReady = true; a.focusGranted = true;
    a.label = '原阿尔顿实付4S本轮专注，只抵下一次成功形成的原FLASH、原片闪光或方法压力一次，0直接优势；不叠加、不跨轮，未触发不假称伤害。'; }
  else { a.threatens = a.actual === 'FLASH'; a.label = `原阿尔顿${power!.label}实际付费${a.paidCost}S，${a.threatens ? '有限优势75' : '有限减势45'}G，余${e.enemySpirituality}/120；本人亲见此实际施展，不因此学会对方能力。`; }
  r.enemyActions.push(a); r.liveState = liveState(s);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export interface InsightScholarRoundOutcome {
  targetId: typeof INSIGHT_SCHOLAR_TARGET_ID; round: number; source: InsightScholarCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number;
  powerUses: Record<InsightScholarPowerId, number>; seenPowers: InsightScholarSeenPower[]; craftsAfter: MysticismMagisterCraft[];
  consumedCraftIds: string[]; focusReadyAfter: false; elapsedSeconds: 60; playerActions: InsightScholarPlayerAction[]; enemyActions: InsightScholarEnemyAction[];
}
export function finishInsightScholarCombatRound(s: SliceState, r: InsightScholarRoundContext, continuing = true): InsightScholarRoundOutcome {
  const e = s.insightScholar.encounter, c = s.combat;
  if (r.finished || !c || c.encounterId !== 'INSIGHT_SCHOLAR_DISPUTE' || c.round !== r.source.round || r.liveState !== liveState(s))
    throw new Error('原洞悉者候选G回合已结束，或同一原资源已被改写。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  if (e.enemyStatus !== 'RESISTING') e.weaponLocation = 'YARD';
  s.insightScholar.life.clockSeconds += 60; r.focusReady = false; r.finished = true;
  r.outcome = { targetId: INSIGHT_SCHOLAR_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus,
    playerSpiritualityBefore: r.source.playerSpirituality, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind,
    enemySpiritualityBefore: r.source.enemySpirituality, powerUses: { ...e.powerUses }, seenPowers: [...e.seenPowers], craftsAfter: structuredClone(s.mysticismMagister.crafts),
    consumedCraftIds: r.playerActions.flatMap(a => a.consumedCraftId === null ? [] : [a.consumedCraftId]), focusReadyAfter: false,
    elapsedSeconds: 60, playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
  return structuredClone(r.outcome);
}
export function insightScholarRoundOutcome(r: InsightScholarRoundContext): InsightScholarRoundOutcome {
  if (!r.outcome) throw new Error('先实际结束当前原洞悉者候选G回合。'); return structuredClone(r.outcome);
}
export function projectInsightScholarCombat(s: SliceState) {
  const e = s.insightScholar.encounter, visible = isInsightScholar(s);
  return { enemyName: visible ? '阿尔顿（47岁，原创有限G3非凡者）' : '', targetId: visible ? e.targetId : null,
    enemyMind: visible ? e.enemyMind : null, enemySpirituality: visible ? e.enemySpirituality : null,
    powerUses: visible ? { ...e.powerUses } : null, seenPowers: visible ? [...e.seenPowers] : [],
    crafts: visible ? structuredClone(s.mysticismMagister.crafts) : [], remainingCraftIds: visible ? s.mysticismMagister.crafts.filter(c => c.status === 'PLAYER').map(c => c.id) : [],
    originalExit: true, pursuit: false, distanceMetres: 2, source: visible ? currentInsightScholarCombatSource(s) : null,
    summary: visible ? '洞悉者·阅读者序列3候选（G扩展），未原著核实。双方1–6次权重10/15/25/25/15/10；继承实际4核心35/25/25/15、1250/底125、S120，仅继续轮恢复12G。玩家六槽25/25/15/20/10/5，敌五类35/25/20/15/5。方法辨析只用本场已实际亲见FLASH/WARD，未见普通避让10/0S；继承片段预警、真实旧FLASH和原微光片，不读未来、复制技能或增加库存。共同伤势盘决定原身体后果，旧哈罗德实际结局及原物保留。' : '' };
}
/** Replay only actual observations, finite costs, inherited original crafts and one-round resistance. */
export function validateInsightScholarRoundOutcome(value: unknown): value is InsightScholarRoundOutcome {
  try {
    const o = value as InsightScholarRoundOutcome, x = o?.source;
    if (!o || !x || typeof x.runId !== 'string' || !integer(x.revision) || !integer(x.week, 1) || !integer(x.round, 1) || !integer(x.startHistoryIndex) || x.attemptWeek !== x.week ||
        x.encounterId !== 'INSIGHT_SCHOLAR_DISPUTE' || x.targetId !== INSIGHT_SCHOLAR_TARGET_ID || x.targetAge !== 47 || x.targetSequence !== 3 || x.actualOriginalBody !== true || x.independentMind !== true ||
        x.enemyWeapon !== 'IS3-ALTON-CLUB' || x.weaponLocation !== 'HAND' || x.distanceMetres !== 2 || x.space !== 'IS3-OPEN-COURT' || x.ordinaryExit !== true || x.pursuit !== false ||
        ![x.playerHealth, x.playerMind, x.enemyHealth, x.enemyMind].every(n => integer(n, 1, 100)) || !integer(x.knowledge, 0, 500) || !integer(x.will, 0, 500) || !integer(x.imitationMastery, 0, 500) ||
        typeof x.clubHeld !== 'boolean' || !x.flashSample || !Array.isArray(x.crafts) || !integer(x.kitsUsed) ||
        Object.values(x.flashSample).some(w => w !== null && !integer(w, 1, x.week)) ||
        (x.craftingPromotionWeek !== null && !integer(x.craftingPromotionWeek, 1, x.week)) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(x.craftingCaseStatus) ||
        o.targetId !== INSIGHT_SCHOLAR_TARGET_ID || o.round !== x.round || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) ||
        typeof o.continuing !== 'boolean' || o.elapsedSeconds !== 60 || o.focusReadyAfter !== false ||
        ![o.enemyHealth, o.playerHealthAfter].every(n => integer(n, 0, 100)) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(o.enemyStatus) || (o.enemyStatus === 'DEAD') !== (o.enemyHealth === 0) ||
        o.enemyMind !== x.enemyMind || o.playerMindAfter !== x.playerMind || ![x.playerSpirituality, x.enemySpirituality, o.playerSpiritualityAfter, o.enemySpirituality].every(n => integer(n, 0, 120)) ||
        o.playerSpiritualityBefore !== x.playerSpirituality || o.enemySpiritualityBefore !== x.enemySpirituality || !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) ||
        o.playerActions.length > 6 || o.enemyActions.length > 6 || !x.powerUses || Object.keys(x.powerUses).length !== 3 ||
        !INSIGHT_SCHOLAR_POWER_IDS.every(id => integer(x.powerUses[id])) || x.enemySpirituality !== 120 - INSIGHT_SCHOLAR_POWERS.reduce((n, p) => n + x.powerUses[p.id] * p.cost, 0) ||
        !same(x.seenPowers, INSIGHT_SCHOLAR_POWER_IDS.filter(id => id !== 'FOCUS' && x.powerUses[id] > 0))) return false;
    const crafts = structuredClone(x.crafts), powers = { ...x.powerUses }, consumed: string[] = []; let seen = [...x.seenPowers];
    let playerS = x.playerSpirituality, enemyS = x.enemySpirituality, focus = false;
    const actions = [...o.playerActions.map(a => ({ actor: 'PLAYER' as const, a })), ...o.enemyActions.map(a => ({ actor: 'ENEMY' as const, a }))].sort((a, b) => a.a.order - b.a.order);
    for (const [i, entry] of actions.entries()) {
      const a = entry.a;
      if (a.order !== i || !integer(a.paidCost) || !Number.isFinite(a.selfGain) || !Number.isFinite(a.enemyReduction) || a.enemyReduction < 0 ||
          !Number.isFinite(a.physicalFactor) || a.physicalFactor < 0 || a.physicalFactor > 1 || typeof a.label !== 'string' || typeof a.threatens !== 'boolean' || a.mentalPressure !== false ||
          !Array.isArray(a.rolls) || a.rolls.some(n => !integer(n, 1, 100))) return false;
      if (entry.actor === 'PLAYER') {
        const b = entry.a;
        if (![...ABILITIES.map(v => v.id), 'EVADE', 'OBSERVE'].includes(b.id) || typeof b.resisted !== 'boolean') return false;
        const observedPower = b.id === ANALYSIS ? seen[0] ?? null : null;
        const required = b.id === ANALYSIS ? 5 : b.id === FORESIGHT ? 4 : b.id === FLASH ? 2 : 0;
        const eligible = b.id === ANALYSIS ? observedPower !== null : b.id === FLASH ? hasLearnedFlash(x.flashSample, x.week) : true;
        const paid = required > 0 && eligible && playerS >= required ? required : 0;
        if (b.paidCost !== paid || b.observedPower !== observedPower || b.rolls.length !== (paid > 0 ? 1 : 0)) return false;
        const success = paid > 0 && b.rolls[0]! <= computeCheckChance({ ability: b.id === FORESIGHT ? 'will' : 'knowledge',
          baseAbility: b.id === FORESIGHT ? x.will : x.knowledge, difficulty: b.id === ANALYSIS ? 18 : b.id === FORESIGHT ? 16 : 14, modifiers: [] });
        playerS -= paid; let gain = 0, reduction = 0, craftId: string | null = null;
        if (b.id === 'ACCIDENT') gain = -22.5;
        else if (b.id === 'STRIKE') gain = (x.clubHeld ? 16 : 12) * b.physicalFactor;
        else if (b.id === 'EVADE' || b.id === ANALYSIS && !paid) reduction = 10;
        else if (b.id === ANALYSIS && success) reduction = 35;
        else if (b.id === FORESIGHT && success) reduction = 22;
        else if (b.id === FLASH && success) reduction = 12 * (.65 + .35 * x.imitationMastery / 500);
        else if (b.id === MATERIAL) { const craft = oldestPreparedFlash({ ...x, crafts });
          if (craft) { craftId = craft.id; craft.status = 'CONSUMED'; craft.usedWeek = x.week; consumed.push(craft.id); reduction = 18 * craft.power; } }
        const resisted = [ANALYSIS, FLASH, MATERIAL].includes(b.id) && reduction > 0 && (paid > 0 || craftId !== null) && focus;
        if (resisted) { focus = false; reduction = 0; }
        if (b.selfGain !== gain || b.enemyReduction !== reduction || b.threatens !== (gain > 0) || b.resisted !== resisted || b.consumedCraftId !== craftId) return false;
      } else {
        const b = entry.a, power = INSIGHT_SCHOLAR_POWERS.find(v => v.id === b.planned);
        if (![...INSIGHT_SCHOLAR_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(b.planned) || b.rolls.length !== 0) return false;
        const actual = power && enemyS < power.cost ? 'BODY_STRIKE' : b.planned, cost = power && actual === b.planned ? power.cost : 0;
        if (b.actual !== actual || b.paidCost !== cost || b.focusGranted !== (actual === 'FOCUS')) return false;
        enemyS -= cost; if (power && cost > 0) powers[power.id]++;
        if (cost > 0 && (actual === 'FLASH' || actual === 'WARD'))
          seen = INSIGHT_SCHOLAR_POWER_IDS.filter((id): id is InsightScholarSeenPower => id !== 'FOCUS' && powers[id] > 0);
        if (actual === 'FOCUS') focus = true;
        const gain = actual === 'ACCIDENT' ? -22.5 : actual === 'BODY_STRIKE' ? 20 * b.physicalFactor : actual === 'FLASH' ? 75 : 0;
        if (b.selfGain !== gain || b.enemyReduction !== (actual === 'WARD' ? 45 : 0) || b.threatens !== (gain > 0)) return false;
      }
    }
    return playerS === o.playerSpiritualityAfter && enemyS === o.enemySpirituality && same(powers, o.powerUses) && same(seen, o.seenPowers) &&
      same(crafts, o.craftsAfter) && same(consumed, o.consumedCraftIds);
  } catch { return false; }
}
