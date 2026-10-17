import { validateFoolCommand } from './index.js';
import type { SliceState } from '../slice/types.js';
import type { PublicCoreStatKey, PublicCheckResult } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck, type NormalCheckInput } from '../../resolution/normal-check.js';
import { createReceptionWorkLedger, resolveReceptionEconomy } from '../reception-economy.js';
import type { FoolBudget } from './source.js';
import { createFoolMaterials, createFoolMaterialReplayCursor, validateFoolMaterials, applyFoolMaterialCommand, applyVerifiedFoolConsumption, applyVerifiedFoolTransport, type FoolMaterialCommand, type FoolMaterialConsumptionReceipt, type FoolMaterialReplayCursor } from './materials.js';
import { createFoolReplayOrigin, deriveFoolMaterialHost, deriveFoolMaterialTransportReceipt, foolMaterialCheckSpec, type FoolMaterialReplayFrame } from './material-host.js';
import { createFogState, createFogReplayCursor, fogConsumptionBlock, fogConsumptionEvidence, type FogHostFacts, type FogCommand, type FogReplayCursor, fogPreparationRollCount } from './fog.js';
import { FOOL_ABILITY_IDS, FOOL_CONSUMPTION } from './content.js';
import {createFoolFateHostState,transitionFoolFateHost,projectFoolFateHost,evaluateFoolFateRitual,type FoolFateOrigin,type FoolFateHostAuthority,type FoolFateHostCommand,type FoolFateHostContext,type FoolFateHostReceipt,createFoolFateHostReplayCursor,type FoolFateHostReplayCursor} from './fate-host.js';
import {fateOriginalsDigest,type FateWorldFact} from './fate.js';
import { createFoolEscapeState, applyFoolEscapeCommand, foolEscapeCheckInput } from './escape.js';
import {buildFoolEscapeInitial,createFoolEscapeAuthority,deriveFoolEscapeHost,type FoolEscapeStartFrame,type FoolEscapeReplayFrame,createFoolEscapeHostReplayCursor,type FoolEscapeHostReplayCursor} from './escape-host.js';
import {FOOL_SOURCE_MATERIAL_IDS,FOOL_UNIQUENESS_ID} from './materials.js';
import type { FoolState, FoolCommand, FoolFrame, FoolEvent, FoolCheckReceipt, FoolRollReceipt } from './types.js';

export const sameFool = (a:unknown,b:unknown):boolean => stableStringify(a) === stableStringify(b);
export const foolDigest = (v:unknown):string => sha256Hex(stableStringify(v));
export function requireFool(ok:unknown,reason:string):asserts ok {if(!ok)throw Error(reason);}
export function createFoolState():FoolState {
 return {version:1,guidanceKnown:false,source:null,frame:null,promotionWeek:null,fate:null,atFate:false,fatePeople:{},materials:null,fog:null,escape:null,reception:createReceptionWorkLedger(),journal:[]};
}
export function foolFogHost(root:FoolState,rolls:number[]|null=null):FogHostFacts {
 const source=root.source!, f=root.frame!,b=f.budget,t=source.town;
 return {bodyId:source.actorId,week:b.week,nowSecond:f.nowSecond,location:f.location,active:b.status==='ACTIVE',sequence:b.sequence,
 health:b.health,mind:b.mind,spirituality:b.spirituality,cash:b.cash,actions:b.actions,
 controlPower:Math.min(100,Math.floor(50+(b.coreStats.will+b.coreStats.perception)/4+(b.mastery['diviner.s5.spirit-threads']??0)/5)),
 activityEpoch:f.activityEpoch,...structuredClone(t),townOperatorAt:f.location,cart:{...t.cart,location:f.cartLocation},rolls,eventId:null};
}
export interface ReplayContext {archived:SliceState;materialFrames:FoolMaterialReplayFrame[];fateReceipts:FoolFateHostReceipt[];escapeStart:FoolEscapeStartFrame|null;escapeFrames:FoolEscapeReplayFrame[];materialAuthority:ReturnType<typeof createFoolReplayOrigin>['materialAuthority']}
interface OwnedReplayContext extends ReplayContext {fogReplay:FogReplayCursor}
interface RuntimeCursors { materials:FoolMaterialReplayCursor; fate:FoolFateHostReplayCursor; escape:FoolEscapeHostReplayCursor|null }
// A returned replay context is never an authority token. Only contexts inside
// opaque owned heads retain these private, independently constructed cursors.
const runtimeCursors=new WeakMap<OwnedReplayContext,RuntimeCursors>();
declare const ownedEngineBrand:unique symbol;
export interface FoolOwnedEngine { readonly [ownedEngineBrand]:true }
const ownedEngines=new WeakMap<FoolOwnedEngine,{root:FoolState;context:OwnedReplayContext}>();
function ownedEngine(handle:FoolOwnedEngine):ReturnType<typeof replayFool> {
 const value=ownedEngines.get(handle);requireFool(value,'无效的当前领域会话。');return value;
}
function freezeOwnedSource(value:unknown):void {
 if(!value||typeof value!=='object'||Object.isFrozen(value))return;
 for(const child of Object.values(value))freezeOwnedSource(child);Object.freeze(value);
}
function retainOwnedEngine(prepared:ReturnType<typeof replayFool>):FoolOwnedEngine {
 const handle=Object.freeze({}) as FoolOwnedEngine;ownedEngines.set(handle,prepared);return handle;
}
export function startFool(s:SliceState):FoolState {
 return startFromVerifiedOrigin(createFoolReplayOrigin(s));
}
/** Private to this invocation; a public caller cannot provide a verified flag. */
function startFromVerifiedOrigin(origin:ReturnType<typeof createFoolReplayOrigin>):FoolState {
 const root=createFoolState(),source=structuredClone(origin.source);
 root.guidanceKnown=true;root.source=source;root.frame={budget:structuredClone(source.budget),nowSecond:604800,activityEpoch:0,location:'base',cartLocation:source.town.cart.location,random:{...source.random}};
 root.reception.emergencyUsed=source.emergencyWorkUsed;
 const authority=origin.materialAuthority([]);
 root.materials=createFoolMaterials(source.materialsOrigin,authority);root.fog=createFogState(foolFogHost(root));root.fate=createFoolFateHostState(foolFateAuthority(root,[]));
 for(const original of root.fate.registry.commissions) for(const person of original.crew)root.fatePeople[person.id]={health:100,injuries:[]};
 return root;
}
function dataCanonical(root:FoolState):string {const {journal:_journal,...rest}=root;return stableStringify(rest);}
function dataDigest(root:FoolState):string {return sha256Hex(dataCanonical(root));}

