import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/count-wheel.js';
import type { AlchemistCreation } from '../alchemist/life.js';
import { projectCivilizationEnlightenerOriginalCreation } from './life.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { CIVILIZATION_ENLIGHTENER_TARGET_ID, CIVILIZATION_ENLIGHTENER_SITE, CIVILIZATION_ENLIGHTENER_POWER_IDS, CIVILIZATION_ENLIGHTENER_POWERS,
  combatBody, initialCivilizationEnlightenerBody, hasCivilizationEnlightenerDisputeOpponent, originalCreations, validOriginals,
  validateCivilizationEnlightenerPreparation, validCivilizationEnlightenerMaterials, validCivilizationEnlightenerScene,
  type CivilizationEnlightenerCombatBody, type CivilizationEnlightenerEnemyIntent, type CivilizationEnlightenerPreparation,
  type CivilizationEnlightenerMaterials, type CivilizationEnlightenerScene, type CivilizationEnlightenerPolicy } from './encounter.js';

/** Original bounded S1 design. The established S2 count/core/resource profile is unchanged. */
export const CIVILIZATION_ENLIGHTENER_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const CIVILIZATION_ENLIGHTENER_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const civilizationEnlightenerActionCount = pyromaniacActionCount;
export const civilizationEnlightenerEnemyActionCount = pyromaniacActionCount;
export const PROCESS_ANALYSIS = 'paragon.s1.process-analysis', OPERATIONAL_GUIDANCE = 'paragon.s1.operational-guidance';
export const CIVILIZATION_ENLIGHTENER_NEW_ABILITY_IDS = [PROCESS_ANALYSIS, OPERATIONAL_GUIDANCE] as const;
export const CIVILIZATION_ENLIGHTENER_INHERITED_SKILL_IDS = ['paragon.s9.memory','paragon.s9.learning','paragon.s9.practice','paragon.s8.ancient-history','paragon.s8.wilderness','paragon.s8.ruin-caution',
 'paragon.s7.appraisal','paragon.s7.hazard-insight','paragon.s7.cautious-use','paragon.s6.mechanical-craft','paragon.s6.spiritual-craft','paragon.s6.ritual-fixation',
 'paragon.s5.precision-focus','paragon.s4.animate-made-object','paragon.s4.direct-creation','paragon.s3.bounded-analysis','paragon.s3.construct-coordination','paragon.s2.protocol-binding','paragon.s2.bounded-calibration'] as const;
