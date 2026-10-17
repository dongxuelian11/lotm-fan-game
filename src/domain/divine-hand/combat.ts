import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import { GLORY_COUNT_WHEEL, gloryActionCount } from '../glory/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { DIVINE_HAND_TARGET_ID, DIVINE_HAND_SITE, DIVINE_HAND_POWER_IDS, DIVINE_HAND_POWERS, DIVINE_HAND_POLICIES,
 combatBody, initialDivineHandBody, hasDivineHandDisputeOpponent, validateDivineHandPreparation, validDivineHandMaterials, validDivineHandScene,
 divineHandOriginalSnapshot, validDivineHandCombatOriginals, divineHandPlayerWeapon,
 type DivineHandCombatBody, type DivineHandEnemyIntent, type DivineHandPreparation, type DivineHandMaterials, type DivineHandScene, type DivineHandPolicy, type DivineHandCombatOriginals } from './encounter.js';

/** The actual Glory action distribution and core weights are retained. These
 * two short personal techniques do not confer immunity or protect other people. */
export const DIVINE_HAND_COUNT_WHEEL=GLORY_COUNT_WHEEL;
export const DIVINE_HAND_ENEMY_COUNT_WHEEL=GLORY_COUNT_WHEEL;
export const divineHandActionCount=gloryActionCount;
export const divineHandEnemyActionCount=gloryActionCount;
export const DIVINE_HAND_COMBAT_CONSTANTS={weights:{physique:.45,perception:.20,will:.25,knowledge:.10},tier:1250,floor:125,maxSpirituality:120,continuingRecovery:12,enemyPhysique:24,beamStabilizeCost:8,beamStabilizeMindCost:2,beamStabilizeAid:30,armorConvergenceCost:8,armorConvergenceMindCost:2,armorConvergenceReduction:30,armorWear:5,windowSeconds:20,slotSeconds:5} as const;
export const BEAM_STABILIZE='warrior.s1.beam-stabilize',ARMOR_CONVERGENCE='warrior.s1.armor-convergence';
export const DIVINE_HAND_NEW_ABILITY_IDS=[BEAM_STABILIZE,ARMOR_CONVERGENCE] as const;
export const DIVINE_HAND_INHERITED_SKILL_IDS=['warrior.s9.physique','warrior.s9.arms','warrior.s9.restraint','warrior.s8.combat-skill','warrior.s7.weapons','warrior.s7.weak-point','warrior.s6.dawn-light','warrior.s6.dawn-armor','warrior.s6.dawn-weapon','warrior.s6.light-storm','warrior.s5.guard-state','warrior.s5.damage-sharing','warrior.s4.discern-corruption','warrior.s4.targeted-preparation','warrior.s4.veil-intent','warrior.s3.silver-armor','warrior.s3.light-concealment','warrior.s3.silver-thrust','warrior.s2.armor-temper','warrior.s2.close-guard'] as const;
const ARMOR='warrior.s2.armor-temper',BEARING='warrior.s2.close-guard',THRUST='warrior.s3.silver-thrust';
export type DivineHandMoveId=typeof DIVINE_HAND_INHERITED_SKILL_IDS[number]|typeof DIVINE_HAND_NEW_ABILITY_IDS[number]|'STRIKE'|'EVADE'|'OBSERVE'|'ACCIDENT';
/** Old raw tickets stay 25/20/20/15/15/5. Two new skills add 14 each;
 * zero-mastery historic skills are not silently added as usable attacks. */
