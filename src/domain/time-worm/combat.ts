import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import { FATE_TROJAN_COUNT_WHEEL, fateTrojanActionCount } from '../fate-trojan/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { TIME_WORM_TARGET_ID, TIME_WORM_SITE, TIME_WORM_POWER_IDS, TIME_WORM_POWERS, TIME_WORM_POLICIES,
 combatBody, initialTimeWormBody, hasTimeWormDisputeOpponent, validateTimeWormPreparation, validTimeWormMaterials, validTimeWormScene,
 type TimeWormCombatBody, type TimeWormEnemyIntent, type TimeWormPreparation, type TimeWormMaterials, type TimeWormScene, type TimeWormPolicy } from './encounter.js';

/** Bounded Error S1: exact predecessor count distribution and fourteen old
 * masteries; one future action, a real three-second delay, no new action slots.
 * Adrian's separate S1 body uses authored core24; old Elias's core20 is untouched. */
export const TIME_WORM_COUNT_WHEEL=FATE_TROJAN_COUNT_WHEEL;
export const TIME_WORM_ENEMY_COUNT_WHEEL=FATE_TROJAN_COUNT_WHEEL;
export const timeWormActionCount=fateTrojanActionCount;
export const timeWormEnemyActionCount=fateTrojanActionCount;
export const TIME_WORM_COMBAT_CONSTANTS={weights:{physique:.35,perception:.25,will:.25,knowledge:.15},tier:1250,floor:125,maxSpirituality:120,continuingRecovery:12,enemyPhysique:24,shortTimeTheftCost:8,shortTimeTheftMindCost:2,shortTimeTheftReduction:30,timeReleaseCost:6,timeReleaseMindCost:2,timeReleaseAid:30,windowSeconds:3,slotSeconds:1,resistanceChance:30} as const;
export const SHORT_TIME_THEFT='error.s1.short-time-theft',TIME_RELEASE='error.s1.time-release';
export const TIME_WORM_NEW_ABILITY_IDS=[SHORT_TIME_THEFT,TIME_RELEASE] as const;
export const TIME_WORM_INHERITED_SKILL_IDS=['error.s9.agility','error.s9.dexterity','error.s9.theft','error.s8.deceit','error.s7.decryption','error.s6.power-theft','error.s6.borrowed-power','error.s5.thought-theft','error.s4.parasitism','error.s4.deferred-thought','error.s3.law-deceit','error.s3.deep-deception','error.s2.identity-link','error.s2.fate-assumption'] as const;
const DECEIT='error.s3.deep-deception';
export type TimeWormMoveId=typeof TIME_WORM_INHERITED_SKILL_IDS[number]|typeof TIME_WORM_NEW_ABILITY_IDS[number]|'STRIKE'|'BLOCK'|'EVADE'|'OBSERVE'|'ACCIDENT';
const inheritedLabels:Record<typeof TIME_WORM_INHERITED_SKILL_IDS[number],string>={
 'error.s9.agility':'敏捷：本槽没有额外能力条件，普通行动',
 'error.s9.dexterity':'灵巧：本槽没有已核实的原物操作，普通行动',
 'error.s9.theft':'偷取：对手仍牢握自有原棍，不凭空取走装备',
 'error.s8.deceit':'骗术：没有本场另行声明的欺诈条件，普通行动',
 'error.s7.decryption':'解密：本场没有待解原密文，条件不可用',
 'error.s6.power-theft':'偷取非凡能力：未建立本场能力窃取条件，条件不可用',
 'error.s6.borrowed-power':'有限借用所偷能力：没有实际借用库存，条件不可用',
 'error.s5.thought-theft':'当前念头窃取与立即执行：没有本场可窃的已核实念头，条件不可用',
 'error.s4.parasitism':'有限寄生与共享感官：没有寄生关系，原托马斯自主且不在场',
 'error.s4.deferred-thought':'当前念头暂存与延后显现：没有当次暂存念头，条件不可用',
 'error.s3.law-deceit':'规则欺瞒：没有本场可用原规则对象，条件不可用',
 'error.s3.deep-deception':'深层欺瞒：6灵性、知识18，实际减势30',
 'error.s2.identity-link':'身份关联：原登记室识别不在本场，条件不可用',
 'error.s2.fate-assumption':'命运承担：原搬运已经结清，没有本场新义务',
};
export const TIME_WORM_ABILITIES:readonly{id:TimeWormMoveId;label:string;weight:number;stance:SliceStance|null}[]=[
 {id:'STRIKE',label:'本人普通打击',weight:12,stance:'ATTACK'},{id:'BLOCK',label:'普通防备',weight:5,stance:'DEFEND'},
 {id:'EVADE',label:'普通避让',weight:5,stance:'DEFEND'},{id:'OBSERVE',label:'实际侧步观察当前位置与待执行动作',weight:4,stance:'PREPARE'},
 ...TIME_WORM_INHERITED_SKILL_IDS.map(id=>({id,label:inheritedLabels[id],weight:id===DECEIT?7:1,stance:'CONTROL' as SliceStance})),
 {id:SHORT_TIME_THEFT,label:'短时窃取：8灵性2精神、感知18与30%抵抗，下一原动作实际推迟3秒',weight:14,stance:'CONTROL'},
 {id:TIME_RELEASE,label:'暂存时段释放：6灵性2精神、意志18，仅用本人实际储备辅助下一原普通打击30',weight:14,stance:'PREPARE'},
 {id:'ACCIDENT',label:'判断失衡：−22.5',weight:3,stance:null},
];
export const TIME_WORM_PLAYER_ABILITIES=TIME_WORM_ABILITIES;
export const TIME_WORM_ENEMY_ABILITY_WHEEL:readonly SliceWheelEntry[]=[
 {id:'BODY_MARK',label:'身体冲击印记：7灵性与1枚原印记、身体贡献75，身体后果',weight:30},
 {id:'MENTAL_MARK',label:'精神牵引印记：7灵性与1枚原印记、精神贡献65',weight:25},
 {id:'BODY_STRIKE',label:'自有原棍普通打击20×身体',weight:25},
 {id:'FEINT',label:'侧移1米并横棍遮挡：3灵性、每轮一次',weight:15},
 {id:'ACCIDENT',label:'判断偏差−22.5',weight:5},
];
export const isTimeWorm=(s:SliceState)=>s.progression.pathwayId==='error'&&s.progression.sequence===1;
const tickets=(stance:SliceStance|null)=>TIME_WORM_ABILITIES.map(a=>a.weight*(a.stance===stance&&stance!==null?5:4));
export function timeWormAbilityWheel(_s:SliceState,stance:SliceStance|null):SliceWheelEntry[]{const w=tickets(stance),total=w.reduce((n,v)=>n+v,0);return TIME_WORM_ABILITIES.map((a,i)=>({id:a.id,label:a.label,weight:w[i]!/total*100}));}
export function drawTimeWormAbility(rng:ActionRandomStream,_s:SliceState|null,stance:SliceStance|null):TimeWormMoveId{const w=tickets(stance);let n=rng.nextInt(1,w.reduce((a,b)=>a+b,0));for(const[i,a]of TIME_WORM_ABILITIES.entries()){n-=w[i]!;if(n<=0)return a.id;}throw new Error('行动盘无效。');}
export function drawTimeWormEnemyAbility(rng:ActionRandomStream):TimeWormEnemyIntent{let n=rng.nextInt(1,100);for(const a of TIME_WORM_ENEMY_ABILITY_WHEEL){n-=a.weight;if(n<=0)return a.id as TimeWormEnemyIntent;}throw new Error('对手行动盘无效。');}
const same=(a:unknown,b:unknown)=>a===b||(a!==undefined&&b!==undefined&&stableStringify(a)===stableStringify(b));
const integer=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER):n is number=>Number.isSafeInteger(n)&&(n as number)>=min&&(n as number)<=max;
const shape=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...keys].sort());
const physicalAt=(n:number)=>n>75?1:n>50?.95:n>25?.9:.8;
export interface TimeWormCombatSource {
 runId:string;revision:number;week:number;date:PublicGameDate;round:number;encounterId:'TIME_WORM_DISPUTE';targetId:typeof TIME_WORM_TARGET_ID;
 attemptWeek:number;startHistoryIndex:number;targetName:'艾德里安·凯斯';targetAge:45;targetSequence:1;targetCore:24;actualBody:true;independentMind:true;playerBodyId:string;
 enemyWeapon:'TW1-ADRIAN-CLUB';weaponOwner:typeof TIME_WORM_TARGET_ID;ordinaryExit:'OPEN';pursuit:false;thirdPartiesInArea:0;policy:TimeWormPolicy;clubHeld:boolean;
 playerHealth:number;playerMind:number;playerSpirituality:number;playerInjuries:SliceInjury[];playerRisk:number;physique:number;perception:number;will:number;knowledge:number;mastery:Record<string,number>;
 preparation:TimeWormPreparation;root:TimeWormScene;materials:TimeWormMaterials;body:TimeWormCombatBody;randomSeed:string;randomCursor:number;
}
export function currentTimeWormCombatSource(s:SliceState):TimeWormCombatSource|null {
 if(!hasTimeWormDisputeOpponent(s))return null;const e=s.timeWorm.encounter,c=s.combat!;
 return{runId:s.runId,revision:s.revision,week:s.week,date:{...s.date},round:c.round,encounterId:'TIME_WORM_DISPUTE',targetId:TIME_WORM_TARGET_ID,attemptWeek:e.attemptWeek!,startHistoryIndex:e.startHistoryIndex!,targetName:'艾德里安·凯斯',targetAge:45,targetSequence:1,targetCore:24,actualBody:true,independentMind:true,playerBodyId:`${s.runId}:body`,enemyWeapon:'TW1-ADRIAN-CLUB',weaponOwner:TIME_WORM_TARGET_ID,ordinaryExit:'OPEN',pursuit:false,thirdPartiesInArea:0,policy:e.policy,clubHeld:s.town.clubLocation==='HAND',playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,playerInjuries:structuredClone(s.injuries),playerRisk:s.injuryRisk,...s.character.coreStats,mastery:{...s.progression.mastery},preparation:structuredClone(e.preparation!),root:structuredClone(e.scene),materials:structuredClone(e.materials),body:combatBody(e),randomSeed:s.random.seed,randomCursor:s.random.cursor};
}
export interface TimeWormPendingAction {
 id:string;planned:TimeWormEnemyIntent;actual:TimeWormEnemyIntent;declaredAt:number;scheduledAt:number;dueAt:number;observedAt:number|null;observationSeconds:0;
 conditionVersion:number;visible:boolean;targetId:typeof TIME_WORM_TARGET_ID;enemyCoordinate:6|7;playerCoordinate:4;attackKind:'NONE'|'BODY'|'MENTAL';
 status:'PENDING'|'DELAYED';theftOrder:number|null;heldFrom:number|null;delayedBySeconds:0|3;
}
export interface TimeWormWindow {id:string;kind:'SHORT_TIME_THEFT'|'TIME_RELEASE';createdAt:number;expiresAt:number;openedOrder:number;conditionVersion:number;targetActionId:string;targetId:typeof TIME_WORM_TARGET_ID;enemyCoordinate:6|7;playerCoordinate:4;magnitude:30;sourceTheftId:string}
/** These are two states of ONE personal reserve. The enemy's dueAt is separate,
 * so consuming or invalidating this reserve never refunds its elapsed delay. */
