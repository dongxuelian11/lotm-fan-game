import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import { LIGHT_SEEKER_COUNT_WHEEL, lightSeekerActionCount } from '../light-seeker/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { PURE_WHITE_ANGEL_TARGET_ID, PURE_WHITE_ANGEL_SITE, PURE_WHITE_ANGEL_POWER_IDS, PURE_WHITE_ANGEL_POWERS, PURE_WHITE_ANGEL_POLICIES,
  combatBody, initialPureWhiteAngelBody, hasPureWhiteAngelDisputeOpponent, validatePureWhiteAngelPreparation,
  validPureWhiteAngelMaterials, validPureWhiteAngelScene, type PureWhiteAngelCombatBody, type PureWhiteAngelEnemyIntent,
  type PureWhiteAngelPreparation, type PureWhiteAngelMaterials, type PureWhiteAngelScene, type PureWhiteAngelPolicy } from './encounter.js';

/** Finite original sunlight mechanics in a separate forecourt. No original
 * gallery object, dead body, spirit, charm or residue unit is imported. */
export const PURE_WHITE_ANGEL_COUNT_WHEEL=LIGHT_SEEKER_COUNT_WHEEL;
export const PURE_WHITE_ANGEL_ENEMY_COUNT_WHEEL=LIGHT_SEEKER_COUNT_WHEEL;
export const pureWhiteAngelActionCount=lightSeekerActionCount;
export const pureWhiteAngelEnemyActionCount=lightSeekerActionCount;
export const PURE_WHITE_ANGEL_COMBAT_CONSTANTS={weights:{physique:.35,perception:.25,will:.25,knowledge:.15},tier:1250,floor:125,maxSpirituality:120,continuingRecovery:12,enemyPhysique:24,focusedPurificationCost:8,focusedPurificationMindCost:2,focusedPurificationAid:30,warmRadianceGuardCost:6,warmRadianceGuardMindCost:2,warmRadianceGuardReduction:30,windowSeconds:30,resistanceChance:30,slotSeconds:5,roundSeconds:60} as const;
export const FOCUSED_PURIFICATION='sun.s1.focused-purification',WARM_RADIANCE_GUARD='sun.s1.warm-radiance-guard';
export const PURE_WHITE_ANGEL_NEW_ABILITY_IDS=[FOCUSED_PURIFICATION,WARM_RADIANCE_GUARD] as const;
export const PURE_WHITE_ANGEL_INHERITED_SKILL_IDS=[
 'sun.s9.praise','sun.s9.courage','sun.s8.light','sun.s8.solar-flame','sun.s8.ritual',
 'sun.s7.holy-light','sun.s7.sacred-oath','sun.s7.sun-aura','sun.s7.holy-water',
 'sun.s6.notarization','sun.s6.signed-contract','sun.s5.holy-light','sun.s5.purification-aura',
 'sun.s4.unshadowed-domain','sun.s4.purification','sun.s4.sunflare',
 'sun.s3.shared-radiance','sun.s3.clarity-mark','sun.s2.guided-radiance','sun.s2.limited-light',
] as const;
export type PureWhiteAngelMoveId=typeof PURE_WHITE_ANGEL_INHERITED_SKILL_IDS[number]|typeof PURE_WHITE_ANGEL_NEW_ABILITY_IDS[number]|'STRIKE'|'BLOCK'|'EVADE'|'OBSERVE'|'ACCIDENT';
type Ability='physique'|'knowledge'|'perception'|'will';
interface InheritedPower {id:PureWhiteAngelMoveId;label:string;cost:number;ability:Ability;difficulty:number;gain:number;reduction:number;kind:'BODY'|'MENTAL'|'NONE';physical:boolean;fixed?:boolean}
/** Existing IDs, finite costs and authored budgets. Zero mastery is learned.
 * Conditional rituals, holy water, contracts, aura and eight-metre sunflare
 * retain their entries but cannot invent missing originals or a safe perimeter. */
