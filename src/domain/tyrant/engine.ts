import type { SliceState } from '../slice/types.js';
import type { PublicCoreStatKey } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { addGameWeeks, addGameDays } from '../game-calendar.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance, resolveNormalCheck } from '../../resolution/normal-check.js';
import { createTyrantSource, validateTyrantSource, tyrantBudget, type TyrantSource, type TyrantBudget } from './source.js';
import { createTyrantCoasts, applyTyrantCoast, tyrantCoastBlock, tyrantCoastNeedsCheck, validateTyrantCoastCommand, tyrantCoastEvidence, canLeaveTyrantCoasts, carriedTyrantParcel, loseTyrantCargo } from './coasts.js';
import { createTyrantChallenge, applyTyrantChallenge, tyrantChallengeBlock, validateTyrantChallengeCommand, tyrantChallengeReceipt, canLeaveTyrantChallenge } from './challenge.js';
import { TYRANT_MATERIAL_POLICY, tyrantSuccessionAt } from './material-content.js';
import { createTyrantMaterials, tyrantMaterialBlock, applyTyrantMaterial, transportTyrantMaterials, settleTyrantConsumption, validateTyrantMaterialCommand, tyrantRitualReceiptsComplete } from './materials.js';
import { TYRANT_CITY_PLACES, TYRANT_HOME, TYRANT_WORKSHOP, TYRANT_GUIDANCE, TYRANT_CONSUMPTION, TYRANT_PROMOTION_STABILITY, TYRANT_EPILOGUE_BONUS, TYRANT_SPIRITUALITY_CAP, TYRANT_RESCUE } from './content.js';
import { TYRANT_ABILITY_IDS, type TyrantState, type TyrantCommand, type TyrantFrame, type TyrantEvent, type TyrantCheckReceipt, type TyrantPromotionPreparation } from './types.js';
import { createTyrantEpilogue, applyTyrantEpilogue, tyrantEpilogueBlock, validateTyrantEpilogueCommand, tyrantEpilogueNeedsCheck } from './epilogue.js';
import type { TyrantHost, TyrantEffect } from './ports.js';
export const sameTyrant = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
export const tyrantDigest = (v: unknown): string => sha256Hex(stableStringify(v));
function need(v: unknown, reason: string): asserts v { if (!v) throw Error(reason); }
const clone = <T>(v: T): T => structuredClone(v);
const city = (id: string): boolean => TYRANT_CITY_PLACES.some(p => p.id === id);
function dataDigest(root: TyrantState): string { const { journal: _journal, ...data } = root; return tyrantDigest(data); }
export function createTyrantState(): TyrantState { return { version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null, coasts: null, challenge: null, materials: null, epilogue: null, seaVoyages: [], assembly: null, journal: [], promotionStability: { preparations: [] } }; }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: object, keys: string[]): boolean => sameTyrant(Object.keys(v).sort(), keys.sort());
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 300 && v.trim() === v;
export function validateTyrantCommand(v: unknown): v is TyrantCommand {
 if (!record(v)) return false;
 if (['LEARN_GUIDANCE','WORK','REST','CLINIC','NEXT_WEEK','START_EPILOGUE','RETURN_ON_FOOT'].includes(String(v.type))) return exact(v,['type']);
 if (v.type === 'TRAVEL') return exact(v,['type','to']) && id(v.to) && city(v.to);
 if (v.type === 'STABILIZE_PROMOTION') return exact(v,['type','compoundId']) && id(v.compoundId);
 if (v.type === 'CONSUME') return exact(v,['type','compoundId','confirmed']) && id(v.compoundId) && v.confirmed === true;
 if (!exact(v,['type','command'])) return false;
 return v.type === 'COAST' ? validateTyrantCoastCommand(v.command) : v.type === 'CHALLENGE' ? validateTyrantChallengeCommand(v.command) : v.type === 'MATERIAL' ? validateTyrantMaterialCommand(v.command) : v.type === 'EPILOGUE' ? validateTyrantEpilogueCommand(v.command) : false;
}
declare const tyrantOwnedEngineBrand: unique symbol;
export interface TyrantOwnedEngine { readonly [tyrantOwnedEngineBrand]: true }
const owned = new WeakMap<TyrantOwnedEngine, TyrantState>();
function getOwned(h: TyrantOwnedEngine): TyrantState { const r = owned.get(h); need(r,'无效的当前领域会话。'); return r; }
function retain(root: TyrantState): TyrantOwnedEngine { const h = Object.freeze({}) as TyrantOwnedEngine; owned.set(h, root); return h; }
function start(source: TyrantSource): TyrantState {
 const root = createTyrantState(); root.guidanceKnown = true; root.source = clone(source);
 root.frame = { budget: clone(source.budget), finance: clone(source.finance), random: { ...source.random }, location: TYRANT_HOME, nowSecond: 36000, weekAnchor: 0 };
 pay(root.frame.budget, TYRANT_GUIDANCE);
 root.coasts = createTyrantCoasts(source.runId,source.actorId,source.budget.week,root.frame.nowSecond);
 root.challenge = createTyrantChallenge(source.runId,source.actorId,source.budget.week,root.frame.nowSecond);
 root.assembly = { location: TYRANT_WORKSHOP, members: Array.from({length:12},(_,i)=>({memberId:`TYRANT0-NORTH-ORIGINAL-1:member:${i+1}`,cohortId:'TYRANT0-NORTH-ORIGINAL-1',memberNumber:i+1,position:12+(i%3)*12})) };
 root.materials = createTyrantMaterials({ ...clone(source.acquisition), actorId: source.actorId,
  sourceDigest: source.historyDigest, inheritanceLocation: TYRANT_HOME }, TYRANT_MATERIAL_POLICY, source.originals.cove);
 return root;
}
export function startTyrant(s: SliceState): TyrantState { return start(createTyrantSource(s)); }
export function tyrantHost(root: TyrantState, eventId: string, revision: number, originalBottleId?: string): TyrantHost {
 const f = root.frame!, b = f.budget, source = root.source!;
 const date = addGameDays(b.date, Math.floor((f.nowSecond - f.weekAnchor) / 86400));
 const site = root.materials!.legacySites.find(site => site.location === f.location && site.residualPresent && (!originalBottleId || site.originalBottleId === originalBottleId));
 const succession = ['UNVERIFIED','CUSTODIAN'].includes(root.materials!.uniqueness.holder) ? tyrantSuccessionAt(date) : null;
 return { eventId, revision, week: b.week, date, actorId: source.actorId, location: f.location,
  nowSecond: f.nowSecond, weekAnchor: f.weekAnchor, sourceDigest: source.historyDigest,
  ritualReceipts: tyrantRitualReceipts(root), seaVoyages: clone(root.seaVoyages), sequence: b.sequence,
  status: b.status === 'ACTIVE' ? 'ACTIVE' : 'DEAD', cash: b.cash, actions: b.actions,
  health: b.health, mind: b.mind, spirituality: b.spirituality, check: null,
  legacyAccess: site ? clone(site) : null, succession };
}
function pay(b: TyrantBudget, c: { actions?: number; cash?: number; spirituality?: number; mind?: number; health?: number; pollution?: number }): void {
 need(b.actions >= (c.actions ?? 0) && b.cash >= (c.cash ?? 0) && b.spirituality >= (c.spirituality ?? 0),'实际行动、费用或灵性不足。');
 b.actions -= c.actions ?? 0; b.cash -= c.cash ?? 0; b.spirituality -= c.spirituality ?? 0; b.health = Math.max(0,b.health-(c.health??0)); b.mind = Math.max(0,b.mind-(c.mind??0)); b.pollution = Math.min(100,b.pollution+(c.pollution??0));
 if (b.health === 0 || b.mind === 0 || b.pollution >= 100) { b.status = 'DEAD'; b.health = 0; }
}
function checks(f: TyrantFrame, eventId: string) {
 const receipts: TyrantCheckReceipt[] = [];
 const check = (ability: PublicCoreStatKey, difficulty: number, modifier = 0, source = '实际在场条件') => {
  const before = f.random.cursor, rng = new DeterministicActionRandomStream(f.random.seed,before);
  const result = resolveNormalCheck({ ability, baseAbility: f.budget.coreStats[ability], difficulty, modifiers: modifier ? [{source,value:modifier}] : [], roll: rng.nextInt(1,100) });
  f.random.cursor = rng.cursor; receipts.push({ kind: 'CHECK', id: `${eventId}:check:${receipts.length+1}`, check: result, cursorBefore: before, cursorAfter: rng.cursor }); return result;
 }; return { receipts, check };
}
/** Time advances once, against the chapter's fixed week anchor. Every crossed
 * real week bills the existing finance reducer; only WORK pays actual wages. */
