import { publicPryerFields as publicFields, publicPryerInjury } from '../sage/life.js';
import { publicAbyssOriginalSite } from './public.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import type { BlathererLifeState } from '../blatherer/life.js';
import { BLOOD_DUKE_TARGET_ID, BLOOD_DUKE_POWER_IDS, BLOOD_DUKE_POWERS, hasBloodDukeDisputeOpponent,
  validateBloodDukePreparation, type BloodDukePreparation, type BloodDukeEnemyIntent, type BloodDukePowerId } from './encounter.js';

export const BLOOD_DUKE_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const BLOOD_DUKE_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const bloodDukeActionCount = pyromaniacActionCount;
export const bloodDukeEnemyActionCount = pyromaniacActionCount;
const FLAME = 'abyss.s6.flame-hex', BODY = 'BODY_FOLLOWUP', HARDEN = 'abyss.s6.demonic-body', WHISPER = 'abyss.s3.limited-murmur';
const RESTRAINT = 'abyss.s2.self-restraint', INTERFERENCE = 'abyss.s2.emotion-interference';
const INHERITED_IDS = [FLAME, HARDEN, WHISPER, RESTRAINT, INTERFERENCE] as const;
export type BloodDukeMoveId = typeof FLAME | typeof BODY | typeof HARDEN | typeof WHISPER | typeof RESTRAINT | typeof INTERFERENCE | 'OBSERVE' | 'ACCIDENT';
/** Keep the original six relative ticket weights. New techniques replace their relevant slot
 * only under the explicitly selected stance; no seventh slot or free inventory is granted. */
