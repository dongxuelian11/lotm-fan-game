import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicGameDate, PublicCheckResult } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { CONQUEROR_TARGET_ID, CONQUEROR_SITE, CONQUEROR_POWER_IDS, CONQUEROR_POWERS, combatBody, hasConquerorDisputeOpponent,
  validateConquerorPreparation, validConquerorMaterials, validConquerorScene, type ConquerorCombatBody, type ConquerorEnemyIntent,
  type ConquerorPreparation, type ConquerorMaterials, type ConquerorScene, type ConquerorPolicy } from './encounter.js';

/** The existing Hunter six-slot count distribution, core weights and finite
 * 1250/floor125, max120/continued-round12 profile are preserved. */
export const CONQUEROR_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const CONQUEROR_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const conquerorActionCount = pyromaniacActionCount;
export const conquerorEnemyActionCount = pyromaniacActionCount;
export const FORMATION_MOMENTUM = 'hunter.s1.formation-momentum', FOCUSED_FLAME = 'hunter.s1.focused-flame';
export const CONQUEROR_INHERITED_SKILL_IDS = ['hunter.s9.tracking', 'hunter.s9.trapcraft', 'hunter.s9.physical-enhancement', 'hunter.s9.hunting-instinct',
  'hunter.s8.provocation', 'hunter.s8.hostility-aura', 'hunter.s7.flame-control', 'hunter.s7.compressed-fireball', 'hunter.s7.flame-lance', 'hunter.s7.fire-raven',
  'hunter.s6.reasoning-plan', 'hunter.s6.targeted-persuasion', 'hunter.s5.weakness-observation', 'hunter.s5.precision-strike', 'hunter.s4.flame-steel', 'hunter.s4.comrade-link',
  'hunter.s3.formation-link', 'hunter.s3.coordinated-action', 'hunter.s2.battle-fog', 'hunter.s2.frost', 'hunter.s2.storm'] as const;
