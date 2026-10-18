import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { TyrantAction, TyrantCommand, TyrantProjection, TyrantState } from './types.js';
import {
  createTyrantState, startTyrant, sameTyrant, tyrantDigest,
  validateTyrantCommand, openTyrantOwnedEngine, snapshotTyrantOwnedEngine,
  advanceTyrantOwnedEngine, blockTyrantOwnedEngine,
  getTyrantPromotionStabilityPreview, getTyrantEpilogueCheckPreview,
  tyrantHost, tyrantCurrentGates, tyrantSeaTravel, type TyrantOwnedEngine,
} from './engine.js';
import {
  tyrantBudget, tyrantHistoryDigest, tyrantAcquisitionSnapshot,
  tyrantSourceBlock, validateTyrantSource,
} from './source.js';
import {
  TYRANT_ABILITIES, TYRANT_STORY, TYRANT_GOAL, TYRANT_RISK,
  TYRANT_CITY_PLACES, TYRANT_HOME, TYRANT_GUIDANCE,
  TYRANT_SPIRITUALITY_CAP, TYRANT_SUPPLIER, TYRANT_WORKSHOP, TYRANT_ARCHIVE, TYRANT_VAULT,
} from './content.js';
import { getTyrantCoastActions, projectTyrantCoasts, tyrantCoastEvidence, canLeaveTyrantCoasts, carriedTyrantParcel, TYRANT_COASTS } from './coasts.js';
import { getTyrantChallengeActions, projectTyrantChallenge, canLeaveTyrantChallenge, TYRANT_CHALLENGE_LOCATION } from './challenge.js';
import { projectTyrantEpilogue, getTyrantEpilogueActions } from './epilogue.js';
import { getTyrantMaterialActions, projectTyrantMaterials } from './materials.js';
import { TYRANT_MATERIAL_POLICY, TYRANT_FUTURE_BRANCH, tyrantSuccessionAt } from './material-content.js';
import { TYRANT_LABOUR_IDS, type TyrantMaterialCommand } from './types.js';
import { THUNDER_GOD_ABILITIES, THUNDER_GOD_INHERITED_ABILITIES } from '../thunder-god/content.js';
import { TYRANT_RESCUE } from './content.js';

export { createTyrantState, validateTyrantCommand } from './engine.js';
export { tyrantSourceView } from './source.js';
export type { TyrantOwnedEngine } from './engine.js';
export type { TyrantCommand, TyrantState, TyrantProjection } from './types.js';

const clone = <T>(value: T): T => structuredClone(value);

/** Raw entries are replayed before this check. Owned entries use a private
 * branded engine, but still cannot publish into a changed host state. */
function assertCurrent(s: SliceState, root: TyrantState): void {
  const source = root.source, frame = root.frame;
  if (!source || !frame || s.progression.pathwayId !== 'tyrant' ||
      !sameTyrant(tyrantBudget(s), frame.budget) || !sameTyrant(s.random, frame.random))
    throw Error('当前身体、资源与实际行动记录不一致。');
  if (s.revision !== source.revision + 1 + root.journal.length)
    throw Error('当前实际行动次序不一致。');
  const { coreStats: _current, ...identity } = s.character;
  const { coreStats: _source, ...originalIdentity } = source.character;
  if (!sameTyrant(identity, originalIdentity) || Object.entries(frame.finance)
      .some(([key, value]) => !sameTyrant(s[key as keyof SliceState], value)))
    throw Error('当前身份或实际生活账本不一致。');
  if (source.historyDigest !== tyrantHistoryDigest(s) ||
      source.originalWorldDigest !== tyrantDigest(s.world) ||
      s.combatHistory.length !== source.combatHistoryLength ||
      source.combatHistoryDigest !== tyrantDigest(s.combatHistory) ||
      !sameTyrant(source.acquisition, tyrantAcquisitionSnapshot(s)))
    throw Error('旧人物、原物或原瓶履历被改写。');
  if (s.combat !== null || s.activeEvent !== null || s.eventQueue.length || s.pulse !== 'NONE')
    throw Error('本章不能同时开启旧现场。');
  if ((frame.budget.sequence === 0) !== (root.promotionWeek !== null))
    throw Error('当前晋升与实际服药记录不一致。');
}

