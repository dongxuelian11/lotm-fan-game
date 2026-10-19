import { projectFateTrojanRoundOutcome, projectFateTrojanPowerUses, projectFateTrojanSite, projectFateTrojanWheel } from './public.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { FATE_TROJAN_TARGET_ID, FATE_TROJAN_POWER_IDS, FATE_TROJAN_POWERS, hasFateTrojanDisputeOpponent,
  type FateTrojanEnemyIntent, type FateTrojanPowerId } from './encounter.js';

/** Frozen bounded game implementation: no identity/name rewrite, remote object transfer or promised victory.
 * LINK and FATE allow one paid attempt each round. Both consume their actual costs even on a failed check.
 * LINK only pays out against the next actual BODY attack; FATE pays five actual health before its check,
 * and only pays out on the next actual STRIKE. DISCERN cancels one existing LINK; GUARD once per round
 * prepares one reduction against a later actual STRIKE. Unused windows expire with no refund/mastery. */
export const FATE_TROJAN_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const FATE_TROJAN_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const fateTrojanActionCount = pyromaniacActionCount;
export const fateTrojanEnemyActionCount = pyromaniacActionCount;
const LINK = 'error.s2.identity-link', FATE = 'error.s2.fate-assumption', DECEIT = 'error.s3.deep-deception';
export type FateTrojanMoveId = typeof LINK | typeof FATE | typeof DECEIT | 'STRIKE' | 'EVADE' | 'ACCIDENT';
const ABILITIES: readonly { id: FateTrojanMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: LINK, label: '身份联系偏移（8灵性/知识20，仅削弱随后一次身体攻击30）', weight: 25, stance: 'CONTROL' },
  { id: FATE, label: '命运承担（7灵性与5健康/意志20，仅加强随后一次普通打击85）', weight: 20, stance: 'PREPARE' },
  { id: DECEIT, label: '深层欺瞒（6灵性/知识18，减势30）', weight: 20, stance: 'CONTROL' },
  { id: 'STRIKE', label: '普通打击（持棍16或徒手12×身体状态）', weight: 15, stance: 'ATTACK' },
  { id: 'EVADE', label: '普通避让（0灵性，减势10）', weight: 15, stance: 'DEFEND' },
  { id: 'ACCIDENT', label: '判断失误（优势−22.5）', weight: 5, stance: null },
];
export const FATE_TROJAN_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'FORCE_STRIKE', label: '灵性冲击（5灵性，身体攻击优势75）', weight: 35 },
  { id: 'GUARD', label: '屏护（4灵性，一次削弱随后普通打击40）', weight: 25 },
  { id: 'BODY_STRIKE', label: '持棍打击（20×身体状态）', weight: 20 },
  { id: 'DISCERN', label: '辨识（3灵性，解除已存在的一次身份联系偏移）', weight: 15 },
  { id: 'ACCIDENT', label: '判断失误（优势−22.5）', weight: 5 },
];
export const isFateTrojan = (s: SliceState): boolean => s.progression.pathwayId === 'error' && s.progression.sequence === 2;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function fateTrojanAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 }));
}
function drawPlayer(random: ActionRandomStream, stance: SliceStance | null): FateTrojanMoveId {
  const weights = tickets(stance); let n = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return a.id; }
  throw new Error('命运木马行动盘无效。');
}
export function drawFateTrojanAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): FateTrojanMoveId { return drawPlayer(random, stance); }
export function drawFateTrojanEnemyAbility(random: ActionRandomStream): FateTrojanEnemyIntent {
  let n = random.nextInt(1, 100);
  for (const a of FATE_TROJAN_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as FateTrojanEnemyIntent; }
  throw new Error('当前对手的行动盘无效。');
}
export interface FateTrojanCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'FATE_TROJAN_DISPUTE'; targetId: typeof FATE_TROJAN_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetName: '伊莱亚斯'; targetAge: 46; targetSequence: 3; targetCore: 20;
  actualBody: true; independentMind: true; enemyWeapon: 'FT2-ELIAS-CLUB'; weaponLocation: 'HAND'; yardId: 'FT2-YARD';
  playerPosition: 'YARD'; enemyDistanceMetres: 2; ordinaryExit: 'OPEN'; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  playerInjuries: SliceInjury[]; enemyInjuries: SliceInjury[]; playerRisk: number; enemyRisk: number;
  clubHeld: boolean; physique: number; perception: number; knowledge: number; will: number;
  powerUses: Record<FateTrojanPowerId, number>; clockSeconds: number; randomSeed: string; randomCursor: number;
}
export interface FateTrojanCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: false }
interface ActionEvidence extends FateTrojanCombatEffect {
  order: number; atSeconds: number; elapsedSeconds: 5; paidCost: number; healthPaid: number; physicalFactor: number; rolls: number[];
  randomCursorBefore: number; randomCursorAfter: number; playerHealthAfter: number; playerSpiritualityAfter: number; enemySpiritualityAfter: number;
  chargeGranted: boolean; chargeConsumedByOrder: number | null; chargeCancelledByOrder: number | null; appliedAmount: number;
  consumedIdentityOrder: number | null; consumedFateOrder: number | null; consumedGuardOrder: number | null;
}
export interface FateTrojanPlayerAction extends ActionEvidence {
  id: FateTrojanMoveId; attempted: boolean; succeeded: boolean; applied: boolean; fallback: 'NONE' | 'STRIKE' | 'EVADE' | 'OBSERVE';
}
export interface FateTrojanEnemyAction extends ActionEvidence { planned: FateTrojanEnemyIntent; actual: FateTrojanEnemyIntent | 'OBSERVE'; attackKind: 'NONE' | 'BODY' }
interface Runtime {
  playerS: number; playerH: number; enemyS: number; powers: Record<FateTrojanPowerId, number>; clockSeconds: number;
  identityAttempted: boolean; fateAttempted: boolean; guardAttempted: boolean;
  identity: FateTrojanPlayerAction | null; fate: FateTrojanPlayerAction | null; guard: FateTrojanEnemyAction | null;
}
export interface FateTrojanRoundContext {
  source: FateTrojanCombatSource; stance: SliceStance; finished: boolean; liveState: string; runtime: Runtime;
  playerActions: FateTrojanPlayerAction[]; enemyActions: FateTrojanEnemyAction[]; label: string; outcome: FateTrojanRoundOutcome | null;
}
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]): boolean => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
const none = (label: string): FateTrojanCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
const physicalAt = (health: number): number => health > 75 ? 1 : health > 50 ? .95 : health > 25 ? .9 : .8;
export function currentFateTrojanCombatSource(s: SliceState): FateTrojanCombatSource | null {
  if (!hasFateTrojanDisputeOpponent(s)) return null;
  const e = s.fateTrojan.encounter, c = s.combat!, stats = s.character.coreStats;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'FATE_TROJAN_DISPUTE', targetId: FATE_TROJAN_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetName: '伊莱亚斯', targetAge: 46, targetSequence: 3, targetCore: 20,
    actualBody: true, independentMind: true, enemyWeapon: 'FT2-ELIAS-CLUB', weaponLocation: 'HAND', yardId: 'FT2-YARD', playerPosition: 'YARD',
    enemyDistanceMetres: 2, ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality,
    playerInjuries: structuredClone(s.injuries), enemyInjuries: structuredClone(c.enemyInjuries), playerRisk: s.injuryRisk, enemyRisk: c.enemyRisk,
    clubHeld: s.town.clubLocation === 'HAND', physique: stats.physique, perception: stats.perception, knowledge: stats.knowledge, will: stats.will,
    powerUses: { ...e.powerUses }, clockSeconds: s.fateTrojan.life.site.clockSeconds, randomSeed: s.random.seed, randomCursor: s.random.cursor };
}
function makeRuntime(x: FateTrojanCombatSource): Runtime {
  return { playerS: x.playerSpirituality, playerH: x.playerHealth, enemyS: x.enemySpirituality, powers: { ...x.powerUses }, clockSeconds: x.clockSeconds,
    identityAttempted: false, fateAttempted: false, guardAttempted: false, identity: null, fate: null, guard: null };
}
function liveState(s: SliceState): string {
  const e = s.fateTrojan.encounter;
  return stableStringify({ spirituality: s.spirituality, enemySpirituality: e.enemySpirituality, powerUses: e.powerUses, site: s.fateTrojan.life.site });
}
const dynamicSource = new Set(['playerHealth', 'playerSpirituality', 'enemySpirituality', 'powerUses', 'clockSeconds']);
function validRound(s: SliceState, r: FateTrojanRoundContext, supplied: FateTrojanCombatSource | null): boolean {
  const actual = currentFateTrojanCombatSource(s);
  return !r.finished && actual !== null && supplied !== null && same(supplied, r.source) && r.liveState === liveState(s) && actual.playerHealth === r.runtime.playerH &&
    Object.entries(r.source).every(([key, value]) => dynamicSource.has(key) || same(actual[key as keyof FateTrojanCombatSource], value));
}
export function beginFateTrojanCombatRound(s: SliceState, stance: SliceStance, random: ActionRandomStream): FateTrojanRoundContext {
  const source = currentFateTrojanCombatSource(s);
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance) || !source || !validSource(source) || random.seed !== source.randomSeed || random.cursor !== source.randomCursor)
    throw new Error('缺少当前庭院、真实对手或资源来源。');
  return { source, stance, finished: false, liveState: liveState(s), runtime: makeRuntime(source), playerActions: [], enemyActions: [], outcome: null, label: roundOpening(source) };
}
export const createFateTrojanCombatRound = beginFateTrojanCombatRound;
function actionBase(r: Runtime, order: number, physical: number, cursor: number): ActionEvidence {
  return { ...none(''), order, atSeconds: r.clockSeconds, elapsedSeconds: 5, paidCost: 0, healthPaid: 0, physicalFactor: physical, rolls: [],
    randomCursorBefore: cursor, randomCursorAfter: cursor, playerHealthAfter: r.playerH, playerSpiritualityAfter: r.playerS, enemySpiritualityAfter: r.enemyS,
    chargeGranted: false, chargeConsumedByOrder: null, chargeCancelledByOrder: null, appliedAmount: 0,
    consumedIdentityOrder: null, consumedFateOrder: null, consumedGuardOrder: null };
}
function closeAction<T extends ActionEvidence>(a: T, r: Runtime, random: ActionRandomStream): T {
  r.clockSeconds += 5; a.randomCursorAfter = random.cursor; a.playerHealthAfter = r.playerH; a.playerSpiritualityAfter = r.playerS; a.enemySpiritualityAfter = r.enemyS;
  a.label += ` 这次动作耗时5秒；你余${r.playerH}健康、${r.playerS}灵性，伊莱亚斯余${r.enemyS}灵性。`; return a;
}
function playerAction(x: FateTrojanCombatSource, r: Runtime, id: FateTrojanMoveId, physical: number, order: number, random: ActionRandomStream): FateTrojanPlayerAction {
  const a: FateTrojanPlayerAction = { ...actionBase(r, order, physical, random.cursor), id, attempted: false, succeeded: false, applied: false, fallback: 'NONE' };
  const evade = (why: string) => { a.fallback = 'EVADE'; a.enemyReduction = 10; a.label = why + '你普通避让，减势10，不消耗灵性。'; };
  if (id === 'ACCIDENT') { a.selfGain = -22.5; a.label = '你判断失误，优势−22.5。'; }
  else if (id === 'EVADE') { a.enemyReduction = 10; a.label = '你在庭院普通避让，减势10，不消耗灵性。'; }
  else if (id === 'STRIKE') {
    a.selfGain = (x.clubHeld ? 16 : 12) * physical; a.threatens = a.selfGain > 0;
    a.label = `你用${x.clubHeld ? '自己手中的棍' : '自己的身体'}普通打击，优势${a.selfGain}。`;
    if (r.fate && a.threatens) {
      const fate = r.fate; fate.applied = true; fate.appliedAmount = 85; fate.chargeConsumedByOrder = order;
      a.consumedFateOrder = fate.order; a.selfGain += 85; r.fate = null;
      fate.label += ` 随后在第${order + 1}次动作中实际加强你的普通打击85。`;
      a.label += '此前承担的健康代价在这次打击上换得85优势，仍不能保证击中或获胜。';
    }
    if (r.guard && a.threatens) {
      const guard = r.guard; guard.enemyReduction = 40; guard.appliedAmount = 40; guard.chargeConsumedByOrder = order;
      a.consumedGuardOrder = guard.order; r.guard = null; guard.label += ` 随后在第${order + 1}次动作中实际削弱普通打击40。`;
      a.label += '对手此前准备的屏护在此时消耗一次，实际减势40。';
    }
  } else if (id === LINK && r.identityAttempted || id === FATE && r.fateAttempted) { evade('本轮已经尝试过这项能力；'); }
  else {
    const cost = id === LINK ? 8 : id === FATE ? 7 : 6;
    if (r.playerS < cost || id === FATE && r.playerH <= 5) { evade(id === FATE && r.playerH <= 5 ? '健康不足以承担5点代价，未施法。' : `不足${cost}灵性，未施法。`); }
    else {
      r.playerS -= cost; a.paidCost = cost; a.attempted = true;
      if (id === LINK) r.identityAttempted = true;
      if (id === FATE) { r.fateAttempted = true; r.playerH -= 5; a.healthPaid = 5; }
      const ability = id === FATE ? 'will' : 'knowledge', difficulty = id === DECEIT ? 18 : 20, roll = random.nextInt(1, 100); a.rolls.push(roll);
      a.succeeded = roll <= computeCheckChance({ ability, baseAbility: x[ability], difficulty, modifiers: [] });
      a.label = `${id === LINK ? '身份联系偏移' : id === FATE ? '命运承担' : '深层欺瞒'}耗费${cost}灵性${id === FATE ? '和5健康' : ''}，${ability === 'will' ? '意志' : '知识'}检验${roll}${a.succeeded ? '成功' : '失败，费用已付'}。`;
      if (a.succeeded) {
        if (id === LINK) {
          a.chargeGranted = true; r.identity = a;
          a.label += '你只偏移伊莱亚斯此刻对你的瞄准联系；待他随后一次真正的身体攻击才减势30，目前减势为0。他仍保有自己的身份和判断，可以辨识解除。';
        } else if (id === FATE) {
          a.chargeGranted = true; r.fate = a;
          a.label += '你为本轮随后一次自己的普通打击准备85优势，目前增加为0。无论是否用上，已经付出的5健康均不返还。';
        } else { a.applied = true; a.enemyReduction = 30; a.appliedAmount = 30; a.label += '仅干扰本轮判断，减势30，没有直接伤害。'; }
      }
    }
  }
  return closeAction(a, r, random);
}
function enemyAction(x: FateTrojanCombatSource, r: Runtime, planned: FateTrojanEnemyIntent, physical: number, order: number, random: ActionRandomStream): FateTrojanEnemyAction {
  const a: FateTrojanEnemyAction = { ...actionBase(r, order, physical, random.cursor), planned, actual: planned, attackKind: 'NONE' };
  const power = FATE_TROJAN_POWERS.find(p => p.id === planned);
  if (planned === 'GUARD' && r.guardAttempted || planned === 'DISCERN' && !r.identity) a.actual = 'OBSERVE';
  else if (power && r.enemyS < power.cost) a.actual = 'BODY_STRIKE';
  if (a.actual === 'FORCE_STRIKE') {
    r.enemyS -= 5; r.powers.FORCE_STRIKE++; a.paidCost = 5; a.selfGain = 75; a.threatens = true; a.attackKind = 'BODY';
    a.label = '伊莱亚斯耗费5灵性，向你施放一次灵性冲击，身体攻击优势75。';
  } else if (a.actual === 'BODY_STRIKE') {
    a.selfGain = 20 * physical; a.threatens = a.selfGain > 0; a.attackKind = 'BODY';
    a.label = `${planned !== 'BODY_STRIKE' ? '灵性不足，未施法。' : ''}伊莱亚斯用自己实际持有的棍普通打击，优势${a.selfGain}，不消耗灵性。`;
  } else if (a.actual === 'GUARD') {
    r.enemyS -= 4; r.powers.GUARD++; r.guardAttempted = true; a.paidCost = 4; a.chargeGranted = true; r.guard = a;
    a.label = '伊莱亚斯耗费4灵性准备屏护，本轮只削弱随后一次实际普通打击40；目前减势为0。';
  } else if (a.actual === 'DISCERN') {
    const link = r.identity!; r.enemyS -= 3; r.powers.DISCERN++; a.paidCost = 3;
    link.chargeCancelledByOrder = order; a.consumedIdentityOrder = link.order; r.identity = null;
    link.label += ` 随后在第${order + 1}次动作中被伊莱亚斯识破，没有产生减势。`;
    a.label = '伊莱亚斯耗费3灵性，辨识并解除当前这一次身份联系偏移；没有攻击，也没有免疫以后其他效果。';
  } else if (a.actual === 'OBSERVE') { a.label = planned === 'GUARD' ? '伊莱亚斯本轮已经准备过屏护，这次只普通观察。' : '当前没有身份联系偏移可供解除，伊莱亚斯只普通观察，不消耗灵性。'; }
  else { a.selfGain = -22.5; a.label = '伊莱亚斯判断失误，优势−22.5。'; }
  if (a.attackKind === 'BODY' && a.threatens && r.identity) {
    const link = r.identity; link.applied = true; link.enemyReduction = 30; link.appliedAmount = 30; link.chargeConsumedByOrder = order;
    a.consumedIdentityOrder = link.order; r.identity = null;
    link.label += ` 随后在第${order + 1}次动作中实际削弱身体攻击30。`; a.label += '先前的瞄准联系偏移在此时消耗，实际减势30，仍可能造成身体伤势。';
  }
  return closeAction(a, r, random);
}
function commitRuntime(s: SliceState, r: FateTrojanRoundContext): void {
  s.health = r.runtime.playerH; s.spirituality = r.runtime.playerS; s.fateTrojan.encounter.enemySpirituality = r.runtime.enemyS;
  s.fateTrojan.encounter.powerUses = { ...r.runtime.powers }; s.fateTrojan.life.site.clockSeconds = r.runtime.clockSeconds; r.liveState = liveState(s);
}
export function resolveFateTrojanCombatAbility(s: SliceState, id: FateTrojanMoveId, physical: number, random: ActionRandomStream, r: FateTrojanRoundContext, source: FateTrojanCombatSource | null = r.source): FateTrojanCombatEffect {
  if (!validRound(s, r, source) || r.playerActions.length >= 6 || physical !== physicalAt(r.runtime.playerH) || random.seed !== r.source.randomSeed || !ABILITIES.some(a => a.id === id)) return none('当前人物、现场或资源不符，未执行动作。');
  const a = playerAction(r.source, r.runtime, id, physical, r.playerActions.length + r.enemyActions.length, random); r.playerActions.push(a); commitRuntime(s, r);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export function resolveFateTrojanEnemyAbility(s: SliceState, planned: FateTrojanEnemyIntent, physical: number, random: ActionRandomStream, r: FateTrojanRoundContext, source: FateTrojanCombatSource | null = r.source): FateTrojanCombatEffect {
  if (!validRound(s, r, source) || r.enemyActions.length >= 6 || physical !== physicalAt(r.source.enemyHealth) || random.seed !== r.source.randomSeed || ![...FATE_TROJAN_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned)) return none('对手、棍或当前资源不符，未执行动作。');
  const a = enemyAction(r.source, r.runtime, planned, physical, r.playerActions.length + r.enemyActions.length, random); r.enemyActions.push(a); commitRuntime(s, r);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export interface FateTrojanRoundOutcome {
  targetId: typeof FATE_TROJAN_TARGET_ID; round: number; source: FateTrojanCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number;
  playerInjuriesAfter: SliceInjury[]; enemyInjuriesAfter: SliceInjury[]; playerRiskAfter: number; enemyRiskAfter: number;
  powerUses: Record<FateTrojanPowerId, number>; identityAttempted: boolean; fateAttempted: boolean; guardAttempted: boolean;
  expiredIdentityOrder: number | null; expiredFateOrder: number | null; expiredGuardOrder: number | null;
  pendingIdentityAfter: false; pendingFateAfter: false; pendingGuardAfter: false; healthPaid: number;
  clockSecondsAfter: number; elapsedSeconds: 60; randomCursorAfter: number;
  playerActions: FateTrojanPlayerAction[]; enemyActions: FateTrojanEnemyAction[];
}
export function finishFateTrojanCombatRound(s: SliceState, r: FateTrojanRoundContext, continuing = true, randomCursorAfter = s.random.cursor): FateTrojanRoundOutcome {
  const e = s.fateTrojan.encounter, c = s.combat;
  if (r.finished || !c || c.encounterId !== 'FATE_TROJAN_DISPUTE' || c.round !== r.source.round || r.liveState !== liveState(s)) throw new Error('这个回合已结束，或现场资源发生了变化。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  if (e.enemyStatus !== 'RESISTING') e.weaponLocation = 'YARD';
  s.fateTrojan.life.site.clockSeconds = r.source.clockSeconds + 60; r.finished = true;
  r.outcome = { targetId: FATE_TROJAN_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus,
    playerSpiritualityBefore: r.source.playerSpirituality, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind, enemySpiritualityBefore: r.source.enemySpirituality,
    playerInjuriesAfter: structuredClone(s.injuries), enemyInjuriesAfter: structuredClone(c.enemyInjuries), playerRiskAfter: s.injuryRisk, enemyRiskAfter: c.enemyRisk,
    powerUses: { ...e.powerUses }, identityAttempted: r.runtime.identityAttempted, fateAttempted: r.runtime.fateAttempted, guardAttempted: r.runtime.guardAttempted,
    expiredIdentityOrder: r.runtime.identity?.order ?? null, expiredFateOrder: r.runtime.fate?.order ?? null, expiredGuardOrder: r.runtime.guard?.order ?? null,
    pendingIdentityAfter: false, pendingFateAfter: false, pendingGuardAfter: false, healthPaid: r.playerActions.reduce((n, a) => n + a.healthPaid, 0),
    clockSecondsAfter: s.fateTrojan.life.site.clockSeconds, elapsedSeconds: 60, randomCursorAfter,
    playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
  r.runtime.identity = null; r.runtime.fate = null; r.runtime.guard = null;
  return structuredClone(r.outcome);
}
export function fateTrojanRoundOutcome(r: FateTrojanRoundContext): FateTrojanRoundOutcome { if (!r.outcome) throw new Error('回合尚未结束。'); return structuredClone(r.outcome); }
export function projectFateTrojanCombat(s: SliceState) {
  const e = s.fateTrojan.encounter, visible = isFateTrojan(s);
  const last = s.combat?.encounterId === 'FATE_TROJAN_DISPUTE' ? s.combat.lastRound?.fateTrojanOutcome : e.terminal ? s.combatHistory[e.terminal.historyIndex]?.fateTrojanOutcome : null;
  const publicLast = visible && last ? projectFateTrojanRoundOutcome(last) : null;
  return { enemyName: visible ? '伊莱亚斯（46岁）' : '', targetId: visible ? e.targetId : null,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, maxSpirituality: 120,
    enemyHealth: visible ? e.enemyHealth : null, enemyMind: visible ? e.enemyMind : null, enemySpirituality: visible ? e.enemySpirituality : null,
    powerUses: visible ? projectFateTrojanPowerUses(e.powerUses) : null, site: visible ? projectFateTrojanSite(s.fateTrojan.life.site) : null,
    originalExit: true, pursuit: false, distanceMetres: 2, automaticAllyImmunity: false,
    lastActionSequence: publicLast ? [...publicLast.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...publicLast.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))].sort((a, b) => a.order - b.order) : [],
    countWheel: FATE_TROJAN_COUNT_WHEEL.map(projectFateTrojanWheel), enemyCountWheel: FATE_TROJAN_ENEMY_COUNT_WHEEL.map(projectFateTrojanWheel), enemyAbilityWheel: FATE_TROJAN_ENEMY_ABILITY_WHEEL.map(projectFateTrojanWheel),
    summary: visible ? '身份联系偏移每轮最多尝试一次，成功后只削弱伊莱亚斯随后一次实际身体攻击30；他能花3灵性辨识解除。命运承担每轮最多尝试一次，先实际支付7灵性和5健康，成功后只加强本轮随后一次自己的普通打击85，没用上也不退款。屏护每轮只准备一次，实际普通打击到来才减势40。每次动作5秒、每回合60秒；对手不恢复灵性，继续交战时你恢复12灵性。伤势和死亡仍按身体状况判断，战斗不增长掌握。' : '' };
}
const SOURCE_KEYS = ['runId', 'revision', 'week', 'round', 'encounterId', 'targetId', 'attemptWeek', 'startHistoryIndex', 'targetName', 'targetAge', 'targetSequence', 'targetCore', 'actualBody', 'independentMind', 'enemyWeapon', 'weaponLocation', 'yardId', 'playerPosition', 'enemyDistanceMetres', 'ordinaryExit', 'pursuit', 'thirdPartiesInArea', 'automaticAllyImmunity', 'playerHealth', 'playerMind', 'playerSpirituality', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'playerInjuries', 'enemyInjuries', 'playerRisk', 'enemyRisk', 'clubHeld', 'physique', 'perception', 'knowledge', 'will', 'powerUses', 'clockSeconds', 'randomSeed', 'randomCursor'] as const;
function validInjuries(v: SliceInjury[], revision: number): boolean {
  return Array.isArray(v) && new Set(v.map(i => i.id)).size === v.length && v.every(i => shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 && ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision, 1, revision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision, revision)));
}
function validSource(x: FateTrojanCombatSource): boolean {
  return shape(x, SOURCE_KEYS) && typeof x.runId === 'string' && x.runId.length > 0 && integer(x.revision) && integer(x.week, 1) && integer(x.round, 1) && integer(x.startHistoryIndex) && x.attemptWeek === x.week &&
    x.encounterId === 'FATE_TROJAN_DISPUTE' && x.targetId === FATE_TROJAN_TARGET_ID && x.targetName === '伊莱亚斯' && x.targetAge === 46 && x.targetSequence === 3 && x.targetCore === 20 && x.actualBody === true && x.independentMind === true &&
    x.enemyWeapon === 'FT2-ELIAS-CLUB' && x.weaponLocation === 'HAND' && x.yardId === 'FT2-YARD' && x.playerPosition === 'YARD' && x.enemyDistanceMetres === 2 && x.ordinaryExit === 'OPEN' && x.pursuit === false && x.thirdPartiesInArea === 0 && x.automaticAllyImmunity === false &&
    [x.playerHealth, x.playerMind, x.enemyHealth, x.enemyMind].every(n => integer(n, 1, 100)) && x.enemyMind === 100 && [x.playerSpirituality, x.enemySpirituality].every(n => integer(n, 0, 120)) &&
    [x.physique, x.perception, x.knowledge, x.will].every(n => integer(n, 0, 500)) && typeof x.clubHeld === 'boolean' && integer(x.playerRisk) && integer(x.enemyRisk) && integer(x.clockSeconds) &&
    validInjuries(x.playerInjuries, x.revision) && validInjuries(x.enemyInjuries, x.revision) && shape(x.powerUses, FATE_TROJAN_POWER_IDS) && FATE_TROJAN_POWER_IDS.every(id => integer(x.powerUses[id])) &&
    x.powerUses.GUARD <= x.round - 1 && x.powerUses.DISCERN <= x.round - 1 && x.powerUses.FORCE_STRIKE <= 6 * (x.round - 1) &&
    x.enemySpirituality === 120 - FATE_TROJAN_POWERS.reduce((n, p) => n + p.cost * x.powerUses[p.id], 0) && typeof x.randomSeed === 'string' && x.randomSeed.length > 0 && x.randomSeed.length <= 256 && integer(x.randomCursor);
}
function sourcePenalty(current: number, maximum: number): number { const f = Math.max(0, Math.min(1, current / maximum)); return f > .75 ? 0 : f > .5 ? .05 : f > .25 ? .1 : .2; }
function sourceBase(core: number, health: number, mind: number, spirituality: number): number { return (1250 + Math.min(core, 250)) * (1 - Math.min(.4, sourcePenalty(health, 100) + sourcePenalty(mind, 100) + sourcePenalty(spirituality, 120))); }
function sourceWeights(risk: number): { light: number; heavy: number; death: number } { const death = Math.min(100, 5 + Math.min(risk, 10) * 10), shifted = death - 5; return { light: Math.max(0, 65 - shifted), heavy: Math.max(0, 30 - Math.max(0, shifted - 65)), death }; }
interface ReplayedRound {
  outcome: FateTrojanRoundOutcome; playerCount: number; enemyCount: number; playerCountRoll: number; enemyCountRoll: number; first: 'PLAYER' | 'ENEMY';
  retreat: 'NONE' | 'SUCCESS' | 'FAILURE'; winner: 'PLAYER' | 'ENEMY'; playerAdvantage: number; enemyAdvantage: number; winChance: number;
  consequenceWeights: { light: number; heavy: number; death: number } | null; consequenceRoll?: number;
}
/** Deterministic full-round replay checks both draws, ordered costs, pending flags, cancelled windows,
 * real health payment, actual injury/death results and unmodified public labels. Extra fields fail equality. */
