import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { consumeWitchKingPaper, WITCH_KING_PAPER_SOURCE, type WitchKingPaper } from '../witch-king/life.js';
import { getSummoningMasterPartner, SUMMONING_MASTER_PARTNER_SOURCE, type SummoningMasterPartner } from '../summoning-master/life.js';
import { consumeLifeGiverBattleBead, lifeGiverLifeAnchor, returnLifeGiverGuestOrdinarily, validateLifeGiverBead, type LifeGiverBead } from './life.js';
import { LIFE_GIVER_TARGET_ID, LIFE_GIVER_POWERS, LIFE_GIVER_POWER_IDS, hasLifeGiverDisputeOpponent,
  type LifeGiverEnemyIntent, type LifeGiverPowerId, type LifeGiverGuestPermit, type LifeGiverGuestPolicy } from './encounter.js';

/** Finite G2 only. The sole original body is summoningMaster.life.partner;
 * all snapshots/model values below are transient replay evidence, never another actor or inventory. */
export const LIFE_GIVER_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const LIFE_GIVER_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const lifeGiverActionCount = pyromaniacActionCount;
export const lifeGiverEnemyActionCount = pyromaniacActionCount;
export const LIFE_GIVER_COMBAT_CONSTANTS = { weights: { physique: .35, perception: .25, will: .25, knowledge: .15 }, tier: 1250, floor: 125,
  maxSpirituality: 120, continuingRecovery: 12, enemyPhysique: 24, vitalityCost: 6, vitalityRestore: 12, shelterCost: 4,
  shelterPlayerHealthCost: 5, shelterGuestStaminaCost: 3, shelterBonusReduction: 20, newSkillDifficulty: 18 } as const;
export type LifeGiverMoveId = 'moon.s2.bounded-vitality' | 'moon.s2.shared-shelter' | 'moon.s4.blood-moon-arrow' | 'moon.s4.moon-paper-substitute'
  | 'moon.s3.bounded-summoning' | 'moon.s3.guest-cooperation' | 'STRIKE' | 'EVADE' | 'OBSERVE' | 'ACCIDENT';