function elapse(root: TyrantState, seconds: number, revision: number, eventId: string, receipts: TyrantEvent['financeReceipts']): void {
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
function effect(root: TyrantState, e: TyrantEffect, revision: number, eventId: string, receipts: TyrantEvent['financeReceipts']): void {
 const f=root.frame!, from=f.location; pay(f.budget,{actions:e.actions,cash:e.cashCost,spirituality:e.spirituality,mind:e.mind,health:e.health}); f.budget.cash += e.cashGain;
 if (e.toLocation !== null) f.location=e.toLocation;
 if (from !== f.location) root.materials = transportTyrantMaterials(root.materials!,from,f.location);
 elapse(root,e.seconds,revision,eventId,receipts);
}
/** Canonical gates are reconstructed from actual bounded modules, never accepted
 * from renderer reports or material certificates. */
export function tyrantCurrentGates(root: TyrantState) {
 const evidence=tyrantCoastEvidence(root.coasts!,root.frame!.budget.week), challenge=tyrantChallengeReceipt(root.challenge!);
 const north=root.coasts!.coasts.find(c=>c.id==='north')!;
 const local=evidence.groups.find(g=>g.id==='TYRANT0-NORTH-ORIGINAL-1');
 const ready=evidence.ready&&!!challenge&&!!local?.current&&local.fears&&local.obeys&&local.believes;
 const reviews=root.coasts!.coasts.filter(c=>c.review).map(c=>({coast:c.id,review:c.review!.eventId,expires:c.review!.expiresWeek}));
 return {ready,evidence,challenge,north,gateDigest:tyrantDigest({reviews,groups:evidence.groups.map(g=>({id:g.id,current:g.current,living:g.living,fears:g.fears,obeys:g.obeys,believes:g.believes})),challenge})};
}
function preparation(root: TyrantState, compoundId: string): TyrantPromotionPreparation|null {
 const f=root.frame!,p=root.materials!.compounds.find(c=>c.id===compoundId),g=tyrantCurrentGates(root);
 return root.promotionStability.preparations.find(x=>x.status==='READY'&&x.compoundId===compoundId&&x.actorId===root.source!.actorId&&x.sourceDigest===root.source!.historyDigest&&p?.status==='PREPARED'&&x.compoundDigest===tyrantDigest(p)&&x.location===f.location&&x.location===root.assembly!.location&&g.ready&&x.gateDigest===g.gateDigest&&f.nowSecond>=x.preparedSecond&&f.nowSecond<=x.expiresSecond&&x.attendees.length===12&&x.attendees.every(a=>a.witnessedFear&&a.obeyedAssembly&&a.chantedBelief&&root.assembly!.members.some(m=>m.memberId===a.memberId&&m.position===0&&m.memberNumber<=g.north.cohorts[0]!.living)))??null;
}
export function tyrantRitualReceipts(root: TyrantState): import('./material-types.js').TyrantRitualReceipt[] {
 const g=tyrantCurrentGates(root),actorId=root.source!.actorId,week=root.frame!.budget.week;
 if(!g.ready)return [];
 const out:import('./material-types.js').TyrantRitualReceipt[]=[
 {kind:'COASTS',eventId:`coasts:${g.gateDigest}`,week,actorId,conditionVersion:1},
 {kind:'CHALLENGE',eventId:g.challenge!.escapedEventId,week:g.challenge!.escapedWeek,actorId,conditionVersion:1}];
 const p=root.materials!.compounds.find(c=>c.status==='PREPARED'),prepared=p?preparation(root,p.id):null;
 if(prepared)out.push({kind:'ATMOSPHERE',eventId:prepared.atmosphereEventId,week:prepared.week,actorId,conditionVersion:1});
 return out;
}
function consumeBlock(root:TyrantState,compoundId:string,forPreparation=false):string|null {
 const f=root.frame!,b=f.budget,p=root.materials!.compounds.find(c=>c.id===compoundId);
 if(b.sequence!==1||root.promotionWeek!==null||b.acting!==100)return '须由已经完整消化的雷神本人服药。';
 if(b.week-root.source!.acquisition.promotionWeek<12)return '成为雷神尚未满12个实际周，可先继续工作与休养。';
 if(!tyrantCurrentGates(root).ready)return '须维持至少二十万同一在世居民当前恐惧、服从并信仰，北岸原居民仍在其中，并独自挑战另一真神后真实存活。';
 if(f.location!==TYRANT_WORKSHOP)return '须携同一成药实际抵达北岸公开集会调配场。';
 if(b.health<80||b.mind<(forPreparation?78:70)||b.injuries.length)return '须先恢复至少80健康、准备前78精神，并解除实际伤势。';
 if(p?.status!=='PREPARED'||p.location!==f.location)return '同一瓶成药尚未实际备好并带到现场。';
 if(b.actions<TYRANT_CONSUMPTION.actions||b.spirituality<TYRANT_CONSUMPTION.spirituality)return '实际服药资源不足。';
 if(!forPreparation&&(!preparation(root,compoundId)||!tyrantRitualReceiptsComplete(tyrantRitualReceipts(root),b.week,root.source!.actorId)))return '须先付费组织同一原居民真实到场的恐惧服从氛围；同瓶准备不能过期、离场或沿用失效人群。';
 return null;
}
export function getTyrantPromotionStabilityPreview(root:TyrantState,compoundId:string) {
 const b=root.frame!.budget,prepared=!!preparation(root,compoundId),cost=TYRANT_PROMOTION_STABILITY;
 let reason=consumeBlock(root,compoundId,true);
 if(!reason&&prepared)reason='本瓶当前有效付费准备已经完成。';
 if(!reason&&(b.actions<cost.actions||b.cash<cost.cash||b.spirituality<cost.spirituality+TYRANT_CONSUMPTION.spirituality||b.mind<70+cost.mind))reason='准备须实付150便士、1行动、10灵性和8精神，并保留70精神。';
 const preparedChance=computeCheckChance({baseAbility:b.coreStats.will,difficulty:TYRANT_CONSUMPTION.difficulty,modifiers:[{source:'本瓶本次实际集会与稳定准备',value:TYRANT_CONSUMPTION.bonus}]});
 return {eligible:reason===null,reason,prepared,cost,chance:preparedChance,preparedChance};
}
export function getTyrantEpilogueCheckPreview(root:TyrantState,kind:import('./epilogue.js').TyrantEpilogueCommand['type']) {
 if(kind!=='DIVERT_WATER'&&kind!=='RELEASE_ENERGY')return null;
 const ability='will' as const,difficulty=48;
 return {ability,difficulty,effectiveBonus:TYRANT_EPILOGUE_BONUS,chance:computeCheckChance({baseAbility:root.frame!.budget.coreStats.will,difficulty,modifiers:[{source:'本人本次有限施术',value:TYRANT_EPILOGUE_BONUS}]})};
}
const region=(location:string):string=>location==='TYRANT0-EAST'?'EAST':location==='TYRANT0-SOUTH'?'SOUTH':location==='TYRANT0-SUN-CHALLENGE'?'SUN':'NORTH';
export const tyrantSeaTravel=(from:string,to:string):boolean=>region(from)!==region(to);
function commandBlock(root: TyrantState,c: TyrantCommand,revision: number): string|null {
 if(!validateTyrantCommand(c)||c.type==='LEARN_GUIDANCE')return '这项行动无效或已经听取指导。';
 const f=root.frame,b=f?.budget;
 if(!root.guidanceKnown||!root.source||!f||!b||b.status!=='ACTIVE')return '已经死亡或结束的角色不能继续行动。';
 if(revision!==root.source.revision+2+root.journal.length)return '本次实际动作次序无效。';
 // No journal-capacity gate may strand a living person or block ordinary life.
 if(root.epilogue?.status==='ACTIVE'&&c.type!=='EPILOGUE')return '先完成现场处置或沿普通侧路离场。';
 const h=tyrantHost(root,`R215:${root.source.runId}:${revision}`,revision,c.type==='MATERIAL'&&'bottleId' in c.command?c.command.bottleId:undefined);
 if(!canLeaveTyrantChallenge(root.challenge!)&&c.type!=='CHALLENGE')return '先从真实敌对现场走到出口并成功脱离；不能以周结或旅行跳过追击。';
 if(!canLeaveTyrantCoasts(root.coasts!,f.location)&&c.type!=='COAST')return '须先沿原堤实际返港，不能以周结或旅行跳过返回。';
 if(c.type==='NEXT_WEEK')return null;
 if(c.type==='WORK')return f.finance.wagePaidWeek===b.week?'本周原职业工资已经结算。':b.actions<1?'工作需要一次行动。':null;
 if(c.type==='REST')return b.actions<1?'休养需要一次行动，可先走到下一实际周界。':null;
 if(c.type==='CLINIC')return !b.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null)?'没有尚未处置的重伤。':b.actions<1||b.cash<60?'普通处置需要1行动和60便士。':null;
 if(c.type==='TRAVEL')return c.to===f.location?'本人已在这处地点。':b.actions<1?'旅行需1行动。':tyrantSeaTravel(f.location,c.to)&&b.cash<60?'实际海程需60便士、1行动与一整周；可在当地实际工作筹款。':null;
 if(c.type==='RETURN_ON_FOOT')return f.location===TYRANT_HOME?'本人已在原港接待处。':region(f.location)!=='NORTH'?'海岸之间不能步行瞬移；须真实付费航行。':null;
 if(c.type==='COAST')return b.sequence!==1?'晋升前原海岸记录已经封存。':tyrantCoastBlock(root.coasts!,c.command,h);
 if(c.type==='CHALLENGE')return tyrantChallengeBlock(root.challenge!,c.command,h);
 if(c.type==='MATERIAL')return b.sequence!==1?'本人的晋升已经实际结束。':tyrantMaterialBlock(root.materials!,c.command,h,TYRANT_MATERIAL_POLICY);
 if(c.type==='STABILIZE_PROMOTION')return getTyrantPromotionStabilityPreview(root,c.compoundId).reason;
 if(c.type==='CONSUME')return consumeBlock(root,c.compoundId);
 if(c.type==='START_EPILOGUE')return b.sequence!==0||root.promotionWeek===null||root.epilogue!==null?'须由实际晋升且尚未处理这宗事故的本人进入。':f.location!==TYRANT_RESCUE?'须先沿普通路步行到有限海岸救援现场。':null;
 if(c.type==='EPILOGUE')return !root.epilogue||f.location!==root.epilogue.location?'须本人在同一海岸救援现场。':tyrantEpilogueBlock(root.epilogue,c.command,h);
 return '当前没有这项行动。';
}
function reduce(root: TyrantState,c: TyrantCommand,revision: number): TyrantEvent {
 const reason=commandBlock(root,c,revision); need(reason===null,reason??'当前无法行动。');
 const f=root.frame!,b=f.budget,eventId=`R215:${root.source!.runId}:${revision}`,before=clone(f),beforeDigest=dataDigest(root),random=checks(f,eventId),financeReceipts:TyrantEvent['financeReceipts']=[],notes:string[]=[];
 const time=(seconds:number)=>elapse(root,seconds,revision,eventId,financeReceipts);
 if(c.type==='WORK'){pay(b,{actions:1});b.cash+=root.source!.character.weeklyWage;f.finance.wagePaidWeek=b.week;time(28800);notes.push(`本周原职业工资${root.source!.character.weeklyWage}便士实际入账，同周不能再次领取。`);}
 else if(c.type==='REST'){pay(b,{actions:1});const life=SLICE_LIFE[f.finance.lifeTier];b.health=Math.min(100,b.health+life.health);b.mind=Math.min(100,b.mind+life.mind);const cap=b.sequence===0?TYRANT_SPIRITUALITY_CAP:120;b.spirituality=Math.min(cap,b.spirituality+Math.round(cap*life.spirituality));b.pollution=Math.max(0,b.pollution-10);b.injuries=b.injuries.filter(i=>!(b.health>=80&&i.acquiredRevision<revision&&(i.severity==='LIGHT'||i.treatedRevision!==null&&i.treatedRevision<revision)));if(!b.injuries.length)b.injuryRisk=0;time(28800);notes.push('按实际生活档休养，未处置的重伤仍保留；原居民身体和精力没有得到补充。');}
 else if(c.type==='CLINIC'){pay(b,{actions:1,cash:60});for(const i of b.injuries)if(i.severity==='HEAVY'&&i.treatedRevision===null)i.treatedRevision=revision;time(3600);notes.push('实付60便士进行普通重伤处置，之后仍须实际休养至80健康。');}
 else if(c.type==='NEXT_WEEK'){b.actions=0;time(f.weekAnchor+604800-f.nowSecond);notes.push('走到下一实际周界，原生活费与约定还款照常结算；没有自动工资、免费修理或恢复。');}
 else if(c.type==='TRAVEL'||c.type==='RETURN_ON_FOOT'){
  const from=f.location,to=c.type==='TRAVEL'?c.to:TYRANT_HOME,sea=tyrantSeaTravel(from,to),departWeek=b.week,departSecond=f.nowSecond,cargoId=carriedTyrantParcel(root.coasts!)?.id??null;
  if(c.type==='TRAVEL')pay(b,{actions:1,cash:sea?60:0});f.location=to;root.materials=transportTyrantMaterials(root.materials!,from,to);
  time(sea?604800:c.type==='TRAVEL'?1800:7200);
  if(sea)root.seaVoyages.push({eventId,from,to,departWeek,arriveWeek:b.week,departSecond,arriveSecond:f.nowSecond,cashCost:60,actions:1,cargoId});
  notes.push(sea?'实付60便士、1行动完成一整周海程；原生活费与旧债照常结算。同一随身粮包和原物真实随船移动，没有补货。':'本人携同一批随身原物沿同一北岸普通道路实际步行；原居民与旧人没有随行或重生。');
 }
 else if(c.type==='COAST'||c.type==='CHALLENGE'){
  const h=tyrantHost(root,eventId,revision);
  if(c.type==='COAST'&&tyrantCoastNeedsCheck(c.command))h.check=random.check('will',30,13,'本人本次真实护堤履约');
  if(c.type==='CHALLENGE')h.check=random.check('will',30,13,'本人本次独立应对真神攻击');
  const result=c.type==='COAST'?applyTyrantCoast(root.coasts!,c.command,h):applyTyrantChallenge(root.challenge!,c.command,h);
  if(c.type==='COAST')root.coasts=result.state as import('./coasts.js').TyrantCoastsState;else root.challenge=result.state as import('./challenge.js').TyrantChallengeState;
  effect(root,result.effect,revision,eventId,financeReceipts);
  for(const injury of result.injuries){b.injuries.push(clone(injury));b.injuryRisk+=injury.severity==='HEAVY'?2:1;}notes.push(...result.notes);
 }
 else if(c.type==='MATERIAL'){
  const result=applyTyrantMaterial(root.materials!,c.command,tyrantHost(root,eventId,revision,'bottleId' in c.command?c.command.bottleId:undefined),TYRANT_MATERIAL_POLICY);
  root.materials=result.state;effect(root,{cashGain:0,spirituality:0,mind:0,health:0,toLocation:null,...result.effect},revision,eventId,financeReceipts);notes.push(...result.notes);
 } else if(c.type==='STABILIZE_PROMOTION'){
  const compound=root.materials!.compounds.find(x=>x.id===c.compoundId)!,g=tyrantCurrentGates(root);
  const attendees=root.assembly!.members.map(m=>({memberId:m.memberId,fromMeters:m.position,toMeters:0 as const,walkedMeters:m.position,witnessedFear:true as const,obeyedAssembly:true as const,chantedBelief:true as const}));
  pay(b,TYRANT_PROMOTION_STABILITY);time(TYRANT_PROMOTION_STABILITY.seconds);
  for(const m of root.assembly!.members)m.position=0;
  root.promotionStability.preparations.push({id:`${eventId}:stability`,eventId,compoundId:compound.id,actorId:root.source!.actorId,sourceDigest:root.source!.historyDigest,compoundDigest:tyrantDigest(compound),location:f.location,week:b.week,gateDigest:g.gateDigest,preparedSecond:f.nowSecond,expiresSecond:f.nowSecond+TYRANT_PROMOTION_STABILITY.validSeconds,atmosphereEventId:`${eventId}:actual-assembly`,attendees,status:'READY',spentEventId:null,invalidatedEventId:null});
  notes.push('实付150便士、1行动、10灵性、8精神与600秒；北岸原人群中十二位本人从原12至36米位置实际步行到集会点，表现当前恐惧、服从召集并当场祈颂。原二十七万人仍留各岸，没有新增或传送人口。当前氛围与同一瓶准备绑定，离场、失效人群、过期或服药不能沿用。');
 }
 else if(c.type==='CONSUME'){
  const p=preparation(root,c.compoundId);need(p,'实际付费准备缺失。');const check=random.check('will',TYRANT_CONSUMPTION.difficulty,TYRANT_CONSUMPTION.bonus,'本瓶本次实际集会与稳定准备'),success=['SUCCESS','GREAT_SUCCESS'].includes(check.tier),severe=check.tier==='GREAT_FAILURE';pay(b,{actions:TYRANT_CONSUMPTION.actions,spirituality:TYRANT_CONSUMPTION.spirituality});
  if(success){pay(b,{mind:TYRANT_CONSUMPTION.successMind});b.sequence=0;b.acting=0;root.promotionWeek=b.week;for(const ability of TYRANT_ABILITY_IDS)b.mastery[ability]=0;b.completedSources.push('TYRANT_ORIGINAL_SUCCESSION');}
  else{pay(b,{health:severe?TYRANT_CONSUMPTION.greatFailureHealth:TYRANT_CONSUMPTION.failureHealth,mind:severe?TYRANT_CONSUMPTION.greatFailureMind:TYRANT_CONSUMPTION.failureMind,pollution:severe?TYRANT_CONSUMPTION.greatFailurePollution:TYRANT_CONSUMPTION.failurePollution});b.injuries.push({id:`${eventId}:potion-injury`,severity:'HEAVY',acquiredRevision:revision,treatedRevision:null});b.injuryRisk+=2;}
  root.materials=settleTyrantConsumption(root.materials!,{eventId,week:b.week,compoundId:c.compoundId,success,alive:b.status==='ACTIVE',location:f.location,residualPresent:b.status==='ACTIVE'});p.status='SPENT';p.spentEventId=eventId;time(600);
  notes.push(success?'三份原特性与同一唯一性在同一本人体内融合。精神实扣12，两项新技巧从零掌握开始，旧身份、24项旧掌握、伤势和资源不补满。':'同一成药已实际耗尽，失败损伤、污染和重伤照常结算，没有不死保底。尚存活者可在原处免费封存后隔周付费回收；死亡者的三份原特性与唯一性留在现场。');
 }
 else if(c.type==='START_EPILOGUE'){
  root.epilogue=createTyrantEpilogue(root.coasts!,{week:b.week,nowSecond:f.nowSecond,actorId:root.source!.actorId});
  time(600);notes.push('本人实际抵达新的有限海岸救援现场，旧居民与原海水没有搬来；须核实两位当前成年人、原水量和普通退路。');
 }
 else if(c.type==='EPILOGUE'){
  const h=tyrantHost(root,eventId,revision),preview=getTyrantEpilogueCheckPreview(root,c.command.type);
  if(preview)h.check=random.check(preview.ability,preview.difficulty,preview.effectiveBonus,'本人本次有限施术');
  const result=applyTyrantEpilogue(root.epilogue!,c.command,h);root.epilogue=result.state;
  effect(root,result.effect,revision,eventId,financeReceipts);
  for(const [ability,gain] of Object.entries(result.masteryGains)) { need(TYRANT_ABILITY_IDS.some(id=>id===ability)&&Number.isSafeInteger(gain)&&gain>=0,'有限技巧的实际应用记录无效。'); b.mastery[ability]=(b.mastery[ability]??0)+gain; }
  for(const injury of result.injuries){b.injuries.push(clone(injury));b.injuryRisk+=injury.severity==='HEAVY'?2:1;}
  notes.push(...result.notes);
 }
 if(b.status!=='ACTIVE'){root.coasts=loseTyrantCargo(root.coasts!,eventId,'DEATH');for(const item of [...root.materials!.characteristics,root.materials!.uniqueness])if(['EMBODIED','FUSED','PLAYER','COMPOUND'].includes(item.holder)){item.holder='UNAVAILABLE';item.location=f.location;}root.materials!.uniqueness.incumbentActorId=null;root.materials!.uniqueness.custodianActorId=null;}
 for(const p of root.promotionStability.preparations)if(p.status==='READY'&&preparation(root,p.compoundId)?.id!==p.id){p.status='INVALIDATED';p.invalidatedEventId=eventId;}
 const event:TyrantEvent={id:eventId,revision,command:clone(c),before,after:clone(f),randomReceipts:clone(random.receipts),financeReceipts,notes,beforeDigest,afterDigest:dataDigest(root)};root.journal.push(event);return event;
}
/** Cold/raw entry strictly replays every new command once. Owned transitions
 * are private WeakMap-branded drafts and never reopen/replay their prefix. */
