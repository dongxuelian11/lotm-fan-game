import { publicPryerFields as publicFields, publicPryerCheck, publicPryerInjury } from '../sage/life.js';
import { publicMercurySnakeBody, publicMercurySnakeLuck, publicMercurySnakeMastery, publicMercurySnakeOperation, publicMercurySnakePiece, publicMercurySnakePlate, publicMercurySnakeForceReceipt, publicMercurySnakeWindow, publicWheelOriginalSite } from './public.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { FateProphetOperationState } from '../fate-prophet/life.js';
import { validFateProphetLuck } from '../fate-prophet/combat.js';
import type { WinnerLuck, WinnerLuckPolicy } from '../winner/types.js';
import { MERCURY_SNAKE_INHERITED_ABILITIES } from './content.js';
import type { MercurySnakeOriginals, MercurySnakeSite } from './types.js';
import { validateMercurySnakeCurrentSite } from './life.js';
import { MERCURY_SNAKE_TARGET_ID, MERCURY_SNAKE_SITE, MERCURY_SNAKE_POLICIES, MERCURY_SNAKE_POWER_IDS, MERCURY_SNAKE_POWERS,
  hasMercurySnakeDisputeOpponent, validateMercurySnakePreparation, mercurySnakeCombatBody, createMercurySnakeBody, createMercurySnakeCombatPiece,
  mercurySnakeEncounterBudget, mercurySnakeFinanceSnapshot, mercurySnakeApproachedSite, validMercurySnakeCombatPiece, validMercurySnakePlates,
  type MercurySnakeCombatBody, type MercurySnakeEnemyIntent, type MercurySnakePreparation, type MercurySnakePolicy, type MercurySnakeWindow,
  type MercurySnakeEncounterBudget, type MercurySnakeFinanceSnapshot, type MercurySnakeForceReceipt, type MercurySnakePendingKind } from './encounter.js';

