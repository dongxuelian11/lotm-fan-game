import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import type { ScrollProfessorScroll, ScrollProfessorWorkshop } from '../scroll-professor/types.js';
import { PRYER_ABILITY_IDS } from '../pryer/types.js';
import { COMBAT_SCHOLAR_ABILITY_IDS } from '../combat-scholar/types.js';
import { WIZARD_ABILITY_IDS } from '../wizard/types.js';
import { SCROLL_PROFESSOR_ABILITY_IDS } from '../scroll-professor/types.js';
import { STAR_MYSTIC_ABILITY_IDS } from '../star-mystic/types.js';
import { MYSTIC_ABILITY_IDS } from '../mystic/types.js';
import { PROPHECY_MASTER_ABILITY_IDS } from '../prophecy-master/types.js';
import { validateSageSiteState, type SageSiteState } from './life.js';
import { SAGE_TARGET_ID, SAGE_POWER_IDS, SAGE_POWERS, hasSageDisputeOpponent,
  validateSagePreparation, type SagePreparation, type SageEnemyIntent, type SagePowerId } from './encounter.js';

/** Numerical costs and effects are finite G adaptation. Actual learned spells, original scroll
 * identities and old effect budgets are inherited unchanged. S2 does not reveal absent information. */
export const SAGE_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const SAGE_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const sageActionCount = pyromaniacActionCount;
export const sageEnemyActionCount = pyromaniacActionCount;
const FORM = 'hermit.s2.information-form', SIFT = 'hermit.s2.information-sift';
const IMPACT = 'hermit.s6.scrollcraft', BODY = 'BODY_FOLLOWUP', WARD = 'BRIEF_WARD', CAGE = 'hermit.s5.star-cage', ECHO = 'hermit.s4.mystical-reenactment', GLIMPSE = 'hermit.s3.prophetic-glimpse';
const INHERITED_IDS = [...PRYER_ABILITY_IDS, ...COMBAT_SCHOLAR_ABILITY_IDS, ...WIZARD_ABILITY_IDS, ...SCROLL_PROFESSOR_ABILITY_IDS, ...STAR_MYSTIC_ABILITY_IDS, ...MYSTIC_ABILITY_IDS, ...PROPHECY_MASTER_ABILITY_IDS];
export type SageMoveId = typeof FORM | typeof SIFT | typeof IMPACT | typeof BODY | typeof WARD | typeof CAGE | typeof ECHO | typeof GLIMPSE | 'ACCIDENT';
// Preserve S3 relative tickets for all inherited slots; the two new slots add20 tickets each.
const ABILITIES: readonly { id: SageMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: IMPACT, label: '原冲力卷1灵性／本人已学冲力2灵性／原棍或身体，继承预算', weight: 30, stance: 'ATTACK' },
  { id: BODY, label: '继承实练次击，沿用旧掌握与实际身体', weight: 15, stance: 'ATTACK' },
  { id: WARD, label: '原防护卷1灵性／已学防护2灵性／普通格挡，继承预算', weight: 20, stance: 'DEFEND' },
  { id: CAGE, label: '旧星光牢笼3灵性，知识14；下一身体打击减半', weight: 15, stance: 'CONTROL' },
  { id: ECHO, label: '本人已学迟钟回声4灵性，知识18；沿用原公开程度', weight: 10, stance: 'PREPARE' },
  { id: GLIMPSE, label: '模糊预兆6灵性与2精神，知识18；下一真实威胁×0.7', weight: 5, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差，优势−22.5', weight: 5, stance: null },
  { id: FORM, label: '有限信息化6灵性、2精神、6精力；随后一次身体攻势最多减45', weight: 20, stance: 'DEFEND' },
  { id: SIFT, label: '筛取眼前棍势6灵性、2精神；可能误读或抵抗，只准备下一真实攻击', weight: 20, stance: 'PREPARE' },
];
export const SAGE_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '自有有限弧光5灵性，身体攻势70', weight: 35 },
  { id: 'WARD', label: '一次屏护4灵性，削弱随后一次真实攻击30', weight: 25 },
  { id: 'BODY_STRIKE', label: '自己的原棍20×身体状态', weight: 20 },
  { id: 'FEINT', label: '有观察窗口时3灵性假动作，耗掉读势或预兆；无窗口普通观察', weight: 15 },
  { id: 'ACCIDENT', label: '实际失衡，无伤害与消耗', weight: 5 },
];
export const isSage = (s: SliceState): boolean => s.progression.pathwayId === 'hermit' && s.progression.sequence === 2;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function sageAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, weight: weights[i]! / total * 100,
    label: stance === 'DEFEND' && (a.id === IMPACT || a.id === BODY) ? '整轮专心防守，本槽不攻击、不消耗灵性或原卷'
      : a.id === ECHO && !s.mystic.life.echoLearned ? '未实际学会迟钟回声：只普通观察，不生成未知法术' : a.label }));
}
function drawPlayer(random: ActionRandomStream, stance: SliceStance | null): SageMoveId {
  const weights = tickets(stance); let n = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return a.id; } throw new Error('贤者能力盘无效。');
}
export function drawSageAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): SageMoveId { return drawPlayer(random, stance); }
export function drawSageEnemyAbility(random: ActionRandomStream): SageEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of SAGE_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as SageEnemyIntent; } throw new Error('当前对手行动盘无效。');
}
export interface SageCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'SAGE_DISPUTE'; targetId: typeof SAGE_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetName: '梅林·阿什'; targetAge: 47; targetSequence: 3; targetCore: 20;
  actualBody: true; independentMind: true; enemyWeapon: 'SG2-MERRIN-ROD'; weaponLocation: 'HAND'; yardId: 'SG2-ARCHIVE-YARD';
  playerPosition: 'YARD'; enemyDistanceMetres: 2; ordinaryExit: 'OPEN'; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  playerInjuries: SliceInjury[]; enemyInjuries: SliceInjury[]; playerRisk: number; enemyRisk: number;
  preparation: SagePreparation; site: SageSiteState; workshop: ScrollProfessorWorkshop;
  inheritedMastery: Record<string, number>; clubHeld: boolean; playerClubId: 'town-short-club' | null;
  learnedImpact: boolean; learnedWard: boolean; echoLearned: boolean; publicDisclosed: boolean;
  physique: number; perception: number; knowledge: number; will: number;
  powerUses: Record<SagePowerId, number>; clockSeconds: number; randomSeed: string; randomCursor: number;
}
export interface SageCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: false }
interface ActionEvidence extends SageCombatEffect {
  order: number; atSeconds: number; elapsedSeconds: 5; paidCost: number; mindCost: number; physicalFactor: number; rolls: number[];
  randomCursorBefore: number; randomCursorAfter: number; playerHealthAfter: number; playerMindAfter: number; playerSpiritualityAfter: number; enemySpiritualityAfter: number;
  chargeGranted: boolean; chargeConsumedByOrder: number | null; chargeCancelledByOrder: number | null; appliedAmount: number; consumedEffectOrders: number[];
}
export interface SagePlayerAction extends ActionEvidence {
  id: SageMoveId; attempted: boolean; succeeded: boolean; applied: boolean; resisted: boolean; mode: string;
  prepared: 'FORM' | 'SIFT' | 'CAGE' | 'ECHO' | 'GLIMPSE' | null; formEnergyPaid: number; exposurePaid: number;
  observed: { weaponId: 'SG2-MERRIN-ROD'; position: 'YARD'; distanceMetres: 2; pattern: 'PRESENT_GRIP_AND_FOOTING' } | null;
  scroll: Pick<ScrollProfessorScroll, 'id' | 'materialId' | 'makerSequence' | 'inscriptionMastery'> | null;
}
export interface SageEnemyAction extends ActionEvidence { planned: SageEnemyIntent; actual: SageEnemyIntent | 'OBSERVE'; attackKind: 'NONE' | 'BODY' }
interface Runtime {
  playerS: number; playerM: number; playerH: number; enemyS: number; powers: Record<SagePowerId, number>; clockSeconds: number;
  site: SageSiteState; workshop: ScrollProfessorWorkshop; formAttempted: boolean; siftAttempted: boolean; guardAttempted: boolean;
  form: SagePlayerAction | null; sift: SagePlayerAction | null; cage: SagePlayerAction | null; echo: SagePlayerAction | null; glimpse: SagePlayerAction | null; guard: SageEnemyAction | null;
}
export interface SageRoundContext {
  source: SageCombatSource; stance: SliceStance; finished: boolean; liveState: string; runtime: Runtime;
  playerActions: SagePlayerAction[]; enemyActions: SageEnemyAction[]; label: string; outcome: SageRoundOutcome | null;
}
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]): boolean => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
const none = (label: string): SageCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
const physicalAt = (health: number): number => health > 75 ? 1 : health > 50 ? .95 : health > 25 ? .9 : .8;
const masteryFactor = (v: number) => .65 + .35 * v / 500;
export function currentSageCombatSource(s: SliceState): SageCombatSource | null {
  if (!hasSageDisputeOpponent(s)) return null;
  const e = s.sage.encounter, c = s.combat!, stats = s.character.coreStats, site = e.currentSite;
  if (!site || !e.preparation || !e.startSite || !same(e.startSite, s.sage.life.site) || !site.source) return null;
  const playerClubId = s.town.clubLocation === 'HAND' ? 'town-short-club' : null;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'SAGE_DISPUTE', targetId: SAGE_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetName: '梅林·阿什', targetAge: 47, targetSequence: 3, targetCore: 20,
    actualBody: true, independentMind: true, enemyWeapon: 'SG2-MERRIN-ROD', weaponLocation: 'HAND', yardId: 'SG2-ARCHIVE-YARD', playerPosition: 'YARD',
    enemyDistanceMetres: 2, ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality,
    playerInjuries: structuredClone(s.injuries), enemyInjuries: structuredClone(c.enemyInjuries), playerRisk: s.injuryRisk, enemyRisk: c.enemyRisk,
    preparation: structuredClone(e.preparation), site: structuredClone(site), workshop: structuredClone(s.scrollProfessor.workshop),
    inheritedMastery: Object.fromEntries(INHERITED_IDS.map(id => [id, s.progression.mastery[id]!])),
    learnedImpact: s.wizard.lessons['light-touch']?.learned === true, learnedWard: s.wizard.lessons['brief-ward']?.learned === true, echoLearned: s.mystic.life.echoLearned, publicDisclosed: s.mystic.life.publicDisclosed,
    clubHeld: playerClubId !== null, playerClubId, physique: stats.physique, perception: stats.perception, knowledge: stats.knowledge, will: stats.will,
    powerUses: { ...e.powerUses }, clockSeconds: site.clockSeconds, randomSeed: s.random.seed, randomCursor: s.random.cursor };
}
function makeRuntime(x: SageCombatSource): Runtime {
  return { playerS: x.playerSpirituality, playerM: x.playerMind, playerH: x.playerHealth, enemyS: x.enemySpirituality, powers: { ...x.powerUses }, clockSeconds: x.clockSeconds,
    site: structuredClone(x.site), workshop: structuredClone(x.workshop), formAttempted: false, siftAttempted: false, guardAttempted: false, form: null, sift: null, cage: null, echo: null, glimpse: null, guard: null };
}
function liveState(s: SliceState): string {
  const e = s.sage.encounter;
  return stableStringify({ spirituality: s.spirituality, mind: s.mind, enemySpirituality: e.enemySpirituality, powerUses: e.powerUses, currentSite: e.currentSite,
    preparation: e.preparation, startSite: e.startSite, historicalLife: s.sage.life, workshop: s.scrollProfessor.workshop,
    stats: s.character.coreStats, mastery: s.progression.mastery, club: s.town.clubLocation, originalLife: s.prophecyMaster.life, originalEncounter: s.prophecyMaster.encounter,
    mysticLife: s.mystic.life, mysticEncounter: s.mystic.encounter, wizard: s.wizard.lessons, sequence: s.progression.sequence, pathway: s.progression.pathwayId, status: s.status, city: s.world.city, activeEvent: s.activeEvent });
}
const roundOrigins = new WeakMap<SageRoundContext, { source: string; stance: SliceStance }>();
function originalContext(r: SageRoundContext): boolean { const origin = roundOrigins.get(r); return !!origin && origin.source === stableStringify(r.source) && origin.stance === r.stance; }
const dynamicSource = new Set(['playerHealth', 'playerMind', 'playerSpirituality', 'enemySpirituality', 'powerUses', 'clockSeconds', 'site', 'workshop']);
function validRound(s: SliceState, r: SageRoundContext, supplied: SageCombatSource | null): boolean {
  const actual = currentSageCombatSource(s);
  return originalContext(r) && !r.finished && actual !== null && supplied !== null && same(supplied, r.source) && r.liveState === liveState(s) && actual.playerHealth === r.runtime.playerH && actual.playerMind === r.runtime.playerM && actual.clockSeconds === r.runtime.clockSeconds &&
    same(actual.site, r.runtime.site) && same(actual.workshop, r.runtime.workshop) && Object.entries(r.source).every(([key, value]) => dynamicSource.has(key) || same(actual[key as keyof SageCombatSource], value));
}
export function beginSageCombatRound(s: SliceState, stance: SliceStance, random: ActionRandomStream): SageRoundContext {
  const source = currentSageCombatSource(s);
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance) || !source || !validSource(source) || random.seed !== source.randomSeed || random.cursor !== source.randomCursor) throw new Error('缺少当前后院、真实对手或资源来源。');
  const context: SageRoundContext = { source, stance, finished: false, liveState: liveState(s), runtime: makeRuntime(source), playerActions: [], enemyActions: [], outcome: null, label: roundOpening(source) };
  roundOrigins.set(context, { source: stableStringify(source), stance }); return context;
}
export const createSageCombatRound = beginSageCombatRound;
function actionBase(r: Runtime, order: number, physical: number, cursor: number): ActionEvidence {
  return { ...none(''), order, atSeconds: r.clockSeconds, elapsedSeconds: 5, paidCost: 0, mindCost: 0, physicalFactor: physical, rolls: [], randomCursorBefore: cursor, randomCursorAfter: cursor,
    playerHealthAfter: r.playerH, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, enemySpiritualityAfter: r.enemyS,
    chargeGranted: false, chargeConsumedByOrder: null, chargeCancelledByOrder: null, appliedAmount: 0, consumedEffectOrders: [] };
}
function closeAction<T extends ActionEvidence>(a: T, r: Runtime, random: ActionRandomStream): T {
  r.clockSeconds += 5; r.site.clockSeconds = r.clockSeconds; a.randomCursorAfter = random.cursor; a.playerHealthAfter = r.playerH; a.playerMindAfter = r.playerM; a.playerSpiritualityAfter = r.playerS; a.enemySpiritualityAfter = r.enemyS;
  a.label += ` 本动作5秒；你余${r.playerS}灵性、${r.playerM}精神、${r.site.playerEnergy}精力，对手余${r.enemyS}灵性。`; return a;
}
function consume(effect: SagePlayerAction | SageEnemyAction, a: ActionEvidence, amount: number, cancelled = false): void {
  a.consumedEffectOrders.push(effect.order);
  if (cancelled) { effect.chargeCancelledByOrder = a.order; effect.label += ` 后续第${a.order + 1}动作使这次准备失效，费用不退。`; }
  else { effect.chargeConsumedByOrder = a.order; effect.appliedAmount = amount; if ('applied' in effect) effect.applied = true; effect.label += ` 后续第${a.order + 1}动作实际应用${amount}，仅这一次，准备随即结束。`; }
}
function applyAttackWindows(r: Runtime, a: SagePlayerAction): void {
  if (!a.threatens) return;
  if (r.sift) { const gain = a.selfGain * .2; consume(r.sift, a, gain); a.selfGain += gain; a.label += `眼前读势只为本次真实攻击增加${gain}优势；`; r.sift = null; }
  if (r.guard) { const amount = Math.min(30, a.selfGain); consume(r.guard, a, amount); r.guard.enemyReduction = amount; a.label += `对手先前屏护实际削弱${amount}；`; r.guard = null; }
}
function authorizedOriginal(workshop: ScrollProfessorWorkshop, week: number, kind: ScrollProfessorScroll['kind']): ScrollProfessorScroll | null {
  const { scrolls, materials } = workshop;
  return scrolls.find(scroll => {
    if (scroll.kind !== kind || scroll.authorized !== true || scroll.status !== 'HELD' || scroll.usedWeek !== null || ![6, 5, 4, 3, 2].includes(scroll.makerSequence) ||
      !Number.isFinite(scroll.inscriptionMastery) || scroll.inscriptionMastery < 0 || scroll.inscriptionMastery > 500 || !integer(scroll.createdWeek, 1, week) ||
      !/^scroll-professor-scroll-[1-9]\d*$/.test(scroll.id) || !/^scroll-professor-material-[1-9]\d*$/.test(scroll.materialId) ||
      scrolls.filter(x => x.id === scroll.id).length !== 1 || scrolls.filter(x => x.materialId === scroll.materialId).length !== 1) return false;
    const inputs = materials.filter(m => m.id === scroll.materialId), input = inputs[0];
    return inputs.length === 1 && !!input && input.status === 'SPENT' && integer(input.acquiredWeek, 1, scroll.createdWeek) && input.spentWeek === scroll.createdWeek;
  }) ?? null;
}

