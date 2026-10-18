import type { SliceState } from '../slice/types.js';
import type { PublicCoreStatKey } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { addGameWeeks, addGameDays } from '../game-calendar.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance, resolveNormalCheck } from '../../resolution/normal-check.js';
import { createSunSource, validateSunSource, sunBudget, type SunSource, type SunBudget } from './source.js';
import { createSunServices, sunServicesBlock, applySunServices, validateSunServiceCommand, sunServiceVerifiedReceipts, canLeaveSunServices } from './services.js';
import { SUN_MATERIAL_POLICY, sunSuccessionAt } from './material-content.js';
import { createSunMaterials, sunMaterialBlock, applySunMaterial, transportSunMaterials, settleSunConsumption, validateSunMaterialCommand, sunServiceReceiptsComplete } from './materials.js';
import { SUN_CITY_PLACES, SUN_HOME, SUN_WORKSHOP, SUN_GUIDANCE, SUN_CONSUMPTION, SUN_PROMOTION_STABILITY, SUN_EPILOGUE_BONUS, SUN_SPIRITUALITY_CAP, SUN_GATE } from './content.js';
import { SUN_ABILITY_IDS, type SunState, type SunCommand, type SunFrame, type SunEvent, type SunCheckReceipt, type SunPromotionPreparation } from './types.js';
import { createSunEpilogue, applySunEpilogue, sunEpilogueBlock, validateSunEpilogueCommand } from './epilogue.js';
import type { SunHost, SunEffect } from './ports.js';
export const sameSun = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
export const sunDigest = (v: unknown): string => sha256Hex(stableStringify(v));
function need(v: unknown, reason: string): asserts v { if (!v) throw Error(reason); }
const clone = <T>(v: T): T => structuredClone(v);
const city = (id: string): boolean => SUN_CITY_PLACES.some(p => p.id === id);
function dataDigest(root: SunState): string { const { journal: _journal, ...data } = root; return sunDigest(data); }
export function createSunState(): SunState { return { version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null, services: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] } }; }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: object, keys: string[]): boolean => sameSun(Object.keys(v).sort(), keys.sort());
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 300 && v.trim() === v;
export function validateSunCommand(v: unknown): v is SunCommand {
 if (!record(v)) return false;
 if (['LEARN_GUIDANCE','WORK','REST','CLINIC','NEXT_WEEK','START_EPILOGUE','RETURN_ON_FOOT'].includes(String(v.type))) return exact(v,['type']);
 if (v.type === 'TRAVEL') return exact(v,['type','to']) && id(v.to) && city(v.to);
 if (v.type === 'STABILIZE_PROMOTION') return exact(v,['type','compoundId']) && id(v.compoundId);
 if (v.type === 'CONSUME') return exact(v,['type','compoundId','confirmed']) && id(v.compoundId) && v.confirmed === true;
 if (!exact(v,['type','command'])) return false;
 return v.type === 'SERVICE' ? validateSunServiceCommand(v.command) : v.type === 'MATERIAL' ? validateSunMaterialCommand(v.command) : v.type === 'EPILOGUE' ? validateSunEpilogueCommand(v.command) : false;
}
declare const sunOwnedEngineBrand: unique symbol;
export interface SunOwnedEngine { readonly [sunOwnedEngineBrand]: true }
const owned = new WeakMap<SunOwnedEngine, SunState>();
function getOwned(h: SunOwnedEngine): SunState { const r = owned.get(h); need(r,'无效的当前领域会话。'); return r; }
function retain(root: SunState): SunOwnedEngine { const h = Object.freeze({}) as SunOwnedEngine; owned.set(h, root); return h; }
function start(source: SunSource): SunState {
 const root = createSunState(); root.guidanceKnown = true; root.source = clone(source);
 root.frame = { budget: clone(source.budget), finance: clone(source.finance), random: { ...source.random }, location: SUN_HOME, nowSecond: 36000, weekAnchor: 0 };
 pay(root.frame.budget, SUN_GUIDANCE);
 root.services = createSunServices(source.runId,source.actorId,source.budget.week,root.frame.nowSecond);
 root.materials = createSunMaterials({ ...clone(source.acquisition), actorId: source.actorId,
  sourceDigest: source.historyDigest, inheritanceLocation: SUN_HOME }, SUN_MATERIAL_POLICY, source.originals.gallery);
 return root;
}
export function startSun(s: SliceState): SunState { return start(createSunSource(s)); }
export function sunHost(root: SunState, eventId: string, revision: number, originalBottleId?: string): SunHost {
 const f = root.frame!, b = f.budget, source = root.source!;
 const date = addGameDays(b.date, Math.floor((f.nowSecond - f.weekAnchor) / 86400));
 const site = root.materials!.legacySites.find(site => site.location === f.location && site.residualPresent && (!originalBottleId || site.originalBottleId === originalBottleId));
 const succession = ['UNVERIFIED','CUSTODIAN'].includes(root.materials!.uniqueness.holder) ? sunSuccessionAt(date) : null;
 return { eventId, revision, week: b.week, date, actorId: source.actorId, location: f.location,
  nowSecond: f.nowSecond, weekAnchor: f.weekAnchor, sourceDigest: source.historyDigest,
  serviceReceipts: sunServiceVerifiedReceipts(root.services!), sequence: b.sequence,
  status: b.status === 'ACTIVE' ? 'ACTIVE' : 'DEAD', cash: b.cash, actions: b.actions,
  health: b.health, mind: b.mind, spirituality: b.spirituality, check: null,
  legacyAccess: site ? clone(site) : null, succession };
}
function pay(b: SunBudget, c: { actions?: number; cash?: number; spirituality?: number; mind?: number; health?: number; pollution?: number }): void {
 need(b.actions >= (c.actions ?? 0) && b.cash >= (c.cash ?? 0) && b.spirituality >= (c.spirituality ?? 0),'实际行动、费用或灵性不足。');
 b.actions -= c.actions ?? 0; b.cash -= c.cash ?? 0; b.spirituality -= c.spirituality ?? 0; b.health = Math.max(0,b.health-(c.health??0)); b.mind = Math.max(0,b.mind-(c.mind??0)); b.pollution = Math.min(100,b.pollution+(c.pollution??0));
 if (b.health === 0 || b.mind === 0 || b.pollution >= 100) { b.status = 'DEAD'; b.health = 0; }
}
function checks(f: SunFrame, eventId: string) {
 const receipts: SunCheckReceipt[] = [];
 const check = (ability: PublicCoreStatKey, difficulty: number, modifier = 0, source = '实际在场条件') => {
  const before = f.random.cursor, rng = new DeterministicActionRandomStream(f.random.seed,before);
  const result = resolveNormalCheck({ ability, baseAbility: f.budget.coreStats[ability], difficulty, modifiers: modifier ? [{source,value:modifier}] : [], roll: rng.nextInt(1,100) });
  f.random.cursor = rng.cursor; receipts.push({ kind: 'CHECK', id: `${eventId}:check:${receipts.length+1}`, check: result, cursorBefore: before, cursorAfter: rng.cursor }); return result;
 }; return { receipts, check };
}
/** Time advances once, against the chapter's fixed week anchor. Every crossed
 * real week bills the existing finance reducer; only WORK pays actual wages. */
