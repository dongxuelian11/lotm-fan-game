import { projectDemonessPublicFields } from '../calamity-demoness/life.js';
import type { ApocalypseDemonessOriginals } from './life.js';
import { validApocalypseDemonessOriginals } from './life.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { addGameWeeks, compareGameDates, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceCombatRound, SliceInjury, SliceState } from '../slice/types.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { hasApocalypseDemonessLifeLock } from './life.js';
import { currentApocalypseDemonessCombatSource, nextApocalypseDemonessCombatSource, validApocalypseDemonessCombatSource, validateApocalypseDemonessCombatRound,
  validApocalypseDemonessBody, validApocalypseDemonessInjuries, type ApocalypseDemonessCombatSource, type ApocalypseDemonessRoundOutcome } from './combat.js';

export const APOCALYPSE_DEMONESS_TARGET_ID = 'AD1-LEONA' as const;
export const APOCALYPSE_DEMONESS_SITE = 'AD1-ADJACENT-YARD' as const;
export const APOCALYPSE_DEMONESS_POWER_IDS = ['BODY_MARK', 'MENTAL_MARK', 'FEINT'] as const;
export type ApocalypseDemonessPowerId = typeof APOCALYPSE_DEMONESS_POWER_IDS[number];
export type ApocalypseDemonessEnemyIntent = ApocalypseDemonessPowerId | 'BODY_STRIKE' | 'OBSERVE' | 'ACCIDENT';
export type ApocalypseDemonessPolicy = 'INHERITED_ONLY' | 'PULSE_CONTAINMENT' | 'MIRROR_BUFFER' | 'ALL' | 'ORDINARY';
export type ApocalypseDemonessCombatPolicy = ApocalypseDemonessPolicy;
export const APOCALYPSE_DEMONESS_POLICIES: readonly ApocalypseDemonessPolicy[] = ['INHERITED_ONLY','PULSE_CONTAINMENT','MIRROR_BUFFER','ALL','ORDINARY'];
export const APOCALYPSE_DEMONESS_POWERS = [
  { id: 'BODY_MARK', label: '有限身体冲击印记', cost: 7, selfGain: 75, enemyReduction: 0 },
  { id: 'MENTAL_MARK', label: '有限精神牵引印记', cost: 7, selfGain: 65, enemyReduction: 0 },
  { id: 'FEINT', label: '侧移一步并横棍遮挡', cost: 3, selfGain: 0, enemyReduction: 0 },
] as const;
export interface ApocalypseDemonessCombatPlate { id:'AD1-COMBAT-PLATE'; ownerId:'PLAYER'; quantity:1; location:'PLAYER'; initialCharges:3; charges:number; paidPennies:20; wear:number }
export const createApocalypseDemonessCombatPlate=():ApocalypseDemonessCombatPlate=>({id:'AD1-COMBAT-PLATE',ownerId:'PLAYER',quantity:1,location:'PLAYER',initialCharges:3,charges:3,paidPennies:20,wear:0});
export interface ApocalypseDemonessMaterials {
  weapon: { id: 'AD1-LEONA-CLUB'; sourceId: 'AD1-LEONA-OWNED-CLUB-1'; owner: typeof APOCALYPSE_DEMONESS_TARGET_ID;
    massKg: 2; location: 'HAND' | 'YARD'; condition: 100; visible: true };
  plate: ApocalypseDemonessCombatPlate | null;
  marks: { id: string; owner: typeof APOCALYPSE_DEMONESS_TARGET_ID; status: 'HELD' | 'SPENT'; usedRound: number | null }[];
}
export function createApocalypseDemonessMaterials(): ApocalypseDemonessMaterials {
  return { weapon: { id: 'AD1-LEONA-CLUB', sourceId: 'AD1-LEONA-OWNED-CLUB-1', owner: APOCALYPSE_DEMONESS_TARGET_ID,
    massKg: 2, location: 'HAND', condition: 100, visible: true },
    plate:null, marks: [1,2,3].map(n=>({id:`AD1-LEONA-MARK-${n}`,owner:APOCALYPSE_DEMONESS_TARGET_ID,status:'HELD',usedRound:null})) };
}
export interface ApocalypseDemonessScene {
  siteId: typeof APOCALYPSE_DEMONESS_SITE; playerLocation: 'OUTSIDE' | 'YARD'; playerCoordinate: 0 | 4; enemyCoordinate: 6 | 7;
  ordinaryExit: 'OPEN'; visibleBodyLine: boolean; conditionVersion: number; observedConditionVersion: number | null;
  thirdPartiesInArea: 0; presentMemberIds: string[]; observedSourceId: string | null; observationWeek: number | null;
  clockSeconds: number; externalSeconds: number; playerTravelMetres: number; enemyTravelMetres: number; knownPlayerName: string | null; knownEnemyName: string | null;
}
export function createApocalypseDemonessScene(): ApocalypseDemonessScene {
  return { siteId: APOCALYPSE_DEMONESS_SITE, playerLocation: 'OUTSIDE', playerCoordinate: 0, enemyCoordinate: 6,
    ordinaryExit: 'OPEN', visibleBodyLine: true, conditionVersion: 1, observedConditionVersion: null,
    thirdPartiesInArea: 0, presentMemberIds: [], observedSourceId: null, observationWeek: null,
    clockSeconds: 0, externalSeconds: 0, playerTravelMetres: 0, enemyTravelMetres: 0, knownPlayerName: null, knownEnemyName: null };
}
export interface ApocalypseDemonessPendingSource { id:string; markId:string; power:'BODY_MARK'|'MENTAL_MARK'; declaredAt:number; readyAt:number; declaredRound:number; declaredOrder:number; observed:boolean; conditionVersion:number; containmentUsed:boolean }
export interface ApocalypseDemonessObservation { power: 'BODY_MARK' | 'MENTAL_MARK'; conditionVersion: number; round: number; order: number; atSeconds: number; paidCost: 7 }
export interface ApocalypseDemonessCombatBody {
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  weaponLocation: 'HAND' | 'YARD'; powerUses: Record<ApocalypseDemonessPowerId, number>; observations: ApocalypseDemonessObservation[];
  pendingSource:ApocalypseDemonessPendingSource|null; expiredSourceIds:string[]; releasedSourceIds:string[];
  totalOwnerMindSpent: number; pulseContainmentAttempts: number; pulseContainmentChecks: number; pulseContainmentSuccesses: number;
  mirrorBufferAttempts: number; mirrorBufferChecks: number; mirrorBufferSuccesses: number; mirrorScreenAttempts: number; mirrorScreenChecks:number; blackFlameAttempts: number; inheritedSuccesses: { mirrorScreen: number; blackFlame: number; frost: number };
}
export function initialApocalypseDemonessBody(): ApocalypseDemonessCombatBody {
  return { enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0, weaponLocation: 'HAND',
    powerUses: { BODY_MARK: 0, MENTAL_MARK: 0, FEINT: 0 }, observations: [], pendingSource:null, expiredSourceIds:[], releasedSourceIds:[], totalOwnerMindSpent: 0,
    pulseContainmentAttempts: 0, pulseContainmentChecks: 0, pulseContainmentSuccesses: 0, mirrorBufferAttempts: 0, mirrorBufferChecks: 0, mirrorBufferSuccesses: 0, mirrorScreenAttempts: 0, mirrorScreenChecks:0, blackFlameAttempts: 0, inheritedSuccesses: { mirrorScreen: 0, blackFlame: 0, frost: 0 } };
}
export function combatBody(e: ApocalypseDemonessCombatBody): ApocalypseDemonessCombatBody {
  return Object.fromEntries(Object.keys(initialApocalypseDemonessBody()).map(k => [k, structuredClone(e[k as keyof ApocalypseDemonessCombatBody])])) as unknown as ApocalypseDemonessCombatBody;
}
export type ApocalypseDemonessFinanceSnapshot = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface ApocalypseDemonessEncounterBudget {
  cash: number; actions: number; health: number; mind: number; spirituality: number; pollution: number; gender: string; sequence: 1;
  acting: number; coreStats: SliceState['character']['coreStats']; mastery: Record<string, number>; completedSources: string[]; injuries: SliceInjury[]; injuryRisk: number;
}
export type ApocalypseDemonessCombatOriginals = ApocalypseDemonessOriginals;
export interface ApocalypseDemonessPreparation {
  week: number; date: PublicGameDate; revision: number; runId: string; randomSeed: string; randomCursor: number; pricePaid: 20; actionsPaid: 1;
  lifeReflected: true; playerName: string; playerClubHeld: boolean; playerWeaponId: 'town-short-club' | null; before: ApocalypseDemonessEncounterBudget; after: ApocalypseDemonessEncounterBudget;
  finance: ApocalypseDemonessFinanceSnapshot; materialsBefore: ApocalypseDemonessMaterials; materialsAfter: ApocalypseDemonessMaterials; originalsBefore: ApocalypseDemonessCombatOriginals; originalsAfter: ApocalypseDemonessCombatOriginals;
}
export type ApocalypseDemonessEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' } | { type: 'ENCOUNTER_POLICY'; policy: ApocalypseDemonessPolicy };
export interface ApocalypseDemonessEncounterJournal {
  command: ApocalypseDemonessEncounterCommand; week: number; date: PublicGameDate; revision: number; randomCursor: number;
  before: ApocalypseDemonessEncounterBudget; after: ApocalypseDemonessEncounterBudget; finance: ApocalypseDemonessFinanceSnapshot; sceneBefore: ApocalypseDemonessScene; sceneAfter: ApocalypseDemonessScene; materialsBefore: ApocalypseDemonessMaterials; materialsAfter: ApocalypseDemonessMaterials; originalsBefore: ApocalypseDemonessCombatOriginals; originalsAfter: ApocalypseDemonessCombatOriginals;
}
export interface ApocalypseDemonessEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: ApocalypseDemonessCombatBody['enemyStatus']; exitMetres: 0 | 4; exitSeconds: 0 | 4; originalsBefore: ApocalypseDemonessCombatOriginals; originalsAfter: ApocalypseDemonessCombatOriginals;
}
export interface ApocalypseDemonessEncounterState extends ApocalypseDemonessCombatBody {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof APOCALYPSE_DEMONESS_TARGET_ID; policy: ApocalypseDemonessPolicy;
  preparation: ApocalypseDemonessPreparation | null; purchases: never[]; attemptWeek: number | null; startHistoryIndex: number | null; startSource: ApocalypseDemonessCombatSource | null;
  originalHistory: SliceCombatRound[] | null; originalResources: string | null; scene: ApocalypseDemonessScene; materials: ApocalypseDemonessMaterials; journal: ApocalypseDemonessEncounterJournal[]; terminal: ApocalypseDemonessEncounterTerminal | null;
}
export function createApocalypseDemonessEncounterState(): ApocalypseDemonessEncounterState {
  return { ...initialApocalypseDemonessBody(), status: 'AVAILABLE', targetId: APOCALYPSE_DEMONESS_TARGET_ID, policy: 'INHERITED_ONLY', preparation: null, purchases: [], attemptWeek: null, startHistoryIndex: null,
    startSource: null, originalHistory: null, originalResources: null, scene: createApocalypseDemonessScene(), materials: createApocalypseDemonessMaterials(), journal: [], terminal: null };
}
export const createApocalypseDemonessEncounter = createApocalypseDemonessEncounterState;
export const isApocalypseDemonessEncounterStage = (s: SliceState) => s.progression.pathwayId === 'demoness' && s.progression.sequence === 1;
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
export function apocalypseDemonessFinanceSnapshot(s: ApocalypseDemonessFinanceSnapshot): ApocalypseDemonessFinanceSnapshot {
  return { weeklyBudget: s.weeklyBudget, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: structuredClone(s.debts), missedWeeks: s.missedWeeks, credit: s.credit };
}
export function validateApocalypseDemonessFinanceSnapshot(v: ApocalypseDemonessFinanceSnapshot, week: number): boolean {
  return shape(v, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit']) && integer(v.weeklyBudget, 1, 100) && Object.hasOwn(SLICE_LIFE, v.lifeTier) && Object.hasOwn(SLICE_LIFE, v.nextLifeTier) &&
    integer(v.missedWeeks) && ['NORMAL', 'NOTICE', 'SUSPENDED'].includes(v.credit) && Array.isArray(v.debts) && v.debts.every(d => shape(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek']) &&
      typeof d.id === 'string' && !!d.id && typeof d.source === 'string' && !!d.source && integer(d.remaining) && integer(d.weeklyPayment, 1) && integer(d.createdWeek, 0, week));
}
export function apocalypseDemonessEncounterBudget(s: SliceState): ApocalypseDemonessEncounterBudget {
  return { cash: s.cash, actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution, gender: s.character.gender,
    sequence: 1, acting: s.progression.acting, coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources], injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function validBudget(v: ApocalypseDemonessEncounterBudget, revision: number): boolean {
  return shape(v, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) && integer(v.cash) &&
    integer(v.actions, 0, 100) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.pollution, 0, 100) && typeof v.gender === 'string' && v.sequence === 1 && integer(v.acting, 0, 100) &&
    shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) && Object.values(v.coreStats).every(n => integer(n, 0, 500)) && !!v.mastery && typeof v.mastery === 'object' && !Array.isArray(v.mastery) && Object.values(v.mastery).every(n => integer(n, 0, 500)) &&
    Array.isArray(v.completedSources) && v.completedSources.every(x => typeof x === 'string' && !!x) && new Set(v.completedSources).size === v.completedSources.length && validApocalypseDemonessInjuries(v.injuries, revision) && integer(v.injuryRisk);
}
export function validApocalypseDemonessMaterials(v: ApocalypseDemonessMaterials): boolean {
  try { const initial=createApocalypseDemonessMaterials(),w=v.weapon;
    return shape(v,['weapon','marks','plate'])&&validApocalypseDemonessCombatPlate(v.plate)&&shape(w,Object.keys(initial.weapon))&&['HAND','YARD'].includes(w.location)&&same({...w,location:'HAND'},initial.weapon)&&
      Array.isArray(v.marks)&&v.marks.length===3&&v.marks.every((m,i)=>shape(m,['id','owner','status','usedRound'])&&m.id===initial.marks[i]!.id&&m.owner===APOCALYPSE_DEMONESS_TARGET_ID&&(m.status==='HELD'?m.usedRound===null:m.status==='SPENT'&&integer(m.usedRound,1)));
  }catch{return false;}
}
function arrivalMaterials(before: ApocalypseDemonessMaterials): ApocalypseDemonessMaterials { if(before.plate)throw new Error('同一镜片不能再买一份。');return {...structuredClone(before),plate:createApocalypseDemonessCombatPlate()}; }
export function validApocalypseDemonessCombatPlate(p:ApocalypseDemonessCombatPlate|null):boolean {return p===null||shape(p,Object.keys(createApocalypseDemonessCombatPlate()))&&same({...p,charges:3,wear:0},createApocalypseDemonessCombatPlate())&&integer(p.charges,0,3)&&integer(p.wear,0,15)&&p.wear%5===0&&p.wear<=5*(3-p.charges);}
export function validateApocalypseDemonessPreparation(v: unknown): v is ApocalypseDemonessPreparation {
  try { const p=v as ApocalypseDemonessPreparation; return shape(p,['week','date','revision','runId','randomSeed','randomCursor','pricePaid','actionsPaid','lifeReflected','playerName','playerClubHeld','playerWeaponId','before','after','finance','materialsBefore','materialsAfter','originalsBefore','originalsAfter']) &&
    integer(p.week,1)&&isValidGameDate(p.date)&&integer(p.revision,1)&&typeof p.runId==='string'&&!!p.runId&&typeof p.randomSeed==='string'&&!!p.randomSeed&&integer(p.randomCursor)&&typeof p.playerClubHeld==='boolean'&&['town-short-club',null].includes(p.playerWeaponId)&&p.playerClubHeld===(p.playerWeaponId!==null)&&typeof p.playerName==='string'&&!!p.playerName.trim()&&p.pricePaid===20&&p.actionsPaid===1&&p.lifeReflected===true&&
    validBudget(p.before,p.revision)&&validBudget(p.after,p.revision)&&validateApocalypseDemonessFinanceSnapshot(p.finance,p.week)&&p.before.cash>=20&&p.before.actions>=1&&p.before.actions<=Math.max(4,p.finance.weeklyBudget)&&same(p.after,{...p.before,cash:p.before.cash-20,actions:p.before.actions-1})&&
    validApocalypseDemonessMaterials(p.materialsBefore)&&p.materialsBefore.plate===null&&validApocalypseDemonessMaterials(p.materialsAfter)&&same(p.materialsAfter,arrivalMaterials(p.materialsBefore))&&validApocalypseDemonessCombatOriginals(p.originalsBefore)&&p.originalsBefore.site.playerEnergy>=8&&same(p.originalsAfter,walkOriginals(p.originalsBefore,4));
  }catch{return false;}
}
export function validApocalypseDemonessScene(p: ApocalypseDemonessScene): boolean {
  const initial=createApocalypseDemonessScene();
  return shape(p,Object.keys(initial)) && same({...p,playerLocation:'OUTSIDE',playerCoordinate:0,enemyCoordinate:6,visibleBodyLine:true,conditionVersion:1,observedConditionVersion:null,observedSourceId:null,observationWeek:null,clockSeconds:0,externalSeconds:0,playerTravelMetres:0,enemyTravelMetres:0,knownPlayerName:null,knownEnemyName:null},initial) &&
    typeof p.visibleBodyLine==='boolean' && integer(p.conditionVersion,1) && (p.observedConditionVersion===null||integer(p.observedConditionVersion,1,p.conditionVersion)) &&
    (p.playerLocation==='OUTSIDE'&&p.playerCoordinate===0||p.playerLocation==='YARD'&&p.playerCoordinate===4) && integer(p.clockSeconds) && p.externalSeconds===p.clockSeconds && integer(p.playerTravelMetres) && integer(p.enemyTravelMetres) && [6,7].includes(p.enemyCoordinate) &&
    (p.observedSourceId===null?p.observationWeek===null&&p.knownPlayerName===null&&p.knownEnemyName===null:typeof p.observedSourceId==='string'&&integer(p.observationWeek,1)&&typeof p.knownPlayerName==='string'&&!!p.knownPlayerName.trim()&&p.knownEnemyName==='莱奥娜·布莱克');
}
export function apocalypseDemonessOriginalSnapshot(s:SliceState):ApocalypseDemonessCombatOriginals {
 const site=s.apocalypseDemoness.life.site;if(!site)throw new Error('尚未接续实际原场地。');
 return {site:structuredClone(site),combatPlate:structuredClone(s.apocalypseDemoness.sourceScene?.originals.combatPlate??s.calamityDemoness.encounter.plate)};
}
export function commitApocalypseDemonessOriginals(s:SliceState,o:ApocalypseDemonessCombatOriginals):void {
 s.apocalypseDemoness.life.site=structuredClone(o.site);s.apocalypseDemoness.life.clockSeconds=o.site.clockSeconds;s.apocalypseDemoness.life.playerLocation=o.site.playerLocation;
}
export function validApocalypseDemonessCombatOriginals(o:ApocalypseDemonessCombatOriginals):boolean {
 try{const p=o.site;return validApocalypseDemonessOriginals(o)&&p.introducedWeek!==null&&p.playerLocation==='OUTSIDE'&&p.vera?.location==='OUTSIDE'&&p.marcus?.location==='OUTSIDE'&&!p.screen.active&&p.box.state==='CLOSED'&&p.plates.every(x=>x.status==='RETURNED');}catch{return false;}
}
export function apocalypseDemonessPlayerWeapon(s:SliceState):'town-short-club'|null{return s.town.clubLocation==='HAND'?'town-short-club':null;}
function walkOriginals(o:ApocalypseDemonessCombatOriginals,metres:4):ApocalypseDemonessCombatOriginals {
 const next=structuredClone(o);if(next.site.playerEnergy<metres)throw new Error('普通步行精力不足。');next.site.playerEnergy-=metres;next.site.playerTravelMetres+=metres;next.site.clockSeconds+=metres;return next;
}
function protectedOriginals(s:SliceState):string {
 const {site:_site,clockSeconds:_clock,playerLocation:_location,...life}=s.apocalypseDemoness.life;
 return stableStringify({assassin:s.assassin,instigator:s.instigator,witch:s.witch,pleasure:s.pleasure,pain:s.pain,despair:s.despair,unagingDemoness:s.unagingDemoness,calamityDemoness:s.calamityDemoness,town:s.town,life});
}
function adultsAbsent(s:SliceState):boolean {
 const l=s.apocalypseDemoness.life;return !hasApocalypseDemonessLifeLock(s)&&l.reflected&&l.pending===null&&l.activeCase===null&&Object.values(l.cases).every(c=>c.status==='RESOLVED')&&validApocalypseDemonessCombatOriginals(apocalypseDemonessOriginalSnapshot(s));
}
function historyUnchanged(s:SliceState):boolean {const e=s.apocalypseDemoness.encounter;return Array.isArray(e.originalHistory)&&same(e.originalHistory,s.combatHistory.slice(0,e.originalHistory.length));}
function expectedOriginals(s:SliceState):ApocalypseDemonessCombatOriginals|null {
 const e=s.apocalypseDemoness.encounter;if(e.terminal)return e.terminal.originalsAfter;
 const last=s.combatHistory.at(-1)?.apocalypseDemonessOutcome;if(last&&e.startHistoryIndex!==null&&s.combatHistory.length>e.startHistoryIndex)return last.originalsAfter;
 return e.journal.at(-1)?.originalsAfter??e.preparation?.originalsAfter??null;
}
function originalsUnchanged(s:SliceState):boolean{return s.apocalypseDemoness.encounter.originalResources===protectedOriginals(s)&&historyUnchanged(s)&&same(apocalypseDemonessOriginalSnapshot(s),expectedOriginals(s));}
export function validateApocalypseDemonessEncounterCommand(v:unknown):v is ApocalypseDemonessEncounterCommand {if(!v||typeof v!=='object'||Array.isArray(v))return false;const c=v as ApocalypseDemonessEncounterCommand;return c.type==='ENCOUNTER_POLICY'?shape(c,['type','policy'])&&['INHERITED_ONLY','PULSE_CONTAINMENT','MIRROR_BUFFER','ALL','ORDINARY'].includes(c.policy):shape(c,['type'])&&['ENCOUNTER_TALK','ENCOUNTER_FIGHT','LEAVE_ENCOUNTER'].includes(c.type);}
export const isApocalypseDemonessEncounterCommand=validateApocalypseDemonessEncounterCommand;
export const hasApocalypseDemonessEncounterLock=(s:SliceState):boolean=>['READY','FIGHTING'].includes(s.apocalypseDemoness.encounter.status);
export const isInsideApocalypseDemonessEncounter=hasApocalypseDemonessEncounterLock;
export function blockApocalypseDemonessEncounter(s:SliceState,c:ApocalypseDemonessEncounterCommand):string|null {
  if(!validateApocalypseDemonessEncounterCommand(c))return'遭遇命令无效。';const e=s.apocalypseDemoness.encounter;
  if(!isApocalypseDemonessEncounterStage(s)||s.apocalypseDemoness.promotionWeek===null||s.status!=='ACTIVE'||s.health<=0)return'须本人仍活着并完成末日魔女晋升。';
  if(s.combat)return'先处理当前真实战斗。';if(!adultsAbsent(s))return'先收束三项生活实践、交回新片并封好原箱；本人、维瑞娜和马库斯须实际走到场外。';if(s.world.city!=='BACKLUND')return'须实际在贝克兰德相邻修理院。';
  if(c.type==='LEAVE_ENCOUNTER')return e.status==='READY'&&originalsUnchanged(s)?null:'须已亲自到场，才能普通离开。';
  if(s.activeEvent||s.eventQueue.length||s.pulse!=='NONE')return'先处理当前事件或周账。';if(s.mind<=0)return'需要清醒；到场后仍可普通退出。';
  if(c.type==='ENCOUNTER_TALK')return e.status!=='AVAILABLE'||e.preparation?'同一莱奥娜的争议不能重置。':s.apocalypseDemoness.life.site!.playerEnergy<8?'须留足到场和普通返程各4精力。':s.cash<20?'独立的新战斗镜片需要20便士。':s.actionsRemaining<1?'到场需1行动；行动用尽仍可普通离开。':null;
  if(e.status!=='READY'||!e.preparation||!originalsUnchanged(s))return'须先亲自交谈并保留同一原人原物和旧记录。';
  if(c.type==='ENCOUNTER_POLICY')return c.policy===e.policy&&e.journal.some(j=>j.command.type==='ENCOUNTER_POLICY')?'已经采用这项策略。':null;
  if(!e.journal.some(j=>j.command.type==='ENCOUNTER_POLICY'))return'先明确选择本场策略；开战后不能更换。';return s.actionsRemaining<1?'开战需要1行动；和平离开不花行动。':null;
}
export const apocalypseDemonessEncounterReason=blockApocalypseDemonessEncounter;
export function leaveApocalypseDemonessCombatScene(p:ApocalypseDemonessScene):void {if(p.playerLocation!=='YARD'||p.playerCoordinate!==4)throw new Error('须从实际所在相邻修理院离开。');p.playerLocation='OUTSIDE';p.playerCoordinate=0;p.playerTravelMetres+=4;p.clockSeconds+=4;p.externalSeconds+=4;}
function arrive(s:SliceState,p:ApocalypseDemonessPreparation):ApocalypseDemonessScene{return{...createApocalypseDemonessScene(),playerLocation:'YARD',playerCoordinate:4,observedSourceId:`${s.runId}:AD1-ADJACENT-YARD:${p.revision}`,observationWeek:p.week,observedConditionVersion:1,clockSeconds:4,externalSeconds:4,playerTravelMetres:4,knownPlayerName:p.playerName,knownEnemyName:'莱奥娜·布莱克'};}
export function applyApocalypseDemonessEncounterCommand(s:SliceState,c:ApocalypseDemonessEncounterCommand,ctx:SeerContext):void {
  const reason=blockApocalypseDemonessEncounter(s,c);if(reason)throw new Error(reason);const e=s.apocalypseDemoness.encounter;
  if(c.type==='ENCOUNTER_TALK'){
    const before=apocalypseDemonessEncounterBudget(s),materialsBefore=structuredClone(e.materials),originalsBefore=apocalypseDemonessOriginalSnapshot(s);s.actionsRemaining--;s.cash-=20;e.materials=arrivalMaterials(e.materials);commitApocalypseDemonessOriginals(s,walkOriginals(originalsBefore,4));
    e.preparation={week:s.week,date:{...s.date},revision:s.revision+1,runId:s.runId,randomSeed:s.random.seed,randomCursor:s.random.cursor,pricePaid:20,actionsPaid:1,lifeReflected:true,playerName:s.character.name,playerClubHeld:apocalypseDemonessPlayerWeapon(s)!==null,playerWeaponId:apocalypseDemonessPlayerWeapon(s),before,after:apocalypseDemonessEncounterBudget(s),finance:apocalypseDemonessFinanceSnapshot(s),materialsBefore,materialsAfter:structuredClone(e.materials),originalsBefore,originalsAfter:apocalypseDemonessOriginalSnapshot(s)};
    e.originalHistory=structuredClone(s.combatHistory);e.originalResources=protectedOriginals(s);e.scene=arrive(s,e.preparation);e.status='READY';
    ctx.note('走到相邻修理院与莱奥娜交谈',`实付20便士购买一片新的AD1-COMBAT-PLATE（3次），另付1行动，步行4米4秒，并看清脚边一米的侧步位置。你介绍姓名“${s.character.name}”，43岁的莱奥娜·布莱克也报出姓名。她持自己的唯一原棍与三枚有限印记，身体100、精神100、灵性120。维瑞娜与马库斯已经实际离开原修理室。你实际支付4精力。旧CD2镜片仍有原三次，伊瑞丝仍在另一处旧庭院；旧人物原结果保持不变。`);return;
  }
  const entry:ApocalypseDemonessEncounterJournal={command:structuredClone(c),week:s.week,date:{...s.date},revision:s.revision+1,randomCursor:s.random.cursor,before:apocalypseDemonessEncounterBudget(s),after:apocalypseDemonessEncounterBudget(s),finance:apocalypseDemonessFinanceSnapshot(s),sceneBefore:structuredClone(e.scene),sceneAfter:structuredClone(e.scene),materialsBefore:structuredClone(e.materials),materialsAfter:structuredClone(e.materials),originalsBefore:apocalypseDemonessOriginalSnapshot(s),originalsAfter:apocalypseDemonessOriginalSnapshot(s)};
  if(c.type==='ENCOUNTER_POLICY'){e.policy=c.policy;ctx.note('选择本场交战策略',c.policy==='ORDINARY'?'本场只作普通动作；不施放抽到的能力。':c.policy==='INHERITED_ONLY'?'本场只允许已学能力；两项新能力回到普通防备。':'仅在所选能力抽到、实际对象与资源齐备时尝试。每轮各一次，失败照付，空窗口没有掌握奖励。');}
  else if(c.type==='LEAVE_ENCOUNTER'){leaveApocalypseDemonessCombatScene(e.scene);commitApocalypseDemonessOriginals(s,walkOriginals(apocalypseDemonessOriginalSnapshot(s),4));e.status='RESOLVED';ctx.note('沿普通路和平离开相邻修理院','沿开放出口实际走4米4秒、扣4精力。没有战斗或奖励，莱奥娜与自己的棍和剩余印记留在相邻修理院。');}
  else{s.actionsRemaining--;e.status='FIGHTING';e.attemptWeek=s.week;e.startHistoryIndex=s.combatHistory.length;s.combat={encounterId:'APOCALYPSE_DEMONESS_DISPUTE',round:1,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemyInjuries:structuredClone(e.enemyInjuries),enemyRisk:e.enemyRisk,enemyStatus:'RESISTING',lastRound:null};ctx.note('选择与莱奥娜交战','实付1行动。双方各自最多六次实际行动，精神压力与身体伤害各有实际来源。普通撤退、停止抵抗、伤势与真实死亡照常。');}
  entry.after=apocalypseDemonessEncounterBudget(s);entry.sceneAfter=structuredClone(e.scene);entry.materialsAfter=structuredClone(e.materials);entry.originalsAfter=apocalypseDemonessOriginalSnapshot(s);e.journal.push(entry);
  if(c.type==='ENCOUNTER_FIGHT'){const source=currentApocalypseDemonessCombatSource(s);if(!source)throw new Error('真实战斗来源不完整。');e.startSource={...source,revision:s.revision+1};}
}
export const applyApocalypseDemonessEncounter=applyApocalypseDemonessEncounterCommand;
export const handleApocalypseDemonessEncounter=applyApocalypseDemonessEncounterCommand;
export function startApocalypseDemonessEncounter(s:SliceState,ctx:SeerContext):void{applyApocalypseDemonessEncounterCommand(s,{type:'ENCOUNTER_FIGHT'},ctx);}
export function hasApocalypseDemonessDisputeOpponent(s:SliceState):boolean {
  const e=s.apocalypseDemoness?.encounter,c=s.combat;return isApocalypseDemonessEncounterStage(s)&&s.status==='ACTIVE'&&!s.activeEvent&&s.world.city==='BACKLUND'&&s.health>0&&s.mind>0&&s.apocalypseDemoness.promotionWeek!==null&&!!e&&e.status==='FIGHTING'&&e.targetId===APOCALYPSE_DEMONESS_TARGET_ID&&e.terminal===null&&e.preparation!==null&&e.materials.marks.filter(m=>m.status==='SPENT').length===e.powerUses.BODY_MARK+e.powerUses.MENTAL_MARK&&originalsUnchanged(s)&&e.attemptWeek===s.week&&adultsAbsent(s)&&
    validApocalypseDemonessScene(e.scene)&&e.scene.playerLocation==='YARD'&&e.scene.knownPlayerName===s.character.name&&validApocalypseDemonessMaterials(e.materials)&&validApocalypseDemonessBody(e)&&e.weaponLocation===e.materials.weapon.location&&c?.encounterId==='APOCALYPSE_DEMONESS_DISPUTE'&&c.enemyStatus==='RESISTING'&&c.enemyHealth>0&&c.enemyMind>0&&e.enemyStatus==='RESISTING'&&e.enemyHealth===c.enemyHealth&&e.enemyMind===c.enemyMind&&same(e.enemyInjuries,c.enemyInjuries)&&e.enemyRisk===c.enemyRisk&&integer(c.round,1)&&e.startHistoryIndex!==null&&integer(e.startHistoryIndex)&&s.combatHistory.length-e.startHistoryIndex===c.round-1;
}
function terminalScene(o:ApocalypseDemonessRoundOutcome):{root:ApocalypseDemonessScene;exit:0|4;materials:ApocalypseDemonessMaterials;originals:ApocalypseDemonessCombatOriginals}{const root=structuredClone(o.rootAfter),materials=structuredClone(o.materialsAfter),exit=o.playerHealthAfter>0?4:0,originals=exit?walkOriginals(o.originalsAfter,4):structuredClone(o.originalsAfter);if(exit)leaveApocalypseDemonessCombatScene(root);return{root,exit,materials,originals};}
export function settleApocalypseDemonessEncounter(s:SliceState,outcome:string,ctx:SeerContext,_award?:(source:string,amount:5|8|25)=>void):void {
  const e=s.apocalypseDemoness.encounter,c=s.combat;if(e.status!=='FIGHTING'||c?.encounterId!=='APOCALYPSE_DEMONESS_DISPUTE')throw new Error('没有这场相邻修理院冲突。');if(outcome==='CONTINUE')return;const last=c.lastRound,o=last?.apocalypseDemonessOutcome;
  if(!last||!o||!validateApocalypseDemonessCombatRound(last)||o.continuing||e.terminal||e.startHistoryIndex===null||c.round!==last.round+1||s.combatHistory.length-e.startHistoryIndex!==last.round||!originalsUnchanged(s)||!same(s.combatHistory.at(-1),last)||!same(combatBody(e),combatBody(o))||!same(o.rootAfter,e.scene)||!same(o.materialsAfter,e.materials)||o.playerHealthAfter!==s.health||o.playerMindAfter!==s.mind||o.playerSpiritualityAfter!==s.spirituality||!same(o.masteryAfter,s.progression.mastery)||!same(o.playerInjuriesAfter,s.injuries)||o.playerRiskAfter!==s.injuryRisk||o.enemyHealth!==c.enemyHealth||o.enemyMind!==c.enemyMind||!same(o.enemyInjuries,c.enemyInjuries)||o.enemyRisk!==c.enemyRisk||o.enemyStatus!==c.enemyStatus||outcome!==(o.playerHealthAfter===0?'PLAYER_DEAD':o.enemyHealth===0?'ENEMY_DEAD':o.enemyStatus==='SURRENDERED'?'ENEMY_SURRENDERED':'RETREATED'))throw new Error('结局与真实回合、原人原物和费用不一致。');
  const final=terminalScene(o);e.scene=final.root;e.materials=final.materials;commitApocalypseDemonessOriginals(s,final.originals);e.terminal={outcome:outcome as ApocalypseDemonessEncounterTerminal['outcome'],round:last.round,historyIndex:s.combatHistory.length-1,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,enemyStatus:e.enemyStatus,exitMetres:final.exit,exitSeconds:final.exit,originalsBefore:structuredClone(o.originalsAfter),originalsAfter:structuredClone(final.originals)};e.status=outcome==='PLAYER_DEAD'?'LOST':outcome==='RETREATED'?'RETREATED':'RESOLVED';s.combat=null;
  ctx.note('莱奥娜的相邻修理院冲突结束',`${final.exit?'本人沿普通出口走4米4秒。':'本人的原身体真实死亡。'}双方原灵性、精神、伤势与棍落点、三枚印记的实际消耗保留，没有复活或补发。维瑞娜、马库斯和旧人物保持原状；新镜片实际耗次与磨损、场地时钟、行程与精力已记账。`);
}
export const finishApocalypseDemonessEncounter=settleApocalypseDemonessEncounter;
export function apocalypseDemonessEncounterActions(s:SliceState){
  if(!isApocalypseDemonessEncounterStage(s))return[];
  const choices:{command:ApocalypseDemonessEncounterCommand;label:string;cost:string}[]=[
    {command:{type:'ENCOUNTER_TALK'},label:s.apocalypseDemoness.encounter.scene.knownEnemyName?'到庭院与莱奥娜交谈':'走近庭院中的独立对手',cost:'20便士新镜片、1行动、4米4秒；用尽行动仍可和平离开'},
    ...APOCALYPSE_DEMONESS_POLICIES.map(policy=>({command:{type:'ENCOUNTER_POLICY' as const,policy},label:({INHERITED_ONLY:'只用已学能力',PULSE_CONTAINMENT:'允许脉冲收束',MIRROR_BUFFER:'允许镜面缓冲',ALL:'允许两项新能力',ORDINARY:'只作普通行动'})[policy],cost:'0行动；开战前明确选择'})),
    {command:{type:'ENCOUNTER_FIGHT'},label:'自主承担真实冲突',cost:'1行动；真实伤势与死亡风险'},
    {command:{type:'LEAVE_ENCOUNTER'},label:'沿普通路和平离开',cost:'0行动、4米4秒'}];
  return choices.map(({command,label,cost})=>{const reason=blockApocalypseDemonessEncounter(s,command);return{id:`AD1-${command.type}${command.type==='ENCOUNTER_POLICY'?'-'+command.policy:''}`,command,label,cost,enabled:reason===null,reason,cleanup:command.type==='LEAVE_ENCOUNTER'};});
}
export const APOCALYPSE_DEMONESS_ENCOUNTER_STORY='一名43岁的独立成人在相邻修理院提出争议。本人、维瑞娜与马库斯须先实际离开原附室。购买一片新的三次战斗镜片，沿四米普通路到场，交谈并明确策略，再决定交战或和平离开。';
export function projectApocalypseDemonessScene(p: ApocalypseDemonessScene): ApocalypseDemonessScene {
  return { ...projectDemonessPublicFields(p, ['siteId', 'playerLocation', 'playerCoordinate', 'enemyCoordinate', 'ordinaryExit', 'visibleBodyLine', 'conditionVersion',
    'observedConditionVersion', 'thirdPartiesInArea', 'observedSourceId', 'observationWeek', 'clockSeconds', 'externalSeconds', 'playerTravelMetres', 'enemyTravelMetres', 'knownPlayerName', 'knownEnemyName']),
    presentMemberIds: [...p.presentMemberIds] };
}
export function projectApocalypseDemonessMaterials(m: ApocalypseDemonessMaterials): ApocalypseDemonessMaterials {
  return { weapon: projectDemonessPublicFields(m.weapon, ['id', 'sourceId', 'owner', 'massKg', 'location', 'condition', 'visible']),
    plate: m.plate ? projectDemonessPublicFields(m.plate, ['id', 'ownerId', 'quantity', 'location', 'initialCharges', 'charges', 'paidPennies', 'wear']) : null,
    marks: m.marks.map(a => projectDemonessPublicFields(a, ['id', 'owner', 'status', 'usedRound'])) };
}
export const projectApocalypseDemonessPendingSource = (p: ApocalypseDemonessPendingSource | null): ApocalypseDemonessPendingSource | null =>
  p ? projectDemonessPublicFields(p, ['id', 'markId', 'power', 'declaredAt', 'readyAt', 'declaredRound', 'declaredOrder', 'observed', 'conditionVersion', 'containmentUsed']) : null;
export const projectApocalypseDemonessPowerUses = (p: Record<ApocalypseDemonessPowerId, number>) =>
  ({ BODY_MARK: p.BODY_MARK, MENTAL_MARK: p.MENTAL_MARK, FEINT: p.FEINT });
export function projectApocalypseDemonessEncounter(s:SliceState){const e=s.apocalypseDemoness.encounter,known=e.scene.knownEnemyName!==null;return{title:known?'莱奥娜的相邻修理院争议':'相邻修理院中的独立对手',story:isApocalypseDemonessEncounterStage(s)?(known?'43岁的莱奥娜·布莱克以独立身体与精神自主行动，持自己的唯一原棍和三枚有限印记。伊瑞丝与旧人物仍保持其原结果。':APOCALYPSE_DEMONESS_ENCOUNTER_STORY):'',status:e.status,inside:hasApocalypseDemonessEncounterLock(s),policy:e.policy,policyConfirmed:e.journal.some(j=>j.command.type==='ENCOUNTER_POLICY'),scene:projectApocalypseDemonessScene(e.scene),materials:projectApocalypseDemonessMaterials(e.materials),
 enemy:{id:e.targetId,name:known?'莱奥娜·布莱克':null,age:known?43:null,sequence:known?1:null,health:e.enemyHealth,mind:e.enemyMind,spirituality:e.enemySpirituality,status:e.enemyStatus,weaponLocation:e.weaponLocation,powerUses:projectApocalypseDemonessPowerUses(e.powerUses),pendingSource:projectApocalypseDemonessPendingSource(e.pendingSource)},actions:apocalypseDemonessEncounterActions(s),facts:[
 '脉冲收束：8灵性2精神、知识18。借实际观察到且尚未释放的同一枚印记脉冲，20秒内辅助下一次普通打击30；不取消对方的后续攻击，不撤销已发生伤害。',
 '镜面缓冲：8灵性2精神、意志18。20秒内仅下一次可见身体冲击减势30，实耗新镜片一次并磨损5；不挡精神、不改旧伤。',
 '继承镜幕仍用6灵性、知识20，成功准备时实耗同一新镜片一次；下一实际身体冲击减势45，失败与到期不退款。两种防护只保留一个待用窗口，替换不退已耗次数。',
 '三枚印记共用有限库存。莱奥娜每次在原动作槽实付7灵性与一枚印记，蓄势15秒后占后续原槽释放身体75或精神65；声明槽没有攻击贡献。轮末未释放则消散，已耗资源不补。',
 '体25%、感30%、意30%、知15%；双方1至6动作10/15/25/25/15/10，基础1250、底125、灵性上限120，仅继续轮恢复12。',
 '每槽5秒，一轮60秒。身体与精神后果分开；生还者沿4米普通路退出，实际扣4精力。成人已在场外，不获得自动免疫。',
 `新战斗镜片余${e.materials.plate?.charges??0}/3、磨损${e.materials.plate?.wear??0}；旧CD2-COMBAT-PLATE留在原库存，余${s.calamityDemoness.encounter.plate?.charges??0}次，未复制或取用。`]};}
export type ApocalypseDemonessEncounterProjection=ReturnType<typeof projectApocalypseDemonessEncounter>;

/** Exact shared finance transition after a completed, unlocked action. Locked
 * READY/FIGHTING scenes never pay a bill or grant next-week actions early. */
export function apocalypseDemonessCompletedBudgetMatches(s:SliceState,expected:ApocalypseDemonessEncounterBudget,finance:ApocalypseDemonessFinanceSnapshot,week:number,date:PublicGameDate,revision:number,randomCursor:number,anchorTitle:string):boolean {
 const current=apocalypseDemonessEncounterBudget(s);
 if(!same({...current,cash:expected.cash,actions:expected.actions},expected)||s.random.cursor!==randomCursor)return false;
 const titles=['本周生活费','生活费如实记账','本周约定还款','账目结清','新的一周'];
 const receipts=s.chronicle.filter((entry,index)=>entry.id===`record-${s.revision}-${index}`&&titles.includes(entry.title));
 if(expected.actions>0||expected.health===0)return s.week===week&&same(s.date,date)&&s.actionsRemaining===expected.actions&&s.cash===expected.cash&&same(apocalypseDemonessFinanceSnapshot(s),finance)&&s.pulse==='NONE'&&s.billAmount===0&&s.activeEvent===null&&s.eventQueue.length===0&&receipts.length===0;
 if(expected.actions!==0||s.status!=='ACTIVE')return false;
 const result=resolveSliceWeeklyFinance({...finance,cash:expected.cash,week,revision:revision-1,pulse:'BILL',billAmount:0}),advanced=result.eventId===null&&result.state.pulse==='ADVANCE';
 const finalFinance={...finance,...result.state,weeklyBudget:finance.weeklyBudget,lifeTier:advanced?result.state.nextLifeTier:finance.lifeTier};
 if(s.cash!==result.state.cash||!same(apocalypseDemonessFinanceSnapshot(s),apocalypseDemonessFinanceSnapshot(finalFinance))||s.week!==week+(advanced?1:0)||!same(s.date,advanced?addGameWeeks(date,1):date)||s.actionsRemaining!==(advanced?finance.weeklyBudget:0)||s.pulse!==(advanced?'NONE':result.state.pulse)||s.billAmount!==(advanced?0:result.state.billAmount))return false;
 const expectedReceipts=result.receipts.map(receipt=>({week,...receipt}));if(advanced)expectedReceipts.push({week:week+1,title:'新的一周',text:`日期推进7天，本周${finance.weeklyBudget}次行动。`});
 if(!same(receipts.map(({week,title,text})=>({week,title,text})),expectedReceipts))return false;
 if(result.eventId){const anchor=s.chronicle.findIndex((entry,index)=>entry.id===`record-${s.revision}-${index}`&&entry.title===anchorTitle),eventIndex=anchor+1+result.receipts.length;return anchor>=0&&s.eventQueue.length===0&&same(s.activeEvent,{id:result.eventId,instanceId:`${s.runId}:${result.eventId}:${s.revision}:${eventIndex}`});}
 return s.activeEvent===null&&s.eventQueue.length===0;
}
export function apocalypseDemonessTerminalBudgetMatches(s:SliceState,_prep:ApocalypseDemonessPreparation,o:ApocalypseDemonessRoundOutcome):boolean {
 const fight=s.apocalypseDemoness.encounter.journal.find(j=>j.command.type==='ENCOUNTER_FIGHT');if(!fight)return false;
 const expected={...fight.after,health:o.playerHealthAfter,mind:o.playerMindAfter,spirituality:o.playerSpiritualityAfter,mastery:o.masteryAfter,injuries:o.playerInjuriesAfter,injuryRisk:o.playerRiskAfter};
 return same(s.apocalypseDemoness.encounter.scene,terminalScene(o).root)&&same(s.apocalypseDemoness.encounter.materials,terminalScene(o).materials)&&same(apocalypseDemonessOriginalSnapshot(s),terminalScene(o).originals)&&apocalypseDemonessCompletedBudgetMatches(s,expected,fight.finance,fight.week,fight.date,o.source.revision+1,o.randomCursorAfter,'莱奥娜的相邻修理院冲突结束');
}
function peacefulBudgetMatches(s:SliceState,e:ApocalypseDemonessEncounterJournal):boolean{return e.command.type==='LEAVE_ENCOUNTER'&&apocalypseDemonessCompletedBudgetMatches(s,e.after,e.finance,e.week,e.date,e.revision,e.randomCursor,'沿普通路和平离开相邻修理院');}
export function replayApocalypseDemonessPurchases(s:SliceState):ApocalypseDemonessMaterials|null { return Array.isArray(s.apocalypseDemoness.encounter.purchases)&&s.apocalypseDemoness.encounter.purchases.length===0?createApocalypseDemonessMaterials():null; }
/** Exact root and source-chain replay. Historical rounds are immutable; a later
 * ordinary rest may change the live player but cannot alter a recorded fight. */
export function replayApocalypseDemonessEncounterRoot(s:SliceState):ApocalypseDemonessScene|null {
 try{
  const e=s.apocalypseDemoness.encounter,initial=createApocalypseDemonessEncounterState(),allNew=s.combatHistory.flatMap((r,i)=>r.apocalypseDemonessOutcome?[i]:[]),purchased=replayApocalypseDemonessPurchases(s);
  if(!e||!shape(e,Object.keys(initial))||!['AVAILABLE','READY','FIGHTING','RESOLVED','RETREATED','LOST'].includes(e.status)||e.targetId!==initial.targetId||!['INHERITED_ONLY','PULSE_CONTAINMENT','MIRROR_BUFFER','ALL','ORDINARY'].includes(e.policy)||!validApocalypseDemonessBody(e)||!validApocalypseDemonessScene(e.scene)||!validApocalypseDemonessMaterials(e.materials)||e.weaponLocation!==e.materials.weapon.location||!purchased)return null;
  if(!e.preparation)return same({...e,purchases:[],materials:createApocalypseDemonessMaterials()},initial)&&same(e.materials,purchased)&&allNew.length===0&&s.combat?.encounterId!=='APOCALYPSE_DEMONESS_DISPUTE'?createApocalypseDemonessScene():null;
  const prep=e.preparation;
  if(!isApocalypseDemonessEncounterStage(s)||s.apocalypseDemoness.promotionWeek===null||!s.apocalypseDemoness.life.reflected||!validateApocalypseDemonessPreparation(prep)||prep.runId!==s.runId||prep.playerName!==s.character.name||prep.randomSeed!==s.random.seed||prep.randomCursor>s.random.cursor||!integer(prep.week,s.apocalypseDemoness.promotionWeek,s.week)||compareGameDates(prep.date,s.date)>0||!integer(prep.revision,1,s.revision)||!historyUnchanged(s)||typeof e.originalResources!=='string'||!e.originalResources||!Array.isArray(e.journal)||!same(prep.materialsBefore,purchased))return null;
  let policyChosen=false,root=arrive(s,prep),status:ApocalypseDemonessEncounterState['status']='READY',policy:ApocalypseDemonessPolicy='INHERITED_ONLY',materials=structuredClone(prep.materialsAfter);
  let budget=prep.after,finance=prep.finance,week=prep.week,date=prep.date,revision=prep.revision,originals=structuredClone(prep.originalsAfter);
  for(const entry of e.journal){
   if(!shape(entry,['command','week','date','revision','randomCursor','before','after','finance','sceneBefore','sceneAfter','materialsBefore','materialsAfter','originalsBefore','originalsAfter'])||!validateApocalypseDemonessEncounterCommand(entry.command)||!['ENCOUNTER_POLICY','ENCOUNTER_FIGHT','LEAVE_ENCOUNTER'].includes(entry.command.type)||!validBudget(entry.before,entry.revision)||!validBudget(entry.after,entry.revision)||!validateApocalypseDemonessFinanceSnapshot(entry.finance,entry.week)||!integer(entry.revision,revision+1,s.revision)||entry.randomCursor!==prep.randomCursor||!same(entry.sceneBefore,root)||!same(entry.materialsBefore,materials)||!same(entry.originalsBefore,originals)||status!=='READY'||entry.week!==week||!same(entry.date,date)||!same(entry.before,budget)||!same(entry.finance,finance))return null;
   if(entry.command.type==='ENCOUNTER_POLICY'){if(policyChosen&&entry.command.policy===policy)return null;policy=entry.command.policy;policyChosen=true;}
   else if(entry.command.type==='ENCOUNTER_FIGHT'){if(!policyChosen||root.playerLocation!=='YARD'||entry.before.actions<1)return null;status='FIGHTING';}
   else{leaveApocalypseDemonessCombatScene(root);originals=walkOriginals(originals,4);status='RESOLVED';}
   if(!same(entry.after,{...entry.before,actions:entry.before.actions-(entry.command.type==='ENCOUNTER_FIGHT'?1:0)})||!same(entry.sceneAfter,root)||!same(entry.materialsAfter,materials)||!same(entry.originalsAfter,originals))return null;
   budget=entry.after;finance=entry.finance;week=entry.week;date=entry.date;revision=entry.revision;
  }
  if(e.policy!==policy)return null;
  if(status!=='FIGHTING'){
   if(e.status!==status||e.startHistoryIndex!==null||e.startSource!==null||e.attemptWeek!==null||e.terminal!==null||!same(combatBody(e),initialApocalypseDemonessBody())||!same(e.materials,materials)||allNew.length||s.combat?.encounterId==='APOCALYPSE_DEMONESS_DISPUTE')return null;
   if(status==='READY'||s.revision===revision){
    if(!originalsUnchanged(s)||!adultsAbsent(s))return null;
    if(status==='READY'){if(!same(apocalypseDemonessEncounterBudget(s),budget)||!same(apocalypseDemonessFinanceSnapshot(s),finance)||s.week!==week||!same(s.date,date)||s.random.cursor!==prep.randomCursor||s.pulse!=='NONE'||s.billAmount!==0||s.activeEvent||s.eventQueue.length)return null;}
    else if(!e.journal.at(-1)||!peacefulBudgetMatches(s,e.journal.at(-1)!))return null;
   }
   return root;
  }
  const start=e.startSource;
  if(!start||!validApocalypseDemonessCombatSource(start)||!integer(e.startHistoryIndex,0,s.combatHistory.length)||e.startHistoryIndex!==e.originalHistory!.length||e.attemptWeek!==week||start.round!==1||start.revision!==revision||start.week!==week||!same(start.date,date)||start.startHistoryIndex!==e.startHistoryIndex||start.runId!==s.runId||!same(start.preparation,prep)||start.policy!==policy||!same(start.body,initialApocalypseDemonessBody())||!same(start.root,root)||!same(start.materials,materials)||!same(start.originals,originals)||start.randomSeed!==s.random.seed||start.randomCursor!==prep.randomCursor||start.playerHealth!==budget.health||start.playerMind!==budget.mind||start.playerSpirituality!==budget.spirituality||!same(start.mastery,budget.mastery)||!same(start.playerInjuries,budget.injuries)||start.playerRisk!==budget.injuryRisk)return null;
  const terminal=e.terminal;
  if(terminal&&(!shape(terminal,['outcome','round','historyIndex','enemyHealth','enemyMind','enemySpirituality','enemyStatus','exitMetres','exitSeconds','originalsBefore','originalsAfter'])||!integer(terminal.historyIndex,e.startHistoryIndex,s.combatHistory.length-1)))return null;
  const end=terminal?terminal.historyIndex+1:s.combatHistory.length,rounds=s.combatHistory.slice(e.startHistoryIndex,end);
  if(!same(allNew,rounds.map((_r,i)=>e.startHistoryIndex!+i)))return null;
  for(const[i,round]of rounds.entries()){const o=round.apocalypseDemonessOutcome,previous=rounds[i-1]?.apocalypseDemonessOutcome;if(!o||!validateApocalypseDemonessCombatRound(round)||round.round!==i+1||o.source.revision>=s.revision||o.randomCursorAfter>s.random.cursor||!same(o.source,previous?nextApocalypseDemonessCombatSource(previous):start)||!same(o.source.root,root)||!same(o.source.originals,originals)||i<rounds.length-1&&!o.continuing)return null;root=structuredClone(o.rootAfter);materials=structuredClone(o.materialsAfter);originals=structuredClone(o.originalsAfter);}
  const last=rounds.at(-1),o=last?.apocalypseDemonessOutcome;
  if(e.status==='FIGHTING'){
   if(terminal||!hasApocalypseDemonessDisputeOpponent(s)||!same(combatBody(e),o?combatBody(o):start.body)||!same(e.materials,materials))return null;
   const current=apocalypseDemonessEncounterBudget(s),expected={...budget,health:o?.playerHealthAfter??start.playerHealth,mind:o?.playerMindAfter??start.playerMind,spirituality:o?Math.min(120,o.playerSpiritualityAfter+12):start.playerSpirituality,mastery:o?.masteryAfter??start.mastery,injuries:o?.playerInjuriesAfter??start.playerInjuries,injuryRisk:o?.playerRiskAfter??start.playerRisk};
   if(!same(current,expected)||!same(apocalypseDemonessFinanceSnapshot(s),finance)||s.week!==week||!same(s.date,date)||s.pulse!=='NONE'||s.billAmount!==0||s.activeEvent!==null||s.eventQueue.length)return null;
   return o?o.continuing&&same(last,s.combat!.lastRound)&&same(currentApocalypseDemonessCombatSource(s),nextApocalypseDemonessCombatSource(o))?root:null:s.combat!.lastRound===null&&same(currentApocalypseDemonessCombatSource(s),start)?root:null;
  }
  if(s.combat?.encounterId==='APOCALYPSE_DEMONESS_DISPUTE'||!terminal||!last||!o||o.continuing||terminal.round!==last.round||rounds.length!==terminal.round||!same(combatBody(e),combatBody(o))||terminal.enemyHealth!==e.enemyHealth||terminal.enemyMind!==e.enemyMind||terminal.enemySpirituality!==e.enemySpirituality||terminal.enemyStatus!==e.enemyStatus)return null;
  const final=terminalScene(o);if(terminal.exitMetres!==final.exit||terminal.exitSeconds!==final.exit||!same(terminal.originalsBefore,o.originalsAfter)||!same(terminal.originalsAfter,final.originals)||!same(e.materials,final.materials))return null;
  if(s.revision===o.source.revision+1&&(!originalsUnchanged(s)||!apocalypseDemonessTerminalBudgetMatches(s,prep,o)))return null;
  if(terminal.outcome==='PLAYER_DEAD')return e.status==='LOST'&&s.status==='DEAD'&&o.playerHealthAfter===0?final.root:null;
  if(terminal.outcome==='RETREATED')return e.status==='RETREATED'&&o.playerHealthAfter>0&&(last.retreat==='SUCCESS'||o.playerMindAfter===0)?final.root:null;
  return e.status==='RESOLVED'&&o.playerHealthAfter>0&&(terminal.outcome==='ENEMY_DEAD'?e.enemyStatus==='DEAD':terminal.outcome==='ENEMY_SURRENDERED'&&e.enemyStatus==='SURRENDERED')?final.root:null;
 }catch{return null;}
}
export function validateApocalypseDemonessEncounter(s:SliceState):boolean {try{const root=replayApocalypseDemonessEncounterRoot(s);return root!==null&&same(root,s.apocalypseDemoness.encounter.scene);}catch{return false;}}
export const validateApocalypseDemonessEncounterState=validateApocalypseDemonessEncounter;
/** The same original body, player travel, clock and energy form an exact event
 * chain. The final round and physical exit share one public revision. This is a
 * projection only: encounter replay authenticates every value without invoking
 * life replay, so the shared resource ledger has no validation recursion. */
export function apocalypseDemonessEncounterOriginalEvents(s:SliceState):{revision:number;week:number;before:ApocalypseDemonessCombatOriginals;after:ApocalypseDemonessCombatOriginals}[]{
 const e=s.apocalypseDemoness.encounter;if(!e.preparation)return[];
 const events=[{revision:e.preparation.revision,week:e.preparation.week,before:structuredClone(e.preparation.originalsBefore),after:structuredClone(e.preparation.originalsAfter)},...e.journal.map(j=>({revision:j.revision,week:j.week,before:structuredClone(j.originalsBefore),after:structuredClone(j.originalsAfter)}))];
 if(e.startHistoryIndex!==null){const end=e.terminal?e.terminal.historyIndex+1:s.combatHistory.length;for(const round of s.combatHistory.slice(e.startHistoryIndex,end)){const o=round.apocalypseDemonessOutcome;if(!o)continue;events.push({revision:o.source.revision+1,week:o.source.week,before:structuredClone(o.source.originals),after:structuredClone(e.terminal?.round===o.round?e.terminal.originalsAfter:o.originalsAfter)});}}
 return events.sort((a,b)=>a.revision-b.revision);
}
