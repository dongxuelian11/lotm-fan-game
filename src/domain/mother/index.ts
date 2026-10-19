import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { MotherState, MotherCommand, MotherProjection, MotherPlaceId } from './types.js';
import { createMotherState,startMother,sameMother,motherDigest,validateMotherCommand,openMotherOwnedEngine,snapshotMotherOwnedEngine,advanceMotherOwnedEngine,blockMotherOwnedEngine,getMotherPromotionStabilityPreview,motherInsideCase,motherHost,type MotherOwnedEngine } from './engine.js';
import { motherBudget,motherHistoryDigest,motherAcquisitionSnapshot,motherSourceBlock } from './source.js';
import { MOTHER_ABILITIES,MOTHER_STORY,MOTHER_GOAL,MOTHER_RISK,MOTHER_PLACES,MOTHER_PRACTICE_COSTS } from './content.js';
import { NATURE_WALKER_ABILITIES,NATURE_WALKER_INHERITED_ABILITIES } from '../nature-walker/content.js';
import { motherSceneActions,desiredMotherSceneCommand } from './scene.js';
import { motherMaterialActions,projectMotherMaterials,MOTHER_HOME,MOTHER_RECOVERY,MOTHER_VAULT,MOTHER_WORKSHOP,motherOriginalRemainingPrice } from './materials.js';
export { createMotherState,validateMotherCommand,getMotherPromotionStabilityPreview } from './engine.js';
export { motherSourceView, motherSourceView as getMotherSourceView } from './source.js';
export type { MotherOwnedEngine } from './engine.js';
export type { MotherState,MotherCommand,MotherProjection } from './types.js';
const clone=<T>(value:T):T=>structuredClone(value);
function assertCurrent(s:SliceState,root:MotherState):void {
 const source=root.source,f=root.frame;
 if(!source||!f||s.progression.pathwayId!=='mother'||!sameMother(motherBudget(s),f.budget)||!sameMother(s.random,f.random)||s.revision!==source.revision+1+root.journal.length)throw Error('当前身体、资源与实际行动次序不一致。');
 const {coreStats:_current,...identity}=s.character,{coreStats:_source,...originalIdentity}=source.character;
 if(!sameMother(identity,originalIdentity)||Object.entries(f.finance).some(([key,value])=>!sameMother(s[key as keyof SliceState],value)))throw Error('当前身份或实际生活账本不一致。');
 if(source.historyDigest!==motherHistoryDigest(s)||source.originalWorldDigest!==motherDigest(s.world)||s.combatHistory.length!==source.combatHistoryLength||source.combatHistoryDigest!==motherDigest(s.combatHistory)||!sameMother(source.acquisition,motherAcquisitionSnapshot(s)))throw Error('旧人物、原物或原瓶履历被改写。');
 if(s.combat!==null||s.activeEvent!==null||s.eventQueue.length||s.pulse!=='NONE'||((f.budget.sequence===0)!==(root.promotionWeek!==null)))throw Error('当前现场或晋升与实际记录不一致。');
}
function guidanceBlock(s:SliceState):string|null {
 if(!sameMother(s.mother,createMotherState()))return '已有本章记录，不能重新开始或补发原物。';
 const reason=motherSourceBlock(s);if(reason)return reason;
 return s.actionsRemaining<1||s.cash<100?'指导需要1行动与100便士，可以先正常工作与休养。':null;
}
function publicReason(reason:string|null):string|null{return reason===null?null:/[\u3400-\u9fff]/.test(reason)&&!/[A-Z_]{6,}|seed|cursor|digest|receipt/i.test(reason)?reason:'当前原件、实际所在地或前一步条件尚未满足。';}
export function validateMotherState(s:SliceState):boolean {
 try {if(sameMother(s.mother,createMotherState()))return s.progression.pathwayId!=='mother'||s.progression.sequence!==0;const head=openMotherOwnedEngine(s);assertCurrent(s,snapshotMotherOwnedEngine(head));return true;}catch{return false;}
}
/** Historical membership authenticates the entire new journal, never a
 * source-shaped object. The owned runtime caches this only after strict open. */