function elapse(root: SunState, seconds: number, revision: number, eventId: string, receipts: SunEvent['financeReceipts']): void {
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
function effect(root: SunState, e: SunEffect, revision: number, eventId: string, receipts: SunEvent['financeReceipts']): void {
 const f=root.frame!, from=f.location; pay(f.budget,{actions:e.actions,cash:e.cashCost,spirituality:e.spirituality,mind:e.mind,health:e.health}); f.budget.cash += e.cashGain;
 if (e.toLocation !== null) f.location=e.toLocation;
 if (from !== f.location) root.materials = transportSunMaterials(root.materials!,from,f.location);
 elapse(root,e.seconds,revision,eventId,receipts);
}
function windowFor(root: SunState) {
 const receipts = sunServiceVerifiedReceipts(root.services!);
 return sunServiceReceiptsComplete(receipts, SUN_MATERIAL_POLICY, root.frame!.budget.week)
  ? { id: 'sun-two-original-services-reviewed', receipts: receipts.flatMap(r => [r.passedEventId,r.reviewedEventId]) } : null;
}
function preparation(root: SunState, compoundId: string): SunPromotionPreparation|null {
 const f=root.frame!, p=root.materials!.compounds.find(c=>c.id===compoundId), w=windowFor(root);
 return root.promotionStability.preparations.find(x=>x.status==='READY'&&x.compoundId===compoundId&&x.actorId===root.source!.actorId&&x.sourceDigest===root.source!.historyDigest&&p?.status==='PREPARED'&&x.compoundDigest===sunDigest(p)&&x.location===f.location&&w&&x.windowId===w.id&&sameSun(x.receipts,w.receipts)&&f.nowSecond>=x.preparedSecond&&f.nowSecond<=x.expiresSecond)??null;
}
function consumeBlock(root: SunState, compoundId: string, forPreparation=false): string|null {
 const f=root.frame!,b=f.budget,p=root.materials!.compounds.find(c=>c.id===compoundId);
 if(b.sequence!==1||root.promotionWeek!==null||b.acting!==100)return '须由已经完整消化的纯白天使本人服药。';
 if(b.week-root.source!.acquisition.promotionWeek<12)return '成为纯白天使尚未满12个实际周，仍可服务、工作与休养。';
 if(!windowFor(root))return '先完成两件原居民的实际服务交接和现场核验。';
 if(f.location!==SUN_WORKSHOP)return '本人和同一成药须真实抵达封闭调配室。';
 if(b.health<80||b.mind<(forPreparation?78:70)||b.injuries.length)return forPreparation?'先恢复到80健康、78精神并解除实际伤势，再准备。':'先恢复到80健康、70精神并解除实际伤势。';
 if(p?.status!=='PREPARED'||p.location!==f.location)return '同一瓶成药尚未实际备好并带到现场。';
 if(b.actions<SUN_CONSUMPTION.actions||b.spirituality<SUN_CONSUMPTION.spirituality)return '服药需要1行动与30灵性。';
 if(!forPreparation&&!preparation(root,compoundId))return '这条晋升路线须先为同一瓶完成实际付费稳定准备，准备不能过期或带离原室。';
 return null;
}
export function getSunPromotionStabilityPreview(root: SunState, compoundId: string) {
 const f=root.frame!,b=f.budget,prepared=!!preparation(root,compoundId),cost=SUN_PROMOTION_STABILITY;
 let reason=consumeBlock(root,compoundId,true);
 if(!reason&&prepared)reason='本瓶有效稳定准备已经完成。';
 if(!reason&&(b.cash<cost.cash||b.spirituality<cost.spirituality+SUN_CONSUMPTION.spirituality||b.mind<70+cost.mind))reason='准备须实付100便士、12灵性和8精神，并保留服药的30灵性与70精神。';
 const preparedChance=computeCheckChance({baseAbility:b.coreStats.will,difficulty:SUN_CONSUMPTION.difficulty,modifiers:[{source:'本瓶本次实际稳定准备',value:SUN_CONSUMPTION.bonus}]});
 return {eligible:reason===null,reason,prepared,cost,chance:preparedChance,preparedChance,window:windowFor(root)};
}
export function getSunEpilogueCheckPreview(root: SunState, kind: import('./epilogue.js').SunEpilogueCommand['type']) {
 const insight = kind === 'DIRECTED_RADIANCE', weak = kind === 'RADIANCE_WARD';
 if (!insight && !weak) return null;
 const ability = insight ? 'will' as const : 'knowledge' as const, difficulty = insight ? 50 : 45;
 return { ability, difficulty, effectiveBonus: SUN_EPILOGUE_BONUS,
  chance: computeCheckChance({ baseAbility: root.frame!.budget.coreStats[ability], difficulty,
   modifiers: [{source:'本人本次有限施术',value:SUN_EPILOGUE_BONUS}] }) };
}
function commandBlock(root: SunState,c: SunCommand,revision: number): string|null {
 if(!validateSunCommand(c)||c.type==='LEARN_GUIDANCE')return '这项行动无效或已经听取指导。';
 const f=root.frame,b=f?.budget;
 if(!root.guidanceKnown||!root.source||!f||!b||b.status!=='ACTIVE')return '已经死亡或结束的角色不能继续行动。';
 if(revision!==root.source.revision+2+root.journal.length)return '本次实际动作次序无效。';
 // No journal-capacity gate may strand a living person or block ordinary life.
 if(root.epilogue?.status==='ACTIVE'&&c.type!=='EPILOGUE')return '先完成现场处置或沿普通侧路离场。';
 const h=sunHost(root,`R216:${root.source.runId}:${revision}`,revision,c.type==='MATERIAL'&&'bottleId' in c.command?c.command.bottleId:undefined);
 if(!canLeaveSunServices(root.services!,f.location)&&c.type!=='SERVICE')return '先实际停止本处作业并走回当前入口；不能借旅行或周结跳过普通收束。';
 if(c.type==='NEXT_WEEK')return null;
 if(c.type==='WORK')return f.finance.wagePaidWeek===b.week?'本周原职业工资已经结算。':b.actions<1?'工作需要一次行动。':null;
 if(c.type==='REST')return b.actions<1?'休养需要一次行动，可先走到下一实际周界。':null;
 if(c.type==='CLINIC')return !b.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null)?'没有尚未处置的重伤。':b.actions<1||b.cash<60?'普通处置需要1行动和60便士。':null;
 if(c.type==='TRAVEL')return c.to===f.location?'本人已在这处地点。':b.actions<1?'普通步行前往需1行动；可免费步行回街区接待处。':null;
 if(c.type==='RETURN_ON_FOOT')return f.location===SUN_HOME?'本人已在街区接待处。':null;
 if(c.type==='SERVICE')return b.sequence!==1?'原服务交接与核验记录已封存，晋升后继续洗衣房事故现场。':sunServicesBlock(root.services!,c.command,h);
 if(c.type==='MATERIAL')return b.sequence!==1?'本人的晋升已经实际结束。':sunMaterialBlock(root.materials!,c.command,h,SUN_MATERIAL_POLICY);
 if(c.type==='STABILIZE_PROMOTION')return getSunPromotionStabilityPreview(root,c.compoundId).reason;
 if(c.type==='CONSUME')return consumeBlock(root,c.compoundId);
 if(c.type==='START_EPILOGUE')return b.sequence!==0||root.promotionWeek===null||root.epilogue!==null?'须由实际晋升且尚未处理这宗事故的本人进入。':f.location!==SUN_GATE?'须先沿普通路步行到洗衣房泄压事故。':null;
 if(c.type==='EPILOGUE')return !root.epilogue||f.location!==root.epilogue.location?'须本人在同一洗衣房事故现场。':sunEpilogueBlock(root.epilogue,c.command,h);
 return '当前没有这项行动。';
}
function reduce(root: SunState,c: SunCommand,revision: number): SunEvent {
 const reason=commandBlock(root,c,revision); need(reason===null,reason??'当前无法行动。');
 const f=root.frame!,b=f.budget,eventId=`R216:${root.source!.runId}:${revision}`,before=clone(f),beforeDigest=dataDigest(root),random=checks(f,eventId),financeReceipts:SunEvent['financeReceipts']=[],notes:string[]=[];
 const time=(seconds:number)=>elapse(root,seconds,revision,eventId,financeReceipts);
 if(c.type==='WORK'){pay(b,{actions:1});b.cash+=root.source!.character.weeklyWage;f.finance.wagePaidWeek=b.week;time(28800);notes.push(`本周原职业工资${root.source!.character.weeklyWage}便士实际入账，同周不能再次领取。`);}
 else if(c.type==='REST'){pay(b,{actions:1});const life=SLICE_LIFE[f.finance.lifeTier];b.health=Math.min(100,b.health+life.health);b.mind=Math.min(100,b.mind+life.mind);const cap=b.sequence===0?SUN_SPIRITUALITY_CAP:120;b.spirituality=Math.min(cap,b.spirituality+Math.round(cap*life.spirituality));b.pollution=Math.max(0,b.pollution-10);b.injuries=b.injuries.filter(i=>!(b.health>=80&&i.acquiredRevision<revision&&(i.severity==='LIGHT'||i.treatedRevision!==null&&i.treatedRevision<revision)));if(!b.injuries.length)b.injuryRisk=0;time(28800);notes.push('按实际生活档休养，未处置的重伤仍保留；原居民身体和精力没有得到补充。');}
 else if(c.type==='CLINIC'){pay(b,{actions:1,cash:60});for(const i of b.injuries)if(i.severity==='HEAVY'&&i.treatedRevision===null)i.treatedRevision=revision;time(3600);notes.push('实付60便士进行普通重伤处置，之后仍须实际休养至80健康。');}
 else if(c.type==='NEXT_WEEK'){b.actions=0;time(f.weekAnchor+604800-f.nowSecond);notes.push('走到下一实际周界，原生活费与约定还款照常结算；没有自动工资、免费修理或恢复。');}
 else if(c.type==='TRAVEL'||c.type==='RETURN_ON_FOOT'){const from=f.location;if(c.type==='TRAVEL')pay(b,{actions:1});f.location=c.type==='TRAVEL'?c.to:SUN_HOME;root.materials=transportSunMaterials(root.materials!,from,f.location);time(c.type==='TRAVEL'?1800:7200);notes.push(c.type==='TRAVEL'?'本人和同一批随身原物沿普通道路实际步行半小时抵达；旧章原人原物没有随行。':'本人携同一批随身原物沿普通道路步行两小时返回街区接待处，无需行动或现款；旧费用、伤势与原物去向保留。');}
 else if(c.type==='SERVICE'){
  const h=sunHost(root,eventId,revision);
  const result=applySunServices(root.services!,c.command,h);root.services=result.state;
  effect(root,result.effect,revision,eventId,financeReceipts);
  for(const injury of result.injuries){b.injuries.push(clone(injury));b.injuryRisk+=injury.severity==='HEAVY'?2:1;}
  notes.push(...result.notes);
 }
 else if(c.type==='MATERIAL'){
  const result=applySunMaterial(root.materials!,c.command,sunHost(root,eventId,revision,'bottleId' in c.command?c.command.bottleId:undefined),SUN_MATERIAL_POLICY);
  root.materials=result.state;effect(root,{cashGain:0,spirituality:0,mind:0,health:0,toLocation:null,...result.effect},revision,eventId,financeReceipts);notes.push(...result.notes);
 } else if(c.type==='STABILIZE_PROMOTION'){const w=windowFor(root)!,compound=root.materials!.compounds.find(x=>x.id===c.compoundId)!;pay(b,SUN_PROMOTION_STABILITY);time(SUN_PROMOTION_STABILITY.seconds);root.promotionStability.preparations.push({id:`${eventId}:stability`,eventId,compoundId:compound.id,actorId:root.source!.actorId,sourceDigest:root.source!.historyDigest,compoundDigest:sunDigest(compound),location:f.location,week:b.week,windowId:w.id,startWeek:b.week,endWeek:b.week+1,preparedSecond:f.nowSecond,expiresSecond:f.nowSecond+SUN_PROMOTION_STABILITY.validSeconds,receipts:[...w.receipts],status:'READY',spentEventId:null,invalidatedEventId:null});notes.push('实付100便士、1行动、12灵性与8精神，完成同一本人、同一瓶、原调配室和两件居民服务交接及现场核验的稳定准备。实际七天内有效，离室、换瓶或服药即不能沿用。');}
 else if(c.type==='CONSUME'){
  const p=preparation(root,c.compoundId);need(p,'实际付费准备缺失。');const check=random.check('will',SUN_CONSUMPTION.difficulty,SUN_CONSUMPTION.bonus,'本瓶本次实际稳定准备'),success=['SUCCESS','GREAT_SUCCESS'].includes(check.tier),severe=check.tier==='GREAT_FAILURE';pay(b,{actions:SUN_CONSUMPTION.actions,spirituality:SUN_CONSUMPTION.spirituality});
  if(success){pay(b,{mind:SUN_CONSUMPTION.successMind});b.sequence=0;b.acting=0;root.promotionWeek=b.week;for(const ability of SUN_ABILITY_IDS)b.mastery[ability]=0;b.completedSources.push('SUN_ORIGINAL_SUCCESSION');}
  else{pay(b,{health:severe?SUN_CONSUMPTION.greatFailureHealth:SUN_CONSUMPTION.failureHealth,mind:severe?SUN_CONSUMPTION.greatFailureMind:SUN_CONSUMPTION.failureMind,pollution:severe?SUN_CONSUMPTION.greatFailurePollution:SUN_CONSUMPTION.failurePollution});b.injuries.push({id:`${eventId}:potion-injury`,severity:'HEAVY',acquiredRevision:revision,treatedRevision:null});b.injuryRisk+=2;}
  root.materials=settleSunConsumption(root.materials!,{eventId,week:b.week,compoundId:c.compoundId,success,alive:b.status==='ACTIVE',location:f.location,residualPresent:b.status==='ACTIVE'});p.status='SPENT';p.spentEventId=eventId;time(3600);
  notes.push(success?'三份原特性与同一唯一性在同一本人体内融合。精神实扣12，两项新技巧从零掌握开始，旧身份、22项旧掌握、伤势和资源不补满。':'同一成药已实际耗尽，失败损伤、污染和重伤照常结算，没有不死保底。尚存活者可在原处免费封存后隔周付费回收；死亡者的三份原特性与唯一性留在现场。');
 }
 else if(c.type==='START_EPILOGUE'){
  root.epilogue=createSunEpilogue(root.services!,{week:b.week,nowSecond:f.nowSecond,actorId:root.source!.actorId});
  time(600);notes.push('本人来到原洗衣房的泄压事故现场；先实际问过居民、查看同一原炉和普通退路，不搬来旧章人物或物件。');
 }
 else if(c.type==='EPILOGUE'){
  const h=sunHost(root,eventId,revision),preview=getSunEpilogueCheckPreview(root,c.command.type);
  if(preview)h.check=random.check(preview.ability,preview.difficulty,preview.effectiveBonus,'本人本次有限施术');
  const result=applySunEpilogue(root.epilogue!,c.command,h);root.epilogue=result.state;
  effect(root,result.effect,revision,eventId,financeReceipts);
  for(const [ability,gain] of Object.entries(result.masteryGains)) { need(SUN_ABILITY_IDS.some(id=>id===ability)&&Number.isSafeInteger(gain)&&gain>=0,'有限技巧的实际应用记录无效。'); b.mastery[ability]=(b.mastery[ability]??0)+gain; }
  for(const injury of result.injuries){b.injuries.push(clone(injury));b.injuryRisk+=injury.severity==='HEAVY'?2:1;}
  notes.push(...result.notes);
 }
 if(b.status!=='ACTIVE'){for(const item of [...root.materials!.characteristics,root.materials!.uniqueness])if(['EMBODIED','FUSED','PLAYER','COMPOUND'].includes(item.holder)){item.holder='LOST';item.location=f.location;}root.materials!.uniqueness.incumbentActorId=null;root.materials!.uniqueness.custodianActorId=null;}
 for(const p of root.promotionStability.preparations)if(p.status==='READY'&&preparation(root,p.compoundId)?.id!==p.id){p.status='INVALIDATED';p.invalidatedEventId=eventId;}
 const event:SunEvent={id:eventId,revision,command:clone(c),before,after:clone(f),randomReceipts:clone(random.receipts),financeReceipts,notes,beforeDigest,afterDigest:dataDigest(root)};root.journal.push(event);return event;
}
/** Cold/raw entry strictly replays every new command once. Owned transitions
 * are private WeakMap-branded drafts and never reopen/replay their prefix. */
