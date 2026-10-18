import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { consumeWitchKingPaper, preparedWitchKingPaper, WITCH_KING_PAPER_SOURCE } from '../witch-king/life.js';
import { getSummoningMasterPartner, moveSummoningMasterPartner, returnSummoningMasterGuestOrdinarily,
  SUMMONING_MASTER_PARTNER_SOURCE, type SummoningMasterPartner } from './life.js';
import { SUMMONING_MASTER_TARGET_ID, SUMMONING_MASTER_POWERS, SUMMONING_MASTER_POWER_IDS, hasSummoningMasterDisputeOpponent,
  hasSummoningMasterGuestPermit, type SummoningMasterEnemyIntent, type SummoningMasterPowerId,
  type SummoningMasterGuestPermit, type SummoningMasterGuestPolicy } from './encounter.js';

/** G3 keeps the actual Moon4 35/25/25/15 core, 1250/floor125, S120 and CONTINUE-only12.
 * The only guest body/resources live in life.partner. Snapshots below are history, never an inventory or another actor. */
export const SUMMONING_MASTER_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const SUMMONING_MASTER_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const summoningMasterActionCount = pyromaniacActionCount;
export const summoningMasterEnemyActionCount = pyromaniacActionCount;
export type SummoningMasterMoveId = 'moon.s4.blood-moon-arrow' | 'moon.s4.moon-paper-substitute' | 'moon.s7.abyss-shackles'
  | 'moon.s3.bounded-summoning' | 'moon.s3.guest-cooperation' | 'STRIKE' | 'EVADE' | 'OBSERVE' | 'ACCIDENT';