export type ConquerorMoveId = typeof CONQUEROR_INHERITED_SKILL_IDS[number] | typeof FORMATION_MOMENTUM | typeof FOCUSED_FLAME | 'STRIKE' | 'BLOCK' | 'EVADE' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly { id: ConquerorMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'STRIKE', label: '本人普通打击：12×身体', weight: 8, stance: 'ATTACK' },
  { id: 'BLOCK', label: '本人普通防备：减势10×身体', weight: 6, stance: 'DEFEND' },
  { id: 'EVADE', label: '本人身体避让：减势22×身体', weight: 6, stance: 'DEFEND' },
  { id: 'OBSERVE', label: '观察对手当前动作', weight: 4, stance: 'PREPARE' },
  { id: 'hunter.s9.tracking', label: '继承追踪：本场无待追踪路线，普通观察', weight: 1, stance: 'PREPARE' },
  { id: 'hunter.s9.trapcraft', label: '继承陷阱：本场没有已布原陷阱，普通防备', weight: 1, stance: 'PREPARE' },
  { id: 'hunter.s9.physical-enhancement', label: '继承强化打击：28×身体', weight: 5, stance: 'ATTACK' },
  { id: 'hunter.s9.hunting-instinct', label: '继承猎杀直觉：减势16', weight: 4, stance: 'CONTROL' },
  { id: 'hunter.s8.provocation', label: '继承针对性挑衅：2灵性、精神贡献18', weight: 3, stance: 'CONTROL' },
  { id: 'hunter.s8.hostility-aura', label: '继承憎恶气息：2灵性、精神贡献16', weight: 2, stance: 'CONTROL' },
  { id: 'hunter.s7.flame-control', label: '继承火焰牵制：2灵性、减势18', weight: 4, stance: 'CONTROL' },
  { id: 'hunter.s7.compressed-fireball', label: '继承压缩火球：3灵性、贡献36', weight: 5, stance: 'ATTACK' },
  { id: 'hunter.s7.flame-lance', label: '继承火焰长枪：3灵性、贡献34', weight: 4, stance: 'ATTACK' },
  { id: 'hunter.s7.fire-raven', label: '继承火鸦：3灵性、贡献32，仍为本人同一动作', weight: 3, stance: 'ATTACK' },
  { id: 'hunter.s6.reasoning-plan', label: '继承推理规划：须有实际战前准备，本场普通观察', weight: 1, stance: 'PREPARE' },
  { id: 'hunter.s6.targeted-persuasion', label: '继承针对性说服：不能在一个战斗槽强迫服从', weight: 1, stance: 'CONTROL' },
  { id: 'hunter.s5.weakness-observation', label: '继承弱点观察：感知18检定，只提供本轮一次窗口', weight: 4, stance: 'PREPARE' },
  { id: 'hunter.s5.precision-strike', label: '继承精准打击：真实当前窗口、2灵性、贡献42×身体', weight: 5, stance: 'ATTACK' },
  { id: 'hunter.s4.flame-steel', label: '继承短暂钢铁化：3灵性、减势18', weight: 5, stance: 'DEFEND' },
  { id: 'hunter.s4.comrade-link', label: '继承同伴联系：无人实际在场，普通防备', weight: 1, stance: 'DEFEND' },
  { id: 'hunter.s3.formation-link', label: '继承编队协抗：无人实际在场，普通防备', weight: 1, stance: 'DEFEND' },
  { id: 'hunter.s3.coordinated-action', label: '继承协调行动：无人实际在场，普通防备', weight: 1, stance: 'CONTROL' },
  { id: 'hunter.s2.battle-fog', label: '继承战场迷雾：没有本人可用原水，普通防备', weight: 2, stance: 'DEFEND' },
  { id: 'hunter.s2.frost', label: '继承冰霜：没有本人可用原水，普通防备', weight: 2, stance: 'CONTROL' },
  { id: 'hunter.s2.storm', label: '继承风雨雷势：没有本人可用原水，普通打击', weight: 2, stance: 'ATTACK' },
  { id: FORMATION_MOMENTUM, label: '阵势合力：无人实际在场，不施放；本人普通防备', weight: 8, stance: 'DEFEND' },
  { id: FOCUSED_FLAME, label: '焰势凝束：允许后实付8灵性2精神、知识20，贡献95并加热原铁杖', weight: 15, stance: 'ATTACK' },
  { id: 'ACCIDENT', label: '实际动作偏差：固定−22.5', weight: 2, stance: null },
];
export const CONQUEROR_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'FIRE_JET', label: '有限火流：8灵性、95身体攻击贡献', weight: 30 },
  { id: 'WARD', label: '挡火屏护：6灵性、30秒内随后一次火焰贡献最多减60', weight: 20 },
  { id: 'BODY_STRIKE', label: '自己原铁杖或空手打击：22/14×身体', weight: 25 },
  { id: 'COOL_WEAPON', label: '冷却原铁杖：3灵性、实耗自有水2升降温200度', weight: 10 },
  { id: 'MENTAL_PRESSURE', label: '精神施压：5灵性、45精神贡献', weight: 10 },
  { id: 'ACCIDENT', label: '实际偏差：−22.5', weight: 5 },
];
export const isConqueror = (s: SliceState) => s.progression.pathwayId === 'hunter' && s.progression.sequence === 1;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (a.stance === stance && stance !== null ? 5 : 4));
export function conquerorAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const w = tickets(stance), total = w.reduce((a, b) => a + b, 0); return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: w[i]! / total * 100 }));
}
export function drawConquerorAbility(random: ActionRandomStream, _s: SliceState | null, stance: SliceStance | null): ConquerorMoveId {
  const w = tickets(stance); let n = random.nextInt(1, w.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= w[i]!; if (n <= 0) return a.id; } throw new Error('行动盘无效。');
}
export function drawConquerorEnemyAbility(random: ActionRandomStream): ConquerorEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of CONQUEROR_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as ConquerorEnemyIntent; } throw new Error('对手行动盘无效。');
}
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
const physicalAt = (n: number) => n > 75 ? 1 : n > 50 ? .95 : n > 25 ? .9 : .8;
export interface ConquerorCombatSource {
  runId: string; revision: number; week: number; date: PublicGameDate; round: number; encounterId: 'CONQUEROR_DISPUTE'; targetId: typeof CONQUEROR_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetName: '罗南·黑尔'; targetAge: 47; targetPathway: 'original-caster'; targetSequence: 1; targetCore: 22; targetPerception: 28;
  actualBody: true; independentMind: true; automaticTrueGod: false; playerBodyId: string; enemyWeapon: 'CQ1-RONAN-IRON-ROD'; weaponOwner: typeof CONQUEROR_TARGET_ID;
  ordinaryExit: 'OPEN'; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false; freeSkillLibrary: false; policy: ConquerorPolicy;
  playerHealth: number; playerMind: number; playerSpirituality: number; playerInjuries: SliceInjury[]; playerRisk: number;
  physique: number; perception: number; will: number; knowledge: number; mastery: Record<string, number>;
  preparation: ConquerorPreparation; root: ConquerorScene; materials: ConquerorMaterials; body: ConquerorCombatBody; randomSeed: string; randomCursor: number;
}
export function currentConquerorCombatSource(s: SliceState): ConquerorCombatSource | null {
  if (!hasConquerorDisputeOpponent(s)) return null; const e = s.conqueror.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, date: { ...s.date }, round: c.round, encounterId: 'CONQUEROR_DISPUTE', targetId: CONQUEROR_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetName: '罗南·黑尔', targetAge: 47, targetPathway: 'original-caster', targetSequence: 1, targetCore: 22, targetPerception: 28,
    actualBody: true, independentMind: true, automaticTrueGod: false, playerBodyId: `${s.runId}:body`, enemyWeapon: 'CQ1-RONAN-IRON-ROD', weaponOwner: CONQUEROR_TARGET_ID,
    ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false, freeSkillLibrary: false, policy: e.policy,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, playerInjuries: structuredClone(s.injuries), playerRisk: s.injuryRisk,
    ...s.character.coreStats, mastery: { ...s.progression.mastery }, preparation: structuredClone(e.preparation!), root: structuredClone(e.scene), materials: structuredClone(e.materials), body: combatBody(e), randomSeed: s.random.seed, randomCursor: s.random.cursor };
}
export interface ConquerorPendingWard { id: string; createdAt: number; expiresAt: number; remaining: 1 }
export interface ConquerorActionEvidence {
  order: number; actor: 'PLAYER' | 'ENEMY'; id: string; planned: string; selectedAbility: string; fallbackReason: string | null; mode: string; label: string;
  selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean; attackKind: 'NONE' | 'BODY' | 'FIRE' | 'MIND'; rawContribution: number; rawReduction: number;
  paidCost: number; mindCost: number; physicalFactor: number; check: PublicCheckResult | null; succeeded: boolean;
  wardBefore: ConquerorPendingWard | null; wardAfter: ConquerorPendingWard | null; countered: string[]; masteryApplied: string[];
  materialsBefore: ConquerorMaterials; materialsAfter: ConquerorMaterials; materialSourceId: string | null; heatingDegrees: number; coolingLitres: number;
  formationCast: false; actualMemberIds: string[]; weaknessBefore: boolean; weaknessAfter: boolean;
  atSeconds: number; elapsedSeconds: 5; travelMetres: number; randomCursorBefore: number; randomCursorAfter: number;
  playerHealthAfter: number; playerMindAfter: number; playerSpiritualityAfter: number; enemySpiritualityAfter: number;
}
export interface ConquerorRuntime {
  body: ConquerorCombatBody; root: ConquerorScene; materials: ConquerorMaterials; playerH: number; playerS: number; playerM: number;
  mastery: Record<string, number>; ward: ConquerorPendingWard | null; expiredWards: ConquerorPendingWard[]; weakness: boolean;
}
export function createConquerorRuntime(x: ConquerorCombatSource): ConquerorRuntime {
  return { body: structuredClone(x.body), root: structuredClone(x.root), materials: structuredClone(x.materials), playerH: x.playerHealth, playerS: x.playerSpirituality, playerM: x.playerMind,
    mastery: { ...x.mastery }, ward: null, expiredWards: [], weakness: false };
}
export function advanceConquerorCombatClock(r: ConquerorRuntime, seconds: number): void {
  if (!integer(seconds)) throw new Error('实际时间无效。'); r.root.clockSeconds += seconds; r.root.externalSeconds += seconds;
  r.materials.weapon.temperatureC = Math.max(20, r.materials.weapon.temperatureC - seconds);
  if (r.ward && r.ward.expiresAt <= r.root.clockSeconds) { r.expiredWards.push(r.ward); r.ward = null; }
}
function baseAction(x: ConquerorCombatSource, r: ConquerorRuntime, actor: 'PLAYER' | 'ENEMY', id: string, order: number, random: ActionRandomStream): ConquerorActionEvidence {
  return { actor, id, planned: id, selectedAbility: id, fallbackReason: null, order, mode: 'OBSERVE', label: '', selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false,
    attackKind: 'NONE', rawContribution: 0, rawReduction: 0, paidCost: 0, mindCost: 0, physicalFactor: physicalAt(actor === 'PLAYER' ? r.playerH : x.body.enemyHealth), check: null, succeeded: false,
    wardBefore: structuredClone(r.ward), wardAfter: null, countered: [], masteryApplied: [], materialsBefore: structuredClone(r.materials), materialsAfter: structuredClone(r.materials), materialSourceId: null,
    heatingDegrees: 0, coolingLitres: 0, formationCast: false, actualMemberIds: [], weaknessBefore: r.weakness, weaknessAfter: r.weakness,
    atSeconds: r.root.clockSeconds, elapsedSeconds: 5, travelMetres: 0, randomCursorBefore: random.cursor, randomCursorAfter: random.cursor,
    playerHealthAfter: r.playerH, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, enemySpiritualityAfter: r.body.enemySpirituality };
}
function closeAction(a: ConquerorActionEvidence, r: ConquerorRuntime, random: ActionRandomStream): ConquerorActionEvidence {
  r.body.weaponLocation = r.materials.weapon.location; advanceConquerorCombatClock(r, 5); a.wardAfter = structuredClone(r.ward); a.materialsAfter = structuredClone(r.materials); a.weaknessAfter = r.weakness; a.randomCursorAfter = random.cursor;
  a.playerHealthAfter = r.playerH; a.playerMindAfter = r.playerM; a.playerSpiritualityAfter = r.playerS; a.enemySpiritualityAfter = r.body.enemySpirituality;
  a.label += ` 实际用时5秒；本人灵性${r.playerS}、精神${r.playerM}，罗南灵性${r.body.enemySpirituality}。`; return a;
}
function ordinary(r: ConquerorRuntime, a: ConquerorActionEvidence, why: string, attack = false): void {
  a.selectedAbility = attack ? 'STRIKE' : 'BLOCK'; a.mode = attack ? 'BODY' : 'GUARD'; a.fallbackReason = why;
  if (attack) { a.selfGain = 12 * a.physicalFactor; a.attackKind = 'BODY'; a.threatens = true; a.travelMetres = 4; r.root.playerTravelMetres += 4; }
  else a.enemyReduction = 10 * a.physicalFactor;
  a.label = `${why}本槽仅为${attack ? '本人空手近前2米打击再退回2米，12×身体' : '本人普通防备，减势10×身体'}，不重抽、不施放所缺术式，不扣不存在的人员或物料。`;
}
function paid(r: ConquerorRuntime, a: ConquerorActionEvidence, spirit: number, mind = 0): void { r.playerS -= spirit; r.playerM -= mind; a.paidCost = spirit; a.mindCost = mind; }
function check(x: ConquerorCombatSource, a: ConquerorActionEvidence, ability: 'knowledge' | 'perception', difficulty: number, random: ActionRandomStream): void {
  a.check = resolveNormalCheck({ ability, baseAbility: x[ability], difficulty, modifiers: [], roll: random.nextInt(1, 100) }); a.succeeded = ['SUCCESS', 'GREAT_SUCCESS'].includes(a.check.tier);
}
/** Only actual original players, paid resources and currently learned abilities
 * are used. A learned zero mastery never becomes an absent skill. */
