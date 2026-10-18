import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { DarknessCommand, DarknessProjection, DarknessState } from './types.js';
import {
  createDarknessState, startDarkness, sameDarkness, darknessDigest,
  validateDarknessCommand, openDarknessOwnedEngine, snapshotDarknessOwnedEngine,
  advanceDarknessOwnedEngine, blockDarknessOwnedEngine,
  getDarknessPromotionStabilityPreview, getDarknessEpilogueCheckPreview,
  darknessHost, type DarknessOwnedEngine,
} from './engine.js';
import {
  darknessBudget, darknessHistoryDigest, darknessAcquisitionSnapshot,
  darknessSourceBlock, validateDarknessSource,
} from './source.js';
import {
  DARKNESS_ABILITIES, DARKNESS_STORY, DARKNESS_GOAL, DARKNESS_RISK,
  DARKNESS_CITY_PLACES, DARKNESS_HOME, DARKNESS_GUIDANCE,
  DARKNESS_SPIRITUALITY_CAP, DARKNESS_SUPPLIER, DARKNESS_WORKSHOP, DARKNESS_ARCHIVE, DARKNESS_VAULT,
} from './content.js';
import { projectDarknessEvacuation, darknessEvacuationCost, DARKNESS_EVACUATION_LOCATION, DARKNESS_EVACUATION_POINTS, type DarknessEvacuationCommand, type DarknessEvacuationPoint } from './evacuation.js';
import { projectDarknessEpilogue, getDarknessEpilogueActions } from './epilogue.js';
import { getDarknessMaterialActions, projectDarknessMaterials } from './materials.js';
import { DARKNESS_LABOUR_TASKS, DARKNESS_FUTURE_BRANCH } from './material-content.js';
import {
  MISFORTUNE_KNIGHT_ABILITIES,
  MISFORTUNE_KNIGHT_INHERITED_ABILITIES,
} from '../misfortune-knight/content.js';

export { createDarknessState, validateDarknessCommand } from './engine.js';
export { darknessSourceView } from './source.js';
export type { DarknessOwnedEngine } from './engine.js';
export type { DarknessCommand, DarknessState, DarknessProjection } from './types.js';

const clone = <T>(value: T): T => structuredClone(value);

/** Raw entries are replayed before this check. Owned entries use a private
 * branded engine, but still cannot publish into a changed host state. */
function assertCurrent(s: SliceState, root: DarknessState): void {
  const source = root.source, frame = root.frame;
  if (!source || !frame || s.progression.pathwayId !== 'darkness' ||
      !sameDarkness(darknessBudget(s), frame.budget) || !sameDarkness(s.random, frame.random))
    throw Error('当前身体、资源与实际行动记录不一致。');
  if (s.revision !== source.revision + 1 + root.journal.length)
    throw Error('当前实际行动次序不一致。');
  const { coreStats: _current, ...identity } = s.character;
  const { coreStats: _source, ...originalIdentity } = source.character;
  if (!sameDarkness(identity, originalIdentity) || Object.entries(frame.finance)
      .some(([key, value]) => !sameDarkness(s[key as keyof SliceState], value)))
    throw Error('当前身份或实际生活账本不一致。');
  if (source.historyDigest !== darknessHistoryDigest(s) ||
      source.originalWorldDigest !== darknessDigest(s.world) ||
      s.combatHistory.length !== source.combatHistoryLength ||
      source.combatHistoryDigest !== darknessDigest(s.combatHistory) ||
      !sameDarkness(source.acquisition, darknessAcquisitionSnapshot(s)))
    throw Error('旧人物、原物或原瓶履历被改写。');
  if (s.combat !== null || s.activeEvent !== null || s.eventQueue.length || s.pulse !== 'NONE')
    throw Error('本章不能同时开启旧现场。');
  if ((frame.budget.sequence === 0) !== (root.promotionWeek !== null))
    throw Error('当前晋升与实际服药记录不一致。');
}

