import type { SliceState } from '../slice/types.js';
import type { PublicCoreStatKey } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { addGameWeeks, addGameDays } from '../game-calendar.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance, resolveNormalCheck } from '../../resolution/normal-check.js';
import { createTwilightGiantSource, validateTwilightGiantSource, twilightGiantBudget, type TwilightGiantSource, type TwilightGiantBudget } from './source.js';
import { createTwilightWorksFromOrigin, twilightWorksBlock, applyTwilightWorks, validateTwilightWorksCommand, twilightWorksVerifiedPassages, twilightWorksPreparationFacts } from './works.js';
import { TWILIGHT_GIANT_MATERIAL_POLICY, twilightGiantSuccessionAt } from './material-content.js';
import { createTwilightGiantMaterials, twilightGiantMaterialBlock, applyTwilightGiantMaterial, transportTwilightGiantMaterials, settleTwilightGiantConsumption, validateTwilightGiantMaterialCommand } from './materials.js';
import { TWILIGHT_GIANT_CITY_PLACES, TWILIGHT_GIANT_HOME, TWILIGHT_GIANT_WORKSHOP, TWILIGHT_GIANT_GUIDANCE, TWILIGHT_GIANT_CONSUMPTION, TWILIGHT_GIANT_PROMOTION_STABILITY, TWILIGHT_GIANT_SPIRITUALITY_CAP, TWILIGHT_GIANT_BRIDGE } from './content.js';
import { TWILIGHT_GIANT_ABILITY_IDS, type TwilightGiantState, type TwilightGiantCommand, type TwilightGiantFrame, type TwilightGiantEvent, type TwilightGiantCheckReceipt, type TwilightGiantPromotionPreparation } from './types.js';
import { createTwilightEpilogue, applyTwilightEpilogue, twilightEpilogueBlock, validateTwilightEpilogueCommand, twilightEpilogueCheck, type TwilightEpilogueCommand } from './epilogue.js';
import type { TwilightGiantHost, TwilightGiantEffect } from './ports.js';
export const sameTwilightGiant = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
export const twilightGiantDigest = (v: unknown): string => sha256Hex(stableStringify(v));
function need(v: unknown, reason: string): asserts v { if (!v) throw Error(reason); }
const clone = <T>(v: T): T => structuredClone(v);
const city = (id: string): boolean => TWILIGHT_GIANT_CITY_PLACES.some(p => p.id === id);
function dataDigest(root: TwilightGiantState): string { const { journal: _journal, ...data } = root; return twilightGiantDigest(data); }
export function createTwilightGiantState(): TwilightGiantState { return { version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null, works: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] } }; }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: object, keys: string[]): boolean => sameTwilightGiant(Object.keys(v).sort(), keys.sort());
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 300 && v.trim() === v;
export function validateTwilightGiantCommand(v: unknown): v is TwilightGiantCommand {
 if (!record(v)) return false;
 if (['LEARN_GUIDANCE','WORK','REST','CLINIC','NEXT_WEEK','START_EPILOGUE','RETURN_ON_FOOT'].includes(String(v.type))) return exact(v,['type']);
 if (v.type === 'TRAVEL') return exact(v,['type','to']) && id(v.to) && city(v.to);
 if (v.type === 'STABILIZE_PROMOTION') return exact(v,['type','compoundId']) && id(v.compoundId);
 if (v.type === 'CONSUME') return exact(v,['type','compoundId','confirmed']) && id(v.compoundId) && v.confirmed === true;
 if (!exact(v,['type','command'])) return false;
 return v.type === 'WORKS' ? validateTwilightWorksCommand(v.command) : v.type === 'MATERIAL' ? validateTwilightGiantMaterialCommand(v.command) : v.type === 'EPILOGUE' ? validateTwilightEpilogueCommand(v.command) : false;
}
declare const twilightGiantOwnedEngineBrand: unique symbol;
export interface TwilightGiantOwnedEngine { readonly [twilightGiantOwnedEngineBrand]: true }
const owned = new WeakMap<TwilightGiantOwnedEngine, TwilightGiantState>();
function getOwned(h: TwilightGiantOwnedEngine): TwilightGiantState { const r = owned.get(h); need(r,'无效的当前领域会话。'); return r; }
function retain(root: TwilightGiantState): TwilightGiantOwnedEngine { const h = Object.freeze({}) as TwilightGiantOwnedEngine; owned.set(h, root); return h; }
function start(source: TwilightGiantSource): TwilightGiantState {
 const root = createTwilightGiantState(); root.guidanceKnown = true; root.source = clone(source);
 root.frame = { budget: clone(source.budget), finance: clone(source.finance), random: { ...source.random }, location: TWILIGHT_GIANT_HOME, nowSecond: Math.max(36000,source.originals.registry.site.clockSeconds), weekAnchor: 0 };
 pay(root.frame.budget, TWILIGHT_GIANT_GUIDANCE);
 root.works = createTwilightWorksFromOrigin({actorId:source.actorId,sourceDigest:source.historyDigest,week:source.budget.week,second:root.frame.nowSecond,revision:source.revision,site:clone(source.originals.registry.site)});
 root.materials = createTwilightGiantMaterials({ ...clone(source.acquisition), actorId: source.actorId,
  sourceDigest: source.historyDigest, inheritanceLocation: TWILIGHT_GIANT_HOME }, TWILIGHT_GIANT_MATERIAL_POLICY, source.originals.registry);
 return root;
}
export function startTwilightGiant(s: SliceState): TwilightGiantState { return start(createTwilightGiantSource(s)); }
export function twilightGiantHost(root: TwilightGiantState, eventId: string, revision: number, originalBottleId?: string): TwilightGiantHost {
 const f = root.frame!, b = f.budget, source = root.source!;
 const date = addGameDays(b.date, Math.floor((f.nowSecond - f.weekAnchor) / 86400));
 const site = root.materials!.legacySites.find(site => site.location === f.location && site.residualPresent && (!originalBottleId || site.originalBottleId === originalBottleId));
 const succession = ['UNVERIFIED','CUSTODIAN'].includes(root.materials!.uniqueness.holder) ? twilightGiantSuccessionAt(date) : null;
 return { eventId, revision, week: b.week, date, actorId: source.actorId, location: f.location,
  nowSecond: f.nowSecond, weekAnchor: f.weekAnchor, sourceDigest: source.historyDigest,
  preparationFacts: twilightWorksPreparationFacts(root.works!), sequence: b.sequence,
  status: b.status === 'ACTIVE' ? 'ACTIVE' : 'DEAD', cash: b.cash, actions: b.actions,
  health: b.health, mind: b.mind, spirituality: b.spirituality, coreStats: {...b.coreStats}, mastery: {...b.mastery}, check: null,
  legacyAccess: site ? clone(site) : null, succession };
}
function pay(b: TwilightGiantBudget, c: { actions?: number; cash?: number; spirituality?: number; mind?: number; health?: number; pollution?: number }): void {
 need(b.actions >= (c.actions ?? 0) && b.cash >= (c.cash ?? 0) && b.spirituality >= (c.spirituality ?? 0),'实际行动、费用或灵性不足。');
 b.actions -= c.actions ?? 0; b.cash -= c.cash ?? 0; b.spirituality -= c.spirituality ?? 0; b.health = Math.max(0,b.health-(c.health??0)); b.mind = Math.max(0,b.mind-(c.mind??0)); b.pollution = Math.min(100,b.pollution+(c.pollution??0));
 if (b.health === 0 || b.mind === 0 || b.pollution >= 100) { b.status = 'DEAD'; b.health = 0; }
}
function checks(f: TwilightGiantFrame, eventId: string) {
 const receipts: TwilightGiantCheckReceipt[] = [];
 const check = (ability: PublicCoreStatKey, difficulty: number, modifier = 0, source = '实际在场条件') => {
  const before = f.random.cursor, rng = new DeterministicActionRandomStream(f.random.seed,before);
  const result = resolveNormalCheck({ ability, baseAbility: f.budget.coreStats[ability], difficulty, modifiers: modifier ? [{source,value:modifier}] : [], roll: rng.nextInt(1,100) });
  f.random.cursor = rng.cursor; receipts.push({ kind: 'CHECK', id: `${eventId}:check:${receipts.length+1}`, check: result, cursorBefore: before, cursorAfter: rng.cursor }); return result;
 }; return { receipts, check };
}
/** Time advances once, against the chapter's fixed week anchor. Every crossed
 * real week bills the existing finance reducer; only WORK pays actual wages. */
