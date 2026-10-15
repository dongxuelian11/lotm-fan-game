import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasLongChapterHandoff, isLongChapterEraClosed } from '../long-chapter/index.js';
import { hasFerrymanRitualLock } from '../ferryman/index.js';
import { hasFerrymanLifeLock } from '../ferryman/life.js';
import { deathConsulLifeClosed, hasDeathConsulLifeLock } from './life.js';
import { currentDeathConsulCombatSource, validateDeathConsulRoundOutcome, validateDeathConsulCombatRound, leaveDeathConsulCombatSite,
  type DeathConsulCombatSource } from './combat.js';
import { validateDeathConsulSiteState, advanceDeathConsulTime, type DeathConsulSiteState, type DeathConsulSourceEra } from './resources.js';

/** These are distinct authored contemporaries, never one ordinary body surviving the sixty-year handoff. */
export const DEATH_CONSUL_TARGETS = {
  ORIGINAL: { id:'DC2-O-ROOK',name:'鲁克·艾文',age:47,source:'ORIGINAL_SEAL_HOUSE_ADULT',weaponId:'DC2-O-ROOK-CLUB' },
  POST_CYCLE: { id:'DC2-P-NOLAN',name:'诺兰·艾文',age:45,source:'POST_CYCLE_SEAL_HOUSE_ADULT',weaponId:'DC2-P-NOLAN-CLUB' },
} as const;
export type DeathConsulTargetId=typeof DEATH_CONSUL_TARGETS[DeathConsulSourceEra]['id'];
export const DEATH_CONSUL_TARGET_IDS=['DC2-O-ROOK','DC2-P-NOLAN'] as const;
export const DEATH_CONSUL_POWER_IDS=['PALE_STRIKE','STEADY','CLOSE_DOOR'] as const;
export type DeathConsulPowerId=typeof DEATH_CONSUL_POWER_IDS[number];
export type DeathConsulEnemyIntent=DeathConsulPowerId|'BODY_STRIKE'|'ACCIDENT';
export const DEATH_CONSUL_POWERS=[
  {id:'PALE_STRIKE',label:'有限苍白法术',cost:5,selfGain:75,enemyReduction:0},
  {id:'STEADY',label:'一次定神',cost:4,selfGain:0,enemyReduction:0},
  {id:'CLOSE_DOOR',label:'普通关闭门扇',cost:0,selfGain:0,enemyReduction:0},
] as const;
export interface DeathConsulEncounterTerminal {
  outcome:'PLAYER_DEAD'|'RETREATED'|'ENEMY_DEAD'|'ENEMY_SURRENDERED';round:number;historyIndex:number;
  enemyHealth:number;enemyMind:number;enemySpirituality:number;enemyStatus:'RESISTING'|'SURRENDERED'|'DEAD';
}
export interface DeathConsulEncounterState {
  status:'AVAILABLE'|'READY'|'FIGHTING'|'RESOLVED'|'RETREATED'|'LOST';targetId:DeathConsulTargetId|null;sourceEra:DeathConsulSourceEra|null;
  approachWeek:number|null;approachRevision:number|null;attemptWeek:number|null;startHistoryIndex:number|null;
  /** Exact closed-life input. Life validation proves the complete preceding journal. */
  startSite:DeathConsulSiteState|null;startSource:DeathConsulCombatSource|null;
  enemyHealth:number;enemyMind:number;enemySpirituality:number;enemyStatus:'RESISTING'|'SURRENDERED'|'DEAD';
  enemyLocation:'OTHER';enemyMetres:0;weaponLocation:'HAND'|'OTHER';enemyInjuries:SliceInjury[];enemyRisk:number;
  powerUses:Record<DeathConsulPowerId,number>;terminal:DeathConsulEncounterTerminal|null;
}
export type DeathConsulEncounterCommand={type:'ENCOUNTER_TALK'|'ENCOUNTER_FIGHT'|'LEAVE_ENCOUNTER'};
export interface DeathConsulEncounterAction{id:string;label:string;cost:string;enabled:boolean;reason:string|null;command:DeathConsulEncounterCommand}
export interface DeathConsulEncounterProjection {
  title:string;story:string;status:DeathConsulEncounterState['status'];inside:boolean;site:DeathConsulSiteState|null;startSite:DeathConsulSiteState|null;
  enemy:null|{id:DeathConsulTargetId;name:string;age:47|45;source:string;sourceEra:DeathConsulSourceEra;sequence:3;health:number;mind:number;spirituality:number;
    status:DeathConsulEncounterState['enemyStatus'];weaponId:'DC2-O-ROOK-CLUB'|'DC2-P-NOLAN-CLUB';weaponLocation:'HAND'|'OTHER';location:'OTHER';powerUses:Record<DeathConsulPowerId,number>};
  actions:DeathConsulEncounterAction[];facts:string[];
}
export const DEATH_CONSUL_ENCOUNTER_STORY='封存室里的一名当代成年法术使用者提出通路争议，拿着自己的棍。先取得现场管理人本次同意，让对方从入口沿普通通路退到室外，实际步行2米、耗时2秒并消耗2精力；你再走入2米，与站在4米处的对手交谈。中间3米处的门沿用此前状态，原封存物仍留在入口台面。交谈后可和平离开，交战需要另作选择。苍白焰和灵界短渡均须开门清路；短渡成功才会把你本人移动2米，并准备一次仅针对后续身体攻击的避让。伤势和死亡风险真实存在。';
export function createDeathConsulEncounterState():DeathConsulEncounterState {
  return{status:'AVAILABLE',targetId:null,sourceEra:null,approachWeek:null,approachRevision:null,attemptWeek:null,startHistoryIndex:null,startSite:null,startSource:null,
    enemyHealth:100,enemyMind:100,enemySpirituality:120,enemyStatus:'RESISTING',enemyLocation:'OTHER',enemyMetres:0,weaponLocation:'HAND',enemyInjuries:[],enemyRisk:0,
    powerUses:{PALE_STRIKE:0,STEADY:0,CLOSE_DOOR:0},terminal:null};
}
const stage=(s:SliceState)=>s.progression.pathwayId==='death'&&s.progression.sequence===2;
const same=(a:unknown,b:unknown)=>a===b||(a!==undefined&&b!==undefined&&stableStringify(a)===stableStringify(b));
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&(v as number)>=min&&(v as number)<=max;
const shape=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...keys].sort());
export function validateDeathConsulEncounterCommand(v:unknown):v is DeathConsulEncounterCommand{return shape(v,['type'])&&['ENCOUNTER_TALK','ENCOUNTER_FIGHT','LEAVE_ENCOUNTER'].includes(String((v as{type:unknown}).type));}
export const isDeathConsulEncounterCommand=validateDeathConsulEncounterCommand;
export const hasDeathConsulEncounterLock=(s:SliceState):boolean=>['READY','FIGHTING'].includes(s.deathConsul.encounter.status);
export const isInsideDeathConsulEncounter=hasDeathConsulEncounterLock;
function currentEra(s:SliceState):DeathConsulSourceEra|null {
  const era=s.deathConsul.sourceEra;
  if(era==='POST_CYCLE')return hasLongChapterHandoff(s)&&isLongChapterEraClosed(s)?era:null;
  return era==='ORIGINAL'&&!hasLongChapterHandoff(s)?era:null;
}
function otherSceneOpen(s:SliceState):boolean {
  const era=currentEra(s);
  if(!era||s.deathConsul.preparedWeek!==null||hasDeathConsulLifeLock(s))return true;
  if(era==='POST_CYCLE')return s.ferryman.era.location!=='RECEPTION';
  return hasFerrymanLifeLock(s)||hasFerrymanRitualLock(s)||['READY','FIGHTING'].includes(s.ferryman.encounter.status);
}
function closedSite(site:DeathConsulSiteState):boolean {
  return validateDeathConsulSiteState(site)&&site.sourceEra!==null&&site.playerLocation==='ENTRY'&&site.operatorLocation==='ENTRY'&&site.operatorEnergy>=2&&
    site.effect.mode==='OFF'&&site.door.state!=='OPEN'&&site.ordinaryExit==='OPEN'&&site.residual.location==='ENTRY_STAND'&&site.residual.container==='CLOSED'&&site.residual.seal!=='BROKEN'&&site.residual.heatSeconds===0;
}
/** Consent and ordinary travel are replayed from the closed life site; no object or person is replaced. */
export function deathConsulApproachedSite(start:DeathConsulSiteState,week:number):DeathConsulSiteState {
  if(!closedSite(start)||!integer(week,1)||start.introducedWeek===null||start.introducedWeek>week)throw new Error('先收束封存室，现场管理人还须有2精力走到室外。');
  const site=structuredClone(start);site.operatorConsent='GRANTED';site.operatorConsentWeek=week;
  site.operatorLocation='OUTSIDE';site.operatorMetres+=2;site.operatorEnergy-=2;advanceDeathConsulTime(site,2);
  site.playerLocation='NEAR';site.playerMetres+=2;advanceDeathConsulTime(site,2);return site;
}
export function blockDeathConsulEncounter(s:SliceState,c:DeathConsulEncounterCommand):string|null {
  if(!validateDeathConsulEncounterCommand(c))return'封存室遭遇命令无效。';const e=s.deathConsul.encounter;
  if(s.status!=='ACTIVE'||!stage(s)||s.health<=0)return'须本人仍活着并已成为死亡执政官。';
  if(s.activeEvent||s.combat)return'先处理当前事件或战斗。';if(s.world.city!=='BACKLUND')return'须在贝克兰德的封存室。';
  if(otherSceneOpen(s))return'先收束当前准备、实践和其他现场，并回到本时代接待处。';
  const era=currentEra(s);if(!era||s.deathConsul.life.site.sourceEra!==era||e.sourceEra!==null&&e.sourceEra!==era)return'须本时代实际引介的现场和对手。';
  if(c.type==='LEAVE_ENCOUNTER')return e.status==='READY'&&s.deathConsul.life.site.playerLocation==='NEAR'?null:'先到室内近端交谈，才能沿普通通路离开。';
  if(s.mind<=0)return'先恢复精神；交谈后仍可普通离开。';if(s.actionsRemaining<1)return'这次选择需要1行动。';
  if(c.type==='ENCOUNTER_TALK'){
    if(e.status!=='AVAILABLE')return'本次对手的接触已有进展或结局。';
    if(!deathConsulLifeClosed(s)||!s.deathConsul.life.reflected)return'先报告三次实践并完成反思。';
    if(!closedSite(s.deathConsul.life.site))return'先停止法术、封好原物并等它冷却，再与现场管理人返回入口；对方还须有2精力。';
    return s.actionsRemaining<2?'交谈需1行动，请另留1行动决定是否交战；到场后也能不花行动和平离开。':null;
  }
  const site=s.deathConsul.life.site;
  return e.status==='READY'&&site.playerLocation==='NEAR'&&site.operatorLocation==='OUTSIDE'&&site.operatorConsent==='GRANTED'&&site.operatorConsentWeek===s.week?null:'先实际交谈，让现场管理人退到室外，确认普通出口开放。';
}
export const deathConsulEncounterReason=blockDeathConsulEncounter;
export function applyDeathConsulEncounterCommand(s:SliceState,c:DeathConsulEncounterCommand,ctx:SeerContext):void {
  const reason=blockDeathConsulEncounter(s,c);if(reason)throw new Error(reason);const e=s.deathConsul.encounter;
  if(c.type==='LEAVE_ENCOUNTER'){const metres=leaveDeathConsulCombatSite(s.deathConsul.life.site);e.status='RESOLVED';ctx.note('离开封存室',`你沿普通通路步行${metres}米、耗时${metres}秒回到入口。现场管理人仍在室外，对手持棍留在室内。`);return;}
  s.actionsRemaining--;
  if(c.type==='ENCOUNTER_TALK'){
    e.sourceEra=currentEra(s)!;e.targetId=DEATH_CONSUL_TARGETS[e.sourceEra].id;e.startSite=structuredClone(s.deathConsul.life.site);s.deathConsul.life.site=deathConsulApproachedSite(e.startSite,s.week);e.status='READY';e.approachWeek=s.week;e.approachRevision=s.revision+1;
    const target=DEATH_CONSUL_TARGETS[e.sourceEra];ctx.note(`与${target.name}交谈`,`${target.age}岁的${target.name}是这次实际接触的当代对手。`+DEATH_CONSUL_ENCOUNTER_STORY+'你尚未选择交战。');return;
  }
  e.status='FIGHTING';e.attemptWeek=s.week;e.startHistoryIndex=s.combatHistory.length;
  s.combat={encounterId:'DEATH_CONSUL_DISPUTE',round:1,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemyInjuries:structuredClone(e.enemyInjuries),enemyRisk:e.enemyRisk,enemyStatus:'RESISTING',lastRound:null};
  const source=currentDeathConsulCombatSource(s);if(!source)throw new Error('封存室的开战来源不完整。');e.startSource={...source,revision:s.revision+1};
  ctx.note('封存室交战',`你选择与${source.targetName}交战。双方各用自己的灵性，原门、封存物和既有伤势沿用当前状态。`);
}
export const applyDeathConsulEncounter=applyDeathConsulEncounterCommand;
export function startDeathConsulEncounter(s:SliceState,ctx:SeerContext):void{applyDeathConsulEncounterCommand(s,{type:'ENCOUNTER_FIGHT'},ctx);}
export function hasDeathConsulDisputeOpponent(s:SliceState):boolean {
  const e=s.deathConsul?.encounter,c=s.combat,site=s.deathConsul?.life.site,era=currentEra(s);
  return stage(s)&&s.status==='ACTIVE'&&s.health>0&&s.mind>0&&!s.activeEvent&&s.world.city==='BACKLUND'&&!otherSceneOpen(s)&&!!e&&e.status==='FIGHTING'&&era!==null&&e.sourceEra===era&&
    e.targetId===DEATH_CONSUL_TARGETS[era].id&&e.enemyLocation==='OTHER'&&e.enemyMetres===0&&e.terminal===null&&e.enemyStatus==='RESISTING'&&e.weaponLocation==='HAND'&&e.approachWeek!==null&&e.attemptWeek===s.week&&
    validateDeathConsulSiteState(site)&&site.sourceEra===era&&['NEAR','OTHER'].includes(site.playerLocation)&&site.operatorLocation==='OUTSIDE'&&site.operatorConsent==='GRANTED'&&site.operatorConsentWeek===s.week&&site.ordinaryExit==='OPEN'&&
    c?.encounterId==='DEATH_CONSUL_DISPUTE'&&c.enemyStatus==='RESISTING'&&c.enemyHealth>0&&c.enemyMind>0&&e.enemyHealth===c.enemyHealth&&e.enemyMind===c.enemyMind&&same(e.enemyInjuries,c.enemyInjuries)&&e.enemyRisk===c.enemyRisk&&integer(e.enemySpirituality,0,120)&&
    DEATH_CONSUL_POWER_IDS.every(id=>integer(e.powerUses[id]))&&e.enemySpirituality===120-DEATH_CONSUL_POWERS.reduce((n,p)=>n+e.powerUses[p.id]*p.cost,0)&&integer(c.round,1)&&e.startHistoryIndex!==null&&integer(e.startHistoryIndex)&&s.combatHistory.length-e.startHistoryIndex===c.round-1;
}
export function settleDeathConsulEncounter(s:SliceState,outcome:string,ctx:SeerContext,_award?:(source:string,amount:5|8|25)=>void):void {
  const e=s.deathConsul.encounter,c=s.combat;if(e.status!=='FIGHTING'||c?.encounterId!=='DEATH_CONSUL_DISPUTE')throw new Error('当前没有在封存室进行的战斗。');if(outcome==='CONTINUE')return;
  if(!['PLAYER_DEAD','RETREATED','ENEMY_DEAD','ENEMY_SURRENDERED'].includes(outcome))throw new Error('未知战斗结果。');
  const last=c.lastRound,o=last?.deathConsulOutcome;
  if(e.terminal||e.startHistoryIndex===null||!last||!validateDeathConsulRoundOutcome(o)||!validateDeathConsulCombatRound(last)||o.continuing||c.round!==last.round+1||
    s.combatHistory.length-e.startHistoryIndex!==last.round||!same(s.combatHistory.at(-1),last)||!same(o.siteAfter,s.deathConsul.life.site)||
    o.targetId!==e.targetId||o.source.sourceEra!==e.sourceEra||o.enemyHealth!==c.enemyHealth||o.enemyMind!==c.enemyMind||o.enemySpirituality!==e.enemySpirituality||!same(o.powerUses,e.powerUses)||!same(o.enemyInjuriesAfter,c.enemyInjuries)||o.enemyRiskAfter!==c.enemyRisk||
    !same(o.playerInjuriesAfter,s.injuries)||o.playerRiskAfter!==s.injuryRisk||o.playerHealthAfter!==s.health||o.playerMindAfter!==s.mind||o.playerSpiritualityAfter!==s.spirituality||
    (outcome==='PLAYER_DEAD'&&(s.health!==0||last.winner!=='ENEMY'||last.retreat==='SUCCESS'))||(outcome==='RETREATED'&&(last.retreat!=='SUCCESS'||last.winner!=='ENEMY'||s.health<=0))||
    (outcome==='ENEMY_DEAD'&&(c.enemyStatus!=='DEAD'||c.enemyHealth!==0||last.winner!=='PLAYER'||last.retreat!=='NONE'))||(outcome==='ENEMY_SURRENDERED'&&(c.enemyStatus!=='SURRENDERED'||c.enemyHealth<=0||last.winner!=='PLAYER'||last.retreat!=='NONE')))
    throw new Error('身体、现场、资源或完整战斗结果不符。');
  e.terminal={outcome:outcome as DeathConsulEncounterTerminal['outcome'],round:last.round,historyIndex:s.combatHistory.length-1,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,enemyStatus:e.enemyStatus};
  e.status=outcome==='PLAYER_DEAD'?'LOST':outcome==='RETREATED'?'RETREATED':'RESOLVED';s.combat=null;
  ctx.note('封存室冲突结束',`${outcome==='PLAYER_DEAD'?'你已死亡，身体留在室内的实际位置。':`你已经沿普通通路步行${o.exitMetres}米、耗时${o.exitMetres}秒回到入口。`}现场管理人仍在室外。${o.source.targetName}、那根棍，以及现场物件保留当前状态。`);
}
export const finishDeathConsulEncounter=settleDeathConsulEncounter;
export function deathConsulEncounterActions(s:SliceState):DeathConsulEncounterAction[] {
  if(!stage(s))return[];const era=currentEra(s),name=era?DEATH_CONSUL_TARGETS[era].name:'现场对手';
  return([['ENCOUNTER_TALK',`清场后与${name}交谈`,'1行动；管理人2米/2秒/2精力，你2米/2秒'],['ENCOUNTER_FIGHT',`选择与${name}交战`,'1行动；有受伤和死亡风险'],['LEAVE_ENCOUNTER','沿通路和平离开','0行动；2米/2秒']]as const).map(([type,label,cost])=>{const command:DeathConsulEncounterCommand={type},reason=blockDeathConsulEncounter(s,command);return{id:`death-consul-${type}`,label,cost,command,enabled:reason===null,reason};});
}
export function projectDeathConsulEncounter(s:SliceState):DeathConsulEncounterProjection {
  const e=s.deathConsul.encounter;const history=stage(s)||(s.progression.pathwayId==='death'&&s.progression.sequence===1&&s.deathConsul.promotionWeek!==null&&s.paleEmperor.promotionWeek!==null);if(!history)return{title:'尚未开放的封存室遭遇',story:'',status:e.status,inside:false,site:null,startSite:null,enemy:null,actions:[],facts:[]};
  const era=e.sourceEra,target=era?DEATH_CONSUL_TARGETS[era]:null;
  return{title:target?`封存室里的${target.name}`:'封存室通路争议',story:DEATH_CONSUL_ENCOUNTER_STORY,status:e.status,inside:hasDeathConsulEncounterLock(s),site:structuredClone(s.deathConsul.life.site),startSite:structuredClone(e.startSite),
    enemy:target&&era?{id:target.id,name:target.name,age:target.age,source:target.source,sourceEra:era,sequence:3,health:e.enemyHealth,mind:e.enemyMind,spirituality:e.enemySpirituality,status:e.enemyStatus,weaponId:target.weaponId,weaponLocation:e.weaponLocation,location:e.enemyLocation,powerUses:{...e.powerUses}}:null,
    actions:deathConsulEncounterActions(s),facts:['对手是本时代实际引介的成年人，持有自己的一根棍。','现场管理人实际退到室外后才可开战；原封存物仍留在入口台面。','门会阻挡苍白焰和短渡的路径，普通绕行出口仍可使用。','灵界短渡成功才实际移动本人2米；失败照付灵性且本轮不能再试。','短渡后的避让只削弱随后一次实际身体攻击40，苍白法术照常可能致伤。','定神只抵一次随后成功的旧封印，最多32；不抵短渡移动或攻击。','对手灵性逐次消耗，身体、棍、门和原物结局不可重置。战斗不增长掌握。']};
}
/** Life replay proves startSite. This validator proves era identity, every original ordered round and the sole live site thereafter. */
export function validateDeathConsulEncounter(s:SliceState):boolean {
  try {
    const e=s.deathConsul?.encounter,initial=createDeathConsulEncounterState();
    if(!e||!shape(e,Object.keys(initial))||e.enemyLocation!=='OTHER'||e.enemyMetres!==0||!['AVAILABLE','READY','FIGHTING','RESOLVED','RETREATED','LOST'].includes(e.status)||
      !integer(e.enemyHealth,0,100)||e.enemyMind!==100||!integer(e.enemySpirituality,0,120)||!integer(e.enemyRisk)||!Array.isArray(e.enemyInjuries)||
      !['RESISTING','SURRENDERED','DEAD'].includes(e.enemyStatus)||(e.enemyStatus==='DEAD')!==(e.enemyHealth===0)||e.weaponLocation!==(e.enemyStatus==='RESISTING'?'HAND':'OTHER')||
      !shape(e.powerUses,DEATH_CONSUL_POWER_IDS)||!DEATH_CONSUL_POWER_IDS.every(id=>integer(e.powerUses[id]))||e.enemySpirituality!==120-DEATH_CONSUL_POWERS.reduce((n,p)=>n+e.powerUses[p.id]*p.cost,0)||
      [e.approachWeek,e.attemptWeek].some(w=>w!==null&&!integer(w,1,s.week)))return false;
    const allNew=s.combatHistory.flatMap((r,i)=>r.deathConsulOutcome?[i]:[]);
    if(e.status==='AVAILABLE')return same(e,initial)&&allNew.length===0&&s.combat?.encounterId!=='DEATH_CONSUL_DISPUTE';
    const era=currentEra(s);
    if(!stage(s)||era===null||e.sourceEra!==era||e.targetId!==DEATH_CONSUL_TARGETS[era].id||s.deathConsul.promotionWeek===null||e.approachWeek===null||e.approachWeek<s.deathConsul.promotionWeek||!integer(e.approachRevision,1,s.revision)||
      !deathConsulLifeClosed(s)||!s.deathConsul.life.reflected||!e.startSite||!closedSite(e.startSite)||e.startSite.sourceEra!==era)return false;
    const approached=deathConsulApproachedSite(e.startSite,e.approachWeek);
    if(e.startHistoryIndex===null){const ready=e.status==='READY',peaceful=e.status==='RESOLVED';const expected=structuredClone(approached);if(peaceful)leaveDeathConsulCombatSite(expected);
      return(ready||peaceful)&&e.attemptWeek===null&&e.startSource===null&&e.terminal===null&&allNew.length===0&&same(s.deathConsul.life.site,expected)&&
        same({...e,status:initial.status,targetId:null,sourceEra:null,approachWeek:null,approachRevision:null,startSite:null},initial)&&s.combat?.encounterId!=='DEATH_CONSUL_DISPUTE'&&(!ready||s.status==='ACTIVE'&&!otherSceneOpen(s)&&e.approachWeek===s.week);}
    if(!integer(e.startHistoryIndex,0,s.combatHistory.length)||e.attemptWeek===null||e.attemptWeek!==e.approachWeek||!e.startSource||e.startSource.round!==1||!same(e.startSource.site,approached)||
      e.startSource.runId!==s.runId||e.startSource.targetId!==e.targetId||e.startSource.sourceEra!==era||e.startSource.randomSeed!==s.random.seed||e.startSource.attemptWeek!==e.attemptWeek||e.startSource.startHistoryIndex!==e.startHistoryIndex||e.startSource.revision<=e.approachRevision||e.startSource.revision>s.revision)return false;
    if(e.terminal&&(!shape(e.terminal,['outcome','round','historyIndex','enemyHealth','enemyMind','enemySpirituality','enemyStatus'])||!integer(e.terminal.historyIndex,e.startHistoryIndex,s.combatHistory.length-1)))return false;
    const end=e.terminal?e.terminal.historyIndex+1:s.combatHistory.length,rounds=s.combatHistory.slice(e.startHistoryIndex,end);
    if(!same(allNew,rounds.map((_r,i)=>e.startHistoryIndex!+i)))return false;
    for(const [i,round] of rounds.entries()){
      const o=round.deathConsulOutcome,previous=rounds[i-1]?.deathConsulOutcome;
      if(!validateDeathConsulRoundOutcome(o)||!validateDeathConsulCombatRound(round)||round.round!==i+1||o.source.runId!==s.runId||o.source.targetId!==e.targetId||o.source.sourceEra!==era||o.source.randomSeed!==s.random.seed||o.source.revision>=s.revision||o.randomCursorAfter>s.random.cursor||
        o.source.startHistoryIndex!==e.startHistoryIndex||o.source.attemptWeek!==e.attemptWeek||(i<rounds.length-1&&!o.continuing))return false;
      if(previous){const expected:DeathConsulCombatSource={...structuredClone(previous.source),revision:previous.source.revision+1,round:i+1,site:structuredClone(previous.siteAfter),distanceMetres:previous.siteAfter.playerLocation==='NEAR'?2:0,
          playerHealth:previous.playerHealthAfter,playerMind:previous.playerMindAfter,playerSpirituality:Math.min(120,previous.playerSpiritualityAfter+12),enemyHealth:previous.enemyHealth,enemyMind:previous.enemyMind,enemySpirituality:previous.enemySpirituality,
          playerInjuries:structuredClone(previous.playerInjuriesAfter),enemyInjuries:structuredClone(previous.enemyInjuriesAfter),playerRisk:previous.playerRiskAfter,enemyRisk:previous.enemyRiskAfter,powerUses:{...previous.powerUses},randomCursor:previous.randomCursorAfter};
        if(!same(o.source,expected))return false;
      }else if(!same(o.source,e.startSource)||o.source.enemyHealth!==100||o.source.enemyMind!==100||o.source.enemySpirituality!==120||o.source.enemyRisk!==0||o.source.enemyInjuries.length!==0||!same(o.source.powerUses,initial.powerUses))return false;
    }
    const last=rounds.at(-1),o=last?.deathConsulOutcome;
    if(o&&(o.enemyHealth!==e.enemyHealth||o.enemyMind!==e.enemyMind||o.enemySpirituality!==e.enemySpirituality||o.enemyStatus!==e.enemyStatus||!same(o.powerUses,e.powerUses)||!same(o.enemyInjuriesAfter,e.enemyInjuries)||o.enemyRiskAfter!==e.enemyRisk||!same(o.siteAfter,s.deathConsul.life.site)))return false;
    if(e.status==='FIGHTING'){
      if(e.terminal!==null||!hasDeathConsulDisputeOpponent(s))return false;
      if(!o)return s.combat!.lastRound===null&&same(currentDeathConsulCombatSource(s),e.startSource)&&same(e.powerUses,initial.powerUses)&&e.enemyHealth===100&&e.enemyMind===100&&e.enemySpirituality===120&&e.enemyRisk===0&&e.enemyInjuries.length===0;
      const actual=currentDeathConsulCombatSource(s),expected:DeathConsulCombatSource={...structuredClone(o.source),revision:o.source.revision+1,round:o.round+1,site:structuredClone(o.siteAfter),distanceMetres:o.siteAfter.playerLocation==='NEAR'?2:0,playerHealth:o.playerHealthAfter,playerMind:o.playerMindAfter,playerSpirituality:Math.min(120,o.playerSpiritualityAfter+12),enemyHealth:o.enemyHealth,enemyMind:o.enemyMind,enemySpirituality:o.enemySpirituality,
        playerInjuries:structuredClone(o.playerInjuriesAfter),enemyInjuries:structuredClone(o.enemyInjuriesAfter),playerRisk:o.playerRiskAfter,enemyRisk:o.enemyRiskAfter,powerUses:{...o.powerUses},randomCursor:o.randomCursorAfter};
      return o.continuing&&same(last,s.combat!.lastRound)&&same(actual,expected);
    }
    const t=e.terminal;if(s.combat?.encounterId==='DEATH_CONSUL_DISPUTE'||!t||!last||!o||o.continuing||t.round!==last.round||rounds.length!==t.round||t.enemyHealth!==e.enemyHealth||t.enemyMind!==e.enemyMind||t.enemySpirituality!==e.enemySpirituality||t.enemyStatus!==e.enemyStatus)return false;
    if(t.outcome==='RETREATED')return e.status==='RETREATED'&&last.retreat==='SUCCESS'&&last.winner==='ENEMY'&&o.playerHealthAfter>0;
    if(t.outcome==='PLAYER_DEAD')return e.status==='LOST'&&s.status==='DEAD'&&o.playerHealthAfter===0&&last.winner==='ENEMY';
    return e.status==='RESOLVED'&&last.winner==='PLAYER'&&last.retreat==='NONE'&&(t.outcome==='ENEMY_DEAD'?e.enemyStatus==='DEAD':t.outcome==='ENEMY_SURRENDERED'&&e.enemyStatus==='SURRENDERED');
  }catch{return false;}
}
