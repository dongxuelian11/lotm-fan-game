import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasPlaneswalkerRitualLock } from './ritual.js';
import { planeswalkerLifeClosed, hasPlaneswalkerLifeLock } from './life.js';
import { currentPlaneswalkerCombatSource, validatePlaneswalkerRoundOutcome, validatePlaneswalkerCombatRound, leavePlaneswalkerCombatSite,
  type PlaneswalkerCombatSource } from './combat.js';
import { validatePlaneswalkerSiteState, advancePlaneswalkerTime, type PlaneswalkerSiteState } from './resources.js';

/** One authored adult opponent, with his original contemporary body and his own weapon. */
export const PLANESWALKER_TARGET = { id:'PW2-SOREN',name:'索伦·怀特',age:46,source:'ORIGINAL_TRANSIT_HALL_ADULT',weaponId:'PW2-SOREN-CLUB' } as const;
export const PLANESWALKER_TARGET_ID = PLANESWALKER_TARGET.id;
export type PlaneswalkerTargetId = typeof PLANESWALKER_TARGET_ID;
export const PLANESWALKER_TARGET_IDS = [PLANESWALKER_TARGET_ID] as const;
export const PLANESWALKER_POWER_IDS=['VECTOR_STRIKE','REFRACT_WARD','CLOSE_DOOR'] as const;
export type PlaneswalkerPowerId=typeof PLANESWALKER_POWER_IDS[number];
export type PlaneswalkerEnemyIntent=PlaneswalkerPowerId|'BODY_STRIKE'|'ACCIDENT';
export const PLANESWALKER_POWERS=[
  {id:'VECTOR_STRIKE',label:'有限定点折光击',cost:5,selfGain:75,enemyReduction:0},
  {id:'REFRACT_WARD',label:'一次折光屏护',cost:4,selfGain:0,enemyReduction:0},
  {id:'CLOSE_DOOR',label:'普通关闭门扇',cost:0,selfGain:0,enemyReduction:0},
] as const;
export interface PlaneswalkerEncounterTerminal {
  outcome:'PLAYER_DEAD'|'RETREATED'|'ENEMY_DEAD'|'ENEMY_SURRENDERED';round:number;historyIndex:number;
  enemyHealth:number;enemyMind:number;enemySpirituality:number;enemyStatus:'RESISTING'|'SURRENDERED'|'DEAD';
}
export interface PlaneswalkerEncounterState {
  status:'AVAILABLE'|'READY'|'FIGHTING'|'RESOLVED'|'RETREATED'|'LOST';targetId:PlaneswalkerTargetId|null;
  approachWeek:number|null;approachRevision:number|null;attemptWeek:number|null;startHistoryIndex:number|null;
  /** Exact closed-life input. Life validation proves the complete preceding journal. */
  startSite:PlaneswalkerSiteState|null;startSource:PlaneswalkerCombatSource|null;
  enemyHealth:number;enemyMind:number;enemySpirituality:number;enemyStatus:'RESISTING'|'SURRENDERED'|'DEAD';
  enemyLocation:'FAR';enemyMetres:0;weaponLocation:'HAND'|'FAR';enemyInjuries:SliceInjury[];enemyRisk:number;
  powerUses:Record<PlaneswalkerPowerId,number>;terminal:PlaneswalkerEncounterTerminal|null;
}
export type PlaneswalkerEncounterCommand={type:'ENCOUNTER_TALK'|'ENCOUNTER_FIGHT'|'LEAVE_ENCOUNTER'};
export interface PlaneswalkerEncounterAction{id:string;label:string;cost:string;enabled:boolean;reason:string|null;command:PlaneswalkerEncounterCommand}
export interface PlaneswalkerEncounterProjection {
  title:string;story:string;status:PlaneswalkerEncounterState['status'];inside:boolean;site:PlaneswalkerSiteState|null;startSite:PlaneswalkerSiteState|null;
  enemy:null|{id:PlaneswalkerTargetId;name:string;age:46;source:string;sequence:3;health:number;mind:number;spirituality:number;
    status:PlaneswalkerEncounterState['enemyStatus'];weaponId:'PW2-SOREN-CLUB';weaponLocation:'HAND'|'FAR';location:'FAR';powerUses:Record<PlaneswalkerPowerId,number>};
  actions:PlaneswalkerEncounterAction[];facts:string[];
}
export const PLANESWALKER_ENCOUNTER_STORY='46岁的索伦·怀特在本地通行室提出通路争议，拿着自己的原棍。他是独立的成年法术使用者。先取得玛拉本次清场许可，她从入口普通步行2米、耗时2秒并消耗2精力退到室外；你再走入2米到近端，与站在6米远端的索伦相距4米。中间的原遮门沿用当前状态，原包、原灯和原屏均不更换。交谈后可免费沿2米普通通路离开，交战需再花1行动独立选择。光纹复现须亲见理解且线路开启；本地象征通行仅在已实查近远两垫间实际移动4米，普通关门不妨碍，受阻则停止。伤势和死亡风险真实存在。';
export function createPlaneswalkerEncounterState():PlaneswalkerEncounterState {
  return{status:'AVAILABLE',targetId:null,approachWeek:null,approachRevision:null,attemptWeek:null,startHistoryIndex:null,startSite:null,startSource:null,
    enemyHealth:100,enemyMind:100,enemySpirituality:120,enemyStatus:'RESISTING',enemyLocation:'FAR',enemyMetres:0,weaponLocation:'HAND',enemyInjuries:[],enemyRisk:0,
    powerUses:{VECTOR_STRIKE:0,REFRACT_WARD:0,CLOSE_DOOR:0},terminal:null};
}
const stage=(s:SliceState)=>s.progression.pathwayId==='door'&&s.progression.sequence===2;
const same=(a:unknown,b:unknown)=>a===b||(a!==undefined&&b!==undefined&&stableStringify(a)===stableStringify(b));
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&(v as number)>=min&&(v as number)<=max;
const shape=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...keys].sort());
export function validatePlaneswalkerEncounterCommand(v:unknown):v is PlaneswalkerEncounterCommand{return shape(v,['type'])&&['ENCOUNTER_TALK','ENCOUNTER_FIGHT','LEAVE_ENCOUNTER'].includes(String((v as{type:unknown}).type));}
export const isPlaneswalkerEncounterCommand=validatePlaneswalkerEncounterCommand;
export const hasPlaneswalkerEncounterLock=(s:SliceState):boolean=>['READY','FIGHTING'].includes(s.planeswalker.encounter.status);
export const isInsidePlaneswalkerEncounter=hasPlaneswalkerEncounterLock;
function otherSceneOpen(s:SliceState):boolean {
  return s.planeswalker.preparedWeek!==null||hasPlaneswalkerLifeLock(s)||hasPlaneswalkerRitualLock(s);
}
function closedSite(site:PlaneswalkerSiteState):boolean {
  return validatePlaneswalkerSiteState(site)&&site.playerLocation==='ENTRY'&&site.operatorLocation==='ENTRY'&&site.operatorEnergy>=2&&
    site.effect.mode==='OFF'&&site.door.state==='CLOSED'&&site.ordinaryExit==='OPEN'&&site.parcel.location==='ENTRY_STAND';
}
/** Consent and ordinary travel are replayed from the closed life site; no object or person is replaced. */
export function planeswalkerApproachedSite(start:PlaneswalkerSiteState,week:number):PlaneswalkerSiteState {
  if(!closedSite(start)||!integer(week,1)||start.introducedWeek===null||start.introducedWeek>week)throw new Error('先收束通行室，玛拉还须有2精力走到室外。');
  const site=structuredClone(start);site.operatorConsent='GRANTED';site.operatorConsentWeek=week;
  site.operatorLocation='OUTSIDE';site.operatorMetres+=2;site.operatorEnergy-=2;advancePlaneswalkerTime(site,2);
  site.playerLocation='NEAR';site.playerMetres+=2;advancePlaneswalkerTime(site,2);return site;
}
export function blockPlaneswalkerEncounter(s:SliceState,c:PlaneswalkerEncounterCommand):string|null {
  if(!validatePlaneswalkerEncounterCommand(c))return'通行室遭遇命令无效。';const e=s.planeswalker.encounter;
  if(s.status!=='ACTIVE'||!stage(s)||s.health<=0)return'须本人仍活着并已成为旅法师。';
  if(s.activeEvent||s.combat)return'先处理当前事件或战斗。';if(s.world.city!=='BACKLUND')return'须在贝克兰德的通行室。';
  if(otherSceneOpen(s))return'先收束当前准备、实践和其他现场，并从异星真实返回本地。';
  if(c.type==='LEAVE_ENCOUNTER')return e.status==='READY'&&s.planeswalker.life.site.playerLocation==='NEAR'?null:'先到室内近端交谈，才能沿普通通路离开。';
  if(s.mind<=0)return'先恢复精神；交谈后仍可普通离开。';if(s.actionsRemaining<1)return'这次选择需要1行动。';
  if(c.type==='ENCOUNTER_TALK'){
    if(e.status!=='AVAILABLE')return'本次对手的接触已有进展或结局。';
    if(!planeswalkerLifeClosed(s)||!s.planeswalker.life.reflected)return'先报告三次实践并完成反思。';
    if(!closedSite(s.planeswalker.life.site))return'先停止法术、放回原包、关闭原门，并与玛拉返回入口；她还须有2精力。';
    return s.actionsRemaining<2?'交谈需1行动，请另留1行动决定是否交战；到场后也能不花行动和平离开。':null;
  }
  const site=s.planeswalker.life.site;
  return e.status==='READY'&&site.playerLocation==='NEAR'&&site.operatorLocation==='OUTSIDE'&&site.operatorConsent==='GRANTED'&&site.operatorConsentWeek===s.week?null:'先实际交谈，让现场管理人退到室外，确认普通出口开放。';
}
export const planeswalkerEncounterReason=blockPlaneswalkerEncounter;
export function applyPlaneswalkerEncounterCommand(s:SliceState,c:PlaneswalkerEncounterCommand,ctx:SeerContext):void {
  const reason=blockPlaneswalkerEncounter(s,c);if(reason)throw new Error(reason);const e=s.planeswalker.encounter;
  if(c.type==='LEAVE_ENCOUNTER'){const metres=leavePlaneswalkerCombatSite(s.planeswalker.life.site);e.status='RESOLVED';ctx.note('离开通行室',`你沿普通通路步行${metres}米、耗时${metres}秒回到入口。现场管理人仍在室外，对手持棍留在室内。`);return;}
  s.actionsRemaining--;
  if(c.type==='ENCOUNTER_TALK'){
    e.targetId=PLANESWALKER_TARGET.id;e.startSite=structuredClone(s.planeswalker.life.site);s.planeswalker.life.site=planeswalkerApproachedSite(e.startSite,s.week);e.status='READY';e.approachWeek=s.week;e.approachRevision=s.revision+1;
    const target=PLANESWALKER_TARGET;ctx.note(`与${target.name}交谈`,`${target.age}岁的${target.name}是这次实际接触的当代对手。`+PLANESWALKER_ENCOUNTER_STORY+'你尚未选择交战。');return;
  }
  e.status='FIGHTING';e.attemptWeek=s.week;e.startHistoryIndex=s.combatHistory.length;
  s.combat={encounterId:'PLANESWALKER_DISPUTE',round:1,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemyInjuries:structuredClone(e.enemyInjuries),enemyRisk:e.enemyRisk,enemyStatus:'RESISTING',lastRound:null};
  const source=currentPlaneswalkerCombatSource(s);if(!source)throw new Error('通行室的开战来源不完整。');e.startSource={...source,revision:s.revision+1};
  ctx.note('通行室交战',`你选择与${source.targetName}交战。双方各用自己的灵性，原门、原包、原灯和既有伤势沿用当前状态。`);
}
export const applyPlaneswalkerEncounter=applyPlaneswalkerEncounterCommand;
export function startPlaneswalkerEncounter(s:SliceState,ctx:SeerContext):void{applyPlaneswalkerEncounterCommand(s,{type:'ENCOUNTER_FIGHT'},ctx);}
export function hasPlaneswalkerDisputeOpponent(s:SliceState):boolean {
  const e=s.planeswalker?.encounter,c=s.combat,site=s.planeswalker?.life.site;
  return stage(s)&&s.status==='ACTIVE'&&s.health>0&&s.mind>0&&!s.activeEvent&&s.world.city==='BACKLUND'&&!otherSceneOpen(s)&&!!e&&e.status==='FIGHTING'&&
    e.targetId===PLANESWALKER_TARGET.id&&e.enemyLocation==='FAR'&&e.enemyMetres===0&&e.terminal===null&&e.enemyStatus==='RESISTING'&&e.weaponLocation==='HAND'&&e.approachWeek!==null&&e.attemptWeek===s.week&&
    validatePlaneswalkerSiteState(site)&&['NEAR','FAR'].includes(site.playerLocation)&&site.operatorLocation==='OUTSIDE'&&site.operatorConsent==='GRANTED'&&site.operatorConsentWeek===s.week&&site.ordinaryExit==='OPEN'&&
    c?.encounterId==='PLANESWALKER_DISPUTE'&&c.enemyStatus==='RESISTING'&&c.enemyHealth>0&&c.enemyMind>0&&e.enemyHealth===c.enemyHealth&&e.enemyMind===c.enemyMind&&same(e.enemyInjuries,c.enemyInjuries)&&e.enemyRisk===c.enemyRisk&&integer(e.enemySpirituality,0,120)&&
    PLANESWALKER_POWER_IDS.every(id=>integer(e.powerUses[id]))&&e.enemySpirituality===120-PLANESWALKER_POWERS.reduce((n,p)=>n+e.powerUses[p.id]*p.cost,0)&&integer(c.round,1)&&e.startHistoryIndex!==null&&integer(e.startHistoryIndex)&&s.combatHistory.length-e.startHistoryIndex===c.round-1;
}
export function settlePlaneswalkerEncounter(s:SliceState,outcome:string,ctx:SeerContext,_award?:(source:string,amount:5|8|25)=>void):void {
  const e=s.planeswalker.encounter,c=s.combat;if(e.status!=='FIGHTING'||c?.encounterId!=='PLANESWALKER_DISPUTE')throw new Error('当前没有在通行室进行的战斗。');if(outcome==='CONTINUE')return;
  if(!['PLAYER_DEAD','RETREATED','ENEMY_DEAD','ENEMY_SURRENDERED'].includes(outcome))throw new Error('未知战斗结果。');
  const last=c.lastRound,o=last?.planeswalkerOutcome;
  if(e.terminal||e.startHistoryIndex===null||!last||!validatePlaneswalkerRoundOutcome(o)||!validatePlaneswalkerCombatRound(last)||o.continuing||c.round!==last.round+1||
    s.combatHistory.length-e.startHistoryIndex!==last.round||!same(s.combatHistory.at(-1),last)||!same(o.siteAfter,s.planeswalker.life.site)||
    o.targetId!==e.targetId||o.enemyHealth!==c.enemyHealth||o.enemyMind!==c.enemyMind||o.enemySpirituality!==e.enemySpirituality||!same(o.powerUses,e.powerUses)||!same(o.enemyInjuriesAfter,c.enemyInjuries)||o.enemyRiskAfter!==c.enemyRisk||
    !same(o.playerInjuriesAfter,s.injuries)||o.playerRiskAfter!==s.injuryRisk||o.playerHealthAfter!==s.health||o.playerMindAfter!==s.mind||o.playerSpiritualityAfter!==s.spirituality||
    (outcome==='PLAYER_DEAD'&&(s.health!==0||last.winner!=='ENEMY'||last.retreat==='SUCCESS'))||(outcome==='RETREATED'&&(last.retreat!=='SUCCESS'||last.winner!=='ENEMY'||s.health<=0))||
    (outcome==='ENEMY_DEAD'&&(c.enemyStatus!=='DEAD'||c.enemyHealth!==0||last.winner!=='PLAYER'||last.retreat!=='NONE'))||(outcome==='ENEMY_SURRENDERED'&&(c.enemyStatus!=='SURRENDERED'||c.enemyHealth<=0||last.winner!=='PLAYER'||last.retreat!=='NONE')))
    throw new Error('身体、现场、资源或完整战斗结果不符。');
  e.terminal={outcome:outcome as PlaneswalkerEncounterTerminal['outcome'],round:last.round,historyIndex:s.combatHistory.length-1,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,enemyStatus:e.enemyStatus};
  e.status=outcome==='PLAYER_DEAD'?'LOST':outcome==='RETREATED'?'RETREATED':'RESOLVED';s.combat=null;
  ctx.note('通行室冲突结束',`${outcome==='PLAYER_DEAD'?'你已死亡，身体留在室内的实际位置。':`你已经沿普通通路步行${o.exitMetres}米、耗时${o.exitMetres}秒回到入口。`}现场管理人仍在室外。${o.source.targetName}、那根棍，以及现场物件保留当前状态。`);
}
export const finishPlaneswalkerEncounter=settlePlaneswalkerEncounter;
export function planeswalkerEncounterActions(s:SliceState):PlaneswalkerEncounterAction[] {
  if(!stage(s))return[];const name=PLANESWALKER_TARGET.name;
  return([['ENCOUNTER_TALK',`清场后与${name}交谈`,'1行动；管理人2米/2秒/2精力，你2米/2秒'],['ENCOUNTER_FIGHT',`选择与${name}交战`,'1行动；有受伤和死亡风险'],['LEAVE_ENCOUNTER','沿通路和平离开','0行动；2米/2秒']]as const).map(([type,label,cost])=>{const command:PlaneswalkerEncounterCommand={type},reason=blockPlaneswalkerEncounter(s,command);return{id:`planeswalker-${type}`,label,cost,command,enabled:reason===null,reason};});
}
export function projectPlaneswalkerEncounter(s:SliceState):PlaneswalkerEncounterProjection {
  const e=s.planeswalker.encounter;if(!stage(s))return{title:'尚未开放的通行室遭遇',story:'',status:e.status,inside:false,site:null,startSite:null,enemy:null,actions:[],facts:[]};
  const target=e.targetId?PLANESWALKER_TARGET:null;
  return{title:target?`通行室里的${target.name}`:'通行室通路争议',story:PLANESWALKER_ENCOUNTER_STORY,status:e.status,inside:hasPlaneswalkerEncounterLock(s),site:structuredClone(s.planeswalker.life.site),startSite:structuredClone(e.startSite),
    enemy:target?{id:target.id,name:target.name,age:target.age,source:target.source,sequence:3,health:e.enemyHealth,mind:e.enemyMind,spirituality:e.enemySpirituality,status:e.enemyStatus,weaponId:target.weaponId,weaponLocation:e.weaponLocation,location:e.enemyLocation,powerUses:{...e.powerUses}}:null,
    actions:planeswalkerEncounterActions(s),facts:['索伦是46岁的同一当代成年人，持自己的原棍，远端位置6米不变。','玛拉实际退到室外后才可开战；原包仍留在入口台面，灯与原屏保持此前痕迹。','光纹复现只能短时再现本人亲见理解的三环光纹，须原门开启，不制造物质或复制人物。','象征通行每轮最多付费尝试一次，只在已实查的近远两垫间移动本人4米；普通关门可通行，现场受阻不能施放。','成功通行后的避让只削弱随后一次实际持棍身体攻击45，不抵折光法术；未应用准备到轮末失效。','对手一次屏护只抵本轮下一次成功光纹复现45，必须真正命中该后续动作才计减免。','普通开关门各占5秒动作，没有攻击；敌灵性逐次消耗且不自动恢复。','健康、伤势、原身体与原棍保持实际结局；战斗不增长掌握。']};
}
/** Life replay proves startSite. This validator proves original identity, every original ordered round and the sole live site thereafter. */
export function validatePlaneswalkerEncounter(s:SliceState):boolean {
  try {
    const e=s.planeswalker?.encounter,initial=createPlaneswalkerEncounterState();
    if(!e||!shape(e,Object.keys(initial))||e.enemyLocation!=='FAR'||e.enemyMetres!==0||!['AVAILABLE','READY','FIGHTING','RESOLVED','RETREATED','LOST'].includes(e.status)||
      !integer(e.enemyHealth,0,100)||e.enemyMind!==100||!integer(e.enemySpirituality,0,120)||!integer(e.enemyRisk)||!Array.isArray(e.enemyInjuries)||
      !['RESISTING','SURRENDERED','DEAD'].includes(e.enemyStatus)||(e.enemyStatus==='DEAD')!==(e.enemyHealth===0)||e.weaponLocation!==(e.enemyStatus==='RESISTING'?'HAND':'FAR')||
      !shape(e.powerUses,PLANESWALKER_POWER_IDS)||!PLANESWALKER_POWER_IDS.every(id=>integer(e.powerUses[id]))||e.enemySpirituality!==120-PLANESWALKER_POWERS.reduce((n,p)=>n+e.powerUses[p.id]*p.cost,0)||
      [e.approachWeek,e.attemptWeek].some(w=>w!==null&&!integer(w,1,s.week)))return false;
    const allNew=s.combatHistory.flatMap((r,i)=>r.planeswalkerOutcome?[i]:[]);
    if(e.status==='AVAILABLE')return same(e,initial)&&allNew.length===0&&s.combat?.encounterId!=='PLANESWALKER_DISPUTE';
    if(!stage(s)||e.targetId!==PLANESWALKER_TARGET.id||s.planeswalker.promotionWeek===null||e.approachWeek===null||e.approachWeek<s.planeswalker.promotionWeek||!integer(e.approachRevision,1,s.revision)||
      !planeswalkerLifeClosed(s)||!s.planeswalker.life.reflected||!e.startSite||!closedSite(e.startSite))return false;
    const approached=planeswalkerApproachedSite(e.startSite,e.approachWeek);
    if(e.startHistoryIndex===null){const ready=e.status==='READY',peaceful=e.status==='RESOLVED';const expected=structuredClone(approached);if(peaceful)leavePlaneswalkerCombatSite(expected);
      return(ready||peaceful)&&e.attemptWeek===null&&e.startSource===null&&e.terminal===null&&allNew.length===0&&same(s.planeswalker.life.site,expected)&&
        same({...e,status:initial.status,targetId:null,approachWeek:null,approachRevision:null,startSite:null},initial)&&s.combat?.encounterId!=='PLANESWALKER_DISPUTE'&&(!ready||s.status==='ACTIVE'&&!otherSceneOpen(s)&&e.approachWeek===s.week);}
    if(!integer(e.startHistoryIndex,0,s.combatHistory.length)||e.attemptWeek===null||e.attemptWeek!==e.approachWeek||!e.startSource||e.startSource.round!==1||!same(e.startSource.site,approached)||
      e.startSource.runId!==s.runId||e.startSource.targetId!==e.targetId||e.startSource.randomSeed!==s.random.seed||e.startSource.attemptWeek!==e.attemptWeek||e.startSource.startHistoryIndex!==e.startHistoryIndex||e.startSource.revision<=e.approachRevision||e.startSource.revision>s.revision)return false;
    if(e.terminal&&(!shape(e.terminal,['outcome','round','historyIndex','enemyHealth','enemyMind','enemySpirituality','enemyStatus'])||!integer(e.terminal.historyIndex,e.startHistoryIndex,s.combatHistory.length-1)))return false;
    const end=e.terminal?e.terminal.historyIndex+1:s.combatHistory.length,rounds=s.combatHistory.slice(e.startHistoryIndex,end);
    if(!same(allNew,rounds.map((_r,i)=>e.startHistoryIndex!+i)))return false;
    for(const [i,round] of rounds.entries()){
      const o=round.planeswalkerOutcome,previous=rounds[i-1]?.planeswalkerOutcome;
      if(!validatePlaneswalkerRoundOutcome(o)||!validatePlaneswalkerCombatRound(round)||round.round!==i+1||o.source.runId!==s.runId||o.source.targetId!==e.targetId||o.source.randomSeed!==s.random.seed||o.source.revision>=s.revision||o.randomCursorAfter>s.random.cursor||
        o.source.startHistoryIndex!==e.startHistoryIndex||o.source.attemptWeek!==e.attemptWeek||(i<rounds.length-1&&!o.continuing))return false;
      if(previous){const expected:PlaneswalkerCombatSource={...structuredClone(previous.source),revision:previous.source.revision+1,round:i+1,site:structuredClone(previous.siteAfter),distanceMetres:previous.siteAfter.playerLocation==='NEAR'?4:0,
          playerHealth:previous.playerHealthAfter,playerMind:previous.playerMindAfter,playerSpirituality:Math.min(120,previous.playerSpiritualityAfter+12),enemyHealth:previous.enemyHealth,enemyMind:previous.enemyMind,enemySpirituality:previous.enemySpirituality,
          playerInjuries:structuredClone(previous.playerInjuriesAfter),enemyInjuries:structuredClone(previous.enemyInjuriesAfter),playerRisk:previous.playerRiskAfter,enemyRisk:previous.enemyRiskAfter,powerUses:{...previous.powerUses},randomCursor:previous.randomCursorAfter};
        if(!same(o.source,expected))return false;
      }else if(!same(o.source,e.startSource)||o.source.enemyHealth!==100||o.source.enemyMind!==100||o.source.enemySpirituality!==120||o.source.enemyRisk!==0||o.source.enemyInjuries.length!==0||!same(o.source.powerUses,initial.powerUses))return false;
    }
    const last=rounds.at(-1),o=last?.planeswalkerOutcome;
    if(o&&(o.enemyHealth!==e.enemyHealth||o.enemyMind!==e.enemyMind||o.enemySpirituality!==e.enemySpirituality||o.enemyStatus!==e.enemyStatus||!same(o.powerUses,e.powerUses)||!same(o.enemyInjuriesAfter,e.enemyInjuries)||o.enemyRiskAfter!==e.enemyRisk||!same(o.siteAfter,s.planeswalker.life.site)))return false;
    if(e.status==='FIGHTING'){
      if(e.terminal!==null||!hasPlaneswalkerDisputeOpponent(s))return false;
      if(!o)return s.combat!.lastRound===null&&same(currentPlaneswalkerCombatSource(s),e.startSource)&&same(e.powerUses,initial.powerUses)&&e.enemyHealth===100&&e.enemyMind===100&&e.enemySpirituality===120&&e.enemyRisk===0&&e.enemyInjuries.length===0;
      const actual=currentPlaneswalkerCombatSource(s),expected:PlaneswalkerCombatSource={...structuredClone(o.source),revision:o.source.revision+1,round:o.round+1,site:structuredClone(o.siteAfter),distanceMetres:o.siteAfter.playerLocation==='NEAR'?4:0,playerHealth:o.playerHealthAfter,playerMind:o.playerMindAfter,playerSpirituality:Math.min(120,o.playerSpiritualityAfter+12),enemyHealth:o.enemyHealth,enemyMind:o.enemyMind,enemySpirituality:o.enemySpirituality,
        playerInjuries:structuredClone(o.playerInjuriesAfter),enemyInjuries:structuredClone(o.enemyInjuriesAfter),playerRisk:o.playerRiskAfter,enemyRisk:o.enemyRiskAfter,powerUses:{...o.powerUses},randomCursor:o.randomCursorAfter};
      return o.continuing&&same(last,s.combat!.lastRound)&&same(actual,expected);
    }
    const t=e.terminal;if(s.combat?.encounterId==='PLANESWALKER_DISPUTE'||!t||!last||!o||o.continuing||t.round!==last.round||rounds.length!==t.round||t.enemyHealth!==e.enemyHealth||t.enemyMind!==e.enemyMind||t.enemySpirituality!==e.enemySpirituality||t.enemyStatus!==e.enemyStatus)return false;
    if(t.outcome==='RETREATED')return e.status==='RETREATED'&&last.retreat==='SUCCESS'&&last.winner==='ENEMY'&&o.playerHealthAfter>0;
    if(t.outcome==='PLAYER_DEAD')return e.status==='LOST'&&s.status==='DEAD'&&o.playerHealthAfter===0&&last.winner==='ENEMY';
    return e.status==='RESOLVED'&&last.winner==='PLAYER'&&last.retreat==='NONE'&&(t.outcome==='ENEMY_DEAD'?e.enemyStatus==='DEAD':t.outcome==='ENEMY_SURRENDERED'&&e.enemyStatus==='SURRENDERED');
  }catch{return false;}
}
