import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import type { BloodDukeOperationState } from '../blood-duke/life.js';
import { CRIMINAL_ABILITY_IDS } from '../criminal/types.js';
import { UNWINGED_ABILITY_IDS } from '../unwinged/types.js';
import { SERIAL_KILLER_ABILITY_IDS } from '../serial-killer/types.js';
import { DEMON_ABILITY_IDS } from '../demon/types.js';
import { DESIRE_APOSTLE_ABILITY_IDS } from '../desire-apostle/types.js';
import { DEVIL_ABILITY_IDS } from '../devil/types.js';
import { BLATHERER_ABILITY_IDS } from '../blatherer/types.js';
import { BLOOD_DUKE_ABILITY_IDS } from '../blood-duke/types.js';
import { validateUncleanMonarchCurrentSite } from './life.js';
import type { UncleanMonarchOriginals, UncleanMonarchSite } from './types.js';
import { UNCLEAN_MONARCH_TARGET_ID, UNCLEAN_MONARCH_SITE, UNCLEAN_MONARCH_POWER_IDS, UNCLEAN_MONARCH_POWERS, UNCLEAN_MONARCH_POLICIES,
  hasUncleanMonarchDisputeOpponent, validateUncleanMonarchPreparation, validUncleanMonarchCombatPiece, validUncleanMonarchPlates,
  uncleanMonarchEncounterBudget, uncleanMonarchFinanceSnapshot, uncleanMonarchApproachedSite,
  type UncleanMonarchPreparation, type UncleanMonarchEnemyIntent, type UncleanMonarchPowerId, type UncleanMonarchPolicy,
  type UncleanMonarchCombatPiece, type UncleanMonarchPlate, type UncleanMonarchForceReceipt,
  type UncleanMonarchEncounterBudget, type UncleanMonarchFinanceSnapshot } from './encounter.js';

export const UNCLEAN_MONARCH_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const UNCLEAN_MONARCH_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const uncleanMonarchActionCount = pyromaniacActionCount;
export const uncleanMonarchEnemyActionCount = pyromaniacActionCount;
const FLAME = 'abyss.s6.flame-hex', BODY = 'BODY_FOLLOWUP', HARDEN = 'abyss.s6.demonic-body', WHISPER = 'abyss.s3.limited-murmur';
const RESTRAINT = 'abyss.s2.self-restraint', OLD_INTERFERENCE = 'abyss.s2.emotion-interference';
export const BINDING = 'abyss.s1.impulse-binding', INTERFERENCE = 'abyss.s1.focused-interference';
const INHERITED_IDS = [...CRIMINAL_ABILITY_IDS, ...UNWINGED_ABILITY_IDS, ...SERIAL_KILLER_ABILITY_IDS, ...DEMON_ABILITY_IDS,
  ...DESIRE_APOSTLE_ABILITY_IDS, ...DEVIL_ABILITY_IDS, ...BLATHERER_ABILITY_IDS, ...BLOOD_DUKE_ABILITY_IDS];
export type UncleanMonarchMoveId = typeof FLAME | typeof BODY | typeof HARDEN | typeof WHISPER | typeof RESTRAINT | typeof OLD_INTERFERENCE | typeof BINDING | typeof INTERFERENCE | 'OBSERVE' | 'ACCIDENT';
/** Keep all six actual S2 relative weights and their stance substitutions; add exactly two finite S1 slots. */
const ABILITIES: readonly { id: UncleanMonarchMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: FLAME, label: '旧火焰3灵性1恶魔负荷；原棍或普通身体回退', weight: 30, stance: 'ATTACK' },
  { id: BODY, label: '旧身体次击29.575×原掌握×当前身体', weight: 15, stance: 'ATTACK' },
  { id: HARDEN, label: '旧硬皮2灵性1恶魔负荷；防守姿态为旧自我约束', weight: 20, stance: 'DEFEND' },
  { id: WHISPER, label: '旧低语4灵性1精神；控制姿态为旧情绪干扰', weight: 20, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '普通观察实际情绪、原棍和开放出口', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差，优势减少22.5', weight: 5, stance: null },
  { id: BINDING, label: '冲动收束8灵性2精神，意志18；20秒内下一次本人普通打击+35', weight: 20, stance: 'PREPARE' },
  { id: INTERFERENCE, label: '定向扰动8灵性2精神，意志18与实际抵抗；20秒内下一可见攻势减30', weight: 20, stance: 'CONTROL' },
];
export const UNCLEAN_MONARCH_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '7灵性及1原刻片，实际身体弧光75；不足普通棍击', weight: 25 },
  { id: 'DREAD_PULSE', label: '7灵性及1原刻片，实际精神压力65；不足普通棍击', weight: 20 },
  { id: 'GUARD', label: '4灵性，随后一次实际攻击减30', weight: 20 },
  { id: 'BODY_STRIKE', label: '自己的唯一原棍20×实际身体', weight: 20 },
  { id: 'CALM_BREATH', label: '3灵性，平复呼吸并遮挡变位，清除待用条件', weight: 10 },
  { id: 'ACCIDENT', label: '实际失衡，0费用0攻势', weight: 5 },
];
export const isUncleanMonarch = (s: SliceState): boolean => s.progression.pathwayId === 'abyss' && s.progression.sequence === 1;
function enabled(id: UncleanMonarchMoveId, p: UncleanMonarchPolicy): boolean {
  if (id === BINDING) return p === 'ALL' || p === 'BINDING';
  if (id === INTERFERENCE) return p === 'ALL' || p === 'INTERFERENCE';
  return true;
}
const tickets = (stance: SliceStance | null, p: UncleanMonarchPolicy) => ABILITIES.map(a => enabled(a.id, p) ? a.weight * (stance !== null && a.stance === stance ? 5 : 4) : 0);
const selectedId = (id: UncleanMonarchMoveId, stance: SliceStance | null): UncleanMonarchMoveId => id === HARDEN && stance === 'DEFEND' ? RESTRAINT : id === WHISPER && stance === 'CONTROL' ? OLD_INTERFERENCE : id;
export function uncleanMonarchAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const p = s.uncleanMonarch.encounter.policy, ws = tickets(stance, p), total = ws.reduce((a, b) => a + b, 0);
  return ABILITIES.flatMap((a, i) => !ws[i] ? [] : [{ id: selectedId(a.id, stance), weight: ws[i]! / total * 100,
    label: p === 'ORDINARY' ? a.id === 'ACCIDENT' ? a.label : '只用本人实际身体、原棍、普通格挡或观察，0超凡费用' : selectedId(a.id, stance) === RESTRAINT ? '旧自我约束6灵性2精神，意志18；随后一次实际身体攻势减30以内' : selectedId(a.id, stance) === OLD_INTERFERENCE ? '旧情绪干扰6灵性2精神，意志18与抵抗；当前强烈情绪才可用' : a.label }]);
}
function drawPlayer(random: ActionRandomStream, stance: SliceStance | null, p: UncleanMonarchPolicy): UncleanMonarchMoveId {
  const ws = tickets(stance, p); let n = random.nextInt(1, ws.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= ws[i]!; if (n <= 0) return selectedId(a.id, stance); }
  throw new Error('能力盘无效。');
}
export function drawUncleanMonarchAbility(random: ActionRandomStream, s: SliceState, stance: SliceStance | null): UncleanMonarchMoveId { return drawPlayer(random, stance, s.uncleanMonarch.encounter.policy); }
export function drawUncleanMonarchEnemyAbility(random: ActionRandomStream): UncleanMonarchEnemyIntent {
  let n = random.nextInt(1, 100); for (const row of UNCLEAN_MONARCH_ENEMY_ABILITY_WHEEL) { n -= row.weight; if (n <= 0) return row.id as UncleanMonarchEnemyIntent; }
  throw new Error('对手盘无效。');
}
/** Harlan's sequence1/core24 are finite parameters for this original encounter,
 * not a claim about canonical universal S1 strength or an invented full pathway. */