function guidanceBlock(s: SliceState): string | null {
  if (!sameDarkness(s.darkness, createDarknessState()))
    return '已有本章记录，不能重新开始或补发原物。';
  const reason = darknessSourceBlock(s);
  if (reason) return reason;
  return s.actionsRemaining < DARKNESS_GUIDANCE.actions || s.cash < DARKNESS_GUIDANCE.cash
    ? '指导需要1行动与100便士，可先按原生活工作与休养。' : null;
}
function publicReason(reason: string | null): string | null {
  if (reason === null) return null;
  return /[\u3400-\u9fff]/.test(reason) && !/[A-Z_]{6,}|seed|cursor|digest|receipt/i.test(reason)
    ? reason : '当前原件、实际所在地或前一步条件尚不满足。';
}
export function validateDarknessState(s: SliceState): boolean {
  try {
    if (sameDarkness(s.darkness, createDarknessState()))
      return s.progression.pathwayId !== 'darkness' || s.progression.sequence !== 0;
    const head = openDarknessOwnedEngine(s);
    assertCurrent(s, snapshotDarknessOwnedEngine(head));
    return true;
  } catch { return false; }
}
export function hasDarknessHistory(s: SliceState): boolean {
  try {
    return s.darkness.guidanceKnown && s.darkness.source !== null &&
      s.progression.pathwayId === 'darkness' && validateDarknessSource(s, s.darkness.source);
  } catch { return false; }
}
export function hasDarknessLock(s: SliceState): boolean { return hasDarknessHistory(s); }
export function openDarknessOwnedHead(s: SliceState): DarknessOwnedEngine {
  const head = openDarknessOwnedEngine(s);
  assertCurrent(s, snapshotDarknessOwnedEngine(head));
  return head;
}
export function assertOwnedDarknessCurrent(s: SliceState, head: DarknessOwnedEngine): void {
  const root = snapshotDarknessOwnedEngine(head);
  if (!sameDarkness(root, s.darkness)) throw Error('当前会话与实际存档版本不一致。');
  assertCurrent(s, root);
}
export function darknessCommandBlock(s: SliceState, command: DarknessCommand): string | null {
  if (!validateDarknessCommand(command)) return '这项行动的内容无效。';
  if (s.status !== 'ACTIVE') return '已经死亡或结束的角色不能继续行动。';
  if (command.type === 'LEARN_GUIDANCE') return guidanceBlock(s);
  try { return publicReason(blockDarknessOwnedEngine(openDarknessOwnedHead(s), command, s.revision + 1)); }
  catch { return '当前记录未通过核验，不能继续行动。'; }
}
export function ownedDarknessCommandBlock(s: SliceState, command: DarknessCommand, head: DarknessOwnedEngine): string | null {
  if (!validateDarknessCommand(command)) return '这项行动的内容无效。';
  if (s.status !== 'ACTIVE') return '已经死亡或结束的角色不能继续行动。';
  if (command.type === 'LEARN_GUIDANCE') return '已有本章记录，不能重新开始或补发原物。';
  try {
    assertOwnedDarknessCurrent(s, head);
    return publicReason(blockDarknessOwnedEngine(head, command, s.revision + 1));
  } catch { return '当前记录未通过核验，不能继续行动。'; }
}

