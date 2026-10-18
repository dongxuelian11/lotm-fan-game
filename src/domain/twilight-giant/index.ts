import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { TwilightGiantCommand, TwilightGiantProjection, TwilightGiantState } from './types.js';
import {
  createTwilightGiantState, startTwilightGiant, sameTwilightGiant, twilightGiantDigest,
  validateTwilightGiantCommand, openTwilightGiantOwnedEngine, snapshotTwilightGiantOwnedEngine,
  advanceTwilightGiantOwnedEngine, blockTwilightGiantOwnedEngine,
  getTwilightGiantPromotionStabilityPreview,
  twilightGiantHost, twilightGiantInsideCase, type TwilightGiantOwnedEngine,
} from './engine.js';
import {
  twilightGiantBudget, twilightGiantHistoryDigest, twilightGiantAcquisitionSnapshot,
  twilightGiantSourceBlock, validateTwilightGiantSource,
} from './source.js';
import {
  TWILIGHT_GIANT_ABILITIES, TWILIGHT_GIANT_STORY, TWILIGHT_GIANT_GOAL, TWILIGHT_GIANT_RISK,
  TWILIGHT_GIANT_CITY_PLACES, TWILIGHT_GIANT_HOME, TWILIGHT_GIANT_GUIDANCE,
  TWILIGHT_GIANT_SPIRITUALITY_CAP, TWILIGHT_GIANT_SUPPLIER, TWILIGHT_GIANT_WORKSHOP, TWILIGHT_GIANT_ARCHIVE, TWILIGHT_GIANT_VAULT,
} from './content.js';
import { getTwilightWorksActions, projectTwilightWorks, twilightWorksVerifiedPassages, twilightWorksCurrentOriginals } from './works.js';
import { projectTwilightEpilogue, getTwilightEpilogueActions, twilightEpilogueCurrentOriginals } from './epilogue.js';
import { getTwilightGiantMaterialActions, projectTwilightGiantMaterials } from './materials.js';
import { TWILIGHT_GIANT_MATERIAL_POLICY, TWILIGHT_GIANT_FUTURE_BRANCH, twilightGiantSuccessionAt } from './material-content.js';
import { TWILIGHT_GIANT_LABOUR_IDS, type TwilightGiantMaterialCommand } from './types.js';
import { DIVINE_HAND_ABILITIES, DIVINE_HAND_INHERITED_ABILITIES } from '../divine-hand/content.js';
import { TWILIGHT_GIANT_BRIDGE } from './content.js';

export { createTwilightGiantState, validateTwilightGiantCommand } from './engine.js';
export { twilightGiantSourceView } from './source.js';
export type { TwilightGiantOwnedEngine } from './engine.js';
export type { TwilightGiantCommand, TwilightGiantState, TwilightGiantProjection } from './types.js';

const clone = <T>(value: T): T => structuredClone(value);

/** Raw entries are replayed before this check. Owned entries use a private
 * branded engine, but still cannot publish into a changed host state. */
function assertCurrent(s: SliceState, root: TwilightGiantState): void {
  const source = root.source, frame = root.frame;
  if (!source || !frame || s.progression.pathwayId !== 'warrior' ||
      !sameTwilightGiant(twilightGiantBudget(s), frame.budget) || !sameTwilightGiant(s.random, frame.random))
    throw Error('当前身体、资源与实际行动记录不一致。');
  if (s.revision !== source.revision + 1 + root.journal.length)
    throw Error('当前实际行动次序不一致。');
  const { coreStats: _current, ...identity } = s.character;
  const { coreStats: _source, ...originalIdentity } = source.character;
  if (!sameTwilightGiant(identity, originalIdentity) || Object.entries(frame.finance)
      .some(([key, value]) => !sameTwilightGiant(s[key as keyof SliceState], value)))
    throw Error('当前身份或实际生活账本不一致。');
  if (source.historyDigest !== twilightGiantHistoryDigest(s) ||
      source.originalWorldDigest !== twilightGiantDigest(s.world) ||
      s.combatHistory.length !== source.combatHistoryLength ||
      source.combatHistoryDigest !== twilightGiantDigest(s.combatHistory) ||
      !sameTwilightGiant(source.acquisition, twilightGiantAcquisitionSnapshot(s)))
    throw Error('旧人物、原物或原瓶履历被改写。');
  if (s.combat !== null || s.activeEvent !== null || s.eventQueue.length || s.pulse !== 'NONE')
    throw Error('本章不能同时开启旧现场。');
  if ((frame.budget.sequence === 0) !== (root.promotionWeek !== null))
    throw Error('当前晋升与实际服药记录不一致。');
}

