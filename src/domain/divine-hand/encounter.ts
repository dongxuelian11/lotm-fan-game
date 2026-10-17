import { validateGlorySiteState } from '../glory/life.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { addGameWeeks, compareGameDates, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceCombatRound, SliceInjury, SliceState } from '../slice/types.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { hasDivineHandLifeLock } from './life.js';
import { currentDivineHandCombatSource, nextDivineHandCombatSource, validDivineHandCombatSource, validateDivineHandCombatRound,
  validDivineHandBody, validDivineHandInjuries, type DivineHandCombatSource, type DivineHandRoundOutcome } from './combat.js';

export const DIVINE_HAND_TARGET_ID = 'DH1-OSCAR' as const;
export const DIVINE_HAND_SITE = 'DH1-YARD' as const;
export const DIVINE_HAND_POWER_IDS = ['BODY_MARK', 'MENTAL_MARK', 'FEINT'] as const;
export type DivineHandPowerId = typeof DIVINE_HAND_POWER_IDS[number];
export type DivineHandEnemyIntent = DivineHandPowerId | 'BODY_STRIKE' | 'OBSERVE' | 'ACCIDENT';
export type DivineHandPolicy = 'INHERITED_ONLY' | 'BEAM_STABILIZE' | 'ARMOR_CONVERGENCE' | 'ALL' | 'ORDINARY';
export type DivineHandCombatPolicy = DivineHandPolicy;
export const DIVINE_HAND_POLICIES: readonly DivineHandPolicy[] = ['INHERITED_ONLY','BEAM_STABILIZE','ARMOR_CONVERGENCE','ALL','ORDINARY'];
export const DIVINE_HAND_POWERS = [
  { id: 'BODY_MARK', label: '有限身体冲击印记', cost: 7, selfGain: 75, enemyReduction: 0 },
  { id: 'MENTAL_MARK', label: '有限精神牵引印记', cost: 7, selfGain: 65, enemyReduction: 0 },
  { id: 'FEINT', label: '侧移一步并横棍遮挡', cost: 3, selfGain: 0, enemyReduction: 0 },
] as const;
export interface DivineHandMaterials {
  weapon: { id: 'DH1-OSCAR-CLUB'; sourceId: 'DH1-OSCAR-OWNED-CLUB-1'; owner: typeof DIVINE_HAND_TARGET_ID;
    massKg: 2; location: 'HAND' | 'YARD'; condition: 100; visible: true };
  marks: { id: string; owner: typeof DIVINE_HAND_TARGET_ID; status: 'HELD' | 'SPENT'; usedRound: number | null }[];
}
export function createDivineHandMaterials(): DivineHandMaterials {
  return { weapon: { id: 'DH1-OSCAR-CLUB', sourceId: 'DH1-OSCAR-OWNED-CLUB-1', owner: DIVINE_HAND_TARGET_ID,
    massKg: 2, location: 'HAND', condition: 100, visible: true },
    marks: [1,2,3].map(n=>({id:`DH1-OSCAR-MARK-${n}`,owner:DIVINE_HAND_TARGET_ID,status:'HELD',usedRound:null})) };
}
export interface DivineHandScene {
  siteId: typeof DIVINE_HAND_SITE; playerLocation: 'OUTSIDE' | 'YARD'; playerCoordinate: 0 | 4; enemyCoordinate: 6 | 7;
  ordinaryExit: 'OPEN'; visibleBodyLine: boolean; conditionVersion: number; observedConditionVersion: number | null;
  thirdPartiesInArea: 0; presentMemberIds: string[]; observedSourceId: string | null; observationWeek: number | null;
  clockSeconds: number; externalSeconds: number; playerTravelMetres: number; enemyTravelMetres: number; knownPlayerName: string | null; knownEnemyName: string | null;
}
export function createDivineHandScene(): DivineHandScene {
  return { siteId: DIVINE_HAND_SITE, playerLocation: 'OUTSIDE', playerCoordinate: 0, enemyCoordinate: 6,
    ordinaryExit: 'OPEN', visibleBodyLine: true, conditionVersion: 1, observedConditionVersion: null,
    thirdPartiesInArea: 0, presentMemberIds: [], observedSourceId: null, observationWeek: null,
    clockSeconds: 0, externalSeconds: 0, playerTravelMetres: 0, enemyTravelMetres: 0, knownPlayerName: null, knownEnemyName: null };
}
export interface DivineHandObservation { power: 'BODY_MARK' | 'MENTAL_MARK'; conditionVersion: number; round: number; order: number; atSeconds: number; paidCost: 7 }
export interface DivineHandCombatBody {
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  weaponLocation: 'HAND' | 'YARD'; powerUses: Record<DivineHandPowerId, number>; observations: DivineHandObservation[];
  totalOwnerMindSpent: number; beamStabilizeAttempts: number; beamStabilizeChecks: number; beamStabilizeSuccesses: number;
  armorConvergenceAttempts: number; armorConvergenceChecks: number; armorConvergenceSuccesses: number; armorTemperAttempts: number; closeGuardAttempts: number; inheritedSuccesses: { armorTemper: number; closeGuard: number; silverThrust: number };
}
export function initialDivineHandBody(): DivineHandCombatBody {
  return { enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0, weaponLocation: 'HAND',
    powerUses: { BODY_MARK: 0, MENTAL_MARK: 0, FEINT: 0 }, observations: [], totalOwnerMindSpent: 0,
    beamStabilizeAttempts: 0, beamStabilizeChecks: 0, beamStabilizeSuccesses: 0, armorConvergenceAttempts: 0, armorConvergenceChecks: 0, armorConvergenceSuccesses: 0, armorTemperAttempts: 0, closeGuardAttempts: 0, inheritedSuccesses: { armorTemper: 0, closeGuard: 0, silverThrust: 0 } };
}
export function combatBody(e: DivineHandCombatBody): DivineHandCombatBody {
  return Object.fromEntries(Object.keys(initialDivineHandBody()).map(k => [k, structuredClone(e[k as keyof DivineHandCombatBody])])) as unknown as DivineHandCombatBody;
}
export type DivineHandFinanceSnapshot = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface DivineHandEncounterBudget {
  cash: number; actions: number; health: number; mind: number; spirituality: number; pollution: number; gender: string; sequence: 1;
  acting: number; coreStats: SliceState['character']['coreStats']; mastery: Record<string, number>; completedSources: string[]; injuries: SliceInjury[]; injuryRisk: number;
}
export interface DivineHandCombatOriginals { site: SliceState['glory']['life']['site'] }
export interface DivineHandPreparation {
  week: number; date: PublicGameDate; revision: number; runId: string; randomSeed: string; randomCursor: number; pricePaid: 0; actionsPaid: 1;
  lifeReflected: true; playerName: string; playerClubHeld: boolean; playerWeaponId: 'town-short-club' | 'warrior-training-club' | null; before: DivineHandEncounterBudget; after: DivineHandEncounterBudget;
  finance: DivineHandFinanceSnapshot; materialsBefore: DivineHandMaterials; materialsAfter: DivineHandMaterials; originalsBefore: DivineHandCombatOriginals; originalsAfter: DivineHandCombatOriginals;
}
export type DivineHandEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' } | { type: 'ENCOUNTER_POLICY'; policy: DivineHandPolicy };
export interface DivineHandEncounterJournal {
  command: DivineHandEncounterCommand; week: number; date: PublicGameDate; revision: number; randomCursor: number;
  before: DivineHandEncounterBudget; after: DivineHandEncounterBudget; finance: DivineHandFinanceSnapshot; sceneBefore: DivineHandScene; sceneAfter: DivineHandScene; materialsBefore: DivineHandMaterials; materialsAfter: DivineHandMaterials; originalsBefore: DivineHandCombatOriginals; originalsAfter: DivineHandCombatOriginals;
}
export interface DivineHandEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: DivineHandCombatBody['enemyStatus']; exitMetres: 0 | 4; exitSeconds: 0 | 4; originalsBefore: DivineHandCombatOriginals; originalsAfter: DivineHandCombatOriginals;
}
export interface DivineHandEncounterState extends DivineHandCombatBody {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof DIVINE_HAND_TARGET_ID; policy: DivineHandPolicy;
  preparation: DivineHandPreparation | null; purchases: never[]; attemptWeek: number | null; startHistoryIndex: number | null; startSource: DivineHandCombatSource | null;
  originalHistory: SliceCombatRound[] | null; originalResources: string | null; scene: DivineHandScene; materials: DivineHandMaterials; journal: DivineHandEncounterJournal[]; terminal: DivineHandEncounterTerminal | null;
}
export function createDivineHandEncounterState(): DivineHandEncounterState {
  return { ...initialDivineHandBody(), status: 'AVAILABLE', targetId: DIVINE_HAND_TARGET_ID, policy: 'INHERITED_ONLY', preparation: null, purchases: [], attemptWeek: null, startHistoryIndex: null,
    startSource: null, originalHistory: null, originalResources: null, scene: createDivineHandScene(), materials: createDivineHandMaterials(), journal: [], terminal: null };
}
export const createDivineHandEncounter = createDivineHandEncounterState;
export const isDivineHandEncounterStage = (s: SliceState) => s.progression.pathwayId === 'warrior' && s.progression.sequence === 1;
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
export function divineHandFinanceSnapshot(s: DivineHandFinanceSnapshot): DivineHandFinanceSnapshot {
  return { weeklyBudget: s.weeklyBudget, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: structuredClone(s.debts), missedWeeks: s.missedWeeks, credit: s.credit };
}
export function validateDivineHandFinanceSnapshot(v: DivineHandFinanceSnapshot, week: number): boolean {
  return shape(v, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit']) && integer(v.weeklyBudget, 1, 100) && Object.hasOwn(SLICE_LIFE, v.lifeTier) && Object.hasOwn(SLICE_LIFE, v.nextLifeTier) &&
    integer(v.missedWeeks) && ['NORMAL', 'NOTICE', 'SUSPENDED'].includes(v.credit) && Array.isArray(v.debts) && v.debts.every(d => shape(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek']) &&
      typeof d.id === 'string' && !!d.id && typeof d.source === 'string' && !!d.source && integer(d.remaining) && integer(d.weeklyPayment, 1) && integer(d.createdWeek, 0, week));
}
export function divineHandEncounterBudget(s: SliceState): DivineHandEncounterBudget {
  return { cash: s.cash, actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution, gender: s.character.gender,
    sequence: 1, acting: s.progression.acting, coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources], injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function validBudget(v: DivineHandEncounterBudget, revision: number): boolean {
  return shape(v, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) && integer(v.cash) &&
    integer(v.actions, 0, 100) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.pollution, 0, 100) && typeof v.gender === 'string' && v.sequence === 1 && integer(v.acting, 0, 100) &&
    shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) && Object.values(v.coreStats).every(n => integer(n, 0, 500)) && !!v.mastery && typeof v.mastery === 'object' && !Array.isArray(v.mastery) && Object.values(v.mastery).every(n => integer(n, 0, 500)) &&
    Array.isArray(v.completedSources) && v.completedSources.every(x => typeof x === 'string' && !!x) && new Set(v.completedSources).size === v.completedSources.length && validDivineHandInjuries(v.injuries, revision) && integer(v.injuryRisk);
}
export function validDivineHandMaterials(v: DivineHandMaterials): boolean {
  try { const initial=createDivineHandMaterials(),w=v.weapon;
    return shape(v,['weapon','marks'])&&shape(w,Object.keys(initial.weapon))&&['HAND','YARD'].includes(w.location)&&same({...w,location:'HAND'},initial.weapon)&&
      Array.isArray(v.marks)&&v.marks.length===3&&v.marks.every((m,i)=>shape(m,['id','owner','status','usedRound'])&&m.id===initial.marks[i]!.id&&m.owner===DIVINE_HAND_TARGET_ID&&(m.status==='HELD'?m.usedRound===null:m.status==='SPENT'&&integer(m.usedRound,1)));
  }catch{return false;}
}
function arrivalMaterials(before: DivineHandMaterials): DivineHandMaterials { return structuredClone(before); }
export function validateDivineHandPreparation(v: unknown): v is DivineHandPreparation {
  try { const p=v as DivineHandPreparation; return shape(p,['week','date','revision','runId','randomSeed','randomCursor','pricePaid','actionsPaid','lifeReflected','playerName','playerClubHeld','playerWeaponId','before','after','finance','materialsBefore','materialsAfter','originalsBefore','originalsAfter']) &&
    integer(p.week,1)&&isValidGameDate(p.date)&&integer(p.revision,1)&&typeof p.runId==='string'&&!!p.runId&&typeof p.randomSeed==='string'&&!!p.randomSeed&&integer(p.randomCursor)&&typeof p.playerClubHeld==='boolean'&&['town-short-club','warrior-training-club',null].includes(p.playerWeaponId)&&p.playerClubHeld===(p.playerWeaponId!==null)&&typeof p.playerName==='string'&&!!p.playerName.trim()&&p.pricePaid===0&&p.actionsPaid===1&&p.lifeReflected===true&&
    validBudget(p.before,p.revision)&&validBudget(p.after,p.revision)&&validateDivineHandFinanceSnapshot(p.finance,p.week)&&p.before.actions>=1&&p.before.actions<=Math.max(4,p.finance.weeklyBudget)&&same(p.after,{...p.before,actions:p.before.actions-1})&&
    validDivineHandMaterials(p.materialsBefore)&&validDivineHandMaterials(p.materialsAfter)&&same(p.materialsAfter,arrivalMaterials(p.materialsBefore))&&validDivineHandCombatOriginals(p.originalsBefore)&&p.originalsBefore.site.playerEnergy>=8&&same(p.originalsAfter,walkOriginals(p.originalsBefore,4));
  }catch{return false;}
}
export function validDivineHandScene(p: DivineHandScene): boolean {
  const initial=createDivineHandScene();
  return shape(p,Object.keys(initial)) && same({...p,playerLocation:'OUTSIDE',playerCoordinate:0,enemyCoordinate:6,visibleBodyLine:true,conditionVersion:1,observedConditionVersion:null,observedSourceId:null,observationWeek:null,clockSeconds:0,externalSeconds:0,playerTravelMetres:0,enemyTravelMetres:0,knownPlayerName:null,knownEnemyName:null},initial) &&
    typeof p.visibleBodyLine==='boolean' && integer(p.conditionVersion,1) && (p.observedConditionVersion===null||integer(p.observedConditionVersion,1,p.conditionVersion)) &&
    (p.playerLocation==='OUTSIDE'&&p.playerCoordinate===0||p.playerLocation==='YARD'&&p.playerCoordinate===4) && integer(p.clockSeconds) && p.externalSeconds===p.clockSeconds && integer(p.playerTravelMetres) && integer(p.enemyTravelMetres) && [6,7].includes(p.enemyCoordinate) &&
    (p.observedSourceId===null?p.observationWeek===null&&p.knownPlayerName===null&&p.knownEnemyName===null:typeof p.observedSourceId==='string'&&integer(p.observationWeek,1)&&typeof p.knownPlayerName==='string'&&!!p.knownPlayerName.trim()&&p.knownEnemyName==='奥斯卡·里德');
}
export function divineHandOriginalSnapshot(s:SliceState):DivineHandCombatOriginals{return{site:structuredClone(s.glory.life.site)};}
export function validDivineHandCombatOriginals(o:DivineHandCombatOriginals):boolean {
 try{
  const p=o.site;
  // Glory's historical validator binds its first consumed pad to its one old
  // load. The new paid life load may consume the second original pad, without
  // changing that exhausted rig. Validate this extension explicitly, then use
  // the old validator only for the remaining immutable shape. Exact life and
  // encounter event replay authenticates at most one additional original-pad consumption.
  const stock=p.pads.issuedWithPlateId===null?0:2,oldUses=p.load.appliedLoads;
  if(!shape(o,['site'])||!integer(oldUses,0,1)||!integer(p.pads.consumed,oldUses,Math.min(stock,oldUses+1))||!integer(p.pads.remaining,0,stock)||p.pads.remaining+p.pads.consumed!==stock)return false;
  const historical=structuredClone(p);historical.pads.remaining=stock-oldUses;historical.pads.consumed=oldUses;
  return validateGlorySiteState(historical)&&p.introducedWeek!==null&&p.playerLocation==='OUTSIDE'&&p.celia.location==='OUTSIDE'&&p.evan.location==='OUTSIDE'&&!p.pads.worn&&p.pads.location==='BENCH'&&!p.temper.active&&!p.guard.active&&p.plates.every(x=>x.location==='BENCH');
 }catch{return false;}
}
export function divineHandPlayerWeapon(s:SliceState):'town-short-club'|'warrior-training-club'|null{
 const c=s.warrior.practiceClub;return s.town.clubLocation==='HAND'?'town-short-club':c.id==='warrior-training-club'&&c.owner==='奥斯温·布莱克特'&&c.custodian==='PLAYER'&&c.location==='player:hand'?'warrior-training-club':null;
}
function walkOriginals(o:DivineHandCombatOriginals,metres:4):DivineHandCombatOriginals {
 const next=structuredClone(o);if(next.site.playerEnergy<metres)throw new Error('普通步行精力不足。');next.site.playerEnergy-=metres;next.site.playerTravelMetres+=metres;next.site.clockSeconds+=metres;return next;
}
function protectedOriginals(s:SliceState):string {
 const glory=structuredClone(s.glory);const {site: _site,...life}=glory.life;
 return stableStringify({warrior:s.warrior,gladiator:s.gladiator,weaponmaster:s.weaponmaster,dawnPaladin:s.dawnPaladin,guardian:s.guardian,demonHunter:s.demonHunter,silverKnight:s.silverKnight,glory:{...glory,life},town:s.town,life:s.divineHand.life});
}
function adultsAbsent(s:SliceState):boolean {
 const l=s.divineHand.life;return !hasDivineHandLifeLock(s)&&l.reflected&&l.pending===null&&l.activeCase===null&&Object.values(l.cases).every(c=>c.status==='RESOLVED')&&validDivineHandCombatOriginals(divineHandOriginalSnapshot(s));
}
function historyUnchanged(s:SliceState):boolean {const e=s.divineHand.encounter;return Array.isArray(e.originalHistory)&&same(e.originalHistory,s.combatHistory.slice(0,e.originalHistory.length));}
function expectedOriginals(s:SliceState):DivineHandCombatOriginals|null {
 const e=s.divineHand.encounter;if(e.terminal)return e.terminal.originalsAfter;
 const last=s.combatHistory.at(-1)?.divineHandOutcome;if(last&&e.startHistoryIndex!==null&&s.combatHistory.length>e.startHistoryIndex)return last.originalsAfter;
 return e.journal.at(-1)?.originalsAfter??e.preparation?.originalsAfter??null;
}
function originalsUnchanged(s:SliceState):boolean{return s.divineHand.encounter.originalResources===protectedOriginals(s)&&historyUnchanged(s)&&same(divineHandOriginalSnapshot(s),expectedOriginals(s));}
export function validateDivineHandEncounterCommand(v:unknown):v is DivineHandEncounterCommand {if(!v||typeof v!=='object'||Array.isArray(v))return false;const c=v as DivineHandEncounterCommand;return c.type==='ENCOUNTER_POLICY'?shape(c,['type','policy'])&&['INHERITED_ONLY','BEAM_STABILIZE','ARMOR_CONVERGENCE','ALL','ORDINARY'].includes(c.policy):shape(c,['type'])&&['ENCOUNTER_TALK','ENCOUNTER_FIGHT','LEAVE_ENCOUNTER'].includes(c.type);}
export const isDivineHandEncounterCommand=validateDivineHandEncounterCommand;
export const hasDivineHandEncounterLock=(s:SliceState):boolean=>['READY','FIGHTING'].includes(s.divineHand.encounter.status);
export const isInsideDivineHandEncounter=hasDivineHandEncounterLock;
export function blockDivineHandEncounter(s:SliceState,c:DivineHandEncounterCommand):string|null {
  if(!validateDivineHandEncounterCommand(c))return'遭遇命令无效。';const e=s.divineHand.encounter;
  if(!isDivineHandEncounterStage(s)||s.divineHand.promotionWeek===null||s.status!=='ACTIVE'||s.health<=0)return'须本人仍活着并完成神明之手晋升。';
  if(s.combat)return'先处理当前真实战斗。';if(!adultsAbsent(s))return'先收束三项生活实践、交回安全垫与原护片；本人、西莉娅和埃文须实际离开修理室。';if(s.world.city!=='BACKLUND')return'须实际在贝克兰德前庭。';
  if(c.type==='LEAVE_ENCOUNTER')return e.status==='READY'&&originalsUnchanged(s)?null:'须已亲自到场，才能普通离开。';
  if(s.activeEvent||s.eventQueue.length||s.pulse!=='NONE')return'先处理当前事件或周账。';if(s.mind<=0)return'需要清醒；到场后仍可普通退出。';
  if(c.type==='ENCOUNTER_TALK')return e.status!=='AVAILABLE'||e.preparation?'同一奥斯卡的争议不能重置。':s.glory.life.site.playerEnergy<8?'须留足到场和普通返程各4精力。':s.actionsRemaining<1?'到场需1行动；行动用尽仍可普通离开。':null;
  if(e.status!=='READY'||!e.preparation||!originalsUnchanged(s))return'须先亲自交谈并保留同一原人原物和旧记录。';
  if(c.type==='ENCOUNTER_POLICY')return c.policy===e.policy&&e.journal.some(j=>j.command.type==='ENCOUNTER_POLICY')?'已经采用这项策略。':null;
  if(!e.journal.some(j=>j.command.type==='ENCOUNTER_POLICY'))return'先明确选择本场策略；开战后不能更换。';return s.actionsRemaining<1?'开战需要1行动；和平离开不花行动。':null;
}
export const divineHandEncounterReason=blockDivineHandEncounter;
export function leaveDivineHandCombatScene(p:DivineHandScene):void {if(p.playerLocation!=='YARD'||p.playerCoordinate!==4)throw new Error('须从实际所在前庭离开。');p.playerLocation='OUTSIDE';p.playerCoordinate=0;p.playerTravelMetres+=4;p.clockSeconds+=4;p.externalSeconds+=4;}
function arrive(s:SliceState,p:DivineHandPreparation):DivineHandScene{return{...createDivineHandScene(),playerLocation:'YARD',playerCoordinate:4,observedSourceId:`${s.runId}:DH1-YARD:${p.revision}`,observationWeek:p.week,observedConditionVersion:1,clockSeconds:4,externalSeconds:4,playerTravelMetres:4,knownPlayerName:p.playerName,knownEnemyName:'奥斯卡·里德'};}
export function applyDivineHandEncounterCommand(s:SliceState,c:DivineHandEncounterCommand,ctx:SeerContext):void {
  const reason=blockDivineHandEncounter(s,c);if(reason)throw new Error(reason);const e=s.divineHand.encounter;
  if(c.type==='ENCOUNTER_TALK'){
    const before=divineHandEncounterBudget(s),materialsBefore=structuredClone(e.materials),originalsBefore=divineHandOriginalSnapshot(s);s.actionsRemaining--;e.materials=arrivalMaterials(e.materials);s.glory.life.site=walkOriginals(originalsBefore,4).site;
    e.preparation={week:s.week,date:{...s.date},revision:s.revision+1,runId:s.runId,randomSeed:s.random.seed,randomCursor:s.random.cursor,pricePaid:0,actionsPaid:1,lifeReflected:true,playerName:s.character.name,playerClubHeld:divineHandPlayerWeapon(s)!==null,playerWeaponId:divineHandPlayerWeapon(s),before,after:divineHandEncounterBudget(s),finance:divineHandFinanceSnapshot(s),materialsBefore,materialsAfter:structuredClone(e.materials),originalsBefore,originalsAfter:divineHandOriginalSnapshot(s)};
    e.originalHistory=structuredClone(s.combatHistory);e.originalResources=protectedOriginals(s);e.scene=arrive(s,e.preparation);e.status='READY';
    ctx.note('走到前庭与奥斯卡交谈',`实付1行动，步行4米4秒，并看清脚边一米的侧步位置。你介绍姓名“${s.character.name}”，43岁的奥斯卡·里德也报出姓名。他持自己的唯一原棍与三枚有限印记，身体100、精神100、灵性120。西莉娅与埃文已经实际离开原修理室。你实际支付4精力，同一原甲仍在身上；马丁仍是活着投降，旧猎物原结果保持不变。`);return;
  }
  const entry:DivineHandEncounterJournal={command:structuredClone(c),week:s.week,date:{...s.date},revision:s.revision+1,randomCursor:s.random.cursor,before:divineHandEncounterBudget(s),after:divineHandEncounterBudget(s),finance:divineHandFinanceSnapshot(s),sceneBefore:structuredClone(e.scene),sceneAfter:structuredClone(e.scene),materialsBefore:structuredClone(e.materials),materialsAfter:structuredClone(e.materials),originalsBefore:divineHandOriginalSnapshot(s),originalsAfter:divineHandOriginalSnapshot(s)};
  if(c.type==='ENCOUNTER_POLICY'){e.policy=c.policy;ctx.note('选择本场交战策略',c.policy==='ORDINARY'?'本场只作普通动作；不施放抽到的能力。':c.policy==='INHERITED_ONLY'?'本场只允许已学能力；两项新能力回到普通防备。':'仅在所选能力抽到、实际对象与资源齐备时尝试。每轮各一次，失败照付，空窗口没有掌握奖励。');}
  else if(c.type==='LEAVE_ENCOUNTER'){leaveDivineHandCombatScene(e.scene);s.glory.life.site=walkOriginals(divineHandOriginalSnapshot(s),4).site;e.status='RESOLVED';ctx.note('沿普通路和平离开前庭','沿开放出口实际走4米4秒、扣4精力。没有战斗或奖励，奥斯卡与自己的棍和剩余印记留在前庭。');}
  else{s.actionsRemaining--;e.status='FIGHTING';e.attemptWeek=s.week;e.startHistoryIndex=s.combatHistory.length;s.combat={encounterId:'DIVINE_HAND_DISPUTE',round:1,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemyInjuries:structuredClone(e.enemyInjuries),enemyRisk:e.enemyRisk,enemyStatus:'RESISTING',lastRound:null};ctx.note('选择与奥斯卡交战','实付1行动。双方各自最多六次实际行动，精神压力与身体伤害各有实际来源。普通撤退、停止抵抗、伤势与真实死亡照常。');}
  entry.after=divineHandEncounterBudget(s);entry.sceneAfter=structuredClone(e.scene);entry.materialsAfter=structuredClone(e.materials);entry.originalsAfter=divineHandOriginalSnapshot(s);e.journal.push(entry);
  if(c.type==='ENCOUNTER_FIGHT'){const source=currentDivineHandCombatSource(s);if(!source)throw new Error('真实战斗来源不完整。');e.startSource={...source,revision:s.revision+1};}
}
export const applyDivineHandEncounter=applyDivineHandEncounterCommand;
export const handleDivineHandEncounter=applyDivineHandEncounterCommand;
export function startDivineHandEncounter(s:SliceState,ctx:SeerContext):void{applyDivineHandEncounterCommand(s,{type:'ENCOUNTER_FIGHT'},ctx);}
export function hasDivineHandDisputeOpponent(s:SliceState):boolean {
  const e=s.divineHand?.encounter,c=s.combat;return isDivineHandEncounterStage(s)&&s.status==='ACTIVE'&&!s.activeEvent&&s.world.city==='BACKLUND'&&s.health>0&&s.mind>0&&s.divineHand.promotionWeek!==null&&!!e&&e.status==='FIGHTING'&&e.targetId===DIVINE_HAND_TARGET_ID&&e.terminal===null&&e.preparation!==null&&e.materials.marks.filter(m=>m.status==='SPENT').length===e.powerUses.BODY_MARK+e.powerUses.MENTAL_MARK&&originalsUnchanged(s)&&e.attemptWeek===s.week&&adultsAbsent(s)&&
    validDivineHandScene(e.scene)&&e.scene.playerLocation==='YARD'&&e.scene.knownPlayerName===s.character.name&&validDivineHandMaterials(e.materials)&&validDivineHandBody(e)&&e.weaponLocation===e.materials.weapon.location&&c?.encounterId==='DIVINE_HAND_DISPUTE'&&c.enemyStatus==='RESISTING'&&c.enemyHealth>0&&c.enemyMind>0&&e.enemyStatus==='RESISTING'&&e.enemyHealth===c.enemyHealth&&e.enemyMind===c.enemyMind&&same(e.enemyInjuries,c.enemyInjuries)&&e.enemyRisk===c.enemyRisk&&integer(c.round,1)&&e.startHistoryIndex!==null&&integer(e.startHistoryIndex)&&s.combatHistory.length-e.startHistoryIndex===c.round-1;
}
function terminalScene(o:DivineHandRoundOutcome):{root:DivineHandScene;exit:0|4;materials:DivineHandMaterials;originals:DivineHandCombatOriginals}{const root=structuredClone(o.rootAfter),materials=structuredClone(o.materialsAfter),exit=o.playerHealthAfter>0?4:0,originals=exit?walkOriginals(o.originalsAfter,4):structuredClone(o.originalsAfter);if(exit)leaveDivineHandCombatScene(root);return{root,exit,materials,originals};}
export function settleDivineHandEncounter(s:SliceState,outcome:string,ctx:SeerContext,_award?:(source:string,amount:5|8|25)=>void):void {
  const e=s.divineHand.encounter,c=s.combat;if(e.status!=='FIGHTING'||c?.encounterId!=='DIVINE_HAND_DISPUTE')throw new Error('没有这场前庭冲突。');if(outcome==='CONTINUE')return;const last=c.lastRound,o=last?.divineHandOutcome;
  if(!last||!o||!validateDivineHandCombatRound(last)||o.continuing||e.terminal||e.startHistoryIndex===null||c.round!==last.round+1||s.combatHistory.length-e.startHistoryIndex!==last.round||!originalsUnchanged(s)||!same(s.combatHistory.at(-1),last)||!same(combatBody(e),combatBody(o))||!same(o.rootAfter,e.scene)||!same(o.materialsAfter,e.materials)||o.playerHealthAfter!==s.health||o.playerMindAfter!==s.mind||o.playerSpiritualityAfter!==s.spirituality||!same(o.masteryAfter,s.progression.mastery)||!same(o.playerInjuriesAfter,s.injuries)||o.playerRiskAfter!==s.injuryRisk||o.enemyHealth!==c.enemyHealth||o.enemyMind!==c.enemyMind||!same(o.enemyInjuries,c.enemyInjuries)||o.enemyRisk!==c.enemyRisk||o.enemyStatus!==c.enemyStatus||outcome!==(o.playerHealthAfter===0?'PLAYER_DEAD':o.enemyHealth===0?'ENEMY_DEAD':o.enemyStatus==='SURRENDERED'?'ENEMY_SURRENDERED':'RETREATED'))throw new Error('结局与真实回合、原人原物和费用不一致。');
  const final=terminalScene(o);e.scene=final.root;e.materials=final.materials;s.glory.life.site=structuredClone(final.originals.site);e.terminal={outcome:outcome as DivineHandEncounterTerminal['outcome'],round:last.round,historyIndex:s.combatHistory.length-1,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,enemyStatus:e.enemyStatus,exitMetres:final.exit,exitSeconds:final.exit,originalsBefore:structuredClone(o.originalsAfter),originalsAfter:structuredClone(final.originals)};e.status=outcome==='PLAYER_DEAD'?'LOST':outcome==='RETREATED'?'RETREATED':'RESOLVED';s.combat=null;
  ctx.note('奥斯卡的前庭冲突结束',`${final.exit?'本人沿普通出口走4米4秒。':'本人的原身体真实死亡。'}双方原灵性、精神、伤势与棍落点、三枚印记的实际消耗保留，没有复活或补发。西莉娅、埃文和旧人物保持原状；原甲实际磨损、场地时钟、行程与精力已记账。`);
}
export const finishDivineHandEncounter=settleDivineHandEncounter;
export function divineHandEncounterActions(s:SliceState){
  if(!isDivineHandEncounterStage(s))return[];
  const choices:{command:DivineHandEncounterCommand;label:string;cost:string}[]=[
    {command:{type:'ENCOUNTER_TALK'},label:s.divineHand.encounter.scene.knownEnemyName?'到庭院与奥斯卡交谈':'走近庭院中的独立对手',cost:'1行动、4米4秒；用尽行动仍可和平离开'},
    ...DIVINE_HAND_POLICIES.map(policy=>({command:{type:'ENCOUNTER_POLICY' as const,policy},label:({INHERITED_ONLY:'只用已学能力',BEAM_STABILIZE:'允许接触稳持',ARMOR_CONVERGENCE:'允许护甲合势',ALL:'允许两项新能力',ORDINARY:'只作普通行动'})[policy],cost:'0行动；开战前明确选择'})),
    {command:{type:'ENCOUNTER_FIGHT'},label:'自主承担真实冲突',cost:'1行动；真实伤势与死亡风险'},
    {command:{type:'LEAVE_ENCOUNTER'},label:'沿普通路和平离开',cost:'0行动、4米4秒'}];
  return choices.map(({command,label,cost})=>{const reason=blockDivineHandEncounter(s,command);return{id:`DH1-${command.type}${command.type==='ENCOUNTER_POLICY'?'-'+command.policy:''}`,command,label,cost,enabled:reason===null,reason,cleanup:command.type==='LEAVE_ENCOUNTER'};});
}
export const DIVINE_HAND_ENCOUNTER_STORY='一名独立成人在净空庭院提出争议。本人、西莉娅与埃文须先实际离开修理室，交回借用安全垫与原护片。沿四米普通路到场，亲自交谈、明确策略后，再决定交战或和平离开。';
export function projectDivineHandEncounter(s:SliceState){const e=s.divineHand.encounter,known=e.scene.knownEnemyName!==null;return{title:known?'奥斯卡的庭院争议':'庭院中的独立对手',story:isDivineHandEncounterStage(s)?(known?'43岁的奥斯卡·里德以独立身体与精神自主行动，持自己的唯一原棍和三枚有限印记。马丁仍活着，旧人物与猎物的结果保持不变。':DIVINE_HAND_ENCOUNTER_STORY):'',status:e.status,inside:hasDivineHandEncounterLock(s),policy:e.policy,policyConfirmed:e.journal.some(j=>j.command.type==='ENCOUNTER_POLICY'),scene:structuredClone(e.scene),materials:structuredClone(e.materials),
 enemy:{id:e.targetId,name:known?'奥斯卡·里德':null,age:known?43:null,sequence:known?1:null,health:e.enemyHealth,mind:e.enemyMind,spirituality:e.enemySpirituality,status:e.enemyStatus,weaponLocation:e.weaponLocation,powerUses:{...e.powerUses}},actions:divineHandEncounterActions(s),facts:[
 '接触稳持每轮一次：8灵性2精神、知识18。只稳定本人实际握持的原棍，20秒内下一次实际普通打击辅助30；没有原棍则普通行动。',
 '护甲合势每轮一次：8灵性2精神、意志18。20秒内仅下一次可见身体冲击减势30，实际碰甲才磨损同一原甲5，不挡精神、不撤销旧伤。',
 '银甲淬护仍用6灵性、知识20，下一实际身体冲击减势45且磨损5；近身护持仍用6灵性、意志20，成功实付5健康，只得防守优势30。',
 '三枚原印记共用有限库存，每次实耗7灵性与一枚；身体印记75走身体伤势，精神印记65走精神后果。用尽后只用原棍。',
 '对手真实侧移与遮挡能使未用窗口失效；重新观察须实际侧步并支付精力。失败照付，只在真实应用后增长掌握。',
 '体45%、感20%、意25%、知10%；双方1至6动作10/15/25/25/15/10，基础1250、底125、灵性上限120，仅继续轮恢复12。',
 '每槽实际5秒，一轮实际60秒；精神耗尽仍活着停战，身体死亡终结本周目。生还者沿4米普通路离场，实际扣4精力。',
 `当前原甲完整度${s.glory.life.site.armor?.integrity??0}；原安全垫余${s.glory.life.site.pads.remaining}仍在工作台，旧负载余${s.glory.life.site.load.remainingLoads}。本场不生成或领取它们。`]};}
export type DivineHandEncounterProjection=ReturnType<typeof projectDivineHandEncounter>;

/** Exact shared finance transition after a completed, unlocked action. Locked
 * READY/FIGHTING scenes never pay a bill or grant next-week actions early. */
export function divineHandCompletedBudgetMatches(s:SliceState,expected:DivineHandEncounterBudget,finance:DivineHandFinanceSnapshot,week:number,date:PublicGameDate,revision:number,randomCursor:number,anchorTitle:string):boolean {
 const current=divineHandEncounterBudget(s);
 if(!same({...current,cash:expected.cash,actions:expected.actions},expected)||s.random.cursor!==randomCursor)return false;
 const titles=['本周生活费','生活费如实记账','本周约定还款','账目结清','新的一周'];
 const receipts=s.chronicle.filter((entry,index)=>entry.id===`record-${s.revision}-${index}`&&titles.includes(entry.title));
 if(expected.actions>0||expected.health===0)return s.week===week&&same(s.date,date)&&s.actionsRemaining===expected.actions&&s.cash===expected.cash&&same(divineHandFinanceSnapshot(s),finance)&&s.pulse==='NONE'&&s.billAmount===0&&s.activeEvent===null&&s.eventQueue.length===0&&receipts.length===0;
 if(expected.actions!==0||s.status!=='ACTIVE')return false;
 const result=resolveSliceWeeklyFinance({...finance,cash:expected.cash,week,revision:revision-1,pulse:'BILL',billAmount:0}),advanced=result.eventId===null&&result.state.pulse==='ADVANCE';
 const finalFinance={...finance,...result.state,weeklyBudget:finance.weeklyBudget,lifeTier:advanced?result.state.nextLifeTier:finance.lifeTier};
 if(s.cash!==result.state.cash||!same(divineHandFinanceSnapshot(s),divineHandFinanceSnapshot(finalFinance))||s.week!==week+(advanced?1:0)||!same(s.date,advanced?addGameWeeks(date,1):date)||s.actionsRemaining!==(advanced?finance.weeklyBudget:0)||s.pulse!==(advanced?'NONE':result.state.pulse)||s.billAmount!==(advanced?0:result.state.billAmount))return false;
 const expectedReceipts=result.receipts.map(receipt=>({week,...receipt}));if(advanced)expectedReceipts.push({week:week+1,title:'新的一周',text:`日期推进7天，本周${finance.weeklyBudget}次行动。`});
 if(!same(receipts.map(({week,title,text})=>({week,title,text})),expectedReceipts))return false;
 if(result.eventId){const anchor=s.chronicle.findIndex((entry,index)=>entry.id===`record-${s.revision}-${index}`&&entry.title===anchorTitle),eventIndex=anchor+1+result.receipts.length;return anchor>=0&&s.eventQueue.length===0&&same(s.activeEvent,{id:result.eventId,instanceId:`${s.runId}:${result.eventId}:${s.revision}:${eventIndex}`});}
 return s.activeEvent===null&&s.eventQueue.length===0;
}
export function divineHandTerminalBudgetMatches(s:SliceState,_prep:DivineHandPreparation,o:DivineHandRoundOutcome):boolean {
 const fight=s.divineHand.encounter.journal.find(j=>j.command.type==='ENCOUNTER_FIGHT');if(!fight)return false;
 const expected={...fight.after,health:o.playerHealthAfter,mind:o.playerMindAfter,spirituality:o.playerSpiritualityAfter,mastery:o.masteryAfter,injuries:o.playerInjuriesAfter,injuryRisk:o.playerRiskAfter};
 return same(s.divineHand.encounter.scene,terminalScene(o).root)&&same(s.divineHand.encounter.materials,terminalScene(o).materials)&&same(divineHandOriginalSnapshot(s),terminalScene(o).originals)&&divineHandCompletedBudgetMatches(s,expected,fight.finance,fight.week,fight.date,o.source.revision+1,o.randomCursorAfter,'奥斯卡的前庭冲突结束');
}
function peacefulBudgetMatches(s:SliceState,e:DivineHandEncounterJournal):boolean{return e.command.type==='LEAVE_ENCOUNTER'&&divineHandCompletedBudgetMatches(s,e.after,e.finance,e.week,e.date,e.revision,e.randomCursor,'沿普通路和平离开前庭');}
export function replayDivineHandPurchases(s:SliceState):DivineHandMaterials|null { return Array.isArray(s.divineHand.encounter.purchases)&&s.divineHand.encounter.purchases.length===0?createDivineHandMaterials():null; }
/** Exact root and source-chain replay. Historical rounds are immutable; a later
 * ordinary rest may change the live player but cannot alter a recorded fight. */
export function replayDivineHandEncounterRoot(s:SliceState):DivineHandScene|null {
 try{
  const e=s.divineHand.encounter,initial=createDivineHandEncounterState(),allNew=s.combatHistory.flatMap((r,i)=>r.divineHandOutcome?[i]:[]),purchased=replayDivineHandPurchases(s);
  if(!e||!shape(e,Object.keys(initial))||!['AVAILABLE','READY','FIGHTING','RESOLVED','RETREATED','LOST'].includes(e.status)||e.targetId!==initial.targetId||!['INHERITED_ONLY','BEAM_STABILIZE','ARMOR_CONVERGENCE','ALL','ORDINARY'].includes(e.policy)||!validDivineHandBody(e)||!validDivineHandScene(e.scene)||!validDivineHandMaterials(e.materials)||e.weaponLocation!==e.materials.weapon.location||!purchased)return null;
  if(!e.preparation)return same({...e,purchases:[],materials:createDivineHandMaterials()},initial)&&same(e.materials,purchased)&&allNew.length===0&&s.combat?.encounterId!=='DIVINE_HAND_DISPUTE'?createDivineHandScene():null;
  const prep=e.preparation;
  if(!isDivineHandEncounterStage(s)||s.divineHand.promotionWeek===null||!s.divineHand.life.reflected||!validateDivineHandPreparation(prep)||prep.runId!==s.runId||prep.playerName!==s.character.name||prep.randomSeed!==s.random.seed||prep.randomCursor>s.random.cursor||!integer(prep.week,s.divineHand.promotionWeek,s.week)||compareGameDates(prep.date,s.date)>0||!integer(prep.revision,1,s.revision)||!historyUnchanged(s)||typeof e.originalResources!=='string'||!e.originalResources||!Array.isArray(e.journal)||!same(prep.materialsBefore,purchased))return null;
  let policyChosen=false,root=arrive(s,prep),status:DivineHandEncounterState['status']='READY',policy:DivineHandPolicy='INHERITED_ONLY',materials=structuredClone(prep.materialsAfter);
  let budget=prep.after,finance=prep.finance,week=prep.week,date=prep.date,revision=prep.revision,originals=structuredClone(prep.originalsAfter);
  for(const entry of e.journal){
   if(!shape(entry,['command','week','date','revision','randomCursor','before','after','finance','sceneBefore','sceneAfter','materialsBefore','materialsAfter','originalsBefore','originalsAfter'])||!validateDivineHandEncounterCommand(entry.command)||!['ENCOUNTER_POLICY','ENCOUNTER_FIGHT','LEAVE_ENCOUNTER'].includes(entry.command.type)||!validBudget(entry.before,entry.revision)||!validBudget(entry.after,entry.revision)||!validateDivineHandFinanceSnapshot(entry.finance,entry.week)||!integer(entry.revision,revision+1,s.revision)||entry.randomCursor!==prep.randomCursor||!same(entry.sceneBefore,root)||!same(entry.materialsBefore,materials)||!same(entry.originalsBefore,originals)||status!=='READY'||entry.week!==week||!same(entry.date,date)||!same(entry.before,budget)||!same(entry.finance,finance))return null;
   if(entry.command.type==='ENCOUNTER_POLICY'){if(policyChosen&&entry.command.policy===policy)return null;policy=entry.command.policy;policyChosen=true;}
   else if(entry.command.type==='ENCOUNTER_FIGHT'){if(!policyChosen||root.playerLocation!=='YARD'||entry.before.actions<1)return null;status='FIGHTING';}
   else{leaveDivineHandCombatScene(root);originals=walkOriginals(originals,4);status='RESOLVED';}
   if(!same(entry.after,{...entry.before,actions:entry.before.actions-(entry.command.type==='ENCOUNTER_FIGHT'?1:0)})||!same(entry.sceneAfter,root)||!same(entry.materialsAfter,materials)||!same(entry.originalsAfter,originals))return null;
   budget=entry.after;finance=entry.finance;week=entry.week;date=entry.date;revision=entry.revision;
  }
  if(e.policy!==policy)return null;
  if(status!=='FIGHTING'){
   if(e.status!==status||e.startHistoryIndex!==null||e.startSource!==null||e.attemptWeek!==null||e.terminal!==null||!same(combatBody(e),initialDivineHandBody())||!same(e.materials,materials)||allNew.length||s.combat?.encounterId==='DIVINE_HAND_DISPUTE')return null;
   if(status==='READY'||s.revision===revision){
    if(!originalsUnchanged(s)||!adultsAbsent(s))return null;
    if(status==='READY'){if(!same(divineHandEncounterBudget(s),budget)||!same(divineHandFinanceSnapshot(s),finance)||s.week!==week||!same(s.date,date)||s.random.cursor!==prep.randomCursor||s.pulse!=='NONE'||s.billAmount!==0||s.activeEvent||s.eventQueue.length)return null;}
    else if(!e.journal.at(-1)||!peacefulBudgetMatches(s,e.journal.at(-1)!))return null;
   }
   return root;
  }
  const start=e.startSource;
  if(!start||!validDivineHandCombatSource(start)||!integer(e.startHistoryIndex,0,s.combatHistory.length)||e.startHistoryIndex!==e.originalHistory!.length||e.attemptWeek!==week||start.round!==1||start.revision!==revision||start.week!==week||!same(start.date,date)||start.startHistoryIndex!==e.startHistoryIndex||start.runId!==s.runId||!same(start.preparation,prep)||start.policy!==policy||!same(start.body,initialDivineHandBody())||!same(start.root,root)||!same(start.materials,materials)||!same(start.originals,originals)||start.randomSeed!==s.random.seed||start.randomCursor!==prep.randomCursor||start.playerHealth!==budget.health||start.playerMind!==budget.mind||start.playerSpirituality!==budget.spirituality||!same(start.mastery,budget.mastery)||!same(start.playerInjuries,budget.injuries)||start.playerRisk!==budget.injuryRisk)return null;
  const terminal=e.terminal;
  if(terminal&&(!shape(terminal,['outcome','round','historyIndex','enemyHealth','enemyMind','enemySpirituality','enemyStatus','exitMetres','exitSeconds','originalsBefore','originalsAfter'])||!integer(terminal.historyIndex,e.startHistoryIndex,s.combatHistory.length-1)))return null;
  const end=terminal?terminal.historyIndex+1:s.combatHistory.length,rounds=s.combatHistory.slice(e.startHistoryIndex,end);
  if(!same(allNew,rounds.map((_r,i)=>e.startHistoryIndex!+i)))return null;
  for(const[i,round]of rounds.entries()){const o=round.divineHandOutcome,previous=rounds[i-1]?.divineHandOutcome;if(!o||!validateDivineHandCombatRound(round)||round.round!==i+1||o.source.revision>=s.revision||o.randomCursorAfter>s.random.cursor||!same(o.source,previous?nextDivineHandCombatSource(previous):start)||!same(o.source.root,root)||!same(o.source.originals,originals)||i<rounds.length-1&&!o.continuing)return null;root=structuredClone(o.rootAfter);materials=structuredClone(o.materialsAfter);originals=structuredClone(o.originalsAfter);}
  const last=rounds.at(-1),o=last?.divineHandOutcome;
  if(e.status==='FIGHTING'){
   if(terminal||!hasDivineHandDisputeOpponent(s)||!same(combatBody(e),o?combatBody(o):start.body)||!same(e.materials,materials))return null;
   const current=divineHandEncounterBudget(s),expected={...budget,health:o?.playerHealthAfter??start.playerHealth,mind:o?.playerMindAfter??start.playerMind,spirituality:o?Math.min(120,o.playerSpiritualityAfter+12):start.playerSpirituality,mastery:o?.masteryAfter??start.mastery,injuries:o?.playerInjuriesAfter??start.playerInjuries,injuryRisk:o?.playerRiskAfter??start.playerRisk};
   if(!same(current,expected)||!same(divineHandFinanceSnapshot(s),finance)||s.week!==week||!same(s.date,date)||s.pulse!=='NONE'||s.billAmount!==0||s.activeEvent!==null||s.eventQueue.length)return null;
   return o?o.continuing&&same(last,s.combat!.lastRound)&&same(currentDivineHandCombatSource(s),nextDivineHandCombatSource(o))?root:null:s.combat!.lastRound===null&&same(currentDivineHandCombatSource(s),start)?root:null;
  }
  if(s.combat?.encounterId==='DIVINE_HAND_DISPUTE'||!terminal||!last||!o||o.continuing||terminal.round!==last.round||rounds.length!==terminal.round||!same(combatBody(e),combatBody(o))||terminal.enemyHealth!==e.enemyHealth||terminal.enemyMind!==e.enemyMind||terminal.enemySpirituality!==e.enemySpirituality||terminal.enemyStatus!==e.enemyStatus)return null;
  const final=terminalScene(o);if(terminal.exitMetres!==final.exit||terminal.exitSeconds!==final.exit||!same(terminal.originalsBefore,o.originalsAfter)||!same(terminal.originalsAfter,final.originals)||!same(e.materials,final.materials))return null;
  if(s.revision===o.source.revision+1&&(!originalsUnchanged(s)||!divineHandTerminalBudgetMatches(s,prep,o)))return null;
  if(terminal.outcome==='PLAYER_DEAD')return e.status==='LOST'&&s.status==='DEAD'&&o.playerHealthAfter===0?final.root:null;
  if(terminal.outcome==='RETREATED')return e.status==='RETREATED'&&o.playerHealthAfter>0&&(last.retreat==='SUCCESS'||o.playerMindAfter===0)?final.root:null;
  return e.status==='RESOLVED'&&o.playerHealthAfter>0&&(terminal.outcome==='ENEMY_DEAD'?e.enemyStatus==='DEAD':terminal.outcome==='ENEMY_SURRENDERED'&&e.enemyStatus==='SURRENDERED')?final.root:null;
 }catch{return null;}
}
export function validateDivineHandEncounter(s:SliceState):boolean {try{const root=replayDivineHandEncounterRoot(s);return root!==null&&same(root,s.divineHand.encounter.scene);}catch{return false;}}
export const validateDivineHandEncounterState=validateDivineHandEncounter;
/** The same original armor, player travel, clock and energy form an exact event
 * chain. The final round and physical exit share one public revision. This is a
 * projection only: encounter replay authenticates every value without invoking
 * life replay, so the shared resource ledger has no validation recursion. */
export function divineHandEncounterOriginalEvents(s:SliceState):{revision:number;week:number;before:DivineHandCombatOriginals;after:DivineHandCombatOriginals}[]{
 const e=s.divineHand.encounter;if(!e.preparation)return[];
 const events=[{revision:e.preparation.revision,week:e.preparation.week,before:structuredClone(e.preparation.originalsBefore),after:structuredClone(e.preparation.originalsAfter)},...e.journal.map(j=>({revision:j.revision,week:j.week,before:structuredClone(j.originalsBefore),after:structuredClone(j.originalsAfter)}))];
 if(e.startHistoryIndex!==null){const end=e.terminal?e.terminal.historyIndex+1:s.combatHistory.length;for(const round of s.combatHistory.slice(e.startHistoryIndex,end)){const o=round.divineHandOutcome;if(!o)continue;events.push({revision:o.source.revision+1,week:o.source.week,before:structuredClone(o.source.originals),after:structuredClone(e.terminal?.round===o.round?e.terminal.originalsAfter:o.originalsAfter)});}}
 return events.sort((a,b)=>a.revision-b.revision);
}