function publish(s: SliceState, command: DarknessCommand, root: DarknessState, ctx: SeerContext): void {
  const b = root.frame!.budget;
  s.darkness = clone(root);
  s.week = b.week; s.date = clone(b.date); s.actionsRemaining = b.actions;
  s.cash = b.cash; s.health = b.health; s.mind = b.mind; s.spirituality = b.spirituality; s.status = b.status;
  s.injuries = clone(b.injuries); s.injuryRisk = b.injuryRisk;
  s.progression.sequence = b.sequence; s.progression.acting = b.acting;
  s.progression.mastery = { ...b.mastery }; s.character.coreStats = { ...b.coreStats };
  s.seer.pollution = b.pollution; s.seer.completedSources = [...b.completedSources];
  s.random = { ...root.frame!.random }; Object.assign(s, clone(root.frame!.finance));
  const event = command.type === 'LEARN_GUIDANCE' ? null : root.journal.at(-1)!;
  s.lastCheck = event?.randomReceipts.length ? clone(event.randomReceipts.at(-1)!.check) : null;
  if (!event) ctx.note('长夜撤离与晋升指导', '已支付100便士与1行动核对本人身份、三份厄难骑士特性和实际履历。旧人物、原物、当前伤势和旧账保留；本人仍在原庭院，须步行去新街区，白昼查路问过四位成年人的意愿，夜间逐人搀扶抵达并亲走返程。');
  else {
    for (const receipt of event.financeReceipts) ctx.note(receipt.title, receipt.text);
    ctx.note(b.sequence === 0 ? '黑暗当前行动' : '长夜撤离当前行动', event.notes.join(''));
  }
}
export function applyDarknessCommand(s: SliceState, command: DarknessCommand, ctx: SeerContext): void {
  if (!validateDarknessCommand(command) || s.status !== 'ACTIVE') throw Error('当前不能执行这项行动。');
  let root: DarknessState;
  if (command.type === 'LEARN_GUIDANCE') {
    const reason = guidanceBlock(s); if (reason) throw Error(reason);
    root = startDarkness(s);
  } else root = snapshotDarknessOwnedEngine(advanceDarknessOwnedEngine(openDarknessOwnedHead(s), command, s.revision + 1));
  publish(s, command, root, ctx);
}
export function applyOwnedDarknessCommand(s: SliceState, command: DarknessCommand, ctx: SeerContext, head: DarknessOwnedEngine): DarknessOwnedEngine {
  assertOwnedDarknessCurrent(s, head);
  if (!validateDarknessCommand(command) || command.type === 'LEARN_GUIDANCE' || s.status !== 'ACTIVE')
    throw Error('当前不能执行这项行动。');
  const next = advanceDarknessOwnedEngine(head, command, s.revision + 1);
  publish(s, command, snapshotDarknessOwnedEngine(next), ctx);
  return next;
}
export function projectDarkness(s: SliceState): DarknessProjection {
  return projection(s, sameDarkness(s.darkness, createDarknessState()) ? null : openDarknessOwnedHead(s));
}
export function projectOwnedDarkness(s: SliceState, head: DarknessOwnedEngine): DarknessProjection {
  assertOwnedDarknessCurrent(s, head);
  return projection(s, head);
}

/** Public next-step guidance follows physical position and durable facts; it
 * never supplies success, consent, a material, or a private host capability. */