// These are only the two shallow records assembled below. Unknown/missing keys
// fall back to the complete existing serializer, including any added fields.
const ROOT_KEYS = ['atFate', 'escape', 'fate', 'fatePeople', 'fog', 'frame', 'guidanceKnown', 'materials', 'promotionWeek', 'reception', 'source', 'version'] as const;
const MATERIAL_KEYS = ['compounds', 'items', 'journal', 'origin', 'originDigest', 'status', 'version'] as const;
function exactKeys(value: object, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}
function plainRecord(value: unknown): value is object {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

/** Internal serialization only, never an authority or validation result.
 * Call ONLY on the independently constructed, unexposed expected root inside
 * one synchronous replayFool loop. That loop and its reducers do not mutate
 * source or an existing materials.origin; material reducers replace the latter
 * with a clone, which is serialized afresh. Do not retain this closure in the
 * returned context, use it on a saved/player root, or pass it to prepared forks.
 * Public/returned prepared operations keep the complete original dataDigest.
 */
export function createOwnedFoolReplayCanonical(root: FoolState): () => string {
  const source = root.source;
  let sourceCanonical: string | undefined;
  let materialOrigin: NonNullable<FoolState['materials']>['origin'] | undefined;
  let originCanonical: string | undefined;
  return () => {
    const { journal: _journal, ...rest } = root;
    const materials = root.materials;
    if (!plainRecord(source) || root.source !== source || !exactKeys(rest, ROOT_KEYS) ||
      !plainRecord(materials) || !exactKeys(materials, MATERIAL_KEYS) || !plainRecord(materials.origin)) {
      return stableStringify(rest);
    }
    sourceCanonical ??= stableStringify(source);
    if (materialOrigin !== materials.origin) {
      const canonical = stableStringify(materials.origin);
      materialOrigin = materials.origin; originCanonical = canonical;
    }
    // Keys at these two fixed levels are non-index strings in the exact order
    // produced by canonicalValue + JSON.stringify. All nested values still use
    // stableStringify, preserving numeric-key ordering, escapes and rejection.
    const materialCanonical = `{${MATERIAL_KEYS.map(key => `${JSON.stringify(key)}:${key === 'origin' ? originCanonical : stableStringify(materials[key])}`).join(',')}}`;
    return `{${ROOT_KEYS.map(key => `${JSON.stringify(key)}:${key === 'source' ? sourceCanonical : key === 'materials' ? materialCanonical : stableStringify(rest[key])}`).join(',')}}`;
  };
}

export function applyFoolCost(b:FoolBudget,c:{actions?:number;cash?:number;spirituality?:number;mind?:number;health?:number;pollution?:number}):void {
 for(const key of ['actions','cash','spirituality'] as const)requireFool(b[key]>=(c[key]??0),`实际${key}不足。`);
 b.actions-=c.actions??0;b.cash-=c.cash??0;b.spirituality-=c.spirituality??0;
 b.mind=Math.max(0,b.mind-(c.mind??0));b.health=Math.max(0,b.health-(c.health??0));b.pollution=Math.min(100,b.pollution+(c.pollution??0));
 if(b.health===0||b.mind===0||b.pollution===100){b.health=0;b.status='DEAD';}
}
export interface FoolDraws {
 roll(min:number,max:number):number;check(input:NormalCheckInput):PublicCheckResult;
 receipts:(FoolCheckReceipt|FoolRollReceipt)[];
}
function draws(frame:FoolFrame):FoolDraws {
 const receipts:(FoolCheckReceipt|FoolRollReceipt)[]=[];
 const roll=(min:number,max:number)=>{const before=frame.random.cursor,rng=new DeterministicActionRandomStream(frame.random.seed,before),value=rng.nextInt(min,max);frame.random.cursor=rng.cursor;receipts.push({kind:'ROLL',min,max,value,cursorBefore:before,cursorAfter:frame.random.cursor});return value;};
 const check=(input:NormalCheckInput)=>{const before=frame.random.cursor,rng=new DeterministicActionRandomStream(frame.random.seed,before),result=resolveNormalCheck({...input,roll:rng.nextInt(1,100)});frame.random.cursor=rng.cursor;receipts.push({kind:'CHECK',check:result,cursorBefore:before,cursorAfter:frame.random.cursor});return result;};
 return {roll,check,receipts};
}
function atBase(root:FoolState):void {requireFool(root.frame!.location==='base','先带本人沿原路回到接待处。');}
function cancelFogForActivity(root:FoolState,context:OwnedReplayContext):void {
 root.frame!.activityEpoch++;
 root.fog=context.fogReplay.advance({type:'SYNC_HOST'},foolFogHost(root)).state;
}
function applyFog(root:FoolState,c:FogCommand,random:FoolDraws,context:OwnedReplayContext):void {
 const host=foolFogHost(root),reason=context.fogReplay.block(c,host);requireFool(!reason,reason??'迷雾行动条件不足。');
 if(c.type==='PREPARE_STATION') {
  host.rolls=Array.from({length:fogPreparationRollCount(root.fog!,c.stationId)},()=>random.roll(1,100));
 }
 const next=context.fogReplay.advance(c,host);applyFoolCost(root.frame!.budget,next.cost);
 root.frame!.nowSecond+=next.elapsedSeconds;root.frame!.location=next.location;root.frame!.cartLocation=next.cartLocation;root.fog=next.state;
}
/** This reducer only runs after a complete original-source/journal verification.
 * All new checks are generated from the one original deterministic stream. A
 * rejected draft is discarded, so neither fees nor RNG leak out of a block. */
function reduce(root:FoolState,command:FoolCommand,revision:number,context:OwnedReplayContext,previousActualDigest?:string,ownedDataDigest?:()=>string,materialReplay?:FoolMaterialReplayCursor,recordReceipt=true):FoolEvent|null {
 requireFool(validateFoolCommand(command),'这项行动的内容无效。');
 materialReplay??=runtimeCursors.get(context)?.materials;
 const f=root.frame!,source=root.source!;requireFool(root.guidanceKnown&&source&&f&&f.budget.status==='ACTIVE','本章须由原活角色继续。');
 requireFool(Number.isSafeInteger(revision)&&revision>source.revision&&(root.journal.length===0||revision>root.journal.at(-1)!.revision),'本次实际修订次序无效。');
 const fateReceiptStart=context.fateReceipts.length;
 const before=structuredClone(f),beforeDigest=recordReceipt?(previousActualDigest??(ownedDataDigest?.()??dataDigest(root))):(dataCanonical(root),''),eventId=`F208:${source.runId}:${revision}`,random=draws(f);
 let materialHost:FoolEvent['materialHost']=null,consumption:FoolEvent['consumption']=null,escapeHost:FoolEvent['escapeHost']=null;
 requireFool(root.escape?.scene.status!=='ACTIVE'||command.type==='ESCAPE','先沿当前真实撤离通道完成或退出，再办理别的行动。');
 requireFool(!root.atFate||['FATE','LEAVE_FATE'].includes(command.type),'先从当前真实航道撤到安全点，再沿普通路回接待处。');
 if(command.type==='RECEPTION_WORK'||command.type==='RECEPTION_REST'||command.type==='RECEPTION_NEXT_WEEK') {
  atBase(root);cancelFogForActivity(root,context);
  const economy=command.type==='RECEPTION_WORK'?'WORK':command.type==='RECEPTION_REST'?'REST':'NEXT_WEEK';
  const b=f.budget,result=resolveReceptionEconomy({...b,revision:revision-1},root.reception,economy);
  Object.assign(b,result.after);delete (b as unknown as Record<string,unknown>).revision;root.reception=result.workAfter;
  f.nowSecond+=economy==='NEXT_WEEK'?604800:economy==='REST'?3600:1800;
  root.fog=context.fogReplay.advance({type:'SYNC_HOST'},foolFogHost(root)).state;
 } else if(command.type==='FOG') {
  requireFool(!['APPLY_EVENT','SYNC_HOST','ADVANCE_FOR_CONSUMPTION'].includes(command.command.type),'该内部迷雾动作不可由按钮直接提交。');
  applyFog(root,command.command,random,context);
  if(command.command.type==='TRAVEL'&&root.materials!.compounds.some(c=>c.status==='PREPARED')) {
   const frame:FoolMaterialReplayFrame={kind:'CENTRAL_TRANSPORT',eventId,witnessId:`${eventId}:host`,revision,locationId:f.location,before:structuredClone(before.budget),after:structuredClone(f.budget),materialsBefore:root.materials!,randomBefore:before.random.cursor,randomAfter:f.random.cursor,journey:structuredClone(root.fog!.journeys.at(-1)!),fogTravel:structuredClone(root.fog!.journal.at(-1)!)};
   const receipt=deriveFoolMaterialTransportReceipt(source,frame);materialHost=deriveFoolMaterialHost(source,frame);
   const authority=context.materialAuthority([...context.materialFrames,frame]);
   root.materials=(materialReplay?materialReplay.transport(receipt,materialHost,authority):applyVerifiedFoolTransport(root.materials!,receipt,materialHost,authority)).state;context.materialFrames.push(frame);
  }
 } else if(command.type==='ENTER_FATE') {
  atBase(root);requireFool(f.budget.sequence===1&&!root.atFate,'先实际回到接待处。');cancelFogForActivity(root,context);
  if(root.fate!.currentCaseId===null)applyFateHost(root,{id:eventId,type:'ENTER_FIRST_CASE'},revision,context,random);
  else {f.nowSecond+=20;syncFate(root,revision,context,random);}
  root.atFate=true;
 } else if(command.type==='LEAVE_FATE') {
  requireFool(root.atFate,'本人不在航道现场。');const entry=root.fate!.currentCaseId?root.fate!.cases[root.fate!.currentCaseId]:null;
  requireFool(entry&&(['REFUGE','DOCK'].includes(entry.state.scene.actorPlace)||entry.state.scene.actorPlace==='BERTH'&&!entry.state.scene.departed),'先实际回到泊位、避难点或码头，不能从船上瞬移回接待处。');
  f.nowSecond+=20;syncFate(root,revision,context,random);root.atFate=false;f.location='base';cancelFogForActivity(root,context);
 } else if(command.type==='FATE') {
  requireFool(root.atFate||['INVESTIGATE_RECOVERY','VERIFY_RECOVERY'].includes(command.command.type)&&f.location==='base','须实际到场办理这项原商运行动。');
  requireFool(command.command.type!=='ENTER_FIRST_CASE','请沿原路进入泊位。');
  syncFate(root,revision,context,random);applyFateHost(root,{...command.command,id:eventId} as FoolFateHostCommand,revision,context,random);
 } else if(command.type==='MATERIAL') {
  requireFool(f.budget.sequence===1,'原材料只用于本人的这一次成神传承。');
  cancelFogForActivity(root,context);
  const c={...command.command,proofId:`${eventId}:physical-proof`} as FoolMaterialCommand;
  const spec=foolMaterialCheckSpec(c),check=spec?random.check({...spec,baseAbility:f.budget.coreStats[spec.ability],modifiers:[]}):null;
  const frame:FoolMaterialReplayFrame={kind:'MATERIAL_COMMAND',eventId,witnessId:`${eventId}:host`,revision,locationId:f.location,before:structuredClone(before.budget),materialsBefore:root.materials!,randomBefore:before.random.cursor,randomAfter:f.random.cursor,command:c,check};
  materialHost=deriveFoolMaterialHost(source,frame);
  const authority=context.materialAuthority([...context.materialFrames,frame]);
  const next=materialReplay?materialReplay.command(c,materialHost,authority):applyFoolMaterialCommand(root.materials!,c,materialHost,authority);root.materials=next.state;applyFoolCost(f.budget,next.cost);context.materialFrames.push(frame);f.nowSecond+=60;
  root.fog=context.fogReplay.advance({type:'SYNC_HOST'},foolFogHost(root)).state;
 } else if(command.type==='CONSUME') {
  consumption=consumeFool(root,command,revision,eventId,context,random,before,materialReplay);
 } else if(command.type==='START_ESCAPE') {
  atBase(root);requireFool(f.budget.sequence===0&&root.promotionWeek!==null&&root.escape===null,'只有本人实际成神后，才能到场参与这一宗未开始的撤离。');
  cancelFogForActivity(root,context);
  const start:FoolEscapeStartFrame={eventId,revision,command:{type:'START_ESCAPE'},before:structuredClone(f.budget),now:f.nowSecond,location:f.location};
  context.escapeStart=start;
  const cursors=runtimeCursors.get(context);
  if(cursors){cursors.escape=createFoolEscapeHostReplayCursor(source,context.archived,start);root.escape=cursors.escape.snapshot();}
  else root.escape=createFoolEscapeState(buildFoolEscapeInitial(source,start),createFoolEscapeAuthority(source,context.archived,start,[],true));
 } else if(command.type==='ESCAPE') {
  requireFool(f.budget.sequence===0&&root.escape&&context.escapeStart,'须进入同一宗实际撤离。');
  const actor=root.escape.scene.bodies.find(p=>p.id===source.actorId)!;
  const environment={conditionId:root.escape.scene.conditionId,lineOfSight:actor.place!=='EXIT'&&root.escape.scene.bodies.find(p=>p.role==='GUARD')!.place!=='EXIT'};
  const input=foolEscapeCheckInput(root.escape,command.command,{now:f.nowSecond,stats:f.budget.coreStats,environment});
  const check=input?random.check(input):null;
  const frame:FoolEscapeReplayFrame={eventId,revision,before:structuredClone(before.budget),now:f.nowSecond,escapeBefore:root.escape,command:command.command,environment,check,randomBefore:before.random.cursor,randomAfter:f.random.cursor};
  escapeHost=deriveFoolEscapeHost(source,frame);
  const escapeCursor=runtimeCursors.get(context)?.escape;
  const result=escapeCursor?escapeCursor.advance(frame):applyFoolEscapeCommand(root.escape,command.command,escapeHost,createFoolEscapeAuthority(source,context.archived,context.escapeStart,[...context.escapeFrames,frame]));root.escape=result.state;context.escapeFrames.push(frame);
  applyFoolCost(f.budget,result.effect.cost);
  requireFool(f.budget.actions===result.effect.resourcesAfter.actions&&f.budget.spirituality===result.effect.resourcesAfter.spirituality&&f.budget.mind===result.effect.resourcesAfter.mind,'撤离消耗与实际身体预算不一致。');
  f.budget.health=result.effect.resourcesAfter.health;f.nowSecond=root.escape.scene.now;
  for(const injury of result.effect.consequences.filter(i=>i.bodyId===source.actorId)) {
   requireFool(!f.budget.injuries.some(i=>i.id===injury.injury.id),'同一撤离伤害不能重复登记。');
   const severity=injury.injury.healthLoss>=30?'HEAVY':'LIGHT';
   f.budget.injuries.push({id:injury.injury.id,severity,acquiredRevision:revision,treatedRevision:null});f.budget.injuryRisk+=severity==='HEAVY'?2:1;
  }
  if(result.effect.status==='DEAD'||f.budget.health===0){f.budget.status='DEAD';f.budget.health=0;}
  for(const award of result.effect.mastery)f.budget.mastery[award.abilityId]=Math.min(100,(f.budget.mastery[award.abilityId]??0)+award.amount);
 } else {throw Error('这一章的该动作尚未接线。');}
 syncFate(root,revision,context,random);
 // Eligibility previews still execute every real isolated effect and both
 // canonical validation passes. Only discarded SHA/audit receipt work is absent.
 // Keeping canonical validation preserves rejection of malformed prepared data.
 if(!recordReceipt){structuredClone(command);dataCanonical(root);return null;}
 const event:FoolEvent={id:eventId,revision,fateReceipts:structuredClone(context.fateReceipts.slice(fateReceiptStart)),command:structuredClone(command),before,after:structuredClone(f),randomReceipts:random.receipts,materialHost,consumption,escapeHost,beforeDigest,afterDigest:ownedDataDigest?.()??dataDigest(root)};
 root.journal.push(event);return event;
}
export function replayFool(s:SliceState,root:FoolState):{root:FoolState;context:OwnedReplayContext} {
 return reconstructFool(s,root,false);
}
function reconstructFool(s:SliceState,root:FoolState,retainCursors:boolean):{root:FoolState;context:OwnedReplayContext} {
 requireFool(root.source!==null,'旧身份、原镇、材料和复起历史不能被改写。');
 const origin=createFoolReplayOrigin(s,root.source),expected=startFromVerifiedOrigin(origin),context:OwnedReplayContext={archived:origin.archived,materialFrames:[],fateReceipts:[],escapeStart:null,escapeFrames:[],materialAuthority:origin.materialAuthority,fogReplay:createFogReplayCursor(foolFogHost(expected))};
 requireFool(Array.isArray(root.journal)&&root.journal.length<=4096,'本章动作记录长度无效。');
 // Between these private replay steps only the excluded central journal grows.
 // Reuse only the prior generated digest after its entire event matches the save.
 // This serializer never leaves the private replay loop. Returned prepared
 // roots and independent transitions use dataDigest; previews retain its full
 // canonical validation while omitting only the discarded SHA/receipt.
 const canonical=createOwnedFoolReplayCanonical(expected),ownedDataDigest=()=>sha256Hex(canonical());
 // The cursor starts from verified original items, never the supplied save. It
 // exists only in this loop; prepared operations below retain strict prefix replay.
 const materialReplay=createFoolMaterialReplayCursor(origin.source.materialsOrigin,context.materialAuthority([]));
 if(retainCursors){freezeOwnedSource(context.archived);runtimeCursors.set(context,{materials:materialReplay,fate:createFoolFateHostReplayCursor(origin.source,origin.archived),escape:null});}
 let previousActualDigest:string|undefined;
 for(const entry of root.journal) {
  const actual=reduce(expected,entry.command,entry.revision,context,previousActualDigest,ownedDataDigest,materialReplay)!;requireFool(sameFool(actual,entry),'本章原动作、费用、随机或原物记录不一致。');
  previousActualDigest=actual.afterDigest;
 }
 requireFool(validateFoolMaterials(expected.materials!,context.materialAuthority(context.materialFrames)),'INVALID_MATERIAL_LEDGER');
 requireFool(sameFool(expected,root),'当前状态与原动作逐条重放不一致。');return {root:expected,context};
}
export function transitionFool(s:SliceState,root:FoolState,c:FoolCommand,revision:number):FoolState {
 const replay=replayFool(s,root);reduce(replay.root,c,revision,replay.context);return replay.root;
}
export function previewFool(s:SliceState,root:FoolState,c:FoolCommand,revision:number):string|null {
 try {const replay=replayFool(s,root);reduce(replay.root,c,revision,replay.context);return null;}catch(error){return error instanceof Error?error.message:'当前不能执行。';}
}

export function foolFateOrigin(root:FoolState):FoolFateOrigin {
 const source=root.source!;
 return {runId:source.runId,actorId:source.actorId,worldSourceSecond:0,worldSourceReceipt:`F208-RELIC-WORLD:${source.worldDigest}`,
 inheritedTerminalReceipt:`F208-S1:${source.sourceHistoryDigest}`,independentUniquenessCustodyReceipt:source.materialsOrigin.uniquenessCustody.at(-1)!.id};
}
export function foolFateAuthority(root:FoolState,receipts:readonly FoolFateHostReceipt[],current?:FoolFateHostReceipt):FoolFateHostAuthority {
 const origin=foolFateOrigin(root),map=new Map([...receipts,...(current?[current]:[])].map(r=>[r.context.receiptId,r]));
 return {origin,committedReceiptCount:receipts.length,originIsAuthentic:o=>sameFool(o,origin),receiptIsAuthentic:r=>sameFool(map.get(r.context.receiptId),r)};
}
export function foolFateContext(root:FoolState,revision:number,suffix:string):FoolFateHostContext {
 const f=root.frame!,b=f.budget;
 return {receiptId:`F208-FATE:${root.source!.runId}:${revision}:${suffix}`,ledgerRevision:`F208-REV:${revision}`,expectedRevision:root.fate!.receipts.length,
 at:f.nowSecond,week:b.week,actorId:root.source!.actorId,actorAlive:b.status==='ACTIVE',actorConscious:b.status==='ACTIVE'&&b.mind>0,
 bodyHealth:{actor:b.health,crew:Object.fromEntries(Object.entries(root.fatePeople).map(([id,p])=>[id,p.health]))},
 actionPoints:b.actions,spirituality:b.spirituality,mental:b.mind,pennies:b.cash,access:root.atFate?'AT_CURRENT_CASE':f.location==='base'?'CANAL_APPROACH':'ELSEWHERE',
 otherComplexGraftActive:false,worldFacts:[]};
}
function applyFateHost(root:FoolState,command:FoolFateHostCommand,revision:number,context:ReplayContext,random:FoolDraws,worldFacts:readonly FateWorldFact[]=[]):void {
 const f=root.frame!,b=f.budget,c=foolFateContext(root,revision,String(context.fateReceipts.length));c.worldFacts=worldFacts;
 if(command.type==='CASE'&&command.action.type==='GRAFT') {
  const cursor=f.random.cursor,result=random.check({ability:'knowledge',baseAbility:b.coreStats.knowledge,difficulty:20,modifiers:[]});
  c.check={id:`${command.id}:check`,result,rngBeforeRef:`F208-RNG:${cursor}`,rngAfterRef:`F208-RNG:${f.random.cursor}`};
 }
 if(command.type==='VERIFY_RECOVERY') {
  // The sixty-second original inspection starts on the canal, never at a remote panel.
  requireFool(root.atFate,'先从接待处实际步行20秒到原航道，再核验下一原委托。');
  const original=root.fate!.registry.commissions.find(i=>i.commissionId===command.commissionId);requireFool(original,'原委托不存在。');
  c.recoveryChecks={registerReceipt:original.originals.commercialRegisterReceipt,boatContinuityReceipt:original.originals.boatContinuityReceipt,
   crateContinuityReceipt:original.originals.crateContinuityReceipt,originReceipt:original.binding.originReceipt,
   originalsDigest:fateOriginalsDigest(original),inspectedAt:c.at+60};
 }
 const receipt={command,context:c},authority=foolFateAuthority(root,context.fateReceipts,receipt);
 const fateCursor=runtimeCursors.get(context as OwnedReplayContext)?.fate;
 const result=fateCursor?fateCursor.advance(command,c,authority):transitionFoolFateHost(root.fate!,command,c,authority);
 requireFool(result.ok,result.blockedReason??'原商运现场条件不足。');root.fate=result.state;context.fateReceipts.push(structuredClone(receipt));
 applyFoolCost(b,{actions:result.cost.actionPoints,spirituality:result.cost.spirituality,mind:result.cost.mental,cash:result.cost.pennies});f.nowSecond+=result.elapsedSeconds;
 if(result.enteredCaseId)root.atFate=true;
 for(const consequence of result.consequences) {
  const current=root.fate.cases[root.fate.currentCaseId!]!.state;
  const cause=current.journal[consequence.eventSequence],injuryId=consequence.injuryReceipt;
  requireFool(cause?.type==='STRUCTURAL_CRUSH_INJURY'&&cause.data.subjectId===consequence.subjectId&&cause.at===consequence.at&&
   injuryId===`${current.instance.id}:injury:${consequence.eventSequence}`&&consequence.healthAfter===Math.max(0,consequence.healthBefore-35)&&consequence.died===(consequence.healthAfter===0),'真实压伤及身体结算关联不一致。');
  if(consequence.subjectId===root.source!.actorId) {
   if(b.injuries.some(i=>i.id===injuryId))continue;
   requireFool(b.health===consequence.healthBefore&&current.scene.actorInjuries.includes(injuryId),'原身体健康与压伤前快照不一致。');
   b.injuries.push({id:injuryId,severity:'HEAVY',acquiredRevision:revision,treatedRevision:null});b.injuryRisk+=2;applyFoolCost(b,{health:35});
   requireFool(b.health===consequence.healthAfter&&current.scene.actorAlive===!consequence.died,'原身体压伤死亡结算不一致。');
  } else {
   const person=root.fatePeople[consequence.subjectId],crew=current.scene.crew.find(p=>p.id===consequence.subjectId);
   requireFool(person&&crew&&crew.injuries.includes(injuryId),'伤者须为原在场身体。');
   if(person.injuries.includes(injuryId))continue;
   requireFool(person.health===consequence.healthBefore,'原船员健康与压伤前快照不一致。');
   person.health=Math.max(0,person.health-35);person.injuries.push(injuryId);
   requireFool(person.health===consequence.healthAfter&&crew.alive===!consequence.died,'原船员压伤死亡结算不一致。');
  }
 }
}
function syncFate(root:FoolState,revision:number,context:ReplayContext,random:FoolDraws):void {
 if(!root.fate)return;
 const f=root.frame!,b=f.budget,current=root.fate.currentCaseId?root.fate.cases[root.fate.currentCaseId]!.state:null;
 const facts:FateWorldFact[]=[];
 // Settled old cases remain frozen for recovery. Subsequent unrelated injury stays in the central body ledger.
 if(current&&!(current.phase==='CLOSED'&&(current.scene.bellOccurred||!current.scene.departed))) {
  const add=(subjectId:string,injuries:readonly string[],known:readonly string[],dead:boolean,wasAlive:boolean):void=>{
   for(const receipt of injuries)if(!known.includes(receipt))facts.push({id:`F208-BODY:${current.instance.id}:${subjectId}:${receipt}`,at:f.nowSecond,type:'BODY_INJURED',subjectId,injuryReceipt:receipt});
   if(dead&&wasAlive)facts.push({id:`F208-DEATH:${current.instance.id}:${subjectId}:${revision}`,at:f.nowSecond,type:'BODY_DIED',subjectId,injuryReceipt:injuries.at(-1)??`F208-CENTRAL-DEATH:${subjectId}:${revision}`});
  };
  add(root.source!.actorId,b.injuries.map(i=>i.id),current.scene.actorInjuries,b.status!=='ACTIVE',current.scene.actorAlive);
  for(const crew of current.scene.crew){const p=root.fatePeople[crew.id];requireFool(p,'原船员身体记录丢失。');add(crew.id,p.injuries,crew.injuries,p.health===0,crew.alive);}
 }
 const tick=()=>({type:'SYNC_WORLD' as const,id:`F208-SYNC:${root.source!.runId}:${revision}:${context.fateReceipts.length}`});
 if(root.fate.now<f.nowSecond||facts.length)applyFateHost(root,tick(),revision,context,random,facts);
 const remaining=root.fate.currentCaseId?root.fate.cases[root.fate.currentCaseId]!.state:null;
 // Death stops player actions, not the already departed original commercial event.
 if(b.status!=='ACTIVE'&&remaining?.scene.departed&&!remaining.scene.bellOccurred&&remaining.scene.thirdBellAt!==null){
  f.nowSecond=Math.max(f.nowSecond,remaining.scene.thirdBellAt);applyFateHost(root,tick(),revision,context,random);
 }
}


/** One projection first verifies its entire source/journal, then tests commands
 * against isolated copies of that same result. No outcome or draw is committed. */
function forkPreparedFool(prepared:ReturnType<typeof replayFool>):ReturnType<typeof replayFool> {
 requireFool(prepared.context.fogReplay.matches(prepared.root.fog),'当前迷雾状态与本次原始重放不一致。');
 const root=structuredClone(prepared.root),context:OwnedReplayContext={...prepared.context,materialFrames:structuredClone(prepared.context.materialFrames),fateReceipts:structuredClone(prepared.context.fateReceipts),escapeFrames:structuredClone(prepared.context.escapeFrames),escapeStart:structuredClone(prepared.context.escapeStart),fogReplay:prepared.context.fogReplay.fork()};
 const cursors=runtimeCursors.get(prepared.context);
 if(cursors)runtimeCursors.set(context,{materials:cursors.materials.fork(),fate:cursors.fate.fork(),escape:cursors.escape?.fork()??null});
 return {root,context};
}
export function blockPreparedFool(prepared:ReturnType<typeof replayFool>,c:FoolCommand,revision:number):string|null {
 try {const {root,context}=forkPreparedFool(prepared);reduce(root,c,revision,context,undefined,undefined,undefined,false);return null;}
 catch(error){return error instanceof Error?error.message:'当前不能执行。';}
}

function consumeFool(root:FoolState,command:Extract<FoolCommand,{type:'CONSUME'}>,revision:number,eventId:string,context:OwnedReplayContext,random:FoolDraws,before:FoolFrame,materialReplay?:FoolMaterialReplayCursor):FoolMaterialConsumptionReceipt {
 const f=root.frame!,b=f.budget,source=root.source!;
 requireFool(command.confirmed===true&&b.sequence===1&&root.promotionWeek===null&&b.acting===100,'须本人完整消化序列一，并明确确认服药风险。');
 requireFool((runtimeCursors.has(context)?runtimeCursors.get(context)!.fate.evaluateRitual():evaluateFoolFateRitual(root.fate!,foolFateAuthority(root,context.fateReceipts)))!==null,'尚未用实际原船、原箱与真实传导结果完成仪式。');
 const reason=runtimeCursors.has(context)?context.fogReplay.consumptionBlock(foolFogHost(root)):fogConsumptionBlock(root.fog!,foolFogHost(root));requireFool(reason===null,reason??'当前实际控雾不足。');
 if(runtimeCursors.has(context))context.fogReplay.consumptionEvidence(foolFogHost(root));else fogConsumptionEvidence(root.fog!,foolFogHost(root));
 const compound=root.materials!.compounds.find(c=>c.id===command.compoundId);requireFool(compound?.status==='PREPARED'&&compound.locationId===f.location,'本人必须带着同一瓶真实成药到服药点。');
 requireFool(b.actions>=1,'服药需要保留一次行动。');
 const check=random.check({ability:'will',baseAbility:b.coreStats.will,difficulty:FOOL_CONSUMPTION.difficulty,modifiers:[]});
 const success=check.tier==='SUCCESS'||check.tier==='GREAT_SUCCESS';
 applyFog(root,{type:'ADVANCE_FOR_CONSUMPTION'},random,context);applyFoolCost(b,{actions:1});
 if(success){b.sequence=0;b.acting=0;root.promotionWeek=b.week;for(const id of FOOL_ABILITY_IDS)b.mastery[id]=0;b.completedSources.push('FOOL_ORIGINAL_SUCCESSION');}
 else {
  const severe=check.tier==='GREAT_FAILURE';
  applyFoolCost(b,{health:severe?FOOL_CONSUMPTION.greatFailureHealth:FOOL_CONSUMPTION.failureHealth,mind:severe?FOOL_CONSUMPTION.greatFailureMind:FOOL_CONSUMPTION.failureMind,pollution:severe?FOOL_CONSUMPTION.greatFailurePollution:FOOL_CONSUMPTION.failurePollution});
  b.injuries.push({id:`${eventId}:potion-injury`,severity:'HEAVY',acquiredRevision:revision,treatedRevision:null});b.injuryRisk+=2;
 }
 const receipt:FoolMaterialConsumptionReceipt={id:`${eventId}:consumption`,originDigest:root.materials!.originDigest,actorId:source.actorId,compoundId:compound.id,locationId:f.location,
 week:b.week,date:structuredClone(b.date),revision,sourceMaterialIds:[...FOOL_SOURCE_MATERIAL_IDS],uniquenessId:FOOL_UNIQUENESS_ID,outcome:success?'SUCCESS':'FAILURE',
 actorAfter:{status:b.status==='ACTIVE'?'ACTIVE':'DEAD',health:b.health,mind:b.mind,sequence:b.sequence},
 destinations:[...FOOL_SOURCE_MATERIAL_IDS,FOOL_UNIQUENESS_ID].map(itemId=>success||b.status==='ACTIVE'&&itemId===compound.integratedMaterialId?
 {itemId,disposition:'INTEGRATED_PLAYER',locationId:null,completeAndRecoverable:false}:
 {itemId,disposition:'RESIDUE_LOCATED',locationId:f.location,completeAndRecoverable:true})};
 const materialFrame:FoolMaterialReplayFrame={kind:'CENTRAL_CONSUMPTION',eventId,witnessId:`${eventId}:host`,revision,locationId:f.location,before:structuredClone(before.budget),materialsBefore:root.materials!,randomBefore:before.random.cursor,randomAfter:f.random.cursor,consumption:receipt};
 const host=deriveFoolMaterialHost(source,materialFrame),authority=context.materialAuthority([...context.materialFrames,materialFrame]);
 root.materials=(materialReplay?materialReplay.consume(receipt,host,authority):applyVerifiedFoolConsumption(root.materials!,receipt,host,authority)).state;context.materialFrames.push(materialFrame);
 root.fog=context.fogReplay.advance({type:'SYNC_HOST'},foolFogHost(root)).state;
 return receipt;
}

export function transitionPreparedFool(prepared:ReturnType<typeof replayFool>,c:FoolCommand,revision:number):FoolState {
 const {root,context}=forkPreparedFool(prepared);
 reduce(root,c,revision,context);return root;
}

/** Only strict reconstruction or advancement of an unexposed owned head can
 * mint these handles. Snapshots and projections never expose roots or cursors. */
export function openFoolOwnedEngine(state:SliceState):FoolOwnedEngine {
 const detached=structuredClone(state);
 return retainOwnedEngine(reconstructFool(detached,detached.fool,true));
}
export function snapshotFoolOwnedEngine(handle:FoolOwnedEngine):FoolState {return structuredClone(ownedEngine(handle).root);}
export function advanceFoolOwnedEngine(handle:FoolOwnedEngine,command:FoolCommand,revision:number):FoolOwnedEngine {
 const prepared=forkPreparedFool(ownedEngine(handle));
 requireFool(prepared.root.journal.length<4096,'本章动作记录长度无效。');
 requireFool(revision===prepared.root.source!.revision+2+prepared.root.journal.length,'本次实际修订次序无效。');
 reduce(prepared.root,structuredClone(command),revision,prepared.context);
 return retainOwnedEngine(prepared);
}
export function blockFoolOwnedEngine(handle:FoolOwnedEngine,command:FoolCommand,revision:number):string|null {
 return blockPreparedFool(ownedEngine(handle),structuredClone(command),revision);
}
export function projectFoolOwnedFog(handle:FoolOwnedEngine):ReturnType<FogReplayCursor['project']> {
 const {root,context}=ownedEngine(handle);return structuredClone(context.fogReplay.project(foolFogHost(root)));
}
export function projectFoolOwnedFate(handle:FoolOwnedEngine,revision:number):ReturnType<FoolFateHostReplayCursor['project']> {
 const {root,context}=ownedEngine(handle),cursors=runtimeCursors.get(context)!;
 return structuredClone(cursors.fate.project(foolFateContext(root,revision,'public-view')));
}
