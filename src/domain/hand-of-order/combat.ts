import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicGameDate, PublicCheckResult } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { HAND_OF_ORDER_ABILITY_IDS, HAND_OF_ORDER_INHERITED_ABILITY_IDS, type HandOfOrderOriginals } from './types.js';
import type { HandOfOrderSite, HandOfOrderGuardPlate, HandOfOrderOperationState } from './life.js';
import { HAND_OF_ORDER_TARGET_ID, HAND_OF_ORDER_POWER_IDS, HAND_OF_ORDER_POWERS, HAND_OF_ORDER_POLICIES,
  handOfOrderCombatBody as combatBody, hasHandOfOrderDisputeOpponent, validateHandOfOrderPreparation,
  handOfOrderEncounterBudget, handOfOrderFinanceSnapshot, validHandOfOrderSupportPieces, validHandOfOrderEnemyCharges,
  type HandOfOrderCombatBody, type HandOfOrderEnemyIntent, type HandOfOrderPreparation, type HandOfOrderPolicy,
  type HandOfOrderWindow, type HandOfOrderEncounterBudget, type HandOfOrderFinanceSnapshot } from './encounter.js';

/** S1 changes the count distribution, not the inherited Balancer ability slots. */
export const HAND_OF_ORDER_COUNT_WHEEL: readonly SliceWheelEntry[] = [10,15,25,25,15,10].map((weight,i)=>({id:String(i+1),label:`${i+1}次行动`,weight}));
export const HAND_OF_ORDER_ENEMY_COUNT_WHEEL = HAND_OF_ORDER_COUNT_WHEEL;
export function handOfOrderActionCount(roll:number):number { if(!Number.isInteger(roll)||roll<1||roll>100)throw new Error('行动次数检定无效。'); let n=roll; for(const [i,row] of HAND_OF_ORDER_COUNT_WHEEL.entries()){n-=row.weight;if(n<=0)return i+1;}throw new Error('行动次数盘无效。'); }
export const handOfOrderEnemyActionCount=handOfOrderActionCount;
export const IMBALANCE='justiciar.s2.imbalance-sensing', RESISTANCE='justiciar.s2.measured-resistance';
export const BODY='justiciar.s9.combat-training', WOUND='justiciar.s5.wound-verdict', DEPRIVATION='justiciar.s4.deprivation';
export const DIVISION='justiciar.s1.battlefield-division', AFTERMATH='justiciar.s1.aftermath-control';
const INTIMIDATION='justiciar.s4.intimidation', TRACE='justiciar.s8.trace-sensing';
const MASTERY_IDS=[...HAND_OF_ORDER_INHERITED_ABILITY_IDS,...HAND_OF_ORDER_ABILITY_IDS];
export type HandOfOrderMoveId=typeof BODY|typeof WOUND|typeof RESISTANCE|typeof IMBALANCE|typeof DEPRIVATION|typeof DIVISION|typeof AFTERMATH|'ACCIDENT';
export const HAND_OF_ORDER_ABILITY_ENTRIES: readonly {id:HandOfOrderMoveId;label:string;weight:number;stance:SliceStance|null}[]=[
 {id:BODY,label:'继承格斗：59.15×掌握×身体；持原棍16×身体，0灵性',weight:30,stance:'ATTACK'},
 {id:WOUND,label:'真实旧伤裁断：3灵性、知识14；条件不足只普通侧击',weight:15,stance:'ATTACK'},
 {id:RESISTANCE,label:'适度抗衡：6灵性1精神、意志20；30秒内下一普通身体攻击至多减45，原板磨损15',weight:25,stance:'DEFEND'},
 {id:IMBALANCE,label:'失衡感知：5灵性、感知20；30秒内利用真实可见身体破绽+25',weight:10,stance:'CONTROL'},
 {id:DEPRIVATION,label:'继承暂剥弧光：4灵性、知识18；本轮原弧光槽回退普通棍击',weight:15,stance:'PREPARE'},
 {id:'ACCIDENT',label:'动作偏差：−22.5，0灵性',weight:5,stance:null},
 {id:DIVISION,label:'战场划分：8灵性2精神1护片、知识18与独立抵抗；20秒内本人下一身体行动+35',weight:20,stance:'ATTACK'},
 {id:AFTERMATH,label:'余波控制：8灵性2精神1护片、知识18与独立抵抗；20秒内下一身体或弧光至多减30，原板磨损15',weight:20,stance:'DEFEND'},
];
export const HAND_OF_ORDER_ENEMY_ABILITY_WHEEL:readonly SliceWheelEntry[]=[
 {id:'ARC_BOLT',label:'有限弧光：5灵性1刻片，70身体攻击贡献',weight:35},
 {id:'WARD',label:'有限屏护：4灵性，敌方−30',weight:20},
 {id:'BODY_STRIKE',label:'本人手杖打击：20×身体',weight:20},
 {id:'COMPOSE',label:'自主凝神：4灵性，贡献8；取消未用影响并抵抗本轮新输入',weight:10},
 {id:'MENTAL_PRESSURE',label:'有限精神施压：5灵性1刻片，45精神攻击贡献',weight:10},
 {id:'ACCIDENT',label:'动作偏差：−22.5，0灵性',weight:5},
];
export const isHandOfOrder=(s:SliceState)=>s.progression.pathwayId==='justiciar'&&s.progression.sequence===1;
const enabled=(id:HandOfOrderMoveId,p:HandOfOrderPolicy)=>id===DIVISION?p==='ALL'||p==='DIVISION':id===AFTERMATH?p==='ALL'||p==='AFTERMATH':true;
const tickets=(stance:SliceStance|null,policy:HandOfOrderPolicy)=>HAND_OF_ORDER_ABILITY_ENTRIES.map(a=>enabled(a.id,policy)?a.weight*(a.stance===stance&&stance!==null?5:4):0);
export function handOfOrderAbilityWheel(s:SliceState,stance:SliceStance|null):SliceWheelEntry[]{const policy=s.handOfOrder?.encounter.policy??'ALL',w=tickets(stance,policy),total=w.reduce((a,b)=>a+b,0);return HAND_OF_ORDER_ABILITY_ENTRIES.flatMap((a,i)=>w[i]?[{id:a.id,label:policy==='ORDINARY'&&a.id!=='ACCIDENT'?'普通身体、格挡或观察，0超凡费用':a.label,weight:w[i]!/total*100}]:[]);}
export function drawHandOfOrderAbility(random:ActionRandomStream,s:SliceState|null,stance:SliceStance|null,policy:HandOfOrderPolicy=s?.handOfOrder.encounter.policy??'ALL'):HandOfOrderMoveId{const w=tickets(stance,policy);let n=random.nextInt(1,w.reduce((a,b)=>a+b,0));for(const[i,a]of HAND_OF_ORDER_ABILITY_ENTRIES.entries()){n-=w[i]!;if(n<=0)return a.id;}throw new Error('行动盘无效。');}
export function drawHandOfOrderEnemyAbility(random:ActionRandomStream):HandOfOrderEnemyIntent{let n=random.nextInt(1,100);for(const a of HAND_OF_ORDER_ENEMY_ABILITY_WHEEL){n-=a.weight;if(n<=0)return a.id as HandOfOrderEnemyIntent;}throw new Error('对手行动盘无效。');}
const same=(a:unknown,b:unknown)=>a===b||(a!==undefined&&b!==undefined&&stableStringify(a)===stableStringify(b));
const integer=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER):n is number=>Number.isSafeInteger(n)&&(n as number)>=min&&(n as number)<=max;
const shape=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...keys].sort());
const physicalAt=(n:number)=>n>75?1:n>50?.95:n>25?.9:.8;
const factor=(n:number)=>.65+.35*n/500;
export function validHandOfOrderGuardPlate(p:HandOfOrderGuardPlate,week:number):boolean{return shape(p,['id','owner','holder','location','integrity','acquiredWeek'])&&p.id==='BA2-GUARD-PLATE'&&p.owner==='PLAYER'&&p.holder==='PLAYER'&&['START','A','B','OUTSIDE','ANNEX_A','ANNEX_B'].includes(p.location)&&integer(p.integrity,0,65)&&integer(p.acquiredWeek,1,week);}
export interface HandOfOrderCombatSource {
 runId:string;revision:number;week:number;date:PublicGameDate;round:number;encounterId:'HAND_OF_ORDER_DISPUTE';targetId:typeof HAND_OF_ORDER_TARGET_ID;
 attemptWeek:number;startHistoryIndex:number;targetName:'布拉姆·温特';targetAge:45;targetPathway:'original-caster';targetSequence:2;targetCore:27;targetWill:27;maxActionCount:6;
 actualBody:true;independentMind:true;enemyWeapon:'HO1-BRAM-ROD';weaponOwner:typeof HAND_OF_ORDER_TARGET_ID;yardId:'HO1-NEIGHBOR-ANNEX';playerPosition:'ANNEX_A';enemyPosition:'ANNEX_A';enemyDistanceMetres:2;
 ordinaryExit:'OPEN';pursuit:false;thirdPartiesInArea:0;automaticAllyImmunity:false;freeSkillLibrary:false;
 playerHealth:number;playerMind:number;playerSpirituality:number;playerInjuries:SliceInjury[];playerRisk:number;physique:number;perception:number;will:number;knowledge:number;mastery:Record<string,number>;clubHeld:boolean;guardPlate:HandOfOrderGuardPlate;
 preparation:HandOfOrderPreparation;site:HandOfOrderSite;operation:HandOfOrderOperationState;originals:HandOfOrderOriginals;body:HandOfOrderCombatBody;
 budget:HandOfOrderEncounterBudget;finance:HandOfOrderFinanceSnapshot;policy:HandOfOrderPolicy;randomSeed:string;randomCursor:number;
}
export function currentHandOfOrderCombatSource(s:SliceState):HandOfOrderCombatSource|null{
 if(!hasHandOfOrderDisputeOpponent(s))return null;const e=s.handOfOrder.encounter,c=s.combat!,l=s.handOfOrder.life,originals=s.handOfOrder.sourceScene?.originals;
 if(!e.preparation||!l.site||!l.guardPlate||!originals)return null;
 return {runId:s.runId,revision:s.revision,week:s.week,date:{...s.date},round:c.round,encounterId:'HAND_OF_ORDER_DISPUTE',targetId:HAND_OF_ORDER_TARGET_ID,
 attemptWeek:e.attemptWeek!,startHistoryIndex:e.startHistoryIndex!,targetName:'布拉姆·温特',targetAge:45,targetPathway:'original-caster',targetSequence:2,targetCore:27,targetWill:27,maxActionCount:6,
 actualBody:true,independentMind:true,enemyWeapon:'HO1-BRAM-ROD',weaponOwner:HAND_OF_ORDER_TARGET_ID,yardId:'HO1-NEIGHBOR-ANNEX',playerPosition:'ANNEX_A',enemyPosition:e.enemyPosition,enemyDistanceMetres:e.enemyDistanceMetres,
 ordinaryExit:'OPEN',pursuit:false,thirdPartiesInArea:0,automaticAllyImmunity:false,freeSkillLibrary:false,playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,playerInjuries:structuredClone(s.injuries),playerRisk:s.injuryRisk,
 ...s.character.coreStats,mastery:{...s.progression.mastery},clubHeld:s.town.clubLocation==='HAND',guardPlate:structuredClone(l.guardPlate),preparation:structuredClone(e.preparation),site:structuredClone(l.site),operation:structuredClone(l.operation),originals:structuredClone(originals),body:combatBody(e),budget:handOfOrderEncounterBudget(s),finance:handOfOrderFinanceSnapshot(s),policy:e.policy,randomSeed:s.random.seed,randomCursor:s.random.cursor};
}
/** All windows refer only to this scene and recorded past/present actions. */
export interface HandOfOrderPendingEffect {
  id: string; owner: 'PLAYER'; kind: 'IMBALANCE' | 'RESISTANCE' | 'INTIMIDATION' | 'DEPRIVATION';
  createdAt: number; expiresAt: number; remaining: 1; openingId: string | null;
}
export interface HandOfOrderVisibleOpening { id: string; targetId: typeof HAND_OF_ORDER_TARGET_ID; sourceOrder: number; createdAt: number; expiresAt: number; kind: 'RECOVERING_FROM_ACTUAL_BODY_STRIKE'; visible: true }
export interface HandOfOrderActionEvidence {
  order: number; actor: 'PLAYER' | 'ENEMY'; id: string; planned: string; selectedAbility: string; fallbackReason: string | null; mode: string; label: string;
  selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean; attackKind: 'NONE' | 'BODY' | 'ARC' | 'MIND' | 'WOUND'; rawContribution: number; rawReduction: number;
  paidCost: number; mindCost: number; physicalFactor: number; check: PublicCheckResult | null; succeeded: boolean; resisted: boolean;
  pendingBefore: HandOfOrderPendingEffect[]; pendingAfter: HandOfOrderPendingEffect[]; pendingApplied: string[]; masteryApplied: string[];
  openingBefore: HandOfOrderVisibleOpening | null; openingAfter: HandOfOrderVisibleOpening | null; guardPlateBefore: HandOfOrderGuardPlate; guardPlateAfter: HandOfOrderGuardPlate; plateWear: 0 | 15;
  atSeconds: number; elapsedSeconds: 5; travelMetres: number; randomCursorBefore: number; randomCursorAfter: number;
  playerMindAfter: number; playerSpiritualityAfter: number; enemySpiritualityAfter: number;
  windowGranted:HandOfOrderWindow|null; windowsApplied:{kind:HandOfOrderWindow['kind'];amount:number;supportId:string}[]; windowsExpired:HandOfOrderWindow[]; windowsCancelled:HandOfOrderWindow[];
  supportId:string|null;supportWearPaid:0|1;enemyChargeId:string|null;resistanceChance:number|null;resistanceRoll:number|null;
}
export interface HandOfOrderRuntime {
  body: HandOfOrderCombatBody; root: HandOfOrderSite; playerS: number; playerM: number; guardPlate: HandOfOrderGuardPlate;
  mastery: Record<string, number>; pending: HandOfOrderPendingEffect[]; opening: HandOfOrderVisibleOpening | null; expired: HandOfOrderPendingEffect[]; expiredWindows:HandOfOrderWindow[];
}
export function createHandOfOrderRuntime(x: HandOfOrderCombatSource): HandOfOrderRuntime {
  return { body: structuredClone(x.body), root: structuredClone(x.site), playerS: x.playerSpirituality, playerM: x.playerMind,
    guardPlate: structuredClone(x.guardPlate), mastery: { ...x.mastery }, pending: [], opening: null, expired: [], expiredWindows: [] };
}
function syncPending(r: HandOfOrderRuntime): void { r.body.pendingKind = r.pending.some(p => p.kind === 'RESISTANCE') ? 'RESISTANCE' : r.pending.some(p => p.kind === 'IMBALANCE') ? 'IMBALANCE' : null; }
export function advanceHandOfOrderCombatClock(r: HandOfOrderRuntime, seconds: number): void {
  if (!integer(seconds)) throw new Error('实际时间无效。'); r.root.clockSeconds += seconds; for(const key of ['division','aftermath'] as const){const w=r.body[key];if(w&&w.expiresAt<=r.root.clockSeconds){r.expiredWindows.push(structuredClone(w));r.body[key]=null;}}
  r.expired.push(...r.pending.filter(p => p.expiresAt <= r.root.clockSeconds)); r.pending = r.pending.filter(p => p.expiresAt > r.root.clockSeconds);
  if (r.opening && r.opening.expiresAt <= r.root.clockSeconds) r.opening = null; syncPending(r);
}
function baseAction(x: HandOfOrderCombatSource, r: HandOfOrderRuntime, actor: 'PLAYER' | 'ENEMY', id: string, order: number, random: ActionRandomStream): HandOfOrderActionEvidence {
  return { actor, id, planned: id, selectedAbility: id, fallbackReason: null, order, mode: 'OBSERVE', label: '', selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false,
    attackKind: 'NONE', rawContribution: 0, rawReduction: 0, paidCost: 0, mindCost: 0, physicalFactor: physicalAt(actor === 'PLAYER' ? x.playerHealth : x.body.enemyHealth), check: null, succeeded: false, resisted: false,
    pendingBefore: structuredClone(r.pending), pendingAfter: [], pendingApplied: [], masteryApplied: [], openingBefore: structuredClone(r.opening), openingAfter: null,
    guardPlateBefore: structuredClone(r.guardPlate), guardPlateAfter: structuredClone(r.guardPlate), plateWear: 0, atSeconds: r.root.clockSeconds, elapsedSeconds: 5, travelMetres: 0,
    randomCursorBefore: random.cursor, randomCursorAfter: random.cursor, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, enemySpiritualityAfter: r.body.enemySpirituality,windowGranted:null,windowsApplied:[],windowsExpired:[],windowsCancelled:[],supportId:null,supportWearPaid:0,enemyChargeId:null,resistanceChance:null,resistanceRoll:null };
}
function gainMastery(r: HandOfOrderRuntime, a: HandOfOrderActionEvidence, id: string): void { r.mastery[id] = Math.min(500, (r.mastery[id] ?? 0) + 8); a.masteryApplied.push(id); }
function closeAction(a: HandOfOrderActionEvidence, r: HandOfOrderRuntime, random: ActionRandomStream) {
  const expiredBefore=r.expiredWindows.length; advanceHandOfOrderCombatClock(r, 5); a.windowsExpired.push(...structuredClone(r.expiredWindows.slice(expiredBefore))); a.pendingAfter = structuredClone(r.pending); a.openingAfter = structuredClone(r.opening); a.guardPlateAfter = structuredClone(r.guardPlate);
  a.randomCursorAfter = random.cursor; a.playerMindAfter = r.playerM; a.playerSpiritualityAfter = r.playerS; a.enemySpiritualityAfter = r.body.enemySpirituality;
  a.label += ` 实际用时5秒；本人灵性${r.playerS}、精神${r.playerM}，布拉姆灵性${r.body.enemySpirituality}。`; return a;
}
function pending(x: HandOfOrderCombatSource, r: HandOfOrderRuntime, a: HandOfOrderActionEvidence, kind: HandOfOrderPendingEffect['kind'], openingId: string | null = null): HandOfOrderPendingEffect {
  return { id: `${x.runId}:handOfOrder:${x.round}:${a.order}:${kind}`, owner: 'PLAYER', kind, createdAt: r.root.clockSeconds,
    expiresAt: kind === 'DEPRIVATION' || kind === 'INTIMIDATION' ? x.site.clockSeconds + 60 : r.root.clockSeconds + 30, remaining: 1, openingId };
}
function take(r: HandOfOrderRuntime, a: HandOfOrderActionEvidence, effect: HandOfOrderPendingEffect): void { a.pendingApplied.push(effect.id); r.pending = r.pending.filter(p => p.id !== effect.id); }
const heldPlate = (r: HandOfOrderRuntime) => r.guardPlate.owner === 'PLAYER' && r.guardPlate.holder === 'PLAYER' && r.guardPlate.location === 'ANNEX_A' && r.guardPlate.integrity >= 15;
function resolveNewWindow(x:HandOfOrderCombatSource,r:HandOfOrderRuntime,id:typeof DIVISION|typeof AFTERMATH,a:HandOfOrderActionEvidence,random:ActionRandomStream):HandOfOrderActionEvidence{
 const key=id===DIVISION?'division':'aftermath',piece=r.body.supportPieces.find(p=>p.status==='HELD');
 if(!enabled(id,x.policy)||x.policy==='ORDINARY'){a.fallbackReason='POLICY';a.label='当前策略不使用此术，只普通观察。';}
 else if(r.body[key]){a.fallbackReason='ACTIVE_WINDOW';a.label='本人同一待用窗口仍有效，不叠加、续期或重复收费。';}
 else if(id===AFTERMATH&&!heldPlate(r)){a.fallbackReason='INSUFFICIENT_ACTUAL_PLATE';a.label='没有实持至少15完整度的同一原护板，只普通防备；不付新术费用，不消耗护片。';}
 else if(!piece||r.playerS<8||r.playerM<4){a.fallbackReason='INSUFFICIENT_RESOURCES';a.label='缺少实有护片或不足8灵性4精神，只观察，不透支或补发实物。';}
 else{
  a.mode=id===DIVISION?'DIVISION':'AFTERMATH';a.paidCost=8;a.mindCost=2;r.playerS-=8;r.playerM-=2;piece.status='SPENT';piece.wear=1;piece.usedRound=x.round;piece.usedOrder=a.order;a.supportId=piece.id;a.supportWearPaid=1;
  if(id===DIVISION)r.body.divisionAttempts++;else r.body.aftermathAttempts++;
  a.check=resolveNormalCheck({ability:'knowledge',baseAbility:x.knowledge,difficulty:18,modifiers:[],roll:random.nextInt(1,100)});a.succeeded=['SUCCESS','GREAT_SUCCESS'].includes(a.check.tier);
  if(a.succeeded){a.resistanceChance=Math.min(95,Math.max(5,35+x.targetWill));a.resistanceRoll=random.nextInt(1,100);a.resisted=r.body.composureReady||a.resistanceRoll<=a.resistanceChance;a.succeeded=!a.resisted;}
  if(!a.succeeded){a.mindCost=4;r.playerM-=2;a.label=`${a.resisted?'布拉姆以自己的意志抵抗本次输入':'知识18检定失败'}；实际8灵性4精神和一枚护片照付，没有建立窗口。`;}
  else{const w:HandOfOrderWindow={kind:id===DIVISION?'DIVISION':'AFTERMATH',round:x.round,order:a.order,castAt:r.root.clockSeconds,expiresAt:r.root.clockSeconds+20,remaining:1,supportId:piece.id};r.body[key]=w;a.windowGranted=structuredClone(w);
   a.label=id===DIVISION?'战场划分实付8灵性2精神一枚护片；只为20秒内本人下一次尚未结算身体行动预留+35，尚无实际攻击或掌握奖励。':'余波控制实付8灵性2精神一枚护片；20秒内仅等下一次可见身体或弧光冲击至多减30，应用时同一原板磨损15；精神冲击无效。';}
 }
 return closeAction(a,r,random);
}
function applyDivision(r:HandOfOrderRuntime,a:HandOfOrderActionEvidence):void{const w=r.body.division;if(!w||a.attackKind!=='BODY'||a.selfGain<=0)return;a.selfGain+=35;a.windowsApplied.push({kind:'DIVISION',amount:35,supportId:w.supportId});gainMastery(r,a,DIVISION);r.body.divisionApplications++;r.body.division=null;a.label+=' 此前仍有效的划分现在用于本人这一次真实身体行动，贡献+35，窗口立即用尽。';}

