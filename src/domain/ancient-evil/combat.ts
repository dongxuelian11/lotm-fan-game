import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import type { MadmanBurstPolicy, MadmanRoundPolicy } from '../madman/combat.js';
import type { SilentDiscipleLifeState } from '../silent-disciple/life.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import { ANCIENT_EVIL_TARGET_ID, ANCIENT_EVIL_BLOCK_IDS, ANCIENT_EVIL_POWERS, ANCIENT_EVIL_POWER_IDS, hasAncientEvilDisputeOpponent,
  type AncientEvilBlock, type AncientEvilCombatBody, type AncientEvilEnemyIntent, type AncientEvilPreparation, validateAncientEvilPreparation, combatBody } from './encounter.js';

/** All bounded numeric adaptations and this original adult opponent are game-original, not canon facts. */
export const ANCIENT_EVIL_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const ANCIENT_EVIL_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const ancientEvilActionCount = pyromaniacActionCount;
export const ancientEvilEnemyActionCount = pyromaniacActionCount;
const H = 'chained.s4.object-motion', J = 'BODY_FOLLOWUP', B = 'GHOST_DODGE', K = 'chained.s2.enduring-transfiguration';
export type AncientEvilMoveId = typeof H | typeof J | typeof B | typeof K | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly { id: AncientEvilMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: H, label: '原木块物动：3灵性；没有原块则普通身体攻击', weight: 30, stance: 'ATTACK' },
  { id: J, label: '继承身体次击，按旧掌握与当前身体计算', weight: 15, stance: 'ATTACK' },
  { id: B, label: '本槽灵化避让：2灵性；不足则普通格挡', weight: 20, stance: 'DEFEND' },
  { id: K, label: '实际接触4灵性1精神后，持续变形6灵性2精神；对方可以抵抗', weight: 20, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '观察同一身体、原杖及普通出口', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差，优势减少22.5', weight: 5, stance: null },
];
export const ANCIENT_EVIL_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'DREAM_SPIKE', label: '精神梦刺：6灵性；兔形仍保有心智能力', weight: 35 },
  { id: 'DREAM_WARD', label: '手势梦障：4灵性；兔形不能做原手势', weight: 25 },
  { id: 'BODY_STRIKE', label: '原杖身体攻击；兔形只能普通无武器行动', weight: 25 },
  { id: 'RESIST_FORM', label: '精神抵抗原形态：6灵性，成功率57%', weight: 10 },
  { id: 'ACCIDENT', label: '实际失衡，无贡献和消耗', weight: 5 },
];
export const isAncientEvil = (s: SliceState): boolean => s.progression.pathwayId === 'chained' && s.progression.sequence === 2;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function ancientEvilAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((n, v) => n + v, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, weight: weights[i]! / total * 100,
    label: a.id === H && s.town.clubLocation === 'HAND' ? '持握自己的原短棍普通挥击，不使用木块' : a.label }));
}
export function drawAncientEvilAbility(random: ActionRandomStream, _s: SliceState | null, stance: SliceStance | null): AncientEvilMoveId {
  const weights = tickets(stance); let n = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return a.id; } throw new Error('能力盘无效。');
}
export function drawAncientEvilEnemyAbility(random: ActionRandomStream): AncientEvilEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of ANCIENT_EVIL_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as AncientEvilEnemyIntent; } throw new Error('对手行动盘无效。');
}
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]): boolean => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
const physicalAt = (n: number): number => n > 75 ? 1 : n > 50 ? .95 : n > 25 ? .9 : .8;
const masteryFactor = (n: number) => .65 + .35 * n / 500;
export interface AncientEvilCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'ANCIENT_EVIL_DISPUTE'; targetId: typeof ANCIENT_EVIL_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetName: '莱娜'; targetAge: 45; targetPathway: 'audience'; targetSequence: 3; targetCore: 22; targetWill: 22;
  actualBody: true; independentMind: true; enemyWeapon: 'AE2-LENA-STAFF'; yardId: 'SD3-QUIET-ROOM'; enemyPosition: 'BETWEEN_A_AND_B'; enemyDistanceMetres: 2;
  ordinaryExit: 'OPEN'; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; playerInjuries: SliceInjury[]; playerRisk: number;
  physique: number; perception: number; will: number; knowledge: number; objectMastery: number; bodyMastery: number; burstMastery: number; clubHeld: boolean;
  preparation: AncientEvilPreparation; root: SilentDiscipleLifeState; body: AncientEvilCombatBody; randomSeed: string; randomCursor: number;
}
export function currentAncientEvilCombatSource(s: SliceState): AncientEvilCombatSource | null {
  if (!hasAncientEvilDisputeOpponent(s)) return null;
  const e = s.ancientEvil.encounter, c = s.combat!, stats = s.character.coreStats;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'ANCIENT_EVIL_DISPUTE', targetId: ANCIENT_EVIL_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetName: '莱娜', targetAge: 45, targetPathway: 'audience', targetSequence: 3, targetCore: 22, targetWill: 22,
    actualBody: true, independentMind: true, enemyWeapon: 'AE2-LENA-STAFF', yardId: 'SD3-QUIET-ROOM', enemyPosition: 'BETWEEN_A_AND_B', enemyDistanceMetres: 2,
    ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false, playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality,
    playerInjuries: structuredClone(s.injuries), playerRisk: s.injuryRisk, ...stats, objectMastery: s.progression.mastery[H] ?? 0,
    bodyMastery: s.progression.mastery['chained.s6.steel-body'] ?? 0, burstMastery: s.progression.mastery['chained.s8.reason-sacrifice'] ?? 0, clubHeld: s.town.clubLocation === 'HAND',
    preparation: structuredClone(e.preparation!), root: structuredClone(s.silentDisciple.life), body: combatBody(e), randomSeed: s.random.seed, randomCursor: s.random.cursor };
}
export interface AncientEvilActionEvidence {
  order: number; actor: 'PLAYER' | 'ENEMY'; id: string; planned: string; mode: string; label: string; selfGain: number; enemyReduction: number;
  threatens: boolean; mentalPressure: boolean; attackKind: 'NONE' | 'BODY' | 'MIND'; paidCost: number; mindCost: number; physicalFactor: number;
  rolls: number[]; checkChance: number | null; resistanceChance: number | null; succeeded: boolean; resisted: boolean;
  atSeconds: number; elapsedSeconds: 5; travelMetres: number; blockId: AncientEvilBlock['id'] | null;
  enemyFormBefore: 'HUMAN' | 'RABBIT'; enemyFormAfter: 'HUMAN' | 'RABBIT'; weaponBefore: 'HAND' | 'COURT'; weaponAfter: 'HAND' | 'COURT';
  randomCursorBefore: number; randomCursorAfter: number; playerMindAfter: number; playerSpiritualityAfter: number; enemySpiritualityAfter: number;
}
export interface AncientEvilRuntime {
  body: AncientEvilCombatBody; root: SilentDiscipleLifeState; playerS: number; playerM: number; madman: MadmanRoundPolicy;
}
export function createAncientEvilRuntime(x: AncientEvilCombatSource, policy: MadmanBurstPolicy = 'HOLD'): AncientEvilRuntime {
  return { body: structuredClone(x.body), root: structuredClone(x.root), playerS: x.playerSpirituality, playerM: x.playerMind,
    madman: { policy, triggered: false, mentalCost: 0, spiritualCost: 0 } };
}
/** Elapsed real seconds alone expire a form; ending input or changing rounds never does. */
export function advanceAncientEvilCombatClock(r: AncientEvilRuntime, seconds: number): void {
  if (!integer(seconds)) throw new Error('实际经过的秒数无效。'); r.root.clockSeconds += seconds;
  if (r.body.enemyFormUntilSeconds !== null && r.root.clockSeconds >= r.body.enemyFormUntilSeconds) { r.body.enemyForm = 'HUMAN'; r.body.enemyFormUntilSeconds = null; }
  if (r.body.formUntilSeconds !== null && r.root.clockSeconds >= r.body.formUntilSeconds) { r.body.form = 'HUMAN'; r.body.formUntilSeconds = null; }
}
function baseAction(x: AncientEvilCombatSource, r: AncientEvilRuntime, actor: 'PLAYER' | 'ENEMY', id: string, order: number, random: ActionRandomStream): AncientEvilActionEvidence {
  return { actor, id, planned: id, order, mode: 'OBSERVE', label: '', selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false, attackKind: 'NONE', paidCost: 0, mindCost: 0,
    physicalFactor: physicalAt(actor === 'PLAYER' ? x.playerHealth : x.body.enemyHealth), rolls: [], checkChance: null, resistanceChance: null, succeeded: false, resisted: false,
    atSeconds: r.root.clockSeconds, elapsedSeconds: 5, travelMetres: 0, blockId: null, enemyFormBefore: r.body.enemyForm, enemyFormAfter: r.body.enemyForm,
    weaponBefore: r.body.weaponLocation, weaponAfter: r.body.weaponLocation, randomCursorBefore: random.cursor, randomCursorAfter: random.cursor,
    playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, enemySpiritualityAfter: r.body.enemySpirituality };
}
function closeAction(a: AncientEvilActionEvidence, r: AncientEvilRuntime, random: ActionRandomStream): AncientEvilActionEvidence {
  advanceAncientEvilCombatClock(r, 5); a.enemyFormAfter = r.body.enemyForm; a.weaponAfter = r.body.weaponLocation; a.randomCursorAfter = random.cursor;
  a.playerMindAfter = r.playerM; a.playerSpiritualityAfter = r.playerS; a.enemySpiritualityAfter = r.body.enemySpirituality;
  a.label += ` 本动作5秒；你余${r.playerS}灵性、${r.playerM}精神，莱娜余${r.body.enemySpirituality}灵性。`; return a;
}
/** Shared finite slot kernel, also used by declared directed unit cases. No state or seed is invented. */
export function resolveAncientEvilPlayerSlot(x: AncientEvilCombatSource, r: AncientEvilRuntime, id: AncientEvilMoveId, order: number, random: ActionRandomStream, curse = false): AncientEvilActionEvidence {
  const a = baseAction(x, r, 'PLAYER', id, order, random), b = r.body;
  const check = (difficulty: number) => { a.checkChance = computeCheckChance({ ability: 'knowledge', baseAbility: x.knowledge, difficulty, modifiers: [] }); const n = random.nextInt(1, 100); a.rolls.push(n); return n <= a.checkChance; };
  const pay = (s: number, m = 0) => { a.paidCost = s; a.mindCost = m; r.playerS -= s; r.playerM -= m; };
  const body = (gain: number, label: string) => {
    a.mode = 'BODY'; a.attackKind = 'BODY'; a.selfGain = gain; a.threatens = gain > 0; a.travelMetres = 4; r.root.playerTravelMetres += 4; a.label = label + '；本人实际近前2米再退回2米。';
    if (gain > 0 && r.madman.policy === 'BURST_FIRST' && !r.madman.triggered && r.playerM >= 10 && r.playerS >= 2) {
      pay(2, 10); r.madman = { policy: r.madman.policy, triggered: true, mentalCost: 10, spiritualCost: 2 }; a.selfGain *= 1 + .25 * masteryFactor(x.burstMastery); a.label += '主动首次旧疯子爆发另实付2灵性10精神。';
    }
  };
  if (id === 'ACCIDENT') { a.mode = 'ACCIDENT'; a.selfGain = -22.5; a.label = '实际动作偏差，优势减少22.5。'; }
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
      else { pay(4, 1); a.mode = 'CONTACT'; b.contactAttempts++; b.contactDistanceMetres += 4; a.travelMetres = 4; r.root.playerTravelMetres += 4;
        a.succeeded = check(18); if (a.succeeded) { b.link = 'LINKED'; b.linkRound = x.round; }
        a.label = `本人实际近前2米接触同一莱娜，再退回2米；${a.succeeded ? '建立有限联系' : '联系未成，费用保留'}。`; }
    } else if (b.lastFormRound === x.round || (curse && b.form === 'WOOD') || (!curse && b.enemyForm === 'RABBIT')) a.label = '本轮已尝试或原目标形态仍在；停止输入不会复原，也不重复收费或续期。';
    else if (r.playerS < (curse ? 4 : 6) || r.playerM < (curse ? 0 : 2)) a.label = '真实资源不足，普通观察，不施术或补充灵性。';
    else {
      pay(curse ? 4 : 6, curse ? 0 : 2); b.formAttempts++; b.lastFormRound = x.round; a.mode = curse ? 'SELF_FORM' : 'TARGET_FORM'; a.succeeded = check(curse ? 18 : 20);
      if (curse) { if (a.succeeded) { b.form = 'WOOD'; b.formUntilSeconds = r.root.clockSeconds + 60; } a.label = `主动选择旧本人诅咒源；${a.succeeded ? '自己的原身体暂为木偶' : '检定失败'}，只有本人真实受伤才可能有限映射，绝不免伤。`; }
      else {
        b.transfigurationAttempts++;
        if (a.succeeded) { a.resistanceChance = Math.max(25, Math.min(95, x.targetWill + 35)); const resistance = random.nextInt(1, 100); a.rolls.push(resistance); a.resisted = resistance <= a.resistanceChance; a.succeeded = !a.resisted; }
        if (a.succeeded) { b.transfigurationSuccesses++; b.enemyForm = 'RABBIT'; b.enemyFormUntilSeconds = r.root.clockSeconds + 90; b.weaponLocation = 'COURT'; }
        a.label = `${a.succeeded ? '同一莱娜身体变为兔形，原杖实际落地；形态持续真实90秒，跨回合保留' : a.resisted ? '莱娜以自己的意志抵抗，变形未成' : '知识检定失败，变形未成'}；健康、精神、灵性和原伤不因形态变化重置，费用照付。`;
      }
    }
  } else a.label = `普通观察莱娜的${b.enemyForm === 'RABBIT' ? '兔形' : '人形'}、原杖位置及普通出口。`;
  return closeAction(a, r, random);
}
export function resolveAncientEvilEnemySlot(x: AncientEvilCombatSource, r: AncientEvilRuntime, planned: AncientEvilEnemyIntent, order: number, random: ActionRandomStream): AncientEvilActionEvidence {
  const a = baseAction(x, r, 'ENEMY', planned, order, random), b = r.body;
  if (b.enemyForm === 'HUMAN' && b.weaponLocation === 'COURT') { a.id = 'PICKUP'; a.mode = 'PICKUP'; b.weaponLocation = 'HAND'; b.pickUpUses++; a.label = '莱娜亲自拾起落地的唯一原杖，本次行动只拾取，没有同时攻击或施术。'; }
  else if (planned === 'RESIST_FORM' && b.enemyForm === 'HUMAN' && b.link === 'NONE') { a.id = 'OBSERVE'; a.label = '莱娜没有当前形态或联系可挣脱，普通观察，不虚构抵抗效果或收费。'; }
  else if (planned === 'ACCIDENT') { a.mode = 'ACCIDENT'; a.label = '莱娜实际失衡，没有贡献或费用。'; }
  else {
    const p = ANCIENT_EVIL_POWERS.find(v => v.id === planned), gestureBlocked = planned === 'DREAM_WARD' && b.enemyForm === 'RABBIT';
    if (p && !gestureBlocked && b.enemySpirituality >= p.cost) {
      a.paidCost = p.cost; b.enemySpirituality -= p.cost; b.powerUses[p.id]++; a.mode = p.id; a.succeeded = true;
      a.selfGain = p.selfGain; a.enemyReduction = p.enemyReduction;
      if (planned === 'DREAM_SPIKE') { a.attackKind = 'MIND'; a.mentalPressure = true; a.label = '莱娜以保留的心智施放精神梦刺；兔形不封死心智能力，精神压力不冒充身体伤口。'; }
      else if (planned === 'RESIST_FORM') {
        a.resistanceChance = Math.max(25, Math.min(95, x.targetWill + 35)); const roll = random.nextInt(1, 100); a.rolls.push(roll); a.succeeded = roll <= a.resistanceChance; b.breakLinkUses++;
        if (a.succeeded) { b.enemyForm = 'HUMAN'; b.enemyFormUntilSeconds = null; b.link = 'NONE'; }
        a.label = `莱娜实际付6灵性进行精神抵抗，${a.succeeded ? '挣脱当前变形与联系，原杖仍留原地' : '抵抗失败，形态与联系保留，费用不退'}。`;
      } else a.label = '莱娜实付4灵性，以原有手势施展有限梦障。';
    } else {
      a.id = 'BODY_STRIKE'; a.mode = 'BODY'; a.attackKind = 'BODY'; a.selfGain = (b.enemyForm === 'HUMAN' && b.weaponLocation === 'HAND' ? 20 : 10) * a.physicalFactor; a.threatens = a.selfGain > 0; a.travelMetres = 4;
      a.label = `${gestureBlocked ? '兔形不能做原手势' : p ? '实际灵性不足' : '莱娜选择普通身体行动'}，改以${b.enemyForm === 'HUMAN' && b.weaponLocation === 'HAND' ? '自己的原杖' : '同一无武器身体'}攻击；实际近前2米再退回2米，不凭空装备或补灵性。`;
    }
  }
  return closeAction(a, r, random);
}
export interface AncientEvilRoundOutcome extends AncientEvilCombatBody {
  targetId: typeof ANCIENT_EVIL_TARGET_ID; round: number; source: AncientEvilCombatSource; stance: SliceStance; continuing: boolean; cursePolicy: boolean; madmanBurst: MadmanRoundPolicy;
  playerHealthAfter: number; playerMindAfter: number; playerSpiritualityAfter: number; playerInjuriesAfter: SliceInjury[]; playerRiskAfter: number;
  rootAfter: SilentDiscipleLifeState; elapsedSeconds: 60; randomCursorAfter: number; playerActions: AncientEvilActionEvidence[]; enemyActions: AncientEvilActionEvidence[];
}
export type AncientEvilResolution = 'CONTINUE' | 'PLAYER_DEAD' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED' | 'RETREATED';
function penalty(n: number, max: number) { const f = n / max; return f > .75 ? 0 : f > .5 ? .05 : f > .25 ? .1 : .2; }
function base(core: number, h: number, m: number, s: number) { return (1250 + Math.min(core, 250)) * (1 - Math.min(.4, penalty(h, 100) + penalty(m, 100) + penalty(s, 120))); }
function weights(risk: number) { const death = Math.min(100, 5 + Math.min(risk, 10) * 10), shifted = death - 5; return { light: Math.max(0, 65 - shifted), heavy: Math.max(0, 30 - Math.max(0, shifted - 65)), death }; }
export function validAncientEvilBody(b: AncientEvilCombatBody, clock: number, maxRound = Number.MAX_SAFE_INTEGER): boolean {
  return integer(b.enemyHealth, 0, 100) && b.enemyMind === 100 && integer(b.enemySpirituality, 0, 120) && integer(b.enemyRisk) && Array.isArray(b.enemyInjuries) &&
    ['RESISTING', 'SURRENDERED', 'DEAD'].includes(b.enemyStatus) && (b.enemyStatus === 'DEAD') === (b.enemyHealth === 0) && ['HAND', 'COURT'].includes(b.weaponLocation) &&
    ['HUMAN', 'RABBIT'].includes(b.enemyForm) && (b.enemyForm === 'RABBIT' ? integer(b.enemyFormUntilSeconds, clock + 1, clock + 90) && b.weaponLocation === 'COURT' : b.enemyFormUntilSeconds === null) &&
    ['HUMAN', 'WOOD'].includes(b.form) && (b.form === 'WOOD' ? integer(b.formUntilSeconds, clock + 1, clock + 60) : b.formUntilSeconds === null) &&
    b.emotion === 'ANGRY' && typeof b.blocksPurchased === 'boolean' && Array.isArray(b.blocks) && b.blocks.length === (b.blocksPurchased ? 3 : 0) && b.blocks.every((v, i) =>
      shape(v, ['id', 'owner', 'status', 'location', 'usedRound']) && v.id === ANCIENT_EVIL_BLOCK_IDS[i] && v.owner === 'PLAYER' && (v.status === 'READY' ? v.location === 'SOURCE' && v.usedRound === null : v.status === 'SPENT' && v.location === 'TARGET_GROUND' && integer(v.usedRound, 1, maxRound))) &&
    ['NONE', 'LINKED'].includes(b.link) && (b.linkRound === null ? b.link === 'NONE' : integer(b.linkRound, 1, maxRound)) && (b.lastFormRound === null ? b.formAttempts === 0 : integer(b.lastFormRound, 1, maxRound)) &&
    [b.contactAttempts, b.formAttempts, b.breakLinkUses, b.transfigurationAttempts, b.transfigurationSuccesses, b.pickUpUses].every(n => integer(n)) && b.contactDistanceMetres === b.contactAttempts * 4 &&
    b.transfigurationSuccesses <= b.transfigurationAttempts && b.transfigurationAttempts <= b.formAttempts && b.pickUpUses <= b.transfigurationSuccesses &&
    shape(b.powerUses, ANCIENT_EVIL_POWER_IDS) && ANCIENT_EVIL_POWER_IDS.every(id => integer(b.powerUses[id])) && b.breakLinkUses === b.powerUses.RESIST_FORM &&
    b.enemySpirituality === 120 - ANCIENT_EVIL_POWERS.reduce((n, p) => n + p.cost * b.powerUses[p.id], 0) && Array.isArray(b.reflectionHistory);
}
const SOURCE_KEYS = ['runId', 'revision', 'week', 'round', 'encounterId', 'targetId', 'attemptWeek', 'startHistoryIndex', 'targetName', 'targetAge', 'targetPathway', 'targetSequence', 'targetCore', 'targetWill', 'actualBody', 'independentMind', 'enemyWeapon', 'yardId', 'enemyPosition', 'enemyDistanceMetres', 'ordinaryExit', 'pursuit', 'thirdPartiesInArea', 'automaticAllyImmunity', 'playerHealth', 'playerMind', 'playerSpirituality', 'playerInjuries', 'playerRisk', 'physique', 'perception', 'will', 'knowledge', 'objectMastery', 'bodyMastery', 'burstMastery', 'clubHeld', 'preparation', 'root', 'body', 'randomSeed', 'randomCursor'] as const;
function validInjuries(injuries: SliceInjury[], revision: number): boolean {
  return Array.isArray(injuries) && new Set(injuries.map(i => i.id)).size === injuries.length && injuries.every(i => shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && !!i.id && ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision, 0, revision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision, revision)));
}
export function validAncientEvilCombatSource(x: AncientEvilCombatSource): boolean {
  try {
    const p = x.root;
    return shape(x, SOURCE_KEYS) && shape(x.body, Object.keys(combatBody(x.body))) && validateAncientEvilPreparation(x.preparation) && typeof x.runId === 'string' && !!x.runId && integer(x.revision) && integer(x.week, 1) && integer(x.round, 1) && integer(x.startHistoryIndex) && x.attemptWeek === x.week &&
      x.encounterId === 'ANCIENT_EVIL_DISPUTE' && x.targetId === ANCIENT_EVIL_TARGET_ID && x.targetName === '莱娜' && x.targetAge === 45 && x.targetPathway === 'audience' && x.targetSequence === 3 && x.targetCore === 22 && x.targetWill === 22 &&
      x.actualBody === true && x.independentMind === true && x.enemyWeapon === 'AE2-LENA-STAFF' && x.yardId === 'SD3-QUIET-ROOM' && x.enemyPosition === 'BETWEEN_A_AND_B' && x.enemyDistanceMetres === 2 &&
      x.ordinaryExit === 'OPEN' && x.pursuit === false && x.thirdPartiesInArea === 0 && x.automaticAllyImmunity === false && [x.playerHealth, x.playerMind].every(n => integer(n, 1, 100)) && integer(x.playerSpirituality, 0, 120) &&
      [x.physique, x.perception, x.will, x.knowledge, x.objectMastery, x.bodyMastery, x.burstMastery].every(n => integer(n, 0, 500)) && typeof x.clubHeld === 'boolean' && integer(x.playerRisk) && validInjuries(x.playerInjuries, x.revision) && validInjuries(x.body.enemyInjuries, x.revision) &&
      p.siteId === 'SD3-QUIET-ROOM' && p.playerLocation === 'A' && p.volunteer.id === 'SD3-ELSA' && p.volunteer.age === 43 && p.volunteer.location === 'OUTSIDE' && p.volunteer.bodyId === 'SD3-ELSA' && p.volunteer.alive && p.volunteer.form === 'HUMAN' && p.guide.id === 'HARLAN' && p.guide.location === 'OUTSIDE' &&
      p.clothing.location === 'ELSA' && p.clothing.worn && p.bag.location === 'ELSA' && p.activeCase === null && integer(p.clockSeconds) && integer(p.playerTravelMetres) &&
      validAncientEvilBody(x.body, p.clockSeconds, x.round - 1) && x.body.enemyStatus === 'RESISTING' && (x.body.link !== 'LINKED' || x.body.linkRound !== null && x.round <= x.body.linkRound + 2) &&
      typeof x.randomSeed === 'string' && !!x.randomSeed && integer(x.randomCursor) && x.preparation.runId === x.runId && x.preparation.randomSeed === x.randomSeed && x.preparation.randomCursor <= x.randomCursor && x.preparation.revision < x.revision && p.clockSeconds === x.preparation.lifeClockSeconds + 16 + 60 * (x.round - 1);
  } catch { return false; }
}
/** The authoritative and replay paths run exactly this same kernel from the original recorded RNG. */
export function replayAncientEvilCombatRound(x: AncientEvilCombatSource, stance: SliceStance, cursePolicy = false, madmanPolicy: MadmanBurstPolicy = 'HOLD'): { round: SliceCombatRound; outcome: AncientEvilResolution } {
  if (!validAncientEvilCombatSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance) || typeof cursePolicy !== 'boolean' || !['HOLD', 'BURST_FIRST'].includes(madmanPolicy)) throw new Error('缺少真实战斗来源或有效策略。');
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = createAncientEvilRuntime(x, madmanPolicy), b = r.body;
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = ancientEvilActionCount(playerCountRoll), enemyCount = ancientEvilEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: AncientEvilActionEvidence[] = [], enemies: AncientEvilActionEvidence[] = [], remaining = { PLAYER: playerCount, ENEMY: enemyCount };
  let retreat: SliceCombatRound['retreat'] = 'NONE';
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) {
    for (const actor of order) {
      if (!remaining[actor]) continue;
      if (actor === 'PLAYER' && stance === 'RETREAT') { remaining.PLAYER = 0; retreat = rng.nextInt(1, 100) <= 50 ? 'SUCCESS' : 'FAILURE'; if (retreat === 'SUCCESS') { remaining.ENEMY = 0; break; } continue; }
      remaining[actor]--; const index = players.length + enemies.length;
      if (actor === 'PLAYER') players.push(resolveAncientEvilPlayerSlot(x, r, drawAncientEvilAbility(rng, null, stance), index, rng, cursePolicy));
      else enemies.push(resolveAncientEvilEnemySlot(x, r, drawAncientEvilEnemyAbility(rng), index, rng));
    }
  }
  const sum = (a: AncientEvilActionEvidence[], key: 'selfGain' | 'enemyReduction') => a.reduce((n, v) => n + v[key], 0);
  const playerAdvantage = Math.max(125, base(x.physique * .5 + x.perception * .2 + x.will * .15 + x.knowledge * .15, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, base(22, x.body.enemyHealth, x.body.enemyMind, x.body.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction'));
  const winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100, winner = retreat === 'SUCCESS' ? 'ENEMY' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  let playerHealth = x.playerHealth, playerRisk = x.playerRisk, outcome: AncientEvilResolution = retreat === 'SUCCESS' ? 'RETREATED' : 'CONTINUE';
  const playerInjuries = structuredClone(x.playerInjuries); let consequenceWeights: SliceCombatRound['consequenceWeights'] = null, consequenceRoll: number | undefined, consequenceDomain: SliceCombatRound['consequenceDomain'];
  if (retreat !== 'SUCCESS') {
    const loser = winner === 'PLAYER' ? 'ENEMY' : 'PLAYER', attacks = loser === 'PLAYER' ? enemies : players, injuries = loser === 'PLAYER' ? playerInjuries : b.enemyInjuries;
    let risk = loser === 'PLAYER' ? playerRisk : b.enemyRisk; if (injuries.length) risk++; if (loser === 'PLAYER') playerRisk = risk; else b.enemyRisk = risk;
    if (attacks.some(a => a.threatens && a.attackKind === 'BODY')) {
      consequenceDomain = 'BODY'; consequenceWeights = weights(risk); consequenceRoll = rng.nextInt(1, 100);
      const severity = consequenceRoll <= consequenceWeights.light ? 'LIGHT' : consequenceRoll <= consequenceWeights.light + consequenceWeights.heavy ? 'HEAVY' : 'DEATH';
      if (severity === 'DEATH') { if (loser === 'PLAYER') playerHealth = 0; else { b.enemyHealth = 0; b.enemyStatus = 'DEAD'; } }
      else {
        const injury: SliceInjury = { id: `${x.runId}:combat:${x.round}:${loser}:${x.revision + 1}:${injuries.length}`, severity, acquiredRevision: x.revision + 1, treatedRevision: null }; injuries.push(injury);
        const damage = severity === 'LIGHT' ? 10 : 30; if (loser === 'PLAYER') playerHealth = Math.max(0, playerHealth - damage); else b.enemyHealth = Math.max(0, b.enemyHealth - damage);
        if (loser === 'PLAYER' && cursePolicy && b.form === 'WOOD' && b.link === 'LINKED') {
          const enemyDamage = severity === 'LIGHT' ? 5 : 15, enemyInjuryId = `${x.runId}:ancient-evil-reflection:${x.round}:${x.revision + 1}`;
          b.enemyHealth = Math.max(0, b.enemyHealth - enemyDamage); b.enemyInjuries.push({ id: enemyInjuryId, severity, acquiredRevision: x.revision + 1, treatedRevision: null });
          b.reflectionHistory.push({ round: x.round, severity, playerDamage: damage, enemyDamage, playerInjuryId: injury.id, enemyInjuryId });
        }
        if (b.enemyHealth === 0) b.enemyStatus = 'DEAD'; else if (loser === 'ENEMY' && severity === 'HEAVY' || loser === 'PLAYER' && severity === 'HEAVY' && b.enemyHealth <= 40 && b.reflectionHistory.at(-1)?.round === x.round) b.enemyStatus = 'SURRENDERED';
      }
      if (playerHealth === 0) outcome = 'PLAYER_DEAD'; else if (b.enemyHealth === 0) outcome = 'ENEMY_DEAD'; else if (b.enemyStatus === 'SURRENDERED') outcome = 'ENEMY_SURRENDERED';
    } else if (loser === 'PLAYER' && attacks.some(a => a.mentalPressure)) { consequenceDomain = 'MENTAL'; r.playerM = Math.max(0, r.playerM - 10); if (r.playerM === 0) outcome = 'RETREATED'; }
  }
  if (outcome === 'CONTINUE' && r.playerM === 0) outcome = 'RETREATED';
  advanceAncientEvilCombatClock(r, x.root.clockSeconds + 60 - r.root.clockSeconds);
  if (outcome !== 'CONTINUE' || b.linkRound !== null && x.round >= b.linkRound + 2) b.link = 'NONE';
  if (b.enemyHealth === 0) b.weaponLocation = 'COURT';
  const o: AncientEvilRoundOutcome = { ...structuredClone(b), targetId: ANCIENT_EVIL_TARGET_ID, round: x.round, source: structuredClone(x), stance, continuing: outcome === 'CONTINUE', cursePolicy,
    madmanBurst: { ...r.madman }, playerHealthAfter: playerHealth, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, playerInjuriesAfter: playerInjuries, playerRiskAfter: playerRisk,
    rootAfter: structuredClone(r.root), elapsedSeconds: 60, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies };
  const round: SliceCombatRound = { round: x.round, stance, first, playerCount, enemyCount, playerCountRoll, enemyCountRoll,
    moves: [...players, ...enemies].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })),
    playerAdvantage, enemyAdvantage, winChance, winner, consequence: '', consequenceWeights, retreat,
    ...(consequenceDomain === undefined ? {} : { consequenceDomain }), ...(consequenceRoll === undefined ? {} : { consequenceRoll }), ancientEvilOutcome: o, madmanBurst: { ...r.madman } };
  round.consequence = ancientEvilCombatConsequence(round); return { round, outcome };
}
export function validateAncientEvilRoundOutcome(v: unknown): v is AncientEvilRoundOutcome {
  try { const o = v as AncientEvilRoundOutcome; return !!o && same(o, replayAncientEvilCombatRound(o.source, o.stance, o.cursePolicy, o.madmanBurst.policy).round.ancientEvilOutcome); } catch { return false; }
}
export function validateAncientEvilCombatRound(round: SliceCombatRound): boolean {
  try { const o = round.ancientEvilOutcome; return !!o && same(round, replayAncientEvilCombatRound(o.source, o.stance, o.cursePolicy, o.madmanBurst.policy).round); } catch { return false; }
}
export function nextAncientEvilCombatSource(o: AncientEvilRoundOutcome): AncientEvilCombatSource {
  return { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter,
    playerSpirituality: Math.min(120, o.playerSpiritualityAfter + 12), playerInjuries: structuredClone(o.playerInjuriesAfter), playerRisk: o.playerRiskAfter,
    root: structuredClone(o.rootAfter), body: combatBody(o), randomCursor: o.randomCursorAfter };
}
export function ancientEvilCombatConsequence(round: SliceCombatRound): string {
  const o = round.ancientEvilOutcome!;
  const subject = round.winner === 'PLAYER' ? '莱娜' : '你'; let text = round.retreat === 'SUCCESS' ? '你通过撤离判定，将从普通出口离开。' : round.consequenceDomain === 'MENTAL' ? `你承受实际精神梦刺，精神减少10；没有身体伤口。${o.playerMindAfter === 0 ? '精神耗尽，沿开放通路结束交战。' : ''}` : round.consequenceDomain !== 'BODY' ? `${subject}本轮处于下风，但没有承受实际身体攻击，不掷身体伤势盘。` : `${subject}实际承受身体攻击，按共同伤势盘结算。`;
  if (o.playerHealthAfter === 0) text += '你的原身体真实死亡，不能因形态变化复活。'; else if (o.enemyHealth === 0) text += '莱娜的原身体真实死亡。'; else if (o.enemyStatus === 'SURRENDERED') text += '莱娜因真实伤势自主停止抵抗。';
  if (round.consequenceDomain === 'BODY' && o.enemyActions.some(a => a.mentalPressure)) text += '莱娜的精神梦刺也实际参与优势计算；本次身体后果仅由实际身体攻击触发。';
  return text + ` 本轮实际经过60秒。莱娜仍是同一身体，当前${o.enemyForm === 'RABBIT' ? `兔形尚余${o.enemyFormUntilSeconds! - o.rootAfter.clockSeconds}秒` : '人形'}；原杖${o.weaponLocation === 'HAND' ? '由她持握' : '仍在地面'}。停止输入不等于复原，伤势与已付费用保留。`;
}
export function projectAncientEvilCombat(s: SliceState) {
  const e = s.ancientEvil.encounter, visible = isAncientEvil(s), last = s.combat?.encounterId === 'ANCIENT_EVIL_DISPUTE' ? s.combat.lastRound?.ancientEvilOutcome : e.terminal ? s.combatHistory[e.terminal.historyIndex]?.ancientEvilOutcome : null;
  return { enemyName: visible ? '莱娜（45岁，织梦人）' : '', targetId: visible ? e.targetId : null, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality,
    distanceMetres: s.silentDisciple.life.playerLocation === 'A' ? e.enemyDistanceMetres : e.enemyDistanceMetres + 4, enemyForm: e.enemyForm, enemyFormUntilSeconds: e.enemyFormUntilSeconds, weaponLocation: e.weaponLocation, form: e.form, link: e.link, blocks: structuredClone(e.blocks), powerUses: { ...e.powerUses },
    lastActionSequence: last ? [...last.playerActions, ...last.enemyActions].sort((a, b) => a.order - b.order) : [], countWheel: ANCIENT_EVIL_COUNT_WHEEL, enemyCountWheel: ANCIENT_EVIL_ENEMY_COUNT_WHEEL, enemyAbilityWheel: ANCIENT_EVIL_ENEMY_ABILITY_WHEEL,
    summary: visible ? '真实接触后才能付费尝试持续90秒变形，对方可抵抗。停止输入或回合结束不会提前复原；兔形保留精神梦刺与抵抗，不能做原手势或持杖。复原后拾起原杖须另占实际行动。诅咒引导主要用于生活实践，只解除自己的有限诅咒，不增加无来源攻击。原卡尔德、旧三原木块、原伤势与资源保持原样。' : '' };
}
export type AncientEvilCombatProjection = ReturnType<typeof projectAncientEvilCombat>;
