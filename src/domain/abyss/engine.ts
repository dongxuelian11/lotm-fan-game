import type { SliceState } from '../slice/types.js';
import type { PublicCoreStatKey } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { addGameWeeks } from '../game-calendar.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance, resolveNormalCheck } from '../../resolution/normal-check.js';
import { createAbyssSource, validateAbyssSource, abyssBudget, type AbyssSource, type AbyssBudget } from './source.js';
import { ABYSS_ABILITY_IDS, ABYSS_GUIDANCE, ABYSS_CONSUMPTION, ABYSS_PREPARATION, ABYSS_PLACES, ABYSS_ORIGINAL_IDS, ABYSS_MIN_UNCLEAN_MONARCH_WEEKS, ABYSS_SPIRITUALITY_CAP } from './content.js';
import { createAbyssScene, abyssSceneBlock, applyAbyssScene, isAbyssSceneCommand, abyssSceneInside } from './scene.js';
import { createAbyssMaterials, abyssMaterialBlock, applyAbyssMaterial, isAbyssMaterialCommand, transportAbyssMaterials, ABYSS_HOME, ABYSS_WORKSHOP } from './materials.js';
import type { AbyssCommand, AbyssState, AbyssEvent, AbyssPreparation, AbyssSceneHost } from './types.js';
export const sameAbyss=(a:unknown,b:unknown):boolean=>stableStringify(a)===stableStringify(b);
export const abyssDigest=(v:unknown):string=>sha256Hex(stableStringify(v));
const clone=<T>(v:T):T=>structuredClone(v);
function need(value:unknown,reason:string):asserts value {if(!value)throw Error(reason);}
function dataDigest(root:AbyssState):string{const{journal:_journal,source,...data}=root;return abyssDigest({...data,source:source?{runId:source.runId,revision:source.revision,historyDigest:source.historyDigest,originalsDigest:source.originalsDigest,acquisitionDigest:source.acquisitionDigest}:null});}
export function createAbyssState():AbyssState{return {version:1,guidanceKnown:false,source:null,frame:null,promotionWeek:null,scene:null,materials:null,journal:[],promotionStability:{preparations:[]}};}
const simple=['LEARN_GUIDANCE','WORK','REST','CLINIC','NEXT_WEEK','RETURN_ON_FOOT','LEAVE_ORIGINAL_COURT','VERIFY_UNIQUENESS','ACQUIRE_UNIQUENESS','BUY_CARRIER','COMPOSE','ASK_OWNER','WITHDRAW_OWNER','APPROACH','INSPECT_EXIT','INSPECT_DEVICE','BUY_TOOLS','OPEN_EXIT','CLOSE_EXIT','REPORT_EVACUATION','START_PRACTICE','CORRODE_PIN','APPLY_CORROSION','MANUAL_INSPECTION','SENSE_DANGER','MOVE_CARGO','SECURE_CARGO','STOP_METHOD','END_CONTACT','WAIT_10','WALK_EXIT','REPORT_RETURN'];
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:object,keys:string[])=>sameAbyss(Object.keys(v).sort(),keys.sort());
const id=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=300&&v.trim()===v;
export function validateAbyssCommand(v:unknown):v is AbyssCommand {
 if(!record(v))return false;
 if(simple.includes(String(v.type)))return exact(v,['type']);
 if(v.type==='TRAVEL')return exact(v,['type','to'])&&ABYSS_PLACES.some(p=>p.id===v.to);
 if(['ASK_WORKER','WITHDRAW_WORKER','ARRIVE_WORKER','EXIT_WORKER'].includes(String(v.type)))return exact(v,['type','workerId'])&&['AB224-CORA','AB224-OSWALD'].includes(String(v.workerId));
 if(['INSPECT_SEGMENT','REMOVE_PIN','OPEN_SEGMENT','CLOSE_SEGMENT'].includes(String(v.type)))return exact(v,['type','segment'])&&['A','B'].includes(String(v.segment));
 if(v.type==='CROSS')return exact(v,['type','actorId','segment'])&&['PLAYER','AB224-CORA','AB224-OSWALD'].includes(String(v.actorId))&&['A','B'].includes(String(v.segment));
 if(['WORK_ORIGINAL','ASK_RECOVERY_PERMISSION','INVESTIGATE_REMAINS','SEAL_ORIGINAL','RECOVER_ORIGINAL'].includes(String(v.type)))return exact(v,['type','originalId'])&&ABYSS_ORIGINAL_IDS.some(x=>x===v.originalId);
 if(['STABILIZE_PROMOTION','SEAL_REMAINS','RECOVER_REMAINS'].includes(String(v.type)))return exact(v,['type','compoundId'])&&id(v.compoundId);
 return v.type==='CONSUME'&&exact(v,['type','compoundId','confirmed'])&&id(v.compoundId)&&v.confirmed===true;
}
declare const abyssOwnedEngineBrand:unique symbol;
export interface AbyssOwnedEngine {readonly [abyssOwnedEngineBrand]:true}
const owned=new WeakMap<AbyssOwnedEngine,AbyssState>();
function getOwned(head:AbyssOwnedEngine):AbyssState{const root=owned.get(head);need(root,'无效的当前领域会话。');return root;}
function retain(root:AbyssState):AbyssOwnedEngine{const h=Object.freeze({})as AbyssOwnedEngine;owned.set(h,root);return h;}
function pay(b:AbyssBudget,c:{actions?:number;cash?:number;spirituality?:number;mind?:number;health?:number;pollution?:number}):void {
 need(b.actions>=(c.actions??0)&&b.cash>=(c.cash??0)&&b.spirituality>=(c.spirituality??0),'实际行动、现款、灵性或精神不足。');
 b.actions-=c.actions??0;b.cash-=c.cash??0;b.spirituality-=c.spirituality??0;b.mind=Math.max(0,b.mind-(c.mind??0));b.health=Math.max(0,b.health-(c.health??0));b.pollution=Math.min(100,b.pollution+(c.pollution??0));
 if(b.health===0||b.mind===0||b.pollution>=100){b.status='DEAD';b.health=0;}
}
function start(source:AbyssSource):AbyssState {
 const root=createAbyssState();root.guidanceKnown=true;root.source=clone(source);
 const nowSecond=source.originals.site.clockSeconds;
 root.frame={budget:clone(source.budget),finance:clone(source.finance),random:{...source.random},location:source.originals.site.playerLocation==='START'?'AB224-COURT-ENTRY':'AB224-COURT-OUTSIDE',nowSecond,weekAnchor:nowSecond};
 pay(root.frame.budget,ABYSS_GUIDANCE);root.scene=createAbyssScene(source);root.materials=createAbyssMaterials(source);return root;
}
export function startAbyss(s:SliceState):AbyssState{return start(createAbyssSource(s));}
export function abyssInsideCase(root:AbyssState):boolean{return !!root.scene&&abyssSceneInside(root.scene);}
export function abyssHost(root:AbyssState,eventId:string,revision:number):AbyssSceneHost{
 const f=root.frame!,b=f.budget;return {eventId,revision,week:b.week,second:f.nowSecond,actorId:root.source!.actorId,sequence:b.sequence,actions:b.actions,cash:b.cash,health:b.health,mind:b.mind,spirituality:b.spirituality};
}
function preparation(root:AbyssState,compoundId:string):AbyssPreparation|null {
 const f=root.frame!,p=root.materials!.compounds.find(x=>x.id===compoundId);
 return root.promotionStability.preparations.find(x=>x.status==='READY'&&x.compoundId===compoundId&&x.actorId===root.source!.actorId&&x.sourceDigest===root.source!.historyDigest&&p?.status==='PREPARED'&&x.compoundDigest===abyssDigest(p)&&x.location===f.location&&x.evacuationReportEventId===root.scene!.evacuationReportEventId&&f.nowSecond>=x.preparedSecond&&f.nowSecond<=x.expiresSecond)??null;
}
function consumeBlock(root:AbyssState,compoundId:string,forPreparation=false):string|null {
 const f=root.frame!,b=f.budget,p=root.materials!.compounds.find(x=>x.id===compoundId);
 if(b.sequence!==1||root.promotionWeek!==null||b.acting!==100)return '须由已经完整消化的污秽君王本人服药。';
 if(b.week-root.source!.acquisition.promotionWeek<ABYSS_MIN_UNCLEAN_MONARCH_WEEKS)return '成为污秽君王尚未满十二个实际周，可先正常工作与休养。';
 if(!root.scene!.evacuationReportEventId||abyssInsideCase(root))return '先完成两位成人的真实通行、逐人普通退出和现场报告。';
 if(f.location!==ABYSS_WORKSHOP||p?.status!=='PREPARED'||p.location!==f.location)return '本人和同一瓶实际成药须在封闭调配室。';
 if(b.health<ABYSS_CONSUMPTION.minimumHealth||b.mind<ABYSS_CONSUMPTION.minimumMind+(forPreparation?ABYSS_PREPARATION.mind:0)||b.injuries.length)return '先恢复至80健康与足够精神，并实际处置和养好旧伤。';
 if(b.pollution>ABYSS_CONSUMPTION.maximumPollution)return '须通过实际休养消退全部污染后才能准备或服药。';
 if(b.actions<ABYSS_CONSUMPTION.actions+(forPreparation?ABYSS_PREPARATION.actions:0))return forPreparation?'准备前须留足本周两行动，分别支付稳定准备与实际服药。':'实际服药需要1行动。';
 if(b.spirituality<ABYSS_CONSUMPTION.spirituality+(forPreparation?ABYSS_PREPARATION.spirituality:0))return '须保留实际准备和服药所需灵性。';
 return null;
}
export function getAbyssPromotionStabilityPreview(root:AbyssState,compoundId:string){
 const b=root.frame!.budget,ready=!!preparation(root,compoundId);let reason=consumeBlock(root,compoundId,true);
 if(!reason&&ready)reason='同一瓶本次稳定准备仍然有效。';
 if(!reason&&b.cash<ABYSS_PREPARATION.cash)reason='本次稳定准备需要实付150便士。';
 const input={baseAbility:b.coreStats.will,difficulty:ABYSS_CONSUMPTION.difficulty};
 return {eligible:reason===null,reason,prepared:ready,cost:ABYSS_PREPARATION,chance:computeCheckChance({...input,modifiers:ready?[{source:'本瓶本次实际稳定准备',value:ABYSS_CONSUMPTION.preparedBonus}]:[]}),preparedChance:computeCheckChance({...input,modifiers:[{source:'本瓶本次实际稳定准备',value:ABYSS_CONSUMPTION.preparedBonus}]})};
}
function commandBlock(root:AbyssState,c:AbyssCommand,revision:number):string|null {
 if(!validateAbyssCommand(c)||c.type==='LEARN_GUIDANCE')return '这项行动无效或已经听取指导。';
 const f=root.frame,b=f?.budget;
 if(!root.guidanceKnown||!root.source||!f||!b||b.status!=='ACTIVE')return '已经死亡或结束的角色不能继续行动。';
 if(revision!==root.source.revision+2+root.journal.length)return '本次实际动作次序无效。';
 const sceneAction=isAbyssSceneCommand(c);
 if(abyssInsideCase(root)&&!sceneAction)return root.scene!.playerPosition==='ORIGINAL_ENTRY'?'先沿原路实际走出原安静室入口。':'先停止短窗、松开接触，并逐人沿普通侧门退出和关闭现场。';
 if(sceneAction){
  if(c.type==='LEAVE_ORIGINAL_COURT'){
   if(f.location!=='AB224-COURT-ENTRY')return '本人已经实际离开原入口，不能重复记一次出院。';
  }else if(f.location!==ABYSS_HOME)return '本人须先沿普通道路实际到达货栈交接处。';
  return abyssSceneBlock(root.scene!,c,abyssHost(root,`R224:${root.source.runId}:${revision}`,revision));
 }
 if(c.type==='NEXT_WEEK')return null;
 if(c.type==='WORK')return f.finance.wagePaidWeek===b.week?'本周原职业工资已经实付。':b.actions<1?'实际工作需要1行动。':null;
 if(c.type==='REST')return b.actions<1?'实际休养需要1行动，可先到下一真实周。':null;
 if(c.type==='CLINIC')return !b.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null)?'没有尚未处置的重伤。':b.actions<1||b.cash<60?'普通处置需要1行动和60便士。':null;
 if(c.type==='TRAVEL')return c.to==='AB224-COURT-ENTRY'?'本章不重新进入已经收尾的原安静室。':c.to===f.location?'本人已经在这里。':b.actions<1?'普通步行前往需要1行动，可免费沿普通路回货栈外。':null;
 if(c.type==='RETURN_ON_FOOT')return f.location===ABYSS_HOME?'本人已经在货栈外。':null;
 if(isAbyssMaterialCommand(c))return abyssMaterialBlock(root,c);
 if(c.type==='STABILIZE_PROMOTION')return getAbyssPromotionStabilityPreview(root,c.compoundId).reason;
 if(c.type==='CONSUME')return consumeBlock(root,c.compoundId);
 return '当前没有这项行动。';
}
/** Every real weekly boundary uses ordinary finance; no automatic wages or healing. */
function elapse(root:AbyssState,seconds:number,revision:number,eventId:string,receipts:AbyssEvent['financeReceipts']):void {
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
function reduce(root:AbyssState,c:AbyssCommand,revision:number):AbyssEvent {
 const reason=commandBlock(root,c,revision);need(reason===null,reason??'当前无法行动。');
 const f=root.frame!,b=f.budget,eventId=`R224:${root.source!.runId}:${revision}`,before=clone(f),beforeDigest=dataDigest(root),financeReceipts:AbyssEvent['financeReceipts']=[],randomReceipts:AbyssEvent['randomReceipts']=[],notes:string[]=[];
 const time=(seconds:number)=>elapse(root,seconds,revision,eventId,financeReceipts);
 const check=(ability:PublicCoreStatKey,difficulty:number,bonus=0)=>{const cursorBefore=f.random.cursor,rng=new DeterministicActionRandomStream(f.random.seed,cursorBefore);const result=resolveNormalCheck({ability,baseAbility:b.coreStats[ability],difficulty,modifiers:bonus?[{source:'本瓶本次实际稳定准备',value:bonus}]:[],roll:rng.nextInt(1,100)});f.random.cursor=rng.cursor;randomReceipts.push({id:`${eventId}:check:${randomReceipts.length+1}`,check:result,cursorBefore,cursorAfter:rng.cursor});return result;};
 if(c.type==='WORK'){pay(b,{actions:1});b.cash+=root.source!.character.weeklyWage;f.finance.wagePaidWeek=b.week;time(28800);notes.push(`实际完成原职业工作，${root.source!.character.weeklyWage}便士本周工资入账。`);}
 else if(c.type==='REST'){pay(b,{actions:1});const life=SLICE_LIFE[f.finance.lifeTier],cap=b.sequence===0?ABYSS_SPIRITUALITY_CAP:120;b.health=Math.min(100,b.health+life.health);b.mind=Math.min(100,b.mind+life.mind);b.spirituality=Math.min(cap,b.spirituality+Math.round(cap*life.spirituality));b.pollution=Math.max(0,b.pollution-10);b.injuries=b.injuries.filter(i=>!(b.health>=80&&i.acquiredRevision<revision&&(i.severity==='LIGHT'||i.treatedRevision!==null&&i.treatedRevision<revision)));if(!b.injuries.length)b.injuryRisk=0;time(28800);notes.push('按实际生活档休养八小时；未处置的重伤、原件耗费和他人身体继续保留。');}
 else if(c.type==='CLINIC'){pay(b,{actions:1,cash:60});for(const i of b.injuries)if(i.severity==='HEAVY'&&i.treatedRevision===null)i.treatedRevision=revision;time(3600);notes.push('实付60便士普通处置重伤，仍须之后实际休养。');}
 else if(c.type==='NEXT_WEEK'){b.actions=0;time(f.weekAnchor+604800-f.nowSecond);notes.push('经过下一真实周界，生活费与既有还款照常结算；没有自动工资、治疗或补货。');}
 else if(c.type==='TRAVEL'||c.type==='RETURN_ON_FOOT'){const from=f.location;if(c.type==='TRAVEL')pay(b,{actions:1});f.location=c.type==='TRAVEL'?c.to:ABYSS_HOME;transportAbyssMaterials(root.materials!,from,f.location);const metres=c.type==='TRAVEL'?1800:7200;root.scene!.playerTravelMetres+=metres;for(const segment of Object.values(root.scene!.segments))if(segment.pin.position==='PLAYER'){segment.pin.location='OUTSIDE';segment.pin.travelMetres+=metres;segment.pin.version++;}root.scene!.moves.push({eventId,actorId:'PLAYER',from:'OUTSIDE',to:'OUTSIDE',metres,seconds:metres,cargoId:null});time(metres);notes.push(c.type==='TRAVEL'?'本人携实际随身原件沿普通道路步行半小时抵达。':'本人携随身原件沿普通道路步行两小时回货栈外，不需要现款或行动。');}
 else if(isAbyssSceneCommand(c)){
  const result=applyAbyssScene(root.scene!,c,abyssHost(root,eventId,revision),(ability,difficulty)=>check(ability,difficulty));root.scene=result.state;pay(b,result.effect);time(result.effect.seconds);
  if(c.type==='LEAVE_ORIGINAL_COURT'){transportAbyssMaterials(root.materials!,f.location,'AB224-COURT-OUTSIDE');f.location='AB224-COURT-OUTSIDE';}
  for(const ability of result.effect.mastery??[]){need(ABYSS_ABILITY_IDS.some(x=>x===ability),'有限能力的应用记录无效。');b.mastery[ability]=Math.min(500,(b.mastery[ability]??0)+8);}notes.push(...result.notes);
 }
 else if(isAbyssMaterialCommand(c)){const result=applyAbyssMaterial(root,c,eventId,()=>check('knowledge',30));pay(b,result.effect);time(result.effect.seconds);notes.push(...result.notes);}
 else if(c.type==='STABILIZE_PROMOTION'){
  pay(b,ABYSS_PREPARATION);time(ABYSS_PREPARATION.seconds);const p=root.materials!.compounds.find(x=>x.id===c.compoundId)!;
  root.promotionStability.preparations.push({id:`${eventId}:preparation`,compoundId:p.id,actorId:root.source!.actorId,sourceDigest:root.source!.historyDigest,compoundDigest:abyssDigest(p),evacuationReportEventId:root.scene!.evacuationReportEventId!,location:f.location,preparedSecond:f.nowSecond,expiresSecond:f.nowSecond+ABYSS_PREPARATION.validSeconds,status:'READY',spentEventId:null});notes.push('实付1行动、150便士、12灵性、8精神与一小时，完成绑定本人、同一成药、现场与通行报告的一次稳定准备；离场、改变原件或超过七日即失效。');
 }
 else if(c.type==='CONSUME'){
  const ready=preparation(root,c.compoundId),p=root.materials!.compounds.find(x=>x.id===c.compoundId)!;pay(b,{actions:ABYSS_CONSUMPTION.actions,spirituality:ABYSS_CONSUMPTION.spirituality});if(ready){ready.status='SPENT';ready.spentEventId=eventId;}
  const result=check('will',ABYSS_CONSUMPTION.difficulty,ready?ABYSS_CONSUMPTION.preparedBonus:0),success=result.tier==='SUCCESS'||result.tier==='GREAT_SUCCESS';p.consumedEventId=eventId;
  if(success){b.mind=Math.max(0,b.mind-ABYSS_CONSUMPTION.successMind);b.sequence=0;b.acting=0;root.promotionWeek=b.week;if(!b.completedSources.includes('abyss-s0'))b.completedSources.push('abyss-s0');for(const ability of ABYSS_ABILITY_IDS)b.mastery[ability]=0;p.status='SUCCESS';for(const original of root.materials!.originals){original.holder='FUSED';original.location=null;original.compoundId=p.id;}Object.assign(root.materials!.uniqueness,{holder:'FUSED',compoundId:p.id,location:f.location});notes.push(`意志检定${result.roll}/${result.chance}，实际成为深渊；同一三份原特性与唯一性融合。精神减少12，原有掌握逐值保留，两项新掌握从零开始；灵性上限150，当前没有补满。`);}
  else {const severe=result.tier==='GREAT_FAILURE';b.health=Math.max(0,b.health-(severe?ABYSS_CONSUMPTION.greatFailureHealth:ABYSS_CONSUMPTION.failureHealth));b.mind=Math.max(0,b.mind-(severe?ABYSS_CONSUMPTION.greatFailureMind:ABYSS_CONSUMPTION.failureMind));b.pollution=Math.min(100,b.pollution+(severe?ABYSS_CONSUMPTION.greatFailurePollution:ABYSS_CONSUMPTION.failurePollution));if(b.health===0||b.mind===0||b.pollution>=100){b.status='DEAD';b.health=0;}b.injuries.push({id:`${eventId}:promotion-injury`,severity:'HEAVY',acquiredRevision:revision,treatedRevision:null});b.injuryRisk+=2;p.status=b.status==='ACTIVE'?'FAILED_EXPOSED':'DEATH_REMAINS';for(const original of root.materials!.originals)if(p.originalIds.includes(original.originalId)||b.status!=='ACTIVE'){original.holder=b.status==='ACTIVE'?'LOCATED':'DEATH_REMAINS';original.location=f.location;original.compoundId=p.id;}Object.assign(root.materials!.uniqueness,{holder:b.status==='ACTIVE'?'EXPOSED':'DEATH_REMAINS',location:f.location,compoundId:p.id});notes.push(b.status==='ACTIVE'?`意志检定${result.roll}/${result.chance}，服药失败，健康减45、精神减40、污染加35并留下重伤。第三份仍在存活本体内，两份原件与唯一性留下同一份残余。`:`意志检定${result.roll}/${result.chance}，严重排异导致死亡；同一三份原特性与唯一性留在死亡现场，周目终止。`);}
  time(60);
 }
 if(b.status!=='ACTIVE'){root.scene!.window=null;root.scene!.contact=false;root.scene!.status='ABORTED';if(b.sequence===0){for(const original of root.materials!.originals){original.holder='DEATH_REMAINS';original.location=f.location;}root.materials!.uniqueness.holder='DEATH_REMAINS';root.materials!.uniqueness.location=f.location;for(const compound of root.materials!.compounds)if(compound.status==='SUCCESS'){compound.status='DEATH_REMAINS';compound.location=f.location;}}}
 for(const p of root.promotionStability.preparations)if(p.status==='READY'&&preparation(root,p.compoundId)?.id!==p.id)p.status='INVALIDATED';
 const event:AbyssEvent={id:eventId,revision,command:clone(c),before,after:clone(f),randomReceipts,financeReceipts,notes,beforeDigest,afterDigest:dataDigest(root)};root.journal.push(event);return event;
}
/** A cold load authenticates the complete predecessor chain and replays every
 * committed command. A hash, caller hint or public certificate cannot bypass it. */
function reconstruct(s:SliceState):AbyssState {
 const saved=s.abyss;need(saved?.source&&validateAbyssSource(s,saved.source,'COLD_REOPEN'),'原身份、原人原物和三份特性历史未通过核验。');need(Array.isArray(saved.journal),'实际动作记录无效。');
 const root=start(clone(saved.source));for(const event of saved.journal){need(event&&event.revision===saved.source.revision+2+root.journal.length,'本章行动次序不一致。');const actual=reduce(root,clone(event.command),event.revision);need(sameAbyss(actual,event),'实际行动、检定和代价与原记录不一致。');}need(sameAbyss(root,saved),'当前原物与身体不能由实际行动重建。');
 const f=root.frame!,source=root.source!,{coreStats:_current,...identity}=s.character,{coreStats:_original,...originalIdentity}=source.character;
 need(s.progression.pathwayId==='abyss'&&s.revision===source.revision+1+root.journal.length&&sameAbyss(abyssBudget(s),f.budget)&&sameAbyss(s.random,f.random),'当前身体与实际行动终点不一致。');need(sameAbyss(identity,originalIdentity)&&Object.entries(f.finance).every(([key,value])=>sameAbyss(s[key as keyof SliceState],value)),'当前身份或生活账本不一致。');need(s.combat===null&&s.activeEvent===null&&s.eventQueue.length===0&&s.pulse==='NONE','旧现场终点不一致。');return root;
}
export function validateAbyssRoot(s:SliceState):void{reconstruct(s);}
export function transitionAbyss(s:SliceState,c:AbyssCommand):AbyssState{const root=reconstruct(s);reduce(root,clone(c),s.revision+1);return root;}
export function openAbyssOwnedEngine(s:SliceState):AbyssOwnedEngine{return retain(reconstruct(clone(s)));}
export function snapshotAbyssOwnedEngine(h:AbyssOwnedEngine):AbyssState{return clone(getOwned(h));}
export function advanceAbyssOwnedEngine(h:AbyssOwnedEngine,c:AbyssCommand,revision:number):AbyssOwnedEngine{const next=clone(getOwned(h));reduce(next,clone(c),revision);return retain(next);}
export function blockAbyssOwnedEngine(h:AbyssOwnedEngine,c:AbyssCommand,revision:number):string|null{try{return commandBlock(getOwned(h),c,revision);}catch{return '当前实际记录或行动条件无效。';}}
