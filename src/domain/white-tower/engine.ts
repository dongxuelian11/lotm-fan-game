import type { SliceState } from '../slice/types.js';
import type { PublicCoreStatKey } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { addGameWeeks, addGameDays } from '../game-calendar.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance, resolveNormalCheck } from '../../resolution/normal-check.js';
import { createWhiteTowerSource, validateWhiteTowerSource, whiteTowerBudget, type WhiteTowerSource, type WhiteTowerBudget } from './source.js';
import { createWhiteTowerPassages, whiteTowerPassagesBlock, applyWhiteTowerPassages, validateWhiteTowerPassageCommand, whiteTowerPassageVerifiedReceipts, canLeaveWhiteTowerPassages } from './passages.js';
import { WHITE_TOWER_MATERIAL_POLICY, whiteTowerSuccessionAt } from './material-content.js';
import { createWhiteTowerMaterials, whiteTowerMaterialBlock, applyWhiteTowerMaterial, transportWhiteTowerMaterials, settleWhiteTowerConsumption, validateWhiteTowerMaterialCommand, whiteTowerPassageReceiptsComplete } from './materials.js';
import { WHITE_TOWER_CITY_PLACES, WHITE_TOWER_HOME, WHITE_TOWER_WORKSHOP, WHITE_TOWER_GUIDANCE, WHITE_TOWER_CONSUMPTION, WHITE_TOWER_PROMOTION_STABILITY, WHITE_TOWER_EPILOGUE_BONUS, WHITE_TOWER_SPIRITUALITY_CAP, WHITE_TOWER_GATE } from './content.js';
import { WHITE_TOWER_ABILITY_IDS, type WhiteTowerState, type WhiteTowerCommand, type WhiteTowerFrame, type WhiteTowerEvent, type WhiteTowerCheckReceipt, type WhiteTowerPromotionPreparation } from './types.js';
import { createWhiteTowerEpilogue, applyWhiteTowerEpilogue, whiteTowerEpilogueBlock, validateWhiteTowerEpilogueCommand } from './epilogue.js';
import type { WhiteTowerHost, WhiteTowerEffect } from './ports.js';
export const sameWhiteTower = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
export const whiteTowerDigest = (v: unknown): string => sha256Hex(stableStringify(v));
function need(v: unknown, reason: string): asserts v { if (!v) throw Error(reason); }
const clone = <T>(v: T): T => structuredClone(v);
const city = (id: string): boolean => WHITE_TOWER_CITY_PLACES.some(p => p.id === id);
function dataDigest(root: WhiteTowerState): string { const { journal: _journal, ...data } = root; return whiteTowerDigest(data); }
export function createWhiteTowerState(): WhiteTowerState { return { version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null, passages: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] } }; }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: object, keys: string[]): boolean => sameWhiteTower(Object.keys(v).sort(), keys.sort());
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 300 && v.trim() === v;
export function validateWhiteTowerCommand(v: unknown): v is WhiteTowerCommand {
 if (!record(v)) return false;
 if (['LEARN_GUIDANCE','WORK','REST','CLINIC','NEXT_WEEK','START_EPILOGUE','RETURN_ON_FOOT'].includes(String(v.type))) return exact(v,['type']);
 if (v.type === 'TRAVEL') return exact(v,['type','to']) && id(v.to) && city(v.to);
 if (v.type === 'STABILIZE_PROMOTION') return exact(v,['type','compoundId']) && id(v.compoundId);
 if (v.type === 'CONSUME') return exact(v,['type','compoundId','confirmed']) && id(v.compoundId) && v.confirmed === true;
 if (!exact(v,['type','command'])) return false;
 return v.type === 'PASSAGE' ? validateWhiteTowerPassageCommand(v.command) : v.type === 'MATERIAL' ? validateWhiteTowerMaterialCommand(v.command) : v.type === 'EPILOGUE' ? validateWhiteTowerEpilogueCommand(v.command) : false;
}
declare const whiteTowerOwnedEngineBrand: unique symbol;
export interface WhiteTowerOwnedEngine { readonly [whiteTowerOwnedEngineBrand]: true }
const owned = new WeakMap<WhiteTowerOwnedEngine, WhiteTowerState>();
function getOwned(h: WhiteTowerOwnedEngine): WhiteTowerState { const r = owned.get(h); need(r,'无效的当前领域会话。'); return r; }
function retain(root: WhiteTowerState): WhiteTowerOwnedEngine { const h = Object.freeze({}) as WhiteTowerOwnedEngine; owned.set(h, root); return h; }
function start(source: WhiteTowerSource): WhiteTowerState {
 const root = createWhiteTowerState(); root.guidanceKnown = true; root.source = clone(source);
 root.frame = { budget: clone(source.budget), finance: clone(source.finance), random: { ...source.random }, location: WHITE_TOWER_HOME, nowSecond: 36000, weekAnchor: 0 };
 pay(root.frame.budget, WHITE_TOWER_GUIDANCE);
 root.passages = createWhiteTowerPassages(source.runId,source.actorId,source.budget.week,root.frame.nowSecond);
 root.materials = createWhiteTowerMaterials({ ...clone(source.acquisition), actorId: source.actorId,
  sourceDigest: source.historyDigest, inheritanceLocation: WHITE_TOWER_HOME }, WHITE_TOWER_MATERIAL_POLICY, source.originals.wisdom);
 return root;
}
export function startWhiteTower(s: SliceState): WhiteTowerState { return start(createWhiteTowerSource(s)); }
export function whiteTowerHost(root: WhiteTowerState, eventId: string, revision: number, originalBottleId?: string): WhiteTowerHost {
 const f = root.frame!, b = f.budget, source = root.source!;
 const date = addGameDays(b.date, Math.floor((f.nowSecond - f.weekAnchor) / 86400));
 const site = root.materials!.legacySites.find(site => site.location === f.location && site.residualPresent && (!originalBottleId || site.originalBottleId === originalBottleId));
 const succession = ['UNVERIFIED','CUSTODIAN'].includes(root.materials!.uniqueness.holder) ? whiteTowerSuccessionAt(date) : null;
 return { eventId, revision, week: b.week, date, actorId: source.actorId, location: f.location,
  nowSecond: f.nowSecond, weekAnchor: f.weekAnchor, sourceDigest: source.historyDigest,
  passageReceipts: whiteTowerPassageVerifiedReceipts(root.passages!), sequence: b.sequence,
  status: b.status === 'ACTIVE' ? 'ACTIVE' : 'DEAD', cash: b.cash, actions: b.actions,
  health: b.health, mind: b.mind, spirituality: b.spirituality, check: null,
  legacyAccess: site ? clone(site) : null, succession };
}
function pay(b: WhiteTowerBudget, c: { actions?: number; cash?: number; spirituality?: number; mind?: number; health?: number; pollution?: number }): void {
 need(b.actions >= (c.actions ?? 0) && b.cash >= (c.cash ?? 0) && b.spirituality >= (c.spirituality ?? 0),'实际行动、费用或灵性不足。');
 b.actions -= c.actions ?? 0; b.cash -= c.cash ?? 0; b.spirituality -= c.spirituality ?? 0; b.health = Math.max(0,b.health-(c.health??0)); b.mind = Math.max(0,b.mind-(c.mind??0)); b.pollution = Math.min(100,b.pollution+(c.pollution??0));
 if (b.health === 0 || b.mind === 0 || b.pollution >= 100) { b.status = 'DEAD'; b.health = 0; }
}
function checks(f: WhiteTowerFrame, eventId: string) {
 const receipts: WhiteTowerCheckReceipt[] = [];
 const check = (ability: PublicCoreStatKey, difficulty: number, modifier = 0, source = '实际在场条件') => {
  const before = f.random.cursor, rng = new DeterministicActionRandomStream(f.random.seed,before);
  const result = resolveNormalCheck({ ability, baseAbility: f.budget.coreStats[ability], difficulty, modifiers: modifier ? [{source,value:modifier}] : [], roll: rng.nextInt(1,100) });
  f.random.cursor = rng.cursor; receipts.push({ kind: 'CHECK', id: `${eventId}:check:${receipts.length+1}`, check: result, cursorBefore: before, cursorAfter: rng.cursor }); return result;
 }; return { receipts, check };
}
/** Time advances once, against the chapter's fixed week anchor. Every crossed
 * real week bills the existing finance reducer; only WORK pays actual wages. */
