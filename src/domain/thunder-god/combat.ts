import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import { CATASTROPHE_COUNT_WHEEL, catastropheActionCount } from '../catastrophe/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { THUNDER_GOD_TARGET_ID, THUNDER_GOD_SITE, THUNDER_GOD_POWER_IDS, THUNDER_GOD_POWERS, THUNDER_GOD_POLICIES,
  combatBody, initialThunderGodBody, hasThunderGodDisputeOpponent, validateThunderGodPreparation,
  validThunderGodMaterials, validThunderGodScene, type ThunderGodCombatBody, type ThunderGodEnemyIntent,
  type ThunderGodPreparation, type ThunderGodMaterials, type ThunderGodScene, type ThunderGodPolicy } from './encounter.js';

/** Bounded fictional supernatural mechanics on the new dry platform. No sea,
 * original cove apparatus, item pool, companion or permanent power is created. */
export const THUNDER_GOD_COUNT_WHEEL=CATASTROPHE_COUNT_WHEEL;
export const THUNDER_GOD_ENEMY_COUNT_WHEEL=CATASTROPHE_COUNT_WHEEL;
export const thunderGodActionCount=catastropheActionCount;
export const thunderGodEnemyActionCount=catastropheActionCount;
export const THUNDER_GOD_COMBAT_CONSTANTS={weights:{physique:.35,perception:.25,will:.25,knowledge:.15},tier:1250,floor:125,maxSpirituality:120,continuingRecovery:12,enemyPhysique:24,guidedThunderCost:8,guidedThunderMindCost:2,guidedThunderAid:30,stormBraceCost:6,stormBraceMindCost:2,stormBraceReduction:30,windowSeconds:30,resistanceChance:30,slotSeconds:5,roundSeconds:60} as const;
export const GUIDED_THUNDER='tyrant.s1.guided-thunder',STORM_BRACE='tyrant.s1.storm-brace';
export const THUNDER_GOD_NEW_ABILITY_IDS=[GUIDED_THUNDER,STORM_BRACE] as const;
export const THUNDER_GOD_INHERITED_SKILL_IDS=[
 'tyrant.s9.physique','tyrant.s9.aquatic-affinity','tyrant.s9.balance','tyrant.s8.fury','tyrant.s8.impact-resilience',
 'tyrant.s7.water-control','tyrant.s7.water-binding','tyrant.s7.navigation','tyrant.s6.wind-blade','tyrant.s6.wind-control','tyrant.s6.short-flight',
 'tyrant.s5.shallow-lightning','tyrant.s5.sea-song','tyrant.s5.deep-water-activity','tyrant.s4.sea-tornado','tyrant.s4.great-lightning','tyrant.s4.surge-control',
 'tyrant.s3.remote-tempest','tyrant.s3.sea-domain','tyrant.s3.water-recollection','tyrant.s2.storm-field','tyrant.s2.water-pressure',
] as const;
export type ThunderGodMoveId=typeof THUNDER_GOD_INHERITED_SKILL_IDS[number]|typeof THUNDER_GOD_NEW_ABILITY_IDS[number]|'STRIKE'|'BLOCK'|'EVADE'|'OBSERVE'|'ACCIDENT';
type Ability='physique'|'knowledge'|'perception'|'will';
interface InheritedPower {id:ThunderGodMoveId;label:string;cost:number;ability:Ability;difficulty:number;gain:number;reduction:number;kind:'BODY'|'MENTAL'|'NONE';physical:boolean}
/** Original dry-ground strengths. Conditional sea/flight/old-site techniques
 * retain their IDs/masteries but have no manufactured source on this platform. */
