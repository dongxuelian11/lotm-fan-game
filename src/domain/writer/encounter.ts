import { SLICE_LIFE } from '../../content/slice-events.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { addGameWeeks, compareGameDates, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceCombatRound, SliceInjury, SliceState } from '../slice/types.js';
import type { WriterAction } from './types.js';
import { hasWriterLifeLock } from './life.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { currentWriterCombatSource, nextWriterCombatSource, validWriterCombatSource, validateWriterCombatRound,
  validWriterBody, validWriterInjuries, type WriterCombatSource, type WriterRoundOutcome } from './combat.js';

export const WRITER_TARGET_ID = 'WR1-LUCIAN-VALE' as const;
export const WRITER_SITE = 'WR1-OPEN-STONE-COURT' as const;
export const WRITER_POWER_IDS = ['MIND_PULSE', 'WARD', 'ATTENTION'] as const;
export type WriterPowerId = typeof WRITER_POWER_IDS[number];
export type WriterEnemyIntent = WriterPowerId | 'BODY_STRIKE' | 'OBSERVE' | 'ACCIDENT';
export type WriterPolicy = 'HOLD' | 'RECIPROCAL_INSIGHT' | 'PLAUSIBLE_ARRANGEMENT' | 'BOTH';
export const WRITER_POWERS = [
  { id: 'MIND_PULSE', label: '有限心灵冲击', cost: 7, selfGain: 95, enemyReduction: 0 },
  { id: 'WARD', label: '一次精神护持', cost: 6, selfGain: 0, enemyReduction: 0 },
  { id: 'ATTENTION', label: '集中精神抵抗', cost: 3, selfGain: 0, enemyReduction: 0 },
] as const;
export interface WriterMaterials {
  weapon: { id: 'WR1-LUCIAN-ROD'; sourceId: 'WR1-LUCIAN-OWNED-ROD-1'; owner: typeof WRITER_TARGET_ID;
    massKg: 2; location: 'HAND' | 'COURT'; condition: 100 };
}
export function createWriterMaterials(): WriterMaterials {
  return { weapon: { id: 'WR1-LUCIAN-ROD', sourceId: 'WR1-LUCIAN-OWNED-ROD-1', owner: WRITER_TARGET_ID, massKg: 2, location: 'HAND', condition: 100 } };
}
export interface WriterScene {
  siteId: typeof WRITER_SITE; playerLocation: 'READING_ROOM' | 'COURT'; playerCoordinate: 0 | 6; enemyCoordinate: 8;
  ordinaryExit: 'OPEN'; thirdPartiesInArea: 0; presentMemberIds: string[]; observedSourceId: string | null; observationWeek: number | null;
  clockSeconds: number; externalSeconds: number; playerTravelMetres: number; knownPlayerName: string | null; knownEnemyName: string | null;
}
export function createWriterScene(): WriterScene {
  return { siteId: WRITER_SITE, playerLocation: 'READING_ROOM', playerCoordinate: 0, enemyCoordinate: 8, ordinaryExit: 'OPEN', thirdPartiesInArea: 0,
    presentMemberIds: [], observedSourceId: null, observationWeek: null, clockSeconds: 0, externalSeconds: 0, playerTravelMetres: 0, knownPlayerName: null, knownEnemyName: null };
}
export interface WriterCombatBody {
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  weaponLocation: 'HAND' | 'COURT'; powerUses: Record<WriterPowerId, number>;
  mentalPlague: number; plagueApplications: number; infectedRound: number | null; lastPlagueRound: number | null;
  personaGuards: number; identityUses: number; wovenImageUses: number; totalOwnerMindSpent: number;
  mentalImprintUses: number; mentalImprintSuccesses: number; insightWindowUses: number; insightWindowSuccesses: number;
  reciprocalAttempts: number; reciprocalSuccesses: number; arrangementAttempts: number; arrangementSuccesses: number;
}
export function initialWriterBody(): WriterCombatBody {
  return { enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0, weaponLocation: 'HAND',
    powerUses: { MIND_PULSE: 0, WARD: 0, ATTENTION: 0 }, mentalPlague: 0, plagueApplications: 0, infectedRound: null, lastPlagueRound: null,
    personaGuards: 0, identityUses: 0, wovenImageUses: 0, totalOwnerMindSpent: 0, mentalImprintUses: 0, mentalImprintSuccesses: 0,
    insightWindowUses: 0, insightWindowSuccesses: 0, reciprocalAttempts: 0, reciprocalSuccesses: 0, arrangementAttempts: 0, arrangementSuccesses: 0 };
}
export function combatBody(e: WriterCombatBody): WriterCombatBody {
  return Object.fromEntries(Object.keys(initialWriterBody()).map(k => [k, structuredClone(e[k as keyof WriterCombatBody])])) as unknown as WriterCombatBody;
}
export type WriterFinanceSnapshot = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface WriterEncounterBudget {
  cash: number; actions: number; health: number; mind: number; spirituality: number; pollution: number; gender: string; sequence: 1;
  acting: number; coreStats: SliceState['character']['coreStats']; mastery: Record<string, number>; completedSources: string[]; injuries: SliceInjury[]; injuryRisk: number;
}
export interface WriterPreparation {
  week: number; date: PublicGameDate; revision: number; runId: string; randomSeed: string; randomCursor: number; pricePaid: 0; actionsPaid: 1;
  lifeReflected: true; playerName: string; playerClubHeld: boolean; before: WriterEncounterBudget; after: WriterEncounterBudget; finance: WriterFinanceSnapshot;
}
export type WriterEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' } | { type: 'SET_POLICY'; policy: WriterPolicy };
export interface WriterEncounterJournal {
  command: Exclude<WriterEncounterCommand, { type: 'ENCOUNTER_TALK' }>; week: number; date: PublicGameDate; revision: number; randomCursor: number;
  before: WriterEncounterBudget; after: WriterEncounterBudget; finance: WriterFinanceSnapshot; sceneBefore: WriterScene; sceneAfter: WriterScene;
}
export interface WriterEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: WriterCombatBody['enemyStatus']; exitMetres: 0 | 6; exitSeconds: 0 | 6;
}
export interface WriterEncounterState extends WriterCombatBody {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof WRITER_TARGET_ID; policy: WriterPolicy;
  preparation: WriterPreparation | null; attemptWeek: number | null; startHistoryIndex: number | null; startSource: WriterCombatSource | null;
  originalHistory: SliceCombatRound[] | null; originalResources: string | null; scene: WriterScene; materials: WriterMaterials; journal: WriterEncounterJournal[]; terminal: WriterEncounterTerminal | null;
}
export function createWriterEncounterState(): WriterEncounterState {
  return { ...initialWriterBody(), status: 'AVAILABLE', targetId: WRITER_TARGET_ID, policy: 'HOLD', preparation: null, attemptWeek: null, startHistoryIndex: null,
    startSource: null, originalHistory: null, originalResources: null, scene: createWriterScene(), materials: createWriterMaterials(), journal: [], terminal: null };
}
export const createWriterEncounter = createWriterEncounterState;
export const isWriterEncounterStage = (s: SliceState) => s.progression.pathwayId === 'audience' && s.progression.sequence === 1;
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
export function writerFinanceSnapshot(s: WriterFinanceSnapshot): WriterFinanceSnapshot {
  return { weeklyBudget: s.weeklyBudget, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: structuredClone(s.debts), missedWeeks: s.missedWeeks, credit: s.credit };
}
function validFinance(v: WriterFinanceSnapshot, week: number): boolean {
  return shape(v, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit']) && integer(v.weeklyBudget, 1, 100) && Object.hasOwn(SLICE_LIFE, v.lifeTier) && Object.hasOwn(SLICE_LIFE, v.nextLifeTier) &&
    integer(v.missedWeeks) && ['NORMAL', 'NOTICE', 'SUSPENDED'].includes(v.credit) && Array.isArray(v.debts) && v.debts.every(d => shape(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek']) &&
      typeof d.id === 'string' && !!d.id && typeof d.source === 'string' && !!d.source && integer(d.remaining) && integer(d.weeklyPayment, 1) && integer(d.createdWeek, 0, week));
}
export function writerEncounterBudget(s: SliceState): WriterEncounterBudget {
  return { cash: s.cash, actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution, gender: s.character.gender,
    sequence: 1, acting: s.progression.acting, coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources], injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function validBudget(v: WriterEncounterBudget, revision: number): boolean {
  return shape(v, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) && integer(v.cash) &&
    integer(v.actions, 0, 100) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.pollution, 0, 100) && typeof v.gender === 'string' && v.sequence === 1 && integer(v.acting, 0, 100) &&
    shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) && Object.values(v.coreStats).every(n => integer(n, 0, 500)) && !!v.mastery && typeof v.mastery === 'object' && !Array.isArray(v.mastery) && Object.values(v.mastery).every(n => integer(n, 0, 500)) &&
    Array.isArray(v.completedSources) && v.completedSources.every(x => typeof x === 'string' && !!x) && new Set(v.completedSources).size === v.completedSources.length && validWriterInjuries(v.injuries, revision) && integer(v.injuryRisk);
}
export function validateWriterPreparation(v: unknown): v is WriterPreparation {
  try { const p = v as WriterPreparation;
    return shape(p, ['week', 'date', 'revision', 'runId', 'randomSeed', 'randomCursor', 'pricePaid', 'actionsPaid', 'lifeReflected', 'playerName', 'playerClubHeld', 'before', 'after', 'finance']) &&
      integer(p.week, 1) && isValidGameDate(p.date) && integer(p.revision, 1) && typeof p.runId === 'string' && !!p.runId && typeof p.randomSeed === 'string' && !!p.randomSeed && integer(p.randomCursor) &&
      typeof p.playerClubHeld === 'boolean' && typeof p.playerName === 'string' && p.playerName.trim().length > 0 && p.pricePaid === 0 && p.actionsPaid === 1 && p.lifeReflected === true && validBudget(p.before, p.revision) && validBudget(p.after, p.revision) && validFinance(p.finance, p.week) && p.before.actions >= 2 && p.before.actions <= Math.max(4, p.finance.weeklyBudget) &&
      same(p.after, { ...p.before, actions: p.before.actions - 1 });
  } catch { return false; }
}
export function validWriterMaterials(v: WriterMaterials): boolean {
  try { const initial = createWriterMaterials(); return shape(v, ['weapon']) && shape(v.weapon, Object.keys(initial.weapon)) &&
    ['HAND', 'COURT'].includes(v.weapon.location) && same({ ...v.weapon, location: 'HAND' }, initial.weapon); } catch { return false; }
}
export function validWriterScene(p: WriterScene): boolean {
  const initial = createWriterScene();
  return shape(p, Object.keys(initial)) && same({ ...p, playerLocation: initial.playerLocation, playerCoordinate: initial.playerCoordinate, observedSourceId: null, observationWeek: null, clockSeconds: 0, externalSeconds: 0, playerTravelMetres: 0, knownPlayerName: null, knownEnemyName: null }, initial) &&
    (p.playerLocation === 'READING_ROOM' && p.playerCoordinate === 0 || p.playerLocation === 'COURT' && p.playerCoordinate === 6) && integer(p.clockSeconds) && p.externalSeconds === p.clockSeconds && integer(p.playerTravelMetres) &&
    (p.observedSourceId === null ? p.observationWeek === null && p.knownPlayerName === null && p.knownEnemyName === null : typeof p.observedSourceId === 'string' && integer(p.observationWeek, 1) && typeof p.knownPlayerName === 'string' && p.knownPlayerName.trim().length > 0 && p.knownEnemyName === '卢西安·维尔');
}
function protectedOriginals(s: SliceState): string {
  return stableStringify({ audience: s.audience, mindreader: s.mindreader, psychologist: s.psychologist, hypnotist: s.hypnotist,
    dreamwalker: s.dreamwalker, manipulator: s.manipulator, dreamWeaver: s.dreamWeaver, discerner: s.discerner, town: s.town, life: s.writer.life });
}
function adultsAbsent(s: SliceState): boolean {
  return !hasWriterLifeLock(s) && s.writer.life.practice.participants.every(p => !p.present) && s.dreamWeaver.life.practice.identity === null;
}
function historyUnchanged(s: SliceState): boolean { const e = s.writer.encounter; return Array.isArray(e.originalHistory) && same(e.originalHistory, s.combatHistory.slice(0, e.originalHistory.length)); }
function originalsUnchanged(s: SliceState): boolean { return s.writer.encounter.originalResources === protectedOriginals(s) && historyUnchanged(s); }
export function validateWriterEncounterCommand(v: unknown): v is WriterEncounterCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as WriterEncounterCommand;
  return c.type === 'SET_POLICY' ? shape(c, ['type', 'policy']) && ['HOLD', 'RECIPROCAL_INSIGHT', 'PLAUSIBLE_ARRANGEMENT', 'BOTH'].includes(c.policy) : shape(c, ['type']) && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(c.type);
}
export const isWriterEncounterCommand = validateWriterEncounterCommand;
export const hasWriterEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.writer.encounter.status);
export const isInsideWriterEncounter = hasWriterEncounterLock;
export function blockWriterEncounter(s: SliceState, c: WriterEncounterCommand): string | null {
  if (!validateWriterEncounterCommand(c)) return '遭遇命令无效。'; const e = s.writer.encounter;
  if (!isWriterEncounterStage(s) || s.writer.promotionWeek === null || s.status !== 'ACTIVE' || s.health <= 0) return '须本人仍活着并完成作家晋升。';
  if (s.combat) return '先处理当前真实战斗。';
  if (!s.writer.life.reflected) return '先完成三项生活实践与反思，让两位成人实际离场。';
  if (!adultsAbsent(s)) return '先让伊芙琳和托马斯实际离场，并收束原生活实践与旧外部身份。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德石院。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' && originalsUnchanged(s) ? null : '须先到场交谈，才能普通离开。';
  if (s.activeEvent || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件或周账。';
  if (s.mind <= 0) return '需要保持清醒；已到场仍可普通退出。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' || e.preparation ? '同一原人争议不能重开或重置。' : s.actionsRemaining < 2 ? '到场需1行动，并另留1行动给自主决定开战。' : null;
  if (e.status !== 'READY' || !e.preparation || !originalsUnchanged(s)) return '须先亲自交谈并保留同一原现场、原人物和旧记录。';
  if (c.type === 'SET_POLICY') return c.policy === e.policy ? '已经采用这项策略。' : null;
  return s.actionsRemaining < 1 ? '交战需要1行动；和平退出不花行动。' : null;
}
export const writerEncounterReason = blockWriterEncounter;
export function leaveWriterCombatScene(p: WriterScene): void {
  if (p.playerLocation !== 'COURT' || p.playerCoordinate !== 6) throw new Error('须从实际所在石院离开。');
  p.playerLocation = 'READING_ROOM'; p.playerCoordinate = 0; p.playerTravelMetres += 6; p.clockSeconds += 6; p.externalSeconds += 6;
}
function arrive(s: SliceState, p: WriterPreparation): WriterScene {
  return { ...createWriterScene(), playerLocation: 'COURT', playerCoordinate: 6, observedSourceId: `${s.runId}:WR1-COURT:${p.revision}`, observationWeek: p.week,
    clockSeconds: 6, externalSeconds: 6, playerTravelMetres: 6, knownPlayerName: p.playerName, knownEnemyName: '卢西安·维尔' };
}
export function applyWriterEncounterCommand(s: SliceState, c: WriterEncounterCommand, ctx: SeerContext): void {
  const reason = blockWriterEncounter(s, c); if (reason) throw new Error(reason); const e = s.writer.encounter;
  if (c.type === 'ENCOUNTER_TALK') {
    const before = writerEncounterBudget(s); s.actionsRemaining--;
    e.preparation = { week: s.week, date: { ...s.date }, revision: s.revision + 1, runId: s.runId, randomSeed: s.random.seed, randomCursor: s.random.cursor, pricePaid: 0, actionsPaid: 1,
      lifeReflected: true, playerName: s.character.name, playerClubHeld: s.town.clubLocation === 'HAND', before, after: writerEncounterBudget(s), finance: writerFinanceSnapshot(s) };
    e.originalHistory = structuredClone(s.combatHistory); e.originalResources = protectedOriginals(s); e.scene = arrive(s, e.preparation); e.status = 'READY';
    ctx.note('走到石院与卢西安交谈', `实付1行动，步行6米6秒；你亲口介绍姓名“${s.character.name}”，卢西安·维尔也报出自己的姓名。他只因此知道你的姓名与当次会面，不取得你的秘密。46岁的他有独立身体、精神、120灵性与自己的唯一原杖。伊芙琳和托马斯已离场。你可以和平离开，也可自主交战。`); return;
  }
  const entry: WriterEncounterJournal = { command: structuredClone(c), week: s.week, date: { ...s.date }, revision: s.revision + 1, randomCursor: s.random.cursor,
    before: writerEncounterBudget(s), after: writerEncounterBudget(s), finance: writerFinanceSnapshot(s), sceneBefore: structuredClone(e.scene), sceneAfter: structuredClone(e.scene) };
  if (c.type === 'SET_POLICY') { e.policy = c.policy; ctx.note('选择作家交战策略', c.policy === 'HOLD' ? '暂不施放两项新能力；抽到时只作普通防备。' : '仅在抽到、双方确已交换姓名、存在尚未执行的可见动作且资源足够时，允许所选能力。每轮各一次，失败也支付实际成本，安排不能改写已完成的动作。'); }
  else if (c.type === 'LEAVE_ENCOUNTER') { leaveWriterCombatScene(e.scene); e.status = 'RESOLVED'; ctx.note('沿普通路和平离开石院', '没有战斗或奖励；沿开放出口实际走6米6秒。卢西安及唯一原杖仍留石院，所有已完成的旧事实保持。'); }
  else {
    s.actionsRemaining--; e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
    s.combat = { encounterId: 'WRITER_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
    ctx.note('选择与卢西安交战', '实付1行动。双方各自最多六次实际行动；卢西安以自己的有限灵性反击与护持，耗尽则使用唯一原杖。普通撤退、投降、伤势和真实死亡照常。');
  }
  entry.after = writerEncounterBudget(s); entry.sceneAfter = structuredClone(e.scene); e.journal.push(entry);
  if (c.type === 'ENCOUNTER_FIGHT') { const source = currentWriterCombatSource(s); if (!source) throw new Error('真实来源不完整。'); e.startSource = { ...source, revision: s.revision + 1 }; }
}
export const applyWriterEncounter = applyWriterEncounterCommand;
export const handleWriterEncounter = applyWriterEncounterCommand;
export function startWriterEncounter(s: SliceState, ctx: SeerContext): void { applyWriterEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasWriterDisputeOpponent(s: SliceState): boolean {
  const e = s.writer?.encounter, c = s.combat;
  return isWriterEncounterStage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && s.writer.life.reflected && s.writer.promotionWeek !== null &&
    !!e && e.status === 'FIGHTING' && e.targetId === WRITER_TARGET_ID && e.terminal === null && e.preparation !== null && originalsUnchanged(s) && e.attemptWeek === s.week &&
    adultsAbsent(s) && validWriterScene(e.scene) && e.scene.playerLocation === 'COURT' && e.scene.knownPlayerName === s.character.name && validWriterMaterials(e.materials) && validWriterBody(e) && e.weaponLocation === e.materials.weapon.location &&
    c?.encounterId === 'WRITER_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && e.enemyStatus === 'RESISTING' && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind &&
    same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk && integer(c.round, 1) && e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
function terminalScene(o: WriterRoundOutcome): { root: WriterScene; exit: 0 | 6; materials: WriterMaterials } {
  const root = structuredClone(o.rootAfter), materials = structuredClone(o.materialsAfter), exit = o.playerHealthAfter > 0 ? 6 : 0;
  if (exit) leaveWriterCombatScene(root);
  return { root, exit, materials };
}
export function settleWriterEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.writer.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'WRITER_DISPUTE') throw new Error('没有这场石院冲突。'); if (outcome === 'CONTINUE') return;
  const last = c.lastRound, o = last?.writerOutcome;
  if (!last || !o || !validateWriterCombatRound(last) || o.continuing || e.terminal || e.startHistoryIndex === null || c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round ||
    !originalsUnchanged(s) || !same(s.combatHistory.at(-1), last) || !same(combatBody(e), combatBody(o)) || !same(o.rootAfter, e.scene) || !same(o.materialsAfter, e.materials) || o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality ||
    !same(o.masteryAfter, s.progression.mastery) || !same(o.playerInjuriesAfter, s.injuries) || o.playerRiskAfter !== s.injuryRisk || o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || !same(o.enemyInjuries, c.enemyInjuries) || o.enemyRisk !== c.enemyRisk || o.enemyStatus !== c.enemyStatus ||
    outcome !== (o.playerHealthAfter === 0 ? 'PLAYER_DEAD' : o.enemyHealth === 0 ? 'ENEMY_DEAD' : o.enemyStatus === 'SURRENDERED' ? 'ENEMY_SURRENDERED' : 'RETREATED')) throw new Error('结局与真实回合、原身体、原物或已付费用不一致。');
  const final = terminalScene(o); e.scene = final.root; e.materials = final.materials;
  e.terminal = { outcome: outcome as WriterEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, exitMetres: final.exit, exitSeconds: final.exit };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('卢西安的石院冲突结束', `${final.exit ? '本人活着沿普通路线走6米6秒回阅览室外。' : '本人原身体真实死亡，留在石院，没有复活或搬移。'}双方实际灵性、精神、伤势与原杖落点保留；精神瘟疫不会因离场消失。两位生活参与者与旧人物、旧原物均不受此场改写。`);
}
export const finishWriterEncounter = settleWriterEncounter;
export function writerEncounterActions(s: SliceState): WriterAction[] {
  if (!isWriterEncounterStage(s)) return [];
  const choices: { command: WriterEncounterCommand; label: string; cost: string }[] = [
    { command: { type: 'ENCOUNTER_TALK' }, label: '走到石院互报姓名', cost: '1行动、6米6秒；开始前须有2行动' },
    { command: { type: 'SET_POLICY', policy: 'RECIPROCAL_INSIGHT' }, label: '允许互知线索', cost: '0行动；实际施放6灵性2精神、意志18、每轮一次' },
    { command: { type: 'SET_POLICY', policy: 'PLAUSIBLE_ARRANGEMENT' }, label: '允许合理安排', cost: '0行动；实际施放8灵性3精神、意志20、每轮一次' },
    { command: { type: 'SET_POLICY', policy: 'BOTH' }, label: '允许两项有限能力', cost: '0行动；各自抽到并满足条件时实付成本' },
    { command: { type: 'SET_POLICY', policy: 'HOLD' }, label: '保留两项新能力', cost: '0行动' },
    { command: { type: 'ENCOUNTER_FIGHT' }, label: '选择与卢西安交战', cost: '1行动；真实伤势和死亡风险' },
    { command: { type: 'LEAVE_ENCOUNTER' }, label: '沿普通路和平离开', cost: '0行动、6米6秒' },
  ];
  return choices.map(({ command, label, cost }) => { const reason = blockWriterEncounter(s, command); return { id: `writer-${command.type}${command.type === 'SET_POLICY' ? `-${command.policy}` : ''}`, label, cost, command, enabled: reason === null, reason }; });
}
export const WRITER_ENCOUNTER_STORY = '46岁的卢西安·维尔独自在净空石院提出通行争议。入场时他有健康100、精神100、灵性120与自己的唯一原杖，可施展有限心灵冲击、精神护持与集中抵抗。你沿6米普通路到场，先互报姓名；伊芙琳与托马斯不在场。交谈后可以和平离开，也可以自主承担真实冲突。';
export function projectWriterEncounter(s: SliceState) {
  const e = s.writer.encounter;
  return { title: '卢西安的石院争议', story: isWriterEncounterStage(s) ? WRITER_ENCOUNTER_STORY : '', status: e.status, inside: hasWriterEncounterLock(s), policy: e.policy,
    preparation: e.preparation ? { week: e.preparation.week, actionsPaid: 1 as const } : null, scene: structuredClone(e.scene), materials: structuredClone(e.materials),
    enemy: { id: e.targetId, name: '卢西安·维尔', age: 46 as const, sequence: 1 as const, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus,
      weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses }, abilities: WRITER_POWERS.map(p => p.label) }, actions: writerEncounterActions(s), facts: [
      '互报姓名只形成真实而有限的相互认识，不能凭此读取全部秘密。互知线索只观察对方眼前尚未执行的一项意图。',
      '合理安排需眼前真实待执行的动作；实付8灵性3精神并通过意志20与对方抵抗后，30秒内只影响那一个动作，最多减去40贡献。',
      '对方有30%的普通精神抵抗；实际护持或集中注意可提高到70%。施术失败或被抵抗仍支付成本，未使用窗口按时结束。',
      '23项旧能力保持实际掌握，零掌握仍已学。没有免费身份队伍、额外资源或改写过去。',
      '双方六槽与共同伤势盘保持；灵性上限120，本人只在实际续轮恢复12，对方不自动恢复。精神耗尽为活着停战，身体死亡为终局。' ] };
}
export type WriterEncounterProjection = ReturnType<typeof projectWriterEncounter>;

/** Reconcile the existing ordinary weekly finance transition from its frozen
 * input, including debt notices, interrupted bills, receipts and the exact date.
 * Combat never heals, refills or erases debts to make this comparison pass. */
export function writerTerminalBudgetMatches(s: SliceState, _prep: WriterPreparation, o: WriterRoundOutcome): boolean {
  const e = s.writer.encounter, fight = e.journal.find(j => j.command.type === 'ENCOUNTER_FIGHT'); if (!fight) return false;
  const expected: WriterEncounterBudget = { ...fight.after, health: o.playerHealthAfter, mind: o.playerMindAfter, spirituality: o.playerSpiritualityAfter,
    mastery: o.masteryAfter, injuries: o.playerInjuriesAfter, injuryRisk: o.playerRiskAfter };
  const current = writerEncounterBudget(s);
  if (!same({ ...current, cash: expected.cash, actions: expected.actions }, expected) || s.random.cursor !== o.randomCursorAfter || !same(e.scene, terminalScene(o).root) || !same(e.materials, terminalScene(o).materials)) return false;
  const financialTitles = ['本周生活费', '生活费如实记账', '本周约定还款', '账目结清', '新的一周'];
  const receipts = s.chronicle.filter((entry, index) => entry.id === `record-${s.revision}-${index}` && financialTitles.includes(entry.title));
  if (expected.actions > 0 || o.playerHealthAfter === 0) return s.week === fight.week && same(s.date, fight.date) && s.actionsRemaining === expected.actions &&
    s.cash === expected.cash && same(writerFinanceSnapshot(s), fight.finance) && s.pulse === 'NONE' && s.billAmount === 0 && s.activeEvent === null && s.eventQueue.length === 0 && receipts.length === 0;
  if (expected.actions !== 0 || s.status !== 'ACTIVE') return false;
  const result = resolveSliceWeeklyFinance({ ...fight.finance, cash: expected.cash, week: fight.week, revision: o.source.revision, pulse: 'BILL', billAmount: 0 });
  const advanced = result.eventId === null && result.state.pulse === 'ADVANCE';
  const finance = { ...fight.finance, ...result.state, weeklyBudget: fight.finance.weeklyBudget, lifeTier: advanced ? result.state.nextLifeTier : fight.finance.lifeTier };
  if (s.cash !== result.state.cash || !same(writerFinanceSnapshot(s), writerFinanceSnapshot(finance)) || s.week !== fight.week + (advanced ? 1 : 0) ||
    !same(s.date, advanced ? addGameWeeks(fight.date, 1) : fight.date) || s.actionsRemaining !== (advanced ? fight.finance.weeklyBudget : 0) ||
    s.pulse !== (advanced ? 'NONE' : result.state.pulse) || s.billAmount !== (advanced ? 0 : result.state.billAmount)) return false;
  const expectedReceipts = result.receipts.map(receipt => ({ week: fight.week, ...receipt }));
  if (advanced) expectedReceipts.push({ week: fight.week + 1, title: '新的一周', text: `日期推进7天，本周${fight.finance.weeklyBudget}次行动。` });
  if (!same(receipts.map(({ week, title, text }) => ({ week, title, text })), expectedReceipts)) return false;
  if (result.eventId) {
    const terminalIndex = s.chronicle.findIndex((entry, index) => entry.id === `record-${s.revision}-${index}` && entry.title === '卢西安的石院冲突结束');
    const eventIndex = terminalIndex + 1 + result.receipts.length;
    return terminalIndex >= 0 && s.eventQueue.length === 0 && same(s.activeEvent, { id: result.eventId, instanceId: `${s.runId}:${result.eventId}:${s.revision}:${eventIndex}` });
  }
  return true;
}
/** Replay is exact through the last battle command. Later legitimate life/team
 * recovery remains possible; it never rewrites this original encounter history. */
export function replayWriterEncounterRoot(s: SliceState): WriterScene | null {
  try {
    const e = s.writer.encounter, initial = createWriterEncounterState(), allNew = s.combatHistory.flatMap((r, i) => r.writerOutcome ? [i] : []);
    if (!e || !shape(e, Object.keys(initial)) || !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || e.targetId !== initial.targetId || !['HOLD', 'RECIPROCAL_INSIGHT', 'PLAUSIBLE_ARRANGEMENT', 'BOTH'].includes(e.policy) || !validWriterBody(e) || !validWriterScene(e.scene) || !validWriterMaterials(e.materials) || e.weaponLocation !== e.materials.weapon.location) return null;
    if (!e.preparation) return same(e, initial) && allNew.length === 0 && s.combat?.encounterId !== 'WRITER_DISPUTE' ? createWriterScene() : null;
    const prep = e.preparation;
    if (!isWriterEncounterStage(s) || s.writer.promotionWeek === null || !s.writer.life.reflected || !validateWriterPreparation(prep) || prep.runId !== s.runId || prep.playerName !== s.character.name || prep.randomSeed !== s.random.seed || prep.randomCursor > s.random.cursor ||
      !integer(prep.week, s.writer.promotionWeek, s.week) || compareGameDates(prep.date, s.date) > 0 || !integer(prep.revision, 1, s.revision) || !historyUnchanged(s) || typeof e.originalResources !== 'string' || !e.originalResources || !Array.isArray(e.journal)) return null;
    let root = arrive(s, prep), status: WriterEncounterState['status'] = 'READY', policy: WriterPolicy = 'HOLD';
    let budget = prep.after, finance = prep.finance, week = prep.week, date = prep.date, revision = prep.revision;
    for (const entry of e.journal) {
      if (!shape(entry, ['command', 'week', 'date', 'revision', 'randomCursor', 'before', 'after', 'finance', 'sceneBefore', 'sceneAfter']) || !validateWriterEncounterCommand(entry.command) || entry.command.type === 'ENCOUNTER_TALK' ||
        !validBudget(entry.before, entry.revision) || !validBudget(entry.after, entry.revision) || !validFinance(entry.finance, entry.week) || !integer(entry.revision, revision + 1, s.revision) ||
        entry.randomCursor !== prep.randomCursor || !same(entry.sceneBefore, root) || status !== 'READY' || entry.week !== week || !same(entry.date, date) || !same(entry.before, budget) || !same(entry.finance, finance)) return null;
      if (entry.command.type === 'SET_POLICY') { if (entry.command.policy === policy) return null; policy = entry.command.policy; }
      else if (entry.command.type === 'ENCOUNTER_FIGHT') { if (root.playerLocation !== 'COURT' || entry.before.actions < 1) return null; status = 'FIGHTING'; }
      else { leaveWriterCombatScene(root); status = 'RESOLVED'; }
      if (!same(entry.after, { ...entry.before, actions: entry.before.actions - (entry.command.type === 'ENCOUNTER_FIGHT' ? 1 : 0) }) || !same(entry.sceneAfter, root)) return null;
      budget = entry.after; finance = entry.finance; week = entry.week; date = entry.date; revision = entry.revision;
    }
    if (e.policy !== policy) return null;
    if (status !== 'FIGHTING') {
      if (e.status !== status || e.startHistoryIndex !== null || e.startSource !== null || e.attemptWeek !== null || e.terminal !== null || !same(combatBody(e), initialWriterBody()) || !same(e.materials, createWriterMaterials()) || allNew.length || s.combat?.encounterId === 'WRITER_DISPUTE') return null;
      if (status === 'READY' || s.revision === revision) {
        if (!originalsUnchanged(s) || !same(writerEncounterBudget(s), budget) || !same(writerFinanceSnapshot(s), finance) || s.week !== week || !same(s.date, date) || s.random.cursor !== prep.randomCursor || s.pulse !== 'NONE' || s.billAmount !== 0 || s.activeEvent || s.eventQueue.length) return null;
      }
      return root;
    }
    const start = e.startSource;
    if (!start || !validWriterCombatSource(start) || !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.startHistoryIndex !== e.originalHistory!.length || e.attemptWeek !== week || start.round !== 1 || start.revision !== revision || start.week !== week || !same(start.date, date) || start.startHistoryIndex !== e.startHistoryIndex || start.runId !== s.runId || !same(start.preparation, prep) || start.policy !== policy ||
      !same(start.body, initialWriterBody()) || !same(start.root, root) || !same(start.materials, createWriterMaterials()) || start.randomSeed !== s.random.seed || start.randomCursor !== prep.randomCursor || start.playerHealth !== budget.health || start.playerMind !== budget.mind || start.playerSpirituality !== budget.spirituality || !same(start.mastery, budget.mastery) || !same(start.playerInjuries, budget.injuries) || start.playerRisk !== budget.injuryRisk) return null;
    const terminal = e.terminal;
    if (terminal && (!shape(terminal, ['outcome', 'round', 'historyIndex', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'exitMetres', 'exitSeconds']) || !integer(terminal.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1))) return null;
    const end = terminal ? terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    if (!same(allNew, rounds.map((_r, i) => e.startHistoryIndex! + i))) return null;
    for (const [i, round] of rounds.entries()) {
      const o = round.writerOutcome, previous = rounds[i - 1]?.writerOutcome;
      if (!o || !validateWriterCombatRound(round) || round.round !== i + 1 || o.source.revision >= s.revision || o.randomCursorAfter > s.random.cursor || !same(o.source, previous ? nextWriterCombatSource(previous) : start) || !same(o.source.root, root) || i < rounds.length - 1 && !o.continuing) return null;
      root = structuredClone(o.rootAfter);
    }
    const last = rounds.at(-1), o = last?.writerOutcome;
    if (e.status === 'FIGHTING') {
      if (terminal || !hasWriterDisputeOpponent(s) || !same(combatBody(e), o ? combatBody(o) : start.body) || !same(e.materials, o ? o.materialsAfter : start.materials)) return null;
      const current = writerEncounterBudget(s), expected = { ...budget, health: o?.playerHealthAfter ?? start.playerHealth, mind: o?.playerMindAfter ?? start.playerMind, spirituality: o ? Math.min(120, o.playerSpiritualityAfter + 12) : start.playerSpirituality,
        mastery: o?.masteryAfter ?? start.mastery, injuries: o?.playerInjuriesAfter ?? start.playerInjuries, injuryRisk: o?.playerRiskAfter ?? start.playerRisk };
      if (!same(current, expected) || !same(writerFinanceSnapshot(s), finance) || s.week !== week || !same(s.date, date) || s.pulse !== 'NONE' || s.billAmount !== 0 || s.activeEvent !== null || s.eventQueue.length) return null;
      return o ? o.continuing && same(last, s.combat!.lastRound) && same(currentWriterCombatSource(s), nextWriterCombatSource(o)) ? root : null : s.combat!.lastRound === null && same(currentWriterCombatSource(s), start) ? root : null;
    }
    if (s.combat?.encounterId === 'WRITER_DISPUTE' || !terminal || !last || !o || o.continuing || terminal.round !== last.round || rounds.length !== terminal.round || !same(combatBody(e), combatBody(o)) || terminal.enemyHealth !== e.enemyHealth || terminal.enemyMind !== e.enemyMind || terminal.enemySpirituality !== e.enemySpirituality || terminal.enemyStatus !== e.enemyStatus ) return null;
    const final = terminalScene(o); if (terminal.exitMetres !== final.exit || terminal.exitSeconds !== final.exit || !same(e.materials, final.materials)) return null;
    if (s.revision === o.source.revision + 1 && (!originalsUnchanged(s) || !writerTerminalBudgetMatches(s, prep, o))) return null;
    if (terminal.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 ? final.root : null;
    if (terminal.outcome === 'RETREATED') return e.status === 'RETREATED' && o.playerHealthAfter > 0 && (last.retreat === 'SUCCESS' || o.playerMindAfter === 0) ? final.root : null;
    return e.status === 'RESOLVED' && o.playerHealthAfter > 0 && (terminal.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : terminal.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED') ? final.root : null;
  } catch { return null; }
}
export function validateWriterEncounter(s: SliceState): boolean { try { const root = replayWriterEncounterRoot(s); return root !== null && same(root, s.writer.encounter.scene); } catch { return false; } }
export const validateWriterEncounterState = validateWriterEncounter;