function elapse(root: WhiteTowerState, seconds: number, revision: number, eventId: string, receipts: WhiteTowerEvent['financeReceipts']): void {
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
function effect(root: WhiteTowerState, e: WhiteTowerEffect, revision: number, eventId: string, receipts: WhiteTowerEvent['financeReceipts']): void {
 const f=root.frame!, from=f.location; pay(f.budget,{actions:e.actions,cash:e.cashCost,spirituality:e.spirituality,mind:e.mind,health:e.health}); f.budget.cash += e.cashGain;
 if (e.toLocation !== null) f.location=e.toLocation;
 if (from !== f.location) root.materials = transportWhiteTowerMaterials(root.materials!,from,f.location);
 elapse(root,e.seconds,revision,eventId,receipts);
}
function windowFor(root: WhiteTowerState) {
 const receipts = whiteTowerPassageVerifiedReceipts(root.passages!);
 return whiteTowerPassageReceiptsComplete(receipts, WHITE_TOWER_MATERIAL_POLICY, root.frame!.budget.week)
  ? { id: 'white-tower-three-original-residents-reviewed', receipts: receipts.flatMap(r => [r.passedEventId,r.reviewedEventId]) } : null;
}
function preparation(root: WhiteTowerState, compoundId: string): WhiteTowerPromotionPreparation|null {
 const f=root.frame!, p=root.materials!.compounds.find(c=>c.id===compoundId), w=windowFor(root);
 return root.promotionStability.preparations.find(x=>x.status==='READY'&&x.compoundId===compoundId&&x.actorId===root.source!.actorId&&x.sourceDigest===root.source!.historyDigest&&p?.status==='PREPARED'&&x.compoundDigest===whiteTowerDigest(p)&&x.location===f.location&&w&&x.windowId===w.id&&sameWhiteTower(x.receipts,w.receipts)&&f.nowSecond>=x.preparedSecond&&f.nowSecond<=x.expiresSecond)??null;
}
function consumeBlock(root: WhiteTowerState, compoundId: string, forPreparation=false): string|null {
 const f=root.frame!,b=f.budget,p=root.materials!.compounds.find(c=>c.id===compoundId);
 if(b.sequence!==1||root.promotionWeek!==null||b.acting!==100)return '须由已经完整消化的全知之眼本人服药。';
 if(b.week-root.source!.acquisition.promotionWeek<12)return '成为全知之眼尚未满12个实际周，仍可施工、工作与休养。';
 if(!windowFor(root))return '先让三处同一原居民真实通过，并在下一实际周分别回原处复核。';
 if(f.location!==WHITE_TOWER_WORKSHOP)return '本人和同一成药须真实抵达封闭调配室。';
 if(b.health<80||b.mind<(forPreparation?78:70)||b.injuries.length)return forPreparation?'先恢复到80健康、78精神并解除实际伤势，再准备。':'先恢复到80健康、70精神并解除实际伤势。';
 if(p?.status!=='PREPARED'||p.location!==f.location)return '同一瓶成药尚未实际备好并带到现场。';
 if(b.actions<WHITE_TOWER_CONSUMPTION.actions||b.spirituality<WHITE_TOWER_CONSUMPTION.spirituality)return '服药需要1行动与30灵性。';
 if(!forPreparation&&!preparation(root,compoundId))return '这条晋升路线须先为同一瓶完成实际付费稳定准备，准备不能过期或带离原室。';
 return null;
}
export function getWhiteTowerPromotionStabilityPreview(root: WhiteTowerState, compoundId: string) {
 const f=root.frame!,b=f.budget,prepared=!!preparation(root,compoundId),cost=WHITE_TOWER_PROMOTION_STABILITY;
 let reason=consumeBlock(root,compoundId,true);
 if(!reason&&prepared)reason='本瓶有效稳定准备已经完成。';
 if(!reason&&(b.cash<cost.cash||b.spirituality<cost.spirituality+WHITE_TOWER_CONSUMPTION.spirituality||b.mind<70+cost.mind))reason='准备须实付100便士、12灵性和8精神，并保留服药的30灵性与70精神。';
 const preparedChance=computeCheckChance({baseAbility:b.coreStats.will,difficulty:WHITE_TOWER_CONSUMPTION.difficulty,modifiers:[{source:'本瓶本次实际稳定准备',value:WHITE_TOWER_CONSUMPTION.bonus}]});
 return {eligible:reason===null,reason,prepared,cost,chance:preparedChance,preparedChance,window:windowFor(root)};
}
export function getWhiteTowerEpilogueCheckPreview(root: WhiteTowerState, kind: import('./epilogue.js').WhiteTowerEpilogueCommand['type']) {
 const insight = kind === 'STRUCTURAL_INSIGHT', weak = kind === 'BOUNDED_WEAK_POINT';
 if (!insight && !weak) return null;
 const ability = insight ? 'perception' as const : 'will' as const, difficulty = insight ? 47 : 48;
 return { ability, difficulty, effectiveBonus: WHITE_TOWER_EPILOGUE_BONUS,
  chance: computeCheckChance({ baseAbility: root.frame!.budget.coreStats[ability], difficulty,
   modifiers: [{source:'本人本次有限施术',value:WHITE_TOWER_EPILOGUE_BONUS}] }) };
}
function commandBlock(root: WhiteTowerState,c: WhiteTowerCommand,revision: number): string|null {
 if(!validateWhiteTowerCommand(c)||c.type==='LEARN_GUIDANCE')return '这项行动无效或已经听取指导。';
 const f=root.frame,b=f?.budget;
 if(!root.guidanceKnown||!root.source||!f||!b||b.status!=='ACTIVE')return '已经死亡或结束的角色不能继续行动。';
 if(revision!==root.source.revision+2+root.journal.length)return '本次实际动作次序无效。';
 // No journal-capacity gate may strand a living person or block ordinary life.
 if(root.epilogue?.status==='ACTIVE'&&c.type!=='EPILOGUE')return '先完成现场处置或沿普通侧路离场。';
 const h=whiteTowerHost(root,`R214:${root.source.runId}:${revision}`,revision,c.type==='MATERIAL'&&'bottleId' in c.command?c.command.bottleId:undefined);
 if(!canLeaveWhiteTowerPassages(root.passages!,f.location)&&c.type!=='PASSAGE')return '先停止同行、卸载未固定支撑并亲走回当前通路入口；不能借旅行或周结跳过实际返回。';
 if(c.type==='NEXT_WEEK')return null;
 if(c.type==='WORK')return f.finance.wagePaidWeek===b.week?'本周原职业工资已经结算。':b.actions<1?'工作需要一次行动。':null;
 if(c.type==='REST')return b.actions<1?'休养需要一次行动，可先走到下一实际周界。':null;
 if(c.type==='CLINIC')return !b.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null)?'没有尚未处置的重伤。':b.actions<1||b.cash<60?'普通处置需要1行动和60便士。':null;
 if(c.type==='TRAVEL')return c.to===f.location?'本人已在这处地点。':b.actions<1?'普通步行前往需1行动；可免费步行回街区接待处。':null;
 if(c.type==='RETURN_ON_FOOT')return f.location===WHITE_TOWER_HOME?'本人已在街区接待处。':null;
 if(c.type==='PASSAGE')return b.sequence!==1?'原通路通过与复核记录已封存，晋升后继续新机械闸现场。':whiteTowerPassagesBlock(root.passages!,c.command,h);
 if(c.type==='MATERIAL')return b.sequence!==1?'本人的晋升已经实际结束。':whiteTowerMaterialBlock(root.materials!,c.command,h,WHITE_TOWER_MATERIAL_POLICY);
 if(c.type==='STABILIZE_PROMOTION')return getWhiteTowerPromotionStabilityPreview(root,c.compoundId).reason;
 if(c.type==='CONSUME')return consumeBlock(root,c.compoundId);
 if(c.type==='START_EPILOGUE')return b.sequence!==0||root.promotionWeek===null||root.epilogue!==null?'须由实际晋升且尚未处理这宗事故的本人进入。':f.location!==WHITE_TOWER_GATE?'须先沿普通路步行到旧机械闸。':null;
 if(c.type==='EPILOGUE')return !root.epilogue||f.location!==root.epilogue.location?'须本人在同一街区返程现场。':whiteTowerEpilogueBlock(root.epilogue,c.command,h);
 return '当前没有这项行动。';
}
function reduce(root: WhiteTowerState,c: WhiteTowerCommand,revision: number): WhiteTowerEvent {
 const reason=commandBlock(root,c,revision); need(reason===null,reason??'当前无法行动。');
 const f=root.frame!,b=f.budget,eventId=`R214:${root.source!.runId}:${revision}`,before=clone(f),beforeDigest=dataDigest(root),random=checks(f,eventId),financeReceipts:WhiteTowerEvent['financeReceipts']=[],notes:string[]=[];
 const time=(seconds:number)=>elapse(root,seconds,revision,eventId,financeReceipts);
 if(c.type==='WORK'){pay(b,{actions:1});b.cash+=root.source!.character.weeklyWage;f.finance.wagePaidWeek=b.week;time(28800);notes.push(`本周原职业工资${root.source!.character.weeklyWage}便士实际入账，同周不能再次领取。`);}
 else if(c.type==='REST'){pay(b,{actions:1});const life=SLICE_LIFE[f.finance.lifeTier];b.health=Math.min(100,b.health+life.health);b.mind=Math.min(100,b.mind+life.mind);const cap=b.sequence===0?WHITE_TOWER_SPIRITUALITY_CAP:120;b.spirituality=Math.min(cap,b.spirituality+Math.round(cap*life.spirituality));b.pollution=Math.max(0,b.pollution-10);b.injuries=b.injuries.filter(i=>!(b.health>=80&&i.acquiredRevision<revision&&(i.severity==='LIGHT'||i.treatedRevision!==null&&i.treatedRevision<revision)));if(!b.injuries.length)b.injuryRisk=0;time(28800);notes.push('按实际生活档休养，未处置的重伤仍保留；原居民身体和精力没有得到补充。');}
 else if(c.type==='CLINIC'){pay(b,{actions:1,cash:60});for(const i of b.injuries)if(i.severity==='HEAVY'&&i.treatedRevision===null)i.treatedRevision=revision;time(3600);notes.push('实付60便士进行普通重伤处置，之后仍须实际休养至80健康。');}
 else if(c.type==='NEXT_WEEK'){b.actions=0;time(f.weekAnchor+604800-f.nowSecond);notes.push('走到下一实际周界，原生活费与约定还款照常结算；没有自动工资、免费修理或恢复。');}
 else if(c.type==='TRAVEL'||c.type==='RETURN_ON_FOOT'){const from=f.location;if(c.type==='TRAVEL')pay(b,{actions:1});f.location=c.type==='TRAVEL'?c.to:WHITE_TOWER_HOME;root.materials=transportWhiteTowerMaterials(root.materials!,from,f.location);time(c.type==='TRAVEL'?1800:7200);notes.push(c.type==='TRAVEL'?'本人和同一批随身原物沿普通道路实际步行半小时抵达；旧章原人原物没有随行。':'本人携同一批随身原物沿普通道路步行两小时返回街区接待处，无需行动或现款；旧费用、伤势与原物去向保留。');}
 else if(c.type==='PASSAGE'){
  const h=whiteTowerHost(root,eventId,revision);
  if(c.command.type==='BUILD')h.check=random.check('knowledge',44,30,'实际实勘、量测与同一通路施工准备');
  const result=applyWhiteTowerPassages(root.passages!,c.command,h);root.passages=result.state;
  effect(root,result.effect,revision,eventId,financeReceipts);
  for(const injury of result.injuries){b.injuries.push(clone(injury));b.injuryRisk+=injury.severity==='HEAVY'?2:1;}
  notes.push(...result.notes);
 }
 else if(c.type==='MATERIAL'){
  const result=applyWhiteTowerMaterial(root.materials!,c.command,whiteTowerHost(root,eventId,revision,'bottleId' in c.command?c.command.bottleId:undefined),WHITE_TOWER_MATERIAL_POLICY);
  root.materials=result.state;effect(root,{cashGain:0,spirituality:0,mind:0,health:0,toLocation:null,...result.effect},revision,eventId,financeReceipts);notes.push(...result.notes);
 } else if(c.type==='STABILIZE_PROMOTION'){const w=windowFor(root)!,compound=root.materials!.compounds.find(x=>x.id===c.compoundId)!;pay(b,WHITE_TOWER_PROMOTION_STABILITY);time(WHITE_TOWER_PROMOTION_STABILITY.seconds);root.promotionStability.preparations.push({id:`${eventId}:stability`,eventId,compoundId:compound.id,actorId:root.source!.actorId,sourceDigest:root.source!.historyDigest,compoundDigest:whiteTowerDigest(compound),location:f.location,week:b.week,windowId:w.id,startWeek:b.week,endWeek:b.week+1,preparedSecond:f.nowSecond,expiresSecond:f.nowSecond+WHITE_TOWER_PROMOTION_STABILITY.validSeconds,receipts:[...w.receipts],status:'READY',spentEventId:null,invalidatedEventId:null});notes.push('实付100便士、1行动、12灵性与8精神，完成同一本人、同一瓶、原调配室和三处原居民通过及隔周复核的稳定准备。实际七天内有效，离室、换瓶或服药即不能沿用。');}
 else if(c.type==='CONSUME'){
  const p=preparation(root,c.compoundId);need(p,'实际付费准备缺失。');const check=random.check('will',WHITE_TOWER_CONSUMPTION.difficulty,WHITE_TOWER_CONSUMPTION.bonus,'本瓶本次实际稳定准备'),success=['SUCCESS','GREAT_SUCCESS'].includes(check.tier),severe=check.tier==='GREAT_FAILURE';pay(b,{actions:WHITE_TOWER_CONSUMPTION.actions,spirituality:WHITE_TOWER_CONSUMPTION.spirituality});
  if(success){pay(b,{mind:WHITE_TOWER_CONSUMPTION.successMind});b.sequence=0;b.acting=0;root.promotionWeek=b.week;for(const ability of WHITE_TOWER_ABILITY_IDS)b.mastery[ability]=0;b.completedSources.push('WHITE_TOWER_ORIGINAL_SUCCESSION');}
  else{pay(b,{health:severe?WHITE_TOWER_CONSUMPTION.greatFailureHealth:WHITE_TOWER_CONSUMPTION.failureHealth,mind:severe?WHITE_TOWER_CONSUMPTION.greatFailureMind:WHITE_TOWER_CONSUMPTION.failureMind,pollution:severe?WHITE_TOWER_CONSUMPTION.greatFailurePollution:WHITE_TOWER_CONSUMPTION.failurePollution});b.injuries.push({id:`${eventId}:potion-injury`,severity:'HEAVY',acquiredRevision:revision,treatedRevision:null});b.injuryRisk+=2;}
  root.materials=settleWhiteTowerConsumption(root.materials!,{eventId,week:b.week,compoundId:c.compoundId,success,alive:b.status==='ACTIVE',location:f.location,residualPresent:b.status==='ACTIVE'});p.status='SPENT';p.spentEventId=eventId;time(3600);
  notes.push(success?'三份原特性与同一唯一性在同一本人体内融合。精神实扣12，两项新技巧从零掌握开始，旧身份、21项旧掌握、伤势和资源不补满。':'同一成药已实际耗尽，失败损伤、污染和重伤照常结算，没有不死保底。尚存活者可在原处免费封存后隔周付费回收；死亡者的三份原特性与唯一性留在现场。');
 }
 else if(c.type==='START_EPILOGUE'){
  root.epilogue=createWhiteTowerEpilogue(root.passages!,{week:b.week,nowSecond:f.nowSecond,actorId:root.source!.actorId});
  time(600);notes.push('本人来到旧机械闸的新事故现场；先实际问过居民、查看同一原闸和普通退路，不借旧人、旧物或未见方法。');
 }
 else if(c.type==='EPILOGUE'){
  const h=whiteTowerHost(root,eventId,revision),preview=getWhiteTowerEpilogueCheckPreview(root,c.command.type);
  if(preview)h.check=random.check(preview.ability,preview.difficulty,preview.effectiveBonus,'本人本次有限施术');
  const result=applyWhiteTowerEpilogue(root.epilogue!,c.command,h);root.epilogue=result.state;
  effect(root,result.effect,revision,eventId,financeReceipts);
  for(const [ability,gain] of Object.entries(result.masteryGains)) { need(WHITE_TOWER_ABILITY_IDS.some(id=>id===ability)&&Number.isSafeInteger(gain)&&gain>=0,'有限技巧的实际应用记录无效。'); b.mastery[ability]=(b.mastery[ability]??0)+gain; }
  for(const injury of result.injuries){b.injuries.push(clone(injury));b.injuryRisk+=injury.severity==='HEAVY'?2:1;}
  notes.push(...result.notes);
 }
 if(b.status!=='ACTIVE'){for(const item of [...root.materials!.characteristics,root.materials!.uniqueness])if(['EMBODIED','FUSED','PLAYER','COMPOUND'].includes(item.holder)){item.holder='LOST';item.location=f.location;}root.materials!.uniqueness.incumbentActorId=null;root.materials!.uniqueness.custodianActorId=null;}
 for(const p of root.promotionStability.preparations)if(p.status==='READY'&&preparation(root,p.compoundId)?.id!==p.id){p.status='INVALIDATED';p.invalidatedEventId=eventId;}
 const event:WhiteTowerEvent={id:eventId,revision,command:clone(c),before,after:clone(f),randomReceipts:clone(random.receipts),financeReceipts,notes,beforeDigest,afterDigest:dataDigest(root)};root.journal.push(event);return event;
}
/** Cold/raw entry strictly replays every new command once. Owned transitions
 * are private WeakMap-branded drafts and never reopen/replay their prefix. */
