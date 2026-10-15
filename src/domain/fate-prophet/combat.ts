import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicGameDate, PublicCheckResult } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { WINNER_COUNT_WHEEL, winnerActionCount } from '../winner/combat.js';
import type { WinnerLuckPolicy, WinnerLuck } from '../winner/types.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import type { FateProphetSceneRoot } from './life.js';
import { FATE_PROPHET_TARGET_ID, FATE_PROPHET_POWER_IDS, FATE_PROPHET_POWERS, combatBody, hasFateProphetDisputeOpponent, validateFateProphetPreparation,
  type FateProphetCombatBody, type FateProphetEnemyIntent, type FateProphetPreparation, type FateProphetPendingKind } from './encounter.js';

/** Finite original-game adaptations, never a complete canon skill library. */
export const FATE_PROPHET_COUNT_WHEEL = WINNER_COUNT_WHEEL;
export const FATE_PROPHET_ENEMY_COUNT_WHEEL = WINNER_COUNT_WHEEL;
export const fateProphetActionCount = winnerActionCount;
export const fateProphetEnemyActionCount = winnerActionCount;
export const FORESIGHT = 'wheel.s2.event-foresight', HAZARD = 'wheel.s2.hazard-adjustment';
const OLD_B = 'wheel.s3.deviation-buffer', OLD_K = 'wheel.s3.future-impediment';
export type FateProphetMoveId = 'BODY_STRIKE' | 'BODY_FOLLOWUP' | typeof FORESIGHT | typeof HAZARD | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly { id: FateProphetMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'BODY_STRIKE', label: 'H：原身体主击18×身体；原短棍持握时16×身体', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: 'J：继承计算次击22.75×原掌握×身体', weight: 15, stance: 'ATTACK' },
  { id: FORESIGHT, label: 'B：事件先兆5灵性1精神，知识20；下一次实际攻击贡献减30%', weight: 20, stance: 'DEFEND' },
  { id: HAZARD, label: 'K：风险调整须选用1原积运5灵性1精神，知识20；下一次实际身体打击或法术冲击贡献减半', weight: 20, stance: 'CONTROL' },
  { id: 'OBSERVE', label: 'R：观察当前身体、原杖与普通出口；不窥视未来票', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: 'A：实际动作偏差，固定−22.5', weight: 5, stance: null },
];
export const FATE_PROPHET_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '有限弧光：5灵性，70身体攻击贡献', weight: 35 },
  { id: 'WARD', label: '有限屏护：4灵性，敌方−30', weight: 25 },
  { id: 'BODY_STRIKE', label: '本人原杖打击：20×身体', weight: 25 },
  { id: 'COMPOSE', label: '本人凝神：4灵性，贡献8，清除待用修正并抵抗本轮新输入', weight: 10 },
  { id: 'ACCIDENT', label: '实际偏差：−22.5，零灵性', weight: 5 },
];
export const isFateProphet = (s: SliceState) => s.progression.pathwayId === 'wheel' && s.progression.sequence === 2;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (a.stance === stance && stance !== null ? 5 : 4));
export function fateProphetAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const w = tickets(stance), total = w.reduce((a, b) => a + b, 0); return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: w[i]! / total * 100 }));
}
export function drawFateProphetAbility(random: ActionRandomStream, _s: SliceState | null, stance: SliceStance | null): FateProphetMoveId {
  const w = tickets(stance); let n = random.nextInt(1, w.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= w[i]!; if (n <= 0) return a.id; } throw new Error('先知行动盘无效。');
}
export function drawFateProphetEnemyAbility(random: ActionRandomStream): FateProphetEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of FATE_PROPHET_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as FateProphetEnemyIntent; } throw new Error('洛温行动盘无效。');
}
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
const physicalAt = (n: number) => n > 75 ? 1 : n > 50 ? .95 : n > 25 ? .9 : .8;
const factor = (n: number) => .65 + .35 * n / 500;
export function validFateProphetLuck(l: WinnerLuck, week: number): boolean {
  return shape(l, ['stored', 'accumulated', 'spent', 'lastAccumulateWeek']) && integer(l.stored, 0, 3) && integer(l.accumulated) && integer(l.spent) && l.stored === l.accumulated - l.spent && (l.lastAccumulateWeek === null ? l.accumulated === 0 : integer(l.lastAccumulateWeek, 1, week));
}
export interface FateProphetCombatSource {
  runId: string; revision: number; week: number; date: PublicGameDate; round: number; encounterId: 'FATE_PROPHET_DISPUTE'; targetId: typeof FATE_PROPHET_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetName: '洛温·米勒'; targetAge: 42; targetPathway: 'original-caster'; targetSequence: 3; targetCore: 22;
  actualBody: true; independentMind: true; enemyWeapon: 'FP2-ROWAN-ROD'; weaponOwner: typeof FATE_PROPHET_TARGET_ID; yardId: 'CW3-MECHANICAL-WORKSHOP'; enemyPosition: 'BETWEEN_A_AND_B'; enemyDistanceMetres: 2;
  ordinaryExit: 'OPEN'; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false; freeSkillLibrary: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; playerInjuries: SliceInjury[]; playerRisk: number;
  physique: number; perception: number; will: number; knowledge: number; calculationMastery: number; awarenessMastery: number; stormMastery: number; passiveMastery: number; clubHeld: boolean;
  luck: WinnerLuck; preparation: FateProphetPreparation; root: FateProphetSceneRoot; body: FateProphetCombatBody; randomSeed: string; randomCursor: number;
}
export function currentFateProphetCombatSource(s: SliceState): FateProphetCombatSource | null {
  if (!hasFateProphetDisputeOpponent(s)) return null; const e = s.fateProphet.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, date: { ...s.date }, round: c.round, encounterId: 'FATE_PROPHET_DISPUTE', targetId: FATE_PROPHET_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetName: '洛温·米勒', targetAge: 42, targetPathway: 'original-caster', targetSequence: 3, targetCore: 22,
    actualBody: true, independentMind: true, enemyWeapon: 'FP2-ROWAN-ROD', weaponOwner: FATE_PROPHET_TARGET_ID, yardId: 'CW3-MECHANICAL-WORKSHOP', enemyPosition: 'BETWEEN_A_AND_B', enemyDistanceMetres: 2,
    ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false, freeSkillLibrary: false,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, playerInjuries: structuredClone(s.injuries), playerRisk: s.injuryRisk,
    ...s.character.coreStats, calculationMastery: s.progression.mastery['wheel.s8.calculation-control'] ?? 0, awarenessMastery: s.progression.mastery['wheel.s6.disaster-awareness'] ?? 0,
    stormMastery: s.progression.mastery['wheel.s6.mental-storm'] ?? 0, passiveMastery: s.progression.mastery['wheel.s7.passive-luck'] ?? 0, clubHeld: s.town.clubLocation === 'HAND',
    luck: { ...s.winner.luck }, preparation: structuredClone(e.preparation!), root: structuredClone(s.chaosWalker.life), body: combatBody(e), randomSeed: s.random.seed, randomCursor: s.random.cursor };
}
export interface FateProphetActionEvidence {
  order: number; actor: 'PLAYER' | 'ENEMY'; id: string; planned: string; selectedAbility: string; fallbackReason: string | null; mode: string; label: string;
  selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean; attackKind: 'NONE' | 'BODY' | 'ARC' | 'MIND'; rawContribution: number;
  paidCost: number; mindCost: number; luckCost: 0 | 1; physicalFactor: number; check: PublicCheckResult | null; succeeded: boolean; resisted: boolean;
  pendingBefore: FateProphetPendingKind | null; pendingAfter: FateProphetPendingKind | null; pendingApplied: FateProphetPendingKind | null;
  atSeconds: number; elapsedSeconds: 5; travelMetres: number; randomCursorBefore: number; randomCursorAfter: number;
  playerMindAfter: number; playerSpiritualityAfter: number; enemySpiritualityAfter: number; luckAfter: WinnerLuck;
}
export interface FateProphetRuntime { body: FateProphetCombatBody; root: FateProphetSceneRoot; playerS: number; playerM: number; luck: WinnerLuck; winnerPolicy: WinnerLuckPolicy }
export function createFateProphetRuntime(x: FateProphetCombatSource, winnerPolicy: WinnerLuckPolicy = 'HOLD'): FateProphetRuntime {
  return { body: structuredClone(x.body), root: structuredClone(x.root), playerS: x.playerSpirituality, playerM: x.playerMind, luck: { ...x.luck }, winnerPolicy };
}
export function advanceFateProphetCombatClock(r: FateProphetRuntime, seconds: number): void { if (!integer(seconds)) throw new Error('实际时间无效。'); r.root.clockSeconds += seconds; }
function baseAction(x: FateProphetCombatSource, r: FateProphetRuntime, actor: 'PLAYER' | 'ENEMY', id: string, order: number, random: ActionRandomStream): FateProphetActionEvidence {
  return { actor, id, planned: id, selectedAbility: id, fallbackReason: null, order, mode: 'OBSERVE', label: '', selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false,
    attackKind: 'NONE', rawContribution: 0, paidCost: 0, mindCost: 0, luckCost: 0, physicalFactor: physicalAt(actor === 'PLAYER' ? x.playerHealth : x.body.enemyHealth), check: null, succeeded: false, resisted: false,
    pendingBefore: r.body.pendingKind, pendingAfter: r.body.pendingKind, pendingApplied: null, atSeconds: r.root.clockSeconds, elapsedSeconds: 5, travelMetres: 0,
    randomCursorBefore: random.cursor, randomCursorAfter: random.cursor, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, enemySpiritualityAfter: r.body.enemySpirituality, luckAfter: { ...r.luck } };
}
function closeAction(a: FateProphetActionEvidence, r: FateProphetRuntime, random: ActionRandomStream) {
  advanceFateProphetCombatClock(r, 5); a.pendingAfter = r.body.pendingKind; a.randomCursorAfter = random.cursor; a.playerMindAfter = r.playerM; a.playerSpiritualityAfter = r.playerS;
  a.enemySpiritualityAfter = r.body.enemySpirituality; a.luckAfter = { ...r.luck }; a.label += ` 本槽5秒；本人余${r.playerS}灵性${r.playerM}精神、原积运${r.luck.stored}/3；洛温余${r.body.enemySpirituality}/120灵性。`; return a;
}
/** The same finite ordered kernel is used by production and replay. It never reads future random draws. */
export function resolveFateProphetPlayerSlot(x: FateProphetCombatSource, r: FateProphetRuntime, id: FateProphetMoveId, order: number, random: ActionRandomStream): FateProphetActionEvidence {
  const a = baseAction(x, r, 'PLAYER', id, order, random), b = r.body;
  const pay = (s: number, m = 0, luck: 0 | 1 = 0) => { r.playerS -= s; r.playerM -= m; a.paidCost = s; a.mindCost = m; a.luckCost = luck; if (luck) { r.luck.stored--; r.luck.spent++; b.lastLuckRound = x.round; b.luckAttempts++; } };
  const luckEligible = () => r.winnerPolicy === 'SPEND_FIRST' && b.lastLuckRound !== x.round && r.luck.stored > 0 && r.playerS >= 5;
  const attempt = (kind: FateProphetPendingKind, ability: string, mindCost: 0 | 1, luck: 0 | 1) => {
    pay(5, mindCost, luck); a.selectedAbility = ability; a.mode = kind;
    if (kind === 'FORESIGHT') b.foresightAttempts++; else if (kind === 'HAZARD_ADJUSTMENT') b.hazardAttempts++; else if (kind === 'DEVIATION_BUFFER') b.deviationAttempts++; else b.impedimentAttempts++;
    a.check = resolveNormalCheck({ ability: 'knowledge', baseAbility: x.knowledge, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) });
    a.resisted = b.composureReady; a.succeeded = ['SUCCESS', 'GREAT_SUCCESS'].includes(a.check.tier) && !a.resisted;
    if (a.succeeded) b.pendingKind = kind;
    const abilityName = kind === 'FORESIGHT' ? '事件先兆' : kind === 'HAZARD_ADJUSTMENT' ? '风险调整' : kind === 'DEVIATION_BUFFER' ? '偏差缓冲' : '未发阻滞';
    a.label = `仅本槽实际尝试${abilityName}，实付${luck}份唯一原积运、5灵性${mindCost}精神；知识20，${a.check.roll}/${a.check.chance}，${a.check.tier}。${a.resisted ? '对手已经凝神抵抗，本次不建立效果' : a.succeeded ? '只建立一个未来待用窗口，未抽取或窥视未来行动' : '失败不建立效果'}；费用不退。`;
  };
  if (id === 'ACCIDENT') { a.mode = 'ACCIDENT'; a.selfGain = -22.5; a.label = '本次实际偏差−22.5，不另外重抽或扣原积运。'; }
  else if (id === 'BODY_STRIKE' || id === 'BODY_FOLLOWUP') {
    a.mode = 'BODY'; a.attackKind = 'BODY'; a.selfGain = (id === 'BODY_STRIKE' ? x.clubHeld ? 16 : 18 : 22.75 * factor(x.calculationMastery)) * a.physicalFactor;
    a.threatens = true; a.travelMetres = 4; r.root.playerTravelMetres += 4; a.label = '本人使用自己的身体或实际持握原短棍，近前2米再退回2米；不取对手原杖。';
  } else if (id === 'OBSERVE') a.label = '只观察眼前原人、原杖、原积运和开放出口，不预先读取未来随机票。';
  else if (b.pendingKind !== null) { a.selectedAbility = 'OBSERVE'; a.fallbackReason = 'ONE_PENDING_WINDOW'; a.label = '已有一个待用窗口，本槽普通观察，不叠加、不重收费或刷新。'; }
  else if (id === FORESIGHT && r.playerS >= 5 && r.playerM >= 1) attempt('FORESIGHT', FORESIGHT, 1, 0);
  else if (id === HAZARD && luckEligible() && r.playerM >= 1) attempt('HAZARD_ADJUSTMENT', HAZARD, 1, 1);
  else if (luckEligible()) { a.fallbackReason = 'S2_RESOURCES_UNAVAILABLE'; attempt(id === FORESIGHT ? 'DEVIATION_BUFFER' : 'FUTURE_IMPEDIMENT', id === FORESIGHT ? OLD_B : OLD_K, 0, 1); }
  else {
    a.fallbackReason = id === HAZARD && r.winnerPolicy === 'HOLD' ? 'HOLD_LUCK' : 'RESOURCES_OR_ROUND_LUCK_CAP';
    if (id === FORESIGHT) { a.selectedAbility = r.playerS >= 3 ? 'wheel.s6.disaster-awareness' : 'ORDINARY_GUARD'; a.mode = 'GUARD'; if (r.playerS >= 3) { pay(3); a.enemyReduction = 42.25 * factor(x.awarenessMastery) * a.physicalFactor; } else a.enemyReduction = 8 * a.physicalFactor;
      a.label = '新窗口条件不足，实际仅执行旧预警或普通格挡，不支出积运。'; }
    else if (r.playerS >= 3) { pay(3); a.selectedAbility = 'wheel.s6.mental-storm'; a.mode = 'MIND'; a.attackKind = 'MIND'; a.mentalPressure = true; a.enemyReduction = 42.25 * factor(x.stormMastery); a.label = '仅实付3灵性使用继承精神风暴，作用于独立心智，不乘身体、不冒充肉体攻击。'; }
    else { a.selectedAbility = 'OBSERVE'; a.label = '真实资源不足，只普通观察，不借用历史已花积运或补灵性。'; }
  }
  a.rawContribution = a.selfGain; return closeAction(a, r, random);
}
export function resolveFateProphetEnemySlot(x: FateProphetCombatSource, r: FateProphetRuntime, planned: FateProphetEnemyIntent, order: number, random: ActionRandomStream): FateProphetActionEvidence {
  const a = baseAction(x, r, 'ENEMY', planned, order, random), b = r.body, p = FATE_PROPHET_POWERS.find(v => v.id === planned);
  const payable = !!p && b.enemySpirituality >= p.cost;
  if (planned === 'ACCIDENT') { a.mode = 'ACCIDENT'; a.selfGain = -22.5; a.label = '洛温的实际动作偏差−22.5，不是攻击，不消耗待用窗口。'; }
  else if (payable) {
    a.mode = p.id; a.paidCost = p.cost; b.enemySpirituality -= p.cost; b.powerUses[p.id]++; a.selfGain = p.selfGain; a.enemyReduction = p.enemyReduction;
    if (p.id === 'ARC_BOLT') { a.attackKind = 'ARC'; a.threatens = true; a.label = '洛温实际付5灵性发出有限弧光，对身体形成实际威胁。'; }
    else if (p.id === 'COMPOSE') { b.pendingKind = null; b.composureReady = true; a.label = '洛温实际付4灵性自主凝神，贡献8；取消尚未用窗口并抵抗本轮后续输入，已花费用不退。'; }
    else a.label = '洛温实际付4灵性施展自己的有限屏护；它不是攻击，不消耗待用窗口。';
  } else {
    a.id = a.selectedAbility = 'BODY_STRIKE'; a.mode = 'BODY'; a.fallbackReason = p ? 'INSUFFICIENT_ENEMY_SPIRITUALITY' : null; a.attackKind = 'BODY'; a.threatens = true; a.selfGain = 20 * a.physicalFactor; a.travelMetres = 4;
    a.label = '洛温只以自己的唯一原杖打击，实际近前2米再退回2米；无免费法术库或补充灵性。';
  }
  a.rawContribution = a.selfGain;
  const eligible = a.selfGain > 0 && (a.attackKind === 'BODY' || a.attackKind === 'ARC' || b.pendingKind === 'FORESIGHT' && a.attackKind === 'MIND');
  if (eligible && b.pendingKind) { a.pendingApplied = b.pendingKind; a.selfGain *= b.pendingKind === 'FORESIGHT' ? .7 : .5; b.pendingKind = null; a.label += ' 一个先前待用窗口现在才作用于这次实际正攻击，原动作与全额灵性费用保留。'; }
  return closeAction(a, r, random);
}
export interface FateProphetRoundOutcome extends FateProphetCombatBody {
  targetId: typeof FATE_PROPHET_TARGET_ID; round: number; source: FateProphetCombatSource; stance: SliceStance; winnerPolicy: WinnerLuckPolicy; continuing: boolean;
  playerHealthAfter: number; playerMindAfter: number; playerSpiritualityAfter: number; playerInjuriesAfter: SliceInjury[]; playerRiskAfter: number; luckAfter: WinnerLuck;
  rootAfter: FateProphetSceneRoot; elapsedSeconds: 60; randomCursorAfter: number; playerActions: FateProphetActionEvidence[]; enemyActions: FateProphetActionEvidence[];
  passiveLuck: { roll: number; triggered: boolean; bonus: number } | null; expiredPending: FateProphetPendingKind | null;
}
export type FateProphetResolution = 'CONTINUE' | 'PLAYER_DEAD' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED' | 'RETREATED';
function penalty(n: number, max: number) { const f = n / max; return f > .75 ? 0 : f > .5 ? .05 : f > .25 ? .1 : .2; }
function base(core: number, h: number, m: number, s: number) { return (1250 + Math.min(core, 250)) * (1 - Math.min(.4, penalty(h, 100) + penalty(m, 100) + penalty(s, 120))); }
function weights(risk: number) { const death = Math.min(100, 5 + Math.min(risk, 10) * 10), shifted = death - 5; return { light: Math.max(0, 65 - shifted), heavy: Math.max(0, 30 - Math.max(0, shifted - 65)), death }; }
export function validFateProphetBody(b: FateProphetCombatBody, maxRound = Number.MAX_SAFE_INTEGER): boolean {
  return integer(b.enemyHealth, 0, 100) && integer(b.enemyMind, 0, 100) && integer(b.enemySpirituality, 0, 120) && integer(b.enemyRisk) && Array.isArray(b.enemyInjuries) &&
    ['RESISTING', 'SURRENDERED', 'DEAD'].includes(b.enemyStatus) && (b.enemyStatus === 'DEAD') === (b.enemyHealth === 0) && b.weaponLocation === (b.enemyStatus === 'DEAD' ? 'COURT' : 'HAND') &&
    shape(b.powerUses, FATE_PROPHET_POWER_IDS) && FATE_PROPHET_POWER_IDS.every(id => integer(b.powerUses[id])) && b.enemySpirituality === 120 - FATE_PROPHET_POWERS.reduce((n, p) => n + p.cost * b.powerUses[p.id], 0) &&
    b.pendingKind === null && b.composureReady === false && [b.foresightAttempts, b.hazardAttempts, b.deviationAttempts, b.impedimentAttempts, b.luckAttempts].every(n => integer(n)) &&
    b.luckAttempts === b.hazardAttempts + b.deviationAttempts + b.impedimentAttempts && (b.lastLuckRound === null ? b.luckAttempts === 0 : integer(b.lastLuckRound, 1, maxRound) && b.luckAttempts > 0 && b.luckAttempts <= b.lastLuckRound);
}
export function validFateProphetInjuries(injuries: SliceInjury[], revision: number): boolean {
  return Array.isArray(injuries) && new Set(injuries.map(i => i.id)).size === injuries.length && injuries.every(i => shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && !!i.id && ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision, 0, revision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision, revision)));
}
const SOURCE_KEYS = ['runId', 'revision', 'week', 'date', 'round', 'encounterId', 'targetId', 'attemptWeek', 'startHistoryIndex', 'targetName', 'targetAge', 'targetPathway', 'targetSequence', 'targetCore', 'actualBody', 'independentMind', 'enemyWeapon', 'weaponOwner', 'yardId', 'enemyPosition', 'enemyDistanceMetres', 'ordinaryExit', 'pursuit', 'thirdPartiesInArea', 'automaticAllyImmunity', 'freeSkillLibrary', 'playerHealth', 'playerMind', 'playerSpirituality', 'playerInjuries', 'playerRisk', 'physique', 'perception', 'will', 'knowledge', 'calculationMastery', 'awarenessMastery', 'stormMastery', 'passiveMastery', 'clubHeld', 'luck', 'preparation', 'root', 'body', 'randomSeed', 'randomCursor'];
export function validFateProphetCombatSource(x: FateProphetCombatSource): boolean {
  try { const p = x.root;
    return shape(x, SOURCE_KEYS) && shape(x.body, Object.keys(combatBody(x.body))) && validateFateProphetPreparation(x.preparation) && typeof x.runId === 'string' && !!x.runId && integer(x.revision) && integer(x.week, 1) && integer(x.round, 1) && integer(x.startHistoryIndex) && x.attemptWeek === x.week && same(x.date, x.preparation.date) &&
      x.encounterId === 'FATE_PROPHET_DISPUTE' && x.targetId === FATE_PROPHET_TARGET_ID && x.targetName === '洛温·米勒' && x.targetAge === 42 && x.targetPathway === 'original-caster' && x.targetSequence === 3 && x.targetCore === 22 &&
      x.actualBody === true && x.independentMind === true && x.enemyWeapon === 'FP2-ROWAN-ROD' && x.weaponOwner === FATE_PROPHET_TARGET_ID && x.yardId === 'CW3-MECHANICAL-WORKSHOP' && x.enemyPosition === 'BETWEEN_A_AND_B' && x.enemyDistanceMetres === 2 &&
      x.ordinaryExit === 'OPEN' && x.pursuit === false && x.thirdPartiesInArea === 0 && x.automaticAllyImmunity === false && x.freeSkillLibrary === false && [x.playerHealth, x.playerMind].every(n => integer(n, 1, 100)) && integer(x.playerSpirituality, 0, 120) &&
      [x.physique, x.perception, x.will, x.knowledge, x.calculationMastery, x.awarenessMastery, x.stormMastery, x.passiveMastery].every(n => integer(n, 0, 500)) && typeof x.clubHeld === 'boolean' && integer(x.playerRisk) && validFateProphetInjuries(x.playerInjuries, x.revision) && validFateProphetInjuries(x.body.enemyInjuries, x.revision) && validFateProphetLuck(x.luck, x.week) &&
      p.siteId === 'CW3-MECHANICAL-WORKSHOP' && p.playerLocation === 'A' && p.volunteer.id === 'CW3-VERA' && p.volunteer.age === 39 && p.volunteer.location === 'OUTSIDE' && p.volunteer.alive && p.guide.id === 'GUIDE' && p.guide.location === 'OUTSIDE' &&
      p.activeCase === null && integer(p.clockSeconds) && integer(p.playerTravelMetres) && validFateProphetBody(x.body, x.round - 1) && x.body.enemyStatus === 'RESISTING' && x.body.enemyMind > 0 &&
      typeof x.randomSeed === 'string' && !!x.randomSeed && integer(x.randomCursor) && x.preparation.runId === x.runId && x.preparation.randomSeed === x.randomSeed && x.preparation.randomCursor <= x.randomCursor && x.preparation.revision < x.revision && p.clockSeconds === x.preparation.lifeClockSeconds + 16 + 60 * (x.round - 1);
  } catch { return false; }
}
export function replayFateProphetCombatRound(x: FateProphetCombatSource, stance: SliceStance, winnerPolicy: WinnerLuckPolicy = 'HOLD'): { round: SliceCombatRound; outcome: FateProphetResolution } {
  if (!validFateProphetCombatSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance) || !['HOLD', 'SPEND_FIRST'].includes(winnerPolicy)) throw new Error('缺少真实原来源或有效积运策略。');
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = createFateProphetRuntime(x, winnerPolicy), b = r.body;
  const roll = stance === 'RETREAT' ? null : rng.nextInt(1, 100), passiveLuck = roll === null ? null : { roll, triggered: roll <= 25, bonus: roll <= 25 ? 45 * factor(x.passiveMastery) * physicalAt(x.playerHealth) : 0 };
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = fateProphetActionCount(playerCountRoll), enemyCount = fateProphetEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: FateProphetActionEvidence[] = [], enemies: FateProphetActionEvidence[] = [], remaining = { PLAYER: playerCount, ENEMY: enemyCount }; let retreat: SliceCombatRound['retreat'] = 'NONE';
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) for (const actor of order) {
    if (!remaining[actor]) continue;
    if (actor === 'PLAYER' && stance === 'RETREAT') { remaining.PLAYER = 0; retreat = rng.nextInt(1, 100) <= 50 ? 'SUCCESS' : 'FAILURE'; if (retreat === 'SUCCESS') { remaining.ENEMY = 0; break; } continue; }
    remaining[actor]--; const index = players.length + enemies.length;
    if (actor === 'PLAYER') players.push(resolveFateProphetPlayerSlot(x, r, drawFateProphetAbility(rng, null, stance), index, rng)); else enemies.push(resolveFateProphetEnemySlot(x, r, drawFateProphetEnemyAbility(rng), index, rng));
  }
  const sum = (a: FateProphetActionEvidence[], key: 'selfGain' | 'enemyReduction') => a.reduce((n, v) => n + v[key], 0);
  const playerAdvantage = Math.max(125, base(x.physique * .15 + x.perception * .2 + x.will * .4 + x.knowledge * .25, x.playerHealth, x.playerMind, x.playerSpirituality) + (passiveLuck?.bonus ?? 0) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, base(22, x.body.enemyHealth, x.body.enemyMind, x.body.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction'));
  const winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100, winner = retreat === 'SUCCESS' ? 'ENEMY' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  let playerHealth = x.playerHealth, playerRisk = x.playerRisk, outcome: FateProphetResolution = retreat === 'SUCCESS' ? 'RETREATED' : 'CONTINUE';
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
  advanceFateProphetCombatClock(r, x.root.clockSeconds + 60 - r.root.clockSeconds); const expiredPending = b.pendingKind; b.pendingKind = null; b.composureReady = false; if (b.enemyHealth === 0) b.weaponLocation = 'COURT';
  const o: FateProphetRoundOutcome = { ...structuredClone(b), targetId: FATE_PROPHET_TARGET_ID, round: x.round, source: structuredClone(x), stance, winnerPolicy, continuing: outcome === 'CONTINUE',
    playerHealthAfter: playerHealth, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, playerInjuriesAfter: playerInjuries, playerRiskAfter: playerRisk, luckAfter: { ...r.luck },
    rootAfter: structuredClone(r.root), elapsedSeconds: 60, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies, passiveLuck, expiredPending };
  const round: SliceCombatRound = { round: x.round, stance, first, playerCount, enemyCount, playerCountRoll, enemyCountRoll,
    moves: [...players, ...enemies].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })),
    playerAdvantage, enemyAdvantage, winChance, winner, consequence: '', consequenceWeights, retreat, ...(consequenceDomain === undefined ? {} : { consequenceDomain }), ...(consequenceRoll === undefined ? {} : { consequenceRoll }),
    fateProphetOutcome: o, ...(passiveLuck ? { passiveLuck: { ...passiveLuck } } : {}) };
  round.consequence = fateProphetCombatConsequence(round); return { round, outcome };
}
export function validateFateProphetRoundOutcome(v: unknown): v is FateProphetRoundOutcome { try { const o = v as FateProphetRoundOutcome; return !!o && same(o, replayFateProphetCombatRound(o.source, o.stance, o.winnerPolicy).round.fateProphetOutcome); } catch { return false; } }
export function validateFateProphetCombatRound(round: SliceCombatRound): boolean { try { const o = round.fateProphetOutcome; return !!o && same(round, replayFateProphetCombatRound(o.source, o.stance, o.winnerPolicy).round); } catch { return false; } }
export function nextFateProphetCombatSource(o: FateProphetRoundOutcome): FateProphetCombatSource {
  return { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter,
    playerSpirituality: Math.min(120, o.playerSpiritualityAfter + 12), playerInjuries: structuredClone(o.playerInjuriesAfter), playerRisk: o.playerRiskAfter,
    root: structuredClone(o.rootAfter), body: combatBody(o), luck: { ...o.luckAfter }, randomCursor: o.randomCursorAfter };
}
export function fateProphetCombatConsequence(round: SliceCombatRound): string {
  const o = round.fateProphetOutcome!, who = round.winner === 'PLAYER' ? '洛温' : '你'; let text = round.retreat === 'SUCCESS' ? '撤离判定成功，沿普通4米出口离开。' : round.consequenceDomain === 'MENTAL' ? `${who}承受实际精神压力，精神减少10，没有新增身体伤口。` : round.consequenceDomain === 'BODY' ? `${who}承受实际身体打击或法术冲击，按共同伤势盘结算。` : '本轮下风没有实际攻击来源，不掷身体伤势盘。';
  if (o.playerHealthAfter === 0) text += '本人的原身体真实死亡，不能复活或离场。'; else if (o.enemyHealth === 0) text += '洛温原身体真实死亡，唯一原杖留地。'; else if (o.enemyStatus === 'SURRENDERED') text += '洛温因实际伤势或精神耗尽自主停止抵抗。';
  return text + ' 本轮实际60秒；未用窗口到期，已花灵性、精神与唯一原积运不退。原费里斯和原加雷斯及其历史结局不变。';
}
export function projectFateProphetCombat(s: SliceState) {
  const e = s.fateProphet.encounter, last = s.combat?.encounterId === 'FATE_PROPHET_DISPUTE' ? s.combat.lastRound?.fateProphetOutcome : e.terminal ? s.combatHistory[e.terminal.historyIndex]?.fateProphetOutcome : null;
  return { enemyName: isFateProphet(s) ? '洛温·米勒（42岁，序列3施术者）' : '', targetId: e.targetId, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality,
    weaponLocation: e.weaponLocation, pendingKind: e.pendingKind, composureReady: e.composureReady, powerUses: { ...e.powerUses }, luck: { ...s.winner.luck, capacity: 3 as const },
    lastActionSequence: last ? [...last.playerActions, ...last.enemyActions].sort((a, b) => a.order - b.order) : [], countWheel: FATE_PROPHET_COUNT_WHEEL, enemyCountWheel: FATE_PROPHET_ENEMY_COUNT_WHEEL, enemyAbilityWheel: FATE_PROPHET_ENEMY_ABILITY_WHEEL,
    summary: '先兆5灵性1精神只减下一次实际攻击30%；风险调整明确选用1份原赢家积运5灵性1精神，只减下一次实际身体打击或法术冲击贡献50%。知识20可失败；一个待用窗口，不叠加、不窥视未来票。凝神可取消未用窗口，屏护与偏差不消耗它；未用到期不退款。旧偏差缓冲、未发阻滞与新风险调整共享每轮一次积运上限，选择保留幸运时不花积运。真实身体和精神后果分别结算，活着才走4米普通出口。' };
}
export type FateProphetCombatProjection = ReturnType<typeof projectFateProphetCombat>;