function guidanceBlock(s: SliceState): string | null {
  if (!sameTwilightGiant(s.twilightGiant, createTwilightGiantState()))
    return '已有本章记录，不能重新开始或补发原物。';
  const reason = twilightGiantSourceBlock(s);
  if (reason) return reason;
  return s.actionsRemaining < TWILIGHT_GIANT_GUIDANCE.actions || s.cash < TWILIGHT_GIANT_GUIDANCE.cash
    ? '指导需要1行动与100便士，可先按原生活工作与休养。' : null;
}
function publicReason(reason: string | null): string | null {
  if (reason === null) return null;
  return /[\u3400-\u9fff]/.test(reason) && !/[A-Z_]{6,}|seed|cursor|digest|receipt/i.test(reason)
    ? reason : '当前原件、实际所在地或前一步条件尚不满足。';
}
export function validateTwilightGiantState(s: SliceState): boolean {
  try {
    if (sameTwilightGiant(s.twilightGiant, createTwilightGiantState()))
      return s.progression.pathwayId !== 'warrior' || s.progression.sequence !== 0;
    const head = openTwilightGiantOwnedEngine(s);
    assertCurrent(s, snapshotTwilightGiantOwnedEngine(head));
    return true;
  } catch { return false; }
}
export function hasTwilightGiantHistory(s: SliceState): boolean {
  try {
    return s.twilightGiant.guidanceKnown && s.twilightGiant.source !== null &&
      s.progression.pathwayId === 'warrior' && validateTwilightGiantSource(s, s.twilightGiant.source, 'COLD_REOPEN');
  } catch { return false; }
}
export function hasTwilightGiantLock(s: SliceState): boolean { return hasTwilightGiantHistory(s); }
export function openTwilightGiantOwnedHead(s: SliceState): TwilightGiantOwnedEngine {
  const head = openTwilightGiantOwnedEngine(s);
  assertCurrent(s, snapshotTwilightGiantOwnedEngine(head));
  return head;
}
export function assertOwnedTwilightGiantCurrent(s: SliceState, head: TwilightGiantOwnedEngine): void {
  const root = snapshotTwilightGiantOwnedEngine(head);
  if (!sameTwilightGiant(root, s.twilightGiant)) throw Error('当前会话与实际存档版本不一致。');
  assertCurrent(s, root);
}
export function twilightGiantCommandBlock(s: SliceState, command: TwilightGiantCommand): string | null {
  if (!validateTwilightGiantCommand(command)) return '这项行动的内容无效。';
  if (s.status !== 'ACTIVE') return '已经死亡或结束的角色不能继续行动。';
  if (command.type === 'LEARN_GUIDANCE') return guidanceBlock(s);
  try { return publicReason(blockTwilightGiantOwnedEngine(openTwilightGiantOwnedHead(s), command, s.revision + 1)); }
  catch { return '当前记录未通过核验，不能继续行动。'; }
}
export function ownedTwilightGiantCommandBlock(s: SliceState, command: TwilightGiantCommand, head: TwilightGiantOwnedEngine): string | null {
  if (!validateTwilightGiantCommand(command)) return '这项行动的内容无效。';
  if (s.status !== 'ACTIVE') return '已经死亡或结束的角色不能继续行动。';
  if (command.type === 'LEARN_GUIDANCE') return '已有本章记录，不能重新开始或补发原物。';
  try {
    assertOwnedTwilightGiantCurrent(s, head);
    return publicReason(blockTwilightGiantOwnedEngine(head, command, s.revision + 1));
  } catch { return '当前记录未通过核验，不能继续行动。'; }
}

