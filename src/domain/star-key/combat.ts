import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import { PLANESWALKER_COUNT_WHEEL, planeswalkerActionCount } from '../planeswalker/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { STAR_KEY_TARGET_ID, STAR_KEY_SITE, STAR_KEY_POWER_IDS, STAR_KEY_POWERS, STAR_KEY_POLICIES,
 combatBody, initialStarKeyBody, hasStarKeyDisputeOpponent, validateStarKeyPreparation, validStarKeyMaterials, validStarKeyScene,
 type StarKeyCombatBody, type StarKeyEnemyIntent, type StarKeyPreparation, type StarKeyMaterials, type StarKeyScene, type StarKeyPolicy } from './encounter.js';

/** Original bounded S1 design. Actual Door predecessor core, checks, resource
 * scales and all fifteen inherited masteries are preserved without a library. */
export const STAR_KEY_COUNT_WHEEL=PLANESWALKER_COUNT_WHEEL;
export const STAR_KEY_ENEMY_COUNT_WHEEL=PLANESWALKER_COUNT_WHEEL;
export const starKeyActionCount=planeswalkerActionCount;
export const starKeyEnemyActionCount=planeswalkerActionCount;
export const STAR_KEY_COMBAT_CONSTANTS={weights:{physique:.35,perception:.25,will:.25,knowledge:.15},tier:1250,floor:125,maxSpirituality:120,continuingRecovery:12,enemyPhysique:24,endpointLocationCost:8,endpointLocationMindCost:2,endpointLocationAid:30,anchorMaintenanceCost:7,anchorMaintenanceMindCost:2,anchorMaintenanceReduction:30,windowSeconds:20,resistanceChance:30} as const;
export const ENDPOINT_LOCATION='door.s1.endpoint-location',ANCHOR_MAINTENANCE='door.s1.anchor-maintenance';
export const STAR_KEY_NEW_ABILITY_IDS=[ENDPOINT_LOCATION,ANCHOR_MAINTENANCE] as const;
export const STAR_KEY_INHERITED_SKILL_IDS=['door.s9.door-opening','door.s8.tricks','door.s7.astrology','door.s7.divination-interference','door.s6.recording','door.s6.release','door.s5.travel','door.s5.invisible-hand','door.s4.space-hiding','door.s4.space-pocket','door.s4.banishment','door.s3.star-wandering','door.s3.astral-positioning','door.s2.symbolic-transit','door.s2.pattern-reproduction'] as const;
const TRICKS='door.s8.tricks',TRAVEL='door.s5.travel';
export type StarKeyMoveId=typeof STAR_KEY_INHERITED_SKILL_IDS[number]|typeof STAR_KEY_NEW_ABILITY_IDS[number]|'STRIKE'|'BLOCK'|'EVADE'|'OBSERVE'|'ACCIDENT';
const inheritedLabels:Record<typeof STAR_KEY_INHERITED_SKILL_IDS[number],string>={
 'door.s9.door-opening':'开门：原通行室遮门不在前庭，条件不可用',
 'door.s8.tricks':'继承小电击：6灵性、知识16，优势36×实际掌握效力',
 'door.s7.astrology':'占星术：本场缺少原占卜条件，条件不可用',
 'door.s7.divination-interference':'占卜干扰：对手未作占卜，条件不可用',
 'door.s6.recording':'记录：没有可在本场刻录的原介质，条件不可用',
 'door.s6.release':'释放：本场未取用任何实际原记录，条件不可用',
 'door.s5.travel':'继承旅行避让：6灵性、感知16，减势22×实际掌握效力',
 'door.s5.invisible-hand':'隐形之手：本场无已核实操作条件，条件不可用',
 'door.s4.space-hiding':'空间隐匿：本场无已核实隐匿空间，条件不可用',
 'door.s4.space-pocket':'空间口袋：本场无可用原容器，条件不可用',
 'door.s4.banishment':'放逐：本场无已核实去返端点，条件不可用',
 'door.s3.star-wandering':'星际漫游：本场无当次异星防护与行程，条件不可用',
 'door.s3.astral-positioning':'星界定位：本场没有当次异星定位任务，条件不可用',
 'door.s2.symbolic-transit':'象征通行：原近远垫在通行室内，条件不可用',
 'door.s2.pattern-reproduction':'光纹复现：原灯与屏不在前庭，条件不可用',
};
export const STAR_KEY_ABILITIES:readonly{id:StarKeyMoveId;label:string;weight:number;stance:SliceStance|null}[]=[
 {id:'STRIKE',label:'本人普通打击',weight:12,stance:'ATTACK'},{id:'BLOCK',label:'普通防备',weight:5,stance:'DEFEND'},
 {id:'EVADE',label:'普通避让',weight:5,stance:'DEFEND'},{id:'OBSERVE',label:'实际侧步观察当前位置与待执行动作',weight:4,stance:'PREPARE'},
 ...STAR_KEY_INHERITED_SKILL_IDS.map(id=>({id,label:inheritedLabels[id],weight:id===TRICKS||id===TRAVEL?7:1,stance:(id===TRICKS?'ATTACK':'CONTROL') as SliceStance})),
 {id:ENDPOINT_LOCATION,label:'端点定位：8灵性2精神、感知18，下一合格自身行动辅助30',weight:14,stance:'CONTROL'},
 {id:ANCHOR_MAINTENANCE,label:'锚点维系：7灵性2精神、知识18，同一次未来空间或精神贡献减30',weight:14,stance:'DEFEND'},
 {id:'ACCIDENT',label:'判断失衡：−22.5',weight:3,stance:null},
];
export const STAR_KEY_PLAYER_ABILITIES=STAR_KEY_ABILITIES;
export const STAR_KEY_ENEMY_ABILITY_WHEEL:readonly SliceWheelEntry[]=[
 {id:'SPATIAL_MARK',label:'空间偏移印记：7灵性与1枚原印记、空间贡献75，无直接身体伤害',weight:30},
 {id:'MENTAL_MARK',label:'精神牵引印记：7灵性与1枚原印记、精神贡献65',weight:25},
 {id:'BODY_STRIKE',label:'自有原棍普通打击20×身体',weight:25},
 {id:'FEINT',label:'侧移1米并横棍遮挡：3灵性、每轮一次',weight:15},
 {id:'ACCIDENT',label:'判断偏差−22.5',weight:5},
];
export const isStarKey=(s:SliceState)=>s.progression.pathwayId==='door'&&s.progression.sequence===1;
const tickets=(stance:SliceStance|null)=>STAR_KEY_ABILITIES.map(a=>a.weight*(a.stance===stance&&stance!==null?5:4));
export function starKeyAbilityWheel(_s:SliceState,stance:SliceStance|null):SliceWheelEntry[]{const w=tickets(stance),total=w.reduce((n,v)=>n+v,0);return STAR_KEY_ABILITIES.map((a,i)=>({id:a.id,label:a.label,weight:w[i]!/total*100}));}
export function drawStarKeyAbility(rng:ActionRandomStream,_s:SliceState|null,stance:SliceStance|null):StarKeyMoveId{const w=tickets(stance);let n=rng.nextInt(1,w.reduce((a,b)=>a+b,0));for(const[i,a]of STAR_KEY_ABILITIES.entries()){n-=w[i]!;if(n<=0)return a.id;}throw new Error('行动盘无效。');}
export function drawStarKeyEnemyAbility(rng:ActionRandomStream):StarKeyEnemyIntent{let n=rng.nextInt(1,100);for(const a of STAR_KEY_ENEMY_ABILITY_WHEEL){n-=a.weight;if(n<=0)return a.id as StarKeyEnemyIntent;}throw new Error('对手行动盘无效。');}
const same=(a:unknown,b:unknown)=>a===b||(a!==undefined&&b!==undefined&&stableStringify(a)===stableStringify(b));
const integer=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER):n is number=>Number.isSafeInteger(n)&&(n as number)>=min&&(n as number)<=max;
const shape=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...keys].sort());
const physicalAt=(n:number)=>n>75?1:n>50?.95:n>25?.9:.8;
const masteryFactor=(n:number)=>.65+.35*Math.max(0,Math.min(500,n))/500;
export interface StarKeyCombatSource {
 runId:string;revision:number;week:number;date:PublicGameDate;round:number;encounterId:'STAR_KEY_DISPUTE';targetId:typeof STAR_KEY_TARGET_ID;
 attemptWeek:number;startHistoryIndex:number;targetName:'罗温·维尔';targetAge:44;targetSequence:1;targetCore:24;actualBody:true;independentMind:true;playerBodyId:string;
 enemyWeapon:'SK1-ROWAN-CLUB';weaponOwner:typeof STAR_KEY_TARGET_ID;ordinaryExit:'OPEN';pursuit:false;thirdPartiesInArea:0;policy:StarKeyPolicy;clubHeld:boolean;
 playerHealth:number;playerMind:number;playerSpirituality:number;playerInjuries:SliceInjury[];playerRisk:number;physique:number;perception:number;will:number;knowledge:number;mastery:Record<string,number>;
 preparation:StarKeyPreparation;root:StarKeyScene;materials:StarKeyMaterials;body:StarKeyCombatBody;randomSeed:string;randomCursor:number;
}
export function currentStarKeyCombatSource(s:SliceState):StarKeyCombatSource|null {
 if(!hasStarKeyDisputeOpponent(s))return null;const e=s.starKey.encounter,c=s.combat!;
 return{runId:s.runId,revision:s.revision,week:s.week,date:{...s.date},round:c.round,encounterId:'STAR_KEY_DISPUTE',targetId:STAR_KEY_TARGET_ID,attemptWeek:e.attemptWeek!,startHistoryIndex:e.startHistoryIndex!,targetName:'罗温·维尔',targetAge:44,targetSequence:1,targetCore:24,actualBody:true,independentMind:true,playerBodyId:`${s.runId}:body`,enemyWeapon:'SK1-ROWAN-CLUB',weaponOwner:STAR_KEY_TARGET_ID,ordinaryExit:'OPEN',pursuit:false,thirdPartiesInArea:0,policy:e.policy,clubHeld:s.town.clubLocation==='HAND',playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,playerInjuries:structuredClone(s.injuries),playerRisk:s.injuryRisk,...s.character.coreStats,mastery:{...s.progression.mastery},preparation:structuredClone(e.preparation!),root:structuredClone(e.scene),materials:structuredClone(e.materials),body:combatBody(e),randomSeed:s.random.seed,randomCursor:s.random.cursor};
}
export interface StarKeyPendingAction {id:string;planned:StarKeyEnemyIntent;actual:StarKeyEnemyIntent;declaredAt:number;observedAt:number|null;observationSeconds:0;conditionVersion:number;visible:boolean;targetId:typeof STAR_KEY_TARGET_ID;enemyCoordinate:6|7;playerCoordinate:4;attackKind:'NONE'|'BODY'|'SPATIAL'|'MENTAL'}
export interface StarKeyWindow {id:string;kind:'ENDPOINT_LOCATION'|'ANCHOR_MAINTENANCE';createdAt:number;expiresAt:number;openedOrder:number;conditionVersion:number;targetActionId:string;targetId:typeof STAR_KEY_TARGET_ID;enemyCoordinate:6|7;playerCoordinate:4;magnitude:30}
export interface StarKeyWindows {endpointLocation:StarKeyWindow|null;anchorMaintenance:StarKeyWindow|null}
export interface StarKeyActionEvidence {
 order:number;actor:'PLAYER'|'ENEMY';id:string;planned:string;selectedAbility:string;fallbackReason:string|null;label:string;selfGain:number;enemyReduction:number;threatens:boolean;mentalPressure:boolean;attackKind:'NONE'|'BODY'|'SPATIAL'|'MENTAL';rawContribution:number;rawReduction:number;
 paidCost:number;mindCost:number;physicalFactor:number;check:PublicCheckResult|null;resistanceRoll:number|null;resistanceChance:number|null;succeeded:boolean;
 finiteResult:'NONE'|'UNAVAILABLE'|'ALREADY_ATTEMPTED'|'INSUFFICIENT'|'FAILED'|'RESISTED'|'PENDING'|'APPLIED';windowsBefore:StarKeyWindows;windowsAfter:StarKeyWindows;pendingBefore:StarKeyPendingAction|null;pendingAfter:StarKeyPendingAction|null;masteryApplied:string[];countered:string[];
 consumedMarkId:string|null;materialsBefore:StarKeyMaterials;materialsAfter:StarKeyMaterials;
 conditionVersionBefore:number;conditionVersionAfter:number;atSeconds:number;elapsedSeconds:5;travelMetres:number;travelPath:number[];lateralTravelPath:number[];randomCursorBefore:number;randomCursorAfter:number;playerMindAfter:number;playerSpiritualityAfter:number;enemyMindAfter:number;enemySpiritualityAfter:number;
}
export interface StarKeyRuntime {body:StarKeyCombatBody;root:StarKeyScene;materials:StarKeyMaterials;playerH:number;playerM:number;playerS:number;mastery:Record<string,number>;windows:StarKeyWindows;expiredWindows:StarKeyWindow[];pendingEnemyAction:StarKeyPendingAction|null;endpointLocationAttempted:boolean;anchorMaintenanceAttempted:boolean;feintUsed:boolean}
export function createStarKeyRuntime(x:StarKeyCombatSource):StarKeyRuntime{return{body:structuredClone(x.body),root:structuredClone(x.root),materials:structuredClone(x.materials),playerH:x.playerHealth,playerM:x.playerMind,playerS:x.playerSpirituality,mastery:{...x.mastery},windows:{endpointLocation:null,anchorMaintenance:null},expiredWindows:[],pendingEnemyAction:null,endpointLocationAttempted:false,anchorMaintenanceAttempted:false,feintUsed:false};}
const active=(r:StarKeyRuntime)=>r.root.playerLocation==='YARD'&&r.root.playerCoordinate===4&&r.root.ordinaryExit==='OPEN'&&r.body.enemyStatus==='RESISTING'&&r.body.enemyHealth>0&&r.body.enemyMind>0&&r.playerH>0&&r.playerM>0;
const observed=(r:StarKeyRuntime)=>active(r)&&r.root.visibleBodyLine&&r.root.observedConditionVersion===r.root.conditionVersion;
function invalidate(r:StarKeyRuntime,key:keyof StarKeyWindows):void{const w=r.windows[key];if(w)r.expiredWindows.push(structuredClone(w));r.windows[key]=null;}
const sameEndpoint=(r:StarKeyRuntime,w:StarKeyWindow)=>w.conditionVersion===r.root.conditionVersion&&w.enemyCoordinate===r.root.enemyCoordinate&&w.playerCoordinate===r.root.playerCoordinate&&w.targetId===STAR_KEY_TARGET_ID;
export function advanceStarKeyCombatClock(r:StarKeyRuntime,seconds:number):void {
 if(!integer(seconds))throw new Error('实际时间无效。');r.root.clockSeconds+=seconds;r.root.externalSeconds+=seconds;
 for(const key of ['endpointLocation','anchorMaintenance'] as const){const w=r.windows[key];if(w&&(w.expiresAt<=r.root.clockSeconds||!observed(r)||!sameEndpoint(r,w)))invalidate(r,key);}
}
/** Declaration is the visible start of the already selected action, inside its
 * five-second slot. It neither consumes a second extra slot nor reveals hidden
 * plans. The paid anchor can affect only this exact still-pending mark. A
 * feint starts only on a visible line: its one-metre move is seen before the
 * club occludes the line, so the retained coordinate is never a hidden reveal. */