export const MERCURY_SNAKE_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const MERCURY_SNAKE_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const mercurySnakeActionCount = pyromaniacActionCount;
export const mercurySnakeEnemyActionCount = pyromaniacActionCount;
export const FORESIGHT = 'wheel.s2.event-foresight', HAZARD = 'wheel.s2.hazard-adjustment';
export const RESTART = 'wheel.s1.local-restart', ANCHOR = 'wheel.s1.moment-anchor';
const OLD_B = 'wheel.s3.deviation-buffer', OLD_K = 'wheel.s3.future-impediment';
export const MERCURY_SNAKE_INHERITED_IDS = MERCURY_SNAKE_INHERITED_ABILITIES.map(a => a.id);
export type MercurySnakeMoveId = 'BODY_STRIKE' | 'BODY_FOLLOWUP' | typeof FORESIGHT | typeof HAZARD | 'OBSERVE' | 'ACCIDENT' | typeof RESTART | typeof ANCHOR;
const ABILITIES: readonly { id: MercurySnakeMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'BODY_STRIKE', label: 'H：原身体主击18×身体；原短棍持握时16×身体', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: 'J：继承计算次击22.75×原掌握×身体', weight: 15, stance: 'ATTACK' },
  { id: FORESIGHT, label: 'B：事件先兆5灵性1精神，知识20；下一实际攻击减30%', weight: 20, stance: 'DEFEND' },
  { id: HAZARD, label: 'K：风险调整须选用1原积运5灵性1精神，知识20；下一实际身体攻击减半', weight: 20, stance: 'CONTROL' },
  { id: 'OBSERVE', label: 'R：观察当前身体、原杖与普通出口，不窥视未来票', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: 'A：实际动作偏差，固定−22.5', weight: 5, stance: null },
  { id: RESTART, label: '局部重启8灵性2精神：10秒内下一可见未结算冲量至多减30，只回本人原位置', weight: 20, stance: 'DEFEND' },
  { id: ANCHOR, label: '片刻维系8灵性2精神：保持原位置联系20秒，仍须另付局部重启；延后应用共耗2次', weight: 20, stance: 'CONTROL' },
];
/** These rows are sampled directly by the resolver, including the actual BODY/MENTAL distinction. */
export const MERCURY_SNAKE_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'MIND_SPIKE', label: '可见刻片精神冲击MENTAL75；7灵性与1枚原刻片', weight: 35 },
  { id: 'WARD', label: '原手势屏护4灵性；下一实际身体攻击减30', weight: 20 },
  { id: 'BODY_STRIKE', label: '唯一原杖身体攻击BODY25×身体；按实际2或3米距离近前再退回', weight: 25 },
  { id: 'CALM', label: '3灵性平复并遮挡变位4米，取消未用联系与先兆', weight: 10 },
  { id: 'REPOSITION', label: '普通变位4米并遮挡，有限位置联系失效', weight: 5 },
  { id: 'ACCIDENT', label: '实际失衡，0费用0贡献', weight: 5 },
];
export const isMercurySnake = (s: SliceState): boolean => s.progression.pathwayId === 'wheel' && s.progression.sequence === 1;
const enabled = (id: MercurySnakeMoveId, p: MercurySnakePolicy) => id === RESTART ? p === 'ALL' || p === 'RESTART' : id === ANCHOR ? p === 'ALL' || p === 'ANCHOR' : true;
const tickets = (stance: SliceStance | null, policy: MercurySnakePolicy) => ABILITIES.map(a => enabled(a.id, policy) ? a.weight * (stance !== null && a.stance === stance ? 5 : 4) : 0);
export function mercurySnakeAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const p = s.mercurySnake.encounter.policy, ws = tickets(stance, p), total = ws.reduce((n, v) => n + v, 0);
  return ABILITIES.flatMap((a, i) => !ws[i] ? [] : [{ id: a.id, weight: ws[i]! / total * 100, label: p === 'ORDINARY' && !['OBSERVE', 'ACCIDENT'].includes(a.id) ? '普通身体、格挡与观察，0主动超凡费用' : a.label }]);
}
function drawPlayer(random: ActionRandomStream, stance: SliceStance | null, policy: MercurySnakePolicy): MercurySnakeMoveId {
  const ws = tickets(stance, policy); let n = random.nextInt(1, ws.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= ws[i]!; if (n <= 0) return a.id; } throw new Error('能力盘无效。');
}
export function drawMercurySnakeAbility(random: ActionRandomStream, s: SliceState, stance: SliceStance | null): MercurySnakeMoveId { return drawPlayer(random, stance, s.mercurySnake.encounter.policy); }
export function drawMercurySnakeEnemyAbility(random: ActionRandomStream): MercurySnakeEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of MERCURY_SNAKE_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as MercurySnakeEnemyIntent; } throw new Error('对手行动盘无效。');
}
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]): boolean => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
const physicalAt = (n: number): number => n > 75 ? 1 : n > 50 ? .95 : n > 25 ? .9 : .8;
const factor = (n: number) => .65 + .35 * n / 500;
export interface MercurySnakeCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'MERCURY_SNAKE_DISPUTE'; targetId: typeof MERCURY_SNAKE_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetName: '奥斯温·贝尔'; targetAge: 44; targetSequence: 1; targetCore: 24; maxActionCount: 6;
  actualBody: true; independentMind: true; enemyWeapon: 'MS1-OSWIN-ROD'; yardId: typeof MERCURY_SNAKE_SITE; playerPosition: 'YARD'; enemyDistanceMetres: 2 | 3;
  ordinaryExit: 'OPEN'; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; playerInjuries: SliceInjury[]; playerRisk: number;
  physique: number; perception: number; will: number; knowledge: number; calculationMastery: number; awarenessMastery: number; stormMastery: number; passiveMastery: number;
  clubHeld: boolean; playerClubId: 'town-short-club' | null; luck: WinnerLuck;
  preparation: MercurySnakePreparation; site: MercurySnakeSite; operation: FateProphetOperationState; originals: MercurySnakeOriginals; body: MercurySnakeCombatBody;
  budget: MercurySnakeEncounterBudget; finance: MercurySnakeFinanceSnapshot; inheritedMastery: Record<string, number>; mastery: Record<string, number>; policy: MercurySnakePolicy;
  randomSeed: string; randomCursor: number;
}
export function currentMercurySnakeCombatSource(s: SliceState): MercurySnakeCombatSource | null {
  if (!hasMercurySnakeDisputeOpponent(s)) return null;
  const e = s.mercurySnake.encounter, c = s.combat!, originals = s.mercurySnake.sourceScene?.originals;
  if (!e.currentSite || !e.preparation || !e.piece || !originals) return null;
  const playerClubId = s.town.clubLocation === 'HAND' ? 'town-short-club' : null;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'MERCURY_SNAKE_DISPUTE', targetId: MERCURY_SNAKE_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetName: '奥斯温·贝尔', targetAge: 44, targetSequence: 1, targetCore: 24, maxActionCount: 6,
    actualBody: true, independentMind: true, enemyWeapon: 'MS1-OSWIN-ROD', yardId: MERCURY_SNAKE_SITE, playerPosition: 'YARD', enemyDistanceMetres: e.playerLocalMetres === 0 ? 2 : 3,
    ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false, playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality,
    playerInjuries: structuredClone(s.injuries), playerRisk: s.injuryRisk, ...s.character.coreStats,
    calculationMastery: s.progression.mastery['wheel.s8.calculation-control'] ?? 0, awarenessMastery: s.progression.mastery['wheel.s6.disaster-awareness'] ?? 0,
    stormMastery: s.progression.mastery['wheel.s6.mental-storm'] ?? 0, passiveMastery: s.progression.mastery['wheel.s7.passive-luck'] ?? 0,
    clubHeld: playerClubId !== null, playerClubId, luck: { ...s.mercurySnake.luck }, preparation: structuredClone(e.preparation), site: structuredClone(e.currentSite),
    operation: structuredClone(s.mercurySnake.life.operation), originals: structuredClone(originals), body: mercurySnakeCombatBody(e),
    budget: mercurySnakeEncounterBudget(s), finance: mercurySnakeFinanceSnapshot(s), inheritedMastery: Object.fromEntries(MERCURY_SNAKE_INHERITED_IDS.map(id => [id, s.progression.mastery[id]!])), mastery: { ...s.progression.mastery }, policy: e.policy,
    randomSeed: s.random.seed, randomCursor: s.random.cursor };
}
export interface MercurySnakeActionEvidence {
  order: number; actor: 'PLAYER' | 'ENEMY'; id: string; planned: string; selectedAbility: string; fallbackReason: string | null; mode: string; label: string;
  selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean; attackKind: 'NONE' | 'BODY' | 'MENTAL'; rawContribution: number;
  paidCost: number; mindCost: number; luckCost: 0 | 1; physicalFactor: number; check: PublicCheckResult | null; attempted: boolean; succeeded: boolean; resisted: boolean;
  atSeconds: number; elapsedSeconds: 5; travelMetres: number; randomCursorBefore: number; randomCursorAfter: number;
  playerMindAfter: number; playerSpiritualityAfter: number; enemySpiritualityAfter: number; luckAfter: WinnerLuck;
  pendingBefore: MercurySnakePendingKind | null; pendingAfter: MercurySnakePendingKind | null; pendingApplied: MercurySnakePendingKind | null;
  windowGranted: MercurySnakeWindow | null; windowsApplied: { kind: 'RESTART' | 'ANCHOR'; round: number; order: number; amount: number }[]; windowsCancelled: MercurySnakeWindow[];
  pieceChargePaid: number; pieceWearPaid: number; masteryApplied: string[]; receipt: MercurySnakeForceReceipt | null; conditionVersion: number;
  playerPositionBefore: number; playerPositionAfter: number; impulseMetres: number; returnedMetres: number;
}
export type MercurySnakePlayerAction = MercurySnakeActionEvidence;
export type MercurySnakeEnemyAction = MercurySnakeActionEvidence;
export interface MercurySnakeRuntime {
  body: MercurySnakeCombatBody; root: MercurySnakeSite; playerS: number; playerM: number; luck: WinnerLuck; winnerPolicy: WinnerLuckPolicy; mastery: Record<string, number>;
  guard: boolean; guardAttempted: boolean; expiredWindows: MercurySnakeWindow[];
}
export function createMercurySnakeRuntime(x: MercurySnakeCombatSource, winnerPolicy: WinnerLuckPolicy = 'HOLD'): MercurySnakeRuntime {
  return { body: structuredClone(x.body), root: structuredClone(x.site), playerS: x.playerSpirituality, playerM: x.playerMind, luck: { ...x.luck }, winnerPolicy,
    mastery: { ...x.mastery }, guard: false, guardAttempted: false, expiredWindows: [] };
}
function relationMatches(w: MercurySnakeWindow, r: MercurySnakeRuntime): boolean {
  return w.conditionVersion === r.body.conditionVersion && w.relation.conditionVersion === r.body.conditionVersion && w.relation.localMetres === r.body.playerLocalMetres && w.relation.position === r.root.playerLocation;
}
function anchorSupports(w: MercurySnakeWindow, r: MercurySnakeRuntime): boolean {
  const a = r.body.anchor; return !!a && a.expiresAt > r.root.clockSeconds && relationMatches(a, r) && same(a.relation, w.relation);
}
function expireWindows(r: MercurySnakeRuntime): void {
  const b = r.body, now = r.root.clockSeconds;
  if (b.anchor && (now >= b.anchor.expiresAt || !relationMatches(b.anchor, r))) { r.expiredWindows.push(structuredClone(b.anchor)); b.anchor = null; }
  if (b.restart && (!relationMatches(b.restart, r) || now >= b.restart.expiresAt && !anchorSupports(b.restart, r))) { r.expiredWindows.push(structuredClone(b.restart)); b.restart = null; }
}
export function advanceMercurySnakeCombatClock(r: MercurySnakeRuntime, seconds: number): void {
  if (!integer(seconds)) throw new Error('实际经过的秒数无效。'); r.root.clockSeconds += seconds; expireWindows(r);
}
function baseAction(x: MercurySnakeCombatSource, r: MercurySnakeRuntime, actor: 'PLAYER' | 'ENEMY', id: string, order: number, random: ActionRandomStream): MercurySnakeActionEvidence {
  return { actor, id, planned: id, selectedAbility: id, fallbackReason: null, order, mode: 'OBSERVE', label: '', selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false,
    attackKind: 'NONE', rawContribution: 0, paidCost: 0, mindCost: 0, luckCost: 0, physicalFactor: physicalAt(actor === 'PLAYER' ? x.playerHealth : x.body.enemyHealth), check: null, attempted: false, succeeded: false, resisted: false,
    atSeconds: r.root.clockSeconds, elapsedSeconds: 5, travelMetres: 0, randomCursorBefore: random.cursor, randomCursorAfter: random.cursor,
    playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, enemySpiritualityAfter: r.body.enemySpirituality, luckAfter: { ...r.luck },
    pendingBefore: r.body.pendingKind, pendingAfter: r.body.pendingKind, pendingApplied: null, windowGranted: null, windowsApplied: [], windowsCancelled: [],
    pieceChargePaid: 0, pieceWearPaid: 0, masteryApplied: [], receipt: null, conditionVersion: r.body.conditionVersion,
    playerPositionBefore: r.body.playerLocalMetres, playerPositionAfter: r.body.playerLocalMetres, impulseMetres: 0, returnedMetres: 0 };
}
function closeAction(a: MercurySnakeActionEvidence, r: MercurySnakeRuntime, random: ActionRandomStream): MercurySnakeActionEvidence {
  advanceMercurySnakeCombatClock(r, 5); a.randomCursorAfter = random.cursor; a.pendingAfter = r.body.pendingKind; a.playerPositionAfter = r.body.playerLocalMetres;
  a.playerMindAfter = r.playerM; a.playerSpiritualityAfter = r.playerS; a.enemySpiritualityAfter = r.body.enemySpirituality; a.luckAfter = { ...r.luck };
  a.label += ` 本动作5秒；你余${r.playerS}灵性、${r.playerM}精神、积运${r.luck.stored}/3；奥斯温余${r.body.enemySpirituality}灵性。`; return a;
}
function cancelWindows(r: MercurySnakeRuntime, a: MercurySnakeActionEvidence, reason: string): void {
  for (const key of ['restart', 'anchor'] as const) { if (r.body[key]) a.windowsCancelled.push(structuredClone(r.body[key]!)); r.body[key] = null; }
  if (a.windowsCancelled.length) a.label += `${reason}；已付费用不退。`;
}
function resolveNewWindow(x: MercurySnakeCombatSource, r: MercurySnakeRuntime, id: typeof RESTART | typeof ANCHOR, a: MercurySnakeActionEvidence, random: ActionRandomStream): MercurySnakeActionEvidence {
  const b = r.body, key = id === RESTART ? 'restart' : 'anchor';
  if (!enabled(id, x.policy)) a.label = '当前策略不使用此能力，只作普通观察。';
  else if (b[key] || id === ANCHOR && b.restart) a.label = '同一有限关系尚在，不叠加、倒接、续期或重收费。';
  else if (x.playerHealth <= 0 || r.playerM <= 0 || r.root.playerLocation !== 'YARD') a.label = '只有活着且仍在原地的本人才能建立局部位置关系。';
  else if (!b.piece || b.piece.charges < (id === RESTART && b.anchor ? 2 : 1) || r.playerS < 8 || r.playerM < 4) a.label = '真实辅助片次数或身体资源不足，普通观察，0超凡费用。';
  else {
    a.attempted = true; a.mode = id === RESTART ? 'RESTART' : 'ANCHOR'; a.paidCost = 8; a.mindCost = 2; r.playerS -= 8; r.playerM -= 2;
    a.check = resolveNormalCheck({ ability: 'knowledge', baseAbility: x.knowledge, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) });
    a.succeeded = ['SUCCESS', 'GREAT_SUCCESS'].includes(a.check.tier);
    if (!a.succeeded) { a.mindCost += 2; r.playerM -= 2; a.label = '知识检定失败，8灵性4精神照付，没有位置响应或重启。'; }
    else {
      const relation = id === RESTART && b.anchor ? structuredClone(b.anchor.relation) : { playerId: 'PLAYER' as const, position: 'YARD' as const, localMetres: b.playerLocalMetres, observedAt: r.root.clockSeconds, conditionVersion: b.conditionVersion, living: true as const };
      const w: MercurySnakeWindow = { kind: id === RESTART ? 'RESTART' : 'ANCHOR', round: x.round, order: a.order, castAt: r.root.clockSeconds, expiresAt: r.root.clockSeconds + (id === RESTART ? 10 : 20), conditionVersion: b.conditionVersion, relation };
      b[key] = w; a.windowGranted = structuredClone(w);
      a.label = id === RESTART ? '只记录本人刚观察的原位置，10秒内一次可见未结算冲量可局部返回并至多减30；没有记录健康、伤势、钱、行动或时间。' : '保持同一真实位置关系20秒；它自己不减攻击、不回位置，仍须另付局部重启，实际延后辅助才额外耗1次。';
    }
  }
  return closeAction(a, r, random);
}
/** The enemy action, resource debit and visible unsettled receipt already exist before this bounded response. */
function applyRestart(x: MercurySnakeCombatSource, r: MercurySnakeRuntime, a: MercurySnakeActionEvidence): void {
  const b = r.body, w = b.restart, anchor = b.anchor;
  if (!a.receipt || a.receipt.kind !== 'BODY' || !a.receipt.visible || a.receipt.unsettled !== true || x.playerHealth <= 0) return;
  const assisted = !!w && r.root.clockSeconds >= w.expiresAt;
  const canReturn = !!w && !!b.piece && a.selfGain > 0 && relationMatches(w, r) && (!assisted || anchorSupports(w, r)) && b.piece.charges >= (assisted ? 2 : 1);
  // Every actual staff impulse displaces the living player1m between the two neighboring yard marks.
  // This movement happens even with no window or charges. Only an eligible restart returns it.
  b.playerLocalMetres = 1 - b.playerLocalMetres; b.bodyImpulseCount++; b.playerTravelMetres++; r.root.playerTravelMetres++; a.impulseMetres = 1;
  if (canReturn && w && b.piece) {
    const amount = Math.min(30, a.selfGain); a.selfGain -= amount; b.playerLocalMetres = w.relation.localMetres;
    b.playerTravelMetres++; r.root.playerTravelMetres++; a.returnedMetres = 1;
    a.windowsApplied.push({ kind: 'RESTART', round: w.round, order: w.order, amount }); b.restartApplications++;
    a.masteryApplied.push(RESTART); r.mastery[RESTART] = Math.min(500, (r.mastery[RESTART] ?? 0) + 8);
    if (assisted && anchor) { a.windowsApplied.push({ kind: 'ANCHOR', round: anchor.round, order: anchor.order, amount: 0 }); b.anchorApplications++; a.masteryApplied.push(ANCHOR); r.mastery[ANCHOR] = Math.min(500, (r.mastery[ANCHOR] ?? 0) + 8); }
    const charges = assisted ? 2 : 1; b.piece.charges -= charges; b.piece.wear += charges; a.pieceChargePaid = charges; a.pieceWearPaid = charges;
    b.restart = null; b.anchor = null; a.label += ` 同一本人实际移1米后仅返回原1米位置，未结算贡献减${amount}；${assisted ? '原20秒联系实际维持已过短期限的响应，共耗2次' : '耗1次'}，原攻击与原费用保留，未回滚伤势、时间、钱或行动。`;
  } else { cancelWindows(r, a, '实际1米位置变化使未用关系失效'); a.label += ' 本人实际被局部冲量移1米，未发生重启。'; }
  b.playerMovementVersion++; b.conditionVersion++;
}
export function resolveMercurySnakePlayerSlot(x: MercurySnakeCombatSource, r: MercurySnakeRuntime, id: MercurySnakeMoveId, order: number, random: ActionRandomStream): MercurySnakeActionEvidence {
  expireWindows(r);
  const a = baseAction(x, r, 'PLAYER', id, order, random), b = r.body;
  const pay = (s: number, m = 0, luck: 0 | 1 = 0) => { r.playerS -= s; r.playerM -= m; a.paidCost = s; a.mindCost = m; a.luckCost = luck; if (luck) { r.luck.stored--; r.luck.spent++; b.lastLuckRound = x.round; b.luckAttempts++; } };
  const luckEligible = () => r.winnerPolicy === 'SPEND_FIRST' && b.lastLuckRound !== x.round && r.luck.stored > 0 && r.playerS >= 5;
  const attempt = (kind: MercurySnakePendingKind, ability: string, mindCost: 0 | 1, luck: 0 | 1) => {
    pay(5, mindCost, luck); a.attempted = true; a.selectedAbility = ability; a.mode = kind;
    if (kind === 'FORESIGHT') b.foresightAttempts++; else if (kind === 'HAZARD_ADJUSTMENT') b.hazardAttempts++; else if (kind === 'DEVIATION_BUFFER') b.deviationAttempts++; else b.impedimentAttempts++;
    a.check = resolveNormalCheck({ ability: 'knowledge', baseAbility: x.knowledge, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) });
    a.resisted = b.composureReady; a.succeeded = ['SUCCESS', 'GREAT_SUCCESS'].includes(a.check.tier) && !a.resisted;
    if (a.succeeded) b.pendingKind = kind;
    const abilityName = kind === 'FORESIGHT' ? '事件先兆' : kind === 'HAZARD_ADJUSTMENT' ? '风险调整' : kind === 'DEVIATION_BUFFER' ? '偏差缓冲' : '未发阻滞';
    a.label = `仅本槽实际尝试${abilityName}，实付${luck}份唯一原积运、5灵性${mindCost}精神；知识20，${a.check.roll}/${a.check.chance}，${a.check.tier}。${a.resisted ? '对手已经凝神抵抗，本次不建立效果' : a.succeeded ? '只建立一个未来待用窗口，未抽取或窥视未来行动' : '失败不建立效果'}；费用不退。`;
  };
  if (id === RESTART || id === ANCHOR) return resolveNewWindow(x, r, id, a, random);
  if (x.policy === 'ORDINARY' && !['BODY_STRIKE', 'BODY_FOLLOWUP', 'OBSERVE', 'ACCIDENT'].includes(id)) { a.mode = 'ORDINARY_GUARD'; a.enemyReduction = 8 * a.physicalFactor; a.label = '普通格挡与观察，0主动超凡费用。'; return closeAction(a, r, random); }
  if (id === 'ACCIDENT') { a.mode = 'ACCIDENT'; a.selfGain = -22.5; a.label = '本次实际偏差−22.5，不另外重抽或扣原积运。'; }
  else if (id === 'BODY_STRIKE' || id === 'BODY_FOLLOWUP') {
    cancelWindows(r, a, '本人普通移动使旧位置关系失效'); b.playerMovementVersion++; b.conditionVersion++;
    a.mode = 'BODY'; a.attackKind = 'BODY'; a.selfGain = (id === 'BODY_STRIKE' ? x.clubHeld ? 16 : 18 : x.policy === 'ORDINARY' ? 18 : 22.75 * factor(x.calculationMastery)) * a.physicalFactor;
    a.threatens = true; a.travelMetres = 2 * (2 + b.playerLocalMetres); r.root.playerTravelMetres += a.travelMetres; b.playerTravelMetres += a.travelMetres; b.playerAttackTravelMetres += a.travelMetres; a.label += `本人使用自己的身体或实际持握原短棍，近前${a.travelMetres / 2}米再退回${a.travelMetres / 2}米；不取对手原杖。`;
  } else if (id === 'OBSERVE') a.label = '只观察眼前原人、原杖、原积运和开放出口，不预先读取未来随机票。';
  else if (b.pendingKind !== null) { a.selectedAbility = 'OBSERVE'; a.fallbackReason = 'ONE_PENDING_WINDOW'; a.label = '已有一个待用窗口，本槽普通观察，不叠加、不重收费或刷新。'; }
  else if (id === FORESIGHT && r.playerS >= 5 && r.playerM >= 1) attempt('FORESIGHT', FORESIGHT, 1, 0);
  else if (id === HAZARD && luckEligible() && r.playerM >= 1) attempt('HAZARD_ADJUSTMENT', HAZARD, 1, 1);
  else if (luckEligible()) { a.fallbackReason = 'S2_RESOURCES_UNAVAILABLE'; attempt(id === FORESIGHT ? 'DEVIATION_BUFFER' : 'FUTURE_IMPEDIMENT', id === FORESIGHT ? OLD_B : OLD_K, 0, 1); }
  else {
    a.fallbackReason = id === HAZARD && r.winnerPolicy === 'HOLD' ? 'HOLD_LUCK' : 'RESOURCES_OR_ROUND_LUCK_CAP';
    if (id === FORESIGHT) { a.selectedAbility = r.playerS >= 3 ? 'wheel.s6.disaster-awareness' : 'ORDINARY_GUARD'; a.mode = 'GUARD'; if (r.playerS >= 3) { pay(3); a.enemyReduction = 42.25 * factor(x.awarenessMastery) * a.physicalFactor; } else a.enemyReduction = 8 * a.physicalFactor;
      a.label = '新窗口条件不足，实际仅执行旧预警或普通格挡，不支出积运。'; }
    else if (r.playerS >= 3) { pay(3); a.selectedAbility = 'wheel.s6.mental-storm'; a.mode = 'MIND'; a.attackKind = 'MENTAL'; a.mentalPressure = true; a.enemyReduction = 42.25 * factor(x.stormMastery); a.label = '仅实付3灵性使用继承精神风暴，作用于独立心智，不乘身体、不冒充肉体攻击。'; }
    else { a.selectedAbility = 'OBSERVE'; a.label = '真实资源不足，只普通观察，不借用历史已花积运或补灵性。'; }
  }
  a.rawContribution = a.selfGain;
  if (a.threatens && r.guard) { const amount = Math.min(30, a.selfGain); a.selfGain -= amount; a.threatens = a.selfGain > 0; r.guard = false; a.label += ` 对手已付原屏护削减${amount}。`; }
  return closeAction(a, r, random);
}
export function resolveMercurySnakeEnemySlot(x: MercurySnakeCombatSource, r: MercurySnakeRuntime, planned: MercurySnakeEnemyIntent, order: number, random: ActionRandomStream): MercurySnakeActionEvidence {
  expireWindows(r); const a = baseAction(x, r, 'ENEMY', planned, order, random), b = r.body;
  if (planned === 'ACCIDENT') { a.mode = 'ACCIDENT'; a.label = '奥斯温实际失衡，没有贡献或费用。'; }
  else if (planned === 'REPOSITION' || planned === 'CALM' && b.enemySpirituality >= 3) {
    if (planned === 'CALM') { a.paidCost = 3; b.enemySpirituality -= 3; b.powerUses.CALM++; b.emotion = 'CALM'; b.pendingKind = null; b.composureReady = true; } else b.repositionUses++;
    a.mode = planned; a.succeeded = true; a.travelMetres = 4; b.enemyTravelMetres += 4; b.conditionVersion++; cancelWindows(r, a, '奥斯温遮挡并实际变位4米，位置关系失效');
    a.label += `${planned === 'CALM' ? '实际付3灵性凝神并抵抗本轮新先兆' : '普通移动'}；原动作仍发生，已经花费不回滚。`;
  } else if (planned === 'WARD' && b.enemySpirituality >= 4 && !r.guardAttempted) {
    a.paidCost = 4; b.enemySpirituality -= 4; b.powerUses.WARD++; r.guard = true; r.guardAttempted = true; a.succeeded = true; a.mode = 'WARD'; a.label = '实际付4灵性完成原手势屏护，下一实际身体攻击至多减30；不续期。';
  } else if (planned === 'WARD' && r.guardAttempted) a.label = '本轮已经用过有限屏护，普通观察，不重复收费。';
  else if (planned === 'MIND_SPIKE' && b.enemySpirituality >= 7 && b.plates.some(p => p.status === 'HELD')) {
    const plate = b.plates.find(p => p.status === 'HELD')!; plate.status = 'SPENT'; plate.usedRound = x.round; plate.usedOrder = order;
    a.paidCost = 7; b.enemySpirituality -= 7; b.powerUses.MIND_SPIKE++; a.mode = 'MIND_SPIKE'; a.attackKind = 'MENTAL'; a.selfGain = 75; a.succeeded = true;
    a.receipt = { id: `${plate.id}:spent:${x.round}:${order}`, targetId: x.targetId, power: 'MIND_SPIKE', kind: 'MENTAL', plateId: plate.id, paidCost: 7, round: x.round, order, atSeconds: a.atSeconds, position: 'YARD', visible: true, conditionVersion: b.conditionVersion, unsettled: true, contribution: 75 };
    b.lastForceReceipt = structuredClone(a.receipt); a.label = '奥斯温实际付7灵性与同一枚原刻片，发出可见精神冲击75。精神压力不是身体位移，局部位置重启不削减它。';
  } else {
    a.id = a.selectedAbility = 'BODY_STRIKE'; a.mode = 'BODY'; a.attackKind = 'BODY'; a.selfGain = 25 * a.physicalFactor; a.travelMetres = 2 * (2 + b.playerLocalMetres); b.enemyTravelMetres += a.travelMetres; b.enemyAttackTravelMetres += a.travelMetres;
    a.fallbackReason = planned === 'BODY_STRIKE' ? null : 'FINITE_ENEMY_RESOURCES_UNAVAILABLE';
    a.receipt = { id: `MS1-OSWIN-ROD:impulse:${x.round}:${order}`, targetId: x.targetId, power: 'BODY_STRIKE', kind: 'BODY', plateId: null, paidCost: 0, round: x.round, order, atSeconds: a.atSeconds, position: 'YARD', visible: true, conditionVersion: b.conditionVersion, unsettled: true, contribution: a.selfGain };
    b.lastForceReceipt = structuredClone(a.receipt); a.label = `奥斯温以自己的唯一原杖实际近前${a.travelMetres / 2}米再退${a.travelMetres / 2}米，身体攻势与尚未结算局部冲量真实发生。`;
  }
  a.rawContribution = a.selfGain;
  const eligible = a.selfGain > 0 && (a.attackKind === 'BODY' || b.pendingKind === 'FORESIGHT' && a.attackKind === 'MENTAL');
  if (eligible && b.pendingKind) { a.pendingApplied = b.pendingKind; a.selfGain *= b.pendingKind === 'FORESIGHT' ? .7 : .5; b.pendingKind = null; a.label += ' 已付旧窗口只应用于本次实际攻势，原动作、刻片与全额灵性费用不变。'; }
  if (a.attackKind === 'BODY' && a.receipt) applyRestart(x, r, a);
  a.threatens = a.attackKind === 'BODY' && a.selfGain > 0; a.mentalPressure = a.attackKind === 'MENTAL' && a.selfGain > 0;
  return closeAction(a, r, random);
}
export function validMercurySnakeInjuries(injuries: SliceInjury[], revision: number): boolean {
  return Array.isArray(injuries) && new Set(injuries.map(i => i.id)).size === injuries.length && injuries.every(i => shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && !!i.id && ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision, 0, revision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision, revision)));
}
export function validMercurySnakeBody(b: MercurySnakeCombatBody, clock: number, maxRound: number, revision: number): boolean { try {
  if (!shape(b, Object.keys(createMercurySnakeBody())) || !integer(maxRound) || !integer(clock) || !integer(b.enemyHealth, 0, 100) || !integer(b.enemyMind, 0, 100) || !integer(b.enemySpirituality, 0, 120) || !integer(b.enemyRisk) || !validMercurySnakeInjuries(b.enemyInjuries, revision) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(b.enemyStatus) || (b.enemyStatus === 'DEAD') !== (b.enemyHealth === 0) || b.weaponLocation !== (b.enemyStatus === 'RESISTING' ? 'HAND' : 'YARD')) return false;
  if (!shape(b.powerUses, MERCURY_SNAKE_POWER_IDS) || !MERCURY_SNAKE_POWER_IDS.every(id => integer(b.powerUses[id], 0, 6 * maxRound)) || b.powerUses.WARD > maxRound || b.powerUses.MIND_SPIKE > 3 || b.enemySpirituality !== 120 - MERCURY_SNAKE_POWERS.reduce((n, p) => n + p.cost * b.powerUses[p.id], 0) || !validMercurySnakePlates(b.plates) || b.plates.filter(p => p.status === 'SPENT').length !== b.powerUses.MIND_SPIKE || b.plates.some(p => p.usedRound !== null && p.usedRound > maxRound)) return false;
  if (!b.piece || !validMercurySnakeCombatPiece(b.piece) || !integer(b.restartApplications, 0, 3) || !integer(b.anchorApplications, 0, b.restartApplications) || b.piece.wear !== b.restartApplications + b.anchorApplications) return false;
  if (![b.repositionUses, b.playerMovementVersion, b.bodyImpulseCount].every(n => integer(n, 0, 12 * maxRound)) || b.playerMovementVersion < b.bodyImpulseCount || b.bodyImpulseCount < b.restartApplications || !integer(b.playerAttackTravelMetres, 4 * (b.playerMovementVersion - b.bodyImpulseCount), 6 * (b.playerMovementVersion - b.bodyImpulseCount)) || b.playerAttackTravelMetres % 2 !== 0 || b.playerTravelMetres !== b.playerAttackTravelMetres + b.bodyImpulseCount + b.restartApplications || !integer(b.enemyAttackTravelMetres, 4 * b.bodyImpulseCount, 6 * b.bodyImpulseCount) || b.enemyAttackTravelMetres % 2 !== 0 || b.enemyTravelMetres !== b.enemyAttackTravelMetres + 4 * (b.repositionUses + b.powerUses.CALM) || b.playerLocalMetres !== (b.bodyImpulseCount - b.restartApplications) % 2 || b.conditionVersion !== 1 + b.powerUses.CALM + b.repositionUses + b.playerMovementVersion || b.emotion !== (b.powerUses.CALM ? 'CALM' : 'ANGRY')) return false;
  if (b.pendingKind !== null || b.composureReady !== false || ![b.foresightAttempts, b.hazardAttempts, b.deviationAttempts, b.impedimentAttempts, b.luckAttempts].every(n => integer(n, 0, 6 * maxRound)) || b.luckAttempts !== b.hazardAttempts + b.deviationAttempts + b.impedimentAttempts || (b.lastLuckRound === null ? b.luckAttempts !== 0 : !integer(b.lastLuckRound, 1, maxRound) || b.luckAttempts < 1 || b.luckAttempts > b.lastLuckRound)) return false;
  for (const [key, kind, duration] of [['restart', 'RESTART', 10], ['anchor', 'ANCHOR', 20]] as const) {
    const w = b[key]; if (!w) continue;
    if (!shape(w, ['kind', 'round', 'order', 'castAt', 'expiresAt', 'conditionVersion', 'relation']) || w.kind !== kind || !integer(w.round, 1, maxRound) || !integer(w.order, 0, 11) || !integer(w.castAt, Math.max(0, clock - 19), clock) || w.expiresAt !== w.castAt + duration || w.conditionVersion !== b.conditionVersion) return false;
    const v = w.relation;
    if (!shape(v, ['playerId', 'position', 'localMetres', 'observedAt', 'conditionVersion', 'living']) || v.playerId !== 'PLAYER' || v.position !== 'YARD' || v.localMetres !== b.playerLocalMetres || v.living !== true || v.conditionVersion !== b.conditionVersion || !integer(v.observedAt, Math.max(0, clock - 19), w.castAt)) return false;
    if (w.expiresAt <= clock && (key === 'anchor' || !b.anchor || b.anchor.expiresAt <= clock || !same(b.anchor.relation, v))) return false;
  }
  if (b.lastForceReceipt) {
    const v = b.lastForceReceipt;
    if (!shape(v, ['id', 'targetId', 'power', 'kind', 'plateId', 'paidCost', 'round', 'order', 'atSeconds', 'position', 'visible', 'conditionVersion', 'unsettled', 'contribution']) || v.targetId !== MERCURY_SNAKE_TARGET_ID || !integer(v.round, 1, maxRound) || !integer(v.order, 0, 11) || !integer(v.atSeconds, 0, clock) || v.position !== 'YARD' || v.visible !== true || v.unsettled !== true || !integer(v.conditionVersion, 1, b.conditionVersion)) return false;
    if (v.power === 'MIND_SPIKE') { if (v.kind !== 'MENTAL' || v.paidCost !== 7 || v.contribution !== 75 || !b.plates.some(p => p.id === v.plateId && p.usedRound === v.round && p.usedOrder === v.order) || v.id !== `${v.plateId}:spent:${v.round}:${v.order}`) return false; }
    else if (v.power !== 'BODY_STRIKE' || v.kind !== 'BODY' || v.plateId !== null || v.paidCost !== 0 || ![25, 23.75, 22.5, 20].includes(v.contribution) || v.id !== `MS1-OSWIN-ROD:impulse:${v.round}:${v.order}`) return false;
  } else if (b.powerUses.MIND_SPIKE || b.bodyImpulseCount) return false;
  return true;
} catch { return false; } }
const SOURCE_KEYS = ['runId', 'revision', 'week', 'round', 'encounterId', 'targetId', 'attemptWeek', 'startHistoryIndex', 'targetName', 'targetAge', 'targetSequence', 'targetCore', 'maxActionCount', 'actualBody', 'independentMind', 'enemyWeapon', 'yardId', 'playerPosition', 'enemyDistanceMetres', 'ordinaryExit', 'pursuit', 'thirdPartiesInArea', 'automaticAllyImmunity', 'playerHealth', 'playerMind', 'playerSpirituality', 'playerInjuries', 'playerRisk', 'physique', 'perception', 'will', 'knowledge', 'calculationMastery', 'awarenessMastery', 'stormMastery', 'passiveMastery', 'clubHeld', 'playerClubId', 'luck', 'preparation', 'site', 'operation', 'originals', 'body', 'budget', 'finance', 'inheritedMastery', 'mastery', 'policy', 'randomSeed', 'randomCursor'] as const;
export function validMercurySnakeCombatSource(x: MercurySnakeCombatSource): boolean { try {
  if (!shape(x, SOURCE_KEYS) || typeof x.runId !== 'string' || !x.runId || !integer(x.revision, 1) || !integer(x.week, 1) || !integer(x.round, 1, x.revision) || !integer(x.startHistoryIndex) || x.attemptWeek !== x.week || x.encounterId !== 'MERCURY_SNAKE_DISPUTE' || x.targetId !== MERCURY_SNAKE_TARGET_ID || x.targetName !== '奥斯温·贝尔' || x.targetAge !== 44 || x.targetSequence !== 1 || x.targetCore !== 24 || x.maxActionCount !== 6) return false;
  if (x.actualBody !== true || x.independentMind !== true || x.enemyWeapon !== 'MS1-OSWIN-ROD' || x.yardId !== MERCURY_SNAKE_SITE || x.playerPosition !== 'YARD' || x.enemyDistanceMetres !== 2 + x.body.playerLocalMetres || x.ordinaryExit !== 'OPEN' || x.pursuit !== false || x.thirdPartiesInArea !== 0 || x.automaticAllyImmunity !== false || !MERCURY_SNAKE_POLICIES.includes(x.policy)) return false;
  const p = x.site, prep = x.preparation, budget = x.budget;
  if (![x.playerHealth, x.playerMind].every(n => integer(n, 1, 100)) || !integer(x.playerSpirituality, 0, 120) || !integer(x.playerRisk) || !validMercurySnakeInjuries(x.playerInjuries, x.revision) || !validateMercurySnakeCurrentSite(p, x.originals) || p.playerLocation !== 'YARD' || p.volunteer.location !== 'OUTSIDE' || !p.volunteer.alive || p.guide.location !== 'OUTSIDE') return false;
  if (!validateMercurySnakePreparation(prep) || prep.runId !== x.runId || prep.randomSeed !== x.randomSeed || prep.randomCursor > x.randomCursor || prep.revision >= x.revision || prep.week !== x.week || x.revision < prep.revision + 2 + x.round - 1 || !same(x.originals, prep.originals) || !same(x.operation, prep.operation) || !same(x.finance, prep.finance)) return false;
  if (x.round === 1 && !same(x.body, { ...createMercurySnakeBody(), piece: createMercurySnakeCombatPiece() })) return false;
  const approached = mercurySnakeApproachedSite(prep.site, x.originals);
  if (!validMercurySnakeBody(x.body, p.clockSeconds, x.round - 1, x.revision) || x.body.enemyStatus !== 'RESISTING' || x.body.enemyMind === 0 || p.clockSeconds !== approached.clockSeconds + 60 * (x.round - 1)) return false;
  for (const evidence of [x.body.lastForceReceipt && { round: x.body.lastForceReceipt.round, order: x.body.lastForceReceipt.order, at: x.body.lastForceReceipt.atSeconds }, x.body.restart && { round: x.body.restart.round, order: x.body.restart.order, at: x.body.restart.castAt }, x.body.anchor && { round: x.body.anchor.round, order: x.body.anchor.order, at: x.body.anchor.castAt }]) if (evidence && evidence.at !== approached.clockSeconds + 60 * (evidence.round - 1) + 5 * evidence.order) return false;
  const expectedSite = { ...approached, clockSeconds: p.clockSeconds, playerTravelMetres: approached.playerTravelMetres + x.body.playerTravelMetres };
  if (!same(p, expectedSite)) return false;
  if (!same({ ...budget, health: prep.after.health, mind: prep.after.mind, spirituality: prep.after.spirituality, mastery: prep.after.mastery, injuries: prep.after.injuries, injuryRisk: prep.after.injuryRisk, luck: prep.after.luck }, { ...prep.after, actions: prep.after.actions - 1 })) return false;
  if (!validFateProphetLuck(x.luck, x.week) || !same(x.luck, { ...prep.after.luck, stored: prep.after.luck.stored - x.body.luckAttempts, spent: prep.after.luck.spent + x.body.luckAttempts }) || !same(x.luck, budget.luck)) return false;
  if (!shape(x.inheritedMastery, MERCURY_SNAKE_INHERITED_IDS) || !MERCURY_SNAKE_INHERITED_IDS.every(id => integer(x.inheritedMastery[id], 0, 500) && x.inheritedMastery[id] === x.mastery[id] && x.mastery[id] === prep.after.mastery[id]) || !shape(x.mastery, [...MERCURY_SNAKE_INHERITED_IDS, RESTART, ANCHOR])) return false;
  if (x.mastery[RESTART] !== Math.min(500, prep.after.mastery[RESTART]! + x.body.restartApplications * 8) || x.mastery[ANCHOR] !== Math.min(500, prep.after.mastery[ANCHOR]! + x.body.anchorApplications * 8) || !same(budget.mastery, x.mastery) || budget.health !== x.playerHealth || budget.mind !== x.playerMind || budget.spirituality !== x.playerSpirituality || budget.injuryRisk !== x.playerRisk || !same(budget.injuries, x.playerInjuries) || budget.sequence !== 1 || !same(budget.coreStats, { physique: x.physique, perception: x.perception, will: x.will, knowledge: x.knowledge })) return false;
  if (!['town-short-club', null].includes(x.playerClubId) || x.clubHeld !== (x.playerClubId !== null) || ![x.physique, x.perception, x.will, x.knowledge].every(n => integer(n, 0, 500)) || x.calculationMastery !== x.inheritedMastery['wheel.s8.calculation-control'] || x.awarenessMastery !== x.inheritedMastery['wheel.s6.disaster-awareness'] || x.stormMastery !== x.inheritedMastery['wheel.s6.mental-storm'] || x.passiveMastery !== x.inheritedMastery['wheel.s7.passive-luck']) return false;
  return typeof x.randomSeed === 'string' && x.randomSeed.length > 0 && x.randomSeed.length <= 256 && integer(x.randomCursor);
} catch { return false; } }
export const validateMercurySnakeCombatSource = validMercurySnakeCombatSource;
export interface MercurySnakeRoundOutcome extends MercurySnakeCombatBody {
  targetId: typeof MERCURY_SNAKE_TARGET_ID; round: number; source: MercurySnakeCombatSource; stance: SliceStance; winnerPolicy: WinnerLuckPolicy; continuing: boolean;
  playerHealthAfter: number; playerMindAfter: number; playerSpiritualityAfter: number; playerInjuriesAfter: SliceInjury[]; playerRiskAfter: number; luckAfter: WinnerLuck;
  masteryAfter: Record<string, number>; operationAfter: FateProphetOperationState; expiredWindows: MercurySnakeWindow[];
  siteAfter: MercurySnakeSite; elapsedSeconds: 60; randomCursorAfter: number; playerActions: MercurySnakeActionEvidence[]; enemyActions: MercurySnakeActionEvidence[];
  passiveLuck: { roll: number; triggered: boolean; bonus: number } | null; expiredPending: MercurySnakePendingKind | null;
}
export type MercurySnakeResolution = 'CONTINUE' | 'PLAYER_DEAD' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED' | 'RETREATED';
function penalty(n: number, max: number) { const f = n / max; return f > .75 ? 0 : f > .5 ? .05 : f > .25 ? .1 : .2; }
function base(core: number, h: number, m: number, s: number) { return (1500 + Math.min(core, 300)) * (1 - Math.min(.4, penalty(h, 100) + penalty(m, 100) + penalty(s, 120))); }
function weights(risk: number) { const death = Math.min(100, 5 + Math.min(risk, 10) * 10), shifted = death - 5; return { light: Math.max(0, 65 - shifted), heavy: Math.max(0, 30 - Math.max(0, shifted - 65)), death }; }
export function replayMercurySnakeCombatRound(x: MercurySnakeCombatSource, stance: SliceStance, winnerPolicy: WinnerLuckPolicy = 'HOLD'): { round: SliceCombatRound; outcome: MercurySnakeResolution } {
  if (!validMercurySnakeCombatSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance) || !['HOLD', 'SPEND_FIRST'].includes(winnerPolicy)) throw new Error('缺少真实原来源或有效积运策略。');
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = createMercurySnakeRuntime(x, winnerPolicy), b = r.body;
  const roll = stance === 'RETREAT' ? null : rng.nextInt(1, 100), passiveLuck = roll === null ? null : { roll, triggered: roll <= 25, bonus: roll <= 25 ? 45 * factor(x.passiveMastery) * physicalAt(x.playerHealth) : 0 };
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = mercurySnakeActionCount(playerCountRoll), enemyCount = mercurySnakeEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: MercurySnakeActionEvidence[] = [], enemies: MercurySnakeActionEvidence[] = [], remaining = { PLAYER: playerCount, ENEMY: enemyCount }; let retreat: SliceCombatRound['retreat'] = 'NONE';
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) for (const actor of order) {
    if (!remaining[actor]) continue;
    if (actor === 'PLAYER' && stance === 'RETREAT') { remaining.PLAYER = 0; retreat = rng.nextInt(1, 100) <= 50 ? 'SUCCESS' : 'FAILURE'; if (retreat === 'SUCCESS') { remaining.ENEMY = 0; break; } continue; }
    remaining[actor]--; const index = players.length + enemies.length;
    if (actor === 'PLAYER') players.push(resolveMercurySnakePlayerSlot(x, r, drawPlayer(rng, stance, x.policy), index, rng)); else enemies.push(resolveMercurySnakeEnemySlot(x, r, drawMercurySnakeEnemyAbility(rng), index, rng));
  }
  const sum = (a: MercurySnakeActionEvidence[], key: 'selfGain' | 'enemyReduction') => a.reduce((n, v) => n + v[key], 0);
  const playerAdvantage = Math.max(150, base(x.physique * .15 + x.perception * .2 + x.will * .4 + x.knowledge * .25, x.playerHealth, x.playerMind, x.playerSpirituality) + (passiveLuck?.bonus ?? 0) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(150, base(x.targetCore, x.body.enemyHealth, x.body.enemyMind, x.body.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction'));
  const winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100, winner = retreat === 'SUCCESS' ? 'ENEMY' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  let playerHealth = x.playerHealth, playerRisk = x.playerRisk, outcome: MercurySnakeResolution = retreat === 'SUCCESS' ? 'RETREATED' : 'CONTINUE';
  const playerInjuries = structuredClone(x.playerInjuries); let consequenceWeights: SliceCombatRound['consequenceWeights'] = null, consequenceRoll: number | undefined, consequenceDomain: SliceCombatRound['consequenceDomain'];
  if (retreat !== 'SUCCESS') {
    const loser = winner === 'PLAYER' ? 'ENEMY' : 'PLAYER', attacks = loser === 'PLAYER' ? enemies : players, injuries = loser === 'PLAYER' ? playerInjuries : b.enemyInjuries;
    if (attacks.some(a => a.threatens && a.attackKind === 'BODY')) {
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
  advanceMercurySnakeCombatClock(r, x.site.clockSeconds + 60 - r.root.clockSeconds); const expiredPending = b.pendingKind; b.pendingKind = null; b.composureReady = false; if (b.enemyStatus !== 'RESISTING') b.weaponLocation = 'YARD'; if (outcome !== 'CONTINUE') { b.restart = null; b.anchor = null; }
  const o: MercurySnakeRoundOutcome = { ...structuredClone(b), targetId: MERCURY_SNAKE_TARGET_ID, round: x.round, source: structuredClone(x), stance, winnerPolicy, continuing: outcome === 'CONTINUE',
    playerHealthAfter: playerHealth, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, playerInjuriesAfter: playerInjuries, playerRiskAfter: playerRisk, luckAfter: { ...r.luck },
    siteAfter: structuredClone(r.root), masteryAfter: { ...r.mastery }, operationAfter: structuredClone(x.operation), expiredWindows: structuredClone(r.expiredWindows), elapsedSeconds: 60, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies, passiveLuck, expiredPending };
  const round: SliceCombatRound = { round: x.round, stance, first, playerCount, enemyCount, playerCountRoll, enemyCountRoll,
    moves: [...players, ...enemies].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })),
    playerAdvantage, enemyAdvantage, winChance, winner, consequence: '', consequenceWeights, retreat, ...(consequenceDomain === undefined ? {} : { consequenceDomain }), ...(consequenceRoll === undefined ? {} : { consequenceRoll }),
    mercurySnakeOutcome: o, ...(passiveLuck ? { passiveLuck: { ...passiveLuck } } : {}) };
  round.consequence = mercurySnakeCombatConsequence(round); return { round, outcome };
}
export function validateMercurySnakeRoundOutcome(v: unknown): v is MercurySnakeRoundOutcome { try { const o = v as MercurySnakeRoundOutcome; return !!o && same(o, replayMercurySnakeCombatRound(o.source, o.stance, o.winnerPolicy).round.mercurySnakeOutcome); } catch { return false; } }
export function validateMercurySnakeCombatRound(round: SliceCombatRound): boolean { try { const o = round.mercurySnakeOutcome; return !!o && same(round, replayMercurySnakeCombatRound(o.source, o.stance, o.winnerPolicy).round); } catch { return false; } }
export function nextMercurySnakeCombatSource(o: MercurySnakeRoundOutcome): MercurySnakeCombatSource {
  const spirituality = Math.min(120, o.playerSpiritualityAfter + 12);
  return { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter,
    playerSpirituality: spirituality, playerInjuries: structuredClone(o.playerInjuriesAfter), playerRisk: o.playerRiskAfter, luck: { ...o.luckAfter },
    site: structuredClone(o.siteAfter), body: mercurySnakeCombatBody(o), enemyDistanceMetres: o.playerLocalMetres === 0 ? 2 : 3, mastery: { ...o.masteryAfter }, operation: structuredClone(o.operationAfter),
    budget: { ...structuredClone(o.source.budget), health: o.playerHealthAfter, mind: o.playerMindAfter, spirituality, mastery: { ...o.masteryAfter }, injuries: structuredClone(o.playerInjuriesAfter), injuryRisk: o.playerRiskAfter, luck: { ...o.luckAfter } }, randomCursor: o.randomCursorAfter };
}
export function mercurySnakeCombatConsequence(round: SliceCombatRound): string {
  const o = round.mercurySnakeOutcome; if (!o) throw new Error('缺少水银之蛇真实回合来源。'); const who = round.winner === 'PLAYER' ? '奥斯温' : '你';
  let text = round.retreat === 'SUCCESS' ? '通过撤离判定，活着才能从当前标记走回普通出口。' : round.consequenceDomain === 'BODY' ? `${who}承受实际身体攻势，按共同身体伤势盘结算。` : round.consequenceDomain === 'MENTAL' ? `${who}承受实际精神压力，精神−10，没有身体伤口或身体风险。` : '本轮没有实际致伤来源，不掷身体伤势盘。';
  if (o.playerHealthAfter === 0) text += '你已真实死亡，局部重启不能复活、复原健康或走出院落。'; else if (o.enemyStatus === 'DEAD') text += '奥斯温真实死亡，原身体与原杖留院。'; else if (o.enemyStatus === 'SURRENDERED') text += '奥斯温因实际重伤或精神耗尽停止抵抗，原杖放在脚边。';
  return `${text} 本轮真实60秒，敌人原动作与全额费用保留。同一新辅助片余${o.piece!.charges}/3、磨损${o.piece!.wear}；原刻片余${o.plates.filter(p => p.status === 'HELD').length}/3。洛温原投降与旧积运已花账未改变。`;
}
export function projectMercurySnakeAction(a: MercurySnakeActionEvidence) { return {
  ...publicFields(a, ['order', 'actor', 'id', 'planned', 'selectedAbility', 'fallbackReason', 'mode', 'label', 'selfGain', 'enemyReduction', 'threatens', 'mentalPressure', 'attackKind', 'rawContribution', 'paidCost', 'mindCost', 'luckCost', 'physicalFactor', 'attempted', 'succeeded', 'resisted', 'atSeconds', 'elapsedSeconds', 'travelMetres', 'playerMindAfter', 'playerSpiritualityAfter', 'enemySpiritualityAfter', 'pendingBefore', 'pendingAfter', 'pendingApplied', 'pieceChargePaid', 'pieceWearPaid', 'conditionVersion', 'playerPositionBefore', 'playerPositionAfter', 'impulseMetres', 'returnedMetres']),
  check: publicPryerCheck(a.check), luckAfter: publicMercurySnakeLuck(a.luckAfter), windowGranted: a.windowGranted ? publicMercurySnakeWindow(a.windowGranted) : null,
  windowsApplied: a.windowsApplied.map(w => publicFields(w, ['kind', 'round', 'order', 'amount'])), windowsCancelled: a.windowsCancelled.map(publicMercurySnakeWindow),
  masteryApplied: [...a.masteryApplied], receipt: a.receipt ? publicMercurySnakeForceReceipt(a.receipt) : null,
}; }
export type MercurySnakePublicAction = ReturnType<typeof projectMercurySnakeAction>;
export function projectMercurySnakeRoundOutcome(o: MercurySnakeRoundOutcome) { return {
  ...publicMercurySnakeBody(o), ...publicFields(o, ['targetId', 'round', 'stance', 'winnerPolicy', 'continuing', 'playerHealthAfter', 'playerMindAfter', 'playerSpiritualityAfter', 'playerRiskAfter', 'elapsedSeconds', 'expiredPending']),
  playerInjuriesAfter: o.playerInjuriesAfter.map(publicPryerInjury), luckAfter: publicMercurySnakeLuck(o.luckAfter), masteryAfter: publicMercurySnakeMastery(o.masteryAfter), operationAfter: publicMercurySnakeOperation(o.operationAfter),
  siteAfter: publicWheelOriginalSite(o.siteAfter), expiredWindows: o.expiredWindows.map(publicMercurySnakeWindow), passiveLuck: o.passiveLuck ? publicFields(o.passiveLuck, ['roll', 'triggered', 'bonus']) : null,
  playerActions: o.playerActions.map(projectMercurySnakeAction), enemyActions: o.enemyActions.map(projectMercurySnakeAction),
}; }
export type MercurySnakePublicRoundOutcome = ReturnType<typeof projectMercurySnakeRoundOutcome>;
export function projectMercurySnakeCombat(s: SliceState) {
  const e = s.mercurySnake.encounter, visible = isMercurySnake(s), last = s.combat?.encounterId === 'MERCURY_SNAKE_DISPUTE' ? s.combat.lastRound?.mercurySnakeOutcome : e.terminal ? s.combatHistory[e.terminal.historyIndex]?.mercurySnakeOutcome : null;
  return { enemyName: visible ? '奥斯温·贝尔（44岁）' : '', targetId: visible ? e.targetId : null, playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, maxSpirituality: 120,
    enemyHealth: visible ? e.enemyHealth : null, enemyMind: visible ? e.enemyMind : null, enemySpirituality: visible ? e.enemySpirituality : null, powerUses: visible ? publicFields(e.powerUses, ['MIND_SPIKE', 'WARD', 'CALM']) : null,
    site: visible && e.currentSite ? publicWheelOriginalSite(e.currentSite) : null, piece: visible && e.piece ? publicMercurySnakePiece(e.piece) : null, plates: visible ? e.plates.map(publicMercurySnakePlate) : [], policy: e.policy,
    luck: { ...publicMercurySnakeLuck(s.mercurySnake.luck), capacity: 3 as const }, weaponLocation: e.weaponLocation, playerLocalMetres: e.playerLocalMetres, restart: e.restart ? publicMercurySnakeWindow(e.restart) : null, anchor: e.anchor ? publicMercurySnakeWindow(e.anchor) : null, conditionVersion: e.conditionVersion,
    originalExit: true, pursuit: false, distanceMetres: 2 + e.playerLocalMetres, baseDistanceMetres: 2, automaticAllyImmunity: false, alliesPresent: 0,
    lastActionSequence: visible && last ? [...last.playerActions, ...last.enemyActions].sort((a, b) => a.order - b.order).map(projectMercurySnakeAction) : [],
    countWheel: MERCURY_SNAKE_COUNT_WHEEL.map(x => ({ ...x })), enemyCountWheel: MERCURY_SNAKE_ENEMY_COUNT_WHEEL.map(x => ({ ...x })), enemyAbilityWheel: MERCURY_SNAKE_ENEMY_ABILITY_WHEEL.map(x => ({ ...x })),
    summary: visible ? '体15%感20%意40%知25%；基础1500、核心上限300、状态最多减40%、底150。双方1至6动作10/15/25/25/15/10；旧六槽30/15/20/20/10/5，新两槽各20。每动作5秒，每轮60秒，继续战斗仅按原规则本人回12灵性。局部重启只返回活着本人被实际未结算身体冲量移动的1米，至多减30；精神压力不减。片刻维系自身不减贡献，只将同一短关系保持到原20秒上限，延后重启共耗2次。没有伤势、死亡、时间或费用回滚。' : '' };
}
export type MercurySnakeCombatProjection = ReturnType<typeof projectMercurySnakeCombat>;