export const DIVINE_HAND_ABILITIES:readonly{id:DivineHandMoveId;label:string;weight:number;stance:SliceStance|null}[]=[
 {id:ARMOR,label:'银甲淬护：6灵性、知识20，下一实际身体攻击减势45并磨损原甲5',weight:25,stance:'DEFEND'},
 {id:BEARING,label:'近身护持：6灵性、意志20，成功自付5健康并获30防守优势',weight:20,stance:'PREPARE'},
 {id:THRUST,label:'银白细剑突刺：6灵性、知识18，沿用原掌握和真实身体状态',weight:20,stance:'ATTACK'},
 {id:'STRIKE',label:'普通打击：实际持棍16或徒手12，走近后回到普通出口点',weight:15,stance:'ATTACK'},
 {id:'EVADE',label:'普通避让：实际侧步再返回，重新观察当前条件，减势10',weight:15,stance:'DEFEND'},
 {id:'ACCIDENT',label:'判断失误：−22.5',weight:5,stance:null},
 {id:BEAM_STABILIZE,label:'接触稳持：8灵性2精神、知识18，仅稳定本人已握原棍的下一次普通打击',weight:14,stance:'CONTROL'},
 {id:ARMOR_CONVERGENCE,label:'护甲合势：8灵性2精神、意志18，仅下一可见身体冲击减势30并磨损原甲5',weight:14,stance:'CONTROL'},
];
export const DIVINE_HAND_PLAYER_ABILITIES=DIVINE_HAND_ABILITIES;
export const DIVINE_HAND_ENEMY_ABILITY_WHEEL:readonly SliceWheelEntry[]=[
 {id:'BODY_MARK',label:'身体冲击印记：7灵性与1枚原印记、身体贡献75',weight:30},
 {id:'MENTAL_MARK',label:'精神牵引印记：7灵性与1枚原印记、精神贡献65',weight:25},
 {id:'BODY_STRIKE',label:'自有原棍普通打击20×身体状态',weight:25},
 {id:'FEINT',label:'侧移一米并横棍遮挡：3灵性、每轮一次，打断可见条件',weight:15},
 {id:'ACCIDENT',label:'判断偏差−22.5',weight:5},
];
export const isDivineHand=(s:SliceState)=>s.progression.pathwayId==='warrior'&&s.progression.sequence===1;
const tickets=(stance:SliceStance|null)=>DIVINE_HAND_ABILITIES.map(a=>a.weight*(a.stance===stance&&stance!==null?5:4));
export function divineHandAbilityWheel(_s:SliceState,stance:SliceStance|null):SliceWheelEntry[]{const w=tickets(stance),total=w.reduce((n,v)=>n+v,0);return DIVINE_HAND_ABILITIES.map((a,i)=>({id:a.id,label:stance==='DEFEND'&&(a.id==='STRIKE'||a.id===THRUST)?'整轮防守，此槽不发动攻击':a.label,weight:w[i]!/total*100}));}
export function drawDivineHandAbility(rng:ActionRandomStream,_s:SliceState|null,stance:SliceStance|null):DivineHandMoveId{const w=tickets(stance);let n=rng.nextInt(1,w.reduce((a,b)=>a+b,0));for(const[i,a]of DIVINE_HAND_ABILITIES.entries()){n-=w[i]!;if(n<=0)return a.id;}throw new Error('行动盘无效。');}
export function drawDivineHandEnemyAbility(rng:ActionRandomStream):DivineHandEnemyIntent{let n=rng.nextInt(1,100);for(const a of DIVINE_HAND_ENEMY_ABILITY_WHEEL){n-=a.weight;if(n<=0)return a.id as DivineHandEnemyIntent;}throw new Error('对手行动盘无效。');}
const same=(a:unknown,b:unknown)=>a===b||(a!==undefined&&b!==undefined&&stableStringify(a)===stableStringify(b));
const integer=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER):n is number=>Number.isSafeInteger(n)&&(n as number)>=min&&(n as number)<=max;
const shape=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...keys].sort());
const physicalAt=(n:number)=>n>75?1:n>50?.95:n>25?.9:.8;
export interface DivineHandCombatSource {
 runId:string;revision:number;week:number;date:PublicGameDate;round:number;encounterId:'DIVINE_HAND_DISPUTE';targetId:typeof DIVINE_HAND_TARGET_ID;
 attemptWeek:number;startHistoryIndex:number;targetName:'奥斯卡·里德';targetAge:43;targetSequence:1;targetCore:24;actualBody:true;independentMind:true;playerBodyId:string;
 enemyWeapon:'DH1-OSCAR-CLUB';weaponOwner:typeof DIVINE_HAND_TARGET_ID;ordinaryExit:'OPEN';pursuit:false;thirdPartiesInArea:0;policy:DivineHandPolicy;clubHeld:boolean;playerWeaponId:'town-short-club'|'warrior-training-club'|null;
 playerHealth:number;playerMind:number;playerSpirituality:number;playerInjuries:SliceInjury[];playerRisk:number;physique:number;perception:number;will:number;knowledge:number;mastery:Record<string,number>;
 preparation:DivineHandPreparation;root:DivineHandScene;materials:DivineHandMaterials;originals:DivineHandCombatOriginals;body:DivineHandCombatBody;randomSeed:string;randomCursor:number;
}
export function currentDivineHandCombatSource(s:SliceState):DivineHandCombatSource|null {
 if(!hasDivineHandDisputeOpponent(s))return null;const e=s.divineHand.encounter,c=s.combat!,weapon=divineHandPlayerWeapon(s);
 return{runId:s.runId,revision:s.revision,week:s.week,date:{...s.date},round:c.round,encounterId:'DIVINE_HAND_DISPUTE',targetId:DIVINE_HAND_TARGET_ID,attemptWeek:e.attemptWeek!,startHistoryIndex:e.startHistoryIndex!,targetName:'奥斯卡·里德',targetAge:43,targetSequence:1,targetCore:24,actualBody:true,independentMind:true,playerBodyId:`${s.runId}:body`,enemyWeapon:'DH1-OSCAR-CLUB',weaponOwner:DIVINE_HAND_TARGET_ID,ordinaryExit:'OPEN',pursuit:false,thirdPartiesInArea:0,policy:e.policy,clubHeld:weapon!==null,playerWeaponId:weapon,playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,playerInjuries:structuredClone(s.injuries),playerRisk:s.injuryRisk,...s.character.coreStats,mastery:{...s.progression.mastery},preparation:structuredClone(e.preparation!),root:structuredClone(e.scene),materials:structuredClone(e.materials),originals:divineHandOriginalSnapshot(s),body:combatBody(e),randomSeed:s.random.seed,randomCursor:s.random.cursor};
}
export interface DivineHandWindow {id:string;kind:'BEAM_STABILIZE'|'ARMOR_CONVERGENCE'|'ARMOR_TEMPER';createdAt:number;expiresAt:number;openedOrder:number;conditionVersion:number;targetId:string;enemyCoordinate:6|7;playerCoordinate:4;magnitude:30|45}
export interface DivineHandWindows {beamStabilize:DivineHandWindow|null;armorConvergence:DivineHandWindow|null;armorTemper:DivineHandWindow|null}
export interface DivineHandActionEvidence {
 order:number;actor:'PLAYER'|'ENEMY';id:string;planned:string;selectedAbility:string;fallbackReason:string|null;label:string;selfGain:number;enemyReduction:number;threatens:boolean;mentalPressure:boolean;attackKind:'NONE'|'BODY'|'MENTAL';rawContribution:number;rawReduction:number;
 paidCost:number;mindCost:number;healthPaid:number;energyPaid:number;armorWear:number;physicalFactor:number;check:PublicCheckResult|null;resistanceRoll:null;resistanceChance:null;succeeded:boolean;
 finiteResult:'NONE'|'UNAVAILABLE'|'ALREADY_ATTEMPTED'|'INSUFFICIENT'|'FAILED'|'PENDING'|'APPLIED';windowsBefore:DivineHandWindows;windowsAfter:DivineHandWindows;masteryApplied:string[];countered:string[];appliedWindowId:string|null;
 consumedMarkId:string|null;materialsBefore:DivineHandMaterials;materialsAfter:DivineHandMaterials;originalsBefore:DivineHandCombatOriginals;originalsAfter:DivineHandCombatOriginals;
 conditionVersionBefore:number;conditionVersionAfter:number;atSeconds:number;completedAtSeconds:number;elapsedSeconds:5;travelMetres:number;travelPath:number[];lateralTravelPath:number[];randomCursorBefore:number;randomCursorAfter:number;playerHealthAfter:number;playerMindAfter:number;playerSpiritualityAfter:number;enemyMindAfter:number;enemySpiritualityAfter:number;
}
export interface DivineHandRuntime {body:DivineHandCombatBody;root:DivineHandScene;materials:DivineHandMaterials;originals:DivineHandCombatOriginals;playerH:number;playerM:number;playerS:number;mastery:Record<string,number>;windows:DivineHandWindows;expiredWindows:DivineHandWindow[];beamStabilizeAttempted:boolean;armorConvergenceAttempted:boolean;armorTemperAttempted:boolean;closeGuardAttempted:boolean;feintUsed:boolean}
export function createDivineHandRuntime(x:DivineHandCombatSource):DivineHandRuntime{return{body:structuredClone(x.body),root:structuredClone(x.root),materials:structuredClone(x.materials),originals:structuredClone(x.originals),playerH:x.playerHealth,playerM:x.playerMind,playerS:x.playerSpirituality,mastery:{...x.mastery},windows:{beamStabilize:null,armorConvergence:null,armorTemper:null},expiredWindows:[],beamStabilizeAttempted:false,armorConvergenceAttempted:false,armorTemperAttempted:false,closeGuardAttempted:false,feintUsed:false};}
const active=(r:DivineHandRuntime)=>r.root.playerLocation==='YARD'&&r.root.playerCoordinate===4&&r.body.enemyStatus==='RESISTING'&&r.body.enemyHealth>0&&r.body.enemyMind>0&&r.playerH>0&&r.playerM>0;
const observed=(r:DivineHandRuntime)=>active(r)&&r.root.visibleBodyLine&&r.root.observedConditionVersion===r.root.conditionVersion;
const keys=['beamStabilize','armorConvergence','armorTemper'] as const;
function invalidate(r:DivineHandRuntime,key:keyof DivineHandWindows):void{const w=r.windows[key];if(w)r.expiredWindows.push(structuredClone(w));r.windows[key]=null;}
const sameEndpoint=(r:DivineHandRuntime,w:DivineHandWindow)=>w.conditionVersion===r.root.conditionVersion&&w.enemyCoordinate===r.root.enemyCoordinate&&w.playerCoordinate===r.root.playerCoordinate;
export function advanceDivineHandCombatClock(r:DivineHandRuntime,seconds:number):void {
 if(!integer(seconds))throw new Error('实际时间无效。');r.root.clockSeconds+=seconds;r.root.externalSeconds+=seconds;r.originals.site.clockSeconds+=seconds;
 for(const key of keys){const w=r.windows[key];if(w&&(w.expiresAt<=r.root.clockSeconds||!observed(r)||!sameEndpoint(r,w)))invalidate(r,key);}
}
function baseAction(r:DivineHandRuntime,actor:'PLAYER'|'ENEMY',id:string,order:number,rng:ActionRandomStream):DivineHandActionEvidence {
 advanceDivineHandCombatClock(r,0);return{order,actor,id,planned:id,selectedAbility:id,fallbackReason:null,label:'',selfGain:0,enemyReduction:0,threatens:false,mentalPressure:false,attackKind:'NONE',rawContribution:0,rawReduction:0,paidCost:0,mindCost:0,healthPaid:0,energyPaid:0,armorWear:0,physicalFactor:physicalAt(actor==='PLAYER'?r.playerH:r.body.enemyHealth),check:null,resistanceRoll:null,resistanceChance:null,succeeded:false,finiteResult:'NONE',windowsBefore:structuredClone(r.windows),windowsAfter:structuredClone(r.windows),masteryApplied:[],countered:[],appliedWindowId:null,consumedMarkId:null,materialsBefore:structuredClone(r.materials),materialsAfter:structuredClone(r.materials),originalsBefore:structuredClone(r.originals),originalsAfter:structuredClone(r.originals),conditionVersionBefore:r.root.conditionVersion,conditionVersionAfter:r.root.conditionVersion,atSeconds:r.root.clockSeconds,completedAtSeconds:r.root.clockSeconds+5,elapsedSeconds:5,travelMetres:0,travelPath:[actor==='PLAYER'?r.root.playerCoordinate:r.root.enemyCoordinate],lateralTravelPath:[0],randomCursorBefore:rng.cursor,randomCursorAfter:rng.cursor,playerHealthAfter:r.playerH,playerMindAfter:r.playerM,playerSpiritualityAfter:r.playerS,enemyMindAfter:r.body.enemyMind,enemySpiritualityAfter:r.body.enemySpirituality};
}
function closeAction(a:DivineHandActionEvidence,r:DivineHandRuntime,rng:ActionRandomStream):DivineHandActionEvidence{advanceDivineHandCombatClock(r,5);a.completedAtSeconds=r.root.clockSeconds;a.windowsAfter=structuredClone(r.windows);a.materialsAfter=structuredClone(r.materials);a.originalsAfter=structuredClone(r.originals);a.conditionVersionAfter=r.root.conditionVersion;a.randomCursorAfter=rng.cursor;a.playerHealthAfter=r.playerH;a.playerMindAfter=r.playerM;a.playerSpiritualityAfter=r.playerS;a.enemyMindAfter=r.body.enemyMind;a.enemySpiritualityAfter=r.body.enemySpirituality;a.threatens=a.attackKind==='BODY'&&a.selfGain>0;a.mentalPressure=a.attackKind==='MENTAL'&&a.selfGain>0;a.label+=` 实际5秒，本人灵性${r.playerS}、精神${r.playerM}，对手灵性${r.body.enemySpirituality}。`;return a;}
function walk(r:DivineHandRuntime,a:DivineHandActionEvidence,metres:number):boolean{if(r.originals.site.playerEnergy<metres+4)return false;r.originals.site.playerEnergy-=metres;r.originals.site.playerTravelMetres+=metres;r.root.playerTravelMetres+=metres;a.energyPaid+=metres;a.travelMetres+=metres;return true;}
function ordinary(x:DivineHandCombatSource,r:DivineHandRuntime,a:DivineHandActionEvidence,why:string,attack=false){a.selectedAbility=attack?'STRIKE':'EVADE';a.fallbackReason=why||null;a.label=why;a.succeeded=true;if(attack&&walk(r,a,2*(r.root.enemyCoordinate-4))){a.travelPath=[4,r.root.enemyCoordinate,4];a.selfGain=(x.clubHeld?16:12)*a.physicalFactor;a.attackKind='BODY';a.label+=`本人用${x.clubHeld?'实际握持的原棍':'原身体'}走近普通打击并返回，共${a.travelMetres}米。`;}else{a.selectedAbility='EVADE';a.enemyReduction=10;a.label+=attack?'保留普通返程4精力，本槽站稳防备，无攻击。':'普通防备，减势10。';}}
function pay(r:DivineHandRuntime,a:DivineHandActionEvidence,s:number,m=0){if(r.playerS<s||r.playerM<=m)return false;r.playerS-=s;r.playerM-=m;r.body.totalOwnerMindSpent+=m;a.paidCost=s;a.mindCost=m;return true;}
function check(x:DivineHandCombatSource,a:DivineHandActionEvidence,ability:'knowledge'|'will',difficulty:number,rng:ActionRandomStream){a.check=resolveNormalCheck({ability,baseAbility:x[ability],difficulty,modifiers:[],roll:rng.nextInt(1,100)});a.succeeded=['SUCCESS','GREAT_SUCCESS'].includes(a.check.tier);a.label+=`${ability==='will'?'意志':'知识'}检定${a.check.roll}，${a.succeeded?'成功':'失败'}。`;return a.succeeded;}
function gainMastery(r:DivineHandRuntime,a:DivineHandActionEvidence,id:string){r.mastery[id]=Math.min(500,(r.mastery[id]??0)+8);a.masteryApplied.push(id);}
const usableArmor=(r:DivineHandRuntime)=>r.originals.site.armorWorn&&r.originals.site.armor?.formed&&r.originals.site.armor.owner==='PLAYER'&&r.originals.site.armor.integrity>=5;
function window(x:DivineHandCombatSource,r:DivineHandRuntime,a:DivineHandActionEvidence,kind:DivineHandWindow['kind'],targetId:string,magnitude:30|45):DivineHandWindow{return{id:`DH1-${kind}:${x.round}:${a.order}`,kind,createdAt:a.completedAtSeconds,expiresAt:a.completedAtSeconds+20,openedOrder:a.order,conditionVersion:r.root.conditionVersion,targetId,enemyCoordinate:r.root.enemyCoordinate,playerCoordinate:4,magnitude};}
export function resolveDivineHandPlayerSlot(x:DivineHandCombatSource,r:DivineHandRuntime,id:DivineHandMoveId,order:number,rng:ActionRandomStream,stance:SliceStance='CONTROL'):DivineHandActionEvidence {
 if(![...DIVINE_HAND_INHERITED_SKILL_IDS,...DIVINE_HAND_NEW_ABILITY_IDS,'STRIKE','EVADE','OBSERVE','ACCIDENT'].includes(id))throw new Error('未知本人动作。');const a=baseAction(r,'PLAYER',id,order,rng);
 if(!active(r)){a.finiteResult='UNAVAILABLE';a.label='本人或对手已离场、死亡或停止抵抗，没有新效果。';return closeAction(a,r,rng);}
 if(stance==='DEFEND'&&(id==='STRIKE'||id===THRUST)){a.finiteResult='UNAVAILABLE';a.selectedAbility='EVADE';a.label='整轮保持防守，此槽不打击、不施放突刺。';}
 else if(x.policy==='ORDINARY'&&id.startsWith('warrior.')){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'预先选择只作普通行动；');}
 else if(id===BEAM_STABILIZE||id===ARMOR_CONVERGENCE){
  const beam=id===BEAM_STABILIZE,key=beam?'beamStabilize':'armorConvergence',attempted=beam?r.beamStabilizeAttempted:r.armorConvergenceAttempted;
  const allowed=x.policy==='ALL'||x.policy===(beam?'BEAM_STABILIZE':'ARMOR_CONVERGENCE');
  if(!allowed){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'所选策略不允许此能力；');}
  else if(attempted){a.finiteResult='ALREADY_ATTEMPTED';ordinary(x,r,a,'本轮已实付尝试一次；');}
  else if(!observed(r)||beam&&(!x.clubHeld||x.playerWeaponId===null)||!beam&&!usableArmor(r)){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,beam?'没有可见条件或本人实际握持的同一原棍；':'没有可见条件或已穿用且完整度至少5的同一原甲；');}
  else if(!pay(r,a,8,2)){a.finiteResult='INSUFFICIENT';ordinary(x,r,a,'不足8灵性或不能支付2精神并保持清醒；');}
  else{if(beam){r.beamStabilizeAttempted=true;r.body.beamStabilizeAttempts++;}else{r.armorConvergenceAttempted=true;r.body.armorConvergenceAttempts++;}a.label=beam?'实付接触稳持，手中仍是本人实际握持的同一件原棍。':'实付护甲合势，只整理本人身上的同一副原甲。';
   if(!check(x,a,beam?'knowledge':'will',18,rng))a.finiteResult='FAILED';
   else{if(beam)r.body.beamStabilizeChecks++;else r.body.armorConvergenceChecks++;r.windows[key]=window(x,r,a,beam?'BEAM_STABILIZE':'ARMOR_CONVERGENCE',beam?x.playerWeaponId!:r.originals.site.armor!.id,30);a.finiteResult='PENDING';a.label+=beam?'施放完成后20秒内，仅下一次实际原棍普通打击可用辅助30；目前没有贡献或掌握奖励。':'施放完成后20秒内，只等随后一次可见身体冲击；目前没有减势、磨损或掌握奖励。';}
  }
 }else if(id==='STRIKE')ordinary(x,r,a,'',true);
 else if(id==='EVADE'||id==='OBSERVE'){
  ordinary(x,r,a,'');if(walk(r,a,2)){a.lateralTravelPath=[0,1,0];r.root.visibleBodyLine=true;r.root.observedConditionVersion=r.root.conditionVersion;a.label+='实际侧步一米再返回，重新观察同一对手当前位置。';}else a.label+='剩余精力只够普通离场，不侧步、不伪造重新观察。';
 }else if(id==='ACCIDENT'){a.selfGain=-22.5;a.label='判断失误，固定−22.5，不重抽。';}
 else if(id===ARMOR||id===BEARING||id===THRUST){
  const repeated=id===ARMOR&&r.armorTemperAttempted||id===BEARING&&r.closeGuardAttempted;
  if(repeated){a.finiteResult='ALREADY_ATTEMPTED';ordinary(x,r,a,'本轮已经尝试旧能力；');}
  else if(!observed(r)||id===ARMOR&&!usableArmor(r)||id===BEARING&&r.playerH<=5||id===THRUST&&r.originals.site.playerEnergy<2*(r.root.enemyCoordinate-4)+4){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'原能力当前可见条件、原甲或本人负担能力不足；');}
  else if(!pay(r,a,6)){a.finiteResult='INSUFFICIENT';ordinary(x,r,a,'不足原能力6灵性；',id===THRUST);}
  else{if(id===ARMOR){r.armorTemperAttempted=true;r.body.armorTemperAttempts++;}if(id===BEARING){r.closeGuardAttempted=true;r.body.closeGuardAttempts++;}a.label='按原成本尝试已学能力。';
   if(!check(x,a,id===BEARING?'will':'knowledge',id===THRUST?18:20,rng))a.finiteResult='FAILED';
   else if(id===ARMOR){r.windows.armorTemper=window(x,r,a,'ARMOR_TEMPER',r.originals.site.armor!.id,45);a.finiteResult='PENDING';a.label+='只待下一次实际身体冲击，减势45时原甲磨损5；没有当槽掌握奖励。';}
   else if(id===BEARING){r.playerH-=5;a.healthPaid=5;a.selfGain=30;a.finiteResult='APPLIED';r.body.inheritedSuccesses.closeGuard++;gainMastery(r,a,id);a.label+='本人实际承担5健康，获得30防守优势；不是攻击，也没有同伴分担。';}
   else{walk(r,a,2*(r.root.enemyCoordinate-4));a.travelPath=[4,r.root.enemyCoordinate,4];a.selfGain=76*(.65+.35*x.mastery[THRUST]!/500)*a.physicalFactor;a.attackKind='BODY';a.finiteResult='APPLIED';r.body.inheritedSuccesses.silverThrust++;gainMastery(r,a,id);a.label+='本人实际走近并退回，沿原掌握向眼前位置发动银白细剑突刺，仍由真实交锋决定身体后果。';}
  }
 }else{a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'本场没有这项旧能力的原条件，不补发掌握或施法；');}
 a.rawContribution=a.selfGain;a.rawReduction=a.enemyReduction;
 const aid=r.windows.beamStabilize;
 if(aid&&aid.openedOrder<order&&a.selectedAbility==='STRIKE'&&id==='STRIKE'&&a.selfGain>0&&a.completedAtSeconds<aid.expiresAt&&sameEndpoint(r,aid)&&observed(r)&&aid.targetId===x.playerWeaponId&&x.clubHeld){r.windows.beamStabilize=null;a.appliedWindowId=aid.id;a.selfGain+=30;r.body.beamStabilizeSuccesses++;gainMastery(r,a,BEAM_STABILIZE);a.finiteResult='APPLIED';a.label+='同一原棍的这次真实普通打击消费一次稳持辅助30。';}
 return closeAction(a,r,rng);
}
export function resolveDivineHandEnemySlot(x:DivineHandCombatSource,r:DivineHandRuntime,planned:DivineHandEnemyIntent,order:number,rng:ActionRandomStream):DivineHandActionEvidence {
 const a=baseAction(r,'ENEMY',planned,order,rng);if(!active(r)){a.finiteResult='UNAVAILABLE';a.label='原人已离场、死亡或停战，停止新效果。';return closeAction(a,r,rng);}
 const power=DIVINE_HAND_POWERS.find(v=>v.id===planned),mark=planned==='BODY_MARK'||planned==='MENTAL_MARK';
 const actual:DivineHandEnemyIntent=power&&(r.body.enemySpirituality<power.cost||mark&&!r.materials.marks.some(m=>m.status==='HELD'))?'BODY_STRIKE':planned==='FEINT'&&r.feintUsed?'OBSERVE':planned;a.id=a.selectedAbility=actual;
 if(power&&actual===planned){r.body.enemySpirituality-=power.cost;r.body.powerUses[power.id]++;a.paidCost=power.cost;a.selfGain=power.selfGain;a.enemyReduction=power.enemyReduction;a.succeeded=true;
  if(mark){const token=r.materials.marks.find(m=>m.status==='HELD')!;token.status='SPENT';token.usedRound=x.round;a.consumedMarkId=token.id;a.attackKind=actual==='BODY_MARK'?'BODY':'MENTAL';if(observed(r))r.body.observations.push({power:actual as 'BODY_MARK'|'MENTAL_MARK',conditionVersion:r.root.conditionVersion,round:x.round,order,atSeconds:r.root.clockSeconds,paidCost:7});}
  else{r.feintUsed=true;const from=r.root.enemyCoordinate;r.root.enemyCoordinate=from===6?7:6;r.root.enemyTravelMetres++;a.travelMetres=1;a.travelPath=[from,r.root.enemyCoordinate];r.root.conditionVersion++;r.root.visibleBodyLine=false;for(const key of keys){if(r.windows[key])a.countered.push(r.windows[key]!.id);invalidate(r,key);}}
  a.label=`奥斯卡实际使用${power.label}，自己的灵性−${power.cost}${a.consumedMarkId?'，实耗一枚原印记':''}。`;
 }else if(actual==='BODY_STRIKE'){const from=r.root.enemyCoordinate;a.selfGain=20*a.physicalFactor;a.attackKind='BODY';a.travelMetres=2*(from-4);a.travelPath=[from,4,from];r.root.enemyTravelMetres+=a.travelMetres;a.succeeded=true;a.label=`奥斯卡持唯一原棍实际走近打击并退回，共${a.travelMetres}米；资源不足不施法、不补发印记。`;}
 else if(actual==='ACCIDENT'){a.selfGain=-22.5;a.label='对手判断偏差，−22.5，不重抽。';}else a.label='对手普通观察，没有新资源。';
 a.rawContribution=a.selfGain;a.rawReduction=a.enemyReduction;
 if(a.attackKind==='BODY'&&a.selfGain>0&&observed(r)&&usableArmor(r)){
  // One real impact meets one pending armor preparation; no stacked immunity.
  const available=(['armorConvergence','armorTemper'] as const).filter(k=>{const w=r.windows[k];return !!w&&w.openedOrder<order&&a.completedAtSeconds<w.expiresAt&&sameEndpoint(r,w)&&w.targetId===r.originals.site.armor!.id;}).sort((u,v)=>r.windows[u]!.openedOrder-r.windows[v]!.openedOrder);
  const key=available[0],w=key?r.windows[key]:null;if(key&&w){r.windows[key]=null;a.appliedWindowId=w.id;a.selfGain=Math.max(0,a.selfGain-w.magnitude);a.armorWear=5;r.originals.site.armor!.integrity-=5;a.finiteResult='APPLIED';if(key==='armorConvergence'){r.body.armorConvergenceSuccesses++;gainMastery(r,a,ARMOR_CONVERGENCE);}else{r.body.inheritedSuccesses.armorTemper++;gainMastery(r,a,ARMOR);}a.label+=`这一次未来身体冲击触及同一原甲，实际减势${a.rawContribution-a.selfGain}、完整度−5；既有伤势不变。`;}
 }
 return closeAction(a,r,rng);
}
export interface DivineHandRoundOutcome extends DivineHandCombatBody {
 targetId:typeof DIVINE_HAND_TARGET_ID;round:number;source:DivineHandCombatSource;stance:SliceStance;continuing:boolean;playerHealthAfter:number;playerMindAfter:number;playerSpiritualityAfter:number;playerInjuriesAfter:SliceInjury[];playerRiskAfter:number;materialsAfter:DivineHandMaterials;originalsAfter:DivineHandCombatOriginals;masteryAfter:Record<string,number>;rootAfter:DivineHandScene;elapsedSeconds:60;randomCursorAfter:number;playerActions:DivineHandActionEvidence[];enemyActions:DivineHandActionEvidence[];expiredWindows:DivineHandWindow[];windowsAfter:DivineHandWindows;
}
export type DivineHandResolution='CONTINUE'|'PLAYER_DEAD'|'ENEMY_DEAD'|'ENEMY_SURRENDERED'|'RETREATED';
function penalty(n:number,max:number){const f=n/max;return f>.75?0:f>.5?.05:f>.25?.1:.2;}
function base(core:number,h:number,m:number,s:number){return(1250+Math.min(core,250))*(1-Math.min(.4,penalty(h,100)+penalty(m,100)+penalty(s,120)));}
function weights(risk:number){const death=Math.min(100,5+Math.min(risk,10)*10),shifted=death-5;return{light:Math.max(0,65-shifted),heavy:Math.max(0,30-Math.max(0,shifted-65)),death};}
export function validDivineHandBody(b:DivineHandCombatBody):boolean {
 return integer(b.enemyHealth,0,100)&&integer(b.enemyMind,0,100)&&integer(b.enemySpirituality,0,120)&&integer(b.enemyRisk)&&Array.isArray(b.enemyInjuries)&&['RESISTING','SURRENDERED','DEAD'].includes(b.enemyStatus)&&(b.enemyStatus==='DEAD')===(b.enemyHealth===0)&&(b.enemyMind>0||b.enemyStatus!=='RESISTING')&&['HAND','YARD'].includes(b.weaponLocation)&&(b.enemyStatus==='RESISTING'||b.weaponLocation==='YARD')&&shape(b.powerUses,DIVINE_HAND_POWER_IDS)&&DIVINE_HAND_POWER_IDS.every(id=>integer(b.powerUses[id]))&&b.enemySpirituality===120-DIVINE_HAND_POWERS.reduce((n,p)=>n+p.cost*b.powerUses[p.id],0)&&b.powerUses.BODY_MARK+b.powerUses.MENTAL_MARK<=3&&integer(b.totalOwnerMindSpent)&&integer(b.beamStabilizeAttempts)&&integer(b.armorConvergenceAttempts)&&integer(b.armorTemperAttempts)&&integer(b.closeGuardAttempts)&&integer(b.beamStabilizeChecks,0,b.beamStabilizeAttempts)&&integer(b.armorConvergenceChecks,0,b.armorConvergenceAttempts)&&integer(b.beamStabilizeSuccesses,0,b.beamStabilizeChecks)&&integer(b.armorConvergenceSuccesses,0,b.armorConvergenceChecks)&&b.totalOwnerMindSpent===2*(b.beamStabilizeAttempts+b.armorConvergenceAttempts)&&shape(b.inheritedSuccesses,['armorTemper','closeGuard','silverThrust'])&&Object.values(b.inheritedSuccesses).every(n=>integer(n))&&b.inheritedSuccesses.armorTemper<=b.armorTemperAttempts&&b.inheritedSuccesses.closeGuard<=b.closeGuardAttempts&&Array.isArray(b.observations)&&b.observations.every((o,i)=>shape(o,['power','conditionVersion','round','order','atSeconds','paidCost'])&&['BODY_MARK','MENTAL_MARK'].includes(o.power)&&integer(o.conditionVersion,1,b.powerUses.FEINT+1)&&integer(o.round,1)&&integer(o.order,0,11)&&integer(o.atSeconds,4)&&o.paidCost===7&&(i===0||b.observations[i-1]!.atSeconds<o.atSeconds))&&b.observations.filter(o=>o.power==='BODY_MARK').length<=b.powerUses.BODY_MARK&&b.observations.filter(o=>o.power==='MENTAL_MARK').length<=b.powerUses.MENTAL_MARK;
}
export function validDivineHandInjuries(injuries:SliceInjury[],revision:number):boolean{return Array.isArray(injuries)&&new Set(injuries.map(i=>i.id)).size===injuries.length&&injuries.every(i=>shape(i,['id','severity','acquiredRevision','treatedRevision'])&&typeof i.id==='string'&&!!i.id&&['LIGHT','HEAVY'].includes(i.severity)&&integer(i.acquiredRevision,0,revision)&&(i.treatedRevision===null||integer(i.treatedRevision,i.acquiredRevision,revision)));}
const SOURCE_KEYS=['runId','revision','week','date','round','encounterId','targetId','attemptWeek','startHistoryIndex','targetName','targetAge','targetSequence','targetCore','actualBody','independentMind','playerBodyId','enemyWeapon','weaponOwner','ordinaryExit','pursuit','thirdPartiesInArea','policy','clubHeld','playerWeaponId','playerHealth','playerMind','playerSpirituality','playerInjuries','playerRisk','physique','perception','will','knowledge','mastery','preparation','root','materials','originals','body','randomSeed','randomCursor'];
export function validDivineHandCombatSource(x:DivineHandCombatSource):boolean {
 try{const p=x.root,prep=x.preparation,initial=prep.originalsAfter.site,current=x.originals.site;
 const expected=structuredClone(initial);expected.clockSeconds+=60*(x.round-1);expected.playerTravelMetres+=p.playerTravelMetres-4;expected.playerEnergy-=p.playerTravelMetres-4;if(expected.armor)expected.armor.integrity-=5*(x.body.armorConvergenceSuccesses+x.body.inheritedSuccesses.armorTemper);
 const gains:Record<string,number>={[ARMOR]:x.body.inheritedSuccesses.armorTemper,[BEARING]:x.body.inheritedSuccesses.closeGuard,[THRUST]:x.body.inheritedSuccesses.silverThrust,[BEAM_STABILIZE]:x.body.beamStabilizeSuccesses,[ARMOR_CONVERGENCE]:x.body.armorConvergenceSuccesses};
 return shape(x,SOURCE_KEYS)&&shape(x.body,Object.keys(initialDivineHandBody()))&&validateDivineHandPreparation(prep)&&typeof x.runId==='string'&&!!x.runId&&integer(x.revision)&&x.week===prep.week&&isValidGameDate(x.date)&&same(x.date,prep.date)&&integer(x.round,1)&&integer(x.startHistoryIndex)&&x.attemptWeek===x.week&&x.encounterId==='DIVINE_HAND_DISPUTE'&&x.targetId===DIVINE_HAND_TARGET_ID&&x.targetName==='奥斯卡·里德'&&x.targetAge===43&&x.targetSequence===1&&x.targetCore===24&&x.actualBody===true&&x.independentMind===true&&x.playerBodyId===`${x.runId}:body`&&x.enemyWeapon==='DH1-OSCAR-CLUB'&&x.weaponOwner===DIVINE_HAND_TARGET_ID&&x.ordinaryExit==='OPEN'&&x.pursuit===false&&x.thirdPartiesInArea===0&&DIVINE_HAND_POLICIES.includes(x.policy)&&x.clubHeld===prep.playerClubHeld&&x.playerWeaponId===prep.playerWeaponId&&x.clubHeld===(x.playerWeaponId!==null)&&
 [x.playerHealth,x.playerMind].every(n=>integer(n,1,100))&&integer(x.playerSpirituality,0,120)&&[x.physique,x.perception,x.will,x.knowledge].every(n=>integer(n,0,500))&&same({physique:x.physique,perception:x.perception,will:x.will,knowledge:x.knowledge},prep.after.coreStats)&&shape(x.mastery,[...DIVINE_HAND_INHERITED_SKILL_IDS,...DIVINE_HAND_NEW_ABILITY_IDS])&&Object.values(x.mastery).every(n=>integer(n,0,500))&&same(Object.keys(x.mastery).sort(),Object.keys(prep.after.mastery).sort())&&Object.keys(x.mastery).every(id=>x.mastery[id]===Math.min(500,prep.after.mastery[id]!+8*(gains[id]??0)))&&
 integer(x.playerRisk)&&validDivineHandInjuries(x.playerInjuries,x.revision)&&validDivineHandInjuries(x.body.enemyInjuries,x.revision)&&validDivineHandMaterials(x.materials)&&x.materials.weapon.location===x.body.weaponLocation&&x.materials.marks.filter(m=>m.status==='SPENT').length===x.body.powerUses.BODY_MARK+x.body.powerUses.MENTAL_MARK&&x.materials.marks.every(m=>m.usedRound===null||m.usedRound<x.round)&&x.body.beamStabilizeAttempts<=x.round-1&&x.body.armorConvergenceAttempts<=x.round-1&&x.body.armorTemperAttempts<=x.round-1&&x.body.closeGuardAttempts<=x.round-1&&x.body.powerUses.FEINT<=x.round-1&&x.body.inheritedSuccesses.silverThrust<=6*(x.round-1)&&
 validDivineHandCombatOriginals(x.originals)&&same(current,expected)&&current.playerEnergy>=4&&validDivineHandScene(p)&&p.siteId===DIVINE_HAND_SITE&&p.playerLocation==='YARD'&&p.observedSourceId===`${x.runId}:DH1-YARD:${prep.revision}`&&p.observationWeek===prep.week&&p.knownPlayerName===prep.playerName&&p.knownEnemyName==='奥斯卡·里德'&&p.clockSeconds===4+60*(x.round-1)&&p.conditionVersion===1+x.body.powerUses.FEINT&&p.enemyCoordinate===(x.body.powerUses.FEINT%2?7:6)&&p.enemyTravelMetres>=x.body.powerUses.FEINT&&validDivineHandBody(x.body)&&x.body.enemyStatus==='RESISTING'&&typeof x.randomSeed==='string'&&!!x.randomSeed&&x.randomSeed.length<=256&&integer(x.randomCursor)&&prep.runId===x.runId&&prep.randomSeed===x.randomSeed&&prep.randomCursor<=x.randomCursor&&prep.revision<=x.revision-x.round&&x.body.observations.every(o=>o.round<x.round&&o.atSeconds<p.clockSeconds);
 }catch{return false;}
}
export const validateDivineHandCombatSource=validDivineHandCombatSource;
/** Shared actual consequence resolver, exposed for declared isolated BODY/MENTAL
 * tests without seeking or replacing any campaign seed/cursor. */
