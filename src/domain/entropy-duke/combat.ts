import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicGameDate, PublicCheckResult } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import type { BriberGift } from '../briber/types.js';
import { FRENZY_MAGE_COUNT_WHEEL, frenzyMageActionCount } from '../frenzy-mage/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import type { EntropyDukeSceneRoot } from './life.js';
import { ENTROPY_DUKE_TARGET_ID, ENTROPY_DUKE_POWER_IDS, ENTROPY_DUKE_POWERS, combatBody, hasEntropyDukeDisputeOpponent, validateEntropyDukePreparation,
  type EntropyDukeCombatBody, type EntropyDukeEnemyIntent, type EntropyDukePreparation } from './encounter.js';

export const ENTROPY_DUKE_COUNT_WHEEL = FRENZY_MAGE_COUNT_WHEEL;
export const ENTROPY_DUKE_ENEMY_COUNT_WHEEL = ENTROPY_DUKE_COUNT_WHEEL;
export const entropyDukeActionCount = frenzyMageActionCount;
export const entropyDukeEnemyActionCount = frenzyMageActionCount;
export const AMPLIFICATION = 'black-emperor.s2.action-amplification', PROLONGATION = 'black-emperor.s2.effect-prolongation';
export const ENTROPY_DUKE_GIFT_GROUND = 'BATTLE:ENTROPY_DUKE_DISPUTE:GROUND';
const MAGNIFY = 'black-emperor.s4.magnify', DEVIATION = 'black-emperor.s3.ordered-deviation', BRIBERY = 'black-emperor.s7.bribery-weakening', EXPLOIT = 'black-emperor.s4.exploit';
export type EntropyDukeMoveId = typeof AMPLIFICATION | 'BODY_FOLLOWUP' | typeof BRIBERY | typeof DEVIATION | typeof PROLONGATION | 'ACCIDENT';
const ABILITIES: readonly { id: EntropyDukeMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: AMPLIFICATION, label: '行为增幅：6灵性1精神，知识20；仅本人当次身体击打。条件不足沿继承放大或普通主攻', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承强化身体侧击：41.405×掌握×身体，0灵性', weight: 15, stance: 'ATTACK' },
  { id: BRIBERY, label: '原木筹削弱：真实库存1件与3灵性；否则继承破绽护身', weight: 25, stance: 'DEFEND' },
  { id: DEVIATION, label: '继承既有动作偏转：5灵性，知识20；30秒内下一次实际身体、弧光或屏护减半', weight: 10, stance: 'CONTROL' },
  { id: PROLONGATION, label: '效果延长：5灵性1精神，知识20；本人仍有效的同一待用影响仅延长30秒一次', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '实际动作偏差：固定−22.5，0灵性', weight: 5, stance: null },
];
export const ENTROPY_DUKE_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '有限弧光：5灵性，70身体攻击贡献', weight: 35 },
  { id: 'WARD', label: '有限屏护：4灵性，敌方−30', weight: 20 },
  { id: 'BODY_STRIKE', label: '本人手杖打击：20×身体', weight: 20 },
  { id: 'COMPOSE', label: '自主凝神：4灵性，贡献8；清除未用偏转并抵抗本轮输入', weight: 10 },
  { id: 'MENTAL_PRESSURE', label: '有限精神施压：5灵性，45精神攻击贡献；只造成精神后果', weight: 10 },
  { id: 'ACCIDENT', label: '实际偏差：−22.5，0灵性', weight: 5 },
];
export const isEntropyDuke = (s: SliceState) => s.progression.pathwayId === 'black-emperor' && s.progression.sequence === 2;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (a.stance === stance && stance !== null ? 5 : 4));
export function entropyDukeAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const w = tickets(stance), total = w.reduce((a, b) => a + b, 0); return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: w[i]! / total * 100 }));
}
export function drawEntropyDukeAbility(random: ActionRandomStream, _s: SliceState | null, stance: SliceStance | null): EntropyDukeMoveId {
  const w = tickets(stance); let n = random.nextInt(1, w.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= w[i]!; if (n <= 0) return a.id; } throw new Error('行动盘无效。');
}
export function drawEntropyDukeEnemyAbility(random: ActionRandomStream): EntropyDukeEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of ENTROPY_DUKE_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as EntropyDukeEnemyIntent; } throw new Error('对手行动盘无效。');
}
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
const physicalAt = (n: number) => n > 75 ? 1 : n > 50 ? .95 : n > 25 ? .9 : .8;
const factor = (n: number) => .65 + .35 * n / 500;
export function validEntropyDukeGifts(gifts: BriberGift[], week: number): boolean {
  return Array.isArray(gifts) && gifts.every((g, i) => shape(g, ['id', 'location', 'destination', 'givenWeek']) && g.id === `BR7-GIFT-${i + 1}` &&
    (g.location === 'PLAYER' ? g.destination === null && g.givenWeek === null : g.location === 'GIVEN' && typeof g.destination === 'string' && !!g.destination && integer(g.givenWeek, 1, week)));
}
export interface EntropyDukeCombatSource {
  runId: string; revision: number; week: number; date: PublicGameDate; round: number; encounterId: 'ENTROPY_DUKE_DISPUTE'; targetId: typeof ENTROPY_DUKE_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetName: '奥斯温·格雷'; targetAge: 46; targetPathway: 'original-caster'; targetSequence: 3; targetCore: 22;
  actualBody: true; independentMind: true; enemyWeapon: 'ED2-OSWIN-ROD'; weaponOwner: typeof ENTROPY_DUKE_TARGET_ID; yardId: 'FM3-DELIVERY-PRACTICE'; enemyPosition: 'BETWEEN_A_AND_B'; enemyDistanceMetres: 2;
  ordinaryExit: 'OPEN'; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false; freeSkillLibrary: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; playerInjuries: SliceInjury[]; playerRisk: number;
  physique: number; perception: number; will: number; knowledge: number; mastery: Record<string, number>; clubHeld: boolean; gifts: BriberGift[];
  preparation: EntropyDukePreparation; root: EntropyDukeSceneRoot; body: EntropyDukeCombatBody; randomSeed: string; randomCursor: number;
}
export function currentEntropyDukeCombatSource(s: SliceState): EntropyDukeCombatSource | null {
  if (!hasEntropyDukeDisputeOpponent(s)) return null; const e = s.entropyDuke.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, date: { ...s.date }, round: c.round, encounterId: 'ENTROPY_DUKE_DISPUTE', targetId: ENTROPY_DUKE_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetName: '奥斯温·格雷', targetAge: 46, targetPathway: 'original-caster', targetSequence: 3, targetCore: 22,
    actualBody: true, independentMind: true, enemyWeapon: 'ED2-OSWIN-ROD', weaponOwner: ENTROPY_DUKE_TARGET_ID, yardId: 'FM3-DELIVERY-PRACTICE', enemyPosition: 'BETWEEN_A_AND_B', enemyDistanceMetres: 2,
    ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false, freeSkillLibrary: false,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, playerInjuries: structuredClone(s.injuries), playerRisk: s.injuryRisk,
    ...s.character.coreStats, mastery: { ...s.progression.mastery }, clubHeld: s.town.clubLocation === 'HAND', gifts: structuredClone(s.briber.gifts),
    preparation: structuredClone(e.preparation!), root: structuredClone(s.frenzyMage.life) as EntropyDukeSceneRoot, body: combatBody(e), randomSeed: s.random.seed, randomCursor: s.random.cursor };
}
/** A pending effect belongs to this player, this encounter and one actual cast. */
export interface EntropyDukePendingEffect {
  id: string; owner: 'PLAYER'; kind: 'ORDERED_DEVIATION' | 'GIFT_WEAKENING'; createdAt: number; originalExpiresAt: number; expiresAt: number;
  extended: boolean; extensionApplied: boolean; remaining: 1 | 2; exploited: boolean; factor: number; giftId: string | null;
}
export interface EntropyDukeActionEvidence {
  order: number; actor: 'PLAYER' | 'ENEMY'; id: string; planned: string; selectedAbility: string; fallbackReason: string | null; mode: string; label: string;
  selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean; attackKind: 'NONE' | 'BODY' | 'ARC' | 'MIND'; rawContribution: number; rawReduction: number;
  paidCost: number; mindCost: number; physicalFactor: number; check: PublicCheckResult | null; succeeded: boolean; resisted: boolean; giftId: string | null;
  pendingBefore: EntropyDukePendingEffect[]; pendingAfter: EntropyDukePendingEffect[]; pendingApplied: string[]; masteryApplied: string[];
  atSeconds: number; elapsedSeconds: 5; travelMetres: number; randomCursorBefore: number; randomCursorAfter: number;
  playerMindAfter: number; playerSpiritualityAfter: number; enemySpiritualityAfter: number;
}
export interface EntropyDukeRuntime { body: EntropyDukeCombatBody; root: EntropyDukeSceneRoot; playerS: number; playerM: number; gifts: BriberGift[]; mastery: Record<string, number>; pending: EntropyDukePendingEffect[] }
export function createEntropyDukeRuntime(x: EntropyDukeCombatSource): EntropyDukeRuntime {
  return { body: structuredClone(x.body), root: structuredClone(x.root), playerS: x.playerSpirituality, playerM: x.playerMind, gifts: structuredClone(x.gifts), mastery: { ...x.mastery }, pending: [] };
}
function syncPending(r: EntropyDukeRuntime): void { r.body.pendingKind = r.pending.some(p => p.kind === 'ORDERED_DEVIATION') ? 'ORDERED_DEVIATION' : null; }
export function advanceEntropyDukeCombatClock(r: EntropyDukeRuntime, seconds: number): void {
  if (!integer(seconds)) throw new Error('实际时间无效。'); r.root.clockSeconds += seconds; r.pending = r.pending.filter(p => p.expiresAt > r.root.clockSeconds); syncPending(r);
}
function baseAction(x: EntropyDukeCombatSource, r: EntropyDukeRuntime, actor: 'PLAYER' | 'ENEMY', id: string, order: number, random: ActionRandomStream): EntropyDukeActionEvidence {
  return { actor, id, planned: id, selectedAbility: id, fallbackReason: null, order, mode: 'OBSERVE', label: '', selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false,
    attackKind: 'NONE', rawContribution: 0, rawReduction: 0, paidCost: 0, mindCost: 0, physicalFactor: physicalAt(actor === 'PLAYER' ? x.playerHealth : x.body.enemyHealth), check: null, succeeded: false, resisted: false, giftId: null,
    pendingBefore: structuredClone(r.pending), pendingAfter: [], pendingApplied: [], masteryApplied: [], atSeconds: r.root.clockSeconds, elapsedSeconds: 5, travelMetres: 0,
    randomCursorBefore: random.cursor, randomCursorAfter: random.cursor, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, enemySpiritualityAfter: r.body.enemySpirituality };
}
function gainMastery(r: EntropyDukeRuntime, a: EntropyDukeActionEvidence, id: string): void { r.mastery[id] = Math.min(500, (r.mastery[id] ?? 0) + 8); a.masteryApplied.push(id); }
function closeAction(a: EntropyDukeActionEvidence, r: EntropyDukeRuntime, random: ActionRandomStream) {
  advanceEntropyDukeCombatClock(r, 5); a.pendingAfter = structuredClone(r.pending); a.randomCursorAfter = random.cursor; a.playerMindAfter = r.playerM; a.playerSpiritualityAfter = r.playerS;
  a.enemySpiritualityAfter = r.body.enemySpirituality; a.label += ` 此次5秒；本人余${r.playerS}灵性、${r.playerM}精神；奥斯温余${r.body.enemySpirituality}/120灵性。`; return a;
}
function pending(x: EntropyDukeCombatSource, r: EntropyDukeRuntime, a: EntropyDukeActionEvidence, kind: EntropyDukePendingEffect['kind'], giftId: string | null, amount: number): EntropyDukePendingEffect {
  return { id: `${x.runId}:${x.round}:${a.order}:${kind}`, owner: 'PLAYER', kind, createdAt: r.root.clockSeconds, originalExpiresAt: r.root.clockSeconds + 30, expiresAt: r.root.clockSeconds + 30,
    extended: false, extensionApplied: false, remaining: 1, exploited: false, factor: amount, giftId };
}
/** Production and validation share this finite ordered kernel, with no future draws. */
export function resolveEntropyDukePlayerSlot(x: EntropyDukeCombatSource, r: EntropyDukeRuntime, id: EntropyDukeMoveId, order: number, random: ActionRandomStream): EntropyDukeActionEvidence {
  const a = baseAction(x, r, 'PLAYER', id, order, random), b = r.body;
  const pay = (s: number, m = 0) => { r.playerS -= s; r.playerM -= m; a.paidCost = s; a.mindCost = m; };
  const check = () => { a.check = resolveNormalCheck({ ability: 'knowledge', baseAbility: x.knowledge, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) }); a.succeeded = ['SUCCESS', 'GREAT_SUCCESS'].includes(a.check.tier); };
  if (id === 'ACCIDENT') { a.mode = 'ACCIDENT'; a.selfGain = -22.5; a.label = '本次实际动作偏差，贡献−22.5。'; }
  else if (id === AMPLIFICATION || id === 'BODY_FOLLOWUP') {
    a.mode = 'BODY'; a.attackKind = 'BODY'; const bodyFactor = factor(x.mastery['black-emperor.s8.enhanced-body'] ?? 0);
    a.selfGain = (id === 'BODY_FOLLOWUP' ? 41.405 * bodyFactor : x.clubHeld ? 16 : 59.15 * bodyFactor) * a.physicalFactor; a.rawContribution = a.selfGain;
    if (id === AMPLIFICATION && r.playerS >= 6 && r.playerM >= 1) { pay(6, 1); b.amplificationAttempts++; check();
      if (a.succeeded) { a.selfGain *= 1.5; gainMastery(r, a, AMPLIFICATION); }
      a.label = `本人实际近前击打，行为增幅付6灵性1精神，知识20检定${a.check!.roll}/${a.check!.chance}；${a.succeeded ? '成功只将当前一次击打放大至1.5倍，随即结束' : '施术失败，保留实际普通击打，费用不退'}。`;
    } else if (id === AMPLIFICATION && r.playerS >= 4) { pay(4); b.magnifyUses++; a.selectedAbility = MAGNIFY; a.fallbackReason = 'S2_RESOURCES_UNAVAILABLE'; a.selfGain *= 1 + .25 * factor(x.mastery[MAGNIFY] ?? 0); a.label = '新术条件不足，实际仅付4灵性使用继承放大，作用于本人当前一次原击打。'; }
    else { a.selectedAbility = id === AMPLIFICATION ? 'ORDINARY_BODY_STRIKE' : id; a.fallbackReason = id === AMPLIFICATION ? 'INSUFFICIENT_RESOURCES' : null; a.label = '本人以实际身体或持握的原短棍击打，近前2米再退回2米。'; }
    a.threatens = true; a.travelMetres = 4; r.root.playerTravelMetres += 4;
  } else if (id === BRIBERY) {
    const gift = r.gifts.find(g => g.location === 'PLAYER');
    if (gift && r.playerS >= 3 && !r.pending.some(p => p.kind === 'GIFT_WEAKENING')) { pay(3); gift.location = 'GIVEN'; gift.destination = ENTROPY_DUKE_GIFT_GROUND; gift.givenWeek = x.week; a.giftId = gift.id;
      r.pending.push(pending(x, r, a, 'GIFT_WEAKENING', gift.id, .35 * factor(x.mastery[BRIBERY] ?? 0))); a.mode = 'GIFT_WEAKENING'; a.label = '实际付3灵性并给出当前持有的同一原木筹，落在本场地面；30秒内只削弱后来一次实际针对本人的行动。';
    } else { a.selectedAbility = 'black-emperor.s9.weak-point-insight'; a.mode = 'GUARD'; a.enemyReduction = 36.45 * factor(x.mastery[a.selectedAbility] ?? 0) * a.physicalFactor; a.label = '当前无可用原木筹、资源不足或已有待用赠物，本次仅继承破绽护身。'; }
  } else if (id === DEVIATION) {
    if (r.pending.some(p => p.kind === 'ORDERED_DEVIATION') || r.playerS < 5) { a.selectedAbility = 'OBSERVE'; a.fallbackReason = 'PENDING_OR_RESOURCES'; a.label = '已有未用偏转或不足5灵性，本次普通观察。'; }
    else { pay(5); b.deviationAttempts++; check(); a.resisted = b.composureReady; a.succeeded &&= !a.resisted;
      if (a.succeeded) r.pending.push(pending(x, r, a, 'ORDERED_DEVIATION', null, .5)); a.mode = 'ORDERED_DEVIATION';
      a.label = `继承偏转实付5灵性，知识20检定${a.check!.roll}/${a.check!.chance}；${a.resisted ? '对手凝神抵抗，费用不退' : a.succeeded ? '只建立本人30秒待用影响，减半下一次实际身体、弧光或屏护' : '失败，费用不退'}。`; }
  } else {
    const p = r.pending.find(v => !v.extended && v.expiresAt > r.root.clockSeconds), gift = r.pending.find(v => v.kind === 'GIFT_WEAKENING' && !v.exploited && v.remaining === 1);
    if (p && r.playerS >= 5 && r.playerM >= 1) { pay(5, 1); b.prolongationAttempts++; check(); a.mode = 'PROLONGATION';
      if (a.succeeded) { p.expiresAt += 30; p.extended = true; } a.giftId = p.giftId;
      a.label = `效果延长实付5灵性1精神，知识20检定${a.check!.roll}/${a.check!.chance}；${a.succeeded ? '只将本人同一仍有效的待用影响延长30秒一次，次数不变' : '失败，原截止时间不变，费用不退'}。`; }
    else if (gift && r.playerS >= 3 && (r.playerS < 5 || r.playerM < 1)) { pay(3); gift.remaining = 2; gift.exploited = true; b.exploitUses++; a.selectedAbility = EXPLOIT; a.giftId = gift.giftId; a.mode = 'EXPLOIT'; a.fallbackReason = 'S2_RESOURCES_UNAVAILABLE'; a.label = '新术资源不足，仅付3灵性使用继承利用；同一原木筹待用次数从一到二，原截止时间不变，只能一次。'; }
    else { a.selectedAbility = 'OBSERVE'; a.fallbackReason = 'NO_EXTENDABLE_OWN_EFFECT'; a.label = '没有本人仍可延长的待用影响或资源不足，只普通观察；不重建已结束状态。'; }
  }
  if (a.rawContribution === 0) a.rawContribution = a.selfGain; a.rawReduction = a.enemyReduction; syncPending(r); return closeAction(a, r, random);
}
export function resolveEntropyDukeEnemySlot(x: EntropyDukeCombatSource, r: EntropyDukeRuntime, planned: EntropyDukeEnemyIntent, order: number, random: ActionRandomStream): EntropyDukeActionEvidence {
  const a = baseAction(x, r, 'ENEMY', planned, order, random), b = r.body, p = ENTROPY_DUKE_POWERS.find(v => v.id === planned), payable = !!p && b.enemySpirituality >= p.cost;
  if (planned === 'ACCIDENT') { a.mode = 'ACCIDENT'; a.selfGain = -22.5; a.label = '奥斯温此次动作偏差，贡献−22.5。'; }
  else if (payable) {
    a.mode = p.id; a.paidCost = p.cost; b.enemySpirituality -= p.cost; b.powerUses[p.id]++; a.selfGain = p.selfGain; a.enemyReduction = p.enemyReduction;
    if (p.id === 'ARC_BOLT') { a.attackKind = 'ARC'; a.threatens = true; a.label = '奥斯温实际付5灵性发出有限弧光，对身体形成真实威胁。'; }
    else if (p.id === 'MENTAL_PRESSURE') { a.attackKind = 'MIND'; a.mentalPressure = true; a.label = '奥斯温实际付5灵性向独立心智施加有限精神压力，只有精神后果。'; }
    else if (p.id === 'COMPOSE') { r.pending = r.pending.filter(v => v.kind !== 'ORDERED_DEVIATION'); b.composureReady = true; a.label = '奥斯温付4灵性自主凝神，取消未用偏转并抵抗本轮新偏转；原已给木筹不退回。'; }
    else a.label = '奥斯温付4灵性施展自己的有限屏护，保持独立防御。';
  } else { a.id = a.selectedAbility = 'BODY_STRIKE'; a.mode = 'BODY'; a.fallbackReason = p ? 'INSUFFICIENT_ENEMY_SPIRITUALITY' : null; a.attackKind = 'BODY'; a.threatens = true; a.selfGain = 20 * a.physicalFactor; a.travelMetres = 4; a.label = '奥斯温持自己的唯一手杖近前2米打击再退回2米，灵性不足时只执行这一普通动作。'; }
  a.rawContribution = a.selfGain; a.rawReduction = a.enemyReduction;
  for (const effect of [...r.pending]) {
    const applies = effect.kind === 'ORDERED_DEVIATION' ? a.attackKind === 'BODY' || a.attackKind === 'ARC' || p?.id === 'WARD' && payable : a.attackKind !== 'NONE';
    if (!applies || a.selfGain <= 0 && a.enemyReduction <= 0) continue;
    if (effect.kind === 'ORDERED_DEVIATION') { a.selfGain *= .5; a.enemyReduction *= .5; } else a.selfGain *= 1 - effect.factor;
    a.pendingApplied.push(effect.id);
    if (effect.extended && !effect.extensionApplied && r.root.clockSeconds >= effect.originalExpiresAt) { gainMastery(r, a, PROLONGATION); effect.extensionApplied = true; }
    if (effect.remaining === 2) effect.remaining = 1; else r.pending = r.pending.filter(v => v.id !== effect.id);
    a.label += ' 本人先前待用影响现在才作用于这次实际动作，对手已经支付全额费用。';
  }
  syncPending(r); return closeAction(a, r, random);
}
export interface EntropyDukeRoundOutcome extends EntropyDukeCombatBody {
  targetId: typeof ENTROPY_DUKE_TARGET_ID; round: number; source: EntropyDukeCombatSource; stance: SliceStance; continuing: boolean;
  playerHealthAfter: number; playerMindAfter: number; playerSpiritualityAfter: number; playerInjuriesAfter: SliceInjury[]; playerRiskAfter: number; giftsAfter: BriberGift[]; masteryAfter: Record<string, number>;
  rootAfter: EntropyDukeSceneRoot; elapsedSeconds: 60; randomCursorAfter: number; playerActions: EntropyDukeActionEvidence[]; enemyActions: EntropyDukeActionEvidence[]; expiredPending: EntropyDukePendingEffect[];
}
export type EntropyDukeResolution = 'CONTINUE' | 'PLAYER_DEAD' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED' | 'RETREATED';
function penalty(n: number, max: number) { const f = n / max; return f > .75 ? 0 : f > .5 ? .05 : f > .25 ? .1 : .2; }
function base(core: number, h: number, m: number, s: number) { return (1250 + Math.min(core, 250)) * (1 - Math.min(.4, penalty(h, 100) + penalty(m, 100) + penalty(s, 120))); }
function weights(risk: number) { const death = Math.min(100, 5 + Math.min(risk, 10) * 10), shifted = death - 5; return { light: Math.max(0, 65 - shifted), heavy: Math.max(0, 30 - Math.max(0, shifted - 65)), death }; }
export function validEntropyDukeBody(b: EntropyDukeCombatBody, _maxRound = Number.MAX_SAFE_INTEGER): boolean {
  return integer(b.enemyHealth, 0, 100) && integer(b.enemyMind, 0, 100) && integer(b.enemySpirituality, 0, 120) && integer(b.enemyRisk) && Array.isArray(b.enemyInjuries) &&
    ['RESISTING', 'SURRENDERED', 'DEAD'].includes(b.enemyStatus) && (b.enemyStatus === 'DEAD') === (b.enemyHealth === 0) && b.weaponLocation === (b.enemyStatus === 'DEAD' ? 'COURT' : 'HAND') &&
    shape(b.powerUses, ENTROPY_DUKE_POWER_IDS) && ENTROPY_DUKE_POWER_IDS.every(id => integer(b.powerUses[id])) && b.enemySpirituality === 120 - ENTROPY_DUKE_POWERS.reduce((n, p) => n + p.cost * b.powerUses[p.id], 0) &&
    b.pendingKind === null && b.composureReady === false && [b.deviationAttempts, b.magnifyUses, b.exploitUses, b.amplificationAttempts, b.prolongationAttempts].every(n => integer(n));
}
export function validEntropyDukeInjuries(injuries: SliceInjury[], revision: number): boolean {
  return Array.isArray(injuries) && new Set(injuries.map(i => i.id)).size === injuries.length && injuries.every(i => shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && !!i.id && ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision, 0, revision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision, revision)));
}
const SOURCE_KEYS = ['runId', 'revision', 'week', 'date', 'round', 'encounterId', 'targetId', 'attemptWeek', 'startHistoryIndex', 'targetName', 'targetAge', 'targetPathway', 'targetSequence', 'targetCore', 'actualBody', 'independentMind', 'enemyWeapon', 'weaponOwner', 'yardId', 'enemyPosition', 'enemyDistanceMetres', 'ordinaryExit', 'pursuit', 'thirdPartiesInArea', 'automaticAllyImmunity', 'freeSkillLibrary', 'playerHealth', 'playerMind', 'playerSpirituality', 'playerInjuries', 'playerRisk', 'physique', 'perception', 'will', 'knowledge', 'mastery', 'clubHeld', 'gifts', 'preparation', 'root', 'body', 'randomSeed', 'randomCursor'];
export function validEntropyDukeCombatSource(x: EntropyDukeCombatSource): boolean {
  try { const p = x.root;
    return shape(x, SOURCE_KEYS) && shape(x.body, Object.keys(combatBody(x.body))) && validateEntropyDukePreparation(x.preparation) && typeof x.runId === 'string' && !!x.runId && integer(x.revision) && integer(x.week, 1) && integer(x.round, 1) && integer(x.startHistoryIndex) && x.attemptWeek === x.week && x.week === x.preparation.week && same(x.date, x.preparation.date) &&
      x.encounterId === 'ENTROPY_DUKE_DISPUTE' && x.targetId === ENTROPY_DUKE_TARGET_ID && x.targetName === '奥斯温·格雷' && x.targetAge === 46 && x.targetPathway === 'original-caster' && x.targetSequence === 3 && x.targetCore === 22 &&
      x.actualBody === true && x.independentMind === true && x.enemyWeapon === 'ED2-OSWIN-ROD' && x.weaponOwner === ENTROPY_DUKE_TARGET_ID && x.yardId === 'FM3-DELIVERY-PRACTICE' && x.enemyPosition === 'BETWEEN_A_AND_B' && x.enemyDistanceMetres === 2 &&
      x.ordinaryExit === 'OPEN' && x.pursuit === false && x.thirdPartiesInArea === 0 && x.automaticAllyImmunity === false && x.freeSkillLibrary === false && [x.playerHealth, x.playerMind].every(n => integer(n, 1, 100)) && integer(x.playerSpirituality, 0, 120) &&
      [x.physique, x.perception, x.will, x.knowledge].every(n => integer(n, 0, 500)) && !!x.mastery && typeof x.mastery === 'object' && !Array.isArray(x.mastery) && Object.values(x.mastery).every(n => integer(n, 0, 500)) && typeof x.clubHeld === 'boolean' && integer(x.playerRisk) && validEntropyDukeInjuries(x.playerInjuries, x.revision) && validEntropyDukeInjuries(x.body.enemyInjuries, x.revision) && validEntropyDukeGifts(x.gifts, x.week) &&
      p.siteId === 'FM3-DELIVERY-PRACTICE' && p.playerLocation === 'A' && p.volunteer.id === 'FM3-DARIAN' && p.volunteer.age === 42 && p.volunteer.location === 'OUTSIDE' && p.volunteer.alive && p.guide.id === 'GUIDE' && p.guide.location === 'OUTSIDE' &&
      [p.parcel, p.ball, p.paper].every(item => item.holder === 'GUIDE' && item.location === 'OUTSIDE') && p.activeCase === null && integer(p.clockSeconds) && integer(p.playerTravelMetres) && validEntropyDukeBody(x.body, x.round - 1) && x.body.enemyStatus === 'RESISTING' && x.body.enemyMind > 0 &&
      typeof x.randomSeed === 'string' && !!x.randomSeed && integer(x.randomCursor) && x.preparation.runId === x.runId && x.preparation.randomSeed === x.randomSeed && x.preparation.randomCursor <= x.randomCursor && x.preparation.revision < x.revision && p.clockSeconds === x.preparation.lifeClockSeconds + 16 + 60 * (x.round - 1);
  } catch { return false; }
}
export function replayEntropyDukeCombatRound(x: EntropyDukeCombatSource, stance: SliceStance): { round: SliceCombatRound; outcome: EntropyDukeResolution } {
  if (!validEntropyDukeCombatSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new Error('缺少真实原来源。');
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = createEntropyDukeRuntime(x), b = r.body;
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = entropyDukeActionCount(playerCountRoll), enemyCount = entropyDukeEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: EntropyDukeActionEvidence[] = [], enemies: EntropyDukeActionEvidence[] = [], remaining = { PLAYER: playerCount, ENEMY: enemyCount }; let retreat: SliceCombatRound['retreat'] = 'NONE';
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) for (const actor of order) {
    if (!remaining[actor]) continue;
    if (actor === 'PLAYER' && stance === 'RETREAT') { remaining.PLAYER = 0; retreat = rng.nextInt(1, 100) <= 50 ? 'SUCCESS' : 'FAILURE'; if (retreat === 'SUCCESS') { remaining.ENEMY = 0; break; } continue; }
    remaining[actor]--; const index = players.length + enemies.length;
    if (actor === 'PLAYER') players.push(resolveEntropyDukePlayerSlot(x, r, drawEntropyDukeAbility(rng, null, stance), index, rng)); else enemies.push(resolveEntropyDukeEnemySlot(x, r, drawEntropyDukeEnemyAbility(rng), index, rng));
  }
  const sum = (a: EntropyDukeActionEvidence[], key: 'selfGain' | 'enemyReduction') => a.reduce((n, v) => n + v[key], 0);
  const playerAdvantage = Math.max(125, base(x.physique * .35 + x.perception * .15 + x.will * .2 + x.knowledge * .3, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, base(22, x.body.enemyHealth, x.body.enemyMind, x.body.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction'));
  const winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100, winner = retreat === 'SUCCESS' ? 'ENEMY' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  let playerHealth = x.playerHealth, playerRisk = x.playerRisk, outcome: EntropyDukeResolution = retreat === 'SUCCESS' ? 'RETREATED' : 'CONTINUE';
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
  advanceEntropyDukeCombatClock(r, x.root.clockSeconds + 60 - r.root.clockSeconds); const expiredPending = structuredClone(r.pending); r.pending = []; b.pendingKind = null; b.composureReady = false; if (b.enemyHealth === 0) b.weaponLocation = 'COURT';
  const o: EntropyDukeRoundOutcome = { ...structuredClone(b), targetId: ENTROPY_DUKE_TARGET_ID, round: x.round, source: structuredClone(x), stance, continuing: outcome === 'CONTINUE',
    playerHealthAfter: playerHealth, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, playerInjuriesAfter: playerInjuries, playerRiskAfter: playerRisk, giftsAfter: structuredClone(r.gifts), masteryAfter: { ...r.mastery },
    rootAfter: structuredClone(r.root), elapsedSeconds: 60, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies, expiredPending };
  const round: SliceCombatRound = { round: x.round, stance, first, playerCount, enemyCount, playerCountRoll, enemyCountRoll,
    moves: [...players, ...enemies].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })),
    playerAdvantage, enemyAdvantage, winChance, winner, consequence: '', consequenceWeights, retreat, ...(consequenceDomain === undefined ? {} : { consequenceDomain }), ...(consequenceRoll === undefined ? {} : { consequenceRoll }),
    entropyDukeOutcome: o };
  round.consequence = entropyDukeCombatConsequence(round); return { round, outcome };
}
export function validateEntropyDukeRoundOutcome(v: unknown): v is EntropyDukeRoundOutcome { try { const o = v as EntropyDukeRoundOutcome; return !!o && same(o, replayEntropyDukeCombatRound(o.source, o.stance).round.entropyDukeOutcome); } catch { return false; } }
export function validateEntropyDukeCombatRound(round: SliceCombatRound): boolean { try { const o = round.entropyDukeOutcome; return !!o && same(round, replayEntropyDukeCombatRound(o.source, o.stance).round); } catch { return false; } }
export function nextEntropyDukeCombatSource(o: EntropyDukeRoundOutcome): EntropyDukeCombatSource {
  return { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter,
    playerSpirituality: Math.min(120, o.playerSpiritualityAfter + 12), playerInjuries: structuredClone(o.playerInjuriesAfter), playerRisk: o.playerRiskAfter,
    root: structuredClone(o.rootAfter), body: combatBody(o), gifts: structuredClone(o.giftsAfter), mastery: { ...o.masteryAfter }, randomCursor: o.randomCursorAfter };
}
export function entropyDukeCombatConsequence(round: SliceCombatRound): string {
  const o = round.entropyDukeOutcome!, who = round.winner === 'PLAYER' ? '奥斯温' : '你'; let text = round.retreat === 'SUCCESS' ? '撤离判定成功，沿普通4米出口离开。' : round.consequenceDomain === 'MENTAL' ? `${who}承受实际精神压力，精神减少10，没有新增身体伤口。` : round.consequenceDomain === 'BODY' ? `${who}承受实际身体打击或法术冲击，按共同伤势盘结算。` : '本轮下风没有实际攻击来源，不掷身体伤势盘。';
  if (o.playerHealthAfter === 0) text += '本人的原身体真实死亡，不能复活或离场。'; else if (o.enemyHealth === 0) text += '奥斯温原身体真实死亡，唯一原杖留地。'; else if (o.enemyStatus === 'SURRENDERED') text += '奥斯温因实际伤势或精神耗尽自主停止抵抗。';
  return text + ' 本轮实际60秒；未用窗口到期，已花灵性、精神不退。全部原人物与旧记录保持原样。';
}
export function projectEntropyDukeCombat(s: SliceState) {
  const e = s.entropyDuke.encounter, last = s.combat?.encounterId === 'ENTROPY_DUKE_DISPUTE' ? s.combat.lastRound?.entropyDukeOutcome : e.terminal ? s.combatHistory[e.terminal.historyIndex]?.entropyDukeOutcome : null;
  return { enemyName: isEntropyDuke(s) ? '奥斯温·格雷（46岁，序列3施术者）' : '', targetId: e.targetId, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality,
    weaponLocation: e.weaponLocation, pendingKind: e.pendingKind, composureReady: e.composureReady, powerUses: { ...e.powerUses },
    lastActionSequence: last ? [...last.playerActions, ...last.enemyActions].sort((a, b) => a.order - b.order) : [], countWheel: ENTROPY_DUKE_COUNT_WHEEL, enemyCountWheel: ENTROPY_DUKE_ENEMY_COUNT_WHEEL, enemyAbilityWheel: ENTROPY_DUKE_ENEMY_ABILITY_WHEEL,
    summary: '行为增幅6灵性1精神只处理本人当前击打；效果延长5灵性1精神只把本人仍有效的同一待用影响延长30秒一次。知识20检定可以失败，费用不退。旧身体、放大、破绽、赠物削弱、利用与偏转沿真实资源结算。奥斯温拥有独立屏护、凝神、身体与精神攻击，身体和精神后果分开结算。双方灵性上限120，35/15/20/30核心权重不变，普通4米出口开放。' };
}
export type EntropyDukeCombatProjection = ReturnType<typeof projectEntropyDukeCombat>;
