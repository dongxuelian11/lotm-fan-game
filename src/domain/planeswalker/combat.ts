import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { PLANESWALKER_TARGET, PLANESWALKER_POWER_IDS, PLANESWALKER_POWERS, hasPlaneswalkerDisputeOpponent,
  type PlaneswalkerTargetId, type PlaneswalkerEnemyIntent, type PlaneswalkerPowerId } from './encounter.js';
import { projectPlaneswalkerSite } from './life.js';
import { validatePlaneswalkerSiteState, advancePlaneswalkerTime, stopPlaneswalkerEffects, PLANESWALKER_POSITION_METRES, type PlaneswalkerSiteState } from './resources.js';

/** Bounded original game mechanics. The existing S3 core, resource budget and physical injury wheel are retained. */
export const PLANESWALKER_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const PLANESWALKER_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const planeswalkerActionCount = pyromaniacActionCount;
export const planeswalkerEnemyActionCount = pyromaniacActionCount;
const PATTERN = 'door.s2.pattern-reproduction', TRANSIT = 'door.s2.symbolic-transit';
const TRICKS = 'door.s8.tricks', TRAVEL = 'door.s5.travel';
export type PlaneswalkerMoveId = typeof PATTERN | typeof TRANSIT | typeof TRICKS | typeof TRAVEL | 'EVADE' | 'ACCIDENT';
const ABILITIES: readonly { id: PlaneswalkerMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: PATTERN, label: '光纹复现（7灵性/知识20，已知式样且门开时优势90）', weight: 25, stance: 'ATTACK' },
  { id: TRANSIT, label: '象征通行（6灵性/知识20，每轮一次尝试；本人实际移4米，准备抵一次身体攻击45）', weight: 20, stance: 'CONTROL' },
  { id: TRICKS, label: '继承小电击（6灵性/知识16，优势36×既有掌握，须线路开启）', weight: 20, stance: 'DEFEND' },
  { id: TRAVEL, label: '继承旅行避让（6灵性/感知16，减势22×既有掌握）', weight: 15, stance: 'CONTROL' },
  { id: 'EVADE', label: '普通避让（0灵性，减势10）', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断偏差（优势−22.5）', weight: 5, stance: null },
];
export const PLANESWALKER_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'VECTOR_STRIKE', label: '定点折光击：5灵性，线路开启时优势75', weight: 35 },
  { id: 'REFRACT_WARD', label: '折光屏护：4灵性，本轮一次抵下一成功光纹复现45', weight: 25 },
  { id: 'BODY_STRIKE', label: '持棍打击：20×身体状态', weight: 20 },
  { id: 'CLOSE_DOOR', label: '普通关门：0灵性，独占一次动作，没有攻击', weight: 15 },
  { id: 'ACCIDENT', label: '判断偏差：优势−22.5', weight: 5 },
];
export const isPlaneswalker = (s: SliceState): boolean => s.progression.pathwayId === 'door' && s.progression.sequence === 2;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function planeswalkerAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a,b) => a+b,0);
  return ABILITIES.map((a,i) => ({ id:a.id,label:a.label,weight:weights[i]!/total*100 }));
}
function drawPlayer(random: ActionRandomStream, stance: SliceStance | null): PlaneswalkerMoveId {
  const weights=tickets(stance);let n=random.nextInt(1,weights.reduce((a,b)=>a+b,0));
  for(const [i,a] of ABILITIES.entries()){n-=weights[i]!;if(n<=0)return a.id;}throw new Error('旅法师行动盘无效。');
}
export function drawPlaneswalkerAbility(random:ActionRandomStream,_s:SliceState,stance:SliceStance|null):PlaneswalkerMoveId{return drawPlayer(random,stance);}
export function drawPlaneswalkerEnemyAbility(random:ActionRandomStream):PlaneswalkerEnemyIntent {
  let n=random.nextInt(1,100);for(const a of PLANESWALKER_ENEMY_ABILITY_WHEEL){n-=a.weight;if(n<=0)return a.id as PlaneswalkerEnemyIntent;}throw new Error('当前对手的行动盘无效。');
}
export interface PlaneswalkerCombatSource {
  runId:string;revision:number;week:number;round:number;encounterId:'PLANESWALKER_DISPUTE';targetId:PlaneswalkerTargetId;
  attemptWeek:number;startHistoryIndex:number;targetName:string;targetAge:46;targetSequence:3;targetCore:24;actualContemporaryBody:true;independentMind:true;
  enemyWeapon:'PW2-SOREN-CLUB';weaponLocation:'HAND';enemyLocation:'FAR';enemyPositionMetres:6;distanceMetres:0|4;ordinaryExit:true;pursuit:false;
  thirdPartiesInArea:0;automaticAllyImmunity:false;site:PlaneswalkerSiteState;
  playerHealth:number;playerMind:number;playerSpirituality:number;enemyHealth:number;enemyMind:number;enemySpirituality:number;
  playerInjuries:SliceInjury[];enemyInjuries:SliceInjury[];playerRisk:number;enemyRisk:number;
  clubHeld:boolean;physique:number;perception:number;knowledge:number;will:number;travelMastery:number;tricksMastery:number;
  powerUses:Record<PlaneswalkerPowerId,number>;randomSeed:string;randomCursor:number;
}
export interface PlaneswalkerCombatEffect {label:string;selfGain:number;enemyReduction:number;threatens:boolean;mentalPressure:false}
interface ActionEvidence extends PlaneswalkerCombatEffect {
  order:number;atSeconds:number;elapsedSeconds:5;paidCost:number;physicalFactor:number;rolls:number[];
  randomCursorBefore:number;randomCursorAfter:number;playerSpiritualityAfter:number;enemySpiritualityAfter:number;
  siteBefore:PlaneswalkerSiteState;siteAfter:PlaneswalkerSiteState;doorOperationSeconds:0|5;symbolicMetres:0|4;
  chargeGranted:boolean;chargeConsumedByOrder:number|null;appliedAmount:number;
  consumedTransitOrder:number|null;consumedWardOrder:number|null;
}
export interface PlaneswalkerPlayerAction extends ActionEvidence {
  id:PlaneswalkerMoveId;attempted:boolean;succeeded:boolean;applied:boolean;fallback:'NONE'|'STRIKE'|'EVADE'|'OBSERVE'|'DOOR_OPEN';
}
export interface PlaneswalkerEnemyAction extends ActionEvidence {planned:PlaneswalkerEnemyIntent;actual:PlaneswalkerEnemyIntent|'OBSERVE'|'OPEN_DOOR';doorChanged:boolean}
interface Runtime {
  playerS:number;enemyS:number;powers:Record<PlaneswalkerPowerId,number>;site:PlaneswalkerSiteState;
  doorClosed:boolean;playerDoorOpened:boolean;transitAttempted:boolean;wardAttempted:boolean;
  transit:PlaneswalkerPlayerAction|null;ward:PlaneswalkerEnemyAction|null;
}
export interface PlaneswalkerRoundContext {
  source:PlaneswalkerCombatSource;stance:SliceStance;finished:boolean;liveState:string;runtime:Runtime;
  playerActions:PlaneswalkerPlayerAction[];enemyActions:PlaneswalkerEnemyAction[];label:string;outcome:PlaneswalkerRoundOutcome|null;
}
const same=(a:unknown,b:unknown)=>a===b||(a!==undefined&&b!==undefined&&stableStringify(a)===stableStringify(b));
const integer=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER):n is number=>Number.isSafeInteger(n)&&(n as number)>=min&&(n as number)<=max;
const shape=(v:unknown,keys:readonly string[]):boolean=>!!v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...keys].sort());
const none=(label:string):PlaneswalkerCombatEffect=>({label,selfGain:0,enemyReduction:0,threatens:false,mentalPressure:false});
const physicalAt=(health:number):number=>health>75?1:health>50?.95:health>25?.9:.8;
const mastery=(n:number)=>.65+.35*Math.max(0,Math.min(500,n))/500;
const hasClearRoute=(site:PlaneswalkerSiteState)=>site.door.state==='OPEN';
function operateDoor(site:PlaneswalkerSiteState,state:'OPEN'|'CLOSED',a:ActionEvidence):boolean {
  if(site.door.state==='BLOCKED'||site.door.state===state)return false;
  site.door.operations++;site.door.state=state;a.doorOperationSeconds=5;return true;
}
/** The same ordinary route is usable after either a spell or a blocked-door fallback. */
export function planeswalkerOrdinaryExitMetres(site:PlaneswalkerSiteState):2|6|10 {
  if(site.ordinaryExit!=='OPEN'||!['NEAR','FAR'].includes(site.playerLocation))throw new Error('当前位置或普通出口不符。');
  return site.playerLocation==='NEAR'?2:site.door.state==='OPEN'?6:10;
}
export function leavePlaneswalkerCombatSite(site:PlaneswalkerSiteState):2|6|10 {
  const metres=planeswalkerOrdinaryExitMetres(site);stopPlaneswalkerEffects(site);site.playerLocation='ENTRY';site.playerMetres+=metres;advancePlaneswalkerTime(site,metres);return metres;
}
export function currentPlaneswalkerCombatSource(s:SliceState):PlaneswalkerCombatSource|null {
  if(!hasPlaneswalkerDisputeOpponent(s))return null;const e=s.planeswalker.encounter,c=s.combat!,stats=s.character.coreStats,target=PLANESWALKER_TARGET;
  return {runId:s.runId,revision:s.revision,week:s.week,round:c.round,encounterId:'PLANESWALKER_DISPUTE',targetId:target.id,
    attemptWeek:e.attemptWeek!,startHistoryIndex:e.startHistoryIndex!,targetName:target.name,targetAge:target.age,targetSequence:3,targetCore:24,actualContemporaryBody:true,independentMind:true,
    enemyWeapon:target.weaponId,weaponLocation:'HAND',enemyLocation:'FAR',enemyPositionMetres:6,distanceMetres:s.planeswalker.life.site.playerLocation==='NEAR'?4:0,ordinaryExit:true,pursuit:false,thirdPartiesInArea:0,automaticAllyImmunity:false,
    site:structuredClone(s.planeswalker.life.site),playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,
    enemyHealth:c.enemyHealth,enemyMind:c.enemyMind,enemySpirituality:e.enemySpirituality,playerInjuries:structuredClone(s.injuries),enemyInjuries:structuredClone(c.enemyInjuries),playerRisk:s.injuryRisk,enemyRisk:c.enemyRisk,
    clubHeld:s.town.clubLocation==='HAND',physique:stats.physique,perception:stats.perception,knowledge:stats.knowledge,will:stats.will,
    travelMastery:s.progression.mastery[TRAVEL]??0,tricksMastery:s.progression.mastery[TRICKS]??0,powerUses:{...e.powerUses},randomSeed:s.random.seed,randomCursor:s.random.cursor};
}
function makeRuntime(x:PlaneswalkerCombatSource):Runtime{return{playerS:x.playerSpirituality,enemyS:x.enemySpirituality,powers:{...x.powerUses},site:structuredClone(x.site),doorClosed:false,playerDoorOpened:false,transitAttempted:false,wardAttempted:false,transit:null,ward:null};}
function liveState(s:SliceState):string{const e=s.planeswalker.encounter;return stableStringify({spirituality:s.spirituality,enemySpirituality:e.enemySpirituality,powerUses:e.powerUses,site:s.planeswalker.life.site});}
const dynamicSource=new Set(['playerSpirituality','enemySpirituality','powerUses','site','distanceMetres']);
function validRound(s:SliceState,r:PlaneswalkerRoundContext,supplied:PlaneswalkerCombatSource|null):boolean {
  const actual=currentPlaneswalkerCombatSource(s);return!r.finished&&actual!==null&&supplied!==null&&same(supplied,r.source)&&r.liveState===liveState(s)&&
    Object.entries(r.source).every(([key,value])=>dynamicSource.has(key)||same(actual[key as keyof PlaneswalkerCombatSource],value));
}
export function beginPlaneswalkerCombatRound(s:SliceState,stance:SliceStance,random:ActionRandomStream):PlaneswalkerRoundContext {
  const source=currentPlaneswalkerCombatSource(s);if(!['ATTACK','DEFEND','CONTROL','PREPARE','RETREAT'].includes(stance)||!source||!validSource(source)||random.seed!==source.randomSeed||random.cursor!==source.randomCursor)throw new Error('缺少当前通行室、真实对手或资源来源。');
  return{source,stance,finished:false,liveState:liveState(s),runtime:makeRuntime(source),playerActions:[],enemyActions:[],outcome:null,label:roundOpening(source)};
}
export const createPlaneswalkerCombatRound=beginPlaneswalkerCombatRound;
function actionBase(r:Runtime,order:number,physical:number,cursor:number):ActionEvidence {
  return{...none(''),order,atSeconds:r.site.elapsedSeconds,elapsedSeconds:5,paidCost:0,physicalFactor:physical,rolls:[],randomCursorBefore:cursor,randomCursorAfter:cursor,
    playerSpiritualityAfter:r.playerS,enemySpiritualityAfter:r.enemyS,siteBefore:structuredClone(r.site),siteAfter:structuredClone(r.site),doorOperationSeconds:0,symbolicMetres:0,
    chargeGranted:false,chargeConsumedByOrder:null,appliedAmount:0,consumedTransitOrder:null,consumedWardOrder:null};
}
function closeAction<T extends ActionEvidence>(x:PlaneswalkerCombatSource,a:T,r:Runtime,random:ActionRandomStream):T {
  advancePlaneswalkerTime(r.site,5);a.siteAfter=structuredClone(r.site);a.randomCursorAfter=random.cursor;a.playerSpiritualityAfter=r.playerS;a.enemySpiritualityAfter=r.enemyS;
  a.label+=` 这次动作耗时5秒；你余${r.playerS}灵性，${x.targetName}余${r.enemyS}灵性。门${r.site.door.state==='OPEN'?'开启':r.site.door.state==='CLOSED'?'关闭':'受阻'}，你在${r.site.playerLocation==='NEAR'?'近端':'另一侧'}。`;return a;
}
function playerAction(x:PlaneswalkerCombatSource,r:Runtime,id:PlaneswalkerMoveId,physical:number,order:number,random:ActionRandomStream):PlaneswalkerPlayerAction {
  const a:PlaneswalkerPlayerAction={...actionBase(r,order,physical,random.cursor),id,attempted:false,succeeded:false,applied:false,fallback:'NONE'};
  const openOrObserve=(why:string)=>{
    a.fallback='OBSERVE';
    if(r.site.door.state==='CLOSED'){r.playerDoorOpened=true;operateDoor(r.site,'OPEN',a);a.fallback='DOOR_OPEN';}
    a.label=why+(a.fallback==='DOOR_OPEN'?'你用这次动作普通开门，没有施法、能力检验或攻击，也不消耗灵性。':'当前通路受阻，你用这次动作普通观察，没有施法、能力检验或攻击，也不消耗灵性。');
  };
  const strike=(why:string)=>{
    if(r.site.playerLocation!=='FAR'&&!hasClearRoute(r.site)){openOrObserve(why);return;}
    a.fallback='STRIKE';a.selfGain=(x.clubHeld?16:12)*physical;a.threatens=a.selfGain>0;
    a.label=why+`你改用${x.clubHeld?'手中的棍':'自己的身体'}普通打击，优势${a.selfGain}，不消耗灵性。`;
  };
  const evade=(why:string)=>{a.fallback='EVADE';a.enemyReduction=10;a.label=why+'你在当前垫内普通避让，减势10，不消耗灵性，端点位置不变。';};
  if(id==='ACCIDENT'){a.selfGain=-22.5;a.label='你判断失误，优势−22.5。';}
  else if(id==='EVADE'){a.enemyReduction=10;a.label='你在通行室当前垫内普通避让，减势10，不消耗灵性，端点位置不变。';}
  else if(id===PATTERN&&!r.site.lamp.patternKnown){a.fallback='OBSERVE';a.label='你尚未亲见理解这盏原灯的光纹，不能复现未知式样；只普通观察，不施法、不检验、不消耗灵性，也没有攻击。';}
  else if(id===TRANSIT&&r.transitAttempted){evade('本轮象征通行已经付费尝试过；');}
  else if(id===TRANSIT&&(!r.site.localPadsKnown||r.site.door.state==='BLOCKED')){
    a.fallback='OBSERVE';a.label=!r.site.localPadsKnown?'近远两垫尚未由本人实查，不能象征通行；只普通观察，不消耗灵性。':'当前通路受阻，不能象征通行；只普通观察，不消耗灵性，本人位置不变。';
  }else if((id===PATTERN||id===TRICKS)&&!hasClearRoute(r.site)){openOrObserve('原遮门挡住了施术线路。');}
  else{
    const pattern=id===PATTERN,transit=id===TRANSIT,travel=id===TRAVEL,cost=pattern?7:6;
    if(r.playerS<cost){if(pattern||id===TRICKS)strike(`不足${cost}灵性，未施法。`);else evade(`不足${cost}灵性，未施法。`);}
    else{
      r.playerS-=cost;a.paidCost=cost;a.attempted=true;if(transit)r.transitAttempted=true;
      const ability=travel?'perception':'knowledge',difficulty=pattern||transit?20:16,roll=random.nextInt(1,100);a.rolls.push(roll);
      a.succeeded=roll<=computeCheckChance({ability,baseAbility:x[ability],difficulty,modifiers:[]});
      const name=pattern?'光纹复现':transit?'象征通行':travel?'继承旅行避让':'继承小电击';
      a.label=`${name}耗费${cost}灵性，${ability==='knowledge'?'知识':'感知'}检验${roll}${a.succeeded?'成功':'失败，费用已付'}。`;
      if(a.succeeded){
        a.applied=true;
        if(transit){
          const from=r.site.playerLocation;r.site.playerLocation=from==='NEAR'?'FAR':'NEAR';r.site.playerMetres+=4;a.symbolicMetres=4;
          r.site.effect={mode:'TRANSIT',expiresAt:r.site.elapsedSeconds+5};a.chargeGranted=true;r.transit=a;
          a.label+=`你本人从${from==='NEAR'?'近端2米处':'远端6米处'}沿已知两垫实际象征通行4米到${r.site.playerLocation==='NEAR'?'近端':'远端'}；未前往异星，不消耗或增加异星行程。仅准备削弱本轮随后一次实际持棍身体攻击45，当前减免为0；折光法术不触发或消耗准备。`;
        }else{
          a.selfGain=pattern?90:travel?0:36*mastery(x.tricksMastery);a.enemyReduction=travel?22*mastery(x.travelMastery):0;a.threatens=a.selfGain>0;
          if(pattern){
            r.site.effect={mode:'PATTERN',expiresAt:r.site.elapsedSeconds+5};
            if(r.ward){const ward=r.ward;ward.enemyReduction=45;ward.appliedAmount=45;ward.chargeConsumedByOrder=order;a.consumedWardOrder=ward.order;r.ward=null;
              ward.label+=` 随后第${order+1}次动作成功复现已知光纹，这道原屏护在该动作实际抵消45。`;a.label+=` ${x.targetName}先前付费屏护在此刻消耗一次，实际抵消这次光纹优势45。`;}
          }
          if(travel)a.label+='你仅在当前垫内有限侧身后收步，仍在原端点，不虚报新地点或星界行程。';
          a.label+=` 本次优势${a.selfGain}、减势${a.enemyReduction}。`;
        }
      }else if(transit)a.label+='本人没有移动，本轮付费尝试次数已经用去。';
    }
  }
  return closeAction(x,a,r,random);
}
function enemyAction(x:PlaneswalkerCombatSource,r:Runtime,planned:PlaneswalkerEnemyIntent,physical:number,order:number,random:ActionRandomStream):PlaneswalkerEnemyAction {
  const a:PlaneswalkerEnemyAction={...actionBase(r,order,physical,random.cursor),planned,actual:planned,doorChanged:false};
  if(planned==='VECTOR_STRIKE'&&r.enemyS<5||planned==='REFRACT_WARD'&&r.enemyS<4)a.actual='BODY_STRIKE';
  if(planned==='REFRACT_WARD'&&r.wardAttempted||planned==='CLOSE_DOOR'&&r.site.door.state!=='OPEN')a.actual='OBSERVE';
  if(a.actual==='VECTOR_STRIKE'&&!hasClearRoute(r.site))a.actual=r.site.door.state==='CLOSED'?'OPEN_DOOR':'OBSERVE';
  if(a.actual==='BODY_STRIKE'&&r.site.playerLocation!=='FAR'&&!hasClearRoute(r.site))a.actual=r.site.door.state==='CLOSED'?'OPEN_DOOR':'OBSERVE';
  if(a.actual==='VECTOR_STRIKE'){
    r.enemyS-=5;r.powers.VECTOR_STRIKE++;a.paidCost=5;a.selfGain=75;a.threatens=true;
    a.label=`${x.targetName}耗费5灵性，沿开启线路施放定点折光击，优势75。象征通行后的身体避让不能抵挡这次法术，也不会被它消耗。`;
  }else if(a.actual==='REFRACT_WARD'){
    r.enemyS-=4;r.powers.REFRACT_WARD++;r.wardAttempted=true;a.paidCost=4;a.chargeGranted=true;r.ward=a;
    a.label=`${x.targetName}耗费4灵性准备折光屏护，本轮仅能抵下一次真正成功的光纹复现45；当前抵消为0，不抵小电击、普通攻击或象征移动。`;
  }else if(a.actual==='CLOSE_DOOR'){
    r.doorClosed=true;r.powers.CLOSE_DOOR++;a.doorChanged=operateDoor(r.site,'CLOSED',a);
    a.label=`${x.targetName}用这次动作普通关门，耗时5秒；不消耗灵性，也没有攻击。普通绕行出口仍可使用。`;
  }else if(a.actual==='OPEN_DOOR'){
    a.doorChanged=operateDoor(r.site,'OPEN',a);a.label=`原门关闭了线路。${x.targetName}用这次动作普通开门，耗时5秒，没有攻击或灵性支出，也没有消耗你的象征通行避让准备。`;
  }else if(a.actual==='BODY_STRIKE'){
    a.selfGain=20*physical;a.threatens=a.selfGain>0;a.label=`${planned!=='BODY_STRIKE'?'灵性不足，改用普通动作。':''}${x.targetName}持自己的原棍打击，优势${a.selfGain}，不消耗灵性。`;
    if(r.transit&&a.threatens){const transit=r.transit;transit.enemyReduction=45;transit.appliedAmount=45;transit.chargeConsumedByOrder=order;a.consumedTransitOrder=transit.order;r.transit=null;
      transit.label+=` 随后在第${order+1}次动作实际削弱原棍身体攻击45。`;a.label+='你先前象征通行后保留的一次避让在此刻消耗，实际减势45；仍依双方优势和真实身体伤势判定结果。';}
  }else if(a.actual==='OBSERVE')a.label=planned==='REFRACT_WARD'&&r.wardAttempted?`${x.targetName}本轮已准备过一次屏护，这次只普通观察。`:planned==='CLOSE_DOOR'?`门已关闭或受阻；${x.targetName}这次只普通观察，没有攻击。`:`现场线路受阻，${x.targetName}只普通观察，没有攻击或灵性支出，也没有消耗你的象征通行避让准备。`;
  else{a.selfGain=-22.5;a.label=`${x.targetName}判断失误，优势−22.5。`;}
  return closeAction(x,a,r,random);
}
function commitRuntime(s:SliceState,r:PlaneswalkerRoundContext):void {
  s.spirituality=r.runtime.playerS;s.planeswalker.encounter.enemySpirituality=r.runtime.enemyS;s.planeswalker.encounter.powerUses={...r.runtime.powers};
  s.planeswalker.life.site=structuredClone(r.runtime.site);r.liveState=liveState(s);
}
export function resolvePlaneswalkerCombatAbility(s:SliceState,id:PlaneswalkerMoveId,physical:number,random:ActionRandomStream,r:PlaneswalkerRoundContext,source:PlaneswalkerCombatSource|null=r.source):PlaneswalkerCombatEffect {
  if(!validRound(s,r,source)||r.playerActions.length>=6||physical!==physicalAt(r.source.playerHealth)||random.seed!==r.source.randomSeed||!ABILITIES.some(a=>a.id===id))return none('当前人物、现场或资源不符，未执行动作。');
  const a=playerAction(r.source,r.runtime,id,physical,r.playerActions.length+r.enemyActions.length,random);r.playerActions.push(a);commitRuntime(s,r);return{label:a.label,selfGain:a.selfGain,enemyReduction:a.enemyReduction,threatens:a.threatens,mentalPressure:false};
}
export function resolvePlaneswalkerEnemyAbility(s:SliceState,planned:PlaneswalkerEnemyIntent,physical:number,random:ActionRandomStream,r:PlaneswalkerRoundContext,source:PlaneswalkerCombatSource|null=r.source):PlaneswalkerCombatEffect {
  if(!validRound(s,r,source)||r.enemyActions.length>=6||physical!==physicalAt(r.source.enemyHealth)||random.seed!==r.source.randomSeed||![...PLANESWALKER_POWER_IDS,'BODY_STRIKE','ACCIDENT'].includes(planned))return none('对手、棍或当前资源不符，未执行动作。');
  const a=enemyAction(r.source,r.runtime,planned,physical,r.playerActions.length+r.enemyActions.length,random);r.enemyActions.push(a);commitRuntime(s,r);return{label:a.label,selfGain:a.selfGain,enemyReduction:a.enemyReduction,threatens:a.threatens,mentalPressure:false};
}
export interface PlaneswalkerRoundOutcome {
  targetId:PlaneswalkerTargetId;round:number;source:PlaneswalkerCombatSource;stance:SliceStance;continuing:boolean;
  enemyHealth:number;enemyMind:number;enemySpirituality:number;enemyStatus:'RESISTING'|'SURRENDERED'|'DEAD';
  playerSpiritualityBefore:number;playerSpiritualityAfter:number;playerHealthAfter:number;playerMindAfter:number;enemySpiritualityBefore:number;
  playerInjuriesAfter:SliceInjury[];enemyInjuriesAfter:SliceInjury[];playerRiskAfter:number;enemyRiskAfter:number;
  powerUses:Record<PlaneswalkerPowerId,number>;doorClosed:boolean;playerDoorOpened:boolean;transitAttempted:boolean;wardAttempted:boolean;
  expiredTransitChargeOrder:number|null;expiredWardChargeOrder:number|null;siteAfter:PlaneswalkerSiteState;elapsedSeconds:60|62|66|70;exitMetres:0|2|6|10;randomCursorAfter:number;
  playerActions:PlaneswalkerPlayerAction[];enemyActions:PlaneswalkerEnemyAction[];
}
export function finishPlaneswalkerCombatRound(s:SliceState,r:PlaneswalkerRoundContext,continuing=true,randomCursorAfter=s.random.cursor):PlaneswalkerRoundOutcome {
  const e=s.planeswalker.encounter,c=s.combat;
  if(r.finished||!c||c.encounterId!=='PLANESWALKER_DISPUTE'||c.round!==r.source.round||r.liveState!==liveState(s))throw new Error('这个回合已结束，或现场资源发生了变化。');
  e.enemyHealth=c.enemyHealth;e.enemyMind=c.enemyMind;e.enemyStatus=c.enemyStatus;e.enemyInjuries=structuredClone(c.enemyInjuries);e.enemyRisk=c.enemyRisk;if(e.enemyStatus!=='RESISTING')e.weaponLocation='FAR';
  const site=s.planeswalker.life.site;advancePlaneswalkerTime(site,r.source.site.elapsedSeconds+60-site.elapsedSeconds);stopPlaneswalkerEffects(site);
  const exitMetres=!continuing&&s.health>0?leavePlaneswalkerCombatSite(site):0;const elapsedSeconds=(60+exitMetres) as 60|62|66|70;r.finished=true;
  r.outcome={targetId:r.source.targetId,round:c.round,source:structuredClone(r.source),stance:r.stance,continuing,
    enemyHealth:c.enemyHealth,enemyMind:c.enemyMind,enemySpirituality:e.enemySpirituality,enemyStatus:c.enemyStatus,
    playerSpiritualityBefore:r.source.playerSpirituality,playerSpiritualityAfter:s.spirituality,playerHealthAfter:s.health,playerMindAfter:s.mind,enemySpiritualityBefore:r.source.enemySpirituality,
    playerInjuriesAfter:structuredClone(s.injuries),enemyInjuriesAfter:structuredClone(c.enemyInjuries),playerRiskAfter:s.injuryRisk,enemyRiskAfter:c.enemyRisk,
    powerUses:{...e.powerUses},doorClosed:r.runtime.doorClosed,playerDoorOpened:r.runtime.playerDoorOpened,transitAttempted:r.runtime.transitAttempted,wardAttempted:r.runtime.wardAttempted,
    expiredTransitChargeOrder:r.runtime.transit?.order??null,expiredWardChargeOrder:r.runtime.ward?.order??null,siteAfter:structuredClone(site),elapsedSeconds,exitMetres,randomCursorAfter,
    playerActions:structuredClone(r.playerActions),enemyActions:structuredClone(r.enemyActions)};return structuredClone(r.outcome);
}
export function planeswalkerRoundOutcome(r:PlaneswalkerRoundContext):PlaneswalkerRoundOutcome{if(!r.outcome)throw new Error('回合尚未结束。');return structuredClone(r.outcome);}
/** Public action rolls are resolved checks; stream offsets and replay roots stay private. */
const publicPlaneswalkerInjury = (i: SliceInjury) => ({ id: i.id, severity: i.severity, acquiredRevision: i.acquiredRevision, treatedRevision: i.treatedRevision });
const publicPlaneswalkerPowerUses = (p: Record<PlaneswalkerPowerId, number>) => ({ VECTOR_STRIKE: p.VECTOR_STRIKE, REFRACT_WARD: p.REFRACT_WARD, CLOSE_DOOR: p.CLOSE_DOOR });
function projectPlaneswalkerAction(a: ActionEvidence) { return {
  label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: a.mentalPressure,
  order: a.order, atSeconds: a.atSeconds, elapsedSeconds: a.elapsedSeconds, paidCost: a.paidCost, physicalFactor: a.physicalFactor,
  rolls: [...a.rolls], playerSpiritualityAfter: a.playerSpiritualityAfter, enemySpiritualityAfter: a.enemySpiritualityAfter,
  siteBefore: projectPlaneswalkerSite(a.siteBefore), siteAfter: projectPlaneswalkerSite(a.siteAfter), doorOperationSeconds: a.doorOperationSeconds,
  symbolicMetres: a.symbolicMetres, chargeGranted: a.chargeGranted, chargeConsumedByOrder: a.chargeConsumedByOrder,
  appliedAmount: a.appliedAmount, consumedTransitOrder: a.consumedTransitOrder, consumedWardOrder: a.consumedWardOrder,
}; }
export function projectPlaneswalkerPlayerAction(a: PlaneswalkerPlayerAction) { return {
  ...projectPlaneswalkerAction(a), id: a.id, attempted: a.attempted, succeeded: a.succeeded, applied: a.applied, fallback: a.fallback,
}; }
export function projectPlaneswalkerEnemyAction(a: PlaneswalkerEnemyAction) { return {
  ...projectPlaneswalkerAction(a), planned: a.planned, actual: a.actual, doorChanged: a.doorChanged,
}; }
export type PlaneswalkerPublicPlayerAction = ReturnType<typeof projectPlaneswalkerPlayerAction>;
export type PlaneswalkerPublicEnemyAction = ReturnType<typeof projectPlaneswalkerEnemyAction>;
export function projectPlaneswalkerRoundOutcome(o: PlaneswalkerRoundOutcome) { return {
  targetId: o.targetId, round: o.round, stance: o.stance, continuing: o.continuing, enemyHealth: o.enemyHealth,
  enemyMind: o.enemyMind, enemySpirituality: o.enemySpirituality, enemyStatus: o.enemyStatus,
  playerSpiritualityBefore: o.playerSpiritualityBefore, playerSpiritualityAfter: o.playerSpiritualityAfter,
  playerHealthAfter: o.playerHealthAfter, playerMindAfter: o.playerMindAfter, enemySpiritualityBefore: o.enemySpiritualityBefore,
  playerInjuriesAfter: o.playerInjuriesAfter.map(publicPlaneswalkerInjury), enemyInjuriesAfter: o.enemyInjuriesAfter.map(publicPlaneswalkerInjury),
  playerRiskAfter: o.playerRiskAfter, enemyRiskAfter: o.enemyRiskAfter, powerUses: publicPlaneswalkerPowerUses(o.powerUses),
  doorClosed: o.doorClosed, playerDoorOpened: o.playerDoorOpened, transitAttempted: o.transitAttempted, wardAttempted: o.wardAttempted,
  expiredTransitChargeOrder: o.expiredTransitChargeOrder, expiredWardChargeOrder: o.expiredWardChargeOrder,
  siteAfter: projectPlaneswalkerSite(o.siteAfter), elapsedSeconds: o.elapsedSeconds, exitMetres: o.exitMetres,
  playerActions: o.playerActions.map(projectPlaneswalkerPlayerAction), enemyActions: o.enemyActions.map(projectPlaneswalkerEnemyAction),
}; }
export type PlaneswalkerPublicRoundOutcome = ReturnType<typeof projectPlaneswalkerRoundOutcome>;

