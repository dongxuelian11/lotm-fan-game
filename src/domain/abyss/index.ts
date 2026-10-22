import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { AbyssState, AbyssCommand, AbyssProjection, AbyssPlaceId } from './types.js';
import { createAbyssState,startAbyss,sameAbyss,abyssDigest,validateAbyssCommand,openAbyssOwnedEngine,snapshotAbyssOwnedEngine,advanceAbyssOwnedEngine,blockAbyssOwnedEngine,getAbyssPromotionStabilityPreview,abyssInsideCase,abyssHost,type AbyssOwnedEngine } from './engine.js';
import { abyssBudget,abyssHistoryDigest,abyssAcquisitionSnapshot,abyssSourceBlock } from './source.js';
import { ABYSS_ABILITIES,ABYSS_STORY,ABYSS_GOAL,ABYSS_RISK,ABYSS_PLACES,ABYSS_PRACTICE_COSTS } from './content.js';
import { UNCLEAN_MONARCH_ABILITIES,UNCLEAN_MONARCH_INHERITED_ABILITIES } from '../unclean-monarch/content.js';
import { abyssSceneActions,desiredAbyssSceneCommand } from './scene.js';
import { abyssMaterialActions,projectAbyssMaterials,ABYSS_HOME,ABYSS_RECOVERY,ABYSS_VAULT,ABYSS_WORKSHOP,abyssOriginalRemainingPrice } from './materials.js';
export { createAbyssState,validateAbyssCommand,getAbyssPromotionStabilityPreview } from './engine.js';
export { abyssSourceView, abyssSourceView as getAbyssSourceView } from './source.js';
export type { AbyssOwnedEngine } from './engine.js';
export type { AbyssState,AbyssCommand,AbyssProjection } from './types.js';
const clone=<T>(value:T):T=>structuredClone(value);
function assertCurrent(s:SliceState,root:AbyssState):void {
 const source=root.source,f=root.frame;
 if(!source||!f||s.progression.pathwayId!=='abyss'||!sameAbyss(abyssBudget(s),f.budget)||!sameAbyss(s.random,f.random)||s.revision!==source.revision+1+root.journal.length)throw Error('当前身体、资源与实际行动次序不一致。');
 const {coreStats:_current,...identity}=s.character,{coreStats:_source,...originalIdentity}=source.character;
 if(!sameAbyss(identity,originalIdentity)||Object.entries(f.finance).some(([key,value])=>!sameAbyss(s[key as keyof SliceState],value)))throw Error('当前身份或实际生活账本不一致。');
 if(source.historyDigest!==abyssHistoryDigest(s)||source.originalWorldDigest!==abyssDigest(s.world)||s.combatHistory.length!==source.combatHistoryLength||source.combatHistoryDigest!==abyssDigest(s.combatHistory)||!sameAbyss(source.acquisition,abyssAcquisitionSnapshot(s)))throw Error('旧人物、原物或原瓶履历被改写。');
 if(s.combat!==null||s.activeEvent!==null||s.eventQueue.length||s.pulse!=='NONE'||((f.budget.sequence===0)!==(root.promotionWeek!==null)))throw Error('当前现场或晋升与实际记录不一致。');
}
function guidanceBlock(s:SliceState):string|null {
 if(!sameAbyss(s.abyss,createAbyssState()))return '已有本章记录，不能重新开始或补发原物。';
 const reason=abyssSourceBlock(s);if(reason)return reason;
 return s.actionsRemaining<1||s.cash<100?'指导需要1行动与100便士，可以先正常工作与休养。':null;
}
function publicReason(reason:string|null):string|null{return reason===null?null:/[\u3400-\u9fff]/.test(reason)&&!/[A-Z_]{6,}|seed|cursor|digest|receipt/i.test(reason)?reason:'当前原件、实际所在地或前一步条件尚未满足。';}
export function validateAbyssState(s:SliceState):boolean {
 try {if(sameAbyss(s.abyss,createAbyssState()))return s.progression.pathwayId!=='abyss'||s.progression.sequence!==0;const head=openAbyssOwnedEngine(s);assertCurrent(s,snapshotAbyssOwnedEngine(head));return true;}catch{return false;}
}
/** Historical membership authenticates the entire new journal, never a
 * source-shaped object. The owned runtime caches this only after strict open. */
