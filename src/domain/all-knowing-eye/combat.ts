import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import { WISDOM_ANGEL_COUNT_WHEEL, wisdomAngelActionCount } from '../wisdom-angel/combat.js';
import type { MysticismMagisterCraft } from '../mysticism-magister/types.js';
import type { PolymathSampleState } from '../polymath/types.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { ALL_KNOWING_EYE_TARGET_ID, ALL_KNOWING_EYE_SITE, ALL_KNOWING_EYE_POWER_IDS, ALL_KNOWING_EYE_POWERS,
  ALL_KNOWING_EYE_POLICIES, combatBody, initialAllKnowingEyeBody, hasAllKnowingEyeDisputeOpponent,
  validateAllKnowingEyePreparation, validAllKnowingEyeMaterials, validAllKnowingEyeScene,
  type AllKnowingEyeCombatBody, type AllKnowingEyeEnemyIntent, type AllKnowingEyePreparation,
  type AllKnowingEyeMaterials, type AllKnowingEyeScene, type AllKnowingEyePolicy } from './encounter.js';

/** Finite S1 mechanisms are frozen before producer execution. White Tower S2's
 * actual numeric profile and finite original craft identities are retained. */
export const ALL_KNOWING_EYE_COUNT_WHEEL = WISDOM_ANGEL_COUNT_WHEEL;
export const ALL_KNOWING_EYE_ENEMY_COUNT_WHEEL = WISDOM_ANGEL_COUNT_WHEEL;
export const allKnowingEyeActionCount = wisdomAngelActionCount;
export const allKnowingEyeEnemyActionCount = wisdomAngelActionCount;
export const ALL_KNOWING_EYE_COMBAT_CONSTANTS = { weights:{physique:.35,perception:.25,will:.25,knowledge:.15},tier:1250,floor:125,maxSpirituality:120,continuingRecovery:12,enemyPhysique:24,boundedInsightCost:6,boundedInsightMindCost:2,boundedInsightAid:10,pendingForecastCost:8,pendingForecastMindCost:3,pendingForecastReduction:30,windowSeconds:30,resistanceChance:30 } as const;
export const BOUNDED_INSIGHT='reader.s1.bounded-insight', PENDING_FORECAST='reader.s1.pending-forecast';
export const ALL_KNOWING_EYE_NEW_ABILITY_IDS=[BOUNDED_INSIGHT,PENDING_FORECAST] as const;
export const ALL_KNOWING_EYE_INHERITED_SKILL_IDS=['reader.s9.memory','reader.s9.understanding','reader.s9.ritual-procedure','reader.s8.observation','reader.s8.deduction','reader.s8.ritual-specialism','reader.s7.reconstruction','reader.s7.combat-training','reader.s7.agility','reader.s6.analysis','reader.s6.limited-imitation','reader.s5.secret-ritual','reader.s5.material-imitation','reader.s4.fragmentary-foresight','reader.s4.symbolic-interpretation','reader.s3.evidence-link','reader.s3.method-analysis','reader.s2.conditional-synthesis','reader.s2.observed-response'] as const;
export type AllKnowingEyeMoveId=typeof ALL_KNOWING_EYE_INHERITED_SKILL_IDS[number]|typeof ALL_KNOWING_EYE_NEW_ABILITY_IDS[number]|'STRIKE'|'BLOCK'|'EVADE'|'OBSERVE'|'ACCIDENT';
const FLASH='reader.s6.limited-imitation', MATERIAL='reader.s5.material-imitation', METHOD='reader.s3.method-analysis', SYNTHESIS='reader.s2.conditional-synthesis', RESPONSE='reader.s2.observed-response';
export const ALL_KNOWING_EYE_ABILITIES:readonly{id:AllKnowingEyeMoveId;label:string;weight:number;stance:SliceStance|null}[]=[
 {id:'STRIKE',label:'本人普通打击',weight:12,stance:'ATTACK'},{id:'BLOCK',label:'普通防备',weight:5,stance:'DEFEND'},{id:'EVADE',label:'普通避让',weight:5,stance:'DEFEND'},{id:'OBSERVE',label:'实际侧步观察当前原人原杆',weight:4,stance:'PREPARE'},
 ...ALL_KNOWING_EYE_INHERITED_SKILL_IDS.map(id=>({id,label:({[FLASH]:'继承已学原闪光：2灵性、知识14',[MATERIAL]:'消耗最早仍自持的原微光片',[METHOD]:'继承方法辨析：亲见原术后5灵性、知识18',[SYNTHESIS]:'继承条件综合：同条件亲见闪光与护术，5灵性、知识20',[RESPONSE]:'继承已见方法应对：6灵性、知识20、20秒'} as Record<string,string>)[id]??'原条件不在本场时普通观察，保留原掌握',weight:[FLASH,MATERIAL,METHOD,SYNTHESIS,RESPONSE].includes(id)?7:1,stance:(id===SYNTHESIS?'ATTACK':id===RESPONSE?'DEFEND':'CONTROL') as SliceStance})),
 {id:BOUNDED_INSIGHT,label:'现场洞察：6灵性2精神、知识18，下一实际自身行动辅助10',weight:14,stance:'CONTROL'},
 {id:PENDING_FORECAST,label:'先机预判：8灵性3精神、感知18，下一可见身体冲击减30',weight:14,stance:'DEFEND'},
 {id:'ACCIDENT',label:'判断失衡：−22.5',weight:3,stance:null},
];
export const ALL_KNOWING_EYE_PLAYER_ABILITIES=ALL_KNOWING_EYE_ABILITIES;
export const ALL_KNOWING_EYE_ENEMY_ABILITY_WHEEL:readonly SliceWheelEntry[]=[
 {id:'FLASH',label:'原杆有限闪光：7灵性与1原杆储能、身体贡献105',weight:25},
 {id:'WARD',label:'有限护术：6灵性、减势60',weight:20},
 {id:'MIND_PRESSURE',label:'有限精神压力：7灵性、精神贡献65',weight:20},
 {id:'BODY_STRIKE',label:'自有原杆普通打击20×身体',weight:20},
 {id:'FEINT',label:'变招：3灵性、每轮一次，改变条件并横杆遮挡',weight:10},
 {id:'ACCIDENT',label:'判断偏差−22.5',weight:5},
];
export const isAllKnowingEye=(s:SliceState)=>s.progression.pathwayId==='white-tower'&&s.progression.sequence===1;
const tickets=(stance:SliceStance|null)=>ALL_KNOWING_EYE_ABILITIES.map(a=>a.weight*(a.stance===stance&&stance!==null?5:4));
export function allKnowingEyeAbilityWheel(_s:SliceState,stance:SliceStance|null):SliceWheelEntry[]{const w=tickets(stance),total=w.reduce((n,v)=>n+v,0);return ALL_KNOWING_EYE_ABILITIES.map((a,i)=>({id:a.id,label:a.label,weight:w[i]!/total*100}));}
export function drawAllKnowingEyeAbility(rng:ActionRandomStream,_s:SliceState|null,stance:SliceStance|null):AllKnowingEyeMoveId{const w=tickets(stance);let n=rng.nextInt(1,w.reduce((a,b)=>a+b,0));for(const[i,a]of ALL_KNOWING_EYE_ABILITIES.entries()){n-=w[i]!;if(n<=0)return a.id;}throw new Error('行动盘无效。');}
export function drawAllKnowingEyeEnemyAbility(rng:ActionRandomStream):AllKnowingEyeEnemyIntent{let n=rng.nextInt(1,100);for(const a of ALL_KNOWING_EYE_ENEMY_ABILITY_WHEEL){n-=a.weight;if(n<=0)return a.id as AllKnowingEyeEnemyIntent;}throw new Error('对手行动盘无效。');}
const same=(a:unknown,b:unknown)=>a===b||(a!==undefined&&b!==undefined&&stableStringify(a)===stableStringify(b));
const integer=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER):n is number=>Number.isSafeInteger(n)&&(n as number)>=min&&(n as number)<=max;
const shape=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...keys].sort());
const physicalAt=(n:number)=>n>75?1:n>50?.95:n>25?.9:.8;
export interface AllKnowingEyeCraftSource { flashSample:PolymathSampleState;crafts:MysticismMagisterCraft[];craftingPromotionWeek:number|null;craftingCaseStatus:string;kitsUsed:number }
export interface AllKnowingEyeCombatSource extends AllKnowingEyeCraftSource {
 runId:string;revision:number;week:number;date:PublicGameDate;round:number;encounterId:'ALL_KNOWING_EYE_DISPUTE';targetId:typeof ALL_KNOWING_EYE_TARGET_ID;
 attemptWeek:number;startHistoryIndex:number;targetName:'埃德温·罗斯';targetAge:47;targetSequence:1;targetCore:24;actualBody:true;independentMind:true;playerBodyId:string;
 enemyWeapon:'AE1-EDWIN-ROD';weaponOwner:typeof ALL_KNOWING_EYE_TARGET_ID;ordinaryExit:'OPEN';pursuit:false;thirdPartiesInArea:0;policy:AllKnowingEyePolicy;clubHeld:boolean;
 playerHealth:number;playerMind:number;playerSpirituality:number;playerInjuries:SliceInjury[];playerRisk:number;physique:number;perception:number;will:number;knowledge:number;mastery:Record<string,number>;
 preparation:AllKnowingEyePreparation;root:AllKnowingEyeScene;materials:AllKnowingEyeMaterials;body:AllKnowingEyeCombatBody;randomSeed:string;randomCursor:number;
}
export function currentAllKnowingEyeCombatSource(s:SliceState):AllKnowingEyeCombatSource|null {
 if(!hasAllKnowingEyeDisputeOpponent(s))return null;const e=s.allKnowingEye.encounter,c=s.combat!,m=s.mysticismMagister;
 return{runId:s.runId,revision:s.revision,week:s.week,date:{...s.date},round:c.round,encounterId:'ALL_KNOWING_EYE_DISPUTE',targetId:ALL_KNOWING_EYE_TARGET_ID,attemptWeek:e.attemptWeek!,startHistoryIndex:e.startHistoryIndex!,targetName:'埃德温·罗斯',targetAge:47,targetSequence:1,targetCore:24,actualBody:true,independentMind:true,playerBodyId:`${s.runId}:body`,enemyWeapon:'AE1-EDWIN-ROD',weaponOwner:ALL_KNOWING_EYE_TARGET_ID,ordinaryExit:'OPEN',pursuit:false,thirdPartiesInArea:0,policy:e.policy,clubHeld:s.town.clubLocation==='HAND',playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,playerInjuries:structuredClone(s.injuries),playerRisk:s.injuryRisk,...s.character.coreStats,mastery:{...s.progression.mastery},preparation:structuredClone(e.preparation!),root:structuredClone(e.scene),materials:structuredClone(e.materials),body:combatBody(e),flashSample:structuredClone(s.polymath.samples.FLASH),crafts:structuredClone(m.crafts),craftingPromotionWeek:m.promotionWeek,craftingCaseStatus:m.cases['modest-craft']!.status,kitsUsed:m.practice.kitsUsed,randomSeed:s.random.seed,randomCursor:s.random.cursor};
}
export interface AllKnowingEyePendingAction {id:string;planned:AllKnowingEyeEnemyIntent;actual:AllKnowingEyeEnemyIntent;declaredAt:number;observedAt:number;observationSeconds:1;conditionVersion:number;visible:boolean;bodyImpact:boolean}
export interface AllKnowingEyeWindow {id:string;kind:'BOUNDED_INSIGHT'|'PENDING_FORECAST'|'OLD_RESPONSE';createdAt:number;expiresAt:number;openedOrder:number;conditionVersion:number;targetActionId:string|null;targetPower:'FLASH'|'WARD'|null;magnitude:number}
export interface AllKnowingEyeWindows {boundedInsight:AllKnowingEyeWindow|null;pendingForecast:AllKnowingEyeWindow|null;oldResponse:AllKnowingEyeWindow|null}
export interface AllKnowingEyeActionEvidence {
 order:number;actor:'PLAYER'|'ENEMY';id:string;planned:string;selectedAbility:string;fallbackReason:string|null;label:string;selfGain:number;enemyReduction:number;threatens:boolean;mentalPressure:boolean;attackKind:'NONE'|'BODY'|'MENTAL';rawContribution:number;rawReduction:number;
 paidCost:number;mindCost:number;physicalFactor:number;check:PublicCheckResult|null;resistanceRoll:number|null;resistanceChance:number|null;succeeded:boolean;
 finiteResult:'NONE'|'UNAVAILABLE'|'ALREADY_ATTEMPTED'|'INSUFFICIENT'|'FAILED'|'RESISTED'|'PENDING'|'APPLIED';windowsBefore:AllKnowingEyeWindows;windowsAfter:AllKnowingEyeWindows;pendingBefore:AllKnowingEyePendingAction|null;pendingAfter:AllKnowingEyePendingAction|null;masteryApplied:string[];countered:string[];
 consumedCraftId:string|null;craftsBefore:MysticismMagisterCraft[];craftsAfter:MysticismMagisterCraft[];rodChargeSpent:number;materialsBefore:AllKnowingEyeMaterials;materialsAfter:AllKnowingEyeMaterials;
 conditionVersionBefore:number;conditionVersionAfter:number;atSeconds:number;elapsedSeconds:4;travelMetres:number;travelPath:number[];lateralTravelPath:number[];randomCursorBefore:number;randomCursorAfter:number;playerMindAfter:number;playerSpiritualityAfter:number;enemyMindAfter:number;enemySpiritualityAfter:number;
}
export interface AllKnowingEyeRuntime {body:AllKnowingEyeCombatBody;root:AllKnowingEyeScene;materials:AllKnowingEyeMaterials;crafts:MysticismMagisterCraft[];playerH:number;playerM:number;playerS:number;mastery:Record<string,number>;windows:AllKnowingEyeWindows;expiredWindows:AllKnowingEyeWindow[];pendingEnemyAction:AllKnowingEyePendingAction|null;boundedInsightAttempted:boolean;pendingForecastAttempted:boolean;feintUsed:boolean}
export function createAllKnowingEyeRuntime(x:AllKnowingEyeCombatSource):AllKnowingEyeRuntime{return{body:structuredClone(x.body),root:structuredClone(x.root),materials:structuredClone(x.materials),crafts:structuredClone(x.crafts),playerH:x.playerHealth,playerM:x.playerMind,playerS:x.playerSpirituality,mastery:{...x.mastery},windows:{boundedInsight:null,pendingForecast:null,oldResponse:null},expiredWindows:[],pendingEnemyAction:null,boundedInsightAttempted:false,pendingForecastAttempted:false,feintUsed:false};}
const active=(r:AllKnowingEyeRuntime)=>r.root.playerLocation==='YARD'&&r.root.playerCoordinate===4&&r.root.ordinaryExit==='OPEN'&&r.body.enemyStatus==='RESISTING'&&r.body.enemyHealth>0&&r.body.enemyMind>0&&r.playerH>0&&r.playerM>0;
const observed=(r:AllKnowingEyeRuntime)=>active(r)&&r.root.visibleBodyLine&&r.root.observedConditionVersion===r.root.conditionVersion;
function invalidate(r:AllKnowingEyeRuntime,key:keyof AllKnowingEyeWindows):void {const w=r.windows[key];if(w)r.expiredWindows.push(structuredClone(w));r.windows[key]=null;}
export function advanceAllKnowingEyeCombatClock(r:AllKnowingEyeRuntime,seconds:number):void {
 if(!integer(seconds))throw new Error('实际时间无效。');r.root.clockSeconds+=seconds;r.root.externalSeconds+=seconds;
 for(const key of ['boundedInsight','pendingForecast','oldResponse'] as const){const w=r.windows[key];if(w&&(w.expiresAt<=r.root.clockSeconds||!observed(r)||w.conditionVersion!==r.root.conditionVersion))invalidate(r,key);}
}
export function declareAllKnowingEyeEnemyAction(x:AllKnowingEyeCombatSource,r:AllKnowingEyeRuntime,planned:AllKnowingEyeEnemyIntent,index:number):AllKnowingEyePendingAction {
 if(!active(r)||r.pendingEnemyAction||![...ALL_KNOWING_EYE_ENEMY_ABILITY_WHEEL.map(a=>a.id),'OBSERVE'].includes(planned))throw new Error('不能覆盖待执行动作或替已停战者行动。');
 const power=ALL_KNOWING_EYE_POWERS.find(p=>p.id===planned),actual=power&&(r.body.enemySpirituality<power.cost||planned==='FLASH'&&r.materials.weapon.charge===0)?'BODY_STRIKE':planned==='FEINT'&&r.feintUsed?'OBSERVE':planned;
 const at=r.root.clockSeconds;advanceAllKnowingEyeCombatClock(r,1);
 r.pendingEnemyAction={id:`${x.runId}:AE1-PENDING:${x.round}:${index}`,planned,actual,declaredAt:at,observedAt:r.root.clockSeconds,observationSeconds:1,conditionVersion:r.root.conditionVersion,visible:observed(r),bodyImpact:actual==='FLASH'||actual==='BODY_STRIKE'};
 return structuredClone(r.pendingEnemyAction);
}
function baseAction(r:AllKnowingEyeRuntime,actor:'PLAYER'|'ENEMY',id:string,order:number,rng:ActionRandomStream):AllKnowingEyeActionEvidence {
 advanceAllKnowingEyeCombatClock(r,0);
 return{order,actor,id,planned:id,selectedAbility:id,fallbackReason:null,label:'',selfGain:0,enemyReduction:0,threatens:false,mentalPressure:false,attackKind:'NONE',rawContribution:0,rawReduction:0,paidCost:0,mindCost:0,physicalFactor:physicalAt(actor==='PLAYER'?r.playerH:r.body.enemyHealth),check:null,resistanceRoll:null,resistanceChance:null,succeeded:false,finiteResult:'NONE',windowsBefore:structuredClone(r.windows),windowsAfter:structuredClone(r.windows),pendingBefore:structuredClone(r.pendingEnemyAction),pendingAfter:null,masteryApplied:[],countered:[],consumedCraftId:null,craftsBefore:structuredClone(r.crafts),craftsAfter:structuredClone(r.crafts),rodChargeSpent:0,materialsBefore:structuredClone(r.materials),materialsAfter:structuredClone(r.materials),conditionVersionBefore:r.root.conditionVersion,conditionVersionAfter:r.root.conditionVersion,atSeconds:r.root.clockSeconds,elapsedSeconds:4,travelMetres:0,travelPath:[actor==='PLAYER'?r.root.playerCoordinate:r.root.enemyCoordinate],lateralTravelPath:[0],randomCursorBefore:rng.cursor,randomCursorAfter:rng.cursor,playerMindAfter:r.playerM,playerSpiritualityAfter:r.playerS,enemyMindAfter:r.body.enemyMind,enemySpiritualityAfter:r.body.enemySpirituality};
}
function closeAction(a:AllKnowingEyeActionEvidence,r:AllKnowingEyeRuntime,rng:ActionRandomStream){advanceAllKnowingEyeCombatClock(r,4);a.windowsAfter=structuredClone(r.windows);a.pendingAfter=structuredClone(r.pendingEnemyAction);a.materialsAfter=structuredClone(r.materials);a.craftsAfter=structuredClone(r.crafts);a.conditionVersionAfter=r.root.conditionVersion;a.randomCursorAfter=rng.cursor;a.playerMindAfter=r.playerM;a.playerSpiritualityAfter=r.playerS;a.enemyMindAfter=r.body.enemyMind;a.enemySpiritualityAfter=r.body.enemySpirituality;a.threatens=a.attackKind==='BODY'&&a.selfGain>0;a.mentalPressure=a.attackKind==='MENTAL'&&a.selfGain>0;a.label+=` 实际4秒，条件${r.root.conditionVersion}，本人灵性${r.playerS}、精神${r.playerM}，对手灵性${r.body.enemySpirituality}。`;return a;}
function ordinary(x:AllKnowingEyeCombatSource,r:AllKnowingEyeRuntime,a:AllKnowingEyeActionEvidence,why:string,attack=false){a.selectedAbility=attack?'STRIKE':'BLOCK';a.fallbackReason=why||null;a.label=why+(attack?'本人用原身体普通打击。':'本人普通防备。');a.succeeded=true;if(attack){a.selfGain=(x.clubHeld?16:12)*a.physicalFactor;a.attackKind='BODY';a.travelMetres=4;a.travelPath=[4,6,4];r.root.playerTravelMetres+=4;a.label+='本人实际上前两米、打击后沿原路退回两米。';}else a.enemyReduction=10;}
function pay(r:AllKnowingEyeRuntime,a:AllKnowingEyeActionEvidence,s:number,m=0){if(r.playerS<s||r.playerM<=m)return false;r.playerS-=s;r.playerM-=m;r.body.totalOwnerMindSpent+=m;a.paidCost=s;a.mindCost=m;return true;}
function check(x:AllKnowingEyeCombatSource,a:AllKnowingEyeActionEvidence,ability:'knowledge'|'perception',difficulty:number,rng:ActionRandomStream){a.check=resolveNormalCheck({ability,baseAbility:x[ability],difficulty,modifiers:[],roll:rng.nextInt(1,100)});a.succeeded=['SUCCESS','GREAT_SUCCESS'].includes(a.check.tier);a.label+=`${ability==='perception'?'感知':'知识'}检定${a.check.roll}，${a.succeeded?'成功':'失败'}。`;return a.succeeded;}
function resist(a:AllKnowingEyeActionEvidence,rng:ActionRandomStream){a.resistanceChance=30;a.resistanceRoll=rng.nextInt(1,100);if(a.resistanceRoll<=30){a.succeeded=false;a.finiteResult='RESISTED';a.label+='对方实际抵抗，成本保留。';return false;}return true;}
function gainMastery(r:AllKnowingEyeRuntime,a:AllKnowingEyeActionEvidence,id:string){r.mastery[id]=Math.min(500,(r.mastery[id]??0)+8);a.masteryApplied.push(id);}
function window(r:AllKnowingEyeRuntime,kind:AllKnowingEyeWindow['kind'],order:number,magnitude:number,target:string|null=null,targetPower:'FLASH'|'WARD'|null=null):AllKnowingEyeWindow{return{id:`AE1-${kind}-${r.root.clockSeconds}-${order}`,kind,createdAt:r.root.clockSeconds,expiresAt:r.root.clockSeconds+(kind==='OLD_RESPONSE'?20:30),openedOrder:order,conditionVersion:r.root.conditionVersion,targetActionId:target,targetPower,magnitude};}
export function hasAllKnowingEyeLearnedFlash(sample:PolymathSampleState,week:number):boolean {const a=sample.observedWeek,b=sample.understoodWeek,c=sample.learnedWeek,d=sample.analysisAttemptWeek;return [a,b,c,d].every(w=>integer(w,1,week))&&a!<=b!&&b!<=c!&&a!<=d!&&d!<=c!;}
export function validAllKnowingEyeCrafts(x:AllKnowingEyeCraftSource,week:number):boolean {
 const sample=x.flashSample;
 return shape(sample,['observedWeek','understoodWeek','learnedWeek','analysisAttemptWeek'])&&Object.values(sample).every(w=>w===null||integer(w,1,week))&&
 (sample.understoodWeek===null||sample.observedWeek!==null&&sample.observedWeek<=sample.understoodWeek)&&(sample.analysisAttemptWeek===null||sample.observedWeek!==null&&sample.observedWeek<=sample.analysisAttemptWeek)&&(sample.learnedWeek===null||hasAllKnowingEyeLearnedFlash(sample,week))&&
 Array.isArray(x.crafts)&&integer(x.kitsUsed)&&(x.craftingPromotionWeek===null||integer(x.craftingPromotionWeek,1,week))&&['AVAILABLE','OBSERVED','PREPARED','EXAMINED','RESOLVED'].includes(x.craftingCaseStatus)&&new Set(x.crafts.map(c=>c.id)).size===x.crafts.length&&new Set(x.crafts.map(c=>c.sourceKitId)).size===x.crafts.length&&
 x.crafts.every(c=>{const kit=/^MM5-KIT-([1-9]\d*)$/.exec(c.sourceKitId);return shape(c,['id','sourceKitId','createdWeek','usedWeek','status','power'])&&kit!==null&&integer(Number(kit[1]),1,x.kitsUsed)&&c.id===`MM5-FLASH-${kit[1]}`&&integer(x.craftingPromotionWeek,1,week)&&integer(c.createdWeek,x.craftingPromotionWeek,week)&&Number.isFinite(c.power)&&c.power>=.65&&c.power<=1&&(c.status==='PLAYER'?c.usedWeek===null:c.status==='CONSUMED'&&integer(c.usedWeek,c.createdWeek,week));});
}
function oldestFlash(x:AllKnowingEyeCombatSource,r:AllKnowingEyeRuntime):MysticismMagisterCraft|null {return x.craftingCaseStatus==='RESOLVED'?r.crafts.filter(c=>c.status==='PLAYER'&&c.usedWeek===null).sort((a,b)=>a.createdWeek-b.createdWeek||Number(a.id.slice('MM5-FLASH-'.length))-Number(b.id.slice('MM5-FLASH-'.length)))[0]??null:null;}
export function resolveAllKnowingEyePlayerSlot(x:AllKnowingEyeCombatSource,r:AllKnowingEyeRuntime,id:AllKnowingEyeMoveId,order:number,rng:ActionRandomStream):AllKnowingEyeActionEvidence {
 if(!ALL_KNOWING_EYE_ABILITIES.some(a=>a.id===id))throw new Error('未知本人动作。');const a=baseAction(r,'PLAYER',id,order,rng),aid=r.windows.boundedInsight;
 if(aid)r.windows.boundedInsight=null; // The very next actual own slot consumes it, even on failure.
 if(!active(r)){a.finiteResult='UNAVAILABLE';a.label='本人或对手已离场、死亡或停止抵抗，没有新效果。';return closeAction(a,r,rng);}
 if(x.policy==='ORDINARY'&&id.startsWith('reader.'))ordinary(x,r,a,'预先选择只作普通行动；');
 else if(id===BOUNDED_INSIGHT||id===PENDING_FORECAST){
  const forecast=id===PENDING_FORECAST,allowed=x.policy==='ALL'||x.policy===(forecast?'PENDING_FORECAST':'BOUNDED_INSIGHT'),attempted=forecast?r.pendingForecastAttempted:r.boundedInsightAttempted,p=r.pendingEnemyAction;
  if(!allowed){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'预先策略未允许这项新能力；');}
  else if(attempted){a.finiteResult='ALREADY_ATTEMPTED';ordinary(x,r,a,'本轮已经实际尝试，不重骰、不延长窗口；');}
  else if(!observed(r)||forecast&&(!p||!p.visible||!p.bodyImpact||p.conditionVersion!==r.root.conditionVersion)){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'缺少同一当前条件的实际观察或下一可见身体冲击；');}
  else if(!pay(r,a,forecast?8:6,forecast?3:2)){a.finiteResult='INSUFFICIENT';ordinary(x,r,a,'灵性或精神不足，能力未施放；');}
  else{
   if(forecast){r.pendingForecastAttempted=true;r.body.pendingForecastAttempts++;}else{r.boundedInsightAttempted=true;r.body.boundedInsightAttempts++;}
   a.label=forecast?'据眼前已观察条件预判下一身体冲击。':'只据眼前原人原杆，为自己的下一独立行动整理条件。';
   if(!check(x,a,forecast?'perception':'knowledge',18,rng))a.finiteResult='FAILED';
   else if(resist(a,rng)){if(forecast){r.body.pendingForecastChecks++;r.windows.pendingForecast=window(r,'PENDING_FORECAST',order,30,p!.id);}else{r.body.boundedInsightChecks++;r.windows.boundedInsight=window(r,'BOUNDED_INSIGHT',order,10);}a.finiteResult='PENDING';a.label+='窗口最多30秒，本槽没有贡献或掌握奖励。';}
  }
 }else if(id==='STRIKE')ordinary(x,r,a,'',true);
 else if(id==='BLOCK'||id==='EVADE')ordinary(x,r,a,'');
 else if(id==='OBSERVE'){
  a.label='本人实际向侧面走一米观察原杆，再走一米回到同一出口路线。';a.travelMetres=2;a.lateralTravelPath=[0,1,0];r.root.playerTravelMetres+=2;r.root.visibleBodyLine=true;r.root.observedConditionVersion=r.root.conditionVersion;
  if(r.pendingEnemyAction){r.pendingEnemyAction.visible=true;r.pendingEnemyAction.conditionVersion=r.root.conditionVersion;r.pendingEnemyAction.observedAt=r.root.clockSeconds;}
 }else if(id==='ACCIDENT'){a.selfGain=-22.5;a.label='判断失衡，固定−22.5，不重抽。';}
 else if(id===FLASH){if(!hasAllKnowingEyeLearnedFlash(x.flashSample,x.week)||!pay(r,a,2))ordinary(x,r,a,'原闪光尚未真实学会或不足2灵性；',true);else if(check(x,a,'knowledge',14,rng)){a.enemyReduction=12*(.65+.35*(x.mastery[FLASH]??0)/500);a.label+='实际使用旧闪光，不新增样本或旧掌握。';}}
 else if(id===MATERIAL){const craft=oldestFlash(x,r);if(!craft)ordinary(x,r,a,'没有仍在自己手中的合格原微光片；',true);else{craft.status='CONSUMED';craft.usedWeek=x.week;a.consumedCraftId=craft.id;a.enemyReduction=18*craft.power;a.succeeded=true;a.label=`消耗实际原件${craft.id}，保留制作时固定效力${craft.power}。`;}}
 else if(id===METHOD||id===SYNTHESIS||id===RESPONSE){
  const current=r.body.observations.filter(o=>o.conditionVersion===r.root.conditionVersion),latest=(id===METHOD?r.body.observations:current).at(-1),ready=id===SYNTHESIS?['FLASH','WARD'].every(p=>current.some(o=>o.power===p)):!!latest,cost=id===RESPONSE?6:5;
  if(!ready||!observed(r))ordinary(x,r,a,'缺少当前可用的实际已见原术或视线；');
  else if(!pay(r,a,cost))ordinary(x,r,a,'旧能力灵性不足；',true);
  else if(check(x,a,'knowledge',id===METHOD?18:20,rng)){if(id===METHOD)a.enemyReduction=35;else if(id===SYNTHESIS)a.selfGain=65;else r.windows.oldResponse=window(r,'OLD_RESPONSE',order,45,null,latest!.power);a.label+='继承原术只作用当前有来源的有限场景，不回写旧记录。';}
 }else{a.selectedAbility='OBSERVE';a.fallbackReason='原纸、旧案、过去场景或原授课条件不在当前石院';a.label=a.fallbackReason+'；普通观察，不捏造旧技能效果，不改变十九项原掌握。';}
 a.rawContribution=a.selfGain;a.rawReduction=a.enemyReduction;
 if(aid){a.countered.push(aid.id);if(aid.openedOrder<order&&aid.expiresAt>a.atSeconds&&aid.conditionVersion===r.root.conditionVersion&&observed(r)&&(a.selfGain>0||a.enemyReduction>0)){
  if(a.selfGain>0)a.selfGain+=10;else a.enemyReduction+=10;r.body.boundedInsightSuccesses++;gainMastery(r,a,BOUNDED_INSIGHT);a.finiteResult='APPLIED';a.label+='先前实付洞察只辅助这次实际独立行动10，窗口已消费。';}}
 return closeAction(a,r,rng);
}
export function resolveAllKnowingEyeEnemySlot(x:AllKnowingEyeCombatSource,r:AllKnowingEyeRuntime,planned:AllKnowingEyeEnemyIntent,order:number,rng:ActionRandomStream):AllKnowingEyeActionEvidence {
 if(!active(r)){const a=baseAction(r,'ENEMY',planned,order,rng);a.finiteResult='UNAVAILABLE';a.label='原人已不在实际可交战位置，停止新效果。';return closeAction(a,r,rng);}
 if(!r.pendingEnemyAction)declareAllKnowingEyeEnemyAction(x,r,planned,order);const p=r.pendingEnemyAction!;if(p.planned!==planned)throw new Error('不能替换已观察的待执行动作。');const a=baseAction(r,'ENEMY',p.actual,order,rng);a.planned=planned;a.selectedAbility=p.actual;const power=ALL_KNOWING_EYE_POWERS.find(v=>v.id===p.actual);
 if(power){if(r.body.enemySpirituality<power.cost)throw new Error('已声明对手资源不一致。');r.body.enemySpirituality-=power.cost;r.body.powerUses[power.id]++;a.paidCost=power.cost;a.selfGain=power.selfGain;a.enemyReduction=power.enemyReduction;a.succeeded=true;
  if(power.id==='FLASH'){if(r.materials.weapon.charge<1)throw new Error('原杆已无储能。');r.materials.weapon.charge--;a.rodChargeSpent=1;a.attackKind='BODY';}
  if(power.id==='MIND_PRESSURE')a.attackKind='MENTAL';
  if((power.id==='FLASH'||power.id==='WARD')&&observed(r))r.body.observations.push({power:power.id,conditionVersion:r.root.conditionVersion,round:x.round,order,atSeconds:r.root.clockSeconds,paidCost:power.id==='FLASH'?7:6});
  if(power.id==='FEINT'){r.feintUsed=true;r.root.conditionVersion++;r.root.visibleBodyLine=false;for(const key of ['boundedInsight','pendingForecast','oldResponse'] as const){if(r.windows[key])a.countered.push(r.windows[key]!.id);invalidate(r,key);}}
  a.label=`埃德温实际施放${power.label}，独立灵性−${power.cost}。`;
 }else if(p.actual==='BODY_STRIKE'){a.selfGain=20*a.physicalFactor;a.attackKind='BODY';a.travelMetres=4;a.travelPath=[6,4,6];a.label='埃德温用自己的原杆上前两米普通打击，再沿原路退回两米；储能或灵性不足时不施法、不重抽。';}
 else if(p.actual==='ACCIDENT'){a.selfGain=-22.5;a.label='对手判断偏差，−22.5，不重抽。';}else a.label='对手普通观察，没有额外资源。';
 a.rawContribution=a.selfGain;a.rawReduction=a.enemyReduction;
 const response=r.windows.oldResponse;if(response){r.windows.oldResponse=null;a.countered.push(response.id);if(response.expiresAt>a.atSeconds&&response.conditionVersion===r.root.conditionVersion&&observed(r)&&response.targetPower===p.actual&&a.paidCost>0){if(a.selfGain>0)a.selfGain=Math.max(0,a.selfGain-45);else a.enemyReduction=Math.max(0,a.enemyReduction-45);a.label+='先前继承应对只削弱这一次匹配原术45。';}}
 const forecast=r.windows.pendingForecast;
 if(forecast&&a.attackKind==='BODY'){
  r.windows.pendingForecast=null;a.countered.push(forecast.id);
  const reduction=forecast.targetActionId===p.id&&forecast.openedOrder<order&&forecast.expiresAt>a.atSeconds&&forecast.conditionVersion===r.root.conditionVersion&&p.visible&&observed(r)?Math.min(30,Math.max(0,a.selfGain)):0;
  a.selfGain-=reduction;if(reduction>0){r.body.pendingForecastSuccesses++;gainMastery(r,a,PENDING_FORECAST);a.finiteResult='APPLIED';a.label+=`先前实付预判只削弱同一下一可见身体冲击${reduction}，不影响精神。`;}
 }
 r.pendingEnemyAction=null;return closeAction(a,r,rng);
}
export interface AllKnowingEyeRoundOutcome extends AllKnowingEyeCombatBody {
 targetId:typeof ALL_KNOWING_EYE_TARGET_ID;round:number;source:AllKnowingEyeCombatSource;stance:SliceStance;continuing:boolean;playerHealthAfter:number;playerMindAfter:number;playerSpiritualityAfter:number;playerInjuriesAfter:SliceInjury[];playerRiskAfter:number;materialsAfter:AllKnowingEyeMaterials;craftsAfter:MysticismMagisterCraft[];consumedCraftIds:string[];masteryAfter:Record<string,number>;rootAfter:AllKnowingEyeScene;elapsedSeconds:60;randomCursorAfter:number;playerActions:AllKnowingEyeActionEvidence[];enemyActions:AllKnowingEyeActionEvidence[];expiredWindows:AllKnowingEyeWindow[];windowsAfter:AllKnowingEyeWindows;pendingEnemyActionAfter:null;
}
export type AllKnowingEyeResolution='CONTINUE'|'PLAYER_DEAD'|'ENEMY_DEAD'|'ENEMY_SURRENDERED'|'RETREATED';
function penalty(n:number,max:number){const f=n/max;return f>.75?0:f>.5?.05:f>.25?.1:.2;}
function base(core:number,h:number,m:number,s:number){return(1250+Math.min(core,250))*(1-Math.min(.4,penalty(h,100)+penalty(m,100)+penalty(s,120)));}
function weights(risk:number){const death=Math.min(100,5+Math.min(risk,10)*10),shifted=death-5;return{light:Math.max(0,65-shifted),heavy:Math.max(0,30-Math.max(0,shifted-65)),death};}
export function validAllKnowingEyeBody(b:AllKnowingEyeCombatBody):boolean {
 return integer(b.enemyHealth,0,100)&&integer(b.enemyMind,0,100)&&integer(b.enemySpirituality,0,120)&&integer(b.enemyRisk)&&Array.isArray(b.enemyInjuries)&&['RESISTING','SURRENDERED','DEAD'].includes(b.enemyStatus)&&(b.enemyStatus==='DEAD')===(b.enemyHealth===0)&&(b.enemyMind>0||b.enemyStatus!=='RESISTING')&&['HAND','YARD'].includes(b.weaponLocation)&&(b.enemyStatus==='RESISTING'||b.weaponLocation==='YARD')&&shape(b.powerUses,ALL_KNOWING_EYE_POWER_IDS)&&ALL_KNOWING_EYE_POWER_IDS.every(id=>integer(b.powerUses[id]))&&b.enemySpirituality===120-ALL_KNOWING_EYE_POWERS.reduce((n,p)=>n+p.cost*b.powerUses[p.id],0)&&b.powerUses.FLASH<=4&&integer(b.totalOwnerMindSpent)&&integer(b.boundedInsightAttempts)&&integer(b.pendingForecastAttempts)&&integer(b.boundedInsightChecks,0,b.boundedInsightAttempts)&&integer(b.pendingForecastChecks,0,b.pendingForecastAttempts)&&integer(b.boundedInsightSuccesses,0,b.boundedInsightChecks)&&integer(b.pendingForecastSuccesses,0,b.pendingForecastChecks)&&b.totalOwnerMindSpent===2*b.boundedInsightAttempts+3*b.pendingForecastAttempts&&Array.isArray(b.observations)&&b.observations.every((o,i)=>shape(o,['power','conditionVersion','round','order','atSeconds','paidCost'])&&['FLASH','WARD'].includes(o.power)&&integer(o.conditionVersion,1,b.powerUses.FEINT+1)&&integer(o.round,1)&&integer(o.order,0,11)&&integer(o.atSeconds,4)&&o.paidCost===(o.power==='FLASH'?7:6)&&(i===0||b.observations[i-1]!.atSeconds<o.atSeconds))&&b.observations.filter(o=>o.power==='FLASH').length<=b.powerUses.FLASH&&b.observations.filter(o=>o.power==='WARD').length<=b.powerUses.WARD;
}
export function validAllKnowingEyeInjuries(injuries:SliceInjury[],revision:number):boolean{return Array.isArray(injuries)&&new Set(injuries.map(i=>i.id)).size===injuries.length&&injuries.every(i=>shape(i,['id','severity','acquiredRevision','treatedRevision'])&&typeof i.id==='string'&&!!i.id&&['LIGHT','HEAVY'].includes(i.severity)&&integer(i.acquiredRevision,0,revision)&&(i.treatedRevision===null||integer(i.treatedRevision,i.acquiredRevision,revision)));}
const SOURCE_KEYS=['runId','revision','week','date','round','encounterId','targetId','attemptWeek','startHistoryIndex','targetName','targetAge','targetSequence','targetCore','actualBody','independentMind','playerBodyId','enemyWeapon','weaponOwner','ordinaryExit','pursuit','thirdPartiesInArea','policy','clubHeld','playerHealth','playerMind','playerSpirituality','playerInjuries','playerRisk','physique','perception','will','knowledge','mastery','preparation','root','materials','body','flashSample','crafts','craftingPromotionWeek','craftingCaseStatus','kitsUsed','randomSeed','randomCursor'];
export function validAllKnowingEyeCombatSource(x:AllKnowingEyeCombatSource):boolean {
 try{const p=x.root,prep=x.preparation;
 return shape(x,SOURCE_KEYS)&&shape(x.body,Object.keys(initialAllKnowingEyeBody()))&&validateAllKnowingEyePreparation(prep)&&typeof x.runId==='string'&&!!x.runId&&integer(x.revision)&&x.week===prep.week&&isValidGameDate(x.date)&&same(x.date,prep.date)&&integer(x.round,1)&&integer(x.startHistoryIndex)&&x.attemptWeek===x.week&&x.encounterId==='ALL_KNOWING_EYE_DISPUTE'&&x.targetId===ALL_KNOWING_EYE_TARGET_ID&&x.targetName==='埃德温·罗斯'&&x.targetAge===47&&x.targetSequence===1&&x.targetCore===24&&x.actualBody===true&&x.independentMind===true&&x.playerBodyId===`${x.runId}:body`&&x.enemyWeapon==='AE1-EDWIN-ROD'&&x.weaponOwner===ALL_KNOWING_EYE_TARGET_ID&&x.ordinaryExit==='OPEN'&&x.pursuit===false&&x.thirdPartiesInArea===0&&ALL_KNOWING_EYE_POLICIES.includes(x.policy)&&x.clubHeld===prep.playerClubHeld&&
 [x.playerHealth,x.playerMind].every(n=>integer(n,1,100))&&integer(x.playerSpirituality,0,120)&&[x.physique,x.perception,x.will,x.knowledge].every(n=>integer(n,0,500))&&same({physique:x.physique,perception:x.perception,will:x.will,knowledge:x.knowledge},prep.after.coreStats)&&shape(x.mastery,[...ALL_KNOWING_EYE_INHERITED_SKILL_IDS,...ALL_KNOWING_EYE_NEW_ABILITY_IDS])&&Object.values(x.mastery).every(n=>integer(n,0,500))&&same(Object.keys(x.mastery).sort(),Object.keys(prep.after.mastery).sort())&&ALL_KNOWING_EYE_INHERITED_SKILL_IDS.every(id=>x.mastery[id]===prep.after.mastery[id])&&x.mastery[BOUNDED_INSIGHT]===Math.min(500,prep.after.mastery[BOUNDED_INSIGHT]!+8*x.body.boundedInsightSuccesses)&&x.mastery[PENDING_FORECAST]===Math.min(500,prep.after.mastery[PENDING_FORECAST]!+8*x.body.pendingForecastSuccesses)&&
 integer(x.playerRisk)&&validAllKnowingEyeInjuries(x.playerInjuries,x.revision)&&validAllKnowingEyeInjuries(x.body.enemyInjuries,x.revision)&&validAllKnowingEyeMaterials(x.materials)&&x.materials.weapon.location===x.body.weaponLocation&&x.materials.weapon.charge===4-x.body.powerUses.FLASH&&x.body.boundedInsightAttempts<=x.round-1&&x.body.pendingForecastAttempts<=x.round-1&&x.body.powerUses.FEINT<=x.round-1&&
 validAllKnowingEyeScene(p)&&p.siteId===ALL_KNOWING_EYE_SITE&&p.playerLocation==='YARD'&&p.observedSourceId===`${x.runId}:AE1-YARD:${prep.revision}`&&p.observationWeek===prep.week&&p.knownPlayerName===prep.playerName&&p.knownEnemyName==='埃德温·罗斯'&&p.clockSeconds===4+60*(x.round-1)&&p.conditionVersion===1+x.body.powerUses.FEINT&&validAllKnowingEyeBody(x.body)&&x.body.enemyStatus==='RESISTING'&&x.body.enemyMind>0&&typeof x.randomSeed==='string'&&!!x.randomSeed&&x.randomSeed.length<=256&&integer(x.randomCursor)&&prep.runId===x.runId&&prep.randomSeed===x.randomSeed&&prep.randomCursor<=x.randomCursor&&prep.revision<=x.revision-x.round&&
 validAllKnowingEyeCrafts(x,x.week)&&same(x.flashSample,prep.flashSample)&&x.craftingPromotionWeek===prep.craftingPromotionWeek&&x.craftingCaseStatus===prep.craftingCaseStatus&&x.kitsUsed===prep.kitsUsed&&x.crafts.length===prep.crafts.length&&x.crafts.every((c,i)=>{const original=prep.crafts[i]!;return same({...c,status:original.status,usedWeek:original.usedWeek},original)&&(original.status==='CONSUMED'?same(c,original):c.status==='PLAYER'||c.status==='CONSUMED'&&c.usedWeek===x.week);})&&x.body.observations.every(o=>o.round<x.round&&o.atSeconds<p.clockSeconds);
 }catch{return false;}
}
export const validateAllKnowingEyeCombatSource=validAllKnowingEyeCombatSource;
/** Shared actual consequence resolver, exposed for declared isolated BODY/MENTAL
 * tests without seeking or replacing any campaign seed/cursor. */
