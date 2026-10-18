import type { SliceState } from '../slice/types.js';
import type { PublicCoreStatKey } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { addGameWeeks, addGameDays } from '../game-calendar.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance, resolveNormalCheck } from '../../resolution/normal-check.js';
import { createDoorSource, validateDoorSource, doorBudget, type DoorSource, type DoorBudget } from './source.js';
import { createDoorServices, doorServicesBlock, applyDoorService, validateDoorServiceCommand, doorServiceVerifiedReceipts, canLeaveDoorServices } from './services.js';
import { DOOR_MATERIAL_POLICY, doorSuccessionAt } from './material-content.js';
import { createDoorMaterials, doorMaterialBlock, applyDoorMaterial, transportDoorMaterials, settleDoorConsumption, validateDoorMaterialCommand, doorServiceReceiptsComplete } from './materials.js';
import { DOOR_CITY_PLACES, DOOR_HOME, DOOR_WORKSHOP, DOOR_GUIDANCE, DOOR_CONSUMPTION, DOOR_PROMOTION_STABILITY, DOOR_EPILOGUE_BONUS, DOOR_SPIRITUALITY_CAP, DOOR_GATE } from './content.js';
import { DOOR_ABILITY_IDS, type DoorState, type DoorCommand, type DoorFrame, type DoorEvent, type DoorCheckReceipt, type DoorPromotionPreparation } from './types.js';
import { createDoorEpilogue, applyDoorEpilogue, doorEpilogueBlock, validateDoorEpilogueCommand, getDoorEpilogueCheckInput } from './epilogue.js';
import type { DoorHost, DoorEffect } from './ports.js';
export const sameDoor = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
export const doorDigest = (v: unknown): string => sha256Hex(stableStringify(v));
function need(v: unknown, reason: string): asserts v { if (!v) throw Error(reason); }
const clone = <T>(v: T): T => structuredClone(v);
const city = (id: string): boolean => DOOR_CITY_PLACES.some(p => p.id === id);
function dataDigest(root: DoorState): string { const { journal: _journal, ...data } = root; return doorDigest(data); }
export function createDoorState(): DoorState { return { version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null, services: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] } }; }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: object, keys: string[]): boolean => sameDoor(Object.keys(v).sort(), keys.sort());
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 300 && v.trim() === v;
export function validateDoorCommand(v: unknown): v is DoorCommand {
 if (!record(v)) return false;
 if (['LEARN_GUIDANCE','WORK','REST','CLINIC','NEXT_WEEK','START_EPILOGUE','RETURN_ON_FOOT'].includes(String(v.type))) return exact(v,['type']);
 if (v.type === 'TRAVEL') return exact(v,['type','to']) && id(v.to) && city(v.to);
 if (v.type === 'STABILIZE_PROMOTION') return exact(v,['type','compoundId']) && id(v.compoundId);
 if (v.type === 'CONSUME') return exact(v,['type','compoundId','confirmed']) && id(v.compoundId) && v.confirmed === true;
 if (!exact(v,['type','command'])) return false;
 return v.type === 'SERVICE' ? validateDoorServiceCommand(v.command) : v.type === 'MATERIAL' ? validateDoorMaterialCommand(v.command) : v.type === 'EPILOGUE' ? validateDoorEpilogueCommand(v.command) : false;
}
declare const doorOwnedEngineBrand: unique symbol;
export interface DoorOwnedEngine { readonly [doorOwnedEngineBrand]: true }
const owned = new WeakMap<DoorOwnedEngine, DoorState>();
function getOwned(h: DoorOwnedEngine): DoorState { const r = owned.get(h); need(r,'无效的当前领域会话。'); return r; }
function retain(root: DoorState): DoorOwnedEngine { const h = Object.freeze({}) as DoorOwnedEngine; owned.set(h, root); return h; }
function start(source: DoorSource): DoorState {
 const root = createDoorState(); root.guidanceKnown = true; root.source = clone(source);
 root.frame = { budget: clone(source.budget), finance: clone(source.finance), random: { ...source.random }, location: DOOR_HOME, nowSecond: 36000, weekAnchor: 0 };
 pay(root.frame.budget, DOOR_GUIDANCE);
 root.services = createDoorServices(source.runId,source.actorId,source.budget.week,root.frame.nowSecond);
 root.materials = createDoorMaterials({ ...clone(source.acquisition), actorId: source.actorId,
  sourceDigest: source.historyDigest, inheritanceLocation: DOOR_HOME }, DOOR_MATERIAL_POLICY, source.originals.gallery);
 return root;
}
export function startDoor(s: SliceState): DoorState { return start(createDoorSource(s)); }
export function doorHost(root: DoorState, eventId: string, revision: number, originalBottleId?: string): DoorHost {
 const f = root.frame!, b = f.budget, source = root.source!;
 const date = addGameDays(b.date, Math.floor((f.nowSecond - f.weekAnchor) / 86400));
 const site = root.materials!.legacySites.find(site => site.location === f.location && site.residualPresent && (!originalBottleId || site.originalBottleId === originalBottleId));
 const succession = ['UNVERIFIED','CUSTODIAN'].includes(root.materials!.uniqueness.holder) ? doorSuccessionAt(date) : null;
 return { eventId, revision, week: b.week, date, actorId: source.actorId, location: f.location,
  nowSecond: f.nowSecond, weekAnchor: f.weekAnchor, sourceDigest: source.historyDigest,
  serviceReceipts: doorServiceVerifiedReceipts(root.services!), sequence: b.sequence,
  status: b.status === 'ACTIVE' ? 'ACTIVE' : 'DEAD', cash: b.cash, actions: b.actions,
  health: b.health, mind: b.mind, spirituality: b.spirituality, check: null,
  legacyAccess: site ? clone(site) : null, succession };
}
function pay(b: DoorBudget, c: { actions?: number; cash?: number; spirituality?: number; mind?: number; health?: number; pollution?: number }): void {
 need(b.actions >= (c.actions ?? 0) && b.cash >= (c.cash ?? 0) && b.spirituality >= (c.spirituality ?? 0),'实际行动、费用或灵性不足。');
 b.actions -= c.actions ?? 0; b.cash -= c.cash ?? 0; b.spirituality -= c.spirituality ?? 0; b.health = Math.max(0,b.health-(c.health??0)); b.mind = Math.max(0,b.mind-(c.mind??0)); b.pollution = Math.min(100,b.pollution+(c.pollution??0));
 if (b.health === 0 || b.mind === 0 || b.pollution >= 100) { b.status = 'DEAD'; b.health = 0; }
}
function checks(f: DoorFrame, eventId: string) {
 const receipts: DoorCheckReceipt[] = [];
 const check = (ability: PublicCoreStatKey, difficulty: number, modifier = 0, source = '实际在场条件') => {
  const before = f.random.cursor, rng = new DeterministicActionRandomStream(f.random.seed,before);
  const result = resolveNormalCheck({ ability, baseAbility: f.budget.coreStats[ability], difficulty, modifiers: modifier ? [{source,value:modifier}] : [], roll: rng.nextInt(1,100) });
  f.random.cursor = rng.cursor; receipts.push({ kind: 'CHECK', id: `${eventId}:check:${receipts.length+1}`, check: result, cursorBefore: before, cursorAfter: rng.cursor }); return result;
 }; return { receipts, check };
}
/** Time advances once, against the chapter's fixed week anchor. Every crossed
 * real week bills the existing finance reducer; only WORK pays actual wages. */
