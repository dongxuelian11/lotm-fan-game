import type {PublicGameDate,PublicResolutionTier} from '../../shared/contracts.js';
import type {SliceState} from '../slice/types.js';
import type {SeerContext} from '../seer/index.js';
import {addGameDays,isValidGameDate,formatGameDate} from '../game-calendar.js';
import {stableStringify} from '../canonical.js';
import { receptionEconomySnapshot, resolveReceptionEconomy, type ReceptionEconomyCommand } from '../reception-economy.js';
import type {MiracleWorkerAction} from './types.js';
export type MiracleWorkerPlace='RECEPTION'|'GATE_OUT'|'GATE_IN'|'COURTYARD'|'ARCHIVE';
export type MiracleWorkerRitualCommand=
 |{type:'REQUEST_NEW_LEAD'|'VERIFY_NEW_LEAD'|'REVIEW_RETURN'|'SURVEY_GATE'|'CONTACT_SETTLEMENT'|'REPAIR_ANCHOR'|'REWORK_ANCHOR'|'VERIFY_GENERATIONS'|'INVITE_REPRESENTATIVES'|'OBSERVE_EXCHANGE'|'WAIT_WINDOW'|'LEAVE_RITUAL'|'WORK'|'REST'|'NEXT_WEEK'}
 |{type:'INVESTIGATE_SOURCE';sourceId:string;step:'ARCHIVE'|'ANCHOR'}
 |{type:'PREPARE_RETURN_KIT'|'TRAVEL_TO_GATE';sourceId:string}
 |{type:'REGISTER_RETURN_PLAN';sourceId:string;bottleId:string}
 |{type:'OPEN_PASSAGE';confirmed:true}
 |{type:'MOVE';destination:MiracleWorkerPlace};
interface Resident{id:string;bodyId:string;name:string;birthDate:PublicGameDate;alive:true;place:MiracleWorkerPlace;consent:'NOT_ASKED'|'STAY'|'ROUND_TRIP'|'REFUSED'}
interface Original{id:string;holder:string;place:MiracleWorkerPlace;createdSecond:number|null}
export interface MiracleWorkerSource {
 id:string;name:string;lostDate:PublicGameDate;discoveredWeek:number|null;investigations:('ARCHIVE'|'ANCHOR')[];
 kitWeek:number|null;registeredWeek:number|null;bottleId:string|null;tripStartedWeek:number|null;
 surveyed:boolean;contacted:boolean;repairOutcome:PublicResolutionTier|null;repairDone:boolean;spentPins:number;gateOpen:boolean;
 verifiedIds:string[];invited:boolean;exchangeStep:number;restoredAt:number|null;restorationId:string|null;
 window:'NONE'|'OPEN'|'CONSUMED'|'EXPIRED'|'DECLINED';deadline:number|null;
 paidPennies:number;residents:Resident[];originals:Original[];
 history:{step:string;second:number;date:PublicGameDate;facts:string}[];
}
export interface MiracleWorkerRitualState {reviewed:boolean;currentSourceId:string|null;location:MiracleWorkerPlace;elapsedSeconds:number;sources:MiracleWorkerSource[];leads:{id:string;sourceId:string;requestedWeek:number;confirmedWeek:number|null;paidPennies:number}[];journeys:{bodyId:string;sourceId:string;from:MiracleWorkerPlace;to:MiracleWorkerPlace;metres:number;second:number}[];work:{week:number|null;works:number;rests:number;weeks:number;income:number;expenses:number;emergencyUsed:boolean}}
export interface MiracleWorkerRitualProjection {location:string;insideCase:boolean;summary:string;boundary:string;currentSourceId:string|null;elapsedSeconds:number;sources:{id:string;name:string;facts:string[];residents:string[];originals:string[];history:string[]}[];ordinaryLife:string;routes:string[];journeys:string[]}
const DATE=(year:number,month=1,day=1):PublicGameDate=>({epoch:'FIFTH_EPOCH',year,month,day});
const DEFS=[{id:'MW2-WHITE-ELM',name:'白榆水闸',lost:DATE(1341,11,6),names:['艾达·莫伦','诺安·莫伦','瑟薇·泰勒','米兰·洛斯','贝丝·安瑟','乔林·范恩','伊莲·范恩','科尔·泰勒']},
 {id:'MW2-CEDAR-MILL',name:'雪松磨坊',lost:DATE(1318,3,17),names:['莉娅·克里','多林·克里','薇罗·赫尔','艾文·米尔','娜芙·赫尔','罗安·辛','佩莉·辛','盖文·罗']},
 {id:'MW2-SLATE-COURT',name:'石板院落',lost:DATE(1327,8,9),names:['梅尔·诺克','希文·诺克','蒂莎·维尔','雷恩·罗','妮娜·科尔','贝罗·丹','艾莉·丹','芬恩·雷']}] as const;
