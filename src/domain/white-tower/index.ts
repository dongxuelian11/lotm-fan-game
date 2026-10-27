import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { WhiteTowerCommand, WhiteTowerProjection, WhiteTowerState } from './types.js';
import {
  createWhiteTowerState, startWhiteTower, sameWhiteTower, whiteTowerDigest,
  validateWhiteTowerCommand, openWhiteTowerOwnedEngine, snapshotWhiteTowerOwnedEngine,
  advanceWhiteTowerOwnedEngine, blockWhiteTowerOwnedEngine,
  getWhiteTowerPromotionStabilityPreview, getWhiteTowerEpilogueCheckPreview,
  whiteTowerHost, type WhiteTowerOwnedEngine,
} from './engine.js';
import {
  whiteTowerBudget, whiteTowerHistoryDigest, whiteTowerAcquisitionSnapshot,
  whiteTowerSourceBlock, validateWhiteTowerSource,
} from './source.js';
import {
  WHITE_TOWER_ABILITIES, WHITE_TOWER_STORY, WHITE_TOWER_GOAL, WHITE_TOWER_RISK,
  WHITE_TOWER_CITY_PLACES, WHITE_TOWER_HOME, WHITE_TOWER_GUIDANCE,
  WHITE_TOWER_SPIRITUALITY_CAP, WHITE_TOWER_SUPPLIER, WHITE_TOWER_WORKSHOP, WHITE_TOWER_ARCHIVE, WHITE_TOWER_VAULT,
} from './content.js';
import { getWhiteTowerPassageActions, projectWhiteTowerPassages, whiteTowerPassageVerifiedReceipts, canLeaveWhiteTowerPassages } from './passages.js';
import { projectWhiteTowerEpilogue, getWhiteTowerEpilogueActions } from './epilogue.js';
import { getWhiteTowerMaterialActions, projectWhiteTowerMaterials } from './materials.js';
import { WHITE_TOWER_MATERIAL_POLICY, WHITE_TOWER_FUTURE_BRANCH, whiteTowerSuccessionAt } from './material-content.js';
import { WHITE_TOWER_LABOUR_IDS, type WhiteTowerMaterialCommand } from './types.js';
import { ALL_KNOWING_EYE_ABILITIES, ALL_KNOWING_EYE_INHERITED_ABILITIES } from '../all-knowing-eye/content.js';
import { WHITE_TOWER_GATE } from './content.js';

export { createWhiteTowerState, validateWhiteTowerCommand } from './engine.js';
export { whiteTowerSourceView } from './source.js';
export type { WhiteTowerOwnedEngine } from './engine.js';
export type { WhiteTowerCommand, WhiteTowerState, WhiteTowerProjection } from './types.js';

const clone = <T>(value: T): T => structuredClone(value);

/** Raw entries are replayed before this check. Owned entries use a private
 * branded engine, but still cannot publish into a changed host state. */
function assertCurrent(s: SliceState, root: WhiteTowerState): void {
  const source = root.source, frame = root.frame;
  if (!source || !frame || s.progression.pathwayId !== 'white-tower' ||
      !sameWhiteTower(whiteTowerBudget(s), frame.budget) || !sameWhiteTower(s.random, frame.random))
    throw Error('当前身体、资源与实际行动记录不一致。');
  if (s.revision !== source.revision + 1 + root.journal.length)
    throw Error('当前实际行动次序不一致。');
  const { coreStats: _current, ...identity } = s.character;
  const { coreStats: _source, ...originalIdentity } = source.character;
  if (!sameWhiteTower(identity, originalIdentity) || Object.entries(frame.finance)
      .some(([key, value]) => !sameWhiteTower(s[key as keyof SliceState], value)))
    throw Error('当前身份或实际生活账本不一致。');
  if (source.historyDigest !== whiteTowerHistoryDigest(s) ||
      source.originalWorldDigest !== whiteTowerDigest(s.world) ||
      s.combatHistory.length !== source.combatHistoryLength ||
      source.combatHistoryDigest !== whiteTowerDigest(s.combatHistory) ||
      !sameWhiteTower(source.acquisition, whiteTowerAcquisitionSnapshot(s)))
    throw Error('旧人物、原物或原瓶履历被改写。');
  if (s.combat !== null || s.activeEvent !== null || s.eventQueue.length || s.pulse !== 'NONE')
    throw Error('本章不能同时开启旧现场。');
  if ((frame.budget.sequence === 0) !== (root.promotionWeek !== null))
    throw Error('当前晋升与实际服药记录不一致。');
}

