import type { PublicCheckResult, PublicCoreStatKey } from '../../shared/contracts.js';
import { MOTHER_ABILITY_IDS, MOTHER_PRACTICE_COSTS, MOTHER_SAMPLE_IDS, MOTHER_PERSON_IDS, MOTHER_PRICES } from './content.js';
import type { MotherCommand, MotherScene, MotherSource, MotherSceneHost, MotherEffect, MotherPlant, MotherSampleId } from './types.js';
const clone=<T>(v:T):T=>structuredClone(v);
const simple=['LEAVE_ORIGINAL_NURSERY','INSPECT_GREENHOUSE','REPAIR_GREENHOUSE','BUY_SUPPLIES','REPORT_GREENHOUSE','START_PRACTICE','STOP_METHOD','END_CONTACT','WAIT_10','WALK_EXIT','ENTER_GREENHOUSE','REPORT_RETURN'];
const plantCommands=['TAKE_PLANT','CARRY_PLANT','PLACE_PLANT','RETURN_PLANT','WATER_PLANT','SUPPORT_PLANT','MAINTAIN_VITALITY','APPLY_MAINTENANCE','ORDINARY_MAINTENANCE','TOUCH_BRANCH','SUPPORT_BRANCH','APPLY_BRANCH_SUPPORT'];
export const isMotherSceneCommand=(c:MotherCommand):boolean=>simple.includes(c.type)||plantCommands.includes(c.type)||c.type==='ASK_OWNER'||c.type==='WITHDRAW_PERMISSION';
export function createMotherScene(source:MotherSource):MotherScene {
 const site=source.originals.site;
 return {phase:'PREPARATION',status:'ACTIVE',playerPosition:site.playerLocation==='START'?'ORIGINAL_ENTRY':'OUTSIDE',playerTravelMetres:site.playerTravelMetres,originalDepartureEventId:null,
 originalSite:clone(site),originalOperation:clone(source.originals.operation),originalRootPad:clone(source.originals.rootPad),
 plants:site.samples.filter(p=>MOTHER_SAMPLE_IDS.some(id=>p.id===id)).map(p=>({...clone(p),holder:p.holder as 'OWNER'|'RECIPIENT',location:'OUTSIDE',version:0,travelMetres:0,originalHolder:p.holder as 'OWNER'|'RECIPIENT',checkedEventId:null,placedEventId:null,wateredEventId:null,supportedEventId:null,returnedEventId:null,maintenanceEventId:null,branchEventId:null,branch:{id:`${p.id}:existing-living-branch`,exists:true,growthCount:0,version:0,deflectionMillimetres:0,supportMethod:'NONE'}})),
 permissions:{'CB3-ADA':{consent:'UNASKED',version:0,eventId:null,phase:'PREPARATION'},'CB3-LENA':{consent:'UNASKED',version:0,eventId:null,phase:'PREPARATION'}},
 greenhouse:{id:'MO229-WIND-DAMAGED-GREENHOUSE',ownerId:'CB3-ADA',inspectedEventId:null,repairEventId:null,integrity:40,exitOpen:true},
 supplies:{boughtEventId:null,waterInitial:0,waterRemaining:0,wedgesInitial:0,wedgesRemaining:0,spent:[]},contactSampleId:null,window:null,moves:[],receipts:[],greenhouseReportEventId:null,returnReportEventId:null,maintenanceApplied:false,branchApplied:false};
}
export const motherSceneInside=(s:MotherScene):boolean=>s.playerPosition!=='OUTSIDE'||s.plants.some(p=>p.holder==='PLAYER'||p.holder==='BED')||s.window!==null||s.contactSampleId!==null;
const granted=(s:MotherScene)=>MOTHER_PERSON_IDS.every(id=>s.permissions[id].consent==='GRANTED'&&s.permissions[id].phase===s.phase);
const permissionVersion=(s:MotherScene)=>MOTHER_PERSON_IDS.map(id=>`${id}:${s.permissions[id].version}`).join('|');
const allReturned=(s:MotherScene)=>s.playerPosition==='OUTSIDE'&&s.plants.every(p=>p.holder===p.originalHolder&&p.location==='OUTSIDE')&&!s.window&&!s.contactSampleId;
const validWindow=(s:MotherScene,p:MotherPlant,h:MotherSceneHost,kind:'VITALITY_MAINTENANCE'|'LIVING_BRANCH_SUPPORT')=>s.window?.kind===kind&&s.window.actorId===h.actorId&&s.window.sampleId===p.id&&s.window.targetVersion===p.version&&s.window.permissionVersion===permissionVersion(s)&&h.second<s.window.expiresAt&&p.alive&&p.vitality>0&&s.playerPosition==='GREENHOUSE'&&p.location==='GREENHOUSE'&&granted(s)&&(kind!=='LIVING_BRANCH_SUPPORT'||s.contactSampleId===p.id&&s.window.branchId===p.branch.id);
export function motherSceneBlock(s:MotherScene,c:MotherCommand,h:MotherSceneHost):string|null {
 if(!isMotherSceneCommand(c))return '这不是当前温室行动。';
 if(c.type==='LEAVE_ORIGINAL_NURSERY')return s.playerPosition==='ORIGINAL_ENTRY'?null:'本人已经走出原苗圃门口。';
 if(s.returnReportEventId)return '本轮已经如实报告，费用与原物结果保留。';
 if(c.type==='STOP_METHOD')return s.status==='ACTIVE'||s.window||s.contactSampleId?null:'已经停止；可继续普通归还和退出。';
 if(c.type==='END_CONTACT')return s.window||s.contactSampleId?null:'当前没有尚未结束的接触。';
 if(c.type==='WAIT_10')return s.window?null:'当前没有未到期的短窗。';
 if(c.type==='WITHDRAW_PERMISSION')return s.permissions[c.personId].consent==='GRANTED'?null:'当前没有这位成年人的有效许可。';
 if(c.type==='ENTER_GREENHOUSE')return s.playerPosition==='OUTSIDE'&&s.greenhouse.repairEventId&&!s.plants.some(p=>p.holder==='PLAYER')?null:'须在已查明的温室外，实际步行进入；携苗用对应的搬运行动。';
 if(c.type==='WALK_EXIT')return s.playerPosition==='GREENHOUSE'&&!s.plants.some(p=>p.holder==='PLAYER')?null:'须在温室内；若实持原苗，应携同一苗普通走出。';
 if(c.type==='REPORT_RETURN')return allReturned(s)&&(s.phase==='PRACTICE'||s.status==='ABORTED')?null:'先停止接触，把每株实际借用原苗亲还原持有人，再普通退出。';
 if(c.type==='REPORT_GREENHOUSE')return s.phase==='PREPARATION'&&s.status==='ACTIVE'&&!s.greenhouseReportEventId&&allReturned(s)&&s.greenhouse.repairEventId&&s.plants.every(p=>p.placedEventId&&p.wateredEventId&&p.supportedEventId&&p.returnedEventId)?null:'先有价修复、将两株原苗实际搬入供水楔撑，再各自亲还并退出。';
 if(c.type==='START_PRACTICE')return h.sequence===0&&s.phase==='PREPARATION'&&s.greenhouseReportEventId&&allReturned(s)?null:'须完成普通维护与原苗交还，晋升后再开始短检修。';
 if(c.type==='INSPECT_GREENHOUSE')return s.playerPosition==='OUTSIDE'&&!s.greenhouse.inspectedEventId?null:'在温室外实际检查一次风损框架、四米搬运路线与普通退路。';
 if(c.type==='REPAIR_GREENHOUSE')return !s.greenhouse.inspectedEventId?'先实查风损与普通退出路线。':s.greenhouse.repairEventId?'同一处温室已经实付修好，不重复收费。':s.playerPosition!=='OUTSIDE'?'先普通退出。':h.actions<1||h.cash<MOTHER_PRICES.greenhouseRepair?'修复需1行动、120便士与两小时，原苗尚不入内。':null;
 if(c.type==='BUY_SUPPLIES')return s.supplies.boughtEventId?'有限水与四根木楔已经购买，没有无限补充。':s.playerPosition!=='OUTSIDE'?'先普通退出。':h.cash<MOTHER_PRICES.supplies?'八份水与四根普通木楔需要40便士。':null;
 if(c.type==='ASK_OWNER')return s.playerPosition!=='OUTSIDE'?'须先当面在室外询问。':s.status!=='ACTIVE'?'本次已经停止，不重新索取撤回的许可。':s.permissions[c.personId].consent!=='UNASKED'?'本次许可已经答复；旧许可不能覆盖新一次检修。':!s.greenhouse.repairEventId?'先实际修复风损框架。':null;
 if(!('sampleId'in c))return '当前没有这项温室行动。';
 const p=s.plants.find(x=>x.id===c.sampleId);if(!p)return '只能处理眼前同一两株原活苗。';
 if(c.type==='CARRY_PLANT')return p.holder!=='PLAYER'||p.location!==s.playerPosition?'本人须实际拿着同一原苗。':c.to===s.playerPosition?'本人和原苗已经在这里。':c.to==='GREENHOUSE'&&(!granted(s)||s.status!=='ACTIVE'||!s.greenhouse.repairEventId)?'没有本次有效许可或安全作业框架；仍可携苗普通退出。':s.playerPosition==='ORIGINAL_ENTRY'?'先走出原苗圃。':null;
 if(c.type==='RETURN_PLANT')return s.playerPosition==='OUTSIDE'&&p.location==='OUTSIDE'&&p.holder==='PLAYER'?null:'须亲持原苗走到原持有人所在室外后当面交还。';
 if(c.type==='TAKE_PLANT'){
  if(s.plants.some(x=>x.holder==='PLAYER'))return '双手一次只实际携带一株原苗。';
  if(p.holder==='BED'&&p.location==='GREENHOUSE'&&s.playerPosition==='GREENHOUSE')return null;
  return s.status==='ACTIVE'&&granted(s)&&s.playerPosition==='OUTSIDE'&&p.location==='OUTSIDE'&&p.holder===p.originalHolder&&!p.returnedEventId?null:'须当面取得两位成年人本次许可后，从当前实际持有人手中亲领这株原苗。';
 }
 if(s.status!=='ACTIVE'||!granted(s))return '本次许可无效或作业停止；仍可亲取原苗并普通退出归还。';
 if(s.playerPosition!=='GREENHOUSE'||p.location!=='GREENHOUSE')return '本人须实际来到同一原苗所在温室位置。';
 if(c.type==='PLACE_PLANT')return p.holder==='PLAYER'&&!p.placedEventId?null:'须亲持本次尚未安置的原苗。';
 if(p.holder!=='BED'||!p.alive||p.vitality<=0)return '须眼前已实际安置、仍活的同一原苗。';
 if(c.type==='WATER_PLANT')return p.wateredEventId?'本次已经实际供水。':s.supplies.waterRemaining<1?'实购水已经耗尽；可停止并普通归还。':null;
 if(c.type==='SUPPORT_PLANT')return p.supportedEventId?'本次已经实际楔撑。':s.supplies.wedgesRemaining<1?'实购木楔已经耗尽；可停止并普通归还。':null;
 if(s.phase!=='PRACTICE'||h.sequence!==0)return '本轮短检修须在实际晋升后另行开始。';
 if(c.type==='TOUCH_BRANCH')return !p.branchEventId&&s.contactSampleId===null&&!s.window?null:'当前已有接触或这段原活枝已完成本次支撑。';
 if(c.type==='ORDINARY_MAINTENANCE')return p.maintenanceEventId?'本株本次短检修已经发生。':s.supplies.waterRemaining<1?'没有可实际支付的水。':null;
 if(c.type==='APPLY_MAINTENANCE')return !p.maintenanceEventId&&validWindow(s,p,h,'VITALITY_MAINTENANCE')&&s.supplies.waterRemaining>=1?null:'须未到期、目标与当前许可相符的单株短窗及一份实购水。';
 if(c.type==='APPLY_BRANCH_SUPPORT')return !p.branchEventId&&validWindow(s,p,h,'LIVING_BRANCH_SUPPORT')&&p.vitality>2&&s.supplies.waterRemaining>=1&&s.supplies.wedgesRemaining>=1?null:'须接触同一原活枝、有效短窗、活性大于2、一份水和一根普通承接木楔。';
 if(c.type==='MAINTAIN_VITALITY'||c.type==='SUPPORT_BRANCH'){
  if(s.window)return '已有短窗，先应用、松手或停止。';
  if(c.type==='MAINTAIN_VITALITY'&&p.maintenanceEventId||c.type==='SUPPORT_BRANCH'&&p.branchEventId)return '同一原苗的本次有限检修已经实际发生。';
  if(c.type==='SUPPORT_BRANCH'&&(s.contactSampleId!==p.id||p.vitality<=2||s.supplies.wedgesRemaining<1))return '先接触同一现存活枝，并留足原活性与普通木楔。';
  return h.actions<1||h.spirituality<12||h.mind<=5||s.supplies.waterRemaining<1?'须留足1行动、12灵性、5精神和一份实购水；普通供水楔撑仍可完成。':null;
 }
 return '当前没有这项温室行动。';
}
export function applyMotherScene(input:MotherScene,c:MotherCommand,h:MotherSceneHost,check:(ability:PublicCoreStatKey,difficulty:number)=>PublicCheckResult):{state:MotherScene;effect:MotherEffect;notes:string[]} {
 const reason=motherSceneBlock(input,c,h);if(reason)throw Error(reason);const s=clone(input),e:MotherEffect={actions:0,cash:0,spirituality:0,mind:0,health:0,seconds:1},notes:string[]=[];
 const p='sampleId'in c?s.plants.find(x=>x.id===c.sampleId)!:null;const before=p?.vitality??null;
 const stop=()=>{s.window=null;s.contactSampleId=null;};
 const spend=(water:number,wedges:number)=>{s.supplies.waterRemaining-=water;s.supplies.wedgesRemaining-=wedges;s.supplies.spent.push({eventId:h.eventId,sampleId:p!.id as MotherSampleId,water,wedges});};
 const move=(to:MotherScene['playerPosition'],sampleId:MotherSampleId|null)=>{const from=s.playerPosition;stop();s.playerPosition=to;s.playerTravelMetres+=4;e.seconds=4;s.moves.push({eventId:h.eventId,from,to,metres:4,seconds:4,sampleId});if(p&&sampleId){p.location=to;p.travelMetres+=4;p.version++;}};
 if(c.type==='LEAVE_ORIGINAL_NURSERY'){move('OUTSIDE',null);s.originalDepartureEventId=h.eventId;notes.push('本人携原根垫沿原门实际走四米到室外，原伤与原物完整度保留。');}
 else if(c.type==='INSPECT_GREENHOUSE'){s.greenhouse.inspectedEventId=h.eventId;e.seconds=120;notes.push('实际检查同一风损框架、四米搬运路和可随时普通退出的路线。');}
 else if(c.type==='REPAIR_GREENHOUSE'){e.actions=1;e.cash=MOTHER_PRICES.greenhouseRepair;e.seconds=7200;s.greenhouse.repairEventId=h.eventId;s.greenhouse.integrity=80;notes.push('实付120便士与1行动，用普通材料修复同一处风损框架；两株原苗尚在原持有人手中。');}
 else if(c.type==='BUY_SUPPLIES'){e.cash=MOTHER_PRICES.supplies;s.supplies.boughtEventId=h.eventId;s.supplies.waterInitial=8;s.supplies.waterRemaining=8;s.supplies.wedgesInitial=4;s.supplies.wedgesRemaining=4;notes.push('实付40便士，买到八份水与四根木楔；旧衬片、护腕与根垫没有补充。');}
 else if(c.type==='ASK_OWNER'){const permission=s.permissions[c.personId];permission.consent='GRANTED';permission.version++;permission.eventId=h.eventId;permission.phase=s.phase;notes.push(`${c.personId==='CB3-ADA'?'艾达':'莉娜'}当面同意本次有限照料、短距搬入与原路归还；原所有权和原持有人不变。`);}
 else if(c.type==='WITHDRAW_PERMISSION'){s.permissions[c.personId].consent='WITHDRAWN';s.permissions[c.personId].version++;s.status='ABORTED';stop();notes.push('本次许可撤回，短窗立即结束；普通取回、步行与当面归还仍可进行。');}
 else if(c.type==='TAKE_PLANT'){stop();p!.holder='PLAYER';p!.care='EXPOSED';p!.version++;p!.checkedEventId=h.eventId;notes.push(`当面亲取同一原苗，实测活性${p!.vitality}；未增加数量、质量或原活性。`);}
 else if(c.type==='CARRY_PLANT'){move(c.to,c.sampleId);notes.push('本人亲持同一原苗普通走四米，位置、实际路程与原持有人均有记录。');}
 else if(c.type==='PLACE_PLANT'){p!.holder='BED';p!.placedEventId=h.eventId;p!.version++;notes.push('将实际携入的原苗安置在已修好的同一温室内，没有复制或替换。');}
 else if(c.type==='RETURN_PLANT'){stop();p!.holder=p!.originalHolder;p!.care=p!.originalHolder==='RECIPIENT'?'RECIPIENT_CARE':'OWNER_CARE';p!.returnedEventId=h.eventId;p!.returns++;p!.handovers++;p!.version++;notes.push(`${p!.originalHolder==='RECIPIENT'?'莉娜':'艾达'}在室外亲收同一原苗；当前活性${p!.vitality}，所有已付费用和损耗保留。`);}
 else if(c.type==='WATER_PLANT'){spend(1,0);p!.wateredEventId=h.eventId;e.seconds=10;notes.push('消耗一份实购水普通供水，原活性保持当前数值。');}
 else if(c.type==='SUPPORT_PLANT'){spend(0,1);p!.supportedEventId=h.eventId;p!.branch.supportMethod='WEDGE';e.seconds=10;notes.push('实耗一根普通木楔，完成同一原苗的有限支撑；无需任何能力成功。');}
 else if(c.type==='REPORT_GREENHOUSE'){s.greenhouseReportEventId=h.eventId;for(const v of Object.values(s.permissions))v.consent='CLOSED';notes.push('风损温室已实付修复，两株原活苗实际搬入、普通供水楔撑并原路各自亲还。完整报告保留每次实际位置与消耗。');}
 else if(c.type==='START_PRACTICE'){s.phase='PRACTICE';for(const v of Object.values(s.permissions)){v.consent='UNASKED';v.version++;v.eventId=null;v.phase='PRACTICE';}for(const q of s.plants){q.placedEventId=null;q.wateredEventId=null;q.supportedEventId=null;q.returnedEventId=null;}notes.push('开始一次短检修，原苗仍在室外原持有人手中；另行征求本次许可后才搬入。');}
 else if(c.type==='MAINTAIN_VITALITY'||c.type==='SUPPORT_BRANCH'){const branch=c.type==='SUPPORT_BRANCH',cost=branch?MOTHER_PRACTICE_COSTS.branch:MOTHER_PRACTICE_COSTS.maintenance;e.actions=cost.actions;e.spirituality=cost.spirituality;e.mind=cost.mind;s.window={kind:branch?'LIVING_BRANCH_SUPPORT':'VITALITY_MAINTENANCE',actorId:h.actorId,sampleId:c.sampleId,branchId:branch?p!.branch.id:null,targetVersion:p!.version,permissionVersion:permissionVersion(s),createdAt:h.second,expiresAt:h.second+cost.validSeconds};notes.push('实付1行动、12灵性、5精神，开启绑定同一原活苗与本次许可的二十秒单次短窗；实际应用才独立检定。');}
 else if(c.type==='TOUCH_BRANCH'){s.contactSampleId=c.sampleId;notes.push('本人接触同一原苗上已经存在的活枝；没有长出、截取或复制枝条。');}
 else if(c.type==='APPLY_MAINTENANCE'||c.type==='ORDINARY_MAINTENANCE'){const result=c.type==='APPLY_MAINTENANCE'?check('knowledge',MOTHER_PRACTICE_COSTS.maintenance.difficulty):null,success=!!result&&['SUCCESS','GREAT_SUCCESS'].includes(result.tier);spend(1,0);e.seconds=10;p!.maintenanceEventId=h.eventId;p!.wateredEventId=h.eventId;if(!success){p!.vitality=Math.max(0,p!.vitality-1);if(result)e.mind+=2;}else{s.maintenanceApplied=true;e.mastery=[MOTHER_ABILITY_IDS[0]];}p!.alive=p!.vitality>0;p!.version++;stop();notes.push(success?'实耗一份水，对同一原活苗的十秒检修成功维持当前活性，没有恢复旧损失。':'普通供水完成同一原苗的十秒检修，实际损1活性；失败费用与结果保留。');}
 else if(c.type==='APPLY_BRANCH_SUPPORT'){const result=check('will',MOTHER_PRACTICE_COSTS.branch.difficulty),success=['SUCCESS','GREAT_SUCCESS'].includes(result.tier);spend(1,1);p!.vitality-=2;p!.alive=p!.vitality>0;p!.branch.version++;p!.branch.deflectionMillimetres=success?1:3;p!.branch.supportMethod=success?'ABILITY':'WEDGE';p!.branchEventId=h.eventId;p!.wateredEventId=h.eventId;p!.supportedEventId=h.eventId;p!.version++;e.seconds=4;if(success){s.branchApplied=true;e.mastery=[MOTHER_ABILITY_IDS[1]];}else e.mind+=2;stop();notes.push(`同一现存活枝在一次轻小检修中实际偏移${p!.branch.deflectionMillimetres}毫米，耗一份水、原苗2活性和一根普通承接木楔。枝条数不变，枯样仍死亡。`);}
 else if(c.type==='STOP_METHOD'){stop();s.status='ABORTED';notes.push('主动停止本次作业；已付费用、水、木楔、原活性损耗均保留，普通归还和退出开放。');}
 else if(c.type==='END_CONTACT'){stop();notes.push('松手并结束当前短窗，已付成本保留。');}
 else if(c.type==='WAIT_10'){e.seconds=10;notes.push('实际等待十秒，原水量、活性与费用不倒退。');}
 else if(c.type==='ENTER_GREENHOUSE'){move('GREENHOUSE',null);notes.push('本人沿已检查普通路线实际步行四米进入，未携原苗不会自动入内。');}
 else if(c.type==='WALK_EXIT'){move('OUTSIDE',null);notes.push('本人沿普通路线步行四米退出；仍在温室的原苗不会自动跟随。');}
 else if(c.type==='REPORT_RETURN'){stop();s.returnReportEventId=h.eventId;s.status=s.status==='ABORTED'?'ABORTED':'COMPLETED';for(const v of Object.values(s.permissions))if(v.consent==='GRANTED')v.consent='CLOSED';notes.push('本人已实际退出，每株借用原苗由原持有人在室外亲收；如实报告已完成或提前停止，全部费用、原活性与旧伤保留。');}
 if(s.window&&h.second+e.seconds>=s.window.expiresAt)stop();
 s.receipts.push({eventId:h.eventId,kind:c.type,sampleId:p?.id as MotherSampleId??null,beforeVitality:before,afterVitality:p?.vitality??null});
 return {state:s,effect:e,notes};
}
export function desiredMotherSceneCommand(s:MotherScene,h:MotherSceneHost):MotherCommand|null {
 if(s.returnReportEventId)return null;
 if(s.playerPosition==='ORIGINAL_ENTRY')return {type:'LEAVE_ORIGINAL_NURSERY'};
 const held=s.plants.find(p=>p.holder==='PLAYER'),bed=s.plants.find(p=>p.holder==='BED');
 if(s.status==='ABORTED'){
  if(s.window||s.contactSampleId)return {type:'END_CONTACT'};
  if(held)return s.playerPosition==='GREENHOUSE'?{type:'CARRY_PLANT',sampleId:held.id as MotherSampleId,to:'OUTSIDE'}:{type:'RETURN_PLANT',sampleId:held.id as MotherSampleId};
  if(bed&&s.playerPosition==='GREENHOUSE')return {type:'TAKE_PLANT',sampleId:bed.id as MotherSampleId};
  if(bed)return {type:'ENTER_GREENHOUSE'};
  if(s.playerPosition==='GREENHOUSE')return {type:'WALK_EXIT'};
  return {type:'REPORT_RETURN'};
 }
 if(!s.greenhouse.inspectedEventId)return {type:'INSPECT_GREENHOUSE'};
 if(!s.greenhouse.repairEventId)return {type:'REPAIR_GREENHOUSE'};
 if(!s.supplies.boughtEventId)return {type:'BUY_SUPPLIES'};
 if(s.phase==='PREPARATION'&&s.greenhouseReportEventId)return h.sequence===0?{type:'START_PRACTICE'}:null;
 for(const id of MOTHER_PERSON_IDS)if(s.permissions[id].consent==='UNASKED')return {type:'ASK_OWNER',personId:id};
 const p=s.plants.find(q=>!q.returnedEventId);if(!p)return {type:s.phase==='PREPARATION'?'REPORT_GREENHOUSE':'REPORT_RETURN'};
 const sampleId=p.id as MotherSampleId;
 if(p.holder===p.originalHolder)return {type:'TAKE_PLANT',sampleId};
 if(p.holder==='PLAYER'){
  if(s.playerPosition==='OUTSIDE')return p.placedEventId?{type:'RETURN_PLANT',sampleId}:{type:'CARRY_PLANT',sampleId,to:'GREENHOUSE'};
  return p.placedEventId?{type:'CARRY_PLANT',sampleId,to:'OUTSIDE'}:{type:'PLACE_PLANT',sampleId};
 }
 if(p.holder==='BED'&&s.playerPosition==='OUTSIDE')return {type:'ENTER_GREENHOUSE'};
 if(s.phase==='PRACTICE'&&p.id==='CB3-LIVE-1'&&!p.maintenanceEventId){if(s.window?.kind==='VITALITY_MAINTENANCE')return {type:'APPLY_MAINTENANCE',sampleId};return motherSceneBlock(s,{type:'MAINTAIN_VITALITY',sampleId},h)===null?{type:'MAINTAIN_VITALITY',sampleId}:{type:'ORDINARY_MAINTENANCE',sampleId};}
 if(s.phase==='PRACTICE'&&p.id==='CB3-LIVE-2'&&!p.supportedEventId){if(s.window?.kind==='LIVING_BRANCH_SUPPORT')return {type:'APPLY_BRANCH_SUPPORT',sampleId};if(h.actions>=1&&h.spirituality>=12&&h.mind>5&&p.vitality>2&&s.supplies.waterRemaining>=1){return s.contactSampleId===p.id?{type:'SUPPORT_BRANCH',sampleId}:{type:'TOUCH_BRANCH',sampleId};}}
 if(!p.wateredEventId)return {type:'WATER_PLANT',sampleId};
 if(!p.supportedEventId)return {type:'SUPPORT_PLANT',sampleId};
 return {type:'TAKE_PLANT',sampleId};
}
export function motherSceneActions(s:MotherScene,h:MotherSceneHost):{command:MotherCommand;label:string;cost:string}[]{
 const result:{command:MotherCommand;label:string;cost:string}[]=[];
 const add=(command:MotherCommand,label:string,cost='0行动，按实际位置操作')=>result.push({command,label,cost});
 if(s.playerPosition==='ORIGINAL_ENTRY')add({type:'LEAVE_ORIGINAL_NURSERY'},'携原根垫普通走出原苗圃','0行动，四米四秒');
 add({type:'INSPECT_GREENHOUSE'},'实查风损温室与普通退路');add({type:'REPAIR_GREENHOUSE'},'有价修复同一处风损温室','1行动、120便士、两小时');add({type:'BUY_SUPPLIES'},'实购八份水与四根普通木楔','40便士');
 for(const personId of MOTHER_PERSON_IDS){add({type:'ASK_OWNER',personId},`当面询问${personId==='CB3-ADA'?'艾达':'莉娜'}本次许可`);add({type:'WITHDRAW_PERMISSION',personId},`尊重${personId==='CB3-ADA'?'艾达':'莉娜'}撤回本次许可`);}
 for(const sampleId of MOTHER_SAMPLE_IDS){const name=sampleId==='CB3-LIVE-1'?'莉娜手中原苗':'艾达手中原苗';for(const [type,label,cost]of [
 ['TAKE_PLANT','亲取同一原苗','0行动，当面实际交接'],['PLACE_PLANT','实际安置同一原苗','0行动'],['RETURN_PLANT','当面亲还原持有人','0行动'],['WATER_PLANT','普通供水','0行动、一份实购水'],['SUPPORT_PLANT','普通木楔支撑','0行动、一根实购木楔'],['MAINTAIN_VITALITY','开启单株活性短窗','1行动、12灵性、5精神；应用另耗一份水'],['APPLY_MAINTENANCE','实际进行十秒活性检修','一份水；失败损1活性与2精神'],['ORDINARY_MAINTENANCE','普通供水完成短检修','一份水、1原活性'],['TOUCH_BRANCH','接触同一原有活枝','0行动'],['SUPPORT_BRANCH','开启原活枝支撑短窗','1行动、12灵性、5精神'],['APPLY_BRANCH_SUPPORT','实际应用一次原枝支撑','一份水、2原活性、一根承接木楔'],
 ]as const)add({type,sampleId},`${label}（${name}）`,cost);
 add({type:'CARRY_PLANT',sampleId,to:'GREENHOUSE'},`亲携${name}走入温室`,'0行动，四米四秒');add({type:'CARRY_PLANT',sampleId,to:'OUTSIDE'},`亲携${name}普通走出`,'0行动，四米四秒');}
 add({type:'REPORT_GREENHOUSE'},'报告普通修复与两苗原路交还');if(h.sequence===0)add({type:'START_PRACTICE'},'另行开始一次短检修');add({type:'END_CONTACT'},'松手并结束当前短窗');add({type:'STOP_METHOD'},'停止作业，保留实际结果');add({type:'WAIT_10'},'实际等待十秒');add({type:'ENTER_GREENHOUSE'},'沿普通路线步行进入','0行动，四米四秒');add({type:'WALK_EXIT'},'沿普通路线步行退出','0行动，四米四秒');add({type:'REPORT_RETURN'},'如实报告归还、完成或提前停止');return result;
}
