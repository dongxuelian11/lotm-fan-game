import type { PublicGameDate } from '../../shared/contracts.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { AncientEvilAcquisitionBudget } from './types.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SilentDiscipleLifeState } from '../silent-disciple/life.js';
import type { SilentDiscipleEncounterState, SilentDiscipleReflection } from '../silent-disciple/encounter.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { ancientEvilLifeClosed, replayAncientEvilLifeRoot } from './life.js';
import { advanceAncientEvilCombatClock, createAncientEvilRuntime, currentAncientEvilCombatSource, nextAncientEvilCombatSource, validAncientEvilBody,
  validateAncientEvilCombatRound, validateAncientEvilRoundOutcome, type AncientEvilCombatSource, type AncientEvilRoundOutcome } from './combat.js';

export const ANCIENT_EVIL_TARGET_ID = 'AE2-LENA' as const;
export const ANCIENT_EVIL_BLOCK_IDS = ['AE2-BLOCK-1', 'AE2-BLOCK-2', 'AE2-BLOCK-3'] as const;
export const ANCIENT_EVIL_POWER_IDS = ['DREAM_SPIKE', 'DREAM_WARD', 'RESIST_FORM'] as const;
export type AncientEvilPowerId = typeof ANCIENT_EVIL_POWER_IDS[number];
export type AncientEvilEnemyIntent = AncientEvilPowerId | 'BODY_STRIKE' | 'ACCIDENT';
/** Original adult Dream Weaver; finite game adaptations are deliberately not a canon stat sheet. */
export const ANCIENT_EVIL_POWERS = [
  { id: 'DREAM_SPIKE', label: '精神梦刺', abilityId: 'audience.s3.woven-image', cost: 6, selfGain: 70, enemyReduction: 0 },
  { id: 'DREAM_WARD', label: '手势梦障', abilityId: 'audience.s3.woven-image', cost: 4, selfGain: 0, enemyReduction: 30 },
  { id: 'RESIST_FORM', label: '独立精神抵抗', abilityId: null, cost: 6, selfGain: 8, enemyReduction: 0 },
] as const;
export interface AncientEvilBlock { id: typeof ANCIENT_EVIL_BLOCK_IDS[number]; owner: 'PLAYER'; status: 'READY' | 'SPENT'; location: 'SOURCE' | 'TARGET_GROUND'; usedRound: number | null }
export interface AncientEvilCombatBody {
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  emotion: 'ANGRY'; weaponLocation: 'HAND' | 'COURT'; enemyForm: 'HUMAN' | 'RABBIT'; enemyFormUntilSeconds: number | null;
  powerUses: Record<AncientEvilPowerId, number>; blocksPurchased: boolean; blocks: AncientEvilBlock[]; form: 'HUMAN' | 'WOOD'; formUntilSeconds: number | null;
  link: 'NONE' | 'LINKED'; linkRound: number | null; lastFormRound: number | null; contactAttempts: number; formAttempts: number; breakLinkUses: number;
  contactDistanceMetres: number; transfigurationAttempts: number; transfigurationSuccesses: number; pickUpUses: number; reflectionHistory: SilentDiscipleReflection[];
}
function initialBody(): AncientEvilCombatBody {
  return { enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0, emotion: 'ANGRY', weaponLocation: 'HAND',
    enemyForm: 'HUMAN', enemyFormUntilSeconds: null, powerUses: { DREAM_SPIKE: 0, DREAM_WARD: 0, RESIST_FORM: 0 }, blocksPurchased: false, blocks: [],
    form: 'HUMAN', formUntilSeconds: null, link: 'NONE', linkRound: null, lastFormRound: null, contactAttempts: 0, formAttempts: 0, breakLinkUses: 0, contactDistanceMetres: 0,
    transfigurationAttempts: 0, transfigurationSuccesses: 0, pickUpUses: 0, reflectionHistory: [] };
}
export function combatBody(e: AncientEvilCombatBody): AncientEvilCombatBody {
  return Object.fromEntries(Object.keys(initialBody()).map(k => [k, structuredClone(e[k as keyof AncientEvilCombatBody])])) as unknown as AncientEvilCombatBody;
}
interface Budget { cash: number; actions: number; health: number; mind: number; spirituality: number }
export interface AncientEvilPreparation {
  week: number; date: PublicGameDate; revision: number; runId: string; randomSeed: string; randomCursor: number; mindPaid: 2; fullBefore: AncientEvilAcquisitionBudget; fullAfter: AncientEvilAcquisitionBudget;
  lifeJournalLength: number; lifeClockSeconds: number; before: Budget; after: Budget;
}
export interface AncientEvilBlockPurchase { week: number; date: PublicGameDate; revision: number; cashBefore: number; cashAfter: number; paid: 80; ids: typeof ANCIENT_EVIL_BLOCK_IDS; before: AncientEvilAcquisitionBudget; after: AncientEvilAcquisitionBudget; randomBefore: number; randomAfter: number }
export interface AncientEvilClearance {
  week: number; elsaId: 'SD3-ELSA'; elsaConsent: 'GRANTED'; elsaFrom: 'A'; elsaTo: 'OUTSIDE'; elsaMetres: 8; elsaSeconds: 8; elsaRoute: ['A', 'START', 'OUTSIDE'];
  guideId: 'HARLAN'; guideConsent: 'GRANTED'; guideFrom: 'START'; guideTo: 'OUTSIDE'; guideMetres: 4; guideSeconds: 4; guideRoute: ['START', 'OUTSIDE'];
  clothesId: 'SD3-CLOTHES'; bagId: 'SD3-BAG'; playerMetres: 4; playerSeconds: 4; elapsedSeconds: 16;
}
export interface AncientEvilEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: AncientEvilCombatBody['enemyStatus']; formWaitSeconds: number; exitMetres: 0 | 4; exitSeconds: 0 | 4;
}
export interface AncientEvilEncounterState extends AncientEvilCombatBody {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof ANCIENT_EVIL_TARGET_ID;
  preparation: AncientEvilPreparation | null; blockPurchase: AncientEvilBlockPurchase | null; approachWeek: number | null; approachRevision: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  startRoot: SilentDiscipleLifeState | null; startSource: AncientEvilCombatSource | null; originalEncounter: SilentDiscipleEncounterState | null; clearance: AncientEvilClearance | null;
  yardId: 'SD3-QUIET-ROOM'; ordinaryExit: 'OPEN'; enemyPosition: 'BETWEEN_A_AND_B'; enemyDistanceMetres: 2; terminal: AncientEvilEncounterTerminal | null;
}
export type AncientEvilEncounterCommand = { type: 'BUY_BLOCKS' | 'PREPARE_ENCOUNTER' | 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface AncientEvilEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: AncientEvilEncounterCommand }
export interface AncientEvilEncounterProjection {
  title: string; story: string; status: AncientEvilEncounterState['status']; inside: boolean; preparation: AncientEvilPreparation | null;
  scene: null | { courtId: 'SD3-QUIET-ROOM'; playerLocation: string; elsaLocation: string; guideLocation: string; ordinaryExit: 'OPEN'; distanceMetres: number; clockSeconds: number; playerTravelMetres: number };
  enemy: null | { id: typeof ANCIENT_EVIL_TARGET_ID; name: '莱娜'; age: 45; pathway: 'audience'; sequence: 3; health: number; mind: number; spirituality: number; status: AncientEvilCombatBody['enemyStatus'];
    form: 'HUMAN' | 'RABBIT'; formRemainingSeconds: number; weaponId: 'AE2-LENA-STAFF'; weaponLocation: 'HAND' | 'COURT'; powerUses: Record<AncientEvilPowerId, number>; abilities: string[] };
  actions: AncientEvilEncounterAction[]; facts: string[];
}
export const ANCIENT_EVIL_ENCOUNTER_STORY = '45岁的织梦人莱娜来到原安静室，为这里的通行安排提出争议。她有独立意志、自己的原身体与唯一手杖，当前因争执而愤怒。埃尔莎与哈伦须分别同意并亲自沿原路走到室外，才可交谈。莱娜能抵抗变形，也会保留兔形下仍可使用的心智能力；交谈后可以和平离开，交战不是晋升条件。';
export function createAncientEvilEncounterState(): AncientEvilEncounterState {
  return { ...initialBody(), status: 'AVAILABLE', targetId: ANCIENT_EVIL_TARGET_ID, preparation: null, blockPurchase: null, approachWeek: null, approachRevision: null,
    attemptWeek: null, startHistoryIndex: null, startRoot: null, startSource: null, originalEncounter: null, clearance: null,
    yardId: 'SD3-QUIET-ROOM', ordinaryExit: 'OPEN', enemyPosition: 'BETWEEN_A_AND_B', enemyDistanceMetres: 2, terminal: null };
}
const stage = (s: SliceState) => s.progression.pathwayId === 'chained' && s.progression.sequence === 2;
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
const budget = (s: SliceState): Budget => ({ cash: s.cash, actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality });
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
function fullBudget(s: SliceState): AncientEvilAcquisitionBudget {
  return { ...budget(s), pollution: s.seer.pollution, sequence: s.progression.sequence as 2, acting: s.progression.acting,
    coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources], injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function validFullBudget(v: AncientEvilAcquisitionBudget): boolean {
  return shape(v, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) &&
    integer(v.cash) && integer(v.actions, 0, 100) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.pollution, 0, 100) && v.sequence === 2 && integer(v.acting, 0, 100) &&
    shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) && Object.values(v.coreStats).every(n => integer(n, 0, 500)) && !!v.mastery && typeof v.mastery === 'object' && !Array.isArray(v.mastery) && Object.values(v.mastery).every(n => integer(n, 0, 500)) &&
    Array.isArray(v.completedSources) && v.completedSources.every(x => typeof x === 'string' && x.length > 0) && new Set(v.completedSources).size === v.completedSources.length && integer(v.injuryRisk) && Array.isArray(v.injuries) &&
    new Set(v.injuries.map(i => i.id)).size === v.injuries.length && v.injuries.every(i => shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && !!i.id && ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision)));
}
const sharedBudget = (b: AncientEvilAcquisitionBudget): Budget => ({ cash: b.cash, actions: b.actions, health: b.health, mind: b.mind, spirituality: b.spirituality });
const validDate = (date: PublicGameDate, week: number): boolean => isValidGameDate(date) && week === Math.floor(gameDaysBetween(ORIGIN, date) / 7) + 1;

