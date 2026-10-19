import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { HermitState, HermitCommand, HermitProjection } from './types.js';
import { createHermitState,startHermit,sameHermit,hermitDigest,validateHermitCommand,openHermitOwnedEngine,snapshotHermitOwnedEngine,advanceHermitOwnedEngine,blockHermitOwnedEngine,getHermitPromotionStabilityPreview,hermitInsideCase,hermitHost,type HermitOwnedEngine } from './engine.js';
import { hermitBudget,hermitHistoryDigest,hermitAcquisitionSnapshot,hermitSourceBlock } from './source.js';
import { HERMIT_ABILITIES,HERMIT_STORY,HERMIT_GOAL,HERMIT_RISK,HERMIT_PLACES,HERMIT_ORIGINAL_IDS } from './content.js';
import { KNOWLEDGE_EMPEROR_ABILITIES,KNOWLEDGE_EMPEROR_INHERITED_ABILITIES,KNOWLEDGE_EMPEROR_PRICES } from '../knowledge-emperor/content.js';
import { hermitSceneActions,desiredHermitSceneCommand } from './scene.js';
import { hermitMaterialActions,projectHermitMaterials,HERMIT_HOME,HERMIT_RECOVERY,HERMIT_VAULT,HERMIT_WORKSHOP } from './materials.js';
export { createHermitState,validateHermitCommand,getHermitPromotionStabilityPreview } from './engine.js';
export { hermitSourceView } from './source.js';
export type { HermitOwnedEngine } from './engine.js';
export type { HermitState,HermitCommand,HermitProjection } from './types.js';
const clone=<T>(value:T):T=>structuredClone(value);
function assertCurrent(s:SliceState,root:HermitState):void {
 const source=root.source,f=root.frame;
 if(!source||!f||s.progression.pathwayId!=='hermit'||!sameHermit(hermitBudget(s),f.budget)||!sameHermit(s.random,f.random)||s.revision!==source.revision+1+root.journal.length)throw Error('当前身体、资源与实际行动次序不一致。');
 const {coreStats:_current,...identity}=s.character,{coreStats:_source,...originalIdentity}=source.character;
 if(!sameHermit(identity,originalIdentity)||Object.entries(f.finance).some(([key,value])=>!sameHermit(s[key as keyof SliceState],value)))throw Error('当前身份或实际生活账本不一致。');
 if(source.historyDigest!==hermitHistoryDigest(s)||source.originalWorldDigest!==hermitDigest(s.world)||s.combatHistory.length!==source.combatHistoryLength||source.combatHistoryDigest!==hermitDigest(s.combatHistory)||!sameHermit(source.acquisition,hermitAcquisitionSnapshot(s)))throw Error('旧人物、原物或原瓶履历被改写。');
 if(s.combat!==null||s.activeEvent!==null||s.eventQueue.length||s.pulse!=='NONE'||((f.budget.sequence===0)!==(root.promotionWeek!==null)))throw Error('当前现场或晋升与实际记录不一致。');
}
function guidanceBlock(s:SliceState):string|null {
 if(!sameHermit(s.hermit,createHermitState()))return '已有本章记录，不能重新开始或补发原物。';
 const reason=hermitSourceBlock(s);if(reason)return reason;
 return s.actionsRemaining<1||s.cash<100?'指导需要1行动与100便士，可以先正常工作与休养。':null;
}
function publicReason(reason:string|null):string|null{return reason===null?null:/[\u3400-\u9fff]/.test(reason)&&!/[A-Z_]{6,}|seed|cursor|digest|receipt/i.test(reason)?reason:'当前原件、实际所在地或前一步条件尚未满足。';}
export function validateHermitState(s:SliceState):boolean {
 try {if(sameHermit(s.hermit,createHermitState()))return s.progression.pathwayId!=='hermit'||s.progression.sequence!==0;const head=openHermitOwnedEngine(s);assertCurrent(s,snapshotHermitOwnedEngine(head));return true;}catch{return false;}
}
/** Historical membership authenticates the entire new journal, never a
 * source-shaped object. The owned runtime caches this only after strict open. */
