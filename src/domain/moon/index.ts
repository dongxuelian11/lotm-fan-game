import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { MoonCommand, MoonProjection, MoonState } from './types.js';
import {
  createMoonState, startMoon, sameMoon, moonDigest,
  validateMoonCommand, openMoonOwnedEngine, snapshotMoonOwnedEngine,
  advanceMoonOwnedEngine, blockMoonOwnedEngine,
  getMoonPromotionStabilityPreview, getMoonEpilogueCheckPreview,
  moonHost, type MoonOwnedEngine,
} from './engine.js';
import {
  moonBudget, moonHistoryDigest, moonAcquisitionSnapshot,
  moonSourceBlock, validateMoonSource,
} from './source.js';
import {
  MOON_ABILITIES, MOON_STORY, MOON_GOAL, MOON_RISK,
  MOON_CITY_PLACES, MOON_HOME, MOON_GUIDANCE,
  MOON_SPIRITUALITY_CAP, MOON_STATIONS, MOON_SUPPLIER, MOON_WORKSHOP, MOON_ARCHIVE, MOON_VAULT,
} from './content.js';
import { projectMoonServices, getMoonServiceActions } from './services.js';
import { projectMoonEpilogue, getMoonEpilogueActions } from './epilogue.js';
import { getMoonMaterialActions, projectMoonMaterials, MOON_LABOUR_TASKS } from './materials.js';
import {
  BEAUTY_GODDESS_ABILITIES,
  BEAUTY_GODDESS_INHERITED_ABILITIES,
} from '../beauty-goddess/content.js';

export { createMoonState, validateMoonCommand } from './engine.js';
export { moonSourceView } from './source.js';
export type { MoonOwnedEngine } from './engine.js';
export type { MoonCommand, MoonState, MoonProjection } from './types.js';

const clone = <T>(value: T): T => structuredClone(value);

/** Raw entries are replayed before this check. Owned entries use a private
 * branded engine, but still cannot publish into a changed host state. */
function assertCurrent(s: SliceState, root: MoonState): void {
  const source = root.source, frame = root.frame;
  if (!source || !frame || s.progression.pathwayId !== 'moon' ||
      !sameMoon(moonBudget(s), frame.budget) || !sameMoon(s.random, frame.random))
    throw Error('当前身体、资源与实际行动记录不一致。');
  if (s.revision !== source.revision + 1 + root.journal.length)
    throw Error('当前实际行动次序不一致。');
  const { coreStats: _current, ...identity } = s.character;
  const { coreStats: _source, ...originalIdentity } = source.character;
  if (!sameMoon(identity, originalIdentity) || Object.entries(frame.finance)
      .some(([key, value]) => !sameMoon(s[key as keyof SliceState], value)))
    throw Error('当前身份或实际生活账本不一致。');
  if (source.historyDigest !== moonHistoryDigest(s) ||
      source.originalWorldDigest !== moonDigest(s.world) ||
      s.combatHistory.length !== source.combatHistoryLength ||
      source.combatHistoryDigest !== moonDigest(s.combatHistory) ||
      !sameMoon(source.acquisition, moonAcquisitionSnapshot(s)))
    throw Error('旧人物、原物或原瓶履历被改写。');
  if (s.combat !== null || s.activeEvent !== null || s.eventQueue.length || s.pulse !== 'NONE')
    throw Error('本章不能同时开启旧现场。');
  if ((frame.budget.sequence === 0) !== (root.promotionWeek !== null))
    throw Error('当前晋升与实际服药记录不一致。');
}

