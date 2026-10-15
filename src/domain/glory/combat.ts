import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { WARRIOR_ABILITY_IDS } from '../warrior/types.js';
import { GLADIATOR_ABILITY_IDS } from '../gladiator/types.js';
import { WEAPONMASTER_ABILITY_IDS } from '../weaponmaster/types.js';
import { DAWN_PALADIN_ABILITY_IDS } from '../dawn-paladin/types.js';
import { GUARDIAN_ABILITY_IDS } from '../guardian/types.js';
import { DEMON_HUNTER_ABILITY_IDS } from '../demon-hunter/types.js';
import { SILVER_KNIGHT_ABILITY_IDS } from '../silver-knight/types.js';
import { GLORY_TARGET_ID, GLORY_POWER_IDS, GLORY_POWERS, hasGloryDisputeOpponent,
  type GloryEnemyIntent, type GloryPowerId } from './encounter.js';

/** Finite G implementation. Armor reinforcement uses the same inherited physical armor and wears it
 * only when the next actual enemy BODY attack meets it. Personal close guard has no allied target:
 * one successful entry pays five health and adds defensive advantage, never an offensive attack.
 * DEFEND disables both STRIKE and silver thrust for the entire round. No old journal is mutated. */
export const GLORY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const GLORY_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const gloryActionCount = pyromaniacActionCount;
export const gloryEnemyActionCount = pyromaniacActionCount;
const ARMOR = 'warrior.s2.armor-temper', BEARING = 'warrior.s2.close-guard', THRUST = 'warrior.s3.silver-thrust';
const INHERITED_IDS = [...WARRIOR_ABILITY_IDS, ...GLADIATOR_ABILITY_IDS, ...WEAPONMASTER_ABILITY_IDS, ...DAWN_PALADIN_ABILITY_IDS, ...GUARDIAN_ABILITY_IDS, ...DEMON_HUNTER_ABILITY_IDS, ...SILVER_KNIGHT_ABILITY_IDS];
export type GloryMoveId = typeof ARMOR | typeof BEARING | typeof THRUST | 'STRIKE' | 'EVADE' | 'ACCIDENT';
const ABILITIES: readonly { id: GloryMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: ARMOR, label: '银甲淬护（6灵性/知识20，下次实际身体攻击减势45，银甲磨损5）', weight: 25, stance: 'DEFEND' },
  { id: BEARING, label: '近身护持（6灵性/意志20，成功自付5健康，防守优势30）', weight: 20, stance: 'PREPARE' },
  { id: THRUST, label: '银白细剑突刺（6灵性/知识18，沿用原掌握，可被已备屏护抵挡）', weight: 20, stance: 'ATTACK' },
  { id: 'STRIKE', label: '普通打击（实际持棍16或徒手12，受身体状态影响）', weight: 15, stance: 'ATTACK' },
  { id: 'EVADE', label: '普通避让（0灵性，减势10）', weight: 15, stance: 'DEFEND' },
  { id: 'ACCIDENT', label: '判断失误（优势−22.5）', weight: 5, stance: null },
];
export const GLORY_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'FORCE_STRIKE', label: '灵性冲击（5灵性，身体攻击优势75）', weight: 35 },
  { id: 'GUARD', label: '屏护（4灵性，随后一次普通打击减势40或抵挡一次银白细剑）', weight: 25 },
  { id: 'BODY_STRIKE', label: '持棍打击（20，受身体状态影响）', weight: 20 },
  { id: 'DISCERN', label: '辨识（3灵性，解除已准备的一次银甲淬护）', weight: 15 },
  { id: 'ACCIDENT', label: '判断失误（优势−22.5）', weight: 5 },
];
export const isGlory = (s: SliceState): boolean => s.progression.pathwayId === 'warrior' && s.progression.sequence === 2;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function gloryAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: stance === 'DEFEND' && (a.id === 'STRIKE' || a.id === THRUST) ? '整轮保持防守，本槽不攻击，不消耗灵性' : a.label, weight: weights[i]! / total * 100 }));
}
function drawPlayer(random: ActionRandomStream, stance: SliceStance | null): GloryMoveId {
  const weights = tickets(stance); let n = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return a.id; }
  throw new Error('荣耀者行动盘无效。');
}
export function drawGloryAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): GloryMoveId { return drawPlayer(random, stance); }
export function drawGloryEnemyAbility(random: ActionRandomStream): GloryEnemyIntent {
  let n = random.nextInt(1, 100);
  for (const a of GLORY_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as GloryEnemyIntent; }
  throw new Error('当前对手的行动盘无效。');
}
export type GloryArmorSource = SliceState['glory']['life']['site']['armorSource'];
export interface GloryCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'GLORY_DISPUTE'; targetId: typeof GLORY_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetName: '马丁'; targetAge: 45; targetSequence: 3; targetCore: 20;
  actualBody: true; independentMind: true; enemyWeapon: 'GL2-MARTIN-CLUB'; weaponLocation: 'HAND'; yardId: 'GL2-YARD';
  playerPosition: 'YARD'; enemyDistanceMetres: 2; ordinaryExit: 'OPEN'; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  playerInjuries: SliceInjury[]; enemyInjuries: SliceInjury[]; playerRisk: number; enemyRisk: number;
  armorId: 'SK3-LIFE-ARMOR' | null; armorWorn: boolean; armorIntegrity: number; armorSource: GloryArmorSource; inheritedMastery: Record<string, number>;
  clubHeld: boolean; playerClubId: 'town-short-club' | 'warrior-training-club' | null; physique: number; perception: number; knowledge: number; will: number;
  powerUses: Record<GloryPowerId, number>; clockSeconds: number; randomSeed: string; randomCursor: number;
}
export interface GloryCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: false }
interface ActionEvidence extends GloryCombatEffect {
  order: number; atSeconds: number; elapsedSeconds: 5; paidCost: number; healthPaid: number; physicalFactor: number; rolls: number[];
  randomCursorBefore: number; randomCursorAfter: number; playerHealthAfter: number; playerSpiritualityAfter: number; enemySpiritualityAfter: number;
  chargeGranted: boolean; chargeConsumedByOrder: number | null; chargeCancelledByOrder: number | null; appliedAmount: number;
  consumedArmorOrder: number | null; consumedGuardOrder: number | null; armorWear: number; armorIntegrityAfter: number;
}
export interface GloryPlayerAction extends ActionEvidence {
  id: GloryMoveId; attempted: boolean; succeeded: boolean; applied: boolean; resisted: boolean; fallback: 'NONE' | 'STRIKE' | 'EVADE' | 'HOLD_GUARD';
}
export interface GloryEnemyAction extends ActionEvidence { planned: GloryEnemyIntent; actual: GloryEnemyIntent | 'OBSERVE'; attackKind: 'NONE' | 'BODY' }
interface Runtime {
  playerS: number; playerH: number; enemyS: number; armorIntegrity: number; powers: Record<GloryPowerId, number>; clockSeconds: number;
  armorAttempted: boolean; bearingAttempted: boolean; guardAttempted: boolean;
  armor: GloryPlayerAction | null; guard: GloryEnemyAction | null;
}
export interface GloryRoundContext {
  source: GloryCombatSource; stance: SliceStance; finished: boolean; liveState: string; runtime: Runtime;
  playerActions: GloryPlayerAction[]; enemyActions: GloryEnemyAction[]; label: string; outcome: GloryRoundOutcome | null;
}
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]): boolean => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
const none = (label: string): GloryCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
const physicalAt = (health: number): number => health > 75 ? 1 : health > 50 ? .95 : health > 25 ? .9 : .8;
export function currentGloryCombatSource(s: SliceState): GloryCombatSource | null {
  if (!hasGloryDisputeOpponent(s)) return null;
  const e = s.glory.encounter, c = s.combat!, stats = s.character.coreStats, site = s.glory.life.site, original = s.silverKnight.life.armor, club = s.warrior.practiceClub;
  if (!site.armorSource || !site.armor || !same(site.armorSource.snapshot, original) || site.armorSource.promotionWeek !== s.silverKnight.promotionWeek || site.armor.id !== original.id || site.armor.owner !== 'PLAYER' || site.armor.formed !== original.formed || site.armor.active || site.armor.remainingSeconds !== 0 || site.armor.integrity > original.integrity) return null;
  const playerClubId = s.town.clubLocation === 'HAND' ? 'town-short-club' : club.id === 'warrior-training-club' && club.owner === '奥斯温·布莱克特' && club.custodian === 'PLAYER' && club.location === 'player:hand' ? 'warrior-training-club' : null;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'GLORY_DISPUTE', targetId: GLORY_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetName: '马丁', targetAge: 45, targetSequence: 3, targetCore: 20,
    actualBody: true, independentMind: true, enemyWeapon: 'GL2-MARTIN-CLUB', weaponLocation: 'HAND', yardId: 'GL2-YARD', playerPosition: 'YARD',
    enemyDistanceMetres: 2, ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality,
    playerInjuries: structuredClone(s.injuries), enemyInjuries: structuredClone(c.enemyInjuries), playerRisk: s.injuryRisk, enemyRisk: c.enemyRisk,
    armorId: site.armor.formed && site.armorWorn ? site.armor.id : null, armorWorn: site.armorWorn, armorIntegrity: site.armor.formed ? site.armor.integrity : 0, armorSource: structuredClone(site.armorSource), inheritedMastery: Object.fromEntries(INHERITED_IDS.map(id => [id, s.progression.mastery[id]!])),
    clubHeld: playerClubId !== null, playerClubId, physique: stats.physique, perception: stats.perception, knowledge: stats.knowledge, will: stats.will,
    powerUses: { ...e.powerUses }, clockSeconds: s.glory.life.site.clockSeconds, randomSeed: s.random.seed, randomCursor: s.random.cursor };
}
function makeRuntime(x: GloryCombatSource): Runtime {
  return { playerS: x.playerSpirituality, playerH: x.playerHealth, enemyS: x.enemySpirituality, armorIntegrity: x.armorIntegrity, powers: { ...x.powerUses }, clockSeconds: x.clockSeconds,
    armorAttempted: false, bearingAttempted: false, guardAttempted: false, armor: null, guard: null };
}
function liveState(s: SliceState): string {
  const e = s.glory.encounter;
  return stableStringify({ spirituality: s.spirituality, enemySpirituality: e.enemySpirituality, powerUses: e.powerUses, site: s.glory.life.site,
    stats: s.character.coreStats, mastery: s.progression.mastery, club: s.town.clubLocation, practiceClub: s.warrior.practiceClub,
    originalArmor: s.silverKnight.life.armor, sequence: s.progression.sequence, pathway: s.progression.pathwayId, status: s.status, city: s.world.city, activeEvent: s.activeEvent });
}
const roundOrigins = new WeakMap<GloryRoundContext, { source: string; stance: SliceStance }>();
function originalContext(r: GloryRoundContext): boolean { const origin = roundOrigins.get(r); return !!origin && origin.source === stableStringify(r.source) && origin.stance === r.stance; }
const dynamicSource = new Set(['playerHealth', 'playerSpirituality', 'enemySpirituality', 'powerUses', 'clockSeconds', 'armorIntegrity']);
function validRound(s: SliceState, r: GloryRoundContext, supplied: GloryCombatSource | null): boolean {
  const actual = currentGloryCombatSource(s);
  return originalContext(r) && !r.finished && actual !== null && supplied !== null && same(supplied, r.source) && r.liveState === liveState(s) && actual.playerHealth === r.runtime.playerH &&
    Object.entries(r.source).every(([key, value]) => dynamicSource.has(key) || same(actual[key as keyof GloryCombatSource], value));
}
export function beginGloryCombatRound(s: SliceState, stance: SliceStance, random: ActionRandomStream): GloryRoundContext {
  const source = currentGloryCombatSource(s);
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance) || !source || !validSource(source) || random.seed !== source.randomSeed || random.cursor !== source.randomCursor)
    throw new Error('缺少当前庭院、真实对手或资源来源。');
  const context: GloryRoundContext = { source, stance, finished: false, liveState: liveState(s), runtime: makeRuntime(source), playerActions: [], enemyActions: [], outcome: null, label: roundOpening(source) };
  roundOrigins.set(context, { source: stableStringify(source), stance }); return context;
}
export const createGloryCombatRound = beginGloryCombatRound;
function actionBase(r: Runtime, order: number, physical: number, cursor: number): ActionEvidence {
  return { ...none(''), order, atSeconds: r.clockSeconds, elapsedSeconds: 5, paidCost: 0, healthPaid: 0, physicalFactor: physical, rolls: [],
    randomCursorBefore: cursor, randomCursorAfter: cursor, playerHealthAfter: r.playerH, playerSpiritualityAfter: r.playerS, enemySpiritualityAfter: r.enemyS,
    chargeGranted: false, chargeConsumedByOrder: null, chargeCancelledByOrder: null, appliedAmount: 0,
    consumedArmorOrder: null, consumedGuardOrder: null, armorWear: 0, armorIntegrityAfter: r.armorIntegrity };
}
function closeAction<T extends ActionEvidence>(a: T, r: Runtime, random: ActionRandomStream): T {
  r.clockSeconds += 5; a.randomCursorAfter = random.cursor; a.playerHealthAfter = r.playerH; a.playerSpiritualityAfter = r.playerS; a.enemySpiritualityAfter = r.enemyS; a.armorIntegrityAfter = r.armorIntegrity;
  a.label += ` 这次动作耗时5秒；你余${r.playerH}健康、${r.playerS}灵性，马丁余${r.enemyS}灵性。`; return a;
}
function applyEnemyGuard(r: Runtime, a: GloryPlayerAction, order: number, thrust: boolean): void {
  if (!r.guard || !a.threatens) return;
  const guard = r.guard; guard.chargeConsumedByOrder = order; a.consumedGuardOrder = guard.order; r.guard = null;
  if (thrust) {
    guard.appliedAmount = a.selfGain; a.selfGain = 0; a.threatens = false; a.resisted = true; a.applied = false;
    guard.label += ` 随后在第${order + 1}次动作中抵挡了这一次银白细剑，屏护随之消耗。`;
    a.label += '马丁此前实际准备的屏护抵挡了这一次突刺，攻势为0，已经支付的灵性不返还。';
  } else {
    guard.enemyReduction = 40; guard.appliedAmount = 40;
    guard.label += ` 随后在第${order + 1}次动作中实际削弱普通打击40。`;
    a.label += '马丁此前准备的屏护在此时消耗一次，实际减势40。';
  }
}
function playerAction(x: GloryCombatSource, r: Runtime, stance: SliceStance, id: GloryMoveId, physical: number, order: number, random: ActionRandomStream): GloryPlayerAction {
  const a: GloryPlayerAction = { ...actionBase(r, order, physical, random.cursor), id, attempted: false, succeeded: false, applied: false, resisted: false, fallback: 'NONE' };
  const evade = (why: string) => { a.fallback = 'EVADE'; a.enemyReduction = 10; a.label = why + '你普通避让，减势10，不消耗灵性。'; };
  const ordinary = (why = '') => {
    a.fallback = id === 'STRIKE' ? 'NONE' : 'STRIKE'; a.selfGain = (x.clubHeld ? 16 : 12) * physical; a.threatens = a.selfGain > 0;
    a.label = why + `你用${x.clubHeld ? '实际握持的棍' : '自己的身体'}普通打击，优势${a.selfGain}，不消耗灵性。`;
    applyEnemyGuard(r, a, order, false);
  };
  if (stance === 'DEFEND' && (id === 'STRIKE' || id === THRUST)) {
    a.fallback = 'HOLD_GUARD'; a.label = '你整轮专心防守，这次保持守势，不发动打击或细剑突刺，不消耗灵性。';
  } else if (id === 'ACCIDENT') { a.selfGain = -22.5; a.label = '你判断失误，优势−22.5。'; }
  else if (id === 'EVADE') { a.enemyReduction = 10; a.label = '你在庭院普通避让，减势10，不消耗灵性。'; }
  else if (id === 'STRIKE') ordinary();
  else if (id === ARMOR && r.armorAttempted || id === BEARING && r.bearingAttempted) evade('本轮已经尝试过这项能力；');
  else if (id === ARMOR && (x.armorId === null || !x.armorWorn || r.armorIntegrity < 5)) evade('没有穿用可用的银甲，或完整度不足5，不能淬炼；');
  else if (id === BEARING && r.playerH <= 5) evade('健康不足以承担5点代价，未施法；');
  else if (r.playerS < 6) { if (id === THRUST) ordinary('不足6灵性，未施放细剑；'); else evade('不足6灵性，未施法；'); }
  else {
    r.playerS -= 6; a.paidCost = 6; a.attempted = true;
    if (id === ARMOR) r.armorAttempted = true;
    if (id === BEARING) r.bearingAttempted = true;
    const ability = id === BEARING ? 'will' : 'knowledge', difficulty = id === THRUST ? 18 : 20, roll = random.nextInt(1, 100); a.rolls.push(roll);
    a.succeeded = roll <= computeCheckChance({ ability, baseAbility: x[ability], difficulty, modifiers: [] });
    a.label = `${id === ARMOR ? '银甲淬护' : id === BEARING ? '近身护持' : '银白细剑突刺'}耗费6灵性，${ability === 'will' ? '意志' : '知识'}检验${roll}${a.succeeded ? '成功' : '失败，费用已付'}。`;
    if (a.succeeded) {
      if (id === ARMOR) {
        a.chargeGranted = true; r.armor = a;
        a.label += '你加固自己身上原有的银甲，只等待本轮随后一次实际身体攻击，届时减势45并磨损5完整度；目前尚未减势或磨损。';
      } else if (id === BEARING) {
        r.playerH -= 5; a.healthPaid = 5; a.selfGain = 30; a.appliedAmount = 30; a.applied = true;
        a.label += '你亲自承担近身防守的负荷，健康实际减少5，获得30防守优势。这不是攻击，本场没有同伴参与。';
      } else {
        a.selfGain = 76 * (.65 + .35 * x.inheritedMastery[THRUST]! / 500) * physical; a.appliedAmount = a.selfGain; a.threatens = a.selfGain > 0; a.applied = a.threatens;
        a.label += `你向眼前马丁的位置发起银白细剑突刺，沿用原有掌握与身体状态，攻势${a.selfGain}；你本人留在庭院，是否致伤仍由本轮交锋决定。`;
        applyEnemyGuard(r, a, order, true); if (a.resisted) a.appliedAmount = 0;
      }
    }
  }
  return closeAction(a, r, random);
}
function enemyAction(x: GloryCombatSource, r: Runtime, planned: GloryEnemyIntent, physical: number, order: number, random: ActionRandomStream): GloryEnemyAction {
  const a: GloryEnemyAction = { ...actionBase(r, order, physical, random.cursor), planned, actual: planned, attackKind: 'NONE' };
  const power = GLORY_POWERS.find(p => p.id === planned);
  if (planned === 'GUARD' && r.guardAttempted || planned === 'DISCERN' && !r.armor) a.actual = 'OBSERVE';
  else if (power && r.enemyS < power.cost) a.actual = 'BODY_STRIKE';
  if (a.actual === 'FORCE_STRIKE') {
    r.enemyS -= 5; r.powers.FORCE_STRIKE++; a.paidCost = 5; a.selfGain = 75; a.threatens = true; a.attackKind = 'BODY';
    a.label = '马丁耗费5灵性，向你施放一次灵性冲击，身体攻击优势75。';
  } else if (a.actual === 'BODY_STRIKE') {
    a.selfGain = 20 * physical; a.threatens = a.selfGain > 0; a.attackKind = 'BODY';
    a.label = `${planned !== 'BODY_STRIKE' ? '灵性不足，未施法。' : ''}马丁用自己实际持有的棍普通打击，优势${a.selfGain}，不消耗灵性。`;
  } else if (a.actual === 'GUARD') {
    r.enemyS -= 4; r.powers.GUARD++; r.guardAttempted = true; a.paidCost = 4; a.chargeGranted = true; r.guard = a;
    a.label = '马丁耗费4灵性准备屏护，本轮只削弱随后一次普通打击40，或抵挡随后一次成功的银白细剑突刺；目前减势为0。';
  } else if (a.actual === 'DISCERN') {
    const armor = r.armor!; r.enemyS -= 3; r.powers.DISCERN++; a.paidCost = 3;
    armor.chargeCancelledByOrder = order; a.consumedArmorOrder = armor.order; r.armor = null;
    armor.label += ` 随后在第${order + 1}次动作中被马丁辨识解除，没有产生减势，也未磨损银甲。`;
    a.label = '马丁耗费3灵性，辨识并解除当前这一次银甲加固；没有攻击，没有毁掉银甲，也没有免疫以后的淬炼。';
  } else if (a.actual === 'OBSERVE') a.label = planned === 'GUARD' ? '马丁本轮已经准备过屏护，这次只普通观察。' : '当前没有银甲加固可供解除，马丁只普通观察，不消耗灵性。';
  else { a.selfGain = -22.5; a.label = '马丁判断失误，优势−22.5。'; }
  if (a.attackKind === 'BODY' && a.threatens && r.armor) {
    const armor = r.armor; armor.applied = true; armor.enemyReduction = 45; armor.appliedAmount = 45; armor.chargeConsumedByOrder = order;
    a.consumedArmorOrder = armor.order; a.armorWear = 5; r.armorIntegrity -= 5; r.armor = null;
    armor.label += ` 随后在第${order + 1}次动作中实际削弱身体攻击45，同一副银甲完整度减少5。`;
    a.label += `这次身体攻击实际触及先前加固的银甲，减势45，银甲完整度降至${r.armorIntegrity}，仍可能造成身体伤势。`;
  }
  return closeAction(a, r, random);
}
function commitRuntime(s: SliceState, r: GloryRoundContext): void {
  s.health = r.runtime.playerH; s.spirituality = r.runtime.playerS; s.glory.encounter.enemySpirituality = r.runtime.enemyS;
  s.glory.encounter.powerUses = { ...r.runtime.powers }; if (s.glory.life.site.armor) s.glory.life.site.armor.integrity = r.runtime.armorIntegrity; s.glory.life.site.clockSeconds = r.runtime.clockSeconds; r.liveState = liveState(s);
}
/** Replay the already committed prefix and the next scheduled draw before changing any resource.
 * This rejects skipped counts, wrong actor order, forged action IDs, extra draws and stale contexts.
 * The received stream must consume precisely the deterministic checks proved by the replay. */