const VITALITY = 'moon.s2.bounded-vitality', SHELTER = 'moon.s2.shared-shelter', ARROW = 'moon.s4.blood-moon-arrow';
const PAPER = 'moon.s4.moon-paper-substitute', SUMMON = 'moon.s3.bounded-summoning', COOPERATE = 'moon.s3.guest-cooperation';
export const LIFE_GIVER_PLAYER_ABILITIES: readonly { id: LifeGiverMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: VITALITY, label: '有限活力（每轮一次，6S＋实付原珠/知识18，只恢复原来客至多12已失精力G）', weight: 15, stance: 'PREPARE' },
  { id: SHELTER, label: '分担庇护（每轮一次4S＋原珠/知识18；下次成功合作本人H−5、来客耗3精力、额外减20G）', weight: 15, stance: 'DEFEND' },
  { id: ARROW, label: '继承血月之箭（4S/感知16，45×旧掌握G）', weight: 20, stance: 'ATTACK' },
  { id: PAPER, label: '继承同一预备原纸（3S＋PREPARED原纸，减势35G）', weight: 15, stance: 'DEFEND' },
  { id: SUMMON, label: '当场许可的原来客召入（6S/知识18＋同体过门6精力G）', weight: 15, stance: 'PREPARE' },
  { id: COOPERATE, label: '原来客合作（3S＋8原精力/知识16，32优势/减16G）', weight: 15, stance: 'ATTACK' },
  { id: 'ACCIDENT', label: '判断失衡（固定−22.5G）', weight: 5, stance: null },
];
const ABILITIES = LIFE_GIVER_PLAYER_ABILITIES;
export const LIFE_GIVER_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'DARK_BOLT', label: '有限暗矢：7S/105G', weight: 30 }, { id: 'WARD', label: '有限护术：6S/减60G', weight: 20 },
  { id: 'JAM', label: '有限干扰：4S/断实际门与庇护，来客本轮至多M−8G', weight: 20 },
  { id: 'BODY_STRIKE', label: '同一原棍：20×身体G', weight: 25 }, { id: 'ACCIDENT', label: '判断失衡：−22.5G', weight: 5 },
];
export const isLifeGiver = (s: SliceState): boolean => s.progression.pathwayId === 'moon' && s.progression.sequence === 2;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function lifeGiverAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 }));
}
export function drawLifeGiverAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): LifeGiverMoveId {
  const weights = tickets(stance); let n = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return a.id; } throw new Error('创生者能力盘无效。');
}
export function drawLifeGiverEnemyAbility(random: ActionRandomStream): LifeGiverEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of LIFE_GIVER_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as LifeGiverEnemyIntent; }
  throw new Error('原艾德里安·维尔能力盘无效。');
}
export const LIFE_GIVER_COUNTER_KEYS = ['vitalityUses', 'vitalitySuccesses', 'staminaRestored', 'shelterUses', 'shelterSuccesses', 'shelterEffects', 'shelterBroken', 'totalPlayerHealthSpent'] as const;
export interface LifeGiverCombatCounters { vitalityUses: number; vitalitySuccesses: number; staminaRestored: number; shelterUses: number; shelterSuccesses: number; shelterEffects: number; shelterBroken: number; totalPlayerHealthSpent: number }
export const freshLifeGiverCombatCounters = (): LifeGiverCombatCounters => ({ vitalityUses: 0, vitalitySuccesses: 0, staminaRestored: 0, shelterUses: 0, shelterSuccesses: 0, shelterEffects: 0, shelterBroken: 0, totalPlayerHealthSpent: 0 });
export interface LifeGiverCombatSource extends LifeGiverCombatCounters {
  runId: string; randomSeed: string; randomCursor: number; revision: number; week: number; round: number; encounterId: 'LIFE_GIVER_DISPUTE'; targetId: typeof LIFE_GIVER_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetAge: 46; targetSequence: 2; enemyPhysique: 24; actualOriginalBody: true; independentMind: true;
  enemyWeapon: 'LG2-ADRIAN-CLUB'; weaponLocation: 'HAND'; distanceMetres: 2; space: 'LG2-OPEN-STONE-COURT'; ordinaryExit: true; pursuit: false; noBystanders: true; ordinaryExitMetres: 4; ordinaryExitSeconds: 4;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  playerCoreStats: { physique: number; perception: number; will: number; knowledge: number }; playerInjuries: SliceInjury[]; enemyInjuries: SliceInjury[]; playerRisk: number; enemyRisk: number;
  clubHeld: boolean; arrowMastery: number; powerUses: Record<LifeGiverPowerId, number>; guestPolicy: LifeGiverGuestPolicy; guestPermit: LifeGiverGuestPermit | null;
  partner: SummoningMasterPartner; papers: WitchKingPaper[]; preparedPaperId: string | null; combatBeads: LifeGiverBead[]; lifeAnchor: string;
}
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const bounded = (n: number, max: number) => Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
export function lifeGiverCombatBeads(s: SliceState): LifeGiverBead[] { return s.lifeGiver.life.beads.filter(b => b.purpose === 'COMBAT'); }
export function currentLifeGiverCombatSource(s: SliceState): LifeGiverCombatSource | null {
  if (!hasLifeGiverDisputeOpponent(s)) return null;
  const e = s.lifeGiver.encounter, c = s.combat!;
  const source: LifeGiverCombatSource = { runId: s.runId, randomSeed: s.random.seed, randomCursor: s.random.cursor, revision: s.revision, week: s.week, round: c.round,
    encounterId: 'LIFE_GIVER_DISPUTE', targetId: LIFE_GIVER_TARGET_ID, attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!,
    targetAge: 46, targetSequence: 2, enemyPhysique: 24, actualOriginalBody: true, independentMind: true, enemyWeapon: 'LG2-ADRIAN-CLUB', weaponLocation: 'HAND',
    distanceMetres: 2, space: 'LG2-OPEN-STONE-COURT', ordinaryExit: true, pursuit: false, noBystanders: true, ordinaryExitMetres: 4, ordinaryExitSeconds: 4,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality,
    playerCoreStats: { ...s.character.coreStats }, playerInjuries: structuredClone(s.injuries), enemyInjuries: structuredClone(c.enemyInjuries), playerRisk: s.injuryRisk, enemyRisk: c.enemyRisk,
    clubHeld: s.town.clubLocation === 'HAND', arrowMastery: bounded(s.progression.mastery[ARROW] ?? 0, 500), powerUses: { ...e.powerUses },
    guestPolicy: e.guestPolicy, guestPermit: e.guestPermit && { ...e.guestPermit }, partner: structuredClone(getSummoningMasterPartner(s)),
    papers: structuredClone(s.witchKing.life.papers), preparedPaperId: s.witchKing.life.papers.find(p => p.status === 'PREPARED')?.id ?? null,
    combatBeads: structuredClone(lifeGiverCombatBeads(s)), lifeAnchor: lifeGiverLifeAnchor(s), ...readCounters(e) };
  return validateLifeGiverCombatSource(source) ? source : null;
}
export interface LifeGiverCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean }
interface ActionEvidence extends LifeGiverCombatEffect { order: number; paidCost: number; physicalFactor: number; rolls: number[] }
export interface LifeGiverPlayerAction extends ActionEvidence {
  id: LifeGiverMoveId; paperId: string | null; beadId: string | null; guestStaminaSpent: number; guestStaminaRestored: number; playerHealthSpent: number;
  summoned: boolean; cooperated: boolean; vitalityResult: 'NONE' | 'FAILED' | 'SUCCEEDED'; shelterResult: 'NONE' | 'FAILED' | 'OPENED'; shelterApplied: boolean;
}
export interface LifeGiverEnemyAction extends ActionEvidence {
  planned: LifeGiverEnemyIntent; actual: LifeGiverEnemyIntent; gateDestroyed: boolean; shelterDestroyed: boolean; guestMindDamage: number; guestHealthDamage: number; guestStaminaSpent: number;
}
interface RoundModel extends LifeGiverCombatCounters {
  playerHealth: number; playerSpirituality: number; enemySpirituality: number; powerUses: Record<LifeGiverPowerId, number>;
  partner: SummoningMasterPartner; papers: WitchKingPaper[]; combatBeads: LifeGiverBead[];
  gate: boolean; summonAttempted: boolean; summoned: boolean; guestDisturbed: boolean; guardReady: boolean; guardSpent: boolean;
  vitalityAttempted: boolean; shelterAttempted: boolean; shelterActive: boolean;
}
export interface LifeGiverRoundContext { source: LifeGiverCombatSource; stance: SliceStance; finished: boolean; liveState: string; model: RoundModel;
  playerActions: LifeGiverPlayerAction[]; enemyActions: LifeGiverEnemyAction[]; label: string; outcome: LifeGiverRoundOutcome | null }
function readCounters(v: LifeGiverCombatCounters): LifeGiverCombatCounters { return Object.fromEntries(LIFE_GIVER_COUNTER_KEYS.map(k => [k, v[k]])) as unknown as LifeGiverCombatCounters; }
function initialModel(x: LifeGiverCombatSource): RoundModel { return { ...readCounters(x), playerHealth: x.playerHealth, playerSpirituality: x.playerSpirituality, enemySpirituality: x.enemySpirituality,
  powerUses: { ...x.powerUses }, partner: structuredClone(x.partner), papers: structuredClone(x.papers), combatBeads: structuredClone(x.combatBeads),
  gate: false, summonAttempted: false, summoned: false, guestDisturbed: false, guardReady: false, guardSpent: false, vitalityAttempted: false, shelterAttempted: false, shelterActive: false }; }
const none = (label: string): LifeGiverCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
function liveState(s: SliceState): string { const e = s.lifeGiver.encounter; return stableStringify({ spirituality: s.spirituality, enemySpirituality: e.enemySpirituality,
  powerUses: e.powerUses, partner: getSummoningMasterPartner(s), gateOpen: e.gateOpen, shelterOpen: e.shelterOpen, papers: s.witchKing.life.papers, beads: lifeGiverCombatBeads(s), counters: readCounters(e) }); }