export function declareStarKeyEnemyAction(x:StarKeyCombatSource,r:StarKeyRuntime,planned:StarKeyEnemyIntent,index:number):StarKeyPendingAction {
 if(!active(r)||r.pendingEnemyAction||![...STAR_KEY_ENEMY_ABILITY_WHEEL.map(a=>a.id),'OBSERVE'].includes(planned))throw new Error('不能覆盖待执行动作或替已停战者行动。');
 const power=STAR_KEY_POWERS.find(p=>p.id===planned),mark=planned==='SPATIAL_MARK'||planned==='MENTAL_MARK';
 const actual:StarKeyEnemyIntent=power&&(r.body.enemySpirituality<power.cost||mark&&!r.materials.marks.some(m=>m.status==='HELD'))?'BODY_STRIKE':planned==='FEINT'&&(r.feintUsed||!observed(r))?'OBSERVE':planned;
 const visible=observed(r);r.pendingEnemyAction={id:`${x.runId}:SK1-PENDING:${x.round}:${index}`,planned,actual,declaredAt:r.root.clockSeconds,observedAt:visible?r.root.clockSeconds:null,observationSeconds:0,conditionVersion:r.root.conditionVersion,visible,targetId:STAR_KEY_TARGET_ID,enemyCoordinate:r.root.enemyCoordinate,playerCoordinate:4,attackKind:actual==='BODY_STRIKE'?'BODY':actual==='SPATIAL_MARK'?'SPATIAL':actual==='MENTAL_MARK'?'MENTAL':'NONE'};
 return structuredClone(r.pendingEnemyAction);
}
function baseAction(r:StarKeyRuntime,actor:'PLAYER'|'ENEMY',id:string,order:number,rng:ActionRandomStream):StarKeyActionEvidence {
 advanceStarKeyCombatClock(r,0);
 return{order,actor,id,planned:id,selectedAbility:id,fallbackReason:null,label:'',selfGain:0,enemyReduction:0,threatens:false,mentalPressure:false,attackKind:'NONE',rawContribution:0,rawReduction:0,paidCost:0,mindCost:0,physicalFactor:physicalAt(actor==='PLAYER'?r.playerH:r.body.enemyHealth),check:null,resistanceRoll:null,resistanceChance:null,succeeded:false,finiteResult:'NONE',windowsBefore:structuredClone(r.windows),windowsAfter:structuredClone(r.windows),pendingBefore:structuredClone(r.pendingEnemyAction),pendingAfter:null,masteryApplied:[],countered:[],consumedMarkId:null,materialsBefore:structuredClone(r.materials),materialsAfter:structuredClone(r.materials),conditionVersionBefore:r.root.conditionVersion,conditionVersionAfter:r.root.conditionVersion,atSeconds:r.root.clockSeconds,elapsedSeconds:5,travelMetres:0,travelPath:[actor==='PLAYER'?r.root.playerCoordinate:r.root.enemyCoordinate],lateralTravelPath:[0],randomCursorBefore:rng.cursor,randomCursorAfter:rng.cursor,playerMindAfter:r.playerM,playerSpiritualityAfter:r.playerS,enemyMindAfter:r.body.enemyMind,enemySpiritualityAfter:r.body.enemySpirituality};
}
function closeAction(a:StarKeyActionEvidence,r:StarKeyRuntime,rng:ActionRandomStream):StarKeyActionEvidence{advanceStarKeyCombatClock(r,5);a.windowsAfter=structuredClone(r.windows);a.pendingAfter=structuredClone(r.pendingEnemyAction);a.materialsAfter=structuredClone(r.materials);a.conditionVersionAfter=r.root.conditionVersion;a.randomCursorAfter=rng.cursor;a.playerMindAfter=r.playerM;a.playerSpiritualityAfter=r.playerS;a.enemyMindAfter=r.body.enemyMind;a.enemySpiritualityAfter=r.body.enemySpirituality;a.threatens=a.attackKind==='BODY'&&a.selfGain>0;a.mentalPressure=a.attackKind==='MENTAL'&&a.selfGain>0;a.label+=` 实际5秒，条件${r.root.conditionVersion}，本人灵性${r.playerS}、精神${r.playerM}，对手灵性${r.body.enemySpirituality}。`;return a;}
function ordinary(x:StarKeyCombatSource,r:StarKeyRuntime,a:StarKeyActionEvidence,why:string,attack=false){a.selectedAbility=attack?'STRIKE':'BLOCK';a.fallbackReason=why||null;a.label=why+(attack?'本人用原身体普通打击。':'本人普通防备。');a.succeeded=true;if(attack){const target=r.root.enemyCoordinate;a.selfGain=(x.clubHeld?16:12)*a.physicalFactor;a.attackKind='BODY';a.travelMetres=2*(target-4);a.travelPath=[4,target,4];r.root.playerTravelMetres+=a.travelMetres;a.label+=`本人实际走近并退回同一出口点，共${a.travelMetres}米。`;}else a.enemyReduction=10;}
function pay(r:StarKeyRuntime,a:StarKeyActionEvidence,s:number,m=0){if(r.playerS<s||r.playerM<=m)return false;r.playerS-=s;r.playerM-=m;r.body.totalOwnerMindSpent+=m;a.paidCost=s;a.mindCost=m;return true;}
function check(x:StarKeyCombatSource,a:StarKeyActionEvidence,ability:'knowledge'|'perception',difficulty:number,rng:ActionRandomStream){a.check=resolveNormalCheck({ability,baseAbility:x[ability],difficulty,modifiers:[],roll:rng.nextInt(1,100)});a.succeeded=['SUCCESS','GREAT_SUCCESS'].includes(a.check.tier);a.label+=`${ability==='perception'?'感知':'知识'}检定${a.check.roll}，${a.succeeded?'成功':'失败'}。`;return a.succeeded;}
function resist(a:StarKeyActionEvidence,rng:ActionRandomStream){a.resistanceChance=30;a.resistanceRoll=rng.nextInt(1,100);if(a.resistanceRoll<=30){a.succeeded=false;a.finiteResult='RESISTED';a.label+='对方实际抵抗，成本保留。';return false;}return true;}
function gainMastery(r:StarKeyRuntime,a:StarKeyActionEvidence,id:string){r.mastery[id]=Math.min(500,(r.mastery[id]??0)+8);a.masteryApplied.push(id);}
function window(r:StarKeyRuntime,kind:StarKeyWindow['kind'],order:number,p:StarKeyPendingAction):StarKeyWindow{return{id:`SK1-${kind}-${r.root.clockSeconds}-${order}`,kind,createdAt:r.root.clockSeconds,expiresAt:r.root.clockSeconds+20,openedOrder:order,conditionVersion:r.root.conditionVersion,targetActionId:p.id,targetId:p.targetId,enemyCoordinate:p.enemyCoordinate,playerCoordinate:4,magnitude:30};}
function pendingObserved(r:StarKeyRuntime,p:StarKeyPendingAction|null):p is StarKeyPendingAction{return !!p&&observed(r)&&p.visible&&p.observedAt!==null&&p.observedAt<=r.root.clockSeconds&&p.conditionVersion===r.root.conditionVersion&&p.enemyCoordinate===r.root.enemyCoordinate&&p.playerCoordinate===r.root.playerCoordinate&&p.targetId===STAR_KEY_TARGET_ID;}
export function resolveStarKeyPlayerSlot(x:StarKeyCombatSource,r:StarKeyRuntime,id:StarKeyMoveId,order:number,rng:ActionRandomStream):StarKeyActionEvidence {
 if(!STAR_KEY_ABILITIES.some(a=>a.id===id))throw new Error('未知本人动作。');const a=baseAction(r,'PLAYER',id,order,rng);
 if(!active(r)){a.finiteResult='UNAVAILABLE';a.label='本人或对手已离场、死亡或停止抵抗，没有新效果。';return closeAction(a,r,rng);}
 if(x.policy==='ORDINARY'&&id.startsWith('door.')){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'预先选择只作普通行动；');}
 else if(id===ENDPOINT_LOCATION||id===ANCHOR_MAINTENANCE){
  const anchor=id===ANCHOR_MAINTENANCE,allowed=x.policy==='ALL'||x.policy===(anchor?'ANCHOR_MAINTENANCE':'ENDPOINT_LOCATION'),attempted=anchor?r.anchorMaintenanceAttempted:r.endpointLocationAttempted,p=r.pendingEnemyAction;
  if(!allowed){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'预先策略未允许这项新能力；');}
  else if(attempted){a.finiteResult='ALREADY_ATTEMPTED';ordinary(x,r,a,'本轮已经实际尝试，不重骰、不延长窗口；');}
  else if(!pendingObserved(r,p)||anchor&&!['SPATIAL','MENTAL'].includes(p.attackKind)){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,anchor?'没有同一已观察、仍待执行的空间或精神印记与已知当前端点；':'没有同一已观察的待执行目标与当前位置；');}
  else if(!pay(r,a,anchor?7:8,2)){a.finiteResult='INSUFFICIENT';ordinary(x,r,a,'灵性或精神不足，能力未施放；');}
  else{
   if(anchor){r.anchorMaintenanceAttempted=true;r.body.anchorMaintenanceAttempts++;}else{r.endpointLocationAttempted=true;r.body.endpointLocationAttempts++;}
   a.label=anchor?'只维系眼前已知端点，等待同一次已观察印记实际施出。':'只据眼前已观察目标与当前端点，等待本人下一合格独立行动。';
   if(!check(x,a,anchor?'knowledge':'perception',18,rng))a.finiteResult='FAILED';
   else{if(anchor)r.body.anchorMaintenanceChecks++;else r.body.endpointLocationChecks++;if(resist(a,rng)){if(anchor)r.windows.anchorMaintenance=window(r,'ANCHOR_MAINTENANCE',order,p);else r.windows.endpointLocation=window(r,'ENDPOINT_LOCATION',order,p);a.finiteResult='PENDING';a.label+='窗口最多20秒，本槽没有贡献或掌握奖励。';}}
  }
 }else if(id==='STRIKE')ordinary(x,r,a,'',true);
 else if(id==='BLOCK'||id==='EVADE')ordinary(x,r,a,'');
 else if(id==='OBSERVE'){
  a.label='本人实际向侧面走一米观察当前位置，再走一米回到同一出口路线。';a.travelMetres=2;a.lateralTravelPath=[0,1,0];r.root.playerTravelMetres+=2;r.root.visibleBodyLine=true;r.root.observedConditionVersion=r.root.conditionVersion;a.succeeded=true;
  if(r.pendingEnemyAction){r.pendingEnemyAction.visible=true;r.pendingEnemyAction.conditionVersion=r.root.conditionVersion;r.pendingEnemyAction.enemyCoordinate=r.root.enemyCoordinate;r.pendingEnemyAction.observedAt=r.root.clockSeconds;}
 }else if(id==='ACCIDENT'){a.selfGain=-22.5;a.label='判断失衡，固定−22.5，不重抽。';}
 else if(id===TRICKS||id===TRAVEL){
  const travel=id===TRAVEL;
  if(!observed(r)){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'当前视线或施术线路不清；');}
  else if(!pay(r,a,6)){a.finiteResult='INSUFFICIENT';ordinary(x,r,a,'不足原能力所需6灵性；',!travel);}
  else{a.label=travel?'按既有条件作有限旅行避让。':'沿清晰线路使用既有小电击。';if(check(x,a,travel?'perception':'knowledge',16,rng)){if(travel){a.enemyReduction=22*masteryFactor(x.mastery[id]??0);a.travelMetres=2;a.lateralTravelPath=[0,1,0];r.root.playerTravelMetres+=2;r.body.inheritedSuccesses.travel++;a.label+='本人沿眼前已确认的侧向0米→1米→0米作同一原身体的有限移步，共2米，5秒内回到原出口点。';}else{a.selfGain=36*masteryFactor(x.mastery[id]??0);a.attackKind='BODY';r.body.inheritedSuccesses.tricks++;}gainMastery(r,a,id);a.finiteResult='APPLIED';a.label+='原成本与既有掌握效力保留；没有异星行程或原库存补发。';}else a.finiteResult='FAILED';}
 }else{a.selectedAbility='OBSERVE';a.finiteResult='UNAVAILABLE';a.fallbackReason=inheritedLabels[id];a.label=a.fallbackReason+'；本槽普通观察，不施法、不消费未持有记录、不制造效果或掌握。';}
 a.rawContribution=a.selfGain;a.rawReduction=a.enemyReduction;
 const aid=r.windows.endpointLocation;
 // Only the next eligible actual OWN action applies the paid clue. Opening any
 // window or merely observing cannot consume it for mastery or immediate gain.
 if(aid&&aid.openedOrder<order&&id!==ENDPOINT_LOCATION&&id!==ANCHOR_MAINTENANCE&&a.succeeded&&(a.selfGain>0||a.enemyReduction>0)&&aid.expiresAt>a.atSeconds&&sameEndpoint(r,aid)&&observed(r)){
  r.windows.endpointLocation=null;a.countered.push(aid.id);if(a.selfGain>0)a.selfGain+=30;else a.enemyReduction+=30;r.body.endpointLocationSuccesses++;gainMastery(r,a,ENDPOINT_LOCATION);a.finiteResult='APPLIED';a.label+='先前实付定位只辅助这次独立自身行动30，窗口已消费。';
 }
 return closeAction(a,r,rng);
}
export function resolveStarKeyEnemySlot(x:StarKeyCombatSource,r:StarKeyRuntime,planned:StarKeyEnemyIntent,order:number,rng:ActionRandomStream):StarKeyActionEvidence {
 if(!active(r)){const a=baseAction(r,'ENEMY',planned,order,rng);a.finiteResult='UNAVAILABLE';a.label='原人已不在实际可交战位置，停止新效果。';return closeAction(a,r,rng);}
 if(!r.pendingEnemyAction)declareStarKeyEnemyAction(x,r,planned,order);const p=r.pendingEnemyAction!;if(p.planned!==planned)throw new Error('不能替换已观察的待执行动作。');const a=baseAction(r,'ENEMY',p.actual,order,rng);a.planned=planned;a.selectedAbility=p.actual;const power=STAR_KEY_POWERS.find(v=>v.id===p.actual);
 if(power){if(r.body.enemySpirituality<power.cost)throw new Error('已声明对手资源不一致。');r.body.enemySpirituality-=power.cost;r.body.powerUses[power.id]++;a.paidCost=power.cost;a.selfGain=power.selfGain;a.enemyReduction=power.enemyReduction;a.succeeded=true;
  if(power.id==='SPATIAL_MARK'||power.id==='MENTAL_MARK'){
   const mark=r.materials.marks.find(m=>m.status==='HELD');if(!mark)throw new Error('没有可消费的原印记。');mark.status='SPENT';mark.usedRound=x.round;a.consumedMarkId=mark.id;a.attackKind=power.id==='SPATIAL_MARK'?'SPATIAL':'MENTAL';
   if(observed(r))r.body.observations.push({power:power.id,conditionVersion:r.root.conditionVersion,round:x.round,order,atSeconds:r.root.clockSeconds,paidCost:7});
  }else{r.feintUsed=true;const from=r.root.enemyCoordinate;r.root.enemyCoordinate=from===6?7:6;r.root.enemyTravelMetres++;a.travelMetres=1;a.travelPath=[from,r.root.enemyCoordinate];r.root.conditionVersion++;r.root.visibleBodyLine=false;for(const key of ['endpointLocation','anchorMaintenance'] as const){if(r.windows[key])a.countered.push(r.windows[key]!.id);invalidate(r,key);}}
  a.label=`罗温实际施放${power.label}，独立灵性−${power.cost}${a.consumedMarkId?`，消耗同一原件${a.consumedMarkId}`:''}。`+(power.id==='SPATIAL_MARK'?'只扰动眼前进退线路，提供本槽有限空间优势；没有移动任何人的身体或造成直接身体伤口。':'');
 }else if(p.actual==='BODY_STRIKE'){const from=r.root.enemyCoordinate;a.selfGain=20*a.physicalFactor;a.attackKind='BODY';a.travelMetres=2*(from-4);a.travelPath=[from,4,from];r.root.enemyTravelMetres+=a.travelMetres;a.succeeded=true;a.label=`罗温用自己的原棍走近普通打击再沿原路退回，共${a.travelMetres}米；印记或灵性不足时不施法、不重抽。`;}
 else if(p.actual==='ACCIDENT'){a.selfGain=-22.5;a.label='对手判断偏差，−22.5，不重抽。';}else a.label='对手普通观察，没有额外资源。';
 a.rawContribution=a.selfGain;a.rawReduction=a.enemyReduction;
 const anchor=r.windows.anchorMaintenance;
 if(anchor&&anchor.targetActionId===p.id){
  r.windows.anchorMaintenance=null;a.countered.push(anchor.id);
  const reduction=['SPATIAL','MENTAL'].includes(a.attackKind)&&anchor.openedOrder<order&&anchor.expiresAt>a.atSeconds&&sameEndpoint(r,anchor)&&pendingObserved(r,p)?Math.min(30,Math.max(0,a.selfGain)):0;
  a.selfGain-=reduction;if(reduction>0){r.body.anchorMaintenanceSuccesses++;gainMastery(r,a,ANCHOR_MAINTENANCE);a.finiteResult='APPLIED';a.label+=`先前实付维系只削弱同一未来${a.attackKind==='SPATIAL'?'空间':'精神'}印记贡献${reduction}，没有阻止身体攻击或改写过去。`;}
 }
 r.pendingEnemyAction=null;return closeAction(a,r,rng);
}
export interface StarKeyRoundOutcome extends StarKeyCombatBody {
 targetId:typeof STAR_KEY_TARGET_ID;round:number;source:StarKeyCombatSource;stance:SliceStance;continuing:boolean;playerHealthAfter:number;playerMindAfter:number;playerSpiritualityAfter:number;playerInjuriesAfter:SliceInjury[];playerRiskAfter:number;materialsAfter:StarKeyMaterials;masteryAfter:Record<string,number>;rootAfter:StarKeyScene;elapsedSeconds:60;randomCursorAfter:number;playerActions:StarKeyActionEvidence[];enemyActions:StarKeyActionEvidence[];expiredWindows:StarKeyWindow[];windowsAfter:StarKeyWindows;pendingEnemyActionAfter:null;
}
export type StarKeyResolution='CONTINUE'|'PLAYER_DEAD'|'ENEMY_DEAD'|'ENEMY_SURRENDERED'|'RETREATED';
function penalty(n:number,max:number){const f=n/max;return f>.75?0:f>.5?.05:f>.25?.1:.2;}
function base(core:number,h:number,m:number,s:number){return(1250+Math.min(core,250))*(1-Math.min(.4,penalty(h,100)+penalty(m,100)+penalty(s,120)));}
function weights(risk:number){const death=Math.min(100,5+Math.min(risk,10)*10),shifted=death-5;return{light:Math.max(0,65-shifted),heavy:Math.max(0,30-Math.max(0,shifted-65)),death};}
export function validStarKeyBody(b:StarKeyCombatBody):boolean {
 return integer(b.enemyHealth,0,100)&&integer(b.enemyMind,0,100)&&integer(b.enemySpirituality,0,120)&&integer(b.enemyRisk)&&Array.isArray(b.enemyInjuries)&&['RESISTING','SURRENDERED','DEAD'].includes(b.enemyStatus)&&(b.enemyStatus==='DEAD')===(b.enemyHealth===0)&&(b.enemyMind>0||b.enemyStatus!=='RESISTING')&&['HAND','YARD'].includes(b.weaponLocation)&&(b.enemyStatus==='RESISTING'||b.weaponLocation==='YARD')&&shape(b.powerUses,STAR_KEY_POWER_IDS)&&STAR_KEY_POWER_IDS.every(id=>integer(b.powerUses[id]))&&b.enemySpirituality===120-STAR_KEY_POWERS.reduce((n,p)=>n+p.cost*b.powerUses[p.id],0)&&b.powerUses.SPATIAL_MARK+b.powerUses.MENTAL_MARK<=3&&integer(b.totalOwnerMindSpent)&&integer(b.endpointLocationAttempts)&&integer(b.anchorMaintenanceAttempts)&&integer(b.endpointLocationChecks,0,b.endpointLocationAttempts)&&integer(b.anchorMaintenanceChecks,0,b.anchorMaintenanceAttempts)&&integer(b.endpointLocationSuccesses,0,b.endpointLocationChecks)&&integer(b.anchorMaintenanceSuccesses,0,b.anchorMaintenanceChecks)&&b.totalOwnerMindSpent===2*(b.endpointLocationAttempts+b.anchorMaintenanceAttempts)&&shape(b.inheritedSuccesses,['tricks','travel'])&&Object.values(b.inheritedSuccesses).every(n=>integer(n))&&Array.isArray(b.observations)&&b.observations.every((o,i)=>shape(o,['power','conditionVersion','round','order','atSeconds','paidCost'])&&['SPATIAL_MARK','MENTAL_MARK'].includes(o.power)&&integer(o.conditionVersion,1,b.powerUses.FEINT+1)&&integer(o.round,1)&&integer(o.order,0,11)&&integer(o.atSeconds,4)&&o.paidCost===7&&(i===0||b.observations[i-1]!.atSeconds<o.atSeconds))&&b.observations.filter(o=>o.power==='SPATIAL_MARK').length<=b.powerUses.SPATIAL_MARK&&b.observations.filter(o=>o.power==='MENTAL_MARK').length<=b.powerUses.MENTAL_MARK;
}
export function validStarKeyInjuries(injuries:SliceInjury[],revision:number):boolean{return Array.isArray(injuries)&&new Set(injuries.map(i=>i.id)).size===injuries.length&&injuries.every(i=>shape(i,['id','severity','acquiredRevision','treatedRevision'])&&typeof i.id==='string'&&!!i.id&&['LIGHT','HEAVY'].includes(i.severity)&&integer(i.acquiredRevision,0,revision)&&(i.treatedRevision===null||integer(i.treatedRevision,i.acquiredRevision,revision)));}
const SOURCE_KEYS=['runId','revision','week','date','round','encounterId','targetId','attemptWeek','startHistoryIndex','targetName','targetAge','targetSequence','targetCore','actualBody','independentMind','playerBodyId','enemyWeapon','weaponOwner','ordinaryExit','pursuit','thirdPartiesInArea','policy','clubHeld','playerHealth','playerMind','playerSpirituality','playerInjuries','playerRisk','physique','perception','will','knowledge','mastery','preparation','root','materials','body','randomSeed','randomCursor'];
export function validStarKeyCombatSource(x:StarKeyCombatSource):boolean {
 try{const p=x.root,prep=x.preparation;
 return shape(x,SOURCE_KEYS)&&shape(x.body,Object.keys(initialStarKeyBody()))&&validateStarKeyPreparation(prep)&&typeof x.runId==='string'&&!!x.runId&&integer(x.revision)&&x.week===prep.week&&isValidGameDate(x.date)&&same(x.date,prep.date)&&integer(x.round,1)&&integer(x.startHistoryIndex)&&x.attemptWeek===x.week&&x.encounterId==='STAR_KEY_DISPUTE'&&x.targetId===STAR_KEY_TARGET_ID&&x.targetName==='罗温·维尔'&&x.targetAge===44&&x.targetSequence===1&&x.targetCore===24&&x.actualBody===true&&x.independentMind===true&&x.playerBodyId===`${x.runId}:body`&&x.enemyWeapon==='SK1-ROWAN-CLUB'&&x.weaponOwner===STAR_KEY_TARGET_ID&&x.ordinaryExit==='OPEN'&&x.pursuit===false&&x.thirdPartiesInArea===0&&STAR_KEY_POLICIES.includes(x.policy)&&x.clubHeld===prep.playerClubHeld&&
 [x.playerHealth,x.playerMind].every(n=>integer(n,1,100))&&integer(x.playerSpirituality,0,120)&&[x.physique,x.perception,x.will,x.knowledge].every(n=>integer(n,0,500))&&same({physique:x.physique,perception:x.perception,will:x.will,knowledge:x.knowledge},prep.after.coreStats)&&shape(x.mastery,[...STAR_KEY_INHERITED_SKILL_IDS,...STAR_KEY_NEW_ABILITY_IDS])&&Object.values(x.mastery).every(n=>integer(n,0,500))&&same(Object.keys(x.mastery).sort(),Object.keys(prep.after.mastery).sort())&&STAR_KEY_INHERITED_SKILL_IDS.every(id=>x.mastery[id]===Math.min(500,prep.after.mastery[id]!+8*(id===TRICKS?x.body.inheritedSuccesses.tricks:id===TRAVEL?x.body.inheritedSuccesses.travel:0)))&&x.mastery[ENDPOINT_LOCATION]===Math.min(500,prep.after.mastery[ENDPOINT_LOCATION]!+8*x.body.endpointLocationSuccesses)&&x.mastery[ANCHOR_MAINTENANCE]===Math.min(500,prep.after.mastery[ANCHOR_MAINTENANCE]!+8*x.body.anchorMaintenanceSuccesses)&&
 integer(x.playerRisk)&&validStarKeyInjuries(x.playerInjuries,x.revision)&&validStarKeyInjuries(x.body.enemyInjuries,x.revision)&&validStarKeyMaterials(x.materials)&&x.materials.weapon.location===x.body.weaponLocation&&x.materials.marks.filter(m=>m.status==='SPENT').length===x.body.powerUses.SPATIAL_MARK+x.body.powerUses.MENTAL_MARK&&x.materials.marks.every(m=>m.usedRound===null||m.usedRound<x.round)&&x.body.endpointLocationAttempts<=x.round-1&&x.body.anchorMaintenanceAttempts<=x.round-1&&x.body.powerUses.FEINT<=x.round-1&&x.body.inheritedSuccesses.tricks+x.body.inheritedSuccesses.travel<=6*(x.round-1)&&
 validStarKeyScene(p)&&p.siteId===STAR_KEY_SITE&&p.playerLocation==='YARD'&&p.observedSourceId===`${x.runId}:SK1-YARD:${prep.revision}`&&p.observationWeek===prep.week&&p.knownPlayerName===prep.playerName&&p.knownEnemyName==='罗温·维尔'&&p.clockSeconds===4+60*(x.round-1)&&p.conditionVersion===1+x.body.powerUses.FEINT&&p.enemyCoordinate===(x.body.powerUses.FEINT%2?7:6)&&p.enemyTravelMetres>=x.body.powerUses.FEINT&&validStarKeyBody(x.body)&&x.body.enemyStatus==='RESISTING'&&x.body.enemyMind>0&&typeof x.randomSeed==='string'&&!!x.randomSeed&&x.randomSeed.length<=256&&integer(x.randomCursor)&&prep.runId===x.runId&&prep.randomSeed===x.randomSeed&&prep.randomCursor<=x.randomCursor&&prep.revision<=x.revision-x.round&&x.body.observations.every(o=>o.round<x.round&&o.atSeconds<p.clockSeconds);
 }catch{return false;}
}
export const validateStarKeyCombatSource=validStarKeyCombatSource;
/** Shared actual consequence resolver, exposed for declared isolated BODY/MENTAL
 * tests without seeking or replacing any campaign seed/cursor. */
