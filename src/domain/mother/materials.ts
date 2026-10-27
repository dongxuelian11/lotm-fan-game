import type { PublicCheckResult } from '../../shared/contracts.js';
import type { MotherSource } from './source.js';
import type { MotherCommand, MotherMaterials, MotherState, MotherEffect, MotherPlaceId } from './types.js';
import { MOTHER_ORIGINAL_IDS, MOTHER_PRICES } from './content.js';
import { NATURE_WALKER_LABOUR_STEPS, NATURE_WALKER_LABOUR_TASKS, natureWalkerPrices } from '../nature-walker/content.js';
export const motherOriginalRemainingPrice = (labourSteps: number): number => { const p = natureWalkerPrices(); return p.potion - (labourSteps === NATURE_WALKER_LABOUR_STEPS ? p.labourCredit : 0); };
export const MOTHER_RECOVERY='MO229-RECOVERY',MOTHER_VAULT='MO229-VAULT',MOTHER_WORKSHOP='MO229-WORKSHOP',MOTHER_HOME='MO229-GREENHOUSE';
export function createMotherMaterials(source:MotherSource):MotherMaterials {
 return {originals:MOTHER_ORIGINAL_IDS.map((originalId):MotherMaterials['originals'][number]=>{
  const item=source.originalCharacteristics.characteristics.find(x=>x.originalBottleId===originalId)!;
  const consumed=item.consumptionHistory.at(-1);
  return {originalId,characteristicId:item.characteristicId,labourSteps:source.acquisition.bottles.find(b=>b.id===item.latestBottleId)?.labourSteps??0,labourEventIds:[],latestBottleId:item.latestBottleId,failedConsumptionRevision:item.holder==='FAILED_REMNANT'?consumed?.revision??null:null,holder:item.holder==='FAILED_REMNANT'?'UNLOCATED_REMNANT':item.holder,location:item.holder==='EMBODIED'?null:item.holder==='PLAYER'?(source.originals.site.playerLocation==='START'?'MO229-NURSERY-ENTRY':'MO229-NURSERY-OUTSIDE'):item.holder==='SUPPLIER'?MOTHER_RECOVERY:null,compoundId:null,permissionEventId:null,permissionWeek:null,investigationEventId:null,sealedEventId:null,sealedWeek:null,sealedSecond:null,recoveredEventId:null};
 }),uniqueness:{id:'MO229-UNIQUENESS',holder:'CUSTODIAN',verifiedEventId:null,acquiredEventId:null,location:MOTHER_VAULT,compoundId:null},carriers:[1,2,3].map(i=>({id:`MO229-CARRIER-${i}`,status:'SUPPLIER',boughtEventId:null})),compounds:[]};
}
const MATERIAL_TYPES=['WORK_ORIGINAL','ASK_RECOVERY_PERMISSION','INVESTIGATE_REMAINS','SEAL_ORIGINAL','RECOVER_ORIGINAL','VERIFY_UNIQUENESS','ACQUIRE_UNIQUENESS','BUY_CARRIER','COMPOSE','SEAL_REMAINS','RECOVER_REMAINS'];
export const isMotherMaterialCommand=(c:MotherCommand):boolean=>MATERIAL_TYPES.includes(c.type);
export function motherMaterialBlock(root:MotherState,c:MotherCommand):string|null {
 const f=root.frame!,b=f.budget,m=root.materials!,item='originalId'in c?m.originals.find(x=>x.originalId===c.originalId):null;
 if(b.sequence!==1)return '晋升后的同一三份特性已经融合，不能再拆取材料。';
 if('originalId'in c){
  if(!item)return '没有这份原特性。';
  if(item.compoundId!==null||['EMBODIED','FUSED','COMPOUND','DEATH_REMAINS'].includes(item.holder))return '该份原特性仍在同一本体或成药中，不能重复提取。';
  if(f.location!==MOTHER_RECOVERY)return '须本人实际到旧服药场地办理原件交接。';
  if(c.type==='ASK_RECOVERY_PERMISSION')return item.permissionWeek===b.week?'已取得本周对这份原件的调查和交接许可。':null;
  if(c.type==='WORK_ORIGINAL')return item.holder!=='SUPPLIER'?'只有仍在供应方的同一原瓶可补足原定劳务。':item.labourSteps>=NATURE_WALKER_LABOUR_STEPS?'这份原瓶的五步劳务已经实际完成。':b.actions<1?'本步真实劳务需要1行动。':null;
  if(item.permissionWeek!==b.week||!item.permissionEventId)return '先取得本周对这一份原件的实际调查和交接许可。';
  if(c.type==='INVESTIGATE_REMAINS')return item.holder!=='UNLOCATED_REMNANT'?'只可调查尚未查明去向的失败残余。':b.actions<1||b.cash<MOTHER_PRICES.residueInspection?'调查需要1行动和120便士。':null;
  if(c.type==='SEAL_ORIGINAL')return item.holder!=='LOCATED'||!item.investigationEventId?'先实际找到这份旧残余。':b.actions<1?'封存需要1行动。':null;
  if(c.type==='RECOVER_ORIGINAL'){
   if(item.holder==='SUPPLIER'){
    const cost=motherOriginalRemainingPrice(item.labourSteps);
    return b.cash<cost?`尚未交付的同一原瓶仍须支付${cost}便士，不能以失败残余折价。`:null;
   }
   if(item.holder==='PLAYER')return '本人已持有这份原件。';
   if(item.holder!=='SEALED_REMNANT'||item.sealedWeek===null||item.sealedSecond===null)return '须先实际封存找到的同一份残余。';
   if(b.week<=item.sealedWeek||f.nowSecond<item.sealedSecond+604800)return '封存后须经过至少七个实际日及一个真实周界，再交接同一残余。';
   return b.actions<1||b.cash<MOTHER_PRICES.originalRecovery?'回收需要1行动和30便士。':null;
  }
 }
 if(c.type==='VERIFY_UNIQUENESS')return f.location!==MOTHER_VAULT?'须本人实际到封存保管室核对原件。':m.uniqueness.verifiedEventId?'已经核对前任退出、析出与同一原件的保管链。':b.actions<1||b.cash<100?'核验需要1行动和100便士。':null;
 if(c.type==='ACQUIRE_UNIQUENESS')return f.location!==MOTHER_VAULT||m.uniqueness.holder!=='CUSTODIAN'||!m.uniqueness.verifiedEventId?'先到封存保管室核验这一件唯一性。':b.actions<1||b.cash<150?'交接需要1行动和150便士。':null;
 if(c.type==='BUY_CARRIER')return f.location!==MOTHER_WORKSHOP?'须本人实际到调配室购买有限载体。':!m.carriers.some(x=>x.status==='SUPPLIER')?'三只有限载体均已交付，没有额外补货。':m.carriers.some(x=>x.status==='PLAYER')?'先使用已购的同一载体。':b.cash<50?'一只新载体需要50便士。':null;
 if(c.type==='COMPOSE'){
  if(f.location!==MOTHER_WORKSHOP)return '须本人和材料实际到封闭调配室。';
  if(m.compounds.some(x=>['PREPARED','FAILED_EXPOSED','FAILED_SEALED'].includes(x.status)))return '先处理当前同一份成药或封存残余。';
  if(!m.carriers.some(x=>x.status==='PLAYER'))return '先购买一只尚未用过的有限载体。';
  if(m.originals.filter(x=>x.holder==='EMBODIED').length!==1||m.originals.filter(x=>x.holder==='PLAYER'&&x.location===f.location).length!==2||m.uniqueness.holder!=='PLAYER'||m.uniqueness.location!==f.location)return '须有同一本体内的一份原特性、实持的另外两份及同一唯一性。';
  if(!root.scene?.greenhouseReportEventId)return '先实际完成风损温室修复、两株原苗的普通供水支撑与当面归还报告。';
  return b.actions<1||b.cash<40?'调配需要1行动和40便士。':null;
 }
 if(c.type==='SEAL_REMAINS'||c.type==='RECOVER_REMAINS'){
  const p=m.compounds.find(x=>x.id===c.compoundId);
  if(!p||p.location!==f.location)return '须本人实际在同一份残余所在地。';
  if(c.type==='SEAL_REMAINS')return p.status!=='FAILED_EXPOSED'?'没有可封存的存活失败残余。':b.actions<1?'封存需要1行动。':null;
  if(p.status!=='FAILED_SEALED'||p.sealedWeek===null||p.sealedSecond===null)return '先封存同一份失败残余。';
  if(b.week<=p.sealedWeek||f.nowSecond<p.sealedSecond+604800)return '须在封存后经过七个实际日及真实周界才能回收。';
  return b.actions<1||b.cash<60?'回收同一残余需要1行动和60便士。':null;
 }
 return '当前没有这项原件操作。';
}
export function applyMotherMaterial(root:MotherState,c:MotherCommand,eventId:string,check:()=>PublicCheckResult):{effect:MotherEffect;notes:string[]} {
 const reason=motherMaterialBlock(root,c);if(reason)throw Error(reason);
 const f=root.frame!,b=f.budget,m=root.materials!,item='originalId'in c?m.originals.find(x=>x.originalId===c.originalId)!:null;
 const e:MotherEffect={actions:0,cash:0,spirituality:0,mind:0,health:0,seconds:60},notes:string[]=[];
 if(c.type==='WORK_ORIGINAL'){e.actions=1;e.seconds=28800;const task=NATURE_WALKER_LABOUR_TASKS[item!.labourSteps];item!.labourSteps++;item!.labourEventIds.push(eventId);notes.push(`为同一原瓶实际完成${task}（${item!.labourSteps}/5）；既有进度保留，五项不同劳务完成才抵原定6000便士，另付1200便士。`);}
 else if(c.type==='ASK_RECOVERY_PERMISSION'){item!.permissionWeek=b.week;item!.permissionEventId=eventId;notes.push('原场地保管人当面同意本周仅调查、封存和交接这一份实际原件。');}
 else if(c.type==='INVESTIGATE_REMAINS'){
  e.actions=1;e.cash=120;e.seconds=1800;const result=check();
  if(result.tier==='SUCCESS'||result.tier==='GREAT_SUCCESS'){item!.holder='LOCATED';item!.location=f.location;item!.investigationEventId=eventId;notes.push('实付调查后在原服药场地找到了同一份残余，仍未进入本人库存。');}
  else notes.push('本次实付调查未找到可确认的原残余；费用和检定保留，不能凭旧失败记录领取特性。');
 }
 else if(c.type==='SEAL_ORIGINAL'){e.actions=1;e.seconds=300;item!.holder='SEALED_REMNANT';item!.sealedEventId=eventId;item!.sealedWeek=b.week;item!.sealedSecond=f.nowSecond+e.seconds;notes.push('同一份找到的原残余已实际封存，至少七日后再交接。');}
 else if(c.type==='RECOVER_ORIGINAL'){
  if(item!.holder==='SUPPLIER'){e.cash=motherOriginalRemainingPrice(item!.labourSteps);notes.push('按同一原瓶尚欠的真实价格交接未服用的特性；没有凭空增加原件。');}
  else {e.actions=1;e.cash=30;notes.push('经过真实等待并实付后，封存的同一原残余实际交到本人手中。旧原瓶仍已耗尽。');}
  item!.holder='PLAYER';item!.location=f.location;item!.recoveredEventId=eventId;
 }
 else if(c.type==='VERIFY_UNIQUENESS'){e.actions=1;e.cash=100;e.seconds=1800;m.uniqueness.verifiedEventId=eventId;notes.push('实际核对前任已经退出、同一唯一性析出及保管交接，当前没有在任容纳者；这里只证明这一件原物。');}
 else if(c.type==='ACQUIRE_UNIQUENESS'){e.actions=1;e.cash=150;m.uniqueness.holder='PLAYER';m.uniqueness.acquiredEventId=eventId;notes.push('实付150便士，保管人把同一唯一性实际交给本人。');}
 else if(c.type==='BUY_CARRIER'){e.cash=50;const carrier=m.carriers.find(x=>x.status==='SUPPLIER')!;carrier.status='PLAYER';carrier.boughtEventId=eventId;notes.push('实付50便士购买一只有限封装载体，尚未调配。');}
 else if(c.type==='COMPOSE'){
  e.actions=1;e.cash=40;e.seconds=1800;const carrier=m.carriers.find(x=>x.status==='PLAYER')!,embodied=m.originals.find(x=>x.holder==='EMBODIED')!,held=m.originals.filter(x=>x.holder==='PLAYER');
  const id=`MO229-COMPOUND-${m.compounds.length+1}`;carrier.status='SPENT';
  for(const original of held){original.holder='COMPOUND';original.compoundId=id;}m.uniqueness.holder='COMPOUND';m.uniqueness.compoundId=id;
  m.compounds.push({id,carrierId:carrier.id,status:'PREPARED',location:f.location,originalIds:held.map(x=>x.originalId),embodiedOriginalId:embodied.originalId,uniquenessId:'MO229-UNIQUENESS',preparedEventId:eventId,consumedEventId:null,sealedEventId:null,sealedWeek:null,sealedSecond:null,recoveredEventId:null});notes.push('同一载体实际封装手中的两份原特性与唯一性。第三份始终在本人体内，只记录同一身份，没有取出或增加第四份。');
 }
 else if(c.type==='SEAL_REMAINS'){
  e.actions=1;e.seconds=300;const p=m.compounds.find(x=>x.id===c.compoundId)!;p.status='FAILED_SEALED';p.sealedEventId=eventId;p.sealedWeek=b.week;p.sealedSecond=f.nowSecond+e.seconds;
  for(const x of m.originals.filter(x=>p.originalIds.includes(x.originalId)))x.holder='SEALED_REMNANT';m.uniqueness.holder='SEALED';notes.push('实际封存本次失败的同一两份原特性与唯一性；存活本体中的第三份没有被抽出。');
 }
 else if(c.type==='RECOVER_REMAINS'){
  e.actions=1;e.cash=60;const p=m.compounds.find(x=>x.id===c.compoundId)!;p.status='RECOVERED';p.recoveredEventId=eventId;
  for(const x of m.originals.filter(x=>p.originalIds.includes(x.originalId))){x.holder='PLAYER';x.compoundId=null;x.location=f.location;x.recoveredEventId=eventId;}
  Object.assign(m.uniqueness,{holder:'PLAYER',compoundId:null,location:f.location});notes.push('七日后实付60便士回收同一份封存残余，旧载体仍耗尽；下一次须使用余下有限载体。');
 }
 return {effect:e,notes};
}
export function transportMotherMaterials(m:MotherMaterials,from:MotherPlaceId,to:MotherPlaceId):void {
 for(const item of m.originals)if(item.holder==='PLAYER'&&item.location===from)item.location=to;
 if(m.uniqueness.holder==='PLAYER'&&m.uniqueness.location===from)m.uniqueness.location=to;
 for(const p of m.compounds)if(p.status==='PREPARED'&&p.location===from){p.location=to;for(const x of m.originals.filter(x=>x.compoundId===p.id))x.location=to;if(m.uniqueness.compoundId===p.id)m.uniqueness.location=to;}
}
export function motherMaterialActions(root:MotherState):{command:MotherCommand;label:string;cost:string}[]{
 const result:{command:MotherCommand;label:string;cost:string}[]=[],m=root.materials!,week=root.frame!.budget.week;
 for(const item of m.originals)if(item.compoundId===null&&!['EMBODIED','FUSED','DEATH_REMAINS','COMPOUND','PLAYER'].includes(item.holder)){
  if(item.holder==='SUPPLIER'&&item.labourSteps<NATURE_WALKER_LABOUR_STEPS)result.push({command:{type:'WORK_ORIGINAL',originalId:item.originalId},label:`为原件${MOTHER_ORIGINAL_IDS.indexOf(item.originalId)+1}${NATURE_WALKER_LABOUR_TASKS[item.labourSteps]}（${item.labourSteps}/5）`,cost:'1行动、八小时'});
  const type=item.permissionWeek!==week?'ASK_RECOVERY_PERMISSION':item.holder==='UNLOCATED_REMNANT'?'INVESTIGATE_REMAINS':item.holder==='LOCATED'?'SEAL_ORIGINAL':'RECOVER_ORIGINAL';
  const label={ASK_RECOVERY_PERMISSION:'询问这一份原件的调查交接许可',INVESTIGATE_REMAINS:'实际调查旧残余去向',SEAL_ORIGINAL:'实际封存找到的原残余',RECOVER_ORIGINAL:'交接这一份原件'}[type];
  const bottle=root.source!.acquisition.bottles.find(x=>x.id===item.latestBottleId);
  const cost=type==='ASK_RECOVERY_PERMISSION'?'0行动':type==='INVESTIGATE_REMAINS'?'1行动、120便士':type==='SEAL_ORIGINAL'?'1行动':item.holder==='SUPPLIER'?`0行动、${bottle?motherOriginalRemainingPrice(item.labourSteps):0}便士`:'1行动、30便士；封存满七日';
  result.push({command:{type,originalId:item.originalId},label:`${label}（原件${MOTHER_ORIGINAL_IDS.indexOf(item.originalId)+1}）`,cost});
 }
 if(m.uniqueness.holder==='CUSTODIAN')result.push(m.uniqueness.verifiedEventId?{command:{type:'ACQUIRE_UNIQUENESS'},label:'实际接收同一唯一性',cost:'1行动、150便士'}:{command:{type:'VERIFY_UNIQUENESS'},label:'核验唯一性的保管链',cost:'1行动、100便士'});
 if(!m.compounds.some(x=>['PREPARED','FAILED_EXPOSED','FAILED_SEALED','SUCCESS','DEATH_REMAINS'].includes(x.status))){
  if(m.carriers.some(x=>x.status==='PLAYER'))result.push({command:{type:'COMPOSE'},label:'调配同一两份原件与唯一性',cost:'1行动、40便士'});
  else if(m.carriers.some(x=>x.status==='SUPPLIER'))result.push({command:{type:'BUY_CARRIER'},label:'购买一只有限封装载体',cost:'50便士'});
 }
 for(const p of m.compounds)if(p.status==='FAILED_EXPOSED'||p.status==='FAILED_SEALED')result.push({command:{type:p.status==='FAILED_EXPOSED'?'SEAL_REMAINS':'RECOVER_REMAINS',compoundId:p.id},label:p.status==='FAILED_EXPOSED'?'封存本次实际失败残余':'回收同一份封存残余',cost:p.status==='FAILED_EXPOSED'?'1行动':'1行动、60便士；封存满七日'});
 return result;
}
export function projectMotherMaterials(m:MotherMaterials):string[]{
 const names:Record<string,string>={EMBODIED:'仍在本人体内',SUPPLIER:'仍由原供应方保管',UNLOCATED_REMNANT:'旧失败残余尚未找到',LOCATED:'已实际找到，尚未封存',SEALED_REMNANT:'同一残余已封存',PLAYER:'本人实持',COMPOUND:'同一封装内',FUSED:'已与本体融合',DEATH_REMAINS:'死亡遗留',CUSTODIAN:'由原保管人封存',EXPOSED:'本次失败残余',SEALED:'本次失败残余已封存'};
 return [...m.originals.map((x,i)=>`原特性${i+1}：${names[x.holder]}${x.holder==='SUPPLIER'?`；原瓶劳务${x.labourSteps}/5，当前余款${motherOriginalRemainingPrice(x.labourSteps)}便士`: ''}。`),`唯一性：${names[m.uniqueness.holder]}，始终只有一件。`,`封装载体：剩余供应${m.carriers.filter(x=>x.status==='SUPPLIER').length}只，本人持有${m.carriers.filter(x=>x.status==='PLAYER').length}只，已耗${m.carriers.filter(x=>x.status==='SPENT').length}只。`];
}