export const THUNDER_GOD_INHERITED_POWERS:readonly InheritedPower[]=[
 {id:'tyrant.s9.physique',label:'继承水手体术',cost:0,ability:'physique',difficulty:12,gain:14.3,reduction:0,kind:'BODY',physical:true},
 {id:'tyrant.s9.balance',label:'继承平衡自保',cost:0,ability:'will',difficulty:12,gain:0,reduction:2.6,kind:'NONE',physical:false},
 {id:'tyrant.s8.fury',label:'继承蓄势怒击',cost:0,ability:'physique',difficulty:14,gain:23.4,reduction:0,kind:'BODY',physical:true},
 {id:'tyrant.s8.impact-resilience',label:'继承抗冲击自保',cost:0,ability:'will',difficulty:14,gain:0,reduction:5.85,kind:'NONE',physical:false},
 {id:'tyrant.s6.wind-blade',label:'继承有限风刃',cost:3,ability:'will',difficulty:16,gain:28,reduction:0,kind:'BODY',physical:false},
 {id:'tyrant.s6.wind-control',label:'继承有限控风',cost:4,ability:'will',difficulty:16,gain:0,reduction:18,kind:'NONE',physical:false},
 {id:'tyrant.s5.shallow-lightning',label:'继承浅层雷击',cost:4,ability:'knowledge',difficulty:14,gain:24,reduction:0,kind:'BODY',physical:false},
 {id:'tyrant.s5.sea-song',label:'继承短促海歌',cost:3,ability:'will',difficulty:14,gain:0,reduction:16,kind:'MENTAL',physical:false},
 {id:'tyrant.s4.great-lightning',label:'继承有限强雷',cost:6,ability:'will',difficulty:18,gain:38,reduction:0,kind:'BODY',physical:false},
];
export const THUNDER_GOD_ABILITIES:readonly{id:ThunderGodMoveId;label:string;weight:number;stance:SliceStance|null}[]=[
 {id:'STRIKE',label:'本人普通打击',weight:12,stance:'ATTACK'},{id:'BLOCK',label:'普通防备',weight:5,stance:'DEFEND'},{id:'EVADE',label:'普通避让',weight:5,stance:'DEFEND'},{id:'OBSERVE',label:'实际走近揭开原罩并观察',weight:4,stance:'PREPARE'},
 ...THUNDER_GOD_INHERITED_SKILL_IDS.map(id=>{const p=THUNDER_GOD_INHERITED_POWERS.find(p=>p.id===id);return{id,label:p?`${p.label}：${p.cost}灵性，实际检定与抵抗`:'原海水、飞行或旧场条件不在本场，普通观察',weight:p?7:1,stance:(p?.kind==='BODY'?'ATTACK':p?.reduction?'DEFEND':'CONTROL') as SliceStance};}),
 {id:GUIDED_THUNDER,label:'雷势引导：8灵性2精神、感知18，下一真实威胁攻击加30',weight:14,stance:'CONTROL'},
 {id:STORM_BRACE,label:'风雷护持：6灵性2精神、意志18，下一可见身体冲击减30',weight:14,stance:'DEFEND'},
 {id:'ACCIDENT',label:'判断失衡：−22.5',weight:3,stance:null},
];
export const THUNDER_GOD_PLAYER_ABILITIES=THUNDER_GOD_ABILITIES;
export const THUNDER_GOD_ENEMY_ABILITY_WHEEL:readonly SliceWheelEntry[]=[
 {id:'LIGHTNING',label:'原杆有限雷击：7灵性与1原储能、身体贡献105',weight:25},
 {id:'WIND_WARD',label:'有限风护：6灵性、减势60',weight:20},
 {id:'SEA_SONG',label:'有限海歌：7灵性、精神贡献65',weight:20},
 {id:'BODY_STRIKE',label:'自有原杆普通打击：20×身体',weight:20},
 {id:'OBSCURE',label:'关闭自己的原罩：3灵性、每轮一次，改变条件与视线',weight:10},
 {id:'ACCIDENT',label:'判断偏差：−22.5',weight:5},
];
export const isThunderGod=(s:SliceState)=>s.progression.pathwayId==='tyrant'&&s.progression.sequence===1;
const tickets=(stance:SliceStance|null)=>THUNDER_GOD_ABILITIES.map(a=>a.weight*(a.stance===stance&&stance!==null?5:4));
export function thunderGodAbilityWheel(_s:SliceState,stance:SliceStance|null):SliceWheelEntry[]{const w=tickets(stance),total=w.reduce((n,v)=>n+v,0);return THUNDER_GOD_ABILITIES.map((a,i)=>({id:a.id,label:a.label,weight:w[i]!/total*100}));}
export function drawThunderGodAbility(rng:ActionRandomStream,_s:SliceState|null,stance:SliceStance|null):ThunderGodMoveId{const w=tickets(stance);let n=rng.nextInt(1,w.reduce((a,b)=>a+b,0));for(const[i,a]of THUNDER_GOD_ABILITIES.entries()){n-=w[i]!;if(n<=0)return a.id;}throw new Error('行动盘无效。');}
export function drawThunderGodEnemyAbility(rng:ActionRandomStream):ThunderGodEnemyIntent{let n=rng.nextInt(1,100);for(const a of THUNDER_GOD_ENEMY_ABILITY_WHEEL){n-=a.weight;if(n<=0)return a.id as ThunderGodEnemyIntent;}throw new Error('对手行动盘无效。');}
const same=(a:unknown,b:unknown)=>a===b||(a!==undefined&&b!==undefined&&stableStringify(a)===stableStringify(b));
const integer=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER):n is number=>Number.isSafeInteger(n)&&(n as number)>=min&&(n as number)<=max;
const shape=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...keys].sort());
const physicalAt=(n:number)=>n>75?1:n>50?.95:n>25?.9:.8;
export interface ThunderGodCombatSource {
 runId:string;revision:number;week:number;date:PublicGameDate;round:number;encounterId:'THUNDER_GOD_DISPUTE';targetId:typeof THUNDER_GOD_TARGET_ID;
 attemptWeek:number;startHistoryIndex:number;targetName:'欧伦·盖奇';targetAge:48;targetSequence:1;targetCore:24;actualBody:true;independentMind:true;playerBodyId:string;
 enemyWeapon:'TG1-OREN-ROD';weaponOwner:typeof THUNDER_GOD_TARGET_ID;ordinaryExit:'OPEN';pursuit:false;thirdPartiesInArea:0;policy:ThunderGodPolicy;clubHeld:boolean;
 playerHealth:number;playerMind:number;playerSpirituality:number;playerInjuries:SliceInjury[];playerRisk:number;physique:number;perception:number;will:number;knowledge:number;mastery:Record<string,number>;
 preparation:ThunderGodPreparation;root:ThunderGodScene;materials:ThunderGodMaterials;body:ThunderGodCombatBody;randomSeed:string;randomCursor:number;
}
export function currentThunderGodCombatSource(s:SliceState):ThunderGodCombatSource|null {
 if(!hasThunderGodDisputeOpponent(s))return null;const e=s.thunderGod.encounter,c=s.combat!;
 return{runId:s.runId,revision:s.revision,week:s.week,date:{...s.date},round:c.round,encounterId:'THUNDER_GOD_DISPUTE',targetId:THUNDER_GOD_TARGET_ID,attemptWeek:e.attemptWeek!,startHistoryIndex:e.startHistoryIndex!,targetName:'欧伦·盖奇',targetAge:48,targetSequence:1,targetCore:24,actualBody:true,independentMind:true,playerBodyId:`${s.runId}:body`,enemyWeapon:'TG1-OREN-ROD',weaponOwner:THUNDER_GOD_TARGET_ID,ordinaryExit:'OPEN',pursuit:false,thirdPartiesInArea:0,policy:e.policy,clubHeld:s.town.clubLocation==='HAND',playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,playerInjuries:structuredClone(s.injuries),playerRisk:s.injuryRisk,...s.character.coreStats,mastery:{...s.progression.mastery},preparation:structuredClone(e.preparation!),root:structuredClone(e.scene),materials:structuredClone(e.materials),body:combatBody(e),randomSeed:s.random.seed,randomCursor:s.random.cursor};
}
export interface ThunderGodPendingAction {id:string;planned:ThunderGodEnemyIntent;actual:ThunderGodEnemyIntent;declaredAt:number;observedAt:number;observationSeconds:0;conditionVersion:number;visible:boolean;bodyImpact:boolean}
export interface ThunderGodWindow {id:string;kind:'GUIDED_THUNDER'|'STORM_BRACE';createdAt:number;expiresAt:number;openedOrder:number;conditionVersion:number;targetId:typeof THUNDER_GOD_TARGET_ID;targetActionId:string|null;magnitude:30}
export interface ThunderGodWindows {guidedThunder:ThunderGodWindow|null;stormBrace:ThunderGodWindow|null}
export interface ThunderGodActionEvidence {
 order:number;actor:'PLAYER'|'ENEMY';id:string;planned:string;selectedAbility:string;fallbackReason:string|null;label:string;selfGain:number;enemyReduction:number;threatens:boolean;mentalPressure:boolean;attackKind:'NONE'|'BODY'|'MENTAL';rawContribution:number;rawReduction:number;
 paidCost:number;mindCost:number;physicalFactor:number;check:PublicCheckResult|null;resistanceRoll:number|null;resistanceChance:number|null;succeeded:boolean;
 finiteResult:'NONE'|'UNAVAILABLE'|'ALREADY_ATTEMPTED'|'INSUFFICIENT'|'FAILED'|'RESISTED'|'PENDING'|'APPLIED';windowsBefore:ThunderGodWindows;windowsAfter:ThunderGodWindows;pendingBefore:ThunderGodPendingAction|null;pendingAfter:ThunderGodPendingAction|null;masteryApplied:string[];countered:string[];
 rodChargeSpent:number;materialsBefore:ThunderGodMaterials;materialsAfter:ThunderGodMaterials;conditionVersionBefore:number;conditionVersionAfter:number;atSeconds:number;elapsedSeconds:5;travelMetres:number;travelPath:number[];lateralTravelPath:number[];randomCursorBefore:number;randomCursorAfter:number;playerMindAfter:number;playerSpiritualityAfter:number;enemyMindAfter:number;enemySpiritualityAfter:number;
}
export interface ThunderGodRuntime {body:ThunderGodCombatBody;root:ThunderGodScene;materials:ThunderGodMaterials;playerH:number;playerM:number;playerS:number;mastery:Record<string,number>;windows:ThunderGodWindows;expiredWindows:ThunderGodWindow[];pendingEnemyAction:ThunderGodPendingAction|null;guidedThunderAttempted:boolean;stormBraceAttempted:boolean;obscureUsed:boolean}
export function createThunderGodRuntime(x:ThunderGodCombatSource):ThunderGodRuntime{return{body:structuredClone(x.body),root:structuredClone(x.root),materials:structuredClone(x.materials),playerH:x.playerHealth,playerM:x.playerMind,playerS:x.playerSpirituality,mastery:{...x.mastery},windows:{guidedThunder:null,stormBrace:null},expiredWindows:[],pendingEnemyAction:null,guidedThunderAttempted:false,stormBraceAttempted:false,obscureUsed:false};}
const active=(r:ThunderGodRuntime)=>r.root.playerLocation==='PLATFORM'&&r.root.playerCoordinate===4&&r.body.enemyStatus==='RESISTING'&&r.body.enemyHealth>0&&r.body.enemyMind>0&&r.playerH>0&&r.playerM>0;
const observed=(r:ThunderGodRuntime)=>active(r)&&r.root.visibleBodyLine&&r.materials.screen.hood==='OPEN'&&r.root.observedConditionVersion===r.root.conditionVersion;
function invalidate(r:ThunderGodRuntime,key:keyof ThunderGodWindows):void {const w=r.windows[key];if(w)r.expiredWindows.push(structuredClone(w));r.windows[key]=null;}
export function advanceThunderGodCombatClock(r:ThunderGodRuntime,seconds:number):void {
 if(!integer(seconds))throw new Error('实际时间无效。');r.root.clockSeconds+=seconds;r.root.externalSeconds+=seconds;
 for(const key of ['guidedThunder','stormBrace'] as const){const w=r.windows[key];if(w&&(w.expiresAt<=r.root.clockSeconds||!observed(r)||w.conditionVersion!==r.root.conditionVersion))invalidate(r,key);}
}
export function declareThunderGodEnemyAction(x:ThunderGodCombatSource,r:ThunderGodRuntime,planned:ThunderGodEnemyIntent,index:number):ThunderGodPendingAction {
 if(!active(r)||r.pendingEnemyAction||![...THUNDER_GOD_ENEMY_ABILITY_WHEEL.map(a=>a.id),'OBSERVE'].includes(planned))throw new Error('不能覆盖待执行动作或替已停战者行动。');
 const power=THUNDER_GOD_POWERS.find(p=>p.id===planned),actual=power&&(r.body.enemySpirituality<power.cost||planned==='LIGHTNING'&&r.materials.weapon.charge===0)?'BODY_STRIKE':planned==='OBSCURE'&&(r.obscureUsed||r.materials.screen.hood==='CLOSED')?'OBSERVE':planned;
 r.pendingEnemyAction={id:`${x.runId}:TG1-PENDING:${x.round}:${index}`,planned,actual,declaredAt:r.root.clockSeconds,observedAt:r.root.clockSeconds,observationSeconds:0,conditionVersion:r.root.conditionVersion,visible:observed(r),bodyImpact:actual==='LIGHTNING'||actual==='BODY_STRIKE'};
 return structuredClone(r.pendingEnemyAction);
}
function baseAction(r:ThunderGodRuntime,actor:'PLAYER'|'ENEMY',id:string,order:number,rng:ActionRandomStream):ThunderGodActionEvidence {
 advanceThunderGodCombatClock(r,0);
 return{order,actor,id,planned:id,selectedAbility:id,fallbackReason:null,label:'',selfGain:0,enemyReduction:0,threatens:false,mentalPressure:false,attackKind:'NONE',rawContribution:0,rawReduction:0,paidCost:0,mindCost:0,physicalFactor:physicalAt(actor==='PLAYER'?r.playerH:r.body.enemyHealth),check:null,resistanceRoll:null,resistanceChance:null,succeeded:false,finiteResult:'NONE',windowsBefore:structuredClone(r.windows),windowsAfter:structuredClone(r.windows),pendingBefore:structuredClone(r.pendingEnemyAction),pendingAfter:null,masteryApplied:[],countered:[],rodChargeSpent:0,materialsBefore:structuredClone(r.materials),materialsAfter:structuredClone(r.materials),conditionVersionBefore:r.root.conditionVersion,conditionVersionAfter:r.root.conditionVersion,atSeconds:r.root.clockSeconds,elapsedSeconds:5,travelMetres:0,travelPath:[actor==='PLAYER'?r.root.playerCoordinate:r.root.enemyCoordinate],lateralTravelPath:[0],randomCursorBefore:rng.cursor,randomCursorAfter:rng.cursor,playerMindAfter:r.playerM,playerSpiritualityAfter:r.playerS,enemyMindAfter:r.body.enemyMind,enemySpiritualityAfter:r.body.enemySpirituality};
}
function closeAction(a:ThunderGodActionEvidence,r:ThunderGodRuntime,rng:ActionRandomStream){advanceThunderGodCombatClock(r,5);a.windowsAfter=structuredClone(r.windows);a.pendingAfter=structuredClone(r.pendingEnemyAction);a.materialsAfter=structuredClone(r.materials);a.conditionVersionAfter=r.root.conditionVersion;a.randomCursorAfter=rng.cursor;a.playerMindAfter=r.playerM;a.playerSpiritualityAfter=r.playerS;a.enemyMindAfter=r.body.enemyMind;a.enemySpiritualityAfter=r.body.enemySpirituality;a.threatens=a.attackKind==='BODY'&&a.selfGain>0;a.mentalPressure=a.attackKind==='MENTAL'&&(a.selfGain>0||a.enemyReduction>0);a.label+=` 实际5秒，条件${r.root.conditionVersion}，本人灵性${r.playerS}、精神${r.playerM}，对手灵性${r.body.enemySpirituality}。`;return a;}
function walkStrike(r:ThunderGodRuntime,a:ThunderGodActionEvidence){a.travelMetres=4;a.travelPath=[4,6,4];r.root.playerTravelMetres+=4;}
function ordinary(x:ThunderGodCombatSource,r:ThunderGodRuntime,a:ThunderGodActionEvidence,why:string,attack=false){a.selectedAbility=attack?'STRIKE':'BLOCK';a.fallbackReason=why||null;a.label=why+(attack?'本人以实际持握原棍或原身体普通打击。':'本人普通防备。');a.succeeded=true;if(attack){a.selfGain=(x.clubHeld?16:12)*a.physicalFactor;a.attackKind='BODY';walkStrike(r,a);}else a.enemyReduction=10;}
function pay(r:ThunderGodRuntime,a:ThunderGodActionEvidence,s:number,m=0){if(r.playerS<s||r.playerM<=m)return false;r.playerS-=s;r.playerM-=m;r.body.totalOwnerMindSpent+=m;a.paidCost=s;a.mindCost=m;return true;}
function check(x:ThunderGodCombatSource,a:ThunderGodActionEvidence,ability:Ability,difficulty:number,rng:ActionRandomStream){a.check=resolveNormalCheck({ability,baseAbility:x[ability],difficulty,modifiers:[],roll:rng.nextInt(1,100)});a.succeeded=['SUCCESS','GREAT_SUCCESS'].includes(a.check.tier);a.label+=`${({physique:'体魄',knowledge:'知识',perception:'感知',will:'意志'})[ability]}检定${a.check.roll}，${a.succeeded?'成功':'失败'}。`;return a.succeeded;}
function resist(a:ThunderGodActionEvidence,rng:ActionRandomStream){a.resistanceChance=30;a.resistanceRoll=rng.nextInt(1,100);if(a.resistanceRoll<=30){a.succeeded=false;a.finiteResult='RESISTED';a.label+='对方实际抵抗，成本保留。';return false;}return true;}
function gainMastery(r:ThunderGodRuntime,a:ThunderGodActionEvidence,id:string){r.mastery[id]=Math.min(500,(r.mastery[id]??0)+8);a.masteryApplied.push(id);if(THUNDER_GOD_INHERITED_SKILL_IDS.includes(id as typeof THUNDER_GOD_INHERITED_SKILL_IDS[number]))r.body.inheritedApplications[id]=(r.body.inheritedApplications[id]??0)+1;}
function window(r:ThunderGodRuntime,kind:ThunderGodWindow['kind'],order:number,target:string|null=null):ThunderGodWindow{return{id:`TG1-${kind}-${r.root.clockSeconds}-${order}`,kind,createdAt:r.root.clockSeconds,expiresAt:r.root.clockSeconds+30,openedOrder:order,conditionVersion:r.root.conditionVersion,targetId:THUNDER_GOD_TARGET_ID,targetActionId:target,magnitude:30};}
function reveal(r:ThunderGodRuntime,a:ThunderGodActionEvidence){
 a.selectedAbility='OBSERVE';a.succeeded=true;a.travelMetres=2;a.travelPath=[4,5,4];r.root.playerTravelMetres+=2;
 if(r.materials.screen.hood==='CLOSED'){r.materials.screen.hood='OPEN';r.materials.screen.operations++;r.body.screenReveals++;r.root.conditionVersion++;}
 r.root.visibleBodyLine=true;r.root.observedConditionVersion=r.root.conditionVersion;
 if(r.pendingEnemyAction){r.pendingEnemyAction.visible=true;r.pendingEnemyAction.conditionVersion=r.root.conditionVersion;r.pendingEnemyAction.observedAt=r.root.clockSeconds;}
 a.label='本人实际走一米到原罩，若关闭则揭开同一原罩，再走一米返回并重新观察。';
}
export function resolveThunderGodPlayerSlot(x:ThunderGodCombatSource,r:ThunderGodRuntime,id:ThunderGodMoveId,order:number,rng:ActionRandomStream):ThunderGodActionEvidence {
 if(!THUNDER_GOD_ABILITIES.some(a=>a.id===id))throw new Error('未知本人动作。');const a=baseAction(r,'PLAYER',id,order,rng);
 if(!active(r)){a.finiteResult='UNAVAILABLE';a.label='本人或对手已离场、死亡或停止抵抗，没有新效果。';return closeAction(a,r,rng);}
 if(x.policy==='ORDINARY'&&id.startsWith('tyrant.'))ordinary(x,r,a,'预先选择只作普通行动；');
 else if(id===GUIDED_THUNDER||id===STORM_BRACE){
  const brace=id===STORM_BRACE,allowed=x.policy==='ALL'||x.policy===(brace?'STORM_BRACE':'GUIDED_THUNDER'),attempted=brace?r.stormBraceAttempted:r.guidedThunderAttempted,p=r.pendingEnemyAction;
  if(!allowed){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'预先策略未允许这项新能力；');}
  else if(attempted){a.finiteResult='ALREADY_ATTEMPTED';ordinary(x,r,a,'本轮已经实际尝试，不重骰、不延长窗口；');}
  else if(!observed(r)||brace&&(!p||!p.visible||!p.bodyImpact||p.conditionVersion!==r.root.conditionVersion)){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'缺少同一当前可见目标或下一已声明可见身体冲击；');}
  else if(!pay(r,a,brace?6:8,2)){a.finiteResult='INSUFFICIENT';ordinary(x,r,a,'灵性或精神不足，能力未施放；');}
  else{
   if(brace){r.stormBraceAttempted=true;r.body.stormBraceAttempts++;}else{r.guidedThunderAttempted=true;r.body.guidedThunderAttempts++;}
   a.label=brace?'为眼前下一真实身体冲击建立一次有限护持。':'只向当前亲见的欧伦建立一次有限定向雷势。';
   if(!check(x,a,brace?'will':'perception',18,rng))a.finiteResult='FAILED';
   else if(resist(a,rng)){if(brace){r.body.stormBraceChecks++;r.windows.stormBrace=window(r,'STORM_BRACE',order,p!.id);}else{r.body.guidedThunderChecks++;r.windows.guidedThunder=window(r,'GUIDED_THUNDER',order);}a.finiteResult='PENDING';a.label+='窗口最多30秒，本槽没有贡献或掌握奖励。';}
  }
 }else if(id==='STRIKE')ordinary(x,r,a,'',true);
 else if(id==='BLOCK'||id==='EVADE')ordinary(x,r,a,'');
 else if(id==='OBSERVE')reveal(r,a);
 else if(id==='ACCIDENT'){a.selfGain=-22.5;a.label='判断失衡，固定−22.5，不重抽。';}
 else{
  const power=THUNDER_GOD_INHERITED_POWERS.find(p=>p.id===id);
  if(!power){a.finiteResult='UNAVAILABLE';a.selectedAbility='OBSERVE';a.fallbackReason='实际海水、飞行路线或旧场原件不在干平台';a.label=a.fallbackReason+'，没有创造水源、投掷物、旧场效果或掌握奖励。';}
  else if(!observed(r)){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'原罩遮住目标，已学能力缺少当前视线；');}
  else if(!pay(r,a,power.cost)){a.finiteResult='INSUFFICIENT';ordinary(x,r,a,'不足原能力实际灵性成本；');}
  else{
   a.label=power.label+'。';
   if(!check(x,a,power.ability,power.difficulty,rng))a.finiteResult='FAILED';
   else if(resist(a,rng)){
    const factor=.65+.35*Math.max(0,Math.min(500,r.mastery[id]??0))/500;
    a.selfGain=(power.physical&&x.clubHeld?16:power.gain*factor)*(power.physical?a.physicalFactor:1);a.enemyReduction=power.reduction*factor;a.attackKind=power.kind;
    if(power.physical)walkStrike(r,a);if(a.selfGain>0||a.enemyReduction>0){gainMastery(r,a,id);a.finiteResult='APPLIED';}a.label+='仅当次有限实际效果，未建立跨轮免费能力。';
   }
  }
 }
 a.rawContribution=a.selfGain;a.rawReduction=a.enemyReduction;
 const aid=r.windows.guidedThunder;
 if(aid&&aid.openedOrder<order&&a.attackKind==='BODY'&&a.selfGain>0&&aid.expiresAt>a.atSeconds&&aid.conditionVersion===r.root.conditionVersion&&observed(r)){
  r.windows.guidedThunder=null;a.countered.push(aid.id);a.selfGain+=30;r.body.guidedThunderSuccesses++;gainMastery(r,a,GUIDED_THUNDER);a.finiteResult='APPLIED';a.label+='先前实付雷势只辅助这次后续真实威胁攻击30，窗口已消费。';
 }
 return closeAction(a,r,rng);
}
export function resolveThunderGodEnemySlot(x:ThunderGodCombatSource,r:ThunderGodRuntime,planned:ThunderGodEnemyIntent,order:number,rng:ActionRandomStream):ThunderGodActionEvidence {
 if(!active(r)){const a=baseAction(r,'ENEMY',planned,order,rng);a.finiteResult='UNAVAILABLE';a.label='原人已不在实际可交战位置，停止新效果。';return closeAction(a,r,rng);}
 if(!r.pendingEnemyAction)declareThunderGodEnemyAction(x,r,planned,order);const p=r.pendingEnemyAction!;if(p.planned!==planned)throw new Error('不能替换已观察的待执行动作。');const a=baseAction(r,'ENEMY',p.actual,order,rng);a.planned=planned;a.selectedAbility=p.actual;const power=THUNDER_GOD_POWERS.find(v=>v.id===p.actual);
 if(power){
  if(r.body.enemySpirituality<power.cost)throw new Error('已声明对手资源不一致。');r.body.enemySpirituality-=power.cost;r.body.powerUses[power.id]++;a.paidCost=power.cost;a.label=`欧伦实际施放${power.label}，独立灵性−${power.cost}。`;
  if(power.id==='LIGHTNING'){if(r.materials.weapon.charge<1)throw new Error('原杆已无储能。');r.materials.weapon.charge--;a.rodChargeSpent=1;}
  if(power.id==='OBSCURE'){
   r.obscureUsed=true;r.materials.screen.hood='CLOSED';r.materials.screen.operations++;r.root.conditionVersion++;r.root.visibleBodyLine=false;a.succeeded=true;a.finiteResult='APPLIED';
   a.travelMetres=2;a.travelPath=[6,5,6];
   for(const key of ['guidedThunder','stormBrace'] as const){if(r.windows[key])a.countered.push(r.windows[key]!.id);invalidate(r,key);}
  }else if(resist(a,rng)){
   a.succeeded=true;a.finiteResult='APPLIED';a.selfGain=power.selfGain;a.enemyReduction=power.enemyReduction;a.attackKind=power.id==='LIGHTNING'?'BODY':power.id==='SEA_SONG'?'MENTAL':'NONE';
   if((power.id==='LIGHTNING'||power.id==='WIND_WARD')&&observed(r))r.body.observations.push({power:power.id,conditionVersion:r.root.conditionVersion,round:x.round,order,atSeconds:r.root.clockSeconds,paidCost:power.id==='LIGHTNING'?7:6});
  }
 }else if(p.actual==='BODY_STRIKE'){a.succeeded=true;a.selfGain=20*a.physicalFactor;a.attackKind='BODY';a.travelMetres=4;a.travelPath=[6,4,6];a.label='欧伦用自己的原杆上前两米普通打击，再沿原路退回两米；储能或灵性不足时不施法、不重抽。';}
 else if(p.actual==='ACCIDENT'){a.selfGain=-22.5;a.label='对手判断偏差，−22.5，不重抽。';}else a.label='对手普通观察，没有额外资源。';
 a.rawContribution=a.selfGain;a.rawReduction=a.enemyReduction;
 const brace=r.windows.stormBrace;
 if(brace&&brace.targetActionId===p.id){
  r.windows.stormBrace=null;a.countered.push(brace.id);
  const reduction=a.attackKind==='BODY'&&brace.openedOrder<order&&brace.expiresAt>a.atSeconds&&brace.conditionVersion===r.root.conditionVersion&&p.visible&&observed(r)?Math.min(30,Math.max(0,a.selfGain)):0;
  a.selfGain-=reduction;if(reduction>0){r.body.stormBraceSuccesses++;gainMastery(r,a,STORM_BRACE);a.finiteResult='APPLIED';a.label+=`先前实付护持只削弱同一后续可见身体冲击${reduction}，不影响精神。`;}
 }
 r.pendingEnemyAction=null;return closeAction(a,r,rng);
}
export interface ThunderGodRoundOutcome extends ThunderGodCombatBody {
 targetId:typeof THUNDER_GOD_TARGET_ID;round:number;source:ThunderGodCombatSource;stance:SliceStance;continuing:boolean;playerHealthAfter:number;playerMindAfter:number;playerSpiritualityAfter:number;playerInjuriesAfter:SliceInjury[];playerRiskAfter:number;materialsAfter:ThunderGodMaterials;masteryAfter:Record<string,number>;rootAfter:ThunderGodScene;elapsedSeconds:60;randomCursorAfter:number;playerActions:ThunderGodActionEvidence[];enemyActions:ThunderGodActionEvidence[];expiredWindows:ThunderGodWindow[];windowsAfter:ThunderGodWindows;pendingEnemyActionAfter:null;
}
export type ThunderGodResolution='CONTINUE'|'PLAYER_DEAD'|'ENEMY_DEAD'|'ENEMY_SURRENDERED'|'RETREATED';
function penalty(n:number,max:number){const f=n/max;return f>.75?0:f>.5?.05:f>.25?.1:.2;}
function base(core:number,h:number,m:number,s:number){return(1250+Math.min(core,250))*(1-Math.min(.4,penalty(h,100)+penalty(m,100)+penalty(s,120)));}
function weights(risk:number){const death=Math.min(100,5+Math.min(risk,10)*10),shifted=death-5;return{light:Math.max(0,65-shifted),heavy:Math.max(0,30-Math.max(0,shifted-65)),death};}
export function validThunderGodBody(b:ThunderGodCombatBody):boolean {
 return integer(b.enemyHealth,0,100)&&integer(b.enemyMind,0,100)&&integer(b.enemySpirituality,0,120)&&integer(b.enemyRisk)&&Array.isArray(b.enemyInjuries)&&['RESISTING','SURRENDERED','DEAD'].includes(b.enemyStatus)&&(b.enemyStatus==='DEAD')===(b.enemyHealth===0)&&(b.enemyMind>0||b.enemyStatus!=='RESISTING')&&['HAND','PLATFORM'].includes(b.weaponLocation)&&(b.enemyStatus==='RESISTING'||b.weaponLocation==='PLATFORM')&&shape(b.powerUses,THUNDER_GOD_POWER_IDS)&&THUNDER_GOD_POWER_IDS.every(id=>integer(b.powerUses[id]))&&b.enemySpirituality===120-THUNDER_GOD_POWERS.reduce((n,p)=>n+p.cost*b.powerUses[p.id],0)&&b.powerUses.LIGHTNING<=4&&integer(b.totalOwnerMindSpent)&&integer(b.guidedThunderAttempts)&&integer(b.stormBraceAttempts)&&integer(b.guidedThunderChecks,0,b.guidedThunderAttempts)&&integer(b.stormBraceChecks,0,b.stormBraceAttempts)&&integer(b.guidedThunderSuccesses,0,b.guidedThunderChecks)&&integer(b.stormBraceSuccesses,0,b.stormBraceChecks)&&b.totalOwnerMindSpent===2*(b.guidedThunderAttempts+b.stormBraceAttempts)&&integer(b.screenReveals,0,b.powerUses.OBSCURE)&&!!b.inheritedApplications&&typeof b.inheritedApplications==='object'&&!Array.isArray(b.inheritedApplications)&&Object.entries(b.inheritedApplications).every(([id,n])=>THUNDER_GOD_INHERITED_POWERS.some(p=>p.id===id)&&integer(n,1))&&Array.isArray(b.observations)&&b.observations.every((o,i)=>shape(o,['power','conditionVersion','round','order','atSeconds','paidCost'])&&['LIGHTNING','WIND_WARD'].includes(o.power)&&integer(o.conditionVersion,1,b.powerUses.OBSCURE+b.screenReveals+1)&&integer(o.round,1)&&integer(o.order,0,11)&&integer(o.atSeconds,4)&&o.paidCost===(o.power==='LIGHTNING'?7:6)&&(i===0||b.observations[i-1]!.atSeconds<o.atSeconds))&&b.observations.filter(o=>o.power==='LIGHTNING').length<=b.powerUses.LIGHTNING&&b.observations.filter(o=>o.power==='WIND_WARD').length<=b.powerUses.WIND_WARD;
}
export function validThunderGodInjuries(injuries:SliceInjury[],revision:number):boolean{return Array.isArray(injuries)&&new Set(injuries.map(i=>i.id)).size===injuries.length&&injuries.every(i=>shape(i,['id','severity','acquiredRevision','treatedRevision'])&&typeof i.id==='string'&&!!i.id&&['LIGHT','HEAVY'].includes(i.severity)&&integer(i.acquiredRevision,0,revision)&&(i.treatedRevision===null||integer(i.treatedRevision,i.acquiredRevision,revision)));}
const SOURCE_KEYS=['runId','revision','week','date','round','encounterId','targetId','attemptWeek','startHistoryIndex','targetName','targetAge','targetSequence','targetCore','actualBody','independentMind','playerBodyId','enemyWeapon','weaponOwner','ordinaryExit','pursuit','thirdPartiesInArea','policy','clubHeld','playerHealth','playerMind','playerSpirituality','playerInjuries','playerRisk','physique','perception','will','knowledge','mastery','preparation','root','materials','body','randomSeed','randomCursor'];
export function validThunderGodCombatSource(x:ThunderGodCombatSource):boolean {
 try{const p=x.root,prep=x.preparation,b=x.body;
 return shape(x,SOURCE_KEYS)&&shape(b,Object.keys(initialThunderGodBody()))&&validateThunderGodPreparation(prep)&&typeof x.runId==='string'&&!!x.runId&&integer(x.revision)&&x.week===prep.week&&isValidGameDate(x.date)&&same(x.date,prep.date)&&integer(x.round,1)&&integer(x.startHistoryIndex)&&x.attemptWeek===x.week&&x.encounterId==='THUNDER_GOD_DISPUTE'&&x.targetId===THUNDER_GOD_TARGET_ID&&x.targetName==='欧伦·盖奇'&&x.targetAge===48&&x.targetSequence===1&&x.targetCore===24&&x.actualBody===true&&x.independentMind===true&&x.playerBodyId===`${x.runId}:body`&&x.enemyWeapon==='TG1-OREN-ROD'&&x.weaponOwner===THUNDER_GOD_TARGET_ID&&x.ordinaryExit==='OPEN'&&x.pursuit===false&&x.thirdPartiesInArea===0&&THUNDER_GOD_POLICIES.includes(x.policy)&&x.clubHeld===prep.playerClubHeld&&
 [x.playerHealth,x.playerMind].every(n=>integer(n,1,100))&&integer(x.playerSpirituality,0,120)&&[x.physique,x.perception,x.will,x.knowledge].every(n=>integer(n,0,500))&&same({physique:x.physique,perception:x.perception,will:x.will,knowledge:x.knowledge},prep.after.coreStats)&&shape(x.mastery,[...THUNDER_GOD_INHERITED_SKILL_IDS,...THUNDER_GOD_NEW_ABILITY_IDS])&&Object.values(x.mastery).every(n=>integer(n,0,500))&&same(Object.keys(x.mastery).sort(),Object.keys(prep.after.mastery).sort())&&THUNDER_GOD_INHERITED_SKILL_IDS.every(id=>x.mastery[id]===Math.min(500,prep.after.mastery[id]!+8*(b.inheritedApplications[id]??0)))&&x.mastery[GUIDED_THUNDER]===Math.min(500,prep.after.mastery[GUIDED_THUNDER]!+8*b.guidedThunderSuccesses)&&x.mastery[STORM_BRACE]===Math.min(500,prep.after.mastery[STORM_BRACE]!+8*b.stormBraceSuccesses)&&
 integer(x.playerRisk)&&validThunderGodInjuries(x.playerInjuries,x.revision)&&validThunderGodInjuries(b.enemyInjuries,x.revision)&&validThunderGodMaterials(x.materials)&&x.materials.weapon.location===b.weaponLocation&&x.materials.weapon.charge===4-b.powerUses.LIGHTNING&&x.materials.screen.operations===b.powerUses.OBSCURE+b.screenReveals&&x.materials.screen.hood===(b.powerUses.OBSCURE===b.screenReveals?'OPEN':'CLOSED')&&b.powerUses.OBSCURE-b.screenReveals<=1&&p.visibleBodyLine===(x.materials.screen.hood==='OPEN')&&b.guidedThunderAttempts<=x.round-1&&b.stormBraceAttempts<=x.round-1&&b.powerUses.OBSCURE<=x.round-1&&
 validThunderGodScene(p)&&p.siteId===THUNDER_GOD_SITE&&p.playerLocation==='PLATFORM'&&p.observedSourceId===`${x.runId}:TG1-PLATFORM:${prep.revision}`&&p.observationWeek===prep.week&&p.knownPlayerName===prep.playerName&&p.knownEnemyName==='欧伦·盖奇'&&p.clockSeconds===4+60*(x.round-1)&&p.conditionVersion===1+b.powerUses.OBSCURE+b.screenReveals&&validThunderGodBody(b)&&b.enemyStatus==='RESISTING'&&b.enemyMind>0&&typeof x.randomSeed==='string'&&!!x.randomSeed&&x.randomSeed.length<=256&&integer(x.randomCursor)&&prep.runId===x.runId&&prep.randomSeed===x.randomSeed&&prep.randomCursor<=x.randomCursor&&prep.revision<=x.revision-x.round&&b.observations.every(o=>o.round<x.round&&o.atSeconds<p.clockSeconds);
 }catch{return false;}
}
export const validateThunderGodCombatSource=validThunderGodCombatSource;