export function resolveStarKeyConsequences(x:StarKeyCombatSource,r:StarKeyRuntime,players:StarKeyActionEvidence[],enemies:StarKeyActionEvidence[],winner:'PLAYER'|'ENEMY',retreat:SliceCombatRound['retreat'],rng:ActionRandomStream) {
  const b=r.body;
  let playerHealth = r.playerH, playerRisk = x.playerRisk, outcome: StarKeyResolution = retreat === 'SUCCESS' ? 'RETREATED' : b.enemyMind === 0 ? 'ENEMY_SURRENDERED' : 'CONTINUE';
  const playerInjuries = structuredClone(x.playerInjuries); let consequenceWeights: SliceCombatRound['consequenceWeights'] = null, consequenceRoll: number | undefined, consequenceDomain: SliceCombatRound['consequenceDomain'];
  if (retreat !== 'SUCCESS' && b.enemyMind > 0) {
    const loser = winner === 'PLAYER' ? 'ENEMY' : 'PLAYER', attacks = loser === 'PLAYER' ? enemies : players, injuries = loser === 'PLAYER' ? playerInjuries : b.enemyInjuries;
    if (attacks.some(a => a.threatens && a.attackKind === 'BODY')) {
      let risk = loser === 'PLAYER' ? playerRisk : b.enemyRisk; if (injuries.length) risk++; if (loser === 'PLAYER') playerRisk = risk; else b.enemyRisk = risk;
      consequenceDomain = 'BODY'; consequenceWeights = weights(risk); consequenceRoll = rng.nextInt(1, 100);
      const severity = consequenceRoll <= consequenceWeights.light ? 'LIGHT' : consequenceRoll <= consequenceWeights.light + consequenceWeights.heavy ? 'HEAVY' : 'DEATH';
      if (severity === 'DEATH') { if (loser === 'PLAYER') playerHealth = 0; else { b.enemyHealth = 0; b.enemyStatus = 'DEAD'; } }
      else { injuries.push({ id: `${x.runId}:combat:${x.round}:${loser}:${x.revision + 1}:${injuries.length}`, severity, acquiredRevision: x.revision + 1, treatedRevision: null });
        const damage = severity === 'LIGHT' ? 10 : 30; if (loser === 'PLAYER') playerHealth = Math.max(0, playerHealth - damage); else b.enemyHealth = Math.max(0, b.enemyHealth - damage);
        if (b.enemyHealth === 0) b.enemyStatus = 'DEAD'; else if (loser === 'ENEMY' && severity === 'HEAVY') b.enemyStatus = 'SURRENDERED'; }
    } else if (attacks.some(a => a.mentalPressure)) {
      consequenceDomain = 'MENTAL'; if (loser === 'PLAYER') r.playerM = Math.max(0, r.playerM - 10); else { b.enemyMind = Math.max(0, b.enemyMind - 10); if (b.enemyMind === 0) b.enemyStatus = 'SURRENDERED'; }
    }
    if (playerHealth === 0) outcome = 'PLAYER_DEAD'; else if (b.enemyHealth === 0) outcome = 'ENEMY_DEAD'; else if (b.enemyStatus === 'SURRENDERED') outcome = 'ENEMY_SURRENDERED';
  }
  if (outcome === 'CONTINUE' && r.playerM === 0) outcome = 'RETREATED';
  return {playerHealth,playerRisk,outcome,playerInjuries,consequenceWeights,consequenceRoll,consequenceDomain};
}
export function replayStarKeyCombatRound(x: StarKeyCombatSource, stance: SliceStance): { round: SliceCombatRound; outcome: StarKeyResolution } {
  if (!validStarKeyCombatSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new Error('缺少真实原来源。');
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = createStarKeyRuntime(x), b = r.body;
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = starKeyActionCount(playerCountRoll), enemyCount = starKeyEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: StarKeyActionEvidence[] = [], enemies: StarKeyActionEvidence[] = [], remaining = { PLAYER: playerCount, ENEMY: enemyCount }; let retreat: SliceCombatRound['retreat'] = 'NONE';
  if (b.enemyMind === 0) remaining.PLAYER = remaining.ENEMY = 0;
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) for (const actor of order) {
    if (!remaining[actor]) continue;
    if (actor === 'PLAYER' && stance === 'RETREAT') { remaining.PLAYER = 0; retreat = rng.nextInt(1, 100) <= 50 ? 'SUCCESS' : 'FAILURE'; if (retreat === 'SUCCESS') { remaining.ENEMY = 0; break; } continue; }
    if (remaining.ENEMY > 0 && !r.pendingEnemyAction) declareStarKeyEnemyAction(x, r, drawStarKeyEnemyAbility(rng), enemies.length);
    remaining[actor]--; const index = players.length + enemies.length;
    if (actor === 'PLAYER') players.push(resolveStarKeyPlayerSlot(x, r, drawStarKeyAbility(rng, null, stance), index, rng));
    else enemies.push(resolveStarKeyEnemySlot(x, r, r.pendingEnemyAction!.planned, index, rng));
    if (b.enemyMind === 0) { b.enemyStatus = 'SURRENDERED'; remaining.PLAYER = remaining.ENEMY = 0; break; }
  }
  const sum = (a: StarKeyActionEvidence[], key: 'selfGain' | 'enemyReduction') => a.reduce((n, v) => n + v[key], 0);
  const core = x.physique * .35 + x.perception * .25 + x.will * .25 + x.knowledge * .15;
  const playerAdvantage = Math.max(125, base(core, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, base(x.targetCore, x.body.enemyHealth, x.body.enemyMind, x.body.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction'));
  const winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100, winner = retreat === 'SUCCESS' ? 'ENEMY' : b.enemyMind === 0 ? 'PLAYER' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  const {playerHealth,playerRisk,outcome,playerInjuries,consequenceWeights,consequenceRoll,consequenceDomain}=resolveStarKeyConsequences(x,r,players,enemies,winner,retreat,rng);
  advanceStarKeyCombatClock(r, x.root.clockSeconds + 60 - r.root.clockSeconds);
  for (const key of ['endpointLocation','anchorMaintenance'] as const) { if (r.windows[key]) r.expiredWindows.push(structuredClone(r.windows[key]!)); r.windows[key] = null; }
  r.pendingEnemyAction = null; if (b.enemyStatus !== 'RESISTING') r.materials.weapon.location = 'YARD'; b.weaponLocation = r.materials.weapon.location;
  const o: StarKeyRoundOutcome = { ...structuredClone(b), targetId: STAR_KEY_TARGET_ID, round: x.round, source: structuredClone(x), stance, continuing: outcome === 'CONTINUE',
    playerHealthAfter: playerHealth, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, playerInjuriesAfter: playerInjuries, playerRiskAfter: playerRisk, materialsAfter: structuredClone(r.materials), masteryAfter: { ...r.mastery },
    rootAfter: structuredClone(r.root), elapsedSeconds: 60, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies, expiredWindows: r.expiredWindows,
    windowsAfter: structuredClone(r.windows), pendingEnemyActionAfter: null };
  const round: SliceCombatRound = { round: x.round, stance, first, playerCount, enemyCount, playerCountRoll, enemyCountRoll,
    moves: [...players, ...enemies].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })),
    playerAdvantage, enemyAdvantage, winChance, winner, consequence: '', consequenceWeights, retreat, ...(consequenceDomain === undefined ? {} : { consequenceDomain }), ...(consequenceRoll === undefined ? {} : { consequenceRoll }), starKeyOutcome: o };
  round.consequence = starKeyCombatConsequence(round); return { round, outcome };
}
export function validateStarKeyRoundOutcome(v: unknown): v is StarKeyRoundOutcome { try { const o = v as StarKeyRoundOutcome; return !!o && same(o, replayStarKeyCombatRound(o.source, o.stance).round.starKeyOutcome); } catch { return false; } }
export function validateStarKeyCombatRound(round: SliceCombatRound): boolean { try { const o = round.starKeyOutcome; return !!o && same(round, replayStarKeyCombatRound(o.source, o.stance).round); } catch { return false; } }
export function nextStarKeyCombatSource(o: StarKeyRoundOutcome): StarKeyCombatSource {
  return { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter,
    playerSpirituality: Math.min(120, o.playerSpiritualityAfter + 12), playerInjuries: structuredClone(o.playerInjuriesAfter), playerRisk: o.playerRiskAfter,
    root: structuredClone(o.rootAfter), body: combatBody(o), materials: structuredClone(o.materialsAfter), mastery: { ...o.masteryAfter }, randomCursor: o.randomCursorAfter };
}
export function starKeyCombatConsequence(round: SliceCombatRound): string {
  const o = round.starKeyOutcome!, who = round.winner === 'PLAYER' ? '罗温' : '你';
  let text = round.retreat === 'SUCCESS' ? '撤离判定成功，将沿普通4米出口实际离开。' : round.consequenceDomain === 'MENTAL' ? `${who}承受实际精神压力，精神减少10，没有新增身体伤口或身体风险。` : round.consequenceDomain === 'BODY' ? `${who}承受实际物理攻击，按共同伤势盘结算，实掷${round.consequenceRoll}/100（轻${round.consequenceWeights!.light}/重${round.consequenceWeights!.heavy}/死亡${round.consequenceWeights!.death}）。` : '本轮没有实际致伤来源，不掷身体伤势盘、不增加身体风险。';
  const attacks = round.winner === 'PLAYER' ? o.playerActions : o.enemyActions;
  if (round.consequenceDomain) text += ` 实际${round.consequenceDomain === 'BODY' ? '身体' : '精神'}来源：${attacks.filter(a => round.consequenceDomain === 'BODY' ? a.threatens : a.mentalPressure).map(a => a.selectedAbility).join('、')}。`;
  text += ` 本人健康${o.source.playerHealth}→${o.playerHealthAfter}、精神${o.source.playerMind}→${o.playerMindAfter}；罗温健康${o.source.body.enemyHealth}→${o.enemyHealth}、精神${o.source.body.enemyMind}→${o.enemyMind}。`;
  if (o.playerHealthAfter > 0 && o.playerMindAfter === 0) text += '本人精神耗尽，仍活着，停止抵抗后沿普通出口离开。';
  if (o.playerHealthAfter === 0) text += '本人的原身体真实死亡，本周目终结。'; else if (o.enemyHealth === 0) text += '罗温原身体真实死亡，唯一原棍留地。'; else if (o.enemyStatus === 'SURRENDERED') text += '罗温因实际伤势或精神耗尽自主停止抵抗，仍活着，原棍放在地面。';
  return text + ' 本轮实际60秒；未使用窗口到时结束，已经花费的灵性与精神不退。同一原棍和三枚印记的实际消耗保留，玛拉与旧遭遇人物均不在场；旧记录与原通行室物件没有补发或改写。';
}