export const PURE_WHITE_ANGEL_INHERITED_POWERS:readonly InheritedPower[]=[
 {id:'sun.s9.praise',label:'继承自身短吟',cost:2,ability:'will',difficulty:12,gain:8,reduction:0,kind:'NONE',physical:false},
 {id:'sun.s9.courage',label:'继承勇气短歌',cost:0,ability:'will',difficulty:12,gain:0,reduction:5.2,kind:'NONE',physical:false},
 {id:'sun.s8.light',label:'继承有限日光',cost:0,ability:'will',difficulty:14,gain:19.5,reduction:0,kind:'BODY',physical:false},
 {id:'sun.s8.solar-flame',label:'继承有限金焰',cost:0,ability:'will',difficulty:14,gain:10.5,reduction:0,kind:'BODY',physical:false},
 {id:'sun.s7.holy-light',label:'继承有限圣光',cost:0,ability:'will',difficulty:14,gain:35.1,reduction:0,kind:'BODY',physical:false},
 {id:'sun.s7.sacred-oath',label:'继承本人自愿誓约',cost:0,ability:'will',difficulty:14,gain:0,reduction:14.625,kind:'NONE',physical:false},
 {id:'sun.s7.sun-aura',label:'继承有限光环干扰',cost:0,ability:'will',difficulty:14,gain:0,reduction:7.875,kind:'NONE',physical:false},
 {id:'sun.s5.holy-light',label:'继承强化圣光',cost:4,ability:'knowledge',difficulty:14,gain:24,reduction:0,kind:'BODY',physical:false},
 {id:'sun.s4.unshadowed-domain',label:'继承有限无暗领域',cost:5,ability:'will',difficulty:16,gain:0,reduction:18,kind:'NONE',physical:false},
 {id:'sun.s4.purification',label:'继承有限净化光攻击',cost:6,ability:'will',difficulty:18,gain:34,reduction:0,kind:'BODY',physical:false},
 {id:'sun.s3.shared-radiance',label:'继承本槽自身鼓舞',cost:6,ability:'will',difficulty:18,gain:65,reduction:0,kind:'NONE',physical:false,fixed:true},
 {id:'sun.s3.clarity-mark',label:'继承观察原杆动作',cost:6,ability:'knowledge',difficulty:18,gain:0,reduction:32,kind:'NONE',physical:false,fixed:true},
 {id:'sun.s2.guided-radiance',label:'继承定向辉光',cost:7,ability:'will',difficulty:20,gain:105,reduction:0,kind:'BODY',physical:false,fixed:true},
];
const NOTARIZATION='sun.s6.notarization',LIMITED_LIGHT='sun.s2.limited-light';
export const PURE_WHITE_ANGEL_ABILITIES:readonly{id:PureWhiteAngelMoveId;label:string;weight:number;stance:SliceStance|null}[]=[
 {id:'STRIKE',label:'本人普通打击',weight:12,stance:'ATTACK'},{id:'BLOCK',label:'普通防备',weight:5,stance:'DEFEND'},{id:'EVADE',label:'普通避让',weight:5,stance:'DEFEND'},{id:'OBSERVE',label:'实际走近揭开原罩并观察',weight:4,stance:'PREPARE'},
 ...PURE_WHITE_ANGEL_INHERITED_SKILL_IDS.map(id=>{const p=PURE_WHITE_ANGEL_INHERITED_POWERS.find(p=>p.id===id);return{id,label:p?`${p.label}：${p.cost}灵性，实际检定与抵抗`:id===NOTARIZATION?'能力公证：3灵性、知识14，仅后续一次实际圣光×1.15':id===LIMITED_LIGHT?'限光：6灵性、知识20，仅后续一次实际光击减45':'没有原材料、自愿契约或安全施术条件，普通观察',weight:p||id===NOTARIZATION||id===LIMITED_LIGHT?7:1,stance:(p?.kind==='BODY'?'ATTACK':p?.reduction?'DEFEND':'CONTROL') as SliceStance};}),
 {id:FOCUSED_PURIFICATION,label:'净光定向：8灵性2精神、意志18，下一真实威胁攻击加30',weight:14,stance:'CONTROL'},
 {id:WARM_RADIANCE_GUARD,label:'温光护持：6灵性2精神、知识18，下一可见身体冲击减30',weight:14,stance:'DEFEND'},
 {id:'ACCIDENT',label:'判断失衡：−22.5',weight:3,stance:null},
];
export const PURE_WHITE_ANGEL_PLAYER_ABILITIES=PURE_WHITE_ANGEL_ABILITIES;
export const PURE_WHITE_ANGEL_ENEMY_ABILITY_WHEEL:readonly SliceWheelEntry[]=[
 {id:'LIGHT_STRIKE',label:'原杆有限光击：7灵性与1原储能、身体贡献105',weight:25},
 {id:'LIGHT_WARD',label:'有限防光：6灵性，本轮一次抵后续光击最多60',weight:20},
 {id:'DAZZLING_PRESSURE',label:'有限眩光压力：7灵性、精神贡献65',weight:20},
 {id:'BODY_STRIKE',label:'自有原杆普通打击：20×身体',weight:20},
 {id:'OBSCURE',label:'关闭自己的原罩：3灵性、每轮一次，改变条件与视线',weight:10},
 {id:'ACCIDENT',label:'判断偏差：−22.5',weight:5},
];
export const isPureWhiteAngel=(s:SliceState)=>s.progression.pathwayId==='sun'&&s.progression.sequence===1;
const tickets=(stance:SliceStance|null)=>PURE_WHITE_ANGEL_ABILITIES.map(a=>a.weight*(a.stance===stance&&stance!==null?5:4));
export function pureWhiteAngelAbilityWheel(_s:SliceState,stance:SliceStance|null):SliceWheelEntry[]{const w=tickets(stance),total=w.reduce((n,v)=>n+v,0);return PURE_WHITE_ANGEL_ABILITIES.map((a,i)=>({id:a.id,label:a.label,weight:w[i]!/total*100}));}
export function drawPureWhiteAngelAbility(rng:ActionRandomStream,_s:SliceState|null,stance:SliceStance|null):PureWhiteAngelMoveId{const w=tickets(stance);let n=rng.nextInt(1,w.reduce((a,b)=>a+b,0));for(const[i,a]of PURE_WHITE_ANGEL_ABILITIES.entries()){n-=w[i]!;if(n<=0)return a.id;}throw new Error('行动盘无效。');}
export function drawPureWhiteAngelEnemyAbility(rng:ActionRandomStream):PureWhiteAngelEnemyIntent{let n=rng.nextInt(1,100);for(const a of PURE_WHITE_ANGEL_ENEMY_ABILITY_WHEEL){n-=a.weight;if(n<=0)return a.id as PureWhiteAngelEnemyIntent;}throw new Error('对手行动盘无效。');}
const same=(a:unknown,b:unknown)=>a===b||(a!==undefined&&b!==undefined&&stableStringify(a)===stableStringify(b));
const integer=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER):n is number=>Number.isSafeInteger(n)&&(n as number)>=min&&(n as number)<=max;
const shape=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...keys].sort());
const physicalAt=(n:number)=>n>75?1:n>50?.95:n>25?.9:.8;
export interface PureWhiteAngelCombatSource {
 runId:string;revision:number;week:number;date:PublicGameDate;round:number;encounterId:'PURE_WHITE_ANGEL_DISPUTE';targetId:typeof PURE_WHITE_ANGEL_TARGET_ID;
 attemptWeek:number;startHistoryIndex:number;targetName:'西拉斯·戴恩';targetAge:49;targetSequence:1;targetCore:24;actualBody:true;independentMind:true;playerBodyId:string;
 enemyWeapon:'PW1-SILAS-ROD';weaponOwner:typeof PURE_WHITE_ANGEL_TARGET_ID;ordinaryExit:'OPEN';pursuit:false;thirdPartiesInArea:0;policy:PureWhiteAngelPolicy;clubHeld:boolean;
 playerHealth:number;playerMind:number;playerSpirituality:number;playerInjuries:SliceInjury[];playerRisk:number;physique:number;perception:number;will:number;knowledge:number;mastery:Record<string,number>;
 preparation:PureWhiteAngelPreparation;root:PureWhiteAngelScene;materials:PureWhiteAngelMaterials;body:PureWhiteAngelCombatBody;randomSeed:string;randomCursor:number;
}
export function currentPureWhiteAngelCombatSource(s:SliceState):PureWhiteAngelCombatSource|null {
 if(!hasPureWhiteAngelDisputeOpponent(s))return null;const e=s.pureWhiteAngel.encounter,c=s.combat!;
 return{runId:s.runId,revision:s.revision,week:s.week,date:{...s.date},round:c.round,encounterId:'PURE_WHITE_ANGEL_DISPUTE',targetId:PURE_WHITE_ANGEL_TARGET_ID,attemptWeek:e.attemptWeek!,startHistoryIndex:e.startHistoryIndex!,targetName:'西拉斯·戴恩',targetAge:49,targetSequence:1,targetCore:24,actualBody:true,independentMind:true,playerBodyId:`${s.runId}:body`,enemyWeapon:'PW1-SILAS-ROD',weaponOwner:PURE_WHITE_ANGEL_TARGET_ID,ordinaryExit:'OPEN',pursuit:false,thirdPartiesInArea:0,policy:e.policy,clubHeld:s.town.clubLocation==='HAND',playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,playerInjuries:structuredClone(s.injuries),playerRisk:s.injuryRisk,...s.character.coreStats,mastery:{...s.progression.mastery},preparation:structuredClone(e.preparation!),root:structuredClone(e.scene),materials:structuredClone(e.materials),body:combatBody(e),randomSeed:s.random.seed,randomCursor:s.random.cursor};
}
export interface PureWhiteAngelPendingAction {id:string;planned:PureWhiteAngelEnemyIntent;actual:PureWhiteAngelEnemyIntent;declaredAt:number;observedAt:number;observationSeconds:0;conditionVersion:number;visible:boolean;bodyImpact:boolean}
export interface PureWhiteAngelWindow {id:string;kind:'FOCUSED_PURIFICATION'|'WARM_RADIANCE_GUARD'|'NOTARIZATION'|'LIMITED_LIGHT'|'LIGHT_WARD';createdAt:number;expiresAt:number;openedOrder:number;conditionVersion:number;targetId:typeof PURE_WHITE_ANGEL_TARGET_ID;targetActionId:string|null;magnitude:30|45|60|1.15}
export interface PureWhiteAngelWindows {focusedPurification:PureWhiteAngelWindow|null;warmRadianceGuard:PureWhiteAngelWindow|null;notarization:PureWhiteAngelWindow|null;limitedLight:PureWhiteAngelWindow|null;enemyWard:PureWhiteAngelWindow|null}
export interface PureWhiteAngelActionEvidence {
 order:number;actor:'PLAYER'|'ENEMY';id:string;planned:string;selectedAbility:string;fallbackReason:string|null;label:string;selfGain:number;enemyReduction:number;threatens:boolean;mentalPressure:boolean;attackKind:'NONE'|'BODY'|'MENTAL';lightEffect:boolean;rawContribution:number;rawReduction:number;
 paidCost:number;mindCost:number;physicalFactor:number;check:PublicCheckResult|null;resistanceRoll:number|null;resistanceChance:number|null;succeeded:boolean;
 finiteResult:'NONE'|'UNAVAILABLE'|'ALREADY_ATTEMPTED'|'INSUFFICIENT'|'FAILED'|'RESISTED'|'PENDING'|'APPLIED';windowsBefore:PureWhiteAngelWindows;windowsAfter:PureWhiteAngelWindows;pendingBefore:PureWhiteAngelPendingAction|null;pendingAfter:PureWhiteAngelPendingAction|null;masteryApplied:string[];countered:string[];
 rodChargeSpent:number;chargePieceId:string|null;materialsBefore:PureWhiteAngelMaterials;materialsAfter:PureWhiteAngelMaterials;conditionVersionBefore:number;conditionVersionAfter:number;atSeconds:number;elapsedSeconds:5;travelMetres:number;travelPath:number[];lateralTravelPath:number[];randomCursorBefore:number;randomCursorAfter:number;playerMindAfter:number;playerSpiritualityAfter:number;enemyMindAfter:number;enemySpiritualityAfter:number;
}
export interface PureWhiteAngelRuntime {body:PureWhiteAngelCombatBody;root:PureWhiteAngelScene;materials:PureWhiteAngelMaterials;playerH:number;playerM:number;playerS:number;mastery:Record<string,number>;windows:PureWhiteAngelWindows;expiredWindows:PureWhiteAngelWindow[];pendingEnemyAction:PureWhiteAngelPendingAction|null;focusedPurificationAttempted:boolean;warmRadianceGuardAttempted:boolean;limitedAttempted:boolean;wardAttempted:boolean;obscureUsed:boolean}
export function createPureWhiteAngelRuntime(x:PureWhiteAngelCombatSource):PureWhiteAngelRuntime{return{body:structuredClone(x.body),root:structuredClone(x.root),materials:structuredClone(x.materials),playerH:x.playerHealth,playerM:x.playerMind,playerS:x.playerSpirituality,mastery:{...x.mastery},windows:{focusedPurification:null,warmRadianceGuard:null,notarization:null,limitedLight:null,enemyWard:null},expiredWindows:[],pendingEnemyAction:null,focusedPurificationAttempted:false,warmRadianceGuardAttempted:false,limitedAttempted:false,wardAttempted:false,obscureUsed:false};}
const active=(r:PureWhiteAngelRuntime)=>r.root.playerLocation==='FORECOURT'&&r.root.playerCoordinate===4&&r.body.enemyStatus==='RESISTING'&&r.body.enemyHealth>0&&r.body.enemyMind>0&&r.playerH>0&&r.playerM>0;
const observed=(r:PureWhiteAngelRuntime)=>active(r)&&r.root.visibleBodyLine&&r.materials.screen.hood==='OPEN'&&r.root.observedConditionVersion===r.root.conditionVersion;
function invalidate(r:PureWhiteAngelRuntime,key:keyof PureWhiteAngelWindows):void {const w=r.windows[key];if(w)r.expiredWindows.push(structuredClone(w));r.windows[key]=null;}
export function advancePureWhiteAngelCombatClock(r:PureWhiteAngelRuntime,seconds:number):void {
 if(!integer(seconds))throw new Error('实际时间无效。');r.root.clockSeconds+=seconds;r.root.externalSeconds+=seconds;
 for(const key of ['focusedPurification','warmRadianceGuard','notarization','limitedLight','enemyWard'] as const){const w=r.windows[key];if(w&&(w.expiresAt<=r.root.clockSeconds||!observed(r)||w.conditionVersion!==r.root.conditionVersion))invalidate(r,key);}
}
export function declarePureWhiteAngelEnemyAction(x:PureWhiteAngelCombatSource,r:PureWhiteAngelRuntime,planned:PureWhiteAngelEnemyIntent,index:number):PureWhiteAngelPendingAction {
 if(!active(r)||r.pendingEnemyAction||![...PURE_WHITE_ANGEL_ENEMY_ABILITY_WHEEL.map(a=>a.id),'OBSERVE'].includes(planned))throw new Error('不能覆盖待执行动作或替已停战者行动。');
 const power=PURE_WHITE_ANGEL_POWERS.find(p=>p.id===planned);
 const actual:PureWhiteAngelEnemyIntent=power&&(r.body.enemySpirituality<power.cost||planned==='LIGHT_STRIKE'&&r.materials.weapon.charge===0)?'BODY_STRIKE'
  :planned==='OBSCURE'&&(r.obscureUsed||r.materials.screen.hood==='CLOSED')||planned==='LIGHT_WARD'&&r.wardAttempted||
    (planned==='LIGHT_STRIKE'||planned==='DAZZLING_PRESSURE')&&!observed(r)?'OBSERVE':planned;
 r.pendingEnemyAction={id:`${x.runId}:PW1-PENDING:${x.round}:${index}`,planned,actual,declaredAt:r.root.clockSeconds,observedAt:r.root.clockSeconds,observationSeconds:0,conditionVersion:r.root.conditionVersion,visible:observed(r),bodyImpact:actual==='LIGHT_STRIKE'||actual==='BODY_STRIKE'};
 return structuredClone(r.pendingEnemyAction);
}
function baseAction(r:PureWhiteAngelRuntime,actor:'PLAYER'|'ENEMY',id:string,order:number,rng:ActionRandomStream):PureWhiteAngelActionEvidence {
 advancePureWhiteAngelCombatClock(r,0);
 return{order,actor,id,planned:id,selectedAbility:id,fallbackReason:null,label:'',selfGain:0,enemyReduction:0,threatens:false,mentalPressure:false,attackKind:'NONE',lightEffect:false,rawContribution:0,rawReduction:0,paidCost:0,mindCost:0,physicalFactor:physicalAt(actor==='PLAYER'?r.playerH:r.body.enemyHealth),check:null,resistanceRoll:null,resistanceChance:null,succeeded:false,finiteResult:'NONE',windowsBefore:structuredClone(r.windows),windowsAfter:structuredClone(r.windows),pendingBefore:structuredClone(r.pendingEnemyAction),pendingAfter:null,masteryApplied:[],countered:[],rodChargeSpent:0,chargePieceId:null,materialsBefore:structuredClone(r.materials),materialsAfter:structuredClone(r.materials),conditionVersionBefore:r.root.conditionVersion,conditionVersionAfter:r.root.conditionVersion,atSeconds:r.root.clockSeconds,elapsedSeconds:5,travelMetres:0,travelPath:[actor==='PLAYER'?r.root.playerCoordinate:r.root.enemyCoordinate],lateralTravelPath:[0],randomCursorBefore:rng.cursor,randomCursorAfter:rng.cursor,playerMindAfter:r.playerM,playerSpiritualityAfter:r.playerS,enemyMindAfter:r.body.enemyMind,enemySpiritualityAfter:r.body.enemySpirituality};
}
function closeAction(a:PureWhiteAngelActionEvidence,r:PureWhiteAngelRuntime,rng:ActionRandomStream){advancePureWhiteAngelCombatClock(r,5);a.windowsAfter=structuredClone(r.windows);a.pendingAfter=structuredClone(r.pendingEnemyAction);a.materialsAfter=structuredClone(r.materials);a.conditionVersionAfter=r.root.conditionVersion;a.randomCursorAfter=rng.cursor;a.playerMindAfter=r.playerM;a.playerSpiritualityAfter=r.playerS;a.enemyMindAfter=r.body.enemyMind;a.enemySpiritualityAfter=r.body.enemySpirituality;a.threatens=a.attackKind==='BODY'&&a.selfGain>0;a.mentalPressure=a.attackKind==='MENTAL'&&(a.selfGain>0||a.enemyReduction>0);a.label+=` 实际5秒，条件${r.root.conditionVersion}，本人灵性${r.playerS}、精神${r.playerM}，对手灵性${r.body.enemySpirituality}。`;return a;}
function walkStrike(r:PureWhiteAngelRuntime,a:PureWhiteAngelActionEvidence){a.travelMetres=4;a.travelPath=[4,6,4];r.root.playerTravelMetres+=4;}
function ordinary(x:PureWhiteAngelCombatSource,r:PureWhiteAngelRuntime,a:PureWhiteAngelActionEvidence,why:string,attack=false){a.selectedAbility=attack?'STRIKE':'BLOCK';a.fallbackReason=why||null;a.label=why+(attack?'本人以实际持握原棍或原身体普通打击。':'本人普通防备。');a.succeeded=true;if(attack){a.selfGain=(x.clubHeld?16:12)*a.physicalFactor;a.attackKind='BODY';walkStrike(r,a);}else a.enemyReduction=10;}
function pay(r:PureWhiteAngelRuntime,a:PureWhiteAngelActionEvidence,s:number,m=0){if(r.playerS<s||r.playerM<=m)return false;r.playerS-=s;r.playerM-=m;r.body.totalOwnerMindSpent+=m;a.paidCost=s;a.mindCost=m;return true;}
function check(x:PureWhiteAngelCombatSource,a:PureWhiteAngelActionEvidence,ability:Ability,difficulty:number,rng:ActionRandomStream){a.check=resolveNormalCheck({ability,baseAbility:x[ability],difficulty,modifiers:[],roll:rng.nextInt(1,100)});a.succeeded=['SUCCESS','GREAT_SUCCESS'].includes(a.check.tier);a.label+=`${({physique:'体魄',knowledge:'知识',perception:'感知',will:'意志'})[ability]}检定${a.check.roll}，${a.succeeded?'成功':'失败'}。`;return a.succeeded;}
function resist(a:PureWhiteAngelActionEvidence,rng:ActionRandomStream){a.resistanceChance=30;a.resistanceRoll=rng.nextInt(1,100);if(a.resistanceRoll<=30){a.succeeded=false;a.finiteResult='RESISTED';a.label+='对方实际抵抗，成本保留。';return false;}return true;}
function gainMastery(r:PureWhiteAngelRuntime,a:PureWhiteAngelActionEvidence,id:string){r.mastery[id]=Math.min(500,(r.mastery[id]??0)+8);a.masteryApplied.push(id);if(PURE_WHITE_ANGEL_INHERITED_SKILL_IDS.includes(id as typeof PURE_WHITE_ANGEL_INHERITED_SKILL_IDS[number]))r.body.inheritedApplications[id]=(r.body.inheritedApplications[id]??0)+1;}
function window(r:PureWhiteAngelRuntime,kind:PureWhiteAngelWindow['kind'],order:number,target:string|null=null):PureWhiteAngelWindow {
 const legacy=kind==='NOTARIZATION'||kind==='LIMITED_LIGHT'||kind==='LIGHT_WARD';
 return{id:`PW1-${kind}-${r.root.clockSeconds}-${order}`,kind,createdAt:r.root.clockSeconds,
  expiresAt:legacy?r.root.clockSeconds+(60-(r.root.clockSeconds-4)%60):r.root.clockSeconds+30,
  openedOrder:order,conditionVersion:r.root.conditionVersion,targetId:PURE_WHITE_ANGEL_TARGET_ID,targetActionId:target,
  magnitude:kind==='NOTARIZATION'?1.15:kind==='LIMITED_LIGHT'?45:kind==='LIGHT_WARD'?60:30};
}
function reveal(r:PureWhiteAngelRuntime,a:PureWhiteAngelActionEvidence){
 a.selectedAbility='OBSERVE';a.succeeded=true;a.travelMetres=2;a.travelPath=[4,5,4];r.root.playerTravelMetres+=2;
 if(r.materials.screen.hood==='CLOSED'){r.materials.screen.hood='OPEN';r.materials.screen.operations++;r.body.screenReveals++;r.root.conditionVersion++;}
 r.root.visibleBodyLine=true;r.root.observedConditionVersion=r.root.conditionVersion;
 if(r.pendingEnemyAction){r.pendingEnemyAction.visible=true;r.pendingEnemyAction.conditionVersion=r.root.conditionVersion;r.pendingEnemyAction.observedAt=r.root.clockSeconds;}
 a.label='本人实际走一米到原罩，若关闭则揭开同一原罩，再走一米返回并重新观察。';
}
export function resolvePureWhiteAngelPlayerSlot(x:PureWhiteAngelCombatSource,r:PureWhiteAngelRuntime,id:PureWhiteAngelMoveId,order:number,rng:ActionRandomStream):PureWhiteAngelActionEvidence {
 if(!PURE_WHITE_ANGEL_ABILITIES.some(a=>a.id===id))throw new Error('未知本人动作。');const a=baseAction(r,'PLAYER',id,order,rng);
 if(!active(r)){a.finiteResult='UNAVAILABLE';a.label='本人或对手已离场、死亡或停止抵抗，没有新效果。';return closeAction(a,r,rng);}
 if(id.startsWith('sun.')&&!Object.hasOwn(x.mastery,id)){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'本人没有实际学会这项原能力；');}
 else if(x.policy==='ORDINARY'&&id.startsWith('sun.'))ordinary(x,r,a,'预先选择只作普通行动；');
 else if(id===FOCUSED_PURIFICATION||id===WARM_RADIANCE_GUARD){
  const brace=id===WARM_RADIANCE_GUARD,allowed=x.policy==='ALL'||x.policy===(brace?'WARM_RADIANCE_GUARD':'FOCUSED_PURIFICATION'),attempted=brace?r.warmRadianceGuardAttempted:r.focusedPurificationAttempted;
  if(!allowed){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'预先策略未允许这项新能力；');}
  else if(attempted){a.finiteResult='ALREADY_ATTEMPTED';ordinary(x,r,a,'本轮已经实际尝试，不重骰、不延长窗口；');}
  else if(!observed(r)){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'缺少同一当前已观察且可见的目标；');}
  else if(!pay(r,a,brace?6:8,2)){a.finiteResult='INSUFFICIENT';ordinary(x,r,a,'灵性或精神不足，能力未施放；');}
  else{
   if(brace){r.warmRadianceGuardAttempted=true;r.body.warmRadianceGuardAttempts++;}else{r.focusedPurificationAttempted=true;r.body.focusedPurificationAttempts++;}
   a.label=brace?'建立一次只待随后实际可见身体冲击使用的有限护持。':'只向当前亲见的西拉斯建立一次有限定向净光。';
   if(!check(x,a,brace?'knowledge':'will',18,rng))a.finiteResult='FAILED';
   else if(resist(a,rng)){if(brace){r.body.warmRadianceGuardChecks++;r.windows.warmRadianceGuard=window(r,'WARM_RADIANCE_GUARD',order);}else{r.body.focusedPurificationChecks++;r.windows.focusedPurification=window(r,'FOCUSED_PURIFICATION',order);}a.finiteResult='PENDING';a.label+='窗口最多30秒，本槽没有贡献或掌握奖励。';}
  }
 }else if(id===NOTARIZATION||id===LIMITED_LIGHT){
  const limited=id===LIMITED_LIGHT,key=limited?'limitedLight':'notarization';
  if(!Object.hasOwn(x.mastery,id)||!observed(r)){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'未学会原能力或没有当前可见光路；');}
  else if(limited?r.limitedAttempted:!!r.windows.notarization){a.finiteResult='ALREADY_ATTEMPTED';ordinary(x,r,a,'本轮原限光已尝试或已有待用公证；');}
  else if(!pay(r,a,limited?6:3)){a.finiteResult='INSUFFICIENT';ordinary(x,r,a,'不足原能力实际灵性成本；');}
  else{
   if(limited)r.limitedAttempted=true;a.label=limited?'实付6灵性，只预备本轮下一次实际敌方光击减45。':'实付3灵性，只预备本轮下一次实际自发圣光×1.15。';
   if(!check(x,a,'knowledge',limited?20:14,rng))a.finiteResult='FAILED';
   else if(resist(a,rng)){r.windows[key]=window(r,limited?'LIMITED_LIGHT':'NOTARIZATION',order);a.finiteResult='PENDING';a.label+='本槽没有实际贡献或掌握。';}
  }
 }else if(id==='STRIKE')ordinary(x,r,a,'',true);
 else if(id==='BLOCK'||id==='EVADE')ordinary(x,r,a,'');
 else if(id==='OBSERVE')reveal(r,a);
 else if(id==='ACCIDENT'){a.selfGain=-22.5;a.label='判断失衡，固定−22.5，不重抽。';}
 else{
  const power=PURE_WHITE_ANGEL_INHERITED_POWERS.find(p=>p.id===id);
  if(!power){a.finiteResult='UNAVAILABLE';a.selectedAbility='OBSERVE';a.fallbackReason='所需原仪式、圣水、自愿契约或八米安全范围不在本场';a.label=a.fallbackReason+'，没有创造符咒、圣水、旧场效果或掌握奖励。';}
  else if(!observed(r)){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'原罩遮住目标，已学能力缺少当前视线；');}
  else if(!pay(r,a,power.cost)){a.finiteResult='INSUFFICIENT';ordinary(x,r,a,'不足原能力实际灵性成本；');}
  else{
   a.label=power.label+'。';
   if(!check(x,a,power.ability,power.difficulty,rng))a.finiteResult='FAILED';
   else if(resist(a,rng)){
    const factor=power.fixed?1:.65+.35*Math.max(0,Math.min(500,x.mastery[id]??0))/500;
    a.selfGain=(power.physical&&x.clubHeld?16:power.gain*factor)*(power.physical?a.physicalFactor:1);a.enemyReduction=power.reduction*factor;a.attackKind=power.kind;a.lightEffect=power.kind==='BODY'&&!power.physical;
    if(power.physical)walkStrike(r,a);if(a.selfGain>0||a.enemyReduction>0)a.finiteResult='APPLIED';a.label+='仅当次有限实际效果，未建立跨轮免费能力。';
   }
  }
 }
 const certification=r.windows.notarization;
 if(certification&&certification.openedOrder<order&&a.lightEffect&&a.selfGain>0&&observed(r)){
  a.selfGain*=1.15;r.windows.notarization=null;a.countered.push(certification.id);gainMastery(r,a,NOTARIZATION);
  a.label+='原公证仅增强这一项后续真实圣光15%，随后耗尽。';
 }
 a.rawContribution=a.selfGain;a.rawReduction=a.enemyReduction;
 const ward=r.windows.enemyWard;
 if(ward&&ward.openedOrder<order&&a.lightEffect&&a.selfGain>0&&observed(r)){
  const absorbed=Math.min(60,a.selfGain);a.selfGain-=absorbed;r.windows.enemyWard=null;a.countered.push(ward.id);
  a.label+=`对方先前实付的防光只抵这次实际光照${absorbed}，没有挡住普通打击或精神效果。`;
 }
 if(PURE_WHITE_ANGEL_INHERITED_POWERS.some(p=>p.id===id)&&(a.selfGain>0||a.enemyReduction>0)&&a.selectedAbility===id){gainMastery(r,a,id);a.finiteResult='APPLIED';}
 const aid=r.windows.focusedPurification;
 if(aid&&aid.openedOrder<order&&a.attackKind==='BODY'&&a.selfGain>0&&aid.expiresAt>a.atSeconds&&aid.conditionVersion===r.root.conditionVersion&&observed(r)){
  r.windows.focusedPurification=null;a.countered.push(aid.id);a.selfGain+=30;r.body.focusedPurificationSuccesses++;gainMastery(r,a,FOCUSED_PURIFICATION);a.finiteResult='APPLIED';a.label+='先前实付净光只辅助这次后续真实威胁攻击30，窗口已消费。';
 }
 return closeAction(a,r,rng);
}
export function resolvePureWhiteAngelEnemySlot(x:PureWhiteAngelCombatSource,r:PureWhiteAngelRuntime,planned:PureWhiteAngelEnemyIntent,order:number,rng:ActionRandomStream):PureWhiteAngelActionEvidence {
 if(!active(r)){const a=baseAction(r,'ENEMY',planned,order,rng);a.finiteResult='UNAVAILABLE';a.label='原人已不在实际可交战位置，停止新效果。';return closeAction(a,r,rng);}
 if(!r.pendingEnemyAction)declarePureWhiteAngelEnemyAction(x,r,planned,order);const p=r.pendingEnemyAction!;if(p.planned!==planned)throw new Error('不能替换已观察的待执行动作。');const a=baseAction(r,'ENEMY',p.actual,order,rng);a.planned=planned;a.selectedAbility=p.actual;const power=PURE_WHITE_ANGEL_POWERS.find(v=>v.id===p.actual);
 if(power){
  if(r.body.enemySpirituality<power.cost)throw new Error('已声明对手资源不一致。');r.body.enemySpirituality-=power.cost;r.body.powerUses[power.id]++;a.paidCost=power.cost;a.label=`西拉斯实际施放${power.label}，独立灵性−${power.cost}。`;
  if(power.id==='LIGHT_WARD')r.wardAttempted=true;
  if(power.id==='LIGHT_STRIKE'){if(r.materials.weapon.charge<1)throw new Error('原杆已无储能。');const piece=r.materials.weapon.pieces.find(p=>p.state==='CHARGED');if(!piece)throw new Error('没有实际剩余的原储能片。');piece.state='SPENT';a.chargePieceId=piece.id;r.materials.weapon.charge--;a.rodChargeSpent=1;}
  if(power.id==='OBSCURE'){
   r.obscureUsed=true;r.materials.screen.hood='CLOSED';r.materials.screen.operations++;r.root.conditionVersion++;r.root.visibleBodyLine=false;a.succeeded=true;a.finiteResult='APPLIED';
   a.travelMetres=2;a.travelPath=[6,5,6];
   for(const key of ['focusedPurification','warmRadianceGuard','notarization','limitedLight','enemyWard'] as const){if(r.windows[key])a.countered.push(r.windows[key]!.id);invalidate(r,key);}
  }else if(resist(a,rng)){
   a.succeeded=true;a.finiteResult='APPLIED';a.selfGain=power.selfGain;a.enemyReduction=power.enemyReduction;a.attackKind=power.id==='LIGHT_STRIKE'?'BODY':power.id==='DAZZLING_PRESSURE'?'MENTAL':'NONE';a.lightEffect=power.id==='LIGHT_STRIKE';
   if(power.id==='LIGHT_WARD'){r.windows.enemyWard=window(r,'LIGHT_WARD',order);a.enemyReduction=0;a.finiteResult='PENDING';a.label+='只建立本轮一次防光，尚无实际减免。';}
   if((power.id==='LIGHT_STRIKE'||power.id==='LIGHT_WARD')&&observed(r))r.body.observations.push({power:power.id,conditionVersion:r.root.conditionVersion,round:x.round,order,atSeconds:r.root.clockSeconds,paidCost:power.id==='LIGHT_STRIKE'?7:6});
  }
 }else if(p.actual==='BODY_STRIKE'){a.succeeded=true;a.selfGain=20*a.physicalFactor;a.attackKind='BODY';a.travelMetres=4;a.travelPath=[6,4,6];a.label='西拉斯用自己的原杆上前两米普通打击，再沿原路退回两米；储能或灵性不足时不施法、不重抽。';}
 else if(p.actual==='ACCIDENT'){a.selfGain=-22.5;a.label='对手判断偏差，−22.5，不重抽。';}else a.label='对手普通观察，没有额外资源。';
 a.rawContribution=a.selfGain;a.rawReduction=a.enemyReduction;
 const limited=r.windows.limitedLight;
 if(limited&&limited.openedOrder<order&&a.lightEffect&&a.selfGain>0&&p.visible&&observed(r)){
  const reduction=Math.min(45,a.selfGain);a.selfGain-=reduction;r.windows.limitedLight=null;a.countered.push(limited.id);gainMastery(r,a,LIMITED_LIGHT);
  a.label+=`继承的限光仅削弱这次实际光击${reduction}；原棍和精神压力不能消耗它。`;
 }
 const brace=r.windows.warmRadianceGuard;
 if(brace&&a.attackKind==='BODY'&&a.selfGain>0&&brace.openedOrder<order&&brace.expiresAt>a.atSeconds&&brace.conditionVersion===r.root.conditionVersion&&p.visible&&observed(r)){
  r.windows.warmRadianceGuard=null;a.countered.push(brace.id);const reduction=Math.min(30,a.selfGain);a.selfGain-=reduction;
  r.body.warmRadianceGuardSuccesses++;gainMastery(r,a,WARM_RADIANCE_GUARD);a.finiteResult='APPLIED';a.label+=`先前实付护持只削弱这次后续可见身体冲击${reduction}，不影响精神。`;
 }
 r.pendingEnemyAction=null;return closeAction(a,r,rng);
}
export interface PureWhiteAngelRoundOutcome extends PureWhiteAngelCombatBody {
 targetId:typeof PURE_WHITE_ANGEL_TARGET_ID;round:number;source:PureWhiteAngelCombatSource;stance:SliceStance;continuing:boolean;consequenceDomain:'BODY'|'MENTAL'|'NONE';playerHealthAfter:number;playerMindAfter:number;playerSpiritualityAfter:number;playerInjuriesAfter:SliceInjury[];playerRiskAfter:number;materialsAfter:PureWhiteAngelMaterials;masteryAfter:Record<string,number>;rootAfter:PureWhiteAngelScene;elapsedSeconds:60;randomCursorAfter:number;playerActions:PureWhiteAngelActionEvidence[];enemyActions:PureWhiteAngelActionEvidence[];expiredWindows:PureWhiteAngelWindow[];windowsAfter:PureWhiteAngelWindows;pendingEnemyActionAfter:null;
}
export type PureWhiteAngelResolution='CONTINUE'|'PLAYER_DEAD'|'ENEMY_DEAD'|'ENEMY_SURRENDERED'|'RETREATED';
function penalty(n:number,max:number){const f=n/max;return f>.75?0:f>.5?.05:f>.25?.1:.2;}
function base(core:number,h:number,m:number,s:number){return(1250+Math.min(core,250))*(1-Math.min(.4,penalty(h,100)+penalty(m,100)+penalty(s,120)));}
function weights(risk:number){const death=Math.min(100,5+Math.min(risk,10)*10),shifted=death-5;return{light:Math.max(0,65-shifted),heavy:Math.max(0,30-Math.max(0,shifted-65)),death};}
export function validPureWhiteAngelBody(b:PureWhiteAngelCombatBody):boolean {
 return integer(b.enemyHealth,0,100)&&integer(b.enemyMind,0,100)&&integer(b.enemySpirituality,0,120)&&integer(b.enemyRisk)&&Array.isArray(b.enemyInjuries)&&['RESISTING','SURRENDERED','DEAD'].includes(b.enemyStatus)&&(b.enemyStatus==='DEAD')===(b.enemyHealth===0)&&(b.enemyMind>0||b.enemyStatus!=='RESISTING')&&['HAND','FORECOURT'].includes(b.weaponLocation)&&(b.enemyStatus==='RESISTING'||b.weaponLocation==='FORECOURT')&&shape(b.powerUses,PURE_WHITE_ANGEL_POWER_IDS)&&PURE_WHITE_ANGEL_POWER_IDS.every(id=>integer(b.powerUses[id]))&&b.enemySpirituality===120-PURE_WHITE_ANGEL_POWERS.reduce((n,p)=>n+p.cost*b.powerUses[p.id],0)&&b.powerUses.LIGHT_STRIKE<=4&&integer(b.totalOwnerMindSpent)&&integer(b.focusedPurificationAttempts)&&integer(b.warmRadianceGuardAttempts)&&integer(b.focusedPurificationChecks,0,b.focusedPurificationAttempts)&&integer(b.warmRadianceGuardChecks,0,b.warmRadianceGuardAttempts)&&integer(b.focusedPurificationSuccesses,0,b.focusedPurificationChecks)&&integer(b.warmRadianceGuardSuccesses,0,b.warmRadianceGuardChecks)&&b.totalOwnerMindSpent===2*(b.focusedPurificationAttempts+b.warmRadianceGuardAttempts)&&integer(b.screenReveals,0,b.powerUses.OBSCURE)&&!!b.inheritedApplications&&typeof b.inheritedApplications==='object'&&!Array.isArray(b.inheritedApplications)&&Object.entries(b.inheritedApplications).every(([id,n])=>(PURE_WHITE_ANGEL_INHERITED_POWERS.some(p=>p.id===id)||id===NOTARIZATION||id===LIMITED_LIGHT)&&integer(n,1))&&Array.isArray(b.observations)&&b.observations.every((o,i)=>shape(o,['power','conditionVersion','round','order','atSeconds','paidCost'])&&['LIGHT_STRIKE','LIGHT_WARD'].includes(o.power)&&integer(o.conditionVersion,1,b.powerUses.OBSCURE+b.screenReveals+1)&&integer(o.round,1)&&integer(o.order,0,11)&&integer(o.atSeconds,4)&&o.paidCost===(o.power==='LIGHT_STRIKE'?7:6)&&(i===0||b.observations[i-1]!.atSeconds<o.atSeconds))&&b.observations.filter(o=>o.power==='LIGHT_STRIKE').length<=b.powerUses.LIGHT_STRIKE&&b.observations.filter(o=>o.power==='LIGHT_WARD').length<=b.powerUses.LIGHT_WARD;
}
export function validPureWhiteAngelInjuries(injuries:SliceInjury[],revision:number):boolean{return Array.isArray(injuries)&&new Set(injuries.map(i=>i.id)).size===injuries.length&&injuries.every(i=>shape(i,['id','severity','acquiredRevision','treatedRevision'])&&typeof i.id==='string'&&!!i.id&&['LIGHT','HEAVY'].includes(i.severity)&&integer(i.acquiredRevision,0,revision)&&(i.treatedRevision===null||integer(i.treatedRevision,i.acquiredRevision,revision)));}
const SOURCE_KEYS=['runId','revision','week','date','round','encounterId','targetId','attemptWeek','startHistoryIndex','targetName','targetAge','targetSequence','targetCore','actualBody','independentMind','playerBodyId','enemyWeapon','weaponOwner','ordinaryExit','pursuit','thirdPartiesInArea','policy','clubHeld','playerHealth','playerMind','playerSpirituality','playerInjuries','playerRisk','physique','perception','will','knowledge','mastery','preparation','root','materials','body','randomSeed','randomCursor'];
export function validPureWhiteAngelCombatSource(x:PureWhiteAngelCombatSource):boolean {
 try{const p=x.root,prep=x.preparation,b=x.body;
 return shape(x,SOURCE_KEYS)&&shape(b,Object.keys(initialPureWhiteAngelBody()))&&validatePureWhiteAngelPreparation(prep)&&typeof x.runId==='string'&&!!x.runId&&integer(x.revision)&&x.week===prep.week&&isValidGameDate(x.date)&&same(x.date,prep.date)&&integer(x.round,1)&&integer(x.startHistoryIndex)&&x.attemptWeek===x.week&&x.encounterId==='PURE_WHITE_ANGEL_DISPUTE'&&x.targetId===PURE_WHITE_ANGEL_TARGET_ID&&x.targetName==='西拉斯·戴恩'&&x.targetAge===49&&x.targetSequence===1&&x.targetCore===24&&x.actualBody===true&&x.independentMind===true&&x.playerBodyId===`${x.runId}:body`&&x.enemyWeapon==='PW1-SILAS-ROD'&&x.weaponOwner===PURE_WHITE_ANGEL_TARGET_ID&&x.ordinaryExit==='OPEN'&&x.pursuit===false&&x.thirdPartiesInArea===0&&PURE_WHITE_ANGEL_POLICIES.includes(x.policy)&&x.clubHeld===prep.playerClubHeld&&
 [x.playerHealth,x.playerMind].every(n=>integer(n,1,100))&&integer(x.playerSpirituality,0,120)&&[x.physique,x.perception,x.will,x.knowledge].every(n=>integer(n,0,500))&&same({physique:x.physique,perception:x.perception,will:x.will,knowledge:x.knowledge},prep.after.coreStats)&&shape(x.mastery,[...PURE_WHITE_ANGEL_INHERITED_SKILL_IDS,...PURE_WHITE_ANGEL_NEW_ABILITY_IDS])&&Object.values(x.mastery).every(n=>integer(n,0,500))&&same(Object.keys(x.mastery).sort(),Object.keys(prep.after.mastery).sort())&&PURE_WHITE_ANGEL_INHERITED_SKILL_IDS.every(id=>x.mastery[id]===Math.min(500,prep.after.mastery[id]!+8*(b.inheritedApplications[id]??0)))&&x.mastery[FOCUSED_PURIFICATION]===Math.min(500,prep.after.mastery[FOCUSED_PURIFICATION]!+8*b.focusedPurificationSuccesses)&&x.mastery[WARM_RADIANCE_GUARD]===Math.min(500,prep.after.mastery[WARM_RADIANCE_GUARD]!+8*b.warmRadianceGuardSuccesses)&&
 integer(x.playerRisk)&&validPureWhiteAngelInjuries(x.playerInjuries,x.revision)&&validPureWhiteAngelInjuries(b.enemyInjuries,x.revision)&&validPureWhiteAngelMaterials(x.materials)&&x.materials.weapon.location===b.weaponLocation&&x.materials.weapon.charge===4-b.powerUses.LIGHT_STRIKE&&x.materials.screen.operations===b.powerUses.OBSCURE+b.screenReveals&&x.materials.screen.hood===(b.powerUses.OBSCURE===b.screenReveals?'OPEN':'CLOSED')&&b.powerUses.OBSCURE-b.screenReveals<=1&&p.visibleBodyLine===(x.materials.screen.hood==='OPEN')&&b.focusedPurificationAttempts<=x.round-1&&b.warmRadianceGuardAttempts<=x.round-1&&b.powerUses.OBSCURE<=x.round-1&&
 validPureWhiteAngelScene(p)&&p.siteId===PURE_WHITE_ANGEL_SITE&&p.playerLocation==='FORECOURT'&&p.observedSourceId===`${x.runId}:PW1-FORECOURT:${prep.revision}`&&p.observationWeek===prep.week&&p.knownPlayerName===prep.playerName&&p.knownEnemyName==='西拉斯·戴恩'&&p.clockSeconds===4+60*(x.round-1)&&p.conditionVersion===1+b.powerUses.OBSCURE+b.screenReveals&&validPureWhiteAngelBody(b)&&b.enemyStatus==='RESISTING'&&b.enemyMind>0&&typeof x.randomSeed==='string'&&!!x.randomSeed&&x.randomSeed.length<=256&&integer(x.randomCursor)&&prep.runId===x.runId&&prep.randomSeed===x.randomSeed&&prep.randomCursor<=x.randomCursor&&prep.revision<=x.revision-x.round&&b.observations.every(o=>o.round<x.round&&o.atSeconds<p.clockSeconds);
 }catch{return false;}
}
export const validatePureWhiteAngelCombatSource=validPureWhiteAngelCombatSource;

