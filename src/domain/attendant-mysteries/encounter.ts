import { SLICE_LIFE } from '../../content/slice-events.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { compareGameDates, isValidGameDate } from '../game-calendar.js';
import { hasAncientScholarPastSample, type AncientScholarPastSample } from '../ancient-scholar/life.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceCombatRound, SliceInjury, SliceState } from '../slice/types.js';
import { currentAttendantMysteriesCombatSource, nextAttendantMysteriesCombatSource, validAttendantMysteriesCombatSource,
  validateAttendantMysteriesCombatRound, validAttendantMysteriesBody, validAttendantMysteriesInjuries,
  type AttendantMysteriesCombatSource, type AttendantMysteriesRoundOutcome } from './combat.js';

export const ATTENDANT_MYSTERIES_TARGET_ID = 'AM1-ELIAS-VALE' as const;
export const ATTENDANT_MYSTERIES_SITE = 'AM1-WORKSHOP-CLEARING' as const;
export const ATTENDANT_MYSTERIES_POWER_IDS = ['ARC_BOLT', 'WARD', 'COMPOSE', 'MENTAL_PRESSURE'] as const;
export type AttendantMysteriesPowerId = typeof ATTENDANT_MYSTERIES_POWER_IDS[number];
export type AttendantMysteriesEnemyIntent = AttendantMysteriesPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export type AttendantMysteriesPendingKind = 'GRAFT' | 'REALM';
export const ATTENDANT_MYSTERIES_POWERS = [
  { id: 'ARC_BOLT', label: '有限银弧', cost: 6, selfGain: 85, enemyReduction: 0 },
  { id: 'WARD', label: '有限屏护', cost: 5, selfGain: 0, enemyReduction: 50 },
  { id: 'COMPOSE', label: '自主凝神辨认', cost: 4, selfGain: 8, enemyReduction: 0 },
  { id: 'MENTAL_PRESSURE', label: '有限精神施压', cost: 5, selfGain: 45, enemyReduction: 0 },
] as const;
export interface AttendantMysteriesRemnant {
  id: 'AM1-REMNANT-1'; sourceId: 'AM1-TANNER-STOCK-1'; animal: 'ADULT_GOAT'; quantity: 1;
  owner: 'SUPPLIER' | 'PLAYER'; holder: 'SUPPLIER' | 'PLAYER'; location: 'WORKSHOP' | 'CLEARING';
  alive: false; health: 0; independentMind: false; threadsPreviouslyLost: true; lostThreadsEvidence: string | null;
  acquiredWeek: number | null; pricePaid: 0 | 30; segments: { id: string; status: 'UNUSED' | 'SPENT' }[];
}
export interface AttendantMysteriesScene {
  siteId: typeof ATTENDANT_MYSTERIES_SITE; playerLocation: 'WORKSHOP' | 'CLEARING';
  playerCoordinate: 0 | 12; enemyCoordinate: 14; groundCoordinate: 18; ordinaryExit: 'OPEN';
  groundEmpty: true; thirdPartiesInArea: 0; residentsLocation: 'TOWN'; residentsJoined: 0;
  observedSourceId: string | null; observationWeek: number | null; clockSeconds: number; externalSeconds: number; playerTravelMetres: number;
}
export interface AttendantMysteriesCombatBody {
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  weaponLocation: 'HAND' | 'CLEARING'; powerUses: Record<AttendantMysteriesPowerId, number>;
  pendingKind: AttendantMysteriesPendingKind | null; composureReady: boolean;
  regenerationAttempts: number; graftAttempts: number; realmAttempts: number;
}
export function initialAttendantMysteriesBody(): AttendantMysteriesCombatBody {
  return { enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0, weaponLocation: 'HAND',
    powerUses: { ARC_BOLT: 0, WARD: 0, COMPOSE: 0, MENTAL_PRESSURE: 0 }, pendingKind: null, composureReady: false, regenerationAttempts: 0, graftAttempts: 0, realmAttempts: 0 };
}
export function combatBody(e: AttendantMysteriesCombatBody): AttendantMysteriesCombatBody {
  return Object.fromEntries(Object.keys(initialAttendantMysteriesBody()).map(k => [k, structuredClone(e[k as keyof AttendantMysteriesCombatBody])])) as unknown as AttendantMysteriesCombatBody;
}
export function createAttendantMysteriesRemnant(): AttendantMysteriesRemnant {
  return { id: 'AM1-REMNANT-1', sourceId: 'AM1-TANNER-STOCK-1', animal: 'ADULT_GOAT', quantity: 1, owner: 'SUPPLIER', holder: 'SUPPLIER', location: 'WORKSHOP',
    alive: false, health: 0, independentMind: false, threadsPreviouslyLost: true, lostThreadsEvidence: null, acquiredWeek: null, pricePaid: 0,
    segments: [1, 2, 3].map(n => ({ id: `AM1-REMNANT-1-SEGMENT-${n}`, status: 'UNUSED' })) };
}
export function createAttendantMysteriesScene(): AttendantMysteriesScene {
  return { siteId: ATTENDANT_MYSTERIES_SITE, playerLocation: 'WORKSHOP', playerCoordinate: 0, enemyCoordinate: 14, groundCoordinate: 18, ordinaryExit: 'OPEN',
    groundEmpty: true, thirdPartiesInArea: 0, residentsLocation: 'TOWN', residentsJoined: 0, observedSourceId: null, observationWeek: null,
    clockSeconds: 0, externalSeconds: 0, playerTravelMetres: 0 };
}
export type AttendantMysteriesFinanceSnapshot = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface AttendantMysteriesEncounterBudget {
  cash: number; actions: number; health: number; mind: number; spirituality: number; pollution: number; gender: string; sequence: 1;
  acting: number; coreStats: SliceState['character']['coreStats']; mastery: Record<string, number>; completedSources: string[]; injuries: SliceInjury[]; injuryRisk: number;
}
export interface AttendantMysteriesPreparation {
  week: number; date: PublicGameDate; revision: number; runId: string; randomSeed: string; randomCursor: number; pricePaid: 30; actionsPaid: 1;
  lifeReflected: true; before: AttendantMysteriesEncounterBudget; after: AttendantMysteriesEncounterBudget; finance: AttendantMysteriesFinanceSnapshot;
  pastSample: AncientScholarPastSample | null; pastSampleObservedWeek: number | null;
}
export interface AttendantMysteriesEncounterJournal {
  command: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER'; week: number; date: PublicGameDate; revision: number; randomCursor: number;
  before: AttendantMysteriesEncounterBudget; after: AttendantMysteriesEncounterBudget; finance: AttendantMysteriesFinanceSnapshot;
  sceneBefore: AttendantMysteriesScene; sceneAfter: AttendantMysteriesScene;
}
export interface AttendantMysteriesEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: AttendantMysteriesCombatBody['enemyStatus']; exitMetres: 0 | 12; exitSeconds: 0 | 12;
}
export interface AttendantMysteriesEncounterState extends AttendantMysteriesCombatBody {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof ATTENDANT_MYSTERIES_TARGET_ID;
  preparation: AttendantMysteriesPreparation | null; attemptWeek: number | null; startHistoryIndex: number | null;
  startSource: AttendantMysteriesCombatSource | null; originalHistory: SliceCombatRound[] | null; originalResources: string | null;
  scene: AttendantMysteriesScene; remnant: AttendantMysteriesRemnant; journal: AttendantMysteriesEncounterJournal[]; terminal: AttendantMysteriesEncounterTerminal | null;
}
export type AttendantMysteriesEncounterCommand = { type: 'PREPARE_ENCOUNTER' | 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface AttendantMysteriesEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: AttendantMysteriesEncounterCommand }
export function createAttendantMysteriesEncounterState(): AttendantMysteriesEncounterState {
  return { ...initialAttendantMysteriesBody(), status: 'AVAILABLE', targetId: ATTENDANT_MYSTERIES_TARGET_ID, preparation: null, attemptWeek: null, startHistoryIndex: null,
    startSource: null, originalHistory: null, originalResources: null, scene: createAttendantMysteriesScene(), remnant: createAttendantMysteriesRemnant(), journal: [], terminal: null };
}
export const createAttendantMysteriesEncounter = createAttendantMysteriesEncounterState;
export const isAttendantMysteriesEncounterStage = (s: SliceState) => s.progression.pathwayId === 'diviner' && s.progression.sequence === 1;
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
export function attendantMysteriesFinanceSnapshot(s: AttendantMysteriesFinanceSnapshot): AttendantMysteriesFinanceSnapshot {
  return { weeklyBudget: s.weeklyBudget, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: structuredClone(s.debts), missedWeeks: s.missedWeeks, credit: s.credit };
}
function validFinance(v: AttendantMysteriesFinanceSnapshot, week: number): boolean {
  return shape(v, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit']) && integer(v.weeklyBudget, 1, 100) && Object.hasOwn(SLICE_LIFE, v.lifeTier) && Object.hasOwn(SLICE_LIFE, v.nextLifeTier) &&
    integer(v.missedWeeks) && ['NORMAL', 'NOTICE', 'SUSPENDED'].includes(v.credit) && Array.isArray(v.debts) && v.debts.every(d => shape(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek']) &&
      typeof d.id === 'string' && !!d.id && typeof d.source === 'string' && !!d.source && integer(d.remaining) && integer(d.weeklyPayment, 1) && integer(d.createdWeek, 0, week));
}
export function attendantMysteriesEncounterBudget(s: SliceState): AttendantMysteriesEncounterBudget {
  return { cash: s.cash, actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution, gender: s.character.gender,
    sequence: 1, acting: s.progression.acting, coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources], injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function validBudget(v: AttendantMysteriesEncounterBudget, revision: number): boolean {
  return shape(v, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) && integer(v.cash) &&
    integer(v.actions, 0, 100) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.pollution, 0, 100) && typeof v.gender === 'string' && v.sequence === 1 && integer(v.acting, 0, 100) &&
    shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) && Object.values(v.coreStats).every(n => integer(n, 0, 500)) && !!v.mastery && typeof v.mastery === 'object' && !Array.isArray(v.mastery) && Object.values(v.mastery).every(n => integer(n, 0, 500)) &&
    Array.isArray(v.completedSources) && v.completedSources.every(x => typeof x === 'string' && !!x) && new Set(v.completedSources).size === v.completedSources.length && validAttendantMysteriesInjuries(v.injuries, revision) && integer(v.injuryRisk);
}
export function validateAttendantMysteriesPreparation(v: unknown): v is AttendantMysteriesPreparation {
  try { const p = v as AttendantMysteriesPreparation, a = p.pastSample;
    return shape(p, ['week', 'date', 'revision', 'runId', 'randomSeed', 'randomCursor', 'pricePaid', 'actionsPaid', 'lifeReflected', 'before', 'after', 'finance', 'pastSample', 'pastSampleObservedWeek']) &&
      integer(p.week, 1) && isValidGameDate(p.date) && integer(p.revision, 1) && typeof p.runId === 'string' && !!p.runId && typeof p.randomSeed === 'string' && !!p.randomSeed && integer(p.randomCursor) &&
      p.pricePaid === 30 && p.actionsPaid === 1 && p.lifeReflected === true && validBudget(p.before, p.revision) && validBudget(p.after, p.revision) && validFinance(p.finance, p.week) && p.before.actions >= 3 && p.before.actions <= Math.max(4, p.finance.weeklyBudget) && p.before.cash >= 30 &&
      same(p.after, { ...p.before, cash: p.before.cash - 30, actions: p.before.actions - 1 }) && (a === null ? p.pastSampleObservedWeek === null :
        shape(a, ['id', 'bodyId', 'revision', 'week', 'sequence', 'spirituality', 'health', 'mind', 'airBulletKnown', 'airBulletGain', 'source']) && a.id === `${p.runId}:AS3-SAMPLE:${a.revision}` && a.bodyId === `${p.runId}:body` &&
        a.source === 'ACTUAL_RECEPTION_OBSERVATION' && a.sequence === 3 && integer(a.revision, 0, p.revision) && integer(a.week, 1, p.week) && p.pastSampleObservedWeek === a.week && integer(a.spirituality, 0, 120) && integer(a.health, 1, 100) && integer(a.mind, 1, 100) && typeof a.airBulletKnown === 'boolean' && a.airBulletGain === 60);
  } catch { return false; }
}
export function validAttendantMysteriesRemnant(v: AttendantMysteriesRemnant, prep: AttendantMysteriesPreparation | null): boolean {
  const initial = createAttendantMysteriesRemnant();
  if (!shape(v, Object.keys(initial))) return false;
  if (!prep) return same(v, initial);
  return same({ ...v, owner: initial.owner, holder: initial.holder, location: initial.location, acquiredWeek: null, pricePaid: 0, lostThreadsEvidence: null, segments: initial.segments }, initial) &&
    v.owner === 'PLAYER' && v.holder === 'PLAYER' && ['WORKSHOP', 'CLEARING'].includes(v.location) && v.acquiredWeek === prep.week && v.pricePaid === 30 && v.lostThreadsEvidence === `${prep.runId}:AM1-LOST-THREADS:${prep.revision}` &&
    v.segments.length === 3 && v.segments.every((p, i) => shape(p, ['id', 'status']) && p.id === initial.segments[i]!.id && ['UNUSED', 'SPENT'].includes(p.status));
}
export function validAttendantMysteriesScene(p: AttendantMysteriesScene): boolean {
  const initial = createAttendantMysteriesScene();
  return shape(p, Object.keys(initial)) && same({ ...p, playerLocation: initial.playerLocation, playerCoordinate: initial.playerCoordinate, observedSourceId: null, observationWeek: null, clockSeconds: 0, externalSeconds: 0, playerTravelMetres: 0 }, initial) &&
    (p.playerLocation === 'WORKSHOP' && p.playerCoordinate === 0 || p.playerLocation === 'CLEARING' && p.playerCoordinate === 12) &&
    integer(p.clockSeconds) && p.externalSeconds === p.clockSeconds && integer(p.playerTravelMetres) && (p.observedSourceId === null ? p.observationWeek === null : typeof p.observedSourceId === 'string' && integer(p.observationWeek, 1));
}
function protectedOriginals(s: SliceState): string {
  return stableStringify({ ancientScholar: s.ancientScholar, miracleWorker: s.miracleWorker, bizarroSorcerer: s.bizarroSorcerer, magician: s.magician,
    town: s.town, life: s.attendantMysteries.life, newTown: s.attendantMysteries.town });
}
function originalsUnchanged(s: SliceState): boolean {
  const e = s.attendantMysteries.encounter;
  return e.originalResources === protectedOriginals(s) && Array.isArray(e.originalHistory) && same(e.originalHistory, s.combatHistory.slice(0, e.originalHistory.length));
}
export function validateAttendantMysteriesEncounterCommand(v: unknown): v is AttendantMysteriesEncounterCommand {
  return shape(v, ['type']) && ['PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type));
}
export const isAttendantMysteriesEncounterCommand = validateAttendantMysteriesEncounterCommand;
export const hasAttendantMysteriesEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.attendantMysteries.encounter.status) || s.attendantMysteries.encounter.status === 'AVAILABLE' && s.attendantMysteries.encounter.preparation !== null;
export const isInsideAttendantMysteriesEncounter = hasAttendantMysteriesEncounterLock;
export function blockAttendantMysteriesEncounter(s: SliceState, c: AttendantMysteriesEncounterCommand): string | null {
  if (!validateAttendantMysteriesEncounterCommand(c)) return '遭遇命令无效。'; const e = s.attendantMysteries.encounter;
  if (!isAttendantMysteriesEncounterStage(s) || s.attendantMysteries.promotionWeek === null || s.status !== 'ACTIVE' || s.health <= 0) return '须本人仍活着并完成诡秘侍者晋升。';
  if (s.combat) return '先处理当前战斗。';
  if (!s.attendantMysteries.life.reflected) return '先完成三份生活报告与反思，收束原现场。';
  // The ordinary exit remains available at zero AP and while a weekly bill is pending.
  if (c.type === 'LEAVE_ENCOUNTER') return e.preparation && ['AVAILABLE', 'READY'].includes(e.status) && originalsUnchanged(s) ? null : '须有这次实际准备或到场记录。';
  if (s.activeEvent || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件或周账。';
  if (s.mind <= 0 || s.actionsRemaining < 1) return '需要保持清醒并有1次行动；已准备后仍可普通退出。';
  if (c.type === 'PREPARE_ENCOUNTER' && s.actionsRemaining < 3) return '请先在当代接待处备足3行动，分别用于购买、到场和决定交战；本次购买仍只扣1行动。';
  if (c.type === 'PREPARE_ENCOUNTER') return e.status !== 'AVAILABLE' || e.preparation ? '原材料和原人只有这一份，不能重复准备或重置。' : s.cash < 30 ? '购买唯一原动物残料需要30便士。' : null;
  if (!e.preparation || !originalsUnchanged(s)) return '须保留已付购买、旧资源及原记录。';
  if (c.type === 'ENCOUNTER_TALK') return e.status === 'AVAILABLE' && e.scene.playerLocation === 'WORKSHOP' ? null : '先在工坊准备同一原材料。';
  return e.status === 'READY' && e.scene.playerLocation === 'CLEARING' && e.scene.observedSourceId !== null ? null : '先亲自步行12米到空地，观察同一原人及六米内空地落点并交谈。';
}
export const attendantMysteriesEncounterReason = blockAttendantMysteriesEncounter;
export function leaveAttendantMysteriesCombatScene(p: AttendantMysteriesScene): void {
  if (p.playerLocation !== 'CLEARING' || p.playerCoordinate !== 12) throw new Error('须从本人实际所在的空地离开。');
  p.playerLocation = 'WORKSHOP'; p.playerCoordinate = 0; p.playerTravelMetres += 12; p.clockSeconds += 12; p.externalSeconds += 12;
}
export function applyAttendantMysteriesEncounterCommand(s: SliceState, c: AttendantMysteriesEncounterCommand, ctx: SeerContext): void {
  const reason = blockAttendantMysteriesEncounter(s, c); if (reason) throw new Error(reason); const e = s.attendantMysteries.encounter;
  if (c.type === 'PREPARE_ENCOUNTER') {
    const before = attendantMysteriesEncounterBudget(s); s.cash -= 30; s.actionsRemaining--;
    const sample = hasAncientScholarPastSample(s) ? structuredClone(s.ancientScholar.life.sample) : null;
    e.preparation = { week: s.week, date: { ...s.date }, revision: s.revision + 1, runId: s.runId, randomSeed: s.random.seed, randomCursor: s.random.cursor, pricePaid: 30, actionsPaid: 1, lifeReflected: true,
      before, after: attendantMysteriesEncounterBudget(s), finance: attendantMysteriesFinanceSnapshot(s), pastSample: sample, pastSampleObservedWeek: sample?.week ?? null };
    e.originalHistory = structuredClone(s.combatHistory); e.originalResources = protectedOriginals(s);
    Object.assign(e.remnant, { owner: 'PLAYER', holder: 'PLAYER', acquiredWeek: s.week, pricePaid: 30, lostThreadsEvidence: `${s.runId}:AM1-LOST-THREADS:${s.revision + 1}` });
    ctx.note('购买并核验同一原动物残料', '实付30便士和1行动，从制革工坊购得同一成年山羊残料，亲自记录原灵体线已经丧失。原物只有三段可用材料，仍然死亡，没有意识；居民留在镇中。'); return;
  }
  const entry: AttendantMysteriesEncounterJournal = { command: c.type, week: s.week, date: { ...s.date }, revision: s.revision + 1, randomCursor: s.random.cursor,
    before: attendantMysteriesEncounterBudget(s), after: attendantMysteriesEncounterBudget(s), finance: attendantMysteriesFinanceSnapshot(s), sceneBefore: structuredClone(e.scene), sceneAfter: structuredClone(e.scene) };
  if (c.type === 'LEAVE_ENCOUNTER') {
    if (e.scene.playerLocation === 'CLEARING') leaveAttendantMysteriesCombatScene(e.scene);
    e.remnant.location = 'WORKSHOP'; e.status = 'RESOLVED';
    ctx.note('和平退出空地争议', '没有新增行动费用；本人若已到场，沿普通路线实际走12米、用12秒回工坊。埃利亚斯与原杖留在空地，居民仍在镇中，已付费用不退。');
  } else {
    s.actionsRemaining--;
    if (c.type === 'ENCOUNTER_TALK') {
      Object.assign(e.scene, { playerLocation: 'CLEARING', playerCoordinate: 12, observedSourceId: `${s.runId}:AM1-CLEARING:${s.revision + 1}`, observationWeek: s.week });
      e.scene.clockSeconds += 12; e.scene.externalSeconds += 12; e.scene.playerTravelMetres += 12; e.remnant.location = 'CLEARING'; e.status = 'READY';
      ctx.note('亲自到空地核对并交谈', '实付1行动并步行12米12秒，确认埃利亚斯距本人2米、空地落点距本人6米，路线开放且无人。对方可以拒绝交涉；你也可以和平离开。镇中居民没有随行。');
    } else {
      e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
      s.combat = { encounterId: 'ATTENDANT_MYSTERIES_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
      ctx.note('埃利亚斯的有限空地冲突', '实付1行动。埃利亚斯是47岁独立成人、序列2非凡者，自有健康100、精神100、灵性120和唯一手杖。有限嫁接及诡秘之境只依这次原现场，不免除精神或死亡后果。');
    }
  }
  entry.after = attendantMysteriesEncounterBudget(s); entry.sceneAfter = structuredClone(e.scene); e.journal.push(entry);
  if (c.type === 'ENCOUNTER_FIGHT') { const source = currentAttendantMysteriesCombatSource(s); if (!source) throw new Error('真实来源不完整。'); e.startSource = { ...source, revision: s.revision + 1 }; }
}
export const applyAttendantMysteriesEncounter = applyAttendantMysteriesEncounterCommand;
export const handleAttendantMysteriesEncounter = applyAttendantMysteriesEncounterCommand;
export function startAttendantMysteriesEncounter(s: SliceState, ctx: SeerContext): void { applyAttendantMysteriesEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasAttendantMysteriesDisputeOpponent(s: SliceState): boolean {
  const e = s.attendantMysteries?.encounter, c = s.combat;
  return isAttendantMysteriesEncounterStage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && s.attendantMysteries.life.reflected && s.attendantMysteries.promotionWeek !== null &&
    !!e && e.status === 'FIGHTING' && e.targetId === ATTENDANT_MYSTERIES_TARGET_ID && e.terminal === null && e.preparation !== null && originalsUnchanged(s) && e.attemptWeek === s.week &&
    validAttendantMysteriesScene(e.scene) && e.scene.playerLocation === 'CLEARING' && validAttendantMysteriesRemnant(e.remnant, e.preparation) && e.remnant.location === 'CLEARING' && validAttendantMysteriesBody(e) &&
    c?.encounterId === 'ATTENDANT_MYSTERIES_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && e.enemyStatus === 'RESISTING' && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind &&
    same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk && integer(c.round, 1) && e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
function terminalScene(o: AttendantMysteriesRoundOutcome): { root: AttendantMysteriesScene; exit: 0 | 12; remnant: AttendantMysteriesRemnant } {
  const root = structuredClone(o.rootAfter), exit = o.playerHealthAfter > 0 ? 12 : 0, remnant = structuredClone(o.remnantAfter);
  if (exit) { leaveAttendantMysteriesCombatScene(root); remnant.location = 'WORKSHOP'; } return { root, exit, remnant };
}
export function settleAttendantMysteriesEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.attendantMysteries.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'ATTENDANT_MYSTERIES_DISPUTE') throw new Error('没有这场原空地冲突。'); if (outcome === 'CONTINUE') return;
  const last = c.lastRound, o = last?.attendantMysteriesOutcome;
  if (!last || !o || !validateAttendantMysteriesCombatRound(last) || o.continuing || e.terminal || e.startHistoryIndex === null || c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round ||
    !same(s.combatHistory.at(-1), last) || !same(combatBody(e), combatBody(o)) || !same(o.rootAfter, e.scene) || !same(o.remnantAfter, e.remnant) || o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality ||
    !same(o.masteryAfter, s.progression.mastery) || !same(o.playerInjuriesAfter, s.injuries) || o.playerRiskAfter !== s.injuryRisk || o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || !same(o.enemyInjuries, c.enemyInjuries) || o.enemyRisk !== c.enemyRisk || o.enemyStatus !== c.enemyStatus ||
    outcome !== (o.playerHealthAfter === 0 ? 'PLAYER_DEAD' : o.enemyHealth === 0 ? 'ENEMY_DEAD' : o.enemyStatus === 'SURRENDERED' ? 'ENEMY_SURRENDERED' : 'RETREATED')) throw new Error('结局与真实回合、原身体、原物及已付费用不一致。');
  const final = terminalScene(o); e.scene = final.root; e.remnant = final.remnant;
  e.terminal = { outcome: outcome as AttendantMysteriesEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, exitMetres: final.exit, exitSeconds: final.exit };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('原埃利亚斯冲突结束', `${final.exit ? '本人活着沿普通路线走12米12秒回工坊。' : '本人的原身体真实死亡，留在空地，不自动复活或搬移。'}原材料保留已耗段，原杖保留最后真实位置；居民仍在镇中，全部旧资源与旧记录保持原样。`);
}
export const finishAttendantMysteriesEncounter = settleAttendantMysteriesEncounter;
export function attendantMysteriesEncounterActions(s: SliceState): AttendantMysteriesEncounterAction[] {
  if (!isAttendantMysteriesEncounterStage(s)) return [];
  return ([['PREPARE_ENCOUNTER', '购置并核验唯一原残料', '30便士、1行动；开始前须备足3行动'], ['ENCOUNTER_TALK', '步行到空地核对并交谈', '1行动、12米12秒'], ['ENCOUNTER_FIGHT', '选择与埃利亚斯交战', '1行动；真实伤势与死亡风险'], ['LEAVE_ENCOUNTER', '和平退出本次争议', '0行动；到场后12米12秒']] as const).map(([type, label, cost]) => {
    const command: AttendantMysteriesEncounterCommand = { type }, reason = blockAttendantMysteriesEncounter(s, command); return { id: `attendantMysteries-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export const ATTENDANT_MYSTERIES_ENCOUNTER_STORY = '47岁的序列2非凡者埃利亚斯·维尔在工坊外空地提出通行争议。他有自己的独立身体、心智与唯一手杖，健康100、精神100、灵性120；银弧、屏护、凝神和精神施压均有真实费用。他不替旧人复活，也不会被镇中居民自动包围。请先在接待处备足3行动，再购买原材料、亲自走12米到场并决定是否交战。到场核对2米外的原对手和6米外无人落点；可以交谈后和平离开，普通路线一直开放。';
export function projectAttendantMysteriesEncounter(s: SliceState) {
  const e = s.attendantMysteries.encounter;
  return { title: '工坊外的空地争议', story: isAttendantMysteriesEncounterStage(s) ? ATTENDANT_MYSTERIES_ENCOUNTER_STORY : '', status: e.status, inside: hasAttendantMysteriesEncounterLock(s),
    preparation: e.preparation ? { week: e.preparation.week, pricePaid: 30 as const, actionsPaid: 1 as const } : null, scene: structuredClone(e.scene), remnant: structuredClone(e.remnant),
    enemy: { id: e.targetId, name: '埃利亚斯·维尔', age: 47 as const, sequence: 2 as const, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus,
      weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses }, abilities: ATTENDANT_MYSTERIES_POWERS.map(p => p.label) }, pendingKind: e.pendingKind, composureReady: e.composureReady,
    actions: attendantMysteriesEncounterActions(s), facts: [
      '唯一原山羊残料以30便士购买，已有丧失灵体线记录，只有三段材料；再生仅短时牵动本段原物，不能恢复生命、健康或增加常驻秘偶。',
      '有限嫁接6灵性2精神、知识20；只把随后一次实际可见身体或银弧贡献最多45导向6米外的已观察无人空地，单次、30秒，不防精神。',
      '诡秘之境8灵性2精神，原空地30秒内后续两次可见身体或银弧×0.8；本人原身体连续，对方可付费凝神辨认，不取消所有能力。',
      '旧能力只使用已学项目及真实过去样本；过去的灵之虫、秘偶、药剂、复起记录和生活资源保持原样。旧掌握为0仍是已学。',
      '镇中居民保持原记录和位置，没有自动参战。开始前须备足3行动；普通退出不花行动。放弃这场可选争议后，保留原材料、已付费用和原人结局，可以回接待处继续生活；原身体死亡即本场终局。' ] };
}
export type AttendantMysteriesEncounterProjection = ReturnType<typeof projectAttendantMysteriesEncounter>;

/** This reception exists after the original era closure. Zero AP never runs the
 * old city's bill, debt pulse, wage or week reset; time advances only through the
 * explicit contemporary reception command once this encounter is closed. */
function followingBudget(budget: AttendantMysteriesEncounterBudget, finance: AttendantMysteriesFinanceSnapshot, week: number, date: PublicGameDate, _revision: number) {
  return { budget: structuredClone(budget), finance: structuredClone(finance), week, date: { ...date }, pulse: 'NONE' as const, billAmount: 0 };
}
export function attendantMysteriesTerminalBudgetMatches(s: SliceState, _prep: AttendantMysteriesPreparation, o: AttendantMysteriesRoundOutcome): boolean {
  const e = s.attendantMysteries.encounter, fight = e.journal.find(j => j.command === 'ENCOUNTER_FIGHT'); if (!fight) return false;
  const budget: AttendantMysteriesEncounterBudget = { ...fight.after, health: o.playerHealthAfter, mind: o.playerMindAfter, spirituality: o.playerSpiritualityAfter, mastery: o.masteryAfter, injuries: o.playerInjuriesAfter, injuryRisk: o.playerRiskAfter };
  const expected = followingBudget(budget, fight.finance, o.source.week, o.source.date, o.source.revision);
  if (!same(attendantMysteriesEncounterBudget(s), expected.budget) || !same(attendantMysteriesFinanceSnapshot(s), expected.finance) || s.week !== expected.week || !same(s.date, expected.date) || s.pulse !== expected.pulse || s.billAmount !== expected.billAmount || s.random.cursor !== o.randomCursorAfter || !same(e.scene, terminalScene(o).root) || !same(e.remnant, terminalScene(o).remnant)) return false;
  const titles = ['本周生活费', '生活费如实记账', '本周约定还款', '账目结清', '新的一周'];
  const receipts = s.chronicle.filter((entry, i) => entry.id === `record-${s.revision}-${i}` && titles.includes(entry.title));
  return receipts.length === 0 && s.activeEvent === null && s.eventQueue.length === 0;
}
/** Exact journal, seed, source and old history prefix. No command accepts a replacement body or source. */
export function replayAttendantMysteriesEncounterRoot(s: SliceState): AttendantMysteriesScene | null {
  try {
    const e = s.attendantMysteries.encounter, initial = createAttendantMysteriesEncounterState(), allNew = s.combatHistory.flatMap((r, i) => r.attendantMysteriesOutcome ? [i] : []);
    if (!e || !shape(e, Object.keys(initial)) || e.targetId !== initial.targetId || !validAttendantMysteriesBody(e) || !validAttendantMysteriesScene(e.scene) || !validAttendantMysteriesRemnant(e.remnant, e.preparation)) return null;
    if (!e.preparation) return same(e, initial) && allNew.length === 0 && s.combat?.encounterId !== 'ATTENDANT_MYSTERIES_DISPUTE' ? createAttendantMysteriesScene() : null;
    const prep = e.preparation;
    if (!isAttendantMysteriesEncounterStage(s) || s.attendantMysteries.promotionWeek === null || !s.attendantMysteries.life.reflected || !validateAttendantMysteriesPreparation(prep) || prep.runId !== s.runId || prep.randomSeed !== s.random.seed || prep.randomCursor > s.random.cursor ||
      !integer(prep.week, s.attendantMysteries.promotionWeek, s.week) || compareGameDates(prep.date, s.date) > 0 || !integer(prep.revision, 1, s.revision) || !originalsUnchanged(s) || !Array.isArray(e.journal) || e.journal.length > 2) return null;
    const remnant = createAttendantMysteriesRemnant(); Object.assign(remnant, { owner: 'PLAYER', holder: 'PLAYER', acquiredWeek: prep.week, pricePaid: 30, lostThreadsEvidence: `${s.runId}:AM1-LOST-THREADS:${prep.revision}` });
    let root = createAttendantMysteriesScene(), status: AttendantMysteriesEncounterState['status'] = 'AVAILABLE';
    let budget = prep.after, finance = prep.finance, week = prep.week, date = prep.date, revision = prep.revision;
    for (const entry of e.journal) {
      if (!shape(entry, ['command', 'week', 'date', 'revision', 'randomCursor', 'before', 'after', 'finance', 'sceneBefore', 'sceneAfter']) || !['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(entry.command) || !validBudget(entry.before, entry.revision) || !validBudget(entry.after, entry.revision) || !validFinance(entry.finance, entry.week) ||
        !integer(entry.revision, revision + 1, s.revision) || entry.randomCursor !== prep.randomCursor || !same(entry.sceneBefore, root)) return null;
      const expected = followingBudget(budget, finance, week, date, revision - 1);
      if (entry.week !== expected.week || !same(entry.date, expected.date) || !same(entry.before, expected.budget) || !same(entry.finance, expected.finance)) return null;
      if (entry.command === 'ENCOUNTER_TALK') {
        if (status !== 'AVAILABLE' || root.playerLocation !== 'WORKSHOP' || entry.before.actions < 1) return null;
        root.playerLocation = 'CLEARING'; root.playerCoordinate = 12; root.playerTravelMetres += 12; root.clockSeconds += 12; root.externalSeconds += 12;
        root.observedSourceId = `${s.runId}:AM1-CLEARING:${entry.revision}`; root.observationWeek = entry.week; remnant.location = 'CLEARING'; status = 'READY';
      } else if (entry.command === 'ENCOUNTER_FIGHT') {
        if (status !== 'READY' || root.playerLocation !== 'CLEARING' || entry.before.actions < 1) return null; status = 'FIGHTING';
      } else { if (!['AVAILABLE', 'READY'].includes(status)) return null; if (root.playerLocation === 'CLEARING') leaveAttendantMysteriesCombatScene(root); remnant.location = 'WORKSHOP'; status = 'RESOLVED'; }
      if (!same(entry.after, { ...entry.before, actions: entry.before.actions - (entry.command === 'LEAVE_ENCOUNTER' ? 0 : 1) }) || !same(entry.sceneAfter, root)) return null;
      budget = entry.after; finance = entry.finance; week = entry.week; date = entry.date; revision = entry.revision;
    }
    if (status !== 'FIGHTING') {
      if (e.status !== status || e.startHistoryIndex !== null || e.startSource !== null || e.attemptWeek !== null || e.terminal !== null || !same(combatBody(e), initialAttendantMysteriesBody()) || !same(e.remnant, remnant) || allNew.length || s.combat?.encounterId === 'ATTENDANT_MYSTERIES_DISPUTE') return null;
      // A still-open prepared scene is locked; its actual current budget must be the exact ordinary transition.
      if (status !== 'RESOLVED') { const expected = followingBudget(budget, finance, week, date, revision - 1);
        if (!same(attendantMysteriesEncounterBudget(s), expected.budget) || !same(attendantMysteriesFinanceSnapshot(s), expected.finance) || s.week !== expected.week || !same(s.date, expected.date) || s.random.cursor !== prep.randomCursor) return null; }
      return root;
    }
    const start = e.startSource;
    if (!start || !validAttendantMysteriesCombatSource(start) || !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.startHistoryIndex !== e.originalHistory!.length || e.attemptWeek !== week || start.round !== 1 || start.revision !== revision || start.week !== week || !same(start.date, date) || start.startHistoryIndex !== e.startHistoryIndex || start.runId !== s.runId || !same(start.preparation, prep) ||
      !same(start.body, initialAttendantMysteriesBody()) || !same(start.root, root) || !same(start.remnant, remnant) || start.randomSeed !== s.random.seed || start.randomCursor !== prep.randomCursor || start.playerHealth !== budget.health || start.playerMind !== budget.mind || start.playerSpirituality !== budget.spirituality || !same(start.mastery, budget.mastery) || !same(start.playerInjuries, budget.injuries) || start.playerRisk !== budget.injuryRisk) return null;
    const terminal = e.terminal;
    if (terminal && (!shape(terminal, ['outcome', 'round', 'historyIndex', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'exitMetres', 'exitSeconds']) || !integer(terminal.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1))) return null;
    const end = terminal ? terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    if (!same(allNew, rounds.map((_r, i) => e.startHistoryIndex! + i))) return null;
    for (const [i, round] of rounds.entries()) {
      const o = round.attendantMysteriesOutcome, previous = rounds[i - 1]?.attendantMysteriesOutcome;
      if (!o || !validateAttendantMysteriesCombatRound(round) || round.round !== i + 1 || o.source.revision >= s.revision || o.randomCursorAfter > s.random.cursor || !same(o.source, previous ? nextAttendantMysteriesCombatSource(previous) : start) || !same(o.source.root, root) || i < rounds.length - 1 && !o.continuing) return null;
      root = structuredClone(o.rootAfter);
    }
    const last = rounds.at(-1), o = last?.attendantMysteriesOutcome;
    if (e.status === 'FIGHTING') {
      if (terminal || !hasAttendantMysteriesDisputeOpponent(s) || !same(combatBody(e), o ? combatBody(o) : start.body) || !same(e.remnant, o ? o.remnantAfter : start.remnant)) return null;
      const current = attendantMysteriesEncounterBudget(s), expected = { ...budget, health: o?.playerHealthAfter ?? start.playerHealth, mind: o?.playerMindAfter ?? start.playerMind, spirituality: o ? Math.min(120, o.playerSpiritualityAfter + 12) : start.playerSpirituality, mastery: o?.masteryAfter ?? start.mastery, injuries: o?.playerInjuriesAfter ?? start.playerInjuries, injuryRisk: o?.playerRiskAfter ?? start.playerRisk };
      if (!same(current, expected) || !same(attendantMysteriesFinanceSnapshot(s), finance) || s.week !== week || !same(s.date, date) || s.pulse !== 'NONE' || s.billAmount !== 0 || s.activeEvent !== null || s.eventQueue.length) return null;
      return o ? o.continuing && same(last, s.combat!.lastRound) && same(currentAttendantMysteriesCombatSource(s), nextAttendantMysteriesCombatSource(o)) ? root : null : s.combat!.lastRound === null && same(currentAttendantMysteriesCombatSource(s), start) ? root : null;
    }
    if (s.combat?.encounterId === 'ATTENDANT_MYSTERIES_DISPUTE' || !terminal || !last || !o || o.continuing || terminal.round !== last.round || rounds.length !== terminal.round || !same(combatBody(e), combatBody(o)) || terminal.enemyHealth !== e.enemyHealth || terminal.enemyMind !== e.enemyMind || terminal.enemySpirituality !== e.enemySpirituality || terminal.enemyStatus !== e.enemyStatus) return null;
    const final = terminalScene(o); if (terminal.exitMetres !== final.exit || terminal.exitSeconds !== final.exit || !same(e.remnant, final.remnant)) return null;
    if (s.revision === o.source.revision + 1 && !attendantMysteriesTerminalBudgetMatches(s, prep, o)) return null;
    if (terminal.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 ? final.root : null;
    if (terminal.outcome === 'RETREATED') return e.status === 'RETREATED' && o.playerHealthAfter > 0 && (last.retreat === 'SUCCESS' || o.playerMindAfter === 0) ? final.root : null;
    return e.status === 'RESOLVED' && o.playerHealthAfter > 0 && (terminal.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : terminal.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED') ? final.root : null;
  } catch { return null; }
}
export function validateAttendantMysteriesEncounter(s: SliceState): boolean { try { const root = replayAttendantMysteriesEncounterRoot(s); return root !== null && same(root, s.attendantMysteries.encounter.scene); } catch { return false; } }
export const validateAttendantMysteriesEncounterState = validateAttendantMysteriesEncounter;
