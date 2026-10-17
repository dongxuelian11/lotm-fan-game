import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { SEA_KING_TARGET_ID, SEA_KING_POWERS, SEA_KING_POWER_IDS, hasSeaKingDisputeOpponent,
  type SeaKingEnemyIntent, type SeaKingPowerId } from './encounter.js';

/** Finite Sea King3 G combat. The shared adapter retains the actual S4 core and common injury wheel. */
export const SEA_KING_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const SEA_KING_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const seaKingActionCount = pyromaniacActionCount;
export const seaKingEnemyActionCount = pyromaniacActionCount;
const TEMPEST = 'tyrant.s3.remote-tempest', DOMAIN = 'tyrant.s3.sea-domain';
const WIND = 'tyrant.s6.wind-control', LIGHTNING = 'tyrant.s4.great-lightning';
export type SeaKingMoveId = typeof TEMPEST | typeof DOMAIN | typeof WIND | typeof LIGHTNING | 'EVADE' | 'ACCIDENT';
const ABILITIES: readonly { id: SeaKingMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: TEMPEST, label: '有限远风（H；6S/意志18，优势65×新掌握G）', weight: 25, stance: 'ATTACK' },
  { id: DOMAIN, label: '有限海域（J；真实海水、6S/知识18，减势32G）', weight: 20, stance: 'CONTROL' },
  { id: WIND, label: '继承有限控风（B；4S/意志16，减势18×原掌握G）', weight: 15, stance: 'DEFEND' },
  { id: LIGHTNING, label: '继承有限强雷（K；6S/意志18，优势38×原掌握G）', weight: 20, stance: 'CONTROL' },
  { id: 'EVADE', label: '普通避让（R；减势10G、0S）', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A；固定−22.5G）', weight: 5, stance: null },
];
export const SEA_KING_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'WIND', label: '有限风压：5S/75G', weight: 35 }, { id: 'WATER_WARD', label: '真实海水防护：4S/减45G', weight: 25 },
  { id: 'BODY_STRIKE', label: '同一原棍：20×身体G', weight: 20 }, { id: 'FOCUS', label: '有限专注：4S/抵本轮下一次成功风水压力，不抵雷', weight: 15 },
  { id: 'ACCIDENT', label: '判断偏差：−22.5G', weight: 5 },
];
export const isSeaKing = (s: SliceState): boolean => s.progression.pathwayId === 'tyrant' && s.progression.sequence === 3;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function seaKingAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 }));
}
export function drawSeaKingAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): SeaKingMoveId {
  const weights = tickets(stance); let n = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return a.id; } throw new Error('海王六槽能力盘无效。');
}
export function drawSeaKingEnemyAbility(random: ActionRandomStream): SeaKingEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of SEA_KING_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as SeaKingEnemyIntent; }
  throw new Error('原昆廷五类行动盘无效。');
}
export interface SeaKingCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'SEA_KING_DISPUTE'; targetId: typeof SEA_KING_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetAge: 49; targetSequence: 3; actualOriginalBody: true; independentMind: true;
  enemyWeapon: 'SK3-QUENTIN-CLUB'; weaponLocation: 'HAND'; distanceMetres: 2; space: 'SK3-DRY-QUAY';
  waterSource: 'SEAWATER' | 'NONE'; ordinaryExit: true; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyInjuries: SliceInjury[]; enemyRisk: number; clubHeld: boolean; knowledge: number; will: number;
  tempestMastery: number; windMastery: number; lightningMastery: number; powerUses: Record<SeaKingPowerId, number>;
}
const bounded = (n: number, max: number) => Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
// Exact inherited Cataclysm Priest implementation: 0.65 + 0.35 * clamp(mastery, 0, 500) / 500.
const mastery = (n: number) => .65 + .35 * bounded(n, 500) / 500;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
export function currentSeaKingCombatSource(s: SliceState): SeaKingCombatSource | null {
  if (!hasSeaKingDisputeOpponent(s)) return null;
  const e = s.seaKing.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'SEA_KING_DISPUTE', targetId: SEA_KING_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetAge: 49, targetSequence: 3, actualOriginalBody: true, independentMind: true,
    enemyWeapon: 'SK3-QUENTIN-CLUB', weaponLocation: 'HAND', distanceMetres: 2, space: 'SK3-DRY-QUAY', waterSource: e.waterSource,
    ordinaryExit: true, pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality,
    enemyInjuries: structuredClone(c.enemyInjuries), enemyRisk: c.enemyRisk, clubHeld: s.town.clubLocation === 'HAND',
    knowledge: s.character.coreStats.knowledge, will: s.character.coreStats.will,
    tempestMastery: bounded(s.progression.mastery[TEMPEST] ?? 0, 500), windMastery: bounded(s.progression.mastery[WIND] ?? 0, 500),
    lightningMastery: bounded(s.progression.mastery[LIGHTNING] ?? 0, 500), powerUses: { ...e.powerUses } };
}
export interface SeaKingCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean }
interface ActionEvidence extends SeaKingCombatEffect { order: number; paidCost: number; physicalFactor: number; rolls: number[] }
export interface SeaKingPlayerAction extends ActionEvidence { id: SeaKingMoveId; resisted: boolean; fallback: 'NONE' | 'STRIKE' | 'EVADE' | 'OBSERVE' }
export interface SeaKingEnemyAction extends ActionEvidence { planned: SeaKingEnemyIntent; actual: SeaKingEnemyIntent; focusGranted: boolean }
export interface SeaKingRoundContext {
  source: SeaKingCombatSource; stance: SliceStance; finished: boolean; liveState: string; focusReady: boolean;
  playerActions: SeaKingPlayerAction[]; enemyActions: SeaKingEnemyAction[]; label: string; outcome: SeaKingRoundOutcome | null;
}
const none = (label: string): SeaKingCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
function liveState(s: SliceState): string { const e = s.seaKing.encounter; return stableStringify({ spirituality: s.spirituality,
  enemySpirituality: e.enemySpirituality, powerUses: e.powerUses, waterSource: e.waterSource }); }
