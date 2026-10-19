import { publicPryerFields as publicFields, publicPryerDate } from '../sage/life.js';
import { publicMercurySnakeBudget, publicMercurySnakeFinance, publicMercurySnakeOriginals, publicMercurySnakeOperation, publicWheelOriginalSite, publicMercurySnakePiece, publicMercurySnakePlate, publicMercurySnakeLuck, publicMercurySnakeWindow } from './public.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { addGameWeeks, compareGameDates, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import type { FateProphetOperationState } from '../fate-prophet/life.js';
import type { WinnerLuck } from '../winner/types.js';
import { validFateProphetLuck } from '../fate-prophet/combat.js';
import type { MercurySnakeOriginals, MercurySnakeSite } from './types.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { mercurySnakeLifeClosed, validateMercurySnakeCurrentSite } from './life.js';
import { MERCURY_SNAKE_ENEMY_ABILITY_WHEEL, currentMercurySnakeCombatSource, nextMercurySnakeCombatSource, validMercurySnakeCombatSource, validateMercurySnakeCombatRound,
  validMercurySnakeInjuries, projectMercurySnakeAction,
  type MercurySnakeCombatSource, type MercurySnakeRoundOutcome } from './combat.js';

export const MERCURY_SNAKE_TARGET_ID = 'MS1-OSWIN' as const;
export const MERCURY_SNAKE_SITE = 'MS1-ADJACENT-YARD' as const;
export const MERCURY_SNAKE_POWER_IDS = ['MIND_SPIKE', 'WARD', 'CALM'] as const;
export type MercurySnakePowerId = typeof MERCURY_SNAKE_POWER_IDS[number];
export type MercurySnakeEnemyIntent = MercurySnakePowerId | 'BODY_STRIKE' | 'REPOSITION' | 'ACCIDENT';
export type MercurySnakePolicy = 'INHERITED_ONLY' | 'RESTART' | 'ANCHOR' | 'ALL' | 'ORDINARY';
export type MercurySnakeCombatPolicy = MercurySnakePolicy;
export const MERCURY_SNAKE_POLICIES: readonly MercurySnakePolicy[] = ['INHERITED_ONLY', 'RESTART', 'ANCHOR', 'ALL', 'ORDINARY'];
const POLICY_LABELS: Record<MercurySnakePolicy, string> = { INHERITED_ONLY: '只用已学能力', RESTART: '允许局部重启', ANCHOR: '允许片刻维系', ALL: '允许两项新能力', ORDINARY: '只作普通行动' };
export const MERCURY_SNAKE_POWERS = [
  { id: 'MIND_SPIKE', label: '精神刻片冲击', cost: 7, selfGain: 75 },
  { id: 'WARD', label: '有限手势屏护', cost: 4, selfGain: 0 },
  { id: 'CALM', label: '平复、抵抗与遮挡变位', cost: 3, selfGain: 0 },
] as const;
export interface MercurySnakeCombatPiece { id: 'MS1-COMBAT-PIECE'; ownerId: 'PLAYER'; location: 'PLAYER'; quantity: 1; initialCharges: 3; charges: number; wear: number; paidPennies: 30 }
export const createMercurySnakeCombatPiece = (): MercurySnakeCombatPiece => ({ id: 'MS1-COMBAT-PIECE', ownerId: 'PLAYER', location: 'PLAYER', quantity: 1, initialCharges: 3, charges: 3, wear: 0, paidPennies: 30 });
export interface MercurySnakePlate { id: string; ownerId: typeof MERCURY_SNAKE_TARGET_ID; status: 'HELD' | 'SPENT'; usedRound: number | null; usedOrder: number | null }
export const createMercurySnakePlates = (): MercurySnakePlate[] => [1, 2, 3].map(n => ({ id: `MS1-OSWIN-PLATE-${n}`, ownerId: MERCURY_SNAKE_TARGET_ID, status: 'HELD', usedRound: null, usedOrder: null }));
export interface MercurySnakePositionRelation { playerId: 'PLAYER'; position: 'YARD'; localMetres: number; observedAt: number; conditionVersion: number; living: true }
export interface MercurySnakeForceReceipt { id: string; targetId: typeof MERCURY_SNAKE_TARGET_ID; power: 'MIND_SPIKE' | 'BODY_STRIKE'; kind: 'BODY' | 'MENTAL'; plateId: string | null; paidCost: number; round: number; order: number; atSeconds: number; position: 'YARD'; visible: true; conditionVersion: number; unsettled: true; contribution: number }
export interface MercurySnakeWindow { kind: 'RESTART' | 'ANCHOR'; round: number; order: number; castAt: number; expiresAt: number; conditionVersion: number; relation: MercurySnakePositionRelation }
export type MercurySnakePendingKind = 'FORESIGHT' | 'HAZARD_ADJUSTMENT' | 'DEVIATION_BUFFER' | 'FUTURE_IMPEDIMENT';
export interface MercurySnakeCombatBody {
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  weaponLocation: 'HAND' | 'YARD'; emotion: 'ANGRY' | 'CALM'; powerUses: Record<MercurySnakePowerId, number>; plates: MercurySnakePlate[]; piece: MercurySnakeCombatPiece | null;
  conditionVersion: number; repositionUses: number; playerLocalMetres: number; playerMovementVersion: number; bodyImpulseCount: number; playerTravelMetres: number; playerAttackTravelMetres: number; enemyTravelMetres: number; enemyAttackTravelMetres: number;
  restart: MercurySnakeWindow | null; anchor: MercurySnakeWindow | null; restartApplications: number; anchorApplications: number; lastForceReceipt: MercurySnakeForceReceipt | null;
  pendingKind: MercurySnakePendingKind | null; composureReady: boolean; lastLuckRound: number | null; foresightAttempts: number; hazardAttempts: number; deviationAttempts: number; impedimentAttempts: number; luckAttempts: number;
}
export function createMercurySnakeBody(): MercurySnakeCombatBody {
  return { enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0,
    weaponLocation: 'HAND', emotion: 'ANGRY', powerUses: { MIND_SPIKE: 0, WARD: 0, CALM: 0 }, plates: createMercurySnakePlates(), piece: null,
    conditionVersion: 1, repositionUses: 0, playerLocalMetres: 0, playerMovementVersion: 0, bodyImpulseCount: 0, playerTravelMetres: 0, playerAttackTravelMetres: 0, enemyTravelMetres: 0, enemyAttackTravelMetres: 0,
    restart: null, anchor: null, restartApplications: 0, anchorApplications: 0, lastForceReceipt: null,
    pendingKind: null, composureReady: false, lastLuckRound: null, foresightAttempts: 0, hazardAttempts: 0, deviationAttempts: 0, impedimentAttempts: 0, luckAttempts: 0 };
}
export function mercurySnakeCombatBody(e: MercurySnakeCombatBody): MercurySnakeCombatBody {
  return Object.fromEntries(Object.keys(createMercurySnakeBody()).map(k => [k, structuredClone(e[k as keyof MercurySnakeCombatBody])])) as unknown as MercurySnakeCombatBody;
}
export type MercurySnakeFinanceSnapshot = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface MercurySnakeEncounterBudget { cash: number; actions: number; health: number; mind: number; spirituality: number; pollution: number; gender: string; sequence: 1 | 2; acting: number; coreStats: SliceState['character']['coreStats']; mastery: Record<string, number>; completedSources: string[]; injuries: SliceInjury[]; injuryRisk: number; luck: WinnerLuck }
export interface MercurySnakePreparation {
  week: number; date: PublicGameDate; revision: number; runId: string; randomSeed: string; randomCursor: number; pricePaid: 30; actionsPaid: 1;
  lifeJournalLength: number; lifeClockSeconds: number; before: MercurySnakeEncounterBudget; after: MercurySnakeEncounterBudget; finance: MercurySnakeFinanceSnapshot;
  site: MercurySnakeSite; operation: FateProphetOperationState; originals: MercurySnakeOriginals;
}
export type MercurySnakeEncounterCommand = { type: 'PREPARE_ENCOUNTER' | 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' } | { type: 'SET_COMBAT_POLICY'; policy: MercurySnakePolicy };
export interface MercurySnakeEncounterJournal { command: MercurySnakeEncounterCommand; week: number; date: PublicGameDate; revision: number; randomCursor: number; before: MercurySnakeEncounterBudget; after: MercurySnakeEncounterBudget; finance: MercurySnakeFinanceSnapshot; siteBefore: MercurySnakeSite; siteAfter: MercurySnakeSite }
export interface MercurySnakeEncounterTerminal { outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number; enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; windowWaitSeconds: number; exitMetres: 0 | 4 | 5; exitSeconds: 0 | 4 | 5 }
export interface MercurySnakeEncounterState extends MercurySnakeCombatBody {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof MERCURY_SNAKE_TARGET_ID; policy: MercurySnakePolicy;
  preparation: MercurySnakePreparation | null; approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null; startSource: MercurySnakeCombatSource | null;
  startSite: MercurySnakeSite | null; currentSite: MercurySnakeSite | null; journal: MercurySnakeEncounterJournal[];
  yardId: typeof MERCURY_SNAKE_SITE; ordinaryExit: 'OPEN'; enemyPosition: 'YARD'; enemyDistanceMetres: 2; terminal: MercurySnakeEncounterTerminal | null;
}
export function createMercurySnakeEncounterState(): MercurySnakeEncounterState { return { ...createMercurySnakeBody(), status: 'AVAILABLE', targetId: MERCURY_SNAKE_TARGET_ID, policy: 'ALL', preparation: null, approachWeek: null, attemptWeek: null, startHistoryIndex: null, startSource: null, startSite: null, currentSite: null, journal: [], yardId: MERCURY_SNAKE_SITE, ordinaryExit: 'OPEN', enemyPosition: 'YARD', enemyDistanceMetres: 2, terminal: null }; }
export const createMercurySnakeEncounter = createMercurySnakeEncounterState;
/** New enemy materials are independent. Historical Rowan and the spent luck ledger are read-only. */
export function initializeMercurySnakeEncounterState(s: SliceState): void {
  if (!s.mercurySnake.sourceScene || s.mercurySnake.encounter.preparation) throw new Error('缺少真实来源，不能重新生成战斗物资。');
}
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
export const isMercurySnakeEncounterStage = (s: SliceState) => s.progression.pathwayId === 'wheel' && s.progression.sequence === 1;
export const hasMercurySnakeEncounterLock = (s: SliceState) => s.mercurySnake.encounter.preparation !== null && ['AVAILABLE', 'READY', 'FIGHTING'].includes(s.mercurySnake.encounter.status);
export const isInsideMercurySnakeEncounter = hasMercurySnakeEncounterLock;
export function validateMercurySnakeEncounterCommand(v: unknown): v is MercurySnakeEncounterCommand { const c = v as MercurySnakeEncounterCommand; return !!c && (c.type === 'SET_COMBAT_POLICY' ? shape(c, ['type', 'policy']) && MERCURY_SNAKE_POLICIES.includes(c.policy) : shape(c, ['type']) && ['PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(c.type)); }
export const isMercurySnakeEncounterCommand = validateMercurySnakeEncounterCommand;
export function mercurySnakeFinanceSnapshot(s: MercurySnakeFinanceSnapshot): MercurySnakeFinanceSnapshot {
  return { weeklyBudget: s.weeklyBudget, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: structuredClone(s.debts), missedWeeks: s.missedWeeks, credit: s.credit };
}
export function validateMercurySnakeFinanceSnapshot(v: MercurySnakeFinanceSnapshot, week: number): boolean {
  return shape(v, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit']) && integer(v.weeklyBudget, 1, 100) && Object.hasOwn(SLICE_LIFE, v.lifeTier) && Object.hasOwn(SLICE_LIFE, v.nextLifeTier) &&
    integer(v.missedWeeks) && ['NORMAL', 'NOTICE', 'SUSPENDED'].includes(v.credit) && Array.isArray(v.debts) && v.debts.every(d => shape(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek']) &&
      typeof d.id === 'string' && !!d.id && typeof d.source === 'string' && !!d.source && integer(d.remaining) && integer(d.weeklyPayment, 1) && integer(d.createdWeek, 0, week));
}
export function mercurySnakeEncounterBudget(s: SliceState): MercurySnakeEncounterBudget {
  return { cash: s.cash, actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution, gender: s.character.gender,
    sequence: s.progression.sequence as 1 | 2, acting: s.progression.acting, coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources], injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk, luck: { ...s.mercurySnake.luck } };
}
function validBudget(v: MercurySnakeEncounterBudget, revision: number): boolean {
  return shape(v, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk', 'luck']) && integer(v.cash) &&
    integer(v.actions, 0, 100) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.pollution, 0, 100) && typeof v.gender === 'string' && [1,2].includes(v.sequence) && integer(v.acting, 0, 100) &&
    shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) && Object.values(v.coreStats).every(n => integer(n, 0, 500)) && !!v.mastery && typeof v.mastery === 'object' && !Array.isArray(v.mastery) && Object.values(v.mastery).every(n => integer(n, 0, 500)) &&
    Array.isArray(v.completedSources) && v.completedSources.every(x => typeof x === 'string' && !!x) && new Set(v.completedSources).size === v.completedSources.length && validMercurySnakeInjuries(v.injuries, revision) && integer(v.injuryRisk) && validFateProphetLuck(v.luck, Number.MAX_SAFE_INTEGER);
}

export function mercurySnakeCompletedBudgetMatches(s:SliceState,expected:MercurySnakeEncounterBudget,finance:MercurySnakeFinanceSnapshot,week:number,date:PublicGameDate,revision:number,randomCursor:number,anchorTitle:string):boolean {
 const current=mercurySnakeEncounterBudget(s);
 if(!same({...current,cash:expected.cash,actions:expected.actions},expected)||s.random.cursor!==randomCursor)return false;
 const titles=['本周生活费','生活费如实记账','本周约定还款','账目结清','新的一周'];
 const receipts=s.chronicle.filter((entry,index)=>entry.id===`record-${s.revision}-${index}`&&titles.includes(entry.title));
 if(expected.actions>0||expected.health===0)return s.week===week&&same(s.date,date)&&s.actionsRemaining===expected.actions&&s.cash===expected.cash&&same(mercurySnakeFinanceSnapshot(s),finance)&&s.pulse==='NONE'&&s.billAmount===0&&s.activeEvent===null&&s.eventQueue.length===0&&receipts.length===0;
 if(expected.actions!==0||s.status!=='ACTIVE')return false;
 const result=resolveSliceWeeklyFinance({...finance,cash:expected.cash,week,revision:revision-1,pulse:'BILL',billAmount:0}),advanced=result.eventId===null&&result.state.pulse==='ADVANCE';
 const finalFinance={...finance,...result.state,weeklyBudget:finance.weeklyBudget,lifeTier:advanced?result.state.nextLifeTier:finance.lifeTier};
 if(s.cash!==result.state.cash||!same(mercurySnakeFinanceSnapshot(s),mercurySnakeFinanceSnapshot(finalFinance))||s.week!==week+(advanced?1:0)||!same(s.date,advanced?addGameWeeks(date,1):date)||s.actionsRemaining!==(advanced?finance.weeklyBudget:0)||s.pulse!==(advanced?'NONE':result.state.pulse)||s.billAmount!==(advanced?0:result.state.billAmount))return false;
 const expectedReceipts=result.receipts.map(receipt=>({week,...receipt}));if(advanced)expectedReceipts.push({week:week+1,title:'新的一周',text:`日期推进7天，本周${finance.weeklyBudget}次行动。`});
 if(!same(receipts.map(({week,title,text})=>({week,title,text})),expectedReceipts))return false;
 if(result.eventId){const anchor=s.chronicle.findIndex((entry,index)=>entry.id===`record-${s.revision}-${index}`&&entry.title===anchorTitle),eventIndex=anchor+1+result.receipts.length;return anchor>=0&&s.eventQueue.length===0&&same(s.activeEvent,{id:result.eventId,instanceId:`${s.runId}:${result.eventId}:${s.revision}:${eventIndex}`});}
 return s.activeEvent===null&&s.eventQueue.length===0;
}
export function validMercurySnakeCombatPiece(v: MercurySnakeCombatPiece | null): boolean { return v === null || shape(v, Object.keys(createMercurySnakeCombatPiece())) && same({ ...v, charges: 3, wear: 0 }, createMercurySnakeCombatPiece()) && integer(v.charges, 0, 3) && v.wear === 3 - v.charges; }
export function validMercurySnakePlates(v: MercurySnakePlate[]): boolean { const initial = createMercurySnakePlates(); return Array.isArray(v) && v.length === 3 && v.every((m, i) => shape(m, ['id', 'ownerId', 'status', 'usedRound', 'usedOrder']) && m.id === initial[i]!.id && m.ownerId === MERCURY_SNAKE_TARGET_ID && (m.status === 'HELD' ? m.usedRound === null && m.usedOrder === null : m.status === 'SPENT' && integer(m.usedRound, 1) && integer(m.usedOrder, 0, 11))); }
function closedSite(p: MercurySnakeSite, originals: MercurySnakeOriginals): boolean {
  return !!p && validateMercurySnakeCurrentSite(p, originals) && p.playerLocation === 'START' && ['A', 'OUTSIDE'].includes(p.volunteer.location) && p.volunteer.alive && p.volunteer.willing && ['A', 'OUTSIDE'].includes(p.guide.location) && p.activeCase === null;
}
/** Every adult still present walks A→START→OUTSIDE; already absent adults are not teleported back. */
export function mercurySnakeApproachedSite(start: MercurySnakeSite, originals: MercurySnakeOriginals): MercurySnakeSite {
  if (!closedSite(start, originals)) throw new Error('先回门口，确认艾妲与薇拉均能自愿沿普通路离场。');
  const p = structuredClone(start);
  if (p.volunteer.location === 'A') { p.volunteer.location = 'START'; p.clockSeconds += 4; p.volunteer.location = 'OUTSIDE'; p.clockSeconds += 4; }
  if (p.guide.location === 'A') { p.guide.location = 'START'; p.guideTravelMetres += 4; p.clockSeconds += 4; p.guide.location = 'OUTSIDE'; p.guideTravelMetres += 4; p.clockSeconds += 4; }
  p.playerLocation = 'YARD'; p.playerTravelMetres += 4; p.clockSeconds += 4; return p;
}
export function leaveMercurySnakeCombatSite(p: MercurySnakeSite, localMetres = 0): void { if (p.playerLocation !== 'YARD' || !integer(localMetres, 0, 1)) throw new Error('须本人在旁院的真实标记上才能普通离场。'); p.playerLocation = 'START'; p.playerTravelMetres += 4 + localMetres; p.clockSeconds += 4 + localMetres; }
export function validateMercurySnakePreparation(value: unknown): value is MercurySnakePreparation { try { const p = value as MercurySnakePreparation;
  const o = p.originals, v = o.site.volunteer;
  if (!shape(o, ['site', 'operation', 'luck']) || o.site.siteId !== 'CW3-MECHANICAL-WORKSHOP' || v.id !== 'CW3-VERA' || v.age !== 39 || !v.alive || o.site.guide.id !== 'GUIDE' || o.site.cart.id !== 'CW3-CART' || o.site.cart.owner !== 'GUIDE' || o.site.parcel.id !== 'CW3-PARCEL' || o.site.parcel.owner !== 'GUIDE' || o.site.parcel.massGrams !== 400 || o.site.parcel.sealed !== true || !same(o.operation, { door: 'OPEN', mechanical: { objectId: 'CW3-DISC', caseId: 'finite-disc', preparedAt: 477, preparationRoll: 41, bias: 'B', version: 1 }, forecast: null, correction: null }) || !validFateProphetLuck(o.luck, p.week)) return false;
  return shape(p, ['week', 'date', 'revision', 'runId', 'randomSeed', 'randomCursor', 'pricePaid', 'actionsPaid', 'lifeJournalLength', 'lifeClockSeconds', 'before', 'after', 'finance', 'site', 'operation', 'originals']) && integer(p.week, 1) && isValidGameDate(p.date) && integer(p.revision, 1) && typeof p.runId === 'string' && !!p.runId && typeof p.randomSeed === 'string' && !!p.randomSeed && integer(p.randomCursor) && p.pricePaid === 30 && p.actionsPaid === 1 && integer(p.lifeJournalLength, 1) && p.lifeClockSeconds === p.site.clockSeconds && validBudget(p.before, p.revision) && validBudget(p.after, p.revision) && p.before.sequence === 1 && p.before.cash >= 30 && p.before.actions >= 1 && same(p.after, { ...p.before, cash: p.before.cash - 30, actions: p.before.actions - 1 }) && validateMercurySnakeFinanceSnapshot(p.finance, p.week) && closedSite(p.site, p.originals) && same(p.operation, o.operation);
} catch { return false; } }
function otherSceneOpen(s: SliceState): boolean { return s.mercurySnake.preparedWeek !== null || !mercurySnakeLifeClosed(s) || !s.mercurySnake.life.reflected; }
function actualYard(s: SliceState): boolean {
  const e = s.mercurySnake.encounter, originals = s.mercurySnake.sourceScene?.originals, p = e.currentSite;
  if (!originals || !p || !e.startSite || !e.preparation || e.approachWeek === null || !validateMercurySnakeCurrentSite(p, originals)) return false;
  const expected = mercurySnakeApproachedSite(e.startSite, originals); expected.clockSeconds = p.clockSeconds; expected.playerTravelMetres = p.playerTravelMetres;
  return same(expected, p) && same(e.startSite, s.mercurySnake.life.site) && p.volunteer.location === 'OUTSIDE' && e.approachWeek === s.week;
}
export function blockMercurySnakeEncounter(s: SliceState, c: MercurySnakeEncounterCommand): string | null {
  if (!validateMercurySnakeEncounterCommand(c)) return '庭院命令无效。'; const e = s.mercurySnake.encounter, originals = s.mercurySnake.sourceScene?.originals;
  if (s.status !== 'ACTIVE' || !isMercurySnakeEncounterStage(s) || s.health <= 0) return '须本人仍活着且已成为水银之蛇。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (!s.mercurySnake.guidanceKnown || s.mercurySnake.promotionWeek === null || !originals) return '先完成真实晋升。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德。';
  if (otherSceneOpen(s)) return '先结束原室输入、归还新耗材，本人回门口，完成三案报告与反思。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.preparation && ['AVAILABLE', 'READY'].includes(e.status) && e.currentSite ? e.status === 'READY' && !actualYard(s) ? '离场位置不符。' : null : '当前没有待结束的准备或交谈。';
  if (s.mind <= 0) return '先恢复精神；仍可普通离开。';
  if (c.type === 'PREPARE_ENCOUNTER') { if (e.status !== 'AVAILABLE' || e.preparation) return '这份辅助片只购买一次，不能重新生成或重置。'; if (!closedSite(s.mercurySnake.life.site, originals)) return '先安全收尾原现场。'; return s.cash < 30 || s.actionsRemaining < 1 ? '购买同一战斗辅助片需30便士1行动；交战另需1行动，0行动仍可结束准备。' : null; }
  if (c.type === 'ENCOUNTER_TALK') return e.status === 'AVAILABLE' && e.preparation && closedSite(s.mercurySnake.life.site, originals) ? null : '先购买辅助片并确认原艾妲与薇拉可自愿离场。';
  if (e.status !== 'READY' || !actualYard(s)) return '先实际走到庭院交谈。';
  if (c.type === 'SET_COMBAT_POLICY') return c.policy === e.policy ? '当前已经采用此策略。' : null;
  return s.actionsRemaining >= 1 ? null : '选择交战需要1行动；也可0行动普通离开。';
}
export const mercurySnakeEncounterReason = blockMercurySnakeEncounter;
function record(s: SliceState, c: MercurySnakeEncounterCommand, before: MercurySnakeEncounterBudget, siteBefore: MercurySnakeSite): void {
  s.mercurySnake.encounter.journal.push({ command: structuredClone(c), week: s.week, date: { ...s.date }, revision: s.revision + 1, randomCursor: s.random.cursor, before, after: mercurySnakeEncounterBudget(s), finance: mercurySnakeFinanceSnapshot(s), siteBefore, siteAfter: structuredClone(s.mercurySnake.encounter.currentSite!) });
}
export function applyMercurySnakeEncounterCommand(s: SliceState, c: MercurySnakeEncounterCommand, ctx: SeerContext): void {
  const reason = blockMercurySnakeEncounter(s, c); if (reason) throw new Error(reason); const e = s.mercurySnake.encounter, originals = s.mercurySnake.sourceScene!.originals;
  if (c.type === 'PREPARE_ENCOUNTER') {
    const before = mercurySnakeEncounterBudget(s); s.cash -= 30; s.actionsRemaining--; e.piece = createMercurySnakeCombatPiece(); e.startSite = structuredClone(s.mercurySnake.life.site); e.currentSite = structuredClone(e.startSite);
    e.preparation = { week: s.week, date: { ...s.date }, revision: s.revision + 1, runId: s.runId, randomSeed: s.random.seed, randomCursor: s.random.cursor, pricePaid: 30, actionsPaid: 1, lifeJournalLength: s.mercurySnake.life.journal.length, lifeClockSeconds: e.startSite.clockSeconds, before, after: mercurySnakeEncounterBudget(s), finance: mercurySnakeFinanceSnapshot(s), site: structuredClone(e.startSite), operation: structuredClone(s.mercurySnake.life.operation), originals: structuredClone(originals) };
    ctx.note('购入独立战斗辅助片', '实际支付30便士1行动，取得MS1-COMBAT-PIECE，同一辅助片只有3次，实际应用才耗用；旧已花积运不会补充。'); return;
  }
  const before = mercurySnakeEncounterBudget(s), siteBefore = structuredClone(e.currentSite!);
  if (c.type === 'SET_COMBAT_POLICY') { e.policy = c.policy; record(s, c, before, siteBefore); ctx.note('选择水银之蛇战斗策略', `实际策略${POLICY_LABELS[c.policy]}；不重抽、不退款、不补次数。`); return; }
  if (c.type === 'ENCOUNTER_TALK') { e.currentSite = mercurySnakeApproachedSite(e.startSite!, originals); e.approachWeek = s.week; e.status = 'READY'; record(s, c, before, siteBefore); ctx.note('到相邻院落交谈', '艾妲与薇拉此次自愿离场；仍在A的每位原成人都先走4米4秒到门口，再走4米4秒到室外，已经在室外者保持不动。原车、封包和袋签的主人与实物不变。你随后走4米4秒到旁院，与44岁奥斯温·贝尔交谈。他持独立原杖和3枚有限刻片，你仍可普通离开。'); return; }
  if (c.type === 'LEAVE_ENCOUNTER') { if (e.status === 'READY') leaveMercurySnakeCombatSite(e.currentSite!); e.status = 'RESOLVED'; record(s, c, before, siteBefore); ctx.note('沿普通路和平离开相邻院落', siteBefore.playerLocation === 'YARD' ? '你沿4米普通路步行4秒回到门口，艾妲与薇拉留在室外。所有已付费用保留。' : '你仍在门口，结束这次准备；已买辅助片与费用保留。'); return; }
  s.actionsRemaining--; e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length; record(s, c, before, siteBefore);
  s.combat = { encounterId: 'MERCURY_SNAKE_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  const source = currentMercurySnakeCombatSource(s); if (!source) throw new Error('当前实际战斗来源不完整。'); e.startSource = { ...source, revision: s.revision + 1 };
  ctx.note('选择与奥斯温交战', '这是额外自愿冲突，可能受伤或死亡。奥斯温保有独立意志、原身体与有限物资；洛温仍已投降。艾妲与薇拉真实在室外，没有自动盟友免伤。');
}
export const applyMercurySnakeEncounter = applyMercurySnakeEncounterCommand;
export const handleMercurySnakeEncounter = applyMercurySnakeEncounterCommand;
export function startMercurySnakeEncounter(s: SliceState, ctx: SeerContext): void { applyMercurySnakeEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasMercurySnakeDisputeOpponent(s: SliceState): boolean {
  const e = s.mercurySnake?.encounter, c = s.combat;
  return !!e && isMercurySnakeEncounterStage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !otherSceneOpen(s) && e.status === 'FIGHTING' && e.targetId === MERCURY_SNAKE_TARGET_ID && e.terminal === null && e.enemyStatus === 'RESISTING' && actualYard(s) && e.attemptWeek === s.week && c?.encounterId === 'MERCURY_SNAKE_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk && integer(e.enemySpirituality, 0, 120) && integer(c.round, 1) && e.startHistoryIndex !== null && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
function terminalSite(o: MercurySnakeRoundOutcome): { site: MercurySnakeSite; body: MercurySnakeCombatBody; wait: number; exit: 0 | 4 | 5 } {
  const site = structuredClone(o.siteAfter), body = mercurySnakeCombatBody(o); body.restart = null; body.anchor = null; body.pendingKind = null;
  const exit: 0 | 4 | 5 = o.playerHealthAfter > 0 ? o.playerLocalMetres === 1 ? 5 : 4 : 0; if (exit) leaveMercurySnakeCombatSite(site, o.playerLocalMetres);
  return { site, body, wait: 0, exit };
}
export function settleMercurySnakeEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.mercurySnake.encounter, c = s.combat; if (e.status !== 'FIGHTING' || c?.encounterId !== 'MERCURY_SNAKE_DISPUTE') throw new Error('当前没有奥斯温冲突。'); if (outcome === 'CONTINUE') return;
  const last = c.lastRound, o = last?.mercurySnakeOutcome;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome) || e.terminal || e.startHistoryIndex === null || !last || !o || !validateMercurySnakeCombatRound(last) || o.continuing || c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round || !same(s.combatHistory.at(-1), last) || !same(o.siteAfter, e.currentSite) || !same(mercurySnakeCombatBody(o), mercurySnakeCombatBody(e)) || !same(o.operationAfter, s.mercurySnake.life.operation) || !same(o.masteryAfter, s.progression.mastery) || !same(o.luckAfter, s.mercurySnake.luck) || o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality || !same(o.playerInjuriesAfter, s.injuries) || o.playerRiskAfter !== s.injuryRisk || o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || !same(o.enemyInjuries, c.enemyInjuries) || o.enemyRisk !== c.enemyRisk || o.enemyStatus !== c.enemyStatus) throw new Error('实际场景、费用与战斗结局不符。');
  const actual = o.playerHealthAfter === 0 ? 'PLAYER_DEAD' : o.enemyHealth === 0 ? 'ENEMY_DEAD' : o.enemyStatus === 'SURRENDERED' ? 'ENEMY_SURRENDERED' : 'RETREATED'; if (actual !== outcome) throw new Error('不得改写真实结局。');
  const final = terminalSite(o); e.currentSite = final.site; Object.assign(e, final.body);
  e.terminal = { outcome: actual, round: last.round, historyIndex: s.combatHistory.length - 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, windowWaitSeconds: final.wait, exitMetres: final.exit, exitSeconds: final.exit };
  e.status = actual === 'PLAYER_DEAD' ? 'LOST' : actual === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('奥斯温的相邻院落冲突结束', `未用局部关系已取消，原伤与死亡不变。${final.exit ? `你从真实当前标记步行${final.exit}米${final.exit}秒回门口${final.exit === 5 ? '，先走回仍有的1米局部位移' : ''}。` : '你已死亡，原身体与持物留在庭院。'}奥斯温的原杖留在实际位置，不自动拾起；洛温投降、旧积运已花账与原车封包袋签盘纸记录均保留。`);
}
export const finishMercurySnakeEncounter = settleMercurySnakeEncounter;
export function mercurySnakeEncounterActions(s: SliceState) {
  if (!isMercurySnakeEncounterStage(s)) return [];
  const commands: { command: MercurySnakeEncounterCommand; label: string; cost: string }[] = [
    { command: { type: 'PREPARE_ENCOUNTER' }, label: '购买独立战斗辅助片', cost: '30便士1行动；同一片3次' },
    { command: { type: 'ENCOUNTER_TALK' }, label: '请原艾妲与薇拉离场后交谈', cost: '0行动；在场成人各8米8秒，你4米4秒' },
    { command: { type: 'ENCOUNTER_FIGHT' }, label: '选择与奥斯温交战', cost: '1行动；可能受伤或死亡' },
    { command: { type: 'LEAVE_ENCOUNTER' }, label: '沿普通路和平离开', cost: '0行动；院落退出4米4秒' },
    ...MERCURY_SNAKE_POLICIES.map(policy => ({ command: { type: 'SET_COMBAT_POLICY' as const, policy }, label: `策略：${POLICY_LABELS[policy]}`, cost: '0行动；不改物资' })),
  ];
  return commands.map(({ command, label, cost }) => { const reason = blockMercurySnakeEncounter(s, command); return { id: `mercurySnake-${command.type}${command.type === 'SET_COMBAT_POLICY' ? `-${command.policy}` : ''}`, label, cost, command, enabled: reason === null, reason }; });
}
export function projectMercurySnakePreparation(p: MercurySnakePreparation) { return {
  ...publicFields(p, ['week', 'revision', 'pricePaid', 'actionsPaid', 'lifeJournalLength', 'lifeClockSeconds']), date: publicPryerDate(p.date),
  before: publicMercurySnakeBudget(p.before), after: publicMercurySnakeBudget(p.after), finance: publicMercurySnakeFinance(p.finance),
  site: publicWheelOriginalSite(p.site), operation: publicMercurySnakeOperation(p.operation), originals: publicMercurySnakeOriginals(p.originals),
}; }
export type MercurySnakePublicPreparation = ReturnType<typeof projectMercurySnakePreparation>;
export function projectMercurySnakeEncounter(s: SliceState) {
  const e = s.mercurySnake.encounter, visible = isMercurySnakeEncounterStage(s), p = e.currentSite ?? s.mercurySnake.life.site;
  const last = s.combat?.encounterId === 'MERCURY_SNAKE_DISPUTE' ? s.combat.lastRound?.mercurySnakeOutcome : e.terminal ? s.combatHistory[e.terminal.historyIndex]?.mercurySnakeOutcome : null;
  return { title: visible ? '工坊旁院的独立争议' : '尚未开放的旁院', story: visible ? '44岁的奥斯温·贝尔在工坊旁院提出独立通行争议。原艾妲与薇拉先真实离场；你可交谈、选择交战或普通离开。洛温原已投降的结局保持。' : '',
    status: e.status, inside: hasMercurySnakeEncounterLock(s), policy: e.policy, enemyAbilityWheel: MERCURY_SNAKE_ENEMY_ABILITY_WHEEL.map(row => ({ ...row })),
    site: visible ? publicWheelOriginalSite(p) : null, startSite: visible && e.startSite ? publicWheelOriginalSite(e.startSite) : null, preparation: visible && e.preparation ? projectMercurySnakePreparation(e.preparation) : null,
    piece: visible && e.piece ? publicMercurySnakePiece(e.piece) : null, plates: visible ? e.plates.map(publicMercurySnakePlate) : [], luck: { ...publicMercurySnakeLuck(s.mercurySnake.luck), capacity: 3 as const },
    conditionVersion: e.conditionVersion, restart: e.restart ? publicMercurySnakeWindow(e.restart) : null, anchor: e.anchor ? publicMercurySnakeWindow(e.anchor) : null, operation: visible ? { door: s.mercurySnake.life.operation.door } : null,
    lastActionSequence: visible && last ? [...last.playerActions, ...last.enemyActions].sort((a, b) => a.order - b.order).map(projectMercurySnakeAction) : [],
    playerLocalMetres: e.playerLocalMetres, restartApplications: e.restartApplications, anchorApplications: e.anchorApplications,
    enemy: visible ? { id: e.targetId, name: '奥斯温·贝尔', age: 44, sequence: 1, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus, weaponId: 'MS1-OSWIN-ROD', weaponLocation: e.weaponLocation, position: e.enemyPosition, distanceMetres: 2 + e.playerLocalMetres, baseDistanceMetres: 2, powerUses: publicFields(e.powerUses, ['MIND_SPIKE', 'WARD', 'CALM']) } : null,
    actions: mercurySnakeEncounterActions(s), facts: visible ? [
      '旧六槽30/15/20/20/10/5及17项掌握保留，新两槽各20；唯一积运账容量3，储存为0时不能免费风险调整。',
      '局部重启与片刻维系各8灵性2精神、知识20，失败总计4精神；只处理活着的本人的一个真实位置关系与尚未结算可见冲量。',
      '新辅助片只有3次，真实应用才消耗；变位、遮挡、取消与到期使未用关系失效；原攻击、原费用、经过时间、伤势与死亡不回滚。',
      '奥斯温只有3枚原刻片；精神冲击75各耗7灵性1枚，屏护4灵性，平复遮挡3灵性；不足则本人原杖身体打击25。',
      '体15%感20%意40%知25%；基础1500、核心上限300、底150，状态最多减40%。双方每轮1至6动作，身体与精神后果按实际攻势区分。',
      '在场原成人各从A经门口走8米8秒到室外，你再走4米4秒到旁院；活着才能普通离开；若仍偏移1米，先步行1米1秒，再走原4米4秒出口。',
    ] : [] };
}
export type MercurySnakeEncounterProjection = ReturnType<typeof projectMercurySnakeEncounter>;
/** Exact original scene journal, complete combat source replay, then the shared debt/week finance resolver. */
export function validateMercurySnakeEncounter(s: SliceState): boolean { try {
  const e = s.mercurySnake?.encounter, originals = s.mercurySnake?.sourceScene?.originals, initial = createMercurySnakeEncounterState();
  if (!e || !shape(e, Object.keys(initial)) || !MERCURY_SNAKE_POLICIES.includes(e.policy) || !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || e.targetId !== initial.targetId || e.yardId !== initial.yardId || e.enemyPosition !== 'YARD' || e.enemyDistanceMetres !== 2 || e.ordinaryExit !== 'OPEN' || !Array.isArray(e.journal)) return false;
  const allNew = s.combatHistory.flatMap((round, index) => round.mercurySnakeOutcome ? [index] : []);
  if (!e.preparation) return same(e, initial) && allNew.length === 0 && s.combat?.encounterId !== 'MERCURY_SNAKE_DISPUTE';
  const prep = e.preparation;
  if (!originals || !isMercurySnakeEncounterStage(s) || s.mercurySnake.promotionWeek === null || !validateMercurySnakePreparation(prep) || prep.runId !== s.runId || prep.randomSeed !== s.random.seed || prep.randomCursor > s.random.cursor || !integer(prep.week, s.mercurySnake.promotionWeek, s.week) || compareGameDates(prep.date, s.date) > 0 || !integer(prep.revision, 1, s.revision) || prep.lifeJournalLength !== s.mercurySnake.life.journal.length || !same(prep.site, s.mercurySnake.life.site) || !same(prep.operation, s.mercurySnake.life.operation) || !same(prep.originals, originals) || !same(e.startSite, prep.site) || !mercurySnakeLifeClosed(s) || !s.mercurySnake.life.reflected) return false;
  const latestLife = s.mercurySnake.life.journal.at(-1);
  if (!latestLife || (['gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'luck'] as const).some(key => !same(prep.before[key], latestLife.after[key]))) return false;
  let site = structuredClone(prep.site), status: MercurySnakeEncounterState['status'] = 'AVAILABLE', policy: MercurySnakePolicy = 'ALL';
  let budget = structuredClone(prep.after), revision = prep.revision, approachWeek: number | null = null;
  for (const entry of e.journal) {
    if (!shape(entry, ['command', 'week', 'date', 'revision', 'randomCursor', 'before', 'after', 'finance', 'siteBefore', 'siteAfter']) || !validateMercurySnakeEncounterCommand(entry.command) || !validBudget(entry.before, entry.revision) || !validBudget(entry.after, entry.revision) || entry.revision !== revision + 1 || entry.revision > s.revision || entry.week !== prep.week || !same(entry.date, prep.date) || entry.randomCursor !== prep.randomCursor || !same(entry.before, budget) || !same(entry.finance, prep.finance) || !same(entry.siteBefore, site)) return false;
    const c = entry.command;
    if (c.type === 'ENCOUNTER_TALK') { if (status !== 'AVAILABLE') return false; site = mercurySnakeApproachedSite(site, originals); status = 'READY'; approachWeek = entry.week; }
    else if (c.type === 'SET_COMBAT_POLICY') { if (status !== 'READY' || c.policy === policy) return false; policy = c.policy; }
    else if (c.type === 'ENCOUNTER_FIGHT') { if (status !== 'READY' || entry.before.actions < 1) return false; status = 'FIGHTING'; }
    else if (c.type === 'LEAVE_ENCOUNTER') { if (!['AVAILABLE', 'READY'].includes(status)) return false; if (status === 'READY') leaveMercurySnakeCombatSite(site); status = 'RESOLVED'; }
    else return false;
    if (!same(entry.after, { ...entry.before, actions: entry.before.actions - (c.type === 'ENCOUNTER_FIGHT' ? 1 : 0) }) || !same(entry.siteAfter, site)) return false;
    budget = structuredClone(entry.after); revision = entry.revision;
  }
  if (e.policy !== policy || e.approachWeek !== approachWeek) return false;
  const preparedBody = { ...mercurySnakeCombatBody(initial), piece: createMercurySnakeCombatPiece() };
  if (status !== 'FIGHTING') {
    if (e.status !== status || !same(e.currentSite, site) || e.startHistoryIndex !== null || e.startSource !== null || e.attemptWeek !== null || e.terminal !== null || allNew.length || s.combat?.encounterId === 'MERCURY_SNAKE_DISPUTE' || !same(mercurySnakeCombatBody(e), preparedBody)) return false;
    if (['AVAILABLE', 'READY'].includes(e.status)) return s.week === prep.week && same(s.date, prep.date) && same(mercurySnakeEncounterBudget(s), budget) && same(mercurySnakeFinanceSnapshot(s), prep.finance) && s.random.cursor === prep.randomCursor && s.revision === revision;
    const last = e.journal.at(-1)!; return s.revision !== last.revision || mercurySnakeCompletedBudgetMatches(s, last.after, last.finance, last.week, last.date, last.revision, last.randomCursor, '沿普通路和平离开相邻院落');
  }
  const fight = e.journal.at(-1);
  if (!fight || fight.command.type !== 'ENCOUNTER_FIGHT' || !e.startSource || !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== fight.week || e.startSource.revision !== fight.revision || e.startSource.week !== fight.week || e.startSource.round !== 1 || e.startSource.startHistoryIndex !== e.startHistoryIndex || e.startSource.runId !== s.runId || e.startSource.randomSeed !== s.random.seed || e.startSource.randomCursor !== fight.randomCursor || !same(e.startSource.budget, fight.after) || !same(e.startSource.finance, fight.finance) || !same(e.startSource.site, site) || !same(e.startSource.operation, prep.operation) || !same(e.startSource.preparation, prep) || !same(e.startSource.originals, originals) || !same(e.startSource.body, preparedBody) || e.startSource.policy !== policy || !validMercurySnakeCombatSource(e.startSource)) return false;
  if (e.terminal && (!shape(e.terminal, ['outcome', 'round', 'historyIndex', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'windowWaitSeconds', 'exitMetres', 'exitSeconds']) || !integer(e.terminal.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1))) return false;
  const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
  if (!same(allNew, rounds.map((_round, index) => e.startHistoryIndex! + index))) return false;
  let source = e.startSource, last: MercurySnakeRoundOutcome | null = null;
  for (const round of rounds) {
    const o = round.mercurySnakeOutcome;
    if (!o || !validateMercurySnakeCombatRound(round) || !same(o.source, source) || o.source.revision >= s.revision || o.randomCursorAfter > s.random.cursor || last && !last.continuing) return false;
    last = o; source = nextMercurySnakeCombatSource(o); site = structuredClone(o.siteAfter);
  }
  if (e.status === 'FIGHTING') return !e.terminal && (!last || last.continuing) && same(mercurySnakeCombatBody(e), last ? mercurySnakeCombatBody(last) : preparedBody) && hasMercurySnakeDisputeOpponent(s) && same(e.currentSite, site) && same(currentMercurySnakeCombatSource(s), source) && same(s.combat!.lastRound, rounds.at(-1) ?? null);
  const terminal = e.terminal, round = rounds.at(-1);
  if (!terminal || !last || !round || last.continuing || s.combat?.encounterId === 'MERCURY_SNAKE_DISPUTE' || terminal.round !== last.round || rounds.length !== terminal.round || terminal.enemyHealth !== e.enemyHealth || terminal.enemyMind !== e.enemyMind || terminal.enemySpirituality !== e.enemySpirituality || terminal.enemyStatus !== e.enemyStatus) return false;
  const actual = last.playerHealthAfter === 0 ? 'PLAYER_DEAD' : last.enemyHealth === 0 ? 'ENEMY_DEAD' : last.enemyStatus === 'SURRENDERED' ? 'ENEMY_SURRENDERED' : 'RETREATED', final = terminalSite(last);
  if (terminal.outcome !== actual || terminal.exitMetres !== final.exit || terminal.exitSeconds !== final.exit || terminal.windowWaitSeconds !== final.wait || e.status !== (actual === 'PLAYER_DEAD' ? 'LOST' : actual === 'RETREATED' ? 'RETREATED' : 'RESOLVED') || !same(e.currentSite, final.site) || !same(mercurySnakeCombatBody(e), final.body)) return false;
  if (actual === 'PLAYER_DEAD' && s.status !== 'DEAD') return false;
  const expected = { ...fight.after, health: last.playerHealthAfter, mind: last.playerMindAfter, spirituality: last.playerSpiritualityAfter, mastery: last.masteryAfter, injuries: last.playerInjuriesAfter, injuryRisk: last.playerRiskAfter, luck: { ...last.luckAfter } };
  return s.revision !== last.source.revision + 1 || mercurySnakeCompletedBudgetMatches(s, expected, fight.finance, fight.week, fight.date, last.source.revision + 1, last.randomCursorAfter, '奥斯温的相邻院落冲突结束');
} catch { return false; } }
export const validateMercurySnakeEncounterState = validateMercurySnakeEncounter;
export function replayMercurySnakeEncounterSite(s: SliceState, lifeEnd: MercurySnakeSite): MercurySnakeSite | null {
  return same(lifeEnd, s.mercurySnake.life.site) && validateMercurySnakeEncounter(s) ? structuredClone(s.mercurySnake.encounter.currentSite ?? lifeEnd) : null;
}
export function mercurySnakeEncounterCompletedBudget(s: SliceState): { budget: MercurySnakeEncounterBudget; finance: MercurySnakeFinanceSnapshot; week: number; date: PublicGameDate; revision: number; randomCursor: number } | null {
  const e = s.mercurySnake.encounter; if (!e.preparation || ['AVAILABLE', 'READY', 'FIGHTING'].includes(e.status)) return null;
  if (e.terminal) {
    const round = s.combatHistory[e.terminal.historyIndex], o = round?.mercurySnakeOutcome, fight = e.journal.find(entry => entry.command.type === 'ENCOUNTER_FIGHT');
    if (!o || !fight || o.continuing || !validateMercurySnakeCombatRound(round)) return null;
    return { budget: { ...structuredClone(fight.after), health: o.playerHealthAfter, mind: o.playerMindAfter, spirituality: o.playerSpiritualityAfter, mastery: { ...o.masteryAfter }, injuries: structuredClone(o.playerInjuriesAfter), injuryRisk: o.playerRiskAfter, luck: { ...o.luckAfter } }, finance: structuredClone(fight.finance), week: fight.week, date: { ...fight.date }, revision: o.source.revision, randomCursor: o.randomCursorAfter };
  }
  const last = e.journal.at(-1);
  return last?.command.type === 'LEAVE_ENCOUNTER' ? { budget: structuredClone(last.after), finance: structuredClone(last.finance), week: last.week, date: { ...last.date }, revision: last.revision - 1, randomCursor: last.randomCursor } : null;
}
