import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { actualElderBorrowedSpirit } from '../elder/combat.js';
import type { ElderOperationState } from '../elder/life.js';
import type { ShepherdGrazing } from '../shepherd/types.js';
import type { RoseBishopReserve } from '../rose-bishop/types.js';
import type { ThreeHeadedTemplarSpiritId, ThreeHeadedTemplarSpiritMethod } from '../three-headed-templar/life.js';
import { SECRET_SUPPLICANT_ABILITY_IDS } from '../secret-supplicant/types.js';
import { LISTENER_ABILITY_IDS } from '../listener/types.js';
import { SHADOW_ASCETIC_ABILITY_IDS } from '../shadow-ascetic/types.js';
import { ROSE_BISHOP_ABILITY_IDS } from '../rose-bishop/types.js';
import { SHEPHERD_ABILITY_IDS } from '../shepherd/types.js';
import { BLACK_KNIGHT_ABILITY_IDS } from '../black-knight/types.js';
import { THREE_HEADED_TEMPLAR_ABILITY_IDS } from '../three-headed-templar/types.js';
import { ELDER_ABILITY_IDS } from '../elder/types.js';
import { validateDarkAngelCurrentSite } from './life.js';
import type { DarkAngelOriginals, DarkAngelSite } from './types.js';
import { DARK_ANGEL_TARGET_ID, DARK_ANGEL_SITE, DARK_ANGEL_POWER_IDS, DARK_ANGEL_POWERS, DARK_ANGEL_POLICIES,
  hasDarkAngelDisputeOpponent, validateDarkAngelPreparation, validDarkAngelCombatNote, validDarkAngelMarks, darkAngelEncounterBudget, darkAngelFinanceSnapshot,
  type DarkAngelPreparation, type DarkAngelEnemyIntent, type DarkAngelPowerId, type DarkAngelPolicy, type DarkAngelCombatNote, type DarkAngelMark, type DarkAngelForceReceipt,
  type DarkAngelEncounterBudget, type DarkAngelFinanceSnapshot } from './encounter.js';

