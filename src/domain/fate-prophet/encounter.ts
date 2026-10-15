import { SLICE_LIFE } from '../../content/slice-events.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { addGameWeeks, compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceCombatRound, SliceInjury, SliceState } from '../slice/types.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import type { FateProphetAcquisitionBudget } from './types.js';
import { fateProphetLifeClosed, replayFateProphetLifeRoot, type FateProphetSceneRoot } from './life.js';
import { currentFateProphetCombatSource, nextFateProphetCombatSource, validFateProphetBody, validFateProphetCombatSource, validFateProphetInjuries, validFateProphetLuck,
  validateFateProphetCombatRound, validateFateProphetRoundOutcome, type FateProphetCombatSource, type FateProphetRoundOutcome } from './combat.js';

export const FATE_PROPHET_TARGET_ID = 'FP2-ROWAN' as const;
export const FATE_PROPHET_POWER_IDS = ['ARC_BOLT', 'WARD', 'COMPOSE'] as const;
export type FateProphetPowerId = typeof FATE_PROPHET_POWER_IDS[number];
export type FateProphetEnemyIntent = FateProphetPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export type FateProphetPendingKind = 'FORESIGHT' | 'HAZARD_ADJUSTMENT' | 'DEVIATION_BUFFER' | 'FUTURE_IMPEDIMENT';
export const FATE_PROPHET_POWERS = [
  { id: 'ARC_BOLT', label: '本人有限弧光', cost: 5, selfGain: 70, enemyReduction: 0 },
  { id: 'WARD', label: '本人有限屏护', cost: 4, selfGain: 0, enemyReduction: 30 },
  { id: 'COMPOSE', label: '独立凝神抵抗', cost: 4, selfGain: 8, enemyReduction: 0 },
] as const;
export interface FateProphetCombatBody {
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  weaponLocation: 'HAND' | 'COURT'; powerUses: Record<FateProphetPowerId, number>; pendingKind: FateProphetPendingKind | null; composureReady: boolean;
  lastLuckRound: number | null; luckAttempts: number; foresightAttempts: number; hazardAttempts: number; deviationAttempts: number; impedimentAttempts: number;
}
function initialBody(): FateProphetCombatBody {
  return { enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0, weaponLocation: 'HAND', powerUses: { ARC_BOLT: 0, WARD: 0, COMPOSE: 0 },
    pendingKind: null, composureReady: false, lastLuckRound: null, luckAttempts: 0, foresightAttempts: 0, hazardAttempts: 0, deviationAttempts: 0, impedimentAttempts: 0 };
}
export function combatBody(e: FateProphetCombatBody): FateProphetCombatBody {
  return Object.fromEntries(Object.keys(initialBody()).map(k => [k, structuredClone(e[k as keyof FateProphetCombatBody])])) as unknown as FateProphetCombatBody;
}
export type FateProphetFinanceSnapshot = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface FateProphetPreparation {
  week: number; date: PublicGameDate; revision: number; runId: string; randomSeed: string; randomCursor: number; mindPaid: 2;
  lifeJournalLength: number; lifeClockSeconds: number; before: FateProphetAcquisitionBudget; after: FateProphetAcquisitionBudget; finance: FateProphetFinanceSnapshot;
}
export interface FateProphetClearance {
  week: number; veraId: 'CW3-VERA'; veraConsent: 'GRANTED'; veraFrom: 'A'; veraTo: 'OUTSIDE'; veraMetres: 8; veraSeconds: 8; veraRoute: ['A', 'START', 'OUTSIDE'];
  guideId: 'GUIDE'; guideConsent: 'GRANTED'; guideFrom: 'START'; guideTo: 'OUTSIDE'; guideMetres: 4; guideSeconds: 4; guideRoute: ['START', 'OUTSIDE'];
  pouchId: 'CW3-POUCH'; playerMetres: 4; playerSeconds: 4; elapsedSeconds: 16;
}
export interface FateProphetEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: FateProphetCombatBody['enemyStatus']; exitMetres: 0 | 4; exitSeconds: 0 | 4;
}
export interface FateProphetEncounterState extends FateProphetCombatBody {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof FATE_PROPHET_TARGET_ID;
  preparation: FateProphetPreparation | null; approachWeek: number | null; approachRevision: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  startRoot: FateProphetSceneRoot | null; startSource: FateProphetCombatSource | null; originalEncounter: SliceState['chaosWalker']['encounter'] | null;
  originalFerris: SliceState['misfortuneMage']['encounter'] | null; originalHistory: SliceCombatRound[] | null; clearance: FateProphetClearance | null;
  yardId: 'CW3-MECHANICAL-WORKSHOP'; ordinaryExit: 'OPEN'; enemyPosition: 'BETWEEN_A_AND_B'; enemyDistanceMetres: 2; terminal: FateProphetEncounterTerminal | null;
}
export type FateProphetEncounterCommand = { type: 'PREPARE_ENCOUNTER' | 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface FateProphetEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: FateProphetEncounterCommand }
export interface FateProphetEncounterProjection {
  title: string; story: string; status: FateProphetEncounterState['status']; inside: boolean; preparation: null | { week: number; mindPaid: 2 };
  scene: null | { courtId: 'CW3-MECHANICAL-WORKSHOP'; playerLocation: string; veraLocation: string; guideLocation: string; ordinaryExit: 'OPEN'; distanceMetres: number; clockSeconds: number; playerTravelMetres: number };
  enemy: null | { id: typeof FATE_PROPHET_TARGET_ID; name: '洛温·米勒'; age: 42; pathway: 'original-caster'; sequence: 3; health: number; mind: number; spirituality: number; status: FateProphetCombatBody['enemyStatus'];
    weaponId: 'FP2-ROWAN-ROD'; weaponLocation: 'HAND' | 'COURT'; powerUses: Record<FateProphetPowerId, number>; abilities: string[] };
  pendingKind: FateProphetPendingKind | null; composureReady: boolean; luck: SliceState['winner']['luck'] & { capacity: 3 }; actions: FateProphetEncounterAction[]; facts: string[];
}
export const FATE_PROPHET_ENCOUNTER_STORY = '42岁的序列3施术者洛温·米勒在原工坊提出通行争议。他有自己的唯一原身体、独立心智和原杖，健康100、精神100、灵性120，拥有有限弧光、屏护与凝神。先询问薇拉与原导师此次离场意愿，让两人亲自沿原路离开，再到2米外交谈。普通4米出口始终开放，可和平离开；无追逐，不授予旁人自动免疫。';
export function createFateProphetEncounterState(): FateProphetEncounterState {
  return { ...initialBody(), status: 'AVAILABLE', targetId: FATE_PROPHET_TARGET_ID, preparation: null, approachWeek: null, approachRevision: null, attemptWeek: null, startHistoryIndex: null,
    startRoot: null, startSource: null, originalEncounter: null, originalFerris: null, originalHistory: null, clearance: null,
    yardId: 'CW3-MECHANICAL-WORKSHOP', ordinaryExit: 'OPEN', enemyPosition: 'BETWEEN_A_AND_B', enemyDistanceMetres: 2, terminal: null };
}
export const createFateProphetEncounter = createFateProphetEncounterState;
const stage = (s: SliceState) => s.progression.pathwayId === 'wheel' && s.progression.sequence === 2;
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
function financeSnapshot(s: FateProphetFinanceSnapshot): FateProphetFinanceSnapshot {
  return { weeklyBudget: s.weeklyBudget, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: structuredClone(s.debts), missedWeeks: s.missedWeeks, credit: s.credit };
}
function validFinance(v: FateProphetFinanceSnapshot, week: number): boolean {
  return shape(v, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit']) && integer(v.weeklyBudget, 1, 100) &&
    Object.hasOwn(SLICE_LIFE, v.lifeTier) && Object.hasOwn(SLICE_LIFE, v.nextLifeTier) && integer(v.missedWeeks) && ['NORMAL', 'NOTICE', 'SUSPENDED'].includes(v.credit) &&
    Array.isArray(v.debts) && v.debts.every(d => shape(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek']) && typeof d.id === 'string' && d.id.length > 0 && d.id.length <= 500 &&
      typeof d.source === 'string' && d.source.length > 0 && d.source.length <= 500 && integer(d.remaining) && integer(d.weeklyPayment, 1) && integer(d.createdWeek, 0, week));
}
export function fateProphetEncounterBudget(s: SliceState): FateProphetAcquisitionBudget {
  return { cash: s.cash, actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution, sequence: s.progression.sequence as 2, acting: s.progression.acting,
    coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources], injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk, luck: { ...s.winner.luck } };
}
function validBudget(v: FateProphetAcquisitionBudget, week: number, revision: number): boolean {
  return shape(v, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk', 'luck']) &&
    integer(v.cash) && integer(v.actions, 0, 100) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.pollution, 0, 100) && v.sequence === 2 && integer(v.acting, 0, 100) &&
    shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) && Object.values(v.coreStats).every(n => integer(n, 0, 500)) && !!v.mastery && typeof v.mastery === 'object' && !Array.isArray(v.mastery) && Object.values(v.mastery).every(n => integer(n, 0, 500)) &&
    Array.isArray(v.completedSources) && v.completedSources.every(x => typeof x === 'string' && !!x) && new Set(v.completedSources).size === v.completedSources.length && integer(v.injuryRisk) && validFateProphetInjuries(v.injuries, revision) && validFateProphetLuck(v.luck, week);
}
export function validateFateProphetPreparation(v: unknown): v is FateProphetPreparation {
  try { const p = v as FateProphetPreparation;
    return shape(p, ['week', 'date', 'revision', 'runId', 'randomSeed', 'randomCursor', 'mindPaid', 'lifeJournalLength', 'lifeClockSeconds', 'before', 'after', 'finance']) && integer(p.week, 1) &&
      isValidGameDate(p.date) && p.week === Math.floor(gameDaysBetween(ORIGIN, p.date) / 7) + 1 && integer(p.revision, 1) && typeof p.runId === 'string' && !!p.runId && typeof p.randomSeed === 'string' && !!p.randomSeed && integer(p.randomCursor) &&
      p.mindPaid === 2 && integer(p.lifeJournalLength, 1) && integer(p.lifeClockSeconds) && validBudget(p.before, p.week, p.revision) && validBudget(p.after, p.week, p.revision) && validFinance(p.finance, p.week) &&
      p.after.actions <= p.finance.weeklyBudget && p.before.mind > 2 && same(p.after, { ...p.before, mind: p.before.mind - 2 });
  } catch { return false; }
}
export function validateFateProphetEncounterCommand(v: unknown): v is FateProphetEncounterCommand { return shape(v, ['type']) && ['PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type)); }
export const isFateProphetEncounterCommand = validateFateProphetEncounterCommand;
export const hasFateProphetEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.fateProphet.encounter.status) || s.fateProphet.encounter.status === 'AVAILABLE' && s.fateProphet.encounter.preparation !== null;
export const isInsideFateProphetEncounter = hasFateProphetEncounterLock;
function closedRoot(p: FateProphetSceneRoot): boolean {
  return p.siteId === 'CW3-MECHANICAL-WORKSHOP' && p.introducedWeek !== null && p.playerLocation === 'START' && p.volunteer.id === 'CW3-VERA' && p.volunteer.age === 39 && p.volunteer.alive && p.volunteer.location === 'A' && p.guide.id === 'GUIDE' && p.guide.location === 'START' &&
    p.cart.id === 'CW3-CART' && p.cart.location === 'A' && p.cart.control === 'GUIDE' && p.parcel.id === 'CW3-PARCEL' && p.parcel.location === 'CW3-CART' && p.disc.id === 'CW3-DISC' && p.disc.control === 'GUIDE' && p.pouch.id === 'CW3-POUCH' && p.pouch.location === 'VERA' && p.tags.every(t => t.location === 'POUCH') &&
    p.activeCase === null && Object.values(p.cases).every(c => c.status === 'RESOLVED' && !c.contactOpen);
}
function lifeReady(s: SliceState): boolean {
  const shadow = { ...s, chaosWalker: { ...s.chaosWalker, life: s.fateProphet.encounter.startRoot ?? s.chaosWalker.life } };
  return s.fateProphet.preparedWeek === null && s.fateProphet.life.reflected && fateProphetLifeClosed(shadow);
}
const clearance = (week: number): FateProphetClearance => ({ week, veraId: 'CW3-VERA', veraConsent: 'GRANTED', veraFrom: 'A', veraTo: 'OUTSIDE', veraMetres: 8, veraSeconds: 8,
  veraRoute: ['A', 'START', 'OUTSIDE'], guideId: 'GUIDE', guideConsent: 'GRANTED', guideFrom: 'START', guideTo: 'OUTSIDE', guideMetres: 4, guideSeconds: 4, guideRoute: ['START', 'OUTSIDE'], pouchId: 'CW3-POUCH', playerMetres: 4, playerSeconds: 4, elapsedSeconds: 16 });
export function fateProphetApproachedRoot(start: FateProphetSceneRoot, week: number): FateProphetSceneRoot {
  if (!closedRoot(start) || !integer(week, start.introducedWeek!)) throw new Error('须归还同一原物，核对原人位置后询问此次离场意愿。');
  const p = structuredClone(start); p.volunteer.location = 'OUTSIDE'; p.clockSeconds += 8; p.guide.location = 'OUTSIDE'; p.guideTravelMetres += 4; p.clockSeconds += 4;
  p.playerLocation = 'A'; p.playerTravelMetres += 4; p.clockSeconds += 4; return p;
}
export function leaveFateProphetCombatRoot(p: FateProphetSceneRoot): void {
  if (p.playerLocation !== 'A' || p.volunteer.location !== 'OUTSIDE' || p.guide.location !== 'OUTSIDE') throw new Error('真实原位置不支持普通退出。'); p.playerLocation = 'START'; p.playerTravelMetres += 4; p.clockSeconds += 4;
}
function oldHistoryUnchanged(s: SliceState): boolean {
  const e = s.fateProphet.encounter; return same(e.originalEncounter, s.chaosWalker.encounter) && same(e.originalFerris, s.misfortuneMage.encounter) &&
    Array.isArray(e.originalHistory) && same(e.originalHistory, s.combatHistory.slice(0, e.originalHistory.length)) && e.originalEncounter?.enemyStatus === 'DEAD' && e.originalFerris?.enemyStatus === 'SURRENDERED';
}
function actualCourt(s: SliceState): boolean {
  const e = s.fateProphet.encounter, p = s.chaosWalker.life;
  return e.yardId === 'CW3-MECHANICAL-WORKSHOP' && e.ordinaryExit === 'OPEN' && e.enemyPosition === 'BETWEEN_A_AND_B' && e.enemyDistanceMetres === 2 && e.startRoot !== null && closedRoot(e.startRoot) && e.preparation !== null &&
    e.approachWeek === s.week && same(e.clearance, clearance(s.week)) && p.siteId === 'CW3-MECHANICAL-WORKSHOP' && p.playerLocation === 'A' && p.volunteer.id === 'CW3-VERA' && p.volunteer.age === 39 && p.volunteer.location === 'OUTSIDE' && p.volunteer.alive &&
    p.guide.id === 'GUIDE' && p.guide.location === 'OUTSIDE' && oldHistoryUnchanged(s);
}
export function blockFateProphetEncounter(s: SliceState, c: FateProphetEncounterCommand): string | null {
  if (!validateFateProphetEncounterCommand(c)) return '遭遇命令无效。'; const e = s.fateProphet.encounter;
  if (!stage(s) || s.status !== 'ACTIVE' || s.health <= 0 || s.fateProphet.promotionWeek === null || !s.fateProphet.guidanceKnown) return '须本人仍活着且完成先知晋升。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件、战斗或周账。'; if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德原工坊。';
  if (!lifeReady(s)) return '先完成三份真实报告、收好原现场并反思。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' && actualCourt(s) || e.status === 'AVAILABLE' && e.preparation !== null && closedRoot(s.chaosWalker.life) ? null : '须有本次准备或真实到场，才能普通离开。';
  if (s.mind <= 0) return '先恢复精神；已准备后仍可普通退出。';
  if (c.type === 'PREPARE_ENCOUNTER') {
    if (e.status !== 'AVAILABLE' || e.preparation) return '已有本次准备或原人结局，不重复生成或重置。'; const end = replayFateProphetLifeRoot(s);
    if (!end || !same(end, s.chaosWalker.life) || !closedRoot(end) || s.chaosWalker.encounter.enemyStatus !== 'DEAD' || s.misfortuneMage.encounter.enemyStatus !== 'SURRENDERED') return '须保留原工坊及旧加雷斯死亡、旧费里斯投降的真实历史。';
    return s.mind <= 2 ? '整理注意力需2精神并保持清醒。' : null;
  }
  if (s.actionsRemaining < 1) return '实际选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' || !e.preparation || !closedRoot(s.chaosWalker.life) ? '先准备并收好原物。' : s.actionsRemaining < 2 ? '交谈需1行动，另留1行动决定交战。' : null;
  return e.status === 'READY' && actualCourt(s) ? null : '须先询问此次离场意愿，让原薇拉与导师实际走到室外后交谈。';
}
export const fateProphetEncounterReason = blockFateProphetEncounter;
export function applyFateProphetEncounterCommand(s: SliceState, c: FateProphetEncounterCommand, ctx: SeerContext): void {
  const reason = blockFateProphetEncounter(s, c); if (reason) throw new Error(reason); const e = s.fateProphet.encounter;
  if (c.type === 'PREPARE_ENCOUNTER') {
    const before = fateProphetEncounterBudget(s); s.mind -= 2; e.preparation = { week: s.week, date: { ...s.date }, revision: s.revision + 1, runId: s.runId, randomSeed: s.random.seed, randomCursor: s.random.cursor, mindPaid: 2,
      lifeJournalLength: s.fateProphet.life.journal.length, lifeClockSeconds: s.chaosWalker.life.clockSeconds, before, after: fateProphetEncounterBudget(s), finance: financeSnapshot(s) };
    e.originalEncounter = structuredClone(s.chaosWalker.encounter); e.originalFerris = structuredClone(s.misfortuneMage.encounter); e.originalHistory = structuredClone(s.combatHistory);
    ctx.note('核对原现场与普通出口', '实际付2精神，不补身体、精神、灵性或积运。原薇拉、原袋、原车、原包与导师保持原位置。'); return;
  }
  if (c.type === 'LEAVE_ENCOUNTER') {
    if (e.status === 'READY') leaveFateProphetCombatRoot(s.chaosWalker.life); e.status = 'RESOLVED'; ctx.note('普通退出本次争议', e.startRoot ? '本人实际走4米、花4秒回原入口；原两人仍在室外，洛温及唯一原杖留工坊。' : '本人原本就在入口，停止此次准备；已付2精神不退，没有凭空移动人物。'); return;
  }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') {
    e.startRoot = structuredClone(s.chaosWalker.life); e.clearance = clearance(s.week); s.chaosWalker.life = fateProphetApproachedRoot(e.startRoot, s.week);
    e.status = 'READY'; e.approachWeek = s.week; e.approachRevision = s.revision + 1;
    ctx.note('两位原人同意后亲自离场', '薇拉明确同意这次离场，带自己的原袋与原签，从A经入口走8米8秒到室外；导师明确同意，从入口走4米4秒到室外；本人再走4米4秒到A，与2米外洛温交谈。'); return;
  }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'FATE_PROPHET_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  const source = currentFateProphetCombatSource(s); if (!source) throw new Error('原人、原杖和真实原资源来源不完整。'); e.startSource = { ...source, revision: s.revision + 1 };
  ctx.note('原洛温的有限真实冲突', '实际付1行动，双方保留自己的原身体、独立心智和原物。默认保留原积运；先兆与风险调整只处理尚未发生的一次实际攻击，不预读未来票。');
}
export const applyFateProphetEncounter = applyFateProphetEncounterCommand;
export const handleFateProphetEncounter = applyFateProphetEncounterCommand;
export function startFateProphetEncounter(s: SliceState, ctx: SeerContext): void { applyFateProphetEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasFateProphetDisputeOpponent(s: SliceState): boolean {
  const e = s.fateProphet?.encounter, c = s.combat;
  return stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && lifeReady(s) && s.fateProphet.guidanceKnown && s.fateProphet.promotionWeek !== null &&
    !!e && e.status === 'FIGHTING' && e.targetId === FATE_PROPHET_TARGET_ID && e.terminal === null && actualCourt(s) && e.attemptWeek === s.week && validFateProphetBody(e, (c?.round ?? 1) - 1) &&
    c?.encounterId === 'FATE_PROPHET_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && e.enemyStatus === 'RESISTING' && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind &&
    same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk && integer(c.round, 1) && e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
function terminalRoot(o: FateProphetRoundOutcome): { root: FateProphetSceneRoot; exit: 0 | 4 } {
  const root = structuredClone(o.rootAfter), exit = o.playerHealthAfter > 0 ? 4 : 0; if (exit) leaveFateProphetCombatRoot(root); return { root, exit };
}
export function settleFateProphetEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.fateProphet.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'FATE_PROPHET_DISPUTE') throw new Error('没有这场原工坊冲突。'); if (outcome === 'CONTINUE') return;
  const last = c.lastRound, o = last?.fateProphetOutcome;
  if (!last || !o || !validateFateProphetRoundOutcome(o) || !validateFateProphetCombatRound(last) || o.continuing || e.terminal || e.startHistoryIndex === null || c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round ||
    !same(s.combatHistory.at(-1), last) || !same(combatBody(e), combatBody(o)) || !same(o.rootAfter, s.chaosWalker.life) || o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality || !same(o.luckAfter, s.winner.luck) ||
    !same(o.playerInjuriesAfter, s.injuries) || o.playerRiskAfter !== s.injuryRisk || o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || !same(o.enemyInjuries, c.enemyInjuries) || o.enemyRisk !== c.enemyRisk || o.enemyStatus !== c.enemyStatus ||
    outcome !== (o.playerHealthAfter === 0 ? 'PLAYER_DEAD' : o.enemyHealth === 0 ? 'ENEMY_DEAD' : o.enemyStatus === 'SURRENDERED' ? 'ENEMY_SURRENDERED' : 'RETREATED')) throw new Error('结局与真实回合、原身体、原物及已花资源不一致。');
  const final = terminalRoot(o); s.chaosWalker.life = final.root;
  e.terminal = { outcome: outcome as FateProphetEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, exitMetres: final.exit, exitSeconds: final.exit };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('原洛温冲突结束', `${final.exit ? '本人活着沿原路走4米4秒回入口。' : '本人的原身体真实死亡并留在A，不复活或搬移。'}原薇拉与导师仍在室外，洛温原杖保留最后实际位置；原伤与已花费用不退。`);
}
export const finishFateProphetEncounter = settleFateProphetEncounter;
export function fateProphetEncounterActions(s: SliceState): FateProphetEncounterAction[] {
  if (!stage(s)) return [];
  return ([['PREPARE_ENCOUNTER', '核对注意力与普通出口', '2精神；0行动'], ['ENCOUNTER_TALK', '请两位原人离场后交谈', '1行动；实际16秒'], ['ENCOUNTER_FIGHT', '选择与洛温交战', '1行动；真实伤势与死亡风险'], ['LEAVE_ENCOUNTER', '普通退出本次争议', '0行动；到场后4米4秒']] as const).map(([type, label, cost]) => {
    const command: FateProphetEncounterCommand = { type }, reason = blockFateProphetEncounter(s, command); return { id: `fateProphet-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectFateProphetEncounter(s: SliceState): FateProphetEncounterProjection {
  const e = s.fateProphet.encounter, p = s.chaosWalker.life, luck = { ...s.winner.luck, capacity: 3 as const };
  if (!stage(s)) return { title: '尚未开放的工坊争议', story: '', status: e.status, inside: false, preparation: null, scene: null, enemy: null, pendingKind: null, composureReady: false, luck, actions: [], facts: [] };
  return { title: '洛温的原工坊通行争议', story: FATE_PROPHET_ENCOUNTER_STORY, status: e.status, inside: hasFateProphetEncounterLock(s), preparation: e.preparation ? { week: e.preparation.week, mindPaid: 2 } : null,
    scene: { courtId: 'CW3-MECHANICAL-WORKSHOP', playerLocation: p.playerLocation, veraLocation: p.volunteer.location, guideLocation: p.guide.location, ordinaryExit: 'OPEN', distanceMetres: p.playerLocation === 'START' ? 6 : 2, clockSeconds: p.clockSeconds, playerTravelMetres: p.playerTravelMetres },
    enemy: { id: e.targetId, name: '洛温·米勒', age: 42, pathway: 'original-caster', sequence: 3, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus, weaponId: 'FP2-ROWAN-ROD', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses }, abilities: FATE_PROPHET_POWERS.map(x => x.label) },
    pendingKind: e.pendingKind, composureReady: e.composureReady, luck, actions: fateProphetEncounterActions(s), facts: [
      '薇拉与原导师分别同意这次离场后，亲自沿原路走到室外；没有自动友军免疫。',
      '新先兆只削减后来下一次实际攻击贡献30%；风险调整须明确选用唯一原积运1份及5灵性1精神，只削减下一次实际身体打击或法术冲击贡献50%。',
      '两项知识20检定都可能失败。只有一个待用窗口；不叠加、不重抽、不预读未来随机票。未用、失败与凝神取消均不退款。',
      '选择保留幸运时不花积运。新旧能力共用每轮1份积运上限；不足条件只执行实际记录的旧能力或普通行动，没有免费双重施术。',
      '真实身体与精神来源分别结算，死者不能普通离场；旧费里斯投降、旧加雷斯死亡和全部旧原物、原伤、原记录保持原样。' ] };
}
/** Reconcile the shared financial pulse from its original frozen input, including
 * interrupted bills and debt notices. Combat resources never receive exemptions. */
function immediateTerminalBudgetMatches(s: SliceState, prep: FateProphetPreparation, o: FateProphetRoundOutcome): boolean {
  if (s.health !== o.playerHealthAfter || s.mind !== o.playerMindAfter || s.spirituality !== o.playerSpiritualityAfter || !same(s.winner.luck, o.luckAfter) ||
    !same(s.injuries, o.playerInjuriesAfter) || s.injuryRisk !== o.playerRiskAfter || s.random.cursor !== o.randomCursorAfter) return false;
  const financialTitles = ['本周生活费', '生活费如实记账', '本周约定还款', '账目结清', '新的一周'];
  const receipts = s.chronicle.filter((entry, index) => entry.id === `record-${s.revision}-${index}` && financialTitles.includes(entry.title));
  const actions = prep.after.actions - 2;
  if (actions > 0 || o.playerHealthAfter === 0) return s.week === o.source.week && same(s.date, o.source.date) && s.actionsRemaining === actions &&
    s.cash === prep.after.cash && same(financeSnapshot(s), prep.finance) && s.pulse === 'NONE' && s.billAmount === 0 && s.activeEvent === null && s.eventQueue.length === 0 && receipts.length === 0;
  if (actions !== 0 || s.status !== 'ACTIVE') return false;
  const result = resolveSliceWeeklyFinance({ ...prep.finance, cash: prep.after.cash, week: prep.week, revision: o.source.revision, pulse: 'BILL', billAmount: 0 });
  const advanced = result.eventId === null && result.state.pulse === 'ADVANCE';
  const expected = { ...prep.finance, ...result.state, weeklyBudget: prep.finance.weeklyBudget,
    lifeTier: advanced ? result.state.nextLifeTier : prep.finance.lifeTier };
  if (s.cash !== result.state.cash || !same(financeSnapshot(s), financeSnapshot(expected)) || s.week !== prep.week + (advanced ? 1 : 0) ||
    !same(s.date, advanced ? addGameWeeks(prep.date, 1) : prep.date) || s.actionsRemaining !== (advanced ? prep.finance.weeklyBudget : 0) ||
    s.pulse !== (advanced ? 'NONE' : result.state.pulse) || s.billAmount !== (advanced ? 0 : result.state.billAmount)) return false;
  const expectedReceipts = result.receipts.map(receipt => ({ week: prep.week, ...receipt }));
  if (advanced) expectedReceipts.push({ week: prep.week + 1, title: '新的一周', text: `日期推进7天，本周${prep.finance.weeklyBudget}次行动。` });
  if (!same(receipts.map(({ week, title, text }) => ({ week, title, text })), expectedReceipts)) return false;
  if (result.eventId) {
    // Ordinary open() runs immediately after the terminal note and exact billing
    // receipts; later world scheduling only runs on the advance branch.
    const terminalIndex = s.chronicle.findIndex((entry, index) => entry.id === `record-${s.revision}-${index}` && entry.title === '原洛温冲突结束');
    const eventIndex = terminalIndex + 1 + result.receipts.length;
    return terminalIndex >= 0 && s.eventQueue.length === 0 && same(s.activeEvent, { id: result.eventId, instanceId: `${s.runId}:${result.eventId}:${s.revision}:${eventIndex}` });
  }
  return true;
}
/** Replays the exact seed, cursor, source, per-slot costs and original physical positions. */
export function replayFateProphetEncounterRoot(s: SliceState, lifeEnd: FateProphetSceneRoot): FateProphetSceneRoot | null {
  try {
    const e = s.fateProphet?.encounter, initial = createFateProphetEncounterState();
    if (!e || !shape(e, Object.keys(initial)) || e.targetId !== FATE_PROPHET_TARGET_ID || e.yardId !== initial.yardId || e.ordinaryExit !== 'OPEN' || e.enemyPosition !== initial.enemyPosition || e.enemyDistanceMetres !== 2 || !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status)) return null;
    const allNew = s.combatHistory.flatMap((r, i) => r.fateProphetOutcome ? [i] : []);
    if (!e.preparation) return same(e, initial) && allNew.length === 0 && s.combat?.encounterId !== 'FATE_PROPHET_DISPUTE' ? structuredClone(lifeEnd) : null;
    const prep = e.preparation;
    if (!stage(s) || !s.fateProphet.guidanceKnown || s.fateProphet.promotionWeek === null || !validateFateProphetPreparation(prep) || prep.runId !== s.runId || prep.randomSeed !== s.random.seed || prep.randomCursor > s.random.cursor ||
      !integer(prep.week, s.fateProphet.promotionWeek, s.week) || compareGameDates(prep.date, s.date) > 0 || !integer(prep.revision, 1, s.revision) || prep.lifeJournalLength !== s.fateProphet.life.journal.length || prep.lifeClockSeconds !== lifeEnd.clockSeconds || !lifeReady(s) || !closedRoot(lifeEnd) || !oldHistoryUnchanged(s) || !same(prep.before.luck, s.fateProphet.life.journal.at(-1)?.budget.luckAfter)) return null;
    if (hasFateProphetEncounterLock(s) && (!same(financeSnapshot(s), prep.finance) || s.pulse !== 'NONE' || s.billAmount !== 0 || s.activeEvent !== null || s.eventQueue.length !== 0)) return null;
    const lastLife = s.fateProphet.life.journal.at(-1);
    if (!lastLife || prep.revision <= lastLife.revision + 1 || prep.week < lastLife.week) return null;
    if (prep.revision === lastLife.revision + 2 && prep.week === lastLife.week) {
      const b = lastLife.budget;
      if (prep.before.actions !== b.actionsAfter || prep.before.health !== b.healthAfter || prep.before.mind !== b.mindAfter || prep.before.spirituality !== b.spiritualityAfter || prep.before.cash !== b.cashAfter ||
        !same(prep.date, lastLife.date) || prep.randomCursor !== (lastLife.randomAfter ?? lastLife.randomCursor)) return null;
    }
    const prepared = { ...initial, preparation: prep, originalEncounter: e.originalEncounter, originalFerris: e.originalFerris, originalHistory: e.originalHistory };
    if (e.startRoot === null) {
      if (!['AVAILABLE', 'RESOLVED'].includes(e.status) || !same({ ...e, status: 'AVAILABLE' }, prepared) || allNew.length || s.combat?.encounterId === 'FATE_PROPHET_DISPUTE') return null;
      if (e.status === 'AVAILABLE' && (s.week !== prep.week || !same(s.date, prep.date) || s.random.cursor !== prep.randomCursor || !same(fateProphetEncounterBudget(s), prep.after) || s.status !== 'ACTIVE')) return null;
      return structuredClone(lifeEnd);
    }
    if (e.approachWeek !== prep.week || e.approachRevision !== prep.revision + 1 || !integer(e.approachRevision, 1, s.revision) || !same(e.startRoot, lifeEnd) || !same(e.clearance, clearance(e.approachWeek))) return null;
    const approached = fateProphetApproachedRoot(lifeEnd, e.approachWeek), afterTalk = { ...prep.after, actions: prep.after.actions - 1 };
    const talking = { ...prepared, status: e.status, approachWeek: e.approachWeek, approachRevision: e.approachRevision, startRoot: e.startRoot, clearance: e.clearance };
    if (e.startHistoryIndex === null) {
      const ready = e.status === 'READY', peaceful = e.status === 'RESOLVED', root = structuredClone(approached); if (peaceful) leaveFateProphetCombatRoot(root);
      if (!(ready || peaceful) || !same(e, talking) || allNew.length || s.combat?.encounterId === 'FATE_PROPHET_DISPUTE') return null;
      if (ready && (s.week !== prep.week || !same(s.date, prep.date) || s.random.cursor !== prep.randomCursor || !same(fateProphetEncounterBudget(s), afterTalk) || s.status !== 'ACTIVE')) return null;
      return root;
    }
    const start = e.startSource;
    if (!integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.startHistoryIndex !== e.originalHistory!.length || e.attemptWeek !== e.approachWeek || !start || !validFateProphetCombatSource(start) || start.round !== 1 || !same(start.root, approached) || !same(start.preparation, prep) || start.runId !== s.runId || start.targetId !== e.targetId ||
      start.randomSeed !== s.random.seed || start.attemptWeek !== e.attemptWeek || start.startHistoryIndex !== e.startHistoryIndex || start.revision !== e.approachRevision + 1 || start.revision > s.revision || start.randomCursor !== prep.randomCursor || !same(start.body, initialBody())) return null;
    if (start.playerHealth !== prep.after.health || start.playerMind !== prep.after.mind || start.playerSpirituality !== prep.after.spirituality || !same(start.luck, prep.after.luck) || !same(start.playerInjuries, prep.after.injuries) || start.playerRisk !== prep.after.injuryRisk ||
      !same({ physique: start.physique, perception: start.perception, will: start.will, knowledge: start.knowledge }, prep.after.coreStats) || start.calculationMastery !== (prep.after.mastery['wheel.s8.calculation-control'] ?? 0) || start.awarenessMastery !== (prep.after.mastery['wheel.s6.disaster-awareness'] ?? 0) || start.stormMastery !== (prep.after.mastery['wheel.s6.mental-storm'] ?? 0) || start.passiveMastery !== (prep.after.mastery['wheel.s7.passive-luck'] ?? 0)) return null;
    const terminal = e.terminal;
    if (terminal && (!shape(terminal, ['outcome', 'round', 'historyIndex', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'exitMetres', 'exitSeconds']) || !integer(terminal.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1))) return null;
    const end = terminal ? terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    if (!same(allNew, rounds.map((_r, i) => e.startHistoryIndex! + i))) return null;
    let root = approached;
    for (const [i, round] of rounds.entries()) {
      const o = round.fateProphetOutcome, previous = rounds[i - 1]?.fateProphetOutcome;
      if (!o || !validateFateProphetCombatRound(round) || round.round !== i + 1 || o.source.revision >= s.revision || o.randomCursorAfter > s.random.cursor || !same(o.source, previous ? nextFateProphetCombatSource(previous) : start) || !same(o.source.root, root) || i < rounds.length - 1 && !o.continuing) return null;
      root = structuredClone(o.rootAfter);
    }
    const last = rounds.at(-1), o = last?.fateProphetOutcome;
    if (e.status === 'FIGHTING') {
      if (terminal !== null || !hasFateProphetDisputeOpponent(s) || !same(combatBody(e), o ? combatBody(o) : start.body)) return null;
      if (s.actionsRemaining !== prep.after.actions - 2 || s.cash !== prep.after.cash || !same(s.character.coreStats, prep.after.coreStats) || !same(s.progression.mastery, prep.after.mastery) || s.seer.pollution !== prep.after.pollution || s.progression.acting !== prep.after.acting || !same(s.seer.completedSources, prep.after.completedSources)) return null;
      return o ? o.continuing && same(last, s.combat!.lastRound) && same(currentFateProphetCombatSource(s), nextFateProphetCombatSource(o)) ? root : null : s.combat!.lastRound === null && same(currentFateProphetCombatSource(s), start) ? root : null;
    }
    if (s.combat?.encounterId === 'FATE_PROPHET_DISPUTE' || !terminal || !last || !o || o.continuing || terminal.round !== last.round || rounds.length !== terminal.round || !same(combatBody(e), combatBody(o)) || terminal.enemyHealth !== e.enemyHealth || terminal.enemyMind !== e.enemyMind || terminal.enemySpirituality !== e.enemySpirituality || terminal.enemyStatus !== e.enemyStatus) return null;
    const final = terminalRoot(o); if (terminal.exitMetres !== final.exit || terminal.exitSeconds !== final.exit) return null;
    if (s.revision === o.source.revision + 1 && !immediateTerminalBudgetMatches(s, prep, o)) return null;
    if (terminal.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 ? final.root : null;
    if (terminal.outcome === 'RETREATED') return e.status === 'RETREATED' && o.playerHealthAfter > 0 && (last.retreat === 'SUCCESS' || o.playerMindAfter === 0) ? final.root : null;
    return e.status === 'RESOLVED' && o.playerHealthAfter > 0 && (terminal.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : terminal.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED') ? final.root : null;
  } catch { return null; }
}
export function validateFateProphetEncounter(s: SliceState): boolean {
  try { const end = replayFateProphetLifeRoot(s); if (!end) return same(s.fateProphet.encounter, createFateProphetEncounterState()) && s.fateProphet.life.source === null && !s.combatHistory.some(r => r.fateProphetOutcome) && s.combat?.encounterId !== 'FATE_PROPHET_DISPUTE';
    const root = replayFateProphetEncounterRoot(s, end); return root !== null && same(root, s.chaosWalker.life);
  } catch { return false; }
}
export const validateFateProphetEncounterState = validateFateProphetEncounter;
