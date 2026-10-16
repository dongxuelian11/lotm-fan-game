import { SLICE_LIFE } from '../../content/slice-events.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { addGameWeeks, compareGameDates, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceCombatRound, SliceInjury, SliceState } from '../slice/types.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import type { SpiritWarlockCompanion } from '../spirit-warlock/types.js';
import { hasMisfortuneKnightLifeLock, misfortuneKnightLifeAdultsAbsent } from './life.js';
import { currentMisfortuneKnightCombatSource, nextMisfortuneKnightCombatSource, validMisfortuneKnightCombatSource, validateMisfortuneKnightCombatRound,
  validMisfortuneKnightBody, validMisfortuneKnightInjuries, validMisfortuneKnightCompanion, type MisfortuneKnightCombatSource, type MisfortuneKnightRoundOutcome } from './combat.js';

export const MISFORTUNE_KNIGHT_TARGET_ID = 'MK1-ALDEN-WARD' as const;
export const MISFORTUNE_KNIGHT_SITE = 'MK1-OPEN-STONE-COURT' as const;
export const MISFORTUNE_KNIGHT_POWER_IDS = ['DARK_BOLT', 'MIND_PRESSURE', 'WARD', 'ATTENTION', 'BLOCK_LINE'] as const;
export type MisfortuneKnightPowerId = typeof MISFORTUNE_KNIGHT_POWER_IDS[number];
export type MisfortuneKnightEnemyIntent = MisfortuneKnightPowerId | 'BODY_STRIKE' | 'OBSERVE' | 'ACCIDENT';
export type MisfortuneKnightPolicy = 'INHERITED_ONLY' | 'GUIDED_MISHAP' | 'BOUNDED_NIGHT_GUARD' | 'ALL' | 'ORDINARY';
export const MISFORTUNE_KNIGHT_POWERS = [
  { id: 'DARK_BOLT', label: '可见暗色冲击', cost: 7, selfGain: 105, enemyReduction: 0 },
  { id: 'MIND_PRESSURE', label: '有限精神压力', cost: 7, selfGain: 70, enemyReduction: 0 },
  { id: 'WARD', label: '有限护持', cost: 6, selfGain: 0, enemyReduction: 60 },
  { id: 'ATTENTION', label: '集中精神抵抗', cost: 3, selfGain: 0, enemyReduction: 0 },
  { id: 'BLOCK_LINE', label: '把原杆横在眼前落点线上', cost: 4, selfGain: 0, enemyReduction: 0 },
] as const;
export interface MisfortuneKnightBattlePlate {
  id: 'MK1-BATTLE-WOOD-PLATE'; sourceId: 'MK1-BATTLE-WOOD-SHOP-1'; owner: 'PLAYER'; paidPennies: 40; purchasedWeek: number;
  location: 'PLAYER' | 'YARD' | 'RETURN_TRAY'; integrity: number; initialIntegrity: 65; wearPerAttempt: 10;
}
export interface MisfortuneKnightMaterials {
  weapon: { id: 'MK1-ALDEN-ROD'; sourceId: 'MK1-ALDEN-OWNED-ROD-1'; owner: typeof MISFORTUNE_KNIGHT_TARGET_ID;
    massKg: 2; location: 'HAND' | 'YARD'; condition: 100; charge: number; capacity: 4; visible: true };
  plate: MisfortuneKnightBattlePlate | null;
}
export function createMisfortuneKnightMaterials(): MisfortuneKnightMaterials {
  return { weapon: { id: 'MK1-ALDEN-ROD', sourceId: 'MK1-ALDEN-OWNED-ROD-1', owner: MISFORTUNE_KNIGHT_TARGET_ID,
    massKg: 2, location: 'HAND', condition: 100, charge: 4, capacity: 4, visible: true }, plate: null };
}
export interface MisfortuneKnightScene {
  siteId: typeof MISFORTUNE_KNIGHT_SITE; playerLocation: 'OUTSIDE' | 'YARD'; playerCoordinate: 0 | 4; enemyCoordinate: 6;
  ordinaryExit: 'OPEN'; visibleBodyLine: boolean; floorLineClear: boolean; thirdPartiesInArea: 0; presentMemberIds: string[]; observedSourceId: string | null; observationWeek: number | null;
  clockSeconds: number; externalSeconds: number; playerTravelMetres: number; knownPlayerName: string | null; knownEnemyName: string | null;
}
export function createMisfortuneKnightScene(): MisfortuneKnightScene {
  return { siteId: MISFORTUNE_KNIGHT_SITE, playerLocation: 'OUTSIDE', playerCoordinate: 0, enemyCoordinate: 6, ordinaryExit: 'OPEN', visibleBodyLine: true, floorLineClear: true, thirdPartiesInArea: 0,
    presentMemberIds: [], observedSourceId: null, observationWeek: null, clockSeconds: 0, externalSeconds: 0, playerTravelMetres: 0, knownPlayerName: null, knownEnemyName: null };
}
export interface MisfortuneKnightCombatBody {
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  weaponLocation: 'HAND' | 'YARD'; powerUses: Record<MisfortuneKnightPowerId, number>;
  spiritDeployments: number; spiritAssists: number; spiritRecalls: number; totalOwnerMindSpent: number; guidedMishapAttempts: number; guidedMishapSuccesses: number; nightGuardAttempts: number; nightGuardSuccesses: number;
}
export function initialMisfortuneKnightBody(): MisfortuneKnightCombatBody {
  return { enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0, weaponLocation: 'HAND',
    powerUses: { DARK_BOLT: 0, MIND_PRESSURE: 0, WARD: 0, ATTENTION: 0, BLOCK_LINE: 0 }, spiritDeployments: 0, spiritAssists: 0, spiritRecalls: 0, totalOwnerMindSpent: 0,
    guidedMishapAttempts: 0, guidedMishapSuccesses: 0, nightGuardAttempts: 0, nightGuardSuccesses: 0 };
}
export function combatBody(e: MisfortuneKnightCombatBody): MisfortuneKnightCombatBody {
  return Object.fromEntries(Object.keys(initialMisfortuneKnightBody()).map(k => [k, structuredClone(e[k as keyof MisfortuneKnightCombatBody])])) as unknown as MisfortuneKnightCombatBody;
}
export type MisfortuneKnightFinanceSnapshot = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface MisfortuneKnightEncounterBudget {
  cash: number; actions: number; health: number; mind: number; spirituality: number; pollution: number; gender: string; sequence: 1;
  acting: number; coreStats: SliceState['character']['coreStats']; mastery: Record<string, number>; completedSources: string[]; injuries: SliceInjury[]; injuryRisk: number;
}
export interface MisfortuneKnightPreparation {
  week: number; date: PublicGameDate; revision: number; runId: string; randomSeed: string; randomCursor: number; pricePaid: 0; actionsPaid: 1;
  lifeReflected: true; playerName: string; playerClubHeld: boolean; before: MisfortuneKnightEncounterBudget; after: MisfortuneKnightEncounterBudget;
  finance: MisfortuneKnightFinanceSnapshot; companion: SpiritWarlockCompanion; spiritPromotionWeek: number | null; spiritCaseStatus: string; materialsBefore: MisfortuneKnightMaterials; materialsAfter: MisfortuneKnightMaterials;
}
export type MisfortuneKnightPurchaseCommand = { type: 'BUY_BATTLE_PLATE' };
export type MisfortuneKnightEncounterCommand = MisfortuneKnightPurchaseCommand | { type: 'ENCOUNTER_TALK' } | { type: 'ENCOUNTER_FIGHT' } | { type: 'LEAVE_ENCOUNTER' } | { type: 'ENCOUNTER_POLICY'; policy: MisfortuneKnightPolicy };
export interface MisfortuneKnightPurchase {
  command: MisfortuneKnightPurchaseCommand; week: number; date: PublicGameDate; revision: number; runId: string; randomSeed: string; randomCursor: number;
  before: MisfortuneKnightEncounterBudget; after: MisfortuneKnightEncounterBudget; finance: MisfortuneKnightFinanceSnapshot; materialsBefore: MisfortuneKnightMaterials; materialsAfter: MisfortuneKnightMaterials;
}
export interface MisfortuneKnightEncounterJournal {
  command: Exclude<MisfortuneKnightEncounterCommand, MisfortuneKnightPurchaseCommand | { type: 'ENCOUNTER_TALK' }>; week: number; date: PublicGameDate; revision: number; randomCursor: number;
  before: MisfortuneKnightEncounterBudget; after: MisfortuneKnightEncounterBudget; finance: MisfortuneKnightFinanceSnapshot; sceneBefore: MisfortuneKnightScene; sceneAfter: MisfortuneKnightScene; materialsBefore: MisfortuneKnightMaterials; materialsAfter: MisfortuneKnightMaterials;
}
export interface MisfortuneKnightEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: MisfortuneKnightCombatBody['enemyStatus']; exitMetres: 0 | 4; exitSeconds: 0 | 4;
}
export interface MisfortuneKnightEncounterState extends MisfortuneKnightCombatBody {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof MISFORTUNE_KNIGHT_TARGET_ID; policy: MisfortuneKnightPolicy;
  preparation: MisfortuneKnightPreparation | null; purchases: MisfortuneKnightPurchase[]; attemptWeek: number | null; startHistoryIndex: number | null; startSource: MisfortuneKnightCombatSource | null;
  originalHistory: SliceCombatRound[] | null; originalResources: string | null; scene: MisfortuneKnightScene; materials: MisfortuneKnightMaterials; journal: MisfortuneKnightEncounterJournal[]; terminal: MisfortuneKnightEncounterTerminal | null;
}
export function createMisfortuneKnightEncounterState(): MisfortuneKnightEncounterState {
  return { ...initialMisfortuneKnightBody(), status: 'AVAILABLE', targetId: MISFORTUNE_KNIGHT_TARGET_ID, policy: 'INHERITED_ONLY', preparation: null, purchases: [], attemptWeek: null, startHistoryIndex: null,
    startSource: null, originalHistory: null, originalResources: null, scene: createMisfortuneKnightScene(), materials: createMisfortuneKnightMaterials(), journal: [], terminal: null };
}
export const createMisfortuneKnightEncounter = createMisfortuneKnightEncounterState;
export const isMisfortuneKnightEncounterStage = (s: SliceState) => s.progression.pathwayId === 'darkness' && s.progression.sequence === 1;
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
export function misfortuneKnightFinanceSnapshot(s: MisfortuneKnightFinanceSnapshot): MisfortuneKnightFinanceSnapshot {
  return { weeklyBudget: s.weeklyBudget, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: structuredClone(s.debts), missedWeeks: s.missedWeeks, credit: s.credit };
}
function validFinance(v: MisfortuneKnightFinanceSnapshot, week: number): boolean {
  return shape(v, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit']) && integer(v.weeklyBudget, 1, 100) && Object.hasOwn(SLICE_LIFE, v.lifeTier) && Object.hasOwn(SLICE_LIFE, v.nextLifeTier) &&
    integer(v.missedWeeks) && ['NORMAL', 'NOTICE', 'SUSPENDED'].includes(v.credit) && Array.isArray(v.debts) && v.debts.every(d => shape(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek']) &&
      typeof d.id === 'string' && !!d.id && typeof d.source === 'string' && !!d.source && integer(d.remaining) && integer(d.weeklyPayment, 1) && integer(d.createdWeek, 0, week));
}
export function misfortuneKnightEncounterBudget(s: SliceState): MisfortuneKnightEncounterBudget {
  return { cash: s.cash, actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution, gender: s.character.gender,
    sequence: 1, acting: s.progression.acting, coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources], injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function validBudget(v: MisfortuneKnightEncounterBudget, revision: number): boolean {
  return shape(v, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) && integer(v.cash) &&
    integer(v.actions, 0, 100) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.pollution, 0, 100) && typeof v.gender === 'string' && v.sequence === 1 && integer(v.acting, 0, 100) &&
    shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) && Object.values(v.coreStats).every(n => integer(n, 0, 500)) && !!v.mastery && typeof v.mastery === 'object' && !Array.isArray(v.mastery) && Object.values(v.mastery).every(n => integer(n, 0, 500)) &&
    Array.isArray(v.completedSources) && v.completedSources.every(x => typeof x === 'string' && !!x) && new Set(v.completedSources).size === v.completedSources.length && validMisfortuneKnightInjuries(v.injuries, revision) && integer(v.injuryRisk);
}
export function validMisfortuneKnightMaterials(v: MisfortuneKnightMaterials): boolean {
  try { const initial = createMisfortuneKnightMaterials(), w = v.weapon, p = v.plate;
    return shape(v, ['weapon','plate']) && shape(w, Object.keys(initial.weapon)) && ['HAND','YARD'].includes(w.location) && integer(w.charge,0,4) && same({...w,location:'HAND',charge:4},initial.weapon) &&
      (p === null || shape(p,['id','sourceId','owner','paidPennies','purchasedWeek','location','integrity','initialIntegrity','wearPerAttempt']) && p.id==='MK1-BATTLE-WOOD-PLATE' && p.sourceId==='MK1-BATTLE-WOOD-SHOP-1' && p.owner==='PLAYER' && p.paidPennies===40 && integer(p.purchasedWeek,1) && ['PLAYER','YARD','RETURN_TRAY'].includes(p.location) && integer(p.integrity,5,65) && (65-p.integrity)%10===0 && p.initialIntegrity===65 && p.wearPerAttempt===10);
  } catch { return false; }
}
function purchaseMaterials(before: MisfortuneKnightMaterials, _c: MisfortuneKnightPurchaseCommand, week: number): MisfortuneKnightMaterials {
  const m=structuredClone(before);if(m.plate)throw new Error('唯一战场木板已经购得，不能换新或免费修复。');
  m.plate={id:'MK1-BATTLE-WOOD-PLATE',sourceId:'MK1-BATTLE-WOOD-SHOP-1',owner:'PLAYER',paidPennies:40,purchasedWeek:week,location:'PLAYER',integrity:65,initialIntegrity:65,wearPerAttempt:10};return m;
}
function arrivalMaterials(before: MisfortuneKnightMaterials): MisfortuneKnightMaterials { return structuredClone(before); }
function returnMaterials(m: MisfortuneKnightMaterials, alive: boolean): void {if(m.plate)m.plate.location=alive?'RETURN_TRAY':'YARD';}
export function validateMisfortuneKnightPreparation(v: unknown): v is MisfortuneKnightPreparation {
  try { const p=v as MisfortuneKnightPreparation; return shape(p,['week','date','revision','runId','randomSeed','randomCursor','pricePaid','actionsPaid','lifeReflected','playerName','playerClubHeld','before','after','finance','companion','spiritPromotionWeek','spiritCaseStatus','materialsBefore','materialsAfter']) &&
    integer(p.week,1)&&isValidGameDate(p.date)&&integer(p.revision,1)&&typeof p.runId==='string'&&!!p.runId&&typeof p.randomSeed==='string'&&!!p.randomSeed&&integer(p.randomCursor)&&typeof p.playerClubHeld==='boolean'&&typeof p.playerName==='string'&&!!p.playerName.trim()&&p.pricePaid===0&&p.actionsPaid===1&&p.lifeReflected===true&&
    validBudget(p.before,p.revision)&&validBudget(p.after,p.revision)&&validFinance(p.finance,p.week)&&p.before.actions>=1&&p.before.actions<=Math.max(4,p.finance.weeklyBudget)&&same(p.after,{...p.before,actions:p.before.actions-1})&&validMisfortuneKnightCompanion(p.companion,p.week)&&p.companion.status!=='DEPLOYED'&&(p.spiritPromotionWeek===null||integer(p.spiritPromotionWeek,1,p.week))&&typeof p.spiritCaseStatus==='string'&&!!p.spiritCaseStatus&&
    validMisfortuneKnightMaterials(p.materialsBefore)&&validMisfortuneKnightMaterials(p.materialsAfter)&&same(p.materialsAfter,arrivalMaterials(p.materialsBefore));
  }catch{return false;}
}
export function validMisfortuneKnightScene(p: MisfortuneKnightScene): boolean {
  const initial=createMisfortuneKnightScene(); return shape(p,Object.keys(initial))&&same({...p,playerLocation:initial.playerLocation,playerCoordinate:initial.playerCoordinate,observedSourceId:null,observationWeek:null,clockSeconds:0,externalSeconds:0,playerTravelMetres:0,knownPlayerName:null,knownEnemyName:null,visibleBodyLine:true,floorLineClear:true},initial)&&
    typeof p.visibleBodyLine==='boolean'&&typeof p.floorLineClear==='boolean'&&(p.playerLocation==='OUTSIDE'&&p.playerCoordinate===0||p.playerLocation==='YARD'&&p.playerCoordinate===4)&&integer(p.clockSeconds)&&p.externalSeconds===p.clockSeconds&&integer(p.playerTravelMetres)&&
    (p.observedSourceId===null?p.observationWeek===null&&p.knownPlayerName===null&&p.knownEnemyName===null:typeof p.observedSourceId==='string'&&integer(p.observationWeek,1)&&typeof p.knownPlayerName==='string'&&!!p.knownPlayerName.trim()&&p.knownEnemyName==='奥尔登·沃德');
}
function protectedOriginals(s: SliceState): string {
  const spiritWarlock=structuredClone(s.spiritWarlock);spiritWarlock.companion=structuredClone(s.misfortuneKnight.encounter.preparation?.companion??s.spiritWarlock.companion);
  return stableStringify({sleepless:s.sleepless,midnight:s.midnight,nightmare:s.nightmare,soother:s.soother,spiritWarlock,nightwatcher:s.nightwatcher,fearBishop:s.fearBishop,concealmentServant:s.concealmentServant,town:s.town,life:s.misfortuneKnight.life});
}
function adultsAbsent(s: SliceState): boolean {return !hasMisfortuneKnightLifeLock(s)&&s.misfortuneKnight.life.reflected&&misfortuneKnightLifeAdultsAbsent(s);}
function historyUnchanged(s: SliceState): boolean {const e=s.misfortuneKnight.encounter;return Array.isArray(e.originalHistory)&&same(e.originalHistory,s.combatHistory.slice(0,e.originalHistory.length));}
function originalsUnchanged(s: SliceState): boolean {return s.misfortuneKnight.encounter.originalResources===protectedOriginals(s)&&historyUnchanged(s);}
export function validateMisfortuneKnightEncounterCommand(v:unknown):v is MisfortuneKnightEncounterCommand {if(!v||typeof v!=='object'||Array.isArray(v))return false;const c=v as MisfortuneKnightEncounterCommand;return c.type==='ENCOUNTER_POLICY'?shape(c,['type','policy'])&&['INHERITED_ONLY','GUIDED_MISHAP','BOUNDED_NIGHT_GUARD','ALL','ORDINARY'].includes(c.policy):shape(c,['type'])&&['BUY_BATTLE_PLATE','ENCOUNTER_TALK','ENCOUNTER_FIGHT','LEAVE_ENCOUNTER'].includes(c.type);}
export const isMisfortuneKnightEncounterCommand=validateMisfortuneKnightEncounterCommand;
export const hasMisfortuneKnightEncounterLock=(s:SliceState):boolean=>['READY','FIGHTING'].includes(s.misfortuneKnight.encounter.status);
export const isInsideMisfortuneKnightEncounter=hasMisfortuneKnightEncounterLock;
export function blockMisfortuneKnightEncounter(s:SliceState,c:MisfortuneKnightEncounterCommand):string|null {
  if(!validateMisfortuneKnightEncounterCommand(c))return'遭遇命令无效。';const e=s.misfortuneKnight.encounter;
  if(!isMisfortuneKnightEncounterStage(s)||s.misfortuneKnight.promotionWeek===null||s.status!=='ACTIVE'||s.health<=0)return'须本人仍活着并完成厄难骑士晋升。';
  if(s.combat)return'先处理当前真实战斗。';if(!adultsAbsent(s))return'先收束三项生活实践，让艾琳和米洛留在原房间出口，原工具归还。';if(s.world.city!=='BACKLUND')return'须实际在贝克兰德石院。';
  if(c.type==='LEAVE_ENCOUNTER')return e.status==='READY'&&originalsUnchanged(s)?null:'须已亲自到场，才能普通离开。';
  if(s.activeEvent||s.eventQueue.length||s.pulse!=='NONE')return'先处理当前事件或周账。';if(s.mind<=0)return'需要清醒；到场后仍可普通退出。';
  if(c.type==='BUY_BATTLE_PLATE'){
    if(e.status!=='AVAILABLE'||e.preparation)return'须在到场前准备；战场内不能补货。';if(s.actionsRemaining<1)return'需要1行动。';
    if(e.materials.plate)return'同一战场木板已经购买，不能修复或补发。';return s.cash>=40?null:'现钱不足40便士。';
  }
  if(c.type==='ENCOUNTER_TALK')return e.status!=='AVAILABLE'||e.preparation?'同一奥尔登的争议不能重置。':s.actionsRemaining<1?'到场需1行动；行动用尽仍可普通离开。':null;
  if(e.status!=='READY'||!e.preparation||!originalsUnchanged(s))return'须先亲自交谈并保留同一原人原物和旧记录。';
  if(c.type==='ENCOUNTER_POLICY')return c.policy===e.policy&&e.journal.some(j=>j.command.type==='ENCOUNTER_POLICY')?'已经采用这项策略。':null;
  if(!e.journal.some(j=>j.command.type==='ENCOUNTER_POLICY'))return'先明确选择本场策略；开战后不能更换。';return s.actionsRemaining<1?'开战需要1行动；和平离开不花行动。':null;
}
export const misfortuneKnightEncounterReason=blockMisfortuneKnightEncounter;
export function leaveMisfortuneKnightCombatScene(p:MisfortuneKnightScene):void {if(p.playerLocation!=='YARD'||p.playerCoordinate!==4)throw new Error('须从实际所在石院离开。');p.playerLocation='OUTSIDE';p.playerCoordinate=0;p.playerTravelMetres+=4;p.clockSeconds+=4;p.externalSeconds+=4;}
function arrive(s:SliceState,p:MisfortuneKnightPreparation):MisfortuneKnightScene{return{...createMisfortuneKnightScene(),playerLocation:'YARD',playerCoordinate:4,observedSourceId:`${s.runId}:MK1-YARD:${p.revision}`,observationWeek:p.week,clockSeconds:4,externalSeconds:4,playerTravelMetres:4,knownPlayerName:p.playerName,knownEnemyName:'奥尔登·沃德'};}
export function applyMisfortuneKnightEncounterCommand(s:SliceState,c:MisfortuneKnightEncounterCommand,ctx:SeerContext):void {
  const reason=blockMisfortuneKnightEncounter(s,c);if(reason)throw new Error(reason);const e=s.misfortuneKnight.encounter;
  if(c.type==='BUY_BATTLE_PLATE'){
    const before=misfortuneKnightEncounterBudget(s),materialsBefore=structuredClone(e.materials);s.cash-=40;s.actionsRemaining--;e.materials=purchaseMaterials(e.materials,c,s.week);
    e.purchases.push({command:structuredClone(c),week:s.week,date:{...s.date},revision:s.revision+1,runId:s.runId,randomSeed:s.random.seed,randomCursor:s.random.cursor,before,after:misfortuneKnightEncounterBudget(s),finance:misfortuneKnightFinanceSnapshot(s),materialsBefore,materialsAfter:structuredClone(e.materials)});
    ctx.note('备好独立战场原物','实付40便士和1行动，购得独立战场木板，初始完整度65。每次实际尝试护持都会磨损10，不维修、不补发；与米洛的生活木板不是同一物。');return;
  }
  if(c.type==='ENCOUNTER_TALK'){
    const before=misfortuneKnightEncounterBudget(s),materialsBefore=structuredClone(e.materials);s.actionsRemaining--;e.materials=arrivalMaterials(e.materials);
    e.preparation={week:s.week,date:{...s.date},revision:s.revision+1,runId:s.runId,randomSeed:s.random.seed,randomCursor:s.random.cursor,pricePaid:0,actionsPaid:1,lifeReflected:true,playerName:s.character.name,playerClubHeld:s.town.clubLocation==='HAND',before,after:misfortuneKnightEncounterBudget(s),finance:misfortuneKnightFinanceSnapshot(s),companion:structuredClone(s.spiritWarlock.companion),spiritPromotionWeek:s.spiritWarlock.promotionWeek,spiritCaseStatus:s.spiritWarlock.cases['listening-leaves']!.status,materialsBefore,materialsAfter:structuredClone(e.materials)};
    e.originalHistory=structuredClone(s.combatHistory);e.originalResources=protectedOriginals(s);e.scene=arrive(s,e.preparation);e.status='READY';
    ctx.note('走到石院与奥尔登交谈',`实付1行动，步行4米4秒。你介绍姓名“${s.character.name}”，46岁的奥尔登·沃德也报出姓名。他持自己的唯一杆，身体100、精神100、灵性120，杆中只有四次可见暗色冲击。艾琳、米洛及旧人物均不在场。若已买战场木板，本人实际持有那一块原物。`);return;
  }
  const entry:MisfortuneKnightEncounterJournal={command:structuredClone(c),week:s.week,date:{...s.date},revision:s.revision+1,randomCursor:s.random.cursor,before:misfortuneKnightEncounterBudget(s),after:misfortuneKnightEncounterBudget(s),finance:misfortuneKnightFinanceSnapshot(s),sceneBefore:structuredClone(e.scene),sceneAfter:structuredClone(e.scene),materialsBefore:structuredClone(e.materials),materialsAfter:structuredClone(e.materials)};
  if(c.type==='ENCOUNTER_POLICY'){e.policy=c.policy;ctx.note('选择厄难骑士交战策略',c.policy==='ORDINARY'?'本场只作普通动作；不施放抽到的能力。':c.policy==='INHERITED_ONLY'?'本场只允许已学能力；两项新能力回到普通防备。':'仅在所选能力抽到、实际对象与资源齐备时尝试。每轮各一次，失败照付，空窗口没有掌握奖励。');}
  else if(c.type==='LEAVE_ENCOUNTER'){returnMaterials(e.materials,true);leaveMisfortuneKnightCombatScene(e.scene);e.status='RESOLVED';ctx.note('沿普通路和平离开石院','若持有战场木板，就亲手放回返还盘并保留实际磨损；沿开放出口实际走4米4秒。没有战斗或奖励，奥尔登与自己的杆留在石院。');}
  else{s.actionsRemaining--;e.status='FIGHTING';e.attemptWeek=s.week;e.startHistoryIndex=s.combatHistory.length;s.combat={encounterId:'MISFORTUNE_KNIGHT_DISPUTE',round:1,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemyInjuries:structuredClone(e.enemyInjuries),enemyRisk:e.enemyRisk,enemyStatus:'RESISTING',lastRound:null};ctx.note('选择与奥尔登交战','实付1行动。双方各自最多六次实际行动，精神压力与身体伤害各有实际来源。普通撤退、停止抵抗、伤势与真实死亡照常。');}
  entry.after=misfortuneKnightEncounterBudget(s);entry.sceneAfter=structuredClone(e.scene);entry.materialsAfter=structuredClone(e.materials);e.journal.push(entry);
  if(c.type==='ENCOUNTER_FIGHT'){const source=currentMisfortuneKnightCombatSource(s);if(!source)throw new Error('真实战斗来源不完整。');e.startSource={...source,revision:s.revision+1};}
}
export const applyMisfortuneKnightEncounter=applyMisfortuneKnightEncounterCommand;
export const handleMisfortuneKnightEncounter=applyMisfortuneKnightEncounterCommand;
export function startMisfortuneKnightEncounter(s:SliceState,ctx:SeerContext):void{applyMisfortuneKnightEncounterCommand(s,{type:'ENCOUNTER_FIGHT'},ctx);}
export function hasMisfortuneKnightDisputeOpponent(s:SliceState):boolean {
  const e=s.misfortuneKnight?.encounter,c=s.combat;return isMisfortuneKnightEncounterStage(s)&&s.status==='ACTIVE'&&!s.activeEvent&&s.world.city==='BACKLUND'&&s.health>0&&s.mind>0&&s.misfortuneKnight.promotionWeek!==null&&!!e&&e.status==='FIGHTING'&&e.targetId===MISFORTUNE_KNIGHT_TARGET_ID&&e.terminal===null&&e.preparation!==null&&e.materials.weapon.charge===4-e.powerUses.DARK_BOLT&&originalsUnchanged(s)&&e.attemptWeek===s.week&&adultsAbsent(s)&&
    validMisfortuneKnightScene(e.scene)&&e.scene.playerLocation==='YARD'&&e.scene.knownPlayerName===s.character.name&&validMisfortuneKnightMaterials(e.materials)&&validMisfortuneKnightBody(e)&&e.weaponLocation===e.materials.weapon.location&&c?.encounterId==='MISFORTUNE_KNIGHT_DISPUTE'&&c.enemyStatus==='RESISTING'&&c.enemyHealth>0&&c.enemyMind>0&&e.enemyStatus==='RESISTING'&&e.enemyHealth===c.enemyHealth&&e.enemyMind===c.enemyMind&&same(e.enemyInjuries,c.enemyInjuries)&&e.enemyRisk===c.enemyRisk&&integer(c.round,1)&&e.startHistoryIndex!==null&&integer(e.startHistoryIndex)&&s.combatHistory.length-e.startHistoryIndex===c.round-1;
}
function terminalScene(o:MisfortuneKnightRoundOutcome):{root:MisfortuneKnightScene;exit:0|4;materials:MisfortuneKnightMaterials}{const root=structuredClone(o.rootAfter),materials=structuredClone(o.materialsAfter),exit=o.playerHealthAfter>0?4:0;returnMaterials(materials,exit>0);if(exit)leaveMisfortuneKnightCombatScene(root);return{root,exit,materials};}
export function settleMisfortuneKnightEncounter(s:SliceState,outcome:string,ctx:SeerContext,_award?:(source:string,amount:5|8|25)=>void):void {
  const e=s.misfortuneKnight.encounter,c=s.combat;if(e.status!=='FIGHTING'||c?.encounterId!=='MISFORTUNE_KNIGHT_DISPUTE')throw new Error('没有这场石院冲突。');if(outcome==='CONTINUE')return;const last=c.lastRound,o=last?.misfortuneKnightOutcome;
  if(!last||!o||!validateMisfortuneKnightCombatRound(last)||o.continuing||e.terminal||e.startHistoryIndex===null||c.round!==last.round+1||s.combatHistory.length-e.startHistoryIndex!==last.round||!originalsUnchanged(s)||!same(s.combatHistory.at(-1),last)||!same(combatBody(e),combatBody(o))||!same(o.rootAfter,e.scene)||!same(o.materialsAfter,e.materials)||o.playerHealthAfter!==s.health||o.playerMindAfter!==s.mind||o.playerSpiritualityAfter!==s.spirituality||!same(o.companion,s.spiritWarlock.companion)||!same(o.masteryAfter,s.progression.mastery)||!same(o.playerInjuriesAfter,s.injuries)||o.playerRiskAfter!==s.injuryRisk||o.enemyHealth!==c.enemyHealth||o.enemyMind!==c.enemyMind||!same(o.enemyInjuries,c.enemyInjuries)||o.enemyRisk!==c.enemyRisk||o.enemyStatus!==c.enemyStatus||outcome!==(o.playerHealthAfter===0?'PLAYER_DEAD':o.enemyHealth===0?'ENEMY_DEAD':o.enemyStatus==='SURRENDERED'?'ENEMY_SURRENDERED':'RETREATED'))throw new Error('结局与真实回合、原人原物和费用不一致。');
  const final=terminalScene(o);e.scene=final.root;e.materials=final.materials;e.terminal={outcome:outcome as MisfortuneKnightEncounterTerminal['outcome'],round:last.round,historyIndex:s.combatHistory.length-1,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,enemyStatus:e.enemyStatus,exitMetres:final.exit,exitSeconds:final.exit};e.status=outcome==='PLAYER_DEAD'?'LOST':outcome==='RETREATED'?'RETREATED':'RESOLVED';s.combat=null;
  ctx.note('奥尔登的石院冲突结束',`${final.exit?'本人将实际持有的原木板放回返还盘，保留磨损；未买木板便不虚记返还。随后沿普通出口走4米4秒。':'本人的原身体真实死亡；若持有原木板，就落在实际石院。'}双方原灵性、精神、伤势与杆落点保留，没有复活、修复木板或补发杆中储能。艾琳、米洛和旧人物仍各在原处。`);
}
export const finishMisfortuneKnightEncounter=settleMisfortuneKnightEncounter;
export function misfortuneKnightEncounterActions(s:SliceState){
  if(!isMisfortuneKnightEncounterStage(s))return[];const choices:{command:MisfortuneKnightEncounterCommand;label:string;cost:string}[]=[
    {command:{type:'BUY_BATTLE_PLATE'},label:'购买独立战场木板',cost:'40便士、1行动；完整度65，每次护持磨损10'},
    {command:{type:'ENCOUNTER_TALK'},label:'到石院与奥尔登交谈',cost:'1行动、4米4秒；用尽行动仍可和平离开'},
    ...(['INHERITED_ONLY','GUIDED_MISHAP','BOUNDED_NIGHT_GUARD','ALL','ORDINARY'] as const).map(policy=>({command:{type:'ENCOUNTER_POLICY' as const,policy},label:({INHERITED_ONLY:'只用已学能力',GUIDED_MISHAP:'允许厄势导引',BOUNDED_NIGHT_GUARD:'允许隐夜护持',ALL:'允许两项新能力',ORDINARY:'只作普通行动'})[policy],cost:'0行动；开战前明确选择'})),
    {command:{type:'ENCOUNTER_FIGHT'},label:'自主承担真实冲突',cost:'1行动；真实伤势与死亡风险'},
    {command:{type:'LEAVE_ENCOUNTER'},label:'带回原物并和平离开',cost:'0行动、4米4秒'}];
  return choices.map(({command,label,cost})=>{const reason=blockMisfortuneKnightEncounter(s,command);return{id:`MK1-${command.type}${command.type==='ENCOUNTER_POLICY'?'-'+command.policy:''}`,command,label,cost,enabled:reason===null,reason,cleanup:command.type==='LEAVE_ENCOUNTER'};});
}
export const MISFORTUNE_KNIGHT_ENCOUNTER_STORY='46岁的奥尔登·沃德独自在净空石院提出通行争议。他有独立健康100、精神100、灵性120与自己的唯一原杆，杆中四次可见冲击用尽后仍是同一根杆。艾琳、米洛和旧人物均不在场。沿四米普通路到场，亲自交谈、明确策略后再决定交战或和平离开。';
export function projectMisfortuneKnightEncounter(s:SliceState){const e=s.misfortuneKnight.encounter;return{title:'奥尔登的石院争议',story:isMisfortuneKnightEncounterStage(s)?MISFORTUNE_KNIGHT_ENCOUNTER_STORY:'',status:e.status,inside:hasMisfortuneKnightEncounterLock(s),policy:e.policy,policyConfirmed:e.journal.some(j=>j.command.type==='ENCOUNTER_POLICY'),scene:structuredClone(e.scene),materials:structuredClone(e.materials),
  enemy:{id:e.targetId,name:'奥尔登·沃德',age:46 as const,health:e.enemyHealth,mind:e.enemyMind,spirituality:e.enemySpirituality,status:e.enemyStatus,weaponLocation:e.weaponLocation,powerUses:{...e.powerUses}},actions:misfortuneKnightEncounterActions(s),facts:[
    '厄势导引每轮一次6灵性2精神、意志18并受抵抗，只削弱同一项可见待执行身体冲击25。','隐夜护持每轮一次8灵性3精神、知识18与同一实付木板；尝试即磨损10，30秒内仅削弱目标身体冲击30，不能挡住精神压力。','空窗口、失败或抵抗没有掌握奖励。原卷叶须实际封存可派出，先2灵性派出、后槽另2灵性协助；当轮结束归回同一原牙齿。','体35%、感25%、意25%、知15%；双方1至6动作权重10/15/25/25/15/10，基础1250、底125、上限120，仅继续轮恢复12。','精神耗尽仍活着停战，身体死亡终结本周目；生还亲手归还原木板并实走4米4秒。']};}
export type MisfortuneKnightEncounterProjection=ReturnType<typeof projectMisfortuneKnightEncounter>;

/** Exact shared finance transition after a completed, unlocked action. Locked
 * READY/FIGHTING scenes never pay a bill or grant next-week actions early. */
export function misfortuneKnightCompletedBudgetMatches(s:SliceState,expected:MisfortuneKnightEncounterBudget,finance:MisfortuneKnightFinanceSnapshot,week:number,date:PublicGameDate,revision:number,randomCursor:number,anchorTitle:string):boolean {
 const current=misfortuneKnightEncounterBudget(s);
 if(!same({...current,cash:expected.cash,actions:expected.actions},expected)||s.random.cursor!==randomCursor)return false;
 const titles=['本周生活费','生活费如实记账','本周约定还款','账目结清','新的一周'];
 const receipts=s.chronicle.filter((entry,index)=>entry.id===`record-${s.revision}-${index}`&&titles.includes(entry.title));
 if(expected.actions>0||expected.health===0)return s.week===week&&same(s.date,date)&&s.actionsRemaining===expected.actions&&s.cash===expected.cash&&same(misfortuneKnightFinanceSnapshot(s),finance)&&s.pulse==='NONE'&&s.billAmount===0&&s.activeEvent===null&&s.eventQueue.length===0&&receipts.length===0;
 if(expected.actions!==0||s.status!=='ACTIVE')return false;
 const result=resolveSliceWeeklyFinance({...finance,cash:expected.cash,week,revision:revision-1,pulse:'BILL',billAmount:0}),advanced=result.eventId===null&&result.state.pulse==='ADVANCE';
 const finalFinance={...finance,...result.state,weeklyBudget:finance.weeklyBudget,lifeTier:advanced?result.state.nextLifeTier:finance.lifeTier};
 if(s.cash!==result.state.cash||!same(misfortuneKnightFinanceSnapshot(s),misfortuneKnightFinanceSnapshot(finalFinance))||s.week!==week+(advanced?1:0)||!same(s.date,advanced?addGameWeeks(date,1):date)||s.actionsRemaining!==(advanced?finance.weeklyBudget:0)||s.pulse!==(advanced?'NONE':result.state.pulse)||s.billAmount!==(advanced?0:result.state.billAmount))return false;
 const expectedReceipts=result.receipts.map(receipt=>({week,...receipt}));if(advanced)expectedReceipts.push({week:week+1,title:'新的一周',text:`日期推进7天，本周${finance.weeklyBudget}次行动。`});
 if(!same(receipts.map(({week,title,text})=>({week,title,text})),expectedReceipts))return false;
 if(result.eventId){const anchor=s.chronicle.findIndex((entry,index)=>entry.id===`record-${s.revision}-${index}`&&entry.title===anchorTitle),eventIndex=anchor+1+result.receipts.length;return anchor>=0&&s.eventQueue.length===0&&same(s.activeEvent,{id:result.eventId,instanceId:`${s.runId}:${result.eventId}:${s.revision}:${eventIndex}`});}
 return s.activeEvent===null&&s.eventQueue.length===0;
}
export function misfortuneKnightTerminalBudgetMatches(s:SliceState,_prep:MisfortuneKnightPreparation,o:MisfortuneKnightRoundOutcome):boolean {
 const fight=s.misfortuneKnight.encounter.journal.find(j=>j.command.type==='ENCOUNTER_FIGHT');if(!fight)return false;
 const expected={...fight.after,health:o.playerHealthAfter,mind:o.playerMindAfter,spirituality:o.playerSpiritualityAfter,mastery:o.masteryAfter,injuries:o.playerInjuriesAfter,injuryRisk:o.playerRiskAfter};
 return same(s.misfortuneKnight.encounter.scene,terminalScene(o).root)&&same(s.misfortuneKnight.encounter.materials,terminalScene(o).materials)&&misfortuneKnightCompletedBudgetMatches(s,expected,fight.finance,fight.week,fight.date,o.source.revision+1,o.randomCursorAfter,'奥尔登的石院冲突结束');
}
function purchaseBudgetMatches(s:SliceState,p:MisfortuneKnightPurchase):boolean {return s.random.seed===p.randomSeed&&misfortuneKnightCompletedBudgetMatches(s,p.after,p.finance,p.week,p.date,p.revision,p.randomCursor,'备好独立战场原物');}
function peacefulBudgetMatches(s:SliceState,e:MisfortuneKnightEncounterJournal):boolean{return e.command.type==='LEAVE_ENCOUNTER'&&misfortuneKnightCompletedBudgetMatches(s,e.after,e.finance,e.week,e.date,e.revision,e.randomCursor,'沿普通路和平离开石院');}
export function replayMisfortuneKnightPurchases(s:SliceState):MisfortuneKnightMaterials|null {
 try{let materials=createMisfortuneKnightMaterials(),revision=0,week=s.misfortuneKnight.promotionWeek??0;const purchases=s.misfortuneKnight.encounter.purchases;
  if(!Array.isArray(purchases)||purchases.length>1)return null;
  for(const p of purchases){if(!shape(p,['command','week','date','revision','runId','randomSeed','randomCursor','before','after','finance','materialsBefore','materialsAfter'])||!validateMisfortuneKnightEncounterCommand(p.command)||!['BUY_BATTLE_PLATE'].includes(p.command.type)||!integer(p.week,week,s.week)||!isValidGameDate(p.date)||compareGameDates(p.date,s.date)>0||!integer(p.revision,revision+1,s.revision)||p.runId!==s.runId||p.randomSeed!==s.random.seed||!integer(p.randomCursor,0,s.random.cursor)||!validBudget(p.before,p.revision)||!validBudget(p.after,p.revision)||!validFinance(p.finance,p.week)||p.before.actions<1||p.before.cash<40||!same(p.materialsBefore,materials))return null;
   materials=purchaseMaterials(materials,p.command,p.week);
   if(!same(p.after,{...p.before,cash:p.before.cash-40,actions:p.before.actions-1})||!same(p.materialsAfter,materials)||s.revision===p.revision&&!purchaseBudgetMatches(s,p))return null;
   revision=p.revision;week=p.week;
  }return materials;
 }catch{return null;}
}
/** Exact root and source-chain replay. Historical rounds are immutable; a later
 * ordinary rest may change the live player but cannot alter a recorded fight. */
export function replayMisfortuneKnightEncounterRoot(s:SliceState):MisfortuneKnightScene|null {
 try{
  const e=s.misfortuneKnight.encounter,initial=createMisfortuneKnightEncounterState(),allNew=s.combatHistory.flatMap((r,i)=>r.misfortuneKnightOutcome?[i]:[]),purchased=replayMisfortuneKnightPurchases(s);
  if(!e||!shape(e,Object.keys(initial))||!['AVAILABLE','READY','FIGHTING','RESOLVED','RETREATED','LOST'].includes(e.status)||e.targetId!==initial.targetId||!['INHERITED_ONLY','GUIDED_MISHAP','BOUNDED_NIGHT_GUARD','ALL','ORDINARY'].includes(e.policy)||!validMisfortuneKnightBody(e)||!validMisfortuneKnightScene(e.scene)||!validMisfortuneKnightMaterials(e.materials)||e.weaponLocation!==e.materials.weapon.location||!purchased)return null;
  if(!e.preparation)return same({...e,purchases:[],materials:createMisfortuneKnightMaterials()},initial)&&same(e.materials,purchased)&&allNew.length===0&&s.combat?.encounterId!=='MISFORTUNE_KNIGHT_DISPUTE'?createMisfortuneKnightScene():null;
  const prep=e.preparation;
  if(!isMisfortuneKnightEncounterStage(s)||s.misfortuneKnight.promotionWeek===null||!s.misfortuneKnight.life.reflected||!validateMisfortuneKnightPreparation(prep)||prep.runId!==s.runId||prep.playerName!==s.character.name||prep.randomSeed!==s.random.seed||prep.randomCursor>s.random.cursor||!integer(prep.week,s.misfortuneKnight.promotionWeek,s.week)||compareGameDates(prep.date,s.date)>0||!integer(prep.revision,1,s.revision)||!historyUnchanged(s)||typeof e.originalResources!=='string'||!e.originalResources||!Array.isArray(e.journal)||!same(prep.materialsBefore,purchased)||e.purchases.some(p=>p.revision>=prep.revision||p.week>prep.week))return null;
  let policyChosen=false,root=arrive(s,prep),status:MisfortuneKnightEncounterState['status']='READY',policy:MisfortuneKnightPolicy='INHERITED_ONLY',materials=structuredClone(prep.materialsAfter),companion=structuredClone(prep.companion);
  let budget=prep.after,finance=prep.finance,week=prep.week,date=prep.date,revision=prep.revision;
  for(const entry of e.journal){
   if(!shape(entry,['command','week','date','revision','randomCursor','before','after','finance','sceneBefore','sceneAfter','materialsBefore','materialsAfter'])||!validateMisfortuneKnightEncounterCommand(entry.command)||!['ENCOUNTER_POLICY','ENCOUNTER_FIGHT','LEAVE_ENCOUNTER'].includes(entry.command.type)||!validBudget(entry.before,entry.revision)||!validBudget(entry.after,entry.revision)||!validFinance(entry.finance,entry.week)||!integer(entry.revision,revision+1,s.revision)||entry.randomCursor!==prep.randomCursor||!same(entry.sceneBefore,root)||!same(entry.materialsBefore,materials)||status!=='READY'||entry.week!==week||!same(entry.date,date)||!same(entry.before,budget)||!same(entry.finance,finance))return null;
   if(entry.command.type==='ENCOUNTER_POLICY'){if(policyChosen&&entry.command.policy===policy)return null;policy=entry.command.policy;policyChosen=true;}
   else if(entry.command.type==='ENCOUNTER_FIGHT'){if(!policyChosen||root.playerLocation!=='YARD'||entry.before.actions<1)return null;status='FIGHTING';}
   else{returnMaterials(materials,true);leaveMisfortuneKnightCombatScene(root);status='RESOLVED';}
   if(!same(entry.after,{...entry.before,actions:entry.before.actions-(entry.command.type==='ENCOUNTER_FIGHT'?1:0)})||!same(entry.sceneAfter,root)||!same(entry.materialsAfter,materials))return null;
   budget=entry.after;finance=entry.finance;week=entry.week;date=entry.date;revision=entry.revision;
  }
  if(e.policy!==policy)return null;
  if(status!=='FIGHTING'){
   if(e.status!==status||e.startHistoryIndex!==null||e.startSource!==null||e.attemptWeek!==null||e.terminal!==null||!same(combatBody(e),initialMisfortuneKnightBody())||!same(e.materials,materials)||allNew.length||s.combat?.encounterId==='MISFORTUNE_KNIGHT_DISPUTE')return null;
   if(status==='READY'||s.revision===revision){
    if(!same(s.spiritWarlock.companion,companion)||!originalsUnchanged(s)||!adultsAbsent(s))return null;
    if(status==='READY'){if(!same(misfortuneKnightEncounterBudget(s),budget)||!same(misfortuneKnightFinanceSnapshot(s),finance)||s.week!==week||!same(s.date,date)||s.random.cursor!==prep.randomCursor||s.pulse!=='NONE'||s.billAmount!==0||s.activeEvent||s.eventQueue.length)return null;}
    else if(!e.journal.at(-1)||!peacefulBudgetMatches(s,e.journal.at(-1)!))return null;
   }
   return root;
  }
  const start=e.startSource;
  if(!start||!validMisfortuneKnightCombatSource(start)||!integer(e.startHistoryIndex,0,s.combatHistory.length)||e.startHistoryIndex!==e.originalHistory!.length||e.attemptWeek!==week||start.round!==1||start.revision!==revision||start.week!==week||!same(start.date,date)||start.startHistoryIndex!==e.startHistoryIndex||start.runId!==s.runId||!same(start.preparation,prep)||start.policy!==policy||!same(start.companion,companion)||!same(start.body,initialMisfortuneKnightBody())||!same(start.root,root)||!same(start.materials,materials)||start.randomSeed!==s.random.seed||start.randomCursor!==prep.randomCursor||start.playerHealth!==budget.health||start.playerMind!==budget.mind||start.playerSpirituality!==budget.spirituality||!same(start.mastery,budget.mastery)||!same(start.playerInjuries,budget.injuries)||start.playerRisk!==budget.injuryRisk)return null;
  const terminal=e.terminal;
  if(terminal&&(!shape(terminal,['outcome','round','historyIndex','enemyHealth','enemyMind','enemySpirituality','enemyStatus','exitMetres','exitSeconds'])||!integer(terminal.historyIndex,e.startHistoryIndex,s.combatHistory.length-1)))return null;
  const end=terminal?terminal.historyIndex+1:s.combatHistory.length,rounds=s.combatHistory.slice(e.startHistoryIndex,end);
  if(!same(allNew,rounds.map((_r,i)=>e.startHistoryIndex!+i)))return null;
  for(const[i,round]of rounds.entries()){const o=round.misfortuneKnightOutcome,previous=rounds[i-1]?.misfortuneKnightOutcome;if(!o||!validateMisfortuneKnightCombatRound(round)||round.round!==i+1||o.source.revision>=s.revision||o.randomCursorAfter>s.random.cursor||!same(o.source,previous?nextMisfortuneKnightCombatSource(previous):start)||!same(o.source.root,root)||i<rounds.length-1&&!o.continuing)return null;root=structuredClone(o.rootAfter);companion=structuredClone(o.companion);materials=structuredClone(o.materialsAfter);}
  const last=rounds.at(-1),o=last?.misfortuneKnightOutcome;
  if(e.status==='FIGHTING'){
   if(!same(s.spiritWarlock.companion,companion)||terminal||!hasMisfortuneKnightDisputeOpponent(s)||!same(combatBody(e),o?combatBody(o):start.body)||!same(e.materials,materials))return null;
   const current=misfortuneKnightEncounterBudget(s),expected={...budget,health:o?.playerHealthAfter??start.playerHealth,mind:o?.playerMindAfter??start.playerMind,spirituality:o?Math.min(120,o.playerSpiritualityAfter+12):start.playerSpirituality,mastery:o?.masteryAfter??start.mastery,injuries:o?.playerInjuriesAfter??start.playerInjuries,injuryRisk:o?.playerRiskAfter??start.playerRisk};
   if(!same(current,expected)||!same(misfortuneKnightFinanceSnapshot(s),finance)||s.week!==week||!same(s.date,date)||s.pulse!=='NONE'||s.billAmount!==0||s.activeEvent!==null||s.eventQueue.length)return null;
   return o?o.continuing&&same(last,s.combat!.lastRound)&&same(currentMisfortuneKnightCombatSource(s),nextMisfortuneKnightCombatSource(o))?root:null:s.combat!.lastRound===null&&same(currentMisfortuneKnightCombatSource(s),start)?root:null;
  }
  if(s.combat?.encounterId==='MISFORTUNE_KNIGHT_DISPUTE'||!terminal||!last||!o||o.continuing||terminal.round!==last.round||rounds.length!==terminal.round||!same(combatBody(e),combatBody(o))||terminal.enemyHealth!==e.enemyHealth||terminal.enemyMind!==e.enemyMind||terminal.enemySpirituality!==e.enemySpirituality||terminal.enemyStatus!==e.enemyStatus)return null;
  const final=terminalScene(o);if(terminal.exitMetres!==final.exit||terminal.exitSeconds!==final.exit||!same(e.materials,final.materials))return null;
  if(s.revision===o.source.revision+1&&(!same(s.spiritWarlock.companion,companion)||!originalsUnchanged(s)||!misfortuneKnightTerminalBudgetMatches(s,prep,o)))return null;
  if(terminal.outcome==='PLAYER_DEAD')return e.status==='LOST'&&s.status==='DEAD'&&o.playerHealthAfter===0?final.root:null;
  if(terminal.outcome==='RETREATED')return e.status==='RETREATED'&&o.playerHealthAfter>0&&(last.retreat==='SUCCESS'||o.playerMindAfter===0)?final.root:null;
  return e.status==='RESOLVED'&&o.playerHealthAfter>0&&(terminal.outcome==='ENEMY_DEAD'?e.enemyStatus==='DEAD':terminal.outcome==='ENEMY_SURRENDERED'&&e.enemyStatus==='SURRENDERED')?final.root:null;
 }catch{return null;}
}
export function validateMisfortuneKnightEncounter(s:SliceState):boolean {try{const root=replayMisfortuneKnightEncounterRoot(s);return root!==null&&same(root,s.misfortuneKnight.encounter.scene);}catch{return false;}}
export const validateMisfortuneKnightEncounterState=validateMisfortuneKnightEncounter;
/** Real commit revisions for the acquisition owner's frozen original-leaf ledger. */
export function misfortuneKnightEncounterOriginalEvents(s:SliceState):{revision:number;week:number;before:SpiritWarlockCompanion;after:SpiritWarlockCompanion}[]{return s.combatHistory.flatMap(round=>{const o=round.misfortuneKnightOutcome;return o?[{revision:o.source.revision+1,week:o.source.week,before:structuredClone(o.source.companion),after:structuredClone(o.companion)}]:[];});}
