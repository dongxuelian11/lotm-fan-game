import { SLICE_LIFE } from '../../content/slice-events.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { addGameWeeks, compareGameDates, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceCombatRound, SliceInjury, SliceState } from '../slice/types.js';
import type { CivilizationEnlightenerAction } from './types.js';
import { hasCivilizationEnlightenerLifeLock, civilizationEnlightenerLifeOriginalTail, type CivilizationEnlightenerOriginalSnapshot } from './life.js';
import type { AlchemistCreation } from '../alchemist/life.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { currentCivilizationEnlightenerCombatSource, nextCivilizationEnlightenerCombatSource, validCivilizationEnlightenerCombatSource, validateCivilizationEnlightenerCombatRound,
  validCivilizationEnlightenerBody, validCivilizationEnlightenerInjuries, type CivilizationEnlightenerCombatSource, type CivilizationEnlightenerRoundOutcome } from './combat.js';

export const CIVILIZATION_ENLIGHTENER_TARGET_ID = 'CE1-ADRIAN-HALE' as const;
export const CIVILIZATION_ENLIGHTENER_SITE = 'CE1-OPEN-WORKSHOP-YARD' as const;
export const CIVILIZATION_ENLIGHTENER_POWER_IDS = ['MECHANICAL_PULSE', 'MIND_PRESSURE', 'WARD', 'ATTENTION'] as const;
export type CivilizationEnlightenerPowerId = typeof CIVILIZATION_ENLIGHTENER_POWER_IDS[number];
export type CivilizationEnlightenerEnemyIntent = CivilizationEnlightenerPowerId | 'BODY_STRIKE' | 'OBSERVE' | 'ACCIDENT';
export type CivilizationEnlightenerPolicy = 'INHERITED_ONLY' | 'PROCESS_ANALYSIS' | 'OPERATIONAL_GUIDANCE' | 'ALL' | 'ORDINARY';
export const CIVILIZATION_ENLIGHTENER_POWERS = [
  { id: 'MECHANICAL_PULSE', label: '可见机械脉冲', cost: 7, selfGain: 95, enemyReduction: 0 },
  { id: 'MIND_PRESSURE', label: '有限精神压力', cost: 7, selfGain: 70, enemyReduction: 0 },
  { id: 'WARD', label: '有限护持', cost: 6, selfGain: 0, enemyReduction: 60 },
  { id: 'ATTENTION', label: '集中精神抵抗', cost: 3, selfGain: 0, enemyReduction: 0 },
] as const;
export interface CivilizationEnlightenerMaterials {
  weapon: { id: 'CE1-ADRIAN-ROD'; sourceId: 'CE1-ADRIAN-OWNED-ROD-1'; owner: typeof CIVILIZATION_ENLIGHTENER_TARGET_ID;
    massKg: 2; location: 'HAND' | 'YARD'; condition: 100 };
  mechanism: { id: 'CE1-VISIBLE-MECHANISM-1'; owner: typeof CIVILIZATION_ENLIGHTENER_TARGET_ID; location: 'YARD'; charge: number; capacity: 4; visible: true };
}
export function createCivilizationEnlightenerMaterials(): CivilizationEnlightenerMaterials {
  return { weapon: { id: 'CE1-ADRIAN-ROD', sourceId: 'CE1-ADRIAN-OWNED-ROD-1', owner: CIVILIZATION_ENLIGHTENER_TARGET_ID, massKg: 2, location: 'HAND', condition: 100 }, mechanism: { id: 'CE1-VISIBLE-MECHANISM-1', owner: CIVILIZATION_ENLIGHTENER_TARGET_ID, location: 'YARD', charge: 4, capacity: 4, visible: true } };
}
export interface CivilizationEnlightenerScene {
  siteId: typeof CIVILIZATION_ENLIGHTENER_SITE; playerLocation: 'WORKSHOP' | 'YARD'; playerCoordinate: 0 | 4; enemyCoordinate: 6;
  ordinaryExit: 'OPEN'; thirdPartiesInArea: 0; presentMemberIds: string[]; observedSourceId: string | null; observationWeek: number | null;
  clockSeconds: number; externalSeconds: number; playerTravelMetres: number; knownPlayerName: string | null; knownEnemyName: string | null;
}
export function createCivilizationEnlightenerScene(): CivilizationEnlightenerScene {
  return { siteId: CIVILIZATION_ENLIGHTENER_SITE, playerLocation: 'WORKSHOP', playerCoordinate: 0, enemyCoordinate: 6, ordinaryExit: 'OPEN', thirdPartiesInArea: 0,
    presentMemberIds: [], observedSourceId: null, observationWeek: null, clockSeconds: 0, externalSeconds: 0, playerTravelMetres: 0, knownPlayerName: null, knownEnemyName: null };
}
export interface CivilizationEnlightenerCombatBody {
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  weaponLocation: 'HAND' | 'YARD'; powerUses: Record<CivilizationEnlightenerPowerId, number>;
  totalOwnerMindSpent: number; analysisAttempts: number; analysisSuccesses: number; guidanceAttempts: number; guidanceSuccesses: number;
}
export function initialCivilizationEnlightenerBody(): CivilizationEnlightenerCombatBody {
  return { enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0, weaponLocation: 'HAND',
    powerUses: { MECHANICAL_PULSE: 0, MIND_PRESSURE: 0, WARD: 0, ATTENTION: 0 }, totalOwnerMindSpent: 0, analysisAttempts: 0, analysisSuccesses: 0, guidanceAttempts: 0, guidanceSuccesses: 0 };
}

