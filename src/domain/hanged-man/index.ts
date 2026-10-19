import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { HangedManState, HangedManCommand, HangedManProjection, HangedManPlaceId } from './types.js';
import { createHangedManState,startHangedMan,sameHangedMan,hangedManDigest,validateHangedManCommand,openHangedManOwnedEngine,snapshotHangedManOwnedEngine,advanceHangedManOwnedEngine,blockHangedManOwnedEngine,getHangedManPromotionStabilityPreview,hangedManInsideCase,hangedManHost,type HangedManOwnedEngine } from './engine.js';
import { hangedManBudget,hangedManHistoryDigest,hangedManAcquisitionSnapshot,hangedManSourceBlock } from './source.js';
import { HANGED_MAN_ABILITIES,HANGED_MAN_STORY,HANGED_MAN_GOAL,HANGED_MAN_RISK,HANGED_MAN_PLACES } from './content.js';
import { DARK_ANGEL_ABILITIES,DARK_ANGEL_INHERITED_ABILITIES } from '../dark-angel/content.js';
import { hangedManSceneActions,desiredHangedManSceneCommand } from './scene.js';
import { hangedManMaterialActions,projectHangedManMaterials,HANGED_MAN_HOME,HANGED_MAN_RECOVERY,HANGED_MAN_VAULT,HANGED_MAN_WORKSHOP } from './materials.js';
export { createHangedManState,validateHangedManCommand,getHangedManPromotionStabilityPreview } from './engine.js';
export { hangedManSourceView } from './source.js';
export type { HangedManOwnedEngine } from './engine.js';
export type { HangedManState,HangedManCommand,HangedManProjection } from './types.js';
const clone=<T>(value:T):T=>structuredClone(value);
function assertCurrent(s:SliceState,root:HangedManState):void {
 const source=root.source,f=root.frame;
 if(!source||!f||s.progression.pathwayId!=='hanged-man'||!sameHangedMan(hangedManBudget(s),f.budget)||!sameHangedMan(s.random,f.random)||s.revision!==source.revision+1+root.journal.length)throw Error('当前身体、资源与实际行动次序不一致。');
 const {coreStats:_current,...identity}=s.character,{coreStats:_source,...originalIdentity}=source.character;
 if(!sameHangedMan(identity,originalIdentity)||Object.entries(f.finance).some(([key,value])=>!sameHangedMan(s[key as keyof SliceState],value)))throw Error('当前身份或实际生活账本不一致。');
 if(source.historyDigest!==hangedManHistoryDigest(s)||source.originalWorldDigest!==hangedManDigest(s.world)||s.combatHistory.length!==source.combatHistoryLength||source.combatHistoryDigest!==hangedManDigest(s.combatHistory)||!sameHangedMan(source.acquisition,hangedManAcquisitionSnapshot(s)))throw Error('旧人物、原物或原瓶履历被改写。');
 if(s.combat!==null||s.activeEvent!==null||s.eventQueue.length||s.pulse!=='NONE'||((f.budget.sequence===0)!==(root.promotionWeek!==null)))throw Error('当前现场或晋升与实际记录不一致。');
}
function guidanceBlock(s:SliceState):string|null {
 if(!sameHangedMan(s.hangedMan,createHangedManState()))return '已有本章记录，不能重新开始或补发原物。';
 const reason=hangedManSourceBlock(s);if(reason)return reason;
 return s.actionsRemaining<1||s.cash<100?'指导需要1行动与100便士，可以先正常工作与休养。':null;
}
function publicReason(reason:string|null):string|null{return reason===null?null:/[\u3400-\u9fff]/.test(reason)&&!/[A-Z_]{6,}|seed|cursor|digest|receipt/i.test(reason)?reason:'当前原件、实际所在地或前一步条件尚未满足。';}
export function validateHangedManState(s:SliceState):boolean {
 try {if(sameHangedMan(s.hangedMan,createHangedManState()))return s.progression.pathwayId!=='hanged-man'||s.progression.sequence!==0;const head=openHangedManOwnedEngine(s);assertCurrent(s,snapshotHangedManOwnedEngine(head));return true;}catch{return false;}
}
/** Historical membership authenticates the entire new journal, never a
 * source-shaped object. The owned runtime caches this only after strict open. */