/** The checks draw only when this actual slot requires one; no future RNG is read. */
export function resolveHandOfOrderPlayerSlot(x: HandOfOrderCombatSource, r: HandOfOrderRuntime, id: HandOfOrderMoveId, order: number, random: ActionRandomStream): HandOfOrderActionEvidence {
  const a = baseAction(x, r, 'PLAYER', id, order, random), b = r.body;
  const pay = (s: number, m = 0) => { r.playerS -= s; r.playerM -= m; a.paidCost = s; a.mindCost = m; };
  const check = (ability: 'knowledge' | 'perception' | 'will', difficulty: number) => { a.check = resolveNormalCheck({ ability, baseAbility: x[ability], difficulty, modifiers: [], roll: random.nextInt(1, 100) }); a.succeeded = ['SUCCESS', 'GREAT_SUCCESS'].includes(a.check.tier); };
  if(id===DIVISION||id===AFTERMATH)return resolveNewWindow(x,r,id,a,random);
  if(x.policy==='ORDINARY'&&id!=='ACCIDENT'){a.selectedAbility='ORDINARY';if(id===BODY||id===WOUND){a.mode='BODY';a.attackKind='BODY';a.selfGain=(x.clubHeld?16:20)*a.physicalFactor;a.rawContribution=a.selfGain;a.threatens=true;a.travelMetres=4;r.root.playerTravelMetres+=4;a.label='本人普通近前2米打击并退回2米，不使用超凡能力。';}else{a.mode='GUARD';a.enemyReduction=10*a.physicalFactor;a.rawReduction=a.enemyReduction;a.label='本人普通格挡或观察，0超凡费用。';}return closeAction(a,r,random);}
  if (id === 'ACCIDENT') { a.mode = 'ACCIDENT'; a.selfGain = -22.5; a.label = '此次动作偏差，贡献−22.5。'; }
  else if (id === BODY || id === WOUND) {
    const wound = id === WOUND && b.enemyInjuries.length > 0 && r.playerS >= 3;
    if (wound) { pay(3); check('knowledge', 14); a.mode = 'WOUND'; a.attackKind = 'WOUND'; a.selfGain = a.succeeded ? 45 * factor(x.mastery[WOUND] ?? 0) : 0;
      a.label = `继承旧伤裁断实付3灵性，知识14检定${a.check!.roll}/${a.check!.chance}；${a.succeeded ? '仅依布拉姆真实既有伤口形成有限致伤战势' : '失败，费用不退'}。不乘身体，不使用身体破绽增益。`; }
    else { a.mode = 'BODY'; a.attackKind = 'BODY'; a.selfGain = (id === BODY ? x.clubHeld ? 16 : 59.15 * factor(x.mastery[BODY] ?? 0) : 41.405 * factor(x.mastery[BODY] ?? 0)) * a.physicalFactor;
      a.label = id === BODY ? '继承格斗，实际使用自己的身体或持握原短棍。' : '没有真实旧伤或不足3灵性，只作继承普通侧击，不虚构伤口。';
      a.travelMetres = 4; r.root.playerTravelMetres += 4;
    }
    a.rawContribution = a.selfGain;
    const opening = r.pending.find(p => p.kind === 'IMBALANCE');
    if (a.attackKind === 'BODY' && a.selfGain > 0 && opening && r.opening?.id === opening.openingId && !b.composureReady) {
      a.selfGain += 25; take(r, a, opening); gainMastery(r, a, IMBALANCE); r.opening = null; a.label += '此前看见的同一实际身体破绽现在被利用，本人这一次身体贡献+25，立即结束。';
    }
    applyDivision(r,a); a.threatens = a.selfGain > 0;
  } else if (id === IMBALANCE) {
    if (r.pending.some(p => p.kind === 'IMBALANCE')) { a.fallbackReason = 'ALREADY_PENDING'; a.label = '已有待用感知，本次普通观察，不叠加或刷新。'; }
    else if (!r.opening || r.opening.expiresAt <= r.root.clockSeconds || r.playerS < 5) { a.fallbackReason = r.playerS < 5 ? 'INSUFFICIENT_RESOURCES' : 'NO_VISIBLE_ACTUAL_OPENING'; a.selectedAbility = 'OBSERVE'; a.label = '没有当前可见的真实身体破绽或不足5灵性，只普通观察；不读取内心、隐藏状态或未来动作。'; }
    else { pay(5); b.imbalanceAttempts++; check('perception', 20); a.resisted = b.composureReady; a.succeeded &&= !a.resisted; a.mode = 'IMBALANCE';
      if (a.succeeded) { const p = pending(x, r, a, 'IMBALANCE', r.opening.id); p.expiresAt = Math.min(p.expiresAt, r.opening.expiresAt); r.pending.push(p); }
      a.label = `失衡感知实付5灵性，感知20检定${a.check!.roll}/${a.check!.chance}；${a.resisted ? '布拉姆已实际凝神抵抗' : a.succeeded ? '只记住当前可见身体破绽，在原30秒窗口内待本人下一次真实身体动作使用' : '失败'}，费用不退。`; }
  } else if (id === RESISTANCE) {
    if (r.pending.some(p => p.kind === 'RESISTANCE')) { a.fallbackReason = 'ALREADY_PENDING'; a.label = '已有一次待用抗衡，本次普通防备；不叠加、续期或再次磨损。'; }
    else if (r.playerS >= 6 && r.playerM >= 1 && heldPlate(r)) {
      pay(6, 1); b.resistanceAttempts++; check('will', 20); a.resisted = b.composureReady; a.succeeded &&= !a.resisted; a.mode = 'RESISTANCE';
      if (a.succeeded) r.pending.push(pending(x, r, a, 'RESISTANCE'));
      a.label = `适度抗衡实付6灵性1精神，意志20检定${a.check!.roll}/${a.check!.chance}；${a.resisted ? '布拉姆已凝神抵抗，未建立效果' : a.succeeded ? '以同一实持护板预备30秒，只在下一次实际普通身体攻击时最多减45并磨损15' : '失败'}。施术不修复护板，不防精神施压，也不自动取消法术。`;
    } else if (r.pending.some(p => p.kind === 'INTIMIDATION')) { a.selectedAbility = 'OBSERVE'; a.fallbackReason = 'INHERITED_INTIMIDATION_PENDING'; a.label = '新抗衡条件不足且旧震慑仍待用，只普通防备，不刷新旧效果。'; }
    else if (r.playerS >= 4) { pay(4); b.intimidationAttempts++; check('knowledge', 18); a.resisted = b.composureReady; a.succeeded &&= !a.resisted; a.selectedAbility = INTIMIDATION; a.fallbackReason = 'NEW_RESOURCES_OR_PLATE_UNAVAILABLE'; a.mode = 'INTIMIDATION';
      if (a.succeeded) r.pending.push(pending(x, r, a, 'INTIMIDATION')); a.label = `新抗衡的原板或资源不足，实际只付4灵性使用继承震慑，知识18检定${a.check!.roll}/${a.check!.chance}；${a.succeeded ? '本轮下一次正身体或弧光攻击×0.6' : '失败或被凝神抵抗，费用不退'}。不授新抗衡掌握。`; }
    else { a.selectedAbility = TRACE; a.fallbackReason = 'INSUFFICIENT_RESOURCES'; a.mode = 'GUARD'; a.enemyReduction = 49.29 * factor(x.mastery[TRACE] ?? 0) * a.physicalFactor; a.label = '资源不足，只用继承痕迹护身49.29×原掌握×身体，不制造待用抗衡或修复护板。'; }
  } else {
    a.mode = 'DEPRIVATION';
    if (r.pending.some(p => p.kind === 'DEPRIVATION')) { a.fallbackReason = 'ALREADY_PENDING'; a.label = '原弧光已暂剥，重复槽只普通观察，不叠加或续期。'; }
    else if (r.playerS < 4) { a.selectedAbility = 'OBSERVE'; a.fallbackReason = 'INSUFFICIENT_RESOURCES'; a.label = '不足4灵性，只普通观察，不制造剥夺。'; }
    else { pay(4); b.deprivationAttempts++; check('knowledge', 18); a.resisted = b.composureReady; a.succeeded &&= !a.resisted;
      if (a.succeeded) r.pending.push(pending(x, r, a, 'DEPRIVATION')); a.label = `继承暂剥弧光实付4灵性，知识18检定${a.check!.roll}/${a.check!.chance}；${a.succeeded ? '同一弧光本轮暂不可用，原弧光槽回退普通棍击，不收法术费' : '失败或被凝神抵抗，费用不退'}。不复制、永久删除或剥夺其他能力。`; }
  }
  if (a.rawContribution === 0) a.rawContribution = a.selfGain; a.rawReduction = a.enemyReduction; syncPending(r); return closeAction(a, r, random);
}
export function resolveHandOfOrderEnemySlot(x: HandOfOrderCombatSource, r: HandOfOrderRuntime, planned: HandOfOrderEnemyIntent, order: number, random: ActionRandomStream): HandOfOrderActionEvidence {
  const a = baseAction(x, r, 'ENEMY', planned, order, random), b = r.body, p = HAND_OF_ORDER_POWERS.find(v => v.id === planned);
  const deprived=planned==='ARC_BOLT'&&r.pending.some(v=>v.kind==='DEPRIVATION'), charged=planned==='ARC_BOLT'||planned==='MENTAL_PRESSURE', charge=b.enemyCharges.find(c=>c.status==='HELD'), payable=!!p&&!deprived&&b.enemySpirituality>=p.cost&&(!charged||!!charge);
  if (planned === 'ACCIDENT') { a.mode = 'ACCIDENT'; a.selfGain = -22.5; a.label = '布拉姆此次动作偏差，贡献−22.5。'; }
  else if (payable) {
    if(charged&&charge){charge.status='SPENT';charge.usedRound=x.round;charge.usedOrder=order;a.enemyChargeId=charge.id;} a.mode = p.id; a.paidCost = p.cost; b.enemySpirituality -= p.cost; b.powerUses[p.id]++; a.selfGain = p.selfGain; a.enemyReduction = p.enemyReduction;
    if (p.id === 'ARC_BOLT') { a.attackKind = 'ARC'; a.threatens = true; a.label = '布拉姆实际付5灵性发出有限弧光，形成身体伤势来源；原板抗衡仅防普通身体动作。'; }
    else if (p.id === 'MENTAL_PRESSURE') { a.attackKind = 'MIND'; a.mentalPressure = true; a.label = '布拉姆实际付5灵性向独立心智施加精神压力，只有精神后果；实持护板不能挡住。'; }
    else if (p.id === 'COMPOSE') { r.pending = []; r.opening = null; a.windowsCancelled=[b.division,b.aftermath].filter((w):w is HandOfOrderWindow=>w!==null).map(w=>structuredClone(w));b.division=null;b.aftermath=null;b.composureReady = true; a.label = '布拉姆付4灵性自主凝神，调整实际姿态消除可见破绽，取消未用抗衡、震慑与剥夺并抵抗本轮新输入；已付费用不退。'; }
    else a.label = '布拉姆实际付4灵性施展自己的有限屏护，保持独立防御。';
  } else {
    a.id = a.selectedAbility = 'BODY_STRIKE'; a.mode = 'BODY'; a.fallbackReason = deprived ? 'ACTUAL_ARC_DEPRIVED' : p ? charged&&!charge?'NO_ACTUAL_ENEMY_CHARGE':'INSUFFICIENT_ENEMY_SPIRITUALITY' : null; a.attackKind = 'BODY'; a.threatens = true; a.selfGain = 20 * a.physicalFactor; a.travelMetres = 4; b.enemyTravelMetres+=4;
    a.label = '布拉姆持自己的唯一手杖，近前2米击打再退回2米；不付原法术费用、不重抽动作。';
  }
  a.rawContribution = a.selfGain; a.rawReduction = a.enemyReduction;
  const intimidation = r.pending.find(v => v.kind === 'INTIMIDATION');
  if (intimidation && (a.attackKind === 'BODY' || a.attackKind === 'ARC') && a.selfGain > 0) { a.selfGain *= .6; take(r, a, intimidation); a.label += '原待用震慑现在将这次实际正攻击贡献降至60%。'; }
  const resistance = r.pending.find(v => v.kind === 'RESISTANCE');
  if (resistance && a.attackKind === 'BODY' && a.selfGain > 0 && heldPlate(r)) { a.selfGain = Math.max(0, a.selfGain - 45); r.guardPlate.integrity -= 15; a.plateWear = 15; take(r, a, resistance); gainMastery(r, a, RESISTANCE); a.label += '同一护板实际接住这一次身体打击，贡献最多减45，完整度实减15；抗衡结束，此时才获得掌握。'; }
  const aftermath=b.aftermath;
  if(aftermath&&(a.attackKind==='BODY'||a.attackKind==='ARC')&&a.selfGain>0&&heldPlate(r)&&a.plateWear===0){const amount=Math.min(30,a.selfGain);a.selfGain-=amount;r.guardPlate.integrity-=15;a.plateWear=15;a.windowsApplied.push({kind:'AFTERMATH',amount,supportId:aftermath.supportId});gainMastery(r,a,AFTERMATH);b.aftermathApplications++;b.aftermath=null;a.label+=' 同一原护板此时承受这次可见冲击，余波贡献至多减30，原板真实磨损15；此时才授掌握。';}
  if(a.attackKind==='ARC')a.threatens=a.selfGain>0;
  if (a.attackKind === 'BODY') {
    a.threatens = a.selfGain > 0;
    r.opening = { id: `${x.runId}:handOfOrder:${x.round}:${order}:opening`, targetId: HAND_OF_ORDER_TARGET_ID, sourceOrder: order,
      createdAt: r.root.clockSeconds, expiresAt: r.root.clockSeconds + 30, kind: 'RECOVERING_FROM_ACTUAL_BODY_STRIKE', visible: true };
    r.pending = r.pending.filter(v => v.kind !== 'IMBALANCE'); a.label += '这次已经发生的近身出击留下可见的回身破绽，30秒内可观察；不预知下一槽。';
  }
  syncPending(r); return closeAction(a, r, random);
}
export interface HandOfOrderRoundOutcome extends HandOfOrderCombatBody {
  targetId: typeof HAND_OF_ORDER_TARGET_ID; round: number; source: HandOfOrderCombatSource; stance: SliceStance; continuing: boolean;
  playerHealthAfter: number; playerMindAfter: number; playerSpiritualityAfter: number; playerInjuriesAfter: SliceInjury[]; playerRiskAfter: number; guardPlateAfter: HandOfOrderGuardPlate; masteryAfter: Record<string, number>;
  siteAfter: HandOfOrderSite; operationAfter:HandOfOrderOperationState; elapsedSeconds: 0 | 60; randomCursorAfter: number; playerActions: HandOfOrderActionEvidence[]; enemyActions: HandOfOrderActionEvidence[]; expiredPending: HandOfOrderPendingEffect[]; expiredWindows:HandOfOrderWindow[]; cancelledWindows:HandOfOrderWindow[];
}
export type HandOfOrderResolution = 'CONTINUE' | 'PLAYER_DEAD' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED' | 'RETREATED';
function penalty(n: number, max: number) { const f = n / max; return f > .75 ? 0 : f > .5 ? .05 : f > .25 ? .1 : .2; }
function base(core: number, h: number, m: number, s: number, maxS = 120) { return (1250 + Math.min(core, 250)) * (1 - Math.min(.4, penalty(h, 100) + penalty(m, 100) + penalty(s, maxS))); }
function weights(risk: number) { const death = Math.min(100, 5 + Math.min(risk, 10) * 10), shifted = death - 5; return { light: Math.max(0, 65 - shifted), heavy: Math.max(0, 30 - Math.max(0, shifted - 65)), death }; }
function validWindow(w:HandOfOrderWindow|null,kind:HandOfOrderWindow['kind'],b:HandOfOrderCombatBody,maxRound:number):boolean{
 return w===null||shape(w,['kind','round','order','castAt','expiresAt','remaining','supportId'])&&w.kind===kind&&integer(w.round,1,maxRound)&&integer(w.order,0,11)&&integer(w.castAt)&&w.expiresAt===w.castAt+20&&w.remaining===1&&b.supportPieces.some(p=>p.id===w.supportId&&p.status==='SPENT'&&p.usedRound===w.round&&p.usedOrder===w.order);
}
export function validHandOfOrderBody(b:HandOfOrderCombatBody,maxRound=Number.MAX_SAFE_INTEGER):boolean{
 return integer(b.enemyHealth,0,100)&&integer(b.enemyMind,0,100)&&integer(b.enemySpirituality,0,100)&&integer(b.enemyRisk)&&Array.isArray(b.enemyInjuries)&&
 ['RESISTING','SURRENDERED','DEAD'].includes(b.enemyStatus)&&(b.enemyStatus==='DEAD')===(b.enemyHealth===0)&&b.weaponLocation===(b.enemyStatus==='DEAD'?'ANNEX_A':'HAND')&&
 shape(b.powerUses,HAND_OF_ORDER_POWER_IDS)&&HAND_OF_ORDER_POWER_IDS.every(id=>integer(b.powerUses[id],0,maxRound*6))&&b.enemySpirituality===100-HAND_OF_ORDER_POWERS.reduce((n,p)=>n+p.cost*b.powerUses[p.id],0)&&
 b.pendingKind===null&&b.composureReady===false&&validWindow(b.division,'DIVISION',b,maxRound)&&validWindow(b.aftermath,'AFTERMATH',b,maxRound)&&[b.imbalanceAttempts,b.resistanceAttempts,b.intimidationAttempts,b.deprivationAttempts,b.divisionAttempts,b.aftermathAttempts,b.divisionApplications,b.aftermathApplications,b.enemyTravelMetres].every(n=>integer(n))&&
 validHandOfOrderSupportPieces(b.supportPieces,b.supportPieces.length>0)&&validHandOfOrderEnemyCharges(b.enemyCharges)&&b.enemyCharges.filter(c=>c.status==='SPENT').length===b.powerUses.ARC_BOLT+b.powerUses.MENTAL_PRESSURE&&
 b.supportPieces.filter(c=>c.status==='SPENT').length===b.divisionAttempts+b.aftermathAttempts&&b.divisionApplications<=b.divisionAttempts&&b.aftermathApplications<=b.aftermathAttempts;
}
export function validHandOfOrderInjuries(injuries:SliceInjury[],revision:number):boolean{return Array.isArray(injuries)&&new Set(injuries.map(i=>i.id)).size===injuries.length&&injuries.every(i=>shape(i,['id','severity','acquiredRevision','treatedRevision'])&&typeof i.id==='string'&&!!i.id&&['LIGHT','HEAVY'].includes(i.severity)&&integer(i.acquiredRevision,0,revision)&&(i.treatedRevision===null||integer(i.treatedRevision,i.acquiredRevision,revision)));}
const SOURCE_KEYS=['runId','revision','week','date','round','encounterId','targetId','attemptWeek','startHistoryIndex','targetName','targetAge','targetPathway','targetSequence','targetCore','targetWill','maxActionCount','actualBody','independentMind','enemyWeapon','weaponOwner','yardId','playerPosition','enemyPosition','enemyDistanceMetres','ordinaryExit','pursuit','thirdPartiesInArea','automaticAllyImmunity','freeSkillLibrary','playerHealth','playerMind','playerSpirituality','playerInjuries','playerRisk','physique','perception','will','knowledge','mastery','clubHeld','guardPlate','preparation','site','operation','originals','body','budget','finance','policy','randomSeed','randomCursor'];
export function validHandOfOrderCombatSource(x:HandOfOrderCombatSource):boolean{try{
 const p=x.site,prep=x.preparation,expected=structuredClone(prep.site);expected.playerLocation='ANNEX_A';expected.clockSeconds=p.clockSeconds;expected.playerTravelMetres=p.playerTravelMetres;
 const budget={...prep.after,actions:prep.after.actions-2,health:x.playerHealth,mind:x.playerMind,spirituality:x.playerSpirituality,mastery:x.mastery,injuries:x.playerInjuries,injuryRisk:x.playerRisk};
 return shape(x,SOURCE_KEYS)&&shape(x.body,Object.keys(combatBody(x.body)))&&validateHandOfOrderPreparation(prep)&&typeof x.runId==='string'&&!!x.runId&&integer(x.revision)&&integer(x.week,1)&&integer(x.round,1)&&integer(x.startHistoryIndex)&&x.attemptWeek===x.week&&x.week===prep.week&&same(x.date,prep.date)&&
 x.encounterId==='HAND_OF_ORDER_DISPUTE'&&x.targetId===HAND_OF_ORDER_TARGET_ID&&x.targetName==='布拉姆·温特'&&x.targetAge===45&&x.targetPathway==='original-caster'&&x.targetSequence===2&&x.targetCore===27&&x.targetWill===27&&x.maxActionCount===6&&
 x.actualBody===true&&x.independentMind===true&&x.enemyWeapon==='HO1-BRAM-ROD'&&x.weaponOwner===HAND_OF_ORDER_TARGET_ID&&x.yardId==='HO1-NEIGHBOR-ANNEX'&&x.playerPosition==='ANNEX_A'&&x.enemyPosition==='ANNEX_A'&&x.enemyDistanceMetres===2&&
 x.ordinaryExit==='OPEN'&&x.pursuit===false&&x.thirdPartiesInArea===0&&x.automaticAllyImmunity===false&&x.freeSkillLibrary===false&&[x.playerHealth,x.playerMind].every(n=>integer(n,1,100))&&integer(x.playerSpirituality,0,120)&&
 [x.physique,x.perception,x.will,x.knowledge].every(n=>integer(n,0,500))&&same({physique:x.physique,perception:x.perception,will:x.will,knowledge:x.knowledge},prep.after.coreStats)&&shape(x.mastery,MASTERY_IDS)&&Object.values(x.mastery).every(n=>integer(n,0,500))&&typeof x.clubHeld==='boolean'&&integer(x.playerRisk)&&validHandOfOrderInjuries(x.playerInjuries,x.revision)&&validHandOfOrderInjuries(x.body.enemyInjuries,x.revision)&&
 validHandOfOrderGuardPlate(x.guardPlate,x.week)&&x.guardPlate.location==='ANNEX_A'&&x.guardPlate.integrity<=prep.guardPlate.integrity&&same({...x.guardPlate,location:prep.guardPlate.location,integrity:prep.guardPlate.integrity},prep.guardPlate)&&same(p,expected)&&p.clockSeconds===prep.lifeClockSeconds+4+60*(x.round-1)&&integer(p.playerTravelMetres,prep.site.playerTravelMetres+4)&&
 p.volunteer.id==='CH3-MIRA'&&p.volunteer.age===43&&p.volunteer.alive&&p.volunteer.location==='OUTSIDE'&&p.guide.id==='GUIDE'&&p.guide.location==='OUTSIDE'&&[p.parcel,p.line,p.paper].every(item=>item.holder==='GUIDE'&&item.location==='OUTSIDE')&&
 same(x.operation,prep.operation)&&same(x.originals,prep.originals)&&same(x.budget,budget)&&same(x.finance,prep.finance)&&validHandOfOrderBody(x.body,x.round-1)&&x.body.enemyStatus==='RESISTING'&&x.body.enemyMind>0&&[x.body.division,x.body.aftermath].every(w=>!w||w.castAt<=p.clockSeconds&&w.expiresAt>p.clockSeconds)&&HAND_OF_ORDER_POLICIES.includes(x.policy)&&
 typeof x.randomSeed==='string'&&!!x.randomSeed&&integer(x.randomCursor)&&prep.runId===x.runId&&prep.randomSeed===x.randomSeed&&prep.randomCursor<=x.randomCursor&&prep.revision<x.revision;
}catch{return false;}}
export function replayHandOfOrderCombatRound(x: HandOfOrderCombatSource, stance: SliceStance): { round: SliceCombatRound; outcome: HandOfOrderResolution } {
  if (!validHandOfOrderCombatSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new Error('缺少真实原来源。');
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = createHandOfOrderRuntime(x), b = r.body;
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = handOfOrderActionCount(playerCountRoll), enemyCount = handOfOrderEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: HandOfOrderActionEvidence[] = [], enemies: HandOfOrderActionEvidence[] = [], remaining = { PLAYER: playerCount, ENEMY: enemyCount }; let retreat: SliceCombatRound['retreat'] = 'NONE';
  if(stance==='RETREAT'){retreat='SUCCESS';remaining.PLAYER=0;remaining.ENEMY=0;}
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) for (const actor of order) {
    if (!remaining[actor]) continue;
    remaining[actor]--; const index = players.length + enemies.length;
    if (actor === 'PLAYER') players.push(resolveHandOfOrderPlayerSlot(x, r, drawHandOfOrderAbility(rng, null, stance, x.policy), index, rng)); else enemies.push(resolveHandOfOrderEnemySlot(x, r, drawHandOfOrderEnemyAbility(rng), index, rng));
  }
  const sum = (a: HandOfOrderActionEvidence[], key: 'selfGain' | 'enemyReduction') => a.reduce((n, v) => n + v[key], 0);
  const playerAdvantage = Math.max(125, base(x.physique * .30 + x.perception * .20 + x.will * .35 + x.knowledge * .15, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, base(x.targetCore, x.body.enemyHealth, x.body.enemyMind, x.body.enemySpirituality, 100) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction'));
  const winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100, winner = retreat === 'SUCCESS' ? 'ENEMY' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  let playerHealth = x.playerHealth, playerRisk = x.playerRisk, outcome: HandOfOrderResolution = retreat === 'SUCCESS' ? 'RETREATED' : 'CONTINUE';
  const playerInjuries = structuredClone(x.playerInjuries); let consequenceWeights: SliceCombatRound['consequenceWeights'] = null, consequenceRoll: number | undefined, consequenceDomain: SliceCombatRound['consequenceDomain'];
  if (retreat !== 'SUCCESS') {
    const loser = winner === 'PLAYER' ? 'ENEMY' : 'PLAYER', attacks = loser === 'PLAYER' ? enemies : players, injuries = loser === 'PLAYER' ? playerInjuries : b.enemyInjuries;
    if (attacks.some(a => a.threatens && (a.attackKind === 'BODY' || a.attackKind === 'ARC' || a.attackKind === 'WOUND'))) {
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
  advanceHandOfOrderCombatClock(r,x.site.clockSeconds+elapsedSeconds-r.root.clockSeconds);
  const expiredPending=structuredClone([...r.expired,...r.pending]);r.pending=[];r.opening=null;b.pendingKind=null;b.composureReady=false;if(b.enemyHealth===0)b.weaponLocation='ANNEX_A';
  const cancelledWindows=[...players,...enemies].flatMap(a=>structuredClone(a.windowsCancelled));
  if(outcome!=='CONTINUE'){for(const key of ['division','aftermath'] as const){if(b[key])cancelledWindows.push(structuredClone(b[key]!));b[key]=null;}}
  const o: HandOfOrderRoundOutcome = { ...structuredClone(b), targetId: HAND_OF_ORDER_TARGET_ID, round: x.round, source: structuredClone(x), stance, continuing: outcome === 'CONTINUE',
    playerHealthAfter: playerHealth, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, playerInjuriesAfter: playerInjuries, playerRiskAfter: playerRisk, guardPlateAfter: structuredClone(r.guardPlate), masteryAfter: { ...r.mastery },
    siteAfter: structuredClone(r.root), operationAfter:structuredClone(x.operation), elapsedSeconds, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies, expiredPending,expiredWindows:structuredClone(r.expiredWindows),cancelledWindows };
  const round: SliceCombatRound = { round: x.round, stance, first, playerCount, enemyCount, playerCountRoll, enemyCountRoll,
    moves: [...players, ...enemies].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })),
    playerAdvantage, enemyAdvantage, winChance, winner, consequence: '', consequenceWeights, retreat, ...(consequenceDomain === undefined ? {} : { consequenceDomain }), ...(consequenceRoll === undefined ? {} : { consequenceRoll }),
    handOfOrderOutcome: o };
  round.consequence = handOfOrderCombatConsequence(round); return { round, outcome };
}
export function validateHandOfOrderRoundOutcome(v: unknown): v is HandOfOrderRoundOutcome { try { const o = v as HandOfOrderRoundOutcome; return !!o && same(o, replayHandOfOrderCombatRound(o.source, o.stance).round.handOfOrderOutcome); } catch { return false; } }
export function validateHandOfOrderCombatRound(round: SliceCombatRound): boolean { try { const o = round.handOfOrderOutcome; return !!o && same(round, replayHandOfOrderCombatRound(o.source, o.stance).round); } catch { return false; } }
export function nextHandOfOrderCombatSource(o:HandOfOrderRoundOutcome):HandOfOrderCombatSource{
 const spirituality=Math.min(120,o.playerSpiritualityAfter+12);
 return {...structuredClone(o.source),revision:o.source.revision+1,round:o.round+1,playerHealth:o.playerHealthAfter,playerMind:o.playerMindAfter,playerSpirituality:spirituality,playerInjuries:structuredClone(o.playerInjuriesAfter),playerRisk:o.playerRiskAfter,
 site:structuredClone(o.siteAfter),operation:structuredClone(o.operationAfter),body:combatBody(o),guardPlate:structuredClone(o.guardPlateAfter),mastery:{...o.masteryAfter},randomCursor:o.randomCursorAfter,
 budget:{...structuredClone(o.source.budget),health:o.playerHealthAfter,mind:o.playerMindAfter,spirituality,mastery:{...o.masteryAfter},injuries:structuredClone(o.playerInjuriesAfter),injuryRisk:o.playerRiskAfter}};
}
export function handOfOrderCombatConsequence(round: SliceCombatRound): string {
  const o = round.handOfOrderOutcome!, who = round.winner === 'PLAYER' ? '布拉姆' : '你'; let text = round.retreat === 'SUCCESS' ? '普通出口开放且没有追击，停止战斗后沿4米普通路离开。' : round.consequenceDomain === 'MENTAL' ? `${who}承受实际精神压力，精神减少10，没有新增身体伤口。` : round.consequenceDomain === 'BODY' ? `${who}承受实际身体打击或法术冲击，按共同伤势盘结算。` : '本轮下风没有实际攻击来源，不掷身体伤势盘。';
  if (o.playerHealthAfter === 0) text += '本人的原身体真实死亡，不能复活或离场。'; else if (o.enemyHealth === 0) text += '布拉姆原身体真实死亡，唯一原杖留地。'; else if (o.enemyStatus === 'SURRENDERED') text += '布拉姆因实际伤势或精神耗尽自主停止抵抗。';
  return text+` 本轮实际${o.elapsedSeconds}秒；${o.continuing?'仍有效的新术窗口按原截止时间继续，过期即止':'停止冲突并撤销未用窗口；活着才沿普通路4米4秒退出'}。已花灵性、精神不退，全部原人物与旧记录保持原样。`;
}
/** Positive allowlists at every nested boundary. Actual public check modifier labels are retained. */
const publicInjury=(i:SliceInjury)=>({id:i.id,severity:i.severity,acquiredRevision:i.acquiredRevision,treatedRevision:i.treatedRevision});
const publicPlate=(p:HandOfOrderGuardPlate)=>({id:p.id,owner:p.owner,holder:p.holder,location:p.location,integrity:p.integrity,acquiredWeek:p.acquiredWeek});
const publicWindow=(w:HandOfOrderWindow)=>({kind:w.kind,round:w.round,order:w.order,castAt:w.castAt,expiresAt:w.expiresAt,remaining:w.remaining,supportId:w.supportId});
const publicPending=(p:HandOfOrderPendingEffect)=>({id:p.id,owner:p.owner,kind:p.kind,createdAt:p.createdAt,expiresAt:p.expiresAt,remaining:p.remaining,openingId:p.openingId});
const publicOpening=(p:HandOfOrderVisibleOpening|null)=>p?({id:p.id,targetId:p.targetId,sourceOrder:p.sourceOrder,createdAt:p.createdAt,expiresAt:p.expiresAt,kind:p.kind,visible:p.visible}):null;
const publicCheck=(c:PublicCheckResult|null):PublicCheckResult|null=>c?({ability:c.ability,baseAbility:c.baseAbility,modifiers:c.modifiers.map(m=>({source:m.source,value:m.value})),effectiveAbility:c.effectiveAbility,difficulty:c.difficulty,chance:c.chance,roll:c.roll,tier:c.tier}):null;
export function projectHandOfOrderAction(a:HandOfOrderActionEvidence){return {
 order:a.order,actor:a.actor,id:a.id,planned:a.planned,selectedAbility:a.selectedAbility,fallbackReason:a.fallbackReason,mode:a.mode,label:a.label,
 selfGain:a.selfGain,enemyReduction:a.enemyReduction,threatens:a.threatens,mentalPressure:a.mentalPressure,attackKind:a.attackKind,rawContribution:a.rawContribution,rawReduction:a.rawReduction,
 paidCost:a.paidCost,mindCost:a.mindCost,physicalFactor:a.physicalFactor,check:publicCheck(a.check),succeeded:a.succeeded,resisted:a.resisted,
 pendingBefore:a.pendingBefore.map(publicPending),pendingAfter:a.pendingAfter.map(publicPending),pendingApplied:[...a.pendingApplied],masteryApplied:[...a.masteryApplied],openingBefore:publicOpening(a.openingBefore),openingAfter:publicOpening(a.openingAfter),
 guardPlateBefore:publicPlate(a.guardPlateBefore),guardPlateAfter:publicPlate(a.guardPlateAfter),plateWear:a.plateWear,atSeconds:a.atSeconds,elapsedSeconds:a.elapsedSeconds,travelMetres:a.travelMetres,
 playerMindAfter:a.playerMindAfter,playerSpiritualityAfter:a.playerSpiritualityAfter,enemySpiritualityAfter:a.enemySpiritualityAfter,windowGranted:a.windowGranted?publicWindow(a.windowGranted):null,
 windowsApplied:a.windowsApplied.map(w=>({kind:w.kind,amount:w.amount,supportId:w.supportId})),windowsExpired:a.windowsExpired.map(publicWindow),windowsCancelled:a.windowsCancelled.map(publicWindow),
 supportId:a.supportId,supportWearPaid:a.supportWearPaid,enemyChargeId:a.enemyChargeId,resistanceChance:a.resistanceChance,resistanceRoll:a.resistanceRoll,
};}
export type HandOfOrderPublicActionEvidence=ReturnType<typeof projectHandOfOrderAction>;
function publicBody(b:HandOfOrderCombatBody){return {
 enemyHealth:b.enemyHealth,enemyMind:b.enemyMind,enemySpirituality:b.enemySpirituality,enemyStatus:b.enemyStatus,enemyInjuries:b.enemyInjuries.map(publicInjury),enemyRisk:b.enemyRisk,weaponLocation:b.weaponLocation,
 powerUses:{ARC_BOLT:b.powerUses.ARC_BOLT,WARD:b.powerUses.WARD,COMPOSE:b.powerUses.COMPOSE,MENTAL_PRESSURE:b.powerUses.MENTAL_PRESSURE},pendingKind:b.pendingKind,composureReady:b.composureReady,
 imbalanceAttempts:b.imbalanceAttempts,resistanceAttempts:b.resistanceAttempts,intimidationAttempts:b.intimidationAttempts,deprivationAttempts:b.deprivationAttempts,divisionAttempts:b.divisionAttempts,aftermathAttempts:b.aftermathAttempts,divisionApplications:b.divisionApplications,aftermathApplications:b.aftermathApplications,enemyTravelMetres:b.enemyTravelMetres,
 supportPieces:b.supportPieces.map(p=>({id:p.id,ownerId:p.ownerId,location:p.location,quantity:p.quantity,status:p.status,wear:p.wear,usedRound:p.usedRound,usedOrder:p.usedOrder})),enemyCharges:b.enemyCharges.map(c=>({id:c.id,ownerId:c.ownerId,status:c.status,usedRound:c.usedRound,usedOrder:c.usedOrder})),division:b.division?publicWindow(b.division):null,aftermath:b.aftermath?publicWindow(b.aftermath):null,
};}
function publicSite(p:HandOfOrderSite){return {
 siteId:p.siteId,playerLocation:p.playerLocation,playerTravelMetres:p.playerTravelMetres,guideTravelMetres:p.guideTravelMetres,clockSeconds:p.clockSeconds,
 guide:{id:p.guide.id,name:p.guide.name,location:p.guide.location},volunteer:{id:p.volunteer.id,name:p.volunteer.name,age:p.volunteer.age,alive:p.volunteer.alive,independentMind:p.volunteer.independentMind,willing:p.volunteer.willing,location:p.volunteer.location,health:p.volunteer.health,mind:p.volunteer.mind,injuries:p.volunteer.injuries.map(publicInjury)},
 parcel:{id:p.parcel.id,owner:p.parcel.owner,quantity:p.parcel.quantity,massGrams:p.parcel.massGrams,sealed:p.parcel.sealed,confidential:p.parcel.confidential,holder:p.parcel.holder,location:p.parcel.location,handovers:p.parcel.handovers,returns:p.parcel.returns},
 line:{id:p.line.id,owner:p.line.owner,quantity:p.line.quantity,holder:p.line.holder,location:p.line.location,isWall:p.line.isWall,returns:p.line.returns},paper:{id:p.paper.id,owner:p.paper.owner,quantity:p.paper.quantity,holder:p.paper.holder,location:p.paper.location,text:p.paper.text},table:{id:p.table.id,location:p.table.location,thirdParties:p.table.thirdParties},
};}
/** All live operation inputs are closed before optional combat. Old case journals are never publicized by combat. */
export function projectHandOfOrderRoundOutcome(o:HandOfOrderRoundOutcome){return {
 ...publicBody(o),targetId:o.targetId,round:o.round,stance:o.stance,continuing:o.continuing,playerHealthAfter:o.playerHealthAfter,playerMindAfter:o.playerMindAfter,playerSpiritualityAfter:o.playerSpiritualityAfter,playerInjuriesAfter:o.playerInjuriesAfter.map(publicInjury),playerRiskAfter:o.playerRiskAfter,
 guardPlateAfter:publicPlate(o.guardPlateAfter),masteryAfter:Object.fromEntries(MASTERY_IDS.map(id=>[id,o.masteryAfter[id]??0])),siteAfter:publicSite(o.siteAfter),operationAfter:{door:o.operationAfter.door},
 elapsedSeconds:o.elapsedSeconds,playerActions:o.playerActions.map(projectHandOfOrderAction),enemyActions:o.enemyActions.map(projectHandOfOrderAction),expiredPending:o.expiredPending.map(publicPending),expiredWindows:o.expiredWindows.map(publicWindow),cancelledWindows:o.cancelledWindows.map(publicWindow),
};}
export type HandOfOrderPublicRoundOutcome=ReturnType<typeof projectHandOfOrderRoundOutcome>;
export function projectHandOfOrderCombat(s:SliceState){
 const e=s.handOfOrder.encounter,p=s.handOfOrder.life.site,last=s.combat?.encounterId==='HAND_OF_ORDER_DISPUTE'?s.combat.lastRound?.handOfOrderOutcome:e.terminal?s.combatHistory[e.terminal.historyIndex]?.handOfOrderOutcome:null;
 return {enemyName:isHandOfOrder(s)?'布拉姆·温特（45岁，序列2施术者）':'',targetId:e.targetId,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,weaponLocation:e.weaponLocation,pendingKind:e.pendingKind,composureReady:e.composureReady,powerUses:publicBody(e).powerUses,maxActionCount:6,
 playerPosition:p?.playerLocation??'OUTSIDE',enemyPosition:e.enemyPosition,enemyDistanceMetres:p?.playerLocation==='ANNEX_A'?2:6,exitMetres:p?.playerLocation==='ANNEX_A'?4:0,clockSeconds:p?.clockSeconds??0,playerTravelMetres:p?.playerTravelMetres??0,enemyTravelMetres:e.enemyTravelMetres,
 supportPieces:e.supportPieces.map(p=>({id:p.id,status:p.status,wear:p.wear})),enemyCharges:e.enemyCharges.map(c=>({id:c.id,status:c.status})),guardPlate:s.handOfOrder.life.guardPlate?publicPlate(s.handOfOrder.life.guardPlate):null,
 windows:[e.division,e.aftermath].flatMap(w=>w?[{kind:w.kind,remainingSeconds:Math.max(0,w.expiresAt-(p?.clockSeconds??0)),remaining:w.remaining}]:[]),
 lastActionSequence:last?[...last.playerActions,...last.enemyActions].sort((a,b)=>a.order-b.order).map(projectHandOfOrderAction):[],countWheel:HAND_OF_ORDER_COUNT_WHEEL.map(r=>({id:r.id,label:r.label,weight:r.weight})),enemyCountWheel:HAND_OF_ORDER_ENEMY_COUNT_WHEEL.map(r=>({id:r.id,label:r.label,weight:r.weight})),enemyAbilityWheel:HAND_OF_ORDER_ENEMY_ABILITY_WHEEL.map(r=>({id:r.id,label:r.label,weight:r.weight})),
 summary:'战场划分与余波控制各耗8灵性2精神及一枚实有护片，知识18后还须通过布拉姆62%独立抵抗；失败总耗4精神。划分20秒内只给本人下一真实身体行动+35；余波20秒内对下一可见身体或弧光至多减30，原护板应用时磨损15，精神无效。旧抗衡6灵性1精神仅挡普通身体−45并磨损同一板15；同一次冲击不重复用板。旧六槽相对权重30/15/25/10/15/5，新两槽各20；核心体30%感20%意35%知15%，普通4米出口开放。',
 };
}
export type HandOfOrderCombatProjection=ReturnType<typeof projectHandOfOrderCombat>;
