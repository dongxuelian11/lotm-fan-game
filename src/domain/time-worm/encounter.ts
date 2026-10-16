import { SLICE_LIFE } from '../../content/slice-events.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { addGameWeeks, compareGameDates, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceCombatRound, SliceInjury, SliceState } from '../slice/types.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { hasTimeWormLifeLock } from './life.js';
import { currentTimeWormCombatSource, nextTimeWormCombatSource, validTimeWormCombatSource, validateTimeWormCombatRound,
  validTimeWormBody, validTimeWormInjuries, type TimeWormCombatSource, type TimeWormRoundOutcome } from './combat.js';

export const TIME_WORM_TARGET_ID = 'TW1-ADRIAN' as const;
export const TIME_WORM_SITE = 'TW1-YARD' as const;
export const TIME_WORM_POWER_IDS = ['BODY_MARK', 'MENTAL_MARK', 'FEINT'] as const;
export type TimeWormPowerId = typeof TIME_WORM_POWER_IDS[number];
export type TimeWormEnemyIntent = TimeWormPowerId | 'BODY_STRIKE' | 'OBSERVE' | 'ACCIDENT';
export type TimeWormPolicy = 'INHERITED_ONLY' | 'SHORT_TIME_THEFT' | 'TIME_RELEASE' | 'ALL' | 'ORDINARY';
export type TimeWormCombatPolicy = TimeWormPolicy;
export const TIME_WORM_POLICIES: readonly TimeWormPolicy[] = ['INHERITED_ONLY','SHORT_TIME_THEFT','TIME_RELEASE','ALL','ORDINARY'];
export const TIME_WORM_POWERS = [
  { id: 'BODY_MARK', label: '有限身体冲击印记', cost: 7, selfGain: 75, enemyReduction: 0 },
  { id: 'MENTAL_MARK', label: '有限精神牵引印记', cost: 7, selfGain: 65, enemyReduction: 0 },
  { id: 'FEINT', label: '侧移一步并横棍遮挡', cost: 3, selfGain: 0, enemyReduction: 0 },
] as const;
export interface TimeWormMaterials {
  weapon: { id: 'TW1-ADRIAN-CLUB'; sourceId: 'TW1-ADRIAN-OWNED-CLUB-1'; owner: typeof TIME_WORM_TARGET_ID;
    massKg: 2; location: 'HAND' | 'YARD'; condition: 100; visible: true };
  marks: { id: string; owner: typeof TIME_WORM_TARGET_ID; status: 'HELD' | 'SPENT'; usedRound: number | null }[];
}
export function createTimeWormMaterials(): TimeWormMaterials {
  return { weapon: { id: 'TW1-ADRIAN-CLUB', sourceId: 'TW1-ADRIAN-OWNED-CLUB-1', owner: TIME_WORM_TARGET_ID,
    massKg: 2, location: 'HAND', condition: 100, visible: true },
    marks: [1,2,3].map(n=>({id:`TW1-ADRIAN-MARK-${n}`,owner:TIME_WORM_TARGET_ID,status:'HELD',usedRound:null})) };
}
export interface TimeWormScene {
  siteId: typeof TIME_WORM_SITE; playerLocation: 'OUTSIDE' | 'YARD'; playerCoordinate: 0 | 4; enemyCoordinate: 6 | 7;
  ordinaryExit: 'OPEN'; visibleBodyLine: boolean; conditionVersion: number; observedConditionVersion: number | null;
  thirdPartiesInArea: 0; presentMemberIds: string[]; observedSourceId: string | null; observationWeek: number | null;
  clockSeconds: number; externalSeconds: number; playerTravelMetres: number; enemyTravelMetres: number; knownPlayerName: string | null; knownEnemyName: string | null;
}
export function createTimeWormScene(): TimeWormScene {
  return { siteId: TIME_WORM_SITE, playerLocation: 'OUTSIDE', playerCoordinate: 0, enemyCoordinate: 6,
    ordinaryExit: 'OPEN', visibleBodyLine: true, conditionVersion: 1, observedConditionVersion: null,
    thirdPartiesInArea: 0, presentMemberIds: [], observedSourceId: null, observationWeek: null,
    clockSeconds: 0, externalSeconds: 0, playerTravelMetres: 0, enemyTravelMetres: 0, knownPlayerName: null, knownEnemyName: null };
}
export interface TimeWormObservation { power: 'BODY_MARK' | 'MENTAL_MARK'; conditionVersion: number; round: number; order: number; atSeconds: number; paidCost: 7 }
export interface TimeWormCombatBody {
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  weaponLocation: 'HAND' | 'YARD'; powerUses: Record<TimeWormPowerId, number>; observations: TimeWormObservation[];
  totalOwnerMindSpent: number; shortTimeTheftAttempts: number; shortTimeTheftChecks: number; shortTimeTheftSuccesses: number;
  timeReleaseAttempts: number; timeReleaseChecks: number; timeReleaseSuccesses: number; inheritedSuccesses: { deepDeception: number };
}
export function initialTimeWormBody(): TimeWormCombatBody {
  return { enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0, weaponLocation: 'HAND',
    powerUses: { BODY_MARK: 0, MENTAL_MARK: 0, FEINT: 0 }, observations: [], totalOwnerMindSpent: 0,
    shortTimeTheftAttempts: 0, shortTimeTheftChecks: 0, shortTimeTheftSuccesses: 0, timeReleaseAttempts: 0, timeReleaseChecks: 0, timeReleaseSuccesses: 0, inheritedSuccesses: { deepDeception: 0 } };
}
export function combatBody(e: TimeWormCombatBody): TimeWormCombatBody {
  return Object.fromEntries(Object.keys(initialTimeWormBody()).map(k => [k, structuredClone(e[k as keyof TimeWormCombatBody])])) as unknown as TimeWormCombatBody;
}
export type TimeWormFinanceSnapshot = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface TimeWormEncounterBudget {
  cash: number; actions: number; health: number; mind: number; spirituality: number; pollution: number; gender: string; sequence: 1;
  acting: number; coreStats: SliceState['character']['coreStats']; mastery: Record<string, number>; completedSources: string[]; injuries: SliceInjury[]; injuryRisk: number;
}
export interface TimeWormPreparation {
  week: number; date: PublicGameDate; revision: number; runId: string; randomSeed: string; randomCursor: number; pricePaid: 0; actionsPaid: 1;
  lifeReflected: true; playerName: string; playerClubHeld: boolean; before: TimeWormEncounterBudget; after: TimeWormEncounterBudget;
  finance: TimeWormFinanceSnapshot; materialsBefore: TimeWormMaterials; materialsAfter: TimeWormMaterials;
}
export type TimeWormEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' } | { type: 'ENCOUNTER_POLICY'; policy: TimeWormPolicy };
export interface TimeWormEncounterJournal {
  command: TimeWormEncounterCommand; week: number; date: PublicGameDate; revision: number; randomCursor: number;
  before: TimeWormEncounterBudget; after: TimeWormEncounterBudget; finance: TimeWormFinanceSnapshot; sceneBefore: TimeWormScene; sceneAfter: TimeWormScene; materialsBefore: TimeWormMaterials; materialsAfter: TimeWormMaterials;
}
export interface TimeWormEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: TimeWormCombatBody['enemyStatus']; exitMetres: 0 | 4; exitSeconds: 0 | 4;
}
export interface TimeWormEncounterState extends TimeWormCombatBody {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof TIME_WORM_TARGET_ID; policy: TimeWormPolicy;
  preparation: TimeWormPreparation | null; purchases: never[]; attemptWeek: number | null; startHistoryIndex: number | null; startSource: TimeWormCombatSource | null;
  originalHistory: SliceCombatRound[] | null; originalResources: string | null; scene: TimeWormScene; materials: TimeWormMaterials; journal: TimeWormEncounterJournal[]; terminal: TimeWormEncounterTerminal | null;
}
export function createTimeWormEncounterState(): TimeWormEncounterState {
  return { ...initialTimeWormBody(), status: 'AVAILABLE', targetId: TIME_WORM_TARGET_ID, policy: 'INHERITED_ONLY', preparation: null, purchases: [], attemptWeek: null, startHistoryIndex: null,
    startSource: null, originalHistory: null, originalResources: null, scene: createTimeWormScene(), materials: createTimeWormMaterials(), journal: [], terminal: null };
}
export const createTimeWormEncounter = createTimeWormEncounterState;
export const isTimeWormEncounterStage = (s: SliceState) => s.progression.pathwayId === 'error' && s.progression.sequence === 1;
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
export function timeWormFinanceSnapshot(s: TimeWormFinanceSnapshot): TimeWormFinanceSnapshot {
  return { weeklyBudget: s.weeklyBudget, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: structuredClone(s.debts), missedWeeks: s.missedWeeks, credit: s.credit };
}
export function validateTimeWormFinanceSnapshot(v: TimeWormFinanceSnapshot, week: number): boolean {
  return shape(v, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit']) && integer(v.weeklyBudget, 1, 100) && Object.hasOwn(SLICE_LIFE, v.lifeTier) && Object.hasOwn(SLICE_LIFE, v.nextLifeTier) &&
    integer(v.missedWeeks) && ['NORMAL', 'NOTICE', 'SUSPENDED'].includes(v.credit) && Array.isArray(v.debts) && v.debts.every(d => shape(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek']) &&
      typeof d.id === 'string' && !!d.id && typeof d.source === 'string' && !!d.source && integer(d.remaining) && integer(d.weeklyPayment, 1) && integer(d.createdWeek, 0, week));
}
export function timeWormEncounterBudget(s: SliceState): TimeWormEncounterBudget {
  return { cash: s.cash, actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution, gender: s.character.gender,
    sequence: 1, acting: s.progression.acting, coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources], injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function validBudget(v: TimeWormEncounterBudget, revision: number): boolean {
  return shape(v, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) && integer(v.cash) &&
    integer(v.actions, 0, 100) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.pollution, 0, 100) && typeof v.gender === 'string' && v.sequence === 1 && integer(v.acting, 0, 100) &&
    shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) && Object.values(v.coreStats).every(n => integer(n, 0, 500)) && !!v.mastery && typeof v.mastery === 'object' && !Array.isArray(v.mastery) && Object.values(v.mastery).every(n => integer(n, 0, 500)) &&
    Array.isArray(v.completedSources) && v.completedSources.every(x => typeof x === 'string' && !!x) && new Set(v.completedSources).size === v.completedSources.length && validTimeWormInjuries(v.injuries, revision) && integer(v.injuryRisk);
}
export function validTimeWormMaterials(v: TimeWormMaterials): boolean {
  try { const initial=createTimeWormMaterials(),w=v.weapon;
    return shape(v,['weapon','marks'])&&shape(w,Object.keys(initial.weapon))&&['HAND','YARD'].includes(w.location)&&same({...w,location:'HAND'},initial.weapon)&&
      Array.isArray(v.marks)&&v.marks.length===3&&v.marks.every((m,i)=>shape(m,['id','owner','status','usedRound'])&&m.id===initial.marks[i]!.id&&m.owner===TIME_WORM_TARGET_ID&&(m.status==='HELD'?m.usedRound===null:m.status==='SPENT'&&integer(m.usedRound,1)));
  }catch{return false;}
}
function arrivalMaterials(before: TimeWormMaterials): TimeWormMaterials { return structuredClone(before); }
export function validateTimeWormPreparation(v: unknown): v is TimeWormPreparation {
  try { const p=v as TimeWormPreparation; return shape(p,['week','date','revision','runId','randomSeed','randomCursor','pricePaid','actionsPaid','lifeReflected','playerName','playerClubHeld','before','after','finance','materialsBefore','materialsAfter']) &&
    integer(p.week,1)&&isValidGameDate(p.date)&&integer(p.revision,1)&&typeof p.runId==='string'&&!!p.runId&&typeof p.randomSeed==='string'&&!!p.randomSeed&&integer(p.randomCursor)&&typeof p.playerClubHeld==='boolean'&&typeof p.playerName==='string'&&!!p.playerName.trim()&&p.pricePaid===0&&p.actionsPaid===1&&p.lifeReflected===true&&
    validBudget(p.before,p.revision)&&validBudget(p.after,p.revision)&&validateTimeWormFinanceSnapshot(p.finance,p.week)&&p.before.actions>=1&&p.before.actions<=Math.max(4,p.finance.weeklyBudget)&&same(p.after,{...p.before,actions:p.before.actions-1})&&
    validTimeWormMaterials(p.materialsBefore)&&validTimeWormMaterials(p.materialsAfter)&&same(p.materialsAfter,arrivalMaterials(p.materialsBefore));
  }catch{return false;}
}
export function validTimeWormScene(p: TimeWormScene): boolean {
  const initial=createTimeWormScene();
  return shape(p,Object.keys(initial)) && same({...p,playerLocation:'OUTSIDE',playerCoordinate:0,enemyCoordinate:6,visibleBodyLine:true,conditionVersion:1,observedConditionVersion:null,observedSourceId:null,observationWeek:null,clockSeconds:0,externalSeconds:0,playerTravelMetres:0,enemyTravelMetres:0,knownPlayerName:null,knownEnemyName:null},initial) &&
    typeof p.visibleBodyLine==='boolean' && integer(p.conditionVersion,1) && (p.observedConditionVersion===null||integer(p.observedConditionVersion,1,p.conditionVersion)) &&
    (p.playerLocation==='OUTSIDE'&&p.playerCoordinate===0||p.playerLocation==='YARD'&&p.playerCoordinate===4) && integer(p.clockSeconds) && p.externalSeconds===p.clockSeconds && integer(p.playerTravelMetres) && integer(p.enemyTravelMetres) && [6,7].includes(p.enemyCoordinate) &&
    (p.observedSourceId===null?p.observationWeek===null&&p.knownPlayerName===null&&p.knownEnemyName===null:typeof p.observedSourceId==='string'&&integer(p.observationWeek,1)&&typeof p.knownPlayerName==='string'&&!!p.knownPlayerName.trim()&&p.knownEnemyName==='艾德里安·凯斯');
}
function protectedOriginals(s:SliceState):string {
 return stableStringify({marauder:s.marauder,swindler:s.swindler,cryptologist:s.cryptologist,fireThief:s.fireThief,dreamStealer:s.dreamStealer,parasite:s.parasite,deceitMentor:s.deceitMentor,fateTrojan:s.fateTrojan,town:s.town,life:s.timeWorm.life});
}
function adultsAbsent(s:SliceState):boolean {
 const life=s.timeWorm.life,site=s.fateTrojan.life.site;
 return !hasTimeWormLifeLock(s)&&life.reflected&&life.pending===null&&life.activeCase===null&&Object.values(life.cases).every(c=>c.status==='RESOLVED')&&site.playerLocation==='OUTSIDE'&&site.lina.location==='OUTSIDE'&&site.victor.location==='OUTSIDE'&&site.parcel.location==='OUTSIDE'&&!site.cabinet.open&&site.cabinet.recognitionHolder==='OWNER'&&site.link.holder==='OWNER'&&!site.link.returnPending&&site.link.windowExpiresAt===null&&site.fate.status==='COMPLETED'&&site.fate.escrowPennies===0&&site.fate.paidToPlayer===12&&site.seals.every(seal=>seal.ownerId==='FT2-LINA'&&seal.location==='DESK');
}
function historyUnchanged(s: SliceState): boolean {const e=s.timeWorm.encounter;return Array.isArray(e.originalHistory)&&same(e.originalHistory,s.combatHistory.slice(0,e.originalHistory.length));}
function originalsUnchanged(s: SliceState): boolean {return s.timeWorm.encounter.originalResources===protectedOriginals(s)&&historyUnchanged(s);}
export function validateTimeWormEncounterCommand(v:unknown):v is TimeWormEncounterCommand {if(!v||typeof v!=='object'||Array.isArray(v))return false;const c=v as TimeWormEncounterCommand;return c.type==='ENCOUNTER_POLICY'?shape(c,['type','policy'])&&['INHERITED_ONLY','SHORT_TIME_THEFT','TIME_RELEASE','ALL','ORDINARY'].includes(c.policy):shape(c,['type'])&&['ENCOUNTER_TALK','ENCOUNTER_FIGHT','LEAVE_ENCOUNTER'].includes(c.type);}
export const isTimeWormEncounterCommand=validateTimeWormEncounterCommand;
export const hasTimeWormEncounterLock=(s:SliceState):boolean=>['READY','FIGHTING'].includes(s.timeWorm.encounter.status);
export const isInsideTimeWormEncounter=hasTimeWormEncounterLock;
export function blockTimeWormEncounter(s:SliceState,c:TimeWormEncounterCommand):string|null {
  if(!validateTimeWormEncounterCommand(c))return'遭遇命令无效。';const e=s.timeWorm.encounter;
  if(!isTimeWormEncounterStage(s)||s.timeWorm.promotionWeek===null||s.status!=='ACTIVE'||s.health<=0)return'须本人仍活着并完成时之虫晋升。';
  if(s.combat)return'先处理当前真实战斗。';if(!adultsAbsent(s))return'先收束三项生活实践并归还原物；本人、莉娜和维克托都须实际离开原登记室，柜门关闭、原识别已归还、搬运已结清。';if(s.world.city!=='BACKLUND')return'须实际在贝克兰德前庭。';
  if(c.type==='LEAVE_ENCOUNTER')return e.status==='READY'&&originalsUnchanged(s)?null:'须已亲自到场，才能普通离开。';
  if(s.activeEvent||s.eventQueue.length||s.pulse!=='NONE')return'先处理当前事件或周账。';if(s.mind<=0)return'需要清醒；到场后仍可普通退出。';
  if(c.type==='ENCOUNTER_TALK')return e.status!=='AVAILABLE'||e.preparation?'同一艾德里安的争议不能重置。':s.actionsRemaining<1?'到场需1行动；行动用尽仍可普通离开。':null;
  if(e.status!=='READY'||!e.preparation||!originalsUnchanged(s))return'须先亲自交谈并保留同一原人原物和旧记录。';
  if(c.type==='ENCOUNTER_POLICY')return c.policy===e.policy&&e.journal.some(j=>j.command.type==='ENCOUNTER_POLICY')?'已经采用这项策略。':null;
  if(!e.journal.some(j=>j.command.type==='ENCOUNTER_POLICY'))return'先明确选择本场策略；开战后不能更换。';return s.actionsRemaining<1?'开战需要1行动；和平离开不花行动。':null;
}
export const timeWormEncounterReason=blockTimeWormEncounter;
export function leaveTimeWormCombatScene(p:TimeWormScene):void {if(p.playerLocation!=='YARD'||p.playerCoordinate!==4)throw new Error('须从实际所在前庭离开。');p.playerLocation='OUTSIDE';p.playerCoordinate=0;p.playerTravelMetres+=4;p.clockSeconds+=4;p.externalSeconds+=4;}
function arrive(s:SliceState,p:TimeWormPreparation):TimeWormScene{return{...createTimeWormScene(),playerLocation:'YARD',playerCoordinate:4,observedSourceId:`${s.runId}:TW1-YARD:${p.revision}`,observationWeek:p.week,observedConditionVersion:1,clockSeconds:4,externalSeconds:4,playerTravelMetres:4,knownPlayerName:p.playerName,knownEnemyName:'艾德里安·凯斯'};}
export function applyTimeWormEncounterCommand(s:SliceState,c:TimeWormEncounterCommand,ctx:SeerContext):void {
  const reason=blockTimeWormEncounter(s,c);if(reason)throw new Error(reason);const e=s.timeWorm.encounter;
  if(c.type==='ENCOUNTER_TALK'){
    const before=timeWormEncounterBudget(s),materialsBefore=structuredClone(e.materials);s.actionsRemaining--;e.materials=arrivalMaterials(e.materials);
    e.preparation={week:s.week,date:{...s.date},revision:s.revision+1,runId:s.runId,randomSeed:s.random.seed,randomCursor:s.random.cursor,pricePaid:0,actionsPaid:1,lifeReflected:true,playerName:s.character.name,playerClubHeld:s.town.clubLocation==='HAND',before,after:timeWormEncounterBudget(s),finance:timeWormFinanceSnapshot(s),materialsBefore,materialsAfter:structuredClone(e.materials)};
    e.originalHistory=structuredClone(s.combatHistory);e.originalResources=protectedOriginals(s);e.scene=arrive(s,e.preparation);e.status='READY';
    ctx.note('走到前庭与艾德里安交谈',`实付1行动，步行4米4秒，并看清脚边一米的侧步位置。你介绍姓名“${s.character.name}”，45岁的艾德里安·凯斯也报出姓名。他持自己的唯一原棍与三枚有限印记，身体100、精神100、灵性120。莉娜与维克托已经实际离开原登记室；伊莱亚斯仍活着，托马斯自主，所有旧人物保持原状。`);return;
  }
  const entry:TimeWormEncounterJournal={command:structuredClone(c),week:s.week,date:{...s.date},revision:s.revision+1,randomCursor:s.random.cursor,before:timeWormEncounterBudget(s),after:timeWormEncounterBudget(s),finance:timeWormFinanceSnapshot(s),sceneBefore:structuredClone(e.scene),sceneAfter:structuredClone(e.scene),materialsBefore:structuredClone(e.materials),materialsAfter:structuredClone(e.materials)};
  if(c.type==='ENCOUNTER_POLICY'){e.policy=c.policy;ctx.note('选择时之虫交战策略',c.policy==='ORDINARY'?'本场只作普通动作；不施放抽到的能力。':c.policy==='INHERITED_ONLY'?'本场只允许已学能力；两项新能力回到普通防备。':'仅在所选能力抽到、实际对象与资源齐备时尝试。每轮各一次，失败照付，空窗口没有掌握奖励。');}
  else if(c.type==='LEAVE_ENCOUNTER'){leaveTimeWormCombatScene(e.scene);e.status='RESOLVED';ctx.note('沿普通路和平离开前庭','沿开放出口实际走4米4秒，同一原包仍在原登记室外。没有战斗或奖励，艾德里安与自己的棍和剩余印记留在前庭。');}
  else{s.actionsRemaining--;e.status='FIGHTING';e.attemptWeek=s.week;e.startHistoryIndex=s.combatHistory.length;s.combat={encounterId:'TIME_WORM_DISPUTE',round:1,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemyInjuries:structuredClone(e.enemyInjuries),enemyRisk:e.enemyRisk,enemyStatus:'RESISTING',lastRound:null};ctx.note('选择与艾德里安交战','实付1行动。双方各自最多六次实际行动，精神压力与身体伤害各有实际来源。普通撤退、停止抵抗、伤势与真实死亡照常。');}
  entry.after=timeWormEncounterBudget(s);entry.sceneAfter=structuredClone(e.scene);entry.materialsAfter=structuredClone(e.materials);e.journal.push(entry);
  if(c.type==='ENCOUNTER_FIGHT'){const source=currentTimeWormCombatSource(s);if(!source)throw new Error('真实战斗来源不完整。');e.startSource={...source,revision:s.revision+1};}
}
export const applyTimeWormEncounter=applyTimeWormEncounterCommand;
export const handleTimeWormEncounter=applyTimeWormEncounterCommand;
export function startTimeWormEncounter(s:SliceState,ctx:SeerContext):void{applyTimeWormEncounterCommand(s,{type:'ENCOUNTER_FIGHT'},ctx);}
export function hasTimeWormDisputeOpponent(s:SliceState):boolean {
  const e=s.timeWorm?.encounter,c=s.combat;return isTimeWormEncounterStage(s)&&s.status==='ACTIVE'&&!s.activeEvent&&s.world.city==='BACKLUND'&&s.health>0&&s.mind>0&&s.timeWorm.promotionWeek!==null&&!!e&&e.status==='FIGHTING'&&e.targetId===TIME_WORM_TARGET_ID&&e.terminal===null&&e.preparation!==null&&e.materials.marks.filter(m=>m.status==='SPENT').length===e.powerUses.BODY_MARK+e.powerUses.MENTAL_MARK&&originalsUnchanged(s)&&e.attemptWeek===s.week&&adultsAbsent(s)&&
    validTimeWormScene(e.scene)&&e.scene.playerLocation==='YARD'&&e.scene.knownPlayerName===s.character.name&&validTimeWormMaterials(e.materials)&&validTimeWormBody(e)&&e.weaponLocation===e.materials.weapon.location&&c?.encounterId==='TIME_WORM_DISPUTE'&&c.enemyStatus==='RESISTING'&&c.enemyHealth>0&&c.enemyMind>0&&e.enemyStatus==='RESISTING'&&e.enemyHealth===c.enemyHealth&&e.enemyMind===c.enemyMind&&same(e.enemyInjuries,c.enemyInjuries)&&e.enemyRisk===c.enemyRisk&&integer(c.round,1)&&e.startHistoryIndex!==null&&integer(e.startHistoryIndex)&&s.combatHistory.length-e.startHistoryIndex===c.round-1;
}
function terminalScene(o:TimeWormRoundOutcome):{root:TimeWormScene;exit:0|4;materials:TimeWormMaterials}{const root=structuredClone(o.rootAfter),materials=structuredClone(o.materialsAfter),exit=o.playerHealthAfter>0?4:0;if(exit)leaveTimeWormCombatScene(root);return{root,exit,materials};}
export function settleTimeWormEncounter(s:SliceState,outcome:string,ctx:SeerContext,_award?:(source:string,amount:5|8|25)=>void):void {
  const e=s.timeWorm.encounter,c=s.combat;if(e.status!=='FIGHTING'||c?.encounterId!=='TIME_WORM_DISPUTE')throw new Error('没有这场前庭冲突。');if(outcome==='CONTINUE')return;const last=c.lastRound,o=last?.timeWormOutcome;
  if(!last||!o||!validateTimeWormCombatRound(last)||o.continuing||e.terminal||e.startHistoryIndex===null||c.round!==last.round+1||s.combatHistory.length-e.startHistoryIndex!==last.round||!originalsUnchanged(s)||!same(s.combatHistory.at(-1),last)||!same(combatBody(e),combatBody(o))||!same(o.rootAfter,e.scene)||!same(o.materialsAfter,e.materials)||o.playerHealthAfter!==s.health||o.playerMindAfter!==s.mind||o.playerSpiritualityAfter!==s.spirituality||!same(o.masteryAfter,s.progression.mastery)||!same(o.playerInjuriesAfter,s.injuries)||o.playerRiskAfter!==s.injuryRisk||o.enemyHealth!==c.enemyHealth||o.enemyMind!==c.enemyMind||!same(o.enemyInjuries,c.enemyInjuries)||o.enemyRisk!==c.enemyRisk||o.enemyStatus!==c.enemyStatus||outcome!==(o.playerHealthAfter===0?'PLAYER_DEAD':o.enemyHealth===0?'ENEMY_DEAD':o.enemyStatus==='SURRENDERED'?'ENEMY_SURRENDERED':'RETREATED'))throw new Error('结局与真实回合、原人原物和费用不一致。');
  const final=terminalScene(o);e.scene=final.root;e.materials=final.materials;e.terminal={outcome:outcome as TimeWormEncounterTerminal['outcome'],round:last.round,historyIndex:s.combatHistory.length-1,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,enemyStatus:e.enemyStatus,exitMetres:final.exit,exitSeconds:final.exit};e.status=outcome==='PLAYER_DEAD'?'LOST':outcome==='RETREATED'?'RETREATED':'RESOLVED';s.combat=null;
  ctx.note('艾德里安的前庭冲突结束',`${final.exit?'本人沿普通出口走4米4秒。':'本人的原身体真实死亡。'}双方原灵性、精神、伤势与棍落点、三枚印记的实际消耗保留，没有复活或补发。莉娜、维克托与旧人物保持原状。`);
}
export const finishTimeWormEncounter=settleTimeWormEncounter;
export function timeWormEncounterActions(s:SliceState){
  if(!isTimeWormEncounterStage(s))return[];
  const choices:{command:TimeWormEncounterCommand;label:string;cost:string}[]=[
    {command:{type:'ENCOUNTER_TALK'},label:s.timeWorm.encounter.scene.knownEnemyName?'到庭院与艾德里安交谈':'走近庭院中的独立对手',cost:'1行动、4米4秒；用尽行动仍可和平离开'},
    ...TIME_WORM_POLICIES.map(policy=>({command:{type:'ENCOUNTER_POLICY' as const,policy},label:({INHERITED_ONLY:'只用已学能力',SHORT_TIME_THEFT:'允许短时窃取',TIME_RELEASE:'先付费短窃，再尝试释放',ALL:'允许两项新能力',ORDINARY:'只作普通行动'})[policy],cost:'0行动；开战前明确选择'})),
    {command:{type:'ENCOUNTER_FIGHT'},label:'自主承担真实冲突',cost:'1行动；真实伤势与死亡风险'},
    {command:{type:'LEAVE_ENCOUNTER'},label:'沿普通路和平离开',cost:'0行动、4米4秒'}];
  return choices.map(({command,label,cost})=>{const reason=blockTimeWormEncounter(s,command);return{id:`TW1-${command.type}${command.type==='ENCOUNTER_POLICY'?'-'+command.policy:''}`,command,label,cost,enabled:reason===null,reason,cleanup:command.type==='LEAVE_ENCOUNTER'};});
}
export const TIME_WORM_ENCOUNTER_STORY='一名独立成人在净空庭院提出争议。本人、莉娜与维克托须先实际离开原登记室，原包与已结清义务保持原状。沿四米普通路到场，亲自交谈、明确策略后，再决定交战或和平离开。';
export function projectTimeWormEncounter(s:SliceState){const e=s.timeWorm.encounter,known=e.scene.knownEnemyName!==null;return{title:known?'艾德里安的庭院争议':'庭院中的独立对手',story:isTimeWormEncounterStage(s)?(known?'45岁的艾德里安·凯斯以独立身体与精神自主行动，持自己的唯一原棍和三枚有限印记。伊莱亚斯仍活着，托马斯自主。':TIME_WORM_ENCOUNTER_STORY):'',status:e.status,inside:hasTimeWormEncounterLock(s),policy:e.policy,policyConfirmed:e.journal.some(j=>j.command.type==='ENCOUNTER_POLICY'),scene:structuredClone(e.scene),materials:structuredClone(e.materials),
 enemy:{id:e.targetId,name:known?'艾德里安·凯斯':null,age:known?45:null,sequence:known?1:null,health:e.enemyHealth,mind:e.enemyMind,spirituality:e.enemySpirituality,status:e.enemyStatus,weaponLocation:e.weaponLocation,powerUses:{...e.powerUses}},actions:timeWormEncounterActions(s),facts:[
 '短时窃取每轮一次：8灵性2精神、感知18与30%抵抗；施放实际1秒后，同一尚未执行的目标动作推迟到3秒后。',
 '暂存时段释放每轮一次：6灵性2精神、意志18；只能消费本人实际未用的窃取时段。原3秒内下一次本人普通打击增加30；到期无效。',
 '目标延迟和本人储备分别记账。释放不取消已造成的目标延迟；没有额外行动或周行动，不撤销过去伤害。',
 '移位与遮挡销毁未用储备；普通侧步观察可恢复视线。失败仍付费；仅实际延迟并削弱未来攻击或实际使用打击辅助才增加掌握。',
 '三枚原印记共用有限库存，每次实耗7灵性与一枚；身体印记75走身体伤势，精神印记65走精神后果。用尽后使用原棍。',
 '旧深层欺瞒仍为6灵性、知识18、减势30；其余旧能力缺少本场原条件时只作普通行动，不窃取原棍或虚构寄生、身份、命运条件。',
 '体35%、感25%、意25%、知15%；双方1至6动作权重10/15/25/25/15/10，基础1250、底125、上限120，仅继续轮恢复12。',
 '每槽实际1秒，一轮实际60秒；精神耗尽仍活着停战，身体死亡终结本周目；生还普通步行4米4秒离场。']};}
export type TimeWormEncounterProjection=ReturnType<typeof projectTimeWormEncounter>;

/** Exact shared finance transition after a completed, unlocked action. Locked
 * READY/FIGHTING scenes never pay a bill or grant next-week actions early. */
export function timeWormCompletedBudgetMatches(s:SliceState,expected:TimeWormEncounterBudget,finance:TimeWormFinanceSnapshot,week:number,date:PublicGameDate,revision:number,randomCursor:number,anchorTitle:string):boolean {
 const current=timeWormEncounterBudget(s);
 if(!same({...current,cash:expected.cash,actions:expected.actions},expected)||s.random.cursor!==randomCursor)return false;
 const titles=['本周生活费','生活费如实记账','本周约定还款','账目结清','新的一周'];
 const receipts=s.chronicle.filter((entry,index)=>entry.id===`record-${s.revision}-${index}`&&titles.includes(entry.title));
 if(expected.actions>0||expected.health===0)return s.week===week&&same(s.date,date)&&s.actionsRemaining===expected.actions&&s.cash===expected.cash&&same(timeWormFinanceSnapshot(s),finance)&&s.pulse==='NONE'&&s.billAmount===0&&s.activeEvent===null&&s.eventQueue.length===0&&receipts.length===0;
 if(expected.actions!==0||s.status!=='ACTIVE')return false;
 const result=resolveSliceWeeklyFinance({...finance,cash:expected.cash,week,revision:revision-1,pulse:'BILL',billAmount:0}),advanced=result.eventId===null&&result.state.pulse==='ADVANCE';
 const finalFinance={...finance,...result.state,weeklyBudget:finance.weeklyBudget,lifeTier:advanced?result.state.nextLifeTier:finance.lifeTier};
 if(s.cash!==result.state.cash||!same(timeWormFinanceSnapshot(s),timeWormFinanceSnapshot(finalFinance))||s.week!==week+(advanced?1:0)||!same(s.date,advanced?addGameWeeks(date,1):date)||s.actionsRemaining!==(advanced?finance.weeklyBudget:0)||s.pulse!==(advanced?'NONE':result.state.pulse)||s.billAmount!==(advanced?0:result.state.billAmount))return false;
 const expectedReceipts=result.receipts.map(receipt=>({week,...receipt}));if(advanced)expectedReceipts.push({week:week+1,title:'新的一周',text:`日期推进7天，本周${finance.weeklyBudget}次行动。`});
 if(!same(receipts.map(({week,title,text})=>({week,title,text})),expectedReceipts))return false;
 if(result.eventId){const anchor=s.chronicle.findIndex((entry,index)=>entry.id===`record-${s.revision}-${index}`&&entry.title===anchorTitle),eventIndex=anchor+1+result.receipts.length;return anchor>=0&&s.eventQueue.length===0&&same(s.activeEvent,{id:result.eventId,instanceId:`${s.runId}:${result.eventId}:${s.revision}:${eventIndex}`});}
 return s.activeEvent===null&&s.eventQueue.length===0;
}
export function timeWormTerminalBudgetMatches(s:SliceState,_prep:TimeWormPreparation,o:TimeWormRoundOutcome):boolean {
 const fight=s.timeWorm.encounter.journal.find(j=>j.command.type==='ENCOUNTER_FIGHT');if(!fight)return false;
 const expected={...fight.after,health:o.playerHealthAfter,mind:o.playerMindAfter,spirituality:o.playerSpiritualityAfter,mastery:o.masteryAfter,injuries:o.playerInjuriesAfter,injuryRisk:o.playerRiskAfter};
 return same(s.timeWorm.encounter.scene,terminalScene(o).root)&&same(s.timeWorm.encounter.materials,terminalScene(o).materials)&&timeWormCompletedBudgetMatches(s,expected,fight.finance,fight.week,fight.date,o.source.revision+1,o.randomCursorAfter,'艾德里安的前庭冲突结束');
}
function peacefulBudgetMatches(s:SliceState,e:TimeWormEncounterJournal):boolean{return e.command.type==='LEAVE_ENCOUNTER'&&timeWormCompletedBudgetMatches(s,e.after,e.finance,e.week,e.date,e.revision,e.randomCursor,'沿普通路和平离开前庭');}
export function replayTimeWormPurchases(s:SliceState):TimeWormMaterials|null { return Array.isArray(s.timeWorm.encounter.purchases)&&s.timeWorm.encounter.purchases.length===0?createTimeWormMaterials():null; }
/** Exact root and source-chain replay. Historical rounds are immutable; a later
 * ordinary rest may change the live player but cannot alter a recorded fight. */
export function replayTimeWormEncounterRoot(s:SliceState):TimeWormScene|null {
 try{
  const e=s.timeWorm.encounter,initial=createTimeWormEncounterState(),allNew=s.combatHistory.flatMap((r,i)=>r.timeWormOutcome?[i]:[]),purchased=replayTimeWormPurchases(s);
  if(!e||!shape(e,Object.keys(initial))||!['AVAILABLE','READY','FIGHTING','RESOLVED','RETREATED','LOST'].includes(e.status)||e.targetId!==initial.targetId||!['INHERITED_ONLY','SHORT_TIME_THEFT','TIME_RELEASE','ALL','ORDINARY'].includes(e.policy)||!validTimeWormBody(e)||!validTimeWormScene(e.scene)||!validTimeWormMaterials(e.materials)||e.weaponLocation!==e.materials.weapon.location||!purchased)return null;
  if(!e.preparation)return same({...e,purchases:[],materials:createTimeWormMaterials()},initial)&&same(e.materials,purchased)&&allNew.length===0&&s.combat?.encounterId!=='TIME_WORM_DISPUTE'?createTimeWormScene():null;
  const prep=e.preparation;
  if(!isTimeWormEncounterStage(s)||s.timeWorm.promotionWeek===null||!s.timeWorm.life.reflected||!validateTimeWormPreparation(prep)||prep.runId!==s.runId||prep.playerName!==s.character.name||prep.randomSeed!==s.random.seed||prep.randomCursor>s.random.cursor||!integer(prep.week,s.timeWorm.promotionWeek,s.week)||compareGameDates(prep.date,s.date)>0||!integer(prep.revision,1,s.revision)||!historyUnchanged(s)||typeof e.originalResources!=='string'||!e.originalResources||!Array.isArray(e.journal)||!same(prep.materialsBefore,purchased))return null;
  let policyChosen=false,root=arrive(s,prep),status:TimeWormEncounterState['status']='READY',policy:TimeWormPolicy='INHERITED_ONLY',materials=structuredClone(prep.materialsAfter);
  let budget=prep.after,finance=prep.finance,week=prep.week,date=prep.date,revision=prep.revision;
  for(const entry of e.journal){
   if(!shape(entry,['command','week','date','revision','randomCursor','before','after','finance','sceneBefore','sceneAfter','materialsBefore','materialsAfter'])||!validateTimeWormEncounterCommand(entry.command)||!['ENCOUNTER_POLICY','ENCOUNTER_FIGHT','LEAVE_ENCOUNTER'].includes(entry.command.type)||!validBudget(entry.before,entry.revision)||!validBudget(entry.after,entry.revision)||!validateTimeWormFinanceSnapshot(entry.finance,entry.week)||!integer(entry.revision,revision+1,s.revision)||entry.randomCursor!==prep.randomCursor||!same(entry.sceneBefore,root)||!same(entry.materialsBefore,materials)||status!=='READY'||entry.week!==week||!same(entry.date,date)||!same(entry.before,budget)||!same(entry.finance,finance))return null;
   if(entry.command.type==='ENCOUNTER_POLICY'){if(policyChosen&&entry.command.policy===policy)return null;policy=entry.command.policy;policyChosen=true;}
   else if(entry.command.type==='ENCOUNTER_FIGHT'){if(!policyChosen||root.playerLocation!=='YARD'||entry.before.actions<1)return null;status='FIGHTING';}
   else{leaveTimeWormCombatScene(root);status='RESOLVED';}
   if(!same(entry.after,{...entry.before,actions:entry.before.actions-(entry.command.type==='ENCOUNTER_FIGHT'?1:0)})||!same(entry.sceneAfter,root)||!same(entry.materialsAfter,materials))return null;
   budget=entry.after;finance=entry.finance;week=entry.week;date=entry.date;revision=entry.revision;
  }
  if(e.policy!==policy)return null;
  if(status!=='FIGHTING'){
   if(e.status!==status||e.startHistoryIndex!==null||e.startSource!==null||e.attemptWeek!==null||e.terminal!==null||!same(combatBody(e),initialTimeWormBody())||!same(e.materials,materials)||allNew.length||s.combat?.encounterId==='TIME_WORM_DISPUTE')return null;
   if(status==='READY'||s.revision===revision){
    if(!originalsUnchanged(s)||!adultsAbsent(s))return null;
    if(status==='READY'){if(!same(timeWormEncounterBudget(s),budget)||!same(timeWormFinanceSnapshot(s),finance)||s.week!==week||!same(s.date,date)||s.random.cursor!==prep.randomCursor||s.pulse!=='NONE'||s.billAmount!==0||s.activeEvent||s.eventQueue.length)return null;}
    else if(!e.journal.at(-1)||!peacefulBudgetMatches(s,e.journal.at(-1)!))return null;
   }
   return root;
  }
  const start=e.startSource;
  if(!start||!validTimeWormCombatSource(start)||!integer(e.startHistoryIndex,0,s.combatHistory.length)||e.startHistoryIndex!==e.originalHistory!.length||e.attemptWeek!==week||start.round!==1||start.revision!==revision||start.week!==week||!same(start.date,date)||start.startHistoryIndex!==e.startHistoryIndex||start.runId!==s.runId||!same(start.preparation,prep)||start.policy!==policy||!same(start.body,initialTimeWormBody())||!same(start.root,root)||!same(start.materials,materials)||start.randomSeed!==s.random.seed||start.randomCursor!==prep.randomCursor||start.playerHealth!==budget.health||start.playerMind!==budget.mind||start.playerSpirituality!==budget.spirituality||!same(start.mastery,budget.mastery)||!same(start.playerInjuries,budget.injuries)||start.playerRisk!==budget.injuryRisk)return null;
  const terminal=e.terminal;
  if(terminal&&(!shape(terminal,['outcome','round','historyIndex','enemyHealth','enemyMind','enemySpirituality','enemyStatus','exitMetres','exitSeconds'])||!integer(terminal.historyIndex,e.startHistoryIndex,s.combatHistory.length-1)))return null;
  const end=terminal?terminal.historyIndex+1:s.combatHistory.length,rounds=s.combatHistory.slice(e.startHistoryIndex,end);
  if(!same(allNew,rounds.map((_r,i)=>e.startHistoryIndex!+i)))return null;
  for(const[i,round]of rounds.entries()){const o=round.timeWormOutcome,previous=rounds[i-1]?.timeWormOutcome;if(!o||!validateTimeWormCombatRound(round)||round.round!==i+1||o.source.revision>=s.revision||o.randomCursorAfter>s.random.cursor||!same(o.source,previous?nextTimeWormCombatSource(previous):start)||!same(o.source.root,root)||i<rounds.length-1&&!o.continuing)return null;root=structuredClone(o.rootAfter);materials=structuredClone(o.materialsAfter);}
  const last=rounds.at(-1),o=last?.timeWormOutcome;
  if(e.status==='FIGHTING'){
   if(terminal||!hasTimeWormDisputeOpponent(s)||!same(combatBody(e),o?combatBody(o):start.body)||!same(e.materials,materials))return null;
   const current=timeWormEncounterBudget(s),expected={...budget,health:o?.playerHealthAfter??start.playerHealth,mind:o?.playerMindAfter??start.playerMind,spirituality:o?Math.min(120,o.playerSpiritualityAfter+12):start.playerSpirituality,mastery:o?.masteryAfter??start.mastery,injuries:o?.playerInjuriesAfter??start.playerInjuries,injuryRisk:o?.playerRiskAfter??start.playerRisk};
   if(!same(current,expected)||!same(timeWormFinanceSnapshot(s),finance)||s.week!==week||!same(s.date,date)||s.pulse!=='NONE'||s.billAmount!==0||s.activeEvent!==null||s.eventQueue.length)return null;
   return o?o.continuing&&same(last,s.combat!.lastRound)&&same(currentTimeWormCombatSource(s),nextTimeWormCombatSource(o))?root:null:s.combat!.lastRound===null&&same(currentTimeWormCombatSource(s),start)?root:null;
  }
  if(s.combat?.encounterId==='TIME_WORM_DISPUTE'||!terminal||!last||!o||o.continuing||terminal.round!==last.round||rounds.length!==terminal.round||!same(combatBody(e),combatBody(o))||terminal.enemyHealth!==e.enemyHealth||terminal.enemyMind!==e.enemyMind||terminal.enemySpirituality!==e.enemySpirituality||terminal.enemyStatus!==e.enemyStatus)return null;
  const final=terminalScene(o);if(terminal.exitMetres!==final.exit||terminal.exitSeconds!==final.exit||!same(e.materials,final.materials))return null;
  if(s.revision===o.source.revision+1&&(!originalsUnchanged(s)||!timeWormTerminalBudgetMatches(s,prep,o)))return null;
  if(terminal.outcome==='PLAYER_DEAD')return e.status==='LOST'&&s.status==='DEAD'&&o.playerHealthAfter===0?final.root:null;
  if(terminal.outcome==='RETREATED')return e.status==='RETREATED'&&o.playerHealthAfter>0&&(last.retreat==='SUCCESS'||o.playerMindAfter===0)?final.root:null;
  return e.status==='RESOLVED'&&o.playerHealthAfter>0&&(terminal.outcome==='ENEMY_DEAD'?e.enemyStatus==='DEAD':terminal.outcome==='ENEMY_SURRENDERED'&&e.enemyStatus==='SURRENDERED')?final.root:null;
 }catch{return null;}
}
export function validateTimeWormEncounter(s:SliceState):boolean {try{const root=replayTimeWormEncounterRoot(s);return root!==null&&same(root,s.timeWorm.encounter.scene);}catch{return false;}}
export const validateTimeWormEncounterState=validateTimeWormEncounter;
/** Combat remains in the physically separate forecourt. No old Error identity, fate,
 * parcel, seal, host, or original room inventory is changed by this encounter. */
export function timeWormEncounterOriginalEvents(_s:SliceState):{revision:number;week:number;before:{site:SliceState['fateTrojan']['life']['site']};after:{site:SliceState['fateTrojan']['life']['site']}}[]{return [];}
