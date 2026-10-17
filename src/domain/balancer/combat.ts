import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicGameDate, PublicCheckResult } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { CHAOS_HUNTER_COUNT_WHEEL, chaosHunterActionCount } from '../chaos-hunter/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import type { BalancerSceneRoot, BalancerGuardPlate } from './life.js';
import { BALANCER_TARGET_ID, BALANCER_POWER_IDS, BALANCER_POWERS, combatBody, hasBalancerDisputeOpponent, validateBalancerPreparation,
  type BalancerCombatBody, type BalancerEnemyIntent, type BalancerPreparation } from './encounter.js';

export const BALANCER_COUNT_WHEEL = CHAOS_HUNTER_COUNT_WHEEL;
export const BALANCER_ENEMY_COUNT_WHEEL = BALANCER_COUNT_WHEEL;
export const balancerActionCount = chaosHunterActionCount;
export const balancerEnemyActionCount = chaosHunterActionCount;
export const IMBALANCE = 'justiciar.s2.imbalance-sensing', RESISTANCE = 'justiciar.s2.measured-resistance';
export const BODY = 'justiciar.s9.combat-training', WOUND = 'justiciar.s5.wound-verdict', DEPRIVATION = 'justiciar.s4.deprivation';
const INTIMIDATION = 'justiciar.s4.intimidation', TRACE = 'justiciar.s8.trace-sensing';
export type BalancerMoveId = typeof BODY | typeof WOUND | typeof RESISTANCE | typeof IMBALANCE | typeof DEPRIVATION | 'ACCIDENT';
const ABILITIES: readonly { id: BalancerMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: BODY, label: '继承格斗：59.15×掌握×身体；持原棍则16×身体，0灵性', weight: 30, stance: 'ATTACK' },
  { id: WOUND, label: '真实旧伤裁断：3灵性、知识14；无伤或资源不足只普通侧击', weight: 15, stance: 'ATTACK' },
  { id: RESISTANCE, label: '适度抗衡：6灵性1精神、意志20；原护板至少15完整度，30秒内下一次身体打击最多减45、磨损15', weight: 25, stance: 'DEFEND' },
  { id: IMBALANCE, label: '失衡感知：5灵性、感知20；真实可见身体破绽，30秒内下一次本人身体动作+25', weight: 10, stance: 'CONTROL' },
  { id: DEPRIVATION, label: '继承暂剥弧光：4灵性、知识18；本轮原弧光槽改普通棍击', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '实际动作偏差：固定−22.5，0灵性', weight: 5, stance: null },
];
export const BALANCER_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '有限弧光：5灵性，70身体攻击贡献', weight: 35 },
  { id: 'WARD', label: '有限屏护：4灵性，敌方−30', weight: 20 },
  { id: 'BODY_STRIKE', label: '本人手杖打击：20×身体', weight: 20 },
  { id: 'COMPOSE', label: '自主凝神：4灵性，贡献8；消除实际破绽，取消未用抗衡、震慑及剥夺并抵抗本轮新输入', weight: 10 },
  { id: 'MENTAL_PRESSURE', label: '有限精神施压：5灵性，45精神攻击贡献；只造成精神后果', weight: 10 },
  { id: 'ACCIDENT', label: '实际偏差：−22.5，0灵性', weight: 5 },
];
export const isBalancer = (s: SliceState) => s.progression.pathwayId === 'justiciar' && s.progression.sequence === 2;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (a.stance === stance && stance !== null ? 5 : 4));
export function balancerAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const w = tickets(stance), total = w.reduce((a, b) => a + b, 0); return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: w[i]! / total * 100 }));
}
export function drawBalancerAbility(random: ActionRandomStream, _s: SliceState | null, stance: SliceStance | null): BalancerMoveId {
  const w = tickets(stance); let n = random.nextInt(1, w.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= w[i]!; if (n <= 0) return a.id; } throw new Error('行动盘无效。');
}
export function drawBalancerEnemyAbility(random: ActionRandomStream): BalancerEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of BALANCER_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as BalancerEnemyIntent; } throw new Error('对手行动盘无效。');
}
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
const physicalAt = (n: number) => n > 75 ? 1 : n > 50 ? .95 : n > 25 ? .9 : .8;
const factor = (n: number) => .65 + .35 * n / 500;
export function validBalancerGuardPlate(p: BalancerGuardPlate, week: number): boolean {
  return shape(p, ['id', 'owner', 'holder', 'location', 'integrity', 'acquiredWeek']) && p.id === 'BA2-GUARD-PLATE' && ['GUIDE', 'PLAYER'].includes(p.owner) && ['GUIDE', 'PLAYER', 'GROUND'].includes(p.holder) &&
    ['START', 'A', 'B', 'OUTSIDE'].includes(p.location) && integer(p.integrity, 0, 65) && (p.owner === 'GUIDE' ? p.holder === 'GUIDE' && p.acquiredWeek === null && p.integrity === 65 : p.holder === 'PLAYER' && integer(p.acquiredWeek, 1, week));
}
export interface BalancerCombatSource {
  runId: string; revision: number; week: number; date: PublicGameDate; round: number; encounterId: 'BALANCER_DISPUTE'; targetId: typeof BALANCER_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetName: '卡斯帕·霍尔特'; targetAge: 46; targetPathway: 'original-caster'; targetSequence: 3; targetCore: 22;
  actualBody: true; independentMind: true; enemyWeapon: 'BA2-CASPAR-ROD'; weaponOwner: typeof BALANCER_TARGET_ID; yardId: 'CH3-LINE-PRACTICE'; enemyPosition: 'BETWEEN_A_AND_B'; enemyDistanceMetres: 2;
  ordinaryExit: 'OPEN'; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false; freeSkillLibrary: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; playerInjuries: SliceInjury[]; playerRisk: number;
  physique: number; perception: number; will: number; knowledge: number; mastery: Record<string, number>; clubHeld: boolean; guardPlate: BalancerGuardPlate;
  preparation: BalancerPreparation; root: BalancerSceneRoot; body: BalancerCombatBody; randomSeed: string; randomCursor: number;
}
export function currentBalancerCombatSource(s: SliceState): BalancerCombatSource | null {
  if (!hasBalancerDisputeOpponent(s)) return null; const e = s.balancer.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, date: { ...s.date }, round: c.round, encounterId: 'BALANCER_DISPUTE', targetId: BALANCER_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetName: '卡斯帕·霍尔特', targetAge: 46, targetPathway: 'original-caster', targetSequence: 3, targetCore: 22,
    actualBody: true, independentMind: true, enemyWeapon: 'BA2-CASPAR-ROD', weaponOwner: BALANCER_TARGET_ID, yardId: 'CH3-LINE-PRACTICE', enemyPosition: 'BETWEEN_A_AND_B', enemyDistanceMetres: 2,
    ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false, freeSkillLibrary: false,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, playerInjuries: structuredClone(s.injuries), playerRisk: s.injuryRisk,
    ...s.character.coreStats, mastery: { ...s.progression.mastery }, clubHeld: s.town.clubLocation === 'HAND', guardPlate: structuredClone(s.balancer.life.guardPlate),
    preparation: structuredClone(e.preparation!), root: structuredClone(s.chaosHunter.life) as BalancerSceneRoot, body: combatBody(e), randomSeed: s.random.seed, randomCursor: s.random.cursor };
}
/** All windows refer only to this scene and recorded past/present actions. */
export interface BalancerPendingEffect {
  id: string; owner: 'PLAYER'; kind: 'IMBALANCE' | 'RESISTANCE' | 'INTIMIDATION' | 'DEPRIVATION';
  createdAt: number; expiresAt: number; remaining: 1; openingId: string | null;
}
export interface BalancerVisibleOpening { id: string; targetId: typeof BALANCER_TARGET_ID; sourceOrder: number; createdAt: number; expiresAt: number; kind: 'RECOVERING_FROM_ACTUAL_BODY_STRIKE'; visible: true }
export interface BalancerActionEvidence {
  order: number; actor: 'PLAYER' | 'ENEMY'; id: string; planned: string; selectedAbility: string; fallbackReason: string | null; mode: string; label: string;
  selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean; attackKind: 'NONE' | 'BODY' | 'ARC' | 'MIND' | 'WOUND'; rawContribution: number; rawReduction: number;
  paidCost: number; mindCost: number; physicalFactor: number; check: PublicCheckResult | null; succeeded: boolean; resisted: boolean;
  pendingBefore: BalancerPendingEffect[]; pendingAfter: BalancerPendingEffect[]; pendingApplied: string[]; masteryApplied: string[];
  openingBefore: BalancerVisibleOpening | null; openingAfter: BalancerVisibleOpening | null; guardPlateBefore: BalancerGuardPlate; guardPlateAfter: BalancerGuardPlate; plateWear: 0 | 15;
  atSeconds: number; elapsedSeconds: 5; travelMetres: number; randomCursorBefore: number; randomCursorAfter: number;
  playerMindAfter: number; playerSpiritualityAfter: number; enemySpiritualityAfter: number;
}
export interface BalancerRuntime {
  body: BalancerCombatBody; root: BalancerSceneRoot; playerS: number; playerM: number; guardPlate: BalancerGuardPlate;
  mastery: Record<string, number>; pending: BalancerPendingEffect[]; opening: BalancerVisibleOpening | null; expired: BalancerPendingEffect[];
}
export function createBalancerRuntime(x: BalancerCombatSource): BalancerRuntime {
  return { body: structuredClone(x.body), root: structuredClone(x.root), playerS: x.playerSpirituality, playerM: x.playerMind,
    guardPlate: structuredClone(x.guardPlate), mastery: { ...x.mastery }, pending: [], opening: null, expired: [] };
}
function syncPending(r: BalancerRuntime): void { r.body.pendingKind = r.pending.some(p => p.kind === 'RESISTANCE') ? 'RESISTANCE' : r.pending.some(p => p.kind === 'IMBALANCE') ? 'IMBALANCE' : null; }
export function advanceBalancerCombatClock(r: BalancerRuntime, seconds: number): void {
  if (!integer(seconds)) throw new Error('实际时间无效。'); r.root.clockSeconds += seconds;
  r.expired.push(...r.pending.filter(p => p.expiresAt <= r.root.clockSeconds)); r.pending = r.pending.filter(p => p.expiresAt > r.root.clockSeconds);
  if (r.opening && r.opening.expiresAt <= r.root.clockSeconds) r.opening = null; syncPending(r);
}
function baseAction(x: BalancerCombatSource, r: BalancerRuntime, actor: 'PLAYER' | 'ENEMY', id: string, order: number, random: ActionRandomStream): BalancerActionEvidence {
  return { actor, id, planned: id, selectedAbility: id, fallbackReason: null, order, mode: 'OBSERVE', label: '', selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false,
    attackKind: 'NONE', rawContribution: 0, rawReduction: 0, paidCost: 0, mindCost: 0, physicalFactor: physicalAt(actor === 'PLAYER' ? x.playerHealth : x.body.enemyHealth), check: null, succeeded: false, resisted: false,
    pendingBefore: structuredClone(r.pending), pendingAfter: [], pendingApplied: [], masteryApplied: [], openingBefore: structuredClone(r.opening), openingAfter: null,
    guardPlateBefore: structuredClone(r.guardPlate), guardPlateAfter: structuredClone(r.guardPlate), plateWear: 0, atSeconds: r.root.clockSeconds, elapsedSeconds: 5, travelMetres: 0,
    randomCursorBefore: random.cursor, randomCursorAfter: random.cursor, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, enemySpiritualityAfter: r.body.enemySpirituality };
}
function gainMastery(r: BalancerRuntime, a: BalancerActionEvidence, id: string): void { r.mastery[id] = Math.min(500, (r.mastery[id] ?? 0) + 8); a.masteryApplied.push(id); }
function closeAction(a: BalancerActionEvidence, r: BalancerRuntime, random: ActionRandomStream) {
  advanceBalancerCombatClock(r, 5); a.pendingAfter = structuredClone(r.pending); a.openingAfter = structuredClone(r.opening); a.guardPlateAfter = structuredClone(r.guardPlate);
  a.randomCursorAfter = random.cursor; a.playerMindAfter = r.playerM; a.playerSpiritualityAfter = r.playerS; a.enemySpiritualityAfter = r.body.enemySpirituality;
  a.label += ` 实际用时5秒；本人灵性${r.playerS}、精神${r.playerM}，卡斯帕灵性${r.body.enemySpirituality}。`; return a;
}
function pending(x: BalancerCombatSource, r: BalancerRuntime, a: BalancerActionEvidence, kind: BalancerPendingEffect['kind'], openingId: string | null = null): BalancerPendingEffect {
  return { id: `${x.runId}:balancer:${x.round}:${a.order}:${kind}`, owner: 'PLAYER', kind, createdAt: r.root.clockSeconds,
    expiresAt: kind === 'DEPRIVATION' || kind === 'INTIMIDATION' ? x.root.clockSeconds + 60 : r.root.clockSeconds + 30, remaining: 1, openingId };
}
function take(r: BalancerRuntime, a: BalancerActionEvidence, effect: BalancerPendingEffect): void { a.pendingApplied.push(effect.id); r.pending = r.pending.filter(p => p.id !== effect.id); }
const heldPlate = (r: BalancerRuntime) => r.guardPlate.owner === 'PLAYER' && r.guardPlate.holder === 'PLAYER' && r.guardPlate.location === 'A' && r.guardPlate.integrity >= 15;
/** The checks draw only when this actual slot requires one; no future RNG is read. */
export function resolveBalancerPlayerSlot(x: BalancerCombatSource, r: BalancerRuntime, id: BalancerMoveId, order: number, random: ActionRandomStream): BalancerActionEvidence {
  const a = baseAction(x, r, 'PLAYER', id, order, random), b = r.body;
  const pay = (s: number, m = 0) => { r.playerS -= s; r.playerM -= m; a.paidCost = s; a.mindCost = m; };
  const check = (ability: 'knowledge' | 'perception' | 'will', difficulty: number) => { a.check = resolveNormalCheck({ ability, baseAbility: x[ability], difficulty, modifiers: [], roll: random.nextInt(1, 100) }); a.succeeded = ['SUCCESS', 'GREAT_SUCCESS'].includes(a.check.tier); };
  if (id === 'ACCIDENT') { a.mode = 'ACCIDENT'; a.selfGain = -22.5; a.label = '此次动作偏差，贡献−22.5。'; }
  else if (id === BODY || id === WOUND) {
    const wound = id === WOUND && b.enemyInjuries.length > 0 && r.playerS >= 3;
    if (wound) { pay(3); check('knowledge', 14); a.mode = 'WOUND'; a.attackKind = 'WOUND'; a.selfGain = a.succeeded ? 45 * factor(x.mastery[WOUND] ?? 0) : 0;
      a.label = `继承旧伤裁断实付3灵性，知识14检定${a.check!.roll}/${a.check!.chance}；${a.succeeded ? '仅依卡斯帕真实既有伤口形成有限致伤战势' : '失败，费用不退'}。不乘身体，不使用身体破绽增益。`; }
    else { a.mode = 'BODY'; a.attackKind = 'BODY'; a.selfGain = (id === BODY ? x.clubHeld ? 16 : 59.15 * factor(x.mastery[BODY] ?? 0) : 41.405 * factor(x.mastery[BODY] ?? 0)) * a.physicalFactor;
      a.label = id === BODY ? '继承格斗，实际使用自己的身体或持握原短棍。' : '没有真实旧伤或不足3灵性，只作继承普通侧击，不虚构伤口。';
      a.travelMetres = 4; r.root.playerTravelMetres += 4;
    }
    a.rawContribution = a.selfGain;
    const opening = r.pending.find(p => p.kind === 'IMBALANCE');
    if (a.attackKind === 'BODY' && a.selfGain > 0 && opening && r.opening?.id === opening.openingId && !b.composureReady) {
      a.selfGain += 25; take(r, a, opening); gainMastery(r, a, IMBALANCE); r.opening = null; a.label += '此前看见的同一实际身体破绽现在被利用，本人这一次身体贡献+25，立即结束。';
    }
    a.threatens = a.selfGain > 0;
  } else if (id === IMBALANCE) {
    if (r.pending.some(p => p.kind === 'IMBALANCE')) { a.fallbackReason = 'ALREADY_PENDING'; a.label = '已有待用感知，本次普通观察，不叠加或刷新。'; }
    else if (!r.opening || r.opening.expiresAt <= r.root.clockSeconds || r.playerS < 5) { a.fallbackReason = r.playerS < 5 ? 'INSUFFICIENT_RESOURCES' : 'NO_VISIBLE_ACTUAL_OPENING'; a.selectedAbility = 'OBSERVE'; a.label = '没有当前可见的真实身体破绽或不足5灵性，只普通观察；不读取内心、隐藏状态或未来动作。'; }
    else { pay(5); b.imbalanceAttempts++; check('perception', 20); a.resisted = b.composureReady; a.succeeded &&= !a.resisted; a.mode = 'IMBALANCE';
      if (a.succeeded) { const p = pending(x, r, a, 'IMBALANCE', r.opening.id); p.expiresAt = Math.min(p.expiresAt, r.opening.expiresAt); r.pending.push(p); }
      a.label = `失衡感知实付5灵性，感知20检定${a.check!.roll}/${a.check!.chance}；${a.resisted ? '卡斯帕已实际凝神抵抗' : a.succeeded ? '只记住当前可见身体破绽，在原30秒窗口内待本人下一次真实身体动作使用' : '失败'}，费用不退。`; }
  } else if (id === RESISTANCE) {
    if (r.pending.some(p => p.kind === 'RESISTANCE')) { a.fallbackReason = 'ALREADY_PENDING'; a.label = '已有一次待用抗衡，本次普通防备；不叠加、续期或再次磨损。'; }
    else if (r.playerS >= 6 && r.playerM >= 1 && heldPlate(r)) {
      pay(6, 1); b.resistanceAttempts++; check('will', 20); a.resisted = b.composureReady; a.succeeded &&= !a.resisted; a.mode = 'RESISTANCE';
      if (a.succeeded) r.pending.push(pending(x, r, a, 'RESISTANCE'));
      a.label = `适度抗衡实付6灵性1精神，意志20检定${a.check!.roll}/${a.check!.chance}；${a.resisted ? '卡斯帕已凝神抵抗，未建立效果' : a.succeeded ? '以同一实持护板预备30秒，只在下一次实际普通身体攻击时最多减45并磨损15' : '失败'}。施术不修复护板，不防精神施压，也不自动取消法术。`;
    } else if (r.pending.some(p => p.kind === 'INTIMIDATION')) { a.selectedAbility = 'OBSERVE'; a.fallbackReason = 'INHERITED_INTIMIDATION_PENDING'; a.label = '新抗衡条件不足且旧震慑仍待用，只普通防备，不刷新旧效果。'; }
    else if (r.playerS >= 4) { pay(4); b.intimidationAttempts++; check('knowledge', 18); a.resisted = b.composureReady; a.succeeded &&= !a.resisted; a.selectedAbility = INTIMIDATION; a.fallbackReason = 'NEW_RESOURCES_OR_PLATE_UNAVAILABLE'; a.mode = 'INTIMIDATION';
      if (a.succeeded) r.pending.push(pending(x, r, a, 'INTIMIDATION')); a.label = `新抗衡的原板或资源不足，实际只付4灵性使用继承震慑，知识18检定${a.check!.roll}/${a.check!.chance}；${a.succeeded ? '本轮下一次正身体或弧光攻击×0.6' : '失败或被凝神抵抗，费用不退'}。不授新抗衡掌握。`; }
    else { a.selectedAbility = TRACE; a.fallbackReason = 'INSUFFICIENT_RESOURCES'; a.mode = 'GUARD'; a.enemyReduction = 49.29 * factor(x.mastery[TRACE] ?? 0) * a.physicalFactor; a.label = '资源不足，只用继承痕迹护身49.29×原掌握×身体，不制造待用抗衡或修复护板。'; }
  } else {
    a.mode = 'DEPRIVATION';
    if (r.pending.some(p => p.kind === 'DEPRIVATION')) { a.fallbackReason = 'ALREADY_PENDING'; a.label = '原弧光已暂剥，重复槽只普通观察，不叠加或续期。'; }
    else if (r.playerS < 4) { a.selectedAbility = 'OBSERVE'; a.fallbackReason = 'INSUFFICIENT_RESOURCES'; a.label = '不足4灵性，只普通观察，不制造剥夺。'; }
    else { pay(4); b.deprivationAttempts++; check('knowledge', 18); a.resisted = b.composureReady; a.succeeded &&= !a.resisted;
      if (a.succeeded) r.pending.push(pending(x, r, a, 'DEPRIVATION')); a.label = `继承暂剥弧光实付4灵性，知识18检定${a.check!.roll}/${a.check!.chance}；${a.succeeded ? '同一弧光本轮暂不可用，原弧光槽回退普通棍击，不收法术费' : '失败或被凝神抵抗，费用不退'}。不复制、永久删除或剥夺其他能力。`; }
  }
  if (a.rawContribution === 0) a.rawContribution = a.selfGain; a.rawReduction = a.enemyReduction; syncPending(r); return closeAction(a, r, random);
}
export function resolveBalancerEnemySlot(x: BalancerCombatSource, r: BalancerRuntime, planned: BalancerEnemyIntent, order: number, random: ActionRandomStream): BalancerActionEvidence {
  const a = baseAction(x, r, 'ENEMY', planned, order, random), b = r.body, p = BALANCER_POWERS.find(v => v.id === planned);
  const deprived = planned === 'ARC_BOLT' && r.pending.some(v => v.kind === 'DEPRIVATION'), payable = !!p && !deprived && b.enemySpirituality >= p.cost;
  if (planned === 'ACCIDENT') { a.mode = 'ACCIDENT'; a.selfGain = -22.5; a.label = '卡斯帕此次动作偏差，贡献−22.5。'; }
  else if (payable) {
    a.mode = p.id; a.paidCost = p.cost; b.enemySpirituality -= p.cost; b.powerUses[p.id]++; a.selfGain = p.selfGain; a.enemyReduction = p.enemyReduction;
    if (p.id === 'ARC_BOLT') { a.attackKind = 'ARC'; a.threatens = true; a.label = '卡斯帕实际付5灵性发出有限弧光，形成身体伤势来源；原板抗衡仅防普通身体动作。'; }
    else if (p.id === 'MENTAL_PRESSURE') { a.attackKind = 'MIND'; a.mentalPressure = true; a.label = '卡斯帕实际付5灵性向独立心智施加精神压力，只有精神后果；实持护板不能挡住。'; }
    else if (p.id === 'COMPOSE') { r.pending = []; r.opening = null; b.composureReady = true; a.label = '卡斯帕付4灵性自主凝神，调整实际姿态消除可见破绽，取消未用抗衡、震慑与剥夺并抵抗本轮新输入；已付费用不退。'; }
    else a.label = '卡斯帕实际付4灵性施展自己的有限屏护，保持独立防御。';
  } else {
    a.id = a.selectedAbility = 'BODY_STRIKE'; a.mode = 'BODY'; a.fallbackReason = deprived ? 'ACTUAL_ARC_DEPRIVED' : p ? 'INSUFFICIENT_ENEMY_SPIRITUALITY' : null; a.attackKind = 'BODY'; a.threatens = true; a.selfGain = 20 * a.physicalFactor; a.travelMetres = 4;
    a.label = '卡斯帕持自己的唯一手杖，近前2米击打再退回2米；不付原法术费用、不重抽动作。';
  }
  a.rawContribution = a.selfGain; a.rawReduction = a.enemyReduction;
  const intimidation = r.pending.find(v => v.kind === 'INTIMIDATION');
  if (intimidation && (a.attackKind === 'BODY' || a.attackKind === 'ARC') && a.selfGain > 0) { a.selfGain *= .6; take(r, a, intimidation); a.label += '原待用震慑现在将这次实际正攻击贡献降至60%。'; }
  const resistance = r.pending.find(v => v.kind === 'RESISTANCE');
  if (resistance && a.attackKind === 'BODY' && a.selfGain > 0 && heldPlate(r)) { a.selfGain = Math.max(0, a.selfGain - 45); r.guardPlate.integrity -= 15; a.plateWear = 15; take(r, a, resistance); gainMastery(r, a, RESISTANCE); a.label += '同一护板实际接住这一次身体打击，贡献最多减45，完整度实减15；抗衡结束，此时才获得掌握。'; }
  if (a.attackKind === 'BODY') {
    a.threatens = a.selfGain > 0;
    r.opening = { id: `${x.runId}:balancer:${x.round}:${order}:opening`, targetId: BALANCER_TARGET_ID, sourceOrder: order,
      createdAt: r.root.clockSeconds, expiresAt: r.root.clockSeconds + 30, kind: 'RECOVERING_FROM_ACTUAL_BODY_STRIKE', visible: true };
    r.pending = r.pending.filter(v => v.kind !== 'IMBALANCE'); a.label += '这次已经发生的近身出击留下可见的回身破绽，30秒内可观察；不预知下一槽。';
  }
  syncPending(r); return closeAction(a, r, random);
}
export interface BalancerRoundOutcome extends BalancerCombatBody {
  targetId: typeof BALANCER_TARGET_ID; round: number; source: BalancerCombatSource; stance: SliceStance; continuing: boolean;
  playerHealthAfter: number; playerMindAfter: number; playerSpiritualityAfter: number; playerInjuriesAfter: SliceInjury[]; playerRiskAfter: number; guardPlateAfter: BalancerGuardPlate; masteryAfter: Record<string, number>;
  rootAfter: BalancerSceneRoot; elapsedSeconds: 60; randomCursorAfter: number; playerActions: BalancerActionEvidence[]; enemyActions: BalancerActionEvidence[]; expiredPending: BalancerPendingEffect[];
}
export type BalancerResolution = 'CONTINUE' | 'PLAYER_DEAD' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED' | 'RETREATED';
function penalty(n: number, max: number) { const f = n / max; return f > .75 ? 0 : f > .5 ? .05 : f > .25 ? .1 : .2; }
function base(core: number, h: number, m: number, s: number) { return (1250 + Math.min(core, 250)) * (1 - Math.min(.4, penalty(h, 100) + penalty(m, 100) + penalty(s, 120))); }
function weights(risk: number) { const death = Math.min(100, 5 + Math.min(risk, 10) * 10), shifted = death - 5; return { light: Math.max(0, 65 - shifted), heavy: Math.max(0, 30 - Math.max(0, shifted - 65)), death }; }
export function validBalancerBody(b: BalancerCombatBody, _maxRound = Number.MAX_SAFE_INTEGER): boolean {
  return integer(b.enemyHealth, 0, 100) && integer(b.enemyMind, 0, 100) && integer(b.enemySpirituality, 0, 120) && integer(b.enemyRisk) && Array.isArray(b.enemyInjuries) &&
    ['RESISTING', 'SURRENDERED', 'DEAD'].includes(b.enemyStatus) && (b.enemyStatus === 'DEAD') === (b.enemyHealth === 0) && b.weaponLocation === (b.enemyStatus === 'DEAD' ? 'COURT' : 'HAND') &&
    shape(b.powerUses, BALANCER_POWER_IDS) && BALANCER_POWER_IDS.every(id => integer(b.powerUses[id])) && b.enemySpirituality === 120 - BALANCER_POWERS.reduce((n, p) => n + p.cost * b.powerUses[p.id], 0) &&
    b.pendingKind === null && b.composureReady === false && [b.imbalanceAttempts, b.resistanceAttempts, b.intimidationAttempts, b.deprivationAttempts].every(n => integer(n));
}
export function validBalancerInjuries(injuries: SliceInjury[], revision: number): boolean {
  return Array.isArray(injuries) && new Set(injuries.map(i => i.id)).size === injuries.length && injuries.every(i => shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && !!i.id && ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision, 0, revision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision, revision)));
}
const SOURCE_KEYS = ['runId', 'revision', 'week', 'date', 'round', 'encounterId', 'targetId', 'attemptWeek', 'startHistoryIndex', 'targetName', 'targetAge', 'targetPathway', 'targetSequence', 'targetCore', 'actualBody', 'independentMind', 'enemyWeapon', 'weaponOwner', 'yardId', 'enemyPosition', 'enemyDistanceMetres', 'ordinaryExit', 'pursuit', 'thirdPartiesInArea', 'automaticAllyImmunity', 'freeSkillLibrary', 'playerHealth', 'playerMind', 'playerSpirituality', 'playerInjuries', 'playerRisk', 'physique', 'perception', 'will', 'knowledge', 'mastery', 'clubHeld', 'guardPlate', 'preparation', 'root', 'body', 'randomSeed', 'randomCursor'];
export function validBalancerCombatSource(x: BalancerCombatSource): boolean {
  try { const p = x.root;
    return shape(x, SOURCE_KEYS) && shape(x.body, Object.keys(combatBody(x.body))) && validateBalancerPreparation(x.preparation) && typeof x.runId === 'string' && !!x.runId && integer(x.revision) && integer(x.week, 1) && integer(x.round, 1) && integer(x.startHistoryIndex) && x.attemptWeek === x.week && x.week === x.preparation.week && same(x.date, x.preparation.date) &&
      x.encounterId === 'BALANCER_DISPUTE' && x.targetId === BALANCER_TARGET_ID && x.targetName === '卡斯帕·霍尔特' && x.targetAge === 46 && x.targetPathway === 'original-caster' && x.targetSequence === 3 && x.targetCore === 22 &&
      x.actualBody === true && x.independentMind === true && x.enemyWeapon === 'BA2-CASPAR-ROD' && x.weaponOwner === BALANCER_TARGET_ID && x.yardId === 'CH3-LINE-PRACTICE' && x.enemyPosition === 'BETWEEN_A_AND_B' && x.enemyDistanceMetres === 2 &&
      x.ordinaryExit === 'OPEN' && x.pursuit === false && x.thirdPartiesInArea === 0 && x.automaticAllyImmunity === false && x.freeSkillLibrary === false && [x.playerHealth, x.playerMind].every(n => integer(n, 1, 100)) && integer(x.playerSpirituality, 0, 120) &&
      [x.physique, x.perception, x.will, x.knowledge].every(n => integer(n, 0, 500)) && !!x.mastery && typeof x.mastery === 'object' && !Array.isArray(x.mastery) && Object.values(x.mastery).every(n => integer(n, 0, 500)) && typeof x.clubHeld === 'boolean' && integer(x.playerRisk) && validBalancerInjuries(x.playerInjuries, x.revision) && validBalancerInjuries(x.body.enemyInjuries, x.revision) && validBalancerGuardPlate(x.guardPlate, x.week) && x.guardPlate.location === (x.guardPlate.holder === 'PLAYER' ? 'A' : 'OUTSIDE') &&
      p.siteId === 'CH3-LINE-PRACTICE' && p.playerLocation === 'A' && p.volunteer.id === 'CH3-MIRA' && p.volunteer.age === 43 && p.volunteer.location === 'OUTSIDE' && p.volunteer.alive && p.guide.id === 'GUIDE' && p.guide.name === '薇娜·贝尔' && p.guide.location === 'OUTSIDE' &&
      p.volunteer.name === '米拉·佩恩' && p.volunteer.independentMind === true && p.volunteer.health === 100 && p.volunteer.mind === 100 && p.volunteer.injuries.length === 0 &&
      p.parcel.id === 'CH3-PARCEL' && p.parcel.owner === 'GUIDE' && p.parcel.massGrams === 350 && p.parcel.quantity === 1 && p.line.id === 'CH3-LINE' && p.line.owner === 'GUIDE' && p.line.quantity === 1 && p.line.isWall === false && p.paper.id === 'CH3-RULE-PAPER' && p.paper.owner === 'GUIDE' && p.paper.quantity === 1 && p.paper.text === '本次从A到B的越线' &&
      [p.parcel, p.line, p.paper].every(item => item.holder === 'GUIDE' && item.location === 'OUTSIDE') && p.activeCase === null && integer(p.clockSeconds) && integer(p.playerTravelMetres) && validBalancerBody(x.body, x.round - 1) && x.body.enemyStatus === 'RESISTING' && x.body.enemyMind > 0 &&
      typeof x.randomSeed === 'string' && !!x.randomSeed && integer(x.randomCursor) && x.preparation.runId === x.runId && x.preparation.randomSeed === x.randomSeed && x.preparation.randomCursor <= x.randomCursor && x.preparation.revision < x.revision && p.clockSeconds === x.preparation.lifeClockSeconds + 16 + 60 * (x.round - 1);
  } catch { return false; }
}
export function replayBalancerCombatRound(x: BalancerCombatSource, stance: SliceStance): { round: SliceCombatRound; outcome: BalancerResolution } {
  if (!validBalancerCombatSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new Error('缺少真实原来源。');
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = createBalancerRuntime(x), b = r.body;
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = balancerActionCount(playerCountRoll), enemyCount = balancerEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: BalancerActionEvidence[] = [], enemies: BalancerActionEvidence[] = [], remaining = { PLAYER: playerCount, ENEMY: enemyCount }; let retreat: SliceCombatRound['retreat'] = 'NONE';
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) for (const actor of order) {
    if (!remaining[actor]) continue;
    if (actor === 'PLAYER' && stance === 'RETREAT') { remaining.PLAYER = 0; retreat = rng.nextInt(1, 100) <= 50 ? 'SUCCESS' : 'FAILURE'; if (retreat === 'SUCCESS') { remaining.ENEMY = 0; break; } continue; }
    remaining[actor]--; const index = players.length + enemies.length;
    if (actor === 'PLAYER') players.push(resolveBalancerPlayerSlot(x, r, drawBalancerAbility(rng, null, stance), index, rng)); else enemies.push(resolveBalancerEnemySlot(x, r, drawBalancerEnemyAbility(rng), index, rng));
  }
  const sum = (a: BalancerActionEvidence[], key: 'selfGain' | 'enemyReduction') => a.reduce((n, v) => n + v[key], 0);
  const playerAdvantage = Math.max(125, base(x.physique * .30 + x.perception * .20 + x.will * .35 + x.knowledge * .15, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, base(22, x.body.enemyHealth, x.body.enemyMind, x.body.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction'));
  const winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100, winner = retreat === 'SUCCESS' ? 'ENEMY' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  let playerHealth = x.playerHealth, playerRisk = x.playerRisk, outcome: BalancerResolution = retreat === 'SUCCESS' ? 'RETREATED' : 'CONTINUE';
  const playerInjuries = structuredClone(x.playerInjuries); let consequenceWeights: SliceCombatRound['consequenceWeights'] = null, consequenceRoll: number | undefined, consequenceDomain: SliceCombatRound['consequenceDomain'];
  if (retreat !== 'SUCCESS') {
    const loser = winner === 'PLAYER' ? 'ENEMY' : 'PLAYER', attacks = loser === 'PLAYER' ? enemies : players, injuries = loser === 'PLAYER' ? playerInjuries : b.enemyInjuries;
    if (attacks.some(a => a.threatens && (a.attackKind === 'BODY' || a.attackKind === 'ARC' || a.attackKind === 'WOUND'))) {
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
  advanceBalancerCombatClock(r, x.root.clockSeconds + 60 - r.root.clockSeconds); const expiredPending = structuredClone([...r.expired, ...r.pending]); r.pending = []; r.opening = null; b.pendingKind = null; b.composureReady = false; if (b.enemyHealth === 0) b.weaponLocation = 'COURT';
  const o: BalancerRoundOutcome = { ...structuredClone(b), targetId: BALANCER_TARGET_ID, round: x.round, source: structuredClone(x), stance, continuing: outcome === 'CONTINUE',
    playerHealthAfter: playerHealth, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, playerInjuriesAfter: playerInjuries, playerRiskAfter: playerRisk, guardPlateAfter: structuredClone(r.guardPlate), masteryAfter: { ...r.mastery },
    rootAfter: structuredClone(r.root), elapsedSeconds: 60, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies, expiredPending };
  const round: SliceCombatRound = { round: x.round, stance, first, playerCount, enemyCount, playerCountRoll, enemyCountRoll,
    moves: [...players, ...enemies].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })),
    playerAdvantage, enemyAdvantage, winChance, winner, consequence: '', consequenceWeights, retreat, ...(consequenceDomain === undefined ? {} : { consequenceDomain }), ...(consequenceRoll === undefined ? {} : { consequenceRoll }),
    balancerOutcome: o };
  round.consequence = balancerCombatConsequence(round); return { round, outcome };
}
export function validateBalancerRoundOutcome(v: unknown): v is BalancerRoundOutcome { try { const o = v as BalancerRoundOutcome; return !!o && same(o, replayBalancerCombatRound(o.source, o.stance).round.balancerOutcome); } catch { return false; } }
export function validateBalancerCombatRound(round: SliceCombatRound): boolean { try { const o = round.balancerOutcome; return !!o && same(round, replayBalancerCombatRound(o.source, o.stance).round); } catch { return false; } }
export function nextBalancerCombatSource(o: BalancerRoundOutcome): BalancerCombatSource {
  return { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter,
    playerSpirituality: Math.min(120, o.playerSpiritualityAfter + 12), playerInjuries: structuredClone(o.playerInjuriesAfter), playerRisk: o.playerRiskAfter,
    root: structuredClone(o.rootAfter), body: combatBody(o), guardPlate: structuredClone(o.guardPlateAfter), mastery: { ...o.masteryAfter }, randomCursor: o.randomCursorAfter };
}
export function balancerCombatConsequence(round: SliceCombatRound): string {
  const o = round.balancerOutcome!, who = round.winner === 'PLAYER' ? '卡斯帕' : '你'; let text = round.retreat === 'SUCCESS' ? '撤离判定成功，沿普通4米出口离开。' : round.consequenceDomain === 'MENTAL' ? `${who}承受实际精神压力，精神减少10，没有新增身体伤口。` : round.consequenceDomain === 'BODY' ? `${who}承受实际身体打击或法术冲击，按共同伤势盘结算。` : '本轮下风没有实际攻击来源，不掷身体伤势盘。';
  if (o.playerHealthAfter === 0) text += '本人的原身体真实死亡，不能复活或离场。'; else if (o.enemyHealth === 0) text += '卡斯帕原身体真实死亡，唯一原杖留地。'; else if (o.enemyStatus === 'SURRENDERED') text += '卡斯帕因实际伤势或精神耗尽自主停止抵抗。';
  return text + ' 本轮实际60秒；未用窗口到期，已花灵性、精神不退。全部原人物与旧记录保持原样。';
}
export function projectBalancerCombat(s: SliceState) {
  const e = s.balancer.encounter, last = s.combat?.encounterId === 'BALANCER_DISPUTE' ? s.combat.lastRound?.balancerOutcome : e.terminal ? s.combatHistory[e.terminal.historyIndex]?.balancerOutcome : null;
  return { enemyName: isBalancer(s) ? '卡斯帕·霍尔特（46岁，序列3施术者）' : '', targetId: e.targetId, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality,
    weaponLocation: e.weaponLocation, pendingKind: e.pendingKind, composureReady: e.composureReady, powerUses: { ...e.powerUses },
    lastActionSequence: last ? [...last.playerActions, ...last.enemyActions].sort((a, b) => a.order - b.order) : [], countWheel: BALANCER_COUNT_WHEEL, enemyCountWheel: BALANCER_ENEMY_COUNT_WHEEL, enemyAbilityWheel: BALANCER_ENEMY_ABILITY_WHEEL,
    guardPlate: structuredClone(s.balancer.life.guardPlate), summary: '失衡感知5灵性、感知20，仅观察已经发生的身体出击破绽，在原30秒窗口内下一次本人身体贡献+25；适度抗衡6灵性1精神、意志20，以同一实持原护板在30秒内对下一次实际身体打击最多减45、磨损15。只在实际使用时获得掌握；精神压力和弧光不受原板抗衡。旧格斗、真实旧伤裁断、震慑与暂剥弧光保留原费用和边界。卡斯帕有独立心智、手杖、屏护与凝神。双方灵性上限120，核心30/20/35/15，普通4米出口开放。' };
}
export type BalancerCombatProjection = ReturnType<typeof projectBalancerCombat>;
