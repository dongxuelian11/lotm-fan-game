import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { DeathCommand, DeathProjection, DeathState } from './types.js';
import { createDeathState, startDeath, sameDeath, deathDigest, validateDeathCommand,
  openDeathOwnedEngine, snapshotDeathOwnedEngine, advanceDeathOwnedEngine, blockDeathOwnedEngine,
  assertOwnedDeathCurrent as assertEngineCurrent, getDeathPromotionStabilityPreview, deathHost,
  type DeathOwnedEngine, type DeathRuntimeState } from './engine.js';
import { deathBudget, deathHistoryDigest, deathAcquisitionSnapshot, deathSourceBlock, validateDeathSource } from './source.js';
import { DEATH_ABILITIES, DEATH_STORY, DEATH_GOAL, DEATH_RISK, DEATH_CITY_PLACES, DEATH_HOME,
  DEATH_GUIDANCE, DEATH_SPIRITUALITY_CAP, DEATH_SUPPLIER, DEATH_WORKSHOP, DEATH_ARCHIVE,
  DEATH_VAULT, DEATH_MATERIAL_LOCATIONS, DEATH_FUTURE_BRANCH } from './content.js';
import { getDeathServiceActions, projectDeathServices, deathServiceVerifiedReceipts,
  canLeaveDeathServices, nextDeathServiceCommand, deathServiceRequiredResources } from './services.js';
import { projectDeathEpilogue, getDeathEpilogueActions, nextDeathEpilogueCommand } from './epilogue.js';
import { getDeathMaterialActions, projectDeathMaterials, deathMaterialEffect } from './materials.js';
import { DEATH_RUNTIME_MATERIAL_POLICY } from './material-content.js';
import { DEATH_LABOUR_IDS, type DeathMaterialCommand } from './types.js';
import { PALE_EMPEROR_ABILITIES, PALE_EMPEROR_INHERITED_ABILITIES } from '../pale-emperor/content.js';
import { computeCheckChance } from '../../resolution/normal-check.js';

export { createDeathState, validateDeathCommand } from './engine.js';
export { deathSourceView } from './source.js';
export type { DeathOwnedEngine } from './engine.js';
export type { DeathCommand, DeathState, DeathProjection } from './types.js';

const clone = <T>(value: T): T => structuredClone(value);

/** Raw entries are replayed before this check. Owned entries use a private
 * branded engine, but still cannot publish into a changed host state. */
function assertCurrent(s: SliceState, root: DeathRuntimeState): void {
  const source = root.source, frame = root.frame;
  if (!source || !frame || s.progression.pathwayId !== 'death' ||
      !sameDeath(deathBudget(s), frame.budget) || !sameDeath(s.random, frame.random))
    throw Error('当前身体、资源与实际行动记录不一致。');
  if (s.revision !== source.revision + 1 + root.journal.length)
    throw Error('当前实际行动次序不一致。');
  const { coreStats: _current, ...identity } = s.character;
  const { coreStats: _source, ...originalIdentity } = source.character;
  if (!sameDeath(identity, originalIdentity) || Object.entries(frame.finance)
      .some(([key, value]) => !sameDeath(s[key as keyof SliceState], value)))
    throw Error('当前身份或实际生活账本不一致。');
  if (source.historyDigest !== deathHistoryDigest(s) ||
      source.originalWorldDigest !== deathDigest(s.world) ||
      s.combatHistory.length !== source.combatHistoryLength ||
      source.combatHistoryDigest !== deathDigest(s.combatHistory) ||
      !sameDeath(source.acquisition, deathAcquisitionSnapshot(s)))
    throw Error('旧人物、原物或原瓶履历被改写。');
  if (s.combat !== null || s.activeEvent !== null || s.eventQueue.length || s.pulse !== 'NONE')
    throw Error('本章不能同时开启旧现场。');
  if ((frame.budget.sequence === 0) !== (root.promotionWeek !== null))
    throw Error('当前晋升与实际服药记录不一致。');
}

