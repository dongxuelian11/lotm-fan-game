import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { WANDERER_TARGET_ID, WANDERER_POWERS, WANDERER_POWER_IDS, hasWandererDisputeOpponent,
  type WandererEnemyIntent, type WandererPowerId } from './encounter.js';

/** Finite local G combat. Actual offworld travel belongs to the original-object life cases. */
export const WANDERER_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const WANDERER_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const wandererActionCount = pyromaniacActionCount;
export const wandererEnemyActionCount = pyromaniacActionCount;
const WANDER = 'door.s3.star-wandering', POSITION = 'door.s3.astral-positioning';
const TRICKS = 'door.s8.tricks', TRAVEL = 'door.s5.travel';
export type WandererMoveId = typeof WANDER | typeof POSITION | typeof TRICKS | typeof TRAVEL | 'EVADE' | 'ACCIDENT';
const ABILITIES: readonly { id: WandererMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: WANDER, label: '有限本地侧避并返原位（H；6S/感知18，减势36G）', weight: 25, stance: 'ATTACK' },
  { id: POSITION, label: '星界定位校准（J；6S/知识18，自身优势30G，不杀伤）', weight: 20, stance: 'CONTROL' },
  { id: TRICKS, label: '继承小电击（B；6S/知识16，优势36×原掌握G）', weight: 20, stance: 'DEFEND' },
  { id: TRAVEL, label: '继承同位置短程闪避（K；6S/感知16，减势22×原掌握G）', weight: 15, stance: 'CONTROL' },
  { id: 'EVADE', label: '普通避让（R；减势10G、0S）', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A；固定−22.5G）', weight: 5, stance: null },
];
export const WANDERER_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'VECTOR_STRIKE', label: '原创G有限定点折光击：5S/75G', weight: 35 },
  { id: 'REFRACT_WARD', label: '原创G有限折光屏护：4S/减45G', weight: 25 },
  { id: 'BODY_STRIKE', label: '同一原杖：20×身体G', weight: 20 },
  { id: 'PARALLAX', label: '原创G本轮视差：4S/抵下一成功定位或侧避一次', weight: 15 },
  { id: 'ACCIDENT', label: '判断偏差：−22.5G', weight: 5 },
];
export const isWanderer = (s: SliceState): boolean => s.progression.pathwayId === 'door' && s.progression.sequence === 3;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function wandererAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 }));
}
export function drawWandererAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): WandererMoveId {
  const weights = tickets(stance); let n = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return a.id; }
  throw new Error('漫游者六槽能力盘无效。');
}
export function drawWandererEnemyAbility(random: ActionRandomStream): WandererEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of WANDERER_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as WandererEnemyIntent; }
  throw new Error('原卡西安五类行动盘无效。');
}
export interface WandererCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'WANDERER_DISPUTE'; targetId: typeof WANDERER_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetAge: 49; targetSequence: 3; actualOriginalBody: true; independentMind: true;
  enemyWeapon: 'WN3-CASSIAN-ROD'; weaponLocation: 'HAND'; distanceMetres: 2; space: 'WN3-COURT'; playerPosition: 'ORIGIN';
  abilitySource: 'ORIGINAL_LIMITED_G_SPACE'; clearanceConfirmed: true; ordinaryExit: true; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyInjuries: SliceInjury[]; enemyRisk: number; clubHeld: boolean; knowledge: number; perception: number;
  tricksMastery: number; travelMastery: number; powerUses: Record<WandererPowerId, number>;
}
const bounded = (n: number, max: number) => Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
// Inherited Door mastery scaling, with no change to original records or pocket contents.
const mastery = (n: number) => .65 + .35 * bounded(n, 500) / 500;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
export function currentWandererCombatSource(s: SliceState): WandererCombatSource | null {
  if (!hasWandererDisputeOpponent(s)) return null;
  const e = s.wanderer.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'WANDERER_DISPUTE', targetId: WANDERER_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetAge: 49, targetSequence: 3, actualOriginalBody: true, independentMind: true,
    enemyWeapon: 'WN3-CASSIAN-ROD', weaponLocation: 'HAND', distanceMetres: 2, space: 'WN3-COURT', playerPosition: 'ORIGIN',
    abilitySource: 'ORIGINAL_LIMITED_G_SPACE', clearanceConfirmed: true, ordinaryExit: true, pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality,
    enemyInjuries: structuredClone(c.enemyInjuries), enemyRisk: c.enemyRisk, clubHeld: s.town.clubLocation === 'HAND',
    knowledge: s.character.coreStats.knowledge, perception: s.character.coreStats.perception,
    tricksMastery: bounded(s.progression.mastery[TRICKS] ?? 0, 500), travelMastery: bounded(s.progression.mastery[TRAVEL] ?? 0, 500), powerUses: { ...e.powerUses } };
}
export interface WandererCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean }
interface ActionEvidence extends WandererCombatEffect { order: number; paidCost: number; physicalFactor: number; rolls: number[] }
export interface WandererCombatMovement {
  from: 'ORIGIN' | 'SIDE'; to: 'ORIGIN' | 'SIDE'; metres: 1; actualOriginalBody: true;
  enemyDistanceBefore: number; enemyDistanceAfter: number;
}
export interface WandererPlayerAction extends ActionEvidence {
  id: WandererMoveId; resisted: boolean; fallback: 'NONE' | 'STRIKE' | 'EVADE' | 'OBSERVE'; movements: WandererCombatMovement[];
}
export interface WandererEnemyAction extends ActionEvidence { planned: WandererEnemyIntent; actual: WandererEnemyIntent; parallaxGranted: boolean }
export interface WandererRoundContext {
  source: WandererCombatSource; stance: SliceStance; finished: boolean; liveState: string; parallaxReady: boolean;
  playerActions: WandererPlayerAction[]; enemyActions: WandererEnemyAction[]; label: string; outcome: WandererRoundOutcome | null;
}
const none = (label: string): WandererCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
const roundTrip = (): WandererCombatMovement[] => [
  { from: 'ORIGIN', to: 'SIDE', metres: 1, actualOriginalBody: true, enemyDistanceBefore: 2, enemyDistanceAfter: Math.sqrt(5) },
  { from: 'SIDE', to: 'ORIGIN', metres: 1, actualOriginalBody: true, enemyDistanceBefore: Math.sqrt(5), enemyDistanceAfter: 2 },
];
function liveState(s: SliceState): string { return stableStringify({ spirituality: s.spirituality, encounter: s.wanderer.encounter }); }
const dynamicSource = new Set(['playerSpirituality', 'enemySpirituality', 'powerUses']);
function validRound(s: SliceState, r: WandererRoundContext, supplied: WandererCombatSource | null): boolean {
  const actual = currentWandererCombatSource(s);
  return !r.finished && actual !== null && supplied !== null && same(supplied, r.source) && r.liveState === liveState(s) &&
    Object.entries(r.source).every(([key, value]) => dynamicSource.has(key) || same(actual[key as keyof WandererCombatSource], value));
}
export function beginWandererCombatRound(s: SliceState, stance: SliceStance, _random: ActionRandomStream): WandererRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('漫游者战斗姿态无效。');
  const source = currentWandererCombatSource(s); if (!source) throw new Error('缺少原卡西安、原杖或原干院的连续来源。');
  return { source, stance, finished: false, liveState: liveState(s), parallaxReady: false, playerActions: [], enemyActions: [], outcome: null,
    label: `同一49岁原卡西安·格里夫在净空原干院2米外，持唯一原杖、独立S${source.enemySpirituality}/120。侧避仅本地原侧位1米并同槽返回1米；原敌不移动，没有星际打击、隐形或自动免伤。` };
}
export const createWandererCombatRound = beginWandererCombatRound;
const actionBase = (order: number, physical: number): ActionEvidence => ({ ...none(''), order, paidCost: 0, physicalFactor: bounded(physical, 1), rolls: [] });
const checkAbility = (id: WandererMoveId) => id === WANDER || id === TRAVEL ? 'perception' as const : 'knowledge' as const;
const difficulty = (id: WandererMoveId) => id === TRICKS || id === TRAVEL ? 16 : 18;
function playerResult(x: WandererCombatSource, id: WandererMoveId, physical: number, playerS: number, roll: number | null, parallax: boolean) {
  const paidCost = id !== 'EVADE' && id !== 'ACCIDENT' && playerS >= 6 ? 6 : 0;
  const fallback = id === 'EVADE' || id === 'ACCIDENT' || paidCost ? 'NONE' as const : id === TRICKS ? 'STRIKE' as const : id === TRAVEL ? 'EVADE' as const : 'OBSERVE' as const;
  const ability = checkAbility(id), success = paidCost > 0 && roll !== null && roll <= computeCheckChance({ ability, baseAbility: x[ability], difficulty: difficulty(id), modifiers: [] });
  let selfGain = 0, enemyReduction = 0, threatens = false;
  if (id === 'ACCIDENT') selfGain = -22.5;
  else if (fallback === 'STRIKE') { selfGain = (x.clubHeld ? 16 : 12) * physical; threatens = selfGain > 0; }
  else if (id === 'EVADE' || fallback === 'EVADE') enemyReduction = 10;
  else if (success) {
    selfGain = id === POSITION ? 30 : id === TRICKS ? 36 * mastery(x.tricksMastery) : 0;
    enemyReduction = id === WANDER ? 36 : id === TRAVEL ? 22 * mastery(x.travelMastery) : 0;
    threatens = id === TRICKS && selfGain > 0;
  }
  const resisted = success && parallax && (id === WANDER || id === POSITION);
  if (resisted) { selfGain = 0; enemyReduction = 0; }
  return { paidCost, fallback, success, resisted, selfGain, enemyReduction, threatens,
    movements: success && id === WANDER && !resisted ? roundTrip() : [] };
}
export function resolveWandererCombatAbility(s: SliceState, id: WandererMoveId, physical: number, random: ActionRandomStream,
  r: WandererRoundContext, source: WandererCombatSource | null = r.source): WandererCombatEffect {
  if (!validRound(s, r, source) || r.playerActions.length >= 6 || !ABILITIES.some(a => a.id === id))
    return none('缺少当前原人、原场与原资源来源，或已用完本轮最多六槽；0贡献0消耗，不重抽。');
  const base = actionBase(r.playerActions.length + r.enemyActions.length, physical);
  if (id !== 'EVADE' && id !== 'ACCIDENT' && s.spirituality >= 6) base.rolls.push(random.nextInt(1, 100));
  const effect = playerResult(r.source, id, base.physicalFactor, s.spirituality, base.rolls[0] ?? null, r.parallaxReady);
  const { success, ...evidence } = effect;
  const a: WandererPlayerAction = { ...base, ...evidence, id };
  s.spirituality -= a.paidCost;
  if (a.resisted) r.parallaxReady = false;
  // Each completed side-step changes the same body's position before the same-slot return.
  for (const move of a.movements) s.wanderer.encounter.scene.playerPosition = move.to;
  if (id === 'ACCIDENT') a.label = '判断失衡固定−22.5G，不重抽或增加行动。';
  else if (id === 'EVADE') a.label = '本人在原净空干院普通避让，减势10G、0S，不保证免伤。';
  else if (!a.paidCost) a.label = `不足6S，本槽未施法；${a.fallback === 'STRIKE' ? `以${r.source.clubHeld ? '实际自持原棍16' : '自己的原身体12'}×身体普通打击G` : a.fallback === 'EVADE' ? '只用原身体普通避让减势10G' : '只作普通观察、0贡献'}，0S，不重抽。`;
  else {
    const name = id === WANDER ? '有限本地空间侧避' : id === POSITION ? '原创G有限星界定位校准' : id === TRICKS ? '继承同一戏法小电击' : '继承同位置短程闪避';
    a.label = `${name}实付6S/${checkAbility(id) === 'knowledge' ? '知识' : '感知'}${difficulty(id)}${success ? '成功' : '失败，0贡献、成本不退'}。`;
    if (a.resisted) a.label += '原卡西安消耗本轮已付费视差的一次抵抗，本次定位优势或侧避被抵消；本人仍在原位，不退成本。';
    else if (a.movements.length) a.label += '同一原身体真实向原侧位1米再返回原位1米，共2段2米；起止敌距2米，原敌与原杖未搬动，减势36G，不致伤。';
    else if (success) a.label += `自身优势${a.selfGain}、减势${a.enemyReduction}G；${id === POSITION ? '定位只校准当前已确认原场，不造成伤害或获知未知星空' : id === TRICKS ? '只有实际小电击参与共同伤势盘，非名称即伤' : '仅当前短程闪避，原身体在同一交手点结束'}。`;
  }
  r.playerActions.push(a); r.liveState = liveState(s);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export function resolveWandererEnemyAbility(s: SliceState, planned: WandererEnemyIntent, physical: number, _random: ActionRandomStream,
  r: WandererRoundContext, source: WandererCombatSource | null = r.source): WandererCombatEffect {
  if (!validRound(s, r, source) || r.enemyActions.length >= 6 || ![...WANDERER_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned))
    return none('缺少当前原卡西安及原杖来源，或已用完本轮最多六槽；0贡献0消耗，不重抽。');
  const e = s.wanderer.encounter, power = WANDERER_POWERS.find(x => x.id === planned);
  const a: WandererEnemyAction = { ...actionBase(r.playerActions.length + r.enemyActions.length, physical), planned,
    actual: power && e.enemySpirituality < power.cost ? 'BODY_STRIKE' : planned, parallaxGranted: false };
  if (power && a.actual === planned) {
    e.enemySpirituality -= power.cost; e.powerUses[power.id]++; a.paidCost = power.cost; a.selfGain = power.selfGain; a.enemyReduction = power.enemyReduction;
  }
  if (a.actual === 'ACCIDENT') { a.selfGain = -22.5; a.label = '原卡西安判断失衡，本槽固定−22.5G，不另抽。'; }
  else if (a.actual === 'BODY_STRIKE') { a.selfGain = 20 * a.physicalFactor; a.threatens = a.selfGain > 0;
    a.label = `${power ? '实际灵性不足，未施法；' : ''}原卡西安持唯一WN3-CASSIAN-ROD普通打击20×身体G，0S，无新武器或额外行动。`; }
  else if (a.actual === 'PARALLAX') { r.parallaxReady = true; a.parallaxGranted = true;
    a.label = '原卡西安原创G视差实付4S，只抵本轮下一次成功定位或新侧避一次；不抵小电击、旧旅行闪避、普通打击或伤势盘，0直接优势，不叠加、不跨轮。'; }
  else { a.threatens = a.actual === 'VECTOR_STRIKE'; a.label = `原卡西安${power!.label}实付${a.paidCost}S，${a.threatens ? '有限优势75' : '有限减势45'}G，余${e.enemySpirituality}/120；不搬动原人原物。`; }
  r.enemyActions.push(a); r.liveState = liveState(s);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export interface WandererRoundOutcome {
  targetId: typeof WANDERER_TARGET_ID; round: number; source: WandererCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  enemyInjuriesAfter: SliceInjury[]; enemyRiskAfter: number;
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number;
  powerUses: Record<WandererPowerId, number>; parallaxReadyAfter: false; elapsedSeconds: 60;
  playerPositionAfter: 'ORIGIN'; enemyDistanceAfter: 2; movementCount: number; totalMetres: number;
  playerActions: WandererPlayerAction[]; enemyActions: WandererEnemyAction[];
}
export function finishWandererCombatRound(s: SliceState, r: WandererRoundContext, continuing = true): WandererRoundOutcome {
  const e = s.wanderer.encounter, c = s.combat;
  if (r.finished || !c || c.encounterId !== 'WANDERER_DISPUTE' || c.round !== r.source.round || r.liveState !== liveState(s) || e.scene.playerPosition !== 'ORIGIN')
    throw new Error('原漫游者回合已结束，或同一原身体、原资源已被改写。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  if (e.enemyStatus !== 'RESISTING') e.weaponLocation = 'COURT';
  s.wanderer.life.clockSeconds += 60; r.parallaxReady = false; r.finished = true;
  const moves = r.playerActions.flatMap(a => a.movements);
  r.outcome = { targetId: WANDERER_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus,
    enemyInjuriesAfter: structuredClone(c.enemyInjuries), enemyRiskAfter: c.enemyRisk,
    playerSpiritualityBefore: r.source.playerSpirituality, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind,
    enemySpiritualityBefore: r.source.enemySpirituality, powerUses: { ...e.powerUses }, parallaxReadyAfter: false, elapsedSeconds: 60,
    playerPositionAfter: 'ORIGIN', enemyDistanceAfter: 2, movementCount: moves.length, totalMetres: moves.reduce((sum, a) => sum + a.metres, 0),
    playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
  return structuredClone(r.outcome);
}
export function wandererRoundOutcome(r: WandererRoundContext): WandererRoundOutcome {
  if (!r.outcome) throw new Error('先实际结束当前原漫游者回合。'); return structuredClone(r.outcome);
}
export function projectWandererCombat(s: SliceState) {
  const e = s.wanderer.encounter, visible = isWanderer(s);
  return { enemyName: visible ? '卡西安·格里夫（49岁，原创有限G3非凡者）' : '', targetId: visible ? e.targetId : null,
    enemyMind: visible ? e.enemyMind : null, enemySpirituality: visible ? e.enemySpirituality : null,
    powerUses: visible ? { ...e.powerUses } : null, scene: visible ? { ...e.scene } : null,
    originalExit: true, pursuit: false, distanceMetres: 2, automaticAllyImmunity: false, source: visible ? currentWandererCombatSource(s) : null,
    summary: visible ? '漫游者序列3有限G战斗。双方1–6次权重10/15/25/25/15/10；保留旧秘法师4核心35/25/25/15、1250/底125、S120，仅继续轮恢复12G。玩家六槽25/20/20/15/15/5，敌五类35/25/20/15/5。新侧避6S/感知18减36，同槽本体1米出再1米返；定位6S/知识18优势30，不杀伤。旧小电击6S/知识16优势36×掌握、旧旅行6S/感知16减22×掌握，系数0.65+0.35×掌握/500。只有小电击与普通STRIKE威胁共同伤势盘。视差仅抵下一成功新定位或侧避。原卡西安独立于旧半神，无记录复制或消费、隐形、星际打击、复活或任意星空目标。' : '' };
}
/** Replays ordered actual costs, one-use resistance and two finite same-body movement legs. */
export function validateWandererRoundOutcome(value: unknown): value is WandererRoundOutcome {
  try {
    const o = value as WandererRoundOutcome, x = o?.source;
    if (!o || !x || typeof x.runId !== 'string' || !integer(x.revision) || !integer(x.week, 1) || !integer(x.round, 1) || !integer(x.startHistoryIndex) || x.attemptWeek !== x.week ||
        x.encounterId !== 'WANDERER_DISPUTE' || x.targetId !== WANDERER_TARGET_ID || x.targetAge !== 49 || x.targetSequence !== 3 || x.actualOriginalBody !== true || x.independentMind !== true ||
        x.enemyWeapon !== 'WN3-CASSIAN-ROD' || x.weaponLocation !== 'HAND' || x.distanceMetres !== 2 || x.space !== 'WN3-COURT' || x.playerPosition !== 'ORIGIN' || x.ordinaryExit !== true || x.pursuit !== false ||
        x.thirdPartiesInArea !== 0 || x.automaticAllyImmunity !== false || x.abilitySource !== 'ORIGINAL_LIMITED_G_SPACE' || x.clearanceConfirmed !== true ||
        ![x.playerHealth, x.playerMind, x.enemyHealth, x.enemyMind].every(n => integer(n, 1, 100)) ||
        ![x.knowledge, x.perception, x.tricksMastery, x.travelMastery].every(n => integer(n, 0, 500)) || typeof x.clubHeld !== 'boolean' ||
        !Array.isArray(x.enemyInjuries) || !integer(x.enemyRisk) || !Array.isArray(o.enemyInjuriesAfter) || !integer(o.enemyRiskAfter) ||
        o.targetId !== WANDERER_TARGET_ID || o.round !== x.round || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) ||
        typeof o.continuing !== 'boolean' || o.elapsedSeconds !== 60 || o.parallaxReadyAfter !== false || o.playerPositionAfter !== 'ORIGIN' || o.enemyDistanceAfter !== 2 ||
        !integer(o.movementCount, 0, 12) || !integer(o.totalMetres, 0, 12) ||
        ![o.enemyHealth, o.playerHealthAfter].every(n => integer(n, 0, 100)) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(o.enemyStatus) || (o.enemyStatus === 'DEAD') !== (o.enemyHealth === 0) ||
        o.enemyMind !== x.enemyMind || o.playerMindAfter !== x.playerMind || ![x.playerSpirituality, x.enemySpirituality, o.playerSpiritualityAfter, o.enemySpirituality].every(n => integer(n, 0, 120)) ||
        o.playerSpiritualityBefore !== x.playerSpirituality || o.enemySpiritualityBefore !== x.enemySpirituality || !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) ||
        o.playerActions.length > 6 || o.enemyActions.length > 6 || !x.powerUses || Object.keys(x.powerUses).length !== 3 ||
        !WANDERER_POWER_IDS.every(id => integer(x.powerUses[id])) || x.enemySpirituality !== 120 - WANDERER_POWERS.reduce((n, p) => n + x.powerUses[p.id] * p.cost, 0)) return false;
    const powers = { ...x.powerUses }; let playerS = x.playerSpirituality, enemyS = x.enemySpirituality, parallax = false, movementCount = 0;
    const actions = [...o.playerActions.map(a => ({ actor: 'PLAYER' as const, a })), ...o.enemyActions.map(a => ({ actor: 'ENEMY' as const, a }))].sort((a, b) => a.a.order - b.a.order);
    for (const [i, entry] of actions.entries()) {
      const a = entry.a;
      if (a.order !== i || !integer(a.paidCost) || !Number.isFinite(a.selfGain) || !Number.isFinite(a.enemyReduction) || a.enemyReduction < 0 ||
          !Number.isFinite(a.physicalFactor) || a.physicalFactor < 0 || a.physicalFactor > 1 || typeof a.label !== 'string' || typeof a.threatens !== 'boolean' || a.mentalPressure !== false ||
          !Array.isArray(a.rolls) || a.rolls.some(n => !integer(n, 1, 100))) return false;
      if (entry.actor === 'PLAYER') {
        const b = entry.a;
        if (!ABILITIES.some(v => v.id === b.id) || !Array.isArray(b.movements)) return false;
        const expected = playerResult(x, b.id, b.physicalFactor, playerS, b.rolls[0] ?? null, parallax);
        const { success: _success, ...evidence } = expected;
        if (b.rolls.length !== (expected.paidCost > 0 ? 1 : 0) || !Object.entries(evidence).every(([key, v]) => same(b[key as keyof WandererPlayerAction], v))) return false;
        playerS -= expected.paidCost; if (expected.resisted) parallax = false; movementCount += b.movements.length;
      } else {
        const b = entry.a, power = WANDERER_POWERS.find(v => v.id === b.planned);
        if (![...WANDERER_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(b.planned) || b.rolls.length !== 0) return false;
        const actual = power && enemyS < power.cost ? 'BODY_STRIKE' : b.planned, cost = power && actual === b.planned ? power.cost : 0;
        if (b.actual !== actual || b.paidCost !== cost || b.parallaxGranted !== (actual === 'PARALLAX')) return false;
        enemyS -= cost; if (power && cost > 0) powers[power.id]++;
        if (actual === 'PARALLAX') parallax = true;
        const gain = actual === 'ACCIDENT' ? -22.5 : actual === 'BODY_STRIKE' ? 20 * b.physicalFactor : actual === 'VECTOR_STRIKE' ? 75 : 0;
        if (b.selfGain !== gain || b.enemyReduction !== (actual === 'REFRACT_WARD' ? 45 : 0) || b.threatens !== (gain > 0)) return false;
      }
    }
    return playerS === o.playerSpiritualityAfter && enemyS === o.enemySpirituality && same(powers, o.powerUses) && o.movementCount === movementCount && o.totalMetres === movementCount;
  } catch { return false; }
}