function reconstruct(s: SliceState): TyrantState {
 const saved=s.tyrant;need(saved?.source&&validateTyrantSource(s,saved.source,'COLD_REOPEN'),'原身份、原人原物和三份特性历史未通过核验。');need(Array.isArray(saved.journal),'实际动作记录无效。');
 const root=start(clone(saved.source));for(const event of saved.journal){need(event&&event.revision===saved.source.revision+2+root.journal.length,'本章修订次序不一致。');const actual=reduce(root,clone(event.command),event.revision);need(sameTyrant(actual,event),'实际行动、检定、代价或来源与原记录不一致。');}need(sameTyrant(root,saved),'当前海岸、挑战、原物和身体无法由实际行动重建。');
 const f=root.frame!,source=root.source!,{coreStats:_current,...identity}=s.character,{coreStats:_original,...originalIdentity}=source.character;
 need(s.progression.pathwayId==='tyrant'&&s.revision===source.revision+1+root.journal.length&&sameTyrant(tyrantBudget(s),f.budget)&&sameTyrant(s.random,f.random),'当前身体与实际动作终点不一致。');need(sameTyrant(identity,originalIdentity)&&Object.entries(f.finance).every(([key,value])=>sameTyrant(s[key as keyof SliceState],value)),'当前身份或生活账本不一致。');need(s.combatHistory.length===source.combatHistoryLength&&s.combat===null&&s.activeEvent===null&&s.eventQueue.length===0&&s.pulse==='NONE','旧现场或原战斗终点不一致。');return root;
}
export function validateTyrantRoot(s: SliceState): void { reconstruct(s); }
export function transitionTyrant(s: SliceState,c: TyrantCommand): TyrantState {const root=reconstruct(s);reduce(root,clone(c),s.revision+1);return root;}
export function openTyrantOwnedEngine(s: SliceState): TyrantOwnedEngine { return retain(reconstruct(clone(s))); }
export function snapshotTyrantOwnedEngine(h: TyrantOwnedEngine): TyrantState { return clone(getOwned(h)); }
export function advanceTyrantOwnedEngine(h: TyrantOwnedEngine,c: TyrantCommand,revision: number): TyrantOwnedEngine {const next=clone(getOwned(h));reduce(next,clone(c),revision);return retain(next);}
export function blockTyrantOwnedEngine(h: TyrantOwnedEngine,c: TyrantCommand,revision: number): string|null {try{return commandBlock(getOwned(h),c,revision);}catch{return '当前记录或行动条件无效。';}}