export const DARK_ANGEL_COUNT_WHEEL=PYROMANIAC_COUNT_WHEEL;
export const DARK_ANGEL_ENEMY_COUNT_WHEEL=PYROMANIAC_COUNT_WHEEL;
export const darkAngelActionCount=pyromaniacActionCount;
export const darkAngelEnemyActionCount=pyromaniacActionCount;
const WHISPER='hanged-man.s2.low-whisper', CHORUS='hanged-man.s2.focused-chorus', BLADE='hanged-man.s4.flesh-soul-blade', BODY='BODY_FOLLOWUP', WARD='BORROWED_WARD', SHADOW='hanged-man.s4.shadow-command', ART='hanged-man.s5.borrowed-arts';
export const GUIDANCE='hanged-man.s1.single-spirit-guidance', SHELTER='hanged-man.s1.single-spirit-shelter';
const INHERITED_IDS=[...SECRET_SUPPLICANT_ABILITY_IDS,...LISTENER_ABILITY_IDS,...SHADOW_ASCETIC_ABILITY_IDS,...ROSE_BISHOP_ABILITY_IDS,...SHEPHERD_ABILITY_IDS,...BLACK_KNIGHT_ABILITY_IDS,...THREE_HEADED_TEMPLAR_ABILITY_IDS,...ELDER_ABILITY_IDS];
export type DarkAngelMoveId=typeof WHISPER|typeof CHORUS|typeof BLADE|typeof BODY|typeof WARD|typeof SHADOW|typeof ART|typeof GUIDANCE|typeof SHELTER|'ACCIDENT';
/** The eight actual Elder slots retain 30/15/20/20/10/5/20/20 tickets; two finite windows add20 each. */
const ABILITIES:readonly {id:DarkAngelMoveId;label:string;weight:number;stance:SliceStance|null}[]=[
 {id:BLADE,label:'旧灵肉之刃5灵性／资源不足用原棍或身体',weight:30,stance:'ATTACK'},
 {id:BODY,label:'继承身体次击27.3×旧血肉掌握×实际身体',weight:15,stance:'ATTACK'},
 {id:WARD,label:'旧伊芮斯防护2灵性／3灵性1原储备修复／普通格挡',weight:20,stance:'DEFEND'},
 {id:SHADOW,label:'旧影限制4灵性，知识18；下一普通身体打击减半',weight:20,stance:'CONTROL'},
 {id:ART,label:'旧伊芮斯实际已选微力触动2灵性／普通复核',weight:10,stance:'PREPARE'},
 {id:'ACCIDENT',label:'动作偏差，优势−22.5',weight:5,stance:null},
 {id:WHISPER,label:'低语6灵性2精神，可抵抗；随后一次攻势减35以内',weight:20,stance:'CONTROL'},
 {id:CHORUS,label:'单灵聚声6本人灵性2精神3原灵灵性；失败总计4精神',weight:20,stance:'PREPARE'},
 {id:GUIDANCE,label:'单灵引导8灵性2精神3原灵灵性；20秒内下一普通打击+35，应用耗封条1次',weight:20,stance:'ATTACK'},
 {id:SHELTER,label:'单灵护持8灵性2精神3原灵灵性；20秒内下一真实身体或精神冲击减30，应用耗封条1次',weight:20,stance:'DEFEND'},
];
export const DARK_ANGEL_ENEMY_ABILITY_WHEEL:readonly SliceWheelEntry[]=[
 {id:'ARC_BOLT',label:'实际7灵性与1枚印记，身体弧光75；无资源普通棍击',weight:25},
 {id:'DREAD_MARK',label:'实际7灵性与1枚印记，精神压力65；无资源普通棍击',weight:20},
 {id:'WARD',label:'4灵性，一次屏护减随后真实攻击30',weight:20},
 {id:'BODY_STRIKE',label:'唯一原棍20×实际身体状态',weight:20},
 {id:'FEINT',label:'有窗口时3灵性真实遮挡变势，清除窗口；否则普通观察',weight:10},
 {id:'ACCIDENT',label:'实际失衡，无伤害与消耗',weight:5},
];
export const isDarkAngel=(s:SliceState)=>s.progression.pathwayId==='hanged-man'&&s.progression.sequence===1;
function enabled(id:DarkAngelMoveId,p:DarkAngelPolicy):boolean {if(p==='ORDINARY')return [BLADE,BODY,WARD,'ACCIDENT'].includes(id);if(id===GUIDANCE)return p==='ALL'||p==='GUIDANCE';if(id===SHELTER)return p==='ALL'||p==='SHELTER';return true;}
function tickets(stance:SliceStance|null,p:DarkAngelPolicy){return ABILITIES.map(a=>enabled(a.id,p)?a.weight*(stance!==null&&a.stance===stance?5:4):0);}
export function darkAngelAbilityWheel(s:SliceState,stance:SliceStance|null):SliceWheelEntry[]{const p=s.darkAngel.encounter.policy,ws=tickets(stance,p),total=ws.reduce((n,w)=>n+w,0);return ABILITIES.flatMap((a,i)=>ws[i]===0?[]:[{id:a.id,weight:ws[i]!/total*100,label:p==='ORDINARY'&&a.id!==BODY&&a.id!=='ACCIDENT'?'实际身体、原棍或普通格挡，0灵性':stance==='DEFEND'&&[BLADE,BODY,ART].includes(a.id)?'整轮专心防守，不攻击、不支付攻击费用':a.label}]);}
function drawPlayer(random:ActionRandomStream,stance:SliceStance|null,p:DarkAngelPolicy):DarkAngelMoveId {const ws=tickets(stance,p);let n=random.nextInt(1,ws.reduce((a,b)=>a+b,0));for(const[i,a]of ABILITIES.entries()){n-=ws[i]!;if(n<=0)return a.id;}throw new Error('能力盘无效。');}
export function drawDarkAngelAbility(random:ActionRandomStream,s:SliceState,stance:SliceStance|null){return drawPlayer(random,stance,s.darkAngel.encounter.policy);}
export function drawDarkAngelEnemyAbility(random:ActionRandomStream):DarkAngelEnemyIntent {let n=random.nextInt(1,100);for(const a of DARK_ANGEL_ENEMY_ABILITY_WHEEL){n-=a.weight;if(n<=0)return a.id as DarkAngelEnemyIntent;}throw new Error('对手盘无效。');}
export interface DarkAngelCombatSource {
 runId:string;revision:number;week:number;round:number;encounterId:'DARK_ANGEL_DISPUTE';targetId:typeof DARK_ANGEL_TARGET_ID;targetName:'埃德加·沃德';targetAge:45;targetSequence:1;targetCore:24;
 maxActionCount:6;attemptWeek:number;startHistoryIndex:number;actualBody:true;independentMind:true;enemyWeapon:'DA1-EDGAR-ROD';weaponLocation:'HAND';yardId:typeof DARK_ANGEL_SITE;playerPosition:'YARD';enemyDistanceMetres:2;ordinaryExit:'OPEN';pursuit:false;thirdPartiesInArea:0;automaticAllyImmunity:false;
 playerHealth:number;playerMind:number;playerSpirituality:number;enemyHealth:number;enemyMind:number;enemySpirituality:number;playerInjuries:SliceInjury[];enemyInjuries:SliceInjury[];playerRisk:number;enemyRisk:number;
 preparation:DarkAngelPreparation;site:DarkAngelSite;grazing:ShepherdGrazing;reserve:RoseBishopReserve;operation:ElderOperationState;shepherdPromotionWeek:number|null;selectedSpiritId:ThreeHeadedTemplarSpiritId|null;originals:DarkAngelOriginals;budget:DarkAngelEncounterBudget;finance:DarkAngelFinanceSnapshot;
 inheritedMastery:Record<string,number>;mastery:Record<string,number>;clubHeld:boolean;playerClubId:'town-short-club'|null;
 physique:number;perception:number;knowledge:number;will:number;policy:DarkAngelPolicy;powerUses:Record<DarkAngelPowerId,number>;note:DarkAngelCombatNote;marks:DarkAngelMark[];lastForceReceipt:DarkAngelForceReceipt|null;conditionVersion:number;clockSeconds:number;randomSeed:string;randomCursor:number;
}
export interface DarkAngelCombatEffect {label:string;selfGain:number;enemyReduction:number;threatens:boolean;mentalPressure:boolean}
interface ActionEvidence extends DarkAngelCombatEffect {order:number;atSeconds:number;elapsedSeconds:5;paidCost:number;mindCost:number;physicalFactor:number;rolls:number[];randomCursorBefore:number;randomCursorAfter:number;playerHealthAfter:number;playerMindAfter:number;playerSpiritualityAfter:number;enemySpiritualityAfter:number;chargeGranted:boolean;chargeConsumedByOrder:number|null;chargeCancelledByOrder:number|null;appliedAmount:number;consumedEffectOrders:number[];expiresAt:number|null;receipt:DarkAngelForceReceipt|null;conditionVersion:number;noteChargePaid:number;noteWearPaid:number;masteryApplied:string[]}
export interface DarkAngelSpiritReceipt {id:ThreeHeadedTemplarSpiritId;method:ThreeHeadedTemplarSpiritMethod;casketId:string;deathRecordId:string;spiritualityBefore:number;spiritualityAfter:number;spiritCost:3;integrity:number;location:'INTERNAL';permissionVersion:number}
export interface DarkAngelPlayerAction extends ActionEvidence {id:DarkAngelMoveId;attempted:boolean;succeeded:boolean;applied:boolean;resisted:boolean;mode:string;prepared:'WHISPER'|'CHORUS'|'SHADOW'|'WARD'|'GUIDANCE'|'SHELTER'|null;travelMetres:number;reserveCost:number;healthRestored:number;borrowedSpiritId:string|null;borrowedMethod:string|null;spirit:DarkAngelSpiritReceipt|null}
export interface DarkAngelEnemyAction extends ActionEvidence {planned:DarkAngelEnemyIntent;actual:DarkAngelEnemyIntent|'OBSERVE';attackKind:'NONE'|'BODY'|'MENTAL';markId:string|null;spiritIntegrityLost:number;affectedSpiritId:ThreeHeadedTemplarSpiritId|null}
interface Runtime {playerS:number;playerM:number;playerH:number;enemyS:number;powers:Record<DarkAngelPowerId,number>;clockSeconds:number;site:DarkAngelSite;grazing:ShepherdGrazing;reserve:RoseBishopReserve;operation:ElderOperationState;mastery:Record<string,number>;note:DarkAngelCombatNote;marks:DarkAngelMark[];receipt:DarkAngelForceReceipt|null;conditionVersion:number;whisperAttempted:boolean;chorusAttempted:boolean;guardAttempted:boolean;whisper:DarkAngelPlayerAction|null;chorus:DarkAngelPlayerAction|null;shadow:DarkAngelPlayerAction|null;ward:DarkAngelPlayerAction|null;guard:DarkAngelEnemyAction|null;offensive:DarkAngelPlayerAction|null;defensive:DarkAngelPlayerAction|null;expiredEffectOrders:number[]}
const same=(a:unknown,b:unknown)=>a===b||(a!==undefined&&b!==undefined&&stableStringify(a)===stableStringify(b));
const integer=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER):n is number=>Number.isSafeInteger(n)&&(n as number)>=min&&(n as number)<=max;
const shape=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...keys].sort());
const none=(label:string):DarkAngelCombatEffect=>({label,selfGain:0,enemyReduction:0,threatens:false,mentalPressure:false});
const physicalAt=(health:number)=>health>75?1:health>50?.95:health>25?.9:.8;
const masteryFactor=(v:number)=>.65+.35*v/500;
export function currentDarkAngelCombatSource(s:SliceState):DarkAngelCombatSource|null {
 if(!hasDarkAngelDisputeOpponent(s))return null;const e=s.darkAngel.encounter,c=s.combat!,stats=s.character.coreStats,originals=s.darkAngel.sourceScene?.originals;
 if(!e.currentSite||!e.grazing||!e.reserve||!e.preparation||!e.note||!originals)return null;const playerClubId=s.town.clubLocation==='HAND'?'town-short-club':null;
 return {runId:s.runId,revision:s.revision,week:s.week,round:c.round,encounterId:'DARK_ANGEL_DISPUTE',targetId:DARK_ANGEL_TARGET_ID,targetName:'埃德加·沃德',targetAge:45,targetSequence:1,targetCore:24,maxActionCount:6,attemptWeek:e.attemptWeek!,startHistoryIndex:e.startHistoryIndex!,actualBody:true,independentMind:true,enemyWeapon:'DA1-EDGAR-ROD',weaponLocation:'HAND',yardId:DARK_ANGEL_SITE,playerPosition:'YARD',enemyDistanceMetres:2,ordinaryExit:'OPEN',pursuit:false,thirdPartiesInArea:0,automaticAllyImmunity:false,
 playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,enemyHealth:c.enemyHealth,enemyMind:c.enemyMind,enemySpirituality:e.enemySpirituality,playerInjuries:structuredClone(s.injuries),enemyInjuries:structuredClone(c.enemyInjuries),playerRisk:s.injuryRisk,enemyRisk:c.enemyRisk,preparation:structuredClone(e.preparation),site:structuredClone(e.currentSite),grazing:structuredClone(e.grazing),reserve:structuredClone(e.reserve),operation:structuredClone(s.darkAngel.life.operation),shepherdPromotionWeek:originals.shepherdPromotionWeek,selectedSpiritId:e.selectedSpiritId,originals:structuredClone(originals),budget:darkAngelEncounterBudget(s),finance:darkAngelFinanceSnapshot(s),inheritedMastery:Object.fromEntries(INHERITED_IDS.map(id=>[id,s.progression.mastery[id]!])),mastery:{...s.progression.mastery},clubHeld:playerClubId!==null,playerClubId,physique:stats.physique,perception:stats.perception,knowledge:stats.knowledge,will:stats.will,policy:e.policy,powerUses:{...e.powerUses},note:structuredClone(e.note),marks:structuredClone(e.marks),lastForceReceipt:structuredClone(e.lastForceReceipt),conditionVersion:e.conditionVersion,clockSeconds:e.currentSite.clockSeconds,randomSeed:s.random.seed,randomCursor:s.random.cursor};
}
function makeRuntime(x:DarkAngelCombatSource):Runtime {return {playerS:x.playerSpirituality,playerM:x.playerMind,playerH:x.playerHealth,enemyS:x.enemySpirituality,powers:{...x.powerUses},clockSeconds:x.clockSeconds,site:structuredClone(x.site),grazing:structuredClone(x.grazing),reserve:structuredClone(x.reserve),operation:structuredClone(x.operation),mastery:{...x.mastery},note:structuredClone(x.note),marks:structuredClone(x.marks),receipt:structuredClone(x.lastForceReceipt),conditionVersion:x.conditionVersion,whisperAttempted:false,chorusAttempted:false,guardAttempted:false,whisper:null,chorus:null,shadow:null,ward:null,guard:null,offensive:null,defensive:null,expiredEffectOrders:[]};}
function actionBase(r:Runtime,order:number,physical:number,cursor:number):ActionEvidence {return {...none(''),order,atSeconds:r.clockSeconds,elapsedSeconds:5,paidCost:0,mindCost:0,physicalFactor:physical,rolls:[],randomCursorBefore:cursor,randomCursorAfter:cursor,playerHealthAfter:r.playerH,playerMindAfter:r.playerM,playerSpiritualityAfter:r.playerS,enemySpiritualityAfter:r.enemyS,chargeGranted:false,chargeConsumedByOrder:null,chargeCancelledByOrder:null,appliedAmount:0,consumedEffectOrders:[],expiresAt:null,receipt:null,conditionVersion:r.conditionVersion,noteChargePaid:0,noteWearPaid:0,masteryApplied:[]};}
function expire(r:Runtime):void {for(const key of ['offensive','defensive'] as const){const a=r[key];if(a&&(a.expiresAt!<=r.clockSeconds||a.conditionVersion!==r.conditionVersion)){r.expiredEffectOrders.push(a.order);a.label+=' 20秒到期或现场变化，未用窗口失效，费用不退。';r[key]=null;}}}
function closeAction<T extends ActionEvidence>(a:T,r:Runtime,random:ActionRandomStream):T {r.clockSeconds+=5;r.site.clockSeconds=r.clockSeconds;a.randomCursorAfter=random.cursor;a.playerHealthAfter=r.playerH;a.playerMindAfter=r.playerM;a.playerSpiritualityAfter=r.playerS;a.enemySpiritualityAfter=r.enemyS;a.label+=` 本动作5秒；你余${r.playerS}灵性、${r.playerM}精神，对手余${r.enemyS}灵性。`;return a;}
function consume(effect:DarkAngelPlayerAction|DarkAngelEnemyAction,a:ActionEvidence,amount:number,cancelled=false):void {a.consumedEffectOrders.push(effect.order);if(cancelled){effect.chargeCancelledByOrder=a.order;effect.label+=` 第${a.order+1}动作令窗口失效，费用不退。`;}else{effect.chargeConsumedByOrder=a.order;effect.appliedAmount=amount;if('applied'in effect)effect.applied=true;effect.label+=` 第${a.order+1}动作实际应用${amount}，仅一次。`;}}
function clearBorrowedWindow(r:Runtime,a:DarkAngelPlayerAction):void {
 for(const key of ['chorus','offensive','defensive'] as const){if(r[key]){consume(r[key]!,a,0,true);r[key]=null;}}
 if(r.ward?.borrowedSpiritId){consume(r.ward,a,0,true);r.ward=null;}
}
function useNewWindow(r:Runtime,effect:DarkAngelPlayerAction,a:ActionEvidence,amount:number):void {
 consume(effect,a,amount);r.note.charges--;r.note.wear++;a.noteChargePaid++;a.noteWearPaid++;
 effect.masteryApplied.push(effect.id);r.mastery[effect.id]=Math.min(500,r.mastery[effect.id]!+8);
}
function applyAttackWindows(r:Runtime,a:DarkAngelPlayerAction):void {
 if(!a.threatens)return;
 if(r.offensive&&(a.mode==='ORDINARY'||a.mode==='INHERITED_BODY')&&r.note.charges>0){useNewWindow(r,r.offensive,a,35);a.selfGain+=35;r.offensive=null;a.label+=' 同一封条实耗一次、磨损1；单灵引导只给本次普通打击+35。';}
 if(r.guard){const amount=Math.min(30,a.selfGain);consume(r.guard,a,amount);a.selfGain-=amount;r.guard=null;}
 a.threatens=a.selfGain>0;a.applied=a.threatens;a.appliedAmount=a.selfGain;
}
function selectedSpirit(x:DarkAngelCombatSource,r:Runtime,kind:'GUIDANCE'|'SHELTER'){
 const sp=x.selectedSpiritId?r.site.spirits[x.selectedSpiritId]:null;
 const method:ThreeHeadedTemplarSpiritMethod=kind==='GUIDANCE'?'SIGNAL':sp?.id==='THT3-HELENA'?'BRIEF_WARD':'SCREEN';
 return sp&&sp.status==='GRAZED'&&sp.location==='INTERNAL'&&sp.acquiredWeek!==null&&sp.releasedWeek===null&&sp.integrity>0&&sp.spirituality>=3&&sp.selectedAbilities.includes(method)?{sp,method}:null;
}
function paySpirit(r:Runtime,a:DarkAngelPlayerAction,sp:DarkAngelSite['spirits'][ThreeHeadedTemplarSpiritId],method:ThreeHeadedTemplarSpiritMethod):void {
 const before=sp.spirituality;sp.spirituality-=3;
 a.spirit={id:sp.id,method,casketId:sp.casketId,deathRecordId:sp.deathRecordId,spiritualityBefore:before,spiritualityAfter:sp.spirituality,spiritCost:3,integrity:sp.integrity,location:'INTERNAL',permissionVersion:r.conditionVersion};
 a.borrowedSpiritId=sp.id;a.borrowedMethod=method;
}
function playerAction(x:DarkAngelCombatSource,r:Runtime,stance:SliceStance,id:DarkAngelMoveId,physical:number,order:number,random:ActionRandomStream):DarkAngelPlayerAction {
 expire(r);
 const a:DarkAngelPlayerAction={...actionBase(r,order,physical,random.cursor),id,attempted:false,succeeded:false,applied:false,resisted:false,mode:'ORDINARY',prepared:null,travelMetres:0,reserveCost:0,healthRestored:0,borrowedSpiritId:null,borrowedMethod:null,spirit:null};
 const check=(ability:'knowledge'|'will',difficulty:number)=>{const roll=random.nextInt(1,100);a.rolls.push(roll);return roll<=computeCheckChance({ability,baseAbility:x[ability],difficulty,modifiers:[]});};
 const spirit=actualElderBorrowedSpirit(r.grazing,x.week,x.shepherdPromotionWeek),iris=(method:string)=>x.policy!=='ORDINARY'&&spirit?.id==='SH5-IRIS-1'&&spirit.selectedAbilities.includes(method);
 if(id===GUIDANCE||id===SHELTER){
  const chosen=selectedSpirit(x,r,id===GUIDANCE?'GUIDANCE':'SHELTER');
  if(r.offensive||r.defensive){a.mode='ALREADY_PREPARED';a.label='已有一位原灵的待用窗口，不并行、不重施、不重复收费。';}
  else if(!chosen||r.note.charges===0||r.playerS<8||r.playerM<4){a.mode='ORDINARY_FALLBACK';a.label='所选原灵、已选方法、同一封条或真实资源不足，只普通复核；不替换原灵、不空扣费用。';}
  else {clearBorrowedWindow(r,a);a.attempted=true;a.paidCost=8;a.mindCost=2;r.playerS-=8;r.playerM-=2;paySpirit(r,a,chosen.sp,chosen.method);a.succeeded=check('knowledge',18);
   if(a.succeeded){a.mode='PREPARED';a.chargeGranted=true;a.prepared=id===GUIDANCE?'GUIDANCE':'SHELTER';a.expiresAt=r.clockSeconds+20;if(id===GUIDANCE)r.offensive=a;else r.defensive=a;}
   else{a.mode='FAILED';a.mindCost+=2;r.playerM-=2;}
   a.label=`${id===GUIDANCE?'单灵引导':'单灵护持'}只用当前选定${chosen.sp.name}的${chosen.method}，实付本人8灵性${a.mindCost}精神与原灵3灵性；知识18实抽${a.rolls[0]}。${a.succeeded?'同一可见现场20秒内只供随后一次真实行动，应用才耗封条':'检定失败，费用不退，没有效果'}。`;
  }
 }else if(stance==='DEFEND'&&[BLADE,BODY,ART].includes(id)){a.mode='HOLD_GUARD';a.label='整轮专心防守，本槽不攻击，不消耗攻击资源。';}
 else if(id==='ACCIDENT'){a.selfGain=-22.5;a.label='动作偏差，优势−22.5，不重抽。';}
 else if(id===BODY){
  a.selfGain=27.3*masteryFactor(x.inheritedMastery['hanged-man.s6.flesh-shaping']!)*physical;a.threatens=a.selfGain>0;a.travelMetres=4;r.site.playerTravelMetres+=4;a.mode='INHERITED_BODY';a.label=`本人近身2米再退回2米，原身体次击27.3×原掌握×身体，攻势${a.selfGain}。`;applyAttackWindows(r,a);
 }else if(id===BLADE){
  a.travelMetres=4;r.site.playerTravelMetres+=4;
  if(x.policy!=='ORDINARY'&&r.playerS>=5){a.paidCost=5;r.playerS-=5;a.selfGain=55*masteryFactor(x.inheritedMastery[BLADE]!);a.mode='PAID_BLADE';a.label='旧灵肉之刃实付5灵性，本人近身2米挥击再退回2米，不凭身份判定致死。';}
  else{a.selfGain=(x.clubHeld?16:12)*physical;a.label=`只以本人${x.clubHeld?'原棍':'实际身体'}近身打击并返回，0灵性。`;}
  a.threatens=a.selfGain>0;applyAttackWindows(r,a);
 }else if(id===WARD){
  if(r.ward){a.mode='ALREADY_PREPARED';a.label='既有格挡待用，不叠加、不重复付费。';}
  else if(iris('brief-ward')&&r.playerS>=2){clearBorrowedWindow(r,a);a.paidCost=2;r.playerS-=2;a.borrowedSpiritId='SH5-IRIS-1';a.borrowedMethod='brief-ward';a.mode='OLD_IRIS';a.prepared='WARD';a.chargeGranted=true;r.ward=a;a.label='原伊芮斯实际已选短促防护实付2灵性，只准备一次真实自保。';}
  else if(x.policy!=='ORDINARY'&&r.playerH>0&&r.playerH<100&&r.reserve.points>0&&r.playerS>=3){a.paidCost=3;r.playerS-=3;a.reserveCost=1;r.reserve.points--;a.healthRestored=Math.min(10,100-r.playerH);r.playerH+=a.healthRestored;a.selfGain=8;a.applied=true;a.appliedAmount=a.healthRestored;a.mode='OLD_RESERVE';a.label=`旧自修复实付3灵性与1现有储备，健康恢复${a.healthRestored}；旧伤不消失，不生成储备。`;}
  else{a.prepared='WARD';a.chargeGranted=true;r.ward=a;a.label='用本人实际身体准备普通格挡，最多10×身体。';}
 }else if(id===SHADOW){
  if(r.shadow){a.mode='ALREADY_PREPARED';a.label='原影限制已准备，不叠加。';}
  else if(r.playerS<4){a.mode='ORDINARY_FALLBACK';a.label='不足4灵性，普通观察。';}
  else{a.attempted=true;a.paidCost=4;r.playerS-=4;a.succeeded=check('knowledge',18);a.mode=a.succeeded?'PREPARED':'FAILED';if(a.succeeded){a.prepared='SHADOW';a.chargeGranted=true;r.shadow=a;}a.label=`旧原影限制实付4灵性，作用眼前埃德加在实际日光下的影子；${a.succeeded?'下一普通身体棍击减半':'失败，费用不退'}。旧独立失控影子没有被召回。`;}
 }else if(id===ART){
  if(iris('light-touch')&&r.playerS>=2){clearBorrowedWindow(r,a);a.paidCost=2;r.playerS-=2;a.borrowedSpiritId='SH5-IRIS-1';a.borrowedMethod='light-touch';a.selfGain=38.025*masteryFactor(x.inheritedMastery[ART]!);a.threatens=a.selfGain>0;a.mode='OLD_IRIS';a.label='当前原伊芮斯实际已选微力触动实付2灵性，仅此次冲击。';applyAttackWindows(r,a);}
  else{a.mode='ORDINARY_FALLBACK';a.label='原灵方法或资源不足，只普通复核。';}
 }else if(id===WHISPER){
  if(r.whisperAttempted||r.playerS<6||r.playerM<=2){a.mode='ORDINARY_FALLBACK';a.label='本轮已试低语或资源不足，只稳住呼吸。';}
  else{r.whisperAttempted=true;a.attempted=true;a.paidCost=6;a.mindCost=2;r.playerS-=6;r.playerM-=2;const known=check('will',18);if(known){const roll=random.nextInt(1,100);a.rolls.push(roll);a.resisted=roll<=25;}a.succeeded=known&&!a.resisted;if(a.succeeded){a.prepared='WHISPER';a.chargeGranted=true;r.whisper=a;}a.mode=a.succeeded?'PREPARED':a.resisted?'RESISTED':'FAILED';a.label=`旧低语实付6灵性2精神；${a.succeeded?'随后一次实际攻势减35以内':'未生效，费用不退'}，不控制身份、思想或健康。`;}
 }else if(id===CHORUS){
  // Preserve the existing Elder choice and costs; no free spirit is introduced.
  const chosen=(['THT3-HELENA','THT3-ROLAND'] as const).map(key=>r.site.spirits[key]).find(sp=>sp.status==='GRAZED'&&sp.location==='INTERNAL'&&!sp.interrupted&&sp.integrity>0&&sp.spirituality>=3&&sp.acquiredWeek!==null&&sp.releasedWeek===null&&sp.selectedAbilities.includes(sp.id==='THT3-HELENA'?'BRIEF_WARD':'STEADY_HOLD'));
  if(r.chorusAttempted||!chosen||r.playerS<6||r.playerM<=4){a.mode='ORDINARY_FALLBACK';a.label='本轮已试聚声或实际原灵资源不足，普通复核，不生成灵魂。';}
  else{clearBorrowedWindow(r,a);r.chorusAttempted=true;a.attempted=true;a.paidCost=6;a.mindCost=2;r.playerS-=6;r.playerM-=2;const method=chosen.id==='THT3-HELENA'?'BRIEF_WARD':'STEADY_HOLD';paySpirit(r,a,chosen,method);const known=check('knowledge',18);if(known){const roll=random.nextInt(1,100);a.rolls.push(roll);a.resisted=roll<=25;}a.succeeded=known&&!a.resisted;
   if(!a.succeeded){a.mindCost+=2;r.playerM-=2;a.mode=a.resisted?'RESISTED':'FAILED';}else if(method==='BRIEF_WARD'){a.mode='PREPARED';a.prepared='CHORUS';a.chargeGranted=true;r.chorus=a;}else{a.mode='STEADY_HOLD';a.selfGain=16;a.applied=true;a.appliedAmount=16;}
   a.label=`旧单灵聚声只取原${chosen.name}已选${method}；本人6灵性${a.mindCost}精神、原灵3灵性，${a.succeeded?method==='BRIEF_WARD'?'随后一次自保减18以内':'当前本人实际握持稳定+16':'失败无效果'}。`;
  }
 }
 return closeAction(a,r,random);
}
function enemyAction(x:DarkAngelCombatSource,r:Runtime,planned:DarkAngelEnemyIntent,physical:number,order:number,random:ActionRandomStream):DarkAngelEnemyAction {
 expire(r);const a:DarkAngelEnemyAction={...actionBase(r,order,physical,random.cursor),planned,actual:planned,attackKind:'NONE',markId:null,spiritIntegrityLost:0,affectedSpiritId:null};
 const power=DARK_ANGEL_POWERS.find(p=>p.id===planned),mark=r.marks.find(m=>m.status==='HELD');
 if(planned==='WARD'&&r.guardAttempted||planned==='FEINT'&&!r.offensive&&!r.defensive)a.actual='OBSERVE';
 else if(power&&(r.enemyS<power.cost||['ARC_BOLT','DREAD_MARK'].includes(planned)&&!mark))a.actual='BODY_STRIKE';
 if(a.actual==='ARC_BOLT'||a.actual==='DREAD_MARK'||a.actual==='BODY_STRIKE'){
  const mental=a.actual==='DREAD_MARK';let raw=a.actual==='ARC_BOLT'?75:mental?65:20*physical;a.attackKind=mental?'MENTAL':'BODY';
  if(a.actual!=='BODY_STRIKE'){r.enemyS-=7;r.powers[a.actual]++;a.paidCost=7;mark!.status='SPENT';mark!.usedRound=x.round;mark!.usedOrder=order;a.markId=mark!.id;r.receipt={id:`${mark!.id}:spent:${x.round}:${order}`,targetId:x.targetId,power:a.actual,kind:mental?'MENTAL':'BODY',markId:mark!.id,paidCost:7,round:x.round,order,atSeconds:r.clockSeconds,position:'YARD',visible:true,conditionVersion:r.conditionVersion};a.receipt=structuredClone(r.receipt);a.label=`埃德加实付7灵性并耗掉${mark!.id}，实际${mental?'精神压力65':'身体弧光75'}。`;}
  else a.label=`${planned!=='BODY_STRIKE'?'实际灵性或有限印记不足，普通回退；':''}埃德加以自己唯一DA1-EDGAR-ROD打击20×实际身体。`;
  if(a.actual==='BODY_STRIKE'&&raw>0&&r.shadow){const amount=raw*.5;consume(r.shadow,a,amount);raw-=amount;r.shadow=null;}
  if(raw>0&&r.whisper){const amount=Math.min(35,raw);consume(r.whisper,a,amount);raw-=amount;r.whisper=null;}
  if(!mental&&raw>0&&r.chorus){const amount=Math.min(18,raw);consume(r.chorus,a,amount);raw-=amount;r.chorus=null;}
  if(!mental&&raw>0&&r.ward){const amount=Math.min(raw,r.ward.borrowedSpiritId?30*masteryFactor(x.inheritedMastery[ART]!):10*r.ward.physicalFactor);consume(r.ward,a,amount);raw-=amount;r.ward=null;}
  if(raw>0&&r.defensive&&r.note.charges>0){const amount=Math.min(30,raw);useNewWindow(r,r.defensive,a,amount);raw-=amount;r.defensive=null;a.label+=' 当前单灵护持仅本次减势，实耗同一封条一次。';}
  a.selfGain=raw;a.appliedAmount=raw;a.threatens=!mental&&raw>0;a.mentalPressure=mental&&raw>0;
 }else if(a.actual==='WARD'){r.enemyS-=4;r.powers.WARD++;r.guardAttempted=true;a.paidCost=4;a.chargeGranted=true;r.guard=a;a.label='埃德加实付4灵性，屏护随后一次实际攻击至多30。';}
 else if(a.actual==='FEINT'){r.enemyS-=3;r.powers.FEINT++;a.paidCost=3;r.conditionVersion++;for(const key of ['offensive','defensive'] as const){if(r[key]){consume(r[key]!,a,0,true);r[key]=null;}}a.label='埃德加实付3灵性，横棍遮挡并变势；同一可见条件中断，待用窗口失效，费用不退。原灵仍在体内，完整度保持。';}
 else if(a.actual==='OBSERVE')a.label='没有可破坏窗口或本轮已屏护，只普通观察，0费用。';
 else a.label='对手实际失衡，0费用0攻势，不重抽。';
 return closeAction(a,r,random);
}

