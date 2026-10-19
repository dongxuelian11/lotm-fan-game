import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { WheelOfFortuneState, WheelOfFortuneCommand, WheelOfFortuneProjection, WheelOfFortunePlaceId } from './types.js';
import { createWheelOfFortuneState,startWheelOfFortune,sameWheelOfFortune,wheelOfFortuneDigest,validateWheelOfFortuneCommand,openWheelOfFortuneOwnedEngine,snapshotWheelOfFortuneOwnedEngine,advanceWheelOfFortuneOwnedEngine,blockWheelOfFortuneOwnedEngine,getWheelOfFortunePromotionStabilityPreview,wheelOfFortuneInsideCase,wheelOfFortuneHost,type WheelOfFortuneOwnedEngine } from './engine.js';
import { wheelOfFortuneBudget,wheelOfFortuneHistoryDigest,wheelOfFortuneAcquisitionSnapshot,wheelOfFortuneSourceBlock } from './source.js';
import { WHEEL_OF_FORTUNE_ABILITIES,WHEEL_OF_FORTUNE_STORY,WHEEL_OF_FORTUNE_GOAL,WHEEL_OF_FORTUNE_RISK,WHEEL_OF_FORTUNE_PLACES,WHEEL_OF_FORTUNE_PRACTICE_COSTS,WHEEL_OF_FORTUNE_GUIDANCE } from './content.js';
import { MERCURY_SNAKE_ABILITIES,MERCURY_SNAKE_INHERITED_ABILITIES } from '../mercury-snake/content.js';
import { wheelOfFortuneSceneActions,desiredWheelOfFortuneSceneCommand,wheelOfFortuneCurrentCommission } from './scene.js';
import { wheelOfFortuneMaterialActions,projectWheelOfFortuneMaterials,WHEEL_OF_FORTUNE_HOME,WHEEL_OF_FORTUNE_RECOVERY,WHEEL_OF_FORTUNE_VAULT,WHEEL_OF_FORTUNE_WORKSHOP,wheelOfFortuneOriginalRemainingPrice } from './materials.js';
export { createWheelOfFortuneState,validateWheelOfFortuneCommand,getWheelOfFortunePromotionStabilityPreview } from './engine.js';
export { wheelOfFortuneSourceView, wheelOfFortuneSourceView as getWheelOfFortuneSourceView } from './source.js';
export type { WheelOfFortuneOwnedEngine } from './engine.js';
export type { WheelOfFortuneState,WheelOfFortuneCommand,WheelOfFortuneProjection } from './types.js';
const clone=<T>(value:T):T=>structuredClone(value);
function assertCurrent(s:SliceState,root:WheelOfFortuneState):void {
 const source=root.source,f=root.frame;
 if(!source||!f||s.progression.pathwayId!=='wheel'||!sameWheelOfFortune(wheelOfFortuneBudget(s),f.budget)||!sameWheelOfFortune(s.random,f.random)||s.revision!==source.revision+1+root.journal.length)throw Error('当前身体、资源与实际行动次序不一致。');
 const {coreStats:_current,...identity}=s.character,{coreStats:_source,...originalIdentity}=source.character;
 if(!sameWheelOfFortune(identity,originalIdentity)||Object.entries(f.finance).some(([key,value])=>!sameWheelOfFortune(s[key as keyof SliceState],value)))throw Error('当前身份或实际生活账本不一致。');
 if(source.historyDigest!==wheelOfFortuneHistoryDigest(s)||source.originalWorldDigest!==wheelOfFortuneDigest(s.world)||s.combatHistory.length!==source.combatHistoryLength||source.combatHistoryDigest!==wheelOfFortuneDigest(s.combatHistory)||!sameWheelOfFortune(source.acquisition,wheelOfFortuneAcquisitionSnapshot(s)))throw Error('旧人物、原物或原瓶履历被改写。');
 if(s.combat!==null||s.activeEvent!==null||s.eventQueue.length||s.pulse!=='NONE'||((f.budget.sequence===0)!==(root.promotionWeek!==null)))throw Error('当前现场或晋升与实际记录不一致。');
}
function guidanceBlock(s:SliceState):string|null {
 if(!sameWheelOfFortune(s.wheelOfFortune,createWheelOfFortuneState()))return '已有本章记录，不能重新开始或补发原物。';
 const reason=wheelOfFortuneSourceBlock(s);if(reason)return reason;
 return s.actionsRemaining<1||s.cash<WHEEL_OF_FORTUNE_GUIDANCE.cash?'指导需要1行动与20便士，可以先正常工作与休养。':null;
}
function publicReason(reason:string|null):string|null{return reason===null?null:/[\u3400-\u9fff]/.test(reason)&&!/[A-Z_]{6,}|seed|cursor|digest|receipt/i.test(reason)?reason:'当前原件、实际所在地或前一步条件尚未满足。';}
export function validateWheelOfFortuneState(s:SliceState):boolean {
 try {if(sameWheelOfFortune(s.wheelOfFortune,createWheelOfFortuneState()))return s.progression.pathwayId!=='wheel'||s.progression.sequence!==0;const head=openWheelOfFortuneOwnedEngine(s);assertCurrent(s,snapshotWheelOfFortuneOwnedEngine(head));return true;}catch{return false;}
}
/** Historical membership authenticates the entire new journal, never a
 * source-shaped object. The owned runtime caches this only after strict open. */
