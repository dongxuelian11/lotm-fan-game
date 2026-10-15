import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import { CONCEALMENT_SERVANT_COUNT_WHEEL, concealmentServantActionCount } from '../concealment-servant/combat.js';
import type { SpiritWarlockCompanion } from '../spirit-warlock/types.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { MISFORTUNE_KNIGHT_TARGET_ID, MISFORTUNE_KNIGHT_SITE, MISFORTUNE_KNIGHT_POWER_IDS, MISFORTUNE_KNIGHT_POWERS,
  combatBody, initialMisfortuneKnightBody, hasMisfortuneKnightDisputeOpponent,
  validateMisfortuneKnightPreparation, validMisfortuneKnightMaterials, validMisfortuneKnightScene,
  type MisfortuneKnightCombatBody, type MisfortuneKnightEnemyIntent, type MisfortuneKnightPreparation,
  type MisfortuneKnightMaterials, type MisfortuneKnightScene, type MisfortuneKnightPolicy } from './encounter.js';

/** Bounded S1 encounter, explicitly retaining the actual Darkness S2 numeric profile. */
export const MISFORTUNE_KNIGHT_COUNT_WHEEL = CONCEALMENT_SERVANT_COUNT_WHEEL;
export const MISFORTUNE_KNIGHT_ENEMY_COUNT_WHEEL = CONCEALMENT_SERVANT_COUNT_WHEEL;
export const misfortuneKnightActionCount = concealmentServantActionCount;
export const misfortuneKnightEnemyActionCount = concealmentServantActionCount;
export const MISFORTUNE_KNIGHT_COMBAT_CONSTANTS={weights:{physique:.35,perception:.25,will:.25,knowledge:.15},tier:1250,floor:125,maxSpirituality:120,continuingRecovery:12,enemyPhysique:24,guidedMishapCost:6,guidedMishapMindCost:2,guidedMishapReduction:25,nightGuardCost:8,nightGuardMindCost:3,nightGuardReduction:30,windowSeconds:30} as const;
export const GUIDED_MISHAP='darkness.s1.guided-mishap', BOUNDED_NIGHT_GUARD='darkness.s1.bounded-night-guard';
export const MISFORTUNE_KNIGHT_NEW_ABILITY_IDS=[GUIDED_MISHAP,BOUNDED_NIGHT_GUARD] as const;
export const MISFORTUNE_KNIGHT_INHERITED_SKILL_IDS=['darkness.s9.night-vision','darkness.s9.night-vigor','darkness.s9.danger-sense','darkness.s8.poetry','darkness.s8.physical-training','darkness.s7.dream-entry','darkness.s7.dream-discernment','darkness.s6.spirit-sight','darkness.s6.spirit-pacification','darkness.s5.spirit-shelter','darkness.s5.spirit-assistance','darkness.s5.spirit-coordination','darkness.s4.limited-misfortune','darkness.s4.area-dream','darkness.s3.dark-dissolution','darkness.s3.sleep-fear','darkness.s2.bounded-concealment','darkness.s2.trace-veil'] as const;
export type MisfortuneKnightMoveId=typeof MISFORTUNE_KNIGHT_INHERITED_SKILL_IDS[number]|typeof MISFORTUNE_KNIGHT_NEW_ABILITY_IDS[number]|'STRIKE'|'BLOCK'|'EVADE'|'OBSERVE'|'ACCIDENT';
const DISSOLUTION='darkness.s3.dark-dissolution', SLEEP_FEAR='darkness.s3.sleep-fear', OLD_MISFORTUNE='darkness.s4.limited-misfortune', ASSISTANCE='darkness.s5.spirit-assistance';
export const MISFORTUNE_KNIGHT_ABILITIES:readonly{id:MisfortuneKnightMoveId;label:string;weight:number;stance:SliceStance|null}[]=[
 {id:'STRIKE',label:'本人普通打击',weight:12,stance:'ATTACK'},{id:'BLOCK',label:'普通防备',weight:5,stance:'DEFEND'},{id:'EVADE',label:'普通避让',weight:5,stance:'DEFEND'},{id:'OBSERVE',label:'普通侧步观察并让出清楚落点线',weight:4,stance:'PREPARE'},
 ...MISFORTUNE_KNIGHT_INHERITED_SKILL_IDS.map(id=>({id,label:({[DISSOLUTION]:'继承黑暗毁灭：6灵性、知识18',[SLEEP_FEAR]:'继承睡恐：5灵性、意志18，减势32',[OLD_MISFORTUNE]:'继承有限厄运：4灵性、意志16，减势22',[ASSISTANCE]:'同一原卷叶：先2灵性派出、后槽另2灵性协助'} as Record<string,string>)[id]??'原知识条件不在本场时普通回退，保留原掌握',weight:[DISSOLUTION,SLEEP_FEAR,OLD_MISFORTUNE,ASSISTANCE].includes(id)?7:1,stance:(id===DISSOLUTION?'ATTACK':id===ASSISTANCE?'DEFEND':'CONTROL') as SliceStance})),
 {id:GUIDED_MISHAP,label:'厄势导引：6灵性2精神、意志18，同一可见待执行身体冲击减25',weight:14,stance:'CONTROL'},
 {id:BOUNDED_NIGHT_GUARD,label:'隐夜护持：8灵性3精神、知识18，原板磨损10，同一身体冲击减30',weight:14,stance:'DEFEND'},
 {id:'ACCIDENT',label:'判断失衡：−22.5',weight:3,stance:null},
];
export const MISFORTUNE_KNIGHT_PLAYER_ABILITIES=MISFORTUNE_KNIGHT_ABILITIES;
export const MISFORTUNE_KNIGHT_ENEMY_ABILITY_WHEEL:readonly SliceWheelEntry[]=[
 {id:'DARK_BOLT',label:'可见暗色冲击：7灵性与1原杆储能、身体贡献105',weight:25},{id:'MIND_PRESSURE',label:'有限精神压力：7灵性、精神贡献70',weight:20},
 {id:'WARD',label:'有限护持：6灵性、减势60',weight:15},{id:'ATTENTION',label:'集中抵抗：3灵性，一次抵抗70%',weight:10},{id:'BLOCK_LINE',label:'把原杆横在可见落点线：4灵性',weight:10},
 {id:'BODY_STRIKE',label:'自有原杆普通打击20×身体',weight:15},{id:'OBSERVE',label:'普通观察',weight:3},{id:'ACCIDENT',label:'判断偏差−22.5',weight:2},
];
export const isMisfortuneKnight=(s:SliceState)=>s.progression.pathwayId==='darkness'&&s.progression.sequence===1;
const tickets=(stance:SliceStance|null)=>MISFORTUNE_KNIGHT_ABILITIES.map(a=>a.weight*(a.stance===stance&&stance!==null?5:4));
export function misfortuneKnightAbilityWheel(_s:SliceState,stance:SliceStance|null):SliceWheelEntry[]{const w=tickets(stance),total=w.reduce((n,v)=>n+v,0);return MISFORTUNE_KNIGHT_ABILITIES.map((a,i)=>({id:a.id,label:a.label,weight:w[i]!/total*100}));}
export function drawMisfortuneKnightAbility(rng:ActionRandomStream,_s:SliceState|null,stance:SliceStance|null):MisfortuneKnightMoveId{const w=tickets(stance);let n=rng.nextInt(1,w.reduce((a,b)=>a+b,0));for(const[i,a]of MISFORTUNE_KNIGHT_ABILITIES.entries()){n-=w[i]!;if(n<=0)return a.id;}throw new Error('行动盘无效。');}
export function drawMisfortuneKnightEnemyAbility(rng:ActionRandomStream):MisfortuneKnightEnemyIntent{let n=rng.nextInt(1,100);for(const a of MISFORTUNE_KNIGHT_ENEMY_ABILITY_WHEEL){n-=a.weight;if(n<=0)return a.id as MisfortuneKnightEnemyIntent;}throw new Error('对手行动盘无效。');}
const same=(a:unknown,b:unknown)=>a===b||(a!==undefined&&b!==undefined&&stableStringify(a)===stableStringify(b));
const integer=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER):n is number=>Number.isSafeInteger(n)&&(n as number)>=min&&(n as number)<=max;
const shape=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...keys].sort());
const physicalAt=(n:number)=>n>75?1:n>50?.95:n>25?.9:.8;
export interface MisfortuneKnightCombatSource {
 runId:string;revision:number;week:number;date:PublicGameDate;round:number;encounterId:'MISFORTUNE_KNIGHT_DISPUTE';targetId:typeof MISFORTUNE_KNIGHT_TARGET_ID;
 attemptWeek:number;startHistoryIndex:number;targetName:'奥尔登·沃德';targetAge:46;targetCore:24;actualBody:true;independentMind:true;playerBodyId:string;
 enemyWeapon:'MK1-ALDEN-ROD';weaponOwner:typeof MISFORTUNE_KNIGHT_TARGET_ID;ordinaryExit:'OPEN';pursuit:false;thirdPartiesInArea:0;policy:MisfortuneKnightPolicy;clubHeld:boolean;
 playerHealth:number;playerMind:number;playerSpirituality:number;playerInjuries:SliceInjury[];playerRisk:number;physique:number;perception:number;will:number;knowledge:number;mastery:Record<string,number>;
 preparation:MisfortuneKnightPreparation;root:MisfortuneKnightScene;materials:MisfortuneKnightMaterials;body:MisfortuneKnightCombatBody;companion:SpiritWarlockCompanion;spiritPromotionWeek:number|null;spiritCaseStatus:string;randomSeed:string;randomCursor:number;
}
export function currentMisfortuneKnightCombatSource(s:SliceState):MisfortuneKnightCombatSource|null {
 if(!hasMisfortuneKnightDisputeOpponent(s))return null;const e=s.misfortuneKnight.encounter,c=s.combat!;return{runId:s.runId,revision:s.revision,week:s.week,date:{...s.date},round:c.round,encounterId:'MISFORTUNE_KNIGHT_DISPUTE',targetId:MISFORTUNE_KNIGHT_TARGET_ID,attemptWeek:e.attemptWeek!,startHistoryIndex:e.startHistoryIndex!,targetName:'奥尔登·沃德',targetAge:46,targetCore:24,actualBody:true,independentMind:true,playerBodyId:`${s.runId}:body`,enemyWeapon:'MK1-ALDEN-ROD',weaponOwner:MISFORTUNE_KNIGHT_TARGET_ID,ordinaryExit:'OPEN',pursuit:false,thirdPartiesInArea:0,policy:e.policy,clubHeld:s.town.clubLocation==='HAND',playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,playerInjuries:structuredClone(s.injuries),playerRisk:s.injuryRisk,...s.character.coreStats,mastery:{...s.progression.mastery},preparation:structuredClone(e.preparation!),root:structuredClone(e.scene),materials:structuredClone(e.materials),body:combatBody(e),companion:structuredClone(s.spiritWarlock.companion),spiritPromotionWeek:s.spiritWarlock.promotionWeek,spiritCaseStatus:s.spiritWarlock.cases['listening-leaves']!.status,randomSeed:s.random.seed,randomCursor:s.random.cursor};
}
export interface MisfortuneKnightPendingAction {id:string;planned:MisfortuneKnightEnemyIntent;actual:MisfortuneKnightEnemyIntent;declaredAt:number;observedAt:number;observationSeconds:1;visibleIntent:string;bodyImpact:boolean}
export interface MisfortuneKnightWindow {id:string;kind:'NIGHT_GUARD'|'GUIDED_MISHAP'|'ATTENTION';createdAt:number;expiresAt:number;targetActionId:string|null;magnitude:number;plateId:string|null}
export interface MisfortuneKnightWindows {nightGuard:MisfortuneKnightWindow|null;guidedMishap:MisfortuneKnightWindow|null;attention:MisfortuneKnightWindow|null}
export interface MisfortuneKnightActionEvidence {
 order:number;actor:'PLAYER'|'ENEMY';id:string;planned:string;selectedAbility:string;fallbackReason:string|null;label:string;selfGain:number;enemyReduction:number;threatens:boolean;mentalPressure:boolean;attackKind:'NONE'|'BODY'|'MENTAL';rawContribution:number;rawReduction:number;
 paidCost:number;mindCost:number;physicalFactor:number;check:PublicCheckResult|null;resistanceRoll:number|null;resistanceChance:number|null;succeeded:boolean;
 finiteResult:'NONE'|'UNAVAILABLE'|'ALREADY_ATTEMPTED'|'INSUFFICIENT'|'FAILED'|'RESISTED'|'PENDING'|'APPLIED';windowsBefore:MisfortuneKnightWindows;windowsAfter:MisfortuneKnightWindows;pendingBefore:MisfortuneKnightPendingAction|null;pendingAfter:MisfortuneKnightPendingAction|null;masteryApplied:string[];countered:string[];
 spiritOperation:'NONE'|'DEPLOY'|'ASSIST';companionBefore:SpiritWarlockCompanion;companionAfter:SpiritWarlockCompanion;plateWear:number;plateId:string|null;rodChargeSpent:number;materialsBefore:MisfortuneKnightMaterials;materialsAfter:MisfortuneKnightMaterials;atSeconds:number;elapsedSeconds:4;travelMetres:number;travelPath:number[];randomCursorBefore:number;randomCursorAfter:number;playerMindAfter:number;playerSpiritualityAfter:number;enemyMindAfter:number;enemySpiritualityAfter:number;
}
export interface MisfortuneKnightRuntime {body:MisfortuneKnightCombatBody;root:MisfortuneKnightScene;materials:MisfortuneKnightMaterials;companion:SpiritWarlockCompanion;playerH:number;playerM:number;playerS:number;mastery:Record<string,number>;windows:MisfortuneKnightWindows;expiredWindows:MisfortuneKnightWindow[];pendingEnemyAction:MisfortuneKnightPendingAction|null;nightGuardAttempted:boolean;guidedMishapAttempted:boolean}
export function createMisfortuneKnightRuntime(x:MisfortuneKnightCombatSource):MisfortuneKnightRuntime{return{body:structuredClone(x.body),root:structuredClone(x.root),materials:structuredClone(x.materials),companion:structuredClone(x.companion),playerH:x.playerHealth,playerM:x.playerMind,playerS:x.playerSpirituality,mastery:{...x.mastery},windows:{nightGuard:null,guidedMishap:null,attention:null},expiredWindows:[],pendingEnemyAction:null,nightGuardAttempted:false,guidedMishapAttempted:false};}
const actualBodyLine=(r:MisfortuneKnightRuntime)=>r.root.playerLocation==='YARD'&&r.root.playerCoordinate===4&&r.root.visibleBodyLine;
const actualGuidanceLine=(r:MisfortuneKnightRuntime)=>actualBodyLine(r)&&r.root.floorLineClear;
export function advanceMisfortuneKnightCombatClock(r:MisfortuneKnightRuntime,seconds:number):void {
 if(!integer(seconds))throw new Error('实际时间无效。');r.root.clockSeconds+=seconds;r.root.externalSeconds+=seconds;
 for(const key of ['nightGuard','guidedMishap','attention'] as const){const w=r.windows[key];if(w&&(w.expiresAt<=r.root.clockSeconds||key==='nightGuard'&&!actualBodyLine(r)||key==='guidedMishap'&&!actualGuidanceLine(r))){r.expiredWindows.push(structuredClone(w));r.windows[key]=null;}}
}
export function declareMisfortuneKnightEnemyAction(x:MisfortuneKnightCombatSource,r:MisfortuneKnightRuntime,planned:MisfortuneKnightEnemyIntent,index:number):MisfortuneKnightPendingAction {
 if(r.pendingEnemyAction||!MISFORTUNE_KNIGHT_ENEMY_ABILITY_WHEEL.some(a=>a.id===planned)||r.body.enemyMind<=0)throw new Error('不能覆盖待执行动作或替已停战者行动。');const power=MISFORTUNE_KNIGHT_POWERS.find(p=>p.id===planned);
 const actual=power&&(r.body.enemySpirituality<power.cost||planned==='DARK_BOLT'&&r.materials.weapon.charge===0)?'BODY_STRIKE':planned==='ATTENTION'&&r.windows.attention||planned==='BLOCK_LINE'&&!r.root.floorLineClear?'OBSERVE':planned;
 const at=r.root.clockSeconds;advanceMisfortuneKnightCombatClock(r,1);r.pendingEnemyAction={id:`${x.runId}:MK1-PENDING:${x.round}:${index}`,planned,actual,declaredAt:at,observedAt:r.root.clockSeconds,observationSeconds:1,bodyImpact:actual==='DARK_BOLT'||actual==='BODY_STRIKE',visibleIntent:actual==='DARK_BOLT'?'眼前同一原杆亮起一格储能，朝当前两米位置蓄起一次可见冲击':actual==='BODY_STRIKE'?'握紧自己的原杆准备普通打击':actual==='MIND_PRESSURE'?'集中精神准备一次有限压力':actual==='BLOCK_LINE'?'把自己的原杆横向移到眼前落点线':actual==='WARD'?'抬手准备有限护持':actual==='ATTENTION'?'收束注意准备抵抗':'眼前普通观察或判断偏差'};return structuredClone(r.pendingEnemyAction);
}
function baseAction(r:MisfortuneKnightRuntime,actor:'PLAYER'|'ENEMY',id:string,order:number,rng:ActionRandomStream):MisfortuneKnightActionEvidence{return{order,actor,id,planned:id,selectedAbility:id,fallbackReason:null,label:'',selfGain:0,enemyReduction:0,threatens:false,mentalPressure:false,attackKind:'NONE',rawContribution:0,rawReduction:0,paidCost:0,mindCost:0,physicalFactor:physicalAt(actor==='PLAYER'?r.playerH:r.body.enemyHealth),check:null,resistanceRoll:null,resistanceChance:null,succeeded:false,finiteResult:'NONE',windowsBefore:structuredClone(r.windows),windowsAfter:structuredClone(r.windows),pendingBefore:structuredClone(r.pendingEnemyAction),pendingAfter:null,masteryApplied:[],countered:[],spiritOperation:'NONE',companionBefore:structuredClone(r.companion),companionAfter:structuredClone(r.companion),plateWear:0,plateId:null,rodChargeSpent:0,materialsBefore:structuredClone(r.materials),materialsAfter:structuredClone(r.materials),atSeconds:r.root.clockSeconds,elapsedSeconds:4,travelMetres:0,travelPath:[actor==='PLAYER'?r.root.playerCoordinate:r.root.enemyCoordinate],randomCursorBefore:rng.cursor,randomCursorAfter:rng.cursor,playerMindAfter:r.playerM,playerSpiritualityAfter:r.playerS,enemyMindAfter:r.body.enemyMind,enemySpiritualityAfter:r.body.enemySpirituality};}
function closeAction(a:MisfortuneKnightActionEvidence,r:MisfortuneKnightRuntime,rng:ActionRandomStream){advanceMisfortuneKnightCombatClock(r,4);a.windowsAfter=structuredClone(r.windows);a.pendingAfter=structuredClone(r.pendingEnemyAction);a.materialsAfter=structuredClone(r.materials);a.companionAfter=structuredClone(r.companion);a.randomCursorAfter=rng.cursor;a.playerMindAfter=r.playerM;a.playerSpiritualityAfter=r.playerS;a.enemyMindAfter=r.body.enemyMind;a.enemySpiritualityAfter=r.body.enemySpirituality;a.threatens=a.attackKind==='BODY'&&a.selfGain>0;a.mentalPressure=a.attackKind==='MENTAL'&&a.selfGain>0;a.label+=` 实际4秒，本人灵性${r.playerS}、精神${r.playerM}，对手灵性${r.body.enemySpirituality}。`;return a;}
function ordinary(x:MisfortuneKnightCombatSource,r:MisfortuneKnightRuntime,a:MisfortuneKnightActionEvidence,why:string,attack=false){a.selectedAbility=attack?'STRIKE':'BLOCK';a.fallbackReason=why||null;a.label=why+(attack?'本人用原身体普通打击。':'本人普通防备。');if(attack){a.selfGain=(x.clubHeld?16:12)*a.physicalFactor;a.attackKind='BODY';a.travelMetres=4;a.travelPath=[4,6,4];r.root.playerTravelMetres+=4;a.label+='本人实际上前两米、打击后沿原路退回两米。';}else a.enemyReduction=10;}
function pay(r:MisfortuneKnightRuntime,a:MisfortuneKnightActionEvidence,s:number,m=0){if(r.playerS<s||r.playerM<=m)return false;r.playerS-=s;r.playerM-=m;r.body.totalOwnerMindSpent+=m;a.paidCost=s;a.mindCost=m;return true;}
function check(x:MisfortuneKnightCombatSource,a:MisfortuneKnightActionEvidence,ability:'will'|'knowledge',difficulty:number,rng:ActionRandomStream){a.check=resolveNormalCheck({ability,baseAbility:x[ability],difficulty,modifiers:[],roll:rng.nextInt(1,100)});a.succeeded=['SUCCESS','GREAT_SUCCESS'].includes(a.check.tier);a.label+=`${ability==='will'?'意志':'知识'}检定${a.check.roll}，${a.succeeded?'成功':'失败'}。`;return a.succeeded;}
function resist(r:MisfortuneKnightRuntime,a:MisfortuneKnightActionEvidence,rng:ActionRandomStream){const attention=r.windows.attention;a.resistanceChance=attention?70:30;a.resistanceRoll=rng.nextInt(1,100);if(attention){a.countered.push(attention.id);r.windows.attention=null;}if(a.resistanceRoll<=a.resistanceChance){a.succeeded=false;a.finiteResult='RESISTED';a.label+=`抵抗${a.resistanceRoll}≤${a.resistanceChance}，实际成本保留。`;return false;}a.label+=`抵抗${a.resistanceRoll}>${a.resistanceChance}。`;return true;}
function gainMastery(r:MisfortuneKnightRuntime,a:MisfortuneKnightActionEvidence,id:string){r.mastery[id]=Math.min(500,(r.mastery[id]??0)+8);a.masteryApplied.push(id);}
function window(r:MisfortuneKnightRuntime,kind:MisfortuneKnightWindow['kind'],order:number,magnitude:number,target:string|null=null,plateId:string|null=null):MisfortuneKnightWindow{return{id:`MK1-${kind}-${r.root.clockSeconds}-${order}`,kind,createdAt:r.root.clockSeconds,expiresAt:r.root.clockSeconds+30,targetActionId:target,magnitude,plateId};}
/** Same original eligibility and 2S deployment / later 2S assistance as S2. */
export function misfortuneKnightOwnsOriginalSpirit(x:MisfortuneKnightCombatSource,c:SpiritWarlockCompanion):boolean {
 return validMisfortuneKnightCompanion(c,x.week)&&c.source==='SW5-LEAF-1'&&x.spiritPromotionWeek!==null&&c.acquiredWeek!==null&&c.acquiredWeek>=x.spiritPromotionWeek&&c.invitedWeek!==null&&c.invitedWeek>=c.acquiredWeek&&x.spiritCaseStatus!=='AVAILABLE'&&(c.status==='SEALED'||c.status==='DEPLOYED');
}
export function resolveMisfortuneKnightPlayerSlot(x:MisfortuneKnightCombatSource,r:MisfortuneKnightRuntime,id:MisfortuneKnightMoveId,order:number,rng:ActionRandomStream):MisfortuneKnightActionEvidence {
 if(!MISFORTUNE_KNIGHT_ABILITIES.some(a=>a.id===id))throw new Error('未知本人动作。');const a=baseAction(r,'PLAYER',id,order,rng);
 if(x.policy==='ORDINARY'&&id.startsWith('darkness.'))ordinary(x,r,a,'预先选择只作普通行动；');
 else if(id===GUIDED_MISHAP||id===BOUNDED_NIGHT_GUARD){
  const guard=id===BOUNDED_NIGHT_GUARD,allowed=x.policy==='ALL'||x.policy===(guard?'BOUNDED_NIGHT_GUARD':'GUIDED_MISHAP'),attempted=guard?r.nightGuardAttempted:r.guidedMishapAttempted,p=r.pendingEnemyAction,plate=r.materials.plate;
  if(!allowed){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'预先策略未允许这项新能力；');}
  else if(attempted){a.finiteResult='ALREADY_ATTEMPTED';a.label='本轮已经实际尝试，不重骰、不延长窗口。';}
  else if(!p||!p.bodyImpact||p.observedAt>r.root.clockSeconds||!actualBodyLine(r)||!guard&&!r.root.floorLineClear||guard&&(!plate||plate.location!=='PLAYER'||plate.integrity<10)){a.finiteResult='UNAVAILABLE';ordinary(x,r,a,'缺少已观察的同一待执行身体冲击、实际清楚落点线或可用原木板；');}
  else if(!pay(r,a,guard?8:6,guard?3:2)){a.finiteResult='INSUFFICIENT';a.label='灵性或精神不足，未施放，不重抽。';}
  else{
   if(guard){r.nightGuardAttempted=true;r.body.nightGuardAttempts++;plate!.integrity-=10;a.plateId=plate!.id;a.plateWear=10;}
   else{r.guidedMishapAttempted=true;r.body.guidedMishapAttempts++;}
   a.label=guard?'本人抬起同一实际木板护持，原板磨损10；只等待眼前一次身体冲击。':'沿实际空出的落点线导引眼前已观察的一次待执行身体冲击。';
   if(!check(x,a,guard?'knowledge':'will',18,rng))a.finiteResult='FAILED';
   else if(guard||resist(r,a,rng)){if(guard)r.windows.nightGuard=window(r,'NIGHT_GUARD',order,30,p.id,plate!.id);else r.windows.guidedMishap=window(r,'GUIDED_MISHAP',order,25,p.id);a.finiteResult='PENDING';a.label+='窗口最多30秒，尚无实际效果或掌握奖励。';}
  }
 }else if(id==='STRIKE')ordinary(x,r,a,'',true);
 else if(id==='BLOCK'||id==='EVADE'){a.enemyReduction=10;a.succeeded=true;a.label='本人用原身体普通防备，有限减势10，不免伤。';}
 else if(id==='OBSERVE'){a.label='亲自观察眼前原人原物。';if(!r.root.floorLineClear||!r.root.visibleBodyLine){r.root.floorLineClear=true;r.root.visibleBodyLine=true;r.root.playerTravelMetres+=2;a.travelMetres=2;a.label+='实际侧步两米绕开原杆横挡的落点线；原出口和距敌两米的位置仍然可达。';}}
 else if(id==='ACCIDENT'){a.selfGain=-22.5;a.label='判断失衡，固定−22.5，不重抽。';}
 else if(id===DISSOLUTION){if(!pay(r,a,6))ordinary(x,r,a,'不足6灵性，继承黑暗毁灭未施放；',true);else if(check(x,a,'knowledge',18,rng)){a.selfGain=65*(.65+.35*(x.mastery[id]??0)/500);a.attackKind='BODY';a.label+='继承黑暗毁灭产生当前有限身体攻击，实际伤势仍走共同盘。';}}
 else if(id===SLEEP_FEAR||id===OLD_MISFORTUNE){const sleep=id===SLEEP_FEAR;if(!pay(r,a,sleep?5:4))ordinary(x,r,a,'旧能力灵性不足；');else if(check(x,a,'will',sleep?18:16,rng)){a.enemyReduction=sleep?32:22;a.label+=sleep?'继承睡恐只在本轮减势32，不强迫投降或改心。':'继承有限厄运只在本轮减势22，不改变已经发生的事件。';}}
 else if(id===ASSISTANCE){
  if(!misfortuneKnightOwnsOriginalSpirit(x,r.companion)||r.playerS<2)ordinary(x,r,a,'没有实际取得并封存或派出的同一原卷叶，或不足2灵性；');
  else if(r.companion.status==='SEALED'){pay(r,a,2);r.companion.status='DEPLOYED';r.companion.deployments++;r.body.spiritDeployments++;a.spiritOperation='DEPLOY';a.succeeded=true;a.label='同一SW5-LEAF-1从原牙齿实际派出，灵性−2、派出计数+1；本槽无贡献，没有新增行动者。';}
  else{pay(r,a,2);r.body.spiritAssists++;a.spiritOperation='ASSIST';a.enemyReduction=22;a.succeeded=true;a.label='已经派出的同一SW5-LEAF-1在后续原槽另付2灵性协助，有限减势22。';}
 }else{a.selectedAbility='OBSERVE';a.fallbackReason=id.startsWith('darkness.s2.')?'本场没有原六米隐秘房间或同一弱标记，不能把净空石院冒充旧来源':'旧梦境、原安抚对象和其他知识的实际适用条件不在场';a.label=a.fallbackReason+'；保留原掌握，本槽普通观察，不造物、不免费恢复。';}
 a.rawContribution=a.selfGain;a.rawReduction=a.enemyReduction;return closeAction(a,r,rng);
}
export function resolveMisfortuneKnightEnemySlot(x:MisfortuneKnightCombatSource,r:MisfortuneKnightRuntime,planned:MisfortuneKnightEnemyIntent,order:number,rng:ActionRandomStream):MisfortuneKnightActionEvidence {
 if(!r.pendingEnemyAction)declareMisfortuneKnightEnemyAction(x,r,planned,order);const p=r.pendingEnemyAction!;if(p.planned!==planned)throw new Error('不能替换已观察的待执行动作。');const a=baseAction(r,'ENEMY',p.actual,order,rng);a.planned=planned;a.selectedAbility=p.actual;const power=MISFORTUNE_KNIGHT_POWERS.find(v=>v.id===p.actual);
 if(power){if(r.body.enemySpirituality<power.cost)throw new Error('已声明对手资源不一致。');r.body.enemySpirituality-=power.cost;r.body.powerUses[power.id]++;a.paidCost=power.cost;a.selfGain=power.selfGain;a.enemyReduction=power.enemyReduction;a.succeeded=true;
  if(power.id==='DARK_BOLT'){if(r.materials.weapon.charge<1)throw new Error('同一原杆已无储能。');r.materials.weapon.charge--;a.rodChargeSpent=1;a.attackKind='BODY';}
  if(power.id==='MIND_PRESSURE')a.attackKind='MENTAL';if(power.id==='ATTENTION')r.windows.attention=window(r,'ATTENTION',order,70);
  if(power.id==='BLOCK_LINE'){r.root.floorLineClear=false;r.root.visibleBodyLine=false;for(const key of ['nightGuard','guidedMishap'] as const){if(r.windows[key]){a.countered.push(r.windows[key]!.id);r.expiredWindows.push(structuredClone(r.windows[key]!));r.windows[key]=null;}}}
  a.label=`奥尔登实际施放${power.label}，独立灵性−${power.cost}。`;
 }else if(p.actual==='BODY_STRIKE'){a.selfGain=20*a.physicalFactor;a.attackKind='BODY';a.travelMetres=4;a.travelPath=[6,4,6];a.label='奥尔登用自己的唯一原杆上前两米普通打击，再沿原路退回两米；储能或灵性不足时不施法、不重抽。';}
 else if(p.actual==='ACCIDENT'){a.selfGain=-22.5;a.label='对手判断偏差，−22.5，不重抽。';}else a.label='对手普通观察，没有额外资源。';
 a.rawContribution=a.selfGain;a.rawReduction=a.enemyReduction;
 for(const key of ['guidedMishap','nightGuard'] as const){const w=r.windows[key];if(w&&w.targetActionId===p.id){r.windows[key]=null;a.countered.push(w.id);const guard=key==='nightGuard',line=guard?actualBodyLine(r):actualGuidanceLine(r),reduction=w.expiresAt>a.atSeconds&&p.bodyImpact&&line?Math.min(w.magnitude,Math.max(0,a.selfGain)):0;
  a.selfGain-=reduction;if(reduction>0){if(guard)r.body.nightGuardSuccesses++;else r.body.guidedMishapSuccesses++;gainMastery(r,a,guard?BOUNDED_NIGHT_GUARD:GUIDED_MISHAP);a.finiteResult='APPLIED';a.label+=`先前实付${guard?'隐夜护持':'厄势导引'}只使同一可见待执行身体冲击减少${reduction}；不影响后续攻击或精神压力。`;}}
 }
 r.pendingEnemyAction=null;return closeAction(a,r,rng);
}
export interface MisfortuneKnightRoundOutcome extends MisfortuneKnightCombatBody {
 spiritRecall:{sourceId:'SW5-LEAF-1';atSeconds:number;elapsedSeconds:1;before:SpiritWarlockCompanion;after:SpiritWarlockCompanion}|null;targetId:typeof MISFORTUNE_KNIGHT_TARGET_ID;round:number;source:MisfortuneKnightCombatSource;stance:SliceStance;continuing:boolean;playerHealthAfter:number;playerMindAfter:number;playerSpiritualityAfter:number;playerInjuriesAfter:SliceInjury[];playerRiskAfter:number;materialsAfter:MisfortuneKnightMaterials;companion:SpiritWarlockCompanion;masteryAfter:Record<string,number>;rootAfter:MisfortuneKnightScene;elapsedSeconds:60;randomCursorAfter:number;playerActions:MisfortuneKnightActionEvidence[];enemyActions:MisfortuneKnightActionEvidence[];expiredWindows:MisfortuneKnightWindow[];windowsAfter:MisfortuneKnightWindows;pendingEnemyActionAfter:null;
}
export type MisfortuneKnightResolution='CONTINUE'|'PLAYER_DEAD'|'ENEMY_DEAD'|'ENEMY_SURRENDERED'|'RETREATED';
function penalty(n:number,max:number){const f=n/max;return f>.75?0:f>.5?.05:f>.25?.1:.2;}
function base(core:number,h:number,m:number,s:number){return(1250+Math.min(core,250))*(1-Math.min(.4,penalty(h,100)+penalty(m,100)+penalty(s,120)));}
function weights(risk:number){const death=Math.min(100,5+Math.min(risk,10)*10),shifted=death-5;return{light:Math.max(0,65-shifted),heavy:Math.max(0,30-Math.max(0,shifted-65)),death};}
export function validMisfortuneKnightBody(b:MisfortuneKnightCombatBody):boolean{return integer(b.enemyHealth,0,100)&&integer(b.enemyMind,0,100)&&integer(b.enemySpirituality,0,120)&&integer(b.enemyRisk)&&Array.isArray(b.enemyInjuries)&&['RESISTING','SURRENDERED','DEAD'].includes(b.enemyStatus)&&(b.enemyStatus==='DEAD')===(b.enemyHealth===0)&&(b.enemyMind>0||b.enemyStatus!=='RESISTING')&&['HAND','YARD'].includes(b.weaponLocation)&&(b.enemyStatus==='RESISTING'||b.weaponLocation==='YARD')&&shape(b.powerUses,MISFORTUNE_KNIGHT_POWER_IDS)&&MISFORTUNE_KNIGHT_POWER_IDS.every(id=>integer(b.powerUses[id]))&&b.enemySpirituality===120-MISFORTUNE_KNIGHT_POWERS.reduce((n,p)=>n+p.cost*b.powerUses[p.id],0)&&b.powerUses.DARK_BOLT<=4&&integer(b.totalOwnerMindSpent)&&integer(b.nightGuardAttempts,0,6)&&integer(b.guidedMishapAttempts)&&integer(b.nightGuardSuccesses,0,b.nightGuardAttempts)&&integer(b.guidedMishapSuccesses,0,b.guidedMishapAttempts)&&b.totalOwnerMindSpent===3*b.nightGuardAttempts+2*b.guidedMishapAttempts&&integer(b.spiritDeployments)&&integer(b.spiritAssists)&&b.spiritRecalls===b.spiritDeployments;}
export function validMisfortuneKnightInjuries(injuries:SliceInjury[],revision:number):boolean{return Array.isArray(injuries)&&new Set(injuries.map(i=>i.id)).size===injuries.length&&injuries.every(i=>shape(i,['id','severity','acquiredRevision','treatedRevision'])&&typeof i.id==='string'&&!!i.id&&['LIGHT','HEAVY'].includes(i.severity)&&integer(i.acquiredRevision,0,revision)&&(i.treatedRevision===null||integer(i.treatedRevision,i.acquiredRevision,revision)));}
export function validMisfortuneKnightCompanion(p:SpiritWarlockCompanion,week:number):boolean {
 return shape(p,['source','status','acquiredWeek','invitedWeek','releases','deployments','recalls'])&&p.source==='SW5-LEAF-1'&&['UNMET','AVAILABLE','SEALED','DEPLOYED','RELEASED'].includes(p.status)&&[p.acquiredWeek,p.invitedWeek].every(w=>w===null||integer(w,1,week))&&integer(p.releases)&&integer(p.deployments)&&integer(p.recalls)&&p.deployments-p.recalls===(p.status==='DEPLOYED'?1:0);
}
const SOURCE_KEYS=['runId','revision','week','date','round','encounterId','targetId','attemptWeek','startHistoryIndex','targetName','targetAge','targetCore','actualBody','independentMind','playerBodyId','enemyWeapon','weaponOwner','ordinaryExit','pursuit','thirdPartiesInArea','policy','clubHeld','playerHealth','playerMind','playerSpirituality','playerInjuries','playerRisk','physique','perception','will','knowledge','mastery','preparation','root','materials','body','companion','spiritPromotionWeek','spiritCaseStatus','randomSeed','randomCursor'];
export function validMisfortuneKnightCombatSource(x:MisfortuneKnightCombatSource):boolean {
 try{const p=x.root,prep=x.preparation,plate=x.materials.plate,originalPlate=prep.materialsAfter.plate,c=x.companion,original=prep.companion;
 return shape(x,SOURCE_KEYS)&&shape(x.body,Object.keys(initialMisfortuneKnightBody()))&&validateMisfortuneKnightPreparation(prep)&&typeof x.runId==='string'&&!!x.runId&&integer(x.revision)&&x.week===prep.week&&isValidGameDate(x.date)&&same(x.date,prep.date)&&integer(x.round,1)&&integer(x.startHistoryIndex)&&x.attemptWeek===x.week&&x.encounterId==='MISFORTUNE_KNIGHT_DISPUTE'&&x.targetId===MISFORTUNE_KNIGHT_TARGET_ID&&x.targetName==='奥尔登·沃德'&&x.targetAge===46&&x.targetCore===24&&x.actualBody===true&&x.independentMind===true&&x.playerBodyId===`${x.runId}:body`&&x.enemyWeapon==='MK1-ALDEN-ROD'&&x.weaponOwner===MISFORTUNE_KNIGHT_TARGET_ID&&x.ordinaryExit==='OPEN'&&x.pursuit===false&&x.thirdPartiesInArea===0&&['INHERITED_ONLY','GUIDED_MISHAP','BOUNDED_NIGHT_GUARD','ALL','ORDINARY'].includes(x.policy)&&x.clubHeld===prep.playerClubHeld&&
 [x.playerHealth,x.playerMind].every(n=>integer(n,1,100))&&integer(x.playerSpirituality,0,120)&&[x.physique,x.perception,x.will,x.knowledge].every(n=>integer(n,0,500))&&same({physique:x.physique,perception:x.perception,will:x.will,knowledge:x.knowledge},prep.after.coreStats)&&shape(x.mastery,[...MISFORTUNE_KNIGHT_INHERITED_SKILL_IDS,...MISFORTUNE_KNIGHT_NEW_ABILITY_IDS])&&same(Object.keys(x.mastery).sort(),Object.keys(prep.after.mastery).sort())&&Object.values(x.mastery).every(n=>integer(n,0,500))&&Object.entries(prep.after.mastery).every(([id,v])=>(MISFORTUNE_KNIGHT_NEW_ABILITY_IDS as readonly string[]).includes(id)?x.mastery[id]!>=v:x.mastery[id]===v)&&
 integer(x.playerRisk)&&validMisfortuneKnightInjuries(x.playerInjuries,x.revision)&&validMisfortuneKnightInjuries(x.body.enemyInjuries,x.revision)&&validMisfortuneKnightMaterials(x.materials)&&x.materials.weapon.location===x.body.weaponLocation&&x.materials.weapon.charge===4-x.body.powerUses.DARK_BOLT&&
 (originalPlate===null?plate===null&&x.body.nightGuardAttempts===0:!!plate&&same({...plate,integrity:originalPlate.integrity},originalPlate)&&plate.integrity===65-10*x.body.nightGuardAttempts)&&x.body.guidedMishapAttempts<=x.round-1&&x.body.nightGuardAttempts<=x.round-1&&
 validMisfortuneKnightScene(p)&&p.siteId===MISFORTUNE_KNIGHT_SITE&&p.playerLocation==='YARD'&&p.observedSourceId===`${x.runId}:MK1-YARD:${prep.revision}`&&p.observationWeek===prep.week&&p.knownPlayerName===prep.playerName&&p.knownEnemyName==='奥尔登·沃德'&&p.clockSeconds===4+60*(x.round-1)&&validMisfortuneKnightBody(x.body)&&x.body.enemyStatus==='RESISTING'&&x.body.enemyMind>0&&typeof x.randomSeed==='string'&&!!x.randomSeed&&integer(x.randomCursor)&&prep.runId===x.runId&&prep.randomSeed===x.randomSeed&&prep.randomCursor<=x.randomCursor&&prep.revision<=x.revision-x.round&&
 validMisfortuneKnightCompanion(c,x.week)&&c.status!=='DEPLOYED'&&x.spiritPromotionWeek===prep.spiritPromotionWeek&&x.spiritCaseStatus===prep.spiritCaseStatus&&same({...c,deployments:original.deployments,recalls:original.recalls},original)&&c.deployments===original.deployments+x.body.spiritDeployments&&c.recalls===original.recalls+x.body.spiritRecalls;
 }catch{return false;}
}
export const validateMisfortuneKnightCombatSource=validMisfortuneKnightCombatSource;
export function replayMisfortuneKnightCombatRound(x: MisfortuneKnightCombatSource, stance: SliceStance): { round: SliceCombatRound; outcome: MisfortuneKnightResolution } {
  if (!validMisfortuneKnightCombatSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new Error('缺少真实原来源。');
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = createMisfortuneKnightRuntime(x), b = r.body;
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = misfortuneKnightActionCount(playerCountRoll), enemyCount = misfortuneKnightEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: MisfortuneKnightActionEvidence[] = [], enemies: MisfortuneKnightActionEvidence[] = [], remaining = { PLAYER: playerCount, ENEMY: enemyCount }; let retreat: SliceCombatRound['retreat'] = 'NONE';
  if (b.enemyMind === 0) remaining.PLAYER = remaining.ENEMY = 0;
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) for (const actor of order) {
    if (!remaining[actor]) continue;
    if (actor === 'PLAYER' && stance === 'RETREAT') { remaining.PLAYER = 0; retreat = rng.nextInt(1, 100) <= 50 ? 'SUCCESS' : 'FAILURE'; if (retreat === 'SUCCESS') { remaining.ENEMY = 0; break; } continue; }
    if (remaining.ENEMY > 0 && !r.pendingEnemyAction) declareMisfortuneKnightEnemyAction(x, r, drawMisfortuneKnightEnemyAbility(rng), enemies.length);
    remaining[actor]--; const index = players.length + enemies.length;
    if (actor === 'PLAYER') players.push(resolveMisfortuneKnightPlayerSlot(x, r, drawMisfortuneKnightAbility(rng, null, stance), index, rng));
    else enemies.push(resolveMisfortuneKnightEnemySlot(x, r, r.pendingEnemyAction!.planned, index, rng));
    if (b.enemyMind === 0) { b.enemyStatus = 'SURRENDERED'; remaining.PLAYER = remaining.ENEMY = 0; break; }
  }
  let spiritRecall:MisfortuneKnightRoundOutcome['spiritRecall']=null;
  if(r.companion.status==='DEPLOYED'&&misfortuneKnightOwnsOriginalSpirit(x,r.companion)){const before=structuredClone(r.companion),atSeconds=r.root.clockSeconds;r.companion.status='SEALED';r.companion.recalls++;b.spiritRecalls++;advanceMisfortuneKnightCombatClock(r,1);spiritRecall={sourceId:'SW5-LEAF-1',atSeconds,elapsedSeconds:1,before,after:structuredClone(r.companion)};}
  const sum = (a: MisfortuneKnightActionEvidence[], key: 'selfGain' | 'enemyReduction') => a.reduce((n, v) => n + v[key], 0);
  const core = x.physique * .35 + x.perception * .25 + x.will * .25 + x.knowledge * .15;
  const playerAdvantage = Math.max(125, base(core, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, base(x.targetCore, x.body.enemyHealth, x.body.enemyMind, x.body.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction'));
  const winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100, winner = retreat === 'SUCCESS' ? 'ENEMY' : b.enemyMind === 0 ? 'PLAYER' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  let playerHealth = r.playerH, playerRisk = x.playerRisk, outcome: MisfortuneKnightResolution = retreat === 'SUCCESS' ? 'RETREATED' : b.enemyMind === 0 ? 'ENEMY_SURRENDERED' : 'CONTINUE';
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
  advanceMisfortuneKnightCombatClock(r, x.root.clockSeconds + 60 - r.root.clockSeconds);
  for (const key of ['nightGuard','guidedMishap','attention'] as const) { if (r.windows[key]) r.expiredWindows.push(structuredClone(r.windows[key]!)); r.windows[key] = null; }
  r.pendingEnemyAction = null; if (b.enemyStatus !== 'RESISTING') r.materials.weapon.location = 'YARD'; b.weaponLocation = r.materials.weapon.location;
  const o: MisfortuneKnightRoundOutcome = { ...structuredClone(b), spiritRecall, targetId: MISFORTUNE_KNIGHT_TARGET_ID, round: x.round, source: structuredClone(x), stance, continuing: outcome === 'CONTINUE',
    playerHealthAfter: playerHealth, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, playerInjuriesAfter: playerInjuries, playerRiskAfter: playerRisk, materialsAfter: structuredClone(r.materials), companion: structuredClone(r.companion), masteryAfter: { ...r.mastery },
    rootAfter: structuredClone(r.root), elapsedSeconds: 60, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies, expiredWindows: r.expiredWindows,
    windowsAfter: structuredClone(r.windows), pendingEnemyActionAfter: null };
  const round: SliceCombatRound = { round: x.round, stance, first, playerCount, enemyCount, playerCountRoll, enemyCountRoll,
    moves: [...players, ...enemies].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })),
    playerAdvantage, enemyAdvantage, winChance, winner, consequence: '', consequenceWeights, retreat, ...(consequenceDomain === undefined ? {} : { consequenceDomain }), ...(consequenceRoll === undefined ? {} : { consequenceRoll }), misfortuneKnightOutcome: o };
  round.consequence = misfortuneKnightCombatConsequence(round); return { round, outcome };
}
export function validateMisfortuneKnightRoundOutcome(v: unknown): v is MisfortuneKnightRoundOutcome { try { const o = v as MisfortuneKnightRoundOutcome; return !!o && same(o, replayMisfortuneKnightCombatRound(o.source, o.stance).round.misfortuneKnightOutcome); } catch { return false; } }
export function validateMisfortuneKnightCombatRound(round: SliceCombatRound): boolean { try { const o = round.misfortuneKnightOutcome; return !!o && same(round, replayMisfortuneKnightCombatRound(o.source, o.stance).round); } catch { return false; } }
export function nextMisfortuneKnightCombatSource(o: MisfortuneKnightRoundOutcome): MisfortuneKnightCombatSource {
  return { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter,
    playerSpirituality: Math.min(120, o.playerSpiritualityAfter + 12), playerInjuries: structuredClone(o.playerInjuriesAfter), playerRisk: o.playerRiskAfter,
    root: structuredClone(o.rootAfter), body: combatBody(o), materials: structuredClone(o.materialsAfter), companion: structuredClone(o.companion), mastery: { ...o.masteryAfter }, randomCursor: o.randomCursorAfter };
}
export function misfortuneKnightCombatConsequence(round: SliceCombatRound): string {
  const o = round.misfortuneKnightOutcome!, who = round.winner === 'PLAYER' ? '奥尔登' : '你';
  let text = round.retreat === 'SUCCESS' ? '撤离判定成功，将沿普通4米出口实际离开。' : round.consequenceDomain === 'MENTAL' ? `${who}承受实际精神压力，精神减少10，没有新增身体伤口或身体风险。` : round.consequenceDomain === 'BODY' ? `${who}承受实际物理攻击，按共同伤势盘结算，实掷${round.consequenceRoll}/100（轻${round.consequenceWeights!.light}/重${round.consequenceWeights!.heavy}/死亡${round.consequenceWeights!.death}）。` : '本轮没有实际致伤来源，不掷身体伤势盘、不增加身体风险。';
  const attacks = round.winner === 'PLAYER' ? o.playerActions : o.enemyActions;
  if (round.consequenceDomain) text += ` 实际${round.consequenceDomain === 'BODY' ? '身体' : '精神'}来源：${attacks.filter(a => round.consequenceDomain === 'BODY' ? a.threatens : a.mentalPressure).map(a => a.selectedAbility).join('、')}。`;
  text += ` 本人健康${o.source.playerHealth}→${o.playerHealthAfter}、精神${o.source.playerMind}→${o.playerMindAfter}；奥尔登健康${o.source.body.enemyHealth}→${o.enemyHealth}、精神${o.source.body.enemyMind}→${o.enemyMind}。`;
  if (o.playerHealthAfter > 0 && o.playerMindAfter === 0) text += '本人精神耗尽，仍活着，停止抵抗后沿普通出口离开。';
  if (o.playerHealthAfter === 0) text += '本人的原身体真实死亡，本周目终结。'; else if (o.enemyHealth === 0) text += '奥尔登原身体真实死亡，唯一原杆留地。'; else if (o.enemyStatus === 'SURRENDERED') text += '奥尔登因实际伤势或精神耗尽自主停止抵抗，仍活着，原杆放在地面。';
  return text + ' 本轮实际60秒；未使用窗口到时结束，已经花费的灵性与精神不退。同一原件资源保留，艾琳、米洛与旧遭遇人物均不在场；同一原卷叶本轮派出后照常归回原牙齿，原账保留。';
}

