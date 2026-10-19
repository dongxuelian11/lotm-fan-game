import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { BlackEmperorState, BlackEmperorCommand, BlackEmperorProjection, BlackEmperorPlaceId } from './types.js';
import { createBlackEmperorState,startBlackEmperor,sameBlackEmperor,blackEmperorDigest,validateBlackEmperorCommand,openBlackEmperorOwnedEngine,snapshotBlackEmperorOwnedEngine,advanceBlackEmperorOwnedEngine,blockBlackEmperorOwnedEngine,getBlackEmperorPromotionStabilityPreview,blackEmperorInsideCase,blackEmperorHost,blackEmperorConstructionPersonalCost,blackEmperorConsumeBlock,type BlackEmperorOwnedEngine } from './engine.js';
import { blackEmperorBudget,blackEmperorHistoryDigest,blackEmperorAcquisitionSnapshot,blackEmperorSourceBlock } from './source.js';
import { BLACK_EMPEROR_ABILITIES,BLACK_EMPEROR_STORY,BLACK_EMPEROR_GOAL,BLACK_EMPEROR_RISK,BLACK_EMPEROR_PLACES,BLACK_EMPEROR_PRACTICE_COSTS,BLACK_EMPEROR_GUIDANCE } from './content.js';
import { PRINCE_OF_ABOLITION_ABILITIES,PRINCE_OF_ABOLITION_INHERITED_ABILITIES } from '../prince-of-abolition/content.js';
import { blackEmperorSceneActions,desiredBlackEmperorSceneCommand,blackEmperorCurrentFestival,blackEmperorAllTombs,blackEmperorRemainingConstructionWeeks } from './scene.js';
import { blackEmperorMaterialActions,projectBlackEmperorMaterials,BLACK_EMPEROR_HOME,BLACK_EMPEROR_RECOVERY,BLACK_EMPEROR_VAULT,BLACK_EMPEROR_WORKSHOP,blackEmperorOriginalRemainingPrice } from './materials.js';
export { createBlackEmperorState,validateBlackEmperorCommand,getBlackEmperorPromotionStabilityPreview } from './engine.js';
export { blackEmperorSourceView, blackEmperorSourceView as getBlackEmperorSourceView } from './source.js';
export type { BlackEmperorOwnedEngine } from './engine.js';
export type { BlackEmperorState,BlackEmperorCommand,BlackEmperorProjection } from './types.js';
const clone=<T>(value:T):T=>structuredClone(value);
function assertCurrent(s:SliceState,root:BlackEmperorState):void {
 const source=root.source,f=root.frame;
 if(!source||!f||s.progression.pathwayId!=='black-emperor'||!sameBlackEmperor(blackEmperorBudget(s),f.budget)||!sameBlackEmperor(s.random,f.random)||s.revision!==source.revision+1+root.journal.length)throw Error('当前身体、资源与实际行动次序不一致。');
 const {coreStats:_current,...identity}=s.character,{coreStats:_source,...originalIdentity}=source.character;
 if(!sameBlackEmperor(identity,originalIdentity)||Object.entries(f.finance).some(([key,value])=>!sameBlackEmperor(s[key as keyof SliceState],value)))throw Error('当前身份或实际生活账本不一致。');
 if(source.historyDigest!==blackEmperorHistoryDigest(s)||source.originalWorldDigest!==blackEmperorDigest(s.world)||s.combatHistory.length!==source.combatHistoryLength||source.combatHistoryDigest!==blackEmperorDigest(s.combatHistory)||!sameBlackEmperor(source.acquisition,blackEmperorAcquisitionSnapshot(s)))throw Error('旧人物、原物或原瓶履历被改写。');
 if(s.combat!==null||s.activeEvent!==null||s.eventQueue.length||s.pulse!=='NONE'||((f.budget.sequence===0)!==(root.promotionWeek!==null)))throw Error('当前现场或晋升与实际记录不一致。');
}
function guidanceBlock(s:SliceState):string|null {
 if(!sameBlackEmperor(s.blackEmperor,createBlackEmperorState()))return '已有本章记录，不能重新开始或补发原物。';
 const reason=blackEmperorSourceBlock(s);if(reason)return reason;
 return s.actionsRemaining<1||s.cash<BLACK_EMPEROR_GUIDANCE.cash?'指导需要1行动与20便士，可以先正常工作与休养。':null;
}
function publicReason(reason:string|null):string|null{return reason===null?null:/[\u3400-\u9fff]/.test(reason)&&!/[A-Z_]{6,}|seed|cursor|digest|receipt/i.test(reason)?reason:'当前原件、实际所在地或前一步条件尚未满足。';}
export function validateBlackEmperorState(s:SliceState):boolean {
 try {if(sameBlackEmperor(s.blackEmperor,createBlackEmperorState()))return s.progression.pathwayId!=='black-emperor'||s.progression.sequence!==0;const head=openBlackEmperorOwnedEngine(s);assertCurrent(s,snapshotBlackEmperorOwnedEngine(head));return true;}catch{return false;}
}
/** Historical membership authenticates the entire new journal, never a
 * source-shaped object. The owned runtime caches this only after strict open. */