function guidanceBlock(s: SliceState): string | null {
  if (!sameDeath(s.death, createDeathState()))
    return '已有本章记录，不能重新开始或补发原物。';
  const reason = deathSourceBlock(s);
  if (reason) return reason;
  return s.actionsRemaining < DEATH_GUIDANCE.actions || s.cash < DEATH_GUIDANCE.cash
    ? '指导需要1行动与12便士，可先按当代接待处真实劳动和休养。' : null;
}
function publicReason(reason: string | null): string | null {
  if (reason === null) return null;
  return /[\u3400-\u9fff]/.test(reason) && !/[A-Z_]{6,}|seed|cursor|digest|receipt/i.test(reason)
    ? reason : '当前原件、实际所在地或前一步条件尚不满足。';
}
export function validateDeathState(s: SliceState): boolean {
  try {
    if (sameDeath(s.death, createDeathState()))
      return s.progression.pathwayId !== 'death' || s.progression.sequence !== 0;
    const head = openDeathOwnedEngine(s);
    assertCurrent(s, snapshotDeathOwnedEngine(head));
    return true;
  } catch { return false; }
}
export function hasDeathHistory(s: SliceState): boolean {
  try {
    return s.death.guidanceKnown && s.death.source !== null &&
      s.progression.pathwayId === 'death' && validateDeathSource(s, s.death.source, 'COLD_REOPEN');
  } catch { return false; }
}
export function hasDeathLock(s: SliceState): boolean { return hasDeathHistory(s); }
export function openDeathOwnedHead(s: SliceState): DeathOwnedEngine {
  const head = openDeathOwnedEngine(s);
  assertCurrent(s, snapshotDeathOwnedEngine(head));
  return head;
}
export function assertOwnedDeathCurrent(s: SliceState, head: DeathOwnedEngine): void {
  const root = snapshotDeathOwnedEngine(head);
  if (!sameDeath(root, s.death)) throw Error('当前会话与实际存档版本不一致。');
  assertEngineCurrent(s, head);
}
export function deathCommandBlock(s: SliceState, command: DeathCommand): string | null {
  if (!validateDeathCommand(command)) return '这项行动的内容无效。';
  if (s.status !== 'ACTIVE') return '已经死亡或结束的角色不能继续行动。';
  if (command.type === 'LEARN_GUIDANCE') return guidanceBlock(s);
  try { return publicReason(blockDeathOwnedEngine(openDeathOwnedHead(s), command, s.revision + 1)); }
  catch { return '当前记录未通过核验，不能继续行动。'; }
}
export function ownedDeathCommandBlock(s: SliceState, command: DeathCommand, head: DeathOwnedEngine): string | null {
  if (!validateDeathCommand(command)) return '这项行动的内容无效。';
  if (s.status !== 'ACTIVE') return '已经死亡或结束的角色不能继续行动。';
  if (command.type === 'LEARN_GUIDANCE') return '已有本章记录，不能重新开始或补发原物。';
  try {
    assertOwnedDeathCurrent(s, head);
    return publicReason(blockDeathOwnedEngine(head, command, s.revision + 1));
  } catch { return '当前记录未通过核验，不能继续行动。'; }
}

