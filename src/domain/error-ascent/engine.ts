import type { SliceState } from '../slice/types.js';
import type { PublicCoreStatKey } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { addGameWeeks,addGameDays } from '../game-calendar.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance,resolveNormalCheck } from '../../resolution/normal-check.js';
import { createErrorAscentSource,validateErrorAscentSource,errorAscentBudget,type ErrorAscentSource,type ErrorAscentBudget } from './source.js';
import { ERROR_ASCENT_MATERIAL_POLICY,errorAscentSuccessionAt } from './material-content.js';
import { createErrorAscentMaterials,errorAscentMaterialBlock,applyErrorAscentMaterial,transportErrorAscentMaterials,settleErrorAscentConsumption,validateErrorAscentMaterialCommand } from './materials.js';
import { ERROR_ASCENT_CITY_PLACES,ERROR_ASCENT_HOME,ERROR_ASCENT_WORKSHOP,ERROR_ASCENT_GUIDANCE,ERROR_ASCENT_PROMOTION_STABILITY,ERROR_ASCENT_SPIRITUALITY_CAP,ERROR_ASCENT_GATE } from './content.js';
import { ERROR_ASCENT_ABILITY_IDS,type ErrorAscentState,type ErrorAscentCommand,type ErrorAscentFrame,type ErrorAscentEvent,type ErrorAscentCheckReceipt,type ErrorAscentPromotionPreparation } from './types.js';
import { createErrorRitual,advanceErrorRitual,applyErrorRitual,errorRitualBlock,getErrorRitualCheckInput,getErrorRitualPreparationFacts,validateErrorRitualCommand,type ErrorRitualHost } from './ritual.js';
import { createErrorAscentEpilogue,applyErrorAscentEpilogue,errorAscentEpilogueBlock,validateErrorAscentEpilogueCommand,getErrorAscentEpilogueCheckInput } from './epilogue.js';
import type { ErrorAscentHost,ErrorAscentEffect } from './ports.js';
export const sameErrorAscent=(a:unknown,b:unknown):boolean=>stableStringify(a)===stableStringify(b);
export const errorAscentDigest=(v:unknown):string=>sha256Hex(stableStringify(v));
function need(v:unknown,reason:string):asserts v{if(!v)throw Error(reason);}
const clone=<T>(v:T):T=>structuredClone(v);
function dataDigest(root:ErrorAscentState):string{const{journal:_journal,...data}=root;return errorAscentDigest(data);}
export function createErrorAscentState():ErrorAscentState{return{version:1,guidanceKnown:false,source:null,frame:null,promotionWeek:null,ritual:null,materials:null,epilogue:null,journal:[],promotionStability:{preparations:[]}};}
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:object,keys:string[])=>sameErrorAscent(Object.keys(v).sort(),keys.sort());
export function validateErrorAscentCommand(v:unknown):v is ErrorAscentCommand{
 if(!record(v))return false;
 if(['LEARN_GUIDANCE','WORK','REST','CLINIC','NEXT_WEEK','WAIT_FOR_PREPARATION','START_EPILOGUE','RETURN_ON_FOOT'].includes(String(v.type)))return exact(v,['type']);
 if(v.type==='TRAVEL')return exact(v,['type','to'])&&ERROR_ASCENT_CITY_PLACES.some(p=>p.id===v.to);
 if(v.type==='STABILIZE_PROMOTION')return exact(v,['type','compoundId'])&&typeof v.compoundId==='string'&&v.compoundId.length<300;
 if(!exact(v,['type','command']))return false;
 return v.type==='MATERIAL'?validateErrorAscentMaterialCommand(v.command):v.type==='RITUAL'?validateErrorRitualCommand(v.command):v.type==='EPILOGUE'?validateErrorAscentEpilogueCommand(v.command):false;
}
declare const errorAscentOwnedBrand:unique symbol;
export interface ErrorAscentOwnedEngine{readonly[errorAscentOwnedBrand]:true}
const owned=new WeakMap<ErrorAscentOwnedEngine,ErrorAscentState>();
function getOwned(h:ErrorAscentOwnedEngine):ErrorAscentState{const r=owned.get(h);need(r,'无效的当前领域会话。');return r;}
function retain(root:ErrorAscentState):ErrorAscentOwnedEngine{const h=Object.freeze({}) as ErrorAscentOwnedEngine;owned.set(h,root);return h;}
function start(source:ErrorAscentSource):ErrorAscentState{
 const root=createErrorAscentState();root.guidanceKnown=true;root.source=clone(source);root.frame={budget:clone(source.budget),finance:clone(source.finance),random:{...source.random},location:ERROR_ASCENT_HOME,nowSecond:36000,weekAnchor:0};pay(root.frame.budget,ERROR_ASCENT_GUIDANCE);
 root.ritual=createErrorRitual({actorId:source.actorId,date:source.budget.date,nowSecond:root.frame.nowSecond});root.materials=createErrorAscentMaterials({...clone(source.acquisition),actorId:source.actorId,sourceDigest:source.historyDigest,inheritanceLocation:ERROR_ASCENT_HOME},ERROR_ASCENT_MATERIAL_POLICY,source.originals.registry);return root;
}
export function startErrorAscent(s:SliceState):ErrorAscentState{return start(createErrorAscentSource(s));}
export function errorAscentHost(root:ErrorAscentState,eventId:string,revision:number,originalBottleId?:string):ErrorAscentHost{
 const f=root.frame!,b=f.budget,source=root.source!,date=addGameDays(b.date,Math.floor((f.nowSecond-f.weekAnchor)/86400));
 const site=root.materials!.legacySites.find(x=>x.location===f.location&&x.residualPresent&&(!originalBottleId||x.originalBottleId===originalBottleId));
 return{eventId,revision,week:b.week,date,actorId:source.actorId,location:f.location,nowSecond:f.nowSecond,weekAnchor:f.weekAnchor,sourceDigest:source.historyDigest,preparationFacts:getErrorRitualPreparationFacts(root.ritual!,source.historyDigest),sequence:b.sequence,status:b.status==='ACTIVE'?'ACTIVE':'DEAD',cash:b.cash,actions:b.actions,health:b.health,mind:b.mind,spirituality:b.spirituality,check:null,legacyAccess:site?clone(site):null,succession:['UNVERIFIED','CUSTODIAN'].includes(root.materials!.uniqueness.holder)?errorAscentSuccessionAt(date):null};
}
function pay(b: ErrorAscentBudget, c: { actions?: number; cash?: number; spirituality?: number; mind?: number; health?: number; pollution?: number }): void {
 need(b.actions >= (c.actions ?? 0) && b.cash >= (c.cash ?? 0) && b.spirituality >= (c.spirituality ?? 0),'实际行动、费用或灵性不足。');
 b.actions -= c.actions ?? 0; b.cash -= c.cash ?? 0; b.spirituality -= c.spirituality ?? 0; b.health = Math.max(0,b.health-(c.health??0)); b.mind = Math.max(0,b.mind-(c.mind??0)); b.pollution = Math.min(100,b.pollution+(c.pollution??0));
 if (b.health === 0 || b.mind === 0 || b.pollution >= 100) { b.status = 'DEAD'; b.health = 0; }
}
function checks(f:ErrorAscentFrame,eventId:string){
 const receipts:ErrorAscentCheckReceipt[]=[];
 const input=(spec:import('../../resolution/normal-check.js').NormalCheckInput)=>{
  const before=f.random.cursor,rng=new DeterministicActionRandomStream(f.random.seed,before);
  const result=resolveNormalCheck({...spec,roll:rng.nextInt(1,100)});f.random.cursor=rng.cursor;
  receipts.push({kind:'CHECK',id:`${eventId}:check:${receipts.length+1}`,check:result,cursorBefore:before,cursorAfter:rng.cursor});return result;
 };
 const check=(ability:PublicCoreStatKey,difficulty:number,modifier=0,source='实际在场条件')=>input({ability,baseAbility:f.budget.coreStats[ability],difficulty,modifiers:modifier?[{source,value:modifier}]:[]});
 return{receipts,input,check};
}
/** Time advances once, against the chapter's fixed week anchor. Every crossed
 * real week bills the existing finance reducer; only WORK pays actual wages. */