export function hasBlackEmperorHistory(s:SliceState):boolean{return !!s.blackEmperor?.guidanceKnown&&s.blackEmperor.source!==null&&s.progression.pathwayId==='black-emperor'&&validateBlackEmperorState(s);}
export const isBlackEmperor=(s:SliceState):boolean=>s.progression.pathwayId==='black-emperor'&&s.progression.sequence===0;
export function hasBlackEmperorLock(s:SliceState):boolean{return hasBlackEmperorHistory(s);}
export function openBlackEmperorOwnedHead(s:SliceState):BlackEmperorOwnedEngine{const h=openBlackEmperorOwnedEngine(s);assertCurrent(s,snapshotBlackEmperorOwnedEngine(h));return h;}
export function assertOwnedBlackEmperorCurrent(s:SliceState,head:BlackEmperorOwnedEngine):void{const root=snapshotBlackEmperorOwnedEngine(head);if(!sameBlackEmperor(root,s.blackEmperor))throw Error('当前会话与实际存档版本不一致。');assertCurrent(s,root);}
export function blackEmperorCommandBlock(s:SliceState,c:BlackEmperorCommand):string|null {
 if(!validateBlackEmperorCommand(c))return '这项行动内容无效。';if(s.status!=='ACTIVE')return '已经死亡或结束的角色不能继续行动。';if(c.type==='LEARN_GUIDANCE')return guidanceBlock(s);
 try{return publicReason(blockBlackEmperorOwnedEngine(openBlackEmperorOwnedHead(s),c,s.revision+1));}catch{return '当前记录未通过核验，不能继续行动。';}
}
export function ownedBlackEmperorCommandBlock(s:SliceState,c:BlackEmperorCommand,head:BlackEmperorOwnedEngine):string|null {
 if(!validateBlackEmperorCommand(c)||c.type==='LEARN_GUIDANCE')return '这项行动无效或已经听取指导。';if(s.status!=='ACTIVE')return '已经死亡或结束的角色不能继续行动。';
 try{assertOwnedBlackEmperorCurrent(s,head);return publicReason(blockBlackEmperorOwnedEngine(head,c,s.revision+1));}catch{return '当前记录未通过核验，不能继续行动。';}
}
function publish(s:SliceState,c:BlackEmperorCommand,root:BlackEmperorState,ctx:SeerContext):void {
 const b=root.frame!.budget;s.blackEmperor=clone(root);s.week=b.week;s.date=clone(b.date);s.actionsRemaining=b.actions;s.cash=b.cash;s.health=b.health;s.mind=b.mind;s.spirituality=b.spirituality;s.status=b.status;s.injuries=clone(b.injuries);s.injuryRisk=b.injuryRisk;s.progression.sequence=b.sequence;s.progression.acting=b.acting;s.progression.mastery={...b.mastery};s.character.coreStats={...b.coreStats};s.seer.pollution=b.pollution;s.seer.completedSources=[...b.completedSources];s.random={...root.frame!.random};Object.assign(s,clone(root.frame!.finance));
 const event=c.type==='LEARN_GUIDANCE'?null:root.journal.at(-1)!;s.lastCheck=event?.randomReceipts.length?clone(event.randomReceipts.at(-1)!.check):null;
 if(!event)ctx.note('听取国度与黑皇帝指导','实付1行动与20便士，核对本人、三份原特性和原演练房真实终点。原包球纸、旧赠物、投降者与双方旧伤保留；从真实当前位置继续生活与行动。三城任务、真实主权、复杂反常秩序、人民秘密建起九座金字塔陵寝和多城多数居民祭祀，均须实际完成。');
 else{for(const receipt of event.financeReceipts)ctx.note(receipt.title,receipt.text);ctx.note(b.sequence===0?'黑皇帝的有限实际行动':'国度与三份原件的真实筹备',event.notes.join(''));}
}
export function applyBlackEmperorCommand(s:SliceState,c:BlackEmperorCommand,ctx:SeerContext):void {
 if(!validateBlackEmperorCommand(c)||s.status!=='ACTIVE')throw Error('当前不能执行这项行动。');let root:BlackEmperorState;
 if(c.type==='LEARN_GUIDANCE'){const reason=guidanceBlock(s);if(reason)throw Error(reason);root=startBlackEmperor(s);}else root=snapshotBlackEmperorOwnedEngine(advanceBlackEmperorOwnedEngine(openBlackEmperorOwnedHead(s),c,s.revision+1));publish(s,c,root,ctx);
}
export function applyOwnedBlackEmperorCommand(s:SliceState,c:BlackEmperorCommand,ctx:SeerContext,head:BlackEmperorOwnedEngine):BlackEmperorOwnedEngine {
 assertOwnedBlackEmperorCurrent(s,head);if(!validateBlackEmperorCommand(c)||c.type==='LEARN_GUIDANCE'||s.status!=='ACTIVE')throw Error('当前不能执行这项行动。');const next=advanceBlackEmperorOwnedEngine(head,c,s.revision+1);publish(s,c,snapshotBlackEmperorOwnedEngine(next),ctx);return next;
}
export function projectBlackEmperor(s:SliceState):BlackEmperorProjection{return projection(s,sameBlackEmperor(s.blackEmperor,createBlackEmperorState())?null:openBlackEmperorOwnedHead(s));}
export function projectOwnedBlackEmperor(s:SliceState,h:BlackEmperorOwnedEngine):BlackEmperorProjection{assertOwnedBlackEmperorCurrent(s,h);return projection(s,h);}
/** Recommendations only select an enabled ordinary command. No prediction or
 * grant of money, materials, workers, construction time or ritual participation. */