export interface UncleanMonarchCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'UNCLEAN_MONARCH_DISPUTE'; targetId: typeof UNCLEAN_MONARCH_TARGET_ID;
  targetName: '哈伦·维斯'; targetAge: 47; targetSequence: 1; targetCore: 24; maxActionCount: 6; attemptWeek: number; startHistoryIndex: number;
  actualBody: true; independentMind: true; enemyWeapon: 'UM1-HARLAN-ROD'; weaponLocation: 'HAND'; yardId: typeof UNCLEAN_MONARCH_SITE;
  playerPosition: 'YARD'; enemyDistanceMetres: 2; ordinaryExit: 'OPEN'; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  playerInjuries: SliceInjury[]; enemyInjuries: SliceInjury[]; playerRisk: number; enemyRisk: number;
  preparation: UncleanMonarchPreparation; site: UncleanMonarchSite; operation: BloodDukeOperationState; originals: UncleanMonarchOriginals;
  strain: number; emotion: 'ANGRY' | 'CALM'; emotionObservedAt: number | null; budget: UncleanMonarchEncounterBudget; finance: UncleanMonarchFinanceSnapshot;
  inheritedMastery: Record<string, number>; mastery: Record<string, number>; clubHeld: boolean; playerClubId: 'town-short-club' | null;
  physique: number; perception: number; knowledge: number; will: number; policy: UncleanMonarchPolicy;
  powerUses: Record<UncleanMonarchPowerId, number>; piece: UncleanMonarchCombatPiece; plates: UncleanMonarchPlate[];
  lastForceReceipt: UncleanMonarchForceReceipt | null; conditionVersion: number; clockSeconds: number; randomSeed: string; randomCursor: number;
}
export interface UncleanMonarchCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean }
interface ActionEvidence extends UncleanMonarchCombatEffect {
  order: number; atSeconds: number; elapsedSeconds: 5; paidCost: number; mindCost: number; physicalFactor: number; rolls: number[];
  randomCursorBefore: number; randomCursorAfter: number; playerHealthAfter: number; playerMindAfter: number; playerSpiritualityAfter: number; enemySpiritualityAfter: number;
  chargeGranted: boolean; chargeConsumedByOrder: number | null; chargeCancelledByOrder: number | null; appliedAmount: number; consumedEffectOrders: number[];
  expiresAt: number | null; receipt: UncleanMonarchForceReceipt | null; conditionVersion: number; pieceChargePaid: number; pieceWearPaid: number; masteryApplied: string[];
}
export interface UncleanMonarchPlayerAction extends ActionEvidence {
  id: UncleanMonarchMoveId; attempted: boolean; succeeded: boolean; applied: boolean; resisted: boolean; mode: string;
  prepared: 'WHISPER' | 'RESTRAINT' | 'OLD_INTERFERENCE' | 'BINDING' | 'INTERFERENCE' | null; travelMetres: number; strainCost: number;
  ownImpulse: { actor: 'PLAYER'; kind: 'RUSH_STRIKE'; observedAt: number; conditionVersion: number } | null;
  emotionEvidence: { targetId: typeof UNCLEAN_MONARCH_TARGET_ID; kind: 'STRONG_ANGER'; observedAt: number; conditionVersion: number; visible: true } | null;
}
export interface UncleanMonarchEnemyAction extends ActionEvidence {
  planned: UncleanMonarchEnemyIntent; actual: UncleanMonarchEnemyIntent | 'OBSERVE'; attackKind: 'NONE' | 'BODY' | 'MENTAL'; plateId: string | null;
  emotionBefore: 'ANGRY' | 'CALM'; emotionAfter: 'ANGRY' | 'CALM'; travelMetres: number; visible: true;
}
interface Runtime {
  playerS: number; playerM: number; playerH: number; enemyS: number; strain: number; emotion: 'ANGRY' | 'CALM'; emotionObservedAt: number | null;
  powers: Record<UncleanMonarchPowerId, number>; clockSeconds: number; site: UncleanMonarchSite; operation: BloodDukeOperationState; mastery: Record<string, number>;
  piece: UncleanMonarchCombatPiece; plates: UncleanMonarchPlate[]; receipt: UncleanMonarchForceReceipt | null; conditionVersion: number;
  restraintAttempted: boolean; interferenceAttempted: boolean; guardAttempted: boolean;
  whisper: UncleanMonarchPlayerAction | null; restraint: UncleanMonarchPlayerAction | null; oldInterference: UncleanMonarchPlayerAction | null;
  guard: UncleanMonarchEnemyAction | null; offensive: UncleanMonarchPlayerAction | null; defensive: UncleanMonarchPlayerAction | null; expiredEffectOrders: number[];
}
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
const none = (label: string): UncleanMonarchCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
const physicalAt = (health: number) => health > 75 ? 1 : health > 50 ? .95 : health > 25 ? .9 : .8;
const masteryFactor = (v: number) => .65 + .35 * v / 500;
export function currentUncleanMonarchCombatSource(s: SliceState): UncleanMonarchCombatSource | null {
  if (!hasUncleanMonarchDisputeOpponent(s)) return null;
  const e = s.uncleanMonarch.encounter, c = s.combat!, stats = s.character.coreStats, originals = s.uncleanMonarch.sourceScene?.originals;
  if (!e.currentSite || !e.preparation || !e.piece || !originals || e.strain === null) return null;
  const playerClubId = s.town.clubLocation === 'HAND' ? 'town-short-club' : null;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'UNCLEAN_MONARCH_DISPUTE', targetId: UNCLEAN_MONARCH_TARGET_ID,
    targetName: '哈伦·维斯', targetAge: 47, targetSequence: 1, targetCore: 24, maxActionCount: 6, attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!,
    actualBody: true, independentMind: true, enemyWeapon: 'UM1-HARLAN-ROD', weaponLocation: 'HAND', yardId: UNCLEAN_MONARCH_SITE, playerPosition: 'YARD',
    enemyDistanceMetres: 2, ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality,
    playerInjuries: structuredClone(s.injuries), enemyInjuries: structuredClone(c.enemyInjuries), playerRisk: s.injuryRisk, enemyRisk: c.enemyRisk,
    preparation: structuredClone(e.preparation), site: structuredClone(e.currentSite), operation: structuredClone(s.uncleanMonarch.life.operation), originals: structuredClone(originals),
    strain: e.strain, emotion: e.emotion, emotionObservedAt: e.emotionObservedAt, budget: uncleanMonarchEncounterBudget(s), finance: uncleanMonarchFinanceSnapshot(s),
    inheritedMastery: Object.fromEntries(INHERITED_IDS.map(id => [id, s.progression.mastery[id]!])), mastery: { ...s.progression.mastery }, clubHeld: playerClubId !== null, playerClubId,
    physique: stats.physique, perception: stats.perception, knowledge: stats.knowledge, will: stats.will, policy: e.policy, powerUses: { ...e.powerUses },
    piece: structuredClone(e.piece), plates: structuredClone(e.plates), lastForceReceipt: structuredClone(e.lastForceReceipt), conditionVersion: e.conditionVersion,
    clockSeconds: e.currentSite.clockSeconds, randomSeed: s.random.seed, randomCursor: s.random.cursor };
}
function makeRuntime(x: UncleanMonarchCombatSource): Runtime {
  return { playerS: x.playerSpirituality, playerM: x.playerMind, playerH: x.playerHealth, enemyS: x.enemySpirituality, strain: x.strain, emotion: x.emotion, emotionObservedAt: x.emotionObservedAt,
    powers: { ...x.powerUses }, clockSeconds: x.clockSeconds, site: structuredClone(x.site), operation: structuredClone(x.operation), mastery: { ...x.mastery },
    piece: structuredClone(x.piece), plates: structuredClone(x.plates), receipt: structuredClone(x.lastForceReceipt), conditionVersion: x.conditionVersion,
    restraintAttempted: false, interferenceAttempted: false, guardAttempted: false, whisper: null, restraint: null, oldInterference: null, guard: null, offensive: null, defensive: null, expiredEffectOrders: [] };
}
function actionBase(r: Runtime, order: number, physical: number, cursor: number): ActionEvidence {
  return { ...none(''), order, atSeconds: r.clockSeconds, elapsedSeconds: 5, paidCost: 0, mindCost: 0, physicalFactor: physical, rolls: [], randomCursorBefore: cursor, randomCursorAfter: cursor,
    playerHealthAfter: r.playerH, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, enemySpiritualityAfter: r.enemyS,
    chargeGranted: false, chargeConsumedByOrder: null, chargeCancelledByOrder: null, appliedAmount: 0, consumedEffectOrders: [], expiresAt: null, receipt: null,
    conditionVersion: r.conditionVersion, pieceChargePaid: 0, pieceWearPaid: 0, masteryApplied: [] };
}
function expire(r: Runtime): void {
  for (const key of ['offensive', 'defensive'] as const) {
    const effect = r[key]; if (effect && (effect.expiresAt! <= r.clockSeconds || effect.conditionVersion !== r.conditionVersion)) {
      r.expiredEffectOrders.push(effect.order); effect.label += ' 20秒到期或现场条件变化，未用窗口失效，费用不退。'; r[key] = null;
    }
  }
}
function closeAction<T extends ActionEvidence>(a: T, r: Runtime, random: ActionRandomStream): T {
  r.clockSeconds += 5; r.site.clockSeconds = r.clockSeconds; a.randomCursorAfter = random.cursor; a.playerHealthAfter = r.playerH; a.playerMindAfter = r.playerM; a.playerSpiritualityAfter = r.playerS; a.enemySpiritualityAfter = r.enemyS;
  a.label += ` 本动作5秒；你余${r.playerS}灵性、${r.playerM}精神，对手余${r.enemyS}灵性。`; return a;
}
function consume(effect: UncleanMonarchPlayerAction | UncleanMonarchEnemyAction, a: ActionEvidence, amount: number, cancelled = false): void {
  a.consumedEffectOrders.push(effect.order);
  if (cancelled) { effect.chargeCancelledByOrder = a.order; effect.label += ` 第${a.order + 1}动作令窗口失效，费用不退。`; }
  else { effect.chargeConsumedByOrder = a.order; effect.appliedAmount = amount; if ('applied' in effect) effect.applied = amount > 0; effect.label += ` 第${a.order + 1}动作实际应用${amount}，只用一次。`; }
}
function useNewWindow(r: Runtime, effect: UncleanMonarchPlayerAction, a: ActionEvidence, amount: number): void {
  consume(effect, a, amount); r.piece.charges--; r.piece.wear++; a.pieceChargePaid++; a.pieceWearPaid++;
  effect.masteryApplied.push(effect.id); r.mastery[effect.id] = Math.min(500, r.mastery[effect.id]! + 8);
}
function applyAttackWindows(r: Runtime, a: UncleanMonarchPlayerAction): void {
  if (!a.threatens) return;
  if (r.offensive && ['ORDINARY', 'ORIGINAL_CLUB', 'ORDINARY_FALLBACK', 'INHERITED_BODY'].includes(a.mode) && r.piece.charges > 0) {
    useNewWindow(r, r.offensive, a, 35); a.selfGain += 35; r.offensive = null;
    a.label += ' 收束本人冲动后，本次普通打击增加35；同一辅助片实际耗1次、磨损1。';
  }
  if (r.guard) { const amount = Math.min(30, a.selfGain); consume(r.guard, a, amount); a.selfGain -= amount; r.guard = null; }
  a.threatens = a.selfGain > 0; a.applied = a.threatens; a.appliedAmount = a.selfGain;
}
function playerAction(x: UncleanMonarchCombatSource, r: Runtime, _stance: SliceStance, id: UncleanMonarchMoveId, physical: number, order: number, random: ActionRandomStream): UncleanMonarchPlayerAction {
  expire(r);
  const a: UncleanMonarchPlayerAction = { ...actionBase(r, order, physical, random.cursor), id, attempted: false, succeeded: false, applied: false, resisted: false,
    mode: 'ORDINARY', prepared: null, travelMetres: 0, strainCost: 0, ownImpulse: null, emotionEvidence: null };
  const check = (ability: 'knowledge' | 'will', difficulty: number) => { const roll = random.nextInt(1, 100); a.rolls.push(roll); return roll <= computeCheckChance({ ability, baseAbility: x[ability], difficulty, modifiers: [] }); };
  if (id === BINDING || id === INTERFERENCE) {
    const binding = id === BINDING;
    if (r.offensive || r.defensive) { a.mode = 'ALREADY_PREPARED'; a.label = '已有本人的单一待用窗口，不并行、不重施、不重复收费。'; }
    else if (!binding && (r.emotion !== 'ANGRY' || r.emotionObservedAt === null)) { a.mode = 'ORDINARY_FALLBACK'; a.label = '哈伦已平复或缺少本人刚确认的可见强烈情绪，只普通观察，不凭空制造目标情绪。'; }
    else if (r.piece.charges === 0 || r.playerS < 8 || r.playerM < 4) { a.mode = 'ORDINARY_FALLBACK'; a.label = '同一辅助片次数或真实资源不足，只普通复核，不空扣费用。'; }
    else {
      if (binding) a.ownImpulse = { actor: 'PLAYER', kind: 'RUSH_STRIKE', observedAt: r.clockSeconds, conditionVersion: r.conditionVersion };
      else a.emotionEvidence = { targetId: x.targetId, kind: 'STRONG_ANGER', observedAt: r.emotionObservedAt!, conditionVersion: r.conditionVersion, visible: true };
      a.attempted = true; a.paidCost = 8; a.mindCost = 2; r.playerS -= 8; r.playerM -= 2;
      const passed = check('will', 18);
      if (!binding && passed) { const resistance = random.nextInt(1, 100); a.rolls.push(resistance); a.resisted = resistance <= 35; }
      a.succeeded = passed && !a.resisted;
      if (a.succeeded) { a.mode = 'PREPARED'; a.chargeGranted = true; a.prepared = binding ? 'BINDING' : 'INTERFERENCE'; a.expiresAt = r.clockSeconds + 20; if (binding) r.offensive = a; else r.defensive = a; }
      else { a.mode = a.resisted ? 'RESISTED' : 'FAILED'; a.mindCost += 2; r.playerM -= 2; }
      a.label = `${binding ? '本人察觉面对持棍威胁急于前冲的实际冲动并收束动作' : '只干扰刚看见的哈伦强烈愤怒，哈伦实际进行抵抗'}；实付8灵性${a.mindCost}精神，${a.succeeded ? binding ? '准备20秒内下一次本人普通打击+35，尚未应用' : '准备20秒内下一次可见身体或精神攻势减30以内，尚未应用' : a.resisted ? '对方抵抗成功，无效果，费用不退' : '意志检定失败，无效果，费用不退'}。不控制血液或改写思想。`;
    }
  } else if (id === 'ACCIDENT') { a.selfGain = -22.5; a.label = '实际动作偏差，优势减少22.5，不重抽。'; }
  else if (x.policy === 'ORDINARY') {
    if (id === FLAME || id === BODY) { a.selfGain = (x.clubHeld ? 16 : 12) * physical; a.threatens = a.selfGain > 0; a.travelMetres = 4; r.site.playerTravelMetres += 4; a.label = `本人靠近2米，以${x.clubHeld ? '自己持握的原短棍' : '普通身体'}攻击后退回2米，0灵性0精神。`; applyAttackWindows(r, a); }
    else if (id === HARDEN || id === RESTRAINT) { a.enemyReduction = 10 * physical; a.applied = true; a.appliedAmount = a.enemyReduction; a.label = '本人作普通格挡，0灵性0精神，无新增恶魔负荷。'; }
    else { a.label = '只作普通观察，0灵性0精神，不发动旧低语或情绪方法。'; }
  } else if (id === BODY) {
    a.selfGain = 29.575 * masteryFactor(x.inheritedMastery[HARDEN]!) * physical; a.threatens = a.selfGain > 0;
    a.travelMetres = 4; r.site.playerTravelMetres += 4; a.mode = 'INHERITED_BODY'; a.label = '本人靠近2米，以原有身体能力攻击，再退回2米。'; applyAttackWindows(r, a);
  } else if (id === FLAME || id === HARDEN) {
    const flame = id === FLAME, cost = flame ? 3 : 2; let value: number;
    if (flame && x.clubHeld) { a.mode = 'ORIGINAL_CLUB'; value = 16 * physical; a.label = '本人以自己持握的原短棍攻击，替换本槽火焰，无灵性消耗与新增负荷。'; a.travelMetres = 4; r.site.playerTravelMetres += 4; }
    else if (r.strain < 3 && r.playerS >= cost) { a.paidCost = cost; r.playerS -= cost; a.strainCost = 1; r.strain++; a.mode = 'INHERITED_POWER'; value = (flame ? 60 : 50.7 * physical) * masteryFactor(x.inheritedMastery[id]!); a.label = `实付${cost}灵性与1恶魔负荷，使用旧${flame ? '火焰' : '硬皮'}；当前负荷${r.strain}/3。`; }
    else { a.mode = 'ORDINARY_FALLBACK'; value = (flame ? 12 : 10) * physical; a.label = `灵性不足或恶魔负荷已满，改用普通${flame ? '身体攻击' : '格挡'}，不重置负荷。`; if (flame) { a.travelMetres = 4; r.site.playerTravelMetres += 4; } }
    a.selfGain = flame ? value : 0; a.enemyReduction = flame ? 0 : value; a.threatens = flame && value > 0; if (flame) applyAttackWindows(r, a); else { a.applied = value > 0; a.appliedAmount = value; }
  } else if (id === WHISPER) {
    if (r.playerS < 4 || r.playerM <= 1) { a.mode = 'LOW_RESOURCE'; a.label = '灵性不足4或精神不足以承担1，普通观察，无消耗。'; }
    else { a.attempted = true; a.paidCost = 4; a.mindCost = 1; r.playerS -= 4; r.playerM--; a.succeeded = check('knowledge', 18); a.mode = a.succeeded ? 'PREPARED' : 'FAILED';
      if (a.succeeded) { if (r.whisper) consume(r.whisper, a, 0, true); a.prepared = 'WHISPER'; a.chargeGranted = true; r.whisper = a; }
      a.label = `旧低语实付4灵性、1精神；${a.succeeded ? '准备使随后一次正身体攻势减半' : '检定失败，未形成效果，费用保留'}。`; }
  } else if (id === RESTRAINT || id === OLD_INTERFERENCE) {
    const restraint = id === RESTRAINT, attempted = restraint ? r.restraintAttempted : r.interferenceAttempted;
    if (attempted) { a.mode = 'ALREADY_ATTEMPTED'; a.label = '本轮已经尝试过这项旧能力，普通观察，不再次收费。'; }
    else if (!restraint && (r.emotion !== 'ANGRY' || r.emotionObservedAt === null)) { a.mode = 'NO_STRONG_EMOTION'; a.label = '哈伦已平复，缺少当前已观察的强烈情绪，不能凭空制造情绪或发动干扰。'; }
    else if (r.playerS < 6 || r.playerM <= 2) { a.mode = 'LOW_RESOURCE'; a.label = '实际灵性不足6或精神不足以承担2，普通观察，无消耗。'; }
    else {
      a.attempted = true; a.paidCost = 6; a.mindCost = 2; r.playerS -= 6; r.playerM -= 2;
      if (restraint) r.restraintAttempted = true; else r.interferenceAttempted = true;
      const passed = check('will', 18);
      if (!restraint && passed) { const resistance = random.nextInt(1, 100); a.rolls.push(resistance); a.resisted = resistance <= 35; }
      a.succeeded = passed && !a.resisted; a.mode = a.succeeded ? 'PREPARED' : a.resisted ? 'RESISTED' : 'FAILED';
      if (a.succeeded) { a.chargeGranted = true; a.prepared = restraint ? 'RESTRAINT' : 'OLD_INTERFERENCE'; if (restraint) r.restraint = a; else r.oldInterference = a; }
      a.label = `${restraint ? '面对近处持棍威胁，约束急于前冲的动作并保持防守节奏' : '对当前愤怒作旧有限情绪干扰'}实付6灵性、2精神；${a.succeeded ? `只准备随后一次实际正身体攻势减弱至多${restraint ? 30 : 25}` : a.resisted ? '对方抵抗成功，未产生效果' : '检定失败，未产生效果'}。费用不退，不支配意志或血液。`;
    }
  } else { a.mode = 'OBSERVE'; a.label = `普通观察：哈伦${r.emotion === 'ANGRY' ? '仍然明显愤怒' : '已经平复情绪'}，诺拉与罗安已在室外，普通出口开放。`; }
  return closeAction(a, r, random);
}
function enemyAction(x: UncleanMonarchCombatSource, r: Runtime, planned: UncleanMonarchEnemyIntent, physical: number, order: number, random: ActionRandomStream): UncleanMonarchEnemyAction {
  expire(r);
  const a: UncleanMonarchEnemyAction = { ...actionBase(r, order, physical, random.cursor), planned, actual: planned, attackKind: 'NONE', plateId: null, emotionBefore: r.emotion, emotionAfter: r.emotion, travelMetres: 0, visible: true };
  const power = UNCLEAN_MONARCH_POWERS.find(p => p.id === planned), plate = r.plates.find(p => p.status === 'HELD');
  if (planned === 'GUARD' && r.guardAttempted) a.actual = 'OBSERVE';
  else if (power && (r.enemyS < power.cost || ['ARC_BOLT', 'DREAD_PULSE'].includes(planned) && !plate)) a.actual = 'BODY_STRIKE';
  if (a.actual === 'ARC_BOLT' || a.actual === 'DREAD_PULSE' || a.actual === 'BODY_STRIKE') {
    const mental = a.actual === 'DREAD_PULSE'; let raw = a.actual === 'ARC_BOLT' ? 75 : mental ? 65 : 20 * physical; a.attackKind = mental ? 'MENTAL' : 'BODY';
    if (a.actual !== 'BODY_STRIKE') {
      r.enemyS -= 7; r.powers[a.actual]++; a.paidCost = 7; plate!.status = 'SPENT'; plate!.usedRound = x.round; plate!.usedOrder = order; a.plateId = plate!.id;
      r.receipt = { id: `${plate!.id}:spent:${x.round}:${order}`, targetId: x.targetId, power: a.actual, kind: mental ? 'MENTAL' : 'BODY', plateId: plate!.id, paidCost: 7, round: x.round, order, atSeconds: r.clockSeconds, position: 'YARD', visible: true, conditionVersion: r.conditionVersion };
      a.receipt = structuredClone(r.receipt); a.label = `哈伦实付7灵性并耗掉${plate!.id}，实际${mental ? '精神压力65' : '身体弧光75'}。`;
    } else { a.travelMetres = 4; a.label = `${planned !== 'BODY_STRIKE' ? '自己的灵性或有限刻片不足，普通回退；' : ''}哈伦亲自靠近2米，以自己的唯一原棍攻击20×实际身体，再退回2米。`; }
    if (!mental && raw > 0 && r.whisper) { const amount = raw * .5; consume(r.whisper, a, amount); raw -= amount; r.whisper = null; }
    if (!mental && raw > 0 && r.oldInterference) { const amount = Math.min(25, raw); consume(r.oldInterference, a, amount); raw -= amount; r.oldInterference = null; }
    if (!mental && raw > 0 && r.restraint) { const amount = Math.min(30, raw); consume(r.restraint, a, amount); raw -= amount; r.restraint = null; }
    if (raw > 0 && r.defensive && r.piece.charges > 0 && r.emotion === 'ANGRY' && r.emotionObservedAt !== null) {
      const amount = Math.min(30, raw); useNewWindow(r, r.defensive, a, amount); raw -= amount; r.defensive = null; a.label += ' 定向扰动只削弱这一次当前可见攻势，同一辅助片实耗1次、磨损1。';
    }
    a.selfGain = raw; a.appliedAmount = raw; a.threatens = !mental && raw > 0; a.mentalPressure = mental && raw > 0;
  } else if (a.actual === 'GUARD') { r.enemyS -= 4; r.powers.GUARD++; r.guardAttempted = true; a.paidCost = 4; a.chargeGranted = true; r.guard = a; a.label = '哈伦实付4灵性，屏护随后一次实际攻击至多30，未受击时实际吸收0。'; }
  else if (a.actual === 'CALM_BREATH') {
    r.enemyS -= 3; r.powers.CALM_BREATH++; a.paidCost = 3; r.conditionVersion++; r.emotion = 'CALM'; r.emotionObservedAt = null; a.emotionAfter = 'CALM'; a.travelMetres = 2;
    for (const key of ['whisper', 'oldInterference', 'offensive', 'defensive'] as const) { if (r[key]) { consume(r[key]!, a, 0, true); r[key] = null; } }
    a.label = '哈伦实付3灵性，亲自平复呼吸，横棍遮挡并侧移1米后复位1米；可见强烈情绪与先前现场条件中断，未用窗口失效，费用不退。';
  } else if (a.actual === 'OBSERVE') a.label = '本轮已尝试屏护，只普通观察，0费用。';
  else a.label = '对手实际失衡，0费用0攻势，不重抽。';
  return closeAction(a, r, random);
}

