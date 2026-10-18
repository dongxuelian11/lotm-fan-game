import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance, resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import type { SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { advanceCoffinBearerLifeClock, consumeCoffinBearerGuardSegment, getCoffinBearerGuardSegment } from './life.js';
import { COFFIN_BEARER_TARGET_ID, COFFIN_BEARER_POWERS, COFFIN_BEARER_POWER_IDS, hasCoffinBearerDisputeOpponent,
  type CoffinBearerEnemyIntent, type CoffinBearerPowerId, type CoffinBearerEncounterScene } from './encounter.js';

/** Every new preservation duration, physical medium and combat budget is explicitly finite G. */
export const COFFIN_BEARER_COUNT_WHEEL: readonly SliceWheelEntry[] = [
  { id: '1', label: '1次', weight: 12 }, { id: '2', label: '2次', weight: 20 }, { id: '3', label: '3次', weight: 25 },
  { id: '4', label: '4次', weight: 23 }, { id: '5', label: '5次', weight: 14 }, { id: '6', label: '6次', weight: 6 },
];
export const COFFIN_BEARER_ENEMY_COUNT_WHEEL = COFFIN_BEARER_COUNT_WHEEL;
export const coffinBearerActionCount = (roll: number): number => roll <= 12 ? 1 : roll <= 32 ? 2 : roll <= 57 ? 3 : roll <= 80 ? 4 : roll <= 94 ? 5 : 6;
export const coffinBearerEnemyActionCount = coffinBearerActionCount;
export const COFFIN_BEARER_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '原有限弧光：5灵性，贡献70（G）', weight: 35 },
  { id: 'WARD', label: '原有限护术：4灵性，对方−30（G）', weight: 25 },
  { id: 'BODY_STRIKE', label: '自有原棍打击：20×身体（G）', weight: 25 },
  { id: 'COMPOSE', label: '普通调整抵抗：4灵性，贡献8，不清实体护腕（G）', weight: 10 },
  { id: 'ACCIDENT', label: '动作偏差：固定−22.5（G）', weight: 5 },
];
export type CoffinBearerMoveId = 'STRIKE' | 'BODY_FOLLOWUP' | 'mother.s4.living-matrix' | 'mother.s3.finite-preservation' | 'mother.s7.life-support' | 'ACCIDENT';
const H = 'STRIKE', J = 'BODY_FOLLOWUP', B = 'mother.s4.living-matrix', K = 'mother.s3.finite-preservation', R = 'mother.s7.life-support';
const ABILITIES: readonly { id: CoffinBearerMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: H, label: '继承普通近身打击（H；12×身体，G）', weight: 30, stance: 'ATTACK' },
  { id: J, label: '继承细心练习普通侧击（J；8.4×原掌握×身体，G）', weight: 15, stance: 'ATTACK' },
  { id: B, label: '继承有限活性基质（B；新原段×1、4灵性、知识18；后续一次正BODY/ARC×0.6，G）', weight: 25, stance: 'DEFEND' },
  { id: K, label: '有限活性保全（K；新原段×1、5灵性、知识20四档；后续两次正BODY/ARC×0.8，G）', weight: 10, stance: 'CONTROL' },
  { id: R, label: '继承有限生命支持（R；仅实际恢复才付4灵性，G）', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差（A；固定−22.5，G）', weight: 5, stance: null },
];
export const isCoffinBearer = (s: SliceState): boolean => s.progression.pathwayId === 'mother' && s.progression.sequence === 3;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function coffinBearerAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, weight: weights[i]! / total * 100,
    label: a.id === H && s.town.clubLocation === 'HAND' ? '本人持握原短棍打击（H；16×身体，G）' : a.label }));
}
export function drawCoffinBearerAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): CoffinBearerMoveId {
  const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (let i = 0; i < ABILITIES.length; i++) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('抬棺人能力盘权重无效。');
}
export function drawCoffinBearerEnemyAbility(random: ActionRandomStream): CoffinBearerEnemyIntent {
  let roll = random.nextInt(1, 100);
  for (const a of COFFIN_BEARER_ENEMY_ABILITY_WHEEL) { roll -= a.weight; if (roll <= 0) return a.id as CoffinBearerEnemyIntent; }
  throw new Error('原诺兰动作盘权重无效。');
}
const bounded = (n: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));
const factor = (n: number) => .65 + .35 * bounded(n, 500) / 500;
const mastery = (s: SliceState, id: string) => bounded(s.progression.mastery[id] ?? 0, 500);
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
const resource = (n: unknown, max = 120): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
export type CoffinBearerCombatGuard = SliceState['coffinBearer']['life']['guard'];
export interface CoffinBearerGuardReference { guardId: string; segmentId: string }
export function validCoffinBearerCombatGuard(v: unknown): v is CoffinBearerCombatGuard {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const g = v as CoffinBearerCombatGuard;
  if (!same(Object.keys(g).sort(), 'id sourceId prepared owner location preparedWeek actionsSpent costPence spiritualitySpent segments'.split(' ').sort()) ||
    g.id !== 'CB3-GUARD' || g.sourceId !== 'CB3-GUARD-MATERIAL' || typeof g.prepared !== 'boolean' || !Array.isArray(g.segments) || g.segments.length !== 3 ||
    g.segments.some((x, i) => !x || Object.keys(x).length !== 2 || x.id !== `CB3-SEG${i + 1}` || !['RAW', 'UNUSED', 'SPENT'].includes(x.status))) return false;
  return g.prepared ? g.owner === 'PLAYER' && g.location === 'HAND' && integer(g.preparedWeek, 1) && g.actionsSpent === 1 && g.costPence === 120 && g.spiritualitySpent === 4 && g.segments.every(x => x.status !== 'RAW') :
    g.owner === 'SUPPLIER' && g.location === 'SUPPLIER' && g.preparedWeek === null && g.actionsSpent === 0 && g.costPence === 0 && g.spiritualitySpent === 0 && g.segments.every(x => x.status === 'RAW');
}
export function validCoffinBearerCombatScene(v: unknown): v is CoffinBearerEncounterScene {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const s = v as CoffinBearerEncounterScene;
  return Object.keys(s).length === 8 && s.courtId === 'CB3-COURT' && s.ordinaryExit === 'OPEN' && s.thirdPartiesInArea === 0 && typeof s.clearanceConfirmed === 'boolean' &&
    ['COURT', 'EXIT'].includes(s.playerPosition) && s.distanceMetres === 2 && s.exitMetres === 4 && s.ordinaryWalkedMetres === (s.playerPosition === 'EXIT' ? 4 : 0);
}
export interface CoffinBearerCombatSource {
  runId: string; revision: number; week: number; round: number; lifeClockSeconds: number;
  encounterId: 'COFFIN_BEARER_DISPUTE'; targetId: typeof COFFIN_BEARER_TARGET_ID; attemptWeek: number; startHistoryIndex: number;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number; knowledge: number;
  coreStats: SliceState['character']['coreStats']; playerInjuries: SliceInjury[]; playerRisk: number;
  clubLocation: SliceState['town']['clubLocation']; actualOriginalBody: true; mutuallyVisible: true;
  distanceMetres: 2; noBystanders: true; ordinaryExit: true; pursuit: false; targetAlive: true; independentMind: true;
  targetSequence: 4; targetAge: 42; targetPhysique: 22; enemyWeapon: 'CB3-NOLAN-ROD'; weaponOwner: typeof COFFIN_BEARER_TARGET_ID; weaponLocation: 'HAND'; scene: CoffinBearerEncounterScene;
  enemyInjuries: SliceInjury[]; enemyRisk: number;
  carefulMastery: number; healingMastery: number; lifeSupportMastery: number; specimenMastery: number; groundMastery: number; matrixMastery: number;
  powerUses: Record<CoffinBearerPowerId, number>; guardAttempts: number; preservationAttempts: number; guard: CoffinBearerCombatGuard;
}
export function currentCoffinBearerCombatSource(s: SliceState): CoffinBearerCombatSource | null {
  if (!hasCoffinBearerDisputeOpponent(s) || !validCoffinBearerCombatGuard(s.coffinBearer.life.guard)) return null;
  const e = s.coffinBearer.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, lifeClockSeconds: s.coffinBearer.life.clockSeconds,
    encounterId: 'COFFIN_BEARER_DISPUTE', targetId: COFFIN_BEARER_TARGET_ID, attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality,
    knowledge: s.character.coreStats.knowledge, coreStats: { ...s.character.coreStats }, playerInjuries: structuredClone(s.injuries), playerRisk: s.injuryRisk, clubLocation: s.town.clubLocation,
    actualOriginalBody: true, mutuallyVisible: true, distanceMetres: 2, noBystanders: true, ordinaryExit: true, pursuit: false, targetAlive: true, independentMind: true,
    targetSequence: 4, targetAge: 42, targetPhysique: 22, enemyWeapon: 'CB3-NOLAN-ROD', weaponOwner: COFFIN_BEARER_TARGET_ID, weaponLocation: 'HAND', scene: structuredClone(e.scene),
    enemyInjuries: structuredClone(c.enemyInjuries), enemyRisk: c.enemyRisk,
    carefulMastery: mastery(s, 'mother.s9.careful-practice'), healingMastery: mastery(s, 'mother.s8.limited-healing'), lifeSupportMastery: mastery(s, R),
    specimenMastery: mastery(s, 'mother.s6.specimen-study'), groundMastery: mastery(s, 'mother.s5.ground-passage'), matrixMastery: mastery(s, B),
    powerUses: { ...e.powerUses }, guardAttempts: e.guardAttempts, preservationAttempts: e.preservationAttempts, guard: structuredClone(s.coffinBearer.life.guard) };
}
export interface CoffinBearerCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
interface ActionEvidence extends CoffinBearerCombatEffect {
  order: number; paidCost: number; physicalFactor: number; rolls: number[];
  spiritualityBefore: number; spiritualityAfter: number; guardModeBefore: 'MATRIX' | 'PRESERVE' | null; guardModeAfter: 'MATRIX' | 'PRESERVE' | null; guardChargesBefore: number; guardChargesAfter: number;
  checkTier: PublicResolutionTier | null; checkChance: number | null; checkRoll: number | null; succeeded: boolean; guard: CoffinBearerGuardReference | null;
}
export interface CoffinBearerPlayerAction extends ActionEvidence { id: CoffinBearerMoveId; recoveredHealth: number; activeSeconds: 0 | 60; healthBefore: number; healthAfter: number }
export interface CoffinBearerEnemyAction extends ActionEvidence { planned: CoffinBearerEnemyIntent; actual: CoffinBearerEnemyIntent; guardApplied: boolean }
interface RoundModel {
  playerSpirituality: number; playerHealth: number; enemySpirituality: number; powerUses: Record<CoffinBearerPowerId, number>;
  guardMode: 'MATRIX' | 'PRESERVE' | null; guardCharges: number; guardAttempts: number; preservationAttempts: number; guard: CoffinBearerCombatGuard;
}
export interface CoffinBearerRoundContext {
  source: CoffinBearerCombatSource; stance: SliceStance; finished: boolean; liveState: string;
  playerSpiritualityBefore: number; enemySpiritualityBefore: number; model: RoundModel;
  playerActions: CoffinBearerPlayerAction[]; enemyActions: CoffinBearerEnemyAction[]; label: string;
}
const activeRounds = new WeakMap<SliceState, CoffinBearerRoundContext>();
const none = (label: string): CoffinBearerCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
// Only the explicit model-owned changes may differ from the original source during action resolution.
const dynamicSource = new Set(['playerHealth', 'playerSpirituality', 'enemySpirituality', 'powerUses', 'guardAttempts', 'preservationAttempts', 'guard']);
function liveState(s: SliceState): string {
  const e = s.coffinBearer.encounter;
  // Consequence settlement changes health/injuries after the last action; all other inputs stay fixed.
  return stableStringify({ runId: s.runId, revision: s.revision, week: s.week, clock: s.coffinBearer.life.clockSeconds,
    coreStats: s.character.coreStats, mastery: s.progression.mastery, clubLocation: s.town.clubLocation, targetId: e.targetId,
    weaponLocation: e.weaponLocation, scene: e.scene, spirituality: s.spirituality, enemySpirituality: e.enemySpirituality,
    powerUses: e.powerUses, guardMode: e.guardMode, guardCharges: e.guardCharges, guardAttempts: e.guardAttempts, preservationAttempts: e.preservationAttempts, guard: s.coffinBearer.life.guard });
}
function validRound(s: SliceState, r: CoffinBearerRoundContext, source: CoffinBearerCombatSource | null): boolean {
  const current = currentCoffinBearerCombatSource(s), m = r.model, e = s.coffinBearer.encounter;
  return activeRounds.get(s) === r && !r.finished && current !== null && source !== null && same(source, r.source) &&
    Object.entries(r.source).every(([k, v]) => dynamicSource.has(k) || same(current[k as keyof CoffinBearerCombatSource], v)) && r.liveState === liveState(s) &&
    s.health === m.playerHealth && s.spirituality === m.playerSpirituality && e.enemySpirituality === m.enemySpirituality && same(e.powerUses, m.powerUses) &&
    e.guardMode === m.guardMode && e.guardCharges === m.guardCharges && e.guardAttempts === m.guardAttempts && e.preservationAttempts === m.preservationAttempts && same(s.coffinBearer.life.guard, m.guard);
}
const initialModel = (source: CoffinBearerCombatSource, player: number, enemy: number): RoundModel => ({
  playerSpirituality: player, playerHealth: source.playerHealth, enemySpirituality: enemy, powerUses: { ...source.powerUses },
  guardMode: null, guardCharges: 0, guardAttempts: source.guardAttempts, preservationAttempts: source.preservationAttempts, guard: structuredClone(source.guard),
});
function commitModel(s: SliceState, r: CoffinBearerRoundContext): void {
  const m = r.model, e = s.coffinBearer.encounter;
  s.spirituality = m.playerSpirituality; s.health = m.playerHealth; e.enemySpirituality = m.enemySpirituality; e.powerUses = { ...m.powerUses };
  e.guardMode = m.guardMode; e.guardCharges = m.guardCharges; e.guardAttempts = m.guardAttempts; e.preservationAttempts = m.preservationAttempts; r.liveState = liveState(s);
}
export function beginCoffinBearerCombatRound(s: SliceState, stance: SliceStance, _random: ActionRandomStream): CoffinBearerRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('战术姿态无效。');
  const source = currentCoffinBearerCombatSource(s), e = s.coffinBearer.encounter;
  if (!source || activeRounds.has(s) || e.guardMode !== null || e.guardCharges !== 0) throw new Error('缺少同一原诺兰的新回合来源，已有回合或上轮有限护持尚未结束。');
  const r: CoffinBearerRoundContext = { source, stance, finished: false, liveState: liveState(s), playerSpiritualityBefore: s.spirituality, enemySpiritualityBefore: e.enemySpirituality,
    model: initialModel(source, s.spirituality, e.enemySpirituality), playerActions: [], enemyActions: [],
    label: `原诺兰本人在净空浅壤土院2米外，灵性${e.enemySpirituality}/120；新护腕仅使用实际新原段，原普通出口开放。` };
  activeRounds.set(s, r); return r;
}
function evidence(order: number, physical: number, m: RoundModel, actor: 'PLAYER' | 'ENEMY'): ActionEvidence {
  const spirituality = actor === 'PLAYER' ? m.playerSpirituality : m.enemySpirituality;
  return { ...none(''), order, paidCost: 0, physicalFactor: physical, rolls: [], checkChance: null, checkRoll: null, checkTier: null, succeeded: false, guard: null,
    spiritualityBefore: spirituality, spiritualityAfter: spirituality, guardModeBefore: m.guardMode, guardModeAfter: m.guardMode, guardChargesBefore: m.guardCharges, guardChargesAfter: m.guardCharges };
}
function completeAction<T extends ActionEvidence>(a: T, m: RoundModel, actor: 'PLAYER' | 'ENEMY'): T {
  a.spiritualityAfter = actor === 'PLAYER' ? m.playerSpirituality : m.enemySpirituality; a.guardModeAfter = m.guardMode; a.guardChargesAfter = m.guardCharges; return a;
}
function playerAction(source: CoffinBearerCombatSource, m: RoundModel, id: CoffinBearerMoveId, physical: number, order: number, random: ActionRandomStream): CoffinBearerPlayerAction {
  const a: CoffinBearerPlayerAction = { ...evidence(order, physical, m, 'PLAYER'), id, recoveredHealth: 0, activeSeconds: 0, healthBefore: m.playerHealth, healthAfter: m.playerHealth };
  const pay = (cost: number) => { if (m.playerSpirituality < cost) return false; m.playerSpirituality -= cost; a.paidCost += cost; return true; };
  if (id === H) {
    a.selfGain = (source.clubLocation === 'HAND' ? 16 : 12) * physical; a.threatens = a.selfGain > 0;
    a.label = `${source.clubLocation === 'HAND' ? '本人持握原短棍16' : '继承普通近身打击12'}×身体（G），0灵性，不取得原诺兰的唯一原棍。`;
  } else if (id === J) {
    a.selfGain = 8.4 * factor(source.carefulMastery) * physical; a.threatens = a.selfGain > 0;
    a.label = '继承细心练习普通侧击：8.4×原掌握系数×身体（G），0灵性，仅本次BODY原槽。';
  } else if (id === B || id === K) {
    const preserve = id === K, cost = preserve ? 5 : 4;
    const segment = m.guard.prepared && m.guard.owner === 'PLAYER' && m.guard.location === 'HAND' ? m.guard.segments.find(x => x.status === 'UNUSED') : undefined;
    if (m.guardCharges > 0) a.label = '已有本轮待用有限护持：B与K互不叠加，0灵性、0耗段、0判定，不替换或续期。';
    else if (!segment || m.playerSpirituality < cost) {
      a.enemyReduction = preserve ? 6 * physical : 42.25 * factor(source.specimenMastery) * physical;
      a.label = preserve ? '无实际新原段或不足5灵性：普通走位6×身体（G），0消耗、0判定，不虚构保全。' : '无实际新原段或不足4灵性：继承样本观察护身42.25×原掌握系数×身体（G），0消耗、0判定。';
    } else {
      pay(cost); a.guard = { guardId: m.guard.id, segmentId: segment.id }; segment.status = 'SPENT';
      if (preserve) m.preservationAttempts++; else m.guardAttempts++;
      a.checkRoll = random.nextInt(1, 100); a.rolls.push(a.checkRoll);
      if (preserve) {
        const check = resolveNormalCheck({ ability: 'knowledge', baseAbility: source.knowledge, difficulty: 20, modifiers: [], roll: a.checkRoll });
        a.checkChance = check.chance; a.checkTier = check.tier; a.succeeded = check.tier === 'GREAT_SUCCESS' || check.tier === 'SUCCESS';
      } else { a.checkChance = computeCheckChance({ ability: 'knowledge', baseAbility: source.knowledge, difficulty: 18, modifiers: [] }); a.succeeded = a.checkRoll <= a.checkChance; }
      if (a.succeeded) { m.guardMode = preserve ? 'PRESERVE' : 'MATRIX'; m.guardCharges = preserve ? 2 : 1; a.activeSeconds = 60; }
      a.label = `新原护腕${a.guard.guardId}同一原段${a.guard.segmentId}成为惰性原物，实付${cost}灵性、知识${preserve ? '20四档' : '18二元'}${a.checkRoll}/${a.checkChance}${a.checkTier ? `：${a.checkTier}` : ''}（G）；${a.succeeded ? `本轮后续最多${preserve ? '两' : '一'}次实际正BODY或ARC贡献×${preserve ? '0.8' : '0.6'}，最多60秒` : '失败，贡献0且原段与灵性不退'}。新实物媒介为G，不改伤势盘、累计风险或死亡，不造魂、复活或补料。`;
    }
  } else if (id === R) {
    if (m.playerHealth >= 100) a.label = '继承有限生命支持：健康已满，恢复0、消耗0、0随机；原伤势与累计风险保留。';
    else if (!pay(4)) a.label = '继承有限生命支持：不足4灵性，恢复0、消耗0、0随机，不代扣健康或精神。';
    else { a.recoveredHealth = Math.min(100 - m.playerHealth, Math.floor(15 * factor(source.lifeSupportMastery))); m.playerHealth += a.recoveredHealth;
      a.label = `继承有限生命支持实付4灵性，floor(15×原掌握系数)实际恢复${a.recoveredHealth}健康（G），战势0、0随机；不清原伤、累计风险或污染，不恢复精神、不复活。`; }
  } else { a.selfGain = -22.5; a.label = '动作偏差固定−22.5战势（G），0灵性，不另掷正负，不构成攻击。'; }
  a.healthAfter = m.playerHealth; return completeAction(a, m, 'PLAYER');
}
function enemyAction(_source: CoffinBearerCombatSource, m: RoundModel, planned: CoffinBearerEnemyIntent, physical: number, order: number): CoffinBearerEnemyAction {
  const power = COFFIN_BEARER_POWERS.find(p => p.id === planned), payable = !!power && m.enemySpirituality >= power.cost;
  const actual: CoffinBearerEnemyIntent = planned === 'ACCIDENT' ? planned : payable ? planned : 'BODY_STRIKE';
  const a: CoffinBearerEnemyAction = { ...evidence(order, physical, m, 'ENEMY'), planned, actual, guardApplied: false };
  if (payable) { a.paidCost = power!.cost; m.enemySpirituality -= a.paidCost; m.powerUses[power!.id]++; }
  const attack = actual === 'BODY_STRIKE' || actual === 'ARC_BOLT', raw = actual === 'ACCIDENT' ? -22.5 : payable ? power!.selfGain : 20 * physical;
  a.guardApplied = attack && raw > 0 && m.guardCharges > 0;
  const reduction = a.guardApplied ? m.guardMode === 'MATRIX' ? .6 : .8 : 1;
  if (a.guardApplied && --m.guardCharges === 0) m.guardMode = null;
  a.selfGain = raw * reduction; a.enemyReduction = payable ? power!.enemyReduction : 0; a.threatens = attack && a.selfGain > 0;
  a.label = `${actual === 'ACCIDENT' ? '原诺兰动作偏差固定−22.5、0灵性（G）' : actual === 'COMPOSE' ? `原诺兰普通调整抵抗实付4灵性，贡献8，余${m.enemySpirituality}/120；不清实体护腕或未用保全` : payable ? `原诺兰完成${power!.label}，实付${power!.cost}灵性，余${m.enemySpirituality}/120` : `${power ? '原法术灵性不足' : '原身体打击'}，同一原槽实际以自有CB3-NOLAN-ROD普通棍击20×身体，0灵性（G）`}${a.guardApplied ? `；本次实际正攻击被${a.guardModeBefore === 'MATRIX' ? '基质' : '保全'}×${reduction}，消耗一次护持，剩${m.guardCharges}次` : ''}。不重抽、补能或直接扣健康。`;
  return completeAction(a, m, 'ENEMY');
}
export function resolveCoffinBearerCombatAbility(s: SliceState, id: CoffinBearerMoveId, physicalStateFactor: number, random: ActionRandomStream,
  r: CoffinBearerRoundContext, source: CoffinBearerCombatSource | null = r.source): CoffinBearerCombatEffect {
  if (!validRound(s, r, source) || r.playerActions.length >= 6 || r.stance === 'RETREAT' || !ABILITIES.some(a => a.id === id)) return none('缺少本回合同一原活人或原资源来源，0贡献、0消耗，不重抽。');
  const next = structuredClone(r.model), a = playerAction(r.source, next, id, bounded(physicalStateFactor, 1), r.playerActions.length + r.enemyActions.length, random);
  if (a.guard && (!same(getCoffinBearerGuardSegment(s), a.guard) || !consumeCoffinBearerGuardSegment(s, a.guard.guardId, a.guard.segmentId))) throw new Error('实际新原护腕段不存在，不能借用旧护腕或虚构库存。');
  r.model = next; r.playerActions.push(a); commitModel(s, r); return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
export function resolveCoffinBearerEnemyAbility(s: SliceState, planned: CoffinBearerEnemyIntent, physicalStateFactor: number, _random: ActionRandomStream,
  r: CoffinBearerRoundContext, source: CoffinBearerCombatSource | null = r.source): CoffinBearerCombatEffect {
  if (!validRound(s, r, source) || r.enemyActions.length >= 6 || ![...COFFIN_BEARER_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned)) return none('缺少同一原诺兰的实际来源，0贡献、0消耗，不重抽。');
  const a = enemyAction(r.source, r.model, planned, bounded(physicalStateFactor, 1), r.playerActions.length + r.enemyActions.length);
  r.enemyActions.push(a); commitModel(s, r); return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
export const resolveCoffinBearerEnemyCombatAbility = resolveCoffinBearerEnemyAbility;
export interface CoffinBearerRoundOutcome {
  targetId: typeof COFFIN_BEARER_TARGET_ID; round: number; source: CoffinBearerCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuriesAfter: SliceInjury[]; enemyRiskAfter: number;
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthBeforeConsequence: number; playerHealthAfter: number; playerMindAfter: number; playerInjuriesAfter: SliceInjury[]; playerRiskAfter: number;
  enemySpiritualityBefore: number; powerUses: Record<CoffinBearerPowerId, number>; guardAttempts: number; preservationAttempts: number;
  guardMode: null; guardCharges: 0; guardAfter: CoffinBearerCombatGuard; playerActions: CoffinBearerPlayerAction[]; enemyActions: CoffinBearerEnemyAction[];
  elapsedSeconds: 60; lifeClockSecondsBefore: number; lifeClockSecondsAfter: number; exitSeconds: 0 | 4; sceneAfter: CoffinBearerEncounterScene; weaponLocation: 'HAND' | 'COURT';
}
export function finishCoffinBearerCombatRound(s: SliceState, r: CoffinBearerRoundContext, continuing = true): CoffinBearerRoundOutcome {
  if (activeRounds.get(s) !== r || r.finished || s.combat?.encounterId !== 'COFFIN_BEARER_DISPUTE' || s.combat.round !== r.source.round || r.liveState !== liveState(s) ||
      s.coffinBearer.life.clockSeconds !== r.source.lifeClockSeconds || !same(s.coffinBearer.life.guard, r.model.guard)) throw new Error('同一原回合已经结束、不存在或实际资源被改写。');
  const e = s.coffinBearer.encounter, c = s.combat;
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  e.guardMode = null; e.guardCharges = 0; r.model.guardMode = null; r.model.guardCharges = 0; if (e.enemyStatus === 'DEAD') e.weaponLocation = 'COURT';
  advanceCoffinBearerLifeClock(s, 60);
  const exitSeconds = !continuing && s.health > 0 ? 4 : 0;
  if (exitSeconds) { e.scene.playerPosition = 'EXIT'; e.scene.ordinaryWalkedMetres = 4; e.exitTravelMetres = 4; e.exitSeconds = 4; advanceCoffinBearerLifeClock(s, 4); }
  r.finished = true; activeRounds.delete(s);
  return { targetId: COFFIN_BEARER_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, enemyInjuriesAfter: structuredClone(e.enemyInjuries), enemyRiskAfter: e.enemyRisk,
    playerSpiritualityBefore: r.playerSpiritualityBefore, playerSpiritualityAfter: s.spirituality, playerHealthBeforeConsequence: r.model.playerHealth, playerHealthAfter: s.health, playerMindAfter: s.mind,
    playerInjuriesAfter: structuredClone(s.injuries), playerRiskAfter: s.injuryRisk, enemySpiritualityBefore: r.enemySpiritualityBefore, powerUses: { ...e.powerUses },
    guardAttempts: e.guardAttempts, preservationAttempts: e.preservationAttempts, guardMode: null, guardCharges: 0, guardAfter: structuredClone(s.coffinBearer.life.guard),
    playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions), elapsedSeconds: 60, lifeClockSecondsBefore: r.source.lifeClockSeconds,
    lifeClockSecondsAfter: s.coffinBearer.life.clockSeconds, exitSeconds, sceneAfter: structuredClone(e.scene), weaponLocation: e.weaponLocation };
}
export function projectCoffinBearerCombat(s: SliceState) {
  const e = s.coffinBearer.encounter;
  return { enemyName: '诺兰·韦斯特（CB3-NOLAN，42岁原创序列4对手，G）', targetId: e.targetId, enemySpirituality: e.enemySpirituality,
    powerUses: { ...e.powerUses }, guardMode: e.guardMode, guardCharges: e.guardCharges, guardAttempts: e.guardAttempts, preservationAttempts: e.preservationAttempts,
    guard: structuredClone(s.coffinBearer.life.guard), originalExit: true, pursuit: false, distanceMetres: 2, source: currentCoffinBearerCombatSource(s),
    summary: `原诺兰灵性${e.enemySpirituality}/120。B实付新原段×1与4灵性、知识18二元，成功护住后续一次正BODY/ARC至60%；新K实付新原段×1与5灵性、知识20四档，成功护住后续最多两次正BODY/ARC至80%。任何待用B或K都阻止重复付费叠加。敌护持、凝神、偏差与0贡献不消耗次数，凝神不清实体护腕。新护腕是明确G实物，不改旧古代炼金师护腕。R实际恢复本人健康，不清原伤或累计风险，不改65/30/5伤势盘或抵挡死亡。每轮60秒、活着结局沿普通出口走4米4秒，死者留院，死敌原棍留院。抬棺人3名称编号有原核，新增有限保全及数值均G；完整配方仪式未知，无复活、造魂、死人操纵或棺材免死，旧奥斯里克和六个旧职业原状态不变。`,
    enemyCountWheel: COFFIN_BEARER_ENEMY_COUNT_WHEEL, enemyAbilityWheel: COFFIN_BEARER_ENEMY_ABILITY_WHEEL };
}
export function validateCoffinBearerRoundOutcome(v: unknown): v is CoffinBearerRoundOutcome { try { return validateOutcome(v); } catch { return false; } }
function validInjuries(v: unknown, revision = Number.MAX_SAFE_INTEGER): v is SliceInjury[] {
  return Array.isArray(v) && new Set(v.map(i => i?.id)).size === v.length && v.every(i => i && Object.keys(i).length === 4 && typeof i.id === 'string' && i.id.length > 0 &&
    ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision, 0, revision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision, revision)));
}
const sourceKeys = 'runId revision week round lifeClockSeconds encounterId targetId attemptWeek startHistoryIndex playerHealth playerMind playerSpirituality enemyHealth enemyMind enemySpirituality knowledge coreStats playerInjuries playerRisk clubLocation actualOriginalBody mutuallyVisible distanceMetres noBystanders ordinaryExit pursuit targetAlive independentMind targetSequence targetAge targetPhysique enemyWeapon weaponOwner weaponLocation scene enemyInjuries enemyRisk carefulMastery healingMastery lifeSupportMastery specimenMastery groundMastery matrixMastery powerUses guardAttempts preservationAttempts guard'.split(' ').sort();
const outcomeKeys = 'targetId round source stance continuing enemyHealth enemyMind enemySpirituality enemyStatus enemyInjuriesAfter enemyRiskAfter playerSpiritualityBefore playerSpiritualityAfter playerHealthBeforeConsequence playerHealthAfter playerMindAfter playerInjuriesAfter playerRiskAfter enemySpiritualityBefore powerUses guardAttempts preservationAttempts guardMode guardCharges guardAfter playerActions enemyActions elapsedSeconds lifeClockSecondsBefore lifeClockSecondsAfter exitSeconds sceneAfter weaponLocation'.split(' ').sort();
function validateOutcome(v: unknown): v is CoffinBearerRoundOutcome {
  if (!v || typeof v !== 'object' || Array.isArray(v) || !same(Object.keys(v).sort(), outcomeKeys)) return false;
  const p = v as CoffinBearerRoundOutcome, a = p.source;
  const usesValid = (u: Record<CoffinBearerPowerId, number>) => !!u && typeof u === 'object' && Object.keys(u).length === 3 && COFFIN_BEARER_POWER_IDS.every(id => integer(u[id], 0, 30));
  if (!a || !same(Object.keys(a).sort(), sourceKeys) || a.targetId !== COFFIN_BEARER_TARGET_ID || a.encounterId !== 'COFFIN_BEARER_DISPUTE' || a.round !== p.round || typeof a.runId !== 'string' || !a.runId ||
      !integer(a.revision) || !integer(a.week, 1) || a.attemptWeek !== a.week || !integer(a.startHistoryIndex) || !integer(a.lifeClockSeconds) ||
      !integer(a.playerHealth, 1, 100) || !integer(a.playerMind, 1, 100) || !integer(a.enemyHealth, 1, 100) || !integer(a.enemyMind, 1, 100) || !integer(a.knowledge, 0, 500) ||
      !a.coreStats || Object.keys(a.coreStats).length !== 4 || !['physique', 'perception', 'will', 'knowledge'].every(k => integer(a.coreStats[k as keyof typeof a.coreStats], 0, 500)) || a.knowledge !== a.coreStats.knowledge ||
      !validInjuries(a.playerInjuries, a.revision) || !integer(a.playerRisk) || !resource(a.playerSpirituality) || !validInjuries(a.enemyInjuries, a.revision) || a.enemyInjuries.some(i => i.treatedRevision !== null) || !integer(a.enemyRisk) ||
      !['SHOP', 'BAG', 'HAND'].includes(a.clubLocation) || a.actualOriginalBody !== true || a.mutuallyVisible !== true || a.distanceMetres !== 2 || a.noBystanders !== true ||
      a.ordinaryExit !== true || a.pursuit !== false || a.targetAlive !== true || a.independentMind !== true || a.targetSequence !== 4 || a.targetAge !== 42 || a.targetPhysique !== 22 ||
      a.enemyWeapon !== 'CB3-NOLAN-ROD' || a.weaponOwner !== COFFIN_BEARER_TARGET_ID || a.weaponLocation !== 'HAND' ||
      !validCoffinBearerCombatScene(a.scene) || a.scene.playerPosition !== 'COURT' || !a.scene.clearanceConfirmed ||
      ![a.carefulMastery, a.healingMastery, a.lifeSupportMastery, a.specimenMastery, a.groundMastery, a.matrixMastery].every(n => resource(n, 500)) || !usesValid(a.powerUses) ||
      !integer(a.guardAttempts, 0, 3) || !integer(a.preservationAttempts, 0, 3) || !validCoffinBearerCombatGuard(a.guard) || (a.guard.preparedWeek !== null && a.guard.preparedWeek > a.week) ||
      a.guard.segments.filter(x => x.status === 'SPENT').length !== a.guardAttempts + a.preservationAttempts) return false;
  if (p.targetId !== COFFIN_BEARER_TARGET_ID || !integer(p.round, 1) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(p.stance) ||
      !integer(p.enemyHealth, 0, a.enemyHealth) || p.enemyMind !== a.enemyMind || !integer(p.enemySpirituality, 0, 120) || !integer(p.enemySpiritualityBefore, p.enemySpirituality, 120) || p.enemySpiritualityBefore !== a.enemySpirituality ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(p.enemyStatus) || (p.enemyStatus === 'DEAD') !== (p.enemyHealth === 0) ||
      !resource(p.playerSpiritualityBefore) || p.playerSpiritualityBefore !== a.playerSpirituality || !resource(p.playerSpiritualityAfter) || p.playerSpiritualityAfter > p.playerSpiritualityBefore ||
      !integer(p.playerHealthBeforeConsequence, a.playerHealth, 100) || !integer(p.playerHealthAfter, 0, p.playerHealthBeforeConsequence) || p.playerMindAfter !== a.playerMind || !usesValid(p.powerUses) ||
      p.enemySpiritualityBefore !== 120 - COFFIN_BEARER_POWERS.reduce((n, x) => n + a.powerUses[x.id] * x.cost, 0) ||
      p.enemySpirituality !== 120 - COFFIN_BEARER_POWERS.reduce((n, x) => n + p.powerUses[x.id] * x.cost, 0) ||
      p.guardMode !== null || p.guardCharges !== 0 || !validCoffinBearerCombatGuard(p.guardAfter) || typeof p.continuing !== 'boolean' ||
      (p.continuing && (p.enemyStatus !== 'RESISTING' || p.playerHealthAfter <= 0)) ||
      !validInjuries(p.enemyInjuriesAfter, a.revision + 1) || p.enemyInjuriesAfter.some(i => i.treatedRevision !== null) || !integer(p.enemyRiskAfter, a.enemyRisk, a.enemyRisk + 1) ||
      !validInjuries(p.playerInjuriesAfter, a.revision + 1) || !integer(p.playerRiskAfter, a.playerRisk, a.playerRisk + 1) ||
      !same(p.enemyInjuriesAfter.slice(0, a.enemyInjuries.length), a.enemyInjuries) || p.enemyInjuriesAfter.length > a.enemyInjuries.length + 1 ||
      !same(p.playerInjuriesAfter.slice(0, a.playerInjuries.length), a.playerInjuries) || p.playerInjuriesAfter.length > a.playerInjuries.length + 1 ||
      !Array.isArray(p.playerActions) || p.playerActions.length > 6 || !Array.isArray(p.enemyActions) || p.enemyActions.length > 6 || (p.stance === 'RETREAT' && p.playerActions.length !== 0) ||
      p.elapsedSeconds !== 60 || p.lifeClockSecondsBefore !== a.lifeClockSeconds || p.exitSeconds !== (!p.continuing && p.playerHealthAfter > 0 ? 4 : 0) ||
      p.lifeClockSecondsAfter !== a.lifeClockSeconds + 60 + p.exitSeconds || !validCoffinBearerCombatScene(p.sceneAfter) ||
      !same(p.sceneAfter, { ...a.scene, playerPosition: p.exitSeconds ? 'EXIT' : 'COURT', ordinaryWalkedMetres: p.exitSeconds }) || p.weaponLocation !== (p.enemyStatus === 'DEAD' ? 'COURT' : 'HAND')) return false;
  const ordered = [...p.playerActions.map(action => ({ actor: 'PLAYER' as const, action })), ...p.enemyActions.map(action => ({ actor: 'ENEMY' as const, action }))];
  if (ordered.some(x => !x.action || !integer(x.action.order, 0, 11))) return false;
  ordered.sort((x, y) => x.action.order - y.action.order);
  const m = initialModel(a, p.playerSpiritualityBefore, p.enemySpiritualityBefore);
  for (const [index, entry] of ordered.entries()) {
    const x = entry.action;
    if (x.order !== index || !resource(x.physicalFactor, 1) || !Array.isArray(x.rolls) || x.rolls.some(n => !integer(n, 1, 100))) return false;
    let cursor = 0;
    const random: ActionRandomStream = { seed: 'recorded-coffin-bearer-action', get cursor() { return cursor; }, nextInt(min, max) {
      const n = x.rolls[cursor++]; if (n === undefined || n < min || n > max) throw new Error('缺少原实际动作判定'); return n;
    } };
    if (entry.actor === 'PLAYER' ? !ABILITIES.some(move => move.id === entry.action.id) : ![...COFFIN_BEARER_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(entry.action.planned)) return false;
    const expected = entry.actor === 'PLAYER' ? playerAction(a, m, entry.action.id, x.physicalFactor, index, random) : enemyAction(a, m, entry.action.planned, x.physicalFactor, index);
    if (cursor !== x.rolls.length || !same(expected, x)) return false;
  }
  return m.playerSpirituality === p.playerSpiritualityAfter && m.playerHealth === p.playerHealthBeforeConsequence && m.enemySpirituality === p.enemySpirituality && same(m.powerUses, p.powerUses) &&
    m.guardAttempts === p.guardAttempts && m.preservationAttempts === p.preservationAttempts && same(m.guard, p.guardAfter);
}
