import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import { DEATH_CONSUL_COUNT_WHEEL, deathConsulActionCount } from '../death-consul/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { PALE_EMPEROR_TARGET_ID, PALE_EMPEROR_SITE, PALE_EMPEROR_POWER_IDS, PALE_EMPEROR_POWERS, PALE_EMPEROR_POLICIES,
  combatBody, initialPaleEmperorBody, paleEmperorPlayerClubHeld, hasPaleEmperorDisputeOpponent, validatePaleEmperorPreparation,
  validPaleEmperorMaterials, validPaleEmperorScene, type PaleEmperorCombatBody, type PaleEmperorEnemyIntent,
  type PaleEmperorPreparation, type PaleEmperorMaterials, type PaleEmperorScene, type PaleEmperorPolicy } from './encounter.js';

/** One independent contemporary opponent. The supernatural source effect is a
 * finite spirit-pressure line, represented as MENTAL, never ordinary BODY harm.
 * Mark costs, condition versions and actual consumption remain in every receipt. */
export const PALE_EMPEROR_COUNT_WHEEL=DEATH_CONSUL_COUNT_WHEEL;
export const PALE_EMPEROR_ENEMY_COUNT_WHEEL=DEATH_CONSUL_COUNT_WHEEL;
export const paleEmperorActionCount=deathConsulActionCount;
export const paleEmperorEnemyActionCount=deathConsulActionCount;
export const PALE_EMPEROR_COMBAT_CONSTANTS={weights:{physique:.35,perception:.25,will:.25,knowledge:.15},tier:1250,floor:125,maxSpirituality:120,continuingRecovery:12,enemyPhysique:24,residualQuietingCost:8,residualQuietingMindCost:2,residualQuietingReduction:30,spiritualInterdictionCost:7,spiritualInterdictionMindCost:2,spiritualInterdictionReduction:30,windowSeconds:20,resistanceChance:30,slotSeconds:5,roundSeconds:60} as const;
export const RESIDUAL_QUIETING='death.s1.residual-quieting',SPIRITUAL_INTERDICTION='death.s1.spiritual-interdiction';
export const PALE_EMPEROR_NEW_ABILITY_IDS=[RESIDUAL_QUIETING,SPIRITUAL_INTERDICTION] as const;
export const PALE_EMPEROR_INHERITED_SKILL_IDS=[
 'death.s9.corpse-physique','death.s9.spiritual-sight','death.s9.undead-knowledge',
 'death.s8.death-eye','death.s8.spirit-contact','death.s7.spirit-ritual','death.s7.spirit-communication','death.s7.spirit-borrowing',
 'death.s6.spirit-recruitment','death.s6.dead-words','death.s5.inner-underworld','death.s5.underworld-door',
 'death.s4.underworld-seal','death.s3.bounded-ferry','death.s3.departure-ward','death.s2.pale-flame','death.s2.spirit-passage',
] as const;
export type PaleEmperorMoveId=typeof PALE_EMPEROR_INHERITED_SKILL_IDS[number]|typeof PALE_EMPEROR_NEW_ABILITY_IDS[number]|'STRIKE'|'BLOCK'|'EVADE'|'OBSERVE'|'ACCIDENT';
type Ability='physique'|'knowledge'|'perception'|'will';
interface InheritedPower {id:PaleEmperorMoveId;label:string;cost:number;ability:Ability;difficulty:number;gain:number;reduction:number;kind:'BODY'|'MENTAL'|'NONE';fixed?:boolean;restraint?:boolean}
/** Actual latest inherited costs and budgets. No unavailable spirit, ritual,
 * undead target, or verified passage endpoints are manufactured for this scene. */