function reconstruct(s: SliceState): WhiteTowerState {
 const saved=s.whiteTower;need(saved?.source&&validateWhiteTowerSource(s,saved.source,'COLD_REOPEN'),'原身份、原人原物和三份特性历史未通过核验。');need(Array.isArray(saved.journal),'实际动作记录无效。');
 const root=start(clone(saved.source));for(const event of saved.journal){need(event&&event.revision===saved.source.revision+2+root.journal.length,'本章修订次序不一致。');const actual=reduce(root,clone(event.command),event.revision);need(sameWhiteTower(actual,event),'实际行动、检定、代价或来源与原记录不一致。');}need(sameWhiteTower(root,saved),'当前通路、原物和身体无法由实际行动重建。');
 const f=root.frame!,source=root.source!,{coreStats:_current,...identity}=s.character,{coreStats:_original,...originalIdentity}=source.character;
 need(s.progression.pathwayId==='white-tower'&&s.revision===source.revision+1+root.journal.length&&sameWhiteTower(whiteTowerBudget(s),f.budget)&&sameWhiteTower(s.random,f.random),'当前身体与实际动作终点不一致。');need(sameWhiteTower(identity,originalIdentity)&&Object.entries(f.finance).every(([key,value])=>sameWhiteTower(s[key as keyof SliceState],value)),'当前身份或生活账本不一致。');need(s.combatHistory.length===source.combatHistoryLength&&s.combat===null&&s.activeEvent===null&&s.eventQueue.length===0&&s.pulse==='NONE','旧现场或原战斗终点不一致。');return root;
}
export function validateWhiteTowerRoot(s: SliceState): void { reconstruct(s); }
export function transitionWhiteTower(s: SliceState,c: WhiteTowerCommand): WhiteTowerState {const root=reconstruct(s);reduce(root,clone(c),s.revision+1);return root;}
export function openWhiteTowerOwnedEngine(s: SliceState): WhiteTowerOwnedEngine { return retain(reconstruct(clone(s))); }
export function snapshotWhiteTowerOwnedEngine(h: WhiteTowerOwnedEngine): WhiteTowerState { return clone(getOwned(h)); }
export function advanceWhiteTowerOwnedEngine(h: WhiteTowerOwnedEngine,c: WhiteTowerCommand,revision: number): WhiteTowerOwnedEngine {const next=clone(getOwned(h));reduce(next,clone(c),revision);return retain(next);}
export function blockWhiteTowerOwnedEngine(h: WhiteTowerOwnedEngine,c: WhiteTowerCommand,revision: number): string|null {try{return commandBlock(getOwned(h),c,revision);}catch{return '当前记录或行动条件无效。';}}