export type CivilizationEnlightenerMoveId = typeof CIVILIZATION_ENLIGHTENER_INHERITED_SKILL_IDS[number] | typeof CIVILIZATION_ENLIGHTENER_NEW_ABILITY_IDS[number] | 'STRIKE' | 'BLOCK' | 'EVADE' | 'OBSERVE' | 'ACCIDENT';
const FOCUS='paragon.s5.precision-focus', ANIMATE='paragon.s4.animate-made-object', DIRECT='paragon.s4.direct-creation', ANALYSIS='paragon.s3.bounded-analysis', COORDINATION='paragon.s3.construct-coordination', BINDING='paragon.s2.protocol-binding', CALIBRATION='paragon.s2.bounded-calibration';
export const CIVILIZATION_ENLIGHTENER_ABILITIES: readonly {id:CivilizationEnlightenerMoveId;label:string;weight:number;stance:SliceStance|null}[] = [
 {id:'STRIKE',label:'本人原身体普通打击',weight:10,stance:'ATTACK'}, {id:'BLOCK',label:'普通防备',weight:4,stance:'DEFEND'}, {id:'EVADE',label:'普通避让',weight:4,stance:'DEFEND'}, {id:'OBSERVE',label:'观察眼前可见动作',weight:3,stance:'PREPARE'},
 ...CIVILIZATION_ENLIGHTENER_INHERITED_SKILL_IDS.map(id=>({id,label:({[FOCUS]:'继承短时专注：2灵性',[ANIMATE]:'原护架赋灵：4灵性与1原储能',[DIRECT]:'指挥已赋灵原架：2灵性与1原储能',[ANALYSIS]:'有限结构解析：4灵性、知识18',[COORDINATION]:'双原件协同：5灵性与各1原储能',[BINDING]:'工序封装须实际可用原指令片',[CALIBRATION]:'现场校准：4灵性1精神、知识18'} as Record<string,string>)[id] ?? '已有知识须实际材料与场景；本槽普通观察',weight:[FOCUS,ANIMATE,DIRECT,ANALYSIS,COORDINATION,BINDING,CALIBRATION].includes(id)?5:1,stance:([ANIMATE,COORDINATION,BINDING].includes(id)?'ATTACK':id===DIRECT?'DEFEND':'PREPARE') as SliceStance})),
 {id:PROCESS_ANALYSIS,label:'工艺析解：6灵性2精神、知识18、一次待执行机械动作减30',weight:14,stance:'CONTROL'},
 {id:OPERATIONAL_GUIDANCE,label:'操作启示：8灵性3精神、知识20、后来一次可用原动作加25',weight:14,stance:'PREPARE'},
 {id:'ACCIDENT',label:'判断失衡：−22.5',weight:3,stance:null},
];
export const CIVILIZATION_ENLIGHTENER_PLAYER_ABILITIES=CIVILIZATION_ENLIGHTENER_ABILITIES;
export const CIVILIZATION_ENLIGHTENER_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
 {id:'MECHANICAL_PULSE',label:'可见机械脉冲：7灵性与1装置储能、身体贡献95',weight:30},
 {id:'MIND_PRESSURE',label:'有限精神压力：7灵性、精神贡献70',weight:20},
 {id:'WARD',label:'有限护持：6灵性、减势60',weight:15}, {id:'ATTENTION',label:'集中抵抗：3灵性、一次抵抗70%',weight:10},
 {id:'BODY_STRIKE',label:'自有原杆普通打击20×身体',weight:15}, {id:'OBSERVE',label:'普通观察',weight:5}, {id:'ACCIDENT',label:'判断偏差−22.5',weight:5},
];
export const isCivilizationEnlightener=(s:SliceState)=>s.progression.pathwayId==='paragon'&&s.progression.sequence===1;
const tickets=(stance:SliceStance|null)=>CIVILIZATION_ENLIGHTENER_ABILITIES.map(a=>a.weight*(a.stance===stance&&stance!==null?5:4));
export function civilizationEnlightenerAbilityWheel(_s:SliceState,stance:SliceStance|null):SliceWheelEntry[]{const w=tickets(stance),total=w.reduce((n,v)=>n+v,0);return CIVILIZATION_ENLIGHTENER_ABILITIES.map((a,i)=>({id:a.id,label:a.label,weight:w[i]!/total*100}));}
export function drawCivilizationEnlightenerAbility(rng:ActionRandomStream,_s:SliceState|null,stance:SliceStance|null):CivilizationEnlightenerMoveId{const w=tickets(stance);let n=rng.nextInt(1,w.reduce((a,b)=>a+b,0));for(const[i,a]of CIVILIZATION_ENLIGHTENER_ABILITIES.entries()){n-=w[i]!;if(n<=0)return a.id;}throw new Error('行动盘无效。');}
export function drawCivilizationEnlightenerEnemyAbility(rng:ActionRandomStream):CivilizationEnlightenerEnemyIntent{let n=rng.nextInt(1,100);for(const a of CIVILIZATION_ENLIGHTENER_ENEMY_ABILITY_WHEEL){n-=a.weight;if(n<=0)return a.id as CivilizationEnlightenerEnemyIntent;}throw new Error('对手行动盘无效。');}
const same=(a:unknown,b:unknown)=>a===b||(a!==undefined&&b!==undefined&&stableStringify(a)===stableStringify(b));
const integer=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER):n is number=>Number.isSafeInteger(n)&&(n as number)>=min&&(n as number)<=max;
const shape=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...keys].sort());
const physicalAt=(n:number)=>n>75?1:n>50?.95:n>25?.9:.8;
export interface CivilizationEnlightenerCombatSource{
 runId:string;revision:number;week:number;date:PublicGameDate;round:number;encounterId:'CIVILIZATION_ENLIGHTENER_DISPUTE';targetId:typeof CIVILIZATION_ENLIGHTENER_TARGET_ID;
 attemptWeek:number;startHistoryIndex:number;targetName:'阿德里安·黑尔';targetAge:44;targetCore:24;actualBody:true;independentMind:true;playerBodyId:string;
 enemyWeapon:'CE1-ADRIAN-ROD';weaponOwner:typeof CIVILIZATION_ENLIGHTENER_TARGET_ID;ordinaryExit:'OPEN';pursuit:false;thirdPartiesInArea:0;policy:CivilizationEnlightenerPolicy;clubHeld:boolean;
 playerHealth:number;playerMind:number;playerSpirituality:number;playerInjuries:SliceInjury[];playerRisk:number;physique:number;perception:number;will:number;knowledge:number;mastery:Record<string,number>;
 preparation:CivilizationEnlightenerPreparation;root:CivilizationEnlightenerScene;materials:CivilizationEnlightenerMaterials;body:CivilizationEnlightenerCombatBody;creations:AlchemistCreation[];randomSeed:string;randomCursor:number;
}
export function currentCivilizationEnlightenerCombatSource(s:SliceState):CivilizationEnlightenerCombatSource|null{
 if(!hasCivilizationEnlightenerDisputeOpponent(s))return null;const e=s.civilizationEnlightener.encounter,c=s.combat!;
 return {runId:s.runId,revision:s.revision,week:s.week,date:{...s.date},round:c.round,encounterId:'CIVILIZATION_ENLIGHTENER_DISPUTE',targetId:CIVILIZATION_ENLIGHTENER_TARGET_ID,
 attemptWeek:e.attemptWeek!,startHistoryIndex:e.startHistoryIndex!,targetName:'阿德里安·黑尔',targetAge:44,targetCore:24,actualBody:true,independentMind:true,playerBodyId:`${s.runId}:body`,enemyWeapon:'CE1-ADRIAN-ROD',weaponOwner:CIVILIZATION_ENLIGHTENER_TARGET_ID,ordinaryExit:'OPEN',pursuit:false,thirdPartiesInArea:0,policy:e.policy,clubHeld:s.town.clubLocation==='HAND',
 playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,playerInjuries:structuredClone(s.injuries),playerRisk:s.injuryRisk,...s.character.coreStats,mastery:{...s.progression.mastery},preparation:structuredClone(e.preparation!),root:structuredClone(e.scene),materials:structuredClone(e.materials),body:combatBody(e),creations:structuredClone(originalCreations(s)),randomSeed:s.random.seed,randomCursor:s.random.cursor};
}
export interface CivilizationEnlightenerPendingAction{id:string;planned:CivilizationEnlightenerEnemyIntent;actual:CivilizationEnlightenerEnemyIntent;declaredAt:number;observedAt:number;observationSeconds:1;visibleIntent:string;mechanical:boolean}
export interface CivilizationEnlightenerWindow{id:string;kind:'ANALYSIS'|'GUIDANCE'|'ATTENTION'|'OLD_ANALYSIS'|'CALIBRATION';createdAt:number;expiresAt:number;targetActionId:string|null;magnitude:number}
export interface CivilizationEnlightenerWindows{analysis:CivilizationEnlightenerWindow|null;guidance:CivilizationEnlightenerWindow|null;attention:CivilizationEnlightenerWindow|null;oldAnalysis:CivilizationEnlightenerWindow|null;calibration:CivilizationEnlightenerWindow|null}
export interface CivilizationEnlightenerActionEvidence{
 order:number;actor:'PLAYER'|'ENEMY';id:string;planned:string;selectedAbility:string;fallbackReason:string|null;label:string;selfGain:number;enemyReduction:number;threatens:boolean;mentalPressure:boolean;attackKind:'NONE'|'BODY'|'MENTAL';rawContribution:number;rawReduction:number;
 paidCost:number;mindCost:number;physicalFactor:number;check:PublicCheckResult|null;resistanceRoll:number|null;resistanceChance:number|null;succeeded:boolean;
 finiteResult:'NONE'|'UNAVAILABLE'|'ALREADY_ATTEMPTED'|'INSUFFICIENT'|'FAILED'|'RESISTED'|'PENDING'|'APPLIED';
 windowsBefore:CivilizationEnlightenerWindows;windowsAfter:CivilizationEnlightenerWindows;pendingBefore:CivilizationEnlightenerPendingAction|null;pendingAfter:CivilizationEnlightenerPendingAction|null;masteryApplied:string[];countered:string[];
 creationsBefore:AlchemistCreation[];creationsAfter:AlchemistCreation[];boxChargeSpent:number;frameChargeSpent:number;frameDurabilityDamage:number;mechanismChargeSpent:number;
 atSeconds:number;elapsedSeconds:4;travelMetres:number;randomCursorBefore:number;randomCursorAfter:number;playerMindAfter:number;playerSpiritualityAfter:number;enemyMindAfter:number;enemySpiritualityAfter:number;
}
export interface CivilizationEnlightenerRuntime{
 body:CivilizationEnlightenerCombatBody;root:CivilizationEnlightenerScene;materials:CivilizationEnlightenerMaterials;creations:AlchemistCreation[];playerH:number;playerM:number;playerS:number;mastery:Record<string,number>;
 windows:CivilizationEnlightenerWindows;expiredWindows:CivilizationEnlightenerWindow[];pendingEnemyAction:CivilizationEnlightenerPendingAction|null;analysisAttempted:boolean;guidanceAttempted:boolean;calibrationAttempted:boolean;pendingGuards:number;
}
export function createCivilizationEnlightenerRuntime(x:CivilizationEnlightenerCombatSource):CivilizationEnlightenerRuntime{return{body:structuredClone(x.body),root:structuredClone(x.root),materials:structuredClone(x.materials),creations:structuredClone(x.creations),playerH:x.playerHealth,playerM:x.playerMind,playerS:x.playerSpirituality,mastery:{...x.mastery},windows:{analysis:null,guidance:null,attention:null,oldAnalysis:null,calibration:null},expiredWindows:[],pendingEnemyAction:null,analysisAttempted:false,guidanceAttempted:false,calibrationAttempted:false,pendingGuards:0};}
export function advanceCivilizationEnlightenerCombatClock(r:CivilizationEnlightenerRuntime,seconds:number):void{if(!integer(seconds))throw new Error('实际时间无效。');r.root.clockSeconds+=seconds;r.root.externalSeconds+=seconds;for(const key of ['analysis','guidance','attention','oldAnalysis','calibration'] as const){const w=r.windows[key];if(w&&w.expiresAt<=r.root.clockSeconds){r.expiredWindows.push(structuredClone(w));r.windows[key]=null;}}}
export function declareCivilizationEnlightenerEnemyAction(x:CivilizationEnlightenerCombatSource,r:CivilizationEnlightenerRuntime,planned:CivilizationEnlightenerEnemyIntent,index:number):CivilizationEnlightenerPendingAction{
 if(r.pendingEnemyAction||!CIVILIZATION_ENLIGHTENER_ENEMY_ABILITY_WHEEL.some(a=>a.id===planned)||r.body.enemyMind<=0)throw new Error('不能覆盖待执行动作或替已停战者行动。');
 const power=CIVILIZATION_ENLIGHTENER_POWERS.find(p=>p.id===planned);const actual=power&&(r.body.enemySpirituality<power.cost||planned==='MECHANICAL_PULSE'&&r.materials.mechanism.charge===0)?'BODY_STRIKE':planned==='ATTENTION'&&r.windows.attention?'OBSERVE':planned;
 const at=r.root.clockSeconds;advanceCivilizationEnlightenerCombatClock(r,1);
 r.pendingEnemyAction={id:`${x.runId}:CE1-PENDING:${x.round}:${index}`,planned,actual,declaredAt:at,observedAt:r.root.clockSeconds,observationSeconds:1,mechanical:actual==='MECHANICAL_PULSE',visibleIntent:actual==='MECHANICAL_PULSE'?'眼前同一装置轴承开始受力，准备沿当前导轨发出一次脉冲':actual==='BODY_STRIKE'?'握紧自己的原杆准备普通打击':actual==='MIND_PRESSURE'?'集中精神准备一次有限压力':actual==='WARD'?'抬手准备有限护持':actual==='ATTENTION'?'收束注意准备抵抗':'眼前普通观察或判断偏差'};return structuredClone(r.pendingEnemyAction);
}
function baseAction(r:CivilizationEnlightenerRuntime,actor:'PLAYER'|'ENEMY',id:string,order:number,rng:ActionRandomStream):CivilizationEnlightenerActionEvidence{return{order,actor,id,planned:id,selectedAbility:id,fallbackReason:null,label:'',selfGain:0,enemyReduction:0,threatens:false,mentalPressure:false,attackKind:'NONE',rawContribution:0,rawReduction:0,paidCost:0,mindCost:0,physicalFactor:physicalAt(actor==='PLAYER'?r.playerH:r.body.enemyHealth),check:null,resistanceRoll:null,resistanceChance:null,succeeded:false,finiteResult:'NONE',windowsBefore:structuredClone(r.windows),windowsAfter:structuredClone(r.windows),pendingBefore:structuredClone(r.pendingEnemyAction),pendingAfter:null,masteryApplied:[],countered:[],creationsBefore:structuredClone(r.creations),creationsAfter:structuredClone(r.creations),boxChargeSpent:0,frameChargeSpent:0,frameDurabilityDamage:0,mechanismChargeSpent:0,atSeconds:r.root.clockSeconds,elapsedSeconds:4,travelMetres:0,randomCursorBefore:rng.cursor,randomCursorAfter:rng.cursor,playerMindAfter:r.playerM,playerSpiritualityAfter:r.playerS,enemyMindAfter:r.body.enemyMind,enemySpiritualityAfter:r.body.enemySpirituality};}
function closeAction(a:CivilizationEnlightenerActionEvidence,r:CivilizationEnlightenerRuntime,rng:ActionRandomStream){advanceCivilizationEnlightenerCombatClock(r,4);a.windowsAfter=structuredClone(r.windows);a.pendingAfter=structuredClone(r.pendingEnemyAction);a.creationsAfter=structuredClone(r.creations);a.randomCursorAfter=rng.cursor;a.playerMindAfter=r.playerM;a.playerSpiritualityAfter=r.playerS;a.enemyMindAfter=r.body.enemyMind;a.enemySpiritualityAfter=r.body.enemySpirituality;a.threatens=a.attackKind==='BODY'&&a.selfGain>0;a.mentalPressure=a.attackKind==='MENTAL'&&a.selfGain>0;a.label+=` 实际4秒，本人灵性${r.playerS}、精神${r.playerM}，对手灵性${r.body.enemySpirituality}。`;return a;}
function ordinary(x:CivilizationEnlightenerCombatSource,r:CivilizationEnlightenerRuntime,a:CivilizationEnlightenerActionEvidence,why:string,attack=false){a.selectedAbility=attack?'STRIKE':'BLOCK';a.fallbackReason=why;a.label=why+(attack?'本人用原身体普通打击。':'本人普通防备。');if(attack){a.selfGain=(x.clubHeld?16:12)*a.physicalFactor;a.attackKind='BODY';a.travelMetres=4;r.root.playerTravelMetres+=4;}else a.enemyReduction=10;}
function pay(r:CivilizationEnlightenerRuntime,a:CivilizationEnlightenerActionEvidence,s:number,m=0){if(r.playerS<s||r.playerM<=m)return false;r.playerS-=s;r.playerM-=m;r.body.totalOwnerMindSpent+=m;a.paidCost=s;a.mindCost=m;return true;}
function check(x:CivilizationEnlightenerCombatSource,a:CivilizationEnlightenerActionEvidence,difficulty:number,rng:ActionRandomStream){a.check=resolveNormalCheck({ability:'knowledge',baseAbility:x.knowledge,difficulty,modifiers:[],roll:rng.nextInt(1,100)});a.succeeded=['SUCCESS','GREAT_SUCCESS'].includes(a.check.tier);a.label+=`知识检定${a.check.roll}，${a.succeeded?'成功':'失败'}。`;return a.succeeded;}
function resist(r:CivilizationEnlightenerRuntime,a:CivilizationEnlightenerActionEvidence,rng:ActionRandomStream){const attention=r.windows.attention;a.resistanceChance=attention?70:30;a.resistanceRoll=rng.nextInt(1,100);if(attention){a.countered.push(attention.id);r.windows.attention=null;}if(a.resistanceRoll<=a.resistanceChance){a.succeeded=false;a.finiteResult='RESISTED';a.label+=`抵抗${a.resistanceRoll}≤${a.resistanceChance}，成本保留。`;return false;}a.label+=`抵抗${a.resistanceRoll}>${a.resistanceChance}。`;return true;}
function gainMastery(r:CivilizationEnlightenerRuntime,a:CivilizationEnlightenerActionEvidence,id:string){r.mastery[id]=Math.min(500,(r.mastery[id]??0)+8);a.masteryApplied.push(id);}
function window(r:CivilizationEnlightenerRuntime,kind:CivilizationEnlightenerWindow['kind'],order:number,magnitude:number,target:string|null=null):CivilizationEnlightenerWindow{return{id:`CE1-${kind}-${r.root.clockSeconds}-${order}`,kind,createdAt:r.root.clockSeconds,expiresAt:r.root.clockSeconds+30,targetActionId:target,magnitude};}
export function resolveCivilizationEnlightenerPlayerSlot(x:CivilizationEnlightenerCombatSource,r:CivilizationEnlightenerRuntime,id:CivilizationEnlightenerMoveId,order:number,rng:ActionRandomStream):CivilizationEnlightenerActionEvidence{
 if(!CIVILIZATION_ENLIGHTENER_ABILITIES.some(a=>a.id===id))throw new Error('未知本人动作。');const a=baseAction(r,'PLAYER',id,order,rng),frame=r.creations.find(v=>v.id==='AL4-FRAME-1'),box=r.creations.find(v=>v.id==='AL4-BOX-1');
 const usable=(v:AlchemistCreation|undefined):v is AlchemistCreation=>!!v&&v.location==='YARD'&&v.charge>0&&v.durability>0;
 const oldMastery=(key:string)=>.65+.35*(x.mastery[key]??0)/500;
 let originalUsable=false,originalConstruct=false;
 if(x.policy==='ORDINARY'&&id.startsWith('paragon.'))ordinary(x,r,a,'预先选择只作普通行动；');
 else if(id===PROCESS_ANALYSIS||id===OPERATIONAL_GUIDANCE){
  const analysis=id===PROCESS_ANALYSIS,allowed=x.policy==='ALL'||x.policy===(analysis?'PROCESS_ANALYSIS':'OPERATIONAL_GUIDANCE'),attempted=analysis?r.analysisAttempted:r.guidanceAttempted,p=r.pendingEnemyAction;
  if(!allowed||analysis&&(!p||!p.mechanical||p.observedAt>r.root.clockSeconds)){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,analysis?'没有已实际观察且仍待执行的可见机械动作；':'预先策略未允许操作启示；');}
  else if(attempted){a.finiteResult='ALREADY_ATTEMPTED';a.label='本轮已经实际尝试，不重骰、不延长窗口。';}
  else if(!pay(r,a,analysis?6:8,analysis?2:3)){a.finiteResult='INSUFFICIENT';a.label='灵性或精神不足，未施放，不重抽。';}
  else{if(analysis){r.analysisAttempted=true;r.body.analysisAttempts++;}else{r.guidanceAttempted=true;r.body.guidanceAttempts++;}
   a.label=analysis?'只析解眼前尚未执行的装置受力动作。':'只启示本人已会的有限操作。';
   if(!check(x,a,analysis?18:20,rng))a.finiteResult='FAILED';
   else if(!analysis||resist(r,a,rng)){a.finiteResult='PENDING';if(analysis)r.windows.analysis=window(r,'ANALYSIS',order,30,p!.id);else r.windows.guidance=window(r,'GUIDANCE',order,25);a.label+='30秒内仅一次真实应用；施放本身没有掌握奖励。';}
  }
 }else if(id==='STRIKE'){ordinary(x,r,a,'',true);a.fallbackReason=null;originalUsable=true;}
 else if(id==='BLOCK'||id==='EVADE'){a.enemyReduction=10;a.label='本人原身体普通防备，不免除真实伤势。';originalUsable=true;}
 else if(id==='OBSERVE'){a.label='实际观察眼前原人原物和待执行动作；没有隐藏信息或免费资源。';}
 else if(id==='ACCIDENT'){a.selfGain=-22.5;a.label='判断失衡，固定−22.5，不重抽。';}
 else if(id===FOCUS){if(pay(r,a,2)){a.selfGain=12*oldMastery(id);a.succeeded=true;originalUsable=true;a.label='继承短时专注实付2灵性。';}else ordinary(x,r,a,'不足2灵性；');}
 else if(id===ANALYSIS){if(r.windows.oldAnalysis)a.label='已有本轮未用弱处窗口，不叠加。';else if(!pay(r,a,4))ordinary(x,r,a,'不足4灵性；');else if(check(x,a,18,rng)){r.windows.oldAnalysis=window(r,'OLD_ANALYSIS',order,12);a.label+='仅本轮后来一次普通打击可消费。';}}
 else if(id===CALIBRATION){if(r.calibrationAttempted)a.label='本轮已尝试校准，不重试。';else if(!frame||!box||frame.durability===0||box.durability===0||!pay(r,a,4,1))ordinary(x,r,a,'缺少完好同一原件或4灵性1精神；');else{r.calibrationAttempted=true;if(check(x,a,18,rng)){r.windows.calibration=window(r,'CALIBRATION',order,18);a.label+='仅后来成功原造物动作可用，不回充修复。';}}}
 else if(id===BINDING)ordinary(x,r,a,'旧原指令片已用尽或失败，当前没有可用原片；',true);
 else if(id===COORDINATION){if(!usable(frame)||!usable(box)||!pay(r,a,5))ordinary(x,r,a,'原盒原架缺实际储能或不足5灵性；',true);else{frame.charge--;box.charge--;frame.active=box.active=false;a.frameChargeSpent=a.boxChargeSpent=1;if(check(x,a,18,rng)&&resist(r,a,rng)){a.selfGain=40;a.enemyReduction=20;a.attackKind='BODY';originalUsable=originalConstruct=true;a.label+='同一原盒原架一次有限协同后停止。';}}}
 else if(id===ANIMATE){if(!usable(frame)||!pay(r,a,4))ordinary(x,r,a,'同一原架缺储能或不足4灵性；',true);else{frame.charge--;a.frameChargeSpent=1;if(check(x,a,16,rng)){frame.active=frame.charge>0;a.selfGain=40*oldMastery(id);a.attackKind='BODY';originalUsable=originalConstruct=true;a.label+='原架仅沿眼前路线一次推挡。';}else if(frame.charge===0)frame.active=false;}}
 else if(id===DIRECT){if(!usable(frame)||!frame.active||!pay(r,a,2))ordinary(x,r,a,'原架未实际赋灵、缺能或不足2灵性；');else{frame.charge--;a.frameChargeSpent=1;if(frame.charge===0)frame.active=false;r.pendingGuards++;a.enemyReduction=26;a.succeeded=true;originalUsable=originalConstruct=true;a.label='同一原架有限防守；只有后来实际承接原杆才损5耐久。';}}
 else{a.selectedAbility='OBSERVE';a.fallbackReason='当前缺少这项旧知识的真实施作材料或情境';a.label='已有知识保持原掌握，本槽普通观察；不制造工具、不加入新能力。';}
 if(a.selectedAbility==='STRIKE'&&r.windows.oldAnalysis){a.selfGain+=12*a.physicalFactor;a.countered.push(r.windows.oldAnalysis.id);r.windows.oldAnalysis=null;}
 if(originalConstruct&&r.windows.calibration){if(a.selfGain>0)a.selfGain+=18;else a.enemyReduction+=18;a.countered.push(r.windows.calibration.id);r.windows.calibration=null;}
 a.rawContribution=a.selfGain;a.rawReduction=a.enemyReduction;
 const guidance=r.windows.guidance;if(originalUsable&&guidance&&guidance.createdAt<a.atSeconds&&guidance.expiresAt>a.atSeconds){if(a.selfGain>0)a.selfGain+=25;else a.enemyReduction+=25;a.countered.push(guidance.id);r.windows.guidance=null;r.body.guidanceSuccesses++;gainMastery(r,a,OPERATIONAL_GUIDANCE);a.label+='已付操作启示只增强这一次后来实际可用的原动作25，窗口用尽。';}
 return closeAction(a,r,rng);
}
export function resolveCivilizationEnlightenerEnemySlot(x:CivilizationEnlightenerCombatSource,r:CivilizationEnlightenerRuntime,planned:CivilizationEnlightenerEnemyIntent,order:number,rng:ActionRandomStream):CivilizationEnlightenerActionEvidence{
 if(!r.pendingEnemyAction)declareCivilizationEnlightenerEnemyAction(x,r,planned,order);const p=r.pendingEnemyAction!;if(p.planned!==planned)throw new Error('不能替换已观察的待执行动作。');
 const a=baseAction(r,'ENEMY',p.actual,order,rng);a.planned=planned;a.selectedAbility=p.actual;const power=CIVILIZATION_ENLIGHTENER_POWERS.find(v=>v.id===p.actual);
 if(power){if(r.body.enemySpirituality<power.cost)throw new Error('已声明对手资源不一致。');r.body.enemySpirituality-=power.cost;r.body.powerUses[power.id]++;a.paidCost=power.cost;a.selfGain=power.selfGain;a.enemyReduction=power.enemyReduction;a.succeeded=true;
  if(power.id==='MECHANICAL_PULSE'){if(r.materials.mechanism.charge<1)throw new Error('原装置已无储能。');r.materials.mechanism.charge--;a.mechanismChargeSpent=1;a.attackKind='BODY';}
  if(power.id==='MIND_PRESSURE')a.attackKind='MENTAL';if(power.id==='ATTENTION')r.windows.attention=window(r,'ATTENTION',order,70);
  a.label=`阿德里安实际施放${power.label}，独立灵性−${power.cost}。`;
 }else if(p.actual==='BODY_STRIKE'){a.selfGain=20*a.physicalFactor;a.attackKind='BODY';a.label='阿德里安用自己的唯一原杆普通打击；原装置或灵性不足时不施法、不重抽。';const f=r.creations.find(v=>v.id==='AL4-FRAME-1');if(r.pendingGuards>0&&f&&f.durability>0){r.pendingGuards--;a.frameDurabilityDamage=Math.min(5,f.durability);f.durability-=a.frameDurabilityDamage;if(f.durability===0)f.active=false;a.label+=`已实付指挥的原架承接原杆，实际耐久−${a.frameDurabilityDamage}。`;}}
 else if(p.actual==='ACCIDENT'){a.selfGain=-22.5;a.label='对手判断偏差，−22.5，不重抽。';}else a.label='对手普通观察，不生成额外资源。';
 a.rawContribution=a.selfGain;a.rawReduction=a.enemyReduction;
 const analysis=r.windows.analysis;if(analysis&&analysis.targetActionId===p.id&&analysis.expiresAt>a.atSeconds){r.windows.analysis=null;a.countered.push(analysis.id);const reduced=p.mechanical?Math.min(30,Math.max(0,a.selfGain)):0;a.selfGain-=reduced;if(reduced>0){r.body.analysisSuccesses++;gainMastery(r,a,PROCESS_ANALYSIS);a.label+=`此前已观察并实付析解只使本项仍待执行机械动作减${reduced}，不改变过去伤害或以后动作。`;}}
 r.pendingEnemyAction=null;return closeAction(a,r,rng);
}

