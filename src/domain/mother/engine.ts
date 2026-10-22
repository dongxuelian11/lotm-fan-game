import type { SliceState } from '../slice/types.js';
import type { PublicCoreStatKey } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { addGameWeeks, gameDaysBetween } from '../game-calendar.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance, resolveNormalCheck } from '../../resolution/normal-check.js';
import { createMotherSource, validateMotherSource, motherBudget, type MotherSource, type MotherBudget } from './source.js';
import { MOTHER_ABILITY_IDS, MOTHER_GUIDANCE, MOTHER_CONSUMPTION, MOTHER_PREPARATION, MOTHER_PLACES, MOTHER_ORIGINAL_IDS, MOTHER_MIN_NATURE_WALKER_WEEKS, MOTHER_SPIRITUALITY_CAP } from './content.js';
import { createMotherScene, motherSceneBlock, applyMotherScene, isMotherSceneCommand, motherSceneInside } from './scene.js';
import { createMotherMaterials, motherMaterialBlock, applyMotherMaterial, isMotherMaterialCommand, transportMotherMaterials, MOTHER_HOME, MOTHER_WORKSHOP } from './materials.js';
import type { MotherCommand, MotherState, MotherEvent, MotherPreparation, MotherSceneHost } from './types.js';
export const sameMother=(a:unknown,b:unknown):boolean=>stableStringify(a)===stableStringify(b);
export const motherDigest=(v:unknown):string=>sha256Hex(stableStringify(v));
const clone=<T>(v:T):T=>structuredClone(v);
function need(value:unknown,reason:string):asserts value {if(!value)throw Error(reason);}
function dataDigest(root:MotherState):string{const{journal:_journal,source,...data}=root;return motherDigest({...data,source:source?{runId:source.runId,revision:source.revision,historyDigest:source.historyDigest,originalsDigest:source.originalsDigest,acquisitionDigest:source.acquisitionDigest}:null});}
export function createMotherState():MotherState{return {version:1,guidanceKnown:false,source:null,frame:null,promotionWeek:null,scene:null,materials:null,journal:[],promotionStability:{preparations:[]}};}
const simple=['LEARN_GUIDANCE','WORK','REST','CLINIC','NEXT_WEEK','RETURN_ON_FOOT','LEAVE_ORIGINAL_NURSERY','VERIFY_UNIQUENESS','ACQUIRE_UNIQUENESS','BUY_CARRIER','COMPOSE','INSPECT_GREENHOUSE','REPAIR_GREENHOUSE','BUY_SUPPLIES','REPORT_GREENHOUSE','START_PRACTICE','STOP_METHOD','END_CONTACT','WAIT_10','WALK_EXIT','ENTER_GREENHOUSE','REPORT_RETURN'];
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:object,keys:string[])=>sameMother(Object.keys(v).sort(),keys.sort());
const id=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=300&&v.trim()===v;
export function validateMotherCommand(v:unknown):v is MotherCommand {
 if(!record(v))return false;
 if(simple.includes(String(v.type)))return exact(v,['type']);
 if(v.type==='TRAVEL')return exact(v,['type','to'])&&MOTHER_PLACES.some(p=>p.id===v.to);
 if(['ASK_OWNER','WITHDRAW_PERMISSION'].includes(String(v.type)))return exact(v,['type','personId'])&&['CB3-ADA','CB3-LENA'].includes(String(v.personId));
 if(['TAKE_PLANT','PLACE_PLANT','RETURN_PLANT','WATER_PLANT','SUPPORT_PLANT','MAINTAIN_VITALITY','APPLY_MAINTENANCE','ORDINARY_MAINTENANCE','TOUCH_BRANCH','SUPPORT_BRANCH','APPLY_BRANCH_SUPPORT'].includes(String(v.type)))return exact(v,['type','sampleId'])&&['CB3-LIVE-1','CB3-LIVE-2'].includes(String(v.sampleId));
 if(v.type==='CARRY_PLANT')return exact(v,['type','sampleId','to'])&&['CB3-LIVE-1','CB3-LIVE-2'].includes(String(v.sampleId))&&['OUTSIDE','GREENHOUSE'].includes(String(v.to));
 if(['WORK_ORIGINAL','ASK_RECOVERY_PERMISSION','INVESTIGATE_REMAINS','SEAL_ORIGINAL','RECOVER_ORIGINAL'].includes(String(v.type)))return exact(v,['type','originalId'])&&MOTHER_ORIGINAL_IDS.some(x=>x===v.originalId);
 if(['STABILIZE_PROMOTION','SEAL_REMAINS','RECOVER_REMAINS'].includes(String(v.type)))return exact(v,['type','compoundId'])&&id(v.compoundId);
 return v.type==='CONSUME'&&exact(v,['type','compoundId','confirmed'])&&id(v.compoundId)&&v.confirmed===true;
}
declare const motherOwnedEngineBrand:unique symbol;
export interface MotherOwnedEngine {readonly [motherOwnedEngineBrand]:true}
const owned=new WeakMap<MotherOwnedEngine,MotherState>();
function getOwned(head:MotherOwnedEngine):MotherState{const root=owned.get(head);need(root,'无效的当前领域会话。');return root;}
function retain(root:MotherState):MotherOwnedEngine{const h=Object.freeze({})as MotherOwnedEngine;owned.set(h,root);return h;}
function pay(b:MotherBudget,c:{actions?:number;cash?:number;spirituality?:number;mind?:number;health?:number;pollution?:number}):void {
 need(b.actions>=(c.actions??0)&&b.cash>=(c.cash??0)&&b.spirituality>=(c.spirituality??0)&&b.mind>=(c.mind??0),'实际行动、现款、灵性或精神不足。');
 b.actions-=c.actions??0;b.cash-=c.cash??0;b.spirituality-=c.spirituality??0;b.mind=Math.max(0,b.mind-(c.mind??0));b.health=Math.max(0,b.health-(c.health??0));b.pollution=Math.min(100,b.pollution+(c.pollution??0));
 if(b.health===0||b.mind===0||b.pollution>=100){b.status='DEAD';b.health=0;}
}
function start(source:MotherSource):MotherState {
 const root=createMotherState();root.guidanceKnown=true;root.source=clone(source);
 const nowSecond=source.originals.site.clockSeconds;
 root.frame={budget:clone(source.budget),finance:clone(source.finance),random:{...source.random},location:source.originals.site.playerLocation==='START'?'MO229-NURSERY-ENTRY':'MO229-NURSERY-OUTSIDE',nowSecond,weekAnchor:nowSecond};
 pay(root.frame.budget,MOTHER_GUIDANCE);root.scene=createMotherScene(source);root.materials=createMotherMaterials(source);return root;
}
export function startMother(s:SliceState):MotherState{return start(createMotherSource(s));}
export function motherInsideCase(root:MotherState):boolean{return !!root.scene&&motherSceneInside(root.scene);}
export function motherHost(root:MotherState,eventId:string,revision:number):MotherSceneHost{
 const f=root.frame!,b=f.budget;return {eventId,revision,week:b.week,second:f.nowSecond,actorId:root.source!.actorId,sequence:b.sequence,actions:b.actions,cash:b.cash,health:b.health,mind:b.mind,spirituality:b.spirituality};
}
function preparation(root:MotherState,compoundId:string):MotherPreparation|null {
 const f=root.frame!,p=root.materials!.compounds.find(x=>x.id===compoundId);
 return root.promotionStability.preparations.find(x=>x.status==='READY'&&x.compoundId===compoundId&&x.actorId===root.source!.actorId&&x.sourceDigest===root.source!.historyDigest&&p?.status==='PREPARED'&&x.compoundDigest===motherDigest(p)&&x.location===f.location&&x.greenhouseReportEventId===root.scene!.greenhouseReportEventId&&f.nowSecond>=x.preparedSecond&&f.nowSecond<=x.expiresSecond)??null;
}
function consumeBlock(root:MotherState,compoundId:string,forPreparation=false):string|null {
 const f=root.frame!,b=f.budget,p=root.materials!.compounds.find(x=>x.id===compoundId);
 if(b.sequence!==1||root.promotionWeek!==null||b.acting!==100)return '须由已经完整消化的自然行者本人服药。';
 if((b.week-root.source!.acquisition.promotionWeek<MOTHER_MIN_NATURE_WALKER_WEEKS||gameDaysBetween(root.source!.acquisition.promotionDate,b.date)<MOTHER_MIN_NATURE_WALKER_WEEKS*7))return '成为自然行者尚未满十二个实际周，可先正常工作与休养。';
 if(!root.scene!.greenhouseReportEventId||motherInsideCase(root))return '先完成风损修复、两株原苗实际供水楔撑与原路归还报告。';
 if(f.location!==MOTHER_WORKSHOP||p?.status!=='PREPARED'||p.location!==f.location)return '本人和同一瓶实际成药须在封闭调配室。';
 if(b.health<MOTHER_CONSUMPTION.minimumHealth||b.mind<MOTHER_CONSUMPTION.minimumMind+(forPreparation?MOTHER_PREPARATION.mind:0)||b.injuries.length)return '先恢复至80健康与足够精神，并实际处置和养好旧伤。';
 if(b.pollution>MOTHER_CONSUMPTION.maximumPollution)return '须通过实际休养消退全部污染后才能准备或服药。';
 if(b.actions<MOTHER_CONSUMPTION.actions+(forPreparation?MOTHER_PREPARATION.actions:0))return forPreparation?'准备前须留足本周两行动，分别支付稳定准备与实际服药。':'实际服药需要1行动。';
 if(b.spirituality<MOTHER_CONSUMPTION.spirituality+(forPreparation?MOTHER_PREPARATION.spirituality:0))return '须保留实际准备和服药所需灵性。';
 return null;
}
export function getMotherPromotionStabilityPreview(root:MotherState,compoundId:string){
 const b=root.frame!.budget,ready=!!preparation(root,compoundId);let reason=consumeBlock(root,compoundId,true);
 if(!reason&&ready)reason='同一瓶本次稳定准备仍然有效。';
 if(!reason&&b.cash<MOTHER_PREPARATION.cash)reason='本次稳定准备需要实付150便士。';
 const input={baseAbility:b.coreStats.will,difficulty:MOTHER_CONSUMPTION.difficulty};
 return {eligible:reason===null,reason,prepared:ready,cost:MOTHER_PREPARATION,chance:computeCheckChance({...input,modifiers:ready?[{source:'本瓶本次实际稳定准备',value:MOTHER_CONSUMPTION.preparedBonus}]:[]}),preparedChance:computeCheckChance({...input,modifiers:[{source:'本瓶本次实际稳定准备',value:MOTHER_CONSUMPTION.preparedBonus}]})};
}
function commandBlock(root:MotherState,c:MotherCommand,revision:number):string|null {
 if(!validateMotherCommand(c)||c.type==='LEARN_GUIDANCE')return '这项行动无效或已经听取指导。';
 const f=root.frame,b=f?.budget;
 if(!root.guidanceKnown||!root.source||!f||!b||b.status!=='ACTIVE')return '已经死亡或结束的角色不能继续行动。';
 if(revision!==root.source.revision+2+root.journal.length)return '本次实际动作次序无效。';
 const sceneAction=isMotherSceneCommand(c);
 if(motherInsideCase(root)&&!sceneAction)return root.scene!.playerPosition==='ORIGINAL_ENTRY'?'先沿原路实际走出原苗圃入口。':'先停止短窗、松开接触，亲携实际借用原苗沿普通路线退出并当面归还。';
 if(sceneAction){
  if(c.type==='LEAVE_ORIGINAL_NURSERY'){
   if(f.location!=='MO229-NURSERY-ENTRY')return '本人已经实际走出原苗圃入口，不能重复记一次离场。';
  }else if(f.location!==MOTHER_HOME)return '本人须先沿普通道路实际到达温室交接处。';
  return motherSceneBlock(root.scene!,c,motherHost(root,`R229:${root.source.runId}:${revision}`,revision));
 }
 if(c.type==='NEXT_WEEK')return null;
 if(c.type==='WORK')return f.finance.wagePaidWeek===b.week?'本周原职业工资已经实付。':b.actions<1?'实际工作需要1行动。':null;
 if(c.type==='REST')return b.actions<1?'实际休养需要1行动，可先到下一真实周。':null;
 if(c.type==='CLINIC')return !b.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null)?'没有尚未处置的重伤。':b.actions<1||b.cash<60?'普通处置需要1行动和60便士。':null;
 if(c.type==='TRAVEL')return c.to==='MO229-NURSERY-ENTRY'?'本章不重新进入已经收尾的原苗圃。':c.to===f.location?'本人已经在这里。':b.actions<1?'普通步行前往需要1行动，可免费沿普通路回温室外。':null;
 if(c.type==='RETURN_ON_FOOT')return f.location===MOTHER_HOME?'本人已经在温室外。':null;
 if(isMotherMaterialCommand(c))return motherMaterialBlock(root,c);
 if(c.type==='STABILIZE_PROMOTION')return getMotherPromotionStabilityPreview(root,c.compoundId).reason;
 if(c.type==='CONSUME')return consumeBlock(root,c.compoundId);
 return '当前没有这项行动。';
}
/** Every real weekly boundary uses ordinary finance; no automatic wages or healing. */
function elapse(root:MotherState,seconds:number,revision:number,eventId:string,receipts:MotherEvent['financeReceipts']):void {
 const f=root.frame!,b=f.budget;need(Number.isSafeInteger(seconds)&&seconds>=0,'实际用时无效。');const target=f.nowSecond+seconds;
 while(target>=f.weekAnchor+604800){
  let result=resolveSliceWeeklyFinance({...f.finance,week:b.week,revision,cash:b.cash,pulse:'BILL',billAmount:0});receipts.push(...result.receipts);
  if(result.eventId==='LIFE-BILL-01'){
   const due=SLICE_LIFE[result.state.lifeTier].cost,paid=result.state.cash;result.state.cash=0;result.state.debts.push({id:`${eventId}:living-debt:${b.week}`,source:'生活应付款',remaining:due-paid,weeklyPayment:30,createdWeek:b.week});result.state.nextLifeTier='DESTITUTE';result.state.pulse='DEBTS';receipts.push({title:'本周生活应付款',text:`已付${paid}便士，未付${due-paid}便士如实记欠。`});result=resolveSliceWeeklyFinance(result.state);receipts.push(...result.receipts);
  }
  b.cash=result.state.cash;const{nextLifeTier,debts,missedWeeks,credit}=result.state;Object.assign(f.finance,{lifeTier:nextLifeTier,nextLifeTier,debts:clone(debts),missedWeeks,credit});b.week++;b.date=addGameWeeks(b.date,1);b.actions=f.finance.weeklyBudget;f.weekAnchor+=604800;
 }
 f.nowSecond=target;
}
function reduce(root:MotherState,c:MotherCommand,revision:number):MotherEvent {
 const reason=commandBlock(root,c,revision);need(reason===null,reason??'当前无法行动。');
 const f=root.frame!,b=f.budget,eventId=`R229:${root.source!.runId}:${revision}`,before=clone(f),beforeDigest=dataDigest(root),financeReceipts:MotherEvent['financeReceipts']=[],randomReceipts:MotherEvent['randomReceipts']=[],notes:string[]=[];
 const time=(seconds:number)=>elapse(root,seconds,revision,eventId,financeReceipts);
 const check=(ability:PublicCoreStatKey,difficulty:number,bonus=0)=>{const cursorBefore=f.random.cursor,rng=new DeterministicActionRandomStream(f.random.seed,cursorBefore);const result=resolveNormalCheck({ability,baseAbility:b.coreStats[ability],difficulty,modifiers:bonus?[{source:'本瓶本次实际稳定准备',value:bonus}]:[],roll:rng.nextInt(1,100)});f.random.cursor=rng.cursor;randomReceipts.push({id:`${eventId}:check:${randomReceipts.length+1}`,check:result,cursorBefore,cursorAfter:rng.cursor});return result;};
 if(c.type==='WORK'){pay(b,{actions:1});b.cash+=root.source!.character.weeklyWage;f.finance.wagePaidWeek=b.week;time(28800);notes.push(`实际完成原职业工作，${root.source!.character.weeklyWage}便士本周工资入账。`);}
 else if(c.type==='REST'){pay(b,{actions:1});const life=SLICE_LIFE[f.finance.lifeTier],cap=b.sequence===0?MOTHER_SPIRITUALITY_CAP:120;b.health=Math.min(100,b.health+life.health);b.mind=Math.min(100,b.mind+life.mind);b.spirituality=Math.min(cap,b.spirituality+Math.round(cap*life.spirituality));b.pollution=Math.max(0,b.pollution-10);b.injuries=b.injuries.filter(i=>!(b.health>=80&&i.acquiredRevision<revision&&(i.severity==='LIGHT'||i.treatedRevision!==null&&i.treatedRevision<revision)));if(!b.injuries.length)b.injuryRisk=0;time(28800);notes.push('按实际生活档休养八小时；未处置的重伤、原件耗费和他人身体继续保留。');}
 else if(c.type==='CLINIC'){pay(b,{actions:1,cash:60});for(const i of b.injuries)if(i.severity==='HEAVY'&&i.treatedRevision===null)i.treatedRevision=revision;time(3600);notes.push('实付60便士普通处置重伤，仍须之后实际休养。');}
 else if(c.type==='NEXT_WEEK'){b.actions=0;time(f.weekAnchor+604800-f.nowSecond);notes.push('经过下一真实周界，生活费与既有还款照常结算；没有自动工资、治疗或补货。');}
 else if(c.type==='TRAVEL'||c.type==='RETURN_ON_FOOT'){const from=f.location;if(c.type==='TRAVEL')pay(b,{actions:1});f.location=c.type==='TRAVEL'?c.to:MOTHER_HOME;transportMotherMaterials(root.materials!,from,f.location);const metres=c.type==='TRAVEL'?1800:7200;root.scene!.playerTravelMetres+=metres;root.scene!.moves.push({eventId,from:'OUTSIDE',to:'OUTSIDE',metres,seconds:metres,sampleId:null});time(metres);notes.push(c.type==='TRAVEL'?'本人携实际随身原件沿普通道路步行半小时抵达。':'本人携随身原件沿普通道路步行两小时回温室外，不需要现款或行动。');}
 else if(isMotherSceneCommand(c)){
  const result=applyMotherScene(root.scene!,c,motherHost(root,eventId,revision),(ability,difficulty)=>check(ability,difficulty));root.scene=result.state;pay(b,result.effect);time(result.effect.seconds);
  if(c.type==='LEAVE_ORIGINAL_NURSERY'){transportMotherMaterials(root.materials!,f.location,'MO229-NURSERY-OUTSIDE');f.location='MO229-NURSERY-OUTSIDE';}
  for(const ability of result.effect.mastery??[]){need(MOTHER_ABILITY_IDS.some(x=>x===ability),'有限能力的应用记录无效。');b.mastery[ability]=Math.min(500,(b.mastery[ability]??0)+8);}notes.push(...result.notes);
 }
 else if(isMotherMaterialCommand(c)){const result=applyMotherMaterial(root,c,eventId,()=>check('knowledge',18));pay(b,result.effect);time(result.effect.seconds);notes.push(...result.notes);}
 else if(c.type==='STABILIZE_PROMOTION'){
  pay(b,MOTHER_PREPARATION);time(MOTHER_PREPARATION.seconds);const p=root.materials!.compounds.find(x=>x.id===c.compoundId)!;
  root.promotionStability.preparations.push({id:`${eventId}:preparation`,compoundId:p.id,actorId:root.source!.actorId,sourceDigest:root.source!.historyDigest,compoundDigest:motherDigest(p),greenhouseReportEventId:root.scene!.greenhouseReportEventId!,location:f.location,preparedSecond:f.nowSecond,expiresSecond:f.nowSecond+MOTHER_PREPARATION.validSeconds,status:'READY',spentEventId:null});notes.push('实付1行动、150便士、12灵性、8精神与一小时，完成绑定本人、同一成药、现场与温室交还报告的一次稳定准备；离场、改变原件或超过七日即失效。');
 }
 else if(c.type==='CONSUME'){
  const ready=preparation(root,c.compoundId),p=root.materials!.compounds.find(x=>x.id===c.compoundId)!;pay(b,{actions:MOTHER_CONSUMPTION.actions,spirituality:MOTHER_CONSUMPTION.spirituality});if(ready){ready.status='SPENT';ready.spentEventId=eventId;}
  const result=check('will',MOTHER_CONSUMPTION.difficulty,ready?MOTHER_CONSUMPTION.preparedBonus:0),success=result.tier==='SUCCESS'||result.tier==='GREAT_SUCCESS';p.consumedEventId=eventId;
  if(success){b.mind=Math.max(0,b.mind-MOTHER_CONSUMPTION.successMind);b.sequence=0;b.acting=0;root.promotionWeek=b.week;if(!b.completedSources.includes('mother-s0'))b.completedSources.push('mother-s0');for(const ability of MOTHER_ABILITY_IDS)b.mastery[ability]=0;p.status='SUCCESS';for(const original of root.materials!.originals){original.holder='FUSED';original.location=null;original.compoundId=p.id;}Object.assign(root.materials!.uniqueness,{holder:'FUSED',compoundId:p.id,location:f.location});notes.push(`意志检定${result.roll}/${result.chance}，实际成为母亲；同一三份原特性与唯一性融合。精神减少12，原有掌握逐值保留，两项新掌握从零开始；灵性上限150，当前没有补满。`);}
  else {const severe=result.tier==='GREAT_FAILURE';b.health=Math.max(0,b.health-(severe?MOTHER_CONSUMPTION.greatFailureHealth:MOTHER_CONSUMPTION.failureHealth));b.mind=Math.max(0,b.mind-(severe?MOTHER_CONSUMPTION.greatFailureMind:MOTHER_CONSUMPTION.failureMind));b.pollution=Math.min(100,b.pollution+(severe?MOTHER_CONSUMPTION.greatFailurePollution:MOTHER_CONSUMPTION.failurePollution));if(b.health===0||b.mind===0||b.pollution>=100){b.status='DEAD';b.health=0;}b.injuries.push({id:`${eventId}:promotion-injury`,severity:'HEAVY',acquiredRevision:revision,treatedRevision:null});b.injuryRisk+=2;p.status=b.status==='ACTIVE'?'FAILED_EXPOSED':'DEATH_REMAINS';for(const original of root.materials!.originals)if(p.originalIds.includes(original.originalId)||b.status!=='ACTIVE'){original.holder=b.status==='ACTIVE'?'LOCATED':'DEATH_REMAINS';original.location=f.location;original.compoundId=p.id;}Object.assign(root.materials!.uniqueness,{holder:b.status==='ACTIVE'?'EXPOSED':'DEATH_REMAINS',location:f.location,compoundId:p.id});notes.push(b.status==='ACTIVE'?`意志检定${result.roll}/${result.chance}，服药失败，健康减45、精神减40、污染加35并留下重伤。第三份仍在存活本体内，两份原件与唯一性留下同一份残余。`:`意志检定${result.roll}/${result.chance}，严重排异导致死亡；同一三份原特性与唯一性留在死亡现场，周目终止。`);}
  time(60);
 }
 if(b.status!=='ACTIVE'){root.scene!.window=null;root.scene!.contactSampleId=null;root.scene!.status='ABORTED';if(b.sequence===0){for(const original of root.materials!.originals){original.holder='DEATH_REMAINS';original.location=f.location;}root.materials!.uniqueness.holder='DEATH_REMAINS';root.materials!.uniqueness.location=f.location;for(const compound of root.materials!.compounds)if(compound.status==='SUCCESS'){compound.status='DEATH_REMAINS';compound.location=f.location;}}}
 for(const p of root.promotionStability.preparations)if(p.status==='READY'&&preparation(root,p.compoundId)?.id!==p.id)p.status='INVALIDATED';
 const event:MotherEvent={id:eventId,revision,command:clone(c),before,after:clone(f),randomReceipts,financeReceipts,notes,beforeDigest,afterDigest:dataDigest(root)};root.journal.push(event);return event;
}
/** A cold load authenticates the complete predecessor chain and replays every
 * committed command. A hash, caller hint or public certificate cannot bypass it. */
