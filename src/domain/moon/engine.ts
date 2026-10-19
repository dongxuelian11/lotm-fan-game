import type { SliceState } from '../slice/types.js';
import type { PublicCoreStatKey } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { addGameWeeks } from '../game-calendar.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance, resolveNormalCheck } from '../../resolution/normal-check.js';
import { createMoonSource, validateMoonSource, moonBudget, type MoonSource, type MoonBudget } from './source.js';
import { createMoonServices, moonServiceBlock, applyMoonService, validateMoonServiceCommand, moonVerifiedReceipts } from './services.js';
import { createMoonMaterials, moonMaterialBlock, applyMoonMaterial, transportMoonMaterials, settleMoonConsumption, validateMoonMaterialCommand } from './materials.js';
import { MOON_CITY_PLACES, MOON_HOME, MOON_WORKSHOP, MOON_GUIDANCE, MOON_CONSUMPTION, MOON_PROMOTION_STABILITY, MOON_EPILOGUE_BONUS, MOON_SPIRITUALITY_CAP } from './content.js';
import { MOON_ABILITY_IDS, type MoonState, type MoonCommand, type MoonFrame, type MoonEvent, type MoonCheckReceipt, type MoonPromotionPreparation } from './types.js';
import { createMoonEpilogue, applyMoonEpilogue, moonEpilogueBlock, validateMoonEpilogueCommand } from './epilogue.js';
import type { MoonHost, MoonEffect } from './ports.js';
export const sameMoon = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
export const moonDigest = (v: unknown): string => sha256Hex(stableStringify(v));
function need(v: unknown, reason: string): asserts v { if (!v) throw Error(reason); }
const clone = <T>(v: T): T => structuredClone(v);
const city = (id: string): boolean => MOON_CITY_PLACES.some(p => p.id === id);
function dataDigest(root: MoonState): string { const { journal: _journal, ...data } = root; return moonDigest(data); }
export function createMoonState(): MoonState { return { version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null, services: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] } }; }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: object, keys: string[]): boolean => sameMoon(Object.keys(v).sort(), keys.sort());
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 300 && v.trim() === v;
export function validateMoonCommand(v: unknown): v is MoonCommand {
 if (!record(v)) return false;
 if (['LEARN_GUIDANCE','WORK','REST','CLINIC','NEXT_WEEK','START_EPILOGUE','RETURN_ON_FOOT'].includes(String(v.type))) return exact(v,['type']);
 if (v.type === 'TRAVEL') return exact(v,['type','to']) && id(v.to) && city(v.to);
 if (v.type === 'STABILIZE_PROMOTION') return exact(v,['type','compoundId']) && id(v.compoundId);
 if (v.type === 'CONSUME') return exact(v,['type','compoundId','confirmed']) && id(v.compoundId) && v.confirmed === true;
 if (!exact(v,['type','command'])) return false;
 return v.type === 'SERVICE' ? validateMoonServiceCommand(v.command) : v.type === 'MATERIAL' ? validateMoonMaterialCommand(v.command) : v.type === 'EPILOGUE' ? validateMoonEpilogueCommand(v.command) : false;
}
declare const moonOwnedEngineBrand: unique symbol;
export interface MoonOwnedEngine { readonly [moonOwnedEngineBrand]: true }
const owned = new WeakMap<MoonOwnedEngine, MoonState>();
function getOwned(h: MoonOwnedEngine): MoonState { const r = owned.get(h); need(r,'无效的当前领域会话。'); return r; }
function retain(root: MoonState): MoonOwnedEngine { const h = Object.freeze({}) as MoonOwnedEngine; owned.set(h, root); return h; }
function start(source: MoonSource): MoonState {
 const root = createMoonState(); root.guidanceKnown = true; root.source = clone(source);
 root.frame = { budget: clone(source.budget), finance: clone(source.finance), random: { ...source.random }, location: MOON_HOME, nowSecond: 3600, weekAnchor: 0 };
 pay(root.frame.budget, MOON_GUIDANCE); root.services = createMoonServices(source.runId,source.budget.week);
 const consumption = source.acquisition.consumptions.find(e => e.command.type === 'CONSUME' && ['SUCCESS','GREAT_SUCCESS'].includes(e.check?.tier ?? ''));
 need(consumption,'本人原特性的实际成功服药记录缺失。');
 root.materials = createMoonMaterials({ actorId: source.actorId, sourceDigest: source.historyDigest, bottles: clone(source.acquisition.bottles), consumption: clone(consumption), inheritanceLocation: MOON_HOME, resupply: clone(source.acquisition.resupply), acquisitionJournal: clone(source.acquisition.acquisitionJournal) });
 return root;
}
export function startMoon(s: SliceState): MoonState { return start(createMoonSource(s)); }
export function moonHost(root: MoonState, eventId: string, revision: number): MoonHost {
 const f = root.frame!, b = f.budget;
 return { eventId, revision, week: b.week, actorId: root.source!.actorId, location: f.location, nowSecond: f.nowSecond, weekAnchor: f.weekAnchor, verifiedReceipts: moonVerifiedReceipts(root.services!), sequence: b.sequence, status: b.status === 'ACTIVE' ? 'ACTIVE' : 'DEAD', cash: b.cash, actions: b.actions, health: b.health, mind: b.mind, spirituality: b.spirituality, check: null };
}
function pay(b: MoonBudget, c: { actions?: number; cash?: number; spirituality?: number; mind?: number; health?: number; pollution?: number }): void {
 need(b.actions >= (c.actions ?? 0) && b.cash >= (c.cash ?? 0) && b.spirituality >= (c.spirituality ?? 0),'实际行动、费用或灵性不足。');
 b.actions -= c.actions ?? 0; b.cash -= c.cash ?? 0; b.spirituality -= c.spirituality ?? 0; b.health = Math.max(0,b.health-(c.health??0)); b.mind = Math.max(0,b.mind-(c.mind??0)); b.pollution = Math.min(100,b.pollution+(c.pollution??0));
 if (b.health === 0 || b.mind === 0 || b.pollution >= 100) { b.status = 'DEAD'; b.health = 0; }
}
function checks(f: MoonFrame, eventId: string) {
 const receipts: MoonCheckReceipt[] = [];
 const check = (ability: PublicCoreStatKey, difficulty: number, modifier = 0, source = '实际在场条件') => {
  const before = f.random.cursor, rng = new DeterministicActionRandomStream(f.random.seed,before);
  const result = resolveNormalCheck({ ability, baseAbility: f.budget.coreStats[ability], difficulty, modifiers: modifier ? [{source,value:modifier}] : [], roll: rng.nextInt(1,100) });
  f.random.cursor = rng.cursor; receipts.push({ kind: 'CHECK', id: `${eventId}:check:${receipts.length+1}`, check: result, cursorBefore: before, cursorAfter: rng.cursor }); return result;
 }; return { receipts, check };
}
/** Time advances once, against the chapter's fixed week anchor. Every crossed
 * real week bills the existing finance reducer; only WORK pays actual wages. */