function publish(s: SliceState, command: DeathCommand, root: DeathRuntimeState, ctx: SeerContext): void {
  const b = root.frame!.budget;
  s.death = clone(root);
  s.week = b.week; s.date = clone(b.date); s.actionsRemaining = b.actions;
  s.cash = b.cash; s.health = b.health; s.mind = b.mind; s.spirituality = b.spirituality; s.status = b.status;
  s.injuries = clone(b.injuries); s.injuryRisk = b.injuryRisk;
  s.progression.sequence = b.sequence; s.progression.acting = b.acting;
  s.progression.mastery = { ...b.mastery }; s.character.coreStats = { ...b.coreStats };
  s.seer.pollution = b.pollution; s.seer.completedSources = [...b.completedSources];
  s.random = { ...root.frame!.random }; Object.assign(s, clone(root.frame!.finance));
  const event = command.type === 'LEARN_GUIDANCE' ? null : root.journal.at(-1)!;
  s.lastCheck = event?.randomReceipts.length ? clone(event.randomReceipts.at(-1)!.check) : null;
  if (!event) ctx.note('原残响与旧码头交接指导', '已支付12便士与1行动核对本人身份、三份苍白皇帝原特性和实际履历。旧人物、原物、伤势与费用原样保留；先处理本人伤势，再沿普通道路到保管室和旧码头，完成实际封存、带人退出与复核。');
  else {
    for (const receipt of event.financeReceipts) ctx.note(receipt.title, receipt.text);
    ctx.note(b.sequence === 0 ? '死神当前行动' : '居民服务当前行动', event.notes.join(''));
  }
}
export function applyDeathCommand(s: SliceState, command: DeathCommand, ctx: SeerContext): void {
  if (!validateDeathCommand(command) || s.status !== 'ACTIVE') throw Error('当前不能执行这项行动。');
  let root: DeathRuntimeState;
  if (command.type === 'LEARN_GUIDANCE') {
    const reason = guidanceBlock(s); if (reason) throw Error(reason);
    root = startDeath(s);
  } else root = snapshotDeathOwnedEngine(advanceDeathOwnedEngine(openDeathOwnedHead(s), command, s.revision + 1));
  publish(s, command, root, ctx);
}
export function applyOwnedDeathCommand(s: SliceState, command: DeathCommand, ctx: SeerContext, head: DeathOwnedEngine): DeathOwnedEngine {
  assertOwnedDeathCurrent(s, head);
  if (!validateDeathCommand(command) || command.type === 'LEARN_GUIDANCE' || s.status !== 'ACTIVE')
    throw Error('当前不能执行这项行动。');
  const next = advanceDeathOwnedEngine(head, command, s.revision + 1);
  publish(s, command, snapshotDeathOwnedEngine(next), ctx);
  return next;
}
export function projectDeath(s: SliceState): DeathProjection {
  return projection(s, sameDeath(s.death, createDeathState()) ? null : openDeathOwnedHead(s));
}
export function projectOwnedDeath(s: SliceState, head: DeathOwnedEngine): DeathProjection {
  assertOwnedDeathCurrent(s, head);
  return projection(s, head);
}

/** Recommendations are derived from current objects and already completed
 * actions. They never supply checks, resources, custody or permission. */