function guidanceBlock(s: SliceState): string | null {
  if (!sameTyrant(s.tyrant, createTyrantState()))
    return '已有本章记录，不能重新开始或补发原物。';
  const reason = tyrantSourceBlock(s);
  if (reason) return reason;
  return s.actionsRemaining < TYRANT_GUIDANCE.actions || s.cash < TYRANT_GUIDANCE.cash
    ? '指导需要1行动与100便士，可先按原生活工作与休养。' : null;
}
function publicReason(reason: string | null): string | null {
  if (reason === null) return null;
  return /[\u3400-\u9fff]/.test(reason) && !/[A-Z_]{6,}|seed|cursor|digest|receipt/i.test(reason)
    ? reason : '当前原件、实际所在地或前一步条件尚不满足。';
}
export function validateTyrantState(s: SliceState): boolean {
  try {
    if (sameTyrant(s.tyrant, createTyrantState()))
      return s.progression.pathwayId !== 'tyrant' || s.progression.sequence !== 0;
    const head = openTyrantOwnedEngine(s);
    assertCurrent(s, snapshotTyrantOwnedEngine(head));
    return true;
  } catch { return false; }
}
export function hasTyrantHistory(s: SliceState): boolean {
  try {
    return s.tyrant.guidanceKnown && s.tyrant.source !== null &&
      s.progression.pathwayId === 'tyrant' && validateTyrantSource(s, s.tyrant.source, 'COLD_REOPEN');
  } catch { return false; }
}
export function hasTyrantLock(s: SliceState): boolean { return hasTyrantHistory(s); }
export function openTyrantOwnedHead(s: SliceState): TyrantOwnedEngine {
  const head = openTyrantOwnedEngine(s);
  assertCurrent(s, snapshotTyrantOwnedEngine(head));
  return head;
}
export function assertOwnedTyrantCurrent(s: SliceState, head: TyrantOwnedEngine): void {
  const root = snapshotTyrantOwnedEngine(head);
  if (!sameTyrant(root, s.tyrant)) throw Error('当前会话与实际存档版本不一致。');
  assertCurrent(s, root);
}
export function tyrantCommandBlock(s: SliceState, command: TyrantCommand): string | null {
  if (!validateTyrantCommand(command)) return '这项行动的内容无效。';
  if (s.status !== 'ACTIVE') return '已经死亡或结束的角色不能继续行动。';
  if (command.type === 'LEARN_GUIDANCE') return guidanceBlock(s);
  try { return publicReason(blockTyrantOwnedEngine(openTyrantOwnedHead(s), command, s.revision + 1)); }
  catch { return '当前记录未通过核验，不能继续行动。'; }
}
export function ownedTyrantCommandBlock(s: SliceState, command: TyrantCommand, head: TyrantOwnedEngine): string | null {
  if (!validateTyrantCommand(command)) return '这项行动的内容无效。';
  if (s.status !== 'ACTIVE') return '已经死亡或结束的角色不能继续行动。';
  if (command.type === 'LEARN_GUIDANCE') return '已有本章记录，不能重新开始或补发原物。';
  try {
    assertOwnedTyrantCurrent(s, head);
    return publicReason(blockTyrantOwnedEngine(head, command, s.revision + 1));
  } catch { return '当前记录未通过核验，不能继续行动。'; }
}

