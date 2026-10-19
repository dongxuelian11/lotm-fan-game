import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasJusticeMentorLifeLock } from '../justice-mentor/life.js';
import { lightSeekerLifeClosed, hasLightSeekerLifeLock } from './life.js';
import { currentLightSeekerCombatSource, validateLightSeekerRoundOutcome, validateLightSeekerCombatRound, type LightSeekerCombatSource } from './combat.js';
import { validateLightSeekerSiteState, advanceLightSeekerTime, stopLightSeekerLight, type LightSeekerSiteState } from './resources.js';

export const LIGHT_SEEKER_TARGET_ID='LS2-OWEN' as const;
export const LIGHT_SEEKER_POWER_IDS=['LIGHT_STRIKE','LIGHT_WARD','SHUTTER_CLOSE'] as const;
export type LightSeekerPowerId=typeof LIGHT_SEEKER_POWER_IDS[number];
export type LightSeekerEnemyIntent=LightSeekerPowerId|'BODY_STRIKE'|'ACCIDENT';
export const LIGHT_SEEKER_POWERS=[
  {id:'LIGHT_STRIKE',label:'通线光击',cost:7,selfGain:105,enemyReduction:0},
  {id:'LIGHT_WARD',label:'一次防光',cost:6,selfGain:0,enemyReduction:60},
  {id:'SHUTTER_CLOSE',label:'手动关闭遮板',cost:0,selfGain:0,enemyReduction:0},
] as const;
export interface LightSeekerEncounterTerminal {
  outcome:'PLAYER_DEAD'|'RETREATED'|'ENEMY_DEAD'|'ENEMY_SURRENDERED';round:number;historyIndex:number;
  enemyHealth:number;enemyMind:number;enemySpirituality:number;enemyStatus:'RESISTING'|'SURRENDERED'|'DEAD';
}
export interface LightSeekerEncounterState {
  status:'AVAILABLE'|'READY'|'FIGHTING'|'RESOLVED'|'RETREATED'|'LOST';targetId:typeof LIGHT_SEEKER_TARGET_ID;
  approachWeek:number|null;approachRevision:number|null;attemptWeek:number|null;startHistoryIndex:number|null;
  /** Immutable closed-life input; life validation must prove exact journal equality. */
  startSite:LightSeekerSiteState|null;startSource:LightSeekerCombatSource|null;
  enemyHealth:number;enemyMind:number;enemySpirituality:number;enemyStatus:'RESISTING'|'SURRENDERED'|'DEAD';
  enemyLocation:'OTHER';enemyMetres:0;weaponLocation:'HAND'|'OTHER';enemyInjuries:SliceInjury[];enemyRisk:number;
  powerUses:Record<LightSeekerPowerId,number>;terminal:LightSeekerEncounterTerminal|null;
}
export type LightSeekerEncounterCommand={type:'ENCOUNTER_TALK'|'ENCOUNTER_FIGHT'|'LEAVE_ENCOUNTER'};
export interface LightSeekerEncounterAction{id:string;label:string;cost:string;enabled:boolean;reason:string|null;command:LightSeekerEncounterCommand}
export interface LightSeekerEncounterProjection {
  title:string;story:string;status:LightSeekerEncounterState['status'];inside:boolean;site:LightSeekerSiteState|null;startSite:LightSeekerSiteState|null;
  enemy:null|{id:typeof LIGHT_SEEKER_TARGET_ID;name:'欧文·赛尔';age:51;source:'ORIGINAL_GALLERY_ADULT';sequence:2;health:number;mind:number;spirituality:number;
    status:LightSeekerEncounterState['enemyStatus'];weaponId:'LS2-OWEN-CLUB';weaponLocation:'HAND'|'OTHER';location:'OTHER';powerUses:Record<LightSeekerPowerId,number>};
  actions:LightSeekerEncounterAction[];facts:string[];
}
export const LIGHT_SEEKER_ENCOUNTER_STORY='51岁的欧文·赛尔在采光廊里提出通路争议，手里拿着自己的棍。先征得玛拉本次同意，让她沿普通通路步行9米、耗时9秒退到侧区，消耗2精力；芦影留在侧区。你再走入2米，与站在4米处的欧文交谈。中间3米处的遮板沿用之前的状态和损耗，它遮光，但不堵住普通地面。交谈后仍可和平离开；交战需要另作选择。开战后双方相距2米，每次动作5秒、每回合60秒。限光仅在后续真正的光击出现时减弱一次，不能抵棍击；光路受阻时只执行普通动作。伤势和死亡风险真实存在。';
export function createLightSeekerEncounterState():LightSeekerEncounterState {
  return{status:'AVAILABLE',targetId:LIGHT_SEEKER_TARGET_ID,approachWeek:null,approachRevision:null,attemptWeek:null,startHistoryIndex:null,startSite:null,startSource:null,
    enemyHealth:100,enemyMind:100,enemySpirituality:120,enemyStatus:'RESISTING',enemyLocation:'OTHER',enemyMetres:0,weaponLocation:'HAND',enemyInjuries:[],enemyRisk:0,
    powerUses:{LIGHT_STRIKE:0,LIGHT_WARD:0,SHUTTER_CLOSE:0},terminal:null};
}
const stage=(s:SliceState)=>s.progression.pathwayId==='sun'&&s.progression.sequence===2;
const same=(a:unknown,b:unknown)=>a===b||(a!==undefined&&b!==undefined&&stableStringify(a)===stableStringify(b));
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&(v as number)>=min&&(v as number)<=max;
const shape=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...keys].sort());
export function validateLightSeekerEncounterCommand(v:unknown):v is LightSeekerEncounterCommand{return shape(v,['type'])&&['ENCOUNTER_TALK','ENCOUNTER_FIGHT','LEAVE_ENCOUNTER'].includes(String((v as{type:unknown}).type));}
export const isLightSeekerEncounterCommand=validateLightSeekerEncounterCommand;
export const hasLightSeekerEncounterLock=(s:SliceState):boolean=>['READY','FIGHTING'].includes(s.lightSeeker.encounter.status);
export const isInsideLightSeekerEncounter=hasLightSeekerEncounterLock;
function otherSceneOpen(s:SliceState):boolean {
  return s.lightSeeker.preparedWeek!==null||hasLightSeekerLifeLock(s)||hasJusticeMentorLifeLock(s)||s.justiceMentor.preparedWeek!==null||['READY','FIGHTING'].includes(s.justiceMentor.encounter.status);
}
function closedSite(site:LightSeekerSiteState):boolean {
  return validateLightSeekerSiteState(site)&&site.playerLocation==='ENTRY'&&site.operatorLocation==='ENTRY'&&site.operatorEnergy>=2&&site.spiritLocation==='SIDE'&&
    site.light.mode==='OFF'&&site.cover.position==='OWNER_STAND'&&site.board.location==='FAR_STAND'&&site.board.owner==='LS2-MARA'&&site.shutter.state!=='OPEN'&&site.ordinaryExit==='OPEN';
}
/** Replays consent and ordinary travel from the exact closed life site, never a fresh stock. */
export function lightSeekerApproachedSite(start:LightSeekerSiteState,week:number):LightSeekerSiteState {
  if(!closedSite(start)||!integer(week,1))throw new Error('先收束采光廊，玛拉还须有2精力走到侧区。');
  const site=structuredClone(start);site.operatorConsent='GRANTED';site.operatorConsentWeek=week;
  site.operatorLocation='SIDE';site.operatorMetres+=9;site.operatorEnergy-=2;advanceLightSeekerTime(site,9);
  site.playerLocation='NEAR';site.playerMetres+=2;advanceLightSeekerTime(site,2);return site;
}
function leaveSite(site:LightSeekerSiteState):void {
  if(site.playerLocation!=='NEAR'||site.ordinaryExit!=='OPEN')throw new Error('当前位置不在廊道近端，或出口并未开放。');
  stopLightSeekerLight(site);site.playerLocation='ENTRY';site.playerMetres+=2;advanceLightSeekerTime(site,2);
}
export function blockLightSeekerEncounter(s:SliceState,c:LightSeekerEncounterCommand):string|null {
  if(!validateLightSeekerEncounterCommand(c))return'采光廊遭遇命令无效。';const e=s.lightSeeker.encounter;
  if(s.status!=='ACTIVE'||!stage(s)||s.health<=0)return'须本人仍活着并已成为逐光者。';
  if(s.activeEvent||s.combat)return'先处理当前事件或战斗。';if(s.world.city!=='BACKLUND')return'须在贝克兰德的采光廊。';
  if(otherSceneOpen(s))return'先收束当前准备、实践和其他现场。';
  if(c.type==='LEAVE_ENCOUNTER')return e.status==='READY'&&s.lightSeeker.life.site.playerLocation==='NEAR'?null:'先到廊道近端交谈，才能沿普通通路离开。';
  if(s.mind<=0)return'先恢复精神；交谈后仍可普通离开。';if(s.actionsRemaining<1)return'这次选择需要1行动。';
  if(c.type==='ENCOUNTER_TALK'){
    if(e.status!=='AVAILABLE')return'与欧文的接触已有进展或结局。';
    if(!lightSeekerLifeClosed(s)||!s.lightSeeker.life.reflected)return'先报告三次实践并完成反思。';
    if(!closedSite(s.lightSeeker.life.site))return'先停止施光、归还遮光物、返回入口，让玛拉也在入口；玛拉还须有2精力。';
    return s.actionsRemaining<2?'交谈需1行动，请另留1行动决定是否交战；到场后也能不花行动和平离开。':null;
  }
  const site=s.lightSeeker.life.site;
  return e.status==='READY'&&site.playerLocation==='NEAR'&&site.operatorLocation==='SIDE'&&site.spiritLocation==='SIDE'&&site.operatorConsent==='GRANTED'&&site.operatorConsentWeek===s.week?null:'先与欧文交谈，确认玛拉和芦影在侧区，普通出口开放。';
}
export const lightSeekerEncounterReason=blockLightSeekerEncounter;
export function applyLightSeekerEncounterCommand(s:SliceState,c:LightSeekerEncounterCommand,ctx:SeerContext):void {
  const reason=blockLightSeekerEncounter(s,c);if(reason)throw new Error(reason);const e=s.lightSeeker.encounter;
  if(c.type==='LEAVE_ENCOUNTER'){leaveSite(s.lightSeeker.life.site);e.status='RESOLVED';ctx.note('离开采光廊','你沿普通通路步行2米、耗时2秒回到入口。玛拉和芦影仍在侧区，欧文持棍留在廊道里。');return;}
  s.actionsRemaining--;
  if(c.type==='ENCOUNTER_TALK'){
    e.startSite=structuredClone(s.lightSeeker.life.site);s.lightSeeker.life.site=lightSeekerApproachedSite(e.startSite,s.week);e.status='READY';e.approachWeek=s.week;e.approachRevision=s.revision+1;
    ctx.note('与欧文交谈',LIGHT_SEEKER_ENCOUNTER_STORY+'你尚未选择交战。');return;
  }
  e.status='FIGHTING';e.attemptWeek=s.week;e.startHistoryIndex=s.combatHistory.length;
  s.combat={encounterId:'LIGHT_SEEKER_DISPUTE',round:1,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemyInjuries:structuredClone(e.enemyInjuries),enemyRisk:e.enemyRisk,enemyStatus:'RESISTING',lastRound:null};
  const source=currentLightSeekerCombatSource(s);if(!source)throw new Error('采光廊的开战来源不完整。');e.startSource={...source,revision:s.revision+1};
  ctx.note('采光廊交战','你选择与欧文交战。双方各用自己的灵性，遮板、灯油和既有伤势沿用当前状态。');
}
export const applyLightSeekerEncounter=applyLightSeekerEncounterCommand;
export function startLightSeekerEncounter(s:SliceState,ctx:SeerContext):void{applyLightSeekerEncounterCommand(s,{type:'ENCOUNTER_FIGHT'},ctx);}
export function hasLightSeekerDisputeOpponent(s:SliceState):boolean {
  const e=s.lightSeeker?.encounter,c=s.combat,site=s.lightSeeker?.life.site;
  return stage(s)&&s.status==='ACTIVE'&&s.health>0&&s.mind>0&&!s.activeEvent&&s.world.city==='BACKLUND'&&!otherSceneOpen(s)&&!!e&&e.status==='FIGHTING'&&
    e.targetId===LIGHT_SEEKER_TARGET_ID&&e.enemyLocation==='OTHER'&&e.enemyMetres===0&&e.terminal===null&&e.enemyStatus==='RESISTING'&&e.weaponLocation==='HAND'&&e.approachWeek!==null&&e.attemptWeek===s.week&&
    validateLightSeekerSiteState(site)&&site.playerLocation==='NEAR'&&site.operatorLocation==='SIDE'&&site.spiritLocation==='SIDE'&&site.operatorConsent==='GRANTED'&&site.operatorConsentWeek===s.week&&site.ordinaryExit==='OPEN'&&
    c?.encounterId==='LIGHT_SEEKER_DISPUTE'&&c.enemyStatus==='RESISTING'&&c.enemyHealth>0&&c.enemyMind>0&&e.enemyHealth===c.enemyHealth&&e.enemyMind===c.enemyMind&&same(e.enemyInjuries,c.enemyInjuries)&&e.enemyRisk===c.enemyRisk&&integer(e.enemySpirituality,0,120)&&
    LIGHT_SEEKER_POWER_IDS.every(id=>integer(e.powerUses[id]))&&e.enemySpirituality===120-LIGHT_SEEKER_POWERS.reduce((n,p)=>n+e.powerUses[p.id]*p.cost,0)&&integer(c.round,1)&&e.startHistoryIndex!==null&&integer(e.startHistoryIndex)&&s.combatHistory.length-e.startHistoryIndex===c.round-1;
}
export function settleLightSeekerEncounter(s:SliceState,outcome:string,ctx:SeerContext,_award?:(source:string,amount:5|8|25)=>void):void {
  const e=s.lightSeeker.encounter,c=s.combat;if(e.status!=='FIGHTING'||c?.encounterId!=='LIGHT_SEEKER_DISPUTE')throw new Error('当前没有与欧文进行的战斗。');if(outcome==='CONTINUE')return;
  if(!['PLAYER_DEAD','RETREATED','ENEMY_DEAD','ENEMY_SURRENDERED'].includes(outcome))throw new Error('未知战斗结果。');
  const last=c.lastRound,o=last?.lightSeekerOutcome;
  if(e.terminal||e.startHistoryIndex===null||!last||!validateLightSeekerRoundOutcome(o)||!validateLightSeekerCombatRound(last)||o.continuing||c.round!==last.round+1||
    s.combatHistory.length-e.startHistoryIndex!==last.round||!same(s.combatHistory.at(-1),last)||!same(o.siteAfter,s.lightSeeker.life.site)||
    o.enemyHealth!==c.enemyHealth||o.enemyMind!==c.enemyMind||o.enemySpirituality!==e.enemySpirituality||!same(o.powerUses,e.powerUses)||!same(o.enemyInjuriesAfter,c.enemyInjuries)||o.enemyRiskAfter!==c.enemyRisk||
    !same(o.playerInjuriesAfter,s.injuries)||o.playerRiskAfter!==s.injuryRisk||o.playerHealthAfter!==s.health||o.playerMindAfter!==s.mind||o.playerSpiritualityAfter!==s.spirituality||
    (outcome==='PLAYER_DEAD'&&(s.health!==0||last.winner!=='ENEMY'||last.retreat==='SUCCESS'))||(outcome==='RETREATED'&&(last.retreat!=='SUCCESS'||last.winner!=='ENEMY'||s.health<=0))||
    (outcome==='ENEMY_DEAD'&&(c.enemyStatus!=='DEAD'||c.enemyHealth!==0||last.winner!=='PLAYER'||last.retreat!=='NONE'))||(outcome==='ENEMY_SURRENDERED'&&(c.enemyStatus!=='SURRENDERED'||c.enemyHealth<=0||last.winner!=='PLAYER'||last.retreat!=='NONE')))
    throw new Error('身体、现场、资源或完整战斗结果不符。');
  e.terminal={outcome:outcome as LightSeekerEncounterTerminal['outcome'],round:last.round,historyIndex:s.combatHistory.length-1,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,enemyStatus:e.enemyStatus};
  e.status=outcome==='PLAYER_DEAD'?'LOST':outcome==='RETREATED'?'RETREATED':'RESOLVED';s.combat=null;
  ctx.note('采光廊冲突结束',`${outcome==='PLAYER_DEAD'?'你已死亡，身体留在廊道近端。':'你已经沿普通通路步行2米、耗时2秒回到入口。'}玛拉和芦影仍在侧区。欧文、他的棍，以及现场物件保留当前状态。`);
}
export const finishLightSeekerEncounter=settleLightSeekerEncounter;
export function lightSeekerEncounterActions(s:SliceState):LightSeekerEncounterAction[] {
  if(!stage(s))return[];
  return([['ENCOUNTER_TALK','清场后与欧文交谈','1行动；玛拉9米/9秒/2精力，你2米/2秒'],['ENCOUNTER_FIGHT','选择与欧文交战','1行动；有受伤和死亡风险'],['LEAVE_ENCOUNTER','沿通路和平离开','0行动；2米/2秒']]as const).map(([type,label,cost])=>{const command:LightSeekerEncounterCommand={type},reason=blockLightSeekerEncounter(s,command);return{id:`light-seeker-${type}`,label,cost,command,enabled:reason===null,reason};});
}
export function projectLightSeekerEncounter(s:SliceState):LightSeekerEncounterProjection {
  const e=s.lightSeeker.encounter;if(!stage(s))return{title:'尚未开放的采光廊遭遇',story:'',status:e.status,inside:false,site:null,startSite:null,enemy:null,actions:[],facts:[]};
  return{title:'采光廊里的欧文',story:LIGHT_SEEKER_ENCOUNTER_STORY,status:e.status,inside:hasLightSeekerEncounterLock(s),site:structuredClone(s.lightSeeker.life.site),startSite:structuredClone(e.startSite),
    enemy:{id:LIGHT_SEEKER_TARGET_ID,name:'欧文·赛尔',age:51,source:'ORIGINAL_GALLERY_ADULT',sequence:2,health:e.enemyHealth,mind:e.enemyMind,spirituality:e.enemySpirituality,status:e.enemyStatus,weaponId:'LS2-OWEN-CLUB',weaponLocation:e.weaponLocation,location:e.enemyLocation,powerUses:{...e.powerUses}},
    actions:lightSeekerEncounterActions(s),facts:['欧文站在廊道4米处，手中的棍属于他。','玛拉和芦影在侧区后才可开战；太阳光仍会影响光路中的其他人。','中间遮板阻挡直射光，普通地面和入口保持可通行。','灯油、遮板和遮光物沿用此前状态；损坏不会随交谈或开战恢复。','限光只抵一次实际光击，防光也只有实际受光才产生减免；棍击照常可能致伤。','欧文的灵性逐次消耗，战斗不会获得新的掌握。']};
}
/** Life validator proves startSite from its exact closed journal. This validator proves approach, all original rounds, and the one live site thereafter. */
export function validateLightSeekerEncounter(s:SliceState):boolean {
  try {
    const e=s.lightSeeker?.encounter,initial=createLightSeekerEncounterState();
    if(!e||!shape(e,Object.keys(initial))||e.targetId!==LIGHT_SEEKER_TARGET_ID||e.enemyLocation!=='OTHER'||e.enemyMetres!==0||!['AVAILABLE','READY','FIGHTING','RESOLVED','RETREATED','LOST'].includes(e.status)||
      !integer(e.enemyHealth,0,100)||e.enemyMind!==100||!integer(e.enemySpirituality,0,120)||!integer(e.enemyRisk)||!Array.isArray(e.enemyInjuries)||
      !['RESISTING','SURRENDERED','DEAD'].includes(e.enemyStatus)||(e.enemyStatus==='DEAD')!==(e.enemyHealth===0)||e.weaponLocation!==(e.enemyStatus==='RESISTING'?'HAND':'OTHER')||
      !shape(e.powerUses,LIGHT_SEEKER_POWER_IDS)||!LIGHT_SEEKER_POWER_IDS.every(id=>integer(e.powerUses[id]))||e.enemySpirituality!==120-LIGHT_SEEKER_POWERS.reduce((n,p)=>n+e.powerUses[p.id]*p.cost,0)||
      [e.approachWeek,e.attemptWeek].some(w=>w!==null&&!integer(w,1,s.week)))return false;
    const allNew=s.combatHistory.flatMap((r,i)=>r.lightSeekerOutcome?[i]:[]);
    if(e.status==='AVAILABLE')return same(e,initial)&&allNew.length===0&&s.combat?.encounterId!=='LIGHT_SEEKER_DISPUTE';
    if(!stage(s)||s.lightSeeker.promotionWeek===null||e.approachWeek===null||e.approachWeek<s.lightSeeker.promotionWeek||!integer(e.approachRevision,1,s.revision)||
      !lightSeekerLifeClosed(s)||!s.lightSeeker.life.reflected||!e.startSite||!closedSite(e.startSite))return false;
    const approached=lightSeekerApproachedSite(e.startSite,e.approachWeek);
    if(e.startHistoryIndex===null){const ready=e.status==='READY',peaceful=e.status==='RESOLVED';const expected=structuredClone(approached);if(peaceful)leaveSite(expected);
      return(ready||peaceful)&&e.attemptWeek===null&&e.startSource===null&&e.terminal===null&&allNew.length===0&&same(s.lightSeeker.life.site,expected)&&
        same({...e,status:initial.status,approachWeek:null,approachRevision:null,startSite:null},initial)&&s.combat?.encounterId!=='LIGHT_SEEKER_DISPUTE'&&(!ready||s.status==='ACTIVE'&&!otherSceneOpen(s));}
    if(!integer(e.startHistoryIndex,0,s.combatHistory.length)||e.attemptWeek===null||e.attemptWeek<e.approachWeek||!e.startSource||e.startSource.round!==1||!same(e.startSource.site,approached)||
      e.startSource.runId!==s.runId||e.startSource.randomSeed!==s.random.seed||e.startSource.attemptWeek!==e.attemptWeek||e.startSource.startHistoryIndex!==e.startHistoryIndex||e.startSource.revision<=e.approachRevision||e.startSource.revision>s.revision)return false;
    if(e.terminal&&(!shape(e.terminal,['outcome','round','historyIndex','enemyHealth','enemyMind','enemySpirituality','enemyStatus'])||!integer(e.terminal.historyIndex,e.startHistoryIndex,s.combatHistory.length-1)))return false;
    const end=e.terminal?e.terminal.historyIndex+1:s.combatHistory.length,rounds=s.combatHistory.slice(e.startHistoryIndex,end);
    if(!same(allNew,rounds.map((_r,i)=>e.startHistoryIndex!+i)))return false;
    for(const [i,round] of rounds.entries()){
      const o=round.lightSeekerOutcome,previous=rounds[i-1]?.lightSeekerOutcome;
      if(!validateLightSeekerRoundOutcome(o)||!validateLightSeekerCombatRound(round)||round.round!==i+1||o.source.runId!==s.runId||o.source.randomSeed!==s.random.seed||o.source.revision>=s.revision||o.randomCursorAfter>s.random.cursor||
        o.source.startHistoryIndex!==e.startHistoryIndex||o.source.attemptWeek!==e.attemptWeek||(i<rounds.length-1&&!o.continuing))return false;
      if(previous){const expected:LightSeekerCombatSource={...structuredClone(previous.source),revision:previous.source.revision+1,round:i+1,site:structuredClone(previous.siteAfter),
          playerHealth:previous.playerHealthAfter,playerMind:previous.playerMindAfter,playerSpirituality:Math.min(120,previous.playerSpiritualityAfter+12),enemyHealth:previous.enemyHealth,enemyMind:previous.enemyMind,enemySpirituality:previous.enemySpirituality,
          playerInjuries:structuredClone(previous.playerInjuriesAfter),enemyInjuries:structuredClone(previous.enemyInjuriesAfter),playerRisk:previous.playerRiskAfter,enemyRisk:previous.enemyRiskAfter,powerUses:{...previous.powerUses},randomCursor:previous.randomCursorAfter};
        if(!same(o.source,expected))return false;
      }else if(!same(o.source,e.startSource)||o.source.enemyHealth!==100||o.source.enemyMind!==100||o.source.enemySpirituality!==120||o.source.enemyRisk!==0||o.source.enemyInjuries.length!==0||!same(o.source.powerUses,initial.powerUses))return false;
    }
    const last=rounds.at(-1),o=last?.lightSeekerOutcome;
    if(o&&(o.enemyHealth!==e.enemyHealth||o.enemyMind!==e.enemyMind||o.enemySpirituality!==e.enemySpirituality||o.enemyStatus!==e.enemyStatus||!same(o.powerUses,e.powerUses)||!same(o.enemyInjuriesAfter,e.enemyInjuries)||o.enemyRiskAfter!==e.enemyRisk||!same(o.siteAfter,s.lightSeeker.life.site)))return false;
    if(e.status==='FIGHTING'){
      if(e.terminal!==null||!hasLightSeekerDisputeOpponent(s))return false;
      if(!o)return s.combat!.lastRound===null&&same(currentLightSeekerCombatSource(s),e.startSource)&&same(e.powerUses,initial.powerUses)&&e.enemyHealth===100&&e.enemyMind===100&&e.enemySpirituality===120&&e.enemyRisk===0&&e.enemyInjuries.length===0;
      const actual=currentLightSeekerCombatSource(s),expected:LightSeekerCombatSource={...structuredClone(o.source),revision:o.source.revision+1,round:o.round+1,site:structuredClone(o.siteAfter),playerHealth:o.playerHealthAfter,playerMind:o.playerMindAfter,playerSpirituality:Math.min(120,o.playerSpiritualityAfter+12),enemyHealth:o.enemyHealth,enemyMind:o.enemyMind,enemySpirituality:o.enemySpirituality,
        playerInjuries:structuredClone(o.playerInjuriesAfter),enemyInjuries:structuredClone(o.enemyInjuriesAfter),playerRisk:o.playerRiskAfter,enemyRisk:o.enemyRiskAfter,powerUses:{...o.powerUses},randomCursor:o.randomCursorAfter};
      return o.continuing&&same(last,s.combat!.lastRound)&&same(actual,expected);
    }
    const t=e.terminal;if(s.combat?.encounterId==='LIGHT_SEEKER_DISPUTE'||!t||!last||!o||o.continuing||t.round!==last.round||rounds.length!==t.round||t.enemyHealth!==e.enemyHealth||t.enemyMind!==e.enemyMind||t.enemySpirituality!==e.enemySpirituality||t.enemyStatus!==e.enemyStatus)return false;
    if(t.outcome==='RETREATED')return e.status==='RETREATED'&&last.retreat==='SUCCESS'&&last.winner==='ENEMY'&&o.playerHealthAfter>0;
    if(t.outcome==='PLAYER_DEAD')return e.status==='LOST'&&s.status==='DEAD'&&o.playerHealthAfter===0&&last.winner==='ENEMY';
    return e.status==='RESOLVED'&&last.winner==='PLAYER'&&last.retreat==='NONE'&&(t.outcome==='ENEMY_DEAD'?e.enemyStatus==='DEAD':t.outcome==='ENEMY_SURRENDERED'&&e.enemyStatus==='SURRENDERED');
  }catch{return false;}
}
