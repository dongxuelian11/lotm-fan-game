import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import { CALAMITY_DEMONESS_COUNT_WHEEL, calamityDemonessActionCount } from '../calamity-demoness/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { APOCALYPSE_DEMONESS_TARGET_ID, APOCALYPSE_DEMONESS_SITE, APOCALYPSE_DEMONESS_POWER_IDS, APOCALYPSE_DEMONESS_POWERS, APOCALYPSE_DEMONESS_POLICIES,
 combatBody, initialApocalypseDemonessBody, hasApocalypseDemonessDisputeOpponent, validateApocalypseDemonessPreparation, validApocalypseDemonessMaterials, validApocalypseDemonessScene,
 apocalypseDemonessOriginalSnapshot, validApocalypseDemonessCombatOriginals, apocalypseDemonessPlayerWeapon,
 type ApocalypseDemonessCombatBody, type ApocalypseDemonessEnemyIntent, type ApocalypseDemonessPreparation, type ApocalypseDemonessMaterials, type ApocalypseDemonessScene, type ApocalypseDemonessPolicy, type ApocalypseDemonessCombatOriginals, type ApocalypseDemonessPendingSource } from './encounter.js';

/** The actual demoness action distribution and core weights are retained. These
 * two short personal techniques do not confer immunity or protect other people. */
export const APOCALYPSE_DEMONESS_COUNT_WHEEL=CALAMITY_DEMONESS_COUNT_WHEEL;
export const APOCALYPSE_DEMONESS_ENEMY_COUNT_WHEEL=CALAMITY_DEMONESS_COUNT_WHEEL;
export const apocalypseDemonessActionCount=calamityDemonessActionCount;
export const apocalypseDemonessEnemyActionCount=calamityDemonessActionCount;
export const APOCALYPSE_DEMONESS_COMBAT_CONSTANTS={weights:{physique:.25,perception:.30,will:.30,knowledge:.15},tier:1250,floor:125,maxSpirituality:120,continuingRecovery:12,enemyPhysique:24,pulseContainmentCost:8,pulseContainmentMindCost:2,pulseContainmentAid:30,mirrorBufferCost:8,mirrorBufferMindCost:2,mirrorBufferReduction:30,plateWear:5,windowSeconds:20,slotSeconds:5,enemyChargeSeconds:15} as const;
export const PULSE_CONTAINMENT='assassin.s1.pulse-containment',MIRROR_BUFFER='assassin.s1.mirror-buffer';
export const APOCALYPSE_DEMONESS_NEW_ABILITY_IDS=[PULSE_CONTAINMENT,MIRROR_BUFFER] as const;
export const APOCALYPSE_DEMONESS_INHERITED_SKILL_IDS=['assassin.s9.lightness','assassin.s9.vision','assassin.s9.shadow','assassin.s9.burst','assassin.s8.instigation','assassin.s7.black-flame','assassin.s7.frost','assassin.s7.invisibility','assassin.s7.substitute','assassin.s7.divination-interference','assassin.s7.black-magic','assassin.s6.silk-binding','assassin.s6.charm','assassin.s5.disease','assassin.s4.plague','assassin.s3.mirror-passage','assassin.s2.mirror-screen','assassin.s2.black-flame-channel'] as const;
const SCREEN='assassin.s2.mirror-screen',FLAME='assassin.s2.black-flame-channel',FROST='assassin.s7.frost';
export type ApocalypseDemonessMoveId=typeof APOCALYPSE_DEMONESS_INHERITED_SKILL_IDS[number]|typeof APOCALYPSE_DEMONESS_NEW_ABILITY_IDS[number]|'STRIKE'|'EVADE'|'OBSERVE'|'ACCIDENT';
/** Old raw tickets stay 25/20/20/15/15/5. Two new skills add 14 each;
 * all eighteen historic mastery values remain exact until real application. */
