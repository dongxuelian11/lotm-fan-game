import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicGameDate, PublicCheckResult } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { ATTENDANT_MYSTERIES_INHERITED_ABILITY_IDS } from './index.js';
import { ATTENDANT_MYSTERIES_ABILITY_IDS } from './types.js';
import { addGameWeeks, isValidGameDate } from '../game-calendar.js';
import { MIRACLE_WORKER_COUNT_WHEEL, miracleWorkerActionCount, miracleWorkerWinChance } from '../miracle-worker/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { ATTENDANT_MYSTERIES_TARGET_ID, ATTENDANT_MYSTERIES_SITE, ATTENDANT_MYSTERIES_POWER_IDS, ATTENDANT_MYSTERIES_POWERS, combatBody,
  hasAttendantMysteriesDisputeOpponent, validateAttendantMysteriesPreparation, validAttendantMysteriesRemnant, validAttendantMysteriesScene,
  type AttendantMysteriesCombatBody, type AttendantMysteriesEnemyIntent, type AttendantMysteriesPreparation, type AttendantMysteriesRemnant, type AttendantMysteriesScene } from './encounter.js';

export const ATTENDANT_MYSTERIES_COUNT_WHEEL = MIRACLE_WORKER_COUNT_WHEEL;
export const ATTENDANT_MYSTERIES_ENEMY_COUNT_WHEEL = MIRACLE_WORKER_COUNT_WHEEL;
export const attendantMysteriesActionCount = miracleWorkerActionCount;
export const attendantMysteriesEnemyActionCount = miracleWorkerActionCount;
export const THREAD_REGENERATION = 'diviner.s1.thread-regeneration', BOUNDED_GRAFTING = 'diviner.s1.bounded-grafting', MYSTERIOUS_REALM = 'diviner.s1.mysterious-realm';
export const BODY = 'STRIKE', BODY_CONTROL = 'diviner.s8.body-control', BALANCE = 'diviner.s8.balance', AIR_BULLET = 'diviner.s7.air-bullet', ILLUSION = 'diviner.s7.illusion';
export const PAST_SELF = 'diviner.s3.borrow-past', PROBABILITY = 'diviner.s2.probability';
export type AttendantMysteriesMoveId = typeof BODY | typeof BODY_CONTROL | typeof BALANCE | typeof AIR_BULLET | typeof ILLUSION | typeof PAST_SELF | typeof PROBABILITY | typeof THREAD_REGENERATION | typeof BOUNDED_GRAFTING | typeof MYSTERIOUS_REALM | 'ACCIDENT';
const ABILITIES: readonly { id: AttendantMysteriesMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: BODY, label: '本人普通打击：12×身体，0灵性', weight: 12, stance: 'ATTACK' },
  { id: BODY_CONTROL, label: '继承身体控制：30×身体，0灵性', weight: 8, stance: 'ATTACK' },
  { id: AIR_BULLET, label: '继承空气弹：2灵性、贡献60', weight: 10, stance: 'ATTACK' },
  { id: BALANCE, label: '继承平衡：减势28，0灵性', weight: 8, stance: 'DEFEND' },
  { id: ILLUSION, label: '继承有限幻术：2灵性、减势16', weight: 6, stance: 'DEFEND' },
  { id: PAST_SELF, label: '继承过去借力：真实本人样本、1当下灵性、知识14，仅一次旧空气弹', weight: 8, stance: 'ATTACK' },
  { id: PROBABILITY, label: '继承有限概率：5灵性1精神，每轮一次胜率加5百分点、上限95%', weight: 6, stance: 'CONTROL' },
  { id: THREAD_REGENERATION, label: '灵体线再生：6灵性1精神、知识18、真实原残料1段；只作有限身体贡献', weight: 15, stance: 'ATTACK' },
  { id: BOUNDED_GRAFTING, label: '有限嫁接：6灵性2精神、知识20；随后一次已映射身体或银弧最多减45', weight: 15, stance: 'DEFEND' },
  { id: MYSTERIOUS_REALM, label: '诡秘之境：8灵性2精神；同一空地30秒内后续两次可见身体或银弧×0.8', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '实际动作偏差：固定−22.5，0灵性', weight: 2, stance: null },
];
export const ATTENDANT_MYSTERIES_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '有限银弧：6灵性，85身体攻击贡献', weight: 30 },
  { id: 'WARD', label: '有限屏护：5灵性，敌方−50', weight: 20 },
  { id: 'BODY_STRIKE', label: '本人原杖打击：22×身体，0灵性', weight: 25 },
  { id: 'COMPOSE', label: '自主凝神：4灵性、感知20；成功才辨认并抵消一项当前局部隐蔽或嫁接', weight: 10 },
  { id: 'MENTAL_PRESSURE', label: '有限精神施压：5灵性，45精神贡献；不掷身体伤势盘', weight: 10 },
  { id: 'ACCIDENT', label: '实际偏差：−22.5，0灵性', weight: 5 },
];
export const isAttendantMysteries = (s: SliceState) => s.progression.pathwayId === 'diviner' && s.progression.sequence === 1;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (a.stance === stance && stance !== null ? 5 : 4));
export function attendantMysteriesAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const w = tickets(stance), total = w.reduce((a, b) => a + b, 0); return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: w[i]! / total * 100 }));
}
export function drawAttendantMysteriesAbility(random: ActionRandomStream, _s: SliceState | null, stance: SliceStance | null): AttendantMysteriesMoveId {
  const w = tickets(stance); let n = random.nextInt(1, w.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= w[i]!; if (n <= 0) return a.id; } throw new Error('行动盘无效。');
}
export function drawAttendantMysteriesEnemyAbility(random: ActionRandomStream): AttendantMysteriesEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of ATTENDANT_MYSTERIES_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as AttendantMysteriesEnemyIntent; } throw new Error('对手行动盘无效。');
}
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
const physicalAt = (n: number) => n > 75 ? 1 : n > 50 ? .95 : n > 25 ? .9 : .8;
export interface AttendantMysteriesCombatSource {
  runId: string; revision: number; week: number; date: PublicGameDate; round: number; encounterId: 'ATTENDANT_MYSTERIES_DISPUTE'; targetId: typeof ATTENDANT_MYSTERIES_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetName: '埃利亚斯·维尔'; targetAge: 47; targetPathway: 'original-caster'; targetSequence: 2; targetCore: 22; targetPerception: 28;
  actualBody: true; independentMind: true; playerBodyId: string; enemyWeapon: 'AM1-ELIAS-ROD'; weaponOwner: typeof ATTENDANT_MYSTERIES_TARGET_ID;
  ordinaryExit: 'OPEN'; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false; freeSkillLibrary: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; playerInjuries: SliceInjury[]; playerRisk: number;
  physique: number; perception: number; will: number; knowledge: number; mastery: Record<string, number>;
  preparation: AttendantMysteriesPreparation; root: AttendantMysteriesScene; remnant: AttendantMysteriesRemnant; body: AttendantMysteriesCombatBody; randomSeed: string; randomCursor: number;
}
export function currentAttendantMysteriesCombatSource(s: SliceState): AttendantMysteriesCombatSource | null {
  if (!hasAttendantMysteriesDisputeOpponent(s)) return null; const e = s.attendantMysteries.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, date: { ...s.date }, round: c.round, encounterId: 'ATTENDANT_MYSTERIES_DISPUTE', targetId: ATTENDANT_MYSTERIES_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetName: '埃利亚斯·维尔', targetAge: 47, targetPathway: 'original-caster', targetSequence: 2, targetCore: 22, targetPerception: 28,
    actualBody: true, independentMind: true, playerBodyId: `${s.runId}:body`, enemyWeapon: 'AM1-ELIAS-ROD', weaponOwner: ATTENDANT_MYSTERIES_TARGET_ID,
    ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false, freeSkillLibrary: false,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, playerInjuries: structuredClone(s.injuries), playerRisk: s.injuryRisk,
    ...s.character.coreStats, mastery: { ...s.progression.mastery }, preparation: structuredClone(e.preparation!), root: structuredClone(e.scene), remnant: structuredClone(e.remnant), body: combatBody(e), randomSeed: s.random.seed, randomCursor: s.random.cursor };
}
export interface AttendantMysteriesPendingEffect {
  id: string; owner: 'PLAYER'; kind: 'GRAFT' | 'REALM'; createdAt: number; expiresAt: number; remaining: 1 | 2;
  sourceId: string; fromCoordinate: 14; originalTargetCoordinate: 12; destinationCoordinate: 18; destinationDistanceMetres: 6; actualBodyContinuous: true;
}
export interface AttendantMysteriesActionEvidence {
  order: number; actor: 'PLAYER' | 'ENEMY'; id: string; planned: string; selectedAbility: string; fallbackReason: string | null; mode: string; label: string;
  selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean; attackKind: 'NONE' | 'BODY' | 'ARC' | 'MIND'; rawContribution: number; rawReduction: number;
  paidCost: number; mindCost: number; physicalFactor: number; check: PublicCheckResult | null; succeeded: boolean;
  pendingBefore: AttendantMysteriesPendingEffect[]; pendingAfter: AttendantMysteriesPendingEffect[]; pendingApplied: string[]; countered: string[]; masteryApplied: string[];
  remnantBefore: AttendantMysteriesRemnant; remnantAfter: AttendantMysteriesRemnant; segmentId: string | null;
  sourceId: string | null; borrowedReserve: number; reserveSpent: number; discardedReserve: number; winChanceBonus: 0 | 5;
  atSeconds: number; elapsedSeconds: 5; travelMetres: number; randomCursorBefore: number; randomCursorAfter: number;
  playerHealthAfter: number; playerMindAfter: number; playerSpiritualityAfter: number; enemySpiritualityAfter: number;
}
export interface AttendantMysteriesRuntime {
  body: AttendantMysteriesCombatBody; root: AttendantMysteriesScene; remnant: AttendantMysteriesRemnant; playerH: number; playerS: number; playerM: number;
  mastery: Record<string, number>; pending: AttendantMysteriesPendingEffect[]; expired: AttendantMysteriesPendingEffect[]; borrowUsed: boolean; probabilityUsed: boolean; winChanceBonus: 0 | 5;
}
export function createAttendantMysteriesRuntime(x: AttendantMysteriesCombatSource): AttendantMysteriesRuntime {
  return { body: structuredClone(x.body), root: structuredClone(x.root), remnant: structuredClone(x.remnant), playerH: x.playerHealth, playerS: x.playerSpirituality, playerM: x.playerMind,
    mastery: { ...x.mastery }, pending: [], expired: [], borrowUsed: false, probabilityUsed: false, winChanceBonus: 0 };
}
function syncPending(r: AttendantMysteriesRuntime): void { r.body.pendingKind = r.pending[0]?.kind ?? null; }
export function advanceAttendantMysteriesCombatClock(r: AttendantMysteriesRuntime, seconds: number): void {
  if (!integer(seconds)) throw new Error('实际时间无效。'); r.root.clockSeconds += seconds; r.root.externalSeconds += seconds;
  r.expired.push(...r.pending.filter(p => p.expiresAt <= r.root.clockSeconds)); r.pending = r.pending.filter(p => p.expiresAt > r.root.clockSeconds); syncPending(r);
}
function baseAction(x: AttendantMysteriesCombatSource, r: AttendantMysteriesRuntime, actor: 'PLAYER' | 'ENEMY', id: string, order: number, random: ActionRandomStream): AttendantMysteriesActionEvidence {
  return { actor, id, planned: id, selectedAbility: id, fallbackReason: null, order, mode: 'OBSERVE', label: '', selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false,
    attackKind: 'NONE', rawContribution: 0, rawReduction: 0, paidCost: 0, mindCost: 0, physicalFactor: physicalAt(actor === 'PLAYER' ? r.playerH : x.body.enemyHealth), check: null, succeeded: false,
    pendingBefore: structuredClone(r.pending), pendingAfter: [], pendingApplied: [], countered: [], masteryApplied: [], remnantBefore: structuredClone(r.remnant), remnantAfter: structuredClone(r.remnant), segmentId: null,
    sourceId: null, borrowedReserve: 0, reserveSpent: 0, discardedReserve: 0, winChanceBonus: 0, atSeconds: r.root.clockSeconds, elapsedSeconds: 5, travelMetres: 0,
    randomCursorBefore: random.cursor, randomCursorAfter: random.cursor, playerHealthAfter: r.playerH, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, enemySpiritualityAfter: r.body.enemySpirituality };
}
function gainMastery(r: AttendantMysteriesRuntime, a: AttendantMysteriesActionEvidence, id: string): void { r.mastery[id] = Math.min(500, (r.mastery[id] ?? 0) + 8); a.masteryApplied.push(id); }
function closeAction(a: AttendantMysteriesActionEvidence, r: AttendantMysteriesRuntime, random: ActionRandomStream) {
  advanceAttendantMysteriesCombatClock(r, 5); a.pendingAfter = structuredClone(r.pending); a.remnantAfter = structuredClone(r.remnant); a.randomCursorAfter = random.cursor;
  a.playerHealthAfter = r.playerH; a.playerMindAfter = r.playerM; a.playerSpiritualityAfter = r.playerS; a.enemySpiritualityAfter = r.body.enemySpirituality;
  a.label += ` 实际用时5秒；本人灵性${r.playerS}、精神${r.playerM}，埃利亚斯灵性${r.body.enemySpirituality}。`; return a;
}
function addPending(x: AttendantMysteriesCombatSource, r: AttendantMysteriesRuntime, a: AttendantMysteriesActionEvidence, kind: AttendantMysteriesPendingEffect['kind']): void {
  r.pending.push({ id: `${x.runId}:attendantMysteries:${x.round}:${a.order}:${kind}`, owner: 'PLAYER', kind, createdAt: r.root.clockSeconds, expiresAt: r.root.clockSeconds + 30,
    remaining: kind === 'REALM' ? 2 : 1, sourceId: r.root.observedSourceId!, fromCoordinate: 14, originalTargetCoordinate: 12, destinationCoordinate: 18, destinationDistanceMetres: 6, actualBodyContinuous: true }); syncPending(r);
}
function take(r: AttendantMysteriesRuntime, a: AttendantMysteriesActionEvidence, effect: AttendantMysteriesPendingEffect): void {
  a.pendingApplied.push(effect.id); if (effect.remaining === 2) effect.remaining = 1; else r.pending = r.pending.filter(p => p.id !== effect.id); syncPending(r);
}
function ordinary(r: AttendantMysteriesRuntime, a: AttendantMysteriesActionEvidence, why: string, attack = false): void {
  a.selectedAbility = attack ? BODY : 'ORDINARY_GUARD'; a.mode = attack ? 'BODY' : 'GUARD'; a.fallbackReason = why;
  if (attack) { a.selfGain = 12 * a.physicalFactor; a.attackKind = 'BODY'; a.threatens = true; a.travelMetres = 4; r.root.playerTravelMetres += 4; }
  else a.enemyReduction = 10 * a.physicalFactor;
  a.label = `${why}本槽改为${attack ? '本人空手近前2米打击再退回2米，12×身体' : '本人普通防备，减势10×身体'}，不重抽、不消耗不存在的物料或灵性。`;
}
function paid(r: AttendantMysteriesRuntime, a: AttendantMysteriesActionEvidence, spirit: number, mind: number): void { r.playerS -= spirit; r.playerM -= mind; a.paidCost = spirit; a.mindCost = mind; }
function check(x: AttendantMysteriesCombatSource, a: AttendantMysteriesActionEvidence, difficulty: number, random: ActionRandomStream): void {
  a.check = resolveNormalCheck({ ability: 'knowledge', baseAbility: x.knowledge, difficulty, modifiers: [], roll: random.nextInt(1, 100) }); a.succeeded = ['SUCCESS', 'GREAT_SUCCESS'].includes(a.check.tier);
}
/** No old inventory is consumed or replenished; zero mastery is still a learned ability. */
export function resolveAttendantMysteriesPlayerSlot(x: AttendantMysteriesCombatSource, r: AttendantMysteriesRuntime, id: AttendantMysteriesMoveId, order: number, random: ActionRandomStream): AttendantMysteriesActionEvidence {
  if (!ABILITIES.some(a => a.id === id)) throw new Error('行动盘无效。'); const a = baseAction(x, r, 'PLAYER', id, order, random);
  if (id !== BODY && id !== 'ACCIDENT' && !Object.hasOwn(x.mastery, id)) ordinary(r, a, '没有本人已学会的这项能力。');
  else if (id === 'ACCIDENT') { a.mode = 'ACCIDENT'; a.selfGain = -22.5; a.label = '此次动作偏差，贡献−22.5。'; }
  else if (id === BODY || id === BODY_CONTROL) { a.mode = 'BODY'; a.attackKind = 'BODY'; a.selfGain = (id === BODY ? 12 : 30) * a.physicalFactor; a.threatens = true; a.travelMetres = 4; r.root.playerTravelMetres += 4; a.label = '本人原身体近前2米击打，再退回原位置；只有一个连续身体。'; }
  else if (id === BALANCE) { a.mode = 'BALANCE'; a.enemyReduction = 28; a.label = '继承平衡避让，减势28，不保证免伤。'; }
  else if (id === AIR_BULLET || id === ILLUSION) {
    if (r.playerS < 2) ordinary(r, a, '当下不足2灵性。', id === AIR_BULLET);
    else { paid(r, a, 2, 0); a.succeeded = true; a.mode = id === AIR_BULLET ? 'AIR_BULLET' : 'ILLUSION';
      if (id === AIR_BULLET) { a.selfGain = 60; a.attackKind = 'ARC'; a.threatens = true; a.label = '继承空气弹实付2灵性，形成60身体攻击贡献，仍用共同伤势盘。'; }
      else { a.enemyReduction = 16; a.label = '继承有限感官幻术实付2灵性，减势16，不控制独立心智、不改记忆。'; } }
  } else if (id === PROBABILITY) {
    if (r.probabilityUsed || r.playerS < 5 || r.playerM <= 1) ordinary(r, a, '本轮概率机会已用，或不足5灵性1精神并保持清醒。');
    else { paid(r, a, 5, 1); r.probabilityUsed = true; r.winChanceBonus = a.winChanceBonus = 5; a.succeeded = true; a.mode = 'PROBABILITY'; a.label = '继承有限概率实付5灵性1精神，仅本轮原胜负骰胜率加5百分点、上限95%；不重抽、不改伤势盘。'; }
  } else if (id === PAST_SELF) {
    const sample = x.preparation.pastSample;
    if (r.borrowUsed || !sample?.airBulletKnown || !Object.hasOwn(x.mastery, AIR_BULLET) || r.playerS < 1 || sample.spirituality - (r.playerS - 1) < 2) ordinary(r, a, '没有足够差额的本人真实过去样本、已学空气弹或当下维持灵性，或本轮已借力。', true);
    else { paid(r, a, 1, 0); r.borrowUsed = true; a.sourceId = sample.id; a.mode = 'PAST_SELF'; check(x, a, 14, random);
      if (a.succeeded) { a.borrowedReserve = Math.min(6, sample.spirituality - r.playerS); a.reserveSpent = 2; a.discardedReserve = a.borrowedReserve - 2; a.selfGain = Math.min(60, sample.airBulletGain); a.attackKind = 'ARC'; a.threatens = true; }
      a.label = `本人过去借力先付1当下灵性，知识14检定${a.check!.roll}/${a.check!.chance}；${a.succeeded ? `临时借${a.borrowedReserve}，只耗2作样本已有的一次空气弹，余${a.discardedReserve}同槽丢弃` : '失败，费用不退'}。不把储备写进永久灵性，不向过去索取新序列能力。`; }
  } else if (id === THREAD_REGENERATION) {
    const segment = r.remnant.segments.find(s => s.status === 'UNUSED');
    if (!segment || r.playerS < 6 || r.playerM <= 1 || !validAttendantMysteriesRemnant(r.remnant, x.preparation) || r.remnant.location !== 'CLEARING') ordinary(r, a, '没有同一已购残料的真实剩余段，或不足6灵性1精神并保持清醒。', true);
    else { paid(r, a, 6, 1); segment.status = 'SPENT'; a.segmentId = segment.id; a.sourceId = r.remnant.lostThreadsEvidence; a.mode = 'THREAD_REGENERATION'; r.body.regenerationAttempts++; check(x, a, 18, random);
      if (a.succeeded) { a.selfGain = 32 * a.physicalFactor; a.attackKind = 'BODY'; a.threatens = true; gainMastery(r, a, id); }
      a.label = `同一已失去灵体线的原动物残料实耗一段及6灵性1精神，知识18检定${a.check!.roll}/${a.check!.chance}；${a.succeeded ? '短时重接本段线，以原材料牵动造成32×身体的有限实体贡献' : '失败，原段及费用仍耗去'}。本段随后惰性，原残料始终死亡，没有新生命、意识或常驻秘偶，也不恢复本人健康。`; }
  } else if (id === BOUNDED_GRAFTING || id === MYSTERIOUS_REALM) {
    const graft = id === BOUNDED_GRAFTING, cost = graft ? 6 : 8;
    if (r.pending.length) ordinary(r, a, '已有一项局部待用效果，不叠加或续期。');
    else if (r.playerS < cost || r.playerM <= 2 || !r.root.observedSourceId || !r.root.groundEmpty || r.root.playerCoordinate !== 12 || Math.abs(r.root.groundCoordinate - r.root.playerCoordinate) > 10) ordinary(r, a, `缺少实际观察的原空地映射，或不足${cost}灵性2精神并保持清醒。`);
    else { paid(r, a, cost, 2); a.sourceId = r.root.observedSourceId; a.mode = graft ? 'GRAFT' : 'REALM'; if (graft) { r.body.graftAttempts++; check(x, a, 20, random); } else { r.body.realmAttempts++; a.succeeded = true; }
      if (a.succeeded) addPending(x, r, a, graft ? 'GRAFT' : 'REALM');
      a.label = graft ? `有限嫁接实付6灵性2精神、知识20检定${a.check!.roll}/${a.check!.chance}；${a.succeeded ? '预备30秒内随后一次来自眼前原对手的可见身体或银弧攻击，将最多45贡献导向距本人6米的已核对空地' : '失败，费用不退'}。只有一个原落点和一次机会，不能嫁接精神、伤口、命运或未知来源。`
        : '诡秘之境实付8灵性2精神，在本人连续所在的同一原空地短时隐蔽30秒，后续最多两次可见身体或银弧贡献×0.8；不搬移本人、不停时间，不防精神施压。对方仍可自主辨认并抵消。'; }
  }
  a.rawContribution = a.selfGain; a.rawReduction = a.enemyReduction; syncPending(r); return closeAction(a, r, random);
}
export function resolveAttendantMysteriesEnemySlot(x: AttendantMysteriesCombatSource, r: AttendantMysteriesRuntime, planned: AttendantMysteriesEnemyIntent, order: number, random: ActionRandomStream): AttendantMysteriesActionEvidence {
  if (![...ATTENDANT_MYSTERIES_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned)) throw new Error('对手行动盘无效。');
  const a = baseAction(x, r, 'ENEMY', planned, order, random), b = r.body, p = ATTENDANT_MYSTERIES_POWERS.find(v => v.id === planned);
  if (planned === 'ACCIDENT') { a.mode = 'ACCIDENT'; a.selfGain = -22.5; a.label = '埃利亚斯此次动作偏差，贡献−22.5。'; }
  else if (p && b.enemySpirituality >= p.cost) {
    a.mode = p.id; a.paidCost = p.cost; b.enemySpirituality -= p.cost; b.powerUses[p.id]++; a.selfGain = p.selfGain; a.enemyReduction = p.enemyReduction;
    if (p.id === 'ARC_BOLT') { a.attackKind = 'ARC'; a.threatens = true; a.label = '埃利亚斯实付6灵性发出自己的有限银弧，85身体攻击贡献。'; }
    else if (p.id === 'MENTAL_PRESSURE') { a.attackKind = 'MIND'; a.mentalPressure = true; a.label = '埃利亚斯实付5灵性施加45精神压力。嫁接与空地隐蔽均不防精神，没有身体攻击来源。'; }
    else if (p.id === 'COMPOSE') {
      a.check = resolveNormalCheck({ ability: 'perception', baseAbility: x.targetPerception, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) }); a.succeeded = ['SUCCESS', 'GREAT_SUCCESS'].includes(a.check.tier);
      if (a.succeeded && r.pending.length) { a.countered.push(r.pending[0]!.id); r.pending = []; }
      a.label = `埃利亚斯实付4灵性自主凝神，以自己的感知20检定${a.check.roll}/${a.check.chance}辨认眼前局部映射或隐蔽；${a.countered.length ? '辨认成功，抵消这一项尚待作用的局部效果，原已付费用不退' : '没有成功抵消待用效果'}。不清除已经发生的实体打击、不取消所有能力。`;
    } else a.label = '埃利亚斯实付5灵性施展自己的有限屏护，敌方减势50。';
  } else {
    a.id = a.selectedAbility = 'BODY_STRIKE'; a.mode = 'BODY'; a.fallbackReason = p ? '当下对手灵性不足原法术费用。' : null; a.attackKind = 'BODY'; a.threatens = true; a.selfGain = 22 * a.physicalFactor; a.travelMetres = 4;
    a.label = '埃利亚斯持自己的原杖近前2米打击再退回2米，22×身体；灵性不足时只作同一槽普通动作，不重抽、不施免费法术。';
  }
  a.rawContribution = a.selfGain; a.rawReduction = a.enemyReduction;
  const effect = r.pending[0];
  if (effect && (a.attackKind === 'BODY' || a.attackKind === 'ARC') && a.selfGain > 0 && effect.expiresAt > r.root.clockSeconds) {
    if (effect.kind === 'GRAFT') { a.selfGain = Math.max(0, a.selfGain - 45); gainMastery(r, a, BOUNDED_GRAFTING); a.label += '当前真实来袭与原映射相符，最多45贡献实际导向6米外无人空地，唯一嫁接机会耗尽。'; }
    else { a.selfGain *= .8; gainMastery(r, a, MYSTERIOUS_REALM); a.label += '同一原空地的短时隐蔽使本次可见攻击降到80%，扣除一次机会；剩余正贡献仍有真实致伤风险。'; }
    take(r, a, effect);
  }
  if (a.attackKind === 'BODY' || a.attackKind === 'ARC') a.threatens = a.selfGain > 0;
  syncPending(r); return closeAction(a, r, random);
}

