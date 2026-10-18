import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicGameDate, PublicCheckResult } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import type { BriberGift } from '../briber/types.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { PRINCE_OF_ABOLITION_ABILITY_IDS, type PrinceOfAbolitionSite, type PrinceOfAbolitionOriginals } from './types.js';
import { PRINCE_OF_ABOLITION_INHERITED_ABILITIES } from './content.js';
import type { EntropyDukeOperationState } from '../entropy-duke/life.js';
import { validatePrinceOfAbolitionCurrentSite } from './life.js';
import { PRINCE_OF_ABOLITION_TARGET_ID, PRINCE_OF_ABOLITION_POWER_IDS, PRINCE_OF_ABOLITION_POWERS, combatBody, hasPrinceOfAbolitionDisputeOpponent, validatePrinceOfAbolitionPreparation,
  PRINCE_OF_ABOLITION_POLICIES, createPrinceOfAbolitionBody, princeOfAbolitionEncounterBudget, princeOfAbolitionFinanceSnapshot, princeOfAbolitionApproachedSite, validPrinceOfAbolitionSupportPieces, validPrinceOfAbolitionEnemyCharges, createPrinceOfAbolitionSupportPieces,
  type PrinceOfAbolitionCombatBody, type PrinceOfAbolitionEnemyIntent, type PrinceOfAbolitionPreparation, type PrinceOfAbolitionPolicy, type PrinceOfAbolitionWindow, type PrinceOfAbolitionEncounterBudget, type PrinceOfAbolitionFinanceSnapshot } from './encounter.js';