export const APOCALYPSE_DEMONESS_ABILITIES:readonly{id:ApocalypseDemonessMoveId;label:string;weight:number;stance:SliceStance|null}[]=[
 {id:SCREEN,label:'镜幕缓冲：6灵性、知识20，成功准备实耗新战斗镜片1次，下一身体攻击减势45',weight:25,stance:'DEFEND'},
 {id:FLAME,label:'黑焰导引：6灵性、知识20，一次有限攻势85，受本人身体状态影响',weight:20,stance:'ATTACK'},
 {id:FROST,label:'继承冰霜：6灵性、知识18，沿用真实旧掌握，有限减势35',weight:20,stance:'CONTROL'},
 {id:'STRIKE',label:'普通打击：实际持棍16或徒手12，走近后返回普通出口点',weight:15,stance:'ATTACK'},
 {id:'EVADE',label:'普通避让：实际侧步再返回，重新观察当前条件，减势10',weight:15,stance:'DEFEND'},
 {id:'ACCIDENT',label:'判断失误：−22.5',weight:5,stance:null},
 {id:PULSE_CONTAINMENT,label:'脉冲收束：8灵性2精神、知识18，借实际未释放印记辅助下一普通打击30',weight:14,stance:'CONTROL'},
 {id:MIRROR_BUFFER,label:'镜面缓冲：8灵性2精神、意志18，下一可见身体冲击减势30并实耗新片1次、磨损5',weight:14,stance:'DEFEND'},
];
export const APOCALYPSE_DEMONESS_PLAYER_ABILITIES=APOCALYPSE_DEMONESS_ABILITIES;
export const APOCALYPSE_DEMONESS_ENEMY_ABILITY_WHEEL:readonly SliceWheelEntry[]=[
 {id:'BODY_MARK',label:'身体印记：7灵性与1枚；蓄势15秒后占后续原槽释放75，声明槽贡献0',weight:30},
 {id:'MENTAL_MARK',label:'精神印记：7灵性与1枚；蓄势15秒后占后续原槽释放65，声明槽贡献0',weight:25},
 {id:'BODY_STRIKE',label:'自有原棍普通打击20×身体状态',weight:25},
 {id:'FEINT',label:'侧移一米并横棍遮挡：3灵性、每轮一次，打断可见条件',weight:15},
 {id:'ACCIDENT',label:'判断偏差−22.5',weight:5},
];
export const isApocalypseDemoness=(s:SliceState)=>s.progression.pathwayId==='demoness'&&s.progression.sequence===1;
const tickets=(stance:SliceStance|null)=>APOCALYPSE_DEMONESS_ABILITIES.map(a=>a.weight*(a.stance===stance&&stance!==null?5:4));
export function apocalypseDemonessAbilityWheel(_s:SliceState,stance:SliceStance|null):SliceWheelEntry[]{const w=tickets(stance),total=w.reduce((n,v)=>n+v,0);return APOCALYPSE_DEMONESS_ABILITIES.map((a,i)=>({id:a.id,label:stance==='DEFEND'&&(a.id==='STRIKE'||a.id===FLAME)?'整轮防守，此槽不发动攻击':a.label,weight:w[i]!/total*100}));}
export function drawApocalypseDemonessAbility(rng:ActionRandomStream,_s:SliceState|null,stance:SliceStance|null):ApocalypseDemonessMoveId{const w=tickets(stance);let n=rng.nextInt(1,w.reduce((a,b)=>a+b,0));for(const[i,a]of APOCALYPSE_DEMONESS_ABILITIES.entries()){n-=w[i]!;if(n<=0)return a.id;}throw new Error('行动盘无效。');}
export function drawApocalypseDemonessEnemyAbility(rng:ActionRandomStream):ApocalypseDemonessEnemyIntent{let n=rng.nextInt(1,100);for(const a of APOCALYPSE_DEMONESS_ENEMY_ABILITY_WHEEL){n-=a.weight;if(n<=0)return a.id as ApocalypseDemonessEnemyIntent;}throw new Error('对手行动盘无效。');}
const same=(a:unknown,b:unknown)=>a===b||(a!==undefined&&b!==undefined&&stableStringify(a)===stableStringify(b));
const integer=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER):n is number=>Number.isSafeInteger(n)&&(n as number)>=min&&(n as number)<=max;
const shape=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...keys].sort());
const physicalAt=(n:number)=>n>75?1:n>50?.95:n>25?.9:.8;
export interface ApocalypseDemonessCombatSource {
 runId:string;revision:number;week:number;date:PublicGameDate;round:number;maxActionCount:6;encounterId:'APOCALYPSE_DEMONESS_DISPUTE';targetId:typeof APOCALYPSE_DEMONESS_TARGET_ID;
 attemptWeek:number;startHistoryIndex:number;targetName:'莱奥娜·布莱克';targetAge:43;targetSequence:1;targetCore:24;actualBody:true;independentMind:true;playerBodyId:string;
 enemyWeapon:'AD1-LEONA-CLUB';weaponOwner:typeof APOCALYPSE_DEMONESS_TARGET_ID;ordinaryExit:'OPEN';pursuit:false;thirdPartiesInArea:0;policy:ApocalypseDemonessPolicy;clubHeld:boolean;playerWeaponId:'town-short-club'|null;
 playerHealth:number;playerMind:number;playerSpirituality:number;playerInjuries:SliceInjury[];playerRisk:number;physique:number;perception:number;will:number;knowledge:number;mastery:Record<string,number>;
 preparation:ApocalypseDemonessPreparation;root:ApocalypseDemonessScene;materials:ApocalypseDemonessMaterials;originals:ApocalypseDemonessCombatOriginals;body:ApocalypseDemonessCombatBody;randomSeed:string;randomCursor:number;
}
export function currentApocalypseDemonessCombatSource(s:SliceState):ApocalypseDemonessCombatSource|null {
 if(!hasApocalypseDemonessDisputeOpponent(s))return null;const e=s.apocalypseDemoness.encounter,c=s.combat!,weapon=apocalypseDemonessPlayerWeapon(s);
 return{runId:s.runId,revision:s.revision,week:s.week,date:{...s.date},round:c.round,maxActionCount:6,encounterId:'APOCALYPSE_DEMONESS_DISPUTE',targetId:APOCALYPSE_DEMONESS_TARGET_ID,attemptWeek:e.attemptWeek!,startHistoryIndex:e.startHistoryIndex!,targetName:'莱奥娜·布莱克',targetAge:43,targetSequence:1,targetCore:24,actualBody:true,independentMind:true,playerBodyId:`${s.runId}:body`,enemyWeapon:'AD1-LEONA-CLUB',weaponOwner:APOCALYPSE_DEMONESS_TARGET_ID,ordinaryExit:'OPEN',pursuit:false,thirdPartiesInArea:0,policy:e.policy,clubHeld:weapon!==null,playerWeaponId:weapon,playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,playerInjuries:structuredClone(s.injuries),playerRisk:s.injuryRisk,...s.character.coreStats,mastery:{...s.progression.mastery},preparation:structuredClone(e.preparation!),root:structuredClone(e.scene),materials:structuredClone(e.materials),originals:apocalypseDemonessOriginalSnapshot(s),body:combatBody(e),randomSeed:s.random.seed,randomCursor:s.random.cursor};
}
export interface ApocalypseDemonessWindow {id:string;kind:'PULSE_CONTAINMENT'|'MIRROR_BUFFER'|'MIRROR_SCREEN';createdAt:number;expiresAt:number;openedOrder:number;conditionVersion:number;targetId:string;enemyCoordinate:6|7;playerCoordinate:4;magnitude:30|45}
export interface ApocalypseDemonessWindows {pulseContainment:ApocalypseDemonessWindow|null;mirrorBuffer:ApocalypseDemonessWindow|null;mirrorScreen:ApocalypseDemonessWindow|null}
export interface ApocalypseDemonessActionEvidence {
 order:number;actor:'PLAYER'|'ENEMY';id:string;planned:string;selectedAbility:string;fallbackReason:string|null;label:string;selfGain:number;enemyReduction:number;threatens:boolean;mentalPressure:boolean;attackKind:'NONE'|'BODY'|'MENTAL';rawContribution:number;rawReduction:number;
 paidCost:number;mindCost:number;healthPaid:number;energyPaid:number;plateWear:number;physicalFactor:number;check:PublicCheckResult|null;resistanceRoll:null;resistanceChance:null;succeeded:boolean;
 finiteResult:'NONE'|'UNAVAILABLE'|'ALREADY_ATTEMPTED'|'INSUFFICIENT'|'FAILED'|'PENDING'|'APPLIED';windowsBefore:ApocalypseDemonessWindows;windowsAfter:ApocalypseDemonessWindows;masteryApplied:string[];countered:string[];appliedWindowId:string|null;
 pendingSourceBefore:ApocalypseDemonessPendingSource|null;pendingSourceAfter:ApocalypseDemonessPendingSource|null;consumedMarkId:string|null;declaredSourceId:string|null;releasedSourceId:string|null;plateChargeSpent:0|1;materialsBefore:ApocalypseDemonessMaterials;materialsAfter:ApocalypseDemonessMaterials;originalsBefore:ApocalypseDemonessCombatOriginals;originalsAfter:ApocalypseDemonessCombatOriginals;
 conditionVersionBefore:number;conditionVersionAfter:number;atSeconds:number;completedAtSeconds:number;elapsedSeconds:5;travelMetres:number;travelPath:number[];lateralTravelPath:number[];randomCursorBefore:number;randomCursorAfter:number;playerHealthAfter:number;playerMindAfter:number;playerSpiritualityAfter:number;enemyMindAfter:number;enemySpiritualityAfter:number;
}
export interface ApocalypseDemonessRuntime {body:ApocalypseDemonessCombatBody;root:ApocalypseDemonessScene;materials:ApocalypseDemonessMaterials;originals:ApocalypseDemonessCombatOriginals;playerH:number;playerM:number;playerS:number;mastery:Record<string,number>;windows:ApocalypseDemonessWindows;expiredWindows:ApocalypseDemonessWindow[];pulseContainmentAttempted:boolean;mirrorBufferAttempted:boolean;mirrorScreenAttempted:boolean;blackFlameAttempted:boolean;feintUsed:boolean}
export function createApocalypseDemonessRuntime(x:ApocalypseDemonessCombatSource):ApocalypseDemonessRuntime{return{body:structuredClone(x.body),root:structuredClone(x.root),materials:structuredClone(x.materials),originals:structuredClone(x.originals),playerH:x.playerHealth,playerM:x.playerMind,playerS:x.playerSpirituality,mastery:{...x.mastery},windows:{pulseContainment:null,mirrorBuffer:null,mirrorScreen:null},expiredWindows:[],pulseContainmentAttempted:false,mirrorBufferAttempted:false,mirrorScreenAttempted:false,blackFlameAttempted:false,feintUsed:false};}
const active=(r:ApocalypseDemonessRuntime)=>r.root.playerLocation==='YARD'&&r.root.playerCoordinate===4&&r.body.enemyStatus==='RESISTING'&&r.body.enemyHealth>0&&r.body.enemyMind>0&&r.playerH>0&&r.playerM>0;
const observed=(r:ApocalypseDemonessRuntime)=>active(r)&&r.root.visibleBodyLine&&r.root.observedConditionVersion===r.root.conditionVersion;
const keys=['pulseContainment','mirrorBuffer','mirrorScreen'] as const;
function invalidate(r:ApocalypseDemonessRuntime,key:keyof ApocalypseDemonessWindows):void{const w=r.windows[key];if(w)r.expiredWindows.push(structuredClone(w));r.windows[key]=null;}
const sameEndpoint=(r:ApocalypseDemonessRuntime,w:ApocalypseDemonessWindow)=>w.conditionVersion===r.root.conditionVersion&&w.enemyCoordinate===r.root.enemyCoordinate&&w.playerCoordinate===r.root.playerCoordinate;
export function advanceApocalypseDemonessCombatClock(r:ApocalypseDemonessRuntime,seconds:number):void {
 if(!integer(seconds))throw new Error('实际时间无效。');r.root.clockSeconds+=seconds;r.root.externalSeconds+=seconds;r.originals.site.clockSeconds+=seconds;
 for(const key of keys){const w=r.windows[key];if(w&&(w.expiresAt<=r.root.clockSeconds||!observed(r)||!sameEndpoint(r,w)))invalidate(r,key);}
}
function baseAction(r:ApocalypseDemonessRuntime,actor:'PLAYER'|'ENEMY',id:string,order:number,rng:ActionRandomStream):ApocalypseDemonessActionEvidence {
 advanceApocalypseDemonessCombatClock(r,0);return{order,actor,id,planned:id,selectedAbility:id,fallbackReason:null,label:'',selfGain:0,enemyReduction:0,threatens:false,mentalPressure:false,attackKind:'NONE',rawContribution:0,rawReduction:0,paidCost:0,mindCost:0,healthPaid:0,energyPaid:0,plateWear:0,physicalFactor:physicalAt(actor==='PLAYER'?r.playerH:r.body.enemyHealth),check:null,resistanceRoll:null,resistanceChance:null,succeeded:false,finiteResult:'NONE',windowsBefore:structuredClone(r.windows),windowsAfter:structuredClone(r.windows),masteryApplied:[],countered:[],appliedWindowId:null,pendingSourceBefore:structuredClone(r.body.pendingSource),pendingSourceAfter:structuredClone(r.body.pendingSource),consumedMarkId:null,declaredSourceId:null,releasedSourceId:null,plateChargeSpent:0,materialsBefore:structuredClone(r.materials),materialsAfter:structuredClone(r.materials),originalsBefore:structuredClone(r.originals),originalsAfter:structuredClone(r.originals),conditionVersionBefore:r.root.conditionVersion,conditionVersionAfter:r.root.conditionVersion,atSeconds:r.root.clockSeconds,completedAtSeconds:r.root.clockSeconds+5,elapsedSeconds:5,travelMetres:0,travelPath:[actor==='PLAYER'?r.root.playerCoordinate:r.root.enemyCoordinate],lateralTravelPath:[0],randomCursorBefore:rng.cursor,randomCursorAfter:rng.cursor,playerHealthAfter:r.playerH,playerMindAfter:r.playerM,playerSpiritualityAfter:r.playerS,enemyMindAfter:r.body.enemyMind,enemySpiritualityAfter:r.body.enemySpirituality};
}
function closeAction(a:ApocalypseDemonessActionEvidence,r:ApocalypseDemonessRuntime,rng:ActionRandomStream):ApocalypseDemonessActionEvidence{advanceApocalypseDemonessCombatClock(r,5);a.completedAtSeconds=r.root.clockSeconds;a.windowsAfter=structuredClone(r.windows);a.materialsAfter=structuredClone(r.materials);a.pendingSourceAfter=structuredClone(r.body.pendingSource);a.originalsAfter=structuredClone(r.originals);a.conditionVersionAfter=r.root.conditionVersion;a.randomCursorAfter=rng.cursor;a.playerHealthAfter=r.playerH;a.playerMindAfter=r.playerM;a.playerSpiritualityAfter=r.playerS;a.enemyMindAfter=r.body.enemyMind;a.enemySpiritualityAfter=r.body.enemySpirituality;a.threatens=a.attackKind==='BODY'&&a.selfGain>0;a.mentalPressure=a.attackKind==='MENTAL'&&a.selfGain>0;a.label+=` 实际5秒，本人灵性${r.playerS}、精神${r.playerM}，对手灵性${r.body.enemySpirituality}。`;return a;}
function walk(r:ApocalypseDemonessRuntime,a:ApocalypseDemonessActionEvidence,metres:number):boolean{if(r.originals.site.playerEnergy<metres+4)return false;r.originals.site.playerEnergy-=metres;r.originals.site.playerTravelMetres+=metres;r.root.playerTravelMetres+=metres;a.energyPaid+=metres;a.travelMetres+=metres;return true;}
function ordinary(x:ApocalypseDemonessCombatSource,r:ApocalypseDemonessRuntime,a:ApocalypseDemonessActionEvidence,why:string,attack=false){a.selectedAbility=attack?'STRIKE':'EVADE';a.fallbackReason=why||null;a.label=why;a.succeeded=true;if(attack&&walk(r,a,2*(r.root.enemyCoordinate-4))){replaceDefense(r,a);a.travelPath=[4,r.root.enemyCoordinate,4];a.selfGain=(x.clubHeld?16:12)*a.physicalFactor;a.attackKind='BODY';a.label+=`本人用${x.clubHeld?'实际握持的原棍':'原身体'}走近普通打击并返回，共${a.travelMetres}米。`;}else{a.selectedAbility='EVADE';a.enemyReduction=10;a.label+=attack?'保留普通返程4精力，本槽站稳防备，无攻击。':'普通防备，减势10。';}}
function pay(r:ApocalypseDemonessRuntime,a:ApocalypseDemonessActionEvidence,s:number,m=0){if(r.playerS<s||r.playerM<=m)return false;r.playerS-=s;r.playerM-=m;r.body.totalOwnerMindSpent+=m;a.paidCost=s;a.mindCost=m;return true;}
function check(x:ApocalypseDemonessCombatSource,a:ApocalypseDemonessActionEvidence,ability:'knowledge'|'will',difficulty:number,rng:ActionRandomStream){a.check=resolveNormalCheck({ability,baseAbility:x[ability],difficulty,modifiers:[],roll:rng.nextInt(1,100)});a.succeeded=['SUCCESS','GREAT_SUCCESS'].includes(a.check.tier);a.label+=`${ability==='will'?'意志':'知识'}检定${a.check.roll}，${a.succeeded?'成功':'失败'}。`;return a.succeeded;}
function gainMastery(r:ApocalypseDemonessRuntime,a:ApocalypseDemonessActionEvidence,id:string){r.mastery[id]=Math.min(500,(r.mastery[id]??0)+8);a.masteryApplied.push(id);}
const usablePlate=(r:ApocalypseDemonessRuntime)=>r.materials.plate!==null&&r.materials.plate.charges>0;
function window(x:ApocalypseDemonessCombatSource,r:ApocalypseDemonessRuntime,a:ApocalypseDemonessActionEvidence,kind:ApocalypseDemonessWindow['kind'],targetId:string,magnitude:30|45):ApocalypseDemonessWindow{return{id:`AD1-${kind}:${x.round}:${a.order}`,kind,createdAt:a.completedAtSeconds,expiresAt:a.completedAtSeconds+20,openedOrder:a.order,conditionVersion:r.root.conditionVersion,targetId,enemyCoordinate:r.root.enemyCoordinate,playerCoordinate:4,magnitude};}
const observedPending=(r:ApocalypseDemonessRuntime)=>observed(r)&&r.body.pendingSource!==null&&r.body.pendingSource.observed&&r.body.pendingSource.conditionVersion===r.root.conditionVersion&&!r.body.pendingSource.containmentUsed;
function replaceDefense(r:ApocalypseDemonessRuntime,a:ApocalypseDemonessActionEvidence):void{for(const key of ['mirrorBuffer','mirrorScreen'] as const){if(r.windows[key])a.countered.push(r.windows[key]!.id);invalidate(r,key);}}
export function resolveApocalypseDemonessPlayerSlot(x:ApocalypseDemonessCombatSource,r:ApocalypseDemonessRuntime,id:ApocalypseDemonessMoveId,order:number,rng:ActionRandomStream,stance:SliceStance='CONTROL'):ApocalypseDemonessActionEvidence {
 if(![...APOCALYPSE_DEMONESS_INHERITED_SKILL_IDS,...APOCALYPSE_DEMONESS_NEW_ABILITY_IDS,'STRIKE','EVADE','OBSERVE','ACCIDENT'].includes(id))throw new Error('未知本人动作。');const a=baseAction(r,'PLAYER',id,order,rng);
 if(!active(r)){a.finiteResult='UNAVAILABLE';a.label='本人或对手已离场、死亡或停止抵抗，没有新效果。';return closeAction(a,r,rng);}
 if(stance==='DEFEND'&&(id==='STRIKE'||id===FLAME)){a.finiteResult='UNAVAILABLE';a.selectedAbility='EVADE';a.label='整轮保持防守，此槽不打击、不施黑焰。';}
 else if(x.policy==='ORDINARY'&&id.startsWith('assassin.')){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'预先选择只作普通行动；');}
 else if(id===PULSE_CONTAINMENT||id===MIRROR_BUFFER){
  const pulse=id===PULSE_CONTAINMENT,key=pulse?'pulseContainment':'mirrorBuffer',attempted=pulse?r.pulseContainmentAttempted:r.mirrorBufferAttempted;
  const allowed=x.policy==='ALL'||x.policy===(pulse?'PULSE_CONTAINMENT':'MIRROR_BUFFER');
  if(!allowed){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'所选策略不允许此能力；');}
  else if(attempted){a.finiteResult='ALREADY_ATTEMPTED';ordinary(x,r,a,'本轮已经实付尝试一次；');}
  else if(!observed(r)||pulse&&!observedPending(r)||!pulse&&!usablePlate(r)){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,pulse?'没有已实际观察且尚未释放的同一印记来源；':'没有可见身体路线或新镜片已用尽；');}
  else if(!pay(r,a,8,2)){a.finiteResult='INSUFFICIENT';ordinary(x,r,a,'不足8灵性或不能支付2精神并保持清醒；');}
  else{if(pulse){r.pulseContainmentAttempted=true;r.body.pulseContainmentAttempts++;}else{r.mirrorBufferAttempted=true;r.body.mirrorBufferAttempts++;}a.label=pulse?'对已观察的实际未结印记脉冲尝试收束。':'只借本人实际持有的新战斗镜片准备缓冲。';
   if(!check(x,a,pulse?'knowledge':'will',18,rng))a.finiteResult='FAILED';
   else{if(pulse)r.body.pulseContainmentChecks++;else{r.body.mirrorBufferChecks++;replaceDefense(r,a);}r.windows[key]=window(x,r,a,pulse?'PULSE_CONTAINMENT':'MIRROR_BUFFER',pulse?r.body.pendingSource!.id:r.materials.plate!.id,30);a.finiteResult='PENDING';a.label+=pulse?'完成后20秒内，只有同一来源仍待释放时的下一次普通打击可用辅助30；不取消对方攻击，目前没有掌握奖励。':'完成后20秒内，只等下一次可见身体冲击；实际应用才耗新片一次、磨损5和增长掌握。';}
  }
 }else if(id==='STRIKE')ordinary(x,r,a,'',true);
 else if(id==='EVADE'||id==='OBSERVE'){
  ordinary(x,r,a,'');if(walk(r,a,2)){for(const key of keys)invalidate(r,key);a.lateralTravelPath=[0,1,0];r.root.visibleBodyLine=true;r.root.observedConditionVersion=r.root.conditionVersion;if(r.body.pendingSource){r.body.pendingSource.observed=true;r.body.pendingSource.conditionVersion=r.root.conditionVersion;}a.label+='实际侧步一米再返回，重新观察对手当前位置与真实未结来源。';}else a.label+='剩余精力只够普通离场，不侧步、不伪造观察。';
 }else if(id==='ACCIDENT'){a.selfGain=-22.5;a.label='判断失误，固定−22.5，不重抽。';}
 else if(id===SCREEN||id===FLAME||id===FROST){
  const repeated=id===SCREEN&&r.mirrorScreenAttempted||id===FLAME&&r.blackFlameAttempted;
  if(repeated){a.finiteResult='ALREADY_ATTEMPTED';ordinary(x,r,a,'本轮已经尝试旧能力；');}
  else if(!observed(r)||id===SCREEN&&!usablePlate(r)){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'原能力当前可见条件或实购新镜片不足；');}
  else if(!pay(r,a,6)){a.finiteResult='INSUFFICIENT';ordinary(x,r,a,'不足原能力6灵性；',id===FLAME);}
  else{if(id===SCREEN){r.mirrorScreenAttempted=true;r.body.mirrorScreenAttempts++;}if(id===FLAME){r.blackFlameAttempted=true;r.body.blackFlameAttempts++;}a.label='按原成本与真实掌握尝试已学能力。';
   if(!check(x,a,'knowledge',id===FROST?18:20,rng))a.finiteResult='FAILED';
   else if(id===SCREEN){replaceDefense(r,a);r.materials.plate!.charges--;r.body.mirrorScreenChecks++;a.plateChargeSpent=1;r.windows.mirrorScreen=window(x,r,a,'MIRROR_SCREEN',r.materials.plate!.id,45);a.finiteResult='PENDING';a.label+='成功准备实耗新片一次，下一实际身体冲击减势45；到期、替换、遮挡不退款，没有当槽掌握奖励。';}
   else if(id===FLAME){a.selfGain=85*a.physicalFactor;a.attackKind='BODY';a.finiteResult='APPLIED';r.body.inheritedSuccesses.blackFlame++;gainMastery(r,a,FLAME);a.label+='向眼前实际对手发出一次有限黑焰脉冲，85攻势受本人身体状态影响，仍由真实交锋判后果。';}
   else{a.enemyReduction=35*(.65+.35*x.mastery[FROST]!/500);a.finiteResult='APPLIED';r.body.inheritedSuccesses.frost++;gainMastery(r,a,FROST);a.label+='依真实原冰霜掌握形成有限减势，不删除对手动作或修复旧物。';}
  }
 }else{a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'本场没有这项旧能力的实际条件，不补发物件或掌握；');}
 a.rawContribution=a.selfGain;a.rawReduction=a.enemyReduction;
 const aid=r.windows.pulseContainment,pending=r.body.pendingSource;
 if(aid&&pending&&aid.openedOrder<order&&a.selectedAbility==='STRIKE'&&id==='STRIKE'&&a.selfGain>0&&a.completedAtSeconds<aid.expiresAt&&sameEndpoint(r,aid)&&observedPending(r)&&aid.targetId===pending.id){r.windows.pulseContainment=null;pending.containmentUsed=true;a.appliedWindowId=aid.id;a.selfGain+=30;r.body.pulseContainmentSuccesses++;gainMastery(r,a,PULSE_CONTAINMENT);a.finiteResult='APPLIED';a.label+='借同一真实待释放脉冲辅助这次普通打击30，来源只可借用一次；对手后续攻击仍会释放。';}
 return closeAction(a,r,rng);
}
export function resolveApocalypseDemonessEnemySlot(x:ApocalypseDemonessCombatSource,r:ApocalypseDemonessRuntime,planned:ApocalypseDemonessEnemyIntent,order:number,rng:ActionRandomStream):ApocalypseDemonessActionEvidence {
 const a=baseAction(r,'ENEMY',planned,order,rng);if(!active(r)){a.finiteResult='UNAVAILABLE';a.label='原人已离场、死亡或停战，停止新效果。';return closeAction(a,r,rng);}
 const pending=r.body.pendingSource;
 if(pending&&r.root.clockSeconds>=pending.readyAt){
  a.id=a.selectedAbility=pending.power;a.releasedSourceId=pending.id;a.attackKind=pending.power==='BODY_MARK'?'BODY':'MENTAL';a.selfGain=pending.power==='BODY_MARK'?75:65;a.succeeded=true;r.body.releasedSourceIds.push(pending.id);r.body.pendingSource=null;invalidate(r,'pulseContainment');a.label=`莱奥娜在这次原动作槽释放已付费蓄势的同一枚印记，${a.attackKind==='BODY'?'身体75':'精神65'}；声明槽没有提前贡献，本槽不再次付费或生成印记。`;
 }else{
  const power=APOCALYPSE_DEMONESS_POWERS.find(v=>v.id===planned),mark=planned==='BODY_MARK'||planned==='MENTAL_MARK';
  const actual:ApocalypseDemonessEnemyIntent=mark&&pending?'OBSERVE':power&&(r.body.enemySpirituality<power.cost||mark&&!r.materials.marks.some(m=>m.status==='HELD'))?'BODY_STRIKE':planned==='FEINT'&&r.feintUsed?'OBSERVE':planned;a.id=a.selectedAbility=actual;
  if(power&&actual===planned){r.body.enemySpirituality-=power.cost;r.body.powerUses[power.id]++;a.paidCost=power.cost;a.succeeded=true;
   if(mark){const token=r.materials.marks.find(m=>m.status==='HELD')!;token.status='SPENT';token.usedRound=x.round;a.consumedMarkId=token.id;const source:ApocalypseDemonessPendingSource={id:`${token.id}:PULSE`,markId:token.id,power:actual as 'BODY_MARK'|'MENTAL_MARK',declaredAt:r.root.clockSeconds,readyAt:r.root.clockSeconds+15,declaredRound:x.round,declaredOrder:order,observed:observed(r),conditionVersion:r.root.conditionVersion,containmentUsed:false};r.body.pendingSource=source;a.declaredSourceId=source.id;if(observed(r))r.body.observations.push({power:source.power,conditionVersion:r.root.conditionVersion,round:x.round,order,atSeconds:r.root.clockSeconds,paidCost:7});a.label='莱奥娜实付7灵性与一枚有限印记开始蓄势，15秒后由后续原动作槽释放；现在没有攻击贡献，不增加槽数。';}
   else{r.feintUsed=true;const from=r.root.enemyCoordinate;r.root.enemyCoordinate=from===6?7:6;r.root.enemyTravelMetres++;a.travelMetres=1;a.travelPath=[from,r.root.enemyCoordinate];r.root.conditionVersion++;r.root.visibleBodyLine=false;if(r.body.pendingSource)r.body.pendingSource.observed=false;for(const key of keys){if(r.windows[key])a.countered.push(r.windows[key]!.id);invalidate(r,key);}a.label='莱奥娜实付3灵性，侧移一米并横棍遮挡，未用窗口因真实移动失效。';}
  }else if(actual==='BODY_STRIKE'){const from=r.root.enemyCoordinate;a.selfGain=20*a.physicalFactor;a.attackKind='BODY';a.travelMetres=2*(from-4);a.travelPath=[from,4,from];r.root.enemyTravelMetres+=a.travelMetres;a.succeeded=true;a.label=`莱奥娜持唯一原棍实际走近打击并退回，共${a.travelMetres}米；资源不足不施法、不补发印记。`;}
  else if(actual==='ACCIDENT'){a.selfGain=-22.5;a.label='对手判断偏差，−22.5，不重抽。';}else a.label=pending?'真实蓄势尚未完成，在本次原槽观察，没有额外动作或提前攻击贡献。':'对手普通观察，没有新资源。';
 }
 a.rawContribution=a.selfGain;a.rawReduction=a.enemyReduction;
 if(a.attackKind==='BODY'&&a.selfGain>0&&observed(r)&&r.materials.plate){
  const key=r.windows.mirrorBuffer?'mirrorBuffer':r.windows.mirrorScreen?'mirrorScreen':null,w=key?r.windows[key]:null;
  if(key&&w&&w.openedOrder<order&&a.completedAtSeconds<w.expiresAt&&sameEndpoint(r,w)&&w.targetId===r.materials.plate.id&&(key==='mirrorScreen'||usablePlate(r))){r.windows[key]=null;a.appliedWindowId=w.id;a.selfGain=Math.max(0,a.selfGain-w.magnitude);a.plateWear=5;r.materials.plate.wear+=5;a.finiteResult='APPLIED';if(key==='mirrorBuffer'){r.materials.plate.charges--;a.plateChargeSpent=1;r.body.mirrorBufferSuccesses++;gainMastery(r,a,MIRROR_BUFFER);}else{r.body.inheritedSuccesses.mirrorScreen++;gainMastery(r,a,SCREEN);}a.label+=`这一次可见身体冲击实际减势${a.rawContribution-a.selfGain}，同一新镜片磨损5；仅一个待用防护生效，旧片与既有伤势不变。`;}
 }
 return closeAction(a,r,rng);
}
export interface ApocalypseDemonessRoundOutcome extends ApocalypseDemonessCombatBody {
 targetId:typeof APOCALYPSE_DEMONESS_TARGET_ID;round:number;source:ApocalypseDemonessCombatSource;stance:SliceStance;continuing:boolean;playerHealthAfter:number;playerMindAfter:number;playerSpiritualityAfter:number;playerInjuriesAfter:SliceInjury[];playerRiskAfter:number;materialsAfter:ApocalypseDemonessMaterials;originalsAfter:ApocalypseDemonessCombatOriginals;masteryAfter:Record<string,number>;rootAfter:ApocalypseDemonessScene;elapsedSeconds:60;randomCursorAfter:number;playerActions:ApocalypseDemonessActionEvidence[];enemyActions:ApocalypseDemonessActionEvidence[];expiredWindows:ApocalypseDemonessWindow[];windowsAfter:ApocalypseDemonessWindows;
}
export type ApocalypseDemonessResolution='CONTINUE'|'PLAYER_DEAD'|'ENEMY_DEAD'|'ENEMY_SURRENDERED'|'RETREATED';
function penalty(n:number,max:number){const f=n/max;return f>.75?0:f>.5?.05:f>.25?.1:.2;}
function base(core:number,h:number,m:number,s:number){return(1250+Math.min(core,250))*(1-Math.min(.4,penalty(h,100)+penalty(m,100)+penalty(s,120)));}
function weights(risk:number){const death=Math.min(100,5+Math.min(risk,10)*10),shifted=death-5;return{light:Math.max(0,65-shifted),heavy:Math.max(0,30-Math.max(0,shifted-65)),death};}
export function validApocalypseDemonessBody(b:ApocalypseDemonessCombatBody):boolean {
 const used=b.powerUses?.BODY_MARK+b.powerUses?.MENTAL_MARK,ids=[...(b.releasedSourceIds??[]),...(b.expiredSourceIds??[])];
 return integer(b.enemyHealth,0,100)&&integer(b.enemyMind,0,100)&&integer(b.enemySpirituality,0,120)&&integer(b.enemyRisk)&&Array.isArray(b.enemyInjuries)&&['RESISTING','SURRENDERED','DEAD'].includes(b.enemyStatus)&&(b.enemyStatus==='DEAD')===(b.enemyHealth===0)&&(b.enemyMind>0||b.enemyStatus!=='RESISTING')&&['HAND','YARD'].includes(b.weaponLocation)&&(b.enemyStatus==='RESISTING'||b.weaponLocation==='YARD')&&shape(b.powerUses,APOCALYPSE_DEMONESS_POWER_IDS)&&APOCALYPSE_DEMONESS_POWER_IDS.every(id=>integer(b.powerUses[id]))&&b.enemySpirituality===120-APOCALYPSE_DEMONESS_POWERS.reduce((n,p)=>n+p.cost*b.powerUses[p.id],0)&&used<=3&&
 integer(b.totalOwnerMindSpent)&&integer(b.pulseContainmentAttempts)&&integer(b.mirrorBufferAttempts)&&integer(b.mirrorScreenAttempts)&&integer(b.blackFlameAttempts)&&integer(b.pulseContainmentChecks,0,b.pulseContainmentAttempts)&&integer(b.mirrorBufferChecks,0,b.mirrorBufferAttempts)&&integer(b.mirrorScreenChecks,0,b.mirrorScreenAttempts)&&integer(b.pulseContainmentSuccesses,0,b.pulseContainmentChecks)&&integer(b.mirrorBufferSuccesses,0,b.mirrorBufferChecks)&&b.totalOwnerMindSpent===2*(b.pulseContainmentAttempts+b.mirrorBufferAttempts)&&shape(b.inheritedSuccesses,['mirrorScreen','blackFlame','frost'])&&Object.values(b.inheritedSuccesses).every(n=>integer(n))&&b.inheritedSuccesses.mirrorScreen<=b.mirrorScreenChecks&&b.inheritedSuccesses.blackFlame<=b.blackFlameAttempts&&b.pulseContainmentSuccesses<=used&&
 Array.isArray(b.releasedSourceIds)&&Array.isArray(b.expiredSourceIds)&&new Set(ids).size===ids.length&&ids.every(id=>/^AD1-LEONA-MARK-[123]:PULSE$/.test(id))&&ids.length===used&&b.pendingSource===null&&
 Array.isArray(b.observations)&&b.observations.every((o,i)=>shape(o,['power','conditionVersion','round','order','atSeconds','paidCost'])&&['BODY_MARK','MENTAL_MARK'].includes(o.power)&&integer(o.conditionVersion,1,b.powerUses.FEINT+1)&&integer(o.round,1)&&integer(o.order,0,11)&&integer(o.atSeconds,4)&&o.paidCost===7&&(i===0||b.observations[i-1]!.atSeconds<o.atSeconds))&&b.observations.filter(o=>o.power==='BODY_MARK').length<=b.powerUses.BODY_MARK&&b.observations.filter(o=>o.power==='MENTAL_MARK').length<=b.powerUses.MENTAL_MARK;
}
export function validApocalypseDemonessInjuries(injuries:SliceInjury[],revision:number):boolean{return Array.isArray(injuries)&&new Set(injuries.map(i=>i.id)).size===injuries.length&&injuries.every(i=>shape(i,['id','severity','acquiredRevision','treatedRevision'])&&typeof i.id==='string'&&!!i.id&&['LIGHT','HEAVY'].includes(i.severity)&&integer(i.acquiredRevision,0,revision)&&(i.treatedRevision===null||integer(i.treatedRevision,i.acquiredRevision,revision)));}
const SOURCE_KEYS=['runId','revision','week','date','round','maxActionCount','encounterId','targetId','attemptWeek','startHistoryIndex','targetName','targetAge','targetSequence','targetCore','actualBody','independentMind','playerBodyId','enemyWeapon','weaponOwner','ordinaryExit','pursuit','thirdPartiesInArea','policy','clubHeld','playerWeaponId','playerHealth','playerMind','playerSpirituality','playerInjuries','playerRisk','physique','perception','will','knowledge','mastery','preparation','root','materials','originals','body','randomSeed','randomCursor'];
export function validApocalypseDemonessCombatSource(x:ApocalypseDemonessCombatSource):boolean {
 try{const p=x.root,prep=x.preparation,initial=prep.originalsAfter.site,current=x.originals.site;
 const expected=structuredClone(initial);expected.clockSeconds+=60*(x.round-1);expected.playerTravelMetres+=p.playerTravelMetres-4;expected.playerEnergy-=p.playerTravelMetres-4;
 const gains:Record<string,number>={[SCREEN]:x.body.inheritedSuccesses.mirrorScreen,[FLAME]:x.body.inheritedSuccesses.blackFlame,[FROST]:x.body.inheritedSuccesses.frost,[PULSE_CONTAINMENT]:x.body.pulseContainmentSuccesses,[MIRROR_BUFFER]:x.body.mirrorBufferSuccesses};
 return shape(x,SOURCE_KEYS)&&shape(x.body,Object.keys(initialApocalypseDemonessBody()))&&validateApocalypseDemonessPreparation(prep)&&typeof x.runId==='string'&&!!x.runId&&integer(x.revision)&&x.week===prep.week&&isValidGameDate(x.date)&&same(x.date,prep.date)&&integer(x.round,1)&&x.maxActionCount===6&&integer(x.startHistoryIndex)&&x.attemptWeek===x.week&&x.encounterId==='APOCALYPSE_DEMONESS_DISPUTE'&&x.targetId===APOCALYPSE_DEMONESS_TARGET_ID&&x.targetName==='莱奥娜·布莱克'&&x.targetAge===43&&x.targetSequence===1&&x.targetCore===24&&x.actualBody===true&&x.independentMind===true&&x.playerBodyId===`${x.runId}:body`&&x.enemyWeapon==='AD1-LEONA-CLUB'&&x.weaponOwner===APOCALYPSE_DEMONESS_TARGET_ID&&x.ordinaryExit==='OPEN'&&x.pursuit===false&&x.thirdPartiesInArea===0&&APOCALYPSE_DEMONESS_POLICIES.includes(x.policy)&&x.clubHeld===prep.playerClubHeld&&x.playerWeaponId===prep.playerWeaponId&&x.clubHeld===(x.playerWeaponId!==null)&&
 [x.playerHealth,x.playerMind].every(n=>integer(n,1,100))&&integer(x.playerSpirituality,0,120)&&[x.physique,x.perception,x.will,x.knowledge].every(n=>integer(n,0,500))&&same({physique:x.physique,perception:x.perception,will:x.will,knowledge:x.knowledge},prep.after.coreStats)&&shape(x.mastery,[...APOCALYPSE_DEMONESS_INHERITED_SKILL_IDS,...APOCALYPSE_DEMONESS_NEW_ABILITY_IDS])&&Object.values(x.mastery).every(n=>integer(n,0,500))&&same(Object.keys(x.mastery).sort(),Object.keys(prep.after.mastery).sort())&&Object.keys(x.mastery).every(id=>x.mastery[id]===Math.min(500,prep.after.mastery[id]!+8*(gains[id]??0)))&&
 integer(x.playerRisk)&&validApocalypseDemonessInjuries(x.playerInjuries,x.revision)&&validApocalypseDemonessInjuries(x.body.enemyInjuries,x.revision)&&validApocalypseDemonessMaterials(x.materials)&&x.materials.plate!==null&&x.materials.plate.charges===3-x.body.mirrorScreenChecks-x.body.mirrorBufferSuccesses&&x.materials.plate.wear===5*(x.body.inheritedSuccesses.mirrorScreen+x.body.mirrorBufferSuccesses)&&x.materials.weapon.location===x.body.weaponLocation&&x.materials.marks.filter(m=>m.status==='SPENT').length===x.body.powerUses.BODY_MARK+x.body.powerUses.MENTAL_MARK&&x.materials.marks.every(m=>m.usedRound===null||m.usedRound<x.round)&&x.body.pulseContainmentAttempts<=x.round-1&&x.body.mirrorBufferAttempts<=x.round-1&&x.body.pendingSource===null&&x.body.mirrorScreenAttempts<=x.round-1&&x.body.blackFlameAttempts<=x.round-1&&x.body.powerUses.FEINT<=x.round-1&&x.body.inheritedSuccesses.frost<=6*(x.round-1)&&
 validApocalypseDemonessCombatOriginals(x.originals)&&same(x.originals.combatPlate,prep.originalsBefore.combatPlate)&&same(current,expected)&&current.playerEnergy>=4&&validApocalypseDemonessScene(p)&&p.siteId===APOCALYPSE_DEMONESS_SITE&&p.playerLocation==='YARD'&&p.observedSourceId===`${x.runId}:AD1-ADJACENT-YARD:${prep.revision}`&&p.observationWeek===prep.week&&p.knownPlayerName===prep.playerName&&p.knownEnemyName==='莱奥娜·布莱克'&&p.clockSeconds===4+60*(x.round-1)&&p.conditionVersion===1+x.body.powerUses.FEINT&&p.enemyCoordinate===(x.body.powerUses.FEINT%2?7:6)&&p.enemyTravelMetres>=x.body.powerUses.FEINT&&validApocalypseDemonessBody(x.body)&&x.body.enemyStatus==='RESISTING'&&typeof x.randomSeed==='string'&&!!x.randomSeed&&x.randomSeed.length<=256&&integer(x.randomCursor)&&prep.runId===x.runId&&prep.randomSeed===x.randomSeed&&prep.randomCursor<=x.randomCursor&&prep.revision<=x.revision-x.round&&x.body.observations.every(o=>o.round<x.round&&o.atSeconds<p.clockSeconds);
 }catch{return false;}
}
export const validateApocalypseDemonessCombatSource=validApocalypseDemonessCombatSource;
/** Shared actual consequence resolver, exposed for declared isolated BODY/MENTAL
 * tests without seeking or replacing any campaign seed/cursor. */
