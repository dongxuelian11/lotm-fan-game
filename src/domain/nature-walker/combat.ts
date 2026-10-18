import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicGameDate, PublicCheckResult } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { validCoffinBearerCombatGuard } from '../coffin-bearer/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { NATURE_WALKER_ABILITY_IDS, NATURE_WALKER_INHERITED_ABILITY_IDS, type NatureWalkerOriginals } from './types.js';
import type { NatureWalkerSite, NatureWalkerRootPad, NatureWalkerOperationState } from './life.js';
import { NATURE_WALKER_TARGET_ID, NATURE_WALKER_POWER_IDS, NATURE_WALKER_POWERS, NATURE_WALKER_POLICIES,
  natureWalkerCombatBody as combatBody, hasNatureWalkerDisputeOpponent, validateNatureWalkerPreparation,
  natureWalkerEncounterBudget, natureWalkerFinanceSnapshot, validNatureWalkerSupportPieces, validNatureWalkerEnemyCharges,
  type NatureWalkerCombatBody, type NatureWalkerEnemyIntent, type NatureWalkerPreparation, type NatureWalkerPolicy,
  type NatureWalkerWindow, type NatureWalkerEncounterBudget, type NatureWalkerFinanceSnapshot } from './encounter.js';

/** The count wheel is the bounded S1 design. The six old slots are literal Mother coefficients. */
export const NATURE_WALKER_COUNT_WHEEL: readonly SliceWheelEntry[] = [10,15,25,25,15,10].map((weight,i)=>({id:String(i+1),label:`${i+1}次行动`,weight}));
export const NATURE_WALKER_ENEMY_COUNT_WHEEL=NATURE_WALKER_COUNT_WHEEL;
export function natureWalkerActionCount(roll:number):number {if(!Number.isInteger(roll)||roll<1||roll>100)throw new Error('行动次数检定无效。');let n=roll;for(const[i,row]of NATURE_WALKER_COUNT_WHEEL.entries()){n-=row.weight;if(n<=0)return i+1;}throw new Error('行动次数盘无效。');}
export const natureWalkerEnemyActionCount=natureWalkerActionCount;
export const DORMANCY='mother.s2.bounded-dormancy',ROOT_BUFFER='mother.s2.root-buffer';
export const BODY='STRIKE',FOLLOWUP='BODY_FOLLOWUP',PRESERVATION='mother.s3.finite-preservation',LIFE_SUPPORT='mother.s7.life-support';
export const MATRIX='mother.s4.living-matrix',CAREFUL='mother.s9.careful-practice',SPECIMEN='mother.s6.specimen-study';
export const LIVING_RESPONSE='mother.s1.living-response',ROOT_BEARING='mother.s1.root-bearing';
const MASTERY_IDS=[...NATURE_WALKER_INHERITED_ABILITY_IDS,...NATURE_WALKER_ABILITY_IDS];
export type NatureWalkerMoveId=typeof BODY|typeof FOLLOWUP|typeof ROOT_BUFFER|typeof PRESERVATION|typeof LIFE_SUPPORT|typeof DORMANCY|typeof LIVING_RESPONSE|typeof ROOT_BEARING|'ACCIDENT';
export const NATURE_WALKER_ABILITY_ENTRIES:readonly{id:NatureWalkerMoveId;label:string;weight:number;stance:SliceStance|null}[]=[
 {id:BODY,label:'继承普通近身打击：以实际身体或实持原棍出手',weight:30,stance:'ATTACK'},
 {id:FOLLOWUP,label:'继承细心练习普通侧击：原掌握与实际身体参与',weight:15,stance:'ATTACK'},
 {id:ROOT_BUFFER,label:'继承根系缓冲：需实持原垫，只接下一次普通身体打击',weight:25,stance:'DEFEND'},
 {id:PRESERVATION,label:'继承有限活性保全：耗同一旧护腕真实剩余原段',weight:10,stance:'CONTROL'},
 {id:LIFE_SUPPORT,label:'继承有限生命支持：仅实际恢复才付费，不清旧伤或死亡',weight:15,stance:'PREPARE'},
 {id:'ACCIDENT',label:'实际动作偏差',weight:5,stance:null},
 {id:LIVING_RESPONSE,label:'生机辨应：原活植留在场外，本场只普通观察',weight:20,stance:'ATTACK'},
 {id:ROOT_BEARING,label:'根系承冲：耗实有护片并接触原垫，短暂缓减本人下一次身体或弧光冲击',weight:20,stance:'DEFEND'},
];
export const NATURE_WALKER_ENEMY_ABILITY_WHEEL:readonly SliceWheelEntry[]=[
 {id:'ARC_BOLT',label:'有限弧光：5灵性1刻片，70身体攻击贡献',weight:35},
 {id:'WARD',label:'有限屏护：4灵性，敌方−30',weight:20},
 {id:'BODY_STRIKE',label:'本人手杖打击：20×身体',weight:20},
 {id:'COMPOSE',label:'自主凝神：保持独立意志，抵抗本轮新输入；不取消已有实体护持',weight:10},
 {id:'MENTAL_PRESSURE',label:'有限精神施压：5灵性1刻片，45精神攻击贡献',weight:10},
 {id:'ACCIDENT',label:'动作偏差：−22.5，0灵性',weight:5},
];
export const isNatureWalker=(s:SliceState)=>s.progression.pathwayId==='mother'&&s.progression.sequence===1;
const enabled=(id:NatureWalkerMoveId,p:NatureWalkerPolicy)=>id===LIVING_RESPONSE?p==='ALL'||p==='LIVING_RESPONSE':id===ROOT_BEARING?p==='ALL'||p==='ROOT_BEARING':true;
const tickets=(stance:SliceStance|null,policy:NatureWalkerPolicy)=>NATURE_WALKER_ABILITY_ENTRIES.map(a=>enabled(a.id,policy)?a.weight*(a.stance===stance&&stance!==null?5:4):0);
export function natureWalkerAbilityWheel(s:SliceState,stance:SliceStance|null):SliceWheelEntry[]{const policy=s.natureWalker?.encounter.policy??'ALL',w=tickets(stance,policy),total=w.reduce((a,b)=>a+b,0);return NATURE_WALKER_ABILITY_ENTRIES.flatMap((a,i)=>w[i]?[{id:a.id,label:policy==='ORDINARY'&&a.id!=='ACCIDENT'?'普通身体、格挡或观察，0超凡费用':a.label,weight:w[i]!/total*100}]:[]);}
export function drawNatureWalkerAbility(random:ActionRandomStream,s:SliceState|null,stance:SliceStance|null,policy:NatureWalkerPolicy=s?.natureWalker.encounter.policy??'ALL'):NatureWalkerMoveId{const w=tickets(stance,policy);let n=random.nextInt(1,w.reduce((a,b)=>a+b,0));for(const[i,a]of NATURE_WALKER_ABILITY_ENTRIES.entries()){n-=w[i]!;if(n<=0)return a.id;}throw new Error('行动盘无效。');}
export function drawNatureWalkerEnemyAbility(random:ActionRandomStream):NatureWalkerEnemyIntent{let n=random.nextInt(1,100);for(const a of NATURE_WALKER_ENEMY_ABILITY_WHEEL){n-=a.weight;if(n<=0)return a.id as NatureWalkerEnemyIntent;}throw new Error('对手行动盘无效。');}
const same=(a:unknown,b:unknown)=>a===b||(a!==undefined&&b!==undefined&&stableStringify(a)===stableStringify(b));
const integer=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER):n is number=>Number.isSafeInteger(n)&&(n as number)>=min&&(n as number)<=max;
const shape=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...keys].sort());
const physicalAt=(n:number)=>n>75?1:n>50?.95:n>25?.9:.8;
const factor=(n:number)=>.65+.35*n/500;
export function validNatureWalkerRootPad(p:NatureWalkerRootPad,week:number):boolean{return shape(p,['id','sourceId','material','quantity','owner','holder','location','integrity','acquiredWeek'])&&p.id==='BM2-ROOT-PAD'&&p.sourceId==='BM2-ROOT-FIBRE-STOCK'&&p.material==='PLANT_FIBRE'&&p.quantity===1&&p.owner==='PLAYER'&&p.holder==='PLAYER'&&['START','A','B','OUTSIDE','ANNEX_A','ANNEX_B'].includes(p.location)&&integer(p.integrity,0,65)&&integer(p.acquiredWeek,1,week);}
export interface NatureWalkerCombatSource {
 runId:string;revision:number;week:number;date:PublicGameDate;round:number;encounterId:'NATURE_WALKER_DISPUTE';targetId:typeof NATURE_WALKER_TARGET_ID;
 attemptWeek:number;startHistoryIndex:number;targetName:'伊莱亚斯·沃德';targetAge:45;targetPathway:'original-caster';targetSequence:2;targetCore:27;targetWill:27;maxActionCount:6;
 actualBody:true;independentMind:true;enemyWeapon:'NW1-ELIAS-ROD';weaponOwner:typeof NATURE_WALKER_TARGET_ID;yardId:'NW1-NEIGHBOR-WORKAREA';playerPosition:'ANNEX_A';enemyPosition:'ANNEX_A';enemyDistanceMetres:2;
 ordinaryExit:'OPEN';pursuit:false;thirdPartiesInArea:0;automaticAllyImmunity:false;freeSkillLibrary:false;
 playerHealth:number;playerMind:number;playerSpirituality:number;playerInjuries:SliceInjury[];playerRisk:number;physique:number;perception:number;will:number;knowledge:number;mastery:Record<string,number>;clubHeld:boolean;rootPad:NatureWalkerRootPad;
 preparation:NatureWalkerPreparation;site:NatureWalkerSite;operation:NatureWalkerOperationState;originals:NatureWalkerOriginals;body:NatureWalkerCombatBody;
 budget:NatureWalkerEncounterBudget;finance:NatureWalkerFinanceSnapshot;policy:NatureWalkerPolicy;randomSeed:string;randomCursor:number;
}
export function currentNatureWalkerCombatSource(s:SliceState):NatureWalkerCombatSource|null{
 if(!hasNatureWalkerDisputeOpponent(s))return null;const e=s.natureWalker.encounter,c=s.combat!,l=s.natureWalker.life,originals=s.natureWalker.sourceScene?.originals;
 if(!e.preparation||!l.site||!l.rootPad||!originals)return null;
 return {runId:s.runId,revision:s.revision,week:s.week,date:{...s.date},round:c.round,encounterId:'NATURE_WALKER_DISPUTE',targetId:NATURE_WALKER_TARGET_ID,
 attemptWeek:e.attemptWeek!,startHistoryIndex:e.startHistoryIndex!,targetName:'伊莱亚斯·沃德',targetAge:45,targetPathway:'original-caster',targetSequence:2,targetCore:27,targetWill:27,maxActionCount:6,
 actualBody:true,independentMind:true,enemyWeapon:'NW1-ELIAS-ROD',weaponOwner:NATURE_WALKER_TARGET_ID,yardId:'NW1-NEIGHBOR-WORKAREA',playerPosition:'ANNEX_A',enemyPosition:e.enemyPosition,enemyDistanceMetres:2,
 ordinaryExit:'OPEN',pursuit:false,thirdPartiesInArea:0,automaticAllyImmunity:false,freeSkillLibrary:false,playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,playerInjuries:structuredClone(s.injuries),playerRisk:s.injuryRisk,
 ...s.character.coreStats,mastery:{...s.progression.mastery},clubHeld:s.town.clubLocation==='HAND',rootPad:structuredClone(l.rootPad),preparation:structuredClone(e.preparation),site:structuredClone(l.site),operation:structuredClone(l.operation),originals:structuredClone(originals),body:combatBody(e),budget:natureWalkerEncounterBudget(s),finance:natureWalkerFinanceSnapshot(s),policy:e.policy,randomSeed:s.random.seed,randomCursor:s.random.cursor};
}
/** Only already paid physical protections exist here; no future roll or hidden intention is read. */
export interface NatureWalkerPendingEffect {id:string;owner:'PLAYER';kind:'ROOT_BUFFER'|'MATRIX'|'PRESERVE';createdAt:number;expiresAt:number;remaining:1|2;guardSegmentId:string|null}
export interface NatureWalkerActionEvidence {
  order: number; actor: 'PLAYER' | 'ENEMY'; id: string; planned: string; selectedAbility: string; fallbackReason: string | null; mode: string; label: string;
  selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean; attackKind: 'NONE' | 'BODY' | 'ARC' | 'MIND'; rawContribution: number; rawReduction: number;
  paidCost: number; mindCost: number; physicalFactor: number; check: PublicCheckResult | null; succeeded: boolean; resisted: boolean;
  pendingBefore: NatureWalkerPendingEffect[]; pendingAfter: NatureWalkerPendingEffect[]; pendingApplied: string[]; masteryApplied: string[];
  rootPadBefore: NatureWalkerRootPad; rootPadAfter: NatureWalkerRootPad; padWear: 0 | 15; guardSegmentId: string | null;
  atSeconds: number; elapsedSeconds: 5; travelMetres: number; randomCursorBefore: number; randomCursorAfter: number;
  playerHealthBefore:number;playerHealthAfter:number;recoveredHealth:number;distanceBeforeMetres:2;contactDistanceMetres:0|2;distanceAfterMetres:2;
  playerMindAfter: number; playerSpiritualityAfter: number; enemySpiritualityAfter: number;
  windowGranted:NatureWalkerWindow|null; windowsApplied:{kind:NatureWalkerWindow['kind'];amount:number;supportId:string}[]; windowsExpired:NatureWalkerWindow[]; windowsCancelled:NatureWalkerWindow[];
  supportId:string|null;supportWearPaid:0|1;enemyChargeId:string|null;resistanceChance:number|null;resistanceRoll:number|null;
}
export interface NatureWalkerRuntime {
  body: NatureWalkerCombatBody; root: NatureWalkerSite; playerH:number; playerS: number; playerM: number; rootPad: NatureWalkerRootPad;
  mastery: Record<string, number>; pending: NatureWalkerPendingEffect[]; expired: NatureWalkerPendingEffect[]; expiredWindows:NatureWalkerWindow[];
}
export function createNatureWalkerRuntime(x: NatureWalkerCombatSource): NatureWalkerRuntime {
  return { body: structuredClone(x.body), root: structuredClone(x.site), playerH:x.playerHealth, playerS: x.playerSpirituality, playerM: x.playerMind,
    rootPad: structuredClone(x.rootPad), mastery: { ...x.mastery }, pending: [], expired: [], expiredWindows: [] };
}
function syncPending(r:NatureWalkerRuntime):void {r.body.pendingKind=r.pending[0]?.kind??null;}
export function advanceNatureWalkerCombatClock(r:NatureWalkerRuntime,seconds:number):void {
 if(!integer(seconds))throw new Error('实际时间无效。');r.root.clockSeconds+=seconds;r.root.externalSeconds+=seconds;
 for(const key of ['livingResponse','rootBearing'] as const){const w=r.body[key];if(w&&w.expiresAt<=r.root.clockSeconds){r.expiredWindows.push(structuredClone(w));r.body[key]=null;}}
 r.expired.push(...r.pending.filter(p=>p.expiresAt<=r.root.clockSeconds));r.pending=r.pending.filter(p=>p.expiresAt>r.root.clockSeconds);syncPending(r);
}
function baseAction(x: NatureWalkerCombatSource, r: NatureWalkerRuntime, actor: 'PLAYER' | 'ENEMY', id: string, order: number, random: ActionRandomStream): NatureWalkerActionEvidence {
  return { actor, id, planned: id, selectedAbility: id, fallbackReason: null, order, mode: 'OBSERVE', label: '', selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false,
    attackKind: 'NONE', rawContribution: 0, rawReduction: 0, paidCost: 0, mindCost: 0, physicalFactor: physicalAt(actor === 'PLAYER' ? r.playerH : x.body.enemyHealth), check: null, succeeded: false, resisted: false,
    pendingBefore: structuredClone(r.pending), pendingAfter: [], pendingApplied: [], masteryApplied: [], 
    rootPadBefore: structuredClone(r.rootPad), rootPadAfter: structuredClone(r.rootPad), padWear: 0, guardSegmentId:null, playerHealthBefore:r.playerH,playerHealthAfter:r.playerH,recoveredHealth:0,distanceBeforeMetres:2,contactDistanceMetres:2,distanceAfterMetres:2, atSeconds: r.root.clockSeconds, elapsedSeconds: 5, travelMetres: 0,
    randomCursorBefore: random.cursor, randomCursorAfter: random.cursor, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, enemySpiritualityAfter: r.body.enemySpirituality,windowGranted:null,windowsApplied:[],windowsExpired:[],windowsCancelled:[],supportId:null,supportWearPaid:0,enemyChargeId:null,resistanceChance:null,resistanceRoll:null };
}
function gainMastery(r: NatureWalkerRuntime, a: NatureWalkerActionEvidence, id: string): void { r.mastery[id] = Math.min(500, (r.mastery[id] ?? 0) + 8); a.masteryApplied.push(id); }
function closeAction(a: NatureWalkerActionEvidence, r: NatureWalkerRuntime, random: ActionRandomStream) {
  const expiredBefore=r.expiredWindows.length; advanceNatureWalkerCombatClock(r, 5); a.windowsExpired.push(...structuredClone(r.expiredWindows.slice(expiredBefore))); a.pendingAfter = structuredClone(r.pending); a.rootPadAfter = structuredClone(r.rootPad);
  a.randomCursorAfter = random.cursor; a.playerHealthAfter=r.playerH; a.playerMindAfter = r.playerM; a.playerSpiritualityAfter = r.playerS; a.enemySpiritualityAfter = r.body.enemySpirituality;
  a.label += ` 实际用时5秒；本人灵性${r.playerS}、精神${r.playerM}，伊莱亚斯灵性${r.body.enemySpirituality}。`; return a;
}
function pending(x:NatureWalkerCombatSource,r:NatureWalkerRuntime,a:NatureWalkerActionEvidence,kind:NatureWalkerPendingEffect['kind']):NatureWalkerPendingEffect{return {id:`${x.runId}:natureWalker:${x.round}:${a.order}:${kind}`,owner:'PLAYER',kind,createdAt:r.root.clockSeconds,expiresAt:kind==='ROOT_BUFFER'?r.root.clockSeconds+30:x.site.clockSeconds+60,remaining:kind==='PRESERVE'?2:1,guardSegmentId:a.guardSegmentId};}
function take(r:NatureWalkerRuntime,a:NatureWalkerActionEvidence,e:NatureWalkerPendingEffect):void {a.pendingApplied.push(e.id);if(e.remaining===2)e.remaining=1;else r.pending=r.pending.filter(p=>p.id!==e.id);}
const heldPad=(r:NatureWalkerRuntime)=>r.rootPad.owner==='PLAYER'&&r.rootPad.holder==='PLAYER'&&r.rootPad.location==='ANNEX_A'&&r.rootPad.integrity>=15;
function resolveNewWindow(x:NatureWalkerCombatSource,r:NatureWalkerRuntime,id:typeof LIVING_RESPONSE|typeof ROOT_BEARING,a:NatureWalkerActionEvidence,random:ActionRandomStream):NatureWalkerActionEvidence {
 if(id===LIVING_RESPONSE){a.selectedAbility='ORDINARY_OBSERVE';a.fallbackReason='NO_ORIGINAL_LIVING_PLANT_CARE_EVENT';a.label='原活植与同一照料记录实际留在场外，本场没有可辨应的原植照料事件；只普通观察，不花灵性、精神或护片，不获得身体加成。';return closeAction(a,r,random);}
 const piece=r.body.supportPieces.find(p=>p.status==='HELD');
 if(!enabled(id,x.policy)||x.policy==='ORDINARY'){a.fallbackReason='POLICY';a.label='当前策略保留本术与材料，只普通防备。';}
 else if(r.body.rootBearing){a.fallbackReason='ACTIVE_WINDOW';a.label='同一根系承冲仍待使用，不叠加、续期或重复付费。';}
 else if(!heldPad(r)){a.fallbackReason='INSUFFICIENT_ACTUAL_PAD';a.label='没有实持足够完整的同一原根垫，只普通防备，不付费或耗片。';}
 else if(!piece||r.playerS<8||r.playerM<4){a.fallbackReason='INSUFFICIENT_RESOURCES';a.label='实有护片、灵性或精神不足，只普通防备，不透支或补物资。';}
 else {
  a.mode='ROOT_BEARING';a.paidCost=8;a.mindCost=2;r.playerS-=8;r.playerM-=2;piece.status='SPENT';piece.wear=1;piece.usedRound=x.round;piece.usedOrder=a.order;a.supportId=piece.id;a.supportWearPaid=1;r.body.rootBearingAttempts++;
  a.check=resolveNormalCheck({ability:'will',baseAbility:x.will,difficulty:18,modifiers:[],roll:random.nextInt(1,100)});a.succeeded=['SUCCESS','GREAT_SUCCESS'].includes(a.check.tier);
  if(a.succeeded){a.resistanceChance=Math.min(95,Math.max(5,35+x.targetWill));a.resistanceRoll=random.nextInt(1,100);a.resisted=r.body.composureReady||a.resistanceRoll<=a.resistanceChance;a.succeeded=!a.resisted;}
  if(!a.succeeded){a.mindCost=4;r.playerM-=2;a.label=`${a.resisted?'伊莱亚斯以独立意志抵抗本次输入':'施术检定失败'}；实际损失8灵性、4精神与一枚护片，没有建立护持。`;}
  else {const w:NatureWalkerWindow={kind:'ROOT_BEARING',round:x.round,order:a.order,castAt:r.root.clockSeconds,expiresAt:r.root.clockSeconds+20,remaining:1,supportId:piece.id};r.body.rootBearing=w;a.windowGranted=structuredClone(w);a.label='实付8灵性、2精神与一枚护片，亲接原根垫形成短暂承冲；只等本人下一次可见身体或弧光冲击，实际应用才磨损原垫，精神冲击无效。';}
 }
 return closeAction(a,r,random);
}
function inheritedGuard(x: NatureWalkerCombatSource, r: NatureWalkerRuntime, a: NatureWalkerActionEvidence, preserve: boolean, random: ActionRandomStream): void {
  const id = preserve ? PRESERVATION : MATRIX, cost = preserve ? 5 : 4, guard = r.root.guard;
  const segment = guard.prepared && guard.owner === 'PLAYER' && guard.location === 'HAND' ? guard.segments.find(g => g.status === 'UNUSED') : undefined;
  a.selectedAbility = id;
  if (r.pending.length) { a.fallbackReason = 'ALREADY_PENDING'; a.label = '已有待用实体护持，本次普通防备，不叠加、续期或再次耗段。'; }
  else if (!segment || r.playerS < cost) {
    a.selectedAbility = 'ORDINARY_GUARD'; a.fallbackReason = !segment ? 'NO_REMAINING_ORIGINAL_SEGMENT' : 'INSUFFICIENT_RESOURCES';
    a.enemyReduction = preserve ? 6 * a.physicalFactor : 42.25 * factor(x.mastery[SPECIMEN] ?? 0) * a.physicalFactor;
    a.label = preserve ? '没有真实剩余旧段或不足5灵性，只普通走位6×身体，不补段、不造保全。' : '没有真实剩余旧段或不足4灵性，只用继承样本观察护身42.25×原掌握×身体，不补段。';
  } else {
    r.playerS -= cost; a.paidCost = cost; segment.status = 'SPENT'; a.guardSegmentId = segment.id; a.mode = preserve ? 'PRESERVE' : 'MATRIX';
    if (preserve) r.body.preservationAttempts++; else r.body.guardAttempts++;
    a.check = resolveNormalCheck({ ability: 'knowledge', baseAbility: x.knowledge, difficulty: preserve ? 20 : 18, modifiers: [], roll: random.nextInt(1, 100) });
    a.succeeded = preserve ? ['SUCCESS', 'GREAT_SUCCESS'].includes(a.check.tier) : a.check.roll <= a.check.chance;
    if (a.succeeded) r.pending.push(pending(x, r, a, preserve ? 'PRESERVE' : 'MATRIX'));
    a.label = `同一旧护腕${guard.id}的真实剩余段${segment.id}变为惰性原物，实付${cost}灵性、知识${preserve ? 20 : 18}检定${a.check.roll}/${a.check.chance}；${a.succeeded ? `本轮后续最多${preserve ? '两' : '一'}次正身体或弧光贡献×${preserve ? '0.8' : '0.6'}` : '失败，段与费用不退'}。所有更早已耗段保持原样，不补货、不清死亡风险。`;
  }
}
/** Checks draw only at the actual slot; the plant-only ability never targets a human. */
export function resolveNatureWalkerPlayerSlot(x: NatureWalkerCombatSource, r: NatureWalkerRuntime, id: NatureWalkerMoveId, order: number, random: ActionRandomStream): NatureWalkerActionEvidence {
  const a = baseAction(x, r, 'PLAYER', id, order, random);
  if(id===LIVING_RESPONSE||id===ROOT_BEARING)return resolveNewWindow(x,r,id,a,random);
  if(x.policy==='ORDINARY'&&id!=='ACCIDENT'){a.selectedAbility='ORDINARY';if(id===BODY||id===FOLLOWUP){a.mode='BODY';a.attackKind='BODY';a.selfGain=(id===BODY?x.clubHeld?16:12:8.4*factor(x.mastery[CAREFUL]??0))*a.physicalFactor;a.rawContribution=a.selfGain;a.threatens=a.selfGain>0;a.travelMetres=4;a.contactDistanceMetres=0;r.root.playerTravelMetres+=4;}else{a.mode='OBSERVE';}a.label='按当前策略只作普通身体动作或观察，原段、原垫和灵性均不消耗。';return closeAction(a,r,random);}
  if (id === 'ACCIDENT') { a.mode = 'ACCIDENT'; a.selfGain = -22.5; a.label = '此次动作偏差，贡献−22.5。'; }
  else if (id === BODY || id === FOLLOWUP) {
    a.mode = 'BODY'; a.attackKind = 'BODY'; a.selfGain = (id === BODY ? x.clubHeld ? 16 : 12 : 8.4 * factor(x.mastery[CAREFUL] ?? 0)) * a.physicalFactor;
    a.label = id === BODY ? '继承普通近身打击，实际使用自己的身体或持握原短棍。' : '继承细心练习普通侧击，仅8.4×原掌握系数×身体。';
    a.travelMetres = 4; a.contactDistanceMetres=0; r.root.playerTravelMetres += 4; a.threatens = a.selfGain > 0;
  } else if (id === DORMANCY) {
    a.selectedAbility = 'OBSERVE'; a.fallbackReason = 'HUMAN_IS_NOT_A_LIVING_PLANT'; a.label = '伊莱亚斯是独立成人，有限休眠仅适用实际原活植物；本次普通观察，0消耗，不催眠、控制或停住人类。';
  } else if (id === ROOT_BUFFER) {
    if (r.pending.length) { a.fallbackReason = 'ALREADY_PENDING'; a.label = '已有待用实体护持，本次普通防备；不叠加、续期或磨损。'; }
    else if (r.playerS >= 6 && r.playerM >= 1 && heldPad(r)) {
      r.playerS -= 6; r.playerM--; a.paidCost = 6; a.mindCost = 1; r.body.rootBufferAttempts++; a.mode = 'ROOT_BUFFER';
      a.check = resolveNormalCheck({ ability: 'will', baseAbility: x.will, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) }); a.succeeded = ['SUCCESS', 'GREAT_SUCCESS'].includes(a.check.tier);
      if (a.succeeded) r.pending.push(pending(x, r, a, 'ROOT_BUFFER'));
      a.label = `根系缓冲实付6灵性1精神，意志20检定${a.check.roll}/${a.check.chance}；${a.succeeded ? '同一实持根纤维垫预备30秒，下一次普通身体打击最多减45并磨损15' : '失败，费用不退'}。施术不修复原垫，不防精神施压或弧光。`;
    } else { inheritedGuard(x, r, a, false, random); a.fallbackReason ??= 'NEW_RESOURCES_OR_ROOT_PAD_UNAVAILABLE'; a.label = '新根垫或资源条件不足。' + a.label; }
  } else if (id === PRESERVATION) inheritedGuard(x, r, a, true, random);
  else if (id === LIFE_SUPPORT) {
    a.mode = 'LIFE_SUPPORT';
    if (r.playerH >= 100 || r.playerH <= 0 || r.playerS < 4) { a.selectedAbility = 'ORDINARY_CARE'; a.fallbackReason = r.playerH >= 100 ? 'NO_ACTUAL_HEALTH_TO_RESTORE' : 'INSUFFICIENT_RESOURCES'; a.label = '没有可恢复的实际健康或不足4灵性，只普通照看，不付费、不凭空恢复。'; }
    else { a.recoveredHealth = Math.min(100 - r.playerH, Math.floor(15 * factor(x.mastery[LIFE_SUPPORT] ?? 0))); r.playerS -= 4; a.paidCost = 4; r.playerH += a.recoveredHealth;
      a.label = `继承有限生命支持实付4灵性，floor(15×原掌握)实际恢复${a.recoveredHealth}健康；战势0，不清原伤、累计风险或污染，不恢复精神、不复活。`; }
  } else throw new Error('行动盘无效。');
  a.rawContribution = a.selfGain; a.rawReduction = a.enemyReduction; syncPending(r); return closeAction(a, r, random);
}
export function resolveNatureWalkerEnemySlot(x:NatureWalkerCombatSource,r:NatureWalkerRuntime,planned:NatureWalkerEnemyIntent,order:number,random:ActionRandomStream):NatureWalkerActionEvidence {
 const a=baseAction(x,r,'ENEMY',planned,order,random),b=r.body,p=NATURE_WALKER_POWERS.find(v=>v.id===planned),charged=planned==='ARC_BOLT'||planned==='MENTAL_PRESSURE',charge=b.enemyCharges.find(c=>c.status==='HELD');
 if(planned==='ACCIDENT'){a.mode='ACCIDENT';a.selfGain=-22.5;a.label='伊莱亚斯此次动作偏差。';}
 else if(p&&b.enemySpirituality>=p.cost&&(!charged||charge)){
  if(charged&&charge){charge.status='SPENT';charge.usedRound=x.round;charge.usedOrder=order;a.enemyChargeId=charge.id;}
  a.mode=p.id;a.paidCost=p.cost;b.enemySpirituality-=p.cost;b.powerUses[p.id]++;a.selfGain=p.selfGain;a.enemyReduction=p.enemyReduction;
  if(p.id==='ARC_BOLT'){a.attackKind='ARC';a.threatens=true;a.label='伊莱亚斯实际耗灵性和一枚有限原刻片发出弧光，形成身体冲击；旧根缓冲不能挡此法术。';}
  else if(p.id==='MENTAL_PRESSURE'){a.attackKind='MIND';a.mentalPressure=true;a.label='伊莱亚斯实际耗灵性和一枚有限原刻片施压，只有精神后果；根垫与旧护腕不能挡住。';}
  else if(p.id==='COMPOSE'){b.composureReady=true;a.label='伊莱亚斯实际付费自主凝神，抵抗本轮新的输入；已经实际形成的根垫与旧护腕护持不被凭空取消。';}
  else a.label='伊莱亚斯实付灵性施展自己的有限屏护，保持独立防御。';
 }else{a.id=a.selectedAbility='BODY_STRIKE';a.mode='BODY';a.fallbackReason=p?charged&&!charge?'NO_ACTUAL_ENEMY_CHARGE':'INSUFFICIENT_ENEMY_SPIRITUALITY':null;a.attackKind='BODY';a.threatens=true;a.selfGain=20*a.physicalFactor;a.travelMetres=4;a.contactDistanceMetres=0;b.enemyTravelMetres+=4;a.label='伊莱亚斯持唯一原杖走近两米击打，再退回两米；不付原法术费、不重抽行动。';}
 a.rawContribution=a.selfGain;a.rawReduction=a.enemyReduction;
 const effect=r.pending[0];
 if(effect&&effect.kind!=='ROOT_BUFFER'&&(a.attackKind==='BODY'||a.attackKind==='ARC')&&a.selfGain>0){a.selfGain*=effect.kind==='PRESERVE'?.8:.6;take(r,a,effect);a.label+=' 已经实耗旧段的实体护持缓减这次冲击，并扣除一次待用机会。';}
 else if(effect?.kind==='ROOT_BUFFER'&&a.attackKind==='BODY'&&a.selfGain>0&&heldPad(r)){a.selfGain=Math.max(0,a.selfGain-45);r.rootPad.integrity-=15;a.padWear=15;take(r,a,effect);gainMastery(r,a,ROOT_BUFFER);b.rootBufferApplications++;a.label+=' 同一原根垫实际接住此次普通身体打击，原垫磨损，旧根缓冲至此用尽。';}
 const bearing=b.rootBearing;
 if(bearing&&(a.attackKind==='BODY'||a.attackKind==='ARC')&&a.selfGain>0&&heldPad(r)&&a.padWear===0){const amount=Math.min(30,a.selfGain);a.selfGain-=amount;r.rootPad.integrity-=15;a.padWear=15;a.windowsApplied.push({kind:'ROOT_BEARING',amount,supportId:bearing.supportId});gainMastery(r,a,ROOT_BEARING);b.rootBearingApplications++;b.rootBearing=null;a.label+=' 根系承冲此时缓减本人这一次可见冲击，原垫实际磨损；一次冲击不会重复用垫，此刻才获得本术掌握。';}
 if(a.attackKind==='BODY'||a.attackKind==='ARC')a.threatens=a.selfGain>0;
 syncPending(r);return closeAction(a,r,random);
}
export interface NatureWalkerRoundOutcome extends NatureWalkerCombatBody {
  targetId: typeof NATURE_WALKER_TARGET_ID; round: number; source: NatureWalkerCombatSource; stance: SliceStance; continuing: boolean;
  playerHealthAfter: number; playerMindAfter: number; playerSpiritualityAfter: number; playerInjuriesAfter: SliceInjury[]; playerRiskAfter: number; rootPadAfter: NatureWalkerRootPad; masteryAfter: Record<string, number>;
  siteAfter: NatureWalkerSite; operationAfter:NatureWalkerOperationState; elapsedSeconds: 0 | 60; randomCursorAfter: number; playerActions: NatureWalkerActionEvidence[]; enemyActions: NatureWalkerActionEvidence[]; expiredPending: NatureWalkerPendingEffect[]; expiredWindows:NatureWalkerWindow[]; cancelledWindows:NatureWalkerWindow[];
}
export type NatureWalkerResolution = 'CONTINUE' | 'PLAYER_DEAD' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED' | 'RETREATED';
function penalty(n: number, max: number) { const f = n / max; return f > .75 ? 0 : f > .5 ? .05 : f > .25 ? .1 : .2; }
function base(core: number, h: number, m: number, s: number, maxS = 120) { return (1250 + Math.min(core, 250)) * (1 - Math.min(.4, penalty(h, 100) + penalty(m, 100) + penalty(s, maxS))); }
function weights(risk: number) { const death = Math.min(100, 5 + Math.min(risk, 10) * 10), shifted = death - 5; return { light: Math.max(0, 65 - shifted), heavy: Math.max(0, 30 - Math.max(0, shifted - 65)), death }; }
function validWindow(w:NatureWalkerWindow|null,kind:NatureWalkerWindow['kind'],b:NatureWalkerCombatBody,maxRound:number):boolean{
 return w===null||shape(w,['kind','round','order','castAt','expiresAt','remaining','supportId'])&&w.kind===kind&&integer(w.round,1,maxRound)&&integer(w.order,0,11)&&integer(w.castAt)&&w.expiresAt===w.castAt+20&&w.remaining===1&&b.supportPieces.some(p=>p.id===w.supportId&&p.status==='SPENT'&&p.usedRound===w.round&&p.usedOrder===w.order);
}
export function validNatureWalkerBody(b:NatureWalkerCombatBody,maxRound=Number.MAX_SAFE_INTEGER):boolean{
 return integer(b.enemyHealth,0,100)&&integer(b.enemyMind,0,100)&&integer(b.enemySpirituality,0,100)&&integer(b.enemyRisk)&&Array.isArray(b.enemyInjuries)&&
 ['RESISTING','SURRENDERED','DEAD'].includes(b.enemyStatus)&&(b.enemyStatus==='DEAD')===(b.enemyHealth===0)&&b.weaponLocation===(b.enemyStatus==='DEAD'?'ANNEX_A':'HAND')&&
 shape(b.powerUses,NATURE_WALKER_POWER_IDS)&&NATURE_WALKER_POWER_IDS.every(id=>integer(b.powerUses[id],0,maxRound*6))&&b.enemySpirituality===100-NATURE_WALKER_POWERS.reduce((n,p)=>n+p.cost*b.powerUses[p.id],0)&&
 b.pendingKind===null&&b.composureReady===false&&b.livingResponse===null&&validWindow(b.rootBearing,'ROOT_BEARING',b,maxRound)&&[b.rootBufferAttempts,b.rootBufferApplications,b.guardAttempts,b.preservationAttempts,b.livingResponseAttempts,b.rootBearingAttempts,b.livingResponseApplications,b.rootBearingApplications,b.enemyTravelMetres].every(n=>integer(n))&&
 validNatureWalkerSupportPieces(b.supportPieces,b.supportPieces.length>0)&&validNatureWalkerEnemyCharges(b.enemyCharges)&&b.enemyCharges.filter(c=>c.status==='SPENT').length===b.powerUses.ARC_BOLT+b.powerUses.MENTAL_PRESSURE&&
 b.supportPieces.filter(c=>c.status==='SPENT').length===b.livingResponseAttempts+b.rootBearingAttempts&&b.livingResponseApplications===0&&b.livingResponseAttempts===0&&b.rootBearingApplications<=b.rootBearingAttempts&&b.rootBufferApplications<=b.rootBufferAttempts;
}
export function validNatureWalkerInjuries(injuries:SliceInjury[],revision:number):boolean{return Array.isArray(injuries)&&new Set(injuries.map(i=>i.id)).size===injuries.length&&injuries.every(i=>shape(i,['id','severity','acquiredRevision','treatedRevision'])&&typeof i.id==='string'&&!!i.id&&['LIGHT','HEAVY'].includes(i.severity)&&integer(i.acquiredRevision,0,revision)&&(i.treatedRevision===null||integer(i.treatedRevision,i.acquiredRevision,revision)));}
const SOURCE_KEYS=['runId','revision','week','date','round','encounterId','targetId','attemptWeek','startHistoryIndex','targetName','targetAge','targetPathway','targetSequence','targetCore','targetWill','maxActionCount','actualBody','independentMind','enemyWeapon','weaponOwner','yardId','playerPosition','enemyPosition','enemyDistanceMetres','ordinaryExit','pursuit','thirdPartiesInArea','automaticAllyImmunity','freeSkillLibrary','playerHealth','playerMind','playerSpirituality','playerInjuries','playerRisk','physique','perception','will','knowledge','mastery','clubHeld','rootPad','preparation','site','operation','originals','body','budget','finance','policy','randomSeed','randomCursor'];
export function validNatureWalkerCombatSource(x:NatureWalkerCombatSource):boolean{try{
 const p=x.site,prep=x.preparation,expected=structuredClone(prep.site);expected.playerLocation='ANNEX_A';expected.clockSeconds=p.clockSeconds;expected.externalSeconds=p.externalSeconds;expected.playerTravelMetres=p.playerTravelMetres;expected.guard=structuredClone(p.guard);
 const budget={...prep.after,actions:prep.after.actions-2,health:x.playerHealth,mind:x.playerMind,spirituality:x.playerSpirituality,mastery:x.mastery,injuries:x.playerInjuries,injuryRisk:x.playerRisk};
 return shape(x,SOURCE_KEYS)&&shape(x.body,Object.keys(combatBody(x.body)))&&validateNatureWalkerPreparation(prep)&&typeof x.runId==='string'&&!!x.runId&&integer(x.revision)&&integer(x.week,1)&&integer(x.round,1)&&integer(x.startHistoryIndex)&&x.attemptWeek===x.week&&x.week===prep.week&&same(x.date,prep.date)&&
 x.encounterId==='NATURE_WALKER_DISPUTE'&&x.targetId===NATURE_WALKER_TARGET_ID&&x.targetName==='伊莱亚斯·沃德'&&x.targetAge===45&&x.targetPathway==='original-caster'&&x.targetSequence===2&&x.targetCore===27&&x.targetWill===27&&x.maxActionCount===6&&
 x.actualBody===true&&x.independentMind===true&&x.enemyWeapon==='NW1-ELIAS-ROD'&&x.weaponOwner===NATURE_WALKER_TARGET_ID&&x.yardId==='NW1-NEIGHBOR-WORKAREA'&&x.playerPosition==='ANNEX_A'&&x.enemyPosition==='ANNEX_A'&&x.enemyDistanceMetres===2&&
 x.ordinaryExit==='OPEN'&&x.pursuit===false&&x.thirdPartiesInArea===0&&x.automaticAllyImmunity===false&&x.freeSkillLibrary===false&&[x.playerHealth,x.playerMind].every(n=>integer(n,1,100))&&integer(x.playerSpirituality,0,120)&&
 [x.physique,x.perception,x.will,x.knowledge].every(n=>integer(n,0,500))&&same({physique:x.physique,perception:x.perception,will:x.will,knowledge:x.knowledge},prep.after.coreStats)&&shape(x.mastery,MASTERY_IDS)&&Object.values(x.mastery).every(n=>integer(n,0,500))&&typeof x.clubHeld==='boolean'&&integer(x.playerRisk)&&validNatureWalkerInjuries(x.playerInjuries,x.revision)&&validNatureWalkerInjuries(x.body.enemyInjuries,x.revision)&&
 validNatureWalkerRootPad(x.rootPad,x.week)&&x.rootPad.location==='ANNEX_A'&&x.rootPad.integrity===prep.rootPad.integrity-15*(x.body.rootBufferApplications+x.body.rootBearingApplications)&&same({...x.rootPad,location:prep.rootPad.location,integrity:prep.rootPad.integrity},prep.rootPad)&&same(p,expected)&&p.clockSeconds===prep.lifeClockSeconds+4+60*(x.round-1)&&p.externalSeconds===prep.site.externalSeconds+4+60*(x.round-1)&&integer(p.playerTravelMetres,prep.site.playerTravelMetres+4)&&
 p.owner.id==='CB3-ADA'&&p.owner.age===46&&p.owner.alive&&p.owner.location==='OUTSIDE'&&p.recipient.id==='CB3-LENA'&&p.recipient.age===39&&p.recipient.alive&&p.recipient.location==='OUTSIDE'&&[p.paper,p.box,p.tag,...p.pads].every(item=>item.holder==='OWNER'&&item.location==='OUTSIDE')&&p.samples.every(sample=>sample.location==='OUTSIDE')&&
 validCoffinBearerCombatGuard(p.guard)&&same({...p.guard,segments:prep.site.guard.segments},prep.site.guard)&&prep.site.guard.segments.every((segment,i)=>segment.status==='UNUSED'||p.guard.segments[i]!.status===segment.status)&&p.guard.segments.filter(segment=>segment.status==='SPENT').length===prep.site.guard.segments.filter(segment=>segment.status==='SPENT').length+x.body.guardAttempts+x.body.preservationAttempts&&
 same(x.operation,prep.operation)&&same(x.originals,prep.originals)&&same(x.budget,budget)&&same(x.finance,prep.finance)&&validNatureWalkerBody(x.body,x.round-1)&&x.body.enemyStatus==='RESISTING'&&x.body.enemyMind>0&&[x.body.livingResponse,x.body.rootBearing].every(w=>!w||w.castAt<=p.clockSeconds&&w.expiresAt>p.clockSeconds)&&NATURE_WALKER_POLICIES.includes(x.policy)&&
 typeof x.randomSeed==='string'&&!!x.randomSeed&&integer(x.randomCursor)&&prep.runId===x.runId&&prep.randomSeed===x.randomSeed&&prep.randomCursor<=x.randomCursor&&prep.revision<x.revision;
}catch{return false;}}
export function replayNatureWalkerCombatRound(x: NatureWalkerCombatSource, stance: SliceStance): { round: SliceCombatRound; outcome: NatureWalkerResolution } {
  if (!validNatureWalkerCombatSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new Error('缺少真实原来源。');
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = createNatureWalkerRuntime(x), b = r.body;
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = natureWalkerActionCount(playerCountRoll), enemyCount = natureWalkerEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: NatureWalkerActionEvidence[] = [], enemies: NatureWalkerActionEvidence[] = [], remaining = { PLAYER: playerCount, ENEMY: enemyCount }; let retreat: SliceCombatRound['retreat'] = 'NONE';
  if(stance==='RETREAT'){retreat='SUCCESS';remaining.PLAYER=0;remaining.ENEMY=0;}
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) for (const actor of order) {
    if (!remaining[actor]) continue;
    remaining[actor]--; const index = players.length + enemies.length;
    if (actor === 'PLAYER') players.push(resolveNatureWalkerPlayerSlot(x, r, drawNatureWalkerAbility(rng, null, stance, x.policy), index, rng)); else enemies.push(resolveNatureWalkerEnemySlot(x, r, drawNatureWalkerEnemyAbility(rng), index, rng));
  }
  const sum = (a: NatureWalkerActionEvidence[], key: 'selfGain' | 'enemyReduction') => a.reduce((n, v) => n + v[key], 0);
  const playerAdvantage = Math.max(125, base(x.physique * .20 + x.perception * .15 + x.will * .20 + x.knowledge * .45, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, base(x.targetCore, x.body.enemyHealth, x.body.enemyMind, x.body.enemySpirituality, 100) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction'));
  const winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100, winner = retreat === 'SUCCESS' ? 'ENEMY' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  let playerHealth = r.playerH, playerRisk = x.playerRisk, outcome: NatureWalkerResolution = retreat === 'SUCCESS' ? 'RETREATED' : 'CONTINUE';
  const playerInjuries = structuredClone(x.playerInjuries); let consequenceWeights: SliceCombatRound['consequenceWeights'] = null, consequenceRoll: number | undefined, consequenceDomain: SliceCombatRound['consequenceDomain'];
  if (retreat !== 'SUCCESS') {
    const loser = winner === 'PLAYER' ? 'ENEMY' : 'PLAYER', attacks = loser === 'PLAYER' ? enemies : players, injuries = loser === 'PLAYER' ? playerInjuries : b.enemyInjuries;
    if (attacks.some(a => a.threatens && (a.attackKind === 'BODY' || a.attackKind === 'ARC'))) {
      let risk = loser === 'PLAYER' ? playerRisk : b.enemyRisk; if (injuries.length) risk++; if (loser === 'PLAYER') playerRisk = risk; else b.enemyRisk = risk;
      consequenceDomain = 'BODY'; consequenceWeights = weights(risk); consequenceRoll = rng.nextInt(1, 100);
      const severity = consequenceRoll <= consequenceWeights.light ? 'LIGHT' : consequenceRoll <= consequenceWeights.light + consequenceWeights.heavy ? 'HEAVY' : 'DEATH';
      if (severity === 'DEATH') { if (loser === 'PLAYER') playerHealth = 0; else { b.enemyHealth = 0; b.enemyStatus = 'DEAD'; } }
      else { injuries.push({ id: `${x.runId}:combat:${x.round}:${loser}:${x.revision + 1}:${injuries.length}`, severity, acquiredRevision: x.revision + 1, treatedRevision: null });
        const damage = severity === 'LIGHT' ? 10 : 30; if (loser === 'PLAYER') playerHealth = Math.max(0, playerHealth - damage); else b.enemyHealth = Math.max(0, b.enemyHealth - damage);
        if (b.enemyHealth === 0) b.enemyStatus = 'DEAD'; else if (loser === 'ENEMY' && severity === 'HEAVY') b.enemyStatus = 'SURRENDERED'; }
    } else if (attacks.some(a => a.mentalPressure)) { consequenceDomain = 'MENTAL'; if (loser === 'PLAYER') r.playerM = Math.max(0, r.playerM - 10); else { b.enemyMind = Math.max(0, b.enemyMind - 10); if (b.enemyMind === 0) b.enemyStatus = 'SURRENDERED'; } }
    if (playerHealth === 0) outcome = 'PLAYER_DEAD'; else if (b.enemyHealth === 0) outcome = 'ENEMY_DEAD'; else if (b.enemyStatus === 'SURRENDERED') outcome = 'ENEMY_SURRENDERED';
  }
  if (outcome === 'CONTINUE' && r.playerM === 0) outcome = 'RETREATED';
  const elapsedSeconds=stance==='RETREAT'?0:60;
  advanceNatureWalkerCombatClock(r,x.site.clockSeconds+elapsedSeconds-r.root.clockSeconds);
  const expiredPending=structuredClone([...r.expired,...r.pending]);r.pending=[];b.pendingKind=null;b.composureReady=false;if(b.enemyHealth===0)b.weaponLocation='ANNEX_A';
  const cancelledWindows=[...players,...enemies].flatMap(a=>structuredClone(a.windowsCancelled));
  if(outcome!=='CONTINUE'){for(const key of ['livingResponse','rootBearing'] as const){if(b[key])cancelledWindows.push(structuredClone(b[key]!));b[key]=null;}}
  const o: NatureWalkerRoundOutcome = { ...structuredClone(b), targetId: NATURE_WALKER_TARGET_ID, round: x.round, source: structuredClone(x), stance, continuing: outcome === 'CONTINUE',
    playerHealthAfter: playerHealth, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, playerInjuriesAfter: playerInjuries, playerRiskAfter: playerRisk, rootPadAfter: structuredClone(r.rootPad), masteryAfter: { ...r.mastery },
    siteAfter: structuredClone(r.root), operationAfter:structuredClone(x.operation), elapsedSeconds, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies, expiredPending,expiredWindows:structuredClone(r.expiredWindows),cancelledWindows };
  const round: SliceCombatRound = { round: x.round, stance, first, playerCount, enemyCount, playerCountRoll, enemyCountRoll,
    moves: [...players, ...enemies].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })),
    playerAdvantage, enemyAdvantage, winChance, winner, consequence: '', consequenceWeights, retreat, ...(consequenceDomain === undefined ? {} : { consequenceDomain }), ...(consequenceRoll === undefined ? {} : { consequenceRoll }),
    natureWalkerOutcome: o };
  round.consequence = natureWalkerCombatConsequence(round); return { round, outcome };
}
export function validateNatureWalkerRoundOutcome(v: unknown): v is NatureWalkerRoundOutcome { try { const o = v as NatureWalkerRoundOutcome; return !!o && same(o, replayNatureWalkerCombatRound(o.source, o.stance).round.natureWalkerOutcome); } catch { return false; } }
export function validateNatureWalkerCombatRound(round: SliceCombatRound): boolean { try { const o = round.natureWalkerOutcome; return !!o && same(round, replayNatureWalkerCombatRound(o.source, o.stance).round); } catch { return false; } }
export function nextNatureWalkerCombatSource(o:NatureWalkerRoundOutcome):NatureWalkerCombatSource{
 const spirituality=Math.min(120,o.playerSpiritualityAfter+12);
 return {...structuredClone(o.source),revision:o.source.revision+1,round:o.round+1,playerHealth:o.playerHealthAfter,playerMind:o.playerMindAfter,playerSpirituality:spirituality,playerInjuries:structuredClone(o.playerInjuriesAfter),playerRisk:o.playerRiskAfter,
 site:structuredClone(o.siteAfter),operation:structuredClone(o.operationAfter),body:combatBody(o),rootPad:structuredClone(o.rootPadAfter),mastery:{...o.masteryAfter},randomCursor:o.randomCursorAfter,
 budget:{...structuredClone(o.source.budget),health:o.playerHealthAfter,mind:o.playerMindAfter,spirituality,mastery:{...o.masteryAfter},injuries:structuredClone(o.playerInjuriesAfter),injuryRisk:o.playerRiskAfter}};
}
export function natureWalkerCombatConsequence(round: SliceCombatRound): string {
  const o = round.natureWalkerOutcome!, who = round.winner === 'PLAYER' ? '伊莱亚斯' : '你'; let text = round.retreat === 'SUCCESS' ? '普通出口开放且没有追击，停止战斗后沿4米普通路离开。' : round.consequenceDomain === 'MENTAL' ? `${who}承受实际精神压力，精神减少10，没有新增身体伤口。` : round.consequenceDomain === 'BODY' ? `${who}承受实际身体打击或法术冲击，按共同伤势盘结算。` : '本轮下风没有实际攻击来源，不掷身体伤势盘。';
  if (o.playerHealthAfter === 0) text += '本人的原身体真实死亡，不能复活或离场。'; else if (o.enemyHealth === 0) text += '伊莱亚斯原身体真实死亡，唯一原杖留地。'; else if (o.enemyStatus === 'SURRENDERED') text += '伊莱亚斯因实际伤势或精神耗尽自主停止抵抗。';
  return text+` 本轮实际${o.elapsedSeconds}秒；${o.continuing?'仍有效的新术窗口按原截止时间继续，过期即止':'停止冲突并撤销未用窗口；活着才沿普通路4米4秒退出'}。已花灵性、精神不退，全部原人物与旧记录保持原样。`;
}
/** Positive allowlists at every nested boundary. Actual public check modifier labels are retained. */
const publicInjury=(i:SliceInjury)=>({id:i.id,severity:i.severity,acquiredRevision:i.acquiredRevision,treatedRevision:i.treatedRevision});
const publicPad=(p:NatureWalkerRootPad)=>({id:p.id,sourceId:p.sourceId,material:p.material,quantity:p.quantity,owner:p.owner,holder:p.holder,location:p.location,integrity:p.integrity,acquiredWeek:p.acquiredWeek});
const publicWindow=(w:NatureWalkerWindow)=>({kind:w.kind,round:w.round,order:w.order,castAt:w.castAt,expiresAt:w.expiresAt,remaining:w.remaining,supportId:w.supportId});
const publicPending=(p:NatureWalkerPendingEffect)=>({id:p.id,owner:p.owner,kind:p.kind,createdAt:p.createdAt,expiresAt:p.expiresAt,remaining:p.remaining,guardSegmentId:p.guardSegmentId});
const publicCheck=(c:PublicCheckResult|null):PublicCheckResult|null=>c?({ability:c.ability,baseAbility:c.baseAbility,modifiers:c.modifiers.map(m=>({source:m.source,value:m.value})),effectiveAbility:c.effectiveAbility,difficulty:c.difficulty,chance:c.chance,roll:c.roll,tier:c.tier}):null;
export function projectNatureWalkerAction(a:NatureWalkerActionEvidence){return {
 order:a.order,actor:a.actor,id:a.id,planned:a.planned,selectedAbility:a.selectedAbility,fallbackReason:a.fallbackReason,mode:a.mode,label:a.label,
 selfGain:a.selfGain,enemyReduction:a.enemyReduction,threatens:a.threatens,mentalPressure:a.mentalPressure,attackKind:a.attackKind,rawContribution:a.rawContribution,rawReduction:a.rawReduction,
 paidCost:a.paidCost,mindCost:a.mindCost,physicalFactor:a.physicalFactor,check:publicCheck(a.check),succeeded:a.succeeded,resisted:a.resisted,
 pendingBefore:a.pendingBefore.map(publicPending),pendingAfter:a.pendingAfter.map(publicPending),pendingApplied:[...a.pendingApplied],masteryApplied:[...a.masteryApplied],
 rootPadBefore:publicPad(a.rootPadBefore),rootPadAfter:publicPad(a.rootPadAfter),padWear:a.padWear,guardSegmentId:a.guardSegmentId,playerHealthBefore:a.playerHealthBefore,playerHealthAfter:a.playerHealthAfter,recoveredHealth:a.recoveredHealth,distanceBeforeMetres:a.distanceBeforeMetres,contactDistanceMetres:a.contactDistanceMetres,distanceAfterMetres:a.distanceAfterMetres,atSeconds:a.atSeconds,elapsedSeconds:a.elapsedSeconds,travelMetres:a.travelMetres,
 playerMindAfter:a.playerMindAfter,playerSpiritualityAfter:a.playerSpiritualityAfter,enemySpiritualityAfter:a.enemySpiritualityAfter,windowGranted:a.windowGranted?publicWindow(a.windowGranted):null,
 windowsApplied:a.windowsApplied.map(w=>({kind:w.kind,amount:w.amount,supportId:w.supportId})),windowsExpired:a.windowsExpired.map(publicWindow),windowsCancelled:a.windowsCancelled.map(publicWindow),
 supportId:a.supportId,supportWearPaid:a.supportWearPaid,enemyChargeId:a.enemyChargeId,resistanceChance:a.resistanceChance,resistanceRoll:a.resistanceRoll,
};}
export type NatureWalkerPublicActionEvidence=ReturnType<typeof projectNatureWalkerAction>;
function publicBody(b:NatureWalkerCombatBody){return {
 enemyHealth:b.enemyHealth,enemyMind:b.enemyMind,enemySpirituality:b.enemySpirituality,enemyStatus:b.enemyStatus,enemyInjuries:b.enemyInjuries.map(publicInjury),enemyRisk:b.enemyRisk,weaponLocation:b.weaponLocation,
 powerUses:{ARC_BOLT:b.powerUses.ARC_BOLT,WARD:b.powerUses.WARD,COMPOSE:b.powerUses.COMPOSE,MENTAL_PRESSURE:b.powerUses.MENTAL_PRESSURE},pendingKind:b.pendingKind,composureReady:b.composureReady,
 preservationAttempts:b.preservationAttempts,rootBufferAttempts:b.rootBufferAttempts,rootBufferApplications:b.rootBufferApplications,guardAttempts:b.guardAttempts,livingResponseAttempts:b.livingResponseAttempts,rootBearingAttempts:b.rootBearingAttempts,livingResponseApplications:b.livingResponseApplications,rootBearingApplications:b.rootBearingApplications,enemyTravelMetres:b.enemyTravelMetres,
 supportPieces:b.supportPieces.map(p=>({id:p.id,ownerId:p.ownerId,location:p.location,quantity:p.quantity,status:p.status,wear:p.wear,usedRound:p.usedRound,usedOrder:p.usedOrder})),enemyCharges:b.enemyCharges.map(c=>({id:c.id,ownerId:c.ownerId,status:c.status,usedRound:c.usedRound,usedOrder:c.usedOrder})),livingResponse:b.livingResponse?publicWindow(b.livingResponse):null,rootBearing:b.rootBearing?publicWindow(b.rootBearing):null,
};}
const publicGuard=(g:NatureWalkerSite['guard'])=>({id:g.id,sourceId:g.sourceId,prepared:g.prepared,owner:g.owner,location:g.location,preparedWeek:g.preparedWeek,actionsSpent:g.actionsSpent,costPence:g.costPence,spiritualitySpent:g.spiritualitySpent,segments:g.segments.map(p=>({id:p.id,status:p.status}))});
const publicAdult=(p:NatureWalkerSite['owner']|NatureWalkerSite['recipient'])=>({id:p.id,name:p.name,age:p.age,alive:p.alive,independentMind:p.independentMind,location:p.location,health:p.health,mind:p.mind,injuries:p.injuries.map(publicInjury),consent:p.consent});
function publicSite(p:NatureWalkerSite){return {
 siteId:p.siteId,playerLocation:p.playerLocation,playerTravelMetres:p.playerTravelMetres,clockSeconds:p.clockSeconds,externalSeconds:p.externalSeconds,owner:publicAdult(p.owner),recipient:publicAdult(p.recipient),
 samples:p.samples.map(v=>({id:v.id,caseId:v.caseId,owner:v.owner,origin:v.origin,quantity:v.quantity,massGrams:v.massGrams,originalAlive:v.originalAlive,originalVitality:v.originalVitality,alive:v.alive,vitality:v.vitality,maximumVitality:v.maximumVitality,holder:v.holder,location:v.location,care:v.care,handovers:v.handovers,returns:v.returns})),
 paper:{id:p.paper.id,owner:p.paper.owner,holder:p.paper.holder,location:p.paper.location,sampleIds:[...p.paper.sampleIds],text:p.paper.text,readings:p.paper.readings,records:[...p.paper.records]},
 kit:{sourceId:p.kit.sourceId,purchased:p.kit.purchased,purchasedWeek:p.kit.purchasedWeek,actionsSpent:p.kit.actionsSpent,costPence:p.kit.costPence},
 box:{id:p.box.id,owner:p.box.owner,holder:p.box.holder,location:p.box.location,quantity:p.box.quantity,maximumMassGrams:p.box.maximumMassGrams,capacity:p.box.capacity,sampleId:p.box.sampleId,returns:p.box.returns},
 tag:{id:p.tag.id,owner:p.tag.owner,holder:p.tag.holder,location:p.tag.location,quantity:p.tag.quantity,returns:p.tag.returns},
 pads:p.pads.map(v=>({id:v.id,sourceId:v.sourceId,owner:v.owner,holder:v.holder,location:v.location,quantity:v.quantity,status:v.status,caseId:v.caseId,spentWeek:v.spentWeek})),guard:publicGuard(p.guard),
};}
/** All live operation inputs are closed before optional combat. Old case journals are never publicized by combat. */
export function projectNatureWalkerRoundOutcome(o:NatureWalkerRoundOutcome){return {
 ...publicBody(o),targetId:o.targetId,round:o.round,stance:o.stance,continuing:o.continuing,playerHealthAfter:o.playerHealthAfter,playerMindAfter:o.playerMindAfter,playerSpiritualityAfter:o.playerSpiritualityAfter,playerInjuriesAfter:o.playerInjuriesAfter.map(publicInjury),playerRiskAfter:o.playerRiskAfter,
 rootPadAfter:publicPad(o.rootPadAfter),masteryAfter:Object.fromEntries(MASTERY_IDS.map(id=>[id,o.masteryAfter[id]??0])),siteAfter:publicSite(o.siteAfter),
 elapsedSeconds:o.elapsedSeconds,playerActions:o.playerActions.map(projectNatureWalkerAction),enemyActions:o.enemyActions.map(projectNatureWalkerAction),expiredPending:o.expiredPending.map(publicPending),expiredWindows:o.expiredWindows.map(publicWindow),cancelledWindows:o.cancelledWindows.map(publicWindow),
};}
export type NatureWalkerPublicRoundOutcome=ReturnType<typeof projectNatureWalkerRoundOutcome>;
export function projectNatureWalkerCombat(s:SliceState){
 const e=s.natureWalker.encounter,p=s.natureWalker.life.site,last=s.combat?.encounterId==='NATURE_WALKER_DISPUTE'?s.combat.lastRound?.natureWalkerOutcome:e.terminal?s.combatHistory[e.terminal.historyIndex]?.natureWalkerOutcome:null;
 return {enemyName:isNatureWalker(s)?'伊莱亚斯·沃德（45岁，序列2施术者）':'',targetId:e.targetId,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,weaponLocation:e.weaponLocation,pendingKind:e.pendingKind,composureReady:e.composureReady,powerUses:publicBody(e).powerUses,maxActionCount:6,policy:e.policy,
 playerPosition:p?.playerLocation??'OUTSIDE',enemyPosition:e.enemyPosition,enemyDistanceMetres:e.enemyDistanceMetres,exitMetres:p?.playerLocation==='ANNEX_A'?4:0,clockSeconds:p?.clockSeconds??0,playerTravelMetres:p?.playerTravelMetres??0,enemyTravelMetres:e.enemyTravelMetres,
 supportPieces:e.supportPieces.map(p=>({id:p.id,status:p.status,wear:p.wear})),enemyCharges:e.enemyCharges.map(c=>({id:c.id,status:c.status})),rootPad:s.natureWalker.life.rootPad?publicPad(s.natureWalker.life.rootPad):null,oldGuard:p?publicGuard(p.guard):null,guardSegments:p?p.guard.segments.map(segment=>({id:segment.id,status:segment.status})):[],remainingGuardSegments:p?p.guard.segments.filter(segment=>segment.status==='UNUSED').length:0,
 windows:[e.rootBearing].flatMap(w=>w?[{kind:w.kind,remainingSeconds:Math.max(0,w.expiresAt-(p?.clockSeconds??0)),remaining:w.remaining}]:[]),
 lastActionSequence:last?[...last.playerActions,...last.enemyActions].sort((a,b)=>a.order-b.order).map(projectNatureWalkerAction):[],countWheel:NATURE_WALKER_COUNT_WHEEL.map(r=>({id:r.id,label:r.label,weight:r.weight})),enemyCountWheel:NATURE_WALKER_ENEMY_COUNT_WHEEL.map(r=>({id:r.id,label:r.label,weight:r.weight})),enemyAbilityWheel:NATURE_WALKER_ENEMY_ABILITY_WHEEL.map(r=>({id:r.id,label:r.label,weight:r.weight})),
 summary:'原活植和同一照料记录留在场外，生机辨应在本场只普通观察，不能制造身体增益。根系承冲需要实有护片、灵性与精神，意志施术并面对伊莱亚斯独立抵抗；失败仍付费，成功后短暂承接本人下一次可见身体或弧光冲击并磨损原垫，精神无效。旧根缓冲只防普通身体，旧基质和保全耗同一旧护腕实际剩余原段；继承生命支持仅在实际恢复时付费，不能清旧伤、免死或复活。普通出口始终开放。',
 };
}
export type NatureWalkerCombatProjection=ReturnType<typeof projectNatureWalkerCombat>;

/** Main LAST, history and combat.lastRound must all use this whitelist, never the private round. */
export function projectNatureWalkerCombatRound(r:SliceCombatRound){return {
 round:r.round,stance:r.stance,first:r.first,playerCount:r.playerCount,enemyCount:r.enemyCount,playerCountRoll:r.playerCountRoll,enemyCountRoll:r.enemyCountRoll,
 moves:r.moves.map(m=>({actor:m.actor,label:m.label,selfGain:m.selfGain,enemyReduction:m.enemyReduction})),playerAdvantage:r.playerAdvantage,enemyAdvantage:r.enemyAdvantage,winChance:r.winChance,winner:r.winner,consequence:r.consequence,
 consequenceWeights:r.consequenceWeights?{light:r.consequenceWeights.light,heavy:r.consequenceWeights.heavy,death:r.consequenceWeights.death}:null,retreat:r.retreat,
 ...(r.consequenceDomain===undefined?{}:{consequenceDomain:r.consequenceDomain}),...(r.consequenceRoll===undefined?{}:{consequenceRoll:r.consequenceRoll}),
 ...(r.natureWalkerOutcome?{natureWalkerOutcome:projectNatureWalkerRoundOutcome(r.natureWalkerOutcome)}:{}),
};}