export function resolveDivineHandConsequences(x:DivineHandCombatSource,r:DivineHandRuntime,players:DivineHandActionEvidence[],enemies:DivineHandActionEvidence[],winner:'PLAYER'|'ENEMY',retreat:SliceCombatRound['retreat'],rng:ActionRandomStream) {
  const b=r.body;
  let playerHealth = r.playerH, playerRisk = x.playerRisk, outcome: DivineHandResolution = retreat === 'SUCCESS' ? 'RETREATED' : b.enemyMind === 0 ? 'ENEMY_SURRENDERED' : 'CONTINUE';
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
export function replayDivineHandCombatRound(x:DivineHandCombatSource,stance:SliceStance):{round:SliceCombatRound;outcome:DivineHandResolution}{
 if(!validDivineHandCombatSource(x)||!['ATTACK','DEFEND','CONTROL','PREPARE','RETREAT'].includes(stance))throw new Error('缺少真实原来源。');
 const rng=new DeterministicActionRandomStream(x.randomSeed,x.randomCursor),r=createDivineHandRuntime(x),b=r.body;
 const playerCountRoll=rng.nextInt(1,100),enemyCountRoll=rng.nextInt(1,100),playerCount=divineHandActionCount(playerCountRoll),enemyCount=divineHandEnemyActionCount(enemyCountRoll);
 const first=x.round%2===1?'PLAYER':'ENEMY',order=first==='PLAYER'?['PLAYER','ENEMY'] as const:['ENEMY','PLAYER'] as const;
 const players:DivineHandActionEvidence[]=[],enemies:DivineHandActionEvidence[]=[],remaining={PLAYER:playerCount,ENEMY:enemyCount};let retreat:SliceCombatRound['retreat']='NONE';
 while(remaining.PLAYER>0||remaining.ENEMY>0)for(const actor of order){
  if(!remaining[actor])continue;
  if(actor==='PLAYER'&&stance==='RETREAT'){remaining.PLAYER=0;retreat=rng.nextInt(1,100)<=50?'SUCCESS':'FAILURE';if(retreat==='SUCCESS'){remaining.ENEMY=0;break;}continue;}
  remaining[actor]--;const index=players.length+enemies.length;
  if(actor==='PLAYER')players.push(resolveDivineHandPlayerSlot(x,r,drawDivineHandAbility(rng,null,stance),index,rng,stance));
  else enemies.push(resolveDivineHandEnemySlot(x,r,drawDivineHandEnemyAbility(rng),index,rng));
 }
 const sum=(a:DivineHandActionEvidence[],key:'selfGain'|'enemyReduction')=>a.reduce((n,v)=>n+v[key],0),core=x.physique*.45+x.perception*.20+x.will*.25+x.knowledge*.10;
 const playerAdvantage=Math.max(125,base(core,x.playerHealth,x.playerMind,x.playerSpirituality)+sum(players,'selfGain')-sum(enemies,'enemyReduction'));
 const enemyAdvantage=Math.max(125,base(x.targetCore,x.body.enemyHealth,x.body.enemyMind,x.body.enemySpirituality)+sum(enemies,'selfGain')-sum(players,'enemyReduction'));
 const winChance=playerAdvantage/(playerAdvantage+enemyAdvantage)*100,winner=retreat==='SUCCESS'?'ENEMY':rng.nextInt(1,1_000_000)<=winChance*10_000?'PLAYER':'ENEMY';
 const {playerHealth,playerRisk,outcome,playerInjuries,consequenceWeights,consequenceRoll,consequenceDomain}=resolveDivineHandConsequences(x,r,players,enemies,winner,retreat,rng);
 advanceDivineHandCombatClock(r,x.root.clockSeconds+60-r.root.clockSeconds);for(const key of keys)invalidate(r,key);
 if(b.enemyStatus!=='RESISTING')r.materials.weapon.location='YARD';b.weaponLocation=r.materials.weapon.location;
 const o:DivineHandRoundOutcome={...structuredClone(b),targetId:DIVINE_HAND_TARGET_ID,round:x.round,source:structuredClone(x),stance,continuing:outcome==='CONTINUE',playerHealthAfter:playerHealth,playerMindAfter:r.playerM,playerSpiritualityAfter:r.playerS,playerInjuriesAfter:playerInjuries,playerRiskAfter:playerRisk,materialsAfter:structuredClone(r.materials),originalsAfter:structuredClone(r.originals),masteryAfter:{...r.mastery},rootAfter:structuredClone(r.root),elapsedSeconds:60,randomCursorAfter:rng.cursor,playerActions:players,enemyActions:enemies,expiredWindows:r.expiredWindows,windowsAfter:structuredClone(r.windows)};
 const round:SliceCombatRound={round:x.round,stance,first,playerCount,enemyCount,playerCountRoll,enemyCountRoll,moves:[...players,...enemies].sort((a,b)=>a.order-b.order).map(a=>({actor:a.actor,label:a.label,selfGain:a.selfGain,enemyReduction:a.enemyReduction})),playerAdvantage,enemyAdvantage,winChance,winner,consequence:'',consequenceWeights,retreat,...(consequenceDomain===undefined?{}:{consequenceDomain}),...(consequenceRoll===undefined?{}:{consequenceRoll}),divineHandOutcome:o};round.consequence=divineHandCombatConsequence(round);return{round,outcome};
}
export function validateDivineHandRoundOutcome(v:unknown):v is DivineHandRoundOutcome{try{const o=v as DivineHandRoundOutcome;return !!o&&same(o,replayDivineHandCombatRound(o.source,o.stance).round.divineHandOutcome);}catch{return false;}}
export function validateDivineHandCombatRound(round:SliceCombatRound):boolean{try{const o=round.divineHandOutcome;return !!o&&same(round,replayDivineHandCombatRound(o.source,o.stance).round);}catch{return false;}}
export function nextDivineHandCombatSource(o:DivineHandRoundOutcome):DivineHandCombatSource{return{...structuredClone(o.source),revision:o.source.revision+1,round:o.round+1,playerHealth:o.playerHealthAfter,playerMind:o.playerMindAfter,playerSpirituality:Math.min(120,o.playerSpiritualityAfter+12),playerInjuries:structuredClone(o.playerInjuriesAfter),playerRisk:o.playerRiskAfter,root:structuredClone(o.rootAfter),body:combatBody(o),materials:structuredClone(o.materialsAfter),originals:structuredClone(o.originalsAfter),mastery:{...o.masteryAfter},randomCursor:o.randomCursorAfter};}
export function divineHandCombatConsequence(round:SliceCombatRound):string{
 const o=round.divineHandOutcome!,who=round.winner==='PLAYER'?'奥斯卡':'你';
 let text=round.retreat==='SUCCESS'?'撤离判定成功，将沿普通4米出口实际离开。':round.consequenceDomain==='MENTAL'?`${who}承受实际精神压力，精神减少10，没有身体伤口或身体风险。`:round.consequenceDomain==='BODY'?`${who}承受实际身体攻击，按共同伤势盘结算，实掷${round.consequenceRoll}/100（轻${round.consequenceWeights!.light}/重${round.consequenceWeights!.heavy}/死亡${round.consequenceWeights!.death}）。`:'本轮没有实际致伤来源，不掷身体伤势盘、不增加身体风险。';
 const attacks=round.winner==='PLAYER'?o.playerActions:o.enemyActions;if(round.consequenceDomain)text+=` 实际${round.consequenceDomain==='BODY'?'身体':'精神'}来源：${attacks.filter(a=>round.consequenceDomain==='BODY'?a.threatens:a.mentalPressure).map(a=>a.selectedAbility).join('、')}。`;
 text+=` 本人健康${o.source.playerHealth}→${o.playerHealthAfter}、精神${o.source.playerMind}→${o.playerMindAfter}；奥斯卡健康${o.source.body.enemyHealth}→${o.enemyHealth}、精神${o.source.body.enemyMind}→${o.enemyMind}。`;
 if(o.playerHealthAfter>0&&o.playerMindAfter===0)text+='本人精神耗尽，仍活着，沿普通出口离开。';
 if(o.playerHealthAfter===0)text+='本人的原身体真实死亡，本周目终结。';else if(o.enemyHealth===0)text+='奥斯卡原身体真实死亡，唯一原棍留地。';else if(o.enemyStatus==='SURRENDERED')text+='奥斯卡因实际伤势或精神耗尽停止抵抗，仍活着，原棍放下。';
 return text+' 本轮实际60秒，过期或未用窗口结束，已付费用不退。真实旧伤、新伤、原甲磨损、往返精力和有限原印记保留；西莉娅、埃文已在场外，马丁与旧猎物的结果不变。';
}
export function projectDivineHandCombat(s:SliceState){
 const e=s.divineHand.encounter,known=e.scene.knownEnemyName!==null,last=s.combat?.encounterId==='DIVINE_HAND_DISPUTE'?s.combat.lastRound?.divineHandOutcome:e.terminal?s.combatHistory[e.terminal.historyIndex]?.divineHandOutcome:null,site=s.glory.life.site;
 return{enemyName:known?'奥斯卡·里德（43岁）':null,targetId:e.targetId,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,weaponLocation:e.weaponLocation,powerUses:{...e.powerUses},policy:e.policy,scene:structuredClone(e.scene),materials:structuredClone(e.materials),remainingMarkIds:e.materials.marks.filter(m=>m.status==='HELD').map(m=>m.id).sort(),lastActionSequence:last?[...last.playerActions,...last.enemyActions].sort((a,b)=>a.order-b.order):[],windows:last?structuredClone(last.windowsAfter):{beamStabilize:null,armorConvergence:null,armorTemper:null},constants:DIVINE_HAND_COMBAT_CONSTANTS,countWheel:DIVINE_HAND_COUNT_WHEEL,enemyCountWheel:DIVINE_HAND_ENEMY_COUNT_WHEEL,abilityWheel:divineHandAbilityWheel(s,null),enemyAbilityWheel:DIVINE_HAND_ENEMY_ABILITY_WHEEL,facts:[
 '体45%、感20%、意25%、知10%；双方1至6动作10/15/25/25/15/10，基础1250、底125、灵性上限120，仅继续轮恢复12。',
 '接触稳持8灵性2精神、知识18；仅本人实际握持的同一原棍下一次普通打击辅助30。没有持棍则普通防备，不生成武器。',
 '护甲合势8灵性2精神、意志18；仅下一次可见身体冲击减势30，实际触及原甲时磨损5。不能保护精神、撤销旧伤或替同伴承担。',
 '两项各每轮一次；窗口20秒，失败仍付费，移动遮挡使窗口失效。只在实际应用后增长掌握，不返还过期费用。',
 `当前原甲完整度${site.armor?.integrity??0}，${site.armorWorn?'已穿用':'未穿用'}；西莉娅的安全垫余${site.pads.remaining}、位置${site.pads.location}，旧负载余${site.load.remainingLoads}；本场不取用、不补发。`,
 `原场地累计时钟${site.clockSeconds}秒、本人行程${site.playerTravelMetres}米、精力${site.playerEnergy}；每次移动实扣精力并留4精力普通离场。`,
 '三枚原印记共用有限库存；身体和精神攻击分开结算。对手侧移遮挡可解除尚未应用的窗口；避让须实际侧步才能重建可见条件。']};
}
