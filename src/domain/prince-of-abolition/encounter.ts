import { SLICE_LIFE } from '../../content/slice-events.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { addGameWeeks, compareGameDates, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import type { EntropyDukeOperationState } from '../entropy-duke/life.js';
import type { PrinceOfAbolitionOriginals, PrinceOfAbolitionSite, PrinceOfAbolitionAcquisitionBudget } from './types.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { princeOfAbolitionLifeClosed, validatePrinceOfAbolitionCurrentSite } from './life.js';
import { PRINCE_OF_ABOLITION_ENEMY_ABILITY_WHEEL, currentPrinceOfAbolitionCombatSource, nextPrinceOfAbolitionCombatSource, validPrinceOfAbolitionCombatSource, validatePrinceOfAbolitionCombatRound,
  validPrinceOfAbolitionInjuries, validPrinceOfAbolitionGifts, validPrinceOfAbolitionBody,
  type PrinceOfAbolitionCombatSource, type PrinceOfAbolitionRoundOutcome, type PrinceOfAbolitionPendingEffect } from './combat.js';

export const PRINCE_OF_ABOLITION_TARGET_ID = 'PA1-EDMUND' as const;
export const PRINCE_OF_ABOLITION_SITE = 'PA1-ADJACENT-YARD' as const;
export const PRINCE_OF_ABOLITION_POWER_IDS = ['ARC_BOLT', 'WARD', 'COMPOSE', 'MENTAL_PRESSURE'] as const;
export type PrinceOfAbolitionPowerId = typeof PRINCE_OF_ABOLITION_POWER_IDS[number];
export type PrinceOfAbolitionEnemyIntent = PrinceOfAbolitionPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export type PrinceOfAbolitionPendingKind = 'ORDERED_DEVIATION';
export type PrinceOfAbolitionPolicy = 'INHERITED_ONLY' | 'DIRECTED' | 'MAINTENANCE' | 'ALL' | 'ORDINARY';
export type PrinceOfAbolitionCombatPolicy = PrinceOfAbolitionPolicy;
export const PRINCE_OF_ABOLITION_POLICIES: readonly PrinceOfAbolitionPolicy[] = ['INHERITED_ONLY', 'DIRECTED', 'MAINTENANCE', 'ALL', 'ORDINARY'];
const POLICY_LABELS: Record<PrinceOfAbolitionPolicy, string> = { INHERITED_ONLY: '只用已学能力', DIRECTED: '允许定向增幅', MAINTENANCE: '允许效果维持', ALL: '允许两项新能力', ORDINARY: '只作普通行动' };
export const PRINCE_OF_ABOLITION_POWERS = [
  { id: 'ARC_BOLT', label: '有限弧光', cost: 5, selfGain: 70, enemyReduction: 0 },
  { id: 'WARD', label: '有限屏护', cost: 4, selfGain: 0, enemyReduction: 30 },
  { id: 'COMPOSE', label: '自主凝神抵抗', cost: 4, selfGain: 8, enemyReduction: 0 },
  { id: 'MENTAL_PRESSURE', label: '有限精神施压', cost: 5, selfGain: 45, enemyReduction: 0 },
] as const;
/** Three separately paid pieces; a failed cast still consumes and wears its actual piece. */
export interface PrinceOfAbolitionSupportPiece { id: string; ownerId: 'PLAYER'; location: 'PLAYER'; quantity: 1; status: 'HELD' | 'SPENT'; wear: 0 | 1; usedRound: number | null; usedOrder: number | null }
export const createPrinceOfAbolitionSupportPieces = (): PrinceOfAbolitionSupportPiece[] => [1,2,3].map(n => ({ id: `PA1-COMBAT-SUPPORT-${n}`, ownerId: 'PLAYER', location: 'PLAYER', quantity: 1, status: 'HELD', wear: 0, usedRound: null, usedOrder: null }));
export interface PrinceOfAbolitionEnemyCharge { id: string; ownerId: typeof PRINCE_OF_ABOLITION_TARGET_ID; status: 'HELD' | 'SPENT'; usedRound: number | null; usedOrder: number | null }
export const createPrinceOfAbolitionEnemyCharges = (): PrinceOfAbolitionEnemyCharge[] => [1,2,3].map(n => ({ id: `PA1-EDMUND-CHARGE-${n}`, ownerId: PRINCE_OF_ABOLITION_TARGET_ID, status: 'HELD', usedRound: null, usedOrder: null }));
export interface PrinceOfAbolitionWindow { kind: 'DIRECTED' | 'MAINTENANCE'; round: number; order: number; castAt: number; expiresAt: number; remaining: 1; supportId: string }
export interface PrinceOfAbolitionCombatBody {
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  weaponLocation: 'HAND' | 'YARD'; powerUses: Record<PrinceOfAbolitionPowerId, number>; pendingKind: PrinceOfAbolitionPendingKind | null; composureReady: boolean;
  deviationAttempts: number; magnifyUses: number; exploitUses: number; amplificationAttempts: number; prolongationAttempts: number;
  pendingEffects: PrinceOfAbolitionPendingEffect[]; supportPieces: PrinceOfAbolitionSupportPiece[]; enemyCharges: PrinceOfAbolitionEnemyCharge[]; directed: PrinceOfAbolitionWindow | null; maintenance: PrinceOfAbolitionWindow | null;
  directedAttempts: number; maintenanceAttempts: number; directedApplications: number; maintenanceApplications: number; enemyTravelMetres: number;
}
export function createPrinceOfAbolitionBody(): PrinceOfAbolitionCombatBody { return {
  enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0, weaponLocation: 'HAND', powerUses: { ARC_BOLT: 0, WARD: 0, COMPOSE: 0, MENTAL_PRESSURE: 0 },
  pendingKind: null, composureReady: false, deviationAttempts: 0, magnifyUses: 0, exploitUses: 0, amplificationAttempts: 0, prolongationAttempts: 0,
  pendingEffects: [], supportPieces: [], enemyCharges: createPrinceOfAbolitionEnemyCharges(), directed: null, maintenance: null, directedAttempts: 0, maintenanceAttempts: 0, directedApplications: 0, maintenanceApplications: 0, enemyTravelMetres: 0,
}; }
export function princeOfAbolitionCombatBody(e: PrinceOfAbolitionCombatBody): PrinceOfAbolitionCombatBody { return Object.fromEntries(Object.keys(createPrinceOfAbolitionBody()).map(k => [k, structuredClone(e[k as keyof PrinceOfAbolitionCombatBody])])) as unknown as PrinceOfAbolitionCombatBody; }
export const combatBody = princeOfAbolitionCombatBody;
export type PrinceOfAbolitionFinanceSnapshot = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export type PrinceOfAbolitionEncounterBudget = PrinceOfAbolitionAcquisitionBudget;
export interface PrinceOfAbolitionPreparation {
  week: number; date: PublicGameDate; revision: number; runId: string; randomSeed: string; randomCursor: number; pricePaid: 30; mindPaid: 2; actionsPaid: 0;
  lifeJournalLength: number; lifeClockSeconds: number; before: PrinceOfAbolitionEncounterBudget; after: PrinceOfAbolitionEncounterBudget; finance: PrinceOfAbolitionFinanceSnapshot;
  site: PrinceOfAbolitionSite; operation: EntropyDukeOperationState; originals: PrinceOfAbolitionOriginals;
}
export type PrinceOfAbolitionEncounterCommand = { type: 'PREPARE_ENCOUNTER' | 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' } | { type: 'SET_COMBAT_POLICY'; policy: PrinceOfAbolitionPolicy };
export interface PrinceOfAbolitionEncounterJournal { command: PrinceOfAbolitionEncounterCommand; week: number; date: PublicGameDate; revision: number; randomCursor: number; before: PrinceOfAbolitionEncounterBudget; after: PrinceOfAbolitionEncounterBudget; finance: PrinceOfAbolitionFinanceSnapshot; siteBefore: PrinceOfAbolitionSite; siteAfter: PrinceOfAbolitionSite }
export interface PrinceOfAbolitionEncounterTerminal { outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number; enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; exitMetres: 0 | 4; exitSeconds: 0 | 4 }
export interface PrinceOfAbolitionEncounterState extends PrinceOfAbolitionCombatBody {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof PRINCE_OF_ABOLITION_TARGET_ID; policy: PrinceOfAbolitionPolicy;
  preparation: PrinceOfAbolitionPreparation | null; approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null; startSource: PrinceOfAbolitionCombatSource | null;
  startSite: PrinceOfAbolitionSite | null; currentSite: PrinceOfAbolitionSite | null; journal: PrinceOfAbolitionEncounterJournal[];
  yardId: typeof PRINCE_OF_ABOLITION_SITE; ordinaryExit: 'OPEN'; enemyPosition: 'YARD'; enemyDistanceMetres: 2; terminal: PrinceOfAbolitionEncounterTerminal | null;
}
export function createPrinceOfAbolitionEncounterState(): PrinceOfAbolitionEncounterState { return { ...createPrinceOfAbolitionBody(), status: 'AVAILABLE', targetId: PRINCE_OF_ABOLITION_TARGET_ID, policy: 'ALL', preparation: null, approachWeek: null, attemptWeek: null, startHistoryIndex: null, startSource: null, startSite: null, currentSite: null, journal: [], yardId: PRINCE_OF_ABOLITION_SITE, ordinaryExit: 'OPEN', enemyPosition: 'YARD', enemyDistanceMetres: 2, terminal: null }; }
export const createPrinceOfAbolitionEncounter = createPrinceOfAbolitionEncounterState;
export function initializePrinceOfAbolitionEncounterState(s: SliceState): void { if (!s.princeOfAbolition.sourceScene || !same(s.princeOfAbolition.encounter, createPrinceOfAbolitionEncounterState())) throw new Error('新对手只出现一次，不能重置。'); }
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
export const isPrinceOfAbolitionEncounterStage = (s: SliceState) => s.progression.pathwayId === 'black-emperor' && s.progression.sequence === 1;
export const hasPrinceOfAbolitionEncounterLock = (s: SliceState) => s.princeOfAbolition.encounter.preparation !== null && ['AVAILABLE', 'READY', 'FIGHTING'].includes(s.princeOfAbolition.encounter.status);
export const isInsidePrinceOfAbolitionEncounter = hasPrinceOfAbolitionEncounterLock;
export function validatePrinceOfAbolitionEncounterCommand(v: unknown): v is PrinceOfAbolitionEncounterCommand { const c = v as PrinceOfAbolitionEncounterCommand; return !!c && (c.type === 'SET_COMBAT_POLICY' ? shape(c, ['type', 'policy']) && PRINCE_OF_ABOLITION_POLICIES.includes(c.policy) : shape(c, ['type']) && ['PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(c.type)); }
export const isPrinceOfAbolitionEncounterCommand = validatePrinceOfAbolitionEncounterCommand;
export function princeOfAbolitionFinanceSnapshot(s: PrinceOfAbolitionFinanceSnapshot): PrinceOfAbolitionFinanceSnapshot {
  return { weeklyBudget: s.weeklyBudget, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: structuredClone(s.debts), missedWeeks: s.missedWeeks, credit: s.credit };
}
export function validatePrinceOfAbolitionFinanceSnapshot(v: PrinceOfAbolitionFinanceSnapshot, week: number): boolean {
  return shape(v, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit']) && integer(v.weeklyBudget, 1, 100) && Object.hasOwn(SLICE_LIFE, v.lifeTier) && Object.hasOwn(SLICE_LIFE, v.nextLifeTier) &&
    integer(v.missedWeeks) && ['NORMAL', 'NOTICE', 'SUSPENDED'].includes(v.credit) && Array.isArray(v.debts) && v.debts.every(d => shape(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek']) &&
      typeof d.id === 'string' && !!d.id && typeof d.source === 'string' && !!d.source && integer(d.remaining) && integer(d.weeklyPayment, 1) && integer(d.createdWeek, 0, week));
}
export function princeOfAbolitionEncounterBudget(s: SliceState): PrinceOfAbolitionEncounterBudget {
  return { cash: s.cash, actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution, gender: s.character.gender,
    sequence: s.progression.sequence as 1 | 2, acting: s.progression.acting, coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources], injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk, gifts: structuredClone(s.princeOfAbolition.gifts) };
}
function validBudget(v: PrinceOfAbolitionEncounterBudget, revision: number): boolean {
  return shape(v, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk', 'gifts']) && integer(v.cash) &&
    integer(v.actions, 0, 100) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.pollution, 0, 100) && typeof v.gender === 'string' && [1,2].includes(v.sequence) && integer(v.acting, 0, 100) &&
    shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) && Object.values(v.coreStats).every(n => integer(n, 0, 500)) && !!v.mastery && typeof v.mastery === 'object' && !Array.isArray(v.mastery) && Object.values(v.mastery).every(n => integer(n, 0, 500)) &&
    Array.isArray(v.completedSources) && v.completedSources.every(x => typeof x === 'string' && !!x) && new Set(v.completedSources).size === v.completedSources.length && validPrinceOfAbolitionInjuries(v.injuries, revision) && integer(v.injuryRisk) && validPrinceOfAbolitionGifts(v.gifts, Number.MAX_SAFE_INTEGER);
}

export function princeOfAbolitionCompletedBudgetMatches(s:SliceState,expected:PrinceOfAbolitionEncounterBudget,finance:PrinceOfAbolitionFinanceSnapshot,week:number,date:PublicGameDate,revision:number,randomCursor:number,anchorTitle:string):boolean {
 const current=princeOfAbolitionEncounterBudget(s);
 if(!same({...current,cash:expected.cash,actions:expected.actions},expected)||s.random.cursor!==randomCursor)return false;
 const titles=['本周生活费','生活费如实记账','本周约定还款','账目结清','新的一周'];
 const receipts=s.chronicle.filter((entry,index)=>entry.id===`record-${s.revision}-${index}`&&titles.includes(entry.title));
 if(expected.actions>0||expected.health===0)return s.week===week&&same(s.date,date)&&s.actionsRemaining===expected.actions&&s.cash===expected.cash&&same(princeOfAbolitionFinanceSnapshot(s),finance)&&s.pulse==='NONE'&&s.billAmount===0&&s.activeEvent===null&&s.eventQueue.length===0&&receipts.length===0;
 if(expected.actions!==0||s.status!=='ACTIVE')return false;
 const result=resolveSliceWeeklyFinance({...finance,cash:expected.cash,week,revision:revision-1,pulse:'BILL',billAmount:0}),advanced=result.eventId===null&&result.state.pulse==='ADVANCE';
 const finalFinance={...finance,...result.state,weeklyBudget:finance.weeklyBudget,lifeTier:advanced?result.state.nextLifeTier:finance.lifeTier};
 if(s.cash!==result.state.cash||!same(princeOfAbolitionFinanceSnapshot(s),princeOfAbolitionFinanceSnapshot(finalFinance))||s.week!==week+(advanced?1:0)||!same(s.date,advanced?addGameWeeks(date,1):date)||s.actionsRemaining!==(advanced?finance.weeklyBudget:0)||s.pulse!==(advanced?'NONE':result.state.pulse)||s.billAmount!==(advanced?0:result.state.billAmount))return false;
 const expectedReceipts=result.receipts.map(receipt=>({week,...receipt}));if(advanced)expectedReceipts.push({week:week+1,title:'新的一周',text:`日期推进7天，本周${finance.weeklyBudget}次行动。`});
 if(!same(receipts.map(({week,title,text})=>({week,title,text})),expectedReceipts))return false;
 if(result.eventId){const anchor=s.chronicle.findIndex((entry,index)=>entry.id===`record-${s.revision}-${index}`&&entry.title===anchorTitle),eventIndex=anchor+1+result.receipts.length;return anchor>=0&&s.eventQueue.length===0&&same(s.activeEvent,{id:result.eventId,instanceId:`${s.runId}:${result.eventId}:${s.revision}:${eventIndex}`});}
 return s.activeEvent===null&&s.eventQueue.length===0;
}
export function validPrinceOfAbolitionSupportPieces(v: PrinceOfAbolitionSupportPiece[], purchased = true): boolean {
  const original = createPrinceOfAbolitionSupportPieces();
  return Array.isArray(v) && (purchased ? v.length === 3 : v.length === 0) && v.every((p, i) => shape(p, Object.keys(original[i]!)) && p.id === original[i]!.id && p.ownerId === 'PLAYER' && p.location === 'PLAYER' && p.quantity === 1 && (p.status === 'HELD' ? p.wear === 0 && p.usedRound === null && p.usedOrder === null : p.status === 'SPENT' && p.wear === 1 && integer(p.usedRound, 1) && integer(p.usedOrder, 0, 11)));
}
export function validPrinceOfAbolitionEnemyCharges(v: PrinceOfAbolitionEnemyCharge[]): boolean { const original = createPrinceOfAbolitionEnemyCharges(); return Array.isArray(v) && v.length === 3 && v.every((p, i) => shape(p, Object.keys(original[i]!)) && p.id === original[i]!.id && p.ownerId === PRINCE_OF_ABOLITION_TARGET_ID && (p.status === 'HELD' ? p.usedRound === null && p.usedOrder === null : p.status === 'SPENT' && integer(p.usedRound, 1) && integer(p.usedOrder, 0, 11))); }
function closedSite(p: PrinceOfAbolitionSite, originals: PrinceOfAbolitionOriginals): boolean {
  return !!p && validatePrinceOfAbolitionCurrentSite(p, originals) && p.playerLocation === 'OUTSIDE' && p.volunteer.id === 'FM3-DARIAN' && p.volunteer.location === 'OUTSIDE' && p.volunteer.alive && p.guide.id === 'GUIDE' && p.guide.location === 'OUTSIDE' && p.activeCase === null && [p.parcel, p.ball, p.paper].every(item => item.holder === 'GUIDE' && item.location === 'OUTSIDE');
}
/** The original adults already walked OUTSIDE during practice. Only the player enters the separate yard. */
export function princeOfAbolitionApproachedSite(start: PrinceOfAbolitionSite, originals: PrinceOfAbolitionOriginals): PrinceOfAbolitionSite {
  if (!closedSite(start, originals)) throw new Error('先走到室外，确认两位原人和导师亲带的原物都已离开新场地。');
  const p = structuredClone(start); p.playerLocation = 'YARD'; p.playerTravelMetres += 4; p.clockSeconds += 4; return p;
}
export function leavePrinceOfAbolitionCombatSite(p: PrinceOfAbolitionSite): void { if (p.playerLocation !== 'YARD') throw new Error('须本人实际在相邻院落，才能沿普通路走回室外。'); p.playerLocation = 'OUTSIDE'; p.playerTravelMetres += 4; p.clockSeconds += 4; }
export const leavePrinceOfAbolitionCombatRoot = leavePrinceOfAbolitionCombatSite;
export function validatePrinceOfAbolitionPreparation(value: unknown): value is PrinceOfAbolitionPreparation { try {
  const p = value as PrinceOfAbolitionPreparation, o = p.originals;
  return shape(p, ['week', 'date', 'revision', 'runId', 'randomSeed', 'randomCursor', 'pricePaid', 'mindPaid', 'actionsPaid', 'lifeJournalLength', 'lifeClockSeconds', 'before', 'after', 'finance', 'site', 'operation', 'originals']) &&
    shape(o, ['site', 'operation', 'gifts']) && validPrinceOfAbolitionGifts(o.gifts, p.week) && integer(p.week, 1) && isValidGameDate(p.date) && integer(p.revision, 1) && typeof p.runId === 'string' && !!p.runId && typeof p.randomSeed === 'string' && !!p.randomSeed && integer(p.randomCursor) && p.pricePaid === 30 && p.mindPaid === 2 && p.actionsPaid === 0 && integer(p.lifeJournalLength, 1) && p.lifeClockSeconds === p.site.clockSeconds && validBudget(p.before, p.revision) && validBudget(p.after, p.revision) && p.before.sequence === 1 && p.before.cash >= 30 && p.before.mind > 2 && same(p.after, { ...p.before, cash: p.before.cash - 30, mind: p.before.mind - 2 }) && validatePrinceOfAbolitionFinanceSnapshot(p.finance, p.week) && closedSite(p.site, o) && p.operation.door === 'OPEN' && !p.operation.inputActive && p.operation.flight === null && same(p.operation, o.operation) && same(p.before.gifts, o.gifts);
} catch { return false; } }
function otherSceneOpen(s: SliceState): boolean { return s.princeOfAbolition.preparedWeek !== null || !princeOfAbolitionLifeClosed(s) || !s.princeOfAbolition.life.reflected; }
function actualYard(s: SliceState): boolean {
  const e = s.princeOfAbolition.encounter, originals = s.princeOfAbolition.sourceScene?.originals, p = e.currentSite;
  if (!originals || !p || !e.startSite || !e.preparation || e.approachWeek === null || !validatePrinceOfAbolitionCurrentSite(p, originals)) return false;
  const expected = princeOfAbolitionApproachedSite(e.startSite, originals); expected.clockSeconds = p.clockSeconds; expected.playerTravelMetres = p.playerTravelMetres;
  return same(expected, p) && p.clockSeconds >= e.startSite.clockSeconds + 4 && p.playerTravelMetres >= e.startSite.playerTravelMetres + 4;
}
export function blockPrinceOfAbolitionEncounter(s: SliceState, c: PrinceOfAbolitionEncounterCommand): string | null {
  if (!validatePrinceOfAbolitionEncounterCommand(c)) return '遭遇命令无效。'; const e = s.princeOfAbolition.encounter, originals = s.princeOfAbolition.sourceScene?.originals;
  if (!originals || !isPrinceOfAbolitionEncounterStage(s) || s.status !== 'ACTIVE' || s.health <= 0 || s.princeOfAbolition.promotionWeek === null || !s.princeOfAbolition.guidanceKnown) return '须本人仍活着且完成弑序亲王晋升。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件、战斗或周账。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德。'; if (otherSceneOpen(s)) return '先完成三案、归还原球、结束输入，带原人原物离开新场地并反思。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.preparation && ['AVAILABLE', 'READY'].includes(e.status) && e.currentSite ? e.status === 'READY' && !actualYard(s) ? '实际离场位置不符。' : null : '当前没有待结束的准备或交谈。';
  if (s.mind <= 0) return '先恢复精神；仍可普通离开。';
  if (c.type === 'PREPARE_ENCOUNTER') { if (e.status !== 'AVAILABLE' || e.preparation) return '三枚护片仅购入一次，不能重生或重置。'; if (!closedSite(s.princeOfAbolition.life.site, originals)) return '先实际收尾并走到室外。'; return s.cash < 30 || s.mind <= 2 ? '三枚独立护片需30便士，整理注意力需2精神并保持清醒。' : null; }
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' || !e.preparation || !closedSite(s.princeOfAbolition.life.site, originals) ? '先购买护片并确认原人原物已在室外。' : s.actionsRemaining < 2 ? '交谈需1行动，另留1行动决定是否交战。' : null;
  if (e.status !== 'READY' || !actualYard(s)) return '先沿4米普通路走到独立院落交谈。';
  if (c.type === 'SET_COMBAT_POLICY') return c.policy === e.policy ? '当前已经采用此策略。' : null;
  return s.actionsRemaining >= 1 ? null : '选择交战需要1行动；也可0行动普通离开。';
}
export const princeOfAbolitionEncounterReason = blockPrinceOfAbolitionEncounter;
function record(s: SliceState, c: PrinceOfAbolitionEncounterCommand, before: PrinceOfAbolitionEncounterBudget, siteBefore: PrinceOfAbolitionSite): void {
  s.princeOfAbolition.encounter.journal.push({ command: structuredClone(c), week: s.week, date: { ...s.date }, revision: s.revision + 1, randomCursor: s.random.cursor, before, after: princeOfAbolitionEncounterBudget(s), finance: princeOfAbolitionFinanceSnapshot(s), siteBefore, siteAfter: structuredClone(s.princeOfAbolition.encounter.currentSite!) });
}
export function applyPrinceOfAbolitionEncounterCommand(s: SliceState, c: PrinceOfAbolitionEncounterCommand, ctx: SeerContext): void {
  const reason = blockPrinceOfAbolitionEncounter(s, c); if (reason) throw new Error(reason); const e = s.princeOfAbolition.encounter, originals = s.princeOfAbolition.sourceScene!.originals;
  if (c.type === 'PREPARE_ENCOUNTER') {
    const before = princeOfAbolitionEncounterBudget(s); s.cash -= 30; s.mind -= 2; e.supportPieces = createPrinceOfAbolitionSupportPieces(); e.startSite = structuredClone(s.princeOfAbolition.life.site); e.currentSite = structuredClone(e.startSite);
    e.preparation = { week: s.week, date: { ...s.date }, revision: s.revision + 1, runId: s.runId, randomSeed: s.random.seed, randomCursor: s.random.cursor, pricePaid: 30, mindPaid: 2, actionsPaid: 0, lifeJournalLength: s.princeOfAbolition.life.journal.length, lifeClockSeconds: e.startSite.clockSeconds, before, after: princeOfAbolitionEncounterBudget(s), finance: princeOfAbolitionFinanceSnapshot(s), site: structuredClone(e.startSite), operation: structuredClone(s.princeOfAbolition.life.operation), originals: structuredClone(originals) };
    ctx.note('购入三枚独立战斗护片', '实付30便士和2精神，取得三枚编号护片；每次新术尝试耗一枚并磨损，失败也不退还。原木筹只剩实际持有的原件，不补充。'); return;
  }
  const before = princeOfAbolitionEncounterBudget(s), siteBefore = structuredClone(e.currentSite!);
  if (c.type === 'SET_COMBAT_POLICY') { e.policy = c.policy; record(s, c, before, siteBefore); ctx.note('选择弑序亲王战斗策略', `采用${POLICY_LABELS[c.policy]}；只改变后续施术许可，不重抽、不退款、不补物资。`); return; }
  if (c.type === 'ENCOUNTER_TALK') { s.actionsRemaining--; e.currentSite = princeOfAbolitionApproachedSite(e.startSite!, originals); e.approachWeek = s.week; e.status = 'READY'; record(s, c, before, siteBefore); ctx.note('沿普通路到独立院落交谈', '达里安与米蕾已亲自走到室外，米蕾仍亲带同一原包、原球与原纸。你花1行动，从室外走4米4秒进入独立院落，与2米外44岁的埃德蒙·维尔交谈；他持自己的唯一手杖和三枚有限法术刻片。原奥斯温仍留在原演练房投降。'); return; }
  if (c.type === 'LEAVE_ENCOUNTER') { if (e.status === 'READY') leavePrinceOfAbolitionCombatSite(e.currentSite!); e.status = 'RESOLVED'; record(s, c, before, siteBefore); ctx.note('沿普通路和平离开独立院落', siteBefore.playerLocation === 'YARD' ? '你沿4米普通路走4秒回到室外；所有原人原物仍在实际位置。已付费用不退。' : '你本就在室外，停止准备，不移动原人原物，已付费用不退。'); return; }
  s.actionsRemaining--; e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length; record(s, c, before, siteBefore);
  s.combat = { encounterId: 'PRINCE_OF_ABOLITION_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  const source = currentPrinceOfAbolitionCombatSource(s); if (!source) throw new Error('当前实际战斗来源不完整。'); e.startSource = { ...source, revision: s.revision + 1 };
  ctx.note('选择与埃德蒙交战', '这场独立冲突完全可选，有真实受伤和死亡风险。埃德蒙保有独立意志和有限物资；两位原人实际在院外，无自动盟友免伤。旧奥斯温的投降、原杖和伤势保持原样。');
}
export const applyPrinceOfAbolitionEncounter = applyPrinceOfAbolitionEncounterCommand;
export const handlePrinceOfAbolitionEncounter = applyPrinceOfAbolitionEncounterCommand;
export function startPrinceOfAbolitionEncounter(s: SliceState, ctx: SeerContext): void { applyPrinceOfAbolitionEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasPrinceOfAbolitionDisputeOpponent(s: SliceState): boolean {
  const e = s.princeOfAbolition?.encounter, c = s.combat;
  return !!e && isPrinceOfAbolitionEncounterStage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !otherSceneOpen(s) && e.status === 'FIGHTING' && e.targetId === PRINCE_OF_ABOLITION_TARGET_ID && e.terminal === null && e.enemyStatus === 'RESISTING' && actualYard(s) && e.attemptWeek === s.week && c?.encounterId === 'PRINCE_OF_ABOLITION_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk && validPrinceOfAbolitionBody(e) && integer(c.round, 1) && e.startHistoryIndex !== null && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
function terminalSite(o: PrinceOfAbolitionRoundOutcome): { site: PrinceOfAbolitionSite; body: PrinceOfAbolitionCombatBody; exit: 0 | 4 } {
  const site = structuredClone(o.siteAfter), body = princeOfAbolitionCombatBody(o), exit = o.playerHealthAfter > 0 ? 4 : 0;
  if (exit) leavePrinceOfAbolitionCombatSite(site); return { site, body, exit };
}
export function settlePrinceOfAbolitionEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.princeOfAbolition.encounter, c = s.combat; if (e.status !== 'FIGHTING' || c?.encounterId !== 'PRINCE_OF_ABOLITION_DISPUTE') throw new Error('当前没有埃德蒙冲突。'); if (outcome === 'CONTINUE') return;
  const last = c.lastRound, o = last?.princeOfAbolitionOutcome;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome) || e.terminal || e.startHistoryIndex === null || !last || !o || !validatePrinceOfAbolitionCombatRound(last) || o.continuing || c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round || !same(s.combatHistory.at(-1), last) || !same(o.siteAfter, e.currentSite) || !same(princeOfAbolitionCombatBody(o), princeOfAbolitionCombatBody(e)) || !same(o.operationAfter, s.princeOfAbolition.life.operation) || !same(o.giftsAfter, s.princeOfAbolition.gifts) || !same(o.masteryAfter, s.progression.mastery) || o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality || !same(o.playerInjuriesAfter, s.injuries) || o.playerRiskAfter !== s.injuryRisk || o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || !same(o.enemyInjuries, c.enemyInjuries) || o.enemyRisk !== c.enemyRisk || o.enemyStatus !== c.enemyStatus) throw new Error('实际场景、费用与战斗结局不符。');
  const actual = o.playerHealthAfter === 0 ? 'PLAYER_DEAD' : o.enemyHealth === 0 ? 'ENEMY_DEAD' : o.enemyStatus === 'SURRENDERED' ? 'ENEMY_SURRENDERED' : 'RETREATED'; if (actual !== outcome) throw new Error('不得改写真实结局。');
  const final = terminalSite(o); e.currentSite = final.site; Object.assign(e, final.body);
  e.terminal = { outcome: actual, round: last.round, historyIndex: s.combatHistory.length - 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, exitMetres: final.exit, exitSeconds: final.exit };
  e.status = actual === 'PLAYER_DEAD' ? 'LOST' : actual === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('埃德蒙的独立院落冲突结束', `${final.exit ? '你沿4米普通路走4秒回到室外。' : '你已死亡，原身体与持物留在院落。'}原伤、死亡和已付费用不变；埃德蒙的唯一手杖留在实际位置。旧奥斯温仍投降，原三案、赠物历史与原物归还记录均保留。`);
}
export const finishPrinceOfAbolitionEncounter = settlePrinceOfAbolitionEncounter;
export function princeOfAbolitionEncounterActions(s: SliceState) {
  if (!isPrinceOfAbolitionEncounterStage(s)) return [];
  const commands: { command: PrinceOfAbolitionEncounterCommand; label: string; cost: string }[] = [
    { command: { type: 'PREPARE_ENCOUNTER' }, label: '购入三枚独立护片', cost: '30便士2精神；0行动' },
    { command: { type: 'ENCOUNTER_TALK' }, label: '确认原人离场后沿路交谈', cost: '1行动；4米4秒' },
    { command: { type: 'ENCOUNTER_FIGHT' }, label: '选择与埃德蒙交战', cost: '1行动；可能受伤或死亡' },
    { command: { type: 'LEAVE_ENCOUNTER' }, label: '沿普通路和平离开', cost: '0行动；院落退出4米4秒' },
    ...PRINCE_OF_ABOLITION_POLICIES.map(policy => ({ command: { type: 'SET_COMBAT_POLICY' as const, policy }, label: `策略：${POLICY_LABELS[policy]}`, cost: '0行动；不改物资' })),
  ];
  return commands.map(({ command, label, cost }) => { const reason = blockPrinceOfAbolitionEncounter(s, command); return { id: `princeOfAbolition-${command.type}${command.type === 'SET_COMBAT_POLICY' ? `-${command.policy}` : ''}`, label, cost, command, enabled: reason === null, reason }; });
}
export function projectPrinceOfAbolitionEncounter(s: SliceState) {
  const e = s.princeOfAbolition.encounter, visible = isPrinceOfAbolitionEncounterStage(s), p = e.currentSite ?? s.princeOfAbolition.life.site;
  return { title: visible ? '独立院落的通行争议' : '尚未开放的独立院落', story: visible ? '44岁的埃德蒙·维尔在独立院落提出通行争议。他有自己的身体、独立心智、唯一手杖与三枚有限法术刻片。原人原物已在场外；你可以决定是否交战，也可沿普通路离开。' : '',
    status: e.status, inside: hasPrinceOfAbolitionEncounterLock(s), policy: e.policy, maxActionCount: 6, giftsHeld: s.princeOfAbolition.gifts.filter(g => g.location === 'PLAYER').length,
    windows: visible ? [e.directed,e.maintenance].flatMap(w => w ? [{ kind:w.kind, remainingSeconds:Math.max(0,w.expiresAt-p.clockSeconds), remaining:w.remaining }] : []) : [], enemyAbilityWheel: PRINCE_OF_ABOLITION_ENEMY_ABILITY_WHEEL.map(row => ({ ...row })),
    scene: visible ? { siteId: PRINCE_OF_ABOLITION_SITE, playerLocation: p.playerLocation, darianLocation: p.volunteer.location, guideLocation: p.guide.location, ordinaryExit: 'OPEN' as const, distanceMetres: p.playerLocation === 'YARD' ? 2 : 6, exitMetres: p.playerLocation === 'YARD' ? 4 : 0, clockSeconds: p.clockSeconds, playerTravelMetres: p.playerTravelMetres, enemyTravelMetres: e.enemyTravelMetres } : null,
    preparation: visible && e.preparation ? { week: e.preparation.week, pricePaid: e.preparation.pricePaid, mindPaid: e.preparation.mindPaid, actionsPaid: e.preparation.actionsPaid } : null,
    supportPieces: visible ? e.supportPieces.map(({id, status, wear}) => ({id, status, wear})) : [], enemyCharges: visible ? e.enemyCharges.map(({id,status}) => ({id,status})) : [],
    enemy: visible ? { id: e.targetId, name: '埃德蒙·维尔', age: 44, sequence: 2, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus, weaponId: 'PA1-EDMUND-ROD', weaponLocation: e.weaponLocation, position: e.enemyPosition, distanceMetres: p.playerLocation === 'YARD' ? 2 : 6, powerUses: { ...e.powerUses } } : null,
    actions: princeOfAbolitionEncounterActions(s), facts: visible ? [
      '原六项能力相对权重30/15/25/10/15/5，新增两项各20；双方每轮1至6次。核心仍体35%、感15%、意20%、知30%，继续下一轮仅沿旧制恢复12灵性。',
      '定向增幅8灵性2精神与一枚护片：知识18成功后，20秒内只给本人下一次尚未结算身体行动加35；没有身体行动便自然到期。',
      '效果维持8灵性2精神与一枚护片：知识18并受独立目标57%抵抗，成功后20秒内下一次真实身体或弧光冲击至多减30；精神冲击无效。',
      '两项新术失败或抵抗总计8灵性4精神，护片也消耗；未用到期不退款，不改已结束动作。屏护与凝神仍是对方独立选择。',
      '旧赠物只消耗实际持有的同一原木筹与3灵性；已给出的十二件不能再用。旧放大4灵性、利用3灵性、偏转5灵性与两项序列2费用保持原样。',
      '精神攻击只产生精神后果；身体或弧光按身体伤势盘结算。普通出口无追击，活着可走4米4秒回室外；死亡不能离场或复活。',
    ] : [] };
}
export type PrinceOfAbolitionEncounterProjection = ReturnType<typeof projectPrinceOfAbolitionEncounter>;
/** Exact original scene journal, complete combat source replay, then the shared debt/week finance resolver. */
export function validatePrinceOfAbolitionEncounter(s: SliceState): boolean { try {
  const e = s.princeOfAbolition?.encounter, originals = s.princeOfAbolition?.sourceScene?.originals, initial = createPrinceOfAbolitionEncounterState();
  if (!e || !shape(e, Object.keys(initial)) || !PRINCE_OF_ABOLITION_POLICIES.includes(e.policy) || !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || e.targetId !== initial.targetId || e.yardId !== initial.yardId || e.enemyPosition !== 'YARD' || e.enemyDistanceMetres !== 2 || e.ordinaryExit !== 'OPEN' || !Array.isArray(e.journal)) return false;
  const allNew = s.combatHistory.flatMap((round, index) => round.princeOfAbolitionOutcome ? [index] : []);
  if (!e.preparation) return same(e, initial) && allNew.length === 0 && s.combat?.encounterId !== 'PRINCE_OF_ABOLITION_DISPUTE';
  const prep = e.preparation;
  if (!originals || !isPrinceOfAbolitionEncounterStage(s) || s.princeOfAbolition.promotionWeek === null || !validatePrinceOfAbolitionPreparation(prep) || prep.runId !== s.runId || prep.randomSeed !== s.random.seed || prep.randomCursor > s.random.cursor || !integer(prep.week, s.princeOfAbolition.promotionWeek, s.week) || compareGameDates(prep.date, s.date) > 0 || !integer(prep.revision, 1, s.revision) || prep.lifeJournalLength !== s.princeOfAbolition.life.journal.length || !same(prep.site, s.princeOfAbolition.life.site) || !same(prep.operation, s.princeOfAbolition.life.operation) || !same(prep.originals, originals) || !same(e.startSite, prep.site) || !princeOfAbolitionLifeClosed(s) || !s.princeOfAbolition.life.reflected) return false;
  const latestLife = s.princeOfAbolition.life.journal.at(-1);
  if (!latestLife || (['gifts', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources'] as const).some(key => !same(prep.before[key], latestLife.after[key]))) return false;
  let site = structuredClone(prep.site), status: PrinceOfAbolitionEncounterState['status'] = 'AVAILABLE', policy: PrinceOfAbolitionPolicy = 'ALL';
  let budget = structuredClone(prep.after), revision = prep.revision, approachWeek: number | null = null;
  for (const entry of e.journal) {
    if (!shape(entry, ['command', 'week', 'date', 'revision', 'randomCursor', 'before', 'after', 'finance', 'siteBefore', 'siteAfter']) || !validatePrinceOfAbolitionEncounterCommand(entry.command) || !validBudget(entry.before, entry.revision) || !validBudget(entry.after, entry.revision) || entry.revision !== revision + 1 || entry.revision > s.revision || entry.week !== prep.week || !same(entry.date, prep.date) || entry.randomCursor !== prep.randomCursor || !same(entry.before, budget) || !same(entry.finance, prep.finance) || !same(entry.siteBefore, site)) return false;
    const c = entry.command;
    if (c.type === 'ENCOUNTER_TALK') { if (status !== 'AVAILABLE' || entry.before.actions < 2) return false; site = princeOfAbolitionApproachedSite(site, originals); status = 'READY'; approachWeek = entry.week; }
    else if (c.type === 'SET_COMBAT_POLICY') { if (status !== 'READY' || c.policy === policy) return false; policy = c.policy; }
    else if (c.type === 'ENCOUNTER_FIGHT') { if (status !== 'READY' || entry.before.actions < 1) return false; status = 'FIGHTING'; }
    else if (c.type === 'LEAVE_ENCOUNTER') { if (!['AVAILABLE', 'READY'].includes(status)) return false; if (status === 'READY') leavePrinceOfAbolitionCombatSite(site); status = 'RESOLVED'; }
    else return false;
    if (!same(entry.after, { ...entry.before, actions: entry.before.actions - (['ENCOUNTER_FIGHT', 'ENCOUNTER_TALK'].includes(c.type) ? 1 : 0) }) || !same(entry.siteAfter, site)) return false;
    budget = structuredClone(entry.after); revision = entry.revision;
  }
  if (e.policy !== policy || e.approachWeek !== approachWeek) return false;
  const preparedBody = { ...princeOfAbolitionCombatBody(initial), supportPieces: createPrinceOfAbolitionSupportPieces() };
  if (status !== 'FIGHTING') {
    if (e.status !== status || !same(e.currentSite, site) || e.startHistoryIndex !== null || e.startSource !== null || e.attemptWeek !== null || e.terminal !== null || allNew.length || s.combat?.encounterId === 'PRINCE_OF_ABOLITION_DISPUTE' || !same(princeOfAbolitionCombatBody(e), preparedBody)) return false;
    if (['AVAILABLE', 'READY'].includes(e.status)) return s.week === prep.week && same(s.date, prep.date) && same(princeOfAbolitionEncounterBudget(s), budget) && same(princeOfAbolitionFinanceSnapshot(s), prep.finance) && s.random.cursor === prep.randomCursor && s.revision === revision;
    const last = e.journal.at(-1)!; return s.revision !== last.revision || princeOfAbolitionCompletedBudgetMatches(s, last.after, last.finance, last.week, last.date, last.revision, last.randomCursor, '沿普通路和平离开独立院落');
  }
  const fight = e.journal.at(-1);
  if (!fight || fight.command.type !== 'ENCOUNTER_FIGHT' || !e.startSource || !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== fight.week || e.startSource.revision !== fight.revision || e.startSource.week !== fight.week || e.startSource.round !== 1 || e.startSource.startHistoryIndex !== e.startHistoryIndex || e.startSource.runId !== s.runId || e.startSource.randomSeed !== s.random.seed || e.startSource.randomCursor !== fight.randomCursor || !same(e.startSource.budget, fight.after) || !same(e.startSource.finance, fight.finance) || !same(e.startSource.site, site) || !same(e.startSource.operation, prep.operation) || !same(e.startSource.preparation, prep) || !same(e.startSource.originals, originals) || !same(e.startSource.body, preparedBody) || e.startSource.policy !== policy || !validPrinceOfAbolitionCombatSource(e.startSource)) return false;
  if (e.terminal && (!shape(e.terminal, ['outcome', 'round', 'historyIndex', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'exitMetres', 'exitSeconds']) || !integer(e.terminal.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1))) return false;
  const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
  if (!same(allNew, rounds.map((_round, index) => e.startHistoryIndex! + index))) return false;
  let source = e.startSource, last: PrinceOfAbolitionRoundOutcome | null = null;
  for (const round of rounds) {
    const o = round.princeOfAbolitionOutcome;
    if (!o || !validatePrinceOfAbolitionCombatRound(round) || !same(o.source, source) || o.source.revision >= s.revision || o.randomCursorAfter > s.random.cursor || last && !last.continuing) return false;
    last = o; source = nextPrinceOfAbolitionCombatSource(o); site = structuredClone(o.siteAfter);
  }
  if (e.status === 'FIGHTING') return !e.terminal && (!last || last.continuing) && same(princeOfAbolitionCombatBody(e), last ? princeOfAbolitionCombatBody(last) : preparedBody) && hasPrinceOfAbolitionDisputeOpponent(s) && same(e.currentSite, site) && same(currentPrinceOfAbolitionCombatSource(s), source) && same(s.combat!.lastRound, rounds.at(-1) ?? null);
  const terminal = e.terminal, round = rounds.at(-1);
  if (!terminal || !last || !round || last.continuing || s.combat?.encounterId === 'PRINCE_OF_ABOLITION_DISPUTE' || terminal.round !== last.round || rounds.length !== terminal.round || terminal.enemyHealth !== e.enemyHealth || terminal.enemyMind !== e.enemyMind || terminal.enemySpirituality !== e.enemySpirituality || terminal.enemyStatus !== e.enemyStatus) return false;
  const actual = last.playerHealthAfter === 0 ? 'PLAYER_DEAD' : last.enemyHealth === 0 ? 'ENEMY_DEAD' : last.enemyStatus === 'SURRENDERED' ? 'ENEMY_SURRENDERED' : 'RETREATED', final = terminalSite(last);
  if (terminal.outcome !== actual || terminal.exitMetres !== final.exit || terminal.exitSeconds !== final.exit || e.status !== (actual === 'PLAYER_DEAD' ? 'LOST' : actual === 'RETREATED' ? 'RETREATED' : 'RESOLVED') || !same(e.currentSite, final.site) || !same(princeOfAbolitionCombatBody(e), final.body)) return false;
  if (actual === 'PLAYER_DEAD' && s.status !== 'DEAD') return false;
  const expected = { ...fight.after, health: last.playerHealthAfter, mind: last.playerMindAfter, spirituality: last.playerSpiritualityAfter, mastery: last.masteryAfter, injuries: last.playerInjuriesAfter, injuryRisk: last.playerRiskAfter, gifts: structuredClone(last.giftsAfter) };
  return s.revision !== last.source.revision + 1 || princeOfAbolitionCompletedBudgetMatches(s, expected, fight.finance, fight.week, fight.date, last.source.revision + 1, last.randomCursorAfter, '埃德蒙的独立院落冲突结束');
} catch { return false; } }
export const validatePrinceOfAbolitionEncounterState = validatePrinceOfAbolitionEncounter;
export function replayPrinceOfAbolitionEncounterSite(s: SliceState, lifeEnd: PrinceOfAbolitionSite): PrinceOfAbolitionSite | null {
  return same(lifeEnd, s.princeOfAbolition.life.site) && validatePrinceOfAbolitionEncounter(s) ? structuredClone(s.princeOfAbolition.encounter.currentSite ?? lifeEnd) : null;
}
export function princeOfAbolitionEncounterCompletedBudget(s: SliceState): { budget: PrinceOfAbolitionEncounterBudget; finance: PrinceOfAbolitionFinanceSnapshot; week: number; date: PublicGameDate; revision: number; randomCursor: number } | null {
  const e = s.princeOfAbolition.encounter; if (!e.preparation || ['AVAILABLE', 'READY', 'FIGHTING'].includes(e.status)) return null;
  if (e.terminal) {
    const round = s.combatHistory[e.terminal.historyIndex], o = round?.princeOfAbolitionOutcome, fight = e.journal.find(entry => entry.command.type === 'ENCOUNTER_FIGHT');
    if (!o || !fight || o.continuing || !validatePrinceOfAbolitionCombatRound(round)) return null;
    return { budget: { ...structuredClone(fight.after), health: o.playerHealthAfter, mind: o.playerMindAfter, spirituality: o.playerSpiritualityAfter, mastery: { ...o.masteryAfter }, injuries: structuredClone(o.playerInjuriesAfter), injuryRisk: o.playerRiskAfter, gifts: structuredClone(o.giftsAfter) }, finance: structuredClone(fight.finance), week: fight.week, date: { ...fight.date }, revision: o.source.revision, randomCursor: o.randomCursorAfter };
  }
  const last = e.journal.at(-1);
  return last?.command.type === 'LEAVE_ENCOUNTER' ? { budget: structuredClone(last.after), finance: structuredClone(last.finance), week: last.week, date: { ...last.date }, revision: last.revision - 1, randomCursor: last.randomCursor } : null;
}