export interface AttendantMysteriesRoundOutcome extends AttendantMysteriesCombatBody {
  targetId: typeof ATTENDANT_MYSTERIES_TARGET_ID; round: number; source: AttendantMysteriesCombatSource; stance: SliceStance; continuing: boolean;
  playerHealthAfter: number; playerMindAfter: number; playerSpiritualityAfter: number; playerInjuriesAfter: SliceInjury[]; playerRiskAfter: number; remnantAfter: AttendantMysteriesRemnant; masteryAfter: Record<string, number>;
  rootAfter: AttendantMysteriesScene; elapsedSeconds: 60; randomCursorAfter: number; playerActions: AttendantMysteriesActionEvidence[]; enemyActions: AttendantMysteriesActionEvidence[]; expiredPending: AttendantMysteriesPendingEffect[];
}
export type AttendantMysteriesResolution = 'CONTINUE' | 'PLAYER_DEAD' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED' | 'RETREATED';
function penalty(n: number, max: number) { const f = n / max; return f > .75 ? 0 : f > .5 ? .05 : f > .25 ? .1 : .2; }
function base(core: number, h: number, m: number, s: number) { return (1250 + Math.min(core, 250)) * (1 - Math.min(.4, penalty(h, 100) + penalty(m, 100) + penalty(s, 120))); }
function weights(risk: number) { const death = Math.min(100, 5 + Math.min(risk, 10) * 10), shifted = death - 5; return { light: Math.max(0, 65 - shifted), heavy: Math.max(0, 30 - Math.max(0, shifted - 65)), death }; }
export function validAttendantMysteriesBody(b: AttendantMysteriesCombatBody): boolean {
  return integer(b.enemyHealth, 0, 100) && integer(b.enemyMind, 0, 100) && integer(b.enemySpirituality, 0, 120) && integer(b.enemyRisk) && Array.isArray(b.enemyInjuries) &&
    ['RESISTING', 'SURRENDERED', 'DEAD'].includes(b.enemyStatus) && (b.enemyStatus === 'DEAD') === (b.enemyHealth === 0) && b.weaponLocation === (b.enemyStatus === 'DEAD' ? 'CLEARING' : 'HAND') &&
    shape(b.powerUses, ATTENDANT_MYSTERIES_POWER_IDS) && ATTENDANT_MYSTERIES_POWER_IDS.every(id => integer(b.powerUses[id])) && b.enemySpirituality === 120 - ATTENDANT_MYSTERIES_POWERS.reduce((n, p) => n + p.cost * b.powerUses[p.id], 0) &&
    b.pendingKind === null && b.composureReady === false && integer(b.regenerationAttempts, 0, 3) && integer(b.graftAttempts) && integer(b.realmAttempts);
}
export function validAttendantMysteriesInjuries(injuries: SliceInjury[], revision: number): boolean {
  return Array.isArray(injuries) && new Set(injuries.map(i => i.id)).size === injuries.length && injuries.every(i => shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && !!i.id && ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision, 0, revision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision, revision)));
}
const SOURCE_KEYS = ['runId', 'revision', 'week', 'date', 'round', 'encounterId', 'targetId', 'attemptWeek', 'startHistoryIndex', 'targetName', 'targetAge', 'targetPathway', 'targetSequence', 'targetCore', 'targetPerception', 'actualBody', 'independentMind', 'playerBodyId', 'enemyWeapon', 'weaponOwner', 'ordinaryExit', 'pursuit', 'thirdPartiesInArea', 'automaticAllyImmunity', 'freeSkillLibrary', 'playerHealth', 'playerMind', 'playerSpirituality', 'playerInjuries', 'playerRisk', 'physique', 'perception', 'will', 'knowledge', 'mastery', 'preparation', 'root', 'remnant', 'body', 'randomSeed', 'randomCursor'];
export function validAttendantMysteriesCombatSource(x: AttendantMysteriesCombatSource): boolean {
  try { const p = x.root, prep = x.preparation;
    return shape(x, SOURCE_KEYS) && shape(x.body, Object.keys(combatBody(x.body))) && validateAttendantMysteriesPreparation(prep) && typeof x.runId === 'string' && !!x.runId && integer(x.revision) &&
      integer(x.week, prep.week) && isValidGameDate(x.date) && same(x.date, addGameWeeks(prep.date, x.week - prep.week)) && integer(x.round, 1) && integer(x.startHistoryIndex) && x.attemptWeek === x.week && x.encounterId === 'ATTENDANT_MYSTERIES_DISPUTE' && x.targetId === ATTENDANT_MYSTERIES_TARGET_ID &&
      x.targetName === '埃利亚斯·维尔' && x.targetAge === 47 && x.targetPathway === 'original-caster' && x.targetSequence === 2 && x.targetCore === 22 && x.targetPerception === 28 &&
      x.actualBody === true && x.independentMind === true && x.playerBodyId === `${x.runId}:body` && x.enemyWeapon === 'AM1-ELIAS-ROD' && x.weaponOwner === ATTENDANT_MYSTERIES_TARGET_ID &&
      x.ordinaryExit === 'OPEN' && x.pursuit === false && x.thirdPartiesInArea === 0 && x.automaticAllyImmunity === false && x.freeSkillLibrary === false && [x.playerHealth, x.playerMind].every(n => integer(n, 1, 100)) && integer(x.playerSpirituality, 0, 120) &&
      [x.physique, x.perception, x.will, x.knowledge].every(n => integer(n, 0, 500)) && same({ physique: x.physique, perception: x.perception, will: x.will, knowledge: x.knowledge }, prep.after.coreStats) &&
      !!x.mastery && typeof x.mastery === 'object' && !Array.isArray(x.mastery) && same(Object.keys(x.mastery).sort(), Object.keys(prep.after.mastery).sort()) && Object.values(x.mastery).every(n => integer(n, 0, 500)) &&
      Object.entries(prep.after.mastery).every(([id, value]) => [THREAD_REGENERATION, BOUNDED_GRAFTING, MYSTERIOUS_REALM].includes(id) ? x.mastery[id]! >= value : x.mastery[id] === value) &&
      integer(x.playerRisk) && validAttendantMysteriesInjuries(x.playerInjuries, x.revision) && validAttendantMysteriesInjuries(x.body.enemyInjuries, x.revision) && validAttendantMysteriesRemnant(x.remnant, prep) && x.remnant.location === 'CLEARING' &&
      x.remnant.segments.filter(s => s.status === 'SPENT').length === x.body.regenerationAttempts && validAttendantMysteriesScene(p) && p.siteId === ATTENDANT_MYSTERIES_SITE && p.playerLocation === 'CLEARING' && p.observedSourceId !== null &&
      p.observedSourceId.startsWith(`${x.runId}:AM1-CLEARING:`) && integer(Number(p.observedSourceId.slice(`${x.runId}:AM1-CLEARING:`.length)), prep.revision + 1, x.revision - x.round) && p.observationWeek !== null && p.observationWeek >= prep.week && p.observationWeek <= x.week && p.clockSeconds === 12 + 60 * (x.round - 1) &&
      validAttendantMysteriesBody(x.body) && x.body.enemyStatus === 'RESISTING' && x.body.enemyMind > 0 && typeof x.randomSeed === 'string' && !!x.randomSeed && integer(x.randomCursor) &&
      prep.runId === x.runId && prep.randomSeed === x.randomSeed && prep.randomCursor <= x.randomCursor && prep.revision < x.revision;
  } catch { return false; }
}
export function replayAttendantMysteriesCombatRound(x: AttendantMysteriesCombatSource, stance: SliceStance): { round: SliceCombatRound; outcome: AttendantMysteriesResolution } {
  if (!validAttendantMysteriesCombatSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new Error('缺少真实原来源。');
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = createAttendantMysteriesRuntime(x), b = r.body;
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = attendantMysteriesActionCount(playerCountRoll), enemyCount = attendantMysteriesEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: AttendantMysteriesActionEvidence[] = [], enemies: AttendantMysteriesActionEvidence[] = [], remaining = { PLAYER: playerCount, ENEMY: enemyCount }; let retreat: SliceCombatRound['retreat'] = 'NONE';
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) for (const actor of order) {
    if (!remaining[actor]) continue;
    if (actor === 'PLAYER' && stance === 'RETREAT') { remaining.PLAYER = 0; retreat = rng.nextInt(1, 100) <= 50 ? 'SUCCESS' : 'FAILURE'; if (retreat === 'SUCCESS') { remaining.ENEMY = 0; break; } continue; }
    remaining[actor]--; const index = players.length + enemies.length;
    if (actor === 'PLAYER') players.push(resolveAttendantMysteriesPlayerSlot(x, r, drawAttendantMysteriesAbility(rng, null, stance), index, rng)); else enemies.push(resolveAttendantMysteriesEnemySlot(x, r, drawAttendantMysteriesEnemyAbility(rng), index, rng));
  }
  const sum = (a: AttendantMysteriesActionEvidence[], key: 'selfGain' | 'enemyReduction') => a.reduce((n, v) => n + v[key], 0);
  const playerAdvantage = Math.max(125, base((x.physique + x.perception + x.will + x.knowledge) / 4, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, base(22, x.body.enemyHealth, x.body.enemyMind, x.body.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction'));
  const winChance = miracleWorkerWinChance(playerAdvantage, enemyAdvantage, r.winChanceBonus), winner = retreat === 'SUCCESS' ? 'ENEMY' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  let playerHealth = r.playerH, playerRisk = x.playerRisk, outcome: AttendantMysteriesResolution = retreat === 'SUCCESS' ? 'RETREATED' : 'CONTINUE';
  const playerInjuries = structuredClone(x.playerInjuries); let consequenceWeights: SliceCombatRound['consequenceWeights'] = null, consequenceRoll: number | undefined, consequenceDomain: SliceCombatRound['consequenceDomain'];
  if (retreat !== 'SUCCESS') {
    const loser = winner === 'PLAYER' ? 'ENEMY' : 'PLAYER', attacks = loser === 'PLAYER' ? enemies : players, injuries = loser === 'PLAYER' ? playerInjuries : b.enemyInjuries;
    if (attacks.some(a => a.threatens && (a.attackKind === 'BODY' || a.attackKind === 'ARC'))) {
      let risk = loser === 'PLAYER' ? playerRisk : b.enemyRisk; if (injuries.length) risk++; if (loser === 'PLAYER') playerRisk = risk; else b.enemyRisk = risk;
      consequenceDomain = 'BODY'; consequenceWeights = weights(risk); consequenceRoll = rng.nextInt(1, 100);
      const severity = consequenceRoll <= consequenceWeights.light ? 'LIGHT' : consequenceRoll <= consequenceWeights.light + consequenceWeights.heavy ? 'HEAVY' : 'DEATH';
      if (severity === 'DEATH') { if (loser === 'PLAYER') playerHealth = 0; else { b.enemyHealth = 0; b.enemyStatus = 'DEAD'; } }
      else { injuries.push({ id: `${x.runId}:combat:${x.round}:${loser}:${x.revision + 1}:${injuries.length}`, severity, acquiredRevision: x.revision + 1, treatedRevision: null });
        const damage = severity === 'LIGHT' ? 10 : 30; if (loser === 'PLAYER') playerHealth = Math.max(0, playerHealth - damage); else b.enemyHealth = Math.max(0, b.enemyHealth - damage);
        if (b.enemyHealth === 0) b.enemyStatus = 'DEAD'; else if (loser === 'ENEMY' && severity === 'HEAVY') b.enemyStatus = 'SURRENDERED'; }
    } else if (attacks.some(a => a.mentalPressure)) { consequenceDomain = 'MENTAL'; if (loser === 'PLAYER') r.playerM = Math.max(0, r.playerM - 10); else { b.enemyMind = Math.max(0, b.enemyMind - 10); if (b.enemyMind === 0) b.enemyStatus = 'SURRENDERED'; } }
    if (playerHealth === 0) outcome = 'PLAYER_DEAD'; else if (b.enemyHealth === 0) outcome = 'ENEMY_DEAD'; else if (b.enemyStatus === 'SURRENDERED') outcome = 'ENEMY_SURRENDERED';
  }
  if (outcome === 'CONTINUE' && r.playerM === 0) outcome = 'RETREATED';
  advanceAttendantMysteriesCombatClock(r, x.root.clockSeconds + 60 - r.root.clockSeconds); const expiredPending = structuredClone([...r.expired, ...r.pending]); r.pending = []; b.pendingKind = null; b.composureReady = false; if (b.enemyHealth === 0) b.weaponLocation = 'CLEARING';
  const o: AttendantMysteriesRoundOutcome = { ...structuredClone(b), targetId: ATTENDANT_MYSTERIES_TARGET_ID, round: x.round, source: structuredClone(x), stance, continuing: outcome === 'CONTINUE',
    playerHealthAfter: playerHealth, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, playerInjuriesAfter: playerInjuries, playerRiskAfter: playerRisk, remnantAfter: structuredClone(r.remnant), masteryAfter: { ...r.mastery },
    rootAfter: structuredClone(r.root), elapsedSeconds: 60, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies, expiredPending };
  const round: SliceCombatRound = { round: x.round, stance, first, playerCount, enemyCount, playerCountRoll, enemyCountRoll,
    moves: [...players, ...enemies].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })),
    playerAdvantage, enemyAdvantage, winChance, winner, consequence: '', consequenceWeights, retreat, ...(consequenceDomain === undefined ? {} : { consequenceDomain }), ...(consequenceRoll === undefined ? {} : { consequenceRoll }),
    attendantMysteriesOutcome: o };
  round.consequence = attendantMysteriesCombatConsequence(round); return { round, outcome };
}
export function validateAttendantMysteriesRoundOutcome(v: unknown): v is AttendantMysteriesRoundOutcome { try { const o = v as AttendantMysteriesRoundOutcome; return !!o && same(o, replayAttendantMysteriesCombatRound(o.source, o.stance).round.attendantMysteriesOutcome); } catch { return false; } }
export function validateAttendantMysteriesCombatRound(round: SliceCombatRound): boolean { try { const o = round.attendantMysteriesOutcome; return !!o && same(round, replayAttendantMysteriesCombatRound(o.source, o.stance).round); } catch { return false; } }
export function nextAttendantMysteriesCombatSource(o: AttendantMysteriesRoundOutcome): AttendantMysteriesCombatSource {
  return { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter,
    playerSpirituality: Math.min(120, o.playerSpiritualityAfter + 12), playerInjuries: structuredClone(o.playerInjuriesAfter), playerRisk: o.playerRiskAfter,
    root: structuredClone(o.rootAfter), body: combatBody(o), remnant: structuredClone(o.remnantAfter), mastery: { ...o.masteryAfter }, randomCursor: o.randomCursorAfter };
}
export function attendantMysteriesCombatConsequence(round: SliceCombatRound): string {
  const o = round.attendantMysteriesOutcome!, who = round.winner === 'PLAYER' ? '埃利亚斯' : '你'; let text = round.retreat === 'SUCCESS' ? '撤离判定成功，沿普通12米出口离开。' : round.consequenceDomain === 'MENTAL' ? `${who}承受实际精神压力，精神减少10，没有新增身体伤口。` : round.consequenceDomain === 'BODY' ? `${who}承受实际身体打击或法术冲击，按共同伤势盘结算。` : '本轮下风没有实际攻击来源，不掷身体伤势盘。';
  if (o.playerHealthAfter === 0) text += '本人的原身体真实死亡，不能复活或离场。'; else if (o.enemyHealth === 0) text += '埃利亚斯原身体真实死亡，唯一原杖留地。'; else if (o.enemyStatus === 'SURRENDERED') text += '埃利亚斯因实际伤势或精神耗尽自主停止抵抗。';
  return text + ' 本轮实际60秒；本人在轮末收束尚未用完的局部效果，已花灵性、精神不退。全部原人物与旧记录保持原样。';
}