export const PRINCE_OF_ABOLITION_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const PRINCE_OF_ABOLITION_ENEMY_COUNT_WHEEL = PRINCE_OF_ABOLITION_COUNT_WHEEL;
export const princeOfAbolitionActionCount = pyromaniacActionCount;
export const princeOfAbolitionEnemyActionCount = pyromaniacActionCount;
export const PRINCE_OF_ABOLITION_INHERITED_IDS=PRINCE_OF_ABOLITION_INHERITED_ABILITIES.map(a=>a.id);
const MASTERY_IDS=[...PRINCE_OF_ABOLITION_INHERITED_IDS,...PRINCE_OF_ABOLITION_ABILITY_IDS];
export const DIRECTED = 'black-emperor.s1.directed-amplification', MAINTENANCE = 'black-emperor.s1.effect-maintenance';
export const AMPLIFICATION = 'black-emperor.s2.action-amplification', PROLONGATION = 'black-emperor.s2.effect-prolongation';
export const PRINCE_OF_ABOLITION_GIFT_GROUND = 'BATTLE:PRINCE_OF_ABOLITION_DISPUTE:GROUND';
const MAGNIFY = 'black-emperor.s4.magnify', DEVIATION = 'black-emperor.s3.ordered-deviation', BRIBERY = 'black-emperor.s7.bribery-weakening', EXPLOIT = 'black-emperor.s4.exploit';
export type PrinceOfAbolitionMoveId = typeof AMPLIFICATION | 'BODY_FOLLOWUP' | typeof BRIBERY | typeof DEVIATION | typeof PROLONGATION | typeof DIRECTED | typeof MAINTENANCE | 'ACCIDENT';
const ABILITIES: readonly { id: PrinceOfAbolitionMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: AMPLIFICATION, label: '行为增幅：6灵性1精神，知识20；仅本人当次身体击打。条件不足沿继承放大或普通主攻', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承强化身体侧击：41.405×掌握×身体，0灵性', weight: 15, stance: 'ATTACK' },
  { id: BRIBERY, label: '原木筹削弱：真实库存1件与3灵性；否则继承破绽护身', weight: 25, stance: 'DEFEND' },
  { id: DEVIATION, label: '继承既有动作偏转：5灵性，知识20；30秒内下一次实际身体、弧光或屏护减半', weight: 10, stance: 'CONTROL' },
  { id: PROLONGATION, label: '效果延长：5灵性1精神，知识20；本人仍有效的同一待用影响仅延长30秒一次', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '实际动作偏差：固定−22.5，0灵性', weight: 5, stance: null },
  { id: DIRECTED, label: '定向增幅：8灵性2精神1护片，知识18；20秒内本人下一未结算身体行动+35，失败4精神', weight: 20, stance: 'ATTACK' },
  { id: MAINTENANCE, label: '效果维持：8灵性2精神1护片，知识18与目标抵抗；20秒内下一身体或弧光冲击−30，精神无效', weight: 20, stance: 'DEFEND' },
];
export const PRINCE_OF_ABOLITION_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '有限弧光：5灵性1刻片，70身体攻击贡献', weight: 35 },
  { id: 'WARD', label: '有限屏护：4灵性，敌方−30', weight: 20 },
  { id: 'BODY_STRIKE', label: '本人手杖打击：20×身体', weight: 20 },
  { id: 'COMPOSE', label: '自主凝神：4灵性，贡献8；清除未用偏转并抵抗本轮输入', weight: 10 },
  { id: 'MENTAL_PRESSURE', label: '有限精神施压：5灵性1刻片，45精神攻击贡献；只造成精神后果', weight: 10 },
  { id: 'ACCIDENT', label: '实际偏差：−22.5，0灵性', weight: 5 },
];
export const isPrinceOfAbolition = (s: SliceState) => s.progression.pathwayId === 'black-emperor' && s.progression.sequence === 1;
const enabled = (id: PrinceOfAbolitionMoveId, p: PrinceOfAbolitionPolicy) => id === DIRECTED ? p === 'ALL' || p === 'DIRECTED' : id === MAINTENANCE ? p === 'ALL' || p === 'MAINTENANCE' : true;
const tickets = (stance: SliceStance | null, policy: PrinceOfAbolitionPolicy) => ABILITIES.map(a => enabled(a.id, policy) ? a.weight * (a.stance === stance && stance !== null ? 5 : 4) : 0);
export function princeOfAbolitionAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const policy = s.princeOfAbolition?.encounter.policy ?? 'ALL', w = tickets(stance, policy), total = w.reduce((a,b) => a+b,0);
  return ABILITIES.flatMap((a,i) => w[i] ? [{ id: a.id, label: policy === 'ORDINARY' && a.id !== 'ACCIDENT' ? '普通身体、格挡或观察，0超凡费用' : a.label, weight: w[i]! / total * 100 }] : []);
}
export function drawPrinceOfAbolitionAbility(random: ActionRandomStream, s: SliceState | null, stance: SliceStance | null, policy: PrinceOfAbolitionPolicy = s?.princeOfAbolition.encounter.policy ?? 'ALL'): PrinceOfAbolitionMoveId {
  const w = tickets(stance, policy); let n = random.nextInt(1,w.reduce((a,b)=>a+b,0));
  for (const [i,a] of ABILITIES.entries()) { n -= w[i]!; if (n <= 0) return a.id; } throw new Error('行动盘无效。');
}
export function drawPrinceOfAbolitionEnemyAbility(random: ActionRandomStream): PrinceOfAbolitionEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of PRINCE_OF_ABOLITION_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as PrinceOfAbolitionEnemyIntent; } throw new Error('对手行动盘无效。');
}
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
const physicalAt = (n: number) => n > 75 ? 1 : n > 50 ? .95 : n > 25 ? .9 : .8;
const factor = (n: number) => .65 + .35 * n / 500;
export function validPrinceOfAbolitionGifts(gifts: BriberGift[], week: number): boolean {
  return Array.isArray(gifts) && gifts.length === 15 && gifts.every((g, i) => shape(g, ['id', 'location', 'destination', 'givenWeek']) && g.id === `BR7-GIFT-${i + 1}` &&
    (g.location === 'PLAYER' ? g.destination === null && g.givenWeek === null : g.location === 'GIVEN' && typeof g.destination === 'string' && !!g.destination && integer(g.givenWeek, 1, week)));
}
export interface PrinceOfAbolitionCombatSource {
  runId: string; revision: number; week: number; date: PublicGameDate; round: number; encounterId: 'PRINCE_OF_ABOLITION_DISPUTE'; targetId: typeof PRINCE_OF_ABOLITION_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetName: '埃德蒙·维尔'; targetAge: 44; targetPathway: 'independent-caster'; targetSequence: 2; targetCore: 24; targetWill: 22; maxActionCount: 6;
  actualBody: true; independentMind: true; enemyWeapon: 'PA1-EDMUND-ROD'; weaponOwner: typeof PRINCE_OF_ABOLITION_TARGET_ID; yardId: 'PA1-ADJACENT-YARD'; playerPosition: 'YARD'; enemyPosition: 'YARD'; enemyDistanceMetres: 2;
  ordinaryExit: 'OPEN'; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false; freeSkillLibrary: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; playerInjuries: SliceInjury[]; playerRisk: number;
  physique: number; perception: number; will: number; knowledge: number; mastery: Record<string, number>; clubHeld: boolean; gifts: BriberGift[];
  preparation: PrinceOfAbolitionPreparation; site: PrinceOfAbolitionSite; operation: EntropyDukeOperationState; originals: PrinceOfAbolitionOriginals; body: PrinceOfAbolitionCombatBody;
  budget: PrinceOfAbolitionEncounterBudget; finance: PrinceOfAbolitionFinanceSnapshot; policy: PrinceOfAbolitionPolicy; randomSeed: string; randomCursor: number;
}
export function currentPrinceOfAbolitionCombatSource(s: SliceState): PrinceOfAbolitionCombatSource | null {
  if (!hasPrinceOfAbolitionDisputeOpponent(s)) return null; const e = s.princeOfAbolition.encounter, c = s.combat!, originals = s.princeOfAbolition.sourceScene?.originals;
  if (!e.preparation || !e.currentSite || !originals) return null;
  return { runId: s.runId, revision: s.revision, week: s.week, date: { ...s.date }, round: c.round, encounterId: 'PRINCE_OF_ABOLITION_DISPUTE', targetId: PRINCE_OF_ABOLITION_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetName: '埃德蒙·维尔', targetAge: 44, targetPathway: 'independent-caster', targetSequence: 2, targetCore: 24, targetWill: 22, maxActionCount: 6,
    actualBody: true, independentMind: true, enemyWeapon: 'PA1-EDMUND-ROD', weaponOwner: PRINCE_OF_ABOLITION_TARGET_ID, yardId: 'PA1-ADJACENT-YARD', playerPosition: 'YARD', enemyPosition: 'YARD', enemyDistanceMetres: 2,
    ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false, freeSkillLibrary: false,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, playerInjuries: structuredClone(s.injuries), playerRisk: s.injuryRisk,
    ...s.character.coreStats, mastery: { ...s.progression.mastery }, clubHeld: s.town.clubLocation === 'HAND', gifts: structuredClone(s.princeOfAbolition.gifts),
    preparation: structuredClone(e.preparation), site: structuredClone(e.currentSite), operation: structuredClone(s.princeOfAbolition.life.operation), originals: structuredClone(originals), body: combatBody(e),
    budget: princeOfAbolitionEncounterBudget(s), finance: princeOfAbolitionFinanceSnapshot(s), policy: e.policy, randomSeed: s.random.seed, randomCursor: s.random.cursor };
}
/** A pending effect belongs to this player, this encounter and one actual cast. */
export interface PrinceOfAbolitionPendingEffect {
  id: string; owner: 'PLAYER'; kind: 'ORDERED_DEVIATION' | 'GIFT_WEAKENING'; createdAt: number; originalExpiresAt: number; expiresAt: number;
  extended: boolean; extensionApplied: boolean; remaining: 1 | 2; exploited: boolean; factor: number; giftId: string | null;
}
export interface PrinceOfAbolitionActionEvidence {
  order: number; actor: 'PLAYER' | 'ENEMY'; id: string; planned: string; selectedAbility: string; fallbackReason: string | null; mode: string; label: string;
  selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean; attackKind: 'NONE' | 'BODY' | 'ARC' | 'MIND'; rawContribution: number; rawReduction: number;
  paidCost: number; mindCost: number; physicalFactor: number; check: PublicCheckResult | null; succeeded: boolean; resisted: boolean; giftId: string | null;
  pendingBefore: PrinceOfAbolitionPendingEffect[]; pendingAfter: PrinceOfAbolitionPendingEffect[]; pendingApplied: string[]; masteryApplied: string[];
  atSeconds: number; elapsedSeconds: 5; travelMetres: number; randomCursorBefore: number; randomCursorAfter: number;
  playerMindAfter: number; playerSpiritualityAfter: number; enemySpiritualityAfter: number;
  windowGranted: PrinceOfAbolitionWindow | null; windowsApplied: { kind: PrinceOfAbolitionWindow['kind']; amount: number; supportId: string }[]; windowsExpired: PrinceOfAbolitionWindow[]; windowsCancelled: PrinceOfAbolitionWindow[]; pendingCancelled: PrinceOfAbolitionPendingEffect[]; supportId: string | null; supportWearPaid: number; enemyChargeId: string | null; resistanceChance: number | null; resistanceRoll: number | null;
}
export interface PrinceOfAbolitionRuntime { body: PrinceOfAbolitionCombatBody; root: PrinceOfAbolitionSite; playerS: number; playerM: number; gifts: BriberGift[]; mastery: Record<string, number>; pending: PrinceOfAbolitionPendingEffect[]; expiredWindows: PrinceOfAbolitionWindow[]; expiredEffects: PrinceOfAbolitionPendingEffect[] }
export function createPrinceOfAbolitionRuntime(x: PrinceOfAbolitionCombatSource): PrinceOfAbolitionRuntime {
  return { body: structuredClone(x.body), root: structuredClone(x.site), playerS: x.playerSpirituality, playerM: x.playerMind, gifts: structuredClone(x.gifts), mastery: { ...x.mastery }, pending: structuredClone(x.body.pendingEffects), expiredWindows: [], expiredEffects: [] };
}
function syncPending(r: PrinceOfAbolitionRuntime): void { r.body.pendingEffects = structuredClone(r.pending); r.body.pendingKind = r.pending.some(p => p.kind === 'ORDERED_DEVIATION') ? 'ORDERED_DEVIATION' : null; }
export function advancePrinceOfAbolitionCombatClock(r: PrinceOfAbolitionRuntime, seconds: number): void {
  if (!integer(seconds)) throw new Error('实际时间无效。'); r.root.clockSeconds += seconds; for (const key of ['directed', 'maintenance'] as const) { const w = r.body[key]; if (w && w.expiresAt <= r.root.clockSeconds) { r.expiredWindows.push(structuredClone(w)); r.body[key] = null; } } r.expiredEffects.push(...structuredClone(r.pending.filter(p => p.expiresAt <= r.root.clockSeconds))); r.pending = r.pending.filter(p => p.expiresAt > r.root.clockSeconds); syncPending(r);
}
function baseAction(x: PrinceOfAbolitionCombatSource, r: PrinceOfAbolitionRuntime, actor: 'PLAYER' | 'ENEMY', id: string, order: number, random: ActionRandomStream): PrinceOfAbolitionActionEvidence {
  return { actor, id, planned: id, selectedAbility: id, fallbackReason: null, order, mode: 'OBSERVE', label: '', selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false,
    attackKind: 'NONE', rawContribution: 0, rawReduction: 0, paidCost: 0, mindCost: 0, physicalFactor: physicalAt(actor === 'PLAYER' ? x.playerHealth : x.body.enemyHealth), check: null, succeeded: false, resisted: false, giftId: null,
    pendingBefore: structuredClone(r.pending), pendingAfter: [], pendingApplied: [], masteryApplied: [], atSeconds: r.root.clockSeconds, elapsedSeconds: 5, travelMetres: 0,
    randomCursorBefore: random.cursor, randomCursorAfter: random.cursor, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, enemySpiritualityAfter: r.body.enemySpirituality, windowGranted: null, windowsApplied: [], windowsExpired: [], windowsCancelled: [], pendingCancelled: [], supportId: null, supportWearPaid: 0, enemyChargeId: null, resistanceChance: null, resistanceRoll: null };
}
function gainMastery(r: PrinceOfAbolitionRuntime, a: PrinceOfAbolitionActionEvidence, id: string): void { r.mastery[id] = Math.min(500, (r.mastery[id] ?? 0) + 8); a.masteryApplied.push(id); }
function closeAction(a: PrinceOfAbolitionActionEvidence, r: PrinceOfAbolitionRuntime, random: ActionRandomStream) {
  const expiredBefore = r.expiredWindows.length; advancePrinceOfAbolitionCombatClock(r, 5); a.windowsExpired.push(...structuredClone(r.expiredWindows.slice(expiredBefore))); a.pendingAfter = structuredClone(r.pending); a.randomCursorAfter = random.cursor; a.playerMindAfter = r.playerM; a.playerSpiritualityAfter = r.playerS;
  a.enemySpiritualityAfter = r.body.enemySpirituality; a.label += ` 此次5秒；本人余${r.playerS}灵性、${r.playerM}精神；埃德蒙余${r.body.enemySpirituality}/120灵性。`; return a;
}
function pending(x: PrinceOfAbolitionCombatSource, r: PrinceOfAbolitionRuntime, a: PrinceOfAbolitionActionEvidence, kind: PrinceOfAbolitionPendingEffect['kind'], giftId: string | null, amount: number): PrinceOfAbolitionPendingEffect {
  return { id: `${x.runId}:${x.round}:${a.order}:${kind}`, owner: 'PLAYER', kind, createdAt: r.root.clockSeconds, originalExpiresAt: r.root.clockSeconds + 30, expiresAt: r.root.clockSeconds + 30,
    extended: false, extensionApplied: false, remaining: 1, exploited: false, factor: amount, giftId };
}
function resolveNewWindow(x: PrinceOfAbolitionCombatSource, r: PrinceOfAbolitionRuntime, id: typeof DIRECTED | typeof MAINTENANCE, a: PrinceOfAbolitionActionEvidence, random: ActionRandomStream): PrinceOfAbolitionActionEvidence {
  const key = id === DIRECTED ? 'directed' : 'maintenance', piece = r.body.supportPieces.find(p => p.status === 'HELD');
  if (!enabled(id,x.policy) || x.policy === 'ORDINARY') { a.fallbackReason='POLICY'; a.label='当前许可不使用此术，仅作普通观察。'; }
  else if (r.body[key]) { a.fallbackReason='ACTIVE_WINDOW'; a.label='本人同一待用窗口仍有效，不重施、不叠加、不重复收费。'; }
  else if (!piece || r.playerS < 8 || r.playerM < 4) { a.fallbackReason='INSUFFICIENT_RESOURCES'; a.label='没有实际可用护片或不足8灵性4精神，只观察，不透支或补发护片。'; }
  else {
    a.mode = id===DIRECTED ? 'DIRECTED' : 'MAINTENANCE'; a.paidCost=8; a.mindCost=2; r.playerS-=8; r.playerM-=2;
    piece.status='SPENT'; piece.wear=1; piece.usedRound=x.round; piece.usedOrder=a.order; a.supportId=piece.id; a.supportWearPaid=1;
    if (id===DIRECTED) r.body.directedAttempts++; else r.body.maintenanceAttempts++;
    a.check=resolveNormalCheck({ability:'knowledge',baseAbility:x.knowledge,difficulty:18,modifiers:[],roll:random.nextInt(1,100)});
    a.succeeded=['SUCCESS','GREAT_SUCCESS'].includes(a.check.tier);
    if (a.succeeded && id===MAINTENANCE) { a.resistanceChance=57; a.resistanceRoll=random.nextInt(1,100); a.resisted=r.body.composureReady || a.resistanceRoll<=a.resistanceChance; a.succeeded=!a.resisted; }
    if (!a.succeeded) { a.mindCost+=2; r.playerM-=2; a.label=`${a.resisted?'独立对手抵抗了维持输入':'知识18检定失败'}；实际8灵性4精神、一枚护片与磨损照付，没有建立影响。`; }
    else { const w:PrinceOfAbolitionWindow={kind:id===DIRECTED?'DIRECTED':'MAINTENANCE',round:x.round,order:a.order,castAt:r.root.clockSeconds,expiresAt:r.root.clockSeconds+20,remaining:1,supportId:piece.id};
      r.body[key]=w; a.windowGranted=structuredClone(w); a.label=id===DIRECTED?'定向增幅已付8灵性2精神一枚护片；20秒内只等待本人下一次尚未结算的身体行动加35，没有立刻攻击，也不改旧结果。':'效果维持已付8灵性2精神一枚护片；20秒内只削减下一尚未结算身体或弧光冲击至多30，精神冲击不受影响。'; }
  }
  return closeAction(a,r,random);
}
function applyDirected(r: PrinceOfAbolitionRuntime,a: PrinceOfAbolitionActionEvidence): void {
  const w=r.body.directed; if (!w || a.attackKind!=='BODY' || a.selfGain<=0) return;
  a.selfGain+=35; a.windowsApplied.push({kind:'DIRECTED',amount:35,supportId:w.supportId}); gainMastery(r,a,DIRECTED); r.body.directedApplications++; r.body.directed=null;
  a.label+=' 先前仍有效的本人定向增幅此时才为这个未结算身体行动加35，窗口随即用尽。';
}
/** Production and validation share this finite ordered kernel, with no future draws. */
export function resolvePrinceOfAbolitionPlayerSlot(x: PrinceOfAbolitionCombatSource, r: PrinceOfAbolitionRuntime, id: PrinceOfAbolitionMoveId, order: number, random: ActionRandomStream): PrinceOfAbolitionActionEvidence {
  const a = baseAction(x, r, 'PLAYER', id, order, random), b = r.body;
  const pay = (s: number, m = 0) => { r.playerS -= s; r.playerM -= m; a.paidCost = s; a.mindCost = m; };
  const check = () => { a.check = resolveNormalCheck({ ability: 'knowledge', baseAbility: x.knowledge, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) }); a.succeeded = ['SUCCESS', 'GREAT_SUCCESS'].includes(a.check.tier); };
  if (id === DIRECTED || id === MAINTENANCE) return resolveNewWindow(x,r,id,a,random);
  if (x.policy==='ORDINARY' && id!=='ACCIDENT') { a.selectedAbility='ORDINARY_BODY_STRIKE'; if (id===AMPLIFICATION || id==='BODY_FOLLOWUP') { a.mode='BODY';a.attackKind='BODY';a.selfGain=(x.clubHeld?16:20)*a.physicalFactor;a.rawContribution=a.selfGain;a.threatens=true;a.travelMetres=4;r.root.playerTravelMetres+=4;a.label='本人普通近前2米打击并退回2米，不使用超凡能力。'; } else {a.mode='GUARD';a.enemyReduction=10*a.physicalFactor;a.label='本人普通格挡，0超凡费用。';} a.rawReduction=a.enemyReduction; return closeAction(a,r,random); }
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
    if (gift && r.playerS >= 3 && !r.pending.some(p => p.kind === 'GIFT_WEAKENING')) { pay(3); gift.location = 'GIVEN'; gift.destination = PRINCE_OF_ABOLITION_GIFT_GROUND; gift.givenWeek = x.week; a.giftId = gift.id;
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
  if (a.rawContribution === 0) a.rawContribution = a.selfGain; applyDirected(r,a); a.rawReduction = a.enemyReduction; syncPending(r); return closeAction(a, r, random);
}
export function resolvePrinceOfAbolitionEnemySlot(x: PrinceOfAbolitionCombatSource, r: PrinceOfAbolitionRuntime, planned: PrinceOfAbolitionEnemyIntent, order: number, random: ActionRandomStream): PrinceOfAbolitionActionEvidence {
  const a = baseAction(x, r, 'ENEMY', planned, order, random), b = r.body, p = PRINCE_OF_ABOLITION_POWERS.find(v => v.id === planned), charge = b.enemyCharges.find(c=>c.status==='HELD'), requiresCharge = planned==='ARC_BOLT' || planned==='MENTAL_PRESSURE', payable = !!p && b.enemySpirituality >= p.cost && (!requiresCharge || !!charge);
  if (planned === 'ACCIDENT') { a.mode = 'ACCIDENT'; a.selfGain = -22.5; a.label = '埃德蒙此次动作偏差，贡献−22.5。'; }
  else if (payable) {
    if (requiresCharge && charge) { charge.status='SPENT'; charge.usedRound=x.round; charge.usedOrder=order; a.enemyChargeId=charge.id; }
    a.mode = p.id; a.paidCost = p.cost; b.enemySpirituality -= p.cost; b.powerUses[p.id]++; a.selfGain = p.selfGain; a.enemyReduction = p.enemyReduction;
    if (p.id === 'ARC_BOLT') { a.attackKind = 'ARC'; a.threatens = true; a.label = '埃德蒙实际付5灵性和一枚自己的刻片发出有限弧光，对身体形成真实威胁。'; }
    else if (p.id === 'MENTAL_PRESSURE') { a.attackKind = 'MIND'; a.mentalPressure = true; a.label = '埃德蒙实际付5灵性和一枚自己的刻片向独立心智施加有限精神压力，只有精神后果。'; }
    else if (p.id === 'COMPOSE') { a.pendingCancelled=structuredClone(r.pending.filter(v=>v.kind==='ORDERED_DEVIATION')); r.pending = r.pending.filter(v => v.kind !== 'ORDERED_DEVIATION'); b.composureReady = true; if (b.maintenance) {a.windowsCancelled.push(structuredClone(b.maintenance));b.maintenance=null;} a.label = '埃德蒙付4灵性自主凝神，取消未用偏转与未用维持，抵抗本轮新偏转或维持；原已给木筹不退回。'; }
    else a.label = '埃德蒙付4灵性施展自己的有限屏护，保持独立防御。';
  } else { a.id = a.selectedAbility = 'BODY_STRIKE'; a.mode = 'BODY'; a.fallbackReason = p ? requiresCharge && !charge ? 'NO_HELD_CHARGE' : 'INSUFFICIENT_ENEMY_SPIRITUALITY' : null; a.attackKind = 'BODY'; a.threatens = true; a.selfGain = 20 * a.physicalFactor; a.travelMetres = 4; b.enemyTravelMetres += 4; a.label = '埃德蒙持自己的唯一手杖近前2米打击再退回2米，灵性或自己的有限刻片不足时只执行这一普通动作。'; }
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
  const w=b.maintenance;
  if (w && (a.attackKind==='BODY' || a.attackKind==='ARC') && a.selfGain>0) { const amount=Math.min(30,a.selfGain);a.selfGain-=amount;a.windowsApplied.push({kind:'MAINTENANCE',amount,supportId:w.supportId});gainMastery(r,a,MAINTENANCE);b.maintenanceApplications++;b.maintenance=null;a.label+=' 本人仍在维持的同一待用影响此时减去至多30身体冲击，随后结束；对手完整费用已支付。'; }
  a.threatens=(a.attackKind==='BODY'||a.attackKind==='ARC')&&a.selfGain>0;a.mentalPressure=a.attackKind==='MIND'&&a.selfGain>0;
  syncPending(r); return closeAction(a, r, random);
}
export interface PrinceOfAbolitionRoundOutcome extends PrinceOfAbolitionCombatBody {
  targetId: typeof PRINCE_OF_ABOLITION_TARGET_ID; round: number; source: PrinceOfAbolitionCombatSource; stance: SliceStance; continuing: boolean;
  playerHealthAfter: number; playerMindAfter: number; playerSpiritualityAfter: number; playerInjuriesAfter: SliceInjury[]; playerRiskAfter: number; giftsAfter: BriberGift[]; masteryAfter: Record<string, number>;
  siteAfter: PrinceOfAbolitionSite; operationAfter: EntropyDukeOperationState; elapsedSeconds: 0 | 60; expiredWindows: PrinceOfAbolitionWindow[]; cancelledWindows: PrinceOfAbolitionWindow[]; cancelledPending: PrinceOfAbolitionPendingEffect[]; randomCursorAfter: number; playerActions: PrinceOfAbolitionActionEvidence[]; enemyActions: PrinceOfAbolitionActionEvidence[]; expiredPending: PrinceOfAbolitionPendingEffect[];
}
export type PrinceOfAbolitionResolution = 'CONTINUE' | 'PLAYER_DEAD' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED' | 'RETREATED';
function penalty(n: number, max: number) { const f = n / max; return f > .75 ? 0 : f > .5 ? .05 : f > .25 ? .1 : .2; }
function base(core: number, h: number, m: number, s: number) { return (1250 + Math.min(core, 250)) * (1 - Math.min(.4, penalty(h, 100) + penalty(m, 100) + penalty(s, 120))); }
function weights(risk: number) { const death = Math.min(100, 5 + Math.min(risk, 10) * 10), shifted = death - 5; return { light: Math.max(0, 65 - shifted), heavy: Math.max(0, 30 - Math.max(0, shifted - 65)), death }; }
function validWindow(w: PrinceOfAbolitionWindow | null, kind: PrinceOfAbolitionWindow['kind'], b: PrinceOfAbolitionCombatBody, maxRound: number): boolean {
  return w===null || shape(w,['kind','round','order','castAt','expiresAt','remaining','supportId']) && w.kind===kind && integer(w.round,1,maxRound) && integer(w.order,0,11) && integer(w.castAt) && w.expiresAt===w.castAt+20 && w.remaining===1 && b.supportPieces.some(p=>p.id===w.supportId&&p.status==='SPENT'&&p.usedRound===w.round&&p.usedOrder===w.order);
}
function validPendingEffects(ps: PrinceOfAbolitionPendingEffect[]): boolean {
  return Array.isArray(ps) && ps.length<=2 && new Set(ps.map(p=>p.kind)).size===ps.length && ps.every(p=>shape(p,['id','owner','kind','createdAt','originalExpiresAt','expiresAt','extended','extensionApplied','remaining','exploited','factor','giftId']) && typeof p.id==='string' && !!p.id && p.owner==='PLAYER' && ['ORDERED_DEVIATION','GIFT_WEAKENING'].includes(p.kind) && integer(p.createdAt) && p.originalExpiresAt===p.createdAt+30 && typeof p.extended==='boolean' && p.expiresAt===p.originalExpiresAt+(p.extended?30:0) && typeof p.extensionApplied==='boolean' && (!p.extensionApplied||p.extended) && [1,2].includes(p.remaining) && typeof p.exploited==='boolean' && (p.remaining===1||p.exploited) && (p.kind==='ORDERED_DEVIATION'?p.factor===.5&&p.giftId===null&&!p.exploited&&p.remaining===1:typeof p.giftId==='string'&&Number.isFinite(p.factor)&&p.factor>=.22749&&p.factor<=.35));
}
export function validPrinceOfAbolitionBody(b: PrinceOfAbolitionCombatBody, _maxRound = Number.MAX_SAFE_INTEGER): boolean {
  const spent = b.enemyCharges?.filter(p => p.status === 'SPENT').length;
  return integer(b.enemyHealth, 0, 100) && integer(b.enemyMind, 0, 100) && integer(b.enemySpirituality, 0, 120) && integer(b.enemyRisk) && Array.isArray(b.enemyInjuries) &&
    ['RESISTING','SURRENDERED','DEAD'].includes(b.enemyStatus) && (b.enemyStatus === 'DEAD') === (b.enemyHealth === 0) && b.weaponLocation === (b.enemyStatus === 'DEAD' ? 'YARD' : 'HAND') &&
    shape(b.powerUses, PRINCE_OF_ABOLITION_POWER_IDS) && PRINCE_OF_ABOLITION_POWER_IDS.every(id => integer(b.powerUses[id])) && b.enemySpirituality === 120 - PRINCE_OF_ABOLITION_POWERS.reduce((n,p)=>n+p.cost*b.powerUses[p.id],0) &&
    validPrinceOfAbolitionSupportPieces(b.supportPieces) && validPrinceOfAbolitionEnemyCharges(b.enemyCharges) && spent === b.powerUses.ARC_BOLT + b.powerUses.MENTAL_PRESSURE &&
    b.supportPieces.filter(p => p.status === 'SPENT').length === b.directedAttempts + b.maintenanceAttempts && b.directedApplications <= b.directedAttempts && b.maintenanceApplications <= b.maintenanceAttempts &&
    validPendingEffects(b.pendingEffects) && b.pendingKind === (b.pendingEffects.some(p=>p.kind==='ORDERED_DEVIATION')?'ORDERED_DEVIATION':null) && b.composureReady === false && validWindow(b.directed,'DIRECTED',b,_maxRound) && validWindow(b.maintenance,'MAINTENANCE',b,_maxRound) &&
    [b.deviationAttempts,b.magnifyUses,b.exploitUses,b.amplificationAttempts,b.prolongationAttempts,b.directedAttempts,b.maintenanceAttempts,b.directedApplications,b.maintenanceApplications,b.enemyTravelMetres].every(n=>integer(n));
}
export function validPrinceOfAbolitionInjuries(injuries: SliceInjury[], revision: number): boolean {
  return Array.isArray(injuries) && new Set(injuries.map(i => i.id)).size === injuries.length && injuries.every(i => shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && !!i.id && ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision, 0, revision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision, revision)));
}
const SOURCE_KEYS = ['runId','revision','week','date','round','encounterId','targetId','attemptWeek','startHistoryIndex','targetName','targetAge','targetPathway','targetSequence','targetCore','targetWill','maxActionCount','actualBody','independentMind','enemyWeapon','weaponOwner','yardId','playerPosition','enemyPosition','enemyDistanceMetres','ordinaryExit','pursuit','thirdPartiesInArea','automaticAllyImmunity','freeSkillLibrary','playerHealth','playerMind','playerSpirituality','playerInjuries','playerRisk','physique','perception','will','knowledge','mastery','clubHeld','gifts','preparation','site','operation','originals','body','budget','finance','policy','randomSeed','randomCursor'];
export function validPrinceOfAbolitionCombatSource(x: PrinceOfAbolitionCombatSource): boolean { try {
  const p = x.site, prep = x.preparation, originals = x.originals;
  if (!shape(x,SOURCE_KEYS) || !shape(x.body,Object.keys(createPrinceOfAbolitionBody())) || !validatePrinceOfAbolitionPreparation(prep) || !same(prep.originals,originals) || !same(x.operation,prep.operation) || !same(x.finance,prep.finance) || !validatePrinceOfAbolitionCurrentSite(p,originals)) return false;
  const expected = princeOfAbolitionApproachedSite(prep.site, originals); expected.clockSeconds = p.clockSeconds; expected.playerTravelMetres = p.playerTravelMetres;
  if (x.body.pendingEffects.some(effect=>effect.createdAt>p.clockSeconds||effect.expiresAt<=p.clockSeconds||effect.kind==='GIFT_WEAKENING'&&!x.gifts.some(g=>g.id===effect.giftId&&g.location==='GIVEN'&&g.destination===PRINCE_OF_ABOLITION_GIFT_GROUND)) || [x.body.directed,x.body.maintenance].some(w=>w&&(w.castAt>p.clockSeconds||w.expiresAt<=p.clockSeconds))) return false;
  if (!same(p,expected) || p.clockSeconds !== prep.lifeClockSeconds + 4 + 60*(x.round-1) || p.playerTravelMetres < prep.site.playerTravelMetres+4) return false;
  if (!validPrinceOfAbolitionGifts(x.gifts,x.week) || !x.gifts.every((gift,i)=> { const old=originals.gifts[i]!; return old.location==='GIVEN' ? same(gift,old) : gift.location==='PLAYER' ? same(gift,old) : gift.destination===PRINCE_OF_ABOLITION_GIFT_GROUND && gift.givenWeek===x.week; })) return false;
  const expectedBudget = { ...prep.after, actions: prep.after.actions-2, health:x.playerHealth,mind:x.playerMind,spirituality:x.playerSpirituality,injuries:x.playerInjuries,injuryRisk:x.playerRisk,mastery:x.mastery,gifts:x.gifts };
  if (x.body.supportPieces.some(piece=>piece.usedRound!==null&&piece.usedRound>=x.round)||x.body.enemyCharges.some(charge=>charge.usedRound!==null&&charge.usedRound>=x.round)) return false;
  if (x.round===1 && (!same(x.body,{...createPrinceOfAbolitionBody(),supportPieces:createPrinceOfAbolitionSupportPieces()}) || !same(x.budget,{...prep.after,actions:prep.after.actions-2}) || x.randomCursor!==prep.randomCursor || p.playerTravelMetres!==prep.site.playerTravelMetres+4)) return false;
  return same(x.budget,expectedBudget) && same(x.budget.coreStats,{physique:x.physique,perception:x.perception,will:x.will,knowledge:x.knowledge}) &&
    typeof x.runId==='string' && !!x.runId && integer(x.revision) && integer(x.week,1) && integer(x.round,1) && integer(x.startHistoryIndex) && x.attemptWeek===x.week && x.week===prep.week && same(x.date,prep.date) &&
    x.encounterId==='PRINCE_OF_ABOLITION_DISPUTE' && x.targetId===PRINCE_OF_ABOLITION_TARGET_ID && x.targetName==='埃德蒙·维尔' && x.targetAge===44 && x.targetPathway==='independent-caster' && x.targetSequence===2 && x.targetCore===24 && x.targetWill===22 && x.maxActionCount===6 &&
    x.actualBody===true && x.independentMind===true && x.enemyWeapon==='PA1-EDMUND-ROD' && x.weaponOwner===PRINCE_OF_ABOLITION_TARGET_ID && x.yardId==='PA1-ADJACENT-YARD' && x.playerPosition==='YARD' && x.enemyPosition==='YARD' && x.enemyDistanceMetres===2 &&
    x.ordinaryExit==='OPEN' && x.pursuit===false && x.thirdPartiesInArea===0 && x.automaticAllyImmunity===false && x.freeSkillLibrary===false && [x.playerHealth,x.playerMind].every(n=>integer(n,1,100)) && integer(x.playerSpirituality,0,120) &&
    [x.physique,x.perception,x.will,x.knowledge].every(n=>integer(n,0,500)) && shape(x.mastery,MASTERY_IDS) && Object.values(x.mastery).every(n=>integer(n,0,500)) && typeof x.clubHeld==='boolean' && integer(x.playerRisk) && validPrinceOfAbolitionInjuries(x.playerInjuries,x.revision) && validPrinceOfAbolitionInjuries(x.body.enemyInjuries,x.revision) && validPrinceOfAbolitionBody(x.body,x.round-1) && x.body.enemyStatus==='RESISTING' && x.body.enemyMind>0 && PRINCE_OF_ABOLITION_POLICIES.includes(x.policy) &&
    typeof x.randomSeed==='string' && !!x.randomSeed && integer(x.randomCursor) && prep.runId===x.runId && prep.randomSeed===x.randomSeed && prep.randomCursor<=x.randomCursor && prep.revision<x.revision;
} catch { return false; } }
export function replayPrinceOfAbolitionCombatRound(x: PrinceOfAbolitionCombatSource, stance: SliceStance): { round: SliceCombatRound; outcome: PrinceOfAbolitionResolution } {
  if (!validPrinceOfAbolitionCombatSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new Error('缺少真实原来源。');
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = createPrinceOfAbolitionRuntime(x), b = r.body;
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = princeOfAbolitionActionCount(playerCountRoll), enemyCount = princeOfAbolitionEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: PrinceOfAbolitionActionEvidence[] = [], enemies: PrinceOfAbolitionActionEvidence[] = [], remaining = { PLAYER: playerCount, ENEMY: enemyCount }; let retreat: SliceCombatRound['retreat'] = 'NONE';
  if (stance==='RETREAT') { retreat='SUCCESS';remaining.PLAYER=0;remaining.ENEMY=0; }
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) for (const actor of order) {
    if (!remaining[actor]) continue;
    remaining[actor]--; const index = players.length + enemies.length;
    if (actor === 'PLAYER') players.push(resolvePrinceOfAbolitionPlayerSlot(x, r, drawPrinceOfAbolitionAbility(rng, null, stance, x.policy), index, rng)); else enemies.push(resolvePrinceOfAbolitionEnemySlot(x, r, drawPrinceOfAbolitionEnemyAbility(rng), index, rng));
  }
  const sum = (a: PrinceOfAbolitionActionEvidence[], key: 'selfGain' | 'enemyReduction') => a.reduce((n, v) => n + v[key], 0);
  const playerAdvantage = Math.max(125, base(x.physique * .35 + x.perception * .15 + x.will * .2 + x.knowledge * .3, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, base(x.targetCore, x.body.enemyHealth, x.body.enemyMind, x.body.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction'));
  const winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100, winner = retreat === 'SUCCESS' ? 'ENEMY' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  let playerHealth = x.playerHealth, playerRisk = x.playerRisk, outcome: PrinceOfAbolitionResolution = retreat === 'SUCCESS' ? 'RETREATED' : 'CONTINUE';
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
  const elapsedSeconds=stance==='RETREAT'?0:60; advancePrinceOfAbolitionCombatClock(r,x.site.clockSeconds+elapsedSeconds-r.root.clockSeconds);
  const expiredPending=structuredClone(r.expiredEffects), expiredWindows=structuredClone(r.expiredWindows), cancelledWindows:PrinceOfAbolitionWindow[]=[...players,...enemies].flatMap(a=>structuredClone(a.windowsCancelled)), cancelledPending:PrinceOfAbolitionPendingEffect[]=[...players,...enemies].flatMap(a=>structuredClone(a.pendingCancelled));
  if (outcome!=='CONTINUE') { cancelledPending.push(...structuredClone(r.pending));r.pending=[];for(const key of ['directed','maintenance'] as const){if(b[key])cancelledWindows.push(structuredClone(b[key]!));b[key]=null;} }
  syncPending(r);b.composureReady=false;if(b.enemyHealth===0)b.weaponLocation='YARD';
  const o: PrinceOfAbolitionRoundOutcome = { ...structuredClone(b), targetId: PRINCE_OF_ABOLITION_TARGET_ID, round: x.round, source: structuredClone(x), stance, continuing: outcome === 'CONTINUE',
    playerHealthAfter: playerHealth, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, playerInjuriesAfter: playerInjuries, playerRiskAfter: playerRisk, giftsAfter: structuredClone(r.gifts), masteryAfter: { ...r.mastery },
    siteAfter: structuredClone(r.root), operationAfter: structuredClone(x.operation), elapsedSeconds, expiredWindows, cancelledWindows, cancelledPending, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies, expiredPending };
  const round: SliceCombatRound = { round: x.round, stance, first, playerCount, enemyCount, playerCountRoll, enemyCountRoll,
    moves: [...players, ...enemies].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })),
    playerAdvantage, enemyAdvantage, winChance, winner, consequence: '', consequenceWeights, retreat, ...(consequenceDomain === undefined ? {} : { consequenceDomain }), ...(consequenceRoll === undefined ? {} : { consequenceRoll }),
    princeOfAbolitionOutcome: o };
  round.consequence = princeOfAbolitionCombatConsequence(round); return { round, outcome };
}
export function validatePrinceOfAbolitionRoundOutcome(v: unknown): v is PrinceOfAbolitionRoundOutcome { try { const o = v as PrinceOfAbolitionRoundOutcome; return !!o && same(o, replayPrinceOfAbolitionCombatRound(o.source, o.stance).round.princeOfAbolitionOutcome); } catch { return false; } }
export function validatePrinceOfAbolitionCombatRound(round: SliceCombatRound): boolean { try { const o = round.princeOfAbolitionOutcome; return !!o && same(round, replayPrinceOfAbolitionCombatRound(o.source, o.stance).round); } catch { return false; } }
export function nextPrinceOfAbolitionCombatSource(o: PrinceOfAbolitionRoundOutcome): PrinceOfAbolitionCombatSource {
  return { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter,
    playerSpirituality: Math.min(120, o.playerSpiritualityAfter + 12), playerInjuries: structuredClone(o.playerInjuriesAfter), playerRisk: o.playerRiskAfter,
    site: structuredClone(o.siteAfter), operation: structuredClone(o.operationAfter), budget:{...structuredClone(o.source.budget),health:o.playerHealthAfter,mind:o.playerMindAfter,spirituality:Math.min(120,o.playerSpiritualityAfter+12),injuries:structuredClone(o.playerInjuriesAfter),injuryRisk:o.playerRiskAfter,mastery:{...o.masteryAfter},gifts:structuredClone(o.giftsAfter)}, body: combatBody(o), gifts: structuredClone(o.giftsAfter), mastery: { ...o.masteryAfter }, randomCursor: o.randomCursorAfter };
}
export function princeOfAbolitionCombatConsequence(round: SliceCombatRound): string {
  const o = round.princeOfAbolitionOutcome!, who = round.winner === 'PLAYER' ? '埃德蒙' : '你'; let text = round.retreat === 'SUCCESS' ? '普通出口开放且没有追击，停止战斗并沿4米普通路离开。' : round.consequenceDomain === 'MENTAL' ? `${who}承受实际精神压力，精神减少10，没有新增身体伤口。` : round.consequenceDomain === 'BODY' ? `${who}承受实际身体打击或法术冲击，按共同伤势盘结算。` : '本轮下风没有实际攻击来源，不掷身体伤势盘。';
  if (o.playerHealthAfter === 0) text += '本人的原身体真实死亡，不能复活或离场。'; else if (o.enemyHealth === 0) text += '埃德蒙原身体真实死亡，唯一原杖留地。'; else if (o.enemyStatus === 'SURRENDERED') text += '埃德蒙因实际伤势或精神耗尽自主停止抵抗。';
  return text + ` 本轮实际${o.elapsedSeconds}秒；${o.continuing?'仍在原位置，仍有效的未用影响按原截止时间继续，过期即止':o.playerHealthAfter>0?'停止冲突，撤销未用影响，再沿普通路走4米4秒离场':'停止冲突并撤销未用影响；本人已死亡，仍留实际位置，不发生离场步行'}。已花灵性、精神与实物不退；原人物、旧投降与旧记录保持原样。`;
}
/** Player-facing whitelist. Preparation, source snapshots, finance and seed never escape here. */
export function projectPrinceOfAbolitionCombat(s: SliceState) {
  const e=s.princeOfAbolition.encounter, p=e.currentSite??s.princeOfAbolition.life.site, last=s.combat?.encounterId==='PRINCE_OF_ABOLITION_DISPUTE'?s.combat.lastRound?.princeOfAbolitionOutcome:e.terminal?s.combatHistory[e.terminal.historyIndex]?.princeOfAbolitionOutcome:null;
  return { enemyName:isPrinceOfAbolition(s)?'埃德蒙·维尔（44岁，序列2施术者）':'',targetId:e.targetId,enemyHealth:e.enemyHealth,enemyMind:e.enemyMind,enemySpirituality:e.enemySpirituality,
    weaponLocation:e.weaponLocation,pendingKind:e.pendingKind,composureReady:e.composureReady,powerUses:{...e.powerUses},maxActionCount:6,
    playerPosition:p.playerLocation,enemyPosition:e.enemyPosition,enemyDistanceMetres:p.playerLocation==='YARD'?2:6,exitMetres:p.playerLocation==='YARD'?4:0,clockSeconds:p.clockSeconds,playerTravelMetres:p.playerTravelMetres,enemyTravelMetres:e.enemyTravelMetres,
    giftsHeld:s.princeOfAbolition.gifts.filter(g=>g.location==='PLAYER').length,supportPieces:e.supportPieces.map(({id,status,wear})=>({id,status,wear})),enemyCharges:e.enemyCharges.map(({id,status})=>({id,status})),
    windows:[e.directed,e.maintenance].flatMap(w=>w?[{kind:w.kind,remainingSeconds:Math.max(0,w.expiresAt-p.clockSeconds),remaining:w.remaining}]:[]),
    lastActionSequence:last?[...last.playerActions,...last.enemyActions].sort((a,b)=>a.order-b.order).map(publicAction):[],
    countWheel:PRINCE_OF_ABOLITION_COUNT_WHEEL,enemyCountWheel:PRINCE_OF_ABOLITION_ENEMY_COUNT_WHEEL,enemyAbilityWheel:PRINCE_OF_ABOLITION_ENEMY_ABILITY_WHEEL,
    summary:'定向增幅8灵性2精神一枚护片，知识18后仅为20秒内本人下一身体行动加35；效果维持同费并受57%实际抵抗，20秒内下一身体或弧光冲击至多减30，精神无效。失败总耗4精神且护片不退。旧六项相对权重30/15/25/10/15/5，两项新能力各20；核心体35%感15%意20%知30%，继续下一轮恢复12灵性。旧赠物3灵性和真实原库存、放大4灵性、利用3灵性、偏转5灵性、行为增幅6灵性1精神及效果延长5灵性1精神均保留。双方每轮1至6动作，身体与精神后果分别结算；普通出口4米开放。' };
}
export type PrinceOfAbolitionCombatProjection=ReturnType<typeof projectPrinceOfAbolitionCombat>;