function publish(s: SliceState, command: TyrantCommand, root: TyrantState, ctx: SeerContext): void {
  const b = root.frame!.budget;
  s.tyrant = clone(root);
  s.week = b.week; s.date = clone(b.date); s.actionsRemaining = b.actions;
  s.cash = b.cash; s.health = b.health; s.mind = b.mind; s.spirituality = b.spirituality; s.status = b.status;
  s.injuries = clone(b.injuries); s.injuryRisk = b.injuryRisk;
  s.progression.sequence = b.sequence; s.progression.acting = b.acting;
  s.progression.mastery = { ...b.mastery }; s.character.coreStats = { ...b.coreStats };
  s.seer.pollution = b.pollution; s.seer.completedSources = [...b.completedSources];
  s.random = { ...root.frame!.random }; Object.assign(s, clone(root.frame!.finance));
  const event = command.type === 'LEARN_GUIDANCE' ? null : root.journal.at(-1)!;
  s.lastCheck = event?.randomReceipts.length ? clone(event.randomReceipts.at(-1)!.check) : null;
  if (!event) ctx.note('暴君晋升与三岸当前居民', '已支付100便士与1行动，核对本人、原三份雷神特性和既往实际履历。先取得同一材料，再建立有期限的追随关系；所有海程、工作、生活费、旧债、伤势与风险实际继续。');
  else {
    for (const receipt of event.financeReceipts) ctx.note(receipt.title, receipt.text);
    ctx.note(b.sequence === 0 ? '暴君当前行动' : '三岸与真实挑战', event.notes.join(''));
  }
}
export function applyTyrantCommand(s: SliceState, command: TyrantCommand, ctx: SeerContext): void {
  if (!validateTyrantCommand(command) || s.status !== 'ACTIVE') throw Error('当前不能执行这项行动。');
  let root: TyrantState;
  if (command.type === 'LEARN_GUIDANCE') {
    const reason = guidanceBlock(s); if (reason) throw Error(reason);
    root = startTyrant(s);
  } else root = snapshotTyrantOwnedEngine(advanceTyrantOwnedEngine(openTyrantOwnedHead(s), command, s.revision + 1));
  publish(s, command, root, ctx);
}
export function applyOwnedTyrantCommand(s: SliceState, command: TyrantCommand, ctx: SeerContext, head: TyrantOwnedEngine): TyrantOwnedEngine {
  assertOwnedTyrantCurrent(s, head);
  if (!validateTyrantCommand(command) || command.type === 'LEARN_GUIDANCE' || s.status !== 'ACTIVE')
    throw Error('当前不能执行这项行动。');
  const next = advanceTyrantOwnedEngine(head, command, s.revision + 1);
  publish(s, command, snapshotTyrantOwnedEngine(next), ctx);
  return next;
}
export function projectTyrant(s: SliceState): TyrantProjection {
  return projection(s, sameTyrant(s.tyrant, createTyrantState()) ? null : openTyrantOwnedHead(s));
}
export function projectOwnedTyrant(s: SliceState, head: TyrantOwnedEngine): TyrantProjection {
  assertOwnedTyrantCurrent(s, head);
  return projection(s, head);
}

const safetyTypes = new Set(['RETURN_TO_HARBOR', 'WITHDRAW', 'RETREAT', 'BREAK_CONTACT', 'STOP_EFFECTS']);
/** Keep the actual target and blocker visible. A disabled goal is not evidence
 * that working or waiting will solve a refusal, exhausted original or expiry. */