export function hasHangedManHistory(s:SliceState):boolean{return !!s.hangedMan?.guidanceKnown&&s.hangedMan.source!==null&&s.progression.pathwayId==='hanged-man'&&validateHangedManState(s);}
export function hasHangedManLock(s:SliceState):boolean{return hasHangedManHistory(s);}
export function openHangedManOwnedHead(s:SliceState):HangedManOwnedEngine{const h=openHangedManOwnedEngine(s);assertCurrent(s,snapshotHangedManOwnedEngine(h));return h;}
export function assertOwnedHangedManCurrent(s:SliceState,head:HangedManOwnedEngine):void{const root=snapshotHangedManOwnedEngine(head);if(!sameHangedMan(root,s.hangedMan))throw Error('当前会话与实际存档版本不一致。');assertCurrent(s,root);}
export function hangedManCommandBlock(s:SliceState,c:HangedManCommand):string|null {
 if(!validateHangedManCommand(c))return '这项行动内容无效。';if(s.status!=='ACTIVE')return '已经死亡或结束的角色不能继续行动。';if(c.type==='LEARN_GUIDANCE')return guidanceBlock(s);
 try{return publicReason(blockHangedManOwnedEngine(openHangedManOwnedHead(s),c,s.revision+1));}catch{return '当前记录未通过核验，不能继续行动。';}
}
export function ownedHangedManCommandBlock(s:SliceState,c:HangedManCommand,head:HangedManOwnedEngine):string|null {
 if(!validateHangedManCommand(c)||c.type==='LEARN_GUIDANCE')return '这项行动无效或已经听取指导。';if(s.status!=='ACTIVE')return '已经死亡或结束的角色不能继续行动。';
 try{assertOwnedHangedManCurrent(s,head);return publicReason(blockHangedManOwnedEngine(head,c,s.revision+1));}catch{return '当前记录未通过核验，不能继续行动。';}
}
function publish(s:SliceState,c:HangedManCommand,root:HangedManState,ctx:SeerContext):void {
 const b=root.frame!.budget;s.hangedMan=clone(root);s.week=b.week;s.date=clone(b.date);s.actionsRemaining=b.actions;s.cash=b.cash;s.health=b.health;s.mind=b.mind;s.spirituality=b.spirituality;s.status=b.status;s.injuries=clone(b.injuries);s.injuryRisk=b.injuryRisk;s.progression.sequence=b.sequence;s.progression.acting=b.acting;s.progression.mastery={...b.mastery};s.character.coreStats={...b.coreStats};s.seer.pollution=b.pollution;s.seer.completedSources=[...b.completedSources];s.random={...root.frame!.random};Object.assign(s,clone(root.frame!.finance));
 const event=c.type==='LEARN_GUIDANCE'?null:root.journal.at(-1)!;s.lastCheck=event?.randomReceipts.length?clone(event.randomReceipts.at(-1)!.check):null;
 if(!event)ctx.note('听取泄压廊与倒吊人指导','实付1行动与100便士，核对本人、三份原特性与当前两位原灵。原院人物、耗材和残压仍保留实际状态；先沿原路走出，再前往短压廊。');
 else{for(const receipt of event.financeReceipts)ctx.note(receipt.title,receipt.text);ctx.note(b.sequence===0?'倒吊人的实际行动':'短压廊与原件交接',event.notes.join(''));}
}
export function applyHangedManCommand(s:SliceState,c:HangedManCommand,ctx:SeerContext):void {
 if(!validateHangedManCommand(c)||s.status!=='ACTIVE')throw Error('当前不能执行这项行动。');let root:HangedManState;
 if(c.type==='LEARN_GUIDANCE'){const reason=guidanceBlock(s);if(reason)throw Error(reason);root=startHangedMan(s);}else root=snapshotHangedManOwnedEngine(advanceHangedManOwnedEngine(openHangedManOwnedHead(s),c,s.revision+1));publish(s,c,root,ctx);
}
export function applyOwnedHangedManCommand(s:SliceState,c:HangedManCommand,ctx:SeerContext,head:HangedManOwnedEngine):HangedManOwnedEngine {
 assertOwnedHangedManCurrent(s,head);if(!validateHangedManCommand(c)||c.type==='LEARN_GUIDANCE'||s.status!=='ACTIVE')throw Error('当前不能执行这项行动。');const next=advanceHangedManOwnedEngine(head,c,s.revision+1);publish(s,c,snapshotHangedManOwnedEngine(next),ctx);return next;
}
export function projectHangedMan(s:SliceState):HangedManProjection{return projection(s,sameHangedMan(s.hangedMan,createHangedManState())?null:openHangedManOwnedHead(s));}
export function projectOwnedHangedMan(s:SliceState,h:HangedManOwnedEngine):HangedManProjection{assertOwnedHangedManCurrent(s,h);return projection(s,h);}
/** Recommendation is a normal public command, not a completion certificate. */
function desiredCommand(root:HangedManState):HangedManCommand|null {
 const f=root.frame!,b=f.budget,scene=root.scene!,m=root.materials!;
 const at=(to:HangedManPlaceId,c:HangedManCommand,actions=1):HangedManCommand=>f.location===to?c:b.actions<actions+1?{type:'NEXT_WEEK'}:{type:'TRAVEL',to};
 if(b.status!=='ACTIVE')return null;
 if(scene.playerPosition==='ORIGINAL_ENTRY')return {type:'LEAVE_ORIGINAL_COURT'};
 if(hangedManInsideCase(root))return desiredHangedManSceneCommand(scene,hangedManHost(root,'preview',root.source!.revision+2+root.journal.length));
 if(b.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null))return b.actions<1?{type:'NEXT_WEEK'}:b.cash>=60?{type:'CLINIC'}:f.finance.wagePaidWeek!==b.week?{type:'WORK'}:{type:'NEXT_WEEK'};
 if(b.health<80||b.mind<78||b.spirituality<42||b.injuries.length||b.pollution>0)return b.actions?{type:'REST'}:{type:'NEXT_WEEK'};
 if(b.sequence===0){
  if(scene.returnReportEventId)return null;
  if(f.location!==HANGED_MAN_HOME)return {type:'RETURN_ON_FOOT'};
  if(scene.phase==='PREPARATION'&&b.actions<Math.min(3,f.finance.weeklyBudget))return {type:'NEXT_WEEK'};
  return desiredHangedManSceneCommand(scene,hangedManHost(root,'preview',root.source!.revision+2+root.journal.length));
 }
 if(!scene.evacuationReportEventId){if(f.location!==HANGED_MAN_HOME)return at(HANGED_MAN_HOME,{type:'ASK_OWNER'});return desiredHangedManSceneCommand(scene,hangedManHost(root,'preview',root.source!.revision+2+root.journal.length));}
 const failed=m.compounds.find(p=>p.status==='FAILED_EXPOSED'||p.status==='FAILED_SEALED');
 if(failed){if(failed.status==='FAILED_SEALED'&&(b.week<=failed.sealedWeek!||f.nowSecond<failed.sealedSecond!+604800))return f.finance.wagePaidWeek!==b.week&&b.actions>0?{type:'WORK'}:{type:'NEXT_WEEK'};return at(failed.location,{type:failed.status==='FAILED_EXPOSED'?'SEAL_REMAINS':'RECOVER_REMAINS',compoundId:failed.id});}
 const original=m.originals.find(x=>!['EMBODIED','FUSED','COMPOUND','PLAYER'].includes(x.holder));
 if(original){
  if(original.holder==='SEALED_REMNANT'&&(b.week<=original.sealedWeek!||f.nowSecond<original.sealedSecond!+604800))return f.finance.wagePaidWeek!==b.week&&b.actions>0?{type:'WORK'}:{type:'NEXT_WEEK'};
  const type=original.permissionWeek!==b.week?'ASK_RECOVERY_PERMISSION':original.holder==='UNLOCATED_REMNANT'?'INVESTIGATE_REMAINS':original.holder==='LOCATED'?'SEAL_ORIGINAL':'RECOVER_ORIGINAL';
  return at(HANGED_MAN_RECOVERY,{type,originalId:original.originalId});
 }
 if(m.uniqueness.holder==='CUSTODIAN')return at(HANGED_MAN_VAULT,{type:m.uniqueness.verifiedEventId?'ACQUIRE_UNIQUENESS':'VERIFY_UNIQUENESS'});
 const p=m.compounds.find(x=>x.status==='PREPARED');
 if(p){if(b.week-root.source!.acquisition.promotionWeek<12)return f.finance.wagePaidWeek!==b.week&&b.actions?{type:'WORK'}:{type:'NEXT_WEEK'};const preview=getHangedManPromotionStabilityPreview(root,p.id);return at(HANGED_MAN_WORKSHOP,{type:preview.prepared?'CONSUME':'STABILIZE_PROMOTION',compoundId:p.id,...(preview.prepared?{confirmed:true as const}:{})}as HangedManCommand,preview.prepared?1:2);}
 if(m.carriers.some(x=>x.status==='PLAYER'))return at(HANGED_MAN_WORKSHOP,{type:'COMPOSE'});
 if(m.carriers.some(x=>x.status==='SUPPLIER'))return at(HANGED_MAN_WORKSHOP,b.actions<1?{type:'NEXT_WEEK'}:{type:'BUY_CARRIER'});
 return null;
}
const positionName=(position:string):string=>({ORIGINAL_ENTRY:'原院入口',OUTSIDE:'所在场地外',ENTRY:'短廊口',MIDPOINT:'短廊中段',GATE:'封闩处'}[position]??'当前实际位置');
function projection(s:SliceState,head:HangedManOwnedEngine|null):HangedManProjection {
 const root=head?snapshotHangedManOwnedEngine(head):s.hangedMan,f=root.frame,b=f?.budget??hangedManBudget(s),promoted=s.progression.pathwayId==='hanged-man'&&b.sequence===0&&root.promotionWeek!==null;
 const definitions=s.progression.pathwayId==='hanged-man'?[...DARK_ANGEL_INHERITED_ABILITIES,...DARK_ANGEL_ABILITIES,...(promoted?HANGED_MAN_ABILITIES:[])]:[];
 const result:HangedManProjection={title:'序列0 倒吊人',guidanceKnown:root.guidanceKnown,promoted,story:HANGED_MAN_STORY,nextStep:HANGED_MAN_GOAL,risk:HANGED_MAN_RISK,resources:{health:b.health,maxHealth:100,mind:b.mind,maxMind:100,spirituality:b.spirituality,maxSpirituality:promoted?150:120,cash:`${b.cash}便士`,actionsRemaining:b.actions,weeklyBudget:f?.finance.weeklyBudget??s.weeklyBudget},injuries:b.injuries.map(x=>({id:x.id,severity:x.severity,treated:x.treatedRevision!==null})),injuryRisk:b.injuryRisk,abilities:definitions.filter(x=>Object.hasOwn(b.mastery,x.id)).map(x=>({id:x.id,label:x.label,description:x.description,mastery:b.mastery[x.id]??0})),actions:[],sections:[],insideCase:hangedManInsideCase(root)};
 const add=(command:HangedManCommand,label:string,cost:string)=>{const reason=publicReason(head?blockHangedManOwnedEngine(head,command,s.revision+1):hangedManCommandBlock(s,command));result.actions.push({id:`hangedMan:${result.actions.length}:${command.type}`,label,cost,command:clone(command),enabled:reason===null,reason});};
 if(!root.guidanceKnown){add({type:'LEARN_GUIDANCE'},'听取泄压廊与三份原特性指导','1行动、100便士');result.actions[0]!.preferredAction=true;return result;}
 const scene=root.scene!,place=HANGED_MAN_PLACES.find(x=>x.id===f!.location)?.title??'当前实际地点';
 result.sections.push({id:'clock',title:'实际日期与所在地',lines:[`${place}；第${b.week}周，${b.date.year}年${b.date.month}月${b.date.day}日。`,`成为暗天使已有${b.week-root.source!.acquisition.promotionWeek}个实际周，满十二周才可服药。距下一周界${Math.ceil((f!.weekAnchor+604800-f!.nowSecond)/3600)}小时。`]});
 result.sections.push({id:'scene',title:scene.phase==='PREPARATION'?'短廊检查与实际撤离':'隔离装置的有限实践',lines:[`本人在${positionName(scene.playerPosition)}，本章实际步行${scene.playerTravelMetres}米。原院玛拉仍在院外；本短廊由42岁的值守者伊文在廊外负责。`,...scene.workers.map(w=>`${w.name}，${w.age}岁，在${positionName(w.position)}，健康${w.health}、精力${w.energy}；${w.consent==='GRANTED'?'本次同意有效':'当前没有作业同意'}。`),`两段通路各三米：前段${scene.segments.A.open?'开启':'关闭'}，后段${scene.segments.B.open?'开启':'关闭'}。`,`侧门${scene.exit.door==='OPEN'?'打开':'关闭'}；普通绞盘${scene.exit.winch==='READY'?'已检查可用':scene.exit.winch==='LOCKED'?'已锁定支撑':'尚未检查'}。`,`本次局部装置${scene.device.inspectedEventId?'已检查':'尚未检查'}，压力${scene.device.sourcePressure}，${scene.device.braced?'有实购支撑':'尚未支撑'}。原院封存残压与旧封具没有搬来或补充。`,`新封条：可用${scene.seals.filter(x=>x.status==='BLANK'&&x.charges===1).length}张，已贴${scene.seals.filter(x=>x.status==='APPLIED').length}张，用尽${scene.seals.filter(x=>x.status==='SPENT').length}张。`,scene.window?`本次短窗剩余${Math.max(0,scene.window.expiresAt-f!.nowSecond)}秒；离位、撤回或到期均会结束，已付费用不返还。`:'当前没有能力短窗。']});
 result.sections.push({id:'spirits',title:'实际原灵与原有能力',lines:Object.values(scene.spirits).map(x=>`${x.name}：灵性${x.spirituality}，完整度${x.integrity}，${x.status==='GRAZED'?'仍被放牧':x.status==='RELEASED'?'已经释放':x.status==='DISSIPATED'?'已经消散':'封存中'}，${x.location==='INTERNAL'?'内收': '当前不在体内'}；仅能使用此前实际选定的能力。`)});
 result.sections.push({id:'materials',title:'三份原特性与同一唯一性',lines:projectHangedManMaterials(root.materials!)});
 result.sections.push({id:'body',title:'同一本人、原人物与旧物',lines:[`${s.character.name}，${s.character.age}岁；健康${b.health}、精神${b.mind}、灵性${b.spirituality}/${promoted?150:120}、污染${b.pollution}；当前意志${b.coreStats.will}。`,'原卡、旧封条、蔷薇储备和原院封存装置继续保留真实位置与消耗。原灵不会因晋升补满，也不会新增放牧容量。','旧掌握逐值保留；新技巧只有实际承担本次压力或贴上同一张付费封条后才增长。']});
 result.sections.push({id:'finance',title:'实际工作与生活账目',lines:[`现款${b.cash}便士；原职业每周工资${root.source!.character.weeklyWage}便士，须实际花1行动工作才入账。`,`每周${f!.finance.weeklyBudget}行动，尚欠本金${f!.finance.debts.reduce((n,x)=>n+x.remaining,0)}便士。普通周结不发工资、不治伤、不补回原件。`]});
 result.sections.push({id:'injuries',title:'当前实际伤势',lines:b.injuries.length?b.injuries.map(i=>`${i.severity==='HEAVY'?'重伤':'轻伤'}：${i.treatedRevision===null?'尚未处置':'已处置，仍须之后休养'}。`):['当前没有实际伤势。']});
 result.sections.push({id:'return',title:'报告与普通退路',lines:[scene.evacuationReportEventId?'两段通路和两位成人的实际撤离已经完成报告。':'先检查两段和侧门，分别征得同意、付本班工钱，让两位成人真实走出。',scene.returnReportEventId?`本次实践已完成报告，${(!scene.device.testEventId||!scene.device.sealedEventId)?'保留中止与已付费用':'装置已经普通收束，本人实际退出'}。`:'任何时候都可停止短窗、松开接触，并使用已检查的支撑、绞盘和侧门。',scene.pressureApplied?'本人已经实际承担一次局部压力。':'本次有限承压尚未实际应用。',scene.cooperativeSealApplied?'原灵协作已实际用于同一张封条。':'本次原灵协作尚未实际应用；普通贴封仍可选择。']});
 const latest=root.journal.at(-1);result.sections.push({id:'recent-action',title:'最近行动与实际费用',lines:latest?[...latest.notes,...latest.financeReceipts.map(x=>x.text),...latest.randomReceipts.map(x=>`本次实际检定：成功率${x.check.chance}%，掷出${x.check.roll}，${x.check.tier==='SUCCESS'?'成功':x.check.tier==='GREAT_SUCCESS'?'大成功':x.check.tier==='FAILURE'?'失败':'严重失败'}。`),`现款变化${latest.after.budget.cash-latest.before.budget.cash}便士；行动变化${latest.after.budget.actions-latest.before.budget.actions}。`]:['已实付1行动与100便士听取指导。']});
 for(const x of hangedManSceneActions(scene,hangedManHost(root,'preview',s.revision+1)))add(x.command,x.label,x.cost);
 for(const x of hangedManMaterialActions(root))add(x.command,x.label,x.cost);
 for(const p of root.materials!.compounds.filter(x=>x.status==='PREPARED')){const preview=getHangedManPromotionStabilityPreview(root,p.id);result.sections.push({id:'promotion-stability',title:'本瓶本次准备与风险',lines:[`当前实际意志${b.coreStats.will}，这瓶现时成功率${preview.chance}%；实付本次稳定准备后为${preview.preparedChance}%。`,preview.prepared?'本瓶准备有效，服药时只用一次。':'准备须1行动、150便士、12灵性、8精神与一小时，并保留本周服药行动。',preview.reason??'可按当前真实条件准备。']});add({type:'STABILIZE_PROMOTION',compoundId:p.id},'实付完成本瓶本次稳定准备','1行动、150便士、12灵性、8精神；保留服药行动');add({type:'CONSUME',compoundId:p.id,confirmed:true},`独立确认饮用同一成药（${preview.chance}%）`,'1行动、30灵性；失败可能重伤或死亡');}
 for(const p of HANGED_MAN_PLACES)if([HANGED_MAN_HOME,HANGED_MAN_RECOVERY,HANGED_MAN_VAULT,HANGED_MAN_WORKSHOP].includes(p.id)&&p.id!==f!.location)add({type:'TRAVEL',to:p.id},`沿普通道路前往${p.title}`,'1行动、半小时');
 add({type:'RETURN_ON_FOOT'},'沿普通道路返回短压廊外','0行动、两小时');add({type:'WORK'},'完成本周原职业工作','1行动、八小时');add({type:'REST'},'按实际生活档休养','1行动、八小时');add({type:'CLINIC'},'普通处置当前重伤','1行动、60便士、一小时');add({type:'NEXT_WEEK'},'走到下一真实周界','照常结算生活与还款');
 const wanted=desiredCommand(root);let preferred=wanted?result.actions.find(a=>sameHangedMan(a.command,wanted)&&a.enabled):null;
 if(!preferred&&wanted&&!hangedManInsideCase(root)&&b.status==='ACTIVE'){
  const needActions=wanted.type==='STABILIZE_PROMOTION'?2:1;
  if(b.actions<needActions)preferred=result.actions.find(a=>a.command.type==='NEXT_WEEK'&&a.enabled);
  else if(f!.finance.wagePaidWeek!==b.week)preferred=result.actions.find(a=>a.command.type==='WORK'&&a.enabled);
  else preferred=result.actions.find(a=>a.command.type==='NEXT_WEEK'&&a.enabled);
 }
 if(preferred)preferred.preferredAction=true;
 return result;
}