export function validDarkAngelInjuries(v: SliceInjury[], revision: number): boolean {
  return Array.isArray(v) && new Set(v.map(i => i.id)).size === v.length && v.every(i => shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 && ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision, 1, revision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision, revision)));
}
export const DARK_ANGEL_SOURCE_KEYS=['runId','revision','week','round','encounterId','targetId','targetName','targetAge','targetSequence','targetCore','maxActionCount','attemptWeek','startHistoryIndex','actualBody','independentMind','enemyWeapon','weaponLocation','yardId','playerPosition','enemyDistanceMetres','ordinaryExit','pursuit','thirdPartiesInArea','automaticAllyImmunity','playerHealth','playerMind','playerSpirituality','enemyHealth','enemyMind','enemySpirituality','playerInjuries','enemyInjuries','playerRisk','enemyRisk','preparation','site','grazing','reserve','operation','shepherdPromotionWeek','selectedSpiritId','originals','budget','finance','inheritedMastery','mastery','clubHeld','playerClubId','physique','perception','knowledge','will','policy','powerUses','note','marks','lastForceReceipt','conditionVersion','clockSeconds','randomSeed','randomCursor'] as const;
export function validDarkAngelCombatSource(x:DarkAngelCombatSource):boolean {try{
 const p=x.site,prep=x.preparation,b=x.budget;
 if(!shape(x,DARK_ANGEL_SOURCE_KEYS)||typeof x.runId!=='string'||!x.runId||!integer(x.revision)||!integer(x.week,1)||!integer(x.round,1)||!integer(x.startHistoryIndex)||x.attemptWeek!==x.week||
 x.encounterId!=='DARK_ANGEL_DISPUTE'||x.targetId!==DARK_ANGEL_TARGET_ID||x.targetName!=='埃德加·沃德'||x.targetAge!==45||x.targetSequence!==1||x.targetCore!==24||x.maxActionCount!==6||!x.actualBody||!x.independentMind||x.enemyWeapon!=='DA1-EDGAR-ROD'||x.weaponLocation!=='HAND'||x.yardId!==DARK_ANGEL_SITE||x.playerPosition!=='YARD'||x.enemyDistanceMetres!==2||x.ordinaryExit!=='OPEN'||x.pursuit!==false||x.thirdPartiesInArea!==0||x.automaticAllyImmunity!==false)return false;
 if(![x.playerHealth,x.playerMind,x.enemyHealth,x.enemyMind].every(n=>integer(n,1,100))||![x.playerSpirituality,x.enemySpirituality].every(n=>integer(n,0,120))||!validateDarkAngelCurrentSite(p,x.originals)||p.playerLocation!=='YARD'||p.owner.location!=='OUTSIDE'||!p.owner.alive||p.card.location!=='TABLE'||p.lamp.on||p.shutter.state!=='CLOSED'||p.clockSeconds!==x.clockSeconds)return false;
 if(!validateDarkAngelPreparation(prep)||prep.runId!==x.runId||prep.randomSeed!==x.randomSeed||prep.randomCursor>x.randomCursor||prep.revision>=x.revision||prep.week>x.week||x.clockSeconds!==prep.lifeClockSeconds+4+60*(x.round-1)||!same(x.originals,prep.originals)||!same(x.finance,prep.finance)||!same(x.grazing,prep.grazing)||!same(x.operation,prep.operation)||x.shepherdPromotionWeek!==x.originals.shepherdPromotionWeek)return false;
 if(!same({...b,health:prep.after.health,mind:prep.after.mind,spirituality:prep.after.spirituality,mastery:prep.after.mastery,injuries:prep.after.injuries,injuryRisk:prep.after.injuryRisk},{...prep.after,actions:prep.after.actions-1}))return false;
 if(!Object.entries(p.spirits).every(([id,sp])=>{const old=prep.site.spirits[id as ThreeHeadedTemplarSpiritId];return !!old&&same({...sp,spirituality:old.spirituality},old)&&integer(sp.spirituality,0,old.spirituality);}))return false;
 if(!same({...x.reserve,points:prep.reserve.points},prep.reserve)||!integer(x.reserve.points,0,prep.reserve.points)||!['THT3-HELENA','THT3-ROLAND',null].includes(x.selectedSpiritId))return false;
 if(x.grazing.spirits.filter(sp=>sp.status==='GRAZED').length+Object.values(p.spirits).filter(sp=>sp.status==='GRAZED').length>7)return false;
 if(!shape(x.inheritedMastery,INHERITED_IDS)||!INHERITED_IDS.every(id=>integer(x.inheritedMastery[id],0,500)&&x.inheritedMastery[id]===x.mastery[id]&&x.mastery[id]===prep.after.mastery[id])||!integer(x.mastery[GUIDANCE],0,500)||!integer(x.mastery[SHELTER],0,500)||!Object.values(x.mastery).every(n=>integer(n,0,500)))return false;
 if(!same(b.mastery,x.mastery)||b.health!==x.playerHealth||b.mind!==x.playerMind||b.spirituality!==x.playerSpirituality||b.injuryRisk!==x.playerRisk||!same(b.injuries,x.playerInjuries)||b.sequence!==1||!same(b.coreStats,{physique:x.physique,perception:x.perception,will:x.will,knowledge:x.knowledge}))return false;
 if(!['town-short-club',null].includes(x.playerClubId)||x.clubHeld!==(x.playerClubId!==null)||![x.physique,x.perception,x.will,x.knowledge].every(n=>integer(n,0,500))||!DARK_ANGEL_POLICIES.includes(x.policy)||!integer(x.playerRisk)||!integer(x.enemyRisk)||!validDarkAngelInjuries(x.playerInjuries,x.revision)||!validDarkAngelInjuries(x.enemyInjuries,x.revision))return false;
 if(!shape(x.powerUses,DARK_ANGEL_POWER_IDS)||!DARK_ANGEL_POWER_IDS.every(id=>integer(x.powerUses[id]))||x.powerUses.WARD>x.round-1||x.powerUses.FEINT>6*(x.round-1)||x.powerUses.ARC_BOLT+x.powerUses.DREAD_MARK>3||x.enemySpirituality!==120-DARK_ANGEL_POWERS.reduce((n,p)=>n+p.cost*x.powerUses[p.id],0)||!x.note||!validDarkAngelCombatNote(x.note)||!validDarkAngelMarks(x.marks)||x.marks.filter(m=>m.status==='SPENT').length!==x.powerUses.ARC_BOLT+x.powerUses.DREAD_MARK||x.conditionVersion!==1+x.powerUses.FEINT)return false;
 if(x.lastForceReceipt){const r=x.lastForceReceipt;if(!shape(r,['id','targetId','power','kind','markId','paidCost','round','order','atSeconds','position','visible','conditionVersion'])||r.targetId!==x.targetId||!['ARC_BOLT','DREAD_MARK'].includes(r.power)||r.kind!==(r.power==='ARC_BOLT'?'BODY':'MENTAL')||r.paidCost!==7||!integer(r.round,1,x.round-1)||!integer(r.order,0,11)||!integer(r.atSeconds,prep.lifeClockSeconds+4,x.clockSeconds)||r.position!=='YARD'||r.visible!==true||!integer(r.conditionVersion,1,x.conditionVersion)||!x.marks.some(m=>m.id===r.markId&&m.usedRound===r.round&&m.usedOrder===r.order)||r.id!==`${r.markId}:spent:${r.round}:${r.order}`)return false;}
 return typeof x.randomSeed==='string'&&x.randomSeed.length>0&&x.randomSeed.length<=256&&integer(x.randomCursor);
 }catch{return false;}}