function elapse(root: DoorState, seconds: number, revision: number, eventId: string, receipts: DoorEvent['financeReceipts']): void {
 const f = root.frame!, b = f.budget; need(Number.isSafeInteger(seconds) && seconds >= 0,'实际用时无效。');
 const target = f.nowSecond + seconds;
 while (target >= f.weekAnchor + 604800) {
  let result = resolveSliceWeeklyFinance({ ...f.finance, week: b.week, revision, cash: b.cash, pulse: 'BILL', billAmount: 0 }); receipts.push(...result.receipts);
  if (result.eventId === 'LIFE-BILL-01') {
   const due = SLICE_LIFE[result.state.lifeTier].cost, paid = result.state.cash;
   result.state.cash = 0; result.state.debts.push({ id: `${eventId}:living-debt:${b.week}`, source: '生活应付款', remaining: due-paid, weeklyPayment: 30, createdWeek: b.week }); result.state.nextLifeTier = 'DESTITUTE'; result.state.pulse = 'DEBTS';
   receipts.push({ title: '本周生活应付款', text: `已付${paid}便士，未付${due-paid}便士如实计欠；下周采用赤贫生活。` }); result = resolveSliceWeeklyFinance(result.state); receipts.push(...result.receipts);
  }
  b.cash = result.state.cash; const { nextLifeTier, debts, missedWeeks, credit } = result.state; Object.assign(f.finance,{ lifeTier:nextLifeTier,nextLifeTier,debts:clone(debts),missedWeeks,credit });
  b.week++; b.date = addGameWeeks(b.date,1); b.actions = f.finance.weeklyBudget; f.weekAnchor += 604800;
 }
 f.nowSecond = target;
}
function effect(root: DoorState, e: DoorEffect, revision: number, eventId: string, receipts: DoorEvent['financeReceipts']): void {
 const f=root.frame!, from=f.location; pay(f.budget,{actions:e.actions,cash:e.cashCost,spirituality:e.spirituality,mind:e.mind,health:e.health}); f.budget.cash += e.cashGain;
 if (e.toLocation !== null) f.location=e.toLocation;
 if (from !== f.location) root.materials = transportDoorMaterials(root.materials!,from,f.location);
 elapse(root,e.seconds,revision,eventId,receipts);
}
function windowFor(root: DoorState) {
 const receipts = doorServiceVerifiedReceipts(root.services!);
 return doorServiceReceiptsComplete(receipts, DOOR_MATERIAL_POLICY, root.frame!.budget.week)
  ? { id: 'door-three-original-services-reviewed', receipts: receipts.flatMap(r => [r.passedEventId,r.reviewedEventId]) } : null;
}
function preparation(root: DoorState, compoundId: string): DoorPromotionPreparation|null {
 const f=root.frame!, p=root.materials!.compounds.find(c=>c.id===compoundId), w=windowFor(root);
 return root.promotionStability.preparations.find(x=>x.status==='READY'&&x.compoundId===compoundId&&x.actorId===root.source!.actorId&&x.sourceDigest===root.source!.historyDigest&&p?.status==='PREPARED'&&x.compoundDigest===doorDigest(p)&&x.location===f.location&&w&&x.windowId===w.id&&sameDoor(x.receipts,w.receipts)&&f.nowSecond>=x.preparedSecond&&f.nowSecond<=x.expiresSecond)??null;
}
function consumeBlock(root: DoorState, compoundId: string, forPreparation=false): string|null {
 const f=root.frame!,b=f.budget,p=root.materials!.compounds.find(c=>c.id===compoundId);
 if(b.sequence!==1||root.promotionWeek!==null||b.acting!==100)return '须由已经完整消化的星之匙本人服药。';
 if(b.week-root.source!.acquisition.promotionWeek<12)return '成为星之匙尚未满12个实际周，仍可服务、工作与休养。';
 if(!windowFor(root))return '先完成三件原居民的实际服务交接和现场核验。';
 if(f.location!==DOOR_WORKSHOP)return '本人和同一成药须真实抵达封闭调配室。';
 if(b.health<80||b.mind<(forPreparation?78:70)||b.injuries.length)return forPreparation?'先恢复到80健康、78精神并解除实际伤势，再准备。':'先恢复到80健康、70精神并解除实际伤势。';
 if(p?.status!=='PREPARED'||p.location!==f.location)return '同一瓶成药尚未实际备好并带到现场。';
 if(b.actions<DOOR_CONSUMPTION.actions||b.spirituality<DOOR_CONSUMPTION.spirituality)return '服药需要1行动与30灵性。';
 if(!forPreparation&&!preparation(root,compoundId))return '这条晋升路线须先为同一瓶完成实际付费稳定准备，准备不能过期或带离原室。';
 return null;
}
export function getDoorPromotionStabilityPreview(root: DoorState, compoundId: string) {
 const f=root.frame!,b=f.budget,prepared=!!preparation(root,compoundId),cost=DOOR_PROMOTION_STABILITY;
 let reason=consumeBlock(root,compoundId,true);
 if(!reason&&prepared)reason='本瓶有效稳定准备已经完成。';
 if(!reason&&(b.cash<cost.cash||b.spirituality<cost.spirituality+DOOR_CONSUMPTION.spirituality||b.mind<70+cost.mind))reason='准备须实付150便士、12灵性和8精神，并保留服药的30灵性与70精神。';
 const preparedChance=computeCheckChance({baseAbility:b.coreStats.will,difficulty:DOOR_CONSUMPTION.difficulty,modifiers:[{source:'本瓶本次实际稳定准备',value:DOOR_CONSUMPTION.bonus}]});
 return {eligible:reason===null,reason,prepared,cost,chance:preparedChance,preparedChance,window:windowFor(root)};
}
export function getDoorEpilogueCheckPreview(root: DoorState, kind: import('./epilogue.js').DoorEpilogueCommand['type']) {
 const input = getDoorEpilogueCheckInput({type:kind} as import('./epilogue.js').DoorEpilogueCommand);
 if (!input) return null;
 return { ability:input.ability,difficulty:input.difficulty,effectiveBonus:input.modifier,source:input.source,
  chance:computeCheckChance({baseAbility:root.frame!.budget.coreStats[input.ability],difficulty:input.difficulty,modifiers:[{source:input.source,value:input.modifier}]}) };

}
function commandBlock(root: DoorState,c: DoorCommand,revision: number): string|null {
 if(!validateDoorCommand(c)||c.type==='LEARN_GUIDANCE')return '这项行动无效或已经听取指导。';
 const f=root.frame,b=f?.budget;
 if(!root.guidanceKnown||!root.source||!f||!b||b.status!=='ACTIVE')return '已经死亡或结束的角色不能继续行动。';
 if(revision!==root.source.revision+2+root.journal.length)return '本次实际动作次序无效。';
 // No journal-capacity gate may strand a living person or block ordinary life.
 if(root.epilogue?.status==='ACTIVE'&&c.type!=='EPILOGUE')return '先完成现场处置或沿普通侧路离场。';
 const h=doorHost(root,`R218:${root.source.runId}:${revision}`,revision,c.type==='MATERIAL'&&'bottleId' in c.command?c.command.bottleId:undefined);
 if(!canLeaveDoorServices(root.services!,f.location)&&c.type!=='SERVICE')return '先实际停止本处作业并走回当前入口；不能借旅行或周结跳过普通收束。';
 if(c.type==='NEXT_WEEK')return null;
 if(c.type==='WORK')return f.finance.wagePaidWeek===b.week?'本周原职业工资已经结算。':b.actions<1?'工作需要一次行动。':null;
 if(c.type==='REST')return b.actions<1?'休养需要一次行动，可先走到下一实际周界。':null;
 if(c.type==='CLINIC')return !b.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null)?'没有尚未处置的重伤。':b.actions<1||b.cash<60?'普通处置需要1行动和60便士。':null;
 if(c.type==='TRAVEL')return c.to===f.location?'本人已在这处地点。':b.actions<1?'普通步行前往需1行动；可免费步行回街区接待处。':null;
 if(c.type==='RETURN_ON_FOOT')return f.location===DOOR_HOME?'本人已在街区接待处。':null;
 if(c.type==='SERVICE')return b.sequence!==1?'原服务交接与核验记录已封存，晋升后继续起重棚事故现场。':doorServicesBlock(root.services!,c.command,h);
 if(c.type==='MATERIAL')return b.sequence!==1?'本人的晋升已经实际结束。':doorMaterialBlock(root.materials!,c.command,h,DOOR_MATERIAL_POLICY);
 if(c.type==='STABILIZE_PROMOTION')return getDoorPromotionStabilityPreview(root,c.compoundId).reason;
 if(c.type==='CONSUME')return consumeBlock(root,c.compoundId);
 if(c.type==='START_EPILOGUE')return b.sequence!==0||root.promotionWeek===null||root.epilogue!==null?'须由实际晋升且尚未处理这宗事故的本人进入。':f.location!==DOOR_GATE?'须先沿普通路步行到起重棚事故。':null;
 if(c.type==='EPILOGUE')return !root.epilogue||f.location!==root.epilogue.location?'须本人在同一起重棚事故现场。':doorEpilogueBlock(root.epilogue,c.command,h);
 return '当前没有这项行动。';
}
function reduce(root: DoorState,c: DoorCommand,revision: number): DoorEvent {
 const reason=commandBlock(root,c,revision); need(reason===null,reason??'当前无法行动。');
 const f=root.frame!,b=f.budget,eventId=`R218:${root.source!.runId}:${revision}`,before=clone(f),beforeDigest=dataDigest(root),random=checks(f,eventId),financeReceipts:DoorEvent['financeReceipts']=[],notes:string[]=[];
 const time=(seconds:number)=>elapse(root,seconds,revision,eventId,financeReceipts);
 if(c.type==='WORK'){pay(b,{actions:1});b.cash+=root.source!.character.weeklyWage;f.finance.wagePaidWeek=b.week;time(28800);notes.push(`本周原职业工资${root.source!.character.weeklyWage}便士实际入账，同周不能再次领取。`);}
 else if(c.type==='REST'){pay(b,{actions:1});const life=SLICE_LIFE[f.finance.lifeTier];b.health=Math.min(100,b.health+life.health);b.mind=Math.min(100,b.mind+life.mind);const cap=b.sequence===0?DOOR_SPIRITUALITY_CAP:120;b.spirituality=Math.min(cap,b.spirituality+Math.round(cap*life.spirituality));b.pollution=Math.max(0,b.pollution-10);b.injuries=b.injuries.filter(i=>!(b.health>=80&&i.acquiredRevision<revision&&(i.severity==='LIGHT'||i.treatedRevision!==null&&i.treatedRevision<revision)));if(!b.injuries.length)b.injuryRisk=0;time(28800);notes.push('按实际生活档休养，未处置的重伤仍保留；原居民身体和精力没有得到补充。');}
 else if(c.type==='CLINIC'){pay(b,{actions:1,cash:60});for(const i of b.injuries)if(i.severity==='HEAVY'&&i.treatedRevision===null)i.treatedRevision=revision;time(3600);notes.push('实付60便士进行普通重伤处置，之后仍须实际休养至80健康。');}
 else if(c.type==='NEXT_WEEK'){b.actions=0;time(f.weekAnchor+604800-f.nowSecond);notes.push('走到下一实际周界，原生活费与约定还款照常结算；没有自动工资、免费修理或恢复。');}
 else if(c.type==='TRAVEL'||c.type==='RETURN_ON_FOOT'){const from=f.location;if(c.type==='TRAVEL')pay(b,{actions:1});f.location=c.type==='TRAVEL'?c.to:DOOR_HOME;root.materials=transportDoorMaterials(root.materials!,from,f.location);time(c.type==='TRAVEL'?1800:7200);notes.push(c.type==='TRAVEL'?'本人和同一批随身原物沿普通道路实际步行半小时抵达；旧章原人原物没有随行。':'本人携同一批随身原物沿普通道路步行两小时返回街区接待处，无需行动或现款；旧费用、伤势与原物去向保留。');}
 else if(c.type==='SERVICE'){
  const h=doorHost(root,eventId,revision);
  const result=applyDoorService(root.services!,c.command,h);root.services=result.state;
  effect(root,result.effect,revision,eventId,financeReceipts);
  notes.push(...result.notes);
 }
 else if(c.type==='MATERIAL'){
  const result=applyDoorMaterial(root.materials!,c.command,doorHost(root,eventId,revision,'bottleId' in c.command?c.command.bottleId:undefined),DOOR_MATERIAL_POLICY);
  root.materials=result.state;effect(root,{cashGain:0,spirituality:0,mind:0,health:0,toLocation:null,...result.effect},revision,eventId,financeReceipts);notes.push(...result.notes);
 } else if(c.type==='STABILIZE_PROMOTION'){const w=windowFor(root)!,compound=root.materials!.compounds.find(x=>x.id===c.compoundId)!;pay(b,DOOR_PROMOTION_STABILITY);time(DOOR_PROMOTION_STABILITY.seconds);root.promotionStability.preparations.push({id:`${eventId}:stability`,eventId,compoundId:compound.id,actorId:root.source!.actorId,sourceDigest:root.source!.historyDigest,compoundDigest:doorDigest(compound),location:f.location,week:b.week,windowId:w.id,startWeek:b.week,endWeek:b.week+1,preparedSecond:f.nowSecond,expiresSecond:f.nowSecond+DOOR_PROMOTION_STABILITY.validSeconds,receipts:[...w.receipts],status:'READY',spentEventId:null,invalidatedEventId:null});notes.push('实付150便士、1行动、12灵性与8精神，完成同一本人、同一瓶、原调配室和三件居民服务交接及现场核验的稳定准备。实际七天内有效，离室、换瓶或服药即不能沿用。');}
 else if(c.type==='CONSUME'){
  const p=preparation(root,c.compoundId);need(p,'实际付费准备缺失。');const check=random.check('will',DOOR_CONSUMPTION.difficulty,DOOR_CONSUMPTION.bonus,'本瓶本次实际稳定准备'),success=['SUCCESS','GREAT_SUCCESS'].includes(check.tier),severe=check.tier==='GREAT_FAILURE';pay(b,{actions:DOOR_CONSUMPTION.actions,spirituality:DOOR_CONSUMPTION.spirituality});
  if(success){pay(b,{mind:DOOR_CONSUMPTION.successMind});b.sequence=0;b.acting=0;root.promotionWeek=b.week;for(const ability of DOOR_ABILITY_IDS)b.mastery[ability]=0;b.completedSources.push('DOOR_ORIGINAL_SUCCESSION');}
  else{pay(b,{health:severe?DOOR_CONSUMPTION.greatFailureHealth:DOOR_CONSUMPTION.failureHealth,mind:severe?DOOR_CONSUMPTION.greatFailureMind:DOOR_CONSUMPTION.failureMind,pollution:severe?DOOR_CONSUMPTION.greatFailurePollution:DOOR_CONSUMPTION.failurePollution});b.injuries.push({id:`${eventId}:potion-injury`,severity:'HEAVY',acquiredRevision:revision,treatedRevision:null});b.injuryRisk+=2;}
  root.materials=settleDoorConsumption(root.materials!,{eventId,week:b.week,compoundId:c.compoundId,success,alive:b.status==='ACTIVE',location:f.location,residualPresent:b.status==='ACTIVE'});p.status='SPENT';p.spentEventId=eventId;time(3600);
  notes.push(success?'三份原特性与同一唯一性在同一本人体内融合。精神实扣12，两项新技巧从零掌握开始，旧身份、17项旧掌握、伤势和资源不补满。':'同一成药已实际耗尽，失败损伤、污染和重伤照常结算，没有不死保底。尚存活者可在原处免费封存后隔周付费回收；死亡者的三份原特性与唯一性留在现场。');
 }
 else if(c.type==='START_EPILOGUE'){
  root.epilogue=createDoorEpilogue({week:b.week,nowSecond:f.nowSecond,actorId:root.source!.actorId});
  time(600);notes.push('本人来到新起重棚的实际险情现场；先实际问过居民、查看原起重机构和普通退路，不搬来旧章人物或物件。');
 }
 else if(c.type==='EPILOGUE'){
  const h=doorHost(root,eventId,revision),preview=getDoorEpilogueCheckPreview(root,c.command.type);
  if(preview)h.check=random.check(preview.ability,preview.difficulty,preview.effectiveBonus,preview.source);
  const result=applyDoorEpilogue(root.epilogue!,c.command,h);root.epilogue=result.state;
  effect(root,result.effect,revision,eventId,financeReceipts);
  for(const [ability,gain] of Object.entries(result.masteryGains)) { need(DOOR_ABILITY_IDS.some(id=>id===ability)&&Number.isSafeInteger(gain)&&gain>=0,'有限技巧的实际应用记录无效。'); b.mastery[ability]=(b.mastery[ability]??0)+gain; }
  for(const injury of result.injuries){b.injuries.push(clone(injury));b.injuryRisk+=injury.severity==='HEAVY'?2:1;}
  notes.push(...result.notes);
 }
 if(b.status!=='ACTIVE'){for(const item of [...root.materials!.characteristics,root.materials!.uniqueness])if(['EMBODIED','FUSED','PLAYER','COMPOUND'].includes(item.holder)){item.holder='LOST';item.location=f.location;}root.materials!.uniqueness.incumbentActorId=null;root.materials!.uniqueness.custodianActorId=null;}
 for(const p of root.promotionStability.preparations)if(p.status==='READY'&&preparation(root,p.compoundId)?.id!==p.id){p.status='INVALIDATED';p.invalidatedEventId=eventId;}
 const event:DoorEvent={id:eventId,revision,command:clone(c),before,after:clone(f),randomReceipts:clone(random.receipts),financeReceipts,notes,beforeDigest,afterDigest:dataDigest(root)};root.journal.push(event);return event;
}
/** Cold/raw entry strictly replays every new command once. Owned transitions
 * are private WeakMap-branded drafts and never reopen/replay their prefix. */