export function combatBody(e: CivilizationEnlightenerCombatBody): CivilizationEnlightenerCombatBody {
  return Object.fromEntries(Object.keys(initialCivilizationEnlightenerBody()).map(k => [k, structuredClone(e[k as keyof CivilizationEnlightenerCombatBody])])) as unknown as CivilizationEnlightenerCombatBody;
}
export type CivilizationEnlightenerFinanceSnapshot = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface CivilizationEnlightenerEncounterBudget {
  cash: number; actions: number; health: number; mind: number; spirituality: number; pollution: number; gender: string; sequence: 1;
  acting: number; coreStats: SliceState['character']['coreStats']; mastery: Record<string, number>; completedSources: string[]; injuries: SliceInjury[]; injuryRisk: number;
}
export interface CivilizationEnlightenerPreparation {
  week: number; date: PublicGameDate; revision: number; runId: string; randomSeed: string; randomCursor: number; pricePaid: 0; actionsPaid: 1;
  lifeReflected: true; playerName: string; playerClubHeld: boolean; before: CivilizationEnlightenerEncounterBudget; after: CivilizationEnlightenerEncounterBudget; finance: CivilizationEnlightenerFinanceSnapshot; originalsBefore: AlchemistCreation[]; originalsAfter: AlchemistCreation[];
}
export type CivilizationEnlightenerEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' } | { type: 'ENCOUNTER_POLICY'; policy: CivilizationEnlightenerPolicy };
export interface CivilizationEnlightenerEncounterJournal {
  command: Exclude<CivilizationEnlightenerEncounterCommand, { type: 'ENCOUNTER_TALK' }>; week: number; date: PublicGameDate; revision: number; randomCursor: number;
  before: CivilizationEnlightenerEncounterBudget; after: CivilizationEnlightenerEncounterBudget; finance: CivilizationEnlightenerFinanceSnapshot; sceneBefore: CivilizationEnlightenerScene; sceneAfter: CivilizationEnlightenerScene; originalsBefore: AlchemistCreation[]; originalsAfter: AlchemistCreation[];
}
export interface CivilizationEnlightenerEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: CivilizationEnlightenerCombatBody['enemyStatus']; exitMetres: 0 | 4; exitSeconds: 0 | 4;
}
export interface CivilizationEnlightenerEncounterState extends CivilizationEnlightenerCombatBody {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof CIVILIZATION_ENLIGHTENER_TARGET_ID; policy: CivilizationEnlightenerPolicy;
  preparation: CivilizationEnlightenerPreparation | null; attemptWeek: number | null; startHistoryIndex: number | null; startSource: CivilizationEnlightenerCombatSource | null;
  originalHistory: SliceCombatRound[] | null; originalResources: string | null; scene: CivilizationEnlightenerScene; materials: CivilizationEnlightenerMaterials; journal: CivilizationEnlightenerEncounterJournal[]; terminal: CivilizationEnlightenerEncounterTerminal | null;
}
export function createCivilizationEnlightenerEncounterState(): CivilizationEnlightenerEncounterState {
  return { ...initialCivilizationEnlightenerBody(), status: 'AVAILABLE', targetId: CIVILIZATION_ENLIGHTENER_TARGET_ID, policy: 'INHERITED_ONLY', preparation: null, attemptWeek: null, startHistoryIndex: null,
    startSource: null, originalHistory: null, originalResources: null, scene: createCivilizationEnlightenerScene(), materials: createCivilizationEnlightenerMaterials(), journal: [], terminal: null };
}
export const createCivilizationEnlightenerEncounter = createCivilizationEnlightenerEncounterState;
export const isCivilizationEnlightenerEncounterStage = (s: SliceState) => s.progression.pathwayId === 'paragon' && s.progression.sequence === 1;
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
export function civilizationEnlightenerFinanceSnapshot(s: CivilizationEnlightenerFinanceSnapshot): CivilizationEnlightenerFinanceSnapshot {
  return { weeklyBudget: s.weeklyBudget, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: structuredClone(s.debts), missedWeeks: s.missedWeeks, credit: s.credit };
}
function validFinance(v: CivilizationEnlightenerFinanceSnapshot, week: number): boolean {
  return shape(v, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit']) && integer(v.weeklyBudget, 1, 100) && Object.hasOwn(SLICE_LIFE, v.lifeTier) && Object.hasOwn(SLICE_LIFE, v.nextLifeTier) &&
    integer(v.missedWeeks) && ['NORMAL', 'NOTICE', 'SUSPENDED'].includes(v.credit) && Array.isArray(v.debts) && v.debts.every(d => shape(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek']) &&
      typeof d.id === 'string' && !!d.id && typeof d.source === 'string' && !!d.source && integer(d.remaining) && integer(d.weeklyPayment, 1) && integer(d.createdWeek, 0, week));
}
export function civilizationEnlightenerEncounterBudget(s: SliceState): CivilizationEnlightenerEncounterBudget {
  return { cash: s.cash, actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution, gender: s.character.gender,
    sequence: 1, acting: s.progression.acting, coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources], injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function validBudget(v: CivilizationEnlightenerEncounterBudget, revision: number): boolean {
  return shape(v, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) && integer(v.cash) &&
    integer(v.actions, 0, 100) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.pollution, 0, 100) && typeof v.gender === 'string' && v.sequence === 1 && integer(v.acting, 0, 100) &&
    shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) && Object.values(v.coreStats).every(n => integer(n, 0, 500)) && !!v.mastery && typeof v.mastery === 'object' && !Array.isArray(v.mastery) && Object.values(v.mastery).every(n => integer(n, 0, 500)) &&
    Array.isArray(v.completedSources) && v.completedSources.every(x => typeof x === 'string' && !!x) && new Set(v.completedSources).size === v.completedSources.length && validCivilizationEnlightenerInjuries(v.injuries, revision) && integer(v.injuryRisk);
}
export function validateCivilizationEnlightenerPreparation(v: unknown): v is CivilizationEnlightenerPreparation {
  try { const p = v as CivilizationEnlightenerPreparation;
    return shape(p, ['week', 'date', 'revision', 'runId', 'randomSeed', 'randomCursor', 'pricePaid', 'actionsPaid', 'lifeReflected', 'playerName', 'playerClubHeld', 'before', 'after', 'finance', 'originalsBefore', 'originalsAfter']) &&
      integer(p.week, 1) && isValidGameDate(p.date) && integer(p.revision, 1) && typeof p.runId === 'string' && !!p.runId && typeof p.randomSeed === 'string' && !!p.randomSeed && integer(p.randomCursor) &&
      typeof p.playerClubHeld === 'boolean' && typeof p.playerName === 'string' && p.playerName.trim().length > 0 && p.pricePaid === 0 && p.actionsPaid === 1 && p.lifeReflected === true && validBudget(p.before, p.revision) && validBudget(p.after, p.revision) && validFinance(p.finance, p.week) && p.before.actions >= 2 && p.before.actions <= Math.max(4, p.finance.weeklyBudget) &&
      same(p.after, { ...p.before, actions: p.before.actions - 1 }) && validOriginals(p.originalsBefore, p.runId, p.week, 'PLAYER') && same(p.originalsAfter, p.originalsBefore.map(x => ({ ...x, location: 'YARD' })));
  } catch { return false; }
}
export function validCivilizationEnlightenerMaterials(v: CivilizationEnlightenerMaterials): boolean {
  try { const initial = createCivilizationEnlightenerMaterials(); return shape(v, ['weapon', 'mechanism']) && shape(v.weapon, Object.keys(initial.weapon)) &&
    ['HAND', 'YARD'].includes(v.weapon.location) && same({ ...v.weapon, location: 'HAND' }, initial.weapon) && shape(v.mechanism, Object.keys(initial.mechanism)) && integer(v.mechanism.charge, 0, 4) && same({ ...v.mechanism, charge: 4 }, initial.mechanism); } catch { return false; }
}
export function originalCreations(s: SliceState): AlchemistCreation[] { return ['AL4-BOX-1', 'AL4-FRAME-1'].map(id => s.alchemist.life.creations.find(x => x.id === id)!).filter(Boolean); }
export function originalSnapshot(xs: AlchemistCreation[]): CivilizationEnlightenerOriginalSnapshot[] { return xs.map(x => ({ id: x.id, charge: x.charge, durability: x.durability, location: x.location, active: x.active })); }
export function validOriginals(xs: AlchemistCreation[], runId: string, week: number, location: 'PLAYER' | 'YARD'): boolean {
  return Array.isArray(xs) && xs.length === 2 && same(xs.map(x => x.id), ['AL4-BOX-1', 'AL4-FRAME-1']) && xs.every(x =>
    shape(x, ['id','kind','source','componentIds','madeBy','owner','custodian','location','durability','charge','active','manufacturedWeek']) && x.madeBy === runId && x.owner === 'PLAYER' && x.custodian === 'PLAYER' && x.location === location &&
    x.kind === (x.id === 'AL4-BOX-1' ? 'MESSENGER_BOX' : 'GUARD_FRAME') && typeof x.source === 'string' && !!x.source && same(x.componentIds, x.id === 'AL4-BOX-1' ? ['AL4-WOOD-1','AL4-BRASS-AXLE-1','AL4-CELL-1'] : ['AL4-WOOD-2','AL4-STEEL-1','AL4-CELL-2']) && integer(x.manufacturedWeek,1,week) && integer(x.charge,0,3) && integer(x.durability,0,100) && typeof x.active === 'boolean' && (!x.active || x.charge > 0 && x.durability > 0));
}
export function validCivilizationEnlightenerScene(p: CivilizationEnlightenerScene): boolean {
  const initial = createCivilizationEnlightenerScene();
  return shape(p, Object.keys(initial)) && same({ ...p, playerLocation: initial.playerLocation, playerCoordinate: initial.playerCoordinate, observedSourceId: null, observationWeek: null, clockSeconds: 0, externalSeconds: 0, playerTravelMetres: 0, knownPlayerName: null, knownEnemyName: null }, initial) &&
    (p.playerLocation === 'WORKSHOP' && p.playerCoordinate === 0 || p.playerLocation === 'YARD' && p.playerCoordinate === 4) && integer(p.clockSeconds) && p.externalSeconds === p.clockSeconds && integer(p.playerTravelMetres) &&
    (p.observedSourceId === null ? p.observationWeek === null && p.knownPlayerName === null && p.knownEnemyName === null : typeof p.observedSourceId === 'string' && integer(p.observationWeek, 1) && typeof p.knownPlayerName === 'string' && p.knownPlayerName.trim().length > 0 && p.knownEnemyName === '阿德里安·黑尔');
}
function protectedOriginals(s: SliceState): string {
  const alchemist = structuredClone(s.alchemist); alchemist.life.creations = [];
  return stableStringify({ savant:s.savant, archaeologist:s.archaeologist, appraiser:s.appraiser, artisan:s.artisan, astronomer:s.astronomer, alchemist,
    arcaneScholar:s.arcaneScholar, knowledgeMentor:s.knowledgeMentor, town:s.town, life:s.civilizationEnlightener.life });
}
function adultsAbsent(s: SliceState): boolean { const p=s.civilizationEnlightener.life.practice; return !hasCivilizationEnlightenerLifeLock(s) && s.civilizationEnlightener.life.reflected && !p.participant.present && p.activeCase===null && p.pendingGuidance===null && !p.stopBar.loadRunning && p.wrench.holder==='RACK'; }
function historyUnchanged(s: SliceState): boolean { const e = s.civilizationEnlightener.encounter; return Array.isArray(e.originalHistory) && same(e.originalHistory, s.combatHistory.slice(0, e.originalHistory.length)); }
function originalsUnchanged(s: SliceState): boolean { return s.civilizationEnlightener.encounter.originalResources === protectedOriginals(s) && historyUnchanged(s); }
export function validateCivilizationEnlightenerEncounterCommand(v: unknown): v is CivilizationEnlightenerEncounterCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as CivilizationEnlightenerEncounterCommand;
  return c.type === 'ENCOUNTER_POLICY' ? shape(c, ['type', 'policy']) && ['INHERITED_ONLY', 'PROCESS_ANALYSIS', 'OPERATIONAL_GUIDANCE', 'ALL', 'ORDINARY'].includes(c.policy) : shape(c, ['type']) && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(c.type);
}
export const isCivilizationEnlightenerEncounterCommand = validateCivilizationEnlightenerEncounterCommand;
export const hasCivilizationEnlightenerEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.civilizationEnlightener.encounter.status);
export const isInsideCivilizationEnlightenerEncounter = hasCivilizationEnlightenerEncounterLock;
export function blockCivilizationEnlightenerEncounter(s: SliceState, c: CivilizationEnlightenerEncounterCommand): string | null {
  if (!validateCivilizationEnlightenerEncounterCommand(c)) return '遭遇命令无效。'; const e = s.civilizationEnlightener.encounter;
  if (!isCivilizationEnlightenerEncounterStage(s) || s.civilizationEnlightener.promotionWeek === null || s.status !== 'ACTIVE' || s.health <= 0) return '须本人仍活着并完成文明启蒙者晋升。';
  if (s.combat) return '先处理当前真实战斗。';
  if (!s.civilizationEnlightener.life.reflected) return '先完成三项生活实践与反思，让参与成人实际离场。';
  if (!adultsAbsent(s)) return '先让维拉实际离场，并收束原生活实践与工坊现场。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德工院。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' && originalsUnchanged(s) ? null : '须先到场交谈，才能普通离开。';
  if (s.activeEvent || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件或周账。';
  if (s.mind <= 0) return '需要保持清醒；已到场仍可普通退出。';
  if (c.type === 'ENCOUNTER_TALK' && (!validOriginals(originalCreations(s),s.runId,s.week,'PLAYER') || originalCreations(s).some(x => x.active) || !same(originalSnapshot(originalCreations(s)), civilizationEnlightenerLifeOriginalTail(s)))) return '须原盒原架已实际取回并停止，资源与真实维护记录一致。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' || e.preparation ? '同一原人争议不能重开或重置。' : s.actionsRemaining < 2 ? '到场需1行动，并另留1行动给自主决定开战。' : null;
  if (e.status !== 'READY' || !e.preparation || !originalsUnchanged(s)) return '须先亲自交谈并保留同一原现场、原人物和旧记录。';
  if (c.type === 'ENCOUNTER_POLICY') return c.policy === e.policy && e.journal.some(j => j.command.type === 'ENCOUNTER_POLICY') ? '已经采用这项策略。' : null;
  if (!e.journal.some(j => j.command.type === 'ENCOUNTER_POLICY')) return '先明确选择本场策略；开战后不能临时更换。';
  return s.actionsRemaining < 1 ? '交战需要1行动；和平退出不花行动。' : null;
}
export const civilizationEnlightenerEncounterReason = blockCivilizationEnlightenerEncounter;
export function leaveCivilizationEnlightenerCombatScene(p: CivilizationEnlightenerScene): void {
  if (p.playerLocation !== 'YARD' || p.playerCoordinate !== 4) throw new Error('须从实际所在工院离开。');
  p.playerLocation = 'WORKSHOP'; p.playerCoordinate = 0; p.playerTravelMetres += 4; p.clockSeconds += 4; p.externalSeconds += 4;
}
function arrive(s: SliceState, p: CivilizationEnlightenerPreparation): CivilizationEnlightenerScene {
  return { ...createCivilizationEnlightenerScene(), playerLocation: 'YARD', playerCoordinate: 4, observedSourceId: `${s.runId}:CE1-YARD:${p.revision}`, observationWeek: p.week,
    clockSeconds: 4, externalSeconds: 4, playerTravelMetres: 4, knownPlayerName: p.playerName, knownEnemyName: '阿德里安·黑尔' };
}
export function applyCivilizationEnlightenerEncounterCommand(s: SliceState, c: CivilizationEnlightenerEncounterCommand, ctx: SeerContext): void {
  const reason = blockCivilizationEnlightenerEncounter(s, c); if (reason) throw new Error(reason); const e = s.civilizationEnlightener.encounter;
  if (c.type === 'ENCOUNTER_TALK') {
    const before = civilizationEnlightenerEncounterBudget(s), originalsBefore = structuredClone(originalCreations(s)); s.actionsRemaining--;
    for (const x of originalCreations(s)) x.location = 'YARD';
    e.preparation = { week: s.week, date: { ...s.date }, revision: s.revision + 1, runId: s.runId, randomSeed: s.random.seed, randomCursor: s.random.cursor, pricePaid: 0, actionsPaid: 1,
      lifeReflected: true, playerName: s.character.name, playerClubHeld: s.town.clubLocation === 'HAND', before, after: civilizationEnlightenerEncounterBudget(s), finance: civilizationEnlightenerFinanceSnapshot(s), originalsBefore, originalsAfter: structuredClone(originalCreations(s)) };
    e.originalHistory = structuredClone(s.combatHistory); e.originalResources = protectedOriginals(s); e.scene = arrive(s, e.preparation); e.status = 'READY';
    ctx.note('走到工院与阿德里安交谈', `实付1行动，步行4米4秒；你亲口介绍姓名“${s.character.name}”，阿德里安·黑尔也报出自己的姓名。他只因此知道你的姓名与当次会面。44岁的他有独立身体、精神、120灵性与自己的唯一原杆。维拉已离场。你可以和平离开，也可自主交战。`); return;
  }
  const entry: CivilizationEnlightenerEncounterJournal = { command: structuredClone(c), week: s.week, date: { ...s.date }, revision: s.revision + 1, randomCursor: s.random.cursor,
    before: civilizationEnlightenerEncounterBudget(s), after: civilizationEnlightenerEncounterBudget(s), finance: civilizationEnlightenerFinanceSnapshot(s), sceneBefore: structuredClone(e.scene), sceneAfter: structuredClone(e.scene), originalsBefore: structuredClone(originalCreations(s)), originalsAfter: structuredClone(originalCreations(s)) };
  if (c.type === 'ENCOUNTER_POLICY') { e.policy = c.policy; ctx.note('选择文明启蒙者交战策略', c.policy === 'ORDINARY' ? '本场只作普通动作；抽到能力时不施放，不创建新装备。' : c.policy === 'INHERITED_ONLY' ? '暂不施放两项新能力；抽到时只作普通防备。' : '仅在抽到、存在相应实际操作对象且资源足够时，允许所选能力。每轮各一次，失败也支付实际成本，能力不能改写已完成的动作。'); }
  else if (c.type === 'LEAVE_ENCOUNTER') { leaveCivilizationEnlightenerCombatScene(e.scene); for (const x of originalCreations(s)) { x.location = 'PLAYER'; x.active = false; } e.status = 'RESOLVED'; ctx.note('沿普通路和平离开工院', '没有战斗或奖励；沿开放出口实际走4米4秒。阿德里安及唯一原杆仍留工院，所有已完成的旧事实保持。'); }
  else {
    s.actionsRemaining--; e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
    s.combat = { encounterId: 'CIVILIZATION_ENLIGHTENER_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
    ctx.note('选择与阿德里安交战', '实付1行动。双方各自最多六次实际行动；阿德里安以自己的有限灵性反击与护持，耗尽则使用唯一原杆。普通撤退、投降、伤势和真实死亡照常。');
  }
  entry.after = civilizationEnlightenerEncounterBudget(s); entry.sceneAfter = structuredClone(e.scene); entry.originalsAfter = structuredClone(originalCreations(s)); e.journal.push(entry);
  if (c.type === 'ENCOUNTER_FIGHT') { const source = currentCivilizationEnlightenerCombatSource(s); if (!source) throw new Error('真实来源不完整。'); e.startSource = { ...source, revision: s.revision + 1 }; }
}
export const applyCivilizationEnlightenerEncounter = applyCivilizationEnlightenerEncounterCommand;
export const handleCivilizationEnlightenerEncounter = applyCivilizationEnlightenerEncounterCommand;
export function startCivilizationEnlightenerEncounter(s: SliceState, ctx: SeerContext): void { applyCivilizationEnlightenerEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasCivilizationEnlightenerDisputeOpponent(s: SliceState): boolean {
  const e = s.civilizationEnlightener?.encounter, c = s.combat;
  return isCivilizationEnlightenerEncounterStage(s) && s.status === 'ACTIVE' && !s.activeEvent && s.world.city === 'BACKLUND' && validOriginals(originalCreations(s),s.runId,s.week,'YARD') && s.health > 0 && s.mind > 0 && s.civilizationEnlightener.life.reflected && s.civilizationEnlightener.promotionWeek !== null &&
    !!e && e.status === 'FIGHTING' && e.targetId === CIVILIZATION_ENLIGHTENER_TARGET_ID && e.terminal === null && e.preparation !== null && e.materials.mechanism.charge===4-e.powerUses.MECHANICAL_PULSE && originalsUnchanged(s) && e.attemptWeek === s.week &&
    adultsAbsent(s) && validCivilizationEnlightenerScene(e.scene) && e.scene.playerLocation === 'YARD' && e.scene.knownPlayerName === s.character.name && validCivilizationEnlightenerMaterials(e.materials) && validCivilizationEnlightenerBody(e) && e.weaponLocation === e.materials.weapon.location &&
    c?.encounterId === 'CIVILIZATION_ENLIGHTENER_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && e.enemyStatus === 'RESISTING' && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind &&
    same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk && integer(c.round, 1) && e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
function terminalScene(o: CivilizationEnlightenerRoundOutcome): { root: CivilizationEnlightenerScene; exit: 0 | 4; materials: CivilizationEnlightenerMaterials } {
  const root = structuredClone(o.rootAfter), materials = structuredClone(o.materialsAfter), exit = o.playerHealthAfter > 0 ? 4 : 0;
  if (exit) leaveCivilizationEnlightenerCombatScene(root);
  return { root, exit, materials };
}
export function settleCivilizationEnlightenerEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.civilizationEnlightener.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'CIVILIZATION_ENLIGHTENER_DISPUTE') throw new Error('没有这场工院冲突。'); if (outcome === 'CONTINUE') return;
  const last = c.lastRound, o = last?.civilizationEnlightenerOutcome;
  if (!last || !o || !validateCivilizationEnlightenerCombatRound(last) || o.continuing || e.terminal || e.startHistoryIndex === null || c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round ||
    !originalsUnchanged(s) || !same(s.combatHistory.at(-1), last) || !same(combatBody(e), combatBody(o)) || !same(o.rootAfter, e.scene) || !same(o.materialsAfter, e.materials) || o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality ||
    !same(o.creations, originalCreations(s)) || !same(o.masteryAfter, s.progression.mastery) || !same(o.playerInjuriesAfter, s.injuries) || o.playerRiskAfter !== s.injuryRisk || o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || !same(o.enemyInjuries, c.enemyInjuries) || o.enemyRisk !== c.enemyRisk || o.enemyStatus !== c.enemyStatus ||
    outcome !== (o.playerHealthAfter === 0 ? 'PLAYER_DEAD' : o.enemyHealth === 0 ? 'ENEMY_DEAD' : o.enemyStatus === 'SURRENDERED' ? 'ENEMY_SURRENDERED' : 'RETREATED')) throw new Error('结局与真实回合、原身体、原物或已付费用不一致。');
  const final = terminalScene(o); e.scene = final.root; e.materials = final.materials;
  for (const x of originalCreations(s)) { x.active = false; if (final.exit) x.location = 'PLAYER'; }
  e.terminal = { outcome: outcome as CivilizationEnlightenerEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, exitMetres: final.exit, exitSeconds: final.exit };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('阿德里安的工院冲突结束', `${final.exit ? '本人活着沿普通路线走4米4秒回工坊外。' : '本人原身体真实死亡，留在工院，没有复活或搬移。'}双方实际灵性、精神、伤势与原杆落点保留；原装置储能不恢复。生活参与者与旧人物、旧原物均不受此场改写。`);
}
export const finishCivilizationEnlightenerEncounter = settleCivilizationEnlightenerEncounter;
export function civilizationEnlightenerEncounterActions(s: SliceState): CivilizationEnlightenerAction[] {
  if (!isCivilizationEnlightenerEncounterStage(s)) return [];
  const choices: {command:CivilizationEnlightenerEncounterCommand;label:string;cost:string}[] = [
    {command:{type:'ENCOUNTER_TALK'},label:'携同一原件前往工院交谈',cost:'1行动、4米4秒；开始前须有2行动'},
    ...(['INHERITED_ONLY','PROCESS_ANALYSIS','OPERATIONAL_GUIDANCE','ALL','ORDINARY'] as const).map(policy => ({command:{type:'ENCOUNTER_POLICY' as const,policy},label:({INHERITED_ONLY:'只用已学能力',PROCESS_ANALYSIS:'允许工艺析解',OPERATIONAL_GUIDANCE:'允许操作启示',ALL:'允许两项新能力',ORDINARY:'只作普通行动'})[policy],cost:'0行动；开战后不更换'})),
    {command:{type:'ENCOUNTER_FIGHT'},label:'自主承担与阿德里安的真实冲突',cost:'1行动；真实伤势和死亡风险'},
    {command:{type:'LEAVE_ENCOUNTER'},label:'亲手取回原件并和平离开',cost:'0行动、4米4秒'}];
  return choices.map(({command,label,cost}) => { const reason=blockCivilizationEnlightenerEncounter(s,command); return {id:`CE1-${command.type}${command.type === 'ENCOUNTER_POLICY' ? '-'+command.policy : ''}`,command,label,cost,enabled:reason===null,reason}; });
}
export const CIVILIZATION_ENLIGHTENER_ENCOUNTER_STORY = '44岁的阿德里安·黑尔独自在净空工院提出通行争议。他有独立健康100、精神100、灵性120、自己的唯一原杆和一套可见的有限机械装置。维拉与旧遭遇人物均不在场。你携同一原盒原架沿4米普通路到场，先实际交谈，再选择和平离开或交战。';
export function projectCivilizationEnlightenerEncounter(s:SliceState) {
 const e=s.civilizationEnlightener.encounter;
 return {title:'阿德里安的工院争议',story:isCivilizationEnlightenerEncounterStage(s)?CIVILIZATION_ENLIGHTENER_ENCOUNTER_STORY:'',status:e.status,inside:hasCivilizationEnlightenerEncounterLock(s),policy:e.policy,scene:structuredClone(e.scene),materials:structuredClone(e.materials),
  enemy:{id:e.targetId,name:'阿德里安·黑尔',age:44 as const,health:e.enemyHealth,mind:e.enemyMind,spirituality:e.enemySpirituality,status:e.enemyStatus,weaponLocation:e.weaponLocation,powerUses:{...e.powerUses}},actions:civilizationEnlightenerEncounterActions(s),
  facts:['工艺析解每轮一次6灵性2精神、知识18，并抵抗；只在实际观察后削弱一项尚未执行的可见机械动作30。','操作启示每轮一次8灵性3精神、知识20；只对后来实际可用的一次本人原有动作加25。失败照付，空窗口与资源不足的回退没有奖励。','同一原盒原架沿实际储能耐久，没有免费指令片、补能或新造物。','双方1至6动作权重10/15/25/25/15/10；体30%、感30%、意25%、知15%，基础1250、最低125、灵性上限120，只有继续轮恢复12。','身体与精神后果分别结算；精神耗尽是活着停战，身体死亡终结本周目。生还亲手取回原件并实走4米4秒。']};
}
export type CivilizationEnlightenerEncounterProjection=ReturnType<typeof projectCivilizationEnlightenerEncounter>;

/** Reconcile the existing ordinary weekly finance transition from its frozen
 * input, including debt notices, interrupted bills, receipts and the exact date.
 * Combat never heals, refills or erases debts to make this comparison pass. */
export function civilizationEnlightenerTerminalBudgetMatches(s: SliceState, _prep: CivilizationEnlightenerPreparation, o: CivilizationEnlightenerRoundOutcome): boolean {
  const e = s.civilizationEnlightener.encounter, fight = e.journal.find(j => j.command.type === 'ENCOUNTER_FIGHT'); if (!fight) return false;
  const expected: CivilizationEnlightenerEncounterBudget = { ...fight.after, health: o.playerHealthAfter, mind: o.playerMindAfter, spirituality: o.playerSpiritualityAfter,
    mastery: o.masteryAfter, injuries: o.playerInjuriesAfter, injuryRisk: o.playerRiskAfter };
  const current = civilizationEnlightenerEncounterBudget(s);
  if (!same({ ...current, cash: expected.cash, actions: expected.actions }, expected) || s.random.cursor !== o.randomCursorAfter || !same(e.scene, terminalScene(o).root) || !same(e.materials, terminalScene(o).materials)) return false;
  const financialTitles = ['本周生活费', '生活费如实记账', '本周约定还款', '账目结清', '新的一周'];
  const receipts = s.chronicle.filter((entry, index) => entry.id === `record-${s.revision}-${index}` && financialTitles.includes(entry.title));
  if (expected.actions > 0 || o.playerHealthAfter === 0) return s.week === fight.week && same(s.date, fight.date) && s.actionsRemaining === expected.actions &&
    s.cash === expected.cash && same(civilizationEnlightenerFinanceSnapshot(s), fight.finance) && s.pulse === 'NONE' && s.billAmount === 0 && s.activeEvent === null && s.eventQueue.length === 0 && receipts.length === 0;
  if (expected.actions !== 0 || s.status !== 'ACTIVE') return false;
  const result = resolveSliceWeeklyFinance({ ...fight.finance, cash: expected.cash, week: fight.week, revision: o.source.revision, pulse: 'BILL', billAmount: 0 });
  const advanced = result.eventId === null && result.state.pulse === 'ADVANCE';
  const finance = { ...fight.finance, ...result.state, weeklyBudget: fight.finance.weeklyBudget, lifeTier: advanced ? result.state.nextLifeTier : fight.finance.lifeTier };
  if (s.cash !== result.state.cash || !same(civilizationEnlightenerFinanceSnapshot(s), civilizationEnlightenerFinanceSnapshot(finance)) || s.week !== fight.week + (advanced ? 1 : 0) ||
    !same(s.date, advanced ? addGameWeeks(fight.date, 1) : fight.date) || s.actionsRemaining !== (advanced ? fight.finance.weeklyBudget : 0) ||
    s.pulse !== (advanced ? 'NONE' : result.state.pulse) || s.billAmount !== (advanced ? 0 : result.state.billAmount)) return false;
  const expectedReceipts = result.receipts.map(receipt => ({ week: fight.week, ...receipt }));
  if (advanced) expectedReceipts.push({ week: fight.week + 1, title: '新的一周', text: `日期推进7天，本周${fight.finance.weeklyBudget}次行动。` });
  if (!same(receipts.map(({ week, title, text }) => ({ week, title, text })), expectedReceipts)) return false;
  if (result.eventId) {
    const terminalIndex = s.chronicle.findIndex((entry, index) => entry.id === `record-${s.revision}-${index}` && entry.title === '阿德里安的工院冲突结束');
    const eventIndex = terminalIndex + 1 + result.receipts.length;
    return terminalIndex >= 0 && s.eventQueue.length === 0 && same(s.activeEvent, { id: result.eventId, instanceId: `${s.runId}:${result.eventId}:${s.revision}:${eventIndex}` });
  }
  return true;
}
/** Replay is exact through the last battle command. Later legitimate life/team
 * recovery remains possible; it never rewrites this original encounter history. */
export function replayCivilizationEnlightenerEncounterRoot(s: SliceState): CivilizationEnlightenerScene | null {
  try {
    const e = s.civilizationEnlightener.encounter, initial = createCivilizationEnlightenerEncounterState(), allNew = s.combatHistory.flatMap((r, i) => r.civilizationEnlightenerOutcome ? [i] : []);
    if (!e || !shape(e, Object.keys(initial)) || !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || e.targetId !== initial.targetId || !['INHERITED_ONLY', 'PROCESS_ANALYSIS', 'OPERATIONAL_GUIDANCE', 'ALL', 'ORDINARY'].includes(e.policy) || !validCivilizationEnlightenerBody(e) || !validCivilizationEnlightenerScene(e.scene) || !validCivilizationEnlightenerMaterials(e.materials) || e.weaponLocation !== e.materials.weapon.location) return null;
    if (!e.preparation) return same(e, initial) && allNew.length === 0 && s.combat?.encounterId !== 'CIVILIZATION_ENLIGHTENER_DISPUTE' ? createCivilizationEnlightenerScene() : null;
    const prep = e.preparation;
    if (!isCivilizationEnlightenerEncounterStage(s) || s.civilizationEnlightener.promotionWeek === null || !s.civilizationEnlightener.life.reflected || !validateCivilizationEnlightenerPreparation(prep) || prep.runId !== s.runId || prep.playerName !== s.character.name || prep.randomSeed !== s.random.seed || prep.randomCursor > s.random.cursor ||
      !integer(prep.week, s.civilizationEnlightener.promotionWeek, s.week) || compareGameDates(prep.date, s.date) > 0 || !integer(prep.revision, 1, s.revision) || !historyUnchanged(s) || typeof e.originalResources !== 'string' || !e.originalResources || !Array.isArray(e.journal)) return null;
    let policyChosen = false;
    let root = arrive(s, prep), status: CivilizationEnlightenerEncounterState['status'] = 'READY', policy: CivilizationEnlightenerPolicy = 'INHERITED_ONLY';
    let originals = structuredClone(prep.originalsAfter);
    if (!same(originalSnapshot(prep.originalsBefore), civilizationEnlightenerLifeOriginalTail(s))) return null;
    let budget = prep.after, finance = prep.finance, week = prep.week, date = prep.date, revision = prep.revision;
    for (const entry of e.journal) {
      if (!shape(entry, ['command', 'week', 'date', 'revision', 'randomCursor', 'before', 'after', 'finance', 'sceneBefore', 'sceneAfter', 'originalsBefore', 'originalsAfter']) || !validateCivilizationEnlightenerEncounterCommand(entry.command) || entry.command.type === 'ENCOUNTER_TALK' ||
        !validBudget(entry.before, entry.revision) || !validBudget(entry.after, entry.revision) || !validFinance(entry.finance, entry.week) || !integer(entry.revision, revision + 1, s.revision) ||
        entry.randomCursor !== prep.randomCursor || !same(entry.sceneBefore, root) || status !== 'READY' || entry.week !== week || !same(entry.date, date) || !same(entry.before, budget) || !same(entry.finance, finance) || !same(entry.originalsBefore, originals)) return null;
      if (entry.command.type === 'ENCOUNTER_POLICY') { if (policyChosen && entry.command.policy === policy) return null; policy = entry.command.policy; policyChosen = true; }
      else if (entry.command.type === 'ENCOUNTER_FIGHT') { if (!policyChosen) return null; if (root.playerLocation !== 'YARD' || entry.before.actions < 1) return null; status = 'FIGHTING'; }
      else { leaveCivilizationEnlightenerCombatScene(root); for (const x of originals) { x.location = 'PLAYER'; x.active = false; } status = 'RESOLVED'; }
      if (!same(entry.after, { ...entry.before, actions: entry.before.actions - (entry.command.type === 'ENCOUNTER_FIGHT' ? 1 : 0) }) || !same(entry.sceneAfter, root) || !same(entry.originalsAfter, originals)) return null;
      budget = entry.after; finance = entry.finance; week = entry.week; date = entry.date; revision = entry.revision;
    }
    if (e.policy !== policy) return null;
    if (status !== 'FIGHTING') {
      if (e.status !== status || e.startHistoryIndex !== null || e.startSource !== null || e.attemptWeek !== null || e.terminal !== null || !same(combatBody(e), initialCivilizationEnlightenerBody()) || !same(e.materials, createCivilizationEnlightenerMaterials()) || allNew.length || s.combat?.encounterId === 'CIVILIZATION_ENLIGHTENER_DISPUTE') return null;
      if (status === 'READY' || s.revision === revision) {
        if (!same(originalCreations(s), originals) || !originalsUnchanged(s) || !same(civilizationEnlightenerEncounterBudget(s), budget) || !same(civilizationEnlightenerFinanceSnapshot(s), finance) || s.week !== week || !same(s.date, date) || s.random.cursor !== prep.randomCursor || s.pulse !== 'NONE' || s.billAmount !== 0 || s.activeEvent || s.eventQueue.length) return null;
      }
      return root;
    }
    const start = e.startSource;
    if (!start || !validCivilizationEnlightenerCombatSource(start) || !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.startHistoryIndex !== e.originalHistory!.length || e.attemptWeek !== week || start.round !== 1 || start.revision !== revision || start.week !== week || !same(start.date, date) || start.startHistoryIndex !== e.startHistoryIndex || start.runId !== s.runId || !same(start.preparation, prep) || start.policy !== policy ||
      !same(start.creations, originals) || !same(start.body, initialCivilizationEnlightenerBody()) || !same(start.root, root) || !same(start.materials, createCivilizationEnlightenerMaterials()) || start.randomSeed !== s.random.seed || start.randomCursor !== prep.randomCursor || start.playerHealth !== budget.health || start.playerMind !== budget.mind || start.playerSpirituality !== budget.spirituality || !same(start.mastery, budget.mastery) || !same(start.playerInjuries, budget.injuries) || start.playerRisk !== budget.injuryRisk) return null;
    const terminal = e.terminal;
    if (terminal && (!shape(terminal, ['outcome', 'round', 'historyIndex', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'exitMetres', 'exitSeconds']) || !integer(terminal.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1))) return null;
    const end = terminal ? terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    if (!same(allNew, rounds.map((_r, i) => e.startHistoryIndex! + i))) return null;
    for (const [i, round] of rounds.entries()) {
      const o = round.civilizationEnlightenerOutcome, previous = rounds[i - 1]?.civilizationEnlightenerOutcome;
      if (!o || !validateCivilizationEnlightenerCombatRound(round) || round.round !== i + 1 || o.source.revision >= s.revision || o.randomCursorAfter > s.random.cursor || !same(o.source, previous ? nextCivilizationEnlightenerCombatSource(previous) : start) || !same(o.source.root, root) || i < rounds.length - 1 && !o.continuing) return null;
      root = structuredClone(o.rootAfter); originals = structuredClone(o.creations);
    }
    const last = rounds.at(-1), o = last?.civilizationEnlightenerOutcome;
    if (e.status === 'FIGHTING') {
      if (!same(originalCreations(s), originals)) return null;
      if (terminal || !hasCivilizationEnlightenerDisputeOpponent(s) || !same(combatBody(e), o ? combatBody(o) : start.body) || !same(e.materials, o ? o.materialsAfter : start.materials)) return null;
      const current = civilizationEnlightenerEncounterBudget(s), expected = { ...budget, health: o?.playerHealthAfter ?? start.playerHealth, mind: o?.playerMindAfter ?? start.playerMind, spirituality: o ? Math.min(120, o.playerSpiritualityAfter + 12) : start.playerSpirituality,
        mastery: o?.masteryAfter ?? start.mastery, injuries: o?.playerInjuriesAfter ?? start.playerInjuries, injuryRisk: o?.playerRiskAfter ?? start.playerRisk };
      if (!same(current, expected) || !same(civilizationEnlightenerFinanceSnapshot(s), finance) || s.week !== week || !same(s.date, date) || s.pulse !== 'NONE' || s.billAmount !== 0 || s.activeEvent !== null || s.eventQueue.length) return null;
      return o ? o.continuing && same(last, s.combat!.lastRound) && same(currentCivilizationEnlightenerCombatSource(s), nextCivilizationEnlightenerCombatSource(o)) ? root : null : s.combat!.lastRound === null && same(currentCivilizationEnlightenerCombatSource(s), start) ? root : null;
    }
    if (s.combat?.encounterId === 'CIVILIZATION_ENLIGHTENER_DISPUTE' || !terminal || !last || !o || o.continuing || terminal.round !== last.round || rounds.length !== terminal.round || !same(combatBody(e), combatBody(o)) || terminal.enemyHealth !== e.enemyHealth || terminal.enemyMind !== e.enemyMind || terminal.enemySpirituality !== e.enemySpirituality || terminal.enemyStatus !== e.enemyStatus ) return null;
    const final = terminalScene(o); if (terminal.exitMetres !== final.exit || terminal.exitSeconds !== final.exit || !same(e.materials, final.materials)) return null;
    if (s.revision === o.source.revision + 1 && (!same(originalCreations(s), originals.map(x => ({ ...x, active: false, location: final.exit ? 'PLAYER' : 'YARD' }))) || !originalsUnchanged(s) || !civilizationEnlightenerTerminalBudgetMatches(s, prep, o))) return null;
    if (terminal.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 ? final.root : null;
    if (terminal.outcome === 'RETREATED') return e.status === 'RETREATED' && o.playerHealthAfter > 0 && (last.retreat === 'SUCCESS' || o.playerMindAfter === 0) ? final.root : null;
    return e.status === 'RESOLVED' && o.playerHealthAfter > 0 && (terminal.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : terminal.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED') ? final.root : null;
  } catch { return null; }
}
export function validateCivilizationEnlightenerEncounter(s: SliceState): boolean { try { const root = replayCivilizationEnlightenerEncounterRoot(s); return root !== null && same(root, s.civilizationEnlightener.encounter.scene); } catch { return false; } }
export const validateCivilizationEnlightenerEncounterState = validateCivilizationEnlightenerEncounter;

/** Input revisions align with life receipts; every move changes the same live objects. */
export function civilizationEnlightenerEncounterOriginalEvents(s:SliceState): {revision:number;week:number;source:string;before:CivilizationEnlightenerOriginalSnapshot[];after:CivilizationEnlightenerOriginalSnapshot[]}[] {
 const e=s.civilizationEnlightener.encounter,p=e.preparation; if(!p)return[];
 const events=[{revision:p.revision-1,week:p.week,source:'ENCOUNTER_TALK',before:originalSnapshot(p.originalsBefore),after:originalSnapshot(p.originalsAfter)},
 ...e.journal.map(j=>({revision:j.revision-1,week:j.week,source:j.command.type,before:originalSnapshot(j.originalsBefore),after:originalSnapshot(j.originalsAfter)}))];
 for(const round of s.combatHistory){const o=round.civilizationEnlightenerOutcome;if(!o)continue;events.push({revision:o.source.revision,week:o.source.week,source:'COMBAT_ROUND',before:originalSnapshot(o.source.creations),after:originalSnapshot(o.creations.map(x=>({...x,active:o.continuing?x.active:false,location:!o.continuing&&o.playerHealthAfter>0?'PLAYER':x.location})))});}
 return events;
}