export const PALE_EMPEROR_INHERITED_POWERS:readonly InheritedPower[]=[
 {id:'death.s6.dead-words',label:'继承有限死者之语',cost:6,ability:'will',difficulty:16,gain:38,reduction:0,kind:'BODY'},
 {id:'death.s5.underworld-door',label:'继承短暂冥界门牵引',cost:4,ability:'will',difficulty:14,gain:0,reduction:18,kind:'NONE'},
 {id:'death.s4.underworld-seal',label:'继承有限冥界借力封印',cost:6,ability:'knowledge',difficulty:16,gain:0,reduction:20,kind:'NONE',restraint:true},
 {id:'death.s3.bounded-ferry',label:'继承有限摆渡迟滞',cost:6,ability:'will',difficulty:18,gain:0,reduction:36,kind:'NONE',fixed:true,restraint:true},
 {id:'death.s3.departure-ward',label:'继承短时离程屏护',cost:6,ability:'knowledge',difficulty:18,gain:0,reduction:32,kind:'NONE',fixed:true},
 {id:'death.s2.pale-flame',label:'继承苍白焰',cost:7,ability:'will',difficulty:20,gain:105,reduction:0,kind:'BODY',fixed:true},
];
export const PALE_EMPEROR_ABILITIES:readonly{id:PaleEmperorMoveId;label:string;weight:number;stance:SliceStance|null}[]=[
 {id:'STRIKE',label:'本人普通打击',weight:12,stance:'ATTACK'},{id:'BLOCK',label:'普通防备',weight:5,stance:'DEFEND'},{id:'EVADE',label:'普通避让',weight:5,stance:'DEFEND'},{id:'OBSERVE',label:'实际走近揭开原遮屏并观察',weight:4,stance:'PREPARE'},
 ...PALE_EMPEROR_INHERITED_SKILL_IDS.map(id=>{const p=PALE_EMPEROR_INHERITED_POWERS.find(p=>p.id===id);return{id,label:p?`${p.label}：${p.cost}灵性，实际检定与抵抗`:'保留原掌握；本场缺少这项能力的实际对象或施术条件，普通观察',weight:p?7:1,stance:(p?.kind==='BODY'?'ATTACK':p?.reduction?'DEFEND':'CONTROL') as SliceStance};}),
 {id:RESIDUAL_QUIETING,label:'残响安定：8灵性2精神、意志18，下一实际灵性压力减30',weight:14,stance:'CONTROL'},
 {id:SPIRITUAL_INTERDICTION,label:'灵迹阻隔：7灵性2精神、知识18，下一实际灵性或精神冲击减30',weight:14,stance:'DEFEND'},
 {id:'ACCIDENT',label:'判断失衡：−22.5',weight:3,stance:null},
];
export const PALE_EMPEROR_PLAYER_ABILITIES=PALE_EMPEROR_ABILITIES;
export const PALE_EMPEROR_ENEMY_ABILITY_WHEEL:readonly SliceWheelEntry[]=[
 {id:'PALE_STRIKE',label:'原灵印苍白冲击：7灵性与1原灵印、精神贡献105',weight:25},
 {id:'SPIRIT_PRESSURE',label:'有限灵性压力：7灵性、精神贡献65',weight:20},
 {id:'STEADY',label:'有限定神：6灵性，本轮一次抵后续摆渡或旧封印最多32',weight:20},
 {id:'BODY_STRIKE',label:'自有原棍普通打击：20×身体',weight:20},
 {id:'CLOSE_SCREEN',label:'关闭自己的原遮屏：3灵性、每轮一次，改变条件与视线',weight:10},
 {id:'ACCIDENT',label:'判断偏差：−22.5',weight:5},
];
export const isPaleEmperor=(s:SliceState)=>s.progression.pathwayId==='death'&&s.progression.sequence===1;
const tickets=(stance:SliceStance|null)=>PALE_EMPEROR_ABILITIES.map(a=>a.weight*(a.stance===stance&&stance!==null?5:4));
export function paleEmperorAbilityWheel(_s:SliceState,stance:SliceStance|null):SliceWheelEntry[]{const w=tickets(stance),total=w.reduce((n,v)=>n+v,0);return PALE_EMPEROR_ABILITIES.map((a,i)=>({id:a.id,label:a.label,weight:w[i]!/total*100}));}
export function drawPaleEmperorAbility(rng:ActionRandomStream,_s:SliceState|null,stance:SliceStance|null):PaleEmperorMoveId{const w=tickets(stance);let n=rng.nextInt(1,w.reduce((a,b)=>a+b,0));for(const[i,a]of PALE_EMPEROR_ABILITIES.entries()){n-=w[i]!;if(n<=0)return a.id;}throw new Error('行动盘无效。');}
export function drawPaleEmperorEnemyAbility(rng:ActionRandomStream):PaleEmperorEnemyIntent{let n=rng.nextInt(1,100);for(const a of PALE_EMPEROR_ENEMY_ABILITY_WHEEL){n-=a.weight;if(n<=0)return a.id as PaleEmperorEnemyIntent;}throw new Error('对手行动盘无效。');}
const same=(a:unknown,b:unknown)=>a===b||(a!==undefined&&b!==undefined&&stableStringify(a)===stableStringify(b));
const integer=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER):n is number=>Number.isSafeInteger(n)&&(n as number)>=min&&(n as number)<=max;
const shape=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...keys].sort());
const physicalAt=(n:number)=>n>75?1:n>50?.95:n>25?.9:.8;
export interface PaleEmperorCombatSource {
 runId:string;revision:number;week:number;date:PublicGameDate;round:number;encounterId:'PALE_EMPEROR_DISPUTE';targetId:typeof PALE_EMPEROR_TARGET_ID;
 attemptWeek:number;startHistoryIndex:number;targetName:'阿尔登·沃德';targetAge:47;targetSequence:1;targetCore:24;actualBody:true;independentMind:true;playerBodyId:string;
 enemyWeapon:'PE1-ALDEN-CLUB';weaponOwner:typeof PALE_EMPEROR_TARGET_ID;ordinaryExit:'OPEN';pursuit:false;thirdPartiesInArea:0;policy:PaleEmperorPolicy;clubHeld:boolean;
 playerHealth:number;playerMind:number;playerSpirituality:number;playerInjuries:SliceInjury[];playerRisk:number;physique:number;perception:number;will:number;knowledge:number;mastery:Record<string,number>;
 preparation:PaleEmperorPreparation;root:PaleEmperorScene;materials:PaleEmperorMaterials;body:PaleEmperorCombatBody;randomSeed:string;randomCursor:number;
}
export function currentPaleEmperorCombatSource(s:SliceState):PaleEmperorCombatSource|null {
 if(!hasPaleEmperorDisputeOpponent(s))return null;const e=s.paleEmperor.encounter,c=s.combat!;
 return{runId:s.runId,revision:s.revision,week:s.week,date:{...s.date},round:c.round,encounterId:'PALE_EMPEROR_DISPUTE',targetId:PALE_EMPEROR_TARGET_ID,attemptWeek:e.attemptWeek!,startHistoryIndex:e.startHistoryIndex!,targetName:'阿尔登·沃德',targetAge:47,targetSequence:1,targetCore:24,actualBody:true,independentMind:true,playerBodyId:`${s.runId}:body`,enemyWeapon:'PE1-ALDEN-CLUB',weaponOwner:PALE_EMPEROR_TARGET_ID,ordinaryExit:'OPEN',pursuit:false,thirdPartiesInArea:0,policy:e.policy,clubHeld:paleEmperorPlayerClubHeld(s),playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,playerInjuries:structuredClone(s.injuries),playerRisk:s.injuryRisk,...s.character.coreStats,mastery:{...s.progression.mastery},preparation:structuredClone(e.preparation!),root:structuredClone(e.scene),materials:structuredClone(e.materials),body:combatBody(e),randomSeed:s.random.seed,randomCursor:s.random.cursor};
}
export interface PaleEmperorPendingAction {id:string;planned:PaleEmperorEnemyIntent;actual:PaleEmperorEnemyIntent;declaredAt:number;observedAt:number;observationSeconds:0;conditionVersion:number;visible:boolean;bodyImpact:boolean;sourceEffectId:'PE1-ALDEN-SPIRIT-LINE'|null}
export interface PaleEmperorWindow {id:string;kind:'RESIDUAL_QUIETING'|'SPIRITUAL_INTERDICTION'|'STEADY';createdAt:number;expiresAt:number;openedOrder:number;conditionVersion:number;targetId:typeof PALE_EMPEROR_TARGET_ID;observedActionId:string|null;sourceEffectId:'PE1-ALDEN-SPIRIT-LINE'|null;magnitude:30|32}
export interface PaleEmperorWindows {residualQuieting:PaleEmperorWindow|null;spiritualInterdiction:PaleEmperorWindow|null;enemySteady:PaleEmperorWindow|null}
export interface PaleEmperorActionEvidence {
 order:number;actor:'PLAYER'|'ENEMY';id:string;planned:string;selectedAbility:string;fallbackReason:string|null;label:string;selfGain:number;enemyReduction:number;threatens:boolean;mentalPressure:boolean;attackKind:'NONE'|'BODY'|'MENTAL';sourceEffectId:'PE1-ALDEN-SPIRIT-LINE'|null;rawContribution:number;rawReduction:number;
 paidCost:number;mindCost:number;physicalFactor:number;check:PublicCheckResult|null;resistanceRoll:number|null;resistanceChance:number|null;succeeded:boolean;
 finiteResult:'NONE'|'UNAVAILABLE'|'ALREADY_ATTEMPTED'|'INSUFFICIENT'|'FAILED'|'RESISTED'|'PENDING'|'APPLIED';windowsBefore:PaleEmperorWindows;windowsAfter:PaleEmperorWindows;pendingBefore:PaleEmperorPendingAction|null;pendingAfter:PaleEmperorPendingAction|null;masteryApplied:string[];countered:string[];
 spiritMarksSpent:number;spiritMarkId:string|null;materialsBefore:PaleEmperorMaterials;materialsAfter:PaleEmperorMaterials;conditionVersionBefore:number;conditionVersionAfter:number;atSeconds:number;elapsedSeconds:5;travelMetres:number;travelPath:number[];lateralTravelPath:number[];randomCursorBefore:number;randomCursorAfter:number;playerMindAfter:number;playerSpiritualityAfter:number;enemyMindAfter:number;enemySpiritualityAfter:number;
}
export interface PaleEmperorRuntime {body:PaleEmperorCombatBody;root:PaleEmperorScene;materials:PaleEmperorMaterials;playerH:number;playerM:number;playerS:number;mastery:Record<string,number>;windows:PaleEmperorWindows;expiredWindows:PaleEmperorWindow[];pendingEnemyAction:PaleEmperorPendingAction|null;residualQuietingAttempted:boolean;spiritualInterdictionAttempted:boolean;steadyAttempted:boolean;screenClosed:boolean}
export function createPaleEmperorRuntime(x:PaleEmperorCombatSource):PaleEmperorRuntime{return{body:structuredClone(x.body),root:structuredClone(x.root),materials:structuredClone(x.materials),playerH:x.playerHealth,playerM:x.playerMind,playerS:x.playerSpirituality,mastery:{...x.mastery},windows:{residualQuieting:null,spiritualInterdiction:null,enemySteady:null},expiredWindows:[],pendingEnemyAction:null,residualQuietingAttempted:false,spiritualInterdictionAttempted:false,steadyAttempted:false,screenClosed:false};}
const WINDOW_KEYS=['residualQuieting','spiritualInterdiction','enemySteady'] as const;
const active=(r:PaleEmperorRuntime)=>r.root.playerLocation==='FORECOURT'&&r.root.playerCoordinate===4&&r.body.enemyStatus==='RESISTING'&&r.body.enemyHealth>0&&r.body.enemyMind>0&&r.playerH>0&&r.playerM>0;
const observed=(r:PaleEmperorRuntime)=>active(r)&&r.root.visibleBodyLine&&r.materials.screen.hood==='OPEN'&&r.materials.door.state==='OPEN'&&r.root.observedConditionVersion===r.root.conditionVersion;
const supernatural=(id:PaleEmperorEnemyIntent)=>id==='PALE_STRIKE'||id==='SPIRIT_PRESSURE';
const observedPressure=(r:PaleEmperorRuntime)=>observed(r)&&!!r.pendingEnemyAction&&r.pendingEnemyAction.visible&&r.pendingEnemyAction.conditionVersion===r.root.conditionVersion&&r.pendingEnemyAction.sourceEffectId==='PE1-ALDEN-SPIRIT-LINE'&&supernatural(r.pendingEnemyAction.actual);
function invalidate(r:PaleEmperorRuntime,key:keyof PaleEmperorWindows):void {const w=r.windows[key];if(w)r.expiredWindows.push(structuredClone(w));r.windows[key]=null;}
export function advancePaleEmperorCombatClock(r:PaleEmperorRuntime,seconds:number):void {
 if(!integer(seconds))throw new Error('实际时间无效。');r.root.clockSeconds+=seconds;r.root.externalSeconds+=seconds;
 for(const key of WINDOW_KEYS){const w=r.windows[key];if(w&&(w.expiresAt<=r.root.clockSeconds||!observed(r)||w.conditionVersion!==r.root.conditionVersion))invalidate(r,key);}
}
export function declarePaleEmperorEnemyAction(x:PaleEmperorCombatSource,r:PaleEmperorRuntime,planned:PaleEmperorEnemyIntent,index:number):PaleEmperorPendingAction {
 if(!active(r)||r.pendingEnemyAction||![...PALE_EMPEROR_ENEMY_ABILITY_WHEEL.map(a=>a.id),'OBSERVE'].includes(planned))throw new Error('不能覆盖待执行动作或替已停战者行动。');
 const power=PALE_EMPEROR_POWERS.find(p=>p.id===planned);
 const actual:PaleEmperorEnemyIntent=power&&(r.body.enemySpirituality<power.cost||planned==='PALE_STRIKE'&&r.materials.marks.remaining===0)?'BODY_STRIKE'
  :planned==='CLOSE_SCREEN'&&(r.screenClosed||r.materials.screen.hood==='CLOSED')||planned==='STEADY'&&r.steadyAttempted||supernatural(planned)&&!observed(r)?'OBSERVE':planned;
 r.pendingEnemyAction={id:`${x.runId}:PE1-PENDING:${x.round}:${index}`,planned,actual,declaredAt:r.root.clockSeconds,observedAt:r.root.clockSeconds,observationSeconds:0,conditionVersion:r.root.conditionVersion,visible:observed(r),bodyImpact:actual==='BODY_STRIKE',sourceEffectId:supernatural(actual)?'PE1-ALDEN-SPIRIT-LINE':null};
 return structuredClone(r.pendingEnemyAction);
}
function baseAction(r:PaleEmperorRuntime,actor:'PLAYER'|'ENEMY',id:string,order:number,rng:ActionRandomStream):PaleEmperorActionEvidence {
 advancePaleEmperorCombatClock(r,0);
 return{order,actor,id,planned:id,selectedAbility:id,fallbackReason:null,label:'',selfGain:0,enemyReduction:0,threatens:false,mentalPressure:false,attackKind:'NONE',sourceEffectId:null,rawContribution:0,rawReduction:0,paidCost:0,mindCost:0,physicalFactor:physicalAt(actor==='PLAYER'?r.playerH:r.body.enemyHealth),check:null,resistanceRoll:null,resistanceChance:null,succeeded:false,finiteResult:'NONE',windowsBefore:structuredClone(r.windows),windowsAfter:structuredClone(r.windows),pendingBefore:structuredClone(r.pendingEnemyAction),pendingAfter:null,masteryApplied:[],countered:[],spiritMarksSpent:0,spiritMarkId:null,materialsBefore:structuredClone(r.materials),materialsAfter:structuredClone(r.materials),conditionVersionBefore:r.root.conditionVersion,conditionVersionAfter:r.root.conditionVersion,atSeconds:r.root.clockSeconds,elapsedSeconds:5,travelMetres:0,travelPath:[actor==='PLAYER'?r.root.playerCoordinate:r.root.enemyCoordinate],lateralTravelPath:[0],randomCursorBefore:rng.cursor,randomCursorAfter:rng.cursor,playerMindAfter:r.playerM,playerSpiritualityAfter:r.playerS,enemyMindAfter:r.body.enemyMind,enemySpiritualityAfter:r.body.enemySpirituality};
}
function closeAction(a:PaleEmperorActionEvidence,r:PaleEmperorRuntime,rng:ActionRandomStream){advancePaleEmperorCombatClock(r,5);a.windowsAfter=structuredClone(r.windows);a.pendingAfter=structuredClone(r.pendingEnemyAction);a.materialsAfter=structuredClone(r.materials);a.conditionVersionAfter=r.root.conditionVersion;a.randomCursorAfter=rng.cursor;a.playerMindAfter=r.playerM;a.playerSpiritualityAfter=r.playerS;a.enemyMindAfter=r.body.enemyMind;a.enemySpiritualityAfter=r.body.enemySpirituality;a.threatens=a.attackKind==='BODY'&&a.selfGain>0;a.mentalPressure=a.attackKind==='MENTAL'&&(a.selfGain>0||a.enemyReduction>0);a.label+=` 实际5秒，条件${r.root.conditionVersion}，本人灵性${r.playerS}、精神${r.playerM}，对手灵性${r.body.enemySpirituality}。`;return a;}
function ordinary(x:PaleEmperorCombatSource,r:PaleEmperorRuntime,a:PaleEmperorActionEvidence,why:string,attack=false){a.selectedAbility=attack?'STRIKE':'BLOCK';a.fallbackReason=why||null;a.label=why+(attack?'本人以实际持握原棍或原身体普通打击。':'本人普通防备。');a.succeeded=true;if(attack){a.selfGain=(x.clubHeld?16:12)*a.physicalFactor;a.attackKind='BODY';a.travelMetres=4;a.travelPath=[4,6,4];r.root.playerTravelMetres+=4;r.root.forecourtTravelMetres+=4;}else a.enemyReduction=10;}
function pay(r:PaleEmperorRuntime,a:PaleEmperorActionEvidence,s:number,m=0){if(r.playerS<s||r.playerM<=m)return false;r.playerS-=s;r.playerM-=m;r.body.totalOwnerMindSpent+=m;a.paidCost=s;a.mindCost=m;return true;}
function check(x:PaleEmperorCombatSource,a:PaleEmperorActionEvidence,ability:Ability,difficulty:number,rng:ActionRandomStream){a.check=resolveNormalCheck({ability,baseAbility:x[ability],difficulty,modifiers:[],roll:rng.nextInt(1,100)});a.succeeded=['SUCCESS','GREAT_SUCCESS'].includes(a.check.tier);a.label+=`${({physique:'体魄',knowledge:'知识',perception:'感知',will:'意志'})[ability]}检定${a.check.roll}，${a.succeeded?'成功':'失败'}。`;return a.succeeded;}
function resist(a:PaleEmperorActionEvidence,rng:ActionRandomStream){a.resistanceChance=30;a.resistanceRoll=rng.nextInt(1,100);if(a.resistanceRoll<=30){a.succeeded=false;a.finiteResult='RESISTED';a.label+='对方实际抵抗，费用不退。';return false;}return true;}
function gainMastery(r:PaleEmperorRuntime,a:PaleEmperorActionEvidence,id:string){r.mastery[id]=Math.min(500,(r.mastery[id]??0)+8);a.masteryApplied.push(id);if(PALE_EMPEROR_INHERITED_POWERS.some(p=>p.id===id))r.body.inheritedApplications[id]=(r.body.inheritedApplications[id]??0)+1;}
function window(r:PaleEmperorRuntime,kind:PaleEmperorWindow['kind'],order:number):PaleEmperorWindow {
 return{id:`PE1-${kind}-${r.root.clockSeconds}-${order}`,kind,createdAt:r.root.clockSeconds,expiresAt:kind==='STEADY'?r.root.clockSeconds+(60-(r.root.clockSeconds-16)%60):r.root.clockSeconds+20,openedOrder:order,conditionVersion:r.root.conditionVersion,targetId:PALE_EMPEROR_TARGET_ID,observedActionId:kind==='STEADY'?null:r.pendingEnemyAction!.id,sourceEffectId:kind==='STEADY'?null:'PE1-ALDEN-SPIRIT-LINE',magnitude:kind==='STEADY'?32:30};
}
function reveal(r:PaleEmperorRuntime,a:PaleEmperorActionEvidence){
 a.selectedAbility='OBSERVE';a.succeeded=true;a.travelMetres=2;a.travelPath=[4,5,4];r.root.playerTravelMetres+=2;r.root.forecourtTravelMetres+=2;
 if(r.materials.screen.hood==='CLOSED'){r.materials.screen.hood='OPEN';r.materials.screen.operations++;r.body.screenReveals++;r.root.conditionVersion++;}
 r.root.visibleBodyLine=true;r.root.observedConditionVersion=r.root.conditionVersion;
 if(r.pendingEnemyAction){r.pendingEnemyAction.visible=true;r.pendingEnemyAction.conditionVersion=r.root.conditionVersion;r.pendingEnemyAction.observedAt=r.root.clockSeconds;}
 a.label='本人实际走一米到原遮屏，若关闭则揭开同一遮屏，再走一米返回并重新观察。';
}
export function resolvePaleEmperorPlayerSlot(x:PaleEmperorCombatSource,r:PaleEmperorRuntime,id:PaleEmperorMoveId,order:number,rng:ActionRandomStream):PaleEmperorActionEvidence {
 if(!PALE_EMPEROR_ABILITIES.some(a=>a.id===id))throw new Error('未知本人动作。');const a=baseAction(r,'PLAYER',id,order,rng);
 if(!active(r)){a.finiteResult='UNAVAILABLE';a.label='本人或对手已离场、死亡或停止抵抗，没有新效果。';return closeAction(a,r,rng);}
 if(id.startsWith('death.')&&!Object.hasOwn(x.mastery,id)){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'本人没有实际学会这项原能力；');}
 else if(x.policy==='ORDINARY'&&id.startsWith('death.'))ordinary(x,r,a,'预先选择只作普通行动；');
 else if(id===RESIDUAL_QUIETING||id===SPIRITUAL_INTERDICTION){
  const barrier=id===SPIRITUAL_INTERDICTION,allowed=x.policy==='ALL'||x.policy===(barrier?'SPIRITUAL_INTERDICTION':'RESIDUAL_QUIETING'),attempted=barrier?r.spiritualInterdictionAttempted:r.residualQuietingAttempted;
  if(!allowed){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'预先策略未允许这项新能力；');}
  else if(attempted){a.finiteResult='ALREADY_ATTEMPTED';ordinary(x,r,a,'本轮已经实际尝试，不重骰、不延长窗口；');}
  else if(!observedPressure(r)){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'缺少同一当前可见、已声明且尚未执行的灵性压力来源；');}
  else if(!pay(r,a,barrier?7:8,2)){a.finiteResult='INSUFFICIENT';ordinary(x,r,a,'灵性或精神不足，能力未施放；');}
  else{
   if(barrier){r.spiritualInterdictionAttempted=true;r.body.spiritualInterdictionAttempts++;}else{r.residualQuietingAttempted=true;r.body.residualQuietingAttempts++;}
   a.label=barrier?'只沿当前已观察的灵迹建立一次有限阻隔。':'只针对当前已观察的非凡压力来源建立一次残响安定。';
   if(!check(x,a,barrier?'knowledge':'will',18,rng))a.finiteResult='FAILED';
   else if(resist(a,rng)){if(barrier){r.body.spiritualInterdictionChecks++;r.windows.spiritualInterdiction=window(r,'SPIRITUAL_INTERDICTION',order);}else{r.body.residualQuietingChecks++;r.windows.residualQuieting=window(r,'RESIDUAL_QUIETING',order);}a.finiteResult='PENDING';a.label+='窗口最多20秒，只等待随后一次同源实际灵性冲击；本槽没有贡献或掌握奖励。';}
  }
 }else if(id==='STRIKE')ordinary(x,r,a,'',true);
 else if(id==='BLOCK'||id==='EVADE')ordinary(x,r,a,'');
 else if(id==='OBSERVE')reveal(r,a);
 else if(id==='ACCIDENT'){a.selfGain=-22.5;a.label='判断失衡，固定−22.5，不重抽。';}
 else{
  const power=PALE_EMPEROR_INHERITED_POWERS.find(p=>p.id===id);
  if(!power){a.finiteResult='UNAVAILABLE';a.selectedAbility='OBSERVE';a.fallbackReason='本场没有这项原能力所需的灵体、仪式、适用对象或已核验短渡端点';a.label=a.fallbackReason+'，只普通观察，不制造新灵或掌握奖励。';}
  else if(!observed(r)){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'原遮屏挡住目标，已学能力缺少当前路径与视线；');}
  else if(!pay(r,a,power.cost)){a.finiteResult='INSUFFICIENT';ordinary(x,r,a,'不足原能力实际灵性成本；');}
  else{
   a.label=power.label+'。';
   if(!check(x,a,power.ability,power.difficulty,rng))a.finiteResult='FAILED';
   else if(resist(a,rng)){
    const factor=power.fixed?1:.65+.35*Math.max(0,Math.min(500,x.mastery[id]??0))/500;
    a.selfGain=power.gain*factor;a.enemyReduction=power.reduction*factor;a.attackKind=power.kind;
    a.rawContribution=a.selfGain;a.rawReduction=a.enemyReduction;
    const steady=r.windows.enemySteady;
    if(steady&&steady.openedOrder<order&&power.restraint&&a.enemyReduction>0&&observed(r)){
     const resisted=Math.min(32,a.enemyReduction);a.enemyReduction-=resisted;r.windows.enemySteady=null;a.countered.push(steady.id);a.label+=`对方此前实付的定神只抵本次实际牵制${resisted}。`;
    }
    if(a.selfGain>0||a.enemyReduction>0){a.finiteResult='APPLIED';gainMastery(r,a,id);}a.label+='仅当次有限实际效果，没有跨轮免费能力。';
   }
  }
 }
 if(!a.rawContribution&&!a.rawReduction){a.rawContribution=a.selfGain;a.rawReduction=a.enemyReduction;}
 return closeAction(a,r,rng);
}
export function resolvePaleEmperorEnemySlot(x:PaleEmperorCombatSource,r:PaleEmperorRuntime,planned:PaleEmperorEnemyIntent,order:number,rng:ActionRandomStream):PaleEmperorActionEvidence {
 if(!active(r)){const a=baseAction(r,'ENEMY',planned,order,rng);a.finiteResult='UNAVAILABLE';a.label='原人已不在实际可交战位置，停止新效果。';return closeAction(a,r,rng);}
 if(!r.pendingEnemyAction)declarePaleEmperorEnemyAction(x,r,planned,order);const p=r.pendingEnemyAction!;if(p.planned!==planned)throw new Error('不能替换已观察的待执行动作。');const a=baseAction(r,'ENEMY',p.actual,order,rng);a.planned=planned;a.selectedAbility=p.actual;const power=PALE_EMPEROR_POWERS.find(v=>v.id===p.actual);
 if(power){
  if(r.body.enemySpirituality<power.cost)throw new Error('已声明对手资源不一致。');r.body.enemySpirituality-=power.cost;r.body.powerUses[power.id]++;a.paidCost=power.cost;a.label=`阿尔登实际施放${power.label}，独立灵性−${power.cost}。`;
  if(power.id==='STEADY')r.steadyAttempted=true;
  if(power.id==='PALE_STRIKE'){if(r.materials.marks.remaining<1)throw new Error('原灵印已用尽。');const piece=r.materials.marks.pieces.find(p=>p.state==='READY');if(!piece)throw new Error('没有实际剩余的原灵印。');piece.state='SPENT';a.spiritMarkId=piece.id;r.materials.marks.remaining--;a.spiritMarksSpent=1;}
  if(power.id==='CLOSE_SCREEN'){
   r.screenClosed=true;r.materials.screen.hood='CLOSED';r.materials.screen.operations++;r.root.conditionVersion++;r.root.visibleBodyLine=false;a.succeeded=true;a.finiteResult='APPLIED';a.travelMetres=2;a.travelPath=[6,5,6];
   for(const key of WINDOW_KEYS){if(r.windows[key])a.countered.push(r.windows[key]!.id);invalidate(r,key);}
  }else if(resist(a,rng)){
   a.succeeded=true;a.finiteResult='APPLIED';a.selfGain=power.selfGain;a.enemyReduction=power.enemyReduction;a.attackKind=supernatural(power.id)?'MENTAL':'NONE';a.sourceEffectId=supernatural(power.id)?'PE1-ALDEN-SPIRIT-LINE':null;
   if(power.id==='STEADY'){r.windows.enemySteady=window(r,'STEADY',order);a.enemyReduction=0;a.finiteResult='PENDING';a.label+='只建立本轮一次定神准备，尚无实际减免。';}
   if((power.id==='PALE_STRIKE'||power.id==='SPIRIT_PRESSURE')&&observed(r))r.body.observations.push({power:power.id,conditionVersion:r.root.conditionVersion,round:x.round,order,atSeconds:r.root.clockSeconds,paidCost:7});
  }
 }else if(p.actual==='BODY_STRIKE'){a.succeeded=true;a.selfGain=20*a.physicalFactor;a.attackKind='BODY';a.travelMetres=4;a.travelPath=[6,4,6];a.label='阿尔登用自己的原棍上前两米普通打击，再沿原路退回两米；原灵印或灵性不足时不施法、不重抽。';}
 else if(p.actual==='ACCIDENT'){a.selfGain=-22.5;a.label='对手判断偏差，−22.5，不重抽。';}else a.label='对手普通观察，没有额外资源。';
 a.rawContribution=a.selfGain;a.rawReduction=a.enemyReduction;
 for(const key of ['residualQuieting','spiritualInterdiction'] as const){
  const w=r.windows[key];
  if(w&&w.openedOrder<order&&w.expiresAt>a.atSeconds&&w.conditionVersion===r.root.conditionVersion&&w.targetId===x.targetId&&w.sourceEffectId===a.sourceEffectId&&a.sourceEffectId==='PE1-ALDEN-SPIRIT-LINE'&&a.attackKind==='MENTAL'&&a.selfGain>0&&p.visible&&observed(r)){
   const reduction=Math.min(30,a.selfGain);a.selfGain-=reduction;r.windows[key]=null;a.countered.push(w.id);
   const quiet=key==='residualQuieting';if(quiet)r.body.residualQuietingSuccesses++;else r.body.spiritualInterdictionSuccesses++;
   gainMastery(r,a,quiet?RESIDUAL_QUIETING:SPIRITUAL_INTERDICTION);a.finiteResult='APPLIED';a.label+=`先前实付${quiet?'残响安定':'灵迹阻隔'}只削弱这次后续同源灵性冲击${reduction}，窗口已消费，不影响普通棍击或已经发生的伤害。`;
  }
 }
 r.pendingEnemyAction=null;return closeAction(a,r,rng);
}
export interface PaleEmperorRoundOutcome extends PaleEmperorCombatBody {
 targetId:typeof PALE_EMPEROR_TARGET_ID;round:number;source:PaleEmperorCombatSource;stance:SliceStance;continuing:boolean;consequenceDomain:'BODY'|'MENTAL'|'NONE';playerHealthAfter:number;playerMindAfter:number;playerSpiritualityAfter:number;playerInjuriesAfter:SliceInjury[];playerRiskAfter:number;materialsAfter:PaleEmperorMaterials;masteryAfter:Record<string,number>;rootAfter:PaleEmperorScene;elapsedSeconds:60;randomCursorAfter:number;playerActions:PaleEmperorActionEvidence[];enemyActions:PaleEmperorActionEvidence[];expiredWindows:PaleEmperorWindow[];windowsAfter:PaleEmperorWindows;pendingEnemyActionAfter:null;
}
export type PaleEmperorResolution='CONTINUE'|'PLAYER_DEAD'|'ENEMY_DEAD'|'ENEMY_SURRENDERED'|'RETREATED';
function penalty(n:number,max:number){const f=n/max;return f>.75?0:f>.5?.05:f>.25?.1:.2;}
function base(core:number,h:number,m:number,s:number){return(1250+Math.min(core,250))*(1-Math.min(.4,penalty(h,100)+penalty(m,100)+penalty(s,120)));}
function weights(risk:number){const death=Math.min(100,5+Math.min(risk,10)*10),shifted=death-5;return{light:Math.max(0,65-shifted),heavy:Math.max(0,30-Math.max(0,shifted-65)),death};}
export function validPaleEmperorBody(b:PaleEmperorCombatBody):boolean {
 return integer(b.enemyHealth,0,100)&&integer(b.enemyMind,0,100)&&integer(b.enemySpirituality,0,120)&&integer(b.enemyRisk)&&Array.isArray(b.enemyInjuries)&&['RESISTING','SURRENDERED','DEAD'].includes(b.enemyStatus)&&(b.enemyStatus==='DEAD')===(b.enemyHealth===0)&&(b.enemyMind>0||b.enemyStatus!=='RESISTING')&&['HAND','FORECOURT'].includes(b.weaponLocation)&&(b.enemyStatus==='RESISTING'||b.weaponLocation==='FORECOURT')&&shape(b.powerUses,PALE_EMPEROR_POWER_IDS)&&PALE_EMPEROR_POWER_IDS.every(id=>integer(b.powerUses[id]))&&b.enemySpirituality===120-PALE_EMPEROR_POWERS.reduce((n,p)=>n+p.cost*b.powerUses[p.id],0)&&b.powerUses.PALE_STRIKE<=3&&integer(b.totalOwnerMindSpent)&&integer(b.residualQuietingAttempts)&&integer(b.spiritualInterdictionAttempts)&&integer(b.residualQuietingChecks,0,b.residualQuietingAttempts)&&integer(b.spiritualInterdictionChecks,0,b.spiritualInterdictionAttempts)&&integer(b.residualQuietingSuccesses,0,b.residualQuietingChecks)&&integer(b.spiritualInterdictionSuccesses,0,b.spiritualInterdictionChecks)&&b.totalOwnerMindSpent===2*(b.residualQuietingAttempts+b.spiritualInterdictionAttempts)&&integer(b.screenReveals,0,b.powerUses.CLOSE_SCREEN)&&!!b.inheritedApplications&&typeof b.inheritedApplications==='object'&&!Array.isArray(b.inheritedApplications)&&Object.entries(b.inheritedApplications).every(([id,n])=>PALE_EMPEROR_INHERITED_POWERS.some(p=>p.id===id)&&integer(n,1))&&Array.isArray(b.observations)&&b.observations.every((o,i)=>shape(o,['power','conditionVersion','round','order','atSeconds','paidCost'])&&['PALE_STRIKE','SPIRIT_PRESSURE'].includes(o.power)&&integer(o.conditionVersion,1,b.powerUses.CLOSE_SCREEN+b.screenReveals+1)&&integer(o.round,1)&&integer(o.order,0,11)&&integer(o.atSeconds,16)&&o.paidCost===7&&(i===0||b.observations[i-1]!.atSeconds<o.atSeconds))&&b.observations.filter(o=>o.power==='PALE_STRIKE').length<=b.powerUses.PALE_STRIKE&&b.observations.filter(o=>o.power==='SPIRIT_PRESSURE').length<=b.powerUses.SPIRIT_PRESSURE;
}
export function validPaleEmperorInjuries(injuries:SliceInjury[],revision:number):boolean{return Array.isArray(injuries)&&new Set(injuries.map(i=>i.id)).size===injuries.length&&injuries.every(i=>shape(i,['id','severity','acquiredRevision','treatedRevision'])&&typeof i.id==='string'&&!!i.id&&['LIGHT','HEAVY'].includes(i.severity)&&integer(i.acquiredRevision,0,revision)&&(i.treatedRevision===null||integer(i.treatedRevision,i.acquiredRevision,revision)));}
const SOURCE_KEYS=['runId','revision','week','date','round','encounterId','targetId','attemptWeek','startHistoryIndex','targetName','targetAge','targetSequence','targetCore','actualBody','independentMind','playerBodyId','enemyWeapon','weaponOwner','ordinaryExit','pursuit','thirdPartiesInArea','policy','clubHeld','playerHealth','playerMind','playerSpirituality','playerInjuries','playerRisk','physique','perception','will','knowledge','mastery','preparation','root','materials','body','randomSeed','randomCursor'];
export function validPaleEmperorCombatSource(x:PaleEmperorCombatSource):boolean {
 try{const p=x.root,prep=x.preparation,b=x.body;
 return shape(x,SOURCE_KEYS)&&shape(b,Object.keys(initialPaleEmperorBody()))&&validatePaleEmperorPreparation(prep)&&typeof x.runId==='string'&&!!x.runId&&integer(x.revision)&&x.week===prep.week&&isValidGameDate(x.date)&&same(x.date,prep.date)&&integer(x.round,1)&&integer(x.startHistoryIndex)&&x.attemptWeek===x.week&&x.encounterId==='PALE_EMPEROR_DISPUTE'&&x.targetId===PALE_EMPEROR_TARGET_ID&&x.targetName==='阿尔登·沃德'&&x.targetAge===47&&x.targetSequence===1&&x.targetCore===24&&x.actualBody===true&&x.independentMind===true&&x.playerBodyId===`${x.runId}:body`&&x.enemyWeapon==='PE1-ALDEN-CLUB'&&x.weaponOwner===PALE_EMPEROR_TARGET_ID&&x.ordinaryExit==='OPEN'&&x.pursuit===false&&x.thirdPartiesInArea===0&&PALE_EMPEROR_POLICIES.includes(x.policy)&&x.clubHeld===prep.playerClubHeld&&
 [x.playerHealth,x.playerMind].every(n=>integer(n,1,100))&&integer(x.playerSpirituality,0,120)&&[x.physique,x.perception,x.will,x.knowledge].every(n=>integer(n,0,500))&&same({physique:x.physique,perception:x.perception,will:x.will,knowledge:x.knowledge},prep.after.coreStats)&&shape(x.mastery,[...PALE_EMPEROR_INHERITED_SKILL_IDS,...PALE_EMPEROR_NEW_ABILITY_IDS])&&Object.values(x.mastery).every(n=>integer(n,0,500))&&same(Object.keys(x.mastery).sort(),Object.keys(prep.after.mastery).sort())&&PALE_EMPEROR_INHERITED_SKILL_IDS.every(id=>x.mastery[id]===Math.min(500,prep.after.mastery[id]!+8*(b.inheritedApplications[id]??0)))&&x.mastery[RESIDUAL_QUIETING]===Math.min(500,prep.after.mastery[RESIDUAL_QUIETING]!+8*b.residualQuietingSuccesses)&&x.mastery[SPIRITUAL_INTERDICTION]===Math.min(500,prep.after.mastery[SPIRITUAL_INTERDICTION]!+8*b.spiritualInterdictionSuccesses)&&
 integer(x.playerRisk)&&validPaleEmperorInjuries(x.playerInjuries,x.revision)&&validPaleEmperorInjuries(b.enemyInjuries,x.revision)&&validPaleEmperorMaterials(x.materials)&&x.materials.weapon.location===b.weaponLocation&&x.materials.marks.remaining===3-b.powerUses.PALE_STRIKE&&x.materials.screen.operations===b.powerUses.CLOSE_SCREEN+b.screenReveals&&x.materials.screen.hood===(b.powerUses.CLOSE_SCREEN===b.screenReveals?'OPEN':'CLOSED')&&b.powerUses.CLOSE_SCREEN-b.screenReveals<=1&&p.visibleBodyLine===(x.materials.screen.hood==='OPEN')&&b.residualQuietingAttempts<=x.round-1&&b.spiritualInterdictionAttempts<=x.round-1&&b.powerUses.CLOSE_SCREEN<=x.round-1&&
 validPaleEmperorScene(p)&&p.siteId===PALE_EMPEROR_SITE&&p.playerLocation==='FORECOURT'&&p.observedSourceId===`${x.runId}:PE1-FORECOURT:${prep.revision}`&&p.observationWeek===prep.week&&p.knownPlayerName===prep.playerName&&p.knownEnemyName==='阿尔登·沃德'&&p.clockSeconds===16+60*(x.round-1)&&p.conditionVersion===1+b.powerUses.CLOSE_SCREEN+b.screenReveals&&validPaleEmperorBody(b)&&b.enemyStatus==='RESISTING'&&b.enemyMind>0&&typeof x.randomSeed==='string'&&!!x.randomSeed&&x.randomSeed.length<=256&&integer(x.randomCursor)&&prep.runId===x.runId&&prep.randomSeed===x.randomSeed&&prep.randomCursor<=x.randomCursor&&prep.revision<=x.revision-x.round&&b.observations.every(o=>o.round<x.round&&o.atSeconds<p.clockSeconds);
 }catch{return false;}
}
export const validatePaleEmperorCombatSource=validPaleEmperorCombatSource;

