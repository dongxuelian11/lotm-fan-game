import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { TwilightGiantCommand, TwilightGiantProjection, TwilightGiantState } from './types.js';
import {
  createTwilightGiantState, startTwilightGiant, sameTwilightGiant, twilightGiantDigest,
  validateTwilightGiantCommand, openTwilightGiantOwnedEngine, snapshotTwilightGiantOwnedEngine,
  advanceTwilightGiantOwnedEngine, blockTwilightGiantOwnedEngine,
  getTwilightGiantPromotionStabilityPreview, getTwilightGiantEpilogueCheckPreview,
  twilightGiantHost, type TwilightGiantOwnedEngine,
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
import { getTwilightGiantServiceActions, projectTwilightGiantServices, twilightGiantServiceVerifiedReceipts, canLeaveTwilightGiantServices, nextTwilightGiantServiceCommand, twilightGiantServiceLocation } from './services.js';
import { projectTwilightGiantEpilogue, getTwilightGiantEpilogueActions } from './epilogue.js';
import { getTwilightGiantMaterialActions, projectTwilightGiantMaterials } from './materials.js';
import { TWILIGHT_GIANT_MATERIAL_POLICY, TWILIGHT_GIANT_FUTURE_BRANCH, twilightGiantSuccessionAt } from './material-content.js';
import { TWILIGHT_GIANT_LABOUR_IDS, type TwilightGiantMaterialCommand } from './types.js';
import { STAR_KEY_ABILITIES, STAR_KEY_INHERITED_ABILITIES } from '../star-key/content.js';
import { TWILIGHT_GIANT_GATE } from './content.js';

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
  if (!event) ctx.note('居民服务与门晋升指导', '已支付100便士与1行动核对本人身份、三份星之匙原特性和实际履历。旧人物、原物、当前伤势和旧账保留；从接待处步行到三处街区通道，问过原居民后完成实际服务并核验交接。');
  else {
    for (const receipt of event.financeReceipts) ctx.note(receipt.title, receipt.text);
    ctx.note(b.sequence === 0 ? '门当前行动' : '居民服务当前行动', event.notes.join(''));
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

const safetyTypes = new Set(['STOP_ESCORT','RELEASE','STOP_EFFECTS','RETURN_ON_FOOT','WITHDRAW','ORDINARY_SIDE_EXIT','UNLOAD','UNLOAD_STRUT','COLLECT_TOOLS','CUTOFF_AND_SEAL','ORDINARY_EXIT','STOP_SERVICE']);
function desiredCommand(root: TwilightGiantState): TwilightGiantCommand | null {
 const f=root.frame!,b=f.budget,h=twilightGiantHost(root,`R220:${root.source!.runId}:${root.source!.revision+2+root.journal.length}`,root.source!.revision+2+root.journal.length);
 const at=(to:string,c:TwilightGiantCommand):TwilightGiantCommand=>f.location===to?c:{type:'TRAVEL',to};
 if(root.epilogue){
  const actions=getTwilightGiantEpilogueActions(root.epilogue,h);
  const action=actions.find(a=>a.preferredAction)??actions.find(a=>a.enabled&&!safetyTypes.has(a.command.type))??actions.find(a=>a.enabled);
  return action?{type:'EPILOGUE',command:action.command}:null;
 }
 if(b.sequence===0){
  if(b.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null))return {type:'CLINIC'};
  if(b.health<80||b.mind<40||b.spirituality<28||b.injuries.length)return {type:'REST'};
  if(b.actions<(f.location===TWILIGHT_GIANT_GATE?2:3))return {type:'NEXT_WEEK'};
  return at(TWILIGHT_GIANT_GATE,{type:'START_EPILOGUE'});
 }
 const serviceActions=getTwilightGiantServiceActions(root.services!,h);
 if(!canLeaveTwilightGiantServices(root.services!,f.location)){
  const cleanup=serviceActions.find(a=>a.preferredAction)??serviceActions.find(a=>a.enabled&&a.command.type==='RETURN_ON_FOOT');
  if(cleanup)return {type:'SERVICE',command:cleanup.command};
 }
 const failed=root.materials!.compounds.find(p=>p.status==='FAILED_EXPOSED'||p.status==='FAILED_SEALED');
 if(failed)return at(failed.location,{type:'MATERIAL',command:{type:failed.status==='FAILED_EXPOSED'?'SEAL_REMAINS':'RECOVER_SEALED',compoundId:failed.id}});
 if(b.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null))return {type:'CLINIC'};
 if(b.injuries.length||b.health<80||b.mind<78||b.spirituality<42)return {type:'REST'};
 const verified=twilightGiantServiceVerifiedReceipts(root.services!);
 if(verified.length<3){
  const next=nextTwilightGiantServiceCommand(root.services!,f.location,h);
  if(next)return at(twilightGiantServiceLocation(next.jobId),{type:'SERVICE',command:next});
  return f.finance.wagePaidWeek!==b.week&&b.actions>0?{type:'WORK'}:{type:'NEXT_WEEK'};
 }
 const m=root.materials!,item=m.characteristics.find(i=>!['EMBODIED','COMPOUND','FUSED'].includes(i.holder)&&(i.holder!=='PLAYER'||!i.acquiredEventId));
 if(item){
  let command:TwilightGiantMaterialCommand;
  if(item.holder==='SUPPLIER'){
   const taskId=TWILIGHT_GIANT_LABOUR_IDS[item.inheritedLabourSteps+item.labour.length];
   command=taskId?{type:'MATERIAL_LABOUR',bottleId:item.originBottleId,taskId}:{type:'ACQUIRE_CHARACTERISTIC',bottleId:item.originBottleId};
  }else {
   const site=m.legacySites.find(site=>site.originalBottleId===item.originBottleId);
   command={type:item.holder==='PLAYER'?'ACQUIRE_CHARACTERISTIC':site&&(site.permissionWeek!==b.week||site.investigation!=='ALLOW'||site.handover!=='ALLOW')?'ASK_LEGACY_PERMISSION':item.holder==='UNLOCATED'?'INVESTIGATE_LEGACY_REMAINS':item.holder==='LOCATED'?'SEAL_LEGACY_REMAINS':'RECOVER_LEGACY_REMAINS',bottleId:item.originBottleId};
  }
  const location=item.holder==='PLAYER'?item.location!:item.holder==='SUPPLIER'?TWILIGHT_GIANT_SUPPLIER:TWILIGHT_GIANT_MATERIAL_POLICY.legacyLocation;
  return at(location,{type:'MATERIAL',command});
 }
 if(['UNVERIFIED','CUSTODIAN'].includes(m.uniqueness.holder)){
  if(!m.uniqueness.checks.some(c=>c.step==='CHAIN'))return at(TWILIGHT_GIANT_ARCHIVE,{type:'MATERIAL',command:{type:'VERIFY_UNIQUENESS',step:'CHAIN'}});
  if(!m.uniqueness.checks.some(c=>c.step==='VACANCY'&&c.week===b.week))return at(TWILIGHT_GIANT_VAULT,{type:'MATERIAL',command:{type:'VERIFY_UNIQUENESS',step:'VACANCY'}});
  return at(TWILIGHT_GIANT_VAULT,{type:'MATERIAL',command:{type:'ACQUIRE_UNIQUENESS'}});
 }
 const p=m.compounds.find(p=>p.status==='PREPARED');
 if(p){const preview=getTwilightGiantPromotionStabilityPreview(root,p.id);return at(TWILIGHT_GIANT_WORKSHOP,preview.prepared?{type:'CONSUME',compoundId:p.id,confirmed:true}:{type:'STABILIZE_PROMOTION',compoundId:p.id});}
 const held=m.batches.find(x=>x.status==='PLAYER');if(held)return at(TWILIGHT_GIANT_WORKSHOP,{type:'MATERIAL',command:{type:'COMPOSE_POTION',batchId:held.id}});
 const supplier=m.batches.find(x=>x.status==='SUPPLIER');if(supplier)return at(TWILIGHT_GIANT_SUPPLIER,{type:'MATERIAL',command:{type:'BUY_COMPOUND',batchId:supplier.id}});
 return null;
}
function projection(s: SliceState,head: TwilightGiantOwnedEngine|null): TwilightGiantProjection {
 const root=head?snapshotTwilightGiantOwnedEngine(head):s.twilightGiant,f=root.frame,b=f?.budget??twilightGiantBudget(s),promoted=s.progression.pathwayId==='warrior'&&b.sequence===0&&root.promotionWeek!==null;
 const definitions=s.progression.pathwayId==='warrior'?[...STAR_KEY_INHERITED_ABILITIES,...STAR_KEY_ABILITIES,...(promoted?TWILIGHT_GIANT_ABILITIES:[])]:[];
 const result:TwilightGiantProjection={title:'序列0 门',guidanceKnown:root.guidanceKnown,promoted,story:TWILIGHT_GIANT_STORY,nextStep:TWILIGHT_GIANT_GOAL,risk:TWILIGHT_GIANT_RISK,
  resources:{health:b.health,maxHealth:100,mind:b.mind,maxMind:100,spirituality:b.spirituality,maxSpirituality:promoted?150:120,cash:`${b.cash}便士`,actionsRemaining:b.actions,weeklyBudget:f?.finance.weeklyBudget??s.weeklyBudget},
  injuries:b.injuries.map(i=>({id:i.id,severity:i.severity,treated:i.treatedRevision!==null})),injuryRisk:b.injuryRisk,
  abilities:definitions.filter(a=>Object.hasOwn(b.mastery,a.id)).map(a=>({id:a.id,label:a.label,description:a.description,mastery:b.mastery[a.id]??0})),
  actions:[],sections:[],insideCase:root.epilogue?.status==='ACTIVE'||!!root.services&&!!f&&!canLeaveTwilightGiantServices(root.services,f.location)};
 const add=(command:TwilightGiantCommand,label:string,cost:string)=>{const reason=publicReason(head?blockTwilightGiantOwnedEngine(head,command,s.revision+1):twilightGiantCommandBlock(s,command));result.actions.push({id:`twilightGiant:${result.actions.length}:${command.type}`,label,cost,command:clone(command),enabled:reason===null,reason});};
 if(!root.guidanceKnown){add({type:'LEARN_GUIDANCE'},'听取三件服务与三份原特性指导','1行动、100便士');result.actions[0]!.preferredAction=true;return result;}
 const h=twilightGiantHost(root,`R220:${root.source!.runId}:${s.revision+1}`,s.revision+1),place=TWILIGHT_GIANT_CITY_PLACES.find(p=>p.id===f!.location)?.title??'当前现场';
 const hour=Math.floor(f!.nowSecond%86400/3600),minute=Math.floor(f!.nowSecond%3600/60);
 result.sections.push({id:'clock',title:'实际日历与当前地点',lines:[`当前位置：${place}；第${b.week}周，${h.date.year}年${h.date.month}月${h.date.day}日 ${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')}。`,`距下一真实周界${Math.ceil((f!.weekAnchor+604800-f!.nowSecond)/3600)}小时；跨界结生活费与旧债，只有实际工作才取得本周工资。`]});
 const services=projectTwilightGiantServices(root.services!);
 result.sections.push({id:'twilightGiant-services',title:'三件居民服务与现场核验',lines:services.lines});
 result.sections.push({id:'materials',...projectTwilightGiantMaterials(root.materials!)});
 const succession=twilightGiantSuccessionAt(h.date);
 result.sections.push({id:'future-branch',title:'同一原件与当前保管',lines:succession?[TWILIGHT_GIANT_FUTURE_BRANCH.story,'仍须本人核查已发生的保管链、复核当前空位并当面交接；已经转交的同一原件不能重复领取。']:['当前尚无可核实的空位、析出和原件交接记录，不能提前取得仍在容纳中的原物。','可以继续普通工作、完成居民服务或稍后回来查询；等待不会发工资、补材料或保护生命。']});
 result.sections.push({id:'finance',title:'实际工资、生活与旧债',lines:[`现款${b.cash}便士；原职业每周${root.source!.character.weeklyWage}便士，须本人实际工作一次。`,`未付本金${f!.finance.debts.reduce((sum,d)=>sum+d.remaining,0)}便士；下次约定还款${f!.finance.debts.reduce((sum,d)=>sum+Math.min(d.remaining,d.weeklyPayment),0)}便士。`,'没有自动工资，周结不足生活费如实计欠，再转赤贫生活。']});
 result.sections.push({id:'body',title:'原身体、17项旧掌握与原物',lines:[`${s.character.name}，${s.character.age}岁；健康${b.health}，精神${b.mind}，灵性${b.spirituality}/${promoted?TWILIGHT_GIANT_SPIRITUALITY_CAP:120}，污染${b.pollution}，意志${b.coreStats.will}。`,...(b.injuries.length?b.injuries.map(i=>`${i.severity==='HEAVY'?'重伤':'轻伤'}：${i.treatedRevision===null?'尚未处置':'已普通处置，仍须之后实际休养'}。`):['当前没有实际伤势。']),'原通行室、油灯、封包、远端包裹和归档护具按旧去向与损耗保留，原人物不会复活或随行。','全部旧掌握逐值保留，原本为零的技能不补练；两项新技巧实际晋升后才从零开始。','普通处置实付60便士与1行动；赤贫休养每次只恢复8健康，未经处置的重伤不会自行消失。']});
 const original=root.source!.originals,site=original.gallery.site,old=original.encounter;
 result.sections.push({id:'source-originals',title:'原人原物的已知去向',lines:[
  `玛拉仍在原通行室的${site.operatorLocation==='OUTSIDE'?'场外':site.operatorLocation==='ENTRY'?'入口':'原位置'}，精力${site.operatorEnergy}；旧许可${site.operatorConsent==='WITHDRAWN'?'已撤回':'仅按原记录保留'}，不等于本章许可。`,
  `本人原包仍在${site.parcel.location==='ENTRY_STAND'?'入口架':site.parcel.location==='PLAYER'?'本人实际手中':'原记录地点'}，数量${site.parcel.quantity}；原油灯余油${site.lamp.oilRemaining}，遮门${site.twilightGiant.state==='CLOSED'?'关闭':'打开'}，操作${site.twilightGiant.operations}次。`,
  `旧罗温${old.enemyStatus==='DEAD'?'已经死亡':old.enemyStatus==='SURRENDERED'?'已投降':'保持原状态'}；其原杆与印记仍按真实所有权、位置及消耗保留，没有自动拾取或充能。`,
  '异星封包与旧保护装具继续留在原记录地点，已经归档的余量不成为本章免费用品。',
 ]});
 const latest=root.journal.at(-1);
 result.sections.push({id:'recent-action',title:'最近实际行动与费用',lines:latest?[...latest.notes,...latest.financeReceipts.map(r=>r.text),...latest.randomReceipts.map(r=>`本次实际检定：成功率${r.check.chance}%，掷出${r.check.roll}，${r.check.tier==='SUCCESS'?'成功':r.check.tier==='GREAT_SUCCESS'?'大成功':r.check.tier==='FAILURE'?'失败':'严重失败'}。`),`现款变化${latest.after.budget.cash-latest.before.budget.cash}便士；行动变化${latest.after.budget.actions-latest.before.budget.actions}，健康变化${latest.after.budget.health-latest.before.budget.health}，精神变化${latest.after.budget.mind-latest.before.budget.mind}，灵性变化${latest.after.budget.spirituality-latest.before.budget.spirituality}。`]:['已实际支付100便士和1行动听取指导，旧身体、原人原物与既往费用仍在。']});
 if(root.epilogue){
  const ep=projectTwilightGiantEpilogue(root.epilogue);result.story=ep.story;result.nextStep=ep.nextStep;
  result.sections.unshift({id:'epilogue',title:'起重棚的有限脱身与出口阻隔',lines:ep.lines});
  for(const a of getTwilightGiantEpilogueActions(root.epilogue,h))add({type:'EPILOGUE',command:a.command},a.label,a.cost);
  const insight=getTwilightGiantEpilogueCheckPreview(root,'CONCEPTUAL_ESCAPE'),weak=getTwilightGiantEpilogueCheckPreview(root,'SEAL_EXIT');
  result.sections.push({id:'epilogue-readiness',title:'本场两次有限尝试与普通退路',lines:[`有限概念化脱身${insight?.chance}%：8便士、14灵性、8精神；单出口短封${weak?.chance}%：6便士、12灵性、6精神；各1行动。`,'各只尝试一次，成功开窗仍须实际应用；本人移位、同门开合、停止效果或超时会使旧窗口失效。','普通停机、固定原车与沿侧路撤离不依赖能力成功；失败费用不退。']});
 }
 if(!promoted){
  for(const a of getTwilightGiantServiceActions(root.services!,h))add({type:'SERVICE',command:a.command},a.label,a.cost);
  for(const a of getTwilightGiantMaterialActions(root.materials!,TWILIGHT_GIANT_MATERIAL_POLICY))add({type:'MATERIAL',command:a.command},a.label,a.cost);
  const lines:string[]=[];
  for(const p of root.materials!.compounds.filter(c=>c.status==='PREPARED')){
   const preview=getTwilightGiantPromotionStabilityPreview(root,p.id);
   lines.push(`本瓶付费准备后的实际成功率${preview.preparedChance}%；${preview.prepared?'同一现场七天准备仍有效':'尚无有效准备，当前不能饮用'}。`,'准备实付150便士、1行动、12灵性与8精神，绑定本人、同一成药、原调配室和三件实际服务交接与现场核验；离场、过期或饮用失效。','意志加本次准备40、难度58，实际成为星之匙至少12周。成功再扣12精神；普通失败扣45健康、40精神、加35污染及重伤；严重失败扣110健康、100精神、加70污染，可以死亡。');
   add({type:'STABILIZE_PROMOTION',compoundId:p.id},'为同一瓶完成真实付费稳定准备','1行动、150便士、12灵性、8精神');
   add({type:'CONSUME',compoundId:p.id,confirmed:true},'独立确认当前风险并饮用同一瓶',`1行动、30灵性；有效准备后${preview.preparedChance}%成功；可能重伤、污染或死亡`);
  }
  if(lines.length)result.sections.push({id:'promotion-stability',title:'本瓶准备与实际服药风险',lines});
 }else if(!root.epilogue)add({type:'START_EPILOGUE'},'前往起重棚事故现场','现场十分钟，不补资源；居民仍须实际撤离');
 for(const destination of TWILIGHT_GIANT_CITY_PLACES)if(destination.id!==f!.location)add({type:'TRAVEL',to:destination.id},`沿普通道路步行前往${destination.title}`,'1行动、0便士，实际半小时');
 if(f!.location!==TWILIGHT_GIANT_HOME)add({type:'RETURN_ON_FOOT'},'本人沿普通路返回街区接待处','0行动、0便士，实际两小时；未同行居民与封存残余留原处');
 add({type:'WORK'},'做本周原职业工作',`1行动，${root.source!.character.weeklyWage}便士，每周一次`);
 add({type:'CLINIC'},'付费普通处置真实重伤','1行动、60便士，之后仍须实际休养');
 add({type:'REST'},'按实际生活档休养','1行动，实际八小时；未处置的重伤仍保留');
 add({type:'NEXT_WEEK'},'走到下一真实周界','结算生活费与约定还款；没有工资或恢复');
 const desired=desiredCommand(root);
 let preferred=result.actions.find(a=>sameTwilightGiant(a.command,desired));
 if(preferred&&!preferred.enabled&&!result.insideCase){
  const work=result.actions.find(a=>a.command.type==='WORK'&&a.enabled);
  const week=result.actions.find(a=>a.command.type==='NEXT_WEEK'&&a.enabled);
  preferred=work??week??preferred;
 }
 if(preferred){preferred.preferredAction=true;result.nextStep=`${preferred.label}。${preferred.reason??'按实际成本与时间完成这一步。'}`;}
 return result;
}
