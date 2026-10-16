import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import type { BlathererLifeState } from '../blatherer/life.js';
import type { BlathererEncounterState } from '../blatherer/encounter.js';
import { bloodDukeLifeClosed, replayBloodDukeLifeRoot } from './life.js';
import { currentBloodDukeCombatSource, validateBloodDukeRoundOutcome, validateBloodDukeCombatRound, type BloodDukeCombatSource, type BloodDukeRoundOutcome } from './combat.js';

export const BLOOD_DUKE_TARGET_ID = 'BD2-GARETH' as const;
export const BLOOD_DUKE_POWER_IDS = ['SILVER_THRUST', 'SILVER_ARMOR'] as const;
export type BloodDukePowerId = typeof BLOOD_DUKE_POWER_IDS[number];
export type BloodDukeEnemyIntent = BloodDukePowerId | 'BODY_STRIKE' | 'STEADY_BREATH' | 'ACCIDENT';
/** An independently introduced Silver Knight uses his own learned methods and finite resources.
 * Existing warrior.s3.silver-thrust / silver-armor are the named skill sources; values are bounded adaptation. */
export const BLOOD_DUKE_POWERS = [
  { id: 'SILVER_THRUST', abilityId: 'warrior.s3.silver-thrust', label: '有限银白细剑', cost: 6, selfGain: 70, enemyReduction: 0 },
  { id: 'SILVER_ARMOR', abilityId: 'warrior.s3.silver-armor', label: '有限实体银甲', cost: 6, selfGain: 0, enemyReduction: 36 },
] as const;
interface PreparationBudget { cash: number; actions: number; health: number; mind: number; spirituality: number }
export interface BloodDukePreparation {
  week: number; revision: number; runId: string; randomSeed: string; randomCursor: number;
  mindPaid: 2; lifeJournalLength: number; lifeClockSeconds: number; before: PreparationBudget; after: PreparationBudget;
}
export interface BloodDukeClearance { week: number; noraId: 'BL3-NORA'; noraConsent: 'GRANTED'; noraFrom: 'A'; noraTo: 'OUTSIDE'; noraMetres: 8; noraSeconds: 8; noraRoute: ['A', 'START', 'OUTSIDE']; cardId: 'BL3-CARD'; playerMetres: 4; elapsedSeconds: 12 }
export interface BloodDukeEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; exitMetres: 0 | 4; exitSeconds: 0 | 4;
}
export interface BloodDukeEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof BLOOD_DUKE_TARGET_ID;
  preparation: BloodDukePreparation | null; approachWeek: number | null; approachRevision: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  startRoot: BlathererLifeState | null; startSource: BloodDukeCombatSource | null; originalEncounter: BlathererEncounterState | null; clearance: BloodDukeClearance | null;
  yardId: 'BL3-QUIET-ROOM'; skyLight: 'DAYLIGHT'; ordinaryExit: 'OPEN'; enemyPosition: 'BETWEEN_A_AND_B'; enemyDistanceMetres: 2;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  weaponLocation: 'HAND' | 'COURT'; enemyInjuries: SliceInjury[]; enemyRisk: number; emotion: 'ANGRY' | 'CALM'; breathUses: number; powerUses: Record<BloodDukePowerId, number>; terminal: BloodDukeEncounterTerminal | null;
}
export type BloodDukeEncounterCommand = { type: 'PREPARE_ENCOUNTER' | 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface BloodDukeEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: BloodDukeEncounterCommand }
export interface BloodDukeEncounterProjection {
  title: string; story: string; status: BloodDukeEncounterState['status']; inside: boolean; preparation: BloodDukePreparation | null;
  scene: null | { courtId: 'BL3-QUIET-ROOM'; playerLocation: string; noraLocation: string; ordinaryExit: 'OPEN'; distanceMetres: number; clockSeconds: number; playerTravelMetres: number };
  enemy: null | { id: typeof BLOOD_DUKE_TARGET_ID; name: '加雷斯·莫尔'; age: 44; pathway: 'warrior'; sequence: 3; health: number; mind: number; spirituality: number;
    status: BloodDukeEncounterState['enemyStatus']; weaponId: 'BD2-GARETH-SWORD'; weaponLocation: 'HAND' | 'COURT'; powerUses: Record<BloodDukePowerId, number>; abilities: string[] };
  actions: BloodDukeEncounterAction[]; facts: string[];
}
export const BLOOD_DUKE_ENCOUNTER_STORY = '44岁的银骑士加雷斯·莫尔来到原安静室，为通行安排发生争执。他因自己的要求未被接受而明显愤怒，仍有独立判断、自己的钢剑、有限灵性与实际银甲。诺拉必须先明确同意并亲自带原卡走到室外，才可交谈或交战。交谈后仍可和平离开；战斗可能受伤或死亡，并非晋升条件。';
export function createBloodDukeEncounterState(): BloodDukeEncounterState {
  return { status: 'AVAILABLE', targetId: BLOOD_DUKE_TARGET_ID, preparation: null, approachWeek: null, approachRevision: null, attemptWeek: null, startHistoryIndex: null,
    startRoot: null, startSource: null, originalEncounter: null, clearance: null, yardId: 'BL3-QUIET-ROOM', skyLight: 'DAYLIGHT', ordinaryExit: 'OPEN', enemyPosition: 'BETWEEN_A_AND_B', enemyDistanceMetres: 2,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyInjuries: [], enemyRisk: 0, emotion: 'ANGRY', breathUses: 0,
    powerUses: { SILVER_THRUST: 0, SILVER_ARMOR: 0 }, terminal: null };
}
const stage = (s: SliceState) => s.progression.pathwayId === 'abyss' && s.progression.sequence === 2;
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
export function validateBloodDukeEncounterCommand(v: unknown): v is BloodDukeEncounterCommand {
  return shape(v, ['type']) && ['PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type));
}
export const isBloodDukeEncounterCommand = validateBloodDukeEncounterCommand;
export const hasBloodDukeEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.bloodDuke.encounter.status);
export const isInsideBloodDukeEncounter = hasBloodDukeEncounterLock;
function otherSceneOpen(s: SliceState): boolean {
  const root = s.bloodDuke.encounter.startRoot ?? s.blatherer.life;
  const shadow = { ...s, blatherer: { ...s.blatherer, life: root } };
  return s.bloodDuke.preparedWeek !== null || !bloodDukeLifeClosed(shadow) || !s.bloodDuke.life.reflected;
}
function closedRoot(p: BlathererLifeState): boolean {
  return p.siteId === 'BL3-QUIET-ROOM' && p.introducedWeek !== null && p.playerLocation === 'START' && p.volunteer.id === 'BL3-NORA' && p.volunteer.age === 46 && p.volunteer.alive && p.volunteer.willing && p.volunteer.location === 'A' &&
    p.card.location === 'NORA' && p.guide.location === 'OUTSIDE' && p.activeCase === null && Object.values(p.cases).every(c => c.status === 'RESOLVED' && !c.contactOpen);
}
const clearance = (week: number): BloodDukeClearance => ({ week, noraId: 'BL3-NORA', noraConsent: 'GRANTED', noraFrom: 'A', noraTo: 'OUTSIDE', noraMetres: 8, noraSeconds: 8, noraRoute: ['A', 'START', 'OUTSIDE'], cardId: 'BL3-CARD', playerMetres: 4, elapsedSeconds: 12 });
export function bloodDukeApproachedRoot(start: BlathererLifeState, week: number): BlathererLifeState {
  if (!closedRoot(start) || !integer(week, 1) || start.introducedWeek! > week) throw new Error('须先收口原室并征得同一诺拉此次离场同意。');
  const p = structuredClone(start); p.volunteer.location = 'OUTSIDE'; p.card.travelMetres += 8; p.clockSeconds += 8;
  p.playerLocation = 'A'; p.playerTravelMetres += 4; p.clockSeconds += 4; return p;
}
export function leaveBloodDukeCombatRoot(p: BlathererLifeState): void {
  if (p.playerLocation !== 'A' || p.volunteer.location !== 'OUTSIDE') throw new Error('须本人在原室且诺拉已离场，才能沿普通出口离开。');
  p.playerLocation = 'START'; p.playerTravelMetres += 4; p.clockSeconds += 4;
}
const budget = (s: SliceState): PreparationBudget => ({ cash: s.cash, actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality });
export function validateBloodDukePreparation(value: unknown): value is BloodDukePreparation {
  try { const p = value as BloodDukePreparation;
    if (!shape(p, ['week', 'revision', 'runId', 'randomSeed', 'randomCursor', 'mindPaid', 'lifeJournalLength', 'lifeClockSeconds', 'before', 'after']) ||
      !integer(p.week, 1) || !integer(p.revision, 1) || typeof p.runId !== 'string' || !p.runId || typeof p.randomSeed !== 'string' || !p.randomSeed || !integer(p.randomCursor) ||
      p.mindPaid !== 2 || !integer(p.lifeJournalLength, 1) || !integer(p.lifeClockSeconds)) return false;
    for (const b of [p.before, p.after]) if (!shape(b, ['cash', 'actions', 'health', 'mind', 'spirituality']) || !integer(b.cash) || !integer(b.actions, 0, 100) || !integer(b.health, 1, 100) || !integer(b.mind, 1, 100) || !integer(b.spirituality, 0, 120)) return false;
    return p.before.mind > 2 && same(p.after, { ...p.before, mind: p.before.mind - 2 });
  } catch { return false; }
}
function actualCourt(s: SliceState): boolean {
  const e = s.bloodDuke.encounter, p = s.blatherer.life;
  return e.yardId === 'BL3-QUIET-ROOM' && e.skyLight === 'DAYLIGHT' && e.ordinaryExit === 'OPEN' && e.enemyPosition === 'BETWEEN_A_AND_B' && e.enemyDistanceMetres === 2 && !!e.startRoot && closedRoot(e.startRoot) && !!e.preparation && e.approachWeek === s.week && same(e.clearance, clearance(s.week)) && p.siteId === 'BL3-QUIET-ROOM' && p.playerLocation === 'A' &&
    p.volunteer.id === 'BL3-NORA' && p.volunteer.age === 46 && p.volunteer.alive && p.volunteer.willing && p.volunteer.location === 'OUTSIDE' && p.card.location === 'NORA' && p.guide.location === 'OUTSIDE' && p.activeCase === null && same(e.originalEncounter, s.blatherer.encounter);
}
export function blockBloodDukeEncounter(s: SliceState, c: BloodDukeEncounterCommand): string | null {
  if (!validateBloodDukeEncounterCommand(c)) return '遭遇命令无效。'; const e = s.bloodDuke.encounter;
  if (s.status !== 'ACTIVE' || !stage(s) || s.health <= 0) return '须本人仍活着并完成本次晋升。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (!s.bloodDuke.guidanceKnown || s.bloodDuke.promotionWeek === null) return '须已经获得指导并完成本次晋升。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德。';
  if (otherSceneOpen(s)) return '先收尾三次实践、原卡与现场并完成反思。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' && actualCourt(s) ? null : '先实际到场交谈，才能沿普通出口离开。';
  if (s.mind <= 0) return '先恢复精神；交谈后仍可普通离开。';
  if (c.type === 'PREPARE_ENCOUNTER') {
    if (e.status !== 'AVAILABLE' || e.preparation) return '这次准备已有记录，不能重置原对手。';
    const end = replayBloodDukeLifeRoot(s); if (!end || !same(end, s.blatherer.life) || !closedRoot(end)) return '先收口原室，确认本人、诺拉和同一原卡的实际位置。';
    return s.mind <= 2 ? '整理注意力须付2精神并保持清醒。' : null;
  }
  if (s.actionsRemaining < 1) return '这次选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') {
    if (e.status !== 'AVAILABLE' || !e.preparation) return '先整理注意力；已有结局的对手不会重新生成。';
    if (!closedRoot(s.blatherer.life)) return '须让本人回到入口，确认诺拉在A、原卡在她本人手中。';
    return s.actionsRemaining < 2 ? '交谈需要1行动，另留1行动决定是否交战；到场后也可和平离开。' : null;
  }
  return e.status === 'READY' && actualCourt(s) ? null : '先实际交谈，并让诺拉按此次同意亲自离场。';
}
export const bloodDukeEncounterReason = blockBloodDukeEncounter;
export function applyBloodDukeEncounterCommand(s: SliceState, c: BloodDukeEncounterCommand, ctx: SeerContext): void {
  const reason = blockBloodDukeEncounter(s, c); if (reason) throw new Error(reason); const e = s.bloodDuke.encounter;
  if (c.type === 'PREPARE_ENCOUNTER') {
    const before = budget(s); s.mind -= 2;
    e.preparation = { week: s.week, revision: s.revision + 1, runId: s.runId, randomSeed: s.random.seed, randomCursor: s.random.cursor, mindPaid: 2,
      lifeJournalLength: s.bloodDuke.life.journal.length, lifeClockSeconds: s.blatherer.life.clockSeconds, before, after: budget(s) };
    e.originalEncounter = structuredClone(s.blatherer.encounter);
    ctx.note('整理注意力并核对出口', '你实际付2精神，核对同一原卡与普通出口；没有补充灵性、储备或旧恶魔负荷。'); return;
  }
  if (c.type === 'LEAVE_ENCOUNTER') { leaveBloodDukeCombatRoot(s.blatherer.life); e.status = 'RESOLVED'; ctx.note('和平离开原室', '本人沿原路走4米、花4秒回到入口；同一诺拉仍在室外，加雷斯与自己的钢剑留在室内。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') {
    e.startRoot = structuredClone(s.blatherer.life); e.clearance = clearance(s.week); s.blatherer.life = bloodDukeApproachedRoot(e.startRoot, s.week);
    e.status = 'READY'; e.approachWeek = s.week; e.approachRevision = s.revision + 1;
    ctx.note('让诺拉离场后交谈', '同一46岁诺拉明确同意这次离场，亲自从A走8米、花8秒到室外，并带走自己的原卡。你再步行4米、花4秒到原室A点，加雷斯在A与B之间，距你2米。尚未交战，可以普通离开。'); return;
  }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'BLOOD_DUKE_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  const source = currentBloodDukeCombatSource(s); if (!source) throw new Error('人物位置或资源记录不完整，无法开战。'); e.startSource = { ...source, revision: s.revision + 1 };
  ctx.note('选择独立的室内交战', '加雷斯使用自己的原钢剑、实际银骑士方法和有限灵性。诺拉已实际在室外，保护只作用本人。埃德里克仍保留此前身体、武器和遭遇结局；本次交战不属于晋升条件。');
}
export const applyBloodDukeEncounter = applyBloodDukeEncounterCommand;
export const handleBloodDukeEncounter = applyBloodDukeEncounterCommand;
export function startBloodDukeEncounter(s: SliceState, ctx: SeerContext): void { applyBloodDukeEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasBloodDukeDisputeOpponent(s: SliceState): boolean {
  const e = s.bloodDuke?.encounter, c = s.combat;
  return stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !otherSceneOpen(s) &&
    s.bloodDuke.guidanceKnown && s.bloodDuke.promotionWeek !== null && !!e && e.status === 'FIGHTING' && e.targetId === BLOOD_DUKE_TARGET_ID && e.terminal === null &&
    e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' && actualCourt(s) && e.attemptWeek === s.week &&
    c?.encounterId === 'BLOOD_DUKE_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind &&
    same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk && integer(e.enemySpirituality, 0, 120) && BLOOD_DUKE_POWER_IDS.every(id => integer(e.powerUses[id])) &&
    integer(e.breathUses) && e.emotion === (e.breathUses > 0 ? 'CALM' : 'ANGRY') && e.enemySpirituality === 120 - BLOOD_DUKE_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) && integer(c.round, 1) && e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleBloodDukeEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.bloodDuke.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'BLOOD_DUKE_DISPUTE') throw new Error('当前没有这场原室战斗。'); if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知战斗结果。');
  const last = c.lastRound, o = last?.bloodDukeOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateBloodDukeRoundOutcome(o) || !validateBloodDukeCombatRound(last) || o.continuing || c.round !== last.round + 1 ||
    s.combatHistory.length - e.startHistoryIndex !== last.round || !same(s.combatHistory.at(-1), last) || !same(o.rootAfter, s.blatherer.life) || o.playerStrainAfter !== s.demon.strain ||
    o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !same(o.powerUses, e.powerUses) || !same(o.enemyInjuriesAfter, c.enemyInjuries) || o.enemyRiskAfter !== c.enemyRisk || o.emotionAfter !== e.emotion || o.breathUses !== e.breathUses ||
    !same(o.playerInjuriesAfter, s.injuries) || o.playerRiskAfter !== s.injuryRisk || o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality ||
    (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS')) || (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
    (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER')) || (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER')))
    throw new Error('原室、身体、旧负荷或战斗后果不符。');
  const exit = s.health > 0 ? 4 : 0; if (exit) leaveBloodDukeCombatRoot(s.blatherer.life);
  e.terminal = { outcome: outcome as BloodDukeEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, exitMetres: exit, exitSeconds: exit };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('原室冲突结束', `${outcome === 'PLAYER_DEAD' ? '本人身体实际死亡，原身体与所持物留在A点。' : '本人沿原路走4米、花4秒回到入口。'}诺拉仍在室外；加雷斯与自己的钢剑留在室内，所有费用、灵性、旧恶魔负荷和双方伤势保留。`);
}
export const finishBloodDukeEncounter = settleBloodDukeEncounter;
export function bloodDukeEncounterActions(s: SliceState): BloodDukeEncounterAction[] {
  if (!stage(s)) return [];
  return ([['PREPARE_ENCOUNTER', '整理注意力与出口', '2精神；0行动'], ['ENCOUNTER_TALK', '让诺拉离场后交谈', '1行动；诺拉8米/8秒，本人4米/4秒'],
    ['ENCOUNTER_FIGHT', '选择与加雷斯交战', '1行动；可能受伤或死亡'], ['LEAVE_ENCOUNTER', '沿原路和平离开', '0行动；4米/4秒']] as const).map(([type, label, cost]) => {
    const command: BloodDukeEncounterCommand = { type }, reason = blockBloodDukeEncounter(s, command); return { id: `bloodDuke-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectBloodDukeEncounter(s: SliceState): BloodDukeEncounterProjection {
  const e = s.bloodDuke.encounter, root = s.blatherer.life;
  if (!stage(s)) return { title: '尚未开放的通行争议', story: '', status: e.status, inside: false, scene: null, preparation: null, enemy: null, actions: [], facts: [] };
  return { title: '加雷斯的通行争议', story: BLOOD_DUKE_ENCOUNTER_STORY, status: e.status, inside: hasBloodDukeEncounterLock(s), preparation: e.preparation ? structuredClone(e.preparation) : null,
    scene: { courtId: 'BL3-QUIET-ROOM', playerLocation: root.playerLocation, noraLocation: root.volunteer.location, ordinaryExit: 'OPEN', distanceMetres: root.playerLocation === 'START' ? 6 : 2, clockSeconds: root.clockSeconds, playerTravelMetres: root.playerTravelMetres },
    enemy: { id: e.targetId, name: '加雷斯·莫尔', age: 44, pathway: 'warrior', sequence: 3, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality,
      status: e.enemyStatus, weaponId: 'BD2-GARETH-SWORD', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses }, abilities: BLOOD_DUKE_POWERS.map(p => p.label) }, actions: bloodDukeEncounterActions(s),
    facts: [root.volunteer.location === 'OUTSIDE' && e.clearance ? '诺拉是此前同一位46岁成年人，已经亲自带原卡走8米到室外。' : '诺拉仍是此前同一位46岁成年人；交谈前须由她亲自带原卡走8米到室外，不能靠友军免疫避开影响。',
      `加雷斯当前${e.emotion === 'ANGRY' ? '明显愤怒' : '已经通过自己的呼吸平复情绪'}，可拒绝或抵抗干扰。集中呼吸会清除尚未生效的干扰。`,
      '自我约束付6灵性、2精神，约束面对持剑威胁时急于前冲的动作，保持防守节奏；只使随后一次实际身体攻势减弱至多30；尚未受击时没有实际减势。',
      '情绪干扰付6灵性、2精神，仅对当前强烈情绪尝试，检定和抵抗都可能失败；成功也只影响随后一次真实攻势至多25。',
      '每轮双方1至6动作。银甲、自我约束和干扰都有有限窗口，不会吸血、复活或支配血液。',
      '埃德里克的原身体、武器和此前遭遇状态保持原样；此前伤势、恶魔负荷与道德后果保留。'] };
}

function nextSource(o: BloodDukeRoundOutcome): BloodDukeCombatSource {
  return { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, clockSeconds: o.clockSecondsAfter, root: structuredClone(o.rootAfter), strain: o.playerStrainAfter, emotion: o.emotionAfter, breathUses: o.breathUses,
    playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter, playerSpirituality: Math.min(120, o.playerSpiritualityAfter + 12), enemyHealth: o.enemyHealth, enemyMind: o.enemyMind, enemySpirituality: o.enemySpirituality,
    playerInjuries: structuredClone(o.playerInjuriesAfter), enemyInjuries: structuredClone(o.enemyInjuriesAfter), playerRisk: o.playerRiskAfter, enemyRisk: o.enemyRiskAfter, powerUses: { ...o.powerUses }, randomCursor: o.randomCursorAfter };
}
/** Derive the sole live original court from the exact life-end root and ordered combat replay.
 * This helper never calls the old S3 validator, avoiding recursive or permissive continuation. */
export function replayBloodDukeEncounterRoot(s: SliceState, lifeEnd: BlathererLifeState): BlathererLifeState | null {
  try {
    const e = s.bloodDuke?.encounter, initial = createBloodDukeEncounterState();
    if (!e || !shape(e, Object.keys(initial)) || e.targetId !== BLOOD_DUKE_TARGET_ID || e.yardId !== 'BL3-QUIET-ROOM' || e.skyLight !== 'DAYLIGHT' || e.ordinaryExit !== 'OPEN' || e.enemyPosition !== 'BETWEEN_A_AND_B' || e.enemyDistanceMetres !== 2 ||
      !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || !integer(e.enemyHealth, 0, 100) || e.enemyMind !== 100 || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) || !integer(e.breathUses) || e.emotion !== (e.breathUses > 0 ? 'CALM' : 'ANGRY') || !Array.isArray(e.enemyInjuries) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) || e.weaponLocation !== (e.enemyStatus === 'RESISTING' ? 'HAND' : 'COURT') ||
      !shape(e.powerUses, BLOOD_DUKE_POWER_IDS) || !BLOOD_DUKE_POWER_IDS.every(id => integer(e.powerUses[id])) || e.enemySpirituality !== 120 - BLOOD_DUKE_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) || [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, 1, s.week))) return null;
    const allNew = s.combatHistory.flatMap((r, i) => r.bloodDukeOutcome ? [i] : []);
    if (!e.preparation) return same(e, initial) && allNew.length === 0 && s.combat?.encounterId !== 'BLOOD_DUKE_DISPUTE' ? structuredClone(lifeEnd) : null;
    const prep = e.preparation;
    if (!stage(s) || !s.bloodDuke.guidanceKnown || s.bloodDuke.promotionWeek === null || !validateBloodDukePreparation(prep) || prep.runId !== s.runId || prep.randomSeed !== s.random.seed || prep.randomCursor > s.random.cursor ||
      !integer(prep.week, s.bloodDuke.promotionWeek, s.week) || !integer(prep.revision, 1, s.revision) || prep.lifeJournalLength !== s.bloodDuke.life.journal.length || prep.lifeClockSeconds !== lifeEnd.clockSeconds || otherSceneOpen(s) || !same(e.originalEncounter, s.blatherer.encounter)) return null;
    if (e.status === 'AVAILABLE') return same({ ...e, preparation: null, originalEncounter: null }, initial) && closedRoot(lifeEnd) && allNew.length === 0 && s.combat?.encounterId !== 'BLOOD_DUKE_DISPUTE' ? structuredClone(lifeEnd) : null;
    if (e.approachWeek === null || e.approachWeek < prep.week || !integer(e.approachRevision, prep.revision + 1, s.revision) || !e.startRoot || !closedRoot(e.startRoot) || !same(e.startRoot, lifeEnd) || !same(e.clearance, clearance(e.approachWeek))) return null;
    const approached = bloodDukeApproachedRoot(e.startRoot, e.approachWeek);
    const adjacentApproach = e.approachRevision === prep.revision + 1 && e.approachWeek === prep.week;
    if (e.status === 'READY' && s.revision === e.approachRevision && adjacentApproach &&
      (!same(budget(s), { ...prep.after, actions: prep.after.actions - 1 }) || s.random.cursor !== prep.randomCursor)) return null;
    if (e.startHistoryIndex === null) {
      const ready = e.status === 'READY', peaceful = e.status === 'RESOLVED', expected = structuredClone(approached); if (peaceful) leaveBloodDukeCombatRoot(expected);
      return (ready || peaceful) && e.attemptWeek === null && e.startSource === null && e.terminal === null && allNew.length === 0 &&
        same({ ...e, status: initial.status, preparation: null, originalEncounter: null, approachWeek: null, approachRevision: null, startRoot: null, clearance: null }, initial) && s.combat?.encounterId !== 'BLOOD_DUKE_DISPUTE' && (!ready || s.status === 'ACTIVE' && !otherSceneOpen(s) && e.approachWeek === s.week) ? expected : null;
    }
    if (!integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek === null || e.attemptWeek !== e.approachWeek || !e.startSource || e.startSource.round !== 1 || !same(e.startSource.root, approached) || !same(e.startSource.preparation, prep) ||
      e.startSource.runId !== s.runId || e.startSource.targetId !== e.targetId || e.startSource.randomSeed !== s.random.seed || e.startSource.attemptWeek !== e.attemptWeek || e.startSource.startHistoryIndex !== e.startHistoryIndex || e.startSource.revision <= e.approachRevision || e.startSource.revision > s.revision || e.startSource.randomCursor < prep.randomCursor) return null;
    if (e.startSource.revision !== e.approachRevision + 1) return null;
    if (adjacentApproach && (e.startSource.playerHealth !== prep.after.health || e.startSource.playerMind !== prep.after.mind || e.startSource.playerSpirituality !== prep.after.spirituality || e.startSource.randomCursor !== prep.randomCursor)) return null;
    if (e.status === 'FIGHTING' && s.revision === e.startSource.revision && adjacentApproach &&
      (!same(budget(s), { ...prep.after, actions: prep.after.actions - 2 }) || s.random.cursor !== prep.randomCursor)) return null;
    if (e.terminal && (!shape(e.terminal, ['outcome', 'round', 'historyIndex', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'exitMetres', 'exitSeconds']) || !integer(e.terminal.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1))) return null;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    if (!same(allNew, rounds.map((_r, i) => e.startHistoryIndex! + i))) return null;
    let expected = structuredClone(approached);
    for (const [i, round] of rounds.entries()) {
      const o = round.bloodDukeOutcome, previous = rounds[i - 1]?.bloodDukeOutcome;
      if (!validateBloodDukeRoundOutcome(o) || !validateBloodDukeCombatRound(round) || round.round !== i + 1 || o.source.runId !== s.runId || o.source.targetId !== e.targetId || o.source.randomSeed !== s.random.seed ||
        o.source.revision >= s.revision || o.randomCursorAfter > s.random.cursor || o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek || !same(o.source.root, expected) || !same(o.source.preparation, prep) || (i < rounds.length - 1 && !o.continuing)) return null;
      if (previous ? !same(o.source, nextSource(previous)) : !same(o.source, e.startSource) || o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.source.enemySpirituality !== 120 || o.source.enemyRisk !== 0 || o.source.emotion !== 'ANGRY' || o.source.breathUses !== 0 || o.source.enemyInjuries.length !== 0 || !same(o.source.powerUses, initial.powerUses)) return null;
      expected = structuredClone(o.rootAfter);
    }
    const last = rounds.at(-1), o = last?.bloodDukeOutcome;
    if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemySpirituality !== e.enemySpirituality || o.enemyStatus !== e.enemyStatus || !same(o.powerUses, e.powerUses) || !same(o.enemyInjuriesAfter, e.enemyInjuries) || o.enemyRiskAfter !== e.enemyRisk || o.emotionAfter !== e.emotion || o.breathUses !== e.breathUses)) return null;
    if (e.status === 'FIGHTING') {
      if (e.terminal !== null || !hasBloodDukeDisputeOpponent(s)) return null;
      if (!o) return s.combat!.lastRound === null && same(currentBloodDukeCombatSource(s), e.startSource) && same(e.powerUses, initial.powerUses) && e.enemyHealth === 100 && e.enemySpirituality === 120 && e.enemyRisk === 0 && e.enemyInjuries.length === 0 ? expected : null;
      return o.continuing && same(last, s.combat!.lastRound) && same(currentBloodDukeCombatSource(s), nextSource(o)) ? expected : null;
    }
    const t = e.terminal;
    if (s.combat?.encounterId === 'BLOOD_DUKE_DISPUTE' || !t || !last || !o || o.continuing || t.round !== last.round || rounds.length !== t.round || t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return null;
    const exit = o.playerHealthAfter > 0 ? 4 : 0;
    if (t.exitMetres !== exit || t.exitSeconds !== exit) return null; if (exit) leaveBloodDukeCombatRoot(expected);
    if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY' && o.playerHealthAfter > 0 ? expected : null;
    if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY' ? expected : null;
    return e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' && (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : t.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED') ? expected : null;
  } catch { return null; }
}
export function validateBloodDukeEncounter(s: SliceState): boolean {
  try {
    const end = replayBloodDukeLifeRoot(s);
    if (!end) return same(s.bloodDuke.encounter, createBloodDukeEncounterState()) && s.bloodDuke.life.source === null && !s.combatHistory.some(r => r.bloodDukeOutcome) && s.combat?.encounterId !== 'BLOOD_DUKE_DISPUTE';
    const expected = replayBloodDukeEncounterRoot(s, end); return expected !== null && same(expected, s.blatherer.life);
  } catch { return false; }
}
export const validateBloodDukeEncounterState = validateBloodDukeEncounter;