function reconstruct(s: SliceState): DoorState {
 const saved=s.door;need(saved?.source&&validateDoorSource(s,saved.source,'COLD_REOPEN'),'原身份、原人原物和三份特性历史未通过核验。');need(Array.isArray(saved.journal),'实际动作记录无效。');
 const root=start(clone(saved.source));for(const event of saved.journal){need(event&&event.revision===saved.source.revision+2+root.journal.length,'本章修订次序不一致。');const actual=reduce(root,clone(event.command),event.revision);need(sameDoor(actual,event),'实际行动、检定、代价或来源与原记录不一致。');}need(sameDoor(root,saved),'当前通路、原物和身体无法由实际行动重建。');
 const f=root.frame!,source=root.source!,{coreStats:_current,...identity}=s.character,{coreStats:_original,...originalIdentity}=source.character;
 need(s.progression.pathwayId==='door'&&s.revision===source.revision+1+root.journal.length&&sameDoor(doorBudget(s),f.budget)&&sameDoor(s.random,f.random),'当前身体与实际动作终点不一致。');need(sameDoor(identity,originalIdentity)&&Object.entries(f.finance).every(([key,value])=>sameDoor(s[key as keyof SliceState],value)),'当前身份或生活账本不一致。');need(s.combatHistory.length===source.combatHistoryLength&&s.combat===null&&s.activeEvent===null&&s.eventQueue.length===0&&s.pulse==='NONE','旧现场或原战斗终点不一致。');return root;
}
export function validateDoorRoot(s: SliceState): void { reconstruct(s); }
export function transitionDoor(s: SliceState,c: DoorCommand): DoorState {const root=reconstruct(s);reduce(root,clone(c),s.revision+1);return root;}
export function openDoorOwnedEngine(s: SliceState): DoorOwnedEngine { return retain(reconstruct(clone(s))); }
export function snapshotDoorOwnedEngine(h: DoorOwnedEngine): DoorState { return clone(getOwned(h)); }
export function advanceDoorOwnedEngine(h: DoorOwnedEngine,c: DoorCommand,revision: number): DoorOwnedEngine {const next=clone(getOwned(h));reduce(next,clone(c),revision);return retain(next);}
export function blockDoorOwnedEngine(h: DoorOwnedEngine,c: DoorCommand,revision: number): string|null {try{return commandBlock(getOwned(h),c,revision);}catch{return '当前记录或行动条件无效。';}}