export function validUncleanMonarchInjuries(v: SliceInjury[], revision: number): boolean {
  return Array.isArray(v) && new Set(v.map(i => i.id)).size === v.length && v.every(i => shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 && ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision, 1, revision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision, revision)));
}
export const UNCLEAN_MONARCH_SOURCE_KEYS = ['runId', 'revision', 'week', 'round', 'encounterId', 'targetId', 'targetName', 'targetAge', 'targetSequence', 'targetCore', 'maxActionCount', 'attemptWeek', 'startHistoryIndex', 'actualBody', 'independentMind', 'enemyWeapon', 'weaponLocation', 'yardId', 'playerPosition', 'enemyDistanceMetres', 'ordinaryExit', 'pursuit', 'thirdPartiesInArea', 'automaticAllyImmunity', 'playerHealth', 'playerMind', 'playerSpirituality', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'playerInjuries', 'enemyInjuries', 'playerRisk', 'enemyRisk', 'preparation', 'site', 'operation', 'originals', 'strain', 'emotion', 'emotionObservedAt', 'budget', 'finance', 'inheritedMastery', 'mastery', 'clubHeld', 'playerClubId', 'physique', 'perception', 'knowledge', 'will', 'policy', 'powerUses', 'piece', 'plates', 'lastForceReceipt', 'conditionVersion', 'clockSeconds', 'randomSeed', 'randomCursor'] as const;
export function validUncleanMonarchCombatSource(x: UncleanMonarchCombatSource): boolean { try {
  const p = x.site, prep = x.preparation, b = x.budget;
  if (!shape(x, UNCLEAN_MONARCH_SOURCE_KEYS) || typeof x.runId !== 'string' || !x.runId || !integer(x.revision, 1) || !integer(x.week, 1) || !integer(x.round, 1) || !integer(x.startHistoryIndex) || x.attemptWeek !== x.week ||
    x.encounterId !== 'UNCLEAN_MONARCH_DISPUTE' || x.targetId !== UNCLEAN_MONARCH_TARGET_ID || x.targetName !== '哈伦·维斯' || x.targetAge !== 47 || x.targetSequence !== 1 || x.targetCore !== 24 || x.maxActionCount !== 6 || !x.actualBody || !x.independentMind || x.enemyWeapon !== 'UM1-HARLAN-ROD' || x.weaponLocation !== 'HAND' || x.yardId !== UNCLEAN_MONARCH_SITE || x.playerPosition !== 'YARD' || x.enemyDistanceMetres !== 2 || x.ordinaryExit !== 'OPEN' || x.pursuit !== false || x.thirdPartiesInArea !== 0 || x.automaticAllyImmunity !== false) return false;
  if (![x.playerHealth, x.playerMind, x.enemyHealth, x.enemyMind].every(n => integer(n, 1, 100)) || ![x.playerSpirituality, x.enemySpirituality].every(n => integer(n, 0, 120)) || !validateUncleanMonarchCurrentSite(p, x.originals) || p.playerLocation !== 'YARD' || p.volunteer.location !== 'OUTSIDE' || !p.volunteer.alive || p.card.location !== 'NORA' || p.guide.location !== 'OUTSIDE' || p.clockSeconds !== x.clockSeconds) return false;
  if (!validateUncleanMonarchPreparation(prep) || prep.runId !== x.runId || prep.randomSeed !== x.randomSeed || prep.randomCursor > x.randomCursor || prep.revision >= x.revision || prep.week !== x.week || x.clockSeconds !== prep.lifeClockSeconds + 12 + 60 * (x.round - 1) || !same(x.originals, prep.originals) || !same(x.finance, prep.finance) || !same(x.operation, prep.operation)) return false;
  const expectedSite = uncleanMonarchApproachedSite(prep.site, x.originals); expectedSite.clockSeconds = p.clockSeconds; expectedSite.playerTravelMetres = p.playerTravelMetres;
  if (!same(p, expectedSite) || !integer(p.playerTravelMetres, prep.site.playerTravelMetres + 4) || (p.playerTravelMetres - prep.site.playerTravelMetres - 4) % 4 !== 0 || !integer(x.strain, prep.strain, 3)) return false;
  if (!same({ ...b, health: prep.after.health, mind: prep.after.mind, spirituality: prep.after.spirituality, mastery: prep.after.mastery, injuries: prep.after.injuries, injuryRisk: prep.after.injuryRisk }, { ...prep.after, actions: prep.after.actions - 1 })) return false;
  if (!shape(x.inheritedMastery, INHERITED_IDS) || !INHERITED_IDS.every(id => integer(x.inheritedMastery[id], 0, 500) && x.inheritedMastery[id] === x.mastery[id] && x.mastery[id] === prep.after.mastery[id]) || !shape(x.mastery, [...INHERITED_IDS, BINDING, INTERFERENCE]) || !integer(x.mastery[BINDING], 0, 500) || !integer(x.mastery[INTERFERENCE], 0, 500)) return false;
  if (!same(b.mastery, x.mastery) || b.health !== x.playerHealth || b.mind !== x.playerMind || b.spirituality !== x.playerSpirituality || b.injuryRisk !== x.playerRisk || !same(b.injuries, x.playerInjuries) || b.sequence !== 1 || !same(b.coreStats, { physique: x.physique, perception: x.perception, will: x.will, knowledge: x.knowledge })) return false;
  if (!['town-short-club', null].includes(x.playerClubId) || x.clubHeld !== (x.playerClubId !== null) || ![x.physique, x.perception, x.will, x.knowledge].every(n => integer(n, 0, 500)) || !UNCLEAN_MONARCH_POLICIES.includes(x.policy) || !integer(x.playerRisk) || !integer(x.enemyRisk) || !validUncleanMonarchInjuries(x.playerInjuries, x.revision) || !validUncleanMonarchInjuries(x.enemyInjuries, x.revision)) return false;
  if (!shape(x.powerUses, UNCLEAN_MONARCH_POWER_IDS) || !UNCLEAN_MONARCH_POWER_IDS.every(id => integer(x.powerUses[id])) || x.powerUses.GUARD > x.round - 1 || x.powerUses.CALM_BREATH > 6 * (x.round - 1) || x.powerUses.ARC_BOLT + x.powerUses.DREAD_PULSE > 3 || x.enemySpirituality !== 120 - UNCLEAN_MONARCH_POWERS.reduce((n, p) => n + p.cost * x.powerUses[p.id], 0) || !x.piece || !validUncleanMonarchCombatPiece(x.piece) || !validUncleanMonarchPlates(x.plates) || x.plates.filter(p => p.status === 'SPENT').length !== x.powerUses.ARC_BOLT + x.powerUses.DREAD_PULSE || x.plates.some(p => p.usedRound !== null && p.usedRound >= x.round) || x.conditionVersion !== 1 + x.powerUses.CALM_BREATH) return false;
  if (x.emotion !== (x.powerUses.CALM_BREATH ? 'CALM' : 'ANGRY') || x.emotionObservedAt !== (x.powerUses.CALM_BREATH ? null : prep.lifeClockSeconds + 12)) return false;
  if (x.lastForceReceipt) {
    const receipt = x.lastForceReceipt;
    if (!shape(receipt, ['id', 'targetId', 'power', 'kind', 'plateId', 'paidCost', 'round', 'order', 'atSeconds', 'position', 'visible', 'conditionVersion']) || receipt.targetId !== x.targetId || !['ARC_BOLT', 'DREAD_PULSE'].includes(receipt.power) || receipt.kind !== (receipt.power === 'ARC_BOLT' ? 'BODY' : 'MENTAL') || receipt.paidCost !== 7 || !integer(receipt.round, 1, x.round - 1) || !integer(receipt.order, 0, 11) || receipt.atSeconds !== prep.lifeClockSeconds + 12 + (receipt.round - 1) * 60 + receipt.order * 5 || receipt.position !== 'YARD' || receipt.visible !== true || !integer(receipt.conditionVersion, 1, x.conditionVersion) || !x.plates.some(p => p.id === receipt.plateId && p.usedRound === receipt.round && p.usedOrder === receipt.order) || receipt.id !== `${receipt.plateId}:spent:${receipt.round}:${receipt.order}`) return false;
  } else if (x.plates.some(p => p.status === 'SPENT')) return false;
  return typeof x.randomSeed === 'string' && x.randomSeed.length > 0 && x.randomSeed.length <= 256 && integer(x.randomCursor);
} catch { return false; } }
export const validateUncleanMonarchCombatSource = validUncleanMonarchCombatSource;
export type UncleanMonarchResolution = 'CONTINUE' | 'PLAYER_DEAD' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED' | 'RETREATED';
export interface UncleanMonarchRoundOutcome {
  targetId: typeof UNCLEAN_MONARCH_TARGET_ID; round: number; source: UncleanMonarchCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number;
  playerInjuriesAfter: SliceInjury[]; enemyInjuriesAfter: SliceInjury[]; playerRiskAfter: number; enemyRiskAfter: number;
  powerUses: Record<UncleanMonarchPowerId, number>; restraintAttempted: boolean; interferenceAttempted: boolean; guardAttempted: boolean; expiredEffectOrders: number[];
  siteAfter: UncleanMonarchSite; operationAfter: BloodDukeOperationState; strainAfter: number; emotion: 'ANGRY' | 'CALM'; emotionObservedAt: number | null;
  masteryAfter: Record<string, number>; pieceAfter: UncleanMonarchCombatPiece; platesAfter: UncleanMonarchPlate[]; lastForceReceipt: UncleanMonarchForceReceipt | null;
  conditionVersion: number; clockSecondsAfter: number; elapsedSeconds: 60; randomCursorAfter: number; playerActions: UncleanMonarchPlayerAction[]; enemyActions: UncleanMonarchEnemyAction[];
}
function penalty(current: number, maximum: number) { const factor = Math.max(0, Math.min(1, current / maximum)); return factor > .75 ? 0 : factor > .5 ? .05 : factor > .25 ? .1 : .2; }
function base(core: number, health: number, mind: number, spirituality: number) { return (1500 + Math.min(core, 300)) * (1 - Math.min(.4, penalty(health, 100) + penalty(mind, 100) + penalty(spirituality, 120))); }
function weights(risk: number) { const death = Math.min(100, 5 + Math.min(risk, 10) * 10), shifted = death - 5; return { light: Math.max(0, 65 - shifted), heavy: Math.max(0, 30 - Math.max(0, shifted - 65)), death }; }
export function replayUncleanMonarchCombatRound(x: UncleanMonarchCombatSource, stance: SliceStance): { round: SliceCombatRound; outcome: UncleanMonarchResolution } {
  if (!validUncleanMonarchCombatSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new Error('缺少真实哈伦、有限辅助片与刻片、当前情绪和连续身体来源。');
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = makeRuntime(x);
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = uncleanMonarchActionCount(playerCountRoll), enemyCount = uncleanMonarchEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const, remaining = { PLAYER: playerCount, ENEMY: enemyCount };
  const players: UncleanMonarchPlayerAction[] = [], enemies: UncleanMonarchEnemyAction[] = []; let retreat: SliceCombatRound['retreat'] = 'NONE';
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) {
    for (const actor of order) {
      if (!remaining[actor]) continue;
      if (actor === 'PLAYER' && stance === 'RETREAT') { remaining.PLAYER = 0; retreat = rng.nextInt(1, 100) <= 50 ? 'SUCCESS' : 'FAILURE'; if (retreat === 'SUCCESS') { remaining.ENEMY = 0; break; } continue; }
      remaining[actor]--;
      if (actor === 'PLAYER') players.push(playerAction(x, r, stance, drawPlayer(rng, stance, x.policy), physicalAt(r.playerH), players.length + enemies.length, rng));
      else enemies.push(enemyAction(x, r, drawUncleanMonarchEnemyAbility(rng), physicalAt(x.enemyHealth), players.length + enemies.length, rng));
    }
  }
  const sum = (actions: UncleanMonarchCombatEffect[], key: 'selfGain' | 'enemyReduction') => actions.reduce((n, a) => n + a[key], 0);
  const playerAdvantage = Math.max(150, base(x.physique * .35 + x.perception * .30 + x.will * .15 + x.knowledge * .20, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(150, base(x.targetCore, x.enemyHealth, x.enemyMind, x.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction'));
  const winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100;
  const winner = retreat === 'SUCCESS' ? 'ENEMY' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  let playerHealth = r.playerH, enemyHealth = x.enemyHealth, enemyMind = x.enemyMind, playerRisk = x.playerRisk, enemyRisk = x.enemyRisk;
  let enemyStatus: UncleanMonarchRoundOutcome['enemyStatus'] = 'RESISTING', outcome: UncleanMonarchResolution = retreat === 'SUCCESS' ? 'RETREATED' : 'CONTINUE';
  const playerInjuries = structuredClone(x.playerInjuries), enemyInjuries = structuredClone(x.enemyInjuries);
  let consequenceWeights: SliceCombatRound['consequenceWeights'] = null, consequenceRoll: number | undefined, consequenceDomain: SliceCombatRound['consequenceDomain'];
  if (retreat !== 'SUCCESS') {
    const loser = winner === 'PLAYER' ? 'ENEMY' : 'PLAYER', attacks = loser === 'PLAYER' ? enemies : players, injuries = loser === 'PLAYER' ? playerInjuries : enemyInjuries;
    if (attacks.some(a => a.threatens)) {
      let risk = loser === 'PLAYER' ? playerRisk : enemyRisk; if (injuries.length) risk++; if (loser === 'PLAYER') playerRisk = risk; else enemyRisk = risk;
      consequenceDomain = 'BODY'; consequenceWeights = weights(risk); consequenceRoll = rng.nextInt(1, 100);
      const severity = consequenceRoll <= consequenceWeights.light ? 'LIGHT' : consequenceRoll <= consequenceWeights.light + consequenceWeights.heavy ? 'HEAVY' : 'DEATH';
      if (severity === 'DEATH') { if (loser === 'PLAYER') playerHealth = 0; else { enemyHealth = 0; enemyStatus = 'DEAD'; } }
      else {
        injuries.push({ id: `${x.runId}:combat:${x.round}:${loser}:${x.revision + 1}:${injuries.length}`, severity, acquiredRevision: x.revision + 1, treatedRevision: null });
        const damage = severity === 'LIGHT' ? 10 : 30; if (loser === 'PLAYER') playerHealth = Math.max(0, playerHealth - damage); else enemyHealth = Math.max(0, enemyHealth - damage);
        if (enemyHealth === 0) enemyStatus = 'DEAD'; else if (loser === 'ENEMY' && severity === 'HEAVY') enemyStatus = 'SURRENDERED';
      }
    } else if (attacks.some(a => a.mentalPressure)) {
      consequenceDomain = 'MENTAL'; if (loser === 'PLAYER') r.playerM = Math.max(0, r.playerM - 10); else { enemyMind = Math.max(0, enemyMind - 10); if (enemyMind === 0) enemyStatus = 'SURRENDERED'; }
    }
    if (playerHealth === 0) outcome = 'PLAYER_DEAD'; else if (enemyHealth === 0) outcome = 'ENEMY_DEAD'; else if (enemyStatus === 'SURRENDERED') outcome = 'ENEMY_SURRENDERED'; else if (r.playerM === 0) outcome = 'RETREATED';
  }
  const pending = [r.whisper, r.restraint, r.oldInterference, r.guard, r.offensive, r.defensive].filter((a): a is UncleanMonarchPlayerAction | UncleanMonarchEnemyAction => a !== null).map(a => a.order);
  r.site.clockSeconds = x.clockSeconds + 60;
  const o: UncleanMonarchRoundOutcome = { targetId: x.targetId, round: x.round, source: structuredClone(x), stance, continuing: outcome === 'CONTINUE', enemyHealth, enemyMind, enemySpirituality: r.enemyS, enemyStatus,
    playerSpiritualityBefore: x.playerSpirituality, playerSpiritualityAfter: r.playerS, playerHealthAfter: playerHealth, playerMindAfter: r.playerM, enemySpiritualityBefore: x.enemySpirituality,
    playerInjuriesAfter: playerInjuries, enemyInjuriesAfter: enemyInjuries, playerRiskAfter: playerRisk, enemyRiskAfter: enemyRisk, powerUses: { ...r.powers },
    restraintAttempted: r.restraintAttempted, interferenceAttempted: r.interferenceAttempted, guardAttempted: r.guardAttempted,
    expiredEffectOrders: [...r.expiredEffectOrders, ...pending].sort((a, b) => a - b), siteAfter: structuredClone(r.site), operationAfter: structuredClone(r.operation),
    strainAfter: r.strain, emotion: r.emotion, emotionObservedAt: r.emotionObservedAt, masteryAfter: { ...r.mastery }, pieceAfter: structuredClone(r.piece), platesAfter: structuredClone(r.plates),
    lastForceReceipt: structuredClone(r.receipt), conditionVersion: r.conditionVersion, clockSecondsAfter: r.site.clockSeconds, elapsedSeconds: 60, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies };
  const round: SliceCombatRound = { round: x.round, stance, first, playerCount, enemyCount, playerCountRoll, enemyCountRoll,
    moves: [...players.map(a => ({ ...a, actor: 'PLAYER' as const })), ...enemies.map(a => ({ ...a, actor: 'ENEMY' as const }))].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })),
    playerAdvantage, enemyAdvantage, winChance, winner, consequence: '', consequenceWeights, retreat,
    ...(consequenceDomain ? { consequenceDomain } : {}), ...(consequenceRoll === undefined ? {} : { consequenceRoll }), uncleanMonarchOutcome: o };
  round.consequence = uncleanMonarchCombatConsequence(round); return { round, outcome };
}
export function validateUncleanMonarchRoundOutcome(v: unknown): v is UncleanMonarchRoundOutcome { try { const o = v as UncleanMonarchRoundOutcome; return same(o, replayUncleanMonarchCombatRound(o.source, o.stance).round.uncleanMonarchOutcome); } catch { return false; } }
export function validateUncleanMonarchCombatRound(round: SliceCombatRound): boolean { try { const o = round.uncleanMonarchOutcome; return !!o && same(round, replayUncleanMonarchCombatRound(o.source, o.stance).round); } catch { return false; } }
export function nextUncleanMonarchCombatSource(o: UncleanMonarchRoundOutcome): UncleanMonarchCombatSource {
  const spirituality = Math.min(120, o.playerSpiritualityAfter + 12);
  return { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter, playerSpirituality: spirituality,
    enemyHealth: o.enemyHealth, enemyMind: o.enemyMind, enemySpirituality: o.enemySpirituality, playerInjuries: structuredClone(o.playerInjuriesAfter), enemyInjuries: structuredClone(o.enemyInjuriesAfter),
    playerRisk: o.playerRiskAfter, enemyRisk: o.enemyRiskAfter, site: structuredClone(o.siteAfter), operation: structuredClone(o.operationAfter), strain: o.strainAfter, emotion: o.emotion, emotionObservedAt: o.emotionObservedAt,
    mastery: { ...o.masteryAfter }, budget: { ...structuredClone(o.source.budget), health: o.playerHealthAfter, mind: o.playerMindAfter, spirituality, mastery: { ...o.masteryAfter }, injuries: structuredClone(o.playerInjuriesAfter), injuryRisk: o.playerRiskAfter },
    powerUses: { ...o.powerUses }, piece: structuredClone(o.pieceAfter), plates: structuredClone(o.platesAfter), lastForceReceipt: structuredClone(o.lastForceReceipt), conditionVersion: o.conditionVersion, clockSeconds: o.clockSecondsAfter, randomCursor: o.randomCursorAfter };
}
export function uncleanMonarchCombatConsequence(round: SliceCombatRound): string {
  const o = round.uncleanMonarchOutcome; if (!o) throw new Error('缺少污秽君王真实回合来源。'); const who = round.winner === 'PLAYER' ? '哈伦' : '你';
  let text = round.retreat === 'SUCCESS' ? '通过撤离判定，将沿4米普通通路退出，步行4米4秒。' : round.consequenceDomain === 'BODY' ? `${who}承受实际身体攻势，身体伤势检验${round.consequenceRoll}/100（轻${round.consequenceWeights!.light}/重${round.consequenceWeights!.heavy}/死亡${round.consequenceWeights!.death}）。` : round.consequenceDomain === 'MENTAL' ? `${who}承受实际精神压力，精神−10，没有身体伤口或身体风险。` : '本轮没有实际致伤来源，不掷身体伤势盘。';
  if (o.playerHealthAfter === 0) text += '你已死亡，原身体与持物留在院落。'; else if (o.enemyStatus === 'DEAD') text += '哈伦已死亡，原身体与原棍留在院落。'; else if (o.enemyStatus === 'SURRENDERED') text += '哈伦停止抵抗，亲自将自己的原棍放在脚边。'; else if (o.playerMindAfter === 0) text += '精神耗尽，停止交战并沿普通出口退出。';
  return `47岁的哈伦·维斯持独立原棍；诺拉带原卡、罗安实际在室外，旧对手仍在各自原处。${text} 本轮60秒；同一辅助片余${o.pieceAfter.charges}/3、磨损${o.pieceAfter.wear}；对手刻片余${o.platesAfter.filter(p => p.status === 'HELD').length}/3；恶魔负荷${o.strainAfter}/3。实际支出、旧伤与旧物不回填；未用窗口轮末失效。`;
}
export function projectUncleanMonarchCombat(s: SliceState) {
  const e = s.uncleanMonarch.encounter, visible = isUncleanMonarch(s), last = s.combat?.encounterId === 'UNCLEAN_MONARCH_DISPUTE' ? s.combat.lastRound?.uncleanMonarchOutcome : e.terminal ? s.combatHistory[e.terminal.historyIndex]?.uncleanMonarchOutcome : null;
  return { enemyName: visible ? '哈伦·维斯（47岁）' : '', targetId: visible ? e.targetId : null, playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, maxSpirituality: 120,
    enemyHealth: visible ? e.enemyHealth : null, enemyMind: visible ? e.enemyMind : null, enemySpirituality: visible ? e.enemySpirituality : null, powerUses: visible ? { ...e.powerUses } : null,
    site: visible ? structuredClone(e.currentSite) : null, piece: visible ? structuredClone(e.piece) : null, plates: visible ? structuredClone(e.plates) : [], policy: e.policy,
    strain: e.strain ?? s.uncleanMonarch.sourceScene?.originals.strain ?? s.demon.strain, emotion: e.emotion, emotionObservedAt: e.emotionObservedAt, conditionVersion: e.conditionVersion,
    originalExit: true, pursuit: false, distanceMetres: 2, automaticAllyImmunity: false, alliesPresent: 0, source: visible ? currentUncleanMonarchCombatSource(s) : null,
    lastActionSequence: visible && last ? [...last.playerActions.map(a => ({ ...structuredClone(a), actor: 'PLAYER' as const })), ...last.enemyActions.map(a => ({ ...structuredClone(a), actor: 'ENEMY' as const }))].sort((a, b) => a.order - b.order) : [],
    countWheel: UNCLEAN_MONARCH_COUNT_WHEEL.map(x => ({ ...x })), enemyCountWheel: UNCLEAN_MONARCH_ENEMY_COUNT_WHEEL.map(x => ({ ...x })), enemyAbilityWheel: UNCLEAN_MONARCH_ENEMY_ABILITY_WHEEL.map(x => ({ ...x })),
    summary: visible ? '体35%感30%意15%知20%，基础1500、核心上限300、状态最多减40%、底150。双方1至6动作10/15/25/25/15/10；旧六槽30/15/20/20/10/5及防守、控制替换保留，新两槽各20。每动作5秒、每轮60秒；继续战斗仅本人回12灵性。两项新能力各8灵性2精神，意志18，失败总计4精神；定向扰动另需已知当前强烈情绪并接受目标抵抗。同一时刻一个20秒窗口，实际应用才耗同一辅助片1次。缺资源普通回退，旧负荷不重置。' : '' };
}
export type UncleanMonarchCombatProjection = ReturnType<typeof projectUncleanMonarchCombat>;