/** Public facts are copied through positive nested allowlists; replay inputs remain private. */
const publicInjury = (i: SliceInjury) => ({ id: i.id, severity: i.severity, acquiredRevision: i.acquiredRevision, treatedRevision: i.treatedRevision });
const publicPending = (p: AttendantMysteriesPendingEffect) => ({
  id: p.id, owner: p.owner, kind: p.kind, createdAt: p.createdAt, expiresAt: p.expiresAt, remaining: p.remaining,
  sourceId: p.sourceId, fromCoordinate: p.fromCoordinate, originalTargetCoordinate: p.originalTargetCoordinate,
  destinationCoordinate: p.destinationCoordinate, destinationDistanceMetres: p.destinationDistanceMetres, actualBodyContinuous: p.actualBodyContinuous,
});
const publicRemnant = (r: AttendantMysteriesRemnant) => ({
  id: r.id, sourceId: r.sourceId, animal: r.animal, quantity: r.quantity, owner: r.owner, holder: r.holder, location: r.location,
  alive: r.alive, health: r.health, independentMind: r.independentMind, threadsPreviouslyLost: r.threadsPreviouslyLost,
  lostThreadsEvidence: r.lostThreadsEvidence, acquiredWeek: r.acquiredWeek, pricePaid: r.pricePaid,
  segments: r.segments.map(segment => ({ id: segment.id, status: segment.status })),
});
const publicScene = (p: AttendantMysteriesScene) => ({
  siteId: p.siteId, playerLocation: p.playerLocation, playerCoordinate: p.playerCoordinate, enemyCoordinate: p.enemyCoordinate,
  groundCoordinate: p.groundCoordinate, ordinaryExit: p.ordinaryExit, groundEmpty: p.groundEmpty, thirdPartiesInArea: p.thirdPartiesInArea,
  residentsLocation: p.residentsLocation, residentsJoined: p.residentsJoined, observedSourceId: p.observedSourceId, observationWeek: p.observationWeek,
  clockSeconds: p.clockSeconds, externalSeconds: p.externalSeconds, playerTravelMetres: p.playerTravelMetres,
});
const publicCheck = (c: PublicCheckResult | null): PublicCheckResult | null => c ? ({
  ability: c.ability, baseAbility: c.baseAbility, modifiers: c.modifiers.map(m => ({ source: m.source, value: m.value })),
  effectiveAbility: c.effectiveAbility, difficulty: c.difficulty, chance: c.chance, roll: c.roll, tier: c.tier,
}) : null;
const publicPowerUses = (p: AttendantMysteriesCombatBody['powerUses']) => ({ ARC_BOLT: p.ARC_BOLT, WARD: p.WARD, COMPOSE: p.COMPOSE, MENTAL_PRESSURE: p.MENTAL_PRESSURE });
const publicWheel = (w: SliceWheelEntry) => ({ id: w.id, label: w.label, weight: w.weight });
export function projectAttendantMysteriesAction(a: AttendantMysteriesActionEvidence) { return {
  order: a.order, actor: a.actor, id: a.id, planned: a.planned, selectedAbility: a.selectedAbility, fallbackReason: a.fallbackReason, mode: a.mode, label: a.label,
  selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: a.mentalPressure, attackKind: a.attackKind, rawContribution: a.rawContribution, rawReduction: a.rawReduction,
  paidCost: a.paidCost, mindCost: a.mindCost, physicalFactor: a.physicalFactor, check: publicCheck(a.check), succeeded: a.succeeded,
  pendingBefore: a.pendingBefore.map(publicPending), pendingAfter: a.pendingAfter.map(publicPending), pendingApplied: [...a.pendingApplied], countered: [...a.countered], masteryApplied: [...a.masteryApplied],
  remnantBefore: publicRemnant(a.remnantBefore), remnantAfter: publicRemnant(a.remnantAfter), segmentId: a.segmentId,
  sourceId: a.sourceId, borrowedReserve: a.borrowedReserve, reserveSpent: a.reserveSpent, discardedReserve: a.discardedReserve, winChanceBonus: a.winChanceBonus,
  atSeconds: a.atSeconds, elapsedSeconds: a.elapsedSeconds, travelMetres: a.travelMetres,
  playerHealthAfter: a.playerHealthAfter, playerMindAfter: a.playerMindAfter, playerSpiritualityAfter: a.playerSpiritualityAfter, enemySpiritualityAfter: a.enemySpiritualityAfter,
}; }
export type AttendantMysteriesPublicActionEvidence = ReturnType<typeof projectAttendantMysteriesAction>;
export function projectAttendantMysteriesRoundOutcome(o: AttendantMysteriesRoundOutcome) { return {
  enemyHealth: o.enemyHealth, enemyMind: o.enemyMind, enemySpirituality: o.enemySpirituality, enemyStatus: o.enemyStatus,
  enemyInjuries: o.enemyInjuries.map(publicInjury), enemyRisk: o.enemyRisk, weaponLocation: o.weaponLocation, powerUses: publicPowerUses(o.powerUses),
  pendingKind: o.pendingKind, composureReady: o.composureReady, regenerationAttempts: o.regenerationAttempts, graftAttempts: o.graftAttempts, realmAttempts: o.realmAttempts,
  targetId: o.targetId, round: o.round, stance: o.stance, continuing: o.continuing,
  playerHealthAfter: o.playerHealthAfter, playerMindAfter: o.playerMindAfter, playerSpiritualityAfter: o.playerSpiritualityAfter,
  playerInjuriesAfter: o.playerInjuriesAfter.map(publicInjury), playerRiskAfter: o.playerRiskAfter, remnantAfter: publicRemnant(o.remnantAfter),
  masteryAfter: Object.fromEntries([...ATTENDANT_MYSTERIES_INHERITED_ABILITY_IDS, ...ATTENDANT_MYSTERIES_ABILITY_IDS].filter(id => Object.hasOwn(o.masteryAfter, id)).map(id => [id, o.masteryAfter[id]!])),
  rootAfter: publicScene(o.rootAfter), elapsedSeconds: o.elapsedSeconds,
  playerActions: o.playerActions.map(projectAttendantMysteriesAction), enemyActions: o.enemyActions.map(projectAttendantMysteriesAction), expiredPending: o.expiredPending.map(publicPending),
}; }
export type AttendantMysteriesPublicRoundOutcome = ReturnType<typeof projectAttendantMysteriesRoundOutcome>;

