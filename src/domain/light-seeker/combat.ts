import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { LIGHT_SEEKER_TARGET_ID, LIGHT_SEEKER_POWER_IDS, LIGHT_SEEKER_POWERS, hasLightSeekerDisputeOpponent,
  type LightSeekerEnemyIntent, type LightSeekerPowerId } from './encounter.js';
import { validateLightSeekerSiteState, advanceLightSeekerTime, stopLightSeekerLight, type LightSeekerSiteState } from './resources.js';

/** Original finite gallery mechanics. Numerical limits are game design, not assertions about canonical powers. */
export const LIGHT_SEEKER_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const LIGHT_SEEKER_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const lightSeekerActionCount = pyromaniacActionCount;
export const lightSeekerEnemyActionCount = pyromaniacActionCount;
const GUIDED = 'sun.s2.guided-radiance', LIMITED = 'sun.s2.limited-light';
const DOMAIN = 'sun.s4.unshadowed-domain', PURIFICATION = 'sun.s4.purification';
export type LightSeekerMoveId = typeof GUIDED | typeof LIMITED | typeof DOMAIN | typeof PURIFICATION | 'EVADE' | 'ACCIDENT';
const ABILITIES: readonly { id: LightSeekerMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: GUIDED, label: '引导光辉（7灵性/意志20，通线成功优势105）', weight: 25, stance: 'ATTACK' },
  { id: LIMITED, label: '限制光照（6灵性/知识20，本轮一次尝试；成功后抵下一次有效光击45）', weight: 20, stance: 'CONTROL' },
  { id: DOMAIN, label: '无暗领域（5灵性/意志16，减势18×既有掌握）', weight: 15, stance: 'DEFEND' },
  { id: PURIFICATION, label: '净化光（6灵性/意志18，优势34×既有掌握）', weight: 20, stance: 'CONTROL' },
  { id: 'EVADE', label: '普通避让（0灵性，减势10）', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断偏差（优势−22.5）', weight: 5, stance: null },
];
export const LIGHT_SEEKER_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'LIGHT_STRIKE', label: '光击：7灵性，通线时优势105', weight: 35 },
  { id: 'LIGHT_WARD', label: '防光：6灵性，本轮一次抵下次有效光照最多60', weight: 25 },
  { id: 'BODY_STRIKE', label: '持棍打击：20×身体状态', weight: 20 },
  { id: 'SHUTTER_CLOSE', label: '关闭遮板：0灵性，每轮一次，耗时2秒、磨损1', weight: 15 },
  { id: 'ACCIDENT', label: '判断偏差：优势−22.5', weight: 5 },
];
export const isLightSeeker = (s: SliceState): boolean => s.progression.pathwayId === 'sun' && s.progression.sequence === 2;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function lightSeekerAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a,b) => a+b,0);
  return ABILITIES.map((a,i) => ({ id:a.id,label:a.label,weight:weights[i]!/total*100 }));
}
function drawPlayer(random: ActionRandomStream, stance: SliceStance | null): LightSeekerMoveId {
  const weights=tickets(stance);let n=random.nextInt(1,weights.reduce((a,b)=>a+b,0));
  for(const [i,a] of ABILITIES.entries()){n-=weights[i]!;if(n<=0)return a.id;}throw new Error('逐光者行动盘无效。');
}
export function drawLightSeekerAbility(random:ActionRandomStream,_s:SliceState,stance:SliceStance|null):LightSeekerMoveId{return drawPlayer(random,stance);}
export function drawLightSeekerEnemyAbility(random:ActionRandomStream):LightSeekerEnemyIntent {
  let n=random.nextInt(1,100);for(const a of LIGHT_SEEKER_ENEMY_ABILITY_WHEEL){n-=a.weight;if(n<=0)return a.id as LightSeekerEnemyIntent;}throw new Error('欧文的行动盘无效。');
}
export interface LightSeekerCombatSource {
  runId:string;revision:number;week:number;round:number;encounterId:'LIGHT_SEEKER_DISPUTE';targetId:typeof LIGHT_SEEKER_TARGET_ID;
  attemptWeek:number;startHistoryIndex:number;targetAge:51;targetSequence:2;targetCore:24;actualOriginalBody:true;independentMind:true;
  enemyWeapon:'LS2-OWEN-CLUB';weaponLocation:'HAND';distanceMetres:2;ordinaryExit:true;pursuit:false;
  thirdPartiesInArea:0;automaticAllyImmunity:false;site:LightSeekerSiteState;
  playerHealth:number;playerMind:number;playerSpirituality:number;enemyHealth:number;enemyMind:number;enemySpirituality:number;
  playerInjuries:SliceInjury[];enemyInjuries:SliceInjury[];playerRisk:number;enemyRisk:number;
  clubHeld:boolean;physique:number;perception:number;knowledge:number;will:number;domainMastery:number;purificationMastery:number;
  powerUses:Record<LightSeekerPowerId,number>;randomSeed:string;randomCursor:number;
}
export interface LightSeekerCombatEffect {label:string;selfGain:number;enemyReduction:number;threatens:boolean;mentalPressure:false}
interface ActionEvidence extends LightSeekerCombatEffect {
  order:number;atSeconds:number;elapsedSeconds:5;paidCost:number;physicalFactor:number;rolls:number[];
  randomCursorBefore:number;randomCursorAfter:number;playerSpiritualityAfter:number;enemySpiritualityAfter:number;
  siteBefore:LightSeekerSiteState;siteAfter:LightSeekerSiteState;shutterOperationSeconds:0|2;shutterWear:0|1;
  /** A paid successful setup is distinct from the later ordered action consuming it. */
  chargeGranted:boolean;chargeConsumedByOrder:number|null;appliedAmount:number;
  consumedLimitedOrder:number|null;consumedWardOrder:number|null;
}
export interface LightSeekerPlayerAction extends ActionEvidence {
  id:LightSeekerMoveId;attempted:boolean;succeeded:boolean;applied:boolean;fallback:'NONE'|'STRIKE'|'EVADE'|'OBSERVE'|'SHUTTER_OPEN';
}
export interface LightSeekerEnemyAction extends ActionEvidence {planned:LightSeekerEnemyIntent;actual:LightSeekerEnemyIntent|'OBSERVE';shutterChanged:boolean}
interface Runtime {
  playerS:number;enemyS:number;powers:Record<LightSeekerPowerId,number>;site:LightSeekerSiteState;
  shutterUsed:boolean;playerShutterOpened:boolean;limitedAttempted:boolean;wardAttempted:boolean;
  limited:LightSeekerPlayerAction|null;ward:LightSeekerEnemyAction|null;
}
export interface LightSeekerRoundContext {
  source:LightSeekerCombatSource;stance:SliceStance;finished:boolean;liveState:string;runtime:Runtime;
  playerActions:LightSeekerPlayerAction[];enemyActions:LightSeekerEnemyAction[];label:string;outcome:LightSeekerRoundOutcome|null;
}
const same=(a:unknown,b:unknown)=>a===b||(a!==undefined&&b!==undefined&&stableStringify(a)===stableStringify(b));
const integer=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER):n is number=>Number.isSafeInteger(n)&&(n as number)>=min&&(n as number)<=max;
const shape=(v:unknown,keys:readonly string[]):boolean=>!!v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...keys].sort());
const none=(label:string):LightSeekerCombatEffect=>({label,selfGain:0,enemyReduction:0,threatens:false,mentalPressure:false});
const physicalAt=(health:number):number=>health>75?1:health>50?.95:health>25?.9:.8;
const mastery=(n:number)=>.65+.35*Math.max(0,Math.min(500,n))/500;
const stopLight=stopLightSeekerLight;
const advanceSite=advanceLightSeekerTime;
/** The narrow opaque shutter blocks directed light, never the ordinary floor or exit. */
const hasLightLine=(site:LightSeekerSiteState)=>site.shutter.state==='OPEN'&&site.shutter.durability>0&&site.cover.position==='OWNER_STAND';
function operateShutter(site:LightSeekerSiteState,state:'OPEN'|'CLOSED',a:ActionEvidence):boolean {
  if(site.shutter.state==='BROKEN'||site.shutter.durability<=0||site.shutter.state===state)return false;
  site.shutter.operations++;site.shutter.durability--;site.shutter.state=site.shutter.durability===0?'BROKEN':state;
  a.shutterOperationSeconds=2;a.shutterWear=1;return true;
}
export function currentLightSeekerCombatSource(s:SliceState):LightSeekerCombatSource|null {
  if(!hasLightSeekerDisputeOpponent(s))return null;const e=s.lightSeeker.encounter,c=s.combat!,stats=s.character.coreStats;
  return {runId:s.runId,revision:s.revision,week:s.week,round:c.round,encounterId:'LIGHT_SEEKER_DISPUTE',targetId:LIGHT_SEEKER_TARGET_ID,
    attemptWeek:e.attemptWeek!,startHistoryIndex:e.startHistoryIndex!,targetAge:51,targetSequence:2,targetCore:24,actualOriginalBody:true,independentMind:true,
    enemyWeapon:'LS2-OWEN-CLUB',weaponLocation:'HAND',distanceMetres:2,ordinaryExit:true,pursuit:false,thirdPartiesInArea:0,automaticAllyImmunity:false,
    site:structuredClone(s.lightSeeker.life.site),playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,
    enemyHealth:c.enemyHealth,enemyMind:c.enemyMind,enemySpirituality:e.enemySpirituality,playerInjuries:structuredClone(s.injuries),enemyInjuries:structuredClone(c.enemyInjuries),playerRisk:s.injuryRisk,enemyRisk:c.enemyRisk,
    clubHeld:s.town.clubLocation==='HAND',physique:stats.physique,perception:stats.perception,knowledge:stats.knowledge,will:stats.will,
    domainMastery:s.progression.mastery[DOMAIN]??0,purificationMastery:s.progression.mastery[PURIFICATION]??0,powerUses:{...e.powerUses},randomSeed:s.random.seed,randomCursor:s.random.cursor};
}
function makeRuntime(x:LightSeekerCombatSource):Runtime{return{playerS:x.playerSpirituality,enemyS:x.enemySpirituality,powers:{...x.powerUses},site:structuredClone(x.site),shutterUsed:false,playerShutterOpened:false,limitedAttempted:false,wardAttempted:false,limited:null,ward:null};}
function liveState(s:SliceState):string{const e=s.lightSeeker.encounter;return stableStringify({spirituality:s.spirituality,enemySpirituality:e.enemySpirituality,powerUses:e.powerUses,site:s.lightSeeker.life.site});}
const dynamicSource=new Set(['playerSpirituality','enemySpirituality','powerUses','site']);
function validRound(s:SliceState,r:LightSeekerRoundContext,supplied:LightSeekerCombatSource|null):boolean {
  const actual=currentLightSeekerCombatSource(s);return!r.finished&&actual!==null&&supplied!==null&&same(supplied,r.source)&&r.liveState===liveState(s)&&
    Object.entries(r.source).every(([key,value])=>dynamicSource.has(key)||same(actual[key as keyof LightSeekerCombatSource],value));
}
export function beginLightSeekerCombatRound(s:SliceState,stance:SliceStance,random:ActionRandomStream):LightSeekerRoundContext {
  const source=currentLightSeekerCombatSource(s);if(!['ATTACK','DEFEND','CONTROL','PREPARE','RETREAT'].includes(stance)||!source||!validSource(source)||random.seed!==source.randomSeed||random.cursor!==source.randomCursor)throw new Error('缺少当前采光廊、欧文或真实资源来源。');
  return{source,stance,finished:false,liveState:liveState(s),runtime:makeRuntime(source),playerActions:[],enemyActions:[],outcome:null,label:roundOpening(source)};
}
export const createLightSeekerCombatRound=beginLightSeekerCombatRound;
function actionBase(r:Runtime,order:number,physical:number,cursor:number):ActionEvidence {
  return{...none(''),order,atSeconds:r.site.elapsedSeconds,elapsedSeconds:5,paidCost:0,physicalFactor:physical,rolls:[],randomCursorBefore:cursor,randomCursorAfter:cursor,
    playerSpiritualityAfter:r.playerS,enemySpiritualityAfter:r.enemyS,siteBefore:structuredClone(r.site),siteAfter:structuredClone(r.site),shutterOperationSeconds:0,shutterWear:0,
    chargeGranted:false,chargeConsumedByOrder:null,appliedAmount:0,consumedLimitedOrder:null,consumedWardOrder:null};
}
function closeAction<T extends ActionEvidence>(a:T,r:Runtime,random:ActionRandomStream):T {
  advanceSite(r.site,5);a.siteAfter=structuredClone(r.site);a.randomCursorAfter=random.cursor;a.playerSpiritualityAfter=r.playerS;a.enemySpiritualityAfter=r.enemyS;
  a.label+=` 这次动作耗时5秒；你余${r.playerS}灵性，欧文余${r.enemyS}灵性。遮板${r.site.shutter.state==='OPEN'?'开启':r.site.shutter.state==='CLOSED'?'关闭':'损坏'}，耐久${r.site.shutter.durability}。`;return a;
}
function playerAction(x:LightSeekerCombatSource,r:Runtime,id:LightSeekerMoveId,physical:number,order:number,random:ActionRandomStream):LightSeekerPlayerAction {
  const a:LightSeekerPlayerAction={...actionBase(r,order,physical,random.cursor),id,attempted:false,succeeded:false,applied:false,fallback:'NONE'};
  const strike=(why:string)=>{a.fallback='STRIKE';a.selfGain=(x.clubHeld?16:12)*physical;a.threatens=a.selfGain>0;a.label=why+`你改用${x.clubHeld?'手中的棍':'自己的身体'}普通打击，优势${a.selfGain}，不消耗灵性。`;};
  const evade=(why:string)=>{a.fallback='EVADE';a.enemyReduction=10;a.label=why+'你普通避让，减势10，不消耗灵性。';};
  if(id==='ACCIDENT'){a.selfGain=-22.5;a.label='你判断失误，优势−22.5。';}
  else if(id==='EVADE'){a.enemyReduction=10;a.label='你在廊道内普通避让，减势10，不消耗灵性。';}
  else if(id===GUIDED&&!hasLightLine(r.site)){
    a.fallback='OBSERVE';
    if(!r.playerShutterOpened&&r.site.shutter.state==='CLOSED'){r.playerShutterOpened=true;operateShutter(r.site,'OPEN',a);a.fallback='SHUTTER_OPEN';}
    a.label=a.shutterWear?`光路被遮板挡住。你用这次动作手动开板，操作2秒、耐久−1；${r.site.shutter.state==='BROKEN'?'遮板在操作中损坏，光路仍受阻。':''}这次没有发动光击。`:'光路仍受阻。你用这次动作观察遮板，没有攻击或耗费灵性。';
  }else if(id===PURIFICATION&&!hasLightLine(r.site)){a.fallback='OBSERVE';a.label='遮板挡住净化光的直线路径。你暂作观察，没有施法或攻击。';}
  else if(id===LIMITED&&r.limitedAttempted){evade(r.limited?'本轮已付费建立的限光仍等待一次有效光击；':'本轮限光已尝试过；');}
  else{
    const guided=id===GUIDED,limited=id===LIMITED,domain=id===DOMAIN,cost=guided?7:domain?5:6;
    if(r.playerS<cost){if(guided)strike(`不足${cost}灵性，未施法。`);else if(limited||domain)evade(`不足${cost}灵性，未施法。`);else{a.fallback='OBSERVE';a.label='不足6灵性，你暂作观察，没有施法。';}}
    else{
      r.playerS-=cost;a.paidCost=cost;a.attempted=true;if(limited)r.limitedAttempted=true;
      const ability=limited?'knowledge':'will',difficulty=guided||limited?20:domain?16:18,roll=random.nextInt(1,100);a.rolls.push(roll);
      a.succeeded=roll<=computeCheckChance({ability,baseAbility:x[ability],difficulty,modifiers:[]});
      const name=guided?'引导光辉':limited?'限制光照':domain?'无暗领域':'净化光';
      a.label=`${name}耗费${cost}灵性，${limited?'知识':'意志'}检验${roll}${a.succeeded?'成功':'失败，费用已付'}。`;
      if(a.succeeded){
        if(limited){a.chargeGranted=true;r.limited=a;a.label+='本轮下一次真正穿过光路的敌方光击可被减弱45；目前尚未发生减免。';}
        else{
          a.applied=true;a.selfGain=guided?105:domain?0:34*mastery(x.purificationMastery);a.enemyReduction=domain?18*mastery(x.domainMastery):0;a.threatens=a.selfGain>0;
          if(guided||id===PURIFICATION){
            r.site.light={mode:'GUIDED',expiresAt:r.site.elapsedSeconds+5};
            if(r.ward){const ward=r.ward,amount=Math.min(60,a.selfGain);ward.enemyReduction=amount;ward.appliedAmount=amount;ward.chargeConsumedByOrder=order;a.consumedWardOrder=ward.order;a.threatens=a.selfGain>amount;r.ward=null;
              ward.label+=` 随后在第${order+1}次动作中实际抵住光照${amount}。`;a.label+=` 欧文先前付费的防光被这次光照消耗，实际抵住${amount}。`;}
          }
          a.label+=` 本次优势${a.selfGain}、减势${a.enemyReduction}。`;
        }
      }
    }
  }
  return closeAction(a,r,random);
}
function enemyAction(_x:LightSeekerCombatSource,r:Runtime,planned:LightSeekerEnemyIntent,physical:number,order:number,random:ActionRandomStream):LightSeekerEnemyAction {
  const a:LightSeekerEnemyAction={...actionBase(r,order,physical,random.cursor),planned,actual:planned,shutterChanged:false};
  if(planned==='LIGHT_STRIKE'&&(r.enemyS<7||!hasLightLine(r.site))||planned==='LIGHT_WARD'&&r.enemyS<6)a.actual='BODY_STRIKE';
  if(planned==='LIGHT_WARD'&&r.wardAttempted||planned==='SHUTTER_CLOSE'&&(r.shutterUsed||r.site.shutter.state!=='OPEN'))a.actual='OBSERVE';
  if(a.actual==='LIGHT_STRIKE'){
    r.enemyS-=7;r.powers.LIGHT_STRIKE++;a.paidCost=7;a.selfGain=105;a.threatens=true;a.label='欧文耗费7灵性，沿开启的光路施放光击，优势105。';
    if(r.limited){const limited=r.limited;limited.enemyReduction=45;limited.appliedAmount=45;limited.applied=true;limited.chargeConsumedByOrder=order;a.consumedLimitedOrder=limited.order;r.limited=null;
      limited.label+=` 随后在第${order+1}次动作中实际削弱光击45。`;a.label+='你先前建立的限光在此时消耗一次，实际削弱这次光击45；余下光击仍可能造成伤势。';stopLight(r.site);}
  }else if(a.actual==='LIGHT_WARD'){
    r.enemyS-=6;r.powers.LIGHT_WARD++;r.wardAttempted=true;a.paidCost=6;a.chargeGranted=true;r.ward=a;
    a.label='欧文耗费6灵性，准备本轮一次防光。只有后续实际成功、光路通畅的光击或净化光才会消耗它，当前减免为0。';
  }else if(a.actual==='SHUTTER_CLOSE'){
    r.shutterUsed=true;r.powers.SHUTTER_CLOSE++;a.shutterChanged=operateShutter(r.site,'CLOSED',a);
    a.label=`欧文用这次动作操作同一块遮板，关板2秒、耐久−1，${r.site.shutter.state==='BROKEN'?'遮板在操作中损坏':'遮板已关闭'}；不消耗灵性，也没有攻击。廊道地面仍可普通通行。`;
  }else if(a.actual==='BODY_STRIKE'){
    a.selfGain=20*physical;a.threatens=a.selfGain>0;a.label=`${planned!=='BODY_STRIKE'?'光路受阻或灵性不足，欧文改用普通动作。':''}欧文持自己的棍打击，优势${a.selfGain}，不消耗灵性；限光不抵挡棍击。`;
  }else if(a.actual==='OBSERVE')a.label=planned==='LIGHT_WARD'?'欧文本轮已经准备过防光，这次只普通观察，已有防光仍按实际是否消耗保留。':'遮板已关闭、损坏，或欧文本轮已经操作过；这次只普通观察，不额外攻击。';
  else{a.selfGain=-22.5;a.label='欧文判断失误，优势−22.5。';}
  return closeAction(a,r,random);
}
function commitRuntime(s:SliceState,r:LightSeekerRoundContext):void {
  s.spirituality=r.runtime.playerS;s.lightSeeker.encounter.enemySpirituality=r.runtime.enemyS;s.lightSeeker.encounter.powerUses={...r.runtime.powers};
  s.lightSeeker.life.site=structuredClone(r.runtime.site);r.liveState=liveState(s);
}
export function resolveLightSeekerCombatAbility(s:SliceState,id:LightSeekerMoveId,physical:number,random:ActionRandomStream,r:LightSeekerRoundContext,source:LightSeekerCombatSource|null=r.source):LightSeekerCombatEffect {
  if(!validRound(s,r,source)||r.playerActions.length>=6||physical!==physicalAt(r.source.playerHealth)||random.seed!==r.source.randomSeed||!ABILITIES.some(a=>a.id===id))return none('当前人物、现场或资源不符，未执行动作。');
  const a=playerAction(r.source,r.runtime,id,physical,r.playerActions.length+r.enemyActions.length,random);r.playerActions.push(a);commitRuntime(s,r);return{label:a.label,selfGain:a.selfGain,enemyReduction:a.enemyReduction,threatens:a.threatens,mentalPressure:false};
}
export function resolveLightSeekerEnemyAbility(s:SliceState,planned:LightSeekerEnemyIntent,physical:number,random:ActionRandomStream,r:LightSeekerRoundContext,source:LightSeekerCombatSource|null=r.source):LightSeekerCombatEffect {
  if(!validRound(s,r,source)||r.enemyActions.length>=6||physical!==physicalAt(r.source.enemyHealth)||random.seed!==r.source.randomSeed||![...LIGHT_SEEKER_POWER_IDS,'BODY_STRIKE','ACCIDENT'].includes(planned))return none('欧文、棍或当前资源不符，未执行动作。');
  const a=enemyAction(r.source,r.runtime,planned,physical,r.playerActions.length+r.enemyActions.length,random);r.enemyActions.push(a);commitRuntime(s,r);return{label:a.label,selfGain:a.selfGain,enemyReduction:a.enemyReduction,threatens:a.threatens,mentalPressure:false};
}
export interface LightSeekerRoundOutcome {
  targetId:typeof LIGHT_SEEKER_TARGET_ID;round:number;source:LightSeekerCombatSource;stance:SliceStance;continuing:boolean;
  enemyHealth:number;enemyMind:number;enemySpirituality:number;enemyStatus:'RESISTING'|'SURRENDERED'|'DEAD';
  playerSpiritualityBefore:number;playerSpiritualityAfter:number;playerHealthAfter:number;playerMindAfter:number;enemySpiritualityBefore:number;
  playerInjuriesAfter:SliceInjury[];enemyInjuriesAfter:SliceInjury[];playerRiskAfter:number;enemyRiskAfter:number;
  powerUses:Record<LightSeekerPowerId,number>;shutterUsed:boolean;playerShutterOpened:boolean;limitedAttempted:boolean;
  expiredLimitedChargeOrder:number|null;expiredWardChargeOrder:number|null;siteAfter:LightSeekerSiteState;elapsedSeconds:60|62;randomCursorAfter:number;
  playerActions:LightSeekerPlayerAction[];enemyActions:LightSeekerEnemyAction[];
}
export function finishLightSeekerCombatRound(s:SliceState,r:LightSeekerRoundContext,continuing=true,randomCursorAfter=s.random.cursor):LightSeekerRoundOutcome {
  const e=s.lightSeeker.encounter,c=s.combat;
  if(r.finished||!c||c.encounterId!=='LIGHT_SEEKER_DISPUTE'||c.round!==r.source.round||r.liveState!==liveState(s))throw new Error('这个回合已结束，或现场资源发生了变化。');
  e.enemyHealth=c.enemyHealth;e.enemyMind=c.enemyMind;e.enemyStatus=c.enemyStatus;e.enemyInjuries=structuredClone(c.enemyInjuries);e.enemyRisk=c.enemyRisk;if(e.enemyStatus!=='RESISTING')e.weaponLocation='OTHER';
  const site=s.lightSeeker.life.site,leave=!continuing&&s.health>0;advanceSite(site,r.source.site.elapsedSeconds+60-site.elapsedSeconds);if(!continuing)stopLight(site);
  if(leave){if(site.playerLocation!=='NEAR'||site.ordinaryExit!=='OPEN')throw new Error('普通出口或当前位置不符，不能离场。');site.playerLocation='ENTRY';site.playerMetres+=2;advanceSite(site,2);}
  const elapsedSeconds=leave?62:60;r.finished=true;
  r.outcome={targetId:LIGHT_SEEKER_TARGET_ID,round:c.round,source:structuredClone(r.source),stance:r.stance,continuing,
    enemyHealth:c.enemyHealth,enemyMind:c.enemyMind,enemySpirituality:e.enemySpirituality,enemyStatus:c.enemyStatus,
    playerSpiritualityBefore:r.source.playerSpirituality,playerSpiritualityAfter:s.spirituality,playerHealthAfter:s.health,playerMindAfter:s.mind,enemySpiritualityBefore:r.source.enemySpirituality,
    playerInjuriesAfter:structuredClone(s.injuries),enemyInjuriesAfter:structuredClone(c.enemyInjuries),playerRiskAfter:s.injuryRisk,enemyRiskAfter:c.enemyRisk,
    powerUses:{...e.powerUses},shutterUsed:r.runtime.shutterUsed,playerShutterOpened:r.runtime.playerShutterOpened,limitedAttempted:r.runtime.limitedAttempted,
    expiredLimitedChargeOrder:r.runtime.limited?.order??null,expiredWardChargeOrder:r.runtime.ward?.order??null,siteAfter:structuredClone(site),elapsedSeconds,randomCursorAfter,
    playerActions:structuredClone(r.playerActions),enemyActions:structuredClone(r.enemyActions)};return structuredClone(r.outcome);
}
export function lightSeekerRoundOutcome(r:LightSeekerRoundContext):LightSeekerRoundOutcome{if(!r.outcome)throw new Error('回合尚未结束。');return structuredClone(r.outcome);}
export function projectLightSeekerCombat(s:SliceState){
  const e=s.lightSeeker.encounter,visible=isLightSeeker(s),last=s.combat?.encounterId==='LIGHT_SEEKER_DISPUTE'?s.combat.lastRound?.lightSeekerOutcome:e.terminal?s.combatHistory[e.terminal.historyIndex]?.lightSeekerOutcome:null;
  return{enemyName:visible?'欧文·赛尔（51岁）':'',targetId:visible?e.targetId:null,playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,maxSpirituality:120,
    enemyHealth:visible?e.enemyHealth:null,enemyMind:visible?e.enemyMind:null,enemySpirituality:visible?e.enemySpirituality:null,powerUses:visible?{...e.powerUses}:null,
    site:visible?structuredClone(s.lightSeeker.life.site):null,startSite:visible?structuredClone(e.startSite):null,originalExit:true,pursuit:false,distanceMetres:2,automaticAllyImmunity:false,
    source:visible?currentLightSeekerCombatSource(s):null,lastActionSequence:visible&&last?[...last.playerActions.map(a=>({...structuredClone(a),actor:'PLAYER' as const})),...last.enemyActions.map(a=>({...structuredClone(a),actor:'ENEMY' as const}))].sort((a,b)=>a.order-b.order):[],
    countWheel:LIGHT_SEEKER_COUNT_WHEEL.map(x=>({...x})),enemyCountWheel:LIGHT_SEEKER_ENEMY_COUNT_WHEEL.map(x=>({...x})),enemyAbilityWheel:LIGHT_SEEKER_ENEMY_ABILITY_WHEEL.map(x=>({...x})),
    summary:visible?'双方相距2米，中间的遮板阻光，地面仍可步行。引导光辉须光路通畅；本轮限光仅尝试一次，成功后等待下一次有效光击，实际减弱45，棍击不会消耗它。防光也只抵一次实际光照。每次动作5秒、每回合60秒，双方各付自己的灵性；欧文的灵性不会自动恢复。回合继续时你恢复12灵性。健康、伤势和遮板损耗持续保留，战斗不增长掌握。':''};
}
const SOURCE_KEYS=['runId','revision','week','round','encounterId','targetId','attemptWeek','startHistoryIndex','targetAge','targetSequence','targetCore','actualOriginalBody','independentMind','enemyWeapon','weaponLocation','distanceMetres','ordinaryExit','pursuit','thirdPartiesInArea','automaticAllyImmunity','site','playerHealth','playerMind','playerSpirituality','enemyHealth','enemyMind','enemySpirituality','playerInjuries','enemyInjuries','playerRisk','enemyRisk','clubHeld','physique','perception','knowledge','will','domainMastery','purificationMastery','powerUses','randomSeed','randomCursor'] as const;
function validInjuries(v:SliceInjury[],revision:number):boolean {
  return Array.isArray(v)&&new Set(v.map(i=>i.id)).size===v.length&&v.every(i=>shape(i,['id','severity','acquiredRevision','treatedRevision'])&&typeof i.id==='string'&&i.id.length>0&&['LIGHT','HEAVY'].includes(i.severity)&&integer(i.acquiredRevision,1,revision)&&(i.treatedRevision===null||integer(i.treatedRevision,i.acquiredRevision,revision)));
}
function validSource(x:LightSeekerCombatSource):boolean {
  return shape(x,SOURCE_KEYS)&&typeof x.runId==='string'&&x.runId.length>0&&integer(x.revision)&&integer(x.week,1)&&integer(x.round,1)&&integer(x.startHistoryIndex)&&x.attemptWeek===x.week&&
    x.encounterId==='LIGHT_SEEKER_DISPUTE'&&x.targetId===LIGHT_SEEKER_TARGET_ID&&x.targetAge===51&&x.targetSequence===2&&x.targetCore===24&&x.actualOriginalBody===true&&x.independentMind===true&&
    x.enemyWeapon==='LS2-OWEN-CLUB'&&x.weaponLocation==='HAND'&&x.distanceMetres===2&&x.ordinaryExit===true&&x.pursuit===false&&x.thirdPartiesInArea===0&&x.automaticAllyImmunity===false&&
    validateLightSeekerSiteState(x.site)&&x.site.playerLocation==='NEAR'&&x.site.operatorLocation==='SIDE'&&x.site.spiritLocation==='SIDE'&&x.site.ordinaryExit==='OPEN'&&x.site.light.mode==='OFF'&&x.site.cover.position==='OWNER_STAND'&&x.site.operatorConsent==='GRANTED'&&x.site.operatorConsentWeek===x.week&&
    [x.playerHealth,x.playerMind,x.enemyHealth,x.enemyMind].every(n=>integer(n,1,100))&&x.enemyMind===100&&[x.playerSpirituality,x.enemySpirituality].every(n=>integer(n,0,120))&&
    [x.physique,x.perception,x.knowledge,x.will,x.domainMastery,x.purificationMastery].every(n=>integer(n,0,500))&&typeof x.clubHeld==='boolean'&&integer(x.playerRisk)&&integer(x.enemyRisk)&&
    validInjuries(x.playerInjuries,x.revision)&&validInjuries(x.enemyInjuries,x.revision)&&shape(x.powerUses,LIGHT_SEEKER_POWER_IDS)&&LIGHT_SEEKER_POWER_IDS.every(id=>integer(x.powerUses[id]))&&x.powerUses.SHUTTER_CLOSE<=x.round-1&&x.powerUses.LIGHT_WARD<=x.round-1&&
    x.enemySpirituality===120-LIGHT_SEEKER_POWERS.reduce((n,p)=>n+p.cost*x.powerUses[p.id],0)&&typeof x.randomSeed==='string'&&x.randomSeed.length>0&&x.randomSeed.length<=256&&integer(x.randomCursor);
}
/** Exact inherited common formulas, applied to immutable historical source rather than later live stats. */
function sourcePenalty(current:number,maximum:number):number {const f=Math.max(0,Math.min(1,current/maximum));return f>.75?0:f>.5?.05:f>.25?.1:.2;}
function sourceBase(core:number,health:number,mind:number,spirituality:number):number {return(1250+Math.min(core,250))*(1-Math.min(.4,sourcePenalty(health,100)+sourcePenalty(mind,100)+sourcePenalty(spirituality,120)));}
function sourceWeights(risk:number):{light:number;heavy:number;death:number}{const death=Math.min(100,5+Math.min(risk,10)*10),shifted=death-5;return{light:Math.max(0,65-shifted),heavy:Math.max(0,30-Math.max(0,shifted-65)),death};}
interface ReplayedRound {outcome:LightSeekerRoundOutcome;playerCount:number;enemyCount:number;playerCountRoll:number;enemyCountRoll:number;first:'PLAYER'|'ENEMY';retreat:'NONE'|'SUCCESS'|'FAILURE';winner:'PLAYER'|'ENEMY';playerAdvantage:number;enemyAdvantage:number;winChance:number;consequenceWeights:{light:number;heavy:number;death:number}|null;consequenceRoll?:number}
function replayOutcome(o:LightSeekerRoundOutcome):ReplayedRound|null {
  const x=o?.source;if(!x||!validSource(x)||!['ATTACK','DEFEND','CONTROL','PREPARE','RETREAT'].includes(o.stance)||!Array.isArray(o.playerActions)||!Array.isArray(o.enemyActions)||o.playerActions.length>6||o.enemyActions.length>6)return null;
  const rng=new DeterministicActionRandomStream(x.randomSeed,x.randomCursor),r=makeRuntime(x),playerCountRoll=rng.nextInt(1,100),enemyCountRoll=rng.nextInt(1,100),playerCount=lightSeekerActionCount(playerCountRoll),enemyCount=lightSeekerEnemyActionCount(enemyCountRoll);
  const first=x.round%2===1?'PLAYER':'ENEMY',order=first==='PLAYER'?['PLAYER','ENEMY'] as const:['ENEMY','PLAYER'] as const,remaining={PLAYER:playerCount,ENEMY:enemyCount};
  const players:LightSeekerPlayerAction[]=[],enemies:LightSeekerEnemyAction[]=[];let retreat:ReplayedRound['retreat']='NONE';
  while(remaining.PLAYER>0||remaining.ENEMY>0){for(const actor of order){if(remaining[actor]===0)continue;if(actor==='PLAYER'&&o.stance==='RETREAT'){remaining.PLAYER=0;retreat=rng.nextInt(1,100)<=50?'SUCCESS':'FAILURE';if(retreat==='SUCCESS'){remaining.ENEMY=0;break;}continue;}remaining[actor]--;
    if(actor==='PLAYER')players.push(playerAction(x,r,drawPlayer(rng,o.stance),physicalAt(x.playerHealth),players.length+enemies.length,rng));else enemies.push(enemyAction(x,r,drawLightSeekerEnemyAbility(rng),physicalAt(x.enemyHealth),players.length+enemies.length,rng));}}
  if(!same(players,o.playerActions)||!same(enemies,o.enemyActions))return null;
  const sum=(actions:{selfGain:number;enemyReduction:number}[],key:'selfGain'|'enemyReduction')=>actions.reduce((n,a)=>n+a[key],0);
  const playerAdvantage=Math.max(125,sourceBase(x.physique*.35+x.perception*.25+x.will*.25+x.knowledge*.15,x.playerHealth,x.playerMind,x.playerSpirituality)+sum(players,'selfGain')-sum(enemies,'enemyReduction'));
  const enemyAdvantage=Math.max(125,sourceBase(24,x.enemyHealth,x.enemyMind,x.enemySpirituality)+sum(enemies,'selfGain')-sum(players,'enemyReduction')),winChance=playerAdvantage/(playerAdvantage+enemyAdvantage)*100;
  const winner=retreat==='SUCCESS'?'ENEMY':rng.nextInt(1,1_000_000)<=winChance*10_000?'PLAYER':'ENEMY';
  let playerHealth=x.playerHealth,enemyHealth=x.enemyHealth,playerRisk=x.playerRisk,enemyRisk=x.enemyRisk,enemyStatus:LightSeekerRoundOutcome['enemyStatus']='RESISTING',continuing=retreat!=='SUCCESS';
  const playerInjuries=structuredClone(x.playerInjuries),enemyInjuries=structuredClone(x.enemyInjuries);let consequenceWeights:ReplayedRound['consequenceWeights']=null,consequenceRoll:number|undefined;
  if(retreat!=='SUCCESS'){const loser=winner==='PLAYER'?'ENEMY':'PLAYER',injuries=loser==='PLAYER'?playerInjuries:enemyInjuries;let risk=loser==='PLAYER'?playerRisk:enemyRisk;if(injuries.length)risk++;if(loser==='PLAYER')playerRisk=risk;else enemyRisk=risk;
    if(loser==='PLAYER'?enemies.some(a=>a.threatens):players.some(a=>a.threatens)){consequenceWeights=sourceWeights(risk);consequenceRoll=rng.nextInt(1,100);const severity=consequenceRoll<=consequenceWeights.light?'LIGHT':consequenceRoll<=consequenceWeights.light+consequenceWeights.heavy?'HEAVY':'DEATH';
      if(severity==='DEATH'){if(loser==='PLAYER')playerHealth=0;else{enemyHealth=0;enemyStatus='DEAD';}continuing=false;}
      else{injuries.push({id:`${x.runId}:combat:${x.round}:${loser}:${x.revision+1}:${injuries.length}`,severity,acquiredRevision:x.revision+1,treatedRevision:null});const damage=severity==='LIGHT'?10:30;if(loser==='PLAYER')playerHealth=Math.max(0,playerHealth-damage);else enemyHealth=Math.max(0,enemyHealth-damage);
        if(playerHealth===0||enemyHealth===0){if(enemyHealth===0)enemyStatus='DEAD';continuing=false;}else if(loser==='ENEMY'&&severity==='HEAVY'){enemyStatus='SURRENDERED';continuing=false;}}}}
  const leave=!continuing&&playerHealth>0,elapsedSeconds=leave?62:60;advanceSite(r.site,x.site.elapsedSeconds+60-r.site.elapsedSeconds);if(!continuing)stopLight(r.site);if(leave){r.site.playerLocation='ENTRY';r.site.playerMetres+=2;advanceSite(r.site,2);}
  const expected:LightSeekerRoundOutcome={targetId:LIGHT_SEEKER_TARGET_ID,round:x.round,source:structuredClone(x),stance:o.stance,continuing,enemyHealth,enemyMind:x.enemyMind,enemySpirituality:r.enemyS,enemyStatus,
    playerSpiritualityBefore:x.playerSpirituality,playerSpiritualityAfter:r.playerS,playerHealthAfter:playerHealth,playerMindAfter:x.playerMind,enemySpiritualityBefore:x.enemySpirituality,
    playerInjuriesAfter:playerInjuries,enemyInjuriesAfter:enemyInjuries,playerRiskAfter:playerRisk,enemyRiskAfter:enemyRisk,powerUses:r.powers,shutterUsed:r.shutterUsed,playerShutterOpened:r.playerShutterOpened,limitedAttempted:r.limitedAttempted,expiredLimitedChargeOrder:r.limited?.order??null,expiredWardChargeOrder:r.ward?.order??null,siteAfter:r.site,elapsedSeconds,randomCursorAfter:rng.cursor,playerActions:players,enemyActions:enemies};
  if(!same(o,expected))return null;return{outcome:expected,playerCount,enemyCount,playerCountRoll,enemyCountRoll,first,retreat,winner,playerAdvantage,enemyAdvantage,winChance,consequenceWeights,...(consequenceRoll===undefined?{}:{consequenceRoll})};
}
export function validateLightSeekerRoundOutcome(value:unknown):value is LightSeekerRoundOutcome {try{return replayOutcome(value as LightSeekerRoundOutcome)!==null;}catch{return false;}}
export function validateLightSeekerCombatRound(round:SliceCombatRound):boolean {try{const o=round.lightSeekerOutcome,replay=o?replayOutcome(o):null;if(!o||!replay||round.round!==o.round||round.stance!==o.stance||round.consequence!==lightSeekerCombatConsequence(round)||!shape(round,['round','stance','first','playerCount','enemyCount','playerCountRoll','enemyCountRoll','moves','playerAdvantage','enemyAdvantage','winChance','winner','consequence','consequenceWeights','retreat','lightSeekerOutcome',...(replay.consequenceRoll===undefined?[]:['consequenceRoll'])]))return false;
  for(const key of ['playerCount','enemyCount','playerCountRoll','enemyCountRoll','first','retreat','winner','playerAdvantage','enemyAdvantage','winChance','consequenceWeights','consequenceRoll'] as const)if(!same(round[key],replay[key]))return false;
  const moves=[...o.playerActions.map(a=>({...a,actor:'PLAYER' as const})),...o.enemyActions.map(a=>({...a,actor:'ENEMY' as const}))].sort((a,b)=>a.order-b.order).map(a=>({actor:a.actor,label:a.label,selfGain:a.selfGain,enemyReduction:a.enemyReduction}));return same(round.moves,moves);
}catch{return false;}}