export function selectTyrantPreferredAction(actions: TyrantAction[], desired: TyrantCommand | null): TyrantAction | undefined {
 return actions.find(action=>sameTyrant(action.command,desired));
}
function desiredCommand(root: TyrantState): TyrantCommand | null {
 const f=root.frame!,b=f.budget,m=root.materials!,h=tyrantHost(root,`R215:${root.source!.runId}:${root.source!.revision+2+root.journal.length}`,root.source!.revision+2+root.journal.length);
 const at=(to:string,c:TyrantCommand):TyrantCommand=>f.location===to?c:{type:'TRAVEL',to};
 if(b.status!=='ACTIVE')return null;
 if(root.epilogue?.status==='WITHDRAWN'&&!root.epilogue.reported)return {type:'EPILOGUE',command:{type:'REPORT'}};
 if(root.epilogue?.status==='ACTIVE'){
  const a=getTyrantEpilogueActions(root.epilogue,h).find(a=>a.preferredAction&&a.enabled);
  return a?{type:'EPILOGUE',command:a.command}:null;
 }
 if(!canLeaveTyrantChallenge(root.challenge!)){
  const a=getTyrantChallengeActions(root.challenge!,h).find(a=>a.preferredAction&&a.enabled);
  return a?{type:'CHALLENGE',command:a.command}:null;
 }
 if(!canLeaveTyrantCoasts(root.coasts!,f.location)){
  const c=root.coasts!.coasts.find(c=>c.location===f.location)!;
  return {type:'COAST',command:{type:'RETURN_TO_HARBOR',coastId:c.id}};
 }
 const failed=m.compounds.find(p=>p.status==='FAILED_EXPOSED'||p.status==='FAILED_SEALED');
 if(failed)return at(failed.location,{type:'MATERIAL',command:{type:failed.status==='FAILED_EXPOSED'?'SEAL_REMAINS':'RECOVER_SEALED',compoundId:failed.id}});
 if(b.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null))return {type:'CLINIC'};
 if(b.injuries.length||b.health<90||b.mind<78||b.spirituality<48)return {type:'REST'};
 if(b.sequence===0)return root.epilogue?null:at(TYRANT_RESCUE,{type:'START_EPILOGUE'});
 // Acquire finite original material before the twelve-week coastal evidence window.
 const item=m.characteristics.find(i=>!['EMBODIED','COMPOUND','FUSED','UNAVAILABLE'].includes(i.holder)&&(i.holder!=='PLAYER'||!i.acquiredEventId));
 if(item){
  let command:TyrantMaterialCommand;
  if(item.holder==='SUPPLIER'){
   const taskId=TYRANT_LABOUR_IDS[item.inheritedLabourSteps+item.labour.length];
   command=taskId?{type:'MATERIAL_LABOUR',bottleId:item.originBottleId,taskId}:{type:'ACQUIRE_CHARACTERISTIC',bottleId:item.originBottleId};
  }else{
   const site=m.legacySites.find(s=>s.originalBottleId===item.originBottleId);
   command={type:item.holder==='PLAYER'?'ACQUIRE_CHARACTERISTIC':site&&(site.permissionWeek!==b.week||site.investigation!=='ALLOW'||site.handover!=='ALLOW')?'ASK_LEGACY_PERMISSION':item.holder==='UNLOCATED'?'INVESTIGATE_LEGACY_REMAINS':item.holder==='LOCATED'?'SEAL_LEGACY_REMAINS':'RECOVER_LEGACY_REMAINS',bottleId:item.originBottleId};
  }
  return at(item.holder==='PLAYER'?item.location!:item.holder==='SUPPLIER'?TYRANT_SUPPLIER:TYRANT_MATERIAL_POLICY.legacyLocation,{type:'MATERIAL',command});
 }
 if(['UNVERIFIED','CUSTODIAN'].includes(m.uniqueness.holder)){
  if(!m.uniqueness.checks.some(c=>c.step==='CHAIN'))return at(TYRANT_ARCHIVE,{type:'MATERIAL',command:{type:'VERIFY_UNIQUENESS',step:'CHAIN'}});
  if(!m.uniqueness.checks.some(c=>c.step==='VACANCY'&&c.week===b.week))return at(TYRANT_VAULT,{type:'MATERIAL',command:{type:'VERIFY_UNIQUENESS',step:'VACANCY'}});
  return at(TYRANT_VAULT,{type:'MATERIAL',command:{type:'ACQUIRE_UNIQUENESS'}});
 }
 if(!m.batches.some(c=>c.status==='PLAYER'||c.status==='IN_COMPOUND')){
  const carrier=m.batches.find(c=>c.status==='SUPPLIER');
  if(carrier)return at(TYRANT_SUPPLIER,{type:'MATERIAL',command:{type:'BUY_COMPOUND',batchId:carrier.id}});
  return null;
 }
 const evidence=tyrantCoastEvidence(root.coasts!,b.week);
 if(!evidence.ready){
  const parcel=carriedTyrantParcel(root.coasts!);
  if(parcel)return at('TYRANT0-SOUTH',{type:'COAST',command:{type:'DELIVER_TRANSFER',coastId:'south'}});
  const local=root.coasts!.coasts.find(c=>c.location===f.location);
  const needing=root.coasts!.coasts.filter(c=>!evidence.groups.some(g=>g.coastId===c.id&&g.current&&g.fears&&g.obeys&&g.believes));
  const actionable=(c:typeof needing[number])=>c.status!=='COERCED'&&(c.status==='PENDING_REVIEW'||c.grain>=3);
  let next=local&&needing.includes(local)&&actionable(local)?local:needing.find(actionable);
  if(!next){
   const south=needing.find(c=>c.id==='south'&&c.grain<3),source=root.coasts!.coasts.find(c=>c.id!=='south'&&c.grain>=6&&c.status!=='COERCED');
   if(south&&source)return at(source.location,{type:'COAST',command:{type:!source.surveyedEventId?'SURVEY':source.transferPermission?.answer==='ACCEPT'&&source.transferPermission.week===b.week?'LOAD_TRANSFER':'ASK_TRANSFER',coastId:source.id}});
   return null;
  }
  const type=!next.surveyedEventId?'SURVEY':next.status==='PENDING_REVIEW'?'REVIEW_NEXT_WEEK':next.permission?.answer!=='ACCEPT'||next.permission.week!==b.week?'ASK_PERMISSION':next.fulfillment?'RENEW':'FULFILL';
  return at(next.location,{type:'COAST',command:{type,coastId:next.id}});
 }
 if(root.challenge!.status==='UNSTARTED')return at(TYRANT_CHALLENGE_LOCATION,{type:'CHALLENGE',command:{type:'BEGIN'}});
 const p=m.compounds.find(c=>c.status==='PREPARED');
 if(p){const ready=getTyrantPromotionStabilityPreview(root,p.id);return at(TYRANT_WORKSHOP,ready.prepared?{type:'CONSUME',compoundId:p.id,confirmed:true}:{type:'STABILIZE_PROMOTION',compoundId:p.id});}
 const held=m.batches.find(c=>c.status==='PLAYER');
 return held?at(TYRANT_WORKSHOP,{type:'MATERIAL',command:{type:'COMPOSE_POTION',batchId:held.id}}):null;
}