export const validateDarkAngelCombatSource=validDarkAngelCombatSource;
export type DarkAngelResolution='CONTINUE'|'PLAYER_DEAD'|'ENEMY_DEAD'|'ENEMY_SURRENDERED'|'RETREATED';
export interface DarkAngelRoundOutcome {targetId:typeof DARK_ANGEL_TARGET_ID;round:number;source:DarkAngelCombatSource;stance:SliceStance;continuing:boolean;enemyHealth:number;enemyMind:number;enemySpirituality:number;enemyStatus:'RESISTING'|'SURRENDERED'|'DEAD';playerSpiritualityBefore:number;playerSpiritualityAfter:number;playerHealthAfter:number;playerMindAfter:number;enemySpiritualityBefore:number;playerInjuriesAfter:SliceInjury[];enemyInjuriesAfter:SliceInjury[];playerRiskAfter:number;enemyRiskAfter:number;powerUses:Record<DarkAngelPowerId,number>;whisperAttempted:boolean;chorusAttempted:boolean;guardAttempted:boolean;expiredEffectOrders:number[];siteAfter:DarkAngelSite;grazingAfter:ShepherdGrazing;reserveAfter:RoseBishopReserve;operationAfter:ElderOperationState;masteryAfter:Record<string,number>;noteAfter:DarkAngelCombatNote;marksAfter:DarkAngelMark[];lastForceReceipt:DarkAngelForceReceipt|null;conditionVersion:number;clockSecondsAfter:number;elapsedSeconds:60;randomCursorAfter:number;playerActions:DarkAngelPlayerAction[];enemyActions:DarkAngelEnemyAction[]}
function penalty(current:number,maximum:number){const f=Math.max(0,Math.min(1,current/maximum));return f>.75?0:f>.5?.05:f>.25?.1:.2;}
function base(core:number,h:number,m:number,s:number){return(1500+Math.min(core,300))*(1-Math.min(.4,penalty(h,100)+penalty(m,100)+penalty(s,120)));}
function weights(risk:number){const death=Math.min(100,5+Math.min(risk,10)*10),shifted=death-5;return{light:Math.max(0,65-shifted),heavy:Math.max(0,30-Math.max(0,shifted-65)),death};}
export function replayDarkAngelCombatRound(x:DarkAngelCombatSource,stance:SliceStance):{round:SliceCombatRound;outcome:DarkAngelResolution}{
 if(!validDarkAngelCombatSource(x)||!['ATTACK','DEFEND','CONTROL','PREPARE','RETREAT'].includes(stance))throw new Error('缺少真实埃德加、有限物资与连续身体来源。');
 const rng=new DeterministicActionRandomStream(x.randomSeed,x.randomCursor),r=makeRuntime(x),playerCountRoll=rng.nextInt(1,100),enemyCountRoll=rng.nextInt(1,100),playerCount=darkAngelActionCount(playerCountRoll),enemyCount=darkAngelEnemyActionCount(enemyCountRoll);
 const first=x.round%2===1?'PLAYER':'ENEMY',order=first==='PLAYER'?['PLAYER','ENEMY'] as const:['ENEMY','PLAYER'] as const,remaining={PLAYER:playerCount,ENEMY:enemyCount};const players:DarkAngelPlayerAction[]=[],enemies:DarkAngelEnemyAction[]=[];let retreat:SliceCombatRound['retreat']='NONE';
 while(remaining.PLAYER>0||remaining.ENEMY>0){for(const actor of order){if(!remaining[actor])continue;if(actor==='PLAYER'&&stance==='RETREAT'){remaining.PLAYER=0;retreat=rng.nextInt(1,100)<=50?'SUCCESS':'FAILURE';if(retreat==='SUCCESS'){remaining.ENEMY=0;break;}continue;}remaining[actor]--;if(actor==='PLAYER')players.push(playerAction(x,r,stance,drawPlayer(rng,stance,x.policy),physicalAt(r.playerH),players.length+enemies.length,rng));else enemies.push(enemyAction(x,r,drawDarkAngelEnemyAbility(rng),physicalAt(x.enemyHealth),players.length+enemies.length,rng));}}
 const sum=(as:DarkAngelCombatEffect[],k:'selfGain'|'enemyReduction')=>as.reduce((n,a)=>n+a[k],0),playerAdvantage=Math.max(150,base(x.physique*.50+x.perception*.20+x.will*.20+x.knowledge*.10,x.playerHealth,x.playerMind,x.playerSpirituality)+sum(players,'selfGain')-sum(enemies,'enemyReduction')),enemyAdvantage=Math.max(150,base(x.targetCore,x.enemyHealth,x.enemyMind,x.enemySpirituality)+sum(enemies,'selfGain')-sum(players,'enemyReduction')),winChance=playerAdvantage/(playerAdvantage+enemyAdvantage)*100;
 const winner=retreat==='SUCCESS'?'ENEMY':rng.nextInt(1,1_000_000)<=winChance*10_000?'PLAYER':'ENEMY';
 let playerHealth=r.playerH,enemyHealth=x.enemyHealth,enemyMind=x.enemyMind,playerRisk=x.playerRisk,enemyRisk=x.enemyRisk,enemyStatus:DarkAngelRoundOutcome['enemyStatus']='RESISTING',outcome:DarkAngelResolution=retreat==='SUCCESS'?'RETREATED':'CONTINUE';
 const playerInjuries=structuredClone(x.playerInjuries),enemyInjuries=structuredClone(x.enemyInjuries);let consequenceWeights:SliceCombatRound['consequenceWeights']=null,consequenceRoll:number|undefined,consequenceDomain:SliceCombatRound['consequenceDomain'];
 if(retreat!=='SUCCESS'){const loser=winner==='PLAYER'?'ENEMY':'PLAYER',attacks=loser==='PLAYER'?enemies:players,injuries=loser==='PLAYER'?playerInjuries:enemyInjuries;
  if(attacks.some(a=>a.threatens)){let risk=loser==='PLAYER'?playerRisk:enemyRisk;if(injuries.length)risk++;if(loser==='PLAYER')playerRisk=risk;else enemyRisk=risk;consequenceDomain='BODY';consequenceWeights=weights(risk);consequenceRoll=rng.nextInt(1,100);const severity=consequenceRoll<=consequenceWeights.light?'LIGHT':consequenceRoll<=consequenceWeights.light+consequenceWeights.heavy?'HEAVY':'DEATH';
   if(severity==='DEATH'){if(loser==='PLAYER')playerHealth=0;else{enemyHealth=0;enemyStatus='DEAD';}}else{injuries.push({id:`${x.runId}:combat:${x.round}:${loser}:${x.revision+1}:${injuries.length}`,severity,acquiredRevision:x.revision+1,treatedRevision:null});const damage=severity==='LIGHT'?10:30;if(loser==='PLAYER')playerHealth=Math.max(0,playerHealth-damage);else enemyHealth=Math.max(0,enemyHealth-damage);if(enemyHealth===0)enemyStatus='DEAD';else if(loser==='ENEMY'&&severity==='HEAVY')enemyStatus='SURRENDERED';}
  }else if(attacks.some(a=>a.mentalPressure)){consequenceDomain='MENTAL';if(loser==='PLAYER')r.playerM=Math.max(0,r.playerM-10);else{enemyMind=Math.max(0,enemyMind-10);if(enemyMind===0)enemyStatus='SURRENDERED';}}
  if(playerHealth===0)outcome='PLAYER_DEAD';else if(enemyHealth===0)outcome='ENEMY_DEAD';else if(enemyStatus==='SURRENDERED')outcome='ENEMY_SURRENDERED';else if(r.playerM===0)outcome='RETREATED';
 }
 const pending=[r.whisper,r.chorus,r.shadow,r.ward,r.guard,r.offensive,r.defensive].filter((a):a is DarkAngelPlayerAction|DarkAngelEnemyAction=>a!==null).map(a=>a.order);r.site.clockSeconds=x.clockSeconds+60;
 const o:DarkAngelRoundOutcome={targetId:x.targetId,round:x.round,source:structuredClone(x),stance,continuing:outcome==='CONTINUE',enemyHealth,enemyMind,enemySpirituality:r.enemyS,enemyStatus,playerSpiritualityBefore:x.playerSpirituality,playerSpiritualityAfter:r.playerS,playerHealthAfter:playerHealth,playerMindAfter:r.playerM,enemySpiritualityBefore:x.enemySpirituality,playerInjuriesAfter:playerInjuries,enemyInjuriesAfter:enemyInjuries,playerRiskAfter:playerRisk,enemyRiskAfter:enemyRisk,powerUses:{...r.powers},whisperAttempted:r.whisperAttempted,chorusAttempted:r.chorusAttempted,guardAttempted:r.guardAttempted,expiredEffectOrders:[...r.expiredEffectOrders,...pending].sort((a,b)=>a-b),siteAfter:structuredClone(r.site),grazingAfter:structuredClone(r.grazing),reserveAfter:structuredClone(r.reserve),operationAfter:structuredClone(r.operation),masteryAfter:{...r.mastery},noteAfter:structuredClone(r.note),marksAfter:structuredClone(r.marks),lastForceReceipt:structuredClone(r.receipt),conditionVersion:r.conditionVersion,clockSecondsAfter:r.site.clockSeconds,elapsedSeconds:60,randomCursorAfter:rng.cursor,playerActions:players,enemyActions:enemies};
 const round:SliceCombatRound={round:x.round,stance,first,playerCount,enemyCount,playerCountRoll,enemyCountRoll,moves:[...players.map(a=>({...a,actor:'PLAYER' as const})),...enemies.map(a=>({...a,actor:'ENEMY' as const}))].sort((a,b)=>a.order-b.order).map(a=>({actor:a.actor,label:a.label,selfGain:a.selfGain,enemyReduction:a.enemyReduction})),playerAdvantage,enemyAdvantage,winChance,winner,consequence:'',consequenceWeights,retreat,...(consequenceDomain?{consequenceDomain}:{}),...(consequenceRoll===undefined?{}:{consequenceRoll}),darkAngelOutcome:o};round.consequence=darkAngelCombatConsequence(round);return{round,outcome};
}
export function validateDarkAngelRoundOutcome(v:unknown):v is DarkAngelRoundOutcome {try{const o=v as DarkAngelRoundOutcome;return same(o,replayDarkAngelCombatRound(o.source,o.stance).round.darkAngelOutcome);}catch{return false;}}
export function validateDarkAngelCombatRound(round:SliceCombatRound):boolean {try{const o=round.darkAngelOutcome;return !!o&&same(round,replayDarkAngelCombatRound(o.source,o.stance).round);}catch{return false;}}
export function nextDarkAngelCombatSource(o:DarkAngelRoundOutcome):DarkAngelCombatSource {const spirituality=Math.min(120,o.playerSpiritualityAfter+12);return {...structuredClone(o.source),revision:o.source.revision+1,round:o.round+1,playerHealth:o.playerHealthAfter,playerMind:o.playerMindAfter,playerSpirituality:spirituality,enemyHealth:o.enemyHealth,enemyMind:o.enemyMind,enemySpirituality:o.enemySpirituality,playerInjuries:structuredClone(o.playerInjuriesAfter),enemyInjuries:structuredClone(o.enemyInjuriesAfter),playerRisk:o.playerRiskAfter,enemyRisk:o.enemyRiskAfter,site:structuredClone(o.siteAfter),grazing:structuredClone(o.grazingAfter),reserve:structuredClone(o.reserveAfter),operation:structuredClone(o.operationAfter),mastery:{...o.masteryAfter},budget:{...structuredClone(o.source.budget),health:o.playerHealthAfter,mind:o.playerMindAfter,spirituality,mastery:{...o.masteryAfter},injuries:structuredClone(o.playerInjuriesAfter),injuryRisk:o.playerRiskAfter},powerUses:{...o.powerUses},note:structuredClone(o.noteAfter),marks:structuredClone(o.marksAfter),lastForceReceipt:structuredClone(o.lastForceReceipt),conditionVersion:o.conditionVersion,clockSeconds:o.clockSecondsAfter,randomCursor:o.randomCursorAfter};}
export function darkAngelCombatConsequence(round:SliceCombatRound):string {const o=round.darkAngelOutcome;if(!o)throw new Error('缺少暗天使真实回合来源。');const who=round.winner==='PLAYER'?'埃德加':'你';let text=round.retreat==='SUCCESS'?'通过撤离判定，将沿4米普通通路退出，步行4米4秒。':round.consequenceDomain==='BODY'?`${who}承受实际身体攻势，身体伤势检验${round.consequenceRoll}/100（轻${round.consequenceWeights!.light}/重${round.consequenceWeights!.heavy}/死亡${round.consequenceWeights!.death}）。`:round.consequenceDomain==='MENTAL'?`${who}承受实际精神压力，精神−10，没有身体伤口或身体风险。`:'本轮没有实际致伤来源，不掷身体伤势盘。';if(o.playerHealthAfter===0)text+='你已死亡，原身体与持物留在庭院。';else if(o.enemyStatus==='DEAD')text+='埃德加已死亡，原身体与原棍留在庭院。';else if(o.enemyStatus==='SURRENDERED')text+='埃德加停止抵抗，亲自将自己的原棍放在脚边。';else if(o.playerMindAfter===0)text+='精神耗尽，停止交战并沿普通出口退出。';return `45岁的埃德加·沃德持独立原棍；玛拉实际在院外，旧对手仍在各自原处。${text} 本轮60秒；同一封条余${o.noteAfter.charges}/3、磨损${o.noteAfter.wear}；对手印记余${o.marksAfter.filter(m=>m.status==='HELD').length}/3。实际支出、旧伤与旧物不回填；未用窗口轮末失效。`;}
export function projectDarkAngelCombat(s:SliceState){const e=s.darkAngel.encounter,visible=isDarkAngel(s),last=s.combat?.encounterId==='DARK_ANGEL_DISPUTE'?s.combat.lastRound?.darkAngelOutcome:e.terminal?s.combatHistory[e.terminal.historyIndex]?.darkAngelOutcome:null;return{enemyName:visible?'埃德加·沃德（45岁）':'',targetId:visible?e.targetId:null,playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,maxSpirituality:120,enemyHealth:visible?e.enemyHealth:null,enemyMind:visible?e.enemyMind:null,enemySpirituality:visible?e.enemySpirituality:null,powerUses:visible?{...e.powerUses}:null,site:visible?structuredClone(e.currentSite):null,note:visible?structuredClone(e.note):null,marks:visible?structuredClone(e.marks):[],policy:e.policy,originalExit:true,pursuit:false,distanceMetres:2,automaticAllyImmunity:false,alliesPresent:0,source:visible?currentDarkAngelCombatSource(s):null,lastActionSequence:visible&&last?[...last.playerActions.map(a=>({...structuredClone(a),actor:'PLAYER' as const})),...last.enemyActions.map(a=>({...structuredClone(a),actor:'ENEMY' as const}))].sort((a,b)=>a.order-b.order):[],countWheel:DARK_ANGEL_COUNT_WHEEL.map(x=>({...x})),enemyCountWheel:DARK_ANGEL_ENEMY_COUNT_WHEEL.map(x=>({...x})),enemyAbilityWheel:DARK_ANGEL_ENEMY_ABILITY_WHEEL.map(x=>({...x})),summary:visible?'体50%感20%意20%知10%，基础1500、核心上限300、状态最多减40%、底150。双方1至6动作10/15/25/25/15/10；保留旧八槽140票，新增两槽各20。每动作5秒、每轮60秒；继续战斗仅本人回12灵性。单灵引导与护持各实付8本人灵性、2精神、3原灵灵性，失败总计4精神；同一时刻一位已选原灵，一个20秒窗口，实际应用耗封条1次。缺资源普通回退，不恢复灵魂或旧物。':''};}
export type DarkAngelCombatProjection=ReturnType<typeof projectDarkAngelCombat>;
