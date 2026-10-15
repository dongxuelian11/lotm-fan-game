import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { DEATH_CONSUL_TARGETS, DEATH_CONSUL_POWER_IDS, DEATH_CONSUL_POWERS, hasDeathConsulDisputeOpponent,
  type DeathConsulTargetId, type DeathConsulEnemyIntent, type DeathConsulPowerId } from './encounter.js';
import { validateDeathConsulSiteState, advanceDeathConsulTime, stopDeathConsulEffects, type DeathConsulSiteState, type DeathConsulSourceEra } from './resources.js';

/** Bounded original game mechanics. The existing S3 core, resource budget and physical injury wheel are retained. */
export const DEATH_CONSUL_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const DEATH_CONSUL_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const deathConsulActionCount = pyromaniacActionCount;
export const deathConsulEnemyActionCount = pyromaniacActionCount;
const FLAME = 'death.s2.pale-flame', PASSAGE = 'death.s2.spirit-passage';
const WORDS = 'death.s6.dead-words', SEAL = 'death.s4.underworld-seal';
export type DeathConsulMoveId = typeof FLAME | typeof PASSAGE | typeof WORDS | typeof SEAL | 'EVADE' | 'ACCIDENT';
const ABILITIES: readonly { id: DeathConsulMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: FLAME, label: '苍白焰（7灵性/意志20，开门清路后优势105）', weight: 25, stance: 'ATTACK' },
  { id: PASSAGE, label: '灵界短渡（6灵性/知识20，本轮最多尝试一次，实际短渡2米后待抵一次身体攻击40）', weight: 20, stance: 'CONTROL' },
  { id: WORDS, label: '死者之语（6灵性/意志16，优势38×既有掌握）', weight: 20, stance: 'DEFEND' },
  { id: SEAL, label: '冥界借力封印（6灵性/知识16，减势20×既有掌握）', weight: 15, stance: 'CONTROL' },
  { id: 'EVADE', label: '普通避让（0灵性，减势10）', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断偏差（优势−22.5）', weight: 5, stance: null },
];
export const DEATH_CONSUL_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'PALE_STRIKE', label: '苍白法术：5灵性，清路时优势75', weight: 35 },
  { id: 'STEADY', label: '定神：4灵性，本轮一次抵下一成功旧封印最多32', weight: 25 },
  { id: 'BODY_STRIKE', label: '持棍打击：20×身体状态', weight: 20 },
  { id: 'CLOSE_DOOR', label: '普通关门：0灵性，单独占用一次动作，没有攻击', weight: 15 },
  { id: 'ACCIDENT', label: '判断偏差：优势−22.5', weight: 5 },
];
export const isDeathConsul = (s: SliceState): boolean => s.progression.pathwayId === 'death' && s.progression.sequence === 2;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function deathConsulAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a,b) => a+b,0);
  return ABILITIES.map((a,i) => ({ id:a.id,label:a.label,weight:weights[i]!/total*100 }));
}
function drawPlayer(random: ActionRandomStream, stance: SliceStance | null): DeathConsulMoveId {
  const weights=tickets(stance);let n=random.nextInt(1,weights.reduce((a,b)=>a+b,0));
  for(const [i,a] of ABILITIES.entries()){n-=weights[i]!;if(n<=0)return a.id;}throw new Error('死亡执政官行动盘无效。');
}
export function drawDeathConsulAbility(random:ActionRandomStream,_s:SliceState,stance:SliceStance|null):DeathConsulMoveId{return drawPlayer(random,stance);}
export function drawDeathConsulEnemyAbility(random:ActionRandomStream):DeathConsulEnemyIntent {
  let n=random.nextInt(1,100);for(const a of DEATH_CONSUL_ENEMY_ABILITY_WHEEL){n-=a.weight;if(n<=0)return a.id as DeathConsulEnemyIntent;}throw new Error('当前对手的行动盘无效。');
}
export interface DeathConsulCombatSource {
  runId:string;revision:number;week:number;round:number;encounterId:'DEATH_CONSUL_DISPUTE';targetId:DeathConsulTargetId;sourceEra:DeathConsulSourceEra;
  attemptWeek:number;startHistoryIndex:number;targetName:string;targetAge:47|45;targetSequence:3;targetCore:24;actualContemporaryBody:true;independentMind:true;
  enemyWeapon:'DC2-O-ROOK-CLUB'|'DC2-P-NOLAN-CLUB';weaponLocation:'HAND';enemyLocation:'OTHER';distanceMetres:0|2;ordinaryExit:true;pursuit:false;
  thirdPartiesInArea:0;automaticAllyImmunity:false;site:DeathConsulSiteState;
  playerHealth:number;playerMind:number;playerSpirituality:number;enemyHealth:number;enemyMind:number;enemySpirituality:number;
  playerInjuries:SliceInjury[];enemyInjuries:SliceInjury[];playerRisk:number;enemyRisk:number;
  clubHeld:boolean;physique:number;perception:number;knowledge:number;will:number;sealMastery:number;deadWordsMastery:number;
  powerUses:Record<DeathConsulPowerId,number>;randomSeed:string;randomCursor:number;
}
export interface DeathConsulCombatEffect {label:string;selfGain:number;enemyReduction:number;threatens:boolean;mentalPressure:false}
interface ActionEvidence extends DeathConsulCombatEffect {
  order:number;atSeconds:number;elapsedSeconds:5;paidCost:number;physicalFactor:number;rolls:number[];
  randomCursorBefore:number;randomCursorAfter:number;playerSpiritualityAfter:number;enemySpiritualityAfter:number;
  siteBefore:DeathConsulSiteState;siteAfter:DeathConsulSiteState;doorOperationSeconds:0|5;passageMetres:0|2;
  chargeGranted:boolean;chargeConsumedByOrder:number|null;appliedAmount:number;
  consumedPassageOrder:number|null;consumedSteadyOrder:number|null;
}
export interface DeathConsulPlayerAction extends ActionEvidence {
  id:DeathConsulMoveId;attempted:boolean;succeeded:boolean;applied:boolean;fallback:'NONE'|'STRIKE'|'EVADE'|'OBSERVE'|'DOOR_OPEN';
}
export interface DeathConsulEnemyAction extends ActionEvidence {planned:DeathConsulEnemyIntent;actual:DeathConsulEnemyIntent|'OBSERVE'|'OPEN_DOOR';doorChanged:boolean}
interface Runtime {
  playerS:number;enemyS:number;powers:Record<DeathConsulPowerId,number>;site:DeathConsulSiteState;
  doorClosed:boolean;playerDoorOpened:boolean;passageAttempted:boolean;steadyAttempted:boolean;
  passage:DeathConsulPlayerAction|null;steady:DeathConsulEnemyAction|null;
}
export interface DeathConsulRoundContext {
  source:DeathConsulCombatSource;stance:SliceStance;finished:boolean;liveState:string;runtime:Runtime;
  playerActions:DeathConsulPlayerAction[];enemyActions:DeathConsulEnemyAction[];label:string;outcome:DeathConsulRoundOutcome|null;
}
const same=(a:unknown,b:unknown)=>a===b||(a!==undefined&&b!==undefined&&stableStringify(a)===stableStringify(b));
const integer=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER):n is number=>Number.isSafeInteger(n)&&(n as number)>=min&&(n as number)<=max;
const shape=(v:unknown,keys:readonly string[]):boolean=>!!v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...keys].sort());
const none=(label:string):DeathConsulCombatEffect=>({label,selfGain:0,enemyReduction:0,threatens:false,mentalPressure:false});
const physicalAt=(health:number):number=>health>75?1:health>50?.95:health>25?.9:.8;
const mastery=(n:number)=>.65+.35*Math.max(0,Math.min(500,n))/500;
const hasClearRoute=(site:DeathConsulSiteState)=>site.door.state==='OPEN';
function operateDoor(site:DeathConsulSiteState,state:'OPEN'|'CLOSED',a:ActionEvidence):boolean {
  if(site.door.state==='BLOCKED'||site.door.state===state)return false;
  site.door.operations++;site.door.state=state;a.doorOperationSeconds=5;return true;
}
/** The same ordinary route is usable after either a spell or a blocked-door fallback. */
export function deathConsulOrdinaryExitMetres(site:DeathConsulSiteState):2|4|8 {
  if(site.ordinaryExit!=='OPEN'||!['NEAR','OTHER'].includes(site.playerLocation))throw new Error('当前位置或普通出口不符。');
  return site.playerLocation==='NEAR'?2:site.door.state==='OPEN'?4:8;
}
export function leaveDeathConsulCombatSite(site:DeathConsulSiteState):2|4|8 {
  const metres=deathConsulOrdinaryExitMetres(site);stopDeathConsulEffects(site);site.playerLocation='ENTRY';site.playerMetres+=metres;advanceDeathConsulTime(site,metres);return metres;
}
export function currentDeathConsulCombatSource(s:SliceState):DeathConsulCombatSource|null {
  if(!hasDeathConsulDisputeOpponent(s))return null;const e=s.deathConsul.encounter,c=s.combat!,stats=s.character.coreStats,target=DEATH_CONSUL_TARGETS[e.sourceEra!];
  return {runId:s.runId,revision:s.revision,week:s.week,round:c.round,encounterId:'DEATH_CONSUL_DISPUTE',targetId:target.id,sourceEra:e.sourceEra!,
    attemptWeek:e.attemptWeek!,startHistoryIndex:e.startHistoryIndex!,targetName:target.name,targetAge:target.age,targetSequence:3,targetCore:24,actualContemporaryBody:true,independentMind:true,
    enemyWeapon:target.weaponId,weaponLocation:'HAND',enemyLocation:'OTHER',distanceMetres:s.deathConsul.life.site.playerLocation==='NEAR'?2:0,ordinaryExit:true,pursuit:false,thirdPartiesInArea:0,automaticAllyImmunity:false,
    site:structuredClone(s.deathConsul.life.site),playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,
    enemyHealth:c.enemyHealth,enemyMind:c.enemyMind,enemySpirituality:e.enemySpirituality,playerInjuries:structuredClone(s.injuries),enemyInjuries:structuredClone(c.enemyInjuries),playerRisk:s.injuryRisk,enemyRisk:c.enemyRisk,
    clubHeld:s.town.clubLocation==='HAND',physique:stats.physique,perception:stats.perception,knowledge:stats.knowledge,will:stats.will,
    sealMastery:s.progression.mastery[SEAL]??0,deadWordsMastery:s.progression.mastery[WORDS]??0,powerUses:{...e.powerUses},randomSeed:s.random.seed,randomCursor:s.random.cursor};
}
function makeRuntime(x:DeathConsulCombatSource):Runtime{return{playerS:x.playerSpirituality,enemyS:x.enemySpirituality,powers:{...x.powerUses},site:structuredClone(x.site),doorClosed:false,playerDoorOpened:false,passageAttempted:false,steadyAttempted:false,passage:null,steady:null};}
function liveState(s:SliceState):string{const e=s.deathConsul.encounter;return stableStringify({spirituality:s.spirituality,enemySpirituality:e.enemySpirituality,powerUses:e.powerUses,site:s.deathConsul.life.site});}
const dynamicSource=new Set(['playerSpirituality','enemySpirituality','powerUses','site','distanceMetres']);
function validRound(s:SliceState,r:DeathConsulRoundContext,supplied:DeathConsulCombatSource|null):boolean {
  const actual=currentDeathConsulCombatSource(s);return!r.finished&&actual!==null&&supplied!==null&&same(supplied,r.source)&&r.liveState===liveState(s)&&
    Object.entries(r.source).every(([key,value])=>dynamicSource.has(key)||same(actual[key as keyof DeathConsulCombatSource],value));
}
export function beginDeathConsulCombatRound(s:SliceState,stance:SliceStance,random:ActionRandomStream):DeathConsulRoundContext {
  const source=currentDeathConsulCombatSource(s);if(!['ATTACK','DEFEND','CONTROL','PREPARE','RETREAT'].includes(stance)||!source||!validSource(source)||random.seed!==source.randomSeed||random.cursor!==source.randomCursor)throw new Error('缺少当前封存室、真实对手或资源来源。');
  return{source,stance,finished:false,liveState:liveState(s),runtime:makeRuntime(source),playerActions:[],enemyActions:[],outcome:null,label:roundOpening(source)};
}
export const createDeathConsulCombatRound=beginDeathConsulCombatRound;
function actionBase(r:Runtime,order:number,physical:number,cursor:number):ActionEvidence {
  return{...none(''),order,atSeconds:r.site.elapsedSeconds,elapsedSeconds:5,paidCost:0,physicalFactor:physical,rolls:[],randomCursorBefore:cursor,randomCursorAfter:cursor,
    playerSpiritualityAfter:r.playerS,enemySpiritualityAfter:r.enemyS,siteBefore:structuredClone(r.site),siteAfter:structuredClone(r.site),doorOperationSeconds:0,passageMetres:0,
    chargeGranted:false,chargeConsumedByOrder:null,appliedAmount:0,consumedPassageOrder:null,consumedSteadyOrder:null};
}
function closeAction<T extends ActionEvidence>(x:DeathConsulCombatSource,a:T,r:Runtime,random:ActionRandomStream):T {
  advanceDeathConsulTime(r.site,5);a.siteAfter=structuredClone(r.site);a.randomCursorAfter=random.cursor;a.playerSpiritualityAfter=r.playerS;a.enemySpiritualityAfter=r.enemyS;
  a.label+=` 这次动作耗时5秒；你余${r.playerS}灵性，${x.targetName}余${r.enemyS}灵性。门${r.site.door.state==='OPEN'?'开启':r.site.door.state==='CLOSED'?'关闭':'受阻'}，你在${r.site.playerLocation==='NEAR'?'近端':'另一侧'}。`;return a;
}
function playerAction(x:DeathConsulCombatSource,r:Runtime,id:DeathConsulMoveId,physical:number,order:number,random:ActionRandomStream):DeathConsulPlayerAction {
  const a:DeathConsulPlayerAction={...actionBase(r,order,physical,random.cursor),id,attempted:false,succeeded:false,applied:false,fallback:'NONE'};
  const strike=(why:string)=>{
    if(r.site.playerLocation==='NEAR'&&!hasClearRoute(r.site)){
      a.fallback='OBSERVE';if(r.site.door.state==='CLOSED'){r.playerDoorOpened=true;operateDoor(r.site,'OPEN',a);a.fallback='DOOR_OPEN';}
      a.label=why+(a.fallback==='DOOR_OPEN'?'门挡在你和对手之间，你用这次动作普通开门，没有攻击，不消耗灵性。':'门受到阻塞，你用这次动作普通观察，没有跨门攻击或消耗灵性。');return;
    }
    a.fallback='STRIKE';a.selfGain=(x.clubHeld?16:12)*physical;a.threatens=a.selfGain>0;a.label=why+`你改用${x.clubHeld?'手中的棍':'自己的身体'}普通打击，优势${a.selfGain}，不消耗灵性。`;
  };
  const evade=(why:string)=>{a.fallback='EVADE';a.enemyReduction=10;a.label=why+'你普通避让，减势10，不消耗灵性。';};
  if(id==='ACCIDENT'){a.selfGain=-22.5;a.label='你判断失误，优势−22.5。';}
  else if(id==='EVADE'){a.enemyReduction=10;a.label='你在封存室内普通避让，减势10，不消耗灵性。';}
  else if(id===PASSAGE&&r.passageAttempted){evade('本轮灵界短渡已经尝试过；');}
  else if((id===FLAME||id===PASSAGE)&&!hasClearRoute(r.site)){
    a.fallback='OBSERVE';
    if(r.site.door.state==='CLOSED'){r.playerDoorOpened=true;operateDoor(r.site,'OPEN',a);a.fallback='DOOR_OPEN';}
    a.label=a.fallback==='DOOR_OPEN'?'门挡住了路径。你用这次动作普通开门，没有施法、掷能力骰或攻击，也不消耗灵性。':'门仍受阻。你用这次动作观察，没有施法、掷能力骰或攻击，也不消耗灵性。';
  }else{
    const flame=id===FLAME,passage=id===PASSAGE,seal=id===SEAL,cost=flame?7:6;
    if(r.playerS<cost){if(flame||id===WORDS)strike(`不足${cost}灵性，未施法。`);else evade(`不足${cost}灵性，未施法。`);}
    else{
      r.playerS-=cost;a.paidCost=cost;a.attempted=true;if(passage)r.passageAttempted=true;
      const ability=passage||seal?'knowledge':'will',difficulty=flame||passage?20:16,roll=random.nextInt(1,100);a.rolls.push(roll);
      a.succeeded=roll<=computeCheckChance({ability,baseAbility:x[ability],difficulty,modifiers:[]});
      const name=flame?'苍白焰':passage?'灵界短渡':seal?'冥界借力封印':'死者之语';
      a.label=`${name}耗费${cost}灵性，${ability==='knowledge'?'知识':'意志'}检验${roll}${a.succeeded?'成功':'失败，费用已付'}。`;
      if(a.succeeded){
        a.applied=true;
        if(passage){
          const from=r.site.playerLocation;r.site.playerLocation=from==='NEAR'?'OTHER':'NEAR';r.site.playerPassageMetres+=2;a.passageMetres=2;
          r.site.effect={mode:'PASSAGE',expiresAt:r.site.elapsedSeconds+5};a.chargeGranted=true;r.passage=a;
          a.label+=`你本人从${from==='NEAR'?'近端':'另一侧'}实际短渡2米到${r.site.playerLocation==='NEAR'?'近端':'另一侧'}；本轮仅可削弱随后一次真正的持棍身体攻击40，目前减免为0。苍白法术不会触发或消耗这次准备。`;
        }else{
          a.selfGain=flame?105:seal?0:38*mastery(x.deadWordsMastery);a.enemyReduction=seal?20*mastery(x.sealMastery):0;a.threatens=a.selfGain>0;
          if(flame)r.site.effect={mode:'PALE_FLAME',expiresAt:r.site.elapsedSeconds+5};
          if(seal&&r.steady){const steady=r.steady,amount=Math.min(32,a.enemyReduction);a.enemyReduction-=amount;steady.appliedAmount=amount;steady.chargeConsumedByOrder=order;a.consumedSteadyOrder=steady.order;r.steady=null;
            steady.label+=` 随后在第${order+1}次动作中实际抵住旧封印${amount}。`;a.label+=` ${x.targetName}先前付费的定神在此时消耗一次，抵住牵制${amount}。`;}
          a.label+=` 本次优势${a.selfGain}、减势${a.enemyReduction}。`;
        }
      }else if(passage)a.label+='本人没有移动，本轮尝试次数已经用去。';
    }
  }
  return closeAction(x,a,r,random);
}
function enemyAction(x:DeathConsulCombatSource,r:Runtime,planned:DeathConsulEnemyIntent,physical:number,order:number,random:ActionRandomStream):DeathConsulEnemyAction {
  const a:DeathConsulEnemyAction={...actionBase(r,order,physical,random.cursor),planned,actual:planned,doorChanged:false};
  if(planned==='PALE_STRIKE'&&(r.enemyS<5||!hasClearRoute(r.site))||planned==='STEADY'&&r.enemyS<4)a.actual='BODY_STRIKE';
  if(planned==='STEADY'&&r.steadyAttempted||planned==='CLOSE_DOOR'&&r.site.door.state!=='OPEN')a.actual='OBSERVE';
  if(a.actual==='BODY_STRIKE'&&r.site.playerLocation==='NEAR'&&!hasClearRoute(r.site))a.actual=r.site.door.state==='CLOSED'?'OPEN_DOOR':'OBSERVE';
  if(a.actual==='PALE_STRIKE'){
    r.enemyS-=5;r.powers.PALE_STRIKE++;a.paidCost=5;a.selfGain=75;a.threatens=true;a.label=`${x.targetName}耗费5灵性，沿开启的路径施放苍白法术，优势75。短渡后的避让准备不能抵挡这次法术，也没有被消耗。`;
  }else if(a.actual==='STEADY'){
    r.enemyS-=4;r.powers.STEADY++;r.steadyAttempted=true;a.paidCost=4;a.chargeGranted=true;r.steady=a;
    a.label=`${x.targetName}耗费4灵性定神，只抵本轮下一次真正成功的旧封印牵制，最多32；当前抵消为0，不抵短渡移动或攻击。`;
  }else if(a.actual==='CLOSE_DOOR'){
    r.doorClosed=true;r.powers.CLOSE_DOOR++;a.doorChanged=operateDoor(r.site,'CLOSED',a);
    a.label=`${x.targetName}用这次动作普通关门，耗时5秒；不消耗灵性，也没有攻击。普通绕行出口仍可使用。`;
  }else if(a.actual==='OPEN_DOOR'){
    a.doorChanged=operateDoor(r.site,'OPEN',a);a.label=`门隔开了你和${x.targetName}。对手用这次动作普通开门，耗时5秒，没有攻击或灵性支出，也没有消耗你短渡后的避让准备。`;
  }else if(a.actual==='BODY_STRIKE'){
    a.selfGain=20*physical;a.threatens=a.selfGain>0;a.label=`${planned!=='BODY_STRIKE'?'路径受阻或灵性不足，改用普通动作。':''}${x.targetName}持自己的棍打击，优势${a.selfGain}，不消耗灵性。`;
    if(r.passage){const passage=r.passage;passage.enemyReduction=40;passage.appliedAmount=40;passage.chargeConsumedByOrder=order;a.consumedPassageOrder=passage.order;r.passage=null;
      passage.label+=` 随后在第${order+1}次动作中实际削弱持棍攻击40。`;a.label+='你先前短渡后保留的一次避让在此刻消耗，实际减势40；仍按真实身体伤势判定结果。';}
  }else if(a.actual==='OBSERVE')a.label=planned==='STEADY'&&r.steadyAttempted?`${x.targetName}本轮已经定神一次，这次只普通观察。`:planned==='CLOSE_DOOR'?`门已关闭或受阻；${x.targetName}这次只普通观察，没有攻击。`:`门被阻塞，${x.targetName}无法跨门持棍打击，这次只普通观察，没有攻击，也没有消耗你短渡后的避让准备。`;
  else{a.selfGain=-22.5;a.label=`${x.targetName}判断失误，优势−22.5。`;}
  return closeAction(x,a,r,random);
}
function commitRuntime(s:SliceState,r:DeathConsulRoundContext):void {
  s.spirituality=r.runtime.playerS;s.deathConsul.encounter.enemySpirituality=r.runtime.enemyS;s.deathConsul.encounter.powerUses={...r.runtime.powers};
  s.deathConsul.life.site=structuredClone(r.runtime.site);r.liveState=liveState(s);
}
export function resolveDeathConsulCombatAbility(s:SliceState,id:DeathConsulMoveId,physical:number,random:ActionRandomStream,r:DeathConsulRoundContext,source:DeathConsulCombatSource|null=r.source):DeathConsulCombatEffect {
  if(!validRound(s,r,source)||r.playerActions.length>=6||physical!==physicalAt(r.source.playerHealth)||random.seed!==r.source.randomSeed||!ABILITIES.some(a=>a.id===id))return none('当前人物、现场或资源不符，未执行动作。');
  const a=playerAction(r.source,r.runtime,id,physical,r.playerActions.length+r.enemyActions.length,random);r.playerActions.push(a);commitRuntime(s,r);return{label:a.label,selfGain:a.selfGain,enemyReduction:a.enemyReduction,threatens:a.threatens,mentalPressure:false};
}
export function resolveDeathConsulEnemyAbility(s:SliceState,planned:DeathConsulEnemyIntent,physical:number,random:ActionRandomStream,r:DeathConsulRoundContext,source:DeathConsulCombatSource|null=r.source):DeathConsulCombatEffect {
  if(!validRound(s,r,source)||r.enemyActions.length>=6||physical!==physicalAt(r.source.enemyHealth)||random.seed!==r.source.randomSeed||![...DEATH_CONSUL_POWER_IDS,'BODY_STRIKE','ACCIDENT'].includes(planned))return none('对手、棍或当前资源不符，未执行动作。');
  const a=enemyAction(r.source,r.runtime,planned,physical,r.playerActions.length+r.enemyActions.length,random);r.enemyActions.push(a);commitRuntime(s,r);return{label:a.label,selfGain:a.selfGain,enemyReduction:a.enemyReduction,threatens:a.threatens,mentalPressure:false};
}
export interface DeathConsulRoundOutcome {
  targetId:DeathConsulTargetId;round:number;source:DeathConsulCombatSource;stance:SliceStance;continuing:boolean;
  enemyHealth:number;enemyMind:number;enemySpirituality:number;enemyStatus:'RESISTING'|'SURRENDERED'|'DEAD';
  playerSpiritualityBefore:number;playerSpiritualityAfter:number;playerHealthAfter:number;playerMindAfter:number;enemySpiritualityBefore:number;
  playerInjuriesAfter:SliceInjury[];enemyInjuriesAfter:SliceInjury[];playerRiskAfter:number;enemyRiskAfter:number;
  powerUses:Record<DeathConsulPowerId,number>;doorClosed:boolean;playerDoorOpened:boolean;passageAttempted:boolean;steadyAttempted:boolean;
  expiredPassageChargeOrder:number|null;expiredSteadyChargeOrder:number|null;siteAfter:DeathConsulSiteState;elapsedSeconds:60|62|64|68;exitMetres:0|2|4|8;randomCursorAfter:number;
  playerActions:DeathConsulPlayerAction[];enemyActions:DeathConsulEnemyAction[];
}
export function finishDeathConsulCombatRound(s:SliceState,r:DeathConsulRoundContext,continuing=true,randomCursorAfter=s.random.cursor):DeathConsulRoundOutcome {
  const e=s.deathConsul.encounter,c=s.combat;
  if(r.finished||!c||c.encounterId!=='DEATH_CONSUL_DISPUTE'||c.round!==r.source.round||r.liveState!==liveState(s))throw new Error('这个回合已结束，或现场资源发生了变化。');
  e.enemyHealth=c.enemyHealth;e.enemyMind=c.enemyMind;e.enemyStatus=c.enemyStatus;e.enemyInjuries=structuredClone(c.enemyInjuries);e.enemyRisk=c.enemyRisk;if(e.enemyStatus!=='RESISTING')e.weaponLocation='OTHER';
  const site=s.deathConsul.life.site;advanceDeathConsulTime(site,r.source.site.elapsedSeconds+60-site.elapsedSeconds);stopDeathConsulEffects(site);
  const exitMetres=!continuing&&s.health>0?leaveDeathConsulCombatSite(site):0;const elapsedSeconds=(60+exitMetres) as 60|62|64|68;r.finished=true;
  r.outcome={targetId:r.source.targetId,round:c.round,source:structuredClone(r.source),stance:r.stance,continuing,
    enemyHealth:c.enemyHealth,enemyMind:c.enemyMind,enemySpirituality:e.enemySpirituality,enemyStatus:c.enemyStatus,
    playerSpiritualityBefore:r.source.playerSpirituality,playerSpiritualityAfter:s.spirituality,playerHealthAfter:s.health,playerMindAfter:s.mind,enemySpiritualityBefore:r.source.enemySpirituality,
    playerInjuriesAfter:structuredClone(s.injuries),enemyInjuriesAfter:structuredClone(c.enemyInjuries),playerRiskAfter:s.injuryRisk,enemyRiskAfter:c.enemyRisk,
    powerUses:{...e.powerUses},doorClosed:r.runtime.doorClosed,playerDoorOpened:r.runtime.playerDoorOpened,passageAttempted:r.runtime.passageAttempted,steadyAttempted:r.runtime.steadyAttempted,
    expiredPassageChargeOrder:r.runtime.passage?.order??null,expiredSteadyChargeOrder:r.runtime.steady?.order??null,siteAfter:structuredClone(site),elapsedSeconds,exitMetres,randomCursorAfter,
    playerActions:structuredClone(r.playerActions),enemyActions:structuredClone(r.enemyActions)};return structuredClone(r.outcome);
}
export function deathConsulRoundOutcome(r:DeathConsulRoundContext):DeathConsulRoundOutcome{if(!r.outcome)throw new Error('回合尚未结束。');return structuredClone(r.outcome);}
export function projectDeathConsulCombat(s:SliceState){
  const e=s.deathConsul.encounter,visible=isDeathConsul(s),target=e.sourceEra?DEATH_CONSUL_TARGETS[e.sourceEra]:null,last=s.combat?.encounterId==='DEATH_CONSUL_DISPUTE'?s.combat.lastRound?.deathConsulOutcome:e.terminal?s.combatHistory[e.terminal.historyIndex]?.deathConsulOutcome:null;
  return{enemyName:visible&&target?`${target.name}（${target.age}岁）`:'',targetId:visible?e.targetId:null,playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,maxSpirituality:120,
    enemyHealth:visible?e.enemyHealth:null,enemyMind:visible?e.enemyMind:null,enemySpirituality:visible?e.enemySpirituality:null,powerUses:visible?{...e.powerUses}:null,
    site:visible?structuredClone(s.deathConsul.life.site):null,startSite:visible?structuredClone(e.startSite):null,originalExit:true,pursuit:false,distanceMetres:visible&&s.deathConsul.life.site.playerLocation==='OTHER'?0:2,automaticAllyImmunity:false,
    source:visible?currentDeathConsulCombatSource(s):null,lastActionSequence:visible&&last?[...last.playerActions.map(a=>({...structuredClone(a),actor:'PLAYER' as const})),...last.enemyActions.map(a=>({...structuredClone(a),actor:'ENEMY' as const}))].sort((a,b)=>a.order-b.order):[],
    countWheel:DEATH_CONSUL_COUNT_WHEEL.map(x=>({...x})),enemyCountWheel:DEATH_CONSUL_ENEMY_COUNT_WHEEL.map(x=>({...x})),enemyAbilityWheel:DEATH_CONSUL_ENEMY_ABILITY_WHEEL.map(x=>({...x})),
    summary:visible?'苍白焰须开门清路；灵界短渡每轮最多付费尝试一次，成功时本人在门两侧实际移动2米，并仅削弱随后一次实际持棍攻击40，不抵苍白法术。对手定神只抵下一次成功旧封印，最多32。关门、开门各占一次普通动作，不附带攻击。每次动作5秒、每回合60秒，双方各付自己的灵性；对手不自动恢复，继续时你恢复12灵性。实际伤势、门和封存物痕迹保留，战斗不增长掌握。':''};
}
const SOURCE_KEYS=['runId','revision','week','round','encounterId','targetId','sourceEra','attemptWeek','startHistoryIndex','targetName','targetAge','targetSequence','targetCore','actualContemporaryBody','independentMind','enemyWeapon','weaponLocation','enemyLocation','distanceMetres','ordinaryExit','pursuit','thirdPartiesInArea','automaticAllyImmunity','site','playerHealth','playerMind','playerSpirituality','enemyHealth','enemyMind','enemySpirituality','playerInjuries','enemyInjuries','playerRisk','enemyRisk','clubHeld','physique','perception','knowledge','will','sealMastery','deadWordsMastery','powerUses','randomSeed','randomCursor'] as const;
function validInjuries(v:SliceInjury[],revision:number):boolean {
  return Array.isArray(v)&&new Set(v.map(i=>i.id)).size===v.length&&v.every(i=>shape(i,['id','severity','acquiredRevision','treatedRevision'])&&typeof i.id==='string'&&i.id.length>0&&['LIGHT','HEAVY'].includes(i.severity)&&integer(i.acquiredRevision,1,revision)&&(i.treatedRevision===null||integer(i.treatedRevision,i.acquiredRevision,revision)));
}
function validSource(x:DeathConsulCombatSource):boolean {
  if(!shape(x,SOURCE_KEYS)||!['ORIGINAL','POST_CYCLE'].includes(x.sourceEra))return false;const target=DEATH_CONSUL_TARGETS[x.sourceEra];
  return typeof x.runId==='string'&&x.runId.length>0&&integer(x.revision)&&integer(x.week,1)&&integer(x.round,1)&&integer(x.startHistoryIndex)&&x.attemptWeek===x.week&&
    x.encounterId==='DEATH_CONSUL_DISPUTE'&&x.targetId===target.id&&x.targetName===target.name&&x.targetAge===target.age&&x.targetSequence===3&&x.targetCore===24&&x.actualContemporaryBody===true&&x.independentMind===true&&
    x.enemyWeapon===target.weaponId&&x.weaponLocation==='HAND'&&x.enemyLocation==='OTHER'&&x.distanceMetres===(x.site.playerLocation==='NEAR'?2:0)&&x.ordinaryExit===true&&x.pursuit===false&&x.thirdPartiesInArea===0&&x.automaticAllyImmunity===false&&
    validateDeathConsulSiteState(x.site)&&x.site.sourceEra===x.sourceEra&&integer(x.site.introducedWeek,1,x.week)&&['NEAR','OTHER'].includes(x.site.playerLocation)&&x.site.operatorLocation==='OUTSIDE'&&x.site.ordinaryExit==='OPEN'&&x.site.effect.mode==='OFF'&&x.site.operatorConsent==='GRANTED'&&x.site.operatorConsentWeek===x.week&&
    x.site.residual.location==='ENTRY_STAND'&&x.site.residual.container==='CLOSED'&&x.site.residual.seal!=='BROKEN'&&x.site.residual.heatSeconds===0&&
    [x.playerHealth,x.playerMind,x.enemyHealth,x.enemyMind].every(n=>integer(n,1,100))&&x.enemyMind===100&&[x.playerSpirituality,x.enemySpirituality].every(n=>integer(n,0,120))&&
    [x.physique,x.perception,x.knowledge,x.will,x.sealMastery,x.deadWordsMastery].every(n=>integer(n,0,500))&&typeof x.clubHeld==='boolean'&&integer(x.playerRisk)&&integer(x.enemyRisk)&&
    validInjuries(x.playerInjuries,x.revision)&&validInjuries(x.enemyInjuries,x.revision)&&shape(x.powerUses,DEATH_CONSUL_POWER_IDS)&&DEATH_CONSUL_POWER_IDS.every(id=>integer(x.powerUses[id]))&&x.powerUses.CLOSE_DOOR<=6*(x.round-1)&&x.powerUses.STEADY<=x.round-1&&
    x.enemySpirituality===120-DEATH_CONSUL_POWERS.reduce((n,p)=>n+p.cost*x.powerUses[p.id],0)&&typeof x.randomSeed==='string'&&x.randomSeed.length>0&&x.randomSeed.length<=256&&integer(x.randomCursor);
}
/** Exact inherited common formulas, applied to immutable historical source rather than later live stats. */
function sourcePenalty(current:number,maximum:number):number {const f=Math.max(0,Math.min(1,current/maximum));return f>.75?0:f>.5?.05:f>.25?.1:.2;}
function sourceBase(core:number,health:number,mind:number,spirituality:number):number {return(1250+Math.min(core,250))*(1-Math.min(.4,sourcePenalty(health,100)+sourcePenalty(mind,100)+sourcePenalty(spirituality,120)));}
function sourceWeights(risk:number):{light:number;heavy:number;death:number}{const death=Math.min(100,5+Math.min(risk,10)*10),shifted=death-5;return{light:Math.max(0,65-shifted),heavy:Math.max(0,30-Math.max(0,shifted-65)),death};}
interface ReplayedRound {outcome:DeathConsulRoundOutcome;playerCount:number;enemyCount:number;playerCountRoll:number;enemyCountRoll:number;first:'PLAYER'|'ENEMY';retreat:'NONE'|'SUCCESS'|'FAILURE';winner:'PLAYER'|'ENEMY';playerAdvantage:number;enemyAdvantage:number;winChance:number;consequenceWeights:{light:number;heavy:number;death:number}|null;consequenceRoll?:number}
function replayOutcome(o:DeathConsulRoundOutcome):ReplayedRound|null {
  const x=o?.source;if(!x||!validSource(x)||!['ATTACK','DEFEND','CONTROL','PREPARE','RETREAT'].includes(o.stance)||!Array.isArray(o.playerActions)||!Array.isArray(o.enemyActions)||o.playerActions.length>6||o.enemyActions.length>6)return null;
  const rng=new DeterministicActionRandomStream(x.randomSeed,x.randomCursor),r=makeRuntime(x),playerCountRoll=rng.nextInt(1,100),enemyCountRoll=rng.nextInt(1,100),playerCount=deathConsulActionCount(playerCountRoll),enemyCount=deathConsulEnemyActionCount(enemyCountRoll);
  const first=x.round%2===1?'PLAYER':'ENEMY',order=first==='PLAYER'?['PLAYER','ENEMY'] as const:['ENEMY','PLAYER'] as const,remaining={PLAYER:playerCount,ENEMY:enemyCount};
  const players:DeathConsulPlayerAction[]=[],enemies:DeathConsulEnemyAction[]=[];let retreat:ReplayedRound['retreat']='NONE';
  while(remaining.PLAYER>0||remaining.ENEMY>0){for(const actor of order){if(remaining[actor]===0)continue;if(actor==='PLAYER'&&o.stance==='RETREAT'){remaining.PLAYER=0;retreat=rng.nextInt(1,100)<=50?'SUCCESS':'FAILURE';if(retreat==='SUCCESS'){remaining.ENEMY=0;break;}continue;}remaining[actor]--;
    if(actor==='PLAYER')players.push(playerAction(x,r,drawPlayer(rng,o.stance),physicalAt(x.playerHealth),players.length+enemies.length,rng));else enemies.push(enemyAction(x,r,drawDeathConsulEnemyAbility(rng),physicalAt(x.enemyHealth),players.length+enemies.length,rng));}}
  if(!same(players,o.playerActions)||!same(enemies,o.enemyActions))return null;
  const sum=(actions:{selfGain:number;enemyReduction:number}[],key:'selfGain'|'enemyReduction')=>actions.reduce((n,a)=>n+a[key],0);
  const playerAdvantage=Math.max(125,sourceBase(x.physique*.35+x.perception*.25+x.will*.25+x.knowledge*.15,x.playerHealth,x.playerMind,x.playerSpirituality)+sum(players,'selfGain')-sum(enemies,'enemyReduction'));
  const enemyAdvantage=Math.max(125,sourceBase(24,x.enemyHealth,x.enemyMind,x.enemySpirituality)+sum(enemies,'selfGain')-sum(players,'enemyReduction')),winChance=playerAdvantage/(playerAdvantage+enemyAdvantage)*100;
  const winner=retreat==='SUCCESS'?'ENEMY':rng.nextInt(1,1_000_000)<=winChance*10_000?'PLAYER':'ENEMY';
  let playerHealth=x.playerHealth,enemyHealth=x.enemyHealth,playerRisk=x.playerRisk,enemyRisk=x.enemyRisk,enemyStatus:DeathConsulRoundOutcome['enemyStatus']='RESISTING',continuing=retreat!=='SUCCESS';
  const playerInjuries=structuredClone(x.playerInjuries),enemyInjuries=structuredClone(x.enemyInjuries);let consequenceWeights:ReplayedRound['consequenceWeights']=null,consequenceRoll:number|undefined;
  if(retreat!=='SUCCESS'){const loser=winner==='PLAYER'?'ENEMY':'PLAYER',injuries=loser==='PLAYER'?playerInjuries:enemyInjuries;let risk=loser==='PLAYER'?playerRisk:enemyRisk;if(injuries.length)risk++;if(loser==='PLAYER')playerRisk=risk;else enemyRisk=risk;
    if(loser==='PLAYER'?enemies.some(a=>a.threatens):players.some(a=>a.threatens)){consequenceWeights=sourceWeights(risk);consequenceRoll=rng.nextInt(1,100);const severity=consequenceRoll<=consequenceWeights.light?'LIGHT':consequenceRoll<=consequenceWeights.light+consequenceWeights.heavy?'HEAVY':'DEATH';
      if(severity==='DEATH'){if(loser==='PLAYER')playerHealth=0;else{enemyHealth=0;enemyStatus='DEAD';}continuing=false;}
      else{injuries.push({id:`${x.runId}:combat:${x.round}:${loser}:${x.revision+1}:${injuries.length}`,severity,acquiredRevision:x.revision+1,treatedRevision:null});const damage=severity==='LIGHT'?10:30;if(loser==='PLAYER')playerHealth=Math.max(0,playerHealth-damage);else enemyHealth=Math.max(0,enemyHealth-damage);
        if(playerHealth===0||enemyHealth===0){if(enemyHealth===0)enemyStatus='DEAD';continuing=false;}else if(loser==='ENEMY'&&severity==='HEAVY'){enemyStatus='SURRENDERED';continuing=false;}}}}
  advanceDeathConsulTime(r.site,x.site.elapsedSeconds+60-r.site.elapsedSeconds);stopDeathConsulEffects(r.site);const exitMetres=!continuing&&playerHealth>0?leaveDeathConsulCombatSite(r.site):0,elapsedSeconds=(60+exitMetres) as 60|62|64|68;
  const expected:DeathConsulRoundOutcome={targetId:x.targetId,round:x.round,source:structuredClone(x),stance:o.stance,continuing,enemyHealth,enemyMind:x.enemyMind,enemySpirituality:r.enemyS,enemyStatus,
    playerSpiritualityBefore:x.playerSpirituality,playerSpiritualityAfter:r.playerS,playerHealthAfter:playerHealth,playerMindAfter:x.playerMind,enemySpiritualityBefore:x.enemySpirituality,
    playerInjuriesAfter:playerInjuries,enemyInjuriesAfter:enemyInjuries,playerRiskAfter:playerRisk,enemyRiskAfter:enemyRisk,powerUses:r.powers,doorClosed:r.doorClosed,playerDoorOpened:r.playerDoorOpened,passageAttempted:r.passageAttempted,steadyAttempted:r.steadyAttempted,
    expiredPassageChargeOrder:r.passage?.order??null,expiredSteadyChargeOrder:r.steady?.order??null,siteAfter:r.site,elapsedSeconds,exitMetres,randomCursorAfter:rng.cursor,playerActions:players,enemyActions:enemies};
  if(!same(o,expected))return null;return{outcome:expected,playerCount,enemyCount,playerCountRoll,enemyCountRoll,first,retreat,winner,playerAdvantage,enemyAdvantage,winChance,consequenceWeights,...(consequenceRoll===undefined?{}:{consequenceRoll})};
}
export function validateDeathConsulRoundOutcome(value:unknown):value is DeathConsulRoundOutcome {try{return replayOutcome(value as DeathConsulRoundOutcome)!==null;}catch{return false;}}
export function validateDeathConsulCombatRound(round:SliceCombatRound):boolean {try{const o=round.deathConsulOutcome,replay=o?replayOutcome(o):null;if(!o||!replay||round.round!==o.round||round.stance!==o.stance||round.consequence!==deathConsulCombatConsequence(round)||!shape(round,['round','stance','first','playerCount','enemyCount','playerCountRoll','enemyCountRoll','moves','playerAdvantage','enemyAdvantage','winChance','winner','consequence','consequenceWeights','retreat','deathConsulOutcome',...(replay.consequenceRoll===undefined?[]:['consequenceRoll'])]))return false;
  for(const key of ['playerCount','enemyCount','playerCountRoll','enemyCountRoll','first','retreat','winner','playerAdvantage','enemyAdvantage','winChance','consequenceWeights','consequenceRoll'] as const)if(!same(round[key],replay[key]))return false;
  const moves=[...o.playerActions.map(a=>({...a,actor:'PLAYER' as const})),...o.enemyActions.map(a=>({...a,actor:'ENEMY' as const}))].sort((a,b)=>a.order-b.order).map(a=>({actor:a.actor,label:a.label,selfGain:a.selfGain,enemyReduction:a.enemyReduction}));return same(round.moves,moves);
}catch{return false;}}
function roundOpening(x:DeathConsulCombatSource):string {
  return `${x.targetAge}岁的${x.targetName}持自己的棍留在封存室另一侧，健康${x.enemyHealth}、精神100、灵性${x.enemySpirituality}。${x.site.operatorName}已沿普通通路退到室外；原封存物和门保留此前状态。你在${x.site.playerLocation==='NEAR'?'近端':'另一侧'}，与对手相距${x.distanceMetres}米。`;
}
/** Display text is derived from the same exact replay, never accepted as arbitrary saved prose. */
export function deathConsulCombatConsequence(round:SliceCombatRound):string {
  const o=round.deathConsulOutcome;if(!o)throw new Error('缺少死亡执政官回合结果。');let text:string;
  if(round.retreat==='SUCCESS')text=`你通过撤离判定，沿普通通路步行${o.exitMetres}米、耗时${o.exitMetres}秒回到入口。${o.source.targetName}仍留在自己的位置。`;
  else {
    const loser=round.winner==='PLAYER'?'ENEMY':'PLAYER',subject=loser==='PLAYER'?'你':o.source.targetName,risk=loser==='PLAYER'?o.playerRiskAfter:o.enemyRiskAfter;
    if(round.consequenceRoll===undefined)text=`${subject}本回合处于下风，但没有遭受实际致伤攻击，因此没有新增身体伤势。累计风险${risk}。`;
    else {
      const weights=round.consequenceWeights!,severity=round.consequenceRoll<=weights.light?'LIGHT':round.consequenceRoll<=weights.light+weights.heavy?'HEAVY':'DEATH';
      if(severity==='DEATH')text=`${subject}伤势检验${round.consequenceRoll}/100，伤势致命，身体留在封存室内的实际位置。`;
      else {text=`${subject}伤势检验${round.consequenceRoll}/100，受到${severity==='LIGHT'?'轻':'重'}伤，健康减少${severity==='LIGHT'?10:30}。`;
        if(o.playerHealthAfter===0||o.enemyHealth===0)text+='健康已降至0，伤者死亡。';else if(o.enemyStatus==='SURRENDERED')text+=`${o.source.targetName}因重伤停止抵抗，将自己的棍放在脚边。`;}
    }
    if(!o.continuing&&o.playerHealthAfter>0)text+=`你停止法术，沿普通通路步行${o.exitMetres}米、耗时${o.exitMetres}秒回到入口。`;
  }
  const passage=o.playerActions.reduce((n,a)=>n+a.appliedAmount,0),steady=o.enemyActions.reduce((n,a)=>n+a.appliedAmount,0);
  return roundOpening(o.source)+text+` 本轮短渡后的避让实际减势${passage}，对手定神实际抵住${steady}；未用的一次性准备随回合结束失效。伤势、灵性支出、门和原物痕迹保留。`;
}