export function validateAncientEvilEncounterCommand(v: unknown): v is AncientEvilEncounterCommand { return shape(v, ['type']) && ['BUY_BLOCKS', 'PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type)); }
export const isAncientEvilEncounterCommand = validateAncientEvilEncounterCommand;
export const hasAncientEvilEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.ancientEvil.encounter.status);
export const isInsideAncientEvilEncounter = hasAncientEvilEncounterLock;
function closedRoot(p: SilentDiscipleLifeState): boolean {
  return p.siteId === 'SD3-QUIET-ROOM' && p.introducedWeek !== null && p.playerLocation === 'START' && p.volunteer.id === 'SD3-ELSA' && p.volunteer.age === 43 && p.volunteer.alive && p.volunteer.willing &&
    p.volunteer.location === 'A' && p.volunteer.form === 'HUMAN' && p.volunteer.bodyId === 'SD3-ELSA' && p.guide.id === 'HARLAN' && p.guide.location === 'START' &&
    p.clothing.id === 'SD3-CLOTHES' && p.clothing.owner === 'SD3-ELSA' && p.clothing.quantity === 1 && p.clothing.location === 'ELSA' && p.clothing.worn && p.bag.id === 'SD3-BAG' && p.bag.owner === 'SD3-ELSA' && p.bag.quantity === 1 && p.bag.location === 'ELSA' &&
    p.activeCase === null && Object.values(p.cases).every(c => c.status === 'RESOLVED' && !c.contactOpen);
}
function lifeReady(s: SliceState): boolean {
  const shadow = { ...s, silentDisciple: { ...s.silentDisciple, life: s.ancientEvil.encounter.startRoot ?? s.silentDisciple.life } };
  return s.ancientEvil.preparedWeek === null && s.ancientEvil.life.reflected && ancientEvilLifeClosed(shadow);
}
const clearance = (week: number): AncientEvilClearance => ({ week, elsaId: 'SD3-ELSA', elsaConsent: 'GRANTED', elsaFrom: 'A', elsaTo: 'OUTSIDE', elsaMetres: 8, elsaSeconds: 8,
  elsaRoute: ['A', 'START', 'OUTSIDE'], guideId: 'HARLAN', guideConsent: 'GRANTED', guideFrom: 'START', guideTo: 'OUTSIDE', guideMetres: 4, guideSeconds: 4, guideRoute: ['START', 'OUTSIDE'],
  clothesId: 'SD3-CLOTHES', bagId: 'SD3-BAG', playerMetres: 4, playerSeconds: 4, elapsedSeconds: 16 });
export function ancientEvilApproachedRoot(start: SilentDiscipleLifeState, week: number): SilentDiscipleLifeState {
  if (!closedRoot(start) || !integer(week, start.introducedWeek!)) throw new Error('须先归还原物并恢复同一埃尔莎人形，再询问两人的此次离场同意。');
  const p = structuredClone(start); p.volunteer.location = 'OUTSIDE'; p.clockSeconds += 8; p.guide.location = 'OUTSIDE'; p.clockSeconds += 4;
  p.playerLocation = 'A'; p.playerTravelMetres += 4; p.clockSeconds += 4; return p;
}
export function leaveAncientEvilCombatRoot(p: SilentDiscipleLifeState): void {
  if (p.playerLocation !== 'A' || p.volunteer.location !== 'OUTSIDE' || p.guide.location !== 'OUTSIDE') throw new Error('实际位置不支持普通退出。');
  p.playerLocation = 'START'; p.playerTravelMetres += 4; p.clockSeconds += 4;
}
function actualCourt(s: SliceState): boolean {
  const e = s.ancientEvil.encounter, p = s.silentDisciple.life;
  return e.yardId === 'SD3-QUIET-ROOM' && e.ordinaryExit === 'OPEN' && e.enemyPosition === 'BETWEEN_A_AND_B' && e.enemyDistanceMetres === 2 && e.startRoot !== null && closedRoot(e.startRoot) && e.preparation !== null &&
    e.approachWeek === s.week && same(e.clearance, clearance(s.week)) && p.siteId === 'SD3-QUIET-ROOM' && p.playerLocation === 'A' && p.volunteer.id === 'SD3-ELSA' && p.volunteer.age === 43 && p.volunteer.location === 'OUTSIDE' &&
    p.volunteer.form === 'HUMAN' && p.volunteer.alive && p.clothing.location === 'ELSA' && p.clothing.worn && p.bag.location === 'ELSA' && p.guide.id === 'HARLAN' && p.guide.location === 'OUTSIDE' && same(e.originalEncounter, s.silentDisciple.encounter);
}
export function validateAncientEvilPreparation(v: unknown): v is AncientEvilPreparation {
  try { const p = v as AncientEvilPreparation;
    return shape(p, ['week', 'date', 'revision', 'runId', 'randomSeed', 'randomCursor', 'mindPaid', 'lifeJournalLength', 'lifeClockSeconds', 'before', 'after', 'fullBefore', 'fullAfter']) && integer(p.week, 1) && validDate(p.date, p.week) && integer(p.revision, 1) && typeof p.runId === 'string' && !!p.runId && typeof p.randomSeed === 'string' && !!p.randomSeed && integer(p.randomCursor) &&
      p.mindPaid === 2 && integer(p.lifeJournalLength, 1) && integer(p.lifeClockSeconds) && [p.before, p.after].every(b => shape(b, ['cash', 'actions', 'health', 'mind', 'spirituality']) && integer(b.cash) && integer(b.actions, 0, 100) && integer(b.health, 1, 100) && integer(b.mind, 1, 100) && integer(b.spirituality, 0, 120)) && p.before.mind > 2 && same(p.after, { ...p.before, mind: p.before.mind - 2 }) && validFullBudget(p.fullBefore) && validFullBudget(p.fullAfter) && same(p.fullAfter, { ...p.fullBefore, mind: p.fullBefore.mind - 2 }) && same(p.before, sharedBudget(p.fullBefore)) && same(p.after, sharedBudget(p.fullAfter));
  } catch { return false; }
}
export function blockAncientEvilEncounter(s: SliceState, c: AncientEvilEncounterCommand): string | null {
  if (!validateAncientEvilEncounterCommand(c)) return '遭遇命令无效。'; const e = s.ancientEvil.encounter;
  if (!stage(s) || s.status !== 'ACTIVE' || s.health <= 0 || s.ancientEvil.promotionWeek === null || !s.ancientEvil.guidanceKnown) return '须本人仍活着且已完成本次晋升。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。'; if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德。';
  if (!lifeReady(s)) return '先完成三次真实报告、清理原现场并反思。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' && actualCourt(s) ? null : '先真实到场交谈，才能沿原路离开。';
  if (s.mind <= 0) return '先恢复精神；到场后仍可和平离开。';
  if (c.type === 'BUY_BLOCKS') return e.status !== 'AVAILABLE' || e.preparation || e.blocksPurchased ? '仅在整理遭遇准备前购买这一组三块原物，不能重复购入或补充旧块。' : s.cash < 80 ? '购入这组三块原木块需要80便士。' : null;
  if (c.type === 'PREPARE_ENCOUNTER') {
    if (e.status !== 'AVAILABLE' || e.preparation) return '准备已有记录，不重置原对手。'; const end = replayAncientEvilLifeRoot(s);
    if (!end || !same(end, s.silentDisciple.life) || !closedRoot(end) || s.silentDisciple.encounter.enemyStatus !== 'SURRENDERED') return '须原现场已真实收口，原卡尔德仍保留此前投降结局。';
    return s.mind <= 2 ? '整理注意力需要2精神并保持清醒。' : null;
  }
  if (s.actionsRemaining < 1) return '这次选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' || !e.preparation || !closedRoot(s.silentDisciple.life) ? '先准备并核实埃尔莎已恢复人形、原衣包归主。' : s.actionsRemaining < 2 ? '交谈需1行动，另留1行动决定是否交战。' : null;
  return e.status === 'READY' && actualCourt(s) ? null : '先询问两人此次离场同意，让他们沿原路实际离场再交谈。';
}
export const ancientEvilEncounterReason = blockAncientEvilEncounter;
export function applyAncientEvilEncounterCommand(s: SliceState, c: AncientEvilEncounterCommand, ctx: SeerContext): void {
  const reason = blockAncientEvilEncounter(s, c); if (reason) throw new Error(reason); const e = s.ancientEvil.encounter;
  if (c.type === 'BUY_BLOCKS') {
    const before = fullBudget(s); s.cash -= 80;
    e.blockPurchase = { week: s.week, date: { ...s.date }, revision: s.revision + 1, cashBefore: before.cash, cashAfter: s.cash, paid: 80, ids: ANCIENT_EVIL_BLOCK_IDS, before, after: fullBudget(s), randomBefore: s.random.cursor, randomAfter: s.random.cursor }; e.blocksPurchased = true;
    e.blocks = ANCIENT_EVIL_BLOCK_IDS.map(id => ({ id, owner: 'PLAYER', status: 'READY', location: 'SOURCE', usedRound: null })); ctx.note('购买新的三块原木块', '实际支付80便士，取得唯一组三块原物；旧三块的花费、去向和状态原样保留。'); return;
  }
  if (c.type === 'PREPARE_ENCOUNTER') {
    const before = budget(s), fullBefore = fullBudget(s); s.mind -= 2; e.preparation = { week: s.week, date: { ...s.date }, fullBefore, fullAfter: fullBudget(s), revision: s.revision + 1, runId: s.runId, randomSeed: s.random.seed, randomCursor: s.random.cursor,
      mindPaid: 2, lifeJournalLength: s.ancientEvil.life.journal.length, lifeClockSeconds: s.silentDisciple.life.clockSeconds, before, after: budget(s) };
    e.originalEncounter = structuredClone(s.silentDisciple.encounter); ctx.note('整理注意力与普通出口', '实付2精神，核实同一埃尔莎、原衣物和包的归还及普通通路；没有恢复伤势、精神或灵性。'); return;
  }
  if (c.type === 'LEAVE_ENCOUNTER') { leaveAncientEvilCombatRoot(s.silentDisciple.life); e.status = 'RESOLVED'; ctx.note('和平离开原室', '你实际走4米、花4秒回入口；两位原同行者仍在室外，莱娜及其原杖留在原室。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') {
    e.startRoot = structuredClone(s.silentDisciple.life); e.clearance = clearance(s.week); s.silentDisciple.life = ancientEvilApproachedRoot(e.startRoot, s.week);
    e.status = 'READY'; e.approachWeek = s.week; e.approachRevision = s.revision + 1;
    ctx.note('请两位同行者离场后交谈', '你询问此次离场意愿，两人分别明确同意。埃尔莎穿原衣带原包，从A经入口走8米、花8秒到室外；哈伦从入口走4米、花4秒到室外。你再步行4米、花4秒到A，与2米外的莱娜交谈。'); return;
  }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'ANCIENT_EVIL_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  const source = currentAncientEvilCombatSource(s); if (!source) throw new Error('原身体、原物与现场来源不完整。'); e.startSource = { ...source, revision: s.revision + 1 };
  ctx.note('承担莱娜的真实冲突', '莱娜是独立织梦人，保有原身体、自己的手杖和有限心智能力；两位原同行者已实际离场，没有免费军队或友军免疫。');
}
export const applyAncientEvilEncounter = applyAncientEvilEncounterCommand;
export const handleAncientEvilEncounter = applyAncientEvilEncounterCommand;
export function startAncientEvilEncounter(s: SliceState, ctx: SeerContext): void { applyAncientEvilEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasAncientEvilDisputeOpponent(s: SliceState): boolean {
  const e = s.ancientEvil?.encounter, c = s.combat;
  return stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && lifeReady(s) && s.ancientEvil.guidanceKnown && s.ancientEvil.promotionWeek !== null &&
    !!e && e.status === 'FIGHTING' && e.targetId === ANCIENT_EVIL_TARGET_ID && e.terminal === null && actualCourt(s) && e.attemptWeek === s.week && validAncientEvilBody(e, s.silentDisciple.life.clockSeconds, c?.round ?? 0) &&
    c?.encounterId === 'ANCIENT_EVIL_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && e.enemyStatus === 'RESISTING' && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind &&
    same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk && integer(c.round, 1) && e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
function terminalRoot(o: AncientEvilRoundOutcome): { root: SilentDiscipleLifeState; body: AncientEvilCombatBody; wait: number; exit: 0 | 4 } {
  const r = createAncientEvilRuntime(o.source); r.root = structuredClone(o.rootAfter); r.body = combatBody(o);
  const wait = Math.max(0, (r.body.enemyFormUntilSeconds ?? 0) - r.root.clockSeconds, (r.body.formUntilSeconds ?? 0) - r.root.clockSeconds);
  advanceAncientEvilCombatClock(r, wait); const exit = o.playerHealthAfter > 0 ? 4 : 0; if (exit) leaveAncientEvilCombatRoot(r.root);
  return { root: r.root, body: r.body, wait, exit };
}
export function settleAncientEvilEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.ancientEvil.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'ANCIENT_EVIL_DISPUTE') throw new Error('没有这场实际原室冲突。'); if (outcome === 'CONTINUE') return;
  const last = c.lastRound, o = last?.ancientEvilOutcome;
  if (!last || !o || !validateAncientEvilRoundOutcome(o) || !validateAncientEvilCombatRound(last) || o.continuing || e.terminal || e.startHistoryIndex === null || c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round ||
    !same(s.combatHistory.at(-1), last) || !same(combatBody(e), combatBody(o)) || !same(o.rootAfter, s.silentDisciple.life) || o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality ||
    !same(o.playerInjuriesAfter, s.injuries) || o.playerRiskAfter !== s.injuryRisk || o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || !same(o.enemyInjuries, c.enemyInjuries) || o.enemyRisk !== c.enemyRisk || o.enemyStatus !== c.enemyStatus ||
    outcome !== (o.playerHealthAfter === 0 ? 'PLAYER_DEAD' : o.enemyHealth === 0 ? 'ENEMY_DEAD' : o.enemyStatus === 'SURRENDERED' ? 'ENEMY_SURRENDERED' : 'RETREATED')) throw new Error('结局与原回合、原身体、原物和真实资源不一致。');
  const final = terminalRoot(o); s.silentDisciple.life = final.root; Object.assign(e, final.body);
  e.terminal = { outcome: outcome as AncientEvilEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, formWaitSeconds: final.wait, exitMetres: final.exit, exitSeconds: final.exit };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('原室冲突结束', `实际再经过${final.wait}秒，当前剩余形态到期后同一身体复原，伤势不退。${final.exit ? '你沿原路走4米、花4秒回入口。' : '你的原身体真实死亡并留在A，不复活或搬移。'}莱娜的唯一原杖保留最后实际位置；没有自动拾取或资源回填。`);
}
export const finishAncientEvilEncounter = settleAncientEvilEncounter;
export function ancientEvilEncounterActions(s: SliceState): AncientEvilEncounterAction[] {
  if (!stage(s)) return [];
  return ([['BUY_BLOCKS', '购买新的三块原木块', '80便士；0行动'], ['PREPARE_ENCOUNTER', '整理注意力与出口', '2精神；0行动'], ['ENCOUNTER_TALK', '请两人离场后交谈', '1行动；实际步行16秒'],
    ['ENCOUNTER_FIGHT', '选择与莱娜交战', '1行动；真实受伤与死亡风险'], ['LEAVE_ENCOUNTER', '沿原路和平离开', '0行动；4米4秒']] as const).map(([type, label, cost]) => {
    const command: AncientEvilEncounterCommand = { type }, reason = blockAncientEvilEncounter(s, command); return { id: `ancientEvil-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectAncientEvilEncounter(s: SliceState): AncientEvilEncounterProjection {
  const e = s.ancientEvil.encounter, p = s.silentDisciple.life;
  if (!stage(s)) return { title: '尚未开放的通行争议', story: '', status: e.status, inside: false, preparation: null, scene: null, enemy: null, actions: [], facts: [] };
  return { title: '莱娜的通行争议', story: ANCIENT_EVIL_ENCOUNTER_STORY, status: e.status, inside: hasAncientEvilEncounterLock(s), preparation: e.preparation ? structuredClone(e.preparation) : null,
    scene: { courtId: 'SD3-QUIET-ROOM', playerLocation: p.playerLocation, elsaLocation: p.volunteer.location, guideLocation: p.guide.location, ordinaryExit: 'OPEN', distanceMetres: p.playerLocation === 'START' ? 6 : 2, clockSeconds: p.clockSeconds, playerTravelMetres: p.playerTravelMetres },
    enemy: { id: e.targetId, name: '莱娜', age: 45, pathway: 'audience', sequence: 3, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus,
      form: e.enemyForm, formRemainingSeconds: Math.max(0, (e.enemyFormUntilSeconds ?? p.clockSeconds) - p.clockSeconds), weaponId: 'AE2-LENA-STAFF', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses }, abilities: ANCIENT_EVIL_POWERS.map(x => x.label) }, actions: ancientEvilEncounterActions(s),
    facts: ['同一43岁埃尔莎恢复人形、穿原衣并拿回原包后，须与哈伦分别同意并实际走到室外；没有自动友军免疫。',
      '莱娜保有独立意志和当前愤怒情绪。变形须先实际接触建立联系，再付6灵性2精神，通过知识检定与她的独立抵抗。',
      '成功兔形持续真实90秒，跨回合保存。停止输入不提前复原；原杖落地且复原不自动拾取。兔形仍能进行精神梦刺与付费抵抗。',
      `新三块原木块${e.blocksPurchased ? '已实付80便士购入' : '尚未购买'}，剩余${e.blocks.filter(b => b.status === 'READY').length}块；旧卡尔德及旧三块状态原样保留。`,
      '诅咒引导主要用于生活中的有限解除。主动旧本人诅咒源默认关闭；自己的原身体须实际受伤才可能有限映射，不能返还健康或复活。'] };
}
export function replayAncientEvilEncounterRoot(s: SliceState, lifeEnd: SilentDiscipleLifeState): SilentDiscipleLifeState | null {
  try {
    const e = s.ancientEvil?.encounter, initial = createAncientEvilEncounterState(); if (!e || !shape(e, Object.keys(initial)) || e.targetId !== ANCIENT_EVIL_TARGET_ID || e.yardId !== 'SD3-QUIET-ROOM' || e.ordinaryExit !== 'OPEN' || e.enemyPosition !== 'BETWEEN_A_AND_B' || e.enemyDistanceMetres !== 2 || !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status)) return null;
    const allNew = s.combatHistory.flatMap((r, i) => r.ancientEvilOutcome ? [i] : []), baseState = createAncientEvilEncounterState();
    if (e.blockPurchase) {
      const p = e.blockPurchase; if (!shape(p, ['week', 'date', 'revision', 'cashBefore', 'cashAfter', 'paid', 'ids', 'before', 'after', 'randomBefore', 'randomAfter']) || !integer(p.week, s.ancientEvil.promotionWeek ?? 1, s.week) || !integer(p.revision, 1, s.revision) || !integer(p.cashBefore, 80) || p.cashAfter !== p.cashBefore - 80 || p.paid !== 80 || !same(p.ids, ANCIENT_EVIL_BLOCK_IDS) || !validDate(p.date, p.week) || compareGameDates(p.date, s.date) > 0 || !integer(p.randomBefore, 0, s.random.cursor) || p.randomAfter !== p.randomBefore || !validFullBudget(p.before) || !validFullBudget(p.after) || !same(p.after, { ...p.before, cash: p.before.cash - 80 }) || p.cashBefore !== p.before.cash || p.cashAfter !== p.after.cash) return null;
      baseState.blockPurchase = structuredClone(p); baseState.blocksPurchased = true; baseState.blocks = ANCIENT_EVIL_BLOCK_IDS.map(id => ({ id, owner: 'PLAYER', status: 'READY', location: 'SOURCE', usedRound: null }));
      if (s.revision === p.revision && (!same(fullBudget(s), p.after) || !same(s.date, p.date) || s.random.cursor !== p.randomAfter)) return null;
    }
    if (!e.preparation) return same(e, baseState) && allNew.length === 0 && s.combat?.encounterId !== 'ANCIENT_EVIL_DISPUTE' ? structuredClone(lifeEnd) : null;
    const prep = e.preparation;
    if (!stage(s) || !s.ancientEvil.guidanceKnown || s.ancientEvil.promotionWeek === null || !validateAncientEvilPreparation(prep) || prep.runId !== s.runId || prep.randomSeed !== s.random.seed || prep.randomCursor > s.random.cursor ||
      !integer(prep.week, s.ancientEvil.promotionWeek, s.week) || compareGameDates(prep.date, s.date) > 0 || !integer(prep.revision, 1, s.revision) || prep.lifeJournalLength !== s.ancientEvil.life.journal.length || prep.lifeClockSeconds !== lifeEnd.clockSeconds || !lifeReady(s) || !closedRoot(lifeEnd) ||
      !same(e.originalEncounter, s.silentDisciple.encounter) || e.originalEncounter?.enemyStatus !== 'SURRENDERED' || (e.blockPurchase !== null && (e.blockPurchase.revision >= prep.revision || e.blockPurchase.week > prep.week))) return null;
    if (e.blockPurchase && e.blockPurchase.revision + 1 === prep.revision && (!same(prep.fullBefore, e.blockPurchase.after) || prep.randomCursor !== e.blockPurchase.randomAfter)) return null;
    if (s.revision === prep.revision && (!same(fullBudget(s), prep.fullAfter) || !same(s.date, prep.date) || s.random.cursor !== prep.randomCursor)) return null;
    if (e.status === 'AVAILABLE') return same({ ...e, preparation: null, originalEncounter: null }, baseState) && allNew.length === 0 && s.combat?.encounterId !== 'ANCIENT_EVIL_DISPUTE' ? structuredClone(lifeEnd) : null;
    if (e.approachWeek === null || e.approachWeek < prep.week || !integer(e.approachRevision, prep.revision + 1, s.revision) || !same(e.startRoot, lifeEnd) || !same(e.clearance, clearance(e.approachWeek))) return null;
    const approached = ancientEvilApproachedRoot(lifeEnd, e.approachWeek), adjacent = e.approachRevision === prep.revision + 1 && e.approachWeek === prep.week;
    if (e.startHistoryIndex === null) {
      const ready = e.status === 'READY', peaceful = e.status === 'RESOLVED', root = structuredClone(approached); if (peaceful) leaveAncientEvilCombatRoot(root);
      return (ready || peaceful) && e.attemptWeek === null && e.startSource === null && e.terminal === null && allNew.length === 0 && s.combat?.encounterId !== 'ANCIENT_EVIL_DISPUTE' &&
        same({ ...e, status: 'AVAILABLE', preparation: null, originalEncounter: null, approachWeek: null, approachRevision: null, startRoot: null, clearance: null }, baseState) &&
        (!ready || e.approachWeek === s.week && s.status === 'ACTIVE') && (!ready || s.revision !== e.approachRevision || !adjacent || same(budget(s), { ...prep.after, actions: prep.after.actions - 1 }) && s.random.cursor === prep.randomCursor) ? root : null;
    }
    const start = e.startSource;
    if (!integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== e.approachWeek || !start || start.round !== 1 || !same(start.root, approached) || !same(start.preparation, prep) || start.runId !== s.runId || start.targetId !== e.targetId ||
      start.randomSeed !== s.random.seed || start.attemptWeek !== e.attemptWeek || start.startHistoryIndex !== e.startHistoryIndex || start.revision !== e.approachRevision + 1 || start.revision > s.revision || start.randomCursor < prep.randomCursor || !same(start.body, combatBody(baseState))) return null;
    if (adjacent && (start.playerHealth !== prep.after.health || start.playerMind !== prep.after.mind || start.playerSpirituality !== prep.after.spirituality || start.randomCursor !== prep.randomCursor || !same(start.playerInjuries, prep.fullAfter.injuries) || start.playerRisk !== prep.fullAfter.injuryRisk || !same({ physique: start.physique, perception: start.perception, will: start.will, knowledge: start.knowledge }, prep.fullAfter.coreStats) || start.objectMastery !== (prep.fullAfter.mastery['chained.s4.object-motion'] ?? 0) || start.bodyMastery !== (prep.fullAfter.mastery['chained.s6.steel-body'] ?? 0) || start.burstMastery !== (prep.fullAfter.mastery['chained.s8.reason-sacrifice'] ?? 0))) return null;
    const terminal = e.terminal;
    if (terminal && (!shape(terminal, ['outcome', 'round', 'historyIndex', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'formWaitSeconds', 'exitMetres', 'exitSeconds']) || !integer(terminal.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1))) return null;
    const end = terminal ? terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    if (!same(allNew, rounds.map((_r, i) => e.startHistoryIndex! + i))) return null;
    let root = approached;
    for (const [i, round] of rounds.entries()) {
      const o = round.ancientEvilOutcome, previous = rounds[i - 1]?.ancientEvilOutcome;
      if (!o || !validateAncientEvilRoundOutcome(o) || !validateAncientEvilCombatRound(round) || round.round !== i + 1 || o.source.revision >= s.revision || o.randomCursorAfter > s.random.cursor || !same(o.source, previous ? nextAncientEvilCombatSource(previous) : start) || !same(o.source.root, root) || i < rounds.length - 1 && !o.continuing) return null;
      root = structuredClone(o.rootAfter);
    }
    const last = rounds.at(-1), o = last?.ancientEvilOutcome;
    if (e.status === 'FIGHTING') {
      if (terminal !== null || !hasAncientEvilDisputeOpponent(s) || !same(combatBody(e), o ? combatBody(o) : start.body)) return null;
      return o ? o.continuing && same(last, s.combat!.lastRound) && same(currentAncientEvilCombatSource(s), nextAncientEvilCombatSource(o)) ? root : null : s.combat!.lastRound === null && same(currentAncientEvilCombatSource(s), start) ? root : null;
    }
    if (s.combat?.encounterId === 'ANCIENT_EVIL_DISPUTE' || !terminal || !last || !o || o.continuing || terminal.round !== last.round || rounds.length !== terminal.round || terminal.enemyHealth !== e.enemyHealth || terminal.enemyMind !== e.enemyMind || terminal.enemySpirituality !== e.enemySpirituality || terminal.enemyStatus !== e.enemyStatus) return null;
    const final = terminalRoot(o);
    if (!same(combatBody(e), final.body) || terminal.formWaitSeconds !== final.wait || terminal.exitMetres !== final.exit || terminal.exitSeconds !== final.exit) return null;
    if (terminal.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 ? final.root : null;
    if (terminal.outcome === 'RETREATED') return e.status === 'RETREATED' && o.playerHealthAfter > 0 && (last.retreat === 'SUCCESS' || o.playerMindAfter === 0) ? final.root : null;
    return e.status === 'RESOLVED' && o.playerHealthAfter > 0 && (terminal.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : terminal.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED') ? final.root : null;
  } catch { return null; }
}
export function validateAncientEvilEncounter(s: SliceState): boolean {
  try { const end = replayAncientEvilLifeRoot(s); if (!end) return same(s.ancientEvil.encounter, createAncientEvilEncounterState()) && s.ancientEvil.life.source === null && !s.combatHistory.some(r => r.ancientEvilOutcome) && s.combat?.encounterId !== 'ANCIENT_EVIL_DISPUTE';
    const root = replayAncientEvilEncounterRoot(s, end); return root !== null && same(root, s.silentDisciple.life);
  } catch { return false; }
}
export const validateAncientEvilEncounterState = validateAncientEvilEncounter;