function desiredCommand(root: DeathRuntimeState): DeathCommand | null {
  const f=root.frame!, b=f.budget, m=root.materials!;
  const h=deathHost(root,`R217:${root.source!.runId}:${root.source!.revision+2+root.journal.length}`,root.source!.revision+2+root.journal.length);
  // Plan the actual next paid step before sending an under-resourced player
  // away from reception. This is a read-only suggestion, never a free action.
  const at=(to:string,c:DeathCommand):DeathCommand=>{
    if(f.location===to)return c;
    if(f.location===DEATH_HOME&&to!==DEATH_HOME){
      const need=c.type==='MATERIAL'?deathMaterialEffect(m,c.command,DEATH_RUNTIME_MATERIAL_POLICY)
        :c.type==='STABILIZE_PROMOTION'?{actions:2,cashCost:12}:null;
      if(need&&b.actions<need.actions){
        if(b.actions>0||b.cash<24&&!f.economy.emergencyWorkUsed)return {type:'WORK'};
        return {type:'NEXT_WEEK'};
      }
      if(need&&b.cash<need.cashCost)return {type:'WORK'};
    }
    return {type:'TRAVEL',to};
  };
  const home=(c:DeathCommand)=>at(DEATH_HOME,c);
  if(root.epilogue){
    if(root.epilogue.status==='ACTIVE'){const next=nextDeathEpilogueCommand(root.epilogue,h);return next?{type:'EPILOGUE',command:next}:null;}
    if(f.location!==DEATH_HOME)return {type:'RETURN_ON_FOOT'};
    return f.economy.livingArrears>0?{type:'WORK'}:null;
  }
  if(!canLeaveDeathServices(root.services!,f.location)){
    const action=getDeathServiceActions(root.services!,h).find(a=>a.preferredAction);
    return action?{type:'SERVICE',command:action.command}:null;
  }
  const exposed=m.compounds.find(p=>p.status==='FAILED_EXPOSED');
  if(exposed)return at(exposed.location,{type:'MATERIAL',command:{type:'SEAL_REMAINS',compoundId:exposed.id}});
  if(b.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null))return home({type:'CLINIC'});
  const prepared=m.compounds.find(p=>p.status==='PREPARED');
  const readyToConsume=prepared?getDeathPromotionStabilityPreview(root,prepared.id).prepared:false;
  if(b.health<80||b.mind<(readyToConsume?70:78)||b.spirituality<(readyToConsume?30:42)||b.injuries.length)return home({type:'REST'});
  if(f.economy.livingArrears>0)return home({type:'WORK'});
  if(b.sequence===0)return at('DE0-OLD-WHARF',{type:'START_EPILOGUE'});
  if(deathServiceVerifiedReceipts(root.services!).length<2){
    const required=deathServiceRequiredResources(root.services!,f.location);
    if(required&&b.actions<required.actions)return home(b.cash<24&&!f.economy.emergencyWorkUsed?{type:'WORK'}:{type:'NEXT_WEEK'});
    if(required&&b.cash<required.cash)return home({type:'WORK'});
    const next=nextDeathServiceCommand(root.services!,h);
    if(next)return at(next.serviceId==='residue-sealing'?'DE0-RESIDUE-ROOM':'DE0-OLD-WHARF',{type:'SERVICE',command:next});
  }
  const failed=m.compounds.find(p=>p.status==='FAILED_SEALED');
  if(failed){
    if(b.week<failed.sealedWeek!+1)return home(b.actions?{type:'WORK'}:{type:'NEXT_WEEK'});
    const site=m.recoverySites.find(x=>x.compoundId===failed.id);
    const allowed=site?.handover?.status==='ALLOW'&&site.handover.week===b.week;
    return at(failed.location,{type:'MATERIAL',command:{type:allowed?'RECOVER_SEALED':'ASK_RECOVERY_PERMISSION',compoundId:failed.id}});
  }
  const item=m.characteristics.find(i=>!['EMBODIED','COMPOUND','FUSED'].includes(i.holder)&&(i.holder!=='PLAYER'||!i.acquiredEventId));
  if(item){
    let command:DeathMaterialCommand;
    if(item.holder==='SUPPLIER'){
      const taskId=DEATH_LABOUR_IDS[item.inheritedLabourSteps+item.labour.length];
      command=taskId?{type:'MATERIAL_LABOUR',bottleId:item.originBottleId,taskId}:{type:'ACQUIRE_CHARACTERISTIC',bottleId:item.originBottleId};
      return at(DEATH_SUPPLIER,{type:'MATERIAL',command});
    }
    if(item.holder==='PLAYER')return at(item.location??DEATH_SUPPLIER,{type:'MATERIAL',command:{type:'ACQUIRE_CHARACTERISTIC',bottleId:item.originBottleId}});
    const site=m.legacySites.find(x=>x.originalBottleId===item.originBottleId);
    const remains=m.legacyRemains.find(x=>x.originalBottleId===item.originBottleId);
    if(item.holder==='LEGACY_SEALED'&&item.legacyLabour&&b.week<remains!.sealedWeek!+1)
      return home(b.actions?{type:'WORK'}:{type:'NEXT_WEEK'});
    const permitted=site?.investigation?.status==='ALLOW'&&site.handover?.status==='ALLOW'&&site.investigation.week===b.week&&site.handover.week===b.week;
    const type:Extract<DeathMaterialCommand,{bottleId:unknown}>['type']=!permitted?'ASK_LEGACY_PERMISSION':item.holder==='UNLOCATED'?'INVESTIGATE_LEGACY_REMAINS':item.holder==='LOCATED'?'SEAL_LEGACY_REMAINS':!item.legacyLabour?'LEGACY_LABOUR':'RECOVER_LEGACY_REMAINS';
    return at(DEATH_MATERIAL_LOCATIONS.originalRoom,{type:'MATERIAL',command:{type,bottleId:item.originBottleId}});
  }
  if(['UNVERIFIED','CUSTODIAN'].includes(m.uniqueness.holder)){
    if(!m.uniqueness.checks.some(c=>c.step==='CHAIN'))return at(DEATH_ARCHIVE,{type:'MATERIAL',command:{type:'VERIFY_UNIQUENESS',step:'CHAIN'}});
    const permission=root.materialScene!.uniqueness.permission;
    if(permission?.status!=='ALLOW'||permission.week!==b.week)return at(DEATH_VAULT,{type:'MATERIAL',command:{type:'ASK_UNIQUENESS_PERMISSION'}});
    if(!m.uniqueness.checks.some(c=>c.step==='VACANCY'&&c.week===b.week))return at(DEATH_VAULT,{type:'MATERIAL',command:{type:'VERIFY_UNIQUENESS',step:'VACANCY'}});
    return at(DEATH_VAULT,{type:'MATERIAL',command:{type:'ACQUIRE_UNIQUENESS'}});
  }
  const p=m.compounds.find(p=>p.status==='PREPARED');
  if(p){
    if(b.week<root.source!.acquisition.promotionWeek+12)return home(b.actions?{type:'WORK'}:{type:'NEXT_WEEK'});
    const preview=getDeathPromotionStabilityPreview(root,p.id);
    if(!preview.prepared&&b.actions<2)return home(b.actions>0||b.cash<24&&!f.economy.emergencyWorkUsed?{type:'WORK'}:{type:'NEXT_WEEK'});
    return at(DEATH_WORKSHOP,preview.prepared?{type:'CONSUME',compoundId:p.id,confirmed:true}:{type:'STABILIZE_PROMOTION',compoundId:p.id});
  }
  const held=m.batches.find(x=>x.status==='PLAYER');if(held)return at(DEATH_WORKSHOP,{type:'MATERIAL',command:{type:'COMPOSE_POTION',batchId:held.id}});
  const supplier=m.batches.find(x=>x.status==='SUPPLIER');if(supplier)return at(DEATH_SUPPLIER,{type:'MATERIAL',command:{type:'BUY_COMPOUND',batchId:supplier.id}});
  return null;
}
function projection(s:SliceState,head:DeathOwnedEngine|null):DeathProjection {
  const root=head?snapshotDeathOwnedEngine(head):s.death, f=root.frame, b=f?.budget??deathBudget(s);
  const promoted=s.progression.pathwayId==='death'&&b.sequence===0&&root.promotionWeek!==null;
  const defs=s.progression.pathwayId==='death'?[...PALE_EMPEROR_INHERITED_ABILITIES,...PALE_EMPEROR_ABILITIES,...(promoted?DEATH_ABILITIES:[])]:[];
  const result:DeathProjection={title:'序列0 死神',guidanceKnown:root.guidanceKnown,promoted,story:DEATH_STORY,nextStep:DEATH_GOAL,risk:DEATH_RISK,
    resources:{health:b.health,maxHealth:100,mind:b.mind,maxMind:100,spirituality:b.spirituality,maxSpirituality:promoted?DEATH_SPIRITUALITY_CAP:120,cash:`${b.cash}便士`,actionsRemaining:b.actions,weeklyBudget:f?.finance.weeklyBudget??s.weeklyBudget},
    abilities:defs.filter(a=>Object.hasOwn(b.mastery,a.id)).map(a=>({...a,mastery:b.mastery[a.id]??0})),
    injuries:b.injuries.map(i=>({id:i.id,severity:i.severity,treated:i.treatedRevision!==null})),injuryRisk:b.injuryRisk,actions:[],sections:[],
    insideCase:root.epilogue?.status==='ACTIVE'||!!root.services&&!!f&&!canLeaveDeathServices(root.services,f.location)};
  const add=(command:DeathCommand,label:string,cost:string)=>{
    const reason=publicReason(head?blockDeathOwnedEngine(head,command,s.revision+1):deathCommandBlock(s,command));
    result.actions.push({id:`death:${result.actions.length}:${command.type}`,label,cost,command:clone(command),enabled:reason===null,reason});
  };
  if(!root.guidanceKnown){add({type:'LEARN_GUIDANCE'},'听取原残响与旧码头交接指导','1行动、12便士');result.actions[0]!.preferredAction=true;return result;}
  const h=deathHost(root,`R217:${root.source!.runId}:${s.revision+1}`,s.revision+1);
  const place=DEATH_CITY_PLACES.find(p=>p.id===f!.location)?.title??'当前现场';
  result.sections.push({id:'clock',title:'实际日历与地点',lines:[`当前位置：${place}；第${b.week}周，${b.date.year}年${b.date.month}月${b.date.day}日。`,`距下一周界${Math.ceil((f!.weekAnchor+604800-f!.nowSecond)/3600)}小时，届时实际收24便士生活费并给下周4行动；没有自动工资。`]});
  result.sections.push({id:'finance',title:'当代劳动与实际欠费',lines:[`现款${b.cash}便士；本章未付生活费${f!.economy.livingArrears}便士。`,'每次劳动用1行动，收入24便士，先偿本章生活欠费。0行动且不足24便士时，每周有一次真实补劳动；已用额度不重置。','休养实付8便士与1行动，恢复5健康、8精神、10灵性；重伤须先付60便士普通诊治，之后实际休养至80健康。','必要返程跨周不足的生活费记实际差额。没有免费跳周，未偿前不能继续新采购或服药准备。']});
  result.sections.push({id:'body',title:'同一身体与原掌握',lines:[`${s.character.name}当前健康${b.health}、精神${b.mind}、灵性${b.spirituality}/${promoted?150:120}、污染${b.pollution}、伤势风险${b.injuryRisk}。`,...(b.injuries.length?b.injuries.map(i=>`${i.severity==='HEAVY'?'重伤':'轻伤'}：${i.treatedRevision===null?'尚未治疗':'已经处置，仍待实际休养'}。`):['当前没有伤势。']),'全部旧掌握按真实数值保留；晋升不会补练旧零值，两项新技巧须真正应用才增长。']});
  const o=root.source!.originals, old=o.encounter;
  result.sections.push({id:'originals',title:'旧人原物仍在原处',lines:[`阿尔登的原结局为${old.enemyStatus==='DEAD'?'死亡':old.enemyStatus==='SURRENDERED'?'投降':'原记录中的状态'}；旧战不因新委托重开。`,'诺拉的旧残响罐、破封条和薇拉原场封材均保留原数量、磨损与位置；本章不从死者或旧人处补发灵体、封材和武器。','原60年周期与离世记录已经完成，新委托不重新延长周期，也不复活旧人。']});
  result.sections.push({id:'succession',title:'同一神位与原件的保管记录',lines:[DEATH_FUTURE_BRANCH.story]});
  result.sections.push({id:'materials',...projectDeathMaterials(root.materials!,DEATH_RUNTIME_MATERIAL_POLICY)});
  const latest=root.journal.at(-1);
  result.sections.push({id:'recent-action',title:'最近实际行动与代价',lines:latest?[...latest.notes,...latest.randomReceipts.map(r=>`已发生检定：成功率${r.check.chance}%，本次掷值${r.check.roll}，${r.check.tier==='SUCCESS'||r.check.tier==='GREAT_SUCCESS'?'成功':'失败'}。`),`本次现款变化${latest.after.budget.cash-latest.before.budget.cash}便士，行动变化${latest.after.budget.actions-latest.before.budget.actions}，健康变化${latest.after.budget.health-latest.before.budget.health}，精神变化${latest.after.budget.mind-latest.before.budget.mind}，灵性变化${latest.after.budget.spirituality-latest.before.budget.spirituality}。`]:['已支付12便士与1行动完成指导；原身体与旧账继续保留。']});
  if(root.epilogue){
    const ep=projectDeathEpilogue(root.epilogue,f!.nowSecond);
    result.story=ep.status==='ACTIVE'?'同一原罐已经实际送到码头。涌潮牵动原桥绳，有限残余出现一道可见传播风险；先观察并询问，再决定尝试或普通封存撤离。':'这宗同罐、同人事故已有实际处置记录，原费用、伤势和未完成结果均保留。';
    result.sections.unshift({id:'epilogue',title:ep.title,lines:[ep.ordinaryExit,ep.advice,...ep.workers.map(p=>`${p.name}位于${p.position}米处，健康${p.health}，精力${p.energy}。`),...(ep.objects?[`原桥耐久${ep.objects.bridgeCondition}，原绳耐久${ep.objects.ropeCondition}；原罐${ep.objects.vesselLid==='CLOSED'?'已合盖':'仍开盖'}，残余外露${ep.objects.exposed}、罐内${ep.objects.contained}、已消散${ep.objects.dissipated}。`]:['尚未亲自查看当前人、罐和传播线。'])]});
    for(const a of getDeathEpilogueActions(root.epilogue,h))add({type:'EPILOGUE',command:a.command},a.label,a.cost);
    const chance=computeCheckChance({ability:'will',baseAbility:b.coreStats.will,difficulty:37,modifiers:[{source:'实查近岸端点与同一有限目标',value:20}]});
    result.sections.push({id:'abilities-readiness',title:'两次有限尝试',lines:[`当前正常条件下两项技巧的预计成功率均为${chance}%；各只尝试一次。通路耗10灵性、4精神，阻隔耗8灵性、3精神；各磨损原绳2，窗口20秒。`,'开窗不等于应用。必须亲带一人走完六米，或实际挡住一次已见传播，才增加对应掌握。失败仍可普通合盖和沿岸步行退出。']});
  }else{
    result.sections.push({id:'services',title:'两件实际居民事务',lines:projectDeathServices(root.services!).lines});
    if(!promoted){
      for(const a of getDeathServiceActions(root.services!,h))add({type:'SERVICE',command:a.command},a.label,a.cost);
      for(const a of getDeathMaterialActions(root.materials!,DEATH_RUNTIME_MATERIAL_POLICY))add({type:'MATERIAL',command:a.command},a.label,a.cost);
      for(const p of root.materials!.compounds.filter(c=>c.status==='PREPARED')){
        const preview=getDeathPromotionStabilityPreview(root,p.id);
        result.sections.push({id:'promotion-stability',title:'同瓶准备与真实风险',lines:[`付费充分准备后的实际成功率${preview.preparedChance}%；${preview.prepared?'本瓶七天准备仍有效':'尚无有效准备，不能饮用'}。`,`必须距原苍白皇帝晋升满12周（第${root.source!.acquisition.promotionWeek+12}周），健康至少80、精神至少70，无伤。`,'准备12便士、1行动、12灵性、8精神，绑定同瓶、本人和原调配室；离开、过期或饮用后失效。普通失败扣45健康、40精神并增加35污染和重伤，严重失败可能直接死亡。']});
        add({type:'STABILIZE_PROMOTION',compoundId:p.id},'为同一瓶作实际稳定准备','1行动、12便士、12灵性、8精神；1小时');
        add({type:'CONSUME',compoundId:p.id,confirmed:true},'确认真实风险并饮用同一瓶',`1行动、30灵性；有效准备后${preview.preparedChance}%成功，可能死亡`);
      }
    }else add({type:'START_EPILOGUE'},'接下同罐转运并查看旧码头事故','本人最多往返3600米、3665秒，实际耗2精神；跨周照收生活费');
  }
  for(const destination of DEATH_CITY_PLACES)if(destination.id!==f!.location)add({type:'TRAVEL',to:destination.id},`沿普通道路前往${destination.title}`,'0行动、0便士，步行1800米、半小时；跨周照收生活费');
  if(f!.location!==DEATH_HOME)add({type:'RETURN_ON_FOOT'},'沿普通道路返回当代接待处','0行动、0便士，步行1800米、半小时；途中跨周照常计费');
  add({type:'WORK'},'实做当代普通劳动','1行动，收入24便士，实际6小时；收入先偿本章生活欠费');
  add({type:'CLINIC'},'普通处置未治疗重伤','1行动、60便士，1小时；不立即恢复健康');
  add({type:'REST'},'实付费用休养','1行动、8便士，6小时；健康+5、精神+8、灵性+10');
  add({type:'NEXT_WEEK'},'等待下一真实周界','须本周行动用尽；实扣24便士生活费，下周4行动；无工资或自动恢复');
  const desired=desiredCommand(root);let preferred=result.actions.find(a=>sameDeath(a.command,desired));
  if(preferred&&!preferred.enabled&&!result.insideCase){
    const homeAction=result.actions.find(a=>a.command.type==='RETURN_ON_FOOT'&&a.enabled);
    const work=result.actions.find(a=>a.command.type==='WORK'&&a.enabled);
    const week=result.actions.find(a=>a.command.type==='NEXT_WEEK'&&a.enabled);
    preferred=homeAction??work??week??preferred;
  }
  if(preferred){preferred.preferredAction=true;result.nextStep=`${preferred.label}。${preferred.reason??'按显示的真实费用与时间完成。'}`;}
  if(root.epilogue?.reported)result.nextStep='本次事故已如实报告。可沿普通岸路回接待处；不再推荐多余付费休养。';
  return result;
}
