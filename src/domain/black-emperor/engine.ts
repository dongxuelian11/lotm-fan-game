import type { SliceState } from '../slice/types.js';
import type { PublicCoreStatKey } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { addGameWeeks } from '../game-calendar.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance, resolveNormalCheck } from '../../resolution/normal-check.js';
import { createBlackEmperorSource, validateBlackEmperorSource, blackEmperorBudget, type BlackEmperorSource, type BlackEmperorBudget } from './source.js';
import { BLACK_EMPEROR_ABILITY_IDS, BLACK_EMPEROR_GUIDANCE, BLACK_EMPEROR_CONSUMPTION, BLACK_EMPEROR_PREPARATION, BLACK_EMPEROR_PLACES, BLACK_EMPEROR_ORIGINAL_IDS, BLACK_EMPEROR_MIN_PRINCE_OF_ABOLITION_WEEKS, BLACK_EMPEROR_SPIRITUALITY_CAP, BLACK_EMPEROR_CITIES } from './content.js';
import { createBlackEmperorScene, blackEmperorSceneBlock, applyBlackEmperorScene, isBlackEmperorSceneCommand, blackEmperorSceneInside, blackEmperorCurrentFestival, blackEmperorRitualBlock, blackEmperorAllTombs } from './scene.js';
import { createBlackEmperorMaterials, blackEmperorMaterialBlock, applyBlackEmperorMaterial, isBlackEmperorMaterialCommand, transportBlackEmperorMaterials, BLACK_EMPEROR_HOME, BLACK_EMPEROR_WORKSHOP } from './materials.js';
import type { BlackEmperorCommand, BlackEmperorState, BlackEmperorEvent, BlackEmperorPreparation, BlackEmperorSceneHost } from './types.js';
export const sameBlackEmperor=(a:unknown,b:unknown):boolean=>stableStringify(a)===stableStringify(b);
export const blackEmperorDigest=(v:unknown):string=>sha256Hex(stableStringify(v));
const clone=<T>(v:T):T=>structuredClone(v);
function need(value:unknown,reason:string):asserts value {if(!value)throw Error(reason);}
function dataDigest(root:BlackEmperorState):string{const{journal:_journal,source,...data}=root;return blackEmperorDigest({...data,source:source?{runId:source.runId,revision:source.revision,historyDigest:source.historyDigest,originalsDigest:source.originalsDigest,acquisitionDigest:source.acquisitionDigest}:null});}
export function createBlackEmperorState():BlackEmperorState{return {version:1,guidanceKnown:false,source:null,frame:null,promotionWeek:null,scene:null,materials:null,journal:[],promotionStability:{preparations:[]}};}
const simple=['LEARN_GUIDANCE','WORK','REST','CLINIC','NEXT_WEEK','RETURN_ON_FOOT','LEAVE_ORIGINAL_COURT','VERIFY_UNIQUENESS','ACQUIRE_UNIQUENESS','BUY_CARRIER','COMPOSE','INSPECT_EXIT','FOUND_REALM','PREPARE_FESTIVAL','HOLD_FESTIVAL','LEAVE_MAUSOLEUM','START_PRACTICE','ASK_WORKERS','WITHDRAW_WORKERS','EXIT_WORKERS','INSPECT_DEVICE','BUY_TOOLS','APPROACH','DISTORT_ORDER','RELEASE_LOAD','ARM_IMPACT','DELAY_IMPACT','WAIT_10','SECURE_LOAD','STOP_MECHANISM','STOP_METHOD','END_CONTACT','WALK_EXIT','CLOSE_EXIT','REPORT_RETURN'];
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:object,keys:string[])=>sameBlackEmperor(Object.keys(v).sort(),keys.sort());
const id=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=300&&v.trim()===v;
export function validateBlackEmperorCommand(v:unknown):v is BlackEmperorCommand {
 if(!record(v))return false;
 if(simple.includes(String(v.type)))return exact(v,['type']);
 if(v.type==='TRAVEL')return exact(v,['type','to'])&&BLACK_EMPEROR_PLACES.some(p=>p.id===v.to);
 if(['SOLVE_CITY_TASK','IMPLEMENT_ORDERS','NEXT_CONSTRUCTION'].includes(String(v.type)))return exact(v,['type','cityId'])&&BLACK_EMPEROR_CITIES.some(x=>x.id===v.cityId);
 if(['REPAIR_TOMB','ENTER_MAUSOLEUM'].includes(String(v.type)))return exact(v,['type','tombId'])&&BLACK_EMPEROR_CITIES.some(x=>[1,2,3].some(n=>`${x.id}-TOMB-${n}`===v.tombId));
 if(['WORK_ORIGINAL','ASK_RECOVERY_PERMISSION','INVESTIGATE_REMAINS','SEAL_ORIGINAL','RECOVER_ORIGINAL'].includes(String(v.type)))return exact(v,['type','originalId'])&&BLACK_EMPEROR_ORIGINAL_IDS.some(x=>x===v.originalId);
 if(['STABILIZE_PROMOTION','SEAL_REMAINS','RECOVER_REMAINS'].includes(String(v.type)))return exact(v,['type','compoundId'])&&id(v.compoundId);
 return v.type==='CONSUME'&&exact(v,['type','compoundId','confirmed'])&&id(v.compoundId)&&v.confirmed===true;
}
declare const blackEmperorOwnedEngineBrand:unique symbol;
export interface BlackEmperorOwnedEngine {readonly [blackEmperorOwnedEngineBrand]:true}
const owned=new WeakMap<BlackEmperorOwnedEngine,BlackEmperorState>();
function getOwned(head:BlackEmperorOwnedEngine):BlackEmperorState{const root=owned.get(head);need(root,'无效的当前领域会话。');return root;}
function retain(root:BlackEmperorState):BlackEmperorOwnedEngine{const h=Object.freeze({})as BlackEmperorOwnedEngine;owned.set(h,root);return h;}
function pay(b:BlackEmperorBudget,c:{actions?:number;cash?:number;spirituality?:number;mind?:number;health?:number;pollution?:number}):void {
 need(b.actions>=(c.actions??0)&&b.cash>=(c.cash??0)&&b.spirituality>=(c.spirituality??0),'实际行动、现款、灵性或精神不足。');
 b.actions-=c.actions??0;b.cash-=c.cash??0;b.spirituality-=c.spirituality??0;b.mind=Math.max(0,b.mind-(c.mind??0));b.health=Math.max(0,b.health-(c.health??0));b.pollution=Math.min(100,b.pollution+(c.pollution??0));
 if(b.health===0||b.mind===0||b.pollution>=100){b.status='DEAD';b.health=0;}
}
function start(source:BlackEmperorSource):BlackEmperorState {
 const root=createBlackEmperorState();root.guidanceKnown=true;root.source=clone(source);
 const nowSecond=source.originals.site.clockSeconds;
 root.frame={budget:clone(source.budget),finance:clone(source.finance),random:{...source.random},location:source.originals.site.playerLocation==='START'?'BE227-COURT-ENTRY':'BE227-COURT-OUTSIDE',nowSecond,weekAnchor:nowSecond};
 pay(root.frame.budget,BLACK_EMPEROR_GUIDANCE);root.scene=createBlackEmperorScene(source);root.materials=createBlackEmperorMaterials(source);return root;
}
export function startBlackEmperor(s:SliceState):BlackEmperorState{return start(createBlackEmperorSource(s));}
export function blackEmperorInsideCase(root:BlackEmperorState):boolean{return !!root.scene&&blackEmperorSceneInside(root.scene);}
/** Quote every real weekly living and existing debt payment without awarding wages. */
export function blackEmperorConstructionPersonalCost(root:BlackEmperorState,weeks=3):number {
 const f=root.frame!,b=f.budget;let finance=clone(f.finance),week=b.week,total=0;
 for(let i=0;i<weeks;i++){
  const cash=1_000_000_000,result=resolveSliceWeeklyFinance({...finance,week,revision:root.source!.revision+2+root.journal.length,cash,pulse:'BILL',billAmount:0});
  total+=cash-result.state.cash;finance={...finance,lifeTier:result.state.nextLifeTier,nextLifeTier:result.state.nextLifeTier,debts:clone(result.state.debts),missedWeeks:result.state.missedWeeks,credit:result.state.credit};week++;
 }return total;
}
export function blackEmperorRouteExhausted(root:BlackEmperorState):boolean {
 const m=root.materials!,scene=root.scene!,b=root.frame!.budget,festival=blackEmperorCurrentFestival(scene);
 if(b.sequence!==1)return false;
 if(!m.carriers.some(x=>x.status!=='SPENT')&&!m.compounds.some(x=>['PREPARED','FAILED_EXPOSED','FAILED_SEALED'].includes(x.status)))return true;
 const currentUsable=festival&&!festival.consumedEventId&&(!festival.heldEventId||festival.opportunityWeek===b.week);
 return !!scene.realm.charterEventId&&!currentUsable&&scene.realm.cities.some(c=>c.stocks.cash<150||c.stocks.food<600||c.stocks.labourDays<180);
}
export function blackEmperorHost(root:BlackEmperorState,eventId:string,revision:number):BlackEmperorSceneHost{
 const f=root.frame!,b=f.budget;return {eventId,revision,week:b.week,second:f.nowSecond,actorId:root.source!.actorId,sequence:b.sequence,actions:b.actions,cash:b.cash,health:b.health,mind:b.mind,spirituality:b.spirituality,dosePrepared:root.materials!.compounds.some(p=>p.status==='PREPARED'&&p.location===f.location),mature:b.week-root.source!.acquisition.promotionWeek>=BLACK_EMPEROR_MIN_PRINCE_OF_ABOLITION_WEEKS,actualName:root.source!.character.name,constructionPersonalCost:blackEmperorConstructionPersonalCost(root),canCloseUnpromoted:blackEmperorRouteExhausted(root)};
}
function preparation(root:BlackEmperorState,compoundId:string):BlackEmperorPreparation|null {
 const f=root.frame!,p=root.materials!.compounds.find(x=>x.id===compoundId);
 return root.promotionStability.preparations.find(x=>x.status==='READY'&&x.compoundId===compoundId&&x.actorId===root.source!.actorId&&x.sourceDigest===root.source!.historyDigest&&p?.status==='PREPARED'&&x.compoundDigest===blackEmperorDigest(p)&&x.location===f.location&&x.festivalId===blackEmperorCurrentFestival(root.scene!)?.id&&f.nowSecond>=x.preparedSecond&&f.nowSecond<=x.expiresSecond)??null;
}
export function blackEmperorConsumeBlock(root:BlackEmperorState,compoundId:string,forPreparation=false):string|null {
 const f=root.frame!,b=f.budget,p=root.materials!.compounds.find(x=>x.id===compoundId),scene=root.scene!,festival=blackEmperorCurrentFestival(scene);
 if(b.sequence!==1||root.promotionWeek!==null||b.acting!==100)return '须由已经完整消化的弑序亲王本人服药。';
 if(b.week-root.source!.acquisition.promotionWeek<BLACK_EMPEROR_MIN_PRINCE_OF_ABOLITION_WEEKS)return '成为弑序亲王尚未满十二个实际周，可先正常工作与休养。';
 const ritual=blackEmperorRitualBlock(scene,blackEmperorHost(root,'preview',root.source!.revision+2+root.journal.length));if(ritual)return ritual;
 if(f.location!==BLACK_EMPEROR_HOME||p?.status!=='PREPARED'||p.location!==f.location)return '本人须携同一成药实际到达国度议事所及相连陵道。';
 if(forPreparation){if(scene.playerPosition!=='OUTSIDE')return '先沿普通陵道走回室外照护处准备。';if(!festival||festival.heldEventId)return '先实际筹备本次多城祭祀，再在举行前准备同一瓶。';}
 else {
  if(!festival?.heldEventId||festival.opportunityWeek!==b.week||festival.consumedEventId||festival.expiresSecond===null||f.nowSecond>festival.expiresSecond)return '须在这次已经真实举行的多城祭祀当周服药，旧祭祀不能复用。';
  if(festival.participation.length!==3||scene.realm.cities.some(city=>{const record=festival.participation.find(x=>x.cityId===city.id);return !record||record.population!==city.population||record.participants<=city.population/2||record.participants>city.population||record.actualName!==root.source!.character.name||!record.emperorAcknowledged;})||festival.participation.reduce((n,x)=>n+x.participants,0)<=scene.realm.totalPopulation/2)return '同一九万人及每座城市都须已有真实多数居民参加本次祭祀。';
  const tomb=blackEmperorAllTombs(scene).find(x=>x.id===scene.enteredTombId);if(scene.playerPosition!=='MAUSOLEUM'||!scene.tombEntryEventId||!tomb||tomb.stage!==3||tomb.integrity!==100)return '本人须实际走入九座完好陵寝中的一座，再在陵内饮药。';
  if(!preparation(root,compoundId))return '本瓶本次实际付费准备必须仍然有效；先准备再举行新的多城祭祀。';
 }
 if(b.health<BLACK_EMPEROR_CONSUMPTION.minimumHealth||b.mind<BLACK_EMPEROR_CONSUMPTION.minimumMind+(forPreparation?BLACK_EMPEROR_PREPARATION.mind:0)||b.injuries.length)return '先恢复至80健康与足够精神，并实际处置和养好旧伤。';
 if(b.pollution>BLACK_EMPEROR_CONSUMPTION.maximumPollution)return '须通过实际休养消退全部污染后才能准备或服药。';
 if(b.actions<BLACK_EMPEROR_CONSUMPTION.actions+(forPreparation?BLACK_EMPEROR_PREPARATION.actions:0))return forPreparation?'准备前须留足本周两行动，分别支付稳定准备与实际服药。':'实际服药需要1行动。';
 if(b.spirituality<BLACK_EMPEROR_CONSUMPTION.spirituality+(forPreparation?BLACK_EMPEROR_PREPARATION.spirituality:0))return '须保留实际准备和服药所需灵性。';
 return null;
}
export function getBlackEmperorPromotionStabilityPreview(root:BlackEmperorState,compoundId:string){
 const b=root.frame!.budget,ready=!!preparation(root,compoundId);let reason=blackEmperorConsumeBlock(root,compoundId,true);
 if(!reason&&ready)reason='同一瓶本次稳定准备仍然有效。';
 if(!reason&&b.cash<BLACK_EMPEROR_PREPARATION.cash)reason='本次稳定准备需要实付150便士。';
 const input={baseAbility:b.coreStats.will,difficulty:BLACK_EMPEROR_CONSUMPTION.difficulty};
 return {eligible:reason===null,reason,prepared:ready,cost:BLACK_EMPEROR_PREPARATION,chance:computeCheckChance({...input,modifiers:ready?[{source:'本瓶本次实际稳定准备',value:BLACK_EMPEROR_CONSUMPTION.preparedBonus}]:[]}),preparedChance:computeCheckChance({...input,modifiers:[{source:'本瓶本次实际稳定准备',value:BLACK_EMPEROR_CONSUMPTION.preparedBonus}]})};
}
function commandBlock(root:BlackEmperorState,c:BlackEmperorCommand,revision:number):string|null {
 if(!validateBlackEmperorCommand(c)||c.type==='LEARN_GUIDANCE')return '这项行动无效或已经听取指导。';
 const f=root.frame,b=f?.budget;
 if(!root.guidanceKnown||!root.source||!f||!b||b.status!=='ACTIVE')return '已经死亡或结束的角色不能继续行动。';
 if(revision!==root.source.revision+2+root.journal.length)return '本次实际动作次序无效。';
 const sceneAction=isBlackEmperorSceneCommand(c);
 const safeOriginalRest = root.scene!.playerPosition==='ORIGINAL_ENTRY' && ['WORK','REST','CLINIC','NEXT_WEEK'].includes(c.type);
 const ritualConsume = c.type==='CONSUME' && root.scene!.playerPosition==='MAUSOLEUM';
 if(blackEmperorInsideCase(root)&&!sceneAction&&!safeOriginalRest&&!ritualConsume)return root.scene!.playerPosition==='ORIGINAL_ENTRY'?'先沿原路实际走出原演练房入口。':'先沿普通陵道或设施通道真实退出，停止短窗并让成年人离开。';
 if(sceneAction){
  if(c.type==='LEAVE_ORIGINAL_COURT'){
   if(f.location!=='BE227-COURT-ENTRY')return '本人已经实际离开原入口，不能重复记一次出院。';
  }else if(f.location!==BLACK_EMPEROR_HOME)return '本人须先沿普通道路实际到达议事所。';
  if(c.type==='HOLD_FESTIVAL'&&!root.materials!.compounds.some(p=>p.status==='PREPARED'&&preparation(root,p.id)))return '先为同一瓶完成本次真实付费准备，再举行祭祀。';
  return blackEmperorSceneBlock(root.scene!,c,blackEmperorHost(root,`BE227:${root.source.runId}:${revision}`,revision));
 }
 if(c.type==='NEXT_WEEK')return null;
 if(c.type==='WORK')return f.finance.wagePaidWeek===b.week?'本周原职业工资已经实付。':b.actions<1?'实际工作需要1行动。':null;
 if(c.type==='REST')return b.actions<1?'实际休养需要1行动，可先到下一真实周。':null;
 if(c.type==='CLINIC')return !b.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null)?'没有尚未处置的重伤。':b.actions<1||b.cash<60?'普通处置需要1行动和60便士。':null;
 if(c.type==='TRAVEL')return c.to==='BE227-COURT-ENTRY'?'本章不重新进入已经收尾的原演练房。':c.to===f.location?'本人已经在这里。':b.actions<1?'普通步行前往需要1行动，可免费沿普通路回议事所外。':null;
 if(c.type==='RETURN_ON_FOOT')return f.location===BLACK_EMPEROR_HOME?'本人已经在议事所外。':null;
 if(isBlackEmperorMaterialCommand(c))return blackEmperorMaterialBlock(root,c);
 if(c.type==='STABILIZE_PROMOTION')return getBlackEmperorPromotionStabilityPreview(root,c.compoundId).reason;
 if(c.type==='CONSUME')return blackEmperorConsumeBlock(root,c.compoundId);
 return '当前没有这项行动。';
}
/** Every real weekly boundary uses ordinary finance; no automatic wages or healing. */
function elapse(root:BlackEmperorState,seconds:number,revision:number,eventId:string,receipts:BlackEmperorEvent['financeReceipts']):void {
 const f=root.frame!,b=f.budget;need(Number.isSafeInteger(seconds)&&seconds>=0,'实际用时无效。');const target=f.nowSecond+seconds;
 while(target>=f.weekAnchor+604800){
  let result=resolveSliceWeeklyFinance({...f.finance,week:b.week,revision,cash:b.cash,pulse:'BILL',billAmount:0});receipts.push(...result.receipts);
  if(result.eventId==='LIFE-BILL-01'){
   const due=SLICE_LIFE[result.state.lifeTier].cost,paid=result.state.cash;result.state.cash=0;result.state.debts.push({id:`${eventId}:living-debt:${b.week}`,source:'生活应付款',remaining:due-paid,weeklyPayment:30,createdWeek:b.week});result.state.nextLifeTier='DESTITUTE';result.state.pulse='DEBTS';receipts.push({title:'本周生活应付款',text:`已付${paid}便士，未付${due-paid}便士如实记欠。`});result=resolveSliceWeeklyFinance(result.state);receipts.push(...result.receipts);
  }
  b.cash=result.state.cash;const{nextLifeTier,debts,missedWeeks,credit}=result.state;Object.assign(f.finance,{lifeTier:nextLifeTier,nextLifeTier,debts:clone(debts),missedWeeks,credit});b.week++;b.date=addGameWeeks(b.date,1);b.actions=f.finance.weeklyBudget;f.weekAnchor+=604800;
 }
 f.nowSecond=target;
 // Time continues after an ordinary exit: work, travel and weekly settlement
 // cannot freeze or retroactively cancel an already started physical impact.
 const scene=root.scene,device=scene?.facility;
 if(scene&&device?.pendingImpact&&device.impactDueSecond!==null&&device.impactDueSecond<=target){
  device.pendingImpact=false;device.impactResolvedEventId=eventId;device.version++;
  device.impactDamage=scene.playerPosition==='FACILITY'?8:0;
  if(device.impactDamage)pay(b,{health:device.impactDamage});
  receipts.push({title:'已启动冲击实际落定',text:device.impactDamage?'真实经过冲击时点，本人仍未离开设施，健康减少8；不能事后停机撤销。':'真实经过冲击时点，同一冲击在本人离开后的设施内落定；没有冻结或重新生成。'});
 }
 if(scene?.window&&scene.window.expiresAt<target)scene.window=null;
}
function reduce(root:BlackEmperorState,c:BlackEmperorCommand,revision:number):BlackEmperorEvent {
 const reason=commandBlock(root,c,revision);need(reason===null,reason??'当前无法行动。');
 const f=root.frame!,b=f.budget,eventId=`BE227:${root.source!.runId}:${revision}`,before=clone(f),beforeDigest=dataDigest(root),financeReceipts:BlackEmperorEvent['financeReceipts']=[],randomReceipts:BlackEmperorEvent['randomReceipts']=[],notes:string[]=[];
 const time=(seconds:number)=>elapse(root,seconds,revision,eventId,financeReceipts);
 const check=(ability:PublicCoreStatKey,difficulty:number,bonus=0)=>{const cursorBefore=f.random.cursor,rng=new DeterministicActionRandomStream(f.random.seed,cursorBefore);const result=resolveNormalCheck({ability,baseAbility:b.coreStats[ability],difficulty,modifiers:bonus?[{source:'本瓶本次实际稳定准备',value:bonus}]:[],roll:rng.nextInt(1,100)});f.random.cursor=rng.cursor;randomReceipts.push({id:`${eventId}:check:${randomReceipts.length+1}`,check:result,cursorBefore,cursorAfter:rng.cursor});return result;};
 if(c.type==='WORK'){pay(b,{actions:1});b.cash+=root.source!.character.weeklyWage;f.finance.wagePaidWeek=b.week;time(28800);notes.push(`实际完成原职业工作，${root.source!.character.weeklyWage}便士本周工资入账。`);}
 else if(c.type==='REST'){pay(b,{actions:1});const life=SLICE_LIFE[f.finance.lifeTier],cap=b.sequence===0?BLACK_EMPEROR_SPIRITUALITY_CAP:120;b.health=Math.min(100,b.health+life.health);b.mind=Math.min(100,b.mind+life.mind);b.spirituality=Math.min(cap,b.spirituality+Math.round(cap*life.spirituality));b.pollution=Math.max(0,b.pollution-10);b.injuries=b.injuries.filter(i=>!(b.health>=80&&i.acquiredRevision<revision&&(i.severity==='LIGHT'||i.treatedRevision!==null&&i.treatedRevision<revision)));if(!b.injuries.length)b.injuryRisk=0;time(28800);notes.push('按实际生活档休养八小时；未处置的重伤、原件耗费和他人身体继续保留。');}
 else if(c.type==='CLINIC'){pay(b,{actions:1,cash:60});for(const i of b.injuries)if(i.severity==='HEAVY'&&i.treatedRevision===null)i.treatedRevision=revision;time(3600);notes.push('实付60便士普通处置重伤，仍须之后实际休养。');}
 else if(c.type==='NEXT_WEEK'){b.actions=0;time(f.weekAnchor+604800-f.nowSecond);notes.push('经过下一真实周界，生活费与既有还款照常结算；没有自动工资、治疗或补货。');}
 else if(c.type==='TRAVEL'||c.type==='RETURN_ON_FOOT'){const from=f.location;if(c.type==='TRAVEL')pay(b,{actions:1});f.location=c.type==='TRAVEL'?c.to:BLACK_EMPEROR_HOME;transportBlackEmperorMaterials(root.materials!,from,f.location);const metres=c.type==='TRAVEL'?1800:7200;root.scene!.playerTravelMetres+=metres;root.scene!.moves.push({eventId,actorId:'PLAYER',from:'OUTSIDE',to:'OUTSIDE',metres,seconds:metres});time(metres);notes.push(c.type==='TRAVEL'?'本人携实际随身原件沿普通道路步行半小时抵达。':'本人携随身原件沿普通道路步行两小时回议事所外，不需要现款或行动。');}
 else if(isBlackEmperorSceneCommand(c)){
  const result=applyBlackEmperorScene(root.scene!,c,blackEmperorHost(root,eventId,revision),(ability,difficulty)=>check(ability,difficulty));root.scene=result.state;pay(b,result.effect);time(result.effect.seconds);
  if(c.type==='HOLD_FESTIVAL'){const festival=blackEmperorCurrentFestival(root.scene!)!;festival.opportunityWeek=b.week;festival.expiresSecond=f.weekAnchor+604800-1;}
  if(c.type==='NEXT_CONSTRUCTION'){const receipt=root.scene!.constructionReceipts.at(-1)!;need(receipt.endWeek===b.week&&receipt.personalCost===before.budget.cash-b.cash,'施工三周须逐周实付全部生活及还款，不能产生免费工期。');}
  if(c.type==='LEAVE_ORIGINAL_COURT'){transportBlackEmperorMaterials(root.materials!,f.location,'BE227-COURT-OUTSIDE');f.location='BE227-COURT-OUTSIDE';}
  for(const ability of result.effect.mastery??[]){need(BLACK_EMPEROR_ABILITY_IDS.some(x=>x===ability),'有限能力的应用记录无效。');b.mastery[ability]=Math.min(500,(b.mastery[ability]??0)+8);}notes.push(...result.notes);
 }
 else if(isBlackEmperorMaterialCommand(c)){const result=applyBlackEmperorMaterial(root,c,eventId,()=>check('knowledge',30));pay(b,result.effect);time(result.effect.seconds);notes.push(...result.notes);}
 else if(c.type==='STABILIZE_PROMOTION'){
  pay(b,BLACK_EMPEROR_PREPARATION);time(BLACK_EMPEROR_PREPARATION.seconds);const p=root.materials!.compounds.find(x=>x.id===c.compoundId)!;
  root.promotionStability.preparations.push({id:`${eventId}:preparation`,compoundId:p.id,actorId:root.source!.actorId,sourceDigest:root.source!.historyDigest,compoundDigest:blackEmperorDigest(p),festivalId:blackEmperorCurrentFestival(root.scene!)!.id,location:f.location,preparedSecond:f.nowSecond,expiresSecond:f.nowSecond+BLACK_EMPEROR_PREPARATION.validSeconds,status:'READY',spentEventId:null});notes.push('实付1行动、150便士、12灵性、8精神与一小时，完成绑定本人、同一成药、真实国度与这次已经付费筹备且尚未举行的多城祭祀的一次稳定准备；离开国度、改变原件或超过七日即失效。');
 }
 else if(c.type==='CONSUME'){
  const ready=preparation(root,c.compoundId),p=root.materials!.compounds.find(x=>x.id===c.compoundId)!;pay(b,{actions:BLACK_EMPEROR_CONSUMPTION.actions,spirituality:BLACK_EMPEROR_CONSUMPTION.spirituality});if(ready){ready.status='SPENT';ready.spentEventId=eventId;}
  const result=check('will',BLACK_EMPEROR_CONSUMPTION.difficulty,ready?BLACK_EMPEROR_CONSUMPTION.preparedBonus:0),success=result.tier==='SUCCESS'||result.tier==='GREAT_SUCCESS';p.consumedEventId=eventId;blackEmperorCurrentFestival(root.scene!)!.consumedEventId=eventId;
  if(success){b.mind=Math.max(0,b.mind-BLACK_EMPEROR_CONSUMPTION.successMind);b.sequence=0;b.acting=0;root.promotionWeek=b.week;if(!b.completedSources.includes('black-emperor-s0'))b.completedSources.push('black-emperor-s0');for(const ability of BLACK_EMPEROR_ABILITY_IDS)b.mastery[ability]=0;p.status='SUCCESS';for(const original of root.materials!.originals){original.holder='FUSED';original.location=null;original.compoundId=p.id;}Object.assign(root.materials!.uniqueness,{holder:'FUSED',compoundId:p.id,location:f.location});notes.push(`意志检定${result.roll}/${result.chance}，实际成为黑皇帝；同一三份原特性与唯一性融合。精神减少12，原有掌握逐值保留，两项新掌握从零开始；灵性上限150，当前没有补满。`);}
  else {const severe=result.tier==='GREAT_FAILURE';b.health=Math.max(0,b.health-(severe?BLACK_EMPEROR_CONSUMPTION.greatFailureHealth:BLACK_EMPEROR_CONSUMPTION.failureHealth));b.mind=Math.max(0,b.mind-(severe?BLACK_EMPEROR_CONSUMPTION.greatFailureMind:BLACK_EMPEROR_CONSUMPTION.failureMind));b.pollution=Math.min(100,b.pollution+(severe?BLACK_EMPEROR_CONSUMPTION.greatFailurePollution:BLACK_EMPEROR_CONSUMPTION.failurePollution));if(b.health===0||b.mind===0||b.pollution>=100){b.status='DEAD';b.health=0;}b.injuries.push({id:`${eventId}:promotion-injury`,severity:'HEAVY',acquiredRevision:revision,treatedRevision:null});b.injuryRisk+=2;p.status=b.status==='ACTIVE'?'FAILED_EXPOSED':'DEATH_REMAINS';for(const original of root.materials!.originals)if(p.originalIds.includes(original.originalId)||b.status!=='ACTIVE'){original.holder=b.status==='ACTIVE'?'LOCATED':'DEATH_REMAINS';original.location=f.location;original.compoundId=p.id;}Object.assign(root.materials!.uniqueness,{holder:b.status==='ACTIVE'?'EXPOSED':'DEATH_REMAINS',location:f.location,compoundId:p.id});notes.push(b.status==='ACTIVE'?`意志检定${result.roll}/${result.chance}，服药失败，健康减45、精神减40、污染加35并留下重伤。实际成功晋升的原份仍在存活本体内，两份原件与唯一性留下同一份残余。`:`意志检定${result.roll}/${result.chance}，严重排异导致死亡；同一三份原特性与唯一性留在死亡现场，周目终止。`);}
  time(60);
 }
 if(b.status!=='ACTIVE'){root.scene!.window=null;root.scene!.contact=false;root.scene!.status='ABORTED';if(b.sequence===0){for(const original of root.materials!.originals){original.holder='DEATH_REMAINS';original.location=f.location;}root.materials!.uniqueness.holder='DEATH_REMAINS';root.materials!.uniqueness.location=f.location;for(const compound of root.materials!.compounds)if(compound.status==='SUCCESS'){compound.status='DEATH_REMAINS';compound.location=f.location;}}}
 for(const p of root.promotionStability.preparations)if(p.status==='READY'&&preparation(root,p.compoundId)?.id!==p.id)p.status='INVALIDATED';
 const event:BlackEmperorEvent={id:eventId,revision,command:clone(c),before,after:clone(f),randomReceipts,financeReceipts,notes,beforeDigest,afterDigest:dataDigest(root)};root.journal.push(event);return event;
}
/** A cold load authenticates the complete predecessor chain and replays every
 * committed command. A hash, caller hint or public certificate cannot bypass it. */