export function projectPlaneswalkerCombat(s:SliceState){
  const e=s.planeswalker.encounter,visible=isPlaneswalker(s),target=e.targetId?PLANESWALKER_TARGET:null,last=s.combat?.encounterId==='PLANESWALKER_DISPUTE'?s.combat.lastRound?.planeswalkerOutcome:e.terminal?s.combatHistory[e.terminal.historyIndex]?.planeswalkerOutcome:null;
  return{enemyName:visible&&target?`${target.name}（${target.age}岁）`:'',targetId:visible?e.targetId:null,playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,maxSpirituality:120,
    enemyHealth:visible?e.enemyHealth:null,enemyMind:visible?e.enemyMind:null,enemySpirituality:visible?e.enemySpirituality:null,powerUses:visible?publicPlaneswalkerPowerUses(e.powerUses):null,
    site:visible?projectPlaneswalkerSite(s.planeswalker.life.site):null,startSite:visible&&e.startSite?projectPlaneswalkerSite(e.startSite):null,originalExit:true,pursuit:false,distanceMetres:visible&&s.planeswalker.life.site.playerLocation!=='REMOTE'?Math.abs(6-PLANESWALKER_POSITION_METRES[s.planeswalker.life.site.playerLocation]):null,automaticAllyImmunity:false,
    lastActionSequence:visible&&last?[...last.playerActions.map(a=>({...projectPlaneswalkerPlayerAction(a),actor:'PLAYER' as const})),...last.enemyActions.map(a=>({...projectPlaneswalkerEnemyAction(a),actor:'ENEMY' as const}))].sort((a,b)=>a.order-b.order):[],
    countWheel:PLANESWALKER_COUNT_WHEEL.map(x=>({...x})),enemyCountWheel:PLANESWALKER_ENEMY_COUNT_WHEEL.map(x=>({...x})),enemyAbilityWheel:PLANESWALKER_ENEMY_ABILITY_WHEEL.map(x=>({...x})),
    summary:visible?'已知光纹复现须原门开启，7灵性/知识20成功取得优势90；旧小电击须同样开启线路。象征通行6灵性/知识20，每轮最多一次付费尝试，在本人实查的两垫间实际移动4米，普通关门仍可通行，受阻则不施法。成功只准备削弱随后一次实际持棍攻击45，不抵折光法术。敌屏护4灵性、本轮一次，仅抵下一成功光纹复现45。普通开关门各占一次动作，无附带攻击。每动作5秒、每轮60秒；继续时仅你恢复12灵性，上限120；敌人不回灵。原人、原物、伤势与实际移动保留，战斗不增长掌握。':''};
}
const SOURCE_KEYS=['runId','revision','week','round','encounterId','targetId','attemptWeek','startHistoryIndex','targetName','targetAge','targetSequence','targetCore','actualContemporaryBody','independentMind','enemyWeapon','weaponLocation','enemyLocation','enemyPositionMetres','distanceMetres','ordinaryExit','pursuit','thirdPartiesInArea','automaticAllyImmunity','site','playerHealth','playerMind','playerSpirituality','enemyHealth','enemyMind','enemySpirituality','playerInjuries','enemyInjuries','playerRisk','enemyRisk','clubHeld','physique','perception','knowledge','will','travelMastery','tricksMastery','powerUses','randomSeed','randomCursor'] as const;
function validInjuries(v:SliceInjury[],revision:number):boolean {
  return Array.isArray(v)&&new Set(v.map(i=>i.id)).size===v.length&&v.every(i=>shape(i,['id','severity','acquiredRevision','treatedRevision'])&&typeof i.id==='string'&&i.id.length>0&&['LIGHT','HEAVY'].includes(i.severity)&&integer(i.acquiredRevision,1,revision)&&(i.treatedRevision===null||integer(i.treatedRevision,i.acquiredRevision,revision)));
}
function validSource(x:PlaneswalkerCombatSource):boolean {
  if(!shape(x,SOURCE_KEYS))return false;const target=PLANESWALKER_TARGET;
  return typeof x.runId==='string'&&x.runId.length>0&&integer(x.revision)&&integer(x.week,1)&&integer(x.round,1)&&integer(x.startHistoryIndex)&&x.attemptWeek===x.week&&
    x.encounterId==='PLANESWALKER_DISPUTE'&&x.targetId===target.id&&x.targetName===target.name&&x.targetAge===target.age&&x.targetSequence===3&&x.targetCore===24&&x.actualContemporaryBody===true&&x.independentMind===true&&
    x.enemyWeapon===target.weaponId&&x.weaponLocation==='HAND'&&x.enemyLocation==='FAR'&&x.enemyPositionMetres===6&&x.distanceMetres===(x.site.playerLocation==='NEAR'?4:0)&&x.ordinaryExit===true&&x.pursuit===false&&x.thirdPartiesInArea===0&&x.automaticAllyImmunity===false&&
    validatePlaneswalkerSiteState(x.site)&&integer(x.site.introducedWeek,1,x.week)&&['NEAR','FAR'].includes(x.site.playerLocation)&&x.site.operatorLocation==='OUTSIDE'&&x.site.ordinaryExit==='OPEN'&&x.site.effect.mode==='OFF'&&x.site.operatorConsent==='GRANTED'&&x.site.operatorConsentWeek===x.week&&
    x.site.parcel.location==='ENTRY_STAND'&&
    [x.playerHealth,x.playerMind,x.enemyHealth,x.enemyMind].every(n=>integer(n,1,100))&&x.enemyMind===100&&[x.playerSpirituality,x.enemySpirituality].every(n=>integer(n,0,120))&&
    [x.physique,x.perception,x.knowledge,x.will,x.travelMastery,x.tricksMastery].every(n=>integer(n,0,500))&&typeof x.clubHeld==='boolean'&&integer(x.playerRisk)&&integer(x.enemyRisk)&&
    validInjuries(x.playerInjuries,x.revision)&&validInjuries(x.enemyInjuries,x.revision)&&shape(x.powerUses,PLANESWALKER_POWER_IDS)&&PLANESWALKER_POWER_IDS.every(id=>integer(x.powerUses[id]))&&x.powerUses.CLOSE_DOOR<=6*(x.round-1)&&x.powerUses.REFRACT_WARD<=x.round-1&&
    x.enemySpirituality===120-PLANESWALKER_POWERS.reduce((n,p)=>n+p.cost*x.powerUses[p.id],0)&&typeof x.randomSeed==='string'&&x.randomSeed.length>0&&x.randomSeed.length<=256&&integer(x.randomCursor);
}
/** Exact inherited common formulas, applied to immutable historical source rather than later live stats. */
function sourcePenalty(current:number,maximum:number):number {const f=Math.max(0,Math.min(1,current/maximum));return f>.75?0:f>.5?.05:f>.25?.1:.2;}
function sourceBase(core:number,health:number,mind:number,spirituality:number):number {return(1250+Math.min(core,250))*(1-Math.min(.4,sourcePenalty(health,100)+sourcePenalty(mind,100)+sourcePenalty(spirituality,120)));}
function sourceWeights(risk:number):{light:number;heavy:number;death:number}{const death=Math.min(100,5+Math.min(risk,10)*10),shifted=death-5;return{light:Math.max(0,65-shifted),heavy:Math.max(0,30-Math.max(0,shifted-65)),death};}
interface ReplayedRound {outcome:PlaneswalkerRoundOutcome;playerCount:number;enemyCount:number;playerCountRoll:number;enemyCountRoll:number;first:'PLAYER'|'ENEMY';retreat:'NONE'|'SUCCESS'|'FAILURE';winner:'PLAYER'|'ENEMY';playerAdvantage:number;enemyAdvantage:number;winChance:number;consequenceWeights:{light:number;heavy:number;death:number}|null;consequenceRoll?:number}
function replayOutcome(o:PlaneswalkerRoundOutcome):ReplayedRound|null {
  const x=o?.source;if(!x||!validSource(x)||!['ATTACK','DEFEND','CONTROL','PREPARE','RETREAT'].includes(o.stance)||!Array.isArray(o.playerActions)||!Array.isArray(o.enemyActions)||o.playerActions.length>6||o.enemyActions.length>6)return null;
  const rng=new DeterministicActionRandomStream(x.randomSeed,x.randomCursor),r=makeRuntime(x),playerCountRoll=rng.nextInt(1,100),enemyCountRoll=rng.nextInt(1,100),playerCount=planeswalkerActionCount(playerCountRoll),enemyCount=planeswalkerEnemyActionCount(enemyCountRoll);
  const first=x.round%2===1?'PLAYER':'ENEMY',order=first==='PLAYER'?['PLAYER','ENEMY'] as const:['ENEMY','PLAYER'] as const,remaining={PLAYER:playerCount,ENEMY:enemyCount};
  const players:PlaneswalkerPlayerAction[]=[],enemies:PlaneswalkerEnemyAction[]=[];let retreat:ReplayedRound['retreat']='NONE';
  while(remaining.PLAYER>0||remaining.ENEMY>0){for(const actor of order){if(remaining[actor]===0)continue;if(actor==='PLAYER'&&o.stance==='RETREAT'){remaining.PLAYER=0;retreat=rng.nextInt(1,100)<=50?'SUCCESS':'FAILURE';if(retreat==='SUCCESS'){remaining.ENEMY=0;break;}continue;}remaining[actor]--;
    if(actor==='PLAYER')players.push(playerAction(x,r,drawPlayer(rng,o.stance),physicalAt(x.playerHealth),players.length+enemies.length,rng));else enemies.push(enemyAction(x,r,drawPlaneswalkerEnemyAbility(rng),physicalAt(x.enemyHealth),players.length+enemies.length,rng));}}
  if(!same(players,o.playerActions)||!same(enemies,o.enemyActions))return null;
  const sum=(actions:{selfGain:number;enemyReduction:number}[],key:'selfGain'|'enemyReduction')=>actions.reduce((n,a)=>n+a[key],0);
  const playerAdvantage=Math.max(125,sourceBase(x.physique*.35+x.perception*.25+x.will*.25+x.knowledge*.15,x.playerHealth,x.playerMind,x.playerSpirituality)+sum(players,'selfGain')-sum(enemies,'enemyReduction'));
  const enemyAdvantage=Math.max(125,sourceBase(24,x.enemyHealth,x.enemyMind,x.enemySpirituality)+sum(enemies,'selfGain')-sum(players,'enemyReduction')),winChance=playerAdvantage/(playerAdvantage+enemyAdvantage)*100;
  const winner=retreat==='SUCCESS'?'ENEMY':rng.nextInt(1,1_000_000)<=winChance*10_000?'PLAYER':'ENEMY';
  let playerHealth=x.playerHealth,enemyHealth=x.enemyHealth,playerRisk=x.playerRisk,enemyRisk=x.enemyRisk,enemyStatus:PlaneswalkerRoundOutcome['enemyStatus']='RESISTING',continuing=retreat!=='SUCCESS';
  const playerInjuries=structuredClone(x.playerInjuries),enemyInjuries=structuredClone(x.enemyInjuries);let consequenceWeights:ReplayedRound['consequenceWeights']=null,consequenceRoll:number|undefined;
  if(retreat!=='SUCCESS'){const loser=winner==='PLAYER'?'ENEMY':'PLAYER',injuries=loser==='PLAYER'?playerInjuries:enemyInjuries;let risk=loser==='PLAYER'?playerRisk:enemyRisk;if(injuries.length)risk++;if(loser==='PLAYER')playerRisk=risk;else enemyRisk=risk;
    if(loser==='PLAYER'?enemies.some(a=>a.threatens):players.some(a=>a.threatens)){consequenceWeights=sourceWeights(risk);consequenceRoll=rng.nextInt(1,100);const severity=consequenceRoll<=consequenceWeights.light?'LIGHT':consequenceRoll<=consequenceWeights.light+consequenceWeights.heavy?'HEAVY':'DEATH';
      if(severity==='DEATH'){if(loser==='PLAYER')playerHealth=0;else{enemyHealth=0;enemyStatus='DEAD';}continuing=false;}
      else{injuries.push({id:`${x.runId}:combat:${x.round}:${loser}:${x.revision+1}:${injuries.length}`,severity,acquiredRevision:x.revision+1,treatedRevision:null});const damage=severity==='LIGHT'?10:30;if(loser==='PLAYER')playerHealth=Math.max(0,playerHealth-damage);else enemyHealth=Math.max(0,enemyHealth-damage);
        if(playerHealth===0||enemyHealth===0){if(enemyHealth===0)enemyStatus='DEAD';continuing=false;}else if(loser==='ENEMY'&&severity==='HEAVY'){enemyStatus='SURRENDERED';continuing=false;}}}}
  advancePlaneswalkerTime(r.site,x.site.elapsedSeconds+60-r.site.elapsedSeconds);stopPlaneswalkerEffects(r.site);const exitMetres=!continuing&&playerHealth>0?leavePlaneswalkerCombatSite(r.site):0,elapsedSeconds=(60+exitMetres) as 60|62|66|70;
  const expected:PlaneswalkerRoundOutcome={targetId:x.targetId,round:x.round,source:structuredClone(x),stance:o.stance,continuing,enemyHealth,enemyMind:x.enemyMind,enemySpirituality:r.enemyS,enemyStatus,
    playerSpiritualityBefore:x.playerSpirituality,playerSpiritualityAfter:r.playerS,playerHealthAfter:playerHealth,playerMindAfter:x.playerMind,enemySpiritualityBefore:x.enemySpirituality,
    playerInjuriesAfter:playerInjuries,enemyInjuriesAfter:enemyInjuries,playerRiskAfter:playerRisk,enemyRiskAfter:enemyRisk,powerUses:r.powers,doorClosed:r.doorClosed,playerDoorOpened:r.playerDoorOpened,transitAttempted:r.transitAttempted,wardAttempted:r.wardAttempted,
    expiredTransitChargeOrder:r.transit?.order??null,expiredWardChargeOrder:r.ward?.order??null,siteAfter:r.site,elapsedSeconds,exitMetres,randomCursorAfter:rng.cursor,playerActions:players,enemyActions:enemies};
  if(!same(o,expected))return null;return{outcome:expected,playerCount,enemyCount,playerCountRoll,enemyCountRoll,first,retreat,winner,playerAdvantage,enemyAdvantage,winChance,consequenceWeights,...(consequenceRoll===undefined?{}:{consequenceRoll})};
}
export function validatePlaneswalkerRoundOutcome(value:unknown):value is PlaneswalkerRoundOutcome {try{return replayOutcome(value as PlaneswalkerRoundOutcome)!==null;}catch{return false;}}
export function validatePlaneswalkerCombatRound(round:SliceCombatRound):boolean {try{const o=round.planeswalkerOutcome,replay=o?replayOutcome(o):null;if(!o||!replay||round.round!==o.round||round.stance!==o.stance||round.consequence!==planeswalkerCombatConsequence(round)||!shape(round,['round','stance','first','playerCount','enemyCount','playerCountRoll','enemyCountRoll','moves','playerAdvantage','enemyAdvantage','winChance','winner','consequence','consequenceWeights','retreat','planeswalkerOutcome',...(replay.consequenceRoll===undefined?[]:['consequenceRoll'])]))return false;
  for(const key of ['playerCount','enemyCount','playerCountRoll','enemyCountRoll','first','retreat','winner','playerAdvantage','enemyAdvantage','winChance','consequenceWeights','consequenceRoll'] as const)if(!same(round[key],replay[key]))return false;
  const moves=[...o.playerActions.map(a=>({...a,actor:'PLAYER' as const})),...o.enemyActions.map(a=>({...a,actor:'ENEMY' as const}))].sort((a,b)=>a.order-b.order).map(a=>({actor:a.actor,label:a.label,selfGain:a.selfGain,enemyReduction:a.enemyReduction}));return same(round.moves,moves);
}catch{return false;}}
function roundOpening(x:PlaneswalkerCombatSource):string {
  return `${x.targetAge}岁的${x.targetName}持自己的棍留在通行室另一侧，健康${x.enemyHealth}、精神100、灵性${x.enemySpirituality}。${x.site.operatorName}已沿普通通路退到室外；原包、原灯、原屏和门保留此前状态。你在${x.site.playerLocation==='NEAR'?'近端':'另一侧'}，与对手相距${x.distanceMetres}米。`;
}
/** Display text is derived from the same exact replay, never accepted as arbitrary saved prose. */
export function planeswalkerCombatConsequence(round:SliceCombatRound):string {
  const o=round.planeswalkerOutcome;if(!o)throw new Error('缺少旅法师回合结果。');let text:string;
  if(round.retreat==='SUCCESS')text=`你通过撤离判定，沿普通通路步行${o.exitMetres}米、耗时${o.exitMetres}秒回到入口。${o.source.targetName}仍留在自己的位置。`;
  else {
    const loser=round.winner==='PLAYER'?'ENEMY':'PLAYER',subject=loser==='PLAYER'?'你':o.source.targetName,risk=loser==='PLAYER'?o.playerRiskAfter:o.enemyRiskAfter;
    if(round.consequenceRoll===undefined)text=`${subject}本回合处于下风，但没有遭受实际致伤攻击，因此没有新增身体伤势。累计风险${risk}。`;
    else {
      const weights=round.consequenceWeights!,severity=round.consequenceRoll<=weights.light?'LIGHT':round.consequenceRoll<=weights.light+weights.heavy?'HEAVY':'DEATH';
      if(severity==='DEATH')text=`${subject}伤势检验${round.consequenceRoll}/100，伤势致命，身体留在通行室内的实际位置。`;
      else {text=`${subject}伤势检验${round.consequenceRoll}/100，受到${severity==='LIGHT'?'轻':'重'}伤，健康减少${severity==='LIGHT'?10:30}。`;
        if(o.playerHealthAfter===0||o.enemyHealth===0)text+='健康已降至0，伤者死亡。';else if(o.enemyStatus==='SURRENDERED')text+=`${o.source.targetName}因重伤停止抵抗，将自己的棍放在脚边。`;}
    }
    if(!o.continuing&&o.playerHealthAfter>0)text+=`你停止法术，沿普通通路步行${o.exitMetres}米、耗时${o.exitMetres}秒回到入口。`;
  }
  const transit=o.playerActions.reduce((n,a)=>n+a.appliedAmount,0),ward=o.enemyActions.reduce((n,a)=>n+a.appliedAmount,0);
  return roundOpening(o.source)+text+` 本轮象征通行后的避让实际减势${transit}，对手屏护实际抵住${ward}；未用的一次性准备随回合结束失效。伤势、灵性支出、门和原物痕迹保留。`;
}

export const validatePlaneswalkerCombatOutcome = validatePlaneswalkerRoundOutcome;
