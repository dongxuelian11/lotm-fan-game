import type { SliceState } from '../slice/types.js';
import type { PublicCoreStatKey } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { addGameWeeks } from '../game-calendar.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance, resolveNormalCheck } from '../../resolution/normal-check.js';
import { createVisionarySource, validateVisionarySource, visionaryBudget, type VisionarySource, type VisionaryBudget } from './source.js';
import { createVisionaryEra, visionaryEraBlock, applyVisionaryEra, visionaryEraChallenge, advanceVisionaryEra,
  deriveVisionaryEraWindow, validateVisionaryEraCommand } from './era.js';
import { VISIONARY_ERA_LOCATIONS } from './era-content.js';
import { createVisionaryMaterials, visionaryMaterialBlock, applyVisionaryMaterial, visionaryMaterialChallenge,
  transportVisionaryMaterials, settleVisionaryConsumption, validateVisionaryMaterialCommand } from './materials.js';
import { VISIONARY_CITY_PLACES, VISIONARY_HOME, VISIONARY_GUIDANCE, VISIONARY_CONSUMPTION,
  VISIONARY_PROMOTION_STABILITY, VISIONARY_EPILOGUE_BONUS } from './content.js';
import { VISIONARY_ABILITY_IDS, type VisionaryState, type VisionaryCommand, type VisionaryFrame, type VisionaryEvent,
  type VisionaryCheckReceipt, type VisionaryPromotionPreparation } from './types.js';
import { createVisionaryEpilogue, applyVisionaryEpilogue, visionaryEpilogueBlock, validateVisionaryEpilogueCommand } from './epilogue.js';
import type { VisionaryHost, VisionaryEffect } from './ports.js';
export const sameVisionary = (a: unknown,b: unknown): boolean => stableStringify(a)===stableStringify(b);
export const visionaryDigest = (v: unknown): string => sha256Hex(stableStringify(v));
function need(v:unknown,reason:string):asserts v { if(!v)throw Error(reason); }
const clone = <T>(v:T):T=>structuredClone(v);
const city = (id:string):boolean=>VISIONARY_CITY_PLACES.some(p=>p.id===id);
const eraLocations = (): string[] => Object.values(VISIONARY_ERA_LOCATIONS);
function dataDigest(root:VisionaryState):string { const {journal:_journal,...data}=root;return visionaryDigest(data); }
export function createVisionaryState():VisionaryState { return {version:1,guidanceKnown:false,source:null,frame:null,promotionWeek:null,
  era:null,materials:null,epilogue:null,journal:[],promotionStability:{preparations:[]}}; }