const ABILITIES: readonly { id: BloodDukeMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: FLAME, label: '旧火焰3灵性、1恶魔负荷；持原棍时普通挥击', weight: 30, stance: 'ATTACK' },
  { id: BODY, label: '继承身体次击，按原掌握与当前身体计算', weight: 15, stance: 'ATTACK' },
  { id: HARDEN, label: '旧硬皮2灵性、1恶魔负荷；防守姿态改用自我约束', weight: 20, stance: 'DEFEND' },
  { id: WHISPER, label: '旧低语4灵性、1精神；控制姿态改用情绪干扰', weight: 20, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '普通观察当前情绪和出口', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差，优势减少22.5', weight: 5, stance: null },
];
export const BLOOD_DUKE_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'SILVER_THRUST', label: '自己的银白细剑，6灵性，知识18', weight: 35 },
  { id: 'SILVER_ARMOR', label: '自己的银甲，6灵性，知识18，有限防护36', weight: 25 },
  { id: 'BODY_STRIKE', label: '以自己的钢剑作普通身体攻击', weight: 25 },
  { id: 'STEADY_BREATH', label: '实际集中呼吸，平复情绪并清除待生效干扰', weight: 10 },
  { id: 'ACCIDENT', label: '实际失衡，无伤害与消耗', weight: 5 },
];
export const isBloodDuke = (s: SliceState): boolean => s.progression.pathwayId === 'abyss' && s.progression.sequence === 2;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
const selectedId = (id: BloodDukeMoveId, stance: SliceStance | null): BloodDukeMoveId => id === HARDEN && stance === 'DEFEND' ? RESTRAINT : id === WHISPER && stance === 'CONTROL' ? INTERFERENCE : id;
export function bloodDukeAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: selectedId(a.id, stance), weight: weights[i]! / total * 100,
    label: selectedId(a.id, stance) === RESTRAINT ? '自我约束：6灵性、2精神，意志18，下一实际身体攻势减弱至多30' : selectedId(a.id, stance) === INTERFERENCE ? '情绪干扰：6灵性、2精神，意志18与抵抗；须当前强烈情绪' : a.label }));
}
function drawPlayer(random: ActionRandomStream, stance: SliceStance | null): BloodDukeMoveId {
  const weights = tickets(stance); let n = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return selectedId(a.id, stance); } throw new Error('能力盘无效。');
}
export function drawBloodDukeAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): BloodDukeMoveId { return drawPlayer(random, stance); }
export function drawBloodDukeEnemyAbility(random: ActionRandomStream): BloodDukeEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of BLOOD_DUKE_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as BloodDukeEnemyIntent; } throw new Error('对手行动盘无效。');
}
export interface BloodDukeCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'BLOOD_DUKE_DISPUTE'; targetId: typeof BLOOD_DUKE_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetName: '加雷斯·莫尔'; targetAge: 44; targetPathway: 'warrior'; targetSequence: 3; targetCore: 22;
  actualBody: true; independentMind: true; enemyWeapon: 'BD2-GARETH-SWORD'; weaponLocation: 'HAND'; yardId: 'BL3-QUIET-ROOM';
  playerPosition: 'A'; enemyPosition: 'BETWEEN_A_AND_B'; enemyDistanceMetres: 2; ordinaryExit: 'OPEN'; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  playerInjuries: SliceInjury[]; enemyInjuries: SliceInjury[]; playerRisk: number; enemyRisk: number;
  preparation: BloodDukePreparation; root: BlathererLifeState; strain: number; emotion: 'ANGRY' | 'CALM'; breathUses: number;
  inheritedMastery: Record<string, number>; clubHeld: boolean; playerClubId: 'town-short-club' | null;
  physique: number; perception: number; knowledge: number; will: number;
  powerUses: Record<BloodDukePowerId, number>; clockSeconds: number; randomSeed: string; randomCursor: number;
}
export interface BloodDukeCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: false }
interface ActionEvidence extends BloodDukeCombatEffect {
  order: number; travelMetres: number; atSeconds: number; elapsedSeconds: 5; paidCost: number; mindCost: number; physicalFactor: number; rolls: number[];
  randomCursorBefore: number; randomCursorAfter: number; playerHealthAfter: number; playerMindAfter: number; playerSpiritualityAfter: number; enemySpiritualityAfter: number;
  chargeGranted: boolean; chargeConsumedByOrder: number | null; chargeCancelledByOrder: number | null; applied: boolean; appliedAmount: number; consumedEffectOrders: number[];
}
export interface BloodDukePlayerAction extends ActionEvidence {
  id: BloodDukeMoveId; attempted: boolean; succeeded: boolean; resisted: boolean; mode: string;
  prepared: 'WHISPER' | 'RESTRAINT' | 'INTERFERENCE' | null; strainCost: number;
}
export interface BloodDukeEnemyAction extends ActionEvidence { planned: BloodDukeEnemyIntent; actual: BloodDukeEnemyIntent | 'OBSERVE'; attackKind: 'NONE' | 'BODY'; succeeded: boolean; emotionBefore: 'ANGRY' | 'CALM'; emotionAfter: 'ANGRY' | 'CALM' }
interface Runtime {
  playerS: number; playerM: number; playerH: number; enemyS: number; strain: number; emotion: 'ANGRY' | 'CALM'; breathUses: number; powers: Record<BloodDukePowerId, number>; clockSeconds: number;
  root: BlathererLifeState; restraintAttempted: boolean; interferenceAttempted: boolean; guardAttempted: boolean;
  whisper: BloodDukePlayerAction | null; restraint: BloodDukePlayerAction | null; interference: BloodDukePlayerAction | null; guard: BloodDukeEnemyAction | null;
}
export interface BloodDukeRoundContext {
  source: BloodDukeCombatSource; stance: SliceStance; finished: boolean; liveState: string; runtime: Runtime;
  playerActions: BloodDukePlayerAction[]; enemyActions: BloodDukeEnemyAction[]; label: string; outcome: BloodDukeRoundOutcome | null;
}
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]): boolean => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
const none = (label: string): BloodDukeCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
const physicalAt = (health: number): number => health > 75 ? 1 : health > 50 ? .95 : health > 25 ? .9 : .8;
const masteryFactor = (v: number) => .65 + .35 * v / 500;
export function currentBloodDukeCombatSource(s: SliceState): BloodDukeCombatSource | null {
  if (!hasBloodDukeDisputeOpponent(s)) return null;
  const e = s.bloodDuke.encounter, c = s.combat!, stats = s.character.coreStats;
  if (!e.preparation || !e.startRoot) return null;
  const playerClubId = s.town.clubLocation === 'HAND' ? 'town-short-club' : null;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'BLOOD_DUKE_DISPUTE', targetId: BLOOD_DUKE_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetName: '加雷斯·莫尔', targetAge: 44, targetPathway: 'warrior', targetSequence: 3, targetCore: 22,
    actualBody: true, independentMind: true, enemyWeapon: 'BD2-GARETH-SWORD', weaponLocation: 'HAND', yardId: 'BL3-QUIET-ROOM', playerPosition: 'A', enemyPosition: 'BETWEEN_A_AND_B',
    enemyDistanceMetres: 2, ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality,
    playerInjuries: structuredClone(s.injuries), enemyInjuries: structuredClone(c.enemyInjuries), playerRisk: s.injuryRisk, enemyRisk: c.enemyRisk,
    preparation: structuredClone(e.preparation), root: structuredClone(s.blatherer.life), strain: s.demon.strain, emotion: e.emotion, breathUses: e.breathUses,
    inheritedMastery: Object.fromEntries(INHERITED_IDS.map(id => [id, s.progression.mastery[id]!])),
    clubHeld: playerClubId !== null, playerClubId, physique: stats.physique, perception: stats.perception, knowledge: stats.knowledge, will: stats.will,
    powerUses: { ...e.powerUses }, clockSeconds: s.blatherer.life.clockSeconds, randomSeed: s.random.seed, randomCursor: s.random.cursor };
}
function makeRuntime(x: BloodDukeCombatSource): Runtime {
  return { playerS: x.playerSpirituality, playerM: x.playerMind, playerH: x.playerHealth, enemyS: x.enemySpirituality, strain: x.strain, emotion: x.emotion, breathUses: x.breathUses,
    powers: { ...x.powerUses }, clockSeconds: x.clockSeconds, root: structuredClone(x.root), restraintAttempted: false, interferenceAttempted: false, guardAttempted: false,
    whisper: null, restraint: null, interference: null, guard: null };
}
function liveState(s: SliceState): string {
  return stableStringify({ spirituality: s.spirituality, mind: s.mind, enemySpirituality: s.bloodDuke.encounter.enemySpirituality, powerUses: s.bloodDuke.encounter.powerUses,
    preparation: s.bloodDuke.encounter.preparation, startRoot: s.bloodDuke.encounter.startRoot, historicalLife: s.bloodDuke.life, root: s.blatherer.life,
    demon: s.demon, criminal: s.criminal, desireApostle: s.desireApostle, devil: s.devil, emotion: s.bloodDuke.encounter.emotion, breathUses: s.bloodDuke.encounter.breathUses,
    stats: s.character.coreStats, mastery: s.progression.mastery, club: s.town.clubLocation, originalEncounter: s.blatherer.encounter,
    sequence: s.progression.sequence, pathway: s.progression.pathwayId, status: s.status, city: s.world.city, activeEvent: s.activeEvent });
}
const roundOrigins = new WeakMap<BloodDukeRoundContext, { source: string; stance: SliceStance }>();
function originalContext(r: BloodDukeRoundContext): boolean { const origin = roundOrigins.get(r); return !!origin && origin.source === stableStringify(r.source) && origin.stance === r.stance; }
const dynamicSource = new Set(['playerHealth', 'playerMind', 'playerSpirituality', 'enemySpirituality', 'powerUses', 'clockSeconds', 'root', 'strain', 'emotion', 'breathUses']);
function validRound(s: SliceState, r: BloodDukeRoundContext, supplied: BloodDukeCombatSource | null): boolean {
  const actual = currentBloodDukeCombatSource(s);
  return originalContext(r) && !r.finished && actual !== null && supplied !== null && same(supplied, r.source) && r.liveState === liveState(s) && actual.playerHealth === r.runtime.playerH && actual.playerMind === r.runtime.playerM && actual.clockSeconds === r.runtime.clockSeconds &&
    same(actual.root, r.runtime.root) && actual.strain === r.runtime.strain && actual.emotion === r.runtime.emotion && actual.breathUses === r.runtime.breathUses && Object.entries(r.source).every(([key, value]) => dynamicSource.has(key) || same(actual[key as keyof BloodDukeCombatSource], value));
}
export function beginBloodDukeCombatRound(s: SliceState, stance: SliceStance, random: ActionRandomStream): BloodDukeRoundContext {
  const source = currentBloodDukeCombatSource(s);
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance) || !source || !validSource(source) || random.seed !== source.randomSeed || random.cursor !== source.randomCursor) throw new Error('缺少当前现场、真实对手或资源。');
  const context: BloodDukeRoundContext = { source, stance, finished: false, liveState: liveState(s), runtime: makeRuntime(source), playerActions: [], enemyActions: [], outcome: null, label: roundOpening(source) };
  roundOrigins.set(context, { source: stableStringify(source), stance }); return context;
}
export const createBloodDukeCombatRound = beginBloodDukeCombatRound;
function actionBase(r: Runtime, order: number, physical: number, cursor: number): ActionEvidence {
  return { ...none(''), order, travelMetres: 0, atSeconds: r.clockSeconds, elapsedSeconds: 5, paidCost: 0, mindCost: 0, physicalFactor: physical, rolls: [], randomCursorBefore: cursor, randomCursorAfter: cursor,
    playerHealthAfter: r.playerH, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, enemySpiritualityAfter: r.enemyS,
    chargeGranted: false, chargeConsumedByOrder: null, chargeCancelledByOrder: null, applied: false, appliedAmount: 0, consumedEffectOrders: [] };
}
function closeAction<T extends ActionEvidence>(a: T, r: Runtime, random: ActionRandomStream): T {
  r.clockSeconds += 5; r.root.clockSeconds = r.clockSeconds; a.randomCursorAfter = random.cursor; a.playerHealthAfter = r.playerH; a.playerMindAfter = r.playerM; a.playerSpiritualityAfter = r.playerS; a.enemySpiritualityAfter = r.enemyS;
  a.label += ` 本动作5秒；你余${r.playerS}灵性、${r.playerM}精神，对手余${r.enemyS}灵性。`; return a;
}
function consume(effect: BloodDukePlayerAction | BloodDukeEnemyAction, a: ActionEvidence, amount: number, cancelled = false): void {
  a.consumedEffectOrders.push(effect.order);
  if (cancelled) { effect.chargeCancelledByOrder = a.order; effect.label += ` 第${a.order + 1}动作结束这次准备，费用不退。`; }
  else { effect.chargeConsumedByOrder = a.order; effect.appliedAmount = amount; effect.applied = amount > 0; effect.label += ` 第${a.order + 1}动作实际应用${amount}，仅这一次。`; }
}
function applyAttackWindows(r: Runtime, a: BloodDukePlayerAction): void {
  if (!a.threatens) return;
  if (r.guard) { const amount = Math.min(36, a.selfGain); consume(r.guard, a, amount); a.selfGain -= amount; r.guard = null; a.label += ` 对手银甲实际吸收${amount}。`; }
  a.threatens = a.selfGain > 0; a.applied = a.threatens; a.appliedAmount = a.selfGain;
}
function playerAction(x: BloodDukeCombatSource, r: Runtime, _stance: SliceStance, id: BloodDukeMoveId, physical: number, order: number, random: ActionRandomStream): BloodDukePlayerAction {
  const a: BloodDukePlayerAction = { ...actionBase(r, order, physical, random.cursor), id, attempted: false, succeeded: false, resisted: false, mode: 'ORDINARY', prepared: null, strainCost: 0 };
  const check = (ability: 'knowledge' | 'will', difficulty: number) => { const roll = random.nextInt(1, 100); a.rolls.push(roll); return roll <= computeCheckChance({ ability, baseAbility: x[ability], difficulty, modifiers: [] }); };
  if (id === 'ACCIDENT') { a.selfGain = -22.5; a.label = '本次动作偏差，优势减少22.5，不重抽。'; }
  else if (id === BODY) {
    a.selfGain = 29.575 * masteryFactor(x.inheritedMastery[HARDEN]!) * physical; a.threatens = a.selfGain > 0;
    a.travelMetres = 4; r.root.playerTravelMetres += 4; a.mode = 'INHERITED_BODY'; a.label = '本人靠近2米，以原有身体能力攻击，再退回2米。'; applyAttackWindows(r, a);
  } else if (id === FLAME || id === HARDEN) {
    const flame = id === FLAME, cost = flame ? 3 : 2; let value: number;
    if (flame && x.clubHeld) { a.mode = 'ORIGINAL_CLUB'; value = 16 * physical; a.label = '本人以自己持握的原短棍攻击，替换本槽火焰，无灵性消耗与新增负荷。'; a.travelMetres = 4; r.root.playerTravelMetres += 4; }
    else if (r.strain < 3 && r.playerS >= cost) { a.paidCost = cost; r.playerS -= cost; a.strainCost = 1; r.strain++; a.mode = 'INHERITED_POWER'; value = (flame ? 60 : 50.7 * physical) * masteryFactor(x.inheritedMastery[id]!); a.label = `实付${cost}灵性与1恶魔负荷，使用旧${flame ? '火焰' : '硬皮'}；当前负荷${r.strain}/3。`; }
    else { a.mode = 'ORDINARY_FALLBACK'; value = (flame ? 12 : 10) * physical; a.label = `灵性不足或恶魔负荷已满，改用普通${flame ? '身体攻击' : '格挡'}，不重置负荷。`; if (flame) { a.travelMetres = 4; r.root.playerTravelMetres += 4; } }
    a.selfGain = flame ? value : 0; a.enemyReduction = flame ? 0 : value; a.threatens = flame && value > 0; if (flame) applyAttackWindows(r, a); else { a.applied = value > 0; a.appliedAmount = value; }
  } else if (id === WHISPER) {
    if (r.playerS < 4 || r.playerM <= 1) { a.mode = 'LOW_RESOURCE'; a.label = '灵性不足4或精神不足以承担1，普通观察，无消耗。'; }
    else { a.attempted = true; a.paidCost = 4; a.mindCost = 1; r.playerS -= 4; r.playerM--; a.succeeded = check('knowledge', 18); a.mode = a.succeeded ? 'PREPARED' : 'FAILED';
      if (a.succeeded) { if (r.whisper) consume(r.whisper, a, 0, true); a.prepared = 'WHISPER'; a.chargeGranted = true; r.whisper = a; }
      a.label = `旧低语实付4灵性、1精神；${a.succeeded ? '准备使随后一次正身体攻势减半' : '检定失败，未形成效果，费用保留'}。`; }
  } else if (id === RESTRAINT || id === INTERFERENCE) {
    const restraint = id === RESTRAINT, attempted = restraint ? r.restraintAttempted : r.interferenceAttempted;
    if (attempted) { a.mode = 'ALREADY_ATTEMPTED'; a.label = '本轮已经尝试过这项能力，普通观察，不再次收费。'; }
    else if (!restraint && r.emotion !== 'ANGRY') { a.mode = 'NO_STRONG_EMOTION'; a.label = '加雷斯已平复情绪，缺少当前强烈情绪，不能凭空制造情绪或发动干扰。'; }
    else if (r.playerS < 6 || r.playerM <= 2) { a.mode = 'LOW_RESOURCE'; a.label = '实际灵性不足6或精神不足以承担2，普通观察，无消耗。'; }
    else {
      a.attempted = true; a.paidCost = 6; a.mindCost = 2; r.playerS -= 6; r.playerM -= 2;
      if (restraint) r.restraintAttempted = true; else r.interferenceAttempted = true;
      const passed = check('will', 18);
      if (!restraint && passed) { const resistance = random.nextInt(1, 100); a.rolls.push(resistance); a.resisted = resistance <= 35; }
      a.succeeded = passed && !a.resisted; a.mode = a.succeeded ? 'PREPARED' : a.resisted ? 'RESISTED' : 'FAILED';
      if (a.succeeded) { a.chargeGranted = true; a.prepared = restraint ? 'RESTRAINT' : 'INTERFERENCE'; if (restraint) r.restraint = a; else r.interference = a; }
      a.label = `${restraint ? '面对近处持剑威胁，约束急于前冲的动作并保持防守节奏' : '对当前愤怒作有限情绪干扰'}实付6灵性、2精神；${a.succeeded ? `只准备随后一次实际正身体攻势减弱至多${restraint ? 30 : 25}，尚未实际生效` : a.resisted ? '对方抵抗成功，未产生效果' : '检定失败，未产生效果'}。费用不退，不支配意志或血液。`;
    }
  } else { a.mode = 'OBSERVE'; a.label = `普通观察：加雷斯${r.emotion === 'ANGRY' ? '仍然明显愤怒' : '已经平复情绪'}，诺拉已在室外，普通出口开放。`; }
  return closeAction(a, r, random);
}
function enemyAction(x: BloodDukeCombatSource, r: Runtime, planned: BloodDukeEnemyIntent, physical: number, order: number, random: ActionRandomStream): BloodDukeEnemyAction {
  const a: BloodDukeEnemyAction = { ...actionBase(r, order, physical, random.cursor), planned, actual: planned, attackKind: 'NONE', succeeded: false, emotionBefore: r.emotion, emotionAfter: r.emotion };
  const power = BLOOD_DUKE_POWERS.find(p => p.id === planned);
  if (planned === 'SILVER_ARMOR' && r.guardAttempted) a.actual = 'OBSERVE'; else if (power && r.enemyS < power.cost) a.actual = 'BODY_STRIKE';
  if (a.actual === 'STEADY_BREATH') {
    a.selfGain = 8; a.applied = true; a.appliedAmount = 8; a.succeeded = true; r.breathUses++; r.emotion = 'CALM'; a.emotionAfter = 'CALM';
    for (const effect of [r.whisper, r.interference]) if (effect) consume(effect, a, 0, true); r.whisper = null; r.interference = null;
    a.label = '加雷斯亲自集中呼吸，平复自己的愤怒，清除尚未生效的低语与情绪干扰；不撤销先前后果或返还费用。'; return closeAction(a, r, random);
  }
  if (a.actual === 'SILVER_THRUST' || a.actual === 'SILVER_ARMOR') {
    r.enemyS -= 6; r.powers[a.actual]++; a.paidCost = 6;
    const roll = random.nextInt(1, 100); a.rolls.push(roll); a.succeeded = roll <= computeCheckChance({ ability: 'knowledge', baseAbility: x.targetCore, difficulty: 18, modifiers: [] });
    if (a.actual === 'SILVER_ARMOR') r.guardAttempted = true;
    if (!a.succeeded) { a.label = '加雷斯实付自己6灵性，但检定失败，能力没有成形。'; return closeAction(a, r, random); }
  }
  if (a.actual === 'SILVER_THRUST' || a.actual === 'BODY_STRIKE') {
    let raw = a.actual === 'SILVER_THRUST' ? 70 : 20 * physical;
    a.attackKind = 'BODY'; a.succeeded = true; if (a.actual === 'BODY_STRIKE') a.travelMetres = 4;
    a.label = a.actual === 'SILVER_THRUST' ? '加雷斯以自己已掌握的银白细剑攻击本人身体，实付6灵性，有限攻势70。' : '加雷斯亲自靠近2米，以自己的钢剑普通攻击，再退回2米。';
    if (r.whisper && raw > 0) { const amount = raw * .5; consume(r.whisper, a, amount); raw -= amount; r.whisper = null; }
    if (r.interference && raw > 0) { const amount = Math.min(25, raw); consume(r.interference, a, amount); raw -= amount; r.interference = null; }
    if (r.restraint && raw > 0) { const amount = Math.min(30, raw); consume(r.restraint, a, amount); raw -= amount; r.restraint = null; }
    a.selfGain = raw; a.appliedAmount = raw; a.threatens = raw > 0; a.applied = a.threatens;
  } else if (a.actual === 'SILVER_ARMOR') { a.chargeGranted = true; r.guard = a; a.label = '加雷斯实付6灵性凝聚有限银甲，只为随后一次实际攻击准备36防护；尚未受击时实际吸收为0。'; }
  else if (a.actual === 'OBSERVE') a.label = '本轮已经尝试银甲，普通观察，不再消费灵性。';
  else a.label = '对手实际失衡，不造成攻势，不恢复资源。';
  return closeAction(a, r, random);
}
function commitRuntime(s: SliceState, r: BloodDukeRoundContext): void {
  const e = s.bloodDuke.encounter; s.health = r.runtime.playerH; s.mind = r.runtime.playerM; s.spirituality = r.runtime.playerS; e.enemySpirituality = r.runtime.enemyS;
  e.powerUses = { ...r.runtime.powers }; e.emotion = r.runtime.emotion; e.breathUses = r.runtime.breathUses; s.demon.strain = r.runtime.strain; s.blatherer.life = structuredClone(r.runtime.root); r.liveState = liveState(s);
}
/** Replay the already committed prefix and the next scheduled draw before changing any resource.
 * This rejects skipped counts, wrong actor order, forged action IDs, extra draws and stale contexts.
 * The received stream must consume precisely the deterministic checks proved by the replay. */
