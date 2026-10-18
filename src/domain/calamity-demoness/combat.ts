import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { ASSASSIN_ABILITY_IDS } from '../assassin/types.js';
import { INSTIGATOR_ABILITY_IDS } from '../instigator/types.js';
import { WITCH_ABILITY_IDS } from '../witch/types.js';
import { PLEASURE_ABILITY_IDS } from '../pleasure/types.js';
import { PAIN_ABILITY_IDS } from '../pain/types.js';
import { DESPAIR_ABILITY_IDS } from '../despair/types.js';
import { UNAGING_DEMONESS_ABILITY_IDS } from '../unaging-demoness/types.js';
import { validateCalamityDemonessSiteState, type CalamityDemonessSiteState } from './life.js';
import { CALAMITY_DEMONESS_TARGET_ID, CALAMITY_DEMONESS_POWER_IDS, CALAMITY_DEMONESS_POWERS, hasCalamityDemonessDisputeOpponent,
  validateCalamityDemonessPreparation, type CalamityDemonessPreparation,
  type CalamityDemonessEnemyIntent, type CalamityDemonessPowerId } from './encounter.js';

/** Finite original mechanics. Every screen setup uses one of three paid physical plate charges.
 * The pending screen only meets one actual BODY attack; cancellation and expiry never refund it.
 * A successful flame pulse contributes only to this round. The inherited frost keeps its actual
 * old mastery. No previous NPC, mirror, body, item, journal, or injury is regenerated. */