export function resolveApocalypseDemonessConsequences(x:ApocalypseDemonessCombatSource,r:ApocalypseDemonessRuntime,players:ApocalypseDemonessActionEvidence[],enemies:ApocalypseDemonessActionEvidence[],winner:'PLAYER'|'ENEMY',retreat:SliceCombatRound['retreat'],rng:ActionRandomStream) {
  const b=r.body;
  let playerHealth = r.playerH, playerRisk = x.playerRisk, outcome: ApocalypseDemonessResolution = retreat === 'SUCCESS' ? 'RETREATED' : b.enemyMind === 0 ? 'ENEMY_SURRENDERED' : 'CONTINUE';
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
export function replayApocalypseDemonessCombatRound(x:ApocalypseDemonessCombatSource,stance:SliceStance):{round:SliceCombatRound;outcome:ApocalypseDemonessResolution}{
 if(!validApocalypseDemonessCombatSource(x)||!['ATTACK','DEFEND','CONTROL','PREPARE','RETREAT'].includes(stance))throw new Error('缺少真实原来源。');
 const rng=new DeterministicActionRandomStream(x.randomSeed,x.randomCursor),r=createApocalypseDemonessRuntime(x),b=r.body;
 const playerCountRoll=rng.nextInt(1,100),enemyCountRoll=rng.nextInt(1,100),playerCount=apocalypseDemonessActionCount(playerCountRoll),enemyCount=apocalypseDemonessEnemyActionCount(enemyCountRoll);
 const first=x.round%2===1?'PLAYER':'ENEMY',order=first==='PLAYER'?['PLAYER','ENEMY'] as const:['ENEMY','PLAYER'] as const;
 const players:ApocalypseDemonessActionEvidence[]=[],enemies:ApocalypseDemonessActionEvidence[]=[],remaining={PLAYER:playerCount,ENEMY:enemyCount};let retreat:SliceCombatRound['retreat']='NONE';
 while(remaining.PLAYER>0||remaining.ENEMY>0)for(const actor of order){
  if(!remaining[actor])continue;
  if(actor==='PLAYER'&&stance==='RETREAT'){remaining.PLAYER=0;retreat=rng.nextInt(1,100)<=50?'SUCCESS':'FAILURE';if(retreat==='SUCCESS'){remaining.ENEMY=0;break;}continue;}
  remaining[actor]--;const index=players.length+enemies.length;
  if(actor==='PLAYER')players.push(resolveApocalypseDemonessPlayerSlot(x,r,drawApocalypseDemonessAbility(rng,null,stance),index,rng,stance));
  else enemies.push(resolveApocalypseDemonessEnemySlot(x,r,drawApocalypseDemonessEnemyAbility(rng),index,rng));
 }
 const sum=(a:ApocalypseDemonessActionEvidence[],key:'selfGain'|'enemyReduction')=>a.reduce((n,v)=>n+v[key],0),core=x.physique*.25+x.perception*.30+x.will*.30+x.knowledge*.15;
 const playerAdvantage=Math.max(125,base(core,x.playerHealth,x.playerMind,x.playerSpirituality)+sum(players,'selfGain')-sum(enemies,'enemyReduction'));
 const enemyAdvantage=Math.max(125,base(x.targetCore,x.body.enemyHealth,x.body.enemyMind,x.body.enemySpirituality)+sum(enemies,'selfGain')-sum(players,'enemyReduction'));
 const winChance=playerAdvantage/(playerAdvantage+enemyAdvantage)*100,winner=retreat==='SUCCESS'?'ENEMY':rng.nextInt(1,1_000_000)<=winChance*10_000?'PLAYER':'ENEMY';
 const {playerHealth,playerRisk,outcome,playerInjuries,consequenceWeights,consequenceRoll,consequenceDomain}=resolveApocalypseDemonessConsequences(x,r,players,enemies,winner,retreat,rng);
 advanceApocalypseDemonessCombatClock(r,x.root.clockSeconds+60-r.root.clockSeconds);for(const key of keys)invalidate(r,key);if(b.pendingSource){b.expiredSourceIds.push(b.pendingSource.id);b.pendingSource=null;}
 if(b.enemyStatus!=='RESISTING')r.materials.weapon.location='YARD';b.weaponLocation=r.materials.weapon.location;
 const o:ApocalypseDemonessRoundOutcome={...structuredClone(b),targetId:APOCALYPSE_DEMONESS_TARGET_ID,round:x.round,source:structuredClone(x),stance,continuing:outcome==='CONTINUE',playerHealthAfter:playerHealth,playerMindAfter:r.playerM,playerSpiritualityAfter:r.playerS,playerInjuriesAfter:playerInjuries,playerRiskAfter:playerRisk,materialsAfter:structuredClone(r.materials),originalsAfter:structuredClone(r.originals),masteryAfter:{...r.mastery},rootAfter:structuredClone(r.root),elapsedSeconds:60,randomCursorAfter:rng.cursor,playerActions:players,enemyActions:enemies,expiredWindows:r.expiredWindows,windowsAfter:structuredClone(r.windows)};
 const round:SliceCombatRound={round:x.round,stance,first,playerCount,enemyCount,playerCountRoll,enemyCountRoll,moves:[...players,...enemies].sort((a,b)=>a.order-b.order).map(a=>({actor:a.actor,label:a.label,selfGain:a.selfGain,enemyReduction:a.enemyReduction})),playerAdvantage,enemyAdvantage,winChance,winner,consequence:'',consequenceWeights,retreat,...(consequenceDomain===undefined?{}:{consequenceDomain}),...(consequenceRoll===undefined?{}:{consequenceRoll}),apocalypseDemonessOutcome:o};round.consequence=apocalypseDemonessCombatConsequence(round);return{round,outcome};
}
export function validateApocalypseDemonessRoundOutcome(v:unknown):v is ApocalypseDemonessRoundOutcome{try{const o=v as ApocalypseDemonessRoundOutcome;return !!o&&same(o,replayApocalypseDemonessCombatRound(o.source,o.stance).round.apocalypseDemonessOutcome);}catch{return false;}}
export function validateApocalypseDemonessCombatRound(round:SliceCombatRound):boolean{try{const o=round.apocalypseDemonessOutcome;return !!o&&same(round,replayApocalypseDemonessCombatRound(o.source,o.stance).round);}catch{return false;}}
export function nextApocalypseDemonessCombatSource(o:ApocalypseDemonessRoundOutcome):ApocalypseDemonessCombatSource{return{...structuredClone(o.source),revision:o.source.revision+1,round:o.round+1,playerHealth:o.playerHealthAfter,playerMind:o.playerMindAfter,playerSpirituality:Math.min(120,o.playerSpiritualityAfter+12),playerInjuries:structuredClone(o.playerInjuriesAfter),playerRisk:o.playerRiskAfter,root:structuredClone(o.rootAfter),body:combatBody(o),materials:structuredClone(o.materialsAfter),originals:structuredClone(o.originalsAfter),mastery:{...o.masteryAfter},randomCursor:o.randomCursorAfter};}
export function apocalypseDemonessCombatConsequence(round:SliceCombatRound):string{
 const o=round.apocalypseDemonessOutcome!,who=round.winner==='PLAYER'?'莱奥娜':'你';
 let text=round.retreat==='SUCCESS'?'撤离判定成功，将沿普通4米出口实际离开。':round.consequenceDomain==='MENTAL'?`${who}承受实际精神压力，精神减少10，没有身体伤口或身体风险。`:round.consequenceDomain==='BODY'?`${who}承受实际身体攻击，按共同伤势盘结算，实掷${round.consequenceRoll}/100（轻${round.consequenceWeights!.light}/重${round.consequenceWeights!.heavy}/死亡${round.consequenceWeights!.death}）。`:'本轮没有实际致伤来源，不掷身体伤势盘、不增加身体风险。';
 const attacks=round.winner==='PLAYER'?o.playerActions:o.enemyActions;if(round.consequenceDomain)text+=` 实际${round.consequenceDomain==='BODY'?'身体':'精神'}来源：${attacks.filter(a=>round.consequenceDomain==='BODY'?a.threatens:a.mentalPressure).map(a=>a.selectedAbility).join('、')}。`;
 text+=` 本人健康${o.source.playerHealth}→${o.playerHealthAfter}、精神${o.source.playerMind}→${o.playerMindAfter}；莱奥娜健康${o.source.body.enemyHealth}→${o.enemyHealth}、精神${o.source.body.enemyMind}→${o.enemyMind}。`;
 if(o.playerHealthAfter>0&&o.playerMindAfter===0)text+='本人精神耗尽，仍活着，沿普通出口离开。';
 if(o.playerHealthAfter===0)text+='本人的原身体真实死亡，本周目终结。';else if(o.enemyHealth===0)text+='莱奥娜原身体真实死亡，唯一原棍留地。';else if(o.enemyStatus==='SURRENDERED')text+='莱奥娜因实际伤势或精神耗尽停止抵抗，仍活着，原棍放下。';
 return text+' 本轮实际60秒，过期或未用窗口结束，已付费用不退。真实旧伤、新伤、新片耗次与磨损、往返精力和有限印记保留；未释放来源轮末消散而资源仍实耗。维瑞娜、马库斯已在场外，伊瑞丝与旧人物结果不变。';
}
export function projectApocalypseDemonessCombat(s:SliceState){
 const e=s.apocalypseDemoness.encounter,known=e.scene.knownEnemyName!==null,last=s.combat?.encounterId==='APOCALYPSE_DEMONESS_DISPUTE'?s.combat.lastRound?.apocalypseDemonessOutcome:e.terminal?s.combatHistory[e.terminal.historyIndex]?.apocalypseDemonessOutcome:null,site=s.apocalypseDemoness.life.site;
 return{enemyName:known?'莱奥娜·布莱克（43岁）':null,targetId:e.targetId,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,weaponLocation:e.weaponLocation,powerUses:{...e.powerUses},policy:e.policy,scene:structuredClone(e.scene),materials:structuredClone(e.materials),remainingMarkIds:e.materials.marks.filter(m=>m.status==='HELD').map(m=>m.id).sort(),pendingSource:structuredClone(e.pendingSource),lastActionSequence:last?[...last.playerActions,...last.enemyActions].sort((a,b)=>a.order-b.order):[],windows:last?structuredClone(last.windowsAfter):{pulseContainment:null,mirrorBuffer:null,mirrorScreen:null},constants:APOCALYPSE_DEMONESS_COMBAT_CONSTANTS,countWheel:APOCALYPSE_DEMONESS_COUNT_WHEEL,enemyCountWheel:APOCALYPSE_DEMONESS_ENEMY_COUNT_WHEEL,abilityWheel:apocalypseDemonessAbilityWheel(s,null),enemyAbilityWheel:APOCALYPSE_DEMONESS_ENEMY_ABILITY_WHEEL,facts:[
 '体25%、感30%、意30%、知15%；双方1至6动作10/15/25/25/15/10，基础1250、底125、灵性上限120，仅继续轮恢复12。',
 '脉冲收束8灵性2精神、知识18；只借实际观察且尚未释放的同一枚印记辅助下一普通打击30一次。对手攻击继续，不撤销旧伤、不影响其它来源。',
 '镜面缓冲8灵性2精神、意志18；仅下一可见身体冲击减势30，实耗新片一次并磨损5。精神攻击不耗缓冲、不受保护。',
 '两项新能力每轮各尝试一次，窗口20秒。移动遮挡使窗口失效，失败照付；只有实际应用才增长掌握。新片供镜幕与缓冲共同使用，防护窗口互相替换且不退已耗次数。',
 `AD1-COMBAT-PLATE余${e.materials.plate?.charges??0}/3、磨损${e.materials.plate?.wear??0}；旧CD2-COMBAT-PLATE原余${s.calamityDemoness.encounter.plate?.charges??0}，没有复制、使用或补满。`,
 `同一本人累计时钟${site?.clockSeconds??0}秒、行程${site?.playerTravelMetres??0}米、精力${site?.playerEnergy??0}；实际移动实扣精力并留4精力普通退出。`,
 '莱奥娜三枚印记共用有限库存。每次声明在原槽支付7灵性和一枚、没有攻击贡献；蓄势15秒后占后续原槽释放身体75或精神65。轮末未释放则消散，真实消耗不退。',
 '精神后果不伪造身体伤口；真实死亡终结身体。维瑞娜、马库斯已在场外，伊瑞丝仍在另一处旧庭院。']};
}