function guidanceBlock(s: SliceState): string | null {
  if (!sameWhiteTower(s.whiteTower, createWhiteTowerState()))
    return '已有本章记录，不能重新开始或补发原物。';
  const reason = whiteTowerSourceBlock(s);
  if (reason) return reason;
  return s.actionsRemaining < WHITE_TOWER_GUIDANCE.actions || s.cash < WHITE_TOWER_GUIDANCE.cash
    ? '指导需要1行动与100便士，可先按原生活工作与休养。' : null;
}
function publicReason(reason: string | null): string | null {
  if (reason === null) return null;
  return /[\u3400-\u9fff]/.test(reason) && !/[A-Z_]{6,}|seed|cursor|digest|receipt/i.test(reason)
    ? reason : '当前原件、实际所在地或前一步条件尚不满足。';
}
export function validateWhiteTowerState(s: SliceState): boolean {
  try {
    if (sameWhiteTower(s.whiteTower, createWhiteTowerState()))
      return s.progression.pathwayId !== 'white-tower' || s.progression.sequence !== 0;
    const head = openWhiteTowerOwnedEngine(s);
    assertCurrent(s, snapshotWhiteTowerOwnedEngine(head));
    return true;
  } catch { return false; }
}
export function hasWhiteTowerHistory(s: SliceState): boolean {
  try {
    return s.whiteTower.guidanceKnown && s.whiteTower.source !== null &&
      s.progression.pathwayId === 'white-tower' && validateWhiteTowerSource(s, s.whiteTower.source, 'COLD_REOPEN');
  } catch { return false; }
}
export function hasWhiteTowerLock(s: SliceState): boolean { return hasWhiteTowerHistory(s); }
export function openWhiteTowerOwnedHead(s: SliceState): WhiteTowerOwnedEngine {
  const head = openWhiteTowerOwnedEngine(s);
  assertCurrent(s, snapshotWhiteTowerOwnedEngine(head));
  return head;
}
export function assertOwnedWhiteTowerCurrent(s: SliceState, head: WhiteTowerOwnedEngine): void {
  const root = snapshotWhiteTowerOwnedEngine(head);
  if (!sameWhiteTower(root, s.whiteTower)) throw Error('当前会话与实际存档版本不一致。');
  assertCurrent(s, root);
}
export function whiteTowerCommandBlock(s: SliceState, command: WhiteTowerCommand): string | null {
  if (!validateWhiteTowerCommand(command)) return '这项行动的内容无效。';
  if (s.status !== 'ACTIVE') return '已经死亡或结束的角色不能继续行动。';
  if (command.type === 'LEARN_GUIDANCE') return guidanceBlock(s);
  try { return publicReason(blockWhiteTowerOwnedEngine(openWhiteTowerOwnedHead(s), command, s.revision + 1)); }
  catch { return '当前记录未通过核验，不能继续行动。'; }
}
export function ownedWhiteTowerCommandBlock(s: SliceState, command: WhiteTowerCommand, head: WhiteTowerOwnedEngine): string | null {
  if (!validateWhiteTowerCommand(command)) return '这项行动的内容无效。';
  if (s.status !== 'ACTIVE') return '已经死亡或结束的角色不能继续行动。';
  if (command.type === 'LEARN_GUIDANCE') return '已有本章记录，不能重新开始或补发原物。';
  try {
    assertOwnedWhiteTowerCurrent(s, head);
    return publicReason(blockWhiteTowerOwnedEngine(head, command, s.revision + 1));
  } catch { return '当前记录未通过核验，不能继续行动。'; }
}

