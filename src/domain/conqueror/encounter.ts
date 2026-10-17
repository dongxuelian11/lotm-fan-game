import { SLICE_LIFE } from '../../content/slice-events.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { addGameWeeks, compareGameDates, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceCombatRound, SliceInjury, SliceState } from '../slice/types.js';
import type { ConquerorAction } from './types.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { currentConquerorCombatSource, nextConquerorCombatSource, validConquerorCombatSource, validateConquerorCombatRound,
  validConquerorBody, validConquerorInjuries, type ConquerorCombatSource, type ConquerorRoundOutcome } from './combat.js';

export const CONQUEROR_TARGET_ID = 'CQ1-RONAN-HALE' as const;
export const CONQUEROR_SITE = 'CQ1-OPEN-FOUNDRY-YARD' as const;
export const CONQUEROR_POWER_IDS = ['FIRE_JET', 'WARD', 'COOL_WEAPON', 'MENTAL_PRESSURE'] as const;
export type ConquerorPowerId = typeof CONQUEROR_POWER_IDS[number];
export type ConquerorEnemyIntent = ConquerorPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export type ConquerorPolicy = 'HOLD' | 'FOCUS_FLAME';
export const CONQUEROR_POWERS = [
  { id: 'FIRE_JET', label: '有限火流', cost: 8, selfGain: 95, enemyReduction: 0 },
  { id: 'WARD', label: '单次挡火屏护', cost: 6, selfGain: 0, enemyReduction: 0 },
  { id: 'COOL_WEAPON', label: '用自有水冷却原铁杖', cost: 3, selfGain: 0, enemyReduction: 0 },
  { id: 'MENTAL_PRESSURE', label: '有限精神施压', cost: 5, selfGain: 45, enemyReduction: 0 },
] as const;
export interface ConquerorMaterials {
  weapon: { id: 'CQ1-RONAN-IRON-ROD'; sourceId: 'CQ1-RONAN-OWNED-IRON-1'; owner: typeof CONQUEROR_TARGET_ID; massKg: 2;
    location: 'HAND' | 'YARD'; temperatureC: number; condition: number; deformations: number; heatingPulses: number };
  water: { id: 'CQ1-RONAN-WATER-BUCKET'; sourceId: 'CQ1-RONAN-OWNED-WATER-1'; owner: typeof CONQUEROR_TARGET_ID; initialLitres: 20; remainingLitres: number; uses: number };
}
export function createConquerorMaterials(): ConquerorMaterials {
  return { weapon: { id: 'CQ1-RONAN-IRON-ROD', sourceId: 'CQ1-RONAN-OWNED-IRON-1', owner: CONQUEROR_TARGET_ID, massKg: 2, location: 'HAND', temperatureC: 20, condition: 100, deformations: 0, heatingPulses: 0 },
    water: { id: 'CQ1-RONAN-WATER-BUCKET', sourceId: 'CQ1-RONAN-OWNED-WATER-1', owner: CONQUEROR_TARGET_ID, initialLitres: 20, remainingLitres: 20, uses: 0 } };
}
export interface ConquerorScene {
  siteId: typeof CONQUEROR_SITE; playerLocation: 'WORKSHOP' | 'YARD'; playerCoordinate: 0 | 12; enemyCoordinate: 14;
  ordinaryExit: 'OPEN'; thirdPartiesInArea: 0; presentMemberIds: string[]; observedSourceId: string | null; observationWeek: number | null;
  clockSeconds: number; externalSeconds: number; playerTravelMetres: number;
}
export function createConquerorScene(): ConquerorScene {
  return { siteId: CONQUEROR_SITE, playerLocation: 'WORKSHOP', playerCoordinate: 0, enemyCoordinate: 14, ordinaryExit: 'OPEN', thirdPartiesInArea: 0,
    presentMemberIds: [], observedSourceId: null, observationWeek: null, clockSeconds: 0, externalSeconds: 0, playerTravelMetres: 0 };
}
export interface ConquerorCombatBody {
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  weaponLocation: 'HAND' | 'YARD'; powerUses: Record<ConquerorPowerId, number>; focusedAttempts: number; focusedSuccesses: number; wardReady: false;
}
export function initialConquerorBody(): ConquerorCombatBody {
  return { enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0, weaponLocation: 'HAND',
    powerUses: { FIRE_JET: 0, WARD: 0, COOL_WEAPON: 0, MENTAL_PRESSURE: 0 }, focusedAttempts: 0, focusedSuccesses: 0, wardReady: false };
}
export function combatBody(e: ConquerorCombatBody): ConquerorCombatBody {
  return Object.fromEntries(Object.keys(initialConquerorBody()).map(k => [k, structuredClone(e[k as keyof ConquerorCombatBody])])) as unknown as ConquerorCombatBody;
}
export type ConquerorFinanceSnapshot = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface ConquerorEncounterBudget {
  cash: number; actions: number; health: number; mind: number; spirituality: number; pollution: number; gender: string; sequence: 1;
  acting: number; coreStats: SliceState['character']['coreStats']; mastery: Record<string, number>; completedSources: string[]; injuries: SliceInjury[]; injuryRisk: number;
}
export interface ConquerorPreparation {
  week: number; date: PublicGameDate; revision: number; runId: string; randomSeed: string; randomCursor: number; pricePaid: 0; actionsPaid: 1;
  lifeReflected: true; before: ConquerorEncounterBudget; after: ConquerorEncounterBudget; finance: ConquerorFinanceSnapshot;
}
export type ConquerorEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' } | { type: 'SET_POLICY'; policy: ConquerorPolicy };
export interface ConquerorEncounterJournal {
  command: Exclude<ConquerorEncounterCommand, { type: 'ENCOUNTER_TALK' }>; week: number; date: PublicGameDate; revision: number; randomCursor: number;
  before: ConquerorEncounterBudget; after: ConquerorEncounterBudget; finance: ConquerorFinanceSnapshot; sceneBefore: ConquerorScene; sceneAfter: ConquerorScene;
}
export interface ConquerorEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: ConquerorCombatBody['enemyStatus']; exitMetres: 0 | 12; exitSeconds: 0 | 12;
}
export interface ConquerorEncounterState extends ConquerorCombatBody {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof CONQUEROR_TARGET_ID; policy: ConquerorPolicy;
  preparation: ConquerorPreparation | null; attemptWeek: number | null; startHistoryIndex: number | null; startSource: ConquerorCombatSource | null;
  originalHistory: SliceCombatRound[] | null; originalResources: string | null; scene: ConquerorScene; materials: ConquerorMaterials; journal: ConquerorEncounterJournal[]; terminal: ConquerorEncounterTerminal | null;
}
export function createConquerorEncounterState(): ConquerorEncounterState {
  return { ...initialConquerorBody(), status: 'AVAILABLE', targetId: CONQUEROR_TARGET_ID, policy: 'HOLD', preparation: null, attemptWeek: null, startHistoryIndex: null,
    startSource: null, originalHistory: null, originalResources: null, scene: createConquerorScene(), materials: createConquerorMaterials(), journal: [], terminal: null };
}
export const createConquerorEncounter = createConquerorEncounterState;
export const isConquerorEncounterStage = (s: SliceState) => s.progression.pathwayId === 'hunter' && s.progression.sequence === 1;
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
export function conquerorFinanceSnapshot(s: ConquerorFinanceSnapshot): ConquerorFinanceSnapshot {
  return { weeklyBudget: s.weeklyBudget, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: structuredClone(s.debts), missedWeeks: s.missedWeeks, credit: s.credit };
}
function validFinance(v: ConquerorFinanceSnapshot, week: number): boolean {
  return shape(v, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit']) && integer(v.weeklyBudget, 1, 100) && Object.hasOwn(SLICE_LIFE, v.lifeTier) && Object.hasOwn(SLICE_LIFE, v.nextLifeTier) &&
    integer(v.missedWeeks) && ['NORMAL', 'NOTICE', 'SUSPENDED'].includes(v.credit) && Array.isArray(v.debts) && v.debts.every(d => shape(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek']) &&
      typeof d.id === 'string' && !!d.id && typeof d.source === 'string' && !!d.source && integer(d.remaining) && integer(d.weeklyPayment, 1) && integer(d.createdWeek, 0, week));
}
export function conquerorEncounterBudget(s: SliceState): ConquerorEncounterBudget {
  return { cash: s.cash, actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution, gender: s.character.gender,
    sequence: 1, acting: s.progression.acting, coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources], injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function validBudget(v: ConquerorEncounterBudget, revision: number): boolean {
  return shape(v, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) && integer(v.cash) &&
    integer(v.actions, 0, 100) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.pollution, 0, 100) && typeof v.gender === 'string' && v.sequence === 1 && integer(v.acting, 0, 100) &&
    shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) && Object.values(v.coreStats).every(n => integer(n, 0, 500)) && !!v.mastery && typeof v.mastery === 'object' && !Array.isArray(v.mastery) && Object.values(v.mastery).every(n => integer(n, 0, 500)) &&
    Array.isArray(v.completedSources) && v.completedSources.every(x => typeof x === 'string' && !!x) && new Set(v.completedSources).size === v.completedSources.length && validConquerorInjuries(v.injuries, revision) && integer(v.injuryRisk);
}
export function validateConquerorPreparation(v: unknown): v is ConquerorPreparation {
  try { const p = v as ConquerorPreparation;
    return shape(p, ['week', 'date', 'revision', 'runId', 'randomSeed', 'randomCursor', 'pricePaid', 'actionsPaid', 'lifeReflected', 'before', 'after', 'finance']) &&
      integer(p.week, 1) && isValidGameDate(p.date) && integer(p.revision, 1) && typeof p.runId === 'string' && !!p.runId && typeof p.randomSeed === 'string' && !!p.randomSeed && integer(p.randomCursor) &&
      p.pricePaid === 0 && p.actionsPaid === 1 && p.lifeReflected === true && validBudget(p.before, p.revision) && validBudget(p.after, p.revision) && validFinance(p.finance, p.week) && p.before.actions >= 2 && p.before.actions <= Math.max(4, p.finance.weeklyBudget) &&
      same(p.after, { ...p.before, actions: p.before.actions - 1 });
  } catch { return false; }
}
export function validConquerorMaterials(v: ConquerorMaterials): boolean {
  try { const initial = createConquerorMaterials(), w = v.weapon, water = v.water;
    return shape(v, ['weapon', 'water']) && shape(w, Object.keys(initial.weapon)) && shape(water, Object.keys(initial.water)) &&
      same({ ...w, location: 'HAND', temperatureC: 20, condition: 100, deformations: 0, heatingPulses: 0 }, initial.weapon) &&
      ['HAND', 'YARD'].includes(w.location) && integer(w.temperatureC, 20, 1200) && integer(w.deformations) && integer(w.heatingPulses) && w.deformations <= w.heatingPulses && w.condition === Math.max(0, 100 - w.deformations * 20) &&
      (w.condition > 0 || w.location === 'YARD') && (w.temperatureC < 600 || w.location === 'YARD') &&
      same({ ...water, remainingLitres: 20, uses: 0 }, initial.water) && integer(water.uses, 0, 10) && water.remainingLitres === 20 - 2 * water.uses;
  } catch { return false; }
}
export function validConquerorScene(p: ConquerorScene): boolean {
  const initial = createConquerorScene();
  return shape(p, Object.keys(initial)) && same({ ...p, playerLocation: initial.playerLocation, playerCoordinate: initial.playerCoordinate, observedSourceId: null, observationWeek: null, clockSeconds: 0, externalSeconds: 0, playerTravelMetres: 0 }, initial) &&
    (p.playerLocation === 'WORKSHOP' && p.playerCoordinate === 0 || p.playerLocation === 'YARD' && p.playerCoordinate === 12) && integer(p.clockSeconds) && p.externalSeconds === p.clockSeconds && integer(p.playerTravelMetres) &&
    (p.observedSourceId === null ? p.observationWeek === null : typeof p.observedSourceId === 'string' && integer(p.observationWeek, 1));
}
function protectedOriginals(s: SliceState): string {
  return stableStringify({ weatherWarlock: s.weatherWarlock, warBishop: s.warBishop, ironBloodKnight: s.ironBloodKnight, reaper: s.reaper, conspirator: s.conspirator,
    pyromaniac: s.pyromaniac, provoker: s.provoker, hunter: s.hunter, town: s.town, life: s.conqueror.life });
}
function historyUnchanged(s: SliceState): boolean { const e = s.conqueror.encounter; return Array.isArray(e.originalHistory) && same(e.originalHistory, s.combatHistory.slice(0, e.originalHistory.length)); }
function originalsUnchanged(s: SliceState): boolean { return s.conqueror.encounter.originalResources === protectedOriginals(s) && historyUnchanged(s); }
export function validateConquerorEncounterCommand(v: unknown): v is ConquerorEncounterCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as ConquerorEncounterCommand;
  return c.type === 'SET_POLICY' ? shape(c, ['type', 'policy']) && ['HOLD', 'FOCUS_FLAME'].includes(c.policy) : shape(c, ['type']) && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(c.type);
}
export const isConquerorEncounterCommand = validateConquerorEncounterCommand;
export const hasConquerorEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.conqueror.encounter.status);
export const isInsideConquerorEncounter = hasConquerorEncounterLock;
export function blockConquerorEncounter(s: SliceState, c: ConquerorEncounterCommand): string | null {
  if (!validateConquerorEncounterCommand(c)) return '遭遇命令无效。'; const e = s.conqueror.encounter;
  if (!isConquerorEncounterStage(s) || s.conqueror.promotionWeek === null || s.status !== 'ACTIVE' || s.health <= 0) return '须本人仍活着并完成征服者晋升。';
  if (s.combat) return '先处理当前真实战斗。';
  if (!s.conqueror.life.reflected) return '先完成生活练习、报告与反思，并让真实成员返家。';
  if (s.ironBloodKnight.team.members.some(m => m.present || m.location !== 'HOME')) return '原队员须实际离场返家；旧出勤记录不能充当在场队伍。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德工坊外院。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' && originalsUnchanged(s) ? null : '须先到场交谈，才能普通离开。';
  if (s.activeEvent || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件或周账。';
  if (s.mind <= 0) return '需要保持清醒；已到场仍可普通退出。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' || e.preparation ? '同一原人争议不能重开或重置。' : s.actionsRemaining < 2 ? '到场需1行动，并另留1行动给自主决定开战。' : null;
  if (e.status !== 'READY' || !e.preparation || !originalsUnchanged(s)) return '须先亲自交谈并保留同一原现场、原人物和旧记录。';
  if (c.type === 'SET_POLICY') return c.policy === e.policy ? '已经采用这项策略。' : null;
  return s.actionsRemaining < 1 ? '交战需要1行动；和平退出不花行动。' : null;
}
export const conquerorEncounterReason = blockConquerorEncounter;
export function leaveConquerorCombatScene(p: ConquerorScene): void {
  if (p.playerLocation !== 'YARD' || p.playerCoordinate !== 12) throw new Error('须从实际所在外院离开。');
  p.playerLocation = 'WORKSHOP'; p.playerCoordinate = 0; p.playerTravelMetres += 12; p.clockSeconds += 12; p.externalSeconds += 12;
}
function arrive(s: SliceState, p: ConquerorPreparation): ConquerorScene {
  return { ...createConquerorScene(), playerLocation: 'YARD', playerCoordinate: 12, observedSourceId: `${s.runId}:CQ1-YARD:${p.revision}`, observationWeek: p.week,
    clockSeconds: 12, externalSeconds: 12, playerTravelMetres: 12 };
}
export function applyConquerorEncounterCommand(s: SliceState, c: ConquerorEncounterCommand, ctx: SeerContext): void {
  const reason = blockConquerorEncounter(s, c); if (reason) throw new Error(reason); const e = s.conqueror.encounter;
  if (c.type === 'ENCOUNTER_TALK') {
    const before = conquerorEncounterBudget(s); s.actionsRemaining--;
    e.preparation = { week: s.week, date: { ...s.date }, revision: s.revision + 1, runId: s.runId, randomSeed: s.random.seed, randomCursor: s.random.cursor, pricePaid: 0, actionsPaid: 1,
      lifeReflected: true, before, after: conquerorEncounterBudget(s), finance: conquerorFinanceSnapshot(s) };
    e.originalHistory = structuredClone(s.combatHistory); e.originalResources = protectedOriginals(s); e.scene = arrive(s, e.preparation); e.status = 'READY';
    ctx.note('亲自到铸工外院交谈', '实付1行动、步行12米12秒。47岁的罗南·黑尔有自己的身体、心智、原铁杖和20升冷却水。旧奥伦仍已投降，队员已经返家，没有随你到场。你可以和平离开，也可以自主交战。'); return;
  }
  const entry: ConquerorEncounterJournal = { command: structuredClone(c), week: s.week, date: { ...s.date }, revision: s.revision + 1, randomCursor: s.random.cursor,
    before: conquerorEncounterBudget(s), after: conquerorEncounterBudget(s), finance: conquerorFinanceSnapshot(s), sceneBefore: structuredClone(e.scene), sceneAfter: structuredClone(e.scene) };
  if (c.type === 'SET_POLICY') { e.policy = c.policy; ctx.note('选择交战策略', c.policy === 'FOCUS_FLAME' ? '允许焰势凝束在抽到且条件足够时施放；独立原铁杖会真实升温、变形，冷却不修复。' : '保留焰势凝束；抽到时只作普通打击，不支付或施放新术式。'); }
  else if (c.type === 'LEAVE_ENCOUNTER') { leaveConquerorCombatScene(e.scene); e.status = 'RESOLVED'; ctx.note('和平离开铸工外院', '没有战斗或奖励；沿开放普通出口实际走12米12秒。罗南及其原物留在原院，旧人旧物保持原样。'); }
  else {
    s.actionsRemaining--; e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
    s.combat = { encounterId: 'CONQUEROR_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
    ctx.note('选择与罗南交战', '实付1行动。双方各自最多六个实际动作；罗南以自己有限的灵性反击和抵挡，没有自动恢复。普通撤退、投降、受伤与死亡照常，没人凭称号成为真神。');
  }
  entry.after = conquerorEncounterBudget(s); entry.sceneAfter = structuredClone(e.scene); e.journal.push(entry);
  if (c.type === 'ENCOUNTER_FIGHT') { const source = currentConquerorCombatSource(s); if (!source) throw new Error('真实来源不完整。'); e.startSource = { ...source, revision: s.revision + 1 }; }
}
export const applyConquerorEncounter = applyConquerorEncounterCommand;
export const handleConquerorEncounter = applyConquerorEncounterCommand;
export function startConquerorEncounter(s: SliceState, ctx: SeerContext): void { applyConquerorEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasConquerorDisputeOpponent(s: SliceState): boolean {
  const e = s.conqueror?.encounter, c = s.combat;
  return isConquerorEncounterStage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && s.conqueror.life.reflected && s.conqueror.promotionWeek !== null &&
    !!e && e.status === 'FIGHTING' && e.targetId === CONQUEROR_TARGET_ID && e.terminal === null && e.preparation !== null && originalsUnchanged(s) && e.attemptWeek === s.week &&
    s.ironBloodKnight.team.members.every(m => !m.present && m.location === 'HOME') && validConquerorScene(e.scene) && e.scene.playerLocation === 'YARD' && validConquerorMaterials(e.materials) && validConquerorBody(e) && e.weaponLocation === e.materials.weapon.location &&
    c?.encounterId === 'CONQUEROR_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && e.enemyStatus === 'RESISTING' && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind &&
    same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk && integer(c.round, 1) && e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
function terminalScene(o: ConquerorRoundOutcome): { root: ConquerorScene; exit: 0 | 12; materials: ConquerorMaterials } {
  const root = structuredClone(o.rootAfter), materials = structuredClone(o.materialsAfter), exit = o.playerHealthAfter > 0 ? 12 : 0;
  if (exit) { leaveConquerorCombatScene(root); materials.weapon.temperatureC = Math.max(20, materials.weapon.temperatureC - exit); }
  return { root, exit, materials };
}
export function settleConquerorEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.conqueror.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'CONQUEROR_DISPUTE') throw new Error('没有这场铸工外院冲突。'); if (outcome === 'CONTINUE') return;
  const last = c.lastRound, o = last?.conquerorOutcome;
  if (!last || !o || !validateConquerorCombatRound(last) || o.continuing || e.terminal || e.startHistoryIndex === null || c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round ||
    !originalsUnchanged(s) || !same(s.combatHistory.at(-1), last) || !same(combatBody(e), combatBody(o)) || !same(o.rootAfter, e.scene) || !same(o.materialsAfter, e.materials) || o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality ||
    !same(o.masteryAfter, s.progression.mastery) || !same(o.playerInjuriesAfter, s.injuries) || o.playerRiskAfter !== s.injuryRisk || o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || !same(o.enemyInjuries, c.enemyInjuries) || o.enemyRisk !== c.enemyRisk || o.enemyStatus !== c.enemyStatus ||
    outcome !== (o.playerHealthAfter === 0 ? 'PLAYER_DEAD' : o.enemyHealth === 0 ? 'ENEMY_DEAD' : o.enemyStatus === 'SURRENDERED' ? 'ENEMY_SURRENDERED' : 'RETREATED')) throw new Error('结局与真实回合、原身体、原物或已付费用不一致。');
  const final = terminalScene(o); e.scene = final.root; e.materials = final.materials;
  e.terminal = { outcome: outcome as ConquerorEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, exitMetres: final.exit, exitSeconds: final.exit };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('罗南的外院冲突结束', `${final.exit ? '本人活着沿普通路线走12米12秒回工坊。' : '本人的原身体真实死亡，留在外院，不复活或搬移。'}原铁杖升温、变形、落点与原水消耗保存；旧奥伦结局、队伍和生活原物保持原样。`);
}
export const finishConquerorEncounter = settleConquerorEncounter;
export function conquerorEncounterActions(s: SliceState): ConquerorAction[] {
  if (!isConquerorEncounterStage(s)) return [];
  const choices: { command: ConquerorEncounterCommand; label: string; cost: string }[] = [
    { command: { type: 'ENCOUNTER_TALK' }, label: '到外院交谈', cost: '1行动、12米12秒；开始前须有2行动' },
    { command: { type: 'SET_POLICY', policy: 'FOCUS_FLAME' }, label: '允许焰势凝束', cost: '0行动；实际施放另付灵性与精神，原铁杖可能变形' },
    { command: { type: 'SET_POLICY', policy: 'HOLD' }, label: '保留焰势凝束', cost: '0行动' },
    { command: { type: 'ENCOUNTER_FIGHT' }, label: '选择与罗南交战', cost: '1行动；真实伤势和死亡风险' },
    { command: { type: 'LEAVE_ENCOUNTER' }, label: '和平退出争议', cost: '0行动、12米12秒' },
  ];
  return choices.map(({ command, label, cost }) => { const reason = blockConquerorEncounter(s, command); return { id: `conqueror-${command.type}${command.type === 'SET_POLICY' ? `-${command.policy}` : ''}`, label, cost, command, enabled: reason === null, reason }; });
}
export const CONQUEROR_ENCOUNTER_STORY = '47岁的罗南·黑尔是独立成年非凡者，在铸工外院提出通行争议。他有健康100、精神100、灵性120、自己的唯一铁杖和20升水，以有限火流、屏护、冷却和精神压力应对。本场采用与初晋征服者相当的有限对抗预算。本人走12米到场，旧队员留在家中；旧奥伦已经投降的事实不变。交谈不等于开战，你可和平离开或自主承担真实战斗。';
export function projectConquerorEncounter(s: SliceState) {
  const e = s.conqueror.encounter;
  return { title: '铸工外院的通行争议', story: isConquerorEncounterStage(s) ? CONQUEROR_ENCOUNTER_STORY : '', status: e.status, inside: hasConquerorEncounterLock(s), policy: e.policy,
    preparation: e.preparation ? { week: e.preparation.week, actionsPaid: 1 as const } : null, scene: structuredClone(e.scene), materials: structuredClone(e.materials),
    enemy: { id: e.targetId, name: '罗南·黑尔', age: 47 as const, sequence: 1 as const, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus,
      weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses }, abilities: CONQUEROR_POWERS.map(p => p.label) }, actions: conquerorEncounterActions(s), facts: [
      '没有实际队友在场，因此阵势合力不会施放、收费或给予团队增益；抽中时仅为本人普通防备。',
      '允许焰势凝束后，每次先付8灵性2精神，再作知识20检定；成功才形成95火焰攻击贡献，并使同一原铁杖升温。对手可提前实付灵性布置单次挡火。',
      '原铁杖每次有效受热升温260度；达到600度后落地并损坏20耐久。自然每秒冷却1度，原水每次耗2升降温200度；降温不能修复变形。',
      '继承能力保留真实已学状态，掌握为0仍已学；没有真实队员、陷阱或准备物便普通回退。本人四项能力仍按35/30/20/15计算。',
      '双方六槽、有限灵性120与共同伤势盘保持；敌方灵性不恢复，本人仅续轮恢复12。身体与精神按实际来源分别结算；普通死亡终结本周目。' ] };
}
export type ConquerorEncounterProjection = ReturnType<typeof projectConquerorEncounter>;

/** Reconcile the existing ordinary weekly finance transition from its frozen
 * input, including debt notices, interrupted bills, receipts and the exact date.
 * Combat never heals, refills or erases debts to make this comparison pass. */
export function conquerorTerminalBudgetMatches(s: SliceState, _prep: ConquerorPreparation, o: ConquerorRoundOutcome): boolean {
  const e = s.conqueror.encounter, fight = e.journal.find(j => j.command.type === 'ENCOUNTER_FIGHT'); if (!fight) return false;
  const expected: ConquerorEncounterBudget = { ...fight.after, health: o.playerHealthAfter, mind: o.playerMindAfter, spirituality: o.playerSpiritualityAfter,
    mastery: o.masteryAfter, injuries: o.playerInjuriesAfter, injuryRisk: o.playerRiskAfter };
  const current = conquerorEncounterBudget(s);
  if (!same({ ...current, cash: expected.cash, actions: expected.actions }, expected) || s.random.cursor !== o.randomCursorAfter || !same(e.scene, terminalScene(o).root) || !same(e.materials, terminalScene(o).materials)) return false;
  const financialTitles = ['本周生活费', '生活费如实记账', '本周约定还款', '账目结清', '新的一周'];
  const receipts = s.chronicle.filter((entry, index) => entry.id === `record-${s.revision}-${index}` && financialTitles.includes(entry.title));
  if (expected.actions > 0 || o.playerHealthAfter === 0) return s.week === fight.week && same(s.date, fight.date) && s.actionsRemaining === expected.actions &&
    s.cash === expected.cash && same(conquerorFinanceSnapshot(s), fight.finance) && s.pulse === 'NONE' && s.billAmount === 0 && s.activeEvent === null && s.eventQueue.length === 0 && receipts.length === 0;
  if (expected.actions !== 0 || s.status !== 'ACTIVE') return false;
  const result = resolveSliceWeeklyFinance({ ...fight.finance, cash: expected.cash, week: fight.week, revision: o.source.revision, pulse: 'BILL', billAmount: 0 });
  const advanced = result.eventId === null && result.state.pulse === 'ADVANCE';
  const finance = { ...fight.finance, ...result.state, weeklyBudget: fight.finance.weeklyBudget, lifeTier: advanced ? result.state.nextLifeTier : fight.finance.lifeTier };
  if (s.cash !== result.state.cash || !same(conquerorFinanceSnapshot(s), conquerorFinanceSnapshot(finance)) || s.week !== fight.week + (advanced ? 1 : 0) ||
    !same(s.date, advanced ? addGameWeeks(fight.date, 1) : fight.date) || s.actionsRemaining !== (advanced ? fight.finance.weeklyBudget : 0) ||
    s.pulse !== (advanced ? 'NONE' : result.state.pulse) || s.billAmount !== (advanced ? 0 : result.state.billAmount)) return false;
  const expectedReceipts = result.receipts.map(receipt => ({ week: fight.week, ...receipt }));
  if (advanced) expectedReceipts.push({ week: fight.week + 1, title: '新的一周', text: `日期推进7天，本周${fight.finance.weeklyBudget}次行动。` });
  if (!same(receipts.map(({ week, title, text }) => ({ week, title, text })), expectedReceipts)) return false;
  if (result.eventId) {
    const terminalIndex = s.chronicle.findIndex((entry, index) => entry.id === `record-${s.revision}-${index}` && entry.title === '罗南的外院冲突结束');
    const eventIndex = terminalIndex + 1 + result.receipts.length;
    return terminalIndex >= 0 && s.eventQueue.length === 0 && same(s.activeEvent, { id: result.eventId, instanceId: `${s.runId}:${result.eventId}:${s.revision}:${eventIndex}` });
  }
  return true;
}
/** Replay is exact through the last battle command. Later legitimate life/team
 * recovery remains possible; it never rewrites this original encounter history. */
export function replayConquerorEncounterRoot(s: SliceState): ConquerorScene | null {
  try {
    const e = s.conqueror.encounter, initial = createConquerorEncounterState(), allNew = s.combatHistory.flatMap((r, i) => r.conquerorOutcome ? [i] : []);
    if (!e || !shape(e, Object.keys(initial)) || !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || e.targetId !== initial.targetId || !['HOLD', 'FOCUS_FLAME'].includes(e.policy) || !validConquerorBody(e) || !validConquerorScene(e.scene) || !validConquerorMaterials(e.materials) || e.weaponLocation !== e.materials.weapon.location) return null;
    if (!e.preparation) return same(e, initial) && allNew.length === 0 && s.combat?.encounterId !== 'CONQUEROR_DISPUTE' ? createConquerorScene() : null;
    const prep = e.preparation;
    if (!isConquerorEncounterStage(s) || s.conqueror.promotionWeek === null || !s.conqueror.life.reflected || !validateConquerorPreparation(prep) || prep.runId !== s.runId || prep.randomSeed !== s.random.seed || prep.randomCursor > s.random.cursor ||
      !integer(prep.week, s.conqueror.promotionWeek, s.week) || compareGameDates(prep.date, s.date) > 0 || !integer(prep.revision, 1, s.revision) || !historyUnchanged(s) || typeof e.originalResources !== 'string' || !e.originalResources || !Array.isArray(e.journal)) return null;
    let root = arrive(s, prep), status: ConquerorEncounterState['status'] = 'READY', policy: ConquerorPolicy = 'HOLD';
    let budget = prep.after, finance = prep.finance, week = prep.week, date = prep.date, revision = prep.revision;
    for (const entry of e.journal) {
      if (!shape(entry, ['command', 'week', 'date', 'revision', 'randomCursor', 'before', 'after', 'finance', 'sceneBefore', 'sceneAfter']) || !validateConquerorEncounterCommand(entry.command) || entry.command.type === 'ENCOUNTER_TALK' ||
        !validBudget(entry.before, entry.revision) || !validBudget(entry.after, entry.revision) || !validFinance(entry.finance, entry.week) || !integer(entry.revision, revision + 1, s.revision) ||
        entry.randomCursor !== prep.randomCursor || !same(entry.sceneBefore, root) || status !== 'READY' || entry.week !== week || !same(entry.date, date) || !same(entry.before, budget) || !same(entry.finance, finance)) return null;
      if (entry.command.type === 'SET_POLICY') { if (entry.command.policy === policy) return null; policy = entry.command.policy; }
      else if (entry.command.type === 'ENCOUNTER_FIGHT') { if (root.playerLocation !== 'YARD' || entry.before.actions < 1) return null; status = 'FIGHTING'; }
      else { leaveConquerorCombatScene(root); status = 'RESOLVED'; }
      if (!same(entry.after, { ...entry.before, actions: entry.before.actions - (entry.command.type === 'ENCOUNTER_FIGHT' ? 1 : 0) }) || !same(entry.sceneAfter, root)) return null;
      budget = entry.after; finance = entry.finance; week = entry.week; date = entry.date; revision = entry.revision;
    }
    if (e.policy !== policy) return null;
    if (status !== 'FIGHTING') {
      if (e.status !== status || e.startHistoryIndex !== null || e.startSource !== null || e.attemptWeek !== null || e.terminal !== null || !same(combatBody(e), initialConquerorBody()) || !same(e.materials, createConquerorMaterials()) || allNew.length || s.combat?.encounterId === 'CONQUEROR_DISPUTE') return null;
      if (status === 'READY' || s.revision === revision) {
        if (!originalsUnchanged(s) || !same(conquerorEncounterBudget(s), budget) || !same(conquerorFinanceSnapshot(s), finance) || s.week !== week || !same(s.date, date) || s.random.cursor !== prep.randomCursor || s.pulse !== 'NONE' || s.billAmount !== 0 || s.activeEvent || s.eventQueue.length) return null;
      }
      return root;
    }
    const start = e.startSource;
    if (!start || !validConquerorCombatSource(start) || !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.startHistoryIndex !== e.originalHistory!.length || e.attemptWeek !== week || start.round !== 1 || start.revision !== revision || start.week !== week || !same(start.date, date) || start.startHistoryIndex !== e.startHistoryIndex || start.runId !== s.runId || !same(start.preparation, prep) || start.policy !== policy ||
      !same(start.body, initialConquerorBody()) || !same(start.root, root) || !same(start.materials, createConquerorMaterials()) || start.randomSeed !== s.random.seed || start.randomCursor !== prep.randomCursor || start.playerHealth !== budget.health || start.playerMind !== budget.mind || start.playerSpirituality !== budget.spirituality || !same(start.mastery, budget.mastery) || !same(start.playerInjuries, budget.injuries) || start.playerRisk !== budget.injuryRisk) return null;
    const terminal = e.terminal;
    if (terminal && (!shape(terminal, ['outcome', 'round', 'historyIndex', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'exitMetres', 'exitSeconds']) || !integer(terminal.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1))) return null;
    const end = terminal ? terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    if (!same(allNew, rounds.map((_r, i) => e.startHistoryIndex! + i))) return null;
    for (const [i, round] of rounds.entries()) {
      const o = round.conquerorOutcome, previous = rounds[i - 1]?.conquerorOutcome;
      if (!o || !validateConquerorCombatRound(round) || round.round !== i + 1 || o.source.revision >= s.revision || o.randomCursorAfter > s.random.cursor || !same(o.source, previous ? nextConquerorCombatSource(previous) : start) || !same(o.source.root, root) || i < rounds.length - 1 && !o.continuing) return null;
      root = structuredClone(o.rootAfter);
    }
    const last = rounds.at(-1), o = last?.conquerorOutcome;
    if (e.status === 'FIGHTING') {
      if (terminal || !hasConquerorDisputeOpponent(s) || !same(combatBody(e), o ? combatBody(o) : start.body) || !same(e.materials, o ? o.materialsAfter : start.materials)) return null;
      const current = conquerorEncounterBudget(s), expected = { ...budget, health: o?.playerHealthAfter ?? start.playerHealth, mind: o?.playerMindAfter ?? start.playerMind, spirituality: o ? Math.min(120, o.playerSpiritualityAfter + 12) : start.playerSpirituality,
        mastery: o?.masteryAfter ?? start.mastery, injuries: o?.playerInjuriesAfter ?? start.playerInjuries, injuryRisk: o?.playerRiskAfter ?? start.playerRisk };
      if (!same(current, expected) || !same(conquerorFinanceSnapshot(s), finance) || s.week !== week || !same(s.date, date) || s.pulse !== 'NONE' || s.billAmount !== 0 || s.activeEvent !== null || s.eventQueue.length) return null;
      return o ? o.continuing && same(last, s.combat!.lastRound) && same(currentConquerorCombatSource(s), nextConquerorCombatSource(o)) ? root : null : s.combat!.lastRound === null && same(currentConquerorCombatSource(s), start) ? root : null;
    }
    if (s.combat?.encounterId === 'CONQUEROR_DISPUTE' || !terminal || !last || !o || o.continuing || terminal.round !== last.round || rounds.length !== terminal.round || !same(combatBody(e), combatBody(o)) || terminal.enemyHealth !== e.enemyHealth || terminal.enemyMind !== e.enemyMind || terminal.enemySpirituality !== e.enemySpirituality || terminal.enemyStatus !== e.enemyStatus ) return null;
    const final = terminalScene(o); if (terminal.exitMetres !== final.exit || terminal.exitSeconds !== final.exit || !same(e.materials, final.materials)) return null;
    if (s.revision === o.source.revision + 1 && (!originalsUnchanged(s) || !conquerorTerminalBudgetMatches(s, prep, o))) return null;
    if (terminal.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 ? final.root : null;
    if (terminal.outcome === 'RETREATED') return e.status === 'RETREATED' && o.playerHealthAfter > 0 && (last.retreat === 'SUCCESS' || o.playerMindAfter === 0) ? final.root : null;
    return e.status === 'RESOLVED' && o.playerHealthAfter > 0 && (terminal.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : terminal.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED') ? final.root : null;
  } catch { return null; }
}
export function validateConquerorEncounter(s: SliceState): boolean { try { const root = replayConquerorEncounterRoot(s); return root !== null && same(root, s.conqueror.encounter.scene); } catch { return false; } }
export const validateConquerorEncounterState = validateConquerorEncounter;