function publish(s: SliceState, command: TwilightGiantCommand, root: TwilightGiantState, ctx: SeerContext): void {
  const b = root.frame!.budget;
  s.twilightGiant = clone(root);
  s.week = b.week; s.date = clone(b.date); s.actionsRemaining = b.actions;
  s.cash = b.cash; s.health = b.health; s.mind = b.mind; s.spirituality = b.spirituality; s.status = b.status;
  s.injuries = clone(b.injuries); s.injuryRisk = b.injuryRisk;
  s.progression.sequence = b.sequence; s.progression.acting = b.acting;
  s.progression.mastery = { ...b.mastery }; s.character.coreStats = { ...b.coreStats };
  s.seer.pollution = b.pollution; s.seer.completedSources = [...b.completedSources];
  s.random = { ...root.frame!.random }; Object.assign(s, clone(root.frame!.finance));
  const event = command.type === 'LEARN_GUIDANCE' ? null : root.journal.at(-1)!;
  s.lastCheck = event?.randomReceipts.length ? clone(event.randomReceipts.at(-1)!.check) : null;
  if (!event) ctx.note('原桥修护与黄昏巨人指导', '已支付100便士与1行动核对本人、三份真实神明之手和实际履历。沿普通道路回到原桥，调查两段新支撑与新工人的实际通行；原人原物、旧掌握、伤势和账目保持原值。');
  else {
    for (const receipt of event.financeReceipts) ctx.note(receipt.title, receipt.text);
    ctx.note(b.sequence === 0 ? '黄昏巨人当前行动' : '原桥修护当前行动', event.notes.join(''));
  }
}
export function applyTwilightGiantCommand(s: SliceState, command: TwilightGiantCommand, ctx: SeerContext): void {
  if (!validateTwilightGiantCommand(command) || s.status !== 'ACTIVE') throw Error('当前不能执行这项行动。');
  let root: TwilightGiantState;
  if (command.type === 'LEARN_GUIDANCE') {
    const reason = guidanceBlock(s); if (reason) throw Error(reason);
    root = startTwilightGiant(s);
  } else root = snapshotTwilightGiantOwnedEngine(advanceTwilightGiantOwnedEngine(openTwilightGiantOwnedHead(s), command, s.revision + 1));
  publish(s, command, root, ctx);
}
export function applyOwnedTwilightGiantCommand(s: SliceState, command: TwilightGiantCommand, ctx: SeerContext, head: TwilightGiantOwnedEngine): TwilightGiantOwnedEngine {
  assertOwnedTwilightGiantCurrent(s, head);
  if (!validateTwilightGiantCommand(command) || command.type === 'LEARN_GUIDANCE' || s.status !== 'ACTIVE')
    throw Error('当前不能执行这项行动。');
  const next = advanceTwilightGiantOwnedEngine(head, command, s.revision + 1);
  publish(s, command, snapshotTwilightGiantOwnedEngine(next), ctx);
  return next;
}
export function projectTwilightGiant(s: SliceState): TwilightGiantProjection {
  return projection(s, sameTwilightGiant(s.twilightGiant, createTwilightGiantState()) ? null : openTwilightGiantOwnedHead(s));
}
export function projectOwnedTwilightGiant(s: SliceState, head: TwilightGiantOwnedEngine): TwilightGiantProjection {
  assertOwnedTwilightGiantCurrent(s, head);
  return projection(s, head);
}