/** Positive nested public allowlists expose resolved facts, never replay sources. */
export const projectStarKeyCheck = (c: PublicCheckResult | null): PublicCheckResult | null => c ? ({
  ability: c.ability, baseAbility: c.baseAbility, effectiveAbility: c.effectiveAbility, difficulty: c.difficulty, chance: c.chance,
  roll: c.roll, tier: c.tier, modifiers: c.modifiers.map(m => ({ source: m.source, value: m.value })),
}) : null;
const publicStarKeyInjury = (i: SliceInjury) => ({ id: i.id, severity: i.severity, acquiredRevision: i.acquiredRevision, treatedRevision: i.treatedRevision });
const publicStarKeyPowerUses = (p: StarKeyCombatBody['powerUses']) => ({ SPATIAL_MARK: p.SPATIAL_MARK, MENTAL_MARK: p.MENTAL_MARK, FEINT: p.FEINT });
const publicStarKeyWindow = (w: StarKeyWindow) => ({
  id: w.id, kind: w.kind, createdAt: w.createdAt, expiresAt: w.expiresAt, openedOrder: w.openedOrder,
  conditionVersion: w.conditionVersion, targetActionId: w.targetActionId, targetId: w.targetId,
  enemyCoordinate: w.enemyCoordinate, playerCoordinate: w.playerCoordinate, magnitude: w.magnitude,
});
const publicStarKeyWindows = (w: StarKeyWindows) => ({
  endpointLocation: w.endpointLocation ? publicStarKeyWindow(w.endpointLocation) : null,
  anchorMaintenance: w.anchorMaintenance ? publicStarKeyWindow(w.anchorMaintenance) : null,
});
const publicStarKeyPending = (p: StarKeyPendingAction | null) => p ? ({
  id: p.id, planned: p.planned, actual: p.actual, declaredAt: p.declaredAt, observedAt: p.observedAt, observationSeconds: p.observationSeconds,
  conditionVersion: p.conditionVersion, visible: p.visible, targetId: p.targetId,
  enemyCoordinate: p.enemyCoordinate, playerCoordinate: p.playerCoordinate, attackKind: p.attackKind,
}) : null;
export const projectStarKeyMaterials = (m: StarKeyMaterials) => ({
  weapon: { id: m.weapon.id, sourceId: m.weapon.sourceId, owner: m.weapon.owner, massKg: m.weapon.massKg, location: m.weapon.location, condition: m.weapon.condition, visible: m.weapon.visible },
  marks: m.marks.map(p => ({ id: p.id, owner: p.owner, status: p.status, usedRound: p.usedRound })),
});
export const projectStarKeyScene = (p: StarKeyScene) => ({
  siteId: p.siteId, playerLocation: p.playerLocation, playerCoordinate: p.playerCoordinate, enemyCoordinate: p.enemyCoordinate,
  ordinaryExit: p.ordinaryExit, visibleBodyLine: p.visibleBodyLine, conditionVersion: p.conditionVersion,
  observedConditionVersion: p.observedConditionVersion, thirdPartiesInArea: p.thirdPartiesInArea,
  presentMemberIds: [...p.presentMemberIds], observedSourceId: p.observedSourceId, observationWeek: p.observationWeek,
  clockSeconds: p.clockSeconds, externalSeconds: p.externalSeconds, playerTravelMetres: p.playerTravelMetres,
  enemyTravelMetres: p.enemyTravelMetres, knownPlayerName: p.knownPlayerName, knownEnemyName: p.knownEnemyName,
});
export function projectStarKeyAction(a: StarKeyActionEvidence) { return {
  order: a.order, actor: a.actor, id: a.id, planned: a.planned, selectedAbility: a.selectedAbility, fallbackReason: a.fallbackReason,
  label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: a.mentalPressure,
  attackKind: a.attackKind, rawContribution: a.rawContribution, rawReduction: a.rawReduction, paidCost: a.paidCost, mindCost: a.mindCost,
  physicalFactor: a.physicalFactor, check: projectStarKeyCheck(a.check), resistanceRoll: a.resistanceRoll,
  resistanceChance: a.resistanceChance, succeeded: a.succeeded, finiteResult: a.finiteResult,
  windowsBefore: publicStarKeyWindows(a.windowsBefore), windowsAfter: publicStarKeyWindows(a.windowsAfter),
  pendingBefore: publicStarKeyPending(a.pendingBefore), pendingAfter: publicStarKeyPending(a.pendingAfter),
  masteryApplied: [...a.masteryApplied], countered: [...a.countered], consumedMarkId: a.consumedMarkId,
  materialsBefore: projectStarKeyMaterials(a.materialsBefore), materialsAfter: projectStarKeyMaterials(a.materialsAfter),
  conditionVersionBefore: a.conditionVersionBefore, conditionVersionAfter: a.conditionVersionAfter, atSeconds: a.atSeconds,
  elapsedSeconds: a.elapsedSeconds, travelMetres: a.travelMetres, travelPath: [...a.travelPath], lateralTravelPath: [...a.lateralTravelPath],
  playerMindAfter: a.playerMindAfter, playerSpiritualityAfter: a.playerSpiritualityAfter,
  enemyMindAfter: a.enemyMindAfter, enemySpiritualityAfter: a.enemySpiritualityAfter,
}; }
export type StarKeyPublicActionEvidence = ReturnType<typeof projectStarKeyAction>;
export function projectStarKeyRoundOutcome(o: StarKeyRoundOutcome) { return {
  enemyHealth: o.enemyHealth, enemyMind: o.enemyMind, enemySpirituality: o.enemySpirituality, enemyStatus: o.enemyStatus,
  enemyInjuries: o.enemyInjuries.map(publicStarKeyInjury), enemyRisk: o.enemyRisk, weaponLocation: o.weaponLocation,
  powerUses: publicStarKeyPowerUses(o.powerUses),
  observations: o.observations.map(p => ({ power: p.power, conditionVersion: p.conditionVersion, round: p.round, order: p.order, atSeconds: p.atSeconds, paidCost: p.paidCost })),
  totalOwnerMindSpent: o.totalOwnerMindSpent, endpointLocationAttempts: o.endpointLocationAttempts,
  endpointLocationChecks: o.endpointLocationChecks, endpointLocationSuccesses: o.endpointLocationSuccesses,
  anchorMaintenanceAttempts: o.anchorMaintenanceAttempts, anchorMaintenanceChecks: o.anchorMaintenanceChecks,
  anchorMaintenanceSuccesses: o.anchorMaintenanceSuccesses, inheritedSuccesses: { tricks: o.inheritedSuccesses.tricks, travel: o.inheritedSuccesses.travel },
  targetId: o.targetId, round: o.round, stance: o.stance, continuing: o.continuing, playerHealthAfter: o.playerHealthAfter,
  playerMindAfter: o.playerMindAfter, playerSpiritualityAfter: o.playerSpiritualityAfter,
  playerInjuriesAfter: o.playerInjuriesAfter.map(publicStarKeyInjury), playerRiskAfter: o.playerRiskAfter,
  materialsAfter: projectStarKeyMaterials(o.materialsAfter),
  masteryAfter: Object.fromEntries([...STAR_KEY_INHERITED_SKILL_IDS, ...STAR_KEY_NEW_ABILITY_IDS].filter(id => Object.hasOwn(o.masteryAfter, id)).map(id => [id, o.masteryAfter[id]!])),
  rootAfter: projectStarKeyScene(o.rootAfter), elapsedSeconds: o.elapsedSeconds,
  playerActions: o.playerActions.map(projectStarKeyAction), enemyActions: o.enemyActions.map(projectStarKeyAction),
  expiredWindows: o.expiredWindows.map(publicStarKeyWindow), windowsAfter: publicStarKeyWindows(o.windowsAfter), pendingEnemyActionAfter: o.pendingEnemyActionAfter,
}; }
export type StarKeyPublicRoundOutcome = ReturnType<typeof projectStarKeyRoundOutcome>;

