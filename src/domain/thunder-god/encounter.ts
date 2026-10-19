import { SLICE_LIFE } from '../../content/slice-events.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { addGameWeeks, compareGameDates, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceCombatRound, SliceInjury, SliceState } from '../slice/types.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { hasThunderGodLifeLock } from './life.js';
import { currentThunderGodCombatSource, nextThunderGodCombatSource, validThunderGodCombatSource, validateThunderGodCombatRound,
  validThunderGodBody, validThunderGodInjuries, type ThunderGodCombatSource, type ThunderGodRoundOutcome } from './combat.js';

export const THUNDER_GOD_TARGET_ID = 'TG1-OREN-GAGE' as const;
export const THUNDER_GOD_SITE = 'TG1-DRY-PLATFORM' as const;
export const THUNDER_GOD_POWER_IDS = ['LIGHTNING', 'WIND_WARD', 'SEA_SONG', 'OBSCURE'] as const;
export type ThunderGodPowerId = typeof THUNDER_GOD_POWER_IDS[number];
export type ThunderGodEnemyIntent = ThunderGodPowerId | 'BODY_STRIKE' | 'OBSERVE' | 'ACCIDENT';
export type ThunderGodPolicy = 'INHERITED_ONLY' | 'GUIDED_THUNDER' | 'STORM_BRACE' | 'ALL' | 'ORDINARY';
export type ThunderGodCombatPolicy = ThunderGodPolicy;
export const THUNDER_GOD_POLICIES: readonly ThunderGodPolicy[] = ['INHERITED_ONLY','GUIDED_THUNDER','STORM_BRACE','ALL','ORDINARY'];
export const THUNDER_GOD_POWERS = [
  { id: 'LIGHTNING', label: '原杆有限雷击', cost: 7, selfGain: 105, enemyReduction: 0 },
  { id: 'WIND_WARD', label: '有限风护', cost: 6, selfGain: 0, enemyReduction: 60 },
  { id: 'SEA_SONG', label: '有限海歌', cost: 7, selfGain: 65, enemyReduction: 0 },
  { id: 'OBSCURE', label: '关闭自己的原遮挡罩', cost: 3, selfGain: 0, enemyReduction: 0 },
] as const;
export interface ThunderGodMaterials {
  weapon: { id: 'TG1-OREN-ROD'; sourceId: 'TG1-OREN-OWNED-ROD-1'; owner: typeof THUNDER_GOD_TARGET_ID;
    massKg: 2; location: 'HAND' | 'PLATFORM'; condition: 100; charge: number; capacity: 4; visible: true };
  screen: {id:'TG1-OREN-SCREEN';sourceId:'TG1-OREN-OWNED-SCREEN-1';owner:typeof THUNDER_GOD_TARGET_ID;coordinate:5;hood:'OPEN'|'CLOSED';durability:100;operations:number};
}
export function createThunderGodMaterials(): ThunderGodMaterials {
  return { weapon: { id: 'TG1-OREN-ROD', sourceId: 'TG1-OREN-OWNED-ROD-1', owner: THUNDER_GOD_TARGET_ID,
    massKg: 2, location: 'HAND', condition: 100, charge: 4, capacity: 4, visible: true },
    screen:{id:'TG1-OREN-SCREEN',sourceId:'TG1-OREN-OWNED-SCREEN-1',owner:THUNDER_GOD_TARGET_ID,coordinate:5,hood:'OPEN',durability:100,operations:0} };
}
export interface ThunderGodScene {
  siteId: typeof THUNDER_GOD_SITE; playerLocation: 'OUTSIDE' | 'PLATFORM'; playerCoordinate: 0 | 4; enemyCoordinate: 6;
  ordinaryExit: 'OPEN'; visibleBodyLine: boolean; conditionVersion: number; observedConditionVersion: number | null;
  thirdPartiesInArea: 0; presentMemberIds: string[]; observedSourceId: string | null; observationWeek: number | null;
  clockSeconds: number; externalSeconds: number; playerTravelMetres: number; knownPlayerName: string | null; knownEnemyName: string | null;
}
export function createThunderGodScene(): ThunderGodScene {
  return { siteId: THUNDER_GOD_SITE, playerLocation: 'OUTSIDE', playerCoordinate: 0, enemyCoordinate: 6,
    ordinaryExit: 'OPEN', visibleBodyLine: true, conditionVersion: 1, observedConditionVersion: null,
    thirdPartiesInArea: 0, presentMemberIds: [], observedSourceId: null, observationWeek: null,
    clockSeconds: 0, externalSeconds: 0, playerTravelMetres: 0, knownPlayerName: null, knownEnemyName: null };
}
export interface ThunderGodObservation { power: 'LIGHTNING' | 'WIND_WARD'; conditionVersion: number; round: number; order: number; atSeconds: number; paidCost: 6 | 7 }
export interface ThunderGodCombatBody {
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  weaponLocation: 'HAND' | 'PLATFORM'; powerUses: Record<ThunderGodPowerId, number>; observations: ThunderGodObservation[];
  inheritedApplications: Record<string,number>; screenReveals:number; totalOwnerMindSpent: number; guidedThunderAttempts: number; guidedThunderChecks: number; guidedThunderSuccesses: number;
  stormBraceAttempts: number; stormBraceChecks: number; stormBraceSuccesses: number;
}
export function initialThunderGodBody(): ThunderGodCombatBody {
  return { enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0, weaponLocation: 'HAND',
    powerUses: { LIGHTNING: 0, WIND_WARD: 0, SEA_SONG: 0, OBSCURE: 0 }, observations: [], inheritedApplications:{},screenReveals:0,totalOwnerMindSpent: 0,
    guidedThunderAttempts: 0, guidedThunderChecks: 0, guidedThunderSuccesses: 0, stormBraceAttempts: 0, stormBraceChecks: 0, stormBraceSuccesses: 0 };
}
export function combatBody(e: ThunderGodCombatBody): ThunderGodCombatBody {
  return Object.fromEntries(Object.keys(initialThunderGodBody()).map(k => [k, structuredClone(e[k as keyof ThunderGodCombatBody])])) as unknown as ThunderGodCombatBody;
}
export type ThunderGodFinanceSnapshot = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface ThunderGodEncounterBudget {
  cash: number; actions: number; health: number; mind: number; spirituality: number; pollution: number; gender: string; sequence: 1;
  acting: number; coreStats: SliceState['character']['coreStats']; mastery: Record<string, number>; completedSources: string[]; injuries: SliceInjury[]; injuryRisk: number;
}
export interface ThunderGodPreparation {
  week: number; date: PublicGameDate; revision: number; runId: string; randomSeed: string; randomCursor: number; pricePaid: 0; actionsPaid: 1;
  lifeReflected: true; playerName: string; playerClubHeld: boolean; before: ThunderGodEncounterBudget; after: ThunderGodEncounterBudget;
  finance: ThunderGodFinanceSnapshot; materialsBefore: ThunderGodMaterials; materialsAfter: ThunderGodMaterials;
}
export type ThunderGodEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' } | { type: 'ENCOUNTER_POLICY'; policy: ThunderGodPolicy };
export interface ThunderGodEncounterJournal {
  command: ThunderGodEncounterCommand; week: number; date: PublicGameDate; revision: number; randomCursor: number;
  before: ThunderGodEncounterBudget; after: ThunderGodEncounterBudget; finance: ThunderGodFinanceSnapshot; sceneBefore: ThunderGodScene; sceneAfter: ThunderGodScene; materialsBefore: ThunderGodMaterials; materialsAfter: ThunderGodMaterials;
}
export interface ThunderGodEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: ThunderGodCombatBody['enemyStatus']; exitMetres: 0 | 4; exitSeconds: 0 | 4;
}
export interface ThunderGodEncounterState extends ThunderGodCombatBody {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof THUNDER_GOD_TARGET_ID; policy: ThunderGodPolicy;
  preparation: ThunderGodPreparation | null; purchases: never[]; attemptWeek: number | null; startHistoryIndex: number | null; startSource: ThunderGodCombatSource | null;
  originalHistory: SliceCombatRound[] | null; originalResources: string | null; scene: ThunderGodScene; materials: ThunderGodMaterials; journal: ThunderGodEncounterJournal[]; terminal: ThunderGodEncounterTerminal | null;
}
export function createThunderGodEncounterState(): ThunderGodEncounterState {
  return { ...initialThunderGodBody(), status: 'AVAILABLE', targetId: THUNDER_GOD_TARGET_ID, policy: 'INHERITED_ONLY', preparation: null, purchases: [], attemptWeek: null, startHistoryIndex: null,
    startSource: null, originalHistory: null, originalResources: null, scene: createThunderGodScene(), materials: createThunderGodMaterials(), journal: [], terminal: null };
}
export const createThunderGodEncounter = createThunderGodEncounterState;
export const isThunderGodEncounterStage = (s: SliceState) => s.progression.pathwayId === 'tyrant' && s.progression.sequence === 1;
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
export function thunderGodFinanceSnapshot(s: ThunderGodFinanceSnapshot): ThunderGodFinanceSnapshot {
  return { weeklyBudget: s.weeklyBudget, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: structuredClone(s.debts), missedWeeks: s.missedWeeks, credit: s.credit };
}
function validFinance(v: ThunderGodFinanceSnapshot, week: number): boolean {
  return shape(v, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit']) && integer(v.weeklyBudget, 1, 100) && Object.hasOwn(SLICE_LIFE, v.lifeTier) && Object.hasOwn(SLICE_LIFE, v.nextLifeTier) &&
    integer(v.missedWeeks) && ['NORMAL', 'NOTICE', 'SUSPENDED'].includes(v.credit) && Array.isArray(v.debts) && v.debts.every(d => shape(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek']) &&
      typeof d.id === 'string' && !!d.id && typeof d.source === 'string' && !!d.source && integer(d.remaining) && integer(d.weeklyPayment, 1) && integer(d.createdWeek, 0, week));
}
export function thunderGodEncounterBudget(s: SliceState): ThunderGodEncounterBudget {
  return { cash: s.cash, actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution, gender: s.character.gender,
    sequence: 1, acting: s.progression.acting, coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources], injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function validBudget(v: ThunderGodEncounterBudget, revision: number): boolean {
  return shape(v, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) && integer(v.cash) &&
    integer(v.actions, 0, 100) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.pollution, 0, 100) && typeof v.gender === 'string' && v.sequence === 1 && integer(v.acting, 0, 100) &&
    shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) && Object.values(v.coreStats).every(n => integer(n, 0, 500)) && !!v.mastery && typeof v.mastery === 'object' && !Array.isArray(v.mastery) && Object.values(v.mastery).every(n => integer(n, 0, 500)) &&
    Array.isArray(v.completedSources) && v.completedSources.every(x => typeof x === 'string' && !!x) && new Set(v.completedSources).size === v.completedSources.length && validThunderGodInjuries(v.injuries, revision) && integer(v.injuryRisk);
}
export function validThunderGodMaterials(v: ThunderGodMaterials): boolean {
  try { const initial = createThunderGodMaterials(), w = v.weapon;
    return shape(v, ['weapon','screen']) && shape(w, Object.keys(initial.weapon)) && ['HAND','PLATFORM'].includes(w.location) && integer(w.charge,0,4) && same({...w,location:'HAND',charge:4},initial.weapon) && shape(v.screen,Object.keys(initial.screen)) && ['OPEN','CLOSED'].includes(v.screen.hood) && integer(v.screen.operations) && same({...v.screen,hood:'OPEN',operations:0},initial.screen);
  } catch { return false; }
}
function arrivalMaterials(before: ThunderGodMaterials): ThunderGodMaterials { return structuredClone(before); }
export function validateThunderGodPreparation(v: unknown): v is ThunderGodPreparation {
  try { const p=v as ThunderGodPreparation; return shape(p,['week','date','revision','runId','randomSeed','randomCursor','pricePaid','actionsPaid','lifeReflected','playerName','playerClubHeld','before','after','finance','materialsBefore','materialsAfter']) &&
    integer(p.week,1)&&isValidGameDate(p.date)&&integer(p.revision,1)&&typeof p.runId==='string'&&!!p.runId&&typeof p.randomSeed==='string'&&!!p.randomSeed&&integer(p.randomCursor)&&typeof p.playerClubHeld==='boolean'&&typeof p.playerName==='string'&&!!p.playerName.trim()&&p.pricePaid===0&&p.actionsPaid===1&&p.lifeReflected===true&&
    validBudget(p.before,p.revision)&&validBudget(p.after,p.revision)&&validFinance(p.finance,p.week)&&p.before.actions>=1&&p.before.actions<=Math.max(4,p.finance.weeklyBudget)&&same(p.after,{...p.before,actions:p.before.actions-1})&&
    validThunderGodMaterials(p.materialsBefore)&&validThunderGodMaterials(p.materialsAfter)&&same(p.materialsAfter,arrivalMaterials(p.materialsBefore));
  }catch{return false;}
}
export function validThunderGodScene(p: ThunderGodScene): boolean {
  const initial=createThunderGodScene();
  return shape(p,Object.keys(initial)) && same({...p,playerLocation:'OUTSIDE',playerCoordinate:0,visibleBodyLine:true,conditionVersion:1,observedConditionVersion:null,observedSourceId:null,observationWeek:null,clockSeconds:0,externalSeconds:0,playerTravelMetres:0,knownPlayerName:null,knownEnemyName:null},initial) &&
    typeof p.visibleBodyLine==='boolean' && integer(p.conditionVersion,1) && (p.observedConditionVersion===null||integer(p.observedConditionVersion,1,p.conditionVersion)) &&
    (p.playerLocation==='OUTSIDE'&&p.playerCoordinate===0||p.playerLocation==='PLATFORM'&&p.playerCoordinate===4) && integer(p.clockSeconds) && p.externalSeconds===p.clockSeconds && integer(p.playerTravelMetres) &&
    (p.observedSourceId===null?p.observationWeek===null&&p.knownPlayerName===null&&p.knownEnemyName===null:typeof p.observedSourceId==='string'&&integer(p.observationWeek,1)&&typeof p.knownPlayerName==='string'&&!!p.knownPlayerName.trim()&&p.knownEnemyName==='欧伦·盖奇');
}
function protectedOriginals(s: SliceState): string {
  return stableStringify({sailor:s.sailor,rager:s.rager,navigator:s.navigator,windBlessed:s.windBlessed,oceanSinger:s.oceanSinger,cataclysmPriest:s.cataclysmPriest,seaKing:s.seaKing,catastrophe:s.catastrophe,town:s.town,life:s.thunderGod.life});
}
function adultsAbsent(s: SliceState): boolean {
  const life=s.thunderGod.life;
  return !hasThunderGodLifeLock(s)&&life.reflected&&life.playerLocation==='OUTSIDE'&&!life.keeperPresent&&!life.finn.present&&life.finn.location==='AWAY'&&s.catastrophe.life.site.keeper.position==='CONTROL'&&s.catastrophe.life.site.playerPosition==='EXIT';
}
function historyUnchanged(s: SliceState): boolean {const e=s.thunderGod.encounter;return Array.isArray(e.originalHistory)&&same(e.originalHistory,s.combatHistory.slice(0,e.originalHistory.length));}
function originalsUnchanged(s: SliceState): boolean {return s.thunderGod.encounter.originalResources===protectedOriginals(s)&&historyUnchanged(s);}
export function validateThunderGodEncounterCommand(v:unknown):v is ThunderGodEncounterCommand {if(!v||typeof v!=='object'||Array.isArray(v))return false;const c=v as ThunderGodEncounterCommand;return c.type==='ENCOUNTER_POLICY'?shape(c,['type','policy'])&&['INHERITED_ONLY','GUIDED_THUNDER','STORM_BRACE','ALL','ORDINARY'].includes(c.policy):shape(c,['type'])&&['ENCOUNTER_TALK','ENCOUNTER_FIGHT','LEAVE_ENCOUNTER'].includes(c.type);}
export const isThunderGodEncounterCommand=validateThunderGodEncounterCommand;
export const hasThunderGodEncounterLock=(s:SliceState):boolean=>['READY','FIGHTING'].includes(s.thunderGod.encounter.status);
export const isInsideThunderGodEncounter=hasThunderGodEncounterLock;
export function blockThunderGodEncounter(s:SliceState,c:ThunderGodEncounterCommand):string|null {
  if(!validateThunderGodEncounterCommand(c))return'遭遇命令无效。';const e=s.thunderGod.encounter;
  if(!isThunderGodEncounterStage(s)||s.thunderGod.promotionWeek===null||s.status!=='ACTIVE'||s.health<=0)return'须本人仍活着并完成雷神晋升。';
  if(s.combat)return'先处理当前真实战斗。';if(!adultsAbsent(s))return'先收束三项生活实践，收回实际原靶与护垫，让诺拉回到湾内控制处、芬恩离开现场。';if(s.world.city!=='BACKLUND')return'须实际在贝克兰德干平台。';
  if(c.type==='LEAVE_ENCOUNTER')return e.status==='READY'&&originalsUnchanged(s)?null:'须已亲自到场，才能普通离开。';
  if(s.activeEvent||s.eventQueue.length||s.pulse!=='NONE')return'先处理当前事件或周账。';if(s.mind<=0)return'需要清醒；到场后仍可普通退出。';
  if(c.type==='ENCOUNTER_TALK')return e.status!=='AVAILABLE'||e.preparation?'同一欧伦的争议不能重置。':s.actionsRemaining<1?'到场需1行动；行动用尽仍可普通离开。':null;
  if(e.status!=='READY'||!e.preparation||!originalsUnchanged(s))return'须先亲自交谈并保留同一原人原物和旧记录。';
  if(c.type==='ENCOUNTER_POLICY')return c.policy===e.policy&&e.journal.some(j=>j.command.type==='ENCOUNTER_POLICY')?'已经采用这项策略。':null;
  if(!e.journal.some(j=>j.command.type==='ENCOUNTER_POLICY'))return'先明确选择本场策略；开战后不能更换。';return s.actionsRemaining<1?'开战需要1行动；和平离开不花行动。':null;
}
export const thunderGodEncounterReason=blockThunderGodEncounter;
export function leaveThunderGodCombatScene(p:ThunderGodScene):void {if(p.playerLocation!=='PLATFORM'||p.playerCoordinate!==4)throw new Error('须从实际所在干平台离开。');p.playerLocation='OUTSIDE';p.playerCoordinate=0;p.playerTravelMetres+=4;p.clockSeconds+=4;p.externalSeconds+=4;}
function arrive(s:SliceState,p:ThunderGodPreparation):ThunderGodScene{return{...createThunderGodScene(),playerLocation:'PLATFORM',playerCoordinate:4,observedSourceId:`${s.runId}:TG1-PLATFORM:${p.revision}`,observationWeek:p.week,observedConditionVersion:1,clockSeconds:4,externalSeconds:4,playerTravelMetres:4,knownPlayerName:p.playerName,knownEnemyName:'欧伦·盖奇'};}
export function applyThunderGodEncounterCommand(s:SliceState,c:ThunderGodEncounterCommand,ctx:SeerContext):void {
  const reason=blockThunderGodEncounter(s,c);if(reason)throw new Error(reason);const e=s.thunderGod.encounter;
  if(c.type==='ENCOUNTER_TALK'){
    const before=thunderGodEncounterBudget(s),materialsBefore=structuredClone(e.materials);s.actionsRemaining--;e.materials=arrivalMaterials(e.materials);
    e.preparation={week:s.week,date:{...s.date},revision:s.revision+1,runId:s.runId,randomSeed:s.random.seed,randomCursor:s.random.cursor,pricePaid:0,actionsPaid:1,lifeReflected:true,playerName:s.character.name,playerClubHeld:s.town.clubLocation==='HAND',before,after:thunderGodEncounterBudget(s),finance:thunderGodFinanceSnapshot(s),materialsBefore,materialsAfter:structuredClone(e.materials)};
    e.originalHistory=structuredClone(s.combatHistory);e.originalResources=protectedOriginals(s);e.scene=arrive(s,e.preparation);e.status='READY';
    ctx.note('走到干平台与欧伦交谈',`实付1行动，步行4米4秒。你介绍姓名“${s.character.name}”，48岁的欧伦·盖奇也报出姓名。他持自己的唯一杆，身体100、精神100、灵性120，杆中只有四次有限雷击。诺拉、芬恩及旧人物均不在场；维尔仍未接触。`);return;
  }
  const entry:ThunderGodEncounterJournal={command:structuredClone(c),week:s.week,date:{...s.date},revision:s.revision+1,randomCursor:s.random.cursor,before:thunderGodEncounterBudget(s),after:thunderGodEncounterBudget(s),finance:thunderGodFinanceSnapshot(s),sceneBefore:structuredClone(e.scene),sceneAfter:structuredClone(e.scene),materialsBefore:structuredClone(e.materials),materialsAfter:structuredClone(e.materials)};
  if(c.type==='ENCOUNTER_POLICY'){e.policy=c.policy;ctx.note('选择雷神交战策略',c.policy==='ORDINARY'?'本场只作普通动作；不施放抽到的能力。':c.policy==='INHERITED_ONLY'?'本场只允许已学能力；两项新能力回到普通防备。':'仅在所选能力抽到、实际对象与资源齐备时尝试。每轮各一次，失败照付，空窗口没有掌握奖励。');}
  else if(c.type==='LEAVE_ENCOUNTER'){leaveThunderGodCombatScene(e.scene);e.status='RESOLVED';ctx.note('沿普通路和平离开干平台','沿开放出口实际走4米4秒，原海湾物件均留在原处，自己原靶与护垫保留实际位置。没有战斗或奖励，欧伦与自己的杆留在干平台。');}
  else{s.actionsRemaining--;e.status='FIGHTING';e.attemptWeek=s.week;e.startHistoryIndex=s.combatHistory.length;s.combat={encounterId:'THUNDER_GOD_DISPUTE',round:1,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemyInjuries:structuredClone(e.enemyInjuries),enemyRisk:e.enemyRisk,enemyStatus:'RESISTING',lastRound:null};ctx.note('选择与欧伦交战','实付1行动。双方各自最多六次实际行动，精神压力与身体伤害各有实际来源。普通撤退、停止抵抗、伤势与真实死亡照常。');}
  entry.after=thunderGodEncounterBudget(s);entry.sceneAfter=structuredClone(e.scene);entry.materialsAfter=structuredClone(e.materials);e.journal.push(entry);
  if(c.type==='ENCOUNTER_FIGHT'){const source=currentThunderGodCombatSource(s);if(!source)throw new Error('真实战斗来源不完整。');e.startSource={...source,revision:s.revision+1};}
}
export const applyThunderGodEncounter=applyThunderGodEncounterCommand;
export const handleThunderGodEncounter=applyThunderGodEncounterCommand;
export function startThunderGodEncounter(s:SliceState,ctx:SeerContext):void{applyThunderGodEncounterCommand(s,{type:'ENCOUNTER_FIGHT'},ctx);}
export function hasThunderGodDisputeOpponent(s:SliceState):boolean {
  const e=s.thunderGod?.encounter,c=s.combat;return isThunderGodEncounterStage(s)&&s.status==='ACTIVE'&&!s.activeEvent&&s.world.city==='BACKLUND'&&s.health>0&&s.mind>0&&s.thunderGod.promotionWeek!==null&&!!e&&e.status==='FIGHTING'&&e.targetId===THUNDER_GOD_TARGET_ID&&e.terminal===null&&e.preparation!==null&&e.materials.weapon.charge===4-e.powerUses.LIGHTNING&&originalsUnchanged(s)&&e.attemptWeek===s.week&&adultsAbsent(s)&&
    validThunderGodScene(e.scene)&&e.scene.playerLocation==='PLATFORM'&&e.scene.knownPlayerName===s.character.name&&validThunderGodMaterials(e.materials)&&validThunderGodBody(e)&&e.weaponLocation===e.materials.weapon.location&&c?.encounterId==='THUNDER_GOD_DISPUTE'&&c.enemyStatus==='RESISTING'&&c.enemyHealth>0&&c.enemyMind>0&&e.enemyStatus==='RESISTING'&&e.enemyHealth===c.enemyHealth&&e.enemyMind===c.enemyMind&&same(e.enemyInjuries,c.enemyInjuries)&&e.enemyRisk===c.enemyRisk&&integer(c.round,1)&&e.startHistoryIndex!==null&&integer(e.startHistoryIndex)&&s.combatHistory.length-e.startHistoryIndex===c.round-1;
}
function terminalScene(o:ThunderGodRoundOutcome):{root:ThunderGodScene;exit:0|4;materials:ThunderGodMaterials}{const root=structuredClone(o.rootAfter),materials=structuredClone(o.materialsAfter),exit=o.playerHealthAfter>0?4:0;if(exit)leaveThunderGodCombatScene(root);return{root,exit,materials};}
export function settleThunderGodEncounter(s:SliceState,outcome:string,ctx:SeerContext,_award?:(source:string,amount:5|8|25)=>void):void {
  const e=s.thunderGod.encounter,c=s.combat;if(e.status!=='FIGHTING'||c?.encounterId!=='THUNDER_GOD_DISPUTE')throw new Error('没有这场干平台冲突。');if(outcome==='CONTINUE')return;const last=c.lastRound,o=last?.thunderGodOutcome;
  if(!last||!o||!validateThunderGodCombatRound(last)||o.continuing||e.terminal||e.startHistoryIndex===null||c.round!==last.round+1||s.combatHistory.length-e.startHistoryIndex!==last.round||!originalsUnchanged(s)||!same(s.combatHistory.at(-1),last)||!same(combatBody(e),combatBody(o))||!same(o.rootAfter,e.scene)||!same(o.materialsAfter,e.materials)||o.playerHealthAfter!==s.health||o.playerMindAfter!==s.mind||o.playerSpiritualityAfter!==s.spirituality||!same(o.masteryAfter,s.progression.mastery)||!same(o.playerInjuriesAfter,s.injuries)||o.playerRiskAfter!==s.injuryRisk||o.enemyHealth!==c.enemyHealth||o.enemyMind!==c.enemyMind||!same(o.enemyInjuries,c.enemyInjuries)||o.enemyRisk!==c.enemyRisk||o.enemyStatus!==c.enemyStatus||outcome!==(o.playerHealthAfter===0?'PLAYER_DEAD':o.enemyHealth===0?'ENEMY_DEAD':o.enemyStatus==='SURRENDERED'?'ENEMY_SURRENDERED':'RETREATED'))throw new Error('结局与真实回合、原人原物和费用不一致。');
  const final=terminalScene(o);e.scene=final.root;e.materials=final.materials;e.terminal={outcome:outcome as ThunderGodEncounterTerminal['outcome'],round:last.round,historyIndex:s.combatHistory.length-1,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,enemyStatus:e.enemyStatus,exitMetres:final.exit,exitSeconds:final.exit};e.status=outcome==='PLAYER_DEAD'?'LOST':outcome==='RETREATED'?'RETREATED':'RESOLVED';s.combat=null;
  ctx.note('欧伦的干平台冲突结束',`${final.exit?'本人带着实际持有的原件，沿普通出口走4米4秒。':'本人的原身体真实死亡，实际自有物品留在身体处。'}双方原灵性、精神、伤势与杆落点保留，没有复活或补发杆中储能。诺拉、芬恩和旧人物仍各在原处。`);
}
export const finishThunderGodEncounter=settleThunderGodEncounter;
export function thunderGodEncounterActions(s:SliceState){
  if(!isThunderGodEncounterStage(s))return[];
  const choices:{command:ThunderGodEncounterCommand;label:string;cost:string}[]=[
    {command:{type:'ENCOUNTER_TALK'},label:'到干平台与欧伦交谈',cost:'1行动、4米4秒；用尽行动仍可和平离开'},
    ...THUNDER_GOD_POLICIES.map(policy=>({command:{type:'ENCOUNTER_POLICY' as const,policy},label:({INHERITED_ONLY:'只用已学能力',GUIDED_THUNDER:'允许雷势引导',STORM_BRACE:'允许风雷护持',ALL:'允许两项新能力',ORDINARY:'只作普通行动'})[policy],cost:'0行动；开战前明确选择'})),
    {command:{type:'ENCOUNTER_FIGHT'},label:'自主承担真实冲突',cost:'1行动；真实伤势与死亡风险'},
    {command:{type:'LEAVE_ENCOUNTER'},label:'沿普通路和平离开',cost:'0行动、4米4秒'}];
  return choices.map(({command,label,cost})=>{const reason=blockThunderGodEncounter(s,command);return{id:`TG1-${command.type}${command.type==='ENCOUNTER_POLICY'?'-'+command.policy:''}`,command,label,cost,enabled:reason===null,reason,cleanup:command.type==='LEAVE_ENCOUNTER'};});
}
export const THUNDER_GOD_ENCOUNTER_STORY='48岁的欧伦·盖奇独自在湾口外的干平台提出通行争议。他有独立健康100、精神100、灵性120、自己的唯一原杆与原遮挡罩。原杆重2千克，仅有四次有限雷击储能。诺拉留在湾内控制处，芬恩已经离开，旧敌维尔从未接触。沿四米普通路到场，亲自交谈、明确策略后再决定交战或和平离开。';
export function projectThunderGodEncounter(s:SliceState){const e=s.thunderGod.encounter;return{title:'欧伦的干平台争议',story:isThunderGodEncounterStage(s)?THUNDER_GOD_ENCOUNTER_STORY:'',status:e.status,inside:hasThunderGodEncounterLock(s),policy:e.policy,policyConfirmed:e.journal.some(j=>j.command.type==='ENCOUNTER_POLICY'),scene:structuredClone(e.scene),materials:structuredClone(e.materials),
  enemy:{id:e.targetId,name:'欧伦·盖奇',age:48 as const,sequence:1 as const,health:e.enemyHealth,mind:e.enemyMind,spirituality:e.enemySpirituality,status:e.enemyStatus,weaponLocation:e.weaponLocation,powerUses:{...e.powerUses}},actions:thunderGodEncounterActions(s),facts:[
    '雷势引导每轮一次，8灵性2精神、感知18并受30%抵抗。30秒内只辅助同一可见目标上的下一次真实威胁攻击30；开窗本身没有贡献。',
    '风雷护持每轮一次，6灵性2精神、意志18并受30%抵抗。30秒内只削弱下一项已声明可见身体冲击30，不能挡住精神压力。',
    '关闭原罩改变条件并遮挡视线，旧窗口立即失效；普通走近揭罩能重新看清原人。失败和未应用窗口没有掌握奖励。双方独自交战，歌声没有自动豁免同伴的效果。',
    '沿用22项原掌握与实际自有资源。干平台没有海水、可投掷物或免费同伴。原杆仅4次储能，无新增物品池。',
    '体35%、感25%、意25%、知15%；双方1至6动作权重10/15/25/25/15/10，基础1250、底125、上限120，仅继续轮恢复12。',
    '每个实际动作5秒，每轮60秒。精神耗尽仍活着停战，身体死亡终结本周目；生还沿普通出口实走4米4秒。']};}
export type ThunderGodEncounterProjection=ReturnType<typeof projectThunderGodEncounter>;

/** Exact shared finance transition after a completed, unlocked action. Locked
 * READY/FIGHTING scenes never pay a bill or grant next-week actions early. */
export function thunderGodCompletedBudgetMatches(s:SliceState,expected:ThunderGodEncounterBudget,finance:ThunderGodFinanceSnapshot,week:number,date:PublicGameDate,revision:number,randomCursor:number,anchorTitle:string):boolean {
 const current=thunderGodEncounterBudget(s);
 if(!same({...current,cash:expected.cash,actions:expected.actions},expected)||s.random.cursor!==randomCursor)return false;
 const titles=['本周生活费','生活费如实记账','本周约定还款','账目结清','新的一周'];
 const receipts=s.chronicle.filter((entry,index)=>entry.id===`record-${s.revision}-${index}`&&titles.includes(entry.title));
 if(expected.actions>0||expected.health===0)return s.week===week&&same(s.date,date)&&s.actionsRemaining===expected.actions&&s.cash===expected.cash&&same(thunderGodFinanceSnapshot(s),finance)&&s.pulse==='NONE'&&s.billAmount===0&&s.activeEvent===null&&s.eventQueue.length===0&&receipts.length===0;
 if(expected.actions!==0||s.status!=='ACTIVE')return false;
 const result=resolveSliceWeeklyFinance({...finance,cash:expected.cash,week,revision:revision-1,pulse:'BILL',billAmount:0}),advanced=result.eventId===null&&result.state.pulse==='ADVANCE';
 const finalFinance={...finance,...result.state,weeklyBudget:finance.weeklyBudget,lifeTier:advanced?result.state.nextLifeTier:finance.lifeTier};
 if(s.cash!==result.state.cash||!same(thunderGodFinanceSnapshot(s),thunderGodFinanceSnapshot(finalFinance))||s.week!==week+(advanced?1:0)||!same(s.date,advanced?addGameWeeks(date,1):date)||s.actionsRemaining!==(advanced?finance.weeklyBudget:0)||s.pulse!==(advanced?'NONE':result.state.pulse)||s.billAmount!==(advanced?0:result.state.billAmount))return false;
 const expectedReceipts=result.receipts.map(receipt=>({week,...receipt}));if(advanced)expectedReceipts.push({week:week+1,title:'新的一周',text:`日期推进7天，本周${finance.weeklyBudget}次行动。`});
 if(!same(receipts.map(({week,title,text})=>({week,title,text})),expectedReceipts))return false;
 if(result.eventId){const anchor=s.chronicle.findIndex((entry,index)=>entry.id===`record-${s.revision}-${index}`&&entry.title===anchorTitle),eventIndex=anchor+1+result.receipts.length;return anchor>=0&&s.eventQueue.length===0&&same(s.activeEvent,{id:result.eventId,instanceId:`${s.runId}:${result.eventId}:${s.revision}:${eventIndex}`});}
 return s.activeEvent===null&&s.eventQueue.length===0;
}
export function thunderGodTerminalBudgetMatches(s:SliceState,_prep:ThunderGodPreparation,o:ThunderGodRoundOutcome):boolean {
 const fight=s.thunderGod.encounter.journal.find(j=>j.command.type==='ENCOUNTER_FIGHT');if(!fight)return false;
 const expected={...fight.after,health:o.playerHealthAfter,mind:o.playerMindAfter,spirituality:o.playerSpiritualityAfter,mastery:o.masteryAfter,injuries:o.playerInjuriesAfter,injuryRisk:o.playerRiskAfter};
 return same(s.thunderGod.encounter.scene,terminalScene(o).root)&&same(s.thunderGod.encounter.materials,terminalScene(o).materials)&&thunderGodCompletedBudgetMatches(s,expected,fight.finance,fight.week,fight.date,o.source.revision+1,o.randomCursorAfter,'欧伦的干平台冲突结束');
}
function peacefulBudgetMatches(s:SliceState,e:ThunderGodEncounterJournal):boolean{return e.command.type==='LEAVE_ENCOUNTER'&&thunderGodCompletedBudgetMatches(s,e.after,e.finance,e.week,e.date,e.revision,e.randomCursor,'沿普通路和平离开干平台');}
export function replayThunderGodPurchases(s:SliceState):ThunderGodMaterials|null { return Array.isArray(s.thunderGod.encounter.purchases)&&s.thunderGod.encounter.purchases.length===0?createThunderGodMaterials():null; }
/** Exact root and source-chain replay. Historical rounds are immutable; a later
 * ordinary rest may change the live player but cannot alter a recorded fight. */
export function replayThunderGodEncounterRoot(s:SliceState):ThunderGodScene|null {
 try{
  const e=s.thunderGod.encounter,initial=createThunderGodEncounterState(),allNew=s.combatHistory.flatMap((r,i)=>r.thunderGodOutcome?[i]:[]),purchased=replayThunderGodPurchases(s);
  if(!e||!shape(e,Object.keys(initial))||!['AVAILABLE','READY','FIGHTING','RESOLVED','RETREATED','LOST'].includes(e.status)||e.targetId!==initial.targetId||!['INHERITED_ONLY','GUIDED_THUNDER','STORM_BRACE','ALL','ORDINARY'].includes(e.policy)||!validThunderGodBody(e)||!validThunderGodScene(e.scene)||!validThunderGodMaterials(e.materials)||e.weaponLocation!==e.materials.weapon.location||!purchased)return null;
  if(!e.preparation)return same({...e,purchases:[],materials:createThunderGodMaterials()},initial)&&same(e.materials,purchased)&&allNew.length===0&&s.combat?.encounterId!=='THUNDER_GOD_DISPUTE'?createThunderGodScene():null;
  const prep=e.preparation;
  if(!isThunderGodEncounterStage(s)||s.thunderGod.promotionWeek===null||!s.thunderGod.life.reflected||!validateThunderGodPreparation(prep)||prep.runId!==s.runId||prep.playerName!==s.character.name||prep.randomSeed!==s.random.seed||prep.randomCursor>s.random.cursor||!integer(prep.week,s.thunderGod.promotionWeek,s.week)||compareGameDates(prep.date,s.date)>0||!integer(prep.revision,1,s.revision)||!historyUnchanged(s)||typeof e.originalResources!=='string'||!e.originalResources||!Array.isArray(e.journal)||!same(prep.materialsBefore,purchased))return null;
  let policyChosen=false,root=arrive(s,prep),status:ThunderGodEncounterState['status']='READY',policy:ThunderGodPolicy='INHERITED_ONLY',materials=structuredClone(prep.materialsAfter);
  let budget=prep.after,finance=prep.finance,week=prep.week,date=prep.date,revision=prep.revision;
  for(const entry of e.journal){
   if(!shape(entry,['command','week','date','revision','randomCursor','before','after','finance','sceneBefore','sceneAfter','materialsBefore','materialsAfter'])||!validateThunderGodEncounterCommand(entry.command)||!['ENCOUNTER_POLICY','ENCOUNTER_FIGHT','LEAVE_ENCOUNTER'].includes(entry.command.type)||!validBudget(entry.before,entry.revision)||!validBudget(entry.after,entry.revision)||!validFinance(entry.finance,entry.week)||!integer(entry.revision,revision+1,s.revision)||entry.randomCursor!==prep.randomCursor||!same(entry.sceneBefore,root)||!same(entry.materialsBefore,materials)||status!=='READY'||entry.week!==week||!same(entry.date,date)||!same(entry.before,budget)||!same(entry.finance,finance))return null;
   if(entry.command.type==='ENCOUNTER_POLICY'){if(policyChosen&&entry.command.policy===policy)return null;policy=entry.command.policy;policyChosen=true;}
   else if(entry.command.type==='ENCOUNTER_FIGHT'){if(!policyChosen||root.playerLocation!=='PLATFORM'||entry.before.actions<1)return null;status='FIGHTING';}
   else{leaveThunderGodCombatScene(root);status='RESOLVED';}
   if(!same(entry.after,{...entry.before,actions:entry.before.actions-(entry.command.type==='ENCOUNTER_FIGHT'?1:0)})||!same(entry.sceneAfter,root)||!same(entry.materialsAfter,materials))return null;
   budget=entry.after;finance=entry.finance;week=entry.week;date=entry.date;revision=entry.revision;
  }
  if(e.policy!==policy)return null;
  if(status!=='FIGHTING'){
   if(e.status!==status||e.startHistoryIndex!==null||e.startSource!==null||e.attemptWeek!==null||e.terminal!==null||!same(combatBody(e),initialThunderGodBody())||!same(e.materials,materials)||allNew.length||s.combat?.encounterId==='THUNDER_GOD_DISPUTE')return null;
   if(status==='READY'||s.revision===revision){
    if(!originalsUnchanged(s)||!adultsAbsent(s))return null;
    if(status==='READY'){if(!same(thunderGodEncounterBudget(s),budget)||!same(thunderGodFinanceSnapshot(s),finance)||s.week!==week||!same(s.date,date)||s.random.cursor!==prep.randomCursor||s.pulse!=='NONE'||s.billAmount!==0||s.activeEvent||s.eventQueue.length)return null;}
    else if(!e.journal.at(-1)||!peacefulBudgetMatches(s,e.journal.at(-1)!))return null;
   }
   return root;
  }
  const start=e.startSource;
  if(!start||!validThunderGodCombatSource(start)||!integer(e.startHistoryIndex,0,s.combatHistory.length)||e.startHistoryIndex!==e.originalHistory!.length||e.attemptWeek!==week||start.round!==1||start.revision!==revision||start.week!==week||!same(start.date,date)||start.startHistoryIndex!==e.startHistoryIndex||start.runId!==s.runId||!same(start.preparation,prep)||start.policy!==policy||!same(start.body,initialThunderGodBody())||!same(start.root,root)||!same(start.materials,materials)||start.randomSeed!==s.random.seed||start.randomCursor!==prep.randomCursor||start.playerHealth!==budget.health||start.playerMind!==budget.mind||start.playerSpirituality!==budget.spirituality||!same(start.mastery,budget.mastery)||!same(start.playerInjuries,budget.injuries)||start.playerRisk!==budget.injuryRisk)return null;
  const terminal=e.terminal;
  if(terminal&&(!shape(terminal,['outcome','round','historyIndex','enemyHealth','enemyMind','enemySpirituality','enemyStatus','exitMetres','exitSeconds'])||!integer(terminal.historyIndex,e.startHistoryIndex,s.combatHistory.length-1)))return null;
  const end=terminal?terminal.historyIndex+1:s.combatHistory.length,rounds=s.combatHistory.slice(e.startHistoryIndex,end);
  if(!same(allNew,rounds.map((_r,i)=>e.startHistoryIndex!+i)))return null;
  for(const[i,round]of rounds.entries()){const o=round.thunderGodOutcome,previous=rounds[i-1]?.thunderGodOutcome;if(!o||!validateThunderGodCombatRound(round)||round.round!==i+1||o.source.revision>=s.revision||o.randomCursorAfter>s.random.cursor||!same(o.source,previous?nextThunderGodCombatSource(previous):start)||!same(o.source.root,root)||i<rounds.length-1&&!o.continuing)return null;root=structuredClone(o.rootAfter);materials=structuredClone(o.materialsAfter);}
  const last=rounds.at(-1),o=last?.thunderGodOutcome;
  if(e.status==='FIGHTING'){
   if(terminal||!hasThunderGodDisputeOpponent(s)||!same(combatBody(e),o?combatBody(o):start.body)||!same(e.materials,materials))return null;
   const current=thunderGodEncounterBudget(s),expected={...budget,health:o?.playerHealthAfter??start.playerHealth,mind:o?.playerMindAfter??start.playerMind,spirituality:o?Math.min(120,o.playerSpiritualityAfter+12):start.playerSpirituality,mastery:o?.masteryAfter??start.mastery,injuries:o?.playerInjuriesAfter??start.playerInjuries,injuryRisk:o?.playerRiskAfter??start.playerRisk};
   if(!same(current,expected)||!same(thunderGodFinanceSnapshot(s),finance)||s.week!==week||!same(s.date,date)||s.pulse!=='NONE'||s.billAmount!==0||s.activeEvent!==null||s.eventQueue.length)return null;
   return o?o.continuing&&same(last,s.combat!.lastRound)&&same(currentThunderGodCombatSource(s),nextThunderGodCombatSource(o))?root:null:s.combat!.lastRound===null&&same(currentThunderGodCombatSource(s),start)?root:null;
  }
  if(s.combat?.encounterId==='THUNDER_GOD_DISPUTE'||!terminal||!last||!o||o.continuing||terminal.round!==last.round||rounds.length!==terminal.round||!same(combatBody(e),combatBody(o))||terminal.enemyHealth!==e.enemyHealth||terminal.enemyMind!==e.enemyMind||terminal.enemySpirituality!==e.enemySpirituality||terminal.enemyStatus!==e.enemyStatus)return null;
  const final=terminalScene(o);if(terminal.exitMetres!==final.exit||terminal.exitSeconds!==final.exit||!same(e.materials,final.materials))return null;
  if(s.revision===o.source.revision+1&&(!originalsUnchanged(s)||!thunderGodTerminalBudgetMatches(s,prep,o)))return null;
  if(terminal.outcome==='PLAYER_DEAD')return e.status==='LOST'&&s.status==='DEAD'&&o.playerHealthAfter===0?final.root:null;
  if(terminal.outcome==='RETREATED')return e.status==='RETREATED'&&o.playerHealthAfter>0&&(last.retreat==='SUCCESS'||o.playerMindAfter===0)?final.root:null;
  return e.status==='RESOLVED'&&o.playerHealthAfter>0&&(terminal.outcome==='ENEMY_DEAD'?e.enemyStatus==='DEAD':terminal.outcome==='ENEMY_SURRENDERED'&&e.enemyStatus==='SURRENDERED')?final.root:null;
 }catch{return null;}
}
export function validateThunderGodEncounter(s:SliceState):boolean {try{const root=replayThunderGodEncounterRoot(s);return root!==null&&same(root,s.thunderGod.encounter.scene);}catch{return false;}}
export const validateThunderGodEncounterState=validateThunderGodEncounter;
/** The dry platform is outside the original bay; encounter changes no original site objects. */
export function thunderGodEncounterOriginalEvents(_s:SliceState):{revision:number;week:number;before:SliceState['catastrophe']['life']['site'];after:SliceState['catastrophe']['life']['site']}[]{return [];}
