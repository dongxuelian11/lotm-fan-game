import { publicPryerFields, publicPryerInjury } from '../sage/life.js';
import { publicDarkAngelSite } from '../dark-angel/life.js';
import { publicThreeHeadedTemplarReserve } from '../three-headed-templar/combat.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { SHEPHERD_SPIRITS } from '../shepherd/content.js';
import type { ShepherdGrazing, ShepherdSpiritState } from '../shepherd/types.js';
import type { RoseBishopReserve } from '../rose-bishop/types.js';
import { THREE_HEADED_TEMPLAR_SPIRIT_SOURCES, type ThreeHeadedTemplarLifeState, type ThreeHeadedTemplarSpiritId } from '../three-headed-templar/life.js';
import { ELDER_TARGET_ID, ELDER_POWER_IDS, ELDER_POWERS, hasElderDisputeOpponent,
  validateElderPreparation, type ElderPreparation, type ElderEnemyIntent, type ElderPowerId } from './encounter.js';

/** Existing Hanged Man S3 costs, relative tickets and weighted core remain the source.
 * S2 supplies two bounded attempts; no additional soul or unknown ability is created. */
export const ELDER_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const ELDER_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const elderActionCount = pyromaniacActionCount;
export const elderEnemyActionCount = pyromaniacActionCount;
const WHISPER = 'hanged-man.s2.low-whisper', CHORUS = 'hanged-man.s2.focused-chorus';
const BLADE = 'hanged-man.s4.flesh-soul-blade', BODY = 'BODY_FOLLOWUP', WARD = 'BORROWED_WARD', SHADOW = 'hanged-man.s4.shadow-command', ART = 'hanged-man.s5.borrowed-arts';
const INHERITED_IDS = [BLADE, 'hanged-man.s6.flesh-shaping', ART] as const;
export type ElderMoveId = typeof WHISPER | typeof CHORUS | typeof BLADE | typeof BODY | typeof WARD | typeof SHADOW | typeof ART | 'ACCIDENT';
const ABILITIES: readonly { id: ElderMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: BLADE, label: '原灵肉之刃5灵性；不足时本人原棍或普通身体', weight: 30, stance: 'ATTACK' },
  { id: BODY, label: '继承身体次击27.3×旧血肉掌握×实际身体', weight: 15, stance: 'ATTACK' },
  { id: WARD, label: '原伊芮斯已选防护2灵性／3灵性与1实际储备修复／普通格挡', weight: 20, stance: 'DEFEND' },
  { id: SHADOW, label: '旧原影限制4灵性，知识18；下一普通身体打击减半', weight: 20, stance: 'CONTROL' },
  { id: ART, label: '当前原伊芮斯已选微力触动2灵性／普通复核', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差，优势−22.5', weight: 5, stance: null },
  { id: WHISPER, label: '低语6灵性、2精神；可被抵抗，只削弱随后一次实际攻势至多35', weight: 20, stance: 'CONTROL' },
  { id: CHORUS, label: '单灵聚声6本人灵性、2精神、3原灵灵性；失败总计4精神', weight: 20, stance: 'PREPARE' },
];
export const ELDER_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'SILVER_THRUST', label: '自有银白细剑6灵性、知识18；成功才形成有限攻势70', weight: 40 },
  { id: 'SILVER_ARMOR', label: '自有实体银甲6灵性、知识18；有限防护36', weight: 25 },
  { id: 'BODY_STRIKE', label: '自己的钢剑20×实际身体', weight: 30 },
  { id: 'ACCIDENT', label: '实际失衡，无伤害与消耗', weight: 5 },
];
export const isElder = (s: SliceState): boolean => s.progression.pathwayId === 'hanged-man' && s.progression.sequence === 2;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function elderAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, weight: weights[i]! / total * 100,
    label: stance === 'DEFEND' && [BLADE, BODY, ART].includes(a.id) ? '整轮专心防守，本槽不攻击、不消耗灵性' : a.label }));
}
function drawPlayer(random: ActionRandomStream, stance: SliceStance | null): ElderMoveId {
  const weights = tickets(stance); let n = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return a.id; } throw new Error('能力盘无效。');
}
export function drawElderAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): ElderMoveId { return drawPlayer(random, stance); }
export function drawElderEnemyAbility(random: ActionRandomStream): ElderEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of ELDER_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as ElderEnemyIntent; } throw new Error('对手行动盘无效。');
}
export interface ElderCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'ELDER_DISPUTE'; targetId: typeof ELDER_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetName: '巴斯蒂安·沃德'; targetAge: 46; targetPathway: 'warrior'; targetSequence: 3; targetCore: 20;
  actualBody: true; independentMind: true; enemyWeapon: 'EL2-BASTIAN-SWORD'; weaponLocation: 'HAND'; yardId: 'THT3-SEALED-COURT';
  playerPosition: 'A'; originalShadow: 'EL2-BASTIAN-SHADOW'; shadowLit: true; enemyDistanceMetres: 2; ordinaryExit: 'OPEN'; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  playerInjuries: SliceInjury[]; enemyInjuries: SliceInjury[]; playerRisk: number; enemyRisk: number;
  preparation: ElderPreparation; root: ThreeHeadedTemplarLifeState; grazing: ShepherdGrazing; shepherdPromotionWeek: number | null; reserve: RoseBishopReserve;
  inheritedMastery: Record<string, number>; clubHeld: boolean; playerClubId: 'town-short-club' | null;
  physique: number; perception: number; knowledge: number; will: number;
  powerUses: Record<ElderPowerId, number>; clockSeconds: number; randomSeed: string; randomCursor: number;
}
export interface ElderCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: false }
interface ActionEvidence extends ElderCombatEffect {
  order: number; travelMetres: number; atSeconds: number; elapsedSeconds: 5; paidCost: number; mindCost: number; physicalFactor: number; rolls: number[];
  randomCursorBefore: number; randomCursorAfter: number; playerHealthAfter: number; playerMindAfter: number; playerSpiritualityAfter: number; enemySpiritualityAfter: number;
  chargeGranted: boolean; chargeConsumedByOrder: number | null; chargeCancelledByOrder: number | null; applied: boolean; appliedAmount: number; consumedEffectOrders: number[];
}
export interface ElderPlayerAction extends ActionEvidence {
  id: ElderMoveId; attempted: boolean; succeeded: boolean; resisted: boolean; mode: string;
  prepared: 'WHISPER' | 'CHORUS' | 'SHADOW' | 'WARD' | null; reserveCost: number; healthRestored: number;
  borrowedSpiritId: string | null; borrowedMethod: string | null;
  spirit: null | { id: ThreeHeadedTemplarSpiritId; method: 'BRIEF_WARD' | 'STEADY_HOLD'; casketId: string; deathRecordId: string; spiritualityBefore: number; spiritualityAfter: number; spiritCost: 3; integrity: number };
}
export interface ElderEnemyAction extends ActionEvidence { planned: ElderEnemyIntent; actual: ElderEnemyIntent | 'OBSERVE'; attackKind: 'NONE' | 'BODY'; succeeded: boolean }
interface Runtime {
  playerS: number; playerM: number; playerH: number; enemyS: number; powers: Record<ElderPowerId, number>; clockSeconds: number;
  root: ThreeHeadedTemplarLifeState; reserve: RoseBishopReserve; whisperAttempted: boolean; chorusAttempted: boolean; guardAttempted: boolean;
  whisper: ElderPlayerAction | null; chorus: ElderPlayerAction | null; shadow: ElderPlayerAction | null; ward: ElderPlayerAction | null; guard: ElderEnemyAction | null;
}
export interface ElderRoundContext {
  source: ElderCombatSource; stance: SliceStance; finished: boolean; liveState: string; runtime: Runtime;
  playerActions: ElderPlayerAction[]; enemyActions: ElderEnemyAction[]; label: string; outcome: ElderRoundOutcome | null;
}
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]): boolean => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
const none = (label: string): ElderCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
const physicalAt = (health: number): number => health > 75 ? 1 : health > 50 ? .95 : health > 25 ? .9 : .8;
const masteryFactor = (v: number) => .65 + .35 * v / 500;
export function actualElderBorrowedSpirit(g: ShepherdGrazing, week: number, promotionWeek: number | null): ShepherdSpiritState | null {
  if (!g?.met || g.activeSpiritId === null || !Array.isArray(g.spirits) || g.spirits.length !== SHEPHERD_SPIRITS.length || new Set(g.spirits.map(x => x.id)).size !== g.spirits.length || !g.spirits.every(x => SHEPHERD_SPIRITS.some(o => o.id === x.id))) return null;
  const spirit = g.spirits.find(x => x.id === g.activeSpiritId), origin = SHEPHERD_SPIRITS.find(o => o.id === spirit?.id);
  if (!spirit || !origin || spirit.status !== 'GRAZED' || spirit.releasedWeek !== null || !integer(spirit.acquiredWeek, 1, week) || spirit.attemptWeek !== spirit.acquiredWeek || promotionWeek === null || spirit.acquiredWeek < promotionWeek ||
    !Array.isArray(spirit.selectedAbilities) || spirit.selectedAbilities.length < 1 || spirit.selectedAbilities.length > 3 || new Set(spirit.selectedAbilities).size !== spirit.selectedAbilities.length || !spirit.selectedAbilities.every(id => origin.knownAbilities.some(a => a.id === id))) return null;
  return spirit;
}
export function currentElderCombatSource(s: SliceState): ElderCombatSource | null {
  if (!hasElderDisputeOpponent(s) || s.elder.encounter.skyLight !== 'DAYLIGHT') return null;
  const e = s.elder.encounter, c = s.combat!, stats = s.character.coreStats;
  if (!e.preparation || !e.startRoot) return null;
  const playerClubId = s.town.clubLocation === 'HAND' ? 'town-short-club' : null;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'ELDER_DISPUTE', targetId: ELDER_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetName: '巴斯蒂安·沃德', targetAge: 46, targetPathway: 'warrior', targetSequence: 3, targetCore: 20,
    actualBody: true, independentMind: true, enemyWeapon: 'EL2-BASTIAN-SWORD', weaponLocation: 'HAND', yardId: 'THT3-SEALED-COURT', playerPosition: 'A', originalShadow: 'EL2-BASTIAN-SHADOW', shadowLit: true,
    enemyDistanceMetres: 2, ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality,
    playerInjuries: structuredClone(s.injuries), enemyInjuries: structuredClone(c.enemyInjuries), playerRisk: s.injuryRisk, enemyRisk: c.enemyRisk,
    preparation: structuredClone(e.preparation), root: structuredClone(s.threeHeadedTemplar.life), grazing: structuredClone(s.shepherd.grazing), shepherdPromotionWeek: s.shepherd.promotionWeek, reserve: structuredClone(s.roseBishop.reserve),
    inheritedMastery: Object.fromEntries(INHERITED_IDS.map(id => [id, s.progression.mastery[id]!])),
    clubHeld: playerClubId !== null, playerClubId, physique: stats.physique, perception: stats.perception, knowledge: stats.knowledge, will: stats.will,
    powerUses: { ...e.powerUses }, clockSeconds: s.threeHeadedTemplar.life.clockSeconds, randomSeed: s.random.seed, randomCursor: s.random.cursor };
}
function makeRuntime(x: ElderCombatSource): Runtime {
  return { playerS: x.playerSpirituality, playerM: x.playerMind, playerH: x.playerHealth, enemyS: x.enemySpirituality, powers: { ...x.powerUses }, clockSeconds: x.clockSeconds,
    root: structuredClone(x.root), reserve: structuredClone(x.reserve), whisperAttempted: false, chorusAttempted: false, guardAttempted: false, whisper: null, chorus: null, shadow: null, ward: null, guard: null };
}
function liveState(s: SliceState): string {
  return stableStringify({ spirituality: s.spirituality, mind: s.mind, enemySpirituality: s.elder.encounter.enemySpirituality, powerUses: s.elder.encounter.powerUses,
    preparation: s.elder.encounter.preparation, startRoot: s.elder.encounter.startRoot, historicalLife: s.elder.life, root: s.threeHeadedTemplar.life, grazing: s.shepherd.grazing, reserve: s.roseBishop.reserve,
    stats: s.character.coreStats, mastery: s.progression.mastery, club: s.town.clubLocation, originalEncounter: s.threeHeadedTemplar.encounter,
    sequence: s.progression.sequence, pathway: s.progression.pathwayId, status: s.status, city: s.world.city, activeEvent: s.activeEvent });
}
const roundOrigins = new WeakMap<ElderRoundContext, { source: string; stance: SliceStance }>();
function originalContext(r: ElderRoundContext): boolean { const origin = roundOrigins.get(r); return !!origin && origin.source === stableStringify(r.source) && origin.stance === r.stance; }
const dynamicSource = new Set(['playerHealth', 'playerMind', 'playerSpirituality', 'enemySpirituality', 'powerUses', 'clockSeconds', 'root', 'reserve']);
function validRound(s: SliceState, r: ElderRoundContext, supplied: ElderCombatSource | null): boolean {
  const actual = currentElderCombatSource(s);
  return originalContext(r) && !r.finished && actual !== null && supplied !== null && same(supplied, r.source) && r.liveState === liveState(s) && actual.playerHealth === r.runtime.playerH && actual.playerMind === r.runtime.playerM && actual.clockSeconds === r.runtime.clockSeconds &&
    same(actual.root, r.runtime.root) && same(actual.reserve, r.runtime.reserve) && Object.entries(r.source).every(([key, value]) => dynamicSource.has(key) || same(actual[key as keyof ElderCombatSource], value));
}
export function beginElderCombatRound(s: SliceState, stance: SliceStance, random: ActionRandomStream): ElderRoundContext {
  const source = currentElderCombatSource(s);
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance) || !source || !validSource(source) || random.seed !== source.randomSeed || random.cursor !== source.randomCursor) throw new Error('缺少当前原院、真实对手或资源。');
  const context: ElderRoundContext = { source, stance, finished: false, liveState: liveState(s), runtime: makeRuntime(source), playerActions: [], enemyActions: [], outcome: null, label: roundOpening(source) };
  roundOrigins.set(context, { source: stableStringify(source), stance }); return context;
}
export const createElderCombatRound = beginElderCombatRound;
function actionBase(r: Runtime, order: number, physical: number, cursor: number): ActionEvidence {
  return { ...none(''), order, travelMetres: 0, atSeconds: r.clockSeconds, elapsedSeconds: 5, paidCost: 0, mindCost: 0, physicalFactor: physical, rolls: [], randomCursorBefore: cursor, randomCursorAfter: cursor,
    playerHealthAfter: r.playerH, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, enemySpiritualityAfter: r.enemyS,
    chargeGranted: false, chargeConsumedByOrder: null, chargeCancelledByOrder: null, applied: false, appliedAmount: 0, consumedEffectOrders: [] };
}
function closeAction<T extends ActionEvidence>(a: T, r: Runtime, random: ActionRandomStream): T {
  r.clockSeconds += 5; r.root.clockSeconds = r.clockSeconds; a.randomCursorAfter = random.cursor; a.playerHealthAfter = r.playerH; a.playerMindAfter = r.playerM; a.playerSpiritualityAfter = r.playerS; a.enemySpiritualityAfter = r.enemyS;
  a.label += ` 本动作5秒；你余${r.playerS}灵性、${r.playerM}精神，对手余${r.enemyS}灵性。`; return a;
}
function consume(effect: ElderPlayerAction | ElderEnemyAction, a: ActionEvidence, amount: number, cancelled = false): void {
  a.consumedEffectOrders.push(effect.order);
  if (cancelled) { effect.chargeCancelledByOrder = a.order; effect.label += ` 第${a.order + 1}动作结束这次准备，费用不退。`; }
  else { effect.chargeConsumedByOrder = a.order; effect.appliedAmount = amount; effect.applied = amount > 0; effect.label += ` 第${a.order + 1}动作实际应用${amount}，仅这一次。`; }
}
function clearBorrowedWindow(r: Runtime, a: ElderPlayerAction): void {
  if (r.chorus) { consume(r.chorus, a, 0, true); r.chorus = null; }
  if (r.ward?.borrowedSpiritId) { consume(r.ward, a, 0, true); r.ward = null; }
}
function applyAttackWindows(r: Runtime, a: ElderPlayerAction): void {
  if (!a.threatens) return;
  if (r.guard) { const amount = Math.min(36, a.selfGain); consume(r.guard, a, amount); a.selfGain -= amount; r.guard = null; a.label += `对手银甲实际吸收${amount}，剩余攻势${a.selfGain}；`; }
  a.threatens = a.selfGain > 0; a.applied = a.threatens; a.appliedAmount = a.selfGain;
}
function playerAction(x: ElderCombatSource, r: Runtime, stance: SliceStance, id: ElderMoveId, physical: number, order: number, random: ActionRandomStream): ElderPlayerAction {
  const a: ElderPlayerAction = { ...actionBase(r, order, physical, random.cursor), id, attempted: false, succeeded: false, resisted: false, mode: 'ORDINARY', prepared: null, reserveCost: 0, healthRestored: 0, borrowedSpiritId: null, borrowedMethod: null, spirit: null };
  const check = (ability: 'knowledge' | 'will', difficulty: number, base = x[ability]) => { const roll = random.nextInt(1, 100); a.rolls.push(roll); return roll <= computeCheckChance({ ability, baseAbility: base, difficulty, modifiers: [] }); };
  const spirit = actualElderBorrowedSpirit(x.grazing, x.week, x.shepherdPromotionWeek), iris = (method: string) => spirit?.id === 'SH5-IRIS-1' && spirit.selectedAbilities.includes(method);
  if (stance === 'DEFEND' && [BLADE, BODY, ART].includes(id)) { a.mode = 'HOLD_GUARD'; a.label = '整轮专心防守，本槽不攻击，不消耗攻击资源。'; }
  else if (id === 'ACCIDENT') { a.selfGain = -22.5; a.label = '本次动作偏差，优势−22.5，不重抽。'; }
  else if (id === BODY) {
    a.selfGain = 27.3 * masteryFactor(x.inheritedMastery['hanged-man.s6.flesh-shaping']!) * physical; a.threatens = a.selfGain > 0;
    a.travelMetres = 4; r.root.playerTravelMetres += 4; a.mode = 'INHERITED_BODY'; a.label = `本人沿原地面近身2米并退回2米，继承身体次击27.3×旧血肉掌握×实际身体，攻势${a.selfGain}。`; applyAttackWindows(r, a);
  } else if (id === BLADE) {
    a.travelMetres = 4; r.root.playerTravelMetres += 4;
    if (r.playerS >= 5) { a.paidCost = 5; r.playerS -= 5; a.selfGain = 55 * masteryFactor(x.inheritedMastery[BLADE]!); a.mode = 'PAID_BLADE'; a.label = '旧灵肉之刃实付5灵性，沿实际地面近身2米挥击并退回2米；没有按名字判定敌人堕落或自动致死。'; }
    else { a.selfGain = (x.clubHeld ? 16 : 12) * physical; a.label = `不足5灵性，使用本人${x.clubHeld ? '原棍' : '普通身体'}。`; }
    a.threatens = a.selfGain > 0; applyAttackWindows(r, a);
  } else if (id === WARD) {
    if (r.ward) { a.mode = 'ALREADY_PREPARED'; a.label = '既有格挡等待一次实际攻击，不叠加或重复付费。'; }
    else if (iris('brief-ward') && r.playerS >= 2) {
      clearBorrowedWindow(r, a); a.paidCost = 2; r.playerS -= 2; a.borrowedSpiritId = 'SH5-IRIS-1'; a.borrowedMethod = 'brief-ward'; a.mode = 'OLD_IRIS'; a.prepared = 'WARD'; a.chargeGranted = true; r.ward = a;
      a.label = '原伊芮斯实际已选短促防护实付2灵性，只准备一次有限自保，实际攻击来临才记效果。';
    } else if (r.playerH > 0 && r.playerH < 100 && r.reserve.points > 0 && r.playerS >= 3) {
      a.paidCost = 3; r.playerS -= 3; a.reserveCost = 1; r.reserve.points--; a.healthRestored = Math.min(10, 100 - r.playerH); r.playerH += a.healthRestored; a.selfGain = 8; a.applied = true; a.appliedAmount = a.healthRestored; a.mode = 'OLD_RESERVE';
      a.label = `旧自修复实际支付3灵性与1既有储备，健康恢复${a.healthRestored}；旧伤仍在，没有复活或生成储备。`;
    } else { a.prepared = 'WARD'; a.chargeGranted = true; r.ward = a; a.label = '以实际身体准备一次普通格挡，至多10×身体；未遇攻击前实际效果为0。'; }
  } else if (id === SHADOW) {
    if (r.shadow) { a.mode = 'ALREADY_PREPARED'; a.label = '旧影缚已准备，不叠加或再次付费。'; }
    else if (r.playerS < 4) { a.mode = 'LOW_RESOURCE'; a.label = '不足4灵性，普通观察，无超凡效果。'; }
    else { a.attempted = true; a.paidCost = 4; r.playerS -= 4; a.succeeded = check('knowledge', 18); a.mode = a.succeeded ? 'PREPARED' : 'FAILED';
      if (a.succeeded) { a.chargeGranted = true; a.prepared = 'SHADOW'; r.shadow = a; }
      a.label = `旧原影限制实付4灵性，作用眼前真实身体在日光下的影子；${a.succeeded ? '仅准备下一普通身体打击减半' : '检定失败，无效果'}。`; }
  } else if (id === ART) {
    if (iris('light-touch') && r.playerS >= 2) { clearBorrowedWindow(r, a); a.paidCost = 2; r.playerS -= 2; a.borrowedSpiritId = 'SH5-IRIS-1'; a.borrowedMethod = 'light-touch'; a.selfGain = 38.025 * masteryFactor(x.inheritedMastery[ART]!); a.threatens = a.selfGain > 0; a.mode = 'OLD_IRIS'; a.label = '当前原伊芮斯实际已选微力触动实付2灵性；仅这一次冲击，不生成永久新能力。'; applyAttackWindows(r, a); }
    else a.label = '当前原灵没有已选微力触动或资源不足，只普通复核。';
  } else if (id === WHISPER) {
    if (r.whisperAttempted || r.playerS < 6 || r.playerM <= 2) { a.mode = 'ORDINARY_FALLBACK'; a.label = '本轮已尝试低语或资源不足，普通稳住呼吸，0超凡效果。'; }
    else { r.whisperAttempted = true; a.attempted = true; a.paidCost = 6; a.mindCost = 2; r.playerS -= 6; r.playerM -= 2;
      const known = check('will', 18); if (known) { const resistance = random.nextInt(1, 100); a.rolls.push(resistance); a.resisted = resistance <= 25; }
      a.succeeded = known && !a.resisted; if (a.succeeded) { a.prepared = 'WHISPER'; a.chargeGranted = true; r.whisper = a; }
      a.mode = a.succeeded ? 'PREPARED' : a.resisted ? 'RESISTED' : 'FAILED';
      a.label = `实付6灵性与2精神向眼前对手低语；${a.succeeded ? '只使随后一次实际攻势至多减35，等待实际触发' : a.resisted ? '对手抵抗，未生效' : '意志检定失败，未生效'}。没有控制身份、思想或健康。`; }
  } else if (id === CHORUS) {
    const chosen = (['THT3-HELENA', 'THT3-ROLAND'] as const).map(key => r.root.spirits[key]).find(sp => sp.status === 'GRAZED' && sp.location === 'INTERNAL' && !sp.interrupted && sp.integrity > 0 && sp.spirituality >= 3 && sp.acquiredWeek !== null && sp.releasedWeek === null && sp.selectedAbilities.includes(sp.id === 'THT3-HELENA' ? 'BRIEF_WARD' : 'STEADY_HOLD'));
    if (r.chorusAttempted || !chosen || r.playerS < 6 || r.playerM <= 4) { a.mode = 'ORDINARY_FALLBACK'; a.label = '本轮已尝试聚声，或没有实际已取得、已选方法且有资源的原灵；仅普通复核，不生成或补满灵魂。'; }
    else { clearBorrowedWindow(r, a); r.chorusAttempted = true; a.attempted = true; a.paidCost = 6; a.mindCost = 2; r.playerS -= 6; r.playerM -= 2;
      const before = chosen.spirituality; chosen.spirituality -= 3; const method = chosen.id === 'THT3-HELENA' ? 'BRIEF_WARD' : 'STEADY_HOLD';
      a.spirit = { id: chosen.id, method, casketId: chosen.casketId, deathRecordId: chosen.deathRecordId, spiritualityBefore: before, spiritualityAfter: chosen.spirituality, spiritCost: 3, integrity: chosen.integrity };
      a.borrowedSpiritId = chosen.id; a.borrowedMethod = method; const known = check('knowledge', 18);
      if (known) { const resistance = random.nextInt(1, 100); a.rolls.push(resistance); a.resisted = resistance <= 25; }
      a.succeeded = known && !a.resisted;
      if (!a.succeeded) { a.mindCost += 2; r.playerM -= 2; a.mode = a.resisted ? 'RESISTED' : 'FAILED'; }
      else if (method === 'BRIEF_WARD') { a.mode = 'PREPARED'; a.prepared = 'CHORUS'; a.chargeGranted = true; r.chorus = a; }
      else { a.mode = 'STEADY_HOLD'; a.selfGain = 16; a.applied = true; a.appliedAmount = 16; }
      a.label = `只聚焦同一${chosen.name}原灵实际已选${method}，本人实付6灵性、${a.mindCost}精神，原灵实付3灵性（${before}→${chosen.spirituality}）；${!a.succeeded ? '未成功生效，资源不退' : method === 'BRIEF_WARD' ? '只准备随后一次自保至多18' : '本人的当前真实握持稳定，优势16，不附赠伤害'}。原灵仍在体内；没有新增外放、永久借用槽或完整度恢复。`;
    }
  }
  return closeAction(a, r, random);
}
function enemyAction(x: ElderCombatSource, r: Runtime, planned: ElderEnemyIntent, physical: number, order: number, random: ActionRandomStream): ElderEnemyAction {
  const a: ElderEnemyAction = { ...actionBase(r, order, physical, random.cursor), planned, actual: planned, attackKind: 'NONE', succeeded: false };
  const power = ELDER_POWERS.find(p => p.id === planned);
  if (planned === 'SILVER_ARMOR' && r.guardAttempted) a.actual = 'OBSERVE'; else if (power && r.enemyS < power.cost) a.actual = 'BODY_STRIKE';
  if (a.actual === 'SILVER_THRUST' || a.actual === 'SILVER_ARMOR') {
    r.enemyS -= 6; r.powers[a.actual]++; a.paidCost = 6;
    const roll = random.nextInt(1, 100); a.rolls.push(roll); a.succeeded = roll <= computeCheckChance({ ability: 'knowledge', baseAbility: x.targetCore, difficulty: 18, modifiers: [] });
    if (a.actual === 'SILVER_ARMOR') r.guardAttempted = true;
    if (!a.succeeded) { a.label = '巴斯蒂安实付自己6灵性，但检定失败，能力没有成形。'; return closeAction(a, r, random); }
  }
  if (a.actual === 'SILVER_THRUST' || a.actual === 'BODY_STRIKE') {
    let raw = a.actual === 'SILVER_THRUST' ? 70 : 20 * physical;
    a.attackKind = 'BODY'; a.succeeded = true; if (a.actual === 'BODY_STRIKE') a.travelMetres = 4;
    a.label = a.actual === 'SILVER_THRUST' ? '巴斯蒂安实际施展已掌握的银白细剑，付自己6灵性；有限剑势70指向本人身体，不能保证致伤。' : `${planned !== 'BODY_STRIKE' ? '灵性不足，普通回退；' : ''}巴斯蒂安亲自靠近2米以自己原钢剑攻击，再退回2米，20×实际身体。`;
    if (a.actual === 'BODY_STRIKE' && r.shadow && raw > 0) { const amount = raw * .5; consume(r.shadow, a, amount); raw -= amount; r.shadow = null; }
    if (r.whisper && raw > 0) { const amount = Math.min(35, raw); consume(r.whisper, a, amount); raw -= amount; r.whisper = null; }
    if (r.chorus && raw > 0) { const amount = Math.min(18, raw); consume(r.chorus, a, amount); raw -= amount; r.chorus = null; }
    if (r.ward && raw > 0) { const amount = Math.min(raw, r.ward.borrowedSpiritId ? 30 * masteryFactor(x.inheritedMastery[ART]!) : 10 * r.ward.physicalFactor); consume(r.ward, a, amount); raw -= amount; r.ward = null; }
    a.selfGain = raw; a.appliedAmount = raw; a.threatens = raw > 0; a.applied = a.threatens;
  } else if (a.actual === 'SILVER_ARMOR') { a.chargeGranted = true; r.guard = a; a.label = '巴斯蒂安实付6灵性凝聚有限银甲，仅为随后一次真实攻击准备36防护；尚未受击时实际吸收为0。'; }
  else if (a.actual === 'OBSERVE') a.label = '本轮已经尝试银甲，只普通观察，0灵性与0攻势。';
  else a.label = '对手实际失衡，0灵性与0攻势，不恢复资源。';
  return closeAction(a, r, random);
}
function commitRuntime(s: SliceState, r: ElderRoundContext): void {
  const e = s.elder.encounter; s.health = r.runtime.playerH; s.mind = r.runtime.playerM; s.spirituality = r.runtime.playerS; e.enemySpirituality = r.runtime.enemyS;
  e.powerUses = { ...r.runtime.powers }; s.threeHeadedTemplar.life = structuredClone(r.runtime.root); s.roseBishop.reserve = structuredClone(r.runtime.reserve); r.liveState = liveState(s);
}
/** Replay the already committed prefix and the next scheduled draw before changing any resource.
 * This rejects skipped counts, wrong actor order, forged action IDs, extra draws and stale contexts.
 * The received stream must consume precisely the deterministic checks proved by the replay. */