/** Shared actual consequence resolver, exposed for declared isolated BODY/MENTAL
 * tests without seeking or replacing any campaign seed/cursor. */
export function resolveThunderGodConsequences(x:ThunderGodCombatSource,r:ThunderGodRuntime,players:ThunderGodActionEvidence[],enemies:ThunderGodActionEvidence[],winner:'PLAYER'|'ENEMY',retreat:SliceCombatRound['retreat'],rng:ActionRandomStream) {
  const b=r.body;
  let playerHealth = r.playerH, playerRisk = x.playerRisk, outcome: ThunderGodResolution = retreat === 'SUCCESS' ? 'RETREATED' : b.enemyMind === 0 ? 'ENEMY_SURRENDERED' : 'CONTINUE';
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
export function replayThunderGodCombatRound(x: ThunderGodCombatSource, stance: SliceStance): { round: SliceCombatRound; outcome: ThunderGodResolution } {
  if (!validThunderGodCombatSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new Error('缺少真实原来源。');
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = createThunderGodRuntime(x), b = r.body;
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = thunderGodActionCount(playerCountRoll), enemyCount = thunderGodEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: ThunderGodActionEvidence[] = [], enemies: ThunderGodActionEvidence[] = [], remaining = { PLAYER: playerCount, ENEMY: enemyCount }; let retreat: SliceCombatRound['retreat'] = 'NONE';
  if (b.enemyMind === 0) remaining.PLAYER = remaining.ENEMY = 0;
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) for (const actor of order) {
    if (!remaining[actor]) continue;
    if (actor === 'PLAYER' && stance === 'RETREAT') {
      const action=baseAction(r,'PLAYER','RETREAT',players.length+enemies.length,rng);
      remaining.PLAYER=0;retreat=r.root.ordinaryExit==='OPEN'&&r.root.playerLocation==='PLATFORM'&&r.root.playerCoordinate===4?'SUCCESS':'FAILURE';
      action.succeeded=retreat==='SUCCESS';action.label=action.succeeded?'实际开放的普通退路可达，停止抵抗后沿四米原路离场。':'实际退路受阻，不能凭意愿瞬移离场。';players.push(closeAction(action,r,rng));
      if(retreat==='SUCCESS'){remaining.ENEMY=0;break;}continue;
    }
    if (remaining.ENEMY > 0 && !r.pendingEnemyAction) declareThunderGodEnemyAction(x, r, drawThunderGodEnemyAbility(rng), enemies.length);
    remaining[actor]--; const index = players.length + enemies.length;
    if (actor === 'PLAYER') players.push(resolveThunderGodPlayerSlot(x, r, drawThunderGodAbility(rng, null, stance), index, rng));
    else enemies.push(resolveThunderGodEnemySlot(x, r, r.pendingEnemyAction!.planned, index, rng));
    if (b.enemyMind === 0) { b.enemyStatus = 'SURRENDERED'; remaining.PLAYER = remaining.ENEMY = 0; break; }
  }
  const sum = (a: ThunderGodActionEvidence[], key: 'selfGain' | 'enemyReduction') => a.reduce((n, v) => n + v[key], 0);
  const core = x.physique * .35 + x.perception * .25 + x.will * .25 + x.knowledge * .15;
  const playerAdvantage = Math.max(125, base(core, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, base(x.targetCore, x.body.enemyHealth, x.body.enemyMind, x.body.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction'));
  const winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100, winner = retreat === 'SUCCESS' ? 'ENEMY' : b.enemyMind === 0 ? 'PLAYER' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  const {playerHealth,playerRisk,outcome,playerInjuries,consequenceWeights,consequenceRoll,consequenceDomain}=resolveThunderGodConsequences(x,r,players,enemies,winner,retreat,rng);
  advanceThunderGodCombatClock(r, x.root.clockSeconds + 60 - r.root.clockSeconds);
  for (const key of ['guidedThunder','stormBrace'] as const) { if (r.windows[key]) r.expiredWindows.push(structuredClone(r.windows[key]!)); r.windows[key] = null; }
  r.pendingEnemyAction = null; if (b.enemyStatus !== 'RESISTING') r.materials.weapon.location = 'PLATFORM'; b.weaponLocation = r.materials.weapon.location;
  const o: ThunderGodRoundOutcome = { ...structuredClone(b), targetId: THUNDER_GOD_TARGET_ID, round: x.round, source: structuredClone(x), stance, continuing: outcome === 'CONTINUE',
    playerHealthAfter: playerHealth, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, playerInjuriesAfter: playerInjuries, playerRiskAfter: playerRisk, materialsAfter: structuredClone(r.materials), masteryAfter: { ...r.mastery },
    rootAfter: structuredClone(r.root), elapsedSeconds: 60, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies, expiredWindows: r.expiredWindows,
    windowsAfter: structuredClone(r.windows), pendingEnemyActionAfter: null };
  const round: SliceCombatRound = { round: x.round, stance, first, playerCount, enemyCount, playerCountRoll, enemyCountRoll,
    moves: [...players, ...enemies].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })),
    playerAdvantage, enemyAdvantage, winChance, winner, consequence: '', consequenceWeights, retreat, ...(consequenceDomain === undefined ? {} : { consequenceDomain }), ...(consequenceRoll === undefined ? {} : { consequenceRoll }), thunderGodOutcome: o };
  round.consequence = thunderGodCombatConsequence(round); return { round, outcome };
}
export function validateThunderGodRoundOutcome(v: unknown): v is ThunderGodRoundOutcome { try { const o = v as ThunderGodRoundOutcome; return !!o && same(o, replayThunderGodCombatRound(o.source, o.stance).round.thunderGodOutcome); } catch { return false; } }
export function validateThunderGodCombatRound(round: SliceCombatRound): boolean { try { const o = round.thunderGodOutcome; return !!o && same(round, replayThunderGodCombatRound(o.source, o.stance).round); } catch { return false; } }
export function nextThunderGodCombatSource(o: ThunderGodRoundOutcome): ThunderGodCombatSource {
  return { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter,
    playerSpirituality: Math.min(120, o.playerSpiritualityAfter + 12), playerInjuries: structuredClone(o.playerInjuriesAfter), playerRisk: o.playerRiskAfter,
    root: structuredClone(o.rootAfter), body: combatBody(o), materials: structuredClone(o.materialsAfter), mastery: { ...o.masteryAfter }, randomCursor: o.randomCursorAfter };
}
export function thunderGodCombatConsequence(round: SliceCombatRound): string {
  const o = round.thunderGodOutcome!, who = round.winner === 'PLAYER' ? '欧伦' : '你';
  let text = round.retreat === 'SUCCESS' ? '撤离判定成功，将沿普通4米出口实际离开。' : round.consequenceDomain === 'MENTAL' ? `${who}承受实际精神压力，精神减少10，没有新增身体伤口或身体风险。` : round.consequenceDomain === 'BODY' ? `${who}承受实际物理攻击，按共同伤势盘结算，实掷${round.consequenceRoll}/100（轻${round.consequenceWeights!.light}/重${round.consequenceWeights!.heavy}/死亡${round.consequenceWeights!.death}）。` : '本轮没有实际致伤来源，不掷身体伤势盘、不增加身体风险。';
  const attacks = round.winner === 'PLAYER' ? o.playerActions : o.enemyActions;
  if (round.consequenceDomain) text += ` 实际${round.consequenceDomain === 'BODY' ? '身体' : '精神'}来源：${attacks.filter(a => round.consequenceDomain === 'BODY' ? a.threatens : a.mentalPressure).map(a => a.selectedAbility).join('、')}。`;
  text += ` 本人健康${o.source.playerHealth}→${o.playerHealthAfter}、精神${o.source.playerMind}→${o.playerMindAfter}；欧伦健康${o.source.body.enemyHealth}→${o.enemyHealth}、精神${o.source.body.enemyMind}→${o.enemyMind}。`;
  if (o.playerHealthAfter > 0 && o.playerMindAfter === 0) text += '本人精神耗尽，仍活着，停止抵抗后沿普通出口离开。';
  if (o.playerHealthAfter === 0) text += '本人的原身体真实死亡，本周目终结。'; else if (o.enemyHealth === 0) text += '欧伦原身体真实死亡，唯一原杆留地。'; else if (o.enemyStatus === 'SURRENDERED') text += '欧伦因实际伤势或精神耗尽自主停止抵抗，仍活着，原杆放在地面。';
  return text + ' 本轮实际60秒；未使用窗口到时结束，已经花费的灵性与精神不退。原杆与原罩资源保留，诺拉、芬恩与旧遭遇人物均不在场；原海湾水闸与全部旧对象不变。';
}


/** Player-visible resolved facts. Original preparation/random authority stays private. */
function thunderFacts<T,K extends keyof T>(value:T, keys:readonly K[]):Pick<T,K>{
 return Object.fromEntries(keys.map(key=>[key,structuredClone(value[key])])) as Pick<T,K>;
}
export function projectThunderGodAction(a:ThunderGodActionEvidence){
 return thunderFacts(a,['order','actor','id','planned','selectedAbility','fallbackReason','label','selfGain','enemyReduction','threatens','mentalPressure','attackKind','rawContribution','rawReduction','paidCost','mindCost','physicalFactor','check','resistanceRoll','resistanceChance','succeeded','finiteResult','windowsBefore','windowsAfter','pendingBefore','pendingAfter','masteryApplied','countered','rodChargeSpent','materialsBefore','materialsAfter','conditionVersionBefore','conditionVersionAfter','atSeconds','elapsedSeconds','travelMetres','travelPath','lateralTravelPath','playerMindAfter','playerSpiritualityAfter','enemyMindAfter','enemySpiritualityAfter'] as const);
}
export function projectThunderGodRoundOutcome(o:ThunderGodRoundOutcome){
 return {...thunderFacts(o,['targetId','round','stance','continuing','enemyHealth','enemyMind','enemySpirituality','enemyStatus','enemyInjuries','enemyRisk','weaponLocation','powerUses','observations','inheritedApplications','screenReveals','totalOwnerMindSpent','guidedThunderAttempts','guidedThunderChecks','guidedThunderSuccesses','stormBraceAttempts','stormBraceChecks','stormBraceSuccesses','playerHealthAfter','playerMindAfter','playerSpiritualityAfter','playerInjuriesAfter','playerRiskAfter','materialsAfter','masteryAfter','rootAfter','elapsedSeconds','expiredWindows','windowsAfter','pendingEnemyActionAfter'] as const),playerActions:o.playerActions.map(projectThunderGodAction),enemyActions:o.enemyActions.map(projectThunderGodAction)};
}
export type ThunderGodPublicRoundOutcome=ReturnType<typeof projectThunderGodRoundOutcome>;

export function projectThunderGodCombat(s:SliceState){
 const e=s.thunderGod.encounter,last=s.combat?.encounterId==='THUNDER_GOD_DISPUTE'?s.combat.lastRound?.thunderGodOutcome:e.terminal?s.combatHistory[e.terminal.historyIndex]?.thunderGodOutcome:null;
 return{enemyName:'欧伦·盖奇（48岁）',targetId:e.targetId,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,weaponLocation:e.weaponLocation,powerUses:{...e.powerUses},policy:e.policy,scene:structuredClone(e.scene),materials:structuredClone(e.materials),lastActionSequence:last?[...last.playerActions,...last.enemyActions].sort((a,b)=>a.order-b.order).map(projectThunderGodAction):[],constants:THUNDER_GOD_COMBAT_CONSTANTS,countWheel:THUNDER_GOD_COUNT_WHEEL,enemyCountWheel:THUNDER_GOD_ENEMY_COUNT_WHEEL,abilityWheel:thunderGodAbilityWheel(s,null),enemyAbilityWheel:THUNDER_GOD_ENEMY_ABILITY_WHEEL,facts:[
 '体35%、感25%、意25%、知15%；双方1至6动作10/15/25/25/15/10，基础1250、底125、上限120，仅继续轮恢复12。',
 '雷势引导只辅助下一实际威胁攻击30；风雷护持只削弱下一已声明可见身体冲击30，精神压力单独结算。',
 '每轮各一次，失败照付；条件改变、视线遮挡、离场或满30秒使旧窗口失效，空窗口不涨掌握。',
 '敌人原杆仅四次雷击；风护6灵性、海歌7灵性、遮挡3灵性，无敌人回复；旧海水与原场装置不在干平台。',
 '每个实际槽5秒、每轮60秒；身体攻击走共同伤势盘，精神耗尽活着停战，身体死亡终结本周目。']};
}