function elapse(root: TwilightGiantState, seconds: number, revision: number, eventId: string, receipts: TwilightGiantEvent['financeReceipts']): void {
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
function effect(root: TwilightGiantState, e: TwilightGiantEffect, revision: number, eventId: string, receipts: TwilightGiantEvent['financeReceipts']): void {
 const f=root.frame!, from=f.location; pay(f.budget,{actions:e.actions,cash:e.cashCost,spirituality:e.spirituality,mind:e.mind,health:e.health}); f.budget.cash += e.cashGain;
 if (e.toLocation !== null) f.location=e.toLocation;
 if (from !== f.location) root.materials = transportTwilightGiantMaterials(root.materials!,from,f.location);
 elapse(root,e.seconds,revision,eventId,receipts);
}
/** Only actual private traversals plus physical safe exits authorize the bridge condition. */
function windowFor(root: TwilightGiantState) {
 const passages = twilightWorksVerifiedPassages(root.works!);
 if(passages.length!==2 || passages.some(p=>p.actorId!==root.source!.actorId||p.sourceDigest!==root.source!.historyDigest))return null;
 return {id:'twilight-giant-two-original-passages-reviewed',receipts:passages.flatMap(p=>[p.arrivedEventId,...p.segments.map(s=>s.eventId),p.safeExitEventId,p.reviewedEventId])};
}
export function twilightGiantInsideCase(root: TwilightGiantState): boolean {
 const scene=root.epilogue??root.works;
 return !!scene&&(scene.position!==-2||scene.workers.some(w=>w.position!==-2)||!!root.epilogue?.contact);
}
function preparation(root: TwilightGiantState, compoundId: string): TwilightGiantPromotionPreparation|null {
 const f=root.frame!, p=root.materials!.compounds.find(c=>c.id===compoundId), w=windowFor(root);
 return root.promotionStability.preparations.find(x=>x.status==='READY'&&x.compoundId===compoundId&&x.actorId===root.source!.actorId&&x.sourceDigest===root.source!.historyDigest&&p?.status==='PREPARED'&&x.compoundDigest===twilightGiantDigest(p)&&x.location===f.location&&w&&x.windowId===w.id&&sameTwilightGiant(x.receipts,w.receipts)&&f.nowSecond>=x.preparedSecond&&f.nowSecond<=x.expiresSecond)??null;
}
function consumeBlock(root: TwilightGiantState, compoundId: string, forPreparation=false): string|null {
 const f=root.frame!,b=f.budget,p=root.materials!.compounds.find(c=>c.id===compoundId);
 if(b.sequence!==1||root.promotionWeek!==null||b.acting!==100)return '须由已经完整消化的神明之手本人服药。';
 if(b.week-root.source!.acquisition.promotionWeek<12)return '成为神明之手尚未满12个实际周，仍可服务、工作与休养。';
 if(!windowFor(root))return '先完成两位成人的两段真实通行、实际安全退出与现场复核。';
 if(f.location!==TWILIGHT_GIANT_WORKSHOP)return '本人和同一成药须真实抵达封闭调配室。';
 if(b.health<80||b.mind<(forPreparation?78:70)||b.injuries.length)return forPreparation?'先恢复到80健康、78精神并解除实际伤势，再准备。':'先恢复到80健康、70精神并解除实际伤势。';
 if(p?.status!=='PREPARED'||p.location!==f.location)return '同一瓶成药尚未实际备好并带到现场。';
 if(b.actions<TWILIGHT_GIANT_CONSUMPTION.actions||b.spirituality<TWILIGHT_GIANT_CONSUMPTION.spirituality)return '服药需要1行动与30灵性。';
 return null;
}
export function getTwilightGiantPromotionStabilityPreview(root: TwilightGiantState, compoundId: string) {
 const f=root.frame!,b=f.budget,prepared=!!preparation(root,compoundId),cost=TWILIGHT_GIANT_PROMOTION_STABILITY;
 let reason=consumeBlock(root,compoundId,true);
 if(!reason&&prepared)reason='本瓶有效稳定准备已经完成。';
 if(!reason&&(b.cash<cost.cash||b.spirituality<cost.spirituality+TWILIGHT_GIANT_CONSUMPTION.spirituality||b.mind<70+cost.mind))reason='准备须实付150便士、12灵性和8精神，并保留服药的30灵性与70精神。';
 const preparedChance=computeCheckChance({baseAbility:b.coreStats.will,difficulty:TWILIGHT_GIANT_CONSUMPTION.difficulty,modifiers:[{source:'本瓶本次实际稳定准备',value:TWILIGHT_GIANT_CONSUMPTION.bonus}]});
 return {eligible:reason===null,reason,prepared,cost,chance:computeCheckChance({baseAbility:b.coreStats.will,difficulty:TWILIGHT_GIANT_CONSUMPTION.difficulty,modifiers:prepared?[{source:'本瓶本次实际稳定准备',value:TWILIGHT_GIANT_CONSUMPTION.bonus}]:[]}),preparedChance,window:windowFor(root)};
}
export function getTwilightGiantEpilogueCheckPreview(root: TwilightGiantState, command: TwilightEpilogueCommand) {
 if(!root.epilogue)return null;
 const input=twilightEpilogueCheck(root.epilogue,command,twilightGiantHost(root,'preview',root.source!.revision+2+root.journal.length));
 return input?{...input,chance:computeCheckChance(input)}:null;
}
function commandBlock(root: TwilightGiantState,c: TwilightGiantCommand,revision: number): string|null {
 if(!validateTwilightGiantCommand(c)||c.type==='LEARN_GUIDANCE')return '这项行动无效或已经听取指导。';
 const f=root.frame,b=f?.budget;
 if(!root.guidanceKnown||!root.source||!f||!b||b.status!=='ACTIVE')return '已经死亡或结束的角色不能继续行动。';
 if(revision!==root.source.revision+2+root.journal.length)return '本次实际动作次序无效。';
 // No journal-capacity gate may strand a living person or block ordinary life.
 if(twilightGiantInsideCase(root)&&c.type!==(root.epilogue?'EPILOGUE':'WORKS'))return '先逐人沿普通路安全退出，再工作、休养、旅行或跨周；不能跳过真实离场。';
 const h=twilightGiantHost(root,`R220:${root.source.runId}:${revision}`,revision,c.type==='MATERIAL'&&'bottleId' in c.command?c.command.bottleId:undefined);
 if(c.type==='NEXT_WEEK')return null;
 if(c.type==='WORK')return f.finance.wagePaidWeek===b.week?'本周原职业工资已经结算。':b.actions<1?'工作需要一次行动。':null;
 if(c.type==='REST')return b.actions<1?'休养需要一次行动，可先走到下一实际周界。':null;
 if(c.type==='CLINIC')return !b.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null)?'没有尚未处置的重伤。':b.actions<1||b.cash<60?'普通处置需要1行动和60便士。':null;
 if(c.type==='TRAVEL')return c.to===f.location?'本人已在这处地点。':b.actions<1?'普通步行前往需1行动；可免费步行回街区接待处。':null;
 if(c.type==='RETURN_ON_FOOT')return f.location===TWILIGHT_GIANT_HOME?'本人已在街区接待处。':null;
 if(c.type==='WORKS')return b.sequence!==1?'原通行记录已封存，晋升后在同一桥接续实际事故。':twilightWorksBlock(root.works!,c.command,h);
 if(c.type==='MATERIAL')return b.sequence!==1?'本人的晋升已经实际结束。':twilightGiantMaterialBlock(root.materials!,c.command,h,TWILIGHT_GIANT_MATERIAL_POLICY);
 if(c.type==='STABILIZE_PROMOTION')return getTwilightGiantPromotionStabilityPreview(root,c.compoundId).reason;
 if(c.type==='CONSUME')return consumeBlock(root,c.compoundId);
 if(c.type==='START_EPILOGUE')return b.sequence!==0||root.promotionWeek===null||root.epilogue!==null?'须由实际晋升且尚未处理这宗事故的本人进入。':f.location!==TWILIGHT_GIANT_BRIDGE?'须先沿普通路步行到原修护室短桥。':null;
 if(c.type==='EPILOGUE')return !root.epilogue||f.location!==root.epilogue.location?'须本人在同一原修护室现场。':twilightEpilogueBlock(root.epilogue,c.command,h);
 return '当前没有这项行动。';
}
function reduce(root: TwilightGiantState,c: TwilightGiantCommand,revision: number): TwilightGiantEvent {
 const reason=commandBlock(root,c,revision); need(reason===null,reason??'当前无法行动。');
 const f=root.frame!,b=f.budget,eventId=`R220:${root.source!.runId}:${revision}`,before=clone(f),beforeDigest=dataDigest(root),random=checks(f,eventId),financeReceipts:TwilightGiantEvent['financeReceipts']=[],notes:string[]=[];
 const time=(seconds:number)=>elapse(root,seconds,revision,eventId,financeReceipts);
 if(c.type==='WORK'){pay(b,{actions:1});b.cash+=root.source!.character.weeklyWage;f.finance.wagePaidWeek=b.week;time(28800);notes.push(`本周原职业工资${root.source!.character.weeklyWage}便士实际入账，同周不能再次领取。`);}
 else if(c.type==='REST'){pay(b,{actions:1});const life=SLICE_LIFE[f.finance.lifeTier];b.health=Math.min(100,b.health+life.health);b.mind=Math.min(100,b.mind+life.mind);const cap=b.sequence===0?TWILIGHT_GIANT_SPIRITUALITY_CAP:120;b.spirituality=Math.min(cap,b.spirituality+Math.round(cap*life.spirituality));b.pollution=Math.max(0,b.pollution-10);b.injuries=b.injuries.filter(i=>!(b.health>=80&&i.acquiredRevision<revision&&(i.severity==='LIGHT'||i.treatedRevision!==null&&i.treatedRevision<revision)));if(!b.injuries.length)b.injuryRisk=0;time(28800);notes.push('按实际生活档休养，未处置的重伤仍保留；原居民身体和精力没有得到补充。');}
 else if(c.type==='CLINIC'){pay(b,{actions:1,cash:60});for(const i of b.injuries)if(i.severity==='HEAVY'&&i.treatedRevision===null)i.treatedRevision=revision;time(3600);notes.push('实付60便士进行普通重伤处置，之后仍须实际休养至80健康。');}
 else if(c.type==='NEXT_WEEK'){b.actions=0;time(f.weekAnchor+604800-f.nowSecond);notes.push('走到下一实际周界，原生活费与约定还款照常结算；没有自动工资、免费修理或恢复。');}
 else if(c.type==='TRAVEL'||c.type==='RETURN_ON_FOOT'){const from=f.location;if(c.type==='TRAVEL')pay(b,{actions:1});f.location=c.type==='TRAVEL'?c.to:TWILIGHT_GIANT_HOME;root.materials=transportTwilightGiantMaterials(root.materials!,from,f.location);time(c.type==='TRAVEL'?1800:7200);notes.push(c.type==='TRAVEL'?'本人和同一批随身原物沿普通道路实际步行半小时抵达；旧章原人原物没有随行。':'本人携同一批随身原物沿普通道路步行两小时返回街区接待处，无需行动或现款；旧费用、伤势与原物去向保留。');}
 else if(c.type==='WORKS'){
  const h=twilightGiantHost(root,eventId,revision);
  const result=applyTwilightWorks(root.works!,c.command,h);root.works=result.state;
  effect(root,result.effect,revision,eventId,financeReceipts);
  notes.push(...result.notes);
 }
 else if(c.type==='MATERIAL'){
  const result=applyTwilightGiantMaterial(root.materials!,c.command,twilightGiantHost(root,eventId,revision,'bottleId' in c.command?c.command.bottleId:undefined),TWILIGHT_GIANT_MATERIAL_POLICY);
  root.materials=result.state;effect(root,{cashGain:0,spirituality:0,mind:0,health:0,toLocation:null,...result.effect},revision,eventId,financeReceipts);notes.push(...result.notes);
 } else if(c.type==='STABILIZE_PROMOTION'){const w=windowFor(root)!,compound=root.materials!.compounds.find(x=>x.id===c.compoundId)!;pay(b,TWILIGHT_GIANT_PROMOTION_STABILITY);time(TWILIGHT_GIANT_PROMOTION_STABILITY.seconds);root.promotionStability.preparations.push({id:`${eventId}:stability`,eventId,compoundId:compound.id,actorId:root.source!.actorId,sourceDigest:root.source!.historyDigest,compoundDigest:twilightGiantDigest(compound),location:f.location,week:b.week,windowId:w.id,startWeek:b.week,endWeek:b.week+1,preparedSecond:f.nowSecond,expiresSecond:f.nowSecond+TWILIGHT_GIANT_PROMOTION_STABILITY.validSeconds,receipts:[...w.receipts],status:'READY',spentEventId:null,invalidatedEventId:null});notes.push('实付150便士、1行动、12灵性与8精神，完成同一本人、同一瓶、原调配室和两份实际通行与退出核验的稳定准备。实际七天内有效，离室、换瓶或服药即不能沿用。');}
 else if(c.type==='CONSUME'){
  const p=preparation(root,c.compoundId);const check=random.check('will',TWILIGHT_GIANT_CONSUMPTION.difficulty,p?TWILIGHT_GIANT_CONSUMPTION.bonus:0,p?'本瓶本次实际稳定准备':'未做额外稳定准备'),success=['SUCCESS','GREAT_SUCCESS'].includes(check.tier),severe=check.tier==='GREAT_FAILURE';pay(b,{actions:TWILIGHT_GIANT_CONSUMPTION.actions,spirituality:TWILIGHT_GIANT_CONSUMPTION.spirituality});
  if(success){pay(b,{mind:TWILIGHT_GIANT_CONSUMPTION.successMind});b.sequence=0;b.acting=0;root.promotionWeek=b.week;for(const ability of TWILIGHT_GIANT_ABILITY_IDS)b.mastery[ability]=0;for(const key of ['physique','perception','will','knowledge'] as const)b.coreStats[key]=Math.min(500,b.coreStats[key]+1);b.completedSources.push('TWILIGHT_GIANT_ORIGINAL_SUCCESSION');}
  else{pay(b,{health:severe?TWILIGHT_GIANT_CONSUMPTION.greatFailureHealth:TWILIGHT_GIANT_CONSUMPTION.failureHealth,mind:severe?TWILIGHT_GIANT_CONSUMPTION.greatFailureMind:TWILIGHT_GIANT_CONSUMPTION.failureMind,pollution:severe?TWILIGHT_GIANT_CONSUMPTION.greatFailurePollution:TWILIGHT_GIANT_CONSUMPTION.failurePollution});b.injuries.push({id:`${eventId}:potion-injury`,severity:'HEAVY',acquiredRevision:revision,treatedRevision:null});b.injuryRisk+=2;}
  root.materials=settleTwilightGiantConsumption(root.materials!,{eventId,week:b.week,compoundId:c.compoundId,success,alive:b.status==='ACTIVE',location:f.location,residualPresent:true});if(p){p.status='SPENT';p.spentEventId=eventId;}time(3600);
  notes.push(success?'三份原特性与同一唯一性在同一本人体内融合。精神实扣12，两项新技巧从零掌握开始，旧身份、22项旧掌握、伤势和资源不补满。':'同一成药已实际耗尽，失败损伤、污染和重伤照常结算，没有不死保底。尚存活者可在原处免费封存后隔周付费回收；死亡者的三份原特性与唯一性留在现场。');
 }
 else if(c.type==='START_EPILOGUE'){
  root.epilogue=createTwilightEpilogue(root.works!,{week:b.week,nowSecond:f.nowSecond,actorId:root.source!.actorId});
  time(600);notes.push('本人回到同一原梁与原车，接续两位新成人的实际工作。再次询问本人、重新付工钱并亲自到场；已耗支撑、原梁磨损和旧身体精力不重置。');
 }
 else if(c.type==='EPILOGUE'){
  const h=twilightGiantHost(root,eventId,revision),preview=twilightEpilogueCheck(root.epilogue!,c.command,h);
  if(preview){const before=f.random.cursor,rng=new DeterministicActionRandomStream(f.random.seed,before);h.check=resolveNormalCheck({...preview,roll:rng.nextInt(1,100)});f.random.cursor=rng.cursor;random.receipts.push({kind:'CHECK',id:`${eventId}:check:1`,check:h.check,cursorBefore:before,cursorAfter:rng.cursor});}
  const result=applyTwilightEpilogue(root.epilogue!,c.command,h);root.epilogue=result.state;
  effect(root,result.effect,revision,eventId,financeReceipts);
  for(const [ability,gain] of Object.entries(result.masteryGains)) { need(TWILIGHT_GIANT_ABILITY_IDS.some(id=>id===ability)&&Number.isSafeInteger(gain)&&gain>=0,'有限技巧的实际应用记录无效。'); b.mastery[ability]=(b.mastery[ability]??0)+gain; }
  for(const injury of result.injuries){b.injuries.push(clone(injury));b.injuryRisk+=injury.severity==='HEAVY'?2:1;}
  notes.push(...result.notes);
 }
 if(b.status!=='ACTIVE'){
  // Death is terminal. Preserve the same three characteristics as actual residue.
  const compound=root.materials!.compounds.find(p=>p.status==='SUCCESS');
  if(compound){compound.status='DEATH_EXPOSED';compound.location=f.location;for(const item of [...root.materials!.characteristics,root.materials!.uniqueness])Object.assign(item,{holder:'EXPOSED',location:f.location,compoundId:compound.id});root.materials!.uniqueness.incumbentActorId=null;root.materials!.settlements.push({eventId,week:b.week,compoundId:compound.id,success:false,alive:false,location:f.location,residualPresent:true});}
 }
 for(const p of root.promotionStability.preparations)if(p.status==='READY'&&preparation(root,p.compoundId)?.id!==p.id){p.status='INVALIDATED';p.invalidatedEventId=eventId;}
 const event:TwilightGiantEvent={id:eventId,revision,command:clone(c),before,after:clone(f),randomReceipts:clone(random.receipts),financeReceipts,notes,beforeDigest,afterDigest:dataDigest(root)};root.journal.push(event);return event;
}
/** Cold/raw entry strictly replays every new command once. Owned transitions
 * are private WeakMap-branded drafts and never reopen/replay their prefix. */
