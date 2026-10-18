import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { JUSTICE_MENTOR_TARGET_ID, JUSTICE_MENTOR_POWERS, JUSTICE_MENTOR_POWER_IDS, hasJusticeMentorDisputeOpponent,
  type JusticeMentorEnemyIntent, type JusticeMentorPowerId } from './encounter.js';

/** Finite Justice Mentor3 G combat. The shared adapter retains the actual S4 core and common injury wheel. */
export const JUSTICE_MENTOR_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const JUSTICE_MENTOR_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const justiceMentorActionCount = pyromaniacActionCount;
export const justiceMentorEnemyActionCount = pyromaniacActionCount;
const SHARED = 'sun.s3.shared-radiance', CLARITY = 'sun.s3.clarity-mark';
const DOMAIN = 'sun.s4.unshadowed-domain', PURIFICATION = 'sun.s4.purification';
export type JusticeMentorMoveId = typeof SHARED | typeof CLARITY | typeof DOMAIN | typeof PURIFICATION | 'EVADE' | 'ACCIDENT';
const ABILITIES: readonly { id: JusticeMentorMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: SHARED, label: '共享光辉（H；原创G，6S/意志18，鼓舞本人优势65）', weight: 25, stance: 'ATTACK' },
  { id: CLARITY, label: '清晰标记（J；原创G，6S/知识18，减势32，不定罪）', weight: 20, stance: 'CONTROL' },
  { id: DOMAIN, label: '继承无暗领域（B；5S/意志16，减势18×原掌握G）', weight: 15, stance: 'DEFEND' },
  { id: PURIFICATION, label: '继承净化光（K；6S/意志18，优势34×原掌握G，普通人无邪恶倍率）', weight: 20, stance: 'CONTROL' },
  { id: 'EVADE', label: '普通避让（R；减势10G、0S）', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A；固定−22.5G）', weight: 5, stance: null },
];
export const JUSTICE_MENTOR_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'LIGHT_STRIKE', label: '原创G有限光击：5S/75G', weight: 35 }, { id: 'LIGHT_WARD', label: '原创G有限防光：4S/减45G', weight: 25 },
  { id: 'BODY_STRIKE', label: '同一原棍：20×身体G', weight: 20 }, { id: 'FOCUS', label: '原创G有限定神：4S/抵本轮下一成功标记或领域牵制，不抵攻击', weight: 15 },
  { id: 'ACCIDENT', label: '判断偏差：−22.5G', weight: 5 },
];
export const isJusticeMentor = (s: SliceState): boolean => s.progression.pathwayId === 'sun' && s.progression.sequence === 3;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function justiceMentorAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 }));
}
export function drawJusticeMentorAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): JusticeMentorMoveId {
  const weights = tickets(stance); let n = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return a.id; } throw new Error('正义导师六槽能力盘无效。');
}
export function drawJusticeMentorEnemyAbility(random: ActionRandomStream): JusticeMentorEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of JUSTICE_MENTOR_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as JusticeMentorEnemyIntent; }
  throw new Error('原科温五类行动盘无效。');
}
export interface JusticeMentorCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'JUSTICE_MENTOR_DISPUTE'; targetId: typeof JUSTICE_MENTOR_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetAge: 49; targetSequence: 3; actualOriginalBody: true; independentMind: true;
  enemyWeapon: 'JM3-CORWIN-CLUB'; weaponLocation: 'HAND'; distanceMetres: 2; space: 'JM3-COURT';
  abilitySource: 'ORIGINAL_LIMITED_G_LIGHT'; sunVulnerable: false; selfEncouragementOnly: true; clearanceConfirmed: true; ordinaryExit: true; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyInjuries: SliceInjury[]; enemyRisk: number; clubHeld: boolean; knowledge: number; will: number;
  domainMastery: number; purificationMastery: number; powerUses: Record<JusticeMentorPowerId, number>;
}
const bounded = (n: number, max: number) => Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
// Exact inherited Unshadowed implementation: 0.65 + 0.35 * clamp(mastery, 0, 500) / 500.
const mastery = (n: number) => .65 + .35 * bounded(n, 500) / 500;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
export function currentJusticeMentorCombatSource(s: SliceState): JusticeMentorCombatSource | null {
  if (!hasJusticeMentorDisputeOpponent(s)) return null;
  const e = s.justiceMentor.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'JUSTICE_MENTOR_DISPUTE', targetId: JUSTICE_MENTOR_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetAge: 49, targetSequence: 3, actualOriginalBody: true, independentMind: true,
    enemyWeapon: 'JM3-CORWIN-CLUB', weaponLocation: 'HAND', distanceMetres: 2, space: 'JM3-COURT', abilitySource: 'ORIGINAL_LIMITED_G_LIGHT', sunVulnerable: false, selfEncouragementOnly: true, clearanceConfirmed: true,
    ordinaryExit: true, pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality,
    enemyInjuries: structuredClone(c.enemyInjuries), enemyRisk: c.enemyRisk, clubHeld: s.town.clubLocation === 'HAND',
    knowledge: s.character.coreStats.knowledge, will: s.character.coreStats.will,
    domainMastery: bounded(s.progression.mastery[DOMAIN] ?? 0, 500), purificationMastery: bounded(s.progression.mastery[PURIFICATION] ?? 0, 500), powerUses: { ...e.powerUses } };
}
export interface JusticeMentorCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean }
interface ActionEvidence extends JusticeMentorCombatEffect { order: number; paidCost: number; physicalFactor: number; rolls: number[] }
export interface JusticeMentorPlayerAction extends ActionEvidence { id: JusticeMentorMoveId; resisted: boolean; fallback: 'NONE' | 'STRIKE' | 'EVADE' | 'OBSERVE' }
export interface JusticeMentorEnemyAction extends ActionEvidence { planned: JusticeMentorEnemyIntent; actual: JusticeMentorEnemyIntent; focusGranted: boolean }
export interface JusticeMentorRoundContext {
  source: JusticeMentorCombatSource; stance: SliceStance; finished: boolean; liveState: string; focusReady: boolean;
  playerActions: JusticeMentorPlayerAction[]; enemyActions: JusticeMentorEnemyAction[]; label: string; outcome: JusticeMentorRoundOutcome | null;
}
const none = (label: string): JusticeMentorCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
function liveState(s: SliceState): string {
  return stableStringify({ spirituality: s.spirituality, encounter: s.justiceMentor.encounter });
}
const dynamicSource = new Set(['playerSpirituality', 'enemySpirituality', 'powerUses']);
function validRound(s: SliceState, r: JusticeMentorRoundContext, supplied: JusticeMentorCombatSource | null): boolean {
  const actual = currentJusticeMentorCombatSource(s);
  return !r.finished && actual !== null && supplied !== null && same(supplied, r.source) && r.liveState === liveState(s) &&
    Object.entries(r.source).every(([key, value]) => dynamicSource.has(key) || same(actual[key as keyof JusticeMentorCombatSource], value));
}
export function beginJusticeMentorCombatRound(s: SliceState, stance: SliceStance, _random: ActionRandomStream): JusticeMentorRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('正义导师战斗姿态无效。');
  const source = currentJusticeMentorCombatSource(s); if (!source) throw new Error('缺少原科温、原棍或原干院的连续来源。');
  return { source, stance, finished: false, liveState: liveState(s), focusReady: false, playerActions: [], enemyActions: [], outcome: null,
    label: `同一49岁原科温在原净空干院2米外，独立S${source.enemySpirituality}/120。本区已经实际确认无第三人，太阳仍可波及环境；不赋予太阳自动友军免疫。共享光辉只鼓舞本人，没有免费队友。` };
}
export const createJusticeMentorCombatRound = beginJusticeMentorCombatRound;
function actionBase(order: number, physical: number): ActionEvidence { return { ...none(''), order, paidCost: 0, physicalFactor: bounded(physical, 1), rolls: [] }; }
function check(s: SliceState, a: ActionEvidence, ability: 'knowledge' | 'will', difficulty: number, random: ActionRandomStream): boolean {
  const chance = computeCheckChance({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [] }), roll = random.nextInt(1, 100);
  a.rolls.push(roll); return roll <= chance;
}
export function resolveJusticeMentorCombatAbility(s: SliceState, id: JusticeMentorMoveId, physical: number, random: ActionRandomStream,
  r: JusticeMentorRoundContext, source: JusticeMentorCombatSource | null = r.source): JusticeMentorCombatEffect {
  if (!validRound(s, r, source) || r.playerActions.length >= 6 || !ABILITIES.some(a => a.id === id))
    return none('缺少当前原人、原场与原资源来源，或已用完本轮最多六槽；0贡献0消耗，不重抽。');
  const a: JusticeMentorPlayerAction = { ...actionBase(r.playerActions.length + r.enemyActions.length, physical), id, resisted: false, fallback: 'NONE' };
  if (id === 'ACCIDENT') { a.selfGain = -22.5; a.label = '判断失衡固定−22.5G，不重抽或增加行动。'; }
  else if (id === 'EVADE') { a.enemyReduction = 10; a.label = '本人在原净空干院普通避让，减势10G、0S；不制造免费光墙或保证免伤。'; }
  else {
    const domain = id === DOMAIN, clarity = id === CLARITY, shared = id === SHARED, cost = domain ? 5 : 6;
    if (!Number.isFinite(s.spirituality) || s.spirituality < cost) {
      a.fallback = shared ? 'STRIKE' : domain ? 'EVADE' : 'OBSERVE';
      if (a.fallback === 'STRIKE') { a.selfGain = (r.source.clubHeld ? 16 : 12) * a.physicalFactor; a.threatens = a.selfGain > 0; }
      else if (a.fallback === 'EVADE') a.enemyReduction = 10;
      a.label = `不足${cost}S，本槽未施法。` + (a.fallback === 'STRIKE' ? `只以${r.source.clubHeld ? '实际自持原棍16' : '自己的原身体12'}×身体普通打击G` : a.fallback === 'EVADE' ? '只用原身体普通避让减势10G' : '只作普通观察、0贡献') + '，0S、无免费法术，不重抽。';
    } else {
      s.spirituality -= cost; a.paidCost = cost;
      const success = check(s, a, clarity ? 'knowledge' : 'will', domain ? 16 : 18, random);
      if (success) {
        a.selfGain = shared ? 65 : id === PURIFICATION ? 34 * mastery(r.source.purificationMastery) : 0;
        a.enemyReduction = clarity ? 32 : domain ? 18 * mastery(r.source.domainMastery) : 0;
        // Encouragement alone is not a damaging attack. Only purification invokes the shared injury wheel.
        a.threatens = id === PURIFICATION && a.selfGain > 0;
      }
      const name = shared ? '原创G共享光辉，仅鼓舞本人' : clarity ? '原创G清晰标记，仅辅助观察同一原棍动作与已有标记' : domain ? '继承有限无暗领域' : '继承有限净化光';
      a.label = `${name}实付${cost}S/${clarity ? '知识18' : domain ? '意志16' : '意志18'}${success ? `成功，优势${a.selfGain}、减势${a.enemyReduction}G` : '失败，0贡献、实际成本保留'}；不直接扣H/M、不保证伤害或投降，无善恶判定、凭空证据、强制契约或名称即死；普通活人无邪恶倍率。`;
    }
  }
  if ([CLARITY, DOMAIN].includes(id) && a.paidCost > 0 && a.enemyReduction > 0 && r.focusReady) {
    r.focusReady = false; a.resisted = true; a.enemyReduction = 0;
    a.label += '原科温消耗本轮已付费定神的一次牵制抵抗，本次减势被抵消；实付成本不退，不抵共享鼓舞、净化光攻击或共同伤势盘。';
  }
  r.playerActions.push(a); r.liveState = liveState(s);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export function resolveJusticeMentorEnemyAbility(s: SliceState, planned: JusticeMentorEnemyIntent, physical: number, _random: ActionRandomStream,
  r: JusticeMentorRoundContext, source: JusticeMentorCombatSource | null = r.source): JusticeMentorCombatEffect {
  if (!validRound(s, r, source) || r.enemyActions.length >= 6 || ![...JUSTICE_MENTOR_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned))
    return none('缺少当前原科温及原棍来源，或已用完本轮最多六槽；0贡献0消耗，不重抽。');
  const e = s.justiceMentor.encounter, power = JUSTICE_MENTOR_POWERS.find(x => x.id === planned);
  const a: JusticeMentorEnemyAction = { ...actionBase(r.playerActions.length + r.enemyActions.length, physical), planned,
    actual: power && e.enemySpirituality < power.cost ? 'BODY_STRIKE' : planned, focusGranted: false };
  if (power && a.actual === planned) {
    e.enemySpirituality -= power.cost; e.powerUses[power.id]++; a.paidCost = power.cost; a.selfGain = power.selfGain; a.enemyReduction = power.enemyReduction;
  }
  if (a.actual === 'ACCIDENT') { a.selfGain = -22.5; a.label = '原科温判断失衡，本槽固定−22.5G，不另抽。'; }
  else if (a.actual === 'BODY_STRIKE') { a.selfGain = 20 * a.physicalFactor; a.threatens = a.selfGain > 0;
    a.label = `${power ? '法术所需实际灵性不足，未施法；' : ''}原科温持唯一JM3-CORWIN-CLUB普通打击20×身体G，0S，无新武器或额外行动。`; }
  else if (a.actual === 'FOCUS') { r.focusReady = true; a.focusGranted = true;
    a.label = '原科温原创G定神实付4S，只抵本轮下一次成功清晰标记或领域牵制一次，不抵共享鼓舞、净化光攻击或共同伤势盘，0直接优势；不叠加、不跨轮。'; }
  else { a.threatens = a.actual === 'LIGHT_STRIKE'; a.label = `原科温${power!.label}实际付费${a.paidCost}S，${a.threatens ? '有限优势75' : '原创G有限减势45'}G，余${e.enemySpirituality}/120；作用当次结束，原环境与实际消耗保留。`; }
  r.enemyActions.push(a); r.liveState = liveState(s);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export interface JusticeMentorRoundOutcome {
  targetId: typeof JUSTICE_MENTOR_TARGET_ID; round: number; source: JusticeMentorCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  enemyInjuriesAfter: SliceInjury[]; enemyRiskAfter: number;
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number;
  powerUses: Record<JusticeMentorPowerId, number>; focusReadyAfter: false; elapsedSeconds: 60;
  playerActions: JusticeMentorPlayerAction[]; enemyActions: JusticeMentorEnemyAction[];
}
export function finishJusticeMentorCombatRound(s: SliceState, r: JusticeMentorRoundContext, continuing = true): JusticeMentorRoundOutcome {
  const e = s.justiceMentor.encounter, c = s.combat;
  if (r.finished || !c || c.encounterId !== 'JUSTICE_MENTOR_DISPUTE' || c.round !== r.source.round || r.liveState !== liveState(s))
    throw new Error('原正义导师回合已结束，或同一原资源已被改写。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  if (e.enemyStatus !== 'RESISTING') e.weaponLocation = 'COURT';
  s.justiceMentor.life.clockSeconds += 60; r.focusReady = false; r.finished = true;
  r.outcome = { targetId: JUSTICE_MENTOR_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus,
    enemyInjuriesAfter: structuredClone(c.enemyInjuries), enemyRiskAfter: c.enemyRisk,
    playerSpiritualityBefore: r.source.playerSpirituality, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind,
    enemySpiritualityBefore: r.source.enemySpirituality, powerUses: { ...e.powerUses }, focusReadyAfter: false,
    elapsedSeconds: 60, playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
  return structuredClone(r.outcome);
}
export function justiceMentorRoundOutcome(r: JusticeMentorRoundContext): JusticeMentorRoundOutcome {
  if (!r.outcome) throw new Error('先实际结束当前原正义导师回合。'); return structuredClone(r.outcome);
}
export function projectJusticeMentorCombat(s: SliceState) {
  const e = s.justiceMentor.encounter, visible = isJusticeMentor(s);
  return { enemyName: visible ? '科温（49岁，原创有限G3非凡者）' : '', targetId: visible ? e.targetId : null,
    enemyMind: visible ? e.enemyMind : null, enemySpirituality: visible ? e.enemySpirituality : null,
    powerUses: visible ? { ...e.powerUses } : null, scene: visible ? { ...e.scene } : null,
    originalExit: true, pursuit: false, distanceMetres: 2, automaticAllyImmunity: false, source: visible ? currentJusticeMentorCombatSource(s) : null,
    summary: visible ? '正义导师序列3有限G战斗。双方1–6次权重10/15/25/25/15/10；继承实际无暗者4核心35/25/25/15、1250/底125、S120，仅继续轮恢复12G。玩家六槽25/20/15/20/15/5，敌五类35/25/20/15/5。原创G共享光辉6S/意志18为65，只鼓舞本人，不生成队友或恢复精力；原创G清晰标记6S/知识18减32，只辅助看原棍动作与已有标记，不作善恶判定。旧领域5S/意志16减18×旧掌握，旧净化光6S/意志18为34×旧掌握，系数均0.65+0.35×掌握/500，普通活人无邪恶倍率。灵性不足仅普通0S回退。定神仅抵下一成功标记或领域牵制，不挡净化光与伤势盘。鼓舞本身不是致伤攻击；共同伤势盘决定原身体后果。旧埃德蒙实际投降与原件保留，本场确认第三人在界外不赋予自动友军免疫。' : '' };
}
/** Replays actual ordered paid actions and one-round resistance; never awards free spell effects. */
export function validateJusticeMentorRoundOutcome(value: unknown): value is JusticeMentorRoundOutcome {
  try {
    const o = value as JusticeMentorRoundOutcome, x = o?.source;
    if (!o || !x || typeof x.runId !== 'string' || !integer(x.revision) || !integer(x.week, 1) || !integer(x.round, 1) || !integer(x.startHistoryIndex) || x.attemptWeek !== x.week ||
        x.encounterId !== 'JUSTICE_MENTOR_DISPUTE' || x.targetId !== JUSTICE_MENTOR_TARGET_ID || x.targetAge !== 49 || x.targetSequence !== 3 || x.actualOriginalBody !== true || x.independentMind !== true ||
        x.enemyWeapon !== 'JM3-CORWIN-CLUB' || x.weaponLocation !== 'HAND' || x.distanceMetres !== 2 || x.space !== 'JM3-COURT' || x.ordinaryExit !== true || x.pursuit !== false ||
        x.thirdPartiesInArea !== 0 || x.automaticAllyImmunity !== false || x.abilitySource !== 'ORIGINAL_LIMITED_G_LIGHT' || x.sunVulnerable !== false || x.selfEncouragementOnly !== true || x.clearanceConfirmed !== true ||
        ![x.playerHealth, x.playerMind, x.enemyHealth, x.enemyMind].every(n => integer(n, 1, 100)) ||
        ![x.knowledge, x.will, x.domainMastery, x.purificationMastery].every(n => integer(n, 0, 500)) || typeof x.clubHeld !== 'boolean' ||
        !Array.isArray(x.enemyInjuries) || !integer(x.enemyRisk) || !Array.isArray(o.enemyInjuriesAfter) || !integer(o.enemyRiskAfter) ||
        o.targetId !== JUSTICE_MENTOR_TARGET_ID || o.round !== x.round || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) ||
        typeof o.continuing !== 'boolean' || o.elapsedSeconds !== 60 || o.focusReadyAfter !== false ||
        ![o.enemyHealth, o.playerHealthAfter].every(n => integer(n, 0, 100)) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(o.enemyStatus) || (o.enemyStatus === 'DEAD') !== (o.enemyHealth === 0) ||
        o.enemyMind !== x.enemyMind || o.playerMindAfter !== x.playerMind || ![x.playerSpirituality, x.enemySpirituality, o.playerSpiritualityAfter, o.enemySpirituality].every(n => integer(n, 0, 120)) ||
        o.playerSpiritualityBefore !== x.playerSpirituality || o.enemySpiritualityBefore !== x.enemySpirituality || !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) ||
        o.playerActions.length > 6 || o.enemyActions.length > 6 || !x.powerUses || Object.keys(x.powerUses).length !== 3 ||
        !JUSTICE_MENTOR_POWER_IDS.every(id => integer(x.powerUses[id])) || x.enemySpirituality !== 120 - JUSTICE_MENTOR_POWERS.reduce((n, p) => n + x.powerUses[p.id] * p.cost, 0)) return false;
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
        const domain = b.id === DOMAIN, clarity = b.id === CLARITY, shared = b.id === SHARED;
        const required = b.id === 'EVADE' || b.id === 'ACCIDENT' ? 0 : domain ? 5 : 6;
        const paid = required > 0 && playerS >= required ? required : 0;
        const fallback = required > 0 && !paid ? shared ? 'STRIKE' : domain ? 'EVADE' : 'OBSERVE' : 'NONE';
        if (b.paidCost !== paid || b.fallback !== fallback || b.rolls.length !== (paid > 0 ? 1 : 0)) return false;
        const success = paid > 0 && b.rolls[0]! <= computeCheckChance({ ability: clarity ? 'knowledge' : 'will',
          baseAbility: clarity ? x.knowledge : x.will, difficulty: domain ? 16 : 18, modifiers: [] });
        playerS -= paid; let gain = 0, reduction = 0, threatens = false;
        if (b.id === 'ACCIDENT') gain = -22.5;
        else if (fallback === 'STRIKE') { gain = (x.clubHeld ? 16 : 12) * b.physicalFactor; threatens = gain > 0; }
        else if (b.id === 'EVADE' || fallback === 'EVADE') reduction = 10;
        else if (success) { gain = shared ? 65 : b.id === PURIFICATION ? 34 * mastery(x.purificationMastery) : 0;
          reduction = clarity ? 32 : domain ? 18 * mastery(x.domainMastery) : 0; threatens = b.id === PURIFICATION && gain > 0; }
        const resisted = [CLARITY, DOMAIN].includes(b.id) && paid > 0 && reduction > 0 && focus;
        if (resisted) { focus = false; reduction = 0; }
        if (b.selfGain !== gain || b.enemyReduction !== reduction || b.threatens !== threatens || b.resisted !== resisted) return false;
      } else {
        const b = entry.a, power = JUSTICE_MENTOR_POWERS.find(v => v.id === b.planned);
        if (![...JUSTICE_MENTOR_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(b.planned) || b.rolls.length !== 0) return false;
        const actual = power && enemyS < power.cost ? 'BODY_STRIKE' : b.planned, cost = power && actual === b.planned ? power.cost : 0;
        if (b.actual !== actual || b.paidCost !== cost || b.focusGranted !== (actual === 'FOCUS')) return false;
        enemyS -= cost; if (power && cost > 0) powers[power.id]++;
        if (actual === 'FOCUS') focus = true;
        const gain = actual === 'ACCIDENT' ? -22.5 : actual === 'BODY_STRIKE' ? 20 * b.physicalFactor : actual === 'LIGHT_STRIKE' ? 75 : 0;
        if (b.selfGain !== gain || b.enemyReduction !== (actual === 'LIGHT_WARD' ? 45 : 0) || b.threatens !== (gain > 0)) return false;
      }
    }
    return playerS === o.playerSpiritualityAfter && enemyS === o.enemySpirituality && same(powers, o.powerUses);
  } catch { return false; }
}
