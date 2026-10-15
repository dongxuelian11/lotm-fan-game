import {hasAncientScholarLifeLock} from '../ancient-scholar/life.js';
import {hasAncientScholarEncounterLock} from '../ancient-scholar/encounter.js';
import type {SliceState} from '../slice/types.js';
import type {SeerContext} from '../seer/index.js';
import {stableStringify} from '../canonical.js';
import {MIRACLE_WORKER_FORMULA,MIRACLE_WORKER_ABILITY_IDS,MIRACLE_WORKER_ABILITIES,MIRACLE_WORKER_SOURCE,MIRACLE_WORKER_BOUNDARY,MIRACLE_WORKER_RISK} from './content.js';
import type {MiracleWorkerState,MiracleWorkerBatch,MiracleWorkerAcquisitionCommand,MiracleWorkerCommand,MiracleWorkerAction,MiracleWorkerProjection} from './types.js';
import {createMiracleWorkerLifeState,validateMiracleWorkerActivityCommand,blockMiracleWorkerActivity,applyMiracleWorkerActivity,miracleWorkerLifeActions,projectMiracleWorkerLife,validateMiracleWorkerLife,hasMiracleWorkerLifeLock} from './life.js';
import {createMiracleWorkerRitualState,validateMiracleWorkerRitualCommand,blockMiracleWorkerRitual,applyMiracleWorkerRitual,miracleWorkerRitualActions,projectMiracleWorkerRitual,validateMiracleWorkerRitualState,hasMiracleWorkerRitualLock,currentMiracleWorkerSource,canConsumeMiracleWorker} from './ritual.js';
import {createMiracleWorkerEncounterState,validateMiracleWorkerEncounterCommand,blockMiracleWorkerEncounter,applyMiracleWorkerEncounter,miracleWorkerEncounterActions,projectMiracleWorkerEncounter,validateMiracleWorkerEncounter,hasMiracleWorkerEncounterLock} from './encounter.js';
import {createMiracleWorkerRevivalState,validateMiracleWorkerRevivalCommand,blockMiracleWorkerRevival,applyMiracleWorkerRevivalCommand,miracleWorkerRevivalActions,projectMiracleWorkerRevival,validateMiracleWorkerRevivalState} from './revival.js';
const obj=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const keys=(v:object,k:readonly string[])=>Object.keys(v).sort().join('|')===[...k].sort().join('|');
const int=(v:unknown,a=0,b=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&(v as number)>=a&&(v as number)<=b;
const eq=(a:unknown,b:unknown)=>stableStringify(a)===stableStringify(b);
const win=(v:string|null)=>v==='SUCCESS'||v==='GREAT_SUCCESS';
export const isMiracleWorker=(s:SliceState)=>s.progression.pathwayId==='diviner'&&s.progression.sequence===2&&s.miracleWorker.promotionWeek!==null;
const eligible=(s:SliceState)=>s.progression.pathwayId==='diviner'&&[3,2].includes(s.progression.sequence??0)&&s.ancientScholar.promotionWeek!==null&&s.ancientScholar.ritual.location==='RECEPTION';
function batch(n:number):MiracleWorkerBatch{const id=`miracle-worker-batch-${n}`;return {id,labourSteps:0,acquiredWeek:null,brewedWeek:null,materials:MIRACLE_WORKER_FORMULA.map(f=>({id:`${id}:${f.id}`,name:f.name,quantity:f.quantity,unit:f.unit,source:`当代持照机构MW2-SUPPLIER原封第${n}批；心脏来自独立封存遗产，时/星之虫由合作机构有偿提供G，不是玩家免费分虫或复活旧人。`,holder:'SUPPLIER'}))};}
export function createMiracleWorkerState():MiracleWorkerState{return {formulaKnown:false,batches:[1,2,3].map(batch),bottles:[],promotionWeek:null,ancientActingAtPromotion:null,ritual:createMiracleWorkerRitualState(),life:createMiracleWorkerLifeState(),encounter:createMiracleWorkerEncounterState(),revival:createMiracleWorkerRevivalState()};}
export const hasMiracleWorkerLock=(s:SliceState)=>s.status==='REVIVAL_PENDING'||hasMiracleWorkerRitualLock(s)||hasMiracleWorkerLifeLock(s)||hasMiracleWorkerEncounterLock(s);
export function validateMiracleWorkerAcquisitionCommand(v:unknown):v is MiracleWorkerAcquisitionCommand{if(!obj(v))return false;if(v.type==='LEARN_FORMULA')return keys(v,['type']);if(v.type==='CONSUME')return keys(v,['type','bottleId','confirmed'])&&v.confirmed===true&&typeof v.bottleId==='string'&&/^miracle-worker-batch-[1-9]\d{0,5}:bottle$/.test(v.bottleId);return ['MATERIAL_WORK','BUY_MATERIALS','BREW'].includes(String(v.type))&&keys(v,['type','batchId'])&&typeof v.batchId==='string'&&/^miracle-worker-batch-[1-9]\d{0,5}$/.test(v.batchId);}
const price=(b:MiracleWorkerBatch)=>b.labourSteps===3?180:1500;
function acquisitionBlock(s:SliceState,c:MiracleWorkerAcquisitionCommand):string|null{
 if(!eligible(s)||s.status!=='ACTIVE'||s.health<=0||s.progression.sequence!==3)return '须活着且已真正晋升古代学者3；本阶只能晋升一次。';
 const m=s.miracleWorker;if(c.type==='CONSUME')return !m.bottles.some(b=>b.id===c.bottleId&&b.status==='PREPARED')?'同一原瓶不存在或已耗尽。':s.progression.acting!==100?'古代学者须消化100。':s.health<=20||s.mind<=40?'饮药须健康>20、精神>40。':canConsumeMiracleWorker(s,c.bottleId)?null:'必须本人在真实回归现场，绑定此瓶的600秒一次窗口仍开放。';
 if(m.ritual.location!=='RECEPTION')return '原材料只能在当代接待处实际筹备。';
 if(c.type==='LEARN_FORMULA')return m.formulaKnown?'配方已知。':s.actionsRemaining<1?'学习需要1行动。':s.cash<180?'完整方指导180便士。':null;
 if(!m.formulaKnown)return '先取得完整方与真实回归要求。';if(!('batchId'in c))return '批次无效。';const b=m.batches.find(b=>b.id===c.batchId);if(!b)return '原批次不存在。';
 if(c.type==='MATERIAL_WORK')return s.actionsRemaining<1?'材料劳动需要1行动。':b.acquiredWeek!==null||b.labourSteps>=3?'这一原批已交付或劳动完成。':null;
 if(c.type==='BUY_MATERIALS')return b.acquiredWeek!==null?'同批原件已交付。':s.cash<price(b)?`这批原件需要${price(b)}便士；三次真实劳动后180便士G。`:null;
 return b.acquiredWeek===null||b.brewedWeek!==null?'须取得未用过的这一整批原料。':s.actionsRemaining<1?'真实调配需1行动。':s.cash<60?'真实调配需60便士。':null;
}
function applyAcquisition(s:SliceState,c:MiracleWorkerAcquisitionCommand,ctx:SeerContext){const reason=acquisitionBlock(s,c);if(reason)throw Error(reason);const m=s.miracleWorker;
 if(c.type==='LEARN_FORMULA'){s.actionsRemaining--;s.cash-=180;m.formulaKnown=true;ctx.note('取得奇迹师完整配方及仪式边界',MIRACLE_WORKER_SOURCE+MIRACLE_WORKER_BOUNDARY);return;}
 if(c.type==='CONSUME'){const b=m.bottles.find(x=>x.id===c.bottleId)!,q=currentMiracleWorkerSource(s)!,result=ctx.check('will',30);b.status='CONSUMED';b.consumedWeek=s.week;b.outcome=result.tier;b.restorationId=q.restorationId;q.window='CONSUMED';
  if(win(result.tier)){m.promotionWeek=s.week;m.ancientActingAtPromotion=100;s.progression.sequence=2;s.progression.acting=0;s.mind=Math.max(1,s.mind-(result.tier==='GREAT_SUCCESS'?8:15));for(const id of MIRACLE_WORKER_ABILITY_IDS)s.progression.mastery[id]=0;for(const k of ['physique','perception','will','knowledge'] as const)s.character.coreStats[k]=Math.min(500,s.character.coreStats[k]+1);ctx.note('历史真实回归尾声，饮药晋升奇迹师2',`${b.id}真实耗尽，意志${result.roll}/${result.chance} ${result.tier}；精神有损耗，四属性各+1G，不补生命灵性。旧S3消化100保留，新消化0。四次复起账本尚未使用，不赠源堡、神灯、嫁接或现成愿望库存。`);}
  else{const severe=result.tier==='GREAT_FAILURE';s.health=Math.max(1,s.health-(severe?25:15));s.mind=Math.max(1,s.mind-(severe?45:25));s.seer.pollution=Math.min(100,s.seer.pollution+(severe?60:30));ctx.note('聚落已经回归，本瓶排异未晋升',`${result.roll}/${result.chance} ${result.tier}；原瓶与一次药窗耗尽，身心损害/污染保留。本作G现场支持只使这次药败保底1。${q.name}、当前原人、永久通路与物品交换不重置，不能再用同村充遗落历史。`);}return;}
 if(!('batchId'in c))throw Error('批次无效');const b=m.batches.find(x=>x.id===c.batchId)!;
 if(c.type==='MATERIAL_WORK'){s.actionsRemaining--;b.labourSteps++;ctx.note('对本批真实原材料完成不同劳动',`${b.id}第${b.labourSteps}/3项：${['核主材来源封签','核300毫升原血容器','核时之虫与星之虫原封凭证'][b.labourSteps-1]}。每项1行动；三项后折价，不免费发魔药。`);return;}
 if(c.type==='BUY_MATERIALS'){s.cash-=price(b);b.acquiredWeek=s.week;b.materials.forEach(x=>x.holder='PLAYER');ctx.note('本批四项原材料实际交付',`${b.id}支付${price(b)}便士G，独立原主料与原三辅料在手；聚落原人和原档案不是药材。`);return;}
 s.actionsRemaining--;s.cash-=60;b.brewedWeek=s.week;b.materials.forEach(x=>{x.holder='CONSUMED';x.quantity=0;});m.bottles.push({id:`${b.id}:bottle`,batchId:b.id,inputIds:b.materials.map(x=>x.id),brewedWeek:s.week,status:'PREPARED',consumedWeek:null,outcome:null,restorationId:null});ctx.note('奇迹师原瓶真实调成',`${b.id}四项原件耗尽，1行动/60便士，唯一${b.id}:bottle在手；没有完成回归仪式。`);
}
export function validateMiracleWorkerCommand(v:unknown):v is MiracleWorkerCommand{return validateMiracleWorkerAcquisitionCommand(v)||validateMiracleWorkerRitualCommand(v)||validateMiracleWorkerActivityCommand(v)||validateMiracleWorkerEncounterCommand(v)||validateMiracleWorkerRevivalCommand(v);}
export function miracleWorkerCommandBlock(s:SliceState,c:MiracleWorkerCommand):string|null{
 if(validateMiracleWorkerRevivalCommand(c))return blockMiracleWorkerRevival(s,c);
 if(s.status!=='ACTIVE'||s.health<=0)return '仅有限复起待决命令可处理真实死亡；普通死档不能重开。';
 if(!eligible(s)||s.combat||s.activeEvent||hasAncientScholarLifeLock(s)||hasAncientScholarEncounterLock(s))return '先完成当代原处准备和现有战斗/事件。';
 if(hasMiracleWorkerEncounterLock(s)&&!validateMiracleWorkerEncounterCommand(c))return '先从原石场真实退出。';
 if(hasMiracleWorkerLifeLock(s)&&!validateMiracleWorkerActivityCommand(c))return '先归还原物并收束当前愿望实践。';
 if(hasMiracleWorkerRitualLock(s)&&!validateMiracleWorkerRitualCommand(c)&&!(validateMiracleWorkerAcquisitionCommand(c)&&c.type==='CONSUME'))return '先结束当前原聚落现场并沿路返回。';
 if(validateMiracleWorkerAcquisitionCommand(c))return acquisitionBlock(s,c);
 if(validateMiracleWorkerRitualCommand(c))return blockMiracleWorkerRitual(s,c);
 if(validateMiracleWorkerActivityCommand(c))return blockMiracleWorkerActivity(s,c);
 if(validateMiracleWorkerEncounterCommand(c))return blockMiracleWorkerEncounter(s,c);
 return '无效奇迹师命令。';
}
export function applyMiracleWorkerCommand(s:SliceState,c:MiracleWorkerCommand,ctx:SeerContext,award:(source:string,amount:number)=>void):'FINAL_DEATH'|'OK'{const reason=miracleWorkerCommandBlock(s,c);if(reason)throw Error(reason);
 if(validateMiracleWorkerRevivalCommand(c)){const result=applyMiracleWorkerRevivalCommand(s,c,ctx);return result==='FINAL_DEATH'?'FINAL_DEATH':'OK';}
 if(validateMiracleWorkerAcquisitionCommand(c))applyAcquisition(s,c,ctx);
 else if(validateMiracleWorkerRitualCommand(c)){applyMiracleWorkerRitual(s,c,ctx);if(c.type==='VERIFY_NEW_LEAD')s.miracleWorker.batches.push(batch(s.miracleWorker.batches.length+1));}
 else if(validateMiracleWorkerActivityCommand(c))applyMiracleWorkerActivity(s,c,ctx,award);
 else if(validateMiracleWorkerEncounterCommand(c))applyMiracleWorkerEncounter(s,c,ctx);
 return 'OK';
}
export function projectMiracleWorker(s:SliceState):MiracleWorkerProjection{
 const m=s.miracleWorker,discovered=eligible(s),a:MiracleWorkerAction[]=[];
 const add=(label:string,c:MiracleWorkerCommand,cost:string)=>{const reason=miracleWorkerCommandBlock(s,c);a.push({id:`MW2:${a.length}:${c.type}`,label,cost,command:c,enabled:reason===null,reason});};
 if(discovered&&s.progression.sequence===3){if(!m.formulaKnown)add('学习奇迹师完整方与真实历史回归',{type:'LEARN_FORMULA'},'1行动 180便士');else for(const b of m.batches){if(b.acquiredWeek===null){if(b.labourSteps<3)add(`${b.id}材料劳动${b.labourSteps}/3`,{type:'MATERIAL_WORK',batchId:b.id},'1行动');add(`取得${b.id}原材料`,{type:'BUY_MATERIALS',batchId:b.id},`${price(b)}便士`);}else if(b.brewedWeek===null)add(`调配${b.id}`,{type:'BREW',batchId:b.id},'1行动 60便士');}
 for(const b of m.bottles.filter(x=>x.status==='PREPARED'))add(`在真实回归尾声饮用${b.id}`,{type:'CONSUME',bottleId:b.id,confirmed:true},'独立确认 · 一次原瓶和药窗');}
 if(discovered)for(const x of [...miracleWorkerRitualActions(s),...miracleWorkerLifeActions(s),...miracleWorkerEncounterActions(s),...miracleWorkerRevivalActions(s)]){const reason=miracleWorkerCommandBlock(s,x.command);a.push({...x,enabled:reason===null,reason});}
 const ritual=projectMiracleWorkerRitual(s);return {title:isMiracleWorker(s)?'奇迹师 · 序列2':'奇迹师之路 · 遗落历史真正回归',discovered,promoted:isMiracleWorker(s),formulaKnown:m.formulaKnown,formula:m.formulaKnown?MIRACLE_WORKER_FORMULA.map(x=>({...x})):[],story:MIRACLE_WORKER_SOURCE,boundary:MIRACLE_WORKER_BOUNDARY,risk:MIRACLE_WORKER_RISK,acting:isMiracleWorker(s)?s.progression.acting:0,digestion:`古代学者消化${m.ancientActingAtPromotion??s.progression.acting}/100；奇迹师三种实际情境与反思100为G，不靠复活刷消化。`,supplies:`${m.batches.length}个独立原材料批次，原瓶${m.bottles.length}，耗尽${m.bottles.filter(x=>x.status==='CONSUMED').length}；每个回归来源仅一次药窗。`,actions:a,abilities:isMiracleWorker(s)?MIRACLE_WORKER_ABILITIES.map(x=>({...x,mastery:s.progression.mastery[x.id]??0})):[],insideCase:hasMiracleWorkerLock(s),environment:ritual.summary,ritual,life:projectMiracleWorkerLife(s),encounter:projectMiracleWorkerEncounter(s),revival:projectMiracleWorkerRevival(s)};
}
export function validateMiracleWorkerState(s:SliceState):boolean{try{const m=s.miracleWorker,f=createMiracleWorkerState();if(!obj(m)||!keys(m,Object.keys(f))||typeof m.formulaKnown!=='boolean'||!Array.isArray(m.batches)||m.batches.length!==m.ritual.sources.length||!Array.isArray(m.bottles))return false;
 let wins=0;for(const [i,b]of m.batches.entries()){const base=batch(i+1);if(!obj(b)||!keys(b,Object.keys(base))||b.id!==base.id||!int(b.labourSteps,0,3)||![b.acquiredWeek,b.brewedWeek].every(x=>x===null||int(x,1,s.week))||!Array.isArray(b.materials)||b.materials.length!==4)return false;
  if(b.brewedWeek!==null&&(b.acquiredWeek===null||b.brewedWeek<b.acquiredWeek)||!m.formulaKnown&&(b.labourSteps>0||b.acquiredWeek!==null))return false;
  for(const [j,x]of b.materials.entries()){const e={...base.materials[j]!,holder:b.brewedWeek!==null?'CONSUMED':b.acquiredWeek!==null?'PLAYER':'SUPPLIER',quantity:b.brewedWeek!==null?0:base.materials[j]!.quantity};if(!eq(x,e))return false;}
  if(m.bottles.filter(x=>x.batchId===b.id).length!==(b.brewedWeek===null?0:1))return false;
 }
 for(const b of m.bottles){if(!obj(b)||!keys(b,['id','batchId','inputIds','brewedWeek','status','consumedWeek','outcome','restorationId']))return false;const x=m.batches.find(x=>x.id===b.batchId);if(!x||b.id!==`${x.id}:bottle`||b.brewedWeek!==x.brewedWeek||!eq(b.inputIds,x.materials.map(m=>m.id)))return false;
  if(b.status==='PREPARED'){if(b.consumedWeek!==null||b.outcome!==null||b.restorationId!==null)return false;}
  else if(b.status==='CONSUMED'){if(!int(b.consumedWeek,b.brewedWeek,s.week)||!['SUCCESS','GREAT_SUCCESS','FAILURE','GREAT_FAILURE'].includes(b.outcome??'')||!m.ritual.sources.some(q=>q.restorationId===b.restorationId&&q.bottleId===b.id&&q.window==='CONSUMED'))return false;if(win(b.outcome)){wins++;if(b.consumedWeek!==m.promotionWeek)return false;}}
  else return false;
 }
 if(isMiracleWorker(s)){if(!m.formulaKnown||!int(m.promotionWeek,1,s.week)||m.ancientActingAtPromotion!==100||wins!==1||MIRACLE_WORKER_ABILITY_IDS.some(id=>!int(s.progression.mastery[id],0,500)))return false;}
 else if(m.promotionWeek!==null||m.ancientActingAtPromotion!==null||wins||MIRACLE_WORKER_ABILITY_IDS.some(id=>Object.hasOwn(s.progression.mastery,id)))return false;
 if(m.formulaKnown&&!eligible(s))return false;
 return validateMiracleWorkerRitualState(s)&&validateMiracleWorkerLife(s)&&validateMiracleWorkerEncounter(s)&&validateMiracleWorkerRevivalState(s);
}catch{return false;}}
export type * from './types.js';
