import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { FERRYMAN_TARGET_ID, FERRYMAN_POWERS, FERRYMAN_POWER_IDS, hasFerrymanDisputeOpponent,
  type FerrymanEnemyIntent, type FerrymanPowerId } from './encounter.js';

/** Finite Ferryman3 G combat. The shared adapter retains the actual S4 core and common injury wheel. */
export const FERRYMAN_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const FERRYMAN_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const ferrymanActionCount = pyromaniacActionCount;
export const ferrymanEnemyActionCount = pyromaniacActionCount;
const FERRY = 'death.s3.bounded-ferry', WARD = 'death.s3.departure-ward';
const WORDS = 'death.s6.dead-words', SEAL = 'death.s4.underworld-seal';
export type FerrymanMoveId = typeof FERRY | typeof WARD | typeof SEAL | typeof WORDS | 'EVADE' | 'ACCIDENT';
const ABILITIES: readonly { id: FerrymanMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: FERRY, label: '有限摆渡（H；原创G，6S/意志18，灵体迟滞减势36）', weight: 25, stance: 'ATTACK' },
  { id: WARD, label: '离程屏护（J；原创G，6S/知识18，短时减势32）', weight: 20, stance: 'CONTROL' },
  { id: WORDS, label: '继承死者之语（B；6S/意志16，优势38×原掌握G）', weight: 20, stance: 'DEFEND' },
  { id: SEAL, label: '继承冥界借力封印（K；6S/知识16，减势20×原掌握G）', weight: 15, stance: 'CONTROL' },
  { id: 'EVADE', label: '普通避让（R；减势10G、0S）', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A；固定−22.5G）', weight: 5, stance: null },
];
export const FERRYMAN_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ECHO_STRIKE', label: '原创G有限灵体干扰攻击：5S/75G', weight: 35 }, { id: 'SEAL_WARD', label: '原创G有限屏护：4S/减45G', weight: 25 },
  { id: 'BODY_STRIKE', label: '同一原棍：20×身体G', weight: 20 }, { id: 'FOCUS', label: '原创G有限定神：4S/抵本轮下一成功摆渡或旧封印牵制，不抵攻击', weight: 15 },
  { id: 'ACCIDENT', label: '判断偏差：−22.5G', weight: 5 },
];
export const isFerryman = (s: SliceState): boolean => s.progression.pathwayId === 'death' && s.progression.sequence === 3;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function ferrymanAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 }));
}
export function drawFerrymanAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): FerrymanMoveId {
  const weights = tickets(stance); let n = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return a.id; } throw new Error('摆渡人六槽能力盘无效。');
}
export function drawFerrymanEnemyAbility(random: ActionRandomStream): FerrymanEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of FERRYMAN_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as FerrymanEnemyIntent; }
  throw new Error('原罗温·谢尔五类行动盘无效。');
}
export interface FerrymanCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'FERRYMAN_DISPUTE'; targetId: typeof FERRYMAN_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetAge: 51; targetSequence: 3; actualOriginalBody: true; independentMind: true;
  enemyWeapon: 'FR3-ROWAN-CLUB'; weaponLocation: 'HAND'; distanceMetres: 2; space: 'FR3-COURT';
  sourceEpoch: 'ORIGINAL' | 'POST_CYCLE'; providerId: 'FR3-LEWIS' | 'FR3-HANNA'; abilitySource: 'ORIGINAL_LIMITED_G_SPIRIT'; automaticSpiritAlly: false; clearanceConfirmed: true; ordinaryExit: true; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyInjuries: SliceInjury[]; enemyRisk: number; clubHeld: boolean; knowledge: number; will: number;
  sealMastery: number; deadWordsMastery: number; powerUses: Record<FerrymanPowerId, number>;
}
const bounded = (n: number, max: number) => Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
// Exact inherited Undying implementation: 0.65 + 0.35 * clamp(mastery, 0, 500) / 500.
const mastery = (n: number) => .65 + .35 * bounded(n, 500) / 500;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
export function currentFerrymanCombatSource(s: SliceState): FerrymanCombatSource | null {
  if (!hasFerrymanDisputeOpponent(s)) return null;
  const e = s.ferryman.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'FERRYMAN_DISPUTE', targetId: FERRYMAN_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetAge: 51, targetSequence: 3, actualOriginalBody: true, independentMind: true,
    enemyWeapon: 'FR3-ROWAN-CLUB', weaponLocation: 'HAND', distanceMetres: 2, space: 'FR3-COURT', sourceEpoch: e.sourceEpoch!, providerId: e.sourceEpoch === 'ORIGINAL' ? 'FR3-LEWIS' : 'FR3-HANNA', abilitySource: 'ORIGINAL_LIMITED_G_SPIRIT', automaticSpiritAlly: false, clearanceConfirmed: true,
    ordinaryExit: true, pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality,
    enemyInjuries: structuredClone(c.enemyInjuries), enemyRisk: c.enemyRisk, clubHeld: s.town.clubLocation === 'HAND',
    knowledge: s.character.coreStats.knowledge, will: s.character.coreStats.will,
    sealMastery: bounded(s.progression.mastery[SEAL] ?? 0, 500), deadWordsMastery: bounded(s.progression.mastery[WORDS] ?? 0, 500), powerUses: { ...e.powerUses } };
}
export interface FerrymanCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean }
interface ActionEvidence extends FerrymanCombatEffect { order: number; paidCost: number; physicalFactor: number; rolls: number[] }
export interface FerrymanPlayerAction extends ActionEvidence { id: FerrymanMoveId; resisted: boolean; fallback: 'NONE' | 'STRIKE' | 'EVADE' | 'OBSERVE' }
export interface FerrymanEnemyAction extends ActionEvidence { planned: FerrymanEnemyIntent; actual: FerrymanEnemyIntent; focusGranted: boolean }
export interface FerrymanRoundContext {
  source: FerrymanCombatSource; stance: SliceStance; finished: boolean; liveState: string; focusReady: boolean;
  playerActions: FerrymanPlayerAction[]; enemyActions: FerrymanEnemyAction[]; label: string; outcome: FerrymanRoundOutcome | null;
}
const none = (label: string): FerrymanCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
function liveState(s: SliceState): string {
  return stableStringify({ spirituality: s.spirituality, encounter: s.ferryman.encounter });
}
const dynamicSource = new Set(['playerSpirituality', 'enemySpirituality', 'powerUses']);
function validRound(s: SliceState, r: FerrymanRoundContext, supplied: FerrymanCombatSource | null): boolean {
  const actual = currentFerrymanCombatSource(s);
  return !r.finished && actual !== null && supplied !== null && same(supplied, r.source) && r.liveState === liveState(s) &&
    Object.entries(r.source).every(([key, value]) => dynamicSource.has(key) || same(actual[key as keyof FerrymanCombatSource], value));
}
export function beginFerrymanCombatRound(s: SliceState, stance: SliceStance, _random: ActionRandomStream): FerrymanRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('摆渡人战斗姿态无效。');
  const source = currentFerrymanCombatSource(s); if (!source) throw new Error('缺少原罗温·谢尔、原棍或原干院的连续来源。');
  return { source, stance, finished: false, liveState: liveState(s), focusReady: false, playerActions: [], enemyActions: [], outcome: null,
    label: `同一51岁原罗温·谢尔在本次${source.sourceEpoch === 'ORIGINAL' ? '原时代' : '后世'}渠道实际接触的原干院2米外，独立S${source.enemySpirituality}/120。本区已确认无第三人；原灰羽与当地原芦羽均不自动参战，摆渡不搬运活人或控制其灵魂。` };
}
export const createFerrymanCombatRound = beginFerrymanCombatRound;
function actionBase(order: number, physical: number): ActionEvidence { return { ...none(''), order, paidCost: 0, physicalFactor: bounded(physical, 1), rolls: [] }; }
function check(s: SliceState, a: ActionEvidence, ability: 'knowledge' | 'will', difficulty: number, random: ActionRandomStream): boolean {
  const chance = computeCheckChance({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [] }), roll = random.nextInt(1, 100);
  a.rolls.push(roll); return roll <= chance;
}
export function resolveFerrymanCombatAbility(s: SliceState, id: FerrymanMoveId, physical: number, random: ActionRandomStream,
  r: FerrymanRoundContext, source: FerrymanCombatSource | null = r.source): FerrymanCombatEffect {
  if (!validRound(s, r, source) || r.playerActions.length >= 6 || !ABILITIES.some(a => a.id === id))
    return none('缺少当前原人、原场与原资源来源，或已用完本轮最多六槽；0贡献0消耗，不重抽。');
  const a: FerrymanPlayerAction = { ...actionBase(r.playerActions.length + r.enemyActions.length, physical), id, resisted: false, fallback: 'NONE' };
  if (id === 'ACCIDENT') { a.selfGain = -22.5; a.label = '判断失衡固定−22.5G，不重抽或增加行动。'; }
  else if (id === 'EVADE') { a.enemyReduction = 10; a.label = '本人在原净空干院普通避让，减势10G、0S；不制造免费屏障或保证免伤。'; }
  else {
    const seal = id === SEAL, ward = id === WARD, words = id === WORDS, cost = 6;
    if (!Number.isFinite(s.spirituality) || s.spirituality < cost) {
      a.fallback = words ? 'STRIKE' : seal ? 'EVADE' : 'OBSERVE';
      if (a.fallback === 'STRIKE') { a.selfGain = (r.source.clubHeld ? 16 : 12) * a.physicalFactor; a.threatens = a.selfGain > 0; }
      else if (a.fallback === 'EVADE') a.enemyReduction = 10;
      a.label = `不足${cost}S，本槽未施法。` + (a.fallback === 'STRIKE' ? `只以${r.source.clubHeld ? '实际自持原棍16' : '自己的原身体12'}×身体普通打击G` : a.fallback === 'EVADE' ? '只用原身体普通避让减势10G' : '只作普通观察、0贡献') + '，0S、无免费法术，不重抽。';
    } else {
      s.spirituality -= cost; a.paidCost = cost;
      const ability = ward || seal ? 'knowledge' : 'will', difficulty = words || seal ? 16 : 18;
      const success = check(s, a, ability, difficulty, random);
      if (success) {
        a.selfGain = words ? 38 * mastery(r.source.deadWordsMastery) : 0;
        a.enemyReduction = id === FERRY ? 36 : ward ? 32 : seal ? 20 * mastery(r.source.sealMastery) : 0;
        // Only the inherited attack can threaten the body through the common injury wheel.
        a.threatens = words && a.selfGain > 0;
      }
      const name = id === FERRY ? '原创G有限摆渡，短暂迟滞当前灵体干扰窗口' : ward ? '原创G离程屏护，短暂压低攻击窗口' : seal ? '继承有限冥界借力封印' : '继承同一死者之语';
      a.label = `${name}实付${cost}S/${ability === 'knowledge' ? '知识' : '意志'}${difficulty}${success ? `成功，优势${a.selfGain}、减势${a.enemyReduction}G` : '失败，0贡献、实际成本保留'}；不直接扣H/M、不保证伤害或投降，不搬运活人、控制灵魂、永久封印或名称即死；不生成新灵或召回原灰羽。`;
    }
  }
  if ([FERRY, SEAL].includes(id) && a.paidCost > 0 && a.enemyReduction > 0 && r.focusReady) {
    r.focusReady = false; a.resisted = true; a.enemyReduction = 0;
    a.label += '原罗温·谢尔消耗本轮已付费定神的一次牵制抵抗，本次减势被抵消；实付成本不退，不抵离程屏护、死者之语攻击或共同伤势盘。';
  }
  r.playerActions.push(a); r.liveState = liveState(s);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export function resolveFerrymanEnemyAbility(s: SliceState, planned: FerrymanEnemyIntent, physical: number, _random: ActionRandomStream,
  r: FerrymanRoundContext, source: FerrymanCombatSource | null = r.source): FerrymanCombatEffect {
  if (!validRound(s, r, source) || r.enemyActions.length >= 6 || ![...FERRYMAN_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned))
    return none('缺少当前原罗温·谢尔及原棍来源，或已用完本轮最多六槽；0贡献0消耗，不重抽。');
  const e = s.ferryman.encounter, power = FERRYMAN_POWERS.find(x => x.id === planned);
  const a: FerrymanEnemyAction = { ...actionBase(r.playerActions.length + r.enemyActions.length, physical), planned,
    actual: power && e.enemySpirituality < power.cost ? 'BODY_STRIKE' : planned, focusGranted: false };
  if (power && a.actual === planned) {
    e.enemySpirituality -= power.cost; e.powerUses[power.id]++; a.paidCost = power.cost; a.selfGain = power.selfGain; a.enemyReduction = power.enemyReduction;
  }
  if (a.actual === 'ACCIDENT') { a.selfGain = -22.5; a.label = '原罗温·谢尔判断失衡，本槽固定−22.5G，不另抽。'; }
  else if (a.actual === 'BODY_STRIKE') { a.selfGain = 20 * a.physicalFactor; a.threatens = a.selfGain > 0;
    a.label = `${power ? '法术所需实际灵性不足，未施法；' : ''}原罗温·谢尔持唯一FR3-ROWAN-CLUB普通打击20×身体G，0S，无新武器或额外行动。`; }
  else if (a.actual === 'FOCUS') { r.focusReady = true; a.focusGranted = true;
    a.label = '原罗温·谢尔原创G定神实付4S，只抵本轮下一次成功有限摆渡或旧封印牵制一次，不抵离程屏护、死者之语攻击或共同伤势盘，0直接优势；不叠加、不跨轮。'; }
  else { a.threatens = a.actual === 'ECHO_STRIKE'; a.label = `原罗温·谢尔${power!.label}实际付费${a.paidCost}S，${a.threatens ? '有限优势75' : '原创G有限减势45'}G，余${e.enemySpirituality}/120；作用当次结束，原环境与实际消耗保留。`; }
  r.enemyActions.push(a); r.liveState = liveState(s);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export interface FerrymanRoundOutcome {
  targetId: typeof FERRYMAN_TARGET_ID; round: number; source: FerrymanCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  enemyInjuriesAfter: SliceInjury[]; enemyRiskAfter: number;
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number;
  powerUses: Record<FerrymanPowerId, number>; focusReadyAfter: false; elapsedSeconds: 60;
  playerActions: FerrymanPlayerAction[]; enemyActions: FerrymanEnemyAction[];
}
export function finishFerrymanCombatRound(s: SliceState, r: FerrymanRoundContext, continuing = true): FerrymanRoundOutcome {
  const e = s.ferryman.encounter, c = s.combat;
  if (r.finished || !c || c.encounterId !== 'FERRYMAN_DISPUTE' || c.round !== r.source.round || r.liveState !== liveState(s))
    throw new Error('原摆渡人回合已结束，或同一原资源已被改写。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  if (e.enemyStatus !== 'RESISTING') e.weaponLocation = 'COURT';
  s.ferryman.life.clockSeconds += 60; r.focusReady = false; r.finished = true;
  r.outcome = { targetId: FERRYMAN_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus,
    enemyInjuriesAfter: structuredClone(c.enemyInjuries), enemyRiskAfter: c.enemyRisk,
    playerSpiritualityBefore: r.source.playerSpirituality, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind,
    enemySpiritualityBefore: r.source.enemySpirituality, powerUses: { ...e.powerUses }, focusReadyAfter: false,
    elapsedSeconds: 60, playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
  return structuredClone(r.outcome);
}
export function ferrymanRoundOutcome(r: FerrymanRoundContext): FerrymanRoundOutcome {
  if (!r.outcome) throw new Error('先实际结束当前原摆渡人回合。'); return structuredClone(r.outcome);
}
/** Public historical evidence is copied by field; private replay sources stay in the save. */
const publicFerrymanInjury = (i: SliceInjury) => ({ id: i.id, severity: i.severity, acquiredRevision: i.acquiredRevision, treatedRevision: i.treatedRevision });
const publicFerrymanAction = (a: ActionEvidence) => ({ label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: a.mentalPressure, order: a.order, paidCost: a.paidCost, physicalFactor: a.physicalFactor, rolls: [...a.rolls] });
export const projectFerrymanPlayerAction = (a: FerrymanPlayerAction) => ({ ...publicFerrymanAction(a), id: a.id, resisted: a.resisted, fallback: a.fallback });
export const projectFerrymanEnemyAction = (a: FerrymanEnemyAction) => ({ ...publicFerrymanAction(a), planned: a.planned, actual: a.actual, focusGranted: a.focusGranted });
export function projectFerrymanRoundOutcome(o: FerrymanRoundOutcome) { return {
  targetId: o.targetId, round: o.round, stance: o.stance, continuing: o.continuing, enemyHealth: o.enemyHealth, enemyMind: o.enemyMind, enemySpirituality: o.enemySpirituality, enemyStatus: o.enemyStatus, enemyRiskAfter: o.enemyRiskAfter, playerSpiritualityBefore: o.playerSpiritualityBefore, playerSpiritualityAfter: o.playerSpiritualityAfter, playerHealthAfter: o.playerHealthAfter, playerMindAfter: o.playerMindAfter, enemySpiritualityBefore: o.enemySpiritualityBefore, focusReadyAfter: o.focusReadyAfter, elapsedSeconds: o.elapsedSeconds,
  enemyInjuriesAfter: o.enemyInjuriesAfter.map(publicFerrymanInjury),
  powerUses: Object.fromEntries(FERRYMAN_POWER_IDS.map(id => [id, o.powerUses[id]])) as Record<FerrymanPowerId, number>,
  playerActions: o.playerActions.map(projectFerrymanPlayerAction), enemyActions: o.enemyActions.map(projectFerrymanEnemyAction),
}; }
export type FerrymanPublicRoundOutcome = ReturnType<typeof projectFerrymanRoundOutcome>;

export function projectFerrymanCombat(s: SliceState) {
  const e = s.ferryman.encounter, visible = isFerryman(s);
  return { enemyName: visible ? '罗温·谢尔（51岁，原创有限G3非凡者）' : '', targetId: visible ? e.targetId : null,
    enemyMind: visible ? e.enemyMind : null, enemySpirituality: visible ? e.enemySpirituality : null,
    powerUses: visible ? { ...e.powerUses } : null, scene: visible ? { ...e.scene } : null,
    originalExit: true, pursuit: false, distanceMetres: 2, automaticAllyImmunity: false, automaticSpiritAlly: false,
    summary: visible ? '摆渡人序列3有限G战斗。双方1–6次权重10/15/25/25/15/10；继承实际不死者4核心35/25/25/15、1250/底125、S120，仅继续轮恢复12G。玩家六槽25/20/20/15/15/5，敌五类35/25/20/15/5。新有限摆渡6S/意志18减36，离程屏护6S/知识18减32，均不直接致伤。旧死者之语6S/意志16优势38×原掌握；旧冥界借力封印6S/知识16减20×原掌握，系数0.65+0.35×掌握/500。灵性不足仅普通0S回退，失败照耗。定神仅抵下一成功摆渡或旧封印，不挡护持、攻击与伤势盘。独立罗温及原棍属于本次真实渠道时代，旧欧文、原灰羽和当地原芦羽均不替代成战斗助手；无自动复活、控制灵魂或活人传送。' : '' };
}
/** Replays actual ordered paid actions and one-round resistance; never awards free spell effects. */
export function validateFerrymanRoundOutcome(value: unknown): value is FerrymanRoundOutcome {
  try {
    const o = value as FerrymanRoundOutcome, x = o?.source;
    if (!o || !x || typeof x.runId !== 'string' || !integer(x.revision) || !integer(x.week, 1) || !integer(x.round, 1) || !integer(x.startHistoryIndex) || x.attemptWeek !== x.week ||
        x.encounterId !== 'FERRYMAN_DISPUTE' || x.targetId !== FERRYMAN_TARGET_ID || x.targetAge !== 51 || x.targetSequence !== 3 || x.actualOriginalBody !== true || x.independentMind !== true ||
        x.enemyWeapon !== 'FR3-ROWAN-CLUB' || x.weaponLocation !== 'HAND' || x.distanceMetres !== 2 || x.space !== 'FR3-COURT' || x.ordinaryExit !== true || x.pursuit !== false ||
        x.thirdPartiesInArea !== 0 || x.automaticAllyImmunity !== false || x.abilitySource !== 'ORIGINAL_LIMITED_G_SPIRIT' || x.automaticSpiritAlly !== false || !['ORIGINAL', 'POST_CYCLE'].includes(x.sourceEpoch) || x.providerId !== (x.sourceEpoch === 'ORIGINAL' ? 'FR3-LEWIS' : 'FR3-HANNA') || x.clearanceConfirmed !== true ||
        ![x.playerHealth, x.playerMind, x.enemyHealth, x.enemyMind].every(n => integer(n, 1, 100)) ||
        ![x.knowledge, x.will, x.sealMastery, x.deadWordsMastery].every(n => integer(n, 0, 500)) || typeof x.clubHeld !== 'boolean' ||
        !Array.isArray(x.enemyInjuries) || !integer(x.enemyRisk) || !Array.isArray(o.enemyInjuriesAfter) || !integer(o.enemyRiskAfter) ||
        o.targetId !== FERRYMAN_TARGET_ID || o.round !== x.round || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) ||
        typeof o.continuing !== 'boolean' || o.elapsedSeconds !== 60 || o.focusReadyAfter !== false ||
        ![o.enemyHealth, o.playerHealthAfter].every(n => integer(n, 0, 100)) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(o.enemyStatus) || (o.enemyStatus === 'DEAD') !== (o.enemyHealth === 0) ||
        o.enemyMind !== x.enemyMind || o.playerMindAfter !== x.playerMind || ![x.playerSpirituality, x.enemySpirituality, o.playerSpiritualityAfter, o.enemySpirituality].every(n => integer(n, 0, 120)) ||
        o.playerSpiritualityBefore !== x.playerSpirituality || o.enemySpiritualityBefore !== x.enemySpirituality || !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) ||
        o.playerActions.length > 6 || o.enemyActions.length > 6 || !x.powerUses || Object.keys(x.powerUses).length !== 3 ||
        !FERRYMAN_POWER_IDS.every(id => integer(x.powerUses[id])) || x.enemySpirituality !== 120 - FERRYMAN_POWERS.reduce((n, p) => n + x.powerUses[p.id] * p.cost, 0)) return false;
    const powers = { ...x.powerUses }; let playerS = x.playerSpirituality, enemyS = x.enemySpirituality, focus = false;
    const actions = [...o.playerActions.map(a => ({ actor: 'PLAYER' as const, a })), ...o.enemyActions.map(a => ({ actor: 'ENEMY' as const, a }))].sort((a, b) => a.a.order - b.a.order);
    for (const [i, entry] of actions.entries()) {
      const a = entry.a;
      if (a.order !== i || !integer(a.paidCost) || !Number.isFinite(a.selfGain) || !Number.isFinite(a.enemyReduction) || a.enemyReduction < 0 ||
          !Number.isFinite(a.physicalFactor) || a.physicalFactor < 0 || a.physicalFactor > 1 || typeof a.label !== 'string' || typeof a.threatens !== 'boolean' || a.mentalPressure !== false ||
          !Array.isArray(a.rolls) || a.rolls.some(n => !integer(n, 1, 100))) return false;
      if (entry.actor === 'PLAYER') {
        const b = entry.a;
        if (!ABILITIES.some(v => v.id === b.id) || typeof b.resisted !== 'boolean') return false;
        const seal = b.id === SEAL, ward = b.id === WARD, words = b.id === WORDS;
        const required = b.id === 'EVADE' || b.id === 'ACCIDENT' ? 0 : 6;
        const paid = required > 0 && playerS >= required ? required : 0;
        const fallback = required > 0 && !paid ? words ? 'STRIKE' : seal ? 'EVADE' : 'OBSERVE' : 'NONE';
        if (b.paidCost !== paid || b.fallback !== fallback || b.rolls.length !== (paid > 0 ? 1 : 0)) return false;
        const ability = ward || seal ? 'knowledge' : 'will';
        const success = paid > 0 && b.rolls[0]! <= computeCheckChance({ ability,
          baseAbility: ability === 'knowledge' ? x.knowledge : x.will, difficulty: words || seal ? 16 : 18, modifiers: [] });
        playerS -= paid; let gain = 0, reduction = 0, threatens = false;
        if (b.id === 'ACCIDENT') gain = -22.5;
        else if (fallback === 'STRIKE') { gain = (x.clubHeld ? 16 : 12) * b.physicalFactor; threatens = gain > 0; }
        else if (b.id === 'EVADE' || fallback === 'EVADE') reduction = 10;
        else if (success) { gain = words ? 38 * mastery(x.deadWordsMastery) : 0;
          reduction = b.id === FERRY ? 36 : ward ? 32 : seal ? 20 * mastery(x.sealMastery) : 0; threatens = words && gain > 0; }
        const resisted = [FERRY, SEAL].includes(b.id) && paid > 0 && reduction > 0 && focus;
        if (resisted) { focus = false; reduction = 0; }
        if (b.selfGain !== gain || b.enemyReduction !== reduction || b.threatens !== threatens || b.resisted !== resisted) return false;
      } else {
        const b = entry.a, power = FERRYMAN_POWERS.find(v => v.id === b.planned);
        if (![...FERRYMAN_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(b.planned) || b.rolls.length !== 0) return false;
        const actual = power && enemyS < power.cost ? 'BODY_STRIKE' : b.planned, cost = power && actual === b.planned ? power.cost : 0;
        if (b.actual !== actual || b.paidCost !== cost || b.focusGranted !== (actual === 'FOCUS')) return false;
        enemyS -= cost; if (power && cost > 0) powers[power.id]++;
        if (actual === 'FOCUS') focus = true;
        const gain = actual === 'ACCIDENT' ? -22.5 : actual === 'BODY_STRIKE' ? 20 * b.physicalFactor : actual === 'ECHO_STRIKE' ? 75 : 0;
        if (b.selfGain !== gain || b.enemyReduction !== (actual === 'SEAL_WARD' ? 45 : 0) || b.threatens !== (gain > 0)) return false;
      }
    }
    return playerS === o.playerSpiritualityAfter && enemyS === o.enemySpirituality && same(powers, o.powerUses);
  } catch { return false; }
}