function elapse(root: ErrorAscentState, seconds: number, revision: number, eventId: string, receipts: ErrorAscentEvent['financeReceipts']): void {
 const f = root.frame!, b = f.budget; need(Number.isSafeInteger(seconds) && seconds >= 0,'实际用时无效。');
 const target = f.nowSecond + seconds;
 while (target >= f.weekAnchor + 604800) {
  let result = resolveSliceWeeklyFinance({ ...f.finance, week: b.week, revision, cash: b.cash, pulse: 'BILL', billAmount: 0 }); receipts.push(...result.receipts);
  if (result.eventId === 'LIFE-BILL-01') {
   const due = SLICE_LIFE[result.state.lifeTier].cost, paid = result.state.cash;
   result.state.cash = 0; result.state.debts.push({ id: `${eventId}:living-debt:${b.week}`, source: '生活应付款', remaining: due-paid, weeklyPayment: 30, createdWeek: b.week }); result.state.nextLifeTier = 'DESTITUTE'; result.state.pulse = 'DEBTS';
   receipts.push({ title: '本周生活应付款', text: `已付${paid}便士，未付${due-paid}便士如实计欠；下周采用赤贫生活。` }); result = resolveSliceWeeklyFinance(result.state); receipts.push(...result.receipts);
  }
  b.cash = result.state.cash; const { nextLifeTier, debts, missedWeeks, credit } = result.state; Object.assign(f.finance,{ lifeTier:nextLifeTier,nextLifeTier,debts:clone(debts),missedWeeks,credit });
  b.week++; b.date = addGameWeeks(b.date,1); b.actions = f.finance.weeklyBudget; f.weekAnchor += 604800;
 }
 f.nowSecond = target;
 root.ritual=advanceErrorRitual(root.ritual!,target);
}
function effect(root: ErrorAscentState, e: ErrorAscentEffect, revision: number, eventId: string, receipts: ErrorAscentEvent['financeReceipts']): void {
 const f=root.frame!, from=f.location; pay(f.budget,{actions:e.actions,cash:e.cashCost,spirituality:e.spirituality,mind:e.mind,health:e.health}); f.budget.cash += e.cashGain;
 if (e.toLocation !== null) f.location=e.toLocation;
 if (from !== f.location) root.materials = transportErrorAscentMaterials(root.materials!,from,f.location);
 elapse(root,e.seconds,revision,eventId,receipts);
}
/** Location changes carry the same sealed compound; its identity and actual
 * preparation remain bound, while all other compound fields remain exact. */