export function resolveConquerorPlayerSlot(x: ConquerorCombatSource, r: ConquerorRuntime, id: ConquerorMoveId, order: number, random: ActionRandomStream): ConquerorActionEvidence {
  if (!ABILITIES.some(a => a.id === id)) throw new Error('行动盘无效。'); const a = baseAction(x, r, 'PLAYER', id, order, random);
  if (id.startsWith('hunter.') && !Object.hasOwn(x.mastery, id)) ordinary(r, a, '没有本人已学会的这项能力。');
  else if (id === 'ACCIDENT') { a.mode = 'ACCIDENT'; a.selfGain = -22.5; a.label = '此次动作偏差，贡献−22.5。'; }
  else if (id === FORMATION_MOMENTUM || ['hunter.s4.comrade-link', 'hunter.s3.formation-link', 'hunter.s3.coordinated-action'].includes(id)) {
    ordinary(r, a, '本场没有实际在场、自愿且有剩余精力的队员；未施放团队能力，没有军势或共享加成。');
  } else if (id === 'hunter.s2.battle-fog' || id === 'hunter.s2.frost' || id === 'hunter.s2.storm') {
    ordinary(r, a, '没有本人拥有且带入本场的原水；罗南的冷却水属于他，不能凭旧生活或旧天气记录调用。', id === 'hunter.s2.storm');
  } else if (['hunter.s9.tracking', 'hunter.s9.trapcraft', 'hunter.s6.reasoning-plan', 'hunter.s6.targeted-persuasion'].includes(id)) {
    ordinary(r, a, '本槽没有实际路线、已布原陷阱或战前准备，交涉也不能强迫独立成人立即服从。');
  } else if (id === 'STRIKE' || id === 'hunter.s9.physical-enhancement') {
    a.mode = 'BODY'; a.attackKind = 'BODY'; a.selfGain = (id === 'STRIKE' ? 12 : 28) * a.physicalFactor; a.threatens = true; a.travelMetres = 4; r.root.playerTravelMetres += 4;
    a.label = '本人原身体近前2米实际打击，再退回原位置；没有复制身体或召出旧武器。';
  } else if (id === 'BLOCK' || id === 'EVADE' || id === 'hunter.s9.hunting-instinct') {
    a.mode = 'GUARD'; a.enemyReduction = (id === 'BLOCK' ? 10 : id === 'EVADE' ? 22 : 16) * a.physicalFactor; a.label = '本人在原位置防备、避让或依猎杀直觉调整；只降低有限优势，不保证免伤。';
  } else if (id === 'OBSERVE' || id === 'hunter.s5.weakness-observation') {
    if (id === 'OBSERVE') { a.mode = 'OBSERVE'; a.selfGain = 4; a.label = '本人普通观察眼前动作，贡献4，不生成可精准利用的弱点。'; }
    else { a.mode = 'WEAKNESS'; check(x, a, 'perception', 18, random); if (a.succeeded) r.weakness = true; a.label = `本人观察罗南当前原身体动作，感知18检定${a.check!.roll}/${a.check!.chance}；${a.succeeded ? '只取得本轮一次真实窗口' : '没有可用窗口'}。`; }
  } else if (id === 'hunter.s5.precision-strike') {
    if (!r.weakness || r.playerS < 2) ordinary(r, a, '缺少本轮实际观察窗口或2灵性。', true);
    else { paid(r, a, 2); r.weakness = false; a.mode = 'PRECISION'; a.succeeded = true; a.selfGain = 42 * a.physicalFactor; a.attackKind = 'BODY'; a.threatens = true; a.travelMetres = 4; r.root.playerTravelMetres += 4; a.label = '实付2灵性，耗去这次真实观察窗口，近前击打再退回；42×身体贡献，仍用共同伤势盘。'; }
  } else if (id === 'hunter.s4.flame-steel') {
    if (r.playerS < 3) ordinary(r, a, '当下不足3灵性。');
    else { paid(r, a, 3); a.mode = 'STEEL'; a.succeeded = true; a.enemyReduction = 18; a.label = '继承短暂钢铁化实付3灵性，有限减势18；不修复身体、不抵消死亡。'; }
  } else if (id === 'hunter.s8.provocation' || id === 'hunter.s8.hostility-aura') {
    if (r.playerS < 2) ordinary(r, a, '当下不足2灵性。');
    else { paid(r, a, 2); a.mode = 'MENTAL'; a.selfGain = id === 'hunter.s8.provocation' ? 18 : 16; a.attackKind = 'MIND'; a.mentalPressure = true; a.succeeded = true; a.label = '继承挑衅或憎恶气息实付2灵性，只形成有限精神压力；独立对手仍能拒绝、反击或自行停止。'; }
  } else if (id === FOCUSED_FLAME) {
    if (x.policy !== 'FOCUS_FLAME') ordinary(r, a, '当前策略保留焰势凝束，没有获准施放。', true);
    else if (r.playerS < 8 || r.playerM <= 2) ordinary(r, a, '不足8灵性2精神并保持清醒。', true);
    else { paid(r, a, 8, 2); r.body.focusedAttempts++; a.mode = 'FOCUSED_FLAME'; check(x, a, 'knowledge', 20, random);
      if (a.succeeded) { a.selfGain = 95; a.attackKind = 'FIRE'; a.threatens = true; r.body.focusedSuccesses++; r.mastery[id] = Math.min(500, r.mastery[id]! + 8); a.masteryApplied.push(id); }
      a.label = `本人先付8灵性2精神，知识20检定${a.check!.roll}/${a.check!.chance}；${a.succeeded ? '本人制造并聚焦一次真实火流指向原对手，贡献95' : '失败，没有形成攻击或热量，费用不退'}。没有借来军队、旧生活火焰或新物料。`; }
  } else {
    const control = id === 'hunter.s7.flame-control', cost = control ? 2 : 3;
    if (r.playerS < cost) ordinary(r, a, `当下不足${cost}灵性。`, !control);
    else { paid(r, a, cost); a.succeeded = true; a.mode = control ? 'FLAME_CONTROL' : 'FIRE';
      if (control) { a.enemyReduction = 18; a.label = '本人制造短时牵制火焰，实付2灵性、减势18，没有身体致伤来源。'; }
      else { a.selfGain = id === 'hunter.s7.compressed-fireball' ? 36 : id === 'hunter.s7.flame-lance' ? 34 : 32; a.attackKind = 'FIRE'; a.threatens = true; a.label = '本人用继承能力制造一次有限火焰打击，实付3灵性；火鸦也只是同一原动作，不成为额外角色或动作槽。'; } }
  }
  a.rawContribution = a.selfGain; a.rawReduction = a.enemyReduction;
  if (a.attackKind === 'FIRE' && a.selfGain > 0 && r.ward && r.ward.expiresAt > r.root.clockSeconds) {
    a.countered.push(r.ward.id); a.selfGain = Math.max(0, a.selfGain - 60); r.ward = null; a.threatens = a.selfGain > 0;
    a.label += `罗南此前已付费的单次挡火实际减去最多60，剩余贡献${a.selfGain}；余量仍可能致伤。`;
  }
  if (a.mode === 'FOCUSED_FLAME' && a.succeeded && a.selfGain > 0 && r.materials.weapon.location === 'HAND') {
    const w = r.materials.weapon; a.materialSourceId = w.sourceId; a.heatingDegrees = 260; w.heatingPulses++; w.temperatureC = Math.min(1200, w.temperatureC + 260);
    if (w.temperatureC >= 600) { w.deformations++; w.condition = Math.max(0, 100 - w.deformations * 20); w.location = 'YARD'; }
    a.label += `火流接触罗南手中同一原铁杖，升温260度至${w.temperatureC}；${w.location === 'YARD' ? '达到高温后他放开原杖，原杖实际变形并落地' : '原杖仍由原对手持有'}。`;
  }
  return closeAction(a, r, random);
}
export function resolveConquerorEnemySlot(x: ConquerorCombatSource, r: ConquerorRuntime, planned: ConquerorEnemyIntent, order: number, random: ActionRandomStream): ConquerorActionEvidence {
  if (![...CONQUEROR_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned)) throw new Error('对手行动盘无效。');
  const a = baseAction(x, r, 'ENEMY', planned, order, random), b = r.body, p = CONQUEROR_POWERS.find(v => v.id === planned);
  const cooldownReady = r.materials.water.remainingLitres >= 2 && r.materials.weapon.temperatureC > 20;
  if (planned === 'ACCIDENT') { a.mode = 'ACCIDENT'; a.selfGain = -22.5; a.label = '罗南此次动作偏差，贡献−22.5。'; }
  else if (p && b.enemySpirituality >= p.cost && !(p.id === 'WARD' && r.ward) && !(p.id === 'COOL_WEAPON' && !cooldownReady)) {
    a.mode = p.id; a.paidCost = p.cost; b.enemySpirituality -= p.cost; b.powerUses[p.id]++; a.selfGain = p.selfGain; a.enemyReduction = p.enemyReduction;
    if (p.id === 'FIRE_JET') { a.attackKind = 'FIRE'; a.threatens = true; a.label = '罗南实付8灵性制造有限火流，95身体攻击贡献。'; }
    else if (p.id === 'MENTAL_PRESSURE') { a.attackKind = 'MIND'; a.mentalPressure = true; a.label = '罗南实付5灵性施加45精神压力；没有身体攻击来源。'; }
    else if (p.id === 'WARD') {
      r.ward = { id: `${x.runId}:CQ1-WARD:${x.round}:${order}`, createdAt: r.root.clockSeconds, expiresAt: r.root.clockSeconds + 30, remaining: 1 };
      a.label = '罗南实付6灵性自主准备挡火，30秒内随后一次真实火焰贡献最多减60，用一次即结束；不抵挡身体或精神，不取消所有能力。';
    } else {
      const w = r.materials.weapon; r.materials.water.uses++; r.materials.water.remainingLitres -= 2; w.temperatureC = Math.max(20, w.temperatureC - 200); a.coolingLitres = 2; a.materialSourceId = r.materials.water.sourceId;
      if (w.location === 'YARD' && w.condition > 0 && w.temperatureC <= 80) w.location = 'HAND';
      a.label = `罗南实付3灵性和自己的原水2升，将同一原铁杖冷却200度至${w.temperatureC}；剩余${r.materials.water.remainingLitres}升。${w.location === 'HAND' ? '温度安全且原件尚完整，继续持握同一原杖' : '原杖仍留地，不凭冷却修复变形'}。`;
    }
  } else {
    a.id = a.selectedAbility = 'BODY_STRIKE'; a.mode = 'BODY'; a.fallbackReason = p ? '当前灵性、实际冷却水或单次屏护条件不足。' : null; a.attackKind = 'BODY'; a.threatens = true;
    a.selfGain = (r.materials.weapon.location === 'HAND' ? 22 : 14) * a.physicalFactor; a.travelMetres = 4;
    a.label = `罗南用${r.materials.weapon.location === 'HAND' ? '自己仍在手的同一原铁杖' : '自己的原身体空手'}近前2米打击再退回2米；无法施法时本槽只作普通动作，不重抽、不恢复灵性或生成新杖。`;
  }
  a.rawContribution = a.selfGain; a.rawReduction = a.enemyReduction; return closeAction(a, r, random);
}