export interface TimeWormWindows {shortTimeTheft:TimeWormWindow|null;timeRelease:TimeWormWindow|null}
export interface TimeWormDelayEvidence {targetActionId:string;theftOrder:number;scheduledAt:number;heldFrom:number;dueAt:number;executedAt:number;delayedBySeconds:3;reduction:number;conditionMatched:boolean}
export interface TimeWormWaitEvidence {fromSeconds:number;toSeconds:number;seconds:number;reason:'DELAYED_ENEMY'|'ROUND_REMAINDER';targetActionId:string|null}
export interface TimeWormActionEvidence {
 order:number;actor:'PLAYER'|'ENEMY';id:string;planned:string;selectedAbility:string;fallbackReason:string|null;label:string;selfGain:number;enemyReduction:number;threatens:boolean;mentalPressure:boolean;attackKind:'NONE'|'BODY'|'MENTAL';rawContribution:number;rawReduction:number;
 paidCost:number;mindCost:number;physicalFactor:number;check:PublicCheckResult|null;resistanceRoll:number|null;resistanceChance:number|null;succeeded:boolean;
 finiteResult:'NONE'|'UNAVAILABLE'|'ALREADY_ATTEMPTED'|'INSUFFICIENT'|'FAILED'|'RESISTED'|'PENDING'|'APPLIED';windowsBefore:TimeWormWindows;windowsAfter:TimeWormWindows;pendingBefore:TimeWormPendingAction|null;pendingAfter:TimeWormPendingAction|null;masteryApplied:string[];countered:string[];
 consumedMarkId:string|null;materialsBefore:TimeWormMaterials;materialsAfter:TimeWormMaterials;targetDelay:TimeWormDelayEvidence|null;consumedReserveId:string|null;
 conditionVersionBefore:number;conditionVersionAfter:number;atSeconds:number;completedAtSeconds:number;elapsedSeconds:1;travelMetres:number;travelPath:number[];lateralTravelPath:number[];randomCursorBefore:number;randomCursorAfter:number;playerMindAfter:number;playerSpiritualityAfter:number;enemyMindAfter:number;enemySpiritualityAfter:number;
}
export interface TimeWormRuntime {body:TimeWormCombatBody;root:TimeWormScene;materials:TimeWormMaterials;playerH:number;playerM:number;playerS:number;mastery:Record<string,number>;windows:TimeWormWindows;expiredWindows:TimeWormWindow[];pendingEnemyAction:TimeWormPendingAction|null;shortTimeTheftAttempted:boolean;timeReleaseAttempted:boolean;feintUsed:boolean;waits:TimeWormWaitEvidence[];targetDelays:TimeWormDelayEvidence[]}
export function createTimeWormRuntime(x:TimeWormCombatSource):TimeWormRuntime{return{body:structuredClone(x.body),root:structuredClone(x.root),materials:structuredClone(x.materials),playerH:x.playerHealth,playerM:x.playerMind,playerS:x.playerSpirituality,mastery:{...x.mastery},windows:{shortTimeTheft:null,timeRelease:null},expiredWindows:[],pendingEnemyAction:null,shortTimeTheftAttempted:false,timeReleaseAttempted:false,feintUsed:false,waits:[],targetDelays:[]};}
const active=(r:TimeWormRuntime)=>r.root.playerLocation==='YARD'&&r.root.playerCoordinate===4&&r.root.ordinaryExit==='OPEN'&&r.body.enemyStatus==='RESISTING'&&r.body.enemyHealth>0&&r.body.enemyMind>0&&r.playerH>0&&r.playerM>0;
const observed=(r:TimeWormRuntime)=>active(r)&&r.root.visibleBodyLine&&r.root.observedConditionVersion===r.root.conditionVersion;
function invalidate(r:TimeWormRuntime,key:keyof TimeWormWindows):void{const w=r.windows[key];if(w)r.expiredWindows.push(structuredClone(w));r.windows[key]=null;}
const sameEndpoint=(r:TimeWormRuntime,w:TimeWormWindow)=>w.conditionVersion===r.root.conditionVersion&&w.enemyCoordinate===r.root.enemyCoordinate&&w.playerCoordinate===r.root.playerCoordinate&&w.targetId===TIME_WORM_TARGET_ID;
export function advanceTimeWormCombatClock(r:TimeWormRuntime,seconds:number):void {
 if(!integer(seconds))throw new Error('实际时间无效。');r.root.clockSeconds+=seconds;r.root.externalSeconds+=seconds;
 for(const key of ['shortTimeTheft','timeRelease'] as const){const w=r.windows[key];if(w&&(w.expiresAt<=r.root.clockSeconds||!observed(r)||!sameEndpoint(r,w)))invalidate(r,key);}
}
function waitUntil(r:TimeWormRuntime,to:number,reason:TimeWormWaitEvidence['reason']):void{
 const from=r.root.clockSeconds;if(to<from)throw new Error('不能倒流真实时间。');if(to===from)return;
 r.waits.push({fromSeconds:from,toSeconds:to,seconds:to-from,reason,targetActionId:reason==='DELAYED_ENEMY'?r.pendingEnemyAction?.id??null:null});advanceTimeWormCombatClock(r,to-from);
}
/** The next drawn enemy slot is declared once, before its execution. A paid
 * delay can reorder only already-counted player slots, never create new slots. */