function commit(s: SliceState, r: LifeGiverRoundContext): void {
  const m = r.model, e = s.lifeGiver.encounter;
  s.spirituality = m.playerSpirituality; s.health = m.playerHealth; e.enemySpirituality = m.enemySpirituality; e.powerUses = { ...m.powerUses }; e.gateOpen = m.gate; e.shelterOpen = m.shelterActive;
  // Update the existing original object, not its identity, source, ownership or history.
  const p = getSummoningMasterPartner(s); p.health = m.partner.health; p.mind = m.partner.mind; p.stamina = m.partner.stamina;
  p.status = m.partner.status; p.willing = m.partner.willing; p.location = m.partner.location; p.gateCrossings = m.partner.gateCrossings;
  for (const k of LIFE_GIVER_COUNTER_KEYS) e[k] = m[k]; r.liveState = liveState(s);
}
const dynamicSource = new Set(['playerHealth', 'playerSpirituality', 'enemySpirituality', 'powerUses', 'partner', 'papers', 'preparedPaperId', 'combatBeads', ...LIFE_GIVER_COUNTER_KEYS]);
function validRound(s: SliceState, r: LifeGiverRoundContext, supplied: LifeGiverCombatSource | null): boolean {
  const actual = currentLifeGiverCombatSource(s);
  return !r.finished && actual !== null && supplied !== null && same(supplied, r.source) && s.health === r.model.playerHealth && r.liveState === liveState(s) &&
    Object.entries(r.source).every(([k, v]) => dynamicSource.has(k) || same(actual[k as keyof LifeGiverCombatSource], v));
}
export function beginLifeGiverCombatRound(s: SliceState, stance: SliceStance, _random: ActionRandomStream): LifeGiverRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('创生者姿态无效。');
  const source = currentLifeGiverCombatSource(s), e = s.lifeGiver.encounter;
  if (!source || e.gateOpen || e.shelterOpen || source.partner.status === 'ALIVE' && source.partner.location !== 'HOME') throw new Error('缺少原艾德里安、实付原珠或上轮原来客尚未普通返回。');
  return { source, stance, finished: false, liveState: liveState(s), model: initialModel(source), playerActions: [], enemyActions: [], outcome: null,
    label: `同一46岁原艾德里安·维尔在独立净空石院2米外，S${e.enemySpirituality}/120；同一流灯在${source.partner.location}、H${source.partner.health}/M${source.partner.mind}/精力${source.partner.stamina}。候选新能力、数值和场景全G，不创造生命、灵魂或复活原身体。` };
}
export const createLifeGiverCombatRound = beginLifeGiverCombatRound;
function actionBase(order: number, physical: number): ActionEvidence { return { ...none(''), order, paidCost: 0, physicalFactor: physical, rolls: [] }; }
function playerAction(x: LifeGiverCombatSource, m: RoundModel, id: LifeGiverMoveId, physical: number, order: number, roll: () => number): LifeGiverPlayerAction {
  const a: LifeGiverPlayerAction = { ...actionBase(order, physical), id, paperId: null, beadId: null, guestStaminaSpent: 0, guestStaminaRestored: 0, playerHealthSpent: 0,
    summoned: false, cooperated: false, vitalityResult: 'NONE', shelterResult: 'NONE', shelterApplied: false }, p = m.partner;
  const pay = (n: number) => { m.playerSpirituality -= n; a.paidCost = n; };
  const strike = (why = '') => { a.selfGain = (x.clubHeld ? 16 : 12) * physical; a.threatens = a.selfGain > 0; a.label = `${why}本人以${x.clubHeld ? '实际在手原棍16' : '原身体12'}×身体普通打击G，0灵性0来客成本，只占本槽，不重抽。`; };
  const evade = (why = '') => { a.enemyReduction = 10; a.label = `${why}本人普通避让减势10G，0灵性0原物成本，不重抽或免伤。`; };
  const check = (ability: 'knowledge' | 'perception', difficulty: number) => { const n = roll(); a.rolls.push(n);
    return n <= computeCheckChance({ ability, baseAbility: x.playerCoreStats[ability], difficulty, modifiers: [] }); };
  const permit = x.guestPolicy === 'ASK_HELP' && x.guestPermit !== null;
  const present = () => permit && m.summoned && p.status === 'ALIVE' && p.health > 0 && p.willing && p.location === 'YARD' && p.mind >= 30;
  const bead = () => m.combatBeads.find(b => b.purpose === 'COMBAT' && b.status === 'READY' && b.location === 'PLAYER');
  const spendBead = (b: LifeGiverBead, ability: typeof VITALITY | typeof SHELTER) => { b.status = 'SPENT'; b.spentWeek = x.week; b.combatRound = x.round; b.abilityId = ability; a.beadId = b.id; };
  if (id === 'STRIKE') strike();
  else if (id === 'EVADE') evade();
  else if (id === 'OBSERVE') a.label = '观察原身体、原来客和真实出口，0贡献0消耗，不创造或恢复资源。';
  else if (id === 'ACCIDENT') { a.selfGain = -22.5; a.label = '本槽判断失衡固定−22.5G，不重抽或增添行动者。'; }
  else if (id === VITALITY || id === SHELTER) {
    const vitality = id === VITALITY, cost = vitality ? 6 : 4, b = bead();
    if (vitality ? m.vitalityAttempted : m.shelterAttempted) evade('本轮已实际尝试这项新能力，不能重骰或叠加；');
    else if (!present() || vitality && p.stamina >= 100 || !vitality && m.playerHealth <= 10 || !b || m.playerSpirituality < cost)
      evade(`缺少当场自愿且在场的存活原来客、${vitality ? '实际疲劳' : '本人H>10'}、实付READY原珠或${cost}S，未尝试新能力；`);
    else {
      pay(cost); spendBead(b, id);
      if (vitality) { m.vitalityAttempted = true; m.vitalityUses++; }
      else { m.shelterAttempted = true; m.shelterUses++; }
      if (!check('knowledge', 18)) { if (vitality) a.vitalityResult = 'FAILED'; else a.shelterResult = 'FAILED';
        a.label = `${vitality ? '有限活力' : '分担庇护'}知识18失败，已付${cost}S和原珠${b.id}照耗，原珠实物保留；没有实际恢复、代价分担或重试。`; }
      else if (vitality) { a.vitalityResult = 'SUCCEEDED'; a.guestStaminaRestored = Math.min(12, 100 - p.stamina); p.stamina += a.guestStaminaRestored;
        m.vitalitySuccesses++; m.staminaRestored += a.guestStaminaRestored;
        a.label = `有限活力知识18成功，实际6S及原珠${b.id}用尽，只为同一存活且自愿来客补回${a.guestStaminaRestored}已失精力至${p.stamina}/100；不改H/M、不治伤、不补灵性、不复活或增加行动。`; }
      else { a.shelterResult = 'OPENED'; m.shelterActive = true; m.shelterSuccesses++;
        a.label = `分担庇护知识18成功，实际4S及原珠${b.id}用尽，打开本轮一次有限分担窗口。仅下次实际成功合作且本人H>5才耗本人5H，将该次原来客精力8改3并额外减势20G；失败合作仍耗8，无后续成功则不应用，干扰或轮末终止。`; }
    }
  } else if (id === PAPER) {
    const paper = m.papers.find(p => p.status === 'PREPARED');
    if (m.playerSpirituality < 3 || !paper || paper.id !== x.preparedPaperId) evade('没有战前同一PREPARED原纸或不足3S；');
    else { pay(3); a.paperId = paper.id; paper.status = 'CONSUMED'; paper.consumedWeek = x.week; paper.consumedBy = 'COMBAT'; paper.combatRound = x.round; a.enemyReduction = 35;
      a.label = `继承同一预备原纸${paper.id}和3S真实消耗，有限纸影减势35G；未准备原纸不自动可用，不能复制身体或复活。`; }
  } else if (id === SUMMON) {
    if (m.summonAttempted) evade('本轮已实际尝试召入，不能重开或重骰；');
    else if (!permit || p.status !== 'ALIVE' || p.health <= 0 || !p.willing || p.metWeek === null || p.location !== 'HOME' || p.stamina < 6 || p.mind < 30 || m.playerSpirituality < 6)
      evade('缺少本场新许可、HOME原来客意愿或原资源；');
    else { m.summonAttempted = true; pay(6);
      if (!check('knowledge', 18)) a.label = '继承有限召唤知识18失败，实际6S照耗；同一来客仍HOME，未耗过门精力，不重抽或重造。';
      else { p.stamina -= 6; p.gateCrossings++; p.location = 'YARD'; m.gate = true; m.summoned = true; a.summoned = true; a.guestStaminaSpent = 6;
        a.label = '继承有限召唤知识18成功，实际6S；同一流灯耗6原精力亲自从HOME过门到YARD，原声片随同体。本槽0优势，仍只有双方次数盘；门断不删除身体。'; }
    }
  } else if (id === COOPERATE) {
    if (!present() || p.stamina < 8 || m.playerSpirituality < 3) strike('原来客未实际到场、当前不愿或不足原8精力/3S，未合作；');
    else { pay(3); const succeeded = check('knowledge', 16);
      const apply = succeeded && m.shelterActive && m.playerHealth > 5;
      a.guestStaminaSpent = apply ? 3 : 8; p.stamina -= a.guestStaminaSpent;
      if (!succeeded) a.label = '继承原来客合作知识16失败，实际3S和8原精力照耗；没有成功动作可分担，不加成、不扣本人H或退还失败成本。';
      else { a.cooperated = true; a.selfGain = 32; a.enemyReduction = 16; a.threatens = true; if (!m.guardSpent) m.guardReady = true;
        if (apply) { m.shelterActive = false; m.playerHealth -= 5; m.totalPlayerHealthSpent += 5; m.shelterEffects++; a.playerHealthSpent = 5; a.shelterApplied = true; a.enemyReduction += 20; }
        a.label = `继承原流灯合作知识16成功，实际3S和${a.guestStaminaSpent}原精力，贡献32/减16G。${apply ? '已付庇护应用于本次动作，本人原H实际−5，额外减势20G，窗口用尽；' : '本次没有应用庇护；'}后续本轮最多一次实际承接原棍另耗来客H5/精力4，共同伤势盘不取消。`; }
    }
  } else if (id === ARROW) {
    if (m.playerSpirituality < 4) strike('不足4S，旧箭未施放；');
    else { pay(4); if (check('perception', 16)) { a.selfGain = 45 * (.65 + .35 * x.arrowMastery / 500); a.threatens = true;
        a.label = '继承血月之箭实际4S/感知16成功，45×旧掌握G优势；伤势仍由共同盘裁定。'; }
      else a.label = '继承血月之箭感知16失败，4S照耗，0贡献不重抽。'; }
  }
  return a;
}
function enemyAction(m: RoundModel, planned: LifeGiverEnemyIntent, physical: number, order: number): LifeGiverEnemyAction {
  const power = LIFE_GIVER_POWERS.find(q => q.id === planned);
  const a: LifeGiverEnemyAction = { ...actionBase(order, physical), planned, actual: power && m.enemySpirituality < power.cost ? 'BODY_STRIKE' : planned,
    gateDestroyed: false, shelterDestroyed: false, guestMindDamage: 0, guestHealthDamage: 0, guestStaminaSpent: 0 }, p = m.partner;
  if (power && a.actual === planned) { m.enemySpirituality -= power.cost; m.powerUses[power.id]++; a.paidCost = power.cost; a.selfGain = power.selfGain; a.enemyReduction = power.enemyReduction; }
  if (a.actual === 'ACCIDENT') { a.selfGain = -22.5; a.label = '原艾德里安·维尔本槽判断失衡，固定−22.5G，不重抽。'; }
  else if (a.actual === 'BODY_STRIKE') {
    a.selfGain = 20 * physical; a.threatens = a.selfGain > 0;
    if (a.threatens && m.guardReady && !m.guardSpent && p.status === 'ALIVE' && p.location === 'YARD' && p.willing && p.stamina >= 4) {
      m.guardReady = false; m.guardSpent = true; a.guestHealthDamage = Math.min(5, p.health); p.health -= a.guestHealthDamage; a.guestStaminaSpent = 4; p.stamina -= 4;
      if (p.health === 0) { p.status = 'DEAD'; p.willing = false; m.shelterActive = false; }
    }
    a.label = `${power ? '独立原灵性不足，同槽回退、不补灵；' : ''}原艾德里安持自己的唯一LG2-ADRIAN-CLUB，普通20×身体G打击、0S。${a.guestStaminaSpent ? `真实合作窗口中同一流灯承接一次，原H−${a.guestHealthDamage}/精力−4${p.status === 'DEAD' ? '，同体与原声片留YARD，不能复活或换体' : ''}，共同伤势盘照常` : '来客未承接，不扣其原资源'}。`;
  } else if (a.actual === 'JAM') {
    a.gateDestroyed = m.gate; a.shelterDestroyed = m.shelterActive; m.gate = false; m.shelterActive = false; if (a.shelterDestroyed) m.shelterBroken++;
    if (m.summoned && !m.guestDisturbed && p.status === 'ALIVE' && p.location === 'YARD') { a.guestMindDamage = Math.min(8, p.mind); p.mind -= a.guestMindDamage; m.guestDisturbed = true; }
    a.label = `原艾德里安实际4S干扰：${a.gateDestroyed ? '原门断连' : '无开门可断'}，${a.shelterDestroyed ? '已实付庇护受到实际抵抗并中断，不退款、不产生分担效果' : '无庇护窗口可断'}。${a.guestMindDamage ? `同一已到场流灯本轮首次实际M−${a.guestMindDamage}` : '未重复惊扰'}；原身体及声片仍在实际YARD，活来客可走原30米路回家。`;
  } else { a.threatens = a.actual === 'DARK_BOLT'; a.label = `原艾德里安${power!.label}实际${a.paidCost}S，贡献${a.selfGain}/减势${a.enemyReduction}G，独立余S${m.enemySpirituality}/120；共同伤势盘照常。`; }
  return a;
}
const allowed = (id: string): id is LifeGiverMoveId => [...ABILITIES.map(a => a.id), 'STRIKE', 'EVADE', 'OBSERVE'].includes(id);
const enemyAllowed = (id: string): id is LifeGiverEnemyIntent => LIFE_GIVER_ENEMY_ABILITY_WHEEL.some(a => a.id === id);
export function resolveLifeGiverCombatAbility(s: SliceState, id: LifeGiverMoveId, physical: number, random: ActionRandomStream,
  r: LifeGiverRoundContext, source: LifeGiverCombatSource | null = r.source): LifeGiverCombatEffect {
  if (!allowed(id) || r.playerActions.length >= 6 || !validRound(s, r, source)) return none('原身体、原来客或本场真实原珠/原纸来源不符，0贡献0消耗，不重抽。');
  const a = playerAction(r.source, r.model, id, bounded(physical, 1), r.playerActions.length + r.enemyActions.length, () => random.nextInt(1, 100));
  if (a.paperId) { const paper = s.witchKing.life.papers.find(p => p.id === a.paperId)!; consumeWitchKingPaper(s, paper, 'COMBAT', r.source.round); }
  if (a.beadId) { const bead = consumeLifeGiverBattleBead(s, r.source.round, id as typeof VITALITY | typeof SHELTER); if (bead?.id !== a.beadId) throw new Error('实际原珠与已核原珠不符。'); }
  r.playerActions.push(a); commit(s, r); return a;
}
export function resolveLifeGiverEnemyAbility(s: SliceState, planned: LifeGiverEnemyIntent, physical: number, _random: ActionRandomStream,
  r: LifeGiverRoundContext, source: LifeGiverCombatSource | null = r.source): LifeGiverCombatEffect {
  if (!enemyAllowed(planned) || r.enemyActions.length >= 6 || !validRound(s, r, source)) return none('原艾德里安独立原身体或原棍来源不符，0贡献0消耗，不重抽。');
  const a = enemyAction(r.model, planned, bounded(physical, 1), r.playerActions.length + r.enemyActions.length); r.enemyActions.push(a); commit(s, r); return a;
}
export interface LifeGiverRoundOutcome extends LifeGiverCombatCounters {
  targetId: typeof LIFE_GIVER_TARGET_ID; round: number; source: LifeGiverCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerHealthBeforeInjury: number; playerMindAfter: number; enemySpiritualityBefore: number;
  powerUses: Record<LifeGiverPowerId, number>; partnerAfter: SummoningMasterPartner; papersAfter: WitchKingPaper[]; papersConsumed: string[]; combatBeads: LifeGiverBead[];
  playerInjuriesAfter: SliceInjury[]; enemyInjuriesAfter: SliceInjury[]; playerRiskAfter: number; enemyRiskAfter: number; randomCursorAfter: number;
  gateOpenAfter: false; shelterOpenAfter: false; shelterExpired: boolean; ordinaryReturnMetres: number; elapsedSeconds: 60;
  playerActions: LifeGiverPlayerAction[]; enemyActions: LifeGiverEnemyAction[];
}
export function finishLifeGiverCombatRound(s: SliceState, r: LifeGiverRoundContext, continuing = true, randomCursorAfter = r.source.randomCursor): LifeGiverRoundOutcome {
  const e = s.lifeGiver.encounter, c = s.combat, m = r.model;
  if (r.finished || !c || c.encounterId !== 'LIFE_GIVER_DISPUTE' || c.round !== r.source.round || r.liveState !== liveState(s) || s.health > m.playerHealth) throw new Error('原创生者回合已结束或真实资源被改写。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  if (e.enemyStatus !== 'RESISTING') e.weaponLocation = 'YARD';
  const shelterExpired = m.shelterActive; e.gateOpen = false; e.shelterOpen = false;
  const ordinaryReturnMetres = returnLifeGiverGuestOrdinarily(s); s.lifeGiver.life.clockSeconds += 60 - ordinaryReturnMetres; e.elapsedCombatSeconds += 60;
  r.finished = true;
  r.outcome = { targetId: LIFE_GIVER_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus,
    playerSpiritualityBefore: r.source.playerSpirituality, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerHealthBeforeInjury: m.playerHealth, playerMindAfter: s.mind,
    enemySpiritualityBefore: r.source.enemySpirituality, powerUses: { ...e.powerUses }, partnerAfter: structuredClone(getSummoningMasterPartner(s)),
    papersAfter: structuredClone(s.witchKing.life.papers), papersConsumed: r.playerActions.flatMap(a => a.paperId ? [a.paperId] : []), combatBeads: structuredClone(lifeGiverCombatBeads(s)),
    playerInjuriesAfter: structuredClone(s.injuries), enemyInjuriesAfter: structuredClone(c.enemyInjuries), playerRiskAfter: s.injuryRisk, enemyRiskAfter: c.enemyRisk, randomCursorAfter,
    gateOpenAfter: false, shelterOpenAfter: false, shelterExpired, ordinaryReturnMetres, elapsedSeconds: 60,
    playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions), ...readCounters(e) };
  return structuredClone(r.outcome);
}
export function lifeGiverRoundOutcome(r: LifeGiverRoundContext): LifeGiverRoundOutcome { if (!r.outcome) throw new Error('先实际结束回合。'); return structuredClone(r.outcome); }
export function projectLifeGiverCombat(s: SliceState) {
  const e = s.lifeGiver.encounter;
  return { enemyName: '艾德里安·维尔（46岁，原创有限G2等效对手）', targetId: e.targetId, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality,
    powerUses: { ...e.powerUses }, guestPolicy: e.guestPolicy, guestPermit: e.guestPermit && { ...e.guestPermit }, partner: structuredClone(getSummoningMasterPartner(s)),
    combatBeads: structuredClone(lifeGiverCombatBeads(s)), ...readCounters(e), gateOpen: e.gateOpen, shelterOpen: e.shelterOpen,
    constants: LIFE_GIVER_COMBAT_CONSTANTS, countWheel: LIFE_GIVER_COUNT_WHEEL, enemyCountWheel: LIFE_GIVER_ENEMY_COUNT_WHEEL,
    abilityWheel: lifeGiverAbilityWheel(s, null), enemyAbilityWheel: LIFE_GIVER_ENEMY_ABILITY_WHEEL,
    originalExit: true, pursuit: false, distanceMetres: 2, exitTravelMetres: e.exitTravelMetres, exitSeconds: e.exitSeconds, source: currentLifeGiverCombatSource(s),
    summary: '创生者新增能力全G；双方次数1–6权重10/15/25/25/15/10，继承实际月亮核心35/25/25/15、1250/底125、S120，仅继续轮本人+12S。有限活力6S+原珠只补原来客实际疲劳至多12；庇护4S+原珠仅下次成功合作减精力8→3，同时本人H−5并额外减势20，未应用不会算效果。新敌暗矢7S/105、护术6S/60、干扰4S断门/庇护并至多惊扰来客M−8，缺灵普通原棍。旧原纸、箭、召入、合作照原成本；共同伤势/死亡无豁免。活来客轮末普通30米返家，死亡同体声片留场；生还本人拾回全部原珠实走4米4秒，死亡原珠留YARD。' };
}
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const exactKeys = (v: object, keys: readonly string[]) => !!v && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
export function validateLifeGiverCombatCounters(c: LifeGiverCombatCounters): boolean {
  return LIFE_GIVER_COUNTER_KEYS.every(k => integer(c[k])) && c.vitalitySuccesses <= c.vitalityUses && c.staminaRestored >= c.vitalitySuccesses && c.staminaRestored <= c.vitalitySuccesses * 12 &&
    c.shelterSuccesses <= c.shelterUses && c.shelterEffects + c.shelterBroken <= c.shelterSuccesses && c.totalPlayerHealthSpent === c.shelterEffects * 5;
}
export function validateLifeGiverPartner(p: SummoningMasterPartner, week: number): boolean {
  return !!p && exactKeys(p, ['id', 'name', 'source', 'adult', 'independentMind', 'bodyId', 'homeId', 'location', 'health', 'mind', 'stamina', 'status', 'willing', 'metWeek', 'ordinaryDistanceM', 'gateCrossings', 'chime', 'restHistory']) &&
    p.id === 'SM3-LUMEN' && p.name === '流灯' && p.source === SUMMONING_MASTER_PARTNER_SOURCE && p.adult === true && p.independentMind === true && p.bodyId === 'SM3-LUMEN-BODY' && p.homeId === 'SM3-GLASS-ROOM' &&
    ['HOME', 'YARD', 'PATH'].includes(p.location) && [p.health, p.mind, p.stamina].every(n => integer(n, 0, 100)) && ['ALIVE', 'DEAD'].includes(p.status) && (p.status === 'DEAD') === (p.health === 0) &&
    typeof p.willing === 'boolean' && (p.status !== 'DEAD' || p.willing === false) && (p.metWeek === null || integer(p.metWeek, 1, week)) && integer(p.ordinaryDistanceM) && integer(p.gateCrossings) &&
    exactKeys(p.chime, ['id', 'owner']) && p.chime.id === 'SM3-CHIME' && p.chime.owner === 'SM3-LUMEN' && Array.isArray(p.restHistory) && p.restHistory.every((r, i) =>
      exactKeys(r, ['week', 'paidPennies', 'staminaBefore', 'staminaAfter', 'mindBefore', 'mindAfter', 'healthUnchanged']) && integer(r.week, 1, week) && (i === 0 || r.week > p.restHistory[i - 1]!.week) && r.paidPennies === 30 &&
      [r.staminaBefore, r.staminaAfter, r.mindBefore, r.mindAfter, r.healthUnchanged].every(n => integer(n, 0, 100)) && r.healthUnchanged > 0 && r.staminaAfter === Math.min(100, r.staminaBefore + 30) && r.mindAfter === Math.min(100, r.mindBefore + 10));
}
export function validateLifeGiverPapers(papers: WitchKingPaper[], week: number): boolean {
  return Array.isArray(papers) && new Set(papers.map(p => p?.id)).size === papers.length && papers.every(p => !!p && exactKeys(p, ['id', 'batch', 'source', 'purchasedWeek', 'status', 'preparedWeek', 'consumedWeek', 'consumedBy', 'combatRound']) &&
    integer(p.batch, 1) && new RegExp(`^WK4-PAPER-${p.batch}-[123]$`).test(p.id) && p.source === WITCH_KING_PAPER_SOURCE && integer(p.purchasedWeek, 1, week) &&
    (p.status === 'HELD' ? p.preparedWeek === null && p.consumedWeek === null && p.consumedBy === null && p.combatRound === null :
      integer(p.preparedWeek, p.purchasedWeek, week) && (p.status === 'PREPARED' ? p.consumedWeek === null && p.consumedBy === null && p.combatRound === null :
        p.status === 'CONSUMED' && integer(p.consumedWeek, p.preparedWeek!, week) && (p.consumedBy === 'COMBAT' ? integer(p.combatRound, 1) : p.consumedBy === 'PAPER_TRIAL' && p.combatRound === null))));
}
function validInjuries(v: SliceInjury[], revision: number): boolean { return Array.isArray(v) && new Set(v.map(i => i?.id)).size === v.length && v.every(i => !!i && exactKeys(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) &&
  typeof i.id === 'string' && ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision, 0, revision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision, revision))); }