/** Shared actual consequence resolver, exposed for declared isolated BODY/MENTAL
 * tests without seeking or replacing any campaign seed/cursor. */
export function resolvePureWhiteAngelConsequences(x:PureWhiteAngelCombatSource,r:PureWhiteAngelRuntime,players:PureWhiteAngelActionEvidence[],enemies:PureWhiteAngelActionEvidence[],winner:'PLAYER'|'ENEMY',retreat:SliceCombatRound['retreat'],rng:ActionRandomStream) {
  const b=r.body;
  let playerHealth = r.playerH, playerRisk = x.playerRisk, outcome: PureWhiteAngelResolution = retreat === 'SUCCESS' ? 'RETREATED' : b.enemyMind === 0 ? 'ENEMY_SURRENDERED' : 'CONTINUE';
  const playerInjuries = structuredClone(x.playerInjuries); let consequenceWeights: SliceCombatRound['consequenceWeights'] = null, consequenceRoll: number | undefined, consequenceDomain:'BODY'|'MENTAL'|'NONE'='NONE';
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
export function replayPureWhiteAngelCombatRound(x: PureWhiteAngelCombatSource, stance: SliceStance): { round: SliceCombatRound; outcome: PureWhiteAngelResolution } {
  if (!validPureWhiteAngelCombatSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new Error('缺少真实原来源。');
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = createPureWhiteAngelRuntime(x), b = r.body;
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = pureWhiteAngelActionCount(playerCountRoll), enemyCount = pureWhiteAngelEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: PureWhiteAngelActionEvidence[] = [], enemies: PureWhiteAngelActionEvidence[] = [], remaining = { PLAYER: playerCount, ENEMY: enemyCount }; let retreat: SliceCombatRound['retreat'] = 'NONE';
  if (b.enemyMind === 0) remaining.PLAYER = remaining.ENEMY = 0;
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) for (const actor of order) {
    if (!remaining[actor]) continue;
    if (actor === 'PLAYER' && stance === 'RETREAT') {
      const action=baseAction(r,'PLAYER','RETREAT',players.length+enemies.length,rng);
      remaining.PLAYER=0;retreat=r.root.ordinaryExit==='OPEN'&&r.root.playerLocation==='FORECOURT'&&r.root.playerCoordinate===4?'SUCCESS':'FAILURE';
      action.succeeded=retreat==='SUCCESS';action.label=action.succeeded?'实际开放的普通退路可达，停止抵抗后沿四米原路离场。':'实际退路受阻，不能凭意愿瞬移离场。';players.push(closeAction(action,r,rng));
      if(retreat==='SUCCESS'){remaining.ENEMY=0;break;}continue;
    }
    if (remaining.ENEMY > 0 && !r.pendingEnemyAction) declarePureWhiteAngelEnemyAction(x, r, drawPureWhiteAngelEnemyAbility(rng), enemies.length);
    remaining[actor]--; const index = players.length + enemies.length;
    if (actor === 'PLAYER') players.push(resolvePureWhiteAngelPlayerSlot(x, r, drawPureWhiteAngelAbility(rng, null, stance), index, rng));
    else enemies.push(resolvePureWhiteAngelEnemySlot(x, r, r.pendingEnemyAction!.planned, index, rng));
    if (b.enemyMind === 0) { b.enemyStatus = 'SURRENDERED'; remaining.PLAYER = remaining.ENEMY = 0; break; }
  }
  const sum = (a: PureWhiteAngelActionEvidence[], key: 'selfGain' | 'enemyReduction') => a.reduce((n, v) => n + v[key], 0);
  const core = x.physique * .35 + x.perception * .25 + x.will * .25 + x.knowledge * .15;
  const playerAdvantage = Math.max(125, base(core, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, base(x.targetCore, x.body.enemyHealth, x.body.enemyMind, x.body.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction'));
  const winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100, winner = retreat === 'SUCCESS' ? 'ENEMY' : b.enemyMind === 0 ? 'PLAYER' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  const {playerHealth,playerRisk,outcome,playerInjuries,consequenceWeights,consequenceRoll,consequenceDomain}=resolvePureWhiteAngelConsequences(x,r,players,enemies,winner,retreat,rng);
  advancePureWhiteAngelCombatClock(r, x.root.clockSeconds + 60 - r.root.clockSeconds);
  for (const key of ['focusedPurification','warmRadianceGuard','notarization','limitedLight','enemyWard'] as const) { if (r.windows[key]) r.expiredWindows.push(structuredClone(r.windows[key]!)); r.windows[key] = null; }
  r.pendingEnemyAction = null; if (b.enemyStatus !== 'RESISTING') r.materials.weapon.location = 'FORECOURT'; b.weaponLocation = r.materials.weapon.location;
  const o: PureWhiteAngelRoundOutcome = { ...structuredClone(b), targetId: PURE_WHITE_ANGEL_TARGET_ID, round: x.round, source: structuredClone(x), stance, continuing: outcome === 'CONTINUE', consequenceDomain,
    playerHealthAfter: playerHealth, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, playerInjuriesAfter: playerInjuries, playerRiskAfter: playerRisk, materialsAfter: structuredClone(r.materials), masteryAfter: { ...r.mastery },
    rootAfter: structuredClone(r.root), elapsedSeconds: 60, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies, expiredWindows: r.expiredWindows,
    windowsAfter: structuredClone(r.windows), pendingEnemyActionAfter: null };
  const round: SliceCombatRound = { round: x.round, stance, first, playerCount, enemyCount, playerCountRoll, enemyCountRoll,
    moves: [...players, ...enemies].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })),
    playerAdvantage, enemyAdvantage, winChance, winner, consequence: '', consequenceWeights, retreat, ...(consequenceDomain === 'NONE' ? {} : { consequenceDomain }), ...(consequenceRoll === undefined ? {} : { consequenceRoll }), pureWhiteAngelOutcome: o };
  round.consequence = pureWhiteAngelCombatConsequence(round); return { round, outcome };
}
export function validatePureWhiteAngelRoundOutcome(v: unknown): v is PureWhiteAngelRoundOutcome { try { const o = v as PureWhiteAngelRoundOutcome; return !!o && same(o, replayPureWhiteAngelCombatRound(o.source, o.stance).round.pureWhiteAngelOutcome); } catch { return false; } }
export function validatePureWhiteAngelCombatRound(round: SliceCombatRound): boolean { try { const o = round.pureWhiteAngelOutcome; return !!o && same(round, replayPureWhiteAngelCombatRound(o.source, o.stance).round); } catch { return false; } }
export function nextPureWhiteAngelCombatSource(o: PureWhiteAngelRoundOutcome): PureWhiteAngelCombatSource {
  return { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter,
    playerSpirituality: Math.min(120, o.playerSpiritualityAfter + 12), playerInjuries: structuredClone(o.playerInjuriesAfter), playerRisk: o.playerRiskAfter,
    root: structuredClone(o.rootAfter), body: combatBody(o), materials: structuredClone(o.materialsAfter), mastery: { ...o.masteryAfter }, randomCursor: o.randomCursorAfter };
}
export function pureWhiteAngelCombatConsequence(round: SliceCombatRound): string {
  const o = round.pureWhiteAngelOutcome!, who = round.winner === 'PLAYER' ? '西拉斯' : '你';
  let text = round.retreat === 'SUCCESS' ? '撤离判定成功，将沿普通4米出口实际离开。' : round.consequenceDomain === 'MENTAL' ? `${who}承受实际精神压力，精神减少10，没有新增身体伤口或身体风险。` : round.consequenceDomain === 'BODY' ? `${who}承受实际物理攻击，按共同伤势盘结算，实掷${round.consequenceRoll}/100（轻${round.consequenceWeights!.light}/重${round.consequenceWeights!.heavy}/死亡${round.consequenceWeights!.death}）。` : '本轮没有实际致伤来源，不掷身体伤势盘、不增加身体风险。';
  const attacks = round.winner === 'PLAYER' ? o.playerActions : o.enemyActions;
  if (round.consequenceDomain) text += ` 实际${round.consequenceDomain === 'BODY' ? '身体' : '精神'}来源：${attacks.filter(a => round.consequenceDomain === 'BODY' ? a.threatens : a.mentalPressure).map(a => a.selectedAbility).join('、')}。`;
  text += ` 本人健康${o.source.playerHealth}→${o.playerHealthAfter}、精神${o.source.playerMind}→${o.playerMindAfter}；西拉斯健康${o.source.body.enemyHealth}→${o.enemyHealth}、精神${o.source.body.enemyMind}→${o.enemyMind}。`;
  if (o.playerHealthAfter > 0 && o.playerMindAfter === 0) text += '本人精神耗尽，仍活着，停止抵抗后沿普通出口离开。';
  if (o.playerHealthAfter === 0) text += '本人的原身体真实死亡，本周目终结。'; else if (o.enemyHealth === 0) text += '西拉斯原身体真实死亡，唯一原杆留地。'; else if (o.enemyStatus === 'SURRENDERED') text += '西拉斯因实际伤势或精神耗尽自主停止抵抗，仍活着，原杆放在地面。';
  return text + ' 本轮实际60秒；未使用窗口到时结束，已经花费的灵性与精神不退。原杆与原罩资源保留，玛拉、伊文、芦影与旧遭遇人物均不在场；原采光廊遮板、旧欧文身体与全部旧对象不变。';
}


export function projectPureWhiteAngelCombat(s:SliceState){
 const e=s.pureWhiteAngel.encounter,last=s.combat?.encounterId==='PURE_WHITE_ANGEL_DISPUTE'?s.combat.lastRound?.pureWhiteAngelOutcome:e.terminal?s.combatHistory[e.terminal.historyIndex]?.pureWhiteAngelOutcome:null;
 return{enemyName:'西拉斯·戴恩（49岁）',targetId:e.targetId,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,weaponLocation:e.weaponLocation,powerUses:{...e.powerUses},policy:e.policy,scene:structuredClone(e.scene),materials:structuredClone(e.materials),lastConsequenceDomain:last?.consequenceDomain??'NONE',lastActionSequence:last?[...last.playerActions,...last.enemyActions].sort((a,b)=>a.order-b.order):[],constants:PURE_WHITE_ANGEL_COMBAT_CONSTANTS,countWheel:PURE_WHITE_ANGEL_COUNT_WHEEL,enemyCountWheel:PURE_WHITE_ANGEL_ENEMY_COUNT_WHEEL,abilityWheel:pureWhiteAngelAbilityWheel(s,null),enemyAbilityWheel:PURE_WHITE_ANGEL_ENEMY_ABILITY_WHEEL,facts:[
 '体35%、感25%、意25%、知15%；双方1至6动作10/15/25/25/15/10，基础1250、底125、上限120，仅继续轮恢复12。',
 '净光定向只辅助下一实际威胁攻击30；温光护持只削弱随后一次实际可见身体冲击30，精神压力单独结算。',
 '每轮各一次，失败照付；条件改变、视线遮挡、离场或满30秒使旧窗口失效，空窗口不涨掌握。',
 '敌人原杆仅四次光击；防光6灵性、眩光压力7灵性、遮挡3灵性，无敌人回复；旧采光廊、原残留样本与原场装置不在前庭。',
 '每个实际槽5秒、每轮60秒；身体攻击走共同伤势盘，精神耗尽活着停战，身体死亡终结本周目。']};
}