function reconstruct(s:SliceState):MotherState {
 const saved=s.mother;need(saved?.source&&validateMotherSource(s,saved.source,'COLD_REOPEN'),'原身份、原人原物和三份特性历史未通过核验。');need(Array.isArray(saved.journal),'实际动作记录无效。');
 const root=start(clone(saved.source));for(const event of saved.journal){need(event&&event.revision===saved.source.revision+2+root.journal.length,'本章行动次序不一致。');const actual=reduce(root,clone(event.command),event.revision);need(sameMother(actual,event),'实际行动、检定和代价与原记录不一致。');}need(sameMother(root,saved),'当前原物与身体不能由实际行动重建。');
 const f=root.frame!,source=root.source!,{coreStats:_current,...identity}=s.character,{coreStats:_original,...originalIdentity}=source.character;
 need(s.progression.pathwayId==='mother'&&s.revision===source.revision+1+root.journal.length&&sameMother(motherBudget(s),f.budget)&&sameMother(s.random,f.random),'当前身体与实际行动终点不一致。');need(sameMother(identity,originalIdentity)&&Object.entries(f.finance).every(([key,value])=>sameMother(s[key as keyof SliceState],value)),'当前身份或生活账本不一致。');need(s.combat===null&&s.activeEvent===null&&s.eventQueue.length===0&&s.pulse==='NONE','旧现场终点不一致。');return root;
}
export function validateMotherRoot(s:SliceState):void{reconstruct(s);}
export function transitionMother(s:SliceState,c:MotherCommand):MotherState{const root=reconstruct(s);reduce(root,clone(c),s.revision+1);return root;}
export function openMotherOwnedEngine(s:SliceState):MotherOwnedEngine{return retain(reconstruct(clone(s)));}
export function snapshotMotherOwnedEngine(h:MotherOwnedEngine):MotherState{return clone(getOwned(h));}
export function advanceMotherOwnedEngine(h:MotherOwnedEngine,c:MotherCommand,revision:number):MotherOwnedEngine{const next=clone(getOwned(h));reduce(next,clone(c),revision);return retain(next);}
export function blockMotherOwnedEngine(h:MotherOwnedEngine,c:MotherCommand,revision:number):string|null{try{return commandBlock(getOwned(h),c,revision);}catch{return '当前实际记录或行动条件无效。';}}
