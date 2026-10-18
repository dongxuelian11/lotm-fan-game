import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicGameDate, PublicCheckResult } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { COFFIN_BEARER_COUNT_WHEEL as BARREN_MATRIARCH_COUNT_WHEEL, coffinBearerActionCount, validCoffinBearerCombatGuard } from '../coffin-bearer/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import type { BarrenMatriarchSceneRoot, BarrenMatriarchRootPad } from './life.js';
import { BARREN_MATRIARCH_TARGET_ID, BARREN_MATRIARCH_POWER_IDS, BARREN_MATRIARCH_POWERS, combatBody, hasBarrenMatriarchDisputeOpponent, validateBarrenMatriarchPreparation,
  type BarrenMatriarchCombatBody, type BarrenMatriarchEnemyIntent, type BarrenMatriarchPreparation } from './encounter.js';

export { BARREN_MATRIARCH_COUNT_WHEEL, BARREN_MATRIARCH_COUNT_WHEEL as BARREN_MATRIARCH_ENEMY_COUNT_WHEEL };
export function barrenMatriarchActionCount(roll: number): number { return coffinBearerActionCount(roll); }
export function barrenMatriarchEnemyActionCount(roll: number): number { return coffinBearerActionCount(roll); }
export const DORMANCY = 'mother.s2.bounded-dormancy', ROOT_BUFFER = 'mother.s2.root-buffer';
export const BODY = 'STRIKE', FOLLOWUP = 'BODY_FOLLOWUP', PRESERVATION = 'mother.s3.finite-preservation', LIFE_SUPPORT = 'mother.s7.life-support';
export const MATRIX = 'mother.s4.living-matrix', CAREFUL = 'mother.s9.careful-practice', SPECIMEN = 'mother.s6.specimen-study';
export type BarrenMatriarchMoveId = typeof BODY | typeof FOLLOWUP | typeof ROOT_BUFFER | typeof PRESERVATION | typeof LIFE_SUPPORT | typeof DORMANCY | 'ACCIDENT';
const ABILITIES: readonly { id: BarrenMatriarchMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: BODY, label: '继承普通近身打击：12×身体；持原棍则16×身体，0灵性', weight: 30, stance: 'ATTACK' },
  { id: FOLLOWUP, label: '继承细心练习普通侧击：8.4×原掌握×身体，0灵性', weight: 15, stance: 'ATTACK' },
  { id: ROOT_BUFFER, label: '根系缓冲：6灵性1精神、意志20；同一根纤维垫至少15完整度，30秒内下一次身体打击最多减45、磨损15', weight: 25, stance: 'DEFEND' },
  { id: PRESERVATION, label: '继承有限活性保全：5灵性、知识20、真实剩余原段1；本轮后续两次身体或弧光×0.8', weight: 10, stance: 'CONTROL' },
  { id: LIFE_SUPPORT, label: '继承有限生命支持：仅实际恢复才付4灵性；不清伤口、不改死亡', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '实际动作偏差：固定−22.5，0灵性', weight: 5, stance: null },
];
export const BARREN_MATRIARCH_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '有限弧光：5灵性，70身体攻击贡献', weight: 35 },
  { id: 'WARD', label: '有限屏护：4灵性，敌方−30', weight: 20 },
  { id: 'BODY_STRIKE', label: '本人手杖打击：20×身体', weight: 20 },
  { id: 'COMPOSE', label: '自主凝神：4灵性，贡献8；不取消已经形成的实体根垫或旧护腕', weight: 10 },
  { id: 'MENTAL_PRESSURE', label: '有限精神施压：5灵性，45精神攻击贡献；只造成精神后果', weight: 10 },
  { id: 'ACCIDENT', label: '实际偏差：−22.5，0灵性', weight: 5 },
];
export const isBarrenMatriarch = (s: SliceState) => s.progression.pathwayId === 'mother' && s.progression.sequence === 2;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (a.stance === stance && stance !== null ? 5 : 4));
export function barrenMatriarchAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const w = tickets(stance), total = w.reduce((a, b) => a + b, 0); return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: w[i]! / total * 100 }));
}
export function drawBarrenMatriarchAbility(random: ActionRandomStream, _s: SliceState | null, stance: SliceStance | null): BarrenMatriarchMoveId {
  const w = tickets(stance); let n = random.nextInt(1, w.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= w[i]!; if (n <= 0) return a.id; } throw new Error('行动盘无效。');
}
export function drawBarrenMatriarchEnemyAbility(random: ActionRandomStream): BarrenMatriarchEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of BARREN_MATRIARCH_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as BarrenMatriarchEnemyIntent; } throw new Error('对手行动盘无效。');
}
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
const physicalAt = (n: number) => n > 75 ? 1 : n > 50 ? .95 : n > 25 ? .9 : .8;
const factor = (n: number) => .65 + .35 * n / 500;
export function validBarrenMatriarchRootPad(p: BarrenMatriarchRootPad, week: number): boolean {
  return shape(p, ['id', 'sourceId', 'material', 'quantity', 'owner', 'holder', 'location', 'integrity', 'acquiredWeek']) && p.id === 'BM2-ROOT-PAD' &&
    p.sourceId === 'BM2-ROOT-FIBRE-STOCK' && p.material === 'PLANT_FIBRE' && p.quantity === 1 && ['SUPPLIER', 'PLAYER'].includes(p.owner) && ['SUPPLIER', 'PLAYER', 'GROUND'].includes(p.holder) &&
    ['START', 'A', 'B', 'OUTSIDE'].includes(p.location) && integer(p.integrity, 0, 65) && (p.owner === 'SUPPLIER' ? p.holder === 'SUPPLIER' && p.acquiredWeek === null && p.integrity === 65 : p.holder === 'PLAYER' && integer(p.acquiredWeek, 1, week));
}
export interface BarrenMatriarchCombatSource {
  runId: string; revision: number; week: number; date: PublicGameDate; round: number; encounterId: 'BARREN_MATRIARCH_DISPUTE'; targetId: typeof BARREN_MATRIARCH_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetName: '马丁·里德'; targetAge: 45; targetPathway: 'original-caster'; targetSequence: 3; targetCore: 22;
  actualBody: true; independentMind: true; enemyWeapon: 'BM2-MARTIN-ROD'; weaponOwner: typeof BARREN_MATRIARCH_TARGET_ID; yardId: 'CB3-NURSERY-TRANSFER'; enemyPosition: 'BETWEEN_A_AND_B'; enemyDistanceMetres: 2;
  ordinaryExit: 'OPEN'; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false; freeSkillLibrary: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; playerInjuries: SliceInjury[]; playerRisk: number;
  physique: number; perception: number; will: number; knowledge: number; mastery: Record<string, number>; clubHeld: boolean; rootPad: BarrenMatriarchRootPad;
  preparation: BarrenMatriarchPreparation; root: BarrenMatriarchSceneRoot; body: BarrenMatriarchCombatBody; randomSeed: string; randomCursor: number;
}
export function currentBarrenMatriarchCombatSource(s: SliceState): BarrenMatriarchCombatSource | null {
  if (!hasBarrenMatriarchDisputeOpponent(s)) return null; const e = s.barrenMatriarch.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, date: { ...s.date }, round: c.round, encounterId: 'BARREN_MATRIARCH_DISPUTE', targetId: BARREN_MATRIARCH_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetName: '马丁·里德', targetAge: 45, targetPathway: 'original-caster', targetSequence: 3, targetCore: 22,
    actualBody: true, independentMind: true, enemyWeapon: 'BM2-MARTIN-ROD', weaponOwner: BARREN_MATRIARCH_TARGET_ID, yardId: 'CB3-NURSERY-TRANSFER', enemyPosition: 'BETWEEN_A_AND_B', enemyDistanceMetres: 2,
    ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false, freeSkillLibrary: false,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, playerInjuries: structuredClone(s.injuries), playerRisk: s.injuryRisk,
    ...s.character.coreStats, mastery: { ...s.progression.mastery }, clubHeld: s.town.clubLocation === 'HAND', rootPad: structuredClone(s.barrenMatriarch.life.rootPad),
    preparation: structuredClone(e.preparation!), root: structuredClone(s.coffinBearer.life) as BarrenMatriarchSceneRoot, body: combatBody(e), randomSeed: s.random.seed, randomCursor: s.random.cursor };
}
/** The dormant plants stay outside with their current owners. No human sleep or control effect exists. */
export interface BarrenMatriarchPendingEffect {
  id: string; owner: 'PLAYER'; kind: 'ROOT_BUFFER' | 'MATRIX' | 'PRESERVE';
  createdAt: number; expiresAt: number; remaining: 1 | 2; guardSegmentId: string | null;
}
export interface BarrenMatriarchActionEvidence {
  order: number; actor: 'PLAYER' | 'ENEMY'; id: string; planned: string; selectedAbility: string; fallbackReason: string | null; mode: string; label: string;
  selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean; attackKind: 'NONE' | 'BODY' | 'ARC' | 'MIND'; rawContribution: number; rawReduction: number;
  paidCost: number; mindCost: number; physicalFactor: number; check: PublicCheckResult | null; succeeded: boolean;
  pendingBefore: BarrenMatriarchPendingEffect[]; pendingAfter: BarrenMatriarchPendingEffect[]; pendingApplied: string[]; masteryApplied: string[];
  rootPadBefore: BarrenMatriarchRootPad; rootPadAfter: BarrenMatriarchRootPad; padWear: 0 | 15; guardSegmentId: string | null;
  atSeconds: number; elapsedSeconds: 5; travelMetres: number; randomCursorBefore: number; randomCursorAfter: number;
  playerHealthBefore: number; playerHealthAfter: number; recoveredHealth: number; playerMindAfter: number; playerSpiritualityAfter: number; enemySpiritualityAfter: number;
}
export interface BarrenMatriarchRuntime {
  body: BarrenMatriarchCombatBody; root: BarrenMatriarchSceneRoot; playerH: number; playerS: number; playerM: number; rootPad: BarrenMatriarchRootPad;
  mastery: Record<string, number>; pending: BarrenMatriarchPendingEffect[]; expired: BarrenMatriarchPendingEffect[];
}
export function createBarrenMatriarchRuntime(x: BarrenMatriarchCombatSource): BarrenMatriarchRuntime {
  return { body: structuredClone(x.body), root: structuredClone(x.root), playerH: x.playerHealth, playerS: x.playerSpirituality, playerM: x.playerMind,
    rootPad: structuredClone(x.rootPad), mastery: { ...x.mastery }, pending: [], expired: [] };
}
function syncPending(r: BarrenMatriarchRuntime): void { r.body.pendingKind = r.pending[0]?.kind ?? null; }
export function advanceBarrenMatriarchCombatClock(r: BarrenMatriarchRuntime, seconds: number): void {
  if (!integer(seconds)) throw new Error('实际时间无效。'); r.root.clockSeconds += seconds; r.root.externalSeconds += seconds;
  r.expired.push(...r.pending.filter(p => p.expiresAt <= r.root.clockSeconds)); r.pending = r.pending.filter(p => p.expiresAt > r.root.clockSeconds); syncPending(r);
}
function baseAction(x: BarrenMatriarchCombatSource, r: BarrenMatriarchRuntime, actor: 'PLAYER' | 'ENEMY', id: string, order: number, random: ActionRandomStream): BarrenMatriarchActionEvidence {
  return { actor, id, planned: id, selectedAbility: id, fallbackReason: null, order, mode: 'OBSERVE', label: '', selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false,
    attackKind: 'NONE', rawContribution: 0, rawReduction: 0, paidCost: 0, mindCost: 0, physicalFactor: physicalAt(actor === 'PLAYER' ? r.playerH : x.body.enemyHealth), check: null, succeeded: false,
    pendingBefore: structuredClone(r.pending), pendingAfter: [], pendingApplied: [], masteryApplied: [], rootPadBefore: structuredClone(r.rootPad), rootPadAfter: structuredClone(r.rootPad), padWear: 0, guardSegmentId: null,
    atSeconds: r.root.clockSeconds, elapsedSeconds: 5, travelMetres: 0, randomCursorBefore: random.cursor, randomCursorAfter: random.cursor,
    playerHealthBefore: r.playerH, playerHealthAfter: r.playerH, recoveredHealth: 0, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, enemySpiritualityAfter: r.body.enemySpirituality };
}
function gainMastery(r: BarrenMatriarchRuntime, a: BarrenMatriarchActionEvidence, id: string): void { r.mastery[id] = Math.min(500, (r.mastery[id] ?? 0) + 8); a.masteryApplied.push(id); }
function closeAction(a: BarrenMatriarchActionEvidence, r: BarrenMatriarchRuntime, random: ActionRandomStream) {
  advanceBarrenMatriarchCombatClock(r, 5); a.pendingAfter = structuredClone(r.pending); a.rootPadAfter = structuredClone(r.rootPad);
  a.randomCursorAfter = random.cursor; a.playerHealthAfter = r.playerH; a.playerMindAfter = r.playerM; a.playerSpiritualityAfter = r.playerS; a.enemySpiritualityAfter = r.body.enemySpirituality;
  a.label += ` 实际用时5秒；本人灵性${r.playerS}、精神${r.playerM}，马丁灵性${r.body.enemySpirituality}。`; return a;
}
function pending(x: BarrenMatriarchCombatSource, r: BarrenMatriarchRuntime, a: BarrenMatriarchActionEvidence, kind: BarrenMatriarchPendingEffect['kind']): BarrenMatriarchPendingEffect {
  return { id: `${x.runId}:barrenMatriarch:${x.round}:${a.order}:${kind}`, owner: 'PLAYER', kind, createdAt: r.root.clockSeconds,
    expiresAt: kind === 'ROOT_BUFFER' ? r.root.clockSeconds + 30 : x.root.clockSeconds + 60, remaining: kind === 'PRESERVE' ? 2 : 1, guardSegmentId: a.guardSegmentId };
}
function take(r: BarrenMatriarchRuntime, a: BarrenMatriarchActionEvidence, effect: BarrenMatriarchPendingEffect): void {
  a.pendingApplied.push(effect.id); if (effect.remaining === 2) effect.remaining = 1; else r.pending = r.pending.filter(p => p.id !== effect.id);
}
const heldPad = (r: BarrenMatriarchRuntime) => r.rootPad.owner === 'PLAYER' && r.rootPad.holder === 'PLAYER' && r.rootPad.location === 'A' && r.rootPad.integrity >= 15;
function inheritedGuard(x: BarrenMatriarchCombatSource, r: BarrenMatriarchRuntime, a: BarrenMatriarchActionEvidence, preserve: boolean, random: ActionRandomStream): void {
  const id = preserve ? PRESERVATION : MATRIX, cost = preserve ? 5 : 4, guard = r.root.guard;
  const segment = guard.prepared && guard.owner === 'PLAYER' && guard.location === 'HAND' ? guard.segments.find(g => g.status === 'UNUSED') : undefined;
  a.selectedAbility = id;
  if (r.pending.length) { a.fallbackReason = 'ALREADY_PENDING'; a.label = '已有待用实体护持，本次普通防备，不叠加、续期或再次耗段。'; }
  else if (!segment || r.playerS < cost) {
    a.selectedAbility = 'ORDINARY_GUARD'; a.fallbackReason = !segment ? 'NO_REMAINING_ORIGINAL_SEGMENT' : 'INSUFFICIENT_RESOURCES';
    a.enemyReduction = preserve ? 6 * a.physicalFactor : 42.25 * factor(x.mastery[SPECIMEN] ?? 0) * a.physicalFactor;
    a.label = preserve ? '没有真实剩余旧段或不足5灵性，只普通走位6×身体，不补段、不造保全。' : '没有真实剩余旧段或不足4灵性，只用继承样本观察护身42.25×原掌握×身体，不补段。';
  } else {
    r.playerS -= cost; a.paidCost = cost; segment.status = 'SPENT'; a.guardSegmentId = segment.id; a.mode = preserve ? 'PRESERVE' : 'MATRIX';
    if (preserve) r.body.preservationAttempts++; else r.body.guardAttempts++;
    a.check = resolveNormalCheck({ ability: 'knowledge', baseAbility: x.knowledge, difficulty: preserve ? 20 : 18, modifiers: [], roll: random.nextInt(1, 100) });
    a.succeeded = preserve ? ['SUCCESS', 'GREAT_SUCCESS'].includes(a.check.tier) : a.check.roll <= a.check.chance;
    if (a.succeeded) r.pending.push(pending(x, r, a, preserve ? 'PRESERVE' : 'MATRIX'));
    a.label = `同一旧护腕${guard.id}的真实剩余段${segment.id}变为惰性原物，实付${cost}灵性、知识${preserve ? 20 : 18}检定${a.check.roll}/${a.check.chance}；${a.succeeded ? `本轮后续最多${preserve ? '两' : '一'}次正身体或弧光贡献×${preserve ? '0.8' : '0.6'}` : '失败，段与费用不退'}。所有更早已耗段保持原样，不补货、不清死亡风险。`;
  }
}
/** Checks draw only at the actual slot; the plant-only ability never targets a human. */
export function resolveBarrenMatriarchPlayerSlot(x: BarrenMatriarchCombatSource, r: BarrenMatriarchRuntime, id: BarrenMatriarchMoveId, order: number, random: ActionRandomStream): BarrenMatriarchActionEvidence {
  const a = baseAction(x, r, 'PLAYER', id, order, random);
  if (id === 'ACCIDENT') { a.mode = 'ACCIDENT'; a.selfGain = -22.5; a.label = '此次动作偏差，贡献−22.5。'; }
  else if (id === BODY || id === FOLLOWUP) {
    a.mode = 'BODY'; a.attackKind = 'BODY'; a.selfGain = (id === BODY ? x.clubHeld ? 16 : 12 : 8.4 * factor(x.mastery[CAREFUL] ?? 0)) * a.physicalFactor;
    a.label = id === BODY ? '继承普通近身打击，实际使用自己的身体或持握原短棍。' : '继承细心练习普通侧击，仅8.4×原掌握系数×身体。';
    a.travelMetres = 4; r.root.playerTravelMetres += 4; a.threatens = a.selfGain > 0;
  } else if (id === DORMANCY) {
    a.selectedAbility = 'OBSERVE'; a.fallbackReason = 'HUMAN_IS_NOT_A_LIVING_PLANT'; a.label = '马丁是独立成人，有限休眠仅适用实际原活植物；本次普通观察，0消耗，不催眠、控制或停住人类。';
  } else if (id === ROOT_BUFFER) {
    if (r.pending.length) { a.fallbackReason = 'ALREADY_PENDING'; a.label = '已有待用实体护持，本次普通防备；不叠加、续期或磨损。'; }
    else if (r.playerS >= 6 && r.playerM >= 1 && heldPad(r)) {
      r.playerS -= 6; r.playerM--; a.paidCost = 6; a.mindCost = 1; r.body.rootBufferAttempts++; a.mode = 'ROOT_BUFFER';
      a.check = resolveNormalCheck({ ability: 'will', baseAbility: x.will, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) }); a.succeeded = ['SUCCESS', 'GREAT_SUCCESS'].includes(a.check.tier);
      if (a.succeeded) r.pending.push(pending(x, r, a, 'ROOT_BUFFER'));
      a.label = `根系缓冲实付6灵性1精神，意志20检定${a.check.roll}/${a.check.chance}；${a.succeeded ? '同一实持根纤维垫预备30秒，下一次普通身体打击最多减45并磨损15' : '失败，费用不退'}。施术不修复原垫，不防精神施压或弧光。`;
    } else { inheritedGuard(x, r, a, false, random); a.fallbackReason ??= 'NEW_RESOURCES_OR_ROOT_PAD_UNAVAILABLE'; a.label = '新根垫或资源条件不足。' + a.label; }
  } else if (id === PRESERVATION) inheritedGuard(x, r, a, true, random);
  else if (id === LIFE_SUPPORT) {
    a.mode = 'LIFE_SUPPORT';
    if (r.playerH >= 100 || r.playerH <= 0 || r.playerS < 4) { a.selectedAbility = 'ORDINARY_CARE'; a.fallbackReason = r.playerH >= 100 ? 'NO_ACTUAL_HEALTH_TO_RESTORE' : 'INSUFFICIENT_RESOURCES'; a.label = '没有可恢复的实际健康或不足4灵性，只普通照看，不付费、不凭空恢复。'; }
    else { a.recoveredHealth = Math.min(100 - r.playerH, Math.floor(15 * factor(x.mastery[LIFE_SUPPORT] ?? 0))); r.playerS -= 4; a.paidCost = 4; r.playerH += a.recoveredHealth;
      a.label = `继承有限生命支持实付4灵性，floor(15×原掌握)实际恢复${a.recoveredHealth}健康；战势0，不清原伤、累计风险或污染，不恢复精神、不复活。`; }
  } else throw new Error('行动盘无效。');
  a.rawContribution = a.selfGain; a.rawReduction = a.enemyReduction; syncPending(r); return closeAction(a, r, random);
}
export function resolveBarrenMatriarchEnemySlot(x: BarrenMatriarchCombatSource, r: BarrenMatriarchRuntime, planned: BarrenMatriarchEnemyIntent, order: number, random: ActionRandomStream): BarrenMatriarchActionEvidence {
  const a = baseAction(x, r, 'ENEMY', planned, order, random), b = r.body, p = BARREN_MATRIARCH_POWERS.find(v => v.id === planned);
  if (planned === 'ACCIDENT') { a.mode = 'ACCIDENT'; a.selfGain = -22.5; a.label = '马丁此次动作偏差，贡献−22.5。'; }
  else if (p && b.enemySpirituality >= p.cost) {
    a.mode = p.id; a.paidCost = p.cost; b.enemySpirituality -= p.cost; b.powerUses[p.id]++; a.selfGain = p.selfGain; a.enemyReduction = p.enemyReduction;
    if (p.id === 'ARC_BOLT') { a.attackKind = 'ARC'; a.threatens = true; a.label = '马丁实付5灵性发出有限弧光，形成身体伤势来源；根垫只防普通身体动作。'; }
    else if (p.id === 'MENTAL_PRESSURE') { a.attackKind = 'MIND'; a.mentalPressure = true; a.label = '马丁实付5灵性向独立心智施加精神压力，只有精神后果；根垫和旧护腕均不能挡住。'; }
    else if (p.id === 'COMPOSE') { b.composureReady = true; a.label = '马丁实付4灵性自主凝神，贡献8；这不是取消实体原垫或旧护腕的权能，待用护持不被清空。'; }
    else a.label = '马丁实付4灵性施展自己的有限屏护，保持独立防御。';
  } else {
    a.id = a.selectedAbility = 'BODY_STRIKE'; a.mode = 'BODY'; a.fallbackReason = p ? 'INSUFFICIENT_ENEMY_SPIRITUALITY' : null; a.attackKind = 'BODY'; a.threatens = true; a.selfGain = 20 * a.physicalFactor; a.travelMetres = 4;
    a.label = '马丁持自己的唯一手杖，近前2米击打再退回2米；不付原法术费用、不重抽动作。';
  }
  a.rawContribution = a.selfGain; a.rawReduction = a.enemyReduction;
  const effect = r.pending[0];
  if (effect && effect.kind !== 'ROOT_BUFFER' && (a.attackKind === 'BODY' || a.attackKind === 'ARC') && a.selfGain > 0) {
    a.selfGain *= effect.kind === 'PRESERVE' ? .8 : .6; take(r, a, effect); a.label += `已经实耗旧段的实体护持将这次正攻击降至${effect.kind === 'PRESERVE' ? 80 : 60}%，扣除一次待用机会。`;
  } else if (effect?.kind === 'ROOT_BUFFER' && a.attackKind === 'BODY' && a.selfGain > 0 && heldPad(r)) {
    a.selfGain = Math.max(0, a.selfGain - 45); r.rootPad.integrity -= 15; a.padWear = 15; take(r, a, effect); gainMastery(r, a, ROOT_BUFFER);
    a.label += '同一根纤维垫接住这一次实际身体打击，最多减45，完整度实减15；缓冲结束，此时才获得掌握。';
  }
  if (a.attackKind === 'BODY' || a.attackKind === 'ARC') a.threatens = a.selfGain > 0;
  syncPending(r); return closeAction(a, r, random);
}
export interface BarrenMatriarchRoundOutcome extends BarrenMatriarchCombatBody {
  targetId: typeof BARREN_MATRIARCH_TARGET_ID; round: number; source: BarrenMatriarchCombatSource; stance: SliceStance; continuing: boolean;
  playerHealthAfter: number; playerMindAfter: number; playerSpiritualityAfter: number; playerInjuriesAfter: SliceInjury[]; playerRiskAfter: number; rootPadAfter: BarrenMatriarchRootPad; masteryAfter: Record<string, number>;
  rootAfter: BarrenMatriarchSceneRoot; elapsedSeconds: 60; randomCursorAfter: number; playerActions: BarrenMatriarchActionEvidence[]; enemyActions: BarrenMatriarchActionEvidence[]; expiredPending: BarrenMatriarchPendingEffect[];
}
export type BarrenMatriarchResolution = 'CONTINUE' | 'PLAYER_DEAD' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED' | 'RETREATED';
function penalty(n: number, max: number) { const f = n / max; return f > .75 ? 0 : f > .5 ? .05 : f > .25 ? .1 : .2; }
function base(core: number, h: number, m: number, s: number) { return (1250 + Math.min(core, 250)) * (1 - Math.min(.4, penalty(h, 100) + penalty(m, 100) + penalty(s, 120))); }
function weights(risk: number) { const death = Math.min(100, 5 + Math.min(risk, 10) * 10), shifted = death - 5; return { light: Math.max(0, 65 - shifted), heavy: Math.max(0, 30 - Math.max(0, shifted - 65)), death }; }
export function validBarrenMatriarchBody(b: BarrenMatriarchCombatBody, _maxRound = Number.MAX_SAFE_INTEGER): boolean {
  return integer(b.enemyHealth, 0, 100) && integer(b.enemyMind, 0, 100) && integer(b.enemySpirituality, 0, 120) && integer(b.enemyRisk) && Array.isArray(b.enemyInjuries) &&
    ['RESISTING', 'SURRENDERED', 'DEAD'].includes(b.enemyStatus) && (b.enemyStatus === 'DEAD') === (b.enemyHealth === 0) && b.weaponLocation === (b.enemyStatus === 'DEAD' ? 'COURT' : 'HAND') &&
    shape(b.powerUses, BARREN_MATRIARCH_POWER_IDS) && BARREN_MATRIARCH_POWER_IDS.every(id => integer(b.powerUses[id])) && b.enemySpirituality === 120 - BARREN_MATRIARCH_POWERS.reduce((n, p) => n + p.cost * b.powerUses[p.id], 0) &&
    b.pendingKind === null && b.composureReady === false && [b.rootBufferAttempts, b.guardAttempts, b.preservationAttempts].every(n => integer(n));
}
export function validBarrenMatriarchInjuries(injuries: SliceInjury[], revision: number): boolean {
  return Array.isArray(injuries) && new Set(injuries.map(i => i.id)).size === injuries.length && injuries.every(i => shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && !!i.id && ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision, 0, revision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision, revision)));
}
const SOURCE_KEYS = ['runId', 'revision', 'week', 'date', 'round', 'encounterId', 'targetId', 'attemptWeek', 'startHistoryIndex', 'targetName', 'targetAge', 'targetPathway', 'targetSequence', 'targetCore', 'actualBody', 'independentMind', 'enemyWeapon', 'weaponOwner', 'yardId', 'enemyPosition', 'enemyDistanceMetres', 'ordinaryExit', 'pursuit', 'thirdPartiesInArea', 'automaticAllyImmunity', 'freeSkillLibrary', 'playerHealth', 'playerMind', 'playerSpirituality', 'playerInjuries', 'playerRisk', 'physique', 'perception', 'will', 'knowledge', 'mastery', 'clubHeld', 'rootPad', 'preparation', 'root', 'body', 'randomSeed', 'randomCursor'];
export function validBarrenMatriarchCombatSource(x: BarrenMatriarchCombatSource): boolean {
  try { const p = x.root;
    return shape(x, SOURCE_KEYS) && shape(x.body, Object.keys(combatBody(x.body))) && validateBarrenMatriarchPreparation(x.preparation) && typeof x.runId === 'string' && !!x.runId && integer(x.revision) && integer(x.week, 1) && integer(x.round, 1) && integer(x.startHistoryIndex) && x.attemptWeek === x.week && x.week === x.preparation.week && same(x.date, x.preparation.date) &&
      x.encounterId === 'BARREN_MATRIARCH_DISPUTE' && x.targetId === BARREN_MATRIARCH_TARGET_ID && x.targetName === '马丁·里德' && x.targetAge === 45 && x.targetPathway === 'original-caster' && x.targetSequence === 3 && x.targetCore === 22 &&
      x.actualBody === true && x.independentMind === true && x.enemyWeapon === 'BM2-MARTIN-ROD' && x.weaponOwner === BARREN_MATRIARCH_TARGET_ID && x.yardId === 'CB3-NURSERY-TRANSFER' && x.enemyPosition === 'BETWEEN_A_AND_B' && x.enemyDistanceMetres === 2 &&
      x.ordinaryExit === 'OPEN' && x.pursuit === false && x.thirdPartiesInArea === 0 && x.automaticAllyImmunity === false && x.freeSkillLibrary === false && [x.playerHealth, x.playerMind].every(n => integer(n, 1, 100)) && integer(x.playerSpirituality, 0, 120) &&
      [x.physique, x.perception, x.will, x.knowledge].every(n => integer(n, 0, 500)) && !!x.mastery && typeof x.mastery === 'object' && !Array.isArray(x.mastery) && Object.values(x.mastery).every(n => integer(n, 0, 500)) && typeof x.clubHeld === 'boolean' && integer(x.playerRisk) && validBarrenMatriarchInjuries(x.playerInjuries, x.revision) && validBarrenMatriarchInjuries(x.body.enemyInjuries, x.revision) && validBarrenMatriarchRootPad(x.rootPad, x.week) && x.rootPad.location === (x.rootPad.holder === 'PLAYER' ? 'A' : 'START') &&
      p.siteId === 'CB3-NURSERY-TRANSFER' && p.playerLocation === 'A' && p.owner.id === 'CB3-ADA' && p.owner.age === 46 && p.owner.location === 'OUTSIDE' && p.owner.alive && p.recipient.id === 'CB3-LENA' && p.recipient.age === 39 && p.recipient.location === 'OUTSIDE' && p.recipient.alive &&
      p.owner.independentMind && p.recipient.independentMind && p.owner.health === 100 && p.owner.mind === 100 && p.recipient.health === 100 && p.recipient.mind === 100 && p.owner.injuries.length === 0 && p.recipient.injuries.length === 0 &&
      p.paper.id === 'CB3-RECORD' && p.paper.holder === 'OWNER' && p.paper.location === 'OUTSIDE' && p.box.id === 'CB3-CASE' && p.box.holder === 'OWNER' && p.box.location === 'OUTSIDE' && p.box.sampleId === null &&
      p.tag.id === 'CB3-TAG' && p.tag.holder === 'OWNER' && p.tag.location === 'OUTSIDE' && p.pads.length === 3 && p.pads.every((v, i) => v.id === `CB3-PAD-${i + 1}` && v.holder === 'OWNER' && v.location === 'OUTSIDE') &&
      p.samples.length === 3 && p.samples.every(v => v.location === 'OUTSIDE' && ['OWNER', 'RECIPIENT'].includes(v.holder) && v.quantity === 1) && p.samples[0]!.id === 'CB3-LIVE-1' && p.samples[1]!.id === 'CB3-LIVE-2' && p.samples[2]!.id === 'CB3-DRY-1' && !p.samples[2]!.alive && p.samples[2]!.vitality === 0 &&
      validCoffinBearerCombatGuard(p.guard) && same({ ...p.guard, segments: x.preparation.after.guard.segments }, x.preparation.after.guard) && x.preparation.after.guard.segments.every((v, i) => v.status === 'UNUSED' || p.guard.segments[i]!.status === v.status) && p.guard.segments.filter(v => v.status === 'SPENT').length === x.preparation.after.guard.segments.filter(v => v.status === 'SPENT').length + x.body.guardAttempts + x.body.preservationAttempts &&
      p.activeCase === null && integer(p.clockSeconds) && integer(p.externalSeconds) && integer(p.playerTravelMetres) && validBarrenMatriarchBody(x.body, x.round - 1) && x.body.enemyStatus === 'RESISTING' && x.body.enemyMind > 0 &&
      typeof x.randomSeed === 'string' && !!x.randomSeed && integer(x.randomCursor) && x.preparation.runId === x.runId && x.preparation.randomSeed === x.randomSeed && x.preparation.randomCursor <= x.randomCursor && x.preparation.revision < x.revision && p.clockSeconds === x.preparation.lifeClockSeconds + 24 + 60 * (x.round - 1);
  } catch { return false; }
}
export function replayBarrenMatriarchCombatRound(x: BarrenMatriarchCombatSource, stance: SliceStance): { round: SliceCombatRound; outcome: BarrenMatriarchResolution } {
  if (!validBarrenMatriarchCombatSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new Error('缺少真实原来源。');
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = createBarrenMatriarchRuntime(x), b = r.body;
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = barrenMatriarchActionCount(playerCountRoll), enemyCount = barrenMatriarchEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: BarrenMatriarchActionEvidence[] = [], enemies: BarrenMatriarchActionEvidence[] = [], remaining = { PLAYER: playerCount, ENEMY: enemyCount }; let retreat: SliceCombatRound['retreat'] = 'NONE';
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) for (const actor of order) {
    if (!remaining[actor]) continue;
    if (actor === 'PLAYER' && stance === 'RETREAT') { remaining.PLAYER = 0; retreat = rng.nextInt(1, 100) <= 50 ? 'SUCCESS' : 'FAILURE'; if (retreat === 'SUCCESS') { remaining.ENEMY = 0; break; } continue; }
    remaining[actor]--; const index = players.length + enemies.length;
    if (actor === 'PLAYER') players.push(resolveBarrenMatriarchPlayerSlot(x, r, drawBarrenMatriarchAbility(rng, null, stance), index, rng)); else enemies.push(resolveBarrenMatriarchEnemySlot(x, r, drawBarrenMatriarchEnemyAbility(rng), index, rng));
  }
  const sum = (a: BarrenMatriarchActionEvidence[], key: 'selfGain' | 'enemyReduction') => a.reduce((n, v) => n + v[key], 0);
  const playerAdvantage = Math.max(125, base(x.physique * .20 + x.perception * .15 + x.will * .20 + x.knowledge * .45, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, base(22, x.body.enemyHealth, x.body.enemyMind, x.body.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction'));
  const winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100, winner = retreat === 'SUCCESS' ? 'ENEMY' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  let playerHealth = r.playerH, playerRisk = x.playerRisk, outcome: BarrenMatriarchResolution = retreat === 'SUCCESS' ? 'RETREATED' : 'CONTINUE';
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
  advanceBarrenMatriarchCombatClock(r, x.root.clockSeconds + 60 - r.root.clockSeconds); const expiredPending = structuredClone([...r.expired, ...r.pending]); r.pending = []; b.pendingKind = null; b.composureReady = false; if (b.enemyHealth === 0) b.weaponLocation = 'COURT';
  const o: BarrenMatriarchRoundOutcome = { ...structuredClone(b), targetId: BARREN_MATRIARCH_TARGET_ID, round: x.round, source: structuredClone(x), stance, continuing: outcome === 'CONTINUE',
    playerHealthAfter: playerHealth, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, playerInjuriesAfter: playerInjuries, playerRiskAfter: playerRisk, rootPadAfter: structuredClone(r.rootPad), masteryAfter: { ...r.mastery },
    rootAfter: structuredClone(r.root), elapsedSeconds: 60, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies, expiredPending };
  const round: SliceCombatRound = { round: x.round, stance, first, playerCount, enemyCount, playerCountRoll, enemyCountRoll,
    moves: [...players, ...enemies].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })),
    playerAdvantage, enemyAdvantage, winChance, winner, consequence: '', consequenceWeights, retreat, ...(consequenceDomain === undefined ? {} : { consequenceDomain }), ...(consequenceRoll === undefined ? {} : { consequenceRoll }),
    barrenMatriarchOutcome: o };
  round.consequence = barrenMatriarchCombatConsequence(round); return { round, outcome };
}
export function validateBarrenMatriarchRoundOutcome(v: unknown): v is BarrenMatriarchRoundOutcome { try { const o = v as BarrenMatriarchRoundOutcome; return !!o && same(o, replayBarrenMatriarchCombatRound(o.source, o.stance).round.barrenMatriarchOutcome); } catch { return false; } }
export function validateBarrenMatriarchCombatRound(round: SliceCombatRound): boolean { try { const o = round.barrenMatriarchOutcome; return !!o && same(round, replayBarrenMatriarchCombatRound(o.source, o.stance).round); } catch { return false; } }
export function nextBarrenMatriarchCombatSource(o: BarrenMatriarchRoundOutcome): BarrenMatriarchCombatSource {
  return { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter,
    playerSpirituality: Math.min(120, o.playerSpiritualityAfter + 12), playerInjuries: structuredClone(o.playerInjuriesAfter), playerRisk: o.playerRiskAfter,
    root: structuredClone(o.rootAfter), body: combatBody(o), rootPad: structuredClone(o.rootPadAfter), mastery: { ...o.masteryAfter }, randomCursor: o.randomCursorAfter };
}
export function barrenMatriarchCombatConsequence(round: SliceCombatRound): string {
  const o = round.barrenMatriarchOutcome!, who = round.winner === 'PLAYER' ? '马丁' : '你'; let text = round.retreat === 'SUCCESS' ? '撤离判定成功，沿普通4米出口离开。' : round.consequenceDomain === 'MENTAL' ? `${who}承受实际精神压力，精神减少10，没有新增身体伤口。` : round.consequenceDomain === 'BODY' ? `${who}承受实际身体打击或法术冲击，按共同伤势盘结算。` : '本轮下风没有实际攻击来源，不掷身体伤势盘。';
  if (o.playerHealthAfter === 0) text += '本人的原身体真实死亡，不能复活或离场。'; else if (o.enemyHealth === 0) text += '马丁原身体真实死亡，唯一原杖留地。'; else if (o.enemyStatus === 'SURRENDERED') text += '马丁因实际伤势或精神耗尽自主停止抵抗。';
  return text + ' 本轮实际60秒；未用窗口到期，已花灵性、精神不退。全部原人物与旧记录保持原样。';
}
export function projectBarrenMatriarchCombat(s: SliceState) {
  const e = s.barrenMatriarch.encounter, last = s.combat?.encounterId === 'BARREN_MATRIARCH_DISPUTE' ? s.combat.lastRound?.barrenMatriarchOutcome : e.terminal ? s.combatHistory[e.terminal.historyIndex]?.barrenMatriarchOutcome : null;
  return { enemyName: isBarrenMatriarch(s) ? '马丁·里德（45岁，序列3园艺施术者）' : '', targetId: e.targetId, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality,
    weaponLocation: e.weaponLocation, pendingKind: e.pendingKind, composureReady: e.composureReady, powerUses: { ...e.powerUses },
    lastActionSequence: last ? [...last.playerActions, ...last.enemyActions].sort((a, b) => a.order - b.order) : [], countWheel: BARREN_MATRIARCH_COUNT_WHEEL, enemyCountWheel: BARREN_MATRIARCH_COUNT_WHEEL, enemyAbilityWheel: BARREN_MATRIARCH_ENEMY_ABILITY_WHEEL,
    rootPad: structuredClone(s.barrenMatriarch.life.rootPad), remainingGuardSegments: s.coffinBearer.life.guard.segments.filter(v => v.status === 'UNUSED').length, summary: '有限休眠只用于实际原活植物，不能催眠或控制马丁。根系缓冲6灵性1精神、意志20，同一实持根纤维垫30秒内下一次普通身体打击最多减45、磨损15；仅实际挡击才获掌握，不挡弧光或精神。旧活性基质和保全只耗同一旧护腕真实剩余段，失败不退、不补货；生命支持只恢复实际健康，不清旧伤或死亡风险。马丁有独立心智、原杖、屏护与凝神，普通4米出口开放。' };
}
export type BarrenMatriarchCombatProjection = ReturnType<typeof projectBarrenMatriarchCombat>;