function publish(s: SliceState, command: WhiteTowerCommand, root: WhiteTowerState, ctx: SeerContext): void {
  const b = root.frame!.budget;
  s.whiteTower = clone(root);
  s.week = b.week; s.date = clone(b.date); s.actionsRemaining = b.actions;
  s.cash = b.cash; s.health = b.health; s.mind = b.mind; s.spirituality = b.spirituality; s.status = b.status;
  s.injuries = clone(b.injuries); s.injuryRisk = b.injuryRisk;
  s.progression.sequence = b.sequence; s.progression.acting = b.acting;
  s.progression.mastery = { ...b.mastery }; s.character.coreStats = { ...b.coreStats };
  s.seer.pollution = b.pollution; s.seer.completedSources = [...b.completedSources];
  s.random = { ...root.frame!.random }; Object.assign(s, clone(root.frame!.finance));
  const event = command.type === 'LEARN_GUIDANCE' ? null : root.journal.at(-1)!;
  s.lastCheck = event?.randomReceipts.length ? clone(event.randomReceipts.at(-1)!.check) : null;
  if (!event) ctx.note('三条通路与白塔晋升指导', '已支付100便士与1行动核对本人身份、三份全知之眼原特性和实际履历。旧人物、原物、当前伤势和旧账保留；从接待处分别步行去市场、运河和公寓，问过原居民后实际施工，逐人通过并于下一真实周回来复核。');
  else {
    for (const receipt of event.financeReceipts) ctx.note(receipt.title, receipt.text);
    ctx.note(b.sequence === 0 ? '白塔当前行动' : '三条通路当前行动', event.notes.join(''));
  }
}
export function applyWhiteTowerCommand(s: SliceState, command: WhiteTowerCommand, ctx: SeerContext): void {
  if (!validateWhiteTowerCommand(command) || s.status !== 'ACTIVE') throw Error('当前不能执行这项行动。');
  let root: WhiteTowerState;
  if (command.type === 'LEARN_GUIDANCE') {
    const reason = guidanceBlock(s); if (reason) throw Error(reason);
    root = startWhiteTower(s);
  } else root = snapshotWhiteTowerOwnedEngine(advanceWhiteTowerOwnedEngine(openWhiteTowerOwnedHead(s), command, s.revision + 1));
  publish(s, command, root, ctx);
}
export function applyOwnedWhiteTowerCommand(s: SliceState, command: WhiteTowerCommand, ctx: SeerContext, head: WhiteTowerOwnedEngine): WhiteTowerOwnedEngine {
  assertOwnedWhiteTowerCurrent(s, head);
  if (!validateWhiteTowerCommand(command) || command.type === 'LEARN_GUIDANCE' || s.status !== 'ACTIVE')
    throw Error('当前不能执行这项行动。');
  const next = advanceWhiteTowerOwnedEngine(head, command, s.revision + 1);
  publish(s, command, snapshotWhiteTowerOwnedEngine(next), ctx);
  return next;
}
export function projectWhiteTower(s: SliceState): WhiteTowerProjection {
  return projection(s, sameWhiteTower(s.whiteTower, createWhiteTowerState()) ? null : openWhiteTowerOwnedHead(s));
}
export function projectOwnedWhiteTower(s: SliceState, head: WhiteTowerOwnedEngine): WhiteTowerProjection {
  assertOwnedWhiteTowerCurrent(s, head);
  return projection(s, head);
}