function executeNext(s: SliceState, context: ElderRoundContext, actor: 'PLAYER' | 'ENEMY', planned: ElderMoveId | ElderEnemyIntent, physical: number, random: ActionRandomStream): ElderCombatEffect | null {
  const x = context.source, rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), runtime = makeRuntime(x);
  const remaining = { PLAYER: elderActionCount(rng.nextInt(1, 100)), ENEMY: elderEnemyActionCount(rng.nextInt(1, 100)) };
  const order = x.round % 2 === 1 ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: ElderPlayerAction[] = [], enemies: ElderEnemyAction[] = [], committed = context.playerActions.length + context.enemyActions.length;
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) {
    for (const next of order) {
      if (!remaining[next]) continue;
      if (next === 'PLAYER' && context.stance === 'RETREAT') {
        remaining.PLAYER = 0; if (rng.nextInt(1, 100) <= 50) return null; continue;
      }
      remaining[next]--;
      const index = players.length + enemies.length, id = next === 'PLAYER' ? drawPlayer(rng, context.stance) : drawElderEnemyAbility(rng);
      const factor = physicalAt(next === 'PLAYER' ? runtime.playerH : x.enemyHealth);
      if (index === committed && (next !== actor || id !== planned || factor !== physical || random.seed !== x.randomSeed || random.cursor !== rng.cursor ||
        !same(players, context.playerActions) || !same(enemies, context.enemyActions) || !same(runtime, context.runtime))) return null;
      const action = next === 'PLAYER'
        ? playerAction(x, runtime, context.stance, id as ElderMoveId, factor, index, rng)
        : enemyAction(x, runtime, id as ElderEnemyIntent, factor, index, rng);
      if (next === 'PLAYER') players.push(action as ElderPlayerAction); else enemies.push(action as ElderEnemyAction);
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
export function resolveElderCombatAbility(s: SliceState, id: ElderMoveId, physical: number, random: ActionRandomStream, r: ElderRoundContext, source: ElderCombatSource | null = r.source): ElderCombatEffect {
  if (!validRound(s, r, source) || !ABILITIES.some(a => a.id === id)) return none('当前人物、现场或资源不符，未执行动作。');
  return executeNext(s, r, 'PLAYER', id, physical, random) ?? none('行动顺序或随机来源不符，未执行动作。');
}
export function resolveElderEnemyAbility(s: SliceState, planned: ElderEnemyIntent, physical: number, random: ActionRandomStream, r: ElderRoundContext, source: ElderCombatSource | null = r.source): ElderCombatEffect {
  if (!validRound(s, r, source) || ![...ELDER_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned)) return none('对手、原钢剑或当前资源不符，未执行动作。');
  return executeNext(s, r, 'ENEMY', planned, physical, random) ?? none('行动顺序或随机来源不符，未执行动作。');
}
export interface ElderRoundOutcome {
  targetId: typeof ELDER_TARGET_ID; round: number; source: ElderCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number;
  playerInjuriesAfter: SliceInjury[]; enemyInjuriesAfter: SliceInjury[]; playerRiskAfter: number; enemyRiskAfter: number;
  powerUses: Record<ElderPowerId, number>; whisperAttempted: boolean; chorusAttempted: boolean; guardAttempted: boolean;
  expiredEffectOrders: number[]; rootAfter: ThreeHeadedTemplarLifeState; reserveAfter: RoseBishopReserve;
  clockSecondsAfter: number; elapsedSeconds: 60; randomCursorAfter: number;
  playerActions: ElderPlayerAction[]; enemyActions: ElderEnemyAction[];
}
export function finishElderCombatRound(s: SliceState, r: ElderRoundContext, continuing = true, randomCursorAfter = s.random.cursor): ElderRoundOutcome {
  const e = s.elder.encounter, c = s.combat;
  if (!originalContext(r) || r.finished || !c || c.encounterId !== 'ELDER_DISPUTE' || c.round !== r.source.round || r.liveState !== liveState(s)) throw new Error('回合已结束或当前实际资源被改写。');
  const outcome: ElderRoundOutcome = { targetId: ELDER_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus,
    playerSpiritualityBefore: r.source.playerSpirituality, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind, enemySpiritualityBefore: r.source.enemySpirituality,
    playerInjuriesAfter: structuredClone(s.injuries), enemyInjuriesAfter: structuredClone(c.enemyInjuries), playerRiskAfter: s.injuryRisk, enemyRiskAfter: c.enemyRisk,
    powerUses: { ...e.powerUses }, whisperAttempted: r.runtime.whisperAttempted, chorusAttempted: r.runtime.chorusAttempted, guardAttempted: r.runtime.guardAttempted,
    expiredEffectOrders: [r.runtime.whisper, r.runtime.chorus, r.runtime.shadow, r.runtime.ward, r.runtime.guard].filter((a): a is ElderPlayerAction | ElderEnemyAction => a !== null).map(a => a.order).sort((a, b) => a - b),
    rootAfter: { ...structuredClone(r.runtime.root), clockSeconds: r.source.clockSeconds + 60 }, reserveAfter: structuredClone(r.runtime.reserve),
    clockSecondsAfter: r.source.clockSeconds + 60, elapsedSeconds: 60, randomCursorAfter, playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
  if (!validateElderRoundOutcome(outcome)) throw new Error('回合动作、原灵、身体后果或随机结果无法复核，未提交结算。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  if (e.enemyStatus !== 'RESISTING') e.weaponLocation = 'COURT';
  s.threeHeadedTemplar.life = structuredClone(outcome.rootAfter); r.finished = true; r.outcome = outcome;
  r.runtime.whisper = r.runtime.chorus = r.runtime.shadow = r.runtime.ward = r.runtime.guard = null; return structuredClone(outcome);
}
export function elderRoundOutcome(r: ElderRoundContext): ElderRoundOutcome { if (!r.outcome) throw new Error('回合尚未结束。'); return structuredClone(r.outcome); }
const SOURCE_KEYS = ['runId', 'revision', 'week', 'round', 'encounterId', 'targetId', 'attemptWeek', 'startHistoryIndex', 'targetName', 'targetAge', 'targetPathway', 'targetSequence', 'targetCore', 'actualBody', 'independentMind', 'enemyWeapon', 'weaponLocation', 'yardId', 'playerPosition', 'originalShadow', 'shadowLit', 'enemyDistanceMetres', 'ordinaryExit', 'pursuit', 'thirdPartiesInArea', 'automaticAllyImmunity', 'playerHealth', 'playerMind', 'playerSpirituality', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'playerInjuries', 'enemyInjuries', 'playerRisk', 'enemyRisk', 'preparation', 'root', 'grazing', 'shepherdPromotionWeek', 'reserve', 'inheritedMastery', 'clubHeld', 'playerClubId', 'physique', 'perception', 'knowledge', 'will', 'powerUses', 'clockSeconds', 'randomSeed', 'randomCursor'] as const;
function validInjuries(v: SliceInjury[], revision: number): boolean {
  return Array.isArray(v) && new Set(v.map(i => i.id)).size === v.length && v.every(i => shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 && ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision, 1, revision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision, revision)));
}
function validReserve(r: RoseBishopReserve, week: number): boolean {
  return !!r && r.max === 3 && integer(r.points, 0, 3) && Array.isArray(r.packets) && r.packetsBought === r.packets.length && new Set(r.packets.map(p => p.id)).size === r.packets.length &&
    r.packets.every(p => /^rose-bishop-ration-[1-9]\d*$/.test(p.id) && integer(p.acquiredWeek, 1, week) && (p.status === 'HELD' ? p.consumedWeek === null : p.status === 'CONSUMED' && integer(p.consumedWeek, p.acquiredWeek, week))) && r.packets.filter(p => p.status === 'CONSUMED').length >= r.points;
}
function validSource(x: ElderCombatSource): boolean {
  const p = x.root;
  return shape(x, SOURCE_KEYS) && typeof x.runId === 'string' && x.runId.length > 0 && integer(x.revision) && integer(x.week, 1) && integer(x.round, 1) && integer(x.startHistoryIndex) && x.attemptWeek === x.week &&
    x.encounterId === 'ELDER_DISPUTE' && x.targetId === ELDER_TARGET_ID && x.targetName === '巴斯蒂安·沃德' && x.targetAge === 46 && x.targetPathway === 'warrior' && x.targetSequence === 3 && x.targetCore === 20 && x.actualBody === true && x.independentMind === true &&
    x.enemyWeapon === 'EL2-BASTIAN-SWORD' && x.weaponLocation === 'HAND' && x.yardId === 'THT3-SEALED-COURT' && x.playerPosition === 'A' && x.originalShadow === 'EL2-BASTIAN-SHADOW' && x.shadowLit === true && x.enemyDistanceMetres === 2 && x.ordinaryExit === 'OPEN' && x.pursuit === false && x.thirdPartiesInArea === 0 && x.automaticAllyImmunity === false &&
    [x.playerHealth, x.playerMind, x.enemyHealth, x.enemyMind].every(n => integer(n, 1, 100)) && x.enemyMind === 100 && [x.playerSpirituality, x.enemySpirituality].every(n => integer(n, 0, 120)) &&
    p?.siteId === 'THT3-SEALED-COURT' && p.playerLocation === 'A' && p.owner.id === 'THT3-MARA' && p.owner.age === 51 && p.owner.alive && p.owner.willing && p.owner.location === 'OUTSIDE' && p.card.location === 'TABLE' && p.shutter.state === 'CLOSED' && !p.lamp.on && p.clockSeconds === x.clockSeconds &&
    shape(p.spirits, ['THT3-HELENA', 'THT3-ROLAND']) && Object.values(p.spirits).every(sp => { const origin = THREE_HEADED_TEMPLAR_SPIRIT_SOURCES.find(o => o.id === sp.id); return !!origin && Object.entries(origin).every(([key, value]) => same(sp[key as keyof typeof sp], value)) && Array.isArray(sp.selectedAbilities) && sp.selectedAbilities.length <= 3 && new Set(sp.selectedAbilities).size === sp.selectedAbilities.length && sp.selectedAbilities.every(id => origin.knownAbilities.includes(id)) && ['SEALED', 'GRAZED', 'RELEASED', 'DISSIPATED'].includes(sp.status) && (sp.status !== 'GRAZED' || integer(sp.acquiredWeek, 1, x.week) && sp.releasedWeek === null && sp.location === 'INTERNAL') && integer(sp.spirituality, 0, 30) && integer(sp.integrity, 0, 100) && ['INTERNAL', 'RELEASED', 'DISSIPATED', 'SEALED'].includes(sp.location); }) &&
    validateElderPreparation(x.preparation) && x.preparation.week <= x.week && x.preparation.revision < x.revision && x.preparation.runId === x.runId && x.preparation.randomSeed === x.randomSeed && x.preparation.randomCursor <= x.randomCursor && x.clockSeconds === x.preparation.lifeClockSeconds + 6 + 60 * (x.round - 1) &&
    validReserve(x.reserve, x.week) && shape(x.inheritedMastery, INHERITED_IDS) && INHERITED_IDS.every(id => integer(x.inheritedMastery[id], 0, 500)) &&
    Array.isArray(x.grazing?.spirits) && x.grazing.spirits.length === SHEPHERD_SPIRITS.length && new Set(x.grazing.spirits.map(sp => sp.id)).size === SHEPHERD_SPIRITS.length && x.grazing.spirits.every(sp => SHEPHERD_SPIRITS.some(v => v.id === sp.id)) && (x.grazing.activeSpiritId === null || actualElderBorrowedSpirit(x.grazing, x.week, x.shepherdPromotionWeek) !== null) &&
    x.grazing.spirits.filter(sp => sp.status === 'GRAZED').length + Object.values(p.spirits).filter(sp => sp.status === 'GRAZED').length <= 7 &&
    ['town-short-club', null].includes(x.playerClubId) && x.clubHeld === (x.playerClubId !== null) && [x.physique, x.perception, x.knowledge, x.will].every(n => integer(n, 0, 500)) && integer(x.playerRisk) && integer(x.enemyRisk) && integer(x.clockSeconds) &&
    validInjuries(x.playerInjuries, x.revision) && validInjuries(x.enemyInjuries, x.revision) && shape(x.powerUses, ELDER_POWER_IDS) && ELDER_POWER_IDS.every(id => integer(x.powerUses[id])) &&
    x.powerUses.SILVER_ARMOR <= x.round - 1 && x.powerUses.SILVER_THRUST <= 6 * (x.round - 1) &&
    x.enemySpirituality === 120 - ELDER_POWERS.reduce((n, p) => n + p.cost * x.powerUses[p.id], 0) && typeof x.randomSeed === 'string' && x.randomSeed.length > 0 && x.randomSeed.length <= 256 && integer(x.randomCursor);
}
function sourcePenalty(current: number, maximum: number): number { const f = Math.max(0, Math.min(1, current / maximum)); return f > .75 ? 0 : f > .5 ? .05 : f > .25 ? .1 : .2; }
function sourceBase(core: number, health: number, mind: number, spirituality: number): number { return (1250 + Math.min(core, 250)) * (1 - Math.min(.4, sourcePenalty(health, 100) + sourcePenalty(mind, 100) + sourcePenalty(spirituality, 120))); }
function sourceWeights(risk: number): { light: number; heavy: number; death: number } { const death = Math.min(100, 5 + Math.min(risk, 10) * 10), shifted = death - 5; return { light: Math.max(0, 65 - shifted), heavy: Math.max(0, 30 - Math.max(0, shifted - 65)), death }; }
interface ReplayedRound {
  outcome: ElderRoundOutcome; playerCount: number; enemyCount: number; playerCountRoll: number; enemyCountRoll: number; first: 'PLAYER' | 'ENEMY';
  retreat: 'NONE' | 'SUCCESS' | 'FAILURE'; winner: 'PLAYER' | 'ENEMY'; playerAdvantage: number; enemyAdvantage: number; winChance: number;
  consequenceWeights: { light: number; heavy: number; death: number } | null; consequenceRoll?: number;
}
/** Deterministic full-round replay checks both draws, ordered costs, pending flags, cancelled windows,
 * paid bodily energy, actual injury/death results and unmodified public labels. Extra fields fail equality. */
function replayOutcome(o: ElderRoundOutcome): ReplayedRound | null {
  const x = o?.source;
  if (!x || !validSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) || !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) || o.playerActions.length > 6 || o.enemyActions.length > 6) return null;
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = makeRuntime(x);
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = elderActionCount(playerCountRoll), enemyCount = elderEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const, remaining = { PLAYER: playerCount, ENEMY: enemyCount };
  const players: ElderPlayerAction[] = [], enemies: ElderEnemyAction[] = []; let retreat: ReplayedRound['retreat'] = 'NONE';
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) {
    for (const actor of order) {
      if (remaining[actor] === 0) continue;
      if (actor === 'PLAYER' && o.stance === 'RETREAT') { remaining.PLAYER = 0; retreat = rng.nextInt(1, 100) <= 50 ? 'SUCCESS' : 'FAILURE'; if (retreat === 'SUCCESS') { remaining.ENEMY = 0; break; } continue; }
      remaining[actor]--;
      if (actor === 'PLAYER') players.push(playerAction(x, r, o.stance, drawPlayer(rng, o.stance), physicalAt(r.playerH), players.length + enemies.length, rng));
      else enemies.push(enemyAction(x, r, drawElderEnemyAbility(rng), physicalAt(x.enemyHealth), players.length + enemies.length, rng));
    }
  }
  if (!same(players, o.playerActions) || !same(enemies, o.enemyActions)) return null;
  const sum = (actions: { selfGain: number; enemyReduction: number }[], key: 'selfGain' | 'enemyReduction') => actions.reduce((n, a) => n + a[key], 0);
  const playerAdvantage = Math.max(125, sourceBase(x.physique * .50 + x.perception * .20 + x.will * .20 + x.knowledge * .10, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, sourceBase(20, x.enemyHealth, x.enemyMind, x.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction')), winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100;
  const winner = retreat === 'SUCCESS' ? 'ENEMY' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  let playerHealth = r.playerH, enemyHealth = x.enemyHealth, playerRisk = x.playerRisk, enemyRisk = x.enemyRisk;
  let enemyStatus: ElderRoundOutcome['enemyStatus'] = 'RESISTING', continuing = retreat !== 'SUCCESS';
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
  const expected: ElderRoundOutcome = { targetId: ELDER_TARGET_ID, round: x.round, source: structuredClone(x), stance: o.stance, continuing,
    enemyHealth, enemyMind: x.enemyMind, enemySpirituality: r.enemyS, enemyStatus,
    playerSpiritualityBefore: x.playerSpirituality, playerSpiritualityAfter: r.playerS, playerHealthAfter: playerHealth, playerMindAfter: r.playerM, enemySpiritualityBefore: x.enemySpirituality,
    playerInjuriesAfter: playerInjuries, enemyInjuriesAfter: enemyInjuries, playerRiskAfter: playerRisk, enemyRiskAfter: enemyRisk, powerUses: r.powers,
    whisperAttempted: r.whisperAttempted, chorusAttempted: r.chorusAttempted, guardAttempted: r.guardAttempted,
    expiredEffectOrders: [r.whisper, r.chorus, r.shadow, r.ward, r.guard].filter((a): a is ElderPlayerAction | ElderEnemyAction => a !== null).map(a => a.order).sort((a, b) => a - b),
    rootAfter: { ...structuredClone(r.root), clockSeconds: x.clockSeconds + 60 }, reserveAfter: structuredClone(r.reserve),
    clockSecondsAfter: x.clockSeconds + 60, elapsedSeconds: 60, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies };
  if (!same(o, expected)) return null;
  return { outcome: expected, playerCount, enemyCount, playerCountRoll, enemyCountRoll, first, retreat, winner, playerAdvantage, enemyAdvantage, winChance, consequenceWeights, ...(consequenceRoll === undefined ? {} : { consequenceRoll }) };
}
export function validateElderRoundOutcome(value: unknown): value is ElderRoundOutcome { try { return replayOutcome(value as ElderRoundOutcome) !== null; } catch { return false; } }
export function validateElderCombatRound(round: SliceCombatRound): boolean {
  try {
    const o = round.elderOutcome, replay = o ? replayOutcome(o) : null;
    if (!o || !replay || round.round !== o.round || round.stance !== o.stance || round.consequenceDomain !== 'BODY' || round.consequence !== elderCombatConsequence(round) || !shape(round, ['round', 'stance', 'first', 'playerCount', 'enemyCount', 'playerCountRoll', 'enemyCountRoll', 'moves', 'playerAdvantage', 'enemyAdvantage', 'winChance', 'winner', 'consequence', 'consequenceWeights', 'retreat', 'consequenceDomain', 'elderOutcome', ...(replay.consequenceRoll === undefined ? [] : ['consequenceRoll'])])) return false;
    for (const key of ['playerCount', 'enemyCount', 'playerCountRoll', 'enemyCountRoll', 'first', 'retreat', 'winner', 'playerAdvantage', 'enemyAdvantage', 'winChance', 'consequenceWeights', 'consequenceRoll'] as const) if (!same(round[key], replay[key])) return false;
    const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
      .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
    return same(round.moves, moves);
  } catch { return false; }
}
function roundOpening(x: ElderCombatSource): string {
  return `46岁的巴斯蒂安·沃德是独立银骑士，持自己原钢剑在2米外，健康${x.enemyHealth}、精神${x.enemyMind}、灵性${x.enemySpirituality}。同一玛拉已亲自走到院外；只有本人在攻击范围内，保护不会自动覆盖旁人。`;
}
export function elderCombatConsequence(round: SliceCombatRound): string {
  const o = round.elderOutcome; if (!o) throw new Error('缺少回合结果。'); let text: string;
  if (round.retreat === 'SUCCESS') text = '你通过撤离判定，将沿4米普通出口离开，对手仍在原处。';
  else {
    const loser = round.winner === 'PLAYER' ? 'ENEMY' : 'PLAYER', subject = loser === 'PLAYER' ? '你' : '巴斯蒂安', risk = loser === 'PLAYER' ? o.playerRiskAfter : o.enemyRiskAfter;
    if (round.consequenceRoll === undefined) text = `${subject}本轮处于下风，但没有承受实际致伤攻击，没有新增身体伤势。累计风险${risk}。`;
    else {
      const weights = round.consequenceWeights!, severity = round.consequenceRoll <= weights.light ? 'LIGHT' : round.consequenceRoll <= weights.light + weights.heavy ? 'HEAVY' : 'DEATH';
      if (severity === 'DEATH') text = `${subject}伤势检验${round.consequenceRoll}/100，身体受到致命损伤，原身体留在院内。`;
      else { text = `${subject}伤势检验${round.consequenceRoll}/100，身体受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康减少${severity === 'LIGHT' ? 10 : 30}。`;
        if (o.playerHealthAfter === 0 || o.enemyHealth === 0) text += '健康降到0，伤者死亡。'; else if (o.enemyStatus === 'SURRENDERED') text += '巴斯蒂安因重伤停止抵抗，把自己的钢剑放在脚边。'; }
    }
  }
  const whisper = o.playerActions.filter(a => a.id === WHISPER).reduce((n, a) => n + a.appliedAmount, 0), chorus = o.playerActions.filter(a => a.id === CHORUS).reduce((n, a) => n + a.appliedAmount, 0);
  return roundOpening(o.source) + text + ` 本轮低语实际减势${whisper}，单灵聚声实际作用${chorus}；未触发准备不冒充实际生效。费用、原灵灵性与完整度、原伤及原对手结局保留，未用窗口随回合结束失效。`;
}
export function projectElderCombat(s: SliceState) {
  const e = s.elder.encounter, visible = isElder(s);
  const last = s.combat?.encounterId === 'ELDER_DISPUTE' ? s.combat.lastRound?.elderOutcome : e.terminal ? s.combatHistory[e.terminal.historyIndex]?.elderOutcome : null;
  return { enemyName: visible ? '巴斯蒂安·沃德（46岁，银骑士）' : '', targetId: visible ? e.targetId : null,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, maxSpirituality: 120,
    enemyHealth: visible ? e.enemyHealth : null, enemyMind: visible ? e.enemyMind : null, enemySpirituality: visible ? e.enemySpirituality : null,
    powerUses: visible ? { ...e.powerUses } : null, originalExit: true, pursuit: false, distanceMetres: 2, automaticAllyImmunity: false, alliesPresent: 0,
    lastActionSequence: visible && last ? [...last.playerActions.map(a => ({ ...projectElderPlayerAction(a), actor: 'PLAYER' as const })), ...last.enemyActions.map(a => ({ ...projectElderEnemyAction(a), actor: 'ENEMY' as const }))].sort((a, b) => a.order - b.order) : [],
    countWheel: ELDER_COUNT_WHEEL.map(x => ({ ...x })), enemyCountWheel: ELDER_ENEMY_COUNT_WHEEL.map(x => ({ ...x })), enemyAbilityWheel: ELDER_ENEMY_ABILITY_WHEEL.map(x => ({ ...x })),
    summary: visible ? '双方每轮1至6次动作，每动作5秒，每轮60秒。低语每轮一次：6灵性、2精神，意志18并可被抵抗，仅准备随后一次减势至多35。聚声每轮一次：6本人灵性、2精神、3实际原灵灵性，知识18并可被抵抗，失败总计4精神；只用一位实际原灵已选的一项方法。借用不并行、不复制能力；资源不足则普通行动。本人沿用既有12灵性续战恢复，对手与原灵不恢复。死亡和伤势仍由共同身体后果规则处理。' : '' };
}
export type ElderCombatProjection = ReturnType<typeof projectElderCombat>;


function publicElderAction(a: ElderPlayerAction | ElderEnemyAction) { return {
  ...publicPryerFields(a, ['label', 'selfGain', 'enemyReduction', 'threatens', 'mentalPressure', 'order', 'travelMetres', 'atSeconds', 'elapsedSeconds', 'paidCost', 'mindCost', 'physicalFactor', 'playerHealthAfter', 'playerMindAfter', 'playerSpiritualityAfter', 'enemySpiritualityAfter', 'chargeGranted', 'chargeConsumedByOrder', 'chargeCancelledByOrder', 'applied', 'appliedAmount']),
  rolls: [...a.rolls], consumedEffectOrders: [...a.consumedEffectOrders],
}; }
export function projectElderPlayerAction(a: ElderPlayerAction) { return {
  ...publicElderAction(a), ...publicPryerFields(a, ['id', 'attempted', 'succeeded', 'resisted', 'mode', 'prepared', 'reserveCost', 'healthRestored', 'borrowedSpiritId', 'borrowedMethod']),
  spirit: a.spirit ? publicPryerFields(a.spirit, ['id', 'method', 'casketId', 'deathRecordId', 'spiritualityBefore', 'spiritualityAfter', 'spiritCost', 'integrity']) : null,
}; }
export function projectElderEnemyAction(a: ElderEnemyAction) { return {
  ...publicElderAction(a), ...publicPryerFields(a, ['planned', 'actual', 'attackKind', 'succeeded']),
}; }
export function projectElderRoundOutcome(o: ElderRoundOutcome) { return {
  ...publicPryerFields(o, ['targetId', 'round', 'stance', 'continuing', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'playerSpiritualityBefore', 'playerSpiritualityAfter', 'playerHealthAfter', 'playerMindAfter', 'enemySpiritualityBefore', 'playerRiskAfter', 'enemyRiskAfter', 'whisperAttempted', 'chorusAttempted', 'guardAttempted', 'clockSecondsAfter', 'elapsedSeconds']),
  playerInjuriesAfter: o.playerInjuriesAfter.map(publicPryerInjury), enemyInjuriesAfter: o.enemyInjuriesAfter.map(publicPryerInjury),
  powerUses: publicPryerFields(o.powerUses, ['SILVER_THRUST', 'SILVER_ARMOR']), expiredEffectOrders: [...o.expiredEffectOrders],
  rootAfter: { ...publicDarkAngelSite(o.rootAfter), playerLocation: o.rootAfter.playerLocation }, reserveAfter: publicThreeHeadedTemplarReserve(o.reserveAfter),
  playerActions: o.playerActions.map(projectElderPlayerAction), enemyActions: o.enemyActions.map(projectElderEnemyAction),
}; }
export type ElderPublicRoundOutcome = ReturnType<typeof projectElderRoundOutcome>;