function guidanceBlock(s: SliceState): string | null {
  if (!sameMoon(s.moon, createMoonState()))
    return '已有本章记录，不能重新开始或补发原物。';
  const reason = moonSourceBlock(s);
  if (reason) return reason;
  return s.actionsRemaining < MOON_GUIDANCE.actions || s.cash < MOON_GUIDANCE.cash
    ? '指导需要1行动与100便士，可先按原生活工作与休养。' : null;
}
function publicReason(reason: string | null): string | null {
  if (reason === null) return null;
  return /[\u3400-\u9fff]/.test(reason) && !/[A-Z_]{6,}|seed|cursor|digest|receipt/i.test(reason)
    ? reason : '当前原件、实际所在地或前一步条件尚不满足。';
}
export function validateMoonState(s: SliceState): boolean {
  try {
    if (sameMoon(s.moon, createMoonState()))
      return s.progression.pathwayId !== 'moon' || s.progression.sequence !== 0;
    const head = openMoonOwnedEngine(s);
    assertCurrent(s, snapshotMoonOwnedEngine(head));
    return true;
  } catch { return false; }
}
export function hasMoonHistory(s: SliceState): boolean {
  try {
    return s.moon.guidanceKnown && s.moon.source !== null &&
      s.progression.pathwayId === 'moon' && validateMoonSource(s, s.moon.source);
  } catch { return false; }
}
export function hasMoonLock(s: SliceState): boolean { return hasMoonHistory(s); }
export function openMoonOwnedHead(s: SliceState): MoonOwnedEngine {
  const head = openMoonOwnedEngine(s);
  assertCurrent(s, snapshotMoonOwnedEngine(head));
  return head;
}
export function assertOwnedMoonCurrent(s: SliceState, head: MoonOwnedEngine): void {
  const root = snapshotMoonOwnedEngine(head);
  if (!sameMoon(root, s.moon)) throw Error('当前会话与实际存档版本不一致。');
  assertCurrent(s, root);
}
export function moonCommandBlock(s: SliceState, command: MoonCommand): string | null {
  if (!validateMoonCommand(command)) return '这项行动的内容无效。';
  if (s.status !== 'ACTIVE') return '已经死亡或结束的角色不能继续行动。';
  if (command.type === 'LEARN_GUIDANCE') return guidanceBlock(s);
  try { return publicReason(blockMoonOwnedEngine(openMoonOwnedHead(s), command, s.revision + 1)); }
  catch { return '当前记录未通过核验，不能继续行动。'; }
}
export function ownedMoonCommandBlock(s: SliceState, command: MoonCommand, head: MoonOwnedEngine): string | null {
  if (!validateMoonCommand(command)) return '这项行动的内容无效。';
  if (s.status !== 'ACTIVE') return '已经死亡或结束的角色不能继续行动。';
  if (command.type === 'LEARN_GUIDANCE') return '已有本章记录，不能重新开始或补发原物。';
  try {
    assertOwnedMoonCurrent(s, head);
    return publicReason(blockMoonOwnedEngine(head, command, s.revision + 1));
  } catch { return '当前记录未通过核验，不能继续行动。'; }
}

function publish(s: SliceState, command: MoonCommand, root: MoonState, ctx: SeerContext): void {
  const b = root.frame!.budget;
  s.moon = clone(root);
  s.week = b.week; s.date = clone(b.date); s.actionsRemaining = b.actions;
  s.cash = b.cash; s.health = b.health; s.mind = b.mind; s.spirituality = b.spirituality; s.status = b.status;
  s.injuries = clone(b.injuries); s.injuryRisk = b.injuryRisk;
  s.progression.sequence = b.sequence; s.progression.acting = b.acting;
  s.progression.mastery = { ...b.mastery }; s.character.coreStats = { ...b.coreStats };
  s.seer.pollution = b.pollution; s.seer.completedSources = [...b.completedSources];
  s.random = { ...root.frame!.random }; Object.assign(s, clone(root.frame!.finance));
  const event = command.type === 'LEARN_GUIDANCE' ? null : root.journal.at(-1)!;
  s.lastCheck = event?.randomReceipts.length ? clone(event.randomReceipts.at(-1)!.check) : null;
  if (!event) ctx.note('三站夜航与晋升指导', '已支付100便士与1行动核对本人身份、三份美神特性和实际履历。旧人物、原物、当前伤势和旧账保留；接下来须亲自修理原灯原船，接送六名自愿成年人并核验实际到达。');
  else {
    for (const receipt of event.financeReceipts) ctx.note(receipt.title, receipt.text);
    ctx.note(b.sequence === 0 ? '月亮当前行动' : '三站夜航当前行动', event.notes.join(''));
  }
}
export function applyMoonCommand(s: SliceState, command: MoonCommand, ctx: SeerContext): void {
  if (!validateMoonCommand(command) || s.status !== 'ACTIVE') throw Error('当前不能执行这项行动。');
  let root: MoonState;
  if (command.type === 'LEARN_GUIDANCE') {
    const reason = guidanceBlock(s); if (reason) throw Error(reason);
    root = startMoon(s);
  } else root = snapshotMoonOwnedEngine(advanceMoonOwnedEngine(openMoonOwnedHead(s), command, s.revision + 1));
  publish(s, command, root, ctx);
}
export function applyOwnedMoonCommand(s: SliceState, command: MoonCommand, ctx: SeerContext, head: MoonOwnedEngine): MoonOwnedEngine {
  assertOwnedMoonCurrent(s, head);
  if (!validateMoonCommand(command) || command.type === 'LEARN_GUIDANCE' || s.status !== 'ACTIVE')
    throw Error('当前不能执行这项行动。');
  const next = advanceMoonOwnedEngine(head, command, s.revision + 1);
  publish(s, command, snapshotMoonOwnedEngine(next), ctx);
  return next;
}
export function projectMoon(s: SliceState): MoonProjection {
  return projection(s, sameMoon(s.moon, createMoonState()) ? null : openMoonOwnedHead(s));
}
export function projectOwnedMoon(s: SliceState, head: MoonOwnedEngine): MoonProjection {
  assertOwnedMoonCurrent(s, head);
  return projection(s, head);
}