export type PrinceOfAbolitionPublicActionEvidence=Omit<PrinceOfAbolitionActionEvidence,'randomCursorBefore'|'randomCursorAfter'>;
export type PrinceOfAbolitionPublicRoundOutcome = Omit<PrinceOfAbolitionRoundOutcome, 'source' | 'randomCursorAfter' | 'playerActions' | 'enemyActions'> & {playerActions:PrinceOfAbolitionPublicActionEvidence[];enemyActions:PrinceOfAbolitionPublicActionEvidence[]};
const PUBLIC_ACTION_KEYS: readonly (keyof PrinceOfAbolitionPublicActionEvidence)[] = [
  'order','actor','id','planned','selectedAbility','fallbackReason','mode','label','selfGain','enemyReduction','threatens','mentalPressure','attackKind','rawContribution','rawReduction',
  'paidCost','mindCost','physicalFactor','check','succeeded','resisted','giftId','pendingBefore','pendingAfter','pendingApplied','masteryApplied','atSeconds','elapsedSeconds','travelMetres',
  'playerMindAfter','playerSpiritualityAfter','enemySpiritualityAfter','windowGranted','windowsApplied','windowsExpired','windowsCancelled','pendingCancelled','supportId','supportWearPaid','enemyChargeId','resistanceChance','resistanceRoll',
];
function publicAction(a: PrinceOfAbolitionActionEvidence): PrinceOfAbolitionPublicActionEvidence {
  return Object.fromEntries(PUBLIC_ACTION_KEYS.map(key=>[key,structuredClone(a[key])])) as unknown as PrinceOfAbolitionPublicActionEvidence;
}
/** Explicit known current physical fields. No combat preparation or private random source is copied. */
function publicSite(p: PrinceOfAbolitionSite): PrinceOfAbolitionSite {
  return {siteId:p.siteId,introducedWeek:p.introducedWeek,introducedDate:p.introducedDate?{...p.introducedDate}:null,activeCase:p.activeCase,
    playerLocation:p.playerLocation,playerTravelMetres:p.playerTravelMetres,guideTravelMetres:p.guideTravelMetres,clockSeconds:p.clockSeconds,
    guide:structuredClone(p.guide),volunteer:structuredClone(p.volunteer),parcel:structuredClone(p.parcel),ball:structuredClone(p.ball),paper:structuredClone(p.paper),pads:structuredClone(p.pads),cases:structuredClone(p.cases),reflected:p.reflected};
}
/** Internal replay evidence remains intact; public last/history rows get this positive whitelist only. */
export function projectPrinceOfAbolitionRoundOutcome(o: PrinceOfAbolitionRoundOutcome): PrinceOfAbolitionPublicRoundOutcome {
  return {...combatBody(o),targetId:o.targetId,round:o.round,stance:o.stance,continuing:o.continuing,
    playerHealthAfter:o.playerHealthAfter,playerMindAfter:o.playerMindAfter,playerSpiritualityAfter:o.playerSpiritualityAfter,
    playerInjuriesAfter:structuredClone(o.playerInjuriesAfter),playerRiskAfter:o.playerRiskAfter,giftsAfter:structuredClone(o.giftsAfter),masteryAfter:{...o.masteryAfter},
    siteAfter:publicSite(o.siteAfter),operationAfter:{door:o.operationAfter.door,inputActive:o.operationAfter.inputActive,flight:structuredClone(o.operationAfter.flight)},
    elapsedSeconds:o.elapsedSeconds,playerActions:o.playerActions.map(publicAction),enemyActions:o.enemyActions.map(publicAction),expiredPending:structuredClone(o.expiredPending),
    expiredWindows:structuredClone(o.expiredWindows),cancelledWindows:structuredClone(o.cancelledWindows),cancelledPending:structuredClone(o.cancelledPending)};
}