const SOURCE_KEYS = ['runId', 'randomSeed', 'randomCursor', 'revision', 'week', 'round', 'encounterId', 'targetId', 'attemptWeek', 'startHistoryIndex', 'targetAge', 'targetSequence', 'enemyPhysique', 'actualOriginalBody', 'independentMind', 'enemyWeapon', 'weaponLocation', 'distanceMetres', 'space', 'ordinaryExit', 'pursuit', 'noBystanders', 'ordinaryExitMetres', 'ordinaryExitSeconds', 'playerHealth', 'playerMind', 'playerSpirituality', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'playerCoreStats', 'playerInjuries', 'enemyInjuries', 'playerRisk', 'enemyRisk', 'clubHeld', 'arrowMastery', 'powerUses', 'guestPolicy', 'guestPermit', 'partner', 'papers', 'preparedPaperId', 'combatBeads', 'lifeAnchor', ...LIFE_GIVER_COUNTER_KEYS];
const OUTCOME_KEYS = ['targetId', 'round', 'source', 'stance', 'continuing', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'playerSpiritualityBefore', 'playerSpiritualityAfter', 'playerHealthAfter', 'playerHealthBeforeInjury', 'playerMindAfter', 'enemySpiritualityBefore', 'powerUses', 'partnerAfter', 'papersAfter', 'papersConsumed', 'combatBeads', 'playerInjuriesAfter', 'enemyInjuriesAfter', 'playerRiskAfter', 'enemyRiskAfter', 'randomCursorAfter', 'gateOpenAfter', 'shelterOpenAfter', 'shelterExpired', 'ordinaryReturnMetres', 'elapsedSeconds', 'playerActions', 'enemyActions', ...LIFE_GIVER_COUNTER_KEYS];
export function validateLifeGiverCombatSource(x: LifeGiverCombatSource): boolean {
  try { const permit = x?.guestPermit;
    return !!x && exactKeys(x, SOURCE_KEYS) && typeof x.runId === 'string' && x.runId.length > 0 && typeof x.randomSeed === 'string' && x.randomSeed.length > 0 && x.randomSeed.length <= 256 && integer(x.randomCursor) && integer(x.revision) && integer(x.week, 1) && integer(x.round, 1) && x.attemptWeek === x.week && integer(x.startHistoryIndex) &&
      x.encounterId === 'LIFE_GIVER_DISPUTE' && x.targetId === LIFE_GIVER_TARGET_ID && x.targetAge === 46 && x.targetSequence === 2 && x.enemyPhysique === 24 && x.actualOriginalBody === true && x.independentMind === true &&
      x.enemyWeapon === 'LG2-ADRIAN-CLUB' && x.weaponLocation === 'HAND' && x.distanceMetres === 2 && x.space === 'LG2-OPEN-STONE-COURT' && x.ordinaryExit === true && x.pursuit === false && x.noBystanders === true && x.ordinaryExitMetres === 4 && x.ordinaryExitSeconds === 4 &&
      [x.playerHealth, x.playerMind, x.enemyHealth, x.enemyMind].every(n => integer(n, 1, 100)) && [x.playerSpirituality, x.enemySpirituality].every(n => integer(n, 0, 120)) &&
      exactKeys(x.playerCoreStats, ['physique', 'perception', 'will', 'knowledge']) && Object.values(x.playerCoreStats).every(n => integer(n, 0, 500)) && validInjuries(x.playerInjuries, x.revision) && validInjuries(x.enemyInjuries, x.revision) && integer(x.playerRisk) && integer(x.enemyRisk) && typeof x.clubHeld === 'boolean' && integer(x.arrowMastery, 0, 500) &&
      exactKeys(x.powerUses, LIFE_GIVER_POWER_IDS) && LIFE_GIVER_POWER_IDS.every(id => integer(x.powerUses[id])) && x.enemySpirituality === 120 - LIFE_GIVER_POWERS.reduce((n, p) => n + x.powerUses[p.id] * p.cost, 0) &&
      (x.guestPolicy === 'HOME' ? permit === null : x.guestPolicy === 'ASK_HELP' && !!permit && exactKeys(permit, ['partnerId', 'encounterId', 'approachWeek', 'paidWeek', 'paidPence', 'negotiationTravelMetres', 'negotiationSeconds', 'visitNumber']) &&
        permit.partnerId === 'SM3-LUMEN' && permit.encounterId === 'LIFE_GIVER_DISPUTE' && integer(permit.approachWeek, 1, x.week) && permit.approachWeek === permit.paidWeek && permit.paidPence === 20 && permit.negotiationTravelMetres === 60 && permit.negotiationSeconds === 60 && integer(permit.visitNumber, 1)) &&
      validateLifeGiverPartner(x.partner, x.week) && validateLifeGiverPapers(x.papers, x.week) && x.preparedPaperId === (x.papers.find(p => p.status === 'PREPARED')?.id ?? null) &&
      Array.isArray(x.combatBeads) && x.combatBeads.length <= 3 && new Set(x.combatBeads.map(b => b.id)).size === x.combatBeads.length && x.combatBeads.every(b => validateLifeGiverBead(b, x.week) && b.purpose === 'COMBAT' && b.location === 'PLAYER') &&
      typeof x.lifeAnchor === 'string' && x.lifeAnchor.length > 0 && validateLifeGiverCombatCounters(x);
  } catch { return false; }
}
/** Exact paid-action replay. The adapter separately verifies count/ability RNG and the common wound/death wheel. */
export function validateLifeGiverRoundOutcome(value: unknown): value is LifeGiverRoundOutcome {
  try {
    const o = value as LifeGiverRoundOutcome, x = o?.source;
    if (!o || !exactKeys(o, OUTCOME_KEYS) || !validateLifeGiverCombatSource(x) || o.targetId !== LIFE_GIVER_TARGET_ID || o.round !== x.round || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) || typeof o.continuing !== 'boolean' || o.elapsedSeconds !== 60 ||
      o.gateOpenAfter !== false || o.shelterOpenAfter !== false || typeof o.shelterExpired !== 'boolean' || !validateLifeGiverPartner(o.partnerAfter, x.week) || !validateLifeGiverPapers(o.papersAfter, x.week) ||
      ![o.enemyHealth, o.playerHealthAfter].every(n => integer(n, 0, 100)) || !integer(o.playerHealthBeforeInjury, o.playerHealthAfter, x.playerHealth) || o.enemyHealth > x.enemyHealth || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(o.enemyStatus) || (o.enemyStatus === 'DEAD') !== (o.enemyHealth === 0) ||
      o.enemyMind !== x.enemyMind || o.playerMindAfter !== x.playerMind || ![o.playerSpiritualityAfter, o.enemySpirituality].every(n => integer(n, 0, 120)) || o.playerSpiritualityBefore !== x.playerSpirituality || o.enemySpiritualityBefore !== x.enemySpirituality ||
      !validInjuries(o.playerInjuriesAfter, x.revision + 1) || !validInjuries(o.enemyInjuriesAfter, x.revision + 1) || !integer(o.playerRiskAfter) || !integer(o.enemyRiskAfter) || !integer(o.randomCursorAfter, x.randomCursor) ||
      !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) || o.playerActions.length > 6 || o.enemyActions.length > 6 || !Array.isArray(o.papersConsumed) || new Set(o.papersConsumed).size !== o.papersConsumed.length ||
      o.continuing && (o.enemyStatus !== 'RESISTING' || o.playerHealthAfter <= 0)) return false;
    const m = initialModel(x), all = [...o.playerActions.map(a => ({ actor: 'PLAYER', a })), ...o.enemyActions.map(a => ({ actor: 'ENEMY', a }))].sort((a, b) => a.a.order - b.a.order);
    for (const [i, item] of all.entries()) {
      const a = item.a;
      if (a.order !== i || !Number.isFinite(a.physicalFactor) || a.physicalFactor < 0 || a.physicalFactor > 1 || !Array.isArray(a.rolls) || a.rolls.some(n => !integer(n, 1, 100))) return false;
      let expected: LifeGiverPlayerAction | LifeGiverEnemyAction;
      if (item.actor === 'PLAYER') { const p = a as LifeGiverPlayerAction; if (!allowed(p.id)) return false; let cursor = 0;
        expected = playerAction(x, m, p.id, p.physicalFactor, i, () => { const n = p.rolls[cursor++]; if (n === undefined) throw new Error('Missing original check'); return n; }); if (cursor !== p.rolls.length) return false;
      } else { const e = a as LifeGiverEnemyAction; if (!enemyAllowed(e.planned)) return false; expected = enemyAction(m, e.planned, e.physicalFactor, i); }
      if (!same(a, expected)) return false;
    }
    const returned = m.partner.status === 'ALIVE' && m.partner.location !== 'HOME' ? 30 : 0;
    if (returned) { m.partner.location = 'HOME'; m.partner.ordinaryDistanceM += 30; }
    return o.shelterExpired === m.shelterActive && o.ordinaryReturnMetres === returned && same(o.partnerAfter, m.partner) && same(o.papersAfter, m.papers) &&
      same(o.papersConsumed, o.playerActions.flatMap(a => a.paperId ? [a.paperId] : [])) && same(o.combatBeads, m.combatBeads) && o.playerHealthBeforeInjury === m.playerHealth &&
      o.playerSpiritualityAfter === m.playerSpirituality && o.enemySpirituality === m.enemySpirituality && same(o.powerUses, m.powerUses) && same(readCounters(o), readCounters(m));
  } catch { return false; }
}
/** Narrow evidence hook for the sole old paper validator. Never creates or prepares a paper. */
export function lifeGiverConsumedPaperEvidence(s: SliceState, paper: WitchKingPaper): boolean {
  const e = s.lifeGiver?.encounter;
  if (!e || e.attemptWeek !== paper.consumedWeek || e.startHistoryIndex === null || paper.consumedBy !== 'COMBAT' || paper.combatRound === null) return false;
  const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length;
  return s.combatHistory.slice(e.startHistoryIndex, end).some(r => r.round === paper.combatRound && validateLifeGiverRoundOutcome(r.lifeGiverOutcome) && r.lifeGiverOutcome.papersConsumed.includes(paper.id) &&
    r.lifeGiverOutcome.playerActions.some(a => a.id === PAPER && a.paperId === paper.id && a.paidCost === 3));
}