export function projectAttendantMysteriesCombat(s: SliceState) {
  const e = s.attendantMysteries.encounter, last = s.combat?.encounterId === 'ATTENDANT_MYSTERIES_DISPUTE' ? s.combat.lastRound?.attendantMysteriesOutcome : e.terminal ? s.combatHistory[e.terminal.historyIndex]?.attendantMysteriesOutcome : null;
  return { enemyName: isAttendantMysteries(s) ? '埃利亚斯·维尔（47岁，序列2非凡者）' : '', targetId: e.targetId, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality,
    weaponLocation: e.weaponLocation, pendingKind: e.pendingKind, composureReady: e.composureReady, powerUses: publicPowerUses(e.powerUses),
    lastActionSequence: last ? [...last.playerActions, ...last.enemyActions].sort((a, b) => a.order - b.order).map(projectAttendantMysteriesAction) : [], countWheel: ATTENDANT_MYSTERIES_COUNT_WHEEL.map(publicWheel), enemyCountWheel: ATTENDANT_MYSTERIES_ENEMY_COUNT_WHEEL.map(publicWheel),
    enemyAbilityWheel: ATTENDANT_MYSTERIES_ENEMY_ABILITY_WHEEL.map(publicWheel), remnant: publicRemnant(e.remnant), remainingMaterialSegments: e.remnant.segments.filter(v => v.status === 'UNUSED').length,
    facts: ['本人沿用四项属性平均、灵性上限120与续轮恢复12。旧能力的零掌握仍代表已学；没有来源或资源时只作普通动作。',
      '身体与精神后果按实际来源分别结算；缓冲后仍为正的身体攻击仍可致伤。普通12米出口开放。',
      '原残料始终死亡，三段耗尽不补。居民留在镇中，没有免费秘偶军队。本人真实死亡即终局，本场不启动新的复活机制。'] };
}