function elapse(root: MoonState, seconds: number, revision: number, eventId: string, receipts: MoonEvent['financeReceipts']): void {
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
function effect(root: MoonState, e: MoonEffect, revision: number, eventId: string, receipts: MoonEvent['financeReceipts']): void {
 const f=root.frame!, from=f.location; pay(f.budget,{actions:e.actions,cash:e.cashCost,spirituality:e.spirituality,mind:e.mind,health:e.health}); f.budget.cash += e.cashGain;
 if (e.toLocation !== null) f.location=e.toLocation;
 if (from !== f.location) root.materials = transportMoonMaterials(root.materials!,from,f.location);
 elapse(root,e.seconds,revision,eventId,receipts);
}
function windowFor(root: MoonState) { const receipts=moonVerifiedReceipts(root.services!); return receipts.length===6 ? { id:'moon-three-real-night-arrivals',receipts } : null; }
function preparation(root: MoonState, compoundId: string): MoonPromotionPreparation|null {
 const f=root.frame!, p=root.materials!.compounds.find(c=>c.id===compoundId), w=windowFor(root);
 return root.promotionStability.preparations.find(x=>x.status==='READY'&&x.compoundId===compoundId&&x.actorId===root.source!.actorId&&x.sourceDigest===root.source!.historyDigest&&p?.status==='PREPARED'&&x.compoundDigest===moonDigest(p)&&x.location===f.location&&w&&x.windowId===w.id&&sameMoon(x.receipts,w.receipts)&&f.nowSecond>=x.preparedSecond&&f.nowSecond<=x.expiresSecond)??null;
}
function consumeBlock(root: MoonState, compoundId: string, forPreparation=false): string|null {
 const f=root.frame!,b=f.budget,p=root.materials!.compounds.find(c=>c.id===compoundId);
 if(b.sequence!==1||root.promotionWeek!==null||b.acting!==100)return '须由已经完整消化的美神本人服药。';
 if(!windowFor(root))return '先亲自完成三站六名原乘客的真实夜航到达与核验。';
 if(f.location!==MOON_WORKSHOP)return '本人和同一成药须真实抵达封闭调配室。';
 if(b.health<80||b.mind<(forPreparation?78:70)||b.injuries.length)return forPreparation?'先恢复到80健康、78精神并解除实际伤势，再准备。':'先恢复到80健康、70精神并解除实际伤势。';
 if(p?.status!=='PREPARED'||p.location!==f.location)return '同一瓶成药尚未实际备好并带到现场。';
 if(b.actions<1||b.spirituality<30)return '服药需要1行动与30灵性。';
 if(!forPreparation&&!preparation(root,compoundId))return '这条晋升路线须先为同一瓶完成实际付费稳定准备，准备不能过期或带离原室。';
 return null;
}
export function getMoonPromotionStabilityPreview(root: MoonState, compoundId: string) {
 const f=root.frame!,b=f.budget,prepared=!!preparation(root,compoundId),cost=MOON_PROMOTION_STABILITY;
 let reason=consumeBlock(root,compoundId,true);
 if(!reason&&prepared)reason='本瓶有效稳定准备已经完成。';
 if(!reason&&(b.cash<100||b.spirituality<42||b.mind<78))reason='准备须实付100便士、12灵性和8精神，并保留服药的30灵性与70精神。';
 const preparedChance=computeCheckChance({baseAbility:b.coreStats.will,difficulty:58,modifiers:[{source:'本瓶本次实际稳定准备',value:40}]});
 return {eligible:reason===null,reason,prepared,cost,chance:preparedChance,preparedChance,window:windowFor(root)};
}
export function getMoonEpilogueCheckPreview(root: MoonState, kind: import('./epilogue.js').MoonEpilogueCommand['type']) {
 if(kind!=='MOONLIT_CHANNEL'&&kind!=='GENTLE_CROSSING')return null;
 return {ability:'will' as const,difficulty:45,effectiveBonus:MOON_EPILOGUE_BONUS,chance:computeCheckChance({baseAbility:root.frame!.budget.coreStats.will,difficulty:45,modifiers:[{source:'本人本次有限施术',value:MOON_EPILOGUE_BONUS}]})};
}
function commandBlock(root: MoonState,c: MoonCommand,revision: number): string|null {
 if(!validateMoonCommand(c)||c.type==='LEARN_GUIDANCE')return '这项行动无效或已经听取指导。';
 const f=root.frame,b=f?.budget;
 if(!root.guidanceKnown||!root.source||!f||!b||b.status!=='ACTIVE')return '已经死亡或结束的角色不能继续行动。';
 if(revision!==root.source.revision+2+root.journal.length)return '本次实际动作次序无效。';
 // No journal-capacity gate may strand a living person or block ordinary life.
 if(root.epilogue?.status==='ACTIVE'&&c.type!=='EPILOGUE')return '先完成现场处置或沿普通堤路离场。';
 const h=moonHost(root,`R212:${root.source.runId}:${revision}`,revision);
 if(c.type==='NEXT_WEEK')return null;
 if(c.type==='WORK')return f.finance.wagePaidWeek===b.week?'本周原职业工资已经结算。':b.actions<1?'工作需要一次行动。':null;
 if(c.type==='REST')return b.actions<1?'休养需要一次行动，可先走到下一实际周界。':null;
 if(c.type==='CLINIC')return !b.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null)?'没有尚未处置的重伤。':b.actions<1||b.cash<60?'普通处置需要1行动和60便士。':null;
 if(c.type==='TRAVEL')return c.to===f.location?'本人已在这处地点。':b.actions<1||b.cash<2?'普通交通需要1行动与2便士；可免费步行回岸边事务所。':null;
 if(c.type==='RETURN_ON_FOOT')return f.location===MOON_HOME?'本人已在岸边事务所。':null;
 if(c.type==='SERVICE')return b.sequence!==1?'三站夜航完成记录已封存，晋升后不再重复取得资格。':moonServiceBlock(root.services!,c.command,h);
 if(c.type==='MATERIAL')return b.sequence!==1?'本人的晋升已经实际结束。':moonMaterialBlock(root.materials!,c.command,h);
 if(c.type==='STABILIZE_PROMOTION')return getMoonPromotionStabilityPreview(root,c.compoundId).reason;
 if(c.type==='CONSUME')return consumeBlock(root,c.compoundId);
 if(c.type==='START_EPILOGUE')return b.sequence!==0||root.promotionWeek===null||root.epilogue!==null?'须由实际晋升且尚未处理这宗事故的本人进入。':f.location!==root.services!.stations.find(st=>st.id==='EAST')!.location?'须先亲自回到东岸小栈。':null;
 if(c.type==='EPILOGUE')return !root.epilogue||f.location!==root.epilogue.location?'须本人在这宗原渡口现场。':moonEpilogueBlock(root.epilogue,c.command,b,root.services!,f.nowSecond);
 return '当前没有这项行动。';
}
function reduce(root: MoonState,c: MoonCommand,revision: number): MoonEvent {
 const reason=commandBlock(root,c,revision); need(reason===null,reason??'当前无法行动。');
 const f=root.frame!,b=f.budget,eventId=`R212:${root.source!.runId}:${revision}`,before=clone(f),beforeDigest=dataDigest(root),random=checks(f,eventId),financeReceipts:MoonEvent['financeReceipts']=[],notes:string[]=[];
 const time=(seconds:number)=>elapse(root,seconds,revision,eventId,financeReceipts);
 if(c.type==='WORK'){pay(b,{actions:1});b.cash+=root.source!.character.weeklyWage;f.finance.wagePaidWeek=b.week;time(28800);notes.push(`本周原职业工资${root.source!.character.weeklyWage}便士实际入账，同周不能再次领取。`);}
 else if(c.type==='REST'){pay(b,{actions:1});const life=SLICE_LIFE[f.finance.lifeTier];b.health=Math.min(100,b.health+life.health);b.mind=Math.min(100,b.mind+life.mind);const cap=b.sequence===0?MOON_SPIRITUALITY_CAP:120;b.spirituality=Math.min(cap,b.spirituality+Math.round(cap*life.spirituality));b.pollution=Math.max(0,b.pollution-10);b.injuries=b.injuries.filter(i=>!(b.health>=80&&i.acquiredRevision<revision&&(i.severity==='LIGHT'||i.treatedRevision!==null&&i.treatedRevision<revision)));if(!b.injuries.length)b.injuryRisk=0;time(28800);notes.push('按实际生活档休养，未处置的重伤仍保留；原来客身体和精力没有得到补充。');}
 else if(c.type==='CLINIC'){pay(b,{actions:1,cash:60});for(const i of b.injuries)if(i.severity==='HEAVY'&&i.treatedRevision===null)i.treatedRevision=revision;time(3600);notes.push('实付60便士进行普通重伤处置，之后仍须实际休养至80健康。');}
 else if(c.type==='NEXT_WEEK'){b.actions=0;time(f.weekAnchor+604800-f.nowSecond);notes.push('走到下一实际周界，原生活费与约定还款照常结算；没有自动工资、免费修理或恢复。');}
 else if(c.type==='TRAVEL'||c.type==='RETURN_ON_FOOT'){const from=f.location;if(c.type==='TRAVEL')pay(b,{actions:1,cash:2});f.location=c.type==='TRAVEL'?c.to:MOON_HOME;root.materials=transportMoonMaterials(root.materials!,from,f.location);time(c.type==='TRAVEL'?1800:7200);notes.push(c.type==='TRAVEL'?'本人和同一批随身原物沿普通道路实际抵达。':'本人携同一批随身原物沿普通道路步行两小时返回岸边事务所，无需行动或现款；旧费用、伤势与原物去向保留。');}
 else if(c.type==='SERVICE'){const result=applyMoonService(root.services!,c.command,moonHost(root,eventId,revision));root.services=result.state;effect(root,result.effect,revision,eventId,financeReceipts);notes.push(...result.notes);}
 else if(c.type==='MATERIAL'){const result=applyMoonMaterial(root.materials!,c.command,moonHost(root,eventId,revision));root.materials=result.state;effect(root,result.effect,revision,eventId,financeReceipts);notes.push(...result.notes);}
 else if(c.type==='STABILIZE_PROMOTION'){const w=windowFor(root)!,compound=root.materials!.compounds.find(x=>x.id===c.compoundId)!;pay(b,MOON_PROMOTION_STABILITY);time(3600);root.promotionStability.preparations.push({id:`${eventId}:stability`,eventId,compoundId:compound.id,actorId:root.source!.actorId,sourceDigest:root.source!.historyDigest,compoundDigest:moonDigest(compound),location:f.location,week:b.week,windowId:w.id,startWeek:b.week,endWeek:b.week+1,preparedSecond:f.nowSecond,expiresSecond:f.nowSecond+604800,receipts:[...w.receipts],status:'READY',spentEventId:null,invalidatedEventId:null});notes.push('实付100便士、1行动、12灵性与8精神，完成同一本人、同一瓶、原调配室和三站真实到达的稳定准备。实际七天内有效，离室、换瓶或服药即不能沿用。');}
 else if(c.type==='CONSUME'){
  const p=preparation(root,c.compoundId);need(p,'实际付费准备缺失。');const check=random.check('will',58,40,'本瓶本次实际稳定准备'),success=['SUCCESS','GREAT_SUCCESS'].includes(check.tier),severe=check.tier==='GREAT_FAILURE';pay(b,{actions:1,spirituality:30});
  if(success){b.sequence=0;b.acting=0;root.promotionWeek=b.week;for(const ability of MOON_ABILITY_IDS)b.mastery[ability]=0;b.completedSources.push('MOON_ORIGINAL_SUCCESSION');}
  else{pay(b,{health:severe?110:45,mind:severe?100:40,pollution:severe?70:35});b.injuries.push({id:`${eventId}:potion-injury`,severity:'HEAVY',acquiredRevision:revision,treatedRevision:null});b.injuryRisk+=2;}
  root.materials=settleMoonConsumption(root.materials!,{eventId,week:b.week,compoundId:c.compoundId,success,alive:b.status==='ACTIVE',location:f.location});p.status='SPENT';p.spentEventId=eventId;time(3600);
  notes.push(success?'三份原特性与同一唯一性在同一本人体内融合。两项新技巧从零掌握开始，身体、身份、姓名和爱意不再变化，健康、精神与灵性没有补满。':'同一成药已实际耗尽，失败损伤、污染和重伤照常结算，没有不死保底。尚存活者可在原处免费封存后隔周付费回收；死亡者的三份原特性与唯一性留在现场。');
 }
 else if(c.type==='START_EPILOGUE'){root.epilogue=createMoonEpilogue(root.services!,{week:b.week,nowSecond:f.nowSecond});time(600);notes.push('步入同一东岸小栈后来发生的松缆现场，原船留下实际新损坏，原乘客仍在真实先前到达处；耗时十分钟，不补资源。');}
 else if(c.type==='EPILOGUE'){const preview=getMoonEpilogueCheckPreview(root,c.command.type),check=preview?random.check(preview.ability,preview.difficulty,preview.effectiveBonus,'本人本次有限施术'):null;const result=applyMoonEpilogue(root.epilogue!,c.command,b,root.services!,{eventId,revision,nowSecond:f.nowSecond,check});root.epilogue=result.state;root.services=result.services;time(result.seconds);notes.push(result.summary);}
 if(b.status!=='ACTIVE'){for(const item of [...root.materials!.characteristics,root.materials!.uniqueness])if(['EMBODIED','FUSED','PLAYER'].includes(item.holder)){item.holder='LOST';item.location=f.location;}root.materials!.uniqueness.incumbentActorId=null;root.materials!.uniqueness.custodianActorId=null;}
 for(const p of root.promotionStability.preparations)if(p.status==='READY'&&preparation(root,p.compoundId)?.id!==p.id){p.status='INVALIDATED';p.invalidatedEventId=eventId;}
 const event:MoonEvent={id:eventId,revision,command:clone(c),before,after:clone(f),randomReceipts:clone(random.receipts),financeReceipts,notes,beforeDigest,afterDigest:dataDigest(root)};root.journal.push(event);return event;
}
/** Cold/raw entry strictly replays every new command once. Owned transitions
 * are private WeakMap-branded drafts and never reopen/replay their prefix. */
