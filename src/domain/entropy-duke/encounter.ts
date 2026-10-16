import { SLICE_LIFE } from '../../content/slice-events.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { addGameWeeks, compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceCombatRound, SliceInjury, SliceState } from '../slice/types.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import type { EntropyDukeAcquisitionBudget } from './types.js';
import { entropyDukeLifeClosed, replayEntropyDukeLifeRoot, type EntropyDukeSceneRoot } from './life.js';
import { currentEntropyDukeCombatSource, nextEntropyDukeCombatSource, validEntropyDukeBody, validEntropyDukeCombatSource, validEntropyDukeInjuries, validEntropyDukeGifts,
  validateEntropyDukeCombatRound, validateEntropyDukeRoundOutcome, type EntropyDukeCombatSource, type EntropyDukeRoundOutcome } from './combat.js';

export const ENTROPY_DUKE_TARGET_ID = 'ED2-OSWIN' as const;
export const ENTROPY_DUKE_POWER_IDS = ['ARC_BOLT', 'WARD', 'COMPOSE', 'MENTAL_PRESSURE'] as const;
export type EntropyDukePowerId = typeof ENTROPY_DUKE_POWER_IDS[number];
export type EntropyDukeEnemyIntent = EntropyDukePowerId | 'BODY_STRIKE' | 'ACCIDENT';
export type EntropyDukePendingKind = 'ORDERED_DEVIATION';
export const ENTROPY_DUKE_POWERS = [
  { id: 'ARC_BOLT', label: '有限弧光', cost: 5, selfGain: 70, enemyReduction: 0 },
  { id: 'WARD', label: '有限屏护', cost: 4, selfGain: 0, enemyReduction: 30 },
  { id: 'COMPOSE', label: '自主凝神抵抗', cost: 4, selfGain: 8, enemyReduction: 0 },
  { id: 'MENTAL_PRESSURE', label: '有限精神施压', cost: 5, selfGain: 45, enemyReduction: 0 },
] as const;
export interface EntropyDukeCombatBody {
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  weaponLocation: 'HAND' | 'COURT'; powerUses: Record<EntropyDukePowerId, number>; pendingKind: EntropyDukePendingKind | null; composureReady: boolean;
  deviationAttempts: number; magnifyUses: number; exploitUses: number; amplificationAttempts: number; prolongationAttempts: number;
}
function initialBody(): EntropyDukeCombatBody {
  return { enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0, weaponLocation: 'HAND',
    powerUses: { ARC_BOLT: 0, WARD: 0, COMPOSE: 0, MENTAL_PRESSURE: 0 }, pendingKind: null, composureReady: false,
    deviationAttempts: 0, magnifyUses: 0, exploitUses: 0, amplificationAttempts: 0, prolongationAttempts: 0 };
}
export function combatBody(e: EntropyDukeCombatBody): EntropyDukeCombatBody {
  return Object.fromEntries(Object.keys(initialBody()).map(k => [k, structuredClone(e[k as keyof EntropyDukeCombatBody])])) as unknown as EntropyDukeCombatBody;
}
export type EntropyDukeFinanceSnapshot = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface EntropyDukePreparation {
  week: number; date: PublicGameDate; revision: number; runId: string; randomSeed: string; randomCursor: number; mindPaid: 2;
  lifeJournalLength: number; lifeClockSeconds: number; before: EntropyDukeAcquisitionBudget; after: EntropyDukeAcquisitionBudget; finance: EntropyDukeFinanceSnapshot;
}
export interface EntropyDukeClearance {
  week: number; darianId: 'FM3-DARIAN'; darianConsent: 'GRANTED'; darianFrom: 'A'; darianTo: 'OUTSIDE'; darianMetres: 8; darianSeconds: 8; darianRoute: ['A', 'START', 'OUTSIDE'];
  guideId: 'GUIDE'; guideConsent: 'GRANTED'; guideFrom: 'START'; guideTo: 'OUTSIDE'; guideMetres: 4; guideSeconds: 4; guideRoute: ['START', 'OUTSIDE'];
  carriedItems: ['FM3-PARCEL', 'FM3-PRACTICE-BALL', 'FM3-ROUTE-PAPER']; playerMetres: 4; playerSeconds: 4; elapsedSeconds: 16;
}
export interface EntropyDukeEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: EntropyDukeCombatBody['enemyStatus']; exitMetres: 0 | 4; exitSeconds: 0 | 4;
}
export interface EntropyDukeEncounterState extends EntropyDukeCombatBody {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof ENTROPY_DUKE_TARGET_ID;
  preparation: EntropyDukePreparation | null; approachWeek: number | null; approachRevision: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  startRoot: EntropyDukeSceneRoot | null; startSource: EntropyDukeCombatSource | null; originalEncounter: SliceState['frenzyMage']['encounter'] | null;
 originalHistory: SliceCombatRound[] | null; clearance: EntropyDukeClearance | null;
  yardId: 'FM3-DELIVERY-PRACTICE'; ordinaryExit: 'OPEN'; enemyPosition: 'BETWEEN_A_AND_B'; enemyDistanceMetres: 2; terminal: EntropyDukeEncounterTerminal | null;
}
export type EntropyDukeEncounterCommand = { type: 'PREPARE_ENCOUNTER' | 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface EntropyDukeEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: EntropyDukeEncounterCommand }
export interface EntropyDukeEncounterProjection {
  title: string; story: string; status: EntropyDukeEncounterState['status']; inside: boolean; preparation: null | { week: number; mindPaid: 2 };
  scene: null | { courtId: 'FM3-DELIVERY-PRACTICE'; playerLocation: string; darianLocation: string; guideLocation: string; ordinaryExit: 'OPEN'; distanceMetres: number; clockSeconds: number; playerTravelMetres: number };
  enemy: null | { id: typeof ENTROPY_DUKE_TARGET_ID; name: '奥斯温·格雷'; age: 46; pathway: 'original-caster'; sequence: 3; health: number; mind: number; spirituality: number; status: EntropyDukeCombatBody['enemyStatus'];
    weaponId: 'ED2-OSWIN-ROD'; weaponLocation: 'HAND' | 'COURT'; powerUses: Record<EntropyDukePowerId, number>; abilities: string[] };
  pendingKind: EntropyDukePendingKind | null; composureReady: boolean; actions: EntropyDukeEncounterAction[]; facts: string[];
}
export const ENTROPY_DUKE_ENCOUNTER_STORY = '46岁的施术者奥斯温·格雷来到原投递演练房，提出通行争议。他有自己的身体、独立心智与唯一手杖，健康100、精神100、灵性120；弧光、屏护、凝神与精神施压均有真实消耗。先询问达里安与导师此次离场意愿，让两人沿原路走到室外，导师亲带原包、原球与原纸，再到2米外交谈。普通4米出口一直开放，可以和平离开。';
export function createEntropyDukeEncounterState(): EntropyDukeEncounterState {
  return { ...initialBody(), status: 'AVAILABLE', targetId: ENTROPY_DUKE_TARGET_ID, preparation: null, approachWeek: null, approachRevision: null, attemptWeek: null, startHistoryIndex: null,
    startRoot: null, startSource: null, originalEncounter: null, originalHistory: null, clearance: null,
    yardId: 'FM3-DELIVERY-PRACTICE', ordinaryExit: 'OPEN', enemyPosition: 'BETWEEN_A_AND_B', enemyDistanceMetres: 2, terminal: null };
}
export const createEntropyDukeEncounter = createEntropyDukeEncounterState;
const stage = (s: SliceState) => s.progression.pathwayId === 'black-emperor' && s.progression.sequence === 2;
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
function financeSnapshot(s: EntropyDukeFinanceSnapshot): EntropyDukeFinanceSnapshot {
  return { weeklyBudget: s.weeklyBudget, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: structuredClone(s.debts), missedWeeks: s.missedWeeks, credit: s.credit };
}
function validFinance(v: EntropyDukeFinanceSnapshot, week: number): boolean {
  return shape(v, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit']) && integer(v.weeklyBudget, 1, 100) &&
    Object.hasOwn(SLICE_LIFE, v.lifeTier) && Object.hasOwn(SLICE_LIFE, v.nextLifeTier) && integer(v.missedWeeks) && ['NORMAL', 'NOTICE', 'SUSPENDED'].includes(v.credit) &&
    Array.isArray(v.debts) && v.debts.every(d => shape(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek']) && typeof d.id === 'string' && d.id.length > 0 && d.id.length <= 500 &&
      typeof d.source === 'string' && d.source.length > 0 && d.source.length <= 500 && integer(d.remaining) && integer(d.weeklyPayment, 1) && integer(d.createdWeek, 0, week));
}
export function entropyDukeEncounterBudget(s: SliceState): EntropyDukeAcquisitionBudget {
  return { cash: s.cash, actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution, sequence: s.progression.sequence as 2, acting: s.progression.acting,
    coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources], injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk, gifts: structuredClone(s.briber.gifts) };
}
function validBudget(v: EntropyDukeAcquisitionBudget, week: number, revision: number): boolean {
  return shape(v, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk', 'gifts']) &&
    integer(v.cash) && integer(v.actions, 0, 100) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.pollution, 0, 100) && v.sequence === 2 && integer(v.acting, 0, 100) &&
    shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) && Object.values(v.coreStats).every(n => integer(n, 0, 500)) && !!v.mastery && typeof v.mastery === 'object' && !Array.isArray(v.mastery) && Object.values(v.mastery).every(n => integer(n, 0, 500)) &&
    Array.isArray(v.completedSources) && v.completedSources.every(x => typeof x === 'string' && !!x) && new Set(v.completedSources).size === v.completedSources.length && integer(v.injuryRisk) && validEntropyDukeInjuries(v.injuries, revision) && validEntropyDukeGifts(v.gifts, week);
}
export function validateEntropyDukePreparation(v: unknown): v is EntropyDukePreparation {
  try { const p = v as EntropyDukePreparation;
    return shape(p, ['week', 'date', 'revision', 'runId', 'randomSeed', 'randomCursor', 'mindPaid', 'lifeJournalLength', 'lifeClockSeconds', 'before', 'after', 'finance']) && integer(p.week, 1) &&
      isValidGameDate(p.date) && p.week === Math.floor(gameDaysBetween(ORIGIN, p.date) / 7) + 1 && integer(p.revision, 1) && typeof p.runId === 'string' && !!p.runId && typeof p.randomSeed === 'string' && !!p.randomSeed && integer(p.randomCursor) &&
      p.mindPaid === 2 && integer(p.lifeJournalLength, 1) && integer(p.lifeClockSeconds) && validBudget(p.before, p.week, p.revision) && validBudget(p.after, p.week, p.revision) && validFinance(p.finance, p.week) &&
      p.after.actions <= p.finance.weeklyBudget && p.before.mind > 2 && same(p.after, { ...p.before, mind: p.before.mind - 2 });
  } catch { return false; }
}
export function validateEntropyDukeEncounterCommand(v: unknown): v is EntropyDukeEncounterCommand { return shape(v, ['type']) && ['PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type)); }
export const isEntropyDukeEncounterCommand = validateEntropyDukeEncounterCommand;
export const hasEntropyDukeEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.entropyDuke.encounter.status) || s.entropyDuke.encounter.status === 'AVAILABLE' && s.entropyDuke.encounter.preparation !== null;
export const isInsideEntropyDukeEncounter = hasEntropyDukeEncounterLock;
function closedRoot(p: EntropyDukeSceneRoot): boolean {
  return p.siteId === 'FM3-DELIVERY-PRACTICE' && p.introducedWeek !== null && p.playerLocation === 'START' && p.volunteer.id === 'FM3-DARIAN' && p.volunteer.age === 42 && p.volunteer.alive && p.volunteer.location === 'A' && p.guide.id === 'GUIDE' && p.guide.location === 'START' &&
    p.parcel.id === 'FM3-PARCEL' && p.parcel.holder === 'GUIDE' && p.parcel.location === 'START' && p.ball.id === 'FM3-PRACTICE-BALL' && p.ball.holder === 'GUIDE' && p.ball.location === 'START' && p.paper.id === 'FM3-ROUTE-PAPER' && p.paper.holder === 'GUIDE' && p.paper.location === 'START' &&
    p.activeCase === null && Object.values(p.cases).every(c => c.status === 'RESOLVED' && !c.contactOpen);
}
function lifeReady(s: SliceState): boolean {
  const shadow = { ...s, frenzyMage: { ...s.frenzyMage, life: s.entropyDuke.encounter.startRoot ?? s.frenzyMage.life } };
  return s.entropyDuke.preparedWeek === null && s.entropyDuke.life.reflected && entropyDukeLifeClosed(shadow);
}
const clearance = (week: number): EntropyDukeClearance => ({ week, darianId: 'FM3-DARIAN', darianConsent: 'GRANTED', darianFrom: 'A', darianTo: 'OUTSIDE', darianMetres: 8, darianSeconds: 8,
  darianRoute: ['A', 'START', 'OUTSIDE'], guideId: 'GUIDE', guideConsent: 'GRANTED', guideFrom: 'START', guideTo: 'OUTSIDE', guideMetres: 4, guideSeconds: 4, guideRoute: ['START', 'OUTSIDE'],
  carriedItems: ['FM3-PARCEL', 'FM3-PRACTICE-BALL', 'FM3-ROUTE-PAPER'], playerMetres: 4, playerSeconds: 4, elapsedSeconds: 16 });
export function entropyDukeApproachedRoot(start: EntropyDukeSceneRoot, week: number): EntropyDukeSceneRoot {
  if (!closedRoot(start) || !integer(week, start.introducedWeek!)) throw new Error('须归还同一原物，核对原人位置后询问此次离场意愿。');
  const p = structuredClone(start); p.volunteer.location = 'OUTSIDE'; p.clockSeconds += 8; p.guide.location = 'OUTSIDE'; p.guideTravelMetres += 4;
  p.parcel.location = p.ball.location = p.paper.location = 'OUTSIDE'; p.clockSeconds += 4; p.playerLocation = 'A'; p.playerTravelMetres += 4; p.clockSeconds += 4; return p;
}
export function leaveEntropyDukeCombatRoot(p: EntropyDukeSceneRoot): void {
  if (p.playerLocation !== 'A' || p.volunteer.location !== 'OUTSIDE' || p.guide.location !== 'OUTSIDE') throw new Error('真实原位置不支持普通退出。'); p.playerLocation = 'START'; p.playerTravelMetres += 4; p.clockSeconds += 4;
}
function oldHistoryUnchanged(s: SliceState): boolean {
  const e = s.entropyDuke.encounter; return same(e.originalEncounter, s.frenzyMage.encounter) && Array.isArray(e.originalHistory) && same(e.originalHistory, s.combatHistory.slice(0, e.originalHistory.length));
}
function actualCourt(s: SliceState): boolean {
  const e = s.entropyDuke.encounter, p = s.frenzyMage.life;
  return e.yardId === 'FM3-DELIVERY-PRACTICE' && e.ordinaryExit === 'OPEN' && e.enemyPosition === 'BETWEEN_A_AND_B' && e.enemyDistanceMetres === 2 && e.startRoot !== null && closedRoot(e.startRoot) && e.preparation !== null &&
    e.approachWeek === s.week && same(e.clearance, clearance(s.week)) && p.siteId === 'FM3-DELIVERY-PRACTICE' && p.playerLocation === 'A' && p.volunteer.id === 'FM3-DARIAN' && p.volunteer.age === 42 && p.volunteer.location === 'OUTSIDE' && p.volunteer.alive &&
    p.guide.id === 'GUIDE' && p.guide.location === 'OUTSIDE' && [p.parcel, p.ball, p.paper].every(item => item.holder === 'GUIDE' && item.location === 'OUTSIDE') && oldHistoryUnchanged(s);
}
export function blockEntropyDukeEncounter(s: SliceState, c: EntropyDukeEncounterCommand): string | null {
  if (!validateEntropyDukeEncounterCommand(c)) return '遭遇命令无效。'; const e = s.entropyDuke.encounter;
  if (!stage(s) || s.status !== 'ACTIVE' || s.health <= 0 || s.entropyDuke.promotionWeek === null || !s.entropyDuke.guidanceKnown) return '须本人仍活着且完成熵之公爵晋升。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件、战斗或周账。'; if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德原投递演练房。';
  if (!lifeReady(s)) return '先完成三份真实报告、收好原现场并反思。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' && actualCourt(s) || e.status === 'AVAILABLE' && e.preparation !== null && closedRoot(s.frenzyMage.life as EntropyDukeSceneRoot) ? null : '须有本次准备或真实到场，才能普通离开。';
  if (s.mind <= 0) return '先恢复精神；已准备后仍可普通退出。';
  if (c.type === 'PREPARE_ENCOUNTER') {
    if (e.status !== 'AVAILABLE' || e.preparation) return '已有本次准备或原人结局，不重复生成或重置。'; const end = replayEntropyDukeLifeRoot(s);
    if (!end || !same(end, s.frenzyMage.life) || !closedRoot(end)) return '须保留原投递演练房及所有旧身体、旧物与真实冲突记录。';
    return s.mind <= 2 ? '整理注意力需2精神并保持清醒。' : null;
  }
  if (s.actionsRemaining < 1) return '实际选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' || !e.preparation || !closedRoot(s.frenzyMage.life as EntropyDukeSceneRoot) ? '先准备并收好原物。' : s.actionsRemaining < 2 ? '交谈需1行动，另留1行动决定交战。' : null;
  return e.status === 'READY' && actualCourt(s) ? null : '须先询问此次离场意愿，让达里安与导师实际走到室外后交谈。';
}
export const entropyDukeEncounterReason = blockEntropyDukeEncounter;
export function applyEntropyDukeEncounterCommand(s: SliceState, c: EntropyDukeEncounterCommand, ctx: SeerContext): void {
  const reason = blockEntropyDukeEncounter(s, c); if (reason) throw new Error(reason); const e = s.entropyDuke.encounter;
  if (c.type === 'PREPARE_ENCOUNTER') {
    const before = entropyDukeEncounterBudget(s); s.mind -= 2; e.preparation = { week: s.week, date: { ...s.date }, revision: s.revision + 1, runId: s.runId, randomSeed: s.random.seed, randomCursor: s.random.cursor, mindPaid: 2,
      lifeJournalLength: s.entropyDuke.life.journal.length, lifeClockSeconds: s.frenzyMage.life.clockSeconds, before, after: entropyDukeEncounterBudget(s), finance: financeSnapshot(s) };
    e.originalEncounter = structuredClone(s.frenzyMage.encounter); e.originalHistory = structuredClone(s.combatHistory);
    ctx.note('核对原现场与普通出口', '实际付2精神；达里安、原包、原球、原纸与导师保持原位置。'); return;
  }
  if (c.type === 'LEAVE_ENCOUNTER') {
    if (e.status === 'READY') leaveEntropyDukeCombatRoot(s.frenzyMage.life as EntropyDukeSceneRoot); e.status = 'RESOLVED'; ctx.note('普通退出本次争议', e.startRoot ? '本人实际走4米、花4秒回原入口；原两人仍在室外，奥斯温及唯一原杖留演练房。' : '本人原本就在入口，停止此次准备；已付2精神不退，没有凭空移动人物。'); return;
  }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') {
    e.startRoot = structuredClone(s.frenzyMage.life) as EntropyDukeSceneRoot; e.clearance = clearance(s.week); s.frenzyMage.life = entropyDukeApproachedRoot(e.startRoot, s.week);
    e.status = 'READY'; e.approachWeek = s.week; e.approachRevision = s.revision + 1;
    ctx.note('两位原人同意后亲自离场', '达里安明确同意这次离场，从A经入口走8米8秒到室外；导师明确同意，亲带原包、原球与原纸从入口走4米4秒到室外；本人再走4米4秒到A，与2米外奥斯温交谈。'); return;
  }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'ENTROPY_DUKE_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  const source = currentEntropyDukeCombatSource(s); if (!source) throw new Error('原人、原杖和真实原资源来源不完整。'); e.startSource = { ...source, revision: s.revision + 1 };
  ctx.note('原奥斯温的有限真实冲突', '实际付1行动，双方保留自己的身体、独立心智和原物。行为增幅只用于本人当次动作；效果延长只用于本人仍有效的待用影响。');
}
export const applyEntropyDukeEncounter = applyEntropyDukeEncounterCommand;
export const handleEntropyDukeEncounter = applyEntropyDukeEncounterCommand;
export function startEntropyDukeEncounter(s: SliceState, ctx: SeerContext): void { applyEntropyDukeEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasEntropyDukeDisputeOpponent(s: SliceState): boolean {
  const e = s.entropyDuke?.encounter, c = s.combat;
  return stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && lifeReady(s) && s.entropyDuke.guidanceKnown && s.entropyDuke.promotionWeek !== null &&
    !!e && e.status === 'FIGHTING' && e.targetId === ENTROPY_DUKE_TARGET_ID && e.terminal === null && actualCourt(s) && e.attemptWeek === s.week && validEntropyDukeBody(e, (c?.round ?? 1) - 1) &&
    c?.encounterId === 'ENTROPY_DUKE_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && e.enemyStatus === 'RESISTING' && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind &&
    same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk && integer(c.round, 1) && e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
function terminalRoot(o: EntropyDukeRoundOutcome): { root: EntropyDukeSceneRoot; exit: 0 | 4 } {
  const root = structuredClone(o.rootAfter), exit = o.playerHealthAfter > 0 ? 4 : 0; if (exit) leaveEntropyDukeCombatRoot(root); return { root, exit };
}
export function settleEntropyDukeEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.entropyDuke.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'ENTROPY_DUKE_DISPUTE') throw new Error('没有这场原演练房冲突。'); if (outcome === 'CONTINUE') return;
  const last = c.lastRound, o = last?.entropyDukeOutcome;
  if (!last || !o || !validateEntropyDukeRoundOutcome(o) || !validateEntropyDukeCombatRound(last) || o.continuing || e.terminal || e.startHistoryIndex === null || c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round ||
    !same(s.combatHistory.at(-1), last) || !same(combatBody(e), combatBody(o)) || !same(o.rootAfter, s.frenzyMage.life) || o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality || !same(o.giftsAfter, s.briber.gifts) || !same(o.masteryAfter, s.progression.mastery) ||
    !same(o.playerInjuriesAfter, s.injuries) || o.playerRiskAfter !== s.injuryRisk || o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || !same(o.enemyInjuries, c.enemyInjuries) || o.enemyRisk !== c.enemyRisk || o.enemyStatus !== c.enemyStatus ||
    outcome !== (o.playerHealthAfter === 0 ? 'PLAYER_DEAD' : o.enemyHealth === 0 ? 'ENEMY_DEAD' : o.enemyStatus === 'SURRENDERED' ? 'ENEMY_SURRENDERED' : 'RETREATED')) throw new Error('结局与真实回合、原身体、原物及已花资源不一致。');
  const final = terminalRoot(o); s.frenzyMage.life = final.root;
  e.terminal = { outcome: outcome as EntropyDukeEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, exitMetres: final.exit, exitSeconds: final.exit };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('原奥斯温冲突结束', `${final.exit ? '本人活着沿原路走4米4秒回入口。' : '本人的原身体真实死亡并留在A，不复活或搬移。'}达里安与导师仍在室外，奥斯温原杖保留最后实际位置；原伤与已花费用不退。`);
}
export const finishEntropyDukeEncounter = settleEntropyDukeEncounter;
export function entropyDukeEncounterActions(s: SliceState): EntropyDukeEncounterAction[] {
  if (!stage(s)) return [];
  return ([['PREPARE_ENCOUNTER', '核对注意力与普通出口', '2精神；0行动'], ['ENCOUNTER_TALK', '请两位原人离场后交谈', '1行动；实际16秒'], ['ENCOUNTER_FIGHT', '选择与奥斯温交战', '1行动；真实伤势与死亡风险'], ['LEAVE_ENCOUNTER', '普通退出本次争议', '0行动；到场后4米4秒']] as const).map(([type, label, cost]) => {
    const command: EntropyDukeEncounterCommand = { type }, reason = blockEntropyDukeEncounter(s, command); return { id: `entropyDuke-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectEntropyDukeEncounter(s: SliceState): EntropyDukeEncounterProjection {
  const e = s.entropyDuke.encounter, p = s.frenzyMage.life;
  if (!stage(s)) return { title: '尚未开放的演练房争议', story: '', status: e.status, inside: false, preparation: null, scene: null, enemy: null, pendingKind: null, composureReady: false, actions: [], facts: [] };
  return { title: '奥斯温的演练房通行争议', story: ENTROPY_DUKE_ENCOUNTER_STORY, status: e.status, inside: hasEntropyDukeEncounterLock(s), preparation: e.preparation ? { week: e.preparation.week, mindPaid: 2 } : null,
    scene: { courtId: 'FM3-DELIVERY-PRACTICE', playerLocation: p.playerLocation, darianLocation: p.volunteer.location, guideLocation: p.guide.location, ordinaryExit: 'OPEN', distanceMetres: p.playerLocation === 'START' ? 6 : 2, clockSeconds: p.clockSeconds, playerTravelMetres: p.playerTravelMetres },
    enemy: { id: e.targetId, name: '奥斯温·格雷', age: 46, pathway: 'original-caster', sequence: 3, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus, weaponId: 'ED2-OSWIN-ROD', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses }, abilities: ENTROPY_DUKE_POWERS.map(x => x.label) },
    pendingKind: e.pendingKind, composureReady: e.composureReady, actions: entropyDukeEncounterActions(s), facts: [
      '达里安与导师分别同意后亲自走到室外；导师带走自己的原包、原球与原纸。',
      '行为增幅付6灵性1精神，知识20检定，成功只放大本人当前一次击打；不足时仅沿原4灵性放大或普通身体动作。',
      '效果延长付5灵性1精神，知识20检定，只把本人仍有效的同一待用影响延长30秒一次；不加次数、不刷新、不重建已结束状态。',
      '旧偏转仍付5灵性；原木筹赠予仍消耗真实库存与3灵性，利用仍须已存在的礼物影响与3灵性。失败、抵抗、取消与未用到期均不退费。',
      '身体与精神后果按实际攻击来源分别结算；普通出口开放，只有活着才能离开。全部旧身体、旧物与旧记录保持原样。' ] };
}
/** Reconcile the shared financial pulse from its original frozen input, including
 * interrupted bills and debt notices. Combat resources never receive exemptions. */
export function entropyDukeTerminalBudgetMatches(s: SliceState, prep: EntropyDukePreparation, o: EntropyDukeRoundOutcome): boolean {
  if (!same(s.character.coreStats, prep.after.coreStats) || s.seer.pollution !== prep.after.pollution || s.progression.acting !== prep.after.acting || !same(s.seer.completedSources, prep.after.completedSources) || s.health !== o.playerHealthAfter || s.mind !== o.playerMindAfter || s.spirituality !== o.playerSpiritualityAfter || !same(s.briber.gifts, o.giftsAfter) || !same(s.progression.mastery, o.masteryAfter) ||
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
    const terminalIndex = s.chronicle.findIndex((entry, index) => entry.id === `record-${s.revision}-${index}` && entry.title === '原奥斯温冲突结束');
    const eventIndex = terminalIndex + 1 + result.receipts.length;
    return terminalIndex >= 0 && s.eventQueue.length === 0 && same(s.activeEvent, { id: result.eventId, instanceId: `${s.runId}:${result.eventId}:${s.revision}:${eventIndex}` });
  }
  return true;
}
/** Replays the exact seed, cursor, source, per-slot costs and original physical positions. */
export function replayEntropyDukeEncounterRoot(s: SliceState, lifeEnd: EntropyDukeSceneRoot): EntropyDukeSceneRoot | null {
  try {
    const e = s.entropyDuke?.encounter, initial = createEntropyDukeEncounterState();
    if (!e || !shape(e, Object.keys(initial)) || e.targetId !== ENTROPY_DUKE_TARGET_ID || e.yardId !== initial.yardId || e.ordinaryExit !== 'OPEN' || e.enemyPosition !== initial.enemyPosition || e.enemyDistanceMetres !== 2 || !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status)) return null;
    const allNew = s.combatHistory.flatMap((r, i) => r.entropyDukeOutcome ? [i] : []);
    if (!e.preparation) return same(e, initial) && allNew.length === 0 && s.combat?.encounterId !== 'ENTROPY_DUKE_DISPUTE' ? structuredClone(lifeEnd) : null;
    const prep = e.preparation;
    if (!stage(s) || !s.entropyDuke.guidanceKnown || s.entropyDuke.promotionWeek === null || !validateEntropyDukePreparation(prep) || prep.runId !== s.runId || prep.randomSeed !== s.random.seed || prep.randomCursor > s.random.cursor ||
      !integer(prep.week, s.entropyDuke.promotionWeek, s.week) || compareGameDates(prep.date, s.date) > 0 || !integer(prep.revision, 1, s.revision) || prep.lifeJournalLength !== s.entropyDuke.life.journal.length || prep.lifeClockSeconds !== lifeEnd.clockSeconds || !lifeReady(s) || !closedRoot(lifeEnd) || !oldHistoryUnchanged(s)) return null;
    if (hasEntropyDukeEncounterLock(s) && (!same(financeSnapshot(s), prep.finance) || s.pulse !== 'NONE' || s.billAmount !== 0 || s.activeEvent !== null || s.eventQueue.length !== 0)) return null;
    const lastLife = s.entropyDuke.life.journal.at(-1);
    if (!lastLife || prep.revision <= lastLife.revision + 1 || prep.week < lastLife.week) return null;
    if (prep.revision === lastLife.revision + 2 && prep.week === lastLife.week) {
      const b = lastLife.budget;
      if (prep.before.actions !== b.actionsAfter || prep.before.health !== b.healthAfter || prep.before.mind !== b.mindAfter || prep.before.spirituality !== b.spiritualityAfter || prep.before.cash !== b.cashAfter ||
        !same(prep.date, lastLife.date) || prep.randomCursor !== (lastLife.randomAfter ?? lastLife.randomCursor)) return null;
    }
    const prepared = { ...initial, preparation: prep, originalEncounter: e.originalEncounter, originalHistory: e.originalHistory };
    if (e.startRoot === null) {
      if (!['AVAILABLE', 'RESOLVED'].includes(e.status) || !same({ ...e, status: 'AVAILABLE' }, prepared) || allNew.length || s.combat?.encounterId === 'ENTROPY_DUKE_DISPUTE') return null;
      if (e.status === 'AVAILABLE' && (s.week !== prep.week || !same(s.date, prep.date) || s.random.cursor !== prep.randomCursor || !same(entropyDukeEncounterBudget(s), prep.after) || s.status !== 'ACTIVE')) return null;
      return structuredClone(lifeEnd);
    }
    if (e.approachWeek !== prep.week || e.approachRevision !== prep.revision + 1 || !integer(e.approachRevision, 1, s.revision) || !same(e.startRoot, lifeEnd) || !same(e.clearance, clearance(e.approachWeek))) return null;
    const approached = entropyDukeApproachedRoot(lifeEnd, e.approachWeek), afterTalk = { ...prep.after, actions: prep.after.actions - 1 };
    const talking = { ...prepared, status: e.status, approachWeek: e.approachWeek, approachRevision: e.approachRevision, startRoot: e.startRoot, clearance: e.clearance };
    if (e.startHistoryIndex === null) {
      const ready = e.status === 'READY', peaceful = e.status === 'RESOLVED', root = structuredClone(approached); if (peaceful) leaveEntropyDukeCombatRoot(root);
      if (!(ready || peaceful) || !same(e, talking) || allNew.length || s.combat?.encounterId === 'ENTROPY_DUKE_DISPUTE') return null;
      if (ready && (s.week !== prep.week || !same(s.date, prep.date) || s.random.cursor !== prep.randomCursor || !same(entropyDukeEncounterBudget(s), afterTalk) || s.status !== 'ACTIVE')) return null;
      return root;
    }
    const start = e.startSource;
    if (!integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.startHistoryIndex !== e.originalHistory!.length || e.attemptWeek !== e.approachWeek || !start || !validEntropyDukeCombatSource(start) || start.round !== 1 || !same(start.root, approached) || !same(start.preparation, prep) || start.runId !== s.runId || start.targetId !== e.targetId ||
      start.randomSeed !== s.random.seed || start.attemptWeek !== e.attemptWeek || start.startHistoryIndex !== e.startHistoryIndex || start.revision !== e.approachRevision + 1 || start.revision > s.revision || start.randomCursor !== prep.randomCursor || !same(start.body, initialBody())) return null;
    if (start.playerHealth !== prep.after.health || start.playerMind !== prep.after.mind || start.playerSpirituality !== prep.after.spirituality || !same(start.gifts, prep.after.gifts) || !same(start.mastery, prep.after.mastery) || !same(start.playerInjuries, prep.after.injuries) || start.playerRisk !== prep.after.injuryRisk ||
      !same({ physique: start.physique, perception: start.perception, will: start.will, knowledge: start.knowledge }, prep.after.coreStats)) return null;
    const terminal = e.terminal;
    if (terminal && (!shape(terminal, ['outcome', 'round', 'historyIndex', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'exitMetres', 'exitSeconds']) || !integer(terminal.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1))) return null;
    const end = terminal ? terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    if (!same(allNew, rounds.map((_r, i) => e.startHistoryIndex! + i))) return null;
    let root = approached;
    for (const [i, round] of rounds.entries()) {
      const o = round.entropyDukeOutcome, previous = rounds[i - 1]?.entropyDukeOutcome;
      if (!o || !validateEntropyDukeCombatRound(round) || round.round !== i + 1 || o.source.revision >= s.revision || o.randomCursorAfter > s.random.cursor || !same(o.source, previous ? nextEntropyDukeCombatSource(previous) : start) || !same(o.source.root, root) || i < rounds.length - 1 && !o.continuing) return null;
      root = structuredClone(o.rootAfter);
    }
    const last = rounds.at(-1), o = last?.entropyDukeOutcome;
    if (e.status === 'FIGHTING') {
      if (terminal !== null || !hasEntropyDukeDisputeOpponent(s) || !same(combatBody(e), o ? combatBody(o) : start.body)) return null;
      if (s.actionsRemaining !== prep.after.actions - 2 || s.cash !== prep.after.cash || !same(s.character.coreStats, prep.after.coreStats) || !same(s.progression.mastery, o ? o.masteryAfter : prep.after.mastery) || !same(s.briber.gifts, o ? o.giftsAfter : prep.after.gifts) || s.seer.pollution !== prep.after.pollution || s.progression.acting !== prep.after.acting || !same(s.seer.completedSources, prep.after.completedSources)) return null;
      return o ? o.continuing && same(last, s.combat!.lastRound) && same(currentEntropyDukeCombatSource(s), nextEntropyDukeCombatSource(o)) ? root : null : s.combat!.lastRound === null && same(currentEntropyDukeCombatSource(s), start) ? root : null;
    }
    if (s.combat?.encounterId === 'ENTROPY_DUKE_DISPUTE' || !terminal || !last || !o || o.continuing || terminal.round !== last.round || rounds.length !== terminal.round || !same(combatBody(e), combatBody(o)) || terminal.enemyHealth !== e.enemyHealth || terminal.enemyMind !== e.enemyMind || terminal.enemySpirituality !== e.enemySpirituality || terminal.enemyStatus !== e.enemyStatus) return null;
    const final = terminalRoot(o); if (terminal.exitMetres !== final.exit || terminal.exitSeconds !== final.exit) return null;
    if (s.revision === o.source.revision + 1 && !entropyDukeTerminalBudgetMatches(s, prep, o)) return null;
    if (terminal.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 ? final.root : null;
    if (terminal.outcome === 'RETREATED') return e.status === 'RETREATED' && o.playerHealthAfter > 0 && (last.retreat === 'SUCCESS' || o.playerMindAfter === 0) ? final.root : null;
    return e.status === 'RESOLVED' && o.playerHealthAfter > 0 && (terminal.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : terminal.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED') ? final.root : null;
  } catch { return null; }
}
export function validateEntropyDukeEncounter(s: SliceState): boolean {
  try { const end = replayEntropyDukeLifeRoot(s); if (!end) return same(s.entropyDuke.encounter, createEntropyDukeEncounterState()) && s.entropyDuke.life.source === null && !s.combatHistory.some(r => r.entropyDukeOutcome) && s.combat?.encounterId !== 'ENTROPY_DUKE_DISPUTE';
    const root = replayEntropyDukeEncounterRoot(s, end); return root !== null && same(root, s.frenzyMage.life);
  } catch { return false; }
}
export const validateEntropyDukeEncounterState = validateEntropyDukeEncounter;