function compoundIdentity(p:NonNullable<ErrorAscentState['materials']>['compounds'][number]):string{const{location:_location,...sameCompound}=p;return errorAscentDigest(sameCompound);}
function preparation(root:ErrorAscentState,compoundId:string):ErrorAscentPromotionPreparation|null{
 const f=root.frame!,p=root.materials!.compounds.find(x=>x.id===compoundId);
 return root.promotionStability.preparations.find(x=>x.status==='READY'&&x.compoundId===compoundId&&x.actorId===root.source!.actorId&&x.sourceDigest===root.source!.historyDigest&&p?.status==='PREPARED'&&x.compoundDigest===compoundIdentity(p)&&f.nowSecond>=x.preparedSecond&&f.nowSecond<=x.expiresSecond)??null;
}
export function errorAscentRitualHost(root:ErrorAscentState,eventId:string,revision:number):ErrorRitualHost{
 const f=root.frame!,b=f.budget,m=root.materials!,p=m.compounds.find(x=>x.status==='PREPARED'),ready=p?preparation(root,p.id):null;
 // A small concrete route estimate, calculated once when the appointment is
 // booked. Its allowance covers the remaining original labour, paid originals,
 // treatment, ordinary journeys and twelve real weeks since S1 promotion.
 const missing=m.characteristics.filter(x=>!['EMBODIED','PLAYER','COMPOUND','FUSED'].includes(x.holder));
 let cashNeeded=150+50+40+50+100+150+(b.injuries.some(x=>x.severity==='HEAVY'&&x.treatedRevision===null)?60:0);
 let actionsNeeded=14;
 for(const x of missing){if(x.holder==='SUPPLIER'){cashNeeded+=x.recoveredVessel?90:1100;actionsNeeded+=Math.max(0,5-x.inheritedLabourSteps-x.labour.length)+1;}else{cashNeeded+=150;actionsNeeded+=3;}}
 const netWage=Math.max(1,root.source!.character.weeklyWage-SLICE_LIFE[f.finance.lifeTier].cost);
 const weeks=Math.max(0,12-(b.week-root.source!.acquisition.promotionWeek),Math.ceil(Math.max(0,cashNeeded-b.cash)/netWage),Math.ceil(actionsNeeded/Math.max(1,f.finance.weeklyBudget-1)))+3;
 const consumeAt=f.weekAnchor+weeks*604800+36000;
 return{actorId:root.source!.actorId,eventId,revision,week:b.week,date:addGameDays(b.date,Math.floor((f.nowSecond-f.weekAnchor)/86400)),nowSecond:f.nowSecond,location:f.location,status:b.status==='ACTIVE'?'ACTIVE':'DEAD',sequence:b.sequence,health:b.health,mental:b.mind,spirituality:b.spirituality,pollution:b.pollution,cash:b.cash,actionPoints:b.actions,will:b.coreStats.will,injuries:b.injuries,
 compound:p?{id:p.id,status:'PREPARED',location:p.location,carrierId:p.batchId,embodiedOriginalId:m.embodiedOriginalBottleId,externalOriginalIds:m.characteristics.filter(x=>x.originBottleId!==m.embodiedOriginalBottleId).map(x=>x.originBottleId),uniquenessId:m.uniqueness.id}:null,
 preparation:ready?{id:ready.id,compoundId:ready.compoundId,actorId:ready.actorId,status:'READY',expiresSecond:ready.expiresSecond}:null,
 bookingPlan:root.ritual!.booking?null:{leadSeconds:consumeAt-f.nowSecond,consumeDate:addGameWeeks(b.date,weeks),routeSummary:`按现有${b.cash}便士、剩余原件劳务与每周实际工资${root.source!.character.weeklyWage}便士，留出${weeks}周完成筹资、治疗、原件交接和往返。日期一旦确定不重订；等待仍付生活费。`},check:null};
}
export function getErrorAscentPromotionStabilityPreview(root:ErrorAscentState,compoundId:string){
 const f=root.frame!,b=f.budget,p=root.materials!.compounds.find(x=>x.id===compoundId),prepared=!!preparation(root,compoundId),cost=ERROR_ASCENT_PROMOTION_STABILITY,r=root.ritual!;
 let reason:string|null=null;
 if(b.sequence!==1||root.promotionWeek!==null||b.acting!==100)reason='须由完整消化的时之虫本人准备。';
 else if(b.week-root.source!.acquisition.promotionWeek<12)reason='成为时之虫尚未满12个实际周。';
 else if(!r.booking||!r.player.surveyed||r.player.outcome||['SETTLED','CANCELLED'].includes(r.phase))reason='须在已经实地走查、尚未结束的同一次仪式之前准备。';
 else if(f.location!==ERROR_ASCENT_WORKSHOP||p?.status!=='PREPARED'||p.location!==f.location)reason='本人和同一成药须实际抵达封闭调配室。';
 else if(b.health<80||b.mind<78||b.injuries.length)reason='先恢复到80健康、78精神并解除实际伤势。';
 else if(prepared)reason='同一原剂已有有效稳定准备。';
 else if(b.actions<cost.actions||b.cash<cost.cash||b.spirituality<cost.spirituality+30)reason='准备需要1行动、150便士和12灵性，并保留替位所需30灵性。';
 const h=errorAscentRitualHost(root,'PREVIEW',root.source!.revision+2+root.journal.length);h.preparation={id:'preview',compoundId,actorId:h.actorId,status:'READY',expiresSecond:f.nowSecond+cost.validSeconds};
 const chance=computeCheckChance(getErrorRitualCheckInput(r,h));
 return{eligible:reason===null,reason,prepared,cost,chance,preparedChance:chance,window:r.booking?{consumeAt:r.booking.consumeAt,secondsRemaining:r.booking.consumeAt-f.nowSecond}:null};
}
export function getErrorAscentEpilogueCheckPreview(root:ErrorAscentState,kind:import('./epilogue.js').ErrorAscentEpilogueCommand['type']){
 const input=getErrorAscentEpilogueCheckInput({type:kind});if(!input)return null;
 return{ability:input.ability,difficulty:input.difficulty,effectiveBonus:input.modifier,source:input.source,chance:computeCheckChance({baseAbility:root.frame!.budget.coreStats[input.ability],difficulty:input.difficulty,modifiers:[{source:input.source,value:input.modifier}]})};
}
function commandBlock(root:ErrorAscentState,c:ErrorAscentCommand,revision:number):string|null{
 if(!validateErrorAscentCommand(c)||c.type==='LEARN_GUIDANCE')return '这项行动无效或已经听取指导。';
 const f=root.frame,b=f?.budget;if(!root.guidanceKnown||!root.source||!f||!b||b.status!=='ACTIVE')return '已经死亡或结束的角色不能继续行动。';
 if(revision!==root.source.revision+2+root.journal.length)return '本次实际动作次序无效。';
 const eventId=`R219:${root.source.runId}:${revision}`,h=errorAscentHost(root,eventId,revision,c.type==='MATERIAL'&&'bottleId' in c.command?c.command.bottleId:undefined);
 if(root.epilogue?.status==='ACTIVE'&&c.type!=='EPILOGUE')return '先处理眼前追赶或沿普通侧阶离场。';
 if(root.ritual!.player.position==='OUTER_CONTACT'&&c.type!=='RITUAL')return '先沿实际六米楼梯退出检修接点；不能用旅行或周结跳过撤离。';
 if(c.type==='NEXT_WEEK')return null;
 if(c.type==='WORK')return f.finance.wagePaidWeek===b.week?'本周原职业工资已结算。':b.actions<1?'工作需要一次行动。':null;
 if(c.type==='REST')return b.actions<1?'休养需要一次行动，可先经过真实周界。':null;
 if(c.type==='CLINIC')return !b.injuries.some(x=>x.severity==='HEAVY'&&x.treatedRevision===null)?'没有尚未处理的重伤。':b.actions<1||b.cash<60?'普通诊治需要1行动和60便士。':null;
 if(c.type==='TRAVEL')return c.to===f.location?'本人已在此处。':b.actions<1?'步行前往需1行动；普通步行返回接待处不需现款或行动。':null;
 if(c.type==='RETURN_ON_FOOT')return f.location===ERROR_ASCENT_HOME?'本人已在接待处。':null;
 if(c.type==='WAIT_FOR_PREPARATION')return f.location!==ERROR_ASCENT_WORKSHOP?'先来到调配室，再等到准备日期。':!root.ritual!.booking||root.ritual!.booking.consumeAt-86400<=f.nowSecond?'已经到准备日期，无需重复等待。':null;
 if(c.type==='MATERIAL')return b.sequence!==1?'实际晋升已结束，原件保管记录仍保留。':errorAscentMaterialBlock(root.materials!,c.command,h,ERROR_ASCENT_MATERIAL_POLICY);
 if(c.type==='STABILIZE_PROMOTION')return getErrorAscentPromotionStabilityPreview(root,c.compoundId).reason;
 if(c.type==='RITUAL'){
  if(c.command.type==='REPLACE'&&(b.acting!==100||b.week-root.source.acquisition.promotionWeek<12))return '须完整消化且已过12个实际周的时之虫本人进入替位。';
  return errorRitualBlock(root.ritual!,c.command,errorAscentRitualHost(root,eventId,revision));
 }
 if(c.type==='START_EPILOGUE')return b.sequence!==0||root.promotionWeek===null||root.epilogue!==null?'须由实际晋升且尚未离场的本人继续。':f.location!==ERROR_ASCENT_GATE?'须在钟塔外侧真实入口。':null;
 if(c.type==='EPILOGUE')return !root.epilogue||f.location!==root.epilogue.location?'本人须在同一出口现场。':errorAscentEpilogueBlock(root.epilogue,c.command,{...h,coreStats:b.coreStats});
 return '当前没有这项行动。';
}
function reduce(root: ErrorAscentState,c: ErrorAscentCommand,revision: number): ErrorAscentEvent {
 const reason=commandBlock(root,c,revision); need(reason===null,reason??'当前无法行动。');
 const f=root.frame!,b=f.budget,eventId=`R219:${root.source!.runId}:${revision}`,before=clone(f),beforeDigest=dataDigest(root),random=checks(f,eventId),financeReceipts:ErrorAscentEvent['financeReceipts']=[],notes:string[]=[];
 const time=(seconds:number)=>elapse(root,seconds,revision,eventId,financeReceipts);
 if(c.type==='WORK'){pay(b,{actions:1});b.cash+=root.source!.character.weeklyWage;f.finance.wagePaidWeek=b.week;time(28800);notes.push(`本周原职业工资${root.source!.character.weeklyWage}便士实际入账，同周不能再次领取。`);}
 else if(c.type==='REST'){pay(b,{actions:1});const life=SLICE_LIFE[f.finance.lifeTier];b.health=Math.min(100,b.health+life.health);b.mind=Math.min(100,b.mind+life.mind);const cap=b.sequence===0?ERROR_ASCENT_SPIRITUALITY_CAP:120;b.spirituality=Math.min(cap,b.spirituality+Math.round(cap*life.spirituality));b.pollution=Math.max(0,b.pollution-10);b.injuries=b.injuries.filter(i=>!(b.health>=80&&i.acquiredRevision<revision&&(i.severity==='LIGHT'||i.treatedRevision!==null&&i.treatedRevision<revision)));if(!b.injuries.length)b.injuryRisk=0;time(28800);notes.push('按实际生活档休养，未处置的重伤仍保留；原居民身体和精力没有得到补充。');}
 else if(c.type==='CLINIC'){pay(b,{actions:1,cash:60});for(const i of b.injuries)if(i.severity==='HEAVY'&&i.treatedRevision===null)i.treatedRevision=revision;time(3600);notes.push('实付60便士进行普通重伤处置，之后仍须实际休养至80健康。');}
 else if(c.type==='NEXT_WEEK'){b.actions=0;time(f.weekAnchor+604800-f.nowSecond);notes.push('走到下一实际周界，原生活费与约定还款照常结算；没有自动工资、免费修理或恢复。');}
 else if(c.type==='TRAVEL'||c.type==='RETURN_ON_FOOT'){const from=f.location;if(c.type==='TRAVEL')pay(b,{actions:1});f.location=c.type==='TRAVEL'?c.to:ERROR_ASCENT_HOME;root.materials=transportErrorAscentMaterials(root.materials!,from,f.location);time(c.type==='TRAVEL'?1800:7200);notes.push(c.type==='TRAVEL'?'本人和同一批随身原物沿普通道路实际步行半小时抵达；旧章原人原物没有随行。':'本人携同一批随身原物沿普通道路步行两小时返回街区接待处，无需行动或现款；旧费用、伤势与原物去向保留。');}

 else if(c.type==='WAIT_FOR_PREPARATION'){time(root.ritual!.booking!.consumeAt-86400-f.nowSecond);notes.push('在调配室实际等到集会前一天，跨过的每一周照常付生活费；未自动获得工资或恢复。');}
 else if(c.type==='MATERIAL'){
  const result=applyErrorAscentMaterial(root.materials!,c.command,errorAscentHost(root,eventId,revision,'bottleId' in c.command?c.command.bottleId:undefined),ERROR_ASCENT_MATERIAL_POLICY);
  root.materials=result.state;effect(root,{cashGain:0,spirituality:0,mind:0,health:0,toLocation:null,...result.effect},revision,eventId,financeReceipts);notes.push(...result.notes);
 }else if(c.type==='STABILIZE_PROMOTION'){
  const p=root.materials!.compounds.find(x=>x.id===c.compoundId)!;pay(b,ERROR_ASCENT_PROMOTION_STABILITY);time(ERROR_ASCENT_PROMOTION_STABILITY.seconds);
  root.promotionStability.preparations.push({id:`${eventId}:stability`,eventId,compoundId:p.id,actorId:root.source!.actorId,sourceDigest:root.source!.historyDigest,compoundDigest:compoundIdentity(p),preparedSecond:f.nowSecond,expiresSecond:f.nowSecond+ERROR_ASCENT_PROMOTION_STABILITY.validSeconds,status:'READY',spentEventId:null,invalidatedEventId:null});
  notes.push('实付150便士、1行动、12灵性和8精神，完成本人同一原剂的稳定准备。密封携带不改变原剂身份；七天内有效，换剂、到期或实际替位即不能再用。');
 }else if(c.type==='RITUAL'){
  const h=errorAscentRitualHost(root,eventId,revision);if(c.command.type==='REPLACE')h.check=random.input(getErrorRitualCheckInput(root.ritual!,h));
  const result=applyErrorRitual(root.ritual!,c.command,h),e=result.effect;root.ritual=result.state;
  pay(b,{cash:e.cashCost,actions:e.actions,spirituality:e.spirituality,mind:e.mental,health:e.health,pollution:e.pollution});
  for(let i=0;i<e.heavyInjuries;i++){b.injuries.push({id:`${eventId}:ritual-injury:${i}`,severity:'HEAVY',acquiredRevision:revision,treatedRevision:null});b.injuryRisk+=2;}
  if(e.promoted){need(b.status==='ACTIVE','实际死亡不能完成晋升。');b.sequence=0;b.acting=0;root.promotionWeek=b.week;for(const id of ERROR_ASCENT_ABILITY_IDS)b.mastery[id]=0;b.completedSources.push('ERROR_ASCENT_ORIGINAL_REPLACEMENT');}
  if(result.settlement){const x=result.settlement,p=root.promotionStability.preparations.find(p=>p.id===x.preparationId);need(p?.status==='READY','同一原剂的准备已失效。');
   root.materials=settleErrorAscentConsumption(root.materials!,{eventId,week:b.week,compoundId:x.compoundId,success:x.outcome==='FUSED',alive:b.status==='ACTIVE',location:x.place,residualPresent:true});p.status='SPENT';p.spentEventId=eventId;
  }
  time(e.seconds);notes.push(...result.notes);
 }else if(c.type==='START_EPILOGUE'){
  // A short real walk reaches the gallery before its independent guard begins
  // moving; it does not transport any old person or old opponent into the scene.
  const from=f.location;time(6);root.epilogue=createErrorAscentEpilogue({actorId:root.source!.actorId,week:b.week,nowSecond:f.nowSecond});f.location=root.epilogue.location;root.materials=transportErrorAscentMaterials(root.materials!,from,f.location);
  notes.push('本人沿外侧走廊实际走了六秒，来到钟塔出口。新守卫正在准备追赶，普通侧阶仍然可走；旧敌与原章物品没有随行。');
 }else if(c.type==='EPILOGUE'){
  const h={...errorAscentHost(root,eventId,revision),coreStats:b.coreStats},preview=getErrorAscentEpilogueCheckPreview(root,c.command.type);
  if(preview)h.check=random.check(preview.ability,preview.difficulty,preview.effectiveBonus,preview.source);
  const result=applyErrorAscentEpilogue(root.epilogue!,c.command,h);root.epilogue=result.state;effect(root,result.effect,revision,eventId,financeReceipts);
  for(const[ability,gain]of Object.entries(result.masteryGains)){need(ERROR_ASCENT_ABILITY_IDS.some(id=>id===ability)&&Number.isSafeInteger(gain)&&gain>=0,'有限技巧应用记录无效。');b.mastery[ability]=(b.mastery[ability]??0)+gain;}
  for(const injury of result.injuries){b.injuries.push(clone(injury));b.injuryRisk++;}notes.push(...result.notes);
 }
 if(b.status!=='ACTIVE'){
  // Death leaves finite original matter at the real scene. No extra stock,
  // resurrection, automatic return to supplier or reward transfer is created.
  for(const item of [...root.materials!.characteristics,root.materials!.uniqueness])if(['EMBODIED','FUSED','PLAYER','COMPOUND'].includes(item.holder)){item.holder='EXPOSED';item.location=f.location;}
  root.materials!.uniqueness.incumbentActorId=null;
 }
 for(const p of root.promotionStability.preparations)if(p.status==='READY'&&preparation(root,p.compoundId)?.id!==p.id){p.status='INVALIDATED';p.invalidatedEventId=eventId;}
 const event:ErrorAscentEvent={id:eventId,revision,command:clone(c),before,after:clone(f),randomReceipts:clone(random.receipts),financeReceipts,notes,beforeDigest,afterDigest:dataDigest(root)};root.journal.push(event);return event;
}
/** Cold/raw entry strictly replays every new command once. Owned transitions
 * are private WeakMap-branded drafts and never reopen/replay their prefix. */
