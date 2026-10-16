import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasSeaKingLifeLock } from '../sea-king/life.js';
import { catastropheLifeClosed, hasCatastropheLifeLock } from './life.js';
import { currentCatastropheCombatSource, validateCatastropheRoundOutcome, validateCatastropheCombatRound, type CatastropheCombatSource } from './combat.js';
import { validateCatastropheSiteState, type CatastropheSiteState } from './resources.js';

export const CATASTROPHE_TARGET_ID = 'CT2-VALE' as const;
export const CATASTROPHE_POWER_IDS = ['STORM','PRESSURE','GATE'] as const;
export type CatastrophePowerId = typeof CATASTROPHE_POWER_IDS[number];
export type CatastropheEnemyIntent = CatastrophePowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const CATASTROPHE_POWERS = [
  { id:'STORM',label:'真实湾水有限风暴',cost:7,selfGain:105,enemyReduction:0 },
  { id:'PRESSURE',label:'开闸原渠水有限压力',cost:6,selfGain:0,enemyReduction:60 },
  { id:'GATE',label:'本轮一次普通原闸操作',cost:0,selfGain:0,enemyReduction:0 },
] as const;
export interface CatastropheEncounterTerminal {
  outcome:'PLAYER_DEAD'|'RETREATED'|'ENEMY_DEAD'|'ENEMY_SURRENDERED';round:number;historyIndex:number;
  enemyHealth:number;enemyMind:number;enemySpirituality:number;enemyStatus:'RESISTING'|'SURRENDERED'|'DEAD';
}
export interface CatastropheEncounterState {
  status:'AVAILABLE'|'READY'|'FIGHTING'|'RESOLVED'|'RETREATED'|'LOST';targetId:typeof CATASTROPHE_TARGET_ID;
  approachWeek:number|null;approachRevision:number|null;attemptWeek:number|null;startHistoryIndex:number|null;
  /** Immutable provenance input. life validator must equal this to the fully replayed, closed life journal. */
  startSite:CatastropheSiteState|null;
  /** Immutable first-round source captured by the explicit fight command, before any roll or paid combat action. */
  startSource:CatastropheCombatSource|null;
  enemyHealth:number;enemyMind:number;enemySpirituality:number;enemyStatus:'RESISTING'|'SURRENDERED'|'DEAD';
  weaponLocation:'HAND'|'PLATFORM';enemyInjuries:SliceInjury[];enemyRisk:number;powerUses:Record<CatastrophePowerId,number>;
  terminal:CatastropheEncounterTerminal|null;
}
export type CatastropheEncounterCommand={type:'ENCOUNTER_TALK'|'ENCOUNTER_FIGHT'|'LEAVE_ENCOUNTER'};
export interface CatastropheEncounterAction {id:string;label:string;cost:string;enabled:boolean;reason:string|null;command:CatastropheEncounterCommand}
export interface CatastropheEncounterProjection {
  title:string;story:string;status:CatastropheEncounterState['status'];inside:boolean;site:CatastropheSiteState|null;startSite:CatastropheSiteState|null;
  enemy:null|{id:typeof CATASTROPHE_TARGET_ID;name:'维尔';age:47;source:'ORIGINAL_COVE_ADULT';sequence:2;health:number;mind:number;spirituality:number;
    status:CatastropheEncounterState['enemyStatus'];weaponId:'CT2-VALE-CLUB';weaponLocation:'HAND'|'PLATFORM';powerUses:Record<CatastrophePowerId,number>};
  actions:CatastropheEncounterAction[];facts:string[];
}
export const CATASTROPHE_ENCOUNTER_STORY='同一CT2-COVE三案原海湾的12米有限G边界内，独立成年维尔（47岁、CT2-VALE）持自己的唯一CT2-VALE-CLUB提出通路争议。他是原创有限G2对手，原身体24、H100/M100/S120，与已死本尼迪克特和昆廷不是同一人。三案原海水20单位、原闸与原浮标/系索/轮具逐项保留，进入不补水或修复。诺拉当面同意退到干路出口，真实步行6米/6秒、精力−2后，本人再普通步行2米/2秒到干台交谈；仍可和平离开，开战是另一个明确选择。双方每槽5秒，每轮60秒；玩家六槽25/20/15/20/15/5、敌五类35/25/20/15/5，缺条件只占原槽普通回退。成功风暴须真实湾水和本作G约束用原系索，耐久−1；这个环境边界不是原著施法必须绳子。水压须当前开闸和原渠水≥1，实际泄回1单位。闭闸保留原渠水，普通开闸耐久−1，仅空渠时实际引4单位；坏闸不修，敌每轮只操作一次。双方各付自己的原S，敌无自动恢复；共同伤势与真实死亡保持，没有免费治疗、复活、掌握或战利棍奖励。';
export function createCatastropheEncounterState():CatastropheEncounterState {
  return {status:'AVAILABLE',targetId:CATASTROPHE_TARGET_ID,approachWeek:null,approachRevision:null,attemptWeek:null,startHistoryIndex:null,startSite:null,startSource:null,
    enemyHealth:100,enemyMind:100,enemySpirituality:120,enemyStatus:'RESISTING',weaponLocation:'HAND',enemyInjuries:[],enemyRisk:0,powerUses:{STORM:0,PRESSURE:0,GATE:0},terminal:null};
}
const stage=(s:SliceState)=>s.progression.pathwayId==='tyrant'&&s.progression.sequence===2;
const same=(a:unknown,b:unknown)=>a===b||(a!==undefined&&b!==undefined&&stableStringify(a)===stableStringify(b));
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&(v as number)>=min&&(v as number)<=max;
const shape=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...keys].sort());
export function validateCatastropheEncounterCommand(v:unknown):v is CatastropheEncounterCommand {return shape(v,['type'])&&['ENCOUNTER_TALK','ENCOUNTER_FIGHT','LEAVE_ENCOUNTER'].includes(String((v as {type:unknown}).type));}
export const isCatastropheEncounterCommand=validateCatastropheEncounterCommand;
export const hasCatastropheEncounterLock=(s:SliceState):boolean=>['READY','FIGHTING'].includes(s.catastrophe.encounter.status);
export const isInsideCatastropheEncounter=hasCatastropheEncounterLock;
function otherSceneOpen(s:SliceState):boolean {
  return s.catastrophe.preparedWeek!==null||hasCatastropheLifeLock(s)||hasSeaKingLifeLock(s)||['READY','FIGHTING'].includes(s.seaKing.encounter.status)||
    s.seaKing.preparedWeek!==null||s.cataclysmPriest.ritual.playerLocation==='PLATFORM'||s.oceanSinger.ritual.location!=='DOCK';
}
function closedSite(site:CatastropheSiteState):boolean {return validateCatastropheSiteState(site)&&site.playerPosition==='EXIT'&&site.keeper.position==='CONTROL'&&site.keeper.energy>=2&&site.buoy.offsetMetres===0&&site.water.channelUnits===0&&site.gate.position==='CLOSED';}
/** Pure approach replay. This is the original live site after actual people walk, never a newly created resource stock. */
export function catastropheApproachedSite(start:CatastropheSiteState):CatastropheSiteState {
  if(!closedSite(start))throw new Error('原海湾未真实收束或诺拉无力走出。');
  const site=structuredClone(start);site.keeper.position='EXIT';site.keeper.travelMetres+=6;site.keeper.energy-=2;site.clockSeconds+=6;
  site.playerPosition='PLATFORM';site.playerTravelMetres+=2;site.clockSeconds+=2;return site;
}
function leaveSite(site:CatastropheSiteState):void {if(site.playerPosition!=='PLATFORM')throw new Error('本人不在原干台，不能代替实际离场。');site.playerPosition='EXIT';site.playerTravelMetres+=2;site.clockSeconds+=2;}
export function blockCatastropheEncounter(s:SliceState,c:CatastropheEncounterCommand):string|null {
  if(!validateCatastropheEncounterCommand(c))return '天灾遭遇命令无效。';const e=s.catastrophe.encounter;
  if(s.status!=='ACTIVE'||!stage(s)||s.health<=0)return '须本人仍活着并已成为天灾·暴君序列2。';
  if(s.activeEvent||s.combat)return '先处理当前事件或战斗。';if(s.world.city!=='BACKLUND')return '须实际在贝克兰德原海湾。';
  if(otherSceneOpen(s))return '先实际收束当前准备、实践和旧原现场。';
  if(c.type==='LEAVE_ENCOUNTER')return e.status==='READY'&&s.catastrophe.life.site.playerPosition==='PLATFORM'?null:'须先实际到原干台，才能普通步行退出。';
  if(s.mind<=0)return '先恢复精神；尚未开战仍可沿原路普通离开。';if(s.actionsRemaining<1)return '本次选择需要1行动。';
  if(c.type==='ENCOUNTER_TALK'){
    if(e.status!=='AVAILABLE')return '同一原维尔已有进展或结局，不重新生成或恢复资源。';
    if(!catastropheLifeClosed(s)||!s.catastrophe.life.reflected)return '先真实报告关闭三案并完成反思，再选择可选冲突。';
    if(!closedSite(s.catastrophe.life.site))return '先沿原路退出、原人归位、原浮标归位、实际排水关闸；诺拉须有2精力走出。';
    return s.actionsRemaining<2?'交谈需1行动，另留开战1行动；到场后也可0行动和平离开。':null;
  }
  return e.status==='READY'&&s.catastrophe.life.site.playerPosition==='PLATFORM'&&s.catastrophe.life.site.keeper.position==='EXIT'?null:'先实际交谈与人员清场，确认同一原水/闸/系索和普通干路出口。';
}
export const catastropheEncounterReason=blockCatastropheEncounter;
export function applyCatastropheEncounterCommand(s:SliceState,c:CatastropheEncounterCommand,ctx:SeerContext):void {
  const reason=blockCatastropheEncounter(s,c);if(reason)throw new Error(reason);const e=s.catastrophe.encounter;
  if(c.type==='LEAVE_ENCOUNTER'){leaveSite(s.catastrophe.life.site);e.status='RESOLVED';ctx.note('沿原干路和平离开','本人实际步行2米/2秒到EXIT，诺拉仍在已走到的EXIT；原维尔与自己原棍留在干台，所有原水与损耗原样保留，没有战斗或奖励。');return;}
  s.actionsRemaining--;
  if(c.type==='ENCOUNTER_TALK'){e.startSite=structuredClone(s.catastrophe.life.site);s.catastrophe.life.site=catastropheApproachedSite(e.startSite);e.status='READY';e.approachWeek=s.week;e.approachRevision=s.revision+1;ctx.note('先真实清场，再与原维尔交谈',CATASTROPHE_ENCOUNTER_STORY+'本次尚未选择开战。');return;}
  e.status='FIGHTING';e.attemptWeek=s.week;e.startHistoryIndex=s.combatHistory.length;
  s.combat={encounterId:'CATASTROPHE_DISPUTE',round:1,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemyInjuries:structuredClone(e.enemyInjuries),enemyRisk:e.enemyRisk,enemyStatus:'RESISTING',lastRound:null};
  const source=currentCatastropheCombatSource(s);if(!source)throw new Error('原海湾开战来源断裂。');e.startSource={...source,revision:s.revision+1};
  ctx.note('承担同一原海湾的真实冲突','不重置三案原水/闸/损耗；维尔用独立原身体与原S，本人已有伤势照常进入共同后果盘。');
}
export const applyCatastropheEncounter=applyCatastropheEncounterCommand;
export function startCatastropheEncounter(s:SliceState,ctx:SeerContext):void {applyCatastropheEncounterCommand(s,{type:'ENCOUNTER_FIGHT'},ctx);}
export function hasCatastropheDisputeOpponent(s:SliceState):boolean {
  const e=s.catastrophe?.encounter,c=s.combat,site=s.catastrophe?.life.site;
  return stage(s)&&s.status==='ACTIVE'&&s.health>0&&s.mind>0&&!s.activeEvent&&s.world.city==='BACKLUND'&&!otherSceneOpen(s)&&!!e&&e.status==='FIGHTING'&&
    e.targetId===CATASTROPHE_TARGET_ID&&e.terminal===null&&e.enemyStatus==='RESISTING'&&e.weaponLocation==='HAND'&&e.approachWeek!==null&&e.attemptWeek===s.week&&
    validateCatastropheSiteState(site)&&site.playerPosition==='PLATFORM'&&site.keeper.position==='EXIT'&&site.buoy.offsetMetres===0&&c?.encounterId==='CATASTROPHE_DISPUTE'&&c.enemyStatus==='RESISTING'&&c.enemyHealth>0&&c.enemyMind>0&&
    e.enemyHealth===c.enemyHealth&&e.enemyMind===c.enemyMind&&same(e.enemyInjuries,c.enemyInjuries)&&e.enemyRisk===c.enemyRisk&&integer(e.enemySpirituality,0,120)&&
    CATASTROPHE_POWER_IDS.every(id=>integer(e.powerUses[id]))&&e.enemySpirituality===120-CATASTROPHE_POWERS.reduce((n,p)=>n+e.powerUses[p.id]*p.cost,0)&&
    integer(c.round,1)&&e.startHistoryIndex!==null&&integer(e.startHistoryIndex)&&s.combatHistory.length-e.startHistoryIndex===c.round-1;
}
export function settleCatastropheEncounter(s:SliceState,outcome:string,ctx:SeerContext,_award?:(source:string,amount:5|8|25)=>void):void {
  const e=s.catastrophe.encounter,c=s.combat;if(e.status!=='FIGHTING'||c?.encounterId!=='CATASTROPHE_DISPUTE')throw new Error('没有同一原维尔的真实战斗。');if(outcome==='CONTINUE')return;
  if(!['PLAYER_DEAD','RETREATED','ENEMY_DEAD','ENEMY_SURRENDERED'].includes(outcome))throw new Error('未知原海湾战斗结果。');
  const last=c.lastRound,o=last?.catastropheOutcome;
  if(e.terminal||e.startHistoryIndex===null||!last||!validateCatastropheRoundOutcome(o)||!validateCatastropheCombatRound(last)||o.continuing||c.round!==last.round+1||
    s.combatHistory.length-e.startHistoryIndex!==last.round||!same(s.combatHistory.at(-1),last)||!same(o.siteAfter,s.catastrophe.life.site)||
    o.enemyHealth!==c.enemyHealth||o.enemyMind!==c.enemyMind||o.enemySpirituality!==e.enemySpirituality||!same(o.powerUses,e.powerUses)||!same(o.enemyInjuriesAfter,c.enemyInjuries)||o.enemyRiskAfter!==c.enemyRisk||
    !same(o.playerInjuriesAfter,s.injuries)||o.playerRiskAfter!==s.injuryRisk||o.playerHealthAfter!==s.health||o.playerMindAfter!==s.mind||o.playerSpiritualityAfter!==s.spirituality||
    (outcome==='PLAYER_DEAD'&&(s.health!==0||last.winner!=='ENEMY'||last.retreat==='SUCCESS'))||(outcome==='RETREATED'&&(last.retreat!=='SUCCESS'||last.winner!=='ENEMY'||s.health<=0))||
    (outcome==='ENEMY_DEAD'&&(c.enemyStatus!=='DEAD'||c.enemyHealth!==0||last.winner!=='PLAYER'||last.retreat!=='NONE'))||(outcome==='ENEMY_SURRENDERED'&&(c.enemyStatus!=='SURRENDERED'||c.enemyHealth<=0||last.winner!=='PLAYER'||last.retreat!=='NONE')))
    throw new Error('原身体、原海湾、实际资源或完整随机结局不符。');
  e.terminal={outcome:outcome as CatastropheEncounterTerminal['outcome'],round:last.round,historyIndex:s.combatHistory.length-1,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,enemyStatus:e.enemyStatus};
  e.status=outcome==='PLAYER_DEAD'?'LOST':outcome==='RETREATED'?'RETREATED':'RESOLVED';s.combat=null;
  ctx.note('原海湾冲突结束',`${outcome==='PLAYER_DEAD'?'玩家原身体真实死亡并留在PLATFORM。':'活着的本人已经沿原干路实际步行2米/2秒到EXIT。'}诺拉仍在原EXIT；原维尔及自己的唯一原棍、所有原水与损耗保持真实终态。无复活、免费治疗、战斗掌握或夺取原棍奖励。`);
}
export const finishCatastropheEncounter=settleCatastropheEncounter;
export function catastropheEncounterActions(s:SliceState):CatastropheEncounterAction[] {
  if(!stage(s))return [];
  return ([['ENCOUNTER_TALK','实际清场并前往原干台交谈','1行动 · 诺拉6米/6秒/2精力，本人2米/2秒'],['ENCOUNTER_FIGHT','承担原维尔的真实冲突','1行动 · 真实受伤或死亡风险'],['LEAVE_ENCOUNTER','沿原干路和平离开','0行动 · 本人2米/2秒']] as const).map(([type,label,cost])=>{const command:CatastropheEncounterCommand={type},reason=blockCatastropheEncounter(s,command);return{id:`catastrophe-${type}`,label,cost,command,enabled:reason===null,reason};});
}
export function projectCatastropheEncounter(s:SliceState):CatastropheEncounterProjection {
  const e=s.catastrophe.encounter;if(!stage(s))return{title:'尚未开放的天灾遭遇',story:'',status:e.status,inside:false,site:null,startSite:null,enemy:null,actions:[],facts:[]};
  return{title:'同一原海湾与独立的维尔',story:CATASTROPHE_ENCOUNTER_STORY,status:e.status,inside:hasCatastropheEncounterLock(s),site:structuredClone(s.catastrophe.life.site),startSite:structuredClone(e.startSite),
    enemy:{id:CATASTROPHE_TARGET_ID,name:'维尔',age:47,source:'ORIGINAL_COVE_ADULT',sequence:2,health:e.enemyHealth,mind:e.enemyMind,spirituality:e.enemySpirituality,status:e.enemyStatus,weaponId:'CT2-VALE-CLUB',weaponLocation:e.weaponLocation,powerUses:{...e.powerUses}},
    actions:catastropheEncounterActions(s),facts:['CT2-VALE是独立47岁原人，不是已死本尼迪克特或昆廷复生/改名','原海湾site是唯一当前水/闸/系索/人物位置；startSite仅是已关闭三案历史快照',
      '诺拉与本人真实步行清场；当前无第三人在12米作用区，不代表自动友军免疫','原湾+原渠始终20；关闸不删渠水，坏闸不修，既有轮具损耗不恢复',
      '玩家仅CONTINUE后+12S，敌原120逐项实扣；普通身体伤势、撤退、死亡无豁免',`旧本尼迪克特${s.cataclysmPriest.encounter.enemy.status}，旧昆廷${s.seaKing.encounter.enemyStatus}/S${s.seaKing.encounter.enemySpirituality}，旧原棍归属与所有历史不变`]};
}
/** Life validator proves startSite from its exact closed journal. This validator proves approach, all original rounds, and the one live site thereafter. */
export function validateCatastropheEncounter(s:SliceState):boolean {
  try {
    const e=s.catastrophe?.encounter,initial=createCatastropheEncounterState();
    if(!e||!shape(e,Object.keys(initial))||e.targetId!==CATASTROPHE_TARGET_ID||!['AVAILABLE','READY','FIGHTING','RESOLVED','RETREATED','LOST'].includes(e.status)||
      !integer(e.enemyHealth,0,100)||e.enemyMind!==100||!integer(e.enemySpirituality,0,120)||!integer(e.enemyRisk)||!Array.isArray(e.enemyInjuries)||
      !['RESISTING','SURRENDERED','DEAD'].includes(e.enemyStatus)||(e.enemyStatus==='DEAD')!==(e.enemyHealth===0)||e.weaponLocation!==(e.enemyStatus==='RESISTING'?'HAND':'PLATFORM')||
      !shape(e.powerUses,CATASTROPHE_POWER_IDS)||!CATASTROPHE_POWER_IDS.every(id=>integer(e.powerUses[id]))||e.enemySpirituality!==120-CATASTROPHE_POWERS.reduce((n,p)=>n+e.powerUses[p.id]*p.cost,0)||
      [e.approachWeek,e.attemptWeek].some(w=>w!==null&&!integer(w,1,s.week)))return false;
    const allNew=s.combatHistory.flatMap((r,i)=>r.catastropheOutcome?[i]:[]);
    if(e.status==='AVAILABLE')return same(e,initial)&&allNew.length===0&&s.combat?.encounterId!=='CATASTROPHE_DISPUTE';
    if(!stage(s)||s.catastrophe.promotionWeek===null||e.approachWeek===null||e.approachWeek<s.catastrophe.promotionWeek||!integer(e.approachRevision,1,s.revision)||
      !catastropheLifeClosed(s)||!s.catastrophe.life.reflected||!e.startSite||!closedSite(e.startSite))return false;
    const approached=catastropheApproachedSite(e.startSite);
    if(e.startHistoryIndex===null){const ready=e.status==='READY',peaceful=e.status==='RESOLVED';const expected=structuredClone(approached);if(peaceful)leaveSite(expected);
      return(ready||peaceful)&&e.attemptWeek===null&&e.startSource===null&&e.terminal===null&&allNew.length===0&&same(s.catastrophe.life.site,expected)&&
        same({...e,status:initial.status,approachWeek:null,approachRevision:null,startSite:null},initial)&&s.combat?.encounterId!=='CATASTROPHE_DISPUTE'&&(!ready||s.status==='ACTIVE'&&!otherSceneOpen(s));}
    if(!integer(e.startHistoryIndex,0,s.combatHistory.length)||e.attemptWeek===null||e.attemptWeek<e.approachWeek||!e.startSource||e.startSource.round!==1||!same(e.startSource.site,approached)||
      e.startSource.runId!==s.runId||e.startSource.randomSeed!==s.random.seed||e.startSource.attemptWeek!==e.attemptWeek||e.startSource.startHistoryIndex!==e.startHistoryIndex||e.startSource.revision<=e.approachRevision||e.startSource.revision>s.revision)return false;
    if(e.terminal&&(!shape(e.terminal,['outcome','round','historyIndex','enemyHealth','enemyMind','enemySpirituality','enemyStatus'])||!integer(e.terminal.historyIndex,e.startHistoryIndex,s.combatHistory.length-1)))return false;
    const end=e.terminal?e.terminal.historyIndex+1:s.combatHistory.length,rounds=s.combatHistory.slice(e.startHistoryIndex,end);
    if(!same(allNew,rounds.map((_r,i)=>e.startHistoryIndex!+i)))return false;
    for(const [i,round] of rounds.entries()){
      const o=round.catastropheOutcome,previous=rounds[i-1]?.catastropheOutcome;
      if(!validateCatastropheRoundOutcome(o)||!validateCatastropheCombatRound(round)||round.round!==i+1||o.source.runId!==s.runId||o.source.randomSeed!==s.random.seed||o.source.revision>=s.revision||o.randomCursorAfter>s.random.cursor||
        o.source.startHistoryIndex!==e.startHistoryIndex||o.source.attemptWeek!==e.attemptWeek||(i<rounds.length-1&&!o.continuing))return false;
      if(previous){const expected:CatastropheCombatSource={...structuredClone(previous.source),revision:previous.source.revision+1,round:i+1,site:structuredClone(previous.siteAfter),
          playerHealth:previous.playerHealthAfter,playerMind:previous.playerMindAfter,playerSpirituality:Math.min(120,previous.playerSpiritualityAfter+12),enemyHealth:previous.enemyHealth,enemyMind:previous.enemyMind,enemySpirituality:previous.enemySpirituality,
          playerInjuries:structuredClone(previous.playerInjuriesAfter),enemyInjuries:structuredClone(previous.enemyInjuriesAfter),playerRisk:previous.playerRiskAfter,enemyRisk:previous.enemyRiskAfter,powerUses:{...previous.powerUses},randomCursor:previous.randomCursorAfter};
        if(!same(o.source,expected))return false;
      }else if(!same(o.source,e.startSource)||o.source.enemyHealth!==100||o.source.enemyMind!==100||o.source.enemySpirituality!==120||o.source.enemyRisk!==0||o.source.enemyInjuries.length!==0||!same(o.source.powerUses,initial.powerUses))return false;
    }
    const last=rounds.at(-1),o=last?.catastropheOutcome;
    if(o&&(o.enemyHealth!==e.enemyHealth||o.enemyMind!==e.enemyMind||o.enemySpirituality!==e.enemySpirituality||o.enemyStatus!==e.enemyStatus||!same(o.powerUses,e.powerUses)||!same(o.enemyInjuriesAfter,e.enemyInjuries)||o.enemyRiskAfter!==e.enemyRisk||!same(o.siteAfter,s.catastrophe.life.site)))return false;
    if(e.status==='FIGHTING'){
      if(e.terminal!==null||!hasCatastropheDisputeOpponent(s))return false;
      if(!o)return s.combat!.lastRound===null&&same(currentCatastropheCombatSource(s),e.startSource)&&same(e.powerUses,initial.powerUses)&&e.enemyHealth===100&&e.enemyMind===100&&e.enemySpirituality===120&&e.enemyRisk===0&&e.enemyInjuries.length===0;
      const actual=currentCatastropheCombatSource(s),expected:CatastropheCombatSource={...structuredClone(o.source),revision:o.source.revision+1,round:o.round+1,site:structuredClone(o.siteAfter),playerHealth:o.playerHealthAfter,playerMind:o.playerMindAfter,playerSpirituality:Math.min(120,o.playerSpiritualityAfter+12),enemyHealth:o.enemyHealth,enemyMind:o.enemyMind,enemySpirituality:o.enemySpirituality,
        playerInjuries:structuredClone(o.playerInjuriesAfter),enemyInjuries:structuredClone(o.enemyInjuriesAfter),playerRisk:o.playerRiskAfter,enemyRisk:o.enemyRiskAfter,powerUses:{...o.powerUses},randomCursor:o.randomCursorAfter};
      return o.continuing&&same(last,s.combat!.lastRound)&&same(actual,expected);
    }
    const t=e.terminal;if(s.combat?.encounterId==='CATASTROPHE_DISPUTE'||!t||!last||!o||o.continuing||t.round!==last.round||rounds.length!==t.round||t.enemyHealth!==e.enemyHealth||t.enemyMind!==e.enemyMind||t.enemySpirituality!==e.enemySpirituality||t.enemyStatus!==e.enemyStatus)return false;
    if(t.outcome==='RETREATED')return e.status==='RETREATED'&&last.retreat==='SUCCESS'&&last.winner==='ENEMY'&&o.playerHealthAfter>0;
    if(t.outcome==='PLAYER_DEAD')return e.status==='LOST'&&s.status==='DEAD'&&o.playerHealthAfter===0&&last.winner==='ENEMY';
    return e.status==='RESOLVED'&&last.winner==='PLAYER'&&last.retreat==='NONE'&&(t.outcome==='ENEMY_DEAD'?e.enemyStatus==='DEAD':t.outcome==='ENEMY_SURRENDERED'&&e.enemyStatus==='SURRENDERED');
  }catch{return false;}
}