export function hasMotherHistory(s:SliceState):boolean{return !!s.mother?.guidanceKnown&&s.mother.source!==null&&s.progression.pathwayId==='mother'&&validateMotherState(s);}
export const isMother=(s:SliceState):boolean=>s.progression.pathwayId==='mother'&&s.progression.sequence===0;
export function hasMotherLock(s:SliceState):boolean{return hasMotherHistory(s);}
export function openMotherOwnedHead(s:SliceState):MotherOwnedEngine{const h=openMotherOwnedEngine(s);assertCurrent(s,snapshotMotherOwnedEngine(h));return h;}
export function assertOwnedMotherCurrent(s:SliceState,head:MotherOwnedEngine):void{const root=snapshotMotherOwnedEngine(head);if(!sameMother(root,s.mother))throw Error('当前会话与实际存档版本不一致。');assertCurrent(s,root);}
export function motherCommandBlock(s:SliceState,c:MotherCommand):string|null {
 if(!validateMotherCommand(c))return '这项行动内容无效。';if(s.status!=='ACTIVE')return '已经死亡或结束的角色不能继续行动。';if(c.type==='LEARN_GUIDANCE')return guidanceBlock(s);
 try{return publicReason(blockMotherOwnedEngine(openMotherOwnedHead(s),c,s.revision+1));}catch{return '当前记录未通过核验，不能继续行动。';}
}
export function ownedMotherCommandBlock(s:SliceState,c:MotherCommand,head:MotherOwnedEngine):string|null {
 if(!validateMotherCommand(c)||c.type==='LEARN_GUIDANCE')return '这项行动无效或已经听取指导。';if(s.status!=='ACTIVE')return '已经死亡或结束的角色不能继续行动。';
 try{assertOwnedMotherCurrent(s,head);return publicReason(blockMotherOwnedEngine(head,c,s.revision+1));}catch{return '当前记录未通过核验，不能继续行动。';}
}
function publish(s:SliceState,c:MotherCommand,root:MotherState,ctx:SeerContext):void {
 const b=root.frame!.budget;s.mother=clone(root);s.week=b.week;s.date=clone(b.date);s.actionsRemaining=b.actions;s.cash=b.cash;s.health=b.health;s.mind=b.mind;s.spirituality=b.spirituality;s.status=b.status;s.injuries=clone(b.injuries);s.injuryRisk=b.injuryRisk;s.progression.sequence=b.sequence;s.progression.acting=b.acting;s.progression.mastery={...b.mastery};s.character.coreStats={...b.coreStats};s.seer.pollution=b.pollution;s.seer.completedSources=[...b.completedSources];s.random={...root.frame!.random};Object.assign(s,clone(root.frame!.finance));
 const event=c.type==='LEARN_GUIDANCE'?null:root.journal.at(-1)!;s.lastCheck=event?.randomReceipts.length?clone(event.randomReceipts.at(-1)!.check):null;
 if(!event)ctx.note('听取温室与母亲指导','实付1行动与100便士，承接同一本人的原伤、实际17项掌握、两株原活苗、原枯样、原根垫与原三份特性。旧记录许可不等于本次作业同意；先按真实身体情况诊疗、休养与工作，再前往交接处。');
 else{for(const receipt of event.financeReceipts)ctx.note(receipt.title,receipt.text);ctx.note(b.sequence===0?'母亲的实际行动':'温室与原件交接',event.notes.join(''));}
}
export function applyMotherCommand(s:SliceState,c:MotherCommand,ctx:SeerContext):void {
 if(!validateMotherCommand(c)||s.status!=='ACTIVE')throw Error('当前不能执行这项行动。');let root:MotherState;
 if(c.type==='LEARN_GUIDANCE'){const reason=guidanceBlock(s);if(reason)throw Error(reason);root=startMother(s);}else root=snapshotMotherOwnedEngine(advanceMotherOwnedEngine(openMotherOwnedHead(s),c,s.revision+1));publish(s,c,root,ctx);
}
export function applyOwnedMotherCommand(s:SliceState,c:MotherCommand,ctx:SeerContext,head:MotherOwnedEngine):MotherOwnedEngine {
 assertOwnedMotherCurrent(s,head);if(!validateMotherCommand(c)||c.type==='LEARN_GUIDANCE'||s.status!=='ACTIVE')throw Error('当前不能执行这项行动。');const next=advanceMotherOwnedEngine(head,c,s.revision+1);publish(s,c,snapshotMotherOwnedEngine(next),ctx);return next;
}
export function projectMother(s:SliceState):MotherProjection{return projection(s,sameMother(s.mother,createMotherState())?null:openMotherOwnedHead(s));}
export function projectOwnedMother(s:SliceState,h:MotherOwnedEngine):MotherProjection{assertOwnedMotherCurrent(s,h);return projection(s,h);}
/** Forecast the destination action's cash and AP before spending travel.
 * Every recommendation is an ordinary executable command; no future-roll peek. */
