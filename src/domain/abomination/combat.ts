import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import type { MadmanBurstPolicy, MadmanRoundPolicy } from '../madman/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { AncientEvilOperationState } from '../ancient-evil/life.js';
import { ABOMINATION_INHERITED_ABILITIES } from './content.js';
import type { AbominationOriginals, AbominationSite } from './types.js';
import { validateAbominationCurrentSite } from './life.js';
import { ABOMINATION_TARGET_ID, ABOMINATION_SITE, ABOMINATION_POLICIES, ABOMINATION_POWER_IDS, ABOMINATION_POWERS,
  hasAbominationDisputeOpponent, validateAbominationPreparation, abominationCombatBody, createAbominationBody, createAbominationCombatPiece,
  abominationEncounterBudget, abominationFinanceSnapshot, abominationApproachedSite, validAbominationCombatPiece, validAbominationPlates,
  type AbominationCombatBody, type AbominationEnemyIntent, type AbominationPreparation, type AbominationPolicy, type AbominationWindow,
  type AbominationEncounterBudget, type AbominationFinanceSnapshot, type AbominationForceReceipt } from './encounter.js';

export const ABOMINATION_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const ABOMINATION_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const abominationActionCount = pyromaniacActionCount;
export const abominationEnemyActionCount = pyromaniacActionCount;
const H = 'chained.s4.object-motion', J = 'BODY_FOLLOWUP', B = 'GHOST_DODGE', K = 'chained.s2.enduring-transfiguration';
export const BARRIER = 'chained.s1.spirit-barrier', CRY = 'chained.s1.brief-cry';
export const ABOMINATION_INHERITED_IDS = ABOMINATION_INHERITED_ABILITIES.map(a => a.id);
export type AbominationMoveId = typeof H | typeof J | typeof B | typeof K | typeof BARRIER | typeof CRY | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly { id: AbominationMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: H, label: '旧原木块物动3灵性；已耗尽则普通身体攻击', weight: 30, stance: 'ATTACK' },
  { id: J, label: '继承身体次击，按旧掌握与当前身体计算', weight: 15, stance: 'ATTACK' },
  { id: B, label: '本槽灵化避让2灵性；不足普通格挡', weight: 20, stance: 'DEFEND' },
  { id: K, label: '真实接触4灵性1精神，再尝试持续变形6灵性2精神；可抵抗', weight: 20, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '观察同一身体、原杖及普通出口', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差，优势减少22.5', weight: 5, stance: null },
  { id: BARRIER, label: '灵性束障8灵性2精神：20秒内下一可见精神冲击减30，身体不减', weight: 20, stance: 'DEFEND' },
  { id: CRY, label: '短促震声8灵性2精神及实际抵抗：下一精神动作迟疑3秒、贡献减30，仍付费执行', weight: 20, stance: 'CONTROL' },
];
/** These exact rows are sampled by the resolver and projected without a second descriptive wheel. */
export const ABOMINATION_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'MIND_SPIKE', label: '精神刻片冲击MENTAL75；7灵性与1枚原刻片，兔形保留心智能力', weight: 35 },
  { id: 'WARD', label: '手势屏护4灵性，下一实际身体攻击减30；兔形不能做原手势', weight: 20 },
  { id: 'BODY_STRIKE', label: '原杖身体攻击BODY25；兔形为同一无武器身体10', weight: 25 },
  { id: 'CALM', label: '3灵性，平复并遮挡变位；清除未用窗口，不免费解除旧形态', weight: 10 },
  { id: 'REPOSITION', label: '普通移动4米并避开接触，旧联系和未用窗口失效', weight: 5 },
  { id: 'ACCIDENT', label: '实际失衡，0费用0贡献', weight: 5 },
];
export const isAbomination = (s: SliceState): boolean => s.progression.pathwayId === 'chained' && s.progression.sequence === 1;
const enabled = (id: AbominationMoveId, p: AbominationPolicy) => id === BARRIER ? p === 'ALL' || p === 'BARRIER' : id === CRY ? p === 'ALL' || p === 'CRY' : true;
const tickets = (stance: SliceStance | null, policy: AbominationPolicy) => ABILITIES.map(a => enabled(a.id, policy) ? a.weight * (stance !== null && a.stance === stance ? 5 : 4) : 0);
export function abominationAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const p = s.abomination.encounter.policy, ws = tickets(stance, p), total = ws.reduce((n, v) => n + v, 0);
  return ABILITIES.flatMap((a, i) => !ws[i] ? [] : [{ id: a.id, weight: ws[i]! / total * 100,
    label: p === 'ORDINARY' && a.id !== 'ACCIDENT' ? '普通身体、格挡与观察，0超凡费用' : a.id === H && s.town.clubLocation === 'HAND' ? '持握自己的原短棍普通挥击，不使用木块' : a.label }]);
}
function drawPlayer(random: ActionRandomStream, stance: SliceStance | null, policy: AbominationPolicy): AbominationMoveId {
  const ws = tickets(stance, policy); let n = random.nextInt(1, ws.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= ws[i]!; if (n <= 0) return a.id; } throw new Error('能力盘无效。');
}
export function drawAbominationAbility(random: ActionRandomStream, s: SliceState, stance: SliceStance | null): AbominationMoveId { return drawPlayer(random, stance, s.abomination.encounter.policy); }
export function drawAbominationEnemyAbility(random: ActionRandomStream): AbominationEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of ABOMINATION_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as AbominationEnemyIntent; } throw new Error('对手行动盘无效。');
}
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]): boolean => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
const physicalAt = (n: number): number => n > 75 ? 1 : n > 50 ? .95 : n > 25 ? .9 : .8;
const masteryFactor = (n: number) => .65 + .35 * n / 500;
export interface AbominationCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'ABOMINATION_DISPUTE'; targetId: typeof ABOMINATION_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetName: '罗德里克·霍尔'; targetAge: 45; targetSequence: 1; targetCore: 24; targetWill: 22; maxActionCount: 6;
  actualBody: true; independentMind: true; enemyWeapon: 'AB1-RODERICK-ROD'; yardId: typeof ABOMINATION_SITE; playerPosition: 'YARD'; enemyDistanceMetres: 2;
  ordinaryExit: 'OPEN'; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; playerInjuries: SliceInjury[]; playerRisk: number;
  physique: number; perception: number; will: number; knowledge: number; objectMastery: number; bodyMastery: number; burstMastery: number; clubHeld: boolean; playerClubId: 'town-short-club' | null;
  preparation: AbominationPreparation; site: AbominationSite; operation: AncientEvilOperationState; originals: AbominationOriginals; body: AbominationCombatBody;
  budget: AbominationEncounterBudget; finance: AbominationFinanceSnapshot; inheritedMastery: Record<string, number>; mastery: Record<string, number>; policy: AbominationPolicy;
  randomSeed: string; randomCursor: number;
}
export function currentAbominationCombatSource(s: SliceState): AbominationCombatSource | null {
  if (!hasAbominationDisputeOpponent(s)) return null;
  const e = s.abomination.encounter, c = s.combat!, stats = s.character.coreStats, originals = s.abomination.sourceScene?.originals;
  if (!e.currentSite || !e.preparation || !e.piece || !originals) return null;
  const playerClubId = s.town.clubLocation === 'HAND' ? 'town-short-club' : null;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'ABOMINATION_DISPUTE', targetId: ABOMINATION_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetName: '罗德里克·霍尔', targetAge: 45, targetSequence: 1, targetCore: 24, targetWill: 22, maxActionCount: 6,
    actualBody: true, independentMind: true, enemyWeapon: 'AB1-RODERICK-ROD', yardId: ABOMINATION_SITE, playerPosition: 'YARD', enemyDistanceMetres: 2,
    ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false, playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality,
    playerInjuries: structuredClone(s.injuries), playerRisk: s.injuryRisk, ...stats, objectMastery: s.progression.mastery[H] ?? 0,
    bodyMastery: s.progression.mastery['chained.s6.steel-body'] ?? 0, burstMastery: s.progression.mastery['chained.s8.reason-sacrifice'] ?? 0, clubHeld: playerClubId !== null, playerClubId,
    preparation: structuredClone(e.preparation), site: structuredClone(e.currentSite), operation: structuredClone(s.abomination.life.operation), originals: structuredClone(originals), body: abominationCombatBody(e),
    budget: abominationEncounterBudget(s), finance: abominationFinanceSnapshot(s), inheritedMastery: Object.fromEntries(ABOMINATION_INHERITED_IDS.map(id => [id, s.progression.mastery[id]!])), mastery: { ...s.progression.mastery }, policy: e.policy,
    randomSeed: s.random.seed, randomCursor: s.random.cursor };
}
export interface AbominationActionEvidence {
  order: number; actor: 'PLAYER' | 'ENEMY'; id: string; planned: string; mode: string; label: string; selfGain: number; enemyReduction: number;
  threatens: boolean; mentalPressure: boolean; attackKind: 'NONE' | 'BODY' | 'MENTAL'; paidCost: number; mindCost: number; physicalFactor: number;
  rolls: number[]; checkChance: number | null; resistanceChance: number | null; attempted: boolean; succeeded: boolean; resisted: boolean;
  atSeconds: number; elapsedSeconds: number; hesitationSeconds: number; travelMetres: number; blockId: string | null;
  enemyFormBefore: 'HUMAN' | 'RABBIT'; enemyFormAfter: 'HUMAN' | 'RABBIT'; weaponBefore: 'HAND' | 'YARD'; weaponAfter: 'HAND' | 'YARD';
  randomCursorBefore: number; randomCursorAfter: number; playerMindAfter: number; playerSpiritualityAfter: number; enemySpiritualityAfter: number;
  windowGranted: AbominationWindow | null; windowsApplied: { kind: 'BARRIER' | 'CRY'; round: number; order: number; amount: number }[]; windowsCancelled: AbominationWindow[];
  pieceChargePaid: number; pieceWearPaid: number; masteryApplied: string[]; receipt: AbominationForceReceipt | null; conditionVersion: number;
}
export type AbominationPlayerAction = AbominationActionEvidence;
export type AbominationEnemyAction = AbominationActionEvidence;
export interface AbominationRuntime {
  body: AbominationCombatBody; root: AbominationSite; playerS: number; playerM: number; madman: MadmanRoundPolicy; mastery: Record<string, number>;
  guard: boolean; guardAttempted: boolean; expiredWindows: AbominationWindow[];
}
export function createAbominationRuntime(x: AbominationCombatSource, policy: MadmanBurstPolicy = 'HOLD'): AbominationRuntime {
  return { body: structuredClone(x.body), root: structuredClone(x.site), playerS: x.playerSpirituality, playerM: x.playerMind, mastery: { ...x.mastery },
    madman: { policy, triggered: false, mentalCost: 0, spiritualCost: 0 }, guard: false, guardAttempted: false, expiredWindows: [] };
}
function expireWindows(r: AbominationRuntime): void {
  for (const key of ['barrier', 'cry'] as const) { const w = r.body[key]; if (w && (r.root.clockSeconds >= w.expiresAt || w.conditionVersion !== r.body.conditionVersion)) { r.expiredWindows.push(structuredClone(w)); r.body[key] = null; } }
}
export function advanceAbominationCombatClock(r: AbominationRuntime, seconds: number): void {
  if (!integer(seconds)) throw new Error('实际经过的秒数无效。'); r.root.clockSeconds += seconds;
  if (r.body.enemyFormUntilSeconds !== null && r.root.clockSeconds >= r.body.enemyFormUntilSeconds) { r.body.enemyForm = 'HUMAN'; r.body.enemyFormUntilSeconds = null; }
  if (r.body.formUntilSeconds !== null && r.root.clockSeconds >= r.body.formUntilSeconds) { r.body.form = 'HUMAN'; r.body.formUntilSeconds = null; }
  expireWindows(r);
}
function baseAction(x: AbominationCombatSource, r: AbominationRuntime, actor: 'PLAYER' | 'ENEMY', id: string, order: number, random: ActionRandomStream): AbominationActionEvidence {
  return { actor, id, planned: id, order, mode: 'OBSERVE', label: '', selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false, attackKind: 'NONE', paidCost: 0, mindCost: 0,
    physicalFactor: physicalAt(actor === 'PLAYER' ? x.playerHealth : x.body.enemyHealth), rolls: [], checkChance: null, resistanceChance: null, attempted: false, succeeded: false, resisted: false,
    atSeconds: r.root.clockSeconds, elapsedSeconds: 5, hesitationSeconds: 0, travelMetres: 0, blockId: null, enemyFormBefore: r.body.enemyForm, enemyFormAfter: r.body.enemyForm,
    weaponBefore: r.body.weaponLocation, weaponAfter: r.body.weaponLocation, randomCursorBefore: random.cursor, randomCursorAfter: random.cursor,
    playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, enemySpiritualityAfter: r.body.enemySpirituality,
    windowGranted: null, windowsApplied: [], windowsCancelled: [], pieceChargePaid: 0, pieceWearPaid: 0, masteryApplied: [], receipt: null, conditionVersion: r.body.conditionVersion };
}
function closeAction(a: AbominationActionEvidence, r: AbominationRuntime, random: ActionRandomStream): AbominationActionEvidence {
  advanceAbominationCombatClock(r, 5); a.enemyFormAfter = r.body.enemyForm; a.weaponAfter = r.body.weaponLocation; a.randomCursorAfter = random.cursor;
  a.playerMindAfter = r.playerM; a.playerSpiritualityAfter = r.playerS; a.enemySpiritualityAfter = r.body.enemySpirituality;
  a.label += ` 本动作${a.elapsedSeconds}秒；你余${r.playerS}灵性、${r.playerM}精神，罗德里克余${r.body.enemySpirituality}灵性。`; return a;
}
function cancelWindows(r: AbominationRuntime, a: AbominationActionEvidence, reason: string): void {
  for (const key of ['barrier', 'cry'] as const) { if (r.body[key]) a.windowsCancelled.push(structuredClone(r.body[key]!)); r.body[key] = null; }
  if (a.windowsCancelled.length) a.label += `${reason}，已付费用不退。`;
}
function resolveNewWindow(x: AbominationCombatSource, r: AbominationRuntime, id: typeof BARRIER | typeof CRY, a: AbominationActionEvidence, random: ActionRandomStream): AbominationActionEvidence {
  const key = id === BARRIER ? 'barrier' : 'cry';
  if (!enabled(id, x.policy)) a.label = '当前策略不使用此能力，只作普通观察。';
  else if (r.body[key]) a.label = '同类20秒窗口仍在，不重施、不续期、不重复收费。';
  else if (!r.body.piece || r.body.piece.charges <= 0 || r.playerS < 8 || r.playerM < 4) a.label = '同一辅助片或真实资源不足，普通观察，0超凡费用。';
  else {
    a.attempted = true; a.mode = key === 'barrier' ? 'BARRIER' : 'CRY'; a.paidCost = 8; a.mindCost = 2; r.playerS -= 8; r.playerM -= 2;
    a.checkChance = computeCheckChance({ ability: 'will', baseAbility: x.will, difficulty: 18, modifiers: [] }); const roll = random.nextInt(1, 100); a.rolls.push(roll); a.succeeded = roll <= a.checkChance;
    if (a.succeeded && key === 'cry') { a.resistanceChance = 57; const resistance = random.nextInt(1, 100); a.rolls.push(resistance); a.resisted = resistance <= a.resistanceChance; a.succeeded = !a.resisted; }
    if (!a.succeeded) { a.mindCost += 2; r.playerM -= 2; a.label = a.resisted ? '罗德里克以实际意志抵抗震声；8灵性4精神照付，没有免费控制。' : '意志检定失败，8灵性4精神已耗，没有建立窗口。'; }
    else {
      const w: AbominationWindow = { kind: key === 'barrier' ? 'BARRIER' : 'CRY', round: x.round, order: a.order, castAt: r.root.clockSeconds, expiresAt: r.root.clockSeconds + 20, conditionVersion: r.body.conditionVersion };
      r.body[key] = w; a.windowGranted = structuredClone(w);
      a.label = key === 'barrier' ? '建立一次20秒可见精神束障；只削减下一实际精神攻击30，身体攻击不减，尚未耗辅助片。' : '建立一次20秒可见精神行动窗口；下一实际精神能力将迟疑3秒、贡献减30，动作与原费用仍执行，尚未耗辅助片。';
    }
  }
  return closeAction(a, r, random);
}
function applyWindow(r: AbominationRuntime, a: AbominationActionEvidence, key: 'barrier' | 'cry'): void {
  const w = r.body[key]; if (!w || !r.body.piece || r.body.piece.charges === 0 || a.attackKind !== 'MENTAL' || a.selfGain <= 0) return;
  const amount = Math.min(30, a.selfGain), id = key === 'barrier' ? BARRIER : CRY;
  a.windowsApplied.push({ kind: w.kind, round: w.round, order: w.order, amount }); a.selfGain -= amount;
  r.body.piece.charges--; r.body.piece.wear++; a.pieceChargePaid++; a.pieceWearPaid++; a.masteryApplied.push(id); r.mastery[id] = Math.min(500, (r.mastery[id] ?? 0) + 8);
  r.body[key] = null;
  if (key === 'cry') { r.body.cryApplications++; r.body.hesitationSeconds += 3; a.hesitationSeconds += 3; a.elapsedSeconds += 3; advanceAbominationCombatClock(r, 3); a.label += ` 已计划的精神行动真实迟疑3秒、贡献减少${amount}；原行动与7灵性及原刻片费用仍然发生。`; }
  else { r.body.barrierApplications++; a.label += ` 下一可见精神冲击被束障实际减${amount}；没有减免身体攻击。`; }
}
export function resolveAbominationPlayerSlot(x: AbominationCombatSource, r: AbominationRuntime, id: AbominationMoveId, order: number, random: ActionRandomStream, curse = false): AbominationActionEvidence {
  expireWindows(r); const a = baseAction(x, r, 'PLAYER', id, order, random), b = r.body;
  const check = (difficulty: number) => { a.checkChance = computeCheckChance({ ability: 'knowledge', baseAbility: x.knowledge, difficulty, modifiers: [] }); const n = random.nextInt(1, 100); a.rolls.push(n); return n <= a.checkChance; };
  const pay = (s: number, m = 0) => { a.paidCost = s; a.mindCost = m; r.playerS -= s; r.playerM -= m; };
  const body = (gain: number, label: string) => {
    cancelWindows(r, a, '本人实际移动，原可见窗口失效'); a.mode = 'BODY'; a.attackKind = 'BODY'; a.selfGain = gain; a.threatens = gain > 0; a.travelMetres = 4; r.root.playerTravelMetres += 4; a.label = label + '；本人实际近前2米再退回2米。';
    if (x.policy !== 'ORDINARY' && gain > 0 && r.madman.policy === 'BURST_FIRST' && !r.madman.triggered && r.playerM >= 10 && r.playerS >= 2) {
      pay(2, 10); r.madman = { policy: r.madman.policy, triggered: true, mentalCost: 10, spiritualCost: 2 }; a.selfGain *= 1 + .25 * masteryFactor(x.burstMastery); a.label += '主动首次旧疯子爆发另实付2灵性10精神。';
    }
  };
  if (id === BARRIER || id === CRY) return resolveNewWindow(x, r, id, a, random);
  if (x.policy === 'ORDINARY' && id !== 'ACCIDENT' && id !== 'OBSERVE') { if (id === H || id === J) body(16 * a.physicalFactor, '本人普通身体攻击'); else { a.mode = 'ORDINARY_GUARD'; a.enemyReduction = 8 * a.physicalFactor; a.label = '普通格挡与观察，0超凡费用。'; } }
  else if (id === 'ACCIDENT') { a.mode = 'ACCIDENT'; a.selfGain = -22.5; a.label = '实际动作偏差，优势减少22.5。'; }
  else if (id === J) body(29.575 * masteryFactor(x.bodyMastery) * a.physicalFactor, '继承身体次击');
  else if (id === H) {
    const block = b.blocks.find(v => v.status === 'READY');
    if (x.clubHeld) body(16 * a.physicalFactor, '持自己的原短棍作普通攻击，不耗木块');
    else if (!block || r.playerS < 3) body(16 * a.physicalFactor, '没有可用原木块或灵性不足，改用普通身体攻击');
    else { pay(3); a.mode = 'ORIGINAL_BLOCK'; a.blockId = block.id; block.status = 'SPENT'; block.location = 'TARGET_GROUND'; block.usedRound = x.round;
      a.selfGain = 55 * masteryFactor(x.objectMastery); a.threatens = true; a.attackKind = 'BODY'; a.label = '自己买下的同一原木块移动2米攻击，随后留在目标脚边，不会复制或回箱。'; }
  } else if (id === B) {
    a.mode = 'DODGE'; if (r.playerS >= 2) { pay(2); a.enemyReduction = 17.55; a.label = '实付2灵性进行本槽灵化避让，之后同一身体显形。'; }
    else { a.enemyReduction = 8 * a.physicalFactor; a.label = '不足2灵性，进行普通格挡。'; }
  } else if (id === K) {
    if (b.link !== 'LINKED') {
      if (r.playerS < 4 || r.playerM < 1) a.label = '不足4灵性1精神，不能建立真实联系，普通观察。';
      else { pay(4, 1); cancelWindows(r, a, '本人实际接近，待用窗口失效'); a.mode = 'CONTACT'; b.contactAttempts++; b.contactDistanceMetres += 4; a.travelMetres = 4; r.root.playerTravelMetres += 4;
        a.succeeded = check(18); if (a.succeeded) { b.link = 'LINKED'; b.linkRound = x.round; }
        a.label = `本人实际近前2米接触同一罗德里克，再退回2米；${a.succeeded ? '建立有限联系' : '联系未成，费用保留'}。`; }
    } else if (b.lastFormRound === x.round || (curse && b.form === 'WOOD') || (!curse && b.enemyForm === 'RABBIT')) a.label = '本轮已尝试或原目标形态仍在；停止输入不会复原，也不重复收费或续期。';
    else if (r.playerS < (curse ? 4 : 6) || r.playerM < (curse ? 0 : 2)) a.label = '真实资源不足，普通观察，不施术或补充灵性。';
    else {
      pay(curse ? 4 : 6, curse ? 0 : 2); b.formAttempts++; b.lastFormRound = x.round; a.mode = curse ? 'SELF_FORM' : 'TARGET_FORM'; a.succeeded = check(curse ? 18 : 20);
      if (curse) { if (a.succeeded) { b.form = 'WOOD'; b.formUntilSeconds = r.root.clockSeconds + 60; } a.label = `主动选择旧本人诅咒源；${a.succeeded ? '自己的原身体暂为木偶' : '检定失败'}，只有本人真实受伤才可能有限映射，绝不免伤。`; }
      else {
        b.transfigurationAttempts++;
        if (a.succeeded) { a.resistanceChance = Math.max(25, Math.min(95, x.targetWill + 35)); const resistance = random.nextInt(1, 100); a.rolls.push(resistance); a.resisted = resistance <= a.resistanceChance; a.succeeded = !a.resisted; }
        if (a.succeeded) { cancelWindows(r, a, '目标实际形态改变，待用窗口失效'); b.transfigurationSuccesses++; b.enemyForm = 'RABBIT'; b.enemyFormUntilSeconds = r.root.clockSeconds + 90; b.weaponLocation = 'YARD'; }
        a.label = `${a.succeeded ? '同一罗德里克身体变为兔形，原杖实际落地；形态持续真实90秒，跨回合保留' : a.resisted ? '罗德里克以自己的意志抵抗，变形未成' : '知识检定失败，变形未成'}；健康、精神、灵性和原伤不因形态变化重置，费用照付。`;
      }
    }
  } else a.label = `普通观察罗德里克的${b.enemyForm === 'RABBIT' ? '兔形' : '人形'}、原杖位置及普通出口。`;
  if (a.threatens && r.guard) { const amount = Math.min(30, a.selfGain); a.selfGain -= amount; a.threatens = a.selfGain > 0; a.label += ` 对方已付屏护实际削减${amount}。`; r.guard = false; }
  return closeAction(a, r, random);
}
export function resolveAbominationEnemySlot(x: AbominationCombatSource, r: AbominationRuntime, planned: AbominationEnemyIntent, order: number, random: ActionRandomStream): AbominationActionEvidence {
  expireWindows(r); const a = baseAction(x, r, 'ENEMY', planned, order, random), b = r.body;
  const body = (why: string) => {
    a.id = 'BODY_STRIKE'; a.mode = 'BODY'; a.attackKind = 'BODY'; a.selfGain = (b.enemyForm === 'HUMAN' && b.weaponLocation === 'HAND' ? 25 : 10) * a.physicalFactor; a.threatens = a.selfGain > 0; a.travelMetres = 4;
    cancelWindows(r, a, '目标移动，未用可见窗口失效'); a.label += `${why}，同一身体实际近前2米再退回2米；身体攻击不会被精神束障削减。`;
  };
  if (b.enemyForm === 'HUMAN' && b.weaponLocation === 'YARD') { a.id = 'PICKUP'; a.mode = 'PICKUP'; b.weaponLocation = 'HAND'; b.pickUpUses++; a.label = '罗德里克亲自拾起落地的唯一原杖，本次行动只拾取，没有同时攻击或施术。'; }
  else if (planned === 'ACCIDENT') { a.mode = 'ACCIDENT'; a.label = '罗德里克实际失衡，没有贡献或费用。'; }
  else if (planned === 'REPOSITION' || planned === 'CALM' && b.enemySpirituality >= 3) {
    if (planned === 'CALM') { a.paidCost = 3; b.enemySpirituality -= 3; b.powerUses.CALM++; b.emotion = 'CALM'; } else b.repositionUses++;
    a.mode = planned; a.succeeded = true; a.travelMetres = 4; b.conditionVersion++; b.link = 'NONE'; cancelWindows(r, a, '目标遮挡并实际变位');
    a.label += `${planned === 'CALM' ? '实付3灵性平复心神并' : '普通'}实际移动4米，避开接触与视线，有限联系断开；未用精神窗口失效。旧兔形只能等真实期限届满，不免费解除形态。`;
  } else if (planned === 'WARD' && b.enemyForm === 'HUMAN' && b.enemySpirituality >= 4 && !r.guardAttempted) {
    a.paidCost = 4; b.enemySpirituality -= 4; b.powerUses.WARD++; r.guard = true; r.guardAttempted = true; a.succeeded = true; a.mode = 'WARD';
    a.label = '实付4灵性完成原手势屏护，下一次实际身体攻击至多减30；本轮不会重复续期或收费。';
  } else if (planned === 'WARD' && r.guardAttempted && b.enemyForm === 'HUMAN') a.label = '本轮已使用有限屏护，普通观察，不重复付费。';
  else if (planned === 'MIND_SPIKE' && b.enemySpirituality >= 7 && b.plates.some(p => p.status === 'HELD')) {
    const plate = b.plates.find(p => p.status === 'HELD')!; plate.status = 'SPENT'; plate.usedRound = x.round; plate.usedOrder = order;
    a.paidCost = 7; b.enemySpirituality -= 7; b.powerUses.MIND_SPIKE++; a.mode = 'MIND_SPIKE'; a.attackKind = 'MENTAL'; a.selfGain = 75; a.succeeded = true;
    const receipt: AbominationForceReceipt = { id: `${plate.id}:spent:${x.round}:${order}`, targetId: x.targetId, power: 'MIND_SPIKE', kind: 'MENTAL', plateId: plate.id, paidCost: 7, round: x.round, order, atSeconds: a.atSeconds, position: 'YARD', visible: true, conditionVersion: b.conditionVersion };
    a.receipt = receipt; b.lastForceReceipt = structuredClone(receipt); a.label = '罗德里克以保留的心智施放可见精神刻片冲击75，实际耗7灵性和同一原刻片；兔形不封死心智能力。';
    // The planned, visible action and both original costs exist before either new effect can apply.
    applyWindow(r, a, 'cry'); expireWindows(r); applyWindow(r, a, 'barrier'); a.mentalPressure = a.selfGain > 0;
  } else body(planned === 'BODY_STRIKE' ? '使用自己的原杖或当前无武器身体攻击' : '真实资源不足或兔形不能完成原手势，改作普通身体攻击');
  return closeAction(a, r, random);
}
export function validAbominationInjuries(injuries: SliceInjury[], revision: number): boolean {
  return Array.isArray(injuries) && new Set(injuries.map(i => i.id)).size === injuries.length && injuries.every(i => shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && !!i.id && ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision, 0, revision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision, revision)));
}
export function validAbominationBody(b: AbominationCombatBody, clock: number, maxRound: number, revision: number, originals: AbominationOriginals): boolean { try {
  if (!shape(b, Object.keys(createAbominationBody())) || !integer(maxRound) || !integer(clock) || !integer(b.enemyHealth, 0, 100) || b.enemyMind !== 100 || !integer(b.enemySpirituality, 0, 120) || !integer(b.enemyRisk) || !validAbominationInjuries(b.enemyInjuries, revision) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(b.enemyStatus) || (b.enemyStatus === 'DEAD') !== (b.enemyHealth === 0) || !['HAND', 'YARD'].includes(b.weaponLocation)) return false;
  if (!['HUMAN', 'RABBIT'].includes(b.enemyForm) || (b.enemyForm === 'RABBIT' ? !integer(b.enemyFormUntilSeconds, clock + 1, clock + 90) || b.weaponLocation !== 'YARD' : b.enemyFormUntilSeconds !== null) || !['HUMAN', 'WOOD'].includes(b.form) || (b.form === 'WOOD' ? !integer(b.formUntilSeconds, clock + 1, clock + 60) : b.formUntilSeconds !== null)) return false;
  if (!b.reflectionHistory.every(v => shape(v, ['round', 'severity', 'playerDamage', 'enemyDamage', 'playerInjuryId', 'enemyInjuryId']) && integer(v.round, 1, maxRound) && ['LIGHT', 'HEAVY'].includes(v.severity) && v.playerDamage === (v.severity === 'LIGHT' ? 10 : 30) && v.enemyDamage === (v.severity === 'LIGHT' ? 5 : 15) && typeof v.playerInjuryId === 'string' && !!v.playerInjuryId && b.enemyInjuries.some(i => i.id === v.enemyInjuryId && i.severity === v.severity))) return false;
  if (!same(b.blocks, originals.blocks) || !Array.isArray(originals.blocks) || originals.blocks.length !== 3 || !originals.blocks.every((v, i) => shape(v, ['id', 'owner', 'status', 'location', 'usedRound']) && v.id === `AE2-BLOCK-${i + 1}` && v.owner === 'PLAYER' && v.status === 'SPENT' && v.location === 'TARGET_GROUND' && integer(v.usedRound, 1))) return false;
  if (!['NONE', 'LINKED'].includes(b.link) || (b.linkRound === null ? b.link !== 'NONE' : !integer(b.linkRound, 1, maxRound)) || (b.lastFormRound === null ? b.formAttempts !== 0 : !integer(b.lastFormRound, 1, maxRound))) return false;
  if (![b.contactAttempts, b.formAttempts, b.transfigurationAttempts, b.transfigurationSuccesses, b.pickUpUses, b.repositionUses].every(n => integer(n, 0, maxRound * 6)) || b.contactDistanceMetres !== b.contactAttempts * 4 || b.transfigurationSuccesses > b.transfigurationAttempts || b.transfigurationAttempts > b.formAttempts || b.pickUpUses > b.transfigurationSuccesses || !Array.isArray(b.reflectionHistory)) return false;
  if (!shape(b.powerUses, ABOMINATION_POWER_IDS) || !ABOMINATION_POWER_IDS.every(id => integer(b.powerUses[id], 0, 6 * maxRound)) || b.powerUses.WARD > maxRound || b.powerUses.MIND_SPIKE > 3 || b.enemySpirituality !== 120 - ABOMINATION_POWERS.reduce((n, p) => n + p.cost * b.powerUses[p.id], 0) || !validAbominationPlates(b.plates) || b.plates.filter(p => p.status === 'SPENT').length !== b.powerUses.MIND_SPIKE || b.plates.some(p => p.usedRound !== null && p.usedRound > maxRound)) return false;
  if (!b.piece || !validAbominationCombatPiece(b.piece) || !integer(b.barrierApplications, 0, 3) || !integer(b.cryApplications, 0, 3) || b.piece.wear !== b.barrierApplications + b.cryApplications || b.hesitationSeconds !== b.cryApplications * 3 || b.conditionVersion !== 1 + b.powerUses.CALM + b.repositionUses || b.emotion !== (b.powerUses.CALM ? 'CALM' : 'ANGRY')) return false;
  for (const [key, kind] of [['barrier', 'BARRIER'], ['cry', 'CRY']] as const) {
    const w = b[key]; if (w !== null && (!shape(w, ['kind', 'round', 'order', 'castAt', 'expiresAt', 'conditionVersion']) || w.kind !== kind || !integer(w.round, 1, maxRound) || !integer(w.order, 0, 11) || !integer(w.castAt, Math.max(0, clock - 19), clock) || w.expiresAt !== w.castAt + 20 || w.expiresAt <= clock || w.conditionVersion !== b.conditionVersion)) return false;
  }
  if (b.lastForceReceipt) { const v = b.lastForceReceipt;
    if (!shape(v, ['id', 'targetId', 'power', 'kind', 'plateId', 'paidCost', 'round', 'order', 'atSeconds', 'position', 'visible', 'conditionVersion']) || v.targetId !== ABOMINATION_TARGET_ID || v.power !== 'MIND_SPIKE' || v.kind !== 'MENTAL' || v.paidCost !== 7 || !integer(v.round, 1, maxRound) || !integer(v.order, 0, 11) || !integer(v.atSeconds, 0, clock) || v.position !== 'YARD' || v.visible !== true || !integer(v.conditionVersion, 1, b.conditionVersion) || !b.plates.some(p => p.id === v.plateId && p.usedRound === v.round && p.usedOrder === v.order) || v.id !== `${v.plateId}:spent:${v.round}:${v.order}`) return false;
  } else if (b.powerUses.MIND_SPIKE > 0) return false;
  return true;
} catch { return false; } }
const SOURCE_KEYS = ['runId', 'revision', 'week', 'round', 'encounterId', 'targetId', 'attemptWeek', 'startHistoryIndex', 'targetName', 'targetAge', 'targetSequence', 'targetCore', 'targetWill', 'maxActionCount', 'actualBody', 'independentMind', 'enemyWeapon', 'yardId', 'playerPosition', 'enemyDistanceMetres', 'ordinaryExit', 'pursuit', 'thirdPartiesInArea', 'automaticAllyImmunity', 'playerHealth', 'playerMind', 'playerSpirituality', 'playerInjuries', 'playerRisk', 'physique', 'perception', 'will', 'knowledge', 'objectMastery', 'bodyMastery', 'burstMastery', 'clubHeld', 'playerClubId', 'preparation', 'site', 'operation', 'originals', 'body', 'budget', 'finance', 'inheritedMastery', 'mastery', 'policy', 'randomSeed', 'randomCursor'] as const;
export function validAbominationCombatSource(x: AbominationCombatSource): boolean { try {
  if (!shape(x, SOURCE_KEYS) || typeof x.runId !== 'string' || !x.runId || !integer(x.revision, 1) || !integer(x.week, 1) || !integer(x.round, 1, x.revision) || !integer(x.startHistoryIndex) || x.attemptWeek !== x.week || x.encounterId !== 'ABOMINATION_DISPUTE' || x.targetId !== ABOMINATION_TARGET_ID || x.targetName !== '罗德里克·霍尔' || x.targetAge !== 45 || x.targetSequence !== 1 || x.targetCore !== 24 || x.targetWill !== 22 || x.maxActionCount !== 6) return false;
  if (x.actualBody !== true || x.independentMind !== true || x.enemyWeapon !== 'AB1-RODERICK-ROD' || x.yardId !== ABOMINATION_SITE || x.playerPosition !== 'YARD' || x.enemyDistanceMetres !== 2 || x.ordinaryExit !== 'OPEN' || x.pursuit !== false || x.thirdPartiesInArea !== 0 || x.automaticAllyImmunity !== false || !ABOMINATION_POLICIES.includes(x.policy)) return false;
  const p = x.site, prep = x.preparation, budget = x.budget;
  if (![x.playerHealth, x.playerMind].every(n => integer(n, 1, 100)) || !integer(x.playerSpirituality, 0, 120) || !integer(x.playerRisk) || !validAbominationInjuries(x.playerInjuries, x.revision) || !validateAbominationCurrentSite(p, x.originals) || p.playerLocation !== 'YARD' || p.volunteer.location !== 'OUTSIDE' || !p.volunteer.alive || p.volunteer.form !== 'HUMAN' || p.clothing.location !== 'ELSA' || !p.clothing.worn || p.bag.location !== 'ELSA' || p.guide.location !== 'OUTSIDE') return false;
  if (!validateAbominationPreparation(prep) || prep.runId !== x.runId || prep.randomSeed !== x.randomSeed || prep.randomCursor > x.randomCursor || prep.revision >= x.revision || prep.week !== x.week || x.revision < prep.revision + 2 + x.round - 1 || !same(x.originals, prep.originals) || !same(x.operation, prep.operation) || !same(x.finance, prep.finance)) return false;
  if (x.round === 1 && !same(x.body, { ...createAbominationBody(), blocks: structuredClone(x.originals.blocks), piece: createAbominationCombatPiece() })) return false;
  if (!validAbominationBody(x.body, p.clockSeconds, x.round - 1, x.revision, x.originals) || x.body.enemyStatus !== 'RESISTING' || x.body.link === 'LINKED' && (x.body.linkRound === null || x.round > x.body.linkRound + 2) || p.clockSeconds !== prep.lifeClockSeconds + 12 + 60 * (x.round - 1) + x.body.hesitationSeconds) return false;
  const timedEvidence = [x.body.lastForceReceipt && { round: x.body.lastForceReceipt.round, order: x.body.lastForceReceipt.order, at: x.body.lastForceReceipt.atSeconds }, x.body.barrier && { round: x.body.barrier.round, order: x.body.barrier.order, at: x.body.barrier.castAt }, x.body.cry && { round: x.body.cry.round, order: x.body.cry.order, at: x.body.cry.castAt }];
  if (timedEvidence.some(v => { if (!v) return false; const delay = v.at - prep.lifeClockSeconds - 12 - 60 * (v.round - 1) - 5 * v.order; return !integer(delay, 0, x.body.hesitationSeconds) || delay % 3 !== 0; })) return false;
  const expectedSite = abominationApproachedSite(prep.site, x.originals); expectedSite.clockSeconds = p.clockSeconds; expectedSite.playerTravelMetres = p.playerTravelMetres;
  if (!same(p, expectedSite) || !integer(p.playerTravelMetres, prep.site.playerTravelMetres + 4) || (p.playerTravelMetres - prep.site.playerTravelMetres - 4) % 4 !== 0) return false;
  if (!same({ ...budget, health: prep.after.health, mind: prep.after.mind, spirituality: prep.after.spirituality, mastery: prep.after.mastery, injuries: prep.after.injuries, injuryRisk: prep.after.injuryRisk }, { ...prep.after, actions: prep.after.actions - 1 })) return false;
  if (!shape(x.inheritedMastery, ABOMINATION_INHERITED_IDS) || !ABOMINATION_INHERITED_IDS.every(id => integer(x.inheritedMastery[id], 0, 500) && x.inheritedMastery[id] === x.mastery[id] && x.mastery[id] === prep.after.mastery[id]) || !shape(x.mastery, [...ABOMINATION_INHERITED_IDS, BARRIER, CRY]) || !integer(x.mastery[BARRIER], 0, 500) || !integer(x.mastery[CRY], 0, 500)) return false;
  if (x.mastery[BARRIER] !== Math.min(500, prep.after.mastery[BARRIER]! + x.body.barrierApplications * 8) || x.mastery[CRY] !== Math.min(500, prep.after.mastery[CRY]! + x.body.cryApplications * 8) || !same(budget.mastery, x.mastery) || budget.health !== x.playerHealth || budget.mind !== x.playerMind || budget.spirituality !== x.playerSpirituality || budget.injuryRisk !== x.playerRisk || !same(budget.injuries, x.playerInjuries) || budget.sequence !== 1 || !same(budget.coreStats, { physique: x.physique, perception: x.perception, will: x.will, knowledge: x.knowledge })) return false;
  if (!['town-short-club', null].includes(x.playerClubId) || x.clubHeld !== (x.playerClubId !== null) || ![x.physique, x.perception, x.will, x.knowledge].every(n => integer(n, 0, 500)) || x.objectMastery !== x.inheritedMastery[H] || x.bodyMastery !== x.inheritedMastery['chained.s6.steel-body'] || x.burstMastery !== x.inheritedMastery['chained.s8.reason-sacrifice']) return false;
  return typeof x.randomSeed === 'string' && x.randomSeed.length > 0 && x.randomSeed.length <= 256 && integer(x.randomCursor);
} catch { return false; } }
export const validateAbominationCombatSource = validAbominationCombatSource;
export interface AbominationRoundOutcome extends AbominationCombatBody {
  targetId: typeof ABOMINATION_TARGET_ID; round: number; source: AbominationCombatSource; stance: SliceStance; continuing: boolean; cursePolicy: boolean; madmanBurst: MadmanRoundPolicy;
  playerHealthAfter: number; playerMindAfter: number; playerSpiritualityAfter: number; playerInjuriesAfter: SliceInjury[]; playerRiskAfter: number;
  siteAfter: AbominationSite; elapsedSeconds: number; masteryAfter: Record<string, number>; operationAfter: AncientEvilOperationState; expiredWindows: AbominationWindow[]; randomCursorAfter: number; playerActions: AbominationActionEvidence[]; enemyActions: AbominationActionEvidence[];
}
export type AbominationResolution = 'CONTINUE' | 'PLAYER_DEAD' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED' | 'RETREATED';
function penalty(n: number, max: number) { const f = n / max; return f > .75 ? 0 : f > .5 ? .05 : f > .25 ? .1 : .2; }
function base(core: number, h: number, m: number, s: number) { return (1500 + Math.min(core, 300)) * (1 - Math.min(.4, penalty(h, 100) + penalty(m, 100) + penalty(s, 120))); }
function weights(risk: number) { const death = Math.min(100, 5 + Math.min(risk, 10) * 10), shifted = death - 5; return { light: Math.max(0, 65 - shifted), heavy: Math.max(0, 30 - Math.max(0, shifted - 65)), death }; }
export function replayAbominationCombatRound(x: AbominationCombatSource, stance: SliceStance, cursePolicy = false, madmanPolicy: MadmanBurstPolicy = 'HOLD'): { round: SliceCombatRound; outcome: AbominationResolution } {
  if (!validAbominationCombatSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance) || typeof cursePolicy !== 'boolean' || !['HOLD', 'BURST_FIRST'].includes(madmanPolicy)) throw new Error('缺少真实战斗来源或有效策略。');
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = createAbominationRuntime(x, madmanPolicy), b = r.body;
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = abominationActionCount(playerCountRoll), enemyCount = abominationEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: AbominationActionEvidence[] = [], enemies: AbominationActionEvidence[] = [], remaining = { PLAYER: playerCount, ENEMY: enemyCount };
  let retreat: SliceCombatRound['retreat'] = 'NONE';
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) {
    for (const actor of order) {
      if (!remaining[actor]) continue;
      if (actor === 'PLAYER' && stance === 'RETREAT') { remaining.PLAYER = 0; retreat = rng.nextInt(1, 100) <= 50 ? 'SUCCESS' : 'FAILURE'; if (retreat === 'SUCCESS') { remaining.ENEMY = 0; break; } continue; }
      remaining[actor]--; const index = players.length + enemies.length;
      if (actor === 'PLAYER') players.push(resolveAbominationPlayerSlot(x, r, drawPlayer(rng, stance, x.policy), index, rng, cursePolicy));
      else enemies.push(resolveAbominationEnemySlot(x, r, drawAbominationEnemyAbility(rng), index, rng));
    }
  }
  const sum = (a: AbominationActionEvidence[], key: 'selfGain' | 'enemyReduction') => a.reduce((n, v) => n + v[key], 0);
  const playerAdvantage = Math.max(150, base(x.physique * .5 + x.perception * .2 + x.will * .15 + x.knowledge * .15, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(150, base(x.targetCore, x.body.enemyHealth, x.body.enemyMind, x.body.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction'));
  const winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100, winner = retreat === 'SUCCESS' ? 'ENEMY' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  let playerHealth = x.playerHealth, playerRisk = x.playerRisk, outcome: AbominationResolution = retreat === 'SUCCESS' ? 'RETREATED' : 'CONTINUE';
  const playerInjuries = structuredClone(x.playerInjuries); let consequenceWeights: SliceCombatRound['consequenceWeights'] = null, consequenceRoll: number | undefined, consequenceDomain: SliceCombatRound['consequenceDomain'];
  if (retreat !== 'SUCCESS') {
    const loser = winner === 'PLAYER' ? 'ENEMY' : 'PLAYER', attacks = loser === 'PLAYER' ? enemies : players, injuries = loser === 'PLAYER' ? playerInjuries : b.enemyInjuries;
    if (attacks.some(a => a.threatens && a.attackKind === 'BODY')) {
      let risk = loser === 'PLAYER' ? playerRisk : b.enemyRisk; if (injuries.length) risk++; if (loser === 'PLAYER') playerRisk = risk; else b.enemyRisk = risk;
      consequenceDomain = 'BODY'; consequenceWeights = weights(risk); consequenceRoll = rng.nextInt(1, 100);
      const severity = consequenceRoll <= consequenceWeights.light ? 'LIGHT' : consequenceRoll <= consequenceWeights.light + consequenceWeights.heavy ? 'HEAVY' : 'DEATH';
      if (severity === 'DEATH') { if (loser === 'PLAYER') playerHealth = 0; else { b.enemyHealth = 0; b.enemyStatus = 'DEAD'; } }
      else {
        const injury: SliceInjury = { id: `${x.runId}:combat:${x.round}:${loser}:${x.revision + 1}:${injuries.length}`, severity, acquiredRevision: x.revision + 1, treatedRevision: null }; injuries.push(injury);
        const damage = severity === 'LIGHT' ? 10 : 30; if (loser === 'PLAYER') playerHealth = Math.max(0, playerHealth - damage); else b.enemyHealth = Math.max(0, b.enemyHealth - damage);
        if (loser === 'PLAYER' && cursePolicy && b.form === 'WOOD' && b.link === 'LINKED') {
          const enemyDamage = severity === 'LIGHT' ? 5 : 15, enemyInjuryId = `${x.runId}:abomination-reflection:${x.round}:${x.revision + 1}`;
          b.enemyHealth = Math.max(0, b.enemyHealth - enemyDamage); b.enemyInjuries.push({ id: enemyInjuryId, severity, acquiredRevision: x.revision + 1, treatedRevision: null });
          b.reflectionHistory.push({ round: x.round, severity, playerDamage: damage, enemyDamage, playerInjuryId: injury.id, enemyInjuryId });
        }
        if (b.enemyHealth === 0) b.enemyStatus = 'DEAD'; else if (loser === 'ENEMY' && severity === 'HEAVY' || loser === 'PLAYER' && severity === 'HEAVY' && b.enemyHealth <= 40 && b.reflectionHistory.at(-1)?.round === x.round) b.enemyStatus = 'SURRENDERED';
      }
      if (playerHealth === 0) outcome = 'PLAYER_DEAD'; else if (b.enemyHealth === 0) outcome = 'ENEMY_DEAD'; else if (b.enemyStatus === 'SURRENDERED') outcome = 'ENEMY_SURRENDERED';
    } else if (loser === 'PLAYER' && attacks.some(a => a.mentalPressure)) { consequenceDomain = 'MENTAL'; r.playerM = Math.max(0, r.playerM - 10); if (r.playerM === 0) outcome = 'RETREATED'; }
  }
  if (outcome === 'CONTINUE' && r.playerM === 0) outcome = 'RETREATED';
  const elapsedSeconds = 60 + b.hesitationSeconds - x.body.hesitationSeconds;
  advanceAbominationCombatClock(r, x.site.clockSeconds + elapsedSeconds - r.root.clockSeconds);
  if (outcome !== 'CONTINUE' || b.linkRound !== null && x.round >= b.linkRound + 2) b.link = 'NONE';
  if (b.enemyHealth === 0 || b.enemyStatus === 'SURRENDERED') b.weaponLocation = 'YARD';
  const o: AbominationRoundOutcome = { ...structuredClone(b), targetId: ABOMINATION_TARGET_ID, round: x.round, source: structuredClone(x), stance, continuing: outcome === 'CONTINUE', cursePolicy,
    madmanBurst: { ...r.madman }, playerHealthAfter: playerHealth, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, playerInjuriesAfter: playerInjuries, playerRiskAfter: playerRisk,
    siteAfter: structuredClone(r.root), elapsedSeconds, masteryAfter: { ...r.mastery }, operationAfter: structuredClone(x.operation), expiredWindows: structuredClone(r.expiredWindows), randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies };
  const round: SliceCombatRound = { round: x.round, stance, first, playerCount, enemyCount, playerCountRoll, enemyCountRoll,
    moves: [...players, ...enemies].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })),
    playerAdvantage, enemyAdvantage, winChance, winner, consequence: '', consequenceWeights, retreat,
    ...(consequenceDomain === undefined ? {} : { consequenceDomain }), ...(consequenceRoll === undefined ? {} : { consequenceRoll }), abominationOutcome: o, madmanBurst: { ...r.madman } };
  round.consequence = abominationCombatConsequence(round); return { round, outcome };
}
export function validateAbominationRoundOutcome(v: unknown): v is AbominationRoundOutcome {
  try { const o = v as AbominationRoundOutcome; return !!o && same(o, replayAbominationCombatRound(o.source, o.stance, o.cursePolicy, o.madmanBurst.policy).round.abominationOutcome); } catch { return false; }
}
export function validateAbominationCombatRound(round: SliceCombatRound): boolean {
  try { const o = round.abominationOutcome; return !!o && same(round, replayAbominationCombatRound(o.source, o.stance, o.cursePolicy, o.madmanBurst.policy).round); } catch { return false; }
}
export function nextAbominationCombatSource(o: AbominationRoundOutcome): AbominationCombatSource {
  const spirituality = Math.min(120, o.playerSpiritualityAfter + 12);
  return { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter,
    playerSpirituality: spirituality, playerInjuries: structuredClone(o.playerInjuriesAfter), playerRisk: o.playerRiskAfter,
    site: structuredClone(o.siteAfter), body: abominationCombatBody(o), mastery: { ...o.masteryAfter }, operation: structuredClone(o.operationAfter),
    budget: { ...structuredClone(o.source.budget), health: o.playerHealthAfter, mind: o.playerMindAfter, spirituality, mastery: { ...o.masteryAfter }, injuries: structuredClone(o.playerInjuriesAfter), injuryRisk: o.playerRiskAfter }, randomCursor: o.randomCursorAfter };
}
export function abominationCombatConsequence(round: SliceCombatRound): string {
  const o = round.abominationOutcome; if (!o) throw new Error('缺少神孽真实回合来源。'); const who = round.winner === 'PLAYER' ? '罗德里克' : '你';
  let text = round.retreat === 'SUCCESS' ? '通过撤离判定，将沿4米普通通路退出，步行4米4秒。' : round.consequenceDomain === 'BODY' ? `${who}承受实际身体攻势，按共同身体伤势盘结算。` : round.consequenceDomain === 'MENTAL' ? '你承受实际精神压力，精神−10，没有身体伤口或身体风险。' : '本轮没有实际致伤来源，不掷身体伤势盘。';
  if (o.playerHealthAfter === 0) text += '你已死亡，同一身体不能因形态复原而复活。'; else if (o.enemyStatus === 'DEAD') text += '罗德里克已死亡，原身体与原杖留在院落。'; else if (o.enemyStatus === 'SURRENDERED') text += '罗德里克因实际重伤停止抵抗并将原杖放在脚边。';
  return `${text} 本轮真实经过${o.elapsedSeconds}秒，包含${o.hesitationSeconds - o.source.body.hesitationSeconds}秒已执行迟疑；没有取消敌人原行动或费用。原杖${o.weaponLocation === 'HAND' ? '仍由同一主人持握' : '留在原地'}，当前${o.enemyForm === 'RABBIT' ? '兔形仍按真实期限保留' : '人形'}。同一辅助片余${o.piece!.charges}/3、磨损${o.piece!.wear}；原刻片余${o.plates.filter(p => p.status === 'HELD').length}/3。旧莱娜死亡、卡尔德投降及旧三木块耗尽原样保留。`;
}
export function projectAbominationCombat(s: SliceState) {
  const e = s.abomination.encounter, visible = isAbomination(s), last = s.combat?.encounterId === 'ABOMINATION_DISPUTE' ? s.combat.lastRound?.abominationOutcome : e.terminal ? s.combatHistory[e.terminal.historyIndex]?.abominationOutcome : null;
  return { enemyName: visible ? '罗德里克·霍尔（45岁）' : '', targetId: visible ? e.targetId : null, playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, maxSpirituality: 120,
    enemyHealth: visible ? e.enemyHealth : null, enemyMind: visible ? e.enemyMind : null, enemySpirituality: visible ? e.enemySpirituality : null, powerUses: visible ? { ...e.powerUses } : null,
    site: visible ? structuredClone(e.currentSite) : null, piece: visible ? structuredClone(e.piece) : null, plates: visible ? structuredClone(e.plates) : [], policy: e.policy,
    enemyForm: e.enemyForm, enemyFormUntilSeconds: e.enemyFormUntilSeconds, weaponLocation: e.weaponLocation, form: e.form, link: e.link, blocks: structuredClone(e.blocks),
    barrier: structuredClone(e.barrier), cry: structuredClone(e.cry), hesitationSeconds: e.hesitationSeconds, conditionVersion: e.conditionVersion,
    originalExit: true, pursuit: false, distanceMetres: 2, automaticAllyImmunity: false, alliesPresent: 0, source: visible ? currentAbominationCombatSource(s) : null,
    lastActionSequence: visible && last ? [...last.playerActions, ...last.enemyActions].sort((a, b) => a.order - b.order).map(a => structuredClone(a)) : [],
    countWheel: ABOMINATION_COUNT_WHEEL.map(x => ({ ...x })), enemyCountWheel: ABOMINATION_ENEMY_COUNT_WHEEL.map(x => ({ ...x })), enemyAbilityWheel: ABOMINATION_ENEMY_ABILITY_WHEEL.map(x => ({ ...x })),
    summary: visible ? '体50%感20%意15%知15%；基础1500、核心上限300、状态最多减40%、底150。双方1至6动作10/15/25/25/15/10；旧六槽30/15/20/20/10/5，新两槽各20。每动作5秒，每轮60秒另加实际3秒迟疑；继续战斗仅本人回12灵性。束障只减下一可见精神攻势30，震声令下一精神动作实际迟疑3秒且贡献减30，原动作与费用保留。新片仅3次，实际应用才消耗；移动、遮挡、抵抗、真实到期都有效。身体与精神后果按实际攻势区分。' : '' };
}
export type AbominationCombatProjection = ReturnType<typeof projectAbominationCombat>;