function roundOpening(x:LightSeekerCombatSource):string {
  return `51岁的欧文·赛尔持棍站在你前方2米处，健康${x.enemyHealth}、精神100、灵性${x.enemySpirituality}。玛拉和芦影在廊道外的侧区；中间遮板影响光路，地面仍可通行。`;
}
/** Derive display text from the same replayed result, rather than accepting arbitrary saved prose. */
export function lightSeekerCombatConsequence(round:SliceCombatRound):string {
  const o=round.lightSeekerOutcome;if(!o)throw new Error('缺少逐光者回合结果。');let text:string;
  if(round.retreat==='SUCCESS')text='你通过撤离判定，沿开放的普通通路步行2米、耗时2秒回到入口。欧文仍留在自己的位置。';
  else {
    const loser=round.winner==='PLAYER'?'ENEMY':'PLAYER',subject=loser==='PLAYER'?'你':'欧文',risk=loser==='PLAYER'?o.playerRiskAfter:o.enemyRiskAfter;
    if(round.consequenceRoll===undefined)text=`${subject}本回合处于下风，但没有遭受实际致伤攻击，因此没有新增身体伤势。累计风险${risk}。`;
    else {
      const weights=round.consequenceWeights!,severity=round.consequenceRoll<=weights.light?'LIGHT':round.consequenceRoll<=weights.light+weights.heavy?'HEAVY':'DEATH';
      if(severity==='DEATH')text=`${subject}伤势检验${round.consequenceRoll}/100，伤势致命，身体留在采光廊内。`;
      else {text=`${subject}伤势检验${round.consequenceRoll}/100，受到${severity==='LIGHT'?'轻':'重'}伤，健康减少${severity==='LIGHT'?10:30}。`;
        if(o.playerHealthAfter===0||o.enemyHealth===0)text+='健康已降至0，伤者死亡。';else if(o.enemyStatus==='SURRENDERED')text+='欧文因重伤停止抵抗，将自己的棍放在脚边。';}
    }
    if(!o.continuing&&o.playerHealthAfter>0)text+='你停止施光，沿普通通路步行2米、耗时2秒回到入口。';
  }
  const limited=o.playerActions.reduce((n,a)=>n+a.appliedAmount,0),ward=o.enemyActions.reduce((n,a)=>n+a.appliedAmount,0);
  return roundOpening(o.source)+text+` 本轮限光实际减弱${limited}，欧文防光实际抵住${ward}；未用的一次性准备随回合结束失效。伤势、灵性支出和遮板损耗保留。`;
}