const dynamicSource = new Set(['playerSpirituality', 'enemySpirituality', 'powerUses']);
function validRound(s: SliceState, r: SeaKingRoundContext, supplied: SeaKingCombatSource | null): boolean {
  const actual = currentSeaKingCombatSource(s);
  return !r.finished && actual !== null && supplied !== null && same(supplied, r.source) && r.liveState === liveState(s) &&
    Object.entries(r.source).every(([key, value]) => dynamicSource.has(key) || same(actual[key as keyof SeaKingCombatSource], value));
}
export function beginSeaKingCombatRound(s: SliceState, stance: SliceStance, _random: ActionRandomStream): SeaKingRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('海王战斗姿态无效。');
  const source = currentSeaKingCombatSource(s); if (!source) throw new Error('缺少原昆廷、原棍或原码头的连续来源。');
  return { source, stance, finished: false, liveState: liveState(s), focusReady: false, playerActions: [], enemyActions: [], outcome: null,
    label: `同一49岁原昆廷在净空干燥码头2米外，独立S${source.enemySpirituality}/120；水源${source.waterSource}。本区无第三人只是实际场况，不赋予风水自动友军免疫。` };
}
export const createSeaKingCombatRound = beginSeaKingCombatRound;
function actionBase(order: number, physical: number): ActionEvidence { return { ...none(''), order, paidCost: 0, physicalFactor: bounded(physical, 1), rolls: [] }; }
function check(s: SliceState, a: ActionEvidence, ability: 'knowledge' | 'will', difficulty: number, random: ActionRandomStream): boolean {
  const chance = computeCheckChance({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [] }), roll = random.nextInt(1, 100);
  a.rolls.push(roll); return roll <= chance;
}
export function resolveSeaKingCombatAbility(s: SliceState, id: SeaKingMoveId, physical: number, random: ActionRandomStream,
  r: SeaKingRoundContext, source: SeaKingCombatSource | null = r.source): SeaKingCombatEffect {
  if (!validRound(s, r, source) || r.playerActions.length >= 6 || !ABILITIES.some(a => a.id === id))
    return none('缺少当前原人、原场与原资源来源，或已用完本轮最多六槽；0贡献0消耗，不重抽。');
  const a: SeaKingPlayerAction = { ...actionBase(r.playerActions.length + r.enemyActions.length, physical), id, resisted: false, fallback: 'NONE' };
  if (id === 'ACCIDENT') { a.selfGain = -22.5; a.label = '判断失衡固定−22.5G，不重抽或增加行动。'; }
  else if (id === 'EVADE') { a.enemyReduction = 10; a.label = '本人在原干燥码头普通避让，减势10G、0S；不制造免费风墙或保证免伤。'; }
  else {
    const wind = id === WIND, domain = id === DOMAIN, tempest = id === TEMPEST, cost = wind ? 4 : 6;
    const missingWater = domain && r.source.waterSource !== 'SEAWATER';
    if (missingWater || !Number.isFinite(s.spirituality) || s.spirituality < cost) {
      const reason = missingWater ? '当前原场没有实际海水，有限海域不能成立。' : `不足${cost}S，本槽法术未施放。`;
      a.fallback = tempest ? 'STRIKE' : wind || domain ? 'EVADE' : 'OBSERVE';
      if (a.fallback === 'STRIKE') { a.selfGain = (r.source.clubHeld ? 16 : 12) * a.physicalFactor; a.threatens = a.selfGain > 0; }
      else if (a.fallback === 'EVADE') a.enemyReduction = 10;
      a.label = reason + (a.fallback === 'STRIKE' ? `只以${r.source.clubHeld ? '实际自持原棍16' : '自己的原身体12'}×身体普通打击G` : a.fallback === 'EVADE' ? '只用原身体普通避让减势10G' : '只作普通观察、0贡献') + '，0S、无免费法术，不重抽。';
    } else {
      s.spirituality -= cost; a.paidCost = cost;
      const success = check(s, a, domain ? 'knowledge' : 'will', wind ? 16 : 18, random);
      if (success) {
        a.selfGain = tempest ? 65 * mastery(r.source.tempestMastery) : id === LIGHTNING ? 38 * mastery(r.source.lightningMastery) : 0;
        a.enemyReduction = domain ? 32 : wind ? 18 * mastery(r.source.windMastery) : 0;
        a.threatens = a.selfGain > 0;
      }
      const name = tempest ? '有限远风' : domain ? '邻接真实海水的有限海域' : wind ? '继承有限控风' : '继承有限强雷';
      a.label = `${name}实付${cost}S/${domain ? '知识18' : wind ? '意志16' : '意志18'}${success ? `成功，优势${a.selfGain}、减势${a.enemyReduction}G` : '失败，0贡献、实际成本保留'}；不直接扣H/M、不保证伤害或投降，不外推全海控制、免费船只或海生物库。`;
    }
  }
  if ([TEMPEST, DOMAIN, WIND].includes(id) && a.paidCost > 0 && (a.selfGain > 0 || a.enemyReduction > 0) && r.focusReady) {
    r.focusReady = false; a.resisted = true; a.selfGain = 0; a.enemyReduction = 0; a.threatens = false;
    a.label += '原昆廷消耗本轮已付费专注的一次风水抵抗，本次压力被抵消；实付成本不退，该专注不抵雷击。';
  }
  r.playerActions.push(a); r.liveState = liveState(s);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export function resolveSeaKingEnemyAbility(s: SliceState, planned: SeaKingEnemyIntent, physical: number, _random: ActionRandomStream,
  r: SeaKingRoundContext, source: SeaKingCombatSource | null = r.source): SeaKingCombatEffect {
  if (!validRound(s, r, source) || r.enemyActions.length >= 6 || ![...SEA_KING_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned))
    return none('缺少当前原昆廷及原棍来源，或已用完本轮最多六槽；0贡献0消耗，不重抽。');
  const e = s.seaKing.encounter, power = SEA_KING_POWERS.find(x => x.id === planned);
  const eligible = planned !== 'WATER_WARD' || r.source.waterSource === 'SEAWATER';
  const a: SeaKingEnemyAction = { ...actionBase(r.playerActions.length + r.enemyActions.length, physical), planned,
    actual: power && (!eligible || e.enemySpirituality < power.cost) ? 'BODY_STRIKE' : planned, focusGranted: false };
  if (power && a.actual === planned) {
    e.enemySpirituality -= power.cost; e.powerUses[power.id]++; a.paidCost = power.cost; a.selfGain = power.selfGain; a.enemyReduction = power.enemyReduction;
  }
  if (a.actual === 'ACCIDENT') { a.selfGain = -22.5; a.label = '原昆廷判断失衡，本槽固定−22.5G，不另抽。'; }
  else if (a.actual === 'BODY_STRIKE') { a.selfGain = 20 * a.physicalFactor; a.threatens = a.selfGain > 0;
    a.label = `${power ? '法术所需实际灵性或海水不足，未施法；' : ''}原昆廷持唯一SK3-QUENTIN-CLUB普通打击20×身体G，0S，无新武器或额外行动。`; }
  else if (a.actual === 'FOCUS') { r.focusReady = true; a.focusGranted = true;
    a.label = '原昆廷实付4S本轮专注，只抵下一次成功风或水压力一次，不抵雷击，0直接优势；不叠加、不跨轮。'; }
  else { a.threatens = a.actual === 'WIND'; a.label = `原昆廷${power!.label}实际付费${a.paidCost}S，${a.threatens ? '有限优势75' : '邻接真实海水有限减势45'}G，余${e.enemySpirituality}/120；作用当次结束，海水仍在原水带。`; }
  r.enemyActions.push(a); r.liveState = liveState(s);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export interface SeaKingRoundOutcome {
  targetId: typeof SEA_KING_TARGET_ID; round: number; source: SeaKingCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  enemyInjuriesAfter: SliceInjury[]; enemyRiskAfter: number;
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number;
  powerUses: Record<SeaKingPowerId, number>; waterSource: 'SEAWATER' | 'NONE'; focusReadyAfter: false; elapsedSeconds: 60;
  playerActions: SeaKingPlayerAction[]; enemyActions: SeaKingEnemyAction[];
}
export function finishSeaKingCombatRound(s: SliceState, r: SeaKingRoundContext, continuing = true): SeaKingRoundOutcome {
  const e = s.seaKing.encounter, c = s.combat;
  if (r.finished || !c || c.encounterId !== 'SEA_KING_DISPUTE' || c.round !== r.source.round || r.liveState !== liveState(s))
    throw new Error('原海王回合已结束，或同一原资源已被改写。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  if (e.enemyStatus !== 'RESISTING') e.weaponLocation = 'QUAY';
  s.seaKing.life.clockSeconds += 60; r.focusReady = false; r.finished = true;
  r.outcome = { targetId: SEA_KING_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus,
    enemyInjuriesAfter: structuredClone(c.enemyInjuries), enemyRiskAfter: c.enemyRisk,
    playerSpiritualityBefore: r.source.playerSpirituality, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind,
    enemySpiritualityBefore: r.source.enemySpirituality, powerUses: { ...e.powerUses }, waterSource: e.waterSource, focusReadyAfter: false,
    elapsedSeconds: 60, playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
  return structuredClone(r.outcome);
}
export function seaKingRoundOutcome(r: SeaKingRoundContext): SeaKingRoundOutcome {
  if (!r.outcome) throw new Error('先实际结束当前原海王回合。'); return structuredClone(r.outcome);
}
export function projectSeaKingCombat(s: SliceState) {
  const e = s.seaKing.encounter, visible = isSeaKing(s);
  return { enemyName: visible ? '昆廷（49岁，原创有限G3非凡者）' : '', targetId: visible ? e.targetId : null,
    enemyMind: visible ? e.enemyMind : null, enemySpirituality: visible ? e.enemySpirituality : null,
    powerUses: visible ? { ...e.powerUses } : null, waterSource: visible ? e.waterSource : null,
    originalExit: true, pursuit: false, distanceMetres: 2, automaticAllyImmunity: false, source: visible ? currentSeaKingCombatSource(s) : null,
    summary: visible ? '海王序列3有限G战斗。双方1–6次权重10/15/25/25/15/10；继承实际4核心35/25/25/15、1250/底125、S120，仅继续轮恢复12G。玩家六槽25/20/15/20/15/5，敌五类35/25/20/15/5。远风6S/意志18为65×新掌握；海域6S/知识18减32且须真实海水；旧控风4S/意志16减18×旧掌握，旧强雷6S/意志18为38×旧掌握，系数均0.65+0.35×掌握/500。灵性或水源不足仅普通0S回退。共同伤势盘决定原身体后果；旧本尼迪克特实际死亡与原物保留，无免费艇、海生物或自动友军免疫。' : '' };
}
/** Replays actual ordered paid actions and one-round resistance; never awards free spell effects. */
export function validateSeaKingRoundOutcome(value: unknown): value is SeaKingRoundOutcome {
  try {
    const o = value as SeaKingRoundOutcome, x = o?.source;
    if (!o || !x || typeof x.runId !== 'string' || !integer(x.revision) || !integer(x.week, 1) || !integer(x.round, 1) || !integer(x.startHistoryIndex) || x.attemptWeek !== x.week ||
        x.encounterId !== 'SEA_KING_DISPUTE' || x.targetId !== SEA_KING_TARGET_ID || x.targetAge !== 49 || x.targetSequence !== 3 || x.actualOriginalBody !== true || x.independentMind !== true ||
        x.enemyWeapon !== 'SK3-QUENTIN-CLUB' || x.weaponLocation !== 'HAND' || x.distanceMetres !== 2 || x.space !== 'SK3-DRY-QUAY' || x.ordinaryExit !== true || x.pursuit !== false ||
        x.thirdPartiesInArea !== 0 || x.automaticAllyImmunity !== false || !['SEAWATER', 'NONE'].includes(x.waterSource) || o.waterSource !== x.waterSource ||
        ![x.playerHealth, x.playerMind, x.enemyHealth, x.enemyMind].every(n => integer(n, 1, 100)) ||
        ![x.knowledge, x.will, x.tempestMastery, x.windMastery, x.lightningMastery].every(n => integer(n, 0, 500)) || typeof x.clubHeld !== 'boolean' ||
        !Array.isArray(x.enemyInjuries) || !integer(x.enemyRisk) || !Array.isArray(o.enemyInjuriesAfter) || !integer(o.enemyRiskAfter) ||
        o.targetId !== SEA_KING_TARGET_ID || o.round !== x.round || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) ||
        typeof o.continuing !== 'boolean' || o.elapsedSeconds !== 60 || o.focusReadyAfter !== false ||
        ![o.enemyHealth, o.playerHealthAfter].every(n => integer(n, 0, 100)) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(o.enemyStatus) || (o.enemyStatus === 'DEAD') !== (o.enemyHealth === 0) ||
        o.enemyMind !== x.enemyMind || o.playerMindAfter !== x.playerMind || ![x.playerSpirituality, x.enemySpirituality, o.playerSpiritualityAfter, o.enemySpirituality].every(n => integer(n, 0, 120)) ||
        o.playerSpiritualityBefore !== x.playerSpirituality || o.enemySpiritualityBefore !== x.enemySpirituality || !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) ||
        o.playerActions.length > 6 || o.enemyActions.length > 6 || !x.powerUses || Object.keys(x.powerUses).length !== 3 ||
        !SEA_KING_POWER_IDS.every(id => integer(x.powerUses[id])) || x.enemySpirituality !== 120 - SEA_KING_POWERS.reduce((n, p) => n + x.powerUses[p.id] * p.cost, 0)) return false;
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
        const wind = b.id === WIND, domain = b.id === DOMAIN, tempest = b.id === TEMPEST;
        const required = b.id === 'EVADE' || b.id === 'ACCIDENT' ? 0 : wind ? 4 : 6;
        const eligible = !domain || x.waterSource === 'SEAWATER';
        const paid = required > 0 && eligible && playerS >= required ? required : 0;
        const fallback = required > 0 && !paid ? tempest ? 'STRIKE' : wind || domain ? 'EVADE' : 'OBSERVE' : 'NONE';
        if (b.paidCost !== paid || b.fallback !== fallback || b.rolls.length !== (paid > 0 ? 1 : 0)) return false;
        const success = paid > 0 && b.rolls[0]! <= computeCheckChance({ ability: domain ? 'knowledge' : 'will',
          baseAbility: domain ? x.knowledge : x.will, difficulty: wind ? 16 : 18, modifiers: [] });
        playerS -= paid; let gain = 0, reduction = 0;
        if (b.id === 'ACCIDENT') gain = -22.5;
        else if (fallback === 'STRIKE') gain = (x.clubHeld ? 16 : 12) * b.physicalFactor;
        else if (b.id === 'EVADE' || fallback === 'EVADE') reduction = 10;
        else if (success) { gain = tempest ? 65 * mastery(x.tempestMastery) : b.id === LIGHTNING ? 38 * mastery(x.lightningMastery) : 0;
          reduction = domain ? 32 : wind ? 18 * mastery(x.windMastery) : 0; }
        const resisted = [TEMPEST, DOMAIN, WIND].includes(b.id) && paid > 0 && (gain > 0 || reduction > 0) && focus;
        if (resisted) { focus = false; gain = 0; reduction = 0; }
        if (b.selfGain !== gain || b.enemyReduction !== reduction || b.threatens !== (gain > 0) || b.resisted !== resisted) return false;
      } else {
        const b = entry.a, power = SEA_KING_POWERS.find(v => v.id === b.planned);
        if (![...SEA_KING_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(b.planned) || b.rolls.length !== 0) return false;
        const eligible = b.planned !== 'WATER_WARD' || x.waterSource === 'SEAWATER';
        const actual = power && (!eligible || enemyS < power.cost) ? 'BODY_STRIKE' : b.planned, cost = power && actual === b.planned ? power.cost : 0;
        if (b.actual !== actual || b.paidCost !== cost || b.focusGranted !== (actual === 'FOCUS')) return false;
        enemyS -= cost; if (power && cost > 0) powers[power.id]++;
        if (actual === 'FOCUS') focus = true;
        const gain = actual === 'ACCIDENT' ? -22.5 : actual === 'BODY_STRIKE' ? 20 * b.physicalFactor : actual === 'WIND' ? 75 : 0;
        if (b.selfGain !== gain || b.enemyReduction !== (actual === 'WATER_WARD' ? 45 : 0) || b.threatens !== (gain > 0)) return false;
      }
    }
    return playerS === o.playerSpiritualityAfter && enemyS === o.enemySpirituality && same(powers, o.powerUses);
  } catch { return false; }
}