export interface ConquerorRoundOutcome extends ConquerorCombatBody {
  targetId: typeof CONQUEROR_TARGET_ID; round: number; source: ConquerorCombatSource; stance: SliceStance; continuing: boolean;
  playerHealthAfter: number; playerMindAfter: number; playerSpiritualityAfter: number; playerInjuriesAfter: SliceInjury[]; playerRiskAfter: number; materialsAfter: ConquerorMaterials; masteryAfter: Record<string, number>;
  rootAfter: ConquerorScene; elapsedSeconds: 60; randomCursorAfter: number; playerActions: ConquerorActionEvidence[]; enemyActions: ConquerorActionEvidence[]; expiredWards: ConquerorPendingWard[];
}
export type ConquerorResolution = 'CONTINUE' | 'PLAYER_DEAD' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED' | 'RETREATED';
function penalty(n: number, max: number) { const f = n / max; return f > .75 ? 0 : f > .5 ? .05 : f > .25 ? .1 : .2; }
function base(core: number, h: number, m: number, s: number) { return (1250 + Math.min(core, 250)) * (1 - Math.min(.4, penalty(h, 100) + penalty(m, 100) + penalty(s, 120))); }
function weights(risk: number) { const death = Math.min(100, 5 + Math.min(risk, 10) * 10), shifted = death - 5; return { light: Math.max(0, 65 - shifted), heavy: Math.max(0, 30 - Math.max(0, shifted - 65)), death }; }
export function validConquerorBody(b: ConquerorCombatBody): boolean {
  return integer(b.enemyHealth, 0, 100) && integer(b.enemyMind, 0, 100) && integer(b.enemySpirituality, 0, 120) && integer(b.enemyRisk) && Array.isArray(b.enemyInjuries) &&
    ['RESISTING', 'SURRENDERED', 'DEAD'].includes(b.enemyStatus) && (b.enemyStatus === 'DEAD') === (b.enemyHealth === 0) && ['HAND', 'YARD'].includes(b.weaponLocation) && (b.enemyStatus !== 'DEAD' || b.weaponLocation === 'YARD') &&
    shape(b.powerUses, CONQUEROR_POWER_IDS) && CONQUEROR_POWER_IDS.every(id => integer(b.powerUses[id])) && b.enemySpirituality === 120 - CONQUEROR_POWERS.reduce((n, p) => n + p.cost * b.powerUses[p.id], 0) &&
    integer(b.focusedAttempts) && integer(b.focusedSuccesses, 0, b.focusedAttempts) && b.wardReady === false;
}
export function validConquerorInjuries(injuries: SliceInjury[], revision: number): boolean {
  return Array.isArray(injuries) && new Set(injuries.map(i => i.id)).size === injuries.length && injuries.every(i => shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && !!i.id && ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision, 0, revision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision, revision)));
}
const SOURCE_KEYS = ['runId', 'revision', 'week', 'date', 'round', 'encounterId', 'targetId', 'attemptWeek', 'startHistoryIndex', 'targetName', 'targetAge', 'targetPathway', 'targetSequence', 'targetCore', 'targetPerception',
  'actualBody', 'independentMind', 'automaticTrueGod', 'playerBodyId', 'enemyWeapon', 'weaponOwner', 'ordinaryExit', 'pursuit', 'thirdPartiesInArea', 'automaticAllyImmunity', 'freeSkillLibrary', 'policy',
  'playerHealth', 'playerMind', 'playerSpirituality', 'playerInjuries', 'playerRisk', 'physique', 'perception', 'will', 'knowledge', 'mastery', 'preparation', 'root', 'materials', 'body', 'randomSeed', 'randomCursor'];