export function hasHermitHistory(s:SliceState):boolean{return !!s.hermit?.guidanceKnown&&s.hermit.source!==null&&s.progression.pathwayId==='hermit'&&validateHermitState(s);}
export function hasHermitLock(s:SliceState):boolean{return hasHermitHistory(s);}
export function openHermitOwnedHead(s:SliceState):HermitOwnedEngine{const h=openHermitOwnedEngine(s);assertCurrent(s,snapshotHermitOwnedEngine(h));return h;}
export function assertOwnedHermitCurrent(s:SliceState,head:HermitOwnedEngine):void{const root=snapshotHermitOwnedEngine(head);if(!sameHermit(root,s.hermit))throw Error('当前会话与实际存档版本不一致。');assertCurrent(s,root);}
export function hermitCommandBlock(s:SliceState,c:HermitCommand):string|null {
 if(!validateHermitCommand(c))return '这项行动内容无效。';if(s.status!=='ACTIVE')return '已经死亡或结束的角色不能继续行动。';if(c.type==='LEARN_GUIDANCE')return guidanceBlock(s);
 try{return publicReason(blockHermitOwnedEngine(openHermitOwnedHead(s),c,s.revision+1));}catch{return '当前记录未通过核验，不能继续行动。';}
}
export function ownedHermitCommandBlock(s:SliceState,c:HermitCommand,head:HermitOwnedEngine):string|null {
 if(!validateHermitCommand(c)||c.type==='LEARN_GUIDANCE')return '这项行动无效或已经听取指导。';if(s.status!=='ACTIVE')return '已经死亡或结束的角色不能继续行动。';
 try{assertOwnedHermitCurrent(s,head);return publicReason(blockHermitOwnedEngine(head,c,s.revision+1));}catch{return '当前记录未通过核验，不能继续行动。';}
}
function publish(s:SliceState,c:HermitCommand,root:HermitState,ctx:SeerContext):void {
 const b=root.frame!.budget;s.hermit=clone(root);s.week=b.week;s.date=clone(b.date);s.actionsRemaining=b.actions;s.cash=b.cash;s.health=b.health;s.mind=b.mind;s.spirituality=b.spirituality;s.status=b.status;s.injuries=clone(b.injuries);s.injuryRisk=b.injuryRisk;s.progression.sequence=b.sequence;s.progression.acting=b.acting;s.progression.mastery={...b.mastery};s.character.coreStats={...b.coreStats};s.seer.pollution=b.pollution;s.seer.completedSources=[...b.completedSources];s.random={...root.frame!.random};Object.assign(s,clone(root.frame!.finance));
 const event=c.type==='LEARN_GUIDANCE'?null:root.journal.at(-1)!;s.lastCheck=event?.randomReceipts.length?clone(event.randomReceipts.at(-1)!.check):null;
 if(!event)ctx.note('听取档案搬迁与隐者指导','实付1行动与100便士，核对本人、同一原记录与三份原特性。艾瑞丝仍在馆外保管自己的记录，旧许可已关闭；两次旧失败的残余仍须实际调查。');
 else{for(const receipt of event.financeReceipts)ctx.note(receipt.title,receipt.text);ctx.note(b.sequence===0?'隐者的实际行动':'档案搬迁与原件交接',event.notes.join(''));}
}
export function applyHermitCommand(s:SliceState,c:HermitCommand,ctx:SeerContext):void {
 if(!validateHermitCommand(c)||s.status!=='ACTIVE')throw Error('当前不能执行这项行动。');let root:HermitState;
 if(c.type==='LEARN_GUIDANCE'){const reason=guidanceBlock(s);if(reason)throw Error(reason);root=startHermit(s);}else root=snapshotHermitOwnedEngine(advanceHermitOwnedEngine(openHermitOwnedHead(s),c,s.revision+1));publish(s,c,root,ctx);
}
export function applyOwnedHermitCommand(s:SliceState,c:HermitCommand,ctx:SeerContext,head:HermitOwnedEngine):HermitOwnedEngine {
 assertOwnedHermitCurrent(s,head);if(!validateHermitCommand(c)||c.type==='LEARN_GUIDANCE'||s.status!=='ACTIVE')throw Error('当前不能执行这项行动。');const next=advanceHermitOwnedEngine(head,c,s.revision+1);publish(s,c,snapshotHermitOwnedEngine(next),ctx);return next;
}
export function projectHermit(s:SliceState):HermitProjection{return projection(s,sameHermit(s.hermit,createHermitState())?null:openHermitOwnedHead(s));}
export function projectOwnedHermit(s:SliceState,h:HermitOwnedEngine):HermitProjection{assertOwnedHermitCurrent(s,h);return projection(s,h);}
/** Recommendation is a normal public command, not a completion certificate. */
function desiredCommand(root:HermitState):HermitCommand|null {
 const f=root.frame!,b=f.budget,scene=root.scene!,m=root.materials!;
 const at=(to:string,c:HermitCommand,actions=1):HermitCommand=>f.location===to?c:b.actions<actions+1?{type:'NEXT_WEEK'}:{type:'TRAVEL',to};
 if(b.status!=='ACTIVE')return null;
 if(hermitInsideCase(root))return desiredHermitSceneCommand(scene,hermitHost(root,'preview',root.source!.revision+2+root.journal.length));
 if(b.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null))return b.actions<1?{type:'NEXT_WEEK'}:b.cash>=60?{type:'CLINIC'}:f.finance.wagePaidWeek!==b.week?{type:'WORK'}:{type:'NEXT_WEEK'};
 if(b.health<80||b.mind<78||b.spirituality<42||b.injuries.length||b.pollution>20)return b.actions?{type:'REST'}:{type:'NEXT_WEEK'};
 if(b.sequence===0){
  if(scene.returnReportEventId)return null;
  if(f.location!==HERMIT_HOME)return {type:'RETURN_ON_FOOT'};
  return desiredHermitSceneCommand(scene,hermitHost(root,'preview',root.source!.revision+2+root.journal.length));
 }
 if(!scene.preparationReportEventId){if(f.location!==HERMIT_HOME)return at(HERMIT_HOME,{type:'ASK_OWNER'});return desiredHermitSceneCommand(scene,hermitHost(root,'preview',root.source!.revision+2+root.journal.length));}
 const failed=m.compounds.find(p=>p.status==='FAILED_EXPOSED'||p.status==='FAILED_SEALED');
 if(failed){if(failed.status==='FAILED_SEALED'&&(b.week<=failed.sealedWeek!||f.nowSecond<failed.sealedSecond!+604800))return f.finance.wagePaidWeek!==b.week&&b.actions>0?{type:'WORK'}:{type:'NEXT_WEEK'};return at(failed.location,{type:failed.status==='FAILED_EXPOSED'?'SEAL_REMAINS':'RECOVER_REMAINS',compoundId:failed.id});}
 const original=m.originals.find(x=>!['EMBODIED','FUSED','COMPOUND','PLAYER'].includes(x.holder));
 if(original){
  if(original.holder==='SEALED_REMNANT'&&(b.week<=original.sealedWeek!||f.nowSecond<original.sealedSecond!+604800))return f.finance.wagePaidWeek!==b.week&&b.actions>0?{type:'WORK'}:{type:'NEXT_WEEK'};
  const type=original.permissionWeek!==b.week?'ASK_RECOVERY_PERMISSION':original.holder==='UNLOCATED_REMNANT'?'INVESTIGATE_REMAINS':original.holder==='LOCATED'?'SEAL_ORIGINAL':'RECOVER_ORIGINAL';
  return at(HERMIT_RECOVERY,{type,originalId:original.originalId});
 }
 if(m.uniqueness.holder==='CUSTODIAN')return at(HERMIT_VAULT,{type:m.uniqueness.verifiedEventId?'ACQUIRE_UNIQUENESS':'VERIFY_UNIQUENESS'});
 const p=m.compounds.find(x=>x.status==='PREPARED');
 if(p){if(b.week-root.source!.acquisition.promotionWeek<12)return f.finance.wagePaidWeek!==b.week&&b.actions?{type:'WORK'}:{type:'NEXT_WEEK'};const preview=getHermitPromotionStabilityPreview(root,p.id);return at(HERMIT_WORKSHOP,{type:preview.prepared?'CONSUME':'STABILIZE_PROMOTION',compoundId:p.id,...(preview.prepared?{confirmed:true as const}:{})}as HermitCommand,preview.prepared?1:2);}
 if(m.carriers.some(x=>x.status==='PLAYER'))return at(HERMIT_WORKSHOP,{type:'COMPOSE'});
 if(m.carriers.some(x=>x.status==='SUPPLIER'))return at(HERMIT_WORKSHOP,b.actions<1?{type:'NEXT_WEEK'}:{type:'BUY_CARRIER'});
 return null;
}
const positionName=(position:string):string=>({OUTSIDE:'馆外',ENTRY:'廊口',MIDPOINT:'中段交接点',DESTINATION:'目的端'}[position]??'当前实际位置');
function projection(s:SliceState,head:HermitOwnedEngine|null):HermitProjection {
 const root=head?snapshotHermitOwnedEngine(head):s.hermit,f=root.frame,b=f?.budget??hermitBudget(s),promoted=s.progression.pathwayId==='hermit'&&b.sequence===0&&root.promotionWeek!==null;
 const definitions=s.progression.pathwayId==='hermit'?[...KNOWLEDGE_EMPEROR_INHERITED_ABILITIES,...KNOWLEDGE_EMPEROR_ABILITIES,...(promoted?HERMIT_ABILITIES:[])]:[];
 const result:HermitProjection={title:'序列0 隐者',guidanceKnown:root.guidanceKnown,promoted,story:HERMIT_STORY,nextStep:HERMIT_GOAL,risk:HERMIT_RISK,resources:{health:b.health,maxHealth:100,mind:b.mind,maxMind:100,spirituality:b.spirituality,maxSpirituality:promoted?150:120,cash:`${b.cash}便士`,actionsRemaining:b.actions,weeklyBudget:f?.finance.weeklyBudget??s.weeklyBudget},injuries:b.injuries.map(x=>({id:x.id,severity:x.severity,treated:x.treatedRevision!==null})),injuryRisk:b.injuryRisk,abilities:definitions.filter(x=>Object.hasOwn(b.mastery,x.id)).map(x=>({id:x.id,label:x.label,description:x.description,mastery:b.mastery[x.id]??0})),actions:[],sections:[],insideCase:hermitInsideCase(root)};
 const add=(command:HermitCommand,label:string,cost:string)=>{const reason=publicReason(head?blockHermitOwnedEngine(head,command,s.revision+1):hermitCommandBlock(s,command));result.actions.push({id:`hermit:${result.actions.length}:${command.type}`,label,cost,command:clone(command),enabled:reason===null,reason});};
 if(!root.guidanceKnown){add({type:'LEARN_GUIDANCE'},'听取档案搬迁与三份原特性指导','1行动、100便士');result.actions[0]!.preferredAction=true;return result;}
 const scene=root.scene!,place=HERMIT_PLACES.find(x=>x.id===f!.location)?.title??'当前实际地点';
 result.sections.push({id:'clock',title:'实际日期与所在地',lines:[`${place}；第${b.week}周，${b.date.year}年${b.date.month}月${b.date.day}日。`,`成为知识皇帝已有${b.week-root.source!.acquisition.promotionWeek}个实际周，满十二周才可服药。距下一周界${Math.ceil((f!.weekAnchor+604800-f!.nowSecond)/3600)}小时。`]});
 result.sections.push({id:'scene',title:scene.phase==='PREPARATION'?'档案搬迁与实际通行':'同一档案的返程',lines:[`本人在${positionName(scene.playerPosition)}，${scene.body==='SOLID'?'实体':'有限信息形态'}，精力${scene.playerEnergy}；艾瑞丝在${positionName(scene.owner.position)}，精力${scene.owner.energy}。`,...scene.workers.map(w=>`${w.name}，${w.age}岁，在${positionName(w.position)}，健康${w.health}、精力${w.energy}；${w.consent==='GRANTED'?'本次同意仍有效':'当前没有作业同意'}。`),`原记录只有一份，归艾瑞丝所有，当前由${scene.custody.holder==='OWNER'?'艾瑞丝':scene.workers.find(x=>x.id===scene.custody.holder)?.name??'封箱'}在${positionName(scene.custody.position)}保管。`,`前后段均三米；前段${scene.segments.A.open?'开启':'关闭'}、后段${scene.segments.B.open?'开启':'关闭'}。普通侧廊${scene.sidePathEventId?'已实际检查':'尚未检查'}。`,`检修缝${scene.slit.inspectedEventId?'已查验':'尚未查验'}，${scene.slit.connected&&scene.slit.open?'当前连通':'当前不通'}；挡板${scene.shutter==='JAMMED'?'卡住':scene.shutter==='CLEARED'?'已实际清障':'开启'}。`,scene.reading?`本次实际读到：${scene.reading.actualText}`:'本次尚未实际阅读已获许可的新记录行。',`新封签：空白${scene.seals.filter(x=>x.status==='BLANK').length}枚，已写${scene.seals.filter(x=>x.status==='WRITTEN').length}枚，实际贴上${scene.seals.filter(x=>x.status==='APPLIED').length}枚，作废${scene.seals.filter(x=>x.status==='SPENT').length}枚。`]});
 result.sections.push({id:'materials',title:'三份原特性与同一唯一性',lines:projectHermitMaterials(root.materials!)});
 result.sections.push({id:'body',title:'同一本人、原人物与旧物',lines:[`${s.character.name}，${s.character.age}岁；健康${b.health}、精神${b.mind}、灵性${b.spirituality}/${promoted?150:120}、污染${b.pollution}；当前意志${b.coreStats.will}。`,'原档页仍留在原位置，与本次搬迁的记录是不同实物。旧纸张、材料、卷轴的所有权与实际耗费继续保留。','旧十五项掌握逐值保留；新技巧只有实际完成移动凝聚或写成贴签后才增长。']});
 result.sections.push({id:'finance',title:'实际工作与生活账目',lines:[`现款${b.cash}便士；原职业每周工资${root.source!.character.weeklyWage}便士，须实际花1行动工作才入账。`,`每周${f!.finance.weeklyBudget}行动，尚欠本金${f!.finance.debts.reduce((n,x)=>n+x.remaining,0)}便士。普通周结不发工资、不治伤、不补回原件。`]});
 result.sections.push({id:'injuries',title:'当前实际伤势',lines:b.injuries.length?b.injuries.map(i=>`${i.severity==='HEAVY'?'重伤':'轻伤'}：${i.treatedRevision===null?'尚未处置':'已处置，仍须之后休养'}。`):['当前没有实际伤势。']});
 result.sections.push({id:'return',title:'交接与普通退路',lines:[scene.preparationReportEventId?'搬迁通行报告已在真实归物、签收及两位成人退出后完成。':'搬迁尚未完成；任何人都可以撤回同意并沿已检查的普通侧廊离开。',scene.returnReportEventId?`返程报告已完成，${scene.status==='ABORTED'?'本次能力实践中止':'同一记录已实际归还'}。`:'先停止短窗并凝聚实体，再结束接触，逐人退出并让原主实际收到同一记录。',scene.informationCompleted?'已实际完成一次本人信息通行与凝聚。':'本人信息通行尚未实际完成。',scene.transferCompleted?'已实际转录并贴上同一枚付费封签。':scene.manualCopyCompleted?'已用普通手写封签完成返程。':'同一封签尚未实际写成并贴上。']});
 const latest=root.journal.at(-1);result.sections.push({id:'recent-action',title:'最近行动与实际费用',lines:latest?[...latest.notes,...latest.financeReceipts.map(x=>x.text),...latest.randomReceipts.map(x=>`本次实际检定：成功率${x.check.chance}%，掷出${x.check.roll}，${x.check.tier==='SUCCESS'?'成功':x.check.tier==='GREAT_SUCCESS'?'大成功':x.check.tier==='FAILURE'?'失败':'严重失败'}。`),`现款变化${latest.after.budget.cash-latest.before.budget.cash}便士；行动变化${latest.after.budget.actions-latest.before.budget.actions}。`]:['已实付1行动与100便士听取指导。']});
 for(const x of hermitSceneActions(scene,hermitHost(root,'preview',s.revision+1)))add(x.command,x.label,x.cost);
 for(const x of hermitMaterialActions(root))add(x.command,x.label,x.cost);
 for(const p of root.materials!.compounds.filter(x=>x.status==='PREPARED')){const preview=getHermitPromotionStabilityPreview(root,p.id);result.sections.push({id:'promotion-stability',title:'本瓶本次准备与风险',lines:[`当前实际意志${b.coreStats.will}，这瓶现时成功率${preview.chance}%；实付本次稳定准备后为${preview.preparedChance}%。`,preview.prepared?'本瓶准备有效，服药时只用一次。':'准备须1行动、150便士、12灵性、8精神与一小时，并保留本周服药行动。',preview.reason??'可按当前真实条件准备。']});add({type:'STABILIZE_PROMOTION',compoundId:p.id},'实付完成本瓶本次稳定准备','1行动、150便士、12灵性、8精神；保留服药行动');add({type:'CONSUME',compoundId:p.id,confirmed:true},`独立确认饮用同一成药（${preview.chance}%）`,'1行动、30灵性；失败可能重伤或死亡');}
 for(const p of HERMIT_PLACES)if([HERMIT_HOME,HERMIT_RECOVERY,HERMIT_VAULT,HERMIT_WORKSHOP].includes(p.id)&&p.id!==f!.location)add({type:'TRAVEL',to:p.id},`沿普通道路前往${p.title}`,'1行动、半小时');
 add({type:'RETURN_ON_FOOT'},'沿普通道路回到馆外','0行动、两小时');add({type:'WORK'},'完成本周原职业工作','1行动、八小时');add({type:'REST'},'按实际生活档休养','1行动、八小时');add({type:'CLINIC'},'普通处置当前重伤','1行动、60便士、一小时');add({type:'NEXT_WEEK'},'走到下一真实周界','照常结算生活与还款');
 const wanted=desiredCommand(root);let preferred=wanted?result.actions.find(a=>sameHermit(a.command,wanted)&&a.enabled):null;
 if(!preferred&&wanted&&!hermitInsideCase(root)&&b.status==='ACTIVE'){
  const needActions=wanted.type==='STABILIZE_PROMOTION'?2:1;
  if(b.actions<needActions)preferred=result.actions.find(a=>a.command.type==='NEXT_WEEK'&&a.enabled);
  else if(f!.finance.wagePaidWeek!==b.week)preferred=result.actions.find(a=>a.command.type==='WORK'&&a.enabled);
  else preferred=result.actions.find(a=>a.command.type==='NEXT_WEEK'&&a.enabled);
 }
 if(preferred)preferred.preferredAction=true;
 return result;
}