function executeNext(s: SliceState, context: BloodDukeRoundContext, actor: 'PLAYER' | 'ENEMY', planned: BloodDukeMoveId | BloodDukeEnemyIntent, physical: number, random: ActionRandomStream): BloodDukeCombatEffect | null {
  const x = context.source, rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), runtime = makeRuntime(x);
  const remaining = { PLAYER: bloodDukeActionCount(rng.nextInt(1, 100)), ENEMY: bloodDukeEnemyActionCount(rng.nextInt(1, 100)) };
  const order = x.round % 2 === 1 ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: BloodDukePlayerAction[] = [], enemies: BloodDukeEnemyAction[] = [], committed = context.playerActions.length + context.enemyActions.length;
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) {
    for (const next of order) {
      if (!remaining[next]) continue;
      if (next === 'PLAYER' && context.stance === 'RETREAT') {
        remaining.PLAYER = 0; if (rng.nextInt(1, 100) <= 50) return null; continue;
      }
      remaining[next]--;
      const index = players.length + enemies.length, id = next === 'PLAYER' ? drawPlayer(rng, context.stance) : drawBloodDukeEnemyAbility(rng);
      const factor = physicalAt(next === 'PLAYER' ? runtime.playerH : x.enemyHealth);
      if (index === committed && (next !== actor || id !== planned || factor !== physical || random.seed !== x.randomSeed || random.cursor !== rng.cursor ||
        !same(players, context.playerActions) || !same(enemies, context.enemyActions) || !same(runtime, context.runtime))) return null;
      const action = next === 'PLAYER'
        ? playerAction(x, runtime, context.stance, id as BloodDukeMoveId, factor, index, rng)
        : enemyAction(x, runtime, id as BloodDukeEnemyIntent, factor, index, rng);
      if (next === 'PLAYER') players.push(action as BloodDukePlayerAction); else enemies.push(action as BloodDukeEnemyAction);
      if (index === committed) {
        for (const roll of action.rolls) if (random.nextInt(1, 100) !== roll) return null;
        if (random.cursor !== rng.cursor) return null;
        context.runtime = runtime; context.playerActions = players; context.enemyActions = enemies; commitRuntime(s, context);
        return { label: action.label, selfGain: action.selfGain, enemyReduction: action.enemyReduction, threatens: action.threatens, mentalPressure: false };
      }
    }
  }
  return null;
}
export function resolveBloodDukeCombatAbility(s: SliceState, id: BloodDukeMoveId, physical: number, random: ActionRandomStream, r: BloodDukeRoundContext, source: BloodDukeCombatSource | null = r.source): BloodDukeCombatEffect {
  if (!validRound(s, r, source) || !ABILITIES.some(a => selectedId(a.id, r.stance) === id)) return none('当前人物、现场或资源不符，未执行动作。');
  return executeNext(s, r, 'PLAYER', id, physical, random) ?? none('行动顺序或当前记录不符，未执行动作。');
}
export function resolveBloodDukeEnemyAbility(s: SliceState, planned: BloodDukeEnemyIntent, physical: number, random: ActionRandomStream, r: BloodDukeRoundContext, source: BloodDukeCombatSource | null = r.source): BloodDukeCombatEffect {
  if (!validRound(s, r, source) || ![...BLOOD_DUKE_POWER_IDS, 'BODY_STRIKE', 'STEADY_BREATH', 'ACCIDENT'].includes(planned)) return none('对手、原钢剑或当前资源不符，未执行动作。');
  return executeNext(s, r, 'ENEMY', planned, physical, random) ?? none('行动顺序或当前记录不符，未执行动作。');
}
export interface BloodDukeRoundOutcome {
  targetId: typeof BLOOD_DUKE_TARGET_ID; round: number; source: BloodDukeCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number;
  playerInjuriesAfter: SliceInjury[]; enemyInjuriesAfter: SliceInjury[]; playerRiskAfter: number; enemyRiskAfter: number;
  powerUses: Record<BloodDukePowerId, number>; restraintAttempted: boolean; interferenceAttempted: boolean; guardAttempted: boolean;
  expiredEffectOrders: number[]; rootAfter: BlathererLifeState; playerStrainAfter: number; emotionAfter: 'ANGRY' | 'CALM'; breathUses: number;
  clockSecondsAfter: number; elapsedSeconds: 60; randomCursorAfter: number;
  playerActions: BloodDukePlayerAction[]; enemyActions: BloodDukeEnemyAction[];
}
export function finishBloodDukeCombatRound(s: SliceState, r: BloodDukeRoundContext, continuing = true, randomCursorAfter = s.random.cursor): BloodDukeRoundOutcome {
  const e = s.bloodDuke.encounter, c = s.combat;
  if (!originalContext(r) || r.finished || !c || c.encounterId !== 'BLOOD_DUKE_DISPUTE' || c.round !== r.source.round || r.liveState !== liveState(s)) throw new Error('回合已结束或当前实际资源被改写。');
  const outcome: BloodDukeRoundOutcome = { targetId: BLOOD_DUKE_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus,
    playerSpiritualityBefore: r.source.playerSpirituality, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind, enemySpiritualityBefore: r.source.enemySpirituality,
    playerInjuriesAfter: structuredClone(s.injuries), enemyInjuriesAfter: structuredClone(c.enemyInjuries), playerRiskAfter: s.injuryRisk, enemyRiskAfter: c.enemyRisk,
    powerUses: { ...e.powerUses }, restraintAttempted: r.runtime.restraintAttempted, interferenceAttempted: r.runtime.interferenceAttempted, guardAttempted: r.runtime.guardAttempted,
    expiredEffectOrders: [r.runtime.whisper, r.runtime.restraint, r.runtime.interference, r.runtime.guard].filter((a): a is BloodDukePlayerAction | BloodDukeEnemyAction => a !== null).map(a => a.order).sort((a, b) => a - b),
    rootAfter: { ...structuredClone(r.runtime.root), clockSeconds: r.source.clockSeconds + 60 }, playerStrainAfter: r.runtime.strain, emotionAfter: r.runtime.emotion, breathUses: r.runtime.breathUses,
    clockSecondsAfter: r.source.clockSeconds + 60, elapsedSeconds: 60, randomCursorAfter, playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
  if (!validateBloodDukeRoundOutcome(outcome)) throw new Error('回合动作、负荷、身体后果或随机结果无法复核，未提交结算。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  if (e.enemyStatus !== 'RESISTING') e.weaponLocation = 'COURT';
  s.blatherer.life = structuredClone(outcome.rootAfter); r.finished = true; r.outcome = outcome;
  r.runtime.whisper = r.runtime.restraint = r.runtime.interference = r.runtime.guard = null; return structuredClone(outcome);
}
export function bloodDukeRoundOutcome(r: BloodDukeRoundContext): BloodDukeRoundOutcome { if (!r.outcome) throw new Error('回合尚未结束。'); return structuredClone(r.outcome); }
const SOURCE_KEYS = ['runId', 'revision', 'week', 'round', 'encounterId', 'targetId', 'attemptWeek', 'startHistoryIndex', 'targetName', 'targetAge', 'targetPathway', 'targetSequence', 'targetCore', 'actualBody', 'independentMind', 'enemyWeapon', 'weaponLocation', 'yardId', 'playerPosition', 'enemyPosition', 'enemyDistanceMetres', 'ordinaryExit', 'pursuit', 'thirdPartiesInArea', 'automaticAllyImmunity', 'playerHealth', 'playerMind', 'playerSpirituality', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'playerInjuries', 'enemyInjuries', 'playerRisk', 'enemyRisk', 'preparation', 'root', 'strain', 'emotion', 'breathUses', 'inheritedMastery', 'clubHeld', 'playerClubId', 'physique', 'perception', 'knowledge', 'will', 'powerUses', 'clockSeconds', 'randomSeed', 'randomCursor'] as const;
function validInjuries(v: SliceInjury[], revision: number): boolean {
  return Array.isArray(v) && new Set(v.map(i => i.id)).size === v.length && v.every(i => shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 && ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision, 1, revision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision, revision)));
}
function validSource(x: BloodDukeCombatSource): boolean {
  const p = x.root;
  return shape(x, SOURCE_KEYS) && typeof x.runId === 'string' && x.runId.length > 0 && integer(x.revision) && integer(x.week, 1) && integer(x.round, 1) && integer(x.startHistoryIndex) && x.attemptWeek === x.week &&
    x.encounterId === 'BLOOD_DUKE_DISPUTE' && x.targetId === BLOOD_DUKE_TARGET_ID && x.targetName === '加雷斯·莫尔' && x.targetAge === 44 && x.targetPathway === 'warrior' && x.targetSequence === 3 && x.targetCore === 22 && x.actualBody === true && x.independentMind === true &&
    x.enemyWeapon === 'BD2-GARETH-SWORD' && x.weaponLocation === 'HAND' && x.yardId === 'BL3-QUIET-ROOM' && x.playerPosition === 'A' && x.enemyPosition === 'BETWEEN_A_AND_B' && x.enemyDistanceMetres === 2 && x.ordinaryExit === 'OPEN' && x.pursuit === false && x.thirdPartiesInArea === 0 && x.automaticAllyImmunity === false &&
    [x.playerHealth, x.playerMind, x.enemyHealth, x.enemyMind].every(n => integer(n, 1, 100)) && x.enemyMind === 100 && [x.playerSpirituality, x.enemySpirituality].every(n => integer(n, 0, 120)) &&
    shape(p, ['siteId', 'introducedWeek', 'introducedDate', 'activeCase', 'playerLocation', 'playerTravelMetres', 'clockSeconds', 'volunteer', 'guide', 'card', 'bell', 'note', 'cases', 'reflected']) && p?.siteId === 'BL3-QUIET-ROOM' && p.playerLocation === 'A' && p.volunteer.id === 'BL3-NORA' && p.volunteer.age === 46 && p.volunteer.alive && p.volunteer.willing && p.volunteer.location === 'OUTSIDE' && p.card.id === 'BL3-CARD' && p.card.owner === 'BL3-NORA' && p.card.quantity === 1 && p.card.location === 'NORA' && integer(p.card.travelMetres) && p.bell.id === 'BL3-BELL' && p.bell.quantity === 1 && p.bell.location === 'B' && p.note.id === 'BL3-NOTE' && p.note.location === 'B' && p.guide.id === 'ROAN' && p.guide.location === 'OUTSIDE' && integer(p.playerTravelMetres) && p.activeCase === null && p.clockSeconds === x.clockSeconds &&
    integer(x.strain, 0, 3) && ['ANGRY', 'CALM'].includes(x.emotion) && integer(x.breathUses, 0, 6 * (x.round - 1)) && x.emotion === (x.breathUses > 0 ? 'CALM' : 'ANGRY') &&
    validateBloodDukePreparation(x.preparation) && x.preparation.week <= x.week && x.preparation.revision < x.revision && x.preparation.runId === x.runId && x.preparation.randomSeed === x.randomSeed && x.preparation.randomCursor <= x.randomCursor && x.clockSeconds === x.preparation.lifeClockSeconds + 12 + 60 * (x.round - 1) &&
    shape(x.inheritedMastery, INHERITED_IDS) && INHERITED_IDS.every(id => integer(x.inheritedMastery[id], 0, 500)) &&
    ['town-short-club', null].includes(x.playerClubId) && x.clubHeld === (x.playerClubId !== null) && [x.physique, x.perception, x.knowledge, x.will].every(n => integer(n, 0, 500)) && integer(x.playerRisk) && integer(x.enemyRisk) && integer(x.clockSeconds) &&
    validInjuries(x.playerInjuries, x.revision) && validInjuries(x.enemyInjuries, x.revision) && shape(x.powerUses, BLOOD_DUKE_POWER_IDS) && BLOOD_DUKE_POWER_IDS.every(id => integer(x.powerUses[id])) &&
    x.powerUses.SILVER_ARMOR <= x.round - 1 && x.powerUses.SILVER_THRUST <= 6 * (x.round - 1) &&
    x.enemySpirituality === 120 - BLOOD_DUKE_POWERS.reduce((n, p) => n + p.cost * x.powerUses[p.id], 0) && typeof x.randomSeed === 'string' && x.randomSeed.length > 0 && x.randomSeed.length <= 256 && integer(x.randomCursor);
}
function sourcePenalty(current: number, maximum: number): number { const f = Math.max(0, Math.min(1, current / maximum)); return f > .75 ? 0 : f > .5 ? .05 : f > .25 ? .1 : .2; }
function sourceBase(core: number, health: number, mind: number, spirituality: number): number { return (1250 + Math.min(core, 250)) * (1 - Math.min(.4, sourcePenalty(health, 100) + sourcePenalty(mind, 100) + sourcePenalty(spirituality, 120))); }
function sourceWeights(risk: number): { light: number; heavy: number; death: number } { const death = Math.min(100, 5 + Math.min(risk, 10) * 10), shifted = death - 5; return { light: Math.max(0, 65 - shifted), heavy: Math.max(0, 30 - Math.max(0, shifted - 65)), death }; }
interface ReplayedRound {
  outcome: BloodDukeRoundOutcome; playerCount: number; enemyCount: number; playerCountRoll: number; enemyCountRoll: number; first: 'PLAYER' | 'ENEMY';
  retreat: 'NONE' | 'SUCCESS' | 'FAILURE'; winner: 'PLAYER' | 'ENEMY'; playerAdvantage: number; enemyAdvantage: number; winChance: number;
  consequenceWeights: { light: number; heavy: number; death: number } | null; consequenceRoll?: number;
}
/** Deterministic full-round replay checks both draws, ordered costs, pending flags, cancelled windows,
 * paid bodily energy, actual injury/death results and unmodified public labels. Extra fields fail equality. */
