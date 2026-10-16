import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { DECEIT_MENTOR_TARGET_ID, DECEIT_MENTOR_POWERS, DECEIT_MENTOR_POWER_IDS, hasDeceitMentorDisputeOpponent,
  type DeceitMentorEnemyIntent, type DeceitMentorPowerId } from './encounter.js';

/** Two bounded original-G deceits. Neither grants physical or mental injury permission. */
export const DECEIT_MENTOR_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const DECEIT_MENTOR_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const deceitMentorActionCount = pyromaniacActionCount;
export const deceitMentorEnemyActionCount = pyromaniacActionCount;
const LAW = 'error.s3.law-deceit', DEEP = 'error.s3.deep-deception';
export type DeceitMentorMoveId = typeof LAW | typeof DEEP | 'STRIKE' | 'EVADE' | 'BLOCK' | 'ACCIDENT';
const ABILITIES: readonly { id: DeceitMentorMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: LAW, label: '有限规则欺瞒（6S/知识18，减势36G，不致伤）', weight: 25, stance: 'CONTROL' },
  { id: DEEP, label: '有限深层欺瞒（6S/知识18，减势30G，不控身）', weight: 20, stance: 'CONTROL' },
  { id: 'STRIKE', label: '普通打击（自己的实际原棍16或徒手12×身体G）', weight: 20, stance: 'ATTACK' },
  { id: 'EVADE', label: '普通避让（减势10G、0S）', weight: 15, stance: 'DEFEND' },
  { id: 'BLOCK', label: '普通格挡（减势10G、0S）', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（固定−22.5G）', weight: 5, stance: null },
];
export const DECEIT_MENTOR_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'FORCE_STRIKE', label: '原创G有限灵性冲击：5S/70G', weight: 35 },
  { id: 'GUARD', label: '原创G有限屏护：4S/减40G', weight: 25 },
  { id: 'BODY_STRIKE', label: '同一原杖：20×身体G', weight: 20 },
  { id: 'DISCERN', label: '原创G本轮辨伪：4S/抵下一成功欺瞒一次', weight: 15 },
  { id: 'ACCIDENT', label: '判断偏差：−22.5G', weight: 5 },
];
export const isDeceitMentor = (s: SliceState): boolean => s.progression.pathwayId === 'error' && s.progression.sequence === 3;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function deceitMentorAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 }));
}
export function drawDeceitMentorAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): DeceitMentorMoveId {
  const weights = tickets(stance); let n = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return a.id; }
  throw new Error('欺瞒导师六槽能力盘无效。');
}
export function drawDeceitMentorEnemyAbility(random: ActionRandomStream): DeceitMentorEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of DECEIT_MENTOR_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as DeceitMentorEnemyIntent; }
  throw new Error('原吉迪恩五类行动盘无效。');
}
export interface DeceitMentorCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'DECEIT_MENTOR_DISPUTE'; targetId: typeof DECEIT_MENTOR_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetAge: 47; targetSequence: 3; actualOriginalBody: true; independentMind: true;
  enemyWeapon: 'DM3-GIDEON-ROD'; weaponLocation: 'HAND'; distanceMetres: 2; space: 'DM3-COURT'; playerPosition: 'ORIGIN';
  abilitySource: 'ORIGINAL_LIMITED_G'; clearanceConfirmed: true; ordinaryExit: true; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyInjuries: SliceInjury[]; enemyRisk: number; clubHeld: boolean; knowledge: number; lifeClockSeconds: number;
  powerUses: Record<DeceitMentorPowerId, number>;
}
const bounded = (n: number, max: number) => Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
export function currentDeceitMentorCombatSource(s: SliceState): DeceitMentorCombatSource | null {
  if (!hasDeceitMentorDisputeOpponent(s)) return null;
  const e = s.deceitMentor.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'DECEIT_MENTOR_DISPUTE', targetId: DECEIT_MENTOR_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetAge: 47, targetSequence: 3, actualOriginalBody: true, independentMind: true,
    enemyWeapon: 'DM3-GIDEON-ROD', weaponLocation: 'HAND', distanceMetres: 2, space: 'DM3-COURT', playerPosition: 'ORIGIN',
    abilitySource: 'ORIGINAL_LIMITED_G', clearanceConfirmed: true, ordinaryExit: true, pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality,
    enemyInjuries: structuredClone(c.enemyInjuries), enemyRisk: c.enemyRisk, clubHeld: s.town.clubLocation === 'HAND',
    knowledge: s.character.coreStats.knowledge, lifeClockSeconds: s.deceitMentor.life.clockSeconds, powerUses: { ...e.powerUses } };
}
export interface DeceitMentorCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean }
interface ActionEvidence extends DeceitMentorCombatEffect { order: number; paidCost: number; physicalFactor: number; rolls: number[] }
export interface DeceitMentorPlayerAction extends ActionEvidence {
  id: DeceitMentorMoveId; resisted: boolean; fallback: 'NONE' | 'EVADE' | 'OBSERVE';
}
export interface DeceitMentorEnemyAction extends ActionEvidence { planned: DeceitMentorEnemyIntent; actual: DeceitMentorEnemyIntent; discernGranted: boolean }
export interface DeceitMentorRoundContext {
  source: DeceitMentorCombatSource; stance: SliceStance; finished: boolean; liveState: string; discernReady: boolean;
  playerActions: DeceitMentorPlayerAction[]; enemyActions: DeceitMentorEnemyAction[]; label: string; outcome: DeceitMentorRoundOutcome | null;
}
const none = (label: string): DeceitMentorCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
function liveState(s: SliceState): string { return stableStringify({ spirituality: s.spirituality, encounter: s.deceitMentor.encounter, clockSeconds: s.deceitMentor.life.clockSeconds }); }
const dynamicSource = new Set(['playerSpirituality', 'enemySpirituality', 'powerUses']);
function validRound(s: SliceState, r: DeceitMentorRoundContext, supplied: DeceitMentorCombatSource | null): boolean {
  const actual = currentDeceitMentorCombatSource(s);
  return !r.finished && actual !== null && supplied !== null && same(supplied, r.source) && r.liveState === liveState(s) &&
    Object.entries(r.source).every(([key, value]) => dynamicSource.has(key) || same(actual[key as keyof DeceitMentorCombatSource], value));
}
export function beginDeceitMentorCombatRound(s: SliceState, stance: SliceStance, _random: ActionRandomStream): DeceitMentorRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('欺瞒导师战斗姿态无效。');
  const source = currentDeceitMentorCombatSource(s); if (!source) throw new Error('缺少原吉迪恩、原杖或原干院的连续来源。');
  return { source, stance, finished: false, liveState: liveState(s), discernReady: false, playerActions: [], enemyActions: [], outcome: null,
    label: `同一47岁原吉迪恩·哈特在净空原干院2米外，持唯一原杖、独立S${source.enemySpirituality}/120。两个新欺瞒只影响当前轮的攻击时机与判断，不控制身体、不造成直接伤害，不附送旧能力窃取。` };
}
export const createDeceitMentorCombatRound = beginDeceitMentorCombatRound;
const actionBase = (order: number, physical: number): ActionEvidence => ({ ...none(''), order, paidCost: 0, physicalFactor: bounded(physical, 1), rolls: [] });
const isDeceit = (id: DeceitMentorMoveId) => id === LAW || id === DEEP;
function playerResult(x: DeceitMentorCombatSource, id: DeceitMentorMoveId, physical: number, playerS: number, roll: number | null, discern: boolean) {
  const paidCost = isDeceit(id) && playerS >= 6 ? 6 : 0;
  const fallback = !isDeceit(id) || paidCost ? 'NONE' as const : id === LAW ? 'EVADE' as const : 'OBSERVE' as const;
  const success = paidCost > 0 && roll !== null && roll <= computeCheckChance({ ability: 'knowledge', baseAbility: x.knowledge, difficulty: 18, modifiers: [] });
  let selfGain = 0, enemyReduction = 0, threatens = false;
  if (id === 'ACCIDENT') selfGain = -22.5;
  else if (id === 'STRIKE') { selfGain = (x.clubHeld ? 16 : 12) * physical; threatens = selfGain > 0; }
  else if (id === 'EVADE' || id === 'BLOCK' || fallback === 'EVADE') enemyReduction = 10;
  else if (success) enemyReduction = id === LAW ? 36 : 30;
  const resisted = success && discern;
  if (resisted) enemyReduction = 0;
  return { paidCost, fallback, success, resisted, selfGain, enemyReduction, threatens };
}
export function resolveDeceitMentorCombatAbility(s: SliceState, id: DeceitMentorMoveId, physical: number, random: ActionRandomStream,
  r: DeceitMentorRoundContext, source: DeceitMentorCombatSource | null = r.source): DeceitMentorCombatEffect {
  if (!validRound(s, r, source) || r.playerActions.length >= 6 || !ABILITIES.some(a => a.id === id))
    return none('缺少当前原人、原场与原资源来源，或已用完本轮最多六槽；0贡献0消耗，不重抽。');
  const base = actionBase(r.playerActions.length + r.enemyActions.length, physical);
  if (isDeceit(id) && s.spirituality >= 6) base.rolls.push(random.nextInt(1, 100));
  const { success, ...evidence } = playerResult(r.source, id, base.physicalFactor, s.spirituality, base.rolls[0] ?? null, r.discernReady);
  const a: DeceitMentorPlayerAction = { ...base, ...evidence, id };
  s.spirituality -= a.paidCost;
  if (a.resisted) r.discernReady = false;
  if (id === 'ACCIDENT') a.label = '判断失衡固定−22.5G，不重抽或增加行动。';
  else if (id === 'STRIKE') a.label = `本人以${r.source.clubHeld ? '自己实际握持的原棍16' : '自己的原身体徒手12'}×身体普通打击G，0S；不夺取或复制吉迪恩或旧拉尔夫的原杖。`;
  else if (id === 'EVADE' || id === 'BLOCK') a.label = `本人在原干院普通${id === 'EVADE' ? '避让' : '格挡'}，减势10G、0S，不保证免伤。`;
  else if (!a.paidCost) a.label = `不足6S，本槽未施法；${a.fallback === 'EVADE' ? '只用原身体普通避让减势10G' : '只作普通观察、0贡献'}，0S、不重抽、不偷取其他能力。`;
  else {
    a.label = `${id === LAW ? '有限规则欺瞒当前攻击时机' : '对原独立思维的有限深层欺瞒'}实付6S/知识18${success ? '成功' : '失败，0贡献、成本不退'}。`;
    if (a.resisted) a.label += '原吉迪恩消耗本轮已付费辨伪的一次抵抗，本次欺瞒被识破；不退成本。';
    else if (success) a.label += `仅当前轮减势${a.enemyReduction}G，轮末自动结束；不扣H/M、不控制原身体、不改原记忆或原物归属。`;
  }
  r.playerActions.push(a); r.liveState = liveState(s);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export function resolveDeceitMentorEnemyAbility(s: SliceState, planned: DeceitMentorEnemyIntent, physical: number, _random: ActionRandomStream,
  r: DeceitMentorRoundContext, source: DeceitMentorCombatSource | null = r.source): DeceitMentorCombatEffect {
  if (!validRound(s, r, source) || r.enemyActions.length >= 6 || ![...DECEIT_MENTOR_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned))
    return none('缺少当前原吉迪恩及原杖来源，或已用完本轮最多六槽；0贡献0消耗，不重抽。');
  const e = s.deceitMentor.encounter, power = DECEIT_MENTOR_POWERS.find(x => x.id === planned);
  const a: DeceitMentorEnemyAction = { ...actionBase(r.playerActions.length + r.enemyActions.length, physical), planned,
    actual: power && e.enemySpirituality < power.cost ? 'BODY_STRIKE' : planned, discernGranted: false };
  if (power && a.actual === planned) {
    e.enemySpirituality -= power.cost; e.powerUses[power.id]++; a.paidCost = power.cost; a.selfGain = power.selfGain; a.enemyReduction = power.enemyReduction;
  }
  if (a.actual === 'ACCIDENT') { a.selfGain = -22.5; a.label = '原吉迪恩判断失衡，本槽固定−22.5G，不另抽。'; }
  else if (a.actual === 'BODY_STRIKE') { a.selfGain = 20 * a.physicalFactor; a.threatens = a.selfGain > 0;
    a.label = `${power ? '实际灵性不足，未施法；' : ''}原吉迪恩持唯一DM3-GIDEON-ROD普通打击20×身体G，0S，无新武器或额外行动。`; }
  else if (a.actual === 'DISCERN') { r.discernReady = true; a.discernGranted = true;
    a.label = '原吉迪恩原创G辨伪实付4S，只抵本轮下一次成功规则或深层欺瞒一次；不挡普通打击或伤势盘，0直接优势，不叠加、不跨轮。'; }
  else { a.threatens = a.actual === 'FORCE_STRIKE'; a.label = `原吉迪恩${power!.label}实付${a.paidCost}S，${a.threatens ? '有限优势70' : '有限减势40'}G，余${e.enemySpirituality}/120；只有实际冲击构成伤害威胁，原人原物未搬动。`; }
  r.enemyActions.push(a); r.liveState = liveState(s);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export interface DeceitMentorRoundOutcome {
  targetId: typeof DECEIT_MENTOR_TARGET_ID; round: number; source: DeceitMentorCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  enemyInjuriesAfter: SliceInjury[]; enemyRiskAfter: number;
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number;
  powerUses: Record<DeceitMentorPowerId, number>; discernReadyAfter: false; elapsedSeconds: 60; lifeClockSecondsAfter: number;
  playerPositionAfter: 'ORIGIN'; enemyDistanceAfter: 2;
  playerActions: DeceitMentorPlayerAction[]; enemyActions: DeceitMentorEnemyAction[];
}
export function finishDeceitMentorCombatRound(s: SliceState, r: DeceitMentorRoundContext, continuing = true): DeceitMentorRoundOutcome {
  const e = s.deceitMentor.encounter, c = s.combat;
  if (r.finished || !c || c.encounterId !== 'DECEIT_MENTOR_DISPUTE' || c.round !== r.source.round || r.liveState !== liveState(s) || e.scene.playerPosition !== 'ORIGIN')
    throw new Error('原欺瞒导师回合已结束，或同一原身体、原资源已被改写。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  if (e.enemyStatus !== 'RESISTING') e.weaponLocation = 'COURT';
  s.deceitMentor.life.clockSeconds += 60; r.discernReady = false; r.finished = true;
  r.outcome = { targetId: DECEIT_MENTOR_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus,
    enemyInjuriesAfter: structuredClone(c.enemyInjuries), enemyRiskAfter: c.enemyRisk,
    playerSpiritualityBefore: r.source.playerSpirituality, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind,
    enemySpiritualityBefore: r.source.enemySpirituality, powerUses: { ...e.powerUses }, discernReadyAfter: false, elapsedSeconds: 60,
    lifeClockSecondsAfter: s.deceitMentor.life.clockSeconds, playerPositionAfter: 'ORIGIN', enemyDistanceAfter: 2,
    playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
  return structuredClone(r.outcome);
}
export function deceitMentorRoundOutcome(r: DeceitMentorRoundContext): DeceitMentorRoundOutcome {
  if (!r.outcome) throw new Error('先实际结束当前原欺瞒导师回合。'); return structuredClone(r.outcome);
}
export function projectDeceitMentorCombat(s: SliceState) {
  const e = s.deceitMentor.encounter, visible = isDeceitMentor(s);
  return { enemyName: visible ? '吉迪恩·哈特（47岁，原创有限G3非凡者）' : '', targetId: visible ? e.targetId : null,
    enemyMind: visible ? e.enemyMind : null, enemySpirituality: visible ? e.enemySpirituality : null,
    powerUses: visible ? { ...e.powerUses } : null, scene: visible ? { ...e.scene } : null,
    originalExit: true, pursuit: false, distanceMetres: 2, automaticAllyImmunity: false, source: visible ? currentDeceitMentorCombatSource(s) : null,
    summary: visible ? '欺瞒导师序列3有限G战斗。双方1–6次权重10/15/25/25/15/10；保留旧寄生者4核心35/25/25/15、1250/底125、S120，仅继续轮恢复12G。玩家六槽25/20/20/15/15/5，敌五类35/25/20/15/5。规则欺瞒6S/知识18减36，深层欺瞒6S/知识18减30；均不杀伤、不控身、可失败或被一次辨伪抵抗，轮末结束。只有实际STRIKE威胁共同伤势盘，按自己实际持原棍或徒手结算；两个新术槽不附送旧能力或念头窃取。吉迪恩有明确原创G冲击/屏护/辨伪及独立原资源，旧拉尔夫与原宿主历史保持。' : '' };
}
/** Replays ordered costs, failed checks and one-use resistance. Actual wounds belong to the shared wheel. */
export function validateDeceitMentorRoundOutcome(value: unknown): value is DeceitMentorRoundOutcome {
  try {
    const o = value as DeceitMentorRoundOutcome, x = o?.source;
    if (!o || !x || typeof x.runId !== 'string' || !integer(x.revision) || !integer(x.week, 1) || !integer(x.round, 1) || !integer(x.startHistoryIndex) || x.attemptWeek !== x.week ||
        x.encounterId !== 'DECEIT_MENTOR_DISPUTE' || x.targetId !== DECEIT_MENTOR_TARGET_ID || x.targetAge !== 47 || x.targetSequence !== 3 || x.actualOriginalBody !== true || x.independentMind !== true ||
        x.enemyWeapon !== 'DM3-GIDEON-ROD' || x.weaponLocation !== 'HAND' || x.distanceMetres !== 2 || x.space !== 'DM3-COURT' || x.playerPosition !== 'ORIGIN' || x.ordinaryExit !== true || x.pursuit !== false ||
        x.thirdPartiesInArea !== 0 || x.automaticAllyImmunity !== false || x.abilitySource !== 'ORIGINAL_LIMITED_G' || x.clearanceConfirmed !== true ||
        ![x.playerHealth, x.playerMind, x.enemyHealth, x.enemyMind].every(n => integer(n, 1, 100)) || !integer(x.knowledge, 0, 500) || typeof x.clubHeld !== 'boolean' ||
        !integer(x.lifeClockSeconds) || o.lifeClockSecondsAfter !== x.lifeClockSeconds + 60 ||
        !Array.isArray(x.enemyInjuries) || !integer(x.enemyRisk) || !Array.isArray(o.enemyInjuriesAfter) || !integer(o.enemyRiskAfter) ||
        o.targetId !== DECEIT_MENTOR_TARGET_ID || o.round !== x.round || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) ||
        typeof o.continuing !== 'boolean' || o.elapsedSeconds !== 60 || o.discernReadyAfter !== false || o.playerPositionAfter !== 'ORIGIN' || o.enemyDistanceAfter !== 2 ||
        !integer(o.enemyHealth, 0, x.enemyHealth) || !integer(o.playerHealthAfter, 0, x.playerHealth) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(o.enemyStatus) || (o.enemyStatus === 'DEAD') !== (o.enemyHealth === 0) ||
        o.enemyMind !== x.enemyMind || o.playerMindAfter !== x.playerMind || ![x.playerSpirituality, x.enemySpirituality, o.playerSpiritualityAfter, o.enemySpirituality].every(n => integer(n, 0, 120)) ||
        o.playerSpiritualityBefore !== x.playerSpirituality || o.enemySpiritualityBefore !== x.enemySpirituality || !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) ||
        o.playerActions.length > 6 || o.enemyActions.length > 6 || !x.powerUses || Object.keys(x.powerUses).length !== 3 ||
        !DECEIT_MENTOR_POWER_IDS.every(id => integer(x.powerUses[id])) || x.enemySpirituality !== 120 - DECEIT_MENTOR_POWERS.reduce((n, p) => n + x.powerUses[p.id] * p.cost, 0)) return false;
    const powers = { ...x.powerUses }; let playerS = x.playerSpirituality, enemyS = x.enemySpirituality, discern = false;
    const actions = [...o.playerActions.map(a => ({ actor: 'PLAYER' as const, a })), ...o.enemyActions.map(a => ({ actor: 'ENEMY' as const, a }))].sort((a, b) => a.a.order - b.a.order);
    for (const [i, entry] of actions.entries()) {
      const a = entry.a;
      if (a.order !== i || !integer(a.paidCost) || !Number.isFinite(a.selfGain) || !Number.isFinite(a.enemyReduction) || a.enemyReduction < 0 ||
          !Number.isFinite(a.physicalFactor) || a.physicalFactor < 0 || a.physicalFactor > 1 || typeof a.label !== 'string' || typeof a.threatens !== 'boolean' || a.mentalPressure !== false ||
          !Array.isArray(a.rolls) || a.rolls.some(n => !integer(n, 1, 100))) return false;
      if (entry.actor === 'PLAYER') {
        const b = entry.a;
        if (!ABILITIES.some(v => v.id === b.id)) return false;
        const expected = playerResult(x, b.id, b.physicalFactor, playerS, b.rolls[0] ?? null, discern);
        const { success: _success, ...evidence } = expected;
        if (b.rolls.length !== (expected.paidCost > 0 ? 1 : 0) || !Object.entries(evidence).every(([key, v]) => same(b[key as keyof DeceitMentorPlayerAction], v))) return false;
        playerS -= expected.paidCost; if (expected.resisted) discern = false;
      } else {
        const b = entry.a, power = DECEIT_MENTOR_POWERS.find(v => v.id === b.planned);
        if (![...DECEIT_MENTOR_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(b.planned) || b.rolls.length !== 0) return false;
        const actual = power && enemyS < power.cost ? 'BODY_STRIKE' : b.planned, cost = power && actual === b.planned ? power.cost : 0;
        if (b.actual !== actual || b.paidCost !== cost || b.discernGranted !== (actual === 'DISCERN')) return false;
        enemyS -= cost; if (power && cost > 0) powers[power.id]++;
        if (actual === 'DISCERN') discern = true;
        const gain = actual === 'ACCIDENT' ? -22.5 : actual === 'BODY_STRIKE' ? 20 * b.physicalFactor : actual === 'FORCE_STRIKE' ? 70 : 0;
        if (b.selfGain !== gain || b.enemyReduction !== (actual === 'GUARD' ? 40 : 0) || b.threatens !== (gain > 0)) return false;
      }
    }
    if ((!o.playerActions.some(a => a.threatens) && (o.enemyHealth !== x.enemyHealth || o.enemyStatus !== 'RESISTING' || !same(o.enemyInjuriesAfter, x.enemyInjuries))) ||
        (!o.enemyActions.some(a => a.threatens) && o.playerHealthAfter !== x.playerHealth)) return false;
    return playerS === o.playerSpiritualityAfter && enemyS === o.enemySpirituality && same(powers, o.powerUses);
  } catch { return false; }
}