function replayOutcome(o: FateTrojanRoundOutcome): ReplayedRound | null {
  const x = o?.source;
  if (!x || !validSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) || !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) || o.playerActions.length > 6 || o.enemyActions.length > 6) return null;
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = makeRuntime(x);
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = fateTrojanActionCount(playerCountRoll), enemyCount = fateTrojanEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const, remaining = { PLAYER: playerCount, ENEMY: enemyCount };
  const players: FateTrojanPlayerAction[] = [], enemies: FateTrojanEnemyAction[] = []; let retreat: ReplayedRound['retreat'] = 'NONE';
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) {
    for (const actor of order) {
      if (remaining[actor] === 0) continue;
      if (actor === 'PLAYER' && o.stance === 'RETREAT') { remaining.PLAYER = 0; retreat = rng.nextInt(1, 100) <= 50 ? 'SUCCESS' : 'FAILURE'; if (retreat === 'SUCCESS') { remaining.ENEMY = 0; break; } continue; }
      remaining[actor]--;
      if (actor === 'PLAYER') players.push(playerAction(x, r, drawPlayer(rng, o.stance), physicalAt(r.playerH), players.length + enemies.length, rng));
      else enemies.push(enemyAction(x, r, drawFateTrojanEnemyAbility(rng), physicalAt(x.enemyHealth), players.length + enemies.length, rng));
    }
  }
  if (!same(players, o.playerActions) || !same(enemies, o.enemyActions)) return null;
  const sum = (actions: { selfGain: number; enemyReduction: number }[], key: 'selfGain' | 'enemyReduction') => actions.reduce((n, a) => n + a[key], 0);
  const playerAdvantage = Math.max(125, sourceBase(x.physique * .35 + x.perception * .25 + x.will * .25 + x.knowledge * .15, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, sourceBase(20, x.enemyHealth, x.enemyMind, x.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction')), winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100;
  const winner = retreat === 'SUCCESS' ? 'ENEMY' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  let playerHealth = r.playerH, enemyHealth = x.enemyHealth, playerRisk = x.playerRisk, enemyRisk = x.enemyRisk;
  let enemyStatus: FateTrojanRoundOutcome['enemyStatus'] = 'RESISTING', continuing = retreat !== 'SUCCESS';
  const playerInjuries = structuredClone(x.playerInjuries), enemyInjuries = structuredClone(x.enemyInjuries);
  let consequenceWeights: ReplayedRound['consequenceWeights'] = null, consequenceRoll: number | undefined;
  if (retreat !== 'SUCCESS') {
    const loser = winner === 'PLAYER' ? 'ENEMY' : 'PLAYER', injuries = loser === 'PLAYER' ? playerInjuries : enemyInjuries;
    let risk = loser === 'PLAYER' ? playerRisk : enemyRisk; if (injuries.length) risk++; if (loser === 'PLAYER') playerRisk = risk; else enemyRisk = risk;
    if (loser === 'PLAYER' ? enemies.some(a => a.threatens) : players.some(a => a.threatens)) {
      consequenceWeights = sourceWeights(risk); consequenceRoll = rng.nextInt(1, 100);
      const severity = consequenceRoll <= consequenceWeights.light ? 'LIGHT' : consequenceRoll <= consequenceWeights.light + consequenceWeights.heavy ? 'HEAVY' : 'DEATH';
      if (severity === 'DEATH') { if (loser === 'PLAYER') playerHealth = 0; else { enemyHealth = 0; enemyStatus = 'DEAD'; } continuing = false; }
      else {
        injuries.push({ id: `${x.runId}:combat:${x.round}:${loser}:${x.revision + 1}:${injuries.length}`, severity, acquiredRevision: x.revision + 1, treatedRevision: null });
        const damage = severity === 'LIGHT' ? 10 : 30; if (loser === 'PLAYER') playerHealth = Math.max(0, playerHealth - damage); else enemyHealth = Math.max(0, enemyHealth - damage);
        if (playerHealth === 0 || enemyHealth === 0) { if (enemyHealth === 0) enemyStatus = 'DEAD'; continuing = false; }
        else if (loser === 'ENEMY' && severity === 'HEAVY') { enemyStatus = 'SURRENDERED'; continuing = false; }
      }
    }
  }
  const expected: FateTrojanRoundOutcome = { targetId: FATE_TROJAN_TARGET_ID, round: x.round, source: structuredClone(x), stance: o.stance, continuing,
    enemyHealth, enemyMind: x.enemyMind, enemySpirituality: r.enemyS, enemyStatus,
    playerSpiritualityBefore: x.playerSpirituality, playerSpiritualityAfter: r.playerS, playerHealthAfter: playerHealth, playerMindAfter: x.playerMind, enemySpiritualityBefore: x.enemySpirituality,
    playerInjuriesAfter: playerInjuries, enemyInjuriesAfter: enemyInjuries, playerRiskAfter: playerRisk, enemyRiskAfter: enemyRisk, powerUses: r.powers,
    identityAttempted: r.identityAttempted, fateAttempted: r.fateAttempted, guardAttempted: r.guardAttempted,
    expiredIdentityOrder: r.identity?.order ?? null, expiredFateOrder: r.fate?.order ?? null, expiredGuardOrder: r.guard?.order ?? null,
    pendingIdentityAfter: false, pendingFateAfter: false, pendingGuardAfter: false, healthPaid: players.reduce((n, a) => n + a.healthPaid, 0),
    clockSecondsAfter: x.clockSeconds + 60, elapsedSeconds: 60, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies };
  if (!same(o, expected)) return null;
  return { outcome: expected, playerCount, enemyCount, playerCountRoll, enemyCountRoll, first, retreat, winner, playerAdvantage, enemyAdvantage, winChance, consequenceWeights, ...(consequenceRoll === undefined ? {} : { consequenceRoll }) };
}
export function validateFateTrojanRoundOutcome(value: unknown): value is FateTrojanRoundOutcome { try { return replayOutcome(value as FateTrojanRoundOutcome) !== null; } catch { return false; } }
export function validateFateTrojanCombatRound(round: SliceCombatRound): boolean {
  try {
    const o = round.fateTrojanOutcome, replay = o ? replayOutcome(o) : null;
    if (!o || !replay || round.round !== o.round || round.stance !== o.stance || round.consequenceDomain !== 'BODY' || round.consequence !== fateTrojanCombatConsequence(round) || !shape(round, ['round', 'stance', 'first', 'playerCount', 'enemyCount', 'playerCountRoll', 'enemyCountRoll', 'moves', 'playerAdvantage', 'enemyAdvantage', 'winChance', 'winner', 'consequence', 'consequenceWeights', 'retreat', 'consequenceDomain', 'fateTrojanOutcome', ...(replay.consequenceRoll === undefined ? [] : ['consequenceRoll'])])) return false;
    for (const key of ['playerCount', 'enemyCount', 'playerCountRoll', 'enemyCountRoll', 'first', 'retreat', 'winner', 'playerAdvantage', 'enemyAdvantage', 'winChance', 'consequenceWeights', 'consequenceRoll'] as const) if (!same(round[key], replay[key])) return false;
    const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
      .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
    return same(round.moves, moves);
  } catch { return false; }
}
function roundOpening(x: FateTrojanCombatSource): string {
  return `46岁的伊莱亚斯持自己的棍站在庭院2米外，健康${x.enemyHealth}、精神${x.enemyMind}、灵性${x.enemySpirituality}。莉娜与维克托已亲自退到院外，柜子、包裹和身份联系保持此前状态。`;
}
export function fateTrojanCombatConsequence(round: SliceCombatRound): string {
  const o = round.fateTrojanOutcome; if (!o) throw new Error('缺少命运木马回合结果。'); let text: string;
  if (round.retreat === 'SUCCESS') text = '你通过撤离判定，停止交战，沿普通出口离开庭院。伊莱亚斯仍留在原处。';
  else {
    const loser = round.winner === 'PLAYER' ? 'ENEMY' : 'PLAYER', subject = loser === 'PLAYER' ? '你' : '伊莱亚斯', risk = loser === 'PLAYER' ? o.playerRiskAfter : o.enemyRiskAfter;
    if (round.consequenceRoll === undefined) text = `${subject}本回合处于下风，但没有遭受实际致伤攻击，因此没有新增身体伤势。累计风险${risk}。`;
    else {
      const weights = round.consequenceWeights!, severity = round.consequenceRoll <= weights.light ? 'LIGHT' : round.consequenceRoll <= weights.light + weights.heavy ? 'HEAVY' : 'DEATH';
      if (severity === 'DEATH') text = `${subject}伤势检验${round.consequenceRoll}/100，伤势致命，身体留在庭院的实际位置。`;
      else { text = `${subject}伤势检验${round.consequenceRoll}/100，受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康减少${severity === 'LIGHT' ? 10 : 30}。`;
        if (o.playerHealthAfter === 0 || o.enemyHealth === 0) text += '健康已降至0，伤者死亡。'; else if (o.enemyStatus === 'SURRENDERED') text += '伊莱亚斯因重伤停止抵抗，将自己的棍放在脚边。'; }
    }
  }
  const link = o.playerActions.filter(a => a.id === LINK).reduce((n, a) => n + a.appliedAmount, 0), fate = o.playerActions.filter(a => a.id === FATE).reduce((n, a) => n + a.appliedAmount, 0), guard = o.enemyActions.reduce((n, a) => n + a.appliedAmount, 0);
  return roundOpening(o.source) + text + ` 本轮身份联系偏移实际减势${link}，命运承担实际加强打击${fate}、已付健康${o.healthPaid}，对手屏护实际减势${guard}。未使用的准备随回合结束失效，已付健康与灵性不退款。`;
}
