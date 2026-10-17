import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import { createAlchemistLifeState, type AlchemistCreation } from '../alchemist/life.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { findArcaneScholarOriginalCreation } from './life.js';
import { ARCANE_SCHOLAR_TARGET_ID, ARCANE_SCHOLAR_POWER_IDS, ARCANE_SCHOLAR_POWERS, hasArcaneScholarDisputeOpponent,
  type ArcaneScholarEnemyIntent, type ArcaneScholarPowerId } from './encounter.js';

/** Explicit finite G3 extension; retains actual Paragon4 core30/30/25/15,
 * 1250/floor125, maxS120, CONTINUE-only12 and the original1–6 count budgets. */
export const ARCANE_SCHOLAR_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const ARCANE_SCHOLAR_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const arcaneScholarActionCount = pyromaniacActionCount;
export const arcaneScholarEnemyActionCount = pyromaniacActionCount;
export type ArcaneScholarMoveId = 'paragon.s3.bounded-analysis' | 'paragon.s3.construct-coordination' | 'paragon.s4.animate-made-object'
  | 'paragon.s4.direct-creation' | 'paragon.s5.precision-focus' | 'STRIKE' | 'EVADE' | 'OBSERVE' | 'ACCIDENT';
const ANALYSIS = 'paragon.s3.bounded-analysis', COORDINATION = 'paragon.s3.construct-coordination';
const ANIMATE = 'paragon.s4.animate-made-object', DIRECT = 'paragon.s4.direct-creation', FOCUS = 'paragon.s5.precision-focus';
const ABILITIES: readonly { id: ArcaneScholarMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: COORDINATION, label: '双原件有限协同（5S+各1储能/知识18，成功40/减20G）', weight: 20, stance: 'ATTACK' },
  { id: ANALYSIS, label: '有限结构解析（4S/知识18，下一次普通打击窗口G）', weight: 15, stance: 'CONTROL' },
  { id: ANIMATE, label: '继承原护架赋灵（4S+1储能/知识16，40×原掌握G）', weight: 15, stance: 'ATTACK' },
  { id: DIRECT, label: '继承指挥原护架（2S+1储能/减26G，须原架实际赋灵）', weight: 15, stance: 'DEFEND' },
  { id: FOCUS, label: '继承短时专注（2S/12×原掌握G）', weight: 10, stance: 'CONTROL' },
  { id: 'STRIKE', label: '本人普通原身体/实际在手原棍（12/16×身体G）', weight: 10, stance: 'ATTACK' },
  { id: 'EVADE', label: '本人普通避让（减10G，不免伤）', weight: 5, stance: 'DEFEND' },
  { id: 'OBSERVE', label: '观察眼前原人原物（0消耗/0贡献）', weight: 5, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（固定−22.5G）', weight: 5, stance: null },
];
export const ARCANE_SCHOLAR_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '有限弧光术：5S/贡献75G', weight: 30 },
  { id: 'WARD', label: '有限护术：4S/减势45G', weight: 20 },
  { id: 'JAM', label: '有限干扰：4S/本轮下一次协同抵抗30%→70%G', weight: 20 },
  { id: 'BODY_STRIKE', label: '自己的唯一原棍：20×身体G', weight: 20 },
  { id: 'OBSERVE', label: '普通观察原人原出口：0贡献', weight: 5 },
  { id: 'ACCIDENT', label: '判断偏差：−22.5G', weight: 5 },
];
export const isArcaneScholar = (s: SliceState) => s.progression.pathwayId === 'paragon' && s.progression.sequence === 3;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function arcaneScholarAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 }));
}
export function drawArcaneScholarAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): ArcaneScholarMoveId {
  const weights = tickets(stance); let n = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return a.id; } throw new Error('奥秘学者能力盘无效。');
}
export function drawArcaneScholarEnemyAbility(random: ActionRandomStream): ArcaneScholarEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of ARCANE_SCHOLAR_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as ArcaneScholarEnemyIntent; } throw new Error('原科尔温能力盘无效。');
}
export interface ArcaneScholarCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'ARCANE_SCHOLAR_DISPUTE'; targetId: typeof ARCANE_SCHOLAR_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetAge: 47; targetSequence: 3; actualOriginalBody: true; independentMind: true;
  enemyWeapon: 'AR3-CORWIN-CLUB'; weaponLocation: 'HAND'; distanceMetres: 2; space: 'AR3-OPEN-WORKSHOP-YARD'; ordinaryExit: true; pursuit: false; noBystanders: true;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  clubHeld: boolean; knowledge: number; mastery: Record<string, number>; powerUses: Record<ArcaneScholarPowerId, number>;
  carriedIds: ('AL4-BOX-1' | 'AL4-FRAME-1')[]; creations: AlchemistCreation[];
}
const bounded = (n: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));
export function currentArcaneScholarCombatSource(s: SliceState): ArcaneScholarCombatSource | null {
  if (!hasArcaneScholarDisputeOpponent(s)) return null;
  const e = s.arcaneScholar.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'ARCANE_SCHOLAR_DISPUTE', targetId: ARCANE_SCHOLAR_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetAge: 47, targetSequence: 3, actualOriginalBody: true, independentMind: true,
    enemyWeapon: 'AR3-CORWIN-CLUB', weaponLocation: 'HAND', distanceMetres: 2, space: 'AR3-OPEN-WORKSHOP-YARD', ordinaryExit: true, pursuit: false, noBystanders: true,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality,
    clubHeld: s.town.clubLocation === 'HAND', knowledge: s.character.coreStats.knowledge,
    mastery: Object.fromEntries(ABILITIES.filter(a => a.id.startsWith('paragon.')).map(a => [a.id, bounded(s.progression.mastery[a.id] ?? 0, 500)])),
    powerUses: { ...e.powerUses }, carriedIds: [...e.carriedIds], creations: e.carriedIds.map(id => structuredClone(findArcaneScholarOriginalCreation(s, id)!)) };
}
export interface ArcaneScholarCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean }
interface ActionEvidence extends ArcaneScholarCombatEffect { order: number; paidCost: number; physicalFactor: number; rolls: number[] }
export interface ArcaneScholarPlayerAction extends ActionEvidence {
  id: ArcaneScholarMoveId; boxChargeSpent: number; frameChargeSpent: number;
  coordinationResult: 'NONE' | 'FAILED' | 'RESISTED' | 'SUCCEEDED'; analysisOpened: boolean; analysisUsed: boolean;
}
export interface ArcaneScholarEnemyAction extends ActionEvidence { planned: ArcaneScholarEnemyIntent; actual: ArcaneScholarEnemyIntent; frameDurabilityDamage: number }
interface RoundModel {
  playerSpirituality: number; enemySpirituality: number; powerUses: Record<ArcaneScholarPowerId, number>;
  creations: AlchemistCreation[]; analysisWindow: boolean; jammed: boolean; pendingGuards: number;
}
export interface ArcaneScholarRoundContext {
  source: ArcaneScholarCombatSource; stance: SliceStance; finished: boolean; liveState: string; model: RoundModel;
  playerSpiritualityBefore: number; enemySpiritualityBefore: number; playerActions: ArcaneScholarPlayerAction[]; enemyActions: ArcaneScholarEnemyAction[]; label: string;
}
const none = (label: string): ArcaneScholarCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
function initialModel(source: ArcaneScholarCombatSource): RoundModel {
  return { playerSpirituality: source.playerSpirituality, enemySpirituality: source.enemySpirituality, powerUses: { ...source.powerUses },
    creations: structuredClone(source.creations), analysisWindow: false, jammed: false, pendingGuards: 0 };
}
function liveState(s: SliceState): string { const e = s.arcaneScholar.encounter; return stableStringify({ playerSpirituality: s.spirituality,
  enemySpirituality: e.enemySpirituality, powerUses: e.powerUses, creations: e.carriedIds.map(id => findArcaneScholarOriginalCreation(s, id)) }); }