const ARROW = 'moon.s4.blood-moon-arrow', PAPER = 'moon.s4.moon-paper-substitute', SHACKLES = 'moon.s7.abyss-shackles';
const SUMMON = 'moon.s3.bounded-summoning', COOPERATE = 'moon.s3.guest-cooperation';
const ABILITIES: readonly { id: SummoningMasterMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: ARROW, label: '继承血月之箭（H；4S/感知16，45×旧掌握G）', weight: 25, stance: 'ATTACK' },
  { id: PAPER, label: '继承同一预备原纸（J；3S＋实际原纸，减势35G）', weight: 20, stance: 'DEFEND' },
  { id: SUMMON, label: '有许可的有限召唤（B；6S/知识18＋同体过门6精力G）', weight: 20, stance: 'PREPARE' },
  { id: SHACKLES, label: '继承有限深渊枷锁（K；2S/感知16，减势18G）', weight: 15, stance: 'CONTROL' },
  { id: COOPERATE, label: '原来客有限合作（R；3S＋8原精力/知识16，32/减16G）', weight: 15, stance: 'ATTACK' },
  { id: 'ACCIDENT', label: '判断失衡（A；固定−22.5G）', weight: 5, stance: null },
];
export const SUMMONING_MASTER_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'DARK_BOLT', label: '有限暗矢：5S/75G', weight: 35 }, { id: 'WARD', label: '有限护术：4S/减45G', weight: 25 },
  { id: 'BODY_STRIKE', label: '同一原棍：20×身体G', weight: 20 }, { id: 'DISRUPT', label: '干扰原门：4S/来客惊扰一次M−8G', weight: 15 },
  { id: 'ACCIDENT', label: '判断偏差：−22.5G', weight: 5 },
];
export const isSummoningMaster = (s: SliceState): boolean => s.progression.pathwayId === 'moon' && s.progression.sequence === 3;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function summoningMasterAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 }));
}
export function drawSummoningMasterAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): SummoningMasterMoveId {
  const weights = tickets(stance); let n = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return a.id; } throw new Error('召唤大师能力盘无效。');
}
export function drawSummoningMasterEnemyAbility(random: ActionRandomStream): SummoningMasterEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of SUMMONING_MASTER_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as SummoningMasterEnemyIntent; }
  throw new Error('原埃德温能力盘无效。');
}
export interface SummoningMasterCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'SUMMONING_MASTER_DISPUTE'; targetId: typeof SUMMONING_MASTER_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetAge: 46; targetSequence: 3; actualOriginalBody: true; independentMind: true;
  enemyWeapon: 'SM3-EDWIN-CLUB'; weaponLocation: 'HAND'; distanceMetres: 2; space: 'SM3-OPEN-STONE-COURT'; ordinaryExit: true; pursuit: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  clubHeld: boolean; knowledge: number; perception: number; arrowMastery: number; powerUses: Record<SummoningMasterPowerId, number>;
  guestPolicy: SummoningMasterGuestPolicy; guestPermit: SummoningMasterGuestPermit | null; partner: SummoningMasterPartner; preparedPaperId: string | null;
}
const bounded = (n: number, max: number) => Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
export function currentSummoningMasterCombatSource(s: SliceState): SummoningMasterCombatSource | null {
  if (!hasSummoningMasterDisputeOpponent(s) || !validPartner(getSummoningMasterPartner(s))) return null;
  const e = s.summoningMaster.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'SUMMONING_MASTER_DISPUTE', targetId: SUMMONING_MASTER_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetAge: 46, targetSequence: 3, actualOriginalBody: true, independentMind: true,
    enemyWeapon: 'SM3-EDWIN-CLUB', weaponLocation: 'HAND', distanceMetres: 2, space: 'SM3-OPEN-STONE-COURT', ordinaryExit: true, pursuit: false,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality,
    clubHeld: s.town.clubLocation === 'HAND', knowledge: s.character.coreStats.knowledge, perception: s.character.coreStats.perception,
    arrowMastery: bounded(s.progression.mastery[ARROW] ?? 0, 500), powerUses: { ...e.powerUses }, guestPolicy: e.guestPolicy,
    guestPermit: e.guestPermit && { ...e.guestPermit }, partner: structuredClone(getSummoningMasterPartner(s)), preparedPaperId: preparedWitchKingPaper(s)?.id ?? null };
}
export interface SummoningMasterCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean }
interface ActionEvidence extends SummoningMasterCombatEffect { order: number; paidCost: number; physicalFactor: number; rolls: number[] }
export interface SummoningMasterPlayerAction extends ActionEvidence {
  id: SummoningMasterMoveId; paperId: string | null; guestStaminaSpent: number; summoned: boolean; cooperated: boolean;
}
export interface SummoningMasterEnemyAction extends ActionEvidence {
  planned: SummoningMasterEnemyIntent; actual: SummoningMasterEnemyIntent; gateDestroyed: boolean;
  guestMindDamage: number; guestHealthDamage: number; guestStaminaSpent: number;
}
export interface SummoningMasterRoundContext {
  source: SummoningMasterCombatSource; stance: SliceStance; finished: boolean; liveState: string; summonAttempted: boolean;
  summoned: boolean; guestDisturbed: boolean; guardReady: boolean; guardSpent: boolean;
  playerActions: SummoningMasterPlayerAction[]; enemyActions: SummoningMasterEnemyAction[]; label: string; outcome: SummoningMasterRoundOutcome | null;
}
const none = (label: string): SummoningMasterCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
function liveState(s: SliceState): string { const e = s.summoningMaster.encounter; return stableStringify({ spirituality: s.spirituality,
  enemySpirituality: e.enemySpirituality, powerUses: e.powerUses, partner: getSummoningMasterPartner(s), gateOpen: e.gateOpen, papers: s.witchKing.life.papers }); }
