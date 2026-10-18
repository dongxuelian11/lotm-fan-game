import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import { SHEPHERD_SPIRITS } from '../shepherd/content.js';
import type { ShepherdGrazing, ShepherdSpiritState } from '../shepherd/types.js';
import type { RoseBishopReserve } from '../rose-bishop/types.js';
import type { SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { advanceThreeHeadedTemplarLifeClock, applyThreeHeadedTemplarCombatSpiritEvent, validateThreeHeadedTemplarSpiritSources,
  type ThreeHeadedTemplarSpirits, type ThreeHeadedTemplarSpiritId, type ThreeHeadedTemplarCombatSpiritEvent } from './life.js';
import { THREE_HEADED_TEMPLAR_TARGET_ID, THREE_HEADED_TEMPLAR_POWERS, THREE_HEADED_TEMPLAR_POWER_IDS, hasThreeHeadedTemplarDisputeOpponent,
  type ThreeHeadedTemplarEnemyIntent, type ThreeHeadedTemplarPowerId, type ThreeHeadedTemplarEncounterScene } from './encounter.js';

/** Finite G adaptation. New external originals add no new mastery multiplier or free soul library. */
export const THREE_HEADED_TEMPLAR_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const THREE_HEADED_TEMPLAR_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const threeHeadedTemplarActionCount = pyromaniacActionCount;
export const threeHeadedTemplarEnemyActionCount = pyromaniacActionCount;
const BLADE = 'hanged-man.s4.flesh-soul-blade', BODY = 'BODY_FOLLOWUP', WARD = 'BORROWED_WARD', SHADOW = 'hanged-man.s4.shadow-command', ART = 'hanged-man.s5.borrowed-arts';
const MASTERY_IDS = [BLADE, 'hanged-man.s6.flesh-shaping', ART] as const;
export type ThreeHeadedTemplarMoveId = typeof BLADE | typeof BODY | typeof WARD | typeof SHADOW | typeof ART | 'ACCIDENT';
const ABILITIES: readonly { id: ThreeHeadedTemplarMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: BLADE, label: '旧灵肉之刃5S／本人原棍或身体（H30；55×旧掌握，G）', weight: 30, stance: 'ATTACK' },
  { id: BODY, label: '继承身体次击27.3×旧血肉掌握×身体（J15，G）', weight: 15, stance: 'ATTACK' },
  { id: WARD, label: '当前原伊芮斯已选防护2S／实际自修复3S＋1旧储备／普通格挡（B20，G）', weight: 20, stance: 'DEFEND' },
  { id: SHADOW, label: '旧原影限制4S/知识18，下一正身体打击×0.5（K20，G）', weight: 20, stance: 'CONTROL' },
  { id: ART, label: '当前唯一原伊芮斯已选微力触动2S／普通复核（R10，G）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差固定−22.5（5，G）', weight: 5, stance: null },
];
export const THREE_HEADED_TEMPLAR_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '原有限弧光5S/70G', weight: 35 },
  { id: 'WARD', label: '原有限屏护4S/减势30G', weight: 25 },
  { id: 'BODY_STRIKE', label: '自己的原棍20×身体G', weight: 20 },
  { id: 'LIGHT_BREAK', label: '原光束6S：驱回一个实际外放原灵；无原灵普通观察0S', weight: 15 },
  { id: 'ACCIDENT', label: '实际失衡0贡献/0S', weight: 5 },
];
export const isThreeHeadedTemplar = (s: SliceState): boolean => s.progression.pathwayId === 'hanged-man' && s.progression.sequence === 3;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function threeHeadedTemplarAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0), spirit = actualBorrowedSpirit(s.shepherd.grazing, s.week, s.shepherd.promotionWeek);
  return ABILITIES.map((a, i) => ({ id: a.id, weight: total === 400 ? weights[i]! / 4 : weights[i]! / total * 100,
    label: a.id === ART && !(spirit?.id === 'SH5-IRIS-1' && spirit.selectedAbilities.includes('light-touch')) ? '当前原伊芮斯未提供已选微力触动：普通复核0贡献/0S，不切换或复活原灵' : a.label }));
}
export function drawThreeHeadedTemplarAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): ThreeHeadedTemplarMoveId {
  let roll = random.nextInt(1, tickets(stance).reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { roll -= tickets(stance)[i]!; if (roll <= 0) return a.id; }
  throw new Error('三首圣堂能力盘权重无效。');
}
export function drawThreeHeadedTemplarEnemyAbility(random: ActionRandomStream): ThreeHeadedTemplarEnemyIntent {
  let roll = random.nextInt(1, 100);
  for (const a of THREE_HEADED_TEMPLAR_ENEMY_ABILITY_WHEEL) { roll -= a.weight; if (roll <= 0) return a.id as ThreeHeadedTemplarEnemyIntent; }
  throw new Error('原布拉姆动作盘权重无效。');
}
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const bounded = (v: number, max: number) => Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0;
const masteryFactor = (v: number) => .65 + .35 * bounded(v, 500) / 500;
/** Existing selected S5 methods only. The two S3 originals are never added to the master's borrowing library. */
function actualBorrowedSpirit(g: ShepherdGrazing, week: number, promotionWeek: number | null): ShepherdSpiritState | null {
  if (!g?.met || g.activeSpiritId === null || !Array.isArray(g.spirits) || g.spirits.length !== SHEPHERD_SPIRITS.length || new Set(g.spirits.map(x => x.id)).size !== g.spirits.length || !g.spirits.every(x => SHEPHERD_SPIRITS.some(o => o.id === x.id))) return null;
  const spirit = g.spirits.find(x => x.id === g.activeSpiritId), origin = SHEPHERD_SPIRITS.find(o => o.id === spirit?.id);
  if (!spirit || !origin || spirit.status !== 'GRAZED' || spirit.releasedWeek !== null || !integer(spirit.acquiredWeek, 1, week) || spirit.attemptWeek !== spirit.acquiredWeek || promotionWeek === null || spirit.acquiredWeek < promotionWeek ||
    !Array.isArray(spirit.selectedAbilities) || spirit.selectedAbilities.length < 1 || spirit.selectedAbilities.length > 3 || new Set(spirit.selectedAbilities).size !== spirit.selectedAbilities.length || !spirit.selectedAbilities.every(id => origin.knownAbilities.some(a => a.id === id))) return null;
  return spirit;
}
function validReserve(r: RoseBishopReserve, week: number): boolean {
  return !!r && r.max === 3 && integer(r.points, 0, 3) && Array.isArray(r.packets) && r.packetsBought === r.packets.length && new Set(r.packets.map(p => p.id)).size === r.packets.length &&
    r.packets.every(p => /^rose-bishop-ration-[1-9]\d*$/.test(p.id) && integer(p.acquiredWeek, 1, week) && (p.status === 'HELD' ? p.consumedWeek === null : p.status === 'CONSUMED' && integer(p.consumedWeek, p.acquiredWeek, week))) && r.packets.filter(p => p.status === 'CONSUMED').length >= r.points;
}
const spiritIds = ['THT3-HELENA', 'THT3-ROLAND'] as const;
const externalIds = (spirits: ThreeHeadedTemplarSpirits) => spiritIds.filter(id => spirits[id].status === 'GRAZED' && spirits[id].location === 'COURT' && spirits[id].integrity > 0);
export interface ThreeHeadedTemplarCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'THREE_HEADED_TEMPLAR_DISPUTE'; targetId: typeof THREE_HEADED_TEMPLAR_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetAge: 49; targetSequence: 3; targetPhysique: 20; actualOriginalBody: true; independentMind: true;
  enemyWeapon: 'THT3-BRAM-ROD'; weaponLocation: 'HAND'; distanceMetres: 4; space: 'THT3-COURT'; originalShadow: 'THT3-BRAM-SHADOW'; shadowLit: true;
  abilitySource: 'ORIGINAL_LIMITED_G'; ordinaryExit: true; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyInjuries: SliceInjury[]; enemyRisk: number; clubHeld: boolean; knowledge: number; lifeClockSeconds: number;
  mastery: Record<string, number>; grazing: ShepherdGrazing; shepherdPromotionWeek: number | null; reserve: RoseBishopReserve; spirits: ThreeHeadedTemplarSpirits;
  scene: ThreeHeadedTemplarEncounterScene; powerUses: Record<ThreeHeadedTemplarPowerId, number>;
}
export function currentThreeHeadedTemplarCombatSource(s: SliceState): ThreeHeadedTemplarCombatSource | null {
  if (!hasThreeHeadedTemplarDisputeOpponent(s) || !validReserve(s.roseBishop.reserve, s.week) || !validateThreeHeadedTemplarSpiritSources(s.threeHeadedTemplar.life.spirits, s.week)) return null;
  const e = s.threeHeadedTemplar.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'THREE_HEADED_TEMPLAR_DISPUTE', targetId: THREE_HEADED_TEMPLAR_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetAge: 49, targetSequence: 3, targetPhysique: 20, actualOriginalBody: true, independentMind: true,
    enemyWeapon: 'THT3-BRAM-ROD', weaponLocation: 'HAND', distanceMetres: 4, space: 'THT3-COURT', originalShadow: 'THT3-BRAM-SHADOW', shadowLit: true,
    abilitySource: 'ORIGINAL_LIMITED_G', ordinaryExit: true, pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality,
    enemyInjuries: structuredClone(c.enemyInjuries), enemyRisk: c.enemyRisk, clubHeld: s.town.clubLocation === 'HAND', knowledge: s.character.coreStats.knowledge,
    lifeClockSeconds: s.threeHeadedTemplar.life.clockSeconds, mastery: Object.fromEntries(MASTERY_IDS.map(id => [id, s.progression.mastery[id] ?? 0])),
    grazing: structuredClone(s.shepherd.grazing), shepherdPromotionWeek: s.shepherd.promotionWeek, reserve: structuredClone(s.roseBishop.reserve),
    spirits: structuredClone(s.threeHeadedTemplar.life.spirits), scene: structuredClone(e.scene), powerUses: { ...e.powerUses } };
}
export interface ThreeHeadedTemplarCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: false }
export interface ThreeHeadedTemplarSupportAction {
  spiritId: ThreeHeadedTemplarSpiritId; method: 'BRIEF_WARD' | 'STEADY_HOLD'; casketId: string; deathRecordId: string;
  paidCost: 1; spiritCost: 3; spiritualityBefore: number; spiritualityAfter: number; integrity: number;
  selfGain: number; enemyReduction: number; label: string;
}
interface ActionEvidence extends ThreeHeadedTemplarCombatEffect { order: number; paidCost: number; physicalFactor: number; rolls: number[]; mode: string }
export interface ThreeHeadedTemplarPlayerAction extends ActionEvidence {
  id: ThreeHeadedTemplarMoveId;
  reserveCost: number; healthRestored: number; shadowPrepared: boolean; borrowedSpiritId: 'SH5-IRIS-1' | null; borrowedMethod: 'brief-ward' | 'light-touch' | null;
  supportActions: ThreeHeadedTemplarSupportAction[]; abilitySelfGain: number; abilityEnemyReduction: number;
}
export interface ThreeHeadedTemplarEnemyAction extends ActionEvidence {
  planned: ThreeHeadedTemplarEnemyIntent; actual: ThreeHeadedTemplarEnemyIntent; shadowConsumed: boolean;
  interruptedSpiritId: ThreeHeadedTemplarSpiritId | null; integrityBefore: number | null; integrityAfter: number | null; recallSeconds: number;
}
export interface ThreeHeadedTemplarRoundContext {
  source: ThreeHeadedTemplarCombatSource; stance: SliceStance; finished: boolean; liveState: string;
  playerActions: ThreeHeadedTemplarPlayerAction[]; enemyActions: ThreeHeadedTemplarEnemyAction[];
  label: string; outcome: ThreeHeadedTemplarRoundOutcome | null; recallSeconds: number;
}
const none = (label: string): ThreeHeadedTemplarCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
function liveState(s: SliceState): string {
  return stableStringify({ spirituality: s.spirituality, mind: s.mind, encounter: s.threeHeadedTemplar.encounter, reserve: s.roseBishop.reserve,
    spirits: s.threeHeadedTemplar.life.spirits, clockSeconds: s.threeHeadedTemplar.life.clockSeconds });
}
const dynamicSource = new Set(['playerHealth', 'playerSpirituality', 'enemySpirituality', 'powerUses', 'reserve', 'spirits']);
function validRound(s: SliceState, r: ThreeHeadedTemplarRoundContext, supplied: ThreeHeadedTemplarCombatSource | null): boolean {
  const actual = currentThreeHeadedTemplarCombatSource(s);
  return !r.finished && actual !== null && supplied !== null && same(supplied, r.source) && r.liveState === liveState(s) &&
    s.health === r.source.playerHealth + r.playerActions.reduce((n, a) => n + a.healthRestored, 0) &&
    Object.entries(r.source).every(([key, value]) => dynamicSource.has(key) || same(actual[key as keyof ThreeHeadedTemplarCombatSource], value));
}
export function beginThreeHeadedTemplarCombatRound(s: SliceState, stance: SliceStance, _random?: ActionRandomStream): ThreeHeadedTemplarRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('三首圣堂战斗姿态无效。');
  const source = currentThreeHeadedTemplarCombatSource(s);
  if (!source || s.threeHeadedTemplar.encounter.shadowReady) throw new Error('缺少同一原布拉姆、原棍与连续回合，或上一轮原影限制未结束。');
  return { source, stance, finished: false, liveState: liveState(s), playerActions: [], enemyActions: [], outcome: null, recallSeconds: 0,
    label: `49岁原布拉姆在净空原院4米外持自己的唯一原棍，独立S${source.enemySpirituality}/120。两原灵只在实际外放且有已选方法与资源时，于本人本轮首次动作前各付一次协作；强光按先后手驱回一灵，不撤销已发生效果。` };
}
export const createThreeHeadedTemplarCombatRound = beginThreeHeadedTemplarCombatRound;
interface Resources { playerS: number; playerH: number; enemyS: number; reserve: RoseBishopReserve; spirits: ThreeHeadedTemplarSpirits; powers: Record<ThreeHeadedTemplarPowerId, number>; shadow: boolean; supportAttempted: boolean; recallSeconds: number }
function resources(s: SliceState, r: ThreeHeadedTemplarRoundContext): Resources {
  const e = s.threeHeadedTemplar.encounter;
  return { playerS: s.spirituality, playerH: s.health, enemyS: e.enemySpirituality, reserve: structuredClone(s.roseBishop.reserve),
    spirits: structuredClone(s.threeHeadedTemplar.life.spirits), powers: { ...e.powerUses }, shadow: e.shadowReady, supportAttempted: r.playerActions.length > 0, recallSeconds: r.recallSeconds };
}
function commit(s: SliceState, r: ThreeHeadedTemplarRoundContext, q: Resources): void {
  const e = s.threeHeadedTemplar.encounter; s.spirituality = q.playerS; s.health = q.playerH; s.roseBishop.reserve = q.reserve;
  s.threeHeadedTemplar.life.spirits = q.spirits; e.enemySpirituality = q.enemyS; e.powerUses = q.powers; e.shadowReady = q.shadow;
  r.recallSeconds = q.recallSeconds; r.liveState = liveState(s);
}
function spiritEvent(x: ThreeHeadedTemplarCombatSource, q: Resources, type: ThreeHeadedTemplarCombatSpiritEvent['type'], spiritId: ThreeHeadedTemplarSpiritId): void {
  const effect = applyThreeHeadedTemplarCombatSpiritEvent(q.spirits, { type, spiritId, week: x.week, round: x.round, atSecond: x.lifeClockSeconds + q.recallSeconds });
  q.playerS -= effect.masterCost; q.recallSeconds += effect.seconds;
}
function supports(x: ThreeHeadedTemplarCombatSource, q: Resources): ThreeHeadedTemplarSupportAction[] {
  if (q.supportAttempted) return []; q.supportAttempted = true;
  const result: ThreeHeadedTemplarSupportAction[] = [];
  for (const id of externalIds(q.spirits)) {
    const s = q.spirits[id], method = id === 'THT3-HELENA' ? 'BRIEF_WARD' : 'STEADY_HOLD';
    if (!s.supportEnabled || !s.selectedAbilities.includes(method) || s.spirituality < 3 || q.playerS < 1) continue;
    const before = s.spirituality; spiritEvent(x, q, 'SUPPORT', id);
    result.push({ spiritId: id, method, casketId: s.casketId, deathRecordId: s.deathRecordId, paidCost: 1, spiritCost: 3,
      spiritualityBefore: before, spiritualityAfter: s.spirituality, integrity: s.integrity, selfGain: id === 'THT3-ROLAND' ? 16 : 0,
      enemyReduction: id === 'THT3-HELENA' ? 18 : 0, label: `${s.name}原灵实际在原院完成已选${method}，原灵实付3S（${before}→${s.spirituality}）、主人1S；${id === 'THT3-HELENA' ? '减敌势18' : '自身优势16'}G，只此一次且不附赠伤害。` });
  }
  return result;
}
function rollsRequired(q: Resources, id: ThreeHeadedTemplarMoveId): number { return Number(id === SHADOW && !q.shadow && q.playerS >= 4); }
function playerAction(x: ThreeHeadedTemplarCombatSource, q: Resources, id: ThreeHeadedTemplarMoveId, physical: number, rolls: number[], order: number,
  supportActions: ThreeHeadedTemplarSupportAction[]): ThreeHeadedTemplarPlayerAction {
  const a: ThreeHeadedTemplarPlayerAction = { ...none(''), id, order, paidCost: 0, physicalFactor: physical, rolls: [...rolls], mode: 'ORDINARY',
    reserveCost: 0, healthRestored: 0, shadowPrepared: false, borrowedSpiritId: null, borrowedMethod: null, supportActions, abilitySelfGain: 0, abilityEnemyReduction: 0 };
  const spirit = actualBorrowedSpirit(x.grazing, x.week, x.shepherdPromotionWeek), iris = (method: string) => spirit?.id === 'SH5-IRIS-1' && spirit.selectedAbilities.includes(method);
  if (id === 'ACCIDENT') { a.selfGain = -22.5; a.label = '动作偏差固定−22.5G，0S，不重抽或生成新能力。'; }
  else if (id === BODY) { a.selfGain = 27.3 * masteryFactor(x.mastery['hanged-man.s6.flesh-shaping'] ?? 0) * physical; a.threatens = a.selfGain > 0; a.label = '继承身体次击27.3×旧血肉掌握×实际身体G，0S。'; }
  else if (id === BLADE) {
    if (q.playerS >= 5) { a.paidCost = 5; a.selfGain = 55 * masteryFactor(x.mastery[BLADE] ?? 0); a.mode = 'PAID_BLADE'; a.label = '本人旧灵肉之刃实付5S，沿原净空地面近身挥击后回位，55×旧掌握G；不把原布拉姆判为堕落、不免费忽略护术或保证致伤。'; }
    else { a.selfGain = (x.clubHeld ? 16 : 12) * physical; a.label = `不足5S，本人${x.clubHeld ? '自有原棍16' : '普通身体12'}×身体G，0S，不借敌棍。`; }
    a.threatens = a.selfGain > 0;
  } else if (id === WARD) {
    if (iris('brief-ward') && q.playerS >= 2) { a.paidCost = 2; a.borrowedSpiritId = 'SH5-IRIS-1'; a.borrowedMethod = 'brief-ward'; a.mode = 'OLD_IRIS'; a.enemyReduction = 30 * masteryFactor(x.mastery[ART] ?? 0); a.label = '借当前唯一原伊芮斯实际已选短暂防护，实付本人2S，30×旧借用掌握G；不外化或升级旧原灵。'; }
    else if (q.playerH > 0 && q.playerH < 100 && q.reserve.points > 0 && q.playerS >= 3) { a.paidCost = 3; a.reserveCost = 1; a.healthRestored = Math.min(10, 100 - q.playerH); q.playerH += a.healthRestored; q.reserve.points--; a.selfGain = 8; a.mode = 'OLD_RESERVE'; a.label = `旧自修复实付3S＋1实际旧储备，恢复${a.healthRestored}H，上限100，自身优势8G；不清旧伤或复活。`; }
    else { a.enemyReduction = 10 * physical; a.label = '普通格挡10×身体G，0S，不免费修复或生成储备。'; }
  } else if (id === SHADOW) {
    if (q.shadow) { a.mode = 'ALREADY_PREPARED'; a.label = '已付原影限制等待下一正身体打击，不叠加或再次收费。'; }
    else if (q.playerS < 4) { a.mode = 'LOW_RESOURCE'; a.label = '不足4S，普通走位0贡献/0S。'; }
    else { a.paidCost = 4; const chance = computeCheckChance({ ability: 'knowledge', baseAbility: x.knowledge, difficulty: 18, modifiers: [] });
      a.shadowPrepared = rolls[0]! <= chance; q.shadow = a.shadowPrepared; a.mode = a.shadowPrepared ? 'PREPARED' : 'FAILED';
      a.label = `旧原影限制实付4S，知识18实抽${rolls[0]}/${chance}；${a.shadowPrepared ? '本轮下一正贡献身体打击×0.5后结束' : '失败0效果，费用不退'}。只作用实际受光原布拉姆原影，不使用旧隔离影体。`; }
  } else if (iris('light-touch') && q.playerS >= 2) { a.paidCost = 2; a.borrowedSpiritId = 'SH5-IRIS-1'; a.borrowedMethod = 'light-touch'; a.selfGain = 38.025 * masteryFactor(x.mastery[ART] ?? 0); a.threatens = a.selfGain > 0; a.mode = 'OLD_IRIS'; a.label = '借当前唯一原伊芮斯已选微力触动实付本人2S，38.025×旧借用掌握G；不切换灵，不复活塞德里克。'; }
  else a.label = '当前原伊芮斯未提供实际已选方法或不足2S，普通复核0贡献/0S。';
  q.playerS -= a.paidCost; a.abilitySelfGain = a.selfGain; a.abilityEnemyReduction = a.enemyReduction;
  a.selfGain += supportActions.reduce((n, v) => n + v.selfGain, 0); a.enemyReduction += supportActions.reduce((n, v) => n + v.enemyReduction, 0);
  if (supportActions.length) a.label = supportActions.map(v => v.label).join('') + a.label;
  return a;
}
function enemyAction(x: ThreeHeadedTemplarCombatSource, q: Resources, planned: ThreeHeadedTemplarEnemyIntent, physical: number, order: number): ThreeHeadedTemplarEnemyAction {
  const target = planned === 'LIGHT_BREAK' ? externalIds(q.spirits)[0] : undefined, noTarget = planned === 'LIGHT_BREAK' && !target;
  const power = THREE_HEADED_TEMPLAR_POWERS.find(p => p.id === planned), usable = !!power && !noTarget && q.enemyS >= power.cost;
  const actual = power && !usable && !noTarget ? 'BODY_STRIKE' : planned;
  const a: ThreeHeadedTemplarEnemyAction = { ...none(''), order, planned, actual, paidCost: usable ? power!.cost : 0, physicalFactor: physical, rolls: [],
    mode: noTarget ? 'NO_EXTERNAL_SPIRIT' : actual !== planned ? 'ORDINARY_FALLBACK' : 'ORIGINAL', shadowConsumed: false, interruptedSpiritId: null, integrityBefore: null, integrityAfter: null, recallSeconds: 0 };
  if (usable) { q.enemyS -= a.paidCost; q.powers[power!.id]++; }
  if (actual === 'LIGHT_BREAK') {
    if (usable && target) { a.interruptedSpiritId = target; a.integrityBefore = q.spirits[target].integrity; const before = q.recallSeconds;
      spiritEvent(x, q, 'LIGHT_BREAK', target); a.integrityAfter = q.spirits[target].integrity; a.recallSeconds = q.recallSeconds - before;
      a.label = `原布拉姆实付6S，以原有限光束只中断${target}原灵，完整度${a.integrityBefore}→${a.integrityAfter}；${a.integrityAfter > 0 ? '沿原4米路线4秒实际退回本人内部' : '原灵完整度归零真实消散'}，不补灵性、不抹除另一原灵或已发生付费效果。`; }
    else a.label = '当前没有实际外放原灵，原布拉姆普通观察0贡献/0S，不假装使用强光。';
  } else if (actual === 'ACCIDENT') a.label = '原布拉姆实际失衡0贡献/0S，不恢复灵性。';
  else if (actual === 'WARD') { a.enemyReduction = 30; a.label = '同一原布拉姆实付4S完成原有限屏护，减势30G。'; }
  else { const raw = actual === 'ARC_BOLT' ? 70 : 20 * physical; a.shadowConsumed = actual === 'BODY_STRIKE' && raw > 0 && q.shadow;
    a.selfGain = raw * (a.shadowConsumed ? .5 : 1); a.threatens = a.selfGain > 0; if (a.shadowConsumed) q.shadow = false;
    a.label = `${actual === 'ARC_BOLT' ? '原布拉姆实付5S完成原弧光70G' : `${a.mode === 'ORDINARY_FALLBACK' ? '原法术资源不足，回退' : ''}自己的唯一原棍20×身体G，0S`}${a.shadowConsumed ? '；已付原影限制本次×0.5后结束' : ''}，实际伤势仍由共同盘决定。`; }
  return a;
}
export function resolveThreeHeadedTemplarCombatAbility(s: SliceState, id: ThreeHeadedTemplarMoveId, physical: number, random: ActionRandomStream,
  r: ThreeHeadedTemplarRoundContext, source: ThreeHeadedTemplarCombatSource | null = r.source): ThreeHeadedTemplarCombatEffect {
  if (!validRound(s, r, source) || r.playerActions.length >= 6 || !ABILITIES.some(a => a.id === id)) return none('当前原人或资源来源无效，0贡献/0消耗，不召灵或重抽。');
  const q = resources(s, r), support = supports(r.source, q), rolls = Array.from({ length: rollsRequired(q, id) }, () => random.nextInt(1, 100));
  const a = playerAction(r.source, q, id, bounded(physical, 1), rolls, r.playerActions.length + r.enemyActions.length, support);
  r.playerActions.push(a); commit(s, r, q); return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export function resolveThreeHeadedTemplarEnemyAbility(s: SliceState, planned: ThreeHeadedTemplarEnemyIntent, physical: number, _random: ActionRandomStream,
  r: ThreeHeadedTemplarRoundContext, source: ThreeHeadedTemplarCombatSource | null = r.source): ThreeHeadedTemplarCombatEffect {
  if (!validRound(s, r, source) || r.enemyActions.length >= 6 || ![...THREE_HEADED_TEMPLAR_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned)) return none('当前原布拉姆或原资源来源无效，0贡献/0消耗。');
  const q = resources(s, r), a = enemyAction(r.source, q, planned, bounded(physical, 1), r.playerActions.length + r.enemyActions.length);
  r.enemyActions.push(a); commit(s, r, q); return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export interface ThreeHeadedTemplarRoundOutcome {
  targetId: typeof THREE_HEADED_TEMPLAR_TARGET_ID; round: number; source: ThreeHeadedTemplarCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuriesAfter: SliceInjury[]; enemyRiskAfter: number;
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number;
  powerUses: Record<ThreeHeadedTemplarPowerId, number>; sceneAfter: ThreeHeadedTemplarEncounterScene; reserveAfter: RoseBishopReserve; spiritsAfter: ThreeHeadedTemplarSpirits;
  shadowReadyAfter: false; elapsedSeconds: number; recallSeconds: number; lifeClockSecondsAfter: number;
  playerActions: ThreeHeadedTemplarPlayerAction[]; enemyActions: ThreeHeadedTemplarEnemyAction[];
}
export function finishThreeHeadedTemplarCombatRound(s: SliceState, r: ThreeHeadedTemplarRoundContext, continuing = true): ThreeHeadedTemplarRoundOutcome {
  const e = s.threeHeadedTemplar.encounter, c = s.combat;
  if (r.finished || !c || c.encounterId !== 'THREE_HEADED_TEMPLAR_DISPUTE' || c.round !== r.source.round || r.liveState !== liveState(s)) throw new Error('原回合已结束或原资源被改写。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  if (e.enemyStatus !== 'RESISTING') e.weaponLocation = 'COURT';
  const q = resources(s, r);
  if (!continuing) {
    for (const id of externalIds(q.spirits)) spiritEvent(r.source, q, s.health > 0 ? 'RECALL' : 'DEATH_RELEASE', id);
    if (s.health > 0 && e.scene.playerPosition !== 'EXIT') { e.scene.ordinaryWalkedMetres += 4; e.scene.playerPosition = 'EXIT'; }
  }
  s.threeHeadedTemplar.life.spirits = q.spirits; r.recallSeconds = q.recallSeconds;
  e.shadowReady = false; advanceThreeHeadedTemplarLifeClock(s, 60 + r.recallSeconds); r.finished = true;
  r.outcome = { targetId: THREE_HEADED_TEMPLAR_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus,
    enemyInjuriesAfter: structuredClone(c.enemyInjuries), enemyRiskAfter: c.enemyRisk, playerSpiritualityBefore: r.source.playerSpirituality, playerSpiritualityAfter: s.spirituality,
    playerHealthAfter: s.health, playerMindAfter: s.mind, enemySpiritualityBefore: r.source.enemySpirituality, powerUses: { ...e.powerUses }, sceneAfter: structuredClone(e.scene),
    reserveAfter: structuredClone(s.roseBishop.reserve), spiritsAfter: structuredClone(s.threeHeadedTemplar.life.spirits), shadowReadyAfter: false,
    elapsedSeconds: 60 + r.recallSeconds, recallSeconds: r.recallSeconds, lifeClockSecondsAfter: s.threeHeadedTemplar.life.clockSeconds,
    playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
  return structuredClone(r.outcome);
}
export function threeHeadedTemplarRoundOutcome(r: ThreeHeadedTemplarRoundContext): ThreeHeadedTemplarRoundOutcome { if (!r.outcome) throw new Error('先实际结束原回合。'); return structuredClone(r.outcome); }
export function projectThreeHeadedTemplarCombat(s: SliceState) {
  const e = s.threeHeadedTemplar.encounter, visible = isThreeHeadedTemplar(s);
  return { enemyName: visible ? '布拉姆·福斯（49岁，原创有限G3非凡者）' : '', targetId: visible ? e.targetId : null,
    enemyMind: visible ? e.enemyMind : null, enemySpirituality: visible ? e.enemySpirituality : null, powerUses: visible ? { ...e.powerUses } : null,
    scene: visible ? structuredClone(e.scene) : null, source: visible ? currentThreeHeadedTemplarCombatSource(s) : null,
    summary: visible ? '双方1–6动作；实际黑骑士核心50/20/20/10，1250/底125、S120，只有CONTINUE恢复本人12S。旧六槽30/15/20/20/10/5及原储备、原伊芮斯已选方法保持。两位真正获得且外放原灵只各协作一次，3原灵S＋1本人S；先手光束可先中断，后手光束不追溯抹除已发生效果。活着离场实际收回原灵不补满；本人死亡永久释放仍外放原灵。旧塞德里克释放、旧隔离影体、旧加里克投降不变。' : '' };
}
export function validThreeHeadedTemplarCombatScene(v: ThreeHeadedTemplarEncounterScene): boolean {
  return !!v && v.courtId === 'THT3-COURT' && v.ordinaryExit === 'OPEN' && v.thirdPartiesInArea === 0 && typeof v.clearanceConfirmed === 'boolean' &&
    ['COURT', 'EXIT'].includes(v.playerPosition) && v.distanceMetres === 4 && v.exitMetres === 4 && integer(v.ordinaryWalkedMetres, 0, 4);
}
export function validateThreeHeadedTemplarRoundOutcome(value: unknown): value is ThreeHeadedTemplarRoundOutcome {
  try {
    const o = value as ThreeHeadedTemplarRoundOutcome, x = o?.source;
    if (!o || !x || typeof x.runId !== 'string' || x.runId.length === 0 || !integer(x.revision) || !integer(x.week, 1) || !integer(x.round, 1) || !integer(x.startHistoryIndex) || x.attemptWeek !== x.week ||
      x.encounterId !== 'THREE_HEADED_TEMPLAR_DISPUTE' || x.targetId !== THREE_HEADED_TEMPLAR_TARGET_ID || x.targetAge !== 49 || x.targetSequence !== 3 || x.targetPhysique !== 20 ||
      x.actualOriginalBody !== true || x.independentMind !== true || x.enemyWeapon !== 'THT3-BRAM-ROD' || x.weaponLocation !== 'HAND' || x.distanceMetres !== 4 || x.space !== 'THT3-COURT' || x.originalShadow !== 'THT3-BRAM-SHADOW' || x.shadowLit !== true ||
      x.ordinaryExit !== true || x.pursuit !== false || x.thirdPartiesInArea !== 0 || x.automaticAllyImmunity !== false || x.abilitySource !== 'ORIGINAL_LIMITED_G' ||
      ![x.playerHealth, x.playerMind, x.enemyHealth, x.enemyMind].every(n => integer(n, 1, 100)) || !integer(x.knowledge, 0, 10000) || typeof x.clubHeld !== 'boolean' ||
      !integer(x.lifeClockSeconds) || !integer(o.recallSeconds, 0, 8) || o.elapsedSeconds !== 60 + o.recallSeconds || o.lifeClockSecondsAfter !== x.lifeClockSeconds + o.elapsedSeconds ||
      !Array.isArray(x.enemyInjuries) || !integer(x.enemyRisk) || !Array.isArray(o.enemyInjuriesAfter) || !integer(o.enemyRiskAfter) ||
      o.targetId !== THREE_HEADED_TEMPLAR_TARGET_ID || o.round !== x.round || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) || typeof o.continuing !== 'boolean' ||
      o.shadowReadyAfter !== false || !integer(o.enemyHealth, 0, x.enemyHealth) || !integer(o.playerHealthAfter, 0, 100) ||
      o.continuing && (o.playerHealthAfter <= 0 || o.enemyStatus !== 'RESISTING') || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(o.enemyStatus) || (o.enemyStatus === 'DEAD') !== (o.enemyHealth === 0) || o.enemyMind !== x.enemyMind || o.playerMindAfter !== x.playerMind ||
      ![x.playerSpirituality, x.enemySpirituality, o.playerSpiritualityAfter, o.enemySpirituality].every(n => integer(n, 0, 120)) || o.playerSpiritualityBefore !== x.playerSpirituality || o.enemySpiritualityBefore !== x.enemySpirituality ||
      !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) || o.playerActions.length > 6 || o.enemyActions.length > 6 || !x.powerUses || !same(Object.keys(x.powerUses).sort(), [...THREE_HEADED_TEMPLAR_POWER_IDS].sort()) ||
      !THREE_HEADED_TEMPLAR_POWER_IDS.every(id => integer(x.powerUses[id])) || x.enemySpirituality !== 120 - THREE_HEADED_TEMPLAR_POWERS.reduce((n, p) => n + x.powerUses[p.id] * p.cost, 0) ||
      !validThreeHeadedTemplarCombatScene(x.scene) || !x.scene.clearanceConfirmed || x.scene.playerPosition !== 'COURT' || x.scene.ordinaryWalkedMetres !== 0 ||
      !validReserve(x.reserve, x.week) || !validateThreeHeadedTemplarSpiritSources(x.spirits, x.week) || !x.mastery || !same(Object.keys(x.mastery).sort(), [...MASTERY_IDS].sort()) || Object.values(x.mastery).some(n => !integer(n, 0, 500)) ||
      !x.grazing || !Array.isArray(x.grazing.spirits) || x.grazing.spirits.length !== 2 || new Set(x.grazing.spirits.map(a => a.id)).size !== 2 ||
      !x.grazing.spirits.every(a => SHEPHERD_SPIRITS.some(b => a.id === b.id)) || x.grazing.activeSpiritId !== null && !actualBorrowedSpirit(x.grazing, x.week, x.shepherdPromotionWeek) ||
      x.grazing.spirits.filter(a => a.status === 'GRAZED').length + Object.values(x.spirits).filter(a => a.status === 'GRAZED').length > 7) return false;
    const q: Resources = { playerS: x.playerSpirituality, playerH: x.playerHealth, enemyS: x.enemySpirituality, reserve: structuredClone(x.reserve), spirits: structuredClone(x.spirits), powers: { ...x.powerUses }, shadow: false, supportAttempted: false, recallSeconds: 0 };
    const actions = [...o.playerActions.map(a => ({ actor: 'PLAYER' as const, a })), ...o.enemyActions.map(a => ({ actor: 'ENEMY' as const, a }))].sort((a, b) => a.a.order - b.a.order);
    for (const [i, entry] of actions.entries()) {
      const a = entry.a;
      if (a.order !== i || !Number.isFinite(a.physicalFactor) || a.physicalFactor < 0 || a.physicalFactor > 1 || !Array.isArray(a.rolls) || a.rolls.some(n => !integer(n, 1, 100))) return false;
      if (entry.actor === 'PLAYER') { const b = entry.a, support = supports(x, q); if (!ABILITIES.some(v => v.id === b.id) || b.rolls.length !== rollsRequired(q, b.id) || !same(b, playerAction(x, q, b.id, b.physicalFactor, b.rolls, i, support))) return false; }
      else { const b = entry.a; if (![...THREE_HEADED_TEMPLAR_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(b.planned) || !same(b, enemyAction(x, q, b.planned, b.physicalFactor, i))) return false; }
    }
    if (o.playerHealthAfter > q.playerH || (!o.playerActions.some(a => a.threatens) && (o.enemyHealth !== x.enemyHealth || o.enemyStatus !== 'RESISTING' || !same(o.enemyInjuriesAfter, x.enemyInjuries))) ||
      (!o.enemyActions.some(a => a.threatens) && o.playerHealthAfter !== q.playerH)) return false;
    const scene = structuredClone(x.scene);
    if (!o.continuing) { for (const id of externalIds(q.spirits)) spiritEvent(x, q, o.playerHealthAfter > 0 ? 'RECALL' : 'DEATH_RELEASE', id);
      if (o.playerHealthAfter > 0) { scene.ordinaryWalkedMetres += 4; scene.playerPosition = 'EXIT'; } }
    return q.playerS === o.playerSpiritualityAfter && q.enemyS === o.enemySpirituality && same(q.powers, o.powerUses) && same(q.reserve, o.reserveAfter) && same(q.spirits, o.spiritsAfter) && same(scene, o.sceneAfter) && q.recallSeconds === o.recallSeconds;
  } catch { return false; }
}