export function hasWheelOfFortuneHistory(s:SliceState):boolean{return !!s.wheelOfFortune?.guidanceKnown&&s.wheelOfFortune.source!==null&&s.progression.pathwayId==='wheel'&&validateWheelOfFortuneState(s);}
export const isWheelOfFortune=(s:SliceState):boolean=>s.progression.pathwayId==='wheel'&&s.progression.sequence===0;
export function hasWheelOfFortuneLock(s:SliceState):boolean{return hasWheelOfFortuneHistory(s);}
export function openWheelOfFortuneOwnedHead(s:SliceState):WheelOfFortuneOwnedEngine{const h=openWheelOfFortuneOwnedEngine(s);assertCurrent(s,snapshotWheelOfFortuneOwnedEngine(h));return h;}
export function assertOwnedWheelOfFortuneCurrent(s:SliceState,head:WheelOfFortuneOwnedEngine):void{const root=snapshotWheelOfFortuneOwnedEngine(head);if(!sameWheelOfFortune(root,s.wheelOfFortune))throw Error('当前会话与实际存档版本不一致。');assertCurrent(s,root);}
export function wheelOfFortuneCommandBlock(s:SliceState,c:WheelOfFortuneCommand):string|null {
 if(!validateWheelOfFortuneCommand(c))return '这项行动内容无效。';if(s.status!=='ACTIVE')return '已经死亡或结束的角色不能继续行动。';if(c.type==='LEARN_GUIDANCE')return guidanceBlock(s);
 try{return publicReason(blockWheelOfFortuneOwnedEngine(openWheelOfFortuneOwnedHead(s),c,s.revision+1));}catch{return '当前记录未通过核验，不能继续行动。';}
}
export function ownedWheelOfFortuneCommandBlock(s:SliceState,c:WheelOfFortuneCommand,head:WheelOfFortuneOwnedEngine):string|null {
 if(!validateWheelOfFortuneCommand(c)||c.type==='LEARN_GUIDANCE')return '这项行动无效或已经听取指导。';if(s.status!=='ACTIVE')return '已经死亡或结束的角色不能继续行动。';
 try{assertOwnedWheelOfFortuneCurrent(s,head);return publicReason(blockWheelOfFortuneOwnedEngine(head,c,s.revision+1));}catch{return '当前记录未通过核验，不能继续行动。';}
}
function publish(s:SliceState,c:WheelOfFortuneCommand,root:WheelOfFortuneState,ctx:SeerContext):void {
 const b=root.frame!.budget;s.wheelOfFortune=clone(root);s.week=b.week;s.date=clone(b.date);s.actionsRemaining=b.actions;s.cash=b.cash;s.health=b.health;s.mind=b.mind;s.spirituality=b.spirituality;s.status=b.status;s.injuries=clone(b.injuries);s.injuryRisk=b.injuryRisk;s.progression.sequence=b.sequence;s.progression.acting=b.acting;s.progression.mastery={...b.mastery};s.character.coreStats={...b.coreStats};s.seer.pollution=b.pollution;s.seer.completedSources=[...b.completedSources];s.random={...root.frame!.random};Object.assign(s,clone(root.frame!.finance));
 const event=c.type==='LEARN_GUIDANCE'?null:root.journal.at(-1)!;s.lastCheck=event?.randomReceipts.length?clone(event.randomReceipts.at(-1)!.check):null;
 if(!event)ctx.note('听取岔路与命运之轮指导','实付1行动与20便士，核对本人、三份原特性及同一工坊真实终点。原车包盘袋签、旧幸运账、奥斯温投降与双方旧伤保留；实际完成本周工作和休养，再沿原门亲走四米退出。准确契机不能预先锁定，只能排除干扰，在经历与寻觅中察觉。');
 else{for(const receipt of event.financeReceipts)ctx.note(receipt.title,receipt.text);ctx.note(b.sequence===0?'命运之轮的实际行动':'岔路与原件交接',event.notes.join(''));}
}
export function applyWheelOfFortuneCommand(s:SliceState,c:WheelOfFortuneCommand,ctx:SeerContext):void {
 if(!validateWheelOfFortuneCommand(c)||s.status!=='ACTIVE')throw Error('当前不能执行这项行动。');let root:WheelOfFortuneState;
 if(c.type==='LEARN_GUIDANCE'){const reason=guidanceBlock(s);if(reason)throw Error(reason);root=startWheelOfFortune(s);}else root=snapshotWheelOfFortuneOwnedEngine(advanceWheelOfFortuneOwnedEngine(openWheelOfFortuneOwnedHead(s),c,s.revision+1));publish(s,c,root,ctx);
}
export function applyOwnedWheelOfFortuneCommand(s:SliceState,c:WheelOfFortuneCommand,ctx:SeerContext,head:WheelOfFortuneOwnedEngine):WheelOfFortuneOwnedEngine {
 assertOwnedWheelOfFortuneCurrent(s,head);if(!validateWheelOfFortuneCommand(c)||c.type==='LEARN_GUIDANCE'||s.status!=='ACTIVE')throw Error('当前不能执行这项行动。');const next=advanceWheelOfFortuneOwnedEngine(head,c,s.revision+1);publish(s,c,snapshotWheelOfFortuneOwnedEngine(next),ctx);return next;
}
export function projectWheelOfFortune(s:SliceState):WheelOfFortuneProjection{return projection(s,sameWheelOfFortune(s.wheelOfFortune,createWheelOfFortuneState())?null:openWheelOfFortuneOwnedHead(s));}
export function projectOwnedWheelOfFortune(s:SliceState,h:WheelOfFortuneOwnedEngine):WheelOfFortuneProjection{assertOwnedWheelOfFortuneCurrent(s,h);return projection(s,h);}
/** A recommendation is a normal action. It never rolls or predicts an outcome. */
export function desiredWheelOfFortuneCommand(root:WheelOfFortuneState):WheelOfFortuneCommand|null {
 const f=root.frame!,b=f.budget,scene=root.scene!,m=root.materials!,commission=wheelOfFortuneCurrentCommission(scene);
 const earn=():WheelOfFortuneCommand=>b.actions>0&&f.finance.wagePaidWeek!==b.week?{type:'WORK'}:{type:'NEXT_WEEK'};
 const at=(to:WheelOfFortunePlaceId,c:WheelOfFortuneCommand,actions=1):WheelOfFortuneCommand=>f.location===to?(b.actions<actions?earn():c):to===WHEEL_OF_FORTUNE_HOME?{type:'RETURN_ON_FOOT'}:b.actions<actions+1?earn():{type:'TRAVEL',to};
 const sceneNext=()=>desiredWheelOfFortuneSceneCommand(scene,wheelOfFortuneHost(root,'preview',root.source!.revision+2+root.journal.length));
 if(b.status!=='ACTIVE'||scene.returnReportEventId)return null;
 if(scene.playerPosition==='ORIGINAL_ENTRY'){
  if(!root.journal.some(e=>e.command.type==='WORK')&&f.finance.wagePaidWeek!==b.week)return b.actions?{type:'WORK'}:{type:'NEXT_WEEK'};
  if(!root.journal.some(e=>e.command.type==='REST'))return b.actions?{type:'REST'}:{type:'NEXT_WEEK'};
  return {type:'LEAVE_ORIGINAL_COURT'};
 }
 if(wheelOfFortuneInsideCase(root))return sceneNext();
 if(b.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null))return b.actions<1?{type:'NEXT_WEEK'}:b.cash>=60?{type:'CLINIC'}:earn();
 if(b.health<80||b.mind<78||b.spirituality<42||b.injuries.length||b.pollution>0){if(b.actions>0&&b.cash<200&&f.finance.wagePaidWeek!==b.week)return {type:'WORK'};return b.actions?{type:'REST'}:{type:'NEXT_WEEK'};}
 if(b.sequence===0){if(f.location!==WHEEL_OF_FORTUNE_HOME)return {type:'RETURN_ON_FOOT'};if(scene.phase==='PREPARATION'&&b.actions<Math.min(3,f.finance.weeklyBudget))return earn();return sceneNext();}
 const failed=m.compounds.find(p=>p.status==='FAILED_EXPOSED'||p.status==='FAILED_SEALED');
 if(failed){if(failed.status==='FAILED_SEALED'&&(b.week<=failed.sealedWeek!||f.nowSecond<failed.sealedSecond!+604800))return earn();if(failed.status==='FAILED_SEALED'&&b.cash<60)return earn();return at(failed.location,{type:failed.status==='FAILED_EXPOSED'?'SEAL_REMAINS':'RECOVER_REMAINS',compoundId:failed.id});}
 if(commission.reportEventId&&(commission.consumedEventId||commission.opportunityWeek!==b.week))return at(WHEEL_OF_FORTUNE_HOME,{type:'NEXT_COMMISSION'},0);
 if(!scene.exit.inspectedEventId||!commission.papersVerifiedEventId||!scene.toolsBoughtEventId){if(!scene.toolsBoughtEventId&&b.cash<30)return earn();return f.location===WHEEL_OF_FORTUNE_HOME?sceneNext():at(WHEEL_OF_FORTUNE_HOME,{type:'INSPECT_EXIT'},0);}
 // Preserve a real weekly wage opportunity during the finite material route.
 if(b.cash<1800&&b.actions>0&&f.finance.wagePaidWeek!==b.week)return {type:'WORK'};
 const original=m.originals.find(x=>!['EMBODIED','FUSED','COMPOUND','PLAYER'].includes(x.holder));
 if(original){
  if(original.holder==='SUPPLIER'&&original.labourSteps<5)return at(WHEEL_OF_FORTUNE_RECOVERY,{type:'WORK_ORIGINAL',originalId:original.originalId});
  if(original.holder==='SEALED_REMNANT'&&(b.week<=original.sealedWeek!||f.nowSecond<original.sealedSecond!+604800))return earn();
  const cash=original.holder==='SUPPLIER'?wheelOfFortuneOriginalRemainingPrice(original.labourSteps):original.holder==='UNLOCATED_REMNANT'?120:original.holder==='SEALED_REMNANT'?30:0;
  if(b.cash<cash)return earn();
  const type=original.permissionWeek!==b.week?'ASK_RECOVERY_PERMISSION':original.holder==='UNLOCATED_REMNANT'?'INVESTIGATE_REMAINS':original.holder==='LOCATED'?'SEAL_ORIGINAL':'RECOVER_ORIGINAL';
  return at(WHEEL_OF_FORTUNE_RECOVERY,{type,originalId:original.originalId},original.holder==='SUPPLIER'?0:1);
 }
 if(m.uniqueness.holder==='CUSTODIAN'){if(b.cash<(m.uniqueness.verifiedEventId?150:100))return earn();return at(WHEEL_OF_FORTUNE_VAULT,{type:m.uniqueness.verifiedEventId?'ACQUIRE_UNIQUENESS':'VERIFY_UNIQUENESS'});}
 const p=m.compounds.find(x=>x.status==='PREPARED');
 if(p){
  if(b.week-root.source!.acquisition.promotionWeek<12)return earn();
  if(f.location!==WHEEL_OF_FORTUNE_HOME)return {type:'RETURN_ON_FOOT'};
  if(commission.reportEventId&&commission.opportunityWeek===b.week&&!commission.consumedEventId)return {type:'CONSUME',compoundId:p.id,confirmed:true};
  const preview=getWheelOfFortunePromotionStabilityPreview(root,p.id);
  if(!preview.prepared){if(b.cash<190||b.actions<2)return earn();return {type:'STABILIZE_PROMOTION',compoundId:p.id};}
  return sceneNext();
 }
 if(m.carriers.some(x=>x.status==='PLAYER'))return b.cash<40?earn():at(WHEEL_OF_FORTUNE_WORKSHOP,{type:'COMPOSE'});
 if(m.carriers.some(x=>x.status==='SUPPLIER'))return b.cash<50?earn():at(WHEEL_OF_FORTUNE_WORKSHOP,{type:'BUY_CARRIER'},1);
 return null;
}
const positionName=(p:string):string=>({ORIGINAL_ENTRY:'原工坊门口',OUTSIDE:'站外',ENTRY:'交接台',THREE:'三米侧路处',NORTH_DEPOT:'北侧新址',SOUTH_DEPOT:'南侧新址'}[p]??'实际所在地');
function projection(s:SliceState,head:WheelOfFortuneOwnedEngine|null):WheelOfFortuneProjection {
 const root=head?snapshotWheelOfFortuneOwnedEngine(head):s.wheelOfFortune,f=root.frame,b=f?.budget??wheelOfFortuneBudget(s),promoted=s.progression.pathwayId==='wheel'&&b.sequence===0&&root.promotionWeek!==null;
 const definitions=s.progression.pathwayId==='wheel'?[...MERCURY_SNAKE_INHERITED_ABILITIES,...MERCURY_SNAKE_ABILITIES,...(promoted?WHEEL_OF_FORTUNE_ABILITIES:[])]:[];
 const result:WheelOfFortuneProjection={title:'序列0 命运之轮',guidanceKnown:root.guidanceKnown,promoted,story:WHEEL_OF_FORTUNE_STORY,nextStep:WHEEL_OF_FORTUNE_GOAL,risk:WHEEL_OF_FORTUNE_RISK,resources:{health:b.health,maxHealth:100,mind:b.mind,maxMind:100,spirituality:b.spirituality,maxSpirituality:promoted?150:120,cash:`${b.cash}便士`,actionsRemaining:b.actions,weeklyBudget:f?.finance.weeklyBudget??s.weeklyBudget},injuries:b.injuries.map(x=>({id:x.id,severity:x.severity,treated:x.treatedRevision!==null})),injuryRisk:b.injuryRisk,abilities:definitions.filter(x=>Object.hasOwn(b.mastery,x.id)).map(x=>({id:x.id,label:x.label,description:x.description,mastery:b.mastery[x.id]??0})),actions:[],sections:[],insideCase:wheelOfFortuneInsideCase(root)};
 const add=(command:WheelOfFortuneCommand,label:string,cost:string)=>{const reason=publicReason(head?blockWheelOfFortuneOwnedEngine(head,command,s.revision+1):wheelOfFortuneCommandBlock(s,command));result.actions.push({id:`wheel-of-fortune:${result.actions.length}:${command.type}`,label,cost,command:clone(command),enabled:reason===null,reason});};
 if(!root.guidanceKnown){add({type:'LEARN_GUIDANCE'},'听取岔路与三份原特性指导','1行动、20便士');if(result.actions[0]!.enabled)result.actions[0]!.preferredAction=true;return result;}
 const scene=root.scene!,commission=wheelOfFortuneCurrentCommission(scene),place=WHEEL_OF_FORTUNE_PLACES.find(x=>x.id===f!.location)?.title??'实际所在地';
 result.sections.push({id:'clock',title:'实际日期与所在地',lines:[`${place}；第${b.week}周，${b.date.year}年${b.date.month}月${b.date.day}日。`,`成为水银之蛇已有${b.week-root.source!.acquisition.promotionWeek}个实际周，满十二周才可服药。距下一周界${Math.ceil((f!.weekAnchor+604800-f!.nowSecond)/3600)}小时。`]});
 result.sections.push({id:'scene',title:scene.phase==='PREPARATION'?'原凭证与两项独立决定':'本人两项有限应用',lines:[`本人在${positionName(scene.playerPosition)}，累计实际移动${scene.playerTravelMetres}米，原场地既有路程继续保留。`,`当前委托：${commission.title}。${commission.papersVerifiedEventId?'原凭证已逐件核对':'原凭证尚须亲自核对'}；${scene.exit.inspectedEventId?'普通支撑与侧路已实际查明':'尚须检查普通支撑与侧路'}。`,`同一套普通绳索${scene.toolsBoughtEventId?'已实购':'尚未领取'}，站门${scene.exit.door==='OPEN'?'开启':'关闭'}；普通街边侧路始终可供实际退出。`,...commission.workers.map(w=>`${w.name}，${w.age}岁；${w.purpose}。当前在${positionName(w.position)}，健康${w.health}、精力${w.energy}，实际步行${w.walkedMetres}米。${w.decisionEventId?`已亲自选定${positionName(w.destination!)}，决定保留`:'尚未作出最后决定'}；${w.handoverEventId?'同一原凭证与货物已亲手交接':'原凭证与货物仍未交接'}。`),scene.window?`当前本人短窗剩余${Math.max(0,scene.window.expiresAt-f!.nowSecond)}秒；到期、撤回或目标变化即停止，成本不退。`:'当前没有能力短窗。']});
 result.sections.push({id:'commission-history',title:'已经发生的变化',lines:scene.commissions.filter(c=>c.papersVerifiedEventId||c.reportEventId).flatMap(c=>[`${c.title}：${c.reportEventId?`第${c.opportunityWeek}周实际察觉汇合${c.consumedEventId?'，已经尝试服药':c.opportunityWeek===b.week?'，当前仍在该周':'，当周已过'}`:'尚未察觉本次契机'}。`,...c.workers.filter(w=>w.decisionEventId).map(w=>`${w.name}已决定去${positionName(w.destination!)}，${w.handoverEventId?'原物已实际交接':'交接未完成'}，${w.destinationEventId?'已真实到新去处':'还未走到新去处'}。`)] )});
 result.sections.push({id:'materials',title:'同一三份原特性与唯一性',lines:projectWheelOfFortuneMaterials(root.materials!)});
 const luck=root.source!.originals.luck;
 result.sections.push({id:'body',title:'同一本人、原人物与旧物',lines:[`${s.character.name}，${s.character.age}岁；健康${b.health}、精神${b.mind}、灵性${b.spirituality}/${promoted?150:120}、污染${b.pollution}；当前意志${b.coreStats.will}、感知${b.coreStats.perception}。`,`原幸运储备${luck.stored}、累计积运${luck.accumulated}、已耗${luck.spent}；旧账不会在本章补充。`,'艾妲与薇拉仍在原工坊外；原车和400克密封包、原盘指针、袋与两签及旧预测均保持真实旧终点。',`原工坊敌手奥斯温${s.mercurySnake.encounter.enemyStatus==='SURRENDERED'?'已投降':s.mercurySnake.encounter.enemyStatus==='DEAD'?'已死亡':'保留原有状态'}，其旧伤及原连接片余量${s.mercurySnake.encounter.piece?.charges??0}不复位；全部旧掌握逐值保留。`,...(promoted?[`本人冲击缓冲成功率${computeCheckChance({baseAbility:b.coreStats.perception,difficulty:WHEEL_OF_FORTUNE_PRACTICE_COSTS.impactBuffer.difficulty,modifiers:[]})}%；本人短距回返成功率${computeCheckChance({baseAbility:b.coreStats.will,difficulty:WHEEL_OF_FORTUNE_PRACTICE_COSTS.shortReturn.difficulty,modifiers:[]})}%。只在实际应用时检定。`]:[])]});
 if(promoted)result.sections.push({id:'finite-tools',title:'原箱件与本人短前态',lines:[`同一箱件${scene.load.releasedEventId?`已经真实下放${scene.load.dropCentimetres}厘米`:'仍在释放前的原位置'}；原绳完整度${scene.rope.integrity}、磨损${scene.rope.wear}。`,`本人${scene.returnWalkEventId?'已经实际走出过三米':'尚未走出三米'}；${scene.device.returnFinishedEventId?'已实际返回入口':'返回尚未发生'}。只改变本人位置，不回退伤势、资源、费用、时间或物件。`,scene.returnReportEventId?'本轮已如实报告，保留全部实际结果。':'普通绳索、支撑与步行退路始终可用；技巧失败或停止仍能报告。']});
 result.sections.push({id:'finance',title:'实际工作与生活账目',lines:[`现款${b.cash}便士；原职业周工资${root.source!.character.weeklyWage}便士，须实付1行动工作才入账。`,`每周${f!.finance.weeklyBudget}行动，尚欠本金${f!.finance.debts.reduce((n,x)=>n+x.remaining,0)}便士。普通周结不发工资、不治伤、不补原物。`]});
 const latest=root.journal.at(-1);result.sections.push({id:'latest',title:'最近实际行动',lines:latest?[...latest.notes,...latest.financeReceipts.map(x=>x.text),...latest.randomReceipts.map(x=>`本次实际检定：成功率${x.check.chance}%，掷出${x.check.roll}，${x.check.tier==='SUCCESS'?'成功':x.check.tier==='GREAT_SUCCESS'?'大成功':x.check.tier==='FAILURE'?'失败':'严重失败'}。`),`现款变化${latest.after.budget.cash-latest.before.budget.cash}便士；行动变化${latest.after.budget.actions-latest.before.budget.actions}。`]:['已实付1行动与20便士听取指导。']});
 for(const x of wheelOfFortuneSceneActions(scene,wheelOfFortuneHost(root,'preview',s.revision+1)))add(x.command,x.label,x.cost);
 for(const x of wheelOfFortuneMaterialActions(root))add(x.command,x.label,x.cost);
 for(const p of root.materials!.compounds.filter(x=>x.status==='PREPARED')){const preview=getWheelOfFortunePromotionStabilityPreview(root,p.id);result.sections.push({id:'promotion-stability',title:'本瓶本次准备与风险',lines:[`当前实际意志${b.coreStats.will}，本瓶现时成功率${preview.chance}%；实付稳定准备后为${preview.preparedChance}%。`,preview.prepared?'本次准备有效；准确契机仍须实际经历后才能察觉。':'最后交接之前，可实付1行动、150便士、12灵性、8精神与一小时准备本瓶，保留本周服药行动。',preview.reason??'当前可以为同一成药做准备。']});add({type:'STABILIZE_PROMOTION',compoundId:p.id},'最后交接前实付准备本瓶','1行动、150便士、12灵性、8精神；保留服药行动');add({type:'CONSUME',compoundId:p.id,confirmed:true},`独立确认饮用同一成药（${preview.chance}%）`,'1行动、30灵性；只可用于已亲历的当周契机，失败可能死亡');}
 for(const p of WHEEL_OF_FORTUNE_PLACES)if([WHEEL_OF_FORTUNE_HOME,WHEEL_OF_FORTUNE_RECOVERY,WHEEL_OF_FORTUNE_VAULT,WHEEL_OF_FORTUNE_WORKSHOP].includes(p.id)&&p.id!==f!.location)add({type:'TRAVEL',to:p.id},`沿普通道路前往${p.title}`,'1行动、半小时');
 add({type:'RETURN_ON_FOOT'},'沿普通道路返回交接站外','0行动、两小时');add({type:'WORK'},'实际完成本周原职业工作','1行动、八小时');add({type:'REST'},'按实际生活档休养','1行动、八小时');add({type:'CLINIC'},'普通处置当前重伤','1行动、60便士、一小时');add({type:'NEXT_WEEK'},'走到下一真实周界','照常结算生活与还款');
 const wanted=desiredWheelOfFortuneCommand(root);let preferred=wanted?result.actions.find(a=>sameWheelOfFortune(a.command,wanted)&&a.enabled):null;
 if(!preferred&&wanted&&!wheelOfFortuneInsideCase(root)&&b.status==='ACTIVE'){
  const needActions=wanted.type==='STABILIZE_PROMOTION'?2:1;
  if(b.actions<needActions)preferred=result.actions.find(a=>a.command.type==='NEXT_WEEK'&&a.enabled);
  else if(f!.finance.wagePaidWeek!==b.week)preferred=result.actions.find(a=>a.command.type==='WORK'&&a.enabled);
  else preferred=result.actions.find(a=>a.command.type==='NEXT_WEEK'&&a.enabled);
 }
 if(preferred){preferred.preferredAction=true;result.nextStep=`下一步：${preferred.label}。${preferred.cost}。`;}
 if(scene.returnReportEventId)result.nextStep='本轮已如实报告，全部实际结果保留。';
 return result;
}
