import { publicPryerFields as publicFields, publicPryerDate } from '../sage/life.js';
import { publicAbyssOriginalSite, publicAbyssOperation, publicUncleanMonarchBudget, publicUncleanMonarchFinance, publicUncleanMonarchOriginals, publicUncleanMonarchPiece, publicUncleanMonarchPlate, publicUncleanMonarchForceReceipt } from './public.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { addGameWeeks, compareGameDates, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import type { BloodDukeOperationState } from '../blood-duke/life.js';
import type { UncleanMonarchOriginals, UncleanMonarchSite } from './types.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { uncleanMonarchLifeClosed, validateUncleanMonarchCurrentSite } from './life.js';
import { UNCLEAN_MONARCH_ENEMY_ABILITY_WHEEL, currentUncleanMonarchCombatSource, nextUncleanMonarchCombatSource, validUncleanMonarchCombatSource, validateUncleanMonarchCombatRound, validUncleanMonarchInjuries,
  type UncleanMonarchCombatSource, type UncleanMonarchRoundOutcome } from './combat.js';

export const UNCLEAN_MONARCH_TARGET_ID = 'UM1-HARLAN' as const;
export const UNCLEAN_MONARCH_SITE = 'UM1-ADJACENT-YARD' as const;
export const UNCLEAN_MONARCH_POWER_IDS = ['ARC_BOLT', 'DREAD_PULSE', 'GUARD', 'CALM_BREATH'] as const;
export type UncleanMonarchPowerId = typeof UNCLEAN_MONARCH_POWER_IDS[number];
export type UncleanMonarchEnemyIntent = UncleanMonarchPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export type UncleanMonarchPolicy = 'INHERITED_ONLY' | 'BINDING' | 'INTERFERENCE' | 'ALL' | 'ORDINARY';
export type UncleanMonarchCombatPolicy = UncleanMonarchPolicy;
export const UNCLEAN_MONARCH_POLICIES: readonly UncleanMonarchPolicy[] = ['INHERITED_ONLY','BINDING','INTERFERENCE','ALL','ORDINARY'];
const POLICY_LABELS: Record<UncleanMonarchPolicy,string> = {INHERITED_ONLY:'只用已学能力',BINDING:'允许冲动收束',INTERFERENCE:'允许定向扰动',ALL:'允许两项新能力',ORDINARY:'只作普通行动'};
export const UNCLEAN_MONARCH_POWERS = [
  { id: 'ARC_BOLT', label: '有限弧光', cost: 7, selfGain: 75 },
  { id: 'DREAD_PULSE', label: '有限惊惧刻片', cost: 7, selfGain: 65 },
  { id: 'GUARD', label: '一次屏护', cost: 4, selfGain: 0 },
  { id: 'CALM_BREATH', label: '平复呼吸、遮挡并变位', cost: 3, selfGain: 0 },
] as const;
export interface UncleanMonarchCombatPiece { id:'UM1-COMBAT-PIECE'; ownerId:'PLAYER'; location:'PLAYER'; quantity:1; initialCharges:3; charges:number; wear:number; paidPennies:30 }
export const createUncleanMonarchCombatPiece=():UncleanMonarchCombatPiece=>({id:'UM1-COMBAT-PIECE',ownerId:'PLAYER',location:'PLAYER',quantity:1,initialCharges:3,charges:3,wear:0,paidPennies:30});
export interface UncleanMonarchPlate { id:string; ownerId:typeof UNCLEAN_MONARCH_TARGET_ID; status:'HELD'|'SPENT'; usedRound:number|null; usedOrder:number|null }
export const createUncleanMonarchPlates=():UncleanMonarchPlate[]=>[1,2,3].map(n=>({id:`UM1-HARLAN-PLATE-${n}`,ownerId:UNCLEAN_MONARCH_TARGET_ID,status:'HELD',usedRound:null,usedOrder:null}));
export interface UncleanMonarchForceReceipt { id:string; targetId:typeof UNCLEAN_MONARCH_TARGET_ID; power:'ARC_BOLT'|'DREAD_PULSE'; kind:'BODY'|'MENTAL'; plateId:string; paidCost:7; round:number; order:number; atSeconds:number; position:'YARD'; visible:true; conditionVersion:number }
export type UncleanMonarchFinanceSnapshot = Pick<SliceState,'weeklyBudget'|'lifeTier'|'nextLifeTier'|'debts'|'missedWeeks'|'credit'>;
export interface UncleanMonarchEncounterBudget { cash:number; actions:number; health:number; mind:number; spirituality:number; pollution:number; gender:string; sequence:1|2; acting:number; coreStats:SliceState['character']['coreStats']; mastery:Record<string,number>; completedSources:string[]; injuries:SliceInjury[]; injuryRisk:number }
export interface UncleanMonarchPreparation {
  week:number; date:PublicGameDate; revision:number; runId:string; randomSeed:string; randomCursor:number; pricePaid:30; actionsPaid:1;
  lifeJournalLength:number; lifeClockSeconds:number; before:UncleanMonarchEncounterBudget; after:UncleanMonarchEncounterBudget; finance:UncleanMonarchFinanceSnapshot;
  site:UncleanMonarchSite; strain:number;operation:BloodDukeOperationState; originals:UncleanMonarchOriginals;
}
export type UncleanMonarchEncounterCommand = {type:'PREPARE_ENCOUNTER'|'ENCOUNTER_TALK'|'ENCOUNTER_FIGHT'|'LEAVE_ENCOUNTER'}|{type:'SET_COMBAT_POLICY';policy:UncleanMonarchPolicy};
export interface UncleanMonarchEncounterJournal { command:UncleanMonarchEncounterCommand; week:number; date:PublicGameDate; revision:number; randomCursor:number; before:UncleanMonarchEncounterBudget; after:UncleanMonarchEncounterBudget; finance:UncleanMonarchFinanceSnapshot; siteBefore:UncleanMonarchSite; siteAfter:UncleanMonarchSite }
export interface UncleanMonarchEncounterTerminal { outcome:'PLAYER_DEAD'|'RETREATED'|'ENEMY_DEAD'|'ENEMY_SURRENDERED'; round:number; historyIndex:number; enemyHealth:number; enemyMind:number; enemySpirituality:number; enemyStatus:'RESISTING'|'SURRENDERED'|'DEAD'; exitMetres:0|4; exitSeconds:0|4 }
export interface UncleanMonarchEncounterState {
  status:'AVAILABLE'|'READY'|'FIGHTING'|'RESOLVED'|'RETREATED'|'LOST'; targetId:typeof UNCLEAN_MONARCH_TARGET_ID; policy:UncleanMonarchPolicy;
  preparation:UncleanMonarchPreparation|null; approachWeek:number|null; attemptWeek:number|null; startHistoryIndex:number|null; startSource:UncleanMonarchCombatSource|null;
  startSite:UncleanMonarchSite|null; currentSite:UncleanMonarchSite|null; strain:number|null; journal:UncleanMonarchEncounterJournal[];
  yardId:typeof UNCLEAN_MONARCH_SITE; ordinaryExit:'OPEN'; enemyPosition:'YARD'; enemyDistanceMetres:2; conditionVersion:number; emotion:'ANGRY'|'CALM'; emotionObservedAt:number|null;
  enemyHealth:number; enemyMind:number; enemySpirituality:number; enemyStatus:'RESISTING'|'SURRENDERED'|'DEAD'; weaponLocation:'HAND'|'YARD'; enemyInjuries:SliceInjury[]; enemyRisk:number;
  powerUses:Record<UncleanMonarchPowerId,number>; plates:UncleanMonarchPlate[]; piece:UncleanMonarchCombatPiece|null; lastForceReceipt:UncleanMonarchForceReceipt|null; terminal:UncleanMonarchEncounterTerminal|null;
}
export function createUncleanMonarchEncounterState():UncleanMonarchEncounterState {return {status:'AVAILABLE',targetId:UNCLEAN_MONARCH_TARGET_ID,policy:'ALL',preparation:null,approachWeek:null,attemptWeek:null,startHistoryIndex:null,startSource:null,startSite:null,currentSite:null,strain:null,journal:[],yardId:UNCLEAN_MONARCH_SITE,ordinaryExit:'OPEN',enemyPosition:'YARD',enemyDistanceMetres:2,conditionVersion:1,emotion:'ANGRY',emotionObservedAt:null,enemyHealth:100,enemyMind:100,enemySpirituality:120,enemyStatus:'RESISTING',weaponLocation:'HAND',enemyInjuries:[],enemyRisk:0,powerUses:{ARC_BOLT:0,DREAD_PULSE:0,GUARD:0,CALM_BREATH:0},plates:createUncleanMonarchPlates(),piece:null,lastForceReceipt:null,terminal:null};}
export const createUncleanMonarchEncounter=createUncleanMonarchEncounterState;
export function initializeUncleanMonarchEncounterState(s:SliceState):void {const e=s.uncleanMonarch.encounter,originals=s.uncleanMonarch.sourceScene?.originals;if(!originals||e.strain!==null||e.preparation)throw new Error('原恶魔负荷只能继承一次。');e.strain=originals.strain;}
const same=(a:unknown,b:unknown)=>a===b||(a!==undefined&&b!==undefined&&stableStringify(a)===stableStringify(b));
const integer=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER):n is number=>Number.isSafeInteger(n)&&(n as number)>=min&&(n as number)<=max;
const shape=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...keys].sort());
export const isUncleanMonarchEncounterStage=(s:SliceState)=>s.progression.pathwayId==='abyss'&&s.progression.sequence===1;
export const hasUncleanMonarchEncounterLock=(s:SliceState)=>s.uncleanMonarch.encounter.preparation!==null&&['AVAILABLE','READY','FIGHTING'].includes(s.uncleanMonarch.encounter.status);
export const isInsideUncleanMonarchEncounter=hasUncleanMonarchEncounterLock;
export function validateUncleanMonarchEncounterCommand(v:unknown):v is UncleanMonarchEncounterCommand {const c=v as UncleanMonarchEncounterCommand;return !!c&&(c.type==='SET_COMBAT_POLICY'?shape(c,['type','policy'])&&UNCLEAN_MONARCH_POLICIES.includes(c.policy):shape(c,['type'])&&['PREPARE_ENCOUNTER','ENCOUNTER_TALK','ENCOUNTER_FIGHT','LEAVE_ENCOUNTER'].includes(c.type));}
export const isUncleanMonarchEncounterCommand=validateUncleanMonarchEncounterCommand;
export function uncleanMonarchFinanceSnapshot(s: UncleanMonarchFinanceSnapshot): UncleanMonarchFinanceSnapshot {
  return { weeklyBudget: s.weeklyBudget, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: structuredClone(s.debts), missedWeeks: s.missedWeeks, credit: s.credit };
}
export function validateUncleanMonarchFinanceSnapshot(v: UncleanMonarchFinanceSnapshot, week: number): boolean {
  return shape(v, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit']) && integer(v.weeklyBudget, 1, 100) && Object.hasOwn(SLICE_LIFE, v.lifeTier) && Object.hasOwn(SLICE_LIFE, v.nextLifeTier) &&
    integer(v.missedWeeks) && ['NORMAL', 'NOTICE', 'SUSPENDED'].includes(v.credit) && Array.isArray(v.debts) && v.debts.every(d => shape(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek']) &&
      typeof d.id === 'string' && !!d.id && typeof d.source === 'string' && !!d.source && integer(d.remaining) && integer(d.weeklyPayment, 1) && integer(d.createdWeek, 0, week));
}
export function uncleanMonarchEncounterBudget(s: SliceState): UncleanMonarchEncounterBudget {
  return { cash: s.cash, actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution, gender: s.character.gender,
    sequence: s.progression.sequence as 1 | 2, acting: s.progression.acting, coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources], injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function validBudget(v: UncleanMonarchEncounterBudget, revision: number): boolean {
  return shape(v, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) && integer(v.cash) &&
    integer(v.actions, 0, 100) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.pollution, 0, 100) && typeof v.gender === 'string' && [1,2].includes(v.sequence) && integer(v.acting, 0, 100) &&
    shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) && Object.values(v.coreStats).every(n => integer(n, 0, 500)) && !!v.mastery && typeof v.mastery === 'object' && !Array.isArray(v.mastery) && Object.values(v.mastery).every(n => integer(n, 0, 500)) &&
    Array.isArray(v.completedSources) && v.completedSources.every(x => typeof x === 'string' && !!x) && new Set(v.completedSources).size === v.completedSources.length && validUncleanMonarchInjuries(v.injuries, revision) && integer(v.injuryRisk);
}

export function uncleanMonarchCompletedBudgetMatches(s:SliceState,expected:UncleanMonarchEncounterBudget,finance:UncleanMonarchFinanceSnapshot,week:number,date:PublicGameDate,revision:number,randomCursor:number,anchorTitle:string):boolean {
 const current=uncleanMonarchEncounterBudget(s);
 if(!same({...current,cash:expected.cash,actions:expected.actions},expected)||s.random.cursor!==randomCursor)return false;
 const titles=['本周生活费','生活费如实记账','本周约定还款','账目结清','新的一周'];
 const receipts=s.chronicle.filter((entry,index)=>entry.id===`record-${s.revision}-${index}`&&titles.includes(entry.title));
 if(expected.actions>0||expected.health===0)return s.week===week&&same(s.date,date)&&s.actionsRemaining===expected.actions&&s.cash===expected.cash&&same(uncleanMonarchFinanceSnapshot(s),finance)&&s.pulse==='NONE'&&s.billAmount===0&&s.activeEvent===null&&s.eventQueue.length===0&&receipts.length===0;
 if(expected.actions!==0||s.status!=='ACTIVE')return false;
 const result=resolveSliceWeeklyFinance({...finance,cash:expected.cash,week,revision:revision-1,pulse:'BILL',billAmount:0}),advanced=result.eventId===null&&result.state.pulse==='ADVANCE';
 const finalFinance={...finance,...result.state,weeklyBudget:finance.weeklyBudget,lifeTier:advanced?result.state.nextLifeTier:finance.lifeTier};
 if(s.cash!==result.state.cash||!same(uncleanMonarchFinanceSnapshot(s),uncleanMonarchFinanceSnapshot(finalFinance))||s.week!==week+(advanced?1:0)||!same(s.date,advanced?addGameWeeks(date,1):date)||s.actionsRemaining!==(advanced?finance.weeklyBudget:0)||s.pulse!==(advanced?'NONE':result.state.pulse)||s.billAmount!==(advanced?0:result.state.billAmount))return false;
 const expectedReceipts=result.receipts.map(receipt=>({week,...receipt}));if(advanced)expectedReceipts.push({week:week+1,title:'新的一周',text:`日期推进7天，本周${finance.weeklyBudget}次行动。`});
 if(!same(receipts.map(({week,title,text})=>({week,title,text})),expectedReceipts))return false;
 if(result.eventId){const anchor=s.chronicle.findIndex((entry,index)=>entry.id===`record-${s.revision}-${index}`&&entry.title===anchorTitle),eventIndex=anchor+1+result.receipts.length;return anchor>=0&&s.eventQueue.length===0&&same(s.activeEvent,{id:result.eventId,instanceId:`${s.runId}:${result.eventId}:${s.revision}:${eventIndex}`});}
 return s.activeEvent===null&&s.eventQueue.length===0;
}
export function validUncleanMonarchCombatPiece(v:UncleanMonarchCombatPiece|null):boolean {return v===null||shape(v,Object.keys(createUncleanMonarchCombatPiece()))&&same({...v,charges:3,wear:0},createUncleanMonarchCombatPiece())&&integer(v.charges,0,3)&&v.wear===3-v.charges;}
export function validUncleanMonarchPlates(v:UncleanMonarchPlate[]):boolean {const initial=createUncleanMonarchPlates();return Array.isArray(v)&&v.length===3&&v.every((m,i)=>shape(m,['id','ownerId','status','usedRound','usedOrder'])&&m.id===initial[i]!.id&&m.ownerId===UNCLEAN_MONARCH_TARGET_ID&&(m.status==='HELD'?m.usedRound===null&&m.usedOrder===null:m.status==='SPENT'&&integer(m.usedRound,1)&&integer(m.usedOrder,0,11)));}
function closedSite(p:UncleanMonarchSite,originals:UncleanMonarchOriginals):boolean {
 return !!p&&validateUncleanMonarchCurrentSite(p,originals)&&p.playerLocation==='START'&&p.volunteer.location==='A'&&p.volunteer.alive&&p.volunteer.willing&&p.card.location==='NORA'&&p.guide.location==='OUTSIDE'&&p.activeCase===null;
}
/** Nora agrees to leave and walks A→START→OUTSIDE with her original card before the player enters the adjacent yard. */
export function uncleanMonarchApproachedSite(start:UncleanMonarchSite,originals:UncleanMonarchOriginals):UncleanMonarchSite {
 if(!closedSite(start,originals))throw new Error('先回门口，归还同一原卡，确认诺拉在A且愿意独立离场，罗安已在室外。');
 const p=structuredClone(start);
 p.volunteer.location='START';p.card.travelMetres+=4;p.clockSeconds+=4;
 p.volunteer.location='OUTSIDE';p.card.travelMetres+=4;p.clockSeconds+=4;
 p.playerLocation='YARD';p.playerTravelMetres+=4;p.clockSeconds+=4;return p;
}
export function leaveUncleanMonarchCombatSite(p:UncleanMonarchSite):void {if(p.playerLocation!=='YARD')throw new Error('须本人在相邻院落，才能走回4米外门口。');p.playerLocation='START';p.playerTravelMetres+=4;p.clockSeconds+=4;}
export function validateUncleanMonarchPreparation(v:unknown):v is UncleanMonarchPreparation {try{const p=v as UncleanMonarchPreparation;
 return shape(p,['week','date','revision','runId','randomSeed','randomCursor','pricePaid','actionsPaid','lifeJournalLength','lifeClockSeconds','before','after','finance','site','strain','operation','originals'])&&integer(p.week,1)&&isValidGameDate(p.date)&&integer(p.revision,1)&&typeof p.runId==='string'&&!!p.runId&&typeof p.randomSeed==='string'&&!!p.randomSeed&&integer(p.randomCursor)&&p.pricePaid===30&&p.actionsPaid===1&&integer(p.lifeJournalLength,1)&&p.lifeClockSeconds===p.site.clockSeconds&&validBudget(p.before,p.revision)&&validBudget(p.after,p.revision)&&p.before.sequence===1&&p.before.cash>=30&&p.before.actions>=2&&same(p.after,{...p.before,cash:p.before.cash-30,actions:p.before.actions-1})&&validateUncleanMonarchFinanceSnapshot(p.finance,p.week)&&closedSite(p.site,p.originals)&&integer(p.strain,0,3)&&p.strain===p.originals.strain&&p.operation.door==='OPEN'&&p.operation.inputActive===false&&p.operation.impulse===null&&p.operation.emotion===null&&p.operation.restraintUntil===null&&p.operation.hesitationUntil===null&&integer(p.operation.bellRehearsals,p.originals.operation.bellRehearsals);
 }catch{return false;}}
function otherSceneOpen(s:SliceState):boolean {return s.uncleanMonarch.preparedWeek!==null||!uncleanMonarchLifeClosed(s)||!s.uncleanMonarch.life.reflected;}
function actualYard(s:SliceState):boolean {const e=s.uncleanMonarch.encounter,originals=s.uncleanMonarch.sourceScene?.originals,p=e.currentSite;if(!originals||!p||!e.startSite||!e.preparation||e.strain===null||e.approachWeek===null||!validateUncleanMonarchCurrentSite(p,originals))return false;const expected=uncleanMonarchApproachedSite(e.startSite,originals);expected.clockSeconds=p.clockSeconds;expected.playerTravelMetres=p.playerTravelMetres;return same(expected,p)&&same(e.startSite,s.uncleanMonarch.life.site)&&p.volunteer.location==='OUTSIDE'&&e.approachWeek===s.week;}
export function blockUncleanMonarchEncounter(s:SliceState,c:UncleanMonarchEncounterCommand):string|null {
 if(!validateUncleanMonarchEncounterCommand(c))return '庭院命令无效。';const e=s.uncleanMonarch.encounter,originals=s.uncleanMonarch.sourceScene?.originals;
 if(s.status!=='ACTIVE'||!isUncleanMonarchEncounterStage(s)||s.health<=0)return '须本人仍活着且已成为污秽君王。';if(s.activeEvent||s.combat)return '先处理当前事件或战斗。';if(!s.uncleanMonarch.guidanceKnown||s.uncleanMonarch.promotionWeek===null||!originals)return '先完成真实晋升。';if(s.world.city!=='BACKLUND')return '须实际在贝克兰德。';if(otherSceneOpen(s))return '先归还原卡与本案辅助片，本人回到门口、诺拉在A持有自己的原卡，完成三案报告与反思。';
 if(c.type==='LEAVE_ENCOUNTER')return e.preparation&&['AVAILABLE','READY'].includes(e.status)&&e.currentSite?(e.status==='READY'&&!actualYard(s)?'离场位置不符。':null):'当前没有待结束的交谈。';
 if(s.mind<=0)return '先恢复精神；交谈后仍可普通离开。';
 if(c.type==='PREPARE_ENCOUNTER'){if(e.status!=='AVAILABLE'||e.preparation)return '这份辅助片只购买一次，不能重新生成或重置。';if(e.strain===null||e.strain!==originals.strain||!closedSite(s.uncleanMonarch.life.site,originals))return '先安全收尾原现场。';return s.cash<30||s.actionsRemaining<2?'购买同一战斗辅助片需30便士1行动，另留1行动选择交战。':null;}
 if(c.type==='ENCOUNTER_TALK')return e.status==='AVAILABLE'&&e.preparation&&closedSite(s.uncleanMonarch.life.site,originals)?null:'先购买辅助片并确认诺拉在A持原卡、罗安已在室外。';
 if(e.status!=='READY'||!actualYard(s))return '先实际走到庭院交谈。';if(c.type==='SET_COMBAT_POLICY')return c.policy===e.policy?'当前已经采用此策略。':null;
 return s.actionsRemaining>=1?null:'选择交战需要1行动。';
}
export const uncleanMonarchEncounterReason=blockUncleanMonarchEncounter;
function record(s:SliceState,c:UncleanMonarchEncounterCommand,before:UncleanMonarchEncounterBudget,siteBefore:UncleanMonarchSite):void {s.uncleanMonarch.encounter.journal.push({command:structuredClone(c),week:s.week,date:{...s.date},revision:s.revision+1,randomCursor:s.random.cursor,before,after:uncleanMonarchEncounterBudget(s),finance:uncleanMonarchFinanceSnapshot(s),siteBefore,siteAfter:structuredClone(s.uncleanMonarch.encounter.currentSite!)});}
export function applyUncleanMonarchEncounterCommand(s:SliceState,c:UncleanMonarchEncounterCommand,ctx:SeerContext):void {
 const reason=blockUncleanMonarchEncounter(s,c);if(reason)throw new Error(reason);const e=s.uncleanMonarch.encounter,originals=s.uncleanMonarch.sourceScene!.originals;
 if(c.type==='PREPARE_ENCOUNTER'){const before=uncleanMonarchEncounterBudget(s);s.cash-=30;s.actionsRemaining--;e.piece=createUncleanMonarchCombatPiece();e.startSite=structuredClone(s.uncleanMonarch.life.site);e.currentSite=structuredClone(e.startSite);e.preparation={week:s.week,date:{...s.date},revision:s.revision+1,runId:s.runId,randomSeed:s.random.seed,randomCursor:s.random.cursor,pricePaid:30,actionsPaid:1,lifeJournalLength:s.uncleanMonarch.life.journal.length,lifeClockSeconds:e.startSite.clockSeconds,before,after:uncleanMonarchEncounterBudget(s),finance:uncleanMonarchFinanceSnapshot(s),site:structuredClone(e.startSite),strain:e.strain!,operation:structuredClone(s.uncleanMonarch.life.operation),originals:structuredClone(originals)};ctx.note('购入独立战斗辅助片','实际支付30便士1行动，取得UM1-COMBAT-PIECE，同一辅助片只有3次；旧恶魔负荷与旧物资不补充。');return;}
 const before=uncleanMonarchEncounterBudget(s),siteBefore=structuredClone(e.currentSite!);
 if(c.type==='SET_COMBAT_POLICY'){e.policy=c.policy;record(s,c,before,siteBefore);ctx.note('选择污秽君王战斗策略',`实际策略${POLICY_LABELS[c.policy]}；不重抽、不退款、不补次数。`);return;}
 if(c.type==='ENCOUNTER_TALK'){e.currentSite=uncleanMonarchApproachedSite(e.startSite!,originals);e.approachWeek=s.week;e.emotionObservedAt=e.currentSite.clockSeconds;e.status='READY';record(s,c,before,siteBefore);ctx.note('到相邻院落交谈','诺拉自愿带着同一原卡，从A走4米4秒到门口，再走4米4秒到室外。你随后从门口走4米4秒到相邻院落，与47岁哈伦·维斯交谈；你亲眼见到他握棍、提高声音并明显愤怒。他持自己的原棍和3枚有限刻片，你仍可普通离开。');return;}
 if(c.type==='LEAVE_ENCOUNTER'){if(e.status==='READY')leaveUncleanMonarchCombatSite(e.currentSite!);e.status='RESOLVED';record(s,c,before,siteBefore);ctx.note('沿普通路和平离开相邻院落',siteBefore.playerLocation==='YARD'?'你沿4米普通路步行4秒回到门口。所有旧物与已付费用保留。':'你仍在门口，结束这次准备；已买辅助片与费用保留。');return;}
 s.actionsRemaining--;e.status='FIGHTING';e.attemptWeek=s.week;e.startHistoryIndex=s.combatHistory.length;record(s,c,before,siteBefore);s.combat={encounterId:'UNCLEAN_MONARCH_DISPUTE',round:1,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemyInjuries:structuredClone(e.enemyInjuries),enemyRisk:e.enemyRisk,enemyStatus:'RESISTING',lastRound:null};const source=currentUncleanMonarchCombatSource(s);if(!source)throw new Error('当前实际战斗来源不完整。');e.startSource={...source,revision:s.revision+1};ctx.note('选择与哈伦交战','这是额外自愿冲突，可能受伤或死亡。哈伦是独立真人，旧埃德里克、奥里克与加雷斯各自的身体、武器和原结局不变；所有成人实际在场外，没有自动盟友免伤。');
}
export const applyUncleanMonarchEncounter=applyUncleanMonarchEncounterCommand;
export const handleUncleanMonarchEncounter=applyUncleanMonarchEncounterCommand;
export function startUncleanMonarchEncounter(s:SliceState,ctx:SeerContext){applyUncleanMonarchEncounterCommand(s,{type:'ENCOUNTER_FIGHT'},ctx);}
export function hasUncleanMonarchDisputeOpponent(s:SliceState):boolean {const e=s.uncleanMonarch?.encounter,c=s.combat;return !!e&&isUncleanMonarchEncounterStage(s)&&s.status==='ACTIVE'&&s.health>0&&s.mind>0&&!s.activeEvent&&s.world.city==='BACKLUND'&&!otherSceneOpen(s)&&e.status==='FIGHTING'&&e.targetId===UNCLEAN_MONARCH_TARGET_ID&&e.terminal===null&&e.enemyStatus==='RESISTING'&&e.weaponLocation==='HAND'&&actualYard(s)&&e.attemptWeek===s.week&&c?.encounterId==='UNCLEAN_MONARCH_DISPUTE'&&c.enemyStatus==='RESISTING'&&c.enemyHealth>0&&c.enemyMind>0&&e.enemyHealth===c.enemyHealth&&e.enemyMind===c.enemyMind&&same(e.enemyInjuries,c.enemyInjuries)&&e.enemyRisk===c.enemyRisk&&integer(e.enemySpirituality,0,120)&&e.enemySpirituality===120-UNCLEAN_MONARCH_POWERS.reduce((n,p)=>n+e.powerUses[p.id]*p.cost,0)&&integer(c.round,1)&&e.startHistoryIndex!==null&&s.combatHistory.length-e.startHistoryIndex===c.round-1;}
export function settleUncleanMonarchEncounter(s:SliceState,outcome:string,ctx:SeerContext,_award?:(source:string,amount:5|8|25)=>void):void {
 const e=s.uncleanMonarch.encounter,c=s.combat;if(e.status!=='FIGHTING'||c?.encounterId!=='UNCLEAN_MONARCH_DISPUTE')throw new Error('当前没有哈伦冲突。');if(outcome==='CONTINUE')return;const last=c.lastRound,o=last?.uncleanMonarchOutcome;
 if(!['PLAYER_DEAD','RETREATED','ENEMY_DEAD','ENEMY_SURRENDERED'].includes(outcome)||e.terminal||e.startHistoryIndex===null||!last||!o||!validateUncleanMonarchCombatRound(last)||o.continuing||c.round!==last.round+1||s.combatHistory.length-e.startHistoryIndex!==last.round||!same(s.combatHistory.at(-1),last)||!same(o.siteAfter,e.currentSite)||o.strainAfter!==e.strain||o.emotion!==e.emotion||o.emotionObservedAt!==e.emotionObservedAt||!same(o.operationAfter,s.uncleanMonarch.life.operation)||!same(o.pieceAfter,e.piece)||!same(o.platesAfter,e.plates)||!same(o.masteryAfter,s.progression.mastery)||o.playerHealthAfter!==s.health||o.playerMindAfter!==s.mind||o.playerSpiritualityAfter!==s.spirituality||o.enemyHealth!==c.enemyHealth||o.enemyMind!==c.enemyMind)throw new Error('实际场景、费用与战斗结局不符。');
 const actual=o.playerHealthAfter===0?'PLAYER_DEAD':o.enemyHealth===0?'ENEMY_DEAD':o.enemyStatus==='SURRENDERED'?'ENEMY_SURRENDERED':'RETREATED';if(actual!==outcome)throw new Error('不得改写真实结局。');const exit=s.health>0?4:0;if(exit)leaveUncleanMonarchCombatSite(e.currentSite!);e.terminal={outcome:actual,round:last.round,historyIndex:s.combatHistory.length-1,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,enemyStatus:e.enemyStatus,exitMetres:exit,exitSeconds:exit};e.status=actual==='PLAYER_DEAD'?'LOST':actual==='RETREATED'?'RETREATED':'RESOLVED';s.combat=null;ctx.note('哈伦的相邻院落冲突结束',`${exit?'你沿4米普通路走4秒回到门口。':'你已死亡，原身体与所持物留在庭院。'}哈伦的真实身体、原棍、伤势与费用保留；旧埃德里克、奥里克与加雷斯、原卡与原铃及记录和旧灾难历史不变。`);
}
export const finishUncleanMonarchEncounter=settleUncleanMonarchEncounter;
export function uncleanMonarchEncounterActions(s: SliceState) {
  if (!isUncleanMonarchEncounterStage(s)) return [];
  const commands: { command: UncleanMonarchEncounterCommand; label: string; cost: string }[] = [
    { command: { type: 'PREPARE_ENCOUNTER' }, label: '购买独立战斗辅助片', cost: '30便士1行动；同一片3次' },
    { command: { type: 'ENCOUNTER_TALK' }, label: '让诺拉带原卡离场后到相邻院落交谈', cost: '0行动；诺拉8米8秒，你4米4秒' },
    { command: { type: 'ENCOUNTER_FIGHT' }, label: '选择与哈伦交战', cost: '1行动；可能受伤或死亡' },
    { command: { type: 'LEAVE_ENCOUNTER' }, label: '沿普通路和平离开', cost: '0行动；院落退出4米4秒' },
    ...UNCLEAN_MONARCH_POLICIES.map(policy => ({ command: { type: 'SET_COMBAT_POLICY' as const, policy }, label: `策略：${POLICY_LABELS[policy]}`, cost: '0行动；不改物资' })),
  ];
  return commands.map(({ command, label, cost }) => { const reason = blockUncleanMonarchEncounter(s, command); return { id: `unclean-monarch-${command.type}${command.type === 'SET_COMBAT_POLICY' ? `-${command.policy}` : ''}`, label, cost, command, enabled: reason === null, reason }; });
}
export function projectUncleanMonarchPreparation(p: UncleanMonarchPreparation) { return {
  ...publicFields(p, ['week', 'revision', 'pricePaid', 'actionsPaid', 'lifeJournalLength', 'lifeClockSeconds', 'strain']), date: publicPryerDate(p.date),
  before: publicUncleanMonarchBudget(p.before), after: publicUncleanMonarchBudget(p.after), finance: publicUncleanMonarchFinance(p.finance),
  site: publicAbyssOriginalSite(p.site), operation: publicAbyssOperation(p.operation), originals: publicUncleanMonarchOriginals(p.originals),
}; }
export type UncleanMonarchPublicPreparation = ReturnType<typeof projectUncleanMonarchPreparation>;
export function projectUncleanMonarchEncounter(s: SliceState) {
  const e = s.uncleanMonarch.encounter, visible = isUncleanMonarchEncounterStage(s);
  return { title: visible ? '相邻院落的独立争议' : '尚未开放的相邻院落', story: visible ? '47岁的哈伦·维斯在静室相邻院落提出独立通行争议。先让诺拉自愿带同一原卡实际离场，再沿普通路交谈；你可以决定是否交战，也能普通离开。' : '',
    status: e.status, inside: hasUncleanMonarchEncounterLock(s), policy: e.policy, enemyAbilityWheel: UNCLEAN_MONARCH_ENEMY_ABILITY_WHEEL.map(row => ({ ...row })),
    site: visible ? publicAbyssOriginalSite(e.currentSite ?? s.uncleanMonarch.life.site) : null, startSite: visible && e.startSite ? publicAbyssOriginalSite(e.startSite) : null,
    preparation: visible && e.preparation ? projectUncleanMonarchPreparation(e.preparation) : null, piece: visible && e.piece ? publicUncleanMonarchPiece(e.piece) : null, plates: visible ? e.plates.map(publicUncleanMonarchPlate) : [],
    strain: e.strain ?? s.uncleanMonarch.sourceScene?.originals.strain ?? s.demon.strain, emotion: e.emotion, emotionObservedAt: e.emotionObservedAt, conditionVersion: e.conditionVersion,
    operation: visible ? publicAbyssOperation(s.uncleanMonarch.life.operation) : null, lastForceReceipt: visible && e.lastForceReceipt ? publicUncleanMonarchForceReceipt(e.lastForceReceipt) : null,
    enemy: visible ? { id: e.targetId, name: '哈伦·维斯', age: 47, sequence: 1, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus,
      weaponId: 'UM1-HARLAN-ROD', weaponLocation: e.weaponLocation, position: e.enemyPosition, distanceMetres: 2, powerUses: { ...e.powerUses } } : null,
    actions: uncleanMonarchEncounterActions(s), facts: visible ? [
      '旧六槽30/15/20/20/10/5及防守、控制姿态替换保留；旧16项掌握不变，实际恶魔负荷不重置。',
      '冲动收束：8灵性2精神、意志18；20秒内下一次本人普通打击+35。',
      '定向扰动：相同成本，另需刚观察的实际强烈情绪与目标抵抗；20秒内下一可见身体或精神攻势减30以内。',
      '失败总计4精神；同一时刻一个窗口，实际应用才耗辅助片1次、磨损1。平复呼吸、遮挡变位或到期都会结束未用窗口。',
      '哈伦只有3枚原刻片；弧光身体75或惊惧精神65各耗7灵性1枚，屏护4灵性，平复呼吸并变位3灵性；不足普通棍击。',
      '体35%感30%意15%知20%；基础1500、核心上限300、底150，状态最多减40%。双方每轮1至6动作，身体与精神后果按实际攻势区分。',
      '诺拉A到门口再到室外8米8秒，原卡随她；罗安已在室外。本人门口到相邻院落4米4秒，普通退出同样4米4秒。',
    ] : [] };
}
export type UncleanMonarchEncounterProjection = ReturnType<typeof projectUncleanMonarchEncounter>;
/** Replay every scene transition and complete deterministic battle source; no predecessor root is a mutable live copy. */
export function validateUncleanMonarchEncounter(s: SliceState): boolean { try {
  const e = s.uncleanMonarch?.encounter, originals = s.uncleanMonarch?.sourceScene?.originals, initial = createUncleanMonarchEncounterState();
  if (originals && s.uncleanMonarch.promotionWeek !== null) initial.strain = originals.strain;
  if (!e || !shape(e, Object.keys(initial)) || !UNCLEAN_MONARCH_POLICIES.includes(e.policy) || !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || e.targetId !== initial.targetId || e.yardId !== initial.yardId || e.enemyPosition !== 'YARD' || e.enemyDistanceMetres !== 2 || e.ordinaryExit !== 'OPEN' || !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 0, 100) || !integer(e.enemySpirituality, 0, 120) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) || e.weaponLocation !== (e.enemyStatus === 'RESISTING' ? 'HAND' : 'YARD') || !validUncleanMonarchInjuries(e.enemyInjuries, s.revision) || !integer(e.enemyRisk) || !shape(e.powerUses, UNCLEAN_MONARCH_POWER_IDS) || !UNCLEAN_MONARCH_POWER_IDS.every(id => integer(e.powerUses[id])) || e.enemySpirituality !== 120 - UNCLEAN_MONARCH_POWERS.reduce((n, p) => n + p.cost * e.powerUses[p.id], 0) || !validUncleanMonarchPlates(e.plates) || !validUncleanMonarchCombatPiece(e.piece) || !integer(e.conditionVersion, 1) || !Array.isArray(e.journal) || !['ANGRY', 'CALM'].includes(e.emotion) || !(e.emotionObservedAt === null || integer(e.emotionObservedAt))) return false;
  const allNew = s.combatHistory.flatMap((round, index) => round.uncleanMonarchOutcome ? [index] : []);
  if (!e.preparation) return same(e, initial) && allNew.length === 0 && s.combat?.encounterId !== 'UNCLEAN_MONARCH_DISPUTE';
  const prep = e.preparation;
  if (!originals || !isUncleanMonarchEncounterStage(s) || s.uncleanMonarch.promotionWeek === null || !validateUncleanMonarchPreparation(prep) || prep.runId !== s.runId || prep.randomSeed !== s.random.seed || prep.randomCursor > s.random.cursor || !integer(prep.week, s.uncleanMonarch.promotionWeek, s.week) || compareGameDates(prep.date, s.date) > 0 || !integer(prep.revision, 1, s.revision) || prep.lifeJournalLength !== s.uncleanMonarch.life.journal.length || !same(prep.site, s.uncleanMonarch.life.site) || !same(prep.operation, s.uncleanMonarch.life.operation) || !same(prep.originals, originals) || !same(e.startSite, prep.site) || !uncleanMonarchLifeClosed(s) || !s.uncleanMonarch.life.reflected || !integer(e.strain, prep.strain, 3)) return false;
  const latestLife = s.uncleanMonarch.life.journal.at(-1);
  if (!latestLife || (['gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources'] as const).some(key => !same(prep.before[key], latestLife.after[key]))) return false;
  let site = structuredClone(prep.site), status: UncleanMonarchEncounterState['status'] = 'AVAILABLE', policy: UncleanMonarchPolicy = 'ALL';
  let budget = structuredClone(prep.after), revision = prep.revision, approachWeek: number | null = null, emotionObservedAt: number | null = null;
  for (const entry of e.journal) {
    if (!shape(entry, ['command', 'week', 'date', 'revision', 'randomCursor', 'before', 'after', 'finance', 'siteBefore', 'siteAfter']) || !validateUncleanMonarchEncounterCommand(entry.command) || !validBudget(entry.before, entry.revision) || !validBudget(entry.after, entry.revision) || entry.revision !== revision + 1 || entry.revision > s.revision || entry.week !== prep.week || !same(entry.date, prep.date) || entry.randomCursor !== prep.randomCursor || !same(entry.before, budget) || !same(entry.finance, prep.finance) || !same(entry.siteBefore, site)) return false;
    const c = entry.command;
    if (c.type === 'ENCOUNTER_TALK') { if (status !== 'AVAILABLE') return false; site = uncleanMonarchApproachedSite(site, originals); status = 'READY'; approachWeek = entry.week; emotionObservedAt = site.clockSeconds; }
    else if (c.type === 'SET_COMBAT_POLICY') { if (status !== 'READY' || c.policy === policy) return false; policy = c.policy; }
    else if (c.type === 'ENCOUNTER_FIGHT') { if (status !== 'READY' || entry.before.actions < 1) return false; status = 'FIGHTING'; }
    else if (c.type === 'LEAVE_ENCOUNTER') { if (!['AVAILABLE', 'READY'].includes(status)) return false; if (status === 'READY') leaveUncleanMonarchCombatSite(site); status = 'RESOLVED'; }
    else return false;
    if (!same(entry.after, { ...entry.before, actions: entry.before.actions - (c.type === 'ENCOUNTER_FIGHT' ? 1 : 0) }) || !same(entry.siteAfter, site)) return false;
    budget = structuredClone(entry.after); revision = entry.revision;
  }
  if (e.policy !== policy || e.approachWeek !== approachWeek) return false;
  if (status !== 'FIGHTING') {
    if (e.status !== status || !same(e.currentSite, site) || e.strain !== prep.strain || e.startHistoryIndex !== null || e.startSource !== null || e.attemptWeek !== null || e.terminal !== null || allNew.length || s.combat?.encounterId === 'UNCLEAN_MONARCH_DISPUTE' || e.emotion !== 'ANGRY' || e.emotionObservedAt !== emotionObservedAt) return false;
    const normalized = { ...e, status: initial.status, policy: initial.policy, preparation: null, approachWeek: null, startSite: null, currentSite: null, journal: [], piece: null, emotionObservedAt: null };
    if (!same(normalized, initial) || !same(e.piece, createUncleanMonarchCombatPiece())) return false;
    if (['AVAILABLE', 'READY'].includes(e.status)) return s.week === prep.week && same(s.date, prep.date) && same(uncleanMonarchEncounterBudget(s), budget) && same(uncleanMonarchFinanceSnapshot(s), prep.finance) && s.random.cursor === prep.randomCursor && s.revision === revision;
    const last = e.journal.at(-1)!; return s.revision !== last.revision || uncleanMonarchCompletedBudgetMatches(s, last.after, last.finance, last.week, last.date, last.revision, last.randomCursor, '沿普通路和平离开相邻院落');
  }
  const fight = e.journal.at(-1);
  if (!fight || fight.command.type !== 'ENCOUNTER_FIGHT' || !e.startSource || !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== fight.week || e.startSource.revision !== fight.revision || e.startSource.week !== fight.week || e.startSource.round !== 1 || e.startSource.startHistoryIndex !== e.startHistoryIndex || e.startSource.runId !== s.runId || e.startSource.randomSeed !== s.random.seed || e.startSource.randomCursor !== fight.randomCursor || !same(e.startSource.budget, fight.after) || !same(e.startSource.finance, fight.finance) || !same(e.startSource.site, site) || e.startSource.strain !== prep.strain || !same(e.startSource.operation, prep.operation) || !same(e.startSource.preparation, prep) || !same(e.startSource.originals, originals) || !same(e.startSource.piece, createUncleanMonarchCombatPiece()) || !same(e.startSource.plates, initial.plates) || e.startSource.enemyHealth !== 100 || e.startSource.enemyMind !== 100 || e.startSource.enemySpirituality !== 120 || e.startSource.enemyRisk !== 0 || e.startSource.enemyInjuries.length || !same(e.startSource.powerUses, initial.powerUses) || e.startSource.lastForceReceipt !== null || e.startSource.conditionVersion !== 1 || e.startSource.emotion !== 'ANGRY' || e.startSource.emotionObservedAt !== emotionObservedAt || e.startSource.policy !== policy || !validUncleanMonarchCombatSource(e.startSource)) return false;
  if (e.terminal && (!shape(e.terminal, ['outcome', 'round', 'historyIndex', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'exitMetres', 'exitSeconds']) || !integer(e.terminal.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1))) return false;
  const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
  if (!same(allNew, rounds.map((_round, index) => e.startHistoryIndex! + index))) return false;
  let source = e.startSource, last: UncleanMonarchRoundOutcome | null = null;
  for (const round of rounds) {
    const o = round.uncleanMonarchOutcome;
    if (!o || !validateUncleanMonarchCombatRound(round) || !same(o.source, source) || o.source.revision >= s.revision || o.randomCursorAfter > s.random.cursor || last && !last.continuing) return false;
    last = o; source = nextUncleanMonarchCombatSource(o); site = structuredClone(o.siteAfter);
  }
  if (last ? e.enemyHealth !== last.enemyHealth || e.enemyMind !== last.enemyMind || e.enemySpirituality !== last.enemySpirituality || e.enemyStatus !== last.enemyStatus || !same(e.enemyInjuries, last.enemyInjuriesAfter) || e.enemyRisk !== last.enemyRiskAfter || !same(e.powerUses, last.powerUses) || !same(e.piece, last.pieceAfter) || !same(e.plates, last.platesAfter) || e.strain !== last.strainAfter || e.emotion !== last.emotion || e.emotionObservedAt !== last.emotionObservedAt || !same(s.uncleanMonarch.life.operation, last.operationAfter) || !same(e.lastForceReceipt, last.lastForceReceipt) || e.conditionVersion !== last.conditionVersion
    : !same(e.piece, createUncleanMonarchCombatPiece()) || !same(e.plates, initial.plates) || e.strain !== prep.strain || e.emotion !== 'ANGRY' || e.emotionObservedAt !== emotionObservedAt || e.enemyHealth !== 100 || e.enemyMind !== 100 || e.enemySpirituality !== 120 || e.enemyStatus !== 'RESISTING' || e.enemyInjuries.length || e.enemyRisk !== 0 || !same(e.powerUses, initial.powerUses) || e.lastForceReceipt !== null || e.conditionVersion !== 1) return false;
  if (e.status === 'FIGHTING') return !e.terminal && (!last || last.continuing) && hasUncleanMonarchDisputeOpponent(s) && same(e.currentSite, site) && same(currentUncleanMonarchCombatSource(s), source) && same(s.combat!.lastRound, rounds.at(-1) ?? null);
  const terminal = e.terminal, round = rounds.at(-1);
  if (!terminal || !last || !round || last.continuing || s.combat?.encounterId === 'UNCLEAN_MONARCH_DISPUTE' || terminal.round !== last.round || rounds.length !== terminal.round || terminal.enemyHealth !== e.enemyHealth || terminal.enemyMind !== e.enemyMind || terminal.enemySpirituality !== e.enemySpirituality || terminal.enemyStatus !== e.enemyStatus) return false;
  const actual = last.playerHealthAfter === 0 ? 'PLAYER_DEAD' : last.enemyHealth === 0 ? 'ENEMY_DEAD' : last.enemyStatus === 'SURRENDERED' ? 'ENEMY_SURRENDERED' : 'RETREATED', exit = last.playerHealthAfter > 0 ? 4 : 0;
  if (terminal.outcome !== actual || terminal.exitMetres !== exit || terminal.exitSeconds !== exit || e.status !== (actual === 'PLAYER_DEAD' ? 'LOST' : actual === 'RETREATED' ? 'RETREATED' : 'RESOLVED')) return false;
  if (exit) leaveUncleanMonarchCombatSite(site); if (!same(e.currentSite, site)) return false;
  if (actual === 'PLAYER_DEAD' && s.status !== 'DEAD') return false;
  const expected = { ...fight.after, health: last.playerHealthAfter, mind: last.playerMindAfter, spirituality: last.playerSpiritualityAfter, mastery: last.masteryAfter, injuries: last.playerInjuriesAfter, injuryRisk: last.playerRiskAfter };
  return s.revision !== last.source.revision + 1 || uncleanMonarchCompletedBudgetMatches(s, expected, fight.finance, fight.week, fight.date, last.source.revision + 1, last.randomCursorAfter, '哈伦的相邻院落冲突结束');
} catch { return false; } }
export const validateUncleanMonarchEncounterState = validateUncleanMonarchEncounter;
export function uncleanMonarchEncounterCompletedBudget(s: SliceState): { budget: UncleanMonarchEncounterBudget; finance: UncleanMonarchFinanceSnapshot; week: number; date: PublicGameDate; revision: number; randomCursor: number } | null {
  const e = s.uncleanMonarch.encounter; if (!e.preparation || ['AVAILABLE', 'READY', 'FIGHTING'].includes(e.status)) return null;
  if (e.terminal) {
    const round = s.combatHistory[e.terminal.historyIndex], o = round?.uncleanMonarchOutcome, fight = e.journal.find(entry => entry.command.type === 'ENCOUNTER_FIGHT');
    if (!o || !fight || o.continuing || !validateUncleanMonarchCombatRound(round)) return null;
    return { budget: { ...structuredClone(fight.after), health: o.playerHealthAfter, mind: o.playerMindAfter, spirituality: o.playerSpiritualityAfter, mastery: { ...o.masteryAfter }, injuries: structuredClone(o.playerInjuriesAfter), injuryRisk: o.playerRiskAfter }, finance: structuredClone(fight.finance), week: fight.week, date: { ...fight.date }, revision: o.source.revision, randomCursor: o.randomCursorAfter };
  }
  const last = e.journal.at(-1);
  return last?.command.type === 'LEAVE_ENCOUNTER' ? { budget: structuredClone(last.after), finance: structuredClone(last.finance), week: last.week, date: { ...last.date }, revision: last.revision - 1, randomCursor: last.randomCursor } : null;
}