/** Positive projection: no private source, random cursor, scene host, raw
 * preparation, event frames or original acquisition journal is returned. */
function projection(s:SliceState,head:TyrantOwnedEngine|null):TyrantProjection {
 const root=head?snapshotTyrantOwnedEngine(head):s.tyrant,f=root.frame,b=f?.budget??tyrantBudget(s),promoted=s.progression.pathwayId==='tyrant'&&b.sequence===0&&root.promotionWeek!==null;
 const definitions=s.progression.pathwayId==='tyrant'?[...THUNDER_GOD_INHERITED_ABILITIES,...THUNDER_GOD_ABILITIES,...(promoted?TYRANT_ABILITIES:[])]:[];
 const result:TyrantProjection={title:'序列0 暴君',guidanceKnown:root.guidanceKnown,promoted,story:TYRANT_STORY,nextStep:TYRANT_GOAL,risk:TYRANT_RISK,
  resources:{health:b.health,mind:b.mind,spirituality:b.spirituality,cash:`${b.cash}便士`,actionsRemaining:b.actions},
  abilities:definitions.filter(a=>Object.hasOwn(b.mastery,a.id)).map(a=>({id:a.id,label:a.label,description:a.description,mastery:b.mastery[a.id]??0})),actions:[],sections:[],
  insideCase:root.epilogue?.status==='ACTIVE'||!!root.challenge&&!canLeaveTyrantChallenge(root.challenge)||!!root.coasts&&!!f&&!canLeaveTyrantCoasts(root.coasts,f.location)};
 const add=(command:TyrantCommand,label:string,cost:string)=>{const reason=publicReason(head?blockTyrantOwnedEngine(head,command,s.revision+1):tyrantCommandBlock(s,command));result.actions.push({id:`tyrant:${result.actions.length}:${command.type}`,label,cost,command:clone(command),enabled:reason===null,reason});};
 if(!root.guidanceKnown){
  add({type:'LEARN_GUIDANCE'},'听取暴君晋升与三岸原人群指导','1行动、100便士');result.actions[0]!.preferredAction=true;
  if(b.sequence!==1)result.nextStep='先继续雷神的真实原三份续筹、晋升和三案反思；历史独立第四份不能改写为同根回收件。';
  return result;
 }
 const h=tyrantHost(root,`R215:${root.source!.runId}:${s.revision+1}`,s.revision+1),place=TYRANT_CITY_PLACES.find(p=>p.id===f!.location)?.title??'当前现场';
 result.sections.push({id:'clock',title:'当前位置与实际日历',lines:[`${place}；第${b.week}周，${h.date.year}年${h.date.month}月${h.date.day}日。`,`距下一真实周界${Math.ceil((f!.weekAnchor+604800-f!.nowSecond)/3600)}小时；跨海实付60便士、1行动与一整周，本地步行30分钟。`]});
 result.sections.push(projectTyrantCoasts(root.coasts!,b.week));
 result.sections.push(projectTyrantChallenge(root.challenge!));
 result.sections.push({id:'materials',...projectTyrantMaterials(root.materials!)});
 result.sections.push({id:'vacancy',title:'原唯一性与真实未来分支',lines:[TYRANT_FUTURE_BRANCH.story,tyrantSuccessionAt(h.date)?'当前日期已经到达原保管链发生之后，仍须本人分别实查保管链、当周空位并付费当面交接。':'当前日期尚未到原保管链发生之时。等待不会提前产生原件，也不会发工资或免除生活费。']});
 result.sections.push({id:'finance',title:'实际工资、生活费与旧债',lines:[`现款${b.cash}便士；原职业每周${root.source!.character.weeklyWage}便士，须本人实际工作一次。`,`未付本金${f!.finance.debts.reduce((sum,d)=>sum+d.remaining,0)}便士；下次约定还款${f!.finance.debts.reduce((sum,d)=>sum+Math.min(d.remaining,d.weeklyPayment),0)}便士。`,'等待不发工资、不补粮、不恢复身体；不足生活费如实计欠，之后按赤贫生活。']});
 result.sections.push({id:'body',title:'当前身体与同一原掌握',lines:[`${s.character.name}，${s.character.age}岁；健康${b.health}，精神${b.mind}，灵性${b.spirituality}/${promoted?TYRANT_SPIRITUALITY_CAP:120}，污染${b.pollution}，意志${b.coreStats.will}。`,...(b.injuries.length?b.injuries.map(i=>`${i.severity==='HEAVY'?'重伤':'轻伤'}：${i.treatedRevision===null?'尚未处置':'已普通处置，仍须之后实际休养'}。`):['当前没有实际伤势。']),'水手至雷神24项原掌握逐值保留，包括原零值；两项暴君新技巧只在真实晋升后从零开始。','普通重伤处置实付60便士、1行动；之后仍须实际休养。原小湾水量、旧闸、原靶与旧人物不修复或复制。']});
 const latest=root.journal.at(-1);
 result.sections.push({id:'recent-action',title:'最近实际行动与结果',lines:latest?[...latest.notes,...latest.financeReceipts.map(r=>r.text),...latest.randomReceipts.map(r=>`本次实际检定：成功率${r.check.chance}%，掷出${r.check.roll}，${r.check.tier==='SUCCESS'?'成功':r.check.tier==='GREAT_SUCCESS'?'大成功':r.check.tier==='FAILURE'?'失败':'严重失败'}。`),`现款变化${latest.after.budget.cash-latest.before.budget.cash}便士；行动变化${latest.after.budget.actions-latest.before.budget.actions}，健康变化${latest.after.budget.health-latest.before.budget.health}，精神变化${latest.after.budget.mind-latest.before.budget.mind}，灵性变化${latest.after.budget.spirituality-latest.before.budget.spirituality}。`]:['已实付100便士和1行动听取指导，旧身体、原人原物与既往费用保留。']});
 if(root.epilogue){
  const ep=projectTyrantEpilogue(root.epilogue,b.injuries,f!.nowSecond);result.story=ep.story;result.nextStep=ep.nextStep;result.sections.unshift({id:'epilogue',title:'同一海岸的有限救援',lines:ep.lines});
  for(const a of getTyrantEpilogueActions(root.epilogue,h))add({type:'EPILOGUE',command:a.command},a.label,a.cost);
  const storm=getTyrantEpilogueCheckPreview(root,'DIVERT_WATER'),energy=getTyrantEpilogueCheckPreview(root,'RELEASE_ENERGY');
  result.sections.push({id:'epilogue-readiness',title:'两项一次性有限尝试',lines:[`有限引流${storm?.chance}%；有限能量转移${energy?.chance}%。成功仍须真实救援或交接，不保证命中、撤离或存活。`,'两项各只尝试一次，过期、当前条件改变或撤回使旧窗口失效；普通隔离、绳索与实际退场仍保留。']});
 }
 if(!promoted){
  for(const a of getTyrantCoastActions(root.coasts!,h).filter(a=>TYRANT_COASTS.find(c=>c.id===a.command.coastId)?.location===f!.location))add({type:'COAST',command:a.command},a.label,a.cost);
  if(f!.location===TYRANT_CHALLENGE_LOCATION)for(const a of getTyrantChallengeActions(root.challenge!,h))add({type:'CHALLENGE',command:a.command},a.label,a.cost);
  for(const a of getTyrantMaterialActions(root.materials!,TYRANT_MATERIAL_POLICY))add({type:'MATERIAL',command:a.command},a.label,a.cost);
  for(const p of root.materials!.compounds.filter(c=>c.status==='PREPARED')){
   const preview=getTyrantPromotionStabilityPreview(root,p.id);
   result.sections.push({id:`promotion-${p.batchId}`,title:'本瓶当前氛围、准备与风险',lines:[`付费准备后的实际成功率${preview.preparedChance}%；${preview.prepared?'当前同瓶准备仍有效':'尚无有效准备，不能饮用'}。`,'实付150便士、1行动、10灵性、8精神与600秒。北岸原群体中十二位原居民须实际走到集会点，表现当前恐惧、服从与信仰；没有传送二十七万人。','绑定同一本人、同一瓶、同一北岸集会场、当前追随与单独挑战经历。七天内有效，离场、失效人群或服药后失效。','意志加本次实际准备13，难度30。成功扣12精神；普通失败扣45健康、40精神、加35污染及重伤；严重失败扣110健康、100精神、加70污染，可能死亡。']});
   add({type:'STABILIZE_PROMOTION',compoundId:p.id},'组织原居民实际到场并完成本瓶付费准备','150便士、1行动、10灵性、8精神、600秒');
   add({type:'CONSUME',compoundId:p.id,confirmed:true},'独立确认风险，在当前氛围中饮用同一瓶',`0行动；有效准备后${preview.preparedChance}%成功；实际600秒，可能重伤或死亡`);
  }
 }else if(!root.epilogue)add({type:'START_EPILOGUE'},'进入有限海岸救援现场','本人实际到场，600秒，不补身体或资源');
 for(const destination of TYRANT_CITY_PLACES)if(destination.id!==f!.location)add({type:'TRAVEL',to:destination.id},`前往${destination.title}`,tyrantSeaTravel(f!.location,destination.id)?'60便士、1行动、1真实周，照常结生活费与旧债':'0便士、1行动，实际步行30分钟');
 if(f!.location!==TYRANT_HOME&&!tyrantSeaTravel(f!.location,TYRANT_HOME))add({type:'RETURN_ON_FOOT'},'沿同一北岸普通路返回原港','0行动、0便士，实际两小时');
 add({type:'WORK'},'做本周原职业工作',`1行动、8小时，${root.source!.character.weeklyWage}便士，每周一次`);
 add({type:'CLINIC'},'付费普通处置真实重伤','1行动、60便士、1小时，之后仍须休养');
 add({type:'REST'},'按实际生活档休养','1行动、8小时，未处置的重伤保留');
 add({type:'NEXT_WEEK'},'走到下一真实周界','结生活费与约定还款；没有工资或恢复');
 const desired=desiredCommand(root),preferred=selectTyrantPreferredAction(result.actions,desired);
 if(preferred){preferred.preferredAction=true;result.nextStep=`${preferred.label}。${preferred.reason??'按实际成本与时间完成这一步。'}`;}
 else if(!promoted&&!result.insideCase)result.nextStep='当前有限材料或原居民条件不再支持继续晋升。可查看实际记录并选择普通生活；等待不会补粮、补原物或清除拒绝。';
 if(b.status!=='ACTIVE')result.nextStep='本人已死亡，周目停止。原伤、原物所在与实际失败记录保留，不能继续行动或回收。';
 return result;
}