const dynamicSource = new Set(['playerSpirituality', 'enemySpirituality', 'powerUses', 'partner', 'preparedPaperId']);
function validRound(s: SliceState, r: SummoningMasterRoundContext, supplied: SummoningMasterCombatSource | null): boolean {
  const actual = currentSummoningMasterCombatSource(s);
  return !r.finished && actual !== null && supplied !== null && same(supplied, r.source) && r.liveState === liveState(s) &&
    Object.entries(r.source).every(([key, value]) => dynamicSource.has(key) || same(actual[key as keyof SummoningMasterCombatSource], value));
}
export function beginSummoningMasterCombatRound(s: SliceState, stance: SliceStance, _random: ActionRandomStream): SummoningMasterRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('召唤大师姿态无效。');
  const source = currentSummoningMasterCombatSource(s), e = s.summoningMaster.encounter;
  if (!source || e.gateOpen || source.partner.status === 'ALIVE' && source.partner.location !== 'HOME') throw new Error('缺少原埃德温连续来源，或上轮活来客尚未普通返回原家。');
  return { source, stance, finished: false, liveState: liveState(s), summonAttempted: false, summoned: false, guestDisturbed: false, guardReady: false, guardSpent: false,
    playerActions: [], enemyActions: [], outcome: null, label: `同一46岁原埃德温在净空石院2米外，S${e.enemySpirituality}/120；原流灯${source.partner.location}、H${source.partner.health}/M${source.partner.mind}/精力${source.partner.stamina}，政策${e.guestPolicy}。只使用双方共同轮盘。` };
}
export const createSummoningMasterCombatRound = beginSummoningMasterCombatRound;
function actionBase(order: number, physical: number): ActionEvidence { return { ...none(''), order, paidCost: 0, physicalFactor: physical, rolls: [] }; }
function check(s: SliceState, a: ActionEvidence, ability: 'knowledge' | 'perception', difficulty: number, random: ActionRandomStream): boolean {
  const chance = computeCheckChance({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [] }), roll = random.nextInt(1, 100);
  a.rolls.push(roll); return roll <= chance;
}
export function resolveSummoningMasterCombatAbility(s: SliceState, id: SummoningMasterMoveId, physical: number, random: ActionRandomStream,
  r: SummoningMasterRoundContext, source: SummoningMasterCombatSource | null = r.source): SummoningMasterCombatEffect {
  if (!validRound(s, r, source) || ![...ABILITIES.map(a => a.id), 'STRIKE', 'EVADE', 'OBSERVE'].includes(id)) return none('缺少当前原身体、原来客或原资源来源，0贡献0消耗，不重抽。');
  const e = s.summoningMaster.encounter, p = getSummoningMasterPartner(s);
  const a: SummoningMasterPlayerAction = { ...actionBase(r.playerActions.length + r.enemyActions.length, bounded(physical, 1)), id, paperId: null, guestStaminaSpent: 0, summoned: false, cooperated: false };
  const pay = (cost: number) => { s.spirituality -= cost; a.paidCost = cost; };
  const strike = (why = '') => { a.selfGain = (source!.clubHeld ? 16 : 12) * a.physicalFactor; a.threatens = a.selfGain > 0;
    a.label = `${why}本人以${source!.clubHeld ? '实际在手的原棍16' : '自己的原身体12'}×身体普通打击（G），0灵性0来客消耗，只占原槽。`; };
  const evade = (why = '') => { a.enemyReduction = 10; a.label = `${why}本人普通避让减势10G，0灵性0原纸0来客消耗，不重抽或免伤。`; };
  if (id === 'STRIKE') strike();
  else if (id === 'EVADE') evade();
  else if (id === 'OBSERVE') a.label = '本人观察原人、原身体和普通出口，0贡献0消耗，不召唤、治疗或复制。';
  else if (id === 'ACCIDENT') { a.selfGain = -22.5; a.label = '判断失衡固定−22.5G，不重抽或增加来客行动。'; }
  else if (id === PAPER) {
    const paper = preparedWitchKingPaper(s);
    if (s.spirituality < 3 || !paper || paper.id !== r.source.preparedPaperId || paper.source !== WITCH_KING_PAPER_SOURCE) evade('没有战前同一PREPARED原纸或不足3S；');
    else { consumeWitchKingPaper(s, paper, 'COMBAT', r.source.round); pay(3); a.paperId = paper.id; a.enemyReduction = 35;
      a.label = `同一预备原纸${paper.id}与3灵性实际消耗，有限纸影减势35G后结束；HELD纸不自动准备，不生成新纸或复活原身体。`; }
  } else if (id === SUMMON) {
    if (r.summonAttempted) evade('本轮已实际尝试过开门，不能重骰或重开；');
    else if (!hasSummoningMasterGuestPermit(s) || p.status !== 'ALIVE' || p.health <= 0 || !p.willing || p.metWeek === null || p.location !== 'HOME' || p.stamina < 6 || p.mind < 30 || s.spirituality < 6)
      evade('缺少本场自愿许可、原来客不在HOME/不愿或资源不足，未施展召唤；');
    else { r.summonAttempted = true; pay(6);
      if (!check(s, a, 'knowledge', 18, random)) a.label = '有限召唤知识18实际失败，已付6S不退；原流灯仍HOME，未耗过门精力，没有新身体或重抽。';
      else { p.stamina -= 6; p.gateCrossings++; moveSummoningMasterPartner(s, 'YARD'); e.gateOpen = true; r.summoned = true; a.summoned = true; a.guestStaminaSpent = 6;
        a.label = '有限召唤知识18成功，实付6S；原HOME到YARD的有限门建立，同一流灯实付6精力亲自过门，原声片随同体。只有这一身体，没有第二轮盘；本槽0优势，合作还须另抽原玩家槽并付实际资源。'; }
    }
  } else if (id === COOPERATE) {
    if (!r.summoned || !hasSummoningMasterGuestPermit(s) || p.status !== 'ALIVE' || p.health <= 0 || !p.willing || p.location !== 'YARD' || p.mind < 30 || p.stamina < 8 || s.spirituality < 3)
      strike('本轮原来客未实际到YARD、不愿或资源不足，未形成合作；');
    else { pay(3); p.stamina -= 8; a.guestStaminaSpent = 8;
      if (!check(s, a, 'knowledge', 16, random)) a.label = '原来客有限合作知识16失败，实际3S与8原精力照耗，0优势0减势，无补抽、伤害免疫或新来客。';
      else { a.cooperated = true; a.selfGain = 32; a.enemyReduction = 16; a.threatens = true; if (!r.guardSpent) r.guardReady = true;
        a.label = '原流灯自愿以同一有限实体配合本人的近身动作，知识16成功，实付3S与8原精力，贡献32、减势16G。本轮后续最多一次实际承接原棍另付H5/精力4；共同伤势盘不减免，无额外行动者。'; }
    }
  } else if (id === ARROW) {
    if (s.spirituality < 4) strike('不足4S，血月之箭未施放；');
    else { pay(4); if (check(s, a, 'perception', 16, random)) { a.selfGain = 45 * (.65 + .35 * r.source.arrowMastery / 500); a.threatens = true;
        a.label = '继承血月之箭实际4S/感知16成功，对2米可见原敌取得45×旧掌握G优势；伤势仍由共同盘结算。'; }
      else a.label = '继承血月之箭感知16失败，实际4S已付不退，0贡献，不附赠普通打击或重抽。'; }
  } else if (s.spirituality < 2) evade('不足2S，继承深渊枷锁未施放；');
  else { pay(2); if (check(s, a, 'perception', 16, random)) { a.enemyReduction = 18; a.label = '继承深渊枷锁实付2S/感知16成功，有限减势18G；原埃德温仍能抵抗，不删敌行动或完全定身。'; }
    else a.label = '继承深渊枷锁感知16失败，实际2S照耗，0贡献0减势，不退款或重抽。'; }
  r.playerActions.push(a); r.liveState = liveState(s); return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export function resolveSummoningMasterEnemyAbility(s: SliceState, planned: SummoningMasterEnemyIntent, physical: number, _random: ActionRandomStream,
  r: SummoningMasterRoundContext, source: SummoningMasterCombatSource | null = r.source): SummoningMasterCombatEffect {
  if (!validRound(s, r, source) || ![...SUMMONING_MASTER_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned)) return none('缺少当前原埃德温及原棍来源，0贡献0消耗，不重抽。');
  const e = s.summoningMaster.encounter, p = getSummoningMasterPartner(s), power = SUMMONING_MASTER_POWERS.find(x => x.id === planned);
  const a: SummoningMasterEnemyAction = { ...actionBase(r.playerActions.length + r.enemyActions.length, bounded(physical, 1)), planned,
    actual: power && e.enemySpirituality < power.cost ? 'BODY_STRIKE' : planned, gateDestroyed: false, guestMindDamage: 0, guestHealthDamage: 0, guestStaminaSpent: 0 };
  if (power && a.actual === planned) { e.enemySpirituality -= power.cost; e.powerUses[power.id]++; a.paidCost = power.cost; a.selfGain = power.selfGain; a.enemyReduction = power.enemyReduction; }
  if (a.actual === 'ACCIDENT') { a.selfGain = -22.5; a.label = '原埃德温判断失衡，本槽固定−22.5G，不另抽。'; }
  else if (a.actual === 'BODY_STRIKE') {
    a.selfGain = 20 * a.physicalFactor; a.threatens = a.selfGain > 0;
    if (a.threatens && r.guardReady && !r.guardSpent && p.status === 'ALIVE' && p.location === 'YARD' && p.willing && p.stamina >= 4) {
      r.guardReady = false; r.guardSpent = true; a.guestHealthDamage = Math.min(5, p.health); p.health -= a.guestHealthDamage; a.guestStaminaSpent = 4; p.stamina -= 4;
      if (p.health === 0) { p.status = 'DEAD'; p.willing = false; }
    }
    a.label = `${power ? '原法术灵性不足，同一槽回退；' : ''}原埃德温持自己的唯一SM3-EDWIN-CLUB普通打击20×身体G，0S。${a.guestStaminaSpent ? `原流灯在实际合作窗口承接一次，原健康−${a.guestHealthDamage}、原精力−4${p.status === 'DEAD' ? '，同体真实死亡留YARD，原声片仍归其遗物' : ''}；共同伤势盘仍照常结算` : '原来客没有实际承接，不凭空扣其资源'}。`;
  } else if (a.actual === 'DISRUPT') {
    a.gateDestroyed = e.gateOpen; e.gateOpen = false;
    if (r.summoned && !r.guestDisturbed && p.status === 'ALIVE' && p.location === 'YARD') { a.guestMindDamage = Math.min(8, p.mind); p.mind -= a.guestMindDamage; r.guestDisturbed = true; }
    a.label = `原埃德温实付4S干扰门媒介；${a.gateDestroyed ? '本轮原门实际断连' : '当前没有开着的门可毁'}。${a.guestMindDamage ? '已到YARD的同一流灯实际惊扰精神−8，仅本轮一次' : '没有再次惊扰或删去身体'}；原来客仍在实际位置，能沿原普通小径返家，0直接贡献。`;
  } else { a.threatens = a.actual === 'DARK_BOLT'; a.label = `原埃德温${power!.label}实付${a.paidCost}S，${a.threatens ? '有限优势75' : '有限减势45'}G，余${e.enemySpirituality}/120；同一原人不补资源，伤势由共同盘决定。`; }
  r.enemyActions.push(a); r.liveState = liveState(s); return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export interface SummoningMasterRoundOutcome {
  targetId: typeof SUMMONING_MASTER_TARGET_ID; round: number; source: SummoningMasterCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number;
  powerUses: Record<SummoningMasterPowerId, number>; partnerAfter: SummoningMasterPartner; papersConsumed: string[];
  gateOpenAfter: false; ordinaryReturnMetres: number; elapsedSeconds: 60; playerActions: SummoningMasterPlayerAction[]; enemyActions: SummoningMasterEnemyAction[];
}
export function finishSummoningMasterCombatRound(s: SliceState, r: SummoningMasterRoundContext, continuing = true): SummoningMasterRoundOutcome {
  const e = s.summoningMaster.encounter, c = s.combat;
  if (r.finished || !c || c.encounterId !== 'SUMMONING_MASTER_DISPUTE' || c.round !== r.source.round || r.liveState !== liveState(s)) throw new Error('原召唤回合已结束，或同一来客/原资源已被改写。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  if (e.enemyStatus !== 'RESISTING') e.weaponLocation = 'YARD';
  e.gateOpen = false;
  const ordinaryReturnMetres = returnSummoningMasterGuestOrdinarily(s);
  s.summoningMaster.life.clockSeconds += 60 - ordinaryReturnMetres;
  r.guardReady = false; r.finished = true;
  r.outcome = { targetId: SUMMONING_MASTER_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus,
    playerSpiritualityBefore: r.source.playerSpirituality, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind, enemySpiritualityBefore: r.source.enemySpirituality,
    powerUses: { ...e.powerUses }, partnerAfter: structuredClone(getSummoningMasterPartner(s)), papersConsumed: r.playerActions.flatMap(a => a.paperId ? [a.paperId] : []),
    gateOpenAfter: false, ordinaryReturnMetres, elapsedSeconds: 60, playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
  return structuredClone(r.outcome);
}
export function summoningMasterRoundOutcome(r: SummoningMasterRoundContext): SummoningMasterRoundOutcome {
  if (!r.outcome) throw new Error('先实际结束当前原召唤回合。'); return structuredClone(r.outcome);
}
export function projectSummoningMasterCombat(s: SliceState) {
  const e = s.summoningMaster.encounter;
  return { enemyName: '埃德温（46岁，原创有限G3非凡者）', targetId: e.targetId, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality,
    powerUses: { ...e.powerUses }, guestPolicy: e.guestPolicy, guestPermit: e.guestPermit && { ...e.guestPermit }, partner: structuredClone(getSummoningMasterPartner(s)),
    gateOpen: e.gateOpen, originalExit: true, pursuit: false, distanceMetres: 2, source: currentSummoningMasterCombatSource(s),
    summary: '双方1–6次权重10/15/25/25/15/10；继承实际月亮4核心35/25/25/15、1250/底125、S120，仅继续轮恢复12G。只有同一生活来客，6S/知识18召唤与过门6精力，3S＋8精力/知识16合作。门断原身体留场，活来客轮末普通30米回家，死亡留场。旧原纸真实消费，无复制、补灵或额外行动盘。' };
}
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
function validPartner(p: SummoningMasterPartner): boolean {
  return !!p && p.id === 'SM3-LUMEN' && p.name === '流灯' && p.source === SUMMONING_MASTER_PARTNER_SOURCE && p.adult === true && p.independentMind === true &&
    p.bodyId === 'SM3-LUMEN-BODY' && p.homeId === 'SM3-GLASS-ROOM' && ['HOME', 'YARD', 'PATH'].includes(p.location) &&
    [p.health, p.mind, p.stamina].every(n => integer(n, 0, 100)) && ['ALIVE', 'DEAD'].includes(p.status) && (p.status === 'DEAD') === (p.health === 0) &&
    typeof p.willing === 'boolean' && (p.metWeek === null || integer(p.metWeek, 1)) && integer(p.ordinaryDistanceM) && integer(p.gateCrossings) &&
    p.chime?.id === 'SM3-CHIME' && p.chime.owner === 'SM3-LUMEN' && Array.isArray(p.restHistory);
}
/** Only checks original resources, action costs and body continuity. Shared combat owns player/enemy wounds. */
export function validateSummoningMasterRoundOutcome(value: unknown): value is SummoningMasterRoundOutcome {
  try {
    const o = value as SummoningMasterRoundOutcome, x = o?.source;
    if (!o || !x || typeof x.runId !== 'string' || !integer(x.revision) || !integer(x.week, 1) || !integer(x.round, 1) || !integer(x.startHistoryIndex) || x.attemptWeek !== x.week ||
        x.encounterId !== 'SUMMONING_MASTER_DISPUTE' || x.targetId !== SUMMONING_MASTER_TARGET_ID || x.targetAge !== 46 || x.targetSequence !== 3 || x.actualOriginalBody !== true || x.independentMind !== true ||
        x.enemyWeapon !== 'SM3-EDWIN-CLUB' || x.weaponLocation !== 'HAND' || x.distanceMetres !== 2 || x.space !== 'SM3-OPEN-STONE-COURT' || x.ordinaryExit !== true || x.pursuit !== false ||
        ![x.playerHealth, x.playerMind, x.enemyHealth, x.enemyMind].every(n => integer(n, 1, 100)) || !integer(x.knowledge, 0, 500) || !integer(x.perception, 0, 500) || !integer(x.arrowMastery, 0, 500) ||
        typeof x.clubHeld !== 'boolean' || !validPartner(x.partner) || !validPartner(o.partnerAfter) || o.targetId !== SUMMONING_MASTER_TARGET_ID || o.round !== x.round ||
        !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) || typeof o.continuing !== 'boolean' || o.elapsedSeconds !== 60 || o.gateOpenAfter !== false ||
        ![o.enemyHealth, o.playerHealthAfter].every(n => integer(n, 0, 100)) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(o.enemyStatus) || (o.enemyStatus === 'DEAD') !== (o.enemyHealth === 0) ||
        o.enemyMind !== x.enemyMind || o.playerMindAfter !== x.playerMind || ![x.playerSpirituality, x.enemySpirituality, o.playerSpiritualityAfter, o.enemySpirituality].every(n => integer(n, 0, 120)) ||
        o.playerSpiritualityBefore !== x.playerSpirituality || o.enemySpiritualityBefore !== x.enemySpirituality || !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) ||
        o.playerActions.length > 6 || o.enemyActions.length > 6 || !Array.isArray(o.papersConsumed) || new Set(o.papersConsumed).size !== o.papersConsumed.length) return false;
    const permit = x.guestPermit;
    if (x.guestPolicy === 'HOME' ? permit !== null : x.guestPolicy !== 'ASK_HELP' || !permit || permit.partnerId !== 'SM3-LUMEN' || permit.paidPence !== 20 || permit.approachWeek !== permit.paidWeek || permit.paidWeek > x.week || permit.negotiationTravelMetres !== 60 || permit.negotiationSeconds !== 60) return false;
    const p = structuredClone(x.partner), powers = { ...x.powerUses }; let playerS = x.playerSpirituality, enemyS = x.enemySpirituality;
    let gate = false, summoned = false, attempted = false, disturbed = false, guard = false, guarded = false;
    const spentPapers: string[] = [];
    const actions = [...o.playerActions.map(a => ({ actor: 'PLAYER' as const, a })), ...o.enemyActions.map(a => ({ actor: 'ENEMY' as const, a }))].sort((a, b) => a.a.order - b.a.order);
    for (const [i, entry] of actions.entries()) {
      const a = entry.a;
      if (a.order !== i || !integer(a.paidCost) || !Number.isFinite(a.selfGain) || !Number.isFinite(a.enemyReduction) || a.enemyReduction < 0 ||
          !Number.isFinite(a.physicalFactor) || a.physicalFactor < 0 || a.physicalFactor > 1 || typeof a.label !== 'string' || typeof a.threatens !== 'boolean' || a.mentalPressure !== false ||
          !Array.isArray(a.rolls) || a.rolls.some(n => !integer(n, 1, 100))) return false;
      if (entry.actor === 'PLAYER') {
        const b = entry.a;
        if (![...ABILITIES.map(v => v.id), 'STRIKE', 'EVADE', 'OBSERVE'].includes(b.id) || !integer(b.guestStaminaSpent, 0, 8) || typeof b.summoned !== 'boolean' || typeof b.cooperated !== 'boolean') return false;
        const expectedCost = b.id === SUMMON ? 6 : b.id === COOPERATE || b.id === PAPER ? 3 : b.id === ARROW ? 4 : b.id === SHACKLES ? 2 : 0;
        if (b.paidCost !== 0 && b.paidCost !== expectedCost || b.paidCost > playerS) return false;
        playerS -= b.paidCost;
        const needsCheck = b.paidCost > 0 && b.id !== PAPER;
        if (b.rolls.length !== (needsCheck ? 1 : 0)) return false;
        const success = needsCheck && b.rolls[0]! <= computeCheckChance({ ability: b.id === ARROW || b.id === SHACKLES ? 'perception' : 'knowledge',
          baseAbility: b.id === ARROW || b.id === SHACKLES ? x.perception : x.knowledge, difficulty: b.id === SUMMON ? 18 : 16, modifiers: [] });
        if (b.id === SUMMON && b.paidCost) {
          if (attempted || !permit || !p.willing || p.status !== 'ALIVE' || p.location !== 'HOME' || p.stamina < 6 || p.mind < 30 || p.metWeek === null) return false;
          attempted = true; if (success) { summoned = true; gate = true; p.location = 'YARD'; p.gateCrossings++; }
        }
        if (b.summoned !== (b.id === SUMMON && success) || b.cooperated !== (b.id === COOPERATE && success)) return false;
        if (b.id === COOPERATE && b.paidCost) {
          if (!summoned || !permit || !p.willing || p.status !== 'ALIVE' || p.location !== 'YARD' || p.stamina < 8 || p.mind < 30) return false;
          if (success && !guarded) guard = true;
        }
        if (b.guestStaminaSpent !== (b.summoned ? 6 : b.id === COOPERATE && b.paidCost ? 8 : 0)) return false;
        p.stamina -= b.guestStaminaSpent;
        if (b.id === PAPER && b.paidCost) { if (b.paperId !== x.preparedPaperId || !b.paperId || spentPapers.includes(b.paperId)) return false; spentPapers.push(b.paperId); }
        else if (b.paperId !== null) return false;
        let gain = 0, reduction = 0;
        if (b.id === 'ACCIDENT') gain = -22.5;
        else if (b.id === 'STRIKE' || (b.id === ARROW || b.id === COOPERATE) && !b.paidCost) gain = (x.clubHeld ? 16 : 12) * b.physicalFactor;
        else if (b.id === 'EVADE' || (b.id === SUMMON || b.id === PAPER || b.id === SHACKLES) && !b.paidCost) reduction = 10;
        else if (b.id === ARROW && success) gain = 45 * (.65 + .35 * x.arrowMastery / 500);
        else if (b.id === PAPER && b.paidCost) reduction = 35;
        else if (b.id === SHACKLES && success) reduction = 18;
        else if (b.id === COOPERATE && success) { gain = 32; reduction = 16; }
        if (b.selfGain !== gain || b.enemyReduction !== reduction || b.threatens !== (gain > 0)) return false;
      } else {
        const b = entry.a, power = SUMMONING_MASTER_POWERS.find(v => v.id === b.planned);
        if (![...SUMMONING_MASTER_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(b.planned)) return false;
        const actual = power && enemyS < power.cost ? 'BODY_STRIKE' : b.planned, cost = power && actual === b.planned ? power.cost : 0;
        if (b.actual !== actual || b.paidCost !== cost) return false;
        enemyS -= cost; if (power && cost) powers[power.id]++;
        const hit = actual === 'BODY_STRIKE' && b.physicalFactor > 0 && guard && !guarded && p.status === 'ALIVE' && p.location === 'YARD' && p.willing && p.stamina >= 4;
        const hurt = hit ? Math.min(5, p.health) : 0, shock = actual === 'DISRUPT' && summoned && !disturbed && p.status === 'ALIVE' && p.location === 'YARD' ? Math.min(8, p.mind) : 0;
        if (b.guestHealthDamage !== hurt || b.guestStaminaSpent !== (hit ? 4 : 0) || b.guestMindDamage !== shock || b.gateDestroyed !== (actual === 'DISRUPT' && gate)) return false;
        if (hit) { p.health -= hurt; p.stamina -= 4; guard = false; guarded = true; if (!p.health) { p.status = 'DEAD'; p.willing = false; } }
        if (actual === 'DISRUPT') { gate = false; if (shock) { p.mind -= shock; disturbed = true; } }
        const gain = actual === 'ACCIDENT' ? -22.5 : actual === 'BODY_STRIKE' ? 20 * b.physicalFactor : actual === 'DARK_BOLT' ? 75 : 0;
        if (b.selfGain !== gain || b.enemyReduction !== (actual === 'WARD' ? 45 : 0) || b.threatens !== (gain > 0)) return false;
      }
    }
    const returned = p.status === 'ALIVE' && p.location !== 'HOME' ? 30 : 0;
    if (returned) { p.location = 'HOME'; p.ordinaryDistanceM += returned; }
    return o.ordinaryReturnMetres === returned && same(p, o.partnerAfter) && same(spentPapers, o.papersConsumed) &&
      playerS === o.playerSpiritualityAfter && enemyS === o.enemySpirituality && same(powers, o.powerUses) &&
      SUMMONING_MASTER_POWER_IDS.every(id => integer(x.powerUses[id])) && x.enemySpirituality === 120 - SUMMONING_MASTER_POWERS.reduce((n, q) => n + x.powerUses[q.id] * q.cost, 0);
  } catch { return false; }
}