function playerAction(x: SageCombatSource, r: Runtime, stance: SliceStance, id: SageMoveId, physical: number, order: number, random: ActionRandomStream): SagePlayerAction {
  const a: SagePlayerAction = { ...actionBase(r, order, physical, random.cursor), id, attempted: false, succeeded: false, applied: false, resisted: false, mode: 'NONE', prepared: null, formEnergyPaid: 0, exposurePaid: 0, observed: null, scroll: null };
  const check = (difficulty: number) => { const roll = random.nextInt(1, 100); a.rolls.push(roll); return roll <= computeCheckChance({ ability: 'knowledge', baseAbility: x.knowledge, difficulty, modifiers: [] }); };
  if (stance === 'DEFEND' && (id === IMPACT || id === BODY)) { a.mode = 'HOLD_GUARD'; a.label = '整轮专心防守，本槽不攻击，不燃毁原卷或支付攻击法术费用。'; }
  else if (id === 'ACCIDENT') { a.selfGain = -22.5; a.label = '本次动作偏差，优势−22.5，不重抽。'; }
  else if (id === BODY) {
    a.selfGain = 20.475 * masteryFactor(x.inheritedMastery['hermit.s8.combat-study']!) * physical; a.threatens = a.selfGain > 0; a.mode = 'INHERITED_BODY';
    a.label = `继承实练次击20.475×旧格斗掌握×实际身体，攻势${a.selfGain}，0灵性，独占一槽。`; applyAttackWindows(r, a); a.applied = a.threatens; a.appliedAmount = a.selfGain;
  } else if (id === IMPACT || id === WARD) {
    const impact = id === IMPACT, budget = impact ? 38.025 : 42.25, scroll = authorizedOriginal(r.workshop, x.week, impact ? 'IMPACT' : 'WARD'); let value: number;
    if (scroll && r.playerS >= 1) {
      a.paidCost = 1; a.mode = 'ORIGINAL_SCROLL'; scroll.status = 'USED'; scroll.usedWeek = x.week; scroll.authorized = false;
      a.scroll = { id: scroll.id, materialId: scroll.materialId, makerSequence: scroll.makerSequence, inscriptionMastery: scroll.inscriptionMastery };
      value = budget * masteryFactor(scroll.inscriptionMastery);
      a.label = `实际燃毁已授权${impact ? '冲力' : '防护'}原卷${scroll.id}，实付1灵性；材料${scroll.materialId}、制作者序列${scroll.makerSequence}、封存掌握${scroll.inscriptionMastery}不变。继承预算${budget}×刻录系数，没有生成新卷。`;
    } else if ((impact ? x.learnedImpact : x.learnedWard) && r.playerS >= 2) {
      a.paidCost = 2; a.mode = 'LEARNED_SPELL'; value = budget * masteryFactor(x.inheritedMastery['hermit.s7.spellcraft']!);
      a.label = `本人实际已学${impact ? '冲力' : '短暂防护'}实付2灵性，沿用${budget}×旧法术掌握；没有获得新法术。`;
    } else {
      a.mode = 'ORDINARY'; value = (impact ? x.clubHeld ? 16 : 12 : 10) * physical;
      a.label = `${impact ? x.clubHeld ? '自己的实际原短棍16' : '自己的身体12' : '普通格挡10'}×身体状态，0灵性，不借用对手的棍或未知卷轴。`;
    }
    r.playerS -= a.paidCost; a.selfGain = impact ? value : 0; a.enemyReduction = impact ? 0 : value; a.threatens = impact && value > 0; a.applied = value > 0; a.appliedAmount = value; applyAttackWindows(r, a); if (impact) a.appliedAmount = a.selfGain;
  } else if (id === FORM || id === SIFT) {
    const form = id === FORM, attempted = form ? r.formAttempted : r.siftAttempted;
    if (attempted) { a.mode = 'ALREADY_ATTEMPTED'; a.label = '本轮已经尝试过这项能力，只普通观察，不再收费或重抽。'; }
    else if (r.playerS < 6 || r.playerM <= 2 || form && r.site.playerEnergy < 8) { a.mode = 'LOW_RESOURCE'; a.label = '实际灵性、精神或返程精力不足，只普通观察，不免费施法或透支。'; }
    else {
      a.attempted = true; a.paidCost = 6; a.mindCost = 2; a.exposurePaid = 1; r.playerS -= 6; r.playerM -= 2;
      const difficulty = 20 + Math.min(20, r.site.assimilationExposure); r.site.assimilationExposure++;
      if (form) { r.formAttempted = true; a.formEnergyPaid = 6; r.site.formEnergySpent += 6; r.site.playerEnergy -= 6; }
      else { r.siftAttempted = true; a.observed = { weaponId: 'SG2-MERRIN-ROD', position: 'YARD', distanceMetres: 2, pattern: 'PRESENT_GRIP_AND_FOOTING' }; }
      a.succeeded = check(difficulty);
      if (!form && a.succeeded) { const resistance = random.nextInt(1, 100); a.rolls.push(resistance); a.resisted = resistance <= 25; }
      a.mode = !a.succeeded ? 'FAILED' : a.resisted ? 'RESISTED' : 'PREPARED';
      if (a.succeeded && !a.resisted) { a.chargeGranted = true; a.prepared = form ? 'FORM' : 'SIFT'; if (form) r.form = a; else r.sift = a; }
      a.label = `${form ? '有限信息化' : '筛取眼前棍势'}实际付6灵性、2精神${form ? '、6精力' : ''}，增加一次同化暴露；知识难度${difficulty}实抽${a.rolls[0]}，${a.mode === 'FAILED' ? '未形成可靠结果，费用不退' : a.resisted ? `对手调整握棍与步伐，抵抗实抽${a.rolls[1]}≤25，本次读势未生效` : form ? '仅准备本轮一次有限信息化与原地重组窗口，身体当前仍为实体；随后一次身体攻势来临才触发，最多减45，当前没有减势' : '只从眼前实际原棍与站姿取得有限线索，准备本轮下一次真实攻击增加其20%优势；当前没有发动攻击或直接伤害'}。${form ? '余精力保留普通离场，不免伤、不复活。' : '未读取未来动作、隐秘思想或场外事实，假动作可耗掉线索。'}失败、抵抗与过期都不退款。`;
    }
  } else {
    const ready = id === CAGE ? r.cage : id === ECHO ? r.echo : r.glimpse, cost = id === CAGE ? 3 : id === ECHO ? 4 : 6;
    if (id === ECHO && !x.echoLearned) { a.mode = 'NOT_LEARNED'; a.label = '未实际学会迟钟回声，只普通观察，不送未知故事或法术。'; }
    else if (ready) { a.mode = 'ALREADY_PREPARED'; a.label = '本轮同一旧效果尚待真实触发，不叠加、不再收费或抽检定。'; }
    else if (r.playerS < cost || id === GLIMPSE && r.playerM <= 2) { a.mode = 'LOW_RESOURCE'; a.label = '实际资源不足，只普通观察，不免费施法或预言。'; }
    else {
      a.attempted = true; a.paidCost = cost; a.mindCost = id === GLIMPSE ? 2 : 0; r.playerS -= cost; r.playerM -= a.mindCost; a.succeeded = check(id === CAGE ? 14 : 18);
      a.mode = a.succeeded ? 'PREPARED' : 'FAILED';
      if (a.succeeded) { a.chargeGranted = true; a.prepared = id === CAGE ? 'CAGE' : id === ECHO ? 'ECHO' : 'GLIMPSE'; if (id === CAGE) r.cage = a; else if (id === ECHO) r.echo = a; else r.glimpse = a; }
      a.label = `${id === CAGE ? '旧星光牢笼' : id === ECHO ? '本人已学迟钟回声' : '旧模糊预兆'}实付${cost}灵性${a.mindCost ? '与2精神' : ''}，实抽${a.rolls[0]}${a.succeeded ? '成功，只准备有限窗口' : '失败，无效果、费用不退'}。${id === CAGE ? '只将下一正贡献原棍身体打击减半。' : id === ECHO ? `只将下一真实付费弧光乘${x.publicDisclosed ? .955 : .7}；${x.publicDisclosed ? '旧故事已公开，效力只余15%。' : '沿用原未公开来源。'}` : '只将下一真实正贡献身体或付费弧光乘0.7，假动作也可耗窗；不提前知道动作或改写历史。'}`;
    }
  }
  return closeAction(a, r, random);
}
function enemyAction(x: SageCombatSource, r: Runtime, planned: SageEnemyIntent, physical: number, order: number, random: ActionRandomStream): SageEnemyAction {
  const a: SageEnemyAction = { ...actionBase(r, order, physical, random.cursor), planned, actual: planned, attackKind: 'NONE' };
  const power = SAGE_POWERS.find(p => p.id === planned);
  if (planned === 'WARD' && r.guardAttempted || planned === 'FEINT' && !r.sift && !r.glimpse) a.actual = 'OBSERVE';
  else if (power && r.enemyS < power.cost) a.actual = 'BODY_STRIKE';
  if (a.actual === 'ARC_BOLT' || a.actual === 'BODY_STRIKE') {
    let raw = a.actual === 'ARC_BOLT' ? 70 : 20 * physical;
    if (a.actual === 'ARC_BOLT') { r.enemyS -= 5; r.powers.ARC_BOLT++; a.paidCost = 5; }
    a.attackKind = 'BODY'; a.label = a.actual === 'ARC_BOLT' ? '梅林付自己5灵性，向眼前本人发出有限弧光，身体攻势70。' : `${planned !== 'BODY_STRIKE' ? '灵性不足，0灵性普通回退；' : ''}梅林以自己的唯一SG2-MERRIN-ROD打击，攻势20×实际身体。`;
    const reduce = (effect: SagePlayerAction, multiplier: number) => { const amount = raw * (1 - multiplier); consume(effect, a, amount); raw *= multiplier; };
    if (a.actual === 'BODY_STRIKE' && raw > 0 && r.cage) { reduce(r.cage, .5); r.cage = null; }
    if (a.actual === 'ARC_BOLT' && raw > 0 && r.echo) { reduce(r.echo, x.publicDisclosed ? .955 : .7); r.echo = null; }
    if (raw > 0 && r.glimpse) { reduce(r.glimpse, .7); r.glimpse = null; }
    if (raw > 0 && r.form) { const amount = Math.min(45, raw); consume(r.form, a, amount); raw -= amount; r.form = null; a.label += `本次身体攻击来临时，你短暂信息化并在原处重组，先前窗口实际削弱本次${amount}；身体仍参与共同伤势规则。`; }
    a.selfGain = raw; a.appliedAmount = raw; a.threatens = raw > 0;
  } else if (a.actual === 'WARD') {
    r.enemyS -= 4; r.powers.WARD++; r.guardAttempted = true; a.paidCost = 4; a.chargeGranted = true; r.guard = a;
    a.label = '梅林付4灵性准备一次屏护，只削弱本轮随后一次实际攻击至多30；当前没有攻击，减势仍为0。';
  } else if (a.actual === 'FEINT') {
    r.enemyS -= 3; r.powers.FEINT++; a.paidCost = 3;
    if (r.sift) { consume(r.sift, a, 0, true); r.sift = null; } if (r.glimpse) { consume(r.glimpse, a, 0, true); r.glimpse = null; }
    a.label = '梅林实付3灵性作出假动作，使当前读势与模糊预兆失去用途；没有攻击，不消耗信息化、牢笼或迟钟。';
  } else if (a.actual === 'OBSERVE') a.label = '本轮屏护已准备或没有读势窗口可供假动作，对手只普通观察，0灵性、0攻势。';
  else a.label = '对手实际失衡，0灵性、0攻势，不补充资源或重抽。';
  return closeAction(a, r, random);
}
function commitRuntime(s: SliceState, r: SageRoundContext): void {
  const e = s.sage.encounter;
  s.health = r.runtime.playerH; s.mind = r.runtime.playerM; s.spirituality = r.runtime.playerS; e.enemySpirituality = r.runtime.enemyS;
  e.powerUses = { ...r.runtime.powers }; e.currentSite = structuredClone(r.runtime.site); s.scrollProfessor.workshop = structuredClone(r.runtime.workshop); r.liveState = liveState(s);
}
/** Replay the already committed prefix and the next scheduled draw before changing any resource.
 * This rejects skipped counts, wrong actor order, forged action IDs, extra draws and stale contexts.
 * The received stream must consume precisely the deterministic checks proved by the replay. */