const record = (v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact = (v:object,keys:string[]):boolean=>sameVisionary(Object.keys(v).sort(),keys.sort());
const id = (v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=300&&v.trim()===v;
export function validateVisionaryCommand(v:unknown):v is VisionaryCommand {
  if(!record(v))return false;
  if(['LEARN_GUIDANCE','WORK','REST','CLINIC','NEXT_WEEK','START_EPILOGUE','RETURN_ON_FOOT'].includes(String(v.type)))return exact(v,['type']);
  if(v.type==='TRAVEL')return exact(v,['type','to'])&&id(v.to)&&(city(v.to)||eraLocations().includes(v.to));
  if(v.type==='STABILIZE_PROMOTION')return exact(v,['type','compoundId'])&&id(v.compoundId);
  if(v.type==='CONSUME')return exact(v,['type','compoundId','confirmed'])&&id(v.compoundId)&&v.confirmed===true;
  if(!exact(v,['type','command']))return false;
  return v.type==='ERA'?validateVisionaryEraCommand(v.command):v.type==='MATERIAL'?validateVisionaryMaterialCommand(v.command):v.type==='EPILOGUE'?validateVisionaryEpilogueCommand(v.command):false;
}
declare const visionaryOwnedEngineBrand:unique symbol;
export interface VisionaryOwnedEngine {readonly [visionaryOwnedEngineBrand]:true}
const owned=new WeakMap<VisionaryOwnedEngine,VisionaryState>();
function getOwned(h:VisionaryOwnedEngine):VisionaryState {const r=owned.get(h);need(r,'无效的当前领域会话。');return r;}
function retain(root:VisionaryState):VisionaryOwnedEngine {const h=Object.freeze({}) as VisionaryOwnedEngine;owned.set(h,root);return h;}
function start(source:VisionarySource):VisionaryState {
  const root=createVisionaryState();root.guidanceKnown=true;root.source=clone(source);
  root.frame={budget:clone(source.budget),finance:clone(source.finance),random:{...source.random},location:VISIONARY_HOME,nowSecond:3600};
  pay(root.frame.budget,VISIONARY_GUIDANCE);
  root.era=createVisionaryEra(source.runId,source.budget.week);
  const consumption=source.acquisition.consumptions.find(e=>e.command.type==='CONSUME'&&(e.check?.tier==='SUCCESS'||e.check?.tier==='GREAT_SUCCESS'));
  need(consumption,'本人原特性的实际服药记录缺失。');
  root.materials=createVisionaryMaterials({actorId:source.actorId,sourceDigest:source.historyDigest,bottles:clone(source.acquisition.bottles),
    consumption:clone(consumption),consumptions:clone(source.acquisition.consumptions),inheritanceLocation:VISIONARY_HOME,
    resupply:clone(source.acquisition.recovery?.resupply??{requestedWeek:null,deliveries:0}),
    ...(source.acquisition.recovery?{acquisitionJournal:clone(source.acquisition.recovery.acquisitionJournal)}:{})});
  return root;
}
export function startVisionary(s:SliceState):VisionaryState {return start(createVisionarySource(s));}
export function visionaryHost(root:VisionaryState,eventId:string,revision:number):VisionaryHost {
  const f=root.frame!,b=f.budget;return {eventId,revision,week:b.week,actorId:root.source!.actorId,location:f.location,
    sequence:b.sequence,status:b.status==='ACTIVE'?'ACTIVE':'DEAD',cash:b.cash,actions:b.actions,health:b.health,mind:b.mind,spirituality:b.spirituality,check:null};
}
function pay(b:VisionaryBudget,c:{actions?:number;cash?:number;spirituality?:number;mind?:number;health?:number;pollution?:number}):void {
  need(b.actions>=(c.actions??0)&&b.cash>=(c.cash??0)&&b.spirituality>=(c.spirituality??0),'实际行动、费用或灵性不足。');
  b.actions-=c.actions??0;b.cash-=c.cash??0;b.spirituality-=c.spirituality??0;b.health=Math.max(0,b.health-(c.health??0));
  b.mind=Math.max(0,b.mind-(c.mind??0));b.pollution=Math.min(100,b.pollution+(c.pollution??0));
  if(b.health===0||b.mind===0||b.pollution>=100){b.status='DEAD';b.health=0;}
}
function checks(f:VisionaryFrame,eventId:string){
  const receipts:VisionaryCheckReceipt[]=[];
  const check=(ability:PublicCoreStatKey,difficulty:number,modifier=0,source='实际在场条件')=>{
    const before=f.random.cursor,rng=new DeterministicActionRandomStream(f.random.seed,before);
    const result=resolveNormalCheck({ability,baseAbility:f.budget.coreStats[ability],difficulty,modifiers:modifier?[{source,value:modifier}]:[],roll:rng.nextInt(1,100)});
    f.random.cursor=rng.cursor;receipts.push({kind:'CHECK',id:`${eventId}:check:${receipts.length+1}`,check:result,cursorBefore:before,cursorAfter:rng.cursor});return result;
  };return {receipts,check};
}
/** The existing weekly finance reducer owns every real living bill and debt
 * payment. Time spent abroad never creates wages or silently clears principal. */
function weeks(root:VisionaryState,count:number,revision:number,eventId:string,notes:VisionaryEvent['financeReceipts']):void {
  const f=root.frame!,b=f.budget;
  for(let i=0;i<count;i++){
    let result=resolveSliceWeeklyFinance({...f.finance,week:b.week,revision,cash:b.cash,pulse:'BILL',billAmount:0});notes.push(...result.receipts);
    if(result.eventId==='LIFE-BILL-01'){
      const due=SLICE_LIFE[result.state.lifeTier].cost,paid=result.state.cash;result.state.cash=0;
      result.state.debts.push({id:`${eventId}:living-debt:${i}`,source:'生活应付款',remaining:due-paid,weeklyPayment:30,createdWeek:b.week});
      result.state.nextLifeTier='DESTITUTE';result.state.pulse='DEBTS';notes.push({title:'本周生活应付款',text:`已付${paid}便士，未付${due-paid}便士如实计欠；下周采用赤贫生活。`});
      result=resolveSliceWeeklyFinance(result.state);notes.push(...result.receipts);
    }
    b.cash=result.state.cash;const {nextLifeTier,debts,missedWeeks,credit}=result.state;
    Object.assign(f.finance,{lifeTier:nextLifeTier,nextLifeTier,debts:clone(debts),missedWeeks,credit});
    b.week++;b.date=addGameWeeks(b.date,1);b.actions=f.finance.weeklyBudget;f.nowSecond+=604800;
    if(b.week>root.era!.week)root.era=advanceVisionaryEra(root.era!,b.week);
  }
}
function effect(root:VisionaryState,e:VisionaryEffect,revision:number,eventId:string,notes:VisionaryEvent['financeReceipts']):void {
  const f=root.frame!,from=f.location;
  pay(f.budget,{actions:e.actions,cash:e.cashCost,spirituality:e.spirituality,mind:e.mind,health:e.health});f.budget.cash+=e.cashGain;
  weeks(root,e.weeks,revision,eventId,notes);if(e.toLocation!==null)f.location=e.toLocation;
  if(from!==f.location)root.materials=transportVisionaryMaterials(root.materials!,from,f.location);
  if(!e.weeks)f.nowSecond+=3600;
}
function windowFor(root:VisionaryState){return deriveVisionaryEraWindow(root.era!,visionaryHost(root,'window-current',root.source!.revision+2+root.journal.length));}
function preparation(root:VisionaryState,compoundId:string):VisionaryPromotionPreparation|null {
  const w=windowFor(root),f=root.frame!,compound=root.materials!.compounds.find(c=>c.id===compoundId);
  return root.promotionStability.preparations.find(p=>p.status==='READY'&&p.compoundId===compoundId&&p.actorId===root.source!.actorId&&
    p.sourceDigest===root.source!.historyDigest&&compound?.status==='PREPARED'&&p.compoundDigest===visionaryDigest(compound)&&p.location===f.location&&
    w&&p.windowId===w.id&&sameVisionary(p.receipts,w.receipts)&&f.budget.week>=p.startWeek&&f.budget.week<=p.endWeek)??null;
}
function consumeBlock(root:VisionaryState,compoundId:string):string|null {
  const f=root.frame!,b=f.budget,r=VISIONARY_CONSUMPTION;
  if(b.sequence!==1||root.promotionWeek!==null||b.acting!==100)return '须由已经完整消化的作家本人服药。';
  if(!windowFor(root))return '须先真正完成时代预想、四方六城制度转型，并处于实际季度窗口；错过后须等待下一实际核验节点。';
  if(f.location!=='backlund:ritual-workshop')return '本人及同一瓶原成药须实际抵达封闭调配室。';
  if(b.health<r.healthMinimum||b.mind<r.mindMinimum||b.injuries.length)return '先恢复到80健康、70精神并解除实际伤势。';
  const compound=root.materials!.compounds.find(c=>c.id===compoundId);
  if(compound?.status!=='PREPARED'||compound.location!==f.location)return '这瓶同批原成药尚未真实备好并带到现场。';
  if(b.actions<1||b.spirituality<r.spirituality)return '服药需要1行动与30灵性。';
  return null;
}
export function getVisionaryPromotionStabilityPreview(root:VisionaryState,compoundId:string){
  const f=root.frame!,b=f.budget,prepared=!!preparation(root,compoundId),cost=VISIONARY_PROMOTION_STABILITY;
  let reason=consumeBlock(root,compoundId);
  if(!reason&&prepared)reason='同一瓶在本季度窗口的稳定准备已经完成。';
  if(!reason&&(b.actions<cost.actions||b.cash<cost.cash||b.spirituality<cost.spirituality+VISIONARY_CONSUMPTION.spirituality||b.mind<cost.mind+VISIONARY_CONSUMPTION.mindMinimum))reason='稳定准备需要1行动、100便士、12灵性与8精神，并留足服药的30灵性与70精神。';
  const modifier=prepared?cost.effectiveBonus:0;
  return {eligible:reason===null,reason,prepared,cost,chance:computeCheckChance({baseAbility:b.coreStats.will,difficulty:VISIONARY_CONSUMPTION.difficulty,modifiers:modifier?[{source:'本瓶本季度实际稳定准备',value:modifier}]:[]}),
    preparedChance:computeCheckChance({baseAbility:b.coreStats.will,difficulty:VISIONARY_CONSUMPTION.difficulty,modifiers:[{source:'本瓶本季度实际稳定准备',value:cost.effectiveBonus}]}),window:windowFor(root)};
}
export function getVisionaryEpilogueCheckPreview(root:VisionaryState,kind:import('./epilogue.js').VisionaryEpilogueCommand['type']){
  if(kind!=='SUPPORT_STRUCTURE'&&kind!=='GUIDE_RESCUER')return null;
  const difficulty=45,effectiveBonus=VISIONARY_EPILOGUE_BONUS;
  return {ability:'will' as const,difficulty,effectiveBonus,chance:computeCheckChance({baseAbility:root.frame!.budget.coreStats.will,difficulty,modifiers:[{source:'本人本次有限施术',value:effectiveBonus}]})};
}
/** Qualification previews are non-mutating and draw no future dice. */
function commandBlock(root:VisionaryState,c:VisionaryCommand,revision:number):string|null {
  if(!validateVisionaryCommand(c)||c.type==='LEARN_GUIDANCE')return '这项行动的内容无效或已经学习指导。';
  const f=root.frame,b=f?.budget;
  if(!root.guidanceKnown||!root.source||!f||!b||b.status!=='ACTIVE')return '已经死亡或结束的角色不能继续行动。';
  if(root.journal.length>=4096||revision!==root.source.revision+2+root.journal.length)return '本次实际动作次序无效。';
  if(root.epilogue?.status==='ACTIVE'&&c.type!=='EPILOGUE')return '先完成当前现场救援或沿原安全侧道普通撤出。';
  const h=visionaryHost(root,`R210:${root.source.runId}:${revision}`,revision);
  if(c.type==='NEXT_WEEK')return null;
  if(c.type==='WORK')return !city(f.location)?'须先沿普通道路回到贝克兰德，再做原职业工作。':f.finance.wagePaidWeek===b.week?'本周原职业工资已结算。':b.actions<1?'工作需要一次行动。':null;
  if(c.type==='REST')return b.actions<1?'休养需要一次行动，可先度过真实七天。':null;
  if(c.type==='CLINIC')return !city(f.location)?'须先返回城市诊所。':!b.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null)?'没有尚未处置的重伤。':b.actions<1||b.cash<60?'普通处置需要1行动与60便士。':null;
  if(c.type==='TRAVEL')return c.to===f.location?'本人已经在这处地点。':!city(f.location)||!city(c.to)?'跨城须沿时代行动中的真实路线行进。':b.actions<1||b.cash<10?'城市交通需要1行动与10便士，可选择步行回联络处。':null;
  if(c.type==='RETURN_ON_FOOT')return f.location===VISIONARY_HOME?'本人已经在贝克兰德联络处。':b.actions<1?'步行返程需要一次行动，可先度过真实七天。':null;
  if(c.type==='ERA')return b.sequence!==1&&c.command.type!=='ERA_TRAVEL'?'这次时代转型已成为实际历史。':visionaryEraBlock(root.era!,c.command,h);
  if(c.type==='MATERIAL')return b.sequence!==1?'本人的晋升已实际结束。':visionaryMaterialBlock(root.materials!,c.command,h);
  if(c.type==='STABILIZE_PROMOTION')return getVisionaryPromotionStabilityPreview(root,c.compoundId).reason;
  if(c.type==='CONSUME')return consumeBlock(root,c.compoundId);
  if(c.type==='START_EPILOGUE')return b.sequence!==0||root.promotionWeek===null||root.epilogue!==null?'须由实际晋升且尚未处理这宗原故障的本人进入。':f.location!==root.era!.epilogueOrigin.location?'须实际抵达廷根原失联站，不能远程施术。':null;
  if(c.type==='EPILOGUE')return !root.epilogue||f.location!==root.epilogue.location?'须本人实际在这宗原失联站现场。':visionaryEpilogueBlock(root.epilogue,c.command,b);
  return '这项行动尚未接线。';
}
function reduce(root:VisionaryState,c:VisionaryCommand,revision:number):VisionaryEvent {
  const reason=commandBlock(root,c,revision);need(reason===null,reason??'当前无法行动。');
  const f=root.frame!,b=f.budget,eventId=`R210:${root.source!.runId}:${revision}`,before=clone(f),beforeDigest=dataDigest(root),random=checks(f,eventId);
  const financeReceipts:VisionaryEvent['financeReceipts']=[],notes:string[]=[];
  if(c.type==='WORK'){pay(b,{actions:1});b.cash+=root.source!.character.weeklyWage;f.finance.wagePaidWeek=b.week;f.nowSecond+=28800;notes.push(`本周原职业工资${root.source!.character.weeklyWage}便士实际入账，不能重复领取。`);}
  else if(c.type==='REST'){
    pay(b,{actions:1});const life=SLICE_LIFE[f.finance.lifeTier];b.health=Math.min(100,b.health+life.health);b.mind=Math.min(100,b.mind+life.mind);
    b.spirituality=Math.min(120,b.spirituality+Math.round(120*life.spirituality));b.pollution=Math.max(0,b.pollution-10);
    b.injuries=b.injuries.filter(i=>!(b.health>=80&&i.acquiredRevision<revision&&(i.severity==='LIGHT'||i.treatedRevision!==null&&i.treatedRevision<revision)));
    if(!b.injuries.length)b.injuryRisk=0;f.nowSecond+=28800;notes.push('按当前真实生活档休养；未处置的重伤仍保留。');
  }else if(c.type==='CLINIC'){pay(b,{actions:1,cash:60});for(const i of b.injuries)if(i.severity==='HEAVY'&&i.treatedRevision===null)i.treatedRevision=revision;f.nowSecond+=3600;notes.push('已支付60便士作普通重伤处置，之后仍须实际休养至80健康。');}
  else if(c.type==='NEXT_WEEK'){b.actions=0;weeks(root,1,revision,eventId,financeReceipts);notes.push('真实度过七天；生活与旧约还款照常，身体不会自动痊愈，也没有自动工资。');}
  else if(c.type==='TRAVEL'){const from=f.location;pay(b,{actions:1,cash:10});f.location=c.to;f.nowSecond+=3600;root.materials=transportVisionaryMaterials(root.materials!,from,f.location);notes.push('本人和同批随身原件沿城市普通道路实际到场。');}
  else if(c.type==='RETURN_ON_FOOT'){
    const from=f.location;pay(b,{actions:1});const elapsed=city(from)?0:from.startsWith('tingen:')?2:6;
    weeks(root,elapsed,revision,eventId,financeReceipts);f.location=VISIONARY_HOME;f.nowSecond+=elapsed?0:7200;root.materials=transportVisionaryMaterials(root.materials!,from,f.location);
    notes.push(`本人携同一批随身原件沿普通道路${elapsed?`步行${elapsed}周`:'步行两小时'}返回贝克兰德，没有预付车费或领取工资；旧债与原结果保留。`);
  }else if(c.type==='ERA'){
    const h=visionaryHost(root,eventId,revision),challenge=visionaryEraChallenge(root.era!,c.command);
    if(challenge)h.check=random.check('knowledge',challenge.difficulty,challenge.bonus);
    const result=applyVisionaryEra(root.era!,c.command,h);root.era=result.state;effect(root,result.effect,revision,eventId,financeReceipts);notes.push(...result.notes);
  }else if(c.type==='MATERIAL'){
    const h=visionaryHost(root,eventId,revision),challenge=visionaryMaterialChallenge(root.materials!,c.command,h);
    if(challenge)h.check=random.check('will',challenge.difficulty,challenge.bonus);
    const result=applyVisionaryMaterial(root.materials!,c.command,h);root.materials=result.state;effect(root,result.effect,revision,eventId,financeReceipts);notes.push(...result.notes);
  }else if(c.type==='STABILIZE_PROMOTION'){
    const w=windowFor(root)!,compound=root.materials!.compounds.find(x=>x.id===c.compoundId)!;pay(b,VISIONARY_PROMOTION_STABILITY);f.nowSecond+=3600;
    root.promotionStability.preparations.push({id:`${eventId}:stability`,eventId,compoundId:compound.id,actorId:root.source!.actorId,sourceDigest:root.source!.historyDigest,
      compoundDigest:visionaryDigest(compound),location:f.location,week:b.week,windowId:w.id,startWeek:w.startWeek,endWeek:w.endWeek,receipts:[...w.receipts],status:'READY',spentEventId:null,invalidatedEventId:null});
    notes.push('为这一瓶原成药与本次实际季度节点付费完成稳定准备：100便士、1行动、12灵性和8精神已付。只对这瓶在此窗口的下一次服药有效，无论成败即用尽；离开原室、窗口过期或换瓶均不沿用。');
  }else if(c.type==='CONSUME'){
    const r=VISIONARY_CONSUMPTION,p=preparation(root,c.compoundId),check=random.check('will',r.difficulty,p?VISIONARY_PROMOTION_STABILITY.effectiveBonus:0,'本瓶本季度实际稳定准备');
    const success=check.tier==='SUCCESS'||check.tier==='GREAT_SUCCESS',severe=check.tier==='GREAT_FAILURE';pay(b,{actions:1,spirituality:r.spirituality});
    if(success){b.sequence=0;b.acting=0;root.promotionWeek=b.week;for(const ability of VISIONARY_ABILITY_IDS)b.mastery[ability]=0;b.completedSources.push('VISIONARY_ORIGINAL_SUCCESSION');}
    else{pay(b,{health:severe?r.greatFailureHealth:r.failureHealth,mind:severe?r.greatFailureMind:r.failureMind,pollution:severe?r.greatFailurePollution:r.failurePollution});
      b.injuries.push({id:`${eventId}:potion-injury`,severity:'HEAVY',acquiredRevision:revision,treatedRevision:null});b.injuryRisk+=2;}
    root.materials=settleVisionaryConsumption(root.materials!,{eventId,week:b.week,compoundId:c.compoundId,success,alive:b.status==='ACTIVE',location:f.location});
    for(const old of root.promotionStability.preparations)if(old.compoundId===c.compoundId&&old.spentEventId===null){old.status='SPENT';old.spentEventId=eventId;}
    f.nowSecond+=3600;notes.push(success?'三份原特性与独立唯一性在同一本人体内融合；旧掌握保留，两项新技巧从0开始，身体和灵性没有免费补满。':'服药失败；实际健康、精神、污染和重伤已经结算。原成药不能重喝，尚活且仍在原处的残余须先实际封存，才可付费清理；死亡不保底。');
  }else if(c.type==='START_EPILOGUE'){
    root.epilogue=createVisionaryEpilogue(root.era!.epilogueOrigin,{eventId,week:b.week,revision});f.nowSecond+=600;
    notes.push('本人步入此前已登记的原失联站，原成年救援队员、两名既有伤员和原支梁、担架、接线箱均仍是同一批对象；入场十分钟，不补行动、精神或灵性。');
  }else if(c.type==='EPILOGUE'){
    const preview=getVisionaryEpilogueCheckPreview(root,c.command.type),check=preview?random.check(preview.ability,preview.difficulty,preview.effectiveBonus,'本人本次有限施术'):null;
    root.epilogue=applyVisionaryEpilogue(root.epilogue!,c.command,b,{eventId,revision,check});f.nowSecond+=300;notes.push(root.epilogue.journal.at(-1)!.summary);
  }
  root.era=advanceVisionaryEra(root.era!,b.week);
  for(const p of root.promotionStability.preparations)if(p.status==='READY'&&!preparation(root,p.compoundId)){p.status='INVALIDATED';p.invalidatedEventId=eventId;}
  const event:VisionaryEvent={id:eventId,revision,command:clone(c),before,after:clone(f),randomReceipts:clone(random.receipts),financeReceipts,notes,beforeDigest,afterDigest:dataDigest(root)};
  root.journal.push(event);return event;
}
/** Every cold/raw entry reconstructs real hosts and central draws exactly once
 * in journal order. Caller-owned receipts never authenticate their own effects. */
function reconstruct(s:SliceState):VisionaryState {
  const saved=s.visionary;need(saved?.source&&validateVisionarySource(s,saved.source),'原身份、原人物与三份特性历史未通过核验。');
  need(Array.isArray(saved.journal)&&saved.journal.length<=4096,'本章动作记录长度无效。');const root=start(clone(saved.source));
  for(const event of saved.journal){need(event&&event.revision===saved.source.revision+2+root.journal.length,'本章实际修订次序不一致。');
    const actual=reduce(root,clone(event.command),event.revision);need(sameVisionary(actual,event),'实际行动、检定、代价或来源与原记录不一致。');}
  need(sameVisionary(root,saved),'当前时代、材料与身体不能由原行动重建。');
  const f=root.frame!,source=root.source!,{coreStats:_current,...identity}=s.character,{coreStats:_original,...originalIdentity}=source.character;
  need(s.progression.pathwayId==='audience'&&s.revision===source.revision+1+root.journal.length&&sameVisionary(visionaryBudget(s),f.budget)&&sameVisionary(s.random,f.random),'当前身体与真实动作终点不一致。');
  need(sameVisionary(identity,originalIdentity)&&Object.entries(f.finance).every(([key,value])=>sameVisionary(s[key as keyof SliceState],value)),'当前身份或生活账本不一致。');
  need(s.combatHistory.length===source.combatHistoryLength&&s.combat===null&&s.activeEvent===null&&s.eventQueue.length===0&&s.pulse==='NONE','旧现场或原战斗终点不一致。');
  return root;
}
export function validateVisionaryRoot(s:SliceState):void {reconstruct(s);}
export function transitionVisionary(s:SliceState,c:VisionaryCommand):VisionaryState {const root=reconstruct(s);reduce(root,clone(c),s.revision+1);return root;}
export function openVisionaryOwnedEngine(s:SliceState):VisionaryOwnedEngine {return retain(reconstruct(clone(s)));}
export function snapshotVisionaryOwnedEngine(h:VisionaryOwnedEngine):VisionaryState {return clone(getOwned(h));}
export function advanceVisionaryOwnedEngine(h:VisionaryOwnedEngine,c:VisionaryCommand,revision:number):VisionaryOwnedEngine {const next=clone(getOwned(h));reduce(next,clone(c),revision);return retain(next);}
export function blockVisionaryOwnedEngine(h:VisionaryOwnedEngine,c:VisionaryCommand,revision:number):string|null {try{return commandBlock(getOwned(h),c,revision);}catch{return '当前记录或行动条件无效。';}}
