import { SLICE_LIFE } from '../../content/slice-events.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { addGameWeeks, compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceCombatRound, SliceInjury, SliceState } from '../slice/types.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import type { BarrenMatriarchAcquisitionBudget } from './types.js';
import { validCoffinBearerCombatGuard } from '../coffin-bearer/combat.js';
import { barrenMatriarchLifeClosed, replayBarrenMatriarchLifeRoot, replayBarrenMatriarchLifeRootPad, type BarrenMatriarchSceneRoot, type BarrenMatriarchRootPad } from './life.js';
import { currentBarrenMatriarchCombatSource, nextBarrenMatriarchCombatSource, validBarrenMatriarchBody, validBarrenMatriarchCombatSource, validBarrenMatriarchInjuries, validBarrenMatriarchRootPad,
  validateBarrenMatriarchCombatRound, validateBarrenMatriarchRoundOutcome, type BarrenMatriarchCombatSource, type BarrenMatriarchRoundOutcome } from './combat.js';

export const BARREN_MATRIARCH_TARGET_ID = 'BM2-MARTIN' as const;
export const BARREN_MATRIARCH_POWER_IDS = ['ARC_BOLT', 'WARD', 'COMPOSE', 'MENTAL_PRESSURE'] as const;
export type BarrenMatriarchPowerId = typeof BARREN_MATRIARCH_POWER_IDS[number];
export type BarrenMatriarchEnemyIntent = BarrenMatriarchPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export type BarrenMatriarchPendingKind = 'ROOT_BUFFER' | 'MATRIX' | 'PRESERVE';
export const BARREN_MATRIARCH_POWERS = [
  { id: 'ARC_BOLT', label: '有限弧光', cost: 5, selfGain: 70, enemyReduction: 0 },
  { id: 'WARD', label: '有限屏护', cost: 4, selfGain: 0, enemyReduction: 30 },
  { id: 'COMPOSE', label: '自主凝神抵抗', cost: 4, selfGain: 8, enemyReduction: 0 },
  { id: 'MENTAL_PRESSURE', label: '有限精神施压', cost: 5, selfGain: 45, enemyReduction: 0 },
] as const;
export interface BarrenMatriarchCombatBody {
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  weaponLocation: 'HAND' | 'COURT'; powerUses: Record<BarrenMatriarchPowerId, number>; pendingKind: BarrenMatriarchPendingKind | null; composureReady: boolean;
  rootBufferAttempts: number; guardAttempts: number; preservationAttempts: number;
}
function initialBody(): BarrenMatriarchCombatBody {
  return { enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0, weaponLocation: 'HAND',
    powerUses: { ARC_BOLT: 0, WARD: 0, COMPOSE: 0, MENTAL_PRESSURE: 0 }, pendingKind: null, composureReady: false,
    rootBufferAttempts: 0, guardAttempts: 0, preservationAttempts: 0 };
}
export function combatBody(e: BarrenMatriarchCombatBody): BarrenMatriarchCombatBody {
  return Object.fromEntries(Object.keys(initialBody()).map(k => [k, structuredClone(e[k as keyof BarrenMatriarchCombatBody])])) as unknown as BarrenMatriarchCombatBody;
}
export type BarrenMatriarchFinanceSnapshot = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export type BarrenMatriarchEncounterBudget = BarrenMatriarchAcquisitionBudget & { rootPad: BarrenMatriarchRootPad; guard: BarrenMatriarchSceneRoot['guard'] };
export interface BarrenMatriarchPreparation {
  week: number; date: PublicGameDate; revision: number; runId: string; randomSeed: string; randomCursor: number; mindPaid: 2;
  lifeJournalLength: number; lifeClockSeconds: number; before: BarrenMatriarchEncounterBudget; after: BarrenMatriarchEncounterBudget; finance: BarrenMatriarchFinanceSnapshot;
}
export interface BarrenMatriarchClearance {
  week: number; ownerId: 'CB3-ADA'; ownerConsent: 'GRANTED'; ownerFrom: 'A'; ownerTo: 'OUTSIDE'; ownerMetres: 8; ownerSeconds: 8; ownerRoute: ['A', 'START', 'OUTSIDE'];
  recipientId: 'CB3-LENA'; recipientConsent: 'GRANTED'; recipientFrom: 'B'; recipientTo: 'OUTSIDE'; recipientMetres: 12; recipientSeconds: 12; recipientRoute: ['B', 'A', 'START', 'OUTSIDE'];
  ownerCarriedItems: ['CB3-LIVE-2', 'CB3-DRY-1', 'CB3-CASE', 'CB3-TAG', 'CB3-PAD-1', 'CB3-PAD-2', 'CB3-PAD-3', 'CB3-RECORD']; recipientCarriedItems: ['CB3-LIVE-1']; playerMetres: 4; playerSeconds: 4; elapsedSeconds: 24;
}
export interface BarrenMatriarchEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: BarrenMatriarchCombatBody['enemyStatus']; exitMetres: 0 | 4; exitSeconds: 0 | 4;
}
export interface BarrenMatriarchEncounterState extends BarrenMatriarchCombatBody {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof BARREN_MATRIARCH_TARGET_ID;
  preparation: BarrenMatriarchPreparation | null; approachWeek: number | null; approachRevision: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  startRoot: BarrenMatriarchSceneRoot | null; startSource: BarrenMatriarchCombatSource | null; originalEncounter: SliceState['coffinBearer']['encounter'] | null;
 originalHistory: SliceCombatRound[] | null; clearance: BarrenMatriarchClearance | null;
  yardId: 'CB3-NURSERY-TRANSFER'; ordinaryExit: 'OPEN'; enemyPosition: 'BETWEEN_A_AND_B'; enemyDistanceMetres: 2; terminal: BarrenMatriarchEncounterTerminal | null;
}
export type BarrenMatriarchEncounterCommand = { type: 'PREPARE_ENCOUNTER' | 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface BarrenMatriarchEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: BarrenMatriarchEncounterCommand }
export interface BarrenMatriarchEncounterProjection {
  title: string; story: string; status: BarrenMatriarchEncounterState['status']; inside: boolean; preparation: null | { week: number; mindPaid: 2 };
  scene: null | { courtId: 'CB3-NURSERY-TRANSFER'; playerLocation: string; ownerLocation: string; recipientLocation: string; ordinaryExit: 'OPEN'; distanceMetres: number; clockSeconds: number; playerTravelMetres: number };
  enemy: null | { id: typeof BARREN_MATRIARCH_TARGET_ID; name: '马丁·里德'; age: 45; pathway: 'original-caster'; sequence: 3; health: number; mind: number; spirituality: number; status: BarrenMatriarchCombatBody['enemyStatus'];
    weaponId: 'BM2-MARTIN-ROD'; weaponLocation: 'HAND' | 'COURT'; powerUses: Record<BarrenMatriarchPowerId, number>; abilities: string[] };
  pendingKind: BarrenMatriarchPendingKind | null; composureReady: boolean; actions: BarrenMatriarchEncounterAction[]; facts: string[];
}
export const BARREN_MATRIARCH_ENCOUNTER_STORY = '45岁的园艺施术者马丁·里德来到原苗圃，提出器材通行争议。他有自己的身体、独立心智与唯一手杖，健康100、精神100、灵性120；弧光、屏护、凝神与精神施压均有真实消耗。先取得艾达和莉娜此次离场许可，让两人亲携当前照管的原样本与原器材沿普通路线走到室外，再到2米外交谈。有限休眠不适用于人类。普通4米出口一直开放，可以和平离开。';
export function createBarrenMatriarchEncounterState(): BarrenMatriarchEncounterState {
  return { ...initialBody(), status: 'AVAILABLE', targetId: BARREN_MATRIARCH_TARGET_ID, preparation: null, approachWeek: null, approachRevision: null, attemptWeek: null, startHistoryIndex: null,
    startRoot: null, startSource: null, originalEncounter: null, originalHistory: null, clearance: null,
    yardId: 'CB3-NURSERY-TRANSFER', ordinaryExit: 'OPEN', enemyPosition: 'BETWEEN_A_AND_B', enemyDistanceMetres: 2, terminal: null };
}
export const createBarrenMatriarchEncounter = createBarrenMatriarchEncounterState;
const stage = (s: SliceState) => s.progression.pathwayId === 'mother' && s.progression.sequence === 2;
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
function financeSnapshot(s: BarrenMatriarchFinanceSnapshot): BarrenMatriarchFinanceSnapshot {
  return { weeklyBudget: s.weeklyBudget, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: structuredClone(s.debts), missedWeeks: s.missedWeeks, credit: s.credit };
}
function validFinance(v: BarrenMatriarchFinanceSnapshot, week: number): boolean {
  return shape(v, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit']) && integer(v.weeklyBudget, 1, 100) &&
    Object.hasOwn(SLICE_LIFE, v.lifeTier) && Object.hasOwn(SLICE_LIFE, v.nextLifeTier) && integer(v.missedWeeks) && ['NORMAL', 'NOTICE', 'SUSPENDED'].includes(v.credit) &&
    Array.isArray(v.debts) && v.debts.every(d => shape(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek']) && typeof d.id === 'string' && d.id.length > 0 && d.id.length <= 500 &&
      typeof d.source === 'string' && d.source.length > 0 && d.source.length <= 500 && integer(d.remaining) && integer(d.weeklyPayment, 1) && integer(d.createdWeek, 0, week));
}
export function barrenMatriarchEncounterBudget(s: SliceState): BarrenMatriarchEncounterBudget {
  return { cash: s.cash, actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution, gender: s.character.gender, sequence: s.progression.sequence as 2, acting: s.progression.acting,
    coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources], injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk, rootPad: structuredClone(s.barrenMatriarch.life.rootPad), guard: structuredClone(s.coffinBearer.life.guard) };
}
function validBudget(v: BarrenMatriarchEncounterBudget, week: number, revision: number): boolean {
  return shape(v, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk', 'rootPad', 'guard']) &&
    integer(v.cash) && integer(v.actions, 0, 100) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.pollution, 0, 100) && v.gender === 'FEMALE' && v.sequence === 2 && integer(v.acting, 0, 100) &&
    shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) && Object.values(v.coreStats).every(n => integer(n, 0, 500)) && !!v.mastery && typeof v.mastery === 'object' && !Array.isArray(v.mastery) && Object.values(v.mastery).every(n => integer(n, 0, 500)) &&
    Array.isArray(v.completedSources) && v.completedSources.every(x => typeof x === 'string' && !!x) && new Set(v.completedSources).size === v.completedSources.length && integer(v.injuryRisk) && validBarrenMatriarchInjuries(v.injuries, revision) && validBarrenMatriarchRootPad(v.rootPad, week) && validCoffinBearerCombatGuard(v.guard);
}
export function validateBarrenMatriarchPreparation(v: unknown): v is BarrenMatriarchPreparation {
  try { const p = v as BarrenMatriarchPreparation;
    return shape(p, ['week', 'date', 'revision', 'runId', 'randomSeed', 'randomCursor', 'mindPaid', 'lifeJournalLength', 'lifeClockSeconds', 'before', 'after', 'finance']) && integer(p.week, 1) &&
      isValidGameDate(p.date) && p.week === Math.floor(gameDaysBetween(ORIGIN, p.date) / 7) + 1 && integer(p.revision, 1) && typeof p.runId === 'string' && !!p.runId && typeof p.randomSeed === 'string' && !!p.randomSeed && integer(p.randomCursor) &&
      p.mindPaid === 2 && integer(p.lifeJournalLength, 1) && integer(p.lifeClockSeconds) && validBudget(p.before, p.week, p.revision) && validBudget(p.after, p.week, p.revision) && validFinance(p.finance, p.week) &&
      p.after.actions <= p.finance.weeklyBudget && p.before.mind > 2 && same(p.after, { ...p.before, mind: p.before.mind - 2 });
  } catch { return false; }
}
export function validateBarrenMatriarchEncounterCommand(v: unknown): v is BarrenMatriarchEncounterCommand { return shape(v, ['type']) && ['PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type)); }
export const isBarrenMatriarchEncounterCommand = validateBarrenMatriarchEncounterCommand;
export const hasBarrenMatriarchEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.barrenMatriarch.encounter.status) || s.barrenMatriarch.encounter.status === 'AVAILABLE' && s.barrenMatriarch.encounter.preparation !== null;
export const isInsideBarrenMatriarchEncounter = hasBarrenMatriarchEncounterLock;
function closedRoot(p: BarrenMatriarchSceneRoot): boolean {
  return p.siteId === 'CB3-NURSERY-TRANSFER' && p.introducedWeek !== null && p.playerLocation === 'START' && p.owner.id === 'CB3-ADA' && p.owner.age === 46 && p.owner.alive && p.owner.location === 'A' && p.recipient.id === 'CB3-LENA' && p.recipient.age === 39 && p.recipient.alive && p.recipient.location === 'B' &&
    p.box.id === 'CB3-CASE' && p.box.holder === 'OWNER' && p.box.location === 'A' && p.box.sampleId === null && p.tag.id === 'CB3-TAG' && p.tag.holder === 'OWNER' && p.tag.location === 'A' && p.paper.id === 'CB3-RECORD' && p.paper.holder === 'OWNER' && p.paper.location === 'A' &&
    p.pads.length === 3 && p.pads.every((v, i) => v.id === `CB3-PAD-${i + 1}` && v.holder === 'OWNER' && v.location === 'A') && p.samples.length === 3 &&
    p.samples[0]!.id === 'CB3-LIVE-1' && p.samples[0]!.holder === 'RECIPIENT' && p.samples[0]!.location === 'B' && p.samples[0]!.care === 'RECIPIENT_CARE' &&
    p.samples.slice(1).every(v => v.holder === 'OWNER' && v.location === 'A' && v.care === 'OWNER_CARE') && p.samples[1]!.id === 'CB3-LIVE-2' && p.samples[2]!.id === 'CB3-DRY-1' && !p.samples[2]!.alive && p.samples[2]!.vitality === 0 &&
    p.activeCase === null && Object.values(p.cases).every(c => c.status === 'RESOLVED' && !c.contactOpen);
}
function lifeReady(s: SliceState): boolean {
  const shadow = { ...s, coffinBearer: { ...s.coffinBearer, life: (s.barrenMatriarch.encounter.startRoot ?? s.coffinBearer.life) as SliceState['coffinBearer']['life'] }, barrenMatriarch: { ...s.barrenMatriarch, life: { ...s.barrenMatriarch.life, rootPad: s.barrenMatriarch.encounter.preparation?.before.rootPad ?? s.barrenMatriarch.life.rootPad } } };
  return s.barrenMatriarch.preparedWeek === null && s.barrenMatriarch.life.reflected && barrenMatriarchLifeClosed(shadow);
}
const clearance = (week: number): BarrenMatriarchClearance => ({ week, ownerId: 'CB3-ADA', ownerConsent: 'GRANTED', ownerFrom: 'A', ownerTo: 'OUTSIDE', ownerMetres: 8, ownerSeconds: 8,
  ownerRoute: ['A', 'START', 'OUTSIDE'], recipientId: 'CB3-LENA', recipientConsent: 'GRANTED', recipientFrom: 'B', recipientTo: 'OUTSIDE', recipientMetres: 12, recipientSeconds: 12, recipientRoute: ['B', 'A', 'START', 'OUTSIDE'],
  ownerCarriedItems: ['CB3-LIVE-2', 'CB3-DRY-1', 'CB3-CASE', 'CB3-TAG', 'CB3-PAD-1', 'CB3-PAD-2', 'CB3-PAD-3', 'CB3-RECORD'], recipientCarriedItems: ['CB3-LIVE-1'], playerMetres: 4, playerSeconds: 4, elapsedSeconds: 24 });
export function barrenMatriarchApproachedRoot(start: BarrenMatriarchSceneRoot, week: number): BarrenMatriarchSceneRoot {
  if (!closedRoot(start) || !integer(week, start.introducedWeek!)) throw new Error('须归还同一原物，核对原人位置后询问此次离场意愿。');
  const p = structuredClone(start); p.owner.location = 'OUTSIDE'; p.recipient.location = 'OUTSIDE';
  for (const item of [...p.samples, p.box, p.tag, ...p.pads, p.paper]) item.location = 'OUTSIDE';
  p.playerLocation = 'A'; p.playerTravelMetres += 4; p.clockSeconds += 24; p.externalSeconds += 24; return p;
}
export function leaveBarrenMatriarchCombatRoot(p: BarrenMatriarchSceneRoot): void {
  if (p.playerLocation !== 'A' || p.owner.location !== 'OUTSIDE' || p.recipient.location !== 'OUTSIDE') throw new Error('真实原位置不支持普通退出。');
  p.playerLocation = 'START'; p.playerTravelMetres += 4; p.clockSeconds += 4; p.externalSeconds += 4;
}
function approachedPlate(p: BarrenMatriarchRootPad): BarrenMatriarchRootPad { return { ...structuredClone(p), location: p.holder === 'PLAYER' ? 'A' : 'START' }; }
function terminalPlate(o: BarrenMatriarchRoundOutcome): BarrenMatriarchRootPad { return { ...structuredClone(o.rootPadAfter), location: o.rootPadAfter.holder === 'PLAYER' && o.playerHealthAfter > 0 ? 'START' : o.rootPadAfter.location }; }
/** The same purchased object follows its actual holder; neither combat nor exit replenishes it. */
export function replayBarrenMatriarchEncounterRootPad(s: SliceState, lifeEnd: BarrenMatriarchRootPad): BarrenMatriarchRootPad | null {
  const e = s.barrenMatriarch.encounter;
  if (!e.preparation) return structuredClone(lifeEnd);
  if (!same(e.preparation.before.rootPad, lifeEnd) || !same(e.preparation.after.rootPad, lifeEnd)) return null;
  if (!e.startRoot) return structuredClone(lifeEnd);
  if (e.startHistoryIndex === null) { const p = approachedPlate(lifeEnd); if (e.status === 'RESOLVED' && p.holder === 'PLAYER') p.location = 'START'; return p; }
  if (!e.startSource || !same(e.startSource.rootPad, approachedPlate(lifeEnd))) return null;
  const index = e.terminal?.historyIndex ?? s.combatHistory.length - 1, last = s.combatHistory[index]?.barrenMatriarchOutcome;
  if (index < e.startHistoryIndex) return structuredClone(e.startSource.rootPad);
  return last ? e.terminal ? terminalPlate(last) : structuredClone(last.rootPadAfter) : null;
}
function oldHistoryUnchanged(s: SliceState): boolean {
  const e = s.barrenMatriarch.encounter; return same(e.originalEncounter, s.coffinBearer.encounter) && Array.isArray(e.originalHistory) && same(e.originalHistory, s.combatHistory.slice(0, e.originalHistory.length));
}
function actualCourt(s: SliceState): boolean {
  const e = s.barrenMatriarch.encounter, p = s.coffinBearer.life as BarrenMatriarchSceneRoot;
  return e.yardId === 'CB3-NURSERY-TRANSFER' && e.ordinaryExit === 'OPEN' && e.enemyPosition === 'BETWEEN_A_AND_B' && e.enemyDistanceMetres === 2 && e.startRoot !== null && closedRoot(e.startRoot) && e.preparation !== null &&
    e.approachWeek === s.week && same(e.clearance, clearance(s.week)) && p.siteId === 'CB3-NURSERY-TRANSFER' && p.playerLocation === 'A' && p.owner.id === 'CB3-ADA' && p.owner.age === 46 && p.owner.location === 'OUTSIDE' && p.owner.alive &&
    p.recipient.id === 'CB3-LENA' && p.recipient.age === 39 && p.recipient.location === 'OUTSIDE' && p.recipient.alive && [...p.samples, p.box, p.tag, ...p.pads, p.paper].every(item => item.location === 'OUTSIDE') && oldHistoryUnchanged(s);
}
export function blockBarrenMatriarchEncounter(s: SliceState, c: BarrenMatriarchEncounterCommand): string | null {
  if (!validateBarrenMatriarchEncounterCommand(c)) return '遭遇命令无效。'; const e = s.barrenMatriarch.encounter;
  if (!stage(s) || s.status !== 'ACTIVE' || s.health <= 0 || s.barrenMatriarch.promotionWeek === null || !s.barrenMatriarch.guidanceKnown) return '须本人仍活着且完成荒芜主母晋升。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件、战斗或周账。'; if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德原苗圃。';
  if (!lifeReady(s)) return '先完成三份真实报告、收好原现场并反思。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' && actualCourt(s) || e.status === 'AVAILABLE' && e.preparation !== null && closedRoot(s.coffinBearer.life as BarrenMatriarchSceneRoot) ? null : '须有本次准备或真实到场，才能普通离开。';
  if (s.mind <= 0) return '先恢复精神；已准备后仍可普通退出。';
  if (c.type === 'PREPARE_ENCOUNTER') {
    if (e.status !== 'AVAILABLE' || e.preparation) return '已有本次准备或原人结局，不重复生成或重置。'; const end = replayBarrenMatriarchLifeRoot(s);
    if (!end || !same(end, s.coffinBearer.life) || !same(replayBarrenMatriarchLifeRootPad(s), s.barrenMatriarch.life.rootPad) || !closedRoot(end)) return '须保留原苗圃及所有旧身体、旧物与真实冲突记录。';
    return s.mind <= 2 ? '整理注意力需2精神并保持清醒。' : null;
  }
  if (s.actionsRemaining < 1) return '实际选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' || !e.preparation || !closedRoot(s.coffinBearer.life as BarrenMatriarchSceneRoot) ? '先准备并收好原物。' : s.actionsRemaining < 2 ? '交谈需1行动，另留1行动决定交战。' : null;
  return e.status === 'READY' && actualCourt(s) ? null : '须先询问此次离场意愿，让艾达与莉娜亲携原样本及原器材实际走到室外后交谈。';
}
export const barrenMatriarchEncounterReason = blockBarrenMatriarchEncounter;
export function applyBarrenMatriarchEncounterCommand(s: SliceState, c: BarrenMatriarchEncounterCommand, ctx: SeerContext): void {
  const reason = blockBarrenMatriarchEncounter(s, c); if (reason) throw new Error(reason); const e = s.barrenMatriarch.encounter;
  if (c.type === 'PREPARE_ENCOUNTER') {
    const before = barrenMatriarchEncounterBudget(s); s.mind -= 2; e.preparation = { week: s.week, date: { ...s.date }, revision: s.revision + 1, runId: s.runId, randomSeed: s.random.seed, randomCursor: s.random.cursor, mindPaid: 2,
      lifeJournalLength: s.barrenMatriarch.life.journal.length, lifeClockSeconds: s.coffinBearer.life.clockSeconds, before, after: barrenMatriarchEncounterBudget(s), finance: financeSnapshot(s) };
    e.originalEncounter = structuredClone(s.coffinBearer.encounter); e.originalHistory = structuredClone(s.combatHistory);
    ctx.note('核对原现场与普通出口', '实际付2精神；艾达、莉娜、原样本与原器材保持原位置。'); return;
  }
  if (c.type === 'LEAVE_ENCOUNTER') {
    if (e.status === 'READY') { leaveBarrenMatriarchCombatRoot(s.coffinBearer.life as BarrenMatriarchSceneRoot); if (s.barrenMatriarch.life.rootPad.holder === 'PLAYER') s.barrenMatriarch.life.rootPad.location = 'START'; } e.status = 'RESOLVED'; ctx.note('普通退出本次争议', e.startRoot ? '本人实际走4米、花4秒回原入口；原两人仍在室外，马丁及唯一原杖留苗圃。' : '本人原本就在入口，停止此次准备；已付2精神不退，没有凭空移动人物。'); return;
  }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') {
    e.startRoot = structuredClone(s.coffinBearer.life) as BarrenMatriarchSceneRoot; e.clearance = clearance(s.week); s.coffinBearer.life = barrenMatriarchApproachedRoot(e.startRoot, s.week) as SliceState['coffinBearer']['life']; s.barrenMatriarch.life.rootPad = approachedPlate(e.preparation!.after.rootPad);
    e.status = 'READY'; e.approachWeek = s.week; e.approachRevision = s.revision + 1;
    ctx.note('两位原人同意后亲自离场', '艾达明确同意后，亲携当前照管的第二株原苗、原枯样及原器材从A经入口走8米8秒到室外；莉娜同意后亲携第一株原苗从B经A和入口走12米12秒到室外；本人再走4米4秒到A，与2米外马丁交谈。'); return;
  }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'BARREN_MATRIARCH_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  const source = currentBarrenMatriarchCombatSource(s); if (!source) throw new Error('原人、原杖和真实原资源来源不完整。'); e.startSource = { ...source, revision: s.revision + 1 };
  ctx.note('原马丁的有限真实冲突', '实际付1行动，双方保留自己的身体、独立心智和原物。有限休眠不用于人类；根系缓冲只以实持原根垫应对随后一次真实身体击打，旧护腕只用真实剩余段。');
}
export const applyBarrenMatriarchEncounter = applyBarrenMatriarchEncounterCommand;
export const handleBarrenMatriarchEncounter = applyBarrenMatriarchEncounterCommand;
export function startBarrenMatriarchEncounter(s: SliceState, ctx: SeerContext): void { applyBarrenMatriarchEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasBarrenMatriarchDisputeOpponent(s: SliceState): boolean {
  const e = s.barrenMatriarch?.encounter, c = s.combat;
  return stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && lifeReady(s) && s.barrenMatriarch.guidanceKnown && s.barrenMatriarch.promotionWeek !== null &&
    !!e && e.status === 'FIGHTING' && e.targetId === BARREN_MATRIARCH_TARGET_ID && e.terminal === null && actualCourt(s) && e.attemptWeek === s.week && validBarrenMatriarchBody(e, (c?.round ?? 1) - 1) &&
    c?.encounterId === 'BARREN_MATRIARCH_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && e.enemyStatus === 'RESISTING' && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind &&
    same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk && integer(c.round, 1) && e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
function terminalRoot(o: BarrenMatriarchRoundOutcome): { root: BarrenMatriarchSceneRoot; exit: 0 | 4 } {
  const root = structuredClone(o.rootAfter), exit = o.playerHealthAfter > 0 ? 4 : 0; if (exit) leaveBarrenMatriarchCombatRoot(root); return { root, exit };
}
export function settleBarrenMatriarchEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.barrenMatriarch.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'BARREN_MATRIARCH_DISPUTE') throw new Error('没有这场原苗圃冲突。'); if (outcome === 'CONTINUE') return;
  const last = c.lastRound, o = last?.barrenMatriarchOutcome;
  if (!last || !o || !validateBarrenMatriarchRoundOutcome(o) || !validateBarrenMatriarchCombatRound(last) || o.continuing || e.terminal || e.startHistoryIndex === null || c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round ||
    !same(s.combatHistory.at(-1), last) || !same(combatBody(e), combatBody(o)) || !same(o.rootAfter, s.coffinBearer.life) || o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality || !same(o.rootPadAfter, s.barrenMatriarch.life.rootPad) || !same(o.masteryAfter, s.progression.mastery) ||
    !same(o.playerInjuriesAfter, s.injuries) || o.playerRiskAfter !== s.injuryRisk || o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || !same(o.enemyInjuries, c.enemyInjuries) || o.enemyRisk !== c.enemyRisk || o.enemyStatus !== c.enemyStatus ||
    outcome !== (o.playerHealthAfter === 0 ? 'PLAYER_DEAD' : o.enemyHealth === 0 ? 'ENEMY_DEAD' : o.enemyStatus === 'SURRENDERED' ? 'ENEMY_SURRENDERED' : 'RETREATED')) throw new Error('结局与真实回合、原身体、原物及已花资源不一致。');
  const final = terminalRoot(o); s.coffinBearer.life = final.root as SliceState['coffinBearer']['life']; if (final.exit && s.barrenMatriarch.life.rootPad.holder === 'PLAYER') s.barrenMatriarch.life.rootPad.location = 'START';
  e.terminal = { outcome: outcome as BarrenMatriarchEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, exitMetres: final.exit, exitSeconds: final.exit };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('原马丁冲突结束', `${final.exit ? '本人活着沿原路走4米4秒回入口。' : '本人的原身体真实死亡并留在A，不复活或搬移。'}艾达与莉娜及原样本器材仍在室外，马丁原杖保留最后实际位置；原伤与已花费用不退。`);
}
export const finishBarrenMatriarchEncounter = settleBarrenMatriarchEncounter;
export function barrenMatriarchEncounterActions(s: SliceState): BarrenMatriarchEncounterAction[] {
  if (!stage(s)) return [];
  return ([['PREPARE_ENCOUNTER', '核对注意力与普通出口', '2精神；0行动'], ['ENCOUNTER_TALK', '请两位原人离场后交谈', '1行动；实际24秒'], ['ENCOUNTER_FIGHT', '选择与马丁交战', '1行动；真实伤势与死亡风险'], ['LEAVE_ENCOUNTER', '普通退出本次争议', '0行动；到场后4米4秒']] as const).map(([type, label, cost]) => {
    const command: BarrenMatriarchEncounterCommand = { type }, reason = blockBarrenMatriarchEncounter(s, command); return { id: `barrenMatriarch-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectBarrenMatriarchEncounter(s: SliceState): BarrenMatriarchEncounterProjection {
  const e = s.barrenMatriarch.encounter, p = s.coffinBearer.life as BarrenMatriarchSceneRoot;
  if (!stage(s)) return { title: '尚未开放的苗圃争议', story: '', status: e.status, inside: false, preparation: null, scene: null, enemy: null, pendingKind: null, composureReady: false, actions: [], facts: [] };
  return { title: '马丁的苗圃器材争议', story: BARREN_MATRIARCH_ENCOUNTER_STORY, status: e.status, inside: hasBarrenMatriarchEncounterLock(s), preparation: e.preparation ? { week: e.preparation.week, mindPaid: 2 } : null,
    scene: { courtId: 'CB3-NURSERY-TRANSFER', playerLocation: p.playerLocation, ownerLocation: p.owner.location, recipientLocation: p.recipient.location, ordinaryExit: 'OPEN', distanceMetres: p.playerLocation === 'START' ? 6 : 2, clockSeconds: p.clockSeconds, playerTravelMetres: p.playerTravelMetres },
    enemy: { id: e.targetId, name: '马丁·里德', age: 45, pathway: 'original-caster', sequence: 3, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus, weaponId: 'BM2-MARTIN-ROD', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses }, abilities: BARREN_MATRIARCH_POWERS.map(x => x.label) },
    pendingKind: e.pendingKind, composureReady: e.composureReady, actions: barrenMatriarchEncounterActions(s), facts: [
      '艾达和莉娜分别同意后，亲携自己当前照管的原样本及原器材步行到室外；同一原枯样仍然死亡。',
      '有限休眠只适用仍活原植物，不能催眠、控制人类或让死人复活，因此不在本场对人能力盘中。',
      '根系缓冲6灵性1精神、意志20；同一实持原根垫30秒内下一次普通身体击打最多减45，原垫磨损15，不防弧光或精神。',
      '旧护腕仅消耗真实剩余段，失败照耗、不得补段；有限保全的两次×0.8与活性基质的一次×0.6保持原费用和边界。自主凝神不能清除实体护持。',
      '身体与精神后果按实际来源分别结算。旧诺兰身体、原杖、状态和全部旧记录保持原样；原人死亡绝不重新生成。普通出口开放，只有活着才能离开。' ] };
}
/** Reconcile the shared financial pulse from its original frozen input, including
 * interrupted bills and debt notices. Combat resources never receive exemptions. */
export function barrenMatriarchTerminalBudgetMatches(s: SliceState, prep: BarrenMatriarchPreparation, o: BarrenMatriarchRoundOutcome): boolean {
  if (!same(s.character.coreStats, prep.after.coreStats) || s.character.gender !== prep.after.gender || s.seer.pollution !== prep.after.pollution || s.progression.acting !== prep.after.acting || !same(s.seer.completedSources, prep.after.completedSources) || s.health !== o.playerHealthAfter || s.mind !== o.playerMindAfter || s.spirituality !== o.playerSpiritualityAfter || !same(s.barrenMatriarch.life.rootPad, terminalPlate(o)) || !same(s.progression.mastery, o.masteryAfter) || !same(s.coffinBearer.life.guard, o.rootAfter.guard) ||
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
    const terminalIndex = s.chronicle.findIndex((entry, index) => entry.id === `record-${s.revision}-${index}` && entry.title === '原马丁冲突结束');
    const eventIndex = terminalIndex + 1 + result.receipts.length;
    return terminalIndex >= 0 && s.eventQueue.length === 0 && same(s.activeEvent, { id: result.eventId, instanceId: `${s.runId}:${result.eventId}:${s.revision}:${eventIndex}` });
  }
  return true;
}
/** Replays the exact seed, cursor, source, per-slot costs and original physical positions. */
export function replayBarrenMatriarchEncounterRoot(s: SliceState, lifeEnd: BarrenMatriarchSceneRoot): BarrenMatriarchSceneRoot | null {
  try {
    const e = s.barrenMatriarch?.encounter, initial = createBarrenMatriarchEncounterState();
    if (!e || !shape(e, Object.keys(initial)) || e.targetId !== BARREN_MATRIARCH_TARGET_ID || e.yardId !== initial.yardId || e.ordinaryExit !== 'OPEN' || e.enemyPosition !== initial.enemyPosition || e.enemyDistanceMetres !== 2 || !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status)) return null;
    const allNew = s.combatHistory.flatMap((r, i) => r.barrenMatriarchOutcome ? [i] : []);
    if (!e.preparation) return same(e, initial) && allNew.length === 0 && s.combat?.encounterId !== 'BARREN_MATRIARCH_DISPUTE' ? structuredClone(lifeEnd) : null;
    const prep = e.preparation;
    if (!stage(s) || !s.barrenMatriarch.guidanceKnown || s.barrenMatriarch.promotionWeek === null || !validateBarrenMatriarchPreparation(prep) || prep.runId !== s.runId || prep.randomSeed !== s.random.seed || prep.randomCursor > s.random.cursor ||
      !integer(prep.week, s.barrenMatriarch.promotionWeek, s.week) || compareGameDates(prep.date, s.date) > 0 || !integer(prep.revision, 1, s.revision) || prep.lifeJournalLength !== s.barrenMatriarch.life.journal.length || prep.lifeClockSeconds !== lifeEnd.clockSeconds || !lifeReady(s) || !closedRoot(lifeEnd) || !oldHistoryUnchanged(s)) return null;
    if (hasBarrenMatriarchEncounterLock(s) && (!same(financeSnapshot(s), prep.finance) || s.pulse !== 'NONE' || s.billAmount !== 0 || s.activeEvent !== null || s.eventQueue.length !== 0)) return null;
    const lastLife = s.barrenMatriarch.life.journal.at(-1);
    if (!lastLife || prep.revision <= lastLife.revision + 1 || prep.week < lastLife.week) return null;
    if (prep.revision === lastLife.revision + 2 && prep.week === lastLife.week) {
      const b = lastLife.budget;
      if (prep.before.actions !== b.actionsAfter || prep.before.health !== b.healthAfter || prep.before.mind !== b.mindAfter || prep.before.spirituality !== b.spiritualityAfter || prep.before.cash !== b.cashAfter ||
        !same(prep.date, lastLife.date) || prep.randomCursor !== (lastLife.randomAfter ?? lastLife.randomCursor)) return null;
    }
    const prepared = { ...initial, preparation: prep, originalEncounter: e.originalEncounter, originalHistory: e.originalHistory };
    if (e.startRoot === null) {
      if (!['AVAILABLE', 'RESOLVED'].includes(e.status) || !same({ ...e, status: 'AVAILABLE' }, prepared) || allNew.length || s.combat?.encounterId === 'BARREN_MATRIARCH_DISPUTE') return null;
      if (e.status === 'AVAILABLE' && (s.week !== prep.week || !same(s.date, prep.date) || s.random.cursor !== prep.randomCursor || !same(barrenMatriarchEncounterBudget(s), prep.after) || s.status !== 'ACTIVE')) return null;
      return structuredClone(lifeEnd);
    }
    if (e.approachWeek !== prep.week || e.approachRevision !== prep.revision + 1 || !integer(e.approachRevision, 1, s.revision) || !same(e.startRoot, lifeEnd) || !same(e.clearance, clearance(e.approachWeek))) return null;
    const approached = barrenMatriarchApproachedRoot(lifeEnd, e.approachWeek), afterTalk = { ...prep.after, actions: prep.after.actions - 1, rootPad: approachedPlate(prep.after.rootPad) };
    const talking = { ...prepared, status: e.status, approachWeek: e.approachWeek, approachRevision: e.approachRevision, startRoot: e.startRoot, clearance: e.clearance };
    if (e.startHistoryIndex === null) {
      const ready = e.status === 'READY', peaceful = e.status === 'RESOLVED', root = structuredClone(approached); if (peaceful) leaveBarrenMatriarchCombatRoot(root);
      if (!(ready || peaceful) || !same(e, talking) || allNew.length || s.combat?.encounterId === 'BARREN_MATRIARCH_DISPUTE') return null;
      if (ready && (s.week !== prep.week || !same(s.date, prep.date) || s.random.cursor !== prep.randomCursor || !same(barrenMatriarchEncounterBudget(s), afterTalk) || s.status !== 'ACTIVE')) return null;
      return root;
    }
    const start = e.startSource;
    if (!integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.startHistoryIndex !== e.originalHistory!.length || e.attemptWeek !== e.approachWeek || !start || !validBarrenMatriarchCombatSource(start) || start.round !== 1 || !same(start.root, approached) || !same(start.preparation, prep) || start.runId !== s.runId || start.targetId !== e.targetId ||
      start.randomSeed !== s.random.seed || start.attemptWeek !== e.attemptWeek || start.startHistoryIndex !== e.startHistoryIndex || start.revision !== e.approachRevision + 1 || start.revision > s.revision || start.randomCursor !== prep.randomCursor || !same(start.body, initialBody())) return null;
    if (start.playerHealth !== prep.after.health || start.playerMind !== prep.after.mind || start.playerSpirituality !== prep.after.spirituality || !same(start.rootPad, approachedPlate(prep.after.rootPad)) || !same(start.mastery, prep.after.mastery) || !same(start.root.guard, prep.after.guard) || !same(start.playerInjuries, prep.after.injuries) || start.playerRisk !== prep.after.injuryRisk ||
      !same({ physique: start.physique, perception: start.perception, will: start.will, knowledge: start.knowledge }, prep.after.coreStats)) return null;
    const terminal = e.terminal;
    if (terminal && (!shape(terminal, ['outcome', 'round', 'historyIndex', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'exitMetres', 'exitSeconds']) || !integer(terminal.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1))) return null;
    const end = terminal ? terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    if (!same(allNew, rounds.map((_r, i) => e.startHistoryIndex! + i))) return null;
    let root = approached;
    for (const [i, round] of rounds.entries()) {
      const o = round.barrenMatriarchOutcome, previous = rounds[i - 1]?.barrenMatriarchOutcome;
      if (!o || !validateBarrenMatriarchCombatRound(round) || round.round !== i + 1 || o.source.revision >= s.revision || o.randomCursorAfter > s.random.cursor || !same(o.source, previous ? nextBarrenMatriarchCombatSource(previous) : start) || !same(o.source.root, root) || i < rounds.length - 1 && !o.continuing) return null;
      root = structuredClone(o.rootAfter);
    }
    const last = rounds.at(-1), o = last?.barrenMatriarchOutcome;
    if (e.status === 'FIGHTING') {
      if (terminal !== null || !hasBarrenMatriarchDisputeOpponent(s) || !same(combatBody(e), o ? combatBody(o) : start.body)) return null;
      if (s.actionsRemaining !== prep.after.actions - 2 || s.cash !== prep.after.cash || !same(s.character.coreStats, prep.after.coreStats) || s.character.gender !== prep.after.gender || !same(s.progression.mastery, o ? o.masteryAfter : prep.after.mastery) || !same(s.barrenMatriarch.life.rootPad, o ? o.rootPadAfter : start.rootPad) || s.seer.pollution !== prep.after.pollution || s.progression.acting !== prep.after.acting || !same(s.seer.completedSources, prep.after.completedSources)) return null;
      return o ? o.continuing && same(last, s.combat!.lastRound) && same(currentBarrenMatriarchCombatSource(s), nextBarrenMatriarchCombatSource(o)) ? root : null : s.combat!.lastRound === null && same(currentBarrenMatriarchCombatSource(s), start) ? root : null;
    }
    if (s.combat?.encounterId === 'BARREN_MATRIARCH_DISPUTE' || !terminal || !last || !o || o.continuing || terminal.round !== last.round || rounds.length !== terminal.round || !same(combatBody(e), combatBody(o)) || terminal.enemyHealth !== e.enemyHealth || terminal.enemyMind !== e.enemyMind || terminal.enemySpirituality !== e.enemySpirituality || terminal.enemyStatus !== e.enemyStatus) return null;
    const final = terminalRoot(o); if (terminal.exitMetres !== final.exit || terminal.exitSeconds !== final.exit) return null;
    if (s.revision === o.source.revision + 1 && !barrenMatriarchTerminalBudgetMatches(s, prep, o)) return null;
    if (terminal.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 ? final.root : null;
    if (terminal.outcome === 'RETREATED') return e.status === 'RETREATED' && o.playerHealthAfter > 0 && (last.retreat === 'SUCCESS' || o.playerMindAfter === 0) ? final.root : null;
    return e.status === 'RESOLVED' && o.playerHealthAfter > 0 && (terminal.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : terminal.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED') ? final.root : null;
  } catch { return null; }
}
export function validateBarrenMatriarchEncounter(s: SliceState): boolean {
  try { const end = replayBarrenMatriarchLifeRoot(s); if (!end) return same(s.barrenMatriarch.encounter, createBarrenMatriarchEncounterState()) && s.barrenMatriarch.life.source === null && !s.combatHistory.some(r => r.barrenMatriarchOutcome) && s.combat?.encounterId !== 'BARREN_MATRIARCH_DISPUTE';
    const root = replayBarrenMatriarchEncounterRoot(s, end), plate = replayBarrenMatriarchLifeRootPad(s); return root !== null && same(root, s.coffinBearer.life) && plate !== null && same(replayBarrenMatriarchEncounterRootPad(s, plate), s.barrenMatriarch.life.rootPad);
  } catch { return false; }
}
export const validateBarrenMatriarchEncounterState = validateBarrenMatriarchEncounter;