/** Shared actual consequence resolver, exposed for declared isolated BODY/MENTAL
 * tests without seeking or replacing any campaign seed/cursor. */
export function resolvePaleEmperorConsequences(x:PaleEmperorCombatSource,r:PaleEmperorRuntime,players:PaleEmperorActionEvidence[],enemies:PaleEmperorActionEvidence[],winner:'PLAYER'|'ENEMY',retreat:SliceCombatRound['retreat'],rng:ActionRandomStream) {
  const b=r.body;
  let playerHealth = r.playerH, playerRisk = x.playerRisk, outcome: PaleEmperorResolution = retreat === 'SUCCESS' ? 'RETREATED' : b.enemyMind === 0 ? 'ENEMY_SURRENDERED' : 'CONTINUE';
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
export function replayPaleEmperorCombatRound(x: PaleEmperorCombatSource, stance: SliceStance): { round: SliceCombatRound; outcome: PaleEmperorResolution } {
  if (!validPaleEmperorCombatSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new Error('缺少真实原来源。');
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = createPaleEmperorRuntime(x), b = r.body;
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = paleEmperorActionCount(playerCountRoll), enemyCount = paleEmperorEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: PaleEmperorActionEvidence[] = [], enemies: PaleEmperorActionEvidence[] = [], remaining = { PLAYER: playerCount, ENEMY: enemyCount }; let retreat: SliceCombatRound['retreat'] = 'NONE';
  if (b.enemyMind === 0) remaining.PLAYER = remaining.ENEMY = 0;
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) for (const actor of order) {
    if (!remaining[actor]) continue;
    if (actor === 'PLAYER' && stance === 'RETREAT') {
      const action=baseAction(r,'PLAYER','RETREAT',players.length+enemies.length,rng);
      remaining.PLAYER=0;retreat=r.root.ordinaryExit==='OPEN'&&r.root.playerLocation==='FORECOURT'&&r.root.playerCoordinate===4?'SUCCESS':'FAILURE';
      action.succeeded=retreat==='SUCCESS';action.label=action.succeeded?'实际开放的普通退路可达，停止抵抗后沿4米前庭与12米道路原路返回。':'实际退路受阻，不能凭意愿瞬移离场。';players.push(closeAction(action,r,rng));
      if(retreat==='SUCCESS'){remaining.ENEMY=0;break;}continue;
    }
    if (remaining.ENEMY > 0 && !r.pendingEnemyAction) declarePaleEmperorEnemyAction(x, r, drawPaleEmperorEnemyAbility(rng), enemies.length);
    remaining[actor]--; const index = players.length + enemies.length;
    if (actor === 'PLAYER') players.push(resolvePaleEmperorPlayerSlot(x, r, drawPaleEmperorAbility(rng, null, stance), index, rng));
    else enemies.push(resolvePaleEmperorEnemySlot(x, r, r.pendingEnemyAction!.planned, index, rng));
    if (b.enemyMind === 0) { b.enemyStatus = 'SURRENDERED'; remaining.PLAYER = remaining.ENEMY = 0; break; }
  }
  const sum = (a: PaleEmperorActionEvidence[], key: 'selfGain' | 'enemyReduction') => a.reduce((n, v) => n + v[key], 0);
  const core = x.physique * .35 + x.perception * .25 + x.will * .25 + x.knowledge * .15;
  const playerAdvantage = Math.max(125, base(core, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, base(x.targetCore, x.body.enemyHealth, x.body.enemyMind, x.body.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction'));
  const winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100, winner = retreat === 'SUCCESS' ? 'ENEMY' : b.enemyMind === 0 ? 'PLAYER' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  const {playerHealth,playerRisk,outcome,playerInjuries,consequenceWeights,consequenceRoll,consequenceDomain}=resolvePaleEmperorConsequences(x,r,players,enemies,winner,retreat,rng);
  advancePaleEmperorCombatClock(r, x.root.clockSeconds + 60 - r.root.clockSeconds);
  for (const key of WINDOW_KEYS) { if (r.windows[key]) r.expiredWindows.push(structuredClone(r.windows[key]!)); r.windows[key] = null; }
  r.pendingEnemyAction = null; if (b.enemyStatus !== 'RESISTING') r.materials.weapon.location = 'FORECOURT'; b.weaponLocation = r.materials.weapon.location;
  const o: PaleEmperorRoundOutcome = { ...structuredClone(b), targetId: PALE_EMPEROR_TARGET_ID, round: x.round, source: structuredClone(x), stance, continuing: outcome === 'CONTINUE', consequenceDomain,
    playerHealthAfter: playerHealth, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, playerInjuriesAfter: playerInjuries, playerRiskAfter: playerRisk, materialsAfter: structuredClone(r.materials), masteryAfter: { ...r.mastery },
    rootAfter: structuredClone(r.root), elapsedSeconds: 60, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies, expiredWindows: r.expiredWindows,
    windowsAfter: structuredClone(r.windows), pendingEnemyActionAfter: null };
  const round: SliceCombatRound = { round: x.round, stance, first, playerCount, enemyCount, playerCountRoll, enemyCountRoll,
    moves: [...players, ...enemies].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })),
    playerAdvantage, enemyAdvantage, winChance, winner, consequence: '', consequenceWeights, retreat, ...(consequenceDomain === 'NONE' ? {} : { consequenceDomain }), ...(consequenceRoll === undefined ? {} : { consequenceRoll }), paleEmperorOutcome: o };
  round.consequence = paleEmperorCombatConsequence(round); return { round, outcome };
}
export function validatePaleEmperorRoundOutcome(v: unknown): v is PaleEmperorRoundOutcome { try { const o = v as PaleEmperorRoundOutcome; return !!o && same(o, replayPaleEmperorCombatRound(o.source, o.stance).round.paleEmperorOutcome); } catch { return false; } }
export function validatePaleEmperorCombatRound(round: SliceCombatRound): boolean { try { const o = round.paleEmperorOutcome; return !!o && same(round, replayPaleEmperorCombatRound(o.source, o.stance).round); } catch { return false; } }
export function nextPaleEmperorCombatSource(o: PaleEmperorRoundOutcome): PaleEmperorCombatSource {
  return { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter,
    playerSpirituality: Math.min(120, o.playerSpiritualityAfter + 12), playerInjuries: structuredClone(o.playerInjuriesAfter), playerRisk: o.playerRiskAfter,
    root: structuredClone(o.rootAfter), body: combatBody(o), materials: structuredClone(o.materialsAfter), mastery: { ...o.masteryAfter }, randomCursor: o.randomCursorAfter };
}
export function paleEmperorCombatConsequence(round: SliceCombatRound): string {
  const o = round.paleEmperorOutcome!, who = round.winner === 'PLAYER' ? '阿尔登' : '你';
  let text = round.retreat === 'SUCCESS' ? '撤离判定成功，将沿4米前庭出口与12米普通道路实际返回。' : round.consequenceDomain === 'MENTAL' ? `${who}承受实际精神压力，精神减少10，没有新增身体伤口或身体风险。` : round.consequenceDomain === 'BODY' ? `${who}承受实际物理攻击，按共同伤势盘结算，实掷${round.consequenceRoll}/100（轻${round.consequenceWeights!.light}/重${round.consequenceWeights!.heavy}/死亡${round.consequenceWeights!.death}）。` : '本轮没有实际致伤来源，不掷身体伤势盘、不增加身体风险。';
  const attacks = round.winner === 'PLAYER' ? o.playerActions : o.enemyActions;
  if (round.consequenceDomain) text += ` 实际${round.consequenceDomain === 'BODY' ? '身体' : '精神'}来源：${attacks.filter(a => round.consequenceDomain === 'BODY' ? a.threatens : a.mentalPressure).map(a => a.selectedAbility).join('、')}。`;
  text += ` 本人健康${o.source.playerHealth}→${o.playerHealthAfter}、精神${o.source.playerMind}→${o.playerMindAfter}；阿尔登健康${o.source.body.enemyHealth}→${o.enemyHealth}、精神${o.source.body.enemyMind}→${o.enemyMind}。`;
  if (o.playerHealthAfter > 0 && o.playerMindAfter === 0) text += '本人精神耗尽，仍活着，停止抵抗后沿普通出口离开。';
  if (o.playerHealthAfter === 0) text += '本人的原身体真实死亡，本周目终结。'; else if (o.enemyHealth === 0) text += '阿尔登原身体真实死亡，唯一原棍留地。'; else if (o.enemyStatus === 'SURRENDERED') text += '阿尔登因实际伤势或精神耗尽自主停止抵抗，仍活着，原棍放在地面。';
  return text + ' 本轮实际60秒；未使用窗口到时结束，已经花费的灵性与精神不退。原棍、原灵印与原遮屏资源保留，诺拉与旧遭遇人物均不在场；诺兰原撤离、罗温旧场、欧文历史与全部旧对象不变。';
}


export function projectPaleEmperorCombat(s:SliceState){
 const e=s.paleEmperor.encounter,last=s.combat?.encounterId==='PALE_EMPEROR_DISPUTE'?s.combat.lastRound?.paleEmperorOutcome:e.terminal?s.combatHistory[e.terminal.historyIndex]?.paleEmperorOutcome:null;
 return{enemyName:'阿尔登·沃德（47岁）',targetId:e.targetId,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,weaponLocation:e.weaponLocation,powerUses:{...e.powerUses},policy:e.policy,scene:structuredClone(e.scene),materials:structuredClone(e.materials),lastConsequenceDomain:last?.consequenceDomain??'NONE',lastActionSequence:last?[...last.playerActions,...last.enemyActions].sort((a,b)=>a.order-b.order):[],constants:PALE_EMPEROR_COMBAT_CONSTANTS,countWheel:PALE_EMPEROR_COUNT_WHEEL,enemyCountWheel:PALE_EMPEROR_ENEMY_COUNT_WHEEL,abilityWheel:paleEmperorAbilityWheel(s,null),enemyAbilityWheel:PALE_EMPEROR_ENEMY_ABILITY_WHEEL,facts:[
 '体35%、感25%、意25%、知15%；双方1至6动作10/15/25/25/15/10，基础1250、底125、上限120，仅继续轮本人恢复12。',
 '残响安定与灵迹阻隔各只削弱下一次实际同源灵性或精神压力30；普通棍击不触发、不消耗窗口，已经发生的伤害不倒改。',
 '两项新能力每轮各一次，实付8或7灵性与2精神；条件改变、遮挡、离场或满20秒使窗口失效，失败和空窗口不涨掌握。',
 '阿尔登只持自己的原棍与三枚原灵印；苍白冲击7灵性加1原灵印，精神压力7、定神6、遮屏3，无对手回复。',
 '17项旧掌握完整保留；无原灰羽、免费灵体、未核验短渡、复活或旧人替换。每动作5秒、每轮60秒；身体伤势与精神损耗分别结算。']};
}