function executeNext(s: SliceState, context: SageRoundContext, actor: 'PLAYER' | 'ENEMY', planned: SageMoveId | SageEnemyIntent, physical: number, random: ActionRandomStream): SageCombatEffect | null {
  const x = context.source, rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), runtime = makeRuntime(x);
  const remaining = { PLAYER: sageActionCount(rng.nextInt(1, 100)), ENEMY: sageEnemyActionCount(rng.nextInt(1, 100)) };
  const order = x.round % 2 === 1 ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: SagePlayerAction[] = [], enemies: SageEnemyAction[] = [], committed = context.playerActions.length + context.enemyActions.length;
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) {
    for (const next of order) {
      if (!remaining[next]) continue;
      if (next === 'PLAYER' && context.stance === 'RETREAT') {
        remaining.PLAYER = 0; if (rng.nextInt(1, 100) <= 50) return null; continue;
      }
      remaining[next]--;
      const index = players.length + enemies.length, id = next === 'PLAYER' ? drawPlayer(rng, context.stance) : drawSageEnemyAbility(rng);
      const factor = physicalAt(next === 'PLAYER' ? runtime.playerH : x.enemyHealth);
      if (index === committed && (next !== actor || id !== planned || factor !== physical || random.seed !== x.randomSeed || random.cursor !== rng.cursor ||
        !same(players, context.playerActions) || !same(enemies, context.enemyActions) || !same(runtime, context.runtime))) return null;
      const action = next === 'PLAYER'
        ? playerAction(x, runtime, context.stance, id as SageMoveId, factor, index, rng)
        : enemyAction(x, runtime, id as SageEnemyIntent, factor, index, rng);
      if (next === 'PLAYER') players.push(action as SagePlayerAction); else enemies.push(action as SageEnemyAction);
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
export function resolveSageCombatAbility(s: SliceState, id: SageMoveId, physical: number, random: ActionRandomStream, r: SageRoundContext, source: SageCombatSource | null = r.source): SageCombatEffect {
  if (!validRound(s, r, source) || !ABILITIES.some(a => a.id === id)) return none('当前人物、现场或资源不符，未执行动作。');
  return executeNext(s, r, 'PLAYER', id, physical, random) ?? none('行动顺序或随机来源不符，未执行动作。');
}
export function resolveSageEnemyAbility(s: SliceState, planned: SageEnemyIntent, physical: number, random: ActionRandomStream, r: SageRoundContext, source: SageCombatSource | null = r.source): SageCombatEffect {
  if (!validRound(s, r, source) || ![...SAGE_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned)) return none('对手、棍或当前资源不符，未执行动作。');
  return executeNext(s, r, 'ENEMY', planned, physical, random) ?? none('行动顺序或随机来源不符，未执行动作。');
}
export interface SageRoundOutcome {
  targetId: typeof SAGE_TARGET_ID; round: number; source: SageCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number;
  playerInjuriesAfter: SliceInjury[]; enemyInjuriesAfter: SliceInjury[]; playerRiskAfter: number; enemyRiskAfter: number;
  powerUses: Record<SagePowerId, number>; formAttempted: boolean; siftAttempted: boolean; guardAttempted: boolean;
  expiredEffectOrders: number[]; siteAfter: SageSiteState; workshopAfter: ScrollProfessorWorkshop;
  clockSecondsAfter: number; elapsedSeconds: 60; randomCursorAfter: number;
  playerActions: SagePlayerAction[]; enemyActions: SageEnemyAction[];
}
export function finishSageCombatRound(s: SliceState, r: SageRoundContext, continuing = true, randomCursorAfter = s.random.cursor): SageRoundOutcome {
  const e = s.sage.encounter, c = s.combat;
  if (!originalContext(r) || r.finished || !c || c.encounterId !== 'SAGE_DISPUTE' || c.round !== r.source.round || r.liveState !== liveState(s)) throw new Error('回合已结束或当前实际资源被改写。');
  const outcome: SageRoundOutcome = { targetId: SAGE_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus,
    playerSpiritualityBefore: r.source.playerSpirituality, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind, enemySpiritualityBefore: r.source.enemySpirituality,
    playerInjuriesAfter: structuredClone(s.injuries), enemyInjuriesAfter: structuredClone(c.enemyInjuries), playerRiskAfter: s.injuryRisk, enemyRiskAfter: c.enemyRisk,
    powerUses: { ...e.powerUses }, formAttempted: r.runtime.formAttempted, siftAttempted: r.runtime.siftAttempted, guardAttempted: r.runtime.guardAttempted,
    expiredEffectOrders: [r.runtime.form, r.runtime.sift, r.runtime.cage, r.runtime.echo, r.runtime.glimpse, r.runtime.guard].filter((a): a is SagePlayerAction | SageEnemyAction => a !== null).map(a => a.order).sort((a, b) => a - b),
    siteAfter: { ...structuredClone(r.runtime.site), clockSeconds: r.source.clockSeconds + 60 }, workshopAfter: structuredClone(r.runtime.workshop),
    clockSecondsAfter: r.source.clockSeconds + 60, elapsedSeconds: 60, randomCursorAfter, playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
  if (!validateSageRoundOutcome(outcome)) throw new Error('回合动作、原卷、身体后果或随机结果无法复核，未提交结算。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  if (e.enemyStatus !== 'RESISTING') e.weaponLocation = 'YARD';
  e.currentSite = structuredClone(outcome.siteAfter); r.finished = true; r.outcome = outcome;
  r.runtime.form = r.runtime.sift = r.runtime.cage = r.runtime.echo = r.runtime.glimpse = r.runtime.guard = null; return structuredClone(outcome);
}
export function sageRoundOutcome(r: SageRoundContext): SageRoundOutcome { if (!r.outcome) throw new Error('回合尚未结束。'); return structuredClone(r.outcome); }
function validWorkshop(w: ScrollProfessorWorkshop, week: number): boolean {
  return !!w && integer(w.kitsBought) && integer(w.craftAttempts) && integer(w.craftFailures, 0, w.craftAttempts) &&
    (w.lastKitWeek === null || integer(w.lastKitWeek, 1, week)) && Array.isArray(w.materials) && Array.isArray(w.scrolls) &&
    new Set(w.materials.map(m => m.id)).size === w.materials.length && new Set(w.scrolls.map(s => s.id)).size === w.scrolls.length && new Set(w.scrolls.map(s => s.materialId)).size === w.scrolls.length &&
    w.materials.every(m => /^scroll-professor-material-[1-9]\d*$/.test(m.id) && integer(m.acquiredWeek, 1, week) &&
      (m.status === 'HELD' ? m.spentWeek === null : m.status === 'SPENT' && integer(m.spentWeek, m.acquiredWeek, week))) &&
    w.scrolls.every(s => /^scroll-professor-scroll-[1-9]\d*$/.test(s.id) && ['IMPACT', 'WARD'].includes(s.kind) && [6, 5, 4, 3, 2].includes(s.makerSequence) && integer(s.inscriptionMastery, 0, 500) &&
      integer(s.createdWeek, 1, week) && typeof s.authorized === 'boolean' && (s.status === 'HELD' ? s.usedWeek === null : s.status === 'USED' && integer(s.usedWeek, s.createdWeek, week) && !s.authorized) &&
      w.materials.some(m => m.id === s.materialId && m.status === 'SPENT' && m.spentWeek === s.createdWeek && m.acquiredWeek <= s.createdWeek));
}
const SOURCE_KEYS = ['runId', 'revision', 'week', 'round', 'encounterId', 'targetId', 'attemptWeek', 'startHistoryIndex', 'targetName', 'targetAge', 'targetSequence', 'targetCore', 'actualBody', 'independentMind', 'enemyWeapon', 'weaponLocation', 'yardId', 'playerPosition', 'enemyDistanceMetres', 'ordinaryExit', 'pursuit', 'thirdPartiesInArea', 'automaticAllyImmunity', 'playerHealth', 'playerMind', 'playerSpirituality', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'playerInjuries', 'enemyInjuries', 'playerRisk', 'enemyRisk', 'preparation', 'site', 'workshop', 'inheritedMastery', 'clubHeld', 'playerClubId', 'learnedImpact', 'learnedWard', 'echoLearned', 'publicDisclosed', 'physique', 'perception', 'knowledge', 'will', 'powerUses', 'clockSeconds', 'randomSeed', 'randomCursor'] as const;
function validInjuries(v: SliceInjury[], revision: number): boolean {
  return Array.isArray(v) && new Set(v.map(i => i.id)).size === v.length && v.every(i => shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 && ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision, 1, revision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision, revision)));
}
function validSceneSource(x: SageCombatSource): boolean {
  const p = x.site;
  return validateSageSiteState(p) && p.siteId === 'SG2-ARCHIVE' && p.source !== null && p.introducedWeek !== null && p.introducedWeek <= x.week &&
    p.playerLocation === 'YARD' && integer(p.playerEnergy, 2, 100) && p.clockSeconds === x.clockSeconds &&
    p.iris?.id === 'PM3-IRIS' && p.iris.age === 49 && p.iris.alive && p.iris.location === 'OUTSIDE' && p.iris.consent === 'GRANTED' &&
    p.body === 'SOLID' && !p.form.active && p.record?.location === 'OWNER' && p.materials.every(v => v.status === 'RETURNED' && v.location === 'OWNER') &&
    validateSagePreparation(x.preparation) && x.preparation.week <= x.week && x.preparation.revision < x.revision &&
    x.preparation.runId === x.runId && x.preparation.randomSeed === x.randomSeed && x.preparation.randomCursor <= x.randomCursor && x.clockSeconds === x.preparation.lifeClockSeconds + 6 + 60 * (x.round - 1);
}
function validSource(x: SageCombatSource): boolean {
  return shape(x, SOURCE_KEYS) && typeof x.runId === 'string' && x.runId.length > 0 && integer(x.revision) && integer(x.week, 1) && integer(x.round, 1) && integer(x.startHistoryIndex) && x.attemptWeek === x.week &&
    x.encounterId === 'SAGE_DISPUTE' && x.targetId === SAGE_TARGET_ID && x.targetName === '梅林·阿什' && x.targetAge === 47 && x.targetSequence === 3 && x.targetCore === 20 && x.actualBody === true && x.independentMind === true &&
    x.enemyWeapon === 'SG2-MERRIN-ROD' && x.weaponLocation === 'HAND' && x.yardId === 'SG2-ARCHIVE-YARD' && x.playerPosition === 'YARD' && x.enemyDistanceMetres === 2 && x.ordinaryExit === 'OPEN' && x.pursuit === false && x.thirdPartiesInArea === 0 && x.automaticAllyImmunity === false &&
    [x.playerHealth, x.playerMind, x.enemyHealth, x.enemyMind].every(n => integer(n, 1, 100)) && x.enemyMind === 100 && [x.playerSpirituality, x.enemySpirituality].every(n => integer(n, 0, 120)) &&
    validSceneSource(x) && validWorkshop(x.workshop, x.week) && shape(x.inheritedMastery, INHERITED_IDS) && INHERITED_IDS.every(id => integer(x.inheritedMastery[id], 0, 500)) &&
    [x.learnedImpact, x.learnedWard, x.echoLearned, x.publicDisclosed].every(v => typeof v === 'boolean') && (!x.publicDisclosed || x.echoLearned) &&
    ['town-short-club', null].includes(x.playerClubId) && x.clubHeld === (x.playerClubId !== null) && [x.physique, x.perception, x.knowledge, x.will].every(n => integer(n, 0, 500)) && integer(x.playerRisk) && integer(x.enemyRisk) && integer(x.clockSeconds) &&
    validInjuries(x.playerInjuries, x.revision) && validInjuries(x.enemyInjuries, x.revision) && shape(x.powerUses, SAGE_POWER_IDS) && SAGE_POWER_IDS.every(id => integer(x.powerUses[id])) &&
    x.powerUses.WARD <= x.round - 1 && x.powerUses.FEINT <= 6 * (x.round - 1) && x.powerUses.ARC_BOLT <= 6 * (x.round - 1) &&
    x.enemySpirituality === 120 - SAGE_POWERS.reduce((n, p) => n + p.cost * x.powerUses[p.id], 0) && typeof x.randomSeed === 'string' && x.randomSeed.length > 0 && x.randomSeed.length <= 256 && integer(x.randomCursor);
}
function sourcePenalty(current: number, maximum: number): number { const f = Math.max(0, Math.min(1, current / maximum)); return f > .75 ? 0 : f > .5 ? .05 : f > .25 ? .1 : .2; }
function sourceBase(core: number, health: number, mind: number, spirituality: number): number { return (1250 + Math.min(core, 250)) * (1 - Math.min(.4, sourcePenalty(health, 100) + sourcePenalty(mind, 100) + sourcePenalty(spirituality, 120))); }
function sourceWeights(risk: number): { light: number; heavy: number; death: number } { const death = Math.min(100, 5 + Math.min(risk, 10) * 10), shifted = death - 5; return { light: Math.max(0, 65 - shifted), heavy: Math.max(0, 30 - Math.max(0, shifted - 65)), death }; }
interface ReplayedRound {
  outcome: SageRoundOutcome; playerCount: number; enemyCount: number; playerCountRoll: number; enemyCountRoll: number; first: 'PLAYER' | 'ENEMY';
  retreat: 'NONE' | 'SUCCESS' | 'FAILURE'; winner: 'PLAYER' | 'ENEMY'; playerAdvantage: number; enemyAdvantage: number; winChance: number;
  consequenceWeights: { light: number; heavy: number; death: number } | null; consequenceRoll?: number;
}
/** Deterministic full-round replay checks both draws, ordered costs, pending flags, cancelled windows,
 * paid bodily energy, actual injury/death results and unmodified public labels. Extra fields fail equality. */
function replayOutcome(o: SageRoundOutcome): ReplayedRound | null {
  const x = o?.source;
  if (!x || !validSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) || !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) || o.playerActions.length > 6 || o.enemyActions.length > 6) return null;
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = makeRuntime(x);
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = sageActionCount(playerCountRoll), enemyCount = sageEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const, remaining = { PLAYER: playerCount, ENEMY: enemyCount };
  const players: SagePlayerAction[] = [], enemies: SageEnemyAction[] = []; let retreat: ReplayedRound['retreat'] = 'NONE';
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) {
    for (const actor of order) {
      if (remaining[actor] === 0) continue;
      if (actor === 'PLAYER' && o.stance === 'RETREAT') { remaining.PLAYER = 0; retreat = rng.nextInt(1, 100) <= 50 ? 'SUCCESS' : 'FAILURE'; if (retreat === 'SUCCESS') { remaining.ENEMY = 0; break; } continue; }
      remaining[actor]--;
      if (actor === 'PLAYER') players.push(playerAction(x, r, o.stance, drawPlayer(rng, o.stance), physicalAt(r.playerH), players.length + enemies.length, rng));
      else enemies.push(enemyAction(x, r, drawSageEnemyAbility(rng), physicalAt(x.enemyHealth), players.length + enemies.length, rng));
    }
  }
  if (!same(players, o.playerActions) || !same(enemies, o.enemyActions)) return null;
  const sum = (actions: { selfGain: number; enemyReduction: number }[], key: 'selfGain' | 'enemyReduction') => actions.reduce((n, a) => n + a[key], 0);
  const playerAdvantage = Math.max(125, sourceBase(x.physique * .10 + x.perception * .30 + x.will * .25 + x.knowledge * .35, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, sourceBase(20, x.enemyHealth, x.enemyMind, x.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction')), winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100;
  const winner = retreat === 'SUCCESS' ? 'ENEMY' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  let playerHealth = r.playerH, enemyHealth = x.enemyHealth, playerRisk = x.playerRisk, enemyRisk = x.enemyRisk;
  let enemyStatus: SageRoundOutcome['enemyStatus'] = 'RESISTING', continuing = retreat !== 'SUCCESS';
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
  const expected: SageRoundOutcome = { targetId: SAGE_TARGET_ID, round: x.round, source: structuredClone(x), stance: o.stance, continuing,
    enemyHealth, enemyMind: x.enemyMind, enemySpirituality: r.enemyS, enemyStatus,
    playerSpiritualityBefore: x.playerSpirituality, playerSpiritualityAfter: r.playerS, playerHealthAfter: playerHealth, playerMindAfter: r.playerM, enemySpiritualityBefore: x.enemySpirituality,
    playerInjuriesAfter: playerInjuries, enemyInjuriesAfter: enemyInjuries, playerRiskAfter: playerRisk, enemyRiskAfter: enemyRisk, powerUses: r.powers,
    formAttempted: r.formAttempted, siftAttempted: r.siftAttempted, guardAttempted: r.guardAttempted,
    expiredEffectOrders: [r.form, r.sift, r.cage, r.echo, r.glimpse, r.guard].filter((a): a is SagePlayerAction | SageEnemyAction => a !== null).map(a => a.order).sort((a, b) => a - b),
    siteAfter: { ...structuredClone(r.site), clockSeconds: x.clockSeconds + 60 }, workshopAfter: structuredClone(r.workshop),
    clockSecondsAfter: x.clockSeconds + 60, elapsedSeconds: 60, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies };
  if (!same(o, expected)) return null;
  return { outcome: expected, playerCount, enemyCount, playerCountRoll, enemyCountRoll, first, retreat, winner, playerAdvantage, enemyAdvantage, winChance, consequenceWeights, ...(consequenceRoll === undefined ? {} : { consequenceRoll }) };
}
export function validateSageRoundOutcome(value: unknown): value is SageRoundOutcome { try { return replayOutcome(value as SageRoundOutcome) !== null; } catch { return false; } }
export function validateSageCombatRound(round: SliceCombatRound): boolean {
  try {
    const o = round.sageOutcome, replay = o ? replayOutcome(o) : null;
    if (!o || !replay || round.round !== o.round || round.stance !== o.stance || round.consequenceDomain !== 'BODY' || round.consequence !== sageCombatConsequence(round) || !shape(round, ['round', 'stance', 'first', 'playerCount', 'enemyCount', 'playerCountRoll', 'enemyCountRoll', 'moves', 'playerAdvantage', 'enemyAdvantage', 'winChance', 'winner', 'consequence', 'consequenceWeights', 'retreat', 'consequenceDomain', 'sageOutcome', ...(replay.consequenceRoll === undefined ? [] : ['consequenceRoll'])])) return false;
    for (const key of ['playerCount', 'enemyCount', 'playerCountRoll', 'enemyCountRoll', 'first', 'retreat', 'winner', 'playerAdvantage', 'enemyAdvantage', 'winChance', 'consequenceWeights', 'consequenceRoll'] as const) if (!same(round[key], replay[key])) return false;
    const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
      .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
    return same(round.moves, moves);
  } catch { return false; }
}
function roundOpening(x: SageCombatSource): string {
  return `47岁的梅林·阿什持自己的原棍在后院2米外，健康${x.enemyHealth}、精神${x.enemyMind}、灵性${x.enemySpirituality}；该灵性是此人的独立预算。艾瑞丝已亲自退到院外。你有${x.site.playerEnergy}实际精力，须留下2精力普通离场。`;
}
export function sageCombatConsequence(round: SliceCombatRound): string {
  const o = round.sageOutcome; if (!o) throw new Error('缺少贤者回合结果。'); let text: string;
  if (round.retreat === 'SUCCESS') text = '你通过撤离判定，沿普通出口离开后院，对手仍在原处。';
  else {
    const loser = round.winner === 'PLAYER' ? 'ENEMY' : 'PLAYER', subject = loser === 'PLAYER' ? '你' : '梅林', risk = loser === 'PLAYER' ? o.playerRiskAfter : o.enemyRiskAfter;
    if (round.consequenceRoll === undefined) text = `${subject}本轮处于下风，但没有承受实际致伤攻击，因此没有新增身体伤势。累计风险${risk}。`;
    else {
      const weights = round.consequenceWeights!, severity = round.consequenceRoll <= weights.light ? 'LIGHT' : round.consequenceRoll <= weights.light + weights.heavy ? 'HEAVY' : 'DEATH';
      if (severity === 'DEATH') text = `${subject}伤势检验${round.consequenceRoll}/100，伤势致命，原身体留在后院。`;
      else { text = `${subject}伤势检验${round.consequenceRoll}/100，受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康减少${severity === 'LIGHT' ? 10 : 30}。`;
        if (o.playerHealthAfter === 0 || o.enemyHealth === 0) text += '健康降到0，伤者死亡。'; else if (o.enemyStatus === 'SURRENDERED') text += '梅林因重伤停止抵抗，将自己的棍放在脚边。'; }
    }
  }
  const form = o.playerActions.filter(a => a.id === FORM).reduce((n, a) => n + a.appliedAmount, 0), sift = o.playerActions.filter(a => a.id === SIFT).reduce((n, a) => n + a.appliedAmount, 0);
  return roundOpening(o.source) + text + ` 本轮信息化实际减势${form}，读势为实际攻击增加${sift}；仅准备而未触发的效果不冒充实际作用。未使用窗口随回合结束失效，费用与暴露不退；原卷、旧故事、既有伤势及旧对手结局不重置。`;
}
export function projectSageCombat(s: SliceState) {
  const e = s.sage.encounter, visible = isSage(s), site = e.currentSite;
  const last = s.combat?.encounterId === 'SAGE_DISPUTE' ? s.combat.lastRound?.sageOutcome : e.terminal ? s.combatHistory[e.terminal.historyIndex]?.sageOutcome : null;
  return { enemyName: visible ? '梅林·阿什（47岁）' : '', targetId: visible ? e.targetId : null,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, maxSpirituality: 120,
    enemyHealth: visible ? e.enemyHealth : null, enemyMind: visible ? e.enemyMind : null, enemySpirituality: visible ? e.enemySpirituality : null,
    powerUses: visible ? { ...e.powerUses } : null, site: visible && site ? structuredClone(site) : null,
    originalExit: true, pursuit: false, distanceMetres: 2, automaticAllyImmunity: false, alliesPresent: 0, source: visible ? currentSageCombatSource(s) : null,
    lastActionSequence: visible && last ? [...last.playerActions.map(a => ({ ...structuredClone(a), actor: 'PLAYER' as const })), ...last.enemyActions.map(a => ({ ...structuredClone(a), actor: 'ENEMY' as const }))].sort((a, b) => a.order - b.order) : [],
    countWheel: SAGE_COUNT_WHEEL.map(x => ({ ...x })), enemyCountWheel: SAGE_ENEMY_COUNT_WHEEL.map(x => ({ ...x })), enemyAbilityWheel: SAGE_ENEMY_ABILITY_WHEEL.map(x => ({ ...x })),
    summary: visible ? '双方每轮1至6次行动。继承原11项掌握与实际已学法术、原卷来源、牢笼、迟钟和预兆成本。信息化每轮尝试一次：6灵性、2精神、6精力、一次暴露，成功只减随后一次身体攻势至多45。筛取每轮尝试一次：6灵性、2精神、一次暴露，知识检定后仍有25%抵抗；成功只给随后一次真实攻击20%优势，不自动攻击。暴露令两种尝试更困难，假动作可耗掉读势与预兆。每动作5秒、每轮60秒；继续交战时本人恢复12灵性，对手不恢复。死亡、原伤、旧物和旧结局保留。' : '' };
}
export type SageCombatProjection = ReturnType<typeof projectSageCombat>;