export function resolveAllKnowingEyeConsequences(x:AllKnowingEyeCombatSource,r:AllKnowingEyeRuntime,players:AllKnowingEyeActionEvidence[],enemies:AllKnowingEyeActionEvidence[],winner:'PLAYER'|'ENEMY',retreat:SliceCombatRound['retreat'],rng:ActionRandomStream) {
  const b=r.body;
  let playerHealth = r.playerH, playerRisk = x.playerRisk, outcome: AllKnowingEyeResolution = retreat === 'SUCCESS' ? 'RETREATED' : b.enemyMind === 0 ? 'ENEMY_SURRENDERED' : 'CONTINUE';
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
export function replayAllKnowingEyeCombatRound(x: AllKnowingEyeCombatSource, stance: SliceStance): { round: SliceCombatRound; outcome: AllKnowingEyeResolution } {
  if (!validAllKnowingEyeCombatSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new Error('缺少真实原来源。');
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = createAllKnowingEyeRuntime(x), b = r.body;
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = allKnowingEyeActionCount(playerCountRoll), enemyCount = allKnowingEyeEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: AllKnowingEyeActionEvidence[] = [], enemies: AllKnowingEyeActionEvidence[] = [], remaining = { PLAYER: playerCount, ENEMY: enemyCount }; let retreat: SliceCombatRound['retreat'] = 'NONE';
  if (b.enemyMind === 0) remaining.PLAYER = remaining.ENEMY = 0;
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) for (const actor of order) {
    if (!remaining[actor]) continue;
    if (actor === 'PLAYER' && stance === 'RETREAT') { remaining.PLAYER = 0; retreat = rng.nextInt(1, 100) <= 50 ? 'SUCCESS' : 'FAILURE'; if (retreat === 'SUCCESS') { remaining.ENEMY = 0; break; } continue; }
    if (remaining.ENEMY > 0 && !r.pendingEnemyAction) declareAllKnowingEyeEnemyAction(x, r, drawAllKnowingEyeEnemyAbility(rng), enemies.length);
    remaining[actor]--; const index = players.length + enemies.length;
    if (actor === 'PLAYER') players.push(resolveAllKnowingEyePlayerSlot(x, r, drawAllKnowingEyeAbility(rng, null, stance), index, rng));
    else enemies.push(resolveAllKnowingEyeEnemySlot(x, r, r.pendingEnemyAction!.planned, index, rng));
    if (b.enemyMind === 0) { b.enemyStatus = 'SURRENDERED'; remaining.PLAYER = remaining.ENEMY = 0; break; }
  }
  const sum = (a: AllKnowingEyeActionEvidence[], key: 'selfGain' | 'enemyReduction') => a.reduce((n, v) => n + v[key], 0);
  const core = x.physique * .35 + x.perception * .25 + x.will * .25 + x.knowledge * .15;
  const playerAdvantage = Math.max(125, base(core, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, base(x.targetCore, x.body.enemyHealth, x.body.enemyMind, x.body.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction'));
  const winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100, winner = retreat === 'SUCCESS' ? 'ENEMY' : b.enemyMind === 0 ? 'PLAYER' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  const {playerHealth,playerRisk,outcome,playerInjuries,consequenceWeights,consequenceRoll,consequenceDomain}=resolveAllKnowingEyeConsequences(x,r,players,enemies,winner,retreat,rng);
  advanceAllKnowingEyeCombatClock(r, x.root.clockSeconds + 60 - r.root.clockSeconds);
  for (const key of ['boundedInsight','pendingForecast','oldResponse'] as const) { if (r.windows[key]) r.expiredWindows.push(structuredClone(r.windows[key]!)); r.windows[key] = null; }
  r.pendingEnemyAction = null; if (b.enemyStatus !== 'RESISTING') r.materials.weapon.location = 'YARD'; b.weaponLocation = r.materials.weapon.location;
  const o: AllKnowingEyeRoundOutcome = { ...structuredClone(b), targetId: ALL_KNOWING_EYE_TARGET_ID, round: x.round, source: structuredClone(x), stance, continuing: outcome === 'CONTINUE',
    playerHealthAfter: playerHealth, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, playerInjuriesAfter: playerInjuries, playerRiskAfter: playerRisk, materialsAfter: structuredClone(r.materials), craftsAfter: structuredClone(r.crafts), consumedCraftIds: players.flatMap(a=>a.consumedCraftId?[a.consumedCraftId]:[]), masteryAfter: { ...r.mastery },
    rootAfter: structuredClone(r.root), elapsedSeconds: 60, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies, expiredWindows: r.expiredWindows,
    windowsAfter: structuredClone(r.windows), pendingEnemyActionAfter: null };
  const round: SliceCombatRound = { round: x.round, stance, first, playerCount, enemyCount, playerCountRoll, enemyCountRoll,
    moves: [...players, ...enemies].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })),
    playerAdvantage, enemyAdvantage, winChance, winner, consequence: '', consequenceWeights, retreat, ...(consequenceDomain === undefined ? {} : { consequenceDomain }), ...(consequenceRoll === undefined ? {} : { consequenceRoll }), allKnowingEyeOutcome: o };
  round.consequence = allKnowingEyeCombatConsequence(round); return { round, outcome };
}
export function validateAllKnowingEyeRoundOutcome(v: unknown): v is AllKnowingEyeRoundOutcome { try { const o = v as AllKnowingEyeRoundOutcome; return !!o && same(o, replayAllKnowingEyeCombatRound(o.source, o.stance).round.allKnowingEyeOutcome); } catch { return false; } }
export function validateAllKnowingEyeCombatRound(round: SliceCombatRound): boolean { try { const o = round.allKnowingEyeOutcome; return !!o && same(round, replayAllKnowingEyeCombatRound(o.source, o.stance).round); } catch { return false; } }
export function nextAllKnowingEyeCombatSource(o: AllKnowingEyeRoundOutcome): AllKnowingEyeCombatSource {
  return { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter,
    playerSpirituality: Math.min(120, o.playerSpiritualityAfter + 12), playerInjuries: structuredClone(o.playerInjuriesAfter), playerRisk: o.playerRiskAfter,
    root: structuredClone(o.rootAfter), body: combatBody(o), materials: structuredClone(o.materialsAfter), crafts: structuredClone(o.craftsAfter), mastery: { ...o.masteryAfter }, randomCursor: o.randomCursorAfter };
}
export function allKnowingEyeCombatConsequence(round: SliceCombatRound): string {
  const o = round.allKnowingEyeOutcome!, who = round.winner === 'PLAYER' ? '埃德温' : '你';
  let text = round.retreat === 'SUCCESS' ? '撤离判定成功，将沿普通4米出口实际离开。' : round.consequenceDomain === 'MENTAL' ? `${who}承受实际精神压力，精神减少10，没有新增身体伤口或身体风险。` : round.consequenceDomain === 'BODY' ? `${who}承受实际物理攻击，按共同伤势盘结算，实掷${round.consequenceRoll}/100（轻${round.consequenceWeights!.light}/重${round.consequenceWeights!.heavy}/死亡${round.consequenceWeights!.death}）。` : '本轮没有实际致伤来源，不掷身体伤势盘、不增加身体风险。';
  const attacks = round.winner === 'PLAYER' ? o.playerActions : o.enemyActions;
  if (round.consequenceDomain) text += ` 实际${round.consequenceDomain === 'BODY' ? '身体' : '精神'}来源：${attacks.filter(a => round.consequenceDomain === 'BODY' ? a.threatens : a.mentalPressure).map(a => a.selectedAbility).join('、')}。`;
  text += ` 本人健康${o.source.playerHealth}→${o.playerHealthAfter}、精神${o.source.playerMind}→${o.playerMindAfter}；埃德温健康${o.source.body.enemyHealth}→${o.enemyHealth}、精神${o.source.body.enemyMind}→${o.enemyMind}。`;
  if (o.playerHealthAfter > 0 && o.playerMindAfter === 0) text += '本人精神耗尽，仍活着，停止抵抗后沿普通出口离开。';
  if (o.playerHealthAfter === 0) text += '本人的原身体真实死亡，本周目终结。'; else if (o.enemyHealth === 0) text += '埃德温原身体真实死亡，唯一原杆留地。'; else if (o.enemyStatus === 'SURRENDERED') text += '埃德温因实际伤势或精神耗尽自主停止抵抗，仍活着，原杆放在地面。';
  return text + ' 本轮实际60秒；未使用窗口到时结束，已经花费的灵性与精神不退。同一原件资源保留，玛拉、伊蕾娜与旧遭遇人物均不在场；实际原微光片的消耗保留，旧装置仍为零储能。';
}

export function projectAllKnowingEyeCombat(s:SliceState){
 const e=s.allKnowingEye.encounter,last=s.combat?.encounterId==='ALL_KNOWING_EYE_DISPUTE'?s.combat.lastRound?.allKnowingEyeOutcome:e.terminal?s.combatHistory[e.terminal.historyIndex]?.allKnowingEyeOutcome:null;
 return{enemyName:'埃德温·罗斯（47岁）',targetId:e.targetId,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,weaponLocation:e.weaponLocation,powerUses:{...e.powerUses},policy:e.policy,scene:structuredClone(e.scene),materials:structuredClone(e.materials),crafts:structuredClone(s.mysticismMagister.crafts),remainingCraftIds:s.mysticismMagister.crafts.filter(c=>c.status==='PLAYER').map(c=>c.id),flashSample:structuredClone(s.polymath.samples.FLASH),lastActionSequence:last?[...last.playerActions,...last.enemyActions].sort((a,b)=>a.order-b.order):[],constants:ALL_KNOWING_EYE_COMBAT_CONSTANTS,countWheel:ALL_KNOWING_EYE_COUNT_WHEEL,enemyCountWheel:ALL_KNOWING_EYE_ENEMY_COUNT_WHEEL,abilityWheel:allKnowingEyeAbilityWheel(s,null),enemyAbilityWheel:ALL_KNOWING_EYE_ENEMY_ABILITY_WHEEL,facts:[
 '体35%、感25%、意25%、知15%；双方1至6动作10/15/25/25/15/10，基础1250、底125、上限120，仅继续轮恢复12。',
 '现场洞察只辅助下一独立实际行动10；先机预判只削弱下一可见身体冲击30，精神压力单独结算。',
 '每轮各一次，失败照付；条件改变、视线遮挡、离场或满30秒使旧窗口失效，空窗口不涨掌握。',
 '原杆仅四次闪光；原微光片按实际原件逐个消耗，没有补发，原装置不充能。',
 '身体攻击走共同伤势盘；精神耗尽活着停战，身体死亡终结本周目。']};
}