export function declareTimeWormEnemyAction(x:TimeWormCombatSource,r:TimeWormRuntime,planned:TimeWormEnemyIntent,index:number,scheduledAt=r.root.clockSeconds+1):TimeWormPendingAction {
 if(!active(r)||r.pendingEnemyAction||!integer(scheduledAt,r.root.clockSeconds)||![...TIME_WORM_ENEMY_ABILITY_WHEEL.map(a=>a.id),'OBSERVE'].includes(planned))throw new Error('不能覆盖待执行动作或替已停战者行动。');
 const power=TIME_WORM_POWERS.find(p=>p.id===planned),mark=planned==='BODY_MARK'||planned==='MENTAL_MARK';
 const actual:TimeWormEnemyIntent=power&&(r.body.enemySpirituality<power.cost||mark&&!r.materials.marks.some(m=>m.status==='HELD'))?'BODY_STRIKE':planned==='FEINT'&&(r.feintUsed||!observed(r))?'OBSERVE':planned;
 const visible=observed(r);r.pendingEnemyAction={id:`${x.runId}:TW1-PENDING:${x.round}:${index}`,planned,actual,declaredAt:r.root.clockSeconds,scheduledAt,dueAt:scheduledAt,observedAt:visible?r.root.clockSeconds:null,observationSeconds:0,conditionVersion:r.root.conditionVersion,visible,targetId:TIME_WORM_TARGET_ID,enemyCoordinate:r.root.enemyCoordinate,playerCoordinate:4,attackKind:actual==='BODY_STRIKE'||actual==='BODY_MARK'?'BODY':actual==='MENTAL_MARK'?'MENTAL':'NONE',status:'PENDING',theftOrder:null,heldFrom:null,delayedBySeconds:0};
 return structuredClone(r.pendingEnemyAction);
}
function baseAction(r:TimeWormRuntime,actor:'PLAYER'|'ENEMY',id:string,order:number,rng:ActionRandomStream):TimeWormActionEvidence {
 advanceTimeWormCombatClock(r,0);
 return{order,actor,id,planned:id,selectedAbility:id,fallbackReason:null,label:'',selfGain:0,enemyReduction:0,threatens:false,mentalPressure:false,attackKind:'NONE',rawContribution:0,rawReduction:0,paidCost:0,mindCost:0,physicalFactor:physicalAt(actor==='PLAYER'?r.playerH:r.body.enemyHealth),check:null,resistanceRoll:null,resistanceChance:null,succeeded:false,finiteResult:'NONE',windowsBefore:structuredClone(r.windows),windowsAfter:structuredClone(r.windows),pendingBefore:structuredClone(r.pendingEnemyAction),pendingAfter:null,masteryApplied:[],countered:[],consumedMarkId:null,materialsBefore:structuredClone(r.materials),materialsAfter:structuredClone(r.materials),targetDelay:null,consumedReserveId:null,conditionVersionBefore:r.root.conditionVersion,conditionVersionAfter:r.root.conditionVersion,atSeconds:r.root.clockSeconds,completedAtSeconds:r.root.clockSeconds+1,elapsedSeconds:1,travelMetres:0,travelPath:[actor==='PLAYER'?r.root.playerCoordinate:r.root.enemyCoordinate],lateralTravelPath:[0],randomCursorBefore:rng.cursor,randomCursorAfter:rng.cursor,playerMindAfter:r.playerM,playerSpiritualityAfter:r.playerS,enemyMindAfter:r.body.enemyMind,enemySpiritualityAfter:r.body.enemySpirituality};
}
function closeAction(a:TimeWormActionEvidence,r:TimeWormRuntime,rng:ActionRandomStream):TimeWormActionEvidence{advanceTimeWormCombatClock(r,1);a.completedAtSeconds=r.root.clockSeconds;a.windowsAfter=structuredClone(r.windows);a.pendingAfter=structuredClone(r.pendingEnemyAction);a.materialsAfter=structuredClone(r.materials);a.conditionVersionAfter=r.root.conditionVersion;a.randomCursorAfter=rng.cursor;a.playerMindAfter=r.playerM;a.playerSpiritualityAfter=r.playerS;a.enemyMindAfter=r.body.enemyMind;a.enemySpiritualityAfter=r.body.enemySpirituality;a.threatens=a.attackKind==='BODY'&&a.selfGain>0;a.mentalPressure=a.attackKind==='MENTAL'&&a.selfGain>0;a.label+=` 实际1秒（${a.atSeconds}→${a.completedAtSeconds}），本人灵性${r.playerS}、精神${r.playerM}，对手灵性${r.body.enemySpirituality}。`;return a;}
function ordinary(x:TimeWormCombatSource,r:TimeWormRuntime,a:TimeWormActionEvidence,why:string,attack=false){a.selectedAbility=attack?'STRIKE':'BLOCK';a.fallbackReason=why||null;a.label=why+(attack?'本人用原身体普通打击。':'本人普通防备。');a.succeeded=true;if(attack){const target=r.root.enemyCoordinate;a.selfGain=(x.clubHeld?16:12)*a.physicalFactor;a.attackKind='BODY';a.travelMetres=2*(target-4);a.travelPath=[4,target,4];r.root.playerTravelMetres+=a.travelMetres;a.label+=`实际走近并退回原出口点，共${a.travelMetres}米。`;}else a.enemyReduction=10;}
function pay(r:TimeWormRuntime,a:TimeWormActionEvidence,s:number,m=0){if(r.playerS<s||r.playerM<=m)return false;r.playerS-=s;r.playerM-=m;r.body.totalOwnerMindSpent+=m;a.paidCost=s;a.mindCost=m;return true;}
function check(x:TimeWormCombatSource,a:TimeWormActionEvidence,ability:'knowledge'|'perception'|'will',difficulty:number,rng:ActionRandomStream){a.check=resolveNormalCheck({ability,baseAbility:x[ability],difficulty,modifiers:[],roll:rng.nextInt(1,100)});a.succeeded=['SUCCESS','GREAT_SUCCESS'].includes(a.check.tier);a.label+=`${ability==='perception'?'感知':ability==='will'?'意志':'知识'}检定${a.check.roll}，${a.succeeded?'成功':'失败'}。`;return a.succeeded;}
function resist(a:TimeWormActionEvidence,rng:ActionRandomStream){a.resistanceChance=30;a.resistanceRoll=rng.nextInt(1,100);if(a.resistanceRoll<=30){a.succeeded=false;a.finiteResult='RESISTED';a.label+='对方实际抵抗，成本保留。';return false;}return true;}
function gainMastery(r:TimeWormRuntime,a:TimeWormActionEvidence,id:string){r.mastery[id]=Math.min(500,(r.mastery[id]??0)+8);a.masteryApplied.push(id);}
function pendingObserved(r:TimeWormRuntime,p:TimeWormPendingAction|null):p is TimeWormPendingAction{return !!p&&observed(r)&&p.visible&&p.observedAt!==null&&p.observedAt<=r.root.clockSeconds&&p.conditionVersion===r.root.conditionVersion&&p.enemyCoordinate===r.root.enemyCoordinate&&p.playerCoordinate===r.root.playerCoordinate&&p.targetId===TIME_WORM_TARGET_ID;}
export function resolveTimeWormPlayerSlot(x:TimeWormCombatSource,r:TimeWormRuntime,id:TimeWormMoveId,order:number,rng:ActionRandomStream):TimeWormActionEvidence {
 if(!TIME_WORM_ABILITIES.some(a=>a.id===id))throw new Error('未知本人动作。');const a=baseAction(r,'PLAYER',id,order,rng);
 if(!active(r)){a.finiteResult='UNAVAILABLE';a.label='本人或对手已离场、死亡或停止抵抗，没有新效果。';return closeAction(a,r,rng);}
 if(x.policy==='ORDINARY'&&id.startsWith('error.')){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'预先选择只作普通行动；');}
 else if(id===SHORT_TIME_THEFT){
  const allowed=x.policy==='ALL'||x.policy==='SHORT_TIME_THEFT'||x.policy==='TIME_RELEASE',p=r.pendingEnemyAction;
  if(!allowed){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'所选策略不允许新能力；');}
  else if(r.shortTimeTheftAttempted){a.finiteResult='ALREADY_ATTEMPTED';ordinary(x,r,a,'本轮短时窃取已实付尝试一次；');}
  else if(!pendingObserved(r,p)||p.status!=='PENDING'||r.root.clockSeconds>p.scheduledAt){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'没有眼前仍待执行、尚未窃取的下一原动作；');}
  else if(!pay(r,a,8,2)){a.finiteResult='INSUFFICIENT';ordinary(x,r,a,'不足8灵性或2精神；');}
  else{
   r.shortTimeTheftAttempted=true;r.body.shortTimeTheftAttempts++;a.label='对眼前同一次未来动作实付短时窃取。';
   if(!check(x,a,'perception',18,rng))a.finiteResult='FAILED';
   else{r.body.shortTimeTheftChecks++;if(resist(a,rng)){
    const created=a.completedAtSeconds,windowId=`TW1-THEFT:${x.round}:${order}:${created}`;
    p.status='DELAYED';p.theftOrder=order;p.heldFrom=created;p.delayedBySeconds=3;p.dueAt=created+3;
    r.windows.shortTimeTheft={id:windowId,kind:'SHORT_TIME_THEFT',createdAt:created,expiresAt:created+3,openedOrder:order,conditionVersion:p.conditionVersion,targetActionId:p.id,targetId:p.targetId,enemyCoordinate:p.enemyCoordinate,playerCoordinate:4,magnitude:30,sourceTheftId:windowId};
    a.finiteResult='PENDING';a.label+=`施放完成后，原动作到${p.dueAt}秒前不能执行；本人仅保存同一3秒储备。此槽没有贡献或掌握奖励。`;
   }}
  }
 }else if(id===TIME_RELEASE){
  const charge=r.windows.shortTimeTheft,allowed=x.policy==='ALL'||x.policy==='TIME_RELEASE';
  if(!allowed){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'所选策略不允许释放；');}
  else if(r.timeReleaseAttempted){a.finiteResult='ALREADY_ATTEMPTED';ordinary(x,r,a,'本轮释放已实付尝试一次；');}
  else if(!charge||!observed(r)||!sameEndpoint(r,charge)||charge.expiresAt<=a.completedAtSeconds){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'没有本人实得且在本次施放结束后仍未到期的储备；');}
  else if(!pay(r,a,6,2)){a.finiteResult='INSUFFICIENT';ordinary(x,r,a,'不足6灵性或2精神；');}
  else{r.timeReleaseAttempted=true;r.body.timeReleaseAttempts++;a.label='只释放本人先前实得的同一短时储备。';
   // A paid release attempt consumes this reserve even if its check fails.
   r.windows.shortTimeTheft=null;a.consumedReserveId=charge.id;
   if(!check(x,a,'will',18,rng)){a.finiteResult='FAILED';a.label+='释放失败，储备与成本不退；目标原延迟仍然保留。';}
   else{r.body.timeReleaseChecks++;r.windows.timeRelease={...charge,id:`TW1-RELEASE:${x.round}:${order}:${a.completedAtSeconds}`,kind:'TIME_RELEASE',openedOrder:order};a.finiteResult='PENDING';a.label+=`仅下一次本人原有普通打击在${charge.expiresAt}秒之前实际完成才获得30辅助；不增动作、不取消目标延迟。`;}
  }
 }else if(id==='STRIKE')ordinary(x,r,a,'',true);
 else if(id==='BLOCK'||id==='EVADE')ordinary(x,r,a,'');
 else if(id==='OBSERVE'){
  a.label='本人实际侧走一米观察当前位置，再走一米回到原出口路线。';a.travelMetres=2;a.lateralTravelPath=[0,1,0];r.root.playerTravelMetres+=2;r.root.visibleBodyLine=true;r.root.observedConditionVersion=r.root.conditionVersion;a.succeeded=true;
  if(r.pendingEnemyAction){r.pendingEnemyAction.visible=true;r.pendingEnemyAction.conditionVersion=r.root.conditionVersion;r.pendingEnemyAction.enemyCoordinate=r.root.enemyCoordinate;r.pendingEnemyAction.observedAt=r.root.clockSeconds;}
 }else if(id==='ACCIDENT'){a.selfGain=-22.5;a.label='判断失衡，固定−22.5，不重抽。';}
 else if(id===DECEIT){
  if(!observed(r)){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'当前视线或施术线路不清；');}
  else if(!pay(r,a,6)){a.finiteResult='INSUFFICIENT';ordinary(x,r,a,'不足原能力所需6灵性；');}
  else{a.label='按既有成本使用深层欺瞒。';if(check(x,a,'knowledge',18,rng)){a.enemyReduction=30;r.body.inheritedSuccesses.deepDeception++;gainMastery(r,a,id);a.finiteResult='APPLIED';}else a.finiteResult='FAILED';}
 }else{a.selectedAbility='OBSERVE';a.finiteResult='UNAVAILABLE';a.fallbackReason=inheritedLabels[id];a.label=a.fallbackReason+'；本槽普通观察，不施法、不造原条件或掌握。';}
 a.rawContribution=a.selfGain;a.rawReduction=a.enemyReduction;
 const aid=r.windows.timeRelease;
 // Strict completion boundary: a strike completing exactly at dueAt is too late.
 if(aid&&aid.openedOrder<order&&id==='STRIKE'&&a.succeeded&&a.selfGain>0&&a.completedAtSeconds<aid.expiresAt&&sameEndpoint(r,aid)&&observed(r)){
  r.windows.timeRelease=null;a.consumedReserveId=aid.id;a.selfGain+=30;r.body.timeReleaseSuccesses++;gainMastery(r,a,TIME_RELEASE);a.finiteResult='APPLIED';a.label+='这次实际普通打击消费先前释放的辅助30；目标剩余延迟仍保留。';
 }
 return closeAction(a,r,rng);
}
export function resolveTimeWormEnemySlot(x:TimeWormCombatSource,r:TimeWormRuntime,planned:TimeWormEnemyIntent,order:number,rng:ActionRandomStream):TimeWormActionEvidence {
 if(!active(r)){const a=baseAction(r,'ENEMY',planned,order,rng);a.finiteResult='UNAVAILABLE';a.label='原人已离场、死亡或停战，停止新效果。';return closeAction(a,r,rng);}
 if(!r.pendingEnemyAction)declareTimeWormEnemyAction(x,r,planned,order,r.root.clockSeconds);const p=r.pendingEnemyAction!;
 if(p.planned!==planned)throw new Error('不能替换已声明的待执行动作。');
 if(r.root.clockSeconds<p.dueAt)waitUntil(r,p.dueAt,'DELAYED_ENEMY');
 const a=baseAction(r,'ENEMY',p.actual,order,rng);a.planned=planned;a.selectedAbility=p.actual;const power=TIME_WORM_POWERS.find(v=>v.id===p.actual);
 if(power){if(r.body.enemySpirituality<power.cost)throw new Error('已声明对手资源不一致。');r.body.enemySpirituality-=power.cost;r.body.powerUses[power.id]++;a.paidCost=power.cost;a.selfGain=power.selfGain;a.enemyReduction=power.enemyReduction;a.succeeded=true;
  if(power.id==='BODY_MARK'||power.id==='MENTAL_MARK'){
   const mark=r.materials.marks.find(m=>m.status==='HELD');if(!mark)throw new Error('没有可消费的原印记。');mark.status='SPENT';mark.usedRound=x.round;a.consumedMarkId=mark.id;a.attackKind=power.id==='BODY_MARK'?'BODY':'MENTAL';
   if(observed(r))r.body.observations.push({power:power.id,conditionVersion:r.root.conditionVersion,round:x.round,order,atSeconds:r.root.clockSeconds,paidCost:7});
  }else{r.feintUsed=true;const from=r.root.enemyCoordinate;r.root.enemyCoordinate=from===6?7:6;r.root.enemyTravelMetres++;a.travelMetres=1;a.travelPath=[from,r.root.enemyCoordinate];r.root.conditionVersion++;r.root.visibleBodyLine=false;for(const key of ['shortTimeTheft','timeRelease'] as const){if(r.windows[key])a.countered.push(r.windows[key]!.id);invalidate(r,key);}}
  a.label=`艾德里安实际使用${power.label}，独立灵性−${power.cost}${a.consumedMarkId?`，消费原件${a.consumedMarkId}`:''}。`;
 }else if(p.actual==='BODY_STRIKE'){const from=r.root.enemyCoordinate;a.selfGain=20*a.physicalFactor;a.attackKind='BODY';a.travelMetres=2*(from-4);a.travelPath=[from,4,from];r.root.enemyTravelMetres+=a.travelMetres;a.succeeded=true;a.label=`艾德里安持自己的原棍走近普通打击再退回，共${a.travelMetres}米；资源不足时不施法、不重抽。`;}
 else if(p.actual==='ACCIDENT'){a.selfGain=-22.5;a.label='对手判断偏差，−22.5，不重抽。';}else a.label='对手普通观察，没有额外资源。';
 a.rawContribution=a.selfGain;a.rawReduction=a.enemyReduction;
 if(p.status==='DELAYED'&&p.theftOrder!==null&&p.heldFrom!==null){
  const conditionMatched=pendingObserved(r,p),reduction=conditionMatched&&a.atSeconds>=p.dueAt&&['BODY','MENTAL'].includes(a.attackKind)?Math.min(30,Math.max(0,a.selfGain)):0;
  a.targetDelay={targetActionId:p.id,theftOrder:p.theftOrder,scheduledAt:p.scheduledAt,heldFrom:p.heldFrom,dueAt:p.dueAt,executedAt:a.atSeconds,delayedBySeconds:3,reduction,conditionMatched};r.targetDelays.push(structuredClone(a.targetDelay));
  a.selfGain-=reduction;if(reduction>0){r.body.shortTimeTheftSuccesses++;gainMastery(r,a,SHORT_TIME_THEFT);a.finiteResult='APPLIED';a.label+=`同一原动作真实等到${p.dueAt}秒才执行；仅这次未来${a.attackKind==='BODY'?'身体':'精神'}贡献减${reduction}。`;}
 }
 r.pendingEnemyAction=null;return closeAction(a,r,rng);
}
export interface TimeWormRoundOutcome extends TimeWormCombatBody {
 targetId:typeof TIME_WORM_TARGET_ID;round:number;source:TimeWormCombatSource;stance:SliceStance;continuing:boolean;playerHealthAfter:number;playerMindAfter:number;playerSpiritualityAfter:number;playerInjuriesAfter:SliceInjury[];playerRiskAfter:number;materialsAfter:TimeWormMaterials;masteryAfter:Record<string,number>;rootAfter:TimeWormScene;elapsedSeconds:60;randomCursorAfter:number;playerActions:TimeWormActionEvidence[];enemyActions:TimeWormActionEvidence[];expiredWindows:TimeWormWindow[];windowsAfter:TimeWormWindows;pendingEnemyActionAfter:null;waits:TimeWormWaitEvidence[];targetDelays:TimeWormDelayEvidence[];
}
export type TimeWormResolution='CONTINUE'|'PLAYER_DEAD'|'ENEMY_DEAD'|'ENEMY_SURRENDERED'|'RETREATED';
function penalty(n:number,max:number){const f=n/max;return f>.75?0:f>.5?.05:f>.25?.1:.2;}
function base(core:number,h:number,m:number,s:number){return(1250+Math.min(core,250))*(1-Math.min(.4,penalty(h,100)+penalty(m,100)+penalty(s,120)));}
function weights(risk:number){const death=Math.min(100,5+Math.min(risk,10)*10),shifted=death-5;return{light:Math.max(0,65-shifted),heavy:Math.max(0,30-Math.max(0,shifted-65)),death};}
export function validTimeWormBody(b:TimeWormCombatBody):boolean {
 return integer(b.enemyHealth,0,100)&&integer(b.enemyMind,0,100)&&integer(b.enemySpirituality,0,120)&&integer(b.enemyRisk)&&Array.isArray(b.enemyInjuries)&&['RESISTING','SURRENDERED','DEAD'].includes(b.enemyStatus)&&(b.enemyStatus==='DEAD')===(b.enemyHealth===0)&&(b.enemyMind>0||b.enemyStatus!=='RESISTING')&&['HAND','YARD'].includes(b.weaponLocation)&&(b.enemyStatus==='RESISTING'||b.weaponLocation==='YARD')&&shape(b.powerUses,TIME_WORM_POWER_IDS)&&TIME_WORM_POWER_IDS.every(id=>integer(b.powerUses[id]))&&b.enemySpirituality===120-TIME_WORM_POWERS.reduce((n,p)=>n+p.cost*b.powerUses[p.id],0)&&b.powerUses.BODY_MARK+b.powerUses.MENTAL_MARK<=3&&integer(b.totalOwnerMindSpent)&&integer(b.shortTimeTheftAttempts)&&integer(b.timeReleaseAttempts)&&integer(b.shortTimeTheftChecks,0,b.shortTimeTheftAttempts)&&integer(b.timeReleaseChecks,0,b.timeReleaseAttempts)&&integer(b.shortTimeTheftSuccesses,0,b.shortTimeTheftChecks)&&integer(b.timeReleaseSuccesses,0,b.timeReleaseChecks)&&b.totalOwnerMindSpent===2*(b.shortTimeTheftAttempts+b.timeReleaseAttempts)&&shape(b.inheritedSuccesses,['deepDeception'])&&Object.values(b.inheritedSuccesses).every(n=>integer(n))&&Array.isArray(b.observations)&&b.observations.every((o,i)=>shape(o,['power','conditionVersion','round','order','atSeconds','paidCost'])&&['BODY_MARK','MENTAL_MARK'].includes(o.power)&&integer(o.conditionVersion,1,b.powerUses.FEINT+1)&&integer(o.round,1)&&integer(o.order,0,11)&&integer(o.atSeconds,4)&&o.paidCost===7&&(i===0||b.observations[i-1]!.atSeconds<o.atSeconds))&&b.observations.filter(o=>o.power==='BODY_MARK').length<=b.powerUses.BODY_MARK&&b.observations.filter(o=>o.power==='MENTAL_MARK').length<=b.powerUses.MENTAL_MARK;
}
export function validTimeWormInjuries(injuries:SliceInjury[],revision:number):boolean{return Array.isArray(injuries)&&new Set(injuries.map(i=>i.id)).size===injuries.length&&injuries.every(i=>shape(i,['id','severity','acquiredRevision','treatedRevision'])&&typeof i.id==='string'&&!!i.id&&['LIGHT','HEAVY'].includes(i.severity)&&integer(i.acquiredRevision,0,revision)&&(i.treatedRevision===null||integer(i.treatedRevision,i.acquiredRevision,revision)));}
const SOURCE_KEYS=['runId','revision','week','date','round','encounterId','targetId','attemptWeek','startHistoryIndex','targetName','targetAge','targetSequence','targetCore','actualBody','independentMind','playerBodyId','enemyWeapon','weaponOwner','ordinaryExit','pursuit','thirdPartiesInArea','policy','clubHeld','playerHealth','playerMind','playerSpirituality','playerInjuries','playerRisk','physique','perception','will','knowledge','mastery','preparation','root','materials','body','randomSeed','randomCursor'];
export function validTimeWormCombatSource(x:TimeWormCombatSource):boolean {
 try{const p=x.root,prep=x.preparation;
 return shape(x,SOURCE_KEYS)&&shape(x.body,Object.keys(initialTimeWormBody()))&&validateTimeWormPreparation(prep)&&typeof x.runId==='string'&&!!x.runId&&integer(x.revision)&&x.week===prep.week&&isValidGameDate(x.date)&&same(x.date,prep.date)&&integer(x.round,1)&&integer(x.startHistoryIndex)&&x.attemptWeek===x.week&&x.encounterId==='TIME_WORM_DISPUTE'&&x.targetId===TIME_WORM_TARGET_ID&&x.targetName==='艾德里安·凯斯'&&x.targetAge===45&&x.targetSequence===1&&x.targetCore===24&&x.actualBody===true&&x.independentMind===true&&x.playerBodyId===`${x.runId}:body`&&x.enemyWeapon==='TW1-ADRIAN-CLUB'&&x.weaponOwner===TIME_WORM_TARGET_ID&&x.ordinaryExit==='OPEN'&&x.pursuit===false&&x.thirdPartiesInArea===0&&TIME_WORM_POLICIES.includes(x.policy)&&x.clubHeld===prep.playerClubHeld&&
 [x.playerHealth,x.playerMind].every(n=>integer(n,1,100))&&integer(x.playerSpirituality,0,120)&&[x.physique,x.perception,x.will,x.knowledge].every(n=>integer(n,0,500))&&same({physique:x.physique,perception:x.perception,will:x.will,knowledge:x.knowledge},prep.after.coreStats)&&shape(x.mastery,[...TIME_WORM_INHERITED_SKILL_IDS,...TIME_WORM_NEW_ABILITY_IDS])&&Object.values(x.mastery).every(n=>integer(n,0,500))&&same(Object.keys(x.mastery).sort(),Object.keys(prep.after.mastery).sort())&&TIME_WORM_INHERITED_SKILL_IDS.every(id=>x.mastery[id]===Math.min(500,prep.after.mastery[id]!+8*(id===DECEIT?x.body.inheritedSuccesses.deepDeception:0)))&&x.mastery[SHORT_TIME_THEFT]===Math.min(500,prep.after.mastery[SHORT_TIME_THEFT]!+8*x.body.shortTimeTheftSuccesses)&&x.mastery[TIME_RELEASE]===Math.min(500,prep.after.mastery[TIME_RELEASE]!+8*x.body.timeReleaseSuccesses)&&
 integer(x.playerRisk)&&validTimeWormInjuries(x.playerInjuries,x.revision)&&validTimeWormInjuries(x.body.enemyInjuries,x.revision)&&validTimeWormMaterials(x.materials)&&x.materials.weapon.location===x.body.weaponLocation&&x.materials.marks.filter(m=>m.status==='SPENT').length===x.body.powerUses.BODY_MARK+x.body.powerUses.MENTAL_MARK&&x.materials.marks.every(m=>m.usedRound===null||m.usedRound<x.round)&&x.body.shortTimeTheftAttempts<=x.round-1&&x.body.timeReleaseAttempts<=x.round-1&&x.body.powerUses.FEINT<=x.round-1&&x.body.inheritedSuccesses.deepDeception<=6*(x.round-1)&&
 validTimeWormScene(p)&&p.siteId===TIME_WORM_SITE&&p.playerLocation==='YARD'&&p.observedSourceId===`${x.runId}:TW1-YARD:${prep.revision}`&&p.observationWeek===prep.week&&p.knownPlayerName===prep.playerName&&p.knownEnemyName==='艾德里安·凯斯'&&p.clockSeconds===4+60*(x.round-1)&&p.conditionVersion===1+x.body.powerUses.FEINT&&p.enemyCoordinate===(x.body.powerUses.FEINT%2?7:6)&&p.enemyTravelMetres>=x.body.powerUses.FEINT&&validTimeWormBody(x.body)&&x.body.enemyStatus==='RESISTING'&&x.body.enemyMind>0&&typeof x.randomSeed==='string'&&!!x.randomSeed&&x.randomSeed.length<=256&&integer(x.randomCursor)&&prep.runId===x.runId&&prep.randomSeed===x.randomSeed&&prep.randomCursor<=x.randomCursor&&prep.revision<=x.revision-x.round&&x.body.observations.every(o=>o.round<x.round&&o.atSeconds<p.clockSeconds);
 }catch{return false;}
}
export const validateTimeWormCombatSource=validTimeWormCombatSource;
/** Shared actual consequence resolver, exposed for declared isolated BODY/MENTAL
 * tests without seeking or replacing any campaign seed/cursor. */