export const CALAMITY_DEMONESS_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const CALAMITY_DEMONESS_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const calamityDemonessActionCount = pyromaniacActionCount;
export const calamityDemonessEnemyActionCount = pyromaniacActionCount;
const SCREEN = 'assassin.s2.mirror-screen', FLAME = 'assassin.s2.black-flame-channel', FROST = 'assassin.s7.frost';
const INHERITED_IDS = [...ASSASSIN_ABILITY_IDS, ...INSTIGATOR_ABILITY_IDS, ...WITCH_ABILITY_IDS, ...PLEASURE_ABILITY_IDS, ...PAIN_ABILITY_IDS, ...DESPAIR_ABILITY_IDS, ...UNAGING_DEMONESS_ABILITY_IDS];
export type CalamityDemonessMoveId = typeof SCREEN | typeof FLAME | typeof FROST | 'STRIKE' | 'EVADE' | 'ACCIDENT';
const ABILITIES: readonly { id: CalamityDemonessMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: SCREEN, label: '镜幕缓冲（6灵性/知识20，成功耗用镜片1次耐用次数，下次身体攻击减势45）', weight: 25, stance: 'DEFEND' },
  { id: FLAME, label: '黑焰导引（6灵性/知识20，有限攻势85，受身体状态影响）', weight: 20, stance: 'ATTACK' },
  { id: FROST, label: '继承冰霜（6灵性/知识18，沿用原掌握，有限减势35）', weight: 20, stance: 'CONTROL' },
  { id: 'STRIKE', label: '普通打击（实际持棍16或徒手12，受身体状态影响）', weight: 15, stance: 'ATTACK' },
  { id: 'EVADE', label: '普通避让（0灵性，减势10）', weight: 15, stance: 'DEFEND' },
  { id: 'ACCIDENT', label: '判断失误（优势−22.5）', weight: 5, stance: null },
];
export const CALAMITY_DEMONESS_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'FORCE_STRIKE', label: '灵性冲击（5灵性，身体攻击优势75）', weight: 35 },
  { id: 'GUARD', label: '一次屏护（4灵性，削弱随后一次实际打击或黑焰40）', weight: 25 },
  { id: 'BODY_STRIKE', label: '自有原棍打击（20，受身体状态影响）', weight: 20 },
  { id: 'DISRUPT', label: '扰断（3灵性，解除已准备的一次镜幕）', weight: 15 },
  { id: 'ACCIDENT', label: '判断失误（优势−22.5）', weight: 5 },
];
export const isCalamityDemoness = (s: SliceState): boolean => s.progression.pathwayId === 'demoness' && s.progression.sequence === 2;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function calamityDemonessAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: stance === 'DEFEND' && (a.id === 'STRIKE' || a.id === FLAME) ? '整轮保持防守，本槽不攻击，不消耗灵性' : a.label, weight: weights[i]! / total * 100 }));
}
function drawPlayer(random: ActionRandomStream, stance: SliceStance | null): CalamityDemonessMoveId {
  const weights = tickets(stance); let n = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return a.id; }
  throw new Error('灾难魔女行动盘无效。');
}
export function drawCalamityDemonessAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): CalamityDemonessMoveId { return drawPlayer(random, stance); }
export function drawCalamityDemonessEnemyAbility(random: ActionRandomStream): CalamityDemonessEnemyIntent {
  let n = random.nextInt(1, 100);
  for (const a of CALAMITY_DEMONESS_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as CalamityDemonessEnemyIntent; }
  throw new Error('当前对手的行动盘无效。');
}
export interface CalamityDemonessCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'CALAMITY_DEMONESS_DISPUTE'; targetId: typeof CALAMITY_DEMONESS_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetName: '伊瑞丝'; targetAge: 45; targetSequence: 3; targetCore: 20;
  actualBody: true; independentMind: true; enemyWeapon: 'CD2-IRIS-ROD'; weaponLocation: 'HAND'; yardId: 'CD2-YARD';
  playerPosition: 'YARD'; enemyDistanceMetres: 2; ordinaryExit: 'OPEN'; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  playerInjuries: SliceInjury[]; enemyInjuries: SliceInjury[]; playerRisk: number; enemyRisk: number;
  plateId: 'CD2-COMBAT-PLATE'; plateCharges: number; preparation: CalamityDemonessPreparation; site: CalamityDemonessSiteState;
  inheritedMastery: Record<string, number>; clubHeld: boolean; playerClubId: 'town-short-club' | null;
  physique: number; perception: number; knowledge: number; will: number;
  powerUses: Record<CalamityDemonessPowerId, number>; clockSeconds: number; randomSeed: string; randomCursor: number;
}
export interface CalamityDemonessCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: false }
interface ActionEvidence extends CalamityDemonessCombatEffect {
  order: number; atSeconds: number; elapsedSeconds: 5; paidCost: number; physicalFactor: number; rolls: number[];
  randomCursorBefore: number; randomCursorAfter: number; playerHealthAfter: number; playerSpiritualityAfter: number; enemySpiritualityAfter: number;
  chargeGranted: boolean; chargeConsumedByOrder: number | null; chargeCancelledByOrder: number | null; appliedAmount: number;
  consumedScreenOrder: number | null; consumedGuardOrder: number | null; plateChargeSpent: 0 | 1; plateChargesAfter: number;
}
export interface CalamityDemonessPlayerAction extends ActionEvidence {
  id: CalamityDemonessMoveId; attempted: boolean; succeeded: boolean; applied: boolean; resisted: boolean; fallback: 'NONE' | 'STRIKE' | 'EVADE' | 'HOLD_GUARD';
}
export interface CalamityDemonessEnemyAction extends ActionEvidence { planned: CalamityDemonessEnemyIntent; actual: CalamityDemonessEnemyIntent | 'OBSERVE'; attackKind: 'NONE' | 'BODY' }
interface Runtime {
  playerS: number; playerH: number; enemyS: number; plateCharges: number; powers: Record<CalamityDemonessPowerId, number>; clockSeconds: number;
  screenAttempted: boolean; flameAttempted: boolean; guardAttempted: boolean;
  screen: CalamityDemonessPlayerAction | null; guard: CalamityDemonessEnemyAction | null;
}
export interface CalamityDemonessRoundContext {
  source: CalamityDemonessCombatSource; stance: SliceStance; finished: boolean; liveState: string; runtime: Runtime;
  playerActions: CalamityDemonessPlayerAction[]; enemyActions: CalamityDemonessEnemyAction[]; label: string; outcome: CalamityDemonessRoundOutcome | null;
}
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]): boolean => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
const none = (label: string): CalamityDemonessCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
const physicalAt = (health: number): number => health > 75 ? 1 : health > 50 ? .95 : health > 25 ? .9 : .8;
export function currentCalamityDemonessCombatSource(s: SliceState): CalamityDemonessCombatSource | null {
  if (!hasCalamityDemonessDisputeOpponent(s)) return null;
  const e = s.calamityDemoness.encounter, c = s.combat!, stats = s.character.coreStats, site = e.currentSite, original = s.unagingDemoness.life;
  if (!site || !e.preparation || !e.plate || !e.startSite || !same(e.startSite, s.calamityDemoness.life.site) ||
    !site.source || !same(site.mirrorA, original.mirrorA) || !same(site.mirrorB, original.mirrorB) ||
    site.source.promotionWeek !== s.unagingDemoness.promotionWeek || site.source.introducedWeek !== site.introducedWeek ||
    !same(site.source.snapshot, { siteId: original.siteId, vera: original.vera, marcus: original.marcus, mirrorA: original.mirrorA, mirrorB: original.mirrorB,
      playerLocation: original.playerLocation, playerTravelMetres: original.playerTravelMetres, clockSeconds: original.clockSeconds, entry: original.entry, shutter: original.shutter })) return null;
  const playerClubId = s.town.clubLocation === 'HAND' ? 'town-short-club' : null;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'CALAMITY_DEMONESS_DISPUTE', targetId: CALAMITY_DEMONESS_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetName: '伊瑞丝', targetAge: 45, targetSequence: 3, targetCore: 20,
    actualBody: true, independentMind: true, enemyWeapon: 'CD2-IRIS-ROD', weaponLocation: 'HAND', yardId: 'CD2-YARD', playerPosition: 'YARD',
    enemyDistanceMetres: 2, ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality,
    playerInjuries: structuredClone(s.injuries), enemyInjuries: structuredClone(c.enemyInjuries), playerRisk: s.injuryRisk, enemyRisk: c.enemyRisk,
    plateId: e.plate.id, plateCharges: e.plate.charges, preparation: structuredClone(e.preparation), site: structuredClone(site),
    inheritedMastery: Object.fromEntries(INHERITED_IDS.map(id => [id, s.progression.mastery[id]!])),
    clubHeld: playerClubId !== null, playerClubId, physique: stats.physique, perception: stats.perception, knowledge: stats.knowledge, will: stats.will,
    powerUses: { ...e.powerUses }, clockSeconds: site.clockSeconds, randomSeed: s.random.seed, randomCursor: s.random.cursor };
}
function makeRuntime(x: CalamityDemonessCombatSource): Runtime {
  return { playerS: x.playerSpirituality, playerH: x.playerHealth, enemyS: x.enemySpirituality, plateCharges: x.plateCharges, powers: { ...x.powerUses }, clockSeconds: x.clockSeconds,
    screenAttempted: false, flameAttempted: false, guardAttempted: false, screen: null, guard: null };
}
function liveState(s: SliceState): string {
  const e = s.calamityDemoness.encounter;
  return stableStringify({ spirituality: s.spirituality, enemySpirituality: e.enemySpirituality, powerUses: e.powerUses, currentSite: e.currentSite,
    plate: e.plate, preparation: e.preparation, startSite: e.startSite, historicalLife: s.calamityDemoness.life,
    stats: s.character.coreStats, mastery: s.progression.mastery, club: s.town.clubLocation, originalLife: s.unagingDemoness.life,
    originalEncounter: s.unagingDemoness.encounter, sequence: s.progression.sequence, pathway: s.progression.pathwayId, status: s.status, city: s.world.city, activeEvent: s.activeEvent });
}
const roundOrigins = new WeakMap<CalamityDemonessRoundContext, { source: string; stance: SliceStance }>();
function originalContext(r: CalamityDemonessRoundContext): boolean { const origin = roundOrigins.get(r); return !!origin && origin.source === stableStringify(r.source) && origin.stance === r.stance; }
const dynamicSource = new Set(['playerHealth', 'playerSpirituality', 'enemySpirituality', 'powerUses', 'clockSeconds', 'plateCharges', 'site']);
function validRound(s: SliceState, r: CalamityDemonessRoundContext, supplied: CalamityDemonessCombatSource | null): boolean {
  const actual = currentCalamityDemonessCombatSource(s);
  return originalContext(r) && !r.finished && actual !== null && supplied !== null && same(supplied, r.source) && r.liveState === liveState(s) && actual.playerHealth === r.runtime.playerH && actual.plateCharges === r.runtime.plateCharges && actual.clockSeconds === r.runtime.clockSeconds &&
    same(actual.site, { ...r.source.site, clockSeconds: r.runtime.clockSeconds }) &&
    Object.entries(r.source).every(([key, value]) => dynamicSource.has(key) || same(actual[key as keyof CalamityDemonessCombatSource], value));
}
export function beginCalamityDemonessCombatRound(s: SliceState, stance: SliceStance, random: ActionRandomStream): CalamityDemonessRoundContext {
  const source = currentCalamityDemonessCombatSource(s);
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance) || !source || !validSource(source) || random.seed !== source.randomSeed || random.cursor !== source.randomCursor)
    throw new Error('缺少当前庭院、真实对手或资源来源。');
  const context: CalamityDemonessRoundContext = { source, stance, finished: false, liveState: liveState(s), runtime: makeRuntime(source), playerActions: [], enemyActions: [], outcome: null, label: roundOpening(source) };
  roundOrigins.set(context, { source: stableStringify(source), stance }); return context;
}
export const createCalamityDemonessCombatRound = beginCalamityDemonessCombatRound;
function actionBase(r: Runtime, order: number, physical: number, cursor: number): ActionEvidence {
  return { ...none(''), order, atSeconds: r.clockSeconds, elapsedSeconds: 5, paidCost: 0, physicalFactor: physical, rolls: [],
    randomCursorBefore: cursor, randomCursorAfter: cursor, playerHealthAfter: r.playerH, playerSpiritualityAfter: r.playerS, enemySpiritualityAfter: r.enemyS,
    chargeGranted: false, chargeConsumedByOrder: null, chargeCancelledByOrder: null, appliedAmount: 0,
    consumedScreenOrder: null, consumedGuardOrder: null, plateChargeSpent: 0, plateChargesAfter: r.plateCharges };
}
function closeAction<T extends ActionEvidence>(a: T, r: Runtime, random: ActionRandomStream): T {
  r.clockSeconds += 5; a.randomCursorAfter = random.cursor; a.playerHealthAfter = r.playerH; a.playerSpiritualityAfter = r.playerS; a.enemySpiritualityAfter = r.enemyS; a.plateChargesAfter = r.plateCharges;
  a.label += ` 这次动作耗时5秒；你余${r.playerH}健康、${r.playerS}灵性，伊瑞丝余${r.enemyS}灵性。`; return a;
}
function applyEnemyGuard(r: Runtime, a: CalamityDemonessPlayerAction, order: number): void {
  if (!r.guard || !a.threatens) return;
  const guard = r.guard; guard.chargeConsumedByOrder = order; a.consumedGuardOrder = guard.order; r.guard = null;
  guard.enemyReduction = 40; guard.appliedAmount = 40;
  guard.label += ` 随后在第${order + 1}次动作中实际削弱这一次攻击40，屏护随即消耗。`;
  a.label += '伊瑞丝此前准备的屏护在此时消耗一次，实际减势40。';
}
function playerAction(x: CalamityDemonessCombatSource, r: Runtime, stance: SliceStance, id: CalamityDemonessMoveId, physical: number, order: number, random: ActionRandomStream): CalamityDemonessPlayerAction {
  const a: CalamityDemonessPlayerAction = { ...actionBase(r, order, physical, random.cursor), id, attempted: false, succeeded: false, applied: false, resisted: false, fallback: 'NONE' };
  const evade = (why: string) => { a.fallback = 'EVADE'; a.enemyReduction = 10; a.label = why + '你普通避让，减势10，不消耗灵性。'; };
  const ordinary = (why = '') => {
    a.fallback = id === 'STRIKE' ? 'NONE' : 'STRIKE'; a.selfGain = (x.clubHeld ? 16 : 12) * physical; a.threatens = a.selfGain > 0;
    a.label = why + `你用${x.clubHeld ? '实际握持的原短棍' : '自己的身体'}普通打击，优势${a.selfGain}，不消耗灵性。`;
    applyEnemyGuard(r, a, order);
  };
  if (stance === 'DEFEND' && (id === 'STRIKE' || id === FLAME)) {
    a.fallback = 'HOLD_GUARD'; a.label = '你整轮专心防守，这次保持守势，不发动打击或黑焰，不消耗灵性。';
  } else if (id === 'ACCIDENT') { a.selfGain = -22.5; a.label = '你判断失误，优势−22.5。'; }
  else if (id === 'EVADE') { a.enemyReduction = 10; a.label = '你在庭院普通避让，减势10，不消耗灵性。'; }
  else if (id === 'STRIKE') ordinary();
  else if ((id === SCREEN && r.screenAttempted) || (id === FLAME && r.flameAttempted)) evade('本轮已经尝试过这项能力；');
  else if (id === SCREEN && r.plateCharges <= 0) evade('这片实际镜片的三次耐用次数已经耗尽，未施镜幕；');
  else if (r.playerS < 6) { if (id === FLAME) ordinary('不足6灵性，未施放黑焰；'); else evade('不足6灵性，未施法；'); }
  else {
    r.playerS -= 6; a.paidCost = 6; a.attempted = true;
    if (id === SCREEN) r.screenAttempted = true;
    if (id === FLAME) r.flameAttempted = true;
    const difficulty = id === FROST ? 18 : 20, roll = random.nextInt(1, 100); a.rolls.push(roll);
    a.succeeded = roll <= computeCheckChance({ ability: 'knowledge', baseAbility: x.knowledge, difficulty, modifiers: [] });
    a.label = `${id === SCREEN ? '镜幕缓冲' : id === FLAME ? '黑焰导引' : '继承冰霜'}耗费6灵性，知识检验${roll}${a.succeeded ? '成功' : '失败，费用已付'}。`;
    if (a.succeeded) {
      if (id === SCREEN) {
        r.plateCharges--; a.plateChargeSpent = 1; a.chargeGranted = true; r.screen = a;
        a.label += '同一片付费镜片实际耗去一次耐用次数，等待本轮随后一次实际身体攻击，届时减势45；尚未受到攻击就不虚报缓冲。扰断或过期不归还次数或灵性。';
      } else if (id === FLAME) {
        a.selfGain = 85 * physical; a.appliedAmount = a.selfGain; a.threatens = a.selfGain > 0; a.applied = a.threatens;
        a.label += `黑焰向眼前实际对手发出一次有限脉冲，攻势${a.selfGain}；不能删除他人、灵魂或现场污染，是否致伤仍由本轮交锋决定。`;
        applyEnemyGuard(r, a, order);
      } else {
        a.enemyReduction = 35 * (.65 + .35 * x.inheritedMastery[FROST]! / 500); a.appliedAmount = a.enemyReduction; a.applied = true;
        a.label += `按原冰霜掌握取得${a.enemyReduction}有限减势，不冻结全场、不删除对手动作，也不恢复已损坏物品。`;
      }
    }
  }
  return closeAction(a, r, random);
}
function enemyAction(_x: CalamityDemonessCombatSource, r: Runtime, planned: CalamityDemonessEnemyIntent, physical: number, order: number, random: ActionRandomStream): CalamityDemonessEnemyAction {
  const a: CalamityDemonessEnemyAction = { ...actionBase(r, order, physical, random.cursor), planned, actual: planned, attackKind: 'NONE' };
  const power = CALAMITY_DEMONESS_POWERS.find(p => p.id === planned);
  if ((planned === 'GUARD' && r.guardAttempted) || (planned === 'DISRUPT' && !r.screen)) a.actual = 'OBSERVE';
  else if (power && r.enemyS < power.cost) a.actual = 'BODY_STRIKE';
  if (a.actual === 'FORCE_STRIKE') {
    r.enemyS -= 5; r.powers.FORCE_STRIKE++; a.paidCost = 5; a.selfGain = 75; a.threatens = true; a.attackKind = 'BODY';
    a.label = '伊瑞丝耗费自身5灵性，向你施放一次灵性冲击，身体攻击优势75。';
  } else if (a.actual === 'BODY_STRIKE') {
    a.selfGain = 20 * physical; a.threatens = a.selfGain > 0; a.attackKind = 'BODY';
    a.label = `${planned !== 'BODY_STRIKE' ? '灵性不足，未施法。' : ''}伊瑞丝持自己的CD2-IRIS-ROD普通打击，优势${a.selfGain}，不消耗灵性。`;
  } else if (a.actual === 'GUARD') {
    r.enemyS -= 4; r.powers.GUARD++; r.guardAttempted = true; a.paidCost = 4; a.chargeGranted = true; r.guard = a;
    a.label = '伊瑞丝耗费4灵性准备屏护，本轮只削弱随后一次实际普通打击或黑焰40；目前减势为0。';
  } else if (a.actual === 'DISRUPT') {
    const screen = r.screen!; r.enemyS -= 3; r.powers.DISRUPT++; a.paidCost = 3;
    screen.chargeCancelledByOrder = order; a.consumedScreenOrder = screen.order; r.screen = null;
    screen.label += ` 随后在第${order + 1}次动作中被伊瑞丝扰断，没有产生缓冲，已消耗镜片次数与灵性不返还。`;
    a.label = '伊瑞丝耗费3灵性，扰断当前这一次镜幕；没有攻击原镜，也没有免疫以后的镜幕。';
  } else if (a.actual === 'OBSERVE') a.label = planned === 'GUARD' ? '伊瑞丝本轮已经准备过屏护，这次只普通观察。' : '当前没有镜幕可供扰断，伊瑞丝只普通观察，不消耗灵性。';
  else { a.selfGain = -22.5; a.label = '伊瑞丝判断失误，优势−22.5。'; }
  if (a.attackKind === 'BODY' && a.threatens && r.screen) {
    const screen = r.screen; screen.applied = true; screen.enemyReduction = 45; screen.appliedAmount = 45; screen.chargeConsumedByOrder = order;
    a.consumedScreenOrder = screen.order; r.screen = null;
    screen.label += ` 随后在第${order + 1}次动作中实际缓冲身体攻击45，这次镜幕随即结束。`;
    a.label += '这次身体攻击实际触及先前镜幕，减势45；仍进入共同身体伤势盘，不保证免伤。';
  }
  return closeAction(a, r, random);
}
function commitRuntime(s: SliceState, r: CalamityDemonessRoundContext): void {
  const e = s.calamityDemoness.encounter;
  s.health = r.runtime.playerH; s.spirituality = r.runtime.playerS; e.enemySpirituality = r.runtime.enemyS;
  e.powerUses = { ...r.runtime.powers }; e.plate!.charges = r.runtime.plateCharges; e.currentSite!.clockSeconds = r.runtime.clockSeconds; r.liveState = liveState(s);
}
/** Replay the already committed prefix and the next scheduled draw before changing any resource.
 * This rejects skipped counts, wrong actor order, forged action IDs, extra draws and stale contexts.
 * The received stream must consume precisely the deterministic checks proved by the replay. */