function executeNext(s: SliceState, context: GloryRoundContext, actor: 'PLAYER' | 'ENEMY', planned: GloryMoveId | GloryEnemyIntent, physical: number, random: ActionRandomStream): GloryCombatEffect | null {
  const x = context.source, rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), runtime = makeRuntime(x);
  const remaining = { PLAYER: gloryActionCount(rng.nextInt(1, 100)), ENEMY: gloryEnemyActionCount(rng.nextInt(1, 100)) };
  const order = x.round % 2 === 1 ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: GloryPlayerAction[] = [], enemies: GloryEnemyAction[] = [], committed = context.playerActions.length + context.enemyActions.length;
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) {
    for (const next of order) {
      if (!remaining[next]) continue;
      if (next === 'PLAYER' && context.stance === 'RETREAT') {
        remaining.PLAYER = 0; if (rng.nextInt(1, 100) <= 50) return null; continue;
      }
      remaining[next]--;
      const index = players.length + enemies.length, id = next === 'PLAYER' ? drawPlayer(rng, context.stance) : drawGloryEnemyAbility(rng);
      const factor = physicalAt(next === 'PLAYER' ? runtime.playerH : x.enemyHealth);
      if (index === committed && (next !== actor || id !== planned || factor !== physical || random.seed !== x.randomSeed || random.cursor !== rng.cursor ||
        !same(players, context.playerActions) || !same(enemies, context.enemyActions) || !same(runtime, context.runtime))) return null;
      const action = next === 'PLAYER'
        ? playerAction(x, runtime, context.stance, id as GloryMoveId, factor, index, rng)
        : enemyAction(x, runtime, id as GloryEnemyIntent, factor, index, rng);
      if (next === 'PLAYER') players.push(action as GloryPlayerAction); else enemies.push(action as GloryEnemyAction);
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
export function resolveGloryCombatAbility(s: SliceState, id: GloryMoveId, physical: number, random: ActionRandomStream, r: GloryRoundContext, source: GloryCombatSource | null = r.source): GloryCombatEffect {
  if (!validRound(s, r, source) || !ABILITIES.some(a => a.id === id)) return none('当前人物、现场或资源不符，未执行动作。');
  return executeNext(s, r, 'PLAYER', id, physical, random) ?? none('行动顺序或随机来源不符，未执行动作。');
}
export function resolveGloryEnemyAbility(s: SliceState, planned: GloryEnemyIntent, physical: number, random: ActionRandomStream, r: GloryRoundContext, source: GloryCombatSource | null = r.source): GloryCombatEffect {
  if (!validRound(s, r, source) || ![...GLORY_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned)) return none('对手、棍或当前资源不符，未执行动作。');
  return executeNext(s, r, 'ENEMY', planned, physical, random) ?? none('行动顺序或随机来源不符，未执行动作。');
}
export interface GloryRoundOutcome {
  targetId: typeof GLORY_TARGET_ID; round: number; source: GloryCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number;
  playerInjuriesAfter: SliceInjury[]; enemyInjuriesAfter: SliceInjury[]; playerRiskAfter: number; enemyRiskAfter: number;
  powerUses: Record<GloryPowerId, number>; armorAttempted: boolean; bearingAttempted: boolean; guardAttempted: boolean;
  expiredArmorOrder: number | null; expiredGuardOrder: number | null;
  pendingArmorAfter: false; pendingGuardAfter: false; healthPaid: number; armorIntegrityAfter: number; armorWear: number;
  clockSecondsAfter: number; elapsedSeconds: 60; randomCursorAfter: number;
  playerActions: GloryPlayerAction[]; enemyActions: GloryEnemyAction[];
}
export function finishGloryCombatRound(s: SliceState, r: GloryRoundContext, continuing = true, randomCursorAfter = s.random.cursor): GloryRoundOutcome {
  const e = s.glory.encounter, c = s.combat;
  if (!originalContext(r) || r.finished || !c || c.encounterId !== 'GLORY_DISPUTE' || c.round !== r.source.round || r.liveState !== liveState(s)) throw new Error('这个回合已结束，或现场资源发生了变化。');
  const outcome: GloryRoundOutcome = { targetId: GLORY_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus,
    playerSpiritualityBefore: r.source.playerSpirituality, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind, enemySpiritualityBefore: r.source.enemySpirituality,
    playerInjuriesAfter: structuredClone(s.injuries), enemyInjuriesAfter: structuredClone(c.enemyInjuries), playerRiskAfter: s.injuryRisk, enemyRiskAfter: c.enemyRisk,
    powerUses: { ...e.powerUses }, armorAttempted: r.runtime.armorAttempted, bearingAttempted: r.runtime.bearingAttempted, guardAttempted: r.runtime.guardAttempted,
    expiredArmorOrder: r.runtime.armor?.order ?? null, expiredGuardOrder: r.runtime.guard?.order ?? null,
    pendingArmorAfter: false, pendingGuardAfter: false, healthPaid: r.playerActions.reduce((n, a) => n + a.healthPaid, 0), armorIntegrityAfter: r.runtime.armorIntegrity, armorWear: r.source.armorIntegrity - r.runtime.armorIntegrity,
    clockSecondsAfter: r.source.clockSeconds + 60, elapsedSeconds: 60, randomCursorAfter,
    playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
  if (!validateGloryRoundOutcome(outcome)) throw new Error('回合动作、费用、随机结果或身体后果无法复核，未提交回合结算。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  if (e.enemyStatus !== 'RESISTING') e.weaponLocation = 'YARD';
  s.glory.life.site.clockSeconds = outcome.clockSecondsAfter;
  if (s.glory.life.site.armor) s.glory.life.site.armor.integrity = outcome.armorIntegrityAfter;
  r.finished = true; r.outcome = outcome; r.runtime.armor = null; r.runtime.guard = null;
  return structuredClone(outcome);
}
export function gloryRoundOutcome(r: GloryRoundContext): GloryRoundOutcome { if (!r.outcome) throw new Error('回合尚未结束。'); return structuredClone(r.outcome); }
export function projectGloryCombat(s: SliceState) {
  const e = s.glory.encounter, visible = isGlory(s), site = s.glory.life.site;
  const last = s.combat?.encounterId === 'GLORY_DISPUTE' ? s.combat.lastRound?.gloryOutcome : e.terminal ? s.combatHistory[e.terminal.historyIndex]?.gloryOutcome : null;
  return { enemyName: visible ? '马丁（45岁）' : '', targetId: visible ? e.targetId : null,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, maxSpirituality: 120,
    enemyHealth: visible ? e.enemyHealth : null, enemyMind: visible ? e.enemyMind : null, enemySpirituality: visible ? e.enemySpirituality : null,
    powerUses: visible ? { ...e.powerUses } : null, site: visible ? structuredClone(site) : null,
    armor: visible && site.armor ? { id: site.armor.id, currentIntegrity: site.armor.integrity, historicalIntegrity: site.armorSource?.snapshot.integrity ?? null } : null,
    originalExit: true, pursuit: false, distanceMetres: 2, automaticAllyImmunity: false, alliesPresent: 0, source: visible ? currentGloryCombatSource(s) : null,
    lastActionSequence: visible && last ? [...last.playerActions.map(a => ({ ...structuredClone(a), actor: 'PLAYER' as const })), ...last.enemyActions.map(a => ({ ...structuredClone(a), actor: 'ENEMY' as const }))].sort((a, b) => a.order - b.order) : [],
    countWheel: GLORY_COUNT_WHEEL.map(x => ({ ...x })), enemyCountWheel: GLORY_ENEMY_COUNT_WHEEL.map(x => ({ ...x })), enemyAbilityWheel: GLORY_ENEMY_ABILITY_WHEEL.map(x => ({ ...x })),
    summary: visible ? '银甲淬护每轮最多尝试一次，花费6灵性并通过知识20检验后，只削弱随后一次实际身体攻击45，同一副银甲磨损5；没有可用银甲时只能普通避让。近身护持每轮最多尝试一次，花费6灵性并通过意志20检验后，亲自付出5健康换取30防守优势，健康须高于5。本场没有同伴。细剑突刺沿用原掌握，花费6灵性并通过知识18检验，马丁准备的屏护能抵挡它。全力防守整轮放弃普通打击和细剑突刺，没有额外开轮费用。每次动作5秒、每回合60秒；马丁不恢复灵性，你继续交战时恢复12灵性。伤势和死亡保留，战斗不增长掌握。' : '' };
}
export type GloryCombatProjection = ReturnType<typeof projectGloryCombat>;
const SOURCE_KEYS = ['runId', 'revision', 'week', 'round', 'encounterId', 'targetId', 'attemptWeek', 'startHistoryIndex', 'targetName', 'targetAge', 'targetSequence', 'targetCore', 'actualBody', 'independentMind', 'enemyWeapon', 'weaponLocation', 'yardId', 'playerPosition', 'enemyDistanceMetres', 'ordinaryExit', 'pursuit', 'thirdPartiesInArea', 'automaticAllyImmunity', 'playerHealth', 'playerMind', 'playerSpirituality', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'playerInjuries', 'enemyInjuries', 'playerRisk', 'enemyRisk', 'armorId', 'armorWorn', 'armorIntegrity', 'armorSource', 'inheritedMastery', 'clubHeld', 'playerClubId', 'physique', 'perception', 'knowledge', 'will', 'powerUses', 'clockSeconds', 'randomSeed', 'randomCursor'] as const;
function validInjuries(v: SliceInjury[], revision: number): boolean {
  return Array.isArray(v) && new Set(v.map(i => i.id)).size === v.length && v.every(i => shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 && ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision, 1, revision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision, revision)));
}
function validArmorSource(x: GloryCombatSource): boolean {
  const a = x.armorSource;
  if (!a || !shape(a, ['root', 'promotionWeek', 'introducedWeek', 'actor', 'at', 'snapshot']) || a.root !== 'silverKnight.life.armor' || a.actor !== 'PLAYER' || a.at !== 'ENTRY' ||
    !integer(a.promotionWeek, 1, x.week) || !integer(a.introducedWeek, a.promotionWeek, x.week)) return false;
  const armor = a.snapshot;
  return shape(armor, ['id', 'owner', 'formed', 'active', 'integrity', 'remainingSeconds']) && armor.id === 'SK3-LIFE-ARMOR' && armor.owner === 'PLAYER' && typeof armor.formed === 'boolean' && armor.active === false && armor.remainingSeconds === 0 &&
    typeof x.armorWorn === 'boolean' && (armor.formed || !x.armorWorn) && integer(armor.integrity, 0, 100) && (armor.formed || armor.integrity === 0) && x.armorId === (armor.formed && x.armorWorn ? armor.id : null) && integer(x.armorIntegrity, 0, armor.integrity) && (armor.formed || x.armorIntegrity === 0);
}
function validSource(x: GloryCombatSource): boolean {
  return shape(x, SOURCE_KEYS) && typeof x.runId === 'string' && x.runId.length > 0 && integer(x.revision) && integer(x.week, 1) && integer(x.round, 1) && integer(x.startHistoryIndex) && x.attemptWeek === x.week &&
    x.encounterId === 'GLORY_DISPUTE' && x.targetId === GLORY_TARGET_ID && x.targetName === '马丁' && x.targetAge === 45 && x.targetSequence === 3 && x.targetCore === 20 && x.actualBody === true && x.independentMind === true &&
    x.enemyWeapon === 'GL2-MARTIN-CLUB' && x.weaponLocation === 'HAND' && x.yardId === 'GL2-YARD' && x.playerPosition === 'YARD' && x.enemyDistanceMetres === 2 && x.ordinaryExit === 'OPEN' && x.pursuit === false && x.thirdPartiesInArea === 0 && x.automaticAllyImmunity === false &&
    [x.playerHealth, x.playerMind, x.enemyHealth, x.enemyMind].every(n => integer(n, 1, 100)) && x.enemyMind === 100 && [x.playerSpirituality, x.enemySpirituality].every(n => integer(n, 0, 120)) &&
    validArmorSource(x) && shape(x.inheritedMastery, INHERITED_IDS) && INHERITED_IDS.every(id => integer(x.inheritedMastery[id], 0, 500)) &&
    ['town-short-club', 'warrior-training-club', null].includes(x.playerClubId) && x.clubHeld === (x.playerClubId !== null) &&
    [x.physique, x.perception, x.knowledge, x.will].every(n => integer(n, 0, 500)) && typeof x.clubHeld === 'boolean' && integer(x.playerRisk) && integer(x.enemyRisk) && integer(x.clockSeconds) &&
    validInjuries(x.playerInjuries, x.revision) && validInjuries(x.enemyInjuries, x.revision) && shape(x.powerUses, GLORY_POWER_IDS) && GLORY_POWER_IDS.every(id => integer(x.powerUses[id])) &&
    x.powerUses.GUARD <= x.round - 1 && x.powerUses.DISCERN <= x.round - 1 && x.powerUses.FORCE_STRIKE <= 6 * (x.round - 1) &&
    x.enemySpirituality === 120 - GLORY_POWERS.reduce((n, p) => n + p.cost * x.powerUses[p.id], 0) && typeof x.randomSeed === 'string' && x.randomSeed.length > 0 && x.randomSeed.length <= 256 && integer(x.randomCursor);
}
function sourcePenalty(current: number, maximum: number): number { const f = Math.max(0, Math.min(1, current / maximum)); return f > .75 ? 0 : f > .5 ? .05 : f > .25 ? .1 : .2; }
function sourceBase(core: number, health: number, mind: number, spirituality: number): number { return (1250 + Math.min(core, 250)) * (1 - Math.min(.4, sourcePenalty(health, 100) + sourcePenalty(mind, 100) + sourcePenalty(spirituality, 120))); }
function sourceWeights(risk: number): { light: number; heavy: number; death: number } { const death = Math.min(100, 5 + Math.min(risk, 10) * 10), shifted = death - 5; return { light: Math.max(0, 65 - shifted), heavy: Math.max(0, 30 - Math.max(0, shifted - 65)), death }; }
interface ReplayedRound {
  outcome: GloryRoundOutcome; playerCount: number; enemyCount: number; playerCountRoll: number; enemyCountRoll: number; first: 'PLAYER' | 'ENEMY';
  retreat: 'NONE' | 'SUCCESS' | 'FAILURE'; winner: 'PLAYER' | 'ENEMY'; playerAdvantage: number; enemyAdvantage: number; winChance: number;
  consequenceWeights: { light: number; heavy: number; death: number } | null; consequenceRoll?: number;
}
/** Deterministic full-round replay checks both draws, ordered costs, pending flags, cancelled windows,
 * real health payment, actual injury/death results and unmodified public labels. Extra fields fail equality. */
function replayOutcome(o: GloryRoundOutcome): ReplayedRound | null {
  const x = o?.source;
  if (!x || !validSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) || !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) || o.playerActions.length > 6 || o.enemyActions.length > 6) return null;
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = makeRuntime(x);
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = gloryActionCount(playerCountRoll), enemyCount = gloryEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const, remaining = { PLAYER: playerCount, ENEMY: enemyCount };
  const players: GloryPlayerAction[] = [], enemies: GloryEnemyAction[] = []; let retreat: ReplayedRound['retreat'] = 'NONE';
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) {
    for (const actor of order) {
      if (remaining[actor] === 0) continue;
      if (actor === 'PLAYER' && o.stance === 'RETREAT') { remaining.PLAYER = 0; retreat = rng.nextInt(1, 100) <= 50 ? 'SUCCESS' : 'FAILURE'; if (retreat === 'SUCCESS') { remaining.ENEMY = 0; break; } continue; }
      remaining[actor]--;
      if (actor === 'PLAYER') players.push(playerAction(x, r, o.stance, drawPlayer(rng, o.stance), physicalAt(r.playerH), players.length + enemies.length, rng));
      else enemies.push(enemyAction(x, r, drawGloryEnemyAbility(rng), physicalAt(x.enemyHealth), players.length + enemies.length, rng));
    }
  }
  if (!same(players, o.playerActions) || !same(enemies, o.enemyActions)) return null;
  const sum = (actions: { selfGain: number; enemyReduction: number }[], key: 'selfGain' | 'enemyReduction') => actions.reduce((n, a) => n + a[key], 0);
  const playerAdvantage = Math.max(125, sourceBase(x.physique * .45 + x.perception * .20 + x.will * .25 + x.knowledge * .10, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, sourceBase(20, x.enemyHealth, x.enemyMind, x.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction')), winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100;
  const winner = retreat === 'SUCCESS' ? 'ENEMY' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  let playerHealth = r.playerH, enemyHealth = x.enemyHealth, playerRisk = x.playerRisk, enemyRisk = x.enemyRisk;
  let enemyStatus: GloryRoundOutcome['enemyStatus'] = 'RESISTING', continuing = retreat !== 'SUCCESS';
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
  const expected: GloryRoundOutcome = { targetId: GLORY_TARGET_ID, round: x.round, source: structuredClone(x), stance: o.stance, continuing,
    enemyHealth, enemyMind: x.enemyMind, enemySpirituality: r.enemyS, enemyStatus,
    playerSpiritualityBefore: x.playerSpirituality, playerSpiritualityAfter: r.playerS, playerHealthAfter: playerHealth, playerMindAfter: x.playerMind, enemySpiritualityBefore: x.enemySpirituality,
    playerInjuriesAfter: playerInjuries, enemyInjuriesAfter: enemyInjuries, playerRiskAfter: playerRisk, enemyRiskAfter: enemyRisk, powerUses: r.powers,
    armorAttempted: r.armorAttempted, bearingAttempted: r.bearingAttempted, guardAttempted: r.guardAttempted,
    expiredArmorOrder: r.armor?.order ?? null, expiredGuardOrder: r.guard?.order ?? null,
    pendingArmorAfter: false, pendingGuardAfter: false, healthPaid: players.reduce((n, a) => n + a.healthPaid, 0), armorIntegrityAfter: r.armorIntegrity, armorWear: x.armorIntegrity - r.armorIntegrity,
    clockSecondsAfter: x.clockSeconds + 60, elapsedSeconds: 60, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies };
  if (!same(o, expected)) return null;
  return { outcome: expected, playerCount, enemyCount, playerCountRoll, enemyCountRoll, first, retreat, winner, playerAdvantage, enemyAdvantage, winChance, consequenceWeights, ...(consequenceRoll === undefined ? {} : { consequenceRoll }) };
}
export function validateGloryRoundOutcome(value: unknown): value is GloryRoundOutcome { try { return replayOutcome(value as GloryRoundOutcome) !== null; } catch { return false; } }
export function validateGloryCombatRound(round: SliceCombatRound): boolean {
  try {
    const o = round.gloryOutcome, replay = o ? replayOutcome(o) : null;
    if (!o || !replay || round.round !== o.round || round.stance !== o.stance || round.consequenceDomain !== 'BODY' || round.consequence !== gloryCombatConsequence(round) || !shape(round, ['round', 'stance', 'first', 'playerCount', 'enemyCount', 'playerCountRoll', 'enemyCountRoll', 'moves', 'playerAdvantage', 'enemyAdvantage', 'winChance', 'winner', 'consequence', 'consequenceWeights', 'retreat', 'consequenceDomain', 'gloryOutcome', ...(replay.consequenceRoll === undefined ? [] : ['consequenceRoll'])])) return false;
    for (const key of ['playerCount', 'enemyCount', 'playerCountRoll', 'enemyCountRoll', 'first', 'retreat', 'winner', 'playerAdvantage', 'enemyAdvantage', 'winChance', 'consequenceWeights', 'consequenceRoll'] as const) if (!same(round[key], replay[key])) return false;
    const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
      .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
    return same(round.moves, moves);
  } catch { return false; }
}
function roundOpening(x: GloryCombatSource): string {
  return `45岁的马丁持自己的棍站在庭院2米外，健康${x.enemyHealth}、精神${x.enemyMind}、灵性${x.enemySpirituality}。西莉娅与埃文已亲自退到院外。${x.armorId && x.armorWorn ? `你仍穿用原有的银甲，当前完整度${x.armorIntegrity}。` : '你目前没有可用银甲。'}`;
}
export function gloryCombatConsequence(round: SliceCombatRound): string {
  const o = round.gloryOutcome; if (!o) throw new Error('缺少荣耀者回合结果。'); let text: string;
  if (round.retreat === 'SUCCESS') text = '你通过撤离判定，停止交战，沿普通出口离开庭院。马丁仍留在原处。';
  else {
    const loser = round.winner === 'PLAYER' ? 'ENEMY' : 'PLAYER', subject = loser === 'PLAYER' ? '你' : '马丁', risk = loser === 'PLAYER' ? o.playerRiskAfter : o.enemyRiskAfter;
    if (round.consequenceRoll === undefined) text = `${subject}本回合处于下风，但没有遭受实际致伤攻击，因此没有新增身体伤势。累计风险${risk}。`;
    else {
      const weights = round.consequenceWeights!, severity = round.consequenceRoll <= weights.light ? 'LIGHT' : round.consequenceRoll <= weights.light + weights.heavy ? 'HEAVY' : 'DEATH';
      if (severity === 'DEATH') text = `${subject}伤势检验${round.consequenceRoll}/100，伤势致命，身体留在庭院的实际位置。`;
      else { text = `${subject}伤势检验${round.consequenceRoll}/100，受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康减少${severity === 'LIGHT' ? 10 : 30}。`;
        if (o.playerHealthAfter === 0 || o.enemyHealth === 0) text += '健康已降至0，伤者死亡。'; else if (o.enemyStatus === 'SURRENDERED') text += '马丁因重伤停止抵抗，将自己的棍放在脚边。'; }
    }
  }
  const armor = o.playerActions.filter(a => a.id === ARMOR).reduce((n, a) => n + a.appliedAmount, 0), bearing = o.playerActions.filter(a => a.id === BEARING).reduce((n, a) => n + a.appliedAmount, 0);
  return roundOpening(o.source) + text + ` 本轮银甲实际减势${armor}、磨损${o.armorWear}，当前完整度${o.armorIntegrityAfter}；近身护持实际获得${bearing}防守优势、亲自承担${o.healthPaid}健康。未使用的准备随回合结束失效，已付健康与灵性不退款。`;
}