function reconstruct(s:SliceState):BlackEmperorState {
 const saved=s.blackEmperor;need(saved?.source&&validateBlackEmperorSource(s,saved.source,'COLD_REOPEN'),'原身份、原人原物和三份特性历史未通过核验。');need(Array.isArray(saved.journal),'实际动作记录无效。');
 const root=start(clone(saved.source));for(const event of saved.journal){need(event&&event.revision===saved.source.revision+2+root.journal.length,'本章行动次序不一致。');const actual=reduce(root,clone(event.command),event.revision);need(sameBlackEmperor(actual,event),'实际行动、检定和代价与原记录不一致。');}need(sameBlackEmperor(root,saved),'当前原物与身体不能由实际行动重建。');
 const f=root.frame!,source=root.source!,{coreStats:_current,...identity}=s.character,{coreStats:_original,...originalIdentity}=source.character;
 need(s.progression.pathwayId==='black-emperor'&&s.revision===source.revision+1+root.journal.length&&sameBlackEmperor(blackEmperorBudget(s),f.budget)&&sameBlackEmperor(s.random,f.random),'当前身体与实际行动终点不一致。');need(sameBlackEmperor(identity,originalIdentity)&&Object.entries(f.finance).every(([key,value])=>sameBlackEmperor(s[key as keyof SliceState],value)),'当前身份或生活账本不一致。');need(s.combat===null&&s.activeEvent===null&&s.eventQueue.length===0&&s.pulse==='NONE','旧现场终点不一致。');return root;
}
export function validateBlackEmperorRoot(s:SliceState):void{reconstruct(s);}
export function transitionBlackEmperor(s:SliceState,c:BlackEmperorCommand):BlackEmperorState{const root=reconstruct(s);reduce(root,clone(c),s.revision+1);return root;}
export function openBlackEmperorOwnedEngine(s:SliceState):BlackEmperorOwnedEngine{return retain(reconstruct(clone(s)));}
export function snapshotBlackEmperorOwnedEngine(h:BlackEmperorOwnedEngine):BlackEmperorState{return clone(getOwned(h));}
export function advanceBlackEmperorOwnedEngine(h:BlackEmperorOwnedEngine,c:BlackEmperorCommand,revision:number):BlackEmperorOwnedEngine{const next=clone(getOwned(h));reduce(next,clone(c),revision);return retain(next);}
export function blockBlackEmperorOwnedEngine(h:BlackEmperorOwnedEngine,c:BlackEmperorCommand,revision:number):string|null{try{return commandBlock(getOwned(h),c,revision);}catch{return '当前实际记录或行动条件无效。';}}