export function projectStarKeyCombat(s:SliceState){
 const e=s.starKey.encounter,last=s.combat?.encounterId==='STAR_KEY_DISPUTE'?s.combat.lastRound?.starKeyOutcome:e.terminal?s.combatHistory[e.terminal.historyIndex]?.starKeyOutcome:null;
 return{enemyName:'罗温·维尔（44岁）',targetId:e.targetId,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,weaponLocation:e.weaponLocation,powerUses:publicStarKeyPowerUses(e.powerUses),policy:e.policy,scene:projectStarKeyScene(e.scene),materials:projectStarKeyMaterials(e.materials),remainingMarkIds:e.materials.marks.filter(m=>m.status==='HELD').map(m=>m.id),lastActionSequence:last?[...last.playerActions,...last.enemyActions].sort((a,b)=>a.order-b.order).map(projectStarKeyAction):[],windows:last?publicStarKeyWindows(last.windowsAfter):{endpointLocation:null,anchorMaintenance:null},constants:STAR_KEY_COMBAT_CONSTANTS,countWheel:STAR_KEY_COUNT_WHEEL,enemyCountWheel:STAR_KEY_ENEMY_COUNT_WHEEL,abilityWheel:starKeyAbilityWheel(s,null),enemyAbilityWheel:STAR_KEY_ENEMY_ABILITY_WHEEL,facts:[
 '体35%、感25%、意25%、知15%；双方1至6动作10/15/25/25/15/10，基础1250、底125、上限120，仅继续轮恢复12。',
 '端点定位辅助下一合格独立自身行动30；锚点维系只削弱已观察的同一次未来空间或精神印记贡献30，不能挡原棍身体攻击。',
 '每轮各一次，失败照付；移位、遮挡、离场或满20秒使窗口失效，开窗本身不涨掌握。',
 '三枚原印记共用有限库存，每次实耗7灵性与一枚印记；用尽后用同一原棍普通行动。',
 '空间偏移只提供空间贡献；身体攻击走共同伤势盘，精神压力独立结算；精神耗尽活着停战，身体死亡终结本周目。']};
}