export function hasAbyssHistory(s:SliceState):boolean{return !!s.abyss?.guidanceKnown&&s.abyss.source!==null&&s.progression.pathwayId==='abyss'&&validateAbyssState(s);}
export const isAbyss=(s:SliceState):boolean=>s.progression.pathwayId==='abyss'&&s.progression.sequence===0;
export function hasAbyssLock(s:SliceState):boolean{return hasAbyssHistory(s);}
export function openAbyssOwnedHead(s:SliceState):AbyssOwnedEngine{const h=openAbyssOwnedEngine(s);assertCurrent(s,snapshotAbyssOwnedEngine(h));return h;}
export function assertOwnedAbyssCurrent(s:SliceState,head:AbyssOwnedEngine):void{const root=snapshotAbyssOwnedEngine(head);if(!sameAbyss(root,s.abyss))throw Error('当前会话与实际存档版本不一致。');assertCurrent(s,root);}
export function abyssCommandBlock(s:SliceState,c:AbyssCommand):string|null {
 if(!validateAbyssCommand(c))return '这项行动内容无效。';if(s.status!=='ACTIVE')return '已经死亡或结束的角色不能继续行动。';if(c.type==='LEARN_GUIDANCE')return guidanceBlock(s);
 try{return publicReason(blockAbyssOwnedEngine(openAbyssOwnedHead(s),c,s.revision+1));}catch{return '当前记录未通过核验，不能继续行动。';}
}
export function ownedAbyssCommandBlock(s:SliceState,c:AbyssCommand,head:AbyssOwnedEngine):string|null {
 if(!validateAbyssCommand(c)||c.type==='LEARN_GUIDANCE')return '这项行动无效或已经听取指导。';if(s.status!=='ACTIVE')return '已经死亡或结束的角色不能继续行动。';
 try{assertOwnedAbyssCurrent(s,head);return publicReason(blockAbyssOwnedEngine(head,c,s.revision+1));}catch{return '当前记录未通过核验，不能继续行动。';}
}
function publish(s:SliceState,c:AbyssCommand,root:AbyssState,ctx:SeerContext):void {
 const b=root.frame!.budget;s.abyss=clone(root);s.week=b.week;s.date=clone(b.date);s.actionsRemaining=b.actions;s.cash=b.cash;s.health=b.health;s.mind=b.mind;s.spirituality=b.spirituality;s.status=b.status;s.injuries=clone(b.injuries);s.injuryRisk=b.injuryRisk;s.progression.sequence=b.sequence;s.progression.acting=b.acting;s.progression.mastery={...b.mastery};s.character.coreStats={...b.coreStats};s.seer.pollution=b.pollution;s.seer.completedSources=[...b.completedSources];s.random={...root.frame!.random};Object.assign(s,clone(root.frame!.finance));
 const event=c.type==='LEARN_GUIDANCE'?null:root.journal.at(-1)!;s.lastCheck=event?.randomReceipts.length?clone(event.randomReceipts.at(-1)!.check):null;
 if(!event)ctx.note('听取货栈与深渊指导','实付1行动与100便士，核对本人、原三份特性与同一安静室的真实终点。原人物、卡铃纸、旧片和哈兰的结果继续保留；先沿原门亲走两米出去，再步行前往河岸货栈。');
 else{for(const receipt of event.financeReceipts)ctx.note(receipt.title,receipt.text);ctx.note(b.sequence===0?'深渊的实际行动':'货栈与原件交接',event.notes.join(''));}
}
export function applyAbyssCommand(s:SliceState,c:AbyssCommand,ctx:SeerContext):void {
 if(!validateAbyssCommand(c)||s.status!=='ACTIVE')throw Error('当前不能执行这项行动。');let root:AbyssState;
 if(c.type==='LEARN_GUIDANCE'){const reason=guidanceBlock(s);if(reason)throw Error(reason);root=startAbyss(s);}else root=snapshotAbyssOwnedEngine(advanceAbyssOwnedEngine(openAbyssOwnedHead(s),c,s.revision+1));publish(s,c,root,ctx);
}
export function applyOwnedAbyssCommand(s:SliceState,c:AbyssCommand,ctx:SeerContext,head:AbyssOwnedEngine):AbyssOwnedEngine {
 assertOwnedAbyssCurrent(s,head);if(!validateAbyssCommand(c)||c.type==='LEARN_GUIDANCE'||s.status!=='ACTIVE')throw Error('当前不能执行这项行动。');const next=advanceAbyssOwnedEngine(head,c,s.revision+1);publish(s,c,snapshotAbyssOwnedEngine(next),ctx);return next;
}
export function projectAbyss(s:SliceState):AbyssProjection{return projection(s,sameAbyss(s.abyss,createAbyssState())?null:openAbyssOwnedHead(s));}
export function projectOwnedAbyss(s:SliceState,h:AbyssOwnedEngine):AbyssProjection{assertOwnedAbyssCurrent(s,h);return projection(s,h);}
/** Recommendation is a normal public command, not a completion certificate. */
export function desiredAbyssCommand(root:AbyssState):AbyssCommand|null {
 const f=root.frame!,b=f.budget,scene=root.scene!,m=root.materials!;
 const earn=():AbyssCommand=>b.actions>0&&f.finance.wagePaidWeek!==b.week?{type:'WORK'}:{type:'NEXT_WEEK'};
 const at=(to:AbyssPlaceId,c:AbyssCommand,actions=1):AbyssCommand=>f.location===to?c:b.actions<actions+1?earn():{type:'TRAVEL',to};
 if(b.status!=='ACTIVE')return null;
 if(scene.playerPosition==='ORIGINAL_ENTRY')return {type:'LEAVE_ORIGINAL_COURT'};
 if(abyssInsideCase(root))return desiredAbyssSceneCommand(scene,abyssHost(root,'preview',root.source!.revision+2+root.journal.length));
 if(b.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null))return b.actions<1?{type:'NEXT_WEEK'}:b.cash>=60?{type:'CLINIC'}:earn();
 if(b.health<80||b.mind<78||b.spirituality<42||b.injuries.length||b.pollution>0)return b.actions?{type:'REST'}:{type:'NEXT_WEEK'};
 if(b.sequence===0){
  if(scene.returnReportEventId)return null;
  if(f.location!==ABYSS_HOME)return {type:'RETURN_ON_FOOT'};
  if(scene.phase==='PREPARATION'&&b.actions<Math.min(3,f.finance.weeklyBudget))return earn();
  return desiredAbyssSceneCommand(scene,abyssHost(root,'preview',root.source!.revision+2+root.journal.length));
 }
 if(!scene.evacuationReportEventId){if(f.location!==ABYSS_HOME)return at(ABYSS_HOME,{type:'ASK_OWNER'},1);return desiredAbyssSceneCommand(scene,abyssHost(root,'preview',root.source!.revision+2+root.journal.length));}
 // Preserve one real wage opportunity before spending the rest of a week's AP.
 if(b.cash<3000&&b.actions>0&&f.finance.wagePaidWeek!==b.week)return {type:'WORK'};
 const failed=m.compounds.find(p=>p.status==='FAILED_EXPOSED'||p.status==='FAILED_SEALED');
 if(failed){if(failed.status==='FAILED_SEALED'&&(b.week<=failed.sealedWeek!||f.nowSecond<failed.sealedSecond!+604800))return earn();if(failed.status==='FAILED_SEALED'&&b.cash<60)return earn();return at(failed.location,{type:failed.status==='FAILED_EXPOSED'?'SEAL_REMAINS':'RECOVER_REMAINS',compoundId:failed.id});}
 const original=m.originals.find(x=>!['EMBODIED','FUSED','COMPOUND','PLAYER'].includes(x.holder));
 if(original){
  if(original.holder==='SUPPLIER'&&original.labourSteps<5)return at(ABYSS_RECOVERY,{type:'WORK_ORIGINAL',originalId:original.originalId});
  if(original.holder==='SEALED_REMNANT'&&(b.week<=original.sealedWeek!||f.nowSecond<original.sealedSecond!+604800))return earn();
  const cash=original.holder==='SUPPLIER'?abyssOriginalRemainingPrice(original.labourSteps):original.holder==='UNLOCATED_REMNANT'?120:original.holder==='SEALED_REMNANT'?30:0;
  if(b.cash<cash)return earn();
  const type=original.permissionWeek!==b.week?'ASK_RECOVERY_PERMISSION':original.holder==='UNLOCATED_REMNANT'?'INVESTIGATE_REMAINS':original.holder==='LOCATED'?'SEAL_ORIGINAL':'RECOVER_ORIGINAL';
  return at(ABYSS_RECOVERY,{type,originalId:original.originalId},original.holder==='SUPPLIER'?0:1);
 }
 if(m.uniqueness.holder==='CUSTODIAN'){if(b.cash<(m.uniqueness.verifiedEventId?150:100))return earn();return at(ABYSS_VAULT,{type:m.uniqueness.verifiedEventId?'ACQUIRE_UNIQUENESS':'VERIFY_UNIQUENESS'});}
 const p=m.compounds.find(x=>x.status==='PREPARED');
 if(p){if(b.week-root.source!.acquisition.promotionWeek<12)return earn();const preview=getAbyssPromotionStabilityPreview(root,p.id);if(!preview.prepared&&b.cash<150)return earn();return at(ABYSS_WORKSHOP,{type:preview.prepared?'CONSUME':'STABILIZE_PROMOTION',compoundId:p.id,...(preview.prepared?{confirmed:true as const}:{})}as AbyssCommand,preview.prepared?1:2);}
 if(m.carriers.some(x=>x.status==='PLAYER'))return b.cash<40?earn():at(ABYSS_WORKSHOP,{type:'COMPOSE'});
 if(m.carriers.some(x=>x.status==='SUPPLIER'))return b.cash<50?earn():at(ABYSS_WORKSHOP,{type:'BUY_CARRIER'},1);
 return null;
}
const positionName=(position:string):string=>({ORIGINAL_ENTRY:'原室入口',OUTSIDE:'所在场地外',ENTRY:'货栈入口',MIDPOINT:'货栈中段',GATE:'检修台'}[position]??'当前实际位置');
function projection(s:SliceState,head:AbyssOwnedEngine|null):AbyssProjection {
 const root=head?snapshotAbyssOwnedEngine(head):s.abyss,f=root.frame,b=f?.budget??abyssBudget(s),promoted=s.progression.pathwayId==='abyss'&&b.sequence===0&&root.promotionWeek!==null;
 const definitions=s.progression.pathwayId==='abyss'?[...UNCLEAN_MONARCH_INHERITED_ABILITIES,...UNCLEAN_MONARCH_ABILITIES,...(promoted?ABYSS_ABILITIES:[])]:[];
 const result:AbyssProjection={title:'序列0 深渊',guidanceKnown:root.guidanceKnown,promoted,story:ABYSS_STORY,nextStep:ABYSS_GOAL,risk:ABYSS_RISK,resources:{health:b.health,maxHealth:100,mind:b.mind,maxMind:100,spirituality:b.spirituality,maxSpirituality:promoted?150:120,cash:`${b.cash}便士`,actionsRemaining:b.actions,weeklyBudget:f?.finance.weeklyBudget??s.weeklyBudget},injuries:b.injuries.map(x=>({id:x.id,severity:x.severity,treated:x.treatedRevision!==null})),injuryRisk:b.injuryRisk,abilities:definitions.filter(x=>Object.hasOwn(b.mastery,x.id)).map(x=>({id:x.id,label:x.label,description:x.description,mastery:b.mastery[x.id]??0})),actions:[],sections:[],insideCase:abyssInsideCase(root)};
 const add=(command:AbyssCommand,label:string,cost:string)=>{const reason=publicReason(head?blockAbyssOwnedEngine(head,command,s.revision+1):abyssCommandBlock(s,command));result.actions.push({id:`abyss:${result.actions.length}:${command.type}`,label,cost,command:clone(command),enabled:reason===null,reason});};
 if(!root.guidanceKnown){add({type:'LEARN_GUIDANCE'},'听取货栈与三份原特性指导','1行动、100便士');result.actions[0]!.preferredAction=true;return result;}
 const scene=root.scene!,place=ABYSS_PLACES.find(x=>x.id===f!.location)?.title??'当前实际地点';
 result.sections.push({id:'clock',title:'实际日期与所在地',lines:[`${place}；第${b.week}周，${b.date.year}年${b.date.month}月${b.date.day}日。`,`成为污秽君王已有${b.week-root.source!.acquisition.promotionWeek}个实际周，满十二周才可服药。距下一周界${Math.ceil((f!.weekAnchor+604800-f!.nowSecond)/3600)}小时。`]});
 result.sections.push({id:'scene',title:scene.phase==='PREPARATION'?'货栈两卡闸与实际搬运':'本人独立检修与短距搬运',lines:[`本人在${positionName(scene.playerPosition)}，累计实际步行${scene.playerTravelMetres}米（含原场地路程与本章普通道路）。本货栈由42岁的伊文在栈外负责。`,...scene.workers.map(w=>`${w.name}，${w.age}岁，在${positionName(w.position)}，健康${w.health}、精力${w.energy}，实际步行${w.walkedMetres}米；${w.consent==='GRANTED'?'本次同意有效':'当前没有作业同意'}。`),`两段通道各三米：前闸${scene.segments.A.open?'开启':'关闭'}，后闸${scene.segments.B.open?'开启':'关闭'}；普通侧门${scene.exit.door==='OPEN'?'开启':'关闭'}，${scene.exit.inspectedEventId?'各位置退路已实际查明':'尚未查明退路'}。`,`普通工具与绑带${scene.toolsBoughtEventId?'已经实购，同一套继续使用':'尚未购买'}。`,...(['A','B']as const).map(id=>{const p=scene.segments[id].pin;return `${id}闸同一原销：${p.position==='INSERTED'?'仍卡在原闸':p.position==='PLAYER'?'本人实持':'检修台存放'}，在${positionName(p.location)}，完整度${p.integrity}，磨损${p.wear}，已实际移动${p.travelMetres}米。`;}),scene.window?`本次短窗剩余${Math.max(0,scene.window.expiresAt-f!.nowSecond)}秒；移位、松手、撤回、目标变化或到期均结束，已付费用保留。`:'当前没有能力短窗。']});
 result.sections.push({id:'cargo',title:'同一货物的实际位置',lines:scene.cargo.map((c,i)=>`${i<2?scene.workers[i]!.name+'的原货物':'检修台原箱件'}：在${positionName(c.position)}，累计移动${c.travelMetres}米${c.carrierId==='PLAYER'?`，台面偏移${c.offsetMetres}米，${c.secured?'已普通固定':'尚未固定'}`:''}；${c.passage.a&&c.passage.b&&c.passage.exit?'已经两段通行并实际交货':c.movedEventId?'本次短距搬运已经发生':'没有以报告代替移动'}。`)});
 result.sections.push({id:'materials',title:'三份原特性与同一唯一性',lines:projectAbyssMaterials(root.materials!)});
 result.sections.push({id:'body',title:'同一本人、原人物与旧物',lines:[`${s.character.name}，${s.character.age}岁；健康${b.health}、精神${b.mind}、灵性${b.spirituality}/${promoted?150:120}、污染${b.pollution}；当前意志${b.coreStats.will}、感知${b.coreStats.perception}。`,`诺拉与罗安仍在原室外，原卡仍由诺拉保管；旧三片各自归原保管人，实际余量与磨损保留。原恶魔紧绷${scene.originalStrain}继续保留。`,`哈兰当前${s.uncleanMonarch.encounter.enemyStatus==='DEAD'?'已经死亡':s.uncleanMonarch.encounter.enemyStatus==='SURRENDERED'?'已经投降':'仍保留原有状态'}；既有战斗刻片余量${s.uncleanMonarch.encounter.piece?.charges??0}，不会因晋升补充。`,'全部旧掌握逐值保留；新技巧只有实际侵蚀成功或确实减轻本人这一次冲击后才增长。',...(promoted?[`本次有限接触侵蚀成功率${computeCheckChance({baseAbility:b.coreStats.will,difficulty:ABYSS_PRACTICE_COSTS.corrosion.difficulty,modifiers:[]})}%；短危险感应成功率${computeCheckChance({baseAbility:b.coreStats.perception,difficulty:ABYSS_PRACTICE_COSTS.dangerSense.difficulty,modifiers:[]})}%。实际应用时才掷数。`]:[])]});
 result.sections.push({id:'finance',title:'实际工作与生活账目',lines:[`现款${b.cash}便士；原职业每周工资${root.source!.character.weeklyWage}便士，须实际花1行动工作才入账。`,`每周${f!.finance.weeklyBudget}行动，尚欠本金${f!.finance.debts.reduce((n,x)=>n+x.remaining,0)}便士。普通周结不发工资、不治伤、不补回原件。`]});
 result.sections.push({id:'injuries',title:'当前实际伤势',lines:b.injuries.length?b.injuries.map(i=>`${i.severity==='HEAVY'?'重伤':'轻伤'}：${i.treatedRevision===null?'尚未处置':'已处置，仍须之后休养'}。`):['当前没有实际伤势。']});
 result.sections.push({id:'return',title:'报告与普通退路',lines:[scene.evacuationReportEventId?'两位成年人和各自货物已真实通过两段并普通退出、完成交接报告。':'先普通拆销、检查两段及侧路，再分别征求同意、付工钱并真实搬运退出。',scene.returnReportEventId?`本轮已经报告，${!scene.device.pinFinishedEventId||!scene.device.cargoFinishedEventId?'如实保留停止与已付成本':'同一原销拆检与原箱件搬运已经发生，本人实际退出'}。`:'可随时结束短窗，沿已检查的普通侧路从实际位置退出。',scene.corrosionApplied?'有限接触侵蚀已实际改变同一原销的完整度和磨损。':'本轮侵蚀尚未成功应用，普通工具可完成。',scene.dangerSenseApplied?'短危险感应已实际减轻本人一次已见箱件冲击。':'本轮感应尚未成功应用，普通绑带和夹具可完成。']});
 const latest=root.journal.at(-1);result.sections.push({id:'recent-action',title:'最近行动与实际费用',lines:latest?[...latest.notes,...latest.financeReceipts.map(x=>x.text),...latest.randomReceipts.map(x=>`本次实际检定：成功率${x.check.chance}%，掷出${x.check.roll}，${x.check.tier==='SUCCESS'?'成功':x.check.tier==='GREAT_SUCCESS'?'大成功':x.check.tier==='FAILURE'?'失败':'严重失败'}。`),`现款变化${latest.after.budget.cash-latest.before.budget.cash}便士；行动变化${latest.after.budget.actions-latest.before.budget.actions}。`]:['已实付1行动与100便士听取指导。']});
 for(const x of abyssSceneActions(scene,abyssHost(root,'preview',s.revision+1)))add(x.command,x.label,x.cost);
 for(const x of abyssMaterialActions(root))add(x.command,x.label,x.cost);
 for(const p of root.materials!.compounds.filter(x=>x.status==='PREPARED')){const preview=getAbyssPromotionStabilityPreview(root,p.id);result.sections.push({id:'promotion-stability',title:'本瓶本次准备与风险',lines:[`当前实际意志${b.coreStats.will}，这瓶现时成功率${preview.chance}%；实付本次稳定准备后为${preview.preparedChance}%。`,preview.prepared?'本瓶准备有效，服药时只用一次。':'准备须1行动、150便士、12灵性、8精神与一小时，并保留本周服药行动。',preview.reason??'可按当前真实条件准备。']});add({type:'STABILIZE_PROMOTION',compoundId:p.id},'实付完成本瓶本次稳定准备','1行动、150便士、12灵性、8精神；保留服药行动');add({type:'CONSUME',compoundId:p.id,confirmed:true},`独立确认饮用同一成药（${preview.chance}%）`,'1行动、30灵性；失败可能重伤或死亡');}
 for(const p of ABYSS_PLACES)if([ABYSS_HOME,ABYSS_RECOVERY,ABYSS_VAULT,ABYSS_WORKSHOP].includes(p.id)&&p.id!==f!.location)add({type:'TRAVEL',to:p.id},`沿普通道路前往${p.title}`,'1行动、半小时');
 add({type:'RETURN_ON_FOOT'},'沿普通道路返回货栈外','0行动、两小时');add({type:'WORK'},'完成本周原职业工作','1行动、八小时');add({type:'REST'},'按实际生活档休养','1行动、八小时');add({type:'CLINIC'},'普通处置当前重伤','1行动、60便士、一小时');add({type:'NEXT_WEEK'},'走到下一真实周界','照常结算生活与还款');
 const wanted=desiredAbyssCommand(root);let preferred=wanted?result.actions.find(a=>sameAbyss(a.command,wanted)&&a.enabled):null;
 if(!preferred&&wanted&&!abyssInsideCase(root)&&b.status==='ACTIVE'){
  const needActions=wanted.type==='STABILIZE_PROMOTION'?2:1;
  if(b.actions<needActions)preferred=result.actions.find(a=>a.command.type==='NEXT_WEEK'&&a.enabled);
  else if(f!.finance.wagePaidWeek!==b.week)preferred=result.actions.find(a=>a.command.type==='WORK'&&a.enabled);
  else preferred=result.actions.find(a=>a.command.type==='NEXT_WEEK'&&a.enabled);
 }
 if(preferred)preferred.preferredAction=true;
 return result;
}
