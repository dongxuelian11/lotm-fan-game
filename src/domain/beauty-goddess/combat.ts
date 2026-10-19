import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import { LIFE_GIVER_COUNT_WHEEL, lifeGiverActionCount, validateLifeGiverPapers, validateLifeGiverPartner } from '../life-giver/combat.js';
import type { WitchKingPaper } from '../witch-king/life.js';
import { getSummoningMasterPartner, type SummoningMasterPartner } from '../summoning-master/life.js';
import { validateLifeGiverBead, type LifeGiverBead } from '../life-giver/life.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { BEAUTY_GODDESS_TARGET_ID, BEAUTY_GODDESS_SITE, BEAUTY_GODDESS_POWER_IDS, BEAUTY_GODDESS_POWERS,
  combatBody, initialBeautyGoddessBody, hasBeautyGoddessDisputeOpponent, advanceBeautyGoddessLamp,
  validateBeautyGoddessPreparation, validBeautyGoddessMaterials, validBeautyGoddessScene,
  type BeautyGoddessCombatBody, type BeautyGoddessEnemyIntent, type BeautyGoddessPreparation,
  type BeautyGoddessMaterials, type BeautyGoddessScene, type BeautyGoddessPolicy } from './encounter.js';

/** Bounded S1 encounter, explicitly retaining the actual Moon S2 numeric profile. */
export const BEAUTY_GODDESS_COUNT_WHEEL = LIFE_GIVER_COUNT_WHEEL;
export const BEAUTY_GODDESS_ENEMY_COUNT_WHEEL = LIFE_GIVER_COUNT_WHEEL;
export const beautyGoddessActionCount = lifeGiverActionCount;
export const beautyGoddessEnemyActionCount = lifeGiverActionCount;
export const BEAUTY_GODDESS_COMBAT_CONSTANTS={weights:{physique:.35,perception:.25,will:.25,knowledge:.15},tier:1250,floor:125,maxSpirituality:120,continuingRecovery:12,enemyPhysique:24,selfPoiseCost:6,selfPoiseMindCost:2,selfPoiseBonus:25,moonformCost:8,moonformMindCost:3,moonformReduction:30,windowSeconds:30} as const;
export const SELF_POISE='moon.s1.self-poise', BOUNDED_MOONFORM='moon.s1.bounded-moonform';
export const BEAUTY_GODDESS_NEW_ABILITY_IDS=[SELF_POISE,BOUNDED_MOONFORM] as const;
export const BEAUTY_GODDESS_INHERITED_SKILL_IDS=['moon.s9.pharmacy','moon.s9.aura-observation','moon.s9.toxin-resistance','moon.s8.taming','moon.s8.animal-intent','moon.s8.physical-enhancement','moon.s7.blood-scent','moon.s7.abyss-shackles','moon.s7.dark-wings','moon.s7.regeneration','moon.s6.support-potions','moon.s6.potion-teaching','moon.s5.regional-moon','moon.s5.moonlight-step','moon.s5.moonlight-reassembly','moon.s4.moon-paper-substitute','moon.s4.blood-moon-arrow','moon.s3.bounded-summoning','moon.s3.guest-cooperation','moon.s2.bounded-vitality','moon.s2.shared-shelter'] as const;
export type BeautyGoddessMoveId=typeof BEAUTY_GODDESS_INHERITED_SKILL_IDS[number]|typeof BEAUTY_GODDESS_NEW_ABILITY_IDS[number]|'STRIKE'|'BLOCK'|'EVADE'|'OBSERVE'|'ACCIDENT';
const ARROW='moon.s4.blood-moon-arrow',PAPER='moon.s4.moon-paper-substitute',SHACKLES='moon.s7.abyss-shackles';
export const BEAUTY_GODDESS_ABILITIES:readonly{id:BeautyGoddessMoveId;label:string;weight:number;stance:SliceStance|null}[]=[
 {id:'STRIKE',label:'本人普通打击',weight:12,stance:'ATTACK'},{id:'BLOCK',label:'普通防备',weight:5,stance:'DEFEND'},{id:'EVADE',label:'普通避让',weight:5,stance:'DEFEND'},{id:'OBSERVE',label:'观察眼前动作并抬起实物灯罩',weight:4,stance:'PREPARE'},
 ...BEAUTY_GODDESS_INHERITED_SKILL_IDS.map(id=>({id,label:({[ARROW]:'继承血月之箭：4灵性、感知16',[PAPER]:'同一已备原纸：3灵性，减势35',[SHACKLES]:'继承有限枷锁：3灵性、意志16，减势14'} as Record<string,string>)[id]??'已有知识须实际材料与场景；不足则普通回退',weight:[ARROW,PAPER,SHACKLES].includes(id)?7:1,stance:(id===ARROW?'ATTACK':id===PAPER?'DEFEND':'PREPARE') as SliceStance})),
 {id:SELF_POISE,label:'辉映调息：6灵性2精神、意志18，后来可用本人动作加25',weight:14,stance:'PREPARE'},
 {id:BOUNDED_MOONFORM,label:'月辉定形：8灵性3精神与实付月片、感知18，待执行身体冲击减30',weight:14,stance:'CONTROL'},
 {id:'ACCIDENT',label:'判断失衡：−22.5',weight:3,stance:null},
];
export const BEAUTY_GODDESS_PLAYER_ABILITIES=BEAUTY_GODDESS_ABILITIES;
export const BEAUTY_GODDESS_ENEMY_ABILITY_WHEEL:readonly SliceWheelEntry[]=[
 {id:'MOON_BOLT',label:'可见月光冲击：7灵性与1原杆储能、身体贡献105',weight:25},{id:'MIND_PRESSURE',label:'有限精神压力：7灵性、精神贡献70',weight:20},
 {id:'WARD',label:'有限护持：6灵性、减势60',weight:15},{id:'ATTENTION',label:'集中抵抗：3灵性，一次抵抗70%',weight:10},{id:'SHADE',label:'遮住实物战场灯罩：4灵性',weight:10},
 {id:'BODY_STRIKE',label:'自有原杆普通打击20×身体',weight:15},{id:'OBSERVE',label:'普通观察',weight:3},{id:'ACCIDENT',label:'判断偏差−22.5',weight:2},
];
export const isBeautyGoddess=(s:SliceState)=>s.progression.pathwayId==='moon'&&s.progression.sequence===1;
const tickets=(stance:SliceStance|null)=>BEAUTY_GODDESS_ABILITIES.map(a=>a.weight*(a.stance===stance&&stance!==null?5:4));
export function beautyGoddessAbilityWheel(_s:SliceState,stance:SliceStance|null):SliceWheelEntry[]{const w=tickets(stance),total=w.reduce((n,v)=>n+v,0);return BEAUTY_GODDESS_ABILITIES.map((a,i)=>({id:a.id,label:a.label,weight:w[i]!/total*100}));}
export function drawBeautyGoddessAbility(rng:ActionRandomStream,_s:SliceState|null,stance:SliceStance|null):BeautyGoddessMoveId{const w=tickets(stance);let n=rng.nextInt(1,w.reduce((a,b)=>a+b,0));for(const[i,a]of BEAUTY_GODDESS_ABILITIES.entries()){n-=w[i]!;if(n<=0)return a.id;}throw new Error('行动盘无效。');}
export function drawBeautyGoddessEnemyAbility(rng:ActionRandomStream):BeautyGoddessEnemyIntent{let n=rng.nextInt(1,100);for(const a of BEAUTY_GODDESS_ENEMY_ABILITY_WHEEL){n-=a.weight;if(n<=0)return a.id as BeautyGoddessEnemyIntent;}throw new Error('对手行动盘无效。');}
const same=(a:unknown,b:unknown)=>a===b||(a!==undefined&&b!==undefined&&stableStringify(a)===stableStringify(b));
const integer=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER):n is number=>Number.isSafeInteger(n)&&(n as number)>=min&&(n as number)<=max;
const shape=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...keys].sort());
const physicalAt=(n:number)=>n>75?1:n>50?.95:n>25?.9:.8;
export interface BeautyGoddessCombatSource {
 runId:string;revision:number;week:number;date:PublicGameDate;round:number;encounterId:'BEAUTY_GODDESS_DISPUTE';targetId:typeof BEAUTY_GODDESS_TARGET_ID;
 attemptWeek:number;startHistoryIndex:number;targetName:'奥斯瓦尔德·里德';targetAge:46;targetCore:24;actualBody:true;independentMind:true;playerBodyId:string;
 enemyWeapon:'BG1-OSWALD-ROD';weaponOwner:typeof BEAUTY_GODDESS_TARGET_ID;ordinaryExit:'OPEN';pursuit:false;thirdPartiesInArea:0;policy:BeautyGoddessPolicy;clubHeld:boolean;
 playerHealth:number;playerMind:number;playerSpirituality:number;playerInjuries:SliceInjury[];playerRisk:number;physique:number;perception:number;will:number;knowledge:number;mastery:Record<string,number>;
 preparation:BeautyGoddessPreparation;root:BeautyGoddessScene;materials:BeautyGoddessMaterials;body:BeautyGoddessCombatBody;papers:WitchKingPaper[];partner:SummoningMasterPartner;oldBeads:LifeGiverBead[];randomSeed:string;randomCursor:number;
}
export function currentBeautyGoddessCombatSource(s:SliceState):BeautyGoddessCombatSource|null {
 if(!hasBeautyGoddessDisputeOpponent(s))return null;const e=s.beautyGoddess.encounter,c=s.combat!;return{runId:s.runId,revision:s.revision,week:s.week,date:{...s.date},round:c.round,encounterId:'BEAUTY_GODDESS_DISPUTE',targetId:BEAUTY_GODDESS_TARGET_ID,attemptWeek:e.attemptWeek!,startHistoryIndex:e.startHistoryIndex!,targetName:'奥斯瓦尔德·里德',targetAge:46,targetCore:24,actualBody:true,independentMind:true,playerBodyId:`${s.runId}:body`,enemyWeapon:'BG1-OSWALD-ROD',weaponOwner:BEAUTY_GODDESS_TARGET_ID,ordinaryExit:'OPEN',pursuit:false,thirdPartiesInArea:0,policy:e.policy,clubHeld:s.town.clubLocation==='HAND',playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,playerInjuries:structuredClone(s.injuries),playerRisk:s.injuryRisk,...s.character.coreStats,mastery:{...s.progression.mastery},preparation:structuredClone(e.preparation!),root:structuredClone(e.scene),materials:structuredClone(e.materials),body:combatBody(e),papers:structuredClone(s.witchKing.life.papers),partner:structuredClone(getSummoningMasterPartner(s)),oldBeads:structuredClone(s.lifeGiver.life.beads),randomSeed:s.random.seed,randomCursor:s.random.cursor};
}
export interface BeautyGoddessPendingAction {id:string;planned:BeautyGoddessEnemyIntent;actual:BeautyGoddessEnemyIntent;declaredAt:number;observedAt:number;observationSeconds:1;visibleIntent:string;bodyImpact:boolean}
export interface BeautyGoddessWindow {id:string;kind:'MOONFORM'|'SELF_POISE'|'ATTENTION';createdAt:number;expiresAt:number;targetActionId:string|null;magnitude:number;pieceId:string|null}
export interface BeautyGoddessWindows {moonform:BeautyGoddessWindow|null;selfPoise:BeautyGoddessWindow|null;attention:BeautyGoddessWindow|null}
export interface BeautyGoddessActionEvidence {
 order:number;actor:'PLAYER'|'ENEMY';id:string;planned:string;selectedAbility:string;fallbackReason:string|null;label:string;selfGain:number;enemyReduction:number;threatens:boolean;mentalPressure:boolean;attackKind:'NONE'|'BODY'|'MENTAL';rawContribution:number;rawReduction:number;
 paidCost:number;mindCost:number;physicalFactor:number;check:PublicCheckResult|null;resistanceRoll:number|null;resistanceChance:number|null;succeeded:boolean;
 finiteResult:'NONE'|'UNAVAILABLE'|'ALREADY_ATTEMPTED'|'INSUFFICIENT'|'FAILED'|'RESISTED'|'PENDING'|'APPLIED';windowsBefore:BeautyGoddessWindows;windowsAfter:BeautyGoddessWindows;pendingBefore:BeautyGoddessPendingAction|null;pendingAfter:BeautyGoddessPendingAction|null;masteryApplied:string[];countered:string[];
 paperId:string|null;pieceId:string|null;rodChargeSpent:number;materialsBefore:BeautyGoddessMaterials;materialsAfter:BeautyGoddessMaterials;atSeconds:number;elapsedSeconds:4;travelMetres:number;randomCursorBefore:number;randomCursorAfter:number;playerMindAfter:number;playerSpiritualityAfter:number;enemyMindAfter:number;enemySpiritualityAfter:number;
}
export interface BeautyGoddessRuntime {body:BeautyGoddessCombatBody;root:BeautyGoddessScene;materials:BeautyGoddessMaterials;papers:WitchKingPaper[];playerH:number;playerM:number;playerS:number;mastery:Record<string,number>;windows:BeautyGoddessWindows;expiredWindows:BeautyGoddessWindow[];pendingEnemyAction:BeautyGoddessPendingAction|null;moonformAttempted:boolean;selfPoiseAttempted:boolean}
export function createBeautyGoddessRuntime(x:BeautyGoddessCombatSource):BeautyGoddessRuntime{return{body:structuredClone(x.body),root:structuredClone(x.root),materials:structuredClone(x.materials),papers:structuredClone(x.papers),playerH:x.playerHealth,playerM:x.playerMind,playerS:x.playerSpirituality,mastery:{...x.mastery},windows:{moonform:null,selfPoise:null,attention:null},expiredWindows:[],pendingEnemyAction:null,moonformAttempted:false,selfPoiseAttempted:false};}
const actualLight=(r:BeautyGoddessRuntime)=>!!r.materials.lamp&&r.materials.lamp.location==='YARD'&&r.materials.lamp.lit&&r.materials.lamp.fuelSeconds>0&&!r.materials.lamp.blocked;
export function advanceBeautyGoddessCombatClock(r:BeautyGoddessRuntime,seconds:number):void {
 if(!integer(seconds))throw new Error('实际时间无效。');r.root.clockSeconds+=seconds;r.root.externalSeconds+=seconds;advanceBeautyGoddessLamp(r.materials,seconds);
 for(const key of ['moonform','selfPoise','attention'] as const){const w=r.windows[key];if(w&&(w.expiresAt<=r.root.clockSeconds||key==='moonform'&&!actualLight(r))){r.expiredWindows.push(structuredClone(w));r.windows[key]=null;}}
}
export function declareBeautyGoddessEnemyAction(x:BeautyGoddessCombatSource,r:BeautyGoddessRuntime,planned:BeautyGoddessEnemyIntent,index:number):BeautyGoddessPendingAction {
 if(r.pendingEnemyAction||!BEAUTY_GODDESS_ENEMY_ABILITY_WHEEL.some(a=>a.id===planned)||r.body.enemyMind<=0)throw new Error('不能覆盖待执行动作或替已停战者行动。');const power=BEAUTY_GODDESS_POWERS.find(p=>p.id===planned);
 const actual=power&&(r.body.enemySpirituality<power.cost||planned==='MOON_BOLT'&&r.materials.weapon.charge===0)?'BODY_STRIKE':planned==='ATTENTION'&&r.windows.attention||planned==='SHADE'&&(!r.materials.lamp||r.materials.lamp.blocked)?'OBSERVE':planned;
 const at=r.root.clockSeconds;advanceBeautyGoddessCombatClock(r,1);r.pendingEnemyAction={id:`${x.runId}:BG1-PENDING:${x.round}:${index}`,planned,actual,declaredAt:at,observedAt:r.root.clockSeconds,observationSeconds:1,bodyImpact:actual==='MOON_BOLT'||actual==='BODY_STRIKE',visibleIntent:actual==='MOON_BOLT'?'眼前同一月杆亮起一格储能，朝当前两米位置蓄起一次可见冲击':actual==='BODY_STRIKE'?'握紧自己的原杆准备普通打击':actual==='MIND_PRESSURE'?'集中精神准备一次有限压力':actual==='SHADE'?'伸手施力准备放下眼前战场灯罩':actual==='WARD'?'抬手准备有限护持':actual==='ATTENTION'?'收束注意准备抵抗':'眼前普通观察或判断偏差'};return structuredClone(r.pendingEnemyAction);
}
function baseAction(r:BeautyGoddessRuntime,actor:'PLAYER'|'ENEMY',id:string,order:number,rng:ActionRandomStream):BeautyGoddessActionEvidence{return{order,actor,id,planned:id,selectedAbility:id,fallbackReason:null,label:'',selfGain:0,enemyReduction:0,threatens:false,mentalPressure:false,attackKind:'NONE',rawContribution:0,rawReduction:0,paidCost:0,mindCost:0,physicalFactor:physicalAt(actor==='PLAYER'?r.playerH:r.body.enemyHealth),check:null,resistanceRoll:null,resistanceChance:null,succeeded:false,finiteResult:'NONE',windowsBefore:structuredClone(r.windows),windowsAfter:structuredClone(r.windows),pendingBefore:structuredClone(r.pendingEnemyAction),pendingAfter:null,masteryApplied:[],countered:[],paperId:null,pieceId:null,rodChargeSpent:0,materialsBefore:structuredClone(r.materials),materialsAfter:structuredClone(r.materials),atSeconds:r.root.clockSeconds,elapsedSeconds:4,travelMetres:0,randomCursorBefore:rng.cursor,randomCursorAfter:rng.cursor,playerMindAfter:r.playerM,playerSpiritualityAfter:r.playerS,enemyMindAfter:r.body.enemyMind,enemySpiritualityAfter:r.body.enemySpirituality};}
function closeAction(a:BeautyGoddessActionEvidence,r:BeautyGoddessRuntime,rng:ActionRandomStream){advanceBeautyGoddessCombatClock(r,4);a.windowsAfter=structuredClone(r.windows);a.pendingAfter=structuredClone(r.pendingEnemyAction);a.materialsAfter=structuredClone(r.materials);a.randomCursorAfter=rng.cursor;a.playerMindAfter=r.playerM;a.playerSpiritualityAfter=r.playerS;a.enemyMindAfter=r.body.enemyMind;a.enemySpiritualityAfter=r.body.enemySpirituality;a.threatens=a.attackKind==='BODY'&&a.selfGain>0;a.mentalPressure=a.attackKind==='MENTAL'&&a.selfGain>0;a.label+=` 实际4秒，本人灵性${r.playerS}、精神${r.playerM}，对手灵性${r.body.enemySpirituality}。`;return a;}
function ordinary(x:BeautyGoddessCombatSource,r:BeautyGoddessRuntime,a:BeautyGoddessActionEvidence,why:string,attack=false){a.selectedAbility=attack?'STRIKE':'BLOCK';a.fallbackReason=why||null;a.label=why+(attack?'本人用原身体普通打击。':'本人普通防备。');if(attack){a.selfGain=(x.clubHeld?16:12)*a.physicalFactor;a.attackKind='BODY';a.travelMetres=4;r.root.playerTravelMetres+=4;}else a.enemyReduction=10;}
function pay(r:BeautyGoddessRuntime,a:BeautyGoddessActionEvidence,s:number,m=0){if(r.playerS<s||r.playerM<=m)return false;r.playerS-=s;r.playerM-=m;r.body.totalOwnerMindSpent+=m;a.paidCost=s;a.mindCost=m;return true;}
function check(x:BeautyGoddessCombatSource,a:BeautyGoddessActionEvidence,ability:'will'|'perception',difficulty:number,rng:ActionRandomStream){a.check=resolveNormalCheck({ability,baseAbility:x[ability],difficulty,modifiers:[],roll:rng.nextInt(1,100)});a.succeeded=['SUCCESS','GREAT_SUCCESS'].includes(a.check.tier);a.label+=`${ability==='will'?'意志':'感知'}检定${a.check.roll}，${a.succeeded?'成功':'失败'}。`;return a.succeeded;}
function resist(r:BeautyGoddessRuntime,a:BeautyGoddessActionEvidence,rng:ActionRandomStream){const attention=r.windows.attention;a.resistanceChance=attention?70:30;a.resistanceRoll=rng.nextInt(1,100);if(attention){a.countered.push(attention.id);r.windows.attention=null;}if(a.resistanceRoll<=a.resistanceChance){a.succeeded=false;a.finiteResult='RESISTED';a.label+=`抵抗${a.resistanceRoll}≤${a.resistanceChance}，实际成本保留。`;return false;}a.label+=`抵抗${a.resistanceRoll}>${a.resistanceChance}。`;return true;}
function gainMastery(r:BeautyGoddessRuntime,a:BeautyGoddessActionEvidence,id:string){r.mastery[id]=Math.min(500,(r.mastery[id]??0)+8);a.masteryApplied.push(id);}
function window(r:BeautyGoddessRuntime,kind:BeautyGoddessWindow['kind'],order:number,magnitude:number,target:string|null=null,pieceId:string|null=null):BeautyGoddessWindow{return{id:`BG1-${kind}-${r.root.clockSeconds}-${order}`,kind,createdAt:r.root.clockSeconds,expiresAt:r.root.clockSeconds+30,targetActionId:target,magnitude,pieceId};}
export function resolveBeautyGoddessPlayerSlot(x:BeautyGoddessCombatSource,r:BeautyGoddessRuntime,id:BeautyGoddessMoveId,order:number,rng:ActionRandomStream):BeautyGoddessActionEvidence {
 if(!BEAUTY_GODDESS_ABILITIES.some(a=>a.id===id))throw new Error('未知本人动作。');const a=baseAction(r,'PLAYER',id,order,rng);let usable=false;
 if(x.policy==='ORDINARY'&&id.startsWith('moon.'))ordinary(x,r,a,'预先选择只作普通行动；');
 else if(id===SELF_POISE||id===BOUNDED_MOONFORM){
  const moon=id===BOUNDED_MOONFORM,allowed=x.policy==='ALL'||x.policy===(moon?'BOUNDED_MOONFORM':'SELF_POISE'),attempted=moon?r.moonformAttempted:r.selfPoiseAttempted,p=r.pendingEnemyAction,piece=r.materials.pieces.find(v=>v.status==='READY'&&v.location==='YARD');
  if(!allowed||moon&&(!p||!p.bodyImpact||p.observedAt>r.root.clockSeconds||!actualLight(r)||!piece)){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,!allowed?'预先策略未允许这项新能力；':'缺少已观察的待执行身体冲击、实亮未遮灯或未用同一月片；');}
  else if(attempted){a.finiteResult='ALREADY_ATTEMPTED';a.label='本轮已经实际尝试，不重骰、不延长窗口。';}
  else if(!pay(r,a,moon?8:6,moon?3:2)){a.finiteResult='INSUFFICIENT';a.label='灵性或精神不足，未施放，不重抽。';}
  else{if(moon){r.moonformAttempted=true;r.body.moonformAttempts++;piece!.status='SPENT';piece!.spentWeek=x.week;piece!.combatRound=x.round;a.pieceId=piece!.id;}else{r.selfPoiseAttempted=true;r.body.selfPoiseAttempts++;}
   a.label=moon?'同一实付月片用尽，原物保留；只稳定眼前一次尚未到来的身体冲击。':'只调整本人呼吸，等待后来一次真正可用的本人动作。';
   if(!check(x,a,moon?'perception':'will',18,rng))a.finiteResult='FAILED';
   else if(!moon||resist(r,a,rng)){if(moon)r.windows.moonform=window(r,'MOONFORM',order,30,p!.id,piece!.id);else r.windows.selfPoise=window(r,'SELF_POISE',order,25);a.finiteResult='PENDING';a.label+='窗口最多30秒，尚无实际效果或掌握奖励。';}
  }
 }else if(id==='STRIKE'){ordinary(x,r,a,'',true);usable=true;}
 else if(id==='BLOCK'||id==='EVADE'){a.enemyReduction=10;a.succeeded=true;usable=true;a.label='本人用原身体普通防备，有限减势10，不免伤。';}
 else if(id==='OBSERVE'){a.label='亲自观察眼前原人原物。';if(r.materials.lamp?.blocked){r.materials.lamp.blocked=false;a.label+='亲手抬起同一灯罩；不补灯油、不恢复已结束窗口。';}}
 else if(id==='ACCIDENT'){a.selfGain=-22.5;a.label='判断失衡，固定−22.5，不重抽。';}
 else if(id===ARROW){if(!pay(r,a,4))ordinary(x,r,a,'不足4灵性，未施放旧箭；',true);else if(check(x,a,'perception',16,rng)){a.selfGain=45*(.65+.35*(x.mastery[id]??0)/500);a.attackKind='BODY';usable=true;a.label+='继承血月之箭只产生当前有限优势，伤势仍走共同盘。';}}
 else if(id===PAPER){const paper=r.papers.find(v=>v.status==='PREPARED');if(!paper||!pay(r,a,3))ordinary(x,r,a,'没有同一实际PREPARED原纸或不足3灵性；');else{paper.status='CONSUMED';paper.consumedWeek=x.week;paper.consumedBy='COMBAT';paper.combatRound=x.round;a.paperId=paper.id;a.enemyReduction=35;a.succeeded=true;usable=true;a.label=`实耗3灵性与同一已备原纸${paper.id}，有限减势35，原记录保留。`;}}
 else if(id===SHACKLES){if(!pay(r,a,3))ordinary(x,r,a,'不足3灵性，未施放旧枷锁；');else if(check(x,a,'will',16,rng)){a.enemyReduction=14;usable=true;a.label+='继承有限枷锁只减势14，不删除动作、不控制想法或强迫投降。';}}
 else if(id==='moon.s3.bounded-summoning'||id==='moon.s3.guest-cooperation'||id==='moon.s2.bounded-vitality'||id==='moon.s2.shared-shelter')ordinary(x,r,a,'同一流灯留在原家，没有本场邀请或在场身体；旧珠也没有变为手中资源；');
 else{a.selectedAbility='OBSERVE';a.fallbackReason=id==='moon.s7.dark-wings'||id.startsWith('moon.s5.')?'当前不是原有月照庭院，不能把油灯冒充旧月照来源':'此旧知识所需的原药剂、原动物、诊疗或教学条件不在场';a.label=a.fallbackReason+'；保留原掌握，本槽普通观察，不造物、不治疗或免费恢复。';}
 a.rawContribution=a.selfGain;a.rawReduction=a.enemyReduction;
 const poised=r.windows.selfPoise;if(usable&&poised&&poised.createdAt<a.atSeconds&&poised.expiresAt>a.atSeconds){if(a.selfGain>0)a.selfGain+=25;else a.enemyReduction+=25;a.countered.push(poised.id);r.windows.selfPoise=null;r.body.selfPoiseSuccesses++;gainMastery(r,a,SELF_POISE);a.finiteResult='APPLIED';a.label+='已付辉映调息只增强这一次后来真正可用的本人动作25，窗口用尽。';}
 return closeAction(a,r,rng);
}
export function resolveBeautyGoddessEnemySlot(x:BeautyGoddessCombatSource,r:BeautyGoddessRuntime,planned:BeautyGoddessEnemyIntent,order:number,rng:ActionRandomStream):BeautyGoddessActionEvidence {
 if(!r.pendingEnemyAction)declareBeautyGoddessEnemyAction(x,r,planned,order);const p=r.pendingEnemyAction!;if(p.planned!==planned)throw new Error('不能替换已观察的待执行动作。');const a=baseAction(r,'ENEMY',p.actual,order,rng);a.planned=planned;a.selectedAbility=p.actual;const power=BEAUTY_GODDESS_POWERS.find(v=>v.id===p.actual);
 if(power){if(r.body.enemySpirituality<power.cost)throw new Error('已声明对手资源不一致。');r.body.enemySpirituality-=power.cost;r.body.powerUses[power.id]++;a.paidCost=power.cost;a.selfGain=power.selfGain;a.enemyReduction=power.enemyReduction;a.succeeded=true;
  if(power.id==='MOON_BOLT'){if(r.materials.weapon.charge<1)throw new Error('同一月杆已无储能。');r.materials.weapon.charge--;a.rodChargeSpent=1;a.attackKind='BODY';}
  if(power.id==='MIND_PRESSURE')a.attackKind='MENTAL';if(power.id==='ATTENTION')r.windows.attention=window(r,'ATTENTION',order,70);
  if(power.id==='SHADE'&&r.materials.lamp){r.materials.lamp.blocked=true;if(r.windows.moonform){a.countered.push(r.windows.moonform.id);r.expiredWindows.push(structuredClone(r.windows.moonform));r.windows.moonform=null;}}
  a.label=`奥斯瓦尔德实际施放${power.label}，独立灵性−${power.cost}。`;
 }else if(p.actual==='BODY_STRIKE'){a.selfGain=20*a.physicalFactor;a.attackKind='BODY';a.label='奥斯瓦尔德用自己的唯一原月杆普通打击；储能或灵性不足时不施法、不重抽。';}
 else if(p.actual==='ACCIDENT'){a.selfGain=-22.5;a.label='对手判断偏差，−22.5，不重抽。';}else a.label='对手普通观察，没有额外资源。';
 a.rawContribution=a.selfGain;a.rawReduction=a.enemyReduction;
 const moon=r.windows.moonform;if(moon&&moon.targetActionId===p.id&&moon.expiresAt>a.atSeconds){r.windows.moonform=null;a.countered.push(moon.id);const reduction=p.bodyImpact&&actualLight(r)?Math.min(30,Math.max(0,a.selfGain)):0;a.selfGain-=reduction;if(reduction>0){r.body.moonformSuccesses++;gainMastery(r,a,BOUNDED_MOONFORM);a.finiteResult='APPLIED';a.label+=`先前实付月辉定形只使同一可见待执行身体冲击减少${reduction}，不免疫精神压力或后续攻击。`;}}
 r.pendingEnemyAction=null;return closeAction(a,r,rng);
}
export interface BeautyGoddessRoundOutcome extends BeautyGoddessCombatBody {
 targetId:typeof BEAUTY_GODDESS_TARGET_ID;round:number;source:BeautyGoddessCombatSource;stance:SliceStance;continuing:boolean;playerHealthAfter:number;playerMindAfter:number;playerSpiritualityAfter:number;playerInjuriesAfter:SliceInjury[];playerRiskAfter:number;materialsAfter:BeautyGoddessMaterials;papers:WitchKingPaper[];masteryAfter:Record<string,number>;rootAfter:BeautyGoddessScene;elapsedSeconds:60;randomCursorAfter:number;playerActions:BeautyGoddessActionEvidence[];enemyActions:BeautyGoddessActionEvidence[];expiredWindows:BeautyGoddessWindow[];windowsAfter:BeautyGoddessWindows;pendingEnemyActionAfter:null;
}
export type BeautyGoddessResolution='CONTINUE'|'PLAYER_DEAD'|'ENEMY_DEAD'|'ENEMY_SURRENDERED'|'RETREATED';
function penalty(n:number,max:number){const f=n/max;return f>.75?0:f>.5?.05:f>.25?.1:.2;}
function base(core:number,h:number,m:number,s:number){return(1250+Math.min(core,250))*(1-Math.min(.4,penalty(h,100)+penalty(m,100)+penalty(s,120)));}
function weights(risk:number){const death=Math.min(100,5+Math.min(risk,10)*10),shifted=death-5;return{light:Math.max(0,65-shifted),heavy:Math.max(0,30-Math.max(0,shifted-65)),death};}
export function validBeautyGoddessBody(b:BeautyGoddessCombatBody):boolean{return integer(b.enemyHealth,0,100)&&integer(b.enemyMind,0,100)&&integer(b.enemySpirituality,0,120)&&integer(b.enemyRisk)&&Array.isArray(b.enemyInjuries)&&['RESISTING','SURRENDERED','DEAD'].includes(b.enemyStatus)&&(b.enemyStatus==='DEAD')===(b.enemyHealth===0)&&(b.enemyMind>0||b.enemyStatus!=='RESISTING')&&['HAND','YARD'].includes(b.weaponLocation)&&(b.enemyStatus==='RESISTING'||b.weaponLocation==='YARD')&&shape(b.powerUses,BEAUTY_GODDESS_POWER_IDS)&&BEAUTY_GODDESS_POWER_IDS.every(id=>integer(b.powerUses[id]))&&b.enemySpirituality===120-BEAUTY_GODDESS_POWERS.reduce((n,p)=>n+p.cost*b.powerUses[p.id],0)&&b.powerUses.MOON_BOLT<=4&&integer(b.totalOwnerMindSpent)&&integer(b.moonformAttempts,0,3)&&integer(b.selfPoiseAttempts)&&integer(b.moonformSuccesses,0,b.moonformAttempts)&&integer(b.selfPoiseSuccesses,0,b.selfPoiseAttempts)&&b.totalOwnerMindSpent===3*b.moonformAttempts+2*b.selfPoiseAttempts;}
export function validBeautyGoddessInjuries(injuries:SliceInjury[],revision:number):boolean{return Array.isArray(injuries)&&new Set(injuries.map(i=>i.id)).size===injuries.length&&injuries.every(i=>shape(i,['id','severity','acquiredRevision','treatedRevision'])&&typeof i.id==='string'&&!!i.id&&['LIGHT','HEAVY'].includes(i.severity)&&integer(i.acquiredRevision,0,revision)&&(i.treatedRevision===null||integer(i.treatedRevision,i.acquiredRevision,revision)));}
const SOURCE_KEYS=['runId','revision','week','date','round','encounterId','targetId','attemptWeek','startHistoryIndex','targetName','targetAge','targetCore','actualBody','independentMind','playerBodyId','enemyWeapon','weaponOwner','ordinaryExit','pursuit','thirdPartiesInArea','policy','clubHeld','playerHealth','playerMind','playerSpirituality','playerInjuries','playerRisk','physique','perception','will','knowledge','mastery','preparation','root','materials','body','papers','partner','oldBeads','randomSeed','randomCursor'];
export function validBeautyGoddessCombatSource(x:BeautyGoddessCombatSource):boolean {
 try{const p=x.root,prep=x.preparation,l=x.materials.lamp,initialLamp=prep.materialsAfter.lamp;
 return shape(x,SOURCE_KEYS)&&shape(x.body,Object.keys(initialBeautyGoddessBody()))&&validateBeautyGoddessPreparation(prep)&&typeof x.runId==='string'&&!!x.runId&&integer(x.revision)&&x.week===prep.week&&isValidGameDate(x.date)&&same(x.date,prep.date)&&integer(x.round,1)&&integer(x.startHistoryIndex)&&x.attemptWeek===x.week&&x.encounterId==='BEAUTY_GODDESS_DISPUTE'&&x.targetId===BEAUTY_GODDESS_TARGET_ID&&x.targetName==='奥斯瓦尔德·里德'&&x.targetAge===46&&x.targetCore===24&&x.actualBody===true&&x.independentMind===true&&x.playerBodyId===`${x.runId}:body`&&x.enemyWeapon==='BG1-OSWALD-ROD'&&x.weaponOwner===BEAUTY_GODDESS_TARGET_ID&&x.ordinaryExit==='OPEN'&&x.pursuit===false&&x.thirdPartiesInArea===0&&['INHERITED_ONLY','SELF_POISE','BOUNDED_MOONFORM','ALL','ORDINARY'].includes(x.policy)&&x.clubHeld===prep.playerClubHeld&&
 [x.playerHealth,x.playerMind].every(n=>integer(n,1,100))&&integer(x.playerSpirituality,0,120)&&[x.physique,x.perception,x.will,x.knowledge].every(n=>integer(n,0,500))&&same({physique:x.physique,perception:x.perception,will:x.will,knowledge:x.knowledge},prep.after.coreStats)&&shape(x.mastery,[...BEAUTY_GODDESS_INHERITED_SKILL_IDS,...BEAUTY_GODDESS_NEW_ABILITY_IDS])&&same(Object.keys(x.mastery).sort(),Object.keys(prep.after.mastery).sort())&&Object.values(x.mastery).every(n=>integer(n,0,500))&&Object.entries(prep.after.mastery).every(([id,v])=>(BEAUTY_GODDESS_NEW_ABILITY_IDS as readonly string[]).includes(id)?x.mastery[id]!>=v:x.mastery[id]===v)&&
 integer(x.playerRisk)&&validBeautyGoddessInjuries(x.playerInjuries,x.revision)&&validBeautyGoddessInjuries(x.body.enemyInjuries,x.revision)&&validBeautyGoddessMaterials(x.materials)&&x.materials.weapon.location===x.body.weaponLocation&&x.materials.weapon.charge===4-x.body.powerUses.MOON_BOLT&&
 (initialLamp===null?l===null:!!l&&same({...l,fuelSeconds:initialLamp.fuelSeconds,lit:initialLamp.lit,blocked:initialLamp.blocked},initialLamp)&&l.fuelSeconds===Math.max(0,initialLamp.fuelSeconds-60*(x.round-1))&&l.lit===(l.fuelSeconds>0))&&x.materials.pieces.length===prep.materialsAfter.pieces.length&&x.materials.pieces.every((q,i)=>{const original=prep.materialsAfter.pieces[i]!;return same({...q,status:original.status,spentWeek:original.spentWeek,combatRound:original.combatRound},original)&&(q.status==='READY'||q.spentWeek===x.week&&integer(q.combatRound,1,x.round-1));})&&x.body.moonformAttempts===x.materials.pieces.filter(q=>q.status==='SPENT').length&&
 validBeautyGoddessScene(p)&&p.siteId===BEAUTY_GODDESS_SITE&&p.playerLocation==='YARD'&&p.observedSourceId===`${x.runId}:BG1-YARD:${prep.revision}`&&p.observationWeek===prep.week&&p.knownPlayerName===prep.playerName&&p.knownEnemyName==='奥斯瓦尔德·里德'&&p.clockSeconds===4+60*(x.round-1)&&validBeautyGoddessBody(x.body)&&x.body.enemyStatus==='RESISTING'&&x.body.enemyMind>0&&typeof x.randomSeed==='string'&&!!x.randomSeed&&integer(x.randomCursor)&&prep.runId===x.runId&&prep.randomSeed===x.randomSeed&&prep.randomCursor<=x.randomCursor&&prep.revision<=x.revision-x.round&&
 validateLifeGiverPartner(x.partner,x.week)&&x.partner.location==='HOME'&&same(x.partner,prep.partner)&&Array.isArray(x.oldBeads)&&x.oldBeads.every(b=>validateLifeGiverBead(b,x.week))&&same(x.oldBeads,prep.oldBeads)&&validateLifeGiverPapers(x.papers,x.week)&&x.papers.length===prep.papers.length&&x.papers.every((q,i)=>{const original=prep.papers[i]!;return same(q,original)||original.status==='PREPARED'&&q.status==='CONSUMED'&&q.consumedWeek===x.week&&q.consumedBy==='COMBAT'&&integer(q.combatRound,1,x.round-1)&&same({...q,status:original.status,consumedWeek:original.consumedWeek,consumedBy:original.consumedBy,combatRound:original.combatRound},original);});
 }catch{return false;}
}
export const validateBeautyGoddessCombatSource=validBeautyGoddessCombatSource;
export function replayBeautyGoddessCombatRound(x: BeautyGoddessCombatSource, stance: SliceStance): { round: SliceCombatRound; outcome: BeautyGoddessResolution } {
  if (!validBeautyGoddessCombatSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new Error('缺少真实原来源。');
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = createBeautyGoddessRuntime(x), b = r.body;
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = beautyGoddessActionCount(playerCountRoll), enemyCount = beautyGoddessEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: BeautyGoddessActionEvidence[] = [], enemies: BeautyGoddessActionEvidence[] = [], remaining = { PLAYER: playerCount, ENEMY: enemyCount }; let retreat: SliceCombatRound['retreat'] = 'NONE';
  if (b.enemyMind === 0) remaining.PLAYER = remaining.ENEMY = 0;
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) for (const actor of order) {
    if (!remaining[actor]) continue;
    if (actor === 'PLAYER' && stance === 'RETREAT') { remaining.PLAYER = 0; retreat = rng.nextInt(1, 100) <= 50 ? 'SUCCESS' : 'FAILURE'; if (retreat === 'SUCCESS') { remaining.ENEMY = 0; break; } continue; }
    if (remaining.ENEMY > 0 && !r.pendingEnemyAction) declareBeautyGoddessEnemyAction(x, r, drawBeautyGoddessEnemyAbility(rng), enemies.length);
    remaining[actor]--; const index = players.length + enemies.length;
    if (actor === 'PLAYER') players.push(resolveBeautyGoddessPlayerSlot(x, r, drawBeautyGoddessAbility(rng, null, stance), index, rng));
    else enemies.push(resolveBeautyGoddessEnemySlot(x, r, r.pendingEnemyAction!.planned, index, rng));
    if (b.enemyMind === 0) { b.enemyStatus = 'SURRENDERED'; remaining.PLAYER = remaining.ENEMY = 0; break; }
  }
  const sum = (a: BeautyGoddessActionEvidence[], key: 'selfGain' | 'enemyReduction') => a.reduce((n, v) => n + v[key], 0);
  const core = x.physique * .35 + x.perception * .25 + x.will * .25 + x.knowledge * .15;
  const playerAdvantage = Math.max(125, base(core, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, base(x.targetCore, x.body.enemyHealth, x.body.enemyMind, x.body.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction'));
  const winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100, winner = retreat === 'SUCCESS' ? 'ENEMY' : b.enemyMind === 0 ? 'PLAYER' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  let playerHealth = r.playerH, playerRisk = x.playerRisk, outcome: BeautyGoddessResolution = retreat === 'SUCCESS' ? 'RETREATED' : b.enemyMind === 0 ? 'ENEMY_SURRENDERED' : 'CONTINUE';
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
  advanceBeautyGoddessCombatClock(r, x.root.clockSeconds + 60 - r.root.clockSeconds);
  for (const key of ['moonform','selfPoise','attention'] as const) { if (r.windows[key]) r.expiredWindows.push(structuredClone(r.windows[key]!)); r.windows[key] = null; }
  r.pendingEnemyAction = null; if (b.enemyStatus !== 'RESISTING') r.materials.weapon.location = 'YARD'; b.weaponLocation = r.materials.weapon.location;
  const o: BeautyGoddessRoundOutcome = { ...structuredClone(b), targetId: BEAUTY_GODDESS_TARGET_ID, round: x.round, source: structuredClone(x), stance, continuing: outcome === 'CONTINUE',
    playerHealthAfter: playerHealth, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, playerInjuriesAfter: playerInjuries, playerRiskAfter: playerRisk, materialsAfter: structuredClone(r.materials), papers: structuredClone(r.papers), masteryAfter: { ...r.mastery },
    rootAfter: structuredClone(r.root), elapsedSeconds: 60, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies, expiredWindows: r.expiredWindows,
    windowsAfter: structuredClone(r.windows), pendingEnemyActionAfter: null };
  const round: SliceCombatRound = { round: x.round, stance, first, playerCount, enemyCount, playerCountRoll, enemyCountRoll,
    moves: [...players, ...enemies].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })),
    playerAdvantage, enemyAdvantage, winChance, winner, consequence: '', consequenceWeights, retreat, ...(consequenceDomain === undefined ? {} : { consequenceDomain }), ...(consequenceRoll === undefined ? {} : { consequenceRoll }), beautyGoddessOutcome: o };
  round.consequence = beautyGoddessCombatConsequence(round); return { round, outcome };
}
export function validateBeautyGoddessRoundOutcome(v: unknown): v is BeautyGoddessRoundOutcome { try { const o = v as BeautyGoddessRoundOutcome; return !!o && same(o, replayBeautyGoddessCombatRound(o.source, o.stance).round.beautyGoddessOutcome); } catch { return false; } }
export function validateBeautyGoddessCombatRound(round: SliceCombatRound): boolean { try { const o = round.beautyGoddessOutcome; return !!o && same(round, replayBeautyGoddessCombatRound(o.source, o.stance).round); } catch { return false; } }
export function nextBeautyGoddessCombatSource(o: BeautyGoddessRoundOutcome): BeautyGoddessCombatSource {
  return { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter,
    playerSpirituality: Math.min(120, o.playerSpiritualityAfter + 12), playerInjuries: structuredClone(o.playerInjuriesAfter), playerRisk: o.playerRiskAfter,
    root: structuredClone(o.rootAfter), body: combatBody(o), materials: structuredClone(o.materialsAfter), papers: structuredClone(o.papers), mastery: { ...o.masteryAfter }, randomCursor: o.randomCursorAfter };
}
export function beautyGoddessCombatConsequence(round: SliceCombatRound): string {
  const o = round.beautyGoddessOutcome!, who = round.winner === 'PLAYER' ? '奥斯瓦尔德' : '你';
  let text = round.retreat === 'SUCCESS' ? '撤离判定成功，将沿普通4米出口实际离开。' : round.consequenceDomain === 'MENTAL' ? `${who}承受实际精神压力，精神减少10，没有新增身体伤口或身体风险。` : round.consequenceDomain === 'BODY' ? `${who}承受实际物理攻击，按共同伤势盘结算，实掷${round.consequenceRoll}/100（轻${round.consequenceWeights!.light}/重${round.consequenceWeights!.heavy}/死亡${round.consequenceWeights!.death}）。` : '本轮没有实际致伤来源，不掷身体伤势盘、不增加身体风险。';
  const attacks = round.winner === 'PLAYER' ? o.playerActions : o.enemyActions;
  if (round.consequenceDomain) text += ` 实际${round.consequenceDomain === 'BODY' ? '身体' : '精神'}来源：${attacks.filter(a => round.consequenceDomain === 'BODY' ? a.threatens : a.mentalPressure).map(a => a.selectedAbility).join('、')}。`;
  text += ` 本人健康${o.source.playerHealth}→${o.playerHealthAfter}、精神${o.source.playerMind}→${o.playerMindAfter}；奥斯瓦尔德健康${o.source.body.enemyHealth}→${o.enemyHealth}、精神${o.source.body.enemyMind}→${o.enemyMind}。`;
  if (o.playerHealthAfter > 0 && o.playerMindAfter === 0) text += '本人精神耗尽，仍活着，停止抵抗后沿普通出口离开。';
  if (o.playerHealthAfter === 0) text += '本人的原身体真实死亡，本周目终结。'; else if (o.enemyHealth === 0) text += '奥斯瓦尔德原身体真实死亡，唯一原杆留地。'; else if (o.enemyStatus === 'SURRENDERED') text += '奥斯瓦尔德因实际伤势或精神耗尽自主停止抵抗，仍活着，原杆放在地面。';
  return text + ' 本轮实际60秒；未使用窗口到时结束，已经花费的灵性与精神不退。同一原件资源保留，流灯、达莉娅与旧遭遇人物均不在场。';
}