type SourceDef={id:string;name:string;lost:PublicGameDate;names:readonly string[];origin?:string;birthShift?:number};
function sourceDef(index:number):SourceDef{
 if(index<DEFS.length)return DEFS[index]!;
 const n=index+1,k=(n-4)%3;
 const themes=[{name:'北锚盐井',cause:'旧盐井的固定折叠井道在地层崩移后与现实脱开；井下水源和盐田在隔绝空间中由后代维持',family:'奥栎'}, {name:'青陶渠园',cause:'制陶渠园的固定折叠水渠在外界改道后失锚；内部水塘、菜地与陶窑经代际维护',family:'泽林'}, {name:'赤崖炭坞',cause:'山崖炭坞的固定折叠桥在旧崩塌中断离现实；林圃和粮田在独立空间内世代轮作',family:'科岚'}];
 const t=themes[k]!;return {id:`MW2-LEAD-${n}`,name:`${t.name}·第${n}号独立旧址`,lost:DATE(1280+(n%51),1+(n%12),1+(n%25)),names:['芮达','诺维','瑟琳','米恩','贝洛','乔芙','伊莎','科恩'].map(x=>`${x}·${t.family}`),birthShift:1+n%9,origin:`G独立地块${n}：${t.cause}。外界原产权图格${n}、最后供货账${n}、失联注销簿${n}、不同墓册与当代原家户均单独核验；不是移动已回归旧村或换一套复制身体。`};
}
const BIRTHS=[DATE(1586,4,18),DATE(1608,6,3),DATE(1617,9,2),DATE(1624,1,12),DATE(1596,2,8),DATE(1612,7,16),DATE(1629,2,14),DATE(1620,11,6)];
const keys=(v:object,k:readonly string[])=>Object.keys(v).sort().join('|')===[...k].sort().join('|');
const obj=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const int=(v:unknown,a=0,b=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&(v as number)>=a&&(v as number)<=b;
const eq=(a:unknown,b:unknown)=>stableStringify(a)===stableStringify(b);
function freshSource(d:SourceDef):MiracleWorkerSource {
 const id=d.id;
 return {id,name:d.name,lostDate:structuredClone(d.lost),discoveredWeek:null,investigations:[],kitWeek:null,registeredWeek:null,bottleId:null,tripStartedWeek:null,surveyed:false,contacted:false,repairOutcome:null,repairDone:false,spentPins:0,gateOpen:false,verifiedIds:[],invited:false,exchangeStep:0,restoredAt:null,restorationId:null,window:'NONE',deadline:null,paidPennies:0,
 residents:d.names.map((name,i)=>({id:`${id}:R${i+1}`,bodyId:`${id}:R${i+1}:body`,name,birthDate:{...structuredClone(BIRTHS[i]!),year:BIRTHS[i]!.year-(d.birthShift??0)},alive:true,place:i===7?'GATE_IN':'ARCHIVE',consent:'NOT_ASKED'})),
 originals:[{id:`${id}:seal`,holder:`${id}:GATE-CABINET`,place:'GATE_IN',createdSecond:null},{id:`${id}:census`,holder:`${id}:R1`,place:'ARCHIVE',createdSecond:null},{id:`${id}:cloth`,holder:`${id}:R3`,place:'ARCHIVE',createdSecond:null},{id:`${id}:lamp`,holder:'SUPPLIER',place:'RECEPTION',createdSecond:null},{id:`${id}:receipt`,holder:'NOT_CREATED',place:'GATE_OUT',createdSecond:null}],history:[]};
}
export function createMiracleWorkerRitualState():MiracleWorkerRitualState{return {reviewed:false,currentSourceId:null,location:'RECEPTION',elapsedSeconds:0,sources:DEFS.map(freshSource),leads:[],journeys:[],work:{week:null,works:0,rests:0,weeks:0,income:0,expenses:0,emergencyUsed:false}};}
export const currentMiracleWorkerSource=(s:SliceState)=>s.miracleWorker.ritual.sources.find(x=>x.id===s.miracleWorker.ritual.currentSourceId);
export const hasMiracleWorkerRitualLock=(s:SliceState)=>s.miracleWorker.ritual.location!=='RECEPTION';
const eligible=(s:SliceState)=>s.progression.pathwayId==='diviner'&&[3,2].includes(s.progression.sequence??0)&&s.ancientScholar.promotionWeek!==null&&s.ancientScholar.ritual.location==='RECEPTION';
const SIMPLE=['REQUEST_NEW_LEAD','VERIFY_NEW_LEAD','REVIEW_RETURN','SURVEY_GATE','CONTACT_SETTLEMENT','REPAIR_ANCHOR','REWORK_ANCHOR','VERIFY_GENERATIONS','INVITE_REPRESENTATIVES','OBSERVE_EXCHANGE','WAIT_WINDOW','LEAVE_RITUAL','WORK','REST','NEXT_WEEK'];
export function validateMiracleWorkerRitualCommand(v:unknown):v is MiracleWorkerRitualCommand{
 if(!obj(v))return false;if(SIMPLE.includes(String(v.type)))return keys(v,['type']);
 if(v.type==='MOVE')return keys(v,['type','destination'])&&['RECEPTION','GATE_OUT','GATE_IN','COURTYARD','ARCHIVE'].includes(String(v.destination));
 if(v.type==='OPEN_PASSAGE')return keys(v,['type','confirmed'])&&v.confirmed===true;
 if(typeof v.sourceId!=='string'||!DEFS.some(x=>x.id===v.sourceId)&&!/^MW2-LEAD-[1-9]\d{0,5}$/.test(v.sourceId))return false;
 if(v.type==='INVESTIGATE_SOURCE')return keys(v,['type','sourceId','step'])&&['ARCHIVE','ANCHOR'].includes(String(v.step));
 if(v.type==='REGISTER_RETURN_PLAN')return keys(v,['type','sourceId','bottleId'])&&typeof v.bottleId==='string'&&/^miracle-worker-batch-[1-9]\d{0,5}:bottle$/.test(v.bottleId);
 return ['PREPARE_RETURN_KIT','TRAVEL_TO_GATE'].includes(String(v.type))&&keys(v,['type','sourceId']);
}
const ROUTES:[MiracleWorkerPlace,MiracleWorkerPlace,number][]=[['RECEPTION','GATE_OUT',80],['GATE_OUT','GATE_IN',12],['GATE_IN','COURTYARD',40],['COURTYARD','ARCHIVE',24]];
const distance=(a:MiracleWorkerPlace,b:MiracleWorkerPlace)=>ROUTES.find(x=>x[0]===a&&x[1]===b||x[1]===a&&x[0]===b)?.[2];
export function blockMiracleWorkerRitual(s:SliceState,c:MiracleWorkerRitualCommand):string|null{
 if(!validateMiracleWorkerRitualCommand(c)||s.status!=='ACTIVE'||s.health<=0||!eligible(s))return '须真实活着的当代古代学者或奇迹师；普通死档不开放。';
 const r=s.miracleWorker.ritual,q='sourceId'in c?r.sources.find(x=>x.id===c.sourceId):currentMiracleWorkerSource(s);
 if(['WORK','REST','NEXT_WEEK'].includes(c.type)){
  if(r.location!=='RECEPTION')return '先本人沿原路回当代接待处。';
  if(c.type==='NEXT_WEEK')return s.actionsRemaining!==0?'用完本周行动再推进真实七天。':s.cash<24?'七天生活费24便士；可用本周有限补劳动。':null;
  if(c.type==='WORK')return s.actionsRemaining>0||s.cash<24&&!r.work.emergencyUsed?null:'本周行动用尽；有限补劳动已用或无需启用。';
  return s.actionsRemaining<1?'休养需要1行动。':s.cash<8?'休养需要8便士。':null;
 }
 if(c.type==='LEAVE_RITUAL')return r.location==='RECEPTION'?'本人已在接待处。':null;
 if(c.type==='MOVE'){
  if(!q||!q.tripStartedWeek||distance(r.location,c.destination)===undefined)return '只能走原场相邻已知普通路段。';
  if(c.destination==='RECEPTION')return '用明确离场动作收束药窗并实际回接待处。';
  if([r.location,c.destination].some(x=>['GATE_IN','COURTYARD','ARCHIVE'].includes(x))&&!q.gateOpen)return '原固定门尚未真实修复打开。';return null;
 }
 if(c.type==='WAIT_WINDOW')return q?.window==='OPEN'?null:'当前没有开放药窗。';
 if(s.progression.sequence!==3)return '本次已晋2，保留所有回归事实，不重复本阶仪式。';
 if(!s.miracleWorker.formulaKnown)return '先取得本阶完整配方指导。';
 if(c.type==='REVIEW_RETURN')return r.reviewed?'已读风险和不可逆后果。':null;
 if(!r.reviewed)return '先阅读真实回归、代际与一次性药窗后果。';
 if(c.type==='REQUEST_NEW_LEAD'||c.type==='VERIFY_NEW_LEAD'){
  if(r.location!=='RECEPTION')return '须在当代接待处实查新独立档案。';
  if(!r.sources.every(x=>x.restorationId!==null)||!s.miracleWorker.bottles.every(x=>x.status==='CONSUMED'&&['FAILURE','GREAT_FAILURE'].includes(x.outcome??'')))return '现有各原来源须已真实回归、原瓶都失败耗尽；不能免费囤无限来源。';
  const pending=r.leads.find(x=>x.confirmedWeek===null);
  if(c.type==='REQUEST_NEW_LEAD'&&pending)return '已有一条实际委托的线索，等待核验。';
  if(c.type==='VERIFY_NEW_LEAD'&&(!pending||s.week<=pending.requestedWeek))return '先付费委托，并经过下一真实周再核当地原址与原目录。';
  return s.actionsRemaining<1?'实际查档/实地核验需要1行动。':s.cash<48?'本次真实调查48便士。':null;
 }
 if(!q)return '缺少真实已登记来源。';
 if(q.restorationId)return '这个聚落已经真实回归，不能重置或再次充当遗落历史。';
 if(['INVESTIGATE_SOURCE','PREPARE_RETURN_KIT','REGISTER_RETURN_PLAN','TRAVEL_TO_GATE'].includes(c.type)){
  if(r.location!=='RECEPTION')return '在当代接待处实际筹备，不能隔空采购。';
  const i=r.sources.indexOf(q);if(i>0&&r.sources[i-1]!.restorationId===null)return '先完成当前已知来源，不凭空跳出另一个村落。';
  if(i>0&&q.discoveredWeek===null&&s.week<=(r.sources[i-1]!.registeredWeek??s.week))return '新的独立目击线索须等待下一真实周并付费调查。';
  if(c.type==='INVESTIGATE_SOURCE')return s.actionsRemaining<1?'调查需要1行动。':s.cash<24?'调查需要24便士。':q.investigations.includes(c.step)?'该原证据已经调查，不刷重复记录。':c.step==='ANCHOR'&&!q.investigations.includes('ARCHIVE')?'先看当年的原外档。':null;
  if(q.investigations.length!==2)return '先实际核查原外档与固定外锚目录。';
  if(c.type==='PREPARE_RETURN_KIT')return q.kitWeek!==null?'本来源原工具包已购，不重复发原灯。':s.actionsRemaining<1?'领原工具需要1行动。':s.cash<168?'原工具、四枚原销和交换灯需要168便士。':null;
  if(q.kitWeek===null)return '先取得这一来源的原工具与备件。';
  if(c.type==='REGISTER_RETURN_PLAN')return q.registeredWeek!==null?'原瓶已绑定此来源。':s.cash<96?'本次当代接待与固定维修服务96便士。':s.progression.acting!==100?'古代学者消化须100。':!s.miracleWorker.bottles.some(b=>b.id===c.bottleId&&b.status==='PREPARED')?'须实际未耗的本瓶。':r.sources.some(x=>x.bottleId===c.bottleId)?'本瓶已登记其他来源。':null;
  return q.registeredWeek===null?'先登记原瓶与本次人员。':s.actionsRemaining<1?'实际走80米去外锚需要1行动。':s.cash<24?'本次搬运与现场费24便士。':null;
 }
 if(r.location==='RECEPTION'||r.currentSourceId!==q.id)return '须亲自到当前原场。';
 if(c.type==='SURVEY_GATE')return q.surveyed?'已经核对原断锚。':r.location!=='GATE_OUT'?'须在外锚现场。':null;
 if(c.type==='CONTACT_SETTLEMENT')return !q.surveyed?'先检查外锚。':q.contacted?'已认识当前居民，不能重置首次接触。':r.location!=='GATE_OUT'?'须在原裂隙外侧。':null;
 if(c.type==='REPAIR_ANCHOR')return !q.contacted?'先与真实现生门房协商。':q.repairOutcome!==null?'已做过本次检定，失败走普通返工，不重掷。':r.location!=='GATE_OUT'?'须在原锚边。':null;
 if(c.type==='REWORK_ANCHOR')return !q.repairOutcome||q.repairDone?'没有这次已知故障需返工。':r.location!=='GATE_OUT'?'须在原锚边。':null;
 if(c.type==='OPEN_PASSAGE')return !q.repairDone?'原锚尚未修复。':q.gateOpen?'已打开原门。':r.location!=='GATE_OUT'?'须本人在外端与内侧门房共同开闩。':null;
 if(c.type==='VERIFY_GENERATIONS')return r.location!=='ARCHIVE'?'须穿过原门，走到原记录室与原保管员核验。':q.verifiedIds.length?'代际、墓标、现住册已交叉核过。':null;
 if(c.type==='INVITE_REPRESENTATIVES')return !q.verifiedIds.length?'先核验代际与当前原人。':q.invited?'同意/拒绝已记录，不强迫改口。':r.location!=='ARCHIVE'?'与本人在原记录室当面协商。':null;
 if(c.type==='OBSERVE_EXCHANGE')return !q.invited?'先取得具体原人的往返同意。':r.location!=='GATE_OUT'?'本人先沿原路回外端接待台见证；不遥控居民。':q.exchangeStep>=7?'本次原物往返已经结束。':null;
 return '此刻没有该项可执行步骤。';
}
function log(s:SliceState,q:MiracleWorkerSource,step:string,facts:string){q.history.push({step,second:s.miracleWorker.ritual.elapsedSeconds,date:structuredClone(s.date),facts});}
function tick(s:SliceState,n:number){const r=s.miracleWorker.ritual;r.elapsedSeconds+=n;for(const q of r.sources)if(q.window==='OPEN'&&r.elapsedSeconds>(q.deadline??0))q.window='EXPIRED';}
function move(s:SliceState,q:MiracleWorkerSource,bodyId:string,from:MiracleWorkerPlace,to:MiracleWorkerPlace,metres:number){tick(s,metres);s.miracleWorker.ritual.journeys.push({bodyId,sourceId:q.id,from,to,metres,second:s.miracleWorker.ritual.elapsedSeconds});}
/** One deterministic original-resident step; no new body or object is manufactured. */
function exchange(q:MiracleWorkerSource,n:number,now:number){
 const [keeper,noran,sevi,,,,,door]=q.residents;const [seal,census,cloth,lamp,receipt]=q.originals;
 if(n===1){census!.holder=sevi!.id;seal!.holder=noran!.id;seal!.place='ARCHIVE';}
 if(n===2){noran!.place='GATE_OUT';seal!.place='GATE_OUT';}
 if(n===3){sevi!.place='GATE_OUT';census!.place='GATE_OUT';cloth!.place='GATE_OUT';}
 if(n===4){cloth!.holder='AS3-ELIN';lamp!.holder=noran!.id;lamp!.place='GATE_OUT';receipt!.holder=noran!.id;receipt!.createdSecond=now;}
 if(n===5){noran!.place='GATE_IN';seal!.place='GATE_IN';seal!.holder=door!.id;lamp!.place='GATE_IN';lamp!.holder=q.residents[5]!.id;receipt!.place='GATE_IN';receipt!.holder=q.residents[5]!.id;q.residents[5]!.place='GATE_IN';}
 if(n===6){sevi!.place='ARCHIVE';census!.place='ARCHIVE';census!.holder=keeper!.id;}
}
const EXCHANGE_TEXT=['保管员当面把同一现住原册交给瑟薇，门房把原闸印交给诺安。','诺安由原记录室、院落、门内走76米到外端，携同一原印；现生本人出现于当代。','瑟薇携原册与本季原布样走同一76米到当代台面；不是投影。','当代接待员核原印原册、接过原布样；把已买原灯与刚写的唯一当日回执交给诺安。','诺安携同一原灯/原回执和原印走12米返内门，亲手给现生乔林与门房。','瑟薇携同一现住原册走76米回原记录室归还保管员；不把原册消耗成魔药。','内门乔林沿12米走出，当面确认原灯已装入门房、回执留内侧；两侧实际往返与持续通道共同成立。'];
export function applyMiracleWorkerRitual(s:SliceState,c:MiracleWorkerRitualCommand,ctx:SeerContext):void{
 const reason=blockMiracleWorkerRitual(s,c);if(reason)throw Error(reason);const r=s.miracleWorker.ritual,q=('sourceId'in c?r.sources.find(x=>x.id===c.sourceId):currentMiracleWorkerSource(s))!;
 if(['WORK','REST','NEXT_WEEK'].includes(c.type)){
  const {after,workAfter}=resolveReceptionEconomy(receptionEconomySnapshot(s),r.work,c.type as ReceptionEconomyCommand);
  s.actionsRemaining=after.actions;s.cash=after.cash;s.week=after.week;s.date=after.date;s.health=after.health;s.mind=after.mind;s.spirituality=after.spirituality;s.seer.pollution=after.pollution;s.injuries=after.injuries;s.injuryRisk=after.injuryRisk;r.work=workAfter;
  if(c.type==='WORK')ctx.note('当代实际劳动','花1行动完成原机构普通整理，得24便士G；不调用三百年前工资。');
  else if(c.type==='REST')ctx.note('当代接待处实际处置休养','沿用本机构后世G服务：1行动、8便士，健康+5、精神+8、灵性+10、排异−10；普通处置原伤并重置风险，原受伤历史保留。');
  else ctx.note('后世实际经过七天','扣24便士生活费、下一周4行动；居民仍是当代原人，旧时代不重开。');return;
 }
 if(c.type==='REVIEW_RETURN'){r.reviewed=true;ctx.note('核对让遗落历史回到当代','固定G隔绝空间曾真正脱离外界现实，内有代际生死；回归不是发文章。真实联系一旦建立不可逆，每原来源仅开一次绑定原瓶600秒G窗口。');return;}
 if(c.type==='REQUEST_NEW_LEAD'){const n=r.sources.length+1;s.actionsRemaining--;s.cash-=48;r.leads.push({id:`MW2-LEAD-REQUEST-${n}`,sourceId:`MW2-LEAD-${n}`,requestedWeek:s.week,confirmedWeek:null,paidPennies:48});ctx.note('付费调查另一处独立遗落线索',`花1行动48便士查外部原产权/失联目录；线索MW2-LEAD-${n}尚未变成已确认聚落，须下一真实周再次实地核验。已回归原三处、旧药败与居民不改。`);return;}
 if(c.type==='VERIFY_NEW_LEAD'){const lead=r.leads.find(x=>x.confirmedWeek===null)!;s.actionsRemaining--;s.cash-=48;lead.confirmedWeek=s.week;lead.paidPennies+=48;const next=freshSource(sourceDef(r.sources.length));r.sources.push(next);ctx.note('隔周实核新独立旧址与原封材料渠道',`${next.id} ${sourceDef(r.sources.length-1).origin} 本次另付1行动48便士；只确认独立来源和供应方同号原批，尚未接触内部原人、购买材料、调药或完成回归。新来源仍须逐步现场原流程。`);return;}
 if(c.type==='INVESTIGATE_SOURCE'){s.actionsRemaining--;s.cash-=24;q.paidPennies+=24;q.discoveredWeek??=s.week;q.investigations.push(c.step);log(s,q,c.type,`${c.step}：${q.id}原外档与其固定外锚坐标，同一来源而非失败生成新村。`);ctx.note('实际查到独立遗落来源',q.history.at(-1)!.facts);return;}
 if(c.type==='PREPARE_RETURN_KIT'){s.actionsRemaining--;s.cash-=168;q.paidPennies+=168;q.kitWeek=s.week;q.originals[3]!.holder='PLAYER';log(s,q,c.type,`${q.id}:原工具、2工作销/2备用销、唯一交换灯实际交付。`);ctx.note('领取这一来源原工具与交换灯','支付168便士和1行动，原件都有本来源ID；未生成魔药或完成仪式。');return;}
 if(c.type==='REGISTER_RETURN_PLAN'){s.cash-=96;q.paidPennies+=96;q.registeredWeek=s.week;q.bottleId=c.bottleId;log(s,q,c.type,`原瓶${c.bottleId}登记，本次当代接待员AS3-ELIN及维修员MW2-TECH-01服务96便士。`);ctx.note('登记同一原瓶与有限人员',q.history.at(-1)!.facts);return;}
 if(c.type==='TRAVEL_TO_GATE'){s.actionsRemaining--;s.cash-=24;q.paidPennies+=24;q.tripStartedWeek??=s.week;r.currentSourceId=q.id;move(s,q,`${s.runId}:body`,'RECEPTION','GATE_OUT',80);move(s,q,'AS3-ELIN:body','RECEPTION','GATE_OUT',80);r.location='GATE_OUT';q.originals[3]!.place='GATE_OUT';log(s,q,c.type,'本人、原工具/原瓶与实际当代接待员各沿80米路到外锚；没有旧人复活。');ctx.note('本人真正到原外锚',q.history.at(-1)!.facts);return;}
 if(c.type==='LEAVE_RITUAL'){
  if(q.window==='OPEN')q.window='DECLINED';let here=r.location;const order:MiracleWorkerPlace[]=['ARCHIVE','COURTYARD','GATE_IN','GATE_OUT','RECEPTION'];while(here!=='RECEPTION'){const next=order[order.indexOf(here)+1]!;move(s,q,`${s.runId}:body`,here,next,distance(here,next)!);here=next;}
  r.location='RECEPTION';r.currentSourceId=null;if(q.originals[3]!.holder==='PLAYER')q.originals[3]!.place='RECEPTION';log(s,q,c.type,'本人沿已走过的普通路段返当代；任何已回归原人原物与持续门都不重置。');ctx.note('实际返回当代接待处',q.history.at(-1)!.facts);return;
 }
 if(c.type==='MOVE'){move(s,q,`${s.runId}:body`,r.location,c.destination,distance(r.location,c.destination)!);r.location=c.destination;if(q.originals[3]!.holder==='PLAYER')q.originals[3]!.place=c.destination;ctx.note('本人沿固定普通路段移动',`${q.name}内同一身体现在${c.destination}；现场累计${r.elapsedSeconds}秒G。`);return;}
 if(c.type==='WAIT_WINDOW'){tick(s,601);ctx.note('真实等待，药窗已经过期','回归的聚落、原人原物仍在当代，不能重新把他们遗落来刷资格。');return;}
 if(c.type==='SURVEY_GATE'){tick(s,60);q.surveyed=true;log(s,q,c.type,'原锚断裂与1341等固定遗落日原档对应，不是只被封几天的道路。');}
 if(c.type==='CONTACT_SETTLEMENT'){tick(s,120);q.contacted=true;log(s,q,c.type,'从有限裂隙与当前门房互相自我介绍；保管员仍在原记录室，须本人进门后实访。内部时间正常，祖辈已经死去。');}
 if(c.type==='REPAIR_ANCHOR'){const a=ctx.check('knowledge',30);q.repairOutcome=a.tier;q.repairDone=['SUCCESS','GREAT_SUCCESS'].includes(a.tier);q.spentPins=q.repairDone?2:a.tier==='FAILURE'?1:2;tick(s,90);if(a.tier==='GREAT_FAILURE')s.mind=Math.max(1,s.mind-4);log(s,q,c.type,`原销实际使用，${a.roll}/${a.chance} ${a.tier}；失败保存并用原包备用销普通返工，不重抽。`);}
 if(c.type==='REWORK_ANCHOR'){tick(s,q.repairOutcome==='GREAT_FAILURE'?180:90);q.spentPins+=2;q.repairDone=true;log(s,q,c.type,'耗同包两枚原备用销完成已知故障返工；原报废销不复原。');}
 if(c.type==='OPEN_PASSAGE'){tick(s,30);q.gateOpen=true;log(s,q,c.type,'双方开原普通门闩，12米固定通道持续可走；没有新晋能力或投影开门。');}
 if(c.type==='VERIFY_GENERATIONS'){tick(s,180);q.verifiedIds=[`${q.id}:external-last-cargo`,`${q.id}:birth-death-ledgers`,`${q.id}:grave-mill-crosscheck`,`${q.id}:census-1651`,...q.residents.map(x=>x.bodyId)];log(s,q,c.type,'核原出生/死亡册、墓标、磨坊供给与8个现生身体。莫伦原世系1289–1356→1322–1391→1353–1420→1382–1452→1411–1480→1441–1512→1470–1540→1499–1571→1528–1600→1558–1633；后两代1586/1608现生。各来源独立原册，不称保管员亲历300年前。');}
 if(c.type==='INVITE_REPRESENTATIVES'){tick(s,60);q.invited=true;q.residents.forEach((x,i)=>x.consent=i===1||i===2?'ROUND_TRIP':i===3?'REFUSED':'STAY');log(s,q,c.type,'两名现生成年人自愿携原物当天往返；米兰同龄对应原人拒绝，其他留守。拒绝不惩罚、不用强控凑数。');}
 if(c.type==='OBSERVE_EXCHANGE'){
  const n=q.exchangeStep+1,seconds=[10,76,76,20,12,76,12][n-1]!;tick(s,seconds);exchange(q,n,r.elapsedSeconds);q.exchangeStep=n;
  if(n===2||n===3)r.journeys.push({bodyId:q.residents[n-1]!.bodyId,sourceId:q.id,from:'ARCHIVE',to:'GATE_OUT',metres:76,second:r.elapsedSeconds});
  if(n===5)r.journeys.push({bodyId:q.residents[1]!.bodyId,sourceId:q.id,from:'GATE_OUT',to:'GATE_IN',metres:12,second:r.elapsedSeconds});
  if(n===6)r.journeys.push({bodyId:q.residents[2]!.bodyId,sourceId:q.id,from:'GATE_OUT',to:'ARCHIVE',metres:76,second:r.elapsedSeconds});
  if(n===7){q.residents[5]!.place='GATE_OUT';r.journeys.push({bodyId:q.residents[5]!.bodyId,sourceId:q.id,from:'GATE_IN',to:'GATE_OUT',metres:12,second:r.elapsedSeconds});q.restoredAt=r.elapsedSeconds;q.restorationId=`${s.runId}:${q.id}:RETURN`;q.window='OPEN';q.deadline=r.elapsedSeconds+600;}
  log(s,q,`${c.type}:${n}`,EXCHANGE_TEXT[n-1]!);
 }
 ctx.note(q.restorationId&&c.type==='OBSERVE_EXCHANGE'?'遗落的真实共同体回到当前时代':'原聚落实际步骤',q.history.at(-1)!.facts+(q.window==='OPEN'?' 同一原瓶600秒G窗口现在开放，回归已不可逆。':''));
}
export function canConsumeMiracleWorker(s:SliceState,id:string):boolean{const q=currentMiracleWorkerSource(s),r=s.miracleWorker.ritual;return !!q&&r.location==='GATE_OUT'&&q.window==='OPEN'&&q.bottleId===id&&q.restorationId!==null&&r.elapsedSeconds<=(q.deadline??0);}
export function miracleWorkerRitualActions(s:SliceState):MiracleWorkerAction[]{
 if(!eligible(s))return [];const r=s.miracleWorker.ritual,q=currentMiracleWorkerSource(s),a:MiracleWorkerAction[]=[];
 const add=(label:string,c:MiracleWorkerRitualCommand,cost='实际场内时间G')=>{const reason=blockMiracleWorkerRitual(s,c);a.push({id:`mw2-ritual-${a.length}-${c.type}`,label,cost,command:c,enabled:reason===null,reason});};
 if(r.location==='RECEPTION'){
  for(const t of ['WORK','REST','NEXT_WEEK'] as const)add(t==='WORK'?'当代普通劳动':t==='REST'?'当代接待处置休养G':'真实推进下一周',{type:t},t==='WORK'?'1行动 +24便士':t==='REST'?'1行动 8便士':'24便士 · 七天');
  if(s.progression.sequence!==3)return a;if(!r.reviewed)add('先读不可逆回归与药窗风险',{type:'REVIEW_RETURN'},'0行动');
  if(r.sources.every(x=>x.restorationId!==null)){const pending=r.leads.find(x=>x.confirmedWeek===null);add(pending?'隔周实地核验当前新独立线索':'付费调查新的独立遗落线索',{type:pending?'VERIFY_NEW_LEAD':'REQUEST_NEW_LEAD'},'1行动 48便士 · 必须跨真实周');}
  for(const x of r.sources.filter(x=>!x.restorationId)){
   if(x.investigations.length<2)add(`调查${x.name}的${x.investigations.length?'外锚目录':'原外档'}`,{type:'INVESTIGATE_SOURCE',sourceId:x.id,step:x.investigations.length?'ANCHOR':'ARCHIVE'},'1行动 24便士');
   else if(x.kitWeek===null)add(`领取${x.name}本次原工具与原灯`,{type:'PREPARE_RETURN_KIT',sourceId:x.id},'1行动 168便士');
   else if(x.registeredWeek===null)for(const b of s.miracleWorker.bottles.filter(b=>b.status==='PREPARED'))add(`把${b.id}登记给${x.name}`,{type:'REGISTER_RETURN_PLAN',sourceId:x.id,bottleId:b.id},'96便士');
   else add(`本人去${x.name}原外锚`,{type:'TRAVEL_TO_GATE',sourceId:x.id},'1行动 24便士 · 80米实际步行');
  }return a;
 }
 add('沿原普通路段退出并放弃尚开药窗',{type:'LEAVE_RITUAL'},'0周行动 · 实际路程 · 保留原后果');
 if(!q)return a;
 if(!q.surveyed)add('检查同一原断锚',{type:'SURVEY_GATE'});
 else if(!q.contacted)add('接触当代真实门房和保管员',{type:'CONTACT_SETTLEMENT'});
 else if(!q.repairOutcome)add('用本包原销检定维修',{type:'REPAIR_ANCHOR'});
 else if(!q.repairDone)add('耗原备用销普通返工',{type:'REWORK_ANCHOR'});
 else if(!q.gateOpen)add('确认与内门房打开永久真实通道',{type:'OPEN_PASSAGE',confirmed:true});
 else {
  for(const [from,to] of ROUTES){if(from===r.location&&to!=='RECEPTION')add(`本人走到${to}`,{type:'MOVE',destination:to});if(to===r.location&&from!=='RECEPTION')add(`本人走到${from}`,{type:'MOVE',destination:from});}
  if(!q.verifiedIds.length)add('在原记录室交叉核验代际与现住原人',{type:'VERIFY_GENERATIONS'});
  else if(!q.invited)add('当面邀请两位自愿代表，保留第三人拒绝',{type:'INVITE_REPRESENTATIVES'});
  else if(q.exchangeStep<7)add(`见证原人原物下一步往返 ${q.exchangeStep}/7`,{type:'OBSERVE_EXCHANGE'});
  if(q.window==='OPEN')add('自愿等待到本次药窗过期',{type:'WAIT_WINDOW'},'601秒G · 不可重开');
 }return a;
}
export function projectMiracleWorkerRitual(s:SliceState):MiracleWorkerRitualProjection{const r=s.miracleWorker.ritual;return {location:r.location,insideCase:hasMiracleWorkerRitualLock(s),currentSourceId:r.currentSourceId,elapsedSeconds:r.elapsedSeconds,summary:`本人同一原身体在${r.location}；已回归${r.sources.filter(x=>x.restorationId).length}/${r.sources.length}个独立来源。`,boundary:'各固定有限G隔绝空间使真实共同体脱离现实联系；内部代际老去死亡，当前是1651现生成年人。不是交通不便/历史影像。现有来源用尽可实际付费委托、跨周核新独立旧址，仍须新原料与真实回归；旧村永不重置。',routes:ROUTES.map(([a,b,m])=>`${a} ↔ ${b}：${m}米原普通路段`),journeys:r.journeys.map(j=>`${j.bodyId} ${j.from}→${j.to} ${j.metres}米，累计${j.second}秒`),ordinaryLife:`实际劳动${r.work.works}次、休养${r.work.rests}次、七天推进${r.work.weeks}次；沿用本机构G处置休养，原伤历史保留。`,sources:r.sources.map(q=>({id:q.id,name:q.name,facts:[...(r.sources.indexOf(q)>=3?[sourceDef(r.sources.indexOf(q)).origin!]:[]),`遗落${formatGameDate(q.lostDate)}，当前${formatGameDate(s.date)}。两外档调查${q.investigations.join('/')}；核验引用${q.verifiedIds.join('、')||'未核'}。`,`唯一12米固定门${q.gateOpen?'持续可通':'尚不可通'}，原销实耗${q.spentPins}/4；现场付款${q.paidPennies}便士。`,`回归事件${q.restorationId??'尚未发生'}；原瓶${q.bottleId??'未登记'}；药窗${q.window}，剩${q.window==='OPEN'?Math.max(0,(q.deadline??0)-r.elapsedSeconds):0}秒G。`],residents:q.residents.map(x=>`${x.id} ${x.name} 生于${formatGameDate(x.birthDate)}，原体${x.bodyId}在${x.place}，${x.consent}`),originals:q.originals.map(x=>`${x.id}同一原件：${x.holder} / ${x.place}`),history:q.history.map(h=>`${h.second}s ${h.step}：${h.facts}`)}))};}
export function validateMiracleWorkerRitualState(s:SliceState):boolean{try{
 const r=s.miracleWorker.ritual,f=createMiracleWorkerRitualState();if(!obj(r)||!keys(r,Object.keys(f))||typeof r.reviewed!=='boolean'||!int(r.elapsedSeconds)||!['RECEPTION','GATE_OUT','GATE_IN','COURTYARD','ARCHIVE'].includes(r.location)||!Array.isArray(r.sources)||r.sources.length<3||!Array.isArray(r.leads)||r.sources.length!==3+r.leads.filter(x=>x.confirmedWeek!==null).length||!Array.isArray(r.journeys))return false;
 if(r.currentSourceId===null?r.location!=='RECEPTION':r.location==='RECEPTION'||!r.sources.some(x=>x.id===r.currentSourceId))return false;
 for(const [i,l]of r.leads.entries()){if(!obj(l)||!keys(l,['id','sourceId','requestedWeek','confirmedWeek','paidPennies'])||l.id!==`MW2-LEAD-REQUEST-${i+4}`||l.sourceId!==`MW2-LEAD-${i+4}`||!int(l.requestedWeek,1,s.week)||l.confirmedWeek!==null&&!int(l.confirmedWeek,l.requestedWeek+1,s.week)||l.paidPennies!==(l.confirmedWeek===null?48:96)||l.confirmedWeek===null&&i!==r.leads.length-1)return false;}
 if(r.leads.filter(x=>x.confirmedWeek===null).length>1)return false;
 for(const [i,q]of r.sources.entries()){
  const b=freshSource(sourceDef(i));if(!obj(q)||!keys(q,Object.keys(b))||q.id!==b.id||q.name!==b.name||!eq(q.lostDate,b.lostDate)||!Array.isArray(q.investigations)||!eq(q.investigations,['ARCHIVE','ANCHOR'].slice(0,q.investigations.length))||q.investigations.length>2)return false;
  if(![q.discoveredWeek,q.kitWeek,q.registeredWeek,q.tripStartedWeek].every(x=>x===null||int(x,1,s.week))||!int(q.exchangeStep,0,7)||!int(q.spentPins,0,4)||!int(q.paidPennies)||!Array.isArray(q.history)||!Array.isArray(q.verifiedIds))return false;
  if((q.discoveredWeek!==null)!==(q.investigations.length>0)||q.kitWeek!==null&&q.investigations.length!==2||q.registeredWeek!==null&&(q.kitWeek===null||!s.miracleWorker.bottles.some(x=>x.id===q.bottleId))||q.tripStartedWeek!==null&&q.registeredWeek===null)return false;
  if(![q.surveyed,q.contacted,q.repairDone,q.gateOpen,q.invited].every(x=>typeof x==='boolean')||q.contacted&&!q.surveyed||q.surveyed&&q.tripStartedWeek===null||q.repairOutcome!==null&&!['SUCCESS','GREAT_SUCCESS','FAILURE','GREAT_FAILURE'].includes(q.repairOutcome)||q.repairDone&&q.repairOutcome===null||q.gateOpen&&!q.repairDone||q.verifiedIds.length&&(!q.gateOpen||q.verifiedIds.length!==12)||q.invited&&!q.verifiedIds.length||q.exchangeStep>0&&!q.invited)return false;
  if(q.restorationId!==null?q.restorationId!==`${s.runId}:${q.id}:RETURN`||q.exchangeStep!==7||!int(q.restoredAt,1,r.elapsedSeconds)||q.deadline!==q.restoredAt+600||!['OPEN','CONSUMED','EXPIRED','DECLINED'].includes(q.window):q.restoredAt!==null||q.deadline!==null||q.window!=='NONE'||q.exchangeStep===7)return false;
  if(q.window==='OPEN'&&r.elapsedSeconds>(q.deadline??0)||q.window==='CONSUMED'&&!s.miracleWorker.bottles.some(x=>x.restorationId===q.restorationId&&x.status==='CONSUMED'))return false;
  const expected=freshSource(sourceDef(i));if(q.kitWeek!==null){expected.originals[3]!.holder='PLAYER';expected.originals[3]!.place=q.tripStartedWeek!==null?(r.currentSourceId===q.id?r.location:'RECEPTION'):'RECEPTION';}
  if(q.invited)expected.residents.forEach((x,j)=>x.consent=j===1||j===2?'ROUND_TRIP':j===3?'REFUSED':'STAY');
  const times=q.history.filter(x=>x.step.startsWith('OBSERVE_EXCHANGE:'));if(times.length!==q.exchangeStep)return false;
  for(let j=1;j<=q.exchangeStep;j++){if(times[j-1]!.step!==`OBSERVE_EXCHANGE:${j}`)return false;exchange(expected,j,times[j-1]!.second);}
  if(q.exchangeStep===7)expected.residents[5]!.place='GATE_OUT';
  if(!eq(expected.residents,q.residents)||!eq(expected.originals,q.originals))return false;
  let time=-1;for(const h of q.history){if(!obj(h)||!keys(h,['step','second','date','facts'])||typeof h.step!=='string'||typeof h.facts!=='string'||!int(h.second,time,r.elapsedSeconds)||!isValidGameDate(h.date))return false;time=h.second;}
  if(q.paidPennies!==24*q.investigations.length+(q.kitWeek===null?0:168)+(q.registeredWeek===null?0:96)+q.history.filter(h=>h.step==='TRAVEL_TO_GATE').length*24)return false;
 }
 for(const j of r.journeys)if(!obj(j)||!keys(j,['bodyId','sourceId','from','to','metres','second'])||typeof j.bodyId!=='string'||!r.sources.some(x=>x.id===j.sourceId)||!int(j.metres,1,80)||!int(j.second,1,r.elapsedSeconds))return false;
 if(!obj(r.work)||!keys(r.work,Object.keys(f.work))||![r.work.works,r.work.rests,r.work.weeks,r.work.income,r.work.expenses].every(x=>int(x))||typeof r.work.emergencyUsed!=='boolean'||r.work.income!==r.work.works*24||r.work.expenses!==r.work.rests*8+r.work.weeks*24)return false;
 if(!s.miracleWorker.formulaKnown&&r.reviewed||s.ancientScholar.promotionWeek===null&&!eq(r,f))return false;return true;
}catch{return false;}}