/** Select the next physical step, including a blocked step. The public UI can
 * explain its actual resource/week blocker rather than encourage unrelated
 * purchases or fabricate progress. Safety exits remain independently visible. */
function desiredCommand(root: MoonState): MoonCommand | null {
 const f=root.frame!,b=f.budget,at=(to:string,c:MoonCommand):MoonCommand=>f.location===to?c:{type:'TRAVEL',to};
 if(root.epilogue){const e=root.epilogue;
  if(!e.reported&&e.status!=='ACTIVE')return {type:'EPILOGUE',command:{type:'REPORT'}};
  if(e.status==='ACTIVE'){
   if(!e.observed)return {type:'EPILOGUE',command:{type:'OBSERVE'}};
   if(b.actions===0)return {type:'EPILOGUE',command:{type:'EVACUATE'}};
   if(!e.channel.attempted&&b.cash>=12&&b.spirituality>=12&&b.mind>8)return {type:'EPILOGUE',command:{type:'MOONLIT_CHANNEL'}};
   if(!e.crossing.attempted&&b.cash>=8&&b.spirituality>=10&&b.mind>6)return {type:'EPILOGUE',command:{type:'GENTLE_CROSSING'}};
   if(!moonEpilogueBlock(e,{type:'TRANSFER'},b,root.services!,f.nowSecond))return {type:'EPILOGUE',command:{type:'TRANSFER'}};
   if(!e.moored)return {type:'EPILOGUE',command:{type:'MOOR'}};
   if(!e.ordinaryLantern&&root.services!.stations.find(s=>s.id==='EAST')!.stock.oil.length)return {type:'EPILOGUE',command:{type:'ORDINARY_LANTERN'}};
   return {type:'EPILOGUE',command:{type:'EVACUATE'}};
  }return null;
 }
 if(b.sequence===0)return at(MOON_STATIONS[2].location,{type:'START_EPILOGUE'});
 const st=root.services!.stations.find(st=>!st.verifiedEventId);
 if(st){let type:import('./services.js').MoonServiceCommand['type'];
  if(!st.inspected)type='INSPECT';else if(!st.suppliesBought)type='BUY_SUPPLIES';else if(!st.fitted)type='FIT';else if(st.arrivalEventId)type='VERIFY';else if(st.damaged)type=st.stock.spares.length?'REPAIR_DAMAGE':'BUY_SPARE';
  else {const booked=st.bookings.find(x=>x.status==='BOOKED');if(booked)type=f.nowSecond<booked.window.startSecond?'WAIT':'CONDUCT_SERVICE';else if(!st.stock.oil.length)type=st.oilOrders.some(o=>!o.receivedEventId)?'RECEIVE_OIL':'ORDER_OIL';else type='BOOK';}
  return at(st.location,{type:'SERVICE',command:{stationId:st.id,type}});
 }
 const m=root.materials!,failed=m.compounds.find(p=>p.status==='FAILED_EXPOSED'||p.status==='FAILED_SEALED');
 if(failed)return at(failed.location,{type:'MATERIAL',command:{type:failed.status==='FAILED_EXPOSED'?'SEAL_REMAINS':'RECOVER_SEALED',compoundId:failed.id}});
 const item=m.characteristics.find(i=>!['EMBODIED','PLAYER','COMPOUND','FUSED'].includes(i.holder));
 if(item){if(item.holder==='SUPPLIER'){const step=item.inheritedLabourSteps+item.labour.length;return at(MOON_SUPPLIER,{type:'MATERIAL',command:step<5?{type:'MATERIAL_LABOUR',bottleId:item.originBottleId,taskId:MOON_LABOUR_TASKS[step]!}:{type:'ACQUIRE_CHARACTERISTIC',bottleId:item.originBottleId}});}return at(MOON_SUPPLIER,{type:'MATERIAL',command:{type:item.holder==='UNLOCATED'?'INVESTIGATE_LEGACY_REMAINS':'RECOVER_LEGACY_REMAINS',bottleId:item.originBottleId}});}
 if(m.uniqueness.holder==='CUSTODIAN'){
  if(!m.uniqueness.checks.some(c=>c.step==='CHAIN'))return at(MOON_ARCHIVE,{type:'MATERIAL',command:{type:'VERIFY_UNIQUENESS',step:'CHAIN'}});
  if(!m.uniqueness.checks.some(c=>c.step==='VACANCY'&&c.week===b.week))return at(MOON_VAULT,{type:'MATERIAL',command:{type:'VERIFY_UNIQUENESS',step:'VACANCY'}});
  return at(MOON_VAULT,{type:'MATERIAL',command:{type:'ACQUIRE_UNIQUENESS'}});
 }
 const p=m.compounds.find(p=>p.status==='PREPARED');
 if(p){const preview=getMoonPromotionStabilityPreview(root,p.id);return at(MOON_WORKSHOP,preview.prepared?{type:'CONSUME',compoundId:p.id,confirmed:true}:{type:'STABILIZE_PROMOTION',compoundId:p.id});}
 const held=m.batches.find(x=>x.status==='PLAYER');if(held)return at(MOON_WORKSHOP,{type:'MATERIAL',command:{type:'COMPOSE_POTION',batchId:held.id}});
 const supplier=m.batches.find(x=>x.status==='SUPPLIER');if(supplier)return at(MOON_SUPPLIER,{type:'MATERIAL',command:{type:'BUY_COMPOUND',batchId:supplier.id}});
 const ordered=m.batches.find(x=>x.status==='REPAIR_ORDERED');if(ordered)return at(MOON_SUPPLIER,{type:'MATERIAL',command:{type:'RECEIVE_COMPOUND_REPAIR',batchId:ordered.id}});
 const spent=m.batches.find(x=>x.status==='SPENT');if(spent&&m.refills.some(r=>!r.assignedBatchId))return at(MOON_SUPPLIER,{type:'MATERIAL',command:{type:'REQUEST_COMPOUND_REPAIR',batchId:spent.id}});
 return null;
}
import { moonEpilogueBlock } from './epilogue.js';
function projection(s: SliceState,head: MoonOwnedEngine|null): MoonProjection {
 const root=head?snapshotMoonOwnedEngine(head):s.moon,f=root.frame,b=f?.budget??moonBudget(s),promoted=s.progression.pathwayId==='moon'&&b.sequence===0&&root.promotionWeek!==null;
 const definitions=s.progression.pathwayId==='moon'?[...BEAUTY_GODDESS_INHERITED_ABILITIES,...BEAUTY_GODDESS_ABILITIES,...(promoted?MOON_ABILITIES:[])]:[];
 const result:MoonProjection={title:'序列0 月亮',guidanceKnown:root.guidanceKnown,promoted,story:MOON_STORY,nextStep:MOON_GOAL,risk:MOON_RISK,resources:{health:b.health,mind:b.mind,spirituality:b.spirituality,cash:`${b.cash}便士`,actionsRemaining:b.actions},abilities:definitions.filter(a=>Object.hasOwn(b.mastery,a.id)).map(a=>({id:a.id,label:a.label,description:a.description,mastery:b.mastery[a.id]??0})),actions:[],sections:[],insideCase:root.epilogue?.status==='ACTIVE'};
 const add=(command:MoonCommand,label:string,cost:string)=>{const reason=publicReason(head?blockMoonOwnedEngine(head,command,s.revision+1):moonCommandBlock(s,command));result.actions.push({id:`moon:${result.actions.length}:${command.type}`,label,cost,command:clone(command),enabled:reason===null,reason});};
 if(!root.guidanceKnown){add({type:'LEARN_GUIDANCE'},'听取三站夜航与原特性指导','1行动、100便士');result.actions[0]!.preferredAction=true;return result;}
 const h=moonHost(root,`R212:${root.source!.runId}:${s.revision+1}`,s.revision+1),partner=root.source!.originalPartner,place=MOON_CITY_PLACES.find(p=>p.id===f!.location)?.title??'当前现场';
 const day=Math.floor(f!.nowSecond/86400)+1,hour=Math.floor(f!.nowSecond%86400/3600),minute=Math.floor(f!.nowSecond%3600/60);
 result.sections.push({id:'clock',title:'真实夜航时刻与当前地点',lines:[`当前位置：${place}；第${b.week}周，本章第${day}天${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')}。`,'夜航窗口为20时至24时；公开周表第二天大风停航，其余夜间为晴夜。等候不会重抽天气，也不会领取工资。',`距下一真实周界${Math.ceil((f!.weekAnchor+604800-f!.nowSecond)/3600)}小时；每次跨界照常结生活费与旧债，只重置普通行动。`]});
 result.sections.push(...projectMoonServices(root.services!,f!.nowSecond));
 result.sections.push({id:'materials',...projectMoonMaterials(root.materials!)});
 result.sections.push({id:'finance',title:'原职业、生活费与旧账',lines:[`现款${b.cash}便士；原职业每周${root.source!.character.weeklyWage}便士，须真实工作才能领取一次。`,`未付本金${f!.finance.debts.reduce((sum,d)=>sum+d.remaining,0)}便士；下次约定还款${f!.finance.debts.reduce((sum,d)=>sum+Math.min(d.remaining,d.weeklyPayment),0)}便士。`,'没有被动工资；周结不足的生活费如实计欠，之后转赤贫生活。']});
 result.sections.push({id:'body',title:'本人身体、原来客与普通医疗',lines:[`${s.character.name}，${s.character.age}岁，当前${s.character.gender==='FEMALE'?'女性':'原有'}身体；此后不再改写姓名、性别、性格或取向。`,`健康${b.health}，精神${b.mind}，灵性${b.spirituality}/${promoted?MOON_SPIRITUALITY_CAP:120}，污染${b.pollution}，意志${b.coreStats.will}。`,...(b.injuries.length?b.injuries.map(i=>`${i.severity==='HEAVY'?'重伤':'轻伤'}：${i.treatedRevision===null?'尚未处置':'已普通处置，仍须实际休养'}。`):['当前没有实际伤势。']),`${partner.name}仍是原来的同一身体，${partner.location==='HOME'?'在原来的家中': '在原实际所在地'}；健康${partner.health}，精神${partner.mind}，精力${partner.stamina}。本人夜航没有召唤、移动、复活或补充来客。`,'重伤须实付60便士与1行动作普通处置，再实际休养至80健康。普通停航、岸路返程和步行回事务所不需行动或现款。']});
 const latest=root.journal.at(-1);
 result.sections.push({id:'recent-action',title:'最近实际行动、费用与检定',lines:latest?[...latest.notes,...latest.financeReceipts.map(r=>r.text),...latest.randomReceipts.map(r=>`本次实际检定：成功率${r.check.chance}%，掷出${r.check.roll}，${r.check.tier==='SUCCESS'?'成功':r.check.tier==='GREAT_SUCCESS'?'大成功':r.check.tier==='FAILURE'?'失败':'严重失败'}。`),`本次现款变化${latest.after.budget.cash-latest.before.budget.cash}便士。`]:['已实际支付100便士和1行动听取指导，旧身体、来客、失败原瓶和原账全部保留。']});
 if(root.epilogue){const ep=projectMoonEpilogue(root.epilogue,root.services!);result.story=ep.story;result.nextStep=ep.nextStep;result.sections.unshift({id:'epilogue',title:'东岸原船松缆的有限处置',lines:ep.lines});for(const a of getMoonEpilogueActions(root.epilogue,b,root.services!,f!.nowSecond))add({type:'EPILOGUE',command:a.command},a.label,a.cost);if(root.epilogue.status==='ACTIVE'){const preview=getMoonEpilogueCheckPreview(root,'MOONLIT_CHANNEL')!;result.sections.push({id:'epilogue-readiness',title:'两项有限技巧与普通退路',lines:[`两项技巧当前成功率均为${preview.chance}%，每项本场只可尝试一次，失败也实付费用。`,'月照航道：1行动、12便士、12灵性、8精神，最多随后两次现场动作；柔和渡行：1行动、8便士、10灵性、6精神，限完成后六十秒内的一次真实转移。','只有成功且实际用于转移才增加掌握。普通系缆、停航、岸路撤离与本人离场不依赖施术成功。']});const desired=desiredCommand(root);for(const a of result.actions)if(sameMoon(a.command,desired))a.preferredAction=true;return result;}}
 if(!promoted){for(const a of getMoonServiceActions(root.services!,h))add({type:'SERVICE',command:a.command},a.label,a.cost);for(const a of getMoonMaterialActions(root.materials!,h))add({type:'MATERIAL',command:a.command},a.label,a.cost);const lines:string[]=[];for(const p of root.materials!.compounds.filter(c=>c.status==='PREPARED')){const preview=getMoonPromotionStabilityPreview(root,p.id);lines.push(`本瓶付费准备后的实际成功率${preview.preparedChance}%；${preview.prepared?'准备仍在原室和七天实际期限内有效':'须先实际付费准备，当前不能服药'}。`,'准备实付100便士、1行动、12灵性和8精神，绑定本人、这一瓶、已核验的三站到达和当前原室；离室、过期或服用即失效。','检定按实际意志与40点本次准备修正、难度58计算；不更换骰子，不保证成功。普通失败损失45健康、40精神并增加35污染和重伤；严重失败可能死亡。');add({type:'STABILIZE_PROMOTION',compoundId:p.id},'为本瓶完成实际付费稳定准备','1行动、100便士、12灵性、8精神');add({type:'CONSUME',compoundId:p.id,confirmed:true},'独立确认风险并饮用本瓶',`1行动、30灵性；有效准备后实际${preview.preparedChance}%成功；失败可能重伤、污染或死亡`);}if(lines.length)result.sections.push({id:'promotion-stability',title:'本瓶真实风险与付费准备',lines});}
 else if(!root.epilogue)add({type:'START_EPILOGUE'},'进入东岸原渡船松缆现场','0行动，实际步行入场十分钟，不补资源');
 for(const destination of MOON_CITY_PLACES)if(destination.id!==f!.location)add({type:'TRAVEL',to:destination.id},`沿普通道路前往${destination.title}`,'1行动、2便士，实际半小时');
 if(f!.location!==MOON_HOME)add({type:'RETURN_ON_FOOT'},'沿普通道路步行返回岸边事务所','0行动、0便士，实际步行两小时');
 add({type:'WORK'},'做本周原职业工作',`1行动；${root.source!.character.weeklyWage}便士，每周一次`);add({type:'CLINIC'},'付费普通处置实际重伤','1行动、60便士，之后仍须休养');add({type:'REST'},'按当前生活档实际休养','1行动，实际八小时；未处置重伤仍保留');add({type:'NEXT_WEEK'},'走到下一真实周界','结算生活费与约定还款，不领工资、不自动修复');
 const desired=desiredCommand(root);for(const a of result.actions)if(sameMoon(a.command,desired))a.preferredAction=true;
 const preferred=result.actions.find(a=>a.preferredAction);if(preferred)result.nextStep=`${preferred.label}。${preferred.reason??'按实际费用和时间完成这一步。'}`;
 return result;
}