function replayOutcome(o: BloodDukeRoundOutcome): ReplayedRound | null {
  const x = o?.source;
  if (!x || !validSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) || !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) || o.playerActions.length > 6 || o.enemyActions.length > 6) return null;
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = makeRuntime(x);
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = bloodDukeActionCount(playerCountRoll), enemyCount = bloodDukeEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const, remaining = { PLAYER: playerCount, ENEMY: enemyCount };
  const players: BloodDukePlayerAction[] = [], enemies: BloodDukeEnemyAction[] = []; let retreat: ReplayedRound['retreat'] = 'NONE';
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) {
    for (const actor of order) {
      if (remaining[actor] === 0) continue;
      if (actor === 'PLAYER' && o.stance === 'RETREAT') { remaining.PLAYER = 0; retreat = rng.nextInt(1, 100) <= 50 ? 'SUCCESS' : 'FAILURE'; if (retreat === 'SUCCESS') { remaining.ENEMY = 0; break; } continue; }
      remaining[actor]--;
      if (actor === 'PLAYER') players.push(playerAction(x, r, o.stance, drawPlayer(rng, o.stance), physicalAt(r.playerH), players.length + enemies.length, rng));
      else enemies.push(enemyAction(x, r, drawBloodDukeEnemyAbility(rng), physicalAt(x.enemyHealth), players.length + enemies.length, rng));
    }
  }
  if (!same(players, o.playerActions) || !same(enemies, o.enemyActions)) return null;
  const sum = (actions: { selfGain: number; enemyReduction: number }[], key: 'selfGain' | 'enemyReduction') => actions.reduce((n, a) => n + a[key], 0);
  const playerAdvantage = Math.max(125, sourceBase(x.physique * .35 + x.perception * .30 + x.will * .15 + x.knowledge * .20, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, sourceBase(22, x.enemyHealth, x.enemyMind, x.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction')), winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100;
  const winner = retreat === 'SUCCESS' ? 'ENEMY' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  let playerHealth = r.playerH, enemyHealth = x.enemyHealth, playerRisk = x.playerRisk, enemyRisk = x.enemyRisk;
  let enemyStatus: BloodDukeRoundOutcome['enemyStatus'] = 'RESISTING', continuing = retreat !== 'SUCCESS';
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
  const expected: BloodDukeRoundOutcome = { targetId: BLOOD_DUKE_TARGET_ID, round: x.round, source: structuredClone(x), stance: o.stance, continuing,
    enemyHealth, enemyMind: x.enemyMind, enemySpirituality: r.enemyS, enemyStatus,
    playerSpiritualityBefore: x.playerSpirituality, playerSpiritualityAfter: r.playerS, playerHealthAfter: playerHealth, playerMindAfter: r.playerM, enemySpiritualityBefore: x.enemySpirituality,
    playerInjuriesAfter: playerInjuries, enemyInjuriesAfter: enemyInjuries, playerRiskAfter: playerRisk, enemyRiskAfter: enemyRisk, powerUses: r.powers,
    restraintAttempted: r.restraintAttempted, interferenceAttempted: r.interferenceAttempted, guardAttempted: r.guardAttempted,
    expiredEffectOrders: [r.whisper, r.restraint, r.interference, r.guard].filter((a): a is BloodDukePlayerAction | BloodDukeEnemyAction => a !== null).map(a => a.order).sort((a, b) => a - b),
    rootAfter: { ...structuredClone(r.root), clockSeconds: x.clockSeconds + 60 }, playerStrainAfter: r.strain, emotionAfter: r.emotion, breathUses: r.breathUses,
    clockSecondsAfter: x.clockSeconds + 60, elapsedSeconds: 60, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies };
  if (!same(o, expected)) return null;
  return { outcome: expected, playerCount, enemyCount, playerCountRoll, enemyCountRoll, first, retreat, winner, playerAdvantage, enemyAdvantage, winChance, consequenceWeights, ...(consequenceRoll === undefined ? {} : { consequenceRoll }) };
}
export function validateBloodDukeRoundOutcome(value: unknown): value is BloodDukeRoundOutcome { try { return replayOutcome(value as BloodDukeRoundOutcome) !== null; } catch { return false; } }
export function validateBloodDukeCombatRound(round: SliceCombatRound): boolean {
  try {
    const o = round.bloodDukeOutcome, replay = o ? replayOutcome(o) : null;
    if (!o || !replay || round.round !== o.round || round.stance !== o.stance || round.consequenceDomain !== 'BODY' || round.consequence !== bloodDukeCombatConsequence(round) || !shape(round, ['round', 'stance', 'first', 'playerCount', 'enemyCount', 'playerCountRoll', 'enemyCountRoll', 'moves', 'playerAdvantage', 'enemyAdvantage', 'winChance', 'winner', 'consequence', 'consequenceWeights', 'retreat', 'consequenceDomain', 'bloodDukeOutcome', ...(replay.consequenceRoll === undefined ? [] : ['consequenceRoll'])])) return false;
    for (const key of ['playerCount', 'enemyCount', 'playerCountRoll', 'enemyCountRoll', 'first', 'retreat', 'winner', 'playerAdvantage', 'enemyAdvantage', 'winChance', 'consequenceWeights', 'consequenceRoll'] as const) if (!same(round[key], replay[key])) return false;
    const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
      .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
    return same(round.moves, moves);
  } catch { return false; }
}
function roundOpening(x: BloodDukeCombatSource): string {
  return `44岁的加雷斯·莫尔是独立银骑士，持自己原钢剑在2米外，健康${x.enemyHealth}、精神${x.enemyMind}、灵性${x.enemySpirituality}。同一诺拉已亲自走到室外；只有本人在攻击范围内，保护不会自动覆盖旁人。`;
}
export function bloodDukeCombatConsequence(round: SliceCombatRound): string {
  const o = round.bloodDukeOutcome; if (!o) throw new Error('缺少回合结果。'); let text: string;
  if (round.retreat === 'SUCCESS') text = '你通过撤离判定，将沿4米普通出口离开，对手仍在原处。';
  else {
    const loser = round.winner === 'PLAYER' ? 'ENEMY' : 'PLAYER', subject = loser === 'PLAYER' ? '你' : '加雷斯', risk = loser === 'PLAYER' ? o.playerRiskAfter : o.enemyRiskAfter;
    if (round.consequenceRoll === undefined) text = `${subject}本轮处于下风，但没有承受实际致伤攻击，没有新增身体伤势。累计风险${risk}。`;
    else {
      const weights = round.consequenceWeights!, severity = round.consequenceRoll <= weights.light ? 'LIGHT' : round.consequenceRoll <= weights.light + weights.heavy ? 'HEAVY' : 'DEATH';
      if (severity === 'DEATH') text = `${subject}伤势检验${round.consequenceRoll}/100，身体受到致命损伤，原身体留在室内。`;
      else { text = `${subject}伤势检验${round.consequenceRoll}/100，身体受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康减少${severity === 'LIGHT' ? 10 : 30}。`;
        if (o.playerHealthAfter === 0 || o.enemyHealth === 0) text += '健康降到0，伤者死亡。'; else if (o.enemyStatus === 'SURRENDERED') text += '加雷斯因重伤停止抵抗，把自己的钢剑放在脚边。'; }
    }
  }
  const whisper = o.playerActions.filter(a => a.id === INTERFERENCE).reduce((n, a) => n + a.appliedAmount, 0), chorus = o.playerActions.filter(a => a.id === RESTRAINT).reduce((n, a) => n + a.appliedAmount, 0);
  return roundOpening(o.source) + text + ` 本轮情绪干扰实际减势${whisper}，自我约束实际作用${chorus}；未触发准备不冒充实际生效。费用、原恶魔负荷、原伤及原对手结局保留，未用窗口随回合结束失效。`;
}
function publicBloodDukeAction(a: BloodDukePlayerAction | BloodDukeEnemyAction) { return {
  ...publicFields(a, ['label', 'selfGain', 'enemyReduction', 'threatens', 'mentalPressure', 'order', 'travelMetres', 'atSeconds', 'elapsedSeconds', 'paidCost', 'mindCost', 'physicalFactor', 'playerHealthAfter', 'playerMindAfter', 'playerSpiritualityAfter', 'enemySpiritualityAfter', 'chargeGranted', 'chargeConsumedByOrder', 'chargeCancelledByOrder', 'applied', 'appliedAmount']),
  rolls: [...a.rolls], consumedEffectOrders: [...a.consumedEffectOrders],
}; }
export function projectBloodDukePlayerAction(a: BloodDukePlayerAction) { return {
  ...publicBloodDukeAction(a), ...publicFields(a, ['id', 'attempted', 'succeeded', 'resisted', 'mode', 'prepared', 'strainCost']),
}; }
export function projectBloodDukeEnemyAction(a: BloodDukeEnemyAction) { return {
  ...publicBloodDukeAction(a), ...publicFields(a, ['planned', 'actual', 'attackKind', 'succeeded', 'emotionBefore', 'emotionAfter']),
}; }
export function projectBloodDukeRoundOutcome(o: BloodDukeRoundOutcome) { return {
  ...publicFields(o, ['targetId', 'round', 'stance', 'continuing', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'playerSpiritualityBefore', 'playerSpiritualityAfter', 'playerHealthAfter', 'playerMindAfter', 'enemySpiritualityBefore', 'playerRiskAfter', 'enemyRiskAfter', 'restraintAttempted', 'interferenceAttempted', 'guardAttempted', 'playerStrainAfter', 'emotionAfter', 'breathUses', 'clockSecondsAfter', 'elapsedSeconds']),
  playerInjuriesAfter: o.playerInjuriesAfter.map(publicPryerInjury), enemyInjuriesAfter: o.enemyInjuriesAfter.map(publicPryerInjury),
  powerUses: publicFields(o.powerUses, ['SILVER_THRUST', 'SILVER_ARMOR']), expiredEffectOrders: [...o.expiredEffectOrders], rootAfter: publicAbyssOriginalSite(o.rootAfter),
  playerActions: o.playerActions.map(projectBloodDukePlayerAction), enemyActions: o.enemyActions.map(projectBloodDukeEnemyAction),
}; }
export type BloodDukePublicRoundOutcome = ReturnType<typeof projectBloodDukeRoundOutcome>;
export function projectBloodDukeCombat(s: SliceState) {
  const e = s.bloodDuke.encounter, visible = isBloodDuke(s);
  const last = s.combat?.encounterId === 'BLOOD_DUKE_DISPUTE' ? s.combat.lastRound?.bloodDukeOutcome : e.terminal ? s.combatHistory[e.terminal.historyIndex]?.bloodDukeOutcome : null;
  return { enemyName: visible ? '加雷斯·莫尔（44岁，银骑士）' : '', targetId: visible ? e.targetId : null,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, maxSpirituality: 120,
    enemyHealth: visible ? e.enemyHealth : null, enemyMind: visible ? e.enemyMind : null, enemySpirituality: visible ? e.enemySpirituality : null,
    powerUses: visible ? { ...e.powerUses } : null, originalExit: true, pursuit: false, distanceMetres: s.blatherer.life.playerLocation === 'START' ? 6 : 2, automaticAllyImmunity: false,
    alliesPresent: visible ? Number(s.blatherer.life.volunteer.location !== 'OUTSIDE') + Number(s.blatherer.life.guide.location !== 'OUTSIDE') : 0,
    lastActionSequence: visible && last ? [...last.playerActions.map(a => ({ ...projectBloodDukePlayerAction(a), actor: 'PLAYER' as const })), ...last.enemyActions.map(a => ({ ...projectBloodDukeEnemyAction(a), actor: 'ENEMY' as const }))].sort((a, b) => a.order - b.order) : [],
    countWheel: BLOOD_DUKE_COUNT_WHEEL.map(x => ({ ...x })), enemyCountWheel: BLOOD_DUKE_ENEMY_COUNT_WHEEL.map(x => ({ ...x })), enemyAbilityWheel: BLOOD_DUKE_ENEMY_ABILITY_WHEEL.map(x => ({ ...x })),
    summary: visible ? '双方每轮1至6动作，每动作5秒，每轮60秒。沿用原有六槽相对权重；防守姿态用自我约束替换硬皮槽，控制姿态用情绪干扰替换低语槽。两项新能力各付6灵性、2精神，意志18，每轮各最多尝试一次；情绪干扰还可被抵抗。加雷斯能亲自平复情绪并清除未生效的干扰。未触发窗口在回合末结束，费用保留。只有继续交战时本人恢复12灵性，对手不恢复；身体伤势、死亡与原恶魔负荷均保留。' : '' };
}
export type BloodDukeCombatProjection = ReturnType<typeof projectBloodDukeCombat>;