export function desiredMotherCommand(root:MotherState):MotherCommand|null {
 const f=root.frame!,b=f.budget,scene=root.scene!,m=root.materials!;
 const earn=():MotherCommand=>b.actions>0&&f.finance.wagePaidWeek!==b.week?{type:'WORK'}:{type:'NEXT_WEEK'};
 const at=(to:MotherPlaceId,c:MotherCommand,actions=1,cash=0):MotherCommand=>{
  if(b.cash<cash)return earn();
  if(f.location===to)return b.actions<actions?earn():c;
  if(to===MOTHER_HOME)return {type:'RETURN_ON_FOOT'};
  return b.actions<actions+1?earn():{type:'TRAVEL',to};
 };
 if(b.status!=='ACTIVE'||scene.returnReportEventId)return null;
 if(scene.playerPosition==='ORIGINAL_ENTRY')return {type:'LEAVE_ORIGINAL_NURSERY'};
 if(motherInsideCase(root))return desiredMotherSceneCommand(scene,motherHost(root,'preview',root.source!.revision+2+root.journal.length));
 if(scene.status==='ABORTED')return at(MOTHER_HOME,{type:'REPORT_RETURN'},0);
 if(b.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null))return b.actions<1?{type:'NEXT_WEEK'}:b.cash>=60?{type:'CLINIC'}:earn();
 if(b.health<80||b.mind<78||b.spirituality<42||b.injuries.length||b.pollution>0){
  if(b.actions>0&&b.cash<200&&f.finance.wagePaidWeek!==b.week)return {type:'WORK'};
  return b.actions?{type:'REST'}:{type:'NEXT_WEEK'};
 }
 if(b.sequence===0){
  if(scene.phase==='PREPARATION'&&b.actions<2)return earn();
  if(f.location!==MOTHER_HOME)return {type:'RETURN_ON_FOOT'};
  return desiredMotherSceneCommand(scene,motherHost(root,'preview',root.source!.revision+2+root.journal.length));
 }
 // Secure the real weekly wage before high-cost errands; wages never arrive at a boundary.
 if(b.cash<3000&&b.actions>0&&f.finance.wagePaidWeek!==b.week)return {type:'WORK'};
 const failed=m.compounds.find(p=>p.status==='FAILED_EXPOSED'||p.status==='FAILED_SEALED');
 if(failed){if(failed.status==='FAILED_SEALED'&&(b.week<=failed.sealedWeek!||f.nowSecond<failed.sealedSecond!+604800))return earn();return at(failed.location,{type:failed.status==='FAILED_EXPOSED'?'SEAL_REMAINS':'RECOVER_REMAINS',compoundId:failed.id},1,failed.status==='FAILED_EXPOSED'?0:60);}
 const original=m.originals.find(x=>!['EMBODIED','FUSED','COMPOUND','PLAYER'].includes(x.holder));
 if(original){
  if(original.holder==='SUPPLIER'&&original.labourSteps<5)return at(MOTHER_RECOVERY,{type:'WORK_ORIGINAL',originalId:original.originalId},1,0);
  if(original.holder==='SEALED_REMNANT'&&(b.week<=original.sealedWeek!||f.nowSecond<original.sealedSecond!+604800))return earn();
  const cash=original.holder==='SUPPLIER'?motherOriginalRemainingPrice(original.labourSteps):original.holder==='UNLOCATED_REMNANT'?120:original.holder==='SEALED_REMNANT'?30:0;
  const type=original.permissionWeek!==b.week?'ASK_RECOVERY_PERMISSION':original.holder==='UNLOCATED_REMNANT'?'INVESTIGATE_REMAINS':original.holder==='LOCATED'?'SEAL_ORIGINAL':'RECOVER_ORIGINAL';
  return at(MOTHER_RECOVERY,{type,originalId:original.originalId},original.holder==='SUPPLIER'?0:1,cash);
 }
 if(m.uniqueness.holder==='CUSTODIAN')return at(MOTHER_VAULT,{type:m.uniqueness.verifiedEventId?'ACQUIRE_UNIQUENESS':'VERIFY_UNIQUENESS'},1,m.uniqueness.verifiedEventId?150:100);
 if(!scene.greenhouseReportEventId){
  if(f.location!==MOTHER_HOME){if(b.cash<(!scene.greenhouse.repairEventId?160:40)||b.actions<(!scene.greenhouse.repairEventId?1:0))return earn();return {type:'RETURN_ON_FOOT'};}
  const c=desiredMotherSceneCommand(scene,motherHost(root,'preview',root.source!.revision+2+root.journal.length));
  if(c?.type==='REPAIR_GREENHOUSE')return b.actions<1||b.cash<160?earn():c;
  if(c?.type==='BUY_SUPPLIES')return b.cash<40?earn():c;
  return c;
 }
 const p=m.compounds.find(x=>x.status==='PREPARED');
 if(p){if(b.week-root.source!.acquisition.promotionWeek<12)return earn();const preview=getMotherPromotionStabilityPreview(root,p.id);return at(MOTHER_WORKSHOP,{type:preview.prepared?'CONSUME':'STABILIZE_PROMOTION',compoundId:p.id,...(preview.prepared?{confirmed:true as const}:{})}as MotherCommand,preview.prepared?1:2,preview.prepared?0:150);}
 if(m.carriers.some(x=>x.status==='PLAYER'))return at(MOTHER_WORKSHOP,{type:'COMPOSE'},1,40);
 if(m.carriers.some(x=>x.status==='SUPPLIER'))return at(MOTHER_WORKSHOP,{type:'BUY_CARRIER'},1,90);
 return null;
}
const positionName=(position:string):string=>({ORIGINAL_ENTRY:'原苗圃入口',OUTSIDE:'实际场地外',GREENHOUSE:'已修复温室内'}[position]??'当前实际位置');
function projection(s:SliceState,head:MotherOwnedEngine|null):MotherProjection {
 const root=head?snapshotMotherOwnedEngine(head):s.mother,f=root.frame,b=f?.budget??motherBudget(s),promoted=s.progression.pathwayId==='mother'&&b.sequence===0&&root.promotionWeek!==null;
 const definitions=s.progression.pathwayId==='mother'?[...NATURE_WALKER_INHERITED_ABILITIES,...NATURE_WALKER_ABILITIES,...(promoted?MOTHER_ABILITIES:[])]:[];
 const result:MotherProjection={title:'序列0 母亲',guidanceKnown:root.guidanceKnown,promoted,story:MOTHER_STORY,nextStep:MOTHER_GOAL,risk:MOTHER_RISK,resources:{health:b.health,maxHealth:100,mind:b.mind,maxMind:100,spirituality:b.spirituality,maxSpirituality:promoted?150:120,cash:`${b.cash}便士`,actionsRemaining:b.actions,weeklyBudget:f?.finance.weeklyBudget??s.weeklyBudget},injuries:b.injuries.map(x=>({id:x.id,severity:x.severity,treated:x.treatedRevision!==null})),injuryRisk:b.injuryRisk,abilities:definitions.filter(x=>Object.hasOwn(b.mastery,x.id)).map(x=>({id:x.id,label:x.label,description:x.description,mastery:b.mastery[x.id]??0})),actions:[],sections:[],insideCase:motherInsideCase(root)};
 const add=(command:MotherCommand,label:string,cost:string)=>{const reason=publicReason(head?blockMotherOwnedEngine(head,command,s.revision+1):motherCommandBlock(s,command));result.actions.push({id:`mother:${result.actions.length}:${command.type}`,label,cost,command,enabled:reason===null,reason});};
 if(!root.guidanceKnown){add({type:'LEARN_GUIDANCE'},'听取温室与原特性指导','1行动、100便士；当前伤势如实承接');if(result.actions[0]!.enabled)result.actions[0]!.preferredAction=true;return result;}
 const scene=root.scene!,place=MOTHER_PLACES.find(x=>x.id===f!.location)?.title??'当前实际地点',dead=scene.originalSite.samples.find(x=>x.id==='CB3-DRY-1')!;
 result.sections.push({id:'clock',title:'实际日期与所在地',lines:[`${place}；第${b.week}周，${b.date.year}年${b.date.month}月${b.date.day}日。`,`成为自然行者已有${b.week-root.source!.acquisition.promotionWeek}个实际周；必须满十二周与八十四日才可服药，期间工作和生活费照常。`]});
 result.sections.push({id:'greenhouse',title:scene.phase==='PREPARATION'?'同一风损温室的普通维护':'两株原苗的短检修',lines:[`本人在${positionName(scene.playerPosition)}，累计实际步行${scene.playerTravelMetres}米。`,`温室框架完整度${scene.greenhouse.integrity}；${scene.greenhouse.repairEventId?'已实付120便士和1行动完成修复':'尚未完成有价修复'}。${scene.greenhouse.inspectedEventId?'四米普通搬运路线和退路已经查明':'先查明四米普通路线与退路'}。`,...(['CB3-ADA','CB3-LENA']as const).map(id=>`${id==='CB3-ADA'?'46岁的艾达':'39岁的莉娜'}仍在室外，${scene.permissions[id].consent==='GRANTED'?'本次作业许可有效':'本次没有有效作业许可'}；旧记录许可不能代替本次询问。`)]});
 result.sections.push({id:'plants',title:'同一原苗、实际持有人与活性',lines:scene.plants.map(p=>`${p.id==='CB3-LIVE-1'?'莉娜原持有的第一株':'艾达原持有的第二株'}：${p.alive?'仍活':'已经死亡'}，活性${p.vitality}，质量${p.massGrams}克，数量${p.quantity}；在${positionName(p.location)}，由${p.holder==='RECIPIENT'?'莉娜':p.holder==='OWNER'?'艾达':p.holder==='PLAYER'?'本人亲持':'温室床位安置'}，实际搬运${p.travelMetres}米。${p.returnedEventId?'本次已当面亲还原持有人':'本次尚未完成原路亲还'}。`)});
 result.sections.push({id:'old-objects',title:'原枯样、根垫与旧损耗',lines:[`同一原枯样${dead.massGrams}克、活性${dead.vitality}，仍由艾达在室外持有，${dead.alive?'当前记录须复核':'仍然死亡'}。`,`本人仍携同一原根垫，完整度${scene.originalRootPad.integrity}；原护腕各段${scene.originalSite.guard.segments.filter(x=>x.status==='SPENT').length}段已耗，不因晋升修复。`,`原衬片已耗${scene.originalSite.pads.filter(x=>x.status==='SPENT').length}片，未耗${scene.originalSite.pads.filter(x=>x.status==='UNUSED').length}片，原匣、牌、纸与片仍在艾达室外保管处。全部旧人物伤势、独立意愿与旧冲突结局保留。`]});
 result.sections.push({id:'supplies',title:'真实水量、木楔与有限活枝',lines:[`实购水剩${scene.supplies.waterRemaining}/${scene.supplies.waterInitial}份；普通木楔剩${scene.supplies.wedgesRemaining}/${scene.supplies.wedgesInitial}根。`,...scene.plants.map(p=>`${p.id==='CB3-LIVE-1'?'第一株':'第二株'}原有活枝：没有新增枝条，本次实际偏移${p.branch.deflectionMillimetres}毫米，${p.branch.supportMethod==='ABILITY'?'短时能力支撑已实际发生':p.branch.supportMethod==='WEDGE'?'已有普通木楔承接':'尚未支撑'}。`),scene.window?`当前单株短窗尚余${Math.max(0,scene.window.expiresAt-f!.nowSecond)}秒；换目标、移位、松手、撤回或到期即止。`:'当前没有未结束的能力短窗。']});
 result.sections.push({id:'materials',title:'三份原特性与同一唯一性',lines:projectMotherMaterials(root.materials!)});
 result.sections.push({id:'body',title:'同一本人与实际伤势',lines:[`${s.character.name}，${s.character.age}岁；健康${b.health}、精神${b.mind}、灵性${b.spirituality}/${promoted?150:120}、污染${b.pollution}。`,`当前意志${b.coreStats.will}、知识${b.coreStats.knowledge}；全部17项旧掌握逐值保留，新技巧只在成功实际应用后增长。`,...b.injuries.map(i=>`${i.severity==='HEAVY'?'重伤':'轻伤'}：${i.treatedRevision===null?'尚未处置':'已普通处置，仍须之后休养'}。`)]});
 if(promoted)result.sections.push({id:'abilities',title:'本次单目标短窗',lines:[`单株短时活性维持成功率${computeCheckChance({baseAbility:b.coreStats.knowledge,difficulty:MOTHER_PRACTICE_COSTS.maintenance.difficulty,modifiers:[]})}%；原活枝有限支撑成功率${computeCheckChance({baseAbility:b.coreStats.will,difficulty:MOTHER_PRACTICE_COSTS.branch.difficulty,modifiers:[]})}%。实际应用时才检定。`,'普通供水与木楔同样可以完成；不治疗原伤、不恢复已失活性、不复活枯样、不增加植物或枝条。']});
 result.sections.push({id:'finance',title:'实际工作与每周生活账',lines:[`现款${b.cash}便士；原职业每周工资${root.source!.character.weeklyWage}便士，须实际花1行动工作后入账。`,`每周${f!.finance.weeklyBudget}行动；尚欠本金${f!.finance.debts.reduce((n,x)=>n+x.remaining,0)}便士。跨周照常收生活费和还款，不发自动工资、不治疗、不补材料。`,'出发前应留足目的地操作行动与费用：原瓶五步劳务后各1200便士；唯一性核验1行动100便士，交接1行动150便士；修温室1行动120便士，水和木楔40便士；调配1行动40便士与载体50便士；稳定准备及服药合计2行动150便士42灵性。']});
 result.sections.push({id:'return',title:'普通完成、停止与实际报告',lines:[scene.greenhouseReportEventId?'温室已真实修复，两株原苗普通供水楔撑后原路亲还，报告已经完成。':'普通水、木楔、实际搬运与亲还足以完成准备；没有能力成功要求。',scene.returnReportEventId?'本轮已经真实退出并报告完成或停止，全部实际结果保留。':'可停止短窗，亲取实际借用原苗，沿普通路线走出并当面归还；伤势、费用与活性损耗不倒退。']});
 const latest=root.journal.at(-1);result.sections.push({id:'recent-action',title:'最近行动与实际费用',lines:latest?[...latest.notes,...latest.financeReceipts.map(x=>x.text),...latest.randomReceipts.map(x=>`本次实际检定：成功率${x.check.chance}%，掷出${x.check.roll}，${['SUCCESS','GREAT_SUCCESS'].includes(x.check.tier)?'成功':'失败'}。`),`现款变化${latest.after.budget.cash-latest.before.budget.cash}便士；行动变化${latest.after.budget.actions-latest.before.budget.actions}。`]:['已实付1行动与100便士听取指导，当前原伤仍须真实处理。']});
 for(const x of motherSceneActions(scene,motherHost(root,'preview',s.revision+1)))add(x.command,x.label,x.cost);
 for(const x of motherMaterialActions(root))add(x.command,x.label,x.cost);
 for(const p of root.materials!.compounds.filter(x=>x.status==='PREPARED')){const preview=getMotherPromotionStabilityPreview(root,p.id);result.sections.push({id:'promotion-stability',title:'本瓶本次准备与实际概率',lines:[`当前实际意志${b.coreStats.will}，这瓶现时成功率${preview.chance}%；实付稳定准备后为${preview.preparedChance}%。`,preview.prepared?'本瓶准备有效，服药时只用一次。':'准备需要1行动、150便士、12灵性、8精神与一小时，并另留本周服药行动。',preview.reason??'可按当前真实条件准备。']});add({type:'STABILIZE_PROMOTION',compoundId:p.id},'实付完成本瓶本次稳定准备','1行动、150便士、12灵性、8精神；另留服药行动');add({type:'CONSUME',compoundId:p.id,confirmed:true},`独立确认饮用同一成药（${preview.chance}%）`,'1行动、30灵性；失败可能重伤或死亡');}
 for(const p of MOTHER_PLACES)if([MOTHER_HOME,MOTHER_RECOVERY,MOTHER_VAULT,MOTHER_WORKSHOP].includes(p.id)&&p.id!==f!.location)add({type:'TRAVEL',to:p.id},`沿普通道路前往${p.title}`,'1行动、半小时；须另留目的地操作费用与行动');
 add({type:'RETURN_ON_FOOT'},'沿普通道路返回温室外','0行动、两小时');add({type:'WORK'},'完成本周原职业工作','1行动、八小时');add({type:'REST'},'按实际生活档休养','1行动、八小时');add({type:'CLINIC'},'普通处置当前重伤','1行动、60便士、一小时');add({type:'NEXT_WEEK'},'走到下一真实周界','照常结算生活与还款');
 const wanted=desiredMotherCommand(root);let preferred=wanted?result.actions.find(a=>sameMother(a.command,wanted)&&a.enabled):null;
 if(!preferred&&wanted&&!motherInsideCase(root)&&b.status==='ACTIVE'){if(b.actions>0&&f!.finance.wagePaidWeek!==b.week)preferred=result.actions.find(a=>a.command.type==='WORK'&&a.enabled);else preferred=result.actions.find(a=>a.command.type==='NEXT_WEEK'&&a.enabled);}
 if(preferred){preferred.preferredAction=true;result.nextStep=`下一步：${preferred.label}。${preferred.cost}。`;}else if(scene.returnReportEventId)result.nextStep='本轮报告已经完成，全部实际结果保留。';
 return result;
}
