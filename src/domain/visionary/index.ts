import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { VisionaryCommand, VisionaryProjection, VisionaryState } from './types.js';
import { createVisionaryState, startVisionary, sameVisionary, visionaryDigest, validateVisionaryCommand,
  openVisionaryOwnedEngine, snapshotVisionaryOwnedEngine, advanceVisionaryOwnedEngine, blockVisionaryOwnedEngine,
  getVisionaryPromotionStabilityPreview, getVisionaryEpilogueCheckPreview, visionaryHost, type VisionaryOwnedEngine } from './engine.js';
import { visionaryBudget, visionaryHistoryDigest, visionaryAcquisitionSnapshot, visionarySourceBlock, validateVisionarySource } from './source.js';
import { VISIONARY_ABILITIES, VISIONARY_STORY, VISIONARY_GOAL, VISIONARY_RISK, VISIONARY_CITY_PLACES, VISIONARY_HOME,
  VISIONARY_GUIDANCE } from './content.js';
import { projectVisionaryEra, getVisionaryEraActions } from './era.js';
import { VISIONARY_ERA_CITIES, VISIONARY_ERA_LOCATIONS } from './era-content.js';
import { getVisionaryMaterialActions, projectVisionaryMaterials } from './materials.js';
import { WRITER_ABILITIES, WRITER_INHERITED_ABILITIES } from '../writer/content.js';
export { createVisionaryState, validateVisionaryCommand } from './engine.js';
export { visionarySourceView } from './source.js';
export type { VisionaryOwnedEngine } from './engine.js';
export type { VisionaryCommand, VisionaryState, VisionaryProjection } from './types.js';
const clone=<T>(v:T):T=>structuredClone(v);
function assertCurrent(s:SliceState,root:VisionaryState):void {
  const source=root.source,frame=root.frame;
  if(!source||!frame||s.progression.pathwayId!=='audience'||!sameVisionary(visionaryBudget(s),frame.budget)||!sameVisionary(s.random,frame.random))throw Error('当前身体、资源与原动作记录不一致。');
  if(s.revision!==source.revision+1+root.journal.length)throw Error('当前动作次序不一致。');
  const {coreStats:_current,...identity}=s.character,{coreStats:_source,...originalIdentity}=source.character;
  if(!sameVisionary(identity,originalIdentity)||Object.entries(frame.finance).some(([key,value])=>!sameVisionary(s[key as keyof SliceState],value)))throw Error('当前身份或实际生活账本不一致。');
  if(source.historyDigest!==visionaryHistoryDigest(s)||source.originalWorldDigest!==visionaryDigest(s.world)||s.combatHistory.length!==source.combatHistoryLength||
    source.combatHistoryDigest!==visionaryDigest(s.combatHistory)||!sameVisionary(source.acquisition,visionaryAcquisitionSnapshot(s)))throw Error('旧人物、原物或原瓶履历被改写。');
  if(s.combat!==null||s.activeEvent!==null||s.eventQueue.length!==0||s.pulse!=='NONE')throw Error('本章不能同时开启旧现场。');
  if((frame.budget.sequence===0)!==(root.promotionWeek!==null))throw Error('当前晋升与实际服药记录不一致。');
}
function guidanceBlock(s:SliceState):string|null {
  if(!sameVisionary(s.visionary,createVisionaryState()))return '已有本章记录，不能重新开始或补发原物。';
  const reason=visionarySourceBlock(s);if(reason)return reason;
  return s.actionsRemaining<VISIONARY_GUIDANCE.actions||s.cash<VISIONARY_GUIDANCE.cash?'听取实际指导需要1行动与100便士，可先按原生活工作与休养。':null;
}
function publicReason(reason:string|null):string|null {
  if(reason===null)return null;
  return /[\u3400-\u9fff]/.test(reason)&&!/[A-Z_]{6,}|seed|cursor|digest|receipt/i.test(reason)?reason:'当前原件、实际所在地或前一步条件尚不满足。';
}
export function validateVisionaryState(s:SliceState):boolean {try{
  if(sameVisionary(s.visionary,createVisionaryState()))return s.progression.pathwayId!=='audience'||s.progression.sequence!==0;
  const head=openVisionaryOwnedEngine(s);assertCurrent(s,snapshotVisionaryOwnedEngine(head));return true;
}catch{return false;}}
export function hasVisionaryHistory(s:SliceState):boolean {try{return s.visionary.guidanceKnown&&s.visionary.source!==null&&s.progression.pathwayId==='audience'&&validateVisionarySource(s,s.visionary.source);}catch{return false;}}
export function hasVisionaryLock(s:SliceState):boolean{return hasVisionaryHistory(s);}
export function openVisionaryOwnedHead(s:SliceState):VisionaryOwnedEngine {const h=openVisionaryOwnedEngine(s);assertCurrent(s,snapshotVisionaryOwnedEngine(h));return h;}
export function assertOwnedVisionaryCurrent(s:SliceState,head:VisionaryOwnedEngine):void {
  const root=snapshotVisionaryOwnedEngine(head);if(!sameVisionary(root,s.visionary))throw Error('当前会话与实际存档版本不一致。');assertCurrent(s,root);
}
export function visionaryCommandBlock(s:SliceState,c:VisionaryCommand):string|null {
  if(!validateVisionaryCommand(c))return '这项行动的内容无效。';if(s.status!=='ACTIVE')return '已经死亡或结束的角色不能继续行动。';
  if(c.type==='LEARN_GUIDANCE')return guidanceBlock(s);
  try{return publicReason(blockVisionaryOwnedEngine(openVisionaryOwnedHead(s),c,s.revision+1));}catch{return '当前记录未通过核验，不能继续行动。';}
}
export function ownedVisionaryCommandBlock(s:SliceState,c:VisionaryCommand,head:VisionaryOwnedEngine):string|null {
  if(!validateVisionaryCommand(c))return '这项行动的内容无效。';if(s.status!=='ACTIVE')return '已经死亡或结束的角色不能继续行动。';
  if(c.type==='LEARN_GUIDANCE')return '已有本章记录，不能重新开始或补发原物。';
  try{assertOwnedVisionaryCurrent(s,head);return publicReason(blockVisionaryOwnedEngine(head,c,s.revision+1));}catch{return '当前记录未通过核验，不能继续行动。';}
}
function publish(s:SliceState,c:VisionaryCommand,root:VisionaryState,ctx:SeerContext):void {
  const b=root.frame!.budget;s.visionary=clone(root);
  s.week=b.week;s.date=clone(b.date);s.actionsRemaining=b.actions;s.cash=b.cash;s.health=b.health;s.mind=b.mind;s.spirituality=b.spirituality;s.status=b.status;
  s.injuries=clone(b.injuries);s.injuryRisk=b.injuryRisk;s.progression.sequence=b.sequence;s.progression.acting=b.acting;s.progression.mastery={...b.mastery};s.character.coreStats={...b.coreStats};
  s.seer.pollution=b.pollution;s.seer.completedSources=[...b.completedSources];s.random={...root.frame!.random};Object.assign(s,clone(root.frame!.finance));
  const event=c.type==='LEARN_GUIDANCE'?null:root.journal.at(-1)!;s.lastCheck=event?.randomReceipts.length?clone(event.randomReceipts.at(-1)!.check):null;
  if(!event)ctx.note('公共救援制度指导','已支付100便士与1行动核对原活身份、三份作家特性和完整历史。旧人物、原物、现有身体与欠款继续保留；四方六城的未来事务从此真实推进。');
  else{for(const r of event.financeReceipts)ctx.note(r.title,r.text);ctx.note(b.sequence===0?'空想家当前行动':'四方公共救援当前行动',event.notes.join(''));}
}
export function applyVisionaryCommand(s:SliceState,c:VisionaryCommand,ctx:SeerContext):void {
  if(!validateVisionaryCommand(c)||s.status!=='ACTIVE')throw Error('当前不能执行这项行动。');let root:VisionaryState;
  if(c.type==='LEARN_GUIDANCE'){const reason=guidanceBlock(s);if(reason)throw Error(reason);root=startVisionary(s);}
  else root=snapshotVisionaryOwnedEngine(advanceVisionaryOwnedEngine(openVisionaryOwnedHead(s),c,s.revision+1));publish(s,c,root,ctx);
}
export function applyOwnedVisionaryCommand(s:SliceState,c:VisionaryCommand,ctx:SeerContext,head:VisionaryOwnedEngine):VisionaryOwnedEngine {
  assertOwnedVisionaryCurrent(s,head);if(!validateVisionaryCommand(c)||c.type==='LEARN_GUIDANCE'||s.status!=='ACTIVE')throw Error('当前不能执行这项行动。');
  const next=advanceVisionaryOwnedEngine(head,c,s.revision+1);publish(s,c,snapshotVisionaryOwnedEngine(next),ctx);return next;
}
export function projectVisionary(s:SliceState):VisionaryProjection {
  if(sameVisionary(s.visionary,createVisionaryState()))return projection(s,null);
  return projection(s,openVisionaryOwnedHead(s));
}
export function projectOwnedVisionary(s:SliceState,head:VisionaryOwnedEngine):VisionaryProjection {assertOwnedVisionaryCurrent(s,head);return projection(s,head);}
function projection(s:SliceState,head:VisionaryOwnedEngine|null):VisionaryProjection {
  const root=head?snapshotVisionaryOwnedEngine(head):s.visionary,f=root.frame,b=f?.budget??visionaryBudget(s),promoted=s.progression.pathwayId==='audience'&&b.sequence===0&&root.promotionWeek!==null;
  const result:VisionaryProjection={title:'序列0 空想家',guidanceKnown:root.guidanceKnown,promoted,story:VISIONARY_STORY,nextStep:VISIONARY_GOAL,risk:VISIONARY_RISK,
    resources:{health:b.health,mind:b.mind,spirituality:b.spirituality,cash:`${b.cash}便士`,actionsRemaining:b.actions},
    abilities:(s.progression.pathwayId==='audience'?[...WRITER_INHERITED_ABILITIES,...WRITER_ABILITIES,...(promoted?VISIONARY_ABILITIES:[])].filter(a=>Object.hasOwn(b.mastery,a.id)):[]).map(a=>({...a,mastery:b.mastery[a.id]??0})),actions:[],sections:[],insideCase:root.epilogue?.status==='ACTIVE'};
  const add=(c:VisionaryCommand,label:string,cost:string,preferredAction=false)=>{
    const reason=publicReason(head?blockVisionaryOwnedEngine(head,c,s.revision+1):visionaryCommandBlock(s,c));
    result.actions.push({id:`visionary:${result.actions.length}:${c.type}`,label,cost,command:clone(c),enabled:reason===null,reason,...(preferredAction?{preferredAction:true}:{})});
  };
  if(!root.guidanceKnown){add({type:'LEARN_GUIDANCE'},'听取四方公共救援与原特性指导','1行动、100便士',true);return result;}
  const h=visionaryHost(root,`R210:${root.source!.runId}:${s.revision+1}`,s.revision+1),era=projectVisionaryEra(root.era!);
  result.story=`${era.story}这是一段从第${root.source!.budget.week}周开始、到第四次预定季度节点结束的四方六城未来事务；既往事实不能补写。`;
  result.nextStep=era.nextStep;
  const localPlace=VISIONARY_CITY_PLACES.find(p=>p.id===f!.location)?.title;
  const regionalPlace=VISIONARY_ERA_CITIES.find(c=>VISIONARY_ERA_LOCATIONS[c.id]===f!.location);
  result.sections.push({id:'era',title:'四方六城的真实时代事务',lines:[`当前位置：${localPlace??(regionalPlace?`${regionalPlace.name}公共联络站`:'原现场')}；当前第${b.week}周。`,...era.lines]});
  const materials=projectVisionaryMaterials(root.materials!);
  const holder:Record<string,string>={EMBODIED:'已融入本人',SUPPLIER:'仍在原供应处',CUSTODIAN:'原保管人封存',PLAYER:'本人持有',COMPOUND:'在同批原成药中',EXPOSED:'实际残留，尚未封存',SEALED:'已实际封存',LOST:'脱离本人控制',FUSED:'已在本人体内融合',UNLOCATED:'旧失败原物去向待调查',LEGACY_RESIDUE:'当代调查已辨识原残余，尚未封存',LEGACY_SEALED:'同一旧残余已于本次实际封存'};
  result.sections.push({id:'materials',title:'三份原特性与独立唯一性',lines:['须实际取得同一唯一性、除本人已融入一份之外的另两份原作家特性，并完成当前时代的真实关键节点。普通调配包只提供一次承载与封存耗材。',`第${materials.conservation.embodiedOriginalBottle.split('-').at(-1)}号原瓶的特性已融入本人；其余原件按当前真实去向取得，不能重复领取。`,
    ...materials.characteristics.map((c,i)=>`第${i+1}份原作家特性：${holder[c.holder]??'原账待核'}，已作${c.inheritedLabourSteps+c.labour.length}/5项原物劳动。`),
    `同一独立唯一性：${holder[materials.uniqueness.holder]??'原账待核'}。须亲自核验旧保管人、仓库回收单和当代空缺，再由现保管人交付同一原件。`,
    ...materials.batches.map(c=>`${c.label}：${c.status==='SUPPLIER'?'仍在原供应处':c.status==='PLAYER'?'本人持有':c.status==='IN_COMPOUND'?'在同批成药中':c.status==='REPAIR_ORDERED'?'已付费订购补充物，等待隔周领取':'本次普通药液已用尽'}。`),
    materials.recoveryNotice]});
  result.sections.push({id:'finance',title:'原职业、生活费与旧账',lines:[`本人现款${b.cash}便士；原职业每周工资${root.source!.character.weeklyWage}便士，只能实际工作领取一次。`,
    `未付本金${f!.finance.debts.reduce((n,d)=>n+d.remaining,0)}便士；下次约定还款${f!.finance.debts.reduce((n,d)=>n+Math.min(d.remaining,d.weeklyPayment),0)}便士。`,
    '跨城、步行与等待每周仍结原生活费和旧还款；不足的生活费如实计欠，次周转赤贫。外地不能远程领取原职业工资。',
    '若两份原特性都还在供应方，各完成五项劳务后，原物、普通药液与稳定准备合计约4300便士；已付费用、本人持有与回收残余按实际原账另算。还须预留交通与外地生活费。材料劳动可穿插在每周工作之后；时代节点不会因筹资暂停。']});
  result.sections.push({id:'injuries',title:'当前实际身体',lines:[`健康${b.health}，精神${b.mind}，灵性${b.spirituality}/120，污染${b.pollution}；伤势风险${b.injuryRisk}。`,
    ...(b.injuries.length?b.injuries.map(i=>`${i.severity==='HEAVY'?'重伤':'轻伤'}：${i.treatedRevision===null?'尚未处置':'已作普通处置，仍须之后休养'}。`):['当前没有实际伤势。']),
    '重伤须在城市支付60便士、1行动普通处置，再经之后实际休养达到80健康。']});
  const latest=root.journal.at(-1);
  result.sections.push({id:'recent-action',title:'最近实际行动与检定',lines:latest?[...latest.notes,...latest.randomReceipts.map(r=>`已发生检定：成功率${r.check.chance}%，实际掷出${r.check.roll}，${r.check.tier==='SUCCESS'?'成功':r.check.tier==='GREAT_SUCCESS'?'大成功':r.check.tier==='FAILURE'?'失败':'严重失败'}。`),
    `行动后健康${latest.after.budget.health}、精神${latest.after.budget.mind}、灵性${latest.after.budget.spirituality}、现款${latest.after.budget.cash}便士、剩余行动${latest.after.budget.actions}。`]:['已支付100便士与1行动听取指导，原三瓶与旧历史只读继承。']});
  if(root.epilogue){
    const ep=root.epilogue;result.story=ep.journal.at(-1)?.summary??'此前已登记的廷根原失联站正在等待本人观察。';
    result.sections.unshift({id:'epilogue',title:'原失联站的有限救援',lines:[`原成年救援人员${ep.rescuerIds.length}名；已转运${ep.patients.filter(p=>p.status==='EVACUATED').length}/2名原伤员；原结构损坏${ep.routeDamage}。`,
      '原支梁、担架和接线箱始终是同一批原物。临时支撑不会成为库存，救出者仍保留原伤。',...ep.patients.map(p=>`${p.injury}：${p.status==='EVACUATED'?'已搬到原安全站':'仍在原遮蔽救护区'}。`)]});
    if(ep.status==='ACTIVE'){
      result.nextStep='先观察，再选择有限支撑、待行引导或普通搬运；随时可零行动沿原侧道撤出。';
      add({type:'EPILOGUE',command:{type:'OBSERVE'}},'观察原结构、原队员与普通出口','0行动；实际观察五分钟',!ep.observed);
      add({type:'EPILOGUE',command:{type:'SUPPORT_STRUCTURE'}},'有限空想支撑原支梁','1行动、12灵性、10精神；本场仅一次');
      add({type:'EPILOGUE',command:{type:'GUIDE_RESCUER'}},'引导本已愿意救援的原队员','1行动、10灵性、8精神；下一待行窗口仅一次');
      add({type:'EPILOGUE',command:{type:'EVACUATE'}},'用原担架沿普通侧道搬运','1行动；普通搬运一名，有效有限支撑或引导可搬两名',ep.observed);
      add({type:'EPILOGUE',command:{type:'WITHDRAW'}},'沿原安全侧道普通撤离','0行动，不退费用，原伤与未完成救援保留');
      const preview=getVisionaryEpilogueCheckPreview(root,'SUPPORT_STRUCTURE')!;
      result.sections.push({id:'epilogue-readiness',title:'有限技巧与普通退路',lines:[`两项有限技巧当前各${preview.chance}%成功率，成功和失败都真实付费；每项只能实际施用一次。`,
        `当前${b.actions}行动，须为普通搬运留1行动。两项技巧都失败仍可普通搬运或零行动撤出，不能等待补满灵性或重开人物。`,
        '引导只对眼前有既存救援意愿的一名成年队员有效；另一人的抵抗与遮挡明确保留。支撑至多两次现场行动，引导至多下一次待行动，搬运或离场即终止。']});return result;
    }
    result.nextStep=ep.reported?'本次有限救援与实际报告已交接，全部后果保留。':'交接实际伤员、原物损坏与失败结果。';
    if(!ep.reported)add({type:'EPILOGUE',command:{type:'REPORT'}},'报告原站实际救援结果','0行动；只记录真实应用与结果',true);
  }
  for(const a of getVisionaryEraActions(root.era!,h)){
    if(promoted&&a.command.type!=='ERA_TRAVEL')continue;
    const e=a.cost;add({type:'ERA',command:a.command},a.label,`${e.actions}行动、${e.cashCost}便士${e.weeks?`、实际${e.weeks}周，另结生活和还款`:''}`,a.enabled&&a.command.type!=='ERA_TRAVEL');
  }
  for(const p of VISIONARY_CITY_PLACES)if(p.id!==f!.location)add({type:'TRAVEL',to:p.id},`沿城市道路前往${p.title}`,'1行动、10便士');
  if(f!.location!==VISIONARY_HOME)add({type:'RETURN_ON_FOOT'},'沿普通道路步行返贝克兰德','1行动，无预付车费；外地实际2至6周，照实结生活与旧还款',b.cash<20);
  if(!promoted){
    for(const a of getVisionaryMaterialActions(root.materials!,h))add({type:'MATERIAL',command:a.command},a.label,a.cost,a.enabled);
    const lines:string[]=[];
    for(const c of root.materials!.compounds.filter(c=>c.status==='PREPARED')){
      const p=getVisionaryPromotionStabilityPreview(root,c.id);
      lines.push(`这份原成药当前成功率${p.chance}%；完成真实稳定准备后${p.preparedChance}%。${p.prepared?'当前准备仍有效。':'尚无本瓶本窗口有效准备。'}`,
        '稳定准备实付100便士、1行动、12灵性与8精神；仅对本瓶在本季度窗口的下一次服药有效，离室、过期、换瓶或实际服用即不再沿用。',
        p.window?`实际窗口为第${p.window.startWeek}—${p.window.endWeek}周；须在此期间于原调配室服用。`:'目前没有已实际核证且仍开放的季度服药窗口。');
      add({type:'STABILIZE_PROMOTION',compoundId:c.id},'为本瓶本季度完成付费稳定准备','1行动、100便士、12灵性、8精神',p.eligible);
      add({type:'CONSUME',compoundId:c.id,confirmed:true},'确认风险并饮用本瓶原成药','1行动、30灵性；失败可能重伤、污染或死亡',p.prepared);
    }
    if(lines.length)result.sections.push({id:'promotion-stability',title:'本瓶原成药的真实风险与准备',lines});
  }else if(!root.epilogue){result.nextStep='亲自沿普通路线前往廷根原失联站，处理此前已登记的一宗有限救援。';add({type:'START_EPILOGUE'},'进入廷根原失联站现场','0行动；实际步行入场十分钟，不补资源',true);}
  add({type:'WORK'},'做本周原职业工作',`1行动；${root.source!.character.weeklyWage}便士，每周一次`,b.cash<150);
  add({type:'CLINIC'},'支付普通重伤处置','1行动、60便士；之后仍须休养',b.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null));
  add({type:'REST'},'按实际生活档休养','1行动；不免费去除未处置重伤',b.health<80||b.mind<78||b.spirituality<60);
  add({type:'NEXT_WEEK'},'度过真实七天','放弃本周余下行动，实际支付生活费与旧约还款',b.actions===0);
  return result;
}