function executeNext(s: SliceState, context: CalamityDemonessRoundContext, actor: 'PLAYER' | 'ENEMY', planned: CalamityDemonessMoveId | CalamityDemonessEnemyIntent, physical: number, random: ActionRandomStream): CalamityDemonessCombatEffect | null {
  const x = context.source, rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), runtime = makeRuntime(x);
  const remaining = { PLAYER: calamityDemonessActionCount(rng.nextInt(1, 100)), ENEMY: calamityDemonessEnemyActionCount(rng.nextInt(1, 100)) };
  const order = x.round % 2 === 1 ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: CalamityDemonessPlayerAction[] = [], enemies: CalamityDemonessEnemyAction[] = [], committed = context.playerActions.length + context.enemyActions.length;
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) {
    for (const next of order) {
      if (!remaining[next]) continue;
      if (next === 'PLAYER' && context.stance === 'RETREAT') {
        remaining.PLAYER = 0; if (rng.nextInt(1, 100) <= 50) return null; continue;
      }
      remaining[next]--;
      const index = players.length + enemies.length, id = next === 'PLAYER' ? drawPlayer(rng, context.stance) : drawCalamityDemonessEnemyAbility(rng);
      const factor = physicalAt(next === 'PLAYER' ? runtime.playerH : x.enemyHealth);
      if (index === committed && (next !== actor || id !== planned || factor !== physical || random.seed !== x.randomSeed || random.cursor !== rng.cursor ||
        !same(players, context.playerActions) || !same(enemies, context.enemyActions) || !same(runtime, context.runtime))) return null;
      const action = next === 'PLAYER'
        ? playerAction(x, runtime, context.stance, id as CalamityDemonessMoveId, factor, index, rng)
        : enemyAction(x, runtime, id as CalamityDemonessEnemyIntent, factor, index, rng);
      if (next === 'PLAYER') players.push(action as CalamityDemonessPlayerAction); else enemies.push(action as CalamityDemonessEnemyAction);
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
export function resolveCalamityDemonessCombatAbility(s: SliceState, id: CalamityDemonessMoveId, physical: number, random: ActionRandomStream, r: CalamityDemonessRoundContext, source: CalamityDemonessCombatSource | null = r.source): CalamityDemonessCombatEffect {
  if (!validRound(s, r, source) || !ABILITIES.some(a => a.id === id)) return none('当前人物、现场或资源不符，未执行动作。');
  return executeNext(s, r, 'PLAYER', id, physical, random) ?? none('行动顺序或随机来源不符，未执行动作。');
}
export function resolveCalamityDemonessEnemyAbility(s: SliceState, planned: CalamityDemonessEnemyIntent, physical: number, random: ActionRandomStream, r: CalamityDemonessRoundContext, source: CalamityDemonessCombatSource | null = r.source): CalamityDemonessCombatEffect {
  if (!validRound(s, r, source) || ![...CALAMITY_DEMONESS_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned)) return none('对手、棍或当前资源不符，未执行动作。');
  return executeNext(s, r, 'ENEMY', planned, physical, random) ?? none('行动顺序或随机来源不符，未执行动作。');
}
export interface CalamityDemonessRoundOutcome {
  targetId: typeof CALAMITY_DEMONESS_TARGET_ID; round: number; source: CalamityDemonessCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number;
  playerInjuriesAfter: SliceInjury[]; enemyInjuriesAfter: SliceInjury[]; playerRiskAfter: number; enemyRiskAfter: number;
  powerUses: Record<CalamityDemonessPowerId, number>; screenAttempted: boolean; flameAttempted: boolean; guardAttempted: boolean;
  expiredScreenOrder: number | null; expiredGuardOrder: number | null;
  pendingScreenAfter: false; pendingGuardAfter: false; plateChargesAfter: number; plateChargesSpent: number;
  clockSecondsAfter: number; elapsedSeconds: 60; randomCursorAfter: number;
  playerActions: CalamityDemonessPlayerAction[]; enemyActions: CalamityDemonessEnemyAction[];
}
export function finishCalamityDemonessCombatRound(s: SliceState, r: CalamityDemonessRoundContext, continuing = true, randomCursorAfter = s.random.cursor): CalamityDemonessRoundOutcome {
  const e = s.calamityDemoness.encounter, c = s.combat;
  if (!originalContext(r) || r.finished || !c || c.encounterId !== 'CALAMITY_DEMONESS_DISPUTE' || c.round !== r.source.round || r.liveState !== liveState(s)) throw new Error('这个回合已结束，或现场资源发生了变化。');
  const outcome: CalamityDemonessRoundOutcome = { targetId: CALAMITY_DEMONESS_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus,
    playerSpiritualityBefore: r.source.playerSpirituality, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind, enemySpiritualityBefore: r.source.enemySpirituality,
    playerInjuriesAfter: structuredClone(s.injuries), enemyInjuriesAfter: structuredClone(c.enemyInjuries), playerRiskAfter: s.injuryRisk, enemyRiskAfter: c.enemyRisk,
    powerUses: { ...e.powerUses }, screenAttempted: r.runtime.screenAttempted, flameAttempted: r.runtime.flameAttempted, guardAttempted: r.runtime.guardAttempted,
    expiredScreenOrder: r.runtime.screen?.order ?? null, expiredGuardOrder: r.runtime.guard?.order ?? null,
    pendingScreenAfter: false, pendingGuardAfter: false, plateChargesAfter: r.runtime.plateCharges, plateChargesSpent: r.source.plateCharges - r.runtime.plateCharges,
    clockSecondsAfter: r.source.clockSeconds + 60, elapsedSeconds: 60, randomCursorAfter,
    playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
  if (!validateCalamityDemonessRoundOutcome(outcome)) throw new Error('回合动作、费用、随机结果或身体后果无法复核，未提交回合结算。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  if (e.enemyStatus !== 'RESISTING') e.weaponLocation = 'YARD';
  e.currentSite!.clockSeconds = outcome.clockSecondsAfter; e.plate!.charges = outcome.plateChargesAfter;
  r.finished = true; r.outcome = outcome; r.runtime.screen = null; r.runtime.guard = null;
  return structuredClone(outcome);
}
export function calamityDemonessRoundOutcome(r: CalamityDemonessRoundContext): CalamityDemonessRoundOutcome { if (!r.outcome) throw new Error('回合尚未结束。'); return structuredClone(r.outcome); }
export function projectCalamityDemonessCombat(s: SliceState) {
  const e = s.calamityDemoness.encounter, visible = isCalamityDemoness(s), site = e.currentSite;
  const last = s.combat?.encounterId === 'CALAMITY_DEMONESS_DISPUTE' ? s.combat.lastRound?.calamityDemonessOutcome : e.terminal ? s.combatHistory[e.terminal.historyIndex]?.calamityDemonessOutcome : null;
  return { enemyName: visible ? '伊瑞丝（45岁）' : '', targetId: visible ? e.targetId : null,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, maxSpirituality: 120,
    enemyHealth: visible ? e.enemyHealth : null, enemyMind: visible ? e.enemyMind : null, enemySpirituality: visible ? e.enemySpirituality : null,
    powerUses: visible ? { ...e.powerUses } : null, site: visible && site ? structuredClone(site) : null,
    plate: visible && e.plate ? structuredClone(e.plate) : null,
    originalExit: true, pursuit: false, distanceMetres: 2, automaticAllyImmunity: false, alliesPresent: 0, source: visible ? currentCalamityDemonessCombatSource(s) : null,
    lastActionSequence: visible && last ? [...last.playerActions.map(a => ({ ...structuredClone(a), actor: 'PLAYER' as const })), ...last.enemyActions.map(a => ({ ...structuredClone(a), actor: 'ENEMY' as const }))].sort((a, b) => a.order - b.order) : [],
    countWheel: CALAMITY_DEMONESS_COUNT_WHEEL.map(x => ({ ...x })), enemyCountWheel: CALAMITY_DEMONESS_ENEMY_COUNT_WHEEL.map(x => ({ ...x })), enemyAbilityWheel: CALAMITY_DEMONESS_ENEMY_ABILITY_WHEEL.map(x => ({ ...x })),
    summary: visible ? '镜幕缓冲每轮最多尝试一次，花6灵性、知识20检验，成功耗用实际付费镜片的一次耐用次数，只削弱随后一次身体攻击45。镜片一共三次，不自动修补；扰断或过期不退款。黑焰导引每轮最多尝试一次，花6灵性、知识20检验，成功取得85×身体状态攻势。冰霜花6灵性、知识18检验，以原掌握取得35×掌握系数有限减势。全力防守整轮放弃普通打击和黑焰；伊瑞丝的屏护只削弱一次实际打击或黑焰40。各动作5秒、每回合60秒；只有你继续交战时恢复12灵性，对手不恢复。没有同行者，原镜仍在馆内，伤势与死亡如实保留。' : '' };
}
export type CalamityDemonessCombatProjection = ReturnType<typeof projectCalamityDemonessCombat>;
const SOURCE_KEYS = ['runId', 'revision', 'week', 'round', 'encounterId', 'targetId', 'attemptWeek', 'startHistoryIndex', 'targetName', 'targetAge', 'targetSequence', 'targetCore', 'actualBody', 'independentMind', 'enemyWeapon', 'weaponLocation', 'yardId', 'playerPosition', 'enemyDistanceMetres', 'ordinaryExit', 'pursuit', 'thirdPartiesInArea', 'automaticAllyImmunity', 'playerHealth', 'playerMind', 'playerSpirituality', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'playerInjuries', 'enemyInjuries', 'playerRisk', 'enemyRisk', 'plateId', 'plateCharges', 'preparation', 'site', 'inheritedMastery', 'clubHeld', 'playerClubId', 'physique', 'perception', 'knowledge', 'will', 'powerUses', 'clockSeconds', 'randomSeed', 'randomCursor'] as const;
function validInjuries(v: SliceInjury[], revision: number): boolean {
  return Array.isArray(v) && new Set(v.map(i => i.id)).size === v.length && v.every(i => shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 && ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision, 1, revision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision, revision)));
}
function validSceneSource(x: CalamityDemonessCombatSource): boolean {
  const p = x.site;
  return validateCalamityDemonessSiteState(p) && p.siteId === 'CD2-GALLERY-ANNEX' && p.source !== null && p.introducedWeek !== null && p.introducedWeek <= x.week &&
    p.playerLocation === 'YARD' && integer(p.playerEnergy, 2, 100) && p.clockSeconds === x.clockSeconds &&
    p.vera?.id === 'UD3-VERA' && p.vera.age === 46 && p.vera.alive && p.vera.location === 'OUTSIDE' &&
    p.marcus?.id === 'UD3-MARCUS' && p.marcus.age === 41 && p.marcus.alive && p.marcus.location === 'OUTSIDE' &&
    p.mirrorA?.id === 'UD3-MIRROR-A' && p.mirrorB?.id === 'UD3-MIRROR-B' && !p.screen.active && p.box.state === 'CLOSED' &&
    p.residue !== null && ['CONSUMED', 'HANDED_OVER'].includes(p.residue.status) && p.plates.every(v => v.status === 'RETURNED' && v.location === 'CUSTODIAN') &&
    validateCalamityDemonessPreparation(x.preparation) && x.preparation.week <= x.week && x.preparation.revision < x.revision &&
    x.preparation.runId === x.runId && x.preparation.randomSeed === x.randomSeed && x.preparation.randomCursor <= x.randomCursor &&
    x.clockSeconds === x.preparation.lifeClockSeconds + 8 + 60 * (x.round - 1) &&
    x.plateId === 'CD2-COMBAT-PLATE' && integer(x.plateCharges, 0, 3);
}
function validSource(x: CalamityDemonessCombatSource): boolean {
  return shape(x, SOURCE_KEYS) && typeof x.runId === 'string' && x.runId.length > 0 && integer(x.revision) && integer(x.week, 1) && integer(x.round, 1) && integer(x.startHistoryIndex) && x.attemptWeek === x.week &&
    x.encounterId === 'CALAMITY_DEMONESS_DISPUTE' && x.targetId === CALAMITY_DEMONESS_TARGET_ID && x.targetName === '伊瑞丝' && x.targetAge === 45 && x.targetSequence === 3 && x.targetCore === 20 && x.actualBody === true && x.independentMind === true &&
    x.enemyWeapon === 'CD2-IRIS-ROD' && x.weaponLocation === 'HAND' && x.yardId === 'CD2-YARD' && x.playerPosition === 'YARD' && x.enemyDistanceMetres === 2 && x.ordinaryExit === 'OPEN' && x.pursuit === false && x.thirdPartiesInArea === 0 && x.automaticAllyImmunity === false &&
    [x.playerHealth, x.playerMind, x.enemyHealth, x.enemyMind].every(n => integer(n, 1, 100)) && x.enemyMind === 100 && [x.playerSpirituality, x.enemySpirituality].every(n => integer(n, 0, 120)) &&
    validSceneSource(x) && shape(x.inheritedMastery, INHERITED_IDS) && INHERITED_IDS.every(id => integer(x.inheritedMastery[id], 0, 500)) &&
    ['town-short-club', null].includes(x.playerClubId) && x.clubHeld === (x.playerClubId !== null) &&
    [x.physique, x.perception, x.knowledge, x.will].every(n => integer(n, 0, 500)) && typeof x.clubHeld === 'boolean' && integer(x.playerRisk) && integer(x.enemyRisk) && integer(x.clockSeconds) &&
    validInjuries(x.playerInjuries, x.revision) && validInjuries(x.enemyInjuries, x.revision) && shape(x.powerUses, CALAMITY_DEMONESS_POWER_IDS) && CALAMITY_DEMONESS_POWER_IDS.every(id => integer(x.powerUses[id])) &&
    x.powerUses.GUARD <= x.round - 1 && x.powerUses.DISRUPT <= x.round - 1 && x.powerUses.FORCE_STRIKE <= 6 * (x.round - 1) &&
    x.enemySpirituality === 120 - CALAMITY_DEMONESS_POWERS.reduce((n, p) => n + p.cost * x.powerUses[p.id], 0) && typeof x.randomSeed === 'string' && x.randomSeed.length > 0 && x.randomSeed.length <= 256 && integer(x.randomCursor);
}
function sourcePenalty(current: number, maximum: number): number { const f = Math.max(0, Math.min(1, current / maximum)); return f > .75 ? 0 : f > .5 ? .05 : f > .25 ? .1 : .2; }
function sourceBase(core: number, health: number, mind: number, spirituality: number): number { return (1250 + Math.min(core, 250)) * (1 - Math.min(.4, sourcePenalty(health, 100) + sourcePenalty(mind, 100) + sourcePenalty(spirituality, 120))); }
function sourceWeights(risk: number): { light: number; heavy: number; death: number } { const death = Math.min(100, 5 + Math.min(risk, 10) * 10), shifted = death - 5; return { light: Math.max(0, 65 - shifted), heavy: Math.max(0, 30 - Math.max(0, shifted - 65)), death }; }
interface ReplayedRound {
  outcome: CalamityDemonessRoundOutcome; playerCount: number; enemyCount: number; playerCountRoll: number; enemyCountRoll: number; first: 'PLAYER' | 'ENEMY';
  retreat: 'NONE' | 'SUCCESS' | 'FAILURE'; winner: 'PLAYER' | 'ENEMY'; playerAdvantage: number; enemyAdvantage: number; winChance: number;
  consequenceWeights: { light: number; heavy: number; death: number } | null; consequenceRoll?: number;
}
/** Deterministic full-round replay checks both draws, ordered costs, pending flags, cancelled windows,
 * paid finite plate charges, actual injury/death results and unmodified public labels. Extra fields fail equality. */
function replayOutcome(o: CalamityDemonessRoundOutcome): ReplayedRound | null {
  const x = o?.source;
  if (!x || !validSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) || !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) || o.playerActions.length > 6 || o.enemyActions.length > 6) return null;
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = makeRuntime(x);
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = calamityDemonessActionCount(playerCountRoll), enemyCount = calamityDemonessEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const, remaining = { PLAYER: playerCount, ENEMY: enemyCount };
  const players: CalamityDemonessPlayerAction[] = [], enemies: CalamityDemonessEnemyAction[] = []; let retreat: ReplayedRound['retreat'] = 'NONE';
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) {
    for (const actor of order) {
      if (remaining[actor] === 0) continue;
      if (actor === 'PLAYER' && o.stance === 'RETREAT') { remaining.PLAYER = 0; retreat = rng.nextInt(1, 100) <= 50 ? 'SUCCESS' : 'FAILURE'; if (retreat === 'SUCCESS') { remaining.ENEMY = 0; break; } continue; }
      remaining[actor]--;
      if (actor === 'PLAYER') players.push(playerAction(x, r, o.stance, drawPlayer(rng, o.stance), physicalAt(r.playerH), players.length + enemies.length, rng));
      else enemies.push(enemyAction(x, r, drawCalamityDemonessEnemyAbility(rng), physicalAt(x.enemyHealth), players.length + enemies.length, rng));
    }
  }
  if (!same(players, o.playerActions) || !same(enemies, o.enemyActions)) return null;
  const sum = (actions: { selfGain: number; enemyReduction: number }[], key: 'selfGain' | 'enemyReduction') => actions.reduce((n, a) => n + a[key], 0);
  const playerAdvantage = Math.max(125, sourceBase(x.physique * .25 + x.perception * .30 + x.will * .30 + x.knowledge * .15, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, sourceBase(20, x.enemyHealth, x.enemyMind, x.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction')), winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100;
  const winner = retreat === 'SUCCESS' ? 'ENEMY' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  let playerHealth = r.playerH, enemyHealth = x.enemyHealth, playerRisk = x.playerRisk, enemyRisk = x.enemyRisk;
  let enemyStatus: CalamityDemonessRoundOutcome['enemyStatus'] = 'RESISTING', continuing = retreat !== 'SUCCESS';
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
  const expected: CalamityDemonessRoundOutcome = { targetId: CALAMITY_DEMONESS_TARGET_ID, round: x.round, source: structuredClone(x), stance: o.stance, continuing,
    enemyHealth, enemyMind: x.enemyMind, enemySpirituality: r.enemyS, enemyStatus,
    playerSpiritualityBefore: x.playerSpirituality, playerSpiritualityAfter: r.playerS, playerHealthAfter: playerHealth, playerMindAfter: x.playerMind, enemySpiritualityBefore: x.enemySpirituality,
    playerInjuriesAfter: playerInjuries, enemyInjuriesAfter: enemyInjuries, playerRiskAfter: playerRisk, enemyRiskAfter: enemyRisk, powerUses: r.powers,
    screenAttempted: r.screenAttempted, flameAttempted: r.flameAttempted, guardAttempted: r.guardAttempted,
    expiredScreenOrder: r.screen?.order ?? null, expiredGuardOrder: r.guard?.order ?? null,
    pendingScreenAfter: false, pendingGuardAfter: false, plateChargesAfter: r.plateCharges, plateChargesSpent: x.plateCharges - r.plateCharges,
    clockSecondsAfter: x.clockSeconds + 60, elapsedSeconds: 60, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies };
  if (!same(o, expected)) return null;
  return { outcome: expected, playerCount, enemyCount, playerCountRoll, enemyCountRoll, first, retreat, winner, playerAdvantage, enemyAdvantage, winChance, consequenceWeights, ...(consequenceRoll === undefined ? {} : { consequenceRoll }) };
}
export function validateCalamityDemonessRoundOutcome(value: unknown): value is CalamityDemonessRoundOutcome { try { return replayOutcome(value as CalamityDemonessRoundOutcome) !== null; } catch { return false; } }
export function validateCalamityDemonessCombatRound(round: SliceCombatRound): boolean {
  try {
    const o = round.calamityDemonessOutcome, replay = o ? replayOutcome(o) : null;
    if (!o || !replay || round.round !== o.round || round.stance !== o.stance || round.consequenceDomain !== 'BODY' || round.consequence !== calamityDemonessCombatConsequence(round) || !shape(round, ['round', 'stance', 'first', 'playerCount', 'enemyCount', 'playerCountRoll', 'enemyCountRoll', 'moves', 'playerAdvantage', 'enemyAdvantage', 'winChance', 'winner', 'consequence', 'consequenceWeights', 'retreat', 'consequenceDomain', 'calamityDemonessOutcome', ...(replay.consequenceRoll === undefined ? [] : ['consequenceRoll'])])) return false;
    for (const key of ['playerCount', 'enemyCount', 'playerCountRoll', 'enemyCountRoll', 'first', 'retreat', 'winner', 'playerAdvantage', 'enemyAdvantage', 'winChance', 'consequenceWeights', 'consequenceRoll'] as const) if (!same(round[key], replay[key])) return false;
    const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
      .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
    return same(round.moves, moves);
  } catch { return false; }
}
function roundOpening(x: CalamityDemonessCombatSource): string {
  return `45岁的伊瑞丝持自己的原棍站在庭院2米外，健康${x.enemyHealth}、精神${x.enemyMind}、灵性${x.enemySpirituality}。维瑞娜与马库斯已亲自退到院外。你持有同一片付费战斗镜片，剩余${x.plateCharges}次耐用次数。`;
}
export function calamityDemonessCombatConsequence(round: SliceCombatRound): string {
  const o = round.calamityDemonessOutcome; if (!o) throw new Error('缺少灾难魔女回合结果。'); let text: string;
  if (round.retreat === 'SUCCESS') text = '你通过撤离判定，停止交战，沿普通出口离开庭院。伊瑞丝仍留在原处。';
  else {
    const loser = round.winner === 'PLAYER' ? 'ENEMY' : 'PLAYER', subject = loser === 'PLAYER' ? '你' : '伊瑞丝', risk = loser === 'PLAYER' ? o.playerRiskAfter : o.enemyRiskAfter;
    if (round.consequenceRoll === undefined) text = `${subject}本回合处于下风，但没有遭受实际致伤攻击，因此没有新增身体伤势。累计风险${risk}。`;
    else {
      const weights = round.consequenceWeights!, severity = round.consequenceRoll <= weights.light ? 'LIGHT' : round.consequenceRoll <= weights.light + weights.heavy ? 'HEAVY' : 'DEATH';
      if (severity === 'DEATH') text = `${subject}伤势检验${round.consequenceRoll}/100，伤势致命，身体留在庭院的实际位置。`;
      else { text = `${subject}伤势检验${round.consequenceRoll}/100，受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康减少${severity === 'LIGHT' ? 10 : 30}。`;
        if (o.playerHealthAfter === 0 || o.enemyHealth === 0) text += '健康已降至0，伤者死亡。'; else if (o.enemyStatus === 'SURRENDERED') text += '伊瑞丝因重伤停止抵抗，将自己的棍放在脚边。'; }
    }
  }
  const screen = o.playerActions.filter(a => a.id === SCREEN).reduce((n, a) => n + a.appliedAmount, 0);
  const flame = o.playerActions.filter(a => a.id === FLAME).reduce((n, a) => n + a.appliedAmount, 0);
  return roundOpening(o.source) + text + ` 本轮镜幕实际缓冲${screen}、镜片实际耗去${o.plateChargesSpent}次，余${o.plateChargesAfter}次；黑焰实际攻势${flame}。未使用的屏障随回合结束失效，已付镜片次数与灵性不退款。`;
}
