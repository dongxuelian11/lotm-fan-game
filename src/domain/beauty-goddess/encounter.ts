import { SLICE_LIFE } from '../../content/slice-events.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { addGameWeeks, compareGameDates, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceCombatRound, SliceInjury, SliceState } from '../slice/types.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { getSummoningMasterPartner, type SummoningMasterPartner } from '../summoning-master/life.js';
import { validateLifeGiverBead, type LifeGiverBead } from '../life-giver/life.js';
import type { WitchKingPaper } from '../witch-king/life.js';
import { validateLifeGiverPapers, validateLifeGiverPartner } from '../life-giver/combat.js';
import { hasBeautyGoddessLifeLock, beautyGoddessLifeAdultsAbsent } from './life.js';
import { currentBeautyGoddessCombatSource, nextBeautyGoddessCombatSource, validBeautyGoddessCombatSource, validateBeautyGoddessCombatRound,
  validBeautyGoddessBody, validBeautyGoddessInjuries, type BeautyGoddessCombatSource, type BeautyGoddessRoundOutcome } from './combat.js';

export const BEAUTY_GODDESS_TARGET_ID = 'BG1-OSWALD-REED' as const;
export const BEAUTY_GODDESS_SITE = 'BG1-OPEN-STONE-COURT' as const;
export const BEAUTY_GODDESS_POWER_IDS = ['MOON_BOLT', 'MIND_PRESSURE', 'WARD', 'ATTENTION', 'SHADE'] as const;
export type BeautyGoddessPowerId = typeof BEAUTY_GODDESS_POWER_IDS[number];
export type BeautyGoddessEnemyIntent = BeautyGoddessPowerId | 'BODY_STRIKE' | 'OBSERVE' | 'ACCIDENT';
export type BeautyGoddessPolicy = 'INHERITED_ONLY' | 'SELF_POISE' | 'BOUNDED_MOONFORM' | 'ALL' | 'ORDINARY';
export const BEAUTY_GODDESS_POWERS = [
  { id: 'MOON_BOLT', label: '可见月光冲击', cost: 7, selfGain: 105, enemyReduction: 0 },
  { id: 'MIND_PRESSURE', label: '有限精神压力', cost: 7, selfGain: 70, enemyReduction: 0 },
  { id: 'WARD', label: '有限护持', cost: 6, selfGain: 0, enemyReduction: 60 },
  { id: 'ATTENTION', label: '集中精神抵抗', cost: 3, selfGain: 0, enemyReduction: 0 },
  { id: 'SHADE', label: '遮住战场灯罩', cost: 4, selfGain: 0, enemyReduction: 0 },
] as const;
export interface BeautyGoddessBattlePiece {
  id: string; sourceId: string; owner: 'PLAYER'; paidPennies: 70; purchasedWeek: number;
  status: 'READY' | 'SPENT'; location: 'PLAYER' | 'YARD' | 'RETURN_TRAY'; spentWeek: number | null; combatRound: number | null;
}
export interface BeautyGoddessMaterials {
  weapon: { id: 'BG1-OSWALD-ROD'; sourceId: 'BG1-OSWALD-OWNED-ROD-1'; owner: typeof BEAUTY_GODDESS_TARGET_ID;
    massKg: 2; location: 'HAND' | 'YARD'; condition: 100; charge: number; capacity: 4; visible: true };
  lamp: null | { id: 'BG1-BATTLE-LAMP'; sourceId: 'BG1-BATTLE-LAMP-SHOP-1'; owner: 'PLAYER'; paidPennies: 40; purchasedWeek: number;
    location: 'PLAYER' | 'YARD' | 'RETURN_TRAY'; fuelSeconds: number; capacitySeconds: 180; lit: boolean; blocked: boolean };
  pieces: BeautyGoddessBattlePiece[];
}
export function createBeautyGoddessMaterials(): BeautyGoddessMaterials {
  return { weapon: { id: 'BG1-OSWALD-ROD', sourceId: 'BG1-OSWALD-OWNED-ROD-1', owner: BEAUTY_GODDESS_TARGET_ID,
    massKg: 2, location: 'HAND', condition: 100, charge: 4, capacity: 4, visible: true }, lamp: null, pieces: [] };
}
export interface BeautyGoddessScene {
  siteId: typeof BEAUTY_GODDESS_SITE; playerLocation: 'OUTSIDE' | 'YARD'; playerCoordinate: 0 | 4; enemyCoordinate: 6;
  ordinaryExit: 'OPEN'; thirdPartiesInArea: 0; presentMemberIds: string[]; observedSourceId: string | null; observationWeek: number | null;
  clockSeconds: number; externalSeconds: number; playerTravelMetres: number; knownPlayerName: string | null; knownEnemyName: string | null;
}
export function createBeautyGoddessScene(): BeautyGoddessScene {
  return { siteId: BEAUTY_GODDESS_SITE, playerLocation: 'OUTSIDE', playerCoordinate: 0, enemyCoordinate: 6, ordinaryExit: 'OPEN', thirdPartiesInArea: 0,
    presentMemberIds: [], observedSourceId: null, observationWeek: null, clockSeconds: 0, externalSeconds: 0, playerTravelMetres: 0, knownPlayerName: null, knownEnemyName: null };
}
export interface BeautyGoddessCombatBody {
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  weaponLocation: 'HAND' | 'YARD'; powerUses: Record<BeautyGoddessPowerId, number>;
  totalOwnerMindSpent: number; selfPoiseAttempts: number; selfPoiseSuccesses: number; moonformAttempts: number; moonformSuccesses: number;
}
export function initialBeautyGoddessBody(): BeautyGoddessCombatBody {
  return { enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0, weaponLocation: 'HAND',
    powerUses: { MOON_BOLT: 0, MIND_PRESSURE: 0, WARD: 0, ATTENTION: 0, SHADE: 0 }, totalOwnerMindSpent: 0,
    selfPoiseAttempts: 0, selfPoiseSuccesses: 0, moonformAttempts: 0, moonformSuccesses: 0 };
}
export function combatBody(e: BeautyGoddessCombatBody): BeautyGoddessCombatBody {
  return Object.fromEntries(Object.keys(initialBeautyGoddessBody()).map(k => [k, structuredClone(e[k as keyof BeautyGoddessCombatBody])])) as unknown as BeautyGoddessCombatBody;
}
export type BeautyGoddessFinanceSnapshot = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface BeautyGoddessEncounterBudget {
  cash: number; actions: number; health: number; mind: number; spirituality: number; pollution: number; gender: string; sequence: 1;
  acting: number; coreStats: SliceState['character']['coreStats']; mastery: Record<string, number>; completedSources: string[]; injuries: SliceInjury[]; injuryRisk: number;
}
export interface BeautyGoddessPreparation {
  week: number; date: PublicGameDate; revision: number; runId: string; randomSeed: string; randomCursor: number; pricePaid: 0; actionsPaid: 1;
  lifeReflected: true; playerName: string; playerClubHeld: boolean; before: BeautyGoddessEncounterBudget; after: BeautyGoddessEncounterBudget;
  finance: BeautyGoddessFinanceSnapshot; papers: WitchKingPaper[]; partner: SummoningMasterPartner; oldBeads: LifeGiverBead[]; materialsBefore: BeautyGoddessMaterials; materialsAfter: BeautyGoddessMaterials;
}
export type BeautyGoddessPurchaseCommand = { type: 'BUY_BATTLE_LAMP' } | { type: 'PREPARE_BATTLE_PIECE' };
export type BeautyGoddessEncounterCommand = BeautyGoddessPurchaseCommand | { type: 'ENCOUNTER_TALK' } | { type: 'ENCOUNTER_FIGHT' } | { type: 'LEAVE_ENCOUNTER' } | { type: 'ENCOUNTER_POLICY'; policy: BeautyGoddessPolicy };
export interface BeautyGoddessPurchase {
  command: BeautyGoddessPurchaseCommand; week: number; date: PublicGameDate; revision: number; runId: string; randomSeed: string; randomCursor: number;
  before: BeautyGoddessEncounterBudget; after: BeautyGoddessEncounterBudget; finance: BeautyGoddessFinanceSnapshot; materialsBefore: BeautyGoddessMaterials; materialsAfter: BeautyGoddessMaterials;
}
export interface BeautyGoddessEncounterJournal {
  command: Exclude<BeautyGoddessEncounterCommand, BeautyGoddessPurchaseCommand | { type: 'ENCOUNTER_TALK' }>; week: number; date: PublicGameDate; revision: number; randomCursor: number;
  before: BeautyGoddessEncounterBudget; after: BeautyGoddessEncounterBudget; finance: BeautyGoddessFinanceSnapshot; sceneBefore: BeautyGoddessScene; sceneAfter: BeautyGoddessScene; materialsBefore: BeautyGoddessMaterials; materialsAfter: BeautyGoddessMaterials;
}
export interface BeautyGoddessEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: BeautyGoddessCombatBody['enemyStatus']; exitMetres: 0 | 4; exitSeconds: 0 | 4;
}
export interface BeautyGoddessEncounterState extends BeautyGoddessCombatBody {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof BEAUTY_GODDESS_TARGET_ID; policy: BeautyGoddessPolicy;
  preparation: BeautyGoddessPreparation | null; purchases: BeautyGoddessPurchase[]; attemptWeek: number | null; startHistoryIndex: number | null; startSource: BeautyGoddessCombatSource | null;
  originalHistory: SliceCombatRound[] | null; originalResources: string | null; scene: BeautyGoddessScene; materials: BeautyGoddessMaterials; journal: BeautyGoddessEncounterJournal[]; terminal: BeautyGoddessEncounterTerminal | null;
}
export function createBeautyGoddessEncounterState(): BeautyGoddessEncounterState {
  return { ...initialBeautyGoddessBody(), status: 'AVAILABLE', targetId: BEAUTY_GODDESS_TARGET_ID, policy: 'INHERITED_ONLY', preparation: null, purchases: [], attemptWeek: null, startHistoryIndex: null,
    startSource: null, originalHistory: null, originalResources: null, scene: createBeautyGoddessScene(), materials: createBeautyGoddessMaterials(), journal: [], terminal: null };
}
export const createBeautyGoddessEncounter = createBeautyGoddessEncounterState;
export const isBeautyGoddessEncounterStage = (s: SliceState) => s.progression.pathwayId === 'moon' && s.progression.sequence === 1;
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
export function beautyGoddessFinanceSnapshot(s: BeautyGoddessFinanceSnapshot): BeautyGoddessFinanceSnapshot {
  return { weeklyBudget: s.weeklyBudget, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: structuredClone(s.debts), missedWeeks: s.missedWeeks, credit: s.credit };
}
function validFinance(v: BeautyGoddessFinanceSnapshot, week: number): boolean {
  return shape(v, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit']) && integer(v.weeklyBudget, 1, 100) && Object.hasOwn(SLICE_LIFE, v.lifeTier) && Object.hasOwn(SLICE_LIFE, v.nextLifeTier) &&
    integer(v.missedWeeks) && ['NORMAL', 'NOTICE', 'SUSPENDED'].includes(v.credit) && Array.isArray(v.debts) && v.debts.every(d => shape(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek']) &&
      typeof d.id === 'string' && !!d.id && typeof d.source === 'string' && !!d.source && integer(d.remaining) && integer(d.weeklyPayment, 1) && integer(d.createdWeek, 0, week));
}
export function beautyGoddessEncounterBudget(s: SliceState): BeautyGoddessEncounterBudget {
  return { cash: s.cash, actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution, gender: s.character.gender,
    sequence: 1, acting: s.progression.acting, coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources], injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function validBudget(v: BeautyGoddessEncounterBudget, revision: number): boolean {
  return shape(v, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) && integer(v.cash) &&
    integer(v.actions, 0, 100) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.pollution, 0, 100) && typeof v.gender === 'string' && v.sequence === 1 && integer(v.acting, 0, 100) &&
    shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) && Object.values(v.coreStats).every(n => integer(n, 0, 500)) && !!v.mastery && typeof v.mastery === 'object' && !Array.isArray(v.mastery) && Object.values(v.mastery).every(n => integer(n, 0, 500)) &&
    Array.isArray(v.completedSources) && v.completedSources.every(x => typeof x === 'string' && !!x) && new Set(v.completedSources).size === v.completedSources.length && validBeautyGoddessInjuries(v.injuries, revision) && integer(v.injuryRisk);
}
export function validBeautyGoddessMaterials(v: BeautyGoddessMaterials): boolean {
  try { const initial = createBeautyGoddessMaterials(), w = v.weapon, l = v.lamp;
    return shape(v, ['weapon','lamp','pieces']) && shape(w, Object.keys(initial.weapon)) && ['HAND','YARD'].includes(w.location) && integer(w.charge,0,4) && same({...w,location:'HAND',charge:4},initial.weapon) &&
      (l === null || shape(l,['id','sourceId','owner','paidPennies','purchasedWeek','location','fuelSeconds','capacitySeconds','lit','blocked']) && l.id==='BG1-BATTLE-LAMP' && l.sourceId==='BG1-BATTLE-LAMP-SHOP-1' && l.owner==='PLAYER' && l.paidPennies===40 && integer(l.purchasedWeek,1) && ['PLAYER','YARD','RETURN_TRAY'].includes(l.location) && integer(l.fuelSeconds,0,180) && l.capacitySeconds===180 && typeof l.lit==='boolean' && typeof l.blocked==='boolean' && (!l.lit || l.fuelSeconds>0 && l.location==='YARD')) &&
      Array.isArray(v.pieces) && v.pieces.length<=3 && v.pieces.every((q,i)=>shape(q,['id','sourceId','owner','paidPennies','purchasedWeek','status','location','spentWeek','combatRound']) && q.id===`BG1-BATTLE-MOON-PIECE-${i+1}` && q.sourceId===`BG1-BATTLE-SHOP-PIECE-${i+1}` && q.owner==='PLAYER' && q.paidPennies===70 && integer(q.purchasedWeek,1) && ['PLAYER','YARD','RETURN_TRAY'].includes(q.location) &&
        (q.status==='READY' ? q.spentWeek===null&&q.combatRound===null : q.status==='SPENT'&&integer(q.spentWeek,q.purchasedWeek)&&integer(q.combatRound,1)));
  } catch { return false; }
}
export function advanceBeautyGoddessLamp(materials: BeautyGoddessMaterials, seconds: number): void {
  const lamp=materials.lamp; if(lamp?.lit){lamp.fuelSeconds=Math.max(0,lamp.fuelSeconds-seconds);if(lamp.fuelSeconds===0)lamp.lit=false;}
}
function purchaseMaterials(before: BeautyGoddessMaterials, c: BeautyGoddessPurchaseCommand, week: number): BeautyGoddessMaterials {
  const m=structuredClone(before);
  if(c.type==='BUY_BATTLE_LAMP'){if(m.lamp)throw new Error('同一灯不能重复购买或补油。');m.lamp={id:'BG1-BATTLE-LAMP',sourceId:'BG1-BATTLE-LAMP-SHOP-1',owner:'PLAYER',paidPennies:40,purchasedWeek:week,location:'PLAYER',fuelSeconds:180,capacitySeconds:180,lit:false,blocked:false};}
  else {if(m.pieces.length>=3)throw new Error('本场最多三枚实付月片。');const n=m.pieces.length+1;m.pieces.push({id:`BG1-BATTLE-MOON-PIECE-${n}`,sourceId:`BG1-BATTLE-SHOP-PIECE-${n}`,owner:'PLAYER',paidPennies:70,purchasedWeek:week,status:'READY',location:'PLAYER',spentWeek:null,combatRound:null});}
  return m;
}
function arrivalMaterials(before: BeautyGoddessMaterials): BeautyGoddessMaterials {
  const m=structuredClone(before);if(m.lamp){m.lamp.location='YARD';m.lamp.lit=m.lamp.fuelSeconds>0;}for(const p of m.pieces)p.location='YARD';advanceBeautyGoddessLamp(m,4);return m;
}
function returnMaterials(m: BeautyGoddessMaterials, alive: boolean): void {
  if(m.lamp){m.lamp.lit=false;if(alive)m.lamp.location='RETURN_TRAY';}if(alive)for(const p of m.pieces)p.location='RETURN_TRAY';
}
export function validateBeautyGoddessPreparation(v: unknown): v is BeautyGoddessPreparation {
  try { const p=v as BeautyGoddessPreparation; return shape(p,['week','date','revision','runId','randomSeed','randomCursor','pricePaid','actionsPaid','lifeReflected','playerName','playerClubHeld','before','after','finance','papers','partner','oldBeads','materialsBefore','materialsAfter']) &&
    integer(p.week,1)&&isValidGameDate(p.date)&&integer(p.revision,1)&&typeof p.runId==='string'&&!!p.runId&&typeof p.randomSeed==='string'&&!!p.randomSeed&&integer(p.randomCursor)&&typeof p.playerClubHeld==='boolean'&&typeof p.playerName==='string'&&!!p.playerName.trim()&&p.pricePaid===0&&p.actionsPaid===1&&p.lifeReflected===true&&
    validBudget(p.before,p.revision)&&validBudget(p.after,p.revision)&&validFinance(p.finance,p.week)&&p.before.actions>=2&&p.before.actions<=Math.max(4,p.finance.weeklyBudget)&&same(p.after,{...p.before,actions:p.before.actions-1})&&validateLifeGiverPapers(p.papers,p.week)&&validateLifeGiverPartner(p.partner,p.week)&&p.partner.location==='HOME'&&Array.isArray(p.oldBeads)&&p.oldBeads.every(b=>validateLifeGiverBead(b,p.week))&&
    validBeautyGoddessMaterials(p.materialsBefore)&&validBeautyGoddessMaterials(p.materialsAfter)&&same(p.materialsAfter,arrivalMaterials(p.materialsBefore));
  }catch{return false;}
}
export function validBeautyGoddessScene(p: BeautyGoddessScene): boolean {
  const initial=createBeautyGoddessScene(); return shape(p,Object.keys(initial))&&same({...p,playerLocation:initial.playerLocation,playerCoordinate:initial.playerCoordinate,observedSourceId:null,observationWeek:null,clockSeconds:0,externalSeconds:0,playerTravelMetres:0,knownPlayerName:null,knownEnemyName:null},initial)&&
    (p.playerLocation==='OUTSIDE'&&p.playerCoordinate===0||p.playerLocation==='YARD'&&p.playerCoordinate===4)&&integer(p.clockSeconds)&&p.externalSeconds===p.clockSeconds&&integer(p.playerTravelMetres)&&
    (p.observedSourceId===null?p.observationWeek===null&&p.knownPlayerName===null&&p.knownEnemyName===null:typeof p.observedSourceId==='string'&&integer(p.observationWeek,1)&&typeof p.knownPlayerName==='string'&&!!p.knownPlayerName.trim()&&p.knownEnemyName==='奥斯瓦尔德·里德');
}
function protectedOriginals(s: SliceState): string {
  const witchKing=structuredClone(s.witchKing);witchKing.life.papers=[];
  return stableStringify({apothecary:s.apothecary,tamer:s.tamer,vampire:s.vampire,potionProfessor:s.potionProfessor,crimsonScholar:s.crimsonScholar,witchKing,summoningMaster:s.summoningMaster,lifeGiver:s.lifeGiver,town:s.town,life:s.beautyGoddess.life});
}
function adultsAbsent(s: SliceState): boolean {return !hasBeautyGoddessLifeLock(s)&&s.beautyGoddess.life.reflected&&beautyGoddessLifeAdultsAbsent(s)&&getSummoningMasterPartner(s).location==='HOME';}
function historyUnchanged(s: SliceState): boolean {const e=s.beautyGoddess.encounter;return Array.isArray(e.originalHistory)&&same(e.originalHistory,s.combatHistory.slice(0,e.originalHistory.length));}
function originalsUnchanged(s: SliceState): boolean {return s.beautyGoddess.encounter.originalResources===protectedOriginals(s)&&historyUnchanged(s);}
export function validateBeautyGoddessEncounterCommand(v:unknown):v is BeautyGoddessEncounterCommand {if(!v||typeof v!=='object'||Array.isArray(v))return false;const c=v as BeautyGoddessEncounterCommand;return c.type==='ENCOUNTER_POLICY'?shape(c,['type','policy'])&&['INHERITED_ONLY','SELF_POISE','BOUNDED_MOONFORM','ALL','ORDINARY'].includes(c.policy):shape(c,['type'])&&['BUY_BATTLE_LAMP','PREPARE_BATTLE_PIECE','ENCOUNTER_TALK','ENCOUNTER_FIGHT','LEAVE_ENCOUNTER'].includes(c.type);}
export const isBeautyGoddessEncounterCommand=validateBeautyGoddessEncounterCommand;
export const hasBeautyGoddessEncounterLock=(s:SliceState):boolean=>['READY','FIGHTING'].includes(s.beautyGoddess.encounter.status);
export const isInsideBeautyGoddessEncounter=hasBeautyGoddessEncounterLock;
export function blockBeautyGoddessEncounter(s:SliceState,c:BeautyGoddessEncounterCommand):string|null {
  if(!validateBeautyGoddessEncounterCommand(c))return'遭遇命令无效。';const e=s.beautyGoddess.encounter;
  if(!isBeautyGoddessEncounterStage(s)||s.beautyGoddess.promotionWeek===null||s.status!=='ACTIVE'||s.health<=0)return'须本人仍活着并完成美神晋升。';
  if(s.combat)return'先处理当前真实战斗。';if(!adultsAbsent(s))return'先收束三项生活实践，让流灯留在原家、达莉娅离开战场。';if(s.world.city!=='BACKLUND')return'须实际在贝克兰德石院。';
  if(c.type==='LEAVE_ENCOUNTER')return e.status==='READY'&&originalsUnchanged(s)?null:'须已亲自到场，才能普通离开。';
  if(s.activeEvent||s.eventQueue.length||s.pulse!=='NONE')return'先处理当前事件或周账。';if(s.mind<=0)return'需要清醒；到场后仍可普通退出。';
  if(c.type==='BUY_BATTLE_LAMP'||c.type==='PREPARE_BATTLE_PIECE'){
    if(e.status!=='AVAILABLE'||e.preparation)return'须在到场前准备；战场内不能补货。';if(s.actionsRemaining<1)return'需要1行动。';
    if(c.type==='BUY_BATTLE_LAMP'&&e.materials.lamp)return'本场唯一战场灯已经购买，不能添油或重新发放。';if(c.type==='PREPARE_BATTLE_PIECE'&&e.materials.pieces.length>=3)return'本场最多三枚独立实付月片，用尽后仍保留原物。';return s.cash>=(c.type==='BUY_BATTLE_LAMP'?40:70)?null:'现钱不足以支付实际原物。';
  }
  if(c.type==='ENCOUNTER_TALK')return e.status!=='AVAILABLE'||e.preparation?'同一奥斯瓦尔德的争议不能重置。':s.actionsRemaining<2?'到场需1行动，另留1行动供明确决定开战。':null;
  if(e.status!=='READY'||!e.preparation||!originalsUnchanged(s))return'须先亲自交谈并保留同一原人原物和旧记录。';
  if(c.type==='ENCOUNTER_POLICY')return c.policy===e.policy&&e.journal.some(j=>j.command.type==='ENCOUNTER_POLICY')?'已经采用这项策略。':null;
  if(!e.journal.some(j=>j.command.type==='ENCOUNTER_POLICY'))return'先明确选择本场策略；开战后不能更换。';return s.actionsRemaining<1?'开战需要1行动；和平离开不花行动。':null;
}
export const beautyGoddessEncounterReason=blockBeautyGoddessEncounter;
export function leaveBeautyGoddessCombatScene(p:BeautyGoddessScene):void {if(p.playerLocation!=='YARD'||p.playerCoordinate!==4)throw new Error('须从实际所在石院离开。');p.playerLocation='OUTSIDE';p.playerCoordinate=0;p.playerTravelMetres+=4;p.clockSeconds+=4;p.externalSeconds+=4;}
function arrive(s:SliceState,p:BeautyGoddessPreparation):BeautyGoddessScene{return{...createBeautyGoddessScene(),playerLocation:'YARD',playerCoordinate:4,observedSourceId:`${s.runId}:BG1-YARD:${p.revision}`,observationWeek:p.week,clockSeconds:4,externalSeconds:4,playerTravelMetres:4,knownPlayerName:p.playerName,knownEnemyName:'奥斯瓦尔德·里德'};}
export function applyBeautyGoddessEncounterCommand(s:SliceState,c:BeautyGoddessEncounterCommand,ctx:SeerContext):void {
  const reason=blockBeautyGoddessEncounter(s,c);if(reason)throw new Error(reason);const e=s.beautyGoddess.encounter;
  if(c.type==='BUY_BATTLE_LAMP'||c.type==='PREPARE_BATTLE_PIECE'){
    const before=beautyGoddessEncounterBudget(s),materialsBefore=structuredClone(e.materials);s.cash-=c.type==='BUY_BATTLE_LAMP'?40:70;s.actionsRemaining--;e.materials=purchaseMaterials(e.materials,c,s.week);
    e.purchases.push({command:structuredClone(c),week:s.week,date:{...s.date},revision:s.revision+1,runId:s.runId,randomSeed:s.random.seed,randomCursor:s.random.cursor,before,after:beautyGoddessEncounterBudget(s),finance:beautyGoddessFinanceSnapshot(s),materialsBefore,materialsAfter:structuredClone(e.materials)});
    ctx.note('备好独立战场原物',c.type==='BUY_BATTLE_LAMP'?'实付40便士和1行动，购得唯一战场灯与180秒灯油。到场后放下点亮，遮住仍耗油；本场不能补油。':'实付70便士和1行动，备好一枚独立月片。本场最多三枚；失败也用尽同一月片，实物必须带回。');return;
  }
  if(c.type==='ENCOUNTER_TALK'){
    const before=beautyGoddessEncounterBudget(s),materialsBefore=structuredClone(e.materials);s.actionsRemaining--;e.materials=arrivalMaterials(e.materials);
    e.preparation={week:s.week,date:{...s.date},revision:s.revision+1,runId:s.runId,randomSeed:s.random.seed,randomCursor:s.random.cursor,pricePaid:0,actionsPaid:1,lifeReflected:true,playerName:s.character.name,playerClubHeld:s.town.clubLocation==='HAND',before,after:beautyGoddessEncounterBudget(s),finance:beautyGoddessFinanceSnapshot(s),papers:structuredClone(s.witchKing.life.papers),partner:structuredClone(getSummoningMasterPartner(s)),oldBeads:structuredClone(s.lifeGiver.life.beads),materialsBefore,materialsAfter:structuredClone(e.materials)};
    e.originalHistory=structuredClone(s.combatHistory);e.originalResources=protectedOriginals(s);e.scene=arrive(s,e.preparation);e.status='READY';
    ctx.note('走到石院与奥斯瓦尔德交谈',`实付1行动，步行4米4秒。你介绍姓名“${s.character.name}”，46岁的奥斯瓦尔德·里德也报出姓名。他持自己的唯一月杆，身体100、精神100、灵性120，杆中只有四次可见月光冲击。流灯仍在家，达莉娅及旧人物均不在场。已有战场灯放下点亮，月片实物随身到场。`);return;
  }
  const entry:BeautyGoddessEncounterJournal={command:structuredClone(c),week:s.week,date:{...s.date},revision:s.revision+1,randomCursor:s.random.cursor,before:beautyGoddessEncounterBudget(s),after:beautyGoddessEncounterBudget(s),finance:beautyGoddessFinanceSnapshot(s),sceneBefore:structuredClone(e.scene),sceneAfter:structuredClone(e.scene),materialsBefore:structuredClone(e.materials),materialsAfter:structuredClone(e.materials)};
  if(c.type==='ENCOUNTER_POLICY'){e.policy=c.policy;ctx.note('选择美神交战策略',c.policy==='ORDINARY'?'本场只作普通动作；不施放抽到的能力。':c.policy==='INHERITED_ONLY'?'本场只允许已学能力；两项新能力回到普通防备。':'仅在所选能力抽到、实际对象与资源齐备时尝试。每轮各一次，失败照付，空窗口没有掌握奖励。');}
  else if(c.type==='LEAVE_ENCOUNTER'){returnMaterials(e.materials,true);leaveBeautyGoddessCombatScene(e.scene);e.status='RESOLVED';ctx.note('沿普通路和平离开石院','亲手收回自己的战场灯与每一枚原月片，放回返还盘，沿开放出口实际走4米4秒。没有战斗或奖励，奥斯瓦尔德与自己的月杆留在石院。');}
  else{s.actionsRemaining--;e.status='FIGHTING';e.attemptWeek=s.week;e.startHistoryIndex=s.combatHistory.length;s.combat={encounterId:'BEAUTY_GODDESS_DISPUTE',round:1,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemyInjuries:structuredClone(e.enemyInjuries),enemyRisk:e.enemyRisk,enemyStatus:'RESISTING',lastRound:null};ctx.note('选择与奥斯瓦尔德交战','实付1行动。双方各自最多六次实际行动，精神压力与身体伤害各有实际来源。普通撤退、停止抵抗、伤势与真实死亡照常。');}
  entry.after=beautyGoddessEncounterBudget(s);entry.sceneAfter=structuredClone(e.scene);entry.materialsAfter=structuredClone(e.materials);e.journal.push(entry);
  if(c.type==='ENCOUNTER_FIGHT'){const source=currentBeautyGoddessCombatSource(s);if(!source)throw new Error('真实战斗来源不完整。');e.startSource={...source,revision:s.revision+1};}
}
export const applyBeautyGoddessEncounter=applyBeautyGoddessEncounterCommand;
export const handleBeautyGoddessEncounter=applyBeautyGoddessEncounterCommand;
export function startBeautyGoddessEncounter(s:SliceState,ctx:SeerContext):void{applyBeautyGoddessEncounterCommand(s,{type:'ENCOUNTER_FIGHT'},ctx);}
export function hasBeautyGoddessDisputeOpponent(s:SliceState):boolean {
  const e=s.beautyGoddess?.encounter,c=s.combat;return isBeautyGoddessEncounterStage(s)&&s.status==='ACTIVE'&&!s.activeEvent&&s.world.city==='BACKLUND'&&s.health>0&&s.mind>0&&s.beautyGoddess.promotionWeek!==null&&!!e&&e.status==='FIGHTING'&&e.targetId===BEAUTY_GODDESS_TARGET_ID&&e.terminal===null&&e.preparation!==null&&e.materials.weapon.charge===4-e.powerUses.MOON_BOLT&&originalsUnchanged(s)&&e.attemptWeek===s.week&&adultsAbsent(s)&&
    validBeautyGoddessScene(e.scene)&&e.scene.playerLocation==='YARD'&&e.scene.knownPlayerName===s.character.name&&validBeautyGoddessMaterials(e.materials)&&validBeautyGoddessBody(e)&&e.weaponLocation===e.materials.weapon.location&&c?.encounterId==='BEAUTY_GODDESS_DISPUTE'&&c.enemyStatus==='RESISTING'&&c.enemyHealth>0&&c.enemyMind>0&&e.enemyStatus==='RESISTING'&&e.enemyHealth===c.enemyHealth&&e.enemyMind===c.enemyMind&&same(e.enemyInjuries,c.enemyInjuries)&&e.enemyRisk===c.enemyRisk&&integer(c.round,1)&&e.startHistoryIndex!==null&&integer(e.startHistoryIndex)&&s.combatHistory.length-e.startHistoryIndex===c.round-1;
}
function terminalScene(o:BeautyGoddessRoundOutcome):{root:BeautyGoddessScene;exit:0|4;materials:BeautyGoddessMaterials}{const root=structuredClone(o.rootAfter),materials=structuredClone(o.materialsAfter),exit=o.playerHealthAfter>0?4:0;returnMaterials(materials,exit>0);if(exit)leaveBeautyGoddessCombatScene(root);return{root,exit,materials};}
export function settleBeautyGoddessEncounter(s:SliceState,outcome:string,ctx:SeerContext,_award?:(source:string,amount:5|8|25)=>void):void {
  const e=s.beautyGoddess.encounter,c=s.combat;if(e.status!=='FIGHTING'||c?.encounterId!=='BEAUTY_GODDESS_DISPUTE')throw new Error('没有这场石院冲突。');if(outcome==='CONTINUE')return;const last=c.lastRound,o=last?.beautyGoddessOutcome;
  if(!last||!o||!validateBeautyGoddessCombatRound(last)||o.continuing||e.terminal||e.startHistoryIndex===null||c.round!==last.round+1||s.combatHistory.length-e.startHistoryIndex!==last.round||!originalsUnchanged(s)||!same(s.combatHistory.at(-1),last)||!same(combatBody(e),combatBody(o))||!same(o.rootAfter,e.scene)||!same(o.materialsAfter,e.materials)||o.playerHealthAfter!==s.health||o.playerMindAfter!==s.mind||o.playerSpiritualityAfter!==s.spirituality||!same(o.papers,s.witchKing.life.papers)||!same(o.masteryAfter,s.progression.mastery)||!same(o.playerInjuriesAfter,s.injuries)||o.playerRiskAfter!==s.injuryRisk||o.enemyHealth!==c.enemyHealth||o.enemyMind!==c.enemyMind||!same(o.enemyInjuries,c.enemyInjuries)||o.enemyRisk!==c.enemyRisk||o.enemyStatus!==c.enemyStatus||outcome!==(o.playerHealthAfter===0?'PLAYER_DEAD':o.enemyHealth===0?'ENEMY_DEAD':o.enemyStatus==='SURRENDERED'?'ENEMY_SURRENDERED':'RETREATED'))throw new Error('结局与真实回合、原人原物和费用不一致。');
  const final=terminalScene(o);e.scene=final.root;e.materials=final.materials;e.terminal={outcome:outcome as BeautyGoddessEncounterTerminal['outcome'],round:last.round,historyIndex:s.combatHistory.length-1,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,enemyStatus:e.enemyStatus,exitMetres:final.exit,exitSeconds:final.exit};e.status=outcome==='PLAYER_DEAD'?'LOST':outcome==='RETREATED'?'RETREATED':'RESOLVED';s.combat=null;
  ctx.note('奥斯瓦尔德的石院冲突结束',`${final.exit?'本人亲手收回每一枚月片（包括用尽原物）与战场灯至返还盘，再沿普通出口走4米4秒。':'本人的原身体真实死亡，灯和全部月片留在实际石院。'}双方原灵性、精神、伤势与月杆落点保留，没有复活、免费补油或补发月片。流灯、达莉娅和旧人物仍各在原处。`);
}
export const finishBeautyGoddessEncounter=settleBeautyGoddessEncounter;
export function beautyGoddessEncounterActions(s:SliceState){
  if(!isBeautyGoddessEncounterStage(s))return[];const choices:{command:BeautyGoddessEncounterCommand;label:string;cost:string}[]=[
    {command:{type:'BUY_BATTLE_LAMP'},label:'购买独立战场灯与有限灯油',cost:'40便士、1行动；180秒灯油，不补充'},
    {command:{type:'PREPARE_BATTLE_PIECE'},label:'准备一枚独立战场月片',cost:'70便士、1行动；本场最多3枚'},
    {command:{type:'ENCOUNTER_TALK'},label:'到石院与奥斯瓦尔德交谈',cost:'1行动、4米4秒；先有2行动'},
    ...(['INHERITED_ONLY','SELF_POISE','BOUNDED_MOONFORM','ALL','ORDINARY'] as const).map(policy=>({command:{type:'ENCOUNTER_POLICY' as const,policy},label:({INHERITED_ONLY:'只用已学能力',SELF_POISE:'允许辉映调息',BOUNDED_MOONFORM:'允许月辉定形',ALL:'允许两项新能力',ORDINARY:'只作普通行动'})[policy],cost:'0行动；开战前明确选择'})),
    {command:{type:'ENCOUNTER_FIGHT'},label:'自主承担真实冲突',cost:'1行动；真实伤势与死亡风险'},
    {command:{type:'LEAVE_ENCOUNTER'},label:'带回原物并和平离开',cost:'0行动、4米4秒'}];
  return choices.map(({command,label,cost})=>{const reason=blockBeautyGoddessEncounter(s,command);return{id:`BG1-${command.type}${command.type==='ENCOUNTER_POLICY'?'-'+command.policy:''}`,command,label,cost,enabled:reason===null,reason};});
}
export const BEAUTY_GODDESS_ENCOUNTER_STORY='46岁的奥斯瓦尔德·里德独自在净空石院提出通行争议。他有独立健康100、精神100、灵性120与自己的唯一月杆，杆中四次可见冲击用尽后仍是同一根杆。流灯留原家，达莉娅与旧人物均不在场。沿四米普通路到场，亲自交谈、明确策略后再决定交战或和平离开。';
export function projectBeautyGoddessEncounter(s:SliceState){const e=s.beautyGoddess.encounter;return{title:'奥斯瓦尔德的石院争议',story:isBeautyGoddessEncounterStage(s)?BEAUTY_GODDESS_ENCOUNTER_STORY:'',status:e.status,inside:hasBeautyGoddessEncounterLock(s),policy:e.policy,policyConfirmed:e.journal.some(j=>j.command.type==='ENCOUNTER_POLICY'),scene:structuredClone(e.scene),materials:structuredClone(e.materials),
  enemy:{id:e.targetId,name:'奥斯瓦尔德·里德',age:46 as const,health:e.enemyHealth,mind:e.enemyMind,spirituality:e.enemySpirituality,status:e.enemyStatus,weaponLocation:e.weaponLocation,powerUses:{...e.powerUses}},actions:beautyGoddessEncounterActions(s),facts:[
    '辉映调息每轮一次6灵性2精神、意志18，只增强后来一次真正可用的本人动作25。','月辉定形每轮一次8灵性3精神、一枚实付月片、感知18并受抵抗；只在实亮未遮灯下削弱一项可见待执行身体冲击30，精神压力不受影响。','战场灯与月片独立于生活原灯原片；失败照耗，用尽原物保留。流灯不在场，旧原珠不在手，旧物不足就普通回退。','体35%、感25%、意25%、知15%；双方1至6动作权重10/15/25/25/15/10，基础1250、底125、上限120，仅继续轮恢复12。','精神耗尽仍活着停战，身体死亡终结本周目；生还亲手归还原物并实走4米4秒。']};}
export type BeautyGoddessEncounterProjection=ReturnType<typeof projectBeautyGoddessEncounter>;

export function beautyGoddessTerminalBudgetMatches(s: SliceState, _prep: BeautyGoddessPreparation, o: BeautyGoddessRoundOutcome): boolean {
  const e = s.beautyGoddess.encounter, fight = e.journal.find(j => j.command.type === 'ENCOUNTER_FIGHT'); if (!fight) return false;
  const expected: BeautyGoddessEncounterBudget = { ...fight.after, health: o.playerHealthAfter, mind: o.playerMindAfter, spirituality: o.playerSpiritualityAfter,
    mastery: o.masteryAfter, injuries: o.playerInjuriesAfter, injuryRisk: o.playerRiskAfter };
  const current = beautyGoddessEncounterBudget(s);
  if (!same({ ...current, cash: expected.cash, actions: expected.actions }, expected) || s.random.cursor !== o.randomCursorAfter || !same(e.scene, terminalScene(o).root) || !same(e.materials, terminalScene(o).materials)) return false;
  const financialTitles = ['本周生活费', '生活费如实记账', '本周约定还款', '账目结清', '新的一周'];
  const receipts = s.chronicle.filter((entry, index) => entry.id === `record-${s.revision}-${index}` && financialTitles.includes(entry.title));
  if (expected.actions > 0 || o.playerHealthAfter === 0) return s.week === fight.week && same(s.date, fight.date) && s.actionsRemaining === expected.actions &&
    s.cash === expected.cash && same(beautyGoddessFinanceSnapshot(s), fight.finance) && s.pulse === 'NONE' && s.billAmount === 0 && s.activeEvent === null && s.eventQueue.length === 0 && receipts.length === 0;
  if (expected.actions !== 0 || s.status !== 'ACTIVE') return false;
  const result = resolveSliceWeeklyFinance({ ...fight.finance, cash: expected.cash, week: fight.week, revision: o.source.revision, pulse: 'BILL', billAmount: 0 });
  const advanced = result.eventId === null && result.state.pulse === 'ADVANCE';
  const finance = { ...fight.finance, ...result.state, weeklyBudget: fight.finance.weeklyBudget, lifeTier: advanced ? result.state.nextLifeTier : fight.finance.lifeTier };
  if (s.cash !== result.state.cash || !same(beautyGoddessFinanceSnapshot(s), beautyGoddessFinanceSnapshot(finance)) || s.week !== fight.week + (advanced ? 1 : 0) ||
    !same(s.date, advanced ? addGameWeeks(fight.date, 1) : fight.date) || s.actionsRemaining !== (advanced ? fight.finance.weeklyBudget : 0) ||
    s.pulse !== (advanced ? 'NONE' : result.state.pulse) || s.billAmount !== (advanced ? 0 : result.state.billAmount)) return false;
  const expectedReceipts = result.receipts.map(receipt => ({ week: fight.week, ...receipt }));
  if (advanced) expectedReceipts.push({ week: fight.week + 1, title: '新的一周', text: `日期推进7天，本周${fight.finance.weeklyBudget}次行动。` });
  if (!same(receipts.map(({ week, title, text }) => ({ week, title, text })), expectedReceipts)) return false;
  if (result.eventId) {
    const terminalIndex = s.chronicle.findIndex((entry, index) => entry.id === `record-${s.revision}-${index}` && entry.title === '奥斯瓦尔德的石院冲突结束');
    const eventIndex = terminalIndex + 1 + result.receipts.length;
    return terminalIndex >= 0 && s.eventQueue.length === 0 && same(s.activeEvent, { id: result.eventId, instanceId: `${s.runId}:${result.eventId}:${s.revision}:${eventIndex}` });
  }
  return true;
}
/** Validate a just-completed purchase against the same ordinary weekly-finance
 * helper used by the game. No local health, AP, cash or debt reset is allowed. */
function purchaseBudgetMatches(s:SliceState,p:BeautyGoddessPurchase):boolean {
  const expected=p.after,current=beautyGoddessEncounterBudget(s);
  if(!same({...current,cash:expected.cash,actions:expected.actions},expected)||s.random.seed!==p.randomSeed||s.random.cursor!==p.randomCursor)return false;
  const titles=['本周生活费','生活费如实记账','本周约定还款','账目结清','新的一周'];
  const receipts=s.chronicle.filter((entry,index)=>entry.id===`record-${s.revision}-${index}`&&titles.includes(entry.title));
  if(expected.actions>0)return s.week===p.week&&same(s.date,p.date)&&s.actionsRemaining===expected.actions&&s.cash===expected.cash&&same(beautyGoddessFinanceSnapshot(s),p.finance)&&s.pulse==='NONE'&&s.billAmount===0&&s.activeEvent===null&&s.eventQueue.length===0&&receipts.length===0;
  const result=resolveSliceWeeklyFinance({...p.finance,cash:expected.cash,week:p.week,revision:p.revision-1,pulse:'BILL',billAmount:0}),advanced=result.eventId===null&&result.state.pulse==='ADVANCE';
  const finance={...p.finance,...result.state,weeklyBudget:p.finance.weeklyBudget,lifeTier:advanced?result.state.nextLifeTier:p.finance.lifeTier};
  if(s.cash!==result.state.cash||!same(beautyGoddessFinanceSnapshot(s),beautyGoddessFinanceSnapshot(finance))||s.week!==p.week+(advanced?1:0)||!same(s.date,advanced?addGameWeeks(p.date,1):p.date)||s.actionsRemaining!==(advanced?p.finance.weeklyBudget:0)||s.pulse!==(advanced?'NONE':result.state.pulse)||s.billAmount!==(advanced?0:result.state.billAmount))return false;
  const expectedReceipts=result.receipts.map(receipt=>({week:p.week,...receipt}));if(advanced)expectedReceipts.push({week:p.week+1,title:'新的一周',text:`日期推进7天，本周${p.finance.weeklyBudget}次行动。`});
  if(!same(receipts.map(({week,title,text})=>({week,title,text})),expectedReceipts))return false;
  if(result.eventId){const purchaseIndex=s.chronicle.findIndex((entry,index)=>entry.id===`record-${s.revision}-${index}`&&entry.title==='备好独立战场原物'),eventIndex=purchaseIndex+1+result.receipts.length;return purchaseIndex>=0&&s.eventQueue.length===0&&same(s.activeEvent,{id:result.eventId,instanceId:`${s.runId}:${result.eventId}:${s.revision}:${eventIndex}`});}
  return s.activeEvent===null&&s.eventQueue.length===0;
}
export function replayBeautyGoddessPurchases(s:SliceState):BeautyGoddessMaterials|null {
 try{let materials=createBeautyGoddessMaterials(),revision=0,week=s.beautyGoddess.promotionWeek??0;const purchases=s.beautyGoddess.encounter.purchases;
  if(!Array.isArray(purchases)||purchases.length>4)return null;
  for(const p of purchases){if(!shape(p,['command','week','date','revision','runId','randomSeed','randomCursor','before','after','finance','materialsBefore','materialsAfter'])||!validateBeautyGoddessEncounterCommand(p.command)||!['BUY_BATTLE_LAMP','PREPARE_BATTLE_PIECE'].includes(p.command.type)||!integer(p.week,week,s.week)||!isValidGameDate(p.date)||compareGameDates(p.date,s.date)>0||!integer(p.revision,revision+1,s.revision)||p.runId!==s.runId||p.randomSeed!==s.random.seed||!integer(p.randomCursor,0,s.random.cursor)||!validBudget(p.before,p.revision)||!validBudget(p.after,p.revision)||!validFinance(p.finance,p.week)||p.before.actions<1||p.before.cash<(p.command.type==='BUY_BATTLE_LAMP'?40:70)||!same(p.materialsBefore,materials))return null;
   materials=purchaseMaterials(materials,p.command,p.week);
   if(!same(p.after,{...p.before,cash:p.before.cash-(p.command.type==='BUY_BATTLE_LAMP'?40:70),actions:p.before.actions-1})||!same(p.materialsAfter,materials)||s.revision===p.revision&&!purchaseBudgetMatches(s,p))return null;
   revision=p.revision;week=p.week;
  }return materials;
 }catch{return null;}
}
/** Exact root and source-chain replay. Historical rounds are immutable; a later
 * ordinary rest may change the live player but cannot alter a recorded fight. */
export function replayBeautyGoddessEncounterRoot(s:SliceState):BeautyGoddessScene|null {
 try{
  const e=s.beautyGoddess.encounter,initial=createBeautyGoddessEncounterState(),allNew=s.combatHistory.flatMap((r,i)=>r.beautyGoddessOutcome?[i]:[]),purchased=replayBeautyGoddessPurchases(s);
  if(!e||!shape(e,Object.keys(initial))||!['AVAILABLE','READY','FIGHTING','RESOLVED','RETREATED','LOST'].includes(e.status)||e.targetId!==initial.targetId||!['INHERITED_ONLY','SELF_POISE','BOUNDED_MOONFORM','ALL','ORDINARY'].includes(e.policy)||!validBeautyGoddessBody(e)||!validBeautyGoddessScene(e.scene)||!validBeautyGoddessMaterials(e.materials)||e.weaponLocation!==e.materials.weapon.location||!purchased)return null;
  if(!e.preparation)return same({...e,purchases:[],materials:createBeautyGoddessMaterials()},initial)&&same(e.materials,purchased)&&allNew.length===0&&s.combat?.encounterId!=='BEAUTY_GODDESS_DISPUTE'?createBeautyGoddessScene():null;
  const prep=e.preparation;
  if(!isBeautyGoddessEncounterStage(s)||s.beautyGoddess.promotionWeek===null||!s.beautyGoddess.life.reflected||!validateBeautyGoddessPreparation(prep)||prep.runId!==s.runId||prep.playerName!==s.character.name||prep.randomSeed!==s.random.seed||prep.randomCursor>s.random.cursor||!integer(prep.week,s.beautyGoddess.promotionWeek,s.week)||compareGameDates(prep.date,s.date)>0||!integer(prep.revision,1,s.revision)||!historyUnchanged(s)||typeof e.originalResources!=='string'||!e.originalResources||!Array.isArray(e.journal)||!same(prep.materialsBefore,purchased)||e.purchases.some(p=>p.revision>=prep.revision||p.week>prep.week))return null;
  let policyChosen=false,root=arrive(s,prep),status:BeautyGoddessEncounterState['status']='READY',policy:BeautyGoddessPolicy='INHERITED_ONLY',materials=structuredClone(prep.materialsAfter),papers=structuredClone(prep.papers);
  let budget=prep.after,finance=prep.finance,week=prep.week,date=prep.date,revision=prep.revision;
  for(const entry of e.journal){
   if(!shape(entry,['command','week','date','revision','randomCursor','before','after','finance','sceneBefore','sceneAfter','materialsBefore','materialsAfter'])||!validateBeautyGoddessEncounterCommand(entry.command)||!['ENCOUNTER_POLICY','ENCOUNTER_FIGHT','LEAVE_ENCOUNTER'].includes(entry.command.type)||!validBudget(entry.before,entry.revision)||!validBudget(entry.after,entry.revision)||!validFinance(entry.finance,entry.week)||!integer(entry.revision,revision+1,s.revision)||entry.randomCursor!==prep.randomCursor||!same(entry.sceneBefore,root)||!same(entry.materialsBefore,materials)||status!=='READY'||entry.week!==week||!same(entry.date,date)||!same(entry.before,budget)||!same(entry.finance,finance))return null;
   if(entry.command.type==='ENCOUNTER_POLICY'){if(policyChosen&&entry.command.policy===policy)return null;policy=entry.command.policy;policyChosen=true;}
   else if(entry.command.type==='ENCOUNTER_FIGHT'){if(!policyChosen||root.playerLocation!=='YARD'||entry.before.actions<1)return null;status='FIGHTING';}
   else{returnMaterials(materials,true);leaveBeautyGoddessCombatScene(root);status='RESOLVED';}
   if(!same(entry.after,{...entry.before,actions:entry.before.actions-(entry.command.type==='ENCOUNTER_FIGHT'?1:0)})||!same(entry.sceneAfter,root)||!same(entry.materialsAfter,materials))return null;
   budget=entry.after;finance=entry.finance;week=entry.week;date=entry.date;revision=entry.revision;
  }
  if(e.policy!==policy)return null;
  if(status!=='FIGHTING'){
   if(e.status!==status||e.startHistoryIndex!==null||e.startSource!==null||e.attemptWeek!==null||e.terminal!==null||!same(combatBody(e),initialBeautyGoddessBody())||!same(e.materials,materials)||allNew.length||s.combat?.encounterId==='BEAUTY_GODDESS_DISPUTE')return null;
   if(status==='READY'||s.revision===revision){if(!same(s.witchKing.life.papers,papers)||!originalsUnchanged(s)||!same(beautyGoddessEncounterBudget(s),budget)||!same(beautyGoddessFinanceSnapshot(s),finance)||s.week!==week||!same(s.date,date)||s.random.cursor!==prep.randomCursor||s.pulse!=='NONE'||s.billAmount!==0||s.activeEvent||s.eventQueue.length||!adultsAbsent(s)||!same(getSummoningMasterPartner(s),prep.partner)||!same(s.lifeGiver.life.beads,prep.oldBeads))return null;}
   return root;
  }
  const start=e.startSource;
  if(!start||!validBeautyGoddessCombatSource(start)||!integer(e.startHistoryIndex,0,s.combatHistory.length)||e.startHistoryIndex!==e.originalHistory!.length||e.attemptWeek!==week||start.round!==1||start.revision!==revision||start.week!==week||!same(start.date,date)||start.startHistoryIndex!==e.startHistoryIndex||start.runId!==s.runId||!same(start.preparation,prep)||start.policy!==policy||!same(start.papers,papers)||!same(start.body,initialBeautyGoddessBody())||!same(start.root,root)||!same(start.materials,materials)||start.randomSeed!==s.random.seed||start.randomCursor!==prep.randomCursor||start.playerHealth!==budget.health||start.playerMind!==budget.mind||start.playerSpirituality!==budget.spirituality||!same(start.mastery,budget.mastery)||!same(start.playerInjuries,budget.injuries)||start.playerRisk!==budget.injuryRisk)return null;
  const terminal=e.terminal;
  if(terminal&&(!shape(terminal,['outcome','round','historyIndex','enemyHealth','enemyMind','enemySpirituality','enemyStatus','exitMetres','exitSeconds'])||!integer(terminal.historyIndex,e.startHistoryIndex,s.combatHistory.length-1)))return null;
  const end=terminal?terminal.historyIndex+1:s.combatHistory.length,rounds=s.combatHistory.slice(e.startHistoryIndex,end);
  if(!same(allNew,rounds.map((_r,i)=>e.startHistoryIndex!+i)))return null;
  for(const[i,round]of rounds.entries()){const o=round.beautyGoddessOutcome,previous=rounds[i-1]?.beautyGoddessOutcome;if(!o||!validateBeautyGoddessCombatRound(round)||round.round!==i+1||o.source.revision>=s.revision||o.randomCursorAfter>s.random.cursor||!same(o.source,previous?nextBeautyGoddessCombatSource(previous):start)||!same(o.source.root,root)||i<rounds.length-1&&!o.continuing)return null;root=structuredClone(o.rootAfter);papers=structuredClone(o.papers);materials=structuredClone(o.materialsAfter);}
  const last=rounds.at(-1),o=last?.beautyGoddessOutcome;
  if(e.status==='FIGHTING'){
   if(!same(s.witchKing.life.papers,papers)||!same(getSummoningMasterPartner(s),prep.partner)||!same(s.lifeGiver.life.beads,prep.oldBeads)||terminal||!hasBeautyGoddessDisputeOpponent(s)||!same(combatBody(e),o?combatBody(o):start.body)||!same(e.materials,materials))return null;
   const current=beautyGoddessEncounterBudget(s),expected={...budget,health:o?.playerHealthAfter??start.playerHealth,mind:o?.playerMindAfter??start.playerMind,spirituality:o?Math.min(120,o.playerSpiritualityAfter+12):start.playerSpirituality,mastery:o?.masteryAfter??start.mastery,injuries:o?.playerInjuriesAfter??start.playerInjuries,injuryRisk:o?.playerRiskAfter??start.playerRisk};
   if(!same(current,expected)||!same(beautyGoddessFinanceSnapshot(s),finance)||s.week!==week||!same(s.date,date)||s.pulse!=='NONE'||s.billAmount!==0||s.activeEvent!==null||s.eventQueue.length)return null;
   return o?o.continuing&&same(last,s.combat!.lastRound)&&same(currentBeautyGoddessCombatSource(s),nextBeautyGoddessCombatSource(o))?root:null:s.combat!.lastRound===null&&same(currentBeautyGoddessCombatSource(s),start)?root:null;
  }
  if(s.combat?.encounterId==='BEAUTY_GODDESS_DISPUTE'||!terminal||!last||!o||o.continuing||terminal.round!==last.round||rounds.length!==terminal.round||!same(combatBody(e),combatBody(o))||terminal.enemyHealth!==e.enemyHealth||terminal.enemyMind!==e.enemyMind||terminal.enemySpirituality!==e.enemySpirituality||terminal.enemyStatus!==e.enemyStatus)return null;
  const final=terminalScene(o);if(terminal.exitMetres!==final.exit||terminal.exitSeconds!==final.exit||!same(e.materials,final.materials))return null;
  if(s.revision===o.source.revision+1&&(!same(s.witchKing.life.papers,papers)||!same(getSummoningMasterPartner(s),prep.partner)||!same(s.lifeGiver.life.beads,prep.oldBeads)||!originalsUnchanged(s)||!beautyGoddessTerminalBudgetMatches(s,prep,o)))return null;
  if(terminal.outcome==='PLAYER_DEAD')return e.status==='LOST'&&s.status==='DEAD'&&o.playerHealthAfter===0?final.root:null;
  if(terminal.outcome==='RETREATED')return e.status==='RETREATED'&&o.playerHealthAfter>0&&(last.retreat==='SUCCESS'||o.playerMindAfter===0)?final.root:null;
  return e.status==='RESOLVED'&&o.playerHealthAfter>0&&(terminal.outcome==='ENEMY_DEAD'?e.enemyStatus==='DEAD':terminal.outcome==='ENEMY_SURRENDERED'&&e.enemyStatus==='SURRENDERED')?final.root:null;
 }catch{return null;}
}
export function validateBeautyGoddessEncounter(s:SliceState):boolean {try{const root=replayBeautyGoddessEncounterRoot(s);return root!==null&&same(root,s.beautyGoddess.encounter.scene);}catch{return false;}}
export const validateBeautyGoddessEncounterState=validateBeautyGoddessEncounter;
/** Real commit revisions for the acquisition owner's frozen original-paper ledger. */
export function beautyGoddessEncounterOriginalEvents(s:SliceState):{revision:number;week:number;before:WitchKingPaper[];after:WitchKingPaper[]}[]{return s.combatHistory.flatMap(round=>{const o=round.beautyGoddessOutcome;return o?[{revision:o.source.revision+1,week:o.source.week,before:structuredClone(o.source.papers),after:structuredClone(o.papers)}]:[];});}