export function resolveTimeWormConsequences(x:TimeWormCombatSource,r:TimeWormRuntime,players:TimeWormActionEvidence[],enemies:TimeWormActionEvidence[],winner:'PLAYER'|'ENEMY',retreat:SliceCombatRound['retreat'],rng:ActionRandomStream) {
  const b=r.body;
  let playerHealth = r.playerH, playerRisk = x.playerRisk, outcome: TimeWormResolution = retreat === 'SUCCESS' ? 'RETREATED' : b.enemyMind === 0 ? 'ENEMY_SURRENDERED' : 'CONTINUE';
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
export function replayTimeWormCombatRound(x: TimeWormCombatSource, stance: SliceStance): { round: SliceCombatRound; outcome: TimeWormResolution } {
  if (!validTimeWormCombatSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new Error('缺少真实原来源。');
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = createTimeWormRuntime(x), b = r.body;
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = timeWormActionCount(playerCountRoll), enemyCount = timeWormEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: TimeWormActionEvidence[] = [], enemies: TimeWormActionEvidence[] = [], remaining = { PLAYER: playerCount, ENEMY: enemyCount }; let retreat: SliceCombatRound['retreat'] = 'NONE';
  if (b.enemyMind === 0) remaining.PLAYER = remaining.ENEMY = 0;
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) for (const actor of order) {
    if (!remaining[actor]) continue;
    if (actor === 'PLAYER' && stance === 'RETREAT') { remaining.PLAYER = 0; retreat = rng.nextInt(1, 100) <= 50 ? 'SUCCESS' : 'FAILURE'; if (retreat === 'SUCCESS') { remaining.ENEMY = 0; break; } continue; }
    if (remaining.ENEMY > 0 && !r.pendingEnemyAction) declareTimeWormEnemyAction(x, r, drawTimeWormEnemyAbility(rng), enemies.length, r.root.clockSeconds+(actor==='PLAYER'?1:0));
    // A blocked enemy slot remains counted and pending. Only already-drawn
    // player slots may proceed during its delay; no new turn is generated.
    if(actor==='ENEMY'&&r.pendingEnemyAction&&r.root.clockSeconds<r.pendingEnemyAction.dueAt&&remaining.PLAYER>0&&stance!=='RETREAT')continue;
    remaining[actor]--; const index = players.length + enemies.length;
    if (actor === 'PLAYER') players.push(resolveTimeWormPlayerSlot(x, r, drawTimeWormAbility(rng, null, stance), index, rng));
    else enemies.push(resolveTimeWormEnemySlot(x, r, r.pendingEnemyAction!.planned, index, rng));
    if (b.enemyMind === 0) { b.enemyStatus = 'SURRENDERED'; remaining.PLAYER = remaining.ENEMY = 0; break; }
  }
  const sum = (a: TimeWormActionEvidence[], key: 'selfGain' | 'enemyReduction') => a.reduce((n, v) => n + v[key], 0);
  const core = x.physique * .35 + x.perception * .25 + x.will * .25 + x.knowledge * .15;
  const playerAdvantage = Math.max(125, base(core, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, base(x.targetCore, x.body.enemyHealth, x.body.enemyMind, x.body.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction'));
  const winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100, winner = retreat === 'SUCCESS' ? 'ENEMY' : b.enemyMind === 0 ? 'PLAYER' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  const {playerHealth,playerRisk,outcome,playerInjuries,consequenceWeights,consequenceRoll,consequenceDomain}=resolveTimeWormConsequences(x,r,players,enemies,winner,retreat,rng);
  waitUntil(r,x.root.clockSeconds+60,'ROUND_REMAINDER');
  for (const key of ['shortTimeTheft','timeRelease'] as const) { if (r.windows[key]) r.expiredWindows.push(structuredClone(r.windows[key]!)); r.windows[key] = null; }
  r.pendingEnemyAction = null; if (b.enemyStatus !== 'RESISTING') r.materials.weapon.location = 'YARD'; b.weaponLocation = r.materials.weapon.location;
  const o: TimeWormRoundOutcome = { ...structuredClone(b), targetId: TIME_WORM_TARGET_ID, round: x.round, source: structuredClone(x), stance, continuing: outcome === 'CONTINUE',
    playerHealthAfter: playerHealth, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, playerInjuriesAfter: playerInjuries, playerRiskAfter: playerRisk, materialsAfter: structuredClone(r.materials), masteryAfter: { ...r.mastery },
    rootAfter: structuredClone(r.root), elapsedSeconds: 60, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies, expiredWindows: r.expiredWindows,
    windowsAfter: structuredClone(r.windows), pendingEnemyActionAfter: null, waits:structuredClone(r.waits), targetDelays:structuredClone(r.targetDelays) };
  const round: SliceCombatRound = { round: x.round, stance, first, playerCount, enemyCount, playerCountRoll, enemyCountRoll,
    moves: [...players, ...enemies].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })),
    playerAdvantage, enemyAdvantage, winChance, winner, consequence: '', consequenceWeights, retreat, ...(consequenceDomain === undefined ? {} : { consequenceDomain }), ...(consequenceRoll === undefined ? {} : { consequenceRoll }), timeWormOutcome: o };
  round.consequence = timeWormCombatConsequence(round); return { round, outcome };
}
export function validateTimeWormRoundOutcome(v: unknown): v is TimeWormRoundOutcome { try { const o = v as TimeWormRoundOutcome; return !!o && same(o, replayTimeWormCombatRound(o.source, o.stance).round.timeWormOutcome); } catch { return false; } }
export function validateTimeWormCombatRound(round: SliceCombatRound): boolean { try { const o = round.timeWormOutcome; return !!o && same(round, replayTimeWormCombatRound(o.source, o.stance).round); } catch { return false; } }
export function nextTimeWormCombatSource(o: TimeWormRoundOutcome): TimeWormCombatSource {
  return { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter,
    playerSpirituality: Math.min(120, o.playerSpiritualityAfter + 12), playerInjuries: structuredClone(o.playerInjuriesAfter), playerRisk: o.playerRiskAfter,
    root: structuredClone(o.rootAfter), body: combatBody(o), materials: structuredClone(o.materialsAfter), mastery: { ...o.masteryAfter }, randomCursor: o.randomCursorAfter };
}
export function timeWormCombatConsequence(round: SliceCombatRound): string {
  const o = round.timeWormOutcome!, who = round.winner === 'PLAYER' ? '艾德里安' : '你';
  let text = round.retreat === 'SUCCESS' ? '撤离判定成功，将沿普通4米出口实际离开。' : round.consequenceDomain === 'MENTAL' ? `${who}承受实际精神压力，精神减少10，没有新增身体伤口或身体风险。` : round.consequenceDomain === 'BODY' ? `${who}承受实际物理攻击，按共同伤势盘结算，实掷${round.consequenceRoll}/100（轻${round.consequenceWeights!.light}/重${round.consequenceWeights!.heavy}/死亡${round.consequenceWeights!.death}）。` : '本轮没有实际致伤来源，不掷身体伤势盘、不增加身体风险。';
  const attacks = round.winner === 'PLAYER' ? o.playerActions : o.enemyActions;
  if (round.consequenceDomain) text += ` 实际${round.consequenceDomain === 'BODY' ? '身体' : '精神'}来源：${attacks.filter(a => round.consequenceDomain === 'BODY' ? a.threatens : a.mentalPressure).map(a => a.selectedAbility).join('、')}。`;
  text += ` 本人健康${o.source.playerHealth}→${o.playerHealthAfter}、精神${o.source.playerMind}→${o.playerMindAfter}；艾德里安健康${o.source.body.enemyHealth}→${o.enemyHealth}、精神${o.source.body.enemyMind}→${o.enemyMind}。`;
  if (o.playerHealthAfter > 0 && o.playerMindAfter === 0) text += '本人精神耗尽，仍活着，停止抵抗后沿普通出口离开。';
  if (o.playerHealthAfter === 0) text += '本人的原身体真实死亡，本周目终结。'; else if (o.enemyHealth === 0) text += '艾德里安原身体真实死亡，唯一原棍留地。'; else if (o.enemyStatus === 'SURRENDERED') text += '艾德里安因实际伤势或精神耗尽自主停止抵抗，仍活着，原棍放在地面。';
  return text + ' 本轮实际60秒；未使用窗口到时结束，已经花费的灵性与精神不退。同一原棍和三枚印记的实际消耗保留，莉娜、维克托与旧遭遇人物不在场；原识别、原包、已结清搬运与旧寄生关系没有补发或改写。';
}

export function projectTimeWormCombat(s:SliceState){
 const e=s.timeWorm.encounter,known=e.scene.knownEnemyName!==null,last=s.combat?.encounterId==='TIME_WORM_DISPUTE'?s.combat.lastRound?.timeWormOutcome:e.terminal?s.combatHistory[e.terminal.historyIndex]?.timeWormOutcome:null;
 return{enemyName:known?'艾德里安·凯斯（45岁）':null,targetId:e.targetId,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,weaponLocation:e.weaponLocation,powerUses:{...e.powerUses},policy:e.policy,scene:structuredClone(e.scene),materials:structuredClone(e.materials),remainingMarkIds:e.materials.marks.filter(m=>m.status==='HELD').map(m=>m.id),lastActionSequence:last?[...last.playerActions,...last.enemyActions].sort((a,b)=>a.order-b.order):[],windows:last?structuredClone(last.windowsAfter):{shortTimeTheft:null,timeRelease:null},waits:last?structuredClone(last.waits):[],targetDelays:last?structuredClone(last.targetDelays):[],constants:TIME_WORM_COMBAT_CONSTANTS,countWheel:TIME_WORM_COUNT_WHEEL,enemyCountWheel:TIME_WORM_ENEMY_COUNT_WHEEL,abilityWheel:timeWormAbilityWheel(s,null),enemyAbilityWheel:TIME_WORM_ENEMY_ABILITY_WHEEL,facts:[
 '体35%、感25%、意25%、知15%；双方1至6动作10/15/25/25/15/10，基础1250、底125、上限120，仅继续轮恢复12。',
 '短时窃取8灵性2精神、感知18并受30%抵抗；未来原动作实际推迟3秒，只削弱其实际身体或精神贡献30。',
 '暂存时段释放6灵性2精神、意志18；只消费本人实际储备，下一原普通打击必须在原到期时刻之前实际完成，辅助30。',
 '每轮各一次，失败照付；三秒到期或遮挡销毁未用储备。释放不取消目标已产生的延迟，不增行动，不撤销旧伤害。',
 '三枚原印记共用有限库存，每次实耗7灵性与一枚；身体印记走共同身体伤势盘，精神印记单独造成精神后果。']};
}