function reconstruct(s: SliceState): SunState {
 const saved=s.sun;need(saved?.source&&validateSunSource(s,saved.source,'COLD_REOPEN'),'原身份、原人原物和三份特性历史未通过核验。');need(Array.isArray(saved.journal),'实际动作记录无效。');
 const root=start(clone(saved.source));for(const event of saved.journal){need(event&&event.revision===saved.source.revision+2+root.journal.length,'本章修订次序不一致。');const actual=reduce(root,clone(event.command),event.revision);need(sameSun(actual,event),'实际行动、检定、代价或来源与原记录不一致。');}need(sameSun(root,saved),'当前通路、原物和身体无法由实际行动重建。');
 const f=root.frame!,source=root.source!,{coreStats:_current,...identity}=s.character,{coreStats:_original,...originalIdentity}=source.character;
 need(s.progression.pathwayId==='sun'&&s.revision===source.revision+1+root.journal.length&&sameSun(sunBudget(s),f.budget)&&sameSun(s.random,f.random),'当前身体与实际动作终点不一致。');need(sameSun(identity,originalIdentity)&&Object.entries(f.finance).every(([key,value])=>sameSun(s[key as keyof SliceState],value)),'当前身份或生活账本不一致。');need(s.combatHistory.length===source.combatHistoryLength&&s.combat===null&&s.activeEvent===null&&s.eventQueue.length===0&&s.pulse==='NONE','旧现场或原战斗终点不一致。');return root;
}
export function validateSunRoot(s: SliceState): void { reconstruct(s); }
export function transitionSun(s: SliceState,c: SunCommand): SunState {const root=reconstruct(s);reduce(root,clone(c),s.revision+1);return root;}
export function openSunOwnedEngine(s: SliceState): SunOwnedEngine { return retain(reconstruct(clone(s))); }
export function snapshotSunOwnedEngine(h: SunOwnedEngine): SunState { return clone(getOwned(h)); }
export function advanceSunOwnedEngine(h: SunOwnedEngine,c: SunCommand,revision: number): SunOwnedEngine {const next=clone(getOwned(h));reduce(next,clone(c),revision);return retain(next);}
export function blockSunOwnedEngine(h: SunOwnedEngine,c: SunCommand,revision: number): string|null {try{return commandBlock(getOwned(h),c,revision);}catch{return '当前记录或行动条件无效。';}}