/** Choose an honest next action; it never modifies resources or supplies a result. */
function desiredCommand(root: TwilightGiantState): TwilightGiantCommand | null {
 const f=root.frame!,b=f.budget,m=root.materials!,w=root.works!;
 const at=(to:string,c:TwilightGiantCommand):TwilightGiantCommand=>f.location===to?c:{type:'TRAVEL',to};
 const work=(command:import('./works-types.js').TwilightWorksCommand):TwilightGiantCommand=>({type:'WORKS',command});
 const ep=(type:import('./epilogue.js').TwilightEpilogueCommand['type']):TwilightGiantCommand=>({type:'EPILOGUE',command:{type} as import('./epilogue.js').TwilightEpilogueCommand});
 if(!twilightGiantInsideCase(root)){
  if(b.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null))return {type:'CLINIC'};
  if(b.health<80||b.mind<78||b.spirituality<42||b.injuries.length||b.pollution>20)return {type:'REST'};
  if(f.finance.wagePaidWeek!==b.week&&b.actions>0)return {type:'WORK'};
 }
 if(root.epilogue){
  const e=root.epilogue;
  if(f.location!==e.location)return at(e.location,ep('REST_OUTSIDE'));
  if(e.status!=='ACTIVE'){
   if(e.workers.some(w=>w.position!==-2))return ep('ORDINARY_EXIT');
   return e.reported?null:ep('REPORT');
  }
  if(e.position===-2){
   if(e.playerEnergy<45)return ep('REST_OUTSIDE');
   if(b.actions<2)return {type:'NEXT_WEEK'};
   for(const worker of e.workers)if(worker.consent!=='GRANTED'||worker.consentWeek!==b.week)return {type:'EPILOGUE',command:{type:'ASK_WORKER',workerId:worker.id}};
   if(!e.brace)return ep('BUY_REPLACEMENT_SUPPORT');
   return ep('ARRIVE_FAR_SIDE');
  }
  if(!e.incidentEventId)return ep('TRY_CART_RETURN');
  if(!e.brace?.fittedEventId){
   if(e.position!==5)return ep('CONTACT_BEAM');
   if(e.giant.passed&&e.giant.expiresSecond!==null&&f.nowSecond+8<=e.giant.expiresSecond)return ep('FIT_BRACE_IN_WINDOW');
   if(e.giant.attempts<2&&b.actions>0){if(!e.contact)return ep('STEP_TO_CART');return ep('GIANT_CONTACT_HOLD');}
   return b.actions>0?ep('ORDINARY_SHORE'):ep('PAUSE_SHIFT');
  }
  if(!e.twilight.applied&&e.twilight.attempts<2){
   if(e.twilight.passed&&e.twilight.expiresSecond!==null&&f.nowSecond+3<=e.twilight.expiresSecond)return ep('APPLY_TWILIGHT');
   if(b.actions<1)return ep('PAUSE_SHIFT');
   if(!e.sight||f.nowSecond+5>e.sight.clearUntilSecond)return ep('OBSERVE_AXLE');
   return ep('TWILIGHT_AXLE_EASING');
  }
  if(e.cart.position===8)return e.position===5?ep('STEP_TO_CART'):ep('PUSH_CART');
  return ep('ORDINARY_EXIT');
 }
 if(b.sequence===0)return at(TWILIGHT_GIANT_BRIDGE,{type:'START_EPILOGUE'});
 if(twilightWorksVerifiedPassages(w).length!==2){
  if(f.location!==w.location)return at(w.location,work({type:'SURVEY'}));
  if(!w.investigationEventId)return work({type:'SURVEY'});
  if(!w.routeEventId)return work({type:'WALK_RETURN_ROUTE'});
  if(w.position===-2&&w.playerEnergy<30)return work({type:'REST_OUTSIDE'});
  if(w.position===-2&&b.actions<1)return {type:'NEXT_WEEK'};
  for(const worker of w.workers){
   if(worker.position===8)return work({type:'SAFE_EXIT',workerId:worker.id});
   if(worker.position===5)return work({type:'CROSS_SEGMENT',workerId:worker.id,segment:'B'});
  }
  for(const segment of ['A','B'] as const){
   const support=w.supports.find(p=>p.segment===segment&&p.holder==='FITTED');
   if(!support||support.passagesRemaining===0){
    if(w.position!==2)return work({type:'APPROACH'});
    return work({type:w.supports.some(p=>p.segment===segment&&p.holder==='PLAYER')?'FIT_SUPPORT':'BUY_SUPPORT',segment});
   }
  }
  if(w.beam.integrity<65)return w.position===2?work({type:'REPAIR_BEAM_JOINT'}):work({type:'APPROACH'});
  for(const worker of w.workers){
   const complete=w.exits.some(e=>e.workerId===worker.id&&e.arrivalEventId===worker.arrivalEventId&&e.from===8&&e.safe);
   if(complete)continue;
   if(worker.position===2)return w.position===2?work({type:'CROSS_SEGMENT',workerId:worker.id,segment:'A'}):work({type:'APPROACH'});
   if(w.position!==-2)return work({type:'RETREAT'});
   if(b.actions<1)return {type:'NEXT_WEEK'};
   if(worker.consent!=='GRANTED'||worker.consentWeek!==b.week)return work({type:'ASK_WORKER',workerId:worker.id});
   return work({type:'ARRIVE_WORKER',workerId:worker.id});
  }
  return w.position!==-2?work({type:'RETREAT'}):work({type:'REVIEW'});
 }
 const failed=m.compounds.find(p=>p.status==='FAILED_EXPOSED'||p.status==='FAILED_SEALED');
 if(failed)return at(failed.location,{type:'MATERIAL',command:{type:failed.status==='FAILED_EXPOSED'?'SEAL_REMAINS':'RECOVER_SEALED',compoundId:failed.id}});
 const item=m.characteristics.find(i=>!['EMBODIED','COMPOUND','FUSED'].includes(i.holder)&&(i.holder!=='PLAYER'||!i.acquiredEventId));
 if(item){
  let command:TwilightGiantMaterialCommand;
  if(item.holder==='SUPPLIER'){
   const taskId=TWILIGHT_GIANT_LABOUR_IDS[item.inheritedLabourSteps+item.labour.length];
   command=taskId?{type:'MATERIAL_LABOUR',bottleId:item.originBottleId,taskId}:{type:'ACQUIRE_CHARACTERISTIC',bottleId:item.originBottleId};
  }else{
   const site=m.legacySites.find(site=>site.originalBottleId===item.originBottleId);
   command={type:item.holder==='PLAYER'?'ACQUIRE_CHARACTERISTIC':site&&(site.permissionWeek!==b.week||site.investigation!=='ALLOW'||site.handover!=='ALLOW')?'ASK_LEGACY_PERMISSION':item.holder==='UNLOCATED'?'INVESTIGATE_LEGACY_REMAINS':item.holder==='LOCATED'?'SEAL_LEGACY_REMAINS':'RECOVER_LEGACY_REMAINS',bottleId:item.originBottleId};
  }
  return at(item.holder==='PLAYER'?item.location!:item.holder==='SUPPLIER'?TWILIGHT_GIANT_SUPPLIER:TWILIGHT_GIANT_MATERIAL_POLICY.legacyLocation,{type:'MATERIAL',command});
 }
 if(['UNVERIFIED','CUSTODIAN'].includes(m.uniqueness.holder)){
  if(!m.uniqueness.checks.some(c=>c.step==='CHAIN'))return at(TWILIGHT_GIANT_ARCHIVE,{type:'MATERIAL',command:{type:'VERIFY_UNIQUENESS',step:'CHAIN'}});
  if(!m.uniqueness.checks.some(c=>c.step==='VACANCY'&&c.week===b.week))return at(TWILIGHT_GIANT_VAULT,{type:'MATERIAL',command:{type:'VERIFY_UNIQUENESS',step:'VACANCY'}});
  return at(TWILIGHT_GIANT_VAULT,{type:'MATERIAL',command:{type:'ACQUIRE_UNIQUENESS'}});
 }
 const potion=m.compounds.find(p=>p.status==='PREPARED');
 if(potion){const preview=getTwilightGiantPromotionStabilityPreview(root,potion.id);return at(TWILIGHT_GIANT_WORKSHOP,preview.prepared?{type:'CONSUME',compoundId:potion.id,confirmed:true}:{type:'STABILIZE_PROMOTION',compoundId:potion.id});}
 const held=m.batches.find(x=>x.status==='PLAYER');if(held)return at(TWILIGHT_GIANT_WORKSHOP,{type:'MATERIAL',command:{type:'COMPOSE_POTION',batchId:held.id}});
 const supply=m.batches.find(x=>x.status==='SUPPLIER');return supply?at(TWILIGHT_GIANT_SUPPLIER,{type:'MATERIAL',command:{type:'BUY_COMPOUND',batchId:supply.id}}):null;
}
function projection(s:SliceState,head:TwilightGiantOwnedEngine|null):TwilightGiantProjection {
 const root=head?snapshotTwilightGiantOwnedEngine(head):s.twilightGiant,f=root.frame,b=f?.budget??twilightGiantBudget(s),promoted=s.progression.pathwayId==='warrior'&&b.sequence===0&&root.promotionWeek!==null;
 const definitions=s.progression.pathwayId==='warrior'?[...DIVINE_HAND_INHERITED_ABILITIES,...DIVINE_HAND_ABILITIES,...(promoted?TWILIGHT_GIANT_ABILITIES:[])]:[];
 const result:TwilightGiantProjection={title:'序列0 黄昏巨人',guidanceKnown:root.guidanceKnown,promoted,story:TWILIGHT_GIANT_STORY,nextStep:TWILIGHT_GIANT_GOAL,risk:TWILIGHT_GIANT_RISK,
  resources:{health:b.health,maxHealth:100,mind:b.mind,maxMind:100,spirituality:b.spirituality,maxSpirituality:promoted?TWILIGHT_GIANT_SPIRITUALITY_CAP:120,cash:`${b.cash}便士`,actionsRemaining:b.actions,weeklyBudget:f?.finance.weeklyBudget??s.weeklyBudget},
  injuries:b.injuries.map(i=>({id:i.id,severity:i.severity,treated:i.treatedRevision!==null})),injuryRisk:b.injuryRisk,
  abilities:definitions.filter(a=>Object.hasOwn(b.mastery,a.id)).map(a=>({id:a.id,label:a.label,description:a.description,mastery:b.mastery[a.id]??0})),actions:[],sections:[],insideCase:twilightGiantInsideCase(root)};
 const add=(command:TwilightGiantCommand,label:string,cost:string)=>{const reason=publicReason(head?blockTwilightGiantOwnedEngine(head,command,s.revision+1):twilightGiantCommandBlock(s,command));result.actions.push({id:`twilight-giant:${result.actions.length}:${command.type}`,label,cost,command:clone(command),enabled:reason===null,reason});};
 if(!root.guidanceKnown){add({type:'LEARN_GUIDANCE'},'听取原桥修护与三份原特性指导','1行动、100便士');result.actions[0]!.preferredAction=true;return result;}
 const h=twilightGiantHost(root,`R220:${root.source!.runId}:${s.revision+1}`,s.revision+1),place=TWILIGHT_GIANT_CITY_PLACES.find(p=>p.id===f!.location)?.title??'当前现场';
 result.sections.push({id:'clock',title:'实际日期与所在地',lines:[`${place}；第${b.week}周，${h.date.year}年${h.date.month}月${h.date.day}日。`,`距本人实际成为神明之手${b.week-root.source!.acquisition.promotionWeek}周，满十二周方可服药。距下一真实周界${Math.ceil((f!.weekAnchor+604800-f!.nowSecond)/3600)}小时；生活与旧债照常结算。`]});
 result.sections.push(root.epilogue?{id:'works',title:'已完成的原桥通行',lines:['玛拉与奥斯里克分别实际走完前后三米桥段，随后亲自沿普通侧路与门道退出，两份通行均已复核。','原两件有价支撑已各耗两次通行；下列后日谈显示同一现场当前人员、梁与车状态。']}:{id:'works',...projectTwilightWorks(root.works!)});
 result.sections.push({id:'materials',...projectTwilightGiantMaterials(root.materials!)});
 result.sections.push({id:'succession',title:'同一原件的当前保管',lines:twilightGiantSuccessionAt(h.date)?[TWILIGHT_GIANT_FUTURE_BRANCH.story,'还须本人核查原件与当前空位并有价交接。']:['尚无可核实的原件析出与保管交接；不能提前取得仍在容纳中的原物。']});
 const current=root.epilogue?twilightEpilogueCurrentOriginals(root.epilogue):twilightWorksCurrentOriginals(root.works!),old=current.site;
 result.sections.push({id:'body',title:'同一本人、原人物与旧物',lines:[`${s.character.name}，${s.character.age}岁；健康${b.health}，精神${b.mind}，灵性${b.spirituality}/${promoted?150:120}，污染${b.pollution}；意志${b.coreStats.will}。`,`原银甲当前完整度${old.armor?.integrity??0}；旧垫片剩余${old.pads.remaining}、旧负载剩余${old.load.remainingLoads}。`,`西莉娅仍在${old.celia.location==='OUTSIDE'?'室外':'原位置'}，埃文仍按旧位置记录；本章只移动实际参与的新成人。`,'全部旧技巧逐值保留，两项新技巧实际晋升后才从零开始。旧伤、旧物耗费与人员结局不重置。']});
 result.sections.push({id:'finance',title:'本人实际工作与生活账目',lines:[`现款${b.cash}便士；原职业工资每周${root.source!.character.weeklyWage}便士，实际工作1行动后才到账。`,`每周${f!.finance.weeklyBudget}行动；未付本金${f!.finance.debts.reduce((sum,d)=>sum+d.remaining,0)}便士。`,'材料劳动只抵同一载体的有价交接费用，不额外发现金。普通周结不治伤、不补材料、不发工资。']});
 result.sections.push({id:'injuries',title:'当前真实伤势',lines:b.injuries.length?b.injuries.map(i=>`${i.severity==='HEAVY'?'重伤':'轻伤'}：${i.treatedRevision===null?'尚未处置':'已普通处置，仍须之后实际休养'}。`):['当前没有实际伤势。']});
 const latest=root.journal.at(-1);
 result.sections.push({id:'recent-action',title:'最近行动与实际费用',lines:latest?[...latest.notes,...latest.financeReceipts.map(r=>r.text),...latest.randomReceipts.map(r=>`本次实际检定：成功率${r.check.chance}%，掷出${r.check.roll}，${r.check.tier==='SUCCESS'?'成功':r.check.tier==='GREAT_SUCCESS'?'大成功':r.check.tier==='FAILURE'?'失败':'严重失败'}。`),`现款变化${latest.after.budget.cash-latest.before.budget.cash}便士；行动变化${latest.after.budget.actions-latest.before.budget.actions}，健康变化${latest.after.budget.health-latest.before.budget.health}。`]:['已支付100便士与1行动听取指导。']});
 if(root.epilogue){
  result.sections.unshift({id:'epilogue',...projectTwilightEpilogue(root.epilogue)});
  for(const a of getTwilightEpilogueActions(root.epilogue,h))add({type:'EPILOGUE',command:a.command},a.label,`${a.cost}${a.chance===null?'':`；当前成功率${a.chance}%`}`);
  result.nextStep='真实支撑原梁、处理同一根卡轴后，仍须手动推车并逐人退出；普通支撑和侧路也始终可选。';
 }else if(!promoted){
  for(const a of getTwilightWorksActions(root.works!,h))add({type:'WORKS',command:a.command},a.label,a.cost);
  for(const a of getTwilightGiantMaterialActions(root.materials!,TWILIGHT_GIANT_MATERIAL_POLICY))add({type:'MATERIAL',command:a.command},a.label,a.cost);
  const lines:string[]=[];
  for(const p of root.materials!.compounds.filter(p=>p.status==='PREPARED')){
   const preview=getTwilightGiantPromotionStabilityPreview(root,p.id);
   lines.push(`本瓶当前实际成功率${preview.chance}%；额外有价准备后${preview.preparedChance}%，仍不保证成功。`,'可选准备实付150便士、1行动、12灵性和8精神；绑定本人、同一瓶、调配室与两份真实通行核验，七天有效，离场或饮用失效。','饮用实耗1行动和30灵性；成功再扣12精神。失败扣45健康、40精神、增加35污染与重伤；严重失败扣110健康、100精神、增加70污染，可能死亡。');
   add({type:'STABILIZE_PROMOTION',compoundId:p.id},'为同一瓶完成有价稳定准备','1行动、150便士、12灵性、8精神');
   add({type:'CONSUME',compoundId:p.id,confirmed:true},'独立确认风险并饮用同一瓶',`1行动、30灵性；当前${preview.chance}%成功，可能重伤或死亡`);
  }
  if(lines.length)result.sections.push({id:'promotion-stability',title:'本瓶准备与实际风险',lines});
 }else add({type:'START_EPILOGUE'},'回到原梁与原车继续现场工作','现场十分钟；人员须重新同意并领工钱，不补原物');
 for(const place of TWILIGHT_GIANT_CITY_PLACES)if(place.id!==f!.location)add({type:'TRAVEL',to:place.id},`沿普通道路步行前往${place.title}`,'1行动、0便士，实际半小时');
 if(f!.location!==TWILIGHT_GIANT_HOME)add({type:'RETURN_ON_FOOT'},'本人沿普通路返回街区接待处','0行动、0便士，实际两小时；未退出者须先亲自退出');
 add({type:'WORK'},'做本周原职业工作',`1行动，实际收入${root.source!.character.weeklyWage}便士，每周一次`);
 add({type:'CLINIC'},'付费普通处置真实重伤','1行动、60便士，之后仍须休养');
 add({type:'REST'},'按实际生活档休养','1行动、八小时；未经处置的重伤仍保留');
 add({type:'NEXT_WEEK'},'走到下一真实周界','生活与旧债照常结算，没有自动工资或恢复');
 const desired=desiredCommand(root);let preferred=result.actions.find(a=>sameTwilightGiant(a.command,desired));
 if(preferred&&!preferred.enabled){
  if(result.insideCase){
   preferred=result.actions.find(a=>a.enabled&&a.command.type==='WORKS'&&a.command.command.type==='SAFE_EXIT')??result.actions.find(a=>a.enabled&&a.command.type==='WORKS'&&a.command.command.type==='RETREAT')??result.actions.find(a=>a.enabled&&a.command.type==='EPILOGUE'&&a.command.command.type==='PAUSE_SHIFT')??preferred;
  }else preferred=result.actions.find(a=>a.enabled&&a.command.type==='WORK')??result.actions.find(a=>a.enabled&&a.command.type==='NEXT_WEEK')??preferred;
 }
 if(preferred){preferred.preferredAction=true;result.nextStep=`${preferred.label}。${preferred.reason??'按真实费用、用时与身体条件完成这一步。'}`;}
 return result;
}
// Compatibility names for central routing, all use the same authoritative implementation.
export { createTwilightGiantState as createEmptyTwilightGiantState } from './engine.js';
export { twilightGiantSourceView as createTwilightGiantSourceView } from './source.js';
export const projectTwilightGiantState=projectTwilightGiant;
export const hasTwilightGiantGuidedCampaignLock=hasTwilightGiantLock;
export const hasTwilightGiantCanonicalHistory=hasTwilightGiantHistory;