export interface CivilizationEnlightenerRoundOutcome extends CivilizationEnlightenerCombatBody {
  targetId: typeof CIVILIZATION_ENLIGHTENER_TARGET_ID; round: number; source: CivilizationEnlightenerCombatSource; stance: SliceStance; continuing: boolean;
  playerHealthAfter: number; playerMindAfter: number; playerSpiritualityAfter: number; playerInjuriesAfter: SliceInjury[]; playerRiskAfter: number; materialsAfter: CivilizationEnlightenerMaterials; creations: AlchemistCreation[]; masteryAfter: Record<string, number>;
  rootAfter: CivilizationEnlightenerScene; elapsedSeconds: 60; randomCursorAfter: number; playerActions: CivilizationEnlightenerActionEvidence[]; enemyActions: CivilizationEnlightenerActionEvidence[];
  expiredWindows: CivilizationEnlightenerWindow[]; windowsAfter: CivilizationEnlightenerWindows; pendingEnemyActionAfter: null;
}
export type CivilizationEnlightenerResolution = 'CONTINUE' | 'PLAYER_DEAD' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED' | 'RETREATED';
function penalty(n: number, max: number) { const f = n / max; return f > .75 ? 0 : f > .5 ? .05 : f > .25 ? .1 : .2; }
function base(core: number, h: number, m: number, s: number) { return (1250 + Math.min(core, 250)) * (1 - Math.min(.4, penalty(h, 100) + penalty(m, 100) + penalty(s, 120))); }
function weights(risk: number) { const death = Math.min(100, 5 + Math.min(risk, 10) * 10), shifted = death - 5; return { light: Math.max(0, 65 - shifted), heavy: Math.max(0, 30 - Math.max(0, shifted - 65)), death }; }
export function validCivilizationEnlightenerBody(b:CivilizationEnlightenerCombatBody):boolean {
 return integer(b.enemyHealth,0,100) && integer(b.enemyMind,0,100) && integer(b.enemySpirituality,0,120) && integer(b.enemyRisk) && Array.isArray(b.enemyInjuries) &&
 ['RESISTING','SURRENDERED','DEAD'].includes(b.enemyStatus) && (b.enemyStatus==='DEAD')===(b.enemyHealth===0) && (b.enemyMind>0||b.enemyStatus!=='RESISTING') && ['HAND','YARD'].includes(b.weaponLocation) && (b.enemyStatus==='RESISTING'||b.weaponLocation==='YARD') &&
 shape(b.powerUses,CIVILIZATION_ENLIGHTENER_POWER_IDS) && CIVILIZATION_ENLIGHTENER_POWER_IDS.every(id=>integer(b.powerUses[id])) && b.enemySpirituality===120-CIVILIZATION_ENLIGHTENER_POWERS.reduce((n,p)=>n+p.cost*b.powerUses[p.id],0) && b.powerUses.MECHANICAL_PULSE<=4 &&
 integer(b.totalOwnerMindSpent) && integer(b.analysisAttempts) && integer(b.guidanceAttempts) && integer(b.analysisSuccesses,0,b.analysisAttempts) && integer(b.guidanceSuccesses,0,b.guidanceAttempts) && b.totalOwnerMindSpent>=2*b.analysisAttempts+3*b.guidanceAttempts;
}
export function validCivilizationEnlightenerInjuries(injuries: SliceInjury[], revision: number): boolean {
  return Array.isArray(injuries) && new Set(injuries.map(i => i.id)).size === injuries.length && injuries.every(i => shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && !!i.id && ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision, 0, revision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision, revision)));
}
const SOURCE_KEYS=['runId','revision','week','date','round','encounterId','targetId','attemptWeek','startHistoryIndex','targetName','targetAge','targetCore','actualBody','independentMind','playerBodyId','enemyWeapon','weaponOwner','ordinaryExit','pursuit','thirdPartiesInArea','policy','clubHeld','playerHealth','playerMind','playerSpirituality','playerInjuries','playerRisk','physique','perception','will','knowledge','mastery','preparation','root','materials','body','creations','randomSeed','randomCursor'];
export function validCivilizationEnlightenerCombatSource(x:CivilizationEnlightenerCombatSource):boolean {
 try{const p=x.root,prep=x.preparation;
 return shape(x,SOURCE_KEYS)&&shape(x.body,Object.keys(initialCivilizationEnlightenerBody()))&&validateCivilizationEnlightenerPreparation(prep)&&typeof x.runId==='string'&&!!x.runId&&integer(x.revision)&&x.week===prep.week&&isValidGameDate(x.date)&&same(x.date,prep.date)&&integer(x.round,1)&&integer(x.startHistoryIndex)&&x.attemptWeek===x.week&&x.encounterId==='CIVILIZATION_ENLIGHTENER_DISPUTE'&&x.targetId===CIVILIZATION_ENLIGHTENER_TARGET_ID&&x.targetName==='阿德里安·黑尔'&&x.targetAge===44&&x.targetCore===24&&x.actualBody===true&&x.independentMind===true&&x.playerBodyId===`${x.runId}:body`&&x.enemyWeapon==='CE1-ADRIAN-ROD'&&x.weaponOwner===CIVILIZATION_ENLIGHTENER_TARGET_ID&&x.ordinaryExit==='OPEN'&&x.pursuit===false&&x.thirdPartiesInArea===0&&['INHERITED_ONLY','PROCESS_ANALYSIS','OPERATIONAL_GUIDANCE','ALL','ORDINARY'].includes(x.policy)&&x.clubHeld===prep.playerClubHeld&&
 [x.playerHealth,x.playerMind].every(n=>integer(n,1,100))&&integer(x.playerSpirituality,0,120)&&[x.physique,x.perception,x.will,x.knowledge].every(n=>integer(n,0,500))&&same({physique:x.physique,perception:x.perception,will:x.will,knowledge:x.knowledge},prep.after.coreStats)&&
 shape(x.mastery,[...CIVILIZATION_ENLIGHTENER_INHERITED_SKILL_IDS,...CIVILIZATION_ENLIGHTENER_NEW_ABILITY_IDS])&&same(Object.keys(x.mastery).sort(),Object.keys(prep.after.mastery).sort())&&Object.values(x.mastery).every(n=>integer(n,0,500))&&Object.entries(prep.after.mastery).every(([id,v])=>(CIVILIZATION_ENLIGHTENER_NEW_ABILITY_IDS as readonly string[]).includes(id)?x.mastery[id]!>=v:x.mastery[id]===v)&&
 integer(x.playerRisk)&&validCivilizationEnlightenerInjuries(x.playerInjuries,x.revision)&&validCivilizationEnlightenerInjuries(x.body.enemyInjuries,x.revision)&&validCivilizationEnlightenerMaterials(x.materials)&&x.materials.weapon.location===x.body.weaponLocation&&x.materials.mechanism.charge===4-x.body.powerUses.MECHANICAL_PULSE&&
 validCivilizationEnlightenerScene(p)&&p.siteId===CIVILIZATION_ENLIGHTENER_SITE&&p.playerLocation==='YARD'&&p.observedSourceId===`${x.runId}:CE1-YARD:${prep.revision}`&&p.observationWeek===prep.week&&p.knownPlayerName===prep.playerName&&p.knownEnemyName==='阿德里安·黑尔'&&p.clockSeconds===4+60*(x.round-1)&&validCivilizationEnlightenerBody(x.body)&&x.body.enemyStatus==='RESISTING'&&x.body.enemyMind>0&&typeof x.randomSeed==='string'&&!!x.randomSeed&&integer(x.randomCursor)&&prep.runId===x.runId&&prep.randomSeed===x.randomSeed&&prep.randomCursor<=x.randomCursor&&prep.revision<=x.revision-x.round&&
 validOriginals(x.creations,x.runId,x.week,'YARD')&&x.creations.every((v,i)=>{const initial=prep.originalsAfter[i]!;return same({...v,charge:initial.charge,durability:initial.durability,active:initial.active},initial)&&v.charge<=initial.charge&&v.durability<=initial.durability;});
 }catch{return false;}
}
export const validateCivilizationEnlightenerCombatSource=validCivilizationEnlightenerCombatSource;
export function replayCivilizationEnlightenerCombatRound(x: CivilizationEnlightenerCombatSource, stance: SliceStance): { round: SliceCombatRound; outcome: CivilizationEnlightenerResolution } {
  if (!validCivilizationEnlightenerCombatSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new Error('缺少真实原来源。');
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = createCivilizationEnlightenerRuntime(x), b = r.body;
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = civilizationEnlightenerActionCount(playerCountRoll), enemyCount = civilizationEnlightenerEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: CivilizationEnlightenerActionEvidence[] = [], enemies: CivilizationEnlightenerActionEvidence[] = [], remaining = { PLAYER: playerCount, ENEMY: enemyCount }; let retreat: SliceCombatRound['retreat'] = 'NONE';
  if (b.enemyMind === 0) remaining.PLAYER = remaining.ENEMY = 0;
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) for (const actor of order) {
    if (!remaining[actor]) continue;
    if (actor === 'PLAYER' && stance === 'RETREAT') { remaining.PLAYER = 0; retreat = rng.nextInt(1, 100) <= 50 ? 'SUCCESS' : 'FAILURE'; if (retreat === 'SUCCESS') { remaining.ENEMY = 0; break; } continue; }
    if (remaining.ENEMY > 0 && !r.pendingEnemyAction) declareCivilizationEnlightenerEnemyAction(x, r, drawCivilizationEnlightenerEnemyAbility(rng), enemies.length);
    remaining[actor]--; const index = players.length + enemies.length;
    if (actor === 'PLAYER') players.push(resolveCivilizationEnlightenerPlayerSlot(x, r, drawCivilizationEnlightenerAbility(rng, null, stance), index, rng));
    else enemies.push(resolveCivilizationEnlightenerEnemySlot(x, r, r.pendingEnemyAction!.planned, index, rng));
    if (b.enemyMind === 0) { b.enemyStatus = 'SURRENDERED'; remaining.PLAYER = remaining.ENEMY = 0; break; }
  }
  const sum = (a: CivilizationEnlightenerActionEvidence[], key: 'selfGain' | 'enemyReduction') => a.reduce((n, v) => n + v[key], 0);
  const core = x.physique * .30 + x.perception * .30 + x.will * .25 + x.knowledge * .15;
  const playerAdvantage = Math.max(125, base(core, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, base(x.targetCore, x.body.enemyHealth, x.body.enemyMind, x.body.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction'));
  const winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100, winner = retreat === 'SUCCESS' ? 'ENEMY' : b.enemyMind === 0 ? 'PLAYER' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  let playerHealth = r.playerH, playerRisk = x.playerRisk, outcome: CivilizationEnlightenerResolution = retreat === 'SUCCESS' ? 'RETREATED' : b.enemyMind === 0 ? 'ENEMY_SURRENDERED' : 'CONTINUE';
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
  advanceCivilizationEnlightenerCombatClock(r, x.root.clockSeconds + 60 - r.root.clockSeconds);
  for (const key of ['analysis','guidance','attention','oldAnalysis','calibration'] as const) { if (r.windows[key]) r.expiredWindows.push(structuredClone(r.windows[key]!)); r.windows[key] = null; }
  r.pendingEnemyAction = null; for(const creation of r.creations) if(outcome!=='CONTINUE'||creation.charge===0||creation.durability===0) creation.active=false; if (b.enemyStatus !== 'RESISTING') r.materials.weapon.location = 'YARD'; b.weaponLocation = r.materials.weapon.location;
  const o: CivilizationEnlightenerRoundOutcome = { ...structuredClone(b), targetId: CIVILIZATION_ENLIGHTENER_TARGET_ID, round: x.round, source: structuredClone(x), stance, continuing: outcome === 'CONTINUE',
    playerHealthAfter: playerHealth, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, playerInjuriesAfter: playerInjuries, playerRiskAfter: playerRisk, materialsAfter: structuredClone(r.materials), creations: structuredClone(r.creations), masteryAfter: { ...r.mastery },
    rootAfter: structuredClone(r.root), elapsedSeconds: 60, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies, expiredWindows: r.expiredWindows,
    windowsAfter: structuredClone(r.windows), pendingEnemyActionAfter: null };
  const round: SliceCombatRound = { round: x.round, stance, first, playerCount, enemyCount, playerCountRoll, enemyCountRoll,
    moves: [...players, ...enemies].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })),
    playerAdvantage, enemyAdvantage, winChance, winner, consequence: '', consequenceWeights, retreat, ...(consequenceDomain === undefined ? {} : { consequenceDomain }), ...(consequenceRoll === undefined ? {} : { consequenceRoll }), civilizationEnlightenerOutcome: o };
  round.consequence = civilizationEnlightenerCombatConsequence(round); return { round, outcome };
}
export function validateCivilizationEnlightenerRoundOutcome(v: unknown): v is CivilizationEnlightenerRoundOutcome { try { const o = v as CivilizationEnlightenerRoundOutcome; return !!o && same(o, replayCivilizationEnlightenerCombatRound(o.source, o.stance).round.civilizationEnlightenerOutcome); } catch { return false; } }
export function validateCivilizationEnlightenerCombatRound(round: SliceCombatRound): boolean { try { const o = round.civilizationEnlightenerOutcome; return !!o && same(round, replayCivilizationEnlightenerCombatRound(o.source, o.stance).round); } catch { return false; } }
export function nextCivilizationEnlightenerCombatSource(o: CivilizationEnlightenerRoundOutcome): CivilizationEnlightenerCombatSource {
  return { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter,
    playerSpirituality: Math.min(120, o.playerSpiritualityAfter + 12), playerInjuries: structuredClone(o.playerInjuriesAfter), playerRisk: o.playerRiskAfter,
    root: structuredClone(o.rootAfter), body: combatBody(o), materials: structuredClone(o.materialsAfter), creations: structuredClone(o.creations), mastery: { ...o.masteryAfter }, randomCursor: o.randomCursorAfter };
}
export function civilizationEnlightenerCombatConsequence(round: SliceCombatRound): string {
  const o = round.civilizationEnlightenerOutcome!, who = round.winner === 'PLAYER' ? '阿德里安' : '你';
  let text = round.retreat === 'SUCCESS' ? '撤离判定成功，将沿普通4米出口实际离开。' : round.consequenceDomain === 'MENTAL' ? `${who}承受实际精神压力，精神减少10，没有新增身体伤口或身体风险。` : round.consequenceDomain === 'BODY' ? `${who}承受实际物理攻击，按共同伤势盘结算，实掷${round.consequenceRoll}/100（轻${round.consequenceWeights!.light}/重${round.consequenceWeights!.heavy}/死亡${round.consequenceWeights!.death}）。` : '本轮没有实际致伤来源，不掷身体伤势盘、不增加身体风险。';
  const attacks = round.winner === 'PLAYER' ? o.playerActions : o.enemyActions;
  if (round.consequenceDomain) text += ` 实际${round.consequenceDomain === 'BODY' ? '身体' : '精神'}来源：${attacks.filter(a => round.consequenceDomain === 'BODY' ? a.threatens : a.mentalPressure).map(a => a.selectedAbility).join('、')}。`;
  text += ` 本人健康${o.source.playerHealth}→${o.playerHealthAfter}、精神${o.source.playerMind}→${o.playerMindAfter}；阿德里安健康${o.source.body.enemyHealth}→${o.enemyHealth}、精神${o.source.body.enemyMind}→${o.enemyMind}。`;
  if (o.playerHealthAfter > 0 && o.playerMindAfter === 0) text += '本人精神耗尽，仍活着，停止抵抗后沿普通出口离开。';
  if (o.playerHealthAfter === 0) text += '本人的原身体真实死亡，本周目终结。'; else if (o.enemyHealth === 0) text += '阿德里安原身体真实死亡，唯一原杆留地。'; else if (o.enemyStatus === 'SURRENDERED') text += '阿德里安因实际伤势或精神耗尽自主停止抵抗，仍活着，原杆放在地面。';
  return text + ' 本轮实际60秒；未使用窗口到时结束，已经花费的灵性与精神不退。同一原件资源保留，维拉与旧遭遇人物均不在场。';
}
/** Public evidence uses positive nested allowlists; no source replay inputs cross this boundary. */
const publicInjury = (i: SliceInjury) => ({ id: i.id, severity: i.severity, acquiredRevision: i.acquiredRevision, treatedRevision: i.treatedRevision });
const publicWindow = (w: CivilizationEnlightenerWindow) => ({
  id: w.id, kind: w.kind, createdAt: w.createdAt, expiresAt: w.expiresAt, targetActionId: w.targetActionId, magnitude: w.magnitude,
});
const publicWindows = (w: CivilizationEnlightenerWindows) => ({
  analysis: w.analysis ? publicWindow(w.analysis) : null, guidance: w.guidance ? publicWindow(w.guidance) : null,
  attention: w.attention ? publicWindow(w.attention) : null, oldAnalysis: w.oldAnalysis ? publicWindow(w.oldAnalysis) : null,
  calibration: w.calibration ? publicWindow(w.calibration) : null,
});
const publicPendingAction = (p: CivilizationEnlightenerPendingAction | null) => p ? ({
  id: p.id, planned: p.planned, actual: p.actual, declaredAt: p.declaredAt, observedAt: p.observedAt,
  observationSeconds: p.observationSeconds, visibleIntent: p.visibleIntent, mechanical: p.mechanical,
}) : null;
const publicMaterials = (m: CivilizationEnlightenerMaterials) => ({
  weapon: { id: m.weapon.id, sourceId: m.weapon.sourceId, owner: m.weapon.owner, massKg: m.weapon.massKg, location: m.weapon.location, condition: m.weapon.condition },
  mechanism: { id: m.mechanism.id, owner: m.mechanism.owner, location: m.mechanism.location, charge: m.mechanism.charge, capacity: m.mechanism.capacity, visible: m.mechanism.visible },
});
const publicScene = (p: CivilizationEnlightenerScene) => ({
  siteId: p.siteId, playerLocation: p.playerLocation, playerCoordinate: p.playerCoordinate, enemyCoordinate: p.enemyCoordinate,
  ordinaryExit: p.ordinaryExit, thirdPartiesInArea: p.thirdPartiesInArea, presentMemberIds: [...p.presentMemberIds],
  observedSourceId: p.observedSourceId, observationWeek: p.observationWeek, clockSeconds: p.clockSeconds,
  externalSeconds: p.externalSeconds, playerTravelMetres: p.playerTravelMetres, knownPlayerName: p.knownPlayerName, knownEnemyName: p.knownEnemyName,
});
const publicCheck = (c: PublicCheckResult | null): PublicCheckResult | null => c ? ({
  ability: c.ability, baseAbility: c.baseAbility, modifiers: c.modifiers.map(m => ({ source: m.source, value: m.value })),
  effectiveAbility: c.effectiveAbility, difficulty: c.difficulty, chance: c.chance, roll: c.roll, tier: c.tier,
}) : null;
const publicPowerUses = (p: CivilizationEnlightenerCombatBody['powerUses']) => ({ MECHANICAL_PULSE: p.MECHANICAL_PULSE, MIND_PRESSURE: p.MIND_PRESSURE, WARD: p.WARD, ATTENTION: p.ATTENTION });
const publicWheel = (w: SliceWheelEntry) => ({ id: w.id, label: w.label, weight: w.weight });
export function projectCivilizationEnlightenerAction(a: CivilizationEnlightenerActionEvidence) { return {
  order: a.order, actor: a.actor, id: a.id, planned: a.planned, selectedAbility: a.selectedAbility, fallbackReason: a.fallbackReason, label: a.label,
  selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: a.mentalPressure, attackKind: a.attackKind,
  rawContribution: a.rawContribution, rawReduction: a.rawReduction, paidCost: a.paidCost, mindCost: a.mindCost, physicalFactor: a.physicalFactor, check: publicCheck(a.check),
  resistanceRoll: a.resistanceRoll, resistanceChance: a.resistanceChance, succeeded: a.succeeded, finiteResult: a.finiteResult,
  windowsBefore: publicWindows(a.windowsBefore), windowsAfter: publicWindows(a.windowsAfter),
  pendingBefore: publicPendingAction(a.pendingBefore), pendingAfter: publicPendingAction(a.pendingAfter), masteryApplied: [...a.masteryApplied], countered: [...a.countered],
  creationsBefore: a.creationsBefore.map(projectCivilizationEnlightenerOriginalCreation), creationsAfter: a.creationsAfter.map(projectCivilizationEnlightenerOriginalCreation),
  boxChargeSpent: a.boxChargeSpent, frameChargeSpent: a.frameChargeSpent, frameDurabilityDamage: a.frameDurabilityDamage, mechanismChargeSpent: a.mechanismChargeSpent,
  atSeconds: a.atSeconds, elapsedSeconds: a.elapsedSeconds, travelMetres: a.travelMetres,
  playerMindAfter: a.playerMindAfter, playerSpiritualityAfter: a.playerSpiritualityAfter, enemyMindAfter: a.enemyMindAfter, enemySpiritualityAfter: a.enemySpiritualityAfter,
}; }
export type CivilizationEnlightenerPublicActionEvidence = ReturnType<typeof projectCivilizationEnlightenerAction>;
export function projectCivilizationEnlightenerRoundOutcome(o: CivilizationEnlightenerRoundOutcome) { return {
  enemyHealth: o.enemyHealth, enemyMind: o.enemyMind, enemySpirituality: o.enemySpirituality, enemyStatus: o.enemyStatus,
  enemyInjuries: o.enemyInjuries.map(publicInjury), enemyRisk: o.enemyRisk, weaponLocation: o.weaponLocation, powerUses: publicPowerUses(o.powerUses),
  totalOwnerMindSpent: o.totalOwnerMindSpent, analysisAttempts: o.analysisAttempts, analysisSuccesses: o.analysisSuccesses, guidanceAttempts: o.guidanceAttempts, guidanceSuccesses: o.guidanceSuccesses,
  targetId: o.targetId, round: o.round, stance: o.stance, continuing: o.continuing,
  playerHealthAfter: o.playerHealthAfter, playerMindAfter: o.playerMindAfter, playerSpiritualityAfter: o.playerSpiritualityAfter,
  playerInjuriesAfter: o.playerInjuriesAfter.map(publicInjury), playerRiskAfter: o.playerRiskAfter, materialsAfter: publicMaterials(o.materialsAfter),
  creations: o.creations.map(projectCivilizationEnlightenerOriginalCreation),
  masteryAfter: Object.fromEntries([...CIVILIZATION_ENLIGHTENER_INHERITED_SKILL_IDS, ...CIVILIZATION_ENLIGHTENER_NEW_ABILITY_IDS].filter(id => Object.hasOwn(o.masteryAfter, id)).map(id => [id, o.masteryAfter[id]!])),
  rootAfter: publicScene(o.rootAfter), elapsedSeconds: o.elapsedSeconds,
  playerActions: o.playerActions.map(projectCivilizationEnlightenerAction), enemyActions: o.enemyActions.map(projectCivilizationEnlightenerAction), expiredWindows: o.expiredWindows.map(publicWindow),
  windowsAfter: publicWindows(o.windowsAfter), pendingEnemyActionAfter: o.pendingEnemyActionAfter,
}; }
export type CivilizationEnlightenerPublicRoundOutcome = ReturnType<typeof projectCivilizationEnlightenerRoundOutcome>;