function desiredEvacuation(root: DarknessState): DarknessEvacuationCommand | null {
 const s=root.evacuation!, now=root.frame!.nowSecond;
 const walk=(to:DarknessEvacuationPoint):DarknessEvacuationCommand=>{
  const at=DARKNESS_EVACUATION_POINTS.indexOf(s.position),target=DARKNESS_EVACUATION_POINTS.indexOf(to);
  return {type:'WALK',to:DARKNESS_EVACUATION_POINTS[at+(target>at?1:-1)]!,pace:'CAREFUL'};
 };
 if(s.reportEventId)return null;
 if(!s.survey.startedEventId)return {type:'SURVEY_DAY'};
 if(!s.supplies.purchaseEventId)return s.position===0?{type:'BUY_SUPPLIES'}:{type:'ORDINARY_RETURN'};
 const unregistered=s.residents.find(p=>!p.registeredEventId&&p.position===s.position);
 if(unregistered)return {type:'REGISTER_RESIDENT',residentId:unregistered.id};
 if(s.survey.walkedEdges.length<DARKNESS_EVACUATION_POINTS.length-1){
  const edge=DARKNESS_EVACUATION_POINTS.slice(0,-1).findIndex((_,i)=>!s.survey.walkedEdges.includes(i));
  const target=DARKNESS_EVACUATION_POINTS[edge]!;
  return s.position===target?walk(DARKNESS_EVACUATION_POINTS[edge+1]!):walk(target);
 }
 if(s.residents.some(p=>!p.registeredEventId))return walk(s.residents.find(p=>!p.registeredEventId)!.position);
 if(s.residents.every(p=>p.arrival))return s.position!==0?{type:'ORDINARY_RETURN'}:{type:'REPORT'};
 const night=s.nights.find(n=>now>=n.startSecond&&now<n.endSecond);
 if(!night){if(s.position!==0)return {type:'ORDINARY_RETURN'};return now%86400>=21600&&now%86400<72000?{type:'WAIT_NIGHT'}:{type:'BEGIN_NIGHT'};}
 if(!s.journal.some(r=>r.command.type==='LIGHT'&&r.oilUsedSeconds>0))return {type:'LIGHT',lampId:'DN-LAMP-1'};
 if(!s.falseLight.shieldedEventId)return s.position!==25?walk(25):s.falseLight.observedEventId?{type:'SHIELD_FALSE_LIGHT'}:{type:'OBSERVE',hazard:'FALSE_LIGHT'};
 if(!s.noise.markedEventId)return s.position!==55?walk(55):s.noise.observedEventId?{type:'RELAY_INSTRUCTIONS'}:{type:'OBSERVE',hazard:'NOISE'};
 if(s.escortId)return walk(110);
 const person=s.residents.find(p=>!p.arrival)!;
 if(person.position!==s.position)return walk(person.position);
 return {type:person.consent==='ACCEPT'?'ESCORT':'REVIEW_PERMISSION',residentId:person.id};
}
function desiredCommand(root: DarknessState): DarknessCommand | null {
 const f=root.frame!,b=f.budget,at=(to:string,c:DarknessCommand):DarknessCommand=>f.location===to?c:{type:'TRAVEL',to};
 if(root.epilogue){
  const e=root.epilogue, actions=getDarknessEpilogueActions(e,b,root.evacuation!,f.nowSecond);
  const available=(type:import('./epilogue.js').DarknessEpilogueCommand['type'])=>actions.find(a=>a.command.type===type&&a.enabled);
  let type:import('./epilogue.js').DarknessEpilogueCommand['type']|null=null;
  if(e.reported)return null;
  if(e.status!=='ACTIVE')type='REPORT';
  else if(!e.invited)type=e.position===0?'GO_SHELTER':'INVITE_RETURN';
  else if(!e.returned)type='RETURN_RESIDENTS';
  else if(!e.observed)type='OBSERVE';
  else if(e.position===44)type='ORDINARY_SIDE_EXIT';
  else if(!e.concealment.attempted&&available('SHORT_CONCEALMENT'))type='SHORT_CONCEALMENT';
  else if(!e.diversion.attempted&&available('BOUNDED_MISFORTUNE_DIVERSION'))type='BOUNDED_MISFORTUNE_DIVERSION';
  else if(e.diversion.expiresSecond!==null&&f.nowSecond+8<=e.diversion.expiresSecond)type='CROSS';
  else if(e.load.pending&&!e.load.secured)type='SECURE_LOAD';
  else type='ORDINARY_SIDE_EXIT';
  const next=type&&available(type)||available('ORDINARY_SIDE_EXIT')||available('WITHDRAW');
  return next?{type:'EPILOGUE',command:next.command}:null;
 }
 if(b.sequence===0)return at(DARKNESS_EVACUATION_LOCATION,{type:'START_EPILOGUE'});
 const evacuation=desiredEvacuation(root);
 if(evacuation)return at(DARKNESS_EVACUATION_LOCATION,{type:'EVACUATION',command:evacuation});
 const m=root.materials!,failed=m.compounds.find(p=>p.status==='FAILED_EXPOSED'||p.status==='FAILED_SEALED');
 if(failed)return at(failed.location,{type:'MATERIAL',command:{type:failed.status==='FAILED_EXPOSED'?'SEAL_REMAINS':'RECOVER_SEALED',compoundId:failed.id}});
 const item=m.characteristics.find(i=>!['EMBODIED','COMPOUND','FUSED'].includes(i.holder)&&(i.holder!=='PLAYER'||!i.acquiredEventId));
 if(item){
  if(item.holder==='SUPPLIER'){const step=item.inheritedLabourSteps+item.labour.length;return at(DARKNESS_SUPPLIER,{type:'MATERIAL',command:step<5?{type:'MATERIAL_LABOUR',bottleId:item.originBottleId,taskId:DARKNESS_LABOUR_TASKS[step]!}:{type:'ACQUIRE_CHARACTERISTIC',bottleId:item.originBottleId}});}
  if(item.holder==='PLAYER')return at(item.location!,{type:'MATERIAL',command:{type:'ACQUIRE_CHARACTERISTIC',bottleId:item.originBottleId}});
  return at(DARKNESS_SUPPLIER,{type:'MATERIAL',command:{type:item.holder==='UNLOCATED'?'INVESTIGATE_LEGACY_REMAINS':'RECOVER_LEGACY_REMAINS',bottleId:item.originBottleId}});
 }
 if(['UNVERIFIED','CUSTODIAN'].includes(m.uniqueness.holder)){
  if(!m.uniqueness.checks.some(c=>c.step==='CHAIN'))return at(DARKNESS_ARCHIVE,{type:'MATERIAL',command:{type:'VERIFY_UNIQUENESS',step:'CHAIN'}});
  if(!m.uniqueness.checks.some(c=>c.step==='VACANCY'&&c.week===b.week))return at(DARKNESS_VAULT,{type:'MATERIAL',command:{type:'VERIFY_UNIQUENESS',step:'VACANCY'}});
  return at(DARKNESS_VAULT,{type:'MATERIAL',command:{type:'ACQUIRE_UNIQUENESS'}});
 }
 const p=m.compounds.find(p=>p.status==='PREPARED');
 if(p){const preview=getDarknessPromotionStabilityPreview(root,p.id);return at(DARKNESS_WORKSHOP,preview.prepared?{type:'CONSUME',compoundId:p.id,confirmed:true}:{type:'STABILIZE_PROMOTION',compoundId:p.id});}
 const held=m.batches.find(x=>x.status==='PLAYER');if(held)return at(DARKNESS_WORKSHOP,{type:'MATERIAL',command:{type:'COMPOSE_POTION',batchId:held.id}});
 const supplier=m.batches.find(x=>x.status==='SUPPLIER');if(supplier)return at(DARKNESS_SUPPLIER,{type:'MATERIAL',command:{type:'BUY_COMPOUND',batchId:supplier.id}});
 return null;
}
function evacuationActions(root: DarknessState): {command:DarknessEvacuationCommand;label:string}[] {
 const s=root.evacuation!, out:{command:DarknessEvacuationCommand;label:string}[]=[];
 const add=(command:DarknessEvacuationCommand,label:string)=>out.push({command,label});
 if(!s.survey.startedEventId)add({type:'SURVEY_DAY'},'白昼开始实勘实际道路');
 if(!s.supplies.purchaseEventId)add({type:'BUY_SUPPLIES'},'购买两盏普通灯、灯油与原绳');
 for(const p of s.residents)if(!p.arrival&&p.position===s.position){
  if(!p.registeredEventId)add({type:'REGISTER_RESIDENT',residentId:p.id},`当面登记${p.name}的位置与本人意愿`);
  else if(p.consent!=='ACCEPT')add({type:'REVIEW_PERMISSION',residentId:p.id},`重新当面询问${p.name}的意愿`);
  if(!s.escortId)add({type:'ESCORT',residentId:p.id},`开始搀扶同处且愿意同行的${p.name}`);
 }
 if(s.position===0){add({type:'WAIT_NIGHT'},'在登记处等到真实入夜');add({type:'BEGIN_NIGHT'},'开始这一真实夜间撤离');}
 for(const lamp of s.supplies.lamps)add({type:lamp.lit?'EXTINGUISH':'LIGHT',lampId:lamp.id},`${lamp.lit?'熄灭':'点亮'}${lamp.id==='DN-LAMP-1'?'第一盏':'第二盏'}原灯`);
 if(s.position===25){if(!s.falseLight.observedEventId)add({type:'OBSERVE',hazard:'FALSE_LIGHT'},'亲眼观察已经出现的错误灯号');if(!s.falseLight.shieldedEventId)add({type:'SHIELD_FALSE_LIGHT'},'亲手遮住同一错误灯号');}
 if(s.position===55){if(!s.noise.observedEventId)add({type:'OBSERVE',hazard:'NOISE'},'亲耳辨认实际作坊噪声');add({type:'RELAY_INSTRUCTIONS'},'用原绳标路并给同行者近身传令');}
 const at=DARKNESS_EVACUATION_POINTS.indexOf(s.position);
 for(const to of [DARKNESS_EVACUATION_POINTS[at-1],DARKNESS_EVACUATION_POINTS[at+1]])if(to!==undefined){add({type:'WALK',to,pace:'CAREFUL'},`沿原路触墙慢行到${to}米`);add({type:'WALK',to,pace:'DIRECT'},`在实际灯照下直接走到${to}米`);}
 if(s.escortId)add({type:'RELEASE'},'立即停止搀扶，双方留在实际原处');
 if(s.position!==0)add({type:'ORDINARY_RETURN'},'沿同一实路普通返回登记处');
 if(!s.reportEventId)add({type:'REPORT'},'逐人清点真实到达、损耗并报告返程');
 return out;
}
function projection(s: SliceState,head: DarknessOwnedEngine|null): DarknessProjection {
 const root=head?snapshotDarknessOwnedEngine(head):s.darkness,f=root.frame,b=f?.budget??darknessBudget(s),promoted=s.progression.pathwayId==='darkness'&&b.sequence===0&&root.promotionWeek!==null;
 const definitions=s.progression.pathwayId==='darkness'?[...MISFORTUNE_KNIGHT_INHERITED_ABILITIES,...MISFORTUNE_KNIGHT_ABILITIES,...(promoted?DARKNESS_ABILITIES:[])]:[];
 const result:DarknessProjection={title:'序列0 黑暗',guidanceKnown:root.guidanceKnown,promoted,story:DARKNESS_STORY,nextStep:DARKNESS_GOAL,risk:DARKNESS_RISK,resources:{health:b.health,mind:b.mind,spirituality:b.spirituality,cash:`${b.cash}便士`,actionsRemaining:b.actions},abilities:definitions.filter(a=>Object.hasOwn(b.mastery,a.id)).map(a=>({id:a.id,label:a.label,description:a.description,mastery:b.mastery[a.id]??0})),actions:[],sections:[],insideCase:root.epilogue?.status==='ACTIVE'||!!root.evacuation&&(root.evacuation.position!==0||root.evacuation.escortId!==null)};
 const add=(command:DarknessCommand,label:string,cost:string)=>{const reason=publicReason(head?blockDarknessOwnedEngine(head,command,s.revision+1):darknessCommandBlock(s,command));result.actions.push({id:`darkness:${result.actions.length}:${command.type}`,label,cost,command:clone(command),enabled:reason===null,reason});};
 if(!root.guidanceKnown){add({type:'LEARN_GUIDANCE'},'听取长夜撤离与三份原特性指导','1行动、100便士');result.actions[0]!.preferredAction=true;return result;}
 const h=darknessHost(root,`R213:${root.source!.runId}:${s.revision+1}`,s.revision+1),place=DARKNESS_CITY_PLACES.find(p=>p.id===f!.location)?.title??'当前现场';
 const hour=Math.floor(f!.nowSecond%86400/3600),minute=Math.floor(f!.nowSecond%3600/60);
 result.sections.push({id:'clock',title:'实际日历与当前地点',lines:[`当前位置：${place}；第${b.week}周，${h.date.year}年${h.date.month}月${h.date.day}日 ${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')}。`,`距下一真实周界${Math.ceil((f!.weekAnchor+604800-f!.nowSecond)/3600)}小时；跨界实际结生活费与旧债，只有真实工作才领取本周工资。`,'新街区白昼实勘，20时至次日6时才是夜间。等待只让真实时间过去，不生灯油、不刷新居民、不跳年。']});
 result.sections.push(projectDarknessEvacuation(root.evacuation!,f!.nowSecond));
 result.sections.push({id:'materials',...projectDarknessMaterials(root.materials!)});
 result.sections.push({id:'future-branch',title:'封存原件与交接记录',lines:h.succession?[DARKNESS_FUTURE_BRANCH.story,'仍须亲往档案室核查、到封存处核空位，并付费当面交接。']:['目前尚无可核实的空位和交接记录；本人不能取得原件。','档案室约定1353年1月9日起接受这项查询，届时仍须实地确认，预约本身不保证取得原物。']});
 result.sections.push({id:'finance',title:'真实工作、生活费与旧债',lines:[`现款${b.cash}便士；原职业每周${root.source!.character.weeklyWage}便士，须真实工作一次才能取得。`,`未付本金${f!.finance.debts.reduce((sum,d)=>sum+d.remaining,0)}便士；下次约定还款${f!.finance.debts.reduce((sum,d)=>sum+Math.min(d.remaining,d.weeklyPayment),0)}便士。`,'周结不足的生活费实际计欠，之后转赤贫；已付费用与旧失败不退还。']});
 const original=root.source!.originalPractice;
 result.sections.push({id:'body',title:'原身体、20项旧掌握与原物',lines:[`${s.character.name}，${s.character.age}岁；健康${b.health}，精神${b.mind}，灵性${b.spirituality}/${promoted?DARKNESS_SPIRITUALITY_CAP:120}，污染${b.pollution}，意志${b.coreStats.will}。`,...(b.injuries.length?b.injuries.map(i=>`${i.severity==='HEAVY'?'重伤':'轻伤'}：${i.treatedRevision===null?'尚未处置':'已普通处置，仍须实际休养'}。`):['当前没有实际伤势。']),`原盒、旧叶、原灯和旧现场保持已确认去向；米洛原木板完整度${original.plate.integrity}、磨损${original.plate.wear}，没有借给新街区。`,'全部旧掌握按原值保留，原本0掌握的技能不自动获得可用性。新技巧仅在晋升后从0开始，不借其他途径权柄。','重伤须60便士与1行动普通处置，之后实际休养；0钱0行动仍可停止搀扶、触墙慢行和普通返回。']});
 const latest=root.journal.at(-1);
 result.sections.push({id:'recent-action',title:'最近实际行动与费用',lines:latest?[...latest.notes,...latest.financeReceipts.map(r=>r.text),...latest.randomReceipts.map(r=>`本次实际检定：成功率${r.check.chance}%，掷出${r.check.roll}，${r.check.tier==='SUCCESS'?'成功':r.check.tier==='GREAT_SUCCESS'?'大成功':r.check.tier==='FAILURE'?'失败':'严重失败'}。`),`本次现款变化${latest.after.budget.cash-latest.before.budget.cash}便士。`]:['已实际支付100便士和1行动听取指导，仍在原庭院，未移动旧人或物。']});
 if(root.epilogue){
  const ep=projectDarknessEpilogue(root.epilogue,root.evacuation!);result.story=ep.story;result.nextStep=ep.nextStep;
  result.sections.unshift({id:'epilogue',title:'原居民返街后的有限事故',lines:ep.lines});
  for(const a of getDarknessEpilogueActions(root.epilogue,b,root.evacuation!,f!.nowSecond))add({type:'EPILOGUE',command:a.command},a.label,a.cost);
  if(root.epilogue.status==='ACTIVE'){
   const preview=getDarknessEpilogueCheckPreview(root,'SHORT_CONCEALMENT')!;
   result.sections.push({id:'epilogue-readiness',title:'两次有限尝试与普通退路',lines:[`两项技巧当前成功率均为${preview.chance}%，每项本场只尝试一次，失败也实际耗费。`,'短隐秘：1行动、12灵性、8精神，至多30秒和10米；有限厄难偏导：1行动、10灵性、6精神，仅随后10秒内的同一待发悬物。','只有成功且实际应用才增长对应掌握。普通示警、停止释放、侧路慢行和本人退出不依赖技巧成功。']});
   const desired=desiredCommand(root);for(const a of result.actions)if(sameDarkness(a.command,desired))a.preferredAction=true;return result;
  }
 }
 if(!promoted){
  if(!root.evacuation!.reportEventId)for(const a of evacuationActions(root)){const cost=darknessEvacuationCost(root.evacuation!,a.command,h);add({type:'EVACUATION',command:a.command},a.label,`${cost.actions}行动、${cost.cashCost}便士，实际${cost.seconds}秒`);}
  for(const a of getDarknessMaterialActions(root.materials!,h))add({type:'MATERIAL',command:a.command},a.label,a.cost);
  const lines:string[]=[];
  for(const p of root.materials!.compounds.filter(c=>c.status==='PREPARED')){
   const preview=getDarknessPromotionStabilityPreview(root,p.id);
   lines.push(`本瓶实际付费准备后的成功率${preview.preparedChance}%；${preview.prepared?'准备仍在原室和七天期限内有效':'本瓶尚无有效准备，当前不能饮用'}。`,'准备实付100便士、1行动、12灵性和8精神，绑定本人、同一成药、原室与四名居民实际撤离；离室、过期或服用即失效。','按实际意志加本次准备40、难度61计算，不换骰子。成功再扣12精神；普通失败损45健康、40精神、加35污染及重伤；严重失败可能死亡。');
   add({type:'STABILIZE_PROMOTION',compoundId:p.id},'为同一瓶完成实际付费稳定准备','1行动、100便士、12灵性、8精神');
   add({type:'CONSUME',compoundId:p.id,confirmed:true},'独立确认当前风险并饮用同一瓶',`1行动、30灵性；有效准备后${preview.preparedChance}%成功；失败可能重伤、污染或死亡`);
  }
  if(lines.length)result.sections.push({id:'promotion-stability',title:'本瓶实际准备与服药风险',lines});
 }else if(!root.epilogue)add({type:'START_EPILOGUE'},'前往同一居民真实返街后的新事故','0行动，现场十分钟；居民须随后亲走返回，不补资源');
 for(const destination of DARKNESS_CITY_PLACES)if(destination.id!==f!.location)add({type:'TRAVEL',to:destination.id},`沿普通路步行前往${destination.title}`,'1行动、0便士，实际步行半小时');
 if(f!.location!==DARKNESS_HOME)add({type:'RETURN_ON_FOOT'},'本人沿普通路步行回原庭院','0行动、0便士，实际两小时，不能带走未同行者');
 add({type:'WORK'},'做本周原职业工作',`1行动；${root.source!.character.weeklyWage}便士，每周一次`);
 add({type:'CLINIC'},'付费普通处置实际重伤','1行动、60便士，之后仍须实际休养');
 add({type:'REST'},'按实际生活档休养','1行动，实际八小时；未处置重伤仍保留');
 add({type:'NEXT_WEEK'},'走到下一真实周界','结算生活费与约定还款，不发工资、不补资源');
 const desired=desiredCommand(root);for(const a of result.actions)if(sameDarkness(a.command,desired))a.preferredAction=true;
 const preferred=result.actions.find(a=>a.preferredAction);if(preferred)result.nextStep=`${preferred.label}。${preferred.reason??'按实际费用和时间完成这一步。'}`;
 return result;
}