export function desiredBlackEmperorCommand(root:BlackEmperorState):BlackEmperorCommand|null {
 const f=root.frame!,b=f.budget,scene=root.scene!,m=root.materials!,festival=blackEmperorCurrentFestival(scene),dose=m.compounds.find(p=>p.status==='PREPARED');
 const paid=dose?getBlackEmperorPromotionStabilityPreview(root,dose.id).prepared:false;
 const earn=():BlackEmperorCommand=>b.actions>0&&f.finance.wagePaidWeek!==b.week?{type:'WORK'}:{type:'NEXT_WEEK'};
 const at=(to:BlackEmperorPlaceId,c:BlackEmperorCommand,actions=1):BlackEmperorCommand=>f.location===to?(b.actions<actions?earn():c):to===BLACK_EMPEROR_HOME?{type:'RETURN_ON_FOOT'}:b.actions<actions+1?earn():{type:'TRAVEL',to};
 const sceneNext=()=>desiredBlackEmperorSceneCommand(scene,blackEmperorHost(root,'preview',root.source!.revision+2+root.journal.length));
 if(b.status!=='ACTIVE'||scene.returnReportEventId)return null;
 // A prepared bottle gets its real, paid opportunity before generic recovery.
 if(dose&&paid&&blackEmperorConsumeBlock(root,dose.id)===null)return{type:'CONSUME',compoundId:dose.id,confirmed:true};
 if(scene.playerPosition==='MAUSOLEUM')return{type:'LEAVE_MAUSOLEUM'};
 if(scene.playerPosition==='ORIGINAL_ENTRY')return{type:'LEAVE_ORIGINAL_COURT'};
 if(blackEmperorInsideCase(root))return sceneNext();
 if(b.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null))return b.actions<1?{type:'NEXT_WEEK'}:b.cash>=60?{type:'CLINIC'}:earn();
 const healthNeeded=b.sequence===0?60:80,mindNeeded=b.sequence===0?30:paid?70:78,spiritNeeded=b.sequence===0?24:paid?30:42;
 if(b.health<healthNeeded||b.mind<mindNeeded||b.spirituality<spiritNeeded||b.injuries.length||b.pollution>0){if(b.actions>0&&b.cash<200&&f.finance.wagePaidWeek!==b.week)return{type:'WORK'};return b.actions?{type:'REST'}:{type:'NEXT_WEEK'};}
 if(b.sequence===0){if(f.location!==BLACK_EMPEROR_HOME)return{type:'RETURN_ON_FOOT'};if(scene.phase==='REALM'&&b.actions<3)return earn();const next=sceneNext();if(next?.type==='BUY_TOOLS'&&b.cash<30||next?.type==='ASK_WORKERS'&&b.cash<20)return earn();return next;}
 const failed=m.compounds.find(p=>p.status==='FAILED_EXPOSED'||p.status==='FAILED_SEALED');
 if(failed){if(failed.status==='FAILED_SEALED'&&(b.week<=failed.sealedWeek!||f.nowSecond<failed.sealedSecond!+604800))return earn();if(failed.status==='FAILED_SEALED'&&b.cash<60)return earn();return at(failed.location,{type:failed.status==='FAILED_EXPOSED'?'SEAL_REMAINS':'RECOVER_REMAINS',compoundId:failed.id});}
 if(!scene.exit.inspectedEventId)return at(BLACK_EMPEROR_HOME,{type:'INSPECT_EXIT'},0);
 const task=scene.realm.cities.find(c=>!c.taskEventId);if(task)return b.cash<20?earn():at(BLACK_EMPEROR_HOME,{type:'SOLVE_CITY_TASK',cityId:task.id});
 if(!scene.realm.charterEventId)return b.cash<30?earn():at(BLACK_EMPEROR_HOME,{type:'FOUND_REALM'});
 const orders=scene.realm.cities.find(c=>c.orderEvents.length!==6);if(orders)return at(BLACK_EMPEROR_HOME,{type:'IMPLEMENT_ORDERS',cityId:orders.id});
 const construction=():BlackEmperorCommand|null=>{const broken=blackEmperorAllTombs(scene).find(t=>t.integrity<100);if(broken)return at(BLACK_EMPEROR_HOME,{type:'REPAIR_TOMB',tombId:broken.id});const c=scene.realm.cities.find(x=>x.tombs.some(t=>t.stage<3));if(!c)return null;return b.cash<blackEmperorConstructionPersonalCost(root)?earn():at(BLACK_EMPEROR_HOME,{type:'NEXT_CONSTRUCTION',cityId:c.id});};
 const original=m.originals.find(x=>!['EMBODIED','FUSED','COMPOUND','PLAYER'].includes(x.holder));
 if(original){
  if(original.holder==='SUPPLIER'&&original.labourSteps<5)return at(BLACK_EMPEROR_RECOVERY,{type:'WORK_ORIGINAL',originalId:original.originalId});
  if(original.holder==='SEALED_REMNANT'&&(b.week<=original.sealedWeek!||f.nowSecond<original.sealedSecond!+604800)){
   if(b.actions>0&&f.finance.wagePaidWeek!==b.week)return{type:'WORK'};
   // Paid construction is useful real elapsed time during a sealed wait.
   return b.actions>0&&b.cash>=blackEmperorConstructionPersonalCost(root)?construction()??earn():earn();
  }
  const sourceBottle=root.source!.acquisition.bottles.find(x=>x.id===original.latestBottleId);
  const cash=original.holder==='SUPPLIER'?blackEmperorOriginalRemainingPrice(original.labourSteps,sourceBottle):original.holder==='UNLOCATED_REMNANT'?120:original.holder==='SEALED_REMNANT'?30:0;
  if(b.cash<cash)return earn();const type=original.permissionWeek!==b.week?'ASK_RECOVERY_PERMISSION':original.holder==='UNLOCATED_REMNANT'?'INVESTIGATE_REMAINS':original.holder==='LOCATED'?'SEAL_ORIGINAL':'RECOVER_ORIGINAL';
  return at(BLACK_EMPEROR_RECOVERY,{type,originalId:original.originalId},type==='ASK_RECOVERY_PERMISSION'||original.holder==='SUPPLIER'?0:1);
 }
 if(m.uniqueness.holder==='CUSTODIAN'){if(b.cash<(m.uniqueness.verifiedEventId?150:100))return earn();return at(BLACK_EMPEROR_VAULT,{type:m.uniqueness.verifiedEventId?'ACQUIRE_UNIQUENESS':'VERIFY_UNIQUENESS'});}
 if(!dose){if(m.carriers.some(x=>x.status==='PLAYER'))return b.cash<40?earn():at(BLACK_EMPEROR_WORKSHOP,{type:'COMPOSE'});if(m.carriers.some(x=>x.status==='SUPPLIER'))return b.cash<50?earn():at(BLACK_EMPEROR_WORKSHOP,{type:'BUY_CARRIER'},0);return null;}
 const build=construction();if(build)return build;
 if(f.location!==BLACK_EMPEROR_HOME)return{type:'RETURN_ON_FOOT'};
 if(b.week-root.source!.acquisition.promotionWeek<12)return earn();
 if(!festival||festival.consumedEventId||festival.heldEventId&&festival.opportunityWeek!==b.week){if(b.cash<180||b.actions<3)return earn();return{type:'PREPARE_FESTIVAL'};}
 if(!paid){if(festival.heldEventId)return earn();if(b.cash<150||b.actions<2)return earn();return{type:'STABILIZE_PROMOTION',compoundId:dose.id};}
 if(!festival.heldEventId)return{type:'HOLD_FESTIVAL'};
 return{type:'ENTER_MAUSOLEUM',tombId:blackEmperorAllTombs(scene)[0]!.id};
}
const positionName=(p:string)=>({ORIGINAL_ENTRY:'原演练房门口',OUTSIDE:'普通室外',MAUSOLEUM:'实际陵寝内室',FACILITY:'市政绞盘旁'}[p]??'实际所在地');
function projection(s:SliceState,head:BlackEmperorOwnedEngine|null):BlackEmperorProjection {
 const root=head?snapshotBlackEmperorOwnedEngine(head):s.blackEmperor,f=root.frame,b=f?.budget??blackEmperorBudget(s),promoted=s.progression.pathwayId==='black-emperor'&&b.sequence===0&&root.promotionWeek!==null;
 const definitions=s.progression.pathwayId==='black-emperor'?[...PRINCE_OF_ABOLITION_INHERITED_ABILITIES,...PRINCE_OF_ABOLITION_ABILITIES,...(promoted?BLACK_EMPEROR_ABILITIES:[])]:[];
 const result:BlackEmperorProjection={title:'序列0 黑皇帝',guidanceKnown:root.guidanceKnown,promoted,story:BLACK_EMPEROR_STORY,nextStep:BLACK_EMPEROR_GOAL,risk:BLACK_EMPEROR_RISK,resources:{health:b.health,maxHealth:100,mind:b.mind,maxMind:100,spirituality:b.spirituality,maxSpirituality:promoted?150:120,cash:`${b.cash}便士`,actionsRemaining:b.actions,weeklyBudget:f?.finance.weeklyBudget??s.weeklyBudget},injuries:b.injuries.map(x=>({id:x.id,severity:x.severity,treated:x.treatedRevision!==null})),injuryRisk:b.injuryRisk,abilities:definitions.filter(x=>Object.hasOwn(b.mastery,x.id)).map(x=>({id:x.id,label:x.label,description:x.description,mastery:b.mastery[x.id]??0})),actions:[],sections:[],insideCase:blackEmperorInsideCase(root)};
 const add=(command:BlackEmperorCommand,label:string,cost:string)=>{const reason=publicReason(head?blockBlackEmperorOwnedEngine(head,command,s.revision+1):blackEmperorCommandBlock(s,command));result.actions.push({id:`black-emperor:${result.actions.length}:${command.type}`,label,cost,command:clone(command),enabled:reason===null,reason});};
 if(!root.guidanceKnown){add({type:'LEARN_GUIDANCE'},'听取国度、九陵与三份原件指导','1行动、20便士');if(result.actions[0]!.enabled)result.actions[0]!.preferredAction=true;return result;}
 const scene=root.scene!,festival=blackEmperorCurrentFestival(scene),tombs=blackEmperorAllTombs(scene),remaining=blackEmperorRemainingConstructionWeeks(scene),place=BLACK_EMPEROR_PLACES.find(x=>x.id===f!.location)?.title??'实际所在地';
 const finished=tombs.filter(t=>t.stage===3&&t.integrity===100).length,population=scene.realm.cities.reduce((n,c)=>n+c.population,0),participants=festival?.participation.reduce((n,c)=>n+c.participants,0)??0;
 result.sections.push({id:'clock',title:'实际日期与所在地',lines:[`${place}；第${b.week}周，${b.date.year}年${b.date.month}月${b.date.day}日。本人在${positionName(scene.playerPosition)}，累计实际移动${scene.playerTravelMetres}米。`,`成为弑序亲王已有${b.week-root.source!.acquisition.promotionWeek}个真实周。距下一周界${Math.ceil((f!.weekAnchor+604800-f!.nowSecond)/3600)}小时。`]});
 result.sections.push({id:'realm-overview',title:'本人国度与九陵总览',lines:[scene.realm.charterEventId?`${scene.realm.ownerName}已由三城实际共同章程确立为皇帝，拥有这一个九万人国度；原市库已实转所有权。`:'三城目前各自自治；必须先解决真实问题、取得治理委托并实签共同章程，才有本人的国度。',`实际人口${population}人，三城固定登记，不因仪式增减。已经实际知道${s.character.name}姓名的居民${scene.realm.cities.reduce((n,c)=>n+c.knowNameCount,0)}人，认识其皇帝称号的居民${scene.realm.cities.reduce((n,c)=>n+c.knowEmperorCount,0)}人。`,`九座独立金字塔式陵寝：完好竣工${finished}/9；基础施工尚需${remaining}个真实周，修复与筹备另计。已实际施工${scene.constructionReceipts.reduce((n,x)=>n+x.weeks,0)}周。`,'每座陵寝由本城成年居民在不同封闭工地秘密施工，许可、参与工人、材料和工资逐陵记录；公共祭祀不公开九陵坐标。']});
 for(const c of scene.realm.cities)result.sections.push({id:`city-${c.id}`,title:`${c.name} · ${c.population}位实际居民`,lines:[`实际任务：${c.taskEventId?'已经完成':'尚待解决'}；治理委托${c.mandateEventId?'已取得':'未取得'}；主权${c.ownershipEventId?'已随共同章程转移':'仍属原共同体'}。`,`实际结果：供粮${c.task.deliveredFood}份、修路${c.task.roadMetres}米、执行裁决${c.task.settledClaims}项；受益居民${c.task.beneficiaries}人。`,`剩余${c.ownershipEventId?'国库':'市库'}${c.stocks.cash}便士、石料${c.stocks.stone}、木料${c.stocks.timber}、供物${c.stocks.food}份、可付劳动${c.stocks.labourDays}工日；原有成年建设劳力${c.adultWorkers}人。`,`已实施反常秩序${c.orderEvents.length}/6条；姓名与皇帝认知${c.knowNameCount}/${c.knowEmperorCount}人。该城基础施工尚需${(3-Math.min(...c.tombs.map(t=>t.stage)))*3}周。`,...c.tombs.map(t=>`${t.title}：金字塔式，${['尚未开工','基础已完工','主体已完工','封闭墓室与外壳已竣工'][t.stage]}（${t.stage}/3），完整度${t.integrity}；本城工人${t.workers}人，实际${t.labourDaysSpent}工日，已用石料${t.stoneSpent}、木料${t.timberSpent}、工资${t.wagesPaid}便士。${t.confidentialPermitEventId?'已实记有限许可及封闭施工':'尚未开启封闭工地'}。`)]});
 result.sections.push({id:'realm-orders',title:'三组实际实施的复杂反常秩序',lines:scene.realm.cities.flatMap(c=>[`${c.name}：六条明确秩序${c.orderEvents.length===6?'均已建造、传播并执行':'尚未全部实施'}。`,...(c.orderEvents.length?c.orderEvents.map(x=>`${x.clause}；实际本区参与${x.participants}人，工资${x.wages}便士、石木各${x.stone}。`):['须实际建起门廊、街口或桥口设施，并逐区执行六条相互关联的规则。'])])});
 result.sections.push({id:'realm-festival',title:'多城真实祭祀与本人陵内位置',lines:[`已筹备${scene.festivals.length}场独立祭祀；当前实际参加${participants}/${population}人，${festival?.heldEventId?'已有本次真实举行记录':'尚无本次实际祭祀'}。`,...(festival?.participation.map(x=>`${scene.realm.cities.find(c=>c.id===x.cityId)!.name}实际参与${x.participants}/${x.population}人，${x.participants>x.population/2?'超过本城半数':'尚不足本城多数'}；共同宣告${x.actualName}为皇帝。`)??[]),festival?.heldEventId?`本次实际机会在第${festival.opportunityWeek}周；${festival.consumedEventId?'已经尝试服药，不能复用':festival.opportunityWeek===b.week?'仍在本周':'旧机会已结束，须另付物资筹备新祭祀'}。`:'筹备支出并不等于民众已经实际参加。',scene.enteredTombId?`本人已走入${tombs.find(t=>t.id===scene.enteredTombId)?.title??'实际陵寝'}内室；可随时沿普通墓道走出。`:'本人尚未处在陵寝内室，不能在议事所直接饮药。',...scene.festivals.filter(x=>x.id!==scene.activeFestivalId).map(x=>`第${x.preparedWeek}周筹备的旧祭祀：${x.heldEventId?'已真实举行':'曾备妥未举行'}，${x.consumedEventId?'已用于一次尝试':'未用于服药'}；原支出和参与记录继续保留。`)]});
 result.sections.push({id:'materials',title:'同一三份原特性与唯一性',lines:projectBlackEmperorMaterials(root.materials!,root.source!)});
 result.sections.push({id:'body',title:'同一本人、原人物与旧物',lines:[`${s.character.name}，${s.character.age}岁；健康${b.health}、精神${b.mind}、灵性${b.spirituality}/${promoted?150:120}、污染${b.pollution}；当前意志${b.coreStats.will}、知识${b.coreStats.knowledge}。`,`旧赠物${root.source!.originals.gifts.length}件的实际去向全部保留，不补发已经送出的原物。`,'米蕾与达里安仍在原演练房外；400克原封包、80克原软球及原纸仍由米蕾亲持，旧垫和真实伤势不复位。',`原演练房敌手${s.princeOfAbolition.encounter.enemyStatus==='SURRENDERED'?'已投降':s.princeOfAbolition.encounter.enemyStatus==='DEAD'?'已死亡':'保留原有状态'}；旧伤、用过的支撑片和所有旧掌握逐值保留。`]});
 if(promoted)result.sections.push({id:'finite-tools',title:'一个市政设施，两次有限应用',lines:[`原绞盘载荷${scene.facility.loadReleasedEventId?`已沿${scene.facility.currentPath==='SIDE'?'已有侧槽':'原主槽'}实际下放`:'仍在实际释放之前'}；反制导向闩${scene.facility.contestingLatch==='ENGAGED'?'仍啮合':scene.facility.contestingLatch==='BYPASSED'?'本次被绕过':'已机械锁死'}。`,`同一次冲击${scene.facility.impactResolvedEventId?'已实际落定':scene.facility.pendingImpact?`仍待落下，剩余${Math.max(0,scene.facility.impactDueSecond!-f!.nowSecond)}秒`:scene.facility.ordinaryStopEventId?'已普通锁止':'尚未启动'}；${scene.facility.delayApplied?'已尝试过一次延迟，不可叠加':'本次尚未尝试延迟'}。`,`有限路径扭曲当前成功率${computeCheckChance({baseAbility:b.coreStats.knowledge,difficulty:BLACK_EMPEROR_PRACTICE_COSTS.orderDistortion.difficulty,modifiers:[]})}%；一次冲击延迟${computeCheckChance({baseAbility:b.coreStats.will,difficulty:BLACK_EMPEROR_PRACTICE_COSTS.delayedImpact.difficulty,modifiers:[]})}%。`,...scene.workers.map(w=>`${w.name}，${w.age}岁，健康${w.health}，当前${w.position==='OUTSIDE'?'在室外':'在保护侧台'}；许可${w.consent==='GRANTED'?'仍有效，可随时撤回':w.consent==='UNASKED'?'尚未询问':'已撤回或结束'}。`),scene.returnReportEventId?'本轮已实际退出并报告；费用、结果和旧记录全部保留。':'普通绳索与外置停机杆始终可用，所有成年人均可普通退出。没有复活或全球秩序操控。']});
 result.sections.push({id:'finance',title:'个人与国库实际账目',lines:[`个人现款${b.cash}便士；原职业每周${root.source!.character.weeklyWage}便士，实付1行动工作才入账，当前周${f!.finance.wagePaidWeek===b.week?'已领一次':'尚未领取'}。`,`每周${f!.finance.weeklyBudget}行动；原债务剩余${f!.finance.debts.reduce((n,x)=>n+x.remaining,0)}便士。下一次三周施工须另备个人生活及还款${blackEmperorConstructionPersonalCost(root)}便士，施工不发工资、不免费治疗。`,'三城市库与个人现款分别核算；九陵、规则建筑与祭祀都使用有限的原市库、物资和工日，不把国库余额变成私人补贴。']});
 const latest=root.journal.at(-1);result.sections.push({id:'latest',title:'最近实际行动',lines:latest?[...latest.notes,...latest.financeReceipts.map(x=>x.text),...latest.randomReceipts.map(x=>`本次实际检定：成功率${x.check.chance}%，掷出${x.check.roll}，${x.check.tier==='SUCCESS'?'成功':x.check.tier==='GREAT_SUCCESS'?'大成功':x.check.tier==='FAILURE'?'失败':'严重失败'}。`),`个人现款变化${latest.after.budget.cash-latest.before.budget.cash}便士；行动变化${latest.after.budget.actions-latest.before.budget.actions}；实际经过${latest.after.budget.week-latest.before.budget.week}周。`]:['已实付1行动与20便士听取指导。']});
 for(const x of blackEmperorSceneActions(scene,blackEmperorHost(root,'preview',s.revision+1)))add(x.command,x.label,x.cost);
 for(const x of blackEmperorMaterialActions(root))add(x.command,x.label,x.cost);
 for(const p of mPrepared(root)){const preview=getBlackEmperorPromotionStabilityPreview(root,p.id);result.sections.push({id:'promotion-stability',title:'本瓶本次准备与实际风险',lines:[`当前实际意志${b.coreStats.will}，本瓶现时成功率${preview.chance}%；实付稳定准备后为${preview.preparedChance}%。`,preview.prepared?'本瓶实付准备当前有效；还须真实举行多城祭祀、本人步入完好陵寝。':'在新祭祀已付费筹备且尚未举行时，实付1行动、150便士、12灵性、8精神准备本瓶，并保留服药行动。',preview.reason??'当前可以为同一成药实际准备。']});add({type:'STABILIZE_PROMOTION',compoundId:p.id},'祭祀举行前实付准备同一瓶','1行动、150便士、12灵性、8精神、一小时；另留服药行动');add({type:'CONSUME',compoundId:p.id,confirmed:true},`独立确认在陵内饮用同一成药（${preview.chance}%）`,'1行动、30灵性；真实多城祭祀当周且本人在完好陵内，失败可能死亡');}
 for(const p of BLACK_EMPEROR_PLACES)if([BLACK_EMPEROR_HOME,BLACK_EMPEROR_RECOVERY,BLACK_EMPEROR_VAULT,BLACK_EMPEROR_WORKSHOP].includes(p.id)&&p.id!==f!.location)add({type:'TRAVEL',to:p.id},`沿普通道路前往${p.title}`,'1行动、半小时');
 add({type:'RETURN_ON_FOOT'},'沿普通道路返回议事所外','0行动、两小时');add({type:'WORK'},'实际完成本周原职业工作','1行动、八小时');add({type:'REST'},'按实际生活档休养','1行动、八小时');add({type:'CLINIC'},'普通处置当前重伤','1行动、60便士、一小时');add({type:'NEXT_WEEK'},'走到下一真实周界','照常结算生活与还款，不发工资');
 const wanted=desiredBlackEmperorCommand(root);let preferred=wanted?result.actions.find(a=>sameBlackEmperor(a.command,wanted)&&a.enabled):null;
 if(!preferred&&wanted&&!blackEmperorInsideCase(root)&&b.status==='ACTIVE'){if(b.actions>0&&f!.finance.wagePaidWeek!==b.week)preferred=result.actions.find(a=>a.command.type==='WORK'&&a.enabled);else preferred=result.actions.find(a=>a.command.type==='NEXT_WEEK'&&a.enabled);}
 if(preferred){preferred.preferredAction=true;result.nextStep=`下一步：${preferred.label}。${preferred.cost}。`;}
 if(scene.returnReportEventId){result.nextStep='本轮已真实退出并报告。三城国度、九座完好陵寝、实际晋升与全部费用和伤势保留。';result.story=`${s.character.name}已拥有同一九万人国度；人民建成九座金字塔式陵寝，完成多城多数祭祀，本人已实际晋升并结束一个有限市政设施现场。`;}
 if(b.status!=='ACTIVE')result.nextStep='本次周目已经死亡并封存，不能继续行动或重新取得材料。';
 return result;
}
const mPrepared=(root:BlackEmperorState)=>root.materials!.compounds.filter(x=>x.status==='PREPARED');