export function projectCivilizationEnlightenerCombat(s:SliceState){const e=s.civilizationEnlightener.encounter,last=s.combat?.encounterId==='CIVILIZATION_ENLIGHTENER_DISPUTE'?s.combat.lastRound?.civilizationEnlightenerOutcome:e.terminal?s.combatHistory[e.terminal.historyIndex]?.civilizationEnlightenerOutcome:null;
 return {enemyName:'阿德里安·黑尔（44岁）',targetId:e.targetId,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,weaponLocation:e.weaponLocation,powerUses:publicPowerUses(e.powerUses),policy:e.policy,materials:publicMaterials(e.materials),creations:originalCreations(s).map(projectCivilizationEnlightenerOriginalCreation),lastActionSequence:last?[...last.playerActions,...last.enemyActions].sort((a,b)=>a.order-b.order).map(projectCivilizationEnlightenerAction):[],countWheel:CIVILIZATION_ENLIGHTENER_COUNT_WHEEL.map(publicWheel),enemyCountWheel:CIVILIZATION_ENLIGHTENER_ENEMY_COUNT_WHEEL.map(publicWheel),enemyAbilityWheel:CIVILIZATION_ENLIGHTENER_ENEMY_ABILITY_WHEEL.map(publicWheel),
 facts:['体30%、感30%、意25%、知15%；双方1至6动作10/15/25/25/15/10，基础1250、底125、上限120，仅继续轮恢复12。','工艺析解仅在真实观察后影响一项待执行机械动作；操作启示仅增强后来一次真实可用本人原动作。','每轮各一次，失败仍付成本；空窗口、过期与资源不足回退均不增长掌握。','原盒原架储能耐久保持同一份，缺能不能启动；没有可用原指令片，也没有补发。','实际身体攻击走共同伤势盘；精神压力只扣精神，精神耗尽活着停战，身体死亡终结本周目。']};}