function reconstruct(s: SliceState): ErrorAscentState {
 const saved=s.errorAscent;need(saved?.source&&validateErrorAscentSource(s,saved.source,'COLD_REOPEN'),'原身份、原人原物和三份特性历史未通过核验。');need(Array.isArray(saved.journal),'实际动作记录无效。');
 const root=start(clone(saved.source));for(const event of saved.journal){need(event&&event.revision===saved.source.revision+2+root.journal.length,'本章修订次序不一致。');const actual=reduce(root,clone(event.command),event.revision);need(sameErrorAscent(actual,event),'实际行动、检定、代价或来源与原记录不一致。');}need(sameErrorAscent(root,saved),'当前通路、原物和身体无法由实际行动重建。');
 const f=root.frame!,source=root.source!,{coreStats:_current,...identity}=s.character,{coreStats:_original,...originalIdentity}=source.character;
 need(s.progression.pathwayId==='error'&&s.revision===source.revision+1+root.journal.length&&sameErrorAscent(errorAscentBudget(s),f.budget)&&sameErrorAscent(s.random,f.random),'当前身体与实际动作终点不一致。');need(sameErrorAscent(identity,originalIdentity)&&Object.entries(f.finance).every(([key,value])=>sameErrorAscent(s[key as keyof SliceState],value)),'当前身份或生活账本不一致。');need(s.combatHistory.length===source.combatHistoryLength&&s.combat===null&&s.activeEvent===null&&s.eventQueue.length===0&&s.pulse==='NONE','旧现场或原战斗终点不一致。');return root;
}
export function validateErrorAscentRoot(s: SliceState): void { reconstruct(s); }
export function transitionErrorAscent(s: SliceState,c: ErrorAscentCommand): ErrorAscentState {const root=reconstruct(s);reduce(root,clone(c),s.revision+1);return root;}
export function openErrorAscentOwnedEngine(s: SliceState): ErrorAscentOwnedEngine { return retain(reconstruct(clone(s))); }
export function snapshotErrorAscentOwnedEngine(h: ErrorAscentOwnedEngine): ErrorAscentState { return clone(getOwned(h)); }
export function advanceErrorAscentOwnedEngine(h: ErrorAscentOwnedEngine,c: ErrorAscentCommand,revision: number): ErrorAscentOwnedEngine {const next=clone(getOwned(h));reduce(next,clone(c),revision);return retain(next);}
export function blockErrorAscentOwnedEngine(h: ErrorAscentOwnedEngine,c: ErrorAscentCommand,revision: number): string|null {try{return commandBlock(getOwned(h),c,revision);}catch{return '当前记录或行动条件无效。';}}
