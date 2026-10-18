import { SLICE_LIFE } from '../../content/slice-events.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { addGameWeeks, compareGameDates, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceCombatRound, SliceInjury, SliceState } from '../slice/types.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { hasPaleEmperorLifeLock } from './life.js';
import { createFerrymanEraState, type FerrymanEraState } from '../ferryman/era.js';
import { currentPaleEmperorCombatSource, nextPaleEmperorCombatSource, validPaleEmperorCombatSource, validatePaleEmperorCombatRound,
  validPaleEmperorBody, validPaleEmperorInjuries, type PaleEmperorCombatSource, type PaleEmperorRoundOutcome } from './combat.js';

export const PALE_EMPEROR_TARGET_ID = 'PE1-ALDEN-WARD' as const;
export const PALE_EMPEROR_SITE = 'PE1-FORECOURT' as const;
export const PALE_EMPEROR_POWER_IDS = ['PALE_STRIKE', 'STEADY', 'SPIRIT_PRESSURE', 'CLOSE_SCREEN'] as const;
export type PaleEmperorPowerId = typeof PALE_EMPEROR_POWER_IDS[number];
export type PaleEmperorEnemyIntent = PaleEmperorPowerId | 'BODY_STRIKE' | 'OBSERVE' | 'ACCIDENT';
export type PaleEmperorPolicy = 'INHERITED_ONLY' | 'RESIDUAL_QUIETING' | 'SPIRITUAL_INTERDICTION' | 'ALL' | 'ORDINARY';
export type PaleEmperorCombatPolicy = PaleEmperorPolicy;
export const PALE_EMPEROR_POLICIES: readonly PaleEmperorPolicy[] = ['INHERITED_ONLY','RESIDUAL_QUIETING','SPIRITUAL_INTERDICTION','ALL','ORDINARY'];
export const PALE_EMPEROR_POWERS = [
  { id: 'PALE_STRIKE', label: '原灵印有限苍白冲击', cost: 7, selfGain: 105, enemyReduction: 0 },
  { id: 'SPIRIT_PRESSURE', label: '有限灵性压力', cost: 7, selfGain: 65, enemyReduction: 0 },
  { id: 'STEADY', label: '有限定神', cost: 6, selfGain: 0, enemyReduction: 32 },
  { id: 'CLOSE_SCREEN', label: '关闭自己的原遮屏', cost: 3, selfGain: 0, enemyReduction: 0 },
] as const;
export interface PaleEmperorMaterials {
  weapon: { id: 'PE1-ALDEN-CLUB'; sourceId: 'PE1-ALDEN-OWNED-CLUB-1'; owner: typeof PALE_EMPEROR_TARGET_ID;
    massKg: 2; location: 'HAND' | 'FORECOURT'; condition: 100; visible: true };
  marks: { id:'PE1-ALDEN-MARKS'; sourceId:'PE1-ALDEN-OWNED-MARKS-1'; owner:typeof PALE_EMPEROR_TARGET_ID;
    capacity:3; remaining:number; pieces:{id:string;state:'READY'|'SPENT'}[] };
  screen: {id:'PE1-ALDEN-SCREEN';sourceId:'PE1-ALDEN-OWNED-SCREEN-1';owner:typeof PALE_EMPEROR_TARGET_ID;coordinate:5;hood:'OPEN'|'CLOSED';durability:100;operations:number};
  door: {id:'PE1-FORECOURT-DOOR';sourceId:'PE1-FORECOURT-ORIGINAL-DOOR';state:'OPEN';operations:0};
}
export function createPaleEmperorMaterials(): PaleEmperorMaterials {
  return { weapon: { id: 'PE1-ALDEN-CLUB', sourceId: 'PE1-ALDEN-OWNED-CLUB-1', owner: PALE_EMPEROR_TARGET_ID,
    massKg: 2, location: 'HAND', condition: 100, visible: true },
    marks:{id:'PE1-ALDEN-MARKS',sourceId:'PE1-ALDEN-OWNED-MARKS-1',owner:PALE_EMPEROR_TARGET_ID,capacity:3,remaining:3,pieces:[1,2,3].map(n=>({id:`PE1-ALDEN-MARK-${n}`,state:'READY' as const}))},
    screen:{id:'PE1-ALDEN-SCREEN',sourceId:'PE1-ALDEN-OWNED-SCREEN-1',owner:PALE_EMPEROR_TARGET_ID,coordinate:5,hood:'OPEN',durability:100,operations:0},
    door:{id:'PE1-FORECOURT-DOOR',sourceId:'PE1-FORECOURT-ORIGINAL-DOOR',state:'OPEN',operations:0} };
}
export interface PaleEmperorScene {
  siteId: typeof PALE_EMPEROR_SITE; playerLocation: 'OUTSIDE' | 'FORECOURT'; playerCoordinate: 0 | 4; enemyCoordinate: 6;
  ordinaryExit: 'OPEN'; visibleBodyLine: boolean; conditionVersion: number; observedConditionVersion: number | null;
  thirdPartiesInArea: 0; presentMemberIds: string[]; observedSourceId: string | null; observationWeek: number | null;
  clockSeconds: number; externalSeconds: number; playerTravelMetres: number; roadTravelMetres:number; forecourtTravelMetres:number; knownPlayerName: string | null; knownEnemyName: string | null;
}
export function createPaleEmperorScene(): PaleEmperorScene {
  return { siteId: PALE_EMPEROR_SITE, playerLocation: 'OUTSIDE', playerCoordinate: 0, enemyCoordinate: 6,
    ordinaryExit: 'OPEN', visibleBodyLine: true, conditionVersion: 1, observedConditionVersion: null,
    thirdPartiesInArea: 0, presentMemberIds: [], observedSourceId: null, observationWeek: null,
    clockSeconds: 0, externalSeconds: 0, playerTravelMetres: 0, roadTravelMetres:0, forecourtTravelMetres:0, knownPlayerName: null, knownEnemyName: null };
}
export interface PaleEmperorObservation { power: 'PALE_STRIKE' | 'SPIRIT_PRESSURE'; conditionVersion: number; round: number; order: number; atSeconds: number; paidCost: 7 }
export interface PaleEmperorCombatBody {
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  weaponLocation: 'HAND' | 'FORECOURT'; powerUses: Record<PaleEmperorPowerId, number>; observations: PaleEmperorObservation[];
  inheritedApplications: Record<string,number>; screenReveals:number; totalOwnerMindSpent: number; residualQuietingAttempts: number; residualQuietingChecks: number; residualQuietingSuccesses: number;
  spiritualInterdictionAttempts: number; spiritualInterdictionChecks: number; spiritualInterdictionSuccesses: number;
}
export function initialPaleEmperorBody(): PaleEmperorCombatBody {
  return { enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0, weaponLocation: 'HAND',
    powerUses: { PALE_STRIKE: 0, STEADY: 0, SPIRIT_PRESSURE: 0, CLOSE_SCREEN: 0 }, observations: [], inheritedApplications:{},screenReveals:0,totalOwnerMindSpent: 0,
    residualQuietingAttempts: 0, residualQuietingChecks: 0, residualQuietingSuccesses: 0, spiritualInterdictionAttempts: 0, spiritualInterdictionChecks: 0, spiritualInterdictionSuccesses: 0 };
}
export function combatBody(e: PaleEmperorCombatBody): PaleEmperorCombatBody {
  return Object.fromEntries(Object.keys(initialPaleEmperorBody()).map(k => [k, structuredClone(e[k as keyof PaleEmperorCombatBody])])) as unknown as PaleEmperorCombatBody;
}
export type PaleEmperorFinanceSnapshot = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'> & { sourceEra:'ORIGINAL'|'POST_CYCLE'; era:FerrymanEraState };
export interface PaleEmperorEncounterBudget {
  cash: number; actions: number; health: number; mind: number; spirituality: number; pollution: number; gender: string; sequence: 1;
  acting: number; coreStats: SliceState['character']['coreStats']; mastery: Record<string, number>; completedSources: string[]; injuries: SliceInjury[]; injuryRisk: number;
}
export interface PaleEmperorPreparation {
  week: number; date: PublicGameDate; revision: number; runId: string; randomSeed: string; randomCursor: number; pricePaid: 0; actionsPaid: 1;
  lifeReflected: true; playerName: string; playerClubHeld: boolean; before: PaleEmperorEncounterBudget; after: PaleEmperorEncounterBudget;
  finance: PaleEmperorFinanceSnapshot; materialsBefore: PaleEmperorMaterials; materialsAfter: PaleEmperorMaterials;
}
export type PaleEmperorEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' } | { type: 'ENCOUNTER_POLICY'; policy: PaleEmperorPolicy };
export interface PaleEmperorEncounterJournal {
  command: PaleEmperorEncounterCommand; week: number; date: PublicGameDate; revision: number; randomCursor: number;
  before: PaleEmperorEncounterBudget; after: PaleEmperorEncounterBudget; finance: PaleEmperorFinanceSnapshot; sceneBefore: PaleEmperorScene; sceneAfter: PaleEmperorScene; materialsBefore: PaleEmperorMaterials; materialsAfter: PaleEmperorMaterials;
}
export interface PaleEmperorEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: PaleEmperorCombatBody['enemyStatus']; exitMetres: 0 | 4; exitSeconds: 0 | 4; roadExitMetres:0|12; roadExitSeconds:0|12;
}
export interface PaleEmperorEncounterState extends PaleEmperorCombatBody {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof PALE_EMPEROR_TARGET_ID; policy: PaleEmperorPolicy;
  preparation: PaleEmperorPreparation | null; purchases: never[]; attemptWeek: number | null; startHistoryIndex: number | null; startSource: PaleEmperorCombatSource | null;
  originalHistory: SliceCombatRound[] | null; originalResources: string | null; scene: PaleEmperorScene; materials: PaleEmperorMaterials; journal: PaleEmperorEncounterJournal[]; terminal: PaleEmperorEncounterTerminal | null;
}
export function createPaleEmperorEncounterState(): PaleEmperorEncounterState {
  return { ...initialPaleEmperorBody(), status: 'AVAILABLE', targetId: PALE_EMPEROR_TARGET_ID, policy: 'INHERITED_ONLY', preparation: null, purchases: [], attemptWeek: null, startHistoryIndex: null,
    startSource: null, originalHistory: null, originalResources: null, scene: createPaleEmperorScene(), materials: createPaleEmperorMaterials(), journal: [], terminal: null };
}
export const createPaleEmperorEncounter = createPaleEmperorEncounterState;
export const isPaleEmperorEncounterStage = (s: SliceState) => s.progression.pathwayId === 'death' && s.progression.sequence === 1;
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
export function paleEmperorFinanceSnapshot(s: PaleEmperorFinanceSnapshot | SliceState): PaleEmperorFinanceSnapshot {
  const sourceEra='sourceEra' in s?s.sourceEra:s.paleEmperor.sourceEra??'ORIGINAL',era='era' in s?s.era:s.ferryman.era;
  return { weeklyBudget: s.weeklyBudget, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: structuredClone(s.debts), missedWeeks: s.missedWeeks, credit: s.credit, sourceEra, era:structuredClone(era) };
}
function validEraSnapshot(e:FerrymanEraState):boolean{return shape(e,Object.keys(createFerrymanEraState()))&&['OUTSIDE','RECEPTION'].includes(e.location)&&typeof e.emergencyWorkUsed==='boolean'&&['elapsedSeconds','travelledMetres','works','rests','weeksAdvanced','income','expenses','emergencyWorks','treatments'].every(k=>integer(e[k as 'works']))&&e.elapsedSeconds===e.travelledMetres&&e.travelledMetres%12===0&&e.income===e.works*24&&e.expenses===e.rests*8+e.weeksAdvanced*24+e.treatments*60&&e.emergencyWorks<=e.works;}
function validFinance(v: PaleEmperorFinanceSnapshot, week: number): boolean {
  return shape(v, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit', 'sourceEra', 'era']) && ['ORIGINAL','POST_CYCLE'].includes(v.sourceEra) && validEraSnapshot(v.era) && integer(v.weeklyBudget, 1, 100) && Object.hasOwn(SLICE_LIFE, v.lifeTier) && Object.hasOwn(SLICE_LIFE, v.nextLifeTier) &&
    integer(v.missedWeeks) && ['NORMAL', 'NOTICE', 'SUSPENDED'].includes(v.credit) && Array.isArray(v.debts) && v.debts.every(d => shape(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek']) &&
      typeof d.id === 'string' && !!d.id && typeof d.source === 'string' && !!d.source && integer(d.remaining) && integer(d.weeklyPayment, 1) && integer(d.createdWeek, 0, week));
}
export function paleEmperorEncounterBudget(s: SliceState): PaleEmperorEncounterBudget {
  return { cash: s.cash, actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution, gender: s.character.gender,
    sequence: 1, acting: s.progression.acting, coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources], injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function validBudget(v: PaleEmperorEncounterBudget, revision: number): boolean {
  return shape(v, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) && integer(v.cash) &&
    integer(v.actions, 0, 100) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.pollution, 0, 100) && typeof v.gender === 'string' && v.sequence === 1 && integer(v.acting, 0, 100) &&
    shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) && Object.values(v.coreStats).every(n => integer(n, 0, 500)) && !!v.mastery && typeof v.mastery === 'object' && !Array.isArray(v.mastery) && Object.values(v.mastery).every(n => integer(n, 0, 500)) &&
    Array.isArray(v.completedSources) && v.completedSources.every(x => typeof x === 'string' && !!x) && new Set(v.completedSources).size === v.completedSources.length && validPaleEmperorInjuries(v.injuries, revision) && integer(v.injuryRisk);
}
export function validPaleEmperorMaterials(v: PaleEmperorMaterials): boolean {
  try { const initial=createPaleEmperorMaterials(),w=v.weapon,m=v.marks;
    return shape(v,['weapon','marks','screen','door'])&&shape(w,Object.keys(initial.weapon))&&['HAND','FORECOURT'].includes(w.location)&&same({...w,location:'HAND'},initial.weapon)&&
      shape(m,Object.keys(initial.marks))&&integer(m.remaining,0,3)&&Array.isArray(m.pieces)&&m.pieces.length===3&&m.pieces.every((p,i)=>shape(p,['id','state'])&&p.id===`PE1-ALDEN-MARK-${i+1}`&&p.state===(i<3-m.remaining?'SPENT':'READY'))&&same({...m,remaining:3,pieces:initial.marks.pieces},initial.marks)&&
      shape(v.screen,Object.keys(initial.screen))&&['OPEN','CLOSED'].includes(v.screen.hood)&&integer(v.screen.operations)&&same({...v.screen,hood:'OPEN',operations:0},initial.screen)&&same(v.door,initial.door);
  }catch{return false;}
}
function arrivalMaterials(before: PaleEmperorMaterials): PaleEmperorMaterials { return structuredClone(before); }
export function validatePaleEmperorPreparation(v: unknown): v is PaleEmperorPreparation {
  try { const p=v as PaleEmperorPreparation; return shape(p,['week','date','revision','runId','randomSeed','randomCursor','pricePaid','actionsPaid','lifeReflected','playerName','playerClubHeld','before','after','finance','materialsBefore','materialsAfter']) &&
    integer(p.week,1)&&isValidGameDate(p.date)&&integer(p.revision,1)&&typeof p.runId==='string'&&!!p.runId&&typeof p.randomSeed==='string'&&!!p.randomSeed&&integer(p.randomCursor)&&typeof p.playerClubHeld==='boolean'&&typeof p.playerName==='string'&&!!p.playerName.trim()&&p.pricePaid===0&&p.actionsPaid===1&&p.lifeReflected===true&&
    validBudget(p.before,p.revision)&&validBudget(p.after,p.revision)&&validFinance(p.finance,p.week)&&(p.finance.sourceEra!=='POST_CYCLE'||!p.playerClubHeld&&p.finance.era.location==='RECEPTION')&&p.before.actions>=1&&p.before.actions<=Math.max(4,p.finance.weeklyBudget)&&same(p.after,{...p.before,actions:p.before.actions-1})&&
    validPaleEmperorMaterials(p.materialsBefore)&&validPaleEmperorMaterials(p.materialsAfter)&&same(p.materialsAfter,arrivalMaterials(p.materialsBefore));
  }catch{return false;}
}
export function validPaleEmperorScene(p: PaleEmperorScene): boolean {
  const initial=createPaleEmperorScene();
  return shape(p,Object.keys(initial)) && same({...p,playerLocation:'OUTSIDE',playerCoordinate:0,visibleBodyLine:true,conditionVersion:1,observedConditionVersion:null,observedSourceId:null,observationWeek:null,clockSeconds:0,externalSeconds:0,playerTravelMetres:0,roadTravelMetres:0,forecourtTravelMetres:0,knownPlayerName:null,knownEnemyName:null},initial) &&
    typeof p.visibleBodyLine==='boolean' && integer(p.conditionVersion,1) && (p.observedConditionVersion===null||integer(p.observedConditionVersion,1,p.conditionVersion)) &&
    (p.playerLocation==='OUTSIDE'&&p.playerCoordinate===0||p.playerLocation==='FORECOURT'&&p.playerCoordinate===4) && integer(p.clockSeconds) && p.externalSeconds===p.clockSeconds && integer(p.playerTravelMetres) && integer(p.roadTravelMetres)&&integer(p.forecourtTravelMetres)&&p.playerTravelMetres===p.roadTravelMetres+p.forecourtTravelMetres&&(p.playerLocation==='FORECOURT'?p.roadTravelMetres===12:[0,24].includes(p.roadTravelMetres)) &&
    (p.observedSourceId===null?p.observationWeek===null&&p.knownPlayerName===null&&p.knownEnemyName===null:typeof p.observedSourceId==='string'&&integer(p.observationWeek,1)&&typeof p.knownPlayerName==='string'&&!!p.knownPlayerName.trim()&&p.knownEnemyName==='阿尔登·沃德');
}
function protectedOriginals(s: SliceState): string {
  return stableStringify({corpsecollector:s.corpsecollector,gravedigger:s.gravedigger,spiritmedium:s.spiritmedium,spiritGuide:s.spiritGuide,gatekeeper:s.gatekeeper,undying:s.undying,ferryman:s.ferryman,deathConsul:s.deathConsul,longChapter:s.longChapter,town:s.town,life:s.paleEmperor.life});
}
function adultsAbsent(s: SliceState): boolean {
  const life=s.paleEmperor.life;
  return !hasPaleEmperorLifeLock(s)&&life.reflected&&life.playerLocation==='RECEPTION'&&life.nora!==null&&!life.nora.present&&life.nora.location==='AWAY';
}
/** The old town club is historical after the actual era handoff. */
export function paleEmperorPlayerClubHeld(s:SliceState):boolean{return s.paleEmperor.sourceEra!=='POST_CYCLE'&&s.town.clubLocation==='HAND';}
function historyUnchanged(s: SliceState): boolean {const e=s.paleEmperor.encounter;return Array.isArray(e.originalHistory)&&same(e.originalHistory,s.combatHistory.slice(0,e.originalHistory.length));}
function originalsUnchanged(s: SliceState): boolean {return s.paleEmperor.encounter.originalResources===protectedOriginals(s)&&historyUnchanged(s);}
export function validatePaleEmperorEncounterCommand(v:unknown):v is PaleEmperorEncounterCommand {if(!v||typeof v!=='object'||Array.isArray(v))return false;const c=v as PaleEmperorEncounterCommand;return c.type==='ENCOUNTER_POLICY'?shape(c,['type','policy'])&&['INHERITED_ONLY','RESIDUAL_QUIETING','SPIRITUAL_INTERDICTION','ALL','ORDINARY'].includes(c.policy):shape(c,['type'])&&['ENCOUNTER_TALK','ENCOUNTER_FIGHT','LEAVE_ENCOUNTER'].includes(c.type);}
export const isPaleEmperorEncounterCommand=validatePaleEmperorEncounterCommand;
export const hasPaleEmperorEncounterLock=(s:SliceState):boolean=>['READY','FIGHTING'].includes(s.paleEmperor.encounter.status);
export const isInsidePaleEmperorEncounter=hasPaleEmperorEncounterLock;
export function blockPaleEmperorEncounter(s:SliceState,c:PaleEmperorEncounterCommand):string|null {
  if(!validatePaleEmperorEncounterCommand(c))return'遭遇命令无效。';const e=s.paleEmperor.encounter;
  if(!isPaleEmperorEncounterStage(s)||s.paleEmperor.promotionWeek===null||s.status!=='ACTIVE'||s.health<=0)return'须本人仍活着并完成苍白皇帝晋升。';
  if(s.combat)return'先处理当前真实战斗。';if(s.paleEmperor.sourceEra==='POST_CYCLE'&&s.ferryman.era.location!=='RECEPTION')return'须先沿普通道路回到当代接待处。';if(!adultsAbsent(s))return'先收束三项附室实践、归还原器皿并实际走回接待处，让诺拉沿原路离开。';if(s.world.city!=='BACKLUND')return'须实际在贝克兰德附室外前庭。';
  if(c.type==='LEAVE_ENCOUNTER')return e.status==='READY'&&originalsUnchanged(s)?null:'须已亲自到场，才能普通离开。';
  if(s.activeEvent||s.eventQueue.length||s.pulse!=='NONE')return'先处理当前事件或周账。';if(s.mind<=0)return'需要清醒；到场后仍可普通退出。';
  if(c.type==='ENCOUNTER_TALK')return e.status!=='AVAILABLE'||e.preparation?'同一阿尔登的争议不能重置。':s.actionsRemaining<1?'到场需1行动；行动用尽仍可普通离开。':null;
  if(e.status!=='READY'||!e.preparation||!originalsUnchanged(s))return'须先亲自交谈并保留同一原人原物和旧记录。';
  if(c.type==='ENCOUNTER_POLICY')return c.policy===e.policy&&e.journal.some(j=>j.command.type==='ENCOUNTER_POLICY')?'已经采用这项策略。':null;
  if(!e.journal.some(j=>j.command.type==='ENCOUNTER_POLICY'))return'先明确选择本场策略；开战后不能更换。';return s.actionsRemaining<1?'开战需要1行动；和平离开不花行动。':null;
}
export const paleEmperorEncounterReason=blockPaleEmperorEncounter;
export function leavePaleEmperorCombatScene(p:PaleEmperorScene):void {if(p.playerLocation!=='FORECOURT'||p.playerCoordinate!==4)throw new Error('须从实际所在附室外前庭离开。');p.playerLocation='OUTSIDE';p.playerCoordinate=0;p.playerTravelMetres+=16;p.roadTravelMetres+=12;p.forecourtTravelMetres+=4;p.clockSeconds+=16;p.externalSeconds+=16;}
function arrive(s:SliceState,p:PaleEmperorPreparation):PaleEmperorScene{return{...createPaleEmperorScene(),playerLocation:'FORECOURT',playerCoordinate:4,observedSourceId:`${s.runId}:PE1-FORECOURT:${p.revision}`,observationWeek:p.week,observedConditionVersion:1,clockSeconds:16,externalSeconds:16,playerTravelMetres:16,roadTravelMetres:12,forecourtTravelMetres:4,knownPlayerName:p.playerName,knownEnemyName:'阿尔登·沃德'};}
export function applyPaleEmperorEncounterCommand(s:SliceState,c:PaleEmperorEncounterCommand,ctx:SeerContext):void {
  const reason=blockPaleEmperorEncounter(s,c);if(reason)throw new Error(reason);const e=s.paleEmperor.encounter;
  if(c.type==='ENCOUNTER_TALK'){
    const before=paleEmperorEncounterBudget(s),materialsBefore=structuredClone(e.materials);s.actionsRemaining--;e.materials=arrivalMaterials(e.materials);
    e.preparation={week:s.week,date:{...s.date},revision:s.revision+1,runId:s.runId,randomSeed:s.random.seed,randomCursor:s.random.cursor,pricePaid:0,actionsPaid:1,lifeReflected:true,playerName:s.character.name,playerClubHeld:paleEmperorPlayerClubHeld(s),before,after:paleEmperorEncounterBudget(s),finance:paleEmperorFinanceSnapshot(s),materialsBefore,materialsAfter:structuredClone(e.materials)};
    e.originalHistory=structuredClone(s.combatHistory);e.originalResources=protectedOriginals(s);e.scene=arrive(s,e.preparation);e.status='READY';
    ctx.note('走到附室外前庭与阿尔登交谈',`实付1行动，先走12米道路12秒，再走4米前庭4秒。你介绍姓名“${s.character.name}”，47岁的阿尔登·沃德也报出姓名。他持自己的唯一原棍，身体100、精神100、灵性120，另有三枚有编号的原灵印。诺拉和旧场人物均不在前庭；诺兰已撤离的旧交战、欧文的历史记录与原人原物保持原样。`);return;
  }
  const entry:PaleEmperorEncounterJournal={command:structuredClone(c),week:s.week,date:{...s.date},revision:s.revision+1,randomCursor:s.random.cursor,before:paleEmperorEncounterBudget(s),after:paleEmperorEncounterBudget(s),finance:paleEmperorFinanceSnapshot(s),sceneBefore:structuredClone(e.scene),sceneAfter:structuredClone(e.scene),materialsBefore:structuredClone(e.materials),materialsAfter:structuredClone(e.materials)};
  if(c.type==='ENCOUNTER_POLICY'){e.policy=c.policy;ctx.note('选择苍白皇帝交战策略',c.policy==='ORDINARY'?'本场只作普通动作；不施放抽到的能力。':c.policy==='INHERITED_ONLY'?'本场只允许已学能力；两项新能力回到普通防备。':'仅在所选能力抽到、实际对象与资源齐备时尝试。每轮各一次，失败照付，空窗口没有掌握奖励。');}
  else if(c.type==='LEAVE_ENCOUNTER'){leavePaleEmperorCombatScene(e.scene);e.status='RESOLVED';ctx.note('沿普通路和平离开附室外前庭','沿前庭出口实走4米4秒，再走12米道路12秒回到接待处，归还的附室器皿保持实际位置。没有战斗或奖励，阿尔登与自己的原棍和剩余灵印留在前庭。');}
  else{s.actionsRemaining--;e.status='FIGHTING';e.attemptWeek=s.week;e.startHistoryIndex=s.combatHistory.length;s.combat={encounterId:'PALE_EMPEROR_DISPUTE',round:1,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemyInjuries:structuredClone(e.enemyInjuries),enemyRisk:e.enemyRisk,enemyStatus:'RESISTING',lastRound:null};ctx.note('选择与阿尔登交战','实付1行动。双方各自最多六次实际行动，精神压力与身体伤害各有实际来源。普通撤退、停止抵抗、伤势与真实死亡照常。');}
  entry.after=paleEmperorEncounterBudget(s);entry.sceneAfter=structuredClone(e.scene);entry.materialsAfter=structuredClone(e.materials);e.journal.push(entry);
  if(c.type==='ENCOUNTER_FIGHT'){const source=currentPaleEmperorCombatSource(s);if(!source)throw new Error('真实战斗来源不完整。');e.startSource={...source,revision:s.revision+1};}
}
export const applyPaleEmperorEncounter=applyPaleEmperorEncounterCommand;
export const handlePaleEmperorEncounter=applyPaleEmperorEncounterCommand;
export function startPaleEmperorEncounter(s:SliceState,ctx:SeerContext):void{applyPaleEmperorEncounterCommand(s,{type:'ENCOUNTER_FIGHT'},ctx);}
export function hasPaleEmperorDisputeOpponent(s:SliceState):boolean {
  const e=s.paleEmperor?.encounter,c=s.combat;return isPaleEmperorEncounterStage(s)&&s.status==='ACTIVE'&&!s.activeEvent&&s.world.city==='BACKLUND'&&s.health>0&&s.mind>0&&s.paleEmperor.promotionWeek!==null&&!!e&&e.status==='FIGHTING'&&e.targetId===PALE_EMPEROR_TARGET_ID&&e.terminal===null&&e.preparation!==null&&e.materials.marks.remaining===3-e.powerUses.PALE_STRIKE&&originalsUnchanged(s)&&e.attemptWeek===s.week&&adultsAbsent(s)&&
    validPaleEmperorScene(e.scene)&&e.scene.playerLocation==='FORECOURT'&&e.scene.knownPlayerName===s.character.name&&validPaleEmperorMaterials(e.materials)&&validPaleEmperorBody(e)&&e.weaponLocation===e.materials.weapon.location&&c?.encounterId==='PALE_EMPEROR_DISPUTE'&&c.enemyStatus==='RESISTING'&&c.enemyHealth>0&&c.enemyMind>0&&e.enemyStatus==='RESISTING'&&e.enemyHealth===c.enemyHealth&&e.enemyMind===c.enemyMind&&same(e.enemyInjuries,c.enemyInjuries)&&e.enemyRisk===c.enemyRisk&&integer(c.round,1)&&e.startHistoryIndex!==null&&integer(e.startHistoryIndex)&&s.combatHistory.length-e.startHistoryIndex===c.round-1;
}
function terminalScene(o:PaleEmperorRoundOutcome):{root:PaleEmperorScene;exit:0|4;materials:PaleEmperorMaterials}{const root=structuredClone(o.rootAfter),materials=structuredClone(o.materialsAfter),exit=o.playerHealthAfter>0?4:0;if(exit)leavePaleEmperorCombatScene(root);return{root,exit,materials};}
export function settlePaleEmperorEncounter(s:SliceState,outcome:string,ctx:SeerContext,_award?:(source:string,amount:5|8|25)=>void):void {
  const e=s.paleEmperor.encounter,c=s.combat;if(e.status!=='FIGHTING'||c?.encounterId!=='PALE_EMPEROR_DISPUTE')throw new Error('没有这场附室外前庭冲突。');if(outcome==='CONTINUE')return;const last=c.lastRound,o=last?.paleEmperorOutcome;
  if(!last||!o||!validatePaleEmperorCombatRound(last)||o.continuing||e.terminal||e.startHistoryIndex===null||c.round!==last.round+1||s.combatHistory.length-e.startHistoryIndex!==last.round||!originalsUnchanged(s)||!same(s.combatHistory.at(-1),last)||!same(combatBody(e),combatBody(o))||!same(o.rootAfter,e.scene)||!same(o.materialsAfter,e.materials)||o.playerHealthAfter!==s.health||o.playerMindAfter!==s.mind||o.playerSpiritualityAfter!==s.spirituality||!same(o.masteryAfter,s.progression.mastery)||!same(o.playerInjuriesAfter,s.injuries)||o.playerRiskAfter!==s.injuryRisk||o.enemyHealth!==c.enemyHealth||o.enemyMind!==c.enemyMind||!same(o.enemyInjuries,c.enemyInjuries)||o.enemyRisk!==c.enemyRisk||o.enemyStatus!==c.enemyStatus||outcome!==(o.playerHealthAfter===0?'PLAYER_DEAD':o.enemyHealth===0?'ENEMY_DEAD':o.enemyStatus==='SURRENDERED'?'ENEMY_SURRENDERED':'RETREATED'))throw new Error('结局与真实回合、原人原物和费用不一致。');
  const final=terminalScene(o);e.scene=final.root;e.materials=final.materials;e.terminal={outcome:outcome as PaleEmperorEncounterTerminal['outcome'],round:last.round,historyIndex:s.combatHistory.length-1,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,enemyStatus:e.enemyStatus,exitMetres:final.exit,exitSeconds:final.exit,roadExitMetres:final.exit?12:0,roadExitSeconds:final.exit?12:0};e.status=outcome==='PLAYER_DEAD'?'LOST':outcome==='RETREATED'?'RETREATED':'RESOLVED';s.combat=null;
  ctx.note('阿尔登的附室外前庭冲突结束',`${final.exit?'本人带着实际持有的原件，沿前庭出口走4米4秒，再走12米道路12秒回到接待处。':'本人的原身体真实死亡，实际自有物品留在身体处。'}双方原灵性、精神、伤势、原棍落点与原灵印消耗保留。诺拉与旧场人物仍各在原处，旧诺兰的撤离记录保持原样。`);
}
export const finishPaleEmperorEncounter=settlePaleEmperorEncounter;
export function paleEmperorEncounterActions(s:SliceState){
  if(!isPaleEmperorEncounterStage(s))return[];
  const choices:{command:PaleEmperorEncounterCommand;label:string;cost:string}[]=[
    {command:{type:'ENCOUNTER_TALK'},label:'到附室外前庭与阿尔登交谈',cost:'1行动、12米道路12秒加4米前庭4秒；用尽行动仍可和平离开'},
    ...PALE_EMPEROR_POLICIES.map(policy=>({command:{type:'ENCOUNTER_POLICY' as const,policy},label:({INHERITED_ONLY:'只用已学能力',RESIDUAL_QUIETING:'允许残响安定',SPIRITUAL_INTERDICTION:'允许灵迹阻隔',ALL:'允许两项新能力',ORDINARY:'只作普通行动'})[policy],cost:'0行动；开战前明确选择'})),
    {command:{type:'ENCOUNTER_FIGHT'},label:'自主承担真实冲突',cost:'1行动；真实伤势与死亡风险'},
    {command:{type:'LEAVE_ENCOUNTER'},label:'沿普通路和平离开',cost:'0行动、4米前庭4秒加12米道路12秒'}];
  return choices.map(({command,label,cost})=>{const reason=blockPaleEmperorEncounter(s,command);return{id:`PE1-${command.type}${command.type==='ENCOUNTER_POLICY'?'-'+command.policy:''}`,command,label,cost,enabled:reason===null,reason,cleanup:command.type==='LEAVE_ENCOUNTER'};});
}
export const PALE_EMPEROR_ENCOUNTER_STORY='47岁的阿尔登·沃德独自在附室外前庭提出通行争议。他是当代独立成人，身体100、精神100、灵性120，持自己的唯一原棍与三枚有编号的有限原灵印。诺拉已经离开，维拉、芦羽、诺兰、罗温和历史人物均不在场。先沿12米普通道路，再走4米前庭到场，亲自交谈、明确策略后再决定交战或和平离开。';
export function projectPaleEmperorEncounter(s:SliceState){const e=s.paleEmperor.encounter;return{title:'阿尔登的附室外前庭争议',story:isPaleEmperorEncounterStage(s)?PALE_EMPEROR_ENCOUNTER_STORY:'',status:e.status,inside:hasPaleEmperorEncounterLock(s),policy:e.policy,policyConfirmed:e.journal.some(j=>j.command.type==='ENCOUNTER_POLICY'),scene:structuredClone(e.scene),materials:structuredClone(e.materials),
  enemy:{id:e.targetId,name:'阿尔登·沃德',age:47 as const,sequence:1 as const,health:e.enemyHealth,mind:e.enemyMind,spirituality:e.enemySpirituality,status:e.enemyStatus,weaponLocation:e.weaponLocation,powerUses:{...e.powerUses}},actions:paleEmperorEncounterActions(s),facts:[
    '残响安定每轮一次，8灵性2精神、意志18并受30%抵抗。亲见当前待发灵性压力后，20秒内只削弱同一来源下一次实际灵性压力30。',
    '灵迹阻隔每轮一次，7灵性2精神、知识18并受30%抵抗。20秒内只削弱同一来源下一次实际灵性或精神冲击30，不抵普通棍击。',
    '原门与遮屏决定当前可见路径；条件改变、失去视线或窗口到期即失效。失败、无实际命中和空窗口没有掌握奖励。',
    '保留17项旧能力的实际掌握与条件。这里没有原灰羽、可借力的友善灵、仪式材料或已核验短渡端点；不调用旧人的身体与旧场物件。',
    '体35%、感25%、意25%、知15%；双方1至6动作权重10/15/25/25/15/10，基础1250、底125、上限120，仅继续轮本人恢复12。',
    '每个实际动作5秒，每轮60秒。精神耗尽仍活着停战，身体死亡终结本周目；生还实走4米前庭4秒与12米道路12秒回到接待处。']};}
export type PaleEmperorEncounterProjection=ReturnType<typeof projectPaleEmperorEncounter>;

/** Exact shared finance transition after a completed, unlocked action. Locked
 * READY/FIGHTING scenes never pay a bill or grant next-week actions early. */
export function paleEmperorCompletedBudgetMatches(s:SliceState,expected:PaleEmperorEncounterBudget,finance:PaleEmperorFinanceSnapshot,week:number,date:PublicGameDate,revision:number,randomCursor:number,anchorTitle:string):boolean {
 const current=paleEmperorEncounterBudget(s);
 if(!same({...current,cash:expected.cash,actions:expected.actions},expected)||s.random.cursor!==randomCursor)return false;
 if(finance.sourceEra==='POST_CYCLE')return same(current,expected)&&s.week===week&&same(s.date,date)&&same(paleEmperorFinanceSnapshot(s),finance)&&s.pulse==='NONE'&&s.billAmount===0&&s.activeEvent===null&&s.eventQueue.length===0;
 const titles=['本周生活费','生活费如实记账','本周约定还款','账目结清','新的一周'];
 const receipts=s.chronicle.filter((entry,index)=>entry.id===`record-${s.revision}-${index}`&&titles.includes(entry.title));
 if(expected.actions>0||expected.health===0)return s.week===week&&same(s.date,date)&&s.actionsRemaining===expected.actions&&s.cash===expected.cash&&same(paleEmperorFinanceSnapshot(s),finance)&&s.pulse==='NONE'&&s.billAmount===0&&s.activeEvent===null&&s.eventQueue.length===0&&receipts.length===0;
 if(expected.actions!==0||s.status!=='ACTIVE')return false;
 const result=resolveSliceWeeklyFinance({...finance,cash:expected.cash,week,revision:revision-1,pulse:'BILL',billAmount:0}),advanced=result.eventId===null&&result.state.pulse==='ADVANCE';
 const finalFinance={...finance,...result.state,weeklyBudget:finance.weeklyBudget,lifeTier:advanced?result.state.nextLifeTier:finance.lifeTier};
 if(s.cash!==result.state.cash||!same(paleEmperorFinanceSnapshot(s),paleEmperorFinanceSnapshot(finalFinance))||s.week!==week+(advanced?1:0)||!same(s.date,advanced?addGameWeeks(date,1):date)||s.actionsRemaining!==(advanced?finance.weeklyBudget:0)||s.pulse!==(advanced?'NONE':result.state.pulse)||s.billAmount!==(advanced?0:result.state.billAmount))return false;
 const expectedReceipts=result.receipts.map(receipt=>({week,...receipt}));if(advanced)expectedReceipts.push({week:week+1,title:'新的一周',text:`日期推进7天，本周${finance.weeklyBudget}次行动。`});
 if(!same(receipts.map(({week,title,text})=>({week,title,text})),expectedReceipts))return false;
 if(result.eventId){const anchor=s.chronicle.findIndex((entry,index)=>entry.id===`record-${s.revision}-${index}`&&entry.title===anchorTitle),eventIndex=anchor+1+result.receipts.length;return anchor>=0&&s.eventQueue.length===0&&same(s.activeEvent,{id:result.eventId,instanceId:`${s.runId}:${result.eventId}:${s.revision}:${eventIndex}`});}
 return s.activeEvent===null&&s.eventQueue.length===0;
}
export function paleEmperorTerminalBudgetMatches(s:SliceState,_prep:PaleEmperorPreparation,o:PaleEmperorRoundOutcome):boolean {
 const fight=s.paleEmperor.encounter.journal.find(j=>j.command.type==='ENCOUNTER_FIGHT');if(!fight)return false;
 const expected={...fight.after,health:o.playerHealthAfter,mind:o.playerMindAfter,spirituality:o.playerSpiritualityAfter,mastery:o.masteryAfter,injuries:o.playerInjuriesAfter,injuryRisk:o.playerRiskAfter};
 return same(s.paleEmperor.encounter.scene,terminalScene(o).root)&&same(s.paleEmperor.encounter.materials,terminalScene(o).materials)&&paleEmperorCompletedBudgetMatches(s,expected,fight.finance,fight.week,fight.date,o.source.revision+1,o.randomCursorAfter,'阿尔登的附室外前庭冲突结束');
}
function peacefulBudgetMatches(s:SliceState,e:PaleEmperorEncounterJournal):boolean{return e.command.type==='LEAVE_ENCOUNTER'&&paleEmperorCompletedBudgetMatches(s,e.after,e.finance,e.week,e.date,e.revision,e.randomCursor,'沿普通路和平离开附室外前庭');}
export function replayPaleEmperorPurchases(s:SliceState):PaleEmperorMaterials|null { return Array.isArray(s.paleEmperor.encounter.purchases)&&s.paleEmperor.encounter.purchases.length===0?createPaleEmperorMaterials():null; }
/** Exact root and source-chain replay. Historical rounds are immutable; a later
 * ordinary rest may change the live player but cannot alter a recorded fight. */
export function replayPaleEmperorEncounterRoot(s:SliceState):PaleEmperorScene|null {
 try{
  const e=s.paleEmperor.encounter,initial=createPaleEmperorEncounterState(),allNew=s.combatHistory.flatMap((r,i)=>r.paleEmperorOutcome?[i]:[]),purchased=replayPaleEmperorPurchases(s);
  if(!e||!shape(e,Object.keys(initial))||!['AVAILABLE','READY','FIGHTING','RESOLVED','RETREATED','LOST'].includes(e.status)||e.targetId!==initial.targetId||!['INHERITED_ONLY','RESIDUAL_QUIETING','SPIRITUAL_INTERDICTION','ALL','ORDINARY'].includes(e.policy)||!validPaleEmperorBody(e)||!validPaleEmperorScene(e.scene)||!validPaleEmperorMaterials(e.materials)||e.weaponLocation!==e.materials.weapon.location||!purchased)return null;
  if(!e.preparation)return same({...e,purchases:[],materials:createPaleEmperorMaterials()},initial)&&same(e.materials,purchased)&&allNew.length===0&&s.combat?.encounterId!=='PALE_EMPEROR_DISPUTE'?createPaleEmperorScene():null;
  const prep=e.preparation;
  if(!isPaleEmperorEncounterStage(s)||s.paleEmperor.promotionWeek===null||!s.paleEmperor.life.reflected||!validatePaleEmperorPreparation(prep)||prep.finance.sourceEra!==s.paleEmperor.sourceEra||prep.runId!==s.runId||prep.playerName!==s.character.name||prep.randomSeed!==s.random.seed||prep.randomCursor>s.random.cursor||!integer(prep.week,s.paleEmperor.promotionWeek,s.week)||compareGameDates(prep.date,s.date)>0||!integer(prep.revision,1,s.revision)||!historyUnchanged(s)||typeof e.originalResources!=='string'||!e.originalResources||!Array.isArray(e.journal)||!same(prep.materialsBefore,purchased))return null;
  let policyChosen=false,root=arrive(s,prep),status:PaleEmperorEncounterState['status']='READY',policy:PaleEmperorPolicy='INHERITED_ONLY',materials=structuredClone(prep.materialsAfter);
  let budget=prep.after,finance=prep.finance,week=prep.week,date=prep.date,revision=prep.revision;
  for(const entry of e.journal){
   if(!shape(entry,['command','week','date','revision','randomCursor','before','after','finance','sceneBefore','sceneAfter','materialsBefore','materialsAfter'])||!validatePaleEmperorEncounterCommand(entry.command)||!['ENCOUNTER_POLICY','ENCOUNTER_FIGHT','LEAVE_ENCOUNTER'].includes(entry.command.type)||!validBudget(entry.before,entry.revision)||!validBudget(entry.after,entry.revision)||!validFinance(entry.finance,entry.week)||!integer(entry.revision,revision+1,s.revision)||entry.randomCursor!==prep.randomCursor||!same(entry.sceneBefore,root)||!same(entry.materialsBefore,materials)||status!=='READY'||entry.week!==week||!same(entry.date,date)||!same(entry.before,budget)||!same(entry.finance,finance))return null;
   if(entry.command.type==='ENCOUNTER_POLICY'){if(policyChosen&&entry.command.policy===policy)return null;policy=entry.command.policy;policyChosen=true;}
   else if(entry.command.type==='ENCOUNTER_FIGHT'){if(!policyChosen||root.playerLocation!=='FORECOURT'||entry.before.actions<1)return null;status='FIGHTING';}
   else{leavePaleEmperorCombatScene(root);status='RESOLVED';}
   if(!same(entry.after,{...entry.before,actions:entry.before.actions-(entry.command.type==='ENCOUNTER_FIGHT'?1:0)})||!same(entry.sceneAfter,root)||!same(entry.materialsAfter,materials))return null;
   budget=entry.after;finance=entry.finance;week=entry.week;date=entry.date;revision=entry.revision;
  }
  if(e.policy!==policy)return null;
  if(status!=='FIGHTING'){
   if(e.status!==status||e.startHistoryIndex!==null||e.startSource!==null||e.attemptWeek!==null||e.terminal!==null||!same(combatBody(e),initialPaleEmperorBody())||!same(e.materials,materials)||allNew.length||s.combat?.encounterId==='PALE_EMPEROR_DISPUTE')return null;
   if(status==='READY'||s.revision===revision){
    if(!originalsUnchanged(s)||!adultsAbsent(s))return null;
    if(status==='READY'){if(!same(paleEmperorEncounterBudget(s),budget)||!same(paleEmperorFinanceSnapshot(s),finance)||s.week!==week||!same(s.date,date)||s.random.cursor!==prep.randomCursor||s.pulse!=='NONE'||s.billAmount!==0||s.activeEvent||s.eventQueue.length)return null;}
    else if(!e.journal.at(-1)||!peacefulBudgetMatches(s,e.journal.at(-1)!))return null;
   }
   return root;
  }
  const start=e.startSource;
  if(!start||!validPaleEmperorCombatSource(start)||!integer(e.startHistoryIndex,0,s.combatHistory.length)||e.startHistoryIndex!==e.originalHistory!.length||e.attemptWeek!==week||start.round!==1||start.revision!==revision||start.week!==week||!same(start.date,date)||start.startHistoryIndex!==e.startHistoryIndex||start.runId!==s.runId||!same(start.preparation,prep)||start.policy!==policy||!same(start.body,initialPaleEmperorBody())||!same(start.root,root)||!same(start.materials,materials)||start.randomSeed!==s.random.seed||start.randomCursor!==prep.randomCursor||start.playerHealth!==budget.health||start.playerMind!==budget.mind||start.playerSpirituality!==budget.spirituality||!same(start.mastery,budget.mastery)||!same(start.playerInjuries,budget.injuries)||start.playerRisk!==budget.injuryRisk)return null;
  const terminal=e.terminal;
  if(terminal&&(!shape(terminal,['outcome','round','historyIndex','enemyHealth','enemyMind','enemySpirituality','enemyStatus','exitMetres','exitSeconds','roadExitMetres','roadExitSeconds'])||!integer(terminal.historyIndex,e.startHistoryIndex,s.combatHistory.length-1)))return null;
  const end=terminal?terminal.historyIndex+1:s.combatHistory.length,rounds=s.combatHistory.slice(e.startHistoryIndex,end);
  if(!same(allNew,rounds.map((_r,i)=>e.startHistoryIndex!+i)))return null;
  for(const[i,round]of rounds.entries()){const o=round.paleEmperorOutcome,previous=rounds[i-1]?.paleEmperorOutcome;if(!o||!validatePaleEmperorCombatRound(round)||round.round!==i+1||o.source.revision>=s.revision||o.randomCursorAfter>s.random.cursor||!same(o.source,previous?nextPaleEmperorCombatSource(previous):start)||!same(o.source.root,root)||i<rounds.length-1&&!o.continuing)return null;root=structuredClone(o.rootAfter);materials=structuredClone(o.materialsAfter);}
  const last=rounds.at(-1),o=last?.paleEmperorOutcome;
  if(e.status==='FIGHTING'){
   if(terminal||!hasPaleEmperorDisputeOpponent(s)||!same(combatBody(e),o?combatBody(o):start.body)||!same(e.materials,materials))return null;
   const current=paleEmperorEncounterBudget(s),expected={...budget,health:o?.playerHealthAfter??start.playerHealth,mind:o?.playerMindAfter??start.playerMind,spirituality:o?Math.min(120,o.playerSpiritualityAfter+12):start.playerSpirituality,mastery:o?.masteryAfter??start.mastery,injuries:o?.playerInjuriesAfter??start.playerInjuries,injuryRisk:o?.playerRiskAfter??start.playerRisk};
   if(!same(current,expected)||!same(paleEmperorFinanceSnapshot(s),finance)||s.week!==week||!same(s.date,date)||s.pulse!=='NONE'||s.billAmount!==0||s.activeEvent!==null||s.eventQueue.length)return null;
   return o?o.continuing&&same(last,s.combat!.lastRound)&&same(currentPaleEmperorCombatSource(s),nextPaleEmperorCombatSource(o))?root:null:s.combat!.lastRound===null&&same(currentPaleEmperorCombatSource(s),start)?root:null;
  }
  if(s.combat?.encounterId==='PALE_EMPEROR_DISPUTE'||!terminal||!last||!o||o.continuing||terminal.round!==last.round||rounds.length!==terminal.round||!same(combatBody(e),combatBody(o))||terminal.enemyHealth!==e.enemyHealth||terminal.enemyMind!==e.enemyMind||terminal.enemySpirituality!==e.enemySpirituality||terminal.enemyStatus!==e.enemyStatus)return null;
  const final=terminalScene(o);if(terminal.exitMetres!==final.exit||terminal.exitSeconds!==final.exit||terminal.roadExitMetres!==(final.exit?12:0)||terminal.roadExitSeconds!==(final.exit?12:0)||!same(e.materials,final.materials))return null;
  if(s.revision===o.source.revision+1&&(!originalsUnchanged(s)||!paleEmperorTerminalBudgetMatches(s,prep,o)))return null;
  if(terminal.outcome==='PLAYER_DEAD')return e.status==='LOST'&&s.status==='DEAD'&&o.playerHealthAfter===0?final.root:null;
  if(terminal.outcome==='RETREATED')return e.status==='RETREATED'&&o.playerHealthAfter>0&&(last.retreat==='SUCCESS'||o.playerMindAfter===0)?final.root:null;
  return e.status==='RESOLVED'&&o.playerHealthAfter>0&&(terminal.outcome==='ENEMY_DEAD'?e.enemyStatus==='DEAD':terminal.outcome==='ENEMY_SURRENDERED'&&e.enemyStatus==='SURRENDERED')?final.root:null;
 }catch{return null;}
}
export function validatePaleEmperorEncounter(s:SliceState):boolean {try{const root=replayPaleEmperorEncounterRoot(s);return root!==null&&same(root,s.paleEmperor.encounter.scene);}catch{return false;}}
export const validatePaleEmperorEncounterState=validatePaleEmperorEncounter;
/** The forecourt is outside the original gallery; no original actor or site object is changed. */
export function paleEmperorEncounterOriginalEvents(_s:SliceState):{revision:number;week:number;before:SliceState['deathConsul']['life']['site'];after:SliceState['deathConsul']['life']['site']}[]{return [];}

/** Latest completed encounter boundary, expressed as the input revision of the
 * actual departure/terminal command for the shared current-era receipt journal. */
export function paleEmperorEncounterCompletedBudget(s:SliceState):{budget:PaleEmperorEncounterBudget;finance:PaleEmperorFinanceSnapshot;week:number;date:PublicGameDate;revision:number;randomCursor:number}|null {
 const e=s.paleEmperor.encounter;
 if(!e.preparation||['AVAILABLE','READY','FIGHTING'].includes(e.status))return null;
 if(e.terminal){const round=s.combatHistory[e.terminal.historyIndex],o=round?.paleEmperorOutcome,fight=e.journal.find(j=>j.command.type==='ENCOUNTER_FIGHT');
  if(!o||!fight||o.continuing||!validatePaleEmperorCombatRound(round))return null;
  return{budget:{...structuredClone(fight.after),health:o.playerHealthAfter,mind:o.playerMindAfter,spirituality:o.playerSpiritualityAfter,mastery:structuredClone(o.masteryAfter),injuries:structuredClone(o.playerInjuriesAfter),injuryRisk:o.playerRiskAfter},finance:structuredClone(fight.finance),week:fight.week,date:{...fight.date},revision:o.source.revision,randomCursor:o.randomCursorAfter};
 }
 const last=e.journal.at(-1);return last?.command.type==='LEAVE_ENCOUNTER'?{budget:structuredClone(last.after),finance:structuredClone(last.finance),week:last.week,date:{...last.date},revision:last.revision-1,randomCursor:last.randomCursor}:null;
}