const passageLocation: Record<string, string> = { 'market-steps': 'WT0-MARKET', 'canal-gallery': 'WT0-CANAL', 'apartment-alley': 'WT0-ALLEY' };
const safetyTypes = new Set(['STOP_ESCORT','RELEASE','STOP_EFFECTS','RETURN_ON_FOOT','WITHDRAW','ORDINARY_SIDE_EXIT','UNLOAD','UNLOAD_STRUT','COLLECT_TOOLS']);
function desiredCommand(root: WhiteTowerState): WhiteTowerCommand | null {
 const f=root.frame!,b=f.budget,h=whiteTowerHost(root,`R214:${root.source!.runId}:${root.source!.revision+2+root.journal.length}`,root.source!.revision+2+root.journal.length);
 const at=(to:string,c:WhiteTowerCommand):WhiteTowerCommand=>f.location===to?c:{type:'TRAVEL',to};
 if(root.epilogue){
  const actions=getWhiteTowerEpilogueActions(root.epilogue,h);
  const action=actions.find(a=>a.preferredAction)??actions.find(a=>a.enabled&&!safetyTypes.has(a.command.type))??actions.find(a=>a.enabled);
  return action?{type:'EPILOGUE',command:action.command}:null;
 }
 if(b.sequence===0){
  if(b.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null))return {type:'CLINIC'};
  if(b.health<80||b.mind<40||b.spirituality<28||b.injuries.length)return {type:'REST'};
  if(b.actions<(f.location===WHITE_TOWER_GATE?2:3))return {type:'NEXT_WEEK'};
  return at(WHITE_TOWER_GATE,{type:'START_EPILOGUE'});
 }
 const passageActions=getWhiteTowerPassageActions(root.passages!,h);
 if(!canLeaveWhiteTowerPassages(root.passages!,f.location)){
  const cleanup=passageActions.find(a=>a.preferredAction)??passageActions.find(a=>a.enabled&&a.command.type==='RETURN_ON_FOOT');
  if(cleanup)return {type:'PASSAGE',command:cleanup.command};
 }
 const failed=root.materials!.compounds.find(p=>p.status==='FAILED_EXPOSED'||p.status==='FAILED_SEALED');
 if(failed)return at(failed.location,{type:'MATERIAL',command:{type:failed.status==='FAILED_EXPOSED'?'SEAL_REMAINS':'RECOVER_SEALED',compoundId:failed.id}});
 if(b.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null))return {type:'CLINIC'};
 if(b.injuries.length||b.health<80||b.mind<78||b.spirituality<42)return {type:'REST'};
 const verified=whiteTowerPassageVerifiedReceipts(root.passages!);
 if(verified.length<3){
  const next=passageActions.find(a=>a.preferredAction)??passageActions.find(a=>a.enabled&&!safetyTypes.has(a.command.type));
  if(next)return at(passageLocation[next.command.passageId]!,{type:'PASSAGE',command:next.command});
  const pending=root.passages!.routes.filter(r=>!verified.some(v=>v.passageId===r.id));
  const actionable=pending.find(r=>r.location===f.location&&(!r.passage||b.week>r.passage.week))??pending.find(r=>!r.passage||b.week>r.passage.week);
  if(actionable){
   if(f.location!==actionable.location)return {type:'TRAVEL',to:actionable.location};
   // On site with insufficient actions/resources, retain the real next intent;
   // projection can recommend actual work or the next week without skipping it.
   const type=!actionable.survey?'SURVEY':!actionable.construction?'BUILD':actionable.passage?'REVIEW_NEXT_WEEK':'PASS_RESIDENT';
   return {type:'PASSAGE',command:{type,passageId:actionable.id}};
  }
  return f.finance.wagePaidWeek!==b.week&&b.actions>0?{type:'WORK'}:{type:'NEXT_WEEK'};
 }
 const m=root.materials!,item=m.characteristics.find(i=>!['EMBODIED','COMPOUND','FUSED'].includes(i.holder)&&(i.holder!=='PLAYER'||!i.acquiredEventId));
 if(item){
  let command:WhiteTowerMaterialCommand;
  if(item.holder==='SUPPLIER'){
   const taskId=WHITE_TOWER_LABOUR_IDS[item.inheritedLabourSteps+item.labour.length];
   command=taskId?{type:'MATERIAL_LABOUR',bottleId:item.originBottleId,taskId}:{type:'ACQUIRE_CHARACTERISTIC',bottleId:item.originBottleId};
  }else {
   const site=m.legacySites.find(site=>site.originalBottleId===item.originBottleId);
   command={type:item.holder==='PLAYER'?'ACQUIRE_CHARACTERISTIC':site&&(site.permissionWeek!==b.week||site.investigation!=='ALLOW'||site.handover!=='ALLOW')?'ASK_LEGACY_PERMISSION':item.holder==='UNLOCATED'?'INVESTIGATE_LEGACY_REMAINS':item.holder==='LOCATED'?'SEAL_LEGACY_REMAINS':'RECOVER_LEGACY_REMAINS',bottleId:item.originBottleId};
  }
  const location=item.holder==='PLAYER'?item.location!:item.holder==='SUPPLIER'?WHITE_TOWER_SUPPLIER:WHITE_TOWER_MATERIAL_POLICY.legacyLocation;
  return at(location,{type:'MATERIAL',command});
 }
 if(['UNVERIFIED','CUSTODIAN'].includes(m.uniqueness.holder)){
  if(!m.uniqueness.checks.some(c=>c.step==='CHAIN'))return at(WHITE_TOWER_ARCHIVE,{type:'MATERIAL',command:{type:'VERIFY_UNIQUENESS',step:'CHAIN'}});
  if(!m.uniqueness.checks.some(c=>c.step==='VACANCY'&&c.week===b.week))return at(WHITE_TOWER_VAULT,{type:'MATERIAL',command:{type:'VERIFY_UNIQUENESS',step:'VACANCY'}});
  return at(WHITE_TOWER_VAULT,{type:'MATERIAL',command:{type:'ACQUIRE_UNIQUENESS'}});
 }
 const p=m.compounds.find(p=>p.status==='PREPARED');
 if(p){const preview=getWhiteTowerPromotionStabilityPreview(root,p.id);return at(WHITE_TOWER_WORKSHOP,preview.prepared?{type:'CONSUME',compoundId:p.id,confirmed:true}:{type:'STABILIZE_PROMOTION',compoundId:p.id});}
 const held=m.batches.find(x=>x.status==='PLAYER');if(held)return at(WHITE_TOWER_WORKSHOP,{type:'MATERIAL',command:{type:'COMPOSE_POTION',batchId:held.id}});
 const supplier=m.batches.find(x=>x.status==='SUPPLIER');if(supplier)return at(WHITE_TOWER_SUPPLIER,{type:'MATERIAL',command:{type:'BUY_COMPOUND',batchId:supplier.id}});
 return null;
}
function projection(s: SliceState,head: WhiteTowerOwnedEngine|null): WhiteTowerProjection {
 const root=head?snapshotWhiteTowerOwnedEngine(head):s.whiteTower,f=root.frame,b=f?.budget??whiteTowerBudget(s),promoted=s.progression.pathwayId==='white-tower'&&b.sequence===0&&root.promotionWeek!==null;
 const definitions=s.progression.pathwayId==='white-tower'?[...ALL_KNOWING_EYE_INHERITED_ABILITIES,...ALL_KNOWING_EYE_ABILITIES,...(promoted?WHITE_TOWER_ABILITIES:[])]:[];
 const result:WhiteTowerProjection={title:'序列0 白塔',guidanceKnown:root.guidanceKnown,promoted,story:WHITE_TOWER_STORY,nextStep:WHITE_TOWER_GOAL,risk:WHITE_TOWER_RISK,
  resources:{health:b.health,mind:b.mind,spirituality:b.spirituality,cash:`${b.cash}便士`,actionsRemaining:b.actions},
  abilities:definitions.filter(a=>Object.hasOwn(b.mastery,a.id)).map(a=>({id:a.id,label:a.label,description:a.description,mastery:b.mastery[a.id]??0})),
  actions:[],sections:[],insideCase:root.epilogue?.status==='ACTIVE'||!!root.passages&&!!f&&!canLeaveWhiteTowerPassages(root.passages,f.location)};
 const add=(command:WhiteTowerCommand,label:string,cost:string)=>{const reason=publicReason(head?blockWhiteTowerOwnedEngine(head,command,s.revision+1):whiteTowerCommandBlock(s,command));result.actions.push({id:`white-tower:${result.actions.length}:${command.type}`,label,cost,command:clone(command),enabled:reason===null,reason});};
 if(!root.guidanceKnown){add({type:'LEARN_GUIDANCE'},'听取三条通路与三份原特性指导','1行动、100便士');result.actions[0]!.preferredAction=true;return result;}
 const h=whiteTowerHost(root,`R214:${root.source!.runId}:${s.revision+1}`,s.revision+1),place=WHITE_TOWER_CITY_PLACES.find(p=>p.id===f!.location)?.title??'当前现场';
 const hour=Math.floor(f!.nowSecond%86400/3600),minute=Math.floor(f!.nowSecond%3600/60);
 result.sections.push({id:'clock',title:'实际日历与当前地点',lines:[`当前位置：${place}；第${b.week}周，${h.date.year}年${h.date.month}月${h.date.day}日 ${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')}。`,`距下一真实周界${Math.ceil((f!.weekAnchor+604800-f!.nowSecond)/3600)}小时；跨界结生活费与旧债，只有实际工作才取得本周工资。`]});
 const passages=projectWhiteTowerPassages(root.passages!);
 result.sections.push({id:'white-tower-passages',title:'三条真实通路与隔周复核',lines:passages.lines});
 result.sections.push({id:'materials',...projectWhiteTowerMaterials(root.materials!)});
 const succession=whiteTowerSuccessionAt(h.date);
 result.sections.push({id:'future-branch',title:'同一原件与当前保管',lines:succession?[WHITE_TOWER_FUTURE_BRANCH.story,'仍须本人核查已发生的保管链、复核当前空位并当面交接；已经转交的同一原件不能重复领取。']:['当前尚无可核实的空位、析出和原件交接记录，不能提前取得仍在容纳中的原物。','可以继续普通工作、修补通路或稍后回来查询；等待不会发工资、补材料或保护生命。']});
 result.sections.push({id:'finance',title:'实际工资、生活与旧债',lines:[`现款${b.cash}便士；原职业每周${root.source!.character.weeklyWage}便士，须本人实际工作一次。`,`未付本金${f!.finance.debts.reduce((sum,d)=>sum+d.remaining,0)}便士；下次约定还款${f!.finance.debts.reduce((sum,d)=>sum+Math.min(d.remaining,d.weeklyPayment),0)}便士。`,'没有自动工资，周结不足生活费如实计欠，再转赤贫生活。']});
 result.sections.push({id:'body',title:'原身体、21项旧掌握与原物',lines:[`${s.character.name}，${s.character.age}岁；健康${b.health}，精神${b.mind}，灵性${b.spirituality}/${promoted?WHITE_TOWER_SPIRITUALITY_CAP:120}，污染${b.pollution}，意志${b.coreStats.will}。`,...(b.injuries.length?b.injuries.map(i=>`${i.severity==='HEAVY'?'重伤':'轻伤'}：${i.treatedRevision===null?'尚未处置':'已普通处置，仍须之后实际休养'}。`):['当前没有实际伤势。']),'原纸、耗尽的示范器、停止的滑块与止挡块、埃德温的原杖仍按旧去向保留，原人物不会复活或随行。','全部旧掌握逐值保留，原本为零的技能不补练；两项新技巧实际晋升后才从零开始。','普通处置实付60便士与1行动；赤贫休养每次只恢复8健康，未经处置的重伤不会自行消失。']});
 const originals=root.source!.originals,old=originals.encounter,rod=old.materials.weapon;
 result.sections.push({id:'source-originals',title:'原人原物的已知去向',lines:[
  `埃德温·罗斯：${old.enemyStatus==='SURRENDERED'?'已投降':old.enemyStatus==='DEAD'?'已经死亡':'仍抵抗'}，健康${old.enemyHealth}、精神${old.enemyMind}、灵性${old.enemySpirituality}。原杖仍归本人，${rod.location==='YARD'?'留在原庭院':'仍在本人手中'}，储能${rod.charge}。`,
  ...originals.wisdom.papers.map(p=>`${p.id}仍是玛拉的同一原纸，${p.location==='TABLE'?'留在原桌':'由本人持有'}；最初实际阅读${p.firstReadWeek===null?'尚未发生':`在第${p.firstReadWeek}周`}。`),
  `原示范器仍归玛拉，${originals.wisdom.device.filter==='AMBER'?'琥珀':'透明'}滤片，条件版本${originals.wisdom.device.conditionVersion}，储能${originals.wisdom.device.charges}。`,
  `原滑块与止挡块${originals.rig.owner==='PLAYER'?'归本人':'归伊蕾娜'}，${originals.rig.motion==='STOPPED'?'已经停止':originals.rig.motion==='COCKED'?'仍待发':'静止'}，条件版本${originals.rig.conditionVersion}；未用于新通路。`,
 ]});
 const latest=root.journal.at(-1);
 result.sections.push({id:'recent-action',title:'最近实际行动与费用',lines:latest?[...latest.notes,...latest.financeReceipts.map(r=>r.text),...latest.randomReceipts.map(r=>`本次实际检定：成功率${r.check.chance}%，掷出${r.check.roll}，${r.check.tier==='SUCCESS'?'成功':r.check.tier==='GREAT_SUCCESS'?'大成功':r.check.tier==='FAILURE'?'失败':'严重失败'}。`),`现款变化${latest.after.budget.cash-latest.before.budget.cash}便士；行动变化${latest.after.budget.actions-latest.before.budget.actions}，健康变化${latest.after.budget.health-latest.before.budget.health}，精神变化${latest.after.budget.mind-latest.before.budget.mind}，灵性变化${latest.after.budget.spirituality-latest.before.budget.spirituality}。`]:['已实际支付100便士和1行动听取指导，旧身体、原人原物与既往费用仍在。']});
 if(root.epilogue){
  const ep=projectWhiteTowerEpilogue(root.epilogue);result.story=ep.story;result.nextStep=ep.nextStep;
  result.sections.unshift({id:'epilogue',title:'同一机械结构上的有限应对',lines:ep.lines});
  for(const a of getWhiteTowerEpilogueActions(root.epilogue,h))add({type:'EPILOGUE',command:a.command},a.label,a.cost);
  const insight=getWhiteTowerEpilogueCheckPreview(root,'STRUCTURAL_INSIGHT'),weak=getWhiteTowerEpilogueCheckPreview(root,'BOUNDED_WEAK_POINT');
  result.sections.push({id:'epilogue-readiness',title:'本场两次有限尝试与普通退路',lines:[`结构洞察${insight?.chance}%：12灵性、8精神，最多30秒；有限弱处${weak?.chance}%：16灵性、10精神，最多10秒。`,'各只尝试一次，成功开窗仍须独立核验或实际利用；遮挡、结构改变、对手重构与超时会使旧窗口失效。','普通锁闸、撑杆卸力与侧路逐人退出不依赖能力成功；失败费用不退。']});
 }
 if(!promoted){
  for(const a of getWhiteTowerPassageActions(root.passages!,h))add({type:'PASSAGE',command:a.command},a.label,a.cost);
  for(const a of getWhiteTowerMaterialActions(root.materials!,WHITE_TOWER_MATERIAL_POLICY))add({type:'MATERIAL',command:a.command},a.label,a.cost);
  const lines:string[]=[];
  for(const p of root.materials!.compounds.filter(c=>c.status==='PREPARED')){
   const preview=getWhiteTowerPromotionStabilityPreview(root,p.id);
   lines.push(`本瓶付费准备后的实际成功率${preview.preparedChance}%；${preview.prepared?'同一现场七天准备仍有效':'尚无有效准备，当前不能饮用'}。`,'准备实付100便士、1行动、12灵性与8精神，绑定本人、同一成药、原调配室和三处真实通过与隔周复核；离场、过期或饮用失效。','意志加本次准备40、难度58，实际成为全知之眼至少12周。成功再扣12精神；普通失败扣45健康、40精神、加35污染及重伤；严重失败扣110健康、100精神、加70污染，可以死亡。');
   add({type:'STABILIZE_PROMOTION',compoundId:p.id},'为同一瓶完成真实付费稳定准备','1行动、100便士、12灵性、8精神');
   add({type:'CONSUME',compoundId:p.id,confirmed:true},'独立确认当前风险并饮用同一瓶',`1行动、30灵性；有效准备后${preview.preparedChance}%成功；可能重伤、污染或死亡`);
  }
  if(lines.length)result.sections.push({id:'promotion-stability',title:'本瓶准备与实际服药风险',lines});
 }else if(!root.epilogue)add({type:'START_EPILOGUE'},'进入旧机械闸的当前事故现场','现场十分钟，不补资源；居民仍须真实逐人通过');
 for(const destination of WHITE_TOWER_CITY_PLACES)if(destination.id!==f!.location)add({type:'TRAVEL',to:destination.id},`沿普通道路步行前往${destination.title}`,'1行动、0便士，实际半小时');
 if(f!.location!==WHITE_TOWER_HOME)add({type:'RETURN_ON_FOOT'},'本人沿普通路返回街区接待处','0行动、0便士，实际两小时；未同行居民与封存残余留原处');
 add({type:'WORK'},'做本周原职业工作',`1行动，${root.source!.character.weeklyWage}便士，每周一次`);
 add({type:'CLINIC'},'付费普通处置真实重伤','1行动、60便士，之后仍须实际休养');
 add({type:'REST'},'按实际生活档休养','1行动，实际八小时；未处置的重伤仍保留');
 add({type:'NEXT_WEEK'},'走到下一真实周界','结算生活费与约定还款；没有工资或恢复');
 const desired=desiredCommand(root);
 let preferred=result.actions.find(a=>sameWhiteTower(a.command,desired));
 if(preferred&&!preferred.enabled&&!result.insideCase){
  const work=result.actions.find(a=>a.command.type==='WORK'&&a.enabled);
  const week=result.actions.find(a=>a.command.type==='NEXT_WEEK'&&a.enabled);
  preferred=work??week??preferred;
 }
 if(preferred){preferred.preferredAction=true;result.nextStep=`${preferred.label}。${preferred.reason??'按实际成本与时间完成这一步。'}`;}
 return result;
}