function commit(s: SliceState, r: ArcaneScholarRoundContext): void {
  const m = r.model, e = s.arcaneScholar.encounter;
  s.spirituality = m.playerSpirituality; e.enemySpirituality = m.enemySpirituality; e.powerUses = { ...m.powerUses };
  for (const x of m.creations) { const original = findArcaneScholarOriginalCreation(s, x.id); if (!original || original.location !== 'YARD') throw new Error('同一原造物已不在本场。');
    original.charge = x.charge; original.durability = x.durability; original.active = x.active; }
  r.liveState = liveState(s);
}
const dynamicSource = new Set(['playerSpirituality', 'enemySpirituality', 'powerUses', 'creations']);
function validRound(s: SliceState, r: ArcaneScholarRoundContext, supplied: ArcaneScholarCombatSource | null): boolean {
  const actual = currentArcaneScholarCombatSource(s);
  return !r.finished && actual !== null && supplied !== null && stableStringify(supplied) === stableStringify(r.source) && r.liveState === liveState(s) &&
    Object.entries(r.source).every(([key, value]) => dynamicSource.has(key) || stableStringify(actual[key as keyof ArcaneScholarCombatSource]) === stableStringify(value));
}
export function beginArcaneScholarCombatRound(s: SliceState, stance: SliceStance, _random: ActionRandomStream): ArcaneScholarRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('奥秘学者本轮姿态无效。');
  const source = currentArcaneScholarCombatSource(s); if (!source) throw new Error('缺少原科尔温、原棍和本场原物连续资源来源。');
  const r: ArcaneScholarRoundContext = { source, stance, finished: false, liveState: '', model: initialModel(source), playerSpiritualityBefore: s.spirituality,
    enemySpiritualityBefore: s.arcaneScholar.encounter.enemySpirituality, playerActions: [], enemyActions: [], label: '' };
  commit(s, r); r.label = `同一47岁原科尔温在独立工院2米外，独立灵性${r.enemySpiritualityBefore}/120。原盒原架仍用旧唯一资源，缺能普通回退；全新3扩展为G。`; return r;
}
export const createArcaneScholarCombatRound = beginArcaneScholarCombatRound;
function actionBase(order: number, physical: number): ActionEvidence { return { ...none(''), order, paidCost: 0, physicalFactor: physical, rolls: [] }; }
const originalMastery = (source: ArcaneScholarCombatSource, id: string) => 0.65 + 0.35 * (source.mastery[id] ?? 0) / 500;
function playerAction(source: ArcaneScholarCombatSource, m: RoundModel, id: ArcaneScholarMoveId, physical: number, order: number, roll: () => number): ArcaneScholarPlayerAction {
  const a: ArcaneScholarPlayerAction = { ...actionBase(order, physical), id, boxChargeSpent: 0, frameChargeSpent: 0, coordinationResult: 'NONE', analysisOpened: false, analysisUsed: false };
  const frame = m.creations.find(x => x.id === 'AL4-FRAME-1'), box = m.creations.find(x => x.id === 'AL4-BOX-1');
  const usable = (x: AlchemistCreation | undefined): x is AlchemistCreation => !!x && x.location === 'YARD' && x.charge > 0 && x.durability > 0;
  const pay = (n: number) => { if (m.playerSpirituality < n) return false; m.playerSpirituality -= n; a.paidCost = n; return true; };
  const block = (why = '') => { a.enemyReduction = 10; a.label = `${why}本人原身体普通避让减势10G，0灵性0储能，不重抽、不免伤。`; };
  const strike = (why = '') => { a.selfGain = (source.clubHeld ? 16 : 12) * physical;
    if (m.analysisWindow && physical > 0) { m.analysisWindow = false; a.analysisUsed = true; a.selfGain += 12 * physical; }
    a.threatens = a.selfGain > 0; a.label = `${why}本人${source.clubHeld ? '实际在手自有原棍16' : '原身体空手12'}×身体G普通打击${a.analysisUsed ? '，消费本轮一次真实弱处窗口，有限额外12×身体G' : ''}，无复制装备或额外行动。`; };
  const check = (difficulty: number) => { const n = roll(); a.rolls.push(n); return { roll: n, chance: computeCheckChance({ ability: 'knowledge', baseAbility: source.knowledge, difficulty, modifiers: [] }) }; };
  if (id === 'STRIKE') strike();
  else if (id === 'EVADE') block();
  else if (id === 'OBSERVE') a.label = '观察眼前原人、原件和普通出口，0灵性0贡献，不读取未知真相、制造或补充储能。';
  else if (id === 'ACCIDENT') { a.selfGain = -22.5; a.label = '本槽判断失衡，固定优势−22.5G，不重抽、不增加行动者。'; }
  else if (id === FOCUS) {
    if (!pay(2)) a.label = '继承短时专注不足2灵性，普通观察0贡献，不重抽。';
    else { a.selfGain = 12 * originalMastery(source, id); a.label = '继承短时专注实际2S、有限优势12×原掌握G，本槽后结束，不补原件储能。'; }
  } else if (id === ANALYSIS) {
    if (m.analysisWindow) a.label = '本轮已有一次未消费的真实弱处窗口，普通观察0消耗0贡献，不叠加或延长。';
    else if (!pay(4)) a.label = '原灵性不足4，有限解析未施展，普通观察0贡献，不自动知道结构。';
    else { const c = check(18);
      if (c.roll > c.chance) a.label = `有限结构解析知识${c.roll}>${c.chance}失败，已付4S不退，没有弱处窗口。`;
      else { m.analysisWindow = true; a.analysisOpened = true; a.label = `有限结构解析知识${c.roll}≤${c.chance}，实付4S；只对眼前原科尔温的本轮下一次普通身体打击开一次额外12×身体G弱处窗口，未打中不直接扣H，不读取隐藏真相。轮末失效。`; }
    }
  } else if (id === COORDINATION) {
    if (!usable(frame) || !usable(box) || m.playerSpirituality < 5) strike('原盒原架未同时在场可用、储能不足1或本人不足5S，未施展协同；');
    else {
      pay(5); frame.charge--; box.charge--; a.frameChargeSpent = 1; a.boxChargeSpent = 1; frame.active = false; box.active = false;
      const c = check(18);
      if (c.roll > c.chance) { a.coordinationResult = 'FAILED'; a.label = `两原件有限协同知识${c.roll}>${c.chance}失配，实付5S及原盒原架各1储能不退；两件实际停止，0贡献0减势，无新架或重抽。`; }
      else { const resistance = m.jammed ? 70 : 30, n = roll(), jammed = m.jammed; a.rolls.push(n); m.jammed = false;
        if (n <= resistance) { a.coordinationResult = 'RESISTED'; a.label = `协同知识${c.roll}≤${c.chance}，但原科尔温${jammed ? '实付4S的一次干扰' : '普通抵抗'}${n}≤${resistance}G，中止本次两件动作；已付5S和各1储能不退，0贡献0减势。`; }
        else { a.coordinationResult = 'SUCCEEDED'; a.selfGain = 40; a.enemyReduction = 20; a.threatens = true;
          a.label = `协同知识${c.roll}≤${c.chance}、对方抵抗${n}>${resistance}G，实付5S与两原件各1储能；同一原盒沿眼前地面短推、原架同时支撑开口，30秒/6米内有限贡献40、减势20G后停止。没有第二轮盘、额外身体或永久生命。`; }
      }
    }
  } else if (!usable(frame)) id === DIRECT ? block('缺少实际在场且有储能、未损坏的同一原护架；') : strike('缺少实际在场且有储能、未损坏的同一原护架；');
  else if (id === DIRECT) {
    if (!frame.active || !pay(2)) block('同一原架未实际赋灵或本人不足2S；');
    else { frame.charge--; a.frameChargeSpent = 1; m.pendingGuards++; if (frame.charge === 0) frame.active = false;
      a.enemyReduction = 26; a.label = `继承指挥同一原护架：实际2S和1原储能，有限减势26G；原架一米内调整防守，只有本轮后续实际承接原棍才耐久−5，未承接不扣耐久、不免伤。储能余${frame.charge}。`; }
  } else if (!pay(4)) strike('本人不足4S，未对原架赋灵；');
  else { frame.charge--; a.frameChargeSpent = 1; const c = check(16);
    if (c.roll > c.chance) { if (frame.charge === 0) frame.active = false; a.label = `继承原架赋灵知识${c.roll}>${c.chance}失败，4S和1原储能已付不退，本槽0贡献。`; }
    else { frame.active = frame.charge > 0; a.selfGain = 40 * originalMastery(source, id); a.threatens = true;
      a.label = `继承原架赋灵知识${c.roll}≤${c.chance}，实际4S和1原储能，原架沿眼前2米地面一次有限推挡，优势40×原掌握G；储能余${frame.charge}，不补能或增添次数。`; }
  }
  return a;
}
function enemyAction(m: RoundModel, planned: ArcaneScholarEnemyIntent, physical: number, order: number): ArcaneScholarEnemyAction {
  const a: ArcaneScholarEnemyAction = { ...actionBase(order, physical), planned, actual: planned, frameDurabilityDamage: 0 }, power = ARCANE_SCHOLAR_POWERS.find(p => p.id === planned);
  if (planned === 'JAM' && m.jammed) a.label = '原科尔温本轮已有一次未消费干扰，普通观察0贡献0消耗，不叠加或延长。';
  else if (power && m.enemySpirituality >= power.cost) {
    m.enemySpirituality -= power.cost; m.powerUses[power.id]++; a.paidCost = power.cost; a.selfGain = power.selfGain; a.enemyReduction = power.enemyReduction; a.threatens = power.selfGain > 0;
    if (planned === 'JAM') m.jammed = true;
    a.label = `同一原科尔温${power.label}：独立原灵性实际−${power.cost}、余${m.enemySpirituality}/120；${planned === 'JAM' ? '本轮下一次成功施展协同的抵抗30%提高70%G，消费后或轮末失效' : `贡献${a.selfGain}/减势${a.enemyReduction}G`}，不借本人原资源。`;
  } else if (planned === 'OBSERVE') a.label = '原科尔温普通观察原身体、原物和出口，0贡献0消耗，没有免费干扰。';
  else if (planned === 'ACCIDENT') { a.selfGain = -22.5; a.label = '原科尔温本槽判断偏差，贡献−22.5G，不重抽。'; }
  else { a.actual = 'BODY_STRIKE'; a.selfGain = 20 * physical; a.threatens = a.selfGain > 0; a.label = `${power ? '独立灵性不足，未施法、不重抽；' : ''}原科尔温以自己的唯一原棍AR3-CORWIN-CLUB普通打击20×身体G。`;
    const frame = m.creations.find(x => x.id === 'AL4-FRAME-1');
    if (a.threatens && m.pendingGuards > 0 && frame && frame.durability > 0) {
      m.pendingGuards--; a.frameDurabilityDamage = Math.min(5, frame.durability); frame.durability -= a.frameDurabilityDamage; if (frame.durability === 0) frame.active = false;
      a.label += `已付指挥的同一原护架实际承接本次原棍，耐久−${a.frameDurabilityDamage}至${frame.durability}；已计减势不重复叠加，不取消伤势盘。`;
    }
  }
  return a;
}
const allowed = (id: string): id is ArcaneScholarMoveId => ABILITIES.some(a => a.id === id);
const enemyAllowed = (id: string): id is ArcaneScholarEnemyIntent => ARCANE_SCHOLAR_ENEMY_ABILITY_WHEEL.some(a => a.id === id);
export function resolveArcaneScholarCombatAbility(s: SliceState, id: ArcaneScholarMoveId, physical: number, random: ActionRandomStream,
  r: ArcaneScholarRoundContext, source: ArcaneScholarCombatSource | null = r.source): ArcaneScholarCombatEffect {
  if (!allowed(id) || r.playerActions.length >= 6 || !validRound(s, r, source)) return none('本轮原身体、科尔温或同一原物资源来源不符：0贡献0消耗，不重抽。');
  const a = playerAction(r.source, r.model, id, bounded(physical, 1), r.playerActions.length + r.enemyActions.length, () => random.nextInt(1, 100));
  r.playerActions.push(a); commit(s, r); return a;
}
export function resolveArcaneScholarEnemyAbility(s: SliceState, planned: ArcaneScholarEnemyIntent, physical: number, _random: ActionRandomStream,
  r: ArcaneScholarRoundContext, source: ArcaneScholarCombatSource | null = r.source): ArcaneScholarCombatEffect {
  if (!enemyAllowed(planned) || r.enemyActions.length >= 6 || !validRound(s, r, source)) return none('本轮原科尔温独立身体/资源来源不符：0贡献0消耗，不重抽。');
  const a = enemyAction(r.model, planned, bounded(physical, 1), r.playerActions.length + r.enemyActions.length); r.enemyActions.push(a); commit(s, r); return a;
}
export interface ArcaneScholarRoundOutcome {
  targetId: typeof ARCANE_SCHOLAR_TARGET_ID; round: number; source: ArcaneScholarCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number;
  powerUses: Record<ArcaneScholarPowerId, number>; creations: AlchemistCreation[];
  analysisActiveAfter: false; coordinationActiveAfter: false; resistanceActiveAfter: false; elapsedSeconds: 60;
  playerActions: ArcaneScholarPlayerAction[]; enemyActions: ArcaneScholarEnemyAction[];
}
export function finishArcaneScholarCombatRound(s: SliceState, r: ArcaneScholarRoundContext, continuing = true): ArcaneScholarRoundOutcome {
  const e = s.arcaneScholar.encounter, c = s.combat, m = r.model;
  if (r.finished || !c || c.encounterId !== 'ARCANE_SCHOLAR_DISPUTE' || c.round !== r.source.round || r.liveState !== liveState(s)) throw new Error('原奥秘学者回合已结束或真实资源被改写。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  if (e.enemyStatus !== 'RESISTING') e.weaponLocation = 'YARD';
  for (const x of m.creations) if (!continuing || x.charge === 0 || x.durability === 0) x.active = false;
  m.analysisWindow = false; m.jammed = false; m.pendingGuards = 0; commit(s, r); r.finished = true;
  return { targetId: ARCANE_SCHOLAR_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus,
    playerSpiritualityBefore: r.playerSpiritualityBefore, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind, enemySpiritualityBefore: r.enemySpiritualityBefore,
    powerUses: { ...e.powerUses }, creations: structuredClone(m.creations), analysisActiveAfter: false, coordinationActiveAfter: false, resistanceActiveAfter: false,
    elapsedSeconds: 60, playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
}
export function projectArcaneScholarCombat(s: SliceState) {
  const e = s.arcaneScholar.encounter;
  return { enemyName: '科尔温（47岁，原创有限G3非凡者）', targetId: e.targetId, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality,
    powerUses: { ...e.powerUses }, creations: e.carriedIds.map(id => structuredClone(findArcaneScholarOriginalCreation(s, id))), originalExit: true, pursuit: false, distanceMetres: 2, source: currentArcaneScholarCombatSource(s),
    summary: '双方1–6次权重10/15/25/25/15/10；继承实际核心体30/感30/意25/知15、1250/底125、灵性120，仅继续轮恢复12G。解析4S/知识18开本轮一次普通打击+12×身体窗口；两原件协同5S+各1储能/知识18，成功40/减20，抵抗30%、JAM实付4S提高至70%。缺能普通回退，原架真实承接原棍才耐久−5。无第二轮盘、自动补能或新造物；原著3能力未核，本次扩展全为G。' };
}
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
function validSource(source: ArcaneScholarCombatSource): boolean {
  const origins = createAlchemistLifeState().materials;
  return !!source && typeof source.runId === 'string' && integer(source.revision) && integer(source.week, 1) && integer(source.round, 1) && source.attemptWeek === source.week && integer(source.startHistoryIndex) &&
    source.encounterId === 'ARCANE_SCHOLAR_DISPUTE' && source.targetId === ARCANE_SCHOLAR_TARGET_ID && source.targetAge === 47 && source.targetSequence === 3 && source.actualOriginalBody === true && source.independentMind === true &&
    source.enemyWeapon === 'AR3-CORWIN-CLUB' && source.weaponLocation === 'HAND' && source.distanceMetres === 2 && source.space === 'AR3-OPEN-WORKSHOP-YARD' && source.ordinaryExit === true && source.pursuit === false && source.noBystanders === true &&
    [source.playerHealth, source.playerMind, source.enemyHealth, source.enemyMind].every(n => integer(n, 1, 100)) && [source.playerSpirituality, source.enemySpirituality].every(n => integer(n, 0, 120)) && typeof source.clubHeld === 'boolean' && integer(source.knowledge, 0, 500) &&
    !!source.mastery && same(Object.keys(source.mastery).sort(), ABILITIES.filter(a => a.id.startsWith('paragon.')).map(a => a.id).sort()) && Object.values(source.mastery).every(n => integer(n, 0, 500)) &&
    !!source.powerUses && Object.keys(source.powerUses).length === 3 && ARCANE_SCHOLAR_POWER_IDS.every(id => integer(source.powerUses[id])) && source.enemySpirituality === 120 - ARCANE_SCHOLAR_POWERS.reduce((n, p) => n + source.powerUses[p.id] * p.cost, 0) &&
    Array.isArray(source.carriedIds) && source.carriedIds.length <= 2 && new Set(source.carriedIds).size === source.carriedIds.length && Array.isArray(source.creations) && source.creations.length === source.carriedIds.length &&
    source.creations.every((x, i) => { const box = x.id === 'AL4-BOX-1', origin = origins[box ? 0 : 1]!;
      return x.id === source.carriedIds[i] && ['AL4-BOX-1', 'AL4-FRAME-1'].includes(x.id) && x.kind === (box ? 'MESSENGER_BOX' : 'GUARD_FRAME') && x.madeBy === source.runId && x.owner === 'PLAYER' && x.custodian === 'PLAYER' && x.location === 'YARD' &&
        x.source === origin.source && same(x.componentIds, origin.componentIds) && integer(x.manufacturedWeek, 1, source.week) && integer(x.charge, 0, 3) && integer(x.durability, 0, 100) && typeof x.active === 'boolean' && (!x.active || x.charge > 0 && x.durability > 0); });
}
/** Validate finite paid actions and the original objects only. The established
 * common combat adapter remains the sole authority for physical injury/death. */
export function validateArcaneScholarRoundOutcome(value: unknown): value is ArcaneScholarRoundOutcome {
  try {
    const o = value as ArcaneScholarRoundOutcome;
    if (!o || !validSource(o.source) || o.targetId !== ARCANE_SCHOLAR_TARGET_ID || o.round !== o.source.round || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) || typeof o.continuing !== 'boolean' || o.elapsedSeconds !== 60 ||
        ![o.enemyHealth, o.playerHealthAfter].every(n => integer(n, 0, 100)) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(o.enemyStatus) || (o.enemyStatus === 'DEAD') !== (o.enemyHealth === 0) ||
        o.enemyMind !== o.source.enemyMind || o.playerMindAfter !== o.source.playerMind || ![o.playerSpiritualityBefore, o.playerSpiritualityAfter, o.enemySpiritualityBefore, o.enemySpirituality].every(n => integer(n, 0, 120)) ||
        o.playerHealthAfter > o.source.playerHealth || o.enemyHealth > o.source.enemyHealth || o.playerSpiritualityBefore !== o.source.playerSpirituality || o.enemySpiritualityBefore !== o.source.enemySpirituality ||
        !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) || o.playerActions.length > 6 || o.enemyActions.length > 6 || o.analysisActiveAfter !== false || o.coordinationActiveAfter !== false || o.resistanceActiveAfter !== false ||
        o.continuing && (o.enemyStatus !== 'RESISTING' || o.playerHealthAfter <= 0)) return false;
    const m = initialModel(o.source), all = [...o.playerActions.map(a => ({ actor: 'PLAYER', action: a })), ...o.enemyActions.map(a => ({ actor: 'ENEMY', action: a }))].sort((a, b) => a.action.order - b.action.order);
    for (const [i, item] of all.entries()) {
      const a = item.action;
      if (a.order !== i || !Number.isFinite(a.physicalFactor) || a.physicalFactor < 0 || a.physicalFactor > 1 || !Array.isArray(a.rolls) || a.rolls.some(n => !integer(n, 1, 100))) return false;
      let expected: ArcaneScholarPlayerAction | ArcaneScholarEnemyAction;
      if (item.actor === 'PLAYER') { const p = a as ArcaneScholarPlayerAction; if (!allowed(p.id)) return false;
        let cursor = 0; expected = playerAction(o.source, m, p.id, p.physicalFactor, i, () => { const n = a.rolls[cursor++]; if (n === undefined) throw new Error('Missing recorded check'); return n; });
        if (cursor !== a.rolls.length) return false;
      } else { const e = a as ArcaneScholarEnemyAction; if (!enemyAllowed(e.planned)) return false; expected = enemyAction(m, e.planned, e.physicalFactor, i); }
      if (!same(a, expected)) return false;
    }
    for (const x of m.creations) if (!o.continuing || x.charge === 0 || x.durability === 0) x.active = false;
    return o.playerSpiritualityAfter === m.playerSpirituality && o.enemySpirituality === m.enemySpirituality && same(o.powerUses, m.powerUses) && same(o.creations, m.creations);
  } catch { return false; }
}