export function projectBeautyGoddessCombat(s:SliceState){const e=s.beautyGoddess.encounter,last=s.combat?.encounterId==='BEAUTY_GODDESS_DISPUTE'?s.combat.lastRound?.beautyGoddessOutcome:e.terminal?s.combatHistory[e.terminal.historyIndex]?.beautyGoddessOutcome:null;return{enemyName:'奥斯瓦尔德·里德（46岁）',targetId:e.targetId,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,weaponLocation:e.weaponLocation,powerUses:{...e.powerUses},policy:e.policy,materials:structuredClone(e.materials),partner:structuredClone(getSummoningMasterPartner(s)),papers:structuredClone(s.witchKing.life.papers),lastActionSequence:last?[...last.playerActions,...last.enemyActions].sort((a,b)=>a.order-b.order):[],constants:BEAUTY_GODDESS_COMBAT_CONSTANTS,countWheel:BEAUTY_GODDESS_COUNT_WHEEL,enemyCountWheel:BEAUTY_GODDESS_ENEMY_COUNT_WHEEL,abilityWheel:beautyGoddessAbilityWheel(s,null),enemyAbilityWheel:BEAUTY_GODDESS_ENEMY_ABILITY_WHEEL,facts:['体35%、感25%、意25%、知15%；双方1至6动作10/15/25/25/15/10，基础1250、底125、上限120，仅继续轮恢复12。','辉映调息只增强后来一次真正可用本人动作；月辉定形只削弱实亮灯下一次可见待执行身体冲击。','每轮各一次，失败照付；未应用窗口不增长掌握，原月片用尽后仍在原处。','流灯仍在原家，原纸原珠照实际状态；缺少原物就普通回退。','身体攻击走共同伤势盘，精神压力只扣精神；精神耗尽活着停战，身体死亡终结本周目。']};}
/** Exact old-paper hook for the sole original paper validator. */
export function beautyGoddessConsumedPaperEvidence(s:SliceState,paper:WitchKingPaper):boolean{const e=s.beautyGoddess?.encounter;if(!e||e.attemptWeek!==paper.consumedWeek||e.startHistoryIndex===null||paper.consumedBy!=='COMBAT'||paper.combatRound===null)return false;const end=e.terminal?e.terminal.historyIndex+1:s.combatHistory.length;return s.combatHistory.slice(e.startHistoryIndex,end).some(r=>r.round===paper.combatRound&&validateBeautyGoddessCombatRound(r)&&r.beautyGoddessOutcome!.playerActions.some(a=>a.selectedAbility===PAPER&&a.paperId===paper.id&&a.paidCost===3));}