function reconstruct(s: SliceState): TwilightGiantState {
 const saved=s.twilightGiant;need(saved?.source&&validateTwilightGiantSource(s,saved.source,'COLD_REOPEN'),'原身份、原人原物和三份特性历史未通过核验。');need(Array.isArray(saved.journal),'实际动作记录无效。');
 const root=start(clone(saved.source));for(const event of saved.journal){need(event&&event.revision===saved.source.revision+2+root.journal.length,'本章修订次序不一致。');const actual=reduce(root,clone(event.command),event.revision);need(sameTwilightGiant(actual,event),'实际行动、检定、代价或来源与原记录不一致。');}need(sameTwilightGiant(root,saved),'当前通路、原物和身体无法由实际行动重建。');
 const f=root.frame!,source=root.source!,{coreStats:_current,...identity}=s.character,{coreStats:_original,...originalIdentity}=source.character;
 need(s.progression.pathwayId==='warrior'&&s.revision===source.revision+1+root.journal.length&&sameTwilightGiant(twilightGiantBudget(s),f.budget)&&sameTwilightGiant(s.random,f.random),'当前身体与实际动作终点不一致。');need(sameTwilightGiant(identity,originalIdentity)&&Object.entries(f.finance).every(([key,value])=>sameTwilightGiant(s[key as keyof SliceState],value)),'当前身份或生活账本不一致。');need(s.combatHistory.length===source.combatHistoryLength&&s.combat===null&&s.activeEvent===null&&s.eventQueue.length===0&&s.pulse==='NONE','旧现场或原战斗终点不一致。');return root;
}
export function validateTwilightGiantRoot(s: SliceState): void { reconstruct(s); }
export function transitionTwilightGiant(s: SliceState,c: TwilightGiantCommand): TwilightGiantState {const root=reconstruct(s);reduce(root,clone(c),s.revision+1);return root;}
export function openTwilightGiantOwnedEngine(s: SliceState): TwilightGiantOwnedEngine { return retain(reconstruct(clone(s))); }
export function snapshotTwilightGiantOwnedEngine(h: TwilightGiantOwnedEngine): TwilightGiantState { return clone(getOwned(h)); }
export function advanceTwilightGiantOwnedEngine(h: TwilightGiantOwnedEngine,c: TwilightGiantCommand,revision: number): TwilightGiantOwnedEngine {const next=clone(getOwned(h));reduce(next,clone(c),revision);return retain(next);}
export function blockTwilightGiantOwnedEngine(h: TwilightGiantOwnedEngine,c: TwilightGiantCommand,revision: number): string|null {try{return commandBlock(getOwned(h),c,revision);}catch{return '当前记录或行动条件无效。';}}