export function projectMisfortuneKnightCombat(s:SliceState){const e=s.misfortuneKnight.encounter,last=s.combat?.encounterId==='MISFORTUNE_KNIGHT_DISPUTE'?s.combat.lastRound?.misfortuneKnightOutcome:e.terminal?s.combatHistory[e.terminal.historyIndex]?.misfortuneKnightOutcome:null;return{enemyName:'奥尔登·沃德（46岁）',targetId:e.targetId,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,weaponLocation:e.weaponLocation,powerUses:{...e.powerUses},policy:e.policy,materials:structuredClone(e.materials),companion:structuredClone(s.spiritWarlock.companion),lastActionSequence:last?[...last.playerActions,...last.enemyActions].sort((a,b)=>a.order-b.order):[],constants:MISFORTUNE_KNIGHT_COMBAT_CONSTANTS,countWheel:MISFORTUNE_KNIGHT_COUNT_WHEEL,enemyCountWheel:MISFORTUNE_KNIGHT_ENEMY_COUNT_WHEEL,abilityWheel:misfortuneKnightAbilityWheel(s,null),enemyAbilityWheel:MISFORTUNE_KNIGHT_ENEMY_ABILITY_WHEEL,facts:['体35%、感25%、意25%、知15%；双方1至6动作10/15/25/25/15/10，基础1250、底125、上限120，仅继续轮恢复12。','两项新能力只影响同一项已观察、尚未执行的身体冲击；精神压力单独结算。','每轮各一次，失败照付；空窗口不涨掌握，原木板磨损不恢复。','原卷叶先付2灵性派出，后槽另付2灵性协助；当轮召回同一原牙齿，计数照实增加。','身体攻击走共同伤势盘；精神耗尽活着停战，身体死亡终结本周目。']};}