function reconstruct(s: SliceState): MoonState {
 const saved=s.moon;need(saved?.source&&validateMoonSource(s,saved.source),'原身份、原来客和三份特性历史未通过核验。');need(Array.isArray(saved.journal),'实际动作记录无效。');
 const root=start(clone(saved.source));for(const event of saved.journal){need(event&&event.revision===saved.source.revision+2+root.journal.length,'本章修订次序不一致。');const actual=reduce(root,clone(event.command),event.revision);need(sameMoon(actual,event),'实际行动、检定、代价或来源与原记录不一致。');}need(sameMoon(root,saved),'当前夜航、原物和身体无法由实际行动重建。');
 const f=root.frame!,source=root.source!,{coreStats:_current,...identity}=s.character,{coreStats:_original,...originalIdentity}=source.character;
 need(s.progression.pathwayId==='moon'&&s.revision===source.revision+1+root.journal.length&&sameMoon(moonBudget(s),f.budget)&&sameMoon(s.random,f.random),'当前身体与实际动作终点不一致。');need(sameMoon(identity,originalIdentity)&&Object.entries(f.finance).every(([key,value])=>sameMoon(s[key as keyof SliceState],value)),'当前身份或生活账本不一致。');need(s.combatHistory.length===source.combatHistoryLength&&s.combat===null&&s.activeEvent===null&&s.eventQueue.length===0&&s.pulse==='NONE','旧现场或原战斗终点不一致。');return root;
}
export function validateMoonRoot(s: SliceState): void { reconstruct(s); }
export function transitionMoon(s: SliceState,c: MoonCommand): MoonState {const root=reconstruct(s);reduce(root,clone(c),s.revision+1);return root;}
export function openMoonOwnedEngine(s: SliceState): MoonOwnedEngine { return retain(reconstruct(clone(s))); }
export function snapshotMoonOwnedEngine(h: MoonOwnedEngine): MoonState { return clone(getOwned(h)); }
export function advanceMoonOwnedEngine(h: MoonOwnedEngine,c: MoonCommand,revision: number): MoonOwnedEngine {const next=clone(getOwned(h));reduce(next,clone(c),revision);return retain(next);}
export function blockMoonOwnedEngine(h: MoonOwnedEngine,c: MoonCommand,revision: number): string|null {try{return commandBlock(getOwned(h),c,revision);}catch{return '当前记录或行动条件无效。';}}