export function validConquerorCombatSource(x: ConquerorCombatSource): boolean {
  try { const p = x.root, prep = x.preparation;
    return shape(x, SOURCE_KEYS) && shape(x.body, Object.keys(combatBody(x.body))) && validateConquerorPreparation(prep) && typeof x.runId === 'string' && !!x.runId && integer(x.revision) &&
      x.week === prep.week && isValidGameDate(x.date) && same(x.date, prep.date) && integer(x.round, 1) && integer(x.startHistoryIndex) && x.attemptWeek === x.week && x.encounterId === 'CONQUEROR_DISPUTE' && x.targetId === CONQUEROR_TARGET_ID &&
      x.targetName === '罗南·黑尔' && x.targetAge === 47 && x.targetPathway === 'original-caster' && x.targetSequence === 1 && x.targetCore === 22 && x.targetPerception === 28 &&
      x.actualBody === true && x.independentMind === true && x.automaticTrueGod === false && x.playerBodyId === `${x.runId}:body` && x.enemyWeapon === 'CQ1-RONAN-IRON-ROD' && x.weaponOwner === CONQUEROR_TARGET_ID &&
      x.ordinaryExit === 'OPEN' && x.pursuit === false && x.thirdPartiesInArea === 0 && x.automaticAllyImmunity === false && x.freeSkillLibrary === false && ['HOLD', 'FOCUS_FLAME'].includes(x.policy) &&
      [x.playerHealth, x.playerMind].every(n => integer(n, 1, 100)) && integer(x.playerSpirituality, 0, 120) && [x.physique, x.perception, x.will, x.knowledge].every(n => integer(n, 0, 500)) &&
      same({ physique: x.physique, perception: x.perception, will: x.will, knowledge: x.knowledge }, prep.after.coreStats) &&
      !!x.mastery && typeof x.mastery === 'object' && !Array.isArray(x.mastery) && same(Object.keys(x.mastery).sort(), Object.keys(prep.after.mastery).sort()) && Object.values(x.mastery).every(n => integer(n, 0, 500)) &&
      Object.entries(prep.after.mastery).every(([id, value]) => id === FOCUSED_FLAME ? x.mastery[id]! >= value : x.mastery[id] === value) &&
      integer(x.playerRisk) && validConquerorInjuries(x.playerInjuries, x.revision) && validConquerorInjuries(x.body.enemyInjuries, x.revision) && validConquerorMaterials(x.materials) &&
      x.materials.weapon.location === x.body.weaponLocation && x.materials.weapon.heatingPulses <= x.body.focusedSuccesses && x.materials.water.uses === x.body.powerUses.COOL_WEAPON &&
      validConquerorScene(p) && p.siteId === CONQUEROR_SITE && p.playerLocation === 'YARD' && p.observedSourceId === `${x.runId}:CQ1-YARD:${prep.revision}` && p.observationWeek === prep.week && p.clockSeconds === 12 + 60 * (x.round - 1) &&
      validConquerorBody(x.body) && x.body.enemyStatus === 'RESISTING' && x.body.enemyMind > 0 && typeof x.randomSeed === 'string' && !!x.randomSeed && integer(x.randomCursor) &&
      prep.runId === x.runId && prep.randomSeed === x.randomSeed && prep.randomCursor <= x.randomCursor && prep.revision <= x.revision - x.round;
  } catch { return false; }
}
export function replayConquerorCombatRound(x: ConquerorCombatSource, stance: SliceStance): { round: SliceCombatRound; outcome: ConquerorResolution } {
  if (!validConquerorCombatSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new Error('缺少真实原来源。');
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = createConquerorRuntime(x), b = r.body;
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = conquerorActionCount(playerCountRoll), enemyCount = conquerorEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: ConquerorActionEvidence[] = [], enemies: ConquerorActionEvidence[] = [], remaining = { PLAYER: playerCount, ENEMY: enemyCount }; let retreat: SliceCombatRound['retreat'] = 'NONE';
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) for (const actor of order) {
    if (!remaining[actor]) continue;
    if (actor === 'PLAYER' && stance === 'RETREAT') { remaining.PLAYER = 0; retreat = rng.nextInt(1, 100) <= 50 ? 'SUCCESS' : 'FAILURE'; if (retreat === 'SUCCESS') { remaining.ENEMY = 0; break; } continue; }
    remaining[actor]--; const index = players.length + enemies.length;
    if (actor === 'PLAYER') players.push(resolveConquerorPlayerSlot(x, r, drawConquerorAbility(rng, null, stance), index, rng)); else enemies.push(resolveConquerorEnemySlot(x, r, drawConquerorEnemyAbility(rng), index, rng));
  }
  const sum = (a: ConquerorActionEvidence[], key: 'selfGain' | 'enemyReduction') => a.reduce((n, v) => n + v[key], 0);
  const weightedCore = x.physique * .35 + x.perception * .30 + x.will * .20 + x.knowledge * .15;
  const playerAdvantage = Math.max(125, base(weightedCore, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, base(x.targetCore, x.body.enemyHealth, x.body.enemyMind, x.body.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction'));
  const winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100, winner = retreat === 'SUCCESS' ? 'ENEMY' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  let playerHealth = r.playerH, playerRisk = x.playerRisk, outcome: ConquerorResolution = retreat === 'SUCCESS' ? 'RETREATED' : 'CONTINUE';
  const playerInjuries = structuredClone(x.playerInjuries); let consequenceWeights: SliceCombatRound['consequenceWeights'] = null, consequenceRoll: number | undefined, consequenceDomain: SliceCombatRound['consequenceDomain'];
  if (retreat !== 'SUCCESS') {
    const loser = winner === 'PLAYER' ? 'ENEMY' : 'PLAYER', attacks = loser === 'PLAYER' ? enemies : players, injuries = loser === 'PLAYER' ? playerInjuries : b.enemyInjuries;
    if (attacks.some(a => a.threatens && (a.attackKind === 'BODY' || a.attackKind === 'FIRE'))) {
      let risk = loser === 'PLAYER' ? playerRisk : b.enemyRisk; if (injuries.length) risk++; if (loser === 'PLAYER') playerRisk = risk; else b.enemyRisk = risk;
      consequenceDomain = 'BODY'; consequenceWeights = weights(risk); consequenceRoll = rng.nextInt(1, 100);
      const severity = consequenceRoll <= consequenceWeights.light ? 'LIGHT' : consequenceRoll <= consequenceWeights.light + consequenceWeights.heavy ? 'HEAVY' : 'DEATH';
      if (severity === 'DEATH') { if (loser === 'PLAYER') playerHealth = 0; else { b.enemyHealth = 0; b.enemyStatus = 'DEAD'; } }
      else { injuries.push({ id: `${x.runId}:combat:${x.round}:${loser}:${x.revision + 1}:${injuries.length}`, severity, acquiredRevision: x.revision + 1, treatedRevision: null });
        const damage = severity === 'LIGHT' ? 10 : 30; if (loser === 'PLAYER') playerHealth = Math.max(0, playerHealth - damage); else b.enemyHealth = Math.max(0, b.enemyHealth - damage);
        if (b.enemyHealth === 0) b.enemyStatus = 'DEAD'; else if (loser === 'ENEMY' && severity === 'HEAVY') b.enemyStatus = 'SURRENDERED'; }
    } else if (attacks.some(a => a.mentalPressure)) {
      consequenceDomain = 'MENTAL'; if (loser === 'PLAYER') r.playerM = Math.max(0, r.playerM - 10); else { b.enemyMind = Math.max(0, b.enemyMind - 10); if (b.enemyMind === 0) b.enemyStatus = 'SURRENDERED'; }
    }
    if (playerHealth === 0) outcome = 'PLAYER_DEAD'; else if (b.enemyHealth === 0) outcome = 'ENEMY_DEAD'; else if (b.enemyStatus === 'SURRENDERED') outcome = 'ENEMY_SURRENDERED';
  }
  if (outcome === 'CONTINUE' && r.playerM === 0) outcome = 'RETREATED';
  advanceConquerorCombatClock(r, x.root.clockSeconds + 60 - r.root.clockSeconds);
  const expiredWards = structuredClone([...r.expiredWards, ...(r.ward ? [r.ward] : [])]); r.ward = null;
  if (b.enemyHealth === 0) r.materials.weapon.location = 'YARD'; b.weaponLocation = r.materials.weapon.location;
  const o: ConquerorRoundOutcome = { ...structuredClone(b), targetId: CONQUEROR_TARGET_ID, round: x.round, source: structuredClone(x), stance, continuing: outcome === 'CONTINUE',
    playerHealthAfter: playerHealth, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, playerInjuriesAfter: playerInjuries, playerRiskAfter: playerRisk, materialsAfter: structuredClone(r.materials), masteryAfter: { ...r.mastery },
    rootAfter: structuredClone(r.root), elapsedSeconds: 60, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies, expiredWards };
  const round: SliceCombatRound = { round: x.round, stance, first, playerCount, enemyCount, playerCountRoll, enemyCountRoll,
    moves: [...players, ...enemies].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })),
    playerAdvantage, enemyAdvantage, winChance, winner, consequence: '', consequenceWeights, retreat, ...(consequenceDomain === undefined ? {} : { consequenceDomain }), ...(consequenceRoll === undefined ? {} : { consequenceRoll }), conquerorOutcome: o };
  round.consequence = conquerorCombatConsequence(round); return { round, outcome };
}
export function validateConquerorRoundOutcome(v: unknown): v is ConquerorRoundOutcome { try { const o = v as ConquerorRoundOutcome; return !!o && same(o, replayConquerorCombatRound(o.source, o.stance).round.conquerorOutcome); } catch { return false; } }
export function validateConquerorCombatRound(round: SliceCombatRound): boolean { try { const o = round.conquerorOutcome; return !!o && same(round, replayConquerorCombatRound(o.source, o.stance).round); } catch { return false; } }
export function nextConquerorCombatSource(o: ConquerorRoundOutcome): ConquerorCombatSource {
  return { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter,
    playerSpirituality: Math.min(120, o.playerSpiritualityAfter + 12), playerInjuries: structuredClone(o.playerInjuriesAfter), playerRisk: o.playerRiskAfter,
    root: structuredClone(o.rootAfter), body: combatBody(o), materials: structuredClone(o.materialsAfter), mastery: { ...o.masteryAfter }, randomCursor: o.randomCursorAfter };
}
export function conquerorCombatConsequence(round: SliceCombatRound): string {
  const o = round.conquerorOutcome!, who = round.winner === 'PLAYER' ? '罗南' : '你';
  let text = round.retreat === 'SUCCESS' ? '撤离判定成功，沿普通12米出口离开。' : round.consequenceDomain === 'MENTAL' ? `${who}承受实际精神压力，精神减少10，没有新增身体伤口或身体风险。` : round.consequenceDomain === 'BODY' ? `${who}承受实际身体或火焰攻击，按共同伤势盘结算。` : '本轮下风没有实际攻击来源，不掷身体伤势盘、不增加身体风险。';
  if (o.playerHealthAfter === 0) text += '本人的原身体真实死亡，本周目终结，不复活。'; else if (o.enemyHealth === 0) text += '罗南原身体真实死亡，唯一原铁杖留地。'; else if (o.enemyStatus === 'SURRENDERED') text += '罗南因实际伤势或精神耗尽自主停止抵抗。';
  return text + ' 本轮实际60秒；未使用的临时屏护到时结束，已花灵性、精神和水不退，原铁杖只自然冷却、不恢复耐久。队员仍在家中。';
}
export function projectConquerorCombat(s: SliceState) {
  const e = s.conqueror.encounter, last = s.combat?.encounterId === 'CONQUEROR_DISPUTE' ? s.combat.lastRound?.conquerorOutcome : e.terminal ? s.combatHistory[e.terminal.historyIndex]?.conquerorOutcome : null;
  return { enemyName: isConqueror(s) ? '罗南·黑尔（47岁，独立非凡者）' : '', targetId: e.targetId, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality,
    weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses }, policy: e.policy, materials: structuredClone(e.materials),
    lastActionSequence: last ? [...last.playerActions, ...last.enemyActions].sort((a, b) => a.order - b.order) : [], countWheel: CONQUEROR_COUNT_WHEEL, enemyCountWheel: CONQUEROR_ENEMY_COUNT_WHEEL,
    enemyAbilityWheel: CONQUEROR_ENEMY_ABILITY_WHEEL, facts: [
      '本人四项属性仍按体质35%、感知30%、意志20%、知识15%；双方最多六动作，基础1250、最低125，灵性上限120。',
      '没有实际队友在场。阵势合力及继承团队能力只普通回退，不施放、不支付团队费用，不赠送军队增益。',
      '原铁杖与冷却水来自本次独立对手；热量、耐久、剩余水和落点连续保留，不动生活原铁块或旧人物原物。',
      '身体与精神后果按实际来源分别结算；部分挡火后仍为正的火焰贡献仍可致伤。普通出口开放，本人死亡即终局。' ] };
}
